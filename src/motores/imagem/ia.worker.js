/**
 * Worker da IA do editor de imagem: baixa (ou pega do cache) o modelo, abre a
 * sessão do ONNX Runtime e roda. Fica fora da página de propósito: a página
 * não trava enquanto a IA pensa, e cancelar é só encerrar este worker.
 *
 * Mensagens recebidas: { id, tipo: 'preparar' | 'rodar', modelo, ep, entradas? }
 *   - modelo: { chave, url, tamanho, opcoes, leve }
 *   - ep: 'webgpu' | 'wasm'
 *   - entradas: { nome: { dados: Float32Array | BigInt64Array, dims, tipo? } }
 * Enviadas: { id, tipo: 'progresso', fase: 'baixando'|'preparando'|'rodando', valor? }
 *           { id, tipo: 'pronto', saidas? } | { id, tipo: 'erro', fase, mensagem }
 */
import * as ort from 'onnxruntime-web/webgpu'

const CACHE = 'hipotetic-modelos-v1'

ort.env.wasm.wasmPaths = new URL('/ort/', self.location.href).href
ort.env.logLevel = 'error'
// Threads só existem com a página isolada (COOP/COEP). A página fica livre mesmo
// usando todos os núcleos: o worker é que espera, não ela.
ort.env.wasm.numThreads = self.crossOriginIsolated ? Math.max(1, Math.min(8, navigator.hardwareConcurrency || 2)) : 1
ort.env.webgpu.powerPreference = 'high-performance'

class ErroFase extends Error {
  constructor(fase, causa) {
    super(String(causa?.message ?? causa))
    this.fase = fase
  }
}

/* ─── Modelo (download com progresso + Cache Storage) ─────────────────── */

const bytesEmAndamento = new Map() // chave → Promise<Uint8Array>

async function baixar({ url, tamanho }, avisar) {
  let cache = null
  try {
    cache = await caches.open(CACHE)
    const salvo = await cache.match(url)
    if (salvo) return new Uint8Array(await salvo.arrayBuffer())
  } catch {
    /* sem Cache Storage (janela anônima em alguns navegadores): baixa sempre */
  }
  const resposta = await fetch(url)
  if (!resposta.ok || !resposta.body) throw new Error(`HTTP ${resposta.status}`)
  const total = Number(resposta.headers.get('content-length')) || tamanho
  const leitor = resposta.body.getReader()
  const partes = []
  let lidos = 0
  let ultimo = 0
  for (;;) {
    const { done, value } = await leitor.read()
    if (done) break
    partes.push(value)
    lidos += value.length
    const agora = Date.now()
    if (agora - ultimo > 100) {
      ultimo = agora
      avisar('baixando', Math.min(1, lidos / total))
    }
  }
  const dados = new Uint8Array(lidos)
  let pos = 0
  for (const p of partes) {
    dados.set(p, pos)
    pos += p.length
  }
  try {
    await cache?.put(url, new Response(dados, { headers: { 'content-type': 'application/octet-stream' } }))
  } catch {
    /* armazenamento cheio: funciona agora, baixa de novo da próxima vez */
  }
  return dados
}

function bytesDo(modelo, avisar) {
  if (!bytesEmAndamento.has(modelo.chave)) {
    const p = baixar(modelo, avisar)
    bytesEmAndamento.set(modelo.chave, p)
    // Não guarda os bytes depois de abrir a sessão (são centenas de MB).
    p.catch(() => {}).finally(() => bytesEmAndamento.delete(modelo.chave))
  }
  return bytesEmAndamento.get(modelo.chave)
}

/*
 * ─── Sessões ─────────────────────────────────────────────────────────────
 * Os modelos grandes (centenas de MB) abrem um por vez. Os leves (`leve`: as
 * duas metades da seleção de objeto, ~14 MB) ficam abertos juntos, e junto de
 * um grande: a seleção roda a cada traço, entre um preenchimento e outro.
 */

const sessoes = new Map() // chave → { chave, ep, leve, promessa, pronta }

function fechar(registro) {
  sessoes.delete(registro.chave)
  registro.promessa.then((s) => s.release()).catch(() => {})
}

async function sessao(modelo, ep, avisar) {
  const aberta = sessoes.get(modelo.chave)
  if (aberta && aberta.ep === ep) {
    if (!aberta.pronta) avisar('preparando')
    return aberta.promessa
  }
  if (aberta) fechar(aberta)
  // Um grande por vez: abrir um grande fecha o outro grande.
  if (!modelo.leve) for (const r of [...sessoes.values()]) if (!r.leve) fechar(r)
  let bytes
  try {
    bytes = await bytesDo(modelo, avisar)
  } catch (e) {
    throw new ErroFase('baixando', e)
  }
  const outra = sessoes.get(modelo.chave)
  if (outra && outra.ep === ep) return outra.promessa
  avisar('preparando')
  const registro = { chave: modelo.chave, ep, leve: Boolean(modelo.leve), pronta: false }
  registro.promessa = ort.InferenceSession.create(bytes, { executionProviders: [ep], graphOptimizationLevel: 'all', ...modelo.opcoes }).then(
    (s) => {
      registro.pronta = true
      return s
    },
    (e) => {
      if (sessoes.get(modelo.chave) === registro) sessoes.delete(modelo.chave)
      throw new ErroFase('preparando', e)
    },
  )
  sessoes.set(modelo.chave, registro)
  return registro.promessa
}

/* ─── Mensagens ────────────────────────────────────────────────────────── */

self.onmessage = async ({ data: m }) => {
  const { id } = m
  const avisar = (fase, valor) => self.postMessage({ id, tipo: 'progresso', fase, valor })
  try {
    const s = await sessao(m.modelo, m.ep, avisar)
    if (m.tipo === 'preparar') {
      self.postMessage({ id, tipo: 'pronto' })
      return
    }
    avisar('rodando')
    const feeds = {}
    for (const [nome, t] of Object.entries(m.entradas)) {
      // `tipo`: 'float32' (padrão) ou 'int64' (os dados vêm como BigInt64Array).
      feeds[nome === '*' ? s.inputNames[0] : nome] = new ort.Tensor(t.tipo ?? 'float32', t.dados, t.dims)
    }
    let saida
    try {
      saida = await s.run(feeds)
    } catch (e) {
      throw new ErroFase('rodando', e)
    }
    const saidas = {}
    const transferir = []
    for (const nome of s.outputNames) {
      const t = saida[nome]
      // Cópia própria (o tensor pode apontar para a memória do wasm).
      const dados = Float32Array.from(t.data)
      saidas[nome] = { dados, dims: t.dims }
      transferir.push(dados.buffer)
      t.dispose?.()
    }
    self.postMessage({ id, tipo: 'pronto', saidas, primeira: s.outputNames[0] }, transferir)
  } catch (e) {
    console.error(`IA (${m.modelo?.chave}, ${m.ep}):`, e)
    self.postMessage({ id, tipo: 'erro', fase: e?.fase ?? 'rodando', mensagem: String(e?.message ?? e) })
  }
}
