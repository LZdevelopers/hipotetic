import { forwardRef, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState } from 'react'
import { Icone } from '../../componentes/Icone'
import { tempo } from '../../componentes/editor/Comum'
import { duracaoClipe, duracaoTotal, iniciosNaLinha } from './_projeto'

const ICONES = { texto: 'texto', imagem: 'imagem', video: 'arquivoVideo', desfoque: 'borracha' }
const NOMES = { texto: 'Texto', imagem: 'Imagem', video: 'Vídeo', desfoque: 'Blur' }
const CORES = { texto: 'var(--color-cat-documentos)', imagem: 'var(--color-cat-imagem)', video: 'var(--color-cat-video)', desfoque: 'var(--color-cat-utilitarios)' }
const CAB = 96 // px: coluna com o nome das trilhas
const IMA = 8 // px: distância em que uma borda gruda no cursor (e em outras bordas)
const PPS_MAX = 400 // zoom máximo (px por segundo; em vídeos curtos, até 12× o "cabe tudo")
const ALTURA_CLIPE = 52 // px: altura do clipe na trilha de vídeo

/** Passo das marcas da régua (segundos), para as legendas não se amontoarem. */
const passoRegua = (pps) => [0.1, 0.2, 0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300, 600, 1200].find((s) => s * pps >= 76) ?? 1800
const rotuloTempo = (t, passo) => (passo < 1 ? tempo(t) : tempo(t).replace(/\.\d$/, ''))

/**
 * Arrasto com rolagem automática: perto das bordas da linha do tempo ela
 * rola sozinha e o deslocamento entra na conta. mover(dx, ev); fim(ev).
 */
function arrastar(rolagem, e, mover, fim) {
  e.preventDefault()
  e.stopPropagation()
  const alvo = e.currentTarget
  try {
    alvo.setPointerCapture(e.pointerId)
  } catch {
    /* ponteiro já solto (ou evento sintético): segue sem captura */
  }
  const x0 = e.clientX
  let ultimo = x0
  let rolado = 0
  let moveu = false
  // O que se arrasta nunca sai da área visível da linha do tempo: o mouse pode
  // ir além (até para outro monitor), mas a borda para na beirada e a linha rola.
  const limitar = (cx) => {
    const v = rolagem.current
    if (!v) return cx
    const r = v.getBoundingClientRect()
    return Math.min(Math.max(cx, r.left + CAB + 1), r.right - 1)
  }
  const aoMover = (ev) => {
    ultimo = ev.clientX
    if (Math.abs(ultimo - x0) > 3) moveu = true
    const x = limitar(ultimo)
    mover(x - x0 + rolado, { clientX: x })
  }
  // Rolagem automática perto das bordas (só no sentido do movimento), mais
  // rápida quanto mais longe o mouse estiver.
  const ZONA = 40
  const relogio = setInterval(() => {
    const v = rolagem.current
    if (!v || !moveu) return
    const r = v.getBoundingClientRect()
    const esq = r.left + CAB + ZONA
    const dir = r.right - ZONA
    let d = 0
    if (ultimo < esq && ultimo < x0 - 2) d = -Math.min(30, 1 + (esq - ultimo) * 0.12)
    else if (ultimo > dir && ultimo > x0 + 2) d = Math.min(30, 1 + (ultimo - dir) * 0.12)
    if (!d) return
    const antes = v.scrollLeft
    v.scrollLeft += d
    const real = v.scrollLeft - antes
    if (real) {
      rolado += real
      const x = limitar(ultimo)
      mover(x - x0 + rolado, { clientX: x })
    }
  }, 16)
  const soltar = (ev) => {
    clearInterval(relogio)
    alvo.removeEventListener('pointermove', aoMover)
    alvo.removeEventListener('pointerup', soltar)
    alvo.removeEventListener('pointercancel', soltar)
    fim?.({ clientX: limitar(ev?.clientX ?? ultimo) })
  }
  alvo.addEventListener('pointermove', aoMover)
  alvo.addEventListener('pointerup', soltar)
  alvo.addEventListener('pointercancel', soltar)
}

/** Índice do quadro (miniatura) para um instante do arquivo. */
function quadroEm(fonte, t) {
  const q = fonte.quadros
  const passo = fonte.passoQuadros || (fonte.duracao || 1) / q.length
  return q[Math.min(q.length - 1, Math.max(0, Math.floor(t / passo)))]
}

/** Tira de miniaturas na proporção do vídeo (repete/escolhe quadros conforme o zoom). */
function Filme({ fonte, inicio, velocidade, largura, pps }) {
  if (!fonte) return null
  const asp = fonte.largura && fonte.altura ? fonte.largura / fonte.altura : 16 / 9
  const w = Math.max(18, Math.round(ALTURA_CLIPE * asp))
  const n = Math.min(300, Math.max(1, Math.ceil(largura / w)))
  if (fonte.tipo !== 'imagem' && !fonte.quadros?.length) return null
  return (
    <div className="pointer-events-none absolute inset-0 flex overflow-hidden">
      {Array.from({ length: n }, (_, k) => {
        const src = fonte.tipo === 'imagem' ? fonte.url : quadroEm(fonte, inicio + (((k + 0.5) * w) / pps) * velocidade)
        return <img key={k} src={src} alt="" draggable={false} className="h-full flex-none object-cover" style={{ width: w }} />
      })}
    </div>
  )
}

