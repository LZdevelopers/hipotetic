// Testes de integração das ferramentas em navegador real, sobre o build.
// Cada cenário abre a página da ferramenta, gera arquivos de teste dentro do
// próprio navegador (canvas, texto…), envia, executa e confere os BYTES do
// resultado: formato real, dimensões, tamanho, conteúdo.
//
// Uso: npm run test:ferramentas
//      SO=imagem npm run test:ferramentas       (só cenários que contêm "imagem")

import { spawn } from 'node:child_process'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { abrirNavegador, esperar, navegar, tela } from './navegador.mjs'
import { CENARIOS } from './cenarios.mjs'

const RAIZ = fileURLToPath(new URL('..', import.meta.url))
const PORTA = 4600 + Math.floor(Math.random() * 300)
const BASE = `http://localhost:${PORTA}`

// Funções auxiliares disponíveis na página como window.__t
const AJUDANTES = String.raw`
window.__t = {
  async imagem(largura, altura, tipo = 'image/png', { alfa = false, qualidade = 0.9 } = {}) {
    const c = document.createElement('canvas'); c.width = largura; c.height = altura
    const ctx = c.getContext('2d')
    const g = ctx.createLinearGradient(0, 0, largura, altura)
    g.addColorStop(0, '#e11d48'); g.addColorStop(0.5, '#2563eb'); g.addColorStop(1, '#16a34a')
    ctx.fillStyle = g; ctx.fillRect(0, 0, largura, altura)
    ctx.fillStyle = '#ffffff'; ctx.font = 'bold ' + Math.round(altura / 6) + 'px sans-serif'; ctx.fillText('Teste', largura / 10, altura / 2)
    if (alfa) ctx.clearRect(0, 0, largura / 3, altura / 3)
    return await new Promise((ok) => c.toBlob(ok, tipo, qualidade))
  },
  arquivo(blob, nome) { return new File([blob], nome, { type: blob.type, lastModified: Date.now() }) },
  /** Insere um EXIF com câmera e GPS num JPEG (para testar a remoção). */
  async comExif(jpeg) {
    const b = new Uint8Array(await jpeg.arrayBuffer())
    const t = []; const s = (str) => [...str].map((c) => c.charCodeAt(0))
    const u16 = (v) => [v >> 8, v & 255]; const u32 = (v) => [(v >>> 24) & 255, (v >> 16) & 255, (v >> 8) & 255, v & 255]
    // TIFF big-endian: IFD0 com Make, Model e ponteiro para o GPS IFD.
    const make = s('CameraTeste\0'); const model = s('Modelo X\0')
    const ifd0 = 8; const n0 = 3; const dados0 = ifd0 + 2 + n0 * 12 + 4
    const gpsIfd = dados0 + make.length + model.length
    const tiff = [...s('MM'), 0, 42, ...u32(8), ...u16(n0),
      ...u16(0x010f), ...u16(2), ...u32(make.length), ...u32(dados0),
      ...u16(0x0110), ...u16(2), ...u32(model.length), ...u32(dados0 + make.length),
      ...u16(0x8825), ...u16(4), ...u32(1), ...u32(gpsIfd),
      ...u32(0), ...make, ...model]
    const nG = 4; const dadosG = gpsIfd + 2 + nG * 12 + 4
    tiff.push(...u16(nG),
      ...u16(1), ...u16(2), ...u32(2), ...s('S\0'), 0, 0,
      ...u16(2), ...u16(5), ...u32(3), ...u32(dadosG),
      ...u16(3), ...u16(2), ...u32(2), ...s('W\0'), 0, 0,
      ...u16(4), ...u16(5), ...u32(3), ...u32(dadosG + 24),
      ...u32(0),
      ...u32(23), ...u32(1), ...u32(33), ...u32(1), ...u32(0), ...u32(1),
      ...u32(46), ...u32(1), ...u32(38), ...u32(1), ...u32(0), ...u32(1))
    const corpo = [...s('Exif\0\0'), ...tiff]
    const app1 = [0xff, 0xe1, ...u16(corpo.length + 2), ...corpo]
    const saida = new Uint8Array(b.length + app1.length)
    saida.set(b.subarray(0, 2)); saida.set(app1, 2); saida.set(b.subarray(2), 2 + app1.length)
    return new Blob([saida], { type: 'image/jpeg' })
  },
  enviar(arquivos, seletor = 'input[type=file]') {
    const input = document.querySelector(seletor)
    const dt = new DataTransfer(); arquivos.forEach((a) => dt.items.add(a))
    input.files = dt.files
    input.dispatchEvent(new Event('change', { bubbles: true }))
  },
  clicar(texto) {
    // Só dentro do <main> e botões primeiro: o menu e o rodapé têm links com
    // nomes parecidos ("JPG para PNG") que navegariam para outra ferramenta.
    const comeca = (e) => e.textContent.trim().startsWith(texto)
    const botao = [...document.querySelectorAll('main button, main [role=radio]')].find((e) => comeca(e) && !e.disabled)
    const alvo = botao ?? [...document.querySelectorAll('main a')].find(comeca)
    if (!alvo) throw new Error('Botão não encontrado (ou desabilitado): ' + texto)
    alvo.click()
  },
  existe(texto) { return [...document.querySelectorAll('button, a, [role=radio]')].some((e) => e.textContent.trim().startsWith(texto)) },
  habilitado(texto) { const b = [...document.querySelectorAll('button')].find((e) => e.textContent.trim().startsWith(texto)); return Boolean(b && !b.disabled) },
  digitar(rotulo, valor) {
    const label = [...document.querySelectorAll('label')].find((l) => l.textContent.trim() === rotulo)
    const el = label && document.getElementById(label.htmlFor)
    if (!el) throw new Error('Campo não encontrado: ' + rotulo)
    const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : el.tagName === 'SELECT' ? HTMLSelectElement.prototype : HTMLInputElement.prototype
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, String(valor))
    el.dispatchEvent(new Event(el.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }))
  },
  pronto() { return Boolean(document.querySelector('section[aria-label=Resultado]')) },
  erro() { return document.querySelector('[role=alert]')?.textContent ?? null },
  async assinatura(blob) {
    const b = new Uint8Array(await blob.slice(0, 16).arrayBuffer())
    const txt = String.fromCharCode(...b)
    if (b[0] === 0xff && b[1] === 0xd8) return 'jpg'
    if (txt.startsWith('\x89PNG')) return 'png'
    if (txt.startsWith('RIFF') && txt.slice(8, 12) === 'WEBP') return 'webp'
    if (txt.slice(4, 12) === 'ftypavif') return 'avif'
    if (txt.startsWith('%PDF')) return 'pdf'
    if (txt.startsWith('PK')) return 'zip'
    if (txt.startsWith('GIF8')) return 'gif'
    if (b[0] === 0 && b[1] === 0 && b[2] === 1 && b[3] === 0) return 'ico'
    if (txt.slice(4, 8) === 'ftyp') return 'mp4'
    if (b[0] === 0x1a && b[1] === 0x45) return 'webm'
    if (txt.startsWith('ID3') || (b[0] === 0xff && (b[1] & 0xe0) === 0xe0)) return 'mp3'
    if (txt.startsWith('7z')) return '7z'
    return 'desconhecido:' + [...b.slice(0, 8)].map((x) => x.toString(16)).join(' ')
  },
  async resultados() {
    const links = [...document.querySelectorAll('section[aria-label=Resultado] a[download]')]
    const saida = []
    for (const a of links) {
      const blob = await (await fetch(a.href)).blob()
      const r = { nome: a.getAttribute('download'), tamanho: blob.size, tipo: await this.assinatura(blob) }
      if (['jpg', 'png', 'webp', 'avif', 'gif'].includes(r.tipo)) {
        try { const bmp = await createImageBitmap(blob); r.largura = bmp.width; r.altura = bmp.height } catch { r.largura = null }
      }
      saida.push(r)
    }
    return saida
  },
  async bytes(indice = 0) {
    const a = document.querySelectorAll('section[aria-label=Resultado] a[download]')[indice]
    return [...new Uint8Array(await (await fetch(a.href)).arrayBuffer())]
  },
  async texto(indice = 0) {
    const a = document.querySelectorAll('section[aria-label=Resultado] a[download]')[indice]
    return await (await fetch(a.href)).text()
  },
  /** WAV 16 bits mono: trechos [{ s: segundos, hz: frequência (0 = silêncio) }]. */
  wav(trechos = [{ s: 2, hz: 440 }], taxa = 22050) {
    const total = trechos.reduce((a, t) => a + Math.round(t.s * taxa), 0)
    const buf = new ArrayBuffer(44 + total * 2)
    const v = new DataView(buf)
    const txt = (o, s) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)))
    txt(0, 'RIFF'); v.setUint32(4, 36 + total * 2, true); txt(8, 'WAVE'); txt(12, 'fmt ')
    v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, taxa, true)
    v.setUint32(28, taxa * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); txt(36, 'data'); v.setUint32(40, total * 2, true)
    let p = 44
    for (const t of trechos) for (let i = 0; i < Math.round(t.s * taxa); i += 1, p += 2) v.setInt16(p, t.hz ? Math.round(Math.sin((2 * Math.PI * t.hz * i) / taxa) * 12000) : 0, true)
    return new Blob([buf], { type: 'audio/wav' })
  },
  /** Grava um vídeo WebM (canvas animado + tom de 440 Hz) com o MediaRecorder. */
  async gravarVideo(segundos = 3, largura = 640, altura = 360) {
    const c = document.createElement('canvas'); c.width = largura; c.height = altura
    const ctx = c.getContext('2d')
    const ac = new AudioContext(); await ac.resume()
    const osc = ac.createOscillator(); const dest = ac.createMediaStreamDestination(); osc.connect(dest); osc.start()
    const stream = new MediaStream([...c.captureStream(30).getVideoTracks(), ...dest.stream.getAudioTracks()])
    const rec = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp8,opus', videoBitsPerSecond: 1_500_000 })
    const partes = []; rec.ondataavailable = (e) => partes.push(e.data)
    const inicio = performance.now(); let quadro = 0
    const desenhar = () => {
      const t = (performance.now() - inicio) / 1000
      ctx.fillStyle = 'hsl(' + ((t * 90) % 360) + ' 70% 45%)'; ctx.fillRect(0, 0, largura, altura)
      ctx.fillStyle = '#fff'; ctx.font = 'bold 48px sans-serif'; ctx.fillText('Quadro ' + (quadro += 1), 30, altura / 2)
      ctx.fillRect((t / segundos) * largura, altura - 30, 30, 30)
    }
    const timer = setInterval(desenhar, 33); desenhar()
    rec.start(250)
    await new Promise((ok) => setTimeout(ok, segundos * 1000))
    await new Promise((ok) => { rec.onstop = ok; rec.stop() })
    clearInterval(timer); osc.stop(); ac.close()
    return new Blob(partes, { type: 'video/webm' })
  },
  /** Duração e dimensões de um resultado de mídia (pelo próprio navegador). */
  async midia(indice = 0) {
    const a = document.querySelectorAll('section[aria-label=Resultado] a[download]')[indice]
    const el = document.createElement('video'); el.preload = 'metadata'; el.muted = true; el.src = a.href
    await new Promise((ok, falha) => { el.onloadedmetadata = ok; el.onerror = () => falha(new Error('o navegador não abriu o resultado')) })
    if (el.duration === Infinity) { el.currentTime = 1e9; await new Promise((ok) => (el.ontimeupdate = ok)) }
    return { duracao: el.duration, largura: el.videoWidth, altura: el.videoHeight }
  },
  /** Guarda um resultado para usar em outro cenário (sem passar pelo Node). */
  async guardar(chave, indice = 0) {
    const a = document.querySelectorAll('section[aria-label=Resultado] a[download]')[indice]
    const blob = await (await fetch(a.href)).blob()
    const b = new Uint8Array(await blob.arrayBuffer()); let s = ''
    for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000))
    return { chave, nome: a.getAttribute('download'), base64: btoa(s), tipo: blob.type }
  },
}`

