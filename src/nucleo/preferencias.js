import { useEffect, useState, useSyncExternalStore } from 'react'
import { flushSync } from 'react-dom'

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
  return typeof document === 'undefined' ? 'dark' : document.documentElement.dataset.theme === 'light' ? 'light' : 'dark'
}

function aplicarTema(tema) {
  document.documentElement.dataset.theme = tema
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', tema === 'dark' ? '#0b0b0d' : '#ffffff')
  gravar(CHAVES.tema, tema)
  // Síncrono: a transição tira a "foto" do tema novo logo depois deste callback.
  flushSync(() => ouvintesTema.forEach((f) => f()))
}

/**
 * Troca o tema com um esmaecimento curto da página inteira (View Transitions;
 * duração no app.css). Sem suporte do navegador, ou com "reduzir movimento",
 * a troca é instantânea.
 */
export function definirTema(tema) {
  const reduzir = matchMedia('(prefers-reduced-motion: reduce)').matches
  if (!document.startViewTransition || reduzir) return aplicarTema(tema)
  document.startViewTransition(() => aplicarTema(tema))
}

export function useTema() {
  return useSyncExternalStore(
    (f) => {
      ouvintesTema.add(f)
      return () => ouvintesTema.delete(f)
    },
    temaAtual,
    () => 'dark',
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
