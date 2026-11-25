import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { BotaoAcao, useHistorico } from '../../componentes/editor/Comum'
import { DialogoBaixar, NomeEditavel, OpcoesCartoes } from '../../componentes/ferramenta/Baixar'
import { Icone } from '../../componentes/Icone'
import { Aviso, Botao, Caixa, Deslizante, Entrada, Progresso, SeloCategoria, Seletor } from '../../componentes/ui'
import { DESCRICAO_IMAGEM, EXTENSOES_IMAGEM, LIMITE_IMAGEM, ehSvg, rasterizarSvg } from '../../motores/imagem'
import { NEUTRO, ehNeutro, renderizarAjustes } from '../../motores/imagem/ajustes'
import { PADRAO_FUNDO, comporFundo, corNoPonto, desenharTraco, mascaraCheia, mascaraRetocada, mostrarRemovido, refinarMascara } from '../../motores/imagem/fundo'
import { apagarObjeto, mascaraDoFundo, prepararModelo, prepararSelecao, selecionarObjeto } from '../../motores/imagem/ia'
import { codificar } from '../../motores/imagem/nucleo'
import { baixarBlob, extensaoDe, formatarBytes, semExtensao } from '../../nucleo/arquivos'
import { useEmEdicao } from '../../nucleo/edicao'
import { useSalvo } from '../../nucleo/salvo'
import { useTarefa } from '../../nucleo/tarefa'
import { CorDeFundo } from './_comum'
import { PainelCamadas } from './_editor/Camadas'
import {
  GEOMETRIA,
  alturaCamada,
  bitmapDe,
  caixaGirada,
  canvasDesenho,
  maiorDentroGirado,
  migrar,
  novaCamadaDesenho,
  novaCamadaImagem,
  novaCamadaTexto,
  novaId,
  renderizarDocumento,
  transformarBase,
  transformarCamada,
  transformarDesenho,
} from './_editor/documento'
import { BotaoSegmentar, BotaoSegmentarCamada, Escolhas, Grupo, PainelAjustes, PainelCamada, PainelFiltros, PainelFundo, PainelPincel, ajustesDoFiltro } from './_editor/paineis'
import { caixaDosCantos, cantosDaCaixa, cantosPx } from './_editor/perspectiva'
import { PADRAO_PINCEL, iniciarTraco, tamanhoDoCursor } from './_editor/pinceis'
import { Tela, ZOOM_MINIMO, zoomMaximo } from './_editor/Tela'

/*
 * Editor de imagem (no jeito do Photopea, uma imagem por vez):
 *   - Filtros e ajustes (o "Personalizado" abre os ajustes);
 *   - Recortar; Tamanho e girar (90°, espelhar, endireitar com linha + grade);
 *   - Remover fundo (automático, varinha, pincéis, chroma key, novo fundo) e
 *     Apagar objeto (seleção inteligente: a IA completa o objeto pintado);
 *   - Pincéis (camada de desenho própria), Texto e camadas de imagem — as
 *     mesmas camadas do editor de vídeo, com distorção/perspectiva.
 *
 * Não há botão "Aplicar": o que se faz já vale (na tela, nas outras
 * ferramentas e no arquivo baixado) e o Ctrl+Z desfaz. Recorte e endireitar
 * mostram a prévia e valem ao sair da ferramenta (ou Enter, ou Baixar).
 * A imagem-base nunca é reamostrada duas vezes: girar, espelhar, recortar e
 * mudar o tamanho se acumulam numa transformação só (`geo`).
 *
 * As camadas ficam sempre à mão (painel embaixo, à direita) e dá para
 * selecionar, arrastar e editar qualquer uma em qualquer ferramenta.
 */

const FERRAMENTAS = [
  { id: 'filtros', rotulo: 'Filtros', icone: 'paleta', base: true, dica: 'Filtros e ajustes de cor e luz' },
  { id: 'recortar', rotulo: 'Recortar', icone: 'recortar', base: true },
  { id: 'tamanho', rotulo: 'Tamanho e girar', icone: 'regua', base: true, dica: 'Tamanho, girar, espelhar e endireitar' },
  { id: 'fundo', rotulo: 'Remover fundo', icone: 'borracha', base: true },
  { id: 'apagar', rotulo: 'Apagar objeto', icone: 'magica', base: true },
  { id: 'pincel', rotulo: 'Pincel', icone: 'caneta' },
  { id: 'texto', rotulo: 'Texto', icone: 'tipo' },
]
const NOME_FERRAMENTA = Object.fromEntries(FERRAMENTAS.map((f) => [f.id, f.rotulo]))
const PROPORCOES = [
  { id: 'livre', rotulo: 'Livre', valor: null },
  { id: '1:1', rotulo: '1:1', valor: 1 },
  { id: '4:5', rotulo: '4:5', valor: 4 / 5 },
  { id: '4:3', rotulo: '4:3', valor: 4 / 3 },
  { id: '3:2', rotulo: '3:2', valor: 3 / 2 },
  { id: '16:9', rotulo: '16:9', valor: 16 / 9 },
  { id: '9:16', rotulo: '9:16', valor: 9 / 16 },
]
export const REDES = [
  { id: 'ig-quadrado', nome: 'Instagram · post quadrado', w: 1080, h: 1080 },
  { id: 'ig-retrato', nome: 'Instagram · post retrato', w: 1080, h: 1350 },
  { id: 'ig-story', nome: 'Stories, Reels e TikTok', w: 1080, h: 1920 },
  { id: 'yt-miniatura', nome: 'YouTube · miniatura', w: 1280, h: 720 },
  { id: 'fb-post', nome: 'Facebook · post', w: 1200, h: 630 },
  { id: 'x-post', nome: 'X · post', w: 1600, h: 900 },
  { id: 'li-post', nome: 'LinkedIn · post', w: 1200, h: 627 },
  { id: 'perfil', nome: 'Foto de perfil', w: 800, h: 800 },
  { id: 'fullhd', nome: 'Full HD', w: 1920, h: 1080 },
]
const ZOOMS = [0.25, 0.5, 1, 2, 4, 8, 16, 32]
const PREVIA_MAX = 1800 // lado maior da prévia (px)
const ALTA_MAX = 8192 // lado maior da prévia de alta resolução (zoom alto)
const LADO_MASCARA = 2048 // resolução máxima da máscara do fundo guardada no projeto

/** O que fica guardado no projeto sobre o fundo (tudo entra no Ctrl+Z). */
const FUNDO_DOC = {
  mascara: null, // Blob (PNG, alfa = o que fica) | null = nada removido pela IA
  automatico: false,
  contorno: 0,
  limpar: 0,
  borda: 0,
  fundo: 'transparente',
  cor: '#ffffff',
  desfoque: 20,
  imagem: null,
  desfoqueImagem: 0,
  tracos: [],
  chaveAtiva: false,
  corChave: '#00b140',
  toleranciaChave: 0.15,
  suavidadeChave: 0.08,
}
/** Escolhas da ferramenta (não mudam a imagem: não entram no Ctrl+Z). */
const FUNDO_UI = { pincel: null, tamanhoPincel: null, varinhaAcao: 'apagar', tolerancia: 30, contiguo: true }
const CHEIA = typeof OffscreenCanvas === 'undefined' ? null : mascaraCheia()

const canvas = (w, h) => new OffscreenCanvas(Math.max(1, Math.round(w)), Math.max(1, Math.round(h)))
const limitar = (v, a, b) => Math.min(b, Math.max(a, v))
/** Canvas/bitmap → PNG (para guardar no projeto). */
async function paraBlob(fonte) {
  if (fonte.convertToBlob) return fonte.convertToBlob({ type: 'image/png' })
  if (fonte.toBlob) return new Promise((ok) => fonte.toBlob(ok, 'image/png'))
  const c = canvas(fonte.width, fonte.height)
  c.getContext('2d').drawImage(fonte, 0, 0)
  return c.convertToBlob({ type: 'image/png' })
}
/** Duas transformações afins do canvas, uma depois da outra (primeiro m1, depois m2). */
function compor(m2, m1) {
  const [a2, b2, c2, d2, e2, f2] = m2
  const [a1, b1, c1, d1, e1, f1] = m1
  return [a2 * a1 + c2 * b1, b2 * a1 + d2 * b1, a2 * c1 + c2 * d1, b2 * c1 + d2 * d1, a2 * e1 + c2 * f1 + e2, b2 * e1 + d2 * f1 + f2]
}

const corBaseDe = (formato) => (formato === 'jpg' ? 'jpg' : formato)

/* Painel de camadas: encaixado, solto (posição) ou fechado — lembrado neste navegador. */
const CHAVE_PAINEL = 'hipotetic:editor-imagem:camadas'
function painelSalvo() {
  if (typeof window === 'undefined') return { modo: 'fixo' } // pré-renderização (Node)
  try {
    const v = JSON.parse(localStorage.getItem(CHAVE_PAINEL) ?? 'null')
    if (v && ['fixo', 'flutuante', 'fechado'].includes(v.modo)) return v
  } catch {
    /* sem armazenamento */
  }
  return { modo: 'fixo' }
}

