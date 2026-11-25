/**
 * IA do editor de imagem, rodando no navegador (ONNX Runtime Web, WebGPU
 * quando há; senão wasm com várias threads). Nada sai do aparelho: só os
 * modelos são baixados, uma vez, e ficam no cache do navegador.
 *
 *   - Remover fundo, "preciso": BiRefNet lite (MIT), 1024², qualquer objeto.
 *   - Remover fundo, "rápido":  MODNet (Apache-2.0), 512, pessoas e retratos.
 *   - Apagar objeto: LaMa big-lama (Apache-2.0), pesos int4/int8, 512²;
 *     a seleção inteligente do que apagar: SlimSAM (Segment Anything, Apache-2.0).
 *
 * O modelo roda num worker (ia.worker.js): a página não trava e cancelar
 * encerra o worker na hora. Um vigia troca a placa de vídeo pelo processador
 * quando ela falha ou passa do tempo (alguns drivers simplesmente travam).
 */
import { ErroAmigavel } from '../../nucleo/tarefa'

const CACHE = 'hipotetic-modelos-v1'

export const MODELOS = {
  fundo: {
    nome: 'modelo de remover fundo',
    url: 'https://huggingface.co/CoderViking/birefnet-lite-onnx/resolve/main/birefnet-lite-1024.onnx',
    tamanho: 199_681_624,
    // Segundos para rodar: placa de vídeo dedicada; processador com 4 threads (de 2017).
    tempo: { webgpu: 2, wasm: 22 },
  },
  pessoas: {
    nome: 'modelo de remover fundo (pessoas)',
    url: 'https://huggingface.co/Xenova/modnet/resolve/main/onnx/model.onnx',
    tamanho: 25_888_640,
    tempo: { webgpu: 1, wasm: 2 },
  },
  // Seleção de objeto (SlimSAM, Apache-2.0): as duas metades do Segment Anything, leves.
  // A primeira "lê" a imagem uma vez; a segunda acha o objeto em cada traço (décimos de segundo).
  selecaoImagem: {
    nome: 'modelo de seleção inteligente',
    url: 'https://huggingface.co/Xenova/slimsam-77-uniform/resolve/main/onnx/vision_encoder_quantized.onnx',
    tamanho: 8_882_165,
    tempo: { webgpu: 2, wasm: 4 },
    leve: true,
    soProcessador: true, // quantizado: no processador é estável e rápido o bastante
  },
  selecaoObjeto: {
    nome: 'modelo de seleção inteligente',
    url: 'https://huggingface.co/Xenova/slimsam-77-uniform/resolve/main/onnx/prompt_encoder_mask_decoder_quantized.onnx',
    tamanho: 4_903_810,
    tempo: { webgpu: 1, wasm: 1 },
    leve: true,
    soProcessador: true,
  },
  apagar: {
    nome: 'modelo de preenchimento',
    url: 'https://huggingface.co/othytenk/lama-int4-int8/resolve/main/lama_int4_int8_r4.onnx',
    tamanho: 36_931_151,
    opcoes: { extra: { session: { disable_quant_qdq: '1' } } },
    tempo: { webgpu: 2, wasm: 13 },
  },
}

/** Já baixado? (para o botão dizer se vai baixar.) */
export async function modeloNoCache(chave) {
  try {
    return Boolean(await (await caches.open(CACHE)).match(MODELOS[chave].url))
  } catch {
    return false
  }
}

/* ─── Placa de vídeo ou processador ────────────────────────────────────── */

/*
 * WebGPU é bem mais rápida, mas em algumas placas (principalmente as
 * integradas de notebook) o modelo estoura a memória de vídeo, o driver falha
 * ou trava sem dar erro. Aí roda pelo processador e o navegador lembra: nas
 * próximas vezes já vai direto pelo processador neste aparelho. No Firefox a
 * WebGPU ainda trava com esses modelos: vai direto pelo processador.
 */
const SEM_GPU = 'hipotetic:ia-sem-gpu'
const semGpu = () => {
  try {
    return localStorage.getItem(SEM_GPU) === '1'
  } catch {
    return false
  }
}
const marcarSemGpu = () => {
  try {
    localStorage.setItem(SEM_GPU, '1')
  } catch {
    /* sem armazenamento: tenta a placa de novo da próxima vez */
  }
}
const ehFirefox = () => /Firefox\//.test(navigator.userAgent)

