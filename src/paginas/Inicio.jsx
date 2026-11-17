import { useState } from 'react'
import { Icone } from '../componentes/Icone'
import { Pilulas } from '../componentes/ListaFerramentas'
import { Glifo } from '../componentes/inicio/Glifo'
import { Anel, Bloco3D, Faisca, useInclinacao } from '../componentes/inicio/Objetos3D'
import { caminhoDa, categoriasComFerramentas, ferramentaPorSlug, ferramentas, ferramentasDaCategoria } from '../ferramentas/catalogo'
import { entregar } from '../nucleo/entrega'
import { useRecentes } from '../nucleo/preferencias'
import { Link, useRota } from '../nucleo/roteador'
import { inicio, textos } from '../textos'

/*
 * Página inicial: apresenta o site (o que é, o que dá para fazer, por que é
 * privado). Cada seção ocupa bastante altura; os objetos 3D são CSS puro
 * (componentes/inicio/Objetos3D.jsx), sem biblioteca de 3D.
 */

const LARGURA = 'mx-auto w-full max-w-[84rem] px-4 sm:px-6 lg:px-8'
const BOTAO_PRINCIPAL =
  'group inline-flex h-12 items-center gap-2.5 rounded-2xl bg-[linear-gradient(135deg,#5b8cff,#3d5ce0)] px-6 text-[0.9375rem] font-semibold text-white shadow-[0_10px_30px_-10px_#3d5ce0] transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-[0_16px_36px_-12px_#3d5ce0]'
const BOTAO_SECUNDARIO =
  'inline-flex h-12 items-center gap-2 rounded-2xl border border-borda-forte bg-superficie/60 px-6 text-[0.9375rem] font-semibold text-tinta backdrop-blur transition-colors hover:border-fraca hover:bg-superficie'

function Selo({ children }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-acento/25 bg-acento-suave px-3 py-1 text-xs font-semibold text-acento">
      <Glifo nome="raio" className="size-3.5" />
      {children}
    </span>
  )
}

/** Luzes difusas do fundo de uma seção. */
function Luzes({ posicoes }) {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      {posicoes.map(([classe, cor], i) => (
        <span key={i} className={`absolute rounded-full opacity-[0.14] blur-[90px] escuro:opacity-[0.22] ${classe}`} style={{ background: cor }} />
      ))}
    </div>
  )
}

/** Linha suave entre as seções. */
function Divisor() {
  return <div aria-hidden="true" className="mx-auto h-px max-w-[84rem] bg-[linear-gradient(90deg,transparent,var(--color-borda-forte),transparent)]" />
}

// ─── 1. Abertura ──────────────────────────────────────────────────────────────

/** Janela de vidro onde dá para soltar um arquivo: ele abre no conversor. */
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
      className="absolute inset-x-[16%] top-[13%] bottom-[17%] flex flex-col overflow-hidden rounded-3xl border border-borda-forte bg-superficie/75 shadow-[0_40px_80px_-30px_rgb(0_0_0/0.45)] backdrop-blur-xl transition-transform duration-700 ease-[var(--ease-suave)] escuro:bg-superficie/70 escuro:shadow-[0_40px_90px_-30px_rgb(0_0_0/0.9),0_0_0_1px_rgb(110_168_255/0.08)]"
      style={{ transform: 'rotateY(calc(-11deg + var(--mx, 0) * 5deg)) rotateX(calc(5deg - var(--my, 0) * 4deg))' }}
    >
      <div className="flex h-9 shrink-0 items-center gap-1.5 border-b border-borda px-4">
        <span className="size-2.5 rounded-full bg-[#ff5f57]" />
        <span className="size-2.5 rounded-full bg-[#febc2e]" />
        <span className="size-2.5 rounded-full bg-[#28c840]" />
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
        className={`m-3 flex flex-1 cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-4 text-center transition-colors sm:m-4 ${sobre ? 'border-acento bg-acento-suave' : 'border-borda-forte hover:border-acento/60'}`}
      >
        <input type="file" multiple className="sr-only" aria-label={inicio.soltar.rotulo} onChange={(e) => enviar(e.target.files)} />
        <Bloco3D cor="conversor" glifo="nuvem" tamanho="clamp(3rem, 7vw, 4.5rem)" rot={[10, 0, 0]} amp={6} sombra={false} className="mb-2" />
        <span className="font-display text-[clamp(0.9375rem,1.6vw,1.1875rem)] leading-tight font-bold text-tinta">{inicio.soltar.titulo}</span>
        <span className="text-sm text-suave">
          {inicio.soltar.ou} <span className="font-semibold text-acento">{inicio.soltar.escolher}</span>
        </span>
        <span className="hidden text-xs text-fraca sm:block">{inicio.soltar.dica}</span>
      </label>
    </div>
  )
}

