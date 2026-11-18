import { useState } from 'react'
import { Icone } from '../componentes/Icone'
import { Pilulas } from '../componentes/ListaFerramentas'
import { Anel, Bloco3D, Faisca, useInclinacao } from '../componentes/inicio/Objetos3D'
import { caminhoDa, categoriasComFerramentas, ferramentaPorSlug, ferramentas, ferramentasDaCategoria } from '../ferramentas/catalogo'
import { entregar } from '../nucleo/entrega'
import { useRecentes } from '../nucleo/preferencias'
import { Link, useRota } from '../nucleo/roteador'
import { inicio, textos } from '../textos'

/*
 * Página inicial: apresenta o site. Identidade LZdev: preto e branco; cor viva
 * só nos ícones (blocos 3D em CSS puro, componentes/inicio/Objetos3D.jsx).
 * Cada ação aparece uma vez só:
 *   - converter  → a janela de soltar arquivo da abertura;
 *   - ver tudo   → o botão da abertura (as categorias levam a cada aba).
 */

const LARGURA = 'mx-auto w-full max-w-[84rem] px-4 sm:px-6 lg:px-8'
const TITULO_SECAO = 'text-[clamp(1.9rem,3.6vw,2.9rem)] leading-[1.08] font-extrabold tracking-[-0.03em]'

/** Linha fina entre as seções. */
function Divisor() {
  return <div aria-hidden="true" className="mx-auto h-px max-w-[84rem] bg-[linear-gradient(90deg,transparent,var(--color-borda-forte),transparent)]" />
}

/** Mancha de luz neutra (sem cor) atrás de uma cena 3D. */
function Halo({ className = '' }) {
  return <span aria-hidden="true" className={`pointer-events-none absolute rounded-[50%] bg-[radial-gradient(closest-side,color-mix(in_oklab,var(--color-tinta)_9%,transparent),transparent)] ${className}`} />
}

// ─── 1. Abertura ──────────────────────────────────────────────────────────────

/** Janela de vidro onde se solta um arquivo: ele abre no conversor. */
function SoltarArquivo() {
  const { navegar } = useRota()
  const [sobre, setSobre] = useState(false)
  const enviar = (lista) => {
    if (!lista?.length) return
    entregar('converter', [...lista])
    navegar('/converter')
  }
  return (
    <div
      className="absolute inset-x-[15%] top-[12%] bottom-[16%] flex flex-col overflow-hidden rounded-3xl border border-borda-forte bg-superficie/80 shadow-[0_40px_80px_-30px_rgb(0_0_0/0.35)] backdrop-blur-xl transition-transform duration-700 ease-[var(--ease-suave)] escuro:shadow-[0_40px_90px_-30px_rgb(0_0_0/0.9)]"
      style={{ transform: 'rotateY(calc(-11deg + var(--mx, 0) * 5deg)) rotateX(calc(5deg - var(--my, 0) * 4deg))' }}
    >
      <div className="flex h-9 shrink-0 items-center gap-1.5 border-b border-borda px-4">
        <span className="size-2.5 rounded-full bg-superficie-3" />
        <span className="size-2.5 rounded-full bg-superficie-3" />
        <span className="size-2.5 rounded-full bg-superficie-3" />
        <span className="ml-auto text-[0.6875rem] font-semibold tracking-wide text-fraca uppercase">{inicio.soltar.janela}</span>
      </div>
      <label
        onDragOver={(e) => {
          e.preventDefault()
          setSobre(true)
        }}
        onDragLeave={() => setSobre(false)}
        onDrop={(e) => {
          e.preventDefault()
          setSobre(false)
          enviar(e.dataTransfer.files)
        }}
        className={`m-3 flex flex-1 cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-4 text-center transition-colors sm:m-4 ${sobre ? 'border-tinta bg-superficie-2' : 'border-borda-forte hover:border-fraca'}`}
      >
        <input type="file" multiple className="sr-only" aria-label={inicio.soltar.rotulo} onChange={(e) => enviar(e.target.files)} />
        <Bloco3D cor="conversor" glifo="nuvem" tamanho="clamp(3rem, 6.5vw, 4.5rem)" rot={[10, 0, 0]} amp={6} sombra={false} className="mb-2" />
        <span className="font-display text-[clamp(0.9375rem,1.5vw,1.1875rem)] leading-tight font-bold text-tinta">{inicio.soltar.titulo}</span>
        <span className="text-sm text-suave">
          {inicio.soltar.ou} <span className="font-semibold text-tinta underline decoration-borda-forte underline-offset-4">{inicio.soltar.escolher}</span>
        </span>
        <span className="hidden text-xs text-fraca sm:block">{inicio.soltar.dica}</span>
      </label>
    </div>
  )
}

