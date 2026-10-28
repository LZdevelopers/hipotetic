import { footer } from '../../data/site'
import { Logo, LzdevSignature } from './Logo'

const YEAR = new Date().getFullYear()

export function Footer() {
  return (
    <footer className="relative border-t border-white/8 bg-bg-soft/60">
      <div className="container-page py-14 sm:py-16">
        <div className="grid gap-12 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1fr)] lg:gap-10">
          <div className="max-w-sm sm:col-span-2 lg:col-span-1">
            <Logo />
            <p className="mt-5 text-sm leading-relaxed text-muted">{footer.tagline}</p>
          </div>

          {footer.columns.map((column) => (
            <nav key={column.title} aria-label={column.title}>
              <h2 className="text-xs font-semibold tracking-[0.18em] text-faint uppercase">{column.title}</h2>
              <ul className="mt-5 flex flex-col gap-3">
                {column.links.map((link) => (
                  <li key={link.label}>
                    <a href={link.href} className="text-sm text-muted transition-colors duration-300 hover:text-ink">
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="mt-12 flex flex-col gap-4 border-t border-white/8 pt-7 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-faint">© {YEAR} LZdev. Sem anúncios, sem rastreadores.</p>
          <LzdevSignature />
        </div>
      </div>
    </footer>
  )
}
