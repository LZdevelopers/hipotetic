import { useEffect, useMemo, useState } from 'react'
import { SeletorArquivos } from '../../componentes/ferramenta/SeletorArquivos'
import { AreaTexto, Aviso, Botao, Caixa, Entrada, Segmentado, Seletor } from '../../componentes/ui'
import { baixarBlob, extensaoDe, formatarBytes, semExtensao } from '../../nucleo/arquivos'

const CODIFICACOES = [
  { valor: 'auto', rotulo: 'Detectar automaticamente' },
  { valor: 'utf-8', rotulo: 'UTF-8' },
  { valor: 'windows-1252', rotulo: 'Windows-1252 (ANSI)' },
  { valor: 'iso-8859-1', rotulo: 'ISO-8859-1 (Latin-1)' },
  { valor: 'utf-16le', rotulo: 'UTF-16' },
]

function decodificar(bytes, codificacao) {
  if (codificacao !== 'auto') return { texto: new TextDecoder(codificacao).decode(bytes), usada: codificacao }
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return { texto: new TextDecoder('utf-16le').decode(bytes), usada: 'utf-16le' }
  if (bytes[0] === 0xfe && bytes[1] === 0xff) return { texto: new TextDecoder('utf-16be').decode(bytes), usada: 'utf-16be' }
  try {
    return { texto: new TextDecoder('utf-8', { fatal: true }).decode(bytes), usada: 'utf-8' }
  } catch {
    return { texto: new TextDecoder('windows-1252').decode(bytes), usada: 'windows-1252' }
  }
}

