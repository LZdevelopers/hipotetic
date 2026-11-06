import { useState } from 'react'
import { Resultados } from '../../componentes/ferramenta/Resultados'
import { SeletorArquivos } from '../../componentes/ferramenta/SeletorArquivos'
import { Aviso, Botao, Caixa, Campo, Deslizante, Progresso, Segmentado } from '../../componentes/ui'
import { executarFfmpeg } from '../../motores/ffmpeg'
import { DESCRICAO_AUDIO, DESCRICAO_VIDEO, EXTENSOES_AUDIO, EXTENSOES_VIDEO, LIMITE_VIDEO, infoMidia } from '../../motores/midia'
import { extensaoDe, trocarExtensao } from '../../nucleo/arquivos'
import { useTarefa } from '../../nucleo/tarefa'

/**
 * Coloca uma trilha de áudio (música, narração) num vídeo: substitui o som
 * original ou mistura os dois. A imagem não é recodificada (rápido).
 */
export default function AdicionarAudio() {
  const [video, setVideo] = useState([])
  const [audio, setAudio] = useState([])
  const [o, setO] = useState({ modo: 'substituir', volume: 100, volumeOriginal: 60, repetir: true })
  const tarefa = useTarefa()

  const executar = () =>
    tarefa.executar(async ({ progresso, sinal }) => {
      const v = video[0].arquivo
      const a = audio[0].arquivo
      const info = await infoMidia(v)
      const nv = `video.${extensaoDe(v.name) || 'mp4'}`
      const na = `audio.${extensaoDe(a.name) || 'mp3'}`
      const args = ['-i', nv, ...(o.repetir ? ['-stream_loop', '-1'] : []), '-i', na]
      const vol = (o.volume / 100).toFixed(2)
      if (o.modo === 'misturar' && info.temAudio) {
        args.push('-filter_complex', `[0:a]volume=${(o.volumeOriginal / 100).toFixed(2)}[o];[1:a]volume=${vol}[n];[o][n]amix=inputs=2:duration=first:dropout_transition=0[a]`, '-map', '0:v:0', '-map', '[a]')
      } else {
        args.push('-map', '0:v:0', '-map', '1:a:0', '-af', `volume=${vol}`)
      }
      // A imagem é copiada como está; só o áudio é codificado (AAC). -t corta no fim do vídeo.
      args.push('-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-t', String(info.duracao ?? 0), '-movflags', '+faststart')
      const dados = await executarFfmpeg({
        entradas: [
          { nome: nv, dados: v },
          { nome: na, dados: a },
        ],
        args,
        saida: 'saida.mp4',
        duracao: info.duracao,
        aoProgredir: progresso,
        sinal,
        rotulo: 'Juntando vídeo e áudio',
      })
      return [{ nome: trocarExtensao(v.name, 'mp4', '-com-audio'), blob: new Blob([dados], { type: 'video/mp4' }) }]
    }, 'Preparando')

  if (tarefa.fase === 'pronto')
    return (
      <Resultados
        itens={tarefa.resultado}
        duracao={tarefa.duracao}
        aoAjustar={tarefa.reiniciar}
        aoReiniciar={() => {
          setVideo([])
          setAudio([])
          tarefa.reiniciar()
        }}
      />
    )

  const processando = tarefa.fase === 'processando'
  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
      <div className="flex flex-col gap-5">
        <Campo rotulo="1. O vídeo">
          <SeletorArquivos arquivos={video} aoMudar={setVideo} multiplos={false} extensoes={EXTENSOES_VIDEO} descricaoFormatos={DESCRICAO_VIDEO} limiteBytes={LIMITE_VIDEO} compacto />
        </Campo>
        <Campo rotulo="2. O áudio (música, narração…)">
          <SeletorArquivos arquivos={audio} aoMudar={setAudio} multiplos={false} extensoes={[...EXTENSOES_AUDIO, ...EXTENSOES_VIDEO]} descricaoFormatos={`${DESCRICAO_AUDIO} ou vídeo`} compacto />
        </Campo>
      </div>
      <aside className="cartao flex flex-col gap-5 p-4 sm:p-5">
        <Segmentado
          rotulo="O som original do vídeo"
          valor={o.modo}
          aoMudar={(v) => setO((x) => ({ ...x, modo: v }))}
          opcoes={[
            { valor: 'substituir', rotulo: 'Substituir' },
            { valor: 'misturar', rotulo: 'Misturar' },
          ]}
        />
        <Deslizante rotulo="Volume do áudio novo" valor={o.volume} aoMudar={(v) => setO((x) => ({ ...x, volume: v }))} min={0} max={200} formatar={(v) => `${v}%`} />
        {o.modo === 'misturar' ? <Deslizante rotulo="Volume do som original" valor={o.volumeOriginal} aoMudar={(v) => setO((x) => ({ ...x, volumeOriginal: v }))} min={0} max={200} formatar={(v) => `${v}%`} /> : null}
        <Caixa rotulo="Repetir o áudio se for mais curto que o vídeo" marcado={o.repetir} aoMudar={(v) => setO((x) => ({ ...x, repetir: v }))} />
        {tarefa.fase === 'erro' ? <Aviso tom="erro">{tarefa.mensagem}</Aviso> : null}
        {processando ? (
          <Progresso valor={tarefa.progresso} rotulo={tarefa.rotulo} aoCancelar={tarefa.cancelar} />
        ) : (
          <Botao tamanho="g" icone="musica" onClick={executar} disabled={!video.length || !audio.length}>
            Adicionar áudio
          </Botao>
        )}
      </aside>
    </div>
  )
}
