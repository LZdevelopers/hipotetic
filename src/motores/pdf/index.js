/**
 * Motor de PDF no navegador:
 *   - pdf-lib  → criar, juntar, reorganizar, escrever (texto, imagens, números);
 *   - pdf.js   → ler: desenhar páginas, extrair texto, metadados;
 *   - qpdf     → senha (AES-256), descriptografar, otimizar estrutura.
 * Tudo carregado sob demanda (import dinâmico).
 */
import { ErroAmigavel } from '../../nucleo/tarefa'

export const LIMITE_PDF = 300 * 1024 * 1024

let pdfjsCarregando = null

/** pdf.js com o worker e os arquivos de apoio servidos pelo próprio site. */
export function obterPdfjs() {
  pdfjsCarregando ??= (async () => {
    const [pdfjs, { default: workerUrl }] = await Promise.all([import('pdfjs-dist'), import('pdfjs-dist/build/pdf.worker.min.mjs?url')])
    pdfjs.GlobalWorkerOptions.workerSrc = workerUrl
    return pdfjs
  })()
  return pdfjsCarregando
}

/** Abre um PDF com o pdf.js (para ler/desenhar). Lança ErroAmigavel em PDF protegido/corrompido. */
export async function abrirLeitura(fonte, { senha } = {}) {
  const pdfjs = await obterPdfjs()
  const dados = fonte instanceof Uint8Array ? fonte.slice() : new Uint8Array(await fonte.arrayBuffer())
  const tarefa = pdfjs.getDocument({
    data: dados,
    password: senha,
    cMapUrl: '/pdfjs/cmaps/',
    cMapPacked: true,
    standardFontDataUrl: '/pdfjs/standard_fonts/',
    wasmUrl: '/pdfjs/wasm/',
    isEvalSupported: false,
  })
  try {
    const doc = await tarefa.promise
    // pdf.js 6 libera o documento pela tarefa de carregamento.
    doc.destroy ??= () => tarefa.destroy()
    return doc
  } catch (erro) {
    if (erro?.name === 'PasswordException') {
      throw new ErroAmigavel(senha ? 'Senha incorreta.' : 'Este PDF é protegido por senha. Use “Desbloquear PDF” com a senha antes.', 'senha')
    }
    throw new ErroAmigavel('Não foi possível abrir este PDF. Ele pode estar corrompido ou não ser um PDF de verdade.')
  }
}

/** Desenha uma página num canvas. `escala` 1 = 72 dpi. */
export async function desenharPagina(doc, numero, escala = 1, { canvas, fundoBranco = true, sinal } = {}) {
  const pagina = await doc.getPage(numero)
  const viewport = pagina.getViewport({ scale: escala })
  const c = canvas ?? document.createElement('canvas')
  c.width = Math.max(1, Math.floor(viewport.width))
  c.height = Math.max(1, Math.floor(viewport.height))
  const ctx = c.getContext('2d', { alpha: !fundoBranco })
  if (fundoBranco) {
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, c.width, c.height)
  }
  const render = pagina.render({ canvasContext: ctx, canvas: c, viewport })
  sinal?.addEventListener('abort', () => render.cancel(), { once: true })
  await render.promise
  pagina.cleanup()
  return c
}

/** Miniatura (dataURL JPEG) de uma página, com largura alvo em px. */
export async function miniaturaPagina(doc, numero, largura = 160) {
  const pagina = await doc.getPage(numero)
  const v = pagina.getViewport({ scale: 1 })
  const c = await desenharPagina(doc, numero, (largura * (devicePixelRatio || 1)) / v.width)
  return c.toDataURL('image/jpeg', 0.75)
}

/** Texto de cada página, com quebras de linha onde o PDF muda de linha. */
export async function extrairTexto(doc, aoProgredir, sinal) {
  const paginas = []
  for (let n = 1; n <= doc.numPages; n += 1) {
    if (sinal?.aborted) throw new DOMException('Cancelado', 'AbortError')
    const pagina = await doc.getPage(n)
    const conteudo = await pagina.getTextContent()
    let texto = ''
    let ultimoY = null
    for (const item of conteudo.items) {
      if (!('str' in item)) continue
      const y = item.transform[5]
      // Mudou de linha sem o PDF marcar fim de linha: quebra aqui.
      if (ultimoY != null && !texto.endsWith('\n') && Math.abs(y - ultimoY) > Math.max(2, item.height * 0.5)) texto += '\n'
      texto += item.str
      if (item.hasEOL) texto += '\n'
      ultimoY = y
    }
    paginas.push(texto.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim())
    pagina.cleanup()
    aoProgredir?.(n / doc.numPages)
  }
  return paginas
}

/* ─── pdf-lib ─────────────────────────────────────────────────────────────── */

export async function obterPdfLib() {
  return import('pdf-lib')
}

