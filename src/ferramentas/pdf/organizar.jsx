import { useEffect, useRef, useState } from 'react'
import { Resultados } from '../../componentes/ferramenta/Resultados'
import { SeletorArquivos } from '../../componentes/ferramenta/SeletorArquivos'
import { Icone } from '../../componentes/Icone'
import { Aviso, Botao, Progresso } from '../../componentes/ui'
import { LIMITE_PDF, abrirEdicao, abrirLeitura, miniaturaPagina, obterPdfLib, salvarPdf } from '../../motores/pdf'
import { semExtensao } from '../../nucleo/arquivos'
import { useTarefa } from '../../nucleo/tarefa'

const DICAS = {
  organizar: 'Arraste as páginas para mudar a ordem. Use os botões de cada página para girar, duplicar ou excluir.',
  excluir: 'Clique nas páginas que você quer tirar (ou use a lixeira de cada uma) e depois em “Excluir selecionadas”.',
  girar: 'Gire cada página com os botões dela, ou selecione várias e use “Girar selecionadas”.',
  reordenar: 'Arraste as páginas para a nova ordem. No celular, use as setas de cada página.',
  adicionar: 'Use “Adicionar PDF” para trazer páginas de outro arquivo, ou “Página em branco”.',
}

let seq = 0
const novaId = () => `p${(seq += 1)}`

/** Miniatura que só é desenhada quando aparece na tela. */
function Miniatura({ fonte, indice, giro, branca }) {
  const [url, setUrl] = useState(null)
  const caixa = useRef(null)
  useEffect(() => {
    if (branca) return undefined
    let vivo = true
    const obs = new IntersectionObserver(
      async ([e]) => {
        if (!e.isIntersecting) return
        obs.disconnect()
        fonte.cache[indice] ??= miniaturaPagina(fonte.leitura, indice + 1, 150)
        const u = await fonte.cache[indice].catch(() => null)
        if (vivo) setUrl(u)
      },
      { rootMargin: '400px' },
    )
    obs.observe(caixa.current)
    return () => {
      vivo = false
      obs.disconnect()
    }
  }, [fonte, indice, branca])

  return (
    <div ref={caixa} className="grid aspect-[3/4] w-full place-items-center overflow-hidden rounded-md border border-borda bg-white">
      {branca ? (
        <span className="text-xs text-neutral-400">em branco</span>
      ) : url ? (
        <img src={url} alt="" draggable={false} className="max-h-full max-w-full object-contain transition-transform duration-200" style={{ transform: `rotate(${giro}deg)` }} />
      ) : (
        <span className="esqueleto size-full" />
      )}
    </div>
  )
}

