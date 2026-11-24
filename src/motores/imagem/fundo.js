/**
 * Acabamento do "Remover fundo": a IA (ou a pessoa, à mão) define uma máscara
 * (alfa) uma vez só; daqui em diante tudo é ajuste ao vivo:
 *   - contorno: encolhe (−) ou expande (+) a borda;
 *   - limpar: tira o "véu" semitransparente que sobra no fundo;
 *   - borda: suaviza (desfoca) a borda;
 *   - retoque: pincel Recuperar/Apagar e varinha (área de cor parecida);
 *   - fundo: transparente, uma cor, a própria foto desfocada ou outra imagem.
 * As medidas são relativas ao tamanho da imagem: a prévia (reduzida) e o
 * arquivo final (tamanho real) saem iguais.
 */

export const PADRAO_FUNDO = {
  contorno: 0,
  limpar: 0,
  borda: 0,
  fundo: 'transparente',
  cor: '#ffffff',
  desfoque: 20,
  imagem: null, // Blob da imagem de fundo
  desfoqueImagem: 0,
  pincel: null, // null | 'recuperar' | 'apagar' | 'varinha'
  tamanhoPincel: null,
  varinhaAcao: 'apagar',
  tolerancia: 30,
  contiguo: true,
  tracos: [],
  // Remover uma cor (chroma key): some tudo que for parecido com corChave.
  chaveAtiva: false,
  corChave: '#00b140',
  toleranciaChave: 0.15,
  suavidadeChave: 0.08,
}

const canvas = (w, h) => new OffscreenCanvas(Math.max(1, Math.round(w)), Math.max(1, Math.round(h)))

/** Máscara "tudo fica" — o ponto de partida de quem remove o fundo à mão. */
export function mascaraCheia() {
  const c = canvas(8, 8)
  const ctx = c.getContext('2d')
  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, 8, 8)
  return c
}

/* ─── Chroma key (remover uma cor) ─────────────────────────────────────── */

