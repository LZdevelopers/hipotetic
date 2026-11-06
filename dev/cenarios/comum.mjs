// Ajudantes dos cenários de teste: arquivos de exemplo e leitura de resultados.

import assert from 'node:assert/strict'
import { PDFDocument, StandardFonts } from 'pdf-lib'

// ─── PDFs de teste (gerados aqui no Node) e leitura dos resultados ──────────
/** PDF com N páginas A4 e o texto "<prefixo> <n>" em cada uma. */
export async function pdfTeste(n = 3, { prefixo = 'Pagina', titulo, autor, textos } = {}) {
  const doc = await PDFDocument.create()
  const fonte = await doc.embedFont(StandardFonts.Helvetica)
  for (let i = 1; i <= n; i += 1) {
    const p = doc.addPage([595.28, 841.89])
    p.drawText(textos?.[i - 1] ?? `${prefixo} ${i}`, { x: 72, y: 760, size: 28, font: fonte })
    p.drawText('Linha de teste com acentuacao simples.', { x: 72, y: 720, size: 12, font: fonte })
  }
  if (titulo) doc.setTitle(titulo)
  if (autor) doc.setAuthor(autor)
  return Buffer.from(await doc.save()).toString('base64')
}
/** Código (para a página) que cria o File a partir do base64. */
export const arquivoPdf = (b64, nome = 'doc.pdf') => `new File([Uint8Array.from(atob('${b64}'), (c) => c.charCodeAt(0))], '${nome}', { type: 'application/pdf' })`

export async function lerPdf(bytes) {
  const dados = new Uint8Array(bytes)
  const doc = await PDFDocument.load(dados, { ignoreEncryption: true })
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
  const leitura = await pdfjs.getDocument({ data: dados.slice(), isEvalSupported: false, verbosity: 0 }).promise
  const textos = []
  for (let i = 1; i <= leitura.numPages; i += 1) {
    const c = await (await leitura.getPage(i)).getTextContent()
    textos.push(c.items.map((it) => it.str).join(' '))
  }
  return { paginas: doc.getPageCount(), rotacoes: doc.getPages().map((p) => p.getRotation().angle), textos, doc, cifrado: Buffer.from(dados).includes('/Encrypt') }
}

export const SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="50" viewBox="0 0 100 50"><rect width="100" height="50" fill="#2563eb"/><circle cx="25" cy="25" r="20" fill="#fff"/></svg>`

/** Envia arquivos gerados na página e espera a lista aparecer. */
export async function enviar(t, codigoArquivos) {
  await t.js(`__t.enviar(${codigoArquivos})`)
  // A lista mostra "N arquivo(s) · tamanho" depois da validação do tipo real.
  await t.aguardar(`/\\d+ arquivos? ·/.test(document.querySelector('main').textContent)`)
}

export const png = (w = 640, h = 480, alfa = true, nome = 'teste.png') => `[__t.arquivo(await __t.imagem(${w}, ${h}, 'image/png', { alfa: ${alfa} }), '${nome}')]`
export const jpg = (w = 640, h = 480, nome = 'foto.jpg') => `[__t.arquivo(await __t.imagem(${w}, ${h}, 'image/jpeg', { qualidade: 0.95 }), '${nome}')]`