/*
 * Placa integrada (Intel, a maioria dos notebooks e PCs de escritório) é a
 * mesma que desenha a tela: com um modelo destes ela fica ocupada e o
 * navegador inteiro congela por dezenas de segundos (medido numa Intel HD 630:
 * 30 s de tela parada para ganhar 8 s). Só vale a pena em placa dedicada ou
 * forte; nas outras, o processador com várias threads e a tela livre.
 */
const FORTES = ['nvidia', 'amd', 'apple']
let epDecidido = null
let epPromessa = null
function escolherEp() {
  if (typeof navigator === 'undefined' || !navigator.gpu || semGpu() || ehFirefox()) return Promise.resolve((epDecidido = 'wasm'))
  epPromessa ??= navigator.gpu
    .requestAdapter({ powerPreference: 'high-performance' })
    .then((a) => {
      const info = a?.info ?? {}
      const forte = a && !a.isFallbackAdapter && !info.isFallbackAdapter && FORTES.includes(String(info.vendor ?? '').toLowerCase())
      return (epDecidido = forte ? 'webgpu' : 'wasm')
    })
    .catch(() => (epDecidido = 'wasm'))
  return epPromessa
}

/** Threads do processador que o worker usa (igual ao ia.worker.js). */
const threads = () => (globalThis.crossOriginIsolated ? Math.max(1, Math.min(8, navigator.hardwareConcurrency || 2)) : 1)

/** Quanto tempo (s) deve levar neste aparelho — para avisar antes (estimativa grosseira). */
export function tempoEstimado(chave, ep = epDecidido) {
  const t = MODELOS[chave].tempo
  if (typeof navigator === 'undefined') return t.wasm
  if (!epDecidido) escolherEp()
  if (ep === 'webgpu') return t.webgpu
  // Medido com 4 threads num processador de 2017; escala com os núcleos.
  return Math.max(t.webgpu, Math.round((t.wasm * 4) / threads()))
}

/** Limites do vigia na placa de vídeo (ms). No processador não há: ele é lento, mas termina. */
const LIMITES_GPU = { preparando: 60_000, rodando: 120_000 }

/* ─── Worker ───────────────────────────────────────────────────────────── */

class Reiniciado extends Error {}

let trabalhador = null
const pendentes = new Map()
let ultimoId = 0

function obterWorker() {
  if (trabalhador) return trabalhador
  trabalhador = new Worker(new URL('./ia.worker.js', import.meta.url), { type: 'module' })
  trabalhador.onmessage = ({ data }) => pendentes.get(data.id)?.mensagem(data)
  trabalhador.onerror = (e) => {
    console.error('IA: o worker caiu.', e)
    encerrar(new Reiniciado('worker caiu'))
  }
  return trabalhador
}

/** Encerra o worker (cancela tudo que estava rodando; a memória volta na hora). */
function encerrar(motivo) {
  trabalhador?.terminate()
  trabalhador = null
  const lista = [...pendentes.values()]
  pendentes.clear()
  for (const p of lista) p.falhar(motivo)
}

function pedir(msg, { sinal, aoProgresso, limites } = {}) {
  return new Promise((resolve, reject) => {
    if (sinal?.aborted) {
      reject(new DOMException('Cancelado', 'AbortError'))
      return
    }
    const id = (ultimoId += 1)
    let relogio = 0
    const armar = (ms, fase) => {
      clearTimeout(relogio)
      if (ms) relogio = setTimeout(() => encerrar(new Reiniciado(`passou do tempo (${fase})`)), ms)
    }
    const abortar = () => encerrar(new DOMException('Cancelado', 'AbortError'))
    const fim = () => {
      clearTimeout(relogio)
      pendentes.delete(id)
      sinal?.removeEventListener('abort', abortar)
    }
    pendentes.set(id, {
      mensagem(m) {
        if (m.tipo === 'progresso') {
          if (m.fase !== 'baixando') armar(limites?.[m.fase], m.fase)
          aoProgresso?.(m)
          return
        }
        fim()
        if (m.tipo === 'pronto') resolve(m)
        else reject(Object.assign(new Error(m.mensagem), { fase: m.fase }))
      },
      falhar(e) {
        fim()
        reject(e)
      },
    })
    sinal?.addEventListener('abort', abortar, { once: true })
    obterWorker().postMessage({ id, ...msg })
  })
}

