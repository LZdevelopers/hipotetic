// Baixa o pacote do LibreOffice (lo.tar.br) antes do build, quando ele não
// existe localmente. O pacote tem ~150 MB e não cabe no Git: fica publicado
// como anexo de um Release do GitHub, descrito em servicos/libreoffice/pacote.json
// (URL + SHA-256). O hash é conferido; arquivo diferente é descartado.
//
// Sem pacote.json (ou com LO_PACOTE=off) o build segue sem as ferramentas de
// conversão de documentos — nada quebra.

import { createHash } from 'node:crypto'
import { createReadStream, createWriteStream, existsSync, mkdirSync, readFileSync, renameSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { fileURLToPath } from 'node:url'

const RAIZ = fileURLToPath(new URL('..', import.meta.url))
const DESCRICAO = join(RAIZ, 'servicos/libreoffice/pacote.json')
const DESTINO = join(RAIZ, 'servicos/libreoffice/saida/lo.tar.br')

async function hashDe(caminho) {
  const h = createHash('sha256')
  for await (const parte of createReadStream(caminho)) h.update(parte)
  return h.digest('hex')
}

async function principal() {
  if (process.env.LO_PACOTE === 'off') return console.log('[libreoffice] desligado (LO_PACOTE=off).')
  if (!existsSync(DESCRICAO)) return console.log('[libreoffice] sem pacote.json: build sem conversão de documentos.')
  const { url, sha256 } = JSON.parse(readFileSync(DESCRICAO, 'utf8'))

  if (existsSync(DESTINO)) {
    if ((await hashDe(DESTINO)) === sha256) return console.log('[libreoffice] pacote local confere.')
    // Pacote local diferente do publicado: num computador de desenvolvimento
    // é o que acabou de ser gerado — mantém. Na Vercel não existe arquivo local.
    return console.log('[libreoffice] pacote local difere do pacote.json; usando o local.')
  }

  console.log(`[libreoffice] baixando ${url}`)
  mkdirSync(dirname(DESTINO), { recursive: true })
  const temporario = `${DESTINO}.baixando`
  const resposta = await fetch(url, { redirect: 'follow' })
  if (!resposta.ok || !resposta.body) throw new Error(`download falhou: HTTP ${resposta.status}`)
  await pipeline(Readable.fromWeb(resposta.body), createWriteStream(temporario))
  const obtido = await hashDe(temporario)
  if (obtido !== sha256) {
    rmSync(temporario, { force: true })
    throw new Error(`hash não confere (esperado ${sha256}, obtido ${obtido})`)
  }
  renameSync(temporario, DESTINO)
  console.log('[libreoffice] pacote baixado e conferido.')
}

principal().catch((erro) => {
  // Falhar aqui não deve derrubar o site inteiro: segue sem documentos.
  console.warn(`[libreoffice] ${erro.message} — build segue sem conversão de documentos.`)
})
