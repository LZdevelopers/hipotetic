/**
 * IA do editor de imagem, rodando no navegador (ONNX Runtime Web, WebGPU
 * quando há; senão wasm). Nada sai do aparelho: só os modelos são baixados,
 * uma vez, e ficam no cache do navegador.
 *
 *   - Remover fundo: BiRefNet lite (MIT), export estático 1024² para navegador.
 *   - Apagar objeto: LaMa big-lama (Apache-2.0), pesos int4/int8, 512².
 */
import { ErroAmigavel } from '../../nucleo/tarefa'

const CACHE = 'hipotetic-modelos-v1'

export const MODELOS = {
  fundo: {
    nome: 'removedor de fundo',
    url: 'https://huggingface.co/CoderViking/birefnet-lite-onnx/resolve/main/birefnet-lite-1024.onnx',
    tamanho: 199_681_624,
  },
  apagar: {
    nome: 'apagador de objetos',
    url: 'https://huggingface.co/othytenk/lama-int4-int8/resolve/main/lama_int4_int8_r4.onnx',
    tamanho: 36_931_151,
  },
}

let ortPromessa = null
async function obterOrt() {
  ortPromessa ??= import('onnxruntime-web/webgpu').then((ort) => {
    ort.env.wasm.wasmPaths = '/ort/'
    ort.env.logLevel = 'error'
    // Sem isolamento entre origens não há threads; com, usa até 4.
    ort.env.wasm.numThreads = globalThis.crossOriginIsolated ? Math.min(4, navigator.hardwareConcurrency || 2) : 1
    return ort
  })
  return ortPromessa
}

/** Já baixado? (para o botão dizer se vai baixar.) */
export async function modeloNoCache(chave) {
  try {
    return Boolean(await (await caches.open(CACHE)).match(MODELOS[chave].url))
  } catch {
    return false
  }
}

/** Baixa o modelo (com progresso 0–1) ou pega do cache. */
async function bytesDoModelo(chave, progresso, sinal) {
  const { url, tamanho } = MODELOS[chave]
  let cache = null
  try {
    cache = await caches.open(CACHE)
    const salvo = await cache.match(url)
    if (salvo) return new Uint8Array(await salvo.arrayBuffer())
  } catch {
    /* sem Cache Storage (janela anônima em alguns navegadores): baixa sempre */
  }
  let resposta
  try {
    resposta = await fetch(url, { signal: sinal })
  } catch (e) {
    if (e?.name === 'AbortError') throw e
    throw new ErroAmigavel('Não foi possível baixar o modelo de IA. Confira a conexão e tente de novo.')
  }
  if (!resposta.ok || !resposta.body) throw new ErroAmigavel('Não foi possível baixar o modelo de IA agora. Tente de novo em instantes.')
  const total = Number(resposta.headers.get('content-length')) || tamanho
  const leitor = resposta.body.getReader()
  const dados = new Uint8Array(total)
  let lidos = 0
  let extra = []
  for (;;) {
    const { done, value } = await leitor.read()
    if (done) break
    if (lidos + value.length <= dados.length) dados.set(value, lidos)
    else extra.push(value)
    lidos += value.length
    progresso?.(Math.min(1, lidos / total))
  }
  const final = extra.length ? (() => {
    const t = new Uint8Array(lidos)
    t.set(dados.subarray(0, Math.min(lidos, dados.length)))
    let pos = dados.length
    for (const parte of extra) {
      t.set(parte, pos)
      pos += parte.length
    }
    return t
  })() : dados.subarray(0, lidos)
  try {
    await cache?.put(url, new Response(final, { headers: { 'content-type': 'application/octet-stream' } }))
  } catch {
    /* armazenamento cheio: funciona agora, baixa de novo da próxima vez */
  }
  return final
}

