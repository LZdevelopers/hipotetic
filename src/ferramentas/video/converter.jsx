import { ModeloConversao } from '../../componentes/ferramenta/ModeloConversao'
import { Caixa } from '../../componentes/ui'
import { DESCRICAO_VIDEO, EXTENSOES_VIDEO, LIMITE_VIDEO, infoMidia, processarVideo } from '../../motores/midia'
import { formatarDuracao, trocarExtensao } from '../../nucleo/arquivos'
import { cancelado } from '../../nucleo/tarefa'
import { EscolhaFormatoVideo, Fps, QualidadeVideo, Resolucao, medidasPara, nomeMotor } from './_comum'

function Configuracoes({ opcoes, mudar }) {
  return (
    <div className="flex flex-col gap-5">
      <EscolhaFormatoVideo valor={opcoes.formato} aoMudar={(v) => mudar('formato', v)} />
      <QualidadeVideo valor={opcoes.qualidade} aoMudar={(v) => mudar('qualidade', v)} />
      <Resolucao valor={opcoes.resolucao} aoMudar={(v) => mudar('resolucao', v)} />
      <Fps valor={opcoes.fps} aoMudar={(v) => mudar('fps', v)} />
      <Caixa rotulo="Remover o áudio" marcado={opcoes.semAudio} aoMudar={(v) => mudar('semAudio', v)} />
    </div>
  )
}

/** Converter vídeos entre formatos. `entrada`/`saida` vêm das páginas específicas (ex.: MOV para MP4). */
export default function Converter({ entrada, saida = 'mp4' }) {
  return (
    <ModeloConversao
      extensoes={entrada ? [entrada] : EXTENSOES_VIDEO}
      descricaoFormatos={entrada ? entrada.toUpperCase() : DESCRICAO_VIDEO}
      limiteBytes={LIMITE_VIDEO}
      maximo={20}
      opcoesIniciais={{ formato: saida, qualidade: 'alta', resolucao: 0, fps: 0, semAudio: false }}
      Configuracoes={Configuracoes}
      rotuloAcao="Converter"
      aviso="A conversão roda no seu aparelho. Com a aceleração do navegador leva segundos; em WebAssembly, pode levar alguns minutos por vídeo."
      nomeZip="videos-convertidos.zip"
      processar={async (itens, o, { progresso, sinal }) => {
        const saidas = []
        for (let i = 0; i < itens.length; i += 1) {
          cancelado(sinal)
          const { arquivo } = itens[i]
          const info = await infoMidia(arquivo).catch(() => null)
          const prefixo = itens.length > 1 ? `Vídeo ${i + 1} de ${itens.length} · ` : ''
          const { blob, motor } = await processarVideo(
            arquivo,
            { formato: o.formato, qualidade: o.qualidade, fps: o.fps || undefined, semAudio: o.semAudio, ...medidasPara(info, o.resolucao) },
            { progresso: (v, r) => progresso(v == null ? null : (i + v) / itens.length, prefixo + (r ?? 'Convertendo')), sinal },
          )
          saidas.push({ nome: trocarExtensao(arquivo.name, o.formato), blob, original: arquivo.size, detalhe: [info?.duracao ? formatarDuracao(info.duracao) : null, nomeMotor(motor)].filter(Boolean).join(' · ') })
        }
        return saidas
      }}
    />
  )
}
