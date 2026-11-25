/**
 * Documento do editor de imagem: a imagem-base (com ajustes/filtros) e, por
 * cima, camadas — as mesmas do editor de vídeo (texto e imagem, ver
 * video/_camada.jsx) mais a camada de desenho (pincel). Posições e tamanhos
 * em frações do quadro (como no vídeo); o tamanho do texto, fração da altura.
 *
 * Aqui ficam: padrões, migração dos projetos antigos, a renderização final
 * (o que vai para o arquivo) e as operações de geometria (recortar, tamanho,
 * girar, espelhar, endireitar), que levam as camadas junto.
 */
import { NEUTRO, renderizarAjustes } from '../../../motores/imagem/ajustes'
import { rgbDaChave, tirarCor } from '../../../motores/imagem/fundo'
import { FONTES, PADRAO_CAMADA, PADRAO_TEXTO, medirTexto, textoParaCanvas } from '../../video/_projeto'
import { cantosPx, desenharDistorcido } from './perspectiva'

let seq = 0
export const novaId = () => `c${Date.now().toString(36)}${(seq += 1)}`

/** Lado maior das camadas de desenho (px): acima disso a camada é guardada reduzida. */
export const LADO_DESENHO = 3000

export const MISTURAS = [
  { valor: 'normal', rotulo: 'Normal' },
  { valor: 'multiply', rotulo: 'Multiplicação' },
  { valor: 'screen', rotulo: 'Divisão (screen)' },
  { valor: 'overlay', rotulo: 'Sobreposição' },
  { valor: 'soft-light', rotulo: 'Luz suave' },
  { valor: 'hard-light', rotulo: 'Luz direta' },
  { valor: 'darken', rotulo: 'Escurecer' },
  { valor: 'lighten', rotulo: 'Clarear' },
  { valor: 'color-dodge', rotulo: 'Subexposição de cor' },
  { valor: 'color-burn', rotulo: 'Superexposição de cor' },
  { valor: 'difference', rotulo: 'Diferença' },
  { valor: 'exclusion', rotulo: 'Exclusão' },
  { valor: 'hue', rotulo: 'Matiz' },
  { valor: 'saturation', rotulo: 'Saturação' },
  { valor: 'color', rotulo: 'Cor' },
  { valor: 'luminosity', rotulo: 'Luminosidade' },
]
const gco = (mistura) => (!mistura || mistura === 'normal' ? 'source-over' : mistura)

export const PADRAO_CAMADA_IMAGEM = { ...PADRAO_CAMADA, opacidade: 1, mistura: 'normal', visivel: true, raio: 0 }

export function novaCamadaTexto(x = 0.25, y = 0.42) {
  return {
    id: novaId(),
    tipo: 'texto',
    nome: 'Texto',
    texto: 'Seu texto',
    x,
    y,
    w: 0.5,
    tamanho: 0.08,
    cor: '#ffffff',
    negrito: true,
    alinhar: 'centro',
    fundo: false,
    corFundo: '#000000',
    opacidadeFundo: 0.6,
    ...PADRAO_CAMADA,
    ...PADRAO_TEXTO,
    opacidade: 1,
    mistura: 'normal',
    visivel: true,
  }
}

export function novaCamadaImagem(arquivo, iw, ih, W, H, nome = 'Imagem') {
  // Até metade do quadro, sem passar do tamanho original, centralizada.
  const k = Math.min(1, (W * 0.5) / iw, (H * 0.5) / ih)
  const w = (iw * k) / W
  const h = (ih * k) / H
  return { id: novaId(), tipo: 'imagem', nome, arquivo, x: (1 - w) / 2, y: (1 - h) / 2, w, h, ...PADRAO_CAMADA_IMAGEM }
}

export function novaCamadaDesenho(n = 1) {
  return { id: novaId(), tipo: 'desenho', nome: `Desenho ${n}`, arquivo: null, opacidade: 1, mistura: 'normal', visivel: true }
}