function CenaAbertura() {
  const ref = useInclinacao()
  const t = 'clamp(3.25rem, 8.5vw, 5.75rem)'
  return (
    <div ref={ref} className="relative mx-auto aspect-[1.12] w-full max-w-[40rem]" style={{ perspective: '1400px' }}>
      <Anel className="inset-x-[-2%] top-[34%] h-[44%]" style={{ rotate: '-9deg' }} />
      <Faisca className="top-[4%] left-[38%]" atraso={0.4} />
      <Faisca className="top-[88%] left-[30%]" atraso={1.6} tamanho={11} />
      <Faisca className="top-[18%] right-[-2%]" atraso={2.2} tamanho={12} />
      <Faisca className="right-[30%] bottom-[2%]" atraso={0.9} />
      <SoltarArquivo />
      <Bloco3D cor="video" tamanho={t} rot={[10, 24, -8]} atraso={0} className="!absolute top-[5%] left-[3%]" />
      <Bloco3D cor="audio" tamanho={t} rot={[8, 28, 7]} atraso={2.1} className="!absolute top-[37%] left-[-3%]" />
      <Bloco3D cor="imagem" tamanho={t} rot={[14, 20, -5]} atraso={4} className="!absolute top-[67%] left-[7%]" />
      <Bloco3D cor="pdf" tamanho={t} rot={[10, -24, 9]} atraso={1.2} className="!absolute top-[3%] right-[2%]" />
      <Bloco3D cor="documentos" tamanho={t} rot={[8, -28, -6]} atraso={3.2} className="!absolute top-[36%] right-[-3%]" />
      <Bloco3D cor="compactados" tamanho={t} rot={[14, -22, 11]} atraso={5} className="!absolute top-[66%] right-[5%]" />
    </div>
  )
}

function Recentes() {
  const [slugs, limpar] = useRecentes()
  const lista = slugs.map(ferramentaPorSlug).filter(Boolean)
  if (!lista.length) return null
  return (
    <section aria-labelledby="titulo-recentes" className="mt-10">
      <div className="mb-3 flex items-baseline gap-4">
        <h2 id="titulo-recentes" className="text-sm font-semibold text-suave">
          {textos.recentes}
        </h2>
        <button type="button" onClick={limpar} className="text-xs font-semibold text-fraca hover:text-tinta">
          {textos.limparRecentes}
        </button>
      </div>
      <Pilulas lista={lista.slice(0, 6)} />
    </section>
  )
}

function Abertura() {
  return (
    <section className="relative isolate">
      <Luzes posicoes={[['-top-40 right-[-10%] size-[42rem]', '#3d5ce0'], ['top-[40%] left-[-15%] size-[30rem]', '#7c3aed']]} />
      <div className={`${LARGURA} grid min-h-[calc(100svh-3.75rem)] items-center gap-x-10 gap-y-14 py-16 lg:grid-cols-[1.05fr_1fr] lg:py-20`}>
        <div className="animate-surgir">
          <Selo>{inicio.selo}</Selo>
          <h1 className="mt-6 text-[clamp(2.4rem,5.6vw,4.4rem)] leading-[1.02] font-extrabold tracking-[-0.04em]">
            {inicio.titulo[0]}{' '}
            <span className="bg-[linear-gradient(90deg,#5b8cff,#8b6cff)] bg-clip-text text-transparent">{inicio.titulo[1]}</span>
          </h1>
          <p className="mt-6 max-w-xl text-base leading-relaxed text-suave sm:text-lg">{inicio.subtitulo}</p>
          <div className="mt-9 flex flex-wrap gap-3">
            <Link para="/ferramentas" className={BOTAO_PRINCIPAL}>
              {inicio.explorar}
              <Icone nome="seta" tamanho={17} className="transition-transform group-hover:translate-x-0.5" />
            </Link>
            <Link para="/converter" className={BOTAO_SECUNDARIO}>
              {inicio.converter}
            </Link>
          </div>
          <Recentes />
        </div>
        <CenaAbertura />
      </div>
    </section>
  )
}

