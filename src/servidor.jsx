/**
 * Entrada da pré-renderização (build). dev/prerenderizar.mjs chama
 * `renderizar` para cada endereço e grava o HTML estático resultante.
 */
import { StrictMode } from 'react'
import { renderToString } from 'react-dom/server'
import App from './App'
import { ferramentas } from './ferramentas/catalogo'
import { existeModulo, precarregar } from './ferramentas/carregador'
import { metadadosDa, resolverRota, todasAsRotas } from './nucleo/rotas'
import { produto } from './textos'

export async function renderizar(caminho) {
  const rota = resolverRota(caminho)
  if (rota.tipo === 'ferramenta') await precarregar(rota.ferramenta)
  const html = renderToString(
    <StrictMode>
      <App caminho={caminho} />
    </StrictMode>,
  )
  return { html, meta: metadadosDa(rota), modulo: rota.tipo === 'ferramenta' ? rota.ferramenta.modulo : null }
}

/** Confere o catálogo: toda ferramenta listada precisa de um módulo real. */
export function conferirCatalogo() {
  const problemas = []
  const slugs = new Set()
  for (const f of ferramentas) {
    if (slugs.has(f.slug)) problemas.push(`slug repetido: ${f.slug}`)
    slugs.add(f.slug)
    if (!existeModulo(f.modulo)) problemas.push(`${f.slug}: módulo "${f.modulo}" não existe`)
    if (!f.nome || !f.titulo || !f.resumo || !f.descricao) problemas.push(`${f.slug}: faltam textos`)
    if (f.descricao && f.descricao.length > 170) problemas.push(`${f.slug}: descrição com ${f.descricao.length} caracteres (máx. 170)`)
  }
  return problemas
}

export { todasAsRotas, produto }