function CenaAbertura({ className = '' }) {
  const ref = useInclinacao()
  const t = 'clamp(3.25rem, 7.5vw, 5.5rem)'
  return (
    <div ref={ref} className={`relative aspect-[1.3] w-full ${className}`} style={{ perspective: '1400px' }}>
      <Halo className="inset-x-[8%] inset-y-[10%]" />
      <Anel className="inset-x-[2%] top-[36%] h-[40%]" style={{ rotate: '-8deg' }} />
      <Faisca className="top-[3%] left-[40%]" atraso={0.4} />
      <Faisca className="bottom-[3%] left-[28%]" atraso={1.6} tamanho={11} />
      <Faisca className="top-[22%] right-[0%]" atraso={2.2} tamanho={12} />
      <SoltarArquivo />
      <Bloco3D cor="video" tamanho={t} rot={[10, 24, -8]} atraso={0} className="!absolute top-[4%] left-[4%]" />
      <Bloco3D cor="audio" tamanho={t} rot={[8, 28, 7]} atraso={2.1} className="!absolute top-[38%] left-[-1%]" />
      <Bloco3D cor="imagem" tamanho={t} rot={[14, 20, -5]} atraso={4} className="!absolute top-[68%] left-[8%]" />
      <Bloco3D cor="pdf" tamanho={t} rot={[10, -24, 9]} atraso={1.2} className="!absolute top-[2%] right-[4%]" />
      <Bloco3D cor="documentos" tamanho={t} rot={[8, -28, -6]} atraso={3.2} className="!absolute top-[37%] right-[-1%]" />
      <Bloco3D cor="compactados" tamanho={t} rot={[14, -22, 11]} atraso={5} className="!absolute top-[67%] right-[7%]" />
    </div>
  )
}

/**
 * Abertura em layout editorial: a cena 3D grande no alto, à direita; o título
 * enorme ancorado embaixo, à esquerda; o texto e o único botão no canto
 * oposto, alinhados à base do título.
 */
