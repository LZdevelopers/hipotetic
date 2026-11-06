/**
 * Carregamento sob demanda do código de cada ferramenta.
 *
 * Cada ferramenta é um arquivo em src/ferramentas/<categoria>/<nome>.jsx e
 * vira um pedaço (chunk) separado no build: quem abre "Unir PDF" não baixa o
 * código de vídeo. As bibliotecas pesadas (ffmpeg, pdf.js…) são importadas
 * dentro das funções de processamento, então nem esse chunk as carrega.
 *
 * Na pré-renderização e antes da hidratação, `precarregar` resolve o módulo,
 * e `ComponenteFerramenta` desenha sem suspender (HTML idêntico nos dois
 * lados). Na navegação interna, ele suspende até o chunk chegar.
 */
const modulos = import.meta.glob('./*/*.jsx')

const prontos = new Map()
const pendentes = new Map()

export function existeModulo(modulo) {
  return Boolean(modulos[`./${modulo}.jsx`])
}

export function precarregar(ferramenta) {
  const { modulo } = ferramenta
  if (prontos.has(modulo)) return Promise.resolve(prontos.get(modulo))
  if (!pendentes.has(modulo)) {
    const carregar = modulos[`./${modulo}.jsx`]
    if (!carregar) return Promise.reject(new Error(`Ferramenta sem módulo: ${modulo}`))
    pendentes.set(
      modulo,
      carregar()
        .then((m) => {
          prontos.set(modulo, m.default)
          return m.default
        })
        .catch((erro) => {
          pendentes.delete(modulo)
          throw erro
        }),
    )
  }
  return pendentes.get(modulo)
}

export function ComponenteFerramenta({ ferramenta }) {
  const Componente = prontos.get(ferramenta.modulo)
  if (!Componente) throw precarregar(ferramenta)
  return <Componente ferramenta={ferramenta} {...ferramenta.predef} />
}
