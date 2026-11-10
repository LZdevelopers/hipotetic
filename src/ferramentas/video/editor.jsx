import { useEffect, useRef, useState } from 'react'
import { BotaoAcao, CampoTempo, SeletorCompacto, Velocidade, tempo, useHistorico } from '../../componentes/editor/Comum'
import { Resultados } from '../../componentes/ferramenta/Resultados'
import { Icone } from '../../componentes/Icone'
import { AreaTexto, Aviso, Botao, Caixa, Deslizante, Progresso, Segmentado, SeloCategoria } from '../../componentes/ui'
import { EXTENSOES_AUDIO, EXTENSOES_VIDEO, infoMidia, processarVideo } from '../../motores/midia'
import { EXTENSOES_IMAGEM } from '../../motores/imagem'
import { extensaoDe, trocarExtensao } from '../../nucleo/arquivos'
import { useEmEdicao } from '../../nucleo/edicao'
import { useTarefa } from '../../nucleo/tarefa'
import { LinhaDoTempo } from './_linha'
import { Palco } from './_palco'
import { duracaoTotal, exportarProjeto, localizar, tamanhoFinal } from './_projeto'

const PADRAO = { clipes: [], recorte: null, girar: 0, espelhar: false, cor: { brilho: 0, contraste: 1, saturacao: 1 }, fadeIn: 0, fadeOut: 0, camadas: [], musica: null, formato: 'mp4', resolucao: 0, qualidade: 'alta' }
const ordemNatural = (a, b) => a.name.localeCompare(b.name, 'pt-BR', { numeric: true, sensitivity: 'base' })
let proximo = 0
const novoId = (prefixo) => `${prefixo}${(proximo += 1)}`
const tipoDe = (arquivo) => {
  const ext = extensaoDe(arquivo.name)
  if (EXTENSOES_VIDEO.includes(ext) || ext === 'gif') return 'video'
  if (EXTENSOES_IMAGEM.includes(ext)) return 'imagem'
  if (EXTENSOES_AUDIO.includes(ext)) return 'audio'
  return null
}

/* ─── Leitura das fontes ─────────────────────────────────────────────────── */

function metadadosVideo(url) {
  return new Promise((ok, falha) => {
    const v = document.createElement('video')
    v.preload = 'metadata'
    v.muted = true
    v.onloadedmetadata = () => ok({ largura: v.videoWidth, altura: v.videoHeight, duracao: Number.isFinite(v.duration) ? v.duration : null })
    v.onerror = () => falha(new Error('sem prévia'))
    v.src = url
  })
}

/** Quatro quadros pequenos para a linha do tempo. */
async function quadrosDe(url, duracao) {
  const v = document.createElement('video')
  v.muted = true
  v.preload = 'auto'
  v.src = url
  await new Promise((ok, falha) => {
    v.onloadeddata = ok
    v.onerror = falha
  })
  const alto = 72
  const largo = Math.max(1, Math.round((v.videoWidth / v.videoHeight) * alto))
  const cv = document.createElement('canvas')
  cv.width = largo
  cv.height = alto
  const ctx = cv.getContext('2d')
  const saida = []
  for (const f of [0.08, 0.36, 0.64, 0.92]) {
    await new Promise((ok) => {
      v.onseeked = ok
      v.currentTime = Math.max(0, (duracao || 1) * f)
    })
    ctx.drawImage(v, 0, 0, largo, alto)
    saida.push(cv.toDataURL('image/jpeg', 0.6))
  }
  v.removeAttribute('src')
  v.load()
  return saida
}

async function lerFonte(arquivo, aoPreparar) {
  const tipo = tipoDe(arquivo)
  if (tipo === 'imagem') {
    const bmp = await createImageBitmap(arquivo)
    const r = { arquivo, tipo, largura: bmp.width, altura: bmp.height, url: URL.createObjectURL(arquivo) }
    bmp.close()
    return r
  }
  if (tipo === 'audio') {
    const url = URL.createObjectURL(arquivo)
    const info = await infoMidia(arquivo).catch(() => ({}))
    return { arquivo, tipo, url, duracao: info.duracao ?? null, temAudio: info.temAudio !== false }
  }
  const info = await infoMidia(arquivo).catch(() => ({}))
  let url = URL.createObjectURL(arquivo)
  let meta
  try {
    meta = await metadadosVideo(url)
  } catch {
    // O navegador não toca este formato (AVI, WMV…): prévia convertida para MP4; a exportação usa o original.
    URL.revokeObjectURL(url)
    aoPreparar?.(`Preparando a prévia de ${arquivo.name}`)
    const { blob } = await processarVideo(arquivo, { formato: 'mp4', qualidade: 'media' }, { progresso: () => {} })
    url = URL.createObjectURL(blob)
    meta = await metadadosVideo(url)
  }
  return { arquivo, tipo: 'video', url, largura: meta.largura || info.largura, altura: meta.altura || info.altura, duracao: meta.duracao ?? info.duracao, temAudio: Boolean(info.temAudio) }
}

/* ─── Painéis de propriedades ────────────────────────────────────────────── */

function Bloco({ titulo, children }) {
  return (
    <div className="flex flex-col gap-3">
      {titulo ? <h3 className="text-xs font-semibold tracking-wide text-fraca uppercase">{titulo}</h3> : null}
      {children}
    </div>
  )
}

