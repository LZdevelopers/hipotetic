import { useEffect, useState, useSyncExternalStore } from 'react'

/**
 * Preferências guardadas no navegador (localStorage). Sempre com try/catch:
 * em janela anônima ou com armazenamento bloqueado, o site segue funcionando.
 */
export const CHAVES = { tema: 'hp:tema', recentes: 'hp:recentes' }

export function ler(chave, padrao = null) {
  try {
    const bruto = localStorage.getItem(chave)
    return bruto == null ? padrao : JSON.parse(bruto)
  } catch {
    return padrao
  }
}

export function gravar(chave, valor) {
  try {
    localStorage.setItem(chave, JSON.stringify(valor))
  } catch {
    /* armazenamento indisponível */
  }
}

// ─── Tema ───────────────────────────────────────────────────────────────────

const ouvintesTema = new Set()

function temaAtual() {
  return typeof document === 'undefined' ? 'light' : document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'
}

export function definirTema(tema) {
  const raiz = document.documentElement
  raiz.classList.add('trocando-tema')
  raiz.dataset.theme = tema
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', tema === 'dark' ? '#0b0b0d' : '#ffffff')
  gravar(CHAVES.tema, tema)
  setTimeout(() => raiz.classList.remove('trocando-tema'), 300)
  ouvintesTema.forEach((f) => f())
}

export function useTema() {
  return useSyncExternalStore(
    (f) => {
      ouvintesTema.add(f)
      return () => ouvintesTema.delete(f)
    },
    temaAtual,
    () => 'light',
  )
}

// ─── Ferramentas usadas recentemente ────────────────────────────────────────

const MAX_RECENTES = 6

export function registrarUso(slug) {
  const lista = ler(CHAVES.recentes, [])
  const nova = [slug, ...(Array.isArray(lista) ? lista : []).filter((s) => s !== slug)].slice(0, MAX_RECENTES)
  gravar(CHAVES.recentes, nova)
}

/** Lista de slugs; vazia no servidor e no primeiro render (sem divergência na hidratação). */
export function useRecentes() {
  const [lista, setLista] = useState([])
  useEffect(() => {
    const salvo = ler(CHAVES.recentes, [])
    setLista(Array.isArray(salvo) ? salvo.filter((s) => typeof s === 'string') : [])
  }, [])
  return [
    lista,
    () => {
      gravar(CHAVES.recentes, [])
      setLista([])
    },
  ]
}
