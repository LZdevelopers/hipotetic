import { useEffect, useRef, useState } from 'react'
import { entregar } from '../../nucleo/entrega'
import { useRota } from '../../nucleo/roteador'
import { inicio } from '../../textos'
import { SeloCategoria } from '../ui'
import { Glifo } from './Glifo'
import { Anel, Bloco3D, Faisca, useInclinacao } from './Objetos3D'

/*
 * Palco da abertura: uma "máquina de conversão" ao vivo.
 *   - no centro, a janela do conversor mostra conversões acontecendo em ciclo
 *     (e aceita um arquivo solto: ele abre no conversor de verdade);
 *   - em volta, os blocos das categorias giram numa órbita 3D (os de trás
 *     passam por trás da janela, menores e apagados);
 *   - embaixo, um piso em grade em perspectiva.
 * Com "reduzir movimento", tudo fica parado.
 */

/** Exemplos da demonstração (só conversões que o site faz no navegador). */
const EXEMPLOS = [
  { acao: 'Extrair o áudio', de: ['video', 'viagem.mp4', '48 MB'], para: ['audio', 'viagem.mp3', '4,1 MB'] },
  { acao: 'Comprimir imagem', de: ['imagem', 'foto.png', '6,2 MB'], para: ['imagem', 'foto.webp', '870 KB'] },
  { acao: 'Comprimir PDF', de: ['pdf', 'relatorio.pdf', '12 MB'], para: ['pdf', 'relatorio.pdf', '2,3 MB'] },
  { acao: 'Converter vídeo', de: ['video', 'clipe.mov', '210 MB'], para: ['video', 'clipe.mp4', '64 MB'] },
  { acao: 'Converter áudio', de: ['audio', 'gravacao.wav', '31 MB'], para: ['audio', 'gravacao.mp3', '2,8 MB'] },
  { acao: 'Compactar', de: ['compactados', 'fotos.zip', '85 MB'], para: ['compactados', 'fotos.7z', '71 MB'] },
]
const CONVERTE_MS = 1900
const CICLO_MS = 4400

const semMovimento = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches

function Arquivo({ dados, visivel = true }) {
  const [cor, nome, tamanho] = dados
  return (
    <span className={`flex w-[clamp(5.5rem,22%,8rem)] flex-col items-center gap-2 text-center transition-[opacity,translate,filter] duration-500 ${visivel ? 'opacity-100' : 'translate-y-1 opacity-0 blur-[2px]'}`}>
      <SeloCategoria categoria={cor} icone={cor} tamanho="g" />
      <span className="w-full truncate font-mono text-[0.6875rem] font-semibold text-tinta sm:text-xs">{nome}</span>
      <span className="-mt-1.5 font-mono text-[0.625rem] text-fraca sm:text-[0.6875rem]">{tamanho}</span>
    </span>
  )
}

