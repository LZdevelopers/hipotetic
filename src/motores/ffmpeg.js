/**
 * Motor de mídia no navegador: ffmpeg.wasm.
 *
 * O núcleo (~31 MB) vem do jsDelivr só na primeira vez que alguém usa uma
 * ferramenta de vídeo/áudio; o navegador guarda em cache. A biblioteca entra
 * por import() dinâmico, então nenhuma página paga por ela sem usar.
 *
 * Uma instância por aba, reaproveitada. As operações são enfileiradas (o
 * ffmpeg.wasm executa uma por vez) e cada uma limpa seus arquivos do sistema
 * de arquivos virtual ao terminar, para não acumular memória.
 */

import { ErroAmigavel } from '../nucleo/tarefa'

const CORE = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/esm'

let carregando = null
let fila = Promise.resolve()

export function obterFfmpeg(aoProgredir) {
  carregando ??= (async () => {
    aoProgredir?.(null, 'Carregando o motor de vídeo (só na primeira vez)')
    const [{ FFmpeg }, { toBlobURL }] = await Promise.all([import('@ffmpeg/ffmpeg'), import('@ffmpeg/util')])
    const ffmpeg = new FFmpeg()
    // Blob URLs: o worker do ffmpeg só importa scripts da própria origem.
    await ffmpeg.load({
      coreURL: await toBlobURL(`${CORE}/ffmpeg-core.js`, 'text/javascript'),
      wasmURL: await toBlobURL(`${CORE}/ffmpeg-core.wasm`, 'application/wasm'),
    })
    return ffmpeg
  })().catch((erro) => {
    carregando = null
    throw erro
  })
  return carregando
}

/** Sem nenhuma linha de log por este tempo, o worker travou (ou ficou sem memória). */
const TEMPO_TRAVADO = 120_000

const segundos = (h, m, s) => Number(h) * 3600 + Number(m) * 60 + Number(s)

/**
 * Coloca as entradas no sistema de arquivos do ffmpeg. Arquivos (Blob/File)
 * são MONTADOS (WORKERFS): o ffmpeg lê sob demanda, sem copiar o arquivo
 * inteiro para a memória — um vídeo de 1 GB não estoura mais o worker.
 * Devolve { caminhos: Map(nome → caminho), limpar() }.
 */
async function prepararEntradas(ff, entradas) {
  const caminhos = new Map()
  const montados = []
  const escritos = []
  for (const [i, e] of entradas.entries()) {
    if (e.dados instanceof Uint8Array) {
      await ff.writeFile(e.nome, e.dados)
      escritos.push(e.nome)
      continue
    }
    const dir = `/entrada${i}`
    try {
      await ff.createDir(dir)
      await ff.mount('WORKERFS', { blobs: [{ name: e.nome, data: e.dados }] }, dir)
      montados.push(dir)
      caminhos.set(e.nome, `${dir}/${e.nome}`)
    } catch {
      // Sem WORKERFS: copia (o jeito antigo).
      await ff.deleteDir(dir).catch(() => {})
      await ff.writeFile(e.nome, new Uint8Array(await e.dados.arrayBuffer()))
      escritos.push(e.nome)
    }
  }
  return {
    caminhos,
    async limpar() {
      for (const dir of montados) {
        await ff.unmount(dir).catch(() => {})
        await ff.deleteDir(dir).catch(() => {})
      }
      for (const nome of escritos) await ff.deleteFile(nome).catch(() => {})
    },
  }
}

/**
 * Executa um comando do ffmpeg.
 *   entradas: [{ nome, dados: Blob | Uint8Array }]
 *   args:     argumentos (sem o -y final e sem a saída)
 *   saida:    nome do arquivo de saída (ou lista, para vários)
 *   duracao:  duração esperada da saída em segundos (melhora o progresso)
 *   aoLog:    recebe cada linha do log (opcional)
 * Devolve Uint8Array (ou lista, se `saida` for lista).
 * Progresso: lido do log ("time=…") contra a duração.
 */
