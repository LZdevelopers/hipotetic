import { ModeloConversao } from '../../componentes/ferramenta/ModeloConversao'
import { Caixa, Entrada, Segmentado, Seletor } from '../../componentes/ui'
import { DESCRICAO_VIDEO, EXTENSOES_VIDEO, LIMITE_VIDEO, infoMidia, processarVideo } from '../../motores/midia'
import { formatarDuracao, trocarExtensao } from '../../nucleo/arquivos'
import { cancelado } from '../../nucleo/tarefa'
import { Fps, QualidadeVideo, Resolucao, medidasPara, nomeMotor } from './_comum'
import { MAX_SEGUNDOS_GIF, gerarGif, lerTempo } from './_gif'

const FORMATOS = [
  { valor: 'mp4', rotulo: 'MP4' },
  { valor: 'webm', rotulo: 'WebM' },
  { valor: 'mov', rotulo: 'MOV' },
  { valor: 'mkv', rotulo: 'MKV' },
  { valor: 'gif', rotulo: 'GIF' },
]
const DICAS = {
  mp4: 'Abre em qualquer aparelho, rede social e programa. A escolha mais segura.',
  webm: 'Formato aberto da web (VP9). Ótimo para sites.',
  mov: 'Padrão da Apple (QuickTime): iPhone, Mac e Final Cut.',
  mkv: 'Contêiner flexível, comum em filmes e séries.',
  gif: 'Animação sem som que toca em qualquer lugar. Use trechos curtos: GIF fica pesado.',
}

function Configuracoes({ opcoes, mudar }) {
  const gif = opcoes.formato === 'gif'
  return (
    <div className="flex flex-col gap-5">
      <Segmentado rotulo="Converter para" valor={opcoes.formato} aoMudar={(v) => mudar('formato', v)} opcoes={FORMATOS} dica={DICAS[opcoes.formato]} />
      {gif ? (
        <>
          <div className="grid grid-cols-2 gap-3">
            <Entrada rotulo="Início" valor={opcoes.inicio} aoMudar={(v) => mudar('inicio', v)} placeholder="0:00" dica="minutos:segundos" />
            <Entrada rotulo="Fim" valor={opcoes.fim} aoMudar={(v) => mudar('fim', v)} placeholder={`até ${MAX_SEGUNDOS_GIF} s`} />
          </div>
          <Seletor
            rotulo="Largura"
            valor={String(opcoes.largura)}
            aoMudar={(v) => mudar('largura', Number(v))}
            opcoes={[240, 320, 480, 640, 800].map((v) => ({ valor: String(v), rotulo: `${v} px${v === 480 ? ' (recomendado)' : ''}` }))}
          />
          <Segmentado
            rotulo="Fluidez"
            valor={String(opcoes.fpsGif)}
            aoMudar={(v) => mudar('fpsGif', Number(v))}
            opcoes={[8, 12, 15, 24].map((v) => ({ valor: String(v), rotulo: `${v} fps` }))}
          />
          <Caixa rotulo="Repetir sem parar (loop)" marcado={opcoes.loop} aoMudar={(v) => mudar('loop', v)} />
        </>
      ) : (
        <>
          <QualidadeVideo valor={opcoes.qualidade} aoMudar={(v) => mudar('qualidade', v)} />
          <Resolucao valor={opcoes.resolucao} aoMudar={(v) => mudar('resolucao', v)} />
          <Fps valor={opcoes.fps} aoMudar={(v) => mudar('fps', v)} />
          <Caixa rotulo="Remover o áudio" marcado={opcoes.semAudio} aoMudar={(v) => mudar('semAudio', v)} />
        </>
      )}
    </div>
  )
}

function validar(o) {
  if (o.formato !== 'gif') return null
  const i = lerTempo(o.inicio)
  const f = lerTempo(o.fim)
  if (Number.isNaN(i) || Number.isNaN(f)) return 'Use o formato minutos:segundos, como 0:12 ou 1:05.5.'
  if (i != null && f != null && f <= i) return 'O fim precisa ser depois do início.'
  if (i != null && f != null && f - i > MAX_SEGUNDOS_GIF) return `Para GIF, escolha um trecho de até ${MAX_SEGUNDOS_GIF} segundos.`
  return null
}

/**
 * Conversor de vídeo único: qualquer vídeo (ou GIF) para MP4, WebM, MOV, MKV
 * ou GIF. A pessoa escolhe o destino; o motor certo é escolhido sozinho.
 */
export default function Converter() {
  return (
    <ModeloConversao
      extensoes={[...EXTENSOES_VIDEO, 'gif']}
      descricaoFormatos={`${DESCRICAO_VIDEO}, GIF`}
      limiteBytes={LIMITE_VIDEO}
      maximo={20}
      opcoesIniciais={{ formato: 'mp4', qualidade: 'alta', resolucao: 0, fps: 0, semAudio: false, inicio: '', fim: '', largura: 480, fpsGif: 12, loop: true }}
      Configuracoes={Configuracoes}
      validarOpcoes={validar}
      rotuloAcao="Converter"
      aviso="Roda no seu aparelho. Com a aceleração do navegador leva segundos; em WebAssembly (AVI, GIF), pode levar alguns minutos."
      nomeZip="videos-convertidos.zip"
      processar={async (itens, o, { progresso, sinal }) => {
        const saidas = []
        for (let i = 0; i < itens.length; i += 1) {
          cancelado(sinal)
          const { arquivo } = itens[i]
          const prefixo = itens.length > 1 ? `Vídeo ${i + 1} de ${itens.length} · ` : ''
          const ctx = { progresso: (v, r) => progresso(v == null ? null : (i + v) / itens.length, prefixo + (r ?? 'Convertendo')), sinal }
          if (o.formato === 'gif') {
            const g = await gerarGif(arquivo, { inicio: o.inicio, fim: o.fim, largura: o.largura, fps: o.fpsGif, loop: o.loop }, ctx)
            saidas.push({ nome: trocarExtensao(arquivo.name, 'gif'), blob: g.blob, original: arquivo.size, detalhe: g.detalhe })
            continue
          }
          const info = await infoMidia(arquivo).catch(() => null)
          const { blob, motor } = await processarVideo(arquivo, { formato: o.formato, qualidade: o.qualidade, fps: o.fps || undefined, semAudio: o.semAudio, ...medidasPara(info, o.resolucao) }, ctx)
          saidas.push({ nome: trocarExtensao(arquivo.name, o.formato), blob, original: arquivo.size, detalhe: [info?.duracao ? formatarDuracao(info.duracao) : null, nomeMotor(motor)].filter(Boolean).join(' · ') })
        }
        return saidas
      }}
    />
  )
}
