import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Estado de uma operação: ocioso → processando → pronto | erro.
 *
 * `executar(fn)` chama `fn({ progresso, sinal })`:
 *   - progresso(valor, rotulo?): valor de 0 a 1 (ou null = indeterminado);
 *   - sinal: AbortSignal — a operação deve parar quando ele disparar.
 * O que `fn` devolve vira `resultado`. Cancelar volta ao estado ocioso.
 * Erros com `.mensagem` (ErroAmigavel) são mostrados como estão; os demais
 * viram uma mensagem genérica (o detalhe vai para o console).
 */
export class ErroAmigavel extends Error {
  constructor(mensagem, detalhe) {
    super(mensagem)
    this.mensagem = mensagem
    this.detalhe = detalhe
  }
}

export const cancelado = (sinal) => {
  if (sinal?.aborted) throw new DOMException('Cancelado', 'AbortError')
}

export function useTarefa() {
  const [estado, setEstado] = useState({ fase: 'ocioso' })
  const controle = useRef(null)

  useEffect(() => () => controle.current?.abort(), [])

  const executar = useCallback(async (fn, rotuloInicial = 'Processando') => {
    controle.current?.abort()
    const atual = new AbortController()
    controle.current = atual
    const inicio = performance.now()
    setEstado({ fase: 'processando', progresso: null, rotulo: rotuloInicial })

    let ultimo = 0
    const progresso = (valor, rotulo) => {
      if (atual.signal.aborted) return
      // Limita a ~20 atualizações por segundo: progresso não pode travar a tela.
      const agora = performance.now()
      if (valor != null && valor < 1 && agora - ultimo < 50 && !rotulo) return
      ultimo = agora
      setEstado((e) => (e.fase === 'processando' ? { ...e, progresso: valor, rotulo: rotulo ?? e.rotulo } : e))
    }

    try {
      const resultado = await fn({ progresso, sinal: atual.signal })
      if (atual.signal.aborted) return null
      setEstado({ fase: 'pronto', resultado, duracao: performance.now() - inicio })
      return resultado
    } catch (erro) {
      if (atual.signal.aborted || erro?.name === 'AbortError') {
        setEstado({ fase: 'ocioso' })
        return null
      }
      console.error(erro)
      setEstado({
        fase: 'erro',
        mensagem: erro?.mensagem ?? 'Não foi possível concluir a operação. Confira o arquivo e tente de novo.',
      })
      return null
    }
  }, [])

  const cancelar = useCallback(() => {
    controle.current?.abort()
    setEstado({ fase: 'ocioso' })
  }, [])

  const reiniciar = cancelar

  /** Volta direto ao "pronto" com um resultado salvo (ver nucleo/salvo.js). */
  const restaurar = useCallback((resultado, duracao) => setEstado({ fase: 'pronto', resultado, duracao }), [])

  return { ...estado, executar, cancelar, reiniciar, restaurar }
}
