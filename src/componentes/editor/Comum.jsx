import { useEffect, useId, useRef, useState } from 'react'
import { Icone } from '../Icone'

/*
 * Peças comuns aos editores (áudio e vídeo): o mesmo padrão de tela, o mesmo
 * controle de velocidade livre, o mesmo desfazer/refazer.
 */

/** 65.43 → "1:05.4" */
export const tempo = (s) => {
  const v = Math.max(0, s || 0)
  const m = Math.floor(v / 60)
  return `${m}:${(v - m * 60).toFixed(1).padStart(4, '0')}`
}
/** "1:05.4" / "65,4" → 65.4 (NaN se inválido). */
export const lerTempo = (texto) => {
  const p = String(texto).trim().replace(',', '.').split(':').map(Number)
  if (!p.length || p.some((n) => Number.isNaN(n) || n < 0)) return NaN
  return p.reduce((total, n) => total * 60 + n, 0)
}


export const VEL_MIN = 0.1
export const VEL_MAX = 10

/**
 * Velocidade livre: controle deslizante (0,25× a 4×, com 1× no meio) e um
 * campo onde dá para digitar qualquer valor de 0,1× a 10×.
 */
export function Velocidade({ valor, aoMudar }) {
  const [texto, setTexto] = useState(null)
  const id = useId()
  const posicao = Math.log2(Math.min(Math.max(valor, 0.25), 4))
  const fixar = (v) => aoMudar(Math.round(Math.min(Math.max(v, VEL_MIN), VEL_MAX) * 100) / 100)
  return (
    <div className="flex flex-col gap-2.5">
      <div className="-mt-2 flex items-center justify-between gap-3">
        <label htmlFor={id} className="text-xs font-semibold tracking-wide text-fraca uppercase">
          Velocidade
        </label>
        <div className="flex items-center gap-1.5">
          <input
            id={id}
            inputMode="decimal"
            value={texto ?? valor.toLocaleString('pt-BR')}
            onFocus={(e) => {
              setTexto(valor.toLocaleString('pt-BR'))
              e.currentTarget.select()
            }}
            onChange={(e) => {
              setTexto(e.target.value)
              const v = Number(e.target.value.replace(',', '.'))
              if (e.target.value.trim() && Number.isFinite(v) && v >= VEL_MIN && v <= VEL_MAX) fixar(v)
            }}
            onBlur={() => {
              const v = Number(String(texto ?? '').replace(',', '.'))
              if (Number.isFinite(v) && v > 0) fixar(v)
              setTexto(null)
            }}
            onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
            className="h-8 w-16 rounded-lg border border-borda-forte bg-superficie px-2 text-right text-sm font-semibold text-tinta tabular-nums focus:border-acento focus:outline-none"
          />
          <span className="text-sm font-semibold text-suave">×</span>
          {valor !== 1 ? (
            <button type="button" onClick={() => aoMudar(1)} className="ml-1 text-xs font-semibold text-suave hover:text-tinta">
              Normal
            </button>
          ) : null}
        </div>
      </div>
      <input
        type="range"
        min={-2}
        max={2}
        step={0.01}
        value={posicao}
        aria-label="Velocidade (0,25× a 4×)"
        aria-valuetext={`${valor.toLocaleString('pt-BR')}×`}
        onChange={(e) => fixar(2 ** Number(e.target.value))}
        onDoubleClick={() => aoMudar(1)}
        className="deslizante"
        style={{ '--preenchido': `${((posicao + 2) / 4) * 100}%` }}
      />
      <div className="flex justify-between text-[0.6875rem] text-fraca tabular-nums">
        <span>0,25×</span>
        <span>1×</span>
        <span>4×</span>
      </div>
    </div>
  )
}


/**
 * Histórico para desfazer/refazer. Mudanças seguidas (arrastar um controle)
 * viram um passo só: o estado é registrado quando para de mudar por 350 ms.
 */
