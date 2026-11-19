import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { guardar, ler } from './rascunho'
import { useTarefa } from './tarefa'

/*
 * Tudo o que a pessoa está fazendo numa ferramenta fica salvo no navegador
 * (IndexedDB, com os arquivos junto): sair do site sem querer e voltar
 * continua de onde parou. Nada sai do aparelho.
 *
 *   const [arquivos, setArquivos] = useSalvo('arquivos', [])
 *
 * funciona como useState; a chave ganha o prefixo da ferramenta atual
 * (ContextoSalvo, montado pela página da ferramenta). Fora de uma ferramenta,
 * é um useState comum.
 */

export const ContextoSalvo = createContext(null)

/** Igualdade estrutural simples (para não "recuperar" o estado inicial). */
function iguais(a, b) {
  if (a === b) return true
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false
  if (a instanceof Blob || b instanceof Blob) return false
  if (Array.isArray(a) !== Array.isArray(b)) return false
  const ka = Object.keys(a)
  const kb = Object.keys(b)
  return ka.length === kb.length && ka.every((k) => iguais(a[k], b[k]))
}

export function useSalvo(nome, inicial) {
  const ctx = useContext(ContextoSalvo)
  const chave = ctx ? `${ctx.prefixo}${nome}` : null
  const [valor, setValorBruto] = useState(inicial)
  const atual = useRef(valor)
  atual.current = valor
  const carregado = useRef(!chave)
  const mexeu = useRef(false)
  const inicialRef = useRef(inicial)

  // A pessoa mexeu antes de o salvo chegar: o que ela fez vale mais.
  const setValor = useCallback((v) => {
    mexeu.current = true
    setValorBruto(v)
  }, [])

  const gravar = useCallback(() => {
    if (!chave || !carregado.current || ctx?.descartando?.current) return
    guardar(chave, { v: atual.current, quando: Date.now() })
  }, [chave, ctx])

  useEffect(() => {
    if (!chave) return undefined
    let vivo = true
    ler(chave).then((salvo) => {
      if (!vivo) return
      carregado.current = true
      if (!mexeu.current && salvo && salvo.v !== undefined && !iguais(salvo.v, inicialRef.current)) {
        setValorBruto(salvo.v)
        ctx?.aoRecuperar?.(salvo.quando)
      }
    })
    return () => {
      vivo = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave])

  // Grava pouco depois de cada mudança…
  useEffect(() => {
    if (!chave || !carregado.current) return undefined
    const t = setTimeout(gravar, 350)
    return () => clearTimeout(t)
  }, [valor, chave, gravar])

  // …e na hora ao esconder a página ou sair da ferramenta.
  useEffect(() => {
    if (!chave) return undefined
    const aoEsconder = () => document.visibilityState === 'hidden' && gravar()
    document.addEventListener('visibilitychange', aoEsconder)
    addEventListener('pagehide', gravar)
    return () => {
      document.removeEventListener('visibilitychange', aoEsconder)
      removeEventListener('pagehide', gravar)
      gravar()
    }
  }, [chave, gravar])

  return [valor, setValor]
}

/**
 * useTarefa com o resultado salvo: terminou e a pessoa saiu antes de baixar?
 * Ao voltar, o resultado aparece de novo. Começar outra operação apaga o antigo.
 */
export function useTarefaSalva(nome = 'resultado') {
  const tarefa = useTarefa()
  const [salvo, setSalvo] = useSalvo(nome, null)
  const { fase, resultado, duracao, restaurar, reiniciar } = tarefa

  useEffect(() => {
    if (fase === 'pronto' && resultado != null) setSalvo({ resultado, duracao })
    else if (fase === 'processando') setSalvo(null)
  }, [fase, resultado, duracao, setSalvo])

  useEffect(() => {
    if (salvo && fase === 'ocioso') restaurar(salvo.resultado, salvo.duracao)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [salvo])

  const reiniciarSalvo = useCallback(() => {
    setSalvo(null)
    reiniciar()
  }, [setSalvo, reiniciar])

  return { ...tarefa, reiniciar: reiniciarSalvo }
}
