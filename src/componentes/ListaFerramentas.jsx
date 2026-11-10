import { caminhoDa, corDa } from '../ferramentas/catalogo'
import { Link } from '../nucleo/roteador'
import { Icone } from './Icone'

/**
 * Cartão de ferramenta (estilo iLovePDF): ícone colorido em degradê que se
 * mexe no hover, nome em destaque e o que a ferramenta faz.
 */
export function Cartao({ f, atraso = 0 }) {
  const cor = `var(--color-cat-${corDa(f)})`
  return (
    <Link
      para={caminhoDa(f)}
      className="group relative flex h-full animate-surgir flex-col rounded-2xl border border-borda bg-superficie p-5 transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-1 hover:border-transparent hover:shadow-[0_14px_40px_-14px_color-mix(in_oklab,var(--cor)_55%,transparent)]"
      style={{ '--cor': cor, animationDelay: `${atraso}ms` }}
    >
      {f.novo ? <span className="absolute top-4 right-4 rounded-full bg-perigo px-2 py-0.5 text-[0.625rem] font-bold tracking-wide text-white uppercase">Novo</span> : null}
      <span
        className="relative grid size-13 place-items-center overflow-hidden rounded-2xl text-white shadow-[0_6px_16px_-6px_var(--cor)] transition-transform duration-300 group-hover:scale-105 group-hover:-rotate-3 escuro:text-fundo"
        style={{ background: `linear-gradient(140deg, ${cor}, color-mix(in oklab, ${cor} 55%, white))` }}
      >
        <Icone nome={f.icone} tamanho={26} strokeWidth={2} className="relative transition-transform duration-300 group-hover:scale-110" />
        {/* brilho que atravessa o ícone */}
        <span className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/45 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
      </span>
      <span className="mt-4 flex items-center gap-1.5 font-display text-[1.0625rem] leading-snug font-bold text-tinta">
        {f.nome}
        {f.servidor ? <Icone nome="servidor" tamanho={13} className="text-fraca" aria-label="usa o servidor" /> : null}
      </span>
      <span className="mt-1.5 text-sm leading-relaxed text-suave">{f.resumo}</span>
    </Link>
  )
}

/** Grade de cartões (4 por linha no computador). */
export function GradeCartoes({ lista, rotulo }) {
  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" aria-label={rotulo}>
      {lista.map((f, i) => (
        <li key={f.slug} className="min-w-0">
          <Cartao f={f} atraso={Math.min(i * 30, 450)} />
        </li>
      ))}
    </ul>
  )
}

/** Ferramentas em pílulas (relacionadas, recentes, 404). */
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
