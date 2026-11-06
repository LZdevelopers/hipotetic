import { useEffect, useMemo, useRef, useState } from 'react'
import { Resultados } from '../../componentes/ferramenta/Resultados'
import { SeletorArquivos } from '../../componentes/ferramenta/SeletorArquivos'
import { Aviso, Botao, Deslizante, Progresso } from '../../componentes/ui'
import { DESCRICAO_AUDIO, EXTENSOES_AUDIO, EXTENSOES_VIDEO, LIMITE_AUDIO, infoMidia, processarAudio } from '../../motores/midia'
import { extensaoDe, formatarDuracao, trocarExtensao } from '../../nucleo/arquivos'
import { useTarefa } from '../../nucleo/tarefa'
import { Bitrate, FormatoAudio } from './_comum'

const tempo = (s) => {
  const m = Math.floor(s / 60)
  return `${m}:${(s - m * 60).toFixed(1).padStart(4, '0')}`
}

/** Picos da forma de onda (Web Audio). null se o navegador não decodificar o formato. */
async function picos(arquivo, colunas = 600) {
  try {
    const ctx = new OfflineAudioContext(1, 1, 44100)
    const buf = await ctx.decodeAudioData(await arquivo.arrayBuffer())
    const dados = buf.getChannelData(0)
    const passo = Math.max(1, Math.floor(dados.length / colunas))
    const p = []
    for (let i = 0; i < colunas; i += 1) {
      let max = 0
      for (let j = i * passo; j < Math.min((i + 1) * passo, dados.length); j += 4) max = Math.max(max, Math.abs(dados[j]))
      p.push(max)
    }
    const topo = Math.max(...p, 0.01)
    return p.map((v) => v / topo)
  } catch {
    return null
  }
}

