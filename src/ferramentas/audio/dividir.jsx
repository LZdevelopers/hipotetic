import { ModeloConversao } from '../../componentes/ferramenta/ModeloConversao'
import { Deslizante, Entrada, Segmentado } from '../../componentes/ui'
import { executarComVariasSaidas } from '../../motores/ffmpeg'
import { DESCRICAO_AUDIO, EXTENSOES_AUDIO, LIMITE_AUDIO, infoMidia } from '../../motores/midia'
import { extensaoDe, formatarDuracao, mimeDe, semExtensao } from '../../nucleo/arquivos'
import { ErroAmigavel } from '../../nucleo/tarefa'
import { analisar, silencios } from './_analise'

function Configuracoes({ opcoes, mudar }) {
  return (
    <div className="flex flex-col gap-5">
      <Segmentado
        rotulo="Como dividir"
        valor={opcoes.modo}
        aoMudar={(v) => mudar('modo', v)}
        opcoes={[
          { valor: 'pausas', rotulo: 'Nas pausas' },
          { valor: 'partes', rotulo: 'Partes iguais' },
          { valor: 'duracao', rotulo: 'A cada X s' },
          { valor: 'tempos', rotulo: 'Nos tempos' },
        ]}
      />
      {opcoes.modo === 'pausas' ? (
        <>
          <Deslizante rotulo="Pausa mínima para cortar" valor={opcoes.pausa} aoMudar={(v) => mudar('pausa', v)} min={0.5} max={5} passo={0.25} formatar={(v) => `${v.toLocaleString('pt-BR')} s`} dica="Separa as faixas de uma gravação longa, ou as falas de um áudio." />
          <Deslizante rotulo="O que conta como silêncio" valor={opcoes.limiar} aoMudar={(v) => mudar('limiar', v)} min={-70} max={-25} formatar={(v) => `abaixo de ${v} dB`} />
        </>
      ) : null}
      {opcoes.modo === 'partes' ? <Entrada rotulo="Número de partes" type="number" min="2" max="100" valor={opcoes.partes} aoMudar={(v) => mudar('partes', v)} /> : null}
      {opcoes.modo === 'duracao' ? <Entrada rotulo="Duração de cada parte" type="number" min="1" sufixo="s" valor={opcoes.segundos} aoMudar={(v) => mudar('segundos', v)} dica="Ex.: 600 para partes de 10 minutos." /> : null}
      {opcoes.modo === 'tempos' ? <Entrada rotulo="Cortar em" valor={opcoes.tempos} aoMudar={(v) => mudar('tempos', v)} placeholder="0:30, 1:15, 2:40" dica="Minutos:segundos, separados por vírgula." /> : null}
      <p className="text-xs text-fraca">O áudio não é recomprimido: cada parte sai no mesmo formato e qualidade do original.</p>
    </div>
  )
}

const lerTempo = (t) => {
  const p = String(t).trim().replace(',', '.').split(':').map(Number)
  if (!p.length || p.some(Number.isNaN)) return null
  return p.length === 3 ? p[0] * 3600 + p[1] * 60 + p[2] : p.length === 2 ? p[0] * 60 + p[1] : p[0]
}

/** Formatos que o ffmpeg divide sem recodificar; os demais saem em MP3. */
const COPIA = ['mp3', 'm4a', 'aac', 'ogg', 'opus', 'flac', 'wav']

/** Dividir áudio em partes iguais, a cada X segundos, em tempos escolhidos ou nas pausas. */
export default function DividirAudio() {
  return (
    <ModeloConversao
      extensoes={EXTENSOES_AUDIO}
      descricaoFormatos={DESCRICAO_AUDIO}
      limiteBytes={LIMITE_AUDIO}
      multiplos={false}
      opcoesIniciais={{ modo: 'pausas', pausa: 1.5, limiar: -45, partes: '2', segundos: '600', tempos: '' }}
      Configuracoes={Configuracoes}
      rotuloAcao="Dividir áudio"
      nomeZip="audio-dividido.zip"
      processar={async ([item], o, { progresso, sinal }) => {
        const { arquivo } = item
        let duracao = (await infoMidia(arquivo).catch(() => ({}))).duracao
        let cortes
        if (o.modo === 'pausas') {
          progresso(null, 'Procurando as pausas')
          const a = await analisar(arquivo, { sinal, progresso })
          duracao = duracao || a.duracao
          // Corta no meio de cada pausa longa (as pontas mudas não contam).
          const regioes = silencios(a, { inicio: 0, fim: a.duracao, limiar: o.limiar, modo: 'tudo', minimo: o.pausa }).filter(([x, y]) => x > 0.05 && y < a.duracao - 0.05)
          cortes = regioes.map(([x, y]) => (x + y) / 2)
          if (!cortes.length) throw new ErroAmigavel(`Nenhuma pausa de ${o.pausa.toLocaleString('pt-BR')} s ou mais foi encontrada. Diminua a pausa mínima ou aumente o limite de silêncio.`)
          if (cortes.length > 199) throw new ErroAmigavel('Isso geraria mais de 200 partes. Aumente a pausa mínima.')
        } else {
          if (!duracao) throw new ErroAmigavel('Não foi possível ler a duração deste áudio.')
          if (o.modo === 'partes') {
            const n = Math.floor(Number(o.partes))
            if (!(n >= 2 && n <= 100)) throw new ErroAmigavel('Escolha de 2 a 100 partes.')
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
          if (!cortes.length) throw new ErroAmigavel('O áudio é curto demais para essa divisão.')
        }

        const ext = extensaoDe(arquivo.name)
        const copia = COPIA.includes(ext)
        const saidaExt = copia ? ext : 'mp3'
        const entrada = `entrada.${ext || 'bin'}`
        const partes = await executarComVariasSaidas({
          entradas: [{ nome: entrada, dados: arquivo }],
          args: ['-i', entrada, '-map', '0:a:0', '-vn', ...(copia ? ['-c', 'copy'] : ['-c:a', 'libmp3lame', '-b:a', '192k']), '-f', 'segment', '-segment_times', cortes.map((t) => t.toFixed(3)).join(','), '-reset_timestamps', '1', `parte_%03d.${saidaExt}`],
          prefixo: 'parte_',
          duracao,
          aoProgredir: progresso,
          sinal,
          rotulo: 'Dividindo',
        })
        const base = semExtensao(arquivo.name)
        const fronteiras = [0, ...cortes, duracao]
        return partes.map((p, i) => ({
          nome: `${base}-parte-${String(i + 1).padStart(2, '0')}.${saidaExt}`,
          blob: new Blob([p.dados], { type: mimeDe(saidaExt) }),
          detalhe: duracao && fronteiras[i + 1] != null ? `${formatarDuracao(fronteiras[i])} → ${formatarDuracao(fronteiras[i + 1])}` : undefined,
        }))
      }}
    />
  )
}