function Editor({ inicial, foco, aoTrocar }) {
  const [fontes, setFontes] = useState([])
  const [paginas, setPaginas] = useState([])
  const [selecao, setSelecao] = useState(new Set())
  const [arrastando, setArrastando] = useState(null)
  const [erro, setErro] = useState(null)
  const entradaPdf = useRef(null)
  const abertos = useRef([])
  const iniciado = useRef(false)
  const tarefa = useTarefa()

  const adicionarFonte = async (arquivo) => {
    const leitura = await abrirLeitura(arquivo)
    abertos.current.push(leitura)
    const fonte = { id: Math.random(), arquivo, leitura, cache: {}, n: leitura.numPages }
    setFontes((f) => [...f, fonte])
    setPaginas((p) => [...p, ...Array.from({ length: leitura.numPages }, (_, i) => ({ id: novaId(), fonte, indice: i, giro: 0 }))])
  }

  // Uma vez só (o StrictMode do React executa efeitos duas vezes no dev).
  useEffect(() => {
    if (iniciado.current) return
    iniciado.current = true
    adicionarFonte(inicial).catch((e) => setErro(e?.mensagem ?? 'Não foi possível abrir este PDF.'))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inicial])
  // Libera os documentos do pdf.js só quando o editor sai da tela.
  useEffect(() => () => abertos.current.forEach((d) => d.destroy()), [])

  const alternar = (id) =>
    setSelecao((s) => {
      const n = new Set(s)
      n.has(id) ? n.delete(id) : n.add(id)
      return n
    })
  const girar = (ids, delta) => setPaginas((p) => p.map((x) => (ids.has(x.id) ? { ...x, giro: (x.giro + delta + 360) % 360 } : x)))
  const excluir = (ids) => {
    setPaginas((p) => p.filter((x) => !ids.has(x.id)))
    setSelecao(new Set())
  }
  const duplicar = (id) => setPaginas((p) => p.flatMap((x) => (x.id === id ? [x, { ...x, id: novaId() }] : [x])))
  const mover = (de, para) =>
    setPaginas((p) => {
      if (para < 0 || para >= p.length || de === para) return p
      const c = [...p]
      const [x] = c.splice(de, 1)
      c.splice(para, 0, x)
      return c
    })
  const branca = () =>
    setPaginas((p) => {
      const ultimoSel = [...p].reverse().find((x) => selecao.has(x.id))
      const pos = ultimoSel ? p.indexOf(ultimoSel) + 1 : p.length
      const c = [...p]
      c.splice(pos, 0, { id: novaId(), branca: true, giro: 0, modelo: p[Math.max(0, pos - 1)] })
      return c
    })

  const exportar = (soSelecionadas) =>
    tarefa.executar(async ({ progresso }) => {
      const { PDFDocument, degrees } = await obterPdfLib()
      const lista = soSelecionadas ? paginas.filter((p) => selecao.has(p.id)) : paginas
      const final = await PDFDocument.create()
      const edicao = new Map()
      for (let i = 0; i < lista.length; i += 1) {
        const p = lista[i]
        if (p.branca) {
          // Mesmo tamanho da página anterior (ou A4).
          const ref = p.modelo && !p.modelo.branca ? p.modelo : null
          let tamanho = [595.28, 841.89]
          if (ref) {
            if (!edicao.has(ref.fonte)) edicao.set(ref.fonte, await abrirEdicao(ref.fonte.arquivo))
            const { width, height } = edicao.get(ref.fonte).getPage(ref.indice).getSize()
            tamanho = [width, height]
          }
          final.addPage(tamanho).setRotation(degrees(p.giro))
        } else {
          if (!edicao.has(p.fonte)) edicao.set(p.fonte, await abrirEdicao(p.fonte.arquivo))
          const [copia] = await final.copyPages(edicao.get(p.fonte), [p.indice])
          const atual = copia.getRotation().angle
          copia.setRotation(degrees((atual + p.giro) % 360))
          final.addPage(copia)
        }
        progresso((i + 1) / lista.length, 'Montando o PDF')
      }
      const base = semExtensao(fontes[0].arquivo.name)
      return [{ nome: `${base}-${soSelecionadas ? 'extraido' : 'organizado'}.pdf`, blob: await salvarPdf(final), detalhe: `${lista.length} páginas` }]
    }, 'Montando o PDF')

  if (erro) return <Aviso tom="erro" titulo={erro} acao={<Botao variante="secundario" tamanho="p" onClick={aoTrocar}>Escolher outro</Botao>} />
  if (tarefa.fase === 'pronto') return <Resultados itens={tarefa.resultado} duracao={tarefa.duracao} aoAjustar={tarefa.reiniciar} aoReiniciar={aoTrocar} rotuloNovo="Outro PDF" />

  const processando = tarefa.fase === 'processando'
  const nSel = selecao.size

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-suave">{DICAS[foco] ?? DICAS.organizar}</p>
      <div className="cartao sticky top-16 z-20 flex flex-wrap items-center gap-2 p-2.5">
        <input
          ref={entradaPdf}
          type="file"
          accept=".pdf,application/pdf"
          className="sr-only"
          onChange={async (e) => {
            const a = e.target.files?.[0]
            e.target.value = ''
            if (a) await adicionarFonte(a).catch((er) => setErro(er?.mensagem ?? 'Não foi possível abrir este PDF.'))
          }}
        />
        <Botao variante="secundario" tamanho="p" icone="arquivoMais" onClick={() => entradaPdf.current?.click()}>
          Adicionar PDF
        </Botao>
        <Botao variante="secundario" tamanho="p" icone="arquivoMais" onClick={branca}>
          Página em branco
        </Botao>
        <span className="mx-1 hidden h-6 w-px bg-borda sm:block" />
        <Botao variante="fantasma" tamanho="p" onClick={() => setSelecao(nSel === paginas.length ? new Set() : new Set(paginas.map((p) => p.id)))}>
          {nSel === paginas.length && nSel ? 'Limpar seleção' : 'Selecionar todas'}
        </Botao>
        {nSel ? (
          <>
            <Botao variante="secundario" tamanho="p" icone="girar" onClick={() => girar(selecao, 90)}>
              Girar {nSel}
            </Botao>
            <Botao variante="perigo" tamanho="p" icone="apagar" onClick={() => excluir(selecao)}>
              Excluir {nSel === 1 ? 'selecionada' : `${nSel} selecionadas`}
            </Botao>
            <Botao variante="secundario" tamanho="p" icone="extrair" onClick={() => exportar(true)}>
              Extrair {nSel === 1 ? 'selecionada' : 'selecionadas'}
            </Botao>
          </>
        ) : null}
        <span className="ml-auto text-xs text-fraca tabular-nums">{paginas.length} páginas</span>
      </div>

      {!paginas.length && fontes.length ? <Aviso tom="alerta">Todas as páginas foram excluídas. Adicione um PDF ou uma página em branco.</Aviso> : null}

      <ol className="grid grid-cols-2 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
        {paginas.map((p, i) => {
          const sel = selecao.has(p.id)
          return (
            <li
              key={p.id}
              draggable
              onDragStart={(e) => {
                setArrastando(i)
                e.dataTransfer.effectAllowed = 'move'
              }}
              onDragOver={(e) => {
                e.preventDefault()
                if (arrastando != null && arrastando !== i) {
                  mover(arrastando, i)
                  setArrastando(i)
                }
              }}
              onDragEnd={() => setArrastando(null)}
              className={`group relative flex cursor-grab flex-col gap-1.5 rounded-xl border-2 p-2 transition-[border-color,opacity] active:cursor-grabbing ${sel ? 'border-acento bg-acento-suave' : 'border-transparent hover:border-borda-forte'} ${arrastando === i ? 'opacity-40' : ''}`}
            >
              <button type="button" onClick={() => alternar(p.id)} aria-pressed={sel} aria-label={`Selecionar página ${i + 1}`} className="block w-full">
                <Miniatura fonte={p.fonte} indice={p.indice} giro={p.giro} branca={p.branca} />
              </button>
              <div className="flex items-center justify-between gap-1">
                <span className="text-xs font-semibold text-suave tabular-nums">{i + 1}</span>
                <div className="flex">
                  {[
                    ['girar', 'Girar', () => girar(new Set([p.id]), 90)],
                    ['copiar', 'Duplicar', () => duplicar(p.id)],
                    ['apagar', 'Excluir', () => excluir(new Set([p.id]))],
                  ].map(([icone, rotulo, acao]) => (
                    <button key={rotulo} type="button" onClick={acao} aria-label={`${rotulo} página ${i + 1}`} title={rotulo} className="grid size-7 place-items-center rounded-md text-fraca hover:bg-superficie-2 hover:text-tinta">
                      <Icone nome={icone} tamanho={14} />
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex justify-between sm:hidden">
                <button type="button" onClick={() => mover(i, i - 1)} disabled={i === 0} className="h-7 rounded-md px-2 text-xs text-suave disabled:opacity-30" aria-label="Mover para trás">
                  ←
                </button>
                <button type="button" onClick={() => mover(i, i + 1)} disabled={i === paginas.length - 1} className="h-7 rounded-md px-2 text-xs text-suave disabled:opacity-30" aria-label="Mover para frente">
                  →
                </button>
              </div>
              {sel ? (
                <span className="pointer-events-none absolute top-3 right-3 grid size-5 place-items-center rounded-full bg-acento text-white">
                  <Icone nome="check" tamanho={12} strokeWidth={3} />
                </span>
              ) : null}
            </li>
          )
        })}
      </ol>

      <div className="cartao flex flex-wrap items-center justify-end gap-3 p-3">
        {tarefa.fase === 'erro' ? <Aviso tom="erro" className="mr-auto">{tarefa.mensagem}</Aviso> : null}
        {processando ? (
          <div className="w-full sm:w-80">
            <Progresso valor={tarefa.progresso} rotulo={tarefa.rotulo} />
          </div>
        ) : (
          <>
            <Botao variante="secundario" onClick={aoTrocar}>
              Começar de novo
            </Botao>
            <Botao icone="baixar" onClick={() => exportar(false)} disabled={!paginas.length}>
              Salvar PDF
            </Botao>
          </>
        )}
      </div>
    </div>
  )
}

export default function Organizar({ foco = 'organizar' }) {
  const [arquivos, setArquivos] = useState([])
  if (!arquivos.length) {
    return <SeletorArquivos arquivos={arquivos} aoMudar={setArquivos} multiplos={false} extensoes={['pdf']} descricaoFormatos="PDF" limiteBytes={LIMITE_PDF} />
  }
  return <Editor key={arquivos[0].id} inicial={arquivos[0].arquivo} foco={foco} aoTrocar={() => setArquivos([])} />
}
