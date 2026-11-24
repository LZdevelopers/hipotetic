import assert from 'node:assert/strict'
import { SVG, ajustes, enviar, formato, jpg, png } from './comum.mjs'

/** Editor de imagem: abre uma imagem e prepara a captura do que for baixado. */
const abrirNoEditor = async (t, w, h) => {
  await t.js("window.__baixados = []; const __orig = URL.createObjectURL.bind(URL); URL.createObjectURL = (b) => { if (b instanceof Blob) window.__baixados.push(b); return __orig(b) }")
  await t.js(`__t.enviar(${png(w, h, false)})`)
  await t.aguardar("document.querySelector('main canvas[aria-label=Imagem]')", 20000)
}
const ferramenta = (t, nome) => t.js(`[...document.querySelectorAll('main nav[aria-label=Ferramentas] button')].find((b) => b.textContent.includes(${JSON.stringify(nome)})).click()`)
/** Baixa (PNG) e devolve [largura, altura] do arquivo. */
const baixarDimensoes = async (t) => {
  const antes = await t.js('return window.__baixados.length')
  await t.clicar('Baixar')
  await t.confirmarBaixar()
  await t.aguardar(`window.__baixados.length > ${antes}`, 30000)
  return t.js('const bmp = await createImageBitmap(window.__baixados.at(-1)); return [bmp.width, bmp.height]')
}

/** Lê um pixel do resultado `indice` (na página). */
const pixel = (t, x, y, indice = 0) =>
  t.js(`const a = document.querySelectorAll('section[aria-label=Resultado] a[download]')[${indice}]
    const bmp = await createImageBitmap(await (await fetch(a.href)).blob())
    const c = new OffscreenCanvas(bmp.width, bmp.height); const ctx = c.getContext('2d'); ctx.drawImage(bmp, 0, 0)
    return [...ctx.getImageData(${x}, ${y}, 1, 1).data]`)

/** Abre uma aba do editor de imagem. */
const aba = (t, nome) => t.js(`[...document.querySelectorAll('main [role=tab]')].find((b) => b.textContent.trim() === ${JSON.stringify(nome)}).click()`)

/** Escolhe a opção `valor` no <select> da página que tem essa opção. */
const escolher = (t, valor) =>
  t.js(`const s = [...document.querySelectorAll('main select')].find((x) => [...x.options].some((o) => o.value === ${JSON.stringify(valor)}))
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(s, ${JSON.stringify(valor)})
    s.dispatchEvent(new Event('change', { bubbles: true }))`)

