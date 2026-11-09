import { useEffect, useMemo, useRef, useState } from 'react'
import { Resultados } from '../../componentes/ferramenta/Resultados'
import { SeletorArquivos } from '../../componentes/ferramenta/SeletorArquivos'
import { Icone } from '../../componentes/Icone'
import { Aviso, Botao, Caixa, Deslizante, Entrada, Progresso, Segmentado, Seletor } from '../../componentes/ui'
import { DESCRICAO_IMAGEM, EXTENSOES_IMAGEM, LIMITE_IMAGEM, dimensoes, formatoOriginal, processarLote } from '../../motores/imagem'
import { filtroCss } from '../../motores/imagem/nucleo'
import { trocarExtensao } from '../../nucleo/arquivos'
import { useTarefa } from '../../nucleo/tarefa'
import { CorDeFundo, EscolhaFormato, Qualidade } from './_comum'

/* ─── Dados ──────────────────────────────────────────────────────────────── */

const NEUTRO = { brilho: 100, contraste: 100, saturacao: 100, matiz: 0, cinza: 0, sepia: 0, inverter: false, desfoque: 0 }
const FILTROS = [
  { id: 'original', nome: 'Original', ajustes: NEUTRO },
  { id: 'pb', nome: 'P&B', ajustes: { ...NEUTRO, cinza: 100, contraste: 110 } },
  { id: 'sepia', nome: 'Sépia', ajustes: { ...NEUTRO, sepia: 80, contraste: 95 } },
  { id: 'vintage', nome: 'Vintage', ajustes: { ...NEUTRO, sepia: 35, saturacao: 80, contraste: 90, brilho: 105 } },
  { id: 'vivido', nome: 'Vívido', ajustes: { ...NEUTRO, saturacao: 145, contraste: 112 } },
  { id: 'suave', nome: 'Suave', ajustes: { ...NEUTRO, saturacao: 75, contraste: 88, brilho: 106 } },
  { id: 'frio', nome: 'Frio', ajustes: { ...NEUTRO, matiz: 12, saturacao: 90, brilho: 102 } },
  { id: 'quente', nome: 'Quente', ajustes: { ...NEUTRO, sepia: 22, saturacao: 115 } },
  { id: 'dramatico', nome: 'Dramático', ajustes: { ...NEUTRO, contraste: 140, saturacao: 85, brilho: 95 } },
]
const PROPORCOES = [
  { id: 'livre', rotulo: 'Livre', valor: null },
  { id: '1:1', rotulo: '1:1', valor: 1 },
  { id: '4:5', rotulo: '4:5', valor: 4 / 5 },
  { id: '4:3', rotulo: '4:3', valor: 4 / 3 },
  { id: '3:2', rotulo: '3:2', valor: 3 / 2 },
  { id: '16:9', rotulo: '16:9', valor: 16 / 9 },
  { id: '9:16', rotulo: '9:16', valor: 9 / 16 },
]
export const REDES = [
  { id: 'ig-quadrado', nome: 'Instagram · post quadrado', w: 1080, h: 1080 },
  { id: 'ig-retrato', nome: 'Instagram · post retrato', w: 1080, h: 1350 },
  { id: 'ig-story', nome: 'Stories, Reels e TikTok', w: 1080, h: 1920 },
  { id: 'yt-miniatura', nome: 'YouTube · miniatura', w: 1280, h: 720 },
  { id: 'yt-banner', nome: 'YouTube · banner', w: 2560, h: 1440 },
  { id: 'fb-post', nome: 'Facebook · post', w: 1200, h: 630 },
  { id: 'fb-capa', nome: 'Facebook · capa', w: 1640, h: 624 },
  { id: 'x-post', nome: 'X · post', w: 1600, h: 900 },
  { id: 'x-capa', nome: 'X · cabeçalho', w: 1500, h: 500 },
  { id: 'li-post', nome: 'LinkedIn · post', w: 1200, h: 627 },
  { id: 'li-capa', nome: 'LinkedIn · capa', w: 1584, h: 396 },
  { id: 'og', nome: 'Prévia de link (Open Graph)', w: 1200, h: 630 },
  { id: 'perfil', nome: 'Foto de perfil', w: 800, h: 800 },
  { id: 'fullhd', nome: 'Papel de parede Full HD', w: 1920, h: 1080 },
]
const INICIAL = {
  proporcao: 'livre',
  recorte: null, // { x, y, w, h } em frações (0–1) da imagem; null = imagem inteira
  girar: 0,
  espelharH: false,
  espelharV: false,
  tamanho: 'original', // original | porcentagem | medidas | lado | rede
  porcentagem: 50,
  largura: '',
  altura: '',
  lado: '1920',
  rede: 'ig-quadrado',
  encaixe: 'cobrir',
  ajustes: NEUTRO,
  formato: 'original',
  qualidade: 90,
  fundo: '#ffffff',
}

