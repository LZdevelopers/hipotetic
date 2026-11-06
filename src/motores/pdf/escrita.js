/**
 * Escrever sobre páginas de PDF existentes (números, marca d'água, textos do
 * editor) respeitando a rotação (/Rotate) e a área visível (CropBox) de cada
 * página: o que se posiciona "no canto inferior direito" aparece lá, em pé,
 * mesmo numa página girada.
 */
import { obterPdfLib } from './index'

/** Tamanho da página como ela APARECE (já girada). */
export function tamanhoVisual(pagina) {
  const caixa = pagina.getCropBox()
  const r = ((pagina.getRotation().angle % 360) + 360) % 360
  return r === 90 || r === 270 ? { largura: caixa.height, altura: caixa.width, r, caixa } : { largura: caixa.width, altura: caixa.height, r, caixa }
}

/**
 * Converte um ponto visual (origem no canto inferior esquerdo da página como
 * vista) em coordenadas do PDF + o giro para o conteúdo ficar em pé.
 */
export function pontoNaPagina(pagina, vx, vy) {
  const { r, caixa } = tamanhoVisual(pagina)
  const W = caixa.width
  const H = caixa.height
  let x
  let y
  if (r === 90) [x, y] = [W - vy, vx]
  else if (r === 180) [x, y] = [W - vx, H - vy]
  else if (r === 270) [x, y] = [vy, H - vx]
  else [x, y] = [vx, vy]
  return { x: x + caixa.x, y: y + caixa.y, giro: r }
}

/** Fonte padrão (Helvetica) do documento, criada uma vez. */
export async function fontePadrao(doc, negrito = false) {
  const { StandardFonts } = await obterPdfLib()
  return doc.embedFont(negrito ? StandardFonts.HelveticaBold : StandardFonts.Helvetica)
}

/**
 * As fontes padrão do PDF só têm o alfabeto latino (WinAnsi): acentos do
 * português funcionam; emojis e outros alfabetos viram "?".
 */
export function textoSeguro(fonte, texto) {
  let saida = ''
  for (const c of String(texto)) {
    try {
      fonte.encodeText(c)
      saida += c
    } catch {
      saida += c === '\t' ? ' ' : '?'
    }
  }
  return saida
}

/** "#1d5bd8" → rgb() do pdf-lib. */
export async function cor(hex) {
  const { rgb } = await obterPdfLib()
  const n = parseInt(String(hex).replace('#', ''), 16)
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255)
}
