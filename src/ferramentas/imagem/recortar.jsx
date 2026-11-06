import { useEffect, useMemo, useRef, useState } from 'react'
import { Resultados } from '../../componentes/ferramenta/Resultados'
import { SeletorArquivos } from '../../componentes/ferramenta/SeletorArquivos'
import { Aviso, Botao, Entrada, Grupo, Progresso } from '../../componentes/ui'
import { DESCRICAO_IMAGEM, LIMITE_IMAGEM, formatoOriginal, processarLote } from '../../motores/imagem'
import { trocarExtensao } from '../../nucleo/arquivos'
import { useTarefa } from '../../nucleo/tarefa'
import { EscolhaFormato, Qualidade } from './_comum'

const PROPORCOES = [
  { id: 'livre', rotulo: 'Livre', valor: null },
  { id: '1:1', rotulo: '1:1', valor: 1 },
  { id: '4:3', rotulo: '4:3', valor: 4 / 3 },
  { id: '3:4', rotulo: '3:4', valor: 3 / 4 },
  { id: '16:9', rotulo: '16:9', valor: 16 / 9 },
  { id: '9:16', rotulo: '9:16', valor: 9 / 16 },
  { id: '3:2', rotulo: '3:2', valor: 3 / 2 },
  { id: '2:3', rotulo: '2:3', valor: 2 / 3 },
]
const MIN = 8

/** Maior retângulo da proporção `r`, centralizado na imagem. */
function centralizado(largura, altura, r) {
  if (!r) return { x: 0, y: 0, w: largura, h: altura }
  let w = largura
  let h = w / r
  if (h > altura) {
    h = altura
    w = h * r
  }
  return { x: (largura - w) / 2, y: (altura - h) / 2, w, h }
}

function limitar(c, largura, altura) {
  const w = Math.min(Math.max(c.w, MIN), largura)
  const h = Math.min(Math.max(c.h, MIN), altura)
  return { w, h, x: Math.min(Math.max(c.x, 0), largura - w), y: Math.min(Math.max(c.y, 0), altura - h) }
}

/**
 * Novo retângulo ao arrastar a alça `alca` por (dx, dy) em pixels da imagem.
 * Com proporção travada, só os cantos redimensionam, mantendo o canto oposto.
 */
function arrastar(inicio, alca, dx, dy, largura, altura, r) {
  if (alca === 'mover') return limitar({ ...inicio, x: inicio.x + dx, y: inicio.y + dy }, largura, altura)
  let { x, y, w, h } = inicio
  const direita = inicio.x + inicio.w
  const baixo = inicio.y + inicio.h
  if (alca.includes('e')) w = Math.min(inicio.w + dx, largura - inicio.x)
  if (alca.includes('w')) w = Math.min(inicio.w - dx, direita)
  if (alca.includes('s')) h = Math.min(inicio.h + dy, altura - inicio.y)
  if (alca.includes('n')) h = Math.min(inicio.h - dy, baixo)
  w = Math.max(w, MIN)
  h = Math.max(h, MIN)
  if (r) {
    // O lado que mais mudou manda; o outro segue a proporção, dentro dos limites.
    if (Math.abs(w - inicio.w) / inicio.w >= Math.abs(h - inicio.h) / inicio.h) h = w / r
    else w = h * r
    const maxW = alca.includes('w') ? direita : largura - inicio.x
    const maxH = alca.includes('n') ? baixo : altura - inicio.y
    const escala = Math.min(1, maxW / w, maxH / h)
    w *= escala
    h *= escala
  }
  if (alca.includes('w')) x = direita - w
  if (alca.includes('n')) y = baixo - h
  return { x, y, w, h }
}

const ALCAS = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']
const POSICAO = {
  nw: 'left-0 top-0 cursor-nwse-resize',
  n: 'left-1/2 top-0 cursor-ns-resize',
  ne: 'left-full top-0 cursor-nesw-resize',
  e: 'left-full top-1/2 cursor-ew-resize',
  se: 'left-full top-full cursor-nwse-resize',
  s: 'left-1/2 top-full cursor-ns-resize',
  sw: 'left-0 top-full cursor-nesw-resize',
  w: 'left-0 top-1/2 cursor-ew-resize',
}

