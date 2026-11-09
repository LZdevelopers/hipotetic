import { useEffect, useId, useRef, useState } from 'react'
import { buscarFerramentas, caminhoDa, categoriaDa, corDa, populares } from '../../ferramentas/catalogo'
import { useRota } from '../../nucleo/roteador'
import { textos } from '../../textos'
import { Icone } from '../Icone'
import { SeloCategoria } from '../ui'

/**
 * Lista de resultados navegável por teclado (↑ ↓ Enter), usada no campo da
 * página inicial e na paleta de busca (Ctrl+K).
 */
export function useBuscaTeclado(consulta, aoEscolher, { vaziaMostraPopulares = true } = {}) {
  const resultados = consulta.trim() ? buscarFerramentas(consulta) : vaziaMostraPopulares ? populares() : []
  const [ativo, setAtivo] = useState(0)
  useEffect(() => setAtivo(0), [consulta])

  const aoTeclar = (evento) => {
    if (evento.key === 'ArrowDown') {
      evento.preventDefault()
      setAtivo((a) => Math.min(a + 1, resultados.length - 1))
    } else if (evento.key === 'ArrowUp') {
      evento.preventDefault()
      setAtivo((a) => Math.max(a - 1, 0))
    } else if (evento.key === 'Enter' && resultados[ativo]) {
      evento.preventDefault()
      aoEscolher(resultados[ativo])
    }
  }
  return { resultados, ativo, setAtivo, aoTeclar }
}

export function ListaResultados({ id, resultados, ativo, setAtivo, aoEscolher }) {
  return (
    <ul id={id} role="listbox" className="flex flex-col gap-0.5">
      {resultados.map((f, i) => {
        const categoria = categoriaDa(f)
        return (
          <li key={f.slug} id={`${id}-${i}`} role="option" aria-selected={i === ativo}>
            <a
              href={caminhoDa(f)}
              onMouseMove={() => setAtivo(i)}
              onClick={(e) => {
                if (e.ctrlKey || e.metaKey || e.shiftKey) return
                e.preventDefault()
                aoEscolher(f)
              }}
              className={`flex items-center gap-3 rounded-lg px-2.5 py-2 transition-colors ${i === ativo ? 'bg-superficie-2' : ''}`}
            >
              <SeloCategoria categoria={corDa(f)} icone={f.icone} tamanho="p" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-tinta">{f.nome}</span>
                <span className="block truncate text-xs text-fraca">{f.resumo}</span>
              </span>
              <span className="hidden shrink-0 text-xs text-fraca sm:block">{categoria?.nome ?? 'Conversor'}</span>
            </a>
          </li>
        )
      })}
    </ul>
  )
}

/** Paleta de busca (diálogo). Abre com Ctrl/⌘+K ou "/" fora de campos. */
export function PaletaBusca({ aberta, aoFechar }) {
  const { navegar } = useRota()
  const dialogo = useRef(null)
  const campo = useRef(null)
  const [consulta, setConsulta] = useState('')
  const idLista = useId()

  const escolher = (f) => {
    aoFechar()
    navegar(caminhoDa(f))
  }
  const { resultados, ativo, setAtivo, aoTeclar } = useBuscaTeclado(consulta, escolher)

  useEffect(() => {
    const d = dialogo.current
    if (!d) return
    if (aberta && !d.open) {
      setConsulta('')
      d.showModal()
      requestAnimationFrame(() => campo.current?.focus())
    } else if (!aberta && d.open) {
      d.close()
    }
  }, [aberta])

  return (
    <dialog
      ref={dialogo}
      onClose={aoFechar}
      onClick={(e) => e.target === dialogo.current && aoFechar()}
      aria-label={textos.buscarFerramenta}
      className="m-0 mx-auto mt-[10vh] w-[calc(100%-2rem)] max-w-xl rounded-2xl border border-borda bg-superficie p-0 text-texto shadow-[var(--shadow-flutuante)] backdrop:bg-sobreposicao backdrop:backdrop-blur-[2px]"
    >
      <div className="flex items-center gap-3 border-b border-borda px-4">
        <Icone nome="buscar" tamanho={18} className="text-fraca" />
        <input
          ref={campo}
          value={consulta}
          onChange={(e) => setConsulta(e.target.value)}
          onKeyDown={aoTeclar}
          placeholder={textos.buscarPlaceholder}
          aria-label={textos.buscarFerramenta}
          aria-controls={idLista}
          aria-activedescendant={resultados.length ? `${idLista}-${ativo}` : undefined}
          role="combobox"
          aria-expanded="true"
          className="h-14 min-w-0 flex-1 bg-transparent text-[0.95rem] text-tinta placeholder:text-fraca focus:outline-none"
          style={{ outline: 'none' }}
        />
        <kbd className="hidden rounded border border-borda px-1.5 py-0.5 font-sans text-[0.6875rem] text-fraca sm:block">Esc</kbd>
      </div>
      <div className="max-h-[60vh] overflow-y-auto p-2">
        {!consulta.trim() ? <p className="px-2.5 pt-1 pb-2 text-xs font-semibold tracking-wide text-fraca uppercase">{textos.maisUsadas}</p> : null}
        {resultados.length ? (
          <ListaResultados id={idLista} resultados={resultados} ativo={ativo} setAtivo={setAtivo} aoEscolher={escolher} />
        ) : (
          <p className="px-3 py-8 text-center text-sm text-fraca">{textos.semResultados}</p>
        )}
      </div>
    </dialog>
  )
}

/** Atalho global de teclado para abrir a busca. */
export function useAtalhoBusca(abrir) {
  useEffect(() => {
    const aoTeclar = (e) => {
      const emCampo = e.target.closest?.('input, textarea, select, [contenteditable]')
      if ((e.key === 'k' || e.key === 'K') && (e.ctrlKey || e.metaKey)) {
        e.preventDefault()
        abrir()
      } else if (e.key === '/' && !emCampo) {
        e.preventDefault()
        abrir()
      }
    }
    addEventListener('keydown', aoTeclar)
    return () => removeEventListener('keydown', aoTeclar)
  }, [abrir])
}
