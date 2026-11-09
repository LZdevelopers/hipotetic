import { useId, useRef, useState } from 'react'
import { Icone } from '../componentes/Icone'
import { Indice, Pilulas } from '../componentes/ListaFerramentas'
import { ListaResultados, useBuscaTeclado } from '../componentes/layout/Busca'
import { SeloCategoria } from '../componentes/ui'
import { caminhoDa, ferramentaPorSlug, ferramentas, populares } from '../ferramentas/catalogo'
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
    <section aria-labelledby="titulo-recentes" className="mt-12">
      <div className="mb-4 flex items-baseline justify-between gap-4">
        <h2 id="titulo-recentes" className="text-lg">
          {textos.recentes}
        </h2>
        <button type="button" onClick={limpar} className="text-xs font-semibold text-fraca hover:text-tinta">
          {textos.limparRecentes}
        </button>
      </div>
      <Pilulas lista={lista} />
    </section>
  )
}

export function Inicio() {
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

      <Link
        para="/converter"
        className="group mt-12 flex flex-col items-start gap-5 rounded-[var(--radius-cartao)] border border-borda bg-superficie p-6 transition-[border-color,box-shadow] duration-200 hover:border-borda-forte hover:shadow-[var(--shadow-cartao)] sm:flex-row sm:items-center sm:p-7"
      >
        <SeloCategoria categoria="conversor" icone="substituir" tamanho="g" />
        <span className="min-w-0 flex-1">
          <span className="block font-display text-xl font-bold text-tinta">Conversor de arquivos</span>
          <span className="mt-1 block text-sm text-suave">Solte qualquer arquivo — vídeo, áudio, imagem, PDF, documento ou compactado — e escolha para qual formato converter.</span>
        </span>
        <span className="inline-flex h-11 shrink-0 items-center gap-2 rounded-xl bg-marca px-5 text-sm font-semibold text-sobre-marca transition-colors group-hover:bg-marca-hover">
          Converter arquivos
          <Icone nome="seta" tamanho={16} />
        </span>
      </Link>

      <Recentes />

      <section id="ferramentas" aria-labelledby="titulo-ferramentas" className="mt-16 scroll-mt-24">
        <div className="mb-6 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
          <h2 id="titulo-ferramentas" className="text-2xl">
            Todas as ferramentas
          </h2>
          <p className="text-sm text-fraca">{ferramentas.length} ferramentas · grátis, sem cadastro e sem marca d’água</p>
        </div>
        <Indice />
      </section>

      <ul className="mt-20 grid gap-8 border-t border-borda pt-12 sm:grid-cols-3">
        {inicio.principios.map((p) => (
          <li key={p.titulo} className="flex gap-3.5">
            <Icone nome={p.icone} tamanho={20} className="mt-0.5 text-fraca" />
            <div>
              <h3 className="text-base">{p.titulo}</h3>
              <p className="mt-1 text-sm text-suave">{p.texto}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
