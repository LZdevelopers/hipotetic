import { useCallback, useEffect, useRef, useState } from 'react'
import { BotaoAcao, useHistorico } from '../../componentes/editor/Comum'
import { DialogoBaixar, NomeEditavel, OpcoesCartoes } from '../../componentes/ferramenta/Baixar'
import { Resultados } from '../../componentes/ferramenta/Resultados'
import { Icone } from '../../componentes/Icone'
import { AreaTexto, Aviso, Botao, Caixa, Deslizante, Entrada, Grupo, Progresso, SeloCategoria } from '../../componentes/ui'
import { AtalhosDoEditor } from '../../componentes/ferramenta/Atalhos'
import { LIMITE_PDF, abrirEdicao, abrirLeitura, lerIntervalos, obterPdfLib, salvarPdf } from '../../motores/pdf'
import { cor as corPdf, fontePadrao, pontoNaPagina, tamanhoVisual, textoSeguro } from '../../motores/pdf/escrita'
import { DICAS_COMPRESSAO, otimizarPdf, protegerPdf } from '../../motores/pdf/otimizar'
import { semExtensao } from '../../nucleo/arquivos'
import { useEmEdicao } from '../../nucleo/edicao'
import { useSalvo, useTarefaSalva } from '../../nucleo/salvo'
import { ErroAmigavel } from '../../nucleo/tarefa'
import { CorDeFundo } from '../imagem/_comum'
import { DialogoAssinatura } from './_assinatura'

/*
 * Editor de PDF: junta numa tela só o que antes eram várias ferramentas.
 *   - páginas (à esquerda): reordenar arrastando, girar, duplicar, excluir,
 *     página em branco, juntar outros PDFs, selecionar para extrair;
 *   - página (no meio): texto, assinatura, imagem, destaque, nota, retângulo;
 *   - painel (à direita): anotar, numerar e marca d'água, dados do documento;
 *   - baixar (modal): nome, todas ou só as selecionadas, um PDF ou um por
 *     página, reduzir o tamanho e senha para abrir.
 * O projeto inteiro fica salvo no navegador (nucleo/salvo.js).
 *
 * Modo foco: as ferramentas rápidas (Unir, Dividir, Numerar…) abrem este
 * editor já configurado e simplificado (prop `modo`); "Editor completo"
 * libera o resto. Sem modo e sem arquivo, mostra os atalhos da categoria.
 */

const A4 = [595.28, 841.89]
const FONTE_UI = 'Helvetica, Arial, sans-serif' // mesma métrica da Helvetica do PDF
const VAZIO = {
  fontes: [], // [{ id, arquivo }]
  paginas: [], // [{ id, fonte, indice, giro }] ou { id, branca: true, tamanho: [w, h], giro }
  elementos: [], // anotações: { id, pagina (id), tipo, x, y, … } em pontos, origem no topo esquerdo da página como aparece
  numeros: { ativo: false, posicao: 'base-centro', formato: '{n} / {total}', inicio: 1, tamanho: 11 },
  marca: { ativo: false, texto: 'CONFIDENCIAL', opacidade: 15, tamanho: 64, angulo: 45, cor: '#c8242b' },
  meta: { titulo: '', autor: '', assunto: '', palavras: '' },
  nome: null,
}
const FERRAMENTAS = [
  { id: 'selecionar', rotulo: 'Selecionar', icone: 'selecao' },
  { id: 'texto', rotulo: 'Texto', icone: 'tipo' },
  { id: 'assinatura', rotulo: 'Assinatura', icone: 'assinatura' },
  { id: 'imagem', rotulo: 'Imagem', icone: 'imagemMais' },
  { id: 'destaque', rotulo: 'Destacar', icone: 'marcaTexto' },
  { id: 'nota', rotulo: 'Nota', icone: 'caneta' },
  { id: 'retangulo', rotulo: 'Retângulo', icone: 'selecao' },
]
const ABAS = [
  { id: 'anotar', rotulo: 'Anotar', icone: 'caneta' },
  { id: 'paginas', rotulo: 'Números e marca', icone: 'carimbo' },
  { id: 'documento', rotulo: 'Documento', icone: 'info' },
]
/** Ferramentas rápidas que abrem o editor em modo foco (catálogo: predef.modo). */
const MODOS = {
  unir: {
    dica: 'Escolha dois ou mais PDFs. Arraste as miniaturas para pôr as páginas na ordem.',
    vazio: 'Escolha ou arraste os PDFs que quer unir',
    acao: 'Unir e baixar',
    baixar: { separar: 'um' },
  },
  dividir: {
    dica: 'No “Dividir e baixar”: uma página por arquivo, a cada N páginas ou só as que você escolher (selecione na lista ou digite).',
    vazio: 'Escolha ou arraste o PDF que quer dividir',
    acao: 'Dividir e baixar',
    baixar: { separar: 'paginas' },
  },
  numerar: {
    dica: 'Ligue os números e a marca d’água ao lado e confira na prévia antes de baixar.',
    vazio: 'Escolha ou arraste o PDF',
    acao: 'Baixar',
    painel: 'paginas',
    projeto: { numeros: { ativo: true, posicao: 'base-centro', formato: '{n} / {total}', inicio: 1, tamanho: 11 } },
  },
}

const POSICOES = ['topo-esquerda', 'topo-centro', 'topo-direita', 'base-esquerda', 'base-centro', 'base-direita']
/** Onde o tracinho aparece no botão de cada posição (classes fixas para o Tailwind achar). */
const ALINHAR = {
  'topo-esquerda': 'items-start justify-start',
  'topo-centro': 'items-start justify-center',
  'topo-direita': 'items-start justify-end',
  'base-esquerda': 'items-end justify-start',
  'base-centro': 'items-end justify-center',
  'base-direita': 'items-end justify-end',
}

let seq = 0
const novaId = (p) => `${p}${Date.now().toString(36)}${(seq += 1)}`

function hexParaRgb(hex) {
  const n = parseInt(String(hex).replace('#', ''), 16)
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]
}

/** Desenha uma página (com o giro extra) num canvas; `escala` 1 = 72 dpi. */
async function desenhar(doc, indice, giro, escala, canvas) {
  const pg = await doc.getPage(indice + 1)
  const v = pg.getViewport({ scale: escala, rotation: (pg.rotate + giro) % 360 })
  canvas.width = Math.max(1, Math.floor(v.width))
  canvas.height = Math.max(1, Math.floor(v.height))
  const ctx = canvas.getContext('2d', { alpha: false })
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  await pg.render({ canvasContext: ctx, canvas, viewport: v }).promise
  pg.cleanup()
}

/** Texto do número da página n (1…total). */
const textoNumero = (numeros, n, total) =>
  String(numeros.formato || '{n}')
    .replaceAll('{n}', String(n + Number(numeros.inicio || 1) - 1))
    .replaceAll('{total}', String(total + Number(numeros.inicio || 1) - 1))

/* ─── Miniatura (lado esquerdo) ─────────────────────────────────────────── */

