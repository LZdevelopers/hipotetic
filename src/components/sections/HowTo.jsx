import { howTo } from '../../data/site'
import { Icon } from '../primitives/Icon'
import { Reveal } from '../primitives/Reveal'

// Um tom categórico por passo, como o trilho do processo no site da LZdev.
const STEP_COLORS = ['text-cat-1', 'text-cat-2', 'text-cat-3']

/**
 * Como usar: logo abaixo da ferramenta e compacto o bastante para aparecer
 * na primeira tela do desktop, sem rolar. Texto com ícone por passo — sem
 * cartões, para ler de uma vez.
 */
export function HowTo() {
  return (
    <section id="como-usar" aria-labelledby="como-usar-titulo" className="relative pb-16 sm:pb-20">
      <div className="container-page">
        <Reveal delay={240} className="mx-auto max-w-5xl border-t border-white/8 pt-8">
          <h2 id="como-usar-titulo" className="text-center text-xs font-semibold tracking-[0.18em] text-accent uppercase">
            {howTo.title}
          </h2>

          <ol className="mt-6 grid gap-6 md:grid-cols-3 md:gap-8">
            {howTo.steps.map((step, i) => (
              <li key={step.title} className="flex gap-4">
                <span className={`grid size-10 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/[0.04] ${STEP_COLORS[i]}`}>
                  <Icon name={step.icon} size={18} />
                </span>
                <div className="text-left">
                  <h3 className="text-base text-ink">
                    <span className="text-faint">{i + 1}. </span>
                    {step.title}
                  </h3>
                  <p className="mt-1 text-sm leading-relaxed text-muted">{step.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </Reveal>
      </div>
    </section>
  )
}
