import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Icone } from '../../componentes/Icone'
import { Resultados } from '../../componentes/ferramenta/Resultados'
import { DialogoBaixar, NomeEditavel } from '../../componentes/ferramenta/Baixar'
import { OpcoesSaidaAudio } from './_comum'
import { Aviso, Botao, Caixa, Deslizante, Progresso, Segmentado, SeloCategoria } from '../../componentes/ui'
import { DESCRICAO_AUDIO, EXTENSOES_AUDIO, EXTENSOES_VIDEO, LIMITE_AUDIO, filtroVelocidadeAudio, infoMidia, processarAudio } from '../../motores/midia'
import { extensaoDe, formatarDuracao, semExtensao } from '../../nucleo/arquivos'
import { useTema } from '../../nucleo/preferencias'
import { useTarefa } from '../../nucleo/tarefa'
import { useUrlObjeto } from '../../nucleo/url'
import { analisarVarios, ganhoNormalizar, silencios } from './_analise'
import { BotaoAcao, CampoTempo, Painel, Velocidade, tempo, useHistorico } from '../../componentes/editor/Comum'
import { useEmEdicao } from '../../nucleo/edicao'
import { receber } from '../../nucleo/entrega'
import { apagarTudo, guardar, haQuanto, ler } from '../../nucleo/rascunho'


/**
 * Posição `t` do original convertida para o tempo do RESULTADO: conta só o
 * que está dentro do trecho, desconta o silêncio removido e divide pela
 * velocidade. tempoNoResultado(o.fim) é a duração final.
 */
function tempoNoResultado(t, o, regioes) {
  const ate = Math.min(Math.max(t, o.inicio), o.fim)
  let d = ate - o.inicio
  for (const [a, b] of regioes) d -= Math.max(0, Math.min(b, ate) - Math.max(a, o.inicio))
  return Math.max(0, d) / o.velocidade
}

/**
 * Ganho da prévia num instante: dentro do trecho aplica volume e fades; fora
 * dele toca o original (é o que será cortado fora).
 */
function envelope(t, o, fator) {
  if (t < o.inicio || t > o.fim) return 1
  let g = fator
  if (o.fadeIn > 0) g *= Math.min(1, Math.max(0, (t - o.inicio) / o.fadeIn))
  if (o.fadeOut > 0) g *= Math.min(1, Math.max(0, (o.fim - t) / o.fadeOut))
  return g
}

/* ─── Forma de onda ──────────────────────────────────────────────────────── */

function desenhar(canvas, { analise, duracao, o, fator, regioes }) {
  const { fronteiras = [] } = analise
  const dpr = window.devicePixelRatio || 1
  const w = canvas.clientWidth
  const h = canvas.clientHeight
  if (!w || !h) return
  if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
    canvas.width = Math.round(w * dpr)
    canvas.height = Math.round(h * dpr)
  }
  const c = canvas.getContext('2d')
  c.setTransform(dpr, 0, 0, dpr, 0, 0)
  c.clearRect(0, 0, w, h)
  const css = getComputedStyle(canvas)
  const cor = (n) => css.getPropertyValue(n).trim()
  const corDentro = cor('--color-cat-audio')
  const corFora = cor('--color-borda-forte')
  const corSilencio = cor('--color-fraca')
  const corLinha = cor('--color-tinta')

  const { picos } = analise
  let topo = 0.01
  for (let i = 0; i < picos.length; i += 1) if (picos[i] > topo) topo = picos[i]
  const passo = 3
  const barras = Math.max(1, Math.floor(w / passo))
  const meio = h / 2
  for (let i = 0; i < barras; i += 1) {
    const a = Math.floor((i / barras) * picos.length)
    const b = Math.max(a + 1, Math.floor(((i + 1) / barras) * picos.length))
    let v = 0
    for (let k = a; k < b; k += 1) if (picos[k] > v) v = picos[k]
    const t = ((i + 0.5) / barras) * duracao
    const dentro = t >= o.inicio && t <= o.fim
    const mudo = dentro && regioes.some(([x, y]) => t >= x && t < y)
    let alt = v / topo
    if (dentro && !mudo) alt = Math.min(1, alt * envelope(t, o, fator))
    const hh = Math.max(2, alt * h * 0.9)
    c.globalAlpha = mudo ? 0.35 : 1
    c.fillStyle = !dentro ? corFora : mudo ? corSilencio : corDentro
    c.fillRect(i * passo, meio - hh / 2, 2, hh)
  }
  c.globalAlpha = 1

  // Onde cada arquivo começa (vários áudios juntos).
  if (fronteiras.length) {
    c.strokeStyle = corLinha
    c.globalAlpha = 0.35
    c.lineWidth = 1
    c.setLineDash([3, 4])
    for (const f of fronteiras) {
      const x = Math.round((f / duracao) * w) + 0.5
      c.beginPath()
      c.moveTo(x, 0)
      c.lineTo(x, h)
      c.stroke()
    }
    c.setLineDash([])
    c.globalAlpha = 1
  }

  // Contorno dos fades: mostra onde o volume sobe e desce.
  if (o.fadeIn > 0 || o.fadeOut > 0) {
    const x = (t) => (t / duracao) * w
    const y = (g) => meio - Math.min(1, g) * h * 0.47
    c.strokeStyle = corLinha
    c.globalAlpha = 0.55
    c.lineWidth = 1.25
    c.setLineDash([4, 3])
    c.beginPath()
    c.moveTo(x(o.inicio), y(0))
    c.lineTo(x(o.inicio + o.fadeIn), y(1))
    c.lineTo(x(o.fim - o.fadeOut), y(1))
    c.lineTo(x(o.fim), y(0))
    c.stroke()
    c.setLineDash([])
    c.globalAlpha = 1
  }
}

