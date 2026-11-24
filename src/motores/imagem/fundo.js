/**
 * Acabamento do "Remover fundo": a IA devolve uma máscara (alfa) uma vez só;
 * daqui em diante tudo é ajuste ao vivo, sem rodar a IA de novo:
 *   - contorno: encolhe (−) ou expande (+) a borda;
 *   - limpar: tira o "véu" semitransparente que sobra no fundo;
 *   - borda: suaviza (desfoca) a borda;
 *   - fundo: transparente, uma cor ou a própria foto desfocada.
 * As medidas são relativas ao tamanho da imagem: a prévia (reduzida) e o
 * arquivo final (tamanho real) saem iguais.
 */

export const PADRAO_FUNDO = { contorno: 0, limpar: 0, borda: 0, fundo: 'transparente', cor: '#ffffff', desfoque: 20, pincel: null, tamanhoPincel: null, tracos: [] }

const canvas = (w, h) => new OffscreenCanvas(Math.max(1, Math.round(w)), Math.max(1, Math.round(h)))

/* ─── Retoque à mão ────────────────────────────────────────────────────── */

/*
 * Traços do pincel de retoque: { modo: 'recuperar' | 'apagar', tamanho, pontos: [[x, y]…] },
 * em px da imagem. Ficam guardados como desenho (não como pixels): mudar
 * contorno/limpeza refaz a máscara e os traços são redesenhados por cima, na ordem.
 */
const LADO_RETOQUE = 2048 // resolução máxima da máscara retocada

/** Desenha um traço (a partir do ponto `desde`) numa máscara de escala `k` (px da máscara / px da imagem). */
export function desenharTraco(ctx, t, k, desde = 0) {
  const pts = t.pontos
  if (!pts.length) return
  ctx.save()
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

/** Máscara final: a da IA (já refinada) ampliada, com os traços de retoque por cima. */
export function mascaraRetocada(refinada, tracos, W, H) {
  const k = Math.min(1, LADO_RETOQUE / Math.max(W, H))
  const c = canvas(W * k, H * k)
  const ctx = c.getContext('2d')
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(refinada, 0, 0, c.width, c.height)
  for (const t of tracos) desenharTraco(ctx, t, c.width / W)
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
 */
export function comporFundo(fonte, mascara, opcoes = PADRAO_FUNDO) {
  const { borda = 0, fundo = 'transparente', cor = '#ffffff', desfoque = 20 } = opcoes
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
  if (fundo === 'transparente') return sujeito

  const r = canvas(W, H)
  const ctx = r.getContext('2d')
  if (fundo === 'cor') {
    ctx.fillStyle = cor
    ctx.fillRect(0, 0, W, H)
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