const descritor = (chave) => ({ chave, url: MODELOS[chave].url, tamanho: MODELOS[chave].tamanho, opcoes: MODELOS[chave].opcoes ?? {}, leve: Boolean(MODELOS[chave].leve) })
/** Onde o modelo roda: os marcados `soProcessador` nunca vão para a placa de vídeo. */
const epDo = async (chave) => (MODELOS[chave].soProcessador ? 'wasm' : escolherEp())

/** Deixa o modelo pronto em segundo plano (só se já estiver baixado). */
export async function prepararModelo(chave) {
  if (!(await modeloNoCache(chave))) return
  const ep = await epDo(chave)
  try {
    await pedir({ tipo: 'preparar', modelo: descritor(chave), ep }, { limites: ep === 'webgpu' ? LIMITES_GPU : null })
  } catch (e) {
    if (ep === 'webgpu' && e?.name !== 'AbortError' && !(e instanceof Reiniciado && e.message === 'worker caiu')) {
      console.warn('IA: a placa de vídeo não abriu o modelo; da próxima vez vai pelo processador.', e)
      marcarSemGpu()
    }
  }
}

/**
 * Roda o modelo no worker. Progresso: 0–85% baixando (só na 1ª vez), depois
 * prepara e roda — enquanto roda, a barra anda sozinha pelo tempo esperado.
 */
async function rodar(chave, entradas, { progresso, sinal, rotulo }) {
  const modelo = descritor(chave)
  let animacao = 0
  const parar = () => clearInterval(animacao)
  const tentar = (ep) =>
    pedir(
      { tipo: 'rodar', modelo, ep, entradas },
      {
        sinal,
        limites: ep === 'webgpu' ? LIMITES_GPU : null,
        aoProgresso: (m) => {
          if (m.fase === 'baixando') progresso?.(m.valor * 0.85, `Baixando o ${MODELOS[chave].nome} (só na primeira vez)`)
          else if (m.fase === 'preparando') progresso?.(0.86, 'Preparando o modelo')
          else if (m.fase === 'rodando') {
            parar()
            const esperado = tempoEstimado(chave, ep)
            const inicio = Date.now()
            const tick = () => progresso?.(0.88 + 0.11 * (1 - Math.exp(-(Date.now() - inicio) / 1000 / esperado)), rotulo)
            tick()
            animacao = setInterval(tick, 200)
          }
        },
      },
    )
  const ep = await epDo(chave)
  try {
    return await tentar(ep)
  } catch (e) {
    parar()
    if (e?.name === 'AbortError') throw e
    if (e?.fase === 'baixando') throw new ErroAmigavel('Não foi possível baixar o modelo. Confira a conexão e tente de novo.')
    if (ep !== 'webgpu') {
      console.error(`IA (${chave}) falhou no processador:`, e)
      throw new ErroAmigavel('Não foi possível processar esta imagem neste aparelho. Feche outras abas e tente de novo.')
    }
    console.warn(`IA (${chave}) falhou na placa de vídeo; indo pelo processador.`, e)
    marcarSemGpu()
    encerrar(new Reiniciado('troca para o processador')) // libera a placa de vídeo
    progresso?.(0.86, 'A placa de vídeo não deu conta; continuando pelo processador')
    try {
      return await tentar('wasm')
    } catch (e2) {
      if (e2?.name === 'AbortError') throw e2
      console.error(`IA (${chave}) falhou também no processador:`, e2)
      throw new ErroAmigavel('Não foi possível processar esta imagem neste aparelho. Feche outras abas e tente de novo.')
    }
  } finally {
    parar()
  }
}

const canvas = (w, h) => new OffscreenCanvas(Math.max(1, Math.round(w)), Math.max(1, Math.round(h)))

