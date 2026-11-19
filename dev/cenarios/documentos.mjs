import assert from 'node:assert/strict'
import { strToU8, unzipSync, zipSync } from 'fflate'
import { enviar, formato, lerPdf } from './comum.mjs'

/** DOCX mínimo válido (abre no Word e no LibreOffice). */
function docxTeste({ paragrafos = ['Relatório anual', 'Texto com acentuação: ação, coração.'], autor } = {}) {
  const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
  const corpo = paragrafos.map((p) => `<w:p><w:r><w:t xml:space="preserve">${p}</w:t></w:r></w:p>`).join('')
  const arquivos = {
    '[Content_Types].xml': strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>`),
    '_rels/.rels': strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>`),
    'word/document.xml': strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="${W}"><w:body>${corpo}</w:body></w:document>`),
    'docProps/core.xml': strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>Teste</dc:title>${autor ? `<dc:creator>${autor}</dc:creator><cp:lastModifiedBy>${autor}</cp:lastModifiedBy>` : ''}<dcterms:created xsi:type="dcterms:W3CDTF">2026-01-02T10:00:00Z</dcterms:created></cp:coreProperties>`),
  }
  return zipSync(arquivos)
}

/** ODT mínimo válido: "mimetype" primeiro e sem compressão. */
function odtTeste(texto = 'Documento ODT de teste') {
  return zipSync({
    mimetype: [strToU8('application/vnd.oasis.opendocument.text'), { level: 0 }],
    'META-INF/manifest.xml': strToU8(`<?xml version="1.0" encoding="UTF-8"?><manifest:manifest xmlns:manifest="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0" manifest:version="1.3"><manifest:file-entry manifest:full-path="/" manifest:media-type="application/vnd.oasis.opendocument.text"/><manifest:file-entry manifest:full-path="content.xml" manifest:media-type="text/xml"/></manifest:manifest>`),
    'content.xml': strToU8(`<?xml version="1.0" encoding="UTF-8"?><office:document-content xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0" office:version="1.3"><office:body><office:text><text:p>${texto}</text:p></office:text></office:body></office:document-content>`),
  })
}

const arquivo = (bytes, nome) => `new File([Uint8Array.from(atob('${Buffer.from(bytes).toString('base64')}'), (c) => c.charCodeAt(0))], '${nome}')`
const CAPTURAR = `window.__baixados = []; const __orig = URL.createObjectURL.bind(URL); URL.createObjectURL = (b) => { if (b instanceof Blob) window.__baixados.push(b); return __orig(b) }`

/** Os conversores com LibreOffice só existem no build com VITE_DOCUMENTOS=1 e o contêiner rodando. */
const comServidor = Boolean(process.env.DOCUMENTOS_URL)

