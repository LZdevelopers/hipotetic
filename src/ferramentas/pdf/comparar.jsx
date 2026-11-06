import { useEffect, useState } from 'react'
import { SeletorArquivos } from '../../componentes/ferramenta/SeletorArquivos'
import { Aviso, Botao, Campo, Progresso, Segmentado } from '../../componentes/ui'
import { LIMITE_PDF, abrirLeitura, desenharPagina, extrairTexto } from '../../motores/pdf'
import { useTarefa } from '../../nucleo/tarefa'

/**
 * Diferença visual: pixels que mudam além de uma tolerância ficam em vermelho
 * sobre a página B esmaecida. Devolve { url, fracao } (fração de pixels diferentes).
 */
async function diferencaVisual(docA, docB, numero) {
  const escala = 1.5
  const [a, b] = await Promise.all([desenharPagina(docA, numero, escala), desenharPagina(docB, numero, escala)])
  const w = Math.max(a.width, b.width)
  const h = Math.max(a.height, b.height)
  const ler = (c) => {
    const t = document.createElement('canvas')
    t.width = w
    t.height = h
    const ctx = t.getContext('2d', { willReadFrequently: true })
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, w, h)
    ctx.drawImage(c, 0, 0)
    return ctx.getImageData(0, 0, w, h)
  }
  const da = ler(a).data
  const imgB = ler(b)
  const db = imgB.data
  let diferentes = 0
  for (let i = 0; i < db.length; i += 4) {
    const delta = Math.abs(da[i] - db[i]) + Math.abs(da[i + 1] - db[i + 1]) + Math.abs(da[i + 2] - db[i + 2])
    if (delta > 60) {
      diferentes += 1
      db[i] = 230
      db[i + 1] = 30
      db[i + 2] = 50
    } else {
      // Esmaece o que é igual, para as diferenças saltarem aos olhos.
      db[i] = 255 - (255 - db[i]) * 0.25
      db[i + 1] = 255 - (255 - db[i + 1]) * 0.25
      db[i + 2] = 255 - (255 - db[i + 2]) * 0.25
    }
  }
  const saida = document.createElement('canvas')
  saida.width = w
  saida.height = h
  saida.getContext('2d').putImageData(imgB, 0, 0)
  return { url: saida.toDataURL('image/png'), fracao: diferentes / (w * h) }
}

function TextoComparado({ partes }) {
  return (
    <p className="text-sm leading-relaxed whitespace-pre-wrap text-texto">
      {partes.map((p, i) =>
        p.added ? (
          <ins key={i} className="rounded-sm bg-sucesso-suave text-sucesso no-underline decoration-sucesso">
            {p.value}
          </ins>
        ) : p.removed ? (
          <del key={i} className="rounded-sm bg-perigo-suave text-perigo">
            {p.value}
          </del>
        ) : (
          <span key={i}>{p.value}</span>
        ),
      )}
    </p>
  )
}

