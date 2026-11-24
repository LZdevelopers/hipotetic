import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { BotaoAcao, useHistorico } from '../../componentes/editor/Comum'
import { DialogoBaixar, NomeEditavel, OpcoesCartoes } from '../../componentes/ferramenta/Baixar'
import { Icone } from '../../componentes/Icone'
import { Aviso, Botao, Caixa, Deslizante, Entrada, Progresso, SeloCategoria, Seletor } from '../../componentes/ui'
import { DESCRICAO_IMAGEM, EXTENSOES_IMAGEM, LIMITE_IMAGEM, ehSvg, rasterizarSvg } from '../../motores/imagem'
import { NEUTRO, renderizarAjustes } from '../../motores/imagem/ajustes'
import { PADRAO_FUNDO, comporFundo, desenharTraco, mascaraCheia, mascaraRetocada, mostrarRemovido, refinarMascara } from '../../motores/imagem/fundo'
import { apagarObjeto, mascaraDoFundo, prepararModelo } from '../../motores/imagem/ia'
import { codificar } from '../../motores/imagem/nucleo'
import { baixarBlob, extensaoDe, formatarBytes, semExtensao } from '../../nucleo/arquivos'
import { useEmEdicao } from '../../nucleo/edicao'
import { useSalvo } from '../../nucleo/salvo'
import { useTarefa } from '../../nucleo/tarefa'
import { CorDeFundo } from './_comum'
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
import { Acoes, BotaoSegmentar, Escolhas, Grupo, ListaCamadas, PainelAjustes, PainelCamada, PainelFiltros, PainelFundo, PainelPincel, ajustesDoFiltro } from './_editor/paineis'
import { PADRAO_PINCEL, iniciarTraco } from './_editor/pinceis'
import { Tela, ZOOM_MINIMO, zoomMaximo } from './_editor/Tela'

/*
 * Editor de imagem (tela cheia, no jeito do Photopea, uma imagem por vez):
 *   - Ajustes e Filtros (com prévia de cada filtro na própria foto);
 *   - Recortar, Tamanho (prévia em escala), Girar/endireitar (linha + grade);
 *   - Remover fundo (máscara: seleção de assunto, varinha, pincéis) e Apagar objeto;
 *   - Pincéis (camada de desenho própria), Texto e Camadas de imagem — as
 *     mesmas camadas do editor de vídeo.
 * Zoom até 3200% e mão (arrastar). O projeto fica salvo no navegador e tem
 * desfazer/refazer. Baixar mostra o tamanho estimado do arquivo.
 */

const FERRAMENTAS = [
  { id: 'ajustes', rotulo: 'Ajustes', icone: 'ajustar' },
  { id: 'filtros', rotulo: 'Filtros', icone: 'paleta' },
  { id: 'recortar', rotulo: 'Recortar', icone: 'recortar' },
  { id: 'tamanho', rotulo: 'Tamanho', icone: 'regua' },
  { id: 'girar', rotulo: 'Girar', icone: 'girar' },
  { id: 'fundo', rotulo: 'Remover fundo', icone: 'borracha' },
  { id: 'apagar', rotulo: 'Apagar objeto', icone: 'magica' },
  { id: 'pincel', rotulo: 'Pincel', icone: 'caneta' },
  { id: 'texto', rotulo: 'Texto', icone: 'tipo' },
  { id: 'camadas', rotulo: 'Camadas', icone: 'camadas' },
]
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
/** Ferramentas em que as camadas podem ser selecionadas e arrastadas. */
const COM_CAMADAS = ['texto', 'camadas']

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

const corBaseDe = (formato) => (formato === 'jpg' ? 'jpg' : formato)