/* ─── Geometria do recorte (frações da imagem) ──────────────────────────── */

/** O recorte acontece ANTES de girar: girando 90°, a proporção pedida (do resultado) se inverte. */
const proporcaoEfetiva = (id, girar) => {
  const r = PROPORCOES.find((p) => p.id === id)?.valor ?? null
  return r && girar % 180 ? 1 / r : r
}

/** Maior retângulo da proporção r (em pixels) na imagem W×H, centralizado, em frações. */
function maiorRecorte(W, H, r) {
  if (!r) return { x: 0, y: 0, w: 1, h: 1 }
  let w = W
  let h = w / r
  if (h > H) {
    h = H
    w = h * r
  }
  return { x: (1 - w / W) / 2, y: (1 - h / H) / 2, w: w / W, h: h / H }
}

const limitar = (c) => {
  const w = Math.min(Math.max(c.w, 0.02), 1)
  const h = Math.min(Math.max(c.h, 0.02), 1)
  return { w, h, x: Math.min(Math.max(c.x, 0), 1 - w), y: Math.min(Math.max(c.y, 0), 1 - h) }
}

/**
 * Recorte em pixels para uma imagem W×H. Com proporção travada, refaz o
 * retângulo nessa imagem (mesma proporção, mesmo centro e mesma escala
 * relativa) — assim um lote com fotos de tamanhos diferentes sai certo.
 */
function recorteEmPixels(rel, W, H, r, escalaRef) {
  if (!rel) return undefined
  let f = rel
  if (r) {
    const max = maiorRecorte(W, H, r)
    const w = max.w * escalaRef
    const h = max.h * escalaRef
    f = limitar({ w, h, x: rel.x + rel.w / 2 - w / 2, y: rel.y + rel.h / 2 - h / 2 })
  }
  return { x: Math.round(f.x * W), y: Math.round(f.y * H), largura: Math.max(1, Math.round(f.w * W)), altura: Math.max(1, Math.round(f.h * H)) }
}

/** Medidas finais após girar e recortar. */
function calcularTamanho({ largura, altura }, o) {
  if (o.tamanho === 'porcentagem') return { largura: (largura * o.porcentagem) / 100, altura: (altura * o.porcentagem) / 100, modo: 'esticar' }
  if (o.tamanho === 'lado') {
    const e = Number(o.lado) / Math.max(largura, altura)
    return { largura: largura * e, altura: altura * e, modo: 'esticar' }
  }
  if (o.tamanho === 'rede') {
    const r = REDES.find((x) => x.id === o.rede)
    return { largura: r.w, altura: r.h, modo: o.encaixe, fundo: o.encaixe === 'conter' ? o.fundo : undefined }
  }
  if (o.tamanho === 'medidas') {
    const w = Number(o.largura) || 0
    const h = Number(o.altura) || 0
    const e = w && h ? Math.min(w / largura, h / altura) : w ? w / largura : h / altura
    return { largura: largura * e, altura: altura * e, modo: 'esticar' }
  }
  return undefined
}

/* ─── Prévia com recorte arrastável ─────────────────────────────────────── */

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

