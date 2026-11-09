/**
 * Análise do áudio para o editor, feita uma vez ao abrir o arquivo:
 *  - picos para desenhar a forma de onda;
 *  - energia em janelas de 20 ms, para achar silêncios e estimar o volume
 *    (a prévia ao vivo de "remover silêncio" e "normalizar" usa isto).
 *
 * Quando o navegador não decodifica o formato (WMA, AMR, AIFF…) ou o arquivo é
 * grande demais para decodificar inteiro na memória, o ffmpeg gera uma versão
 * leve (prévia) — e, se precisar, também a versão para tocar.
 */
import { processarAudio } from '../../motores/midia'

export const JANELA = 0.02 // segundos por janela de energia
const COLUNAS = 4000 // resolução da forma de onda guardada
const MAX_DECODIFICAR = 80 * 1024 * 1024

async function decodificar(blob, taxa) {
  const ctx = new OfflineAudioContext(1, 1, taxa)
  return ctx.decodeAudioData(await blob.arrayBuffer())
}

/** AudioBuffer → mono (média dos canais). */
function mono(buf) {
  if (buf.numberOfChannels === 1) return buf.getChannelData(0)
  const saida = new Float32Array(buf.length)
  for (let c = 0; c < buf.numberOfChannels; c += 1) {
    const d = buf.getChannelData(c)
    for (let i = 0; i < d.length; i += 1) saida[i] += d[i]
  }
  for (let i = 0; i < saida.length; i += 1) saida[i] /= buf.numberOfChannels
  return saida
}

function medir(dados, taxa) {
  const duracao = dados.length / taxa
  const picos = new Float32Array(COLUNAS)
  const porColuna = dados.length / COLUNAS
  for (let c = 0; c < COLUNAS; c += 1) {
    let max = 0
    const fim = Math.min(Math.floor((c + 1) * porColuna), dados.length)
    for (let i = Math.floor(c * porColuna); i < fim; i += 1) {
      const v = dados[i] < 0 ? -dados[i] : dados[i]
      if (v > max) max = v
    }
    picos[c] = max
  }
  const porJanela = Math.max(1, Math.round(JANELA * taxa))
  const n = Math.ceil(dados.length / porJanela)
  const energia = new Float32Array(n) // média do quadrado (potência)
  const picoJanela = new Float32Array(n)
  for (let j = 0; j < n; j += 1) {
    let soma = 0
    let pico = 0
    const fim = Math.min((j + 1) * porJanela, dados.length)
    for (let i = j * porJanela; i < fim; i += 1) {
      const v = dados[i]
      soma += v * v
      const a = v < 0 ? -v : v
      if (a > pico) pico = a
    }
    energia[j] = soma / Math.max(1, fim - j * porJanela)
    picoJanela[j] = pico
  }
  return { duracao, picos, energia, picoJanela }
}

/**
 * Prepara o arquivo para o editor. Devolve
 * { tocar: Blob para o player, duracao, picos, energia, picoJanela }.
 */
export async function analisar(arquivo, ctx) {
  // 1. O navegador decodifica direto (o caso comum: MP3, WAV, M4A, OGG, FLAC, vídeos MP4/WebM).
  if (arquivo.size <= MAX_DECODIFICAR) {
    try {
      const buf = await decodificar(arquivo, 22050)
      return { tocar: arquivo, ...medir(mono(buf), buf.sampleRate) }
    } catch {
      /* formato que o navegador não lê: cai no ffmpeg */
    }
  }
  // 2. Grande demais para decodificar inteiro: análise numa cópia leve (mono, 8 kHz).
  const leve = await processarAudio(arquivo, { formato: 'wav', canais: 1, taxa: 8000 }, { ...ctx, progresso: (v) => ctx?.progresso?.(v, 'Lendo o áudio') })
  const buf = await decodificar(leve, 8000)
  const medidas = medir(buf.getChannelData(0), buf.sampleRate)
  // Se o navegador não toca o original, toca uma versão MP3.
  const toca = await new Promise((ok) => {
    const a = new Audio()
    const url = URL.createObjectURL(arquivo)
    const fim = (r) => {
      URL.revokeObjectURL(url)
      ok(r)
    }
    a.onloadedmetadata = () => fim(true)
    a.onerror = () => fim(false)
    a.src = url
  })
  const tocar = toca ? arquivo : await processarAudio(arquivo, { formato: 'mp3', bitrate: 160 }, { ...ctx, progresso: (v) => ctx?.progresso?.(v, 'Preparando a prévia') })
  return { tocar, ...medidas }
}

const db = (potencia) => 10 * Math.log10(Math.max(potencia, 1e-12))

/**
 * Trechos (em segundos) que "remover silêncio" tiraria, dentro de [inicio, fim].
 * modo 'pontas': só o silêncio do começo e do fim; 'tudo': também pausas de
 * `minimo` segundos ou mais no meio (0,5 s, como o filtro usado na exportação).
 */
