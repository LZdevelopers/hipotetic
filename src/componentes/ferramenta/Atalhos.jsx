import { caminhoDa, corDa, ferramentasDaCategoria } from '../../ferramentas/catalogo'
import { Link } from '../../nucleo/roteador'
import { SeloCategoria } from '../ui'

/** O editor da categoria (o que ocupa a tela inteira e tem slug ".../editor"). */
export const ehEditor = (f) => f.slug.endsWith('/editor')

/**
 * Ferramentas de uma categoria divididas em três: o editor, os atalhos do
 * editor (ferramentas rápidas que abrem o próprio editor em modo foco — mesmo
 * módulo) e as outras (independentes, como Baixar vídeo ou OCR).
 */
export function gruposDaCategoria(categoria) {
  const todas = ferramentasDaCategoria(categoria)
  const editor = todas.find(ehEditor) ?? null
  const atalhos = editor ? todas.filter((f) => f !== editor && f.modulo === editor.modulo) : []
  const outras = todas.filter((f) => f !== editor && !atalhos.includes(f))
  return { editor, atalhos, outras }
}

function Cartoes({ lista }) {
  return (
    <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
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
  )
}

/**
 * Na tela vazia de um editor: as tarefas rápidas que ele mesmo faz (abrem já
 * configurado) e, separadas, as outras ferramentas da categoria.
 */
export function AtalhosDoEditor({ categoria }) {
  const { atalhos, outras } = gruposDaCategoria(categoria)
  if (!atalhos.length && !outras.length) return null
  return (
    <nav aria-label="Atalhos" className="flex w-full max-w-3xl flex-col gap-7">
      {atalhos.length ? (
        <section>
          <p className="text-center text-sm font-semibold text-tinta">Ou vá direto a uma tarefa</p>
          <Cartoes lista={atalhos} />
        </section>
      ) : null}
      {outras.length ? (
        <section>
          <p className="text-center text-sm font-semibold text-tinta">Outras ferramentas</p>
          <Cartoes lista={outras} />
        </section>
      ) : null}
    </nav>
  )
}
