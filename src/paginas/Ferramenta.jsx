import { Component, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { AvisoRecuperado } from '../componentes/editor/AvisoRecuperado'
import { Pilulas } from '../componentes/ListaFerramentas'
import { Icone } from '../componentes/Icone'
import { Aviso, Botao, SeloCategoria } from '../componentes/ui'
import { categoriaDa, corDa, ferramentasDaCategoria, populares } from '../ferramentas/catalogo'
import { ComponenteFerramenta } from '../ferramentas/carregador'
import { ContextoEdicao } from '../nucleo/edicao'
import { apagarTudo } from '../nucleo/rascunho'
import { ContextoSalvo } from '../nucleo/salvo'
import { registrarUso } from '../nucleo/preferencias'
import { Link } from '../nucleo/roteador'
import { textos } from '../textos'
import { ancoraDaFerramenta } from './Documentacao'

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
  // Mesma categoria; o conversor (sem categoria) mostra as mais usadas.
  const relacionadas = (categoria ? ferramentasDaCategoria(categoria.id) : populares())
    .filter((f) => f.slug !== ferramenta.slug)
    .slice(0, 8)
  const [emEdicao, setEmEdicao] = useState(false)

  // O que a pessoa estava fazendo nesta ferramenta fica salvo (nucleo/salvo.js).
  // Ao voltar, avisa e oferece começar do zero.
  const prefixo = `ferramenta:${ferramenta.slug}:`
  const [recuperadoEm, setRecuperadoEm] = useState(null)
  const [geracao, setGeracao] = useState(0)
  const descartando = useRef(false)
  const salvo = useMemo(() => ({ prefixo, descartando, aoRecuperar: (quando) => setRecuperadoEm((q) => q ?? quando ?? Date.now()) }), [prefixo])
  // Começar do zero: apaga o salvo antes de remontar a ferramenta (senão ela leria o antigo).
  const comecarDoZero = async () => {
    descartando.current = true
    setRecuperadoEm(null)
    await apagarTudo(prefixo)
    setGeracao((g) => g + 1)
  }
  // Só depois de remontar (a ferramenta antiga grava ao sair; durante o descarte, não).
  useEffect(() => {
    descartando.current = false
  }, [geracao])

  useEffect(() => registrarUso(ferramenta.slug), [ferramenta.slug])

  // Editores: ocupam a largura toda, com um título compacto.
  const cheia = Boolean(ferramenta.telaCheia)

  return (
    <div className={cheia ? 'w-full px-3 sm:px-4' : 'container-pagina'}>
      {cheia ? (
        <header className="flex flex-wrap items-center gap-x-3 gap-y-1 py-3">
          <SeloCategoria categoria={corDa(ferramenta)} icone={ferramenta.icone} tamanho="p" />
          <h1 className="text-base sm:text-lg">{ferramenta.titulo}</h1>
          <p className={`inline-flex items-center gap-1.5 text-xs font-medium ${ferramenta.servidor ? 'text-alerta' : 'text-sucesso'}`} title={textos.noNavegadorDetalhe}>
            <Icone nome={ferramenta.servidor ? 'servidor' : 'seguro'} tamanho={13} />
            {ferramenta.servidor ? textos.noServidor : textos.noNavegador}
          </p>
        </header>
      ) : null}
      <nav aria-label="Você está em" className={`pt-6 text-[0.8125rem] text-fraca ${cheia ? 'hidden' : ''}`}>
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
                <Link para={`/ferramentas#${categoria.id}`} className="hover:text-tinta">
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

      <header className={`mt-6 mb-8 flex flex-col gap-4 sm:flex-row sm:items-start ${cheia ? 'hidden' : ''}`}>
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

      {recuperadoEm ? <AvisoRecuperado quando={recuperadoEm} aoFechar={() => setRecuperadoEm(null)} aoRecomecar={comecarDoZero} /> : null}

      <LimiteErro key={ferramenta.slug}>
        <ContextoEdicao.Provider value={setEmEdicao}>
          <ContextoSalvo.Provider value={salvo}>
            <Suspense fallback={<Carregando />}>
              <ComponenteFerramenta key={geracao} ferramenta={ferramenta} />
            </Suspense>
          </ContextoSalvo.Provider>
        </ContextoEdicao.Provider>
      </LimiteErro>

      {/* Antes de começar (ou fora dos editores): link para a documentação e ferramentas relacionadas. Editando: só a ferramenta. */}
      {!emEdicao ? (
        <p className={`mt-16 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-suave ${cheia ? 'container-pagina' : ''}`}>
          <Icone nome="ajuda" tamanho={16} className="text-fraca" />
          {textos.duvidas}
          <Link para={`/documentacao#${ancoraDaFerramenta(ferramenta)}`} className="inline-flex items-center gap-1 font-semibold text-tinta underline decoration-borda-forte underline-offset-4 hover:decoration-tinta">
            Veja na documentação
            <Icone nome="seta" tamanho={14} />
          </Link>
        </p>
      ) : null}

      {!emEdicao && relacionadas.length ? (
        <section aria-labelledby="titulo-relacionadas" className={`mt-16 ${cheia ? 'container-pagina' : ''}`}>
          <h2 id="titulo-relacionadas" className="mb-4 text-xl">
            {textos.relacionadas}
          </h2>
          <Pilulas lista={relacionadas} />
        </section>
      ) : null}
    </div>
  )
}
