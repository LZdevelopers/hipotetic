import { cpSync, existsSync, readFileSync } from 'node:fs'
import { request as httpRequest } from 'node:http'
import { fileURLToPath, pathToFileURL } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const API = fileURLToPath(new URL('./api', import.meta.url))
const DIST = fileURLToPath(new URL('./dist', import.meta.url))

/**
 * /api/documentos/* vai para o serviço LibreOffice (contêiner). Local:
 * DOCUMENTOS_URL=http://localhost:8090 npm run dev (com o contêiner rodando).
 */
function repassarDocumentos(req, res) {
  if (!req.url?.startsWith('/api/documentos/') || !process.env.DOCUMENTOS_URL) return false
  const destino = new URL(req.url, process.env.DOCUMENTOS_URL)
  const pedido = httpRequest(destino, { method: req.method, headers: { ...req.headers, host: destino.host } }, (resposta) => {
    res.writeHead(resposta.statusCode, resposta.headers)
    resposta.pipe(res)
  })
  pedido.on('error', () => {
    res.statusCode = 502
    res.end('{"erro":"indisponivel"}')
  })
  req.pipe(pedido)
  return true
}

const rotaDaApi = (url) => {
  const match = /^\/api\/([a-z0-9-]+)(?:\?|$)/.exec(url ?? '')
  const file = match && `${API}/${match[1]}.js`
  return file && existsSync(file) ? file : null
}

/**
 * Executa as funções de /api com a mesma assinatura (req, res) da Vercel —
 * sem isso seria preciso o Vercel CLI para testar o fluxo inteiro. Arquivos
 * em api/_lib não viram rota, igual à Vercel.
 *
 * - `npm run dev`: carrega pelo Vite (recarrega ao editar).
 * - `npm run preview`: serve o build com as funções, os cabeçalhos do
 *   vercel.json (CSP incluída) e as URLs limpas (/pdf/unir → pdf/unir.html)
 *   — o ensaio mais próximo da produção.
 */
function vercelFunctions() {
  return {
    name: 'vercel-functions',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (repassarDocumentos(req, res)) return
        const file = rotaDaApi(req.url)
        if (!file) return next()
        try {
          const { default: handler } = await server.ssrLoadModule(file)
          await handler(req, res)
        } catch (error) {
          next(error)
        }
      })
    },
    configurePreviewServer(server) {
      const { headers = [] } = JSON.parse(readFileSync(new URL('./vercel.json', import.meta.url), 'utf8'))
      // Só as regras sem condição (`has`) — as de host não valem em localhost.
      const globais = headers.filter((h) => h.source === '/(.*)' && !h.has).flatMap((h) => h.headers)
      server.middlewares.use(async (req, res, next) => {
        for (const { key, value } of globais) {
          // upgrade-insecure-requests quebraria o http://localhost.
          res.setHeader(key, value.replace('; upgrade-insecure-requests', ''))
        }
        if (repassarDocumentos(req, res)) return
        const file = rotaDaApi(req.url)
        if (file) {
          try {
            const { default: handler } = await import(pathToFileURL(file).href)
            await handler(req, res)
          } catch (error) {
            next(error)
          }
          return
        }
        // URLs limpas, como a Vercel (cleanUrls): /pdf/unir → /pdf/unir.html.
        const [caminho, busca = ''] = (req.url ?? '/').split('?')
        const limpo = caminho.replace(/\/+$/, '')
        if (limpo && !/\.[a-z0-9]+$/i.test(limpo)) {
          if (existsSync(`${DIST}${limpo}.html`)) {
            req.url = `${limpo}.html${busca ? `?${busca}` : ''}`
          } else {
            res.statusCode = 404
            res.setHeader('Content-Type', 'text/html; charset=utf-8')
            res.end(readFileSync(`${DIST}/404.html`))
            return
          }
        }
        next()
      })
    },
  }
}

/**
 * Arquivos de apoio de bibliotecas que rodam no navegador, servidos pelo
 * próprio site (sem CDN e sem abrir a CSP para scripts de terceiros):
 *   /pdfjs/      cmaps, fontes padrão e decodificadores wasm do pdf.js;
 *   /tesseract/  worker e núcleo (wasm) do OCR.
 * No dev, direto do node_modules; no build, copiados para dist/.
 */
const ESTATICOS = {
  pdfjs: [
    ['cmaps', 'pdfjs-dist/cmaps'],
    ['standard_fonts', 'pdfjs-dist/standard_fonts'],
    ['wasm', 'pdfjs-dist/wasm'],
  ],
  tesseract: [
    ['worker.min.js', 'tesseract.js/dist/worker.min.js'],
    ['tesseract-core-lstm.wasm.js', 'tesseract.js-core/tesseract-core-lstm.wasm.js'],
    ['tesseract-core-simd-lstm.wasm.js', 'tesseract.js-core/tesseract-core-simd-lstm.wasm.js'],
    ['tesseract-core-relaxedsimd-lstm.wasm.js', 'tesseract.js-core/tesseract-core-relaxedsimd-lstm.wasm.js'],
  ],
}

function arquivosEstaticos() {
  const modulos = fileURLToPath(new URL('./node_modules/', import.meta.url))
  let ehSsr = false
  return {
    name: 'arquivos-estaticos',
    configResolved(config) {
      ehSsr = Boolean(config.build.ssr)
    },
    configureServer(server) {
      for (const [rota, entradas] of Object.entries(ESTATICOS)) {
        server.middlewares.use(`/${rota}`, (req, res, next) => {
          const caminho = decodeURIComponent((req.url ?? '').split('?')[0]).replace(/^\/+/, '')
          if (caminho.split('/').includes('..')) return next()
          const entrada = entradas.find(([publico]) => caminho === publico || caminho.startsWith(`${publico}/`))
          if (!entrada) return next()
          const arquivo = modulos + entrada[1] + caminho.slice(entrada[0].length)
          if (!existsSync(arquivo)) return next()
          if (arquivo.endsWith('.wasm')) res.setHeader('Content-Type', 'application/wasm')
          if (arquivo.endsWith('.js')) res.setHeader('Content-Type', 'text/javascript')
          res.end(readFileSync(arquivo))
        })
      }
    },
    closeBundle() {
      if (ehSsr) return
      for (const [rota, entradas] of Object.entries(ESTATICOS)) {
        for (const [publico, origem] of entradas) {
          cpSync(modulos + origem, fileURLToPath(new URL(`./dist/${rota}/${publico}`, import.meta.url)), { recursive: true })
        }
      }
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), vercelFunctions(), arquivosEstaticos()],
  build: {
    // O manifesto diz qual arquivo é o código de cada ferramenta: a
    // pré-renderização usa para adiantar o download (modulepreload).
    manifest: true,
    // Mediabunny, pdf-lib e pdf.js passam de 500 KB, mas só carregam quando a
    // ferramenta que os usa é aberta (import dinâmico). O aviso não se aplica.
    chunkSizeWarningLimit: 800,
  },
  // O ffmpeg.wasm cria o próprio worker a partir do pacote; pré-empacotado
  // pelo Vite, o caminho do worker se perde (recomendação da documentação dele).
  // O mesmo vale para os codecs do jSquash: pré-empacotados, perdem o caminho do .wasm.
  optimizeDeps: { exclude: ['@ffmpeg/ffmpeg', '@ffmpeg/util', '@jsquash/jpeg', '@jsquash/webp', '@jsquash/avif', '@jsquash/oxipng'] },
  worker: { format: 'es' },
})
