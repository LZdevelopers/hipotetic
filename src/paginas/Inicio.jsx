import { useId, useRef, useState } from 'react'
import { CartaoFerramenta, GradeFerramentas } from '../componentes/CartaoFerramenta'
import { Icone } from '../componentes/Icone'
import { ListaResultados, useBuscaTeclado } from '../componentes/layout/Busca'
import { SeloCategoria } from '../componentes/ui'
import { caminhoDa, categoriasComFerramentas, ferramentaPorSlug, ferramentasDaCategoria, populares } from '../ferramentas/catalogo'
import { useRecentes } from '../nucleo/preferencias'
import { Link, useRota } from '../nucleo/roteador'
import { inicio, textos } from '../textos'

/** Campo de busca do topo: os resultados aparecem logo abaixo, como um menu. */
function BuscaPrincipal() {
  const { navegar } = useRota()
  const [consulta, setConsulta] = useState('')
  const [foco, setFoco] = useState(false)
  const idLista = useId()
  const caixa = useRef(null)
  const escolher = (f) => navegar(caminhoDa(f))
  const { resultados, ativo, setAtivo, aoTeclar } = useBuscaTeclado(consulta, escolher, { vaziaMostraPopulares: false })
  const aberto = foco && consulta.trim().length > 0

  return (
    <div
      ref={caixa}
      className="relative w-full max-w-2xl"
      onFocus={() => setFoco(true)}
      onBlur={(e) => {
        if (!caixa.current.contains(e.relatedTarget)) setFoco(false)
      }}
    >
      <div className="flex h-14 items-center gap-3 rounded-2xl border border-borda-forte bg-superficie px-4 shadow-[var(--shadow-cartao)] transition-colors focus-within:border-acento">
        <Icone nome="buscar" tamanho={20} className="text-fraca" />
        <input
          type="search"
          value={consulta}
          onChange={(e) => setConsulta(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setConsulta('')
            aoTeclar(e)
          }}
          placeholder={textos.buscarPlaceholder}
          aria-label={textos.buscarFerramenta}
          role="combobox"
          aria-expanded={aberto}
          aria-controls={idLista}
          aria-activedescendant={aberto && resultados.length ? `${idLista}-${ativo}` : undefined}
          className="h-full min-w-0 flex-1 bg-transparent text-base text-tinta placeholder:text-fraca focus:outline-none [&::-webkit-search-cancel-button]:hidden"
          style={{ outline: 'none' }}
        />
      </div>
      {aberto ? (
        <div className="absolute inset-x-0 top-[calc(100%+0.5rem)] z-30 max-h-[22rem] overflow-y-auto rounded-2xl border border-borda bg-superficie p-2 text-left shadow-[var(--shadow-flutuante)]">
          {resultados.length ? (
            <ListaResultados id={idLista} resultados={resultados} ativo={ativo} setAtivo={setAtivo} aoEscolher={escolher} />
          ) : (
            <p className="px-3 py-6 text-center text-sm text-fraca">{textos.semResultados}</p>
          )}
        </div>
      ) : null}
    </div>
  )
}

function Recentes() {
  const [slugs, limpar] = useRecentes()
  const lista = slugs.map(ferramentaPorSlug).filter(Boolean)
  if (!lista.length) return null
  return (
    <section aria-labelledby="titulo-recentes" className="mt-14">
      <div className="mb-4 flex items-baseline justify-between gap-4">
        <h2 id="titulo-recentes" className="text-lg">
          {textos.recentes}
        </h2>
        <button type="button" onClick={limpar} className="text-xs font-semibold text-fraca hover:text-tinta">
          {textos.limparRecentes}
        </button>
      </div>
      <GradeFerramentas lista={lista} mostrarCategoria />
    </section>
  )
}

export function Inicio() {
  const cats = categoriasComFerramentas()
  const atalhos = populares().slice(0, 6)

  return (
    <div className="container-pagina">
      <section className="flex flex-col items-center pt-14 pb-2 text-center sm:pt-20">
        <h1 className="max-w-4xl text-[clamp(2rem,5.4vw,3.6rem)] leading-[1.05] font-extrabold tracking-[-0.035em]">
          {inicio.titulo[0]} <span className="text-fraca">{inicio.titulo[1]}</span>
        </h1>
        <p className="mt-5 max-w-2xl text-base text-suave sm:text-lg">{inicio.subtitulo}</p>
        <div className="mt-8 flex w-full justify-center">
          <BuscaPrincipal />
        </div>
        <ul className="mt-4 flex max-w-2xl flex-wrap justify-center gap-2" aria-label={textos.maisUsadas}>
          {atalhos.map((f) => (
            <li key={f.slug}>
              <Link
                para={caminhoDa(f)}
                className="inline-flex h-8 items-center rounded-full border border-borda bg-superficie px-3 text-[0.8125rem] font-medium text-suave transition-colors hover:border-borda-forte hover:text-tinta"
              >
                {f.nome}
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <Recentes />

      <section aria-labelledby="titulo-categorias" className="mt-16">
        <h2 id="titulo-categorias" className="sr-only">
          {inicio.categorias}
        </h2>
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cats.map((c) => (
            <li key={c.id} className="cartao flex flex-col p-5">
              <Link para={`/${c.id}`} className="group flex items-center gap-3">
                <SeloCategoria categoria={c.id} icone={c.icone} />
                <span className="flex items-center gap-1.5 font-display text-lg font-bold text-tinta">
                  {c.nome}
                  <Icone nome="seta" tamanho={16} className="text-fraca transition-transform duration-200 group-hover:translate-x-0.5" />
                </span>
              </Link>
              <ul className="mt-4 flex flex-col">
                {ferramentasDaCategoria(c.id).map((f) => (
                  <li key={f.slug}>
                    <Link para={caminhoDa(f)} className="-mx-2 flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 text-sm text-suave transition-colors hover:bg-superficie-2 hover:text-tinta">
                      {f.nome}
                      {f.servidor ? <Icone nome="servidor" tamanho={13} className="text-fraca" aria-label="usa o servidor" /> : null}
                    </Link>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="titulo-como" className="mt-20 grid gap-10 border-t border-borda pt-14 lg:grid-cols-[18rem_minmax(0,1fr)]">
        <div>
          <h2 id="titulo-como" className="text-2xl">
            {inicio.comoFunciona.titulo}
          </h2>
          <p className="mt-2 text-sm text-suave">Grátis, sem cadastro e, quase sempre, sem enviar seus arquivos para ninguém.</p>
        </div>
        <ol className="grid gap-8 sm:grid-cols-3">
          {inicio.comoFunciona.passos.map((p, i) => (
            <li key={p.titulo}>
              <span className="flex items-center gap-3">
                <span className="grid size-9 place-items-center rounded-full border border-borda-forte text-sm font-bold text-tinta tabular-nums">{i + 1}</span>
                <Icone nome={p.icone} tamanho={18} className="text-fraca" />
              </span>
              <h3 className="mt-4 text-base">{p.titulo}</h3>
              <p className="mt-1.5 text-sm text-suave">{p.texto}</p>
            </li>
          ))}
        </ol>
      </section>
    </div>
  )
}

export { CartaoFerramenta }
