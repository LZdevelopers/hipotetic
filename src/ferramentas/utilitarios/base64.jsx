import { useEffect, useMemo, useState } from 'react'
import { SeletorArquivos } from '../../componentes/ferramenta/SeletorArquivos'
import { Aviso, AreaTexto, Botao, Segmentado } from '../../componentes/ui'
import { baixarBlob, detectarTipo, formatarBytes, semExtensao } from '../../nucleo/arquivos'

function useCopiar() {
  const [copiado, setCopiado] = useState(false)
  return [
    copiado,
    async (texto) => {
      await navigator.clipboard.writeText(texto)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 1500)
    },
  ]
}

const paraBase64 = (arquivo) =>
  new Promise((ok, falha) => {
    const leitor = new FileReader()
    leitor.onload = () => ok(String(leitor.result).split(',')[1] ?? '')
    leitor.onerror = falha
    leitor.readAsDataURL(arquivo)
  })

function Codificar() {
  const [arquivos, setArquivos] = useState([])
  const [b64, setB64] = useState('')
  const [mime, setMime] = useState('')
  const [formato, setFormato] = useState('uri')
  const [copiado, copiar] = useCopiar()
  const arquivo = arquivos[0]?.arquivo

  useEffect(() => {
    if (!arquivo) return
    let vivo = true
    Promise.all([paraBase64(arquivo), detectarTipo(arquivo)]).then(([dados, tipo]) => {
      if (!vivo) return
      setB64(dados)
      setMime(tipo?.mime ?? (arquivo.type || 'application/octet-stream'))
    })
    return () => {
      vivo = false
    }
  }, [arquivo])

  if (!arquivo) {
    return <SeletorArquivos arquivos={arquivos} aoMudar={setArquivos} multiplos={false} limiteBytes={20 * 1024 * 1024} descricaoFormatos="Qualquer arquivo até 20 MB (imagens, fontes, PDFs…)" aceitarColar />
  }

  const uri = `data:${mime};base64,${b64}`
  const saida = {
    uri,
    puro: b64,
    css: `background-image: url("${uri}");`,
    html: `<img src="${uri}" alt="">`,
    md: `![imagem](${uri})`,
  }[formato]

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-suave">
          <strong className="text-tinta">{arquivo.name}</strong> · {formatarBytes(arquivo.size)} → {formatarBytes(saida.length)} de texto
        </p>
        <Botao variante="secundario" tamanho="p" icone="refazer" onClick={() => setArquivos([])}>
          Outro arquivo
        </Botao>
      </div>
      <Segmentado
        valor={formato}
        aoMudar={setFormato}
        opcoes={[
          { valor: 'uri', rotulo: 'Data URI' },
          { valor: 'puro', rotulo: 'Só Base64' },
          { valor: 'css', rotulo: 'CSS' },
          { valor: 'html', rotulo: 'HTML' },
          { valor: 'md', rotulo: 'Markdown' },
        ]}
      />
      {arquivo.size > 200 * 1024 ? <Aviso tom="alerta">Base64 aumenta o tamanho em cerca de 33%. Para arquivos grandes, prefira um arquivo separado.</Aviso> : null}
      <textarea readOnly value={saida.length > 2_000_000 ? `${saida.slice(0, 2_000_000)}…` : saida} className="h-64 w-full rounded-[var(--radius-controle)] border border-borda-forte bg-fundo-suave p-3 font-mono text-xs break-all text-texto" aria-label="Resultado em Base64" />
      <div className="flex flex-wrap gap-2">
        <Botao icone={copiado ? 'check' : 'copiar'} onClick={() => copiar(saida)}>
          {copiado ? 'Copiado' : 'Copiar'}
        </Botao>
        <Botao variante="secundario" icone="baixar" onClick={() => baixarBlob(new Blob([saida], { type: 'text/plain' }), `${semExtensao(arquivo.name)}.base64.txt`)}>
          Baixar como .txt
        </Botao>
      </div>
    </div>
  )
}

const EXT = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif', 'image/avif': 'avif', 'image/svg+xml': 'svg', 'image/bmp': 'bmp', 'image/x-icon': 'ico', 'application/pdf': 'pdf' }

function Decodificar() {
  const [texto, setTexto] = useState('')
  const [resultado, setResultado] = useState(null)

  useEffect(() => {
    let vivo = true
    const limpo = texto.trim()
    if (!limpo) {
      setResultado(null)
      return undefined
    }
    ;(async () => {
      const m = /^data:([^;,]+)?(?:;[^,]*)?;base64,(.*)$/s.exec(limpo)
      const dados = (m ? m[2] : limpo).replace(/\s+/g, '').replace(/-/g, '+').replace(/_/g, '/')
      try {
        if (!/^[A-Za-z0-9+/]*={0,2}$/.test(dados)) throw new Error()
        const bin = atob(dados.padEnd(Math.ceil(dados.length / 4) * 4, '='))
        const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0))
        const blob = new Blob([bytes])
        const tipo = await detectarTipo(blob)
        const mime = tipo?.mime ?? m?.[1] ?? 'application/octet-stream'
        if (vivo) setResultado({ blob: new Blob([bytes], { type: mime }), mime, ext: EXT[mime] ?? tipo?.ext ?? 'bin' })
      } catch {
        if (vivo) setResultado({ erro: true })
      }
    })()
    return () => {
      vivo = false
    }
  }, [texto])

  const url = useMemo(() => (resultado?.blob && resultado.mime.startsWith('image/') ? URL.createObjectURL(resultado.blob) : null), [resultado])
  useEffect(() => () => url && URL.revokeObjectURL(url), [url])

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <AreaTexto rotulo="Cole o Base64 ou o data URI" valor={texto} aoMudar={setTexto} placeholder="data:image/png;base64,iVBORw0KGgo…" className="[&_textarea]:h-72" />
      <div className="flex flex-col gap-3">
        <p className="text-[0.8125rem] font-semibold text-tinta">Resultado</p>
        {!resultado ? (
          <div className="grid h-72 place-items-center rounded-[var(--radius-cartao)] border border-dashed border-borda-forte text-sm text-fraca">A prévia aparece aqui</div>
        ) : resultado.erro ? (
          <Aviso tom="erro">Esse texto não é Base64 válido.</Aviso>
        ) : (
          <>
            {url ? (
              <div className="xadrez grid h-72 place-items-center overflow-hidden rounded-[var(--radius-cartao)] border border-borda p-3">
                <img src={url} alt="Imagem decodificada" className="max-h-full max-w-full object-contain" />
              </div>
            ) : (
              <Aviso tom="info">Não é uma imagem ({resultado.mime}), mas você pode baixar o arquivo.</Aviso>
            )}
            <p className="text-sm text-suave">
              {resultado.ext.toUpperCase()} · {formatarBytes(resultado.blob.size)}
            </p>
            <Botao icone="baixar" className="self-start" onClick={() => baixarBlob(resultado.blob, `arquivo.${resultado.ext}`)}>
              Baixar arquivo
            </Botao>
          </>
        )}
      </div>
    </div>
  )
}

export default function Base64({ modo: inicial = 'codificar' }) {
  const [modo, setModo] = useState(inicial)
  return (
    <div className="flex flex-col gap-5">
      <Segmentado
        valor={modo}
        aoMudar={setModo}
        className="max-w-md"
        opcoes={[
          { valor: 'codificar', rotulo: 'Arquivo → Base64' },
          { valor: 'decodificar', rotulo: 'Base64 → Arquivo' },
        ]}
      />
      {modo === 'codificar' ? <Codificar /> : <Decodificar />}
    </div>
  )
}