function PainelClipe({ p, fontes, clipe, mudarClipe, acoes }) {
  if (!clipe) return <p className="text-sm text-fraca">Clique num clipe da linha do tempo para ajustar velocidade, volume e trecho.</p>
  const fonte = fontes[clipe.fonte]
  const i = p.clipes.findIndex((c) => c.id === clipe.id)
  return (
    <div className="flex flex-col gap-5">
      <p className="truncate text-sm font-semibold text-tinta" title={fonte?.arquivo.name}>
        Clipe {i + 1} · {fonte?.arquivo.name}
      </p>
      <Velocidade valor={clipe.velocidade} aoMudar={(v) => mudarClipe(clipe.id, { velocidade: v })} />
      <Bloco titulo="Som do clipe">
        {fonte?.temAudio ? (
          <>
            <Deslizante rotulo="Volume" valor={Math.round(clipe.volume * 100)} aoMudar={(v) => mudarClipe(clipe.id, { volume: v / 100 })} min={0} max={100} formatar={(v) => `${v}%`} />
            <Caixa rotulo="Sem som" marcado={clipe.mudo} aoMudar={(v) => mudarClipe(clipe.id, { mudo: v })} />
          </>
        ) : (
          <p className="text-xs text-fraca">Este vídeo não tem som.</p>
        )}
      </Bloco>
      <Bloco titulo="Trecho usado do arquivo">
        <div className="flex gap-2">
          <CampoTempo rotulo="De" valor={clipe.inicio} aoMudar={(v) => mudarClipe(clipe.id, { inicio: Math.min(Math.max(0, v), clipe.fim - 0.1) })} />
          <CampoTempo rotulo="Até" valor={clipe.fim} aoMudar={(v) => mudarClipe(clipe.id, { fim: Math.max(Math.min(fonte?.duracao ?? v, v), clipe.inicio + 0.1) })} />
        </div>
      </Bloco>
      <div className="grid grid-cols-2 gap-2">
        <Botao variante="secundario" tamanho="p" icone="cortar" onClick={acoes.dividir} title="Divide o clipe onde está o cursor (S)">
          Dividir
        </Botao>
        <Botao variante="secundario" tamanho="p" icone="copiar" onClick={() => acoes.duplicar(clipe.id)}>
          Duplicar
        </Botao>
        <Botao variante="secundario" tamanho="p" onClick={() => acoes.mover(clipe.id, -1)} disabled={i === 0}>
          ← Antes
        </Botao>
        <Botao variante="secundario" tamanho="p" onClick={() => acoes.mover(clipe.id, 1)} disabled={i === p.clipes.length - 1}>
          Depois →
        </Botao>
      </div>
      <Botao variante="perigo" tamanho="p" icone="apagar" onClick={() => acoes.remover({ tipo: 'clipe', id: clipe.id })}>
        Tirar este clipe
      </Botao>
    </div>
  )
}

function PainelCamada({ camada, mudarCamada, acoes, total }) {
  if (!camada) return <p className="text-sm text-fraca">Adicione texto, imagem, vídeo ou desfoque pelos botões abaixo do vídeo, ou clique numa camada para editar.</p>
  const m = (d) => mudarCamada(camada.id, d)
  return (
    <div className="flex flex-col gap-5">
      {camada.tipo === 'texto' ? (
        <>
          <AreaTexto rotulo="Texto" valor={camada.texto} aoMudar={(v) => m({ texto: v })} rows={3} className="[&_textarea]:min-h-20 [&_textarea]:font-sans [&_textarea]:text-sm" />
          <Deslizante rotulo="Tamanho" valor={Math.round(camada.tamanho * 1000) / 10} aoMudar={(v) => m({ tamanho: v / 100 })} min={2} max={25} passo={0.5} formatar={(v) => `${v}%`} />
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-[0.8125rem] font-semibold text-tinta">
              Cor
              <input type="color" value={camada.cor} onChange={(e) => m({ cor: e.target.value })} className="h-8 w-10 cursor-pointer rounded border border-borda-forte bg-transparent" />
            </label>
            <Caixa rotulo="Negrito" marcado={camada.negrito} aoMudar={(v) => m({ negrito: v })} />
          </div>
          <Segmentado
            rotulo="Alinhamento"
            valor={camada.alinhar}
            aoMudar={(v) => m({ alinhar: v })}
            opcoes={[
              { valor: 'esquerda', rotulo: 'Esquerda' },
              { valor: 'centro', rotulo: 'Centro' },
              { valor: 'direita', rotulo: 'Direita' },
            ]}
          />
          <div className="flex flex-wrap items-center gap-3">
            <Caixa rotulo="Caixa de fundo" marcado={camada.fundo} aoMudar={(v) => m({ fundo: v })} />
            {camada.fundo ? <input type="color" aria-label="Cor da caixa" value={camada.corFundo} onChange={(e) => m({ corFundo: e.target.value })} className="h-8 w-10 cursor-pointer rounded border border-borda-forte bg-transparent" /> : null}
          </div>
          {camada.fundo ? <Deslizante rotulo="Opacidade da caixa" valor={Math.round(camada.opacidadeFundo * 100)} aoMudar={(v) => m({ opacidadeFundo: v / 100 })} min={10} max={100} formatar={(v) => `${v}%`} /> : null}
        </>
      ) : null}
      {camada.tipo === 'video' ? <Deslizante rotulo="Som deste vídeo" valor={Math.round((camada.volume ?? 0) * 100)} aoMudar={(v) => m({ volume: v / 100 })} min={0} max={100} formatar={(v) => (v ? `${v}%` : 'mudo')} /> : null}
      {camada.tipo === 'desfoque' ? <p className="text-xs text-fraca">Arraste a área no vídeo para cobrir rostos, placas ou dados. O canto inferior direito muda o tamanho.</p> : null}
      {camada.tipo !== 'desfoque' ? <Deslizante rotulo="Opacidade" valor={Math.round((camada.opacidade ?? 1) * 100)} aoMudar={(v) => m({ opacidade: v / 100 })} min={10} max={100} formatar={(v) => `${v}%`} /> : null}
      <Bloco titulo="Quando aparece">
        <div className="flex gap-2">
          <CampoTempo rotulo="De" valor={camada.inicio} aoMudar={(v) => m({ inicio: Math.min(Math.max(0, v), camada.fim - 0.2) })} />
          <CampoTempo rotulo="Até" valor={camada.fim} aoMudar={(v) => m({ fim: Math.max(Math.min(total, v), camada.inicio + 0.2) })} />
        </div>
        <button type="button" onClick={() => m({ inicio: 0, fim: total })} className="self-start text-xs font-semibold text-suave hover:text-tinta">
          O vídeo todo
        </button>
      </Bloco>
      <div className="grid grid-cols-2 gap-2">
        <Botao variante="secundario" tamanho="p" onClick={() => acoes.ordem(camada.id, 1)}>
          Para frente
        </Botao>
        <Botao variante="secundario" tamanho="p" onClick={() => acoes.ordem(camada.id, -1)}>
          Para trás
        </Botao>
      </div>
      <Botao variante="perigo" tamanho="p" icone="apagar" onClick={() => acoes.remover({ tipo: 'camada', id: camada.id })}>
        Tirar esta camada
      </Botao>
    </div>
  )
}

