// Serviço de conversão de documentos com o LibreOffice (contêiner).
//
// POST /api/documentos/converter?para=<pdf|docx|odt|rtf|txt|html>
//   Cabeçalho X-Nome-Arquivo: nome original (para a extensão)
//   Corpo: o arquivo (até 4,5 MB, limite das funções da Vercel)
//   → o arquivo convertido
// GET /api/documentos/saude → { ok: true } (o LibreOffice está instalado)
//
// Privacidade: o arquivo é gravado numa pasta temporária exclusiva do pedido
// e APAGADO ao terminar (com ou sem erro). Nada é guardado nem registrado.
// Segurança: tipos validados pelo conteúdo, macros e links externos
// desativados no perfil do LibreOffice, tempo limite por conversão, uma
// conversão por vez por instância, limite de pedidos por IP.

import { spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const PORTA = Number(process.env.PORT) || 80
const LIMITE = 4.5 * 1024 * 1024
const TEMPO_LIMITE = 100_000
const SOFFICE = process.env.SOFFICE || 'soffice'
const PERFIL_MODELO = new URL('./perfil', import.meta.url).pathname
const PERFIL = join(tmpdir(), 'lo-perfil')

/** Entradas aceitas e a assinatura esperada dos primeiros bytes. */
const ENTRADAS = {
  docx: (b) => b[0] === 0x50 && b[1] === 0x4b,
  odt: (b) => b[0] === 0x50 && b[1] === 0x4b,
  doc: (b) => b[0] === 0xd0 && b[1] === 0xcf && b[2] === 0x11 && b[3] === 0xe0,
  rtf: (b) => String.fromCharCode(...b.subarray(0, 5)) === '{\\rtf',
  txt: (b) => !b.subarray(0, 4096).includes(0),
  html: (b) => !b.subarray(0, 4096).includes(0),
  htm: (b) => !b.subarray(0, 4096).includes(0),
  wpd: () => true,
}

/** Filtros de exportação do LibreOffice por formato de saída. */
const SAIDAS = {
  pdf: { filtro: 'pdf:writer_pdf_Export', mime: 'application/pdf' },
  docx: { filtro: 'docx:MS Word 2007 XML', mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' },
  odt: { filtro: 'odt:writer8', mime: 'application/vnd.oasis.opendocument.text' },
  rtf: { filtro: 'rtf:Rich Text Format', mime: 'application/rtf' },
  txt: { filtro: 'txt:Text (encoded):UTF8', mime: 'text/plain; charset=utf-8' },
  html: { filtro: 'html:XHTML Writer File:UTF8', mime: 'text/html; charset=utf-8' },
}

// ─── Limite simples por IP (por instância): 20 conversões a cada 10 min ─────
const JANELA = 10 * 60 * 1000
const MAX_POR_JANELA = 20
const pedidosPorIp = new Map()
function permitido(ip) {
  const agora = Date.now()
  const lista = (pedidosPorIp.get(ip) ?? []).filter((t) => agora - t < JANELA)
  if (lista.length >= MAX_POR_JANELA) return false
  lista.push(agora)
  pedidosPorIp.set(ip, lista)
  if (pedidosPorIp.size > 10_000) pedidosPorIp.clear()
  return true
}

// ─── Uma conversão por vez: o LibreOffice não roda em paralelo no mesmo perfil ─
let fila = Promise.resolve()
const naFila = (fn) => {
  const vez = fila.then(fn, fn)
  fila = vez.catch(() => {})
  return vez
}

function prepararPerfil() {
  if (!existsSync(PERFIL) && existsSync(PERFIL_MODELO)) cpSync(PERFIL_MODELO, PERFIL, { recursive: true })
}

function executarSoffice(args, pasta) {
  return new Promise((resolve, reject) => {
    const proc = spawn(SOFFICE, [`-env:UserInstallation=file://${PERFIL}`, '--headless', '--invisible', '--norestore', '--nolockcheck', '--nodefault', '--nologo', ...args], {
      cwd: pasta,
      env: { ...process.env, HOME: tmpdir() },
    })
    let erro = ''
    proc.stderr.on('data', (d) => (erro += d))
    const relogio = setTimeout(() => {
      proc.kill('SIGKILL')
      reject(new Error('tempo-esgotado'))
    }, TEMPO_LIMITE)
    proc.on('error', (e) => {
      clearTimeout(relogio)
      reject(e)
    })
    proc.on('close', (codigo) => {
      clearTimeout(relogio)
      if (codigo === 0) resolve()
      else reject(new Error(`soffice saiu com ${codigo}: ${erro.slice(0, 300)}`))
    })
  })
}

async function converter(bytes, extensao, para) {
  prepararPerfil()
  const pasta = join(tmpdir(), `conv-${randomUUID()}`)
  mkdirSync(pasta, { recursive: true })
  try {
    const entrada = join(pasta, `documento.${extensao}`)
    writeFileSync(entrada, bytes)
    const saidaDir = join(pasta, 'saida')
    mkdirSync(saidaDir)
    await executarSoffice(['--convert-to', SAIDAS[para].filtro, '--outdir', saidaDir, entrada], pasta)
    const gerado = readdirSync(saidaDir)[0]
    if (!gerado) throw new Error('sem-saida')
    return readFileSync(join(saidaDir, gerado))
  } finally {
    rmSync(pasta, { recursive: true, force: true })
  }
}

function json(res, status, corpo) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' })
  res.end(JSON.stringify(corpo))
}

async function lerCorpo(req) {
  const partes = []
  let total = 0
  for await (const parte of req) {
    total += parte.length
    if (total > LIMITE) throw Object.assign(new Error('grande'), { status: 413 })
    partes.push(parte)
  }
  return Buffer.concat(partes)
}

const servidor = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://local')
  try {
    if (req.method === 'GET' && url.pathname.endsWith('/saude')) return json(res, 200, { ok: true })
    if (req.method !== 'POST' || !url.pathname.endsWith('/converter')) return json(res, 404, { erro: 'nao-encontrado' })

    const ip = String(req.headers['x-forwarded-for'] ?? req.socket.remoteAddress ?? '').split(',')[0].trim()
    if (!permitido(ip)) return json(res, 429, { erro: 'limite' })

    const para = url.searchParams.get('para')
    if (!SAIDAS[para]) return json(res, 400, { erro: 'formato-saida' })
    const nome = decodeURIComponent(String(req.headers['x-nome-arquivo'] ?? ''))
    const extensao = (/\.([a-z0-9]{1,5})$/i.exec(nome)?.[1] ?? '').toLowerCase()
    if (!ENTRADAS[extensao]) return json(res, 415, { erro: 'formato-entrada' })

    const bytes = await lerCorpo(req)
    if (!bytes.length) return json(res, 400, { erro: 'vazio' })
    if (!ENTRADAS[extensao](bytes)) return json(res, 415, { erro: 'conteudo-invalido' })

    const saida = await naFila(() => converter(bytes, extensao, para))
    res.writeHead(200, {
      'Content-Type': SAIDAS[para].mime,
      'Content-Length': saida.length,
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'Content-Disposition': 'attachment',
    })
    res.end(saida)
  } catch (erro) {
    if (erro.status === 413) return json(res, 413, { erro: 'grande' })
    // Sem detalhes do documento nos logs: só o tipo do erro.
    console.error('conversão falhou:', String(erro.message).slice(0, 120))
    if (!res.headersSent) json(res, erro.message === 'tempo-esgotado' ? 504 : 422, { erro: erro.message === 'tempo-esgotado' ? 'tempo-esgotado' : 'falha' })
  }
})

servidor.listen(PORTA, () => console.log(`documentos: ouvindo na porta ${PORTA}`))
process.on('SIGTERM', () => servidor.close(() => process.exit(0)))
