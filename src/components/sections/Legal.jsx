import { legal } from '../../data/site'
import { Icon } from '../primitives/Icon'
import { Reveal } from '../primitives/Reveal'
import { Section } from '../primitives/Section'

/** Privacidade e condições de uso, curtas e na própria página. */
export function Legal() {
  return (
    <Section tight>
      <div className="grid gap-4 md:grid-cols-2">
        {[legal.privacy, legal.terms].map((block, i) => (
          <Reveal key={block.id} delay={i * 80}>
            <section
              id={block.id}
              aria-labelledby={`${block.id}-titulo`}
              className="h-full scroll-mt-28 rounded-[var(--radius-card)] border border-white/8 bg-surface/40 p-6 sm:p-7"
            >
              <h2 id={`${block.id}-titulo`} className="flex items-center gap-2.5 text-lg text-ink">
                <Icon name={i === 0 ? 'eyeOff' : 'shield'} size={18} className="text-accent" />
                {block.title}
              </h2>
              <ul className="mt-5 flex flex-col gap-3">
                {block.items.map((item) => (
                  <li key={item} className="flex gap-3 text-sm leading-relaxed text-muted">
                    <Icon name="check" size={15} className="mt-0.5 shrink-0 text-success" />
                    {item}
                  </li>
                ))}
              </ul>
            </section>
          </Reveal>
        ))}
      </div>
    </Section>
  )
}
