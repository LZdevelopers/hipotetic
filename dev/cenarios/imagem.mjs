import assert from 'node:assert/strict'
import { SVG, enviar, jpg, png } from './comum.mjs'

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
    nome: 'imagem/converter: PNG com transparência → JPG',
    pagina: '/imagem/converter',
    async executar(t) {
      await enviar(t, png())
      await t.clicar('JPG')
      await t.clicar('Converter')
      await t.aguardarResultado()
      const [r] = await t.js('return await __t.resultados()')
      assert.equal(r.tipo, 'jpg')
      assert.equal(r.nome, 'teste.jpg')
      assert.deepEqual([r.largura, r.altura], [640, 480])
    },
  },
  {
    nome: 'imagem/converter: lote de 3 → AVIF',
    pagina: '/imagem/converter',
    async executar(t) {
      await enviar(t, `[__t.arquivo(await __t.imagem(300, 200), 'a.png'), __t.arquivo(await __t.imagem(200, 300, 'image/jpeg'), 'b.jpg'), __t.arquivo(await __t.imagem(256, 256, 'image/webp'), 'c.webp')]`)
      await t.clicar('AVIF')
      await t.clicar('Converter')
      await t.aguardarResultado(120000)
      const rs = await t.js('return await __t.resultados()')
      assert.ok(rs.length === 3 && rs.every((r) => r.tipo === 'avif'), JSON.stringify(rs))
    },
  },
  {
    nome: 'imagem/converter: PNG → WebP mantém a transparência',
    pagina: '/imagem/converter',
    async executar(t) {
      await enviar(t, png(400, 300, true))
      await t.clicar('WebP')
      await t.clicar('Converter')
      await t.aguardarResultado()
      assert.equal((await t.js('return await __t.resultados()'))[0].tipo, 'webp')
      assert.equal((await pixel(t, 5, 5))[3], 0, 'o canto transparente deveria continuar transparente')
    },
  },
  {
    nome: 'imagem/converter: SVG 100×50 em 2× → PNG 200×100',
    pagina: '/imagem/converter',
    async executar(t) {
      await enviar(t, `[new File([${JSON.stringify(SVG)}], 'logo.svg', { type: 'image/svg+xml' })]`)
      await t.clicar('PNG')
      await t.js(`__t.digitar('Tamanho dos SVGs', '2')`)
      await t.clicar('Converter')
      await t.aguardarResultado()
      const [r] = await t.js('return await __t.resultados()')
      assert.equal(r.tipo, 'png')
      assert.deepEqual([r.largura, r.altura], [200, 100])
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
      await t.clicar('Aplicar')
      await t.aguardarResultado()
      const [r] = await t.js('return await __t.resultados()')
      assert.deepEqual([r.largura, r.altura], [480, 480])
      assert.equal(r.nome, 'teste-editada.png')
    },
  },
  {
    nome: 'imagem/editor: girar 90° troca largura e altura',
    pagina: '/imagem/editor',
    async executar(t) {
      await enviar(t, png(640, 480, false))
      await aba(t, 'Girar')
      await t.clicar('Horário')
      await t.clicar('Aplicar')
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
      await t.clicar('Aplicar')
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
      await t.clicar('Aplicar')
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