const servidor = spawn(process.execPath, [join(RAIZ, 'node_modules/vite/bin/vite.js'), 'preview', '--port', String(PORTA), '--strictPort'], { cwd: RAIZ })
for (let i = 0; i < 100; i += 1) {
  if (await fetch(BASE).then(() => true).catch(() => false)) break
  await esperar(150)
}

const s = await abrirNavegador()
await tela(s, { largura: 1366, altura: 900 })
const errosJs = []
const consoleErros = []
s.em('Runtime.consoleAPICalled', (p) => p.type === 'error' && consoleErros.push(p.args.map((a) => a.value ?? a.description ?? '').join(' ').slice(0, 500)))
s.em('Runtime.exceptionThrown', (p) => errosJs.push(p.exceptionDetails.exception?.description?.split('\n')[0] ?? p.exceptionDetails.text))

const filtro = process.env.SO
const lista = CENARIOS.filter((c) => !filtro || filtro.split(',').some((f) => c.nome.includes(f)))
let falhas = 0

for (const cenario of lista) {
  const inicio = Date.now()
  errosJs.length = 0
  consoleErros.length = 0
  try {
    await navegar(s, BASE + cenario.pagina)
    // Espera a hidratação: antes dela, o HTML pré-renderizado ignora eventos.
    await s.aguardar('document.documentElement.dataset.pronto === "sim"')
    await s.avaliar(AJUDANTES)
    const t = {
      js: (codigo) => s.avaliar(`(async () => { ${codigo} })()`),
      /** Espera o botão habilitar e clica. */
      async clicar(texto, ms = 15000) {
        await s.aguardar(`[...document.querySelectorAll('main button, main [role=radio]')].some((e) => e.textContent.trim().startsWith(${JSON.stringify(texto)}) && !e.disabled)`, ms)
        await s.avaliar(`__t.clicar(${JSON.stringify(texto)})`)
      },
      aguardar: (expr, ms) => s.aguardar(expr, ms),
      /** Vai para outra página no meio do cenário (reinjeta os ajudantes). */
      async navegar(caminho) {
        await navegar(s, BASE + caminho)
        await s.aguardar('document.documentElement.dataset.pronto === "sim"')
        await s.avaliar(AJUDANTES)
      },
      esperar,
      async aguardarResultado(ms = 60000) {
        const fim = Date.now() + ms
        while (Date.now() < fim) {
          if (await s.avaliar('__t.pronto()')) return
          const erro = await s.avaliar('__t.erro()')
          if (erro) throw new Error(`A ferramenta mostrou erro: ${erro}`)
          await esperar(200)
        }
        const tela = await s.avaliar(`(document.querySelector('main aside') ?? document.querySelector('main'))?.innerText.split(String.fromCharCode(10)).join(' | ').slice(0, 300)`)
        throw new Error(`Tempo esgotado esperando o resultado. Na tela: ${tela}`)
      },
    }
    await cenario.executar(t)
    if (errosJs.length) throw new Error(`Exceção na página: ${errosJs[0]}`)
    console.log(`✓ ${cenario.nome} (${((Date.now() - inicio) / 1000).toFixed(1)} s)`)
  } catch (erro) {
    falhas += 1
    console.error(`✗ ${cenario.nome}: ${erro.message}`)
    const tela = await s.avaliar(`document.querySelector('main')?.innerText.split(String.fromCharCode(10)).join(' | ').slice(0, 400)`).catch(() => '')
    console.error(`    na tela: ${tela}`)
    for (const msg of consoleErros.slice(0, 3)) console.error(`    console.error na página: ${msg}`)
  }
}

await s.fechar()
servidor.kill()
console.log(`\n${lista.length - falhas} de ${lista.length} cenários passaram.`)
process.exit(falhas ? 1 : 0)
