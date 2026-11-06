// Controle mínimo do Chrome/Edge headless via DevTools Protocol, sem
// dependências (mesmo padrão do Global-Time). Usado pelos testes de
// navegador: abre páginas, executa scripts, envia arquivos e tira capturas.

import { spawn } from 'node:child_process'
import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const CANDIDATOS = [
  process.env.CHROME,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].filter(Boolean)

export const esperar = (ms) => new Promise((r) => setTimeout(r, ms))

class Sessao {
  constructor(ws) {
    this.ws = ws
    this.id = 0
    this.pendentes = new Map()
    this.ouvintes = new Map()
    ws.addEventListener('message', (e) => {
      const msg = JSON.parse(e.data)
      if (msg.id && this.pendentes.has(msg.id)) {
        const { ok, falha } = this.pendentes.get(msg.id)
        this.pendentes.delete(msg.id)
        if (msg.error) falha(new Error(`${msg.error.message} ${msg.error.data ?? ''}`))
        else ok(msg.result)
      } else if (msg.method) {
        for (const f of this.ouvintes.get(msg.method) ?? []) f(msg.params)
      }
    })
  }
  enviar(method, params = {}) {
    const id = (this.id += 1)
    this.ws.send(JSON.stringify({ id, method, params }))
    return new Promise((ok, falha) => this.pendentes.set(id, { ok, falha }))
  }
  em(evento, f) {
    if (!this.ouvintes.has(evento)) this.ouvintes.set(evento, [])
    this.ouvintes.get(evento).push(f)
  }
  /** Avalia uma expressão (pode ser async) na página e devolve o valor. */
  async avaliar(expressao) {
    const r = await this.enviar('Runtime.evaluate', { expression: expressao, awaitPromise: true, returnByValue: true })
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text)
    return r.result.value
  }
  /** Espera uma expressão ficar verdadeira. */
  async aguardar(expressao, limite = 20000) {
    const inicio = Date.now()
    while (Date.now() - inicio < limite) {
      if (await this.avaliar(`Boolean(${expressao})`).catch(() => false)) return true
      await esperar(100)
    }
    throw new Error(`Tempo esgotado esperando: ${expressao}`)
  }
}

export async function abrirNavegador() {
  const chrome = CANDIDATOS.find((c) => existsSync(c))
  if (!chrome) throw new Error('Chrome/Edge não encontrado. Defina CHROME=/caminho/do/navegador.')
  const perfil = mkdtempSync(join(tmpdir(), 'hipotetic-chrome-'))
  const porta = 9300 + Math.floor(Math.random() * 600)
  const processo = spawn(chrome, [
    '--headless=new',
    `--remote-debugging-port=${porta}`,
    `--user-data-dir=${perfil}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-extensions',
    '--hide-scrollbars',
    'about:blank',
  ])
  let alvo
  for (let i = 0; i < 100 && !alvo; i += 1) {
    await esperar(150)
    alvo = await fetch(`http://127.0.0.1:${porta}/json/list`)
      .then((r) => r.json())
      .then((l) => l.find((t) => t.type === 'page'))
      .catch(() => null)
  }
  if (!alvo) throw new Error('O navegador não respondeu.')
  const ws = new WebSocket(alvo.webSocketDebuggerUrl)
  await new Promise((ok, falha) => {
    ws.addEventListener('open', ok)
    ws.addEventListener('error', falha)
  })
  const s = new Sessao(ws)
  await Promise.all(['Page.enable', 'Runtime.enable', 'Log.enable', 'Network.enable', 'DOM.enable'].map((m) => s.enviar(m)))
  s.fechar = async () => {
    ws.close()
    processo.kill()
    await esperar(300)
    try {
      rmSync(perfil, { recursive: true, force: true })
    } catch {
      /* o Chrome às vezes ainda segura arquivos do perfil */
    }
  }
  return s
}

export async function tela(s, { largura, altura, celular = false, tema }) {
  await s.enviar('Emulation.setDeviceMetricsOverride', { width: largura, height: altura, deviceScaleFactor: 1, mobile: celular })
  await s.enviar('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: tema === 'dark' ? 'dark' : 'light' }] })
}

export async function navegar(s, url) {
  const carregou = new Promise((ok) => s.em('Page.loadEventFired', ok))
  await s.enviar('Page.navigate', { url })
  await Promise.race([carregou, esperar(15000)])
}

export async function capturar(s, arquivo, paginaInteira = false) {
  const { writeFileSync } = await import('node:fs')
  let clip
  if (paginaInteira) {
    const { contentSize } = await s.enviar('Page.getLayoutMetrics')
    clip = { x: 0, y: 0, width: contentSize.width, height: Math.min(contentSize.height, 8000), scale: 1 }
  }
  const { data } = await s.enviar('Page.captureScreenshot', { format: 'png', captureBeyondViewport: paginaInteira, clip })
  writeFileSync(arquivo, Buffer.from(data, 'base64'))
}

/** Coloca arquivos (caminhos locais) no <input type=file> do seletor. */
export async function enviarArquivos(s, seletor, caminhos) {
  const { root } = await s.enviar('DOM.getDocument', { depth: -1, pierce: true })
  const { nodeId } = await s.enviar('DOM.querySelector', { nodeId: root.nodeId, selector: seletor })
  if (!nodeId) throw new Error(`Não achei ${seletor}`)
  await s.enviar('DOM.setFileInputFiles', { nodeId, files: caminhos })
}
