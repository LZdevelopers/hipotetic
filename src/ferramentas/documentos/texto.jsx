import { useMemo, useState } from 'react'
import { Resultados } from '../../componentes/ferramenta/Resultados'
import { SeletorArquivos } from '../../componentes/ferramenta/SeletorArquivos'
import { AreaTexto, Aviso, Botao, Progresso, Segmentado } from '../../componentes/ui'
import { EXTENSOES_TEXTO_DOC, extrairTextoDocumento } from '../../motores/documentos'
import { semExtensao } from '../../nucleo/arquivos'
import { useTarefa } from '../../nucleo/tarefa'
import { contar } from '../utilitarios/texto'

const VAZIAS = new Set('a o e de da do das dos em no na nos nas um uma uns umas para por com sem que se ao aos à às é são foi ser ter mais mas ou como seu sua seus suas ele ela eles elas isso este esta esse essa não sim the of and to in is it for on'.split(' '))

/** Palavras mais frequentes (sem artigos, preposições etc.). */
function frequentes(texto, n = 12) {
  const conta = new Map()
  for (const p of texto.toLowerCase().match(/[\p{L}\p{N}]+(?:[-'’][\p{L}\p{N}]+)*/gu) ?? []) {
    if (p.length < 3 || VAZIAS.has(p)) continue
    conta.set(p, (conta.get(p) ?? 0) + 1)
  }
  return [...conta.entries()].sort((a, b) => b[1] - a[1]).slice(0, n)
}

function Estatisticas({ texto }) {
  const c = contar(texto)
  const frases = (texto.match(/[^.!?…]+[.!?…]+/g) ?? []).length || (texto.trim() ? 1 : 0)
  const fala = Math.max(c.palavras ? 1 : 0, Math.round(c.palavras / 130))
  const cards = [
    ['Palavras', c.palavras],
    ['Caracteres', c.caracteres],
    ['Sem espaços', c.semEspacos],
    ['Frases', frases],
    ['Parágrafos', c.paragrafos],
    ['Linhas', c.linhas],
    ['Tempo de leitura', `${c.leitura} min`],
    ['Tempo de fala', `${fala} min`],
  ]
  const top = frequentes(texto)
  return (
    <div className="flex flex-col gap-4">
      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {cards.map(([r, v]) => (
          <div key={r} className="rounded-xl border border-borda bg-superficie p-3">
            <dt className="text-xs text-fraca">{r}</dt>
            <dd className="mt-0.5 font-display text-xl font-bold text-tinta tabular-nums">{typeof v === 'number' ? v.toLocaleString('pt-BR') : v}</dd>
          </div>
        ))}
      </dl>
      {top.length ? (
        <div>
          <p className="mb-2 text-xs font-semibold text-fraca uppercase">Palavras mais usadas</p>
          <ul className="flex flex-wrap gap-1.5">
            {top.map(([p, n]) => (
              <li key={p} className="rounded-md border border-borda bg-superficie-2 px-2 py-1 text-xs text-texto">
                {p} <span className="text-fraca tabular-nums">×{n}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}

/**
 * Texto de documentos: extrai o texto de DOCX, ODT, RTF, PDF, HTML e TXT (ou
 * usa um texto colado) e mostra as contagens — palavras, caracteres, frases,
 * tempo de leitura — com o .txt para baixar.
 */
export default function TextoDocumento() {
  const [origem, setOrigem] = useState('arquivo')
  const [arquivos, setArquivos] = useState([])
  const [colado, setColado] = useState('')
  const tarefa = useTarefa()

  const extrair = () =>
    tarefa.executar(async ({ progresso }) => {
      const { texto, tipo } = await extrairTextoDocumento(arquivos[0].arquivo, (v) => progresso(v, 'Lendo'))
      return { texto, tipo }
    }, 'Lendo o documento')

  const textoColadoMemo = useMemo(() => colado, [colado])

  if (tarefa.fase === 'pronto') {
    const { texto } = tarefa.resultado
    return (
      <div className="flex flex-col gap-4">
        {!texto.trim() ? <Aviso tom="alerta">Nenhum texto encontrado. Se for um PDF digitalizado, use o OCR de PDF.</Aviso> : <Estatisticas texto={texto} />}
        <Resultados
          itens={[{ nome: `${semExtensao(arquivos[0].arquivo.name)}.txt`, blob: new Blob([texto], { type: 'text/plain;charset=utf-8' }), detalhe: `${contar(texto).palavras.toLocaleString('pt-BR')} palavras` }]}
          aoAjustar={tarefa.reiniciar}
          aoReiniciar={() => {
            setArquivos([])
            tarefa.reiniciar()
          }}
          extra={<pre className="max-h-96 overflow-auto border-b border-borda p-4 font-mono text-xs leading-relaxed whitespace-pre-wrap text-texto">{texto.slice(0, 200_000)}</pre>}
        />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <Segmentado
        valor={origem}
        aoMudar={(v) => {
          setOrigem(v)
          tarefa.reiniciar()
        }}
        className="max-w-sm"
        opcoes={[
          { valor: 'arquivo', rotulo: 'Documento' },
          { valor: 'texto', rotulo: 'Colar texto' },
        ]}
      />
      {origem === 'texto' ? (
        <>
          <AreaTexto rotulo="Texto" valor={colado} aoMudar={setColado} className="[&_textarea]:min-h-48 [&_textarea]:font-sans" placeholder="Cole ou digite o texto…" />
          <Estatisticas texto={textoColadoMemo} />
        </>
      ) : (
        <>
          <SeletorArquivos
            arquivos={arquivos}
            aoMudar={(l) => {
              setArquivos(l)
              tarefa.reiniciar()
            }}
            multiplos={false}
            extensoes={EXTENSOES_TEXTO_DOC}
            descricaoFormatos="DOCX, ODT, RTF, PDF, HTML, TXT, MD"
            limiteBytes={200 * 1024 * 1024}
            compacto={Boolean(arquivos.length)}
          />
          {tarefa.fase === 'erro' ? <Aviso tom="erro">{tarefa.mensagem}</Aviso> : null}
          {tarefa.fase === 'processando' ? (
            <Progresso valor={tarefa.progresso} rotulo={tarefa.rotulo} />
          ) : (
            <Botao tamanho="g" icone="texto" className="self-start" onClick={extrair} disabled={!arquivos.length}>
              Ler documento
            </Botao>
          )}
        </>
      )}
    </div>
  )
}
