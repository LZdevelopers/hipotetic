/**
 * Pipeline de imagem (roda dentro de um Web Worker, com OffscreenCanvas).
 *
 * Uma "receita" descreve tudo o que fazer com a imagem, na ordem:
 *   recorte → girar/espelhar → redimensionar → ajustes → codificar.
 * Todas as ferramentas de imagem usam esta mesma receita, então um ajuste
 * aqui vale para a plataforma inteira.
 *
 * receita = {
 *   recorte?:   { x, y, largura, altura }            (em pixels da original)
 *   girar?:     0 | 90 | 180 | 270                   (horário)
 *   espelharH?, espelharV?: boolean
 *   tamanho?:   { largura, altura, modo: 'esticar' | 'conter' | 'cobrir', fundo? }
 *   ajustes?:   { brilho, contraste, saturacao, matiz, cinza, sepia, inverter, desfoque }
 *   saida:      { formato: 'jpg'|'png'|'webp'|'avif', qualidade: 1..100,
 *                 fundo?: '#rrggbb' (JPG não tem transparência), otimizar?: boolean,
 *                 semPerdas?: boolean }
 * }
 */

const MIMES = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp', avif: 'image/avif' }

function canvas(largura, altura) {
  const c = new OffscreenCanvas(Math.max(1, Math.round(largura)), Math.max(1, Math.round(altura)))
  return c
}

/** Reduz em etapas de 50%: evita serrilhado em reduções grandes (ex.: 6000 → 300 px). */
function redimensionarSuave(fonte, largura, altura) {
  let atual = fonte
  let w = fonte.width
  let h = fonte.height
  while (w / 2 >= largura && h / 2 >= altura) {
    w = Math.round(w / 2)
    h = Math.round(h / 2)
    const meio = canvas(w, h)
    const ctx = meio.getContext('2d')
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(atual, 0, 0, w, h)
    atual = meio
  }
  const final = canvas(largura, altura)
  const ctx = final.getContext('2d')
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(atual, 0, 0, largura, altura)
  return final
}

function aplicarTamanho(fonte, { largura, altura, modo = 'esticar', fundo }) {
  largura = Math.max(1, Math.round(largura))
  altura = Math.max(1, Math.round(altura))
  if (modo === 'esticar') return redimensionarSuave(fonte, largura, altura)

  const escala = modo === 'cobrir' ? Math.max(largura / fonte.width, altura / fonte.height) : Math.min(largura / fonte.width, altura / fonte.height)
  const w = Math.max(1, Math.round(fonte.width * escala))
  const h = Math.max(1, Math.round(fonte.height * escala))
  const redimensionada = redimensionarSuave(fonte, w, h)
  const final = canvas(largura, altura)
  const ctx = final.getContext('2d')
  if (fundo && fundo !== 'transparente') {
    ctx.fillStyle = fundo
    ctx.fillRect(0, 0, largura, altura)
  }
  ctx.drawImage(redimensionada, Math.round((largura - w) / 2), Math.round((altura - h) / 2))
  return final
}

function aplicarGiro(fonte, graus = 0, espelharH = false, espelharV = false) {
  if (!graus && !espelharH && !espelharV) return fonte
  const deitado = graus === 90 || graus === 270
  const c = canvas(deitado ? fonte.height : fonte.width, deitado ? fonte.width : fonte.height)
  const ctx = c.getContext('2d')
  ctx.translate(c.width / 2, c.height / 2)
  ctx.rotate((graus * Math.PI) / 180)
  ctx.scale(espelharH ? -1 : 1, espelharV ? -1 : 1)
  ctx.drawImage(fonte, -fonte.width / 2, -fonte.height / 2)
  return c
}

/* ─── Ajustes de cor: uma matriz 4×5 (como feColorMatrix), um passe só ───── */

const multiplicar = (a, b) => {
  // a·b para matrizes 4×5 (com a linha implícita [0 0 0 0 1]).
  const r = new Array(20)
  for (let i = 0; i < 4; i += 1) {
    for (let j = 0; j < 5; j += 1) {
      let s = j === 4 ? a[i * 5 + 4] : 0
      for (let k = 0; k < 4; k += 1) s += a[i * 5 + k] * b[k * 5 + j]
      r[i * 5 + j] = s
    }
  }
  return r
}
const IDENT = [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0]

/**
 * Mesma semântica dos filtros CSS (Filter Effects, W3C), na mesma ordem de
 * filtroCss(): a prévia na página usa o CSS e o resultado sai idêntico.
 *   brilho/contraste/saturacao: 0..200 (%; 100 = original)
 *   matiz: −180..180 (graus) · cinza/sepia: 0..100 (%) · inverter: boolean
 */