/** Cor da chave em [r, g, b]: 'branco', 'preto' ou um hex (#rrggbb). */
export function rgbDaChave(modo, cor) {
  if (modo === 'preto') return [0, 0, 0]
  if (modo === 'branco' || !cor) return [255, 255, 255]
  const n = parseInt(String(cor).slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

/**
 * Tira (alfa → 0) dos pixels RGBA `d` tudo o que for parecido com `rgb`.
 * `tolerancia` e `suavidade`: 0–1 da maior distância de cor (a suavidade é a
 * faixa de transição, para a borda não ficar serrilhada).
 */
export function tirarCor(d, rgb, tolerancia, suavidade = 0.08) {
  const [r0, g0, b0] = rgb
  const limite = tolerancia * 441
  const suave = Math.max(1, suavidade * 441)
  const l2 = limite * limite
  const s2 = (limite + suave) * (limite + suave)
  for (let i = 0; i < d.length; i += 4) {
    const dr = d[i] - r0
    const dg = d[i + 1] - g0
    const db = d[i + 2] - b0
    const q = dr * dr + dg * dg + db * db
    if (q < l2) d[i + 3] = 0
    else if (q < s2) d[i + 3] = Math.round((d[i + 3] * (Math.sqrt(q) - limite)) / suave)
  }
}

/** Cor (hex) da `fonte` no ponto (x, y), em px da fonte. */
export function corNoPonto(fonte, x, y) {
  const c = canvas(1, 1)
  const ctx = c.getContext('2d', { willReadFrequently: true })
  const sx = Math.min(fonte.width - 1, Math.max(0, Math.floor(x)))
  const sy = Math.min(fonte.height - 1, Math.max(0, Math.floor(y)))
  ctx.drawImage(fonte, sx, sy, 1, 1, 0, 0, 1, 1)
  const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`
}

const chaveCache = new WeakMap() // fonte → { chave, area }
/** Área (alfa) que o chroma key tira da `fonte`, em w×h. */
function areaDaCor(fonte, w, h, { cor, tolerancia, suavidade }) {
  const chave = `${w}x${h}|${cor}|${tolerancia}|${suavidade}`
  const salvo = chaveCache.get(fonte)
  if (salvo?.chave === chave) return salvo.area
  const d = pixelsDa(fonte, w, h)
  const img = new ImageData(w, h)
  const a = img.data
  a.set(d)
  for (let i = 3; i < a.length; i += 4) a[i] = 255
  tirarCor(a, rgbDaChave('cor', cor), tolerancia, suavidade)
  for (let i = 3; i < a.length; i += 4) a[i] = 255 - a[i] // o que sai
  const area = canvas(w, h)
  area.getContext('2d').putImageData(img, 0, 0)
  chaveCache.set(fonte, { chave, area })
  return area
}

/* ─── Varinha (área de cor parecida) ───────────────────────────────────── */

const pixelsCache = new WeakMap() // fonte → { chave, dados }
function pixelsDa(fonte, w, h) {
  const salvo = pixelsCache.get(fonte)
  if (salvo?.chave === `${w}x${h}`) return salvo.dados
  const c = canvas(w, h)
  const ctx = c.getContext('2d', { willReadFrequently: true })
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(fonte, 0, 0, w, h)
  const dados = ctx.getImageData(0, 0, w, h).data
  pixelsCache.set(fonte, { chave: `${w}x${h}`, dados })
  return dados
}

/**
 * Área de cor parecida com a do ponto clicado (alfa 255 onde pega), em w×h.
 * `tolerancia` 0–100 (curva quadrática: fino controle nos valores baixos);
 * `contiguo`: só a área ligada ao clique (senão, a cor em toda a imagem).
 */
export function areaDaVarinha(fonte, w, h, { x, y, tolerancia, contiguo }) {
  const d = pixelsDa(fonte, w, h)
  const sx = Math.min(w - 1, Math.max(0, Math.floor(x)))
  const sy = Math.min(h - 1, Math.max(0, Math.floor(y)))
  const i0 = (sy * w + sx) * 4
  const [r0, g0, b0] = [d[i0], d[i0 + 1], d[i0 + 2]]
  const limite = ((tolerancia * tolerancia) / 100) * 7.65 + 6
  const parecido = (p) => {
    const i = p * 4
    return Math.abs(d[i] - r0) + Math.abs(d[i + 1] - g0) + Math.abs(d[i + 2] - b0) <= limite
  }
  const marcado = new Uint8Array(w * h)
  if (!contiguo) {
    for (let p = 0; p < w * h; p += 1) if (parecido(p)) marcado[p] = 1
  } else {
    // Preenchimento por linhas (scanline), com pilha.
    const pilha = [sy * w + sx]
    while (pilha.length) {
      const p = pilha.pop()
      const yy = Math.floor(p / w)
      let xe = p - yy * w
      while (xe > 0 && !marcado[yy * w + xe - 1] && parecido(yy * w + xe - 1)) xe -= 1
      let acimaAberto = false
      let abaixoAberto = false
      for (let xx = xe; xx < w; xx += 1) {
        const q = yy * w + xx
        if (marcado[q] || !parecido(q)) break
        marcado[q] = 1
        if (yy > 0) {
          const a = q - w
          const ok = !marcado[a] && parecido(a)
          if (ok && !acimaAberto) pilha.push(a)
          acimaAberto = ok
        }
        if (yy < h - 1) {
          const b = q + w
          const ok = !marcado[b] && parecido(b)
          if (ok && !abaixoAberto) pilha.push(b)
          abaixoAberto = ok
        }
      }
    }
  }
  const c = canvas(w, h)
  const ctx = c.getContext('2d')
  const img = ctx.createImageData(w, h)
  for (let p = 0; p < w * h; p += 1) if (marcado[p]) img.data[p * 4 + 3] = 255
  ctx.putImageData(img, 0, 0)
  return c
}

/* ─── Retoque à mão ────────────────────────────────────────────────────── */

/*
 * Traços do retoque, em px da imagem, guardados como desenho (não como pixels):
 * mudar contorno/limpeza refaz a máscara e os traços são redesenhados por cima, na ordem.
 *   pincel:  { modo: 'recuperar' | 'apagar', tamanho, pontos: [[x, y]…] }
 *   varinha: { modo: 'varinha', acao: 'apagar' | 'recuperar', pontos: [[x, y]], tolerancia, contiguo }
 */
const LADO_RETOQUE = 2048 // resolução máxima da máscara retocada
const areasCache = new WeakMap() // traço da varinha → { chave, area }

/**
 * Desenha um traço (a partir do ponto `desde`) numa máscara de escala `k`
 * (px da máscara / px da imagem). A varinha precisa da `fonte` (a foto).
 */
export function desenharTraco(ctx, t, k, desde = 0, fonte = null) {
  const pts = t.pontos
  if (!pts.length) return
  ctx.save()
  if (t.modo === 'varinha') {
    if (!fonte) return ctx.restore()
    const w = ctx.canvas.width
    const h = ctx.canvas.height
    let salvo = areasCache.get(t)
    if (salvo?.chave !== `${w}x${h}` || salvo.fonte !== fonte) {
      salvo = { chave: `${w}x${h}`, fonte, area: areaDaVarinha(fonte, w, h, { x: pts[0][0] * k, y: pts[0][1] * k, tolerancia: t.tolerancia, contiguo: t.contiguo }) }
      areasCache.set(t, salvo)
    }
    ctx.globalCompositeOperation = t.acao === 'recuperar' ? 'source-over' : 'destination-out'
    ctx.drawImage(salvo.area, 0, 0)
    ctx.restore()
    return
  }
  ctx.globalCompositeOperation = t.modo === 'apagar' ? 'destination-out' : 'source-over'
  ctx.strokeStyle = '#000'
  ctx.fillStyle = '#000'
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.lineWidth = Math.max(1, t.tamanho * k)
  if (pts.length === 1) {
    ctx.beginPath()
    ctx.arc(pts[0][0] * k, pts[0][1] * k, Math.max(0.5, (t.tamanho * k) / 2), 0, Math.PI * 2)
    ctx.fill()
  } else {
    const i0 = Math.max(0, desde)
    ctx.beginPath()
    ctx.moveTo(pts[i0][0] * k, pts[i0][1] * k)
    for (let i = i0 + 1; i < pts.length; i += 1) ctx.lineTo(pts[i][0] * k, pts[i][1] * k)
    ctx.stroke()
  }
  ctx.restore()
}

/**
 * Máscara final: a automática (já refinada) ampliada, menos a cor do chroma key
 * (`chave`: { cor, tolerancia, suavidade } ou null), com os traços de retoque por cima.
 */
export function mascaraRetocada(refinada, tracos, W, H, fonte, chave = null) {
  const k = Math.min(1, LADO_RETOQUE / Math.max(W, H))
  const c = canvas(W * k, H * k)
  const ctx = c.getContext('2d')
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(refinada, 0, 0, c.width, c.height)
  if (chave && fonte) {
    ctx.globalCompositeOperation = 'destination-out'
    ctx.drawImage(areaDaCor(fonte, c.width, c.height, chave), 0, 0)
    ctx.globalCompositeOperation = 'source-over'
  }
  for (const t of tracos) desenharTraco(ctx, t, c.width / W, 0, fonte)
  return c
}

/** Prévia do retoque: mostra, apagadinho, o que foi removido (para saber onde pintar). */
export function mostrarRemovido(resultado, fonte, mascara, alfa = 0.35) {
  const W = resultado.width
  const H = resultado.height
  const g = canvas(W, H)
  const gctx = g.getContext('2d')
  gctx.drawImage(fonte, 0, 0, W, H)
  gctx.globalCompositeOperation = 'destination-out'
  gctx.drawImage(mascara, 0, 0, W, H)
  const ctx = resultado.getContext('2d')
  ctx.save()
  ctx.globalCompositeOperation = 'source-over'
  ctx.filter = 'none'
  ctx.globalAlpha = alfa
  ctx.drawImage(g, 0, 0)
  ctx.restore()
  return resultado
}

/** Máscara (alfa, na resolução do modelo) com contorno e limpeza aplicados. */
export function refinarMascara(mascara, { contorno = 0, limpar = 0 } = {}) {
  if (!contorno && !limpar) return mascara
  const w = mascara.width
  const h = mascara.height
  const c = canvas(w, h)
  const ctx = c.getContext('2d', { willReadFrequently: true })
  // Contorno: desfoca e corta no meio-termo — a borda anda ~raio para fora/dentro.
  const raio = (Math.abs(contorno) * Math.max(w, h)) / 400
  if (contorno) ctx.filter = `blur(${raio}px)`
  ctx.drawImage(mascara, 0, 0)
  ctx.filter = 'none'
  const img = ctx.getImageData(0, 0, w, h)
  const d = img.data
  const piso = limpar * 1.2 // até ~120/255: o que for mais fraco que isso vira fundo
  const tabela = new Uint8ClampedArray(256)
  for (let v = 0; v < 256; v += 1) {
    let a = v / 255
    if (contorno > 0) a = Math.min(1, a * 2)
    else if (contorno < 0) a = Math.max(0, a * 2 - 1)
    if (piso) a = Math.max(0, Math.min(1, (a * 255 - piso) / (255 - piso * 1.5)))
    tabela[v] = Math.round(a * 255)
  }
  for (let i = 3; i < d.length; i += 4) d[i] = tabela[d[i]]
  ctx.putImageData(img, 0, 0)
  return c
}

/**
 * Imagem `fonte` com o fundo trocado conforme as opções, no tamanho da fonte.
 * `mascara`: canvas cujo alfa diz o que fica (qualquer resolução).
 * `imagemFundo`: ImageBitmap já decodificado (para o fundo "imagem").
 */
export function comporFundo(fonte, mascara, opcoes = PADRAO_FUNDO, imagemFundo = null) {
  const { borda = 0, fundo = 'transparente', cor = '#ffffff', desfoque = 20, desfoqueImagem = 0 } = opcoes
  const W = fonte.width
  const H = fonte.height
  const escala = Math.max(W, H) / 1000

  // O que fica: a foto recortada pela máscara (ampliada, com a borda suavizada).
  const sujeito = canvas(W, H)
  const sctx = sujeito.getContext('2d')
  sctx.imageSmoothingQuality = 'high'
  sctx.drawImage(fonte, 0, 0, W, H)
  sctx.globalCompositeOperation = 'destination-in'
  if (borda) sctx.filter = `blur(${borda * escala * 0.6}px)`
  sctx.drawImage(mascara, 0, 0, W, H)
  // Devolve o contexto no estado normal (quem usar o canvas depois desenha por cima).
  sctx.globalCompositeOperation = 'source-over'
  sctx.filter = 'none'
  if (fundo === 'transparente' || (fundo === 'imagem' && !imagemFundo)) return sujeito

  const r = canvas(W, H)
  const ctx = r.getContext('2d')
  ctx.imageSmoothingQuality = 'high'
  if (fundo === 'cor') {
    ctx.fillStyle = cor
    ctx.fillRect(0, 0, W, H)
  } else if (fundo === 'imagem') {
    // Cobre o quadro inteiro, centralizada, sem esticar.
    const raio = desfoqueImagem * escala
    const k = Math.max(W / imagemFundo.width, H / imagemFundo.height)
    const w = imagemFundo.width * k + raio * 4
    const h = imagemFundo.height * k + raio * 4
    if (raio) ctx.filter = `blur(${raio}px)`
    ctx.drawImage(imagemFundo, (W - w) / 2, (H - h) / 2, w, h)
    ctx.filter = 'none'
  } else {
    // Foto desfocada atrás. Desfoca só o fundo (sem o recorte), senão a cor do
    // que ficou "vaza" em volta dele; por baixo, a foto inteira desfocada tapa
    // o buraco que sobra atrás do recorte. Ampliada um pouco para a borda do
    // desfoque não escurecer.
    const raio = desfoque * escala
    const so = canvas(W, H)
    const soctx = so.getContext('2d')
    soctx.drawImage(fonte, 0, 0, W, H)
    soctx.globalCompositeOperation = 'destination-out'
    soctx.drawImage(mascara, 0, 0, W, H)
    const [x, y, w, h] = [-raio * 2, -raio * 2, W + raio * 4, H + raio * 4]
    ctx.filter = `blur(${raio}px)`
    ctx.drawImage(fonte, x, y, w, h)
    for (let i = 0; i < 3; i += 1) ctx.drawImage(so, x, y, w, h)
    ctx.filter = 'none'
  }
  ctx.drawImage(sujeito, 0, 0)
  return r
}