/** Pixels de `fonte` redimensionada para w×h, em CHW float32, com `normalizar(valor0a1, canal)`. */
function tensorDaImagem(fonte, w, h, normalizar, recorte) {
  const c = canvas(w, h)
  const ctx = c.getContext('2d', { willReadFrequently: true })
  ctx.imageSmoothingQuality = 'high'
  if (recorte) ctx.drawImage(fonte, recorte.x, recorte.y, recorte.w, recorte.h, 0, 0, w, h)
  else ctx.drawImage(fonte, 0, 0, w, h)
  const px = ctx.getImageData(0, 0, w, h).data
  const n = w * h
  const dados = new Float32Array(3 * n)
  for (let i = 0; i < n; i += 1) {
    dados[i] = normalizar(px[i * 4] / 255, 0)
    dados[n + i] = normalizar(px[i * 4 + 1] / 255, 1)
    dados[2 * n + i] = normalizar(px[i * 4 + 2] / 255, 2)
  }
  return dados
}

/** Valores 0–1 (w×h) → canvas cujo alfa é a máscara. */
function canvasDaMascara(valores, w, h, transformar = (v) => v) {
  const c = canvas(w, h)
  const ctx = c.getContext('2d')
  const img = ctx.createImageData(w, h)
  for (let i = 0; i < w * h; i += 1) img.data[i * 4 + 3] = Math.round(Math.min(1, Math.max(0, transformar(valores[i]))) * 255)
  ctx.putImageData(img, 0, 0)
  return c
}

/* ─── Remover fundo ────────────────────────────────────────────────────── */

/**
 * Máscara do que fica (o alfa de um canvas na resolução do modelo; quem usa
 * amplia para o tamanho da imagem). `modo`: 'fundo' (preciso) ou 'pessoas' (rápido).
 */
export async function mascaraDoFundo(fonte, { modo = 'fundo', progresso, sinal } = {}) {
  if (modo === 'pessoas') {
    // MODNet: lado menor 512, lados múltiplos de 32 (e o maior até 1024).
    const k = Math.min(512 / Math.min(fonte.width, fonte.height), 1024 / Math.max(fonte.width, fonte.height))
    const w = Math.max(32, Math.round((fonte.width * k) / 32) * 32)
    const h = Math.max(32, Math.round((fonte.height * k) / 32) * 32)
    const dados = tensorDaImagem(fonte, w, h, (v) => (v - 0.5) / 0.5)
    const r = await rodar('pessoas', { '*': { dados, dims: [1, 3, h, w] } }, { progresso, sinal, rotulo: 'Removendo o fundo' })
    progresso?.(1)
    return canvasDaMascara(r.saidas[r.primeira].dados, w, h)
  }
  const L = 1024
  const media = [0.485, 0.456, 0.406]
  const desvio = [0.229, 0.224, 0.225]
  const dados = tensorDaImagem(fonte, L, L, (v, k) => (v - media[k]) / desvio[k])
  const r = await rodar('fundo', { input_image: { dados, dims: [1, 3, L, L] } }, { progresso, sinal, rotulo: 'Removendo o fundo' })
  progresso?.(1)
  return canvasDaMascara(r.saidas.output_image?.dados ?? r.saidas[r.primeira].dados, L, L, (x) => 1 / (1 + Math.exp(-x)))
}

/* ─── Apagar objeto ────────────────────────────────────────────────────── */

/** Caixa do que foi pintado (alfa > 0), lida numa cópia reduzida da máscara. */
function caixaPintada(mascara, W, H) {
  const k = Math.min(1, 1024 / Math.max(W, H))
  const w = Math.max(1, Math.round(W * k))
  const h = Math.max(1, Math.round(H * k))
  const c = canvas(w, h)
  const ctx = c.getContext('2d', { willReadFrequently: true })
  ctx.drawImage(mascara, 0, 0, w, h)
  const d = ctx.getImageData(0, 0, w, h).data
  let x0 = w
  let y0 = h
  let x1 = -1
  let y1 = -1
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      if (d[(y * w + x) * 4 + 3] > 0) {
        if (x < x0) x0 = x
        if (x > x1) x1 = x
        if (y < y0) y0 = y
        if (y > y1) y1 = y
      }
    }
  }
  if (x1 < 0) return null
  // Volta à escala real com 1 px (reduzido) de folga.
  return { x0: Math.max(0, (x0 - 1) / k), y0: Math.max(0, (y0 - 1) / k), x1: Math.min(W - 1, (x1 + 2) / k), y1: Math.min(H - 1, (y1 + 2) / k) }
}

/**
 * `mascara`: canvas do tamanho da imagem, pintado onde é para apagar (alfa > 0).
 * Recorta um quadrado em volta do que foi pintado (com contexto), roda o LaMa
 * em 512², e devolve a imagem com só a área pintada trocada.
 */
