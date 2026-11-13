/**
 * Projeto do editor de vídeo e a exportação dele.
 *
 * Projeto (p):
 *   clipes:  [{ id, fonte, inicio, fim, velocidade, volume (0–1), mudo }] — em sequência
 *   recorte: null | { x, y, w, h } em frações do quadro (já girado/espelhado)
 *   girar (0/90/180/270), espelhar, cor { brilho, contraste, saturacao }, fadeIn, fadeOut
 *   camadas: [{ id, tipo: 'texto'|'imagem'|'video'|'desfoque', inicio, fim, x, y, w, h, … }]
 *            posição e tamanho em frações do quadro final; a última fica por cima
 *   musica:  null | { fonte, volume, volumeOriginal, repetir }
 *   formato, resolucao (lado menor máximo; 0 = manter), qualidade
 *
 * Fontes (fora do histórico): { [id]: { arquivo, tipo, largura, altura, duracao, temAudio } }
 */
import { executarFfmpeg } from '../../motores/ffmpeg'
import { argsVideoFfmpeg, filtroVelocidadeAudio, processarVideo } from '../../motores/midia'
import { extensaoDe } from '../../nucleo/arquivos'
import { ErroAmigavel } from '../../nucleo/tarefa'

export const duracaoClipe = (c) => Math.max(0.05, (c.fim - c.inicio) / c.velocidade)
export const duracaoTotal = (p) => p.clipes.reduce((s, c) => s + duracaoClipe(c), 0)

/** Onde cada clipe começa na linha do tempo. */
export function iniciosNaLinha(p) {
  const r = []
  let t = 0
  for (const c of p.clipes) {
    r.push(t)
    t += duracaoClipe(c)
  }
  return r
}

/** Tempo da linha → { indice do clipe, tempo dentro do arquivo do clipe }. */
export function localizar(p, t) {
  const inicios = iniciosNaLinha(p)
  for (let i = p.clipes.length - 1; i >= 0; i -= 1) {
    if (t >= inicios[i] - 1e-6) {
      const c = p.clipes[i]
      return { indice: i, local: Math.min(c.fim, c.inicio + (t - inicios[i]) * c.velocidade), inicio: inicios[i] }
    }
  }
  return { indice: 0, local: p.clipes[0]?.inicio ?? 0, inicio: 0 }
}

/**
 * O projeto reduzido ao instante t (um trecho curtinho): o clipe naquele ponto
 * e as camadas visíveis, com a opacidade que têm ali. Usado para salvar o quadro.
 */
export function projetoNoInstante(p, fontes, t) {
  const loc = localizar(p, t)
  const c = p.clipes[loc.indice]
  if (!c) return null
  const passo = 0.12
  const imagem = fontes[c.fonte]?.tipo === 'imagem'
  const clipe = imagem ? { ...c, inicio: 0, fim: passo } : { ...c, inicio: loc.local, fim: Math.min(c.fim, loc.local + passo * c.velocidade) }
  if (!imagem && clipe.fim - clipe.inicio < 0.04) clipe.inicio = Math.max(0, clipe.fim - passo * c.velocidade)
  const camadas = p.camadas
    .filter((k) => t >= k.inicio && t <= k.fim)
    .map((bruta) => {
      const k = { ...PADRAO_CAMADA, ...bruta }
      const fi = k.fadeIn ? Math.min(1, (t - k.inicio) / k.fadeIn) : 1
      const fo = k.fadeOut ? Math.min(1, (k.fim - t) / k.fadeOut) : 1
      return { ...bruta, inicio: 0, fim: passo, fadeIn: 0, fadeOut: 0, opacidade: k.opacidade * Math.max(0, Math.min(fi, fo)), corte: k.tipo === 'video' ? (k.corte ?? 0) + (t - k.inicio) : k.corte, animEntrada: null, animSaida: null }
    })
  return { ...p, clipes: [clipe], camadas, fadeIn: 0, fadeOut: 0, musica: null, formato: 'mp4', resolucao: 0 }
}

/** Quadro "girado" de uma fonte (largura × altura depois de girar). */
export function quadroGirado(f, girar) {
  return girar === 90 || girar === 270 ? { w: f.altura, h: f.largura } : { w: f.largura, h: f.altura }
}

/** Tamanho final (pares): recorte do 1º clipe, limitado pela resolução escolhida. */
export function tamanhoFinal(p, fontes) {
  const base = fontes[p.clipes[0]?.fonte]
  if (!base?.largura) return { w: 1280, h: 720 }
  const q = quadroGirado(base, p.girar)
  const r = p.recorte ?? { x: 0, y: 0, w: 1, h: 1 }
  let w = q.w * r.w
  let h = q.h * r.h
  if (p.resolucao && Math.min(w, h) > p.resolucao) {
    const k = p.resolucao / Math.min(w, h)
    w *= k
    h *= k
  }
  return { w: Math.max(2, Math.round(w / 2) * 2), h: Math.max(2, Math.round(h / 2) * 2) }
}

/**
 * Onde a trilha de áudio toca: começa em `inicio` (linha do tempo), a partir de
 * `corte` no arquivo, por `len` segundos (com loop, o arquivo recomeça do 0).
 */
export function trechoMusica(mu, fonte, T) {
  const inicio = Math.min(Math.max(0, mu.inicio ?? 0), Math.max(0, T - 0.1))
  const corte = Math.max(0, mu.corte ?? 0)
  const dm = fonte?.duracao ?? Infinity
  const max = mu.repetir ? T - inicio : Math.min(dm - corte, T - inicio)
  return { inicio, corte, len: Math.max(0.1, Math.min(mu.duracao ?? Infinity, max)) }
}

/* ─── Animações de entrada e saída das camadas ──────────────────────────── */

export const ANIMACOES = [
  { id: 'baixo', rotulo: 'Deslizar de baixo' },
  { id: 'cima', rotulo: 'Deslizar de cima' },
  { id: 'esquerda', rotulo: 'Deslizar da esquerda' },
  { id: 'direita', rotulo: 'Deslizar da direita' },
  { id: 'zoom', rotulo: 'Zoom' },
]
const DESLIZE = 0.18 // fração do quadro que a camada percorre
const VETOR = { baixo: [0, 1], cima: [0, -1], esquerda: [-1, 0], direita: [1, 0] }
const limitar01 = (x) => Math.min(1, Math.max(0, x))

