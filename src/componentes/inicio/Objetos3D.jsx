import { useEffect, useRef } from 'react'
import { CORES_3D, Glifo } from './Glifo'

/** Fatias da espessura do bloco (cada uma um pouco mais para trás e mais escura). */
const CAMADAS = [8, 7, 6, 5, 4, 3, 2, 1]

/**
 * Bloco 3D de verdade (CSS 3D): uma placa arredondada com espessura, feita de
 * fatias empilhadas em Z, com a face em degradê, brilho e o glifo em cima.
 * Flutua devagar e inclina com o mouse (variáveis --mx/--my de um ancestral,
 * ver useInclinacao). `rot` = [x, y, z] em graus.
 */
export function Bloco3D({ cor, glifo = cor, tamanho = '5rem', rot = [12, -18, 0], rotulo, atraso = 0, amp = 10, duracao = 6, sombra = true, className = '', style }) {
  const [a, b] = CORES_3D[cor] ?? CORES_3D.documentos
  return (
    <span
      aria-hidden="true"
      className={`bloco3d ${className}`}
      style={{
        '--t': tamanho,
        '--a': a,
        '--b': b,
        '--rx': `${rot[0]}deg`,
        '--ry': `${rot[1]}deg`,
        '--rz': `${rot[2]}deg`,
        '--atraso': `${-atraso}s`,
        '--amp': `${amp}px`,
        '--duracao': `${duracao}s`,
        ...style,
      }}
    >
      <span className="bloco3d-brilho" />
      {sombra ? <span className="bloco3d-sombra" /> : null}
      <span className="bloco3d-flutua">
        <span className="bloco3d-corpo">
          {CAMADAS.map((i) => (
            <span key={i} className="bloco3d-camada" style={{ '--i': i }} />
          ))}
          <span className={`bloco3d-face ${rotulo ? 'com-rotulo' : ''}`}>
            <Glifo nome={glifo} className="bloco3d-glifo" />
            {rotulo ? <span className="bloco3d-rotulo">{rotulo}</span> : null}
          </span>
        </span>
      </span>
    </span>
  )
}

/** Anel de luz (uma elipse, como uma órbita vista de lado). */
export function Anel({ className = '', style }) {
  return <span aria-hidden="true" className={`anel3d ${className}`} style={style} />
}

/** Estrelinha que pisca. */
export function Faisca({ className = '', atraso = 0, tamanho = 14 }) {
  return (
    <span aria-hidden="true" className={`faisca ${className}`} style={{ '--atraso': `${-atraso}s`, width: tamanho, height: tamanho }}>
      <Glifo nome="brilho" className="size-full" />
    </span>
  )
}

/**
 * Inclinação com o mouse: escreve --mx/--my (-1 a 1) no elemento, e os blocos
 * 3D dentro dele giram um pouco seguindo o ponteiro. Só com mouse (não no toque)
 * e não com "reduzir movimento".
 */
export function useInclinacao() {
  const ref = useRef(null)
  useEffect(() => {
    const el = ref.current
    if (!el || !matchMedia('(pointer: fine)').matches || matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined
    let quadro = 0
    const mover = (e) => {
      cancelAnimationFrame(quadro)
      quadro = requestAnimationFrame(() => {
        const r = el.getBoundingClientRect()
        el.style.setProperty('--mx', (((e.clientX - r.left) / r.width) * 2 - 1).toFixed(3))
        el.style.setProperty('--my', (((e.clientY - r.top) / r.height) * 2 - 1).toFixed(3))
      })
    }
    const sair = () => {
      cancelAnimationFrame(quadro)
      el.style.setProperty('--mx', '0')
      el.style.setProperty('--my', '0')
    }
    el.addEventListener('pointermove', mover)
    el.addEventListener('pointerleave', sair)
    return () => {
      cancelAnimationFrame(quadro)
      el.removeEventListener('pointermove', mover)
      el.removeEventListener('pointerleave', sair)
    }
  }, [])
  return ref
}
