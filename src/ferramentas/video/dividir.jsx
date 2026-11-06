import { ModeloConversao } from '../../componentes/ferramenta/ModeloConversao'
import { Caixa, Entrada, Segmentado } from '../../componentes/ui'
import { executarComVariasSaidas } from '../../motores/ffmpeg'
import { DESCRICAO_VIDEO, EXTENSOES_VIDEO, LIMITE_VIDEO, infoMidia } from '../../motores/midia'
import { extensaoDe, formatarDuracao, semExtensao } from '../../nucleo/arquivos'
import { ErroAmigavel } from '../../nucleo/tarefa'

function Configuracoes({ opcoes, mudar }) {
  return (
    <div className="flex flex-col gap-5">
      <Segmentado
        rotulo="Como dividir"
        valor={opcoes.modo}
        aoMudar={(v) => mudar('modo', v)}
        opcoes={[
          { valor: 'partes', rotulo: 'Em partes iguais' },
          { valor: 'duracao', rotulo: 'A cada X segundos' },
          { valor: 'tempos', rotulo: 'Nos tempos' },
        ]}
      />
      {opcoes.modo === 'partes' ? <Entrada rotulo="Número de partes" type="number" min="2" max="50" valor={opcoes.partes} aoMudar={(v) => mudar('partes', v)} /> : null}
      {opcoes.modo === 'duracao' ? <Entrada rotulo="Duração de cada parte" type="number" min="1" sufixo="s" valor={opcoes.segundos} aoMudar={(v) => mudar('segundos', v)} dica="Ex.: 60 para Stories de 1 minuto." /> : null}
      {opcoes.modo === 'tempos' ? <Entrada rotulo="Cortar em" valor={opcoes.tempos} aoMudar={(v) => mudar('tempos', v)} placeholder="0:30, 1:15, 2:40" dica="Minutos:segundos, separados por vírgula." /> : null}
      <Caixa
        rotulo="Corte exato no segundo"
        dica={opcoes.exato ? 'Recodifica o vídeo: preciso, porém mais lento.' : 'Sem recodificar: instantâneo, mas o corte cai no quadro-chave mais próximo (diferença de até ~2 s).'}
        marcado={opcoes.exato}
        aoMudar={(v) => mudar('exato', v)}
      />
    </div>
  )
}

const lerTempo = (t) => {
  const p = String(t).trim().replace(',', '.').split(':').map(Number)
  if (!p.length || p.some(Number.isNaN)) return null
  return p.length === 3 ? p[0] * 3600 + p[1] * 60 + p[2] : p.length === 2 ? p[0] * 60 + p[1] : p[0]
}

export default function Dividir() {
  return (
    <ModeloConversao
      extensoes={EXTENSOES_VIDEO}
      descricaoFormatos={DESCRICAO_VIDEO}
      limiteBytes={LIMITE_VIDEO}
      multiplos={false}
      opcoesIniciais={{ modo: 'partes', partes: '2', segundos: '60', tempos: '', exato: false }}
      Configuracoes={Configuracoes}
      rotuloAcao="Dividir vídeo"
      nomeZip="video-dividido.zip"
      processar={async ([item], o, { progresso, sinal }) => {
        const info = await infoMidia(item.arquivo)
        const duracao = info.duracao
        if (!duracao) throw new ErroAmigavel('Não foi possível ler a duração deste vídeo.')
        let cortes
        if (o.modo === 'partes') {
          const n = Math.floor(Number(o.partes))
          if (!(n >= 2 && n <= 50)) throw new ErroAmigavel('Escolha de 2 a 50 partes.')
          cortes = Array.from({ length: n - 1 }, (_, i) => (duracao / n) * (i + 1))
        } else if (o.modo === 'duracao') {
          const s = Number(o.segundos)
          if (!(s >= 1)) throw new ErroAmigavel('Informe a duração de cada parte em segundos.')
          if (duracao / s > 200) throw new ErroAmigavel('Isso geraria mais de 200 partes. Aumente a duração de cada uma.')
          cortes = []
          for (let t = s; t < duracao - 0.5; t += s) cortes.push(t)
        } else {
          cortes = o.tempos.split(/[,;\s]+/).filter(Boolean).map(lerTempo)
          if (!cortes.length || cortes.some((t) => t == null || t <= 0 || t >= duracao)) throw new ErroAmigavel(`Os tempos precisam estar entre 0:00 e ${formatarDuracao(duracao)}.`)
          cortes.sort((a, b) => a - b)
        }
        if (!cortes.length) throw new ErroAmigavel('O vídeo é curto demais para essa divisão.')

        const ext = ['mp4', 'mov', 'mkv', 'webm'].includes(extensaoDe(item.arquivo.name)) ? extensaoDe(item.arquivo.name) : 'mp4'
        const saidaExt = o.exato ? 'mp4' : ext
        const entrada = `entrada.${extensaoDe(item.arquivo.name) || 'mp4'}`
        const tempos = cortes.map((t) => t.toFixed(3)).join(',')
        const codec = o.exato
          ? ['-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-pix_fmt', 'yuv420p', '-force_key_frames', tempos, '-c:a', 'aac', '-b:a', '160k']
          : ['-c', 'copy']
        const partes = await executarComVariasSaidas({
          entradas: [{ nome: entrada, dados: item.arquivo }],
          args: ['-i', entrada, '-map', '0:v:0', '-map', '0:a:0?', ...codec, '-f', 'segment', '-segment_times', tempos, '-reset_timestamps', '1', `parte_%03d.${saidaExt}`],
          prefixo: 'parte_',
          duracao,
          aoProgredir: progresso,
          sinal,
          rotulo: 'Dividindo',
        })
        const base = semExtensao(item.arquivo.name)
        return partes.map((p, i) => ({ nome: `${base}-parte-${String(i + 1).padStart(2, '0')}.${saidaExt}`, blob: new Blob([p.dados], { type: `video/${saidaExt === 'mkv' ? 'x-matroska' : saidaExt === 'mov' ? 'quicktime' : saidaExt}` }) }))
      }}
    />
  )
}