/**
 * Animação da camada no instante t: deslocamento (px num quadro W×H), escala e
 * opacidade. A entrada desacelera (cúbica) e a saída acelera; a opacidade é
 * linear (igual ao fade do ffmpeg).
 */
export function animacaoNoTempo(cam, t, W, H) {
  let dx = 0
  let dy = 0
  let s = 1
  let a = 1
  const aplicar = (an, p) => {
    const r = (1 - p) ** 3
    const [vx, vy] = VETOR[an.tipo] ?? [0, 0]
    dx += vx * DESLIZE * W * r
    dy += vy * DESLIZE * H * r
    if (an.tipo === 'zoom') s *= 1 - 0.5 * r
    a *= p
  }
  const e = cam.animEntrada
  if (e?.tipo && e.dur > 0) aplicar(e, limitar01((t - cam.inicio) / e.dur))
  const o = cam.animSaida
  if (o?.tipo && o.dur > 0) aplicar(o, limitar01((cam.fim - t) / o.dur))
  return { dx, dy, s, a }
}

/** As mesmas curvas como expressões do ffmpeg (variável t). */
function exprAnimacao(c, W, H) {
  const termos = { dx: [], dy: [], s: [] }
  const fades = []
  const usar = (an, r, fade) => {
    const [vx, vy] = VETOR[an.tipo] ?? [0, 0]
    if (vx) termos.dx.push(`${fixo(vx * DESLIZE * W)}*${r}`)
    if (vy) termos.dy.push(`${fixo(vy * DESLIZE * H)}*${r}`)
    if (an.tipo === 'zoom') termos.s.push(`(1-0.5*${r})`)
    fades.push(fade)
  }
  const e = c.animEntrada
  if (e?.tipo && e.dur > 0) usar(e, `pow(1-clip((t-${fixo(c.inicio)})/${fixo(e.dur)},0,1),3)`, `fade=t=in:st=${fixo(c.inicio)}:d=${fixo(e.dur)}:alpha=1`)
  const o = c.animSaida
  if (o?.tipo && o.dur > 0) usar(o, `pow(1-clip((${fixo(c.fim)}-t)/${fixo(o.dur)},0,1),3)`, `fade=t=out:st=${fixo(Math.max(c.inicio, c.fim - o.dur))}:d=${fixo(o.dur)}:alpha=1`)
  // Ao configurar o filtro o ffmpeg avalia com t indefinido (NaN): aí vale o estado parado.
  const seguro = (expr, parado) => (expr ? `if(isnan(t),${parado},${expr})` : '')
  return { dx: seguro(termos.dx.join('+'), 0), dy: seguro(termos.dy.join('+'), 0), s: seguro(termos.s.join('*'), 1), fades }
}

/** Opções de uma camada que nem toda camada tem (as antigas, por exemplo). */
export const PADRAO_CAMADA = { girar: 0, espelharH: false, espelharV: false, ajuste: { brilho: 0, contraste: 1, saturacao: 1 }, opacidade: 1, fadeIn: 0, fadeOut: 0, recorte: null, semFundo: null, tolerancia: 0.15 }

/* ─── Texto → imagem (a camada de texto vira PNG na exportação) ─────────── */

/** Quebra o texto em linhas que cabem em `largura` (respeitando as quebras do usuário). */
function quebrar(ctx, texto, largura) {
  const linhas = []
  for (const paragrafo of String(texto).split('\n')) {
    let atual = ''
    for (const palavra of paragrafo.split(/\s+/)) {
      const teste = atual ? `${atual} ${palavra}` : palavra
      if (ctx.measureText(teste).width <= largura || !atual) atual = teste
      else {
        linhas.push(atual)
        atual = palavra
      }
    }
    linhas.push(atual)
  }
  return linhas
}

/** Fontes do texto (as duas primeiras vêm com o site; as outras são do sistema). */
export const FONTES = [
  { id: 'inter', rotulo: 'Inter', css: "'Inter Variable', Inter, sans-serif" },
  { id: 'jakarta', rotulo: 'Plus Jakarta Sans', css: "'Plus Jakarta Sans Variable', sans-serif" },
  { id: 'arial', rotulo: 'Arial', css: 'Arial, Helvetica, sans-serif' },
  { id: 'verdana', rotulo: 'Verdana', css: 'Verdana, Geneva, sans-serif' },
  { id: 'trebuchet', rotulo: 'Trebuchet MS', css: "'Trebuchet MS', sans-serif" },
  { id: 'georgia', rotulo: 'Georgia', css: 'Georgia, serif' },
  { id: 'times', rotulo: 'Times New Roman', css: "'Times New Roman', Times, serif" },
  { id: 'courier', rotulo: 'Courier New', css: "'Courier New', Courier, monospace" },
  { id: 'impact', rotulo: 'Impact', css: "Impact, 'Arial Black', sans-serif" },
  { id: 'comic', rotulo: 'Comic Sans MS', css: "'Comic Sans MS', 'Comic Neue', cursive" },
]
export const PADRAO_TEXTO = { fonte: 'inter', italico: false, maiusculas: false, espacamento: 0, contorno: null, corContorno: '#000000', espessuraContorno: 0.12, sombra: false }
export const PADRAO_BLUR = { intensidade: 0.5, forma: 'retangulo', estilo: 'blur' }
/** Quantos blocos o mosaico tem no lado menor da área (mais intenso = menos blocos). */
export const blocosMosaico = (intensidade) => Math.max(3, Math.round(26 - intensidade * 22))
export const PADRAO_AUDIO = { volume: 1, mudo: false, ruido: 'nao', voz: false, normalizar: 'nao', fadeIn: 0, fadeOut: 0 }