/*
 * Placa de vídeo (WebGPU) é bem mais rápida, mas em algumas (principalmente
 * as integradas de notebook) o modelo estoura a memória de vídeo ou o driver
 * falha no meio. Aí roda de novo pelo processador (wasm) e o navegador lembra:
 * nas próximas vezes já vai direto pelo processador neste aparelho.
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

const sessoes = {} // chave → { s, ep }
async function sessao(chave, progresso, sinal) {
  if (sessoes[chave]) return sessoes[chave]
  const ort = await obterOrt()
  const bytes = await bytesDoModelo(chave, (v) => progresso?.(v * 0.9, `Baixando o ${MODELOS[chave].nome} (só na primeira vez)`), sinal)
  progresso?.(0.92, 'Preparando a IA')
  const opcoes = chave === 'apagar' ? { extra: { session: { disable_quant_qdq: '1' } } } : {}
  const criar = async (ep) => ({ s: await ort.InferenceSession.create(bytes, { executionProviders: [ep], graphOptimizationLevel: 'all', ...opcoes }), ep })
  try {
    if (navigator.gpu && !semGpu()) {
      try {
        sessoes[chave] = await criar('webgpu')
      } catch (e) {
        console.warn('IA: a placa de vídeo não abriu o modelo; usando o processador.', e)
        marcarSemGpu()
        sessoes[chave] = await criar('wasm')
      }
    } else sessoes[chave] = await criar('wasm')
  } catch (e) {
    console.error(e)
    throw new ErroAmigavel('Este navegador não conseguiu rodar a IA. Tente no Chrome ou no Edge atualizados.')
  }
  return sessoes[chave]
}

/** Roda o modelo; se a placa de vídeo falhar, tenta de novo pelo processador. */
async function rodar(chave, entradas, progresso, sinal) {
  let atual = await sessao(chave, progresso, sinal)
  try {
    return await atual.s.run(entradas)
  } catch (e) {
    console.error(`IA (${chave}) falhou em ${atual.ep}:`, e)
    if (atual.ep !== 'webgpu') throw new ErroAmigavel('A IA não conseguiu processar esta imagem neste aparelho. Feche outras abas e tente de novo.')
    marcarSemGpu()
    atual.s.release?.().catch?.(() => {})
    delete sessoes[chave]
    progresso?.(0.95, 'A placa de vídeo não deu conta; continuando pelo processador (mais lento)')
    atual = await sessao(chave, null, sinal)
    try {
      return await atual.s.run(entradas)
    } catch (e2) {
      console.error(`IA (${chave}) falhou também no processador:`, e2)
      throw new ErroAmigavel('A IA não conseguiu processar esta imagem neste aparelho. Feche outras abas e tente de novo.')
    }
  }
}

const canvas = (w, h) => new OffscreenCanvas(Math.max(1, Math.round(w)), Math.max(1, Math.round(h)))

/* ─── Remover fundo ────────────────────────────────────────────────────── */

/**
 * Devolve um canvas do mesmo tamanho com o fundo transparente: o modelo vê a
 * imagem em 1024², a máscara (0–1) volta ao tamanho original e vira o alfa.
 */
export async function removerFundo(fonte, { progresso, sinal } = {}) {
  const ort = await obterOrt()
  await sessao('fundo', progresso, sinal)
  progresso?.(0.94, 'Separando o fundo')
  const L = 1024
  const c = canvas(L, L)
  const ctx = c.getContext('2d', { willReadFrequently: true })
  ctx.drawImage(fonte, 0, 0, L, L)
  const px = ctx.getImageData(0, 0, L, L).data
  const media = [0.485, 0.456, 0.406]
  const desvio = [0.229, 0.224, 0.225]
  const entrada = new Float32Array(3 * L * L)
  for (let i = 0; i < L * L; i += 1) {
    for (let k = 0; k < 3; k += 1) entrada[k * L * L + i] = (px[i * 4 + k] / 255 - media[k]) / desvio[k]
  }
  const saida = await rodar('fundo', { input_image: new ort.Tensor('float32', entrada, [1, 3, L, L]) }, progresso, sinal)
  const logits = (saida.output_image ?? Object.values(saida)[0]).data
  // Máscara 1024² → canvas (alfa), depois ampliada para o tamanho da imagem.
  const m = canvas(L, L)
  const mctx = m.getContext('2d')
  const masc = mctx.createImageData(L, L)
  for (let i = 0; i < L * L; i += 1) {
    const a = 1 / (1 + Math.exp(-logits[i]))
    masc.data[i * 4 + 3] = Math.round(a * 255)
  }
  mctx.putImageData(masc, 0, 0)
  const W = fonte.width
  const H = fonte.height
  const r = canvas(W, H)
  const rctx = r.getContext('2d')
  rctx.drawImage(fonte, 0, 0)
  rctx.globalCompositeOperation = 'destination-in'
  rctx.imageSmoothingQuality = 'high'
  rctx.drawImage(m, 0, 0, W, H)
  progresso?.(1)
  return r
}

