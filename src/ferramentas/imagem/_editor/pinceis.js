/**
 * Pincéis do editor de imagem. Cada traço é desenhado num canvas temporário
 * (opaco) e "composto" na camada de desenho com a opacidade e o modo do
 * pincel — assim a opacidade não escurece onde o traço passa duas vezes (como
 * no Photoshop/Photopea). A borracha apaga só a camada de desenho, nunca a foto.
 *
 * Três grupos: traço livre (pincéis), formas geométricas e a borracha.
 */

export const PINCEIS = [
  { id: 'pincel', rotulo: 'Pincel', icone: 'pincel', dica: 'Traço redondo; dureza baixa deixa a borda macia.' },
  { id: 'lapis', rotulo: 'Lápis', icone: 'lapis', dica: 'Traço duro e fino, bom para contornos e detalhes.' },
  { id: 'marcador', rotulo: 'Marca-texto', icone: 'marcaTexto', dica: 'Ponta chanfrada e translúcida, que escurece por multiplicação.' },
  { id: 'aerografo', rotulo: 'Aerógrafo', icone: 'aerografo', dica: 'Spray: segure e passe por cima para encorpar.' },
  { id: 'caligrafia', rotulo: 'Caligrafia', icone: 'caligrafia', dica: 'Ponta chata a 45°: o traço engrossa e afina com a direção.' },
]

export const FORMAS = [
  { id: 'linha', rotulo: 'Linha', icone: 'linha', dica: 'Linha reta. Shift: trava em 45°.' },
  { id: 'seta', rotulo: 'Seta', icone: 'setaReta', dica: 'Seta. Shift: trava em 45°.' },
  { id: 'setaDupla', rotulo: 'Seta dupla', icone: 'setaDupla', dica: 'Seta com ponta nos dois lados. Shift: trava em 45°.' },
  { id: 'retangulo', rotulo: 'Retângulo', icone: 'retangulo', dica: 'Arraste na diagonal. Shift: quadrado.' },
  { id: 'arredondado', rotulo: 'Arredondado', icone: 'retanguloArredondado', dica: 'Retângulo com cantos arredondados. Shift: quadrado.' },
  { id: 'elipse', rotulo: 'Elipse', icone: 'circulo', dica: 'Arraste na diagonal. Shift: círculo.' },
  { id: 'triangulo', rotulo: 'Triângulo', icone: 'triangulo', dica: 'Shift: mesma largura e altura.' },
  { id: 'losango', rotulo: 'Losango', icone: 'losango', dica: 'Shift: mesma largura e altura.' },
  { id: 'poligono', rotulo: 'Polígono', icone: 'hexagono', dica: 'Polígono regular: escolha o número de lados. Shift: regular.' },
  { id: 'estrela', rotulo: 'Estrela', icone: 'estrela', dica: 'Escolha o número de pontas. Shift: regular.' },
  { id: 'balao', rotulo: 'Balão de fala', icone: 'balao', dica: 'Balão com rabinho, para quadrinhos e destaques.' },
  { id: 'coracao', rotulo: 'Coração', icone: 'coracao', dica: 'Shift: mesma largura e altura.' },
]

export const BORRACHA = { id: 'borracha', rotulo: 'Borracha', icone: 'borracha', dica: 'Apaga só o que foi desenhado (a foto e as outras camadas não são afetadas).' }

const IDS_FORMAS = FORMAS.map((f) => f.id)
const LINHAS = ['linha', 'seta', 'setaDupla']
export const ehForma = (tipo) => IDS_FORMAS.includes(tipo)
export const grupoDo = (tipo) => (tipo === 'borracha' ? 'borracha' : ehForma(tipo) ? 'formas' : 'pinceis')
export const infoDo = (tipo) => [...PINCEIS, ...FORMAS, BORRACHA].find((x) => x.id === tipo)

export const PADRAO_PINCEL = {
  tipo: 'pincel',
  cor: '#e11d48',
  tamanho: 24,
  opacidade: 100,
  dureza: 85,
  fluxo: 40,
  // Formas
  estilo: 'contorno', // 'contorno' | 'preenchido' | 'ambos'
  corPreenchimento: '#facc15',
  espessura: 8,
  raio: 25,
  lados: 6,
  pontas: 5,
  tracejado: false,
  // Último usado em cada grupo (para voltar nele ao trocar de grupo)
  ultimoPincel: 'pincel',
  ultimaForma: 'retangulo',
}

