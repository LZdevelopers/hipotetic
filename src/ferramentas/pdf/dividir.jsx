import { ModeloConversao } from '../../componentes/ferramenta/ModeloConversao'
import { Entrada, Segmentado } from '../../componentes/ui'
import { LIMITE_PDF, abrirEdicao, lerGrupos, lerIntervalos, obterPdfLib, salvarPdf } from '../../motores/pdf'
import { semExtensao } from '../../nucleo/arquivos'
import { cancelado } from '../../nucleo/tarefa'

function Configuracoes({ opcoes, mudar }) {
  return (
    <div className="flex flex-col gap-5">
      <Segmentado
        rotulo="Como dividir"
        valor={opcoes.modo}
        aoMudar={(v) => mudar('modo', v)}
        opcoes={[
          { valor: 'cada', rotulo: 'Cada página' },
          { valor: 'aCada', rotulo: 'A cada N' },
          { valor: 'intervalos', rotulo: 'Intervalos' },
          { valor: 'extrair', rotulo: 'Extrair' },
        ]}
        dica={
          {
            cada: 'Um PDF para cada página.',
            aCada: 'Partes com o mesmo número de páginas.',
            intervalos: 'Um PDF para cada intervalo, separados por vírgula.',
            extrair: 'Um único PDF só com as páginas escolhidas.',
          }[opcoes.modo]
        }
      />
      {opcoes.modo === 'aCada' ? <Entrada rotulo="Páginas por parte" type="number" min="1" valor={opcoes.n} aoMudar={(v) => mudar('n', v)} /> : null}
      {opcoes.modo === 'intervalos' ? <Entrada rotulo="Intervalos" valor={opcoes.intervalos} aoMudar={(v) => mudar('intervalos', v)} placeholder="1-3, 4-8, 9-" dica="Cada intervalo vira um PDF. “9-” vai até o fim." /> : null}
      {opcoes.modo === 'extrair' ? <Entrada rotulo="Páginas" valor={opcoes.paginas} aoMudar={(v) => mudar('paginas', v)} placeholder="1, 3, 5-7" dica="Na ordem em que você escrever." /> : null}
    </div>
  )
}

/** Dividir ou extrair páginas de um PDF. `modo` inicial vem da página (ex.: "Extrair páginas"). */
export default function Dividir({ modo = 'cada' }) {
  return (
    <ModeloConversao
      extensoes={['pdf']}
      descricaoFormatos="PDF"
      limiteBytes={LIMITE_PDF}
      multiplos={false}
      opcoesIniciais={{ modo, n: '2', intervalos: '', paginas: '' }}
      Configuracoes={Configuracoes}
      validarOpcoes={(o) => {
        if (o.modo === 'aCada' && !(Number(o.n) >= 1)) return 'Informe quantas páginas por parte.'
        if (o.modo === 'intervalos' && !o.intervalos.trim()) return 'Informe os intervalos, por exemplo 1-3, 4-8.'
        if (o.modo === 'extrair' && !o.paginas.trim()) return 'Informe as páginas, por exemplo 1, 3, 5-7.'
        return null
      }}
      rotuloAcao={modo === 'extrair' ? 'Extrair páginas' : 'Dividir PDF'}
      nomeZip="pdf-dividido.zip"
      processar={async ([item], o, { progresso, sinal }) => {
        const { PDFDocument } = await obterPdfLib()
        const doc = await abrirEdicao(item.arquivo)
        const total = doc.getPageCount()
        let grupos
        if (o.modo === 'cada') grupos = Array.from({ length: total }, (_, i) => [i + 1])
        else if (o.modo === 'aCada') {
          const n = Math.floor(Number(o.n))
          grupos = []
          for (let i = 1; i <= total; i += n) grupos.push(Array.from({ length: Math.min(n, total - i + 1) }, (_, k) => i + k))
        } else if (o.modo === 'intervalos') grupos = lerGrupos(o.intervalos, total)
        else grupos = [lerIntervalos(o.paginas, total)]

        const base = semExtensao(item.arquivo.name)
        const saida = []
        for (let g = 0; g < grupos.length; g += 1) {
          cancelado(sinal)
          const novo = await PDFDocument.create()
          const copiadas = await novo.copyPages(doc, grupos[g].map((p) => p - 1))
          copiadas.forEach((p) => novo.addPage(p))
          const paginas = grupos[g]
          const rotulo = paginas.length === 1 ? `p${paginas[0]}` : `p${paginas[0]}-${paginas[paginas.length - 1]}`
          saida.push({
            nome: o.modo === 'extrair' ? `${base}-paginas.pdf` : `${base}-${rotulo}.pdf`,
            blob: await salvarPdf(novo),
            detalhe: `${paginas.length} ${paginas.length === 1 ? 'página' : 'páginas'}`,
          })
          progresso((g + 1) / grupos.length, `Gerando (${g + 1} de ${grupos.length})`)
        }
        return saida
      }}
    />
  )
}
