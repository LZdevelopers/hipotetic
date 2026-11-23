/**
 * Worker da IA do editor de imagem: baixa (ou pega do cache) o modelo, abre a
 * sessão do ONNX Runtime e roda. Fica fora da página de propósito: a página
 * não trava enquanto a IA pensa, e cancelar é só encerrar este worker.
 *
 * Mensagens recebidas: { id, tipo: 'preparar' | 'rodar', modelo, ep, entradas? }
 *   - modelo: { chave, url, tamanho, opcoes }
 *   - ep: 'webgpu' | 'wasm'
 *   - entradas: { nome: { dados: Float32Array, dims } }
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

/* ─── Sessão (uma por vez: os modelos são grandes) ─────────────────────── */

let atual = null // { chave, ep, promessa, pronta }

async function sessao(modelo, ep, avisar) {
  if (atual && atual.chave === modelo.chave && atual.ep === ep) {
    if (!atual.pronta) avisar('preparando')
    return atual.promessa
  }
  if (atual) {
    const velha = atual
    atual = null
    velha.promessa.then((s) => s.release()).catch(() => {})
  }
  let bytes
  try {
    bytes = await bytesDo(modelo, avisar)
  } catch (e) {
    throw new ErroFase('baixando', e)
  }
  if (atual && atual.chave === modelo.chave && atual.ep === ep) return atual.promessa
  avisar('preparando')
  const registro = { chave: modelo.chave, ep, pronta: false }
  registro.promessa = ort.InferenceSession.create(bytes, { executionProviders: [ep], graphOptimizationLevel: 'all', ...modelo.opcoes }).then(
    (s) => {
      registro.pronta = true
      return s
    },
    (e) => {
      if (atual === registro) atual = null
      throw new ErroFase('preparando', e)
    },
  )
  atual = registro
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
      feeds[nome === '*' ? s.inputNames[0] : nome] = new ort.Tensor('float32', t.dados, t.dims)
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