export async function apagarObjeto(fonte, mascara, { progresso, sinal } = {}) {
  const W = fonte.width
  const H = fonte.height
  const caixa = caixaPintada(mascara, W, H)
  if (!caixa) throw new ErroAmigavel('Pinte por cima do que você quer apagar.')
  const { x0, y0, x1, y1 } = caixa

  // Quadrado com bastante contexto em volta (o LaMa precisa ver o entorno).
  const lado = Math.min(Math.max(W, H), Math.max(256, Math.round(Math.max(x1 - x0, y1 - y0) * 2.2)))
  const cx = (x0 + x1) / 2
  const cy = (y0 + y1) / 2
  const qx = Math.round(Math.min(Math.max(0, cx - lado / 2), Math.max(0, W - lado)))
  const qy = Math.round(Math.min(Math.max(0, cy - lado / 2), Math.max(0, H - lado)))
  const qw = Math.min(lado, W)
  const qh = Math.min(lado, H)
  const q = { x: qx, y: qy, w: qw, h: qh }

  const T = 512
  const imagem = tensorDaImagem(fonte, T, T, (v) => v, q)
  const mk = canvas(T, T)
  const mctx = mk.getContext('2d', { willReadFrequently: true })
  mctx.drawImage(mascara, qx, qy, qw, qh, 0, 0, T, T)
  const mpx = mctx.getImageData(0, 0, T, T).data
  const n = T * T
  const furo = new Float32Array(n)
  for (let i = 0; i < n; i += 1) {
    if (mpx[i * 4 + 3] > 0) {
      // Borda suave do pincel também conta como furo.
      furo[i] = 1
      imagem[i] = 0
      imagem[n + i] = 0
      imagem[2 * n + i] = 0
    }
  }
  const r = await rodar('apagar', { image: { dados: imagem, dims: [1, 3, T, T] }, mask: { dados: furo, dims: [1, 1, T, T] } }, { progresso, sinal, rotulo: 'Preenchendo' })
  const out = (r.saidas.output ?? r.saidas[r.primeira]).dados
  const preenchido = canvas(T, T)
  const pctx = preenchido.getContext('2d')
  const pdados = pctx.createImageData(T, T)
  for (let i = 0; i < n; i += 1) {
    pdados.data[i * 4] = out[i]
    pdados.data[i * 4 + 1] = out[n + i]
    pdados.data[i * 4 + 2] = out[2 * n + i]
    pdados.data[i * 4 + 3] = 255
  }
  pctx.putImageData(pdados, 0, 0)

  // Volta ao tamanho do quadrado e cola só onde foi pintado (borda suavizada).
  const remendo = canvas(qw, qh)
  const rctx = remendo.getContext('2d')
  rctx.imageSmoothingQuality = 'high'
  rctx.drawImage(preenchido, 0, 0, qw, qh)
  rctx.globalCompositeOperation = 'destination-in'
  rctx.filter = `blur(${Math.max(1, Math.round(qw / 400))}px)`
  rctx.drawImage(mascara, qx, qy, qw, qh, 0, 0, qw, qh)

  const res = canvas(W, H)
  const ctx = res.getContext('2d')
  ctx.drawImage(fonte, 0, 0)
  ctx.drawImage(remendo, qx, qy)
  progresso?.(1)
  return res
}

/* ─── Seleção inteligente (Segment Anything) ───────────────────────────── */

/*
 * A pessoa pinta por cima do que quer apagar; os pontos do traço viram o
 * "clique" do SAM, que devolve o contorno do objeto inteiro. A leitura da
 * imagem (encoder, alguns segundos) é feita uma vez por imagem e guardada;
 * cada traço depois só roda o decodificador (décimos de segundo).
 */
const LADO_SAM = 1024
const leituras = new WeakMap() // fonte → Promise<{ k, rw, rh, emb, pos }>

