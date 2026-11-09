/**
 * Conversor universal: recebe qualquer arquivo, descobre o tipo REAL (pelos
 * bytes) e diz para quais formatos ele pode virar — só o que de fato
 * funciona. Depois chama o motor certo (imagem, mídia, PDF, documentos,
 * compactados). Os motores são carregados só quando usados.
 */
import { detectarTipo, extensaoDe, semExtensao, trocarExtensao } from '../nucleo/arquivos'
import { ErroAmigavel, cancelado } from '../nucleo/tarefa'
import { LIMITE_SERVIDOR, servidorDocumentos } from './documentos'

/** Grupos de formatos de destino, na ordem em que aparecem no seletor. */
export const GRUPOS = [
  { id: 'imagem', nome: 'Imagem', icone: 'imagem' },
  { id: 'video', nome: 'Vídeo', icone: 'video' },
  { id: 'audio', nome: 'Áudio', icone: 'audio' },
  { id: 'documento', nome: 'Documento', icone: 'documentos' },
  { id: 'compactado', nome: 'Compactado', icone: 'compactados' },
]

/** Formatos de destino. */
export const FORMATOS = {
  jpg: { rotulo: 'JPG', grupo: 'imagem', dica: 'Fotos. Abre em tudo; sem transparência.' },
  png: { rotulo: 'PNG', grupo: 'imagem', dica: 'Sem perdas e com transparência.' },
  webp: { rotulo: 'WEBP', grupo: 'imagem', dica: 'Bem menor que JPG e PNG, com transparência.' },
  avif: { rotulo: 'AVIF', grupo: 'imagem', dica: 'O menor de todos; alguns programas antigos não abrem.' },
  gif: { rotulo: 'GIF', grupo: 'imagem', dica: 'Animação sem som que toca em qualquer lugar.' },
  mp4: { rotulo: 'MP4', grupo: 'video', dica: 'Abre em qualquer aparelho e rede social.' },
  webm: { rotulo: 'WEBM', grupo: 'video', dica: 'Formato aberto da web.' },
  mov: { rotulo: 'MOV', grupo: 'video', dica: 'Padrão da Apple (QuickTime).' },
  mkv: { rotulo: 'MKV', grupo: 'video', dica: 'Contêiner flexível, comum em filmes.' },
  mp3: { rotulo: 'MP3', grupo: 'audio', dica: 'Toca em tudo.' },
  m4a: { rotulo: 'M4A', grupo: 'audio', dica: 'AAC: menor que MP3 na mesma qualidade.' },
  aac: { rotulo: 'AAC', grupo: 'audio', dica: 'AAC puro (ADTS).' },
  wav: { rotulo: 'WAV', grupo: 'audio', dica: 'Sem compressão: qualidade máxima, arquivo grande.' },
  flac: { rotulo: 'FLAC', grupo: 'audio', dica: 'Sem perdas e menor que WAV.' },
  ogg: { rotulo: 'OGG', grupo: 'audio', dica: 'Vorbis, formato aberto.' },
  opus: { rotulo: 'OPUS', grupo: 'audio', dica: 'Ótimo para voz; o do WhatsApp.' },
  pdf: { rotulo: 'PDF', grupo: 'documento', dica: 'Layout fixo, para enviar e imprimir.' },
  docx: { rotulo: 'DOCX', grupo: 'documento', dica: 'Microsoft Word.' },
  odt: { rotulo: 'ODT', grupo: 'documento', dica: 'LibreOffice e Google Docs.' },
  rtf: { rotulo: 'RTF', grupo: 'documento', dica: 'Texto formatado simples.' },
  txt: { rotulo: 'TXT', grupo: 'documento', dica: 'Só o texto, sem formatação.' },
  html: { rotulo: 'HTML', grupo: 'documento', dica: 'Página web.' },
  zip: { rotulo: 'ZIP', grupo: 'compactado', dica: 'Abre em qualquer computador e celular.' },
  '7z': { rotulo: '7Z', grupo: 'compactado', dica: 'Compressão maior; precisa do 7-Zip.' },
  tar: { rotulo: 'TAR', grupo: 'compactado', dica: 'Só empacota, sem comprimir.' },
  'tar.gz': { rotulo: 'TAR.GZ', grupo: 'compactado', dica: 'Padrão em Linux e servidores.' },
}

const MB = 1024 * 1024
/** Limite por tipo de entrada (memória do navegador). */
const LIMITES = { imagem: 60 * MB, video: 2048 * MB, audio: 1024 * MB, pdf: 300 * MB, documento: 100 * MB, markdown: 20 * MB, texto: 20 * MB, compactado: 1024 * MB }

