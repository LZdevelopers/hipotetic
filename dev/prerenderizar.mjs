// Pré-renderização: transforma o build (SPA) em um HTML estático por endereço,
// com título, descrição, canonical, Open Graph e JSON-LD próprios — o que os
// buscadores e as prévias de link (WhatsApp, X…) leem sem executar JavaScript.
// Também gera 404.html, sitemap.xml e robots.txt.
//
// Ordem (npm run build): vite build → vite build --ssr → este script.

import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const RAIZ = fileURLToPath(new URL('..', import.meta.url))
const DIST = join(RAIZ, 'dist')
const SSR = join(RAIZ, 'dist-ssr')

const { renderizar, todasAsRotas, conferirCatalogo, produto, ehApelido } = await import(pathToFileURL(join(SSR, 'servidor.js')).href)

const problemas = conferirCatalogo()
if (problemas.length) {
  console.error('Catálogo com problemas:\n- ' + problemas.join('\n- '))
  process.exit(1)
}

const modelo = readFileSync(join(DIST, 'index.html'), 'utf8')
const manifesto = JSON.parse(readFileSync(join(DIST, '.vite', 'manifest.json'), 'utf8'))

const escapar = (texto) =>
  String(texto).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])

/** Arquivos JS que um módulo precisa (ele e os pedaços que importa), para <link rel="modulepreload">. */
function dependencias(chave, vistos = new Set()) {
  const item = manifesto[chave]
  if (!item || vistos.has(chave)) return []
  vistos.add(chave)
  return [item.file, ...(item.imports ?? []).flatMap((i) => dependencias(i, vistos))]
}
const entrada = Object.keys(manifesto).find((k) => manifesto[k].isEntry)
const jaCarregados = new Set(dependencias(entrada))

function cabeca(meta, modulo) {
  const linhas = [
    `<title>${escapar(meta.titulo)}</title>`,
    `<meta name="description" content="${escapar(meta.descricao)}" />`,
    `<link rel="canonical" href="${escapar(meta.url)}" />`,
    meta.indexar ? '' : '<meta name="robots" content="noindex" />',
    `<meta property="og:type" content="website" />`,
    `<meta property="og:locale" content="pt_BR" />`,
    `<meta property="og:site_name" content="${escapar(produto.nome)}" />`,
    `<meta property="og:title" content="${escapar(meta.titulo)}" />`,
    `<meta property="og:description" content="${escapar(meta.descricao)}" />`,
    `<meta property="og:url" content="${escapar(meta.url)}" />`,
    `<meta property="og:image" content="${produto.url}/og.png" />`,
    `<meta property="og:image:width" content="1200" />`,
    `<meta property="og:image:height" content="630" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
  ]
  if (modulo) {
    for (const arquivo of dependencias(`src/ferramentas/${modulo}.jsx`)) {
      if (!jaCarregados.has(arquivo)) linhas.push(`<link rel="modulepreload" crossorigin href="/${arquivo}" />`)
    }
  }
  for (const dado of [meta.jsonld].flat().filter(Boolean)) {
    // "<" escapado: um texto com "</script>" não pode fechar a tag.
    linhas.push(`<script type="application/ld+json">${JSON.stringify(dado).replace(/</g, '\\u003c')}</script>`)
  }
  return linhas.filter(Boolean).join('\n    ')
}

function gravar(arquivo, conteudo) {
  mkdirSync(dirname(arquivo), { recursive: true })
  writeFileSync(arquivo, conteudo)
}

const rotas = todasAsRotas()
for (const caminho of rotas) {
  const { html, meta, modulo } = await renderizar(caminho)
  const pagina = modelo.replace('<!--cabeca-->', cabeca(meta, modulo)).replace('<!--app-->', html)
  // /pdf/unir → dist/pdf/unir.html (a Vercel serve sem a extensão: cleanUrls).
  gravar(caminho === '/' ? join(DIST, 'index.html') : join(DIST, `${caminho.slice(1)}.html`), pagina)
}

// 404: mesma casca, conteúdo "não encontrada", sem indexar.
{
  const { html, meta } = await renderizar('/404')
  gravar(join(DIST, '404.html'), modelo.replace('<!--cabeca-->', cabeca(meta)).replace('<!--app-->', html))
}

const hoje = new Date().toISOString().slice(0, 10)
gravar(
  join(DIST, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${rotas.filter((r) => !ehApelido(r)).map((r) => `  <url><loc>${produto.url}${r === '/' ? '/' : r}</loc><lastmod>${hoje}</lastmod></url>`).join('\n')}
</urlset>
`,
)
gravar(join(DIST, 'robots.txt'), `User-agent: *\nAllow: /\nDisallow: /api/\n\nSitemap: ${produto.url}/sitemap.xml\n`)

if (existsSync(SSR)) rmSync(SSR, { recursive: true, force: true })
console.log(`Pré-renderizadas ${rotas.length} páginas + 404, sitemap.xml e robots.txt.`)
