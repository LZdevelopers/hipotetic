/**
 * Distorção e perspectiva das camadas (o "Transformação livre → Distorcer /
 * Perspectiva" do Photoshop e do Photopea): os 4 cantos da camada vão para
 * onde a pessoa arrastar — encaixar uma logo numa camiseta, numa parede, numa
 * tela inclinada.
 *
 * A camada guarda `cantos`: [[x, y] × 4] em frações do quadro, na ordem
 * superior-esquerdo, superior-direito, inferior-direito, inferior-esquerdo.
 * O conteúdo (a camada "reta", L×A px) é levado ao quadrilátero por uma
 * homografia: na tela, um matrix3d do CSS; no arquivo final, uma malha de
 * triângulos desenhada no canvas.
 */

/** Homografia do quadrado unitário para o quadrilátero `q` (Heckbert): [a, b, c, d, e, f, g, h]. */
function doQuadrado(q) {
  const [[x0, y0], [x1, y1], [x2, y2], [x3, y3]] = q
  const sx = x0 - x1 + x2 - x3
  const sy = y0 - y1 + y2 - y3
  if (Math.abs(sx) < 1e-9 && Math.abs(sy) < 1e-9) return [x1 - x0, x3 - x0, x0, y1 - y0, y3 - y0, y0, 0, 0]
  const dx1 = x1 - x2
  const dx2 = x3 - x2
  const dy1 = y1 - y2
  const dy2 = y3 - y2
  const den = dx1 * dy2 - dx2 * dy1 || 1e-9
  const g = (sx * dy2 - dx2 * sy) / den
  const h = (dx1 * sy - sx * dy1) / den
  return [x1 - x0 + g * x1, x3 - x0 + h * x3, x0, y1 - y0 + g * y1, y3 - y0 + h * y3, y0, g, h]
}

/** Ponto (u, v) do quadrado unitário levado ao quadrilátero. */
function aplicar([a, b, c, d, e, f, g, h], u, v) {
  const w = g * u + h * v + 1
  return [(a * u + b * v + c) / w, (d * u + e * v + f) / w]
}

/** `matrix3d` do CSS que leva um elemento L×A (origem no canto 0 0) ao quadrilátero `q` (px). */
export function matrix3d(L, A, q) {
  const [a, b, c, d, e, f, g, h] = doQuadrado(q)
  const n = (v) => (Number.isFinite(v) ? Number(v.toFixed(8)) : 0)
  return `matrix3d(${[a / L, d / L, 0, g / L, b / A, e / A, 0, h / A, 0, 0, 1, 0, c, f, 0, 1].map(n).join(',')})`
}

/** Os 4 cantos (px do quadro) de uma caixa L×A em (x, y), girada `graus` em volta do centro. */
export function cantosDaCaixa(x, y, L, A, graus = 0) {
  const a = (graus * Math.PI) / 180
  const cx = x + L / 2
  const cy = y + A / 2
  return [
    [-L / 2, -A / 2],
    [L / 2, -A / 2],
    [L / 2, A / 2],
    [-L / 2, A / 2],
  ].map(([dx, dy]) => [cx + dx * Math.cos(a) - dy * Math.sin(a), cy + dx * Math.sin(a) + dy * Math.cos(a)])
}

/** Cantos da camada em px do quadro W×H. */
export const cantosPx = (cantos, W, H) => cantos.map(([x, y]) => [x * W, y * H])

/** Caixa (px) que contém o quadrilátero. */
export function caixaDosCantos(q) {
  const xs = q.map((p) => p[0])
  const ys = q.map((p) => p[1])
  return { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) }
}

/**
 * Arrastar o canto `i` por (dx, dy) em frações. `modo`:
 *   - 'livre': só aquele canto anda (distorcer);
 *   - 'perspectiva': o canto vizinho do mesmo lado anda espelhado — arrastar
 *     um canto de cima para dentro aperta o lado de cima (trapézio).
 */
