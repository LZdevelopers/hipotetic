import { useCallback, useEffect, useRef, useState } from 'react'
import { Resultados } from '../../componentes/ferramenta/Resultados'
import { SeletorArquivos } from '../../componentes/ferramenta/SeletorArquivos'
import { Icone } from '../../componentes/Icone'
import { AreaTexto, Aviso, Botao, Caixa, Deslizante, Grupo, Progresso } from '../../componentes/ui'
import { LIMITE_PDF, abrirEdicao, abrirLeitura, desenharPagina, obterPdfLib, salvarPdf } from '../../motores/pdf'
import { cor as corPdf, fontePadrao, pontoNaPagina, textoSeguro } from '../../motores/pdf/escrita'
import { trocarExtensao } from '../../nucleo/arquivos'
import { useTarefa } from '../../nucleo/tarefa'
import { CorDeFundo } from '../imagem/_comum'
import { DialogoAssinatura } from './_assinatura'
import { useEmEdicao } from '../../nucleo/edicao'

const FERRAMENTAS = [
  { id: 'selecionar', rotulo: 'Selecionar', icone: 'selecao' },
  { id: 'texto', rotulo: 'Texto', icone: 'tipo' },
  { id: 'assinatura', rotulo: 'Assinatura', icone: 'assinatura' },
  { id: 'imagem', rotulo: 'Imagem', icone: 'imagemMais' },
  { id: 'destaque', rotulo: 'Destacar', icone: 'marcaTexto' },
  { id: 'nota', rotulo: 'Nota', icone: 'caneta' },
  { id: 'retangulo', rotulo: 'Retângulo', icone: 'selecao' },
]
const FONTE_UI = 'Helvetica, Arial, sans-serif' // mesma métrica da Helvetica do PDF
let seq = 0

/** Uma página: o desenho do pdf.js (sob demanda) + os elementos por cima. */
function Pagina({ doc, numero, largura, escala, elementos, selecionado, ferramenta, aoClicar, aoSelecionar, aoMover }) {
  const canvas = useRef(null)
  const caixa = useRef(null)
  const [visivel, setVisivel] = useState(false)
  const altura = largura.alturaPt * escala

  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => e.isIntersecting && setVisivel(true), { rootMargin: '600px' })
    obs.observe(caixa.current)
    return () => obs.disconnect()
  }, [])
  useEffect(() => {
    if (!visivel) return
    desenharPagina(doc, numero, escala * (devicePixelRatio || 1), { canvas: canvas.current }).catch(() => {})
  }, [visivel, doc, numero, escala])

  const arrastar = (el, modo) => (e) => {
    e.stopPropagation()
    e.preventDefault()
    aoSelecionar(el.id)
    const inicio = { x: e.clientX, y: e.clientY, el }
    const mover = (ev) => {
      const dx = (ev.clientX - inicio.x) / escala
      const dy = (ev.clientY - inicio.y) / escala
      if (modo === 'mover') aoMover(el.id, { x: inicio.el.x + dx, y: inicio.el.y + dy })
      else {
        const w = Math.max(12, inicio.el.w + dx)
        aoMover(el.id, el.proporcao ? { w, h: w / el.proporcao } : { w, h: Math.max(8, inicio.el.h + dy) })
      }
    }
    const soltar = () => {
      removeEventListener('pointermove', mover)
      removeEventListener('pointerup', soltar)
    }
    addEventListener('pointermove', mover)
    addEventListener('pointerup', soltar)
  }

  return (
    <div
      ref={caixa}
      className={`relative mx-auto bg-white shadow-[var(--shadow-cartao)] ${ferramenta === 'selecionar' ? '' : 'cursor-crosshair'}`}
      style={{ width: largura.larguraPt * escala, height: altura }}
      onPointerDown={(e) => {
        if (e.target !== e.currentTarget && e.target !== canvas.current) return
        const r = e.currentTarget.getBoundingClientRect()
        aoClicar(numero, (e.clientX - r.left) / escala, (e.clientY - r.top) / escala)
      }}
    >
      <canvas ref={canvas} className="absolute inset-0 size-full" aria-label={`Página ${numero}`} />
      {elementos.map((el) => {
        const sel = el.id === selecionado
        const estilo = { left: el.x * escala, top: el.y * escala }
        let conteudo
        if (el.tipo === 'texto' || el.tipo === 'nota') {
          conteudo = (
            <div
              className={el.tipo === 'nota' ? 'rounded-sm bg-[#fff3a3] px-[0.4em] py-[0.25em] shadow-sm' : ''}
              style={{ fontFamily: FONTE_UI, fontSize: el.tamanho * escala, lineHeight: 1.2, color: el.cor, fontWeight: el.negrito ? 700 : 400, whiteSpace: 'pre' }}
            >
              {el.texto || ' '}
            </div>
          )
        } else if (el.tipo === 'imagem') {
          conteudo = <img src={el.url} alt="" draggable={false} style={{ width: el.w * escala, height: el.h * escala }} className="block" />
        } else {
          conteudo = (
            <div
              style={{
                width: el.w * escala,
                height: el.h * escala,
                background: el.tipo === 'destaque' ? 'rgb(255 230 0 / 0.4)' : 'transparent',
                border: el.tipo === 'retangulo' ? `${Math.max(1, el.espessura * escala)}px solid ${el.cor}` : undefined,
                mixBlendMode: el.tipo === 'destaque' ? 'multiply' : undefined,
              }}
            />
          )
        }
        return (
          <div
            key={el.id}
            onPointerDown={arrastar(el, 'mover')}
            className={`absolute touch-none ${ferramenta === 'selecionar' ? 'cursor-move' : ''} ${sel ? 'outline-2 outline-offset-2 outline-acento' : 'hover:outline-1 hover:outline-dashed hover:outline-acento/60'}`}
            style={estilo}
          >
            {conteudo}
            {sel && el.w != null ? (
              <span onPointerDown={arrastar(el, 'redimensionar')} className="absolute -right-2 -bottom-2 size-4 cursor-nwse-resize rounded-sm border-2 border-white bg-acento" aria-label="Redimensionar" />
            ) : null}
          </div>
        )
      })}
    </div>
  )
}