function Previa({ arquivo, o, mudar, recortando, aoDimensoes }) {
  const url = useMemo(() => URL.createObjectURL(arquivo), [arquivo])
  useEffect(() => () => URL.revokeObjectURL(url), [url])
  const img = useRef(null)
  const [lado, setLado] = useState(800)
  const [nat, setNat] = useState(null)
  const proporcao = proporcaoEfetiva(o.proporcao, o.girar)
  const corte = o.recorte ?? { x: 0, y: 0, w: 1, h: 1 }

  const arrastar = (alca) => (e) => {
    e.preventDefault()
    e.stopPropagation()
    const alvo = e.currentTarget
    alvo.setPointerCapture(e.pointerId)
    const inicio = { x: e.clientX, y: e.clientY, c: corte, w: img.current.clientWidth, h: img.current.clientHeight }
    const mover = (ev) => {
      const dx = (ev.clientX - inicio.x) / inicio.w
      const dy = (ev.clientY - inicio.y) / inicio.h
      const c = inicio.c
      let n
      if (alca === 'mover') n = { ...c, x: c.x + dx, y: c.y + dy }
      else {
        let { x, y, w, h } = c
        if (alca.includes('e')) w = c.w + dx
        if (alca.includes('w')) {
          w = c.w - dx
          x = c.x + dx
        }
        if (alca.includes('s')) h = c.h + dy
        if (alca.includes('n')) {
          h = c.h - dy
          y = c.y + dy
        }
        if (proporcao && nat) {
          // Mantém a proporção em pixels: h = w·W/(H·r).
          const hNova = (w * nat.largura) / (nat.altura * proporcao)
          if (alca.includes('n')) y = c.y + c.h - hNova
          h = hNova
        }
        n = { x, y, w, h }
      }
      mudar({ recorte: limitar(n) })
    }
    const soltar = () => {
      alvo.removeEventListener('pointermove', mover)
      alvo.removeEventListener('pointerup', soltar)
    }
    alvo.addEventListener('pointermove', mover)
    alvo.addEventListener('pointerup', soltar)
  }

  const pct = (v) => `${v * 100}%`
  return (
    <div className="xadrez grid min-h-72 place-items-center overflow-hidden rounded-[var(--radius-cartao)] border border-borda p-4 select-none">
      <div className="relative max-w-full touch-none transition-transform duration-300" style={{ transform: `rotate(${o.girar}deg) scale(${o.espelharH ? -1 : 1}, ${o.espelharV ? -1 : 1})` }}>
        <img
          ref={img}
          src={url}
          alt="Prévia"
          draggable={false}
          onLoad={(e) => {
            const d = { largura: e.currentTarget.naturalWidth, altura: e.currentTarget.naturalHeight }
            setNat(d)
            aoDimensoes(d)
            setLado(Math.max(e.currentTarget.clientWidth, e.currentTarget.clientHeight))
          }}
          className="block max-h-[60vh] max-w-full"
          style={{ filter: filtroCss(o.ajustes, lado) }}
        />
        {recortando && o.recorte ? (
          <>
            <div
              className="pointer-events-none absolute inset-0 bg-black/55"
              style={{ clipPath: `polygon(0 0,100% 0,100% 100%,0 100%,0 0,${pct(corte.x)} ${pct(corte.y)},${pct(corte.x)} ${pct(corte.y + corte.h)},${pct(corte.x + corte.w)} ${pct(corte.y + corte.h)},${pct(corte.x + corte.w)} ${pct(corte.y)},${pct(corte.x)} ${pct(corte.y)})` }}
            />
            <div
              role="slider"
              tabIndex={0}
              aria-label="Área de recorte (arraste para mover)"
              aria-valuetext={nat ? `${Math.round(corte.w * nat.largura)} × ${Math.round(corte.h * nat.altura)} px` : undefined}
              onPointerDown={arrastar('mover')}
              onKeyDown={(e) => {
                const d = { ArrowLeft: [-0.01, 0], ArrowRight: [0.01, 0], ArrowUp: [0, -0.01], ArrowDown: [0, 0.01] }[e.key]
                if (!d) return
                e.preventDefault()
                mudar({ recorte: limitar({ ...corte, x: corte.x + d[0], y: corte.y + d[1] }) })
              }}
              className="absolute cursor-move border border-white shadow-[0_0_0_1px_rgb(0_0_0/0.4)]"
              style={{ left: pct(corte.x), top: pct(corte.y), width: pct(corte.w), height: pct(corte.h) }}
            >
              <div className="pointer-events-none absolute inset-0 grid grid-cols-3 grid-rows-3">
                {Array.from({ length: 9 }, (_, i) => (
                  <span key={i} className="border-r border-b border-white/30 [&:nth-child(3n)]:border-r-0 [&:nth-child(n+7)]:border-b-0" />
                ))}
              </div>
              {ALCAS.filter((a) => !proporcao || a.length === 2).map((a) => (
                <span key={a} onPointerDown={arrastar(a)} className={`absolute size-4 -translate-x-1/2 -translate-y-1/2 rounded-sm border-2 border-white bg-black/60 ${POSICAO[a]}`} />
              ))}
            </div>
          </>
        ) : null}
      </div>
    </div>
  )
}

