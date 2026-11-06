import { ModeloConversao } from '../../componentes/ferramenta/ModeloConversao'
import { Seletor } from '../../componentes/ui'
import { executarFfmpeg } from '../../motores/ffmpeg'
import { DESCRICAO_AUDIO, EXTENSOES_AUDIO, FORMATOS_AUDIO, LIMITE_AUDIO, infoMidia } from '../../motores/midia'
import { extensaoDe, formatarDuracao } from '../../nucleo/arquivos'
import { ErroAmigavel, cancelado } from '../../nucleo/tarefa'
import { Bitrate, FormatoAudio } from './_comum'

function Configuracoes({ opcoes, mudar }) {
  return (
    <div className="flex flex-col gap-5">
      <p className="text-sm text-suave">As faixas são unidas na ordem da lista.</p>
      <Seletor
        rotulo="Entre as faixas"
        valor={opcoes.transicao}
        aoMudar={(v) => mudar('transicao', v)}
        opcoes={[
          { valor: 'nada', rotulo: 'Emendar direto' },
          { valor: 'pausa1', rotulo: '1 segundo de silêncio' },
          { valor: 'pausa2', rotulo: '2 segundos de silêncio' },
          { valor: 'cruzar', rotulo: 'Transição suave (crossfade de 2 s)' },
        ]}
      />
      <FormatoAudio valor={opcoes.formato} aoMudar={(v) => mudar('formato', v)} />
      <Bitrate valor={opcoes.bitrate} aoMudar={(v) => mudar('bitrate', v)} formato={opcoes.formato} />
    </div>
  )
}

export default function UnirAudio() {
  return (
    <ModeloConversao
      extensoes={EXTENSOES_AUDIO}
      descricaoFormatos={DESCRICAO_AUDIO}
      limiteBytes={LIMITE_AUDIO}
      ordenavel
      minimoArquivos={2}
      maximo={50}
      opcoesIniciais={{ transicao: 'nada', formato: 'mp3', bitrate: 192 }}
      Configuracoes={Configuracoes}
      rotuloAcao="Juntar áudios"
      processar={async (itens, o, { progresso, sinal }) => {
        const infos = []
        for (const { arquivo } of itens) {
          cancelado(sinal)
          const info = await infoMidia(arquivo).catch(() => ({}))
          if (info.temAudio === false) throw new ErroAmigavel(`“${arquivo.name}” não tem áudio.`)
          infos.push(info)
        }
        const entradas = itens.map(({ arquivo }, i) => ({ nome: `a${i}.${extensaoDe(arquivo.name) || 'mp3'}`, dados: arquivo }))
        const norm = (i) => `[${i}:a]aresample=44100,aformat=sample_fmts=fltp:channel_layouts=stereo[n${i}]`
        let filtro
        if (o.transicao === 'cruzar') {
          // Cadeia de acrossfade: ((1×2)×3)×…
          const partes = itens.map((_, i) => norm(i))
          let anterior = 'n0'
          for (let i = 1; i < itens.length; i += 1) {
            const saida = i === itens.length - 1 ? 'a' : `x${i}`
            partes.push(`[${anterior}][n${i}]acrossfade=d=2:c1=tri:c2=tri[${saida}]`)
            anterior = saida
          }
          filtro = partes.join(';')
        } else {
          const pausa = o.transicao === 'pausa1' ? 1 : o.transicao === 'pausa2' ? 2 : 0
          const partes = itens.map((_, i) => norm(i))
          const sequencia = []
          itens.forEach((_, i) => {
            sequencia.push(`[n${i}]`)
            if (pausa && i < itens.length - 1) {
              partes.push(`anullsrc=r=44100:cl=stereo,atrim=duration=${pausa}[s${i}]`)
              sequencia.push(`[s${i}]`)
            }
          })
          filtro = `${partes.join(';')};${sequencia.join('')}concat=n=${sequencia.length}:v=0:a=1[a]`
        }
        const total = infos.reduce((s, i) => s + (i.duracao ?? 0), 0)
        const dados = await executarFfmpeg({
          entradas,
          args: [...entradas.flatMap((e) => ['-i', e.nome]), '-filter_complex', filtro, '-map', '[a]', ...FORMATOS_AUDIO[o.formato].args(o.bitrate)],
          saida: `unido.${o.formato}`,
          duracao: total || undefined,
          aoProgredir: progresso,
          sinal,
          rotulo: 'Juntando',
        })
        return [{ nome: `audios-unidos.${o.formato}`, blob: new Blob([dados], { type: FORMATOS_AUDIO[o.formato].mime }), detalhe: total ? `cerca de ${formatarDuracao(total)}` : undefined }]
      }}
    />
  )
}