function PainelQuadro({ p, mudar, recorte, acoesRecorte, final }) {
  return (
    <div className="flex flex-col gap-5">
      <Bloco titulo="Recorte">
        {recorte ? (
          <>
            <p className="text-xs text-fraca">Arraste o retângulo e as alças no vídeo. Do jeito que você quiser — a proporção é livre.</p>
            <div className="grid grid-cols-2 gap-2">
              {[
                ['x', 'Esquerda'],
                ['y', 'Topo'],
                ['w', 'Largura'],
                ['h', 'Altura'],
              ].map(([k, r]) => (
                <label key={k} className="flex flex-col gap-1 text-[0.6875rem] font-semibold tracking-wide text-fraca uppercase">
                  {r} (%)
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step={0.5}
                    value={Math.round(recorte.valor[k] * 1000) / 10}
                    aria-label={`${r} do recorte em %`}
                    onChange={(e) => {
                      const v = Math.min(Math.max(Number(e.target.value) / 100, 0), 1)
                      const n = { ...recorte.valor, [k]: v }
                      n.w = Math.min(Math.max(0.05, n.w), 1 - n.x)
                      n.h = Math.min(Math.max(0.05, n.h), 1 - n.y)
                      recorte.aoMudar(n)
                    }}
                    className="h-9 rounded-lg border border-borda-forte bg-superficie px-2.5 text-sm font-semibold text-tinta normal-case tabular-nums focus:border-acento focus:outline-none"
                  />
                </label>
              ))}
            </div>
            <div className="flex gap-2">
              <Botao tamanho="p" icone="check" className="flex-1" onClick={acoesRecorte.aplicar}>
                Aplicar recorte
              </Botao>
              <Botao variante="secundario" tamanho="p" onClick={acoesRecorte.cancelar}>
                Cancelar
              </Botao>
            </div>
          </>
        ) : (
          <>
            <div className="flex gap-2">
              <Botao variante="secundario" tamanho="p" icone="recortar" className="flex-1" onClick={acoesRecorte.abrir} disabled={!p.clipes.length}>
                {p.recorte ? 'Ajustar recorte' : 'Recortar'}
              </Botao>
              {p.recorte ? (
                <Botao variante="fantasma" tamanho="p" onClick={() => mudar({ recorte: null })}>
                  Sem recorte
                </Botao>
              ) : null}
            </div>
            <p className="text-xs text-fraca tabular-nums">
              Vídeo final: {final.w} × {final.h} px
            </p>
          </>
        )}
      </Bloco>
      <Bloco titulo="Girar e espelhar">
        <div className="flex gap-2">
          <Botao variante="secundario" tamanho="p" className="flex-1" onClick={() => mudar((x) => ({ girar: (x.girar + 270) % 360, recorte: null }))} aria-label="Girar para a esquerda">
            ↺ 90°
          </Botao>
          <Botao variante="secundario" tamanho="p" className="flex-1" onClick={() => mudar((x) => ({ girar: (x.girar + 90) % 360, recorte: null }))} aria-label="Girar para a direita">
            ↻ 90°
          </Botao>
          <Botao variante={p.espelhar ? 'primario' : 'secundario'} tamanho="p" icone="espelhar" onClick={() => mudar((x) => ({ espelhar: !x.espelhar }))} aria-pressed={p.espelhar} aria-label="Espelhar" />
        </div>
      </Bloco>
      <Bloco titulo="Cores">
        <Deslizante rotulo="Brilho" valor={Math.round(p.cor.brilho * 100)} aoMudar={(v) => mudar((x) => ({ cor: { ...x.cor, brilho: v / 100 } }))} min={-50} max={50} formatar={(v) => `${v > 0 ? '+' : ''}${v}`} />
        <Deslizante rotulo="Contraste" valor={Math.round(p.cor.contraste * 100)} aoMudar={(v) => mudar((x) => ({ cor: { ...x.cor, contraste: v / 100 } }))} min={50} max={150} formatar={(v) => `${v}%`} />
        <Deslizante rotulo="Saturação" valor={Math.round(p.cor.saturacao * 100)} aoMudar={(v) => mudar((x) => ({ cor: { ...x.cor, saturacao: v / 100 } }))} min={0} max={200} formatar={(v) => (v ? `${v}%` : 'P&B')} />
      </Bloco>
      <Bloco titulo="Entrada e saída suaves">
        <Deslizante rotulo="Surgir do preto" valor={p.fadeIn} aoMudar={(v) => mudar({ fadeIn: v })} min={0} max={5} passo={0.25} formatar={(v) => (v ? `${v.toLocaleString('pt-BR')} s` : 'desligado')} />
        <Deslizante rotulo="Sumir no preto" valor={p.fadeOut} aoMudar={(v) => mudar({ fadeOut: v })} min={0} max={5} passo={0.25} formatar={(v) => (v ? `${v.toLocaleString('pt-BR')} s` : 'desligado')} />
      </Bloco>
    </div>
  )
}

