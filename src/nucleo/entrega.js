/**
 * Entrega de arquivo entre ferramentas na mesma aba (ex.: "Abrir no editor"
 * no gravador de voz). Fica só na memória: some ao recarregar a página.
 */
let pendente = null

/** Guarda um arquivo para a próxima ferramenta (slug) que for aberta. */
export function entregar(slug, arquivo) {
  pendente = { slug, arquivo }
}

/** Pega (e consome) o arquivo entregue para esta ferramenta, se houver. */
export function receber(slug) {
  if (pendente?.slug !== slug) return null
  const { arquivo } = pendente
  // Consome depois da renderização atual (o StrictMode chama o inicializador duas vezes).
  queueMicrotask(() => {
    if (pendente?.arquivo === arquivo) pendente = null
  })
  return arquivo
}
