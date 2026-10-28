import { useEffect } from 'react'

/**
 * Observa todos os elementos [data-reveal] do documento e adiciona
 * `.is-visible` quando entram no viewport. Um único observer serve a
 * página inteira — nós que aparecem depois (acordeões, resultados) são
 * capturados por um MutationObserver.
 */
export function useReveal() {
  useEffect(() => {
    const nodes = new WeakSet()

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          entry.target.classList.add('is-visible')
          io.unobserve(entry.target)
        }
      },
      { rootMargin: '0px 0px -12% 0px', threshold: 0.08 },
    )

    const scan = () => {
      for (const el of document.querySelectorAll('[data-reveal]:not(.is-visible)')) {
        if (nodes.has(el)) continue
        nodes.add(el)
        io.observe(el)
      }
    }

    scan()

    // Qualquer re-render do React dispara mutações (digitar no formulário, por
    // exemplo). Coalescer num único rAF evita varrer o documento a cada tecla.
    let queued = 0
    const mo = new MutationObserver(() => {
      if (queued) return
      queued = requestAnimationFrame(() => {
        queued = 0
        scan()
      })
    })
    mo.observe(document.body, { childList: true, subtree: true })

    return () => {
      io.disconnect()
      mo.disconnect()
      cancelAnimationFrame(queued)
    }
  }, [])
}
