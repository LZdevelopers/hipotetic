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
 * 0,5 s ou mais no meio (como o filtro usado na exportação).
 */
export function silencios(analise, { inicio, fim, limiar, modo }) {
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
      if ((j - ini) * JANELA >= 0.5) regioes.push([ini * JANELA, j * JANELA])
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