export default function EditorImagem() {
  const [p, setP] = useSalvo('projeto', null) // { nome, base: Blob, w, h, ajustes, filtro, camadas, tipo, fundoRemovido, fundoEdicao }
  useEmEdicao(Boolean(p))
  const historico = useHistorico(p, setP, Boolean(p))
  const [bitmap, setBitmap] = useState(null)
  const [previa, setPrevia] = useState(null)
  const [previaAlta, setPreviaAlta] = useState(null) // { canvas, versao }
  const [versaoPrevia, setVersaoPrevia] = useState(0)
  const [ferramenta, setFerramenta] = useState('ajustes')
  const [rascunho, setRascunho] = useState(null)
  const [selecionada, setSelecionada] = useState(null)
  const [focarTexto, setFocarTexto] = useState(null)
  const [zoom, setZoom] = useState('ajustar')
  const [escalaAtual, setEscalaAtual] = useState(1)
  const [mao, setMao] = useState(false)
  const [pincel, setPincel] = useState(PADRAO_PINCEL)
  const [tamanhoApagar, setTamanhoApagar] = useState(40)
  const [pintura, setPintura] = useState(null) // máscara do "apagar objeto": { canvas, ctx, sujo, ouvir }
  const [baixando, setBaixando] = useState(null)
  const [estimativa, setEstimativa] = useState(null)
  const [erro, setErro] = useState(null)
  const [aplicando, setAplicando] = useState(false)
  const tarefaIa = useTarefa()
  const ultimaMascara = useRef(null) // { base, mascara, opcoes }: trocar de ferramenta não perde a máscara
  const entrada = useRef(null)
  const entradaCamada = useRef(null)

  const mudar = useCallback((d) => setP((x) => (x ? { ...x, ...(typeof d === 'function' ? d(x) : d) } : x)), [setP])
  const camadas = useMemo(() => p?.camadas ?? [], [p?.camadas])

  // Projeto salvo pela versão antiga (textos soltos) → camadas.
  useEffect(() => {
    if (p && !p.camadas) setP(migrar(p))
  }, [p, setP])

  /* ─── Base → bitmap → prévia ───────────────────────────────────────── */
  useEffect(() => {
    if (!p?.base) {
      setBitmap(null)
      return undefined
    }
    let vivo = true
    createImageBitmap(p.base).then((b) => vivo && setBitmap(b))
    return () => {
      vivo = false
    }
  }, [p?.base])
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

  /* ─── Remover fundo: máscara (automática e/ou à mão) ───────────────── */
  const mascaraFundo = ferramenta === 'fundo' ? rascunho?.mascara : null
  const mascaraRefinada = useMemo(
    () => (mascaraFundo ? refinarMascara(mascaraFundo, { contorno: rascunho.contorno, limpar: rascunho.limpar }) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mascaraFundo, rascunho?.contorno, rascunho?.limpar],
  )
  const retoque = useRef(null) // { refinada, tracos, fonte, canvas }
  const tracoAtual = useRef(null)
  const [versaoRetoque, setVersaoRetoque] = useState(0)
  const mascaraFinal = () => {
    if (!mascaraRefinada || !p) return null
    const tracos = rascunho?.tracos ?? []
    const r = retoque.current
    if (!r || r.refinada !== mascaraRefinada || r.tracos !== tracos || r.fonte !== bitmap) {
      retoque.current = { refinada: mascaraRefinada, tracos, fonte: bitmap, canvas: mascaraRetocada(mascaraRefinada, tracos, p.w, p.h, bitmap) }
    }
    return retoque.current.canvas
  }
  const [imagemFundo, setImagemFundo] = useState(null)
  const blobFundo = ferramenta === 'fundo' ? rascunho?.imagem : null
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

  /** O que a tela mostra da base (com máscara/fundo e ajustes) a partir de `fonte`. */
  const comporPrevia = (fonte) => {
    const m = mascaraFinal()
    let f = fonte
    if (m) {
      f = comporFundo(fonte, m, rascunho, imagemFundo)
      if (rascunho.pincel) mostrarRemovido(f, fonte, m)
    }
    return renderizarAjustes(f, p?.ajustes ?? NEUTRO)
  }
  const depsPrevia = [versaoReduzida, p?.ajustes, mascaraRefinada, rascunho?.borda, rascunho?.fundo, rascunho?.cor, rascunho?.desfoque, rascunho?.tracos, rascunho?.pincel, versaoRetoque, imagemFundo, rascunho?.desfoqueImagem]
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
  const adicionarCamada = (c) => {
    mudar((x) => ({ camadas: [...(x.camadas ?? []), c] }))
    setSelecionada(c.id)
  }
  const adicionarTexto = (x, y) => {
    const c = novaCamadaTexto(x ?? 0.25, y ?? 0.45)
    adicionarCamada(c)
    setFocarTexto(c.id)
  }
  const adicionarDesenho = () => {
    const c = novaCamadaDesenho(camadas.filter((x) => x.tipo === 'desenho').length + 1)
    desenhos.current.set(c.id, { canvas: canvasDesenho(p.w, p.h), arquivo: null })
    adicionarCamada(c)
    return c
  }
  const adicionarImagens = async (lista) => {
    for (const a of [...(lista ?? [])]) {
      try {
        const b = await bitmapDe(a)
        adicionarCamada(novaCamadaImagem(a, b.width, b.height, p.w, p.h, semExtensao(a.name) || 'Imagem'))
      } catch {
        setErro('Não foi possível abrir essa imagem.')
      }
    }
    if (ferramenta !== 'camadas') setFerramenta('camadas')
  }
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
      const copia = { ...c, id: novaId(), nome: `${c.nome} (cópia)`, ...(c.tipo === 'desenho' ? {} : { x: c.x + 0.02, y: c.y + 0.02 }) }
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
    },
    excluir: (id) => {
      mudar((x) => ({ camadas: x.camadas.filter((c) => c.id !== id) }))
      setSelecionada(null)
    },
    limparDesenho: (id) => {
      const e = desenhos.current.get(id)
      e?.canvas.getContext('2d').clearRect(0, 0, e.canvas.width, e.canvas.height)
      if (e) e.arquivo = null
      mudarCamada(id, { arquivo: null })
    },
    centroVertical: () => {
      const c = camadas.find((x) => x.id === selecionada)
      if (c) mudarCamada(c.id, { y: 0.5 - alturaCamada(c, p.w, p.h) / p.h / 2 })
    },
    // Imagem: caber, cobrir ou tamanho original (mantendo a proporção da imagem recortada).
    ...Object.fromEntries(
      [
        ['ajustarTela', 'caber'],
        ['cobrirTela', 'cobrir'],
        ['tamanhoOriginal', 'original'],
      ].map(([nome, modo]) => [
        nome,
        async () => {
          const c = camadas.find((x) => x.id === selecionada)
          if (!c?.arquivo) return
          const b = await bitmapDe(c.arquivo)
          const r = c.recorte ?? { w: 1, h: 1 }
          const iw = b.width * r.w
          const ih = b.height * r.h
          const k = modo === 'original' ? 1 : modo === 'caber' ? Math.min(p.w / iw, p.h / ih) : Math.max(p.w / iw, p.h / ih)
          const w = (iw * k) / p.w
          const h = (ih * k) / p.h
          mudarCamada(c.id, { w, h, x: (1 - w) / 2, y: (1 - h) / 2, girar: 0 })
        },
      ]),
    ),
  }
  const camadaSel = camadas.find((c) => c.id === selecionada) ?? null

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
      setFerramenta('ajustes')
      setRascunho(null)
      setPintura(null)
      setSelecionada(null)
      setZoom('ajustar')
      ultimaMascara.current = null
      desenhos.current.clear()
      const ext = extensaoDe(a.name)
      setP({ nome: `${semExtensao(a.name)}-editada`, base, w: c.width, h: c.height, ajustes: NEUTRO, filtro: null, camadas: [], tipo: ['jpg', 'jpeg'].includes(ext) ? 'jpg' : ['png', 'webp', 'avif'].includes(ext) ? ext : 'png' })
    } catch (e) {
      console.error(e)
      setErro('Não foi possível abrir essa imagem.')
    }
  }

  /** Troca só a imagem-base (mesmo tamanho), como no remover fundo e no apagar objeto. */
  const comprometer = async (novo, extra) => {
    setAplicando(true)
    try {
      const base = await novo.convertToBlob({ type: 'image/png' })
      mudar((x) => ({ base, w: novo.width, h: novo.height, fundoEdicao: undefined, ...extra?.(x) }))
    } finally {
      setAplicando(false)
    }
  }

  /** Geometria (recortar, tamanho, girar…): base, camadas e desenhos juntos, num passo só. */
  const aplicarGeometria = async (g, extra) => {
    if (!bitmap) return
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
      const base = await transformarBase(bitmap, g).convertToBlob({ type: 'image/png' })
      mudar((x) => ({ base, w: g.W2, h: g.H2, camadas: novas, fundoEdicao: undefined, ...extra?.(x) }))
      setVersaoDesenhos((v) => v + 1)
    } finally {
      setAplicando(false)
    }
  }

  /* ─── Ferramentas ──────────────────────────────────────────────────── */
  const novaPintura = (w, h) => {
    const c = canvas(w, h)
    return { canvas: c, ctx: c.getContext('2d'), sujo: false, ouvir: null }
  }
  const rascunhoInicial = (id) => {
    if (id === 'recortar') return { x: 0, y: 0, w: p.w, h: p.h, proporcao: null, prop: 'livre' }
    if (id === 'tamanho') return { w: p.w, h: p.h, trava: true }
    if (id === 'girar') return { angulo: 0, bordas: 'recortar' }
    return null
  }
  const escolher = (id) => {
    setFerramenta(id)
    setMao(false)
    if (!COM_CAMADAS.includes(id)) setSelecionada(null)
    if (!p) return
    setRascunho(rascunhoInicial(id))
    setPintura(id === 'apagar' ? novaPintura(p.w, p.h) : null)
  }
  // Mudou o tamanho da imagem (aplicou, desfez…): a máscara do apagar acompanha.
  useEffect(() => {
    if (p && pintura && (pintura.canvas.width !== p.w || pintura.canvas.height !== p.h)) setPintura(novaPintura(p.w, p.h))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p?.w, p?.h])

  const aplicarRecorte = () => {
    const r = rascunho
    aplicarGeometria(GEOMETRIA.recorte(r))
    setRascunho(null)
    setFerramenta('ajustes')
  }
  const aplicarTamanho = (nw = rascunho.w, nh = rascunho.h, cobrir = false) => {
    const trava = rascunho?.trava ?? true
    aplicarGeometria(cobrir ? GEOMETRIA.cobrir(p.w, p.h, nw, nh) : GEOMETRIA.esticar(p.w, p.h, nw, nh)).then(() => setRascunho({ w: Math.round(nw), h: Math.round(nh), trava }))
  }
  const girar90 = (sentido) => aplicarGeometria(GEOMETRIA.girar90(p.w, p.h, sentido))
  const espelhar = (horizontal) => aplicarGeometria(GEOMETRIA.espelhar(p.w, p.h, horizontal))
  const aplicarEndireitar = () => {
    const ang = rascunho?.angulo ?? 0
    if (!ang) return
    const expandir = rascunho.bordas === 'expandir'
    const { w: W2, h: H2 } = expandir ? caixaGirada(p.w, p.h, ang) : maiorDentroGirado(p.w, p.h, ang)
    aplicarGeometria(GEOMETRIA.endireitar(p.w, p.h, ang, W2, H2), (x) => (expandir && x.tipo === 'jpg' ? { tipo: 'png' } : {})).then(() => setRascunho({ angulo: 0, bordas: rascunho.bordas }))
  }

  /* Remover fundo */
  const mascaraNova = () => ({ ...PADRAO_FUNDO, mascara: mascaraCheia(), manual: true })
  const executarIa = (tipo) =>
    tarefaIa.executar(
      async ({ progresso, sinal }) => {
        if (tipo === 'fundo') {
          const mascara = await mascaraDoFundo(bitmap, { modo: 'fundo', progresso, sinal })
          setRascunho((x) => ({ ...(x ?? PADRAO_FUNDO), mascara, automatico: true, manual: false }))
          return true
        }
        const r = await apagarObjeto(bitmap, pintura.canvas, { progresso, sinal })
        await comprometer(r)
        pintura.ctx.clearRect(0, 0, pintura.canvas.width, pintura.canvas.height)
        pintura.sujo = false
        pintura.ouvir?.()
        return true
      },
      tipo === 'fundo' ? 'Segmentando' : 'Preenchendo',
    )
  /** Grava a máscara na imagem. Depois disso: "Editar o fundo" ou desfazer. */
  const aplicarFundo = async () => {
    const r = rascunho
    const final = comporFundo(bitmap, mascaraFinal(), r, imagemFundo)
    const { mascara, ...resto } = r
    const opcoes = { ...resto, pincel: null }
    setRascunho(null)
    const blobMascara = await paraBlob(mascara)
    const transparente = r.fundo === 'transparente' || (r.fundo === 'imagem' && !imagemFundo)
    comprometer(final, (x) => ({
      fundoRemovido: true,
      tipo: transparente && x.tipo === 'jpg' ? 'png' : x.tipo,
      fundoEdicao: { original: x.base, w: x.w, h: x.h, mascara: blobMascara, opcoes },
    }))
  }
  const editarFundo = async () => {
    const f = p?.fundoEdicao
    if (!f) return
    const mascara = await createImageBitmap(f.mascara)
    ultimaMascara.current = { base: f.original, mascara, opcoes: f.opcoes }
    mudar({ base: f.original, w: f.w, h: f.h, fundoRemovido: false, fundoEdicao: undefined })
  }
  const descartarFundo = () => {
    ultimaMascara.current = null
    setRascunho(mascaraNova())
  }
  // Na ferramenta: a máscara em andamento (ou uma nova, com tudo) — e lembrada ao trocar de ferramenta.
  useEffect(() => {
    if (ferramenta !== 'fundo' || !p || p.fundoRemovido) {
      if (ferramenta === 'fundo' && rascunho?.mascara) setRascunho(null)
      return
    }
    if (rascunho?.mascara) return
    const salva = ultimaMascara.current
    setRascunho(salva && salva.base === p.base ? { ...PADRAO_FUNDO, ...salva.opcoes, mascara: salva.mascara, pincel: null } : mascaraNova())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ferramenta, p?.base, p?.fundoRemovido, rascunho?.mascara])
  useEffect(() => {
    if (ferramenta !== 'fundo' || !rascunho?.mascara || !p) return
    const { mascara, ...opcoes } = rascunho
    ultimaMascara.current = { base: p.base, mascara, opcoes }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rascunho])
  // Deixa o modelo pronto em segundo plano ao abrir a ferramenta (se já foi baixado).
  useEffect(() => {
    if (!p || tarefaIa.fase === 'processando') return
    if (ferramenta === 'fundo' && !p.fundoRemovido && !rascunho?.automatico) prepararModelo('fundo')
    else if (ferramenta === 'apagar') prepararModelo('apagar')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ferramenta, Boolean(p)])

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
    if (!m || !rascunho?.pincel) return
    const ponto = [Math.round(x * 10) / 10, Math.round(y * 10) / 10]
    if (rascunho.pincel === 'varinha') {
      if (!comeco) return
      tracoAtual.current = { modo: 'varinha', acao: rascunho.varinhaAcao, tolerancia: rascunho.tolerancia, contiguo: rascunho.contiguo, pontos: [ponto] }
      desenharTraco(m.getContext('2d'), tracoAtual.current, m.width / p.w, 0, bitmap)
    } else {
      if (comeco) tracoAtual.current = { modo: rascunho.pincel, tamanho: rascunho.tamanhoPincel ?? pincelFundoPadrao, pontos: [] }
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
    const tracos = [...(rascunho?.tracos ?? []), t]
    if (retoque.current) retoque.current.tracos = tracos
    setRascunho((x) => (x?.mascara ? { ...x, tracos } : x))
  }
  const desfazerTraco = () => setRascunho((x) => (x?.tracos?.length ? { ...x, tracos: x.tracos.slice(0, -1) } : x))

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
    if (!tr || tr.t.vazio()) return
    tr.t.compor()
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
    // Apagar objeto: máscara vermelha.
    const ctx = pintura.ctx
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.lineWidth = tamanhoApagar
    ctx.strokeStyle = '#ff2d55'
    if (comeco) {
      ctx.beginPath()
      ctx.moveTo(pt.x, pt.y)
      ctx.lineTo(pt.x + 0.01, pt.y)
    } else ctx.lineTo(pt.x, pt.y)
    ctx.stroke()
    pintura.sujo = true
    pintura.ouvir?.()
  }
  const aoSoltarPintura = () => {
    if (ferramenta === 'fundo') return soltarRetoque()
    if (ferramenta === 'pincel') return soltarDesenho()
  }

  /* Texto: clicar no vazio cria (ou, com um texto selecionado, só tira a seleção) */
  const aoClicarVazio = ({ x, y }) => {
    if (ferramenta !== 'texto') return
    if (camadaSel?.tipo === 'texto') {
      setSelecionada(null)
      return
    }
    adicionarTexto(limitar(x / p.w - 0.25, 0, 0.75), limitar(y / p.h - 0.05, 0, 0.9))
  }

  /* ─── Baixar ───────────────────────────────────────────────────────── */
  const contadorDoc = useRef(0)
  const versaoDoc = useMemo(() => (contadorDoc.current += 1), [p]) // muda a cada mudança no projeto
  const chaveEstimativa = baixando ? JSON.stringify([baixando.formato, baixando.qualidade, baixando.fundo, versaoDoc]) : null
  const final = () => renderizarDocumento({ base: bitmap, ajustes: p.ajustes, camadas, W: p.w, H: p.h, desenhos: desenhos.current })
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
  const baixarAgora = async (nome) => {
    const s = baixando
    const chave = chaveEstimativa
    setBaixando(null)
    mudar({ nome })
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
        if (ferramenta === 'fundo' && rascunho?.tracos?.length) desfazerTraco()
        else historico.desfazer()
      } else if ((k === 'z' && e.shiftKey) || k === 'y') {
        e.preventDefault()
        historico.refazer()
      } else if (p && (k === '=' || k === '+' || k === '-' || k === '0' || k === '1')) {
        e.preventDefault()
        if (k === '0') setZoom('ajustar')
        else if (k === '1') setZoom(1)
        else zoomEm(k === '-' ? 1 / 1.25 : 1.25)
      }
      return
    }
    if (digitando) return
    if (e.key === 'h' || e.key === 'H') setMao((m) => !m)
    else if (selecionada && COM_CAMADAS.includes(ferramenta) && (e.key === 'Delete' || e.key === 'Backspace')) acoesCamada.excluir(selecionada)
    else if (selecionada && COM_CAMADAS.includes(ferramenta) && e.key.startsWith('Arrow') && camadaSel?.tipo !== 'desenho') {
      e.preventDefault()
      const passo = (e.shiftKey ? 10 : 1) / Math.max(p.w, p.h)
      const d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key]
      mudarCamada(selecionada, { x: camadaSel.x + (d[0] * passo * Math.max(p.w, p.h)) / p.w, y: camadaSel.y + (d[1] * passo * Math.max(p.w, p.h)) / p.h })
    } else if (e.key === 'Escape') setSelecionada(null)
    else if (e.key === 'Enter' && ferramenta === 'recortar' && rascunho) aplicarRecorte()
  }
  useEffect(() => {
    const f = (e) => teclas.current(e)
    addEventListener('keydown', f)
    return () => removeEventListener('keydown', f)
  }, [])

  const ocupado = aplicando || tarefaIa.fase === 'processando'
  const estimado = estimativa && estimativa.chave === chaveEstimativa ? estimativa.blob : null
  const pintando = ferramenta === 'apagar' || ferramenta === 'pincel' || (ferramenta === 'fundo' && Boolean(rascunho?.pincel && rascunho?.mascara))
  const pincelTela = ferramenta === 'apagar' ? { tamanho: tamanhoApagar } : ferramenta === 'pincel' ? { tamanho: pincel.tamanho } : ferramenta === 'fundo' && rascunho?.pincel ? { tamanho: rascunho.pincel === 'varinha' ? 0 : (rascunho.tamanhoPincel ?? pincelFundoPadrao) } : null
  const zoomPct = Math.round(escalaAtual * 100)

  /* ─── Tela ─────────────────────────────────────────────────────────── */
  return (
    <div className="flex flex-col gap-3 lg:h-[calc(100dvh-5.5rem)] lg:min-h-[34rem]">
      {/* Barra do topo */}
      <section aria-label="Imagem" className="cartao flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 sm:px-5">
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
        <div className="flex items-center gap-0.5">
          <BotaoAcao rotulo="Desfazer (Ctrl+Z)" icone="desfazer" onClick={historico.desfazer} disabled={!historico.podeDesfazer || ocupado} />
          <BotaoAcao rotulo="Refazer (Ctrl+Shift+Z)" icone="refazerAcao" onClick={historico.refazer} disabled={!historico.podeRefazer || ocupado} />
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
            title="Mão: arraste para mover a imagem (H)"
            aria-label="Mão (mover a imagem)"
            data-mao=""
            className={`grid size-8 place-items-center rounded-md text-base transition-colors ${mao ? 'bg-marca text-sobre-marca' : 'text-suave hover:bg-superficie-2 hover:text-tinta'}`}
          >
            ✋
          </button>
        </div>
        <Botao icone="baixar" onClick={() => setBaixando({ formato: p.tipo, qualidade: 90, fundo: '#ffffff' })} disabled={!p || ocupado}>
          Baixar
        </Botao>
      </section>

      {erro ? (
        <Aviso tom="erro" aoFechar={() => setErro(null)}>
          {erro}
        </Aviso>
      ) : null}

      <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-[4.75rem_minmax(0,1fr)_20rem]">
        {/* Ferramentas */}
        <nav aria-label="Ferramentas" className="cartao rolagem-fina flex gap-1 overflow-x-auto p-1.5 lg:flex-col lg:overflow-y-auto">
          {FERRAMENTAS.map((f) => (
            <button
              key={f.id}
              type="button"
              aria-pressed={ferramenta === f.id}
              disabled={!p || ocupado}
              onClick={() => escolher(f.id)}
              className={`flex min-w-16 shrink-0 flex-col items-center gap-0.5 rounded-lg px-1 py-1.5 text-[0.625rem] leading-tight font-semibold transition-colors disabled:opacity-40 ${ferramenta === f.id ? 'bg-marca text-sobre-marca' : 'text-suave hover:bg-superficie-2 hover:text-tinta'}`}
            >
              <Icone nome={f.icone} tamanho={18} />
              {f.rotulo}
            </button>
          ))}
        </nav>

        {/* Imagem */}
        <div className="flex min-h-0 flex-col">
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
              ferramenta={ferramenta}
              rascunho={rascunho}
              setRascunho={setRascunho}
              camadas={camadas}
              fontes={fontes}
              desenhos={desenhos.current}
              versaoDesenhos={versaoDesenhos}
              selecionada={selecionada}
              aoSelecionar={setSelecionada}
              aoMudarCamada={mudarCamada}
              camadasInterativas={COM_CAMADAS.includes(ferramenta) && !mao}
              aoClicarVazio={aoClicarVazio}
              pintura={ferramenta === 'apagar' ? pintura : null}
              aoPintar={aoPintar}
              aoSoltarPintura={aoSoltarPintura}
              pincel={pincelTela}
              pintando={pintando && !mao}
              aoEndireitar={(angulo) => setRascunho((r) => ({ ...r, angulo }))}
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

        {/* Opções da ferramenta */}
        <aside className="cartao rolagem-fina flex min-h-0 flex-col gap-5 overflow-y-auto p-4" aria-label="Opções da ferramenta">
          {!p ? (
            <p className="text-sm text-suave">Abra uma imagem para ver as opções.</p>
          ) : ferramenta === 'ajustes' ? (
            <PainelAjustes a={p.ajustes} mudar={(a) => mudar({ ajustes: a, filtro: null })} />
          ) : ferramenta === 'filtros' ? (
            <PainelFiltros reduzida={reduzida.current} versao={versaoReduzida} filtro={p.filtro} aoEscolher={(id, k) => mudar({ ajustes: ajustesDoFiltro(id, k), filtro: id === 'original' ? null : { id, k } })} />
          ) : ferramenta === 'recortar' && rascunho ? (
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
                Arraste as alças ou a área para escolher o que fica. {Math.round(rascunho.w)} × {Math.round(rascunho.h)} px
              </p>
              <Acoes rotulo="Aplicar recorte" aplicar={aplicarRecorte} cancelar={() => setRascunho(rascunhoInicial('recortar'))} desativado={Math.round(rascunho.w) === p.w && Math.round(rascunho.h) === p.h} />
            </>
          ) : ferramenta === 'tamanho' && rascunho ? (
            <>
              <Grupo titulo="Largura e altura">
                <div className="grid grid-cols-2 gap-3">
                  <Entrada
                    rotulo="Largura"
                    type="number"
                    min="1"
                    sufixo="px"
                    valor={String(rascunho.w)}
                    aoMudar={(v) => {
                      const nw = Math.max(1, Math.round(Number(v) || 1))
                      setRascunho((r) => ({ ...r, w: nw, h: r.trava ? Math.max(1, Math.round((nw * p.h) / p.w)) : r.h }))
                    }}
                  />
                  <Entrada
                    rotulo="Altura"
                    type="number"
                    min="1"
                    sufixo="px"
                    valor={String(rascunho.h)}
                    aoMudar={(v) => {
                      const nh = Math.max(1, Math.round(Number(v) || 1))
                      setRascunho((r) => ({ ...r, h: nh, w: r.trava ? Math.max(1, Math.round((nh * p.w) / p.h)) : r.w }))
                    }}
                  />
                </div>
                <Caixa rotulo="Manter a proporção" marcado={rascunho.trava} aoMudar={(v) => setRascunho((r) => ({ ...r, trava: v, h: v ? Math.round((r.w * p.h) / p.w) : r.h }))} />
                <p className="text-xs text-fraca">A prévia mostra o tamanho novo na mesma escala do atual (o tracejado). Desmarque a proporção e arraste as alças para esticar ou achatar.</p>
                <div className="flex flex-wrap gap-1.5">
                  {[25, 50, 75, 150, 200].map((pc) => (
                    <button key={pc} type="button" onClick={() => setRascunho((r) => ({ ...r, w: Math.round((p.w * pc) / 100), h: Math.round((p.h * pc) / 100) }))} className="h-8 rounded-lg border border-borda px-2.5 text-xs font-semibold text-suave tabular-nums hover:text-tinta">
                      {pc}%
                    </button>
                  ))}
                </div>
              </Grupo>
              <Acoes rotulo="Aplicar tamanho" aplicar={() => aplicarTamanho()} cancelar={() => setRascunho({ w: p.w, h: p.h, trava: true })} desativado={rascunho.w === p.w && rascunho.h === p.h} />
              <Grupo titulo="Tamanho de rede social">
                <Seletor
                  valor=""
                  aoMudar={(id) => {
                    const r = REDES.find((x) => x.id === id)
                    if (r) aplicarTamanho(r.w, r.h, true)
                  }}
                  opcoes={[{ valor: '', rotulo: 'Escolha para aplicar…' }, ...REDES.map((r) => ({ valor: r.id, rotulo: `${r.nome} · ${r.w}×${r.h}` }))]}
                />
                <p className="text-xs text-fraca">Corta as sobras para caber no formato, sem esticar.</p>
              </Grupo>
            </>
          ) : ferramenta === 'girar' && rascunho ? (
            <>
              <Grupo titulo="Girar e espelhar">
                <div className="grid grid-cols-2 gap-2">
                  <Botao variante="secundario" icone="girar" className="[&>svg]:-scale-x-100" onClick={() => girar90(-1)} disabled={ocupado}>
                    Anti-horário
                  </Botao>
                  <Botao variante="secundario" icone="girar" onClick={() => girar90(1)} disabled={ocupado}>
                    Horário
                  </Botao>
                  <Botao variante="secundario" icone="espelhar" onClick={() => espelhar(true)} disabled={ocupado}>
                    Espelhar ↔
                  </Botao>
                  <Botao variante="secundario" icone="espelhar" className="[&>svg]:rotate-90" onClick={() => espelhar(false)} disabled={ocupado}>
                    Espelhar ↕
                  </Botao>
                </div>
              </Grupo>
              <Grupo titulo="Endireitar">
                <p className="text-sm text-suave">Desenhe uma linha na imagem por cima de algo que deveria estar reto (horizonte, parede, poste): ela gira para alinhar. Ou ajuste o ângulo.</p>
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
                <p className="text-xs text-fraca">{rascunho.bordas === 'expandir' ? 'Mantém a imagem inteira; os cantos ficam transparentes.' : 'Corta o necessário para a imagem continuar retangular (a área clara).'}</p>
                <Acoes rotulo="Aplicar" aplicar={aplicarEndireitar} cancelar={() => setRascunho((r) => ({ ...r, angulo: 0 }))} desativado={!rascunho.angulo || ocupado} />
              </Grupo>
            </>
          ) : ferramenta === 'fundo' && p.fundoRemovido ? (
            <Grupo titulo="Remover fundo">
              <p className="rounded-lg border border-borda bg-superficie-2 p-3 text-sm text-suave" data-fundo-removido="">
                A máscara já foi aplicada nesta imagem.
              </p>
              {p.fundoEdicao ? (
                <>
                  <Botao tamanho="g" icone="ajustar" onClick={editarFundo} disabled={ocupado} data-editar-fundo="">
                    Editar o fundo
                  </Botao>
                  <p className="text-xs text-fraca">Volta à máscara com as opções e os retoques que você deixou, para mudar o que quiser.</p>
                </>
              ) : (
                <p className="text-xs text-fraca">Você mexeu na imagem depois (recorte, tamanho, apagar…). Para editar o fundo, desfaça até antes disso (Ctrl+Z).</p>
              )}
            </Grupo>
          ) : ferramenta === 'fundo' && rascunho?.mascara ? (
            <PainelFundo
              r={rascunho}
              mudar={(d) => setRascunho((x) => ({ ...x, ...d }))}
              aplicar={aplicarFundo}
              descartar={descartarFundo}
              desfazerTraco={desfazerTraco}
              tamanhoPadrao={pincelFundoPadrao}
              tamanhoMax={Math.max(20, Math.round(Math.max(p.w, p.h) / 4))}
              carregandoImagem={Boolean(rascunho.imagem) && !imagemFundo}
              desativado={ocupado}
              segmentar={<BotaoSegmentar tarefa={tarefaIa} aoClicar={() => executarIa('fundo')} desativado={ocupado} feito={Boolean(rascunho.automatico)} />}
            />
          ) : ferramenta === 'apagar' ? (
            <Grupo titulo="Apagar objeto">
              <p className="text-sm text-suave">Pinte por cima do que quer apagar (pessoa, texto, sujeira…) e clique em Preencher. O preenchimento sensível ao conteúdo (inpainting) reconstrói o que estaria atrás.</p>
              <Deslizante rotulo="Tamanho do pincel" valor={tamanhoApagar} aoMudar={setTamanhoApagar} min={4} max={300} formatar={(v) => `${v} px`} />
              {tarefaIa.fase === 'processando' ? (
                <Progresso valor={tarefaIa.progresso} rotulo={tarefaIa.rotulo} aoCancelar={tarefaIa.cancelar} />
              ) : (
                <Botao tamanho="g" icone="magica" onClick={() => executarIa('apagar')} disabled={ocupado} data-ia="apagar">
                  Preencher a área pintada
                </Botao>
              )}
              {tarefaIa.fase === 'erro' ? <Aviso tom="erro">{tarefaIa.mensagem}</Aviso> : null}
              <Botao
                variante="fantasma"
                tamanho="p"
                className="self-start"
                onClick={() => {
                  if (!pintura) return
                  pintura.ctx.clearRect(0, 0, pintura.canvas.width, pintura.canvas.height)
                  pintura.sujo = false
                  pintura.ouvir?.()
                }}
              >
                Limpar a pintura
              </Botao>
            </Grupo>
          ) : ferramenta === 'pincel' ? (
            <PainelPincel
              pincel={pincel}
              mudar={(d) => setPincel((x) => ({ ...x, ...d }))}
              camada={camadaSel?.tipo === 'desenho' ? camadaSel : ([...camadas].reverse().find((c) => c.tipo === 'desenho' && c.visivel !== false) ?? null)}
              aoNovaCamada={adicionarDesenho}
            />
          ) : ferramenta === 'texto' ? (
            camadaSel?.tipo === 'texto' ? (
              <PainelCamada camada={camadaSel} mudar={mudarCamada} acoes={acoesCamada} focarTexto={focarTexto === camadaSel.id} />
            ) : (
              <Grupo titulo="Texto">
                <Botao tamanho="g" icone="tipo" onClick={() => adicionarTexto()} data-add-texto="">
                  Adicionar texto
                </Botao>
                <p className="text-sm text-suave">Ou clique na imagem onde quer escrever. Clique num texto para editar; arraste para mover; as alças mudam o tamanho e giram.</p>
              </Grupo>
            )
          ) : ferramenta === 'camadas' ? (
            <>
              <ListaCamadas
                camadas={camadas}
                selecionada={selecionada}
                aoSelecionar={setSelecionada}
                aoMudar={mudarCamada}
                aoAdicionarImagem={() => entradaCamada.current?.click()}
                aoAdicionarTexto={() => adicionarTexto()}
                aoAdicionarDesenho={adicionarDesenho}
              />
              {camadaSel ? (
                <PainelCamada camada={camadaSel} mudar={mudarCamada} acoes={acoesCamada} focarTexto={focarTexto === camadaSel.id} />
              ) : (
                <p className="text-xs text-fraca">Clique numa camada (na lista ou na imagem) para editar. Arraste para mover; as alças mudam o tamanho e giram.</p>
              )}
            </>
          ) : null}
          {aplicando ? <p className="text-xs text-fraca">Aplicando…</p> : null}
        </aside>
      </div>

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
