/**
 * Envelope de scroll reveal. O trabalho pesado está no CSS ([data-reveal])
 * e num único IntersectionObserver global (useReveal), então usar isto
 * centenas de vezes não custa nada.
 *
 * `delay` em ms cria efeito cascata em listas.
 */
export function Reveal({ as: Tag = 'div', variant = 'up', delay = 0, className = '', style, children, ...rest }) {
  return (
    <Tag
      data-reveal={variant}
      className={className}
      style={{ '--reveal-delay': delay, ...style }}
      {...rest}
    >
      {children}
    </Tag>
  )
}
