import { useEffect, useMemo, useState } from 'react'
import { Icone } from '../componentes/Icone'
import { SeloCategoria } from '../componentes/ui'
import { caminhoDa, categoriaPorId, categoriasComFerramentas, ferramentaPorSlug, ferramentasDaCategoria, normalizar } from '../ferramentas/catalogo'
import { Link } from '../nucleo/roteador'

/** Uma ferramenta: ícone na cor da categoria, nome, o que faz. */
function Item({ f, cor, atraso }) {
  return (
    <li className="animate-surgir" style={{ animationDelay: `${atraso}ms` }}>
      <Link para={caminhoDa(f)} className="group flex h-full items-start gap-3.5 rounded-2xl p-3 transition-colors hover:bg-superficie-2">
        <span
          className="grid size-11 shrink-0 place-items-center rounded-xl transition-transform duration-200 group-hover:scale-105"
          style={{ color: `var(--color-cat-${cor})`, backgroundColor: `color-mix(in oklab, var(--color-cat-${cor}) 12%, transparent)` }}
        >
          <Icone nome={f.icone} tamanho={21} />
        </span>
        <span className="min-w-0 flex-1 pt-0.5">
          <span className="flex items-center gap-1.5 font-semibold text-tinta">
            {f.nome}
            {f.servidor ? <Icone nome="servidor" tamanho={12} className="text-fraca" aria-label="usa o servidor" /> : null}
            <Icone nome="seta" tamanho={15} className="-translate-x-1 text-fraca opacity-0 transition-all duration-200 group-hover:translate-x-0 group-hover:opacity-100" />
          </span>
          <span className="mt-0.5 block text-sm leading-snug text-suave">{f.resumo}</span>
        </span>
      </Link>
    </li>
  )
}

/**
 * Todas as ferramentas: abas por categoria (com contagem), busca que filtra
 * na hora e as ferramentas agrupadas. /ferramentas#audio abre já na aba.
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
  const confere = (f) => !termo || termo.split(/\s+/).every((p) => normalizar([f.nome, f.resumo, ...(f.termos ?? [])].join(' ')).includes(p))
  const grupos = useMemo(
    () =>
      cats
        .filter((c) => aba === 'todas' || c.id === aba)
        .map((c) => ({ c, lista: ferramentasDaCategoria(c.id).filter(confere) }))
        .filter((g) => g.lista.length),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [aba, termo],
  )
  const conversor = ferramentaPorSlug('converter')
  const total = grupos.reduce((s, g) => s + g.lista.length, 0)

  return (
    <div className="container-pagina pt-10">
      <header className="flex flex-col gap-2">
        <h1 className="text-[clamp(1.9rem,4vw,2.75rem)]">Todas as ferramentas</h1>
        <p className="max-w-2xl text-suave">Grátis, sem cadastro e sem marca d’água. Quase tudo roda no seu navegador, sem enviar seus arquivos.</p>
      </header>

      {/* Busca + abas (ficam presas no topo ao rolar) */}
      <div className="sticky top-15 z-20 mt-8 border-b border-borda bg-fundo/90 py-3 backdrop-blur-md">
        <div className="flex flex-col gap-3">
          <label className="relative max-w-md">
            <span className="sr-only">Filtrar ferramentas</span>
            <Icone nome="buscar" tamanho={16} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-fraca" />
            <input
              type="search"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Filtrar: cortar, mp3, pdf…"
              className="h-10 w-full rounded-xl border border-borda-forte bg-superficie pr-3 pl-9 text-sm text-tinta placeholder:text-fraca focus:border-acento focus:outline-none"
            />
          </label>
          <div role="tablist" aria-label="Categorias" className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1 sm:flex-wrap sm:overflow-visible sm:pb-0">
            {[{ id: 'todas', nome: 'Todas' }, ...cats].map((c) => {
              const n = c.id === 'todas' ? cats.reduce((s, x) => s + ferramentasDaCategoria(x.id).length, 0) : ferramentasDaCategoria(c.id).length
              const ativa = aba === c.id
              return (
                <button
                  key={c.id}
                  type="button"
                  role="tab"
                  aria-selected={ativa}
                  onClick={() => escolher(c.id)}
                  className={`inline-flex h-9 shrink-0 items-center gap-2 rounded-full px-3.5 text-sm font-medium whitespace-nowrap transition-colors ${ativa ? 'bg-marca text-sobre-marca' : 'text-suave hover:bg-superficie-2 hover:text-tinta'}`}
                >
                  {c.id !== 'todas' ? <span className="size-2 rounded-full" style={{ backgroundColor: `var(--color-cat-${c.id})` }} /> : null}
                  {c.nome}
                  <span className={`text-xs tabular-nums ${ativa ? 'opacity-70' : 'text-fraca'}`}>{n}</span>
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {aba === 'todas' && conversor && confere(conversor) ? (
        <Link
          para="/converter"
          className="group mt-8 flex items-center gap-4 rounded-2xl border border-borda bg-superficie p-4 transition-colors hover:border-borda-forte sm:p-5"
        >
          <SeloCategoria categoria="conversor" icone="substituir" tamanho="g" />
          <span className="min-w-0 flex-1">
            <span className="block font-display text-lg font-bold text-tinta">Conversor de arquivos</span>
            <span className="block text-sm text-suave">{conversor.resumo}</span>
          </span>
          <Icone nome="seta" tamanho={18} className="text-fraca transition-transform group-hover:translate-x-0.5" />
        </Link>
      ) : null}

      <div key={`${aba}|${termo}`} className="mt-8 flex flex-col gap-12">
        {grupos.map(({ c, lista }, gi) => (
          <section key={c.id} id={c.id} aria-labelledby={`cat-${c.id}`} className="grid scroll-mt-48 gap-4 lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-10">
            <div className="lg:sticky lg:top-48 lg:self-start">
              <div className="flex items-center gap-3">
                <SeloCategoria categoria={c.id} icone={c.icone} />
                <h2 id={`cat-${c.id}`} className="text-xl">
                  {c.nome}
                </h2>
              </div>
              <p className="mt-2 hidden text-sm text-fraca lg:block">{c.descricao}</p>
            </div>
            <ul className="grid gap-1 sm:grid-cols-2">
              {lista.map((f, i) => (
                <Item key={f.slug} f={f} cor={c.id} atraso={Math.min(gi * 40 + i * 25, 400)} />
              ))}
            </ul>
          </section>
        ))}
        {!total ? (
          <p className="py-16 text-center text-suave">
            Nenhuma ferramenta com “{busca}”.{' '}
            <button type="button" className="font-semibold text-tinta underline" onClick={() => setBusca('')}>
              Limpar a busca
            </button>
          </p>
        ) : null}
      </div>
    </div>
  )
}
