import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Icone } from '../Icone'

/**
 * Menu do botão direito (no lugar do menu do navegador). Abre onde o mouse
 * está, sem sair da tela; fecha ao clicar fora, Esc, rolar ou escolher.
 * itens: [{ rotulo, icone?, atalho?, acao, perigo?, desativado? } | '-' (separador)]
 */
export function MenuContexto({ menu, aoFechar }) {
  const caixa = useRef(null)
  const [pos, setPos] = useState(null)

  useLayoutEffect(() => {
    if (!menu || !caixa.current) return
    const r = caixa.current.getBoundingClientRect()
    setPos({ x: Math.min(menu.x, innerWidth - r.width - 8), y: Math.min(menu.y, innerHeight - r.height - 8) })
    caixa.current.querySelector('[role=menuitem]:not([disabled])')?.focus()
  }, [menu])

  useEffect(() => {
    if (!menu) return undefined
    const fora = (e) => !caixa.current?.contains(e.target) && aoFechar()
    const tecla = (e) => {
      if (e.key === 'Escape') aoFechar()
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault()
        const itens = [...caixa.current.querySelectorAll('[role=menuitem]:not([disabled])')]
        const i = itens.indexOf(document.activeElement)
        itens[(i + (e.key === 'ArrowDown' ? 1 : -1) + itens.length) % itens.length]?.focus()
      }
    }
    addEventListener('pointerdown', fora, true)
    addEventListener('keydown', tecla, true)
    addEventListener('scroll', aoFechar, true)
    addEventListener('resize', aoFechar)
    addEventListener('blur', aoFechar)
    return () => {
      removeEventListener('pointerdown', fora, true)
      removeEventListener('keydown', tecla, true)
      removeEventListener('scroll', aoFechar, true)
      removeEventListener('resize', aoFechar)
      removeEventListener('blur', aoFechar)
    }
  }, [menu, aoFechar])

  if (!menu) return null
  return (
    <div
      ref={caixa}
      role="menu"
      aria-label={menu.titulo ?? 'Opções'}
      onContextMenu={(e) => e.preventDefault()}
      className="fixed z-[70] min-w-52 animate-surgir rounded-xl border border-borda bg-superficie p-1.5 shadow-[var(--shadow-flutuante)]"
      style={{ left: pos?.x ?? menu.x, top: pos?.y ?? menu.y, visibility: pos ? 'visible' : 'hidden' }}
    >
      {menu.titulo ? <p className="truncate px-2.5 pt-1 pb-1.5 text-[0.6875rem] font-semibold tracking-wide text-fraca uppercase">{menu.titulo}</p> : null}
      {menu.itens.map((item, i) =>
        item === '-' ? (
          <hr key={i} className="my-1 border-borda" />
        ) : (
          <button
            key={i}
            type="button"
            role="menuitem"
            disabled={item.desativado}
            onClick={() => {
              aoFechar()
              item.acao()
            }}
            className={`flex h-9 w-full items-center gap-2.5 rounded-lg px-2.5 text-left text-sm transition-colors focus:outline-none disabled:opacity-40 ${item.perigo ? 'text-perigo hover:bg-perigo-suave focus:bg-perigo-suave' : 'text-texto hover:bg-superficie-2 focus:bg-superficie-2'}`}
          >
            {item.icone ? <Icone nome={item.icone} tamanho={15} className={item.perigo ? '' : 'text-fraca'} /> : <span className="w-[15px]" />}
            <span className="flex-1">{item.rotulo}</span>
            {item.atalho ? <kbd className="font-sans text-xs text-fraca">{item.atalho}</kbd> : null}
          </button>
        ),
      )}
    </div>
  )
}
