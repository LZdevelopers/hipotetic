import { useEffect, useId, useRef, useState } from 'react'
import { Icone } from './Icone'

/**
 * Seletor de cor do site (no lugar do <input type="color"> do sistema, que
 * muda de cara em cada navegador): amostra + código; ao abrir, quadrado de
 * saturação/brilho, faixa de matiz, campo hex, conta-gotas (quando o
 * navegador tem) e cores prontas/recentes. Abre embaixo, dentro do próprio
 * painel (sem janela flutuante que some atrás da rolagem).
 */

const PRONTAS = ['#ffffff', '#000000', '#6b7280', '#ef4444', '#f97316', '#facc15', '#22c55e', '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899', '#a16207']
const RECENTES = 'hipotetic:cores-recentes'

const limitar = (v, a, b) => Math.min(b, Math.max(a, v))

function hexParaRgb(hex) {
  let h = String(hex).trim().replace(/^#/, '')
  if (h.length === 3) h = [...h].map((c) => c + c).join('')
  if (!/^[0-9a-f]{6}$/i.test(h)) return null
  const n = parseInt(h, 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}
const rgbParaHex = (r, g, b) => `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`

function rgbParaHsv(r, g, b) {
  const [R, G, B] = [r / 255, g / 255, b / 255]
  const max = Math.max(R, G, B)
  const d = max - Math.min(R, G, B)
  let h = 0
  if (d) {
    if (max === R) h = ((G - B) / d) % 6
    else if (max === G) h = (B - R) / d + 2
    else h = (R - G) / d + 4
    h = (h * 60 + 360) % 360
  }
  return [h, max ? d / max : 0, max]
}
function hsvParaRgb(h, s, v) {
  const f = (n) => {
    const k = (n + h / 60) % 6
    return v - v * s * Math.max(0, Math.min(k, 4 - k, 1))
  }
  return [f(5) * 255, f(3) * 255, f(1) * 255]
}

const lerRecentes = () => {
  try {
    return JSON.parse(localStorage.getItem(RECENTES) ?? '[]').filter((c) => hexParaRgb(c))
  } catch {
    return []
  }
}
const guardarRecente = (cor) => {
  try {
    const lista = [cor, ...lerRecentes().filter((c) => c !== cor)].slice(0, 8)
    localStorage.setItem(RECENTES, JSON.stringify(lista))
  } catch {
    /* sem armazenamento: só não lembra */
  }
}

/** Arrasto com o ponteiro numa área: chama `aoMover(fx, fy)` com frações 0–1. */
function useArrasto(aoMover, aoSoltar) {
  return (e) => {
    if (e.button !== 0) return
    e.preventDefault()
    const el = e.currentTarget
    const mover = (ev) => {
      const r = el.getBoundingClientRect()
      aoMover(limitar((ev.clientX - r.left) / r.width, 0, 1), limitar((ev.clientY - r.top) / r.height, 0, 1))
    }
    mover(e)
    el.setPointerCapture?.(e.pointerId)
    const fim = () => {
      el.removeEventListener('pointermove', mover)
      el.removeEventListener('pointerup', fim)
      el.removeEventListener('pointercancel', fim)
      aoSoltar?.()
    }
    el.addEventListener('pointermove', mover)
    el.addEventListener('pointerup', fim)
    el.addEventListener('pointercancel', fim)
  }
}

export function SeletorCor({ valor, aoMudar, rotulo = 'Cor', dica }) {
  const id = useId()
  const [aberto, setAberto] = useState(false)
  const [hsv, setHsv] = useState(() => rgbParaHsv(...(hexParaRgb(valor) ?? [255, 255, 255])))
  const [texto, setTexto] = useState(valor)
  const [recentes, setRecentes] = useState([])
  const raiz = useRef(null)
  const atual = rgbParaHex(...hsvParaRgb(...hsv))

  // Mudou por fora (ou ao abrir): acompanha, sem perder o matiz em cinzas.
  useEffect(() => {
    setTexto(valor)
    const rgb = hexParaRgb(valor)
    if (rgb && rgbParaHex(...rgb) !== atual) {
      const [h, s, v] = rgbParaHsv(...rgb)
      setHsv((x) => [s && v ? h : x[0], s, v])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valor])

  useEffect(() => {
    if (!aberto) return undefined
    setRecentes(lerRecentes())
    const fora = (e) => {
      if (!raiz.current?.contains(e.target)) setAberto(false)
    }
    const tecla = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        setAberto(false)
      }
    }
    document.addEventListener('pointerdown', fora)
    raiz.current?.addEventListener('keydown', tecla)
    const el = raiz.current
    return () => {
      document.removeEventListener('pointerdown', fora)
      el?.removeEventListener('keydown', tecla)
    }
  }, [aberto])

  const escolherHsv = (novo) => {
    setHsv(novo)
    const hex = rgbParaHex(...hsvParaRgb(...novo))
    setTexto(hex)
    aoMudar(hex)
  }
  const escolherHex = (hex, lembrar = true) => {
    const rgb = hexParaRgb(hex)
    if (!rgb) return
    const limpo = rgbParaHex(...rgb)
    const [h, s, v] = rgbParaHsv(...rgb)
    setHsv((x) => [s && v ? h : x[0], s, v])
    setTexto(limpo)
    aoMudar(limpo)
    if (lembrar) guardarRecente(limpo)
  }
  const lembrarAtual = () => guardarRecente(rgbParaHex(...hsvParaRgb(...hsv)))

  const arrastarSv = useArrasto((fx, fy) => escolherHsv([hsv[0], fx, 1 - fy]), lembrarAtual)
  const arrastarMatiz = useArrasto((fx) => escolherHsv([fx * 360, hsv[1], hsv[2]]), lembrarAtual)
  const temContaGotas = typeof window !== 'undefined' && 'EyeDropper' in window
  const contaGotas = async () => {
    try {
      const { sRGBHex } = await new window.EyeDropper().open()
      escolherHex(sRGBHex)
    } catch {
      /* cancelou */
    }
  }
  const matizPuro = rgbParaHex(...hsvParaRgb(hsv[0], 1, 1))
  const passo = (e, d) => {
    e.preventDefault()
    return d * (e.shiftKey ? 10 : 1)
  }

  return (
    <div ref={raiz} className="flex min-w-0 flex-col gap-1.5" data-seletor-cor="">
      {rotulo ? (
        <label htmlFor={id} className="text-[0.8125rem] font-semibold text-tinta">
          {rotulo}
        </label>
      ) : null}
      <button
        id={id}
        type="button"
        aria-expanded={aberto}
        aria-label={`${rotulo}: ${valor}. Escolher outra cor`}
        onClick={() => setAberto((a) => !a)}
        className="flex h-10 w-full min-w-0 items-center gap-2.5 rounded-[var(--radius-controle)] border border-borda-forte bg-superficie px-2 text-left transition-colors hover:border-fraca/60 focus-visible:border-acento focus-visible:outline-none"
      >
        <span className="xadrez size-6 shrink-0 overflow-hidden rounded-md border border-borda-forte">
          <span className="block size-full" style={{ background: valor }} />
        </span>
        <span className="flex-1 font-mono text-sm text-tinta uppercase">{valor}</span>
        <Icone nome="setaBaixo" tamanho={16} className={`text-fraca transition-transform ${aberto ? 'rotate-180' : ''}`} />
      </button>

      {aberto ? (
        <div className="flex flex-col gap-3 rounded-[var(--radius-controle)] border border-borda bg-superficie-2 p-3">
          {/* Saturação (→) e brilho (↑) */}
          <div
            role="slider"
            tabIndex={0}
            aria-label="Saturação e brilho"
            aria-valuetext={`saturação ${Math.round(hsv[1] * 100)}%, brilho ${Math.round(hsv[2] * 100)}%`}
            onPointerDown={arrastarSv}
            onKeyDown={(e) => {
              const k = { ArrowRight: [1, 0], ArrowLeft: [-1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] }[e.key]
              if (!k) return
              const p = passo(e, 0.01)
              escolherHsv([hsv[0], limitar(hsv[1] + k[0] * p, 0, 1), limitar(hsv[2] + k[1] * p, 0, 1)])
            }}
            className="relative h-36 w-full cursor-crosshair touch-none rounded-lg focus-visible:outline-2 focus-visible:outline-acento"
            style={{ background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, ${matizPuro})` }}
          >
            <span
              className="pointer-events-none absolute size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,.5)]"
              style={{ left: `${hsv[1] * 100}%`, top: `${(1 - hsv[2]) * 100}%`, background: atual }}
            />
          </div>
          {/* Matiz */}
          <div
            role="slider"
            tabIndex={0}
            aria-label="Matiz"
            aria-valuemin={0}
            aria-valuemax={360}
            aria-valuenow={Math.round(hsv[0])}
            onPointerDown={arrastarMatiz}
            onKeyDown={(e) => {
              const k = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1 }[e.key]
              if (k) escolherHsv([(hsv[0] + k * passo(e, 2) + 360) % 360, hsv[1], hsv[2]])
            }}
            className="relative h-3.5 w-full cursor-pointer touch-none rounded-full focus-visible:outline-2 focus-visible:outline-acento"
            style={{ background: 'linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)' }}
          >
            <span className="pointer-events-none absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,.5)]" style={{ left: `${(hsv[0] / 360) * 100}%`, background: matizPuro }} />
          </div>
          {/* Código e conta-gotas */}
          <div className="flex items-center gap-2">
            <span className="size-9 shrink-0 rounded-lg border border-borda-forte" style={{ background: atual }} />
            <input
              value={texto}
              onChange={(e) => {
                setTexto(e.target.value)
                if (hexParaRgb(e.target.value)) escolherHex(e.target.value, false)
              }}
              onBlur={() => (hexParaRgb(texto) ? guardarRecente(rgbParaHex(...hexParaRgb(texto))) : setTexto(valor))}
              spellCheck={false}
              maxLength={7}
              aria-label="Código da cor (hex)"
              className="h-9 min-w-0 flex-1 rounded-lg border border-borda-forte bg-superficie px-2.5 font-mono text-sm text-tinta uppercase focus:border-acento focus:outline-none"
            />
            {temContaGotas ? (
              <button type="button" onClick={contaGotas} title="Pegar uma cor da tela" aria-label="Pegar uma cor da tela (conta-gotas)" className="grid size-9 shrink-0 place-items-center rounded-lg border border-borda-forte text-suave hover:text-tinta">
                <Icone nome="gota" tamanho={16} />
              </button>
            ) : null}
          </div>
          {/* Prontas e recentes */}
          {[
            ['Cores', PRONTAS],
            ['Recentes', recentes],
          ].map(([titulo, lista]) =>
            lista.length ? (
              <div key={titulo} className="flex flex-col gap-1.5">
                <span className="text-[0.6875rem] font-semibold tracking-wide text-fraca uppercase">{titulo}</span>
                <div className="flex flex-wrap gap-1.5">
                  {lista.map((c) => (
                    <button
                      key={c}
                      type="button"
                      aria-label={`Cor ${c}`}
                      aria-pressed={c === valor}
                      onClick={() => escolherHex(c)}
                      className={`size-6 rounded-md border transition-transform hover:scale-110 ${c === valor ? 'ring-2 ring-acento ring-offset-2 ring-offset-superficie-2' : 'border-borda-forte'}`}
                      style={{ background: c }}
                    />
                  ))}
                </div>
              </div>
            ) : null,
          )}
        </div>
      ) : null}
      {dica ? <p className="text-xs leading-relaxed text-fraca">{dica}</p> : null}
    </div>
  )
}
