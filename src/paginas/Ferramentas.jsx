import { useEffect, useMemo, useState } from 'react'
import { Icone } from '../componentes/Icone'
import { GradeCartoes } from '../componentes/ListaFerramentas'
import { categoriaPorId, categoriasComFerramentas, ferramentaPorSlug, ferramentasDaCategoria, normalizar } from '../ferramentas/catalogo'

/**
 * Todas as ferramentas, no jeito do iLovePDF: título grande, filtros em
 * pílulas no centro e uma grade de cartões. /ferramentas#audio abre filtrado.
 */
export function Ferramentas() {
  const cats = categoriasComFerramentas()
  const [aba, setAba] = useState('todas')
  const [busca, setBusca] = useState('')

  useEffect(() => {
    const ler = () => {
      const id = decodeURIComponent(location.hash.slice(1))
      if (categoriaPorId(id)) setAba(id)
    }
    ler()
    addEventListener('hashchange', ler)
    return () => removeEventListener('hashchange', ler)
  }, [])

  const escolher = (id) => {
    setAba(id)
    history.replaceState(null, '', id === 'todas' ? '/ferramentas' : `/ferramentas#${id}`)
  }

  const termo = normalizar(busca.trim())
  const lista = useMemo(() => {
    const confere = (f) => !termo || termo.split(/\s+/).every((p) => normalizar([f.nome, f.resumo, ...(f.termos ?? [])].join(' ')).includes(p))
    const conversor = ferramentaPorSlug('converter')
    const todas = [...(aba === 'todas' && conversor ? [conversor] : []), ...cats.filter((c) => aba === 'todas' || c.id === aba).flatMap((c) => ferramentasDaCategoria(c.id))]
    return todas.filter(confere)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aba, termo])

  const contagem = (id) => (id === 'todas' ? cats.reduce((s, c) => s + ferramentasDaCategoria(c.id).length, 1) : ferramentasDaCategoria(id).length)

  return (
    <div className="container-pagina pt-12 sm:pt-16">
      <header className="mx-auto max-w-3xl text-center">
        <h1 className="text-[clamp(2rem,4.6vw,3.2rem)] leading-[1.08] font-extrabold tracking-[-0.03em]">Todas as ferramentas para os seus arquivos</h1>
        <p className="mt-4 text-base text-suave sm:text-lg">Vídeo, áudio, imagens, PDF, documentos e compactados. Grátis, sem cadastro e, quase sempre, sem enviar nada para ninguém.</p>
      </header>

      <div className="mt-9 flex flex-col items-center gap-4">
        <div role="tablist" aria-label="Categorias" className="flex max-w-full flex-wrap justify-center gap-2">
          {[{ id: 'todas', nome: 'Todas' }, ...cats].map((c) => {
            const ativa = aba === c.id
            return (
              <button
                key={c.id}
                type="button"
                role="tab"
                aria-selected={ativa}
                onClick={() => escolher(c.id)}
                className={`inline-flex h-10 items-center gap-2 rounded-full border px-4 text-sm font-semibold transition-colors ${ativa ? 'border-marca bg-marca text-sobre-marca' : 'border-borda bg-superficie text-suave hover:border-borda-forte hover:text-tinta'}`}
              >
                {c.id !== 'todas' ? <span className="size-2 rounded-full" style={{ backgroundColor: `var(--color-cat-${c.id})` }} /> : null}
                {c.nome}
                <span className={`text-xs tabular-nums ${ativa ? 'opacity-70' : 'text-fraca'}`}>{contagem(c.id)}</span>
              </button>
            )
          })}
        </div>
        <label className="relative w-full max-w-sm">
          <span className="sr-only">Filtrar ferramentas</span>
          <Icone nome="buscar" tamanho={16} className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-fraca" />
          <input
            type="search"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Filtrar: cortar, mp3, pdf…"
            className="h-10 w-full rounded-full border border-borda bg-superficie pr-4 pl-10 text-sm text-tinta placeholder:text-fraca focus:border-acento focus:outline-none"
          />
        </label>
      </div>

      <div key={`${aba}|${termo}`} className="mt-10">
        {lista.length ? (
          <GradeCartoes lista={lista} rotulo="Ferramentas" />
        ) : (
          <p className="py-16 text-center text-suave">
            Nenhuma ferramenta com “{busca}”.{' '}
            <button type="button" className="font-semibold text-tinta underline" onClick={() => setBusca('')}>
              Limpar a busca
            </button>
          </p>
        )}
      </div>
    </div>
  )
}