function PainelMusica({ p, fontes, mudar, abrir }) {
  if (!p.musica) {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-sm text-fraca">Coloque uma música ou narração por baixo do vídeo.</p>
        <Botao variante="secundario" icone="musica" onClick={abrir} disabled={!p.clipes.length}>
          Adicionar música
        </Botao>
      </div>
    )
  }
  const mm = (d) => mudar((x) => ({ musica: { ...x.musica, ...d } }))
  return (
    <div className="flex flex-col gap-5">
      <p className="truncate text-sm font-semibold text-tinta">{fontes[p.musica.fonte]?.arquivo.name}</p>
      <Deslizante rotulo="Volume da música" valor={Math.round(p.musica.volume * 100)} aoMudar={(v) => mm({ volume: v / 100 })} min={0} max={100} formatar={(v) => `${v}%`} />
      <Deslizante rotulo="Volume do vídeo" valor={Math.round(p.musica.volumeOriginal * 100)} aoMudar={(v) => mm({ volumeOriginal: v / 100 })} min={0} max={100} formatar={(v) => (v ? `${v}%` : 'mudo')} />
      <Caixa rotulo="Repetir até o fim do vídeo" marcado={p.musica.repetir} aoMudar={(v) => mm({ repetir: v })} />
      <div className="flex gap-2">
        <Botao variante="secundario" tamanho="p" icone="refazer" onClick={abrir}>
          Trocar
        </Botao>
        <Botao variante="perigo" tamanho="p" icone="apagar" onClick={() => mudar({ musica: null })}>
          Tirar música
        </Botao>
      </div>
    </div>
  )
}

/* ─── Editor ─────────────────────────────────────────────────────────────── */

/**
 * Editor de vídeo: vários clipes em sequência, recorte livre, velocidade
 * livre, camadas (texto, imagem, vídeo sobreposto, desfoque), cores, fades e
 * música — tudo com prévia ao vivo no player próprio.
 */