/* ─── Painel de controles (abas) ────────────────────────────────────────── */

const ABAS = [
  { id: 'recortar', rotulo: 'Recortar', icone: 'recortar' },
  { id: 'girar', rotulo: 'Girar', icone: 'girar' },
  { id: 'tamanho', rotulo: 'Tamanho', icone: 'regua' },
  { id: 'cores', rotulo: 'Cores', icone: 'ajustar' },
  { id: 'salvar', rotulo: 'Salvar como', icone: 'baixar' },
]

function Controles({ aba, o, mudar, nat }) {
  const m = (k) => (v) => mudar({ [k]: v })
  if (aba === 'recortar') {
    return (
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-4 gap-1.5">
          {PROPORCOES.map((p) => (
            <button
              key={p.id}
              type="button"
              aria-pressed={o.proporcao === p.id && Boolean(o.recorte)}
              onClick={() => mudar({ proporcao: p.id, recorte: nat ? maiorRecorte(nat.largura, nat.altura, proporcaoEfetiva(p.id, o.girar)) : null })}
              className={`h-8 rounded-lg border text-xs font-semibold tabular-nums transition-colors ${o.proporcao === p.id && o.recorte ? 'border-marca bg-marca text-sobre-marca' : 'border-borda text-suave hover:text-tinta'}`}
            >
              {p.rotulo}
            </button>
          ))}
        </div>
        <p className="text-xs text-fraca">{o.recorte ? 'Arraste a área clara na imagem; as alças mudam o tamanho.' : 'Escolha uma proporção para começar a recortar.'}</p>
        {o.recorte ? (
          <Botao variante="secundario" tamanho="p" className="self-start" onClick={() => mudar({ recorte: null, proporcao: 'livre' })}>
            Sem recorte
          </Botao>
        ) : null}
      </div>
    )
  }
  if (aba === 'girar') {
    return (
      <div className="grid grid-cols-2 gap-2">
        <Botao variante="secundario" icone="girar" className="[&>svg]:-scale-x-100" onClick={() => mudar({ girar: (o.girar + 270) % 360, recorte: o.recorte && o.proporcao !== 'livre' && nat ? maiorRecorte(nat.largura, nat.altura, proporcaoEfetiva(o.proporcao, o.girar + 270)) : o.recorte })}>
          Anti-horário
        </Botao>
        <Botao variante="secundario" icone="girar" onClick={() => mudar({ girar: (o.girar + 90) % 360, recorte: o.recorte && o.proporcao !== 'livre' && nat ? maiorRecorte(nat.largura, nat.altura, proporcaoEfetiva(o.proporcao, o.girar + 90)) : o.recorte })}>
          Horário
        </Botao>
        <Botao variante={o.espelharH ? 'primario' : 'secundario'} icone="espelhar" aria-pressed={o.espelharH} onClick={() => mudar({ espelharH: !o.espelharH })}>
          Espelhar ↔
        </Botao>
        <Botao variante={o.espelharV ? 'primario' : 'secundario'} icone="espelhar" className="[&>svg]:rotate-90" aria-pressed={o.espelharV} onClick={() => mudar({ espelharV: !o.espelharV })}>
          Espelhar ↕
        </Botao>
      </div>
    )
  }
  if (aba === 'tamanho') {
    return (
      <div className="flex flex-col gap-4">
        <Seletor
          valor={o.tamanho}
          aoMudar={m('tamanho')}
          opcoes={[
            { valor: 'original', rotulo: 'Manter o tamanho' },
            { valor: 'porcentagem', rotulo: 'Por porcentagem' },
            { valor: 'medidas', rotulo: 'Largura e altura' },
            { valor: 'lado', rotulo: 'Lado maior' },
            { valor: 'rede', rotulo: 'Tamanho de rede social' },
          ]}
        />
        {o.tamanho === 'porcentagem' ? <Deslizante rotulo="Novo tamanho" valor={o.porcentagem} aoMudar={m('porcentagem')} min={5} max={200} passo={5} formatar={(v) => `${v}%`} /> : null}
        {o.tamanho === 'medidas' ? (
          <>
            <div className="grid grid-cols-2 gap-3">
              <Entrada rotulo="Largura" type="number" min="1" sufixo="px" valor={o.largura} aoMudar={m('largura')} placeholder="auto" />
              <Entrada rotulo="Altura" type="number" min="1" sufixo="px" valor={o.altura} aoMudar={m('altura')} placeholder="auto" />
            </div>
            <p className="text-xs text-fraca">A proporção é mantida: preencha um lado, ou os dois para caber dentro dessa área.</p>
          </>
        ) : null}
        {o.tamanho === 'lado' ? <Entrada rotulo="Lado maior" type="number" min="1" sufixo="px" valor={o.lado} aoMudar={m('lado')} /> : null}
        {o.tamanho === 'rede' ? (
          <>
            <Seletor valor={o.rede} aoMudar={m('rede')} opcoes={REDES.map((r) => ({ valor: r.id, rotulo: `${r.nome} · ${r.w}×${r.h}` }))} />
            <Segmentado
              valor={o.encaixe}
              aoMudar={m('encaixe')}
              opcoes={[
                { valor: 'cobrir', rotulo: 'Cortar sobras' },
                { valor: 'conter', rotulo: 'Com bordas' },
              ]}
            />
            {o.encaixe === 'conter' ? <CorDeFundo valor={o.fundo} aoMudar={m('fundo')} rotulo="Cor das bordas" /> : null}
          </>
        ) : null}
      </div>
    )
  }
  if (aba === 'cores') {
    const a = o.ajustes
    const mudarA = (k) => (v) => mudar({ ajustes: { ...a, [k]: v } })
    const sinal = (v) => `${v - 100 > 0 ? '+' : ''}${v - 100}`
    return (
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-3 gap-1.5">
          {FILTROS.map((f) => {
            const ativo = JSON.stringify(f.ajustes) === JSON.stringify(a)
            return (
              <button key={f.id} type="button" aria-pressed={ativo} onClick={() => mudar({ ajustes: f.ajustes })} className={`rounded-lg border px-2 py-2 text-xs font-semibold transition-colors ${ativo ? 'border-marca bg-marca text-sobre-marca' : 'border-borda text-suave hover:border-borda-forte hover:text-tinta'}`}>
                {f.nome}
              </button>
            )
          })}
        </div>
        <Deslizante rotulo="Brilho" valor={a.brilho} aoMudar={mudarA('brilho')} min={0} max={200} formatar={sinal} />
        <Deslizante rotulo="Contraste" valor={a.contraste} aoMudar={mudarA('contraste')} min={0} max={200} formatar={sinal} />
        <Deslizante rotulo="Saturação" valor={a.saturacao} aoMudar={mudarA('saturacao')} min={0} max={200} formatar={sinal} />
        <Deslizante rotulo="Matiz" valor={a.matiz} aoMudar={mudarA('matiz')} min={-180} max={180} formatar={(v) => `${v}°`} />
        <Deslizante rotulo="Sépia" valor={a.sepia} aoMudar={mudarA('sepia')} formatar={(v) => `${v}%`} />
        <Deslizante rotulo="Preto e branco" valor={a.cinza} aoMudar={mudarA('cinza')} formatar={(v) => `${v}%`} />
        <Deslizante rotulo="Desfoque" valor={a.desfoque} aoMudar={mudarA('desfoque')} min={0} max={20} passo={0.5} formatar={(v) => (v ? v.toLocaleString('pt-BR') : '0')} />
        <Caixa rotulo="Inverter cores (negativo)" marcado={a.inverter} aoMudar={mudarA('inverter')} />
      </div>
    )
  }
  return (
    <div className="flex flex-col gap-4">
      <EscolhaFormato valor={o.formato} aoMudar={m('formato')} comOriginal />
      <Qualidade valor={o.qualidade} aoMudar={m('qualidade')} formato={o.formato} />
      {o.formato === 'jpg' ? <CorDeFundo valor={o.fundo} aoMudar={m('fundo')} /> : null}
      <p className="text-xs text-fraca">Ao salvar, os metadados (EXIF, GPS) saem junto.</p>
    </div>
  )
}

