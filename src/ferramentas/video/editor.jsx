import { useEffect, useMemo, useRef, useState } from 'react'
import { Resultados } from '../../componentes/ferramenta/Resultados'
import { SeletorArquivos } from '../../componentes/ferramenta/SeletorArquivos'
import { Icone } from '../../componentes/Icone'
import { Aviso, Botao, Campo, Deslizante, Grupo, Progresso, Segmentado, Seletor } from '../../componentes/ui'
import { DESCRICAO_AUDIO, DESCRICAO_VIDEO, EXTENSOES_AUDIO, EXTENSOES_VIDEO, LIMITE_VIDEO, infoMidia, processarVideo } from '../../motores/midia'
import { formatarDuracao, trocarExtensao } from '../../nucleo/arquivos'
import { aplicarTrilha } from './_trilha'
import { useTarefa } from '../../nucleo/tarefa'
import { EscolhaFormatoVideo, Resolucao, medidasPara, nomeMotor } from './_comum'

const PROPORCOES = [
  { id: 'original', rotulo: 'Original', valor: null },
  { id: '9:16', rotulo: '9:16', valor: 9 / 16, dica: 'Reels, TikTok, Shorts' },
  { id: '1:1', rotulo: '1:1', valor: 1, dica: 'Feed quadrado' },
  { id: '4:5', rotulo: '4:5', valor: 4 / 5, dica: 'Feed do Instagram' },
  { id: '16:9', rotulo: '16:9', valor: 16 / 9, dica: 'YouTube, TV' },
]

/** "1:05.3" ↔ segundos */
const paraTexto = (s) => {
  const m = Math.floor(s / 60)
  return `${m}:${(s - m * 60).toFixed(1).padStart(4, '0')}`
}
const deTexto = (t) => {
  const p = String(t).replace(',', '.').split(':').map(Number)
  if (p.some((n) => Number.isNaN(n))) return null
  return p.length === 3 ? p[0] * 3600 + p[1] * 60 + p[2] : p.length === 2 ? p[0] * 60 + p[1] : p[0]
}

/** Retângulo (em pixels do vídeo) levado ao quadro já girado/espelhado — a ordem do motor. */
function recorteNoQuadroGirado(r, W, H, girar, espelhar) {
  let c
  if (girar === 90) c = { left: H - (r.y + r.h), top: r.x, width: r.h, height: r.w }
  else if (girar === 180) c = { left: W - (r.x + r.w), top: H - (r.y + r.h), width: r.w, height: r.h }
  else if (girar === 270) c = { left: r.y, top: W - (r.x + r.w), width: r.h, height: r.w }
  else c = { left: r.x, top: r.y, width: r.w, height: r.h }
  const larguraQuadro = girar === 90 || girar === 270 ? H : W
  if (espelhar) c.left = larguraQuadro - (c.left + c.width)
  return Object.fromEntries(Object.entries(c).map(([k, v]) => [k, Math.max(0, Math.round(v / 2) * 2)]))
}

/** Trilho de corte: dois marcadores (início/fim) e a posição atual. */
function Trilho({ duracao, inicio, fim, atual, aoMudar, aoBuscar }) {
  const trilho = useRef(null)
  const arrastar = (qual) => (e) => {
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    const mover = (ev) => {
      const r = trilho.current.getBoundingClientRect()
      const t = Math.min(Math.max(((ev.clientX - r.left) / r.width) * duracao, 0), duracao)
      if (qual === 'inicio') aoMudar({ inicio: Math.min(t, fim - 0.1) })
      else aoMudar({ fim: Math.max(t, inicio + 0.1) })
      aoBuscar(t)
    }
    const soltar = () => {
      e.target.removeEventListener('pointermove', mover)
      e.target.removeEventListener('pointerup', soltar)
    }
    e.target.addEventListener('pointermove', mover)
    e.target.addEventListener('pointerup', soltar)
  }
  const pct = (t) => `${(t / duracao) * 100}%`
  const teclas = (qual) => (e) => {
    const passo = e.shiftKey ? 1 : 0.1
    const d = { ArrowLeft: -passo, ArrowRight: passo }[e.key]
    if (!d) return
    e.preventDefault()
    if (qual === 'inicio') aoMudar({ inicio: Math.min(Math.max(0, inicio + d), fim - 0.1) })
    else aoMudar({ fim: Math.max(Math.min(duracao, fim + d), inicio + 0.1) })
  }
  return (
    <div
      ref={trilho}
      className="relative h-12 cursor-pointer touch-none rounded-lg bg-superficie-3"
      onPointerDown={(e) => {
        if (e.target !== e.currentTarget) return
        const r = e.currentTarget.getBoundingClientRect()
        aoBuscar(((e.clientX - r.left) / r.width) * duracao)
      }}
    >
      <div className="pointer-events-none absolute inset-y-0 rounded-md border-2 border-acento bg-acento/15" style={{ left: pct(inicio), width: `calc(${pct(fim)} - ${pct(inicio)})` }} />
      <div className="pointer-events-none absolute inset-y-0 w-0.5 bg-tinta" style={{ left: pct(atual) }} />
      {[
        ['inicio', inicio, 'Início do trecho'],
        ['fim', fim, 'Fim do trecho'],
      ].map(([qual, t, rotulo]) => (
        <span
          key={qual}
          role="slider"
          tabIndex={0}
          aria-label={rotulo}
          aria-valuemin={0}
          aria-valuemax={Math.round(duracao)}
          aria-valuenow={Math.round(t)}
          aria-valuetext={paraTexto(t)}
          onPointerDown={arrastar(qual)}
          onKeyDown={teclas(qual)}
          className="absolute inset-y-[-4px] w-3.5 -translate-x-1/2 cursor-ew-resize rounded-md bg-acento shadow"
          style={{ left: pct(t) }}
        />
      ))}
    </div>
  )
}

