/**
 * Motor de vídeo e áudio. Duas engrenagens:
 *
 *  1. Mediabunny (WebCodecs): decodifica/codifica com a aceleração de vídeo do
 *     próprio navegador — de 5× a 30× mais rápido que WebAssembly. Usado para
 *     converter, comprimir, cortar, redimensionar, girar e recortar vídeo
 *     quando o navegador suporta os codecs envolvidos.
 *  2. ffmpeg.wasm: o canivete suíço. Cobre o que o WebCodecs não faz (AVI,
 *     GIF, MP3, velocidade, juntar, filtros de áudio) e é a reserva quando o
 *     navegador não tem o codec.
 *
 * Ambos rodam no aparelho do usuário: nenhum arquivo vai para servidor.
 */
import { extensaoDe } from '../nucleo/arquivos'
import { ErroAmigavel, cancelado } from '../nucleo/tarefa'
import { executarFfmpeg } from './ffmpeg'

export const LIMITE_VIDEO = 2 * 1024 * 1024 * 1024 // 2 GB: acima disso o navegador costuma ficar sem memória
export const LIMITE_AUDIO = 1024 * 1024 * 1024
export const EXTENSOES_VIDEO = ['mp4', 'webm', 'mov', 'mkv', 'avi', 'm4v', '3gp', 'ts', 'mpeg', 'mpg', 'wmv', 'flv', 'ogv']
export const EXTENSOES_AUDIO = ['mp3', 'wav', 'ogg', 'oga', 'opus', 'flac', 'aac', 'm4a', 'weba', 'wma', 'aiff', 'aif', 'amr']
export const DESCRICAO_VIDEO = 'MP4, WebM, MOV, MKV, AVI e outros'
export const DESCRICAO_AUDIO = 'MP3, WAV, OGG, FLAC, AAC, M4A, OPUS'

const mediabunny = () => import('mediabunny')

/* ─── Informações ─────────────────────────────────────────────────────────── */

/**
 * Duração, dimensões e codecs. Tenta o Mediabunny (lê só o cabeçalho, sem
 * decodificar); se ele não reconhecer o formato (AVI, WMV…), pergunta ao ffmpeg.
 */
export async function infoMidia(arquivo) {
  try {
    const mb = await mediabunny()
    const input = new mb.Input({ source: new mb.BlobSource(arquivo), formats: mb.ALL_FORMATS })
    const [duracao, video, audio] = await Promise.all([input.computeDuration(), input.getPrimaryVideoTrack(), input.getPrimaryAudioTrack()])
    const info = {
      duracao,
      temVideo: Boolean(video),
      temAudio: Boolean(audio),
      largura: video?.displayWidth ?? null,
      altura: video?.displayHeight ?? null,
      codecVideo: video?.codec ?? null,
      codecAudio: audio?.codec ?? null,
      leitor: 'mediabunny',
    }
    input.dispose?.()
    return info
  } catch {
    return infoPeloFfmpeg(arquivo)
  }
}

async function infoPeloFfmpeg(arquivo) {
  const linhas = []
  const { obterFfmpeg } = await import('./ffmpeg')
  const ff = await obterFfmpeg()
  const nome = `info.${extensaoDe(arquivo.name) || 'bin'}`
  await ff.writeFile(nome, new Uint8Array(await arquivo.arrayBuffer()))
  const aoLog = ({ message }) => linhas.push(message)
  ff.on('log', aoLog)
  try {
    await ff.exec(['-hide_banner', '-i', nome])
  } finally {
    ff.off('log', aoLog)
    await ff.deleteFile(nome).catch(() => {})
  }
  const texto = linhas.join('\n')
  const d = /Duration: (\d+):(\d+):([\d.]+)/.exec(texto)
  const v = /Stream #[^\n]*Video: ([a-z0-9]+)[^\n]*?, (\d{2,5})x(\d{2,5})/.exec(texto)
  const a = /Stream #[^\n]*Audio: ([a-z0-9]+)/.exec(texto)
  if (!d && !v && !a) throw new ErroAmigavel('Não foi possível ler este arquivo de mídia. Ele pode estar corrompido.')
  return {
    duracao: d ? Number(d[1]) * 3600 + Number(d[2]) * 60 + Number(d[3]) : null,
    temVideo: Boolean(v),
    temAudio: Boolean(a),
    largura: v ? Number(v[2]) : null,
    altura: v ? Number(v[3]) : null,
    codecVideo: v?.[1] ?? null,
    codecAudio: a?.[1] ?? null,
    leitor: 'ffmpeg',
  }
}

