/**
 * Utilidades de arquivo usadas por todas as ferramentas.
 * Nada aqui depende do DOM no carregamento do módulo (é seguro no build/SSR).
 */

const UNIDADES = ['B', 'KB', 'MB', 'GB', 'TB']

/** 1536 → "1,5 KB"; 596399542 → "569 MB". */
export function formatarBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes < 0) return '—'
  if (bytes < 1024) return `${bytes} B`
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), UNIDADES.length - 1)
  const v = bytes / 1024 ** i
  return `${v.toLocaleString('pt-BR', { maximumFractionDigits: v < 10 ? 1 : 0 })} ${UNIDADES[i]}`
}

/** 213 → "3:33"; 5717 → "1:35:17". */
export function formatarDuracao(segundos) {
  if (!Number.isFinite(segundos) || segundos < 0) return '—'
  const t = Math.round(segundos)
  const h = Math.floor(t / 3600)
  const m = Math.floor((t % 3600) / 60)
  const s = String(t % 60).padStart(2, '0')
  return h ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`
}

/** Diferença percentual de tamanho: (antes, depois) → "−42%" / "+8%". */
export function variacao(antes, depois) {
  if (!antes) return ''
  const p = Math.round(((depois - antes) / antes) * 100)
  return p === 0 ? '0%' : `${p > 0 ? '+' : '−'}${Math.abs(p)}%`
}

/**
 * Nome de arquivo seguro: sem caminhos, sem caracteres proibidos no
 * Windows/macOS/Linux, sem nomes reservados (CON, NUL…), até 150 caracteres.
 */
export function nomeSeguro(nome, padrao = 'arquivo') {
  let limpo = String(nome ?? '')
    .split(/[\\/]/)
    .pop()
    .replace(/[<>:"|?*\u0000-\u001f\u007f]+/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^[\s.]+|[\s.]+$/g, '')
  if (/^(con|prn|aux|nul|com\d|lpt\d)(\.|$)/i.test(limpo)) limpo = `_${limpo}`
  if (limpo.length > 150) {
    const ext = extensaoDe(limpo)
    limpo = limpo.slice(0, 150 - ext.length - 1) + (ext ? `.${ext}` : '')
  }
  return limpo || padrao
}

/** "Foto.Final.JPG" → "jpg"; "LEIAME" → "". */
export function extensaoDe(nome) {
  const m = /\.([a-z0-9]{1,8})$/i.exec(String(nome ?? ''))
  return m ? m[1].toLowerCase() : ''
}

/** "foto.png" → "foto". */
export function semExtensao(nome) {
  return String(nome ?? '').replace(/\.[a-z0-9]{1,8}$/i, '')
}

/** ("foto.png", "webp") → "foto.webp"; com sufixo: ("a.pdf","pdf","-1") → "a-1.pdf". */
export function trocarExtensao(nome, extensao, sufixo = '') {
  return nomeSeguro(`${semExtensao(nome)}${sufixo}.${extensao}`)
}

export const MIME = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  avif: 'image/avif',
  gif: 'image/gif',
  bmp: 'image/bmp',
  ico: 'image/x-icon',
  svg: 'image/svg+xml',
  pdf: 'application/pdf',
  zip: 'application/zip',
  '7z': 'application/x-7z-compressed',
  tar: 'application/x-tar',
  gz: 'application/gzip',
  mp4: 'video/mp4',
  webm: 'video/webm',
  mov: 'video/quicktime',
  mkv: 'video/x-matroska',
  mp3: 'audio/mpeg',
  m4a: 'audio/mp4',
  aac: 'audio/aac',
  wav: 'audio/wav',
  ogg: 'audio/ogg',
  opus: 'audio/ogg',
  flac: 'audio/flac',
  txt: 'text/plain',
  html: 'text/html',
  md: 'text/markdown',
  json: 'application/json',
  csv: 'text/csv',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  odt: 'application/vnd.oasis.opendocument.text',
  rtf: 'application/rtf',
  doc: 'application/msword',
}

export const mimeDe = (extensao) => MIME[extensao] ?? 'application/octet-stream'

/**
 * Tipo REAL do arquivo, pelos primeiros bytes (assinatura), não pelo nome.
 * Devolve { ext, mime } ou null quando não há assinatura conhecida (texto
 * puro, SVG, CSV… são reconhecidos à parte, por conteúdo).
 */
export async function detectarTipo(arquivo) {
  const { fileTypeFromBlob } = await import('file-type')
  const tipo = await fileTypeFromBlob(arquivo).catch(() => null)
  if (tipo) return tipo
  // Formatos de texto não têm assinatura binária: olha o começo do conteúdo.
  const inicio = await arquivo.slice(0, 2048).text().catch(() => '')
  if (/^\s*(<\?xml[^>]*>\s*)?(<!--[\s\S]*?-->\s*)*<svg[\s>]/i.test(inicio)) return { ext: 'svg', mime: 'image/svg+xml' }
  if (/^\s*<!doctype html|^\s*<html[\s>]/i.test(inicio)) return { ext: 'html', mime: 'text/html' }
  if (/^\{\\rtf/.test(inicio)) return { ext: 'rtf', mime: 'application/rtf' }
  if (inicio && !/[\u0000-\u0008\u000e-\u001f]/.test(inicio)) return { ext: 'txt', mime: 'text/plain' }
  return null
}

/** Dispara o download de um Blob com o nome dado. */
export function baixarBlob(blob, nome) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nomeSeguro(nome)
  document.body.append(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

/**
 * Junta vários arquivos num ZIP (sem recompressão de formatos já
 * comprimidos). Nomes repetidos ganham " (2)", " (3)"…
 */
export async function zipar(arquivos, aoProgredir) {
  const { zip } = await import('fflate')
  const entradas = {}
  const usados = new Set()
  for (let i = 0; i < arquivos.length; i += 1) {
    const { nome, blob } = arquivos[i]
    let final = nomeSeguro(nome)
    for (let n = 2; usados.has(final.toLowerCase()); n += 1) final = trocarExtensao(nome, extensaoDe(nome), ` (${n})`)
    usados.add(final.toLowerCase())
    const jaComprimido = /^(jpe?g|png|webp|avif|gif|mp[34]|m4a|webm|mkv|mov|zip|7z|gz|pdf|docx|odt|ogg|opus|flac)$/.test(extensaoDe(final))
    entradas[final] = [new Uint8Array(await blob.arrayBuffer()), { level: jaComprimido ? 0 : 6 }]
    aoProgredir?.((i + 1) / arquivos.length)
  }
  return new Promise((resolve, reject) => {
    zip(entradas, (erro, dados) => (erro ? reject(erro) : resolve(new Blob([dados], { type: 'application/zip' }))))
  })
}

/** Lê um arquivo de texto respeitando BOM UTF-8/UTF-16. */
export async function lerTexto(arquivo) {
  const bytes = new Uint8Array(await arquivo.arrayBuffer())
  let codificacao = 'utf-8'
  if (bytes[0] === 0xff && bytes[1] === 0xfe) codificacao = 'utf-16le'
  else if (bytes[0] === 0xfe && bytes[1] === 0xff) codificacao = 'utf-16be'
  try {
    return new TextDecoder(codificacao, { fatal: true }).decode(bytes)
  } catch {
    // Não é UTF-8 válido: quase sempre é Windows-1252 (arquivos antigos do Windows).
    return new TextDecoder('windows-1252').decode(bytes)
  }
}
