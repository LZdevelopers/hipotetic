/**
 * Documentos no navegador: texto e metadados de DOCX, ODT, RTF, HTML, TXT e
 * PDF, sem servidor. DOCX e ODT são ZIPs de XML: lidos com fflate +
 * DOMParser. A conversão com layout (DOCX → PDF etc.) é do serviço
 * LibreOffice (converterNoServidor), quando ele está ativo.
 */
import { detectarTipo, extensaoDe, lerTexto } from '../nucleo/arquivos'
import { ErroAmigavel } from '../nucleo/tarefa'

export const EXTENSOES_TEXTO_DOC = ['docx', 'odt', 'rtf', 'txt', 'md', 'html', 'htm', 'pdf']
export const LIMITE_SERVIDOR = Math.floor(4.4 * 1024 * 1024) // limite de corpo das funções da Vercel (4,5 MB)

/** Serviço LibreOffice ativo neste build? (variável VITE_DOCUMENTOS=1) */
export const servidorDocumentos = import.meta.env?.VITE_DOCUMENTOS === '1'

async function abrirZip(arquivo) {
  const { unzipSync } = await import('fflate')
  try {
    return unzipSync(new Uint8Array(await arquivo.arrayBuffer()))
  } catch {
    throw new ErroAmigavel('O arquivo parece corrompido (não foi possível abri-lo).')
  }
}

const xml = (bytes) => new DOMParser().parseFromString(new TextDecoder().decode(bytes), 'application/xml')

function textoDocx(doc) {
  const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
  const paragrafos = []
  for (const p of doc.getElementsByTagNameNS(W, 'p')) {
    let t = ''
    for (const n of p.getElementsByTagNameNS(W, '*')) {
      if (n.localName === 't') t += n.textContent
      else if (n.localName === 'tab') t += '\t'
      else if (n.localName === 'br' || n.localName === 'cr') t += '\n'
    }
    paragrafos.push(t)
  }
  return paragrafos.join('\n')
}

function textoOdt(doc) {
  const T = 'urn:oasis:names:tc:opendocument:xmlns:text:1.0'
  const saida = []
  const andar = (no) => {
    let t = ''
    for (const filho of no.childNodes) {
      if (filho.nodeType === 3) t += filho.nodeValue
      else if (filho.namespaceURI === T && filho.localName === 'tab') t += '\t'
      else if (filho.namespaceURI === T && filho.localName === 'line-break') t += '\n'
      else if (filho.namespaceURI === T && filho.localName === 's') t += ' '.repeat(Number(filho.getAttributeNS(T, 'c')) || 1)
      else if (filho.nodeType === 1 && !(filho.namespaceURI === T && (filho.localName === 'p' || filho.localName === 'h'))) t += andar(filho)
    }
    return t
  }
  for (const p of doc.getElementsByTagNameNS(T, '*')) if (p.localName === 'p' || p.localName === 'h') saida.push(andar(p))
  return saida.join('\n')
}

/** RTF → texto: ignora grupos de controle, decodifica \'hh (cp1252) e \uN. */
export function textoRtf(rtf) {
  let saida = ''
  let i = 0
  const pilha = [{ ignorar: false, pular: 1 }]
  const cp1252 = new TextDecoder('windows-1252')
  const ignorados = new Set(['fonttbl', 'colortbl', 'stylesheet', 'info', 'pict', 'header', 'footer', 'object', 'themedata', 'datastore', 'latentstyles', 'listtable', 'listoverridetable', 'rsidtbl', 'generator', 'xmlnstbl', 'mmathPr', 'fldinst'])
  let pularUnicode = 0
  while (i < rtf.length) {
    const c = rtf[i]
    const topo = pilha[pilha.length - 1]
    if (c === '{') {
      pilha.push({ ignorar: topo.ignorar, pular: topo.pular })
      i += 1
    } else if (c === '}') {
      if (pilha.length > 1) pilha.pop()
      i += 1
    } else if (c === '\\') {
      const m = /^\\([a-z]+)(-?\d+)? ?|^\\'([0-9a-f]{2})|^\\(\*|[{}\\~_-])/i.exec(rtf.slice(i, i + 40))
      if (!m) {
        i += 1
        continue
      }
      i += m[0].length
      if (m[3]) {
        if (pularUnicode) pularUnicode -= 1
        else if (!topo.ignorar) saida += cp1252.decode(new Uint8Array([parseInt(m[3], 16)]))
      } else if (m[4] === '*') topo.ignorar = true
      else if (m[4]) {
        if (!topo.ignorar) saida += m[4] === '~' ? ' ' : m[4] === '_' ? '-' : m[4] === '-' ? '' : m[4]
      } else {
        const palavra = m[1]
        const n = m[2] != null ? Number(m[2]) : null
        if (ignorados.has(palavra)) topo.ignorar = true
        else if (palavra === 'uc') topo.pular = n
        else if (palavra === 'u') {
          if (!topo.ignorar) saida += String.fromCharCode(n < 0 ? n + 65536 : n)
          pularUnicode = topo.pular
        } else if (!topo.ignorar && (palavra === 'par' || palavra === 'line' || palavra === 'row')) saida += '\n'
        else if (!topo.ignorar && (palavra === 'tab' || palavra === 'cell')) saida += '\t'
      }
    } else {
      if (c !== '\r' && c !== '\n' && !topo.ignorar) {
        if (pularUnicode) pularUnicode -= 1
        else saida += c
      }
      i += 1
    }
  }
  return saida.replace(/\n{3,}/g, '\n\n').trim()
}