const cacheMiniaturas = new Map()

function Miniatura({ leitura, pagina }) {
  const [url, setUrl] = useState(null)
  const caixa = useRef(null)
  useEffect(() => {
    if (pagina.branca || !leitura?.doc) return undefined
    const chave = `${pagina.fonte}:${pagina.indice}:${pagina.giro}`
    if (cacheMiniaturas.has(chave)) {
      cacheMiniaturas.get(chave).then((u) => setUrl(u))
      return undefined
    }
    let vivo = true
    const obs = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting) return
        obs.disconnect()
        if (!cacheMiniaturas.has(chave)) {
          const c = document.createElement('canvas')
          const t = leitura.tamanhos[pagina.indice]
          cacheMiniaturas.set(
            chave,
            desenhar(leitura.doc, pagina.indice, pagina.giro, (150 * (devicePixelRatio || 1)) / Math.max(t.w, t.h), c).then(() => c.toDataURL('image/jpeg', 0.75)).catch(() => null),
          )
        }
        cacheMiniaturas.get(chave).then((u) => vivo && setUrl(u))
      },
      { rootMargin: '300px' },
    )
    obs.observe(caixa.current)
    return () => {
      vivo = false
      obs.disconnect()
    }
  }, [leitura, pagina.fonte, pagina.indice, pagina.giro, pagina.branca])

  return (
    <div ref={caixa} className="grid aspect-[3/4] w-full place-items-center overflow-hidden rounded-md border border-borda bg-white">
      {pagina.branca ? <span className="text-[0.625rem] text-neutral-400">em branco</span> : url ? <img src={url} alt="" draggable={false} className="max-h-full max-w-full object-contain" /> : <span className="esqueleto size-full" />}
    </div>
  )
}

/* ─── Página com as anotações (meio) ────────────────────────────────────── */

function Pagina({ leitura, pagina, numero, total, visual, escala, elementos, selecionado, ferramenta, numeros, marca, aoClicar, aoSelecionar, aoMover, registrar }) {
  const canvas = useRef(null)
  const caixa = useRef(null)
  const [visivel, setVisivel] = useState(false)

  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => e.isIntersecting && setVisivel(true), { rootMargin: '800px' })
    obs.observe(caixa.current)
    return () => obs.disconnect()
  }, [])
  useEffect(() => {
    if (!visivel || pagina.branca || !leitura?.doc) return
    desenhar(leitura.doc, pagina.indice, pagina.giro, escala * (devicePixelRatio || 1), canvas.current).catch(() => {})
  }, [visivel, leitura, pagina.indice, pagina.giro, pagina.branca, escala])

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

  const [vert, horiz] = numeros.posicao.split('-')
  return (
    <div
      ref={(el) => {
        caixa.current = el
        registrar(pagina.id, el)
      }}
      data-pagina={numero}
      className={`relative mx-auto shrink-0 overflow-hidden bg-white shadow-[var(--shadow-cartao)] ${ferramenta === 'selecionar' ? '' : 'cursor-crosshair'}`}
      style={{ width: visual.w * escala, height: visual.h * escala }}
      onPointerDown={(e) => {
        if (e.target !== e.currentTarget && e.target !== canvas.current) return
        const r = e.currentTarget.getBoundingClientRect()
        aoClicar(pagina.id, (e.clientX - r.left) / escala, (e.clientY - r.top) / escala)
      }}
    >
      {pagina.branca ? null : <canvas ref={canvas} className="pointer-events-none absolute inset-0 size-full" aria-label={`Página ${numero}`} />}

      {/* Prévia da marca d'água e do número (o PDF final é desenhado igual) */}
      {marca.ativo && marca.texto ? (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-1/2 font-bold whitespace-nowrap"
          style={{ fontFamily: FONTE_UI, fontSize: marca.tamanho * escala, color: marca.cor, opacity: marca.opacidade / 100, transform: `translate(-50%, -50%) rotate(${-marca.angulo}deg)` }}
        >
          {marca.texto}
        </span>
      ) : null}
      {numeros.ativo ? (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute whitespace-nowrap"
          style={{
            fontFamily: FONTE_UI,
            fontSize: numeros.tamanho * escala,
            color: '#26262b',
            [vert === 'topo' ? 'top' : 'bottom']: 28 * escala,
            ...(horiz === 'esquerda' ? { left: 28 * escala } : horiz === 'direita' ? { right: 28 * escala } : { left: '50%', transform: 'translateX(-50%)' }),
          }}
        >
          {textoNumero(numeros, numero, total)}
        </span>
      ) : null}

      {elementos.map((el) => {
        const sel = el.id === selecionado
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
            data-elemento={el.tipo}
            className={`absolute touch-none ${ferramenta === 'selecionar' ? 'cursor-move' : ''} ${sel ? 'outline-2 outline-offset-2 outline-acento' : 'hover:outline-1 hover:outline-dashed hover:outline-acento/60'}`}
            style={{ left: el.x * escala, top: el.y * escala }}
          >
            {conteudo}
            {sel && el.w != null ? <span onPointerDown={arrastar(el, 'redimensionar')} className="absolute -right-2 -bottom-2 size-4 cursor-nwse-resize rounded-sm border-2 border-white bg-acento" aria-label="Redimensionar" /> : null}
          </div>
        )
      })}
    </div>
  )
}

/* ─── Painéis (direita) ─────────────────────────────────────────────────── */

