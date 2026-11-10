/**
 * Projeto do editor de vídeo e a exportação dele.
 *
 * Projeto (p):
 *   clipes:  [{ id, fonte, inicio, fim, velocidade, volume (0–1), mudo }] — em sequência
 *   recorte: null | { x, y, w, h } em frações do quadro (já girado/espelhado)
 *   girar (0/90/180/270), espelhar, cor { brilho, contraste, saturacao }, fadeIn, fadeOut
 *   camadas: [{ id, tipo: 'texto'|'imagem'|'video'|'desfoque', inicio, fim, x, y, w, h, … }]
 *            posição e tamanho em frações do quadro final; a última fica por cima
 *   musica:  null | { fonte, volume, volumeOriginal, repetir }
 *   formato, resolucao (lado menor máximo; 0 = manter), qualidade
 *
 * Fontes (fora do histórico): { [id]: { arquivo, tipo, largura, altura, duracao, temAudio } }
 */
import { executarFfmpeg } from '../../motores/ffmpeg'
import { argsVideoFfmpeg, filtroVelocidadeAudio, processarVideo } from '../../motores/midia'
import { extensaoDe } from '../../nucleo/arquivos'
import { ErroAmigavel } from '../../nucleo/tarefa'

export const duracaoClipe = (c) => Math.max(0.05, (c.fim - c.inicio) / c.velocidade)
export const duracaoTotal = (p) => p.clipes.reduce((s, c) => s + duracaoClipe(c), 0)

/** Onde cada clipe começa na linha do tempo. */
export function iniciosNaLinha(p) {
  const r = []
  let t = 0
  for (const c of p.clipes) {
    r.push(t)
    t += duracaoClipe(c)
  }
  return r
}

/** Tempo da linha → { indice do clipe, tempo dentro do arquivo do clipe }. */
export function localizar(p, t) {
  const inicios = iniciosNaLinha(p)
  for (let i = p.clipes.length - 1; i >= 0; i -= 1) {
    if (t >= inicios[i] - 1e-6) {
      const c = p.clipes[i]
      return { indice: i, local: Math.min(c.fim, c.inicio + (t - inicios[i]) * c.velocidade), inicio: inicios[i] }
    }
  }
  return { indice: 0, local: p.clipes[0]?.inicio ?? 0, inicio: 0 }
}

/** Quadro "girado" de uma fonte (largura × altura depois de girar). */
export function quadroGirado(f, girar) {
  return girar === 90 || girar === 270 ? { w: f.altura, h: f.largura } : { w: f.largura, h: f.altura }
}

/** Tamanho final (pares): recorte do 1º clipe, limitado pela resolução escolhida. */
export function tamanhoFinal(p, fontes) {
  const base = fontes[p.clipes[0]?.fonte]
  if (!base?.largura) return { w: 1280, h: 720 }
  const q = quadroGirado(base, p.girar)
  const r = p.recorte ?? { x: 0, y: 0, w: 1, h: 1 }
  let w = q.w * r.w
  let h = q.h * r.h
  if (p.resolucao && Math.min(w, h) > p.resolucao) {
    const k = p.resolucao / Math.min(w, h)
    w *= k
    h *= k
  }
  return { w: Math.max(2, Math.round(w / 2) * 2), h: Math.max(2, Math.round(h / 2) * 2) }
}

/** Opções de uma camada que nem toda camada tem (as antigas, por exemplo). */
export const PADRAO_CAMADA = { girar: 0, espelharH: false, espelharV: false, ajuste: { brilho: 0, contraste: 1, saturacao: 1 }, opacidade: 1, fadeIn: 0, fadeOut: 0, recorte: null, semFundo: null, tolerancia: 0.15 }

/* ─── Texto → imagem (a camada de texto vira PNG na exportação) ─────────── */

