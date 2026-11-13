import { forwardRef, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState } from 'react'
import { CamadaNoPalco } from './_camada'
import { PADRAO_AUDIO, PADRAO_CAMADA, duracaoTotal, iniciosNaLinha, localizar, quadroGirado, tamanhoFinal } from './_projeto'

/** Encaixa uma proporção dentro de uma caixa. */
function encaixar(caixa, proporcao) {
  if (!caixa.w || !caixa.h) return { w: 0, h: 0 }
  return caixa.w / caixa.h > proporcao ? { w: caixa.h * proporcao, h: caixa.h } : { w: caixa.w, h: caixa.w / proporcao }
}

/**
 * Clipe de imagem: imita a interface de um <video> (currentTime, play, pause…)
 * com um relógio próprio, para o resto do palco tratar tudo igual.
 */
class ClipeImagem {
  constructor(el) {
    this.el = el
    this._t = 0
    this._marco = null
    this.playbackRate = 1
    this.preservesPitch = true
    this.muted = true
    this.volume = 0
    this.ended = false
  }
  get style() {
    return this.el.style
  }
  get currentTime() {
    return this._marco == null ? this._t : this._t + (performance.now() - this._marco) / 1000
  }
  set currentTime(v) {
    this._t = v
    if (this._marco != null) this._marco = performance.now()
  }
  get paused() {
    return this._marco == null
  }
  play() {
    if (this._marco == null) this._marco = performance.now()
    return Promise.resolve()
  }
  pause() {
    if (this._marco != null) {
      this._t = this.currentTime
      this._marco = null
    }
  }
}