/** Lê a imagem para a seleção (uma vez por imagem). Chame cedo para o primeiro traço já sair rápido. */
export function prepararSelecao(fonte, { progresso, sinal } = {}) {
  if (!leituras.has(fonte)) {
    const k = LADO_SAM / Math.max(fonte.width, fonte.height)
    const rw = Math.max(1, Math.round(fonte.width * k))
    const rh = Math.max(1, Math.round(fonte.height * k))
    // Redimensiona pelo lado maior e completa com zeros (embaixo e à direita), como o SamProcessor.
    const media = [0.485, 0.456, 0.406]
    const desvio = [0.229, 0.224, 0.225]
    const menor = tensorDaImagem(fonte, rw, rh, (v, c) => (v - media[c]) / desvio[c])
    const n = LADO_SAM * LADO_SAM
    const dados = new Float32Array(3 * n)
    for (let c = 0; c < 3; c += 1) for (let y = 0; y < rh; y += 1) dados.set(menor.subarray(c * rw * rh + y * rw, c * rw * rh + (y + 1) * rw), c * n + y * LADO_SAM)
    const p = rodar('selecaoImagem', { pixel_values: { dados, dims: [1, 3, LADO_SAM, LADO_SAM] } }, { progresso, sinal, rotulo: 'Preparando a seleção inteligente' }).then((r) => ({
      k,
      rw,
      rh,
      emb: r.saidas.image_embeddings,
      pos: r.saidas.image_positional_embeddings,
    }))
    leituras.set(fonte, p)
    p.catch(() => leituras.delete(fonte))
  }
  return leituras.get(fonte)
}

/**
 * Objeto sob os `pontos` ([[x, y]…], em px da `fonte`): { mascara, fracao } —
 * canvas do tamanho da fonte cujo alfa é o objeto, e quanto da imagem ele
 * ocupa (0–1) —, ou null se a IA não achou nada razoável.
 */
export async function selecionarObjeto(fonte, pontos, { sinal } = {}) {
  if (!pontos.length) return null
  const { k, rw, rh, emb, pos } = await prepararSelecao(fonte, { sinal })
  const coords = new Float32Array(pontos.flatMap(([x, y]) => [x * k, y * k]))
  const r = await rodar(
    'selecaoObjeto',
    {
      input_points: { dados: coords, dims: [1, 1, pontos.length, 2] },
      input_labels: { dados: new BigInt64Array(pontos.length).fill(1n), dims: [1, 1, pontos.length], tipo: 'int64' },
      // Cópias: o que vai para o worker é transferido, e a leitura fica guardada para os próximos traços.
      image_embeddings: { dados: emb.dados.slice(), dims: emb.dims },
      image_positional_embeddings: { dados: pos.dados.slice(), dims: pos.dims },
    },
    { sinal, rotulo: 'Selecionando o objeto' },
  )
  const notas = r.saidas.iou_scores.dados
  const mascaras = r.saidas.pred_masks.dados // 3 × 256 × 256 (logits, no quadro de 1024 completado)
  const L = 256
  // Das 3 máscaras, as de nota quase igual à melhor são "a mesma resposta": fica a menor —
  // a maior costuma juntar objetos vizinhos (medido: um risco num objeto pegava o do lado junto).
  const areas = [0, 1, 2].map((m) => {
    let n = 0
    for (let i = 0; i < L * L; i += 1) if (mascaras[m * L * L + i] > 0) n += 1
    return n
  })
  const topo = Math.max(...notas)
  let melhor = -1
  for (let m = 0; m < notas.length; m += 1) if (notas[m] >= topo - 0.03 && areas[m] && (melhor < 0 || areas[m] < areas[melhor])) melhor = m
  if (melhor < 0) return null
  const peq = canvas(L, L)
  const pctx = peq.getContext('2d')
  const img = pctx.createImageData(L, L)
  let marcados = 0
  for (let i = 0; i < L * L; i += 1) {
    const v = mascaras[melhor * L * L + i]
    if (v > 0) {
      img.data[i * 4 + 3] = 255
      marcados += 1
    }
  }
  pctx.putImageData(img, 0, 0)
  // Só a parte que é imagem (o resto do quadro de 1024 era completado com zeros).
  const vw = (rw / LADO_SAM) * L
  const vh = (rh / LADO_SAM) * L
  if (!marcados || notas[melhor] < 0.5) return null
  const saida = canvas(fonte.width, fonte.height)
  const sctx = saida.getContext('2d')
  sctx.imageSmoothingQuality = 'high'
  sctx.drawImage(peq, 0, 0, vw, vh, 0, 0, saida.width, saida.height)
  return { mascara: saida, fracao: marcados / (vw * vh) }
}