/** Abre para edição com pdf-lib. PDF protegido → mensagem clara. */
export async function abrirEdicao(fonte) {
  const { PDFDocument } = await obterPdfLib()
  const bytes = fonte instanceof Uint8Array ? fonte : new Uint8Array(await fonte.arrayBuffer())
  let doc
  try {
    doc = await PDFDocument.load(bytes, { updateMetadata: false })
  } catch (erro) {
    if (/encrypted/i.test(String(erro?.message))) {
      throw new ErroAmigavel('Este PDF é protegido por senha. Use “Desbloquear PDF” com a senha antes.', 'senha')
    }
    throw new ErroAmigavel('Não foi possível abrir este PDF. Ele pode estar corrompido.')
  }
  return doc
}

export async function salvarPdf(doc) {
  const bytes = await doc.save({ useObjectStreams: true })
  return new Blob([bytes], { type: 'application/pdf' })
}

/**
 * "1-3, 5, 8-" → [1,2,3,5,8,…,total] (base 1, sem repetição, na ordem dada).
 * Lança ErroAmigavel com o trecho inválido.
 */
export function lerIntervalos(texto, total) {
  const paginas = []
  const partes = String(texto)
    .split(/[,;]+/)
    .map((p) => p.trim())
    .filter(Boolean)
  if (!partes.length) throw new ErroAmigavel('Informe as páginas, por exemplo: 1-3, 5, 8-10.')
  for (const parte of partes) {
    const m = /^(\d*)\s*(?:-|–|a|até)\s*(\d*)$/i.exec(parte) ?? (/^\d+$/.test(parte) ? [parte, parte, parte] : null)
    if (!m) throw new ErroAmigavel(`Não entendi “${parte}”. Use números e intervalos, como 1-3, 5.`)
    const inicio = m[1] === '' ? 1 : Number(m[1])
    const fim = m[2] === '' ? total : Number(m[2])
    if (inicio < 1 || fim > total || inicio > fim) throw new ErroAmigavel(`O intervalo “${parte}” não existe: o PDF tem ${total} ${total === 1 ? 'página' : 'páginas'}.`)
    for (let p = inicio; p <= fim; p += 1) paginas.push(p)
  }
  return paginas
}

/** Agrupa intervalos separados por vírgula: "1-3, 4-8" → [[1,2,3],[4..8]]. */
export function lerGrupos(texto, total) {
  return String(texto)
    .split(/[,;]+/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => lerIntervalos(p, total))
}

/* ─── qpdf ────────────────────────────────────────────────────────────────── */

/**
 * Executa o qpdf (WebAssembly) sobre um arquivo. Um módulo novo por chamada:
 * o qpdf encerra o "processo" ao terminar. O .wasm fica em cache no navegador.
 * Devolve { codigo, saida: Uint8Array | null, texto }.
 */
export async function executarQpdf(entrada, args, { comSaida = true } = {}) {
  const [{ default: criar }, { default: wasmUrl }] = await Promise.all([
    import('@neslinesli93/qpdf-wasm'),
    import('@neslinesli93/qpdf-wasm/dist/qpdf.wasm?url'),
  ])
  const linhas = []
  const bytes = entrada instanceof Uint8Array ? entrada : new Uint8Array(await entrada.arrayBuffer())
  // Esta compilação do qpdf ignora `print`/`printErr` e escreve com
  // console.log/console.error, que ele "amarra" (bind) ao ser criado. Então
  // trocamos o console só durante a criação e a execução, para ler a saída.
  const originais = { log: console.log, error: console.error }
  console.log = (...partes) => linhas.push(partes.join(' '))
  console.error = (...partes) => linhas.push(partes.join(' '))
  let qpdf
  let codigo
  try {
    qpdf = await criar({ locateFile: () => wasmUrl, noInitialRun: true })
    qpdf.FS.writeFile('/entrada.pdf', bytes)
    try {
      codigo = qpdf.callMain(['/entrada.pdf', ...args, ...(comSaida ? ['/saida.pdf'] : [])])
    } catch (erro) {
      codigo = typeof erro?.status === 'number' ? erro.status : 2
    }
  } finally {
    console.log = originais.log
    console.error = originais.error
  }
  let saida = null
  if (comSaida) {
    try {
      saida = qpdf.FS.readFile('/saida.pdf')
    } catch {
      saida = null
    }
  }
  // qpdf: 0 = ok, 3 = ok com avisos, 2 = erro.
  return { codigo: codigo ?? 0, saida, texto: linhas.join('\n') }
}

/** Situação de criptografia: { protegido, precisaSenhaParaAbrir }. */
export async function infoCriptografia(arquivo, senha = '') {
  const r = await executarQpdf(arquivo, [...(senha ? [`--password=${senha}`] : []), '--show-encryption'], { comSaida: false })
  const texto = r.texto
  return {
    protegido: !/File is not encrypted/i.test(texto),
    senhaIncorreta: /invalid password/i.test(texto),
    ehSenhaDoDono: /Supplied password is owner password/i.test(texto),
    ehSenhaDeAbrir: /Supplied password is user password/i.test(texto),
    texto,
  }
}