// ─── 2. Tudo em um só lugar ───────────────────────────────────────────────────

function CenaPasta() {
  const ref = useInclinacao()
  return (
    <div ref={ref} className="relative mx-auto aspect-[1.08] w-full max-w-[36rem]">
      {/* pedestal */}
      <span aria-hidden="true" className="absolute inset-x-[6%] bottom-[4%] h-[30%] rounded-[50%] bg-[radial-gradient(closest-side,color-mix(in_oklab,var(--color-acento)_22%,transparent),transparent)]" />
      <Anel className="inset-x-[4%] bottom-[8%] h-[24%]" />
      <Anel className="inset-x-[16%] bottom-[13%] h-[14%] opacity-60" />
      <Faisca className="top-[6%] left-[12%]" atraso={1} />
      <Faisca className="top-[30%] right-[4%]" atraso={2.4} tamanho={11} />
      <Faisca className="bottom-[34%] left-[2%]" atraso={0.3} tamanho={12} />
      {/* arquivos saindo da pasta */}
      <Bloco3D cor="video" tamanho="clamp(5rem, 13vw, 8rem)" rot={[6, 20, -12]} atraso={1.4} amp={8} sombra={false} className="!absolute top-[12%] left-[16%]" />
      <Bloco3D cor="documentos" tamanho="clamp(5.25rem, 13.5vw, 8.5rem)" rot={[6, 0, 5]} atraso={2.8} amp={8} sombra={false} className="!absolute top-[4%] left-[38%]" />
      {/* a pasta */}
      <Bloco3D cor="pasta" glifo="pasta" tamanho="clamp(8rem, 21vw, 13rem)" rot={[14, -16, 0]} atraso={0} amp={12} duracao={7} className="!absolute top-[28%] left-[26%]" />
      {/* soltos em volta */}
      <Bloco3D cor="pdf" tamanho="clamp(3rem, 7vw, 4.5rem)" rot={[10, -26, 10]} atraso={3.6} className="!absolute top-[12%] right-[8%]" />
      <Bloco3D cor="imagem" tamanho="clamp(3rem, 7vw, 4.5rem)" rot={[10, -24, -8]} atraso={0.8} className="!absolute top-[44%] right-[2%]" />
      <Bloco3D cor="audio" tamanho="clamp(2.75rem, 6vw, 4rem)" rot={[12, 24, 8]} atraso={2} className="!absolute top-[56%] left-[4%]" />
    </div>
  )
}

