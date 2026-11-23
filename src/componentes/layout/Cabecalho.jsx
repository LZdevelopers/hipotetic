import { useCallback, useEffect, useRef, useState } from 'react'
import { categoriasComFerramentas, caminhoDa, ferramentasDaCategoria } from '../../ferramentas/catalogo'
import { definirTema, useTema } from '../../nucleo/preferencias'
import { Link, useRota } from '../../nucleo/roteador'
import { textos } from '../../textos'
import { Icone } from '../Icone'
import { Glifo } from '../inicio/Glifo'
import { SeloCategoria } from '../ui'
import { ehEditor } from '../ferramenta/Atalhos'
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
        <Link para="/converter" className="flex items-center gap-2.5 rounded-lg py-1 text-sm font-semibold text-tinta">
          <SeloCategoria categoria="conversor" icone="conversor" tamanho="p" />
          Conversor de arquivos
        </Link>
        <Link para="/ferramentas" className="flex items-center gap-2.5 rounded-lg py-1 text-sm font-semibold text-tinta">
          <SeloCategoria categoria="utilitarios" icone="lista" tamanho="p" />
          Todas as ferramentas
        </Link>
        {categoriasComFerramentas().map((c) => (
          <div key={c.id}>
            <p className="flex items-center gap-2.5 py-1 text-sm font-semibold text-tinta">
              <SeloCategoria categoria={c.id} icone={c.id} tamanho="p" />
              {c.nome}
            </p>
            <ul className="mt-1.5 ml-[2.6rem] flex flex-col">
              {[...ferramentasDaCategoria(c.id)].sort((x, y) => Number(ehEditor(y)) - Number(ehEditor(x))).map((f) => (
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

/**
 * Item de categoria do cabeçalho com menu suspenso: passar o mouse (ou focar
 * com o teclado) mostra as ferramentas da categoria. Atraso curto para não
 * "piscar" ao atravessar o menu; Esc ou escolher uma ferramenta fecha.
 */
function MenuCategoria({ categoria, ativo }) {
  const [aberto, setAberto] = useState(false)
  const timer = useRef(null)
  // O editor da categoria fica fixo no topo, em destaque; as outras ferramentas vêm abaixo.
  const todas = ferramentasDaCategoria(categoria.id)
  const editor = todas.find(ehEditor)
  const outras = todas.filter((f) => f !== editor)
  const abrir = () => {
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setAberto(true), 90)
  }
  const fechar = (atraso = 140) => {
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setAberto(false), atraso)
  }
  useEffect(() => () => clearTimeout(timer.current), [])
  const caixa = useRef(null)
  useEffect(() => {
    if (!aberto) return undefined
    const fora = (e) => !caixa.current?.contains(e.target) && setAberto(false)
    document.addEventListener('pointerdown', fora)
    return () => document.removeEventListener('pointerdown', fora)
  }, [aberto])

  return (
    <div
      ref={caixa}
      className="relative"
      onMouseEnter={abrir}
      onMouseLeave={() => fechar()}
      onFocus={abrir}
      onBlur={(e) => !e.currentTarget.contains(e.relatedTarget) && fechar(0)}
      onKeyDown={(e) => e.key === 'Escape' && fechar(0)}
    >
      <button
        type="button"
        aria-expanded={aberto}
        aria-haspopup="true"
        onClick={() => {
          clearTimeout(timer.current)
          setAberto((a) => !a)
        }}
        className={`flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm font-medium transition-colors 2xl:px-2.5 ${ativo || aberto ? 'bg-superficie-2 text-tinta' : 'text-suave hover:text-tinta'}`}
      >
        <Glifo nome={categoria.id} className="mr-0.5 size-[1.05rem]" style={{ color: `var(--color-cat-${categoria.id})`, '--b': 'var(--color-fundo)' }} />
        {categoria.nome}
        <Icone nome="setaBaixo" tamanho={14} className={`hidden text-fraca transition-transform duration-200 2xl:block ${aberto ? 'rotate-180' : ''}`} />
      </button>
      <div
        className={`absolute top-full left-1/2 z-50 w-[22rem] -translate-x-1/2 pt-2 transition-[opacity,translate] duration-200 ${aberto ? 'visible translate-y-0 opacity-100' : 'invisible -translate-y-1 opacity-0'}`}
      >
        <div className="overflow-hidden rounded-2xl border border-borda bg-superficie shadow-[var(--shadow-flutuante)]">
          <Link
            para="/converter"
            onClick={() => fechar(0)}
            tabIndex={aberto ? 0 : -1}
            className="flex items-start gap-3 border-b border-borda bg-fundo-suave px-4 py-3 transition-colors hover:bg-superficie-2"
          >
            <SeloCategoria categoria="conversor" icone="conversor" tamanho="p" />
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-tinta">Converter arquivos</span>
              <span className="block text-xs leading-snug text-fraca">Qualquer formato para outro: vídeo, áudio, imagem, PDF…</span>
            </span>
          </Link>
          {editor ? (
            <Link
              para={caminhoDa(editor)}
              onClick={() => fechar(0)}
              tabIndex={aberto ? 0 : -1}
              data-editor-menu=""
              className="mx-1.5 mt-1.5 flex items-start gap-3 rounded-xl border border-borda bg-superficie-2 px-2.5 py-2.5 transition-colors hover:border-borda-forte"
            >
              <SeloCategoria categoria={categoria.id} icone={editor.icone} tamanho="m" />
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-tinta">{editor.nome}</span>
                <span className="block text-xs leading-snug text-fraca">{editor.resumo}</span>
              </span>
            </Link>
          ) : null}
          <ul className="flex flex-col p-1.5">
            {outras.map((f) => (
              <li key={f.slug}>
                <Link para={caminhoDa(f)} onClick={() => fechar(0)} tabIndex={aberto ? 0 : -1} className="flex items-start gap-3 rounded-xl px-2.5 py-2 transition-colors hover:bg-superficie-2">
                  <SeloCategoria categoria={categoria.id} icone={f.icone} tamanho="p" />
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-tinta">{f.nome}</span>
                    <span className="block text-xs leading-snug text-fraca">{f.resumo}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          <Link para="/ferramentas" onClick={() => fechar(0)} tabIndex={aberto ? 0 : -1} className="flex items-center justify-between border-t border-borda bg-fundo-suave px-4 py-2.5 text-xs font-semibold text-suave hover:text-tinta">
            Todas as ferramentas
            <Icone nome="seta" tamanho={14} />
          </Link>
        </div>
      </div>
    </div>
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
      {/* Logo à esquerda, categorias no centro, busca e tema à direita. */}
      <div className="flex h-15 w-full items-center gap-4 px-4 sm:px-6 xl:grid xl:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] xl:gap-6">
        <Marca className="shrink-0 xl:justify-self-start" />

        <nav aria-label="Categorias" className="hidden items-center gap-0.5 xl:flex">
          {categoriasComFerramentas().map((c) => (
            <MenuCategoria key={c.id} categoria={c} ativo={categoriaAtual === c.id} />
          ))}
        </nav>

        <div className="ml-auto flex items-center justify-end gap-1.5 xl:ml-0 xl:justify-self-end">
          <button
            type="button"
            onClick={abrirBusca}
            aria-label={textos.buscarFerramenta}
            className="hidden h-9 w-[15rem] items-center gap-2 rounded-[var(--radius-controle)] border border-borda bg-superficie pr-1.5 pl-3 text-sm text-fraca transition-colors hover:border-borda-forte hover:text-suave sm:flex xl:w-[11.75rem] min-[1360px]:w-[15rem]"
          >
            <Icone nome="buscar" tamanho={16} className="shrink-0" />
            <span className="flex-1 text-left whitespace-nowrap">{textos.buscarFerramenta}</span>
            <kbd className="rounded-md border border-borda bg-fundo-suave px-1.5 py-px font-sans text-[0.6875rem] text-fraca xl:hidden min-[1360px]:inline">{mac ? '⌘K' : 'Ctrl K'}</kbd>
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
