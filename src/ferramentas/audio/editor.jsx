import { useEffect, useMemo, useRef, useState } from 'react'
import { Resultados } from '../../componentes/ferramenta/Resultados'
import { SeletorArquivos } from '../../componentes/ferramenta/SeletorArquivos'
import { Aviso, Botao, Caixa, Deslizante, Grupo, Progresso, Segmentado, Seletor } from '../../componentes/ui'
import { DESCRICAO_AUDIO, EXTENSOES_AUDIO, EXTENSOES_VIDEO, LIMITE_AUDIO, filtroVelocidadeAudio, infoMidia, processarAudio } from '../../motores/midia'
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
  const [o, setO] = useState({ inicio: 0, fim: 0, fadeIn: 0, fadeOut: 0, formato: ['mp3', 'wav', 'ogg', 'flac', 'm4a'].includes(extensaoDe(arquivo.name)) ? extensaoDe(arquivo.name) : 'mp3', bitrate: 192, volume: 'manter', ganho: 6, silencio: false, silencioOnde: 'pontas', limiar: -45, velocidade: 1, tom: false })
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
      // Ordem: fades no trecho → tirar silêncio → velocidade → volume.
      const ponta = `silenceremove=start_periods=1:start_duration=0.05:start_threshold=${o.limiar}dB`
      const filtros = [
        o.fadeIn ? `afade=t=in:st=0:d=${o.fadeIn}` : null,
        o.fadeOut ? `afade=t=out:st=${Math.max(0, trecho - o.fadeOut)}:d=${o.fadeOut}` : null,
        o.silencio ? (o.silencioOnde === 'tudo' ? `${ponta},silenceremove=stop_periods=-1:stop_duration=0.5:stop_threshold=${o.limiar}dB` : `${ponta},areverse,${ponta},areverse`) : null,
        o.velocidade !== 1 ? (o.tom ? `asetrate=44100*${o.velocidade},aresample=44100` : filtroVelocidadeAudio(o.velocidade)) : null,
        o.volume === 'ganho' ? `volume=${o.ganho}dB,alimiter=limit=0.98` : o.volume === 'normalizar' ? 'loudnorm=I=-14:TP=-1.5:LRA=11' : null,
      ]
        .filter(Boolean)
        .join(',')
      const inteiro = o.inicio < 0.05 && o.fim > duracao - 0.05
      return processarAudio(arquivo, { formato: o.formato, bitrate: o.bitrate, inicio: inteiro ? undefined : o.inicio, fim: inteiro ? undefined : o.fim, filtros: filtros || undefined }, ctx, trecho / o.velocidade).then(async (blob) => {
        const final = await infoMidia(new File([blob], `x.${o.formato}`)).catch(() => ({}))
        return [{ nome: trocarExtensao(arquivo.name, o.formato, '-editado'), blob, detalhe: final.duracao ? `${formatarDuracao(final.duracao)} de áudio` : undefined }]
      })
    }, 'Processando')

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
          <Grupo titulo="Volume">
            <Segmentado
              valor={o.volume}
              aoMudar={(v) => mudar({ volume: v })}
              opcoes={[
                { valor: 'manter', rotulo: 'Manter' },
                { valor: 'ganho', rotulo: 'Ajustar' },
                { valor: 'normalizar', rotulo: 'Normalizar' },
              ]}
              dica={o.volume === 'normalizar' ? 'Padrão de streaming (−14 LUFS): volume igual entre faixas, sem distorcer.' : undefined}
            />
            {o.volume === 'ganho' ? <Deslizante className="mt-3" rotulo="Ganho" valor={o.ganho} aoMudar={(v) => mudar({ ganho: v })} min={-20} max={20} formatar={(v) => `${v > 0 ? '+' : ''}${v} dB`} /> : null}
          </Grupo>
          <Grupo titulo="Silêncio">
            <Caixa rotulo="Remover silêncio" marcado={o.silencio} aoMudar={(v) => mudar({ silencio: v })} />
            {o.silencio ? (
              <div className="mt-3 flex flex-col gap-3">
                <Segmentado
                  valor={o.silencioOnde}
                  aoMudar={(v) => mudar({ silencioOnde: v })}
                  opcoes={[
                    { valor: 'pontas', rotulo: 'Início e fim' },
                    { valor: 'tudo', rotulo: 'Todas as pausas' },
                  ]}
                />
                <Deslizante rotulo="O que conta como silêncio" valor={o.limiar} aoMudar={(v) => mudar({ limiar: v })} min={-70} max={-20} formatar={(v) => `${v} dB`} />
              </div>
            ) : null}
          </Grupo>
          <Grupo titulo="Velocidade">
            <Seletor valor={String(o.velocidade)} aoMudar={(v) => mudar({ velocidade: Number(v) })} opcoes={[0.5, 0.75, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2, 3].map((v) => ({ valor: String(v), rotulo: v === 1 ? 'Normal (1×)' : `${v.toLocaleString('pt-BR')}×` }))} />
            {o.velocidade !== 1 ? <Caixa className="mt-3" rotulo="Mudar o tom junto" dica="Desmarcado, a voz continua natural." marcado={o.tom} aoMudar={(v) => mudar({ tom: v })} /> : null}
          </Grupo>
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
            <Botao className="flex-1" icone="baixar" onClick={exportar} disabled={!duracao}>
              Aplicar e baixar
            </Botao>
          </div>
        )}
      </aside>
    </div>
  )
}

/** Editor de áudio: trecho, fades, volume, silêncio e velocidade numa página só. */
export default function EditorAudio() {
  const [arquivos, setArquivos] = useState([])
  if (!arquivos.length) return <SeletorArquivos arquivos={arquivos} aoMudar={setArquivos} multiplos={false} extensoes={[...EXTENSOES_AUDIO, ...EXTENSOES_VIDEO]} descricaoFormatos={`${DESCRICAO_AUDIO} (ou vídeo)`} limiteBytes={LIMITE_AUDIO} />
  return <Editor key={arquivos[0].id} arquivo={arquivos[0].arquivo} aoTrocar={() => setArquivos([])} />
}
