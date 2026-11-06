import { ModeloConversao } from '../../componentes/ferramenta/ModeloConversao'
import { Caixa, Entrada, Segmentado, Seletor } from '../../componentes/ui'
import { executarFfmpeg } from '../../motores/ffmpeg'
import { DESCRICAO_VIDEO, EXTENSOES_VIDEO, infoMidia } from '../../motores/midia'
import { extensaoDe, trocarExtensao } from '../../nucleo/arquivos'
import { ErroAmigavel } from '../../nucleo/tarefa'

const MAX_SEGUNDOS = 30

const lerTempo = (t) => {
  if (String(t).trim() === '') return null
  const p = String(t).replace(',', '.').split(':').map(Number)
  if (p.some(Number.isNaN)) return NaN
  return p.length === 2 ? p[0] * 60 + p[1] : p[0]
}

function Configuracoes({ opcoes, mudar }) {
  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-3">
        <Entrada rotulo="Início" valor={opcoes.inicio} aoMudar={(v) => mudar('inicio', v)} placeholder="0:00" dica="minutos:segundos" />
        <Entrada rotulo="Fim" valor={opcoes.fim} aoMudar={(v) => mudar('fim', v)} placeholder={`até ${MAX_SEGUNDOS} s`} />
      </div>
      <Seletor
        rotulo="Largura"
        valor={String(opcoes.largura)}
        aoMudar={(v) => mudar('largura', Number(v))}
        opcoes={[
          { valor: '240', rotulo: '240 px (bem leve)' },
          { valor: '320', rotulo: '320 px' },
          { valor: '480', rotulo: '480 px (recomendado)' },
          { valor: '640', rotulo: '640 px' },
          { valor: '800', rotulo: '800 px' },
        ]}
      />
      <Segmentado
        rotulo="Fluidez"
        valor={String(opcoes.fps)}
        aoMudar={(v) => mudar('fps', Number(v))}
        opcoes={[
          { valor: '8', rotulo: '8 fps' },
          { valor: '12', rotulo: '12 fps' },
          { valor: '15', rotulo: '15 fps' },
          { valor: '24', rotulo: '24 fps' },
        ]}
        dica="Mais quadros = mais suave e mais pesado."
      />
      <Caixa rotulo="Repetir sem parar (loop)" marcado={opcoes.loop} aoMudar={(v) => mudar('loop', v)} />
    </div>
  )
}

/**
 * Vídeo → GIF com paleta otimizada (palettegen/paletteuse em duas passadas
 * num só comando): cores bem melhores que a conversão direta.
 */
export default function ParaGif() {
  return (
    <ModeloConversao
      extensoes={EXTENSOES_VIDEO}
      descricaoFormatos={DESCRICAO_VIDEO}
      limiteBytes={1024 * 1024 * 1024}
      multiplos={false}
      opcoesIniciais={{ inicio: '', fim: '', largura: 480, fps: 12, loop: true }}
      Configuracoes={Configuracoes}
      validarOpcoes={(o) => {
        const i = lerTempo(o.inicio)
        const f = lerTempo(o.fim)
        if (Number.isNaN(i) || Number.isNaN(f)) return 'Use o formato minutos:segundos, como 0:12 ou 1:05.5.'
        if (i != null && f != null && f <= i) return 'O fim precisa ser depois do início.'
        if (i != null && f != null && f - i > MAX_SEGUNDOS) return `GIFs ficam enormes: escolha um trecho de até ${MAX_SEGUNDOS} segundos.`
        return null
      }}
      rotuloAcao="Criar GIF"
      processar={async ([item], o, { progresso, sinal }) => {
        const info = await infoMidia(item.arquivo)
        if (!info.temVideo) throw new ErroAmigavel('Este arquivo não tem vídeo.')
        const inicio = lerTempo(o.inicio) ?? 0
        const fim = Math.min(lerTempo(o.fim) ?? inicio + MAX_SEGUNDOS, info.duracao ?? Infinity)
        if (fim - inicio > MAX_SEGUNDOS + 0.01) throw new ErroAmigavel(`Escolha um trecho de até ${MAX_SEGUNDOS} segundos.`)
        const entrada = `entrada.${extensaoDe(item.arquivo.name) || 'mp4'}`
        const filtro = `fps=${o.fps},scale=${o.largura}:-1:flags=lanczos,split[a][b];[a]palettegen=stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle`
        const dados = await executarFfmpeg({
          entradas: [{ nome: entrada, dados: item.arquivo }],
          args: ['-ss', String(inicio), '-t', String(fim - inicio), '-i', entrada, '-vf', filtro, '-loop', o.loop ? '0' : '-1'],
          saida: 'saida.gif',
          duracao: fim - inicio,
          aoProgredir: progresso,
          sinal,
          rotulo: 'Criando o GIF',
        })
        return [{ nome: trocarExtensao(item.arquivo.name, 'gif'), blob: new Blob([dados], { type: 'image/gif' }), detalhe: `${(fim - inicio).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} s · ${o.largura} px · ${o.fps} fps` }]
      }}
    />
  )
}
