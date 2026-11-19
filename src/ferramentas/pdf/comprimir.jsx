import { ModeloConversao } from '../../componentes/ferramenta/ModeloConversao'
import { Segmentado } from '../../componentes/ui'
import { LIMITE_PDF } from '../../motores/pdf'
import { DICAS_COMPRESSAO, otimizarPdf } from '../../motores/pdf/otimizar'
import { trocarExtensao } from '../../nucleo/arquivos'

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
      dica={DICAS_COMPRESSAO[opcoes.nivel]}
    />
  )
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
        const { bytes, imagens } = await otimizarPdf(item.arquivo, o.nivel, { progresso, sinal })
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
