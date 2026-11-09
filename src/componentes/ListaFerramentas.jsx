import { caminhoDa, categoriasComFerramentas, corDa, ferramentasDaCategoria } from '../ferramentas/catalogo'
import { Link } from '../nucleo/roteador'
import { Icone } from './Icone'
import { SeloCategoria } from './ui'

/*
 * Duas formas de mostrar ferramentas, no lugar dos antigos cartões:
 *  - Indice: todas as ferramentas, agrupadas por categoria em colunas, cada
 *    uma numa linha (ícone, nome e o que faz). Cada categoria tem âncora
 *    (/#video, /#pdf…), usada pelo menu e pelo rodapé.
 *  - Pilulas: listas curtas (relacionadas, recentes), em linha.
 */

export function Indice() {
  const cats = categoriasComFerramentas()
  return (
    <div>
      <nav aria-label="Ir para a categoria" className="flex flex-wrap gap-2">
        {cats.map((c) => (
          <a
            key={c.id}
            href={`#${c.id}`}
            onClick={(e) => {
              e.preventDefault()
              document.getElementById(c.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
              history.replaceState(null, '', `#${c.id}`)
            }}
            className="inline-flex h-8 items-center gap-2 rounded-full border border-borda bg-superficie px-3 text-[0.8125rem] font-medium text-suave transition-colors hover:border-borda-forte hover:text-tinta"
          >
            <span className="size-2 rounded-full" style={{ backgroundColor: `var(--color-cat-${c.id})` }} />
            {c.nome}
            <span className="text-xs text-fraca tabular-nums">{ferramentasDaCategoria(c.id).length}</span>
          </a>
        ))}
      </nav>

      <div className="mt-10 grid gap-x-12 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
        {cats.map((c) => (
          <section key={c.id} id={c.id} aria-labelledby={`titulo-${c.id}`} className="min-w-0 scroll-mt-24">
            <header className="flex items-center gap-3 border-b-2 pb-3" style={{ borderColor: `color-mix(in oklab, var(--color-cat-${c.id}) 55%, transparent)` }}>
              <SeloCategoria categoria={c.id} icone={c.icone} tamanho="p" />
              <h3 id={`titulo-${c.id}`} className="font-display text-lg font-bold text-tinta">
                {c.nome}
              </h3>
            </header>
            <ul className="mt-2">
              {ferramentasDaCategoria(c.id).map((f) => (
                <li key={f.slug}>
                  <Link para={caminhoDa(f)} className="group -mx-2.5 flex items-start gap-3 rounded-xl px-2.5 py-2.5 transition-colors hover:bg-superficie-2">
                    <Icone nome={f.icone} tamanho={17} className="mt-0.5" style={{ color: `var(--color-cat-${c.id})` }} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5 text-[0.9375rem] font-semibold text-tinta">
                        {f.nome}
                        {f.servidor ? <Icone nome="servidor" tamanho={12} className="text-fraca" aria-label="usa o servidor" /> : null}
                      </span>
                      <span className="mt-0.5 block text-[0.8125rem] leading-snug text-fraca">{f.resumo}</span>
                    </span>
                    <Icone nome="seta" tamanho={15} className="mt-1 -translate-x-1 text-fraca opacity-0 transition-all duration-200 group-hover:translate-x-0 group-hover:opacity-100" />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  )
}

/** Ferramentas em pílulas (ícone colorido + nome), uma ao lado da outra. */
export function Pilulas({ lista }) {
  return (
    <ul className="flex flex-wrap gap-2">
      {lista.map((f) => (
        <li key={f.slug}>
          <Link
            para={caminhoDa(f)}
            title={f.resumo}
            className="group inline-flex h-10 items-center gap-2 rounded-full border border-borda bg-superficie pr-4 pl-1.5 text-sm font-medium text-texto transition-colors hover:border-borda-forte hover:text-tinta"
          >
            <span className="grid size-7 place-items-center rounded-full" style={{ color: `var(--color-cat-${corDa(f)})`, backgroundColor: `color-mix(in oklab, var(--color-cat-${corDa(f)}) 13%, transparent)` }}>
              <Icone nome={f.icone} tamanho={15} />
            </span>
            {f.nome}
          </Link>
        </li>
      ))}
    </ul>
  )
}
