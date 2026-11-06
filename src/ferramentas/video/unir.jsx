import { ModeloConversao } from '../../componentes/ferramenta/ModeloConversao'
import { Seletor } from '../../componentes/ui'
import { executarFfmpeg } from '../../motores/ffmpeg'
import { DESCRICAO_VIDEO, EXTENSOES_VIDEO, LIMITE_VIDEO, argsVideoFfmpeg, infoMidia } from '../../motores/midia'
import { extensaoDe, formatarDuracao } from '../../nucleo/arquivos'
import { ErroAmigavel, cancelado } from '../../nucleo/tarefa'

function Configuracoes({ opcoes, mudar }) {
  return (
    <div className="flex flex-col gap-5">
      <p className="text-sm text-suave">Os vídeos são unidos na ordem da lista. Use as setas para mudar a ordem.</p>
      <Seletor
        rotulo="Tamanho do vídeo final"
        valor={opcoes.tamanho}
        aoMudar={(v) => mudar('tamanho', v)}
        opcoes={[
          { valor: 'primeiro', rotulo: 'Igual ao primeiro vídeo' },
          { valor: '1920x1080', rotulo: '1920×1080 (horizontal)' },
          { valor: '1280x720', rotulo: '1280×720 (horizontal)' },
          { valor: '1080x1920', rotulo: '1080×1920 (vertical)' },
          { valor: '720x1280', rotulo: '720×1280 (vertical)' },
          { valor: '1080x1080', rotulo: '1080×1080 (quadrado)' },
        ]}
        dica="Vídeos de outro tamanho são encaixados com barras pretas, sem distorcer."
      />
    </div>
  )
}

/**
 * Juntar vídeos com tamanhos, taxas de quadro e áudios diferentes: cada um é
 * normalizado (escala + barras, 30 fps, áudio 48 kHz estéreo — ou silêncio,
 * se não tiver som) e depois concatenado.
 */
export default function Unir() {
  return (
    <ModeloConversao
      extensoes={EXTENSOES_VIDEO}
      descricaoFormatos={DESCRICAO_VIDEO}
      limiteBytes={LIMITE_VIDEO}
      ordenavel
      minimoArquivos={2}
      maximo={20}
      opcoesIniciais={{ tamanho: 'primeiro' }}
      Configuracoes={Configuracoes}
      rotuloAcao="Juntar vídeos"
      aviso="Juntar recodifica tudo em WebAssembly no seu aparelho: conte alguns minutos para vídeos longos."
      processar={async (itens, o, { progresso, sinal }) => {
        progresso(null, 'Lendo os vídeos')
        const infos = []
        for (const { arquivo } of itens) {
          cancelado(sinal)
          const info = await infoMidia(arquivo)
          if (!info.temVideo) throw new ErroAmigavel(`“${arquivo.name}” não tem vídeo.`)
          infos.push(info)
        }
        let [W, H] = o.tamanho === 'primeiro' ? [infos[0].largura, infos[0].altura] : o.tamanho.split('x').map(Number)
        W = Math.round(W / 2) * 2
        H = Math.round(H / 2) * 2
        const entradas = itens.map(({ arquivo }, i) => ({ nome: `v${i}.${extensaoDe(arquivo.name) || 'mp4'}`, dados: arquivo }))
        const partes = []
        const ligacoes = []
        infos.forEach((info, i) => {
          partes.push(`[${i}:v]scale=${W}:${H}:force_original_aspect_ratio=decrease,pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=30,format=yuv420p[v${i}]`)
          partes.push(info.temAudio ? `[${i}:a]aresample=48000,aformat=channel_layouts=stereo[a${i}]` : `anullsrc=r=48000:cl=stereo,atrim=duration=${info.duracao ?? 1}[a${i}]`)
          ligacoes.push(`[v${i}][a${i}]`)
        })
        const filtro = `${partes.join(';')};${ligacoes.join('')}concat=n=${itens.length}:v=1:a=1[v][a]`
        const total = infos.reduce((s, i) => s + (i.duracao ?? 0), 0)
        const dados = await executarFfmpeg({
          entradas,
          args: [...entradas.flatMap((e) => ['-i', e.nome]), '-filter_complex', filtro, '-map', '[v]', '-map', '[a]', ...argsVideoFfmpeg('mp4', 'alta')],
          saida: 'unido.mp4',
          duracao: total || undefined,
          aoProgredir: progresso,
          sinal,
          rotulo: 'Juntando os vídeos',
        })
        return [{ nome: 'videos-unidos.mp4', blob: new Blob([dados], { type: 'video/mp4' }), detalhe: `${formatarDuracao(total)} · ${W}×${H}` }]
      }}
    />
  )
}
