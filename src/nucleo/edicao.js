import { createContext, useContext, useEffect } from 'react'

/**
 * Modo edição: quando um editor (áudio, vídeo, imagem, PDF) está com um
 * arquivo aberto, a página da ferramenta mostra só o editor — as perguntas e
 * as ferramentas relacionadas aparecem antes de começar, não durante.
 */
export const ContextoEdicao = createContext(null)

/** Chame no componente que só existe enquanto há um arquivo em edição. */
export function useEmEdicao(ativo = true) {
  const definir = useContext(ContextoEdicao)
  useEffect(() => {
    if (!definir || !ativo) return undefined
    definir(true)
    return () => definir(false)
  }, [definir, ativo])
}