function Editor({ arquivo, aoTrocar }) {
  const url = useMemo(() => URL.createObjectURL(arquivo), [arquivo])
  useEffect(() => () => URL.revokeObjectURL(url), [url])
  const audio = useRef(null)
  const area = useRef(null)
  const [duracao, setDuracao] = useState(0)
  const [onda, setOnda] = useState(undefined)
  const [atual, setAtual] = useState(0)
  const [o, setO] = useState({ inicio: 0, fim: 0, fadeIn: 0, fadeOut: 0, formato: ['mp3', 'wav', 'ogg', 'flac', 'm4a'].includes(extensaoDe(arquivo.name)) ? extensaoDe(arquivo.name) : 'mp3', bitrate: 192 })
  const tarefa = useTarefa()
  const mudar = (m) => setO((x) => ({ ...x, ...m }))

  useEffect(() => {
    let vivo = true
    infoMidia(arquivo).then((i) => {
      if (!vivo) return
      setDuracao(i.duracao ?? 0)
      setO((x) => ({ ...x, fim: i.duracao ?? 0 }))
    })
    picos(arquivo).then((p) => vivo && setOnda(p))
    return () => {
      vivo = false
    }
  }, [arquivo])

  const deX = (clientX) => {
    const r = area.current.getBoundingClientRect()
    return Math.min(Math.max(((clientX - r.left) / r.width) * duracao, 0), duracao)
  }
  const arrastar = (qual) => (e) => {
    e.preventDefault()
    e.stopPropagation()
    e.currentTarget.setPointerCapture(e.pointerId)
    const alvo = e.currentTarget
    const mover = (ev) => {
      const t = deX(ev.clientX)
      setO((x) => (qual === 'inicio' ? { ...x, inicio: Math.min(t, x.fim - 0.1) } : { ...x, fim: Math.max(t, x.inicio + 0.1) }))
    }
    const soltar = () => {
      alvo.removeEventListener('pointermove', mover)
      alvo.removeEventListener('pointerup', soltar)
    }
    alvo.addEventListener('pointermove', mover)
    alvo.addEventListener('pointerup', soltar)
  }
  const ouvirTrecho = () => {
    const a = audio.current
    a.currentTime = o.inicio
    a.play()
  }

  const exportar = () =>
    tarefa.executar((ctx) => {
      const trecho = o.fim - o.inicio
      const filtros = [o.fadeIn ? `afade=t=in:st=0:d=${o.fadeIn}` : null, o.fadeOut ? `afade=t=out:st=${Math.max(0, trecho - o.fadeOut)}:d=${o.fadeOut}` : null].filter(Boolean).join(',') || undefined
      return processarAudio(arquivo, { formato: o.formato, bitrate: o.bitrate, inicio: o.inicio, fim: o.fim, filtros }, ctx, trecho).then((blob) => [
        { nome: trocarExtensao(arquivo.name, o.formato, '-trecho'), blob, detalhe: `${tempo(o.inicio)} → ${tempo(o.fim)} (${formatarDuracao(trecho)})` },
      ])
    }, 'Cortando')

  if (tarefa.fase === 'pronto') return <Resultados itens={tarefa.resultado} duracao={tarefa.duracao} aoAjustar={tarefa.reiniciar} aoReiniciar={aoTrocar} rotuloNovo="Outro áudio" />

  const pct = (t) => `${duracao ? (t / duracao) * 100 : 0}%`
  const processando = tarefa.fase === 'processando'
  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
      <div className="flex min-w-0 flex-col gap-4">
        <div className="cartao p-4">
          <div
            ref={area}
            className="relative h-36 cursor-pointer touch-none overflow-hidden rounded-lg bg-fundo-suave"
            onPointerDown={(e) => {
              if (audio.current) audio.current.currentTime = deX(e.clientX)
            }}
          >
            {onda ? (
              <div className="absolute inset-0 flex items-center gap-px px-px">
                {onda.map((v, i) => {
                  const t = (i / onda.length) * duracao
                  const dentro = t >= o.inicio && t <= o.fim
                  return <span key={i} className={`flex-1 rounded-full ${dentro ? 'bg-cat-audio' : 'bg-borda-forte'}`} style={{ height: `${Math.max(2, v * 100)}%` }} />
                })}
              </div>
            ) : onda === null ? (
              <p className="absolute inset-0 grid place-items-center text-xs text-fraca">Forma de onda indisponível para este formato — o corte funciona normalmente.</p>
            ) : (
              <div className="esqueleto absolute inset-0" />
            )}
            <div className="pointer-events-none absolute inset-y-0 left-0 bg-fundo/60" style={{ width: pct(o.inicio) }} />
            <div className="pointer-events-none absolute inset-y-0 right-0 bg-fundo/60" style={{ left: pct(o.fim) }} />
            <div className="pointer-events-none absolute inset-y-0 w-0.5 bg-tinta" style={{ left: pct(atual) }} />
            {[
              ['inicio', o.inicio],
              ['fim', o.fim],
            ].map(([qual, t]) => (
              <span
                key={qual}
                role="slider"
                tabIndex={0}
                aria-label={qual === 'inicio' ? 'Início do trecho' : 'Fim do trecho'}
                aria-valuetext={tempo(t)}
                aria-valuenow={Math.round(t)}
                onPointerDown={arrastar(qual)}
                onKeyDown={(e) => {
                  const d = { ArrowLeft: -0.1, ArrowRight: 0.1 }[e.key]
                  if (!d) return
                  e.preventDefault()
                  setO((x) => (qual === 'inicio' ? { ...x, inicio: Math.min(Math.max(0, x.inicio + d * (e.shiftKey ? 10 : 1)), x.fim - 0.1) } : { ...x, fim: Math.max(Math.min(duracao, x.fim + d * (e.shiftKey ? 10 : 1)), x.inicio + 0.1) }))
                }}
                className="absolute inset-y-0 w-3 -translate-x-1/2 cursor-ew-resize rounded bg-acento shadow"
                style={{ left: pct(t) }}
              />
            ))}
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-fraca tabular-nums">
            <span>
              Trecho: {tempo(o.inicio)} → {tempo(o.fim)} · {formatarDuracao(o.fim - o.inicio)}
            </span>
            <div className="flex gap-2">
              <Botao variante="secundario" tamanho="p" onClick={() => mudar({ inicio: Math.min(atual, o.fim - 0.1) })}>
                Início aqui
              </Botao>
              <Botao variante="secundario" tamanho="p" onClick={() => mudar({ fim: Math.max(atual, o.inicio + 0.1) })}>
                Fim aqui
              </Botao>
              <Botao tamanho="p" icone="play" onClick={ouvirTrecho}>
                Ouvir trecho
              </Botao>
            </div>
          </div>
          <audio
            ref={audio}
            src={url}
            controls
            className="mt-3 w-full"
            onTimeUpdate={(e) => {
              setAtual(e.currentTarget.currentTime)
              if (e.currentTarget.currentTime >= o.fim && !e.currentTarget.paused) e.currentTarget.pause()
            }}
          />
        </div>
      </div>
      <aside className="cartao flex flex-col gap-5 p-4 lg:sticky lg:top-20">
        <div className={processando ? 'pointer-events-none flex flex-col gap-5 opacity-60' : 'flex flex-col gap-5'}>
          <Deslizante rotulo="Entrada suave (fade in)" valor={o.fadeIn} aoMudar={(v) => mudar({ fadeIn: v })} min={0} max={10} passo={0.5} formatar={(v) => `${v.toLocaleString('pt-BR')} s`} />
          <Deslizante rotulo="Saída suave (fade out)" valor={o.fadeOut} aoMudar={(v) => mudar({ fadeOut: v })} min={0} max={10} passo={0.5} formatar={(v) => `${v.toLocaleString('pt-BR')} s`} />
          <FormatoAudio valor={o.formato} aoMudar={(v) => mudar({ formato: v })} />
          <Bitrate valor={o.bitrate} aoMudar={(v) => mudar({ bitrate: v })} formato={o.formato} />
        </div>
        {tarefa.fase === 'erro' ? <Aviso tom="erro">{tarefa.mensagem}</Aviso> : null}
        {processando ? (
          <Progresso valor={tarefa.progresso} rotulo={tarefa.rotulo} aoCancelar={tarefa.cancelar} />
        ) : (
          <div className="flex gap-2">
            <Botao variante="secundario" onClick={aoTrocar}>
              Trocar
            </Botao>
            <Botao className="flex-1" icone="cortar" onClick={exportar} disabled={!duracao}>
              Cortar
            </Botao>
          </div>
        )}
      </aside>
    </div>
  )
}

export default function CortarAudio() {
  const [arquivos, setArquivos] = useState([])
  if (!arquivos.length) return <SeletorArquivos arquivos={arquivos} aoMudar={setArquivos} multiplos={false} extensoes={[...EXTENSOES_AUDIO, ...EXTENSOES_VIDEO]} descricaoFormatos={`${DESCRICAO_AUDIO} (ou vídeo)`} limiteBytes={LIMITE_AUDIO} />
  return <Editor key={arquivos[0].id} arquivo={arquivos[0].arquivo} aoTrocar={() => setArquivos([])} />
}