/** Projeto salvo pela versão antiga (textos soltos em px) → camadas de texto. */
export function migrar(p) {
  if (!p || p.camadas) return p
  const fonteDe = (css = '') => (/jakarta/i.test(css) ? 'jakarta' : /georgia/i.test(css) ? 'georgia' : /mono|consolas/i.test(css) ? 'courier' : /impact/i.test(css) ? 'impact' : 'inter')
  const camadas = (p.textos ?? []).map((t) => ({
    ...novaCamadaTexto(t.x / p.w, t.y / p.h),
    texto: t.texto,
    tamanho: t.tamanho / p.h,
    w: Math.min(0.9, Math.max(0.15, (String(t.texto).length * t.tamanho * 0.6) / p.w)),
    cor: t.cor,
    negrito: t.negrito,
    fonte: fonteDe(t.fonte),
    contorno: t.contorno,
    corContorno: t.corContorno,
    alinhar: 'esquerda',
  }))
  const { textos, ...resto } = p
  return { ...resto, camadas }
}

/** Altura (px) que a camada ocupa no quadro W×H. */
export function alturaCamada(c, W, H) {
  if (c.tipo === 'texto') return medirTexto(c, { w: W, h: H }).altura
  return c.h * H
}

/* ─── Renderização final ───────────────────────────────────────────────── */

const bitmaps = new WeakMap() // Blob → Promise<ImageBitmap>
export function bitmapDe(blob) {
  if (!bitmaps.has(blob)) bitmaps.set(blob, createImageBitmap(blob))
  return bitmaps.get(blob)
}

/** Chroma key da camada: tira a cor (branco, preto ou a escolhida) — mesma conta da prévia. */
function semFundo(bmp, c) {
  const cv = new OffscreenCanvas(bmp.width, bmp.height)
  const ctx = cv.getContext('2d', { willReadFrequently: true })
  ctx.drawImage(bmp, 0, 0)
  const img = ctx.getImageData(0, 0, cv.width, cv.height)
  tirarCor(img.data, rgbDaChave(c.semFundo, c.corChave), c.tolerancia, c.suavidade ?? 0.08)
  ctx.putImageData(img, 0, 0)
  return cv
}

/**
 * O conteúdo "reto" de uma camada de texto ou imagem (sem posição nem giro,
 * com espelho, recorte, cantos, cores e chroma key): { cv, L, A } em px do quadro.
 */
async function conteudoDaCamada(c, W, H) {
  if (c.tipo === 'texto') {
    const { cv, largura, altura } = await textoParaCanvas(c, { w: W, h: H })
    if (!c.espelharH && !c.espelharV) return { cv, L: largura, A: altura }
    const e = new OffscreenCanvas(Math.max(1, cv.width), Math.max(1, cv.height))
    const ectx = e.getContext('2d')
    ectx.translate(c.espelharH ? e.width : 0, c.espelharV ? e.height : 0)
    ectx.scale(c.espelharH ? -1 : 1, c.espelharV ? -1 : 1)
    ectx.drawImage(cv, 0, 0)
    return { cv: e, L: largura, A: altura }
  }
  let fonte = await bitmapDe(c.arquivo)
  if (c.semFundo) fonte = semFundo(fonte, c)
  const L = c.w * W
  const A = c.h * H
  const cv = new OffscreenCanvas(Math.max(1, Math.round(L)), Math.max(1, Math.round(A)))
  const ctx = cv.getContext('2d')
  const kx = cv.width / L
  const ky = cv.height / A
  ctx.setTransform(kx, 0, 0, ky, 0, 0)
  ctx.translate(L / 2, A / 2)
  ctx.scale(c.espelharH ? -1 : 1, c.espelharV ? -1 : 1)
  ctx.beginPath()
  ctx.roundRect(-L / 2, -A / 2, L, A, c.raio ? (c.raio * Math.min(L, A)) / 2 : 0)
  ctx.clip()
  const aj = { brilho: 0, contraste: 1, saturacao: 1, ...c.ajuste }
  ctx.filter = `brightness(${1 + aj.brilho}) contrast(${aj.contraste}) saturate(${aj.saturacao})`
  const r = c.recorte ?? { x: 0, y: 0, w: 1, h: 1 }
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(fonte, -L / 2 - (r.x * L) / r.w, -A / 2 - (r.y * A) / r.h, L / r.w, A / r.h)
  return { cv, L, A }
}

