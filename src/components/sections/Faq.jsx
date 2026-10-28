import { faq } from '../../data/site'
import { Icon } from '../primitives/Icon'

/**
 * Perguntas frequentes: lista simples, sem animação de entrada. Cada item é
 * um <details> nativo — abre e fecha sem JavaScript, com teclado e leitor de
 * tela funcionando de graça.
 */
export function Faq() {
  return (
    <section id="faq" aria-labelledby="faq-titulo" className="relative py-16 sm:py-20">
      <div className="container-page">
        <div className="mx-auto max-w-3xl">
          <h2 id="faq-titulo" className="text-2xl text-ink sm:text-3xl">
            {faq.title}
          </h2>

          <div className="mt-6 border-t border-white/8">
            {faq.items.map((item) => (
              <details key={item.q} className="group border-b border-white/8">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 text-left text-[0.98rem] font-semibold text-ink hover:text-white sm:text-base [&::-webkit-details-marker]:hidden">
                  {item.q}
                  <Icon name="chevronDown" size={16} className="shrink-0 text-faint transition-transform group-open:rotate-180" />
                </summary>
                <p className="pb-5 text-sm leading-relaxed text-muted">{item.a}</p>
              </details>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
