import { createContext, startTransition, useCallback, useContext, useEffect, useMemo, useState } from 'react'

/**
 * Roteador mínimo. As rotas do site são estáticas (catálogo de ferramentas),
 * então não precisamos de um framework: cada endereço é pré-renderizado no
 * build (dev/prerenderizar.mjs) e, no navegador, a navegação interna troca só
 * o conteúdo via History API — sem recarregar a página.
 *
 * A troca é feita em `startTransition`: enquanto o código da próxima
 * ferramenta carrega, a página atual continua na tela (sem "piscar" vazio).
 */

const ContextoRota = createContext({ caminho: '/', navegar: () => {} })

/** "/pdf/unir/" → "/pdf/unir"; "" → "/". */
export function normalizarCaminho(caminho) {
  const limpo = String(caminho || '/').split(/[?#]/)[0].replace(/\/+$/, '')
  return limpo || '/'
}

export function Roteador({ caminhoInicial, children }) {
  const [caminho, setCaminho] = useState(() => normalizarCaminho(caminhoInicial))

  useEffect(() => {
    const aoVoltar = () => startTransition(() => setCaminho(normalizarCaminho(location.pathname)))
    addEventListener('popstate', aoVoltar)
    return () => removeEventListener('popstate', aoVoltar)
  }, [])

  const navegar = useCallback((destino, { substituir = false } = {}) => {
    const url = new URL(destino, location.href)
    if (url.origin !== location.origin) {
      location.href = url.href
      return
    }
    const novo = normalizarCaminho(url.pathname)
    history[substituir ? 'replaceState' : 'pushState'](null, '', novo + url.search + url.hash)
    startTransition(() => setCaminho(novo))
    if (url.hash) {
      // A página nova renderiza numa transição: espera a âncora aparecer (até ~0,5 s).
      const id = decodeURIComponent(url.hash.slice(1))
      let tentativas = 0
      const rolar = () => {
        const alvo = document.getElementById(id)
        if (alvo) alvo.scrollIntoView({ block: 'start' })
        else if ((tentativas += 1) < 30) requestAnimationFrame(rolar)
        else scrollTo({ top: 0 })
      }
      requestAnimationFrame(rolar)
    } else {
      scrollTo({ top: 0 })
    }
  }, [])

  const valor = useMemo(() => ({ caminho, navegar }), [caminho, navegar])
  return <ContextoRota.Provider value={valor}>{children}</ContextoRota.Provider>
}

export const useRota = () => useContext(ContextoRota)

/**
 * <a> que navega sem recarregar quando o destino é interno. Cliques com
 * Ctrl/⌘/Shift/botão do meio, `target` ou `download` seguem o comportamento
 * normal do navegador (abrir em nova aba etc.).
 */
export function Link({ para, onClick, children, ...props }) {
  const { navegar } = useRota()
  return (
    <a
      href={para}
      onClick={(evento) => {
        onClick?.(evento)
        if (
          evento.defaultPrevented ||
          evento.button !== 0 ||
          evento.metaKey ||
          evento.ctrlKey ||
          evento.shiftKey ||
          evento.altKey ||
          props.target ||
          props.download
        ) {
          return
        }
        evento.preventDefault()
        navegar(para)
      }}
      {...props}
    >
      {children}
    </a>
  )
}