function Resultado({ r, aoReiniciar }) {
  const [modo, setModo] = useState('texto')
  const [pagina, setPagina] = useState(r.paginas.findIndex((p) => p.mudou) >= 0 ? r.paginas.findIndex((p) => p.mudou) : 0)
  const [visual, setVisual] = useState(null)
  const total = Math.min(r.docA.numPages, r.docB.numPages)

  useEffect(() => {
    if (modo !== 'visual' || pagina >= total) return
    let vivo = true
    setVisual(null)
    diferencaVisual(r.docA, r.docB, pagina + 1).then((v) => vivo && setVisual(v))
    return () => {
      vivo = false
    }
  }, [modo, pagina, r, total])

  const mudadas = r.paginas.filter((p) => p.mudou).length
  return (
    <div className="flex flex-col gap-5">
      <div className="cartao flex flex-wrap items-center gap-x-6 gap-y-3 p-4 sm:p-5">
        <div>
          <p className="text-sm font-semibold text-tinta">{mudadas ? `${mudadas} ${mudadas === 1 ? 'página com diferenças' : 'páginas com diferenças'}` : 'Nenhuma diferença de texto'}</p>
          <p className="text-xs text-fraca">
            <span className="text-sucesso">+{r.adicionadas.toLocaleString('pt-BR')} palavras</span> · <span className="text-perigo">−{r.removidas.toLocaleString('pt-BR')} palavras</span> · A: {r.docA.numPages} pág. · B: {r.docB.numPages} pág.
          </p>
        </div>
        <Segmentado
          valor={modo}
          aoMudar={setModo}
          className="ml-auto"
          opcoes={[
            { valor: 'texto', rotulo: 'Texto' },
            { valor: 'visual', rotulo: 'Visual' },
          ]}
        />
        <Botao variante="secundario" tamanho="p" icone="refazer" onClick={aoReiniciar}>
          Comparar outros
        </Botao>
      </div>

      <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Páginas">
        {r.paginas.map((p, i) => (
          <button
            key={i}
            type="button"
            role="tab"
            aria-selected={pagina === i}
            onClick={() => setPagina(i)}
            className={`h-8 min-w-8 rounded-md border px-2 text-xs font-semibold tabular-nums ${pagina === i ? 'border-marca bg-marca text-sobre-marca' : p.mudou ? 'border-alerta/40 bg-alerta-suave text-alerta' : 'border-borda text-suave'}`}
          >
            {i + 1}
          </button>
        ))}
      </div>

      {modo === 'texto' ? (
        <section className="cartao p-4 sm:p-5">
          {r.paginas[pagina].soEm ? <Aviso tom="alerta" className="mb-3">Esta página só existe no PDF {r.paginas[pagina].soEm}.</Aviso> : null}
          <TextoComparado partes={r.paginas[pagina].partes} />
        </section>
      ) : pagina >= total ? (
        <Aviso tom="alerta">Esta página só existe em um dos PDFs.</Aviso>
      ) : (
        <section className="cartao p-4 sm:p-5">
          {!visual ? (
            <div className="esqueleto mx-auto aspect-[3/4] w-full max-w-2xl rounded" />
          ) : (
            <>
              <p className="mb-3 text-xs text-fraca">Em vermelho, o que mudou visualmente ({(visual.fracao * 100).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}% da página).</p>
              <img src={visual.url} alt={`Diferenças visuais da página ${pagina + 1}`} className="mx-auto max-w-full rounded border border-borda" />
            </>
          )}
        </section>
      )}
    </div>
  )
}

export default function Comparar() {
  const [a, setA] = useState([])
  const [b, setB] = useState([])
  const tarefa = useTarefa()

  const comparar = () =>
    tarefa.executar(async ({ progresso, sinal }) => {
      const { diffWords } = await import('diff')
      const [docA, docB] = await Promise.all([abrirLeitura(a[0].arquivo), abrirLeitura(b[0].arquivo)])
      const [ta, tb] = await Promise.all([extrairTexto(docA, (v) => progresso(v / 2, 'Lendo o PDF A'), sinal), extrairTexto(docB, (v) => progresso(0.5 + v / 2, 'Lendo o PDF B'), sinal)])
      let adicionadas = 0
      let removidas = 0
      const paginas = Array.from({ length: Math.max(ta.length, tb.length) }, (_, i) => {
        const partes = diffWords(ta[i] ?? '', tb[i] ?? '')
        for (const p of partes) {
          const n = p.value.split(/\s+/).filter(Boolean).length
          if (p.added) adicionadas += n
          if (p.removed) removidas += n
        }
        return { partes, mudou: partes.some((p) => p.added || p.removed), soEm: i >= ta.length ? 'B' : i >= tb.length ? 'A' : null }
      })
      return { docA, docB, paginas, adicionadas, removidas }
    }, 'Lendo os PDFs')

  if (tarefa.fase === 'pronto')
    return (
      <Resultado
        r={tarefa.resultado}
        aoReiniciar={() => {
          // Libera os documentos do pdf.js (memória do worker).
          tarefa.resultado.docA.destroy()
          tarefa.resultado.docB.destroy()
          setA([])
          setB([])
          tarefa.reiniciar()
        }}
      />
    )

  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-5 md:grid-cols-2">
        <Campo rotulo="PDF A (original)">
          <SeletorArquivos arquivos={a} aoMudar={setA} multiplos={false} extensoes={['pdf']} descricaoFormatos="PDF" limiteBytes={LIMITE_PDF} compacto />
        </Campo>
        <Campo rotulo="PDF B (nova versão)">
          <SeletorArquivos arquivos={b} aoMudar={setB} multiplos={false} extensoes={['pdf']} descricaoFormatos="PDF" limiteBytes={LIMITE_PDF} compacto />
        </Campo>
      </div>
      {tarefa.fase === 'erro' ? <Aviso tom="erro">{tarefa.mensagem}</Aviso> : null}
      {tarefa.fase === 'processando' ? (
        <Progresso valor={tarefa.progresso} rotulo={tarefa.rotulo} aoCancelar={tarefa.cancelar} />
      ) : (
        <Botao tamanho="g" icone="comparar" className="self-start" onClick={comparar} disabled={!a.length || !b.length}>
          Comparar
        </Botao>
      )}
    </div>
  )
}
