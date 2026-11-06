import { ModeloConversao } from '../../componentes/ferramenta/ModeloConversao'
import { DESCRICAO_IMAGEM, EXTENSOES_IMAGEM, LIMITE_IMAGEM, processarLote } from '../../motores/imagem'
import { CorDeFundo, EscalaSvg, EscolhaFormato, Qualidade, temSvg } from './_comum'

function Configuracoes({ opcoes, mudar, arquivos }) {
  return (
    <div className="flex flex-col gap-5">
      <EscolhaFormato valor={opcoes.formato} aoMudar={(v) => mudar('formato', v)} />
      <Qualidade valor={opcoes.qualidade} aoMudar={(v) => mudar('qualidade', v)} formato={opcoes.formato} />
      {opcoes.formato === 'jpg' ? <CorDeFundo valor={opcoes.fundo} aoMudar={(v) => mudar('fundo', v)} /> : null}
      {temSvg(arquivos) || opcoes.escalaFixa ? <EscalaSvg valor={opcoes.escalaSvg} aoMudar={(v) => mudar('escalaSvg', v)} /> : null}
    </div>
  )
}

/** Converter imagens entre formatos, em lote. `saida`/`entrada` vêm das páginas específicas (ex.: SVG para PNG). */
export default function Converter({ saida = 'webp', entrada }) {
  const extensoes = entrada ? [entrada] : EXTENSOES_IMAGEM
  return (
    <ModeloConversao
      extensoes={extensoes}
      descricaoFormatos={entrada ? entrada.toUpperCase() : DESCRICAO_IMAGEM}
      limiteBytes={LIMITE_IMAGEM}
      aceitarColar
      opcoesIniciais={{ formato: saida, qualidade: 85, fundo: '#ffffff', escalaSvg: entrada === 'svg' ? 2 : 1, escalaFixa: entrada === 'svg' }}
      Configuracoes={Configuracoes}
      rotuloAcao="Converter"
      rotuloProcessando="Convertendo"
      nomeZip="imagens-convertidas.zip"
      processar={(itens, o, ctx) =>
        processarLote(
          itens,
          () => ({ escalaSvg: o.escalaSvg, saida: { formato: o.formato, qualidade: o.qualidade, fundo: o.fundo } }),
          { ...ctx, rotulo: 'Convertendo' },
        )
      }
    />
  )
}