/** A janela do conversor: demonstração em ciclo + área para soltar arquivo. */
function JanelaConversor() {
  const { navegar } = useRota()
  const [sobre, setSobre] = useState(false)
  const [n, setN] = useState(0)
  const [pronto, setPronto] = useState(false)

  useEffect(() => {
    if (semMovimento()) {
      setPronto(true)
      return undefined
    }
    let timers = []
    const ciclo = (k) => {
      setN(k)
      setPronto(false)
      timers = [setTimeout(() => setPronto(true), CONVERTE_MS), setTimeout(() => ciclo((k + 1) % EXEMPLOS.length), CICLO_MS)]
    }
    ciclo(0)
    return () => timers.forEach(clearTimeout)
  }, [])

  const enviar = (lista) => {
    if (!lista?.length) return
    entregar('converter', [...lista])
    navegar('/converter')
  }
  const ex = EXEMPLOS[n]

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault()
        setSobre(true)
      }}
      onDragLeave={(e) => !e.currentTarget.contains(e.relatedTarget) && setSobre(false)}
      onDrop={(e) => {
        e.preventDefault()
        setSobre(false)
        enviar(e.dataTransfer.files)
      }}
      className={`absolute inset-x-[5%] top-[4%] bottom-[31%] z-[2] flex flex-col overflow-hidden rounded-3xl border bg-superficie/80 shadow-[0_40px_80px_-30px_rgb(0_0_0/0.35)] backdrop-blur-xl transition-[transform,border-color] duration-700 ease-[var(--ease-suave)] escuro:shadow-[0_40px_90px_-30px_rgb(0_0_0/0.9)] sm:inset-x-[13%] ${sobre ? 'border-tinta' : 'border-borda-forte'}`}
      style={{ transform: 'rotateY(calc(-9deg + var(--mx, 0) * 5deg)) rotateX(calc(5deg - var(--my, 0) * 4deg))' }}
    >
      {/* barra da janela */}
      <div className="flex h-9 shrink-0 items-center gap-1.5 border-b border-borda px-4">
        <span className="size-2.5 rounded-full bg-superficie-3" />
        <span className="size-2.5 rounded-full bg-superficie-3" />
        <span className="size-2.5 rounded-full bg-superficie-3" />
        <span className="ml-auto text-[0.6875rem] font-semibold tracking-wide text-fraca uppercase">{inicio.soltar.janela}</span>
      </div>

      {/* demonstração */}
      <div className="flex flex-1 flex-col items-center justify-center gap-3 px-3 sm:gap-4 sm:px-5" aria-hidden="true">
        <span key={`acao${n}`} className="animate-surgir font-mono text-[0.625rem] font-semibold tracking-[0.14em] text-fraca uppercase sm:text-[0.6875rem]">
          {ex.acao}
        </span>
        <div className="flex w-full items-start justify-center gap-1 sm:gap-3">
          <Arquivo key={`de${n}`} dados={ex.de} />
          <svg viewBox="0 0 80 12" className="mt-4 h-3 w-[clamp(2.5rem,16%,5rem)] shrink-0 text-fraca sm:mt-5">
            <line x1="2" y1="6" x2="70" y2="6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="3 5" className={pronto ? '' : 'animate-[fluxo_0.6s_linear_infinite]'} />
            <path d="M68 1.5 76 6l-8 4.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <Arquivo key={`para${n}`} dados={ex.para} visivel={pronto} />
        </div>
        <div className="w-[min(100%,15rem)]">
          <div className="h-1 overflow-hidden rounded-full bg-superficie-3">
            <span key={`barra${n}`} className="block h-full origin-left animate-[encher_1.6s_cubic-bezier(.4,0,.2,1)_0.25s_both] rounded-full bg-tinta" />
          </div>
          <div className="mt-2 flex items-center justify-between gap-2 font-mono text-[0.625rem] text-fraca sm:text-[0.6875rem]">
            <span className="flex items-center gap-1">
              <Glifo nome="cadeado" className="size-3" style={{ '--b': 'var(--color-superficie)' }} />
              {inicio.soltar.local}
            </span>
            <span className={pronto ? 'text-tinta' : ''}>{pronto ? inicio.soltar.pronto : inicio.soltar.convertendo}</span>
          </div>
        </div>
      </div>

      {/* soltar / escolher arquivo */}
      <label
        className={`mx-3 mb-3 flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed px-3 py-2.5 text-center text-xs text-suave transition-colors sm:mx-4 sm:mb-4 sm:text-sm ${sobre ? 'border-tinta bg-superficie-2 text-tinta' : 'border-borda-forte hover:border-fraca hover:text-tinta'}`}
      >
        <input type="file" multiple className="sr-only" aria-label={inicio.soltar.rotulo} onChange={(e) => enviar(e.target.files)} />
        <Glifo nome="nuvem" className="size-4 shrink-0 text-tinta" style={{ '--b': 'var(--color-superficie)' }} />
        <span>
          {inicio.soltar.titulo} <span className="font-semibold text-tinta underline decoration-borda-forte underline-offset-4">{inicio.soltar.escolher}</span>
        </span>
      </label>
    </div>
  )
}

/** Blocos das categorias numa órbita elíptica em volta da janela. */
const ORBITA = ['video', 'audio', 'imagem', 'pdf', 'documentos', 'compactados', 'utilitarios']
const CENTRO = { x: 50, y: 73 }
const RAIO = { x: 46, y: 15 }
const VOLTA_S = 46

