import { useEffect, useRef, useState } from 'react'
import { Icone } from '../../componentes/Icone'
import { MiniPlayer } from '../../componentes/MiniPlayer'
import { Aviso, Botao, Caixa, Seletor } from '../../componentes/ui'
import { FORMATOS_AUDIO } from '../../motores/midia'
import { baixarBlob, formatarDuracao, zipar } from '../../nucleo/arquivos'
import { entregar } from '../../nucleo/entrega'
import { useRota } from '../../nucleo/roteador'
import { useUrlObjeto } from '../../nucleo/url'

/** Formato que o navegador grava (Chrome/Edge: WebM Opus; Firefox: Ogg; Safari: MP4). */
const TIPOS = ['audio/webm;codecs=opus', 'audio/ogg;codecs=opus', 'audio/mp4', 'audio/webm']
const tipoDeGravacao = () => (typeof MediaRecorder === 'undefined' ? null : (TIPOS.find((t) => MediaRecorder.isTypeSupported?.(t)) ?? ''))
const extensaoDoTipo = (mime) => (/mp4/.test(mime) ? 'm4a' : /ogg/.test(mime) ? 'ogg' : 'webm')

/** 83.4 → "1:23.4" */
const cronometro = (ms) => {
  const s = ms / 1000
  const m = Math.floor(s / 60)
  return `${m}:${(s - m * 60).toFixed(1).padStart(4, '0')}`
}

function Tomada({ tomada, indice, formato, aoRemover }) {
  const url = useUrlObjeto(tomada.blob)
  const { navegar } = useRota()
  const [salvando, setSalvando] = useState(null)
  const nome = `gravacao-${indice + 1}`

  const salvar = async () => {
    setSalvando(0)
    try {
      const { converterAudio } = await import('../../motores/midia')
      const r = await converterAudio(new File([tomada.blob], `${nome}.${extensaoDoTipo(tomada.blob.type)}`, { type: tomada.blob.type }), { formato, bitrate: 192 }, { progresso: (v) => setSalvando(v ?? 0) })
      baixarBlob(r.blob, `${nome}.${formato}`)
    } finally {
      setSalvando(null)
    }
  }

  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-3 px-4 py-3.5 sm:px-5">
      <div className="w-28 shrink-0">
        <p className="text-sm font-semibold text-tinta">Gravação {indice + 1}</p>
        <p className="text-xs text-fraca tabular-nums">{formatarDuracao(tomada.duracao)}</p>
      </div>
      <MiniPlayer url={url} rotulo={`gravação ${indice + 1}`} duracao={tomada.duracao} className="min-w-48 flex-1" />
      <div className="flex shrink-0 items-center gap-2">
        <Botao
          variante="secundario"
          tamanho="p"
          icone="onda"
          title="Cortar, ajustar volume, tirar silêncio…"
          onClick={() => {
            entregar('audio/editor', new File([tomada.blob], `${nome}.${extensaoDoTipo(tomada.blob.type)}`, { type: tomada.blob.type }))
            navegar('/audio/editor')
          }}
        >
          Editar
        </Botao>
        <Botao tamanho="p" icone="baixar" carregando={salvando != null} onClick={salvar}>
          {salvando != null ? `${Math.round(salvando * 100)}%` : `Baixar ${formato.toUpperCase()}`}
        </Botao>
        <button type="button" onClick={aoRemover} aria-label={`Apagar gravação ${indice + 1}`} title="Apagar" className="grid size-8 place-items-center rounded-lg text-fraca transition-colors hover:bg-superficie-2 hover:text-perigo">
          <Icone nome="apagar" tamanho={16} />
        </button>
      </div>
    </li>
  )
}

/**
 * Gravador de voz: grava do microfone com o filtro de ruído e de eco do
 * próprio navegador, mostra o nível ao vivo, permite pausar e guarda várias
 * gravações para ouvir, editar ou baixar (MP3, WAV, M4A…). Nada sai do aparelho.
 */