export function moverCanto(cantos, i, dx, dy, modo = 'livre') {
  const n = cantos.map((p) => [...p])
  n[i][0] += dx
  n[i][1] += dy
  if (modo === 'perspectiva') {
    // Vizinho na horizontal (mesma borda de cima/baixo) e na vertical (mesma borda lateral).
    const horizontal = [1, 0, 3, 2][i]
    const vertical = [3, 2, 1, 0][i]
    if (Math.abs(dx) >= Math.abs(dy)) n[horizontal][0] -= dx
    else n[vertical][1] -= dy
    n[i][Math.abs(dx) >= Math.abs(dy) ? 1 : 0] = cantos[i][Math.abs(dx) >= Math.abs(dy) ? 1 : 0]
  }
  return n
}

/** Transformação afim que leva o triângulo s ao triângulo d (para o setTransform do canvas). */
function afim([s0, s1, s2], [d0, d1, d2]) {
  const den = (s1[0] - s0[0]) * (s2[1] - s0[1]) - (s2[0] - s0[0]) * (s1[1] - s0[1])
  if (!den) return null
  const a = ((d1[0] - d0[0]) * (s2[1] - s0[1]) - (d2[0] - d0[0]) * (s1[1] - s0[1])) / den
  const c = ((d2[0] - d0[0]) * (s1[0] - s0[0]) - (d1[0] - d0[0]) * (s2[0] - s0[0])) / den
  const b = ((d1[1] - d0[1]) * (s2[1] - s0[1]) - (d2[1] - d0[1]) * (s1[1] - s0[1])) / den
  const d = ((d2[1] - d0[1]) * (s1[0] - s0[0]) - (d1[1] - d0[1]) * (s2[0] - s0[0])) / den
  return [a, b, c, d, d0[0] - a * s0[0] - c * s0[1], d0[1] - b * s0[0] - d * s0[1]]
}

/** Aumenta o triângulo um pouco a partir do centro (esconde as emendas da malha). */
function inflar(t, px) {
  const cx = (t[0][0] + t[1][0] + t[2][0]) / 3
  const cy = (t[0][1] + t[1][1] + t[2][1]) / 3
  return t.map(([x, y]) => {
    const d = Math.hypot(x - cx, y - cy) || 1
    return [x + ((x - cx) / d) * px, y + ((y - cy) / d) * px]
  })
}

/**
 * Desenha `fonte` (L×A) distorcida até o quadrilátero `q` (px) num canvas
 * novo `W`×`H` — malha de N×N células, dois triângulos cada, cada triângulo
 * com sua transformação afim (a perspectiva fica certa no limite da malha).
 */
export function desenharDistorcido(fonte, q, W, H, N = 24) {
  const L = fonte.width
  const A = fonte.height
  const hom = doQuadrado(q)
  const cv = new OffscreenCanvas(Math.max(1, Math.round(W)), Math.max(1, Math.round(H)))
  const ctx = cv.getContext('2d')
  ctx.imageSmoothingQuality = 'high'
  const ponto = (i, j) => aplicar(hom, i / N, j / N)
  const origem = (i, j) => [(i / N) * L, (j / N) * A]
  for (let j = 0; j < N; j += 1) {
    for (let i = 0; i < N; i += 1) {
      const tri = [
        [
          [i, j],
          [i + 1, j],
          [i, j + 1],
        ],
        [
          [i + 1, j],
          [i + 1, j + 1],
          [i, j + 1],
        ],
      ]
      for (const t of tri) {
        const s = t.map(([a, b]) => origem(a, b))
        const d = t.map(([a, b]) => ponto(a, b))
        const m = afim(s, d)
        if (!m) continue
        const clip = inflar(d, 0.6)
        ctx.save()
        ctx.beginPath()
        ctx.moveTo(clip[0][0], clip[0][1])
        ctx.lineTo(clip[1][0], clip[1][1])
        ctx.lineTo(clip[2][0], clip[2][1])
        ctx.closePath()
        ctx.clip()
        ctx.setTransform(...m)
        ctx.drawImage(fonte, 0, 0)
        ctx.restore()
      }
    }
  }
  return cv
}
