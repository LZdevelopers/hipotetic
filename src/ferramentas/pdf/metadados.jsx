import { useEffect, useState } from 'react'
import { Resultados } from '../../componentes/ferramenta/Resultados'
import { SeletorArquivos } from '../../componentes/ferramenta/SeletorArquivos'
import { Aviso, Botao, Entrada, Progresso } from '../../componentes/ui'
import { LIMITE_PDF, abrirEdicao, abrirLeitura, obterPdfLib, salvarPdf } from '../../motores/pdf'
import { formatarBytes, trocarExtensao } from '../../nucleo/arquivos'
import { useSalvo, useTarefaSalva } from '../../nucleo/salvo'

const CAMPOS = [
  ['Title', 'Título'],
  ['Author', 'Autor'],
  ['Subject', 'Assunto'],
  ['Keywords', 'Palavras-chave'],
  ['Creator', 'Criado com'],
  ['Producer', 'Gerado por'],
]

/** "D:20240102153000-03'00'" → Date. */
function dataPdf(v) {
  const m = /^D:(\d{4})(\d{2})?(\d{2})?(\d{2})?(\d{2})?(\d{2})?/.exec(String(v ?? ''))
  if (!m) return null
  return new Date(Date.UTC(m[1], (m[2] ?? 1) - 1, m[3] ?? 1, m[4] ?? 0, m[5] ?? 0, m[6] ?? 0))
}

const PAPEIS = [
  ['A4', 595, 842],
  ['Carta', 612, 792],
  ['Ofício', 612, 1008],
  ['A3', 842, 1191],
  ['A5', 420, 595],
]
function nomePapel(w, h) {
  const [a, b] = [Math.min(w, h), Math.max(w, h)]
  const p = PAPEIS.find(([, pw, ph]) => Math.abs(pw - a) < 3 && Math.abs(ph - b) < 3)
  const mm = `${Math.round((w / 72) * 25.4)} × ${Math.round((h / 72) * 25.4)} mm`
  return p ? `${p[0]} (${mm})` : mm
}

