import { useEffect, useRef, useState } from 'react'
import { AreaTexto, Botao, Caixa, Segmentado } from '../../componentes/ui'
import { baixarBlob, lerTexto } from '../../nucleo/arquivos'

const EXEMPLO = `# Título do documento

Escreva em **Markdown** e veja o resultado ao lado.

## Lista

- Itens com *ênfase*
- [Links](https://lzdev.com.br)
- \`código\` no meio do texto

| Coluna | Valor |
| ------ | ----- |
| A      | 1     |
`

const ESTILO = `
  body { font: 16px/1.6 system-ui, -apple-system, "Segoe UI", sans-serif; color: #1f2328; max-width: 46rem; margin: 2.5rem auto; padding: 0 1.25rem; }
  h1, h2, h3 { line-height: 1.25; margin: 1.6em 0 .6em; } h1 { font-size: 2em; border-bottom: 1px solid #d0d7de; padding-bottom: .3em; }
  h2 { font-size: 1.5em; border-bottom: 1px solid #d0d7de; padding-bottom: .3em; } a { color: #0969da; }
  code { background: #f2f3f5; padding: .15em .35em; border-radius: 4px; font-size: .9em; } pre { background: #f6f8fa; padding: 1em; border-radius: 6px; overflow: auto; } pre code { background: none; padding: 0; }
  blockquote { margin: 0; padding: 0 1em; color: #59636e; border-left: .25em solid #d0d7de; } table { border-collapse: collapse; } th, td { border: 1px solid #d0d7de; padding: .4em .8em; }
  img { max-width: 100%; } hr { border: 0; border-top: 1px solid #d0d7de; }
  @media print { body { margin: 0; } a { color: inherit; } }`

/** Markdown → HTML (com página completa e estilo opcional), prévia isolada e "salvar como PDF" pelo próprio navegador. */
export default function Markdown() {
  const [texto, setTexto] = useState(EXEMPLO)
  const [html, setHtml] = useState('')
  const [completo, setCompleto] = useState(true)
  const [vista, setVista] = useState('previa')
  const quadro = useRef(null)
  const entrada = useRef(null)

  useEffect(() => {
    let vivo = true
    import('marked').then(({ marked }) => {
      const corpo = marked.parse(texto, { gfm: true, breaks: false })
      if (vivo) setHtml(corpo)
    })
    return () => {
      vivo = false
    }
  }, [texto])

  const titulo = /^#\s+(.+)$/m.exec(texto)?.[1]?.trim() ?? 'Documento'
  const documento = `<!doctype html>\n<html lang="pt-BR">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n<title>${titulo.replace(/</g, '&lt;')}</title>\n<style>${ESTILO}</style>\n</head>\n<body>\n${html}</body>\n</html>\n`
  const saida = completo ? documento : html

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={entrada}
          type="file"
          accept=".md,.markdown,.txt"
          className="sr-only"
          onChange={async (e) => {
            const a = e.target.files?.[0]
            e.target.value = ''
            if (a) setTexto(await lerTexto(a))
          }}
        />
        <Botao variante="secundario" tamanho="p" icone="arquivoMais" onClick={() => entrada.current?.click()}>
          Abrir arquivo .md
        </Botao>
        <Caixa rotulo="Página completa (com estilo)" marcado={completo} aoMudar={setCompleto} className="ml-1" />
        <div className="ml-auto flex flex-wrap gap-2">
          <Botao tamanho="p" icone="baixar" onClick={() => baixarBlob(new Blob([saida], { type: 'text/html;charset=utf-8' }), `${titulo.slice(0, 60) || 'documento'}.html`)}>
            Baixar HTML
          </Botao>
          <Botao variante="secundario" tamanho="p" icone="pdf" onClick={() => quadro.current?.contentWindow?.print()} disabled={vista !== 'previa'}>
            Salvar como PDF
          </Botao>
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <AreaTexto rotulo="Markdown" valor={texto} aoMudar={setTexto} className="[&_textarea]:h-[60vh]" />
        <div className="flex min-w-0 flex-col gap-1.5">
          <Segmentado
            valor={vista}
            aoMudar={setVista}
            opcoes={[
              { valor: 'previa', rotulo: 'Prévia' },
              { valor: 'codigo', rotulo: 'HTML' },
            ]}
          />
          {vista === 'previa' ? (
            // sandbox sem scripts: HTML do usuário nunca roda no nosso domínio.
            <iframe ref={quadro} title="Prévia do HTML" sandbox="allow-same-origin allow-modals" srcDoc={documento} className="h-[calc(60vh-2.5rem)] w-full rounded-[var(--radius-controle)] border border-borda-forte bg-white" />
          ) : (
            <pre className="h-[calc(60vh-2.5rem)] overflow-auto rounded-[var(--radius-controle)] border border-borda-forte bg-fundo-suave p-3 font-mono text-xs whitespace-pre-wrap text-texto">{saida}</pre>
          )}
        </div>
      </div>
      <p className="text-xs text-fraca">“Salvar como PDF” abre a impressão do navegador: escolha “Salvar como PDF” no destino.</p>
    </div>
  )
}
