import { ModeloConversao } from '../../componentes/ferramenta/ModeloConversao'
import { Segmentado } from '../../componentes/ui'
import { LIMITE_PDF, abrirEdicao, executarQpdf, obterPdfLib } from '../../motores/pdf'
import { trocarExtensao } from '../../nucleo/arquivos'
import { cancelado } from '../../nucleo/tarefa'

const NIVEIS = {
  leve: { lado: 2400, qualidade: 0.82 },
  recomendado: { lado: 1600, qualidade: 0.7 },
  forte: { lado: 1100, qualidade: 0.55 },
}

function Configuracoes({ opcoes, mudar }) {
  return (
    <Segmentado
      rotulo="Compressão"
      valor={opcoes.nivel}
      aoMudar={(v) => mudar('nivel', v)}
      opcoes={[
        { valor: 'sem-perdas', rotulo: 'Sem perdas' },
        { valor: 'leve', rotulo: 'Leve' },
        { valor: 'recomendado', rotulo: 'Recomendada' },
        { valor: 'forte', rotulo: 'Forte' },
      ]}
      dica={
        {
          'sem-perdas': 'Só reorganiza e recomprime a estrutura do arquivo. Nada muda visualmente.',
          leve: 'Fotos recomprimidas com qualidade alta. Diferença quase imperceptível.',
          recomendado: 'O melhor equilíbrio para enviar por e-mail e mensagem.',
          forte: 'Arquivo bem menor; fotos podem perder nitidez ao ampliar.',
        }[opcoes.nivel]
      }
    />
  )
}

const nomeDe = (v) => v?.asString?.() ?? v?.toString?.() ?? ''

/**
 * Recomprime as fotos (JPEG) embutidas no PDF, reduzindo as muito grandes.
 * Texto, vetores e fontes ficam intactos — o texto continua selecionável.
 * Imagens CMYK, com /Decode ou em outros formatos são mantidas como estão.
 */
async function recomprimirImagens(doc, { lado, qualidade }, progresso, sinal) {
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

export default function Comprimir() {
  return (
    <ModeloConversao
      extensoes={['pdf']}
      descricaoFormatos="PDF"
      limiteBytes={LIMITE_PDF}
      multiplos={false}
      opcoesIniciais={{ nivel: 'recomendado' }}
      Configuracoes={Configuracoes}
      rotuloAcao="Comprimir PDF"
      processar={async ([item], o, { progresso, sinal }) => {
        let bytes = new Uint8Array(await item.arquivo.arrayBuffer())
        let imagens = 0
        if (o.nivel !== 'sem-perdas') {
          const doc = await abrirEdicao(bytes)
          imagens = await recomprimirImagens(doc, NIVEIS[o.nivel], progresso, sinal)
          if (imagens) bytes = await doc.save({ useObjectStreams: true })
        }
        progresso(0.9, 'Otimizando a estrutura')
        const r = await executarQpdf(bytes, ['--object-streams=generate', '--compress-streams=y', '--recompress-flate', '--compression-level=9'])
        if (r.saida && r.codigo !== 2 && r.saida.length < bytes.length) bytes = r.saida
        if (bytes.length >= item.arquivo.size) {
          return [{ nome: item.arquivo.name, blob: item.arquivo, original: item.arquivo.size, detalhe: 'já estava otimizado: mantido o original' }]
        }
        return [
          {
            nome: trocarExtensao(item.arquivo.name, 'pdf', '-comprimido'),
            blob: new Blob([bytes], { type: 'application/pdf' }),
            original: item.arquivo.size,
            detalhe: imagens ? `${imagens} ${imagens === 1 ? 'imagem recomprimida' : 'imagens recomprimidas'}` : 'estrutura otimizada',
          },
        ]
      }}
    />
  )
}