function Onda({ analise, duracao, o, fator, regioes, aoBuscar, aoTrecho, cabeca }) {
  const canvas = useRef(null)
  const area = useRef(null)
  const dica = useRef(null)
  const tema = useTema()

  useLayoutEffect(() => {
    const cv = canvas.current
    if (!cv || !analise) return undefined
    const pintar = () => desenhar(cv, { analise, duracao, o, fator, regioes })
    pintar()
    const ro = new ResizeObserver(pintar)
    ro.observe(cv)
    return () => ro.disconnect()
  }, [analise, duracao, o, fator, regioes, tema])

  const deX = (clientX) => {
    const r = area.current.getBoundingClientRect()
    return Math.min(Math.max(((clientX - r.left) / r.width) * duracao, 0), duracao)
  }

  // Clicar ou segurar e arrastar na onda: percorre o áudio (a cabeça de
  // leitura segue o mouse). O corte só muda pelas alças azuis.
  const aoApertar = (e) => {
    if (e.button !== 0) return
    const alvo = e.currentTarget
    alvo.setPointerCapture(e.pointerId)
    aoBuscar(deX(e.clientX))
    let pendente = null
    let quadro = 0
    const mover = (ev) => {
      pendente = ev.clientX
      if (quadro) return
      quadro = requestAnimationFrame(() => {
        quadro = 0
        if (pendente != null) aoBuscar(deX(pendente))
      })
    }
    const soltar = () => {
      cancelAnimationFrame(quadro)
      if (pendente != null) aoBuscar(deX(pendente))
      alvo.removeEventListener('pointermove', mover)
      alvo.removeEventListener('pointerup', soltar)
      alvo.removeEventListener('pointercancel', soltar)
    }
    alvo.addEventListener('pointermove', mover)
    alvo.addEventListener('pointerup', soltar)
    alvo.addEventListener('pointercancel', soltar)
  }

  const arrastarAlca = (qual) => (e) => {
    e.preventDefault()
    e.stopPropagation()
    const alvo = e.currentTarget
    alvo.setPointerCapture(e.pointerId)
    const mover = (ev) => {
      const t = deX(ev.clientX)
      aoTrecho((x) => (qual === 'inicio' ? { inicio: Math.min(t, x.fim - 0.1) } : { fim: Math.max(t, x.inicio + 0.1) }))
    }
    const soltar = () => {
      alvo.removeEventListener('pointermove', mover)
      alvo.removeEventListener('pointerup', soltar)
    }
    alvo.addEventListener('pointermove', mover)
    alvo.addEventListener('pointerup', soltar)
  }

  const pct = (t) => `${duracao ? (t / duracao) * 100 : 0}%`

  return (
    <div
      ref={area}
      className="group relative h-44 cursor-pointer touch-none rounded-xl bg-fundo-suave select-none sm:h-[clamp(11rem,30vh,17rem)] lg:h-auto lg:min-h-40 lg:flex-1"
      onPointerDown={aoApertar}
      onPointerMove={(e) => {
        if (!dica.current || !duracao) return
        // Preso dentro da onda: segurando o botão, o mouse pode sair dela.
        const r = area.current.getBoundingClientRect()
        const x = Math.min(Math.max(e.clientX - r.left, 0), r.width)
        const rotulo = dica.current.firstChild
        dica.current.style.left = `${x}px`
        rotulo.textContent = tempo(deX(e.clientX))
        // A etiqueta também não passa das bordas.
        const meia = rotulo.offsetWidth / 2
        const deslocamento = Math.min(Math.max(x, meia), r.width - meia) - x
        rotulo.style.transform = `translateX(calc(-50% + ${deslocamento}px))`
      }}
      aria-label="Forma de onda: clique ou arraste para percorrer o áudio"
    >
      {analise ? <canvas ref={canvas} className="absolute inset-0 size-full" /> : <div className="esqueleto absolute inset-0 rounded-xl" />}

      {/* Fora do trecho: escurecido. */}
      <div className="pointer-events-none absolute inset-y-0 left-0 rounded-l-xl bg-fundo/45" style={{ width: pct(o.inicio) }} />
      <div className="pointer-events-none absolute inset-y-0 right-0 rounded-r-xl bg-fundo/45" style={{ left: pct(o.fim) }} />

      {/* Tempo sob o cursor. */}
      <div ref={dica} className="pointer-events-none absolute top-0 bottom-0 hidden w-px bg-tinta/25 group-hover:block">
        <span style={{ transform: 'translateX(-50%)' }} className="absolute -top-6 left-1/2 rounded bg-tinta px-1.5 py-0.5 text-[0.6875rem] font-semibold whitespace-nowrap text-fundo tabular-nums" />
      </div>

      {/* Cabeça de leitura: movida direto pelo player (sem re-renderizar). */}
      <div ref={cabeca} className="pointer-events-none absolute inset-y-0 left-0 z-10 w-0.5 -translate-x-1/2 bg-tinta shadow-[0_0_0_1px_var(--color-fundo)]">
        <span className="absolute -top-1 left-1/2 size-2.5 -translate-x-1/2 rotate-45 rounded-[2px] bg-tinta" />
      </div>

      {[
        ['inicio', o.inicio],
        ['fim', o.fim],
      ].map(([qual, t]) => (
        <span
          key={qual}
          role="slider"
          tabIndex={0}
          aria-label={qual === 'inicio' ? 'Início do trecho' : 'Fim do trecho'}
          aria-valuemin={0}
          aria-valuemax={Math.round(duracao)}
          aria-valuenow={Math.round(t)}
          aria-valuetext={tempo(t)}
          onPointerDown={arrastarAlca(qual)}
          onKeyDown={(e) => {
            const d = { ArrowLeft: -0.1, ArrowRight: 0.1 }[e.key]
            if (!d) return
            e.preventDefault()
            e.stopPropagation()
            const passo = d * (e.shiftKey ? 10 : 1)
            aoTrecho((x) => (qual === 'inicio' ? { inicio: Math.min(Math.max(0, x.inicio + passo), x.fim - 0.1) } : { fim: Math.max(Math.min(duracao, x.fim + passo), x.inicio + 0.1) }))
          }}
          className="absolute inset-y-0 z-20 flex w-5 -translate-x-1/2 cursor-ew-resize justify-center focus-visible:outline-none"
          style={{ left: pct(t) }}
        >
          <span className="h-full w-0.5 bg-acento" />
          <span className="absolute top-1/2 h-9 w-2.5 -translate-y-1/2 rounded-full border-2 border-fundo bg-acento shadow" />
        </span>
      ))}
    </div>
  )
}