/* ─── Conversão de vídeo pelo Mediabunny ──────────────────────────────────── */

const CONTEINERES = {
  mp4: { classe: 'Mp4OutputFormat', video: ['avc', 'hevc', 'av1'], audio: ['aac', 'opus'], mime: 'video/mp4' },
  mov: { classe: 'MovOutputFormat', video: ['avc', 'hevc'], audio: ['aac'], mime: 'video/quicktime' },
  mkv: { classe: 'MkvOutputFormat', video: ['avc', 'vp9', 'av1', 'hevc'], audio: ['aac', 'opus'], mime: 'video/x-matroska' },
  webm: { classe: 'WebMOutputFormat', video: ['vp9', 'vp8', 'av1'], audio: ['opus', 'vorbis'], mime: 'video/webm' },
}

const QUALIDADES = { muito_baixa: 'QUALITY_VERY_LOW', baixa: 'QUALITY_LOW', media: 'QUALITY_MEDIUM', alta: 'QUALITY_HIGH', muito_alta: 'QUALITY_VERY_HIGH' }

/**
 * Converte com o Mediabunny. Devolve um Blob, ou `null` quando não é possível
 * (formato de entrada desconhecido ou codec indisponível) — aí quem chamou usa
 * o ffmpeg. Opções:
 *   formato: 'mp4' | 'webm' | 'mov' | 'mkv'
 *   codec:   'avc' | 'hevc' | 'vp9' | 'vp8' | 'av1' (opcional; escolhe o melhor disponível)
 *   qualidade: chave de QUALIDADES, ou bitrate em bits/s (número)
 *   largura, altura, ajuste ('fill' | 'contain' | 'cover'), girar (0/90/180/270),
 *   espelhar, recorte {left, top, width, height}, fps, semAudio, inicio, fim,
 *   forcar (sempre recodifica)
 */
export async function converterVideoMb(arquivo, o, { progresso, sinal }) {
  const mb = await mediabunny()
  let input
  try {
    input = new mb.Input({ source: new mb.BlobSource(arquivo), formats: mb.ALL_FORMATS })
    await input.getFormat()
  } catch {
    return null
  }
  const destino = CONTEINERES[o.formato]
  const pedido = o.codec ? [o.codec] : destino.video
  const largura = o.largura ? Math.round(o.largura / 2) * 2 : undefined
  const altura = o.altura ? Math.round(o.altura / 2) * 2 : undefined
  const codecVideo = await mb.getFirstEncodableVideoCodec(pedido.filter((c) => destino.video.includes(c)), { width: largura ?? 1920, height: altura ?? 1080 })
  if (!codecVideo) return null
  const codecAudio = await mb.getFirstEncodableAudioCodec(destino.audio)

  // Qualidade por nível (o codificador escolhe o bitrate) ou bitrate exato (comprimir para um tamanho).
  const porBitrate = typeof o.qualidade === 'number'
  const output = new mb.Output({ format: new mb[destino.classe](o.formato === 'mp4' || o.formato === 'mov' ? { fastStart: 'in-memory' } : {}), target: new mb.BufferTarget() })
  const conversao = await mb.Conversion.init({
    input,
    output,
    showWarnings: false,
    tracks: 'primary',
    trim: o.inicio != null || o.fim != null ? { start: o.inicio ?? undefined, end: o.fim ?? undefined } : undefined,
    video: {
      codec: codecVideo,
      quality: porBitrate ? undefined : mb[QUALIDADES[o.qualidade ?? 'alta']],
      bitrate: porBitrate ? o.qualidade : undefined,
      width: largura,
      height: altura,
      fit: largura && altura ? (o.ajuste ?? 'contain') : undefined,
      rotate: o.girar || undefined,
      flip: o.espelhar || undefined,
      crop: o.recorte,
      frameRate: o.fps || undefined,
      forceTranscode: o.forcar || undefined,
      allowTransformationMetadata: false,
    },
    audio: o.semAudio || !codecAudio ? { discard: true } : { codec: codecAudio, quality: mb.QUALITY_HIGH },
  })
  // Sem trilha de vídeo utilizável (codec de entrada que o navegador não decodifica).
  if (!conversao.isValid || !conversao.utilizedTracks.some((t) => t.type === 'video')) {
    input.dispose?.()
    return null
  }
  if (!o.semAudio && !codecAudio && (await input.getPrimaryAudioTrack())) {
    // Haveria perda do som sem aviso: melhor deixar o ffmpeg fazer.
    input.dispose?.()
    return null
  }
  const aoCancelar = () => conversao.cancel()
  sinal?.addEventListener('abort', aoCancelar, { once: true })
  conversao.onProgress = (p) => progresso(Math.min(p, 0.99), 'Convertendo (aceleração do navegador)')
  try {
    await conversao.execute()
  } catch (erro) {
    if (sinal?.aborted || erro instanceof mb.ConversionCanceledError) throw new DOMException('Cancelado', 'AbortError')
    console.warn('Mediabunny falhou; tentando com o ffmpeg.', erro)
    return null
  } finally {
    sinal?.removeEventListener('abort', aoCancelar)
    input.dispose?.()
  }
  return new Blob([output.target.buffer], { type: destino.mime })
}