export default function EditorImagem() {
  const [p, setP] = useSalvo('projeto', null) // { nome, base: Blob, geo, w, h, ajustes, filtro, personalizado, camadas, tipo, fundo, baseOculta, baseBloqueada }
  useEmEdicao(Boolean(p))
  const historico = useHistorico(p, setP, Boolean(p))
  const [baseBitmap, setBaseBitmap] = useState(null)
  const [previa, setPrevia] = useState(null)
  const [previaAlta, setPreviaAlta] = useState(null) // { canvas, versao }
  const [versaoPrevia, setVersaoPrevia] = useState(0)
  const [ferramenta, setFerramenta] = useState('filtros')
  const [verAjustes, setVerAjustes] = useState(false)
  const [rascunho, setRascunho] = useState(null) // recorte / tamanho e endireitar (prévia antes de valer)
  const [selecionada, setSelecionada] = useState(null)
  const [editandoCamada, setEditandoCamada] = useState(null) // id: o painel da direita mostra as opções dela
  const [focarTexto, setFocarTexto] = useState(null)
  const [zoom, setZoom] = useState('ajustar')
  const [escalaAtual, setEscalaAtual] = useState(1)
  const [mao, setMao] = useState(false)
  const [pincel, setPincel] = useState(PADRAO_PINCEL)
  const [tamanhoApagar, setTamanhoApagar] = useState(40)
  const [pintura, setPintura] = useState(null) // máscara do "apagar objeto": { canvas, ctx, sujo, ouvir, tracos, refeitos }
  const [, setVersaoPintura] = useState(0)
  const [selecaoIa, setSelecaoIa] = useState(true) // apagar objeto: a IA completa o objeto pintado
  const [estadoSelecao, setEstadoSelecao] = useState(null) // null | 'preparando' | 'pronta' | 'selecionando' | 'erro' | 'grande'
  const [fundoUi, setFundoUi] = useState(FUNDO_UI)
  const [contaGotas, setContaGotas] = useState(null) // null | { alvo: 'fundo' } | { alvo: 'camada', id }
  const [soltandoArquivo, setSoltandoArquivo] = useState(false)
  const [baixando, setBaixando] = useState(null)
  const [estimativa, setEstimativa] = useState(null)
  const [erro, setErro] = useState(null)
  const [aplicando, setAplicando] = useState(false)
  const [painel, setPainel] = useState(painelSalvo)
  const tarefaIa = useTarefa()
  const tarefaCamada = useTarefa() // tirar o fundo de uma camada de imagem
  const entrada = useRef(null)
  const entradaCamada = useRef(null)
  const raiz = useRef(null)

  const mudar = useCallback((d) => setP((x) => (x ? { ...x, ...(typeof d === 'function' ? d(x) : d) } : x)), [setP])
  const camadas = useMemo(() => p?.camadas ?? [], [p?.camadas])

  // Projeto salvo pela versão antiga (textos soltos) → camadas.
  useEffect(() => {
    if (p && !p.camadas) setP(migrar(p))
  }, [p, setP])

  useEffect(() => {
    try {
      localStorage.setItem(CHAVE_PAINEL, JSON.stringify(painel))
    } catch {
      /* sem armazenamento: só não lembra */
    }
  }, [painel])

  /* ─── Altura: o editor ocupa o resto da janela (o cabeçalho do site fica) ─ */
  const aberto = Boolean(p)
  const [altura, setAltura] = useState(null)
  useLayoutEffect(() => {
    if (!aberto) return undefined
    // Com a imagem aberta, a página não rola: rolar sem querer tirava o editor do lugar.
    const html = document.documentElement
    const antes = html.style.overflow
    html.style.overflow = 'hidden'
    scrollTo({ top: 0 })
    const medir = () => {
      const topo = raiz.current?.getBoundingClientRect().top ?? 0
      setAltura(Math.max(320, Math.floor(innerHeight - topo - 12)))
    }
    medir()
    addEventListener('resize', medir)
    return () => {
      html.style.overflow = antes
      removeEventListener('resize', medir)
    }
  }, [aberto])

  /* ─── Base → bitmap (com a geometria acumulada) → prévia ───────────── */
  useEffect(() => {
    if (!p?.base) {
      setBaseBitmap(null)
      return undefined
    }
    let vivo = true
    createImageBitmap(p.base).then((b) => vivo && setBaseBitmap(b))
    return () => {
      vivo = false
    }
  }, [p?.base])
  const geoM = p?.geo?.m
  const bitmap = useMemo(() => {
    if (!baseBitmap || !p) return null
    if (!geoM) return baseBitmap.width === p.w && baseBitmap.height === p.h ? baseBitmap : transformarBase(baseBitmap, { m: [p.w / baseBitmap.width, 0, 0, p.h / baseBitmap.height, 0, 0], W2: p.w, H2: p.h })
    return transformarBase(baseBitmap, { m: geoM, W2: p.w, H2: p.h })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseBitmap, geoM, p?.w, p?.h])
  const reduzida = useRef(null)
  const [versaoReduzida, setVersaoReduzida] = useState(0)
  useEffect(() => {
    if (!bitmap) return
    const k = Math.min(1, PREVIA_MAX / Math.max(bitmap.width, bitmap.height))
    const c = canvas(bitmap.width * k, bitmap.height * k)
    const ctx = c.getContext('2d')
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(bitmap, 0, 0, c.width, c.height)
    reduzida.current = c
    setVersaoReduzida((v) => v + 1)
  }, [bitmap])

  /* ─── Remover fundo: estado do projeto (vale na hora, entra no Ctrl+Z) ─ */
  const fundo = useMemo(() => ({ ...FUNDO_DOC, ...p?.fundo }), [p?.fundo])
  const fundoAtivo = Boolean(p?.fundo && (p.fundo.mascara || p.fundo.tracos?.length || p.fundo.chaveAtiva))
  const usarMascara = fundoAtivo || ferramenta === 'fundo'
  const mudarFundo = useCallback((d) => mudar((x) => ({ fundo: { ...FUNDO_DOC, ...x.fundo, ...(typeof d === 'function' ? d({ ...FUNDO_DOC, ...x.fundo }) : d) } })), [mudar])
  const [mascaraDecodificada, setMascaraDecodificada] = useState(null) // { blob, bmp }
  useEffect(() => {
    const blob = p?.fundo?.mascara
    if (!blob || mascaraDecodificada?.blob === blob) return undefined
    let vivo = true
    bitmapDe(blob).then((bmp) => vivo && setMascaraDecodificada({ blob, bmp }))
    return () => {
      vivo = false
    }
  }, [p?.fundo?.mascara, mascaraDecodificada])
  const mascaraBase = !p?.fundo?.mascara ? CHEIA : mascaraDecodificada?.blob === p.fundo.mascara ? mascaraDecodificada.bmp : null
  const mascaraRefinada = useMemo(
    () => (usarMascara && mascaraBase ? refinarMascara(mascaraBase, { contorno: fundo.contorno, limpar: fundo.limpar }) : null),
    [usarMascara, mascaraBase, fundo.contorno, fundo.limpar],
  )
  const retoque = useRef(null) // { refinada, tracos, fonte, chave, canvas }
  const tracoAtual = useRef(null)
  const [versaoRetoque, setVersaoRetoque] = useState(0)
  const chaveFundo = fundo.chaveAtiva ? { cor: fundo.corChave, tolerancia: fundo.toleranciaChave, suavidade: fundo.suavidadeChave } : null
  const mascaraFinal = () => {
    if (!mascaraRefinada || !p || !bitmap) return null
    const tracos = fundo.tracos
    const chave = JSON.stringify(chaveFundo)
    const r = retoque.current
    if (!r || r.refinada !== mascaraRefinada || r.tracos !== tracos || r.fonte !== bitmap || r.chave !== chave) {
      retoque.current = { refinada: mascaraRefinada, tracos, fonte: bitmap, chave, canvas: mascaraRetocada(mascaraRefinada, tracos, p.w, p.h, bitmap, chaveFundo) }
    }
    return retoque.current.canvas
  }
  const [imagemFundo, setImagemFundo] = useState(null)
  const blobFundo = fundo.fundo === 'imagem' ? fundo.imagem : null
  useEffect(() => {
    if (!blobFundo) return setImagemFundo(null)
    let vivo = true
    createImageBitmap(blobFundo).then(
      (b) => vivo && setImagemFundo(b),
      () => vivo && setImagemFundo(null),
    )
    return () => {
      vivo = false
    }
  }, [blobFundo])

  /** O que a tela mostra da base (com fundo trocado e ajustes) a partir de `fonte`. */
  const comporPrevia = (fonte) => {
    const m = usarMascara ? mascaraFinal() : null
    let f = fonte
    if (m) {
      f = comporFundo(fonte, m, fundo, imagemFundo)
      if (ferramenta === 'fundo' && fundoUi.pincel) mostrarRemovido(f, fonte, m)
    }
    return renderizarAjustes(f, p?.ajustes ?? NEUTRO)
  }
  const depsPrevia = [versaoReduzida, p?.ajustes, mascaraRefinada, p?.fundo, fundoUi.pincel, ferramenta === 'fundo', versaoRetoque, imagemFundo]
  useEffect(() => {
    if (!reduzida.current) return undefined
    const q = requestAnimationFrame(() => {
      setPrevia(comporPrevia(reduzida.current))
      setVersaoPrevia((v) => v + 1)
    })
    return () => cancelAnimationFrame(q)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, depsPrevia)

  // Zoom alto: a prévia reduzida não basta — calcula a de alta resolução (com atraso).
  const precisaAlta = Boolean(p && previa && escalaAtual * p.w > previa.width * 1.05)
  useEffect(() => {
    if (!precisaAlta || !bitmap) {
      setPreviaAlta(null)
      return undefined
    }
    if (previaAlta?.versao === versaoPrevia) return undefined
    const t = setTimeout(() => {
      const k = Math.min(1, ALTA_MAX / Math.max(bitmap.width, bitmap.height))
      let fonte = bitmap
      if (k < 1) {
        fonte = canvas(bitmap.width * k, bitmap.height * k)
        const ctx = fonte.getContext('2d')
        ctx.imageSmoothingQuality = 'high'
        ctx.drawImage(bitmap, 0, 0, fonte.width, fonte.height)
      }
      setPreviaAlta({ canvas: comporPrevia(fonte), versao: versaoPrevia })
    }, 350)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [precisaAlta, versaoPrevia, bitmap])
  const alta = previaAlta?.versao === versaoPrevia ? previaAlta.canvas : null

  /* ─── Camadas: imagens (URLs) e desenhos (canvas) ───────────────────── */
  const urls = useRef(new Map()) // Blob → URL
  const fontes = useMemo(() => {
    const mapa = new Map()
    for (const c of camadas) {
      if (c.tipo !== 'imagem' || !c.arquivo) continue
      if (!urls.current.has(c.arquivo)) urls.current.set(c.arquivo, URL.createObjectURL(c.arquivo))
      mapa.set(c.id, { url: urls.current.get(c.arquivo), arquivo: c.arquivo })
    }
    return mapa
  }, [camadas])
  useEffect(() => () => urls.current.forEach((u) => URL.revokeObjectURL(u)), [])

  const desenhos = useRef(new Map()) // id → { canvas, arquivo }
  const [versaoDesenhos, setVersaoDesenhos] = useState(0)
  useEffect(() => {
    if (!p) return
    let vivo = true
    const ids = new Set()
    for (const c of camadas) {
      if (c.tipo !== 'desenho') continue
      ids.add(c.id)
      const atual = desenhos.current.get(c.id)
      const tamanhoCerto = atual && Math.abs(atual.canvas.width / atual.canvas.height - p.w / p.h) < 0.01
      if (atual && atual.arquivo === c.arquivo && tamanhoCerto) continue
      const cv = atual && tamanhoCerto ? atual.canvas : canvasDesenho(p.w, p.h)
      desenhos.current.set(c.id, { canvas: cv, arquivo: c.arquivo })
      const ctx = cv.getContext('2d')
      if (!c.arquivo) {
        ctx.clearRect(0, 0, cv.width, cv.height)
        setVersaoDesenhos((v) => v + 1)
      } else {
        bitmapDe(c.arquivo).then((b) => {
          if (!vivo || desenhos.current.get(c.id)?.arquivo !== c.arquivo) return
          ctx.clearRect(0, 0, cv.width, cv.height)
          ctx.drawImage(b, 0, 0, cv.width, cv.height)
          setVersaoDesenhos((v) => v + 1)
        })
      }
    }
    for (const id of [...desenhos.current.keys()]) if (!ids.has(id)) desenhos.current.delete(id)
    return () => {
      vivo = false
    }
  }, [camadas, p?.w, p?.h, Boolean(p)]) // eslint-disable-line react-hooks/exhaustive-deps

  const mudarCamada = useCallback((id, d) => mudar((x) => ({ camadas: (x.camadas ?? []).map((c) => (c.id === id ? { ...c, ...d } : c)) })), [mudar])
  const adicionarCamada = (c, editar = true) => {
    mudar((x) => ({ camadas: [...(x.camadas ?? []), c] }))
    setSelecionada(c.id)
    if (editar) setEditandoCamada(c.id)
  }
  const adicionarTexto = (x, y) => {
    const c = novaCamadaTexto(x ?? 0.25, y ?? 0.45)
    adicionarCamada(c)
    setFocarTexto(c.id)
  }
  const adicionarDesenho = () => {
    const c = novaCamadaDesenho(camadas.filter((x) => x.tipo === 'desenho').length + 1)
    desenhos.current.set(c.id, { canvas: canvasDesenho(p.w, p.h), arquivo: null })
    adicionarCamada(c, false)
    return c
  }
  const adicionarImagens = async (lista, nome) => {
    const imagens = [...(lista ?? [])].filter((a) => a.type?.startsWith('image/') || /\.(png|jpe?g|webp|avif|gif|bmp|svg)$/i.test(a.name ?? ''))
    if (!imagens.length) return
    for (const a of imagens) {
      try {
        const arquivo = (await ehSvg(a)) ? await rasterizarSvg(a, 2).then((f) => paraBlob(f)) : a
        const b = await bitmapDe(arquivo)
        adicionarCamada(novaCamadaImagem(arquivo, b.width, b.height, p.w, p.h, nome ?? (semExtensao(a.name ?? '') || 'Imagem')))
      } catch {
        setErro('Não foi possível abrir essa imagem.')
      }
    }
  }

  /* Colar (Ctrl+V) ou soltar uma imagem em cima do editor: vira uma camada. */
  const colar = useRef(null)
  colar.current = (e) => {
    const t = e.target
    if (t?.closest?.('input, textarea, [contenteditable]') || document.querySelector('dialog[open]')) return
    const arquivos = [...(e.clipboardData?.files ?? [])].filter((a) => a.type.startsWith('image/'))
    if (!arquivos.length) return
    e.preventDefault()
    if (p) adicionarImagens(arquivos, arquivos.length === 1 ? 'Imagem colada' : undefined)
    else abrir(arquivos)
  }
  useEffect(() => {
    const f = (e) => colar.current(e)
    addEventListener('paste', f)
    return () => removeEventListener('paste', f)
  }, [])
  const temArquivos = (e) => [...(e.dataTransfer?.types ?? [])].includes('Files')
  const soltura = {
    onDragOver: (e) => {
      if (!temArquivos(e)) return
      e.preventDefault()
      e.dataTransfer.dropEffect = 'copy'
      if (!soltandoArquivo) setSoltandoArquivo(true)
    },
    onDragLeave: (e) => {
      if (!e.currentTarget.contains(e.relatedTarget)) setSoltandoArquivo(false)
    },
    onDrop: (e) => {
      if (!temArquivos(e)) return
      e.preventDefault()
      setSoltandoArquivo(false)
      if (p) adicionarImagens(e.dataTransfer.files)
      else abrir(e.dataTransfer.files)
    },
  }

  /* Conta-gotas: pega a cor do ponto clicado (na camada, a cor da própria imagem dela). */
  const aoContaGotas = async (pt) => {
    const alvo = contaGotas
    setContaGotas(null)
    if (!pt || !alvo || !bitmap) return
    if (alvo.alvo === 'fundo') {
      mudarFundo({ corChave: corNoPonto(bitmap, pt.x, pt.y), chaveAtiva: true })
      return
    }
    const c = camadas.find((x) => x.id === alvo.id)
    if (!c?.arquivo) return
    const bmp = await bitmapDe(c.arquivo)
    // Ponto do quadro → ponto da imagem da camada (desfaz posição, giro, espelho e recorte).
    const L = c.w * p.w
    const A = c.h * p.h
    const a = (-(c.girar ?? 0) * Math.PI) / 180
    const dx = pt.x - (c.x * p.w + L / 2)
    const dy = pt.y - (c.y * p.h + A / 2)
    let lx = dx * Math.cos(a) - dy * Math.sin(a)
    let ly = dx * Math.sin(a) + dy * Math.cos(a)
    if (c.espelharH) lx = -lx
    if (c.espelharV) ly = -ly
    const u = (lx + L / 2) / L
    const v = (ly + A / 2) / A
    const r = c.recorte ?? { x: 0, y: 0, w: 1, h: 1 }
    const cor = u >= 0 && u <= 1 && v >= 0 && v <= 1 && !c.cantos ? corNoPonto(bmp, (r.x + u * r.w) * bmp.width, (r.y + v * r.h) * bmp.height) : corNoPonto(bitmap, pt.x, pt.y)
    mudarCamada(c.id, { semFundo: 'cor', corChave: cor })
  }

  /** Translada uma camada (com ou sem cantos) em px do quadro. */
  const deslocarCamada = (c, dx, dy) => (c.cantos ? { cantos: c.cantos.map(([x, y]) => [x + dx / p.w, y + dy / p.h]) } : { x: c.x + dx / p.w, y: c.y + dy / p.h })
  /** Caixa (px) que a camada ocupa no quadro. */
  const caixaDaCamada = (c) => (c.cantos ? caixaDosCantos(cantosPx(c.cantos, p.w, p.h)) : { x: c.x * p.w, y: c.y * p.h, w: c.w * p.w, h: alturaCamada(c, p.w, p.h) })
  const acoesCamada = {
    ordem: (id, dir) =>
      mudar((x) => {
        const l = [...x.camadas]
        const i = l.findIndex((c) => c.id === id)
        const j = limitar(i + dir, 0, l.length - 1)
        ;[l[i], l[j]] = [l[j], l[i]]
        return { camadas: l }
      }),
    duplicar: (id) => {
      const c = camadas.find((x) => x.id === id)
      if (!c) return
      const copia = { ...c, id: novaId(), nome: `${c.nome} (cópia)`, ...(c.tipo === 'desenho' ? {} : deslocarCamada(c, p.w * 0.02, p.h * 0.02)) }
      if (c.tipo === 'desenho') {
        const cv = canvasDesenho(p.w, p.h)
        const orig = desenhos.current.get(c.id)?.canvas
        if (orig) cv.getContext('2d').drawImage(orig, 0, 0, cv.width, cv.height)
        desenhos.current.set(copia.id, { canvas: cv, arquivo: c.arquivo })
      }
      mudar((x) => {
        const l = [...x.camadas]
        l.splice(l.findIndex((k) => k.id === id) + 1, 0, copia)
        return { camadas: l }
      })
      setSelecionada(copia.id)
      if (editandoCamada) setEditandoCamada(copia.id)
    },
    excluir: (id) => {
      mudar((x) => ({ camadas: x.camadas.filter((c) => c.id !== id) }))
      setSelecionada(null)
      setEditandoCamada((e) => (e === id ? null : e))
    },
    limparDesenho: (id) => {
      const e = desenhos.current.get(id)
      e?.canvas.getContext('2d').clearRect(0, 0, e.canvas.width, e.canvas.height)
      if (e) e.arquivo = null
      mudarCamada(id, { arquivo: null })
    },
    centroHorizontal: () => {
      const c = camadas.find((x) => x.id === editandoCamada)
      if (!c) return
      const b = caixaDaCamada(c)
      mudarCamada(c.id, deslocarCamada(c, p.w / 2 - (b.x + b.w / 2), 0))
    },
    centroVertical: () => {
      const c = camadas.find((x) => x.id === editandoCamada)
      if (!c) return
      const b = caixaDaCamada(c)
      mudarCamada(c.id, deslocarCamada(c, 0, p.h / 2 - (b.y + b.h / 2)))
    },
    /** Liga a distorção: os cantos começam onde a camada está (com o giro dela). */
    distorcer: () => {
      const c = camadas.find((x) => x.id === editandoCamada)
      if (!c) return
      const q = cantosDaCaixa(c.x * p.w, c.y * p.h, c.w * p.w, alturaCamada(c, p.w, p.h), c.girar ?? 0)
      mudarCamada(c.id, { cantos: q.map(([x, y]) => [x / p.w, y / p.h]), modoCantos: 'livre' })
    },
    /** Desliga: a camada volta reta, centrada onde os cantos estavam. */
    semDistorcao: () => {
      const c = camadas.find((x) => x.id === editandoCamada)
      if (!c?.cantos) return
      const b = caixaDosCantos(cantosPx(c.cantos, p.w, p.h))
      const A = alturaCamada(c, p.w, p.h)
      mudarCamada(c.id, { cantos: null, girar: 0, x: (b.x + b.w / 2 - (c.w * p.w) / 2) / p.w, y: (b.y + b.h / 2 - A / 2) / p.h })
    },
    /** Tira o fundo da imagem da camada (remover fundo automático). O original fica guardado. */
    segmentar: (id) =>
      tarefaCamada.executar(async ({ progresso, sinal }) => {
        const c = camadas.find((x) => x.id === id)
        if (!c?.arquivo) return false
        const bmp = await bitmapDe(c.arquivoOriginal ?? c.arquivo) // de novo: parte do original
        const mascara = await mascaraDoFundo(bmp, { modo: 'fundo', progresso, sinal })
        const arquivo = await comporFundo(bmp, mascara, { ...PADRAO_FUNDO, fundo: 'transparente' }).convertToBlob({ type: 'image/png' })
        mudarCamada(id, { arquivo, arquivoOriginal: c.arquivoOriginal ?? c.arquivo })
        return true
      }, 'Removendo o fundo'),
    restaurarOriginal: (id) => {
      const c = camadas.find((x) => x.id === id)
      if (c?.arquivoOriginal) mudarCamada(id, { arquivo: c.arquivoOriginal, arquivoOriginal: null })
    },
    contaGotas: (id) => setContaGotas(id ? { alvo: 'camada', id } : null),
    // Imagem: caber, cobrir ou tamanho original (mantendo a proporção da imagem recortada).
    ...Object.fromEntries(
      [
        ['ajustarTela', 'caber'],
        ['cobrirTela', 'cobrir'],
        ['tamanhoOriginal', 'original'],
      ].map(([nome, modo]) => [
        nome,
        async () => {
          const c = camadas.find((x) => x.id === editandoCamada)
          if (!c?.arquivo) return
          const b = await bitmapDe(c.arquivo)
          const r = c.recorte ?? { w: 1, h: 1 }
          const iw = b.width * r.w
          const ih = b.height * r.h
          const k = modo === 'original' ? 1 : modo === 'caber' ? Math.min(p.w / iw, p.h / ih) : Math.max(p.w / iw, p.h / ih)
          const w = (iw * k) / p.w
          const h = (ih * k) / p.h
          mudarCamada(c.id, { w, h, x: (1 - w) / 2, y: (1 - h) / 2, girar: 0, cantos: null })
        },
      ]),
    ),
  }
  /** Arrastar uma linha do painel de camadas para cima/baixo de outra. */
  const reordenar = (de, para) =>
    mudar((x) => {
      const l = [...x.camadas]
      const i = l.findIndex((c) => c.id === de)
      const j = l.findIndex((c) => c.id === para)
      if (i < 0 || j < 0) return {}
      const [c] = l.splice(i, 1)
      l.splice(j, 0, c)
      return { camadas: l }
    })
  const camadaSel = camadas.find((c) => c.id === selecionada) ?? null
  const camadaEditada = camadas.find((c) => c.id === editandoCamada) ?? null
  // Texto apagado até ficar vazio: ao sair dele, a camada sai junto (não fica "fantasma" na lista).
  const selAnterior = useRef(null)
  useEffect(() => {
    const ant = selAnterior.current
    selAnterior.current = selecionada
    if (!ant || ant === selecionada) return
    const c = camadas.find((x) => x.id === ant)
    if (c?.tipo === 'texto' && !String(c.texto ?? '').trim()) mudar((x) => ({ camadas: (x.camadas ?? []).filter((k) => k.id !== ant) }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selecionada])
  // A camada sumiu (desfez, excluiu): o painel volta para a ferramenta.
  useEffect(() => {
    if (editandoCamada && !camadaEditada) setEditandoCamada(null)
    if (selecionada && !camadaSel) setSelecionada(null)
  }, [editandoCamada, camadaEditada, selecionada, camadaSel])

  /* ─── Abrir ────────────────────────────────────────────────────────── */
  const abrir = async (lista) => {
    const a = [...(lista ?? [])][0]
    if (!a) return
    setErro(null)
    if (a.size > LIMITE_IMAGEM) return setErro('Essa imagem passa do limite de 60 MB.')
    try {
      const fonte = (await ehSvg(a)) ? await rasterizarSvg(a, 2) : await createImageBitmap(a, { imageOrientation: 'from-image' })
      const c = canvas(fonte.width, fonte.height)
      c.getContext('2d').drawImage(fonte, 0, 0)
      const base = await c.convertToBlob({ type: 'image/png' })
      historico.reiniciar()
      setFerramenta('filtros')
      setVerAjustes(false)
      setRascunho(null)
      setPintura(null)
      setSelecionada(null)
      setEditandoCamada(null)
      setFundoUi(FUNDO_UI)
      setZoom('ajustar')
      desenhos.current.clear()
      const ext = extensaoDe(a.name)
      setP({ nome: `${semExtensao(a.name)}-editada`, base, w: c.width, h: c.height, ajustes: NEUTRO, filtro: null, camadas: [], tipo: ['jpg', 'jpeg'].includes(ext) ? 'jpg' : ['png', 'webp', 'avif'].includes(ext) ? ext : 'png' })
    } catch (e) {
      console.error(e)
      setErro('Não foi possível abrir essa imagem.')
    }
  }

  /** Troca a imagem-base por pixels novos no quadro atual (apagar objeto): a geometria recomeça. */
  const comprometer = async (novo) => {
    setAplicando(true)
    try {
      const base = await novo.convertToBlob({ type: 'image/png' })
      mudar({ base, geo: undefined, w: novo.width, h: novo.height })
    } finally {
      setAplicando(false)
    }
  }

  /**
   * Leva a máscara do fundo (com os retoques) para o quadro novo da geometria.
   * O que entra de fora do quadro antigo (endireitar expandindo) fica "mantido".
   */
  const fundoNaGeometria = async ({ m, W2, H2 }) => {
    if (!fundoAtivo || !mascaraRefinada) return p.fundo
    const antiga = mascaraRetocada(mascaraRefinada, fundo.tracos, p.w, p.h, bitmap, null)
    const k1 = antiga.width / p.w
    const k2 = Math.min(1, LADO_MASCARA / Math.max(W2, H2))
    const nova = canvas(W2 * k2, H2 * k2)
    const ctx = nova.getContext('2d')
    ctx.fillStyle = '#000'
    ctx.fillRect(0, 0, nova.width, nova.height)
    ctx.setTransform((k2 * m[0]) / k1, (k2 * m[1]) / k1, (k2 * m[2]) / k1, (k2 * m[3]) / k1, k2 * m[4], k2 * m[5])
    ctx.imageSmoothingQuality = 'high'
    ctx.clearRect(0, 0, antiga.width, antiga.height)
    ctx.drawImage(antiga, 0, 0)
    return { ...fundo, mascara: await paraBlob(nova), tracos: [], contorno: 0, limpar: 0 }
  }

  /** Geometria (recortar, tamanho, girar…): transformação acumulada, camadas, desenhos e máscara juntos, num passo só. */
  const aplicarGeometria = async (g, extra) => {
    if (!bitmap || !baseBitmap) return
    setAplicando(true)
    try {
      const novas = []
      for (const c of camadas) {
        if (c.tipo === 'desenho') {
          const e = desenhos.current.get(c.id)
          if (!e) {
            novas.push(c)
            continue
          }
          const cv = transformarDesenho(e.canvas, g, p.w, p.h)
          const arquivo = c.arquivo ? await paraBlob(cv) : null
          desenhos.current.set(c.id, { canvas: cv, arquivo })
          novas.push({ ...c, arquivo })
        } else novas.push(transformarCamada(c, g, p.w, p.h))
      }
      const atual = p.geo?.m ?? [p.w / baseBitmap.width, 0, 0, p.h / baseBitmap.height, 0, 0]
      const novoFundo = await fundoNaGeometria(g)
      mudar((x) => ({ geo: { m: compor(g.m, atual) }, w: g.W2, h: g.H2, camadas: novas, fundo: novoFundo, ...extra?.(x) }))
      setVersaoDesenhos((v) => v + 1)
    } finally {
      setAplicando(false)
    }
  }

  /* ─── Ferramentas ──────────────────────────────────────────────────── */
  const novaPintura = (w, h) => {
    const c = canvas(w, h)
    return { canvas: c, ctx: c.getContext('2d'), sujo: false, ouvir: null, tracos: [], refeitos: [] }
  }
  /** Apagar objeto: traços guardados como desenho — desfazer redesenha os que sobraram. */
  const pintarTracoApagar = (ctx, t, desde = 0) => {
    if (t.canvas) {
      ctx.drawImage(t.canvas, 0, 0) // o objeto que a IA completou
      return
    }
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.lineWidth = t.tamanho
    ctx.strokeStyle = '#ff2d55'
    ctx.beginPath()
    const i0 = Math.max(0, desde)
    ctx.moveTo(t.pontos[i0][0], t.pontos[i0][1])
    if (t.pontos.length === 1) ctx.lineTo(t.pontos[0][0] + 0.01, t.pontos[0][1])
    for (let i = i0 + 1; i < t.pontos.length; i += 1) ctx.lineTo(t.pontos[i][0], t.pontos[i][1])
    ctx.stroke()
  }
  const redesenharPintura = (pt) => {
    pt.ctx.clearRect(0, 0, pt.canvas.width, pt.canvas.height)
    for (const t of pt.tracos) pintarTracoApagar(pt.ctx, t)
    pt.sujo = pt.tracos.length > 0
    pt.ouvir?.()
    setVersaoPintura((v) => v + 1)
  }
  const desfazerApagar = () => {
    if (!pintura?.tracos.length) return
    pintura.refeitos.push(pintura.tracos.pop())
    redesenharPintura(pintura)
  }
  const refazerApagar = () => {
    if (!pintura?.refeitos.length) return
    pintura.tracos.push(pintura.refeitos.pop())
    redesenharPintura(pintura)
  }
  const limparPintura = () => {
    if (!pintura) return
    pintura.tracos = []
    pintura.refeitos = []
    redesenharPintura(pintura)
  }
  const rascunhoInicial = (id, x = p) => {
    if (!x) return null
    if (id === 'recortar') return { x: 0, y: 0, w: x.w, h: x.h, proporcao: null, prop: 'livre' }
    if (id === 'tamanho') return { w: x.w, h: x.h, trava: rascunho?.trava ?? false, angulo: 0, bordas: rascunho?.bordas ?? 'recortar' }
    return null
  }

  /* Prévia que vale ao sair: recorte, endireitar e tamanho digitado. */
  const pendente = () => {
    if (!p || !rascunho || aplicando) return null
    if (ferramenta === 'recortar') {
      const r = rascunho
      return Math.round(r.x) || Math.round(r.y) || Math.round(r.w) !== p.w || Math.round(r.h) !== p.h ? 'recorte' : null
    }
    if (ferramenta === 'tamanho') {
      if (rascunho.angulo) return 'angulo'
      if (rascunho.w !== p.w || rascunho.h !== p.h) return 'tamanho'
    }
    return null
  }
  const aplicarRecorte = () => aplicarGeometria(GEOMETRIA.recorte(rascunho))
  const aplicarTamanho = (nw = rascunho.w, nh = rascunho.h, cobrir = false) => {
    clearTimeout(agendaTamanho.current)
    return aplicarGeometria(cobrir ? GEOMETRIA.cobrir(p.w, p.h, nw, nh) : GEOMETRIA.esticar(p.w, p.h, nw, nh))
  }
  const aplicarEndireitar = () => {
    const ang = rascunho?.angulo ?? 0
    if (!ang) return Promise.resolve()
    const expandir = rascunho.bordas === 'expandir'
    const { w: W2, h: H2 } = expandir ? caixaGirada(p.w, p.h, ang) : maiorDentroGirado(p.w, p.h, ang)
    return aplicarGeometria(GEOMETRIA.endireitar(p.w, p.h, ang, W2, H2), (x) => (expandir && x.tipo === 'jpg' ? { tipo: 'png' } : {}))
  }
  /** Faz valer a prévia pendente (ao sair da ferramenta, Enter ou Baixar). */
  const concluirPendente = () => {
    const qual = pendente()
    if (qual === 'recorte') return aplicarRecorte()
    if (qual === 'angulo') return aplicarEndireitar()
    if (qual === 'tamanho') return aplicarTamanho()
    return Promise.resolve()
  }
  // Tamanho digitado: vale sozinho quando a pessoa para de digitar.
  const agendaTamanho = useRef(0)
  const agendarTamanho = () => {
    clearTimeout(agendaTamanho.current)
    agendaTamanho.current = setTimeout(() => concluirRef.current?.(), 900)
  }
  const concluirRef = useRef(null)
  concluirRef.current = () => {
    if (pendente() === 'tamanho') aplicarTamanho()
  }
  useEffect(() => () => clearTimeout(agendaTamanho.current), [])

  const escolher = (id) => {
    if (id !== ferramenta) concluirPendente()
    setFerramenta(id)
    setMao(false)
    setContaGotas(null)
    setEditandoCamada(null)
    if (id !== 'filtros') setVerAjustes(false)
    if (!p) return
    setRascunho(rascunhoInicial(id))
    setPintura(id === 'apagar' ? novaPintura(p.w, p.h) : null)
  }
  // Mudou o tamanho da imagem (valeu, desfez…): a máscara do apagar e a prévia da ferramenta acompanham.
  useEffect(() => {
    if (!p) return
    if (pintura && (pintura.canvas.width !== p.w || pintura.canvas.height !== p.h)) setPintura(novaPintura(p.w, p.h))
    if (ferramenta === 'recortar' || ferramenta === 'tamanho') setRascunho((r) => ({ ...rascunhoInicial(ferramenta), ...(r && ferramenta === 'tamanho' ? { trava: r.trava, bordas: r.bordas } : {}) }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p?.w, p?.h, p?.geo])
  // Projeto recuperado com a ferramenta já aberta: a prévia da ferramenta nasce junto.
  useEffect(() => {
    if (p && !rascunho && (ferramenta === 'recortar' || ferramenta === 'tamanho')) setRascunho(rascunhoInicial(ferramenta))
    if (p && ferramenta === 'apagar' && !pintura) setPintura(novaPintura(p.w, p.h))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [Boolean(p), ferramenta])

  const girar90 = (sentido) => aplicarGeometria(GEOMETRIA.girar90(p.w, p.h, sentido))
  const espelhar = (horizontal) => aplicarGeometria(GEOMETRIA.espelhar(p.w, p.h, horizontal))

  /* Remover fundo */
  const executarIa = (tipo) =>
    tarefaIa.executar(
      async ({ progresso, sinal }) => {
        if (tipo === 'fundo') {
          const mascara = await mascaraDoFundo(bitmap, { modo: 'fundo', progresso, sinal })
          const blob = await paraBlob(mascara)
          setMascaraDecodificada({ blob, bmp: mascara })
          mudarFundo({ mascara: blob, automatico: true })
          return true
        }
        const r = await apagarObjeto(bitmap, pintura.canvas, { progresso, sinal })
        await comprometer(r)
        limparPintura()
        return true
      },
      tipo === 'fundo' ? 'Removendo o fundo' : 'Preenchendo',
    )
  const restaurarFundo = () => mudar({ fundo: null })
  // Deixa o modelo pronto em segundo plano ao abrir a ferramenta (se já foi baixado).
  useEffect(() => {
    if (!p || tarefaIa.fase === 'processando') return
    if (ferramenta === 'fundo' && !fundo.automatico) prepararModelo('fundo')
    else if (ferramenta === 'apagar') prepararModelo('apagar')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ferramenta, Boolean(p)])

  /* Apagar objeto: a seleção inteligente lê a imagem assim que a ferramenta abre. */
  useEffect(() => {
    if (ferramenta !== 'apagar' || !selecaoIa || !bitmap) return undefined
    let vivo = true
    setEstadoSelecao((e) => (e === 'selecionando' ? e : 'preparando'))
    prepararSelecao(bitmap).then(
      () => vivo && setEstadoSelecao((e) => (e === 'selecionando' ? e : 'pronta')),
      (e) => {
        console.warn('Seleção inteligente indisponível:', e)
        if (vivo) setEstadoSelecao('erro')
      },
    )
    return () => {
      vivo = false
    }
  }, [ferramenta, selecaoIa, bitmap])
  /** Depois de cada traço: a IA acha o objeto pintado e completa a seleção (vira um passo do desfazer). */
  const completarComIa = async (traco) => {
    const pt = pintura
    if (!pt || !bitmap || !traco?.pontos.length) return
    const n = traco.pontos.length
    const passo = Math.max(1, Math.floor(n / 8))
    const pontos = traco.pontos.filter((_, i) => i % passo === 0).slice(0, 8)
    setEstadoSelecao('selecionando')
    try {
      const r = await selecionarObjeto(bitmap, pontos)
      if (pintura !== pt || !pt.tracos.includes(traco)) return setEstadoSelecao('pronta')
      // Pegou quase a imagem toda (o fundo, uma parede): melhor não completar.
      if (!r || r.fracao > 0.6) return setEstadoSelecao(r ? 'grande' : 'pronta')
      // Um pouco maior que o objeto (o preenchimento precisa da borda) e na cor da pintura.
      const raio = Math.max(2, Math.round(Math.max(p.w, p.h) / 200))
      const cv = canvas(p.w, p.h)
      const ctx = cv.getContext('2d')
      for (let a = 0; a < 16; a += 1) ctx.drawImage(r.mascara, Math.cos((a / 16) * Math.PI * 2) * raio, Math.sin((a / 16) * Math.PI * 2) * raio)
      ctx.drawImage(r.mascara, 0, 0)
      ctx.globalCompositeOperation = 'source-in'
      ctx.fillStyle = '#ff2d55'
      ctx.fillRect(0, 0, cv.width, cv.height)
      const i = pt.tracos.indexOf(traco)
      pt.tracos.splice(i + 1, 0, { canvas: cv, ia: true })
      redesenharPintura(pt)
      setEstadoSelecao('pronta')
    } catch (e) {
      console.warn('Seleção inteligente falhou:', e)
      setEstadoSelecao('erro')
    }
  }

  /* Retoque da máscara (varinha, ocultar, revelar) */
  const pincelFundoPadrao = p ? Math.max(4, Math.round(Math.max(p.w, p.h) / 30)) : 40
  const agendado = useRef(0)
  const agendar = (f) => {
    if (agendado.current) return
    agendado.current = requestAnimationFrame(() => {
      agendado.current = 0
      f()
    })
  }
  const pintarRetoque = ({ x, y }, comeco) => {
    const m = mascaraFinal()
    if (!m || !fundoUi.pincel) return
    const ponto = [Math.round(x * 10) / 10, Math.round(y * 10) / 10]
    if (fundoUi.pincel === 'varinha') {
      if (!comeco) return
      tracoAtual.current = { modo: 'varinha', acao: fundoUi.varinhaAcao, tolerancia: fundoUi.tolerancia, contiguo: fundoUi.contiguo, pontos: [ponto] }
      desenharTraco(m.getContext('2d'), tracoAtual.current, m.width / p.w, 0, bitmap)
    } else {
      if (comeco) tracoAtual.current = { modo: fundoUi.pincel, tamanho: fundoUi.tamanhoPincel ?? pincelFundoPadrao, pontos: [] }
      const t = tracoAtual.current
      if (!t) return
      t.pontos.push(ponto)
      desenharTraco(m.getContext('2d'), t, m.width / p.w, t.pontos.length - 2)
    }
    agendar(() => setVersaoRetoque((v) => v + 1))
  }
  const soltarRetoque = () => {
    const t = tracoAtual.current
    tracoAtual.current = null
    if (!t?.pontos.length) return
    const tracos = [...fundo.tracos, t]
    if (retoque.current) retoque.current.tracos = tracos // a máscara na tela já tem o traço: não refaz
    mudarFundo({ tracos })
  }

  /* Pincéis (camada de desenho) */
  const traco = useRef(null) // { id, t }
  const camadaDesenhoAlvo = () => {
    if (camadaSel?.tipo === 'desenho') return camadaSel
    const ultima = [...camadas].reverse().find((c) => c.tipo === 'desenho' && c.visivel !== false)
    return ultima ?? adicionarDesenho()
  }
  const pintarDesenho = (pt, comeco, ev) => {
    if (comeco) {
      const c = camadaDesenhoAlvo()
      let e = desenhos.current.get(c.id)
      if (!e) {
        e = { canvas: canvasDesenho(p.w, p.h), arquivo: c.arquivo }
        desenhos.current.set(c.id, e)
      }
      setSelecionada(c.id)
      traco.current = { id: c.id, t: iniciarTraco(pincel, e.canvas, e.canvas.width / p.w) }
    }
    const tr = traco.current
    if (!tr) return
    tr.t.mover([pt.x, pt.y], ev?.shiftKey)
    agendar(() => tr.t.compor())
  }
  const soltarDesenho = async () => {
    const tr = traco.current
    traco.current = null
    if (!tr) return
    tr.t.compor() // (forma sem tamanho: volta a camada como estava)
    if (tr.t.vazio()) return
    const e = desenhos.current.get(tr.id)
    if (!e) return
    const arquivo = await paraBlob(e.canvas)
    e.arquivo = arquivo
    mudarCamada(tr.id, { arquivo })
  }

  /* Pintura: roteia para a ferramenta */
  const aoPintar = (pt, comeco, ev) => {
    if (ferramenta === 'fundo') return pintarRetoque(pt, comeco)
    if (ferramenta === 'pincel') return pintarDesenho(pt, comeco, ev)
    // Apagar objeto: máscara vermelha (cada traço fica guardado, para desfazer).
    if (!pintura) return
    if (comeco) {
      pintura.tracos.push({ tamanho: tamanhoApagar, pontos: [[pt.x, pt.y]] })
      pintura.refeitos = []
    } else pintura.tracos.at(-1)?.pontos.push([pt.x, pt.y])
    const t = pintura.tracos.at(-1)
    if (!t) return
    pintarTracoApagar(pintura.ctx, t, t.pontos.length - 2)
    pintura.sujo = true
    pintura.ouvir?.()
  }
  const aoSoltarPintura = () => {
    if (ferramenta === 'fundo') return soltarRetoque()
    if (ferramenta === 'pincel') return soltarDesenho()
    if (ferramenta === 'apagar') {
      setVersaoPintura((v) => v + 1)
      const t = pintura?.tracos.at(-1)
      if (selecaoIa && t && !t.canvas) completarComIa(t)
    }
  }

  /* Desfazer/refazer: prévia pendente primeiro (cancela), depois os traços do apagar objeto, depois o projeto. */
  const desfazer = () => {
    if (pendente()) setRascunho(rascunhoInicial(ferramenta))
    else if (ferramenta === 'apagar' && pintura?.tracos.length) desfazerApagar()
    else historico.desfazer()
  }
  const refazer = () => {
    if (ferramenta === 'apagar' && pintura?.refeitos.length) refazerApagar()
    else historico.refazer()
  }
  const podeDesfazer = historico.podeDesfazer || Boolean(pendente()) || (ferramenta === 'apagar' && Boolean(pintura?.tracos.length))
  const podeRefazer = historico.podeRefazer || (ferramenta === 'apagar' && Boolean(pintura?.refeitos.length))

  /* Clique no vazio da imagem: no Texto cria (ou só tira a seleção); nas outras, tira a seleção. */
  const aoClicarVazio = ({ x, y }) => {
    if (ferramenta !== 'texto' || (camadaSel && camadaSel.tipo !== 'desenho')) {
      setSelecionada(null)
      setEditandoCamada(null)
      return
    }
    adicionarTexto(limitar(x / p.w - 0.25, 0, 0.75), limitar(y / p.h - 0.05, 0, 0.9))
  }
  const aoSelecionarNaTela = (id) => {
    setSelecionada(id)
    // No Texto (ou já editando outra camada), clicar numa camada abre as opções dela.
    const c = camadas.find((x) => x.id === id)
    if (id && (ferramenta === 'texto' || editandoCamada) && c?.tipo !== 'desenho') setEditandoCamada(id)
  }
  const editarCamada = (id) => {
    setSelecionada(id)
    setEditandoCamada(id)
  }

  /* ─── Baixar ───────────────────────────────────────────────────────── */
  const contadorDoc = useRef(0)
  const versaoDoc = useMemo(() => (contadorDoc.current += 1), [p]) // muda a cada mudança no projeto
  const chaveEstimativa = baixando ? JSON.stringify([baixando.formato, baixando.qualidade, baixando.fundo, versaoDoc]) : null
  const transparente = Boolean(p) && (p.baseOculta || (fundoAtivo && (fundo.fundo === 'transparente' || (fundo.fundo === 'imagem' && !imagemFundo))))
  const final = () => {
    const m = fundoAtivo ? mascaraFinal() : null
    const base = m ? comporFundo(bitmap, m, fundo, imagemFundo) : bitmap
    return renderizarDocumento({ base, ajustes: p.ajustes, camadas, W: p.w, H: p.h, desenhos: desenhos.current, baseOculta: p.baseOculta })
  }
  useEffect(() => {
    if (!baixando || !bitmap) return undefined
    let vivo = true
    const t = setTimeout(async () => {
      try {
        const blob = await codificar(await final(), { formato: baixando.formato, qualidade: baixando.qualidade, fundo: baixando.fundo, otimizar: baixando.formato === 'png' })
        if (vivo) setEstimativa({ chave: chaveEstimativa, blob })
      } catch (e) {
        console.error(e)
        if (vivo) setEstimativa(null)
      }
    }, 450)
    return () => {
      vivo = false
      clearTimeout(t)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chaveEstimativa])
  const abrirBaixar = async () => {
    await concluirPendente()
    setBaixando({ formato: transparente && p.tipo === 'jpg' ? 'png' : p.tipo, qualidade: 90, fundo: '#ffffff' })
  }
  const baixarAgora = async (nome) => {
    const s = baixando
    const chave = chaveEstimativa
    setBaixando(null)
    if (nome !== p.nome) mudar({ nome }) // (sem passo vazio no Ctrl+Z)
    const pronta = estimativa?.chave === chave ? estimativa.blob : null
    const blob = pronta ?? (await codificar(await final(), { formato: s.formato, qualidade: s.qualidade, fundo: s.fundo, otimizar: s.formato === 'png' }))
    baixarBlob(blob, `${nome}.${s.formato}`)
  }

  /* ─── Zoom ─────────────────────────────────────────────────────────── */
  const maximo = p ? zoomMaximo(p.w, p.h) : 8
  const zoomEm = (fator) => setZoom(limitar((zoom === 'ajustar' ? escalaAtual : zoom) * fator, ZOOM_MINIMO, maximo))

  /* ─── Atalhos ──────────────────────────────────────────────────────── */
  const teclas = useRef(null)
  teclas.current = (e) => {
    if (document.querySelector('dialog[open]')) return
    const digitando = e.target.closest?.('input:not([type=range]):not([type=checkbox]), textarea, select, [contenteditable]')
    if ((e.ctrlKey || e.metaKey) && !e.altKey) {
      if (digitando) return
      const k = e.key.toLowerCase()
      if (k === 'z' && !e.shiftKey) {
        e.preventDefault()
        desfazer()
      } else if ((k === 'z' && e.shiftKey) || k === 'y') {
        e.preventDefault()
        refazer()
      } else if (p && (k === '=' || k === '+' || k === '-' || k === '0' || k === '1')) {
        e.preventDefault()
        if (k === '0') setZoom('ajustar')
        else if (k === '1') setZoom(1)
        else zoomEm(k === '-' ? 1 / 1.25 : 1.25)
      }
      return
    }
    // Enter faz valer a prévia (recorte, endireitar, tamanho digitado) — também de dentro do campo de tamanho.
    if (e.key === 'Enter' && pendente() && (!digitando || e.target.closest?.('[data-campo-tamanho]'))) {
      e.preventDefault()
      concluirPendente()
      return
    }
    if (digitando) return
    if (contaGotas && e.key === 'Escape') setContaGotas(null)
    else if (e.key === 'h' || e.key === 'H') setMao((m) => !m)
    else if (camadaSel && (camadasInterativas || editandoCamada) && (e.key === 'Delete' || e.key === 'Backspace')) {
      e.preventDefault()
      acoesCamada.excluir(camadaSel.id)
    } else if (camadaSel && e.key.startsWith('Arrow') && camadaSel.tipo !== 'desenho') {
      e.preventDefault()
      const passo = e.shiftKey ? 10 : 1
      const d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key]
      mudarCamada(camadaSel.id, deslocarCamada(camadaSel, d[0] * passo, d[1] * passo))
    } else if (e.key === 'Escape') {
      if (pendente()) setRascunho(rascunhoInicial(ferramenta))
      else if (editandoCamada) setEditandoCamada(null)
      else setSelecionada(null)
    }
  }
  useEffect(() => {
    const f = (e) => teclas.current(e)
    addEventListener('keydown', f)
    return () => removeEventListener('keydown', f)
  }, [])

  const ocupado = aplicando || tarefaIa.fase === 'processando' || tarefaCamada.fase === 'processando'
  const estimado = estimativa && estimativa.chave === chaveEstimativa ? estimativa.blob : null
  const pintando = ferramenta === 'apagar' || ferramenta === 'pincel' || (ferramenta === 'fundo' && Boolean(fundoUi.pincel))
  const camadasInterativas = !mao && !contaGotas && !pintando && ferramenta !== 'recortar'
  const pincelTela = ferramenta === 'apagar' ? { tamanho: tamanhoApagar } : ferramenta === 'pincel' ? { tamanho: tamanhoDoCursor(pincel) } : ferramenta === 'fundo' && fundoUi.pincel ? { tamanho: fundoUi.pincel === 'varinha' ? 0 : (fundoUi.tamanhoPincel ?? pincelFundoPadrao) } : null
  const zoomPct = Math.round(escalaAtual * 100)
  const baseBloqueada = Boolean(p?.baseBloqueada)
  const ferramentaDaBase = FERRAMENTAS.find((f) => f.id === ferramenta)?.base

  /* ─── Painéis ──────────────────────────────────────────────────────── */
  const painelDaCamada = camadaEditada ? (
    <PainelCamada
      camada={camadaEditada}
      mudar={mudarCamada}
      acoes={acoesCamada}
      focarTexto={focarTexto === camadaEditada.id}
      aoFocado={() => setFocarTexto(null)}
      contaGotasAtivo={contaGotas?.alvo === 'camada' && contaGotas.id === camadaEditada.id}
      segmentar={
        camadaEditada.tipo === 'imagem' ? (
          <BotaoSegmentarCamada
            tarefa={tarefaCamada}
            aoClicar={() => acoesCamada.segmentar(camadaEditada.id)}
            aoRestaurar={camadaEditada.arquivoOriginal ? () => acoesCamada.restaurarOriginal(camadaEditada.id) : null}
            desativado={ocupado}
          />
        ) : null
      }
    />
  ) : null

  const painelDaFerramenta = () => {
    if (!p) return <p className="text-sm text-suave">Abra uma imagem para ver as opções.</p>
    if (ferramentaDaBase && baseBloqueada) {
      return (
        <Grupo titulo={NOME_FERRAMENTA[ferramenta]}>
          <p className="rounded-lg border border-borda bg-superficie-2 p-3 text-sm text-suave">A imagem de fundo está bloqueada. Desbloqueie no painel de camadas (o cadeado) para mexer nela.</p>
          <Botao variante="secundario" tamanho="p" icone="desbloquear" className="self-start" onClick={() => mudar({ baseBloqueada: false })}>
            Desbloquear
          </Botao>
        </Grupo>
      )
    }
    if (ferramenta === 'filtros') {
      if (verAjustes) {
        return (
          <>
            <button type="button" onClick={() => setVerAjustes(false)} className="-mb-2 flex items-center gap-1.5 self-start text-xs font-semibold text-suave hover:text-tinta" data-voltar-filtros="">
              <Icone nome="seta" tamanho={14} className="rotate-180" />
              Filtros
            </button>
            {/* Mexer nos ajustes = o filtro "Personalizado" (fica guardado mesmo trocando de filtro). */}
            <PainelAjustes a={p.ajustes} filtro={p.filtro} mudar={(a) => mudar({ ajustes: a, filtro: ehNeutro(a) ? null : { id: 'personalizado', k: 1 }, personalizado: ehNeutro(a) ? null : a })} />
          </>
        )
      }
      return (
        <PainelFiltros
          reduzida={reduzida.current}
          versao={versaoReduzida}
          filtro={p.filtro?.id === 'personalizado' || (!p.filtro && !ehNeutro(p.ajustes)) ? { id: 'personalizado', k: 1 } : p.filtro}
          personalizado={p.personalizado ?? (!p.filtro && !ehNeutro(p.ajustes) ? p.ajustes : null)}
          aoEscolher={(id, k) => mudar({ ajustes: ajustesDoFiltro(id, k), filtro: id === 'original' ? null : { id, k } })}
          aoPersonalizar={() => {
            const salvo = p.personalizado ?? (!p.filtro && !ehNeutro(p.ajustes) ? p.ajustes : null)
            mudar({ ajustes: salvo ?? NEUTRO, filtro: salvo ? { id: 'personalizado', k: 1 } : null, personalizado: salvo })
            setVerAjustes(true)
          }}
        />
      )
    }
    if (ferramenta === 'recortar' && rascunho) {
      return (
        <>
          <Grupo titulo="Proporção">
            <div className="grid grid-cols-4 gap-1.5">
              {PROPORCOES.map((pr) => (
                <button
                  key={pr.id}
                  type="button"
                  aria-pressed={rascunho.prop === pr.id}
                  onClick={() => {
                    if (!pr.valor) return setRascunho({ x: 0, y: 0, w: p.w, h: p.h, proporcao: null, prop: 'livre' })
                    const w = Math.min(p.w, p.h * pr.valor)
                    const h = w / pr.valor
                    return setRascunho({ x: (p.w - w) / 2, y: (p.h - h) / 2, w, h, proporcao: pr.valor, prop: pr.id })
                  }}
                  className={`h-8 rounded-lg border text-xs font-semibold tabular-nums transition-colors ${rascunho.prop === pr.id ? 'border-marca bg-marca text-sobre-marca' : 'border-borda text-suave hover:text-tinta'}`}
                >
                  {pr.rotulo}
                </button>
              ))}
            </div>
          </Grupo>
          <p className="text-xs text-fraca tabular-nums">
            Arraste as alças ou a área para escolher o que fica ({Math.round(rascunho.w)} × {Math.round(rascunho.h)} px). O recorte vale ao trocar de ferramenta, ao baixar ou com Enter; Esc ou Ctrl+Z voltam como estava.
          </p>
        </>
      )
    }
    if (ferramenta === 'tamanho' && rascunho) {
      return (
        <>
          <Grupo titulo="Largura e altura">
            <div className="grid grid-cols-2 gap-3" data-campo-tamanho="">
              <Entrada
                rotulo="Largura"
                type="number"
                min="1"
                sufixo="px"
                valor={String(rascunho.w)}
                onBlur={() => concluirRef.current?.()}
                aoMudar={(v) => {
                  const nw = Math.max(1, Math.round(Number(v) || 1))
                  setRascunho((r) => ({ ...r, w: nw, h: r.trava ? Math.max(1, Math.round((nw * p.h) / p.w)) : r.h }))
                  agendarTamanho()
                }}
              />
              <Entrada
                rotulo="Altura"
                type="number"
                min="1"
                sufixo="px"
                valor={String(rascunho.h)}
                onBlur={() => concluirRef.current?.()}
                aoMudar={(v) => {
                  const nh = Math.max(1, Math.round(Number(v) || 1))
                  setRascunho((r) => ({ ...r, h: nh, w: r.trava ? Math.max(1, Math.round((nh * p.w) / p.h)) : r.w }))
                  agendarTamanho()
                }}
              />
            </div>
            <Caixa rotulo="Manter a proporção" marcado={rascunho.trava} aoMudar={(v) => setRascunho((r) => ({ ...r, trava: v }))} />
            <div className="flex flex-wrap gap-1.5">
              {[25, 50, 75, 150, 200].map((pc) => (
                <button key={pc} type="button" disabled={ocupado} onClick={() => aplicarTamanho(Math.max(1, Math.round((p.w * pc) / 100)), Math.max(1, Math.round((p.h * pc) / 100)))} className="h-8 rounded-lg border border-borda px-2.5 text-xs font-semibold text-suave tabular-nums hover:text-tinta disabled:opacity-40">
                  {pc}%
                </button>
              ))}
            </div>
            <p className="text-xs text-fraca">Também dá para arrastar as alças da imagem (desmarque a proporção para esticar ou achatar).</p>
            <Seletor
              valor=""
              aoMudar={(id) => {
                const r = REDES.find((x) => x.id === id)
                if (r) aplicarTamanho(r.w, r.h, true)
              }}
              opcoes={[{ valor: '', rotulo: 'Tamanho de rede social…' }, ...REDES.map((r) => ({ valor: r.id, rotulo: `${r.nome} · ${r.w}×${r.h}` }))]}
            />
          </Grupo>
          <Grupo titulo="Girar 90°">
            <div className="grid grid-cols-2 gap-2">
              <Botao variante="secundario" icone="girarAnti" onClick={() => girar90(-1)} disabled={ocupado}>
                Anti-horário
              </Botao>
              <Botao variante="secundario" icone="girar" onClick={() => girar90(1)} disabled={ocupado}>
                Horário
              </Botao>
            </div>
          </Grupo>
          <Grupo titulo="Espelhar">
            <div className="grid grid-cols-2 gap-2">
              <Botao variante="secundario" icone="espelhar" onClick={() => espelhar(true)} disabled={ocupado} aria-label="Espelhar na horizontal" title="Espelhar na horizontal" data-espelhar="horizontal">
                Horizontal
              </Botao>
              <Botao variante="secundario" icone="espelharV" onClick={() => espelhar(false)} disabled={ocupado} aria-label="Espelhar na vertical" title="Espelhar na vertical" data-espelhar="vertical">
                Vertical
              </Botao>
            </div>
          </Grupo>
          <Grupo titulo="Endireitar">
            <p className="text-sm text-suave">Desenhe uma linha na imagem por cima de algo que deveria estar reto (horizonte, parede, poste), ou ajuste o ângulo.</p>
            <Deslizante rotulo="Ângulo" valor={rascunho.angulo} aoMudar={(v) => setRascunho((r) => ({ ...r, angulo: v }))} min={-45} max={45} passo={0.1} formatar={(v) => `${v.toLocaleString('pt-BR')}°`} />
            <Escolhas
              rotulo="Bordas"
              atributo="data-bordas"
              valor={rascunho.bordas}
              aoMudar={(v) => setRascunho((r) => ({ ...r, bordas: v }))}
              opcoes={[
                ['recortar', 'Recortar as bordas'],
                ['expandir', 'Expandir a tela'],
              ]}
            />
            <p className="text-xs text-fraca">
              {rascunho.bordas === 'expandir' ? 'Mantém a imagem inteira; os cantos ficam transparentes.' : 'Corta o necessário para a imagem continuar retangular (a área clara).'} Vale ao trocar de ferramenta, ao baixar ou com Enter.
            </p>
          </Grupo>
        </>
      )
    }
    if (ferramenta === 'fundo') {
      return (
        <PainelFundo
          r={{ ...fundo, ...fundoUi, automatico: fundo.automatico }}
          mudar={(d) => {
            const ui = {}
            const doc = {}
            for (const [k, v] of Object.entries(d)) (k in FUNDO_UI ? ui : doc)[k] = v
            if (Object.keys(ui).length) setFundoUi((x) => ({ ...x, ...ui }))
            if (Object.keys(doc).length) mudarFundo(doc)
          }}
          restaurar={restaurarFundo}
          desfazerTraco={desfazer}
          tamanhoPadrao={pincelFundoPadrao}
          tamanhoMax={Math.max(20, Math.round(Math.max(p.w, p.h) / 4))}
          carregandoImagem={Boolean(fundo.imagem) && fundo.fundo === 'imagem' && !imagemFundo}
          segmentar={<BotaoSegmentar tarefa={tarefaIa} aoClicar={() => executarIa('fundo')} desativado={ocupado} feito={Boolean(fundo.automatico)} />}
          aoContaGotas={() => setContaGotas((x) => (x ? null : { alvo: 'fundo' }))}
          contaGotasAtivo={contaGotas?.alvo === 'fundo'}
        />
      )
    }
    if (ferramenta === 'apagar') {
      return (
        <Grupo titulo="Apagar objeto">
          <p className="text-sm text-suave">Pinte por cima do que quer apagar (pessoa, texto, sujeira…) e clique em Apagar. O que estava atrás é reconstruído.</p>
          <Caixa rotulo="Seleção inteligente (a IA completa o objeto pintado)" marcado={selecaoIa} aoMudar={setSelecaoIa} />
          {selecaoIa ? (
            <p className="text-xs text-fraca" data-estado-selecao={estadoSelecao ?? ''}>
              {estadoSelecao === 'preparando'
                ? 'Preparando a seleção inteligente (na primeira vez baixa ~14 MB)…'
                : estadoSelecao === 'selecionando'
                  ? 'Achando o objeto que você pintou…'
                  : estadoSelecao === 'erro'
                    ? 'A seleção inteligente não funcionou neste aparelho: pinte o objeto inteiro à mão.'
                    : estadoSelecao === 'grande'
                      ? 'A IA achou uma área grande demais (o fundo?) e não completou. Pinte um pouco mais dentro do objeto.'
                      : 'Basta um risco no objeto: a IA acha o contorno dele e pinta o resto. Ctrl+Z desfaz o que ela completou.'}
            </p>
          ) : null}
          <Deslizante rotulo="Tamanho do pincel" valor={tamanhoApagar} aoMudar={setTamanhoApagar} min={4} max={300} formatar={(v) => `${v} px`} />
          {tarefaIa.fase === 'processando' ? (
            <Progresso valor={tarefaIa.progresso} rotulo={tarefaIa.rotulo} aoCancelar={tarefaIa.cancelar} />
          ) : (
            <Botao tamanho="g" icone="magica" onClick={() => executarIa('apagar')} disabled={ocupado || !pintura?.tracos.length} data-ia="apagar">
              Apagar a área pintada
            </Botao>
          )}
          {tarefaIa.fase === 'erro' ? <Aviso tom="erro">{tarefaIa.mensagem}</Aviso> : null}
          <div className="flex flex-wrap gap-1.5">
            <Botao variante="secundario" tamanho="p" icone="desfazer" onClick={desfazerApagar} disabled={!pintura?.tracos.length} data-desfazer-apagar="">
              Desfazer traço (Ctrl+Z)
            </Botao>
            <Botao variante="fantasma" tamanho="p" onClick={limparPintura} disabled={!pintura?.tracos.length}>
              Limpar a pintura
            </Botao>
          </div>
        </Grupo>
      )
    }
    if (ferramenta === 'pincel') {
      return (
        <PainelPincel
          pincel={pincel}
          mudar={(d) => setPincel((x) => ({ ...x, ...d }))}
          camada={camadaSel?.tipo === 'desenho' ? camadaSel : ([...camadas].reverse().find((c) => c.tipo === 'desenho' && c.visivel !== false) ?? null)}
          aoNovaCamada={adicionarDesenho}
        />
      )
    }
    if (ferramenta === 'texto') {
      return (
        <Grupo titulo="Texto">
          <Botao tamanho="g" icone="tipo" onClick={() => adicionarTexto()} data-add-texto="">
            Adicionar texto
          </Botao>
          <p className="text-sm text-suave">Ou clique na imagem onde quer escrever. Clique num texto para editar; arraste para mover; as alças mudam o tamanho e giram.</p>
        </Grupo>
      )
    }
    return null
  }

  const painelCamadas = p ? (
    <PainelCamadas
      camadas={camadas}
      selecionada={selecionada}
      aoSelecionar={setSelecionada}
      aoEditar={editarCamada}
      aoMudar={mudarCamada}
      aoReordenar={reordenar}
      aoAdicionarImagem={() => entradaCamada.current?.click()}
      aoAdicionarTexto={() => adicionarTexto()}
      aoAdicionarDesenho={() => {
        const c = adicionarDesenho()
        escolher('pincel')
        setSelecionada(c.id)
      }}
      base={{ oculta: Boolean(p.baseOculta), bloqueada: baseBloqueada }}
      aoMudarBase={(d) => mudar(d)}
      aoEditarBase={() => {
        setSelecionada(null)
        if (ferramentaDaBase) setEditandoCamada(null)
        else escolher('filtros')
      }}
      modo={painel.modo}
      aoModo={(modo) => setPainel((x) => ({ ...x, modo }))}
      aoArrastarPainel={({ x, y, largura }) => setPainel({ modo: 'flutuante', x: limitar(x, 0, innerWidth - 120), y: limitar(y, 0, innerHeight - 60), largura })}
    />
  ) : null

  /* ─── Tela ─────────────────────────────────────────────────────────── */
  return (
    <div ref={raiz} className={`flex flex-col gap-3 ${p ? 'overflow-y-auto overscroll-contain lg:overflow-hidden' : 'lg:h-[calc(100dvh-5.5rem)] lg:min-h-[34rem]'}`} style={p && altura ? { height: altura } : undefined} data-editor-imagem="">
      {/* Barra do topo */}
      <section aria-label="Imagem" className="cartao flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2.5 sm:px-5">
        <SeloCategoria categoria="imagem" icone="imagem" tamanho="p" />
        <div className="min-w-0 flex-1 basis-40">
          {p ? <NomeEditavel key={p.nome} nome={p.nome} extensao={corBaseDe(p.tipo)} aoMudar={(n) => mudar({ nome: n })} rotulo="Renomear a imagem final" /> : <p className="text-sm font-semibold text-tinta">Nenhuma imagem aberta</p>}
          <p className="text-xs text-fraca tabular-nums">{p ? `${p.w} × ${p.h} px${camadas.length ? ` · ${camadas.length} camada${camadas.length > 1 ? 's' : ''}` : ''}` : 'Escolha uma imagem para começar'}</p>
        </div>
        <input
          ref={entrada}
          type="file"
          accept={EXTENSOES_IMAGEM.map((e) => `.${e}`).join(',')}
          className="sr-only"
          tabIndex={-1}
          aria-label="Escolher imagem"
          onChange={(e) => {
            abrir(e.target.files)
            e.target.value = ''
          }}
        />
        <input
          ref={entradaCamada}
          type="file"
          accept="image/*"
          multiple
          className="sr-only"
          tabIndex={-1}
          aria-label="Adicionar imagem como camada"
          data-entrada-camada=""
          onChange={(e) => {
            adicionarImagens(e.target.files)
            e.target.value = ''
          }}
        />
        <Botao variante="secundario" tamanho="p" icone="arquivoMais" onClick={() => entrada.current?.click()} disabled={ocupado}>
          {p ? 'Abrir outra' : 'Escolher imagem'}
        </Botao>
        {p && painel.modo === 'fechado' ? (
          <Botao variante="secundario" tamanho="p" icone="camadas" onClick={() => setPainel((x) => ({ ...x, modo: 'fixo' }))} data-abrir-camadas="">
            Camadas
          </Botao>
        ) : null}
        <div className="flex items-center gap-0.5">
          <BotaoAcao rotulo="Desfazer (Ctrl+Z)" icone="desfazer" onClick={desfazer} disabled={!podeDesfazer || ocupado} />
          <BotaoAcao rotulo="Refazer (Ctrl+Shift+Z)" icone="refazerAcao" onClick={refazer} disabled={!podeRefazer || ocupado} />
        </div>
        <div className="flex items-center gap-0.5 rounded-lg border border-borda px-0.5" title="Roda do mouse: zoom · H ou Espaço: mão · Ctrl 0: ajustar · Ctrl 1: 100%">
          <BotaoAcao rotulo="Diminuir o zoom (Ctrl −)" icone="zoomMenos" onClick={() => zoomEm(1 / 1.25)} disabled={!p} />
          <label className="relative">
            <span className="sr-only">Zoom</span>
            <select
              value={zoom === 'ajustar' ? 'ajustar' : String(zoom)}
              onChange={(e) => setZoom(e.target.value === 'ajustar' ? 'ajustar' : Number(e.target.value))}
              disabled={!p}
              className="h-8 w-[4.5rem] cursor-pointer appearance-none rounded-md bg-transparent text-center text-xs font-semibold text-suave tabular-nums hover:text-tinta focus:outline-none"
              aria-label="Zoom"
              data-zoom=""
            >
              <option value="ajustar">{zoom === 'ajustar' ? `${zoomPct}%` : 'Ajustar'}</option>
              {zoom !== 'ajustar' && !ZOOMS.includes(zoom) ? <option value={String(zoom)}>{zoomPct}%</option> : null}
              {ZOOMS.filter((z) => z <= maximo).map((z) => (
                <option key={z} value={String(z)}>
                  {Math.round(z * 100)}%
                </option>
              ))}
            </select>
          </label>
          <BotaoAcao rotulo="Aumentar o zoom (Ctrl +)" icone="zoomMais" onClick={() => zoomEm(1.25)} disabled={!p} />
          <button
            type="button"
            aria-pressed={mao}
            onClick={() => setMao((m) => !m)}
            disabled={!p}
            title="Mão (H): arrastar move a imagem também nas ferramentas que desenham ou selecionam. Segurar Espaço faz o mesmo."
            aria-label="Mão (mover a imagem)"
            data-mao=""
            className={`grid size-8 place-items-center rounded-md transition-colors ${mao ? 'bg-marca text-sobre-marca' : 'text-suave hover:bg-superficie-2 hover:text-tinta'}`}
          >
            <Icone nome="mao" tamanho={16} />
          </button>
        </div>
        <Botao icone="baixar" onClick={abrirBaixar} disabled={!p || ocupado}>
          Baixar
        </Botao>
      </section>

      {erro ? (
        <Aviso tom="erro" aoFechar={() => setErro(null)}>
          {erro}
        </Aviso>
      ) : null}

      <div className="grid gap-3 lg:min-h-0 lg:flex-1 lg:grid-cols-[4.75rem_minmax(0,1fr)_20rem]">
        {/* Ferramentas (cabem todas: sem rolagem) */}
        <nav aria-label="Ferramentas" className="cartao flex gap-1 overflow-x-auto p-1.5 [scrollbar-width:none] lg:flex-col lg:overflow-visible [&::-webkit-scrollbar]:hidden">
          {FERRAMENTAS.map((f) => {
            const bloqueada = f.base && baseBloqueada
            return (
              <button
                key={f.id}
                type="button"
                aria-pressed={ferramenta === f.id}
                disabled={!p || ocupado}
                onClick={() => escolher(f.id)}
                title={bloqueada ? 'A imagem de fundo está bloqueada' : (f.dica ?? f.rotulo)}
                className={`flex min-w-16 shrink-0 flex-col items-center gap-0.5 rounded-lg px-1 py-1.5 text-center text-[0.625rem] leading-tight font-semibold transition-colors disabled:opacity-40 lg:min-w-0 ${ferramenta === f.id ? 'bg-marca text-sobre-marca' : 'text-suave hover:bg-superficie-2 hover:text-tinta'} ${bloqueada ? 'opacity-50' : ''}`}
              >
                <Icone nome={bloqueada ? 'bloquear' : f.icone} tamanho={18} />
                {f.rotulo}
              </button>
            )
          })}
        </nav>

        {/* Imagem (soltar uma imagem aqui = nova camada) */}
        <div className="relative flex min-h-0 flex-col" {...(p ? soltura : {})}>
          {soltandoArquivo && p ? (
            <div className="pointer-events-none absolute inset-0 z-50 grid place-items-center rounded-[var(--radius-cartao)] border-2 border-dashed border-acento bg-acento/10" data-soltar-camada="">
              <span className="flex items-center gap-2 rounded-full bg-black/75 px-4 py-2 text-sm font-semibold text-white">
                <Icone nome="imagemMais" tamanho={16} />
                Solte para adicionar como camada
              </span>
            </div>
          ) : null}
          {p && previa ? (
            <Tela
              previa={previa}
              previaAlta={alta}
              w={p.w}
              h={p.h}
              zoom={zoom}
              aoZoom={setZoom}
              aoEscala={setEscalaAtual}
              mao={mao}
              ferramenta={baseBloqueada && ferramentaDaBase ? 'filtros' : ferramenta}
              rascunho={baseBloqueada && ferramentaDaBase ? null : rascunho}
              setRascunho={setRascunho}
              camadas={camadas}
              fontes={fontes}
              desenhos={desenhos.current}
              versaoDesenhos={versaoDesenhos}
              selecionada={selecionada}
              aoSelecionar={aoSelecionarNaTela}
              aoMudarCamada={mudarCamada}
              camadasInterativas={camadasInterativas}
              aoClicarVazio={aoClicarVazio}
              pintura={ferramenta === 'apagar' && !baseBloqueada ? pintura : null}
              aoPintar={aoPintar}
              aoSoltarPintura={aoSoltarPintura}
              pincel={pincelTela}
              pintando={pintando && !mao && !(baseBloqueada && ferramentaDaBase)}
              aoEndireitar={(angulo) => setRascunho((r) => ({ ...r, angulo }))}
              aoFimTamanho={() => concluirRef.current?.()}
              aoEditarCamada={editarCamada}
              aoExcluirCamada={acoesCamada.excluir}
              contaGotas={Boolean(contaGotas)}
              aoContaGotas={aoContaGotas}
              baseOculta={Boolean(p.baseOculta)}
            />
          ) : (
            <label
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault()
                abrir(e.dataTransfer.files)
              }}
              className="flex min-h-[22rem] flex-1 cursor-pointer flex-col items-center justify-center gap-3 rounded-[var(--radius-cartao)] border-2 border-dashed border-borda-forte bg-superficie-2 px-6 text-center hover:border-fraca"
            >
              <input type="file" accept={EXTENSOES_IMAGEM.map((e) => `.${e}`).join(',')} className="sr-only" onChange={(e) => abrir(e.target.files)} />
              <SeloCategoria categoria="imagem" icone="imagem" tamanho="gg" />
              <span className="font-display text-lg font-bold text-tinta">Escolha ou arraste uma imagem</span>
              <span className="max-w-sm text-sm text-suave">{DESCRICAO_IMAGEM} · até 60 MB. Ajuste, recorte, remova o fundo, apague objetos, desenhe, escreva e monte camadas — tudo no seu aparelho.</span>
            </label>
          )}
        </div>

        {/* Direita: opções (da ferramenta ou da camada) em cima, camadas embaixo */}
        <div className="cartao flex min-h-0 flex-col overflow-hidden">
          <aside className="rolagem-fina flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto p-4" aria-label="Opções da ferramenta">
            {camadaEditada ? (
              <>
                <div className="-mb-1 flex items-center gap-2">
                  <button type="button" onClick={() => setEditandoCamada(null)} className="flex items-center gap-1.5 text-xs font-semibold text-suave hover:text-tinta" data-voltar-ferramenta="">
                    <Icone nome="seta" tamanho={14} className="rotate-180" />
                    {NOME_FERRAMENTA[ferramenta]}
                  </button>
                  <span className="ml-auto truncate text-xs font-semibold text-fraca">Camada · {camadaEditada.tipo === 'texto' ? 'texto' : camadaEditada.nome}</span>
                </div>
                {painelDaCamada}
              </>
            ) : (
              painelDaFerramenta()
            )}
            {aplicando ? <p className="text-xs text-fraca">Aplicando…</p> : null}
          </aside>
          {p && painel.modo === 'fixo' ? <div className="flex max-h-[42%] min-h-[8.5rem] shrink-0 flex-col border-t border-borda">{painelCamadas}</div> : null}
        </div>
      </div>

      {/* Camadas soltas: uma janelinha que se arrasta pela tela */}
      {p && painel.modo === 'flutuante' ? (
        <div className="cartao fixed z-[46] flex max-h-[60vh] flex-col overflow-hidden shadow-[var(--shadow-flutuante)]" style={{ left: painel.x ?? 24, top: painel.y ?? 120, width: Math.max(260, Math.min(painel.largura ?? 300, 360)) }}>
          {painelCamadas}
        </div>
      ) : null}

      {/* Baixar: nome, formato, qualidade e o tamanho estimado */}
      <DialogoBaixar
        aberto={Boolean(baixando)}
        aoFechar={() => setBaixando(null)}
        titulo="Baixar a imagem"
        nome={p?.nome ?? 'imagem'}
        extensao={baixando?.formato}
        resumo={
          baixando && p ? (
            <span data-estimativa="">
              {p.w} × {p.h} px · Tamanho estimado: {estimado ? `~${formatarBytes(estimado.size)}` : 'calculando…'}
            </span>
          ) : null
        }
        aoConfirmar={baixarAgora}
      >
        {baixando ? (
          <>
            <OpcoesCartoes
              rotulo="Formato"
              valor={baixando.formato}
              aoMudar={(v) => setBaixando((b) => ({ ...b, formato: v }))}
              colunas="grid-cols-2 sm:grid-cols-4"
              opcoes={[
                { valor: 'png', rotulo: 'PNG', dica: 'Sem perdas, transparência' },
                { valor: 'jpg', rotulo: 'JPG', dica: 'Abre em tudo' },
                { valor: 'webp', rotulo: 'WebP', dica: 'Menor, transparência' },
                { valor: 'avif', rotulo: 'AVIF', dica: 'O menor de todos' },
              ]}
            />
            {baixando.formato === 'png' ? null : <Deslizante rotulo="Qualidade" valor={baixando.qualidade} aoMudar={(v) => setBaixando((b) => ({ ...b, qualidade: v }))} min={10} max={100} formatar={(v) => `${v}%`} />}
            {baixando.formato === 'jpg' ? <CorDeFundo valor={baixando.fundo} aoMudar={(v) => setBaixando((b) => ({ ...b, fundo: v }))} /> : null}
            <p className="text-xs text-fraca">Ao salvar, os metadados (EXIF, GPS) saem junto.</p>
          </>
        ) : null}
      </DialogoBaixar>
    </div>
  )
}
