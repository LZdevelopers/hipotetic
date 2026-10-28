import { useCallback, useEffect, useRef, useState } from 'react'
import { lookupMedia } from '../lib/media'

/**
 * Estado da consulta de um link: idle → loading → success | error.
 * Uma consulta nova cancela a anterior (AbortController), então colar dois
 * links seguidos nunca mostra o resultado do primeiro por cima do segundo.
 * Resultados ficam em memória na sessão: voltar a um link já visto é instantâneo.
 */
export function useMediaLookup() {
  const [state, setState] = useState({ status: 'idle', media: null, error: null })
  const controller = useRef(null)
  const cache = useRef(new Map())

  useEffect(() => () => controller.current?.abort(), [])

  const lookup = useCallback(async (url) => {
    controller.current?.abort()
    const key = url.trim()

    if (cache.current.has(key)) {
      setState({ status: 'success', media: cache.current.get(key), error: null })
      return
    }

    const current = new AbortController()
    controller.current = current
    setState({ status: 'loading', media: null, error: null })

    try {
      const media = await lookupMedia(key, current.signal)
      cache.current.set(key, media)
      setState({ status: 'success', media, error: null })
    } catch (error) {
      if (error.name === 'AbortError') return
      setState({ status: 'error', media: null, error: error.message })
    }
  }, [])

  const reset = useCallback(() => {
    controller.current?.abort()
    setState({ status: 'idle', media: null, error: null })
  }, [])

  return { ...state, lookup, reset }
}
