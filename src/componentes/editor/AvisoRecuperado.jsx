import { useEffect, useRef, useState } from 'react'
import { haQuanto } from '../../nucleo/rascunho'
import { Icone } from '../Icone'

/**
 * "Edição recuperada": aviso pequeno no canto da tela, que não ocupa espaço
 * da página e some sozinho (fica enquanto o mouse estiver em cima). Tem o
 * "Começar do zero" para quem não queria a edição de volta.
 */
export function AvisoRecuperado({ quando, aoFechar, aoRecomecar, duracao = 7000 }) {
  const [saindo, setSaindo] = useState(false)
  const pausado = useRef(false)
  const fechar = useRef(aoFechar)
  fechar.current = aoFechar

  useEffect(() => {
    let restante = duracao
    let ultimo = Date.now()
    const relogio = setInterval(() => {
      const agora = Date.now()
      if (!pausado.current) restante -= agora - ultimo
      ultimo = agora
      if (restante <= 0) {
        clearInterval(relogio)
        setSaindo(true)
        setTimeout(() => fechar.current?.(), 250)
      }
    }, 200)
    return () => clearInterval(relogio)
  }, [duracao])

  return (
    <div
      role="status"
      onPointerEnter={() => (pausado.current = true)}
      onPointerLeave={() => (pausado.current = false)}
      className={`fixed bottom-4 left-4 z-50 flex max-w-[calc(100vw-2rem)] items-center gap-2 rounded-full border border-borda bg-superficie/95 py-1.5 pr-1.5 pl-3 text-xs text-suave shadow-[var(--shadow-cartao)] backdrop-blur transition-all duration-250 ${saindo ? 'translate-y-2 opacity-0' : 'translate-y-0 opacity-100'}`}
      data-aviso-recuperado=""
    >
      <Icone nome="check" tamanho={14} className="shrink-0 text-acento" />
      <span className="truncate">
        Edição recuperada <span className="text-fraca">· {haQuanto(quando)}</span>
      </span>
      {aoRecomecar ? (
        <button type="button" onClick={aoRecomecar} className="shrink-0 rounded-full px-2 py-1 font-semibold text-tinta hover:bg-superficie-2">
          Começar do zero
        </button>
      ) : null}
      <button type="button" onClick={aoFechar} aria-label="Fechar aviso" className="grid size-6 shrink-0 place-items-center rounded-full text-fraca hover:bg-superficie-2 hover:text-tinta">
        <Icone nome="fechar" tamanho={13} />
      </button>
    </div>
  )
}
