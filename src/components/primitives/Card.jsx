/**
 * Cartão padrão da página: borda em gradiente, elevação sutil e um brilho que
 * acompanha o cursor.
 *
 * O brilho é desenhado pela utility `card-glow` a partir de duas variáveis
 * (--mx/--my) que este componente escreve no próprio elemento. A escrita é
 * barata de propósito: `setProperty` em duas custom properties que só alimentam
 * um `radial-gradient` de pseudo-elemento — não há re-render do React nem
 * recálculo de layout, e o `getBoundingClientRect` acontece uma vez por evento
 * de ponteiro, não por quadro.
 *
 * Em toque e no teclado nada disso roda: a utility tem fallback no topo do card
 * e o brilho ainda acende via `:focus-within`.
 */
export function Card({ as: Tag = 'div', className = '', innerClassName = '', children, ...rest }) {
  const trackPointer = (event) => {
    // `mouse` exclui dedo e caneta — em touch o brilho seguiria o último toque
    // e ficaria congelado ali depois que o dedo sai.
    if (event.pointerType !== 'mouse') return
    const rect = event.currentTarget.getBoundingClientRect()
    event.currentTarget.style.setProperty('--mx', `${event.clientX - rect.left}px`)
    event.currentTarget.style.setProperty('--my', `${event.clientY - rect.top}px`)
  }

  return (
    <Tag
      onPointerMove={trackPointer}
      className={`group relative isolate card-base border-gradient card-glow overflow-hidden transition-[box-shadow,border-color,transform] duration-500 ease-[var(--ease-out-soft)] hover:-translate-y-1 hover:border-white/25 hover:shadow-[var(--shadow-glow)] ${className}`}
      {...rest}
    >
      <div className={`relative z-10 ${innerClassName}`}>{children}</div>
    </Tag>
  )
}
