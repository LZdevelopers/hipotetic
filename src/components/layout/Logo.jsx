import { product } from '../../data/site'
import { Icon } from '../primitives/Icon'

/**
 * Marca provisória do produto: placa branca com a seta de download (o CTA
 * invertido da LZdev, em miniatura) + nome em Plus Jakarta. Quando houver
 * nome e símbolo definitivos, só este arquivo e site.js mudam.
 */
export function Logo({ className = '' }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <span className="grid size-9 place-items-center rounded-xl bg-brand text-bg shadow-[0_8px_28px_-10px_rgb(255_255_255/0.45)]">
        <Icon name="download" size={18} strokeWidth={2.2} />
      </span>
      <span className="font-display text-[1.3rem] leading-none font-extrabold tracking-[-0.035em] text-ink">
        {product.name}
      </span>
    </span>
  )
}

/** Assinatura "por LZdev" com o símbolo oficial (public/lzdev-mark.png). */
export function LzdevSignature({ className = '' }) {
  return (
    <a
      href="https://lzdev.com.br"
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center gap-2 text-xs text-faint transition-colors hover:text-ink ${className}`}
    >
      <img src="/lzdev-mark.png" alt="" width="20" height="20" className="size-5" />
      <span>
        um projeto <strong className="font-display font-extrabold text-ink">LZ<span className="text-accent">dev</span></strong>
      </span>
    </a>
  )
}