/** Quebra o texto em linhas que cabem em `largura` (respeitando as quebras do usuário). */
function quebrar(ctx, texto, largura) {
  const linhas = []
  for (const paragrafo of String(texto).split('\n')) {
    let atual = ''
    for (const palavra of paragrafo.split(/\s+/)) {
      const teste = atual ? `${atual} ${palavra}` : palavra
      if (ctx.measureText(teste).width <= largura || !atual) atual = teste
      else {
        linhas.push(atual)
        atual = palavra
      }
    }
    linhas.push(atual)
  }
  return linhas
}

/** Estilo de texto compartilhado pela prévia (CSS) e pela exportação (canvas). */
export const estiloTexto = (c, alturaQuadro) => {
  const tamanho = c.tamanho * alturaQuadro
  return { tamanho, padding: tamanho * 0.3, linha: tamanho * 1.2, peso: c.negrito ? 700 : 500 }
}

/** Desenha a camada de texto num PNG do tamanho que ela ocupa no quadro final. */
export async function textoParaPng(c, quadro, familia) {
  const e = estiloTexto(c, quadro.h)
  const largura = Math.max(8, Math.round(c.w * quadro.w))
  const medidor = new OffscreenCanvas(1, 1).getContext('2d')
  medidor.font = `${e.peso} ${e.tamanho}px ${familia}`
  const linhas = quebrar(medidor, c.texto || ' ', largura - e.padding * 2)
  const altura = Math.max(8, Math.round(linhas.length * e.linha + e.padding * 2))
  const cv = new OffscreenCanvas(largura, altura)
  const ctx = cv.getContext('2d')
  if (c.fundo) {
    ctx.fillStyle = c.corFundo
    ctx.globalAlpha = c.opacidadeFundo
    const raio = Math.min(e.tamanho * 0.35, altura / 2)
    ctx.beginPath()
    ctx.roundRect(0, 0, largura, altura, raio)
    ctx.fill()
    ctx.globalAlpha = 1
  }
  ctx.font = `${e.peso} ${e.tamanho}px ${familia}`
  ctx.fillStyle = c.cor
  ctx.textBaseline = 'middle'
  ctx.textAlign = c.alinhar === 'esquerda' ? 'left' : c.alinhar === 'direita' ? 'right' : 'center'
  const xTexto = c.alinhar === 'esquerda' ? e.padding : c.alinhar === 'direita' ? largura - e.padding : largura / 2
  if (!c.fundo) {
    // Sem caixa: contorno escuro para ler sobre qualquer imagem.
    ctx.lineJoin = 'round'
    ctx.lineWidth = Math.max(2, e.tamanho * 0.12)
    ctx.strokeStyle = 'rgba(0,0,0,0.75)'
    linhas.forEach((l, i) => ctx.strokeText(l, xTexto, e.padding + e.linha * (i + 0.5)))
  }
  linhas.forEach((l, i) => ctx.fillText(l, xTexto, e.padding + e.linha * (i + 0.5)))
  return { blob: await cv.convertToBlob({ type: 'image/png' }), largura, altura }
}

/* ─── Exportação ─────────────────────────────────────────────────────────── */

const par = (n) => Math.max(2, Math.round(n / 2) * 2)
const fixo = (n) => Number(n.toFixed(3))

/** Projeto simples (1 clipe, sem camadas/efeitos): vai pelo caminho rápido (aceleração do navegador). */
function simples(p) {
  const [c] = p.clipes
  const cor = p.cor
  return p.clipes.length === 1 && !p.camadas.length && !p.musica && c.velocidade === 1 && c.volume === 1 && !p.fadeIn && !p.fadeOut && cor.brilho === 0 && cor.contraste === 1 && cor.saturacao === 1
}

function nomeNoFs(id, arquivo) {
  return `f${id}.${extensaoDe(arquivo.name) || 'bin'}`
}

/**
 * Exporta o projeto. Devolve { blob, motor }.
 * ctx: { progresso, sinal }; familia: fonte CSS dos textos.
 */
