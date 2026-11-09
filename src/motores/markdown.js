/** Markdown → página HTML completa, com estilo de leitura (o mesmo da ferramenta de Markdown). */

export const ESTILO = `
  body { font: 16px/1.6 system-ui, -apple-system, "Segoe UI", sans-serif; color: #1f2328; max-width: 46rem; margin: 2.5rem auto; padding: 0 1.25rem; }
  h1, h2, h3 { line-height: 1.25; margin: 1.6em 0 .6em; } h1 { font-size: 2em; border-bottom: 1px solid #d0d7de; padding-bottom: .3em; }
  h2 { font-size: 1.5em; border-bottom: 1px solid #d0d7de; padding-bottom: .3em; } a { color: #0969da; }
  code { background: #f2f3f5; padding: .15em .35em; border-radius: 4px; font-size: .9em; } pre { background: #f6f8fa; padding: 1em; border-radius: 6px; overflow: auto; } pre code { background: none; padding: 0; }
  blockquote { margin: 0; padding: 0 1em; color: #59636e; border-left: .25em solid #d0d7de; } table { border-collapse: collapse; } th, td { border: 1px solid #d0d7de; padding: .4em .8em; }
  img { max-width: 100%; } hr { border: 0; border-top: 1px solid #d0d7de; }
  @media print { body { margin: 0; } a { color: inherit; } }`

const escapar = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;')

/** Converte o texto Markdown numa página HTML (string). */
export async function markdownParaHtml(texto) {
  const { marked } = await import('marked')
  const corpo = marked.parse(texto, { gfm: true, breaks: false })
  const titulo = /^#s+(.+)$/m.exec(texto)?.[1]?.trim() ?? 'Documento'
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapar(titulo)}</title>
<style>${ESTILO}</style>
</head>
<body>
${corpo}</body>
</html>
`
}
