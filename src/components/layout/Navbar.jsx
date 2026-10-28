import { useEffect, useRef, useState } from 'react'
import { navLinks } from '../../data/site'
import { useScrolled } from '../../hooks/useScrolled'
import { Icon } from '../primitives/Icon'
import { Logo } from './Logo'

/** Navbar do site da LZdev: transparente no topo, vidro escuro ao rolar. */
export function Navbar() {
  const scrolled = useScrolled(20)
  const [open, setOpen] = useState(false)
  const triggerRef = useRef(null)

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event) => event.key === 'Escape' && setOpen(false)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      triggerRef.current?.focus()
    }
  }, [open])

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-[background-color,border-color,backdrop-filter,box-shadow] duration-500 ease-[var(--ease-out-soft)] ${
        scrolled || open
          ? 'border-b border-white/8 bg-bg/72 shadow-[0_10px_30px_-20px_rgb(0_0_0/0.9)] backdrop-blur-xl'
          : 'border-b border-transparent bg-transparent'
      }`}
    >
      <nav className="container-page grid h-18 grid-cols-[auto_1fr_auto] items-center gap-6" aria-label="Navegação principal">
        <a href="#inicio" className="rounded-lg" aria-label="Início">
          <Logo />
        </a>

        <ul className="hidden items-center justify-center gap-1 md:flex">
          {navLinks.map((link) => (
            <li key={link.href}>
              <a
                href={link.href}
                className="relative rounded-lg px-3.5 py-2 text-sm font-medium text-muted transition-colors duration-300 after:absolute after:inset-x-3.5 after:-bottom-0.5 after:h-px after:origin-left after:scale-x-0 after:bg-gradient-to-r after:from-cat-1 after:to-cat-2 after:transition-transform after:duration-300 hover:text-ink hover:after:scale-x-100"
              >
                {link.label}
              </a>
            </li>
          ))}
        </ul>

        <div className="col-start-3 flex items-center justify-end">
          <button
            ref={triggerRef}
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="grid size-11 place-items-center rounded-xl border border-white/10 bg-white/[0.04] text-ink transition-colors hover:border-brand/40 md:hidden"
            aria-expanded={open}
            aria-controls="menu-mobile"
            aria-label={open ? 'Fechar menu' : 'Abrir menu'}
          >
            <Icon name={open ? 'close' : 'menu'} size={20} />
          </button>
        </div>
      </nav>

      <div id="menu-mobile" hidden={!open} className="border-t border-white/8 bg-bg/95 backdrop-blur-xl md:hidden">
        <ul className="container-page flex flex-col gap-1 py-5">
          {navLinks.map((link, i) => (
            <li key={link.href}>
              <a
                href={link.href}
                onClick={() => setOpen(false)}
                className="flex items-center justify-between rounded-xl px-4 py-3.5 text-base font-medium text-muted transition-colors hover:bg-white/[0.05] hover:text-ink"
              >
                {link.label}
                <span className="font-mono text-xs text-faint">0{i + 1}</span>
              </a>
            </li>
          ))}
        </ul>
      </div>
    </header>
  )
}
