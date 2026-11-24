/**
 * Ajustes do editor de imagem — a MESMA função gera a prévia (reduzida) e o
 * arquivo final (tamanho real), então o que se vê é o que se baixa.
 *
 * Os de cor (brilho, contraste, saturação, matiz, P&B, sépia, inverter) e o
 * desfoque vêm do núcleo (matriz de cor + desfoque gaussiano). Aqui entram:
 *   exposicao   -100…100  (multiplica a luz: ±1 ponto de exposição)
 *   temperatura -100…100  (mais frio ↔ mais quente)
 *   nitidez     0…100     (máscara de nitidez, raio 1)
 *   vinheta     0…100     (escurece as bordas)
 */
import { aplicarAjustes } from './nucleo'

export const NEUTRO = {
  brilho: 100,
  contraste: 100,
  saturacao: 100,
  matiz: 0,
  cinza: 0,
  sepia: 0,
  inverter: false,
  desfoque: 0,
  exposicao: 0,
  temperatura: 0,
  nitidez: 0,
  vinheta: 0,
}

export const FILTROS = [
  { id: 'original', nome: 'Original', ajustes: NEUTRO },
  { id: 'pb', nome: 'P&B', ajustes: { ...NEUTRO, cinza: 100, contraste: 110 } },
  { id: 'sepia', nome: 'Sépia', ajustes: { ...NEUTRO, sepia: 80, contraste: 95 } },
  { id: 'vintage', nome: 'Vintage', ajustes: { ...NEUTRO, sepia: 35, saturacao: 80, contraste: 90, brilho: 105, vinheta: 35 } },
  { id: 'vivido', nome: 'Vívido', ajustes: { ...NEUTRO, saturacao: 145, contraste: 112, nitidez: 20 } },
  { id: 'suave', nome: 'Suave', ajustes: { ...NEUTRO, saturacao: 75, contraste: 88, brilho: 106 } },
  { id: 'frio', nome: 'Frio', ajustes: { ...NEUTRO, temperatura: -40, saturacao: 92 } },
  { id: 'quente', nome: 'Quente', ajustes: { ...NEUTRO, temperatura: 40, saturacao: 110 } },
  { id: 'dramatico', nome: 'Dramático', ajustes: { ...NEUTRO, contraste: 140, saturacao: 85, brilho: 95, vinheta: 45 } },
  { id: 'nitido', nome: 'Nítido', ajustes: { ...NEUTRO, nitidez: 60, contraste: 106 } },
  { id: 'noir', nome: 'Noir', ajustes: { ...NEUTRO, cinza: 100, contraste: 145, brilho: 96, vinheta: 40 } },
  { id: 'cinema', nome: 'Cinema', ajustes: { ...NEUTRO, temperatura: -18, contraste: 118, saturacao: 88, vinheta: 28 } },
  { id: 'dourado', nome: 'Dourado', ajustes: { ...NEUTRO, temperatura: 55, brilho: 104, saturacao: 115, vinheta: 15 } },
  { id: 'desbotado', nome: 'Desbotado', ajustes: { ...NEUTRO, contraste: 80, brilho: 108, saturacao: 70 } },
  { id: 'pastel', nome: 'Pastel', ajustes: { ...NEUTRO, saturacao: 62, brilho: 112, contraste: 86 } },
  { id: 'lomo', nome: 'Lomo', ajustes: { ...NEUTRO, saturacao: 130, contraste: 125, vinheta: 60 } },
  { id: 'negativo', nome: 'Negativo', ajustes: { ...NEUTRO, inverter: true } },
]

/** Filtro com intensidade 0–1 (mistura entre o neutro e o filtro). */
export function misturarFiltro(ajustes, k) {
  const r = {}
  for (const chave of Object.keys(NEUTRO)) {
    const a = NEUTRO[chave]
    const b = ajustes[chave] ?? a
    r[chave] = typeof a === 'boolean' ? (k >= 0.5 ? b : a) : Math.round((a + (b - a) * k) * 10) / 10
  }
  return r
}

export const ehNeutro = (a) => Object.keys(NEUTRO).every((k) => (a?.[k] ?? NEUTRO[k]) === NEUTRO[k])

/** Aplica tudo e devolve um OffscreenCanvas (a fonte não é alterada). */
export function renderizarAjustes(fonte, a = NEUTRO) {
  const aj = { ...NEUTRO, ...a }
  // Exposição entra no brilho (multiplica a luz).
  const brilho = aj.brilho * 2 ** (aj.exposicao / 100)
  let atual = aplicarAjustes(fonte, { ...aj, brilho })
  if (!aj.temperatura && !aj.nitidez && !aj.vinheta) {
    if (atual !== fonte) return atual
    const c = new OffscreenCanvas(fonte.width, fonte.height)
    c.getContext('2d').drawImage(fonte, 0, 0)
    return c
  }
  if (!(atual instanceof OffscreenCanvas)) {
    const c = new OffscreenCanvas(fonte.width, fonte.height)
    c.getContext('2d').drawImage(atual, 0, 0)
    atual = c
  }
  const ctx = atual.getContext('2d', { willReadFrequently: true })
  const W = atual.width
  const H = atual.height
  const img = ctx.getImageData(0, 0, W, H)
  const d = img.data

  // Nitidez: original + k × (original − desfoque 3×3).
  if (aj.nitidez) {
    const k = (aj.nitidez / 100) * 1.6
    const orig = new Uint8ClampedArray(d)
    for (let y = 1; y < H - 1; y += 1) {
      for (let x = 1; x < W - 1; x += 1) {
        const i = (y * W + x) * 4
        for (let c = 0; c < 3; c += 1) {
          const media =
            (orig[i - 4 * W - 4 + c] + orig[i - 4 * W + c] + orig[i - 4 * W + 4 + c] + orig[i - 4 + c] + orig[i + c] + orig[i + 4 + c] + orig[i + 4 * W - 4 + c] + orig[i + 4 * W + c] + orig[i + 4 * W + 4 + c]) / 9
          d[i + c] = orig[i + c] + k * (orig[i + c] - media)
        }
      }
    }
  }

  const t = aj.temperatura * 0.3
  const v = aj.vinheta / 100
  const cx = W / 2
  const cy = H / 2
  const raio2 = cx * cx + cy * cy
  for (let y = 0; y < H; y += 1) {
    for (let x = 0; x < W; x += 1) {
      const i = (y * W + x) * 4
      if (t) {
        d[i] += t
        d[i + 2] -= t
      }
      if (v) {
        const dx = x - cx
        const dy = y - cy
        const f = 1 - v * Math.min(1, ((dx * dx + dy * dy) / raio2) ** 1.4) * 0.85
        d[i] *= f
        d[i + 1] *= f
        d[i + 2] *= f
      }
    }
  }
  ctx.putImageData(img, 0, 0)
  return atual
}