const IMAGENS = ['png', 'jpg', 'webp', 'avif', 'gif', 'bmp', 'svg', 'ico']
const VIDEOS = ['mp4', 'webm', 'mov', 'mkv', 'avi', 'm4v', '3gp', '3g2', 'ts', 'mts', 'mpg', 'mpeg', 'wmv', 'flv', 'ogv', 'asf']
const AUDIOS = ['mp3', 'wav', 'ogg', 'oga', 'opus', 'flac', 'aac', 'm4a', 'weba', 'wma', 'aiff', 'aif', 'amr']
const COMPACTADOS = ['zip', '7z', 'rar', 'tar', 'gz', 'tgz', 'bz2', 'xz']
const SINONIMOS = { jpeg: 'jpg', htm: 'html', markdown: 'md', qt: 'mov', tif: 'tiff', mpga: 'mp3', 'x-ms-asf': 'asf' }
const canonica = (ext) => SINONIMOS[ext] ?? ext

/**
 * Tipo de um arquivo para conversão: { tipo, ext, rotulo } ou null se não
 * houver conversão possível. tipo: imagem | video | audio | pdf | documento |
 * markdown | texto | compactado. O conteúdo manda; a extensão desempata
 * (um .docx é um ZIP por dentro; um .m4a é um MP4 só de áudio…).
 */
export async function identificar(arquivo) {
  const nome = canonica(extensaoDe(arquivo.name))
  const real = await detectarTipo(arquivo)
  const r = real ? canonica(real.ext) : null
  const como = (tipo, ext) => ({ tipo, ext, rotulo: (ext === 'tar.gz' ? 'TAR.GZ' : ext).toUpperCase() })

  if (!r) return null
  if (r === 'pdf') return como('pdf', 'pdf')
  if (IMAGENS.includes(r)) return como('imagem', r)
  if (r === 'zip' && (nome === 'docx' || nome === 'odt')) return como('documento', nome)
  if (r === 'docx' || r === 'odt' || r === 'rtf') return como('documento', r)
  if (r === 'cfb' && nome === 'doc') return como('documento', 'doc')
  if (AUDIOS.includes(r) && !VIDEOS.includes(nome)) return como('audio', r === 'oga' ? 'ogg' : r)
  if (r === 'ogg' || r === 'opus') return nome === 'ogv' ? como('video', 'ogv') : como('audio', r)
  if (VIDEOS.includes(r) || r === 'mp4') {
    // MP4/WebM/ASF só de áudio com a extensão de áudio (.m4a, .weba, .wma).
    if (AUDIOS.includes(nome)) return como('audio', nome)
    return como('video', nome === 'mov' && r === 'mp4' ? 'mov' : r === 'asf' ? 'wmv' : r)
  }
  if (r === 'gz' && (nome === 'tgz' || /\.tar\.gz$/i.test(arquivo.name))) return como('compactado', 'tar.gz')
  if (COMPACTADOS.includes(r)) return como('compactado', r)
  if (r === 'html') return como('documento', 'html')
  if (r === 'txt') {
    if (nome === 'md') return como('markdown', 'md')
    if (nome === 'html') return como('documento', 'html')
    return como('texto', 'txt')
  }
  return null
}

/** Limite de tamanho para este tipo de entrada. */
export const limiteDe = (entrada) => LIMITES[entrada?.tipo] ?? 100 * MB

const SERVIDOR_DOC = ['pdf', 'docx', 'odt', 'rtf', 'txt', 'html']

/**
 * Destinos possíveis: [{ ext, servidor?, bloqueio? }]. `bloqueio` explica
 * por que um destino existe mas não serve para ESTE arquivo (ex.: grande
 * demais para o servidor).
 */
