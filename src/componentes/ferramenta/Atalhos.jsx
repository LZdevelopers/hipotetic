import { caminhoDa, corDa, ferramentasDaCategoria } from '../../ferramentas/catalogo'
import { Link } from '../../nucleo/roteador'
import { SeloCategoria } from '../ui'

/** O editor da categoria (o que ocupa a tela inteira e tem slug ".../editor"). */
export const ehEditor = (f) => f.slug.endsWith('/editor')

/**
 * "O que você quer fazer?": na tela vazia de um editor, as outras ferramentas
 * da categoria (as rápidas abrem este mesmo editor já configurado; as demais
 * são ferramentas próprias).
 */
export function AtalhosDoEditor({ categoria }) {
  const lista = ferramentasDaCategoria(categoria).filter((f) => !ehEditor(f))
  if (!lista.length) return null
  return (
    <nav aria-label="Atalhos" className="w-full max-w-3xl">
      <p className="text-center text-sm font-semibold text-tinta">Ou vá direto ao que você precisa</p>
      <ul className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {lista.map((f) => (
          <li key={f.slug}>
            <Link para={caminhoDa(f)} className="flex h-full items-start gap-3 rounded-xl border border-borda bg-superficie p-3 transition-colors hover:border-borda-forte hover:bg-superficie-2">
              <SeloCategoria categoria={corDa(f)} icone={f.icone} tamanho="p" />
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-tinta">{f.nome}</span>
                <span className="block text-xs leading-snug text-fraca">{f.resumo}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  )
}