function PainelAnotar({ ferramenta, setFerramenta, sel, atualizar, remover, estilo, setEstilo, assinatura, abrirAssinatura }) {
  return (
    <div className="flex flex-col gap-5">
      <Grupo titulo="Ferramentas">
        <div className="grid grid-cols-2 gap-1.5">
          {FERRAMENTAS.map((f) => (
            <button
              key={f.id}
              type="button"
              aria-pressed={ferramenta === f.id}
              onClick={() => (f.id === 'assinatura' && !assinatura ? (setFerramenta('assinatura'), abrirAssinatura()) : setFerramenta(f.id))}
              className={`flex h-9 items-center gap-2 rounded-lg border px-2.5 text-xs font-semibold transition-colors ${ferramenta === f.id ? 'border-marca bg-marca text-sobre-marca' : 'border-borda text-suave hover:text-tinta'}`}
            >
              <Icone nome={f.icone} tamanho={15} />
              {f.rotulo}
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-fraca">{ferramenta === 'selecionar' ? 'Clique num item para editar; arraste para mover. Delete apaga.' : 'Clique na página onde quer colocar.'}</p>
        {assinatura ? (
          <button type="button" onClick={abrirAssinatura} className="mt-2 text-xs font-semibold text-acento hover:underline">
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
    </div>
  )
}

function PainelPaginas({ numeros, marca, mudar }) {
  const n = (d) => mudar({ numeros: { ...numeros, ...d } })
  const m = (d) => mudar({ marca: { ...marca, ...d } })
  return (
    <div className="flex flex-col gap-6">
      <Grupo titulo="Numerar as páginas">
        <div className="flex flex-col gap-4">
          <Caixa rotulo="Colocar o número em cada página" marcado={numeros.ativo} aoMudar={(v) => n({ ativo: v })} />
          {numeros.ativo ? (
            <>
              <div className="grid grid-cols-3 gap-1.5" role="radiogroup" aria-label="Posição do número">
                {POSICOES.map((p) => (
                  <button
                    key={p}
                    type="button"
                    role="radio"
                    aria-checked={numeros.posicao === p}
                    aria-label={p.replace('-', ' ')}
                    onClick={() => n({ posicao: p })}
                    className={`flex h-9 rounded-md border p-1.5 ${ALINHAR[p]} ${numeros.posicao === p ? 'border-acento bg-acento-suave' : 'border-borda hover:border-borda-forte'}`}
                  >
                    <span className={`h-1.5 w-3 rounded-sm ${numeros.posicao === p ? 'bg-acento' : 'bg-borda-forte'}`} />
                  </button>
                ))}
              </div>
              <Entrada rotulo="Formato" valor={numeros.formato} aoMudar={(v) => n({ formato: v })} dica="{n} é o número; {total}, quantas páginas. Ex.: Página {n} de {total}" />
              <div className="grid grid-cols-2 gap-3">
                <Entrada rotulo="Começar em" type="number" min="0" valor={String(numeros.inicio)} aoMudar={(v) => n({ inicio: Math.max(0, Number(v) || 0) })} />
                <Deslizante rotulo="Tamanho" valor={numeros.tamanho} aoMudar={(v) => n({ tamanho: v })} min={7} max={24} formatar={(v) => `${v} pt`} />
              </div>
            </>
          ) : null}
        </div>
      </Grupo>
      <Grupo titulo="Marca d'água">
        <div className="flex flex-col gap-4">
          <Caixa rotulo="Escrever em todas as páginas" marcado={marca.ativo} aoMudar={(v) => m({ ativo: v })} />
          {marca.ativo ? (
            <>
              <Entrada rotulo="Texto" valor={marca.texto} aoMudar={(v) => m({ texto: v })} />
              <Deslizante rotulo="Transparência" valor={marca.opacidade} aoMudar={(v) => m({ opacidade: v })} min={5} max={80} formatar={(v) => `${v}%`} />
              <Deslizante rotulo="Tamanho" valor={marca.tamanho} aoMudar={(v) => m({ tamanho: v })} min={16} max={140} formatar={(v) => `${v} pt`} />
              <Deslizante rotulo="Inclinação" valor={marca.angulo} aoMudar={(v) => m({ angulo: v })} min={0} max={90} formatar={(v) => `${v}°`} />
              <CorDeFundo valor={marca.cor} aoMudar={(v) => m({ cor: v })} rotulo="Cor" />
            </>
          ) : null}
        </div>
      </Grupo>
    </div>
  )
}

function PainelDocumento({ meta, mudar }) {
  const d = (x) => mudar({ meta: { ...meta, ...x } })
  return (
    <Grupo titulo="Dados do documento">
      <div className="flex flex-col gap-4">
        <Entrada rotulo="Título" valor={meta.titulo} aoMudar={(v) => d({ titulo: v })} placeholder="(vazio)" />
        <Entrada rotulo="Autor" valor={meta.autor} aoMudar={(v) => d({ autor: v })} placeholder="(vazio)" />
        <Entrada rotulo="Assunto" valor={meta.assunto} aoMudar={(v) => d({ assunto: v })} placeholder="(vazio)" />
        <Entrada rotulo="Palavras-chave" valor={meta.palavras} aoMudar={(v) => d({ palavras: v })} placeholder="separadas por vírgula" />
        <p className="text-xs text-fraca">Aparecem nas propriedades do arquivo e ajudam a achar o PDF numa busca. Em branco, o campo sai vazio.</p>
      </div>
    </Grupo>
  )
}

/* ─── Exportar ──────────────────────────────────────────────────────────── */

async function gerarPdfs({ p, selecao, arquivoDa, opcoes, nome }, { progresso, sinal }) {
  // Quais páginas: todas, as selecionadas (na ordem do documento) ou um intervalo digitado (na ordem digitada).
  const lista =
    opcoes.paginas === 'selecionadas'
      ? p.paginas.filter((pg) => selecao.has(pg.id))
      : opcoes.paginas === 'intervalo'
        ? lerIntervalos(opcoes.intervalo, p.paginas.length).map((n) => p.paginas[n - 1])
        : p.paginas
  if (!lista.length) throw new ErroAmigavel('Nenhuma página para baixar.')
  const { PDFDocument, degrees, rgb, BlendMode } = await obterPdfLib()
  const final = await PDFDocument.create()
  const edicao = new Map()
  for (let i = 0; i < lista.length; i += 1) {
    const pg = lista[i]
    if (pg.branca) final.addPage(pg.tamanho).setRotation(degrees(pg.giro))
    else {
      if (!edicao.has(pg.fonte)) edicao.set(pg.fonte, await abrirEdicao(arquivoDa(pg.fonte)))
      const [copia] = await final.copyPages(edicao.get(pg.fonte), [pg.indice])
      copia.setRotation(degrees((copia.getRotation().angle + pg.giro) % 360))
      final.addPage(copia)
    }
    progresso(((i + 1) / lista.length) * 0.3, 'Montando as páginas')
  }

  const fontes = { normal: await fontePadrao(final), negrito: await fontePadrao(final, true) }
  const paginas = final.getPages()
  const total = lista.length
  for (let i = 0; i < paginas.length; i += 1) {
    const pagina = paginas[i]
    const { largura: W, altura: H } = tamanhoVisual(pagina)
    for (const el of p.elementos.filter((e) => e.pagina === lista[i].id)) {
      if (el.tipo === 'texto' || el.tipo === 'nota') {
        const fonte = el.negrito ? fontes.negrito : fontes.normal
        const linhas = textoSeguro(fonte, el.texto).split('\n')
        if (el.tipo === 'nota') {
          const w = Math.max(...linhas.map((l) => fonte.widthOfTextAtSize(l, el.tamanho))) + el.tamanho * 0.8
          const h = linhas.length * el.tamanho * 1.2 + el.tamanho * 0.5
          const q = pontoNaPagina(pagina, el.x, H - el.y - h)
          pagina.drawRectangle({ x: q.x, y: q.y, width: w, height: h, color: rgb(1, 0.953, 0.639), rotate: degrees(q.giro) })
        }
        const recuo = el.tipo === 'nota' ? el.tamanho * 0.4 : 0
        const topo = el.tipo === 'nota' ? el.tamanho * 0.25 : 0
        linhas.forEach((linha, n) => {
          const q = pontoNaPagina(pagina, el.x + recuo, H - el.y - topo - el.tamanho * 1.2 * n - el.tamanho * 0.95)
          pagina.drawText(linha, { x: q.x, y: q.y, size: el.tamanho, font: fonte, color: rgb(...hexParaRgb(el.cor)), rotate: degrees(q.giro) })
        })
      } else if (el.tipo === 'imagem') {
        const png = await final.embedPng(el.url)
        const q = pontoNaPagina(pagina, el.x, H - el.y - el.h)
        pagina.drawImage(png, { x: q.x, y: q.y, width: el.w, height: el.h, rotate: degrees(q.giro) })
      } else if (el.tipo === 'destaque') {
        const q = pontoNaPagina(pagina, el.x, H - el.y - el.h)
        pagina.drawRectangle({ x: q.x, y: q.y, width: el.w, height: el.h, color: rgb(1, 0.9, 0), opacity: 0.4, blendMode: BlendMode.Multiply, rotate: degrees(q.giro) })
      } else {
        const q = pontoNaPagina(pagina, el.x, H - el.y - el.h)
        pagina.drawRectangle({ x: q.x, y: q.y, width: el.w, height: el.h, borderColor: await corPdf(el.cor), borderWidth: el.espessura, rotate: degrees(q.giro) })
      }
    }

    // Marca d'água: centralizada, inclinada, por baixo da transparência escolhida.
    if (p.marca.ativo && p.marca.texto) {
      const fonte = fontes.negrito
      const texto = textoSeguro(fonte, p.marca.texto)
      const w = fonte.widthOfTextAtSize(texto, p.marca.tamanho)
      const a = (p.marca.angulo * Math.PI) / 180
      const alt = p.marca.tamanho * 0.7
      const x0 = W / 2 - (w / 2) * Math.cos(a) + (alt / 2) * Math.sin(a)
      const y0 = H / 2 - (w / 2) * Math.sin(a) - (alt / 2) * Math.cos(a)
      const q = pontoNaPagina(pagina, x0, y0)
      pagina.drawText(texto, { x: q.x, y: q.y, size: p.marca.tamanho, font: fonte, color: rgb(...hexParaRgb(p.marca.cor)), opacity: p.marca.opacidade / 100, rotate: degrees(p.marca.angulo + q.giro) })
    }
    // Número da página.
    if (p.numeros.ativo) {
      const fonte = fontes.normal
      const texto = textoSeguro(fonte, textoNumero(p.numeros, i + 1, total))
      const w = fonte.widthOfTextAtSize(texto, p.numeros.tamanho)
      const [vert, horiz] = p.numeros.posicao.split('-')
      const x = horiz === 'esquerda' ? 28 : horiz === 'direita' ? W - 28 - w : (W - w) / 2
      const y = vert === 'topo' ? H - 28 - p.numeros.tamanho * 0.75 : 28
      const q = pontoNaPagina(pagina, x, y)
      pagina.drawText(texto, { x: q.x, y: q.y, size: p.numeros.tamanho, font: fonte, color: rgb(0.15, 0.15, 0.17), rotate: degrees(q.giro) })
    }
    progresso(0.3 + ((i + 1) / paginas.length) * 0.3, 'Escrevendo nas páginas')
  }

  const m = p.meta
  final.setTitle(m.titulo || '')
  final.setAuthor(m.autor || '')
  final.setSubject(m.assunto || '')
  final.setKeywords(m.palavras ? m.palavras.split(',').map((s) => s.trim()).filter(Boolean) : [])
  final.setProducer('hipotetic')

  // Um PDF, um por página ou a cada N páginas.
  const partes = []
  const tamanhoGrupo = opcoes.separar === 'paginas' ? 1 : opcoes.separar === 'cada' ? Math.max(1, Math.floor(Number(opcoes.cada) || 1)) : 0
  if (tamanhoGrupo && paginas.length > tamanhoGrupo) {
    const grupos = Math.ceil(paginas.length / tamanhoGrupo)
    for (let g = 0; g < grupos; g += 1) {
      const indices = Array.from({ length: Math.min(tamanhoGrupo, paginas.length - g * tamanhoGrupo) }, (_, k) => g * tamanhoGrupo + k)
      const um = await PDFDocument.create()
      for (const c of await um.copyPages(final, indices)) um.addPage(c)
      um.setTitle(m.titulo || '')
      um.setAuthor(m.autor || '')
      const sufixo = tamanhoGrupo === 1 ? String(g + 1).padStart(String(grupos).length, '0') : `parte-${g + 1}`
      partes.push({ nome: `${nome}-${sufixo}.pdf`, bytes: await um.save({ useObjectStreams: true }), paginas: indices.length })
    }
  } else {
    partes.push({ nome: `${nome}.pdf`, bytes: new Uint8Array(await (await salvarPdf(final)).arrayBuffer()), paginas: paginas.length })
  }

  const saida = []
  for (let i = 0; i < partes.length; i += 1) {
    let { bytes } = partes[i]
    const detalhes = [`${partes[i].paginas} ${partes[i].paginas === 1 ? 'página' : 'páginas'}`]
    if (opcoes.compressao !== 'nao') {
      const r = await otimizarPdf(bytes, opcoes.compressao, { progresso: (v, rot) => progresso(0.6 + ((i + (v ?? 0)) / partes.length) * 0.3, rot ?? 'Reduzindo o tamanho'), sinal })
      if (r.menor) bytes = r.bytes
    }
    if (opcoes.senha) {
      progresso(0.92, 'Protegendo com senha')
      const r = await protegerPdf(bytes, opcoes.senha, { imprimir: true, copiar: true })
      if (!r.bytes) throw new ErroAmigavel('Não foi possível proteger o PDF com senha.', r.texto)
      bytes = r.bytes
      detalhes.push('com senha')
    }
    saida.push({ nome: partes[i].nome, blob: new Blob([bytes], { type: 'application/pdf' }), detalhe: detalhes.join(' · ') })
  }
  return saida
}

/* ─── Editor ────────────────────────────────────────────────────────────── */

export default function EditorPdf({ modo }) {
  const m = MODOS[modo] ?? null
  // Modo foco: só o essencial da tarefa; "Editor completo" libera o resto (fica salvo).
  const [completo, setCompleto] = useSalvo('completo', false)
  const foco = Boolean(m) && !completo
  const [p, setP] = useSalvo('projeto', m?.projeto ? { ...VAZIO, ...m.projeto } : VAZIO)
  const mudar = (d) => setP((x) => ({ ...x, ...(typeof d === 'function' ? d(x) : d) }))
  const vazio = p.fontes.length === 0 && p.paginas.length === 0
  useEmEdicao(!vazio)
  const historico = useHistorico(p, setP, true)
  const tarefa = useTarefaSalva()

  const [leituras, setLeituras] = useState({}) // id da fonte → { doc, tamanhos } | { erro }
  const abertos = useRef({})
  const [selecao, setSelecao] = useState(() => new Set())
  const [selecionado, setSelecionado] = useState(null)
  const [ferramenta, setFerramenta] = useState('selecionar')
  const [aba, setAba] = useState('anotar')
  const [estilo, setEstilo] = useState({ tamanho: 14, cor: '#0b0b0d', negrito: false })
  const [assinatura, setAssinatura] = useSalvo('assinatura', null) // { url, w, h }
  const [dialogo, setDialogo] = useState(null)
  const [baixando, setBaixando] = useState(null)
  const [arrastando, setArrastando] = useState(null)
  const [soltando, setSoltando] = useState(false)
  const [erro, setErro] = useState(null)
  const [largura, setLargura] = useState(800)
  const area = useRef(null)
  const paginasEl = useRef({})
  const entradaPdf = useRef(null)
  const entradaImagem = useRef(null)
  const pendente = useRef(null)

  // Abre (pdf.js) cada PDF do projeto — também os recuperados do salvo.
  const abrir = useCallback((fonte) => {
    if (abertos.current[fonte.id]) return abertos.current[fonte.id]
    abertos.current[fonte.id] = abrirLeitura(fonte.arquivo).then(async (doc) => {
      const tamanhos = []
      for (let n = 1; n <= doc.numPages; n += 1) {
        const v = (await doc.getPage(n)).getViewport({ scale: 1 })
        tamanhos.push({ w: v.width, h: v.height })
      }
      const leitura = { doc, tamanhos }
      setLeituras((l) => ({ ...l, [fonte.id]: leitura }))
      return leitura
    })
    abertos.current[fonte.id].catch((e) => setLeituras((l) => ({ ...l, [fonte.id]: { erro: e?.mensagem ?? 'Não foi possível abrir este PDF.' } })))
    return abertos.current[fonte.id]
  }, [])
  useEffect(() => {
    p.fontes.forEach((f) => abrir(f).catch(() => {}))
  }, [p.fontes, abrir])
  useEffect(() => () => Object.values(abertos.current).forEach((x) => x.then((l) => l.doc.destroy()).catch(() => {})), [])

  useEffect(() => {
    if (!area.current) return undefined
    const obs = new ResizeObserver(([e]) => setLargura(e.contentRect.width))
    obs.observe(area.current)
    return () => obs.disconnect()
  }, [vazio])

  const adicionarArquivos = async (lista) => {
    const pdfs = [...(lista ?? [])].filter((a) => /\.pdf$/i.test(a.name) || a.type === 'application/pdf')
    if (!pdfs.length) return
    if (pdfs.some((a) => a.size > LIMITE_PDF)) return setErro('Algum PDF passa do limite de 300 MB.')
    setErro(null)
    for (const arquivo of pdfs) {
      const fonte = { id: novaId('f'), arquivo }
      try {
        const leitura = await abrir(fonte)
        const novas = leitura.tamanhos.map((_, indice) => ({ id: novaId('p'), fonte: fonte.id, indice, giro: 0 }))
        mudar((x) => ({ fontes: [...x.fontes, fonte], paginas: [...x.paginas, ...novas], nome: x.nome ?? `${semExtensao(arquivo.name)}-editado` }))
      } catch (e) {
        setErro(e?.mensagem ?? `Não foi possível abrir ${arquivo.name}.`)
      }
    }
  }

  // Tamanho da página como aparece (com o giro).
  const visualDe = (pg) => {
    let w
    let h
    if (pg.branca) [w, h] = pg.tamanho
    else {
      const t = leituras[pg.fonte]?.tamanhos?.[pg.indice]
      if (!t) return null
      ;({ w, h } = t)
    }
    return pg.giro % 180 ? { w: h, h: w } : { w, h }
  }

  /* páginas */
  const alternarSelecao = (id, multipla) =>
    setSelecao((s) => {
      const n = new Set(multipla ? s : [])
      if (multipla && s.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  const girar = (ids, delta) =>
    mudar((x) => ({
      paginas: x.paginas.map((pg) => (ids.has(pg.id) ? { ...pg, giro: (pg.giro + delta + 360) % 360 } : pg)),
      // As anotações giram junto com a página (posição).
      elementos: x.elementos.map((el) => {
        const pg = x.paginas.find((q) => q.id === el.pagina)
        if (!pg || !ids.has(pg.id)) return el
        const v = visualDe(pg)
        if (!v) return el
        const h = el.h ?? el.tamanho * 1.2
        return delta === 90 ? { ...el, x: Math.max(0, v.h - el.y - h), y: el.x } : { ...el, x: el.y, y: Math.max(0, v.w - el.x - (el.w ?? 40)) }
      }),
    }))
  const excluir = (ids) => {
    mudar((x) => ({ paginas: x.paginas.filter((pg) => !ids.has(pg.id)), elementos: x.elementos.filter((el) => !ids.has(el.pagina)) }))
    setSelecao(new Set())
  }
  const duplicar = (id) =>
    mudar((x) => {
      const novas = []
      const elementos = [...x.elementos]
      for (const pg of x.paginas) {
        novas.push(pg)
        if (pg.id === id) {
          const copia = { ...pg, id: novaId('p') }
          novas.push(copia)
          x.elementos.filter((el) => el.pagina === id).forEach((el) => elementos.push({ ...el, id: novaId('e'), pagina: copia.id }))
        }
      }
      return { paginas: novas, elementos }
    })
  const moverPagina = (de, para) =>
    mudar((x) => {
      if (para < 0 || para >= x.paginas.length || de === para) return {}
      const c = [...x.paginas]
      const [pg] = c.splice(de, 1)
      c.splice(para, 0, pg)
      return { paginas: c }
    })
  const paginaEmBranco = () =>
    mudar((x) => {
      const ultimaSel = [...x.paginas].reverse().find((pg) => selecao.has(pg.id))
      const pos = ultimaSel ? x.paginas.indexOf(ultimaSel) + 1 : x.paginas.length
      const ref = x.paginas[Math.max(0, pos - 1)]
      const v = ref ? visualDe({ ...ref, giro: 0 }) : null
      const c = [...x.paginas]
      c.splice(pos, 0, { id: novaId('p'), branca: true, tamanho: v ? [v.w, v.h] : A4, giro: 0 })
      return { paginas: c, nome: x.nome ?? 'documento' }
    })
  const irPara = (id) => paginasEl.current[id]?.scrollIntoView({ behavior: 'smooth', block: 'start' })

  /* anotações */
  const sel = p.elementos.find((e) => e.id === selecionado)
  const atualizar = useCallback((id, d) => setP((x) => ({ ...x, elementos: x.elementos.map((e) => (e.id === id ? { ...e, ...d } : e)) })), [setP])
  const remover = (id) => {
    mudar((x) => ({ elementos: x.elementos.filter((e) => e.id !== id) }))
    setSelecionado(null)
  }
  const inserirImagem = (pagina, x, y, url, w0, h0, larguraMax = 200) => {
    const w = Math.min(larguraMax, w0)
    const h = (w * h0) / w0
    const el = { id: novaId('e'), tipo: 'imagem', pagina, x: x - w / 2, y: y - h / 2, w, h, proporcao: w / h, url }
    mudar((q) => ({ elementos: [...q.elementos, el] }))
    setSelecionado(el.id)
    setFerramenta('selecionar')
  }
  const aoClicar = (pagina, x, y) => {
    if (foco) return setSelecionado(null)
    if (ferramenta === 'selecionar') return setSelecionado(null)
    if (ferramenta === 'assinatura') {
      if (assinatura) return inserirImagem(pagina, x, y, assinatura.url, assinatura.w, assinatura.h, 160)
      pendente.current = { pagina, x, y }
      return setDialogo('assinatura')
    }
    if (ferramenta === 'imagem') {
      pendente.current = { pagina, x, y }
      return entradaImagem.current?.click()
    }
    const id = novaId('e')
    let el
    if (ferramenta === 'texto' || ferramenta === 'nota') el = { id, tipo: ferramenta, pagina, x, y: y - estilo.tamanho * 0.6, texto: ferramenta === 'nota' ? 'Nota' : 'Texto', ...estilo, cor: ferramenta === 'nota' ? '#3d3200' : estilo.cor }
    else if (ferramenta === 'destaque') el = { id, tipo: 'destaque', pagina, x: x - 60, y: y - 8, w: 120, h: 16 }
    else el = { id, tipo: 'retangulo', pagina, x: x - 60, y: y - 30, w: 120, h: 60, cor: '#c8242b', espessura: 2 }
    mudar((q) => ({ elementos: [...q.elementos, el] }))
    setSelecionado(id)
    setFerramenta('selecionar')
  }

  // Atalhos: Ctrl+Z / Ctrl+Shift+Z; Delete apaga o item; Esc tira a seleção.
  const teclas = useRef(null)
  teclas.current = (e) => {
    if (document.querySelector('dialog[open]')) return
    if ((e.ctrlKey || e.metaKey) && !e.altKey) {
      if (e.target.closest?.('input:not([type=range]):not([type=checkbox]), textarea, [contenteditable]')) return
      const k = e.key.toLowerCase()
      if (k === 'z' && !e.shiftKey) {
        e.preventDefault()
        historico.desfazer()
      } else if ((k === 'z' && e.shiftKey) || k === 'y') {
        e.preventDefault()
        historico.refazer()
      }
      return
    }
    if (e.target.closest?.('input, textarea, select, [contenteditable]')) return
    if (selecionado && (e.key === 'Delete' || e.key === 'Backspace')) remover(selecionado)
    else if (e.key === 'Escape') {
      setSelecionado(null)
      setSelecao(new Set())
    }
  }
  useEffect(() => {
    const f = (e) => teclas.current(e)
    addEventListener('keydown', f)
    return () => removeEventListener('keydown', f)
  }, [])

  const recomecar = () => {
    setP(VAZIO)
    historico.reiniciar()
    setSelecao(new Set())
    setSelecionado(null)
    tarefa.reiniciar()
  }

  const baixar = (s) => {
    const arquivoDa = (id) => p.fontes.find((f) => f.id === id).arquivo
    mudar({ nome: s.nome })
    tarefa.executar((ctx) => gerarPdfs({ p, selecao, arquivoDa, opcoes: s, nome: s.nome }, ctx), 'Montando o PDF')
  }

  const nomeAtual = p.nome ?? 'documento-editado'
  if (tarefa.fase === 'pronto') return <Resultados itens={tarefa.resultado} duracao={tarefa.duracao} nomeZip={`${nomeAtual}.zip`} aoAjustar={tarefa.reiniciar} aoReiniciar={recomecar} rotuloNovo="Outro PDF" />

  const processando = tarefa.fase === 'processando'
  const maxLargura = Math.max(...p.paginas.map((pg) => visualDe(pg)?.w ?? 0), 1)
  const escala = Math.min(1.5, Math.max(0.3, (largura - 32) / maxLargura))
  const nSel = selecao.size
  const total = p.paginas.length

  return (
    <div className="flex flex-col gap-3 lg:h-[calc(100dvh-5.5rem)] lg:min-h-[34rem]">
      {/* Barra do topo */}
      <section aria-label="Documento" className="cartao flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 sm:px-5">
        <SeloCategoria categoria="pdf" icone="pdf" tamanho="p" />
        <div className="min-w-0 flex-1 basis-40">
          {vazio ? <p className="text-sm font-semibold text-tinta">Nenhum PDF aberto</p> : <NomeEditavel key={nomeAtual} nome={nomeAtual} extensao="pdf" aoMudar={(n) => mudar({ nome: n })} desativado={processando} rotulo="Renomear o PDF final" />}
          <p className="text-xs text-fraca tabular-nums">{vazio ? 'Escolha um ou mais PDFs para começar' : `${total} ${total === 1 ? 'página' : 'páginas'}${p.fontes.length > 1 ? ` de ${p.fontes.length} PDFs` : ''}`}</p>
        </div>
        {foco ? (
          <Botao variante="fantasma" tamanho="p" icone="ampliar" onClick={() => setCompleto(true)} title="Mostrar todas as ferramentas do editor de PDF">
            Editor completo
          </Botao>
        ) : null}
        <input
          ref={entradaPdf}
          type="file"
          multiple
          accept=".pdf,application/pdf"
          className="sr-only"
          tabIndex={-1}
          aria-label="Escolher PDFs"
          onChange={(e) => {
            adicionarArquivos(e.target.files)
            e.target.value = ''
          }}
        />
        <Botao variante="secundario" tamanho="p" icone="arquivoMais" onClick={() => entradaPdf.current?.click()} disabled={processando}>
          {vazio ? 'Escolher PDF' : modo === 'unir' ? 'Adicionar PDF' : 'Juntar outro PDF'}
        </Botao>
        {foco ? null : (
          <Botao variante="secundario" tamanho="p" icone="mais" onClick={paginaEmBranco} disabled={processando}>
            Página em branco
          </Botao>
        )}
        <div className="flex items-center gap-0.5">
          <BotaoAcao rotulo="Desfazer (Ctrl+Z)" icone="desfazer" onClick={historico.desfazer} disabled={!historico.podeDesfazer || processando} />
          <BotaoAcao rotulo="Refazer (Ctrl+Shift+Z)" icone="refazerAcao" onClick={historico.refazer} disabled={!historico.podeRefazer || processando} />
          <Botao variante="fantasma" tamanho="p" icone="refazer" onClick={recomecar} disabled={processando || vazio}>
            Recomeçar
          </Botao>
        </div>
        {processando ? (
          <div className="w-60">
            <Progresso valor={tarefa.progresso} rotulo={tarefa.rotulo} aoCancelar={tarefa.cancelar} />
          </div>
        ) : (
          <Botao icone="baixar" onClick={() => setBaixando({ paginas: 'todas', intervalo: '', separar: 'um', cada: 2, compressao: 'nao', senha: '', ...m?.baixar })} disabled={!total}>
            {foco ? m.acao : 'Baixar'}
          </Botao>
        )}
      </section>

      {foco ? <p className="-mt-1 px-1 text-sm text-suave">{m.dica}</p> : null}

      {erro ? (
        <Aviso tom="erro" aoFechar={() => setErro(null)}>
          {erro}
        </Aviso>
      ) : null}
      {tarefa.fase === 'erro' ? <Aviso tom="erro">{tarefa.mensagem}</Aviso> : null}

      <div className={`grid min-h-0 flex-1 gap-3 ${foco && !m.painel ? 'lg:grid-cols-[12.5rem_minmax(0,1fr)]' : 'lg:grid-cols-[12.5rem_minmax(0,1fr)_19rem]'} ${processando ? 'pointer-events-none opacity-60' : ''}`}>
        {/* Páginas */}
        <section aria-label="Páginas" className="cartao flex min-h-0 flex-col overflow-hidden max-lg:max-h-[22rem]">
          <div className="flex min-h-11 flex-wrap items-center gap-1 border-b border-borda px-2.5 py-1.5">
            {nSel ? (
              <>
                <span className="mr-auto text-xs font-semibold text-tinta">{nSel} {nSel === 1 ? 'selecionada' : 'selecionadas'}</span>
                <BotaoAcao rotulo="Girar as selecionadas" icone="girar" onClick={() => girar(selecao, 90)} />
                <BotaoAcao rotulo="Excluir as selecionadas" icone="apagar" onClick={() => excluir(selecao)} />
                <BotaoAcao rotulo="Tirar a seleção" icone="fechar" onClick={() => setSelecao(new Set())} />
              </>
            ) : (
              <p className="text-xs text-fraca">Arraste para reordenar · Ctrl+clique seleciona várias</p>
            )}
          </div>
          <ol className="rolagem-fina grid flex-1 grid-cols-3 content-start gap-2 overflow-y-auto p-2.5 lg:grid-cols-1" aria-label="Ordem das páginas">
            {p.paginas.map((pg, i) => {
              const marcada = selecao.has(pg.id)
              return (
                <li
                  key={pg.id}
                  draggable
                  onDragStart={(e) => {
                    setArrastando(i)
                    e.dataTransfer.effectAllowed = 'move'
                  }}
                  onDragOver={(e) => {
                    e.preventDefault()
                    if (arrastando != null && arrastando !== i) {
                      moverPagina(arrastando, i)
                      setArrastando(i)
                    }
                  }}
                  onDragEnd={() => setArrastando(null)}
                  className={`group relative flex cursor-grab flex-col gap-1 rounded-xl border-2 p-1.5 transition-[border-color,opacity] active:cursor-grabbing ${marcada ? 'border-acento bg-acento-suave' : 'border-transparent hover:border-borda-forte'} ${arrastando === i ? 'opacity-40' : ''}`}
                >
                  <button
                    type="button"
                    onClick={(e) => {
                      alternarSelecao(pg.id, e.ctrlKey || e.metaKey || e.shiftKey)
                      irPara(pg.id)
                    }}
                    aria-pressed={marcada}
                    aria-label={`Página ${i + 1}`}
                    className="block w-full"
                  >
                    <Miniatura leitura={leituras[pg.fonte]} pagina={pg} />
                  </button>
                  <div className="flex items-center justify-between gap-1">
                    <span className="pl-1 text-xs font-semibold text-suave tabular-nums">{i + 1}</span>
                    <div className="flex">
                      {[
                        ['girar', 'Girar', () => girar(new Set([pg.id]), 90)],
                        ['copiar', 'Duplicar', () => duplicar(pg.id)],
                        ['apagar', 'Excluir', () => excluir(new Set([pg.id]))],
                      ].map(([icone, rotulo, acao]) => (
                        <button key={rotulo} type="button" onClick={acao} aria-label={`${rotulo} a página ${i + 1}`} title={rotulo} className="grid size-6 place-items-center rounded-md text-fraca hover:bg-superficie-2 hover:text-tinta">
                          <Icone nome={icone} tamanho={13} />
                        </button>
                      ))}
                    </div>
                  </div>
                </li>
              )
            })}
          </ol>
        </section>

        {/* Páginas em tamanho de leitura, com as anotações */}
        <section
          aria-label="Páginas do PDF"
          ref={area}
          onDragOver={(e) => {
            if (![...(e.dataTransfer?.types ?? [])].includes('Files')) return
            e.preventDefault()
            setSoltando(true)
          }}
          onDragLeave={(e) => !e.currentTarget.contains(e.relatedTarget) && setSoltando(false)}
          onDrop={(e) => {
            if (!e.dataTransfer.files?.length) return
            e.preventDefault()
            setSoltando(false)
            adicionarArquivos(e.dataTransfer.files)
          }}
          className={`rolagem-fina relative flex min-h-[24rem] flex-col items-center gap-5 overflow-auto rounded-[var(--radius-cartao)] bg-superficie-2 p-4 ${soltando ? 'outline-2 outline-dashed outline-acento' : ''}`}
        >
          {vazio ? (
            <div className="m-auto flex w-full flex-col items-center gap-8 py-6">
              <button type="button" onClick={() => entradaPdf.current?.click()} className="flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-borda-forte px-10 py-12 text-center hover:border-fraca">
                <SeloCategoria categoria="pdf" icone="pdf" tamanho="gg" />
                <span className="font-display text-lg font-bold text-tinta">{foco ? m.vazio : 'Escolha ou arraste PDFs aqui'}</span>
                <span className="max-w-xs text-sm text-suave">{foco ? 'Nada sai do seu aparelho.' : 'Organize, junte, anote, assine, numere e baixe — tudo nesta tela. Nada sai do seu aparelho.'}</span>
              </button>
              {m ? null : <AtalhosDoEditor categoria="pdf" />}
            </div>
          ) : null}
          {p.paginas.map((pg, i) => {
            const visual = visualDe(pg)
            if (!visual) return <div key={pg.id} className="esqueleto aspect-[3/4] w-full max-w-xl shrink-0 rounded" />
            return (
              <Pagina
                key={pg.id}
                leitura={leituras[pg.fonte]}
                pagina={pg}
                numero={i + 1}
                total={total}
                visual={visual}
                escala={escala}
                elementos={p.elementos.filter((e) => e.pagina === pg.id)}
                selecionado={selecionado}
                ferramenta={ferramenta}
                numeros={p.numeros}
                marca={p.marca}
                aoClicar={aoClicar}
                aoSelecionar={setSelecionado}
                aoMover={atualizar}
                registrar={(id, el) => (el ? (paginasEl.current[id] = el) : delete paginasEl.current[id])}
              />
            )
          })}
        </section>

        {/* Painel (no foco: só o do modo, ou nenhum) */}
        {foco && m.painel === 'paginas' ? (
          <aside className="cartao rolagem-fina min-h-0 overflow-y-auto p-4">
            <PainelPaginas numeros={p.numeros} marca={p.marca} mudar={mudar} />
          </aside>
        ) : foco ? null : (
        <aside className="cartao flex min-h-0 flex-col overflow-hidden">
          <div role="tablist" aria-label="Painel" className="grid grid-cols-3 border-b border-borda">
            {ABAS.map((a) => (
              <button
                key={a.id}
                type="button"
                role="tab"
                aria-selected={aba === a.id}
                onClick={() => setAba(a.id)}
                className={`flex flex-col items-center gap-1 px-1 py-2.5 text-[0.6875rem] font-semibold transition-colors ${aba === a.id ? 'bg-superficie-2 text-tinta shadow-[inset_0_-2px_0_var(--color-acento)]' : 'text-suave hover:text-tinta'}`}
              >
                <Icone nome={a.icone} tamanho={17} />
                {a.rotulo}
              </button>
            ))}
          </div>
          <div className="rolagem-fina flex-1 overflow-y-auto p-4">
            {aba === 'anotar' ? (
              <PainelAnotar ferramenta={ferramenta} setFerramenta={setFerramenta} sel={sel} atualizar={atualizar} remover={remover} estilo={estilo} setEstilo={setEstilo} assinatura={assinatura} abrirAssinatura={() => setDialogo('assinatura')} />
            ) : aba === 'paginas' ? (
              <PainelPaginas numeros={p.numeros} marca={p.marca} mudar={mudar} />
            ) : (
              <PainelDocumento meta={p.meta} mudar={mudar} />
            )}
          </div>
        </aside>
        )}
      </div>

      <input
        ref={entradaImagem}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="sr-only"
        tabIndex={-1}
        aria-label="Escolher imagem"
        onChange={async (e) => {
          const a = e.target.files?.[0]
          e.target.value = ''
          if (!a || !pendente.current) return
          const bmp = await createImageBitmap(a, { imageOrientation: 'from-image' })
          // Até 1600 px: imagem leve no projeto salvo e no PDF.
          const k = Math.min(1, 1600 / Math.max(bmp.width, bmp.height))
          const c = document.createElement('canvas')
          c.width = Math.round(bmp.width * k)
          c.height = Math.round(bmp.height * k)
          c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height)
          const { pagina, x, y } = pendente.current
          pendente.current = null
          inserirImagem(pagina, x, y, c.toDataURL('image/png'), c.width, c.height)
        }}
      />
      <DialogoAssinatura
        aberto={dialogo === 'assinatura'}
        aoFechar={() => setDialogo(null)}
        aoConfirmar={(canvas) => {
          const a = { url: canvas.toDataURL('image/png'), w: canvas.width, h: canvas.height }
          setAssinatura(a)
          setDialogo(null)
          setFerramenta('assinatura')
          if (pendente.current) {
            const { pagina, x, y } = pendente.current
            pendente.current = null
            inserirImagem(pagina, x, y, a.url, a.w, a.h, 160)
          }
        }}
      />

      {/* Hora de baixar */}
      <DialogoBaixar
        aberto={Boolean(baixando)}
        aoFechar={() => setBaixando(null)}
        titulo="Baixar o PDF"
        nome={nomeAtual}
        extensao={baixando?.separar === 'paginas' ? 'zip' : 'pdf'}
        rotuloConfirmar="Baixar"
        resumo={baixando ? `${baixando.paginas === 'intervalo' ? 'Páginas digitadas' : `${baixando.paginas === 'selecionadas' ? nSel : total} ${(baixando.paginas === 'selecionadas' ? nSel : total) === 1 ? 'página' : 'páginas'}`}${baixando.senha ? ' · com senha' : ''}` : null}
        aoConfirmar={(nome) => {
          if (baixando.senha && baixando.senha.length < 4) return // a dica no campo explica
          if (baixando.paginas === 'intervalo' && !baixando.intervalo.trim()) return
          const s = { ...baixando, nome }
          setBaixando(null)
          baixar(s)
        }}
      >
        {baixando ? (
          <>
            <OpcoesCartoes
              rotulo="Quais páginas"
              valor={baixando.paginas}
              aoMudar={(v) => setBaixando((b) => ({ ...b, paginas: v }))}
              colunas="grid-cols-1 sm:grid-cols-3"
              opcoes={[
                { valor: 'todas', rotulo: `Todas (${total})`, dica: 'O documento inteiro' },
                { valor: 'selecionadas', rotulo: `Selecionadas (${nSel})`, dica: nSel ? 'As marcadas na lista' : 'Marque na lista à esquerda', desativado: !nSel },
                { valor: 'intervalo', rotulo: 'Digitar', dica: 'Ex.: 1-3, 5, 8-' },
              ]}
            />
            {baixando.paginas === 'intervalo' ? (
              <Entrada
                rotulo="Páginas"
                valor={baixando.intervalo}
                aoMudar={(v) => setBaixando((b) => ({ ...b, intervalo: v }))}
                placeholder="1-3, 5, 8-"
                dica="Na ordem que você digitar. “8-” vai da 8 até o fim."
                className="-mt-3"
              />
            ) : null}
            <OpcoesCartoes
              rotulo="Como salvar"
              valor={baixando.separar}
              aoMudar={(v) => setBaixando((b) => ({ ...b, separar: v }))}
              colunas="grid-cols-1 sm:grid-cols-3"
              opcoes={[
                { valor: 'um', rotulo: 'Um PDF', dica: 'Tudo num arquivo só' },
                { valor: 'paginas', rotulo: 'Um PDF por página', dica: 'Vários arquivos' },
                { valor: 'cada', rotulo: 'A cada N páginas', dica: 'Partes do mesmo tamanho' },
              ]}
            />
            {baixando.separar === 'cada' ? (
              <Entrada rotulo="Páginas em cada parte" type="number" min="1" valor={String(baixando.cada)} aoMudar={(v) => setBaixando((b) => ({ ...b, cada: v }))} className="-mt-3 max-w-48" />
            ) : null}
            <OpcoesCartoes
              rotulo="Reduzir o tamanho"
              valor={baixando.compressao}
              aoMudar={(v) => setBaixando((b) => ({ ...b, compressao: v }))}
              colunas="grid-cols-2 sm:grid-cols-3"
              opcoes={[
                { valor: 'nao', rotulo: 'Não', dica: 'Como está' },
                { valor: 'sem-perdas', rotulo: 'Sem perdas', dica: 'Só a estrutura' },
                { valor: 'leve', rotulo: 'Leve', dica: 'Fotos quase iguais' },
                { valor: 'recomendado', rotulo: 'Recomendada', dica: 'Para e-mail' },
                { valor: 'forte', rotulo: 'Forte', dica: 'O menor possível' },
              ]}
            />
            {baixando.compressao !== 'nao' ? <p className="-mt-3 text-xs text-fraca">{DICAS_COMPRESSAO[baixando.compressao]}</p> : null}
            <Entrada
              rotulo="Senha para abrir (opcional)"
              type="password"
              autoComplete="new-password"
              valor={baixando.senha}
              aoMudar={(v) => setBaixando((b) => ({ ...b, senha: v }))}
              dica={baixando.senha && baixando.senha.length < 4 ? 'Use pelo menos 4 caracteres.' : 'Criptografia AES-256. Guarde a senha: sem ela não há como abrir.'}
            />
          </>
        ) : null}
      </DialogoBaixar>
    </div>
  )
}