/* ─── ffmpeg: argumentos de vídeo ─────────────────────────────────────────── */

const CRF = { muito_baixa: 34, baixa: 30, media: 26, alta: 22, muito_alta: 18 }

/** Argumentos de codificação de vídeo do ffmpeg para o formato/qualidade pedidos. */
export function argsVideoFfmpeg(formato, qualidade = 'alta') {
  const crf = typeof qualidade === 'number' ? null : CRF[qualidade]
  if (formato === 'webm') {
    // VP9 em tempo real: o modo "good" levaria muitos minutos em WebAssembly.
    return ['-c:v', 'libvpx-vp9', '-deadline', 'realtime', '-cpu-used', '8', '-row-mt', '1', ...(crf ? ['-crf', String(crf + 8), '-b:v', '0'] : ['-b:v', String(qualidade)]), '-c:a', 'libopus', '-b:a', '128k']
  }
  const audio = ['-c:a', 'aac', '-b:a', '160k']
  const v = ['-c:v', 'libx264', '-preset', 'veryfast', '-pix_fmt', 'yuv420p', ...(crf ? ['-crf', String(crf)] : ['-b:v', String(qualidade), '-maxrate', String(qualidade), '-bufsize', String(qualidade * 2)])]
  return [...v, ...audio, ...(formato === 'mp4' || formato === 'mov' ? ['-movflags', '+faststart'] : [])]
}

/** Monta a cadeia de filtros (-vf) de vídeo a partir das opções do editor. */
export function filtrosVideo({ recorte, girar, espelhar, largura, altura, ajuste, fps, velocidade }) {
  const f = []
  if (girar === 90) f.push('transpose=1')
  else if (girar === 180) f.push('transpose=1,transpose=1')
  else if (girar === 270) f.push('transpose=2')
  if (espelhar) f.push('hflip')
  if (recorte) f.push(`crop=${recorte.width}:${recorte.height}:${recorte.left}:${recorte.top}`)
  if (largura || altura) {
    const w = largura ? Math.round(largura / 2) * 2 : -2
    const h = altura ? Math.round(altura / 2) * 2 : -2
    if (largura && altura && ajuste === 'contain') f.push(`scale=${w}:${h}:force_original_aspect_ratio=decrease`, `pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2`)
    else if (largura && altura && ajuste === 'cover') f.push(`scale=${w}:${h}:force_original_aspect_ratio=increase`, `crop=${w}:${h}`)
    else f.push(`scale=${w}:${h}`)
  }
  if (velocidade && velocidade !== 1) f.push(`setpts=PTS/${velocidade}`)
  if (fps) f.push(`fps=${fps}`)
  f.push('scale=trunc(iw/2)*2:trunc(ih/2)*2') // H.264 exige dimensões pares
  return f.join(',')
}

/** atempo só aceita 0,5–2: encadeia para velocidades fora disso. */
export function filtroVelocidadeAudio(v) {
  const partes = []
  let resto = v
  while (resto > 2) {
    partes.push('atempo=2')
    resto /= 2
  }
  while (resto < 0.5) {
    partes.push('atempo=0.5')
    resto /= 0.5
  }
  partes.push(`atempo=${resto.toFixed(4)}`)
  return partes.join(',')
}

/**
 * Converte/edita vídeo: Mediabunny quando possível, senão ffmpeg.
 * `o` como em converterVideoMb, mais `velocidade` (só ffmpeg).
 */