function Editor({ arquivo, aoTrocar }) {
  const url = useMemo(() => URL.createObjectURL(arquivo), [arquivo])
  useEffect(() => () => URL.revokeObjectURL(url), [url])
  const video = useRef(null)
  const caixa = useRef(null)
  const [info, setInfo] = useState(null)
  const [erroPrevia, setErroPrevia] = useState(false)
  const [atual, setAtual] = useState(0)
  const [o, setO] = useState({ inicio: 0, fim: 0, girar: 0, espelhar: false, proporcao: 'original', modoProporcao: 'cortar', recorte: null, resolucao: 0, velocidade: 1, som: 'original', volumeTrilha: 100, volumeOriginal: 60, formato: 'mp4' })
  const [trilha, setTrilha] = useState([])
  const tarefa = useTarefa()
  const mudar = (m) => setO((x) => ({ ...x, ...m }))

  useEffect(() => {
    let vivo = true
    infoMidia(arquivo)
      .then((i) => {
        if (!vivo) return
        setInfo(i)
        setO((x) => ({ ...x, fim: i.duracao ?? 0 }))
      })
      .catch(() => vivo && setInfo({ erro: true }))
    return () => {
      vivo = false
    }
  }, [arquivo])

  // A prévia toca só o trecho escolhido, na velocidade escolhida.
  useEffect(() => {
    const v = video.current
    if (!v) return
    v.playbackRate = o.velocidade
    v.muted = o.som === 'mudo' || o.som === 'trocar'
  }, [o.velocidade, o.som])
  const aoTempo = () => {
    const v = video.current
    setAtual(v.currentTime)
    if (o.fim && v.currentTime >= o.fim) {
      v.pause()
      v.currentTime = o.inicio
    }
  }
  const buscar = (t) => {
    if (video.current) video.current.currentTime = t
  }

  const W = info?.largura
  const H = info?.altura
  const proporcao = PROPORCOES.find((p) => p.id === o.proporcao)
  const escolherProporcao = (id) => {
    const p = PROPORCOES.find((x) => x.id === id)
    if (!p.valor || !W) return mudar({ proporcao: id, recorte: null })
    // Maior retângulo da proporção, centralizado (antes de girar).
    const deitado = o.girar === 90 || o.girar === 270
    const r = deitado ? 1 / p.valor : p.valor
    let w = W
    let h = w / r
    if (h > H) {
      h = H
      w = h * r
    }
    mudar({ proporcao: id, recorte: { x: (W - w) / 2, y: (H - h) / 2, w, h } })
  }

  const moverRecorte = (e) => {
    if (!o.recorte) return
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    const inicio = { x: e.clientX, y: e.clientY, r: o.recorte }
    const escala = W / caixa.current.clientWidth
    const mover = (ev) => {
      const dx = (ev.clientX - inicio.x) * escala
      const dy = (ev.clientY - inicio.y) * escala
      mudar({ recorte: { ...inicio.r, x: Math.min(Math.max(0, inicio.r.x + dx), W - inicio.r.w), y: Math.min(Math.max(0, inicio.r.y + dy), H - inicio.r.h) } })
    }
    const alvo = e.currentTarget
    const soltar = () => {
      alvo.removeEventListener('pointermove', mover)
      alvo.removeEventListener('pointerup', soltar)
    }
    alvo.addEventListener('pointermove', mover)
    alvo.addEventListener('pointerup', soltar)
  }

  const exportar = () =>
    tarefa.executar(async (ctx) => {
      const duracao = info?.duracao ?? 0
      const cortou = o.inicio > 0.05 || (duracao && o.fim < duracao - 0.05)
      const opcoes = {
        formato: o.formato,
        qualidade: 'alta',
        girar: o.girar,
        espelhar: o.espelhar,
        semAudio: o.som === 'mudo' || o.som === 'trocar',
        velocidade: o.velocidade,
        inicio: cortou ? o.inicio : undefined,
        fim: cortou ? o.fim : undefined,
      }
      if (proporcao.valor && o.modoProporcao === 'cortar' && o.recorte) {
        opcoes.recorte = recorteNoQuadroGirado(o.recorte, W, H, o.girar, o.espelhar)
        const final = medidasPara({ largura: opcoes.recorte.width, altura: opcoes.recorte.height }, o.resolucao)
        Object.assign(opcoes, final)
      } else if (proporcao.valor && o.modoProporcao === 'barras') {
        // Barras: o quadro final tem a proporção pedida e o vídeo inteiro dentro.
        const deitado = o.girar === 90 || o.girar === 270
        const [w0, h0] = deitado ? [H, W] : [W, H]
        let w = w0
        let h = Math.round(w / proporcao.valor)
        if (h < h0) {
          h = h0
          w = Math.round(h * proporcao.valor)
        }
        const final = medidasPara({ largura: w, altura: h }, o.resolucao)
        Object.assign(opcoes, { largura: final.largura ?? w, altura: final.altura ?? h, ajuste: 'contain' })
      } else {
        const deitado = o.girar === 90 || o.girar === 270
        Object.assign(opcoes, medidasPara(deitado ? { largura: H, altura: W } : info, o.resolucao))
      }
      let { blob, motor } = await processarVideo(arquivo, opcoes, ctx)
      if ((o.som === 'trocar' || o.som === 'misturar') && trilha[0]) {
        blob = await aplicarTrilha(blob, o.formato, trilha[0].arquivo, { modo: o.som === 'misturar' ? 'misturar' : 'substituir', volume: o.volumeTrilha, volumeOriginal: o.volumeOriginal }, ctx)
      }
      return [{ nome: trocarExtensao(arquivo.name, o.formato, '-editado'), blob, original: arquivo.size, detalhe: nomeMotor(motor) }]
    }, 'Preparando')

  if (info?.erro) return <Aviso tom="erro" titulo="Não foi possível ler este vídeo" acao={<Botao variante="secundario" tamanho="p" onClick={aoTrocar}>Escolher outro</Botao>} />
  if (tarefa.fase === 'pronto') return <Resultados itens={tarefa.resultado} duracao={tarefa.duracao} aoAjustar={tarefa.reiniciar} aoReiniciar={aoTrocar} rotuloNovo="Outro vídeo" />

  const processando = tarefa.fase === 'processando'
  const duracao = info?.duracao ?? 0
  const pct = (v, total) => `${(v / total) * 100}%`
  const mudouAlgo = o.inicio > 0.05 || (duracao && o.fim < duracao - 0.05) || o.girar || o.espelhar || o.proporcao !== 'original' || o.resolucao || o.velocidade !== 1 || o.som !== 'original' || o.formato !== 'mp4'

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
      <div className="flex min-w-0 flex-col gap-4">
        <div className="grid min-h-64 place-items-center overflow-hidden rounded-[var(--radius-cartao)] bg-black p-2">
          <div
            ref={caixa}
            className="relative max-w-full transition-transform duration-300"
            style={{ transform: `rotate(${o.girar}deg) scaleX(${o.espelhar ? -1 : 1})`, ...(o.girar % 180 ? { maxWidth: '55vh' } : {}) }}
          >
            <video
              ref={video}
              src={url}
              controls
              playsInline
              preload="metadata"
              onTimeUpdate={aoTempo}
              onError={() => setErroPrevia(true)}
              className="block max-h-[55vh] max-w-full"
            />
            {o.recorte && o.modoProporcao === 'cortar' && W ? (
              <>
                <div
                  className="pointer-events-none absolute inset-0 bg-black/60"
                  style={{
                    clipPath: `polygon(0 0,100% 0,100% 100%,0 100%,0 0,${pct(o.recorte.x, W)} ${pct(o.recorte.y, H)},${pct(o.recorte.x, W)} ${pct(o.recorte.y + o.recorte.h, H)},${pct(o.recorte.x + o.recorte.w, W)} ${pct(o.recorte.y + o.recorte.h, H)},${pct(o.recorte.x + o.recorte.w, W)} ${pct(o.recorte.y, H)},${pct(o.recorte.x, W)} ${pct(o.recorte.y, H)})`,
                  }}
                />
                <div
                  onPointerDown={moverRecorte}
                  aria-label="Área do recorte (arraste para posicionar)"
                  className="absolute cursor-move touch-none border-2 border-white"
                  style={{ left: pct(o.recorte.x, W), top: pct(o.recorte.y, H), width: pct(o.recorte.w, W), height: pct(o.recorte.h, H) }}
                />
              </>
            ) : null}
          </div>
        </div>
        {erroPrevia ? <Aviso tom="info">O navegador não consegue mostrar a prévia deste formato, mas a edição funciona normalmente.</Aviso> : null}

        {duracao ? (
          <div className="cartao flex flex-col gap-3 p-4">
            <div className="flex items-center justify-between text-xs text-fraca tabular-nums">
              <span>Trecho: {paraTexto(o.inicio)} → {paraTexto(o.fim)}</span>
              <span>Duração final: {formatarDuracao((o.fim - o.inicio) / o.velocidade)}</span>
            </div>
            <Trilho duracao={duracao} inicio={o.inicio} fim={o.fim} atual={atual} aoMudar={mudar} aoBuscar={buscar} />
            <div className="flex flex-wrap items-end gap-2">
              <Campo rotulo="Início" className="w-28">
                <input className="h-9 rounded-lg border border-borda-forte bg-superficie px-2 text-sm tabular-nums" defaultValue={paraTexto(o.inicio)} key={`i${o.inicio}`} onBlur={(e) => { const t = deTexto(e.target.value); if (t != null && t < o.fim) mudar({ inicio: Math.max(0, t) }) }} aria-label="Início (minutos:segundos)" />
              </Campo>
              <Campo rotulo="Fim" className="w-28">
                <input className="h-9 rounded-lg border border-borda-forte bg-superficie px-2 text-sm tabular-nums" defaultValue={paraTexto(o.fim)} key={`f${o.fim}`} onBlur={(e) => { const t = deTexto(e.target.value); if (t != null && t > o.inicio) mudar({ fim: Math.min(duracao, t) }) }} aria-label="Fim (minutos:segundos)" />
              </Campo>
              <Botao variante="secundario" tamanho="p" onClick={() => mudar({ inicio: Math.min(atual, o.fim - 0.1) })}>
                Início aqui
              </Botao>
              <Botao variante="secundario" tamanho="p" onClick={() => mudar({ fim: Math.max(atual, o.inicio + 0.1) })}>
                Fim aqui
              </Botao>
            </div>
          </div>
        ) : (
          <div className="esqueleto h-28 rounded-[var(--radius-cartao)]" />
        )}
      </div>

      <aside className="cartao flex flex-col gap-5 p-4 lg:sticky lg:top-20">
        <div className={processando ? 'pointer-events-none flex flex-col gap-5 opacity-60' : 'flex flex-col gap-5'}>
          <Grupo titulo="Girar e espelhar">
            <div className="flex gap-2">
              <Botao variante="secundario" tamanho="p" icone="girar" onClick={() => mudar({ girar: (o.girar + 90) % 360, recorte: null, proporcao: 'original' })}>
                Girar
              </Botao>
              <Botao variante={o.espelhar ? 'primario' : 'secundario'} tamanho="p" icone="espelhar" aria-pressed={o.espelhar} onClick={() => mudar({ espelhar: !o.espelhar })}>
                Espelhar
              </Botao>
              {o.girar ? <span className="self-center text-xs text-fraca">{o.girar}°</span> : null}
            </div>
          </Grupo>
          <Grupo titulo="Proporção">
            <div className="grid grid-cols-5 gap-1">
              {PROPORCOES.map((p) => (
                <button key={p.id} type="button" title={p.dica} aria-pressed={o.proporcao === p.id} onClick={() => escolherProporcao(p.id)} className={`h-8 rounded-md border text-[0.6875rem] font-semibold ${o.proporcao === p.id ? 'border-marca bg-marca text-sobre-marca' : 'border-borda text-suave hover:text-tinta'}`}>
                  {p.rotulo}
                </button>
              ))}
            </div>
            {proporcao.valor ? (
              <Segmentado
                className="mt-3"
                valor={o.modoProporcao}
                aoMudar={(v) => mudar({ modoProporcao: v })}
                opcoes={[
                  { valor: 'cortar', rotulo: 'Cortar' },
                  { valor: 'barras', rotulo: 'Barras pretas' },
                ]}
                dica={o.modoProporcao === 'cortar' ? 'Arraste a área clara no vídeo para escolher o enquadramento.' : 'O vídeo inteiro aparece, com barras nas sobras.'}
              />
            ) : null}
          </Grupo>
          <Resolucao valor={o.resolucao} aoMudar={(v) => mudar({ resolucao: v })} />
          <Seletor
            rotulo="Velocidade"
            valor={String(o.velocidade)}
            aoMudar={(v) => mudar({ velocidade: Number(v) })}
            opcoes={[0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4].map((v) => ({ valor: String(v), rotulo: v === 1 ? 'Normal (1×)' : `${v.toLocaleString('pt-BR')}×` }))}
            dica={o.velocidade !== 1 ? 'Mudar a velocidade usa o WebAssembly: é mais demorado.' : undefined}
          />
          <Grupo titulo="Som">
            <div className="flex flex-col gap-3">
              <Seletor
                valor={o.som}
                aoMudar={(v) => mudar({ som: v })}
                opcoes={[
                  { valor: 'original', rotulo: 'Manter o som original' },
                  { valor: 'mudo', rotulo: 'Sem som (silenciar)' },
                  { valor: 'trocar', rotulo: 'Trocar por uma música' },
                  { valor: 'misturar', rotulo: 'Misturar com uma música' },
                ]}
              />
              {o.som === 'trocar' || o.som === 'misturar' ? (
                <>
                  <SeletorArquivos arquivos={trilha} aoMudar={setTrilha} multiplos={false} extensoes={EXTENSOES_AUDIO} descricaoFormatos={DESCRICAO_AUDIO} compacto />
                  <Deslizante rotulo="Volume da música" valor={o.volumeTrilha} aoMudar={(v) => mudar({ volumeTrilha: v })} min={0} max={200} formatar={(v) => `${v}%`} />
                  {o.som === 'misturar' ? <Deslizante rotulo="Volume do som original" valor={o.volumeOriginal} aoMudar={(v) => mudar({ volumeOriginal: v })} min={0} max={200} formatar={(v) => `${v}%`} /> : null}
                </>
              ) : null}
            </div>
          </Grupo>
          <EscolhaFormatoVideo valor={o.formato} aoMudar={(v) => mudar({ formato: v })} />
        </div>
        {tarefa.fase === 'erro' ? <Aviso tom="erro">{tarefa.mensagem}</Aviso> : null}
        {processando ? (
          <Progresso valor={tarefa.progresso} rotulo={tarefa.rotulo} aoCancelar={tarefa.cancelar} />
        ) : (
          <div className="flex gap-2">
            <Botao variante="secundario" onClick={aoTrocar}>
              Trocar
            </Botao>
            <Botao className="flex-1" icone="baixar" onClick={exportar} disabled={!info || !mudouAlgo || ((o.som === 'trocar' || o.som === 'misturar') && !trilha.length)}>
              Exportar vídeo
            </Botao>
          </div>
        )}
        {!mudouAlgo && info ? (
          <p className="-mt-2 flex items-center gap-1.5 text-xs text-fraca">
            <Icone nome="info" tamanho={13} />
            Faça pelo menos uma alteração.
          </p>
        ) : null}
      </aside>
    </div>
  )
}

/** Editor de vídeo: trecho, proporção, girar, resolução, velocidade, som e formato numa página só. */
export default function EditorVideo() {
  const [arquivos, setArquivos] = useState([])
  if (!arquivos.length) return <SeletorArquivos arquivos={arquivos} aoMudar={setArquivos} multiplos={false} extensoes={EXTENSOES_VIDEO} descricaoFormatos={DESCRICAO_VIDEO} limiteBytes={LIMITE_VIDEO} />
  return <Editor key={arquivos[0].id} arquivo={arquivos[0].arquivo} aoTrocar={() => setArquivos([])} />
}
