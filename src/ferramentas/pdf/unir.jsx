import { ModeloConversao } from '../../componentes/ferramenta/ModeloConversao'
import { Caixa } from '../../componentes/ui'
import { LIMITE_PDF, abrirEdicao, obterPdfLib, salvarPdf } from '../../motores/pdf'
import { cancelado } from '../../nucleo/tarefa'

function Configuracoes({ opcoes, mudar }) {
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-suave">Os PDFs são unidos na ordem da lista. Use as setas para mudar a ordem.</p>
      <Caixa rotulo="Marcadores com o nome de cada arquivo" dica="Cria um sumário no leitor de PDF, um item por arquivo." marcado={opcoes.marcadores} aoMudar={(v) => mudar('marcadores', v)} />
    </div>
  )
}

/** Cria um sumário (outline) simples: um item por arquivo, apontando para a 1ª página dele. */
async function criarMarcadores(doc, itens) {
  const { PDFName, PDFHexString, PDFNumber } = await obterPdfLib()
  const ctx = doc.context
  const raiz = ctx.nextRef()
  const refs = itens.map(() => ctx.nextRef())
  itens.forEach((item, i) => {
    const pagina = doc.getPage(item.primeira)
    const dict = ctx.obj({
      Title: PDFHexString.fromText(item.titulo), // UTF-16: acentos funcionam
      Parent: raiz,
      Dest: [pagina.ref, PDFName.of('XYZ'), null, null, null],
    })
    if (i > 0) dict.set(PDFName.of('Prev'), refs[i - 1])
    if (i < refs.length - 1) dict.set(PDFName.of('Next'), refs[i + 1])
    ctx.assign(refs[i], dict)
  })
  ctx.assign(raiz, ctx.obj({ Type: 'Outlines', First: refs[0], Last: refs[refs.length - 1], Count: PDFNumber.of(refs.length) }))
  doc.catalog.set(PDFName.of('Outlines'), raiz)
  doc.catalog.set(PDFName.of('PageMode'), PDFName.of('UseOutlines'))
}

export default function Unir() {
  return (
    <ModeloConversao
      extensoes={['pdf']}
      descricaoFormatos="PDF"
      limiteBytes={LIMITE_PDF}
      ordenavel
      minimoArquivos={2}
      maximo={100}
      opcoesIniciais={{ marcadores: false }}
      Configuracoes={Configuracoes}
      rotuloAcao="Unir PDFs"
      processar={async (itens, o, { progresso, sinal }) => {
        const { PDFDocument } = await obterPdfLib()
        const final = await PDFDocument.create()
        const marcos = []
        for (let i = 0; i < itens.length; i += 1) {
          cancelado(sinal)
          const doc = await abrirEdicao(itens[i].arquivo)
          marcos.push({ titulo: itens[i].arquivo.name.replace(/\.pdf$/i, ''), primeira: final.getPageCount() })
          const paginas = await final.copyPages(doc, doc.getPageIndices())
          paginas.forEach((p) => final.addPage(p))
          progresso((i + 1) / (itens.length + 1), `Unindo (${i + 1} de ${itens.length})`)
        }
        if (o.marcadores) await criarMarcadores(final, marcos)
        progresso(null, 'Gerando o PDF')
        const blob = await salvarPdf(final)
        return [{ nome: 'unido.pdf', blob, detalhe: `${final.getPageCount()} páginas` }]
      }}
    />
  )
}
