/**
 * OCR no navegador com tesseract.js. Worker e núcleo (wasm) servidos pelo
 * próprio site (/tesseract/); os modelos de idioma vêm do jsDelivr na
 * primeira vez e ficam guardados no navegador (IndexedDB).
 */

export const IDIOMAS_OCR = [
  { valor: 'por', rotulo: 'Português' },
  { valor: 'por+eng', rotulo: 'Português + Inglês' },
  { valor: 'eng', rotulo: 'Inglês' },
  { valor: 'spa', rotulo: 'Espanhol' },
  { valor: 'fra', rotulo: 'Francês' },
  { valor: 'deu', rotulo: 'Alemão' },
  { valor: 'ita', rotulo: 'Italiano' },
]

/** Cria um worker de OCR. `aoProgredir(valor, rotulo)` recebe o progresso do tesseract. */
export async function criarOcr(idioma, aoProgredir) {
  const { createWorker } = await import('tesseract.js')
  let fase = ''
  return createWorker(idioma, 1, {
    workerPath: '/tesseract/worker.min.js',
    corePath: '/tesseract/',
    workerBlobURL: false,
    logger: (m) => {
      if (m.status === 'recognizing text') {
        fase = 'reconhecendo'
        aoProgredir?.(m.progress, null)
      } else if (/loading|initializ/i.test(m.status) && fase !== 'reconhecendo') {
        aoProgredir?.(null, 'Carregando o modelo do idioma (só na primeira vez)')
      }
    },
  })
}

/** Reconhece uma imagem (canvas/Blob): { texto, palavras: [{ texto, x0, y0, x1, y1, confianca }] }. */
export async function reconhecer(ocr, imagem) {
  const { data } = await ocr.recognize(imagem, {}, { text: true, blocks: true })
  const palavras = []
  for (const bloco of data.blocks ?? []) {
    for (const paragrafo of bloco.paragraphs ?? []) {
      for (const linha of paragrafo.lines ?? []) {
        for (const p of linha.words ?? []) {
          if (p.text?.trim()) palavras.push({ texto: p.text, ...p.bbox, confianca: p.confidence })
        }
      }
    }
  }
  return { texto: data.text ?? '', palavras, confianca: data.confidence }
}