export async function processarVideo(arquivo, o, ctx) {
  const precisaFfmpeg = (o.velocidade && o.velocidade !== 1) || o.formato === 'avi'
  if (!precisaFfmpeg) {
    const blob = await converterVideoMb(arquivo, o, ctx)
    if (blob) return { blob, motor: 'navegador' }
    cancelado(ctx.sinal)
  }
  const info = await infoMidia(arquivo).catch(() => ({}))
  const entrada = `entrada.${extensaoDe(arquivo.name) || 'mp4'}`
  const args = []
  if (o.inicio) args.push('-ss', String(o.inicio))
  args.push('-i', entrada)
  if (o.fim != null) args.push('-t', String(o.fim - (o.inicio ?? 0)))
  args.push('-vf', filtrosVideo(o))
  if (o.semAudio) args.push('-an')
  else if (o.velocidade && o.velocidade !== 1) args.push('-af', filtroVelocidadeAudio(o.velocidade))
  args.push(...argsVideoFfmpeg(o.formato, o.qualidade))
  if (o.semAudio) {
    const i = args.indexOf('-c:a')
    if (i >= 0) args.splice(i, 4)
  }
  const duracaoSaida = ((o.fim ?? info.duracao ?? 0) - (o.inicio ?? 0)) / (o.velocidade || 1)
  const dados = await executarFfmpeg({
    entradas: [{ nome: entrada, dados: arquivo }],
    args,
    saida: `saida.${o.formato}`,
    duracao: duracaoSaida > 0 ? duracaoSaida : undefined,
    aoProgredir: ctx.progresso,
    sinal: ctx.sinal,
    rotulo: 'Convertendo (WebAssembly)',
  }).catch((erro) => {
    if (erro?.name === 'AbortError') throw erro
    throw new ErroAmigavel('Não foi possível converter este vídeo. O arquivo pode estar corrompido ou usar um codec sem suporte.')
  })
  return { blob: new Blob([dados], { type: CONTEINERES[o.formato]?.mime ?? 'video/mp4' }), motor: 'webassembly' }
}

/* ─── Áudio (ffmpeg) ──────────────────────────────────────────────────────── */

export const FORMATOS_AUDIO = {
  mp3: { args: (k) => ['-c:a', 'libmp3lame', '-b:a', `${k}k`], mime: 'audio/mpeg', rotulo: 'MP3' },
  m4a: { args: (k) => ['-c:a', 'aac', '-b:a', `${k}k`, '-movflags', '+faststart'], mime: 'audio/mp4', rotulo: 'M4A (AAC)' },
  aac: { args: (k) => ['-c:a', 'aac', '-b:a', `${k}k`, '-f', 'adts'], mime: 'audio/aac', rotulo: 'AAC' },
  ogg: { args: (k) => ['-c:a', 'libvorbis', '-b:a', `${k}k`], mime: 'audio/ogg', rotulo: 'OGG (Vorbis)' },
  opus: { args: (k) => ['-c:a', 'libopus', '-b:a', `${Math.min(k, 256)}k`], mime: 'audio/ogg', rotulo: 'OPUS' },
  wav: { args: () => ['-c:a', 'pcm_s16le'], mime: 'audio/wav', rotulo: 'WAV', semPerdas: true },
  flac: { args: () => ['-c:a', 'flac', '-compression_level', '8'], mime: 'audio/flac', rotulo: 'FLAC', semPerdas: true },
}

/**
 * Processa áudio com o ffmpeg. `filtros` é a cadeia -af (opcional);
 * `entradaExtra` para juntar/mixar. Devolve Blob.
 */
export async function processarAudio(arquivo, { formato, bitrate = 192, filtros, inicio, fim, canais, taxa, metadados }, { progresso, sinal }, duracaoEsperada) {
  const destino = FORMATOS_AUDIO[formato]
  const entrada = `entrada.${extensaoDe(arquivo.name) || 'bin'}`
  const args = []
  if (inicio) args.push('-ss', String(inicio))
  args.push('-i', entrada)
  if (fim != null) args.push('-t', String(fim - (inicio ?? 0)))
  args.push('-vn', '-map_metadata', '0')
  if (filtros) args.push('-af', filtros)
  if (canais) args.push('-ac', String(canais))
  if (taxa) args.push('-ar', String(taxa))
  for (const [k, v] of Object.entries(metadados ?? {})) args.push('-metadata', `${k}=${v}`)
  args.push(...destino.args(bitrate))
  const dados = await executarFfmpeg({
    entradas: [{ nome: entrada, dados: arquivo }],
    args,
    saida: `saida.${formato}`,
    duracao: duracaoEsperada,
    aoProgredir: progresso,
    sinal,
    rotulo: 'Processando o áudio',
  }).catch((erro) => {
    if (erro?.name === 'AbortError') throw erro
    throw new ErroAmigavel('Não foi possível processar este arquivo. Ele pode não ter áudio ou estar corrompido.')
  })
  return new Blob([dados], { type: destino.mime })
}