function matrizDeAjustes({ brilho = 100, contraste = 100, saturacao = 100, matiz = 0, cinza = 0, sepia = 0, inverter = false }) {
  let m = IDENT
  const aplicar = (x) => (m = multiplicar(x, m))
  if (brilho !== 100) {
    const b = brilho / 100
    aplicar([b, 0, 0, 0, 0, 0, b, 0, 0, 0, 0, 0, b, 0, 0, 0, 0, 0, 1, 0])
  }
  if (contraste !== 100) {
    const c = contraste / 100
    const t = 255 * (0.5 - 0.5 * c)
    aplicar([c, 0, 0, 0, t, 0, c, 0, 0, t, 0, 0, c, 0, t, 0, 0, 0, 1, 0])
  }
  if (saturacao !== 100) {
    const v = saturacao / 100
    aplicar([
      0.213 + 0.787 * v, 0.715 - 0.715 * v, 0.072 - 0.072 * v, 0, 0,
      0.213 - 0.213 * v, 0.715 + 0.285 * v, 0.072 - 0.072 * v, 0, 0,
      0.213 - 0.213 * v, 0.715 - 0.715 * v, 0.072 + 0.928 * v, 0, 0,
      0, 0, 0, 1, 0,
    ])
  }
  if (cinza) {
    const g = 1 - Math.min(cinza, 100) / 100
    aplicar([
      0.2126 + 0.7874 * g, 0.7152 - 0.7152 * g, 0.0722 - 0.0722 * g, 0, 0,
      0.2126 - 0.2126 * g, 0.7152 + 0.2848 * g, 0.0722 - 0.0722 * g, 0, 0,
      0.2126 - 0.2126 * g, 0.7152 - 0.7152 * g, 0.0722 + 0.9278 * g, 0, 0,
      0, 0, 0, 1, 0,
    ])
  }
  if (matiz) {
    const a = (matiz * Math.PI) / 180
    const cos = Math.cos(a)
    const sin = Math.sin(a)
    aplicar([
      0.213 + cos * 0.787 - sin * 0.213, 0.715 - cos * 0.715 - sin * 0.715, 0.072 - cos * 0.072 + sin * 0.928, 0, 0,
      0.213 - cos * 0.213 + sin * 0.143, 0.715 + cos * 0.285 + sin * 0.14, 0.072 - cos * 0.072 - sin * 0.283, 0, 0,
      0.213 - cos * 0.213 - sin * 0.787, 0.715 - cos * 0.715 + sin * 0.715, 0.072 + cos * 0.928 + sin * 0.072, 0, 0,
      0, 0, 0, 1, 0,
    ])
  }
  if (sepia) {
    const p = 1 - Math.min(sepia, 100) / 100
    aplicar([
      0.393 + 0.607 * p, 0.769 - 0.769 * p, 0.189 - 0.189 * p, 0, 0,
      0.349 - 0.349 * p, 0.686 + 0.314 * p, 0.168 - 0.168 * p, 0, 0,
      0.272 - 0.272 * p, 0.534 - 0.534 * p, 0.131 + 0.869 * p, 0, 0,
      0, 0, 0, 1, 0,
    ])
  }
  if (inverter) aplicar([-1, 0, 0, 0, 255, 0, -1, 0, 0, 255, 0, 0, -1, 0, 255, 0, 0, 0, 1, 0])
  return m === IDENT ? null : m
}

/**
 * Filtro CSS equivalente (para a prévia). `desfoque` é em px por 1000 px do
 * maior lado da imagem, então a prévia reduzida e o arquivo final batem.
 */
export function filtroCss(a, ladoPrevia = 1000) {
  const partes = []
  if (a.brilho != null && a.brilho !== 100) partes.push(`brightness(${a.brilho}%)`)
  if (a.contraste != null && a.contraste !== 100) partes.push(`contrast(${a.contraste}%)`)
  if (a.saturacao != null && a.saturacao !== 100) partes.push(`saturate(${a.saturacao}%)`)
  if (a.cinza) partes.push(`grayscale(${a.cinza}%)`)
  if (a.matiz) partes.push(`hue-rotate(${a.matiz}deg)`)
  if (a.sepia) partes.push(`sepia(${a.sepia}%)`)
  if (a.inverter) partes.push('invert(100%)')
  if (a.desfoque) partes.push(`blur(${((a.desfoque * ladoPrevia) / 1000).toFixed(2)}px)`)
  return partes.join(' ') || 'none'
}

/** Desfoque por caixas (3 passes ≈ gaussiano), separável, em ImageData. */
function desfocar(dados, largura, altura, raio) {
  const r = Math.max(1, Math.round(raio))
  const tmp = new Uint8ClampedArray(dados.length)
  const passe = (orig, dest, horizontal) => {
    const [n, m] = horizontal ? [altura, largura] : [largura, altura]
    for (let linha = 0; linha < n; linha += 1) {
      for (let canal = 0; canal < 4; canal += 1) {
        let soma = 0
        const idx = (i) => {
          const p = Math.min(m - 1, Math.max(0, i))
          return (horizontal ? linha * largura + p : p * largura + linha) * 4 + canal
        }
        for (let i = -r; i <= r; i += 1) soma += orig[idx(i)]
        for (let i = 0; i < m; i += 1) {
          dest[horizontal ? (linha * largura + i) * 4 + canal : (i * largura + linha) * 4 + canal] = soma / (2 * r + 1)
          soma += orig[idx(i + r + 1)] - orig[idx(i - r)]
        }
      }
    }
  }
  for (let k = 0; k < 3; k += 1) {
    passe(dados, tmp, true)
    passe(tmp, dados, false)
  }
}