/** Arrasto genérico: chama mover(dx, dy) em px desde o início; fim() ao soltar. */
function arrastar(e, mover, fim) {
  e.preventDefault()
  e.stopPropagation()
  const alvo = e.currentTarget
  try {
    alvo.setPointerCapture(e.pointerId)
  } catch {
    /* ponteiro já solto (ou evento sintético): segue sem captura */
  }
  const x0 = e.clientX
  const y0 = e.clientY
  const aoMover = (ev) => mover(ev.clientX - x0, ev.clientY - y0)
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

/** Retângulo de recorte livre (frações), com 8 alças. */
function Recorte({ valor, aoMudar, largura, altura }) {
  const r = valor
  const alca = (dx, dy) => (e) => {
    const r0 = { ...r }
    arrastar(e, (mx, my) => {
      const fx = mx / largura
      const fy = my / altura
      let { x, y, w, h } = r0
      if (dx === 0 && dy === 0) {
        x = Math.min(Math.max(0, r0.x + fx), 1 - r0.w)
        y = Math.min(Math.max(0, r0.y + fy), 1 - r0.h)
      } else {
        if (dx < 0) {
          x = Math.min(Math.max(0, r0.x + fx), r0.x + r0.w - 0.05)
          w = r0.x + r0.w - x
        }
        if (dx > 0) w = Math.min(Math.max(0.05, r0.w + fx), 1 - r0.x)
        if (dy < 0) {
          y = Math.min(Math.max(0, r0.y + fy), r0.y + r0.h - 0.05)
          h = r0.y + r0.h - y
        }
        if (dy > 0) h = Math.min(Math.max(0.05, r0.h + fy), 1 - r0.y)
      }
      aoMudar({ x, y, w, h })
    })
  }
  const pos = (v) => `${v * 100}%`
  const alcas = [
    [-1, -1, 'nwse'],
    [0, -1, 'ns'],
    [1, -1, 'nesw'],
    [1, 0, 'ew'],
    [1, 1, 'nwse'],
    [0, 1, 'ns'],
    [-1, 1, 'nesw'],
    [-1, 0, 'ew'],
  ]
  return (
    <div className="absolute inset-0">
      {/* Fora do recorte: escurecido */}
      <div className="pointer-events-none absolute inset-0" style={{ clipPath: `polygon(0 0,100% 0,100% 100%,0 100%,0 0,${pos(r.x)} ${pos(r.y)},${pos(r.x)} ${pos(r.y + r.h)},${pos(r.x + r.w)} ${pos(r.y + r.h)},${pos(r.x + r.w)} ${pos(r.y)},${pos(r.x)} ${pos(r.y)})`, background: 'rgb(0 0 0 / 0.6)' }} />
      <div
        role="group"
        aria-label="Área do recorte"
        onPointerDown={alca(0, 0)}
        className="absolute cursor-move border-2 border-white shadow-[0_0_0_1px_rgb(0_0_0/0.5)]"
        style={{ left: pos(r.x), top: pos(r.y), width: pos(r.w), height: pos(r.h) }}
      >
        <div className="pointer-events-none absolute inset-0 grid grid-cols-3 grid-rows-3">
          {Array.from({ length: 9 }, (_, i) => (
            <span key={i} className="border border-white/25" />
          ))}
        </div>
        {alcas.map(([dx, dy, cursor]) => (
          <span
            key={`${dx}${dy}`}
            onPointerDown={alca(dx, dy)}
            className="absolute size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-sm border-2 border-black/40 bg-white"
            style={{ left: `${(dx + 1) * 50}%`, top: `${(dy + 1) * 50}%`, cursor: `${cursor}-resize` }}
          />
        ))}
        <span className="pointer-events-none absolute top-1.5 left-1/2 -translate-x-1/2 rounded bg-black/70 px-1.5 py-0.5 text-[0.6875rem] font-semibold whitespace-nowrap text-white tabular-nums">
          {Math.round(r.w * 1000) / 10}% × {Math.round(r.h * 1000) / 10}%
        </span>
      </div>
    </div>
  )
}

/**
 * Palco: a prévia do vídeo montado, tocando de verdade.
 * Expõe (ref): tocar(), pausar(), alternar(), buscar(t), tempo(), tocando().
 * Chama aoTempo(t) a cada quadro (sem re-renderizar o editor).
 */
export const Palco = forwardRef(function Palco({ p, fontes, selecao, aoSelecionar, aoMudarCamada, recortando, aoTempo, aoTocando, aoMenu, vazio }, ref) {
  const caixa = useRef(null)
  const [tamCaixa, setTamCaixa] = useState({ w: 0, h: 0 })
  const videos = useRef({})
  const camadasEl = useRef({})
  const videosCamada = useRef({})
  const musica = useRef(null)
  const veu = useRef(null)
  const m = useRef({ tocando: false, t: 0, ativo: 0, quadro: 0 })
  const atual = useRef({ p, fontes })
  atual.current = { p, fontes }

  useLayoutEffect(() => {
    const el = caixa.current
    if (!el) return undefined
    const medir = () => setTamCaixa({ w: el.clientWidth, h: el.clientHeight })
    medir()
    const ro = new ResizeObserver(medir)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const final = tamanhoFinal(p, fontes)
  const clipeAtivo = p.clipes[Math.min(m.current.ativo, p.clipes.length - 1)]
  const fonteAtiva = clipeAtivo ? fontes[clipeAtivo.fonte] : null
  // Recortando: mostra o quadro inteiro (girado) do clipe atual.
  const qAtivo = fonteAtiva ? quadroGirado(fonteAtiva, p.girar) : { w: 16, h: 9 }
  const proporcao = recortando ? qAtivo.w / qAtivo.h : final.w / final.h
  const palco = encaixar(tamCaixa, proporcao)

  /** Aplica o estado do tempo t: clipe visível, camadas, véu de fade e volumes. */
  const aplicar = (t, buscarVideos) => {
    const { p: pp, fontes: ff } = atual.current
    if (!pp.clipes.length) return
    const T = duracaoTotal(pp)
    const loc = localizar(pp, Math.min(t, T - 0.001))
    m.current.ativo = loc.indice
    pp.clipes.forEach((c, i) => {
      const v = videos.current[c.id]
      if (!v) return
      v.style.visibility = i === loc.indice ? 'visible' : 'hidden'
      if (i !== loc.indice && !v.paused) v.pause()
    })
    const c = pp.clipes[loc.indice]
    const v = videos.current[c.id]
    // Fades: véu preto e volume.
    const rampa = (ini, fim) => {
      let x = 0
      if (ini && t < ini) x = Math.max(x, 1 - t / ini)
      if (fim && t > T - fim) x = Math.max(x, (t - (T - fim)) / fim)
      return Math.min(1, x)
    }
    const fade = rampa(pp.fadeIn, pp.fadeOut)
    if (veu.current) veu.current.style.opacity = String(fade)
    const au = { ...PADRAO_AUDIO, ...pp.audio }
    const fadeSom = rampa(Math.max(pp.fadeIn, au.fadeIn), Math.max(pp.fadeOut, au.fadeOut))
    const geral = au.mudo ? 0 : au.volume
    if (v) {
      if (buscarVideos && Math.abs(v.currentTime - loc.local) > 0.04) v.currentTime = loc.local
      v.playbackRate = c.velocidade
      v.preservesPitch = true
      v.muted = c.mudo
      v.volume = Math.max(0, Math.min(1, c.volume * geral * (pp.musica ? pp.musica.volumeOriginal : 1) * (1 - fadeSom)))
    }
    // Camadas: visíveis só no intervalo delas; vídeos sobrepostos acompanham.
    for (const cam of pp.camadas) {
      const el = camadasEl.current[cam.id]
      const dentro = t >= cam.inicio && t <= cam.fim
      if (el) {
        el.style.visibility = dentro ? 'visible' : 'hidden'
        const fi = cam.fadeIn ? Math.min(1, Math.max(0, (t - cam.inicio) / cam.fadeIn)) : 1
        const fo = cam.fadeOut ? Math.min(1, Math.max(0, (cam.fim - t) / cam.fadeOut)) : 1
        el.style.opacity = String((cam.opacidade ?? PADRAO_CAMADA.opacidade) * Math.min(fi, fo))
      }
      if (cam.tipo === 'video') {
        const vc = videosCamada.current[cam.id]
        if (!vc) continue
        const alvo = t - cam.inicio + (cam.corte ?? 0)
        const dur = ff[cam.fonte]?.duracao ?? Infinity
        vc.muted = !(cam.volume > 0)
        vc.volume = Math.min(1, (cam.volume ?? 0) * geral)
        if (dentro && alvo < dur) {
          if (buscarVideos || Math.abs(vc.currentTime - alvo) > 0.3) vc.currentTime = Math.max(0, alvo)
          if (m.current.tocando && vc.paused) vc.play().catch(() => {})
          if (!m.current.tocando && !vc.paused) vc.pause()
        } else if (!vc.paused) vc.pause()
      }
    }
    // Música por baixo.
    const mu = musica.current
    if (mu && pp.musica) {
      const dm = mu.duration || ff[pp.musica.fonte]?.duracao || Infinity
      const alvo = pp.musica.repetir ? t % dm : t
      const mi = pp.musica.fadeIn && t < pp.musica.fadeIn ? t / pp.musica.fadeIn : 1
      const saida = pp.musica.fadeOut || Math.min(2, T / 4)
      const mo = t > T - saida ? Math.max(0, (T - t) / saida) : 1
      mu.volume = Math.max(0, Math.min(1, pp.musica.volume * Math.min(mi, mo)))
      if (alvo < dm) {
        if (buscarVideos || Math.abs(mu.currentTime - alvo) > 0.3) mu.currentTime = alvo
        if (m.current.tocando && mu.paused) mu.play().catch(() => {})
      } else if (!mu.paused) mu.pause()
      if (!m.current.tocando && !mu.paused) mu.pause()
    }
  }

  const laco = () => {
    const { p: pp } = atual.current
    if (!m.current.tocando || !pp.clipes.length) return
    const inicios = iniciosNaLinha(pp)
    let i = Math.min(m.current.ativo, pp.clipes.length - 1)
    const c = pp.clipes[i]
    const v = videos.current[c.id]
    let t = inicios[i] + ((v?.currentTime ?? c.inicio) - c.inicio) / c.velocidade
    // Fim do clipe: passa para o próximo (ou para no fim do vídeo).
    if (!v || v.currentTime >= c.fim - 0.03 || v.ended) {
      if (v && !v.paused) v.pause()
      i += 1
      if (i >= pp.clipes.length) {
        pausar()
        m.current.t = duracaoTotal(pp)
        aplicar(m.current.t, false)
        aoTempo?.(m.current.t)
        return
      }
      const n = pp.clipes[i]
      const nv = videos.current[n.id]
      m.current.ativo = i
      t = inicios[i]
      if (nv) {
        nv.currentTime = n.inicio
        nv.play().catch(() => {})
      }
    }
    m.current.t = t
    aplicar(t, false)
    aoTempo?.(t)
    m.current.quadro = requestAnimationFrame(laco)
  }

  const tocar = () => {
    const { p: pp } = atual.current
    if (!pp.clipes.length) return
    const T = duracaoTotal(pp)
    if (m.current.t >= T - 0.05) m.current.t = 0
    aplicar(m.current.t, true)
    const c = pp.clipes[m.current.ativo]
    const v = videos.current[c.id]
    m.current.tocando = true
    aoTocando?.(true)
    v?.play().catch(() => {})
    aplicar(m.current.t, false)
    cancelAnimationFrame(m.current.quadro)
    m.current.quadro = requestAnimationFrame(laco)
  }
  function pausar() {
    m.current.tocando = false
    aoTocando?.(false)
    cancelAnimationFrame(m.current.quadro)
    Object.values(videos.current).forEach((v) => v && !v.paused && v.pause())
    Object.values(videosCamada.current).forEach((v) => v && !v.paused && v.pause())
    if (musica.current && !musica.current.paused) musica.current.pause()
  }
  const buscar = (t) => {
    const { p: pp } = atual.current
    const T = duracaoTotal(pp)
    m.current.t = Math.min(Math.max(0, t), T)
    aplicar(m.current.t, true)
    if (m.current.tocando) {
      const c = pp.clipes[m.current.ativo]
      videos.current[c?.id]?.play().catch(() => {})
    }
    aoTempo?.(m.current.t)
  }

  useImperativeHandle(ref, () => ({
    tocar,
    pausar,
    alternar: () => (m.current.tocando ? pausar() : tocar()),
    buscar,
    tempo: () => m.current.t,
    tocando: () => m.current.tocando,
    /** Quadro do clipe no cursor, cru (sem camadas nem efeitos), como PNG. */
    async capturar() {
      const { p: pp } = atual.current
      const c = pp.clipes[Math.min(m.current.ativo, pp.clipes.length - 1)]
      const el = videos.current[c?.id]
      if (!el) return null
      const src = el instanceof ClipeImagem ? el.el : el
      if (src.seeking) await new Promise((ok) => src.addEventListener('seeked', ok, { once: true }))
      const w = src.videoWidth || src.naturalWidth
      const h = src.videoHeight || src.naturalHeight
      if (!w || !h) return null
      const cv = document.createElement('canvas')
      cv.width = w
      cv.height = h
      cv.getContext('2d').drawImage(src, 0, 0, w, h)
      return new Promise((ok) => cv.toBlob(ok, 'image/png'))
    },
  }))

  // Projeto mudou (corte, velocidade, camadas…): reaplica no tempo atual.
  useEffect(() => {
    const T = duracaoTotal(p)
    if (m.current.t > T) m.current.t = T
    aplicar(m.current.t, !m.current.tocando)
    aoTempo?.(m.current.t)
  })
  useEffect(() => () => pausar(), [])

  // ─── Geometria de cada clipe (recorte + giro, encaixado no palco) ─────────
  const geometria = (fonte) => {
    const q = quadroGirado(fonte, p.girar)
    const r = recortando || !p.recorte ? { x: 0, y: 0, w: 1, h: 1 } : p.recorte
    const rw = r.w * q.w
    const rh = r.h * q.h
    const s = Math.min(palco.w / rw, palco.h / rh) || 0
    return {
      caixa: { left: (palco.w - rw * s) / 2 - r.x * q.w * s, top: (palco.h - rh * s) / 2 - r.y * q.h * s, width: q.w * s, height: q.h * s },
      video: { width: fonte.largura * s, height: fonte.altura * s, left: ((q.w - fonte.largura) * s) / 2, top: ((q.h - fonte.altura) * s) / 2 },
    }
  }
  const filtroCor = `brightness(${1 + p.cor.brilho}) contrast(${p.cor.contraste}) saturate(${p.cor.saturacao})`

  const [guias, setGuias] = useState(null)

  return (
    <div ref={caixa} className="relative grid size-full place-items-center">
      {vazio ? null : (
        <div
          className="relative overflow-hidden bg-black shadow-[0_10px_40px_-15px_rgb(0_0_0/0.6)]"
          style={{ width: palco.w, height: palco.h }}
          onPointerDown={(e) => e.button === 0 && !recortando && aoSelecionar(null)}
          onContextMenu={(e) => {
            e.preventDefault()
            if (recortando) return
            const r = e.currentTarget.getBoundingClientRect()
            aoMenu?.(e, { tipo: 'palco', pos: { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height } })
          }}
        >
          {p.clipes.map((c) => {
            const fonte = fontes[c.fonte]
            if (!fonte?.url) return null
            const g = geometria(fonte)
            return (
              <div key={c.id} className="pointer-events-none absolute" style={{ ...g.caixa, transform: p.espelhar ? 'scaleX(-1)' : undefined }}>
                {fonte.tipo === 'imagem' ? (
                  <img
                    ref={(el) => (el ? (videos.current[c.id] = el._clipe ??= new ClipeImagem(el)) : delete videos.current[c.id])}
                    src={fonte.url}
                    alt=""
                    className="absolute max-w-none"
                    style={{ ...g.video, transform: `rotate(${p.girar}deg)`, filter: filtroCor, visibility: 'hidden' }}
                    onLoad={() => aplicar(m.current.t, !m.current.tocando)}
                  />
                ) : (
                <video
                  ref={(el) => (el ? (videos.current[c.id] = el) : delete videos.current[c.id])}
                  src={fonte.url}
                  preload="auto"
                  playsInline
                  className="absolute max-w-none"
                  style={{ ...g.video, transform: `rotate(${p.girar}deg)`, filter: filtroCor, visibility: 'hidden' }}
                  onLoadedData={() => aplicar(m.current.t, !m.current.tocando)}
                />
                )}
              </div>
            )
          })}

          {/* Camadas (fora do modo recorte) */}
          {recortando
            ? null
            : p.camadas.map((cam) => (
                <CamadaNoPalco
                  key={cam.id}
                  cam={cam}
                  fonte={fontes[cam.fonte]}
                  palco={palco}
                  sel={selecao?.tipo === 'camada' && selecao.id === cam.id}
                  registrar={(el) => (el ? (camadasEl.current[cam.id] = el) : delete camadasEl.current[cam.id])}
                  registrarVideo={(el) => (el ? (videosCamada.current[cam.id] = el) : delete videosCamada.current[cam.id])}
                  aoSelecionar={() => aoSelecionar({ tipo: 'camada', id: cam.id })}
                  aoMudar={(d) => aoMudarCamada(cam.id, d)}
                  aoMenu={(e) => aoMenu?.(e, { tipo: 'camada', id: cam.id })}
                  aoGuias={setGuias}
                />
              ))}

          {/* Guias do centro (aparecem quando a camada gruda) */}
          {guias?.v ? <div className="pointer-events-none absolute inset-y-0 left-1/2 z-30 w-px -translate-x-1/2 bg-[#ff3d8b]" /> : null}
          {guias?.h ? <div className="pointer-events-none absolute inset-x-0 top-1/2 z-30 h-px -translate-y-1/2 bg-[#ff3d8b]" /> : null}

          {/* Véu dos fades */}
          <div ref={veu} className="pointer-events-none absolute inset-0 bg-black" style={{ opacity: 0 }} />

          {recortando ? <Recorte valor={recortando.valor} aoMudar={recortando.aoMudar} largura={palco.w} altura={palco.h} /> : null}
        </div>
      )}
      {p.musica && fontes[p.musica.fonte]?.url ? <audio ref={musica} src={fontes[p.musica.fonte].url} preload="auto" className="hidden" /> : null}
    </div>
  )
})
