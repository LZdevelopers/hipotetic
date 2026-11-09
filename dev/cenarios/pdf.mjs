import assert from 'node:assert/strict'
import { PDFDocument, StandardFonts } from 'pdf-lib'
import { arquivoPdf, enviar, lerPdf, pdfTeste } from './comum.mjs'

const bytesDoResultado = (t, i = 0) => t.js(`return await __t.bytes(${i})`)

export default [
  {
    nome: 'pdf/unir: 2 + 3 páginas na ordem da lista',
    pagina: '/pdf/unir',
    async executar(t) {
      await enviar(t, `[${arquivoPdf(await pdfTeste(2, { prefixo: 'Alfa' }), 'a.pdf')}, ${arquivoPdf(await pdfTeste(3, { prefixo: 'Beta' }), 'b.pdf')}]`)
      await t.clicar('Unir PDFs')
      await t.aguardarResultado()
      const r = await lerPdf(await bytesDoResultado(t))
      assert.equal(r.paginas, 5)
      assert.ok(r.textos[0].includes('Alfa 1') && r.textos[2].includes('Beta 1'), r.textos.join(' | '))
    },
  },
  {
    nome: 'pdf/dividir: cada página e por intervalos',
    pagina: '/pdf/dividir',
    async executar(t) {
      await enviar(t, `[${arquivoPdf(await pdfTeste(3))}]`)
      await t.clicar('Dividir PDF')
      await t.aguardarResultado()
      assert.equal((await t.js('return await __t.resultados()')).length, 3)
      await t.clicar('Ajustar e refazer')
      await t.clicar('Intervalos')
      await t.js(`__t.digitar('Intervalos', '1-2, 3')`)
      await t.clicar('Dividir PDF')
      await t.aguardarResultado()
      const rs = await t.js('return await __t.resultados()')
      assert.deepEqual(
        rs.map((r) => r.nome),
        ['doc-p1-2.pdf', 'doc-p3.pdf'],
      )
      assert.equal((await lerPdf(await bytesDoResultado(t, 0))).paginas, 2)
    },
  },
  {
    nome: 'pdf/dividir: extrair 3 e 1, nessa ordem',
    pagina: '/pdf/dividir',
    async executar(t) {
      await enviar(t, `[${arquivoPdf(await pdfTeste(3))}]`)
      await t.clicar('Extrair')
      await t.js(`__t.digitar('Páginas', '3, 1')`)
      await t.clicar('Dividir PDF')
      await t.aguardarResultado()
      const r = await lerPdf(await bytesDoResultado(t))
      assert.equal(r.paginas, 2)
      assert.ok(r.textos[0].includes('Pagina 3') && r.textos[1].includes('Pagina 1'), r.textos.join(' | '))
    },
  },
  {
    nome: 'pdf/converter: PDF para JPG a 150 dpi',
    pagina: '/pdf/converter',
    async executar(t) {
      await enviar(t, `[${arquivoPdf(await pdfTeste(2))}]`)
      await t.clicar('Converter páginas')
      await t.aguardarResultado()
      const rs = await t.js('return await __t.resultados()')
      assert.equal(rs.length, 2)
      assert.ok(
        rs.every((r) => r.tipo === 'jpg' && r.largura === 1240),
        JSON.stringify(rs),
      )
    },
  },
  {
    nome: 'pdf/converter: 2 imagens viram 2 páginas A4',
    pagina: '/pdf/converter',
    async executar(t) {
      await t.clicar('Imagens para PDF')
      await enviar(t, `[__t.arquivo(await __t.imagem(800, 600, 'image/jpeg'), 'a.jpg'), __t.arquivo(await __t.imagem(400, 700), 'b.png')]`)
      await t.clicar('Criar PDF')
      await t.aguardarResultado()
      const r = await lerPdf(await bytesDoResultado(t))
      assert.equal(r.paginas, 2)
      const { width, height } = r.doc.getPage(0).getSize()
      assert.deepEqual([Math.round(width), Math.round(height)], [842, 595], 'a 1ª imagem é deitada: A4 paisagem')
    },
  },
  {
    nome: 'pdf/converter: PDF para texto',
    pagina: '/pdf/converter',
    async executar(t) {
      await t.clicar('PDF para texto')
      await t.js(`__t.enviar([${arquivoPdf(await pdfTeste(2))}])`)
      await t.clicar('Extrair texto')
      await t.aguardarResultado()
      const texto = await t.js('return await __t.texto()')
      assert.ok(texto.includes('--- Página 2 ---') && texto.includes('Pagina 2'), texto)
    },
  },
  {
    nome: 'pdf/numerar-marca-dagua: numerar, “2 / 3” na página 2',
    pagina: '/pdf/numerar-marca-dagua',
    async executar(t) {
      await enviar(t, `[${arquivoPdf(await pdfTeste(3))}]`)
      await t.clicar('Numerar páginas')
      await t.aguardarResultado()
      const r = await lerPdf(await bytesDoResultado(t))
      assert.ok(r.textos[1].includes('2 / 3'), r.textos[1])
    },
  },
  {
    nome: 'pdf/numerar-marca-dagua: marca d’água em todas as páginas',
    pagina: '/pdf/numerar-marca-dagua',
    async executar(t) {
      await t.clicar('Marca d’água')
      await enviar(t, `[${arquivoPdf(await pdfTeste(2))}]`)
      await t.clicar('Aplicar marca')
      await t.aguardarResultado()
      const r = await lerPdf(await bytesDoResultado(t))
      assert.ok(
        r.textos.every((x) => x.includes('CONFIDENCIAL')),
        r.textos.join(' | '),
      )
    },
  },
  {
    nome: 'pdf/senha: proteger (AES-256) e remover com senha errada e certa',
    pagina: '/pdf/senha',
    async executar(t) {
      await enviar(t, `[${arquivoPdf(await pdfTeste(3))}]`)
      await t.js(`__t.digitar('Senha para abrir', 'segredo1'); __t.digitar('Repita a senha', 'segredo1')`)
      await t.clicar('Proteger PDF')
      await t.aguardarResultado()
      const protegido = await bytesDoResultado(t)
      assert.ok(Buffer.from(protegido).includes('/Encrypt'), 'deveria estar criptografado')

      await t.navegar('/pdf/senha')
      await t.clicar('Remover senha')
      await enviar(t, `[${arquivoPdf(Buffer.from(protegido).toString('base64'), 'protegido.pdf')}]`)
      await t.js(`__t.digitar('Senha do PDF', 'errada')`)
      await t.clicar('Desbloquear')
      await t.aguardar('document.querySelector("[role=alert]")?.textContent.includes("Senha incorreta")', 30000)
      await t.js(`__t.digitar('Senha do PDF', 'segredo1')`)
      await t.clicar('Desbloquear')
      await t.aguardarResultado()
      const r = await lerPdf(await bytesDoResultado(t))
      assert.ok(!r.cifrado, 'ainda criptografado')
      assert.equal(r.paginas, 3)
    },
  },
  {
    nome: 'pdf/comprimir: foto grande recomprimida, texto preservado',
    pagina: '/pdf/comprimir',
    async executar(t) {
      const jpg = await t.js(`return [...new Uint8Array(await (await __t.imagem(3000, 2000, 'image/jpeg', { qualidade: 0.98 })).arrayBuffer())]`)
      const doc = await PDFDocument.create()
      const img = await doc.embedJpg(new Uint8Array(jpg))
      const p = doc.addPage([595, 842])
      p.drawImage(img, { x: 20, y: 400, width: 555, height: 370 })
      p.drawText('Texto que deve continuar', { x: 40, y: 100, size: 20, font: await doc.embedFont(StandardFonts.Helvetica) })
      const original = Buffer.from(await doc.save())
      await enviar(t, `[${arquivoPdf(original.toString('base64'), 'foto.pdf')}]`)
      await t.clicar('Comprimir PDF')
      await t.aguardarResultado()
      const bytes = await bytesDoResultado(t)
      assert.ok(bytes.length < original.length * 0.6, `pouca redução: ${bytes.length} de ${original.length}`)
      assert.ok((await lerPdf(bytes)).textos[0].includes('Texto que deve continuar'))
    },
  },
  {
    nome: 'pdf/metadados: título e autor somem',
    pagina: '/pdf/metadados',
    async executar(t) {
      await t.js(`__t.enviar([${arquivoPdf(await pdfTeste(1, { titulo: 'Relatorio Secreto', autor: 'Fulano' }))}])`)
      await t.aguardar('document.querySelector("main").innerText.includes("Versão do PDF")', 15000)
      const campos = await t.js('return [...document.querySelectorAll("main input")].map((i) => i.value).join("|")')
      assert.ok(campos.includes('Relatorio Secreto') && campos.includes('Fulano'), campos)
      await t.clicar('Remover todos os metadados')
      await t.aguardarResultado()
      const r = await lerPdf(await bytesDoResultado(t))
      assert.equal(r.doc.getTitle(), undefined)
      assert.equal(r.doc.getAuthor(), undefined)
    },
  },
  {
    nome: 'pdf/organizar: excluir a 1ª página e girar a 2ª',
    pagina: '/pdf/organizar',
    async executar(t) {
      await t.js(`__t.enviar([${arquivoPdf(await pdfTeste(3))}])`)
      await t.aguardar('document.querySelectorAll("main li[draggable]").length === 3', 15000)
      await t.js(`document.querySelector('[aria-label="Excluir página 1"]').click()`)
      await t.aguardar('document.querySelectorAll("main li[draggable]").length === 2')
      await t.js(`document.querySelector('[aria-label="Girar página 1"]').click()`)
      await t.clicar('Salvar PDF')
      await t.aguardarResultado()
      const r = await lerPdf(await bytesDoResultado(t))
      assert.equal(r.paginas, 2)
      assert.deepEqual(r.rotacoes, [90, 0])
      assert.ok(r.textos[0].includes('Pagina 2'), r.textos.join(' | '))
    },
  },
  {
    nome: 'pdf/editar: texto inserido no PDF',
    pagina: '/pdf/editar',
    async executar(t) {
      await t.js(`__t.enviar([${arquivoPdf(await pdfTeste(1))}])`)
      await t.aguardar(`document.querySelector('main canvas[aria-label="Página 1"]')`, 15000)
      await t.esperar(500)
      await t.js(`const c = document.querySelector('main canvas[aria-label="Página 1"]').parentElement; const r = c.getBoundingClientRect();
        c.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: r.left + r.width * 0.3, clientY: r.top + r.height * 0.5 }))`)
      await t.aguardar('document.querySelectorAll("main textarea").length > 0')
      await t.js(`__t.digitar('Texto', 'Aprovado em 2026')`)
      await t.clicar('Salvar PDF')
      await t.aguardarResultado()
      const r = await lerPdf(await bytesDoResultado(t))
      assert.ok(r.textos[0].includes('Aprovado em 2026'), r.textos[0])
    },
  },
  {
    nome: 'pdf/comparar: acha a página alterada',
    pagina: '/pdf/comparar',
    async executar(t) {
      const a = await pdfTeste(3, { textos: ['Contrato versao um', 'Clausula de prazo', 'Assinaturas'] })
      const b = await pdfTeste(3, { textos: ['Contrato versao um', 'Clausula de multa', 'Assinaturas'] })
      await t.js(`const inputs = document.querySelectorAll('main input[type=file]')
        for (const [i, b64] of [[0, '${a}'], [1, '${b}']]) {
          const dt = new DataTransfer()
          dt.items.add(new File([Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))], 'v' + i + '.pdf', { type: 'application/pdf' }))
          inputs[i].files = dt.files
          inputs[i].dispatchEvent(new Event('change', { bubbles: true }))
        }`)
      await t.clicar('Comparar')
      await t.aguardar('document.querySelector("main").innerText.includes("1 página com diferenças")', 30000)
      const texto = await t.js('return document.querySelector("main").innerText')
      assert.ok(/prazo/.test(texto) && /multa/.test(texto), texto.slice(0, 400))
    },
  },
  {
    nome: 'pdf/ocr: PDF escaneado vira pesquisável',
    pagina: '/pdf/ocr',
    async executar(t) {
      // Uma página que é só imagem, como um documento escaneado.
      const png = await t.js(`const c = document.createElement('canvas'); c.width = 1240; c.height = 600; const x = c.getContext('2d')
        x.fillStyle = '#fff'; x.fillRect(0, 0, 1240, 600); x.fillStyle = '#000'
        x.font = 'bold 72px Arial'; x.fillText('RECIBO DE TESTE 2026', 60, 200)
        x.font = '48px Arial'; x.fillText('Valor total pago', 60, 360)
        return [...new Uint8Array(await (await new Promise((ok) => c.toBlob(ok, 'image/png'))).arrayBuffer())]`)
      const doc = await PDFDocument.create()
      const img = await doc.embedPng(new Uint8Array(png))
      doc.addPage([595, 288]).drawImage(img, { x: 0, y: 0, width: 595, height: 288 })
      await enviar(t, `[${arquivoPdf(Buffer.from(await doc.save()).toString('base64'), 'scan.pdf')}]`)
      await t.clicar('Reconhecer texto')
      await t.aguardarResultado(240000)
      const r = await lerPdf(await bytesDoResultado(t))
      assert.ok(/RECIBO/i.test(r.textos[0]) && /TESTE/i.test(r.textos[0]), r.textos[0])
    },
  },
]