export function useHistorico(estado, definir, ativo) {
  const h = useRef({ base: null, passado: [], futuro: [], timer: 0, aplicando: false })
  const [, atualizar] = useState(0)

  useEffect(() => {
    const x = h.current
    if (!ativo) return undefined
    if (x.base === null) {
      x.base = estado
      x.aplicando = false
      return undefined
    }
    if (x.aplicando) {
      x.aplicando = false
      x.base = estado
      return undefined
    }
    clearTimeout(x.timer)
    x.timer = setTimeout(() => {
      if (estado === x.base) return
      x.passado.push(x.base)
      if (x.passado.length > 200) x.passado.shift()
      x.base = estado
      x.futuro = []
      atualizar((n) => n + 1)
    }, 350)
    return () => clearTimeout(x.timer)
  }, [estado, ativo])

  /** Registra na hora o que ainda estava esperando os 350 ms. */
  const consolidar = () => {
    const x = h.current
    clearTimeout(x.timer)
    if (x.base !== null && estado !== x.base) {
      x.passado.push(x.base)
      x.base = estado
      x.futuro = []
    }
  }
  const desfazer = () => {
    consolidar()
    const x = h.current
    if (!x.passado.length) return
    x.futuro.push(x.base)
    x.base = x.passado.pop()
    x.aplicando = true
    definir(x.base)
    atualizar((n) => n + 1)
  }
  const refazer = () => {
    consolidar()
    const x = h.current
    if (!x.futuro.length) return
    x.passado.push(x.base)
    x.base = x.futuro.pop()
    x.aplicando = true
    definir(x.base)
    atualizar((n) => n + 1)
  }
  /** Esquece tudo: o próximo estado vira a base. */
  const reiniciar = () => {
    const x = h.current
    clearTimeout(x.timer)
    x.base = null
    x.passado = []
    x.futuro = []
    atualizar((n) => n + 1)
  }
  const x = h.current
  return { desfazer, refazer, reiniciar, podeDesfazer: x.passado.length > 0 || (x.base !== null && estado !== x.base), podeRefazer: x.futuro.length > 0 && estado === x.base }
}


export function BotaoAcao({ rotulo, icone, ...props }) {
  return (
    <button type="button" aria-label={rotulo} title={rotulo} className="grid size-8 place-items-center rounded-lg text-suave transition-colors hover:bg-superficie-2 hover:text-tinta disabled:opacity-30 disabled:hover:bg-transparent" {...props}>
      <Icone nome={icone} tamanho={16} />
    </button>
  )
}

/** Bloco de ajustes (uma coluna da faixa de baixo). */
export function Painel({ titulo, children }) {
  return (
    <div className="cartao flex min-w-0 flex-col gap-3 p-4">
      {titulo ? <h3 className="text-xs font-semibold tracking-wide text-fraca uppercase">{titulo}</h3> : null}
      {children}
    </div>
  )
}

/** <select> compacto, sem rótulo visível (barra do topo). */
export function SeletorCompacto({ rotulo, valor, aoMudar, opcoes }) {
  return (
    <label className="relative">
      <span className="sr-only">{rotulo}</span>
      <select
        value={valor}
        onChange={(e) => aoMudar(e.target.value)}
        title={rotulo}
        className="h-9 appearance-none rounded-lg border border-borda-forte bg-superficie pr-8 pl-3 text-[0.8125rem] font-semibold text-tinta transition-colors hover:border-fraca/60 focus:border-acento focus:outline-none"
      >
        {opcoes.map((o) => (
          <option key={o.valor} value={o.valor}>
            {o.rotulo}
          </option>
        ))}
      </select>
      <Icone nome="setaBaixo" tamanho={14} className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-fraca" />
    </label>
  )
}

/** Campo de tempo (m:ss.s) que só aplica ao sair ou apertar Enter. */
export function CampoTempo({ rotulo, valor, aoMudar }) {
  const [texto, setTexto] = useState(tempo(valor))
  const [editando, setEditando] = useState(false)
  // Lê o valor do próprio campo: o estado pode ainda não ter sido atualizado.
  const aplicar = (e) => {
    setEditando(false)
    const t = lerTempo(e?.currentTarget?.value ?? texto)
    if (!Number.isNaN(t)) aoMudar(t)
  }
  return (
    <label className="flex flex-col gap-1 text-[0.6875rem] font-semibold tracking-wide text-fraca uppercase">
      {rotulo}
      <input
        value={editando ? texto : tempo(valor)}
        onFocus={() => {
          setTexto(tempo(valor))
          setEditando(true)
        }}
        onChange={(e) => {
          setEditando(true)
          setTexto(e.target.value)
        }}
        onBlur={aplicar}
        onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
        inputMode="decimal"
        className="h-9 w-24 rounded-lg border border-borda-forte bg-superficie px-2.5 text-sm font-semibold text-tinta normal-case tabular-nums focus:border-acento focus:outline-none"
      />
    </label>
  )
}

