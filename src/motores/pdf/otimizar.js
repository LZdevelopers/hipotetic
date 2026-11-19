/**
 * Reduzir o tamanho e proteger com senha — usados pelas ferramentas rápidas
 * (Comprimir, Proteger) e pelo Editor de PDF na hora de baixar.
 */
import { cancelado } from '../../nucleo/tarefa'
import { abrirEdicao, executarQpdf, obterPdfLib } from './index'

export const DICAS_COMPRESSAO = {
  'sem-perdas': 'Só reorganiza e recomprime a estrutura do arquivo. Nada muda visualmente.',
  leve: 'Fotos recomprimidas com qualidade alta. Diferença quase imperceptível.',
  recomendado: 'O melhor equilíbrio para enviar por e-mail e mensagem.',
  forte: 'Arquivo bem menor; fotos podem perder nitidez ao ampliar.',
}

export const NIVEIS_COMPRESSAO = {
  leve: { lado: 2400, qualidade: 0.82 },
  recomendado: { lado: 1600, qualidade: 0.7 },
  forte: { lado: 1100, qualidade: 0.55 },
}

const nomeDe = (v) => v?.asString?.() ?? v?.toString?.() ?? ''

/**
 * Recomprime as fotos (JPEG) embutidas no PDF, reduzindo as muito grandes.
 * Texto, vetores e fontes ficam intactos — o texto continua selecionável.
 * Imagens CMYK, com /Decode ou em outros formatos são mantidas como estão.
 */
export async function recomprimirImagens(doc, { lado, qualidade }, progresso = () => {}, sinal) {
  const { PDFName, PDFRawStream, PDFNumber, PDFArray } = await obterPdfLib()
  const alvos = []
  for (const [ref, obj] of doc.context.enumerateIndirectObjects()) {
    if (!(obj instanceof PDFRawStream)) continue
    const d = obj.dict
    if (nomeDe(d.get(PDFName.of('Subtype'))) !== '/Image') continue
    let filtro = d.get(PDFName.of('Filter'))
    if (filtro instanceof PDFArray) filtro = filtro.size() === 1 ? filtro.get(0) : null
    if (nomeDe(filtro) !== '/DCTDecode') continue
    if (d.get(PDFName.of('Decode')) || d.get(PDFName.of('ImageMask'))) continue
    const cs = d.lookup(PDFName.of('ColorSpace'))
    const nomeCs = nomeDe(cs)
    let componentes = nomeCs === '/DeviceRGB' ? 3 : nomeCs === '/DeviceGray' ? 1 : null
    if (componentes == null && cs instanceof PDFArray && nomeDe(cs.get(0)) === '/ICCBased') {
      const n = cs.lookup(1)?.dict?.get(PDFName.of('N'))
      componentes = n?.asNumber?.() === 3 || n?.asNumber?.() === 1 ? n.asNumber() : null
    }
    if (componentes == null) continue
    alvos.push({ ref, obj })
  }

  let trocadas = 0
  for (let i = 0; i < alvos.length; i += 1) {
    cancelado(sinal)
    const { ref, obj } = alvos[i]
    try {
      const original = obj.getContents()
      const bmp = await createImageBitmap(new Blob([original], { type: 'image/jpeg' }))
      const escala = Math.min(1, lado / Math.max(bmp.width, bmp.height))
      const w = Math.max(1, Math.round(bmp.width * escala))
      const h = Math.max(1, Math.round(bmp.height * escala))
      const c = new OffscreenCanvas(w, h)
      const ctx = c.getContext('2d')
      ctx.imageSmoothingQuality = 'high'
      ctx.drawImage(bmp, 0, 0, w, h)
      bmp.close()
      const novo = new Uint8Array(await (await c.convertToBlob({ type: 'image/jpeg', quality: qualidade })).arrayBuffer())
      if (novo.length >= original.length * 0.95) continue
      const dict = obj.dict.clone(doc.context)
      dict.set(PDFName.of('Width'), PDFNumber.of(w))
      dict.set(PDFName.of('Height'), PDFNumber.of(h))
      dict.set(PDFName.of('ColorSpace'), PDFName.of('DeviceRGB'))
      dict.set(PDFName.of('BitsPerComponent'), PDFNumber.of(8))
      dict.set(PDFName.of('Filter'), PDFName.of('DCTDecode'))
      dict.delete(PDFName.of('DecodeParms'))
      dict.set(PDFName.of('Length'), PDFNumber.of(novo.length))
      doc.context.assign(ref, PDFRawStream.of(dict, novo))
      trocadas += 1
    } catch {
      /* imagem que o navegador não decodifica: fica como está */
    }
    progresso(((i + 1) / alvos.length) * 0.8, `Recomprimindo imagens (${i + 1} de ${alvos.length})`)
  }
  return trocadas
}

/**
 * Reduz o tamanho: recomprime as fotos (fora do "sem-perdas") e otimiza a
 * estrutura com o qpdf. Devolve { bytes, imagens } — os bytes originais se
 * nada ficou menor.
 */
export async function otimizarPdf(entrada, nivel = 'recomendado', { progresso = () => {}, sinal } = {}) {
  let bytes = entrada instanceof Uint8Array ? entrada : new Uint8Array(await entrada.arrayBuffer())
  const tamanhoOriginal = bytes.length
  let imagens = 0
  if (nivel !== 'sem-perdas' && NIVEIS_COMPRESSAO[nivel]) {
    const doc = await abrirEdicao(bytes)
    imagens = await recomprimirImagens(doc, NIVEIS_COMPRESSAO[nivel], progresso, sinal)
    if (imagens) bytes = await doc.save({ useObjectStreams: true })
  }
  progresso(0.9, 'Otimizando a estrutura')
  const r = await executarQpdf(bytes, ['--object-streams=generate', '--compress-streams=y', '--recompress-flate', '--compression-level=9'])
  if (r.saida && r.codigo !== 2 && r.saida.length < bytes.length) bytes = r.saida
  return { bytes, imagens, menor: bytes.length < tamanhoOriginal }
}

/** Senha de dono aleatória: quem tem só a senha de abrir não muda as permissões. */
export function senhaAleatoria() {
  const b = crypto.getRandomValues(new Uint8Array(18))
  return btoa(String.fromCharCode(...b)).replace(/[^a-z0-9]/gi, '')
}

/** Criptografa (AES-256) com senha para abrir. Devolve os bytes, ou null se o qpdf falhar. */
export async function protegerPdf(entrada, senha, { imprimir = true, copiar = false, modificar = false } = {}) {
  const r = await executarQpdf(entrada, [
    '--encrypt',
    senha,
    senhaAleatoria(),
    '256',
    `--print=${imprimir ? 'full' : 'none'}`,
    `--extract=${copiar ? 'y' : 'n'}`,
    `--modify=${modificar ? 'all' : 'none'}`,
    '--',
  ])
  return r.codigo === 2 || !r.saida ? { bytes: null, texto: r.texto } : { bytes: r.saida, texto: r.texto }
}