/** Estilo de texto compartilhado pela prévia (CSS) e pela exportação (canvas). */
export const estiloTexto = (bruto, alturaQuadro) => {
  const c = { ...PADRAO_TEXTO, ...bruto }
  const tamanho = c.tamanho * alturaQuadro
  const contorno = c.contorno ?? !c.fundo
  return {
    tamanho,
    padding: tamanho * 0.3,
    linha: tamanho * 1.2,
    peso: c.negrito ? 700 : 500,
    estilo: c.italico ? 'italic' : 'normal',
    familia: (FONTES.find((x) => x.id === c.fonte) ?? FONTES[0]).css,
    espacamento: c.espacamento * tamanho,
    contorno: contorno ? Math.max(1, c.espessuraContorno * tamanho) : 0,
    corContorno: c.corContorno,
    sombra: c.sombra,
    texto: c.maiusculas ? String(c.texto ?? '').toUpperCase() : String(c.texto ?? ''),
  }
}

/** Desenha a camada de texto num PNG do tamanho que ela ocupa no quadro final. */
export async function textoParaPng(c, quadro) {
  const e = estiloTexto(c, quadro.h)
  const fonte = `${e.estilo} ${e.peso} ${e.tamanho}px ${e.familia}`
  await document.fonts?.load(fonte).catch(() => {})
  const largura = Math.max(8, Math.round(c.w * quadro.w))
  const medidor = new OffscreenCanvas(1, 1).getContext('2d')
  medidor.font = fonte
  if ('letterSpacing' in medidor) medidor.letterSpacing = `${e.espacamento}px`
  const linhas = quebrar(medidor, e.texto || ' ', largura - e.padding * 2)
  const altura = Math.max(8, Math.round(linhas.length * e.linha + e.padding * 2))
  const cv = new OffscreenCanvas(largura, altura)
  const ctx = cv.getContext('2d')
  if (c.fundo) {
    ctx.fillStyle = c.corFundo
    ctx.globalAlpha = c.opacidadeFundo
    const raio = Math.min(e.tamanho * 0.35, altura / 2)
    ctx.beginPath()
    ctx.roundRect(0, 0, largura, altura, raio)
    ctx.fill()
    ctx.globalAlpha = 1
  }
  ctx.font = fonte
  if ('letterSpacing' in ctx) ctx.letterSpacing = `${e.espacamento}px`
  ctx.fillStyle = c.cor
  ctx.textBaseline = 'middle'
  ctx.textAlign = c.alinhar === 'esquerda' ? 'left' : c.alinhar === 'direita' ? 'right' : 'center'
  const xTexto = c.alinhar === 'esquerda' ? e.padding : c.alinhar === 'direita' ? largura - e.padding : largura / 2
  if (e.sombra) {
    ctx.shadowColor = 'rgba(0,0,0,0.6)'
    ctx.shadowBlur = e.tamanho * 0.18
    ctx.shadowOffsetY = e.tamanho * 0.06
  }
  if (e.contorno) {
    ctx.lineJoin = 'round'
    ctx.lineWidth = e.contorno
    ctx.strokeStyle = e.corContorno
    linhas.forEach((l, i) => ctx.strokeText(l, xTexto, e.padding + e.linha * (i + 0.5)))
    ctx.shadowColor = 'transparent'
  }
  linhas.forEach((l, i) => ctx.fillText(l, xTexto, e.padding + e.linha * (i + 0.5)))
  return { blob: await cv.convertToBlob({ type: 'image/png' }), largura, altura }
}

/** Máscara (branco = desfoca) para o blur em elipse. */
async function mascaraElipse(w, h) {
  const cv = new OffscreenCanvas(w, h)
  const ctx = cv.getContext('2d')
  ctx.fillStyle = '#fff'
  ctx.beginPath()
  ctx.ellipse(w / 2, h / 2, w / 2, h / 2, 0, 0, Math.PI * 2)
  ctx.fill()
  return cv.convertToBlob({ type: 'image/png' })
}

/* ─── Exportação ─────────────────────────────────────────────────────────── */

const par = (n) => Math.max(2, Math.round(n / 2) * 2)

/**
 * Cores com a MESMA conta dos filtros do navegador usados na prévia
 * (CSS brightness → contrast → saturate), em RGB: o que se vê é o que sai.
 */
/* ─── Cor: ajustes, filtros prontos e vinheta ────────────────────────────── */

export const PADRAO_COR = { brilho: 0, contraste: 1, saturacao: 1, temperatura: 0, matiz: 0, sepia: 0, vinheta: 0 }

/** Filtros prontos (cada um é só um conjunto de ajustes — dá para mexer depois). */
export const FILTROS = [
  { id: 'original', rotulo: 'Original', cor: {} },
  { id: 'vivido', rotulo: 'Vívido', cor: { saturacao: 1.45, contraste: 1.15 } },
  { id: 'quente', rotulo: 'Quente', cor: { temperatura: 0.6, saturacao: 1.1 } },
  { id: 'frio', rotulo: 'Frio', cor: { temperatura: -0.6, saturacao: 1.05 } },
  { id: 'cinema', rotulo: 'Cinema', cor: { contraste: 1.2, saturacao: 0.85, temperatura: -0.2, brilho: -0.05, vinheta: 0.6 } },
  { id: 'por-do-sol', rotulo: 'Pôr do sol', cor: { temperatura: 0.8, matiz: -10, saturacao: 1.2 } },
  { id: 'vintage', rotulo: 'Vintage', cor: { sepia: 0.35, saturacao: 0.85, contraste: 0.9, brilho: 0.05, temperatura: 0.3, vinheta: 0.5 } },
  { id: 'desbotado', rotulo: 'Desbotado', cor: { contraste: 0.8, saturacao: 0.7, brilho: 0.08 } },
  { id: 'sepia', rotulo: 'Sépia', cor: { sepia: 0.85, contraste: 1.05 } },
  { id: 'pb', rotulo: 'P&B', cor: { saturacao: 0, contraste: 1.1 } },
  { id: 'noir', rotulo: 'Noir', cor: { saturacao: 0, contraste: 1.4, brilho: -0.05, vinheta: 0.7 } },
]
export const corDoFiltro = (f) => ({ ...PADRAO_COR, ...f.cor })

