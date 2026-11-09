import { caminhoDa, corDa } from '../ferramentas/catalogo'
import { Link } from '../nucleo/roteador'
import { Icone } from './Icone'

/** Ferramentas em listas curtas (relacionadas, recentes, 404). */

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
