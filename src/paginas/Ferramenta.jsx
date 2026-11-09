import { Component, Suspense, useEffect } from 'react'
import { GradeFerramentas } from '../componentes/CartaoFerramenta'
import { Icone } from '../componentes/Icone'
import { Aviso, Botao, SeloCategoria } from '../componentes/ui'
import { categoriaDa, corDa, ferramentasDaCategoria } from '../ferramentas/catalogo'
import { ComponenteFerramenta } from '../ferramentas/carregador'
import { registrarUso } from '../nucleo/preferencias'
import { Link } from '../nucleo/roteador'
import { textos } from '../textos'

/** Erro inesperado dentro de uma ferramenta: não derruba a página inteira. */
class LimiteErro extends Component {
  state = { erro: null }
  static getDerivedStateFromError(erro) {
    return { erro }
  }
  componentDidCatch(erro) {
    console.error(erro)
  }
  render() {
    if (!this.state.erro) return this.props.children
    const falhaDeRede = /dynamically imported module|Failed to fetch|Importing a module script failed/i.test(String(this.state.erro?.message))
    return (
      <Aviso
        tom="erro"
        titulo={falhaDeRede ? 'Não foi possível carregar a ferramenta' : 'A ferramenta encontrou um erro'}
        acao={
          <Botao variante="secundario" tamanho="p" icone="refazer" onClick={() => location.reload()}>
            Recarregar a página
          </Botao>
        }
      >
        {falhaDeRede
          ? 'Confira sua conexão. Se o site acabou de ser atualizado, recarregar resolve.'
          : 'Recarregue a página e tente de novo. Se continuar, tente com outro arquivo.'}
      </Aviso>
    )
  }
}

function Carregando() {
  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]" aria-busy="true" aria-label={textos.carregandoFerramenta}>
      <div className="esqueleto h-56 rounded-[var(--radius-cartao)]" />
      <div className="esqueleto h-56 rounded-[var(--radius-cartao)]" />
    </div>
  )
}

export function Ferramenta({ ferramenta }) {
  const categoria = categoriaDa(ferramenta)
  const relacionadas = (categoria ? ferramentasDaCategoria(categoria.id) : [])
    .filter((f) => f.slug !== ferramenta.slug && f.modulo !== ferramenta.modulo)
    .slice(0, 6)

  useEffect(() => registrarUso(ferramenta.slug), [ferramenta.slug])

  return (
    <div className="container-pagina">
      <nav aria-label="Você está em" className="pt-6 text-[0.8125rem] text-fraca">
        <ol className="flex flex-wrap items-center gap-1.5">
          <li>
            <Link para="/" className="hover:text-tinta">
              {textos.inicio}
            </Link>
          </li>
          {categoria ? (
            <>
              <li aria-hidden="true">/</li>
              <li>
                <Link para={`/${categoria.id}`} className="hover:text-tinta">
                  {categoria.nome}
                </Link>
              </li>
            </>
          ) : null}
          <li aria-hidden="true">/</li>
          <li aria-current="page" className="text-suave">
            {ferramenta.nome}
          </li>
        </ol>
      </nav>

      <header className="mt-6 mb-8 flex flex-col gap-4 sm:flex-row sm:items-start">
        <SeloCategoria categoria={corDa(ferramenta)} icone={ferramenta.icone} tamanho="g" />
        <div className="min-w-0 flex-1">
          <h1 className="text-[clamp(1.6rem,3.4vw,2.25rem)]">{ferramenta.titulo}</h1>
          <p className="mt-2 max-w-3xl text-[0.9375rem] text-suave">{ferramenta.descricao}</p>
          <p
            className={`mt-3 inline-flex items-center gap-1.5 text-xs font-medium ${ferramenta.servidor ? 'text-alerta' : 'text-sucesso'}`}
            title={ferramenta.servidor ? (ferramenta.servidorDetalhe ?? textos.noServidorDetalhe) : textos.noNavegadorDetalhe}
          >
            <Icone nome={ferramenta.servidor ? 'servidor' : 'seguro'} tamanho={14} />
            {ferramenta.servidor ? textos.noServidor : textos.noNavegador}
            <span className="font-normal text-fraca">
              · {ferramenta.servidor ? (ferramenta.servidorDetalhe ?? textos.noServidorDetalhe) : textos.noNavegadorDetalhe}
            </span>
          </p>
        </div>
      </header>

      <LimiteErro key={ferramenta.slug}>
        <Suspense fallback={<Carregando />}>
          <ComponenteFerramenta ferramenta={ferramenta} />
        </Suspense>
      </LimiteErro>

      {!ferramenta.enxuta && (ferramenta.passos?.length || ferramenta.perguntas?.length) ? (
        <div className="mt-20 grid gap-12 lg:grid-cols-2">
          {ferramenta.passos?.length ? (
            <section aria-labelledby="titulo-passos">
              <h2 id="titulo-passos" className="text-xl">
                {textos.comoUsar}
              </h2>
              <ol className="mt-5 flex flex-col gap-4">
                {ferramenta.passos.map((p, i) => (
                  <li key={i} className="flex gap-3.5">
                    <span className="grid size-7 shrink-0 place-items-center rounded-full border border-borda-forte text-xs font-bold text-tinta tabular-nums">
                      {i + 1}
                    </span>
                    <p className="pt-0.5 text-sm text-suave">{p}</p>
                  </li>
                ))}
              </ol>
            </section>
          ) : null}
          {ferramenta.perguntas?.length ? (
            <section aria-labelledby="titulo-perguntas">
              <h2 id="titulo-perguntas" className="text-xl">
                {textos.perguntas}
              </h2>
              <div className="mt-5 divide-y divide-borda border-y border-borda">
                {ferramenta.perguntas.map((q) => (
                  <details key={q.p} className="group py-1">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-3 text-sm font-semibold text-tinta [&::-webkit-details-marker]:hidden">
                      {q.p}
                      <Icone nome="setaBaixo" tamanho={16} className="text-fraca transition-transform group-open:rotate-180" />
                    </summary>
                    <p className="pb-4 text-sm text-suave">{q.r}</p>
                  </details>
                ))}
              </div>
            </section>
          ) : null}
        </div>
      ) : null}

      {!ferramenta.enxuta && relacionadas.length ? (
        <section aria-labelledby="titulo-relacionadas" className="mt-20">
          <h2 id="titulo-relacionadas" className="mb-4 text-xl">
            {textos.relacionadas}
          </h2>
          <GradeFerramentas lista={relacionadas} />
        </section>
      ) : null}
    </div>
  )
}