function posicao(angulo) {
  const s = Math.sin(angulo)
  const frente = (s + 1) / 2
  return {
    left: `${CENTRO.x + RAIO.x * Math.cos(angulo)}%`,
    top: `${CENTRO.y + RAIO.y * s}%`,
    scale: (0.62 + 0.38 * frente).toFixed(3),
    opacity: (0.35 + 0.65 * frente).toFixed(3),
    zIndex: s > 0 ? 4 : 1,
  }
}
const anguloDe = (k, t) => t + (k * 2 * Math.PI) / ORBITA.length - Math.PI / 2

function Orbita() {
  const itens = useRef([])
  const caixa = useRef(null)
  useEffect(() => {
    if (semMovimento()) return undefined
    let quadro = 0
    let visivel = true
    let t0 = performance.now()
    let acumulado = 0
    const passo = (agora) => {
      const t = acumulado + ((agora - t0) / 1000 / VOLTA_S) * 2 * Math.PI
      itens.current.forEach((el, k) => {
        if (!el) return
        const p = posicao(anguloDe(k, t))
        el.style.left = p.left
        el.style.top = p.top
        el.style.scale = p.scale
        el.style.opacity = p.opacity
        el.style.zIndex = p.zIndex
      })
      quadro = requestAnimationFrame(passo)
    }
    const parar = () => {
      cancelAnimationFrame(quadro)
      acumulado += ((performance.now() - t0) / 1000 / VOLTA_S) * 2 * Math.PI
    }
    const seguir = () => {
      t0 = performance.now()
      quadro = requestAnimationFrame(passo)
    }
    // Para quando sai da tela ou a aba fica oculta.
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting && !visivel) seguir()
      else if (!e.isIntersecting && visivel) parar()
      visivel = e.isIntersecting
    })
    obs.observe(caixa.current)
    seguir()
    return () => {
      obs.disconnect()
      cancelAnimationFrame(quadro)
    }
  }, [])

  return (
    <div ref={caixa} className="pointer-events-none absolute inset-0">
      {ORBITA.map((cor, k) => {
        const p = posicao(anguloDe(k, 0))
        return (
          <span
            key={cor}
            ref={(el) => (itens.current[k] = el)}
            className="absolute -translate-x-1/2 -translate-y-1/2"
            style={{ left: p.left, top: p.top, scale: p.scale, opacity: p.opacity, zIndex: p.zIndex }}
          >
            <Bloco3D cor={cor} tamanho="clamp(2.9rem, 6.6vw, 4.75rem)" rot={[12, (k % 2 ? -1 : 1) * 18, (k % 3) * 5 - 5]} atraso={k * 0.9} amp={7} />
          </span>
        )
      })}
    </div>
  )
}

export function PalcoAbertura({ className = '' }) {
  const ref = useInclinacao()
  return (
    <div ref={ref} className={`relative aspect-[0.78] w-full sm:aspect-[1.08] ${className}`} style={{ perspective: '1400px' }}>
      {/* piso em grade, em perspectiva */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-[-12%] bottom-[-8%] h-[52%] [mask-image:radial-gradient(ellipse_at_50%_40%,#000_25%,transparent_68%)]"
        style={{
          backgroundImage: 'linear-gradient(var(--grade) 1px, transparent 1px), linear-gradient(90deg, var(--grade) 1px, transparent 1px)',
          backgroundSize: '44px 44px',
          transform: 'perspective(520px) rotateX(64deg)',
          transformOrigin: '50% 0%',
          '--grade': 'color-mix(in oklab, var(--color-tinta) 11%, transparent)',
        }}
      />
      {/* halo neutro e a trilha da órbita */}
      <span aria-hidden="true" className="pointer-events-none absolute inset-x-[8%] top-[8%] h-[70%] rounded-[50%] bg-[radial-gradient(closest-side,color-mix(in_oklab,var(--color-tinta)_8%,transparent),transparent)]" />
      <Anel className="z-0" style={{ left: `${CENTRO.x - RAIO.x}%`, right: `${100 - CENTRO.x - RAIO.x}%`, top: `${CENTRO.y - RAIO.y}%`, height: `${RAIO.y * 2}%` }} />
      <Faisca className="top-[1%] left-[12%]" atraso={0.4} />
      <Faisca className="top-[10%] right-[2%]" atraso={1.9} tamanho={11} />
      <Faisca className="top-[46%] left-[0%]" atraso={2.8} tamanho={10} />
      <JanelaConversor />
      <Orbita />
    </div>
  )
}