export async function executarFfmpeg({ entradas, args, saida, duracao, aoProgredir, aoLog: ouvinte, sinal, rotulo = 'Convertendo' }) {
  const anterior = fila
  let liberar
  fila = new Promise((r) => (liberar = r))
  await anterior
  try {
    const ff = await obterFfmpeg(aoProgredir)
    if (sinal?.aborted) throw new DOMException('Cancelado', 'AbortError')

    aoProgredir?.(null, 'Preparando os arquivos')
    const preparadas = await prepararEntradas(ff, entradas)
    const argsFinais = args.map((a) => preparadas.caminhos.get(a) ?? a)

    let total = duracao ?? null
    let ultimasLinhas = []
    let ultimoSinal = Date.now()
    let travou = false
    const aoLog = ({ message }) => {
      ultimoSinal = Date.now()
      ultimasLinhas = [...ultimasLinhas.slice(-30), message]
      ouvinte?.(message)
      if (!total) {
        const d = /Duration: (\d+):(\d+):([\d.]+)/.exec(message)
        if (d) total = segundos(d[1], d[2], d[3])
      }
      const t = /time=\s*(\d+):(\d+):([\d.]+)/.exec(message)
      if (t && total) aoProgredir?.(Math.min(segundos(t[1], t[2], t[3]) / total, 0.99), rotulo)
    }
    ff.on('log', aoLog)
    aoProgredir?.(total ? 0 : null, rotulo)

    const saidas = [saida].flat()
    // Vigia: o ffmpeg escreve no log o tempo todo; silêncio longo = travou. Encerra em vez de esperar para sempre.
    const vigia = setInterval(() => {
      if (Date.now() - ultimoSinal < TEMPO_TRAVADO) return
      travou = true
      clearInterval(vigia)
      ff.terminate()
      carregando = null
    }, 5000)
    try {
      const codigo = await ff.exec([...argsFinais, '-y', ...(Array.isArray(saida) ? [] : [saida])], -1, { signal: sinal })
      if (sinal?.aborted) throw new DOMException('Cancelado', 'AbortError')
      if (codigo !== 0) {
        console.error('ffmpeg falhou:\n' + ultimasLinhas.join('\n'))
        const erro = new Error('ffmpeg')
        erro.log = ultimasLinhas.join('\n')
        throw erro
      }
      const lidos = []
      for (const nome of saidas) lidos.push(await ff.readFile(nome))
      return Array.isArray(saida) ? lidos : lidos[0]
    } catch (erro) {
      if (travou) throw new ErroAmigavel('O processamento parou de responder — o navegador provavelmente ficou sem memória. Tente um trecho menor, uma resolução menor ou feche outras abas.')
      throw erro
    } finally {
      clearInterval(vigia)
      ff.off('log', aoLog)
      if (!travou) {
        await preparadas.limpar()
        for (const nome of saidas) await ff.deleteFile(nome).catch(() => {})
      }
    }
  } catch (erro) {
    // Cancelar no meio deixa a instância em estado indefinido: descarta.
    if (erro?.name === 'AbortError') {
      const ff = await carregando?.catch(() => null)
      ff?.terminate()
      carregando = null
    }
    throw erro
  } finally {
    liberar()
  }
}

/** Lista arquivos gerados por um padrão (ex.: segmentos de uma divisão). */
export async function executarComVariasSaidas({ entradas, args, prefixo, aoProgredir, sinal, duracao, rotulo }) {
  const anterior = fila
  let liberar
  fila = new Promise((r) => (liberar = r))
  await anterior
  try {
    const ff = await obterFfmpeg(aoProgredir)
    const preparadas = await prepararEntradas(ff, entradas)
    const aoLog = ({ message }) => {
      const t = /time=\s*(\d+):(\d+):([\d.]+)/.exec(message)
      if (t && duracao) aoProgredir?.(Math.min(segundos(t[1], t[2], t[3]) / duracao, 0.99), rotulo)
    }
    ff.on('log', aoLog)
    try {
      const codigo = await ff.exec([...args.map((a) => preparadas.caminhos.get(a) ?? a), '-y'], -1, { signal: sinal })
      if (codigo !== 0) throw new Error('ffmpeg')
      const nomes = (await ff.listDir('/'))
        .filter((n) => !n.isDir && n.name.startsWith(prefixo))
        .map((n) => n.name)
        .sort()
      const saidas = []
      for (const nome of nomes) {
        saidas.push({ nome, dados: await ff.readFile(nome) })
        await ff.deleteFile(nome).catch(() => {})
      }
      return saidas
    } finally {
      ff.off('log', aoLog)
      await preparadas.limpar()
    }
  } catch (erro) {
    if (erro?.name === 'AbortError') {
      const ff = await carregando?.catch(() => null)
      ff?.terminate()
      carregando = null
    }
    throw erro
  } finally {
    liberar()
  }
}

/** Baixa um arquivo inteiro na memória, informando o progresso (0 → 1). */
export async function baixarUrl(url, aoProgredir, sinal) {
  const resposta = await fetch(url, { signal: sinal })
  if (!resposta.ok || !resposta.body) throw new Error('download')
  const total = Number(resposta.headers.get('content-length')) || 0
  const partes = []
  let recebido = 0
  for await (const parte of resposta.body) {
    partes.push(parte)
    recebido += parte.byteLength
    if (total) aoProgredir?.(recebido / total)
  }
  const dados = new Uint8Array(recebido)
  let pos = 0
  for (const parte of partes) {
    dados.set(parte, pos)
    pos += parte.byteLength
  }
  return dados
}
