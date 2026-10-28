import { Icon } from './Icon'

const base =
  'group relative inline-flex items-center justify-center gap-2 font-semibold whitespace-nowrap transition-[background-color,border-color,color,box-shadow,transform,filter] duration-300 ease-[var(--ease-out-soft)] active:translate-y-px disabled:opacity-60 disabled:pointer-events-none'

const sizes = {
  md: 'h-11 px-5 text-sm',
  lg: 'h-13 px-7 text-[0.95rem]',
  xl: 'h-14 px-6 text-[0.95rem] sm:h-15 sm:px-7 sm:text-base',
}

/**
 * Na paleta preta e branca o botão de ação é INVERTIDO: placa branca, texto
 * preto. É o mesmo movimento do símbolo da marca (branco sobre preto) e o único
 * jeito de o CTA ser o elemento mais claro da tela — sem matiz, não existe cor
 * "mais chamativa" que o branco, só a inversão.
 *
 * Por isso o hover das variantes claras ESCURECE (brightness < 1) em vez de
 * clarear: partindo do branco não há para onde subir.
 */
const variants = {
  primary:
    'bg-brand text-bg shadow-[0_10px_36px_-12px_rgb(255_255_255/0.3)] hover:bg-brand-hover hover:shadow-[0_14px_44px_-10px_rgb(255_255_255/0.4)]',
  // Placa branca com queda para o cinza e luz interna na borda superior — CTA do Hero
  gradient:
    'bg-[linear-gradient(135deg,#ffffff_0%,#ededed_52%,#c9c9c9_100%)] text-bg shadow-[inset_0_1px_0_rgb(255_255_255/0.7),0_14px_40px_-14px_rgb(255_255_255/0.34)] hover:-translate-y-0.5 hover:brightness-95 hover:shadow-[inset_0_1px_0_rgb(255_255_255/0.8),0_20px_52px_-14px_rgb(255_255_255/0.45)]',
  outline:
    'border border-white/12 bg-white/[0.03] text-ink backdrop-blur-sm hover:border-brand/45 hover:bg-white/[0.06]',
  // Cápsula escura com borda clara e brilho externo discreto — CTA do cabeçalho
  glass:
    'border border-white/28 bg-[rgb(8_8_8/0.7)] text-ink backdrop-blur-md shadow-[inset_0_1px_0_rgb(255_255_255/0.07),0_10px_34px_-14px_rgb(255_255_255/0.28)] [&>svg]:text-ink hover:border-white/50 hover:bg-[rgb(18_18_18/0.85)] hover:shadow-[inset_0_1px_0_rgb(255_255_255/0.1),0_14px_44px_-12px_rgb(255_255_255/0.36)]',
  ghost: 'text-muted hover:text-ink hover:bg-white/[0.05]',
  accent:
    'bg-accent text-bg shadow-[0_10px_36px_-14px_rgb(255_255_255/0.32)] hover:brightness-95',
}

/**
 * Botão único para links e ações. Renderiza <a> quando recebe href.
 * A variante primária tem um brilho que atravessa o botão no hover (sheen).
 *
 * `pill` troca o raio por cápsula e `iconBadge` envolve o ícone da direita num
 * círculo translúcido — as duas formas usadas no Hero.
 *
 * O véu do `sheen` e o círculo do `iconBadge` usam alfa PRETO, não branco: as
 * três variantes que os acionam (primary, gradient, accent) são placas brancas,
 * e branco sobre branco seria invisível.
 */
export function Button({
  href,
  variant = 'primary',
  size = 'md',
  pill = false,
  icon,
  iconPosition = 'right',
  iconBadge = false,
  className = '',
  children,
  ...rest
}) {
  const Tag = href ? 'a' : 'button'
  const isButton = Tag === 'button'
  const sheen = variant === 'primary' || variant === 'accent' || variant === 'gradient'
  const trailing = Boolean(icon) && iconPosition === 'right'

  return (
    <Tag
      href={href}
      type={isButton ? rest.type || 'button' : undefined}
      className={`${base} ${pill ? 'rounded-full' : 'rounded-xl'} ${sizes[size]} ${variants[variant]} ${
        sheen ? 'overflow-hidden' : ''
      } ${trailing && iconBadge ? 'pr-2.5 sm:pr-3' : ''} ${className}`}
      {...rest}
    >
      {icon && iconPosition === 'left' ? <Icon name={icon} size={17} /> : null}
      <span className="relative z-10">{children}</span>

      {trailing && iconBadge ? (
        <span className="relative z-10 ml-1 grid size-8 place-items-center rounded-full bg-black/12 ring-1 ring-black/20 transition-transform duration-300 ease-[var(--ease-out-soft)] group-hover:translate-x-0.5 sm:size-9">
          <Icon name={icon} size={15} />
        </span>
      ) : null}

      {trailing && !iconBadge ? (
        <Icon
          name={icon}
          size={17}
          className="relative z-10 transition-transform duration-300 ease-[var(--ease-out-soft)] group-hover:translate-x-0.5"
        />
      ) : null}

      {sheen ? (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -translate-x-[120%] skew-x-[-18deg] bg-black/20 blur-md group-hover:animate-sheen motion-reduce:hidden"
        />
      ) : null}
    </Tag>
  )
}