function Abertura() {
  return (
    <section className="relative isolate">
      <div className={`${LARGURA} flex min-h-[calc(100svh-3.75rem)] flex-col justify-end gap-10 pt-6 pb-14 lg:gap-6 lg:pb-12`}>
        <CenaAbertura className="mx-auto max-w-[44rem] lg:-mb-24 lg:w-[51%] lg:max-w-none" />
        <div className="grid items-end gap-x-12 gap-y-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <h1 className="animate-surgir text-[clamp(2.6rem,5vw,5.5rem)] leading-[1] font-extrabold tracking-[-0.045em]">
            {inicio.titulo[0]} <span className="text-fraca">{inicio.titulo[1]}</span>
          </h1>
          <div className="animate-surgir lg:pb-2" style={{ animationDelay: '80ms' }}>
            <p className="text-base leading-relaxed text-suave">{inicio.subtitulo}</p>
            <Link
              para="/ferramentas"
              className="group mt-6 inline-flex h-12 items-center gap-2.5 rounded-[var(--radius-controle)] bg-marca px-5 text-[0.9375rem] font-semibold text-sobre-marca transition-colors hover:bg-marca-hover"
            >
              {inicio.explorar(ferramentas.length)}
              <Icone nome="seta" tamanho={17} className="transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}

// ─── 2. Tudo em um só lugar ───────────────────────────────────────────────────

function CenaPasta() {
  const ref = useInclinacao()
  return (
    <div ref={ref} className="relative mx-auto aspect-[1.08] w-full max-w-[36rem]">
      <Halo className="inset-x-[6%] bottom-[4%] h-[30%]" />
      <Anel className="inset-x-[4%] bottom-[8%] h-[24%]" />
      <Anel className="inset-x-[16%] bottom-[13%] h-[14%] opacity-60" />
      <Faisca className="top-[6%] left-[12%]" atraso={1} />
      <Faisca className="top-[30%] right-[4%]" atraso={2.4} tamanho={11} />
      <Faisca className="bottom-[34%] left-[2%]" atraso={0.3} tamanho={12} />
      <Bloco3D cor="video" tamanho="clamp(5rem, 13vw, 8rem)" rot={[6, 20, -12]} atraso={1.4} amp={8} sombra={false} className="!absolute top-[12%] left-[16%]" />
      <Bloco3D cor="documentos" tamanho="clamp(5.25rem, 13.5vw, 8.5rem)" rot={[6, 0, 5]} atraso={2.8} amp={8} sombra={false} className="!absolute top-[4%] left-[38%]" />
      <Bloco3D cor="pasta" glifo="pasta" tamanho="clamp(8rem, 21vw, 13rem)" rot={[14, -16, 0]} atraso={0} amp={12} duracao={7} className="!absolute top-[28%] left-[26%]" />
      <Bloco3D cor="pdf" tamanho="clamp(3rem, 7vw, 4.5rem)" rot={[10, -26, 10]} atraso={3.6} className="!absolute top-[12%] right-[8%]" />
      <Bloco3D cor="imagem" tamanho="clamp(3rem, 7vw, 4.5rem)" rot={[10, -24, -8]} atraso={0.8} className="!absolute top-[44%] right-[2%]" />
      <Bloco3D cor="audio" tamanho="clamp(2.75rem, 6vw, 4rem)" rot={[12, 24, 8]} atraso={2} className="!absolute top-[56%] left-[4%]" />
    </div>
  )
}

function TudoNumLugar() {
  return (
    <section aria-labelledby="titulo-tudo" className="relative isolate">
      <div className={`${LARGURA} grid min-h-[88svh] items-center gap-x-14 gap-y-16 py-28 sm:py-36 lg:grid-cols-[1fr_1.1fr]`}>
        <CenaPasta />
        <div>
          <h2 id="titulo-tudo" className={TITULO_SECAO}>
            {inicio.tudo.titulo(ferramentas.length)}
          </h2>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-suave sm:text-lg">{inicio.tudo.texto}</p>
          <ul className="mt-10 grid gap-3 sm:grid-cols-2">
            {inicio.tudo.destaques.map((d, i) => {
              const f = ferramentaPorSlug(d.slug)
              if (!f) return null
              return (
                <li key={d.slug}>
                  <Link
                    para={caminhoDa(f)}
                    className="bloco3d-link group flex h-full items-start gap-4 rounded-2xl border border-borda bg-superficie p-4 transition-colors hover:border-borda-forte hover:bg-superficie-2"
                  >
                    <Bloco3D cor={d.cor} glifo={d.glifo} tamanho="3.25rem" rot={[10, -16, 0]} atraso={i * 1.3} amp={4} sombra={false} />
                    <span className="min-w-0">
                      <span className="flex items-center gap-1.5 font-display text-base font-bold text-tinta">
                        {d.titulo}
                        <Icone nome="seta" tamanho={14} className="text-fraca opacity-0 transition-[opacity,translate] group-hover:translate-x-0.5 group-hover:opacity-100" />
                      </span>
                      <span className="mt-1 block text-sm leading-snug text-suave">{d.texto}</span>
                    </span>
                  </Link>
                </li>
              )
            })}
          </ul>
        </div>
      </div>
    </section>
  )
}

// ─── 3. Categorias ────────────────────────────────────────────────────────────

function Recentes() {
  const [slugs, limpar] = useRecentes()
  const lista = slugs.map(ferramentaPorSlug).filter(Boolean)
  if (!lista.length) return null
  return (
    <section aria-labelledby="titulo-recentes" className="mt-20 flex flex-col items-center">
      <div className="mb-4 flex items-baseline gap-4">
        <h3 id="titulo-recentes" className="text-sm font-semibold text-suave">
          {textos.recentes}
        </h3>
        <button type="button" onClick={limpar} className="text-xs font-semibold text-fraca hover:text-tinta">
          {textos.limparRecentes}
        </button>
      </div>
      <Pilulas lista={lista.slice(0, 6)} />
    </section>
  )
}

function Categorias() {
  const ref = useInclinacao()
  const lista = categoriasComFerramentas()
  const meio = (lista.length - 1) / 2
  return (
    <section aria-labelledby="titulo-categorias" className="relative isolate">
      <div ref={ref} className={`${LARGURA} flex min-h-[88svh] flex-col items-center justify-center py-28 text-center sm:py-36`}>
        <h2 id="titulo-categorias" className={`max-w-3xl ${TITULO_SECAO}`}>
          {inicio.categorias.titulo}
        </h2>
        <p className="mt-5 max-w-2xl text-base leading-relaxed text-suave sm:text-lg">{inicio.categorias.texto}</p>

        <div className="relative mt-20 w-full">
          <Anel className="inset-x-[3%] top-[30%] h-[42%] max-sm:hidden" />
          <Halo className="inset-x-[10%] top-[38%] h-[40%]" />
          <Faisca className="top-[-8%] left-[8%]" atraso={0.6} />
          <Faisca className="top-[-14%] right-[14%]" atraso={1.8} tamanho={11} />
          <Faisca className="bottom-[-4%] left-[46%]" atraso={2.6} tamanho={12} />
          <ul className="relative flex flex-wrap justify-center gap-x-5 gap-y-12 sm:gap-x-8">
            {lista.map((c, i) => {
              const quantas = inicio.categorias.quantas(ferramentasDaCategoria(c.id).length)
              return (
                <li key={c.id}>
                  <Link para={`/ferramentas#${c.id}`} aria-label={`${c.nome}: ${quantas}`} className="bloco3d-link group flex flex-col items-center gap-7 rounded-3xl">
                    <Bloco3D cor={c.id} rotulo={c.nome} tamanho="clamp(5.75rem, 10.5vw, 8.5rem)" rot={[12, (meio - i) * 7, 0]} atraso={i * 0.8} />
                    <span className="text-sm font-medium text-suave transition-colors group-hover:text-tinta">{quantas}</span>
                  </Link>
                </li>
              )
            })}
          </ul>
        </div>
        <Recentes />
      </div>
    </section>
  )
}

// ─── 4. Privacidade ───────────────────────────────────────────────────────────

function CenaEscudo() {
  const ref = useInclinacao()
  return (
    <div ref={ref} className="relative mx-auto grid aspect-square w-full max-w-[30rem] place-items-center">
      <Halo className="inset-x-[4%] bottom-[8%] h-[32%]" />
      <Anel className="inset-x-[2%] bottom-[12%] h-[26%]" />
      <Anel className="inset-x-[14%] bottom-[16%] h-[17%] opacity-70" />
      <Anel className="inset-x-[26%] bottom-[19%] h-[10%] opacity-50" />
      <Faisca className="top-[10%] left-[14%]" atraso={0.2} />
      <Faisca className="top-[22%] right-[10%]" atraso={1.5} tamanho={12} />
      <Faisca className="bottom-[40%] left-[6%]" atraso={2.5} tamanho={10} />
      <Bloco3D cor="escudo" glifo="escudo" tamanho="clamp(8.5rem, 22vw, 13rem)" rot={[12, -14, 0]} amp={12} duracao={7} className="-mt-[12%]" />
    </div>
  )
}

function Privacidade() {
  return (
    <section aria-labelledby="titulo-privacidade" className="relative isolate">
      <div className={`${LARGURA} grid min-h-[88svh] items-center gap-x-14 gap-y-12 py-28 sm:py-36 lg:grid-cols-[0.9fr_1.1fr]`}>
        <CenaEscudo />
        <div>
          <h2 id="titulo-privacidade" className={TITULO_SECAO}>
            {inicio.privacidade.titulo}
          </h2>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-suave sm:text-lg">{inicio.privacidade.texto}</p>
          <ul className="mt-10 flex flex-col gap-6">
            {inicio.principios.map((p, i) => (
              <li key={p.titulo} className="flex items-start gap-5">
                <Bloco3D cor={p.glifo} glifo={p.glifo} tamanho="3.5rem" rot={[10, -16, 0]} atraso={i * 1.5} amp={4} sombra={false} />
                <div>
                  <h3 className="text-lg">{p.titulo}</h3>
                  <p className="mt-1 max-w-lg text-[0.9375rem] leading-relaxed text-suave">{p.texto}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}

export function Inicio() {
  return (
    <div data-pagina-inicio="" className="overflow-x-clip">
      <Abertura />
      <Divisor />
      <TudoNumLugar />
      <Divisor />
      <Categorias />
      <Divisor />
      <Privacidade />
    </div>
  )
}