function Editor({ arquivo, aoTrocar }) {
  const url = useMemo(() => URL.createObjectURL(arquivo), [arquivo])
  useEffect(() => () => URL.revokeObjectURL(url), [url])
  const img = useRef(null)
  const [nat, setNat] = useState(null)
  const [proporcao, setProporcao] = useState('livre')
  const [corte, setCorte] = useState(null)
  const [saida, setSaida] = useState({ formato: 'original', qualidade: 92 })
  const gesto = useRef(null)
  const tarefa = useTarefa()
  const r = PROPORCOES.find((p) => p.id === proporcao)?.valor ?? null

  const aoCarregar = () => {
    const { naturalWidth: largura, naturalHeight: altura } = img.current
    setNat({ largura, altura })
    setCorte(centralizado(largura, altura, r))
  }
  const escolherProporcao = (id) => {
    setProporcao(id)
    if (nat) setCorte(centralizado(nat.largura, nat.altura, PROPORCOES.find((p) => p.id === id).valor))
  }

  const iniciar = (alca) => (e) => {
    e.preventDefault()
    e.stopPropagation()
    e.currentTarget.setPointerCapture(e.pointerId)
    gesto.current = { alca, x: e.clientX, y: e.clientY, inicio: corte, escala: nat.largura / img.current.clientWidth }
  }
  const mover = (e) => {
    const g = gesto.current
    if (!g) return
    const dx = (e.clientX - g.x) * g.escala
    const dy = (e.clientY - g.y) * g.escala
    setCorte(arrastar(g.inicio, g.alca, dx, dy, nat.largura, nat.altura, r))
  }
  const soltar = () => (gesto.current = null)

  // Setas do teclado movem a seleção (Shift = 10 px).
  const aoTeclar = (e) => {
    const passo = e.shiftKey ? 10 : 1
    const d = { ArrowLeft: [-passo, 0], ArrowRight: [passo, 0], ArrowUp: [0, -passo], ArrowDown: [0, passo] }[e.key]
    if (!d || !corte) return
    e.preventDefault()
    setCorte((c) => limitar({ ...c, x: c.x + d[0], y: c.y + d[1] }, nat.largura, nat.altura))
  }

  const definirCampo = (campo) => (v) => {
    const n = Number(v)
    if (!Number.isFinite(n)) return
    setCorte((c) => {
      const novo = { ...c, [campo]: n }
      if (r && campo === 'w') novo.h = n / r
      if (r && campo === 'h') novo.w = n * r
      return limitar(novo, nat.largura, nat.altura)
    })
  }

  if (tarefa.fase === 'pronto') {
    return <Resultados itens={tarefa.resultado} duracao={tarefa.duracao} aoAjustar={tarefa.reiniciar} aoReiniciar={aoTrocar} rotuloNovo="Outra imagem" />
  }

  const recortar = () =>
    tarefa.executar(async (ctx) => {
      const formato = saida.formato === 'original' ? await formatoOriginal(arquivo) : saida.formato
      const recorte = { x: Math.round(corte.x), y: Math.round(corte.y), largura: Math.round(corte.w), altura: Math.round(corte.h) }
      return processarLote([{ arquivo }], () => ({ recorte, nome: trocarExtensao(arquivo.name, formato, '-recortada'), saida: { formato, qualidade: saida.qualidade } }), { ...ctx, rotulo: 'Recortando' })
    }, 'Recortando')

  const pct = (v, total) => `${(v / total) * 100}%`
  const processando = tarefa.fase === 'processando'

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
      <div className="xadrez grid place-items-center overflow-hidden rounded-[var(--radius-cartao)] border border-borda p-4 select-none">
        <div className="relative max-w-full touch-none" onPointerMove={mover} onPointerUp={soltar} onPointerCancel={soltar}>
          <img ref={img} src={url} alt="Imagem a recortar" onLoad={aoCarregar} draggable={false} className="block max-h-[65vh] max-w-full" />
          {corte && nat ? (
            <>
              {/* Escurece o que fica de fora */}
              <div className="pointer-events-none absolute inset-0 bg-black/55" style={{ clipPath: `polygon(0 0,100% 0,100% 100%,0 100%,0 0,${pct(corte.x, nat.largura)} ${pct(corte.y, nat.altura)},${pct(corte.x, nat.largura)} ${pct(corte.y + corte.h, nat.altura)},${pct(corte.x + corte.w, nat.largura)} ${pct(corte.y + corte.h, nat.altura)},${pct(corte.x + corte.w, nat.largura)} ${pct(corte.y, nat.altura)},${pct(corte.x, nat.largura)} ${pct(corte.y, nat.altura)})` }} />
              <div
                role="slider"
                tabIndex={0}
                aria-label="Área de recorte (use as setas para mover)"
                aria-valuetext={`${Math.round(corte.w)} × ${Math.round(corte.h)} px, em ${Math.round(corte.x)}, ${Math.round(corte.y)}`}
                onKeyDown={aoTeclar}
                onPointerDown={iniciar('mover')}
                className="absolute cursor-move border border-white shadow-[0_0_0_1px_rgb(0_0_0/0.4)]"
                style={{ left: pct(corte.x, nat.largura), top: pct(corte.y, nat.altura), width: pct(corte.w, nat.largura), height: pct(corte.h, nat.altura) }}
              >
                {/* Grade dos terços */}
                <div className="pointer-events-none absolute inset-0 grid grid-cols-3 grid-rows-3">
                  {Array.from({ length: 9 }, (_, i) => (
                    <span key={i} className="border-r border-b border-white/30 [&:nth-child(3n)]:border-r-0 [&:nth-child(n+7)]:border-b-0" />
                  ))}
                </div>
                {ALCAS.filter((a) => !r || a.length === 2).map((a) => (
                  <span
                    key={a}
                    onPointerDown={iniciar(a)}
                    className={`absolute size-4 -translate-x-1/2 -translate-y-1/2 rounded-sm border-2 border-white bg-black/60 ${POSICAO[a]}`}
                  />
                ))}
              </div>
            </>
          ) : null}
        </div>
      </div>

      <aside className="cartao flex flex-col gap-5 p-4 sm:p-5 lg:sticky lg:top-20">
        <div className={processando ? 'pointer-events-none flex flex-col gap-5 opacity-60' : 'flex flex-col gap-5'}>
          <Grupo titulo="Proporção">
            <div className="grid grid-cols-4 gap-1.5">
              {PROPORCOES.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  aria-pressed={proporcao === p.id}
                  onClick={() => escolherProporcao(p.id)}
                  className={`h-8 rounded-lg border text-xs font-semibold tabular-nums transition-colors ${proporcao === p.id ? 'border-marca bg-marca text-sobre-marca' : 'border-borda text-suave hover:text-tinta'}`}
                >
                  {p.rotulo}
                </button>
              ))}
            </div>
          </Grupo>
          {corte ? (
            <Grupo titulo="Medidas (px)">
              <div className="grid grid-cols-2 gap-3">
                <Entrada rotulo="Largura" type="number" valor={Math.round(corte.w)} aoMudar={definirCampo('w')} />
                <Entrada rotulo="Altura" type="number" valor={Math.round(corte.h)} aoMudar={definirCampo('h')} />
                <Entrada rotulo="X" type="number" valor={Math.round(corte.x)} aoMudar={definirCampo('x')} />
                <Entrada rotulo="Y" type="number" valor={Math.round(corte.y)} aoMudar={definirCampo('y')} />
              </div>
              <p className="mt-2 text-xs text-fraca">
                Original: {nat.largura} × {nat.altura} px
              </p>
            </Grupo>
          ) : null}
          <EscolhaFormato valor={saida.formato} aoMudar={(v) => setSaida((s) => ({ ...s, formato: v }))} comOriginal />
          <Qualidade valor={saida.qualidade} aoMudar={(v) => setSaida((s) => ({ ...s, qualidade: v }))} formato={saida.formato} />
        </div>
        {tarefa.fase === 'erro' ? <Aviso tom="erro">{tarefa.mensagem}</Aviso> : null}
        {processando ? (
          <Progresso valor={tarefa.progresso} rotulo={tarefa.rotulo} aoCancelar={tarefa.cancelar} />
        ) : (
          <div className="flex gap-2">
            <Botao variante="secundario" tamanho="g" onClick={aoTrocar}>
              Trocar
            </Botao>
            <Botao tamanho="g" className="flex-1" icone="recortar" onClick={recortar} disabled={!corte}>
              Recortar
            </Botao>
          </div>
        )}
      </aside>
    </div>
  )
}

export default function Recortar() {
  const [arquivos, setArquivos] = useState([])
  if (!arquivos.length) {
    return (
      <SeletorArquivos
        arquivos={arquivos}
        aoMudar={setArquivos}
        multiplos={false}
        extensoes={['png', 'jpg', 'jpeg', 'webp', 'avif', 'gif', 'bmp']}
        descricaoFormatos={DESCRICAO_IMAGEM.replace(', SVG', '')}
        limiteBytes={LIMITE_IMAGEM}
        aceitarColar
      />
    )
  }
  return <Editor key={arquivos[0].id} arquivo={arquivos[0].arquivo} aoTrocar={() => setArquivos([])} />
}
