import { ModeloConversao } from '../../componentes/ferramenta/ModeloConversao'
import { Segmentado } from '../../componentes/ui'
import { executarFfmpeg } from '../../motores/ffmpeg'
import { trocarExtensao } from '../../nucleo/arquivos'
import { cancelado } from '../../nucleo/tarefa'

function Configuracoes({ opcoes, mudar }) {
  return (
    <Segmentado
      rotulo="Formato"
      valor={opcoes.formato}
      aoMudar={(v) => mudar('formato', v)}
      opcoes={[
        { valor: 'mp4', rotulo: 'MP4' },
        { valor: 'webm', rotulo: 'WebM' },
      ]}
      dica="Um GIF vira um vídeo de 5 a 20 vezes menor, com a mesma aparência."
    />
  )
}

/** GIF animado → MP4/WebM (muito menor; ideal para sites e redes). */
export default function GifParaVideo() {
  return (
    <ModeloConversao
      extensoes={['gif']}
      descricaoFormatos="GIF animado"
      limiteBytes={300 * 1024 * 1024}
      opcoesIniciais={{ formato: 'mp4' }}
      Configuracoes={Configuracoes}
      rotuloAcao="Converter"
      nomeZip="gifs-convertidos.zip"
      processar={async (itens, o, { progresso, sinal }) => {
        const saidas = []
        for (let i = 0; i < itens.length; i += 1) {
          cancelado(sinal)
          const { arquivo } = itens[i]
          const codec =
            o.formato === 'webm'
              ? ['-c:v', 'libvpx-vp9', '-deadline', 'realtime', '-cpu-used', '8', '-crf', '32', '-b:v', '0']
              : ['-c:v', 'libx264', '-preset', 'veryfast', '-crf', '22', '-pix_fmt', 'yuv420p', '-movflags', '+faststart']
          const dados = await executarFfmpeg({
            entradas: [{ nome: 'entrada.gif', dados: arquivo }],
            args: ['-i', 'entrada.gif', '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2', '-an', ...codec],
            saida: `saida.${o.formato}`,
            aoProgredir: (v, r) => progresso(v == null ? null : (i + v) / itens.length, r),
            sinal,
            rotulo: itens.length > 1 ? `Convertendo ${i + 1} de ${itens.length}` : 'Convertendo',
          })
          saidas.push({ nome: trocarExtensao(arquivo.name, o.formato), blob: new Blob([dados], { type: o.formato === 'webm' ? 'video/webm' : 'video/mp4' }), original: arquivo.size })
        }
        return saidas
      }}
    />
  )
}