export default function EditorVideo() {
  const [p, setP] = useState(PADRAO)
  const [fontes, setFontes] = useState({})
  const [selecao, setSelecao] = useState(null)
  const [aba, setAba] = useState('quadro')
  const [rascunho, setRascunho] = useState(null) // recorte em edição
  const [tocando, setTocando] = useState(false)
  const [lendo, setLendo] = useState(null)
  const [aviso, setAviso] = useState(null)
  const tarefa = useTarefa()
  const historico = useHistorico(p, setP, p.clipes.length > 0)
  const mudar = (m) => setP((x) => ({ ...x, ...(typeof m === 'function' ? m(x) : m) }))
  const mudarClipe = (id, d) => mudar((x) => ({ clipes: x.clipes.map((c) => (c.id === id ? { ...c, ...d } : c)) }))
  const mudarCamada = (id, d) => mudar((x) => ({ camadas: x.camadas.map((c) => (c.id === id ? { ...c, ...d } : c)) }))

  const palco = useRef(null)
  const relogio = useRef(null)
  const cabeca = useRef(null)
  const larguraLinha = useRef(null)
  const raiz = useRef(null)
  const entradas = { clipes: useRef(null), imagem: useRef(null), videoCamada: useRef(null), musica: useRef(null) }

  const vazio = p.clipes.length === 0
  useEmEdicao(!vazio)
  const total = duracaoTotal(p)
  const final = tamanhoFinal(p, fontes)

  // Libera as URLs ao sair.
  const fontesRef = useRef(fontes)
  fontesRef.current = fontes
  useEffect(() => () => Object.values(fontesRef.current).forEach((f) => f.url && URL.revokeObjectURL(f.url)), [])

  // Primeiro vídeo aberto: o editor ocupa a tela.
  useEffect(() => {
    if (!vazio) raiz.current?.scrollIntoView({ block: 'start', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })
  }, [vazio])

  // O palco chama isto a cada quadro: lê o projeto atual pela ref.
  const pAtual = useRef(p)
  pAtual.current = p
  const aoTempo = (t) => {
    const T = duracaoTotal(pAtual.current)
    if (relogio.current) relogio.current.textContent = tempo(t)
    if (cabeca.current) cabeca.current.style.left = `${T ? (t / T) * 100 : 0}%`
  }
  const agora = () => palco.current?.tempo() ?? 0

  /** Lê os arquivos e os coloca onde fazem sentido (clipes, camadas ou música). */
  const adicionar = async (lista, destino) => {
    const arquivos = [...(lista ?? [])].filter((a) => a.size).sort(ordemNatural)
    if (!arquivos.length) return
    setAviso(null)
    const lidas = []
    for (const arquivo of arquivos) {
      const tipo = tipoDe(arquivo)
      if (!tipo) {
        setAviso(`“${arquivo.name}” não é vídeo, imagem nem áudio.`)
        continue
      }
      setLendo(`Lendo ${arquivo.name}`)
      try {
        const fonte = await lerFonte(arquivo, setLendo)
        lidas.push({ id: novoId('f'), ...fonte })
      } catch (e) {
        console.error(e)
        setAviso(`Não foi possível abrir “${arquivo.name}”.`)
      }
    }
    setLendo(null)
    if (!lidas.length) return
    setFontes((f) => ({ ...f, ...Object.fromEntries(lidas.map((x) => [x.id, x])) }))
    const t = agora()
    mudar((x) => {
      const n = { ...x, clipes: [...x.clipes], camadas: [...x.camadas] }
      const T = duracaoTotal(x)
      const fimQ = tamanhoFinal(x, { ...fontesRef.current, ...Object.fromEntries(lidas.map((l) => [l.id, l])) })
      for (const f of lidas) {
        if (f.tipo === 'video' && (destino !== 'camada' || !x.clipes.length)) n.clipes.push({ id: novoId('c'), fonte: f.id, inicio: 0, fim: f.duracao || 1, velocidade: 1, volume: 1, mudo: false })
        else if (f.tipo === 'audio' || (destino === 'musica' && f.tipo === 'video')) n.musica = { fonte: f.id, volume: 0.5, volumeOriginal: 1, repetir: true }
        else if (x.clipes.length || n.clipes.length) {
          const aspecto = (f.altura / f.largura) * (fimQ.w / fimQ.h)
          const totalAgora = T || duracaoTotal(n)
          if (f.tipo === 'imagem') n.camadas.push({ id: novoId('k'), tipo: 'imagem', fonte: f.id, inicio: 0, fim: totalAgora, x: 0.7, y: 0.05, w: 0.25, h: 0.25 * aspecto, opacidade: 1 })
          else n.camadas.push({ id: novoId('k'), tipo: 'video', fonte: f.id, inicio: Math.min(t, Math.max(0, totalAgora - 1)), fim: Math.min(totalAgora, t + (f.duracao || 5)), x: 0.6, y: 0.6, w: 0.35, h: 0.35 * aspecto, opacidade: 1, volume: 0 })
        } else setAviso('Comece por um vídeo: imagens e músicas entram por cima dele.')
      }
      return n
    })
    // Quadros da linha do tempo, sem travar a tela.
    for (const f of lidas.filter((l) => l.tipo === 'video')) {
      quadrosDe(f.url, f.duracao)
        .then((quadros) => setFontes((x) => (x[f.id] ? { ...x, [f.id]: { ...x[f.id], quadros } } : x)))
        .catch(() => {})
    }
  }

  const novaCamada = (tipo) => {
    if (vazio) return
    const t = agora()
    const ini = Math.min(t, Math.max(0, total - 3))
    const id = novoId('k')
    if (tipo === 'texto') mudar((x) => ({ camadas: [...x.camadas, { id, tipo, inicio: ini, fim: Math.min(total, ini + 3), x: 0.1, y: 0.72, w: 0.8, h: 0.15, texto: 'Seu texto aqui', tamanho: 0.07, cor: '#ffffff', negrito: true, alinhar: 'centro', fundo: true, corFundo: '#000000', opacidadeFundo: 0.55, opacidade: 1 }] }))
    else mudar((x) => ({ camadas: [...x.camadas, { id, tipo: 'desfoque', inicio: 0, fim: total, x: 0.35, y: 0.3, w: 0.3, h: 0.3 }] }))
    setSelecao({ tipo: 'camada', id })
    setAba('camada')
  }

  const selecionar = (s) => {
    setSelecao(s)
    if (s?.tipo === 'clipe') setAba('clipe')
    else if (s?.tipo === 'camada') setAba('camada')
    else if (s?.tipo === 'musica') setAba('musica')
  }

  const acoes = {
    dividir: () => {
      const t = agora()
      const loc = localizar(p, t)
      const c = p.clipes[loc.indice]
      if (!c || loc.local <= c.inicio + 0.1 || loc.local >= c.fim - 0.1) {
        setAviso('Posicione o cursor no meio de um clipe para dividir.')
        return
      }
      const novo = { ...c, id: novoId('c'), inicio: loc.local }
      mudar((x) => ({ clipes: x.clipes.flatMap((y) => (y.id === c.id ? [{ ...y, fim: loc.local }, novo] : [y])) }))
      selecionar({ tipo: 'clipe', id: novo.id })
    },
    duplicar: (id) => mudar((x) => ({ clipes: x.clipes.flatMap((c) => (c.id === id ? [c, { ...c, id: novoId('c') }] : [c])) })),
    mover: (id, d) =>
      mudar((x) => {
        const i = x.clipes.findIndex((c) => c.id === id)
        const j = i + d
        if (j < 0 || j >= x.clipes.length) return {}
        const clipes = [...x.clipes]
        ;[clipes[i], clipes[j]] = [clipes[j], clipes[i]]
        return { clipes }
      }),
    ordem: (id, d) =>
      mudar((x) => {
        const i = x.camadas.findIndex((c) => c.id === id)
        const j = Math.min(Math.max(0, i + d), x.camadas.length - 1)
        const camadas = [...x.camadas]
        const [c] = camadas.splice(i, 1)
        camadas.splice(j, 0, c)
        return { camadas }
      }),
    remover: (s) => {
      if (!s) return
      if (s.tipo === 'clipe') mudar((x) => ({ clipes: x.clipes.filter((c) => c.id !== s.id) }))
      else if (s.tipo === 'camada') mudar((x) => ({ camadas: x.camadas.filter((c) => c.id !== s.id) }))
      else if (s.tipo === 'musica') mudar({ musica: null })
      setSelecao(null)
    },
  }

  const acoesRecorte = {
    abrir: () => {
      palco.current?.pausar()
      setRascunho(p.recorte ?? { x: 0.05, y: 0.05, w: 0.9, h: 0.9 })
      setAba('quadro')
    },
    aplicar: () => {
      const r = rascunho
      setRascunho(null)
      mudar({ recorte: r.w > 0.995 && r.h > 0.995 ? null : r })
    },
    cancelar: () => setRascunho(null),
  }

  const redefinir = () => {
    palco.current?.pausar()
    setRascunho(null)
    setSelecao(null)
    // Mantém os clipes (inteiros, na ordem) e zera todo o resto.
    mudar((x) => ({ ...PADRAO, clipes: x.clipes.map((c) => ({ ...c, inicio: 0, fim: fontes[c.fonte]?.duracao ?? c.fim, velocidade: 1, volume: 1, mudo: false })) }))
    palco.current?.buscar(0)
  }
  const recomecar = () => {
    palco.current?.pausar()
    Object.values(fontes).forEach((f) => f.url && URL.revokeObjectURL(f.url))
    setFontes({})
    setP(PADRAO)
    setSelecao(null)
    setRascunho(null)
    historico.reiniciar()
    tarefa.reiniciar()
  }

  // Atalhos: espaço, S (dividir), Delete, setas, Ctrl+Z / Ctrl+Shift+Z, Enter/Esc no recorte.
  const teclas = useRef(null)
  teclas.current = (e) => {
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
    if (e.target.closest?.('input, textarea, select, button, [role=slider], [contenteditable]') || e.altKey || vazio) return
    if (rascunho && e.key === 'Enter') acoesRecorte.aplicar()
    else if (rascunho && e.key === 'Escape') acoesRecorte.cancelar()
    else if (e.code === 'Space') {
      e.preventDefault()
      palco.current?.alternar()
    } else if (e.key === 's' || e.key === 'S') acoes.dividir()
    else if (e.key === 'Delete' || e.key === 'Backspace') acoes.remover(selecao)
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault()
      palco.current?.buscar(agora() + (e.key === 'ArrowLeft' ? -1 : 1) * (e.shiftKey ? 5 : 1))
    }
  }
  useEffect(() => {
    const f = (e) => teclas.current(e)
    addEventListener('keydown', f)
    return () => removeEventListener('keydown', f)
  }, [])

  const exportar = () =>
    tarefa.executar(async (ctx) => {
      palco.current?.pausar()
      await document.fonts?.ready
      const familia = getComputedStyle(document.body).fontFamily
      const { blob, motor } = await exportarProjeto(p, fontes, ctx, familia)
      const primeiro = fontes[p.clipes[0].fonte].arquivo
      return [{ nome: trocarExtensao(primeiro.name, p.formato, '-editado'), blob, detalhe: `${final.w} × ${final.h} px · ${tempo(total)}${motor === 'navegador' ? ' · acelerado pelo navegador' : ''}` }]
    }, 'Preparando')

  if (tarefa.fase === 'pronto') return <Resultados itens={tarefa.resultado} duracao={tarefa.duracao} aoAjustar={tarefa.reiniciar} aoReiniciar={recomecar} rotuloNovo="Outro vídeo" />

  const processando = tarefa.fase === 'processando'
  const clipeSel = selecao?.tipo === 'clipe' ? p.clipes.find((c) => c.id === selecao.id) : p.clipes[0]
  const camadaSel = selecao?.tipo === 'camada' ? p.camadas.find((c) => c.id === selecao.id) : null
  const nomes = p.clipes.map((c) => fontes[c.fonte]?.arquivo.name).filter(Boolean)
  const ABAS = [
    { valor: 'quadro', rotulo: 'Quadro' },
    { valor: 'clipe', rotulo: 'Clipe' },
    { valor: 'camada', rotulo: 'Camada' },
    { valor: 'musica', rotulo: 'Música' },
  ]
  const botaoAdd = 'inline-flex h-9 items-center gap-1.5 rounded-lg border border-borda bg-superficie px-3 text-[0.8125rem] font-semibold text-texto transition-colors hover:border-borda-forte hover:text-tinta disabled:opacity-40'

  const entradaArquivo = (chave, accept, destino, multiplo = false) => (
    <input
      ref={entradas[chave]}
      type="file"
      accept={accept}
      multiple={multiplo}
      className="sr-only"
      tabIndex={-1}
      aria-label={`Escolher ${chave}`}
      onChange={(e) => {
        adicionar(e.target.files, destino)
        e.target.value = ''
      }}
    />
  )
  const aceitaVideo = [...EXTENSOES_VIDEO, 'gif'].map((e) => `.${e}`).join(',')

  return (
    <div
      ref={raiz}
      className="flex flex-col gap-3"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault()
        adicionar(e.dataTransfer.files)
      }}
    >
      {entradaArquivo('clipes', aceitaVideo, 'clipes', true)}
      {entradaArquivo('imagem', EXTENSOES_IMAGEM.map((e) => `.${e}`).join(','), 'camada')}
      {entradaArquivo('videoCamada', aceitaVideo, 'camada')}
      {entradaArquivo('musica', [...EXTENSOES_AUDIO, ...EXTENSOES_VIDEO].map((e) => `.${e}`).join(','), 'musica')}

      <section aria-label="Player" className="cartao">
        {/* Barra do topo */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-borda px-4 py-3 sm:px-5">
          <SeloCategoria categoria="video" icone="arquivoVideo" tamanho="p" />
          <div className="min-w-0 flex-1 basis-40">
            <p className="truncate text-sm font-semibold text-tinta" title={nomes.join(' + ')}>
              {vazio ? 'Nenhum vídeo aberto' : nomes.length === 1 ? nomes[0] : `${nomes.length} clipes em sequência`}
            </p>
            <p className="text-xs text-fraca tabular-nums">{vazio ? 'Escolha um ou mais vídeos para começar' : `${tempo(total)} · ${final.w} × ${final.h} px`}</p>
          </div>
          <div className="flex items-center gap-0.5">
            <BotaoAcao rotulo="Desfazer (Ctrl+Z)" icone="desfazer" onClick={historico.desfazer} disabled={!historico.podeDesfazer || processando} />
            <BotaoAcao rotulo="Refazer (Ctrl+Shift+Z)" icone="refazerAcao" onClick={historico.refazer} disabled={!historico.podeRefazer || processando} />
            <Botao variante="fantasma" tamanho="p" icone="redefinir" onClick={redefinir} disabled={vazio || processando}>
              Redefinir tudo
            </Botao>
            <Botao variante="fantasma" tamanho="p" icone="refazer" onClick={recomecar} disabled={vazio || processando}>
              Recomeçar
            </Botao>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <SeletorCompacto
              rotulo="Formato do vídeo final"
              valor={p.formato}
              aoMudar={(v) => mudar({ formato: v })}
              opcoes={[
                { valor: 'mp4', rotulo: 'MP4' },
                { valor: 'mov', rotulo: 'MOV' },
                { valor: 'mkv', rotulo: 'MKV' },
              ]}
            />
            <SeletorCompacto
              rotulo="Resolução do vídeo final"
              valor={String(p.resolucao)}
              aoMudar={(v) => mudar({ resolucao: Number(v) })}
              opcoes={[
                { valor: '0', rotulo: 'Resolução original' },
                { valor: '1080', rotulo: '1080p' },
                { valor: '720', rotulo: '720p' },
                { valor: '480', rotulo: '480p' },
              ]}
            />
            {processando ? (
              <div className="w-60">
                <Progresso valor={tarefa.progresso} rotulo={tarefa.rotulo} aoCancelar={tarefa.cancelar} />
              </div>
            ) : (
              <Botao icone="baixar" onClick={exportar} disabled={vazio || Boolean(rascunho)}>
                Exportar vídeo
              </Botao>
            )}
          </div>
        </div>

        <div className="grid lg:grid-cols-[minmax(0,1fr)_20rem]">
          {/* Palco + controles */}
          <div className="flex min-w-0 flex-col">
            <div className="relative mx-4 mt-4 h-[clamp(12rem,37vh,30rem)] overflow-hidden rounded-xl bg-fundo-suave sm:mx-5">
              {vazio ? (
                <div className="absolute inset-0 grid place-items-center border-2 border-dashed border-borda-forte bg-fundo-suave">
                  <div className="flex flex-col items-center gap-3 px-4 text-center">
                    {lendo ? (
                      <div className="w-60">
                        <Progresso valor={null} rotulo={lendo} />
                      </div>
                    ) : (
                      <>
                        <Icone nome="filme" tamanho={30} className="text-fraca" />
                        <p className="text-sm font-semibold text-tinta">Solte aqui um ou mais vídeos</p>
                        <Botao icone="arquivoMais" onClick={() => entradas.clipes.current?.click()}>
                          Escolher vídeos
                        </Botao>
                        <p className="text-xs text-fraca">Vários arquivos (ex.: partes do mesmo vídeo) entram em sequência, na ordem dos nomes.</p>
                      </>
                    )}
                  </div>
                </div>
              ) : null}
              <Palco
                ref={palco}
                p={p}
                fontes={fontes}
                selecao={selecao}
                aoSelecionar={selecionar}
                aoMudarCamada={mudarCamada}
                recortando={rascunho ? { valor: rascunho, aoMudar: setRascunho } : null}
                aoTempo={aoTempo}
                aoTocando={setTocando}
                vazio={vazio}
              />
              {lendo && !vazio ? (
                <div className="absolute top-3 left-1/2 w-60 -translate-x-1/2 rounded-xl bg-superficie/95 p-3 shadow">
                  <Progresso valor={null} rotulo={lendo} />
                </div>
              ) : null}
            </div>

            {/* Player próprio */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-3 px-4 py-3 sm:px-5">
              <div className="flex items-center gap-1.5">
                <button type="button" onClick={() => palco.current?.buscar(0)} disabled={vazio} aria-label="Voltar ao início" title="Voltar ao início" className="grid size-10 place-items-center rounded-full text-suave transition-colors hover:bg-superficie-2 hover:text-tinta disabled:opacity-40">
                  <Icone nome="voltarInicio" tamanho={19} />
                </button>
                <button
                  type="button"
                  onClick={() => palco.current?.alternar()}
                  disabled={vazio || Boolean(rascunho)}
                  aria-label={tocando ? 'Pausar' : 'Tocar'}
                  title={`${tocando ? 'Pausar' : 'Tocar'} (espaço)`}
                  className="grid size-12 place-items-center rounded-full bg-marca text-sobre-marca shadow-[var(--shadow-cartao)] transition-[background-color,transform] hover:bg-marca-hover active:scale-95 disabled:opacity-40"
                >
                  <Icone nome={tocando ? 'pausa' : 'play'} tamanho={22} className={tocando ? '' : 'translate-x-0.5'} fill="currentColor" />
                </button>
              </div>
              <p className="font-display text-xl leading-none font-bold text-tinta tabular-nums">
                <span ref={relogio}>0:00.0</span>
                <span className="text-sm font-semibold text-fraca" title="Duração do vídeo final">
                  {' '}
                  / {tempo(total)}
                </span>
              </p>
              <div className="ml-auto flex flex-wrap items-center gap-1.5">
                <button type="button" className={botaoAdd} onClick={() => entradas.clipes.current?.click()} disabled={processando}>
                  <Icone nome="arquivoVideo" tamanho={15} /> Vídeo
                </button>
                <button type="button" className={botaoAdd} onClick={() => novaCamada('texto')} disabled={vazio}>
                  <Icone nome="texto" tamanho={15} /> Texto
                </button>
                <button type="button" className={botaoAdd} onClick={() => entradas.imagem.current?.click()} disabled={vazio}>
                  <Icone nome="imagem" tamanho={15} /> Imagem
                </button>
                <button type="button" className={botaoAdd} onClick={() => entradas.videoCamada.current?.click()} disabled={vazio} title="Vídeo por cima (picture-in-picture)">
                  <Icone nome="camadas" tamanho={15} /> Vídeo por cima
                </button>
                <button type="button" className={botaoAdd} onClick={() => novaCamada('desfoque')} disabled={vazio} title="Esconder rosto, placa ou dados">
                  <Icone nome="borracha" tamanho={15} /> Desfoque
                </button>
                <button type="button" className={botaoAdd} onClick={() => entradas.musica.current?.click()} disabled={vazio}>
                  <Icone nome="musica" tamanho={15} /> Música
                </button>
                <button type="button" className={botaoAdd} onClick={acoes.dividir} disabled={vazio} title="Dividir o clipe no cursor (S)">
                  <Icone nome="cortar" tamanho={15} /> Dividir
                </button>
              </div>
            </div>
          </div>

          {/* Propriedades */}
          <aside aria-label="Propriedades" className={`flex min-h-0 flex-col border-t border-borda lg:max-h-[calc(clamp(12rem,37vh,30rem)+5.5rem)] lg:border-t-0 lg:border-l ${vazio || processando ? 'pointer-events-none opacity-50' : ''}`} inert={vazio || processando ? true : undefined}>
            <div className="border-b border-borda p-3">
              <Segmentado valor={aba} aoMudar={setAba} opcoes={ABAS} />
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {aba === 'quadro' ? <PainelQuadro p={p} mudar={mudar} final={final} recorte={rascunho ? { valor: rascunho, aoMudar: setRascunho } : null} acoesRecorte={acoesRecorte} /> : null}
              {aba === 'clipe' ? <PainelClipe p={p} fontes={fontes} clipe={clipeSel} mudarClipe={mudarClipe} acoes={acoes} /> : null}
              {aba === 'camada' ? <PainelCamada camada={camadaSel} mudarCamada={mudarCamada} acoes={acoes} total={total} /> : null}
              {aba === 'musica' ? <PainelMusica p={p} fontes={fontes} mudar={mudar} abrir={() => entradas.musica.current?.click()} /> : null}
            </div>
          </aside>
        </div>

        {/* Linha do tempo */}
        <div className="border-t border-borda py-2 pr-4 sm:pr-5">
          <LinhaDoTempo p={p} fontes={fontes} selecao={selecao} aoSelecionar={selecionar} aoBuscar={(t) => palco.current?.buscar(t)} aoMudarClipe={mudarClipe} aoMudarCamada={mudarCamada} cabeca={cabeca} larguraRef={larguraLinha} />
        </div>
      </section>

      {aviso ? (
        <Aviso tom="alerta" aoFechar={() => setAviso(null)}>
          {aviso}
        </Aviso>
      ) : null}
      {tarefa.fase === 'erro' ? <Aviso tom="erro">{tarefa.mensagem}</Aviso> : null}

      <p className="flex flex-wrap items-center gap-x-1.5 text-xs text-fraca">
        <span className="size-1.5 rounded-full bg-sucesso" />
        Tudo o que você muda já aparece no player. Arraste textos e imagens no vídeo; na linha do tempo, arraste as camadas e as pontas dos clipes. Atalhos: espaço toca/pausa · S divide · Delete apaga · Ctrl+Z desfaz.
      </p>
    </div>
  )
}