/* ─── Página ────────────────────────────────────────────────────────────── */

function resumo(o) {
  const partes = []
  if (o.recorte) partes.push('recorte')
  if (o.girar) partes.push(`girar ${o.girar}°`)
  if (o.espelharH || o.espelharV) partes.push('espelhar')
  if (o.tamanho !== 'original') partes.push('tamanho')
  if (JSON.stringify(o.ajustes) !== JSON.stringify(NEUTRO)) partes.push('cores')
  if (o.formato !== 'original') partes.push(o.formato.toUpperCase())
  return partes
}

export default function EditorImagem() {
  const [arquivos, setArquivos] = useState([])
  const [selecionado, setSelecionado] = useState(0)
  const [o, setO] = useState(INICIAL)
  const [aba, setAba] = useState('recortar')
  const [nat, setNat] = useState(null)
  const tarefa = useTarefa()
  const mudar = (m) => setO((x) => ({ ...x, ...m }))

  if (tarefa.fase === 'pronto') {
    return (
      <Resultados
        itens={tarefa.resultado}
        duracao={tarefa.duracao}
        nomeZip="imagens-editadas.zip"
        aoAjustar={tarefa.reiniciar}
        aoReiniciar={() => {
          setArquivos([])
          setO(INICIAL)
          tarefa.reiniciar()
        }}
      />
    )
  }
  if (!arquivos.length) return <SeletorArquivos arquivos={arquivos} aoMudar={setArquivos} extensoes={EXTENSOES_IMAGEM.filter((e) => e !== 'svg')} descricaoFormatos={DESCRICAO_IMAGEM.replace(', SVG', '')} limiteBytes={LIMITE_IMAGEM} aceitarColar />

  const atual = arquivos[Math.min(selecionado, arquivos.length - 1)].arquivo
  const mudancas = resumo(o)
  const processando = tarefa.fase === 'processando'
  const proporcao = proporcaoEfetiva(o.proporcao, o.girar)
  const escalaRef = o.recorte && proporcao && nat ? o.recorte.w / maiorRecorte(nat.largura, nat.altura, proporcao).w : 1

  const aplicar = () =>
    tarefa.executar(
      (ctx) =>
        processarLote(
          arquivos,
          async (item) => {
            const d = await dimensoes(item.arquivo)
            const recorte = recorteEmPixels(o.recorte, d.largura, d.altura, proporcao, escalaRef)
            let w = recorte ? recorte.largura : d.largura
            let h = recorte ? recorte.altura : d.altura
            if (o.girar % 180) [w, h] = [h, w]
            const formato = o.formato === 'original' ? await formatoOriginal(item.arquivo) : o.formato
            return {
              recorte,
              girar: o.girar,
              espelharH: o.espelharH,
              espelharV: o.espelharV,
              tamanho: calcularTamanho({ largura: w, altura: h }, o),
              ajustes: JSON.stringify(o.ajustes) === JSON.stringify(NEUTRO) ? undefined : o.ajustes,
              nome: trocarExtensao(item.arquivo.name, formato, '-editada'),
              saida: { formato, qualidade: o.qualidade, fundo: o.fundo },
            }
          },
          { ...ctx, rotulo: 'Aplicando' },
        ),
      'Aplicando',
    )

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
      <div className="flex min-w-0 flex-col gap-3">
        <Previa key={atual.name + atual.size} arquivo={atual} o={o} mudar={mudar} recortando={aba === 'recortar'} aoDimensoes={setNat} />
        {arquivos.length > 1 ? (
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {arquivos.map((a, i) => (
              <Miniatura key={a.id} arquivo={a.arquivo} ativo={a.arquivo === atual} aoEscolher={() => setSelecionado(i)} />
            ))}
          </div>
        ) : null}
        <div className={processando ? 'pointer-events-none opacity-60' : ''}>
          <SeletorArquivos arquivos={arquivos} aoMudar={setArquivos} extensoes={EXTENSOES_IMAGEM.filter((e) => e !== 'svg')} descricaoFormatos={DESCRICAO_IMAGEM.replace(', SVG', '')} limiteBytes={LIMITE_IMAGEM} compacto />
        </div>
      </div>

      <aside className="cartao flex flex-col overflow-hidden lg:sticky lg:top-20">
        <div role="tablist" aria-label="Edição" className="grid grid-cols-5 border-b border-borda">
          {ABAS.map((a) => (
            <button
              key={a.id}
              type="button"
              role="tab"
              aria-selected={aba === a.id}
              onClick={() => setAba(a.id)}
              className={`flex flex-col items-center gap-1 px-1 py-2.5 text-[0.6875rem] font-semibold transition-colors ${aba === a.id ? 'bg-superficie-2 text-tinta shadow-[inset_0_-2px_0_var(--color-acento)]' : 'text-suave hover:text-tinta'}`}
            >
              <Icone nome={a.icone} tamanho={17} />
              {a.rotulo}
            </button>
          ))}
        </div>
        <div className={`p-4 ${processando ? 'pointer-events-none opacity-60' : ''}`}>
          <Controles aba={aba} o={o} mudar={mudar} nat={nat} />
        </div>
        <div className="flex flex-col gap-3 border-t border-borda p-4">
          {mudancas.length ? (
            <p className="text-xs text-fraca">
              Vai aplicar: <span className="text-texto">{mudancas.join(' · ')}</span>
              {arquivos.length > 1 ? ` em ${arquivos.length} imagens` : ''}
            </p>
          ) : null}
          {tarefa.fase === 'erro' ? <Aviso tom="erro">{tarefa.mensagem}</Aviso> : null}
          {processando ? (
            <Progresso valor={tarefa.progresso} rotulo={tarefa.rotulo} aoCancelar={tarefa.cancelar} />
          ) : (
            <div className="flex gap-2">
              <Botao variante="secundario" onClick={() => setO(INICIAL)} disabled={!mudancas.length}>
                Desfazer tudo
              </Botao>
              <Botao className="flex-1" icone="check" onClick={aplicar} disabled={!mudancas.length}>
                Aplicar{arquivos.length > 1 ? ` em ${arquivos.length}` : ''}
              </Botao>
            </div>
          )}
        </div>
      </aside>
    </div>
  )
}

function Miniatura({ arquivo, ativo, aoEscolher }) {
  const url = useMemo(() => URL.createObjectURL(arquivo), [arquivo])
  useEffect(() => () => URL.revokeObjectURL(url), [url])
  return (
    <button type="button" onClick={aoEscolher} aria-pressed={ativo} aria-label={arquivo.name} className={`block size-14 shrink-0 overflow-hidden rounded-lg border-2 ${ativo ? 'border-acento' : 'border-transparent opacity-70 hover:opacity-100'}`}>
      <img src={url} alt="" className="size-full object-cover" />
    </button>
  )
}