/** Desenha uma camada (imagem, texto ou desenho) no contexto do quadro W×H. */
export async function desenharCamada(ctx, bruta, W, H, desenhos) {
  const c = { ...PADRAO_CAMADA_IMAGEM, ...bruta }
  if (c.visivel === false) return
  if (c.tipo === 'imagem' && !c.arquivo) return
  ctx.save()
  ctx.globalAlpha = c.opacidade ?? 1
  ctx.globalCompositeOperation = gco(c.mistura)
  if (c.tipo === 'desenho') {
    const cv = desenhos?.get(c.id)?.canvas
    if (cv) ctx.drawImage(cv, 0, 0, W, H)
  } else if (c.tipo === 'texto' || c.tipo === 'imagem') {
    const { cv, L, A } = await conteudoDaCamada(c, W, H)
    if (c.cantos) {
      // Distorcida: o conteúdo reto vai para os 4 cantos (malha), e só então entra com opacidade e mesclagem.
      ctx.drawImage(desenharDistorcido(cv, cantosPx(c.cantos, W, H), W, H), 0, 0)
    } else {
      ctx.translate(c.x * W + L / 2, c.y * H + A / 2)
      ctx.rotate(((c.girar ?? 0) * Math.PI) / 180)
      ctx.imageSmoothingQuality = 'high'
      ctx.drawImage(cv, -L / 2, -A / 2, L, A)
    }
  }
  ctx.restore()
}

/** A imagem final no tamanho real: base com ajustes e as camadas por cima, na ordem. */
export async function renderizarDocumento({ base, ajustes, camadas = [], W, H, desenhos, baseOculta = false }) {
  const cv = new OffscreenCanvas(W, H)
  const ctx = cv.getContext('2d')
  if (!baseOculta) ctx.drawImage(renderizarAjustes(base, ajustes ?? NEUTRO), 0, 0, W, H)
  for (const c of camadas) await desenharCamada(ctx, c, W, H, desenhos)
  return cv
}

/* ─── Geometria ────────────────────────────────────────────────────────── */

/*
 * Cada operação é uma transformação afim do quadro antigo (W×H) para o novo
 * (W2×H2): m = [a, b, c, d, e, f], como no setTransform do canvas
 * (x' = a·x + c·y + e; y' = b·x + d·y + f).
 */
export const GEOMETRIA = {
  recorte: (r) => ({ m: [1, 0, 0, 1, -r.x, -r.y], W2: Math.round(r.w), H2: Math.round(r.h) }),
  esticar: (W, H, nw, nh) => ({ m: [nw / W, 0, 0, nh / H, 0, 0], W2: Math.round(nw), H2: Math.round(nh) }),
  // Cobre o novo formato sem esticar (corta as sobras, centralizado).
  cobrir: (W, H, nw, nh) => {
    const k = Math.max(nw / W, nh / H)
    return { m: [k, 0, 0, k, (nw - W * k) / 2, (nh - H * k) / 2], W2: Math.round(nw), H2: Math.round(nh) }
  },
  girar90: (W, H, sentido) => (sentido > 0 ? { m: [0, 1, -1, 0, H, 0], W2: H, H2: W } : { m: [0, -1, 1, 0, 0, W], W2: H, H2: W }),
  espelhar: (W, H, horizontal) => (horizontal ? { m: [-1, 0, 0, 1, W, 0], W2: W, H2: H } : { m: [1, 0, 0, -1, 0, H], W2: W, H2: H }),
  /** Endireitar: gira `ang` graus em torno do centro; o novo quadro (W2×H2) fica centrado. */
  endireitar: (W, H, ang, W2, H2) => {
    const a = (ang * Math.PI) / 180
    const cos = Math.cos(a)
    const sen = Math.sin(a)
    return { m: [cos, sen, -sen, cos, W2 / 2 - (cos * W) / 2 + (sen * H) / 2, H2 / 2 - (sen * W) / 2 - (cos * H) / 2], W2: Math.round(W2), H2: Math.round(H2) }
  },
}

