import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const API = fileURLToPath(new URL('./api', import.meta.url))
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
 * - `npm run preview`: serve o build com as funções E os cabeçalhos do
 *   vercel.json (CSP incluída) — o ensaio mais próximo da produção.
 */
function vercelFunctions() {
  return {
    name: 'vercel-functions',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
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
        const file = rotaDaApi(req.url)
        if (!file) return next()
        try {
          const { default: handler } = await import(pathToFileURL(file).href)
          await handler(req, res)
        } catch (error) {
          next(error)
        }
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), vercelFunctions()],
  // O ffmpeg.wasm cria o próprio worker a partir do pacote; pré-empacotado
  // pelo Vite, o caminho do worker se perde (recomendação da documentação dele).
  optimizeDeps: { exclude: ['@ffmpeg/ffmpeg', '@ffmpeg/util'] },
})