/** Forma de onda de um trecho do arquivo [inicio, fim] (tempo do arquivo). */
function Onda({ fonte, inicio, fim, velocidade = 1, pps, altura, repetir = false, className = '' }) {
  const picos = fonte?.picos
  if (!picos?.length) return null
  const passo = fonte.passoPicos
  const largura = ((fim - inicio) / velocidade) * pps
  if (largura < 3) return null
  const barras = Math.min(3000, Math.max(1, Math.floor(largura / 2.5)))
  const larguraBarra = largura / barras
  const meio = altura / 2
  const n = picos.length
  let d = ''
  for (let k = 0; k < barras; k += 1) {
    const t0 = inicio + ((k * larguraBarra) / pps) * velocidade
    const t1 = inicio + (((k + 1) * larguraBarra) / pps) * velocidade
    let b0 = Math.floor(t0 / passo)
    const b1 = Math.max(b0 + 1, Math.floor(t1 / passo))
    let v = 0
    for (let j = 0; b0 < b1 && j < 48; b0 += 1, j += 1) {
      const b = repetir ? ((b0 % n) + n) % n : b0
      if (b >= 0 && b < n && picos[b] > v) v = picos[b]
    }
    const h = Math.max(0.6, v * meio * 0.92)
    const x = (k + 0.5) * larguraBarra
    d += `M${x.toFixed(1)} ${(meio - h).toFixed(1)}V${(meio + h).toFixed(1)}`
  }
  return (
    <svg className={`pointer-events-none absolute left-0 ${className}`} width={largura} height={altura} aria-hidden="true">
      <path d={d} stroke="currentColor" strokeWidth={Math.max(1, larguraBarra * 0.55)} strokeLinecap="round" />
    </svg>
  )
}

function BotaoLinha({ rotulo, icone, onClick, disabled, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={rotulo}
      title={rotulo}
      className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2 text-[0.8125rem] font-semibold text-suave transition-colors hover:bg-superficie-2 hover:text-tinta disabled:pointer-events-none disabled:opacity-35"
    >
      <Icone nome={icone} tamanho={16} />
      {children}
    </button>
  )
}

/**
 * Linha do tempo (no jeito do CapCut): escala fixa em px por segundo, com
 * zoom (botões, controle deslizante ou Ctrl + roda) e rolagem horizontal; a
 * régua e o nome das trilhas ficam presos. Clipes com tira de miniaturas e
 * forma de onda; camadas uma por faixa; a trilha de áudio com a onda.
 *
 * Aparar o começo de um clipe: a borda segue o mouse e o resto fica parado
 * até soltar. Se o trecho escondido não cabe antes do clipe (1º clipe), a
 * linha ganha uma folga à esquerda enquanto você arrasta — nada sai da tela.
 *
 * ref: { mover(t, seguir) } — posiciona o cursor sem re-renderizar.
 */