function TudoNumLugar() {
  return (
    <section aria-labelledby="titulo-tudo" className="relative isolate">
      <Luzes posicoes={[['top-[20%] left-[-10%] size-[34rem]', '#3d5ce0']]} />
      <div className={`${LARGURA} grid min-h-[88svh] items-center gap-x-14 gap-y-16 py-28 sm:py-36 lg:grid-cols-[1fr_1.1fr]`}>
        <CenaPasta />
        <div>
          <Selo>{inicio.tudo.selo}</Selo>
          <h2 id="titulo-tudo" className="mt-5 text-[clamp(1.9rem,3.6vw,2.9rem)] leading-[1.08] font-extrabold tracking-[-0.03em]">
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
                    className="bloco3d-link group flex h-full items-start gap-4 rounded-2xl border border-borda bg-superficie/60 p-4 backdrop-blur transition-colors hover:border-borda-forte hover:bg-superficie"
                  >
                    <Bloco3D cor={d.cor ?? d.glifo} glifo={d.glifo} tamanho="3.25rem" rot={[10, -16, 0]} atraso={i * 1.3} amp={4} sombra={false} />
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

function Categorias() {
  const ref = useInclinacao()
  const lista = categoriasComFerramentas()
  const meio = (lista.length - 1) / 2
  return (
    <section aria-labelledby="titulo-categorias" className="relative isolate">
      <Luzes posicoes={[['bottom-[-10%] left-[20%] size-[40rem]', '#7c3aed'], ['top-[10%] right-[-10%] size-[26rem]', '#3d5ce0']]} />
      <div ref={ref} className={`${LARGURA} flex min-h-[88svh] flex-col items-center justify-center py-28 text-center sm:py-36`}>
        <Selo>{inicio.categorias.selo(lista.length)}</Selo>
        <h2 id="titulo-categorias" className="mt-5 max-w-3xl text-[clamp(1.9rem,3.6vw,2.9rem)] leading-[1.08] font-extrabold tracking-[-0.03em]">
          {inicio.categorias.titulo}
        </h2>
        <p className="mt-5 max-w-2xl text-base leading-relaxed text-suave sm:text-lg">{inicio.categorias.texto}</p>

        <div className="relative mt-20 w-full">
          <Anel className="inset-x-[3%] top-[30%] h-[42%] max-sm:hidden" />
          <span aria-hidden="true" className="absolute inset-x-[10%] top-[38%] h-[40%] rounded-[50%] bg-[radial-gradient(closest-side,color-mix(in_oklab,var(--color-acento)_16%,transparent),transparent)]" />
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

        <Link para="/ferramentas" className={`${BOTAO_SECUNDARIO} mt-16`}>
          {inicio.categorias.todas}
          <Icone nome="seta" tamanho={16} />
        </Link>
      </div>
    </section>
  )
}

// ─── 4. Privacidade ───────────────────────────────────────────────────────────

function CenaEscudo() {
  const ref = useInclinacao()
  return (
    <div ref={ref} className="relative mx-auto grid aspect-square w-full max-w-[30rem] place-items-center">
      <span aria-hidden="true" className="absolute inset-x-[4%] bottom-[8%] h-[32%] rounded-[50%] bg-[radial-gradient(closest-side,color-mix(in_oklab,var(--color-acento)_24%,transparent),transparent)]" />
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
      <Luzes posicoes={[['top-[25%] right-[0%] size-[34rem]', '#3d5ce0']]} />
      <div className={`${LARGURA} grid min-h-[88svh] items-center gap-x-14 gap-y-12 py-28 sm:py-36 lg:grid-cols-[0.9fr_1.1fr]`}>
        <CenaEscudo />
        <div>
          <Selo>{inicio.privacidade.selo}</Selo>
          <h2 id="titulo-privacidade" className="mt-5 text-[clamp(1.9rem,3.6vw,2.9rem)] leading-[1.08] font-extrabold tracking-[-0.03em]">
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

// ─── 5. Chamada final ─────────────────────────────────────────────────────────

function Final() {
  const ref = useInclinacao()
  return (
    <section aria-labelledby="titulo-final" className={`${LARGURA} py-24 sm:py-32`}>
      <div
        ref={ref}
        className="relative isolate overflow-hidden rounded-[2rem] border border-borda-forte bg-superficie/70 px-6 py-20 text-center sm:px-12 sm:py-24 escuro:bg-[linear-gradient(160deg,#141a2e,#0f1013_60%)]"
      >
        <Luzes posicoes={[['top-[-40%] left-[30%] size-[30rem]', '#3d5ce0']]} />
        <Bloco3D cor="video" tamanho="4.5rem" rot={[10, 24, -10]} atraso={0.5} sombra={false} className="!absolute top-[14%] left-[6%] max-md:hidden" />
        <Bloco3D cor="pdf" tamanho="4rem" rot={[10, 20, 8]} atraso={2.5} sombra={false} className="!absolute bottom-[14%] left-[12%] max-md:hidden" />
        <Bloco3D cor="audio" tamanho="4.25rem" rot={[10, -24, 9]} atraso={1.5} sombra={false} className="!absolute top-[16%] right-[7%] max-md:hidden" />
        <Bloco3D cor="compactados" tamanho="3.75rem" rot={[10, -20, -8]} atraso={3.5} sombra={false} className="!absolute right-[13%] bottom-[14%] max-md:hidden" />
        <h2 id="titulo-final" className="mx-auto max-w-2xl text-[clamp(1.9rem,3.6vw,2.9rem)] leading-[1.08] font-extrabold tracking-[-0.03em]">
          {inicio.final.titulo}
        </h2>
        <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-suave sm:text-lg">{inicio.final.texto}</p>
        <div className="mt-9 flex flex-wrap justify-center gap-3">
          <Link para="/ferramentas" className={BOTAO_PRINCIPAL}>
            {inicio.explorar}
            <Icone nome="seta" tamanho={17} className="transition-transform group-hover:translate-x-0.5" />
          </Link>
          <Link para="/converter" className={BOTAO_SECUNDARIO}>
            {inicio.converter}
          </Link>
        </div>
      </div>
    </section>
  )
}

export function Inicio() {
  return (
    <div className="overflow-x-clip">
      <Abertura />
      <Divisor />
      <TudoNumLugar />
      <Divisor />
      <Categorias />
      <Divisor />
      <Privacidade />
      <Final />
    </div>
  )
}
