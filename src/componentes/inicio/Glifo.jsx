/**
 * Glifos cheios (não de traço) para os objetos 3D da página inicial e os
 * ícones coloridos do cabeçalho. Branco por padrão (currentColor); onde o
 * desenho tem um "recorte" colorido ele usa a cor do bloco (--b).
 */
const RECORTE = 'var(--b, #1d5bd8)'

const DESENHOS = {
  video: <path d="M8.2 5.2c0-1.1 1.2-1.8 2.2-1.2l9 6.3c.9.6.9 2 0 2.6l-9 6.3c-1 .6-2.2-.1-2.2-1.2z" />,
  audio: <path d="M19.5 3.6v11.7a3.3 3.3 0 1 1-2.2-3.1V7.7l-7.6 1.7v7.9a3.3 3.3 0 1 1-2.2-3.1V6.3c0-.8.5-1.4 1.3-1.6l9.4-2.1a1.1 1.1 0 0 1 1.3 1z" />,
  imagem: (
    <>
      <path fillRule="evenodd" d="M5 3.5h14a2.5 2.5 0 0 1 2.5 2.5v12a2.5 2.5 0 0 1-2.5 2.5H5A2.5 2.5 0 0 1 2.5 18V6A2.5 2.5 0 0 1 5 3.5zm.4 2.6v11.8h13.2V6.1z" />
      <path d="M5.4 17.9l4-5a1 1 0 0 1 1.6 0l2.3 2.9 1.3-1.5a1 1 0 0 1 1.5 0l2.5 3z" />
      <circle cx="15.2" cy="9.3" r="1.7" />
    </>
  ),
  pdf: (
    <>
      <path d="M7 2.4h7.3l5.2 5.2V20a1.6 1.6 0 0 1-1.6 1.6H7A1.6 1.6 0 0 1 5.4 20V4A1.6 1.6 0 0 1 7 2.4z" />
      <path d="M14.3 2.4V6a1.6 1.6 0 0 0 1.6 1.6h3.6z" fill={RECORTE} opacity=".45" />
      <text x="12.4" y="17.6" textAnchor="middle" fontSize="5.4" fontWeight="800" fontFamily="'Plus Jakarta Sans Variable', system-ui, sans-serif" fill={RECORTE}>
        PDF
      </text>
    </>
  ),
  documentos: (
    <>
      <path d="M7 2.4h7.3l5.2 5.2V20a1.6 1.6 0 0 1-1.6 1.6H7A1.6 1.6 0 0 1 5.4 20V4A1.6 1.6 0 0 1 7 2.4z" />
      <path d="M14.3 2.4V6a1.6 1.6 0 0 0 1.6 1.6h3.6z" fill={RECORTE} opacity=".45" />
      <g fill={RECORTE}>
        <rect x="8.2" y="10.4" width="8.1" height="1.5" rx=".75" />
        <rect x="8.2" y="13.4" width="8.1" height="1.5" rx=".75" />
        <rect x="8.2" y="16.4" width="5.2" height="1.5" rx=".75" />
      </g>
    </>
  ),
  compactados: (
    <>
      <path d="M12 2.6l8.4 4.3L12 11.3 3.6 6.9z" opacity=".78" />
      <path d="M3.2 8.2l7.9 4.2v9.2l-7.4-3.9a1 1 0 0 1-.5-.9z" />
      <path d="M20.8 8.2l-7.9 4.2v9.2l7.4-3.9a1 1 0 0 0 .5-.9z" opacity=".9" />
      <path d="M7.4 4.5l8.4 4.4v3.3l-1.6.8V9.8L5.8 5.4z" fill={RECORTE} opacity=".35" />
    </>
  ),
  utilitarios: <path d="M21.2 6.4a5.6 5.6 0 0 1-7.5 6.3l-7.2 7.2a2.2 2.2 0 0 1-3.1-3.1l7.2-7.2a5.6 5.6 0 0 1 6.3-7.5l-3.3 3.3.6 2.6 2.6.6z" />,
  conversor: (
    <>
      <path d="M4 8.6a1.2 1.2 0 0 1 1.2-1.2h10.5l-1.6-1.6a1.2 1.2 0 1 1 1.7-1.7l3.6 3.6a1.2 1.2 0 0 1 0 1.7l-3.6 3.6a1.2 1.2 0 1 1-1.7-1.7l1.6-1.6H5.2A1.2 1.2 0 0 1 4 8.6z" />
      <path d="M20 15.4a1.2 1.2 0 0 1-1.2 1.2H8.3l1.6 1.6a1.2 1.2 0 1 1-1.7 1.7l-3.6-3.6a1.2 1.2 0 0 1 0-1.7l3.6-3.6a1.2 1.2 0 1 1 1.7 1.7l-1.6 1.6h10.5a1.2 1.2 0 0 1 1.2 1.1z" opacity=".85" />
    </>
  ),
  raio: <path d="M13.4 2.1L4.6 13c-.4.5 0 1.3.6 1.3h5.6l-1.4 7.4c-.1.7.8 1.1 1.2.5l8.8-10.9c.4-.5 0-1.3-.6-1.3h-5.6l1.4-7.4c.1-.7-.8-1.1-1.2-.5z" />,
  nuvem: (
    <>
      <path d="M7.2 19.4a5.2 5.2 0 0 1-.7-10.3 6.7 6.7 0 0 1 12.9.7 4.8 4.8 0 0 1-.6 9.6z" />
      <path d="M12 9.6l3.9 4h-2.5v3.6h-2.8v-3.6H8.1z" fill={RECORTE} />
    </>
  ),
  pasta: (
    <>
      <path d="M2.6 6.4A1.9 1.9 0 0 1 4.5 4.5h4.4c.5 0 1 .2 1.4.6l1.5 1.5h7.7a1.9 1.9 0 0 1 1.9 1.9v9.9a1.9 1.9 0 0 1-1.9 1.9H4.5a1.9 1.9 0 0 1-1.9-1.9z" />
      <path d="M13.2 8.6l-3.9 5.2h2.6l-.8 3.6 3.9-5.2h-2.6z" fill={RECORTE} />
    </>
  ),
  escudo: (
    <>
      <path d="M12 2.2l7.6 2.9a1 1 0 0 1 .6.9v5.4c0 5-3.3 8.9-8.2 10.5-4.9-1.6-8.2-5.5-8.2-10.5V6a1 1 0 0 1 .6-.9z" />
      <path d="M8.3 12.1l2.6 2.6 4.9-5.1" fill="none" stroke={RECORTE} strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  cadeado: (
    <>
      <path d="M8.3 10.4V8a3.7 3.7 0 0 1 7.4 0v2.4" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" />
      <path d="M6.6 10.1h10.8a1.8 1.8 0 0 1 1.8 1.8v7.6a1.8 1.8 0 0 1-1.8 1.8H6.6a1.8 1.8 0 0 1-1.8-1.8v-7.6a1.8 1.8 0 0 1 1.8-1.8z" />
      <circle cx="12" cy="15.6" r="1.6" fill={RECORTE} />
    </>
  ),
  coracao: <path d="M12 20.6s-8.3-4.8-8.3-10.8A4.6 4.6 0 0 1 12 7.2a4.6 4.6 0 0 1 8.3 2.6c0 6-8.3 10.8-8.3 10.8z" />,
  brilho: <path d="M12 1.5c.7 5.3 2.9 8 10.5 10.5-7.6 2.5-9.8 5.2-10.5 10.5-.7-5.3-2.9-8-10.5-10.5C9.1 9.5 11.3 6.8 12 1.5z" />,
}

export function Glifo({ nome, className = '', style }) {
  const desenho = DESENHOS[nome]
  if (!desenho) return null
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false" className={className} style={style}>
      {desenho}
    </svg>
  )
}

/** Cores dos blocos 3D: [claro, escuro] de cada um (iguais nos dois temas). */
export const CORES_3D = {
  video: ['#b78bff', '#6d28d9'],
  audio: ['#ff8cc6', '#d61f75'],
  imagem: ['#5fd4ff', '#0b7fb3'],
  pdf: ['#ff7f8a', '#d0202c'],
  documentos: ['#79a9ff', '#2453d6'],
  compactados: ['#ffc06b', '#e2620c'],
  utilitarios: ['#5ee6a0', '#0a8f5c'],
  conversor: ['#79a9ff', '#4338ca'],
  pasta: ['#8fb8ff', '#2f5be0'],
  escudo: ['#7fb2ff', '#2b4fd8'],
  cadeado: ['#7fb2ff', '#2b4fd8'],
  raio: ['#ffd36b', '#e98b0c'],
  coracao: ['#ff8cc6', '#d61f75'],
}