function Painel({ arquivo, aoTrocar, modo }) {
  const [info, setInfo] = useState(null)
  const [erro, setErro] = useState(null)
  const [lidos, setLidos] = useState({})
  // Campos editados ficam salvos (por arquivo); sem edição, valem os lidos do PDF.
  const [editados, setEditados] = useSalvo(`campos:${arquivo.name}:${arquivo.size}`, null)
  const campos = editados ?? lidos
  const setCampos = (f) => setEditados((e) => (typeof f === 'function' ? f(e ?? lidos) : f))
  const tarefa = useTarefaSalva()

  useEffect(() => {
    let vivo = true
    ;(async () => {
      const doc = await abrirLeitura(arquivo)
      try {
        const { info: i, metadata } = await doc.getMetadata()
        const p1 = await doc.getPage(1)
        const v = p1.getViewport({ scale: 1 })
        if (!vivo) return
        setInfo({ i, xmp: Boolean(metadata), paginas: doc.numPages, papel: nomePapel(v.width, v.height) })
        setLidos(Object.fromEntries(CAMPOS.map(([k]) => [k, typeof i[k] === 'string' ? i[k] : ''])))
      } finally {
        doc.destroy()
      }
    })().catch((e) => vivo && setErro(e?.mensagem ?? 'Não foi possível ler este PDF.'))
    return () => {
      vivo = false
    }
  }, [arquivo])

  const salvar = (limpar) =>
    tarefa.executar(async () => {
      const { PDFName } = await obterPdfLib()
      const doc = await abrirEdicao(arquivo)
      const infoDict = doc.getInfoDict()
      for (const chave of [...infoDict.keys()]) infoDict.delete(chave)
      // XMP e "PieceInfo" (dados privados de programas como Illustrator) também saem.
      doc.catalog.delete(PDFName.of('Metadata'))
      doc.catalog.delete(PDFName.of('PieceInfo'))
      for (const pagina of doc.getPages()) {
        pagina.node.delete(PDFName.of('Metadata'))
        pagina.node.delete(PDFName.of('PieceInfo'))
      }
      if (!limpar) {
        if (campos.Title) doc.setTitle(campos.Title)
        if (campos.Author) doc.setAuthor(campos.Author)
        if (campos.Subject) doc.setSubject(campos.Subject)
        if (campos.Keywords) doc.setKeywords(campos.Keywords.split(/[,;]\s*/).filter(Boolean))
        if (campos.Creator) doc.setCreator(campos.Creator)
        if (campos.Producer) doc.setProducer(campos.Producer)
      }
      const blob = await salvarPdf(doc)
      return [{ nome: trocarExtensao(arquivo.name, 'pdf', limpar ? '-sem-metadados' : ''), blob, detalhe: limpar ? 'metadados removidos' : 'metadados atualizados' }]
    }, 'Salvando')

  if (erro) return <Aviso tom="erro" titulo={erro} acao={<Botao variante="secundario" tamanho="p" onClick={aoTrocar}>Escolher outro</Botao>} />
  if (tarefa.fase === 'pronto') return <Resultados itens={tarefa.resultado} aoAjustar={tarefa.reiniciar} aoReiniciar={aoTrocar} rotuloNovo="Outro PDF" />
  if (!info) return <div className="esqueleto h-72 rounded-[var(--radius-cartao)]" />

  const criado = dataPdf(info.i.CreationDate)
  const modificado = dataPdf(info.i.ModDate)
  const linhas = [
    ['Arquivo', arquivo.name],
    ['Tamanho', formatarBytes(arquivo.size)],
    ['Páginas', info.paginas],
    ['Tamanho da página', info.papel],
    ['Versão do PDF', info.i.PDFFormatVersion ?? '—'],
    ['Otimizado para web', info.i.IsLinearized ? 'Sim' : 'Não'],
    ['Formulário', info.i.IsAcroFormPresent ? 'Sim' : 'Não'],
    ['Criado em', criado ? criado.toLocaleString('pt-BR') : '—'],
    ['Modificado em', modificado ? modificado.toLocaleString('pt-BR') : '—'],
    ['Metadados XMP', info.xmp ? 'Sim' : 'Não'],
  ]
  const processando = tarefa.fase === 'processando'

  return (
    <div className="grid gap-5 lg:grid-cols-2 lg:items-start">
      <section className="cartao overflow-hidden">
        <h2 className="border-b border-borda bg-fundo-suave px-4 py-2.5 font-sans text-xs font-semibold tracking-wide text-fraca uppercase">Documento</h2>
        <dl className="divide-y divide-borda">
          {linhas.map(([r, v]) => (
            <div key={r} className="grid grid-cols-[10rem_minmax(0,1fr)] gap-3 px-4 py-2.5 text-sm">
              <dt className="text-suave">{r}</dt>
              <dd className="font-medium [overflow-wrap:anywhere] text-tinta">{v}</dd>
            </div>
          ))}
        </dl>
      </section>
      <section className="cartao flex flex-col gap-4 p-4 sm:p-5">
        <h2 className="text-base">{modo === 'limpar' ? 'Metadados encontrados' : 'Editar metadados'}</h2>
        {CAMPOS.map(([k, rotulo]) => (
          <Entrada key={k} rotulo={rotulo} valor={campos[k] ?? ''} aoMudar={(v) => setCampos((c) => ({ ...c, [k]: v }))} placeholder="(vazio)" />
        ))}
        {tarefa.fase === 'erro' ? <Aviso tom="erro">{tarefa.mensagem}</Aviso> : null}
        {processando ? (
          <Progresso valor={null} rotulo="Salvando" />
        ) : (
          <div className="flex flex-wrap gap-2">
            <Botao variante={modo === 'limpar' ? 'primario' : 'secundario'} icone="borracha" onClick={() => salvar(true)}>
              Remover todos os metadados
            </Botao>
            <Botao variante={modo === 'limpar' ? 'secundario' : 'primario'} icone="check" onClick={() => salvar(false)}>
              Salvar alterações
            </Botao>
          </div>
        )}
      </section>
    </div>
  )
}

export default function Metadados({ modo = 'ver' }) {
  const [arquivos, setArquivos] = useSalvo('arquivos', [])
  if (!arquivos.length) return <SeletorArquivos arquivos={arquivos} aoMudar={setArquivos} multiplos={false} extensoes={['pdf']} descricaoFormatos="PDF" limiteBytes={LIMITE_PDF} />
  return <Painel key={arquivos[0].id} arquivo={arquivos[0].arquivo} modo={modo} aoTrocar={() => setArquivos([])} />
}
