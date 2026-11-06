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

const segundos = (h, m, s) => Number(h) * 3600 + Number(m) * 60 + Number(s)

/**
 * Executa um comando do ffmpeg.
 *   entradas: [{ nome, dados: Blob | Uint8Array }]
 *   args:     argumentos (sem o -y final e sem a saída)
 *   saida:    nome do arquivo de saída (ou lista, para vários)
 *   duracao:  duração esperada da saída em segundos (melhora o progresso)
 * Devolve Uint8Array (ou lista, se `saida` for lista).
 * Progresso: lido do log ("time=…") contra a duração.
 */
export async function executarFfmpeg({ entradas, args, saida, duracao, aoProgredir, sinal, rotulo = 'Convertendo' }) {
  const anterior = fila
  let liberar
  fila = new Promise((r) => (liberar = r))
  await anterior
  try {
    const ff = await obterFfmpeg(aoProgredir)
    if (sinal?.aborted) throw new DOMException('Cancelado', 'AbortError')

    aoProgredir?.(null, 'Preparando os arquivos')
    for (const e of entradas) {
      const dados = e.dados instanceof Uint8Array ? e.dados : new Uint8Array(await e.dados.arrayBuffer())
      await ff.writeFile(e.nome, dados)
    }

    let total = duracao ?? null
    let ultimasLinhas = []
    const aoLog = ({ message }) => {
      ultimasLinhas = [...ultimasLinhas.slice(-30), message]
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
    try {
      const codigo = await ff.exec([...args, '-y', ...(Array.isArray(saida) ? [] : [saida])], -1, { signal: sinal })
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
    } finally {
      ff.off('log', aoLog)
      for (const nome of [...entradas.map((e) => e.nome), ...saidas]) await ff.deleteFile(nome).catch(() => {})
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
    for (const e of entradas) {
      await ff.writeFile(e.nome, e.dados instanceof Uint8Array ? e.dados : new Uint8Array(await e.dados.arrayBuffer()))
    }
    const aoLog = ({ message }) => {
      const t = /time=\s*(\d+):(\d+):([\d.]+)/.exec(message)
      if (t && duracao) aoProgredir?.(Math.min(segundos(t[1], t[2], t[3]) / duracao, 0.99), rotulo)
    }
    ff.on('log', aoLog)
    try {
      const codigo = await ff.exec([...args, '-y'], -1, { signal: sinal })
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
      for (const e of entradas) await ff.deleteFile(e.nome).catch(() => {})
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