/** Contagens de um texto: linhas, palavras, caracteres, parágrafos, tempo de leitura. */
export function contar(texto) {
  const palavras = (texto.match(/[\p{L}\p{N}]+(?:[-'’][\p{L}\p{N}]+)*/gu) ?? []).length
  return {
    linhas: texto ? texto.split(/\r\n|\r|\n/).length : 0,
    palavras,
    caracteres: [...texto].length,
    semEspacos: [...texto.replace(/\s/g, '')].length,
    paragrafos: texto.split(/\n\s*\n/).filter((p) => p.trim()).length,
    leitura: Math.max(palavras ? 1 : 0, Math.round(palavras / 200)),
  }
}

function Visualizar() {
  const [arquivos, setArquivos] = useState([])
  const [bytes, setBytes] = useState(null)
  const [codificacao, setCodificacao] = useState('auto')
  const [quebrar, setQuebrar] = useState(true)
  const [busca, setBusca] = useState('')
  const arquivo = arquivos[0]?.arquivo

  useEffect(() => {
    if (!arquivo) return setBytes(null)
    arquivo.arrayBuffer().then((b) => setBytes(new Uint8Array(b)))
    return undefined
  }, [arquivo])

  const { texto, usada } = useMemo(() => (bytes ? decodificar(bytes, codificacao) : { texto: '', usada: '' }), [bytes, codificacao])
  const ext = extensaoDe(arquivo?.name)
  const json = useMemo(() => {
    if (ext !== 'json' && !/^\s*[[{]/.test(texto.slice(0, 50))) return null
    try {
      return JSON.stringify(JSON.parse(texto), null, 2)
    } catch {
      return null
    }
  }, [texto, ext])
  const [formatarJson, setFormatarJson] = useState(true)
  const exibido = json && formatarJson ? json : texto
  const linhas = useMemo(() => exibido.split(/\r\n|\r|\n/), [exibido])
  const achados = busca ? linhas.filter((l) => l.toLowerCase().includes(busca.toLowerCase())).length : 0
  const c = contar(texto)

  if (!arquivo) return <SeletorArquivos arquivos={arquivos} aoMudar={setArquivos} multiplos={false} limiteBytes={30 * 1024 * 1024} descricaoFormatos="TXT, CSV, JSON, MD, LOG, XML, código… até 30 MB" />

  return (
    <div className="flex flex-col gap-4">
      <div className="cartao flex flex-wrap items-end gap-3 p-4">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-tinta">{arquivo.name}</p>
          <p className="text-xs text-fraca">
            {formatarBytes(arquivo.size)} · {c.linhas.toLocaleString('pt-BR')} linhas · {c.palavras.toLocaleString('pt-BR')} palavras · {c.caracteres.toLocaleString('pt-BR')} caracteres · {usada.toUpperCase()}
          </p>
        </div>
        <Seletor rotulo="Codificação" valor={codificacao} aoMudar={setCodificacao} opcoes={CODIFICACOES} className="w-56" />
        <Entrada rotulo="Buscar" valor={busca} aoMudar={setBusca} className="w-48" direita={busca ? `${achados}` : undefined} />
        <Caixa rotulo="Quebrar linhas" marcado={quebrar} aoMudar={setQuebrar} />
        {json ? <Caixa rotulo="Formatar JSON" marcado={formatarJson} aoMudar={setFormatarJson} /> : null}
        <Botao variante="secundario" tamanho="p" icone="baixar" onClick={() => baixarBlob(new Blob([exibido], { type: 'text/plain;charset=utf-8' }), `${semExtensao(arquivo.name)}-utf8.${ext || 'txt'}`)}>
          Salvar em UTF-8
        </Botao>
        <Botao variante="fantasma" tamanho="p" onClick={() => setArquivos([])}>
          Outro arquivo
        </Botao>
      </div>
      {texto.includes('�') && usada === 'utf-8' ? <Aviso tom="alerta">Alguns caracteres não puderam ser lidos. Tente outra codificação.</Aviso> : null}
      <div className="cartao max-h-[70vh] overflow-auto">
        <table className="w-full border-collapse font-mono text-xs leading-relaxed">
          <tbody>
            {linhas.slice(0, 20000).map((l, i) => {
              const marcado = busca && l.toLowerCase().includes(busca.toLowerCase())
              return (
                <tr key={i} className={marcado ? 'bg-alerta-suave' : ''}>
                  <td className="w-px border-r border-borda px-3 text-right align-top text-fraca select-none tabular-nums">{i + 1}</td>
                  <td className={`px-3 text-texto ${quebrar ? 'break-all whitespace-pre-wrap' : 'whitespace-pre'}`}>{l || ' '}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {linhas.length > 20000 ? <p className="border-t border-borda p-3 text-xs text-fraca">Mostrando 20.000 de {linhas.length.toLocaleString('pt-BR')} linhas.</p> : null}
      </div>
    </div>
  )
}

const EXTENSOES_GERAR = ['txt', 'md', 'csv', 'json', 'html', 'xml', 'log', 'ini', 'srt']

function Gerar() {
  const [texto, setTexto] = useState('')
  const [nome, setNome] = useState('arquivo')
  const [ext, setExt] = useState('txt')
  const [fimLinha, setFimLinha] = useState('lf')
  const [bom, setBom] = useState(false)
  const c = contar(texto)

  const gerar = () => {
    const conteudo = fimLinha === 'crlf' ? texto.replace(/\r?\n/g, '\r\n') : texto.replace(/\r\n/g, '\n')
    const partes = bom ? ['﻿', conteudo] : [conteudo]
    baixarBlob(new Blob(partes, { type: 'text/plain;charset=utf-8' }), `${nome.trim() || 'arquivo'}.${ext}`)
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
      <div className="flex flex-col gap-2">
        <AreaTexto rotulo="Conteúdo" valor={texto} aoMudar={setTexto} className="[&_textarea]:min-h-[50vh]" placeholder="Escreva ou cole o texto…" />
        <p className="text-xs text-fraca tabular-nums">
          {c.palavras.toLocaleString('pt-BR')} palavras · {c.caracteres.toLocaleString('pt-BR')} caracteres · {c.linhas.toLocaleString('pt-BR')} linhas
        </p>
      </div>
      <aside className="cartao flex flex-col gap-4 p-4 lg:sticky lg:top-20">
        <div className="grid grid-cols-[minmax(0,1fr)_6rem] gap-2">
          <Entrada rotulo="Nome" valor={nome} aoMudar={setNome} />
          <Seletor rotulo="Tipo" valor={ext} aoMudar={setExt} opcoes={EXTENSOES_GERAR.map((e) => ({ valor: e, rotulo: `.${e}` }))} />
        </div>
        <Segmentado
          rotulo="Fim de linha"
          valor={fimLinha}
          aoMudar={setFimLinha}
          opcoes={[
            { valor: 'lf', rotulo: 'LF (Linux, Mac)' },
            { valor: 'crlf', rotulo: 'CRLF (Windows)' },
          ]}
        />
        <Caixa rotulo="UTF-8 com BOM" dica="Marque para CSV que vai abrir no Excel: sem o BOM, os acentos aparecem errados." marcado={bom} aoMudar={setBom} />
        <Botao tamanho="g" icone="baixar" onClick={gerar} disabled={!texto}>
          Baixar arquivo
        </Botao>
      </aside>
    </div>
  )
}

export default function Texto({ modo = 'visualizar' }) {
  return modo === 'gerar' ? <Gerar /> : <Visualizar />
}
