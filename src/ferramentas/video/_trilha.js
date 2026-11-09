import { executarFfmpeg } from '../../motores/ffmpeg'
import { infoMidia } from '../../motores/midia'
import { extensaoDe } from '../../nucleo/arquivos'

const MIMES = { mp4: 'video/mp4', mov: 'video/quicktime', mkv: 'video/x-matroska', webm: 'video/webm' }

/**
 * Coloca uma trilha (música, narração) num vídeo já pronto: substitui o som
 * ou mistura com ele. A imagem é copiada sem recodificar; a trilha repete se
 * for mais curta e é cortada no fim do vídeo.
 */
export async function aplicarTrilha(video, formato, trilha, { modo, volume, volumeOriginal }, { progresso, sinal }) {
  const info = await infoMidia(new File([video], `v.${formato}`)).catch(() => ({}))
  const nv = `video.${formato}`
  const na = `trilha.${extensaoDe(trilha.name) || 'mp3'}`
  const args = ['-i', nv, '-stream_loop', '-1', '-i', na]
  const vol = (volume / 100).toFixed(2)
  if (modo === 'misturar' && info.temAudio) {
    args.push('-filter_complex', `[0:a]volume=${(volumeOriginal / 100).toFixed(2)}[o];[1:a]volume=${vol}[n];[o][n]amix=inputs=2:duration=first:dropout_transition=0[a]`, '-map', '0:v:0', '-map', '[a]')
  } else {
    args.push('-map', '0:v:0', '-map', '1:a:0', '-af', `volume=${vol}`)
  }
  args.push('-c:v', 'copy', ...(formato === 'webm' ? ['-c:a', 'libopus', '-b:a', '160k'] : ['-c:a', 'aac', '-b:a', '192k']))
  if (info.duracao) args.push('-t', String(info.duracao))
  if (formato === 'mp4' || formato === 'mov') args.push('-movflags', '+faststart')
  const dados = await executarFfmpeg({
    entradas: [
      { nome: nv, dados: video },
      { nome: na, dados: trilha },
    ],
    args,
    saida: `saida.${formato}`,
    duracao: info.duracao,
    aoProgredir: progresso,
    sinal,
    rotulo: 'Colocando a música',
  })
  return new Blob([dados], { type: MIMES[formato] ?? 'video/mp4' })
}