/* ─── Apagar objeto ────────────────────────────────────────────────────── */

/**
 * `mascara`: canvas do tamanho da imagem, pintado onde é para apagar (alfa > 0).
 * Recorta um quadrado em volta do que foi pintado (com contexto), roda o LaMa
 * em 512², e devolve a imagem com só a área pintada trocada.
 */
export async function apagarObjeto(fonte, mascara, { progresso, sinal } = {}) {
  const W = fonte.width
  const H = fonte.height
  const mdados = mascara.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, W, H).data
  let x0 = W
  let y0 = H
  let x1 = -1
  let y1 = -1
  for (let y = 0; y < H; y += 1) {
    for (let x = 0; x < W; x += 1) {
      if (mdados[(y * W + x) * 4 + 3] > 0) {
        if (x < x0) x0 = x
        if (x > x1) x1 = x
        if (y < y0) y0 = y
        if (y > y1) y1 = y
      }
    }
  }
  if (x1 < 0) throw new ErroAmigavel('Pinte por cima do que você quer apagar.')
  const ort = await obterOrt()
  await sessao('apagar', progresso, sinal)
  progresso?.(0.94, 'Apagando')

  // Quadrado com bastante contexto em volta (o LaMa precisa ver o entorno).
  const lado = Math.min(Math.max(W, H), Math.max(256, Math.round(Math.max(x1 - x0, y1 - y0) * 2.2)))
  const cx = (x0 + x1) / 2
  const cy = (y0 + y1) / 2
  const qx = Math.round(Math.min(Math.max(0, cx - lado / 2), Math.max(0, W - lado)))
  const qy = Math.round(Math.min(Math.max(0, cy - lado / 2), Math.max(0, H - lado)))
  const qw = Math.min(lado, W)
  const qh = Math.min(lado, H)

  const T = 512
  const img = canvas(T, T)
  const ictx = img.getContext('2d', { willReadFrequently: true })
  ictx.drawImage(fonte, qx, qy, qw, qh, 0, 0, T, T)
  const ipx = ictx.getImageData(0, 0, T, T).data
  const mk = canvas(T, T)
  const mctx = mk.getContext('2d', { willReadFrequently: true })
  mctx.drawImage(mascara, qx, qy, qw, qh, 0, 0, T, T)
  const mpx = mctx.getImageData(0, 0, T, T).data

  const imagem = new Float32Array(3 * T * T)
  const furo = new Float32Array(T * T)
  for (let i = 0; i < T * T; i += 1) {
    const buraco = mpx[i * 4 + 3] > 0 ? 1 : 0 // borda suave do pincel também conta como furo
    furo[i] = buraco
    for (let k = 0; k < 3; k += 1) imagem[k * T * T + i] = buraco ? 0 : ipx[i * 4 + k] / 255
  }
  const saida = await rodar('apagar', { image: new ort.Tensor('float32', imagem, [1, 3, T, T]), mask: new ort.Tensor('float32', furo, [1, 1, T, T]) }, progresso, sinal)
  const out = saida.output.data
  const preenchido = canvas(T, T)
  const pctx = preenchido.getContext('2d')
  const pdados = pctx.createImageData(T, T)
  for (let i = 0; i < T * T; i += 1) {
    for (let k = 0; k < 3; k += 1) pdados.data[i * 4 + k] = Math.max(0, Math.min(255, out[k * T * T + i]))
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

  const r = canvas(W, H)
  const ctx = r.getContext('2d')
  ctx.drawImage(fonte, 0, 0)
  ctx.drawImage(remendo, qx, qy)
  progresso?.(1)
  return r
}