export function silencios(analise, { inicio, fim, limiar, modo, minimo = 0.5 }) {
  if (!analise) return []
  const { energia } = analise
  const j0 = Math.max(0, Math.floor(inicio / JANELA))
  const j1 = Math.min(energia.length, Math.ceil(fim / JANELA))
  const mudo = (j) => db(energia[j]) < limiar
  const regioes = []
  let a = j0
  while (a < j1 && mudo(a)) a += 1
  if (a >= j1) return [[inicio, fim]] // tudo silêncio
  if (a > j0) regioes.push([inicio, a * JANELA])
  let b = j1 - 1
  while (b > a && mudo(b)) b -= 1
  if (modo === 'tudo') {
    let j = a
    while (j <= b) {
      if (!mudo(j)) {
        j += 1
        continue
      }
      const ini = j
      while (j <= b && mudo(j)) j += 1
      if ((j - ini) * JANELA >= minimo) regioes.push([ini * JANELA, j * JANELA])
    }
  }
  if (b < j1 - 1) regioes.push([(b + 1) * JANELA, fim])
  return regioes
}

/**
 * Ganho que leva o trecho a ~−14 LUFS (aproximado pela potência média das
 * partes com som), sem passar de −1 dB de pico: a prévia do "Normalizar".
 */
export function ganhoNormalizar(analise, inicio, fim) {
  if (!analise) return 1
  const { energia, picoJanela } = analise
  let soma = 0
  let n = 0
  let pico = 0
  for (let j = Math.floor(inicio / JANELA); j < Math.min(energia.length, Math.ceil(fim / JANELA)); j += 1) {
    if (picoJanela[j] > pico) pico = picoJanela[j]
    if (db(energia[j]) > -50) {
      soma += energia[j]
      n += 1
    }
  }
  if (!n) return 1
  const alvo = 10 ** ((-14 - db(soma / n)) / 20)
  return Math.min(alvo, 0.89 / Math.max(pico, 1e-6))
}

/** PCM estéreo (Float32) → WAV 16 bits. */
function wav16(esquerdo, direito, taxa) {
  const n = esquerdo.length
  const buf = new ArrayBuffer(44 + n * 4)
  const v = new DataView(buf)
  const txt = (o, s) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)))
  txt(0, 'RIFF')
  v.setUint32(4, 36 + n * 4, true)
  txt(8, 'WAVE')
  txt(12, 'fmt ')
  v.setUint32(16, 16, true)
  v.setUint16(20, 1, true)
  v.setUint16(22, 2, true)
  v.setUint32(24, taxa, true)
  v.setUint32(28, taxa * 4, true)
  v.setUint16(32, 4, true)
  v.setUint16(34, 16, true)
  txt(36, 'data')
  v.setUint32(40, n * 4, true)
  let o = 44
  for (let i = 0; i < n; i += 1) {
    v.setInt16(o, Math.max(-1, Math.min(1, esquerdo[i])) * 0x7fff, true)
    v.setInt16(o + 2, Math.max(-1, Math.min(1, direito[i])) * 0x7fff, true)
    o += 4
  }
  return new Blob([buf], { type: 'audio/wav' })
}

const MAX_JUNTOS = 40 * 60 // segundos: acima disso a memória do navegador não dá conta

/**
 * Vários arquivos tocados em sequência viram UM áudio (WAV 44,1 kHz estéreo,
 * sem perda), com a análise e as `fronteiras` (onde cada arquivo começa).
 * Com um arquivo só, é o mesmo que analisar().
 */
export async function analisarVarios(arquivos, ctx) {
  if (arquivos.length === 1) return { ...(await analisar(arquivos[0], ctx)), fronteiras: [] }
  const TAXA = 44100
  const buffers = []
  for (let i = 0; i < arquivos.length; i += 1) {
    ctx?.progresso?.(i / arquivos.length, `Juntando os arquivos (${i + 1} de ${arquivos.length})`)
    let buf
    try {
      buf = await decodificar(arquivos[i], TAXA)
    } catch {
      // Formato que o navegador não lê: o ffmpeg converte para WAV antes.
      const wav = await processarAudio(arquivos[i], { formato: 'wav', canais: 2, taxa: TAXA }, { sinal: ctx?.sinal, progresso: () => {} })
      buf = await decodificar(wav, TAXA)
    }
    buffers.push(buf)
  }
  const total = buffers.reduce((s, b) => s + b.length, 0)
  if (total / TAXA > MAX_JUNTOS) {
    const { ErroAmigavel } = await import('../../nucleo/tarefa')
    throw new ErroAmigavel('Juntos, os arquivos passam de 40 minutos — é mais do que o navegador consegue editar de uma vez. Use menos arquivos.')
  }
  const esquerdo = new Float32Array(total)
  const direito = new Float32Array(total)
  const fronteiras = []
  let pos = 0
  for (const b of buffers) {
    const l = b.getChannelData(0)
    esquerdo.set(l, pos)
    direito.set(b.numberOfChannels > 1 ? b.getChannelData(1) : l, pos)
    pos += b.length
    fronteiras.push(pos / TAXA)
  }
  fronteiras.pop()
  const media = new Float32Array(total)
  for (let i = 0; i < total; i += 1) media[i] = (esquerdo[i] + direito[i]) / 2
  return { tocar: new File([wav16(esquerdo, direito, TAXA)], 'juntos.wav', { type: 'audio/wav' }), fronteiras, ...medir(media, TAXA) }
}
