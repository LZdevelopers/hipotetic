import { useCallback, useEffect, useRef, useState } from 'react'
import { categoriasComFerramentas, caminhoDa, ferramentasDaCategoria } from '../../ferramentas/catalogo'
import { definirTema, useTema } from '../../nucleo/preferencias'
import { Link, useRota } from '../../nucleo/roteador'
import { textos } from '../../textos'
import { Icone } from '../Icone'
import { SeloCategoria } from '../ui'
import { PaletaBusca, useAtalhoBusca } from './Busca'
import { Marca } from './Marca'

function BotaoTema() {
  const tema = useTema()
  const escuro = tema === 'dark'
  return (
    <button
      type="button"
      onClick={() => definirTema(escuro ? 'light' : 'dark')}
      aria-label={escuro ? textos.temaClaro : textos.temaEscuro}
      title={escuro ? textos.temaClaro : textos.temaEscuro}
      className="grid size-9 place-items-center rounded-lg text-suave transition-colors hover:bg-superficie-2 hover:text-tinta"
    >
      <Icone nome={escuro ? 'claro' : 'escuro'} tamanho={18} />
    </button>
  )
}

/** Menu do celular: categorias e suas ferramentas, em uma gaveta. */
function MenuCelular({ aberto, aoFechar }) {
  const dialogo = useRef(null)
  const { caminho } = useRota()

  useEffect(() => {
    const d = dialogo.current
    if (aberto && !d.open) d.showModal()
    else if (!aberto && d.open) d.close()
  }, [aberto])

  // Navegou: fecha.
  useEffect(() => aoFechar(), [caminho, aoFechar])

  return (
    <dialog
      ref={dialogo}
      onClose={aoFechar}
      onClick={(e) => e.target === dialogo.current && aoFechar()}
      aria-label={textos.menu}
      className="m-0 ml-auto h-dvh max-h-dvh w-[min(22rem,100%)] max-w-none border-l border-borda bg-fundo p-0 text-texto backdrop:bg-sobreposicao"
    >
      <div className="flex h-15 items-center justify-between border-b border-borda px-4">
        <span className="text-sm font-semibold text-tinta">{textos.todasAsFerramentas}</span>
        <button type="button" onClick={aoFechar} aria-label={textos.fechar} className="grid size-9 place-items-center rounded-lg text-suave hover:bg-superficie-2">
          <Icone nome="fechar" tamanho={18} />
        </button>
      </div>
      <nav className="flex flex-col gap-5 overflow-y-auto p-4">
        {categoriasComFerramentas().map((c) => (
          <div key={c.id}>
            <Link para={`/${c.id}`} className="flex items-center gap-2.5 rounded-lg py-1 text-sm font-semibold text-tinta">
              <SeloCategoria categoria={c.id} icone={c.icone} tamanho="p" />
              {c.nome}
            </Link>
            <ul className="mt-1.5 ml-[2.6rem] flex flex-col">
              {ferramentasDaCategoria(c.id).map((f) => (
                <li key={f.slug}>
                  <Link para={caminhoDa(f)} className="block rounded-md py-1.5 text-sm text-suave hover:text-tinta">
                    {f.nome}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
    </dialog>
  )
}

export function Cabecalho() {
  const { caminho } = useRota()
  const [buscaAberta, setBuscaAberta] = useState(false)
  const [menuAberto, setMenuAberto] = useState(false)
  const abrirBusca = useCallback(() => setBuscaAberta(true), [])
  const fecharBusca = useCallback(() => setBuscaAberta(false), [])
  const fecharMenu = useCallback(() => setMenuAberto(false), [])
  useAtalhoBusca(abrirBusca)

  const categoriaAtual = caminho.split('/')[1]
  const [mac, setMac] = useState(false)
  useEffect(() => setMac(/Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)), [])

  return (
    <header className="sticky top-0 z-40 border-b border-borda bg-fundo/85 backdrop-blur-md supports-[not(backdrop-filter:blur(0))]:bg-fundo">
      <div className="container-pagina flex h-15 items-center gap-4">
        <Marca className="mr-2" />

        <nav aria-label="Categorias" className="hidden min-w-0 flex-1 items-center gap-0.5 xl:flex">
          {categoriasComFerramentas().map((c) => (
            <Link
              key={c.id}
              para={`/${c.id}`}
              aria-current={categoriaAtual === c.id ? 'page' : undefined}
              className={`rounded-lg px-2.5 py-1.5 text-sm font-medium transition-colors ${
                categoriaAtual === c.id ? 'bg-superficie-2 text-tinta' : 'text-suave hover:text-tinta'
              }`}
            >
              {c.nome}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-1.5">
          <button
            type="button"
            onClick={abrirBusca}
            className="hidden h-9 items-center gap-2 rounded-lg border border-borda bg-fundo-suave pr-1.5 pl-3 text-sm text-fraca transition-colors hover:border-borda-forte hover:text-suave sm:flex"
          >
            <Icone nome="buscar" tamanho={16} />
            <span className="w-28 text-left lg:w-36">{textos.buscarFerramenta}</span>
            <kbd className="rounded border border-borda bg-superficie px-1.5 py-px font-sans text-[0.6875rem]">{mac ? '⌘K' : 'Ctrl K'}</kbd>
          </button>
          <button
            type="button"
            onClick={abrirBusca}
            aria-label={textos.buscarFerramenta}
            className="grid size-9 place-items-center rounded-lg text-suave hover:bg-superficie-2 hover:text-tinta sm:hidden"
          >
            <Icone nome="buscar" tamanho={18} />
          </button>
          <BotaoTema />
          <button
            type="button"
            onClick={() => setMenuAberto(true)}
            aria-label={textos.menu}
            className="grid size-9 place-items-center rounded-lg text-suave hover:bg-superficie-2 hover:text-tinta xl:hidden"
          >
            <Icone nome="menu" tamanho={19} />
          </button>
        </div>
      </div>
      <PaletaBusca aberta={buscaAberta} aoFechar={fecharBusca} />
      <MenuCelular aberto={menuAberto} aoFechar={fecharMenu} />
    </header>
  )
}