export function aplicarAjustes(fonte, ajustes) {
  const matriz = matrizDeAjustes(ajustes)
  // sigma (px) do blur() do CSS; 3 caixas de raio r ≈ gaussiano: r = (√(4σ²+1) − 1) / 2
  const sigma = ajustes.desfoque ? (ajustes.desfoque * Math.max(fonte.width, fonte.height)) / 1000 : 0
  const desfoque = sigma ? (Math.sqrt(4 * sigma * sigma + 1) - 1) / 2 : 0
  if (!matriz && !desfoque) return fonte
  const c = canvas(fonte.width, fonte.height)
  const ctx = c.getContext('2d', { willReadFrequently: true })
  ctx.drawImage(fonte, 0, 0)
  const img = ctx.getImageData(0, 0, c.width, c.height)
  const d = img.data
  if (matriz) {
    const m = matriz
    for (let i = 0; i < d.length; i += 4) {
      const r = d[i]
      const g = d[i + 1]
      const b = d[i + 2]
      d[i] = m[0] * r + m[1] * g + m[2] * b + m[4]
      d[i + 1] = m[5] * r + m[6] * g + m[7] * b + m[9]
      d[i + 2] = m[10] * r + m[11] * g + m[12] * b + m[14]
    }
  }
  if (desfoque >= 0.5) desfocar(d, c.width, c.height, desfoque)
  ctx.putImageData(img, 0, 0)
  return c
}

/* ─── Codificação ─────────────────────────────────────────────────────────── */

function comFundo(fonte, cor) {
  const c = canvas(fonte.width, fonte.height)
  const ctx = c.getContext('2d')
  ctx.fillStyle = cor
  ctx.fillRect(0, 0, c.width, c.height)
  ctx.drawImage(fonte, 0, 0)
  return c
}

function imageData(fonte) {
  if (fonte instanceof OffscreenCanvas) return fonte.getContext('2d').getImageData(0, 0, fonte.width, fonte.height)
  const c = canvas(fonte.width, fonte.height)
  const ctx = c.getContext('2d')
  ctx.drawImage(fonte, 0, 0)
  return ctx.getImageData(0, 0, c.width, c.height)
}

export async function codificar(fonte, { formato, qualidade = 85, fundo = '#ffffff', otimizar = false, semPerdas = false }) {
  if (formato === 'jpg') {
    const { default: encode } = await import('@jsquash/jpeg/encode')
    // MozJPEG: arquivos 10–20% menores que o JPEG do navegador na mesma qualidade.
    const dados = await encode(imageData(comFundo(fonte, fundo)), { quality: qualidade })
    return new Blob([dados], { type: MIMES.jpg })
  }
  if (formato === 'avif') {
    const { default: encode } = await import('@jsquash/avif/encode')
    const dados = await encode(imageData(fonte), semPerdas ? { lossless: true } : { quality: qualidade, speed: 7 })
    return new Blob([dados], { type: MIMES.avif })
  }
  if (formato === 'webp') {
    const { default: encode } = await import('@jsquash/webp/encode')
    const dados = await encode(imageData(fonte), semPerdas ? { lossless: 1, quality: 100 } : { quality: qualidade, method: 4 })
    return new Blob([dados], { type: MIMES.webp })
  }
  // PNG: o navegador codifica; OxiPNG recomprime sem perdas quando pedido.
  const c = fonte instanceof OffscreenCanvas ? fonte : (() => {
    const t = canvas(fonte.width, fonte.height)
    t.getContext('2d').drawImage(fonte, 0, 0)
    return t
  })()
  const png = await c.convertToBlob({ type: 'image/png' })
  if (!otimizar) return png
  const { default: optimise } = await import('@jsquash/oxipng/optimise')
  const dados = await optimise(await png.arrayBuffer(), { level: 2 })
  return dados.byteLength < png.size ? new Blob([dados], { type: MIMES.png }) : png
}

/** Executa a receita sobre uma imagem já decodificada (ImageBitmap). */
export async function executarReceita(bitmap, receita) {
  let atual = bitmap
  const r = receita.recorte
  if (r) {
    const c = canvas(r.largura, r.altura)
    c.getContext('2d').drawImage(atual, r.x, r.y, r.largura, r.altura, 0, 0, r.largura, r.altura)
    atual = c
  }
  atual = aplicarGiro(atual, receita.girar ?? 0, receita.espelharH, receita.espelharV)
  if (receita.tamanho) atual = aplicarTamanho(atual, receita.tamanho)
  if (receita.ajustes) atual = aplicarAjustes(atual, receita.ajustes)
  const blob = await codificar(atual, receita.saida)
  return { blob, largura: atual.width, altura: atual.height }
}