export default [
  ...(comServidor
    ? [
        {
          nome: 'converter: DOCX para PDF, LibreOffice mantém o texto',
          pagina: '/converter',
          async executar(t) {
            await enviar(t, `[${arquivo(docxTeste(), 'relatorio.docx')}]`)
            await formato(t, 'PDF')
            await t.clicar('Converter')
            await t.aguardarResultado(120000)
            const r = await lerPdf(await t.js('return await __t.bytes()'))
            assert.ok(r.textos[0].includes('Relatório anual') && r.textos[0].includes('coração'), r.textos[0])
          },
        },
        {
          nome: 'converter: ODT vira DOCX',
          pagina: '/converter',
          async executar(t) {
            await enviar(t, `[${arquivo(odtTeste(), 'texto.odt')}]`)
            await formato(t, 'DOCX')
            await t.clicar('Converter')
            await t.aguardarResultado(120000)
            const zip = unzipSync(new Uint8Array(await t.js('return await __t.bytes()')))
            assert.ok(Buffer.from(zip['word/document.xml']).toString().includes('Documento ODT de teste'))
          },
        },
      ]
    : []),
  {
    nome: 'documentos/texto: DOCX vira .txt com contagem',
    pagina: '/documentos/texto',
    async executar(t) {
      await enviar(t, `[${arquivo(docxTeste(), 'relatorio.docx')}]`)
      await t.clicar('Ler documento')
      await t.aguardarResultado()
      assert.equal(await t.js('return await __t.texto()'), 'Relatório anual\nTexto com acentuação: ação, coração.')
    },
  },
  {
    nome: 'documentos/texto: ODT e RTF',
    pagina: '/documentos/texto',
    async executar(t) {
      await enviar(t, `[${arquivo(odtTeste('Olá do ODT'), 'a.odt')}]`)
      await t.clicar('Ler documento')
      await t.aguardarResultado()
      assert.equal(await t.js('return await __t.texto()'), 'Olá do ODT')
      await t.clicar('Nova operação')
      const rtf = String.raw`{\rtf1\ansi{\fonttbl{\f0 Arial;}}\f0 Cora\'e7\'e3o \b forte\b0\par Segunda linha}`
      await enviar(t, `[new File([${JSON.stringify(rtf)}], 'b.rtf')]`)
      await t.clicar('Ler documento')
      await t.aguardarResultado()
      assert.equal(await t.js('return await __t.texto()'), 'Coração forte\nSegunda linha')
    },
  },
  {
    nome: 'documentos/texto: contar palavras de texto colado',
    pagina: '/documentos/texto',
    async executar(t) {
      await t.clicar('Colar texto')
      await t.js(`__t.digitar('Texto', 'Um texto curto. Tem duas frases e guarda-chuva conta como uma!')`)
      const valor = await t.js(`return [...document.querySelectorAll('main dl div')].find((d) => d.querySelector('dt')?.textContent === 'Palavras')?.querySelector('dd')?.textContent`)
      assert.equal(valor, '11')
      const frases = await t.js(`return [...document.querySelectorAll('main dl div')].find((d) => d.querySelector('dt')?.textContent === 'Frases')?.querySelector('dd')?.textContent`)
      assert.equal(frases, '2')
    },
  },
  {
    nome: 'documentos/metadados: mostra e remove o autor do DOCX',
    pagina: '/documentos/metadados',
    async executar(t) {
      await t.js(`__t.enviar([${arquivo(docxTeste({ autor: 'Fulano de Tal' }), 'contrato.docx')}])`)
      await t.aguardar('document.querySelector("main").innerText.includes("Fulano de Tal")', 15000)
      await t.clicar('Remover metadados')
      await t.aguardarResultado()
      const zip = unzipSync(new Uint8Array(await t.js('return await __t.bytes()')))
      const core = Buffer.from(zip['docProps/core.xml']).toString()
      assert.ok(!core.includes('Fulano'), core)
      assert.ok(Buffer.from(zip['word/document.xml']).toString().includes('Relatório anual'), 'o conteúdo mudou')
    },
  },
  {
    nome: 'documentos/markdown: gera HTML',
    pagina: '/documentos/markdown',
    async executar(t) {
      await t.js(CAPTURAR)
      await t.js(`__t.digitar('Markdown', '# Olá\\n\\nTexto **forte**.')`)
      await t.aguardar('document.querySelector("main iframe")?.srcdoc.includes("<strong>forte</strong>")', 10000)
      await t.clicar('Baixar HTML')
      await t.confirmarBaixar()
      await t.aguardar('window.__baixados.length > 0', 10000)
      const html = await t.js('return await window.__baixados.at(-1).text()')
      assert.ok(html.includes('<h1>Olá</h1>') && html.includes('<title>Olá</title>'), html.slice(0, 300))
    },
  },
  {
    nome: 'documentos/visualizar: DOCX aparece formatado',
    pagina: '/documentos/visualizar',
    async executar(t) {
      await t.js(`__t.enviar([${arquivo(docxTeste(), 'relatorio.docx')}])`)
      await t.aguardar('document.querySelector("main .docx-wrapper")?.innerText.includes("Relatório anual")', 20000)
    },
  },
]