/** Texto de qualquer documento suportado. Devolve { texto, tipo }. */
export async function extrairTextoDocumento(arquivo, aoProgredir) {
  const tipoReal = (await detectarTipo(arquivo))?.ext
  const ext = extensaoDe(arquivo.name)
  if (tipoReal === 'pdf') {
    const { abrirLeitura, extrairTexto } = await import('./pdf')
    const doc = await abrirLeitura(arquivo)
    try {
      return { texto: (await extrairTexto(doc, aoProgredir)).join('\n\n'), tipo: 'pdf' }
    } finally {
      doc.destroy()
    }
  }
  if (tipoReal === 'docx' || (tipoReal === 'zip' && ext === 'docx')) {
    const zip = await abrirZip(arquivo)
    if (!zip['word/document.xml']) throw new ErroAmigavel('Este DOCX não tem o conteúdo esperado.')
    return { texto: textoDocx(xml(zip['word/document.xml'])), tipo: 'docx' }
  }
  if (tipoReal === 'odt' || (tipoReal === 'zip' && ext === 'odt')) {
    const zip = await abrirZip(arquivo)
    if (!zip['content.xml']) throw new ErroAmigavel('Este ODT não tem o conteúdo esperado.')
    return { texto: textoOdt(xml(zip['content.xml'])), tipo: 'odt' }
  }
  if (tipoReal === 'cfb' || ext === 'doc') throw new ErroAmigavel('Arquivos .doc (Word 97-2003) precisam ser convertidos antes. Salve como DOCX no Word ou use o conversor de documentos.')
  const conteudo = await lerTexto(arquivo)
  if (tipoReal === 'rtf' || conteudo.startsWith('{\\rtf')) return { texto: textoRtf(conteudo), tipo: 'rtf' }
  if (tipoReal === 'html' || /^(html?|xhtml)$/.test(ext)) {
    const d = new DOMParser().parseFromString(conteudo, 'text/html')
    d.querySelectorAll('script, style, noscript, template').forEach((n) => n.remove())
    return { texto: (d.body?.innerText ?? d.body?.textContent ?? '').trim(), tipo: 'html' }
  }
  return { texto: conteudo, tipo: ext || 'txt' }
}

/* ─── Metadados de DOCX e ODT ─────────────────────────────────────────────── */

const ROTULOS = {
  title: 'Título',
  subject: 'Assunto',
  creator: 'Autor',
  'initial-creator': 'Autor original',
  keywords: 'Palavras-chave',
  description: 'Descrição',
  lastModifiedBy: 'Modificado por',
  revision: 'Revisão',
  created: 'Criado em',
  'creation-date': 'Criado em',
  modified: 'Modificado em',
  date: 'Modificado em',
  'editing-cycles': 'Vezes editado',
  'editing-duration': 'Tempo de edição',
  generator: 'Programa',
  Application: 'Programa',
  Company: 'Empresa',
  Manager: 'Gerente',
  Pages: 'Páginas',
  Words: 'Palavras',
  Characters: 'Caracteres',
  TotalTime: 'Tempo de edição (min)',
  Template: 'Modelo',
}

const formatarValor = (v) => (/^\d{4}-\d{2}-\d{2}T/.test(v) ? new Date(v).toLocaleString('pt-BR') : v)

/** Metadados legíveis: [{ rotulo, valor }], e o tipo ('docx' | 'odt'). */
export async function lerMetadadosDocumento(arquivo) {
  const zip = await abrirZip(arquivo)
  const itens = []
  const add = (nome, valor) => {
    if (valor && String(valor).trim() && ROTULOS[nome]) itens.push({ rotulo: ROTULOS[nome], valor: formatarValor(String(valor).trim()) })
  }
  if (zip['docProps/core.xml'] || zip['word/document.xml']) {
    for (const parte of ['docProps/core.xml', 'docProps/app.xml']) {
      if (!zip[parte]) continue
      for (const n of xml(zip[parte]).documentElement.children) add(n.localName, n.textContent)
    }
    return { tipo: 'docx', itens, temPersonalizados: Boolean(zip['docProps/custom.xml']) }
  }
  if (zip['meta.xml']) {
    const meta = xml(zip['meta.xml']).getElementsByTagNameNS('urn:oasis:names:tc:opendocument:xmlns:office:1.0', 'meta')[0]
    for (const n of meta?.children ?? []) {
      if (n.localName === 'document-statistic') {
        add('Pages', n.getAttribute('meta:page-count'))
        add('Words', n.getAttribute('meta:word-count'))
        add('Characters', n.getAttribute('meta:character-count'))
      } else add(n.localName, n.textContent)
    }
    return { tipo: 'odt', itens, temPersonalizados: [...(meta?.children ?? [])].some((n) => n.localName === 'user-defined') }
  }
  throw new ErroAmigavel('Não é um documento DOCX ou ODT válido.')
}