/** Quais opções cada pincel usa (o painel mostra só essas). */
export const OPCOES_DO_PINCEL = {
  pincel: ['cor', 'tamanho', 'opacidade', 'dureza'],
  lapis: ['cor', 'tamanho', 'opacidade'],
  marcador: ['cor', 'tamanho', 'opacidade'],
  aerografo: ['cor', 'tamanho', 'opacidade', 'fluxo'],
  caligrafia: ['cor', 'tamanho', 'opacidade'],
  linha: ['cor', 'espessura', 'opacidade', 'tracejado'],
  seta: ['cor', 'espessura', 'opacidade', 'tracejado'],
  setaDupla: ['cor', 'espessura', 'opacidade', 'tracejado'],
  retangulo: ['estilo', 'espessura', 'opacidade', 'tracejado'],
  arredondado: ['estilo', 'espessura', 'raio', 'opacidade', 'tracejado'],
  elipse: ['estilo', 'espessura', 'opacidade', 'tracejado'],
  triangulo: ['estilo', 'espessura', 'opacidade', 'tracejado'],
  losango: ['estilo', 'espessura', 'opacidade', 'tracejado'],
  poligono: ['estilo', 'lados', 'espessura', 'opacidade', 'tracejado'],
  estrela: ['estilo', 'pontas', 'espessura', 'opacidade', 'tracejado'],
  balao: ['estilo', 'espessura', 'opacidade', 'tracejado'],
  coracao: ['estilo', 'espessura', 'opacidade', 'tracejado'],
  borracha: ['tamanho', 'opacidade', 'dureza'],
}

/** Tamanho do cursor (px da imagem) para o tipo atual. */
export const tamanhoDoCursor = (o) => (ehForma(o.tipo) ? 0 : o.tamanho)

const travar45 = ([x0, y0], [x, y]) => {
  const ang = Math.round(Math.atan2(y - y0, x - x0) / (Math.PI / 4)) * (Math.PI / 4)
  const dist = Math.hypot(x - x0, y - y0)
  return [x0 + Math.cos(ang) * dist, y0 + Math.sin(ang) * dist]
}

/** Ponta de seta preenchida em `p`, apontando na direção `ang`. Devolve onde a haste deve parar. */
function pontaDeSeta(ctx, p, ang, esp, comprimento) {
  // A ponta cresce com a espessura, mas não passa de metade da linha.
  const L = Math.min(Math.max(esp * 3.6, 12), comprimento * 0.5)
  const meia = Math.max(L * 0.5, esp * 1.1)
  const [cos, sen] = [Math.cos(ang), Math.sin(ang)]
  const base = [p[0] - cos * L, p[1] - sen * L]
  ctx.beginPath()
  ctx.moveTo(p[0], p[1])
  ctx.lineTo(base[0] - sen * meia, base[1] + cos * meia)
  ctx.lineTo(base[0] + sen * meia, base[1] - cos * meia)
  ctx.closePath()
  ctx.fill()
  // A haste termina um pouco dentro da ponta (sem vazar na frente nem nos lados).
  return [p[0] - cos * L * 0.85, p[1] - sen * L * 0.85]
}

/** Caminho de uma forma fechada dentro da caixa (x, y, w, h). */
function caminhoForma(ctx, tipo, x, y, w, h, o) {
  ctx.beginPath()
  const cx = x + w / 2
  const cy = y + h / 2
  const poli = (pts) => {
    pts.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)))
    ctx.closePath()
  }
  if (tipo === 'retangulo') ctx.rect(x, y, w, h)
  else if (tipo === 'arredondado') ctx.roundRect(x, y, w, h, (Math.min(w, h) / 2) * (o.raio / 100))
  else if (tipo === 'elipse') ctx.ellipse(cx, cy, w / 2, h / 2, 0, 0, Math.PI * 2)
  else if (tipo === 'triangulo')
    poli([
      [cx, y],
      [x + w, y + h],
      [x, y + h],
    ])
  else if (tipo === 'losango')
    poli([
      [cx, y],
      [x + w, cy],
      [cx, y + h],
      [x, cy],
    ])
  else if (tipo === 'poligono' || tipo === 'estrela') {
    const n = tipo === 'poligono' ? Math.max(3, o.lados) : Math.max(3, o.pontas)
    const passos = tipo === 'estrela' ? n * 2 : n
    const pts = []
    for (let i = 0; i < passos; i += 1) {
      const a = -Math.PI / 2 + (i * Math.PI * 2) / passos
      const k = tipo === 'estrela' && i % 2 ? 0.45 : 1
      pts.push([cx + (w / 2) * k * Math.cos(a), cy + (h / 2) * k * Math.sin(a)])
    }
    poli(pts)
  } else if (tipo === 'balao') {
    const bh = h * 0.78
    const r = Math.min(w * 0.22, bh * 0.4)
    ctx.moveTo(x + r, y)
    ctx.lineTo(x + w - r, y)
    ctx.arcTo(x + w, y, x + w, y + r, r)
    ctx.lineTo(x + w, y + bh - r)
    ctx.arcTo(x + w, y + bh, x + w - r, y + bh, r)
    ctx.lineTo(x + w * 0.42, y + bh)
    ctx.lineTo(x + w * 0.2, y + h)
    ctx.lineTo(x + w * 0.28, y + bh)
    ctx.lineTo(x + r, y + bh)
    ctx.arcTo(x, y + bh, x, y + bh - r, r)
    ctx.lineTo(x, y + r)
    ctx.arcTo(x, y, x + r, y, r)
    ctx.closePath()
  } else if (tipo === 'coracao') {
    ctx.moveTo(cx, y + h * 0.3)
    ctx.bezierCurveTo(cx, y, x, y, x, y + h * 0.3)
    ctx.bezierCurveTo(x, y + h * 0.6, cx, y + h * 0.8, cx, y + h)
    ctx.bezierCurveTo(cx, y + h * 0.8, x + w, y + h * 0.6, x + w, y + h * 0.3)
    ctx.bezierCurveTo(x + w, y, cx, y, cx, y + h * 0.3)
    ctx.closePath()
  }
}