export default function Gravador() {
  const [fase, setFase] = useState('parado') // parado | pedindo | gravando | pausado
  const [erro, setErro] = useState(null)
  const [tomadas, setTomadas] = useState([])
  const [dispositivos, setDispositivos] = useState([])
  const [o, setO] = useState({ dispositivo: '', ruido: true, eco: true, ganho: true, formato: 'mp3' })
  const [zipando, setZipando] = useState(false)
  const mudar = (m) => setO((x) => ({ ...x, ...m }))

  const sessao = useRef(null) // { stream, rec, ctx, analisador, partes, descartar }
  const tempo = useRef({ acumulado: 0, desde: 0 })
  const canvas = useRef(null)
  const relogio = useRef(null)
  const niveis = useRef([])
  const quadro = useRef(0)
  const faseRef = useRef(fase)
  faseRef.current = fase

  const decorrido = () => tempo.current.acumulado + (faseRef.current === 'gravando' ? performance.now() - tempo.current.desde : 0)

  const desenhar = () => {
    const s = sessao.current
    const cv = canvas.current
    if (s && cv) {
      if (faseRef.current === 'gravando') {
        const dados = new Float32Array(s.analisador.fftSize)
        s.analisador.getFloatTimeDomainData(dados)
        let soma = 0
        for (let i = 0; i < dados.length; i += 1) soma += dados[i] * dados[i]
        const db = 20 * Math.log10(Math.sqrt(soma / dados.length) + 1e-9)
        niveis.current.push(Math.min(1, Math.max(0.02, (db + 60) / 55)))
        if (niveis.current.length > 600) niveis.current.shift()
      }
      const dpr = window.devicePixelRatio || 1
      const w = cv.clientWidth
      const h = cv.clientHeight
      if (cv.width !== Math.round(w * dpr)) cv.width = Math.round(w * dpr)
      if (cv.height !== Math.round(h * dpr)) cv.height = Math.round(h * dpr)
      const c = cv.getContext('2d')
      c.setTransform(dpr, 0, 0, dpr, 0, 0)
      c.clearRect(0, 0, w, h)
      c.fillStyle = getComputedStyle(cv).getPropertyValue(faseRef.current === 'pausado' ? '--color-fraca' : '--color-cat-audio').trim()
      const passo = 4
      const n = Math.floor(w / passo)
      const lista = niveis.current.slice(-n)
      lista.forEach((v, i) => {
        const hh = Math.max(2, v * h * 0.9)
        c.fillRect(w - (lista.length - i) * passo, (h - hh) / 2, 2.5, hh)
      })
    }
    if (relogio.current) relogio.current.textContent = cronometro(decorrido())
    quadro.current = requestAnimationFrame(desenhar)
  }

  const encerrarSessao = () => {
    const s = sessao.current
    if (!s) return
    s.stream.getTracks().forEach((t) => t.stop())
    s.ctx.close().catch(() => {})
    sessao.current = null
    cancelAnimationFrame(quadro.current)
  }
  useEffect(
    () => () => {
      if (sessao.current) sessao.current.descartar = true
      sessao.current?.rec.state !== 'inactive' && sessao.current?.rec.stop()
      encerrarSessao()
    },
    [],
  )

  const gravar = async () => {
    setErro(null)
    const tipo = tipoDeGravacao()
    if (tipo == null || !navigator.mediaDevices?.getUserMedia) {
      setErro('Este navegador não grava áudio. Use um Chrome, Edge, Firefox ou Safari atual.')
      return
    }
    setFase('pedindo')
    let stream
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { deviceId: o.dispositivo ? { exact: o.dispositivo } : undefined, noiseSuppression: o.ruido, echoCancellation: o.eco, autoGainControl: o.ganho, channelCount: 1 },
      })
    } catch (e) {
      setFase('parado')
      setErro(
        e?.name === 'NotAllowedError'
          ? 'O acesso ao microfone foi negado. Clique no cadeado ao lado do endereço do site, permita o microfone e tente de novo.'
          : e?.name === 'NotFoundError'
            ? 'Nenhum microfone encontrado. Conecte um e tente de novo.'
            : 'Não foi possível usar o microfone (ele pode estar em uso por outro programa).',
      )
      return
    }
    // Com a permissão dada, os nomes dos microfones ficam disponíveis.
    navigator.mediaDevices
      .enumerateDevices()
      .then((lista) => setDispositivos(lista.filter((d) => d.kind === 'audioinput' && d.deviceId)))
      .catch(() => {})

    const ctx = new AudioContext()
    const analisador = ctx.createAnalyser()
    analisador.fftSize = 2048
    ctx.createMediaStreamSource(stream).connect(analisador)
    const rec = new MediaRecorder(stream, tipo ? { mimeType: tipo, audioBitsPerSecond: 128000 } : undefined)
    const partes = []
    const s = { stream, rec, ctx, analisador, partes, descartar: false }
    sessao.current = s
    rec.ondataavailable = (e) => e.data.size && partes.push(e.data)
    rec.onstop = () => {
      const duracao = decorrido() / 1000
      if (!s.descartar && partes.length) {
        const blob = new Blob(partes, { type: rec.mimeType || tipo || 'audio/webm' })
        setTomadas((t) => [...t, { id: `t${Date.now()}`, blob, duracao }])
      }
      encerrarSessao()
      tempo.current = { acumulado: 0, desde: 0 }
      setFase('parado')
    }
    niveis.current = []
    tempo.current = { acumulado: 0, desde: performance.now() }
    rec.start(250)
    setFase('gravando')
    cancelAnimationFrame(quadro.current)
    quadro.current = requestAnimationFrame(desenhar)
  }

  const pausar = () => {
    const s = sessao.current
    if (!s || s.rec.state !== 'recording') return
    s.rec.pause()
    tempo.current.acumulado += performance.now() - tempo.current.desde
    setFase('pausado')
  }
  const continuar = () => {
    const s = sessao.current
    if (!s || s.rec.state !== 'paused') return
    s.rec.resume()
    tempo.current.desde = performance.now()
    setFase('gravando')
  }
  const parar = (descartar = false) => {
    const s = sessao.current
    if (!s) return
    if (faseRef.current === 'gravando') {
      tempo.current.acumulado += performance.now() - tempo.current.desde
      tempo.current.desde = performance.now()
    }
    faseRef.current = 'parando'
    s.descartar = descartar
    s.rec.stop()
  }

  // Espaço: grava / para (fora de campos).
  useEffect(() => {
    const tecla = (e) => {
      if (e.code !== 'Space' || e.target.closest?.('input, textarea, select, button, [role=slider]')) return
      e.preventDefault()
      if (faseRef.current === 'parado') gravar()
      else if (faseRef.current === 'gravando' || faseRef.current === 'pausado') parar()
    }
    addEventListener('keydown', tecla)
    return () => removeEventListener('keydown', tecla)
  })

  const ativo = fase === 'gravando' || fase === 'pausado'
  const baixarTodas = async () => {
    setZipando(true)
    try {
      const { converterAudio } = await import('../../motores/midia')
      const saidas = []
      for (let i = 0; i < tomadas.length; i += 1) {
        const t = tomadas[i]
        const r = await converterAudio(new File([t.blob], `g.${extensaoDoTipo(t.blob.type)}`, { type: t.blob.type }), { formato: o.formato, bitrate: 192 }, {})
        saidas.push({ nome: `gravacao-${i + 1}.${o.formato}`, blob: r.blob })
      }
      baixarBlob(await zipar(saidas), 'gravacoes.zip')
    } finally {
      setZipando(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <section aria-label="Gravador" className="cartao overflow-hidden">
        <div className="flex flex-col items-center px-4 pt-8 pb-6 sm:px-6">
          <p className={`flex items-center gap-2 text-xs font-bold tracking-wide uppercase ${fase === 'gravando' ? 'text-perigo' : 'text-fraca'}`}>
            <span className={`size-2 rounded-full ${fase === 'gravando' ? 'animate-pulse bg-perigo' : fase === 'pausado' ? 'bg-alerta' : 'bg-borda-forte'}`} />
            {fase === 'gravando' ? 'Gravando' : fase === 'pausado' ? 'Pausado' : fase === 'pedindo' ? 'Aguardando o microfone' : 'Pronto para gravar'}
          </p>
          <p className="mt-2 font-display text-5xl font-bold text-tinta tabular-nums sm:text-6xl">
            <span ref={relogio}>0:00.0</span>
          </p>
          <div className="mt-5 h-24 w-full overflow-hidden rounded-xl bg-fundo-suave">
            {ativo ? (
              <canvas ref={canvas} className="size-full" />
            ) : (
              <p className="grid size-full place-items-center px-4 text-center text-sm text-fraca">{tomadas.length ? 'Grave mais uma, se quiser.' : 'O nível do microfone aparece aqui enquanto você grava.'}</p>
            )}
          </div>

          <div className="mt-6 flex items-center gap-4">
            {ativo ? (
              <button type="button" onClick={() => parar(true)} aria-label="Descartar esta gravação" title="Descartar" className="grid size-12 place-items-center rounded-full text-suave transition-colors hover:bg-superficie-2 hover:text-perigo">
                <Icone nome="apagar" tamanho={20} />
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => (ativo ? parar() : gravar())}
              disabled={fase === 'pedindo'}
              aria-label={ativo ? 'Parar' : 'Gravar'}
              title={`${ativo ? 'Parar e guardar' : 'Começar a gravar'} (espaço)`}
              className="grid size-20 place-items-center rounded-full bg-perigo text-white shadow-[0_10px_30px_-10px_var(--color-perigo)] transition-transform hover:scale-105 active:scale-95 disabled:opacity-50"
            >
              {ativo ? <span className="size-7 rounded-md bg-white" /> : <span className="size-8 rounded-full bg-white" />}
            </button>
            {ativo ? (
              <button
                type="button"
                onClick={fase === 'gravando' ? pausar : continuar}
                aria-label={fase === 'gravando' ? 'Pausar' : 'Continuar'}
                title={fase === 'gravando' ? 'Pausar' : 'Continuar'}
                className="grid size-12 place-items-center rounded-full text-suave transition-colors hover:bg-superficie-2 hover:text-tinta"
              >
                <Icone nome={fase === 'gravando' ? 'pausa' : 'play'} tamanho={20} fill="currentColor" />
              </button>
            ) : null}
          </div>
        </div>

        {!ativo ? (
          <div className="grid gap-4 border-t border-borda bg-fundo-suave px-4 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:px-6">
            <div className="flex flex-wrap gap-x-5 gap-y-2">
              <Caixa rotulo="Reduzir ruído do ambiente" marcado={o.ruido} aoMudar={(v) => mudar({ ruido: v })} />
              <Caixa rotulo="Cancelar eco" marcado={o.eco} aoMudar={(v) => mudar({ eco: v })} />
              <Caixa rotulo="Volume automático" marcado={o.ganho} aoMudar={(v) => mudar({ ganho: v })} />
            </div>
            {dispositivos.length > 1 ? (
              <Seletor
                rotulo="Microfone"
                valor={o.dispositivo}
                aoMudar={(v) => mudar({ dispositivo: v })}
                opcoes={[{ valor: '', rotulo: 'Padrão do sistema' }, ...dispositivos.map((d, i) => ({ valor: d.deviceId, rotulo: d.label || `Microfone ${i + 1}` }))]}
                className="sm:w-64"
              />
            ) : null}
          </div>
        ) : null}
      </section>

      {erro ? (
        <Aviso tom="erro" titulo="Não deu para gravar">
          {erro}
        </Aviso>
      ) : null}

      {tomadas.length ? (
        <section aria-label="Gravações" className="cartao">
          <header className="flex flex-wrap items-center justify-between gap-3 border-b border-borda px-4 py-3 sm:px-5">
            <p className="flex items-baseline gap-2">
              <span className="font-display text-base font-bold text-tinta">{tomadas.length === 1 ? '1 gravação' : `${tomadas.length} gravações`}</span>
              <span className="text-xs text-fraca">ficam só nesta aba</span>
            </p>
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-2 text-xs text-fraca">
                Salvar como
                <select
                  value={o.formato}
                  onChange={(e) => mudar({ formato: e.target.value })}
                  className="h-8 rounded-lg border border-borda-forte bg-superficie px-2 text-[0.8125rem] font-semibold text-tinta focus:border-acento focus:outline-none"
                >
                  {Object.entries(FORMATOS_AUDIO).map(([v, f]) => (
                    <option key={v} value={v}>
                      {f.rotulo}
                    </option>
                  ))}
                </select>
              </label>
              {tomadas.length > 1 ? (
                <Botao variante="secundario" tamanho="p" icone="pastaCompactada" carregando={zipando} onClick={baixarTodas}>
                  Baixar todas
                </Botao>
              ) : null}
            </div>
          </header>
          <ul className="divide-y divide-borda">
            {tomadas.map((t, i) => (
              <Tomada key={t.id} tomada={t} indice={i} formato={o.formato} aoRemover={() => setTomadas((lista) => lista.filter((x) => x.id !== t.id))} />
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  )
}
