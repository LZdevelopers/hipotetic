import { caminhoDa, categoriaDa } from '../ferramentas/catalogo'
import { Link } from '../nucleo/roteador'
import { Icone } from './Icone'
import { SeloCategoria } from './ui'

/** Cartão de ferramenta: ícone da categoria, nome e o que faz em uma linha. */
export function CartaoFerramenta({ ferramenta, mostrarCategoria = false }) {
  const categoria = categoriaDa(ferramenta)
  return (
    <Link
      para={caminhoDa(ferramenta)}
      className="group cartao flex items-start gap-3.5 p-4 transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-px hover:border-borda-forte hover:shadow-[var(--shadow-cartao)]"
    >
      <SeloCategoria categoria={categoria.id} icone={ferramenta.icone} />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5 text-[0.9375rem] font-semibold text-tinta">
          <span className="truncate">{ferramenta.nome}</span>
          <Icone nome="seta" tamanho={15} className="-translate-x-1 text-fraca opacity-0 transition-all duration-200 group-hover:translate-x-0 group-hover:opacity-100" />
        </span>
        <span className="mt-0.5 line-clamp-2 block text-[0.8125rem] leading-snug text-suave">{ferramenta.resumo}</span>
        {mostrarCategoria ? <span className="mt-1.5 block text-xs text-fraca">{categoria.nome}</span> : null}
      </span>
    </Link>
  )
}

export function GradeFerramentas({ lista, mostrarCategoria }) {
  return (
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {lista.map((f) => (
        <li key={f.slug} className="min-w-0">
          <CartaoFerramenta ferramenta={f} mostrarCategoria={mostrarCategoria} />
        </li>
      ))}
    </ul>
  )
}
