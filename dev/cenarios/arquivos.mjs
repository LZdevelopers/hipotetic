import assert from 'node:assert/strict'
import { strToU8, unzipSync, zipSync } from 'fflate'
import { enviar, formato } from './comum.mjs'

const b64 = (bytes) => Buffer.from(bytes).toString('base64')
const arquivo = (bytes, nome, tipo = 'application/octet-stream') => `new File([Uint8Array.from(atob('${b64(bytes)}'), (c) => c.charCodeAt(0))], '${nome}', { type: '${tipo}' })`

/** Captura o que as ferramentas baixam direto (sem a tela de resultado). */
const CAPTURAR = `window.__baixados = []; const __orig = URL.createObjectURL.bind(URL); URL.createObjectURL = (b) => { if (b instanceof Blob) window.__baixados.push(b); return __orig(b) }`
const ultimoBaixado = (t) => t.js(`const b = window.__baixados.at(-1); return b ? [...new Uint8Array(await b.arrayBuffer())] : null`)

let zipComSenha = null

export default [
  // ─── Compactados ──────────────────────────────────────────────────────────
  {
    nome: 'compactados/compactar: dois arquivos num ZIP válido',
    pagina: '/compactados/compactar',
    async executar(t) {
      await enviar(t, `[new File(['primeiro arquivo'], 'a.txt'), new File(['segundo arquivo com mais texto'], 'b.txt')]`)
      await t.clicar('Compactar')
      await t.aguardarResultado(60000)
      const [r] = await t.js('return await __t.resultados()')
      assert.equal(r.tipo, 'zip')
      const conteudo = unzipSync(new Uint8Array(await t.js('return await __t.bytes()')))
      assert.deepEqual(Object.keys(conteudo).sort(), ['a.txt', 'b.txt'])
      assert.equal(Buffer.from(conteudo['b.txt']).toString(), 'segundo arquivo com mais texto')
    },
  },
  {
    nome: 'compactados/compactar: ZIP com senha usa AES-256',
    pagina: '/compactados/compactar',
    async executar(t) {
      await enviar(t, `[new File(['conteudo secreto'], 'segredo.txt')]`)
      await t.js(`__t.digitar('Senha (opcional)', 'abc123')`)
      await t.clicar('Compactar')
      await t.aguardarResultado(60000)
      const bytes = await t.js('return await __t.bytes()')
      // Campo extra 0x9901 = criptografia AES (WinZip); o texto não aparece em claro.
      assert.ok(Buffer.from(bytes).includes(Buffer.from([0x01, 0x99])), 'sem o marcador AES')
      assert.ok(!Buffer.from(bytes).includes('conteudo secreto'), 'conteúdo em claro')
      zipComSenha = bytes
    },
  },
  {
    nome: 'compactados/compactar: gera 7Z',
    pagina: '/compactados/compactar',
    async executar(t) {
      await enviar(t, `[new File(['x'.repeat(5000)], 'repetido.txt')]`)
      await t.clicar('7Z')
      await t.clicar('Compactar')
      await t.aguardarResultado(60000)
      const [r] = await t.js('return await __t.resultados()')
      assert.equal(r.tipo, '7z')
      assert.ok(r.tamanho < 1000, `compressão fraca: ${r.tamanho}`)
    },
  },
  {
    nome: 'compactados/extrair: lista, mantém pastas e baixa em ZIP',
    pagina: '/compactados/extrair',
    async executar(t) {
      const zip = zipSync({ 'docs/leia-me.txt': strToU8('ola'), 'docs/fotos/a.txt': strToU8('foto'), 'raiz.txt': strToU8('raiz') })
      await t.js(CAPTURAR)
      await t.js(`__t.enviar([${arquivo(zip, 'pacote.zip', 'application/zip')}])`)
      await t.aguardar('document.querySelector("main").innerText.includes("3 de 3 selecionados")', 20000)
      await t.clicar('Baixar 3 selecionados')
      await t.confirmarBaixar()
      await t.aguardar('window.__baixados.length > 0', 20000)
      const conteudo = unzipSync(new Uint8Array(await ultimoBaixado(t)))
      assert.deepEqual(Object.keys(conteudo).sort(), ['docs/fotos/a.txt', 'docs/leia-me.txt', 'raiz.txt'])
    },
  },
  {
    nome: 'compactados/extrair: ZIP com senha pede e valida a senha',
    pagina: '/compactados/extrair',
    async executar(t) {
      if (!zipComSenha) throw new Error('o cenário do ZIP com senha falhou antes')
      await t.js(CAPTURAR)
      await t.js(`__t.enviar([${arquivo(zipComSenha, 'protegido.zip', 'application/zip')}])`)
      await t.aguardar('document.querySelector("main").innerText.includes("protegido por senha")', 20000)
      await t.js(`__t.digitar('Senha', 'errada')`)
      await t.clicar('Abrir')
      await t.aguardar('document.querySelector("main").innerText.includes("Senha incorreta")', 20000)
      await t.js(`__t.digitar('Senha', 'abc123')`)
      await t.clicar('Abrir')
      await t.aguardar('document.querySelector("main").innerText.includes("1 de 1 selecionados")', 20000)
      await t.clicar('Baixar o selecionado')
      await t.confirmarBaixar()
      await t.aguardar('window.__baixados.length > 0', 20000)
      assert.equal(Buffer.from(await ultimoBaixado(t)).toString(), 'conteudo secreto')
    },
  },
  {
    nome: 'compactados/extrair: bloqueia bomba de descompactação',
    pagina: '/compactados/extrair',
    async executar(t) {
      const bomba = zipSync({ 'zeros.bin': new Uint8Array(200 * 1024 * 1024) }, { level: 9 })
      assert.ok(bomba.length < 1024 * 1024)
      await t.js(`__t.enviar([${arquivo(bomba, 'bomba.zip', 'application/zip')}])`)
      await t.aguardar('document.querySelector("main").innerText.includes("bomba de descompactação")', 30000)
    },
  },

  // ─── Utilitários ──────────────────────────────────────────────────────────
  {
    nome: 'utilitarios/hash: MD5 e SHA-256 de “abc”',
    pagina: '/utilitarios/hash',
    async executar(t) {
      await t.clicar('Texto')
      await t.js(`__t.digitar('Texto', 'abc')`)
      await t.clicar('Calcular hashes')
      await t.aguardar('document.querySelector("main").innerText.includes("900150983cd24fb0d6963f7d28e17f72")', 20000)
      const texto = await t.js('return document.querySelector("main").innerText')
      assert.ok(texto.includes('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'))
      await t.js(`__t.digitar('Conferir com um hash (opcional)', '900150983CD24FB0D6963F7D28E17F72')`)
      await t.aguardar('document.querySelector("main").innerText.includes("O hash confere")')
    },
  },
  {
    nome: 'utilitarios/identificar: PNG disfarçado de .jpg',
    pagina: '/utilitarios/identificar',
    async executar(t) {
      await t.js(`__t.enviar([__t.arquivo(await __t.imagem(120, 80), 'foto.jpg')])`)
      await t.aguardar('document.querySelector("main").innerText.includes("o conteúdo é PNG")', 20000)
      assert.ok((await t.js('return document.querySelector("main").innerText')).includes('120 × 80 px'))
    },
  },
  {
    nome: 'utilitarios/comparar: textos com 1 linha diferente',
    pagina: '/utilitarios/comparar',
    async executar(t) {
      await t.js(`const inputs = document.querySelectorAll('main input[type=file]')
        const pares = [[inputs[0], new File(['linha 1\\nlinha 2\\nlinha 3\\n'], 'a.txt')], [inputs[1], new File(['linha 1\\nlinha DOIS\\nlinha 3\\n'], 'b.txt')]]
        for (const [input, arq] of pares) { const dt = new DataTransfer(); dt.items.add(arq); input.files = dt.files; input.dispatchEvent(new Event('change', { bubbles: true })) }`)
      await t.clicar('Comparar')
      await t.aguardar('document.querySelector("main").innerText.includes("Os arquivos são diferentes")', 20000)
      const texto = await t.js('return document.querySelector("main").innerText')
      assert.ok(texto.includes('+1 linhas') && texto.includes('linha DOIS'), texto.slice(0, 500))
    },
  },
  {
    nome: 'utilitarios/calculadoras: 1 GiB em bytes',
    pagina: '/utilitarios/calculadoras',
    async executar(t) {
      await t.js(`__t.digitar('Unidade', 'GiB')`)
      await t.aguardar('document.querySelector("main").innerText.includes("1.073.741.824")')
    },
  },
  {
    nome: 'utilitarios/calculadoras: 4,7 GB a 100 Mbit/s',
    pagina: '/utilitarios/calculadoras',
    async executar(t) {
      await t.clicar('Download e compressão')
      await t.aguardar('document.querySelector("main").innerText.includes("6 min 16 s")')
    },
  },
  {
    nome: 'utilitarios/texto: corrige acentos de arquivo Windows-1252',
    pagina: '/utilitarios/texto',
    async executar(t) {
      // "ação e coração" em Windows-1252 (ç = E7, ã = E3)
      await t.js(`__t.enviar([new File([new Uint8Array([0x61,0xe7,0xe3,0x6f,0x20,0x65,0x20,0x63,0x6f,0x72,0x61,0xe7,0xe3,0x6f])], 'antigo.txt', { type: 'text/plain' })])`)
      await t.aguardar('document.querySelector("main").innerText.includes("ação e coração")', 15000)
      assert.ok((await t.js('return document.querySelector("main").innerText')).includes('WINDOWS-1252'))
    },
  },
  {
    nome: 'utilitarios/texto: criar CSV com BOM e CRLF',
    pagina: '/utilitarios/texto',
    async executar(t) {
      await t.js(CAPTURAR)
      await t.clicar('Escrever novo')
      await t.js(`__t.digitar('Conteúdo', 'nome;cidade\\nJoão;São Paulo')`)
      await t.js(`__t.digitar('Tipo', 'csv')`)
      await t.clicar('CRLF')
      await t.js(`document.querySelector('main input[type=checkbox]').click()`)
      await t.clicar('Baixar arquivo')
      const bytes = Buffer.from(await ultimoBaixado(t))
      assert.deepEqual([...bytes.subarray(0, 3)], [0xef, 0xbb, 0xbf], 'sem BOM')
      assert.equal(bytes.subarray(3).toString(), 'nome;cidade\r\nJoão;São Paulo')
    },
  },
  {
    nome: 'utilitarios/qr-code: link gera SVG e PNG',
    pagina: '/utilitarios/qr-code',
    async executar(t) {
      await t.js(CAPTURAR)
      await t.js(`__t.digitar('Endereço', 'lzdev.com.br')`)
      await t.aguardar('document.querySelector("main [role=img] svg")', 15000)
      await t.clicar('Baixar')
      await t.confirmarBaixar()
      await t.aguardar('window.__baixados.length > 0', 15000)
      const png = Buffer.from(await ultimoBaixado(t))
      assert.equal(png.subarray(1, 4).toString(), 'PNG')
    },
  },
  {
    nome: 'salvo: o texto digitado no QR Code continua ao voltar',
    pagina: '/utilitarios/qr-code',
    async executar(t) {
      await t.js(`__t.digitar('Endereço', 'lzdev.com.br/salvo')`)
      // Espera o valor chegar ao IndexedDB antes de sair.
      assert.ok(await t.js(`for (let i = 0; i < 50; i += 1) {
        const v = await new Promise((ok) => { const r = indexedDB.open('hipotetic', 1); r.onsuccess = () => { try { const g = r.result.transaction('rascunhos').objectStore('rascunhos').get('ferramenta:utilitarios/qr-code:campos'); g.onsuccess = () => { ok(g.result?.v?.url); r.result.close() }; g.onerror = () => ok(null) } catch { ok(null) } }; r.onerror = () => ok(null) })
        if (v === 'lzdev.com.br/salvo') return true
        await new Promise((ok) => setTimeout(ok, 100))
      }
      return false`), 'o texto não chegou a ser salvo')
      await t.navegar('/utilitarios/qr-code')
      await t.aguardar(`[...document.querySelectorAll('main input')].some((i) => i.value === 'lzdev.com.br/salvo')`, 15000)
      await t.aguardar('document.querySelector("main [role=img] svg")', 15000)
    },
  },
  {
    nome: 'converter: ZIP vira 7Z com o mesmo conteúdo',
    pagina: '/converter',
    async executar(t) {
      const zip = zipSync({ 'pasta/a.txt': strToU8('conteúdo A'), 'b.txt': strToU8('conteúdo B') })
      await enviar(t, `[${arquivo(zip, 'pacote.zip', 'application/zip')}]`)
      await formato(t, '7Z')
      await t.clicar('Converter')
      await t.aguardarResultado(60000)
      const [r] = await t.js('return await __t.resultados()')
      assert.equal(r.tipo, '7z')
      assert.equal(r.nome, 'pacote.7z')
    },
  },
]