function Editor({ arquivo, aoTrocar, inicial }) {
  useEmEdicao()
  const [doc, setDoc] = useState(null)
  const [tamanhos, setTamanhos] = useState([])
  const [erro, setErro] = useState(null)
  const [ferramenta, setFerramenta] = useState(inicial === 'assinatura' ? 'assinatura' : 'texto')
  const [elementos, setElementos] = useState([])
  const [selecionado, setSelecionado] = useState(null)
  const [assinatura, setAssinatura] = useState(null)
  const [dialogo, setDialogo] = useState(null)
  const [estilo, setEstilo] = useState({ tamanho: 14, cor: '#0b0b0d', negrito: false })
  const area = useRef(null)
  const entradaImagem = useRef(null)
  const pendente = useRef(null)
  const [largura, setLargura] = useState(800)
  const tarefa = useTarefa()

  useEffect(() => {
    let vivo = true
    let aberto
    ;(async () => {
      aberto = await abrirLeitura(arquivo)
      const t = []
      for (let n = 1; n <= aberto.numPages; n += 1) {
        const v = (await aberto.getPage(n)).getViewport({ scale: 1 })
        t.push({ larguraPt: v.width, alturaPt: v.height })
      }
      if (vivo) {
        setTamanhos(t)
        setDoc(aberto)
      }
    })().catch((e) => vivo && setErro(e?.mensagem ?? 'Não foi possível abrir este PDF.'))
    return () => {
      vivo = false
      aberto?.destroy()
    }
  }, [arquivo])

  useEffect(() => {
    const obs = new ResizeObserver(([e]) => setLargura(e.contentRect.width))
    if (area.current) obs.observe(area.current)
    return () => obs.disconnect()
  }, [doc])

  const sel = elementos.find((e) => e.id === selecionado)
  const atualizar = useCallback((id, mudancas) => setElementos((l) => l.map((e) => (e.id === id ? { ...e, ...mudancas } : e))), [])
  const remover = (id) => {
    setElementos((l) => l.filter((e) => e.id !== id))
    setSelecionado(null)
  }

  useEffect(() => {
    const aoTeclar = (e) => {
      if (!selecionado || e.target.closest('input, textarea, select')) return
      if (e.key === 'Delete' || e.key === 'Backspace') remover(selecionado)
      if (e.key === 'Escape') setSelecionado(null)
    }
    addEventListener('keydown', aoTeclar)
    return () => removeEventListener('keydown', aoTeclar)
  }, [selecionado])

  const inserirImagem = (pagina, x, y, canvasOuImg, tipo = 'imagem') => {
    const url = canvasOuImg.toDataURL('image/png')
    const larguraMax = tipo === 'assinatura' ? 160 : 200
    const w = Math.min(larguraMax, canvasOuImg.width)
    const h = (w * canvasOuImg.height) / canvasOuImg.width
    const el = { id: `e${(seq += 1)}`, tipo: 'imagem', pagina, x: x - w / 2, y: y - h / 2, w, h, proporcao: w / h, url }
    setElementos((l) => [...l, el])
    setSelecionado(el.id)
    setFerramenta('selecionar')
  }

  const aoClicar = (pagina, x, y) => {
    if (ferramenta === 'selecionar') return setSelecionado(null)
    if (ferramenta === 'assinatura') {
      if (assinatura) return inserirImagem(pagina, x, y, assinatura, 'assinatura')
      pendente.current = { pagina, x, y }
      return setDialogo('assinatura')
    }
    if (ferramenta === 'imagem') {
      pendente.current = { pagina, x, y }
      return entradaImagem.current?.click()
    }
    const id = `e${(seq += 1)}`
    let el
    if (ferramenta === 'texto' || ferramenta === 'nota') el = { id, tipo: ferramenta, pagina, x, y: y - estilo.tamanho * 0.6, texto: ferramenta === 'nota' ? 'Nota' : 'Texto', ...estilo, cor: ferramenta === 'nota' ? '#3d3200' : estilo.cor }
    else if (ferramenta === 'destaque') el = { id, tipo: 'destaque', pagina, x: x - 60, y: y - 8, w: 120, h: 16 }
    else el = { id, tipo: 'retangulo', pagina, x: x - 60, y: y - 30, w: 120, h: 60, cor: '#c8242b', espessura: 2 }
    setElementos((l) => [...l, el])
    setSelecionado(id)
    setFerramenta('selecionar')
  }

  const salvar = () =>
    tarefa.executar(async ({ progresso }) => {
      const { rgb, BlendMode } = await obterPdfLib()
      const pdf = await abrirEdicao(arquivo)
      const fontes = { normal: await fontePadrao(pdf), negrito: await fontePadrao(pdf, true) }
      const paginas = pdf.getPages()
      for (const [i, el] of elementos.entries()) {
        const pagina = paginas[el.pagina - 1]
        const H = tamanhos[el.pagina - 1].alturaPt
        if (el.tipo === 'texto' || el.tipo === 'nota') {
          const fonte = el.negrito ? fontes.negrito : fontes.normal
          const linhas = textoSeguro(fonte, el.texto).split('\n')
          if (el.tipo === 'nota') {
            const w = Math.max(...linhas.map((l) => fonte.widthOfTextAtSize(l, el.tamanho))) + el.tamanho * 0.8
            const h = linhas.length * el.tamanho * 1.2 + el.tamanho * 0.5
            const p = pontoNaPagina(pagina, el.x, H - el.y - h)
            pagina.drawRectangle({ x: p.x, y: p.y, width: w, height: h, color: rgb(1, 0.953, 0.639), rotate: { type: 'degrees', angle: p.giro } })
          }
          const recuo = el.tipo === 'nota' ? el.tamanho * 0.4 : 0
          const topo = el.tipo === 'nota' ? el.tamanho * 0.25 : 0
          linhas.forEach((linha, n) => {
            // Linha n: com entrelinha 1,2 (igual ao CSS da tela), a base da linha
            // fica a ~0,95 do corpo abaixo do topo (métrica da Helvetica/Arial).
            const vy = H - el.y - topo - el.tamanho * 1.2 * n - el.tamanho * 0.95
            const p = pontoNaPagina(pagina, el.x + recuo, vy)
            pagina.drawText(linha, { x: p.x, y: p.y, size: el.tamanho, font: fonte, color: rgb(...hexParaRgb(el.cor)), rotate: { type: 'degrees', angle: p.giro } })
          })
        } else if (el.tipo === 'imagem') {
          const png = await pdf.embedPng(el.url)
          const p = pontoNaPagina(pagina, el.x, H - el.y - el.h)
          pagina.drawImage(png, { x: p.x, y: p.y, width: el.w, height: el.h, rotate: { type: 'degrees', angle: p.giro } })
        } else if (el.tipo === 'destaque') {
          const p = pontoNaPagina(pagina, el.x, H - el.y - el.h)
          pagina.drawRectangle({ x: p.x, y: p.y, width: el.w, height: el.h, color: rgb(1, 0.9, 0), opacity: 0.4, blendMode: BlendMode.Multiply, rotate: { type: 'degrees', angle: p.giro } })
        } else {
          const p = pontoNaPagina(pagina, el.x, H - el.y - el.h)
          pagina.drawRectangle({ x: p.x, y: p.y, width: el.w, height: el.h, borderColor: await corPdf(el.cor), borderWidth: el.espessura, rotate: { type: 'degrees', angle: p.giro } })
        }
        progresso((i + 1) / elementos.length, 'Gravando as alterações')
      }
      return [{ nome: trocarExtensao(arquivo.name, 'pdf', '-editado'), blob: await salvarPdf(pdf), detalhe: `${elementos.length} ${elementos.length === 1 ? 'alteração' : 'alterações'}` }]
    }, 'Gravando as alterações')

  if (erro) return <Aviso tom="erro" titulo={erro} acao={<Botao variante="secundario" tamanho="p" onClick={aoTrocar}>Escolher outro</Botao>} />
  if (tarefa.fase === 'pronto') return <Resultados itens={tarefa.resultado} duracao={tarefa.duracao} aoAjustar={tarefa.reiniciar} aoReiniciar={aoTrocar} rotuloNovo="Outro PDF" />

  const escala = tamanhos.length ? Math.min(1.6, (largura - 2) / Math.max(...tamanhos.map((t) => t.larguraPt))) : 1
  const processando = tarefa.fase === 'processando'

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-start">
      <div ref={area} className="flex min-w-0 flex-col gap-4 rounded-[var(--radius-cartao)] bg-superficie-2 p-3 sm:p-4">
        {!doc ? <div className="esqueleto mx-auto aspect-[3/4] w-full max-w-2xl rounded" /> : null}
        {doc
          ? tamanhos.map((t, i) => (
              <Pagina
                key={i}
                doc={doc}
                numero={i + 1}
                largura={t}
                escala={escala}
                elementos={elementos.filter((e) => e.pagina === i + 1)}
                selecionado={selecionado}
                ferramenta={ferramenta}
                aoClicar={aoClicar}
                aoSelecionar={setSelecionado}
                aoMover={atualizar}
              />
            ))
          : null}
      </div>

      <aside className="cartao flex flex-col gap-5 p-4 lg:sticky lg:top-20">
        <Grupo titulo="Ferramentas">
          <div className="grid grid-cols-2 gap-1.5">
            {FERRAMENTAS.map((f) => (
              <button
                key={f.id}
                type="button"
                aria-pressed={ferramenta === f.id}
                onClick={() => (f.id === 'assinatura' && !assinatura ? (setFerramenta('assinatura'), setDialogo('assinatura')) : setFerramenta(f.id))}
                className={`flex h-9 items-center gap-2 rounded-lg border px-2.5 text-xs font-semibold transition-colors ${ferramenta === f.id ? 'border-marca bg-marca text-sobre-marca' : 'border-borda text-suave hover:text-tinta'}`}
              >
                <Icone nome={f.icone} tamanho={15} />
                {f.rotulo}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-fraca">
            {ferramenta === 'selecionar' ? 'Clique num item para editar; arraste para mover. Delete apaga.' : 'Clique na página onde quer colocar.'}
          </p>
          {assinatura ? (
            <button type="button" onClick={() => setDialogo('assinatura')} className="mt-2 text-xs font-semibold text-acento hover:underline">
              Trocar assinatura
            </button>
          ) : null}
        </Grupo>

        {sel ? (
          <Grupo titulo="Item selecionado">
            <div className="flex flex-col gap-4">
              {sel.tipo === 'texto' || sel.tipo === 'nota' ? (
                <>
                  <AreaTexto rotulo="Texto" valor={sel.texto} aoMudar={(v) => atualizar(sel.id, { texto: v })} rows={3} className="[&_textarea]:min-h-20 [&_textarea]:font-sans" />
                  <Deslizante rotulo="Tamanho" valor={sel.tamanho} aoMudar={(v) => atualizar(sel.id, { tamanho: v })} min={6} max={72} formatar={(v) => `${v} pt`} />
                  {sel.tipo === 'texto' ? (
                    <>
                      <CorDeFundo valor={sel.cor} aoMudar={(v) => atualizar(sel.id, { cor: v })} rotulo="Cor" />
                      <Caixa rotulo="Negrito" marcado={sel.negrito} aoMudar={(v) => atualizar(sel.id, { negrito: v })} />
                    </>
                  ) : null}
                </>
              ) : null}
              {sel.tipo === 'retangulo' ? (
                <>
                  <CorDeFundo valor={sel.cor} aoMudar={(v) => atualizar(sel.id, { cor: v })} rotulo="Cor da borda" />
                  <Deslizante rotulo="Espessura" valor={sel.espessura} aoMudar={(v) => atualizar(sel.id, { espessura: v })} min={0.5} max={8} passo={0.5} formatar={(v) => `${v} pt`} />
                </>
              ) : null}
              <Botao variante="perigo" tamanho="p" icone="apagar" onClick={() => remover(sel.id)}>
                Excluir item
              </Botao>
            </div>
          </Grupo>
        ) : ferramenta === 'texto' ? (
          <Grupo titulo="Texto novo">
            <div className="flex flex-col gap-4">
              <Deslizante rotulo="Tamanho" valor={estilo.tamanho} aoMudar={(v) => setEstilo((s) => ({ ...s, tamanho: v }))} min={6} max={72} formatar={(v) => `${v} pt`} />
              <CorDeFundo valor={estilo.cor} aoMudar={(v) => setEstilo((s) => ({ ...s, cor: v }))} rotulo="Cor" />
            </div>
          </Grupo>
        ) : null}

        <p className="text-xs text-fraca">Textos usam a fonte Helvetica: letras com acento funcionam; emojis e outros alfabetos não.</p>
        {tarefa.fase === 'erro' ? <Aviso tom="erro">{tarefa.mensagem}</Aviso> : null}
        {processando ? (
          <Progresso valor={tarefa.progresso} rotulo={tarefa.rotulo} />
        ) : (
          <div className="flex gap-2">
            <Botao variante="secundario" onClick={aoTrocar}>
              Trocar
            </Botao>
            <Botao className="flex-1" icone="baixar" onClick={salvar} disabled={!elementos.length}>
              Salvar PDF
            </Botao>
          </div>
        )}
      </aside>

      <input
        ref={entradaImagem}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="sr-only"
        onChange={async (e) => {
          const a = e.target.files?.[0]
          e.target.value = ''
          if (!a || !pendente.current) return
          const bmp = await createImageBitmap(a, { imageOrientation: 'from-image' })
          const c = document.createElement('canvas')
          c.width = bmp.width
          c.height = bmp.height
          c.getContext('2d').drawImage(bmp, 0, 0)
          const { pagina, x, y } = pendente.current
          inserirImagem(pagina, x, y, c)
        }}
      />
      <DialogoAssinatura
        aberto={dialogo === 'assinatura'}
        aoFechar={() => setDialogo(null)}
        aoConfirmar={(canvas) => {
          setAssinatura(canvas)
          setDialogo(null)
          setFerramenta('assinatura')
          if (pendente.current) {
            const { pagina, x, y } = pendente.current
            pendente.current = null
            inserirImagem(pagina, x, y, canvas, 'assinatura')
          }
        }}
      />
    </div>
  )
}

function hexParaRgb(hex) {
  const n = parseInt(String(hex).replace('#', ''), 16)
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]
}

export default function Editar({ ferramenta = 'texto' }) {
  const [arquivos, setArquivos] = useState([])
  if (!arquivos.length) return <SeletorArquivos arquivos={arquivos} aoMudar={setArquivos} multiplos={false} extensoes={['pdf']} descricaoFormatos="PDF" limiteBytes={LIMITE_PDF} />
  return <Editor key={arquivos[0].id} arquivo={arquivos[0].arquivo} inicial={ferramenta} aoTrocar={() => setArquivos([])} />
}