export function destinosPara(entrada, tamanho = 0) {
  if (!entrada) return []
  const { tipo, ext } = entrada
  let lista = []
  const servidor = (exts) => (servidorDocumentos ? exts.map((e) => ({ ext: e, servidor: true })) : [])
  if (tipo === 'imagem') {
    lista = ['jpg', 'png', 'webp', 'avif', 'pdf'].map((e) => ({ ext: e }))
    if (ext === 'gif') lista.push({ ext: 'mp4' }, { ext: 'webm' })
  } else if (tipo === 'video') {
    lista = ['mp4', 'webm', 'mov', 'mkv', 'gif', 'mp3', 'm4a', 'wav', 'flac', 'ogg', 'opus'].map((e) => ({ ext: e }))
  } else if (tipo === 'audio') {
    lista = ['mp3', 'm4a', 'aac', 'wav', 'flac', 'ogg', 'opus'].map((e) => ({ ext: e }))
  } else if (tipo === 'pdf') {
    lista = ['jpg', 'png', 'webp', 'txt'].map((e) => ({ ext: e }))
  } else if (tipo === 'documento') {
    // Com o LibreOffice, tudo; sem ele, ainda dá para tirar o texto no navegador (DOC antigo não).
    if (servidorDocumentos) lista = servidor(SERVIDOR_DOC)
    else if (ext !== 'doc') lista = [{ ext: 'txt' }]
  } else if (tipo === 'markdown') {
    lista = [{ ext: 'html' }, ...servidor(['pdf', 'docx', 'odt'])]
  } else if (tipo === 'texto') {
    lista = servidor(['pdf', 'docx', 'odt'])
  } else if (tipo === 'compactado') {
    lista = ['zip', '7z', 'tar', 'tar.gz'].map((e) => ({ ext: e }))
  }
  return lista
    .filter((d) => d.ext !== ext)
    .map((d) => (d.servidor && tamanho > LIMITE_SERVIDOR ? { ...d, bloqueio: 'Até 4,4 MB para conversão no servidor' } : d))
}

/** Opções ajustáveis de uma conversão e seus valores iniciais. */
export function opcoesPadrao(entrada, destino) {
  const g = FORMATOS[destino]?.grupo
  if (entrada?.tipo === 'pdf' && g === 'imagem') return { dpi: 150, paginas: '' }
  if (destino === 'gif' && entrada?.tipo === 'video') return { inicio: '', fim: '', largura: 480, fps: 12 }
  if (g === 'imagem') return { qualidade: 85, ...(entrada?.ext === 'svg' ? { escalaSvg: 1 } : {}) }
  if (destino === 'pdf' && entrada?.tipo === 'imagem') return { papel: 'a4', margem: 20 }
  if (g === 'video') return { qualidade: 'alta', resolucao: 0 }
  if (g === 'audio') return destino === 'wav' || destino === 'flac' ? {} : { bitrate: 192 }
  return {}
}

/**
 * Converte. ctx = { progresso(valor, rotulo), sinal }. Devolve
 * { nome, blob, detalhe? }. Erros esperados chegam como ErroAmigavel.
 */