export async function exportarProjeto(p, fontes, ctx, familia) {
  if (!p.clipes.length) throw new ErroAmigavel('Adicione pelo menos um vídeo.')
  const quadro = tamanhoFinal(p, fontes)
  const T = duracaoTotal(p)

  if (simples(p)) {
    const [c] = p.clipes
    const f = fontes[c.fonte]
    const q = quadroGirado(f, p.girar)
    const r = p.recorte
    const recorte = r ? { left: par(r.x * q.w), top: par(r.y * q.h), width: par(r.w * q.w), height: par(r.h * q.h) } : undefined
    const cortou = c.inicio > 0.05 || c.fim < f.duracao - 0.05
    return processarVideo(
      f.arquivo,
      {
        formato: p.formato,
        qualidade: p.qualidade,
        girar: p.girar,
        espelhar: p.espelhar,
        recorte,
        largura: quadro.w,
        altura: quadro.h,
        semAudio: c.mudo,
        inicio: cortou ? c.inicio : undefined,
        fim: cortou ? c.fim : undefined,
      },
      ctx,
    )
  }

  const entradas = new Map() // nome no FS → dados
  const args = []
  let n = 0
  const entrada = (nome, dados, antes = []) => {
    if (!entradas.has(nome)) entradas.set(nome, dados)
    args.push(...antes, '-i', nome)
    return n++
  }
  const f = [] // partes do filter_complex
  const { w: W, h: H } = quadro

  // 1. Cada clipe: trecho → velocidade → girar/espelhar → recorte → encaixe no quadro final.
  const giro = p.girar === 90 ? 'transpose=1,' : p.girar === 180 ? 'transpose=1,transpose=1,' : p.girar === 270 ? 'transpose=2,' : ''
  const espelho = p.espelhar ? 'hflip,' : ''
  const r = p.recorte
  const recorte = r ? `crop=trunc(iw*${fixo(r.w)}/2)*2:trunc(ih*${fixo(r.h)}/2)*2:trunc(iw*${fixo(r.x)}):trunc(ih*${fixo(r.y)}),` : ''
  const pares = []
  p.clipes.forEach((c, i) => {
    const fonte = fontes[c.fonte]
    const k = entrada(nomeNoFs(c.fonte, fonte.arquivo), fonte.arquivo)
    const d = duracaoClipe(c)
    f.push(
      `[${k}:v]trim=start=${fixo(c.inicio)}:end=${fixo(c.fim)},setpts=(PTS-STARTPTS)/${c.velocidade},${giro}${espelho}${recorte}scale=${W}:${H}:force_original_aspect_ratio=decrease,pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2:black,setsar=1,fps=30,format=yuv420p[v${i}]`,
    )
    if (fonte.temAudio && !c.mudo && c.volume > 0) {
      f.push(`[${k}:a]atrim=start=${fixo(c.inicio)}:end=${fixo(c.fim)},asetpts=PTS-STARTPTS,${c.velocidade !== 1 ? `${filtroVelocidadeAudio(c.velocidade)},` : ''}volume=${c.volume},aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo,apad=whole_dur=${fixo(d)}[a${i}]`)
    } else {
      f.push(`anullsrc=r=48000:cl=stereo,atrim=0:${fixo(d)},aformat=sample_fmts=fltp:channel_layouts=stereo[a${i}]`)
    }
    pares.push(`[v${i}][a${i}]`)
  })
  f.push(`${pares.join('')}concat=n=${p.clipes.length}:v=1:a=1[vc][ac]`)

  // 2. Quadro inteiro: cores e fades.
  let v = 'vc'
  const efeitos = []
  const { brilho, contraste, saturacao } = p.cor
  if (brilho !== 0 || contraste !== 1 || saturacao !== 1) efeitos.push(`eq=brightness=${fixo(brilho * 0.4)}:contrast=${fixo(contraste)}:saturation=${fixo(saturacao)}`)
  if (p.fadeIn) efeitos.push(`fade=t=in:st=0:d=${fixo(p.fadeIn)}`)
  if (p.fadeOut) efeitos.push(`fade=t=out:st=${fixo(Math.max(0, T - p.fadeOut))}:d=${fixo(p.fadeOut)}`)
  if (efeitos.length) {
    f.push(`[vc]${efeitos.join(',')}[vq]`)
    v = 'vq'
  }

  // 3. Camadas, na ordem (a última por cima). Cada uma: recorte → tamanho →
  //    espelho → cores → sem fundo → opacidade → giro → fades, posicionada pelo centro.
  const sons = []
  for (let i = 0; i < p.camadas.length; i += 1) {
    const c = { ...PADRAO_CAMADA, ...p.camadas[i] }
    const quando = `enable='between(t,${fixo(c.inicio)},${fixo(c.fim)})'`
    const saida = `vl${i}`
    if (c.tipo === 'desfoque') {
      const x = Math.round(c.x * W)
      const y = Math.round(c.y * H)
      const cw = par(c.w * W)
      const ch = par(c.h * H)
      f.push(`[${v}]split[b${i}a][b${i}b]`, `[b${i}b]crop=${cw}:${ch}:${x}:${y},boxblur=${Math.max(4, Math.round(Math.min(cw, ch) / 8))}:3[b${i}c]`, `[b${i}a][b${i}c]overlay=${x}:${y}:${quando}[${saida}]`)
      v = saida
      continue
    }
    let origem
    let alturaPx
    const parado = ['-loop', '1', '-framerate', '30', '-t', String(fixo(T))]
    if (c.tipo === 'texto') {
      const png = await textoParaPng(c, quadro, familia)
      origem = `[${entrada(`t${c.id}.png`, png.blob, parado)}:v]`
      alturaPx = png.altura
    } else {
      const fonte = fontes[c.fonte]
      if (!fonte) continue
      alturaPx = par(c.h * H)
      if (c.tipo === 'imagem') origem = `[${entrada(nomeNoFs(c.fonte, fonte.arquivo), fonte.arquivo, parado)}:v]`
      else {
        const k = entrada(nomeNoFs(c.fonte, fonte.arquivo), fonte.arquivo)
        const d = Math.min(c.fim - c.inicio, fonte.duracao || c.fim - c.inicio)
        origem = `[${k}:v]trim=0:${fixo(d)},setpts=PTS-STARTPTS+${fixo(c.inicio)}/TB,`
        if (fonte.temAudio && c.volume > 0) {
          const atraso = Math.round(c.inicio * 1000)
          f.push(`[${k}:a]atrim=0:${fixo(d)},asetpts=PTS-STARTPTS,volume=${c.volume},aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo,adelay=${atraso}|${atraso}[s${i}]`)
          sons.push(`[s${i}]`)
        }
      }
    }
    const cadeia = []
    if (c.tipo !== 'texto') {
      const r = c.recorte
      if (r && (r.w < 0.999 || r.h < 0.999)) cadeia.push(`crop=trunc(iw*${fixo(r.w)}):trunc(ih*${fixo(r.h)}):trunc(iw*${fixo(r.x)}):trunc(ih*${fixo(r.y)})`)
      cadeia.push(`scale=${par(c.w * W)}:${alturaPx}`)
    }
    if (c.espelharH) cadeia.push('hflip')
    if (c.espelharV) cadeia.push('vflip')
    const cor = c.ajuste
    if (c.tipo !== 'texto' && (cor.brilho !== 0 || cor.contraste !== 1 || cor.saturacao !== 1)) cadeia.push('format=yuva420p', `eq=brightness=${fixo(cor.brilho * 0.4)}:contrast=${fixo(cor.contraste)}:saturation=${fixo(cor.saturacao)}`)
    cadeia.push('format=rgba')
    if (c.tipo !== 'texto' && c.semFundo) cadeia.push(`colorkey=${c.semFundo === 'preto' ? '0x000000' : '0xFFFFFF'}:${fixo(Math.max(0.01, c.tolerancia))}:0.08`)
    if (c.opacidade < 1) cadeia.push(`colorchannelmixer=aa=${fixo(c.opacidade)}`)
    if (c.girar) {
      const rad = fixo((c.girar * Math.PI) / 180)
      cadeia.push(`rotate=${rad}:c=none:ow=rotw(${rad}):oh=roth(${rad})`)
    }
    if (c.fadeIn) cadeia.push(`fade=t=in:st=${fixo(c.inicio)}:d=${fixo(c.fadeIn)}:alpha=1`)
    if (c.fadeOut) cadeia.push(`fade=t=out:st=${fixo(Math.max(c.inicio, c.fim - c.fadeOut))}:d=${fixo(c.fadeOut)}:alpha=1`)
    // Posição pelo centro: girar muda o tamanho do retângulo, não o centro.
    const cx = fixo(c.x * W + (c.w * W) / 2)
    const cy = fixo(c.y * H + alturaPx / 2)
    f.push(`${origem}${cadeia.join(',')}[o${i}]`, `[${v}][o${i}]overlay=x=${cx}-overlay_w/2:y=${cy}-overlay_h/2:eof_action=pass:${quando}[${saida}]`)
    v = saida
  }

  // 4. Som: fades no som original, música por baixo.
  let a = 'ac'
  const efeitosSom = []
  if (p.musica && p.musica.volumeOriginal !== 1) efeitosSom.push(`volume=${fixo(p.musica.volumeOriginal)}`)
  if (p.fadeIn) efeitosSom.push(`afade=t=in:st=0:d=${fixo(p.fadeIn)}`)
  if (p.fadeOut) efeitosSom.push(`afade=t=out:st=${fixo(Math.max(0, T - p.fadeOut))}:d=${fixo(p.fadeOut)}`)
  if (efeitosSom.length) {
    f.push(`[ac]${efeitosSom.join(',')}[aq]`)
    a = 'aq'
  }
  if (p.musica) {
    const fonte = fontes[p.musica.fonte]
    const k = entrada(nomeNoFs(p.musica.fonte, fonte.arquivo), fonte.arquivo, p.musica.repetir ? ['-stream_loop', '-1'] : [])
    const caida = Math.min(2, T / 4)
    f.push(`[${k}:a]atrim=0:${fixo(T)},asetpts=PTS-STARTPTS,volume=${fixo(p.musica.volume)},aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo,afade=t=out:st=${fixo(Math.max(0, T - caida))}:d=${fixo(caida)}[mus]`)
    sons.push('[mus]')
  }
  if (sons.length) {
    f.push(`[${a}]${sons.join('')}amix=inputs=${sons.length + 1}:duration=first:dropout_transition=0:normalize=0[am]`)
    a = 'am'
  }

  const saida = `saida.${p.formato}`
  const dados = await executarFfmpeg({
    entradas: [...entradas].map(([nome, dados]) => ({ nome, dados })),
    args: [...args, '-filter_complex', f.join(';'), '-map', `[${v}]`, '-map', `[${a}]`, '-t', String(fixo(T)), ...argsVideoFfmpeg(p.formato, p.qualidade)],
    saida,
    duracao: T,
    aoProgredir: ctx.progresso,
    sinal: ctx.sinal,
    rotulo: 'Montando o vídeo',
  }).catch((erro) => {
    if (erro?.name === 'AbortError') throw erro
    console.error(erro?.log)
    throw new ErroAmigavel('Não foi possível montar o vídeo. Algum arquivo pode estar corrompido ou usar um codec sem suporte.')
  })
  const mime = p.formato === 'mov' ? 'video/quicktime' : p.formato === 'mkv' ? 'video/x-matroska' : 'video/mp4'
  return { blob: new Blob([dados], { type: mime }), motor: 'webassembly' }
}