export default [
  {
    nome: 'converter: PNG com transparência → JPG',
    pagina: '/converter',
    async executar(t) {
      await enviar(t, png())
      await formato(t, 'JPG')
      await t.clicar('Converter')
      await t.aguardarResultado()
      const [r] = await t.js('return await __t.resultados()')
      assert.equal(r.tipo, 'jpg')
      assert.equal(r.nome, 'teste.jpg')
      assert.deepEqual([r.largura, r.altura], [640, 480])
    },
  },
  {
    nome: 'converter: “converter todos para” AVIF em 3 imagens',
    pagina: '/converter',
    async executar(t) {
      await enviar(t, `[__t.arquivo(await __t.imagem(300, 200), 'a.png'), __t.arquivo(await __t.imagem(200, 300, 'image/jpeg'), 'b.jpg'), __t.arquivo(await __t.imagem(256, 256, 'image/webp'), 'c.webp')]`)
      await formato(t, 'AVIF', null)
      await t.clicar('Converter')
      await t.aguardarResultado(120000)
      const rs = await t.js('return await __t.resultados()')
      assert.ok(rs.length === 3 && rs.every((r) => r.tipo === 'avif'), JSON.stringify(rs))
    },
  },
  {
    nome: 'converter: PNG → WebP mantém a transparência',
    pagina: '/converter',
    async executar(t) {
      await enviar(t, png(400, 300, true))
      await formato(t, 'WEBP')
      await t.clicar('Converter')
      await t.aguardarResultado()
      assert.equal((await t.js('return await __t.resultados()'))[0].tipo, 'webp')
      assert.equal((await pixel(t, 5, 5))[3], 0, 'o canto transparente deveria continuar transparente')
    },
  },
  {
    nome: 'converter: SVG 100×50 em 2× → PNG 200×100',
    pagina: '/converter',
    async executar(t) {
      await enviar(t, `[new File([${JSON.stringify(SVG)}], 'logo.svg', { type: 'image/svg+xml' })]`)
      await formato(t, 'PNG')
      await ajustes(t)
      await t.js(`__t.digitar('Tamanho dos SVGs', '2')`)
      await t.clicar('Converter')
      await t.aguardarResultado()
      const [r] = await t.js('return await __t.resultados()')
      assert.equal(r.tipo, 'png')
      assert.deepEqual([r.largura, r.altura], [200, 100])
    },
  },
  {
    nome: 'converter: tipos misturados, cada um para um formato',
    pagina: '/converter',
    async executar(t) {
      await enviar(t, `[__t.arquivo(await __t.imagem(320, 240), 'foto.png'), __t.arquivo(__t.wav([{ s: 1, hz: 440 }]), 'tom.wav'), new File(['# Título' + String.fromCharCode(10, 10) + 'Texto **forte**.'], 'nota.md')]`)
      // Cada linha só oferece o que serve para ela: a imagem não tem MP3.
      await t.js("document.querySelectorAll('main section[aria-label] > ul > li')[0].querySelector('button[aria-haspopup=dialog]').click()")
      await t.aguardar("document.querySelector('main [role=dialog]')", 5000)
      assert.equal(await t.js("return [...document.querySelectorAll('main [role=dialog] button')].some((b) => b.textContent.trim() === 'MP3')"), false)
      await t.js("document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))")
      await formato(t, 'JPG', 0)
      await formato(t, 'MP3', 1)
      await formato(t, 'HTML', 2)
      await t.clicar('Converter')
      await t.aguardarResultado(120000)
      const rs = await t.js('return await __t.resultados()')
      assert.deepEqual(rs.map((r) => r.nome), ['foto.jpg', 'tom.mp3', 'nota.html'])
      assert.deepEqual(rs.slice(0, 2).map((r) => r.tipo), ['jpg', 'mp3'])
      assert.ok((await t.js('return await __t.texto(2)')).includes('<strong>forte</strong>'))
    },
  },
  {
    nome: 'imagem/comprimir: JPG grande fica menor e respeita 1280 px',
    pagina: '/imagem/comprimir',
    async executar(t) {
      await enviar(t, jpg(3000, 2000, 'grande.jpg'))
      await t.js(`__t.digitar('Reduzir dimensões', '1280')`)
      await t.clicar('Comprimir')
      await t.aguardarResultado()
      const [r] = await t.js('return await __t.resultados()')
      assert.equal(r.tipo, 'jpg')
      assert.equal(r.largura, 1280)
    },
  },
  {
    nome: 'imagem/editor: recortar 1:1 e continuar editando sobre o recorte',
    pagina: '/imagem/editor',
    async executar(t) {
      await abrirNoEditor(t, 640, 480)
      await ferramenta(t, 'Recortar')
      await t.clicar('1:1')
      await t.js("document.querySelector('main [data-aplicar]').click()")
      await t.aguardar("document.querySelector('main section[aria-label=Imagem]').innerText.includes('480 × 480 px')", 10000)
      // Continua editando: gira o recorte.
      await ferramenta(t, 'Girar')
      await t.clicar('Horário')
      await t.esperar(400)
      assert.deepEqual(await baixarDimensoes(t), [480, 480])
    },
  },
  {
    nome: 'imagem/editor: girar 90° troca largura e altura (e desfaz)',
    pagina: '/imagem/editor',
    async executar(t) {
      await abrirNoEditor(t, 640, 480)
      await ferramenta(t, 'Girar')
      await t.clicar('Horário')
      await t.aguardar("document.querySelector('main section[aria-label=Imagem]').innerText.includes('480 × 640 px')", 10000)
      assert.deepEqual(await baixarDimensoes(t), [480, 640])
      await t.esperar(500)
      await t.js("document.querySelector('main button[aria-label=\"Desfazer (Ctrl+Z)\"]').click()")
      await t.aguardar("document.querySelector('main section[aria-label=Imagem]').innerText.includes('640 × 480 px')", 10000)
    },
  },
  {
    nome: 'imagem/editor: esticar sem manter a proporção',
    pagina: '/imagem/editor',
    async executar(t) {
      await abrirNoEditor(t, 640, 480)
      await ferramenta(t, 'Tamanho')
      // A proporção já vem destravada.
      await t.js("__t.digitar('Altura', '200')")
      await t.js("document.querySelector('main [data-aplicar]').click()")
      await t.aguardar("document.querySelector('main section[aria-label=Imagem]').innerText.includes('640 × 200 px')", 10000)
      assert.deepEqual(await baixarDimensoes(t), [640, 200])
    },
  },
  {
    nome: 'imagem/editor: tamanho de rede social corta sem esticar',
    pagina: '/imagem/editor',
    async executar(t) {
      await abrirNoEditor(t, 800, 600)
      await ferramenta(t, 'Tamanho')
      await t.js(`const s = [...document.querySelectorAll('main aside select')].find((x) => [...x.options].some((o) => o.value === 'ig-quadrado'))
        Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(s, 'ig-quadrado'); s.dispatchEvent(new Event('change', { bubbles: true }))`)
      await t.aguardar("document.querySelector('main section[aria-label=Imagem]').innerText.includes('1080 × 1080 px')", 10000)
      assert.deepEqual(await baixarDimensoes(t), [1080, 1080])
    },
  },
  {
    nome: 'imagem/editor: P&B, texto e tamanho estimado no baixar',
    pagina: '/imagem/editor',
    async executar(t) {
      await abrirNoEditor(t, 640, 480)
      await ferramenta(t, 'Filtros')
      await t.js("document.querySelector('main [data-filtro=pb]').click()")
      await ferramenta(t, 'Texto')
      await t.js(`const c = document.querySelector('main canvas[aria-label=Imagem]'); const r = c.getBoundingClientRect()
        c.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, clientX: r.left + r.width * 0.3, clientY: r.top + r.height * 0.5 }))`)
      await t.aguardar("document.querySelector('main [aria-label=\"Camada: texto\"]')", 5000)
      await t.clicar('Baixar')
      await t.aguardar("/~\\d/.test(document.querySelector('dialog[open] [data-estimativa]')?.textContent ?? '')", 30000)
      await t.js("[...document.querySelectorAll('dialog[open] [role=radio]')].find((b) => b.textContent.startsWith('JPG')).click()")
      await t.aguardar("/~\\d/.test(document.querySelector('dialog[open] [data-estimativa]')?.textContent ?? '')", 30000)
      await t.confirmarBaixar()
      await t.aguardar('window.__baixados.length > 0', 30000)
      const [tipo, cinza] = await t.js(`const b = window.__baixados.at(-1); const bmp = await createImageBitmap(b)
        const c = new OffscreenCanvas(bmp.width, bmp.height); const x = c.getContext('2d'); x.drawImage(bmp, 0, 0)
        const [r, g, bl] = x.getImageData(20, 20, 1, 1).data; return [b.type, Math.max(Math.abs(r - g), Math.abs(g - bl)) <= 6]`)
      assert.equal(tipo, 'image/jpeg')
      assert.ok(cinza, 'deveria estar em preto e branco')
    },
  },
  {
    nome: 'salvo: a ferramenta recupera arquivos e resultado ao voltar',
    pagina: '/imagem/comprimir',
    async executar(t) {
      await enviar(t, png(300, 200, false))
      await t.aguardar("document.querySelector('main').innerText.includes('teste.png')", 10000)
      await t.esperar(900)
      // Saiu e voltou: o arquivo continua lá, com o aviso.
      await t.navegar('/imagem/comprimir')
      await t.aguardar("document.querySelector('main').innerText.includes('Recuperamos o que você estava fazendo')", 15000)
      await t.aguardar("document.querySelector('main').innerText.includes('teste.png')", 10000)
      // Processa, sai antes de baixar e volta: o resultado continua.
      await t.clicar('Comprimir')
      await t.aguardarResultado()
      await t.esperar(900)
      await t.navegar('/imagem/comprimir')
      await t.aguardarResultado(15000)
      // Começar do zero apaga tudo.
      await t.clicar('Começar do zero')
      await t.aguardar("!document.querySelector('section[aria-label=Resultado]') && !document.querySelector('main').innerText.includes('teste.png')", 10000)
      await t.navegar('/imagem/comprimir')
      await t.esperar(1500)
      assert.equal(await t.js("return document.querySelector('main').innerText.includes('Recuperamos')"), false, 'depois de começar do zero não deveria recuperar nada')
    },
  },
  {
    nome: 'imagem/metadados: mostra câmera e GPS e remove sem recomprimir',
    pagina: '/imagem/metadados',
    async executar(t) {
      await t.js(`__t.enviar([__t.arquivo(await __t.comExif(await __t.imagem(400, 300, 'image/jpeg')), 'gps.jpg')])`)
      await t.aguardar(`document.body.textContent.includes('CameraTeste')`, 15000)
      const texto = await t.js('return document.body.textContent')
      assert.ok(texto.includes('Esta foto revela onde foi tirada') && texto.includes('-23.55'))
      await t.clicar('Remover metadados')
      await t.aguardarResultado()
      const [r] = await t.js('return await __t.resultados()')
      assert.deepEqual([r.tipo, r.largura, r.altura], ['jpg', 400, 300])
      const bytes = String.fromCharCode(...(await t.js('return await __t.bytes()')))
      assert.ok(!bytes.includes('CameraTeste') && !bytes.includes('Exif'), 'metadados continuam no arquivo')
    },
  },
  {
    nome: 'imagem/favicon: ICO + PNGs + manifesto',
    pagina: '/imagem/favicon',
    async executar(t) {
      await t.js(`__t.enviar(${png(512, 512, true)})`)
      await t.clicar('Gerar favicon')
      await t.aguardarResultado()
      const porNome = Object.fromEntries((await t.js('return await __t.resultados()')).map((r) => [r.nome, r]))
      assert.equal(porNome['favicon.ico'].tipo, 'ico')
      assert.equal(porNome['apple-touch-icon.png'].largura, 180)
      assert.ok(porNome['site.webmanifest'])
    },
  },
  {
    nome: 'imagem/cores: extrai a paleta',
    pagina: '/imagem/cores',
    async executar(t) {
      await t.js(`__t.enviar(${png(300, 200, false)})`)
      await t.aguardar(`document.querySelectorAll('button[aria-label^="Copiar #"]').length >= 6`, 15000)
    },
  },
  {
    nome: 'imagem/miniatura: imagem → 1280×720 JPG',
    pagina: '/imagem/miniatura',
    async executar(t) {
      await t.js(`__t.enviar(${png(800, 800, false)})`)
      await t.aguardar("[...document.querySelectorAll('main label')].some((l) => l.textContent.trim() === 'Título')")
      await t.js(`__t.digitar('Título', 'Teste de miniatura')`)
      await t.clicar('Gerar miniatura')
      await t.aguardarResultado()
      const [r] = await t.js('return await __t.resultados()')
      assert.deepEqual([r.tipo, r.largura, r.altura], ['jpg', 1280, 720])
    },
  },
  {
    nome: 'utilitarios/base64: gera data URI',
    pagina: '/utilitarios/base64',
    async executar(t) {
      await t.js(`__t.enviar(${png(64, 64, false)})`)
      await t.aguardar(`document.querySelector('textarea')?.value.startsWith('data:image/png;base64,iVBOR')`)
    },
  },
]