/**
 * Começa um traço na camada `alvo` (canvas). `k`: px do canvas por px da imagem.
 * Devolve { mover(ponto, shift), compor(), vazio() }.
 */
export function iniciarTraco(opcoes, alvo, k) {
  const o = { ...PADRAO_PINCEL, ...opcoes }
  const W = alvo.width
  const H = alvo.height
  const foto = new OffscreenCanvas(W, H)
  foto.getContext('2d').drawImage(alvo, 0, 0)
  const temp = new OffscreenCanvas(W, H)
  const t = temp.getContext('2d')
  t.fillStyle = o.cor
  t.strokeStyle = o.cor
  t.lineCap = 'round'
  t.lineJoin = 'round'
  const tam = Math.max(1, o.tamanho * k)
  const esp = Math.max(1, (o.espessura ?? o.tamanho) * k)
  const pontos = []
  let ultimo = null

  // Pincel, lápis, marca-texto e borracha: o traço inteiro é redesenhado como
  // um caminho só, suavizado (curvas pelos pontos médios) — sem "degraus" nem
  // emendas. A borda macia vem de uma sombra desfocada do próprio traço.
  const caminho = () => {
    t.beginPath()
    t.moveTo(pontos[0][0], pontos[0][1])
    if (pontos.length === 1) t.lineTo(pontos[0][0] + 0.01, pontos[0][1])
    for (let i = 1; i < pontos.length - 1; i += 1) {
      const meio = [(pontos[i][0] + pontos[i + 1][0]) / 2, (pontos[i][1] + pontos[i + 1][1]) / 2]
      t.quadraticCurveTo(pontos[i][0], pontos[i][1], meio[0], meio[1])
    }
    if (pontos.length > 1) t.lineTo(pontos.at(-1)[0], pontos.at(-1)[1])
  }
  const tracoContinuo = () => {
    t.clearRect(0, 0, W, H)
    t.save()
    const cor = o.tipo === 'borracha' ? '#000' : o.cor
    t.strokeStyle = cor
    t.lineJoin = 'round'
    t.lineCap = o.tipo === 'marcador' ? 'square' : 'round'
    const macio = (o.tipo === 'pincel' || o.tipo === 'borracha') && o.dureza < 98
    if (macio) {
      // Só a sombra cai no lugar: o traço em si fica fora do canvas.
      const borda = (tam / 2) * (1 - o.dureza / 100)
      const fora = W + H + tam * 4
      t.lineWidth = Math.max(1, tam - borda)
      t.shadowColor = cor
      t.shadowBlur = borda * 1.6
      t.shadowOffsetX = fora
      t.translate(-fora, 0)
    } else t.lineWidth = tam
    caminho()
    t.stroke()
    t.restore()
  }
  const caligrafia = (a, b) => {
    const nib = [(Math.cos(Math.PI / 4) * tam) / 2, (-Math.sin(Math.PI / 4) * tam) / 2]
    t.fillStyle = o.cor
    t.beginPath()
    t.moveTo(a[0] + nib[0], a[1] + nib[1])
    t.lineTo(b[0] + nib[0], b[1] + nib[1])
    t.lineTo(b[0] - nib[0], b[1] - nib[1])
    t.lineTo(a[0] - nib[0], a[1] - nib[1])
    t.closePath()
    t.fill()
    t.lineWidth = Math.max(1, tam * 0.08)
    t.strokeStyle = o.cor
    t.stroke()
  }
  const spray = (p) => {
    const n = Math.max(2, Math.round((o.fluxo / 100) * tam * 0.8))
    const ponto = Math.max(0.6, tam / 45)
    t.fillStyle = o.cor
    for (let i = 0; i < n; i += 1) {
      const ang = Math.random() * Math.PI * 2
      const raio = (tam / 2) * Math.sqrt(Math.random()) * (0.6 + 0.4 * Math.random())
      t.beginPath()
      t.arc(p[0] + Math.cos(ang) * raio, p[1] + Math.sin(ang) * raio, ponto, 0, Math.PI * 2)
      t.fill()
    }
  }
  const forma = (a, b0, shift) => {
    t.clearRect(0, 0, W, H)
    t.save()
    t.lineWidth = esp
    t.strokeStyle = o.cor
    t.fillStyle = o.cor
    if (o.tracejado) t.setLineDash([esp * 2.5, esp * 2])
    if (LINHAS.includes(o.tipo)) {
      const b = shift ? travar45(a, b0) : b0
      const comp = Math.hypot(b[0] - a[0], b[1] - a[1])
      if (comp < 0.5) return t.restore()
      const ang = Math.atan2(b[1] - a[1], b[0] - a[0])
      let ini = a
      let fim = b
      if (o.tipo === 'seta' || o.tipo === 'setaDupla') fim = pontaDeSeta(t, b, ang, esp, comp)
      if (o.tipo === 'setaDupla') ini = pontaDeSeta(t, a, ang + Math.PI, esp, comp)
      t.lineCap = o.tipo === 'linha' ? 'round' : 'butt'
      t.beginPath()
      t.moveTo(ini[0], ini[1])
      t.lineTo(fim[0], fim[1])
      t.stroke()
      return t.restore()
    }
    let b = b0
    if (shift) {
      const lado = Math.max(Math.abs(b0[0] - a[0]), Math.abs(b0[1] - a[1]))
      b = [a[0] + Math.sign(b0[0] - a[0] || 1) * lado, a[1] + Math.sign(b0[1] - a[1] || 1) * lado]
    }
    const x = Math.min(a[0], b[0])
    const y = Math.min(a[1], b[1])
    const w = Math.abs(b[0] - a[0])
    const h = Math.abs(b[1] - a[1])
    if (w < 0.5 && h < 0.5) return t.restore()
    t.lineJoin = o.tipo === 'elipse' || o.tipo === 'coracao' || o.tipo === 'arredondado' || o.tipo === 'balao' ? 'round' : 'miter'
    t.miterLimit = 10
    caminhoForma(t, o.tipo, x, y, w, h, o)
    if (o.estilo !== 'contorno') {
      t.fillStyle = o.estilo === 'ambos' ? o.corPreenchimento : o.cor
      t.fill()
    }
    if (o.estilo !== 'preenchido') t.stroke()
    return t.restore()
  }

  const compor = () => {
    const ctx = alvo.getContext('2d')
    ctx.save()
    ctx.globalCompositeOperation = 'copy'
    ctx.drawImage(foto, 0, 0)
    ctx.globalCompositeOperation = o.tipo === 'borracha' ? 'destination-out' : o.tipo === 'marcador' ? 'multiply' : 'source-over'
    ctx.globalAlpha = (o.opacidade / 100) * (o.tipo === 'marcador' ? 0.6 : 1)
    ctx.drawImage(temp, 0, 0)
    ctx.restore()
  }

  return {
    mover([x, y], shift = false) {
      const p = [x * k, y * k]
      pontos.push(p)
      if (ehForma(o.tipo)) {
        forma(pontos[0], p, shift)
        return
      }
      const a = ultimo ?? p
      if (o.tipo === 'aerografo') spray(p)
      else if (o.tipo === 'caligrafia') caligrafia(a, p)
      else tracoContinuo()
      ultimo = p
    },
    compor,
    /** Houve algum ponto (e, nas formas, algum tamanho)? */
    vazio: () => pontos.length === 0 || (ehForma(o.tipo) && Math.hypot(pontos.at(-1)[0] - pontos[0][0], pontos.at(-1)[1] - pontos[0][1]) < 1),
  }
}
