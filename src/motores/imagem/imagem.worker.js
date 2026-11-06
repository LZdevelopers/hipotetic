// Worker de imagem: decodifica e executa a receita fora do thread principal,
// para a página não travar com fotos grandes ou lotes.
import { executarReceita } from './nucleo'

self.onmessage = async ({ data }) => {
  const { id, fonte, receita } = data
  try {
    // `fonte` é um Blob (decodificado aqui, já com a orientação do EXIF) ou
    // um ImageBitmap pronto (SVG, que só o thread principal sabe rasterizar).
    const bitmap = fonte instanceof ImageBitmap ? fonte : await createImageBitmap(fonte, { imageOrientation: 'from-image' })
    const original = { largura: bitmap.width, altura: bitmap.height }
    const resultado = await executarReceita(bitmap, receita)
    bitmap.close?.()
    self.postMessage({ id, ok: true, ...resultado, original })
  } catch (erro) {
    self.postMessage({ id, ok: false, erro: String(erro?.message ?? erro) })
  }
}