/** Maior retângulo (largura × altura) que cabe dentro da imagem girada em `ang` graus. */
export function maiorDentroGirado(w, h, ang) {
  const a = Math.abs((ang * Math.PI) / 180)
  const sen = Math.sin(a)
  const cos = Math.cos(a)
  if (!sen) return { w, h }
  const ladoLongo = Math.max(w, h)
  const ladoCurto = Math.min(w, h)
  if (ladoCurto <= 2 * sen * cos * ladoLongo || Math.abs(sen - cos) < 1e-10) {
    const x = 0.5 * ladoCurto
    return w >= h ? { w: x / sen, h: x / cos } : { w: x / cos, h: x / sen }
  }
  const cos2 = cos * cos - sen * sen
  return { w: (w * cos - h * sen) / cos2, h: (h * cos - w * sen) / cos2 }
}

/** Caixa que contém a imagem inteira girada (para "expandir" em vez de cortar). */
export function caixaGirada(w, h, ang) {
  const a = Math.abs((ang * Math.PI) / 180)
  return { w: w * Math.cos(a) + h * Math.sin(a), h: w * Math.sin(a) + h * Math.cos(a) }
}

const normalizar = (g) => {
  let x = ((g % 360) + 360) % 360
  if (x > 180) x -= 360
  return Math.round(x * 10) / 10
}

/** Leva uma camada de texto/imagem do quadro antigo para o novo. */
export function transformarCamada(c, { m, W2, H2 }, W, H) {
  const [a, b, cc, d, e, f] = m
  const L = c.w * W
  const A = alturaCamada(c, W, H)
  const cx = c.x * W + L / 2
  const cy = c.y * H + A / 2
  const ncx = a * cx + cc * cy + e
  const ncy = b * cx + d * cy + f
  const sx = Math.hypot(a, b)
  const sy = Math.hypot(cc, d)
  const det = a * d - b * cc
  const theta = (Math.atan2(b, a) * 180) / Math.PI
  const g = c.girar ?? 0
  let { espelharH, espelharV } = c
  let girar
  if (det < 0) {
    // Espelhou: escolhe a forma (flip horizontal ou vertical) que deixa o giro menor.
    const comH = normalizar(theta - g - 180)
    const comV = normalizar(theta - g)
    if (Math.abs(comH) <= Math.abs(comV)) {
      espelharH = !espelharH
      girar = comH
    } else {
      espelharV = !espelharV
      girar = comV
    }
  } else girar = normalizar(theta + g)
  const L2 = L * sx
  const A2 = A * sy
  const patch = { girar, espelharH, espelharV, x: (ncx - L2 / 2) / W2, y: (ncy - A2 / 2) / H2, w: L2 / W2 }
  if (c.tipo === 'texto') patch.tamanho = (c.tamanho * H * Math.sqrt(sx * sy)) / H2
  else patch.h = A2 / H2
  // Distorcida: os cantos vão junto, ponto a ponto (o espelho já está nos cantos: não troca o do conteúdo).
  if (c.cantos) {
    patch.espelharH = c.espelharH
    patch.espelharV = c.espelharV
    patch.cantos = c.cantos.map(([px, py]) => [(a * px * W + cc * py * H + e) / W2, (b * px * W + d * py * H + f) / H2])
  }
  return { ...c, ...patch }
}

/** Canvas de desenho no tamanho guardado para um quadro W×H. */
export function canvasDesenho(W, H) {
  const k = Math.min(1, LADO_DESENHO / Math.max(W, H))
  const cv = document.createElement('canvas')
  cv.width = Math.max(1, Math.round(W * k))
  cv.height = Math.max(1, Math.round(H * k))
  return cv
}

/** Aplica a transformação num canvas de desenho (devolve um novo). */
export function transformarDesenho(antigo, { m, W2, H2 }, W, H) {
  const novo = canvasDesenho(W2, H2)
  const kn = novo.width / W2
  const ctx = novo.getContext('2d')
  ctx.setTransform(kn * m[0], kn * m[1], kn * m[2], kn * m[3], kn * m[4], kn * m[5])
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(antigo, 0, 0, W, H)
  return novo
}

/** Aplica a transformação na imagem-base (devolve o canvas novo). */
export function transformarBase(fonte, { m, W2, H2 }) {
  const cv = new OffscreenCanvas(W2, H2)
  const ctx = cv.getContext('2d')
  ctx.imageSmoothingQuality = 'high'
  ctx.setTransform(...m)
  ctx.drawImage(fonte, 0, 0)
  return cv
}

export { FONTES }
