import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Icone } from '../../../componentes/Icone'
import { CamadaNoPalco } from '../../video/_camada'
import { caixaGirada, maiorDentroGirado } from './documento'

/*
 * A "mesa" do editor de imagem: a imagem e as camadas, com zoom e mão.
 *   - Sem barras de rolagem: a imagem é posicionada por transformação.
 *   - Zoom: roda do mouse/pinça no ponto do cursor, até 3200% (pixels nítidos).
 *   - Mão: arrastar com o botão esquerdo (nas ferramentas que não desenham,
 *     ou com a Mão ligada / Espaço apertado) ou com o botão do meio.
 * Por cima, o que cada ferramenta precisa: recorte, alças de tamanho, linha e
 * grade do endireitar, pincel, camadas (as mesmas do editor de vídeo).
 */

const limitar = (v, a, b) => Math.min(b, Math.max(a, v))
/** Zoom máximo: 3200%, sem deixar a folha passar de ~60 mil px. */
export const zoomMaximo = (W, H) => Math.max(1, Math.min(32, 60000 / Math.max(W, H)))
export const ZOOM_MINIMO = 0.02

/** Ferramentas em que arrastar com o botão esquerdo (no vazio da imagem) move a imagem. */
const MAO_PADRAO = ['filtros']

export function Tela({
  previa,
  previaAlta,
  w,
  h,
  zoom,
  aoZoom,
  aoEscala,
  mao,
  ferramenta,
  rascunho,
  setRascunho,
  camadas,
  fontes,
  desenhos,
  versaoDesenhos,
  selecionada,
  aoSelecionar,
  aoMudarCamada,
  camadasInterativas,
  aoClicarVazio,
  pintura,
  aoPintar,
  aoSoltarPintura,
  pincel,
  pintando,
  aoEndireitar,
  contaGotas,
  aoContaGotas,
  aoFimTamanho,
  aoEditarCamada,
  aoExcluirCamada,
  baseOculta = false,
}) {
  const area = useRef(null)
  const deslocado = useRef(null)
  const visor = useRef(null)
  const [tamArea, setTamArea] = useState({ w: 800, h: 600 })
  const [vista, setVista] = useState(null) // { tx, ty } da folha na área; null = centralizada
  const [espaco, setEspaco] = useState(false)
  const [movendo, setMovendo] = useState(false)
  const [guias, setGuias] = useState(null)
  const [linha, setLinha] = useState(null) // endireitar: { x0, y0, x1, y1 } na área

  useEffect(() => {
    if (!area.current) return undefined
    const obs = new ResizeObserver(([e]) => setTamArea({ w: e.contentRect.width, h: e.contentRect.height }))
    obs.observe(area.current)
    return () => obs.disconnect()
  }, [])

  // Tamanho: enquanto arrasta as alças (ou digita), a prévia mostra o novo tamanho na mesma escala do atual.
  const naTamanho = ferramenta === 'tamanho' && rascunho && (rascunho.w !== w || rascunho.h !== h)
  const alcasTamanho = ferramenta === 'tamanho' && rascunho
  const wv = naTamanho ? rascunho.w : w
  const hv = naTamanho ? rascunho.h : h
  const refW = naTamanho ? Math.max(w, rascunho.w) : w
  const refH = naTamanho ? Math.max(h, rascunho.h) : h
  const ajuste = Math.min((tamArea.w - 48) / refW, (tamArea.h - 48) / refH)
  const maximo = zoomMaximo(w, h)
  const escala = zoom === 'ajustar' ? Math.max(ZOOM_MINIMO, ajuste) : limitar(zoom, ZOOM_MINIMO, maximo)
  useEffect(() => aoEscala?.(escala), [escala, aoEscala])
  const FW = wv * escala
  const FH = hv * escala
  const centrada = { tx: (tamArea.w - (naTamanho ? refW * escala : FW)) / 2, ty: (tamArea.h - (naTamanho ? refH * escala : FH)) / 2 }
  const pos = zoom === 'ajustar' || !vista ? centrada : vista
  const prender = (v) => ({ tx: limitar(v.tx, 60 - FW, tamArea.w - 60), ty: limitar(v.ty, 60 - FH, tamArea.h - 60) })

  // Ao voltar para "ajustar", recentraliza.
  useEffect(() => {
    if (zoom === 'ajustar') setVista(null)
  }, [zoom])

  // Zoom pelos botões/atalhos: mantém o centro da área parado.
  const escalaAnterior = useRef(escala)
  const ancora = useRef(null)
  useLayoutEffect(() => {
    const antes = escalaAnterior.current
    escalaAnterior.current = escala
    if (ancora.current) {
      ancora.current = null
      return
    }
    if (!vista || antes === escala || zoom === 'ajustar') return
    const ux = (tamArea.w / 2 - vista.tx) / antes
    const uy = (tamArea.h / 2 - vista.ty) / antes
    setVista(prender({ tx: tamArea.w / 2 - ux * escala, ty: tamArea.h / 2 - uy * escala }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [escala])

  // Roda do mouse / pinça: zoom no ponto do cursor.
  const estado = useRef({})
  estado.current = { escala, pos, aoZoom, maximo, FW, FH }
  useEffect(() => {
    const el = area.current
    if (!el) return undefined
    const roda = (e) => {
      const s = estado.current
      if (!s.aoZoom) return
      e.preventDefault()
      const r = el.getBoundingClientRect()
      const cx = e.clientX - r.left
      const cy = e.clientY - r.top
      const delta = e.deltaMode === 1 ? e.deltaY * 33 : e.deltaY
      const nova = limitar(s.escala * Math.exp(-delta * (e.ctrlKey ? 0.01 : 0.0018)), ZOOM_MINIMO, s.maximo)
      const ux = (cx - s.pos.tx) / s.escala
      const uy = (cy - s.pos.ty) / s.escala
      const novaPos = { tx: cx - ux * nova, ty: cy - uy * nova }
      // Acumula na hora: várias voltas rápidas antes de redesenhar contam todas.
      estado.current = { ...s, escala: nova, pos: novaPos }
      ancora.current = true
      setVista(novaPos)
      s.aoZoom(nova)
    }
    el.addEventListener('wheel', roda, { passive: false })
    return () => el.removeEventListener('wheel', roda)
  }, [])

  // Espaço apertado = mão temporária.
  useEffect(() => {
    const ehCampo = (e) => e.target.closest?.('input, textarea, select, button, [contenteditable], [role=slider]')
    const baixo = (e) => {
      if (e.code === 'Space' && !e.repeat && !ehCampo(e)) {
        e.preventDefault()
        setEspaco(true)
      }
    }
    const cima = (e) => e.code === 'Space' && setEspaco(false)
    const sair = () => setEspaco(false)
    addEventListener('keydown', baixo)
    addEventListener('keyup', cima)
    addEventListener('blur', sair)
    return () => {
      removeEventListener('keydown', baixo)
      removeEventListener('keyup', cima)
      removeEventListener('blur', sair)
    }
  }, [])

  const maoAtiva = mao || espaco
  const maoNoFundo = MAO_PADRAO.includes(ferramenta) || (ferramenta === 'fundo' && !pintando)

  /** Arrastar para mover a imagem (captura: vem antes das ferramentas). */
  const talvezMover = (e) => {
    // Nada de seleção de texto nem de "arrastar a imagem" do navegador por cima da mesa.
    // Clicar na mesa tira o foco do campo do painel (senão o Delete apagaria letras em vez da camada).
    const ativo = document.activeElement
    if (ativo?.closest?.('input, textarea, select, [contenteditable]') && !area.current?.contains(ativo)) ativo.blur()
    try {
      const s = getSelection()
      if (s && !s.isCollapsed) s.removeAllRanges()
    } catch {
      /* sem seleção */
    }
    const folha = area.current?.querySelector('[data-folha]')
    if (contaGotas) {
      // Conta-gotas: o clique pega a cor do ponto (fora da imagem, cancela).
      if (e.button !== 0) return
      e.preventDefault()
      e.stopPropagation()
      const r = folha.getBoundingClientRect()
      const dentro = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom
      aoContaGotas?.(dentro ? pontoDa(folha, e) : null)
      return
    }
    // Fora da imagem (a mesa em volta): arrastar move; clicar tira a seleção.
    const fora = e.target === area.current || e.target === deslocado.current
    const fundo = fora || e.target === visor.current || e.target === folha
    const pode = e.button === 1 || (e.button === 0 && (maoAtiva || fora || (maoNoFundo && fundo)))
    if (!pode) return
    e.preventDefault()
    e.stopPropagation()
    const inicio = { x: e.clientX, y: e.clientY, ...pos }
    let andou = false
    setMovendo(true)
    const mover = (ev) => {
      const dx = ev.clientX - inicio.x
      const dy = ev.clientY - inicio.y
      if (!andou && Math.hypot(dx, dy) < 3) return
      if (!andou && zoom === 'ajustar') aoZoom(escala)
      andou = true
      setVista(prender({ tx: inicio.tx + dx, ty: inicio.ty + dy }))
    }
    const soltar = () => {
      removeEventListener('pointermove', mover)
      removeEventListener('pointerup', soltar)
      removeEventListener('pointercancel', soltar)
      setMovendo(false)
      // Clique sem arrastar ao lado da imagem (ou no fundo, em Camadas): tira a seleção.
      if (!andou && e.button === 0 && !maoAtiva && camadasInterativas) aoSelecionar?.(null)
    }
    addEventListener('pointermove', mover)
    addEventListener('pointerup', soltar)
    addEventListener('pointercancel', soltar)
  }

  // Desenha a prévia no canvas visível (a de alta resolução quando o zoom pede).
  const fonte = previaAlta ?? previa
  useEffect(() => {
    const c = visor.current
    if (!c || !fonte) return
    c.width = fonte.width
    c.height = fonte.height
    c.getContext('2d').drawImage(fonte, 0, 0)
  }, [fonte])
  const pixelado = fonte ? (escala * w) / fonte.width >= 2 : false

  // Ponto da imagem (px reais) sob o ponteiro.
  const pontoDa = (folha, ev) => {
    const r = folha.getBoundingClientRect()
    return { x: ((ev.clientX - r.left) / r.width) * w, y: ((ev.clientY - r.top) / r.height) * h }
  }
  const arrastar = (aoMover, aoSoltar) => (e) => {
    e.preventDefault()
    e.stopPropagation()
    const folha = e.currentTarget.closest('[data-folha]')
    const r = folha.getBoundingClientRect()
    const inicio = { x: e.clientX, y: e.clientY }
    const mover = (ev) => aoMover(((ev.clientX - inicio.x) / r.width) * wv, ((ev.clientY - inicio.y) / r.height) * hv, ev)
    const soltar = () => {
      removeEventListener('pointermove', mover)
      removeEventListener('pointerup', soltar)
      aoSoltar?.()
    }
    addEventListener('pointermove', mover)
    addEventListener('pointerup', soltar)
  }

  const aoApertarFolha = (e) => {
    if (e.button !== 0) return
    const folha = e.currentTarget
    if (ferramenta === 'tamanho' && rascunho) {
      // Endireitar: desenhe uma linha sobre algo que deveria estar reto.
      const r = area.current.getBoundingClientRect()
      const x0 = e.clientX - r.left
      const y0 = e.clientY - r.top
      setLinha({ x0, y0, x1: x0, y1: y0 })
      const mover = (ev) => setLinha({ x0, y0, x1: ev.clientX - r.left, y1: ev.clientY - r.top })
      const soltar = (ev) => {
        removeEventListener('pointermove', mover)
        removeEventListener('pointerup', soltar)
        setLinha(null)
        const dx = ev.clientX - r.left - x0
        const dy = ev.clientY - r.top - y0
        // Só um clique (sem linha): tira a seleção da camada.
        if (Math.hypot(dx, dy) < 12) return aoClicarVazio?.(pontoDa(folha, ev))
        let ang = (Math.atan2(dy, dx) * 180) / Math.PI // na tela (já girada)
        if (ang > 90) ang -= 180
        if (ang < -90) ang += 180
        const desvio = Math.abs(ang) > 45 ? ang - Math.sign(ang) * 90 : ang
        aoEndireitar?.(limitar(Math.round(((rascunho.angulo ?? 0) - desvio) * 10) / 10, -45, 45))
      }
      addEventListener('pointermove', mover)
      addEventListener('pointerup', soltar)
      return
    }
    if (pintando) {
      e.preventDefault()
      const ponto = (ev) => pontoDa(folha, ev)
      aoPintar(ponto(e), true, e)
      const mover = (ev) => aoPintar(ponto(ev), false, ev)
      const soltar = () => {
        removeEventListener('pointermove', mover)
        removeEventListener('pointerup', soltar)
        removeEventListener('pointercancel', soltar)
        removeEventListener('blur', soltar)
        aoSoltarPintura()
      }
      addEventListener('pointermove', mover)
      addEventListener('pointerup', soltar)
      // Se o navegador cancelar o ponteiro (ou a janela perder o foco), o traço termina.
      addEventListener('pointercancel', soltar)
      addEventListener('blur', soltar)
      return
    }
    if (e.target === visor.current || e.target === folha) aoClicarVazio?.(pontoDa(folha, e))
  }

  // Endireitar: prévia girada, com o recorte (ou a caixa expandida) e a grade.
  const angulo = ferramenta === 'tamanho' ? (rascunho?.angulo ?? 0) : 0
  const quadroGirado = ferramenta === 'tamanho' && rascunho && angulo ? (rascunho.bordas === 'expandir' ? caixaGirada(w, h, angulo) : maiorDentroGirado(w, h, angulo)) : null

  const cursor = contaGotas ? 'crosshair' : movendo ? 'grabbing' : maoAtiva ? 'grab' : pintando || ferramenta === 'tamanho' ? 'crosshair' : ferramenta === 'texto' ? 'text' : maoNoFundo ? 'grab' : undefined
  const palco = { w: FW, h: FH }

  return (
    <div
      ref={area}
      data-mesa=""
      onPointerDownCapture={talvezMover}
      // O navegador não pode "pegar" a imagem para arrastar (isso travava o pincel).
      onDragStartCapture={(e) => e.preventDefault()}
      onAuxClick={(e) => e.button === 1 && e.preventDefault()}
      className={`relative min-h-[22rem] flex-1 touch-none overflow-hidden rounded-[var(--radius-cartao)] bg-superficie-2 select-none ${contaGotas ? '[&_*]:!cursor-crosshair' : movendo ? '[&_*]:!cursor-grabbing' : maoAtiva ? '[&_*]:!cursor-grab' : ''}`}
      style={{ cursor }}
    >
      {contaGotas ? (
        <p className="pointer-events-none absolute top-3 left-1/2 z-40 -translate-x-1/2 rounded-full bg-black/75 px-3 py-1.5 text-xs font-semibold whitespace-nowrap text-white shadow" data-conta-gotas="">
          Clique na imagem para pegar a cor · Esc cancela
        </p>
      ) : null}
      <div ref={deslocado} className="absolute top-0 left-0" style={{ transform: `translate(${pos.tx}px, ${pos.ty}px)` }}>
        {/* Tamanho: contorno do tamanho atual, para comparar com o novo */}
        {naTamanho ? (
          <div className="pointer-events-none absolute top-0 left-0 z-10 border-2 border-dashed border-fraca/70" style={{ width: w * escala, height: h * escala }}>
            <span className="absolute -top-6 left-0 rounded bg-black/60 px-1.5 py-0.5 text-[0.625rem] font-semibold whitespace-nowrap text-white tabular-nums">
              Atual: {w} × {h}
            </span>
          </div>
        ) : null}
        <div
          data-folha=""
          className="xadrez relative shadow-[var(--shadow-cartao)]"
          style={{ width: FW, height: FH, cursor: maoAtiva || movendo ? undefined : cursor }}
          onPointerDown={aoApertarFolha}
        >
          <div className="absolute inset-0" style={{ transform: angulo ? `rotate(${angulo}deg)` : undefined }}>
            <canvas ref={visor} draggable={false} className="absolute inset-0 size-full" style={{ imageRendering: pixelado ? 'pixelated' : 'auto', opacity: baseOculta ? 0 : 1 }} aria-label="Imagem" />

            {/* Camadas (texto, imagem, desenho) — as mesmas do editor de vídeo */}
            <div className={camadasInterativas ? '' : 'pointer-events-none'}>
              {camadas.map((cam) =>
                cam.visivel === false ? null : cam.tipo === 'desenho' ? (
                  <CamadaDesenho key={cam.id} cam={cam} canvas={desenhos.get(cam.id)?.canvas} versao={versaoDesenhos} />
                ) : (
                  <CamadaNoPalco
                    key={cam.id}
                    cam={cam}
                    fonte={fontes.get(cam.id)}
                    palco={palco}
                    sel={camadasInterativas && selecionada === cam.id}
                    sempreVisivel
                    registrar={() => {}}
                    registrarVideo={() => {}}
                    aoSelecionar={() => aoSelecionar?.(cam.id)}
                    aoMudar={(d) => aoMudarCamada(cam.id, d)}
                    aoGuias={setGuias}
                  />
                ),
              )}
            </div>
          </div>

          {camadasInterativas && selecionada ? <BarraCamada id={selecionada} versao={camadas} escala={escala} angulo={angulo} aoEditar={aoEditarCamada} aoExcluir={aoExcluirCamada} /> : null}

          {guias?.v ? <div className="pointer-events-none absolute inset-y-0 left-1/2 z-30 w-px -translate-x-1/2 bg-[#ff3d8b]" /> : null}
          {guias?.h ? <div className="pointer-events-none absolute inset-x-0 top-1/2 z-30 h-px -translate-y-1/2 bg-[#ff3d8b]" /> : null}

          {/* Máscara do "apagar objeto" */}
          {pintura ? <CanvasEspelho fonte={pintura} className="pointer-events-none absolute inset-0 size-full opacity-55" /> : null}
          {pintando && pincel?.tamanho > 0 && !maoAtiva ? <CursorPincel tamanho={pincel.tamanho * escala} /> : null}

          {/* Recorte */}
          {ferramenta === 'recortar' && rascunho ? <CaixaRecorte r={rascunho} w={w} h={h} escala={escala} mudar={setRascunho} arrastar={arrastar} /> : null}

          {/* Endireitar: área que fica e grade */}
          {quadroGirado ? (
            <div
              className="pointer-events-none absolute border-2 border-white"
              style={{
                width: quadroGirado.w * escala,
                height: quadroGirado.h * escala,
                left: FW / 2 - (quadroGirado.w * escala) / 2,
                top: FH / 2 - (quadroGirado.h * escala) / 2,
                boxShadow: rascunho.bordas === 'expandir' ? undefined : '0 0 0 100000px rgb(0 0 0 / 0.55)',
                backgroundImage:
                  'linear-gradient(to right, rgb(255 255 255 / 0.5) 1px, transparent 1px), linear-gradient(to bottom, rgb(255 255 255 / 0.5) 1px, transparent 1px), linear-gradient(to right, rgb(255 255 255 / 0.15) 1px, transparent 1px), linear-gradient(to bottom, rgb(255 255 255 / 0.15) 1px, transparent 1px)',
                backgroundSize: '33.333% 33.333%, 33.333% 33.333%, 8.333% 8.333%, 8.333% 8.333%',
              }}
              data-endireitar=""
            >
              <span className="absolute -top-6 left-0 rounded bg-black/70 px-1.5 py-0.5 text-[0.625rem] font-semibold whitespace-nowrap text-white tabular-nums">
                {Math.round(quadroGirado.w)} × {Math.round(quadroGirado.h)} px · {angulo.toLocaleString('pt-BR')}°
              </span>
            </div>
          ) : null}

          {/* Tamanho: alças para esticar/achatar (aplica ao soltar) */}
          {alcasTamanho ? (
            <>
              {[
                ['direita', 'top-1/2 -right-2 h-10 w-3 -translate-y-1/2 cursor-ew-resize'],
                ['base', '-bottom-2 left-1/2 h-3 w-10 -translate-x-1/2 cursor-ns-resize'],
                ['canto', '-right-2 -bottom-2 size-4 cursor-nwse-resize'],
              ].map(([lado, classe]) => (
                <span
                  key={lado}
                  aria-label={`Arrastar ${lado}`}
                  onPointerDown={(() => {
                    const r0 = { ...rascunho }
                    return arrastar((dx, dy) => {
                      let nw = lado === 'base' ? r0.w : Math.max(1, Math.round(r0.w + dx))
                      let nh = lado === 'direita' ? r0.h : Math.max(1, Math.round(r0.h + dy))
                      if (r0.trava) {
                        if (lado === 'base') nw = Math.round((nh * r0.w) / r0.h)
                        else nh = Math.round((nw * r0.h) / r0.w)
                      }
                      setRascunho({ ...r0, w: nw, h: nh })
                    }, () => aoFimTamanho?.())
                  })()}
                  className={`absolute z-20 rounded-sm border-2 border-white bg-acento shadow ${classe}`}
                />
              ))}
              {naTamanho ? (
                <span className="pointer-events-none absolute -bottom-7 left-0 rounded bg-acento px-1.5 py-0.5 text-[0.625rem] font-semibold whitespace-nowrap text-white tabular-nums">
                  Novo: {rascunho.w} × {rascunho.h}
                </span>
              ) : null}
            </>
          ) : null}
        </div>
      </div>

      {/* Linha do endireitar sendo desenhada */}
      {linha ? (
        <svg className="pointer-events-none absolute inset-0 size-full">
          <line x1={linha.x0} y1={linha.y0} x2={linha.x1} y2={linha.y1} stroke="#fff" strokeWidth="3" />
          <line x1={linha.x0} y1={linha.y0} x2={linha.x1} y2={linha.y1} stroke="#ff3d8b" strokeWidth="1.5" strokeDasharray="6 4" />
        </svg>
      ) : null}
    </div>
  )
}

/** Camada de desenho: o próprio canvas dela, colocado na folha. */
function CamadaDesenho({ cam, canvas }) {
  const caixa = useRef(null)
  useLayoutEffect(() => {
    const el = caixa.current
    if (!el || !canvas) return
    canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none'
    if (canvas.parentElement !== el) el.replaceChildren(canvas)
  }, [canvas])
  return (
    <div
      ref={caixa}
      className="pointer-events-none absolute inset-0"
      style={{ opacity: cam.opacidade ?? 1, mixBlendMode: cam.mistura && cam.mistura !== 'normal' ? cam.mistura : undefined }}
      data-camada-desenho={cam.id}
    />
  )
}

/** Mostra um OffscreenCanvas (de pintura) num canvas da página, redesenhando a cada mudança. */
function CanvasEspelho({ fonte, className }) {
  const c = useRef(null)
  useEffect(() => {
    let quadro = 0
    const desenhar = () => {
      const el = c.current
      if (!el) return
      if (el.width !== fonte.canvas.width || el.height !== fonte.canvas.height) {
        el.width = fonte.canvas.width
        el.height = fonte.canvas.height
      }
      const ctx = el.getContext('2d')
      ctx.clearRect(0, 0, el.width, el.height)
      ctx.drawImage(fonte.canvas, 0, 0)
    }
    desenhar()
    fonte.ouvir = () => {
      cancelAnimationFrame(quadro)
      quadro = requestAnimationFrame(desenhar)
    }
    return () => {
      cancelAnimationFrame(quadro)
      fonte.ouvir = null
    }
  }, [fonte])
  return <canvas ref={c} className={className} />
}

/** Círculo do tamanho do pincel seguindo o mouse. */
function CursorPincel({ tamanho }) {
  const [p, setP] = useState(null)
  const el = useRef(null)
  useEffect(() => {
    const folha = el.current?.parentElement
    if (!folha) return undefined
    const mover = (e) => {
      const r = folha.getBoundingClientRect()
      setP({ x: e.clientX - r.left, y: e.clientY - r.top })
    }
    const sair = () => setP(null)
    folha.addEventListener('pointermove', mover)
    folha.addEventListener('pointerleave', sair)
    return () => {
      folha.removeEventListener('pointermove', mover)
      folha.removeEventListener('pointerleave', sair)
    }
  }, [])
  return (
    <span
      ref={el}
      className="pointer-events-none absolute z-30 rounded-full border border-white shadow-[0_0_0_1px_rgba(0,0,0,.6)]"
      style={{ width: tamanho, height: tamanho, left: (p?.x ?? -9999) - tamanho / 2, top: (p?.y ?? -9999) - tamanho / 2, display: p ? 'block' : 'none' }}
    />
  )
}

/** Caixa de recorte: arrastar move, alças mudam o tamanho (com proporção, se houver). */
function CaixaRecorte({ r, w, h, escala, mudar, arrastar }) {
  const alca = (lado) =>
    arrastar((dx, dy) => {
      let { x, y, w: rw, h: rh } = r
      if (lado.includes('e')) rw = limitar(r.w + dx, 8, w - r.x)
      if (lado.includes('s')) rh = limitar(r.h + dy, 8, h - r.y)
      if (lado.includes('w')) {
        x = limitar(r.x + dx, 0, r.x + r.w - 8)
        rw = r.w + (r.x - x)
      }
      if (lado.includes('n')) {
        y = limitar(r.y + dy, 0, r.y + r.h - 8)
        rh = r.h + (r.y - y)
      }
      if (r.proporcao) {
        if (lado === 'n' || lado === 's') rw = Math.min(rh * r.proporcao, w - x)
        else rh = Math.min(rw / r.proporcao, h - y)
        rw = Math.min(rw, rh * r.proporcao)
        rh = rw / r.proporcao
        if (lado.includes('n')) y = r.y + r.h - rh
        if (lado.includes('w')) x = r.x + r.w - rw
      }
      mudar({ ...r, x, y, w: rw, h: rh })
    })
  const mover = arrastar((dx, dy) => mudar({ ...r, x: limitar(r.x + dx, 0, w - r.w), y: limitar(r.y + dy, 0, h - r.h) }))
  const ALCAS = [
    ['nw', 'left-0 top-0 cursor-nwse-resize'],
    ['n', 'left-1/2 top-0 cursor-ns-resize'],
    ['ne', 'left-full top-0 cursor-nesw-resize'],
    ['e', 'left-full top-1/2 cursor-ew-resize'],
    ['se', 'left-full top-full cursor-nwse-resize'],
    ['s', 'left-1/2 top-full cursor-ns-resize'],
    ['sw', 'left-0 top-full cursor-nesw-resize'],
    ['w', 'left-0 top-1/2 cursor-ew-resize'],
  ]
  return (
    <div
      onPointerDown={mover}
      className="absolute z-20 cursor-move border-2 border-white"
      style={{
        left: r.x * escala,
        top: r.y * escala,
        width: r.w * escala,
        height: r.h * escala,
        boxShadow: '0 0 0 100000px rgb(0 0 0 / 0.55)',
        backgroundImage: 'linear-gradient(to right, rgb(255 255 255 / 0.4) 1px, transparent 1px), linear-gradient(to bottom, rgb(255 255 255 / 0.4) 1px, transparent 1px)',
        backgroundSize: '33.333% 33.333%',
      }}
      data-recorte=""
    >
      {ALCAS.map(([lado, classe]) => (
        <span key={lado} onPointerDown={alca(lado)} className={`absolute size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-sm border-2 border-acento bg-white shadow ${classe}`} />
      ))}
    </div>
  )
}

/** Barrinha em cima da camada selecionada: editar (abre as opções dela) e excluir. */
function BarraCamada({ id, versao, aoEditar, aoExcluir }) {
  const el = useRef(null)
  const [pos, setPos] = useState(null)
  useLayoutEffect(() => {
    const folha = el.current?.closest('[data-folha]')
    const alvo = folha?.querySelector(`[data-camada="${CSS.escape(id)}"]`)
    if (!folha || !alvo) return setPos(null)
    const f = folha.getBoundingClientRect()
    const r = alvo.getBoundingClientRect()
    const novo = { x: r.left + r.width / 2 - f.left, y: r.top - f.top }
    if (!pos || Math.abs(pos.x - novo.x) > 0.5 || Math.abs(pos.y - novo.y) > 0.5) setPos(novo)
  })
  void versao
  return (
    <div
      ref={el}
      className="absolute z-30 flex -translate-x-1/2 items-center gap-0.5 rounded-lg border border-borda bg-superficie p-0.5 shadow-[var(--shadow-flutuante)]"
      style={{ left: pos?.x ?? -9999, top: Math.max(4, (pos?.y ?? 0) - 52), visibility: pos ? 'visible' : 'hidden' }}
      onPointerDown={(e) => e.stopPropagation()}
      data-barra-camada=""
    >
      <button type="button" onClick={() => aoEditar?.(id)} aria-label="Editar a camada" title="Editar a camada" className="grid size-7 place-items-center rounded-md text-suave hover:bg-superficie-2 hover:text-tinta">
        <Icone nome="lapis" tamanho={14} />
      </button>
      <button type="button" onClick={() => aoExcluir?.(id)} aria-label="Excluir a camada (Delete)" title="Excluir a camada (Delete)" className="grid size-7 place-items-center rounded-md text-suave hover:bg-superficie-2 hover:text-perigo">
        <Icone nome="apagar" tamanho={14} />
      </button>
    </div>
  )
}
