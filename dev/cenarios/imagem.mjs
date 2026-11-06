import assert from 'node:assert/strict'
import { SVG, enviar, jpg, png } from './comum.mjs'

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
      assert.equal(rs.length, 3)
      assert.ok(rs.every((r) => r.tipo === 'avif'), JSON.stringify(rs))
      assert.deepEqual(rs.map((r) => r.nome), ['a.avif', 'b.avif', 'c.avif'])
    },
  },
  {
    nome: 'imagem/png-para-webp: mantém a transparência',
    pagina: '/imagem/png-para-webp',
    async executar(t) {
      await enviar(t, png(400, 300, true))
      await t.clicar('Converter')
      await t.aguardarResultado()
      const [r] = await t.js('return await __t.resultados()')
      assert.equal(r.tipo, 'webp')
      const alfa = await t.js(`
        const a = document.querySelector('section[aria-label=Resultado] a[download]')
        const bmp = await createImageBitmap(await (await fetch(a.href)).blob())
        const c = new OffscreenCanvas(bmp.width, bmp.height); const ctx = c.getContext('2d'); ctx.drawImage(bmp, 0, 0)
        return ctx.getImageData(5, 5, 1, 1).data[3]`)
      assert.equal(alfa, 0, 'o canto transparente deveria continuar transparente')
    },
  },
  {
    nome: 'imagem/svg-para-png: SVG 100×50 em 2× → 200×100',
    pagina: '/imagem/svg-para-png',
    async executar(t) {
      await enviar(t, `[new File([${JSON.stringify(SVG)}], 'logo.svg', { type: 'image/svg+xml' })]`)
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
      const original = await t.js(`return document.body.textContent.match(/antes\\)/) ? 1 : 0`)
      assert.equal(r.tipo, 'jpg')
      assert.equal(r.largura, 1280)
      assert.ok(original, 'deveria mostrar o tamanho de antes')
    },
  },
  {
    nome: 'imagem/redimensionar: 50% e largura fixa com proporção',
    pagina: '/imagem/redimensionar',
    async executar(t) {
      await enviar(t, png(640, 480, false))
      await t.clicar('Redimensionar')
      await t.aguardarResultado()
      let [r] = await t.js('return await __t.resultados()')
      assert.deepEqual([r.largura, r.altura], [320, 240])
      await t.clicar('Ajustar e refazer')
      await t.clicar('Largura × altura')
      await t.js(`__t.digitar('Largura', 100)`)
      await t.clicar('Redimensionar')
      await t.aguardarResultado()
      ;[r] = await t.js('return await __t.resultados()')
      assert.deepEqual([r.largura, r.altura], [100, 75])
    },
  },
  {
    nome: 'imagem/recortar: proporção 1:1',
    pagina: '/imagem/recortar',
    async executar(t) {
      await t.js(`__t.enviar(${png(640, 480, false)})`)
      await t.aguardar(`document.querySelector('[role=slider]')`)
      await t.clicar('1:1')
      await t.clicar('Recortar')
      await t.aguardarResultado()
      const [r] = await t.js('return await __t.resultados()')
      assert.deepEqual([r.largura, r.altura], [480, 480])
      assert.equal(r.nome, 'teste-recortada.png')
    },
  },
  {
    nome: 'imagem/girar: 90° troca largura e altura',
    pagina: '/imagem/girar',
    async executar(t) {
      await enviar(t, png(640, 480, false))
      await t.clicar('Aplicar')
      await t.aguardarResultado()
      const [r] = await t.js('return await __t.resultados()')
      assert.deepEqual([r.largura, r.altura], [480, 640])
    },
  },
  {
    nome: 'imagem/ajustar: preto e branco gera pixels cinza',
    pagina: '/imagem/ajustar',
    async executar(t) {
      await enviar(t, png(300, 200, false))
      await t.clicar('Preto e branco')
      await t.clicar('Aplicar')
      await t.aguardarResultado()
      const px = await t.js(`
        const a = document.querySelector('section[aria-label=Resultado] a[download]')
        const bmp = await createImageBitmap(await (await fetch(a.href)).blob())
        const c = new OffscreenCanvas(bmp.width, bmp.height); const ctx = c.getContext('2d'); ctx.drawImage(bmp, 0, 0)
        return [...ctx.getImageData(150, 30, 1, 1).data]`)
      assert.ok(Math.abs(px[0] - px[1]) <= 2 && Math.abs(px[1] - px[2]) <= 2, `pixel não é cinza: ${px}`)
    },
  },
  {
    nome: 'imagem/remover-metadados: tira câmera e GPS sem recomprimir',
    pagina: '/imagem/remover-metadados',
    async executar(t) {
      await enviar(t, `[__t.arquivo(await __t.comExif(await __t.imagem(400, 300, 'image/jpeg')), 'gps.jpg')]`)
      await t.clicar('Remover metadados')
      await t.aguardarResultado()
      const [r] = await t.js('return await __t.resultados()')
      assert.equal(r.tipo, 'jpg')
      assert.deepEqual([r.largura, r.altura], [400, 300])
      const bytes = await t.js('return await __t.bytes()')
      const texto = String.fromCharCode(...bytes)
      assert.ok(!texto.includes('CameraTeste'), 'a câmera continua no arquivo')
      assert.ok(!texto.includes('Exif'), 'o EXIF continua no arquivo')
    },
  },
  {
    nome: 'imagem/informacoes: mostra câmera e alerta de GPS',
    pagina: '/imagem/informacoes',
    async executar(t) {
      await t.js(`__t.enviar([__t.arquivo(await __t.comExif(await __t.imagem(400, 300, 'image/jpeg')), 'gps.jpg')])`)
      await t.aguardar(`document.body.textContent.includes('CameraTeste')`, 15000)
      const texto = await t.js('return document.body.textContent')
      assert.ok(texto.includes('Esta foto revela onde foi tirada'))
      assert.ok(texto.includes('400 × 300 px'))
      assert.ok(texto.includes('-23.55'), 'latitude S deveria ser negativa')
    },
  },
  {
    nome: 'imagem/favicon: ICO + PNGs + manifesto',
    pagina: '/imagem/favicon',
    async executar(t) {
      await t.js(`__t.enviar(${png(512, 512, true)})`)
      await t.aguardar(`__t.habilitado('Gerar favicon')`)
      await t.clicar('Gerar favicon')
      await t.aguardarResultado()
      const rs = await t.js('return await __t.resultados()')
      const porNome = Object.fromEntries(rs.map((r) => [r.nome, r]))
      assert.equal(porNome['favicon.ico'].tipo, 'ico')
      assert.equal(porNome['apple-touch-icon.png'].largura, 180)
      assert.equal(porNome['android-chrome-512x512.png'].largura, 512)
      assert.ok(porNome['site.webmanifest'])
    },
  },
  {
    nome: 'imagem/tamanhos-redes-sociais: 4 tamanhos padrão',
    pagina: '/imagem/tamanhos-redes-sociais',
    async executar(t) {
      await enviar(t, png(800, 600, false))
      await t.clicar('Gerar')
      await t.aguardarResultado()
      const rs = await t.js('return await __t.resultados()')
      const medidas = rs.map((r) => `${r.largura}x${r.altura}`).sort()
      assert.deepEqual(medidas, ['1080x1080', '1080x1920', '1200x630', '1280x720'].sort())
    },
  },
  {
    nome: 'imagem/base64: gera data URI',
    pagina: '/imagem/base64',
    async executar(t) {
      await t.js(`__t.enviar(${png(64, 64, false)})`)
      await t.aguardar(`document.querySelector('textarea')?.value.startsWith('data:image/png;base64,iVBOR')`)
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
      await t.aguardar(`__t.habilitado('Gerar miniatura')`)
      await t.js(`__t.digitar('Título', 'Teste de miniatura')`)
      await t.clicar('Gerar miniatura')
      await t.aguardarResultado()
      const [r] = await t.js('return await __t.resultados()')
      assert.equal(r.tipo, 'jpg')
      assert.deepEqual([r.largura, r.altura], [1280, 720])
    },
  },
]