export async function converter(arquivo, entrada, destino, opcoes = {}, ctx = {}) {
  cancelado(ctx.sinal)
  const o = { ...opcoesPadrao(entrada, destino), ...opcoes }
  const grupo = FORMATOS[destino]?.grupo
  const nome = trocarExtensao(arquivo.name, destino)
  const { tipo } = entrada

  // ─── Imagens ─────────────────────────────────────────────────────────────
  if (tipo === 'imagem' && grupo === 'imagem') {
    const { processarLote } = await import('./imagem')
    const [r] = await processarLote([{ arquivo }], () => ({ escalaSvg: o.escalaSvg ?? 1, saida: { formato: destino, qualidade: o.qualidade, fundo: '#ffffff' } }), { ...ctx, rotulo: 'Convertendo' })
    return { nome: r.nome, blob: r.blob, detalhe: r.detalhe, largura: r.largura, altura: r.altura }
  }
  if (tipo === 'imagem' && destino === 'pdf') {
    const { imagensParaPdf } = await import('./pdf/imagens')
    const r = await imagensParaPdf([arquivo], o, ctx)
    return { nome, blob: r.blob, detalhe: '1 página' }
  }

  // ─── Vídeo e áudio ──────────────────────────────────────────────────────
  if ((tipo === 'video' || entrada.ext === 'gif') && grupo === 'video') {
    const { converterVideo } = await import('./midia')
    return { nome, ...(await converterVideo(arquivo, { formato: destino, qualidade: o.qualidade, resolucao: o.resolucao }, ctx)) }
  }
  if (tipo === 'video' && destino === 'gif') {
    const { gerarGif, lerTempo } = await import('./gif')
    const [ini, fim] = [lerTempo(o.inicio), lerTempo(o.fim)]
    if (Number.isNaN(ini) || Number.isNaN(fim)) throw new ErroAmigavel('Use o tempo como minutos:segundos, por exemplo 0:12 ou 1:05.5.')
    if (ini != null && fim != null && fim <= ini) throw new ErroAmigavel('O fim do trecho precisa ser depois do início.')
    const r = await gerarGif(arquivo, { inicio: o.inicio, fim: o.fim, largura: o.largura, fps: o.fps, loop: true }, ctx)
    return { nome, blob: r.blob, detalhe: r.detalhe }
  }
  if ((tipo === 'video' || tipo === 'audio') && grupo === 'audio') {
    const { converterAudio } = await import('./midia')
    return { nome, ...(await converterAudio(arquivo, { formato: destino, bitrate: o.bitrate }, ctx)) }
  }

  // ─── PDF ─────────────────────────────────────────────────────────────────
  if (tipo === 'pdf' && grupo === 'imagem') {
    const { pdfParaImagens } = await import('./pdf/imagens')
    const paginas = await pdfParaImagens(arquivo, { formato: destino, dpi: o.dpi, paginas: o.paginas }, ctx)
    if (paginas.length === 1) return { ...paginas[0], nome: trocarExtensao(arquivo.name, destino) }
    // Várias páginas: um ZIP com uma imagem por página.
    const { zipar } = await import('../nucleo/arquivos')
    const blob = await zipar(paginas)
    return { nome: `${semExtensao(arquivo.name)}-${destino}.zip`, blob, detalhe: `${paginas.length} páginas em ZIP` }
  }
  if (tipo === 'pdf' && destino === 'txt') {
    const { abrirLeitura, extrairTexto } = await import('./pdf')
    const doc = await abrirLeitura(arquivo)
    try {
      const paginas = await extrairTexto(doc, (v) => ctx.progresso?.(v, 'Lendo as páginas'), ctx.sinal)
      const texto = paginas.join('\n\n')
      if (!texto.trim()) throw new ErroAmigavel('Este PDF não tem texto (as páginas são imagens). Use o OCR em PDF para reconhecer o texto.')
      return { nome, blob: new Blob([texto], { type: 'text/plain;charset=utf-8' }), detalhe: `${paginas.length} páginas` }
    } finally {
      doc.destroy()
    }
  }

  // ─── Documentos ──────────────────────────────────────────────────────────
  if (tipo === 'markdown' && destino === 'html') {
    const { markdownParaHtml } = await import('./markdown')
    const { lerTexto } = await import('../nucleo/arquivos')
    return { nome, blob: new Blob([await markdownParaHtml(await lerTexto(arquivo))], { type: 'text/html;charset=utf-8' }) }
  }
  if (tipo === 'documento' && destino === 'txt' && !servidorDocumentos) {
    const { extrairTextoDocumento } = await import('./documentos')
    const { texto } = await extrairTextoDocumento(arquivo)
    return { nome, blob: new Blob([texto], { type: 'text/plain;charset=utf-8' }) }
  }
  if (tipo === 'documento' || tipo === 'texto' || tipo === 'markdown') {
    const { converterNoServidor } = await import('./documentos')
    let envio = arquivo
    if (tipo === 'markdown') {
      // O LibreOffice não lê Markdown: vai como a página HTML equivalente.
      const { markdownParaHtml } = await import('./markdown')
      const { lerTexto } = await import('../nucleo/arquivos')
      envio = new File([await markdownParaHtml(await lerTexto(arquivo))], `${semExtensao(arquivo.name)}.html`, { type: 'text/html' })
    }
    ctx.progresso?.(null, 'Convertendo no servidor')
    return { nome, blob: await converterNoServidor(envio, destino, ctx.sinal) }
  }

  // ─── Compactados ─────────────────────────────────────────────────────────
  if (tipo === 'compactado') {
    const { conferirSeguranca, criar, extrair, listar } = await import('./compactados')
    ctx.progresso?.(null, 'Lendo o arquivo')
    const l = await listar(arquivo)
    if (l.precisaSenha || l.senhaErrada) throw new ErroAmigavel('Este arquivo é protegido por senha. Use “Extrair arquivos” para abri-lo com a senha.')
    conferirSeguranca(l, arquivo.size)
    cancelado(ctx.sinal)
    const extraidos = await extrair(l)
    const blob = await criar(extraidos.map((e) => ({ caminho: e.caminho, dados: e.blob })), { formato: destino, nivel: 5 }, ctx.progresso)
    const base = semExtensao(arquivo.name).replace(/\.tar$/i, '')
    return { nome: `${base}.${destino}`, blob, detalhe: `${extraidos.length} ${extraidos.length === 1 ? 'arquivo' : 'arquivos'}` }
  }

  throw new ErroAmigavel(`Não é possível converter ${entrada.rotulo} para ${FORMATOS[destino]?.rotulo ?? destino}.`)
}
