/**
 * Rascunhos dos editores, guardados no próprio navegador (IndexedDB): o
 * projeto e os arquivos usados. Sair da página (ou fechar a aba) e voltar
 * recupera a edição. Nada sai do aparelho.
 *
 * Os arquivos ficam em chaves próprias ("video:arquivo:f3") e o projeto em
 * outra ("video:projeto"): o projeto muda o tempo todo; os arquivos, não.
 * Tudo falha em silêncio (janela anônima, armazenamento cheio…).
 */
const BANCO = 'hipotetic'
const LOJA = 'rascunhos'

function abrir() {
  return new Promise((ok, falha) => {
    if (typeof indexedDB === 'undefined') return falha(new Error('sem IndexedDB'))
    const pedido = indexedDB.open(BANCO, 1)
    pedido.onupgradeneeded = () => pedido.result.createObjectStore(LOJA)
    pedido.onsuccess = () => ok(pedido.result)
    pedido.onerror = () => falha(pedido.error)
    pedido.onblocked = () => falha(new Error('IndexedDB bloqueado'))
  })
}

/** Nunca deixa o editor esperando para sempre (banco travado, aba antiga segurando…). */
const comPrazo = (promessa, ms = 4000) => Promise.race([promessa, new Promise((_, falha) => setTimeout(() => falha(new Error('IndexedDB demorou demais')), ms))])

async function operar(modo, fn) {
  const db = await comPrazo(abrir())
  try {
    return await comPrazo(new Promise((ok, falha) => {
      const tx = db.transaction(LOJA, modo)
      const resultado = fn(tx.objectStore(LOJA))
      tx.oncomplete = () => ok(resultado?.result)
      tx.onerror = () => falha(tx.error)
      tx.onabort = () => falha(tx.error)
    }))
  } finally {
    db.close()
  }
}

export const guardar = (chave, valor) => operar('readwrite', (loja) => loja.put(valor, chave)).catch(() => {})
export const ler = (chave) => operar('readonly', (loja) => loja.get(chave)).catch(() => undefined)

/** Apaga todas as chaves que começam com `prefixo` ("video:"). */
export const apagarTudo = (prefixo) =>
  operar('readwrite', (loja) => {
    const cursor = loja.openCursor()
    cursor.onsuccess = () => {
      const c = cursor.result
      if (!c) return
      if (String(c.key).startsWith(prefixo)) c.delete()
      c.continue()
    }
  }).catch(() => {})

/** "há 5 min", "há 2 h", "ontem"… para avisar de quando é o rascunho. */
export function haQuanto(quando) {
  const s = (Date.now() - quando) / 1000
  if (s < 90) return 'agora há pouco'
  if (s < 3600) return `há ${Math.round(s / 60)} min`
  if (s < 86400) return `há ${Math.round(s / 3600)} h`
  return s < 172800 ? 'ontem' : `há ${Math.round(s / 86400)} dias`
}
