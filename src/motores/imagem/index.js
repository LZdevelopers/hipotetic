/**
 * Cliente do motor de imagem: um pequeno pool de Web Workers que executa
 * receitas (ver nucleo.js) em paralelo, com progresso e cancelamento.
 */
import { ErroAmigavel, cancelado } from '../../nucleo/tarefa'
import { detectarTipo, extensaoDe, trocarExtensao } from '../../nucleo/arquivos'

const PARALELOS = typeof navigator !== 'undefined' ? Math.max(1, Math.min(2, (navigator.hardwareConcurrency || 2) - 1)) : 1

let pool = null
let proximo = 0

function criarPool() {
  if (typeof OffscreenCanvas === 'undefined') {
    throw new ErroAmigavel('Seu navegador não suporta o processamento de imagens. Atualize para uma versão recente do Chrome, Edge, Firefox ou Safari.')
  }
  pool = Array.from({ length: PARALELOS }, () => {
    const worker = new Worker(new URL('./imagem.worker.js', import.meta.url), { type: 'module' })
    return { worker, ocupado: false }
  })
  return pool
}

function encerrarPool() {
  pool?.forEach((p) => p.worker.terminate())
  pool = null
}

function executarNoWorker(item, fonte, receita, sinal) {
  return new Promise((resolve, reject) => {
    const id = (proximo += 1)
    // Cancelar encerra os workers: a resposta nunca viria, então rejeita aqui.
    sinal?.addEventListener('abort', () => reject(new DOMException('Cancelado', 'AbortError')), { once: true })
    const aoReceber = ({ data }) => {
      if (data.id !== id) return
      item.worker.removeEventListener('message', aoReceber)
      if (data.ok) resolve(data)
      else reject(new Error(data.erro))
    }
    item.worker.addEventListener('message', aoReceber)
    item.worker.postMessage({ id, fonte, receita }, fonte instanceof ImageBitmap ? [fonte] : [])
  })
}

