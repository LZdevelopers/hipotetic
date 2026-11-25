import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Icone } from '../../componentes/Icone'
import { rgbDaChave, tirarCor } from '../../motores/imagem/fundo'
import { PADRAO_BLUR, PADRAO_CAMADA, blocosMosaico, estiloTexto } from './_projeto'
import { cantosPx, matrix3d, moverCanto } from '../imagem/_editor/perspectiva'

const IMA_CENTRO = 7 // px: distância para grudar no centro do vídeo

const hexRgba = (hex, a) => {
  const n = parseInt(String(hex).slice(1), 16)
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`
}

function arrastar(e, mover, fim) {
  e.preventDefault()
  e.stopPropagation()
  const alvo = e.currentTarget
  try {
    alvo.setPointerCapture(e.pointerId)
  } catch {
    /* evento sintético: segue sem captura */
  }
  const x0 = e.clientX
  const y0 = e.clientY
  const aoMover = (ev) => mover(ev.clientX - x0, ev.clientY - y0, ev)
  const soltar = () => {
    alvo.removeEventListener('pointermove', aoMover)
    alvo.removeEventListener('pointerup', soltar)
    alvo.removeEventListener('pointercancel', soltar)
    fim?.()
  }
  alvo.addEventListener('pointermove', aoMover)
  alvo.addEventListener('pointerup', soltar)
  alvo.addEventListener('pointercancel', soltar)
}

/**
 * Imagem sem fundo branco/preto para a prévia (a exportação faz o mesmo
 * com o colorkey do ffmpeg). Devolve a URL da imagem tratada, ou null.
 */
function useSemFundo(fonte, modo, tolerancia, corChave, suavidade = 0.08) {
  const [url, setUrl] = useState(null)
  useEffect(() => {
    if (!fonte?.arquivo || !modo) {
      setUrl(null)
      return undefined
    }
    let vivo = true
    let criada = null
    ;(async () => {
      const bmp = await createImageBitmap(fonte.arquivo)
      const lado = Math.min(1, 1600 / Math.max(bmp.width, bmp.height))
      const cv = new OffscreenCanvas(Math.round(bmp.width * lado), Math.round(bmp.height * lado))
      const ctx = cv.getContext('2d')
      ctx.drawImage(bmp, 0, 0, cv.width, cv.height)
      bmp.close()
      const img = ctx.getImageData(0, 0, cv.width, cv.height)
      tirarCor(img.data, rgbDaChave(modo, corChave), tolerancia, suavidade)
      ctx.putImageData(img, 0, 0)
      const blob = await cv.convertToBlob({ type: 'image/png' })
      if (!vivo) return
      criada = URL.createObjectURL(blob)
      setUrl(criada)
    })().catch(() => vivo && setUrl(null))
    return () => {
      vivo = false
      if (criada) URL.revokeObjectURL(criada)
    }
  }, [fonte, modo, tolerancia, corChave, suavidade])
  return url
}

/**
 * Uma camada no palco: conteúdo (texto, imagem, vídeo, desfoque) com recorte,
 * espelho, cores e giro; quando selecionada, alças nos 8 lados e de girar.
 */
/**
 * `sempreVisivel` (editor de imagem): a camada aparece sem depender do tempo, com
 * opacidade e modo de mesclagem (`mistura`) aplicados aqui mesmo.
 */
export function CamadaNoPalco({ cam, fonte, palco, sel, registrar, registrarVideo, aoSelecionar, aoMudar, aoMenu, aoGuias, sempreVisivel = false }) {
  const c = { ...PADRAO_CAMADA, ...cam }
  const caixa = useRef(null)
  const [alturaTexto, setAlturaTexto] = useState(0)
  const semFundoUrl = useSemFundo(c.tipo === 'imagem' ? fonte : null, c.semFundo, c.tolerancia, c.corChave, c.suavidade)

  // Altura do texto: depende da quebra de linhas, então é medida.
  useLayoutEffect(() => {
    if (c.tipo !== 'texto' || !caixa.current) return
    const h = caixa.current.offsetHeight
    if (Math.abs(h - alturaTexto) > 0.5) setAlturaTexto(h)
  })

  const W = palco.w
  const H = palco.h
  const largura = c.w * W
  const altura = c.tipo === 'texto' ? alturaTexto : c.h * H
  const giro = c.girar ? `rotate(${c.girar}deg)` : undefined
  // Distorcida (editor de imagem): o conteúdo reto vai para os 4 cantos por um matrix3d.
  const quad = c.cantos ? cantosPx(c.cantos, W, H) : null
  const geometria = quad
    ? { left: 0, top: 0, width: largura, height: c.tipo === 'texto' ? undefined : altura, transform: matrix3d(largura || 1, altura || 1, quad), transformOrigin: '0 0' }
    : { left: c.x * W, top: c.y * H, width: largura, height: c.tipo === 'texto' ? undefined : altura, transform: giro }

  // Deltas do mouse levados para dentro da camada girada.
  const paraDentro = (dx, dy) => {
    const a = (-c.girar * Math.PI) / 180
    return [dx * Math.cos(a) - dy * Math.sin(a), dx * Math.sin(a) + dy * Math.cos(a)]
  }

  const mover = (e) => {
    aoSelecionar()
    if (e.button !== 0) return
    const c0 = { ...c }
    if (c0.cantos) {
      // Distorcida: arrastar leva os 4 cantos juntos.
      arrastar(e, (dx, dy) => aoMudar({ cantos: c0.cantos.map(([x, y]) => [x + dx / W, y + dy / H]) }))
      return
    }
    const alt0 = altura / H
    arrastar(
      e,
      (dx, dy) => {
        let x = c0.x + dx / W
        let y = c0.y + dy / H
        // Gruda no centro do vídeo (na horizontal e na vertical).
        const v = Math.abs(x + c0.w / 2 - 0.5) * W < IMA_CENTRO
        const h = Math.abs(y + alt0 / 2 - 0.5) * H < IMA_CENTRO
        if (v) x = 0.5 - c0.w / 2
        if (h) y = 0.5 - alt0 / 2
        aoGuias({ v, h })
        aoMudar({ x, y })
      },
      () => aoGuias(null),
    )
  }

  const redimensionar = (sx, sy) => (e) => {
    if (e.button !== 0) return
    const c0 = { ...c }
    const w0 = largura
    const h0 = altura || 1
    arrastar(e, (dx, dy) => {
      const [lx, ly] = paraDentro(dx, dy)
      let w = w0
      let h = h0
      if (sx && sy) {
        if (c.tipo === 'desfoque') {
          w = w0 + sx * lx
          h = h0 + sy * ly
        } else {
          // Canto: escala por igual (no texto, o tamanho da letra acompanha).
          const f = Math.abs(lx) / w0 >= Math.abs(ly) / h0 ? (w0 + sx * lx) / w0 : (h0 + sy * ly) / h0
          w = w0 * Math.max(0.08, f)
          h = h0 * Math.max(0.08, f)
        }
      } else if (sx) w = w0 + sx * lx
      else if (sy) h = h0 + sy * ly
      w = Math.max(14, w)
      h = Math.max(14, h)
      // O lado oposto fica parado.
      const dxPos = sx < 0 ? w0 - w : sx > 0 ? 0 : (w0 - w) / 2
      const dyPos = sy < 0 ? h0 - h : sy > 0 ? 0 : (h0 - h) / 2
      const patch = { x: c0.x + dxPos / W, y: c0.y + dyPos / H, w: w / W }
      if (c.tipo === 'texto') {
        if (sx && sy) patch.tamanho = Math.max(0.01, c0.tamanho * (w / w0))
      } else patch.h = h / H
      aoMudar(patch)
    })
  }

  const girar = (e) => {
    if (e.button !== 0) return
    const r = caixa.current.getBoundingClientRect()
    const cx = r.left + r.width / 2
    const cy = r.top + r.height / 2
    arrastar(e, (_, __, ev) => {
      let a = (Math.atan2(ev.clientY - cy, ev.clientX - cx) * 180) / Math.PI + 90
      if (a > 180) a -= 360
      // Gruda em 0°, 90°, 180° e −90°.
      const reto = Math.round(a / 90) * 90
      if (Math.abs(a - reto) < 4) a = reto === -180 ? 180 : reto
      aoMudar({ girar: Math.round(a) })
    })
  }

  // ─── Conteúdo ─────────────────────────────────────────────────────────────
  const filtro = c.tipo === 'imagem' || c.tipo === 'video' ? `brightness(${1 + c.ajuste.brilho}) contrast(${c.ajuste.contraste}) saturate(${c.ajuste.saturacao})` : undefined
  const espelho = c.espelharH || c.espelharV ? `scale(${c.espelharH ? -1 : 1}, ${c.espelharV ? -1 : 1})` : undefined
  const r = c.recorte ?? { x: 0, y: 0, w: 1, h: 1 }
  const midia = { position: 'absolute', maxWidth: 'none', width: largura / r.w, height: altura / r.h, left: (-r.x * largura) / r.w, top: (-r.y * altura) / r.h, objectFit: 'fill' }

  let conteudo = null
  if (c.tipo === 'texto') {
    const e = estiloTexto(c, H)
    conteudo = (
      <div
        style={{
          fontSize: e.tamanho,
          lineHeight: `${e.linha}px`,
          padding: e.padding,
          fontWeight: e.peso,
          fontStyle: e.estilo,
          fontFamily: e.familia,
          letterSpacing: e.espacamento,
          textShadow: e.sombra ? `0 ${e.tamanho * 0.06}px ${e.tamanho * 0.18}px rgba(0,0,0,0.6)` : undefined,
          color: c.cor,
          textAlign: c.alinhar === 'esquerda' ? 'left' : c.alinhar === 'direita' ? 'right' : 'center',
          background: c.fundo ? hexRgba(c.corFundo, c.opacidadeFundo) : 'transparent',
          borderRadius: c.fundo ? e.tamanho * 0.35 : 0,
          WebkitTextStroke: e.contorno ? `${e.contorno}px ${e.corContorno}` : undefined,
          paintOrder: 'stroke fill',
          whiteSpace: 'pre-wrap',
          transform: espelho,
        }}
      >
        {e.texto || ' '}
      </div>
    )
  } else if (c.tipo === 'imagem') {
    conteudo = (
      <div className="relative size-full overflow-hidden" style={{ transform: espelho, filter: filtro, borderRadius: c.raio ? (c.raio * Math.min(largura, altura)) / 2 : undefined }}>
        <img src={semFundoUrl ?? fonte?.url} alt="" draggable={false} style={midia} />
      </div>
    )
  } else if (c.tipo === 'video') {
    conteudo = (
      <div className="relative size-full overflow-hidden" style={{ transform: espelho, filter: filtro }}>
        <video ref={registrarVideo} src={fonte?.url} muted playsInline preload="auto" style={midia} />
      </div>
    )
  } else if (c.tipo === 'desfoque') {
    const d = { ...PADRAO_BLUR, ...c }
    const menor = Math.min(largura, altura)
    const raio = d.estilo === 'mosaico' ? Math.max(3, menor / 30) : Math.max(3, (menor / 8) * (0.4 + 1.6 * d.intensidade) * 0.6)
    const bloco = menor / blocosMosaico(d.intensidade) // mesmo tamanho de bloco da exportação
    conteudo = (
      <div
        className="size-full"
        style={{
          backdropFilter: `blur(${raio}px)`,
          WebkitBackdropFilter: `blur(${raio}px)`,
          borderRadius: d.forma === 'elipse' ? '50%' : 0,
          clipPath: d.forma === 'elipse' ? 'ellipse(50% 50% at 50% 50%)' : undefined,
          // Mosaico: a prévia sugere os blocos com uma grade por cima do desfoque.
          backgroundImage: d.estilo === 'mosaico' ? 'linear-gradient(rgb(0 0 0/0.12) 1px, transparent 1px), linear-gradient(90deg, rgb(0 0 0/0.12) 1px, transparent 1px)' : undefined,
          backgroundSize: d.estilo === 'mosaico' ? `${bloco}px ${bloco}px` : undefined,
        }}
      />
    )
  }

  // Vídeo sem fundo na prévia: mistura (multiplicar tira o branco, "tela" tira o preto).
  const mistura = c.tipo === 'video' && c.semFundo ? (c.semFundo === 'preto' ? 'screen' : 'multiply') : undefined
  const ALCAS = [
    [-1, -1, 'nwse'],
    [0, -1, 'ns'],
    [1, -1, 'nesw'],
    [1, 0, 'ew'],
    [1, 1, 'nwse'],
    [0, 1, 'ns'],
    [-1, 1, 'nesw'],
    [-1, 0, 'ew'],
  ].filter(([sx, sy]) => !(c.tipo === 'texto' && sx === 0))

  return (
    <>
      <div
        ref={(el) => {
          caixa.current = el
          registrar(el)
        }}
        onPointerDown={mover}
        onDoubleClick={(e) => e.stopPropagation()}
        onContextMenu={(e) => {
          e.preventDefault()
          e.stopPropagation()
          aoSelecionar()
          aoMenu?.(e)
        }}
        className={`absolute cursor-move ${sel ? '' : 'hover:outline-1 hover:outline-white/60'}`}
        style={{ ...geometria, visibility: sempreVisivel ? 'visible' : 'hidden', mixBlendMode: c.mistura && c.mistura !== 'normal' ? c.mistura : mistura, opacity: sempreVisivel ? c.opacidade : undefined, pointerEvents: c.bloqueada ? 'none' : undefined }}
        aria-label={`Camada: ${c.tipo}`}
        data-camada={c.id}
      >
        {conteudo}
      </div>

      {/* Distorcida: contorno do quadrilátero e um canto para arrastar em cada ponta */}
      {sel && quad ? (
        <>
          <svg className="pointer-events-none absolute top-0 left-0 z-20 overflow-visible" width="1" height="1" aria-hidden="true">
            <polygon points={quad.map((p) => p.join(',')).join(' ')} fill="none" stroke="var(--color-acento)" strokeWidth="2" />
          </svg>
          {quad.map(([x, y], i) => (
            <span
              key={i}
              onPointerDown={(e) => {
                if (e.button !== 0) return
                const c0 = c.cantos
                arrastar(e, (dx, dy, ev) => aoMudar({ cantos: moverCanto(c0, i, dx / W, dy / H, ev.shiftKey ? (c.modoCantos === 'perspectiva' ? 'livre' : 'perspectiva') : (c.modoCantos ?? 'livre')) }))
              }}
              className="absolute z-20 size-4 -translate-x-1/2 -translate-y-1/2 cursor-crosshair rounded-sm border-2 border-acento bg-white shadow"
              style={{ left: x, top: y }}
              aria-label={`Canto ${i + 1} (arraste para distorcer)`}
              data-canto={i}
            />
          ))}
        </>
      ) : null}

      {/* Moldura e alças (fora da camada, para não herdarem a mistura) */}
      {sel && !quad ? (
        <div className="pointer-events-none absolute z-20" style={{ ...geometria, height: altura }} onDoubleClick={(e) => e.stopPropagation()}>
          <div className="absolute -inset-px border-2 border-acento" />
          {ALCAS.map(([sx, sy, cursor]) => (
            <span
              key={`${sx}${sy}`}
              onPointerDown={redimensionar(sx, sy)}
              className={`pointer-events-auto absolute -translate-x-1/2 -translate-y-1/2 border-2 border-acento bg-white shadow ${sx && sy ? 'size-3.5 rounded-full' : sx ? 'h-5 w-2 rounded-full' : 'h-2 w-5 rounded-full'}`}
              style={{ left: `${(sx + 1) * 50}%`, top: `${(sy + 1) * 50}%`, cursor: `${cursor}-resize` }}
              aria-label="Redimensionar"
            />
          ))}
          {c.tipo !== 'desfoque' ? (
            <>
              <span className="absolute -top-6 left-1/2 h-6 w-px -translate-x-1/2 bg-acento" />
              <span onPointerDown={girar} className="pointer-events-auto absolute -top-9 left-1/2 grid size-6 -translate-x-1/2 cursor-grab place-items-center rounded-full border-2 border-acento bg-white text-[0.625rem] font-bold text-acento shadow active:cursor-grabbing" aria-label="Girar" title="Arraste para girar">
                <Icone nome="girar" tamanho={12} className="pointer-events-none" />
              </span>
              {c.girar ? <span className="absolute -top-9 left-[calc(50%+1.25rem)] rounded bg-black/70 px-1 text-[0.625rem] font-semibold text-white tabular-nums">{c.girar}°</span> : null}
            </>
          ) : null}
        </div>
      ) : null}
    </>
  )
}
