import assert from 'node:assert/strict'
import { SVG, ajustes, enviar, formato, jpg, png } from './comum.mjs'

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
    nome: 'imagem/editor: recorte 1:1',
    pagina: '/imagem/editor',
    async executar(t) {
      await enviar(t, png(640, 480, false))
      await t.aguardar(`document.querySelector('main img[alt="Prévia"]')?.naturalWidth > 0`)
      await t.clicar('1:1')
      await t.clicar('Baixar')
      await t.confirmarBaixar()
      await t.aguardarResultado()
      const [r] = await t.js('return await __t.resultados()')
      assert.deepEqual([r.largura, r.altura], [480, 480])
      assert.equal(r.nome, 'teste-editada.png')
    },
  },
  {
    nome: 'imagem/editor: formato no modal e renomear no resultado',
    pagina: '/imagem/editor',
    async executar(t) {
      await enviar(t, png(640, 480, false))
      await t.aguardar(`document.querySelector('main img[alt="Prévia"]')?.naturalWidth > 0`)
      assert.equal(await t.js("return [...document.querySelectorAll('main [role=tab]')].some((b) => b.textContent.includes('Salvar como'))"), false, 'a aba Salvar como deveria ter saído')
      await t.clicar('Baixar')
      await t.nomeNoModal('foto final')
      await t.js("[...document.querySelectorAll('dialog[open] [role=radio], dialog[open] button')].find((b) => b.textContent.trim() === 'WebP').click()")
      await t.confirmarBaixar()
      await t.aguardarResultado()
      let [r] = await t.js('return await __t.resultados()')
      assert.deepEqual([r.nome, r.tipo], ['foto final.webp', 'webp'])
      // Renomear clicando no nome do resultado.
      await t.js("document.querySelector('section[aria-label=Resultado] [data-renomear]').click()")
      await t.js(`const i = document.querySelector('section[aria-label=Resultado] input[aria-label="Nome do arquivo"]'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(i, 'capa'); i.dispatchEvent(new Event('input', { bubbles: true })); i.dispatchEvent(new FocusEvent('focusout', { bubbles: true }))`)
      await t.aguardar("document.querySelector('section[aria-label=Resultado] a[download]')?.getAttribute('download') === 'capa.webp'", 3000)
    },
  },
  {
    nome: 'imagem/editor: girar 90° troca largura e altura',
    pagina: '/imagem/editor',
    async executar(t) {
      await enviar(t, png(640, 480, false))
      await aba(t, 'Girar')
      await t.clicar('Horário')
      await t.clicar('Baixar')
      await t.confirmarBaixar()
      await t.aguardarResultado()
      const [r] = await t.js('return await __t.resultados()')
      assert.deepEqual([r.largura, r.altura], [480, 640])
    },
  },
  {
    nome: 'imagem/editor: tamanho de rede social (post quadrado)',
    pagina: '/imagem/editor',
    async executar(t) {
      await enviar(t, png(800, 600, false))
      await aba(t, 'Tamanho')
      await escolher(t, 'rede')
      await t.clicar('Baixar')
      await t.confirmarBaixar()
      await t.aguardarResultado()
      const [r] = await t.js('return await __t.resultados()')
      assert.deepEqual([r.largura, r.altura], [1080, 1080])
    },
  },
  {
    nome: 'imagem/editor: lote em 50% e filtro P&B',
    pagina: '/imagem/editor',
    async executar(t) {
      await enviar(t, `[__t.arquivo(await __t.imagem(640, 480), 'a.png'), __t.arquivo(await __t.imagem(300, 200), 'b.png')]`)
      await aba(t, 'Tamanho')
      await escolher(t, 'porcentagem')
      await aba(t, 'Cores')
      await t.clicar('P&B')
      await t.clicar('Baixar')
      await t.confirmarBaixar()
      await t.aguardarResultado()
      const rs = await t.js('return await __t.resultados()')
      assert.deepEqual(
        rs.map((r) => [r.largura, r.altura]),
        [
          [320, 240],
          [150, 100],
        ],
      )
      const px = await pixel(t, 160, 30)
      assert.ok(Math.abs(px[0] - px[1]) <= 2 && Math.abs(px[1] - px[2]) <= 2, `pixel não é cinza: ${px}`)
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
