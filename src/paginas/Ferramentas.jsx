import { useEffect, useMemo, useState } from 'react'
import { Icone } from '../componentes/Icone'
import { GradeCartoes } from '../componentes/ListaFerramentas'
import { SeloCategoria } from '../componentes/ui'
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
    <div className="mx-auto w-full max-w-[118rem] px-4 pt-12 sm:px-8 sm:pt-16">
      <header className="mx-auto max-w-4xl text-center">
        <h1 className="text-[clamp(2.2rem,4.2vw,3.5rem)] leading-[1.06] font-extrabold tracking-[-0.03em]">Todas as ferramentas para os seus arquivos</h1>
        <p className="mt-5 text-lg text-suave sm:text-xl">Vídeo, áudio, imagens, PDF, documentos e compactados. Grátis, sem cadastro e, quase sempre, sem enviar nada para ninguém.</p>
      </header>

      <div className="mt-10 flex flex-col items-center gap-5">
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
                className={`inline-flex h-12 items-center gap-2.5 rounded-full border px-5 text-base font-semibold transition-colors ${ativa ? 'border-marca bg-marca text-sobre-marca' : 'border-borda bg-superficie text-texto hover:border-borda-forte hover:text-tinta'}`}
              >
                {c.id !== 'todas' ? <SeloCategoria categoria={c.id} icone={c.id} tamanho="pp" className="-ml-2.5 !rounded-full" /> : null}
                {c.nome}
                <span className={`text-xs tabular-nums ${ativa ? 'opacity-70' : 'text-fraca'}`}>{contagem(c.id)}</span>
              </button>
            )
          })}
        </div>
        <label className="relative w-full max-w-md">
          <span className="sr-only">Filtrar ferramentas</span>
          <Icone nome="buscar" tamanho={18} className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-fraca" />
          <input
            type="search"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Filtrar: cortar, mp3, pdf…"
            className="h-12 w-full rounded-full border border-borda bg-superficie pr-4 pl-11 text-base text-tinta placeholder:text-fraca focus:border-acento focus:outline-none"
          />
        </label>
      </div>

      <div key={`${aba}|${termo}`} className="mt-12">
        {lista.length ? (
          <GradeCartoes lista={lista} rotulo="Ferramentas" grande />
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
