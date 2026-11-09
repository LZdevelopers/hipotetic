import { useEffect, useRef, useState } from 'react'
import { Icone } from './Icone'

const tempo = (s) => {
  const v = Math.max(0, Math.round(s || 0))
  return `${Math.floor(v / 60)}:${String(v % 60).padStart(2, '0')}`
}

/**
 * Player compacto próprio (sem os controles do navegador): tocar/pausar,
 * barra clicável e tempo. Trocar a `url` mantém a posição e o estado de
 * reprodução — é o que permite comparar "antes" e "depois" no mesmo ponto.
 */
export function MiniPlayer({ url, rotulo = 'Áudio', duracao: conhecida = 0, className = '' }) {
  const audio = useRef(null)
  const barra = useRef(null)
  const preenchido = useRef(null)
  const relogio = useRef(null)
  const quadro = useRef(0)
  const [tocando, setTocando] = useState(false)
  const [duracao, setDuracao] = useState(0)
  const retomar = useRef(null)

  // Gravações do navegador (WebM) podem não informar a duração: usa a conhecida.
  const total = () => {
    const el = audio.current
    return el && Number.isFinite(el.duration) && el.duration > 0 ? el.duration : conhecida || duracao
  }
  const mostrar = () => {
    const el = audio.current
    if (!el) return
    const d = total()
    if (preenchido.current) preenchido.current.style.width = `${d ? Math.min(100, (el.currentTime / d) * 100) : 0}%`
    if (relogio.current) relogio.current.textContent = tempo(el.currentTime)
  }
  const laco = () => {
    mostrar()
    quadro.current = requestAnimationFrame(laco)
  }

  // Trocou o arquivo: guarda posição e estado para continuar do mesmo ponto.
  useEffect(() => {
    const el = audio.current
    if (!el || !url) return
    if (el.src && el.src !== url) retomar.current = { t: el.currentTime, tocar: !el.paused }
    el.src = url
  }, [url])

  useEffect(() => () => cancelAnimationFrame(quadro.current), [])

  const alternar = () => {
    const el = audio.current
    if (!el) return
    if (el.paused) el.play().catch(() => {})
    else el.pause()
  }
  const buscar = (e) => {
    const el = audio.current
    const r = barra.current.getBoundingClientRect()
    if (!el || !total()) return
    el.currentTime = Math.min(Math.max((e.clientX - r.left) / r.width, 0), 1) * total()
    mostrar()
  }

  return (
    <div className={`flex min-w-0 items-center gap-3 ${className}`}>
      <button
        type="button"
        onClick={alternar}
        aria-label={tocando ? `Pausar ${rotulo}` : `Tocar ${rotulo}`}
        className="grid size-9 shrink-0 place-items-center rounded-full bg-marca text-sobre-marca transition-colors hover:bg-marca-hover"
      >
        <Icone nome={tocando ? 'pausa' : 'play'} tamanho={15} className={tocando ? '' : 'translate-x-px'} fill="currentColor" />
      </button>
      <div
        ref={barra}
        role="slider"
        tabIndex={0}
        aria-label={`Posição em ${rotulo}`}
        aria-valuemin={0}
        aria-valuemax={Math.round(conhecida || duracao)}
        onPointerDown={buscar}
        onKeyDown={(e) => {
          const el = audio.current
          if (!el || !total()) return
          const d = { ArrowLeft: -5, ArrowRight: 5 }[e.key]
          if (!d) return
          e.preventDefault()
          el.currentTime = Math.min(Math.max(el.currentTime + d, 0), total())
          mostrar()
        }}
        className="group relative h-6 min-w-16 flex-1 cursor-pointer"
      >
        <div className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 overflow-hidden rounded-full bg-superficie-3">
          <div ref={preenchido} className="h-full w-0 rounded-full bg-cat-audio" />
        </div>
      </div>
      <span className="shrink-0 text-xs text-fraca tabular-nums">
        <span ref={relogio}>0:00</span> / {tempo(conhecida || duracao)}
      </span>
      <audio
        ref={audio}
        preload="metadata"
        className="hidden"
        onLoadedMetadata={(e) => {
          const el = e.currentTarget
          setDuracao(Number.isFinite(el.duration) ? el.duration : 0)
          const r = retomar.current
          retomar.current = null
          if (r) {
            el.currentTime = Math.min(r.t, el.duration || r.t)
            if (r.tocar) el.play().catch(() => {})
          }
          mostrar()
        }}
        onPlay={() => {
          setTocando(true)
          cancelAnimationFrame(quadro.current)
          quadro.current = requestAnimationFrame(laco)
        }}
        onPause={() => {
          setTocando(false)
          cancelAnimationFrame(quadro.current)
          mostrar()
        }}
        onEnded={() => setTocando(false)}
      />
    </div>
  )
}