const CORE_VAZIO = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"></cp:coreProperties>`

/**
 * Remove autor, empresa, datas, revisões, tempo de edição e propriedades
 * personalizadas — sem tocar no conteúdo. Para ODT, o "mimetype" continua
 * o primeiro arquivo e sem compressão, como a especificação exige.
 */
export async function removerMetadadosDocumento(arquivo) {
  const { zipSync, strToU8 } = await import('fflate')
  const zip = await abrirZip(arquivo)
  const ehOdt = Boolean(zip['meta.xml'] && zip.mimetype)
  if (ehOdt) {
    zip['meta.xml'] = strToU8(`<?xml version="1.0" encoding="UTF-8"?>
<office:document-meta xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:meta="urn:oasis:names:tc:opendocument:xmlns:meta:1.0" xmlns:dc="http://purl.org/dc/elements/1.1/" office:version="1.3"><office:meta/></office:document-meta>`)
    const { mimetype, ...resto } = zip
    return new Blob([zipSync({ mimetype: [mimetype, { level: 0 }], ...Object.fromEntries(Object.entries(resto).map(([k, v]) => [k, [v, { level: 6 }]])) })], { type: 'application/vnd.oasis.opendocument.text' })
  }
  if (!zip['word/document.xml']) throw new ErroAmigavel('Não é um documento DOCX ou ODT válido.')
  zip['docProps/core.xml'] = strToU8(CORE_VAZIO)
  if (zip['docProps/app.xml']) {
    const app = xml(zip['docProps/app.xml'])
    for (const n of [...app.documentElement.children]) if (['Company', 'Manager', 'TotalTime', 'Template', 'HyperlinkBase'].includes(n.localName)) n.remove()
    zip['docProps/app.xml'] = strToU8(new XMLSerializer().serializeToString(app))
  }
  if (zip['docProps/custom.xml']) {
    delete zip['docProps/custom.xml']
    // Tira a referência ao custom.xml para o Word não reclamar do arquivo.
    const tipos = new TextDecoder().decode(zip['[Content_Types].xml']).replace(/<Override[^>]*PartName="\/docProps\/custom\.xml"[^>]*\/>/, '')
    zip['[Content_Types].xml'] = strToU8(tipos)
    const rels = new TextDecoder().decode(zip['_rels/.rels']).replace(/<Relationship[^>]*Target="docProps\/custom\.xml"[^>]*\/>/, '')
    zip['_rels/.rels'] = strToU8(rels)
  }
  return new Blob([zipSync(zip, { level: 6 })], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' })
}

/* ─── Serviço LibreOffice ─────────────────────────────────────────────────── */

const ERROS_SERVIDOR = {
  grande: 'O arquivo passa de 4,5 MB, o limite da conversão no servidor.',
  limite: 'Muitas conversões seguidas. Espere alguns minutos e tente de novo.',
  'formato-entrada': 'Formato de entrada não suportado.',
  'conteudo-invalido': 'O conteúdo do arquivo não corresponde à extensão dele.',
  'tempo-esgotado': 'O documento demorou demais para converter (é muito grande ou complexo).',
  falha: 'O LibreOffice não conseguiu converter este documento. Ele pode estar corrompido ou protegido por senha.',
}

const MIMES = { pdf: 'application/pdf', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', odt: 'application/vnd.oasis.opendocument.text', rtf: 'application/rtf', txt: 'text/plain', html: 'text/html' }

/** Envia ao serviço LibreOffice e devolve o Blob convertido. O servidor apaga o arquivo ao terminar. */
export async function converterNoServidor(arquivo, para, sinal) {
  if (arquivo.size > LIMITE_SERVIDOR) throw new ErroAmigavel(ERROS_SERVIDOR.grande)
  let resposta
  try {
    resposta = await fetch(`/api/documentos/converter?para=${para}`, {
      method: 'POST',
      body: arquivo,
      headers: { 'X-Nome-Arquivo': encodeURIComponent(arquivo.name), 'Content-Type': 'application/octet-stream' },
      signal: sinal,
    })
  } catch (erro) {
    if (erro?.name === 'AbortError') throw erro
    throw new ErroAmigavel('Sem conexão com o servidor de conversão. Confira sua internet e tente de novo.')
  }
  if (!resposta.ok) {
    const corpo = await resposta.json().catch(() => ({}))
    throw new ErroAmigavel(ERROS_SERVIDOR[corpo.erro] ?? 'O serviço de conversão está indisponível agora. Tente de novo em instantes.')
  }
  return new Blob([await resposta.arrayBuffer()], { type: MIMES[para] })
}