export const LinhaDoTempo = forwardRef(function LinhaDoTempo(
  { p, fontes, selecao, aoSelecionar, aoBuscar, aoMudarClipe, aoMudarCamada, aoReordenar, aoAdicionar, aoMenu, aoDividir, aoRemover, agora },
  ref,
) {
  const total = duracaoTotal(p)
  const inicios = iniciosNaLinha(p)
  const rolagem = useRef(null)
  const regua = useRef(null)
  const linhaCursor = useRef(null)
  const pinoCursor = useRef(null)
  const [largVista, setLargVista] = useState(900)
  const [zoom, setZoom] = useState(null) // px/s; null = cabe tudo na largura
  const [desloc, setDesloc] = useState(0) // s de folga à esquerda (estendendo o começo)
  const [guia, setGuia] = useState(null)
  const [fixos, setFixos] = useState(null) // aparando o começo: posições congeladas
  const [aparando, setAparando] = useState(null) // { id, lado }
  const [arrastando, setArrastando] = useState(null)
  const [reordenando, setReordenando] = useState(null) // { id, dx, destino }
  const ajusteRolagem = useRef(0)
  const ancora = useRef(null) // zoom: { t, xTela } fica parado na tela
  const voltarAjuste = useRef(false)

  useLayoutEffect(() => {
    const el = rolagem.current
    if (!el) return undefined
    const medir = () => setLargVista(el.clientWidth)
    medir()
    const ro = new ResizeObserver(medir)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const comprimento = Math.max(total, ...p.camadas.map((c) => c.fim), 0.5)
  const ppsAjuste = Math.max(0.5, (largVista - CAB - 72) / comprimento)
  const ppsMax = Math.max(PPS_MAX, ppsAjuste * 12)
  const pps = zoom ?? ppsAjuste
  const x = (t) => (t + desloc) * pps
  const atual = useRef(null)
  atual.current = { pps, desloc, ppsAjuste, ppsMax }

  /** Onde o clipe i aparece (aparando o começo, a partir das posições congeladas). */
  const posicao = (i, c) => {
    const dur = duracaoClipe(c)
    if (!fixos) return { left: inicios[i], dur }
    const base = fixos.inicios[i] ?? inicios[i]
    if (c.id === fixos.id) return { left: base + (fixos.dur - dur), dur }
    return { left: base, dur }
  }
  const posicoes = p.clipes.map((c, i) => posicao(i, c))
  const fimClipes = posicoes.reduce((m, q) => Math.max(m, q.left + q.dur), 0)
  // Fantasmas do trecho escondido do clipe que está sendo aparado.
  let fantasma = null
  if (aparando) {
    const i = p.clipes.findIndex((c) => c.id === aparando.id)
    const c = p.clipes[i]
    const fonte = c && fontes[c.fonte]
    if (c && fonte?.tipo === 'video') {
      const pos = posicoes[i]
      fantasma = { pos, antes: c.inicio / c.velocidade, depois: Math.max(0, ((fonte.duracao ?? c.fim) - c.fim) / c.velocidade) }
    }
  }
  const fimVisual = Math.max(comprimento, fimClipes, fantasma ? fantasma.pos.left + fantasma.pos.dur + fantasma.depois : 0)
  const larguraConteudo = Math.max(largVista - CAB, x(fimVisual) + 110)

  const tempoNoPonto = (clientX, limitar = true) => {
    const r = regua.current.getBoundingClientRect()
    const t = (clientX - r.left) / atual.current.pps - atual.current.desloc
    return limitar ? Math.min(Math.max(0, t), total) : t
  }

  // Cursor de reprodução: movido direto (60 vezes por segundo, sem render).
  const mover = (t, seguir = false) => {
    const { pps: k, desloc: dl } = atual.current
    const px = (t + dl) * k
    if (linhaCursor.current) linhaCursor.current.style.transform = `translateX(${CAB + px}px)`
    if (pinoCursor.current) pinoCursor.current.style.transform = `translateX(${px}px)`
    const v = rolagem.current
    if (seguir && v) {
      const vista = v.clientWidth - CAB
      if (px < v.scrollLeft || px > v.scrollLeft + vista - 24) v.scrollLeft = Math.max(0, px - 24)
    }
  }
  useImperativeHandle(ref, () => ({ mover }))

  useLayoutEffect(() => {
    const v = rolagem.current
    if (v && ajusteRolagem.current) {
      v.scrollLeft += ajusteRolagem.current
      ajusteRolagem.current = 0
    }
    if (v && ancora.current) {
      const { t, xTela } = ancora.current
      v.scrollLeft = Math.max(0, (t + desloc) * pps - xTela)
      ancora.current = null
    }
    mover(agora())
  })

  const mudarZoom = (novo, t = agora(), xTela) => {
    const { ppsAjuste: a, pps: k, ppsMax: mx } = atual.current
    const v = rolagem.current
    const xt = xTela ?? Math.min(Math.max(0, (t + atual.current.desloc) * k - (v?.scrollLeft ?? 0)), (v?.clientWidth ?? 0) - CAB)
    ancora.current = { t, xTela: xt }
    setZoom(novo <= a * 1.001 ? null : Math.min(mx, novo))
  }

  // Ctrl + roda: zoom no ponto do mouse. Roda sozinha: rola na horizontal.
  useEffect(() => {
    const v = rolagem.current
    if (!v) return undefined
    const roda = (e) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault()
        const r = v.getBoundingClientRect()
        const xTela = e.clientX - r.left - CAB
        const t = (v.scrollLeft + xTela) / atual.current.pps - atual.current.desloc
        mudarZoom(atual.current.pps * Math.exp(-e.deltaY * 0.0018), t, xTela)
      } else if (!e.shiftKey && Math.abs(e.deltaY) > Math.abs(e.deltaX) && v.scrollWidth > v.clientWidth + 1 && v.scrollHeight <= v.clientHeight + 1) {
        e.preventDefault()
        v.scrollLeft += e.deltaY
      }
    }
    v.addEventListener('wheel', roda, { passive: false })
    return () => v.removeEventListener('wheel', roda)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Durante um arrasto a escala não muda (mesmo no modo "cabe tudo").
  const congelar = () => {
    if (zoom == null) {
      setZoom(pps)
      voltarAjuste.current = true
    }
  }
  const soltar = () => {
    setGuia(null)
    setFixos(null)
    setAparando(null)
    setArrastando(null)
    setReordenando(null)
    if (voltarAjuste.current) {
      voltarAjuste.current = false
      setZoom(null)
    }
  }

  const grudar = (t, lista, k) => {
    let melhor = null
    let dist = IMA / k
    for (const q of lista) {
      const d = Math.abs(q - t)
      if (d < dist) {
        dist = d
        melhor = q
      }
    }
    return melhor
  }

  // Clicar/arrastar na régua ou no fundo das trilhas: percorre.
  const percorrer = (e) => {
    if (e.button !== 0 || !total) return
    aoBuscar(tempoNoPonto(e.clientX))
    arrastar(rolagem, e, (_, ev) => aoBuscar(tempoNoPonto(ev.clientX)))
  }

  const aparar = (c, i, lado) => (e) => {
    if (e.button !== 0) return
    aoSelecionar({ tipo: 'clipe', id: c.id })
    const fonte = fontes[c.fonte]
    const imagem = fonte?.tipo === 'imagem'
    const c0 = { ...c }
    const k = pps
    const base = inicios[i]
    const durOrig = duracaoClipe(c)
    const max = imagem ? 600 : (fonte?.duracao ?? c.fim)
    const outros = inicios.flatMap((s, j) => (j === i ? [] : [s, s + duracaoClipe(p.clipes[j])]))
    const lista = [agora(), 0, ...outros, ...p.camadas.flatMap((y) => [y.inicio, y.fim])]
    congelar()
    // Estender o começo do 1º clipe: folga à esquerda para o trecho escondido caber.
    const folga = lado === 'inicio' && !imagem ? Math.max(0, c0.inicio / c0.velocidade - base) : 0
    if (folga) {
      // A folga entra à esquerda e a rolagem compensa: a borda continua embaixo
      // do mouse. Arrastando para a esquerda, a linha rola e revela o trecho.
      setDesloc(folga)
      ajusteRolagem.current += folga * k
    }
    if (lado === 'inicio') setFixos({ inicios: [...inicios], id: c.id, dur: durOrig })
    setAparando({ id: c.id, lado })
    setArrastando(c.id)
    arrastar(
      rolagem,
      e,
      (dx) => {
        const dt = dx / k
        if (lado === 'inicio') {
          let borda = base + dt
          const g = grudar(borda, lista, k)
          setGuia(g)
          if (g != null) borda = g
          const delta = borda - base
          if (imagem) {
            const d = Math.min(Math.max(delta, -base), durOrig - 0.2)
            aoMudarClipe(c.id, { inicio: 0, fim: Math.min(600, durOrig - d) })
          } else aoMudarClipe(c.id, { inicio: Math.min(Math.max(0, c0.inicio + delta * c0.velocidade), c0.fim - 0.1) })
        } else {
          let borda = base + durOrig + dt
          const g = grudar(borda, lista, k)
          setGuia(g)
          if (g != null) borda = g
          aoMudarClipe(c.id, { fim: Math.max(Math.min(max, c0.inicio + (borda - base) * c0.velocidade), c0.inicio + 0.1) })
        }
      },
      () => {
        if (folga) {
          setDesloc(0)
          ajusteRolagem.current -= folga * k
        }
        soltar()
      },
    )
  }

  const moverCamada = (cam, modo) => (e) => {
    if (e.button !== 0) return
    aoSelecionar({ tipo: 'camada', id: cam.id })
    const c0 = { ...cam }
    const k = pps
    const lista = [agora(), 0, total, ...inicios, ...inicios.map((s, i) => s + duracaoClipe(p.clipes[i])), ...p.camadas.filter((c) => c.id !== cam.id).flatMap((c) => [c.inicio, c.fim])]
    congelar()
    setArrastando(cam.id)
    arrastar(
      rolagem,
      e,
      (dx) => {
        const dt = dx / k
        if (modo === 'mover') {
          const d = c0.fim - c0.inicio
          let inicio = c0.inicio + dt
          const gi = grudar(inicio, lista, k)
          const gf = grudar(inicio + d, lista, k)
          if (gi != null && (gf == null || Math.abs(gi - inicio) <= Math.abs(gf - inicio - d))) inicio = gi
          else if (gf != null) inicio = gf - d
          setGuia(gi != null && inicio === gi ? gi : gf != null && inicio === gf - d ? gf : null)
          inicio = Math.min(Math.max(0, inicio), Math.max(0, total - d))
          aoMudarCamada(cam.id, { inicio, fim: inicio + d })
        } else if (modo === 'inicio') {
          let t = c0.inicio + dt
          const g = grudar(t, lista, k)
          setGuia(g)
          if (g != null) t = g
          aoMudarCamada(cam.id, { inicio: Math.min(Math.max(0, t), c0.fim - 0.2) })
        } else {
          let t = c0.fim + dt
          const g = grudar(t, lista, k)
          setGuia(g)
          if (g != null) t = g
          aoMudarCamada(cam.id, { fim: Math.max(Math.min(total, t), c0.inicio + 0.2) })
        }
      },
      soltar,
    )
  }

  const menu = (alvo) => (e) => {
    e.preventDefault()
    e.stopPropagation()
    aoMenu(e, { ...alvo, t: regua.current ? tempoNoPonto(e.clientX) : 0 })
  }

  // Régua: marcas principais (com legenda) e secundárias.
  const passo = passoRegua(pps)
  const sub = passo / (passo >= 1 && passo % 5 === 0 ? 5 : 2)
  const marcas = []
  const inicioRegua = -Math.floor(desloc / passo) * passo
  for (let t = inicioRegua; x(t) <= larguraConteudo && marcas.length < 4000; t += sub) marcas.push(Math.round(t * 1000) / 1000)

  const cabecalho = 'sticky left-0 z-30 flex w-24 shrink-0 items-center gap-1.5 border-r border-borda bg-superficie px-3 text-[0.6875rem] font-semibold tracking-wide text-fraca uppercase'
  const largura = { width: larguraConteudo }
  const sliderMax = Math.log(ppsMax / ppsAjuste)
  const valorSlider = sliderMax > 0 ? Math.round((Math.log(pps / ppsAjuste) / sliderMax) * 100) : 0
  const selTem = selecao && (selecao.tipo === 'clipe' || selecao.tipo === 'camada' || selecao.tipo === 'musica')

  return (
    <div className="flex flex-col" onContextMenu={menu({ tipo: 'linha' })}>
      {/* Barra da linha do tempo: ações à esquerda, zoom à direita */}
      <div className="flex items-center gap-1 border-b border-borda px-3 py-1">
        <BotaoLinha rotulo="Dividir no cursor (S)" icone="cortar" onClick={aoDividir} disabled={!p.clipes.length}>
          <span className="max-sm:hidden">Dividir</span>
        </BotaoLinha>
        <BotaoLinha rotulo="Excluir selecionado (Delete)" icone="apagar" onClick={() => aoRemover(selecao)} disabled={!selTem}>
          <span className="max-sm:hidden">Excluir</span>
        </BotaoLinha>
        <span className="ml-2 text-xs text-fraca tabular-nums max-sm:hidden">{p.clipes.length ? `${p.clipes.length} ${p.clipes.length === 1 ? 'clipe' : 'clipes'} · ${p.camadas.length} ${p.camadas.length === 1 ? 'camada' : 'camadas'}` : ''}</span>
        <div className="ml-auto flex items-center gap-1">
          <BotaoLinha rotulo="Diminuir zoom" icone="zoomMenos" onClick={() => mudarZoom(pps / 1.6)} disabled={zoom == null} />
          <input
            type="range"
            min={0}
            max={100}
            value={valorSlider}
            disabled={sliderMax <= 0}
            onChange={(e) => mudarZoom(ppsAjuste * Math.exp((Number(e.target.value) / 100) * sliderMax))}
            aria-label="Zoom da linha do tempo"
            className="w-24 accent-[var(--color-acento)] sm:w-32"
          />
          <BotaoLinha rotulo="Aumentar zoom" icone="zoomMais" onClick={() => mudarZoom(pps * 1.6)} disabled={pps >= ppsMax - 0.01} />
          <BotaoLinha rotulo="Ajustar à largura" icone="encaixar" onClick={() => mudarZoom(0)} disabled={zoom == null} />
        </div>
      </div>

      <div ref={rolagem} className="rolagem-fina relative max-h-[15.5rem] overflow-auto">
        <div className="relative" style={{ width: CAB + larguraConteudo }}>
          {/* Régua (presa no topo) */}
          <div className="sticky top-0 z-40 flex h-7 border-b border-borda bg-superficie">
            <div className="sticky left-0 z-50 w-24 shrink-0 border-r border-borda bg-superficie" />
            <div ref={regua} className="relative h-full cursor-pointer" style={largura} onPointerDown={percorrer}>
              {marcas.map((t) => {
                const principal = Math.abs(t / passo - Math.round(t / passo)) < 1e-6
                return (
                  <span key={t} className="pointer-events-none absolute top-0 h-full" style={{ left: x(t) }}>
                    <span className={`absolute bottom-0 left-0 w-px ${principal ? 'h-2.5 bg-fraca/70' : 'h-1.5 bg-borda-forte'}`} />
                    {principal && t >= 0 ? <span className="absolute top-1 left-1 text-[0.625rem] whitespace-nowrap text-fraca tabular-nums">{rotuloTempo(t, passo)}</span> : null}
                  </span>
                )
              })}
              {total ? (
                <div
                  ref={pinoCursor}
                  className="absolute top-0 left-0 z-10 h-full w-3 -translate-x-1/2 cursor-ew-resize"
                  onPointerDown={percorrer}
                  aria-hidden="true"
                >
                  <span className="absolute top-0 left-0 h-3.5 w-3 rounded-b-[4px] bg-tinta [clip-path:polygon(0_0,100%_0,100%_60%,50%_100%,0_60%)]" />
                </div>
              ) : null}
            </div>
          </div>

          <div className="relative">
            {/* Trilha de vídeo */}
            <div className="flex">
              <div className={cabecalho}>
                <Icone nome="filme" tamanho={13} /> Vídeo
              </div>
              <div className="relative h-16 cursor-pointer" style={largura} onPointerDown={percorrer}>
                {p.clipes.length ? null : (
                  <p className="pointer-events-none absolute inset-y-1.5 left-2 flex items-center rounded-lg border border-dashed border-borda px-4 text-xs text-fraca" style={{ width: Math.max(220, largVista - CAB - 120) }}>
                    Vídeos, imagens e GIFs aparecem aqui, em sequência
                  </p>
                )}

                {/* Trecho escondido do clipe que está sendo aparado (tracejado) */}
                {fantasma && fantasma.antes > 0.02 ? (
                  <div className="pointer-events-none absolute top-1.5 bottom-1.5 z-20 flex items-center justify-end overflow-hidden rounded-lg border-2 border-dashed border-acento/70 bg-acento/15 pr-1.5 text-[0.625rem] font-bold text-acento tabular-nums" style={{ left: x(fantasma.pos.left - fantasma.antes), width: fantasma.antes * pps }}>
                    +{tempo(fantasma.antes)}
                  </div>
                ) : null}
                {fantasma && fantasma.depois > 0.02 ? (
                  <div className="pointer-events-none absolute top-1.5 bottom-1.5 z-20 flex items-center overflow-hidden rounded-lg border-2 border-dashed border-acento/70 bg-acento/15 pl-1.5 text-[0.625rem] font-bold text-acento tabular-nums" style={{ left: x(fantasma.pos.left + fantasma.pos.dur), width: fantasma.depois * pps }}>
                    +{tempo(fantasma.depois)}
                  </div>
                ) : null}

                {p.clipes.map((c, i) => {
                  const fonte = fontes[c.fonte]
                  const sel = selecao?.tipo === 'clipe' && selecao.id === c.id
                  const pos = posicoes[i]
                  const larguraClipe = Math.max(4, pos.dur * pps - 3)
                  const temAntes = fonte?.tipo === 'video' && c.inicio > 0.05
                  const temDepois = fonte?.tipo === 'video' && (fonte.duracao ?? c.fim) - c.fim > 0.05
                  const movendo = reordenando?.id === c.id
                  const largo = larguraClipe > 110
                  return (
                    <div
                      key={c.id}
                      role="button"
                      tabIndex={0}
                      aria-label={`Clipe ${i + 1}: ${fonte?.arquivo.name}`}
                      aria-pressed={sel}
                      onPointerDown={(e) => {
                        if (e.button !== 0) return
                        aoSelecionar({ tipo: 'clipe', id: c.id })
                        // Clicar: vai para o ponto. Arrastar pelo meio: muda a ordem do clipe.
                        const t0 = tempoNoPonto(e.clientX)
                        let modo = null
                        const meios = p.clipes.map((y, j) => ({ id: y.id, meio: inicios[j] + duracaoClipe(y) / 2 }))
                        const destinoEm = (clientX) => meios.filter((m) => m.id !== c.id && m.meio < tempoNoPonto(clientX, false)).length
                        arrastar(
                          rolagem,
                          e,
                          (dx, ev) => {
                            if (!modo && Math.abs(dx) > 6 && p.clipes.length > 1) {
                              modo = 'reordenar'
                              congelar()
                            }
                            if (modo) setReordenando({ id: c.id, dx, destino: destinoEm(ev.clientX) })
                          },
                          (ev) => {
                            if (modo) {
                              const d = destinoEm(ev?.clientX ?? e.clientX)
                              soltar()
                              if (d !== i) aoReordenar(c.id, d)
                            } else aoBuscar(t0)
                          },
                        )
                      }}
                      onContextMenu={menu({ tipo: 'clipe', id: c.id })}
                      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && aoSelecionar({ tipo: 'clipe', id: c.id })}
                      className={`group absolute top-1.5 bottom-1.5 overflow-hidden rounded-lg bg-superficie-3 ${movendo ? 'z-30 cursor-grabbing opacity-90 shadow-[0_10px_28px_-6px_rgb(0_0_0/0.7)] ring-2 ring-acento' : sel ? 'z-10 ring-2 ring-white' : 'ring-1 ring-black/20 hover:ring-2 hover:ring-borda-forte'}`}
                      style={{ left: x(pos.left) + 1.5, width: larguraClipe, transform: movendo ? `translateX(${reordenando.dx}px)` : undefined }}
                    >
                      <Filme fonte={fonte} inicio={c.inicio} velocidade={c.velocidade} largura={larguraClipe} pps={pps} />
                      {/* Som do clipe: onda na parte de baixo */}
                      {fonte?.tipo === 'video' && fonte.picos && !c.mudo ? (
                        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-3.5 bg-black/55 text-white/80">
                          <Onda fonte={fonte} inicio={c.inicio} fim={c.fim} velocidade={c.velocidade} pps={pps} altura={14} className="top-0" />
                        </div>
                      ) : null}
                      {/* Há trecho escondido antes/depois: marca e quanto */}
                      {temAntes ? (
                        <>
                          <span className="pointer-events-none absolute inset-y-0 left-3.5 w-1 bg-[repeating-linear-gradient(180deg,white_0_3px,transparent_3px_6px)] opacity-80" />
                          <button
                            type="button"
                            className="absolute top-0.5 z-20 rounded bg-black/75 px-1.5 py-px text-[0.625rem] font-bold text-white tabular-nums transition-colors hover:bg-acento left-5"
                            title="Trecho escondido antes. Clique para trazer tudo de volta (ou arraste a ponta para a esquerda)"
                            aria-label={`Restaurar o começo: ${tempo(c.inicio / c.velocidade)} escondidos`}
                            onPointerDown={(e) => e.stopPropagation()}
                            onClick={(e) => {
                              e.stopPropagation()
                              aoMudarClipe(c.id, { inicio: 0 })
                            }}
                          >
                            ‹ {tempo(c.inicio / c.velocidade)}
                          </button>
                        </>
                      ) : null}
                      {temDepois ? (
                        <>
                          <span className="pointer-events-none absolute inset-y-0 right-3.5 w-1 bg-[repeating-linear-gradient(180deg,white_0_3px,transparent_3px_6px)] opacity-80" />
                          <button
                            type="button"
                            className="absolute top-0.5 z-20 rounded bg-black/75 px-1.5 py-px text-[0.625rem] font-bold text-white tabular-nums transition-colors hover:bg-acento right-5"
                            title="Trecho escondido depois. Clique para trazer tudo de volta (ou arraste a ponta para a direita)"
                            aria-label={`Restaurar o fim: ${tempo(((fonte.duracao ?? c.fim) - c.fim) / c.velocidade)} escondidos`}
                            onPointerDown={(e) => e.stopPropagation()}
                            onClick={(e) => {
                              e.stopPropagation()
                              aoMudarClipe(c.id, { fim: fonte.duracao ?? c.fim })
                            }}
                          >
                            {tempo(((fonte.duracao ?? c.fim) - c.fim) / c.velocidade)} ›
                          </button>
                        </>
                      ) : null}
                      <span className={`pointer-events-none absolute left-4 max-w-[calc(100%-2rem)] truncate rounded bg-black/65 px-1 text-[0.625rem] font-semibold text-white tabular-nums ${fonte?.picos && !c.mudo && fonte.tipo === 'video' ? 'bottom-4' : 'bottom-1'}`}>
                        {largo && fonte ? `${fonte.arquivo.name} · ` : ''}
                        {fonte?.tipo === 'imagem' ? 'imagem · ' : ''}
                        {c.velocidade !== 1 ? `${c.velocidade.toLocaleString('pt-BR')}× · ` : ''}
                        {c.mudo ? 'mudo · ' : ''}
                        {tempo(pos.dur)}
                      </span>
                      <span onPointerDown={aparar(c, i, 'inicio')} onDoubleClick={() => fonte?.tipo === 'video' && aoMudarClipe(c.id, { inicio: 0 })} title="Arraste para aparar · duplo clique restaura o começo" className={`absolute inset-y-0 left-0 z-10 grid w-3.5 cursor-ew-resize place-items-center rounded-l-lg ${sel ? 'bg-white' : 'bg-white/85 opacity-0 group-hover:opacity-100'}`} aria-label="Aparar o início">
                        <span className="h-5 w-0.5 rounded-full bg-black/45" />
                      </span>
                      <span onPointerDown={aparar(c, i, 'fim')} onDoubleClick={() => fonte?.tipo === 'video' && aoMudarClipe(c.id, { fim: fonte.duracao ?? c.fim })} title="Arraste para aparar · duplo clique restaura o fim" className={`absolute inset-y-0 right-0 z-10 grid w-3.5 cursor-ew-resize place-items-center rounded-r-lg ${sel ? 'bg-white' : 'bg-white/85 opacity-0 group-hover:opacity-100'}`} aria-label="Aparar o fim">
                        <span className="h-5 w-0.5 rounded-full bg-black/45" />
                      </span>
                      {arrastando === c.id && aparando ? <span className="pointer-events-none absolute top-1 left-1/2 z-20 -translate-x-1/2 rounded bg-black/80 px-1.5 py-0.5 text-[0.6875rem] font-bold text-white tabular-nums">{tempo(pos.dur)}</span> : null}
                    </div>
                  )
                })}

                {/* Onde o clipe arrastado vai entrar */}
                {reordenando
                  ? (() => {
                      const outros = p.clipes.map((y, j) => ({ y, j })).filter(({ y }) => y.id !== reordenando.id)
                      const antes = outros[reordenando.destino - 1]
                      const em = antes ? inicios[antes.j] + duracaoClipe(antes.y) : 0
                      return <div className="pointer-events-none absolute inset-y-0 z-40 w-1 -translate-x-1/2 rounded-full bg-acento shadow-[0_0_10px_var(--color-acento)]" style={{ left: x(em) }} />
                    })()
                  : null}

                {/* + no fim da trilha (como no CapCut) */}
                <button
                  type="button"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={aoAdicionar}
                  aria-label="Adicionar vídeo, imagem ou GIF"
                  title="Adicionar vídeo, imagem ou GIF ao fim"
                  className="absolute top-1/2 grid h-[3.25rem] w-11 -translate-y-1/2 place-items-center rounded-lg border-2 border-dashed border-borda-forte bg-superficie text-suave transition-colors hover:border-acento hover:bg-acento-suave hover:text-acento"
                  style={{ left: p.clipes.length ? x(fimClipes) + 8 : Math.max(240, largVista - CAB - 100) }}
                >
                  <Icone nome="mais" tamanho={20} />
                </button>
              </div>
            </div>

            {/* Uma faixa por camada (a de cima na lista é a que fica por cima) */}
            {[...p.camadas].reverse().map((cam) => {
              const sel = selecao?.tipo === 'camada' && selecao.id === cam.id
              const fonte = fontes[cam.fonte]
              const nome = cam.tipo === 'texto' ? cam.texto?.split('\n')[0] || 'Texto' : cam.tipo === 'desfoque' ? 'Blur' : (fonte?.arquivo.name ?? NOMES[cam.tipo])
              const miniatura = cam.tipo === 'imagem' ? fonte?.url : cam.tipo === 'video' ? fonte?.quadros?.[0] : null
              return (
                <div key={cam.id} className="flex">
                  <button type="button" className={`${cabecalho} text-left hover:text-tinta`} onClick={() => aoSelecionar({ tipo: 'camada', id: cam.id })}>
                    <Icone nome={ICONES[cam.tipo]} tamanho={13} /> {NOMES[cam.tipo]}
                  </button>
                  <div className="relative h-9 cursor-pointer" style={largura} onPointerDown={percorrer}>
                    <div
                      role="button"
                      tabIndex={0}
                      aria-label={`Camada ${NOMES[cam.tipo]}: ${nome}`}
                      aria-pressed={sel}
                      onPointerDown={moverCamada(cam, 'mover')}
                      onContextMenu={menu({ tipo: 'camada', id: cam.id })}
                      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && aoSelecionar({ tipo: 'camada', id: cam.id })}
                      className={`group absolute top-1 bottom-1 flex cursor-grab items-center gap-1.5 overflow-hidden rounded-md pr-3.5 pl-3.5 text-[0.6875rem] font-semibold text-white active:cursor-grabbing ${sel ? 'z-10 ring-2 ring-white' : 'ring-1 ring-black/15'}`}
                      style={{ left: x(cam.inicio), width: Math.max(6, (Math.min(cam.fim, comprimento) - cam.inicio) * pps), backgroundColor: CORES[cam.tipo] }}
                    >
                      {miniatura ? <img src={miniatura} alt="" draggable={false} className="pointer-events-none h-5 w-7 shrink-0 rounded-sm object-cover" /> : <Icone nome={ICONES[cam.tipo]} tamanho={12} className="pointer-events-none shrink-0 opacity-80" />}
                      <span className="pointer-events-none truncate">{nome}</span>
                      <span onPointerDown={moverCamada(cam, 'inicio')} className={`absolute inset-y-0 left-0 grid w-3 cursor-ew-resize place-items-center bg-black/35 ${sel ? '' : 'opacity-0 group-hover:opacity-100'}`} aria-label="Início da camada">
                        <span className="h-3.5 w-0.5 rounded-full bg-white/90" />
                      </span>
                      <span onPointerDown={moverCamada(cam, 'fim')} className={`absolute inset-y-0 right-0 grid w-3 cursor-ew-resize place-items-center bg-black/35 ${sel ? '' : 'opacity-0 group-hover:opacity-100'}`} aria-label="Fim da camada">
                        <span className="h-3.5 w-0.5 rounded-full bg-white/90" />
                      </span>
                      {arrastando === cam.id ? <span className="pointer-events-none absolute right-4 rounded bg-black/70 px-1 text-[0.625rem] font-bold tabular-nums">{tempo(cam.fim - cam.inicio)}</span> : null}
                    </div>
                  </div>
                </div>
              )
            })}

            {/* Trilha de áudio (música ou narração), com a onda */}
            {p.musica ? (
              <div className="flex">
                <button type="button" className={`${cabecalho} text-left hover:text-tinta`} onClick={() => aoSelecionar({ tipo: 'musica' })}>
                  <Icone nome="musica" tamanho={13} /> Áudio
                </button>
                <div className="relative h-12 cursor-pointer" style={largura} onPointerDown={percorrer}>
                  {(() => {
                    const fonte = fontes[p.musica.fonte]
                    const dm = fonte?.duracao ?? total
                    const fim = p.musica.repetir ? total : Math.min(dm, total)
                    return (
                      <div
                        role="button"
                        tabIndex={0}
                        aria-label="Trilha de áudio"
                        onPointerDown={(e) => {
                          if (e.button !== 0) return
                          aoSelecionar({ tipo: 'musica' })
                          percorrer(e)
                        }}
                        onContextMenu={menu({ tipo: 'musica' })}
                        className={`absolute top-1 bottom-1 overflow-hidden rounded-md text-white ${selecao?.tipo === 'musica' ? 'z-10 ring-2 ring-white' : 'ring-1 ring-black/15'}`}
                        style={{ left: x(0), width: Math.max(6, fim * pps), backgroundColor: 'color-mix(in oklab, var(--color-cat-audio) 80%, black)' }}
                      >
                        <div className="absolute inset-x-0 top-0 bottom-0 text-white/75">
                          <Onda fonte={fonte} inicio={0} fim={fim} pps={pps} altura={40} repetir={p.musica.repetir} className="top-0" />
                        </div>
                        <span className="pointer-events-none absolute top-0.5 left-2 max-w-[calc(100%-1rem)] truncate rounded bg-black/45 px-1 text-[0.625rem] font-semibold">
                          {fonte?.arquivo.name}
                          {p.musica.repetir ? ' · loop' : ''}
                        </span>
                      </div>
                    )
                  })()}
                </div>
              </div>
            ) : null}

            {/* Cursor de reprodução (movido direto) e guia do ímã */}
            {total ? <div ref={linhaCursor} data-cursor="" className="pointer-events-none absolute inset-y-0 left-0 z-20 w-0.5 -translate-x-1/2 bg-tinta" /> : null}
            {guia != null ? <div className="pointer-events-none absolute inset-y-0 z-20 w-0.5 -translate-x-1/2 bg-acento shadow-[0_0_8px_var(--color-acento)]" style={{ left: CAB + x(guia) }} /> : null}
          </div>
        </div>
      </div>
    </div>
  )
})
