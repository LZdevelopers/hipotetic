import { executarFfmpeg } from '../../motores/ffmpeg'
import { infoMidia } from '../../motores/midia'
import { extensaoDe } from '../../nucleo/arquivos'
import { ErroAmigavel } from '../../nucleo/tarefa'

export const MAX_SEGUNDOS_GIF = 30

/** "1:05.5" → 65.5; "" → null; inválido → NaN. */
export const lerTempo = (t) => {
  if (String(t ?? '').trim() === '') return null
  const p = String(t).replace(',', '.').split(':').map(Number)
  if (p.some(Number.isNaN)) return NaN
  return p.length === 2 ? p[0] * 60 + p[1] : p[0]
}

/**
 * Vídeo → GIF com paleta otimizada (palettegen/paletteuse num só comando):
 * cores muito melhores que a conversão direta.
 */
export async function gerarGif(arquivo, { inicio, fim, largura, fps, loop }, { progresso, sinal }) {
  const info = await infoMidia(arquivo)
  if (!info.temVideo) throw new ErroAmigavel('Este arquivo não tem vídeo.')
  const ini = lerTempo(inicio) ?? 0
  const fin = Math.min(lerTempo(fim) ?? ini + MAX_SEGUNDOS_GIF, info.duracao ?? Infinity)
  if (fin - ini > MAX_SEGUNDOS_GIF + 0.01) throw new ErroAmigavel(`GIFs ficam enormes: escolha um trecho de até ${MAX_SEGUNDOS_GIF} segundos.`)
  const entrada = `entrada.${extensaoDe(arquivo.name) || 'mp4'}`
  const filtro = `fps=${fps},scale=${largura}:-1:flags=lanczos,split[a][b];[a]palettegen=stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle`
  const dados = await executarFfmpeg({
    entradas: [{ nome: entrada, dados: arquivo }],
    args: ['-ss', String(ini), '-t', String(fin - ini), '-i', entrada, '-vf', filtro, '-loop', loop ? '0' : '-1'],
    saida: 'saida.gif',
    duracao: fin - ini,
    aoProgredir: progresso,
    sinal,
    rotulo: 'Criando o GIF',
  })
  return { blob: new Blob([dados], { type: 'image/gif' }), detalhe: `${(fin - ini).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} s · ${largura} px · ${fps} fps` }
}
