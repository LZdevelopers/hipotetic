/**
 * Imagens ↔ PDF, no navegador.
 *  - imagensParaPdf: uma imagem por página (JPG/PNG entram direto; os demais
 *    formatos passam pelo canvas), respeitando a orientação EXIF.
 *  - pdfParaImagens: cada página vira JPG, PNG ou WebP na resolução pedida.
 */
import { detectarTipo, semExtensao } from '../../nucleo/arquivos'
import { ErroAmigavel, cancelado } from '../../nucleo/tarefa'
import { abrirLeitura, desenharPagina, lerIntervalos, obterPdfLib, salvarPdf } from './index'

const PAPEIS = { a4: [595.28, 841.89], carta: [612, 792], a5: [419.53, 595.28] }

async function pelaTela(arquivo, comAlfa) {
  const bmp = await createImageBitmap(arquivo, { imageOrientation: 'from-image' })
  const c = new OffscreenCanvas(bmp.width, bmp.height)
  c.getContext('2d').drawImage(bmp, 0, 0)
  bmp.close()
  const blob = await c.convertToBlob(comAlfa ? { type: 'image/png' } : { type: 'image/jpeg', quality: 0.92 })
  return new Uint8Array(await blob.arrayBuffer())
}

/** Imagem → { tipo: 'jpg' | 'png', bytes } que o pdf-lib aceita, já na orientação certa. */
async function paraEmbutir(arquivo) {
  const tipo = (await detectarTipo(arquivo))?.ext
  if (tipo === 'png') return { tipo, bytes: new Uint8Array(await arquivo.arrayBuffer()) }
  if (tipo === 'jpg') {
    // JPEG com orientação EXIF ≠ 1 sairia deitado no PDF: normaliza pelo canvas.
    const { default: exifr } = await import('exifr')
    const orientacao = (await exifr.orientation(arquivo).catch(() => 1)) || 1
    return { tipo, bytes: orientacao === 1 ? new Uint8Array(await arquivo.arrayBuffer()) : await pelaTela(arquivo, false) }
  }
  const comAlfa = tipo === 'gif' || tipo === 'webp' || tipo === 'avif' || tipo === 'svg' || tipo === 'ico'
  return { tipo: comAlfa ? 'png' : 'jpg', bytes: await pelaTela(arquivo, comAlfa) }
}

/**
 * Junta imagens num PDF, uma por página. papel: 'imagem' (página do tamanho
 * da imagem), 'a4', 'carta' ou 'a5'; orientacao: 'auto' | 'retrato' | 'paisagem';
 * margem em pontos. Devolve Blob.
 */
export async function imagensParaPdf(arquivos, { papel = 'a4', orientacao = 'auto', margem = 20 } = {}, { progresso, sinal } = {}) {
  const { PDFDocument } = await obterPdfLib()
  const doc = await PDFDocument.create()
  for (let i = 0; i < arquivos.length; i += 1) {
    cancelado(sinal)
    const { tipo, bytes } = await paraEmbutir(arquivos[i])
    const img = tipo === 'jpg' ? await doc.embedJpg(bytes) : await doc.embedPng(bytes)
    if (papel === 'imagem') {
      // 1 px = 0,75 pt (96 dpi): a página fica do tamanho "natural" da imagem.
      const w = img.width * 0.75
      const h = img.height * 0.75
      doc.addPage([w, h]).drawImage(img, { x: 0, y: 0, width: w, height: h })
    } else {
      let [pw, ph] = PAPEIS[papel] ?? PAPEIS.a4
      const deitada = orientacao === 'paisagem' || (orientacao === 'auto' && img.width > img.height)
      if (deitada) [pw, ph] = [ph, pw]
      const m = Number(margem) || 0
      const escala = Math.min((pw - 2 * m) / img.width, (ph - 2 * m) / img.height)
      const w = img.width * escala
      const h = img.height * escala
      doc.addPage([pw, ph]).drawImage(img, { x: (pw - w) / 2, y: (ph - h) / 2, width: w, height: h })
    }
    progresso?.((i + 1) / arquivos.length, arquivos.length > 1 ? `Adicionando (${i + 1} de ${arquivos.length})` : 'Criando o PDF')
  }
  return { blob: await salvarPdf(doc), paginas: doc.getPageCount() }
}

const MIME = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp' }

/**
 * Páginas do PDF como imagens. `paginas`: texto como "1-3, 5" (vazio = todas).
 * Devolve [{ nome, blob, detalhe }].
 */
export async function pdfParaImagens(arquivo, { formato = 'jpg', dpi = 150, paginas = '' } = {}, { progresso, sinal } = {}) {
  const doc = await abrirLeitura(arquivo)
  try {
    const lista = String(paginas).trim() ? lerIntervalos(paginas, doc.numPages) : Array.from({ length: doc.numPages }, (_, i) => i + 1)
    if (lista.length > 500) throw new ErroAmigavel('Muitas páginas de uma vez (máximo de 500). Escolha um intervalo.')
    const base = semExtensao(arquivo.name)
    const digitos = String(doc.numPages).length
    const saida = []
    for (let i = 0; i < lista.length; i += 1) {
      cancelado(sinal)
      const n = lista[i]
      const canvas = await desenharPagina(doc, n, dpi / 72, { sinal })
      const blob = await new Promise((ok) => canvas.toBlob(ok, MIME[formato], 0.9))
      saida.push({ nome: `${base}-pagina-${String(n).padStart(digitos, '0')}.${formato}`, blob, detalhe: `${canvas.width} × ${canvas.height} px` })
      canvas.width = 0 // libera a memória do canvas
      progresso?.((i + 1) / lista.length, `Convertendo página ${i + 1} de ${lista.length}`)
    }
    return saida
  } finally {
    doc.destroy()
  }
}