/* ─── Editor ─────────────────────────────────────────────────────────────── */

const ACEITOS = [...EXTENSOES_AUDIO, ...EXTENSOES_VIDEO]
/** "parte 2" antes de "parte 10". */
const ordemNatural = (a, b) => a.name.localeCompare(b.name, 'pt-BR', { numeric: true, sensitivity: 'base' })
let proximoId = 0

function Editor({ arquivos, aoMudarArquivos, salvo, aoDescartarSalvo }) {
  const vazio = arquivos.length === 0
  useEmEdicao(!vazio)
  const primeiro = arquivos[0]?.arquivo
  const formatoInicial = primeiro && ['mp3', 'wav', 'ogg', 'flac', 'm4a', 'opus', 'aac'].includes(extensaoDe(primeiro.name)) ? extensaoDe(primeiro.name) : 'mp3'
  const aoTrocar = () => {
    aoDescartarSalvo?.()
    apagarTudo('audio:')
    aoMudarArquivos([])
  }
  const oSalvo = useRef(salvo?.o ?? null)
  const entradaArquivos = useRef(null)
  const [recusados, setRecusados] = useState(0)
  const adicionar = (lista) => {
    const novos = [...(lista ?? [])].sort(ordemNatural)
    const validos = novos.filter((a) => a.size && ACEITOS.includes(extensaoDe(a.name)))
    setRecusados(novos.length - validos.length)
    if (validos.length) aoMudarArquivos([...arquivos, ...validos.map((arquivo) => ({ id: `f${(proximoId += 1)}`, arquivo }))])
  }
  const mover = (i, d) => {
    const j = i + d
    if (j < 0 || j >= arquivos.length) return
    const copia = [...arquivos]
    ;[copia[i], copia[j]] = [copia[j], copia[i]]
    aoMudarArquivos(copia)
  }
  const padrao = (fim) => ({ inicio: 0, fim, fadeIn: 0, fadeOut: 0, formato: formatoInicial, bitrate: 192, volume: 'manter', ganho: 6, silencio: false, silencioOnde: 'pontas', limiar: -45, velocidade: 1, tom: false })
  const [o, setO] = useState(() => padrao(0))
  const [analise, setAnalise] = useState(null)
  const [erro, setErro] = useState(null)
  const [preparo, setPreparo] = useState(null)
  const [tocando, setTocando] = useState(false)
  const [repetir, setRepetir] = useState(false)
  const tarefa = useTarefa()
  const mudar = (m) => setO((x) => ({ ...x, ...(typeof m === 'function' ? m(x) : m) }))
  // Arquivo final: nome (clicável no topo) e, no modal de baixar, formato e qualidade.
  const nomePadrao = arquivos.length > 1 ? 'audios-juntos-editado' : `${semExtensao(primeiro?.name ?? 'audio')}-editado`
  const [nomeSaida, setNomeSaida] = useState(null)
  const nomeAtual = nomeSaida ?? nomePadrao
  const [baixando, setBaixando] = useState(null)

  const audio = useRef(null)
  const cabeca = useRef(null)
  const relogio = useRef(null)
  const motor = useRef(null) // { ctx, ganho }
  const quadro = useRef(0)
  const dentro = useRef(false)

  const raiz = useRef(null)
  const url = useUrlObjeto(analise?.tocar)
  const duracao = analise?.duracao ?? 0
  const historico = useHistorico(o, setO, Boolean(analise))

  // Lê os arquivos (juntos, em sequência): forma de onda, energia e o que tocar.
  const chave = arquivos.map((a) => a.id).join('|')
  useEffect(() => {
    setAnalise(null)
    setErro(null)
    setPreparo(null)
    if (!arquivos.length) return undefined
    let vivo = true
    const controle = new AbortController()
    const lista = arquivos.map((a) => a.arquivo)
    analisarVarios(lista, { sinal: controle.signal, progresso: (v, r) => vivo && setPreparo({ v, r }) })
      .then(async (a) => {
        if (!vivo) return
        // Com um arquivo, a duração do contêiner é mais exata que a das amostras decodificadas.
        const info = lista.length === 1 ? await infoMidia(lista[0]).catch(() => ({})) : {}
        const d = info.duracao && Math.abs(info.duracao - a.duracao) < 1 ? info.duracao : a.duracao
        if (!vivo) return
        setAnalise({ ...a, duracao: d })
        const anterior = oSalvo.current
        oSalvo.current = null
        setO((x) => (anterior ? { ...x, ...anterior, fim: Math.min(anterior.fim || d, d) } : { ...x, inicio: 0, fim: d, fadeIn: Math.min(x.fadeIn, d / 2), fadeOut: Math.min(x.fadeOut, d / 2) }))
        historico.reiniciar()
      })
      .catch((e) => {
        if (!vivo) return
        console.error(e)
        setErro(e?.mensagem ?? 'Não foi possível ler este arquivo. Ele pode estar corrompido ou não ter áudio.')
      })
    return () => {
      vivo = false
      controle.abort()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave])

  // Rascunho: salva os ajustes (os arquivos são guardados ao entrar).
  useEffect(() => {
    if (!analise) return undefined
    const espera = setTimeout(() => guardar('audio:projeto', { arquivos: arquivos.map((a) => a.id), o, salvoEm: Date.now() }), 500)
    return () => clearTimeout(espera)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [o, analise])

  const regioes = useMemo(() => (o.silencio && analise ? silencios(analise, { inicio: o.inicio, fim: o.fim, limiar: o.limiar, modo: o.silencioOnde }) : []), [analise, o.silencio, o.inicio, o.fim, o.limiar, o.silencioOnde])
  const fator = useMemo(() => (o.volume === 'ganho' ? 10 ** (o.ganho / 20) : o.volume === 'normalizar' ? ganhoNormalizar(analise, o.inicio, o.fim) : 1), [o.volume, o.ganho, analise, o.inicio, o.fim])

  // Valores atuais para o laço de animação (sem recriá-lo a cada mudança).
  const atual = useRef({})
  atual.current = { o, fator, regioes, repetir, duracao }

  // Cabeça de leitura na posição do original; relógio no tempo do resultado.
  // Lê de `atual` porque o laço de animação guarda a função da 1ª renderização.
  const mostrar = (t) => {
    const { o: oo, regioes: rs, duracao: d } = atual.current
    if (cabeca.current) cabeca.current.style.left = `${d ? (t / d) * 100 : 0}%`
    if (relogio.current) relogio.current.textContent = tempo(tempoNoResultado(t, oo, rs))
  }
  useEffect(() => {
    if (audio.current) mostrar(audio.current.currentTime)
  })

  // Arquivo pronto: rola para o editor ficar inteiro na tela (o título fica acima).
  const carregado = Boolean(analise)
  useEffect(() => {
    if (carregado) raiz.current?.scrollIntoView({ block: 'start', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })
  }, [carregado])

  // Velocidade e tom: aplicados direto no player.
  useEffect(() => {
    const el = audio.current
    if (!el) return
    el.playbackRate = o.velocidade
    el.defaultPlaybackRate = o.velocidade
    el.preservesPitch = !o.tom
  }, [o.velocidade, o.tom, url])

  // Ganho (volume + fades) atualizado também com o player parado.
  useEffect(() => {
    const m = motor.current
    if (m) m.ganho.gain.setTargetAtTime(envelope(audio.current?.currentTime ?? 0, o, fator), m.ctx.currentTime, 0.02)
  }, [o, fator])

  // Limpeza: para o laço e fecha o áudio.
  useEffect(
    () => () => {
      cancelAnimationFrame(quadro.current)
      motor.current?.ctx.close().catch(() => {})
      motor.current = null
    },
    [],
  )

  const laco = () => {
    const el = audio.current
    const m = motor.current
    if (!el || !m) return
    const { o: oo, fator: f, regioes: rs, repetir: rep } = atual.current
    let t = el.currentTime
    // Prévia de "remover silêncio": pula os trechos que sairão.
    const r = rs.find(([a, b]) => t >= a && t < b - 0.03)
    if (r && r[1] < oo.fim - 0.03) {
      el.currentTime = r[1]
      t = r[1]
    }
    // Antes do trecho (o corte mudou tocando): pula para o início dele.
    if (t < oo.inicio - 0.02) {
      el.currentTime = oo.inicio
      t = oo.inicio
    }
    // Chegou ao fim do trecho: repete do início ou para (e volta para o início).
    if (dentro.current && (t >= oo.fim - 0.01 || (r && r[1] >= oo.fim - 0.03))) {
      el.currentTime = oo.inicio
      t = oo.inicio
      m.ganho.gain.cancelScheduledValues(m.ctx.currentTime)
      m.ganho.gain.setValueAtTime(envelope(t, oo, f), m.ctx.currentTime)
      if (!rep) el.pause()
    }
    m.ganho.gain.setTargetAtTime(envelope(t, oo, f), m.ctx.currentTime, 0.012)
    mostrar(t)
    quadro.current = requestAnimationFrame(laco)
  }

  const tocar = async () => {
    const el = audio.current
    if (!el || !url) return
    if (!motor.current) {
      // Player → ganho (volume e fades) → limitador (evita estourar) → saída.
      const ctx = new AudioContext()
      const fonte = ctx.createMediaElementSource(el)
      const ganho = ctx.createGain()
      const limite = ctx.createDynamicsCompressor()
      limite.threshold.value = -1
      limite.knee.value = 0
      limite.ratio.value = 20
      limite.attack.value = 0.002
      limite.release.value = 0.1
      fonte.connect(ganho).connect(limite).connect(ctx.destination)
      motor.current = { ctx, ganho }
    }
    await motor.current.ctx.resume()
    // Toca sempre dentro do trecho: fora dele (ou no fim), começa do início do corte.
    let t = el.currentTime
    if (t < o.inicio || t >= o.fim - 0.02) t = o.inicio
    el.currentTime = t
    dentro.current = true
    motor.current.ganho.gain.value = envelope(t, o, fator)
    await el.play().catch(() => {})
  }
  const pausar = () => audio.current?.pause()
  const alternar = () => (audio.current?.paused ? tocar() : pausar())
  /** Posiciona a reprodução, sempre dentro do trecho cortado. */
  const buscar = (t) => {
    const el = audio.current
    if (!el) return
    const { o: oo } = atual.current
    const alvo = Math.min(Math.max(t, oo.inicio), oo.fim)
    el.currentTime = alvo
    dentro.current = true
    mostrar(alvo)
  }
  // Mudou o corte: a cabeça de leitura que ficou de fora vai para dentro do trecho.
  useEffect(() => {
    const el = audio.current
    if (!el || !duracao) return
    const t = el.currentTime
    if (t < o.inicio || t > o.fim) {
      el.currentTime = o.inicio
      mostrar(el.currentTime)
    }
  }, [o.inicio, o.fim, duracao])
  /** Volta tudo como estava ao abrir o arquivo (e pode ser desfeito com Ctrl+Z). */
  const redefinir = () => {
    pausar()
    setRepetir(false)
    setO(padrao(duracao))
    buscar(0)
  }
  const inicioAqui = () => mudar((x) => ({ inicio: Math.min(audio.current?.currentTime ?? 0, x.fim - 0.1) }))
  const fimAqui = () => mudar((x) => ({ fim: Math.max(audio.current?.currentTime ?? 0, x.inicio + 0.1) }))

  // Atalhos: espaço toca/pausa, I/O marcam início/fim, setas andam 1 s (Shift: 5 s).
  const teclas = useRef(null)
  teclas.current = (e) => {
    // Ctrl+Z desfaz; Ctrl+Shift+Z ou Ctrl+Y refaz (menos dentro de campos de texto, que têm o próprio desfazer).
    if ((e.ctrlKey || e.metaKey) && !e.altKey) {
      if (e.target.closest?.('input:not([type=range]):not([type=checkbox]), textarea, [contenteditable]')) return
      const k = e.key.toLowerCase()
      if (k === 'z' && !e.shiftKey) {
        e.preventDefault()
        historico.desfazer()
      } else if ((k === 'z' && e.shiftKey) || k === 'y') {
        e.preventDefault()
        historico.refazer()
      }
      return
    }
    if (e.target.closest?.('input, textarea, select, button, [role=slider], [contenteditable]') || e.altKey) return
    if (e.code === 'Space') {
      e.preventDefault()
      alternar()
    } else if (e.key === 'i' || e.key === 'I') inicioAqui()
    else if (e.key === 'o' || e.key === 'O') fimAqui()
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault()
      const d = (e.key === 'ArrowLeft' ? -1 : 1) * (e.shiftKey ? 5 : 1)
      buscar(Math.min(Math.max(0, (audio.current?.currentTime ?? 0) + d), duracao))
    }
  }
  useEffect(() => {
    const f = (e) => teclas.current(e)
    addEventListener('keydown', f)
    return () => removeEventListener('keydown', f)
  }, [])

  const exportar = (s) =>
    tarefa.executar((ctx) => {
      pausar()
      const trecho = o.fim - o.inicio
      // Ordem: fades no trecho → tirar silêncio → velocidade → volume.
      const ponta = `silenceremove=start_periods=1:start_duration=0.05:start_threshold=${o.limiar}dB`
      const v = o.velocidade
      const filtros = [
        o.fadeIn ? `afade=t=in:st=0:d=${o.fadeIn}` : null,
        o.fadeOut ? `afade=t=out:st=${Math.max(0, trecho - o.fadeOut)}:d=${o.fadeOut}` : null,
        o.silencio ? (o.silencioOnde === 'tudo' ? `${ponta},silenceremove=stop_periods=-1:stop_duration=0.5:stop_threshold=${o.limiar}dB` : `${ponta},areverse,${ponta},areverse`) : null,
        // Com o tom junto: reamostra numa taxa conhecida (o arquivo pode ser 44,1 ou 48 kHz…).
        v !== 1 ? (o.tom ? `aresample=48000,asetrate=${Math.round(48000 * v)},aresample=48000` : filtroVelocidadeAudio(v)) : null,
        o.volume === 'ganho' ? `volume=${o.ganho}dB,alimiter=limit=0.98` : o.volume === 'normalizar' ? 'loudnorm=I=-14:TP=-1.5:LRA=11' : null,
      ]
        .filter(Boolean)
        .join(',')
      const inteiro = o.inicio < 0.05 && o.fim > duracao - 0.05
      const fonte = arquivos.length > 1 ? analise.tocar : primeiro
      return processarAudio(fonte, { formato: s.formato, bitrate: s.bitrate, inicio: inteiro ? undefined : o.inicio, fim: inteiro ? undefined : o.fim, filtros: filtros || undefined }, ctx, trecho / v).then(async (blob) => {
        const final = await infoMidia(new File([blob], `x.${s.formato}`)).catch(() => ({}))
        return [{ nome: `${s.nome}.${s.formato}`, blob, detalhe: final.duracao ? `${formatarDuracao(final.duracao)} de áudio` : undefined }]
      })
    }, 'Processando')

  if (tarefa.fase === 'pronto') return <Resultados itens={tarefa.resultado} duracao={tarefa.duracao} aoAjustar={tarefa.reiniciar} aoReiniciar={aoTrocar} rotuloNovo="Outro áudio" />


  const processando = tarefa.fase === 'processando'
  const removido = regioes.reduce((s, [a, b]) => s + (b - a), 0)
  const duracaoFinal = tempoNoResultado(o.fim, o, regioes)
  const maxFade = Math.max(0.5, Math.min(10, Math.floor((o.fim - o.inicio) * 2) / 4))

  const botaoRedondo = 'grid size-11 place-items-center rounded-full transition-colors disabled:opacity-40'

  return (
    <div ref={raiz} className="flex flex-col gap-3 lg:h-[calc(100dvh-5.5rem)] lg:min-h-[34rem]">
      <section aria-label="Player" className="cartao flex min-h-0 flex-col lg:flex-1">
        {/* Barra do topo: arquivo, desfazer/refazer, redefinir, trocar e exportar */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-borda px-4 py-3 sm:px-5">
          <SeloCategoria categoria="audio" icone="arquivoAudio" tamanho="p" />
          <div className="min-w-0 flex-1 basis-40">
            {vazio ? <p className="text-sm font-semibold text-tinta">Nenhum áudio aberto</p> : <NomeEditavel key={nomeAtual} nome={nomeAtual} extensao={o.formato} aoMudar={setNomeSaida} desativado={processando} rotulo="Renomear o áudio final" />}
            <p className="truncate text-xs text-fraca tabular-nums" title={arquivos.map((a) => a.arquivo.name).join(' + ')}>
              {vazio ? 'Escolha um arquivo para começar' : `${arquivos.length > 1 ? `${arquivos.length} áudios em sequência · ` : ''}${analise ? `${tempo(duracao)} no original` : 'Lendo…'}`}
            </p>
          </div>
          <input
            ref={entradaArquivos}
            type="file"
            multiple
            accept={ACEITOS.map((e) => `.${e}`).join(',')}
            className="sr-only"
            tabIndex={-1}
            onChange={(e) => {
              adicionar(e.target.files)
              e.target.value = ''
            }}
          />
          <Botao variante="secundario" tamanho="p" icone="arquivoMais" onClick={() => entradaArquivos.current?.click()} disabled={processando}>
            {vazio ? 'Escolher áudio' : 'Adicionar áudio'}
          </Botao>
          <div className="flex items-center gap-0.5">
            <BotaoAcao rotulo="Desfazer (Ctrl+Z)" icone="desfazer" onClick={historico.desfazer} disabled={!historico.podeDesfazer || processando} />
            <BotaoAcao rotulo="Refazer (Ctrl+Shift+Z)" icone="refazerAcao" onClick={historico.refazer} disabled={!historico.podeRefazer || processando} />
            <Botao variante="fantasma" tamanho="p" icone="redefinir" onClick={redefinir} disabled={!analise || processando}>
              Redefinir tudo
            </Botao>
            <Botao variante="fantasma" tamanho="p" icone="refazer" onClick={aoTrocar} disabled={processando || vazio}>
              Recomeçar
            </Botao>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {processando ? (
              <div className="w-60">
                <Progresso valor={tarefa.progresso} rotulo={tarefa.rotulo} aoCancelar={tarefa.cancelar} />
              </div>
            ) : (
              <Botao icone="baixar" onClick={() => setBaixando({ formato: o.formato, bitrate: o.bitrate })} disabled={!analise}>
                Baixar
              </Botao>
            )}
          </div>
        </div>

        {/* Onda (espaço em cima para a etiqueta do tempo sob o cursor) */}
        <div className="flex min-h-0 flex-col px-4 pt-8 sm:px-5 lg:flex-1">
          {analise ? (
            <Onda analise={analise} duracao={duracao} o={o} fator={fator} regioes={regioes} aoBuscar={buscar} aoTrecho={mudar} cabeca={cabeca} />
          ) : (
            <div
              className={`grid h-44 place-items-center rounded-xl sm:h-[clamp(11rem,30vh,17rem)] lg:h-auto lg:min-h-40 lg:flex-1 ${vazio ? 'border-2 border-dashed border-borda-forte bg-fundo-suave' : 'bg-fundo-suave'}`}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault()
                adicionar(e.dataTransfer.files)
              }}
            >
              {erro ? (
                <div className="flex max-w-md flex-col items-center gap-3 px-4 text-center">
                  <p className="text-sm text-perigo">{erro}</p>
                  <Botao variante="secundario" tamanho="p" onClick={aoTrocar}>
                    Escolher outro
                  </Botao>
                </div>
              ) : vazio ? (
                <div className="flex flex-col items-center gap-3 px-4 text-center">
                  <Icone nome="onda" tamanho={30} className="text-fraca" />
                  <p className="text-sm font-semibold text-tinta">Solte aqui um ou mais áudios</p>
                  <Botao icone="arquivoMais" onClick={() => entradaArquivos.current?.click()}>
                    Escolher áudio
                  </Botao>
                  <p className="text-xs text-fraca">{DESCRICAO_AUDIO} ou vídeo · vários arquivos tocam em sequência</p>
                </div>
              ) : (
                <div className="w-56">
                  <Progresso valor={preparo?.v ?? null} rotulo={preparo?.r ?? 'Lendo o áudio'} />
                </div>
              )}
            </div>
          )}
          {recusados ? <p className="mt-2 text-xs text-alerta">{recusados === 1 ? 'Um arquivo não é de áudio nem vídeo e foi ignorado.' : `${recusados} arquivos não são de áudio nem vídeo e foram ignorados.`}</p> : null}

          {/* Vários arquivos: a ordem em que tocam */}
          {arquivos.length > 1 ? (
            <ol className="mt-3 flex flex-wrap gap-2" aria-label="Ordem dos áudios">
              {arquivos.map((a, i) => (
                <li key={a.id} className="flex h-8 max-w-64 items-center gap-1 rounded-full border border-borda bg-superficie pr-1 pl-3 text-xs">
                  <span className="font-bold text-fraca tabular-nums">{i + 1}</span>
                  <span className="truncate font-medium text-tinta" title={a.arquivo.name}>
                    {a.arquivo.name}
                  </span>
                  <button type="button" onClick={() => mover(i, -1)} disabled={i === 0 || processando} aria-label={`Mover ${a.arquivo.name} para antes`} className="grid size-6 place-items-center rounded-full text-fraca hover:bg-superficie-2 hover:text-tinta disabled:opacity-30">
                    <Icone nome="setaBaixo" tamanho={13} className="rotate-90" />
                  </button>
                  <button type="button" onClick={() => mover(i, 1)} disabled={i === arquivos.length - 1 || processando} aria-label={`Mover ${a.arquivo.name} para depois`} className="grid size-6 place-items-center rounded-full text-fraca hover:bg-superficie-2 hover:text-tinta disabled:opacity-30">
                    <Icone nome="setaBaixo" tamanho={13} className="-rotate-90" />
                  </button>
                  <button type="button" onClick={() => aoMudarArquivos(arquivos.filter((x) => x.id !== a.id))} disabled={processando} aria-label={`Tirar ${a.arquivo.name}`} className="grid size-6 place-items-center rounded-full text-fraca hover:bg-superficie-2 hover:text-perigo disabled:opacity-30">
                    <Icone nome="fechar" tamanho={13} />
                  </button>
                </li>
              ))}
            </ol>
          ) : null}
        </div>

        {/* Player próprio */}
        <div className="flex flex-wrap items-center gap-x-5 gap-y-4 px-4 py-4 sm:px-5">
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => buscar(o.inicio)} disabled={!url} aria-label="Voltar ao início do trecho" title="Voltar ao início do trecho" className={`${botaoRedondo} text-suave hover:bg-superficie-2 hover:text-tinta`}>
              <Icone nome="voltarInicio" tamanho={20} />
            </button>
            <button
              type="button"
              onClick={alternar}
              disabled={!url}
              aria-label={tocando ? 'Pausar' : 'Tocar'}
              title={`${tocando ? 'Pausar' : 'Tocar'} (espaço)`}
              className="grid size-14 place-items-center rounded-full bg-marca text-sobre-marca shadow-[var(--shadow-cartao)] transition-[background-color,transform] hover:bg-marca-hover active:scale-95 disabled:opacity-40"
            >
              <Icone nome={tocando ? 'pausa' : 'play'} tamanho={24} className={tocando ? '' : 'translate-x-0.5'} fill="currentColor" />
            </button>
            <button
              type="button"
              onClick={() => setRepetir((r) => !r)}
              aria-pressed={repetir}
              aria-label="Repetir o trecho"
              title={repetir ? 'Repetindo o trecho (clique para desligar)' : 'Repetir o trecho'}
              className={`${botaoRedondo} ${repetir ? 'bg-acento-suave text-acento' : 'text-suave hover:bg-superficie-2 hover:text-tinta'}`}
            >
              <Icone nome="repetir" tamanho={19} />
            </button>
          </div>

          <div className="min-w-0">
            <p className="font-display text-2xl leading-none font-bold text-tinta tabular-nums">
              <span ref={relogio}>0:00.0</span>
              <span className="text-base font-semibold text-fraca" title="Duração do áudio final">
                {' '}
                / {tempo(duracaoFinal)}
              </span>
            </p>
            <p className="mt-1.5 flex flex-wrap items-center gap-x-2 text-xs text-fraca">
              <span>Duração final</span>
              {o.velocidade !== 1 ? <span className="rounded-full bg-cat-audio/15 px-1.5 py-px font-bold text-cat-audio tabular-nums">{o.velocidade.toLocaleString('pt-BR')}×</span> : null}
              {removido > 0.05 ? <span>· {formatarDuracao(removido)} de silêncio a menos</span> : null}
            </p>
          </div>

          <div className="ml-auto flex flex-wrap items-end gap-2">
            <CampoTempo rotulo="Início" valor={o.inicio} aoMudar={(v) => mudar((x) => ({ inicio: Math.min(Math.max(0, v), x.fim - 0.1) }))} />
            <CampoTempo rotulo="Fim" valor={o.fim} aoMudar={(v) => mudar((x) => ({ fim: Math.max(Math.min(duracao, v), x.inicio + 0.1) }))} />
            <Botao variante="secundario" tamanho="p" className="h-9" onClick={inicioAqui} disabled={!url} title="Marca o início onde está tocando (tecla I)">
              Início aqui
            </Botao>
            <Botao variante="secundario" tamanho="p" className="h-9" onClick={fimAqui} disabled={!url} title="Marca o fim onde está tocando (tecla O)">
              Fim aqui
            </Botao>
            {o.inicio > 0.05 || o.fim < duracao - 0.05 ? (
              <Botao variante="fantasma" tamanho="p" className="h-9" onClick={() => mudar({ inicio: 0, fim: duracao })} title="Desfaz o corte">
                Áudio inteiro
              </Botao>
            ) : null}
          </div>
        </div>
      </section>

      {tarefa.fase === 'erro' ? <Aviso tom="erro">{tarefa.mensagem}</Aviso> : null}

      {/* Ajustes: tudo o que muda aqui já toca no player */}
      <section aria-label="Ajustes" className={`grid gap-3 sm:grid-cols-2 xl:grid-cols-4 ${processando || !analise ? 'pointer-events-none opacity-50' : ''}`} inert={processando || !analise ? true : undefined}>
        <Painel>
          <Velocidade valor={o.velocidade} aoMudar={(v) => mudar({ velocidade: v })} />
          {o.velocidade !== 1 ? <Caixa rotulo="Mudar tom" marcado={o.tom} aoMudar={(v) => mudar({ tom: v })} /> : null}
        </Painel>

        <Painel titulo="Volume">
          <Segmentado
            valor={o.volume}
            aoMudar={(v) => mudar({ volume: v })}
            opcoes={[
              { valor: 'manter', rotulo: 'Original' },
              { valor: 'ganho', rotulo: 'Ajustar' },
              { valor: 'normalizar', rotulo: 'Normalizar' },
            ]}
            dica={o.volume === 'normalizar' ? 'Volume padrão de streaming, sem distorcer.' : undefined}
          />
          {o.volume === 'ganho' ? <Deslizante rotulo="Ganho" valor={o.ganho} aoMudar={(v) => mudar({ ganho: v })} min={-20} max={20} formatar={(v) => `${v > 0 ? '+' : ''}${v} dB`} /> : null}
        </Painel>

        <Painel titulo="Fade">
          <Deslizante rotulo="Fade in" valor={Math.min(o.fadeIn, maxFade)} aoMudar={(v) => mudar({ fadeIn: v })} min={0} max={maxFade} passo={0.25} formatar={(v) => (v ? `${v.toLocaleString('pt-BR')} s` : 'desligado')} />
          <Deslizante rotulo="Fade out" valor={Math.min(o.fadeOut, maxFade)} aoMudar={(v) => mudar({ fadeOut: v })} min={0} max={maxFade} passo={0.25} formatar={(v) => (v ? `${v.toLocaleString('pt-BR')} s` : 'desligado')} />
        </Painel>

        <Painel titulo="Silêncio">
          <Caixa rotulo="Remover silêncio" marcado={o.silencio} aoMudar={(v) => mudar({ silencio: v })} />
          {o.silencio ? (
            <>
              <Segmentado
                valor={o.silencioOnde}
                aoMudar={(v) => mudar({ silencioOnde: v })}
                opcoes={[
                  { valor: 'pontas', rotulo: 'Início e fim' },
                  { valor: 'tudo', rotulo: 'Todas as pausas' },
                ]}
              />
              <Deslizante rotulo="Conta como silêncio" valor={o.limiar} aoMudar={(v) => mudar({ limiar: v })} min={-70} max={-20} formatar={(v) => `abaixo de ${v} dB`} />
            </>
          ) : (
            <p className="text-xs text-fraca">Os trechos removidos aparecem apagados na onda e são pulados ao ouvir.</p>
          )}
        </Painel>
      </section>

      <p className="flex flex-wrap items-center gap-x-1.5 text-xs text-fraca">
        <span className="size-1.5 rounded-full bg-sucesso" />
        Tudo o que você ajusta já toca no player. Arraste na onda para percorrer; para cortar, use as alças azuis. Atalhos: espaço toca/pausa · I e O marcam início e fim · setas andam 1 s · Ctrl+Z desfaz.
      </p>

      {/* Elemento de áudio sem controles: quem manda é o player acima. */}
      <audio
        ref={audio}
        src={url ?? undefined}
        preload="auto"
        className="hidden"
        onPlay={() => {
          setTocando(true)
          cancelAnimationFrame(quadro.current)
          quadro.current = requestAnimationFrame(laco)
        }}
        onPause={() => {
          setTocando(false)
          cancelAnimationFrame(quadro.current)
          mostrar(audio.current?.currentTime ?? 0)
        }}
        onEnded={(e) => {
          // O arquivo acabou antes de o laço ver o fim do trecho (trecho até o final).
          const el = e.currentTarget
          const { o: oo, repetir: rep } = atual.current
          el.currentTime = oo.inicio
          dentro.current = true
          if (rep) el.play().catch(() => {})
          else setTocando(false)
        }}
        onSeeked={(e) => !tocando && mostrar(e.currentTarget.currentTime)}
        onTimeUpdate={(e) => !tocando && mostrar(e.currentTarget.currentTime)}
      />

      {/* Hora de baixar: nome, formato e qualidade do arquivo final */}
      <DialogoBaixar
        aberto={Boolean(baixando)}
        aoFechar={() => setBaixando(null)}
        titulo="Baixar o áudio"
        nome={nomeAtual}
        extensao={baixando?.formato}
        resumo={analise ? `${tempo(duracaoFinal)} de áudio` : null}
        aoConfirmar={(nome) => {
          const s = { ...baixando, nome }
          setNomeSaida(nome === nomePadrao ? null : nome)
          mudar({ formato: s.formato, bitrate: s.bitrate })
          setBaixando(null)
          exportar(s)
        }}
      >
        {baixando ? <OpcoesSaidaAudio formato={baixando.formato} bitrate={baixando.bitrate} aoMudar={(d) => setBaixando((b) => ({ ...b, ...d }))} /> : null}
      </DialogoBaixar>
    </div>
  )
}