/**
 * Matriz 3×3 de sépia → matiz → temperatura (nessa ordem), igual às funções
 * sepia() e hue-rotate() do CSS. A prévia usa um feColorMatrix com ela e a
 * exportação um colorchannelmixer: o resultado é o mesmo.
 */
export function matrizCor(bruta) {
  const c = { ...PADRAO_COR, ...bruta }
  if (!c.sepia && !c.matiz && !c.temperatura) return null
  const mul = (A, B) => A.map((l) => [0, 1, 2].map((j) => l[0] * B[0][j] + l[1] * B[1][j] + l[2] * B[2][j]))
  let M = [
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1],
  ]
  if (c.sepia) {
    const a = 1 - c.sepia
    M = mul(
      [
        [0.393 + 0.607 * a, 0.769 - 0.769 * a, 0.189 - 0.189 * a],
        [0.349 - 0.349 * a, 0.686 + 0.314 * a, 0.168 - 0.168 * a],
        [0.272 - 0.272 * a, 0.534 - 0.534 * a, 0.131 + 0.869 * a],
      ],
      M,
    )
  }
  if (c.matiz) {
    const r = (c.matiz * Math.PI) / 180
    const co = Math.cos(r)
    const s = Math.sin(r)
    M = mul(
      [
        [0.213 + co * 0.787 - s * 0.213, 0.715 - co * 0.715 - s * 0.715, 0.072 - co * 0.072 + s * 0.928],
        [0.213 - co * 0.213 + s * 0.143, 0.715 + co * 0.285 + s * 0.14, 0.072 - co * 0.072 - s * 0.283],
        [0.213 - co * 0.213 - s * 0.787, 0.715 - co * 0.715 + s * 0.715, 0.072 + co * 0.928 + s * 0.072],
      ],
      M,
    )
  }
  if (c.temperatura) {
    const k = c.temperatura
    M = mul(
      [
        [1 + 0.18 * k, 0, 0],
        [0, 1 + 0.03 * k, 0],
        [0, 0, 1 - 0.18 * k],
      ],
      M,
    )
  }
  return M
}

/** Vinheta (bordas escuras) como PNG transparente — a prévia e a exportação usam a mesma. */
export async function vinhetaPng(w, h, k) {
  const cv = new OffscreenCanvas(Math.max(2, w), Math.max(2, h))
  const ctx = cv.getContext('2d')
  ctx.translate(w / 2, h / 2)
  ctx.scale(w / 2, h / 2)
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, Math.SQRT2)
  g.addColorStop(0, 'rgba(0,0,0,0)')
  g.addColorStop(0.42, 'rgba(0,0,0,0)')
  g.addColorStop(1, `rgba(0,0,0,${Math.min(1, 0.9 * k)})`)
  ctx.fillStyle = g
  ctx.fillRect(-1, -1, 2, 2)
  return cv.convertToBlob({ type: 'image/png' })
}

function filtrosCor(cor, alfa = false) {
  const { brilho, contraste, saturacao } = { ...PADRAO_COR, ...cor }
  const M = matrizCor(cor)
  if (brilho === 0 && contraste === 1 && saturacao === 1 && !M) return []
  const n = (v) => Number(v.toFixed(4))
  const f = [alfa ? 'format=rgba' : 'format=gbrp']
  const b = 1 + brilho
  if (b !== 1) f.push(`colorchannelmixer=rr=${n(b)}:gg=${n(b)}:bb=${n(b)}`)
  if (contraste !== 1) {
    const e = `clip((val-128)*${n(contraste)}+128,0,255)`
    f.push(`lutrgb=r='${e}':g='${e}':b='${e}'`)
  }
  if (saturacao !== 1) {
    const s = saturacao
    f.push(
      `colorchannelmixer=rr=${n(0.213 + 0.787 * s)}:rg=${n(0.715 - 0.715 * s)}:rb=${n(0.072 - 0.072 * s)}:gr=${n(0.213 - 0.213 * s)}:gg=${n(0.715 + 0.285 * s)}:gb=${n(0.072 - 0.072 * s)}:br=${n(0.213 - 0.213 * s)}:bg=${n(0.715 - 0.715 * s)}:bb=${n(0.072 + 0.928 * s)}`,
    )
  }
  if (M) f.push(`colorchannelmixer=rr=${n(M[0][0])}:rg=${n(M[0][1])}:rb=${n(M[0][2])}:gr=${n(M[1][0])}:gg=${n(M[1][1])}:gb=${n(M[1][2])}:br=${n(M[2][0])}:bg=${n(M[2][1])}:bb=${n(M[2][2])}`)
  return f
}
const fixo = (n) => Number(n.toFixed(3))

/** Projeto simples (1 clipe, sem camadas/efeitos): vai pelo caminho rápido (aceleração do navegador). */
let fontesSimples = () => true
/* ─── Saída: qualidade, tamanho estimado, GIF ─────────────────────────────── */

/** Níveis de qualidade: bits por pixel por quadro (dá um tamanho previsível). */
export const QUALIDADES_VIDEO = [
  { id: 'maxima', rotulo: 'Máxima', bpp: 0.16, dica: 'Quase sem perda. Arquivo grande.' },
  { id: 'alta', rotulo: 'Alta', bpp: 0.1, dica: 'Recomendada para YouTube e redes sociais.' },
  { id: 'media', rotulo: 'Média', bpp: 0.065, dica: 'Boa imagem com bem menos espaço.' },
  { id: 'baixa', rotulo: 'Baixa', bpp: 0.04, dica: 'Para mandar por mensagem.' },
  { id: 'minima', rotulo: 'Mínima', bpp: 0.025, dica: 'O menor arquivo possível.' },
]
export const PADRAO_GIF = { largura: 480, fps: 15, loop: true }
/** GIF só faz sentido em trechos curtos (fica enorme). */
export const MAX_SEGUNDOS_GIF = 30
const MB = 1024 * 1024

