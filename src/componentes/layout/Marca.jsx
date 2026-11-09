import { produto } from '../../textos'
import { Link } from '../../nucleo/roteador'

/**
 * Símbolo provisório: duas folhas sobrepostas (arquivo entrando → arquivo
 * saindo), na cor de ação do tema. Nome e símbolo mudam só aqui e em
 * src/textos.js quando a marca for definida.
 */
export function Simbolo({ tamanho = 28, className = '' }) {
  return (
    <svg viewBox="0 0 32 32" width={tamanho} height={tamanho} aria-hidden="true" className={`shrink-0 ${className}`}>
      <rect width="32" height="32" rx="8" className="fill-marca" />
      <path d="M9 9.5A1.5 1.5 0 0 1 10.5 8H16l4 4v7.5a1.5 1.5 0 0 1-1.5 1.5h-8A1.5 1.5 0 0 1 9 19.5z" className="fill-sobre-marca" opacity="0.38" />
      <path
        d="M13 12.5a1.5 1.5 0 0 1 1.5-1.5H20l4 4v8.5a1.5 1.5 0 0 1-1.5 1.5h-8a1.5 1.5 0 0 1-1.5-1.5z"
        className="fill-sobre-marca"
      />
      <path d="M17 19.2h3.6m0 0-1.5-1.5m1.5 1.5-1.5 1.5" className="stroke-marca" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function Marca({ className = '' }) {
  return (
    <Link para="/" className={`inline-flex items-center gap-2.5 rounded-lg ${className}`} aria-label={`${produto.nome} — página inicial`}>
      <Simbolo />
      <span className="font-display text-[1.15rem] leading-none font-extrabold tracking-[-0.03em] text-tinta">{produto.nome}</span>
    </Link>
  )
}

/**
 * Assinatura "Um projeto LZdev" com o símbolo oficial (estrela branca sem
 * fundo; no tema claro é invertida para preto). Só "LZdev" é link.
 */
export function AssinaturaLzdev() {
  return (
    <p className="inline-flex items-center gap-2.5 text-sm text-fraca">
      <img src="/lzdev-marca.png" alt="" width="28" height="28" className="size-7 invert escuro:invert-0" />
      <span>
        Um projeto{' '}
        <a
          href="https://lzdev.com.br"
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-sm font-display font-extrabold text-tinta underline-offset-4 transition-colors hover:text-acento hover:underline"
        >
          LZdev
        </a>
      </span>
    </p>
  )
}