/** Lê largura/altura de um SVG (atributos ou viewBox); padrão 1024 px. */
async function tamanhoSvg(arquivo) {
  const texto = await arquivo.text()
  const raiz = /<svg\b[^>]*>/i.exec(texto)?.[0] ?? ''
  const num = (nome) => {
    const m = new RegExp(`\\b${nome}\\s*=\\s*["']\\s*([\\d.]+)\\s*(px)?\\s*["']`, 'i').exec(raiz)
    return m ? Number(m[1]) : null
  }
  let largura = num('width')
  let altura = num('height')
  const vb = /viewBox\s*=\s*["']\s*[-\d.]+[\s,]+[-\d.]+[\s,]+([\d.]+)[\s,]+([\d.]+)/i.exec(raiz)
  if ((!largura || !altura) && vb) {
    const [vw, vh] = [Number(vb[1]), Number(vb[2])]
    if (largura && !altura) altura = (largura * vh) / vw
    else if (altura && !largura) largura = (altura * vw) / vh
    else [largura, altura] = vw >= vh ? [1024, (1024 * vh) / vw] : [(1024 * vw) / vh, 1024]
  }
  return { largura: largura || 1024, altura: altura || 1024 }
}

/**
 * SVG → ImageBitmap no tamanho pedido: `escala` sobre o tamanho do SVG, ou
 * `ladoMaior` em px. Só o thread principal tem <img> para SVG.
 */
export async function rasterizarSvg(arquivo, escala = 1, ladoMaior = null) {
  const { largura, altura } = await tamanhoSvg(arquivo)
  if (ladoMaior) escala = ladoMaior / Math.max(largura, altura)
  const url = URL.createObjectURL(new Blob([await arquivo.arrayBuffer()], { type: 'image/svg+xml' }))
  try {
    const img = new Image()
    img.decoding = 'async'
    img.src = url
    await img.decode()
    const w = Math.max(1, Math.round(largura * escala))
    const h = Math.max(1, Math.round(altura * escala))
    if (w * h > 16_000 * 16_000) throw new ErroAmigavel('O SVG ficaria grande demais com essa escala.')
    const c = document.createElement('canvas')
    c.width = w
    c.height = h
    c.getContext('2d').drawImage(img, 0, 0, w, h)
    return await createImageBitmap(c)
  } catch (erro) {
    if (erro instanceof ErroAmigavel) throw erro
    throw new ErroAmigavel('Não foi possível ler este SVG. Ele pode usar recursos externos (fontes, imagens) que o navegador bloqueia.')
  } finally {
    URL.revokeObjectURL(url)
  }
}

export const ehSvg = async (arquivo) => extensaoDe(arquivo.name) === 'svg' || (await detectarTipo(arquivo))?.ext === 'svg'

/** Largura e altura de uma imagem (com a orientação do EXIF aplicada). */
export async function dimensoes(arquivo) {
  if (await ehSvg(arquivo)) return tamanhoSvg(arquivo)
  const bmp = await createImageBitmap(arquivo, { imageOrientation: 'from-image' })
  const r = { largura: bmp.width, altura: bmp.height }
  bmp.close()
  return r
}

/**
 * Processa um lote. `receitaDe(item, indice)` devolve a receita de cada
 * arquivo (pode ser async — ex.: para ler as dimensões) e, opcionalmente,
 * `nome` para o arquivo de saída e `escalaSvg`.
 * Devolve [{ nome, blob, original, detalhe }].
 */
export async function processarLote(itens, receitaDe, { progresso, sinal, rotulo = 'Processando imagens' }) {
  const lista = pool ?? criarPool()
  const resultados = new Array(itens.length)
  let feitos = 0
  let indice = 0
  const aoCancelar = () => encerrarPool()
  sinal?.addEventListener('abort', aoCancelar, { once: true })
  progresso(0, itens.length > 1 ? `${rotulo} (0 de ${itens.length})` : rotulo)

  const trabalhar = async (slot) => {
    while (indice < itens.length) {
      cancelado(sinal)
      const i = indice
      indice += 1
      const { arquivo } = itens[i]
      const { nome, escalaSvg, ...receita } = await receitaDe(itens[i], i)
      const fonte = (await ehSvg(arquivo)) ? await rasterizarSvg(arquivo, escalaSvg ?? 1) : arquivo
      let r
      try {
        r = await executarNoWorker(slot, fonte, receita, sinal)
      } catch (erro) {
        cancelado(sinal)
        console.error(erro)
        throw new ErroAmigavel(`Não foi possível processar “${arquivo.name}”. O arquivo pode estar corrompido ou em um formato que o navegador não lê.`)
      }
      const ext = receita.saida.formato
      resultados[i] = {
        nome: nome ?? trocarExtensao(arquivo.name, ext),
        blob: r.blob,
        original: arquivo.size,
        detalhe: `${r.largura} × ${r.altura} px`,
        largura: r.largura,
        altura: r.altura,
      }
      feitos += 1
      progresso(feitos / itens.length, itens.length > 1 ? `${rotulo} (${feitos} de ${itens.length})` : rotulo)
    }
  }

  try {
    await Promise.all(lista.slice(0, Math.min(lista.length, itens.length)).map(trabalhar))
  } finally {
    sinal?.removeEventListener('abort', aoCancelar)
  }
  cancelado(sinal)
  return resultados
}

/** Formato de saída quando o usuário escolhe "manter o original". */
export async function formatoOriginal(arquivo) {
  const tipo = (await detectarTipo(arquivo))?.ext
  if (tipo === 'jpg' || tipo === 'jpeg') return 'jpg'
  if (tipo === 'webp' || tipo === 'avif') return tipo
  return 'png' // png, gif (1º quadro), bmp, svg, ico…
}

export const EXTENSOES_IMAGEM = ['png', 'jpg', 'jpeg', 'webp', 'avif', 'gif', 'bmp', 'svg', 'ico']
export const DESCRICAO_IMAGEM = 'PNG, JPG, WebP, AVIF, GIF, BMP, SVG'
export const LIMITE_IMAGEM = 60 * 1024 * 1024