export const bitrateAudio = (p) => (p.formato === 'webm' ? 128_000 : 160_000)
/** Bitrate do vídeo (bits/s) para a qualidade escolhida (ou para caber no tamanho pedido). */
export function bitrateVideo(p, quadro, T) {
  if (p.qualidade === 'alvo') return Math.max(120_000, Math.round(((p.alvoMB || 10) * MB * 8 * 0.96) / Math.max(0.1, T) - bitrateAudio(p)))
  const q = QUALIDADES_VIDEO.find((x) => x.id === p.qualidade) ?? QUALIDADES_VIDEO[1]
  return Math.round(Math.max(150_000, quadro.w * quadro.h * (p.fps || 30) * q.bpp))
}
/** Tamanho do GIF final (largura limitada à do vídeo). */
export function quadroGif(p, quadro) {
  const g = { ...PADRAO_GIF, ...p.gif }
  const w = Math.min(g.largura, quadro.w)
  return { w, h: Math.round((w * quadro.h) / quadro.w), fps: g.fps, loop: g.loop }
}
/** Tamanho estimado do arquivo final, em bytes. */
export function estimarBytes(p, fontes, extra = {}) {
  const q = { ...p, ...extra }
  const T = duracaoTotal(q)
  const quadro = tamanhoFinal(q, fontes)
  if (q.formato === 'mp3') return (192_000 * T) / 8
  if (q.formato === 'gif') {
    const g = quadroGif(q, quadro)
    return g.w * g.h * g.fps * T * 0.17
  }
  return ((bitrateVideo(q, quadro, T) + bitrateAudio(q)) * T * 1.02) / 8
}
export const emMB = (bytes) => {
  const v = bytes / MB
  return v >= 100 ? `${Math.round(v)} MB` : v >= 1 ? `${v.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`
}
const MIMES = { mp4: 'video/mp4', mov: 'video/quicktime', mkv: 'video/x-matroska', webm: 'video/webm', gif: 'image/gif', mp3: 'audio/mpeg' }

function simples(p) {
  const [c] = p.clipes
  const cor = p.cor
  const au = { ...PADRAO_AUDIO, ...p.audio }
  const audioPadrao = au.volume === 1 && !au.mudo && au.ruido === 'nao' && !au.voz && au.normalizar === 'nao' && !au.fadeIn && !au.fadeOut
  return p.clipes.length === 1 && fontesSimples(p) && audioPadrao && !p.camadas.length && !p.musica && c.velocidade === 1 && c.volume === 1 && !p.fadeIn && !p.fadeOut && cor.brilho === 0 && cor.contraste === 1 && cor.saturacao === 1 && !matrizCor(cor) && !cor.vinheta
}

function nomeNoFs(id, arquivo) {
  return `f${id}.${extensaoDe(arquivo.name) || 'bin'}`
}

/**
 * Exporta o projeto. Devolve { blob, motor }.
 * ctx: { progresso, sinal }; familia: fonte CSS dos textos.
 */
