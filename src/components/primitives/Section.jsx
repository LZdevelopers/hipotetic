import { Reveal } from './Reveal'

/**
 * Ponto pulsante + rótulo — elemento de repetição que costura o site.
 * O ponto é a única cor fixa do cabeçalho de seção: um azul pequeno que se
 * repete do topo ao rodapé e impede que a sequência de títulos brancos vire
 * uma parede monocromática.
 */
function Eyebrow({ children }) {
  return (
    <span className="inline-flex items-center gap-2.5 text-xs font-semibold tracking-[0.18em] text-accent uppercase">
      <span className="size-1.5 rounded-full bg-info animate-pulse-dot" aria-hidden="true" />
      {children}
    </span>
  )
}

/**
 * Casca padrão de seção: ritmo vertical, largura máxima e id para âncora.
 * `tight` reduz o respiro quando duas seções precisam parecer conectadas.
 */
export function Section({ id, className = '', tight = false, children, ...rest }) {
  return (
    <section
      id={id}
      className={`relative ${tight ? 'py-12 sm:py-16' : 'py-16 sm:py-20 lg:py-24'} ${className}`}
      {...rest}
    >
      <div className="container-page">{children}</div>
    </section>
  )
}

/** Cabeçalho de seção: eyebrow + título + subtítulo, com reveal em cascata. */
export function SectionHeader({ eyebrow, title, subtitle, align = 'center', className = '' }) {
  const centered = align === 'center'
  return (
    <header
      className={`flex flex-col gap-5 ${centered ? 'items-center text-center mx-auto max-w-3xl' : 'items-start text-left max-w-3xl'} ${className}`}
    >
      {eyebrow ? (
        <Reveal>
          <Eyebrow>{eyebrow}</Eyebrow>
        </Reveal>
      ) : null}
      <Reveal delay={80}>
        <h2 className="text-[clamp(1.85rem,4.6vw,3.05rem)] text-ink">{title}</h2>
      </Reveal>
      {subtitle ? (
        <Reveal delay={160}>
          <p className="text-base sm:text-lg leading-relaxed text-muted">{subtitle}</p>
        </Reveal>
      ) : null}
    </header>
  )
}
