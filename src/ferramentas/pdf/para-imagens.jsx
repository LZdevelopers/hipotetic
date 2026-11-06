import { ModeloConversao } from '../../componentes/ferramenta/ModeloConversao'
import { Entrada, Segmentado, Seletor } from '../../componentes/ui'
import { LIMITE_PDF, abrirLeitura, desenharPagina, lerIntervalos } from '../../motores/pdf'
import { semExtensao } from '../../nucleo/arquivos'
import { ErroAmigavel, cancelado } from '../../nucleo/tarefa'

function Configuracoes({ opcoes, mudar }) {
  return (
    <div className="flex flex-col gap-5">
      <Segmentado
        rotulo="Formato"
        valor={opcoes.formato}
        aoMudar={(v) => mudar('formato', v)}
        opcoes={[
          { valor: 'jpg', rotulo: 'JPG' },
          { valor: 'png', rotulo: 'PNG' },
          { valor: 'webp', rotulo: 'WebP' },
        ]}
      />
      <Seletor
        rotulo="Resolução"
        valor={String(opcoes.dpi)}
        aoMudar={(v) => mudar('dpi', Number(v))}
        opcoes={[
          { valor: '72', rotulo: '72 dpi · tela, arquivos pequenos' },
          { valor: '150', rotulo: '150 dpi · leitura confortável' },
          { valor: '200', rotulo: '200 dpi · boa nitidez' },
          { valor: '300', rotulo: '300 dpi · impressão' },
        ]}
      />
      <Entrada rotulo="Páginas" valor={opcoes.paginas} aoMudar={(v) => mudar('paginas', v)} placeholder="Todas" dica="Deixe vazio para todas, ou escreva 1-3, 5." />
    </div>
  )
}

const MIME = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp' }

export default function ParaImagens({ formato = 'jpg' }) {
  return (
    <ModeloConversao
      extensoes={['pdf']}
      descricaoFormatos="PDF"
      limiteBytes={LIMITE_PDF}
      multiplos={false}
      opcoesIniciais={{ formato, dpi: 150, paginas: '' }}
      Configuracoes={Configuracoes}
      rotuloAcao="Converter páginas"
      nomeZip="paginas.zip"
      processar={async ([item], o, { progresso, sinal }) => {
        const doc = await abrirLeitura(item.arquivo)
        try {
          const paginas = o.paginas.trim() ? lerIntervalos(o.paginas, doc.numPages) : Array.from({ length: doc.numPages }, (_, i) => i + 1)
          if (paginas.length > 500) throw new ErroAmigavel('Muitas páginas de uma vez (máximo de 500). Escolha um intervalo.')
          const base = semExtensao(item.arquivo.name)
          const digitos = String(doc.numPages).length
          const saida = []
          for (let i = 0; i < paginas.length; i += 1) {
            cancelado(sinal)
            const n = paginas[i]
            const canvas = await desenharPagina(doc, n, o.dpi / 72, { sinal })
            const blob = await new Promise((ok) => canvas.toBlob(ok, MIME[o.formato], 0.9))
            saida.push({ nome: `${base}-pagina-${String(n).padStart(digitos, '0')}.${o.formato}`, blob, detalhe: `${canvas.width} × ${canvas.height} px` })
            canvas.width = 0 // libera a memória do canvas
            progresso((i + 1) / paginas.length, `Convertendo página ${i + 1} de ${paginas.length}`)
          }
          return saida
        } finally {
          doc.destroy()
        }
      }}
    />
  )
}