export async function exportarProjeto(p, fontes, ctx, _familia, opcoes = {}) {
  const soAudio = opcoes.soAudio || p.formato === 'mp3'
  const quadroPng = Boolean(opcoes.quadroPng)
  const gif = p.formato === 'gif'
  if (!p.clipes.length) throw new ErroAmigavel('Adicione pelo menos um vídeo.')
  const T = duracaoTotal(p)
  const quadroVideo = tamanhoFinal(p, fontes)
  const g = gif ? quadroGif(p, quadroVideo) : null
  const quadro = gif ? { w: par(g.w), h: par(g.h) } : quadroVideo
  const fpsSaida = gif ? g.fps : p.fps || 30

  fontesSimples = (pp) => fontes[pp.clipes[0].fonte]?.tipo === 'video'
  if (gif && T > MAX_SEGUNDOS_GIF + 0.05) throw new ErroAmigavel(`GIF só para vídeos de até ${MAX_SEGUNDOS_GIF} segundos.`)
  if (!soAudio && !gif && !quadroPng && simples(p)) {
    const [c] = p.clipes
    const f = fontes[c.fonte]
    const q = quadroGirado(f, p.girar)
    const r = p.recorte
    const recorte = r ? { left: par(r.x * q.w), top: par(r.y * q.h), width: par(r.w * q.w), height: par(r.h * q.h) } : undefined
    const cortou = c.inicio > 0.05 || c.fim < f.duracao - 0.05
    return processarVideo(
      f.arquivo,
      {
        formato: p.formato,
        qualidade: bitrateVideo(p, quadro, T),
        fps: p.fps || undefined,
        girar: p.girar,
        espelhar: p.espelhar,
        recorte,
        largura: quadro.w,
        altura: quadro.h,
        semAudio: c.mudo,
        inicio: cortou ? c.inicio : undefined,
        fim: cortou ? c.fim : undefined,
      },
      ctx,
    )
  }

  const entradas = new Map() // nome no FS → dados
  const args = []
  let n = 0
  const entrada = (nome, dados, antes = []) => {
    if (!entradas.has(nome)) entradas.set(nome, dados)
    args.push(...antes, '-i', nome)
    return n++
  }
  const f = [] // partes do filter_complex
  const { w: W, h: H } = quadro

  // 1. Cada clipe: trecho → velocidade → girar/espelhar → recorte → encaixe no quadro final.
  const giro = p.girar === 90 ? 'transpose=1,' : p.girar === 180 ? 'transpose=1,transpose=1,' : p.girar === 270 ? 'transpose=2,' : ''
  const espelho = p.espelhar ? 'hflip,' : ''
  const r = p.recorte
  const recorte = r ? `crop=trunc(iw*${fixo(r.w)}/2)*2:trunc(ih*${fixo(r.h)}/2)*2:trunc(iw*${fixo(r.x)}):trunc(ih*${fixo(r.y)}),` : ''
  const pares = []
  p.clipes.forEach((c, i) => {
    const fonte = fontes[c.fonte]
    const d = duracaoClipe(c)
    // Imagem como clipe: a foto parada pelo tempo do clipe.
    const ehImagem = fonte.tipo === 'imagem'
    const trecho = c.fim - c.inicio
    const k = entrada(nomeNoFs(c.fonte, fonte.arquivo), fonte.arquivo, ehImagem ? ['-loop', '1', '-framerate', '30', '-t', String(fixo(d))] : ['-ss', String(fixo(c.inicio)), '-t', String(fixo(trecho))])
    f.push(
      `[${k}:v]${ehImagem ? `trim=0:${fixo(d)},setpts=PTS-STARTPTS` : `trim=0:${fixo(trecho)},setpts=(PTS-STARTPTS)/${c.velocidade}`},${giro}${espelho}${recorte}scale=${W}:${H}:force_original_aspect_ratio=decrease,pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2:black,setsar=1,fps=${fpsSaida},format=yuv420p[v${i}]`,
    )
    if (!ehImagem && !gif && fonte.temAudio && !c.mudo && c.volume > 0) {
      f.push(`[${k}:a]atrim=0:${fixo(trecho)},asetpts=PTS-STARTPTS,${c.velocidade !== 1 ? `${filtroVelocidadeAudio(c.velocidade)},` : ''}volume=${c.volume},aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo,apad=whole_dur=${fixo(d)}[a${i}]`)
    } else {
      f.push(`anullsrc=r=48000:cl=stereo,atrim=0:${fixo(d)},aformat=sample_fmts=fltp:channel_layouts=stereo[a${i}]`)
    }
    pares.push(`[v${i}][a${i}]`)
  })
  f.push(`${pares.join('')}concat=n=${p.clipes.length}:v=1:a=1[vc][ac]`)

  // 2. Quadro inteiro: cores e fades.
  let v = 'vc'
  const corQuadro = { ...PADRAO_COR, ...p.cor }
  const efeitos = filtrosCor(corQuadro)
  if (efeitos.length) {
    f.push(`[vc]${efeitos.join(',')},format=yuv420p[vcor]`)
    v = 'vcor'
  }
  // Vinheta: a mesma imagem da prévia, por cima do vídeo (e por baixo das camadas).
  if (corQuadro.vinheta > 0) {
    const k = entrada('vinheta.png', await vinhetaPng(W, H, corQuadro.vinheta), ['-loop', '1', '-framerate', '30', '-t', String(fixo(T + 0.1))])
    f.push(`[${k}:v]format=rgba[vin]`, `[${v}][vin]overlay=0:0:shortest=1,format=yuv420p[vvin]`)
    v = 'vvin'
  }
  const fades = []
  if (p.fadeIn) fades.push(`fade=t=in:st=0:d=${fixo(p.fadeIn)}`)
  if (p.fadeOut) fades.push(`fade=t=out:st=${fixo(Math.max(0, T - p.fadeOut))}:d=${fixo(p.fadeOut)}`)
  if (fades.length) {
    f.push(`[${v}]${fades.join(',')}[vq]`)
    v = 'vq'
  }

  // 3. Camadas, na ordem (a última por cima). Cada uma: recorte → tamanho →
  //    espelho → cores → sem fundo → opacidade → giro → fades, posicionada pelo centro.
  const sons = []
  for (let i = 0; i < p.camadas.length; i += 1) {
    const c = { ...PADRAO_CAMADA, ...p.camadas[i] }
    const quando = `enable='between(t,${fixo(c.inicio)},${fixo(c.fim)})'`
    const saida = `vl${i}`
    if (c.tipo === 'desfoque') {
      const d = { ...PADRAO_BLUR, ...c }
      const cw = Math.min(par(c.w * W), W)
      const ch = Math.min(par(c.h * H), H)
      const x = Math.min(Math.max(0, Math.round(c.x * W)), W - cw)
      const y = Math.min(Math.max(0, Math.round(c.y * H)), H - ch)
      const menor = Math.min(cw, ch)
      let efeito
      if (d.estilo === 'mosaico') {
        // Mosaico: reduz e amplia sem suavizar (blocos). n = blocos no lado menor.
        const nb = blocosMosaico(d.intensidade)
        efeito = `scale=${Math.max(2, Math.round((cw / menor) * nb))}:${Math.max(2, Math.round((ch / menor) * nb))},scale=${cw}:${ch}:flags=neighbor`
      } else {
        const raio = Math.max(2, Math.min(Math.floor(menor / 4) - 1, Math.round((menor / 8) * (0.4 + 1.6 * d.intensidade))))
        efeito = `boxblur=${raio}:${d.intensidade > 0.6 ? 4 : 3}`
      }
      f.push(`[${v}]split[b${i}a][b${i}b]`, `[b${i}b]crop=${cw}:${ch}:${x}:${y},${efeito}[b${i}c]`)
      let borrado = `b${i}c`
      if (d.forma === 'elipse') {
        const m = entrada(`m${c.id}.png`, await mascaraElipse(cw, ch), ['-loop', '1', '-framerate', '30', '-t', String(fixo(T))])
        f.push(`[${m}:v]format=gray,scale=${cw}:${ch}[b${i}m]`, `[b${i}c]format=rgba[b${i}r]`, `[b${i}r][b${i}m]alphamerge[b${i}e]`)
        borrado = `b${i}e`
      }
      f.push(`[b${i}a][${borrado}]overlay=${x}:${y}:${quando}[${saida}]`)
      v = saida
      continue
    }
    let origem
    let alturaPx
    let larguraBase = par(c.w * W)
    const parado = ['-loop', '1', '-framerate', '30', '-t', String(fixo(T))]
    if (c.tipo === 'texto') {
      const png = await textoParaPng(c, quadro)
      origem = `[${entrada(`t${c.id}.png`, png.blob, parado)}:v]`
      alturaPx = png.altura
      larguraBase = png.largura
    } else {
      const fonte = fontes[c.fonte]
      if (!fonte) continue
      alturaPx = par(c.h * H)
      if (c.tipo === 'imagem') origem = `[${entrada(nomeNoFs(c.fonte, fonte.arquivo), fonte.arquivo, parado)}:v]`
      else {
        const corte = c.corte ?? 0
        const d = Math.min(c.fim - c.inicio, (fonte.duracao || Infinity) - corte, c.fim - c.inicio)
        const k = entrada(nomeNoFs(c.fonte, fonte.arquivo), fonte.arquivo, [...(corte ? ['-ss', String(fixo(corte))] : []), '-t', String(fixo(d + 0.1))])
        origem = `[${k}:v]trim=0:${fixo(d)},setpts=PTS-STARTPTS+${fixo(c.inicio)}/TB,`
        if (!gif && fonte.temAudio && c.volume > 0) {
          const atraso = Math.round(c.inicio * 1000)
          f.push(`[${k}:a]atrim=0:${fixo(d)},asetpts=PTS-STARTPTS,volume=${c.volume},aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo,adelay=${atraso}|${atraso}[s${i}]`)
          sons.push(`[s${i}]`)
        }
      }
    }
    const cadeia = []
    if (c.tipo !== 'texto') {
      const r = c.recorte
      if (r && (r.w < 0.999 || r.h < 0.999)) cadeia.push(`crop=trunc(iw*${fixo(r.w)}):trunc(ih*${fixo(r.h)}):trunc(iw*${fixo(r.x)}):trunc(ih*${fixo(r.y)})`)
      cadeia.push(`scale=${par(c.w * W)}:${alturaPx}`)
    }
    if (c.espelharH) cadeia.push('hflip')
    if (c.espelharV) cadeia.push('vflip')
    const cor = c.ajuste
    if (c.tipo !== 'texto') cadeia.push(...filtrosCor(cor, true))
    cadeia.push('format=rgba')
    if (c.tipo !== 'texto' && c.semFundo) cadeia.push(`colorkey=${c.semFundo === 'preto' ? '0x000000' : '0xFFFFFF'}:${fixo(Math.max(0.01, c.tolerancia))}:0.08`)
    if (c.opacidade < 1) cadeia.push(`colorchannelmixer=aa=${fixo(c.opacidade)}`)
    const anim = exprAnimacao(c, W, H)
    if (anim.s) {
      // Zoom: muda o tamanho a cada quadro e volta ao tamanho original com borda transparente.
      // (RGBA forçado: com croma subamostrado o ffmpeg arredonda alturas ímpares e o pad quebra.)
      const S = anim.s
      cadeia.push(`scale=w='max(2,trunc(${larguraBase}*${S}))':h='max(2,trunc(${alturaPx}*${S}))':eval=frame`, 'format=rgba', `pad=${larguraBase}:${alturaPx}:(ow-iw)/2:(oh-ih)/2:color=black@0`, 'format=rgba')
    }
    if (c.girar) {
      const rad = fixo((c.girar * Math.PI) / 180)
      cadeia.push(`rotate=${rad}:c=none:ow=rotw(${rad}):oh=roth(${rad})`)
    }
    if (c.fadeIn) cadeia.push(`fade=t=in:st=${fixo(c.inicio)}:d=${fixo(c.fadeIn)}:alpha=1`)
    if (c.fadeOut) cadeia.push(`fade=t=out:st=${fixo(Math.max(c.inicio, c.fim - c.fadeOut))}:d=${fixo(c.fadeOut)}:alpha=1`)
    cadeia.push(...anim.fades)
    // Posição pelo centro: girar muda o tamanho do retângulo, não o centro.
    const cx = fixo(c.x * W + (c.w * W) / 2)
    const cy = fixo(c.y * H + alturaPx / 2)
    const px = anim.dx ? `'${cx}-overlay_w/2+${anim.dx}'` : `${cx}-overlay_w/2`
    const py = anim.dy ? `'${cy}-overlay_h/2+${anim.dy}'` : `${cy}-overlay_h/2`
    f.push(`${origem}${cadeia.join(',')}[o${i}]`, `[${v}][o${i}]overlay=x=${px}:y=${py}:eof_action=pass:${quando}[${saida}]`)
    v = saida
  }

  // 4. Som: tratamento do áudio original (volume, ruído, voz, fades), trilha
  //    por baixo (com ducking) e normalização do resultado.
  const au = { ...PADRAO_AUDIO, ...p.audio }
  let a = 'ac'
  const efeitosSom = []
  const volume = (au.mudo ? 0 : au.volume) * (p.musica ? p.musica.volumeOriginal : 1)
  if (volume !== 1) efeitosSom.push(`volume=${fixo(volume)}`)
  if (au.ruido !== 'nao') efeitosSom.push('highpass=f=80', `afftdn=nr=${{ leve: 10, medio: 18, forte: 28 }[au.ruido]}:nf=-42:tn=1`)
  if (au.voz) efeitosSom.push('equalizer=f=250:t=q:w=1.2:g=-2,equalizer=f=3500:t=q:w=1.2:g=3', 'acompressor=threshold=-20dB:ratio=3:attack=15:release=250:makeup=2')
  const somIn = Math.max(p.fadeIn, au.fadeIn)
  const somOut = Math.max(p.fadeOut, au.fadeOut)
  if (somIn) efeitosSom.push(`afade=t=in:st=0:d=${fixo(somIn)}`)
  if (somOut) efeitosSom.push(`afade=t=out:st=${fixo(Math.max(0, T - somOut))}:d=${fixo(somOut)}`)
  if (efeitosSom.length) {
    f.push(`[ac]${efeitosSom.join(',')}[aq]`)
    a = 'aq'
  }
  if (p.musica && !gif) {
    const mu = { fadeIn: 0, fadeOut: 0, ducking: false, ...p.musica }
    const fonte = fontes[mu.fonte]
    const { inicio: muIni, corte: muCorte, len: muLen } = trechoMusica(mu, fonte, T)
    const k = entrada(nomeNoFs(mu.fonte, fonte.arquivo), fonte.arquivo, mu.repetir ? ['-stream_loop', '-1'] : [...(muCorte ? ['-ss', String(fixo(muCorte))] : []), '-t', String(fixo(muLen + 0.1))])
    const trechoMus = mu.repetir ? `atrim=start=${fixo(muCorte)}:end=${fixo(muCorte + muLen)}` : `atrim=0:${fixo(muLen)}`
    const saidaMus = mu.fadeOut || Math.min(2, muLen / 4)
    const atrasoMus = Math.round(muIni * 1000)
    f.push(`[${k}:a]${trechoMus},asetpts=PTS-STARTPTS,volume=${fixo(mu.volume)},aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo${mu.fadeIn ? `,afade=t=in:st=0:d=${fixo(mu.fadeIn)}` : ''},afade=t=out:st=${fixo(Math.max(0, muLen - saidaMus))}:d=${fixo(saidaMus)}${atrasoMus ? `,adelay=${atrasoMus}:all=1` : ''}[mus]`)
    if (mu.ducking) {
      // Ducking: a trilha abaixa sozinha quando há fala/som no vídeo.
      f.push(`[${a}]asplit=2[${a}d][${a}k]`, `[mus][${a}k]sidechaincompress=threshold=0.03:ratio=8:attack=20:release=400[musd]`)
      a = `${a}d`
      sons.push('[musd]')
    } else sons.push('[mus]')
  }
  if (sons.length) {
    f.push(`[${a}]${sons.join('')}amix=inputs=${sons.length + 1}:duration=first:dropout_transition=0:normalize=0[am]`)
    a = 'am'
  }
  if (au.normalizar !== 'nao') {
    f.push(`[${a}]loudnorm=I=${au.normalizar === 'podcast' ? -16 : -14}:TP=-1.5:LRA=11,aresample=48000[an]`)
    a = 'an'
  }

  if (soAudio) {
    // Só o som: o vídeo montado é descartado.
    f.push(`[${v}]nullsink`)
    const dados = await executarFfmpeg({
      entradas: [...entradas].map(([nome, d]) => ({ nome, dados: d })),
      args: [...args, '-filter_complex', f.join(';'), '-map', `[${a}]`, '-t', String(fixo(T)), '-c:a', 'libmp3lame', '-b:a', '192k'],
      saida: 'saida.mp3',
      duracao: T,
      aoProgredir: ctx.progresso,
      sinal: ctx.sinal,
      rotulo: 'Exportando o áudio',
    }).catch((erro) => {
      if (erro?.name === 'AbortError') throw erro
      console.error(erro?.log)
      throw new ErroAmigavel('Não foi possível exportar o áudio.')
    })
    return { blob: new Blob([dados], { type: 'audio/mpeg' }), motor: 'webassembly' }
  }

  if (quadroPng) {
    f.push(`[${a}]anullsink`)
    const dados = await executarFfmpeg({
      entradas: [...entradas].map(([nome, d]) => ({ nome, dados: d })),
      args: [...args, '-filter_complex', f.join(';'), '-map', `[${v}]`, '-frames:v', '1', '-update', '1'],
      saida: 'quadro.png',
      aoProgredir: ctx.progresso,
      sinal: ctx.sinal,
      rotulo: 'Gerando a imagem',
    }).catch((erro) => {
      if (erro?.name === 'AbortError') throw erro
      console.error(erro?.log)
      throw new ErroAmigavel('Não foi possível gerar a imagem deste quadro.')
    })
    return { blob: new Blob([dados], { type: 'image/png' }), motor: 'webassembly' }
  }

  if (gif) {
    // 1ª passada: o projeto montado no tamanho do GIF, sem som (o progresso anda de verdade).
    f.push(`[${a}]anullsink`)
    const meio = await executarFfmpeg({
      entradas: [...entradas].map(([nome, d]) => ({ nome, dados: d })),
      args: [...args, '-filter_complex', f.join(';'), '-map', `[${v}]`, '-t', String(fixo(T)), '-an', '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '12', '-pix_fmt', 'yuv420p'],
      saida: 'gif-meio.mp4',
      duracao: T,
      aoProgredir: (x, r) => ctx.progresso(x == null ? null : x * 0.85, x == null ? r : 'Criando o GIF'),
      sinal: ctx.sinal,
      rotulo: 'Criando o GIF',
    }).catch((erro) => {
      if (erro?.name === 'AbortError') throw erro
      console.error(erro?.log)
      throw new ErroAmigavel('Não foi possível criar o GIF.')
    })
    // 2ª passada (arquivo pequeno, rápida): paleta otimizada para as cores do vídeo.
    const dados = await executarFfmpeg({
      entradas: [{ nome: 'gif-meio.mp4', dados: meio }],
      args: ['-i', 'gif-meio.mp4', '-vf', 'split[ga][gb];[ga]palettegen=stats_mode=diff[gp];[gb][gp]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle', '-loop', g.loop ? '0' : '-1'],
      saida: 'saida.gif',
      duracao: T,
      aoProgredir: (x) => ctx.progresso(0.85 + (x ?? 0) * 0.15, 'Otimizando as cores do GIF'),
      sinal: ctx.sinal,
      rotulo: 'Otimizando as cores do GIF',
    }).catch((erro) => {
      if (erro?.name === 'AbortError') throw erro
      console.error(erro?.log)
      throw new ErroAmigavel('Não foi possível criar o GIF.')
    })
    return { blob: new Blob([dados], { type: 'image/gif' }), motor: 'webassembly' }
  }

  const saida = `saida.${p.formato}`
  const dados = await executarFfmpeg({
    entradas: [...entradas].map(([nome, dados]) => ({ nome, dados })),
    args: [...args, '-filter_complex', f.join(';'), '-map', `[${v}]`, '-map', `[${a}]`, '-t', String(fixo(T)), ...argsVideoFfmpeg(p.formato, bitrateVideo(p, quadro, T))],
    saida,
    duracao: T,
    aoProgredir: ctx.progresso,
    sinal: ctx.sinal,
    rotulo: 'Montando o vídeo',
  }).catch((erro) => {
    if (erro?.name === 'AbortError') throw erro
    console.error(erro?.log)
    throw new ErroAmigavel('Não foi possível montar o vídeo. Algum arquivo pode estar corrompido ou usar um codec sem suporte.')
  })
  const mime = MIMES[p.formato] ?? 'video/mp4'
  return { blob: new Blob([dados], { type: mime }), motor: 'webassembly' }
}
