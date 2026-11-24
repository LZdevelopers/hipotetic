/**
 * Pincéis do editor de imagem. Cada traço é desenhado num canvas temporário
 * (opaco) e "composto" na camada de desenho com a opacidade e o modo do
 * pincel — assim a opacidade não escurece onde o traço passa duas vezes (como
 * no Photoshop/Photopea). A borracha apaga só a camada de desenho, nunca a foto.
 */

export const PINCEIS = [
  { id: 'pincel', rotulo: 'Pincel', icone: 'caneta', dica: 'Traço redondo; dureza baixa deixa a borda macia.' },
  { id: 'lapis', rotulo: 'Lápis', icone: 'caneta', dica: 'Traço duro e fino, bom para contornos e detalhes.' },
  { id: 'marcador', rotulo: 'Marca-texto', icone: 'marcaTexto', dica: 'Ponta chanfrada e translúcida, que escurece por multiplicação.' },
  { id: 'aerografo', rotulo: 'Aerógrafo', icone: 'gota', dica: 'Spray: segure e passe por cima para encorpar.' },
  { id: 'caligrafia', rotulo: 'Caligrafia', icone: 'assinatura', dica: 'Ponta chata a 45°: o traço engrossa e afina com a direção.' },
  { id: 'linha', rotulo: 'Linha', icone: 'regua', dica: 'Linha reta. Shift: trava em 45°.' },
  { id: 'seta', rotulo: 'Seta', icone: 'setaDireita', dica: 'Seta reta. Shift: trava em 45°.' },
  { id: 'retangulo', rotulo: 'Retângulo', icone: 'moldura', dica: 'Retângulo. Shift: quadrado.' },
  { id: 'elipse', rotulo: 'Elipse', icone: 'selecao', dica: 'Elipse. Shift: círculo.' },
  { id: 'borracha', rotulo: 'Borracha', icone: 'borracha', dica: 'Apaga só o que foi desenhado (a foto não é afetada).' },
]
export const FORMAS = ['linha', 'seta', 'retangulo', 'elipse']

export const PADRAO_PINCEL = { tipo: 'pincel', cor: '#e11d48', tamanho: 24, opacidade: 100, dureza: 85, fluxo: 40, preencher: false }

/** Quais opções cada pincel usa (o painel mostra só essas). */
export const OPCOES_DO_PINCEL = {
  pincel: ['cor', 'tamanho', 'opacidade', 'dureza'],
  lapis: ['cor', 'tamanho', 'opacidade'],
  marcador: ['cor', 'tamanho', 'opacidade'],
  aerografo: ['cor', 'tamanho', 'opacidade', 'fluxo'],
  caligrafia: ['cor', 'tamanho', 'opacidade'],
  linha: ['cor', 'tamanho', 'opacidade'],
  seta: ['cor', 'tamanho', 'opacidade'],
  retangulo: ['cor', 'tamanho', 'opacidade', 'preencher'],
  elipse: ['cor', 'tamanho', 'opacidade', 'preencher'],
  borracha: ['tamanho', 'opacidade', 'dureza'],
}

const travar45 = ([x0, y0], [x, y]) => {
  const ang = Math.round(Math.atan2(y - y0, x - x0) / (Math.PI / 4)) * (Math.PI / 4)
  const dist = Math.hypot(x - x0, y - y0)
  return [x0 + Math.cos(ang) * dist, y0 + Math.sin(ang) * dist]
}

/**
 * Começa um traço na camada `alvo` (canvas). `k`: px do canvas por px da imagem.
 * Devolve { mover(ponto, shift), compor(), terminar() }.
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
    let b = b0
    if ((o.tipo === 'linha' || o.tipo === 'seta') && shift) b = travar45(a, b0)
    if ((o.tipo === 'retangulo' || o.tipo === 'elipse') && shift) {
      const lado = Math.max(Math.abs(b0[0] - a[0]), Math.abs(b0[1] - a[1]))
      b = [a[0] + Math.sign(b0[0] - a[0] || 1) * lado, a[1] + Math.sign(b0[1] - a[1] || 1) * lado]
    }
    t.lineWidth = tam
    t.lineCap = 'round'
    t.lineJoin = 'round'
    t.strokeStyle = o.cor
    t.fillStyle = o.cor
    t.beginPath()
    if (o.tipo === 'linha' || o.tipo === 'seta') {
      t.moveTo(a[0], a[1])
      t.lineTo(b[0], b[1])
      t.stroke()
      if (o.tipo === 'seta') {
        const ang = Math.atan2(b[1] - a[1], b[0] - a[0])
        const ponta = Math.max(tam * 3, 10)
        t.beginPath()
        t.moveTo(b[0], b[1])
        t.lineTo(b[0] - ponta * Math.cos(ang - 0.45), b[1] - ponta * Math.sin(ang - 0.45))
        t.lineTo(b[0] - ponta * Math.cos(ang + 0.45), b[1] - ponta * Math.sin(ang + 0.45))
        t.closePath()
        t.fill()
      }
    } else if (o.tipo === 'retangulo') {
      t.rect(Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1]))
      if (o.preencher) t.fill()
      else t.stroke()
    } else {
      t.ellipse((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, Math.abs(b[0] - a[0]) / 2, Math.abs(b[1] - a[1]) / 2, 0, 0, Math.PI * 2)
      if (o.preencher) t.fill()
      else t.stroke()
    }
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
      if (FORMAS.includes(o.tipo)) {
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
    /** Houve algum ponto? */
    vazio: () => pontos.length === 0,
  }
}