/** Editor de áudio: trecho, velocidade, volume, fades e silêncio — com prévia ao vivo no player. */
export default function EditorAudio() {
  // Vindo do gravador ("Editar"): já abre com a gravação.
  const [arquivos, setArquivos] = useState(() => {
    const entregue = receber('audio/editor')
    return entregue ? [{ id: `f${(proximoId += 1)}`, arquivo: entregue }] : []
  })
  const [salvo, setSalvo] = useState(null)
  const [pronto, setPronto] = useState(false)

  // Ao abrir: recupera a edição deixada aberta (se não veio um arquivo do gravador).
  useEffect(() => {
    let vivo = true
    ;(async () => {
      if (arquivos.length) {
        apagarTudo('audio:')
        arquivos.forEach((a) => guardar(`audio:arquivo:${a.id}`, a.arquivo))
        setPronto(true)
        return
      }
      const s = await ler('audio:projeto')
      const lista = []
      for (const id of s?.arquivos ?? []) {
        const arquivo = await ler(`audio:arquivo:${id}`)
        if (arquivo) lista.push({ id, arquivo })
      }
      if (!vivo) return
      lista.forEach((a) => (proximoId = Math.max(proximoId, Number(a.id.replace(/\D/g, '')) || 0)))
      if (lista.length) {
        setSalvo({ o: s.o, quando: s.salvoEm ?? Date.now() })
        setArquivos(lista)
      }
      setPronto(true)
    })()
    return () => {
      vivo = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const mudarArquivos = (lista) => {
    const novos = lista.filter((a) => !arquivos.some((x) => x.id === a.id))
    novos.forEach((a) => guardar(`audio:arquivo:${a.id}`, a.arquivo))
    if (!lista.length) apagarTudo('audio:')
    setArquivos(lista)
  }

  return (
    <>
      {salvo && salvo.aviso !== false ? (
        <Aviso
          tom="info"
          className="mb-3"
          aoFechar={() => setSalvo((s) => ({ ...s, aviso: false }))}
          acao={
            <Botao
              variante="secundario"
              tamanho="p"
              onClick={() => {
                setSalvo(null)
                mudarArquivos([])
              }}
            >
              Começar do zero
            </Botao>
          }
        >
          Recuperamos a edição que você deixou aberta ({haQuanto(salvo.quando)}). Ela fica salva só neste navegador.
        </Aviso>
      ) : null}
      {pronto ? <Editor key={salvo ? 'salvo' : 'novo'} arquivos={arquivos} aoMudarArquivos={mudarArquivos} salvo={salvo} aoDescartarSalvo={() => setSalvo(null)} /> : <Editor arquivos={[]} aoMudarArquivos={mudarArquivos} />}
    </>
  )
}
