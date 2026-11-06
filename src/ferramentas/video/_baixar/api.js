/**
 * Cliente de /api/midia e textos de erro/indisponibilidade do downloader.
 */
import { baixarUrl, executarFfmpeg } from '../../../motores/ffmpeg'

export const PLATAFORMAS = [
  {
    id: 'youtube',
    nome: 'YouTube',
    placeholder: 'Cole o link do YouTube (vídeo ou Shorts)',
    hosts: ['youtube.com', 'youtu.be', 'music.youtube.com', 'youtube-nocookie.com'],
  },
  {
    id: 'tiktok',
    nome: 'TikTok',
    placeholder: 'Cole o link do TikTok',
    hosts: ['tiktok.com', 'vm.tiktok.com', 'vt.tiktok.com'],
  },
]

/** Plataforma do link colado (pelo host), ou null. */
export function detectarPlataforma(texto) {
  try {
    const host = new URL(/^https?:\/\//i.test(texto) ? texto : `https://${texto}`).hostname.replace(/^(www|m|mobile)\./, '')
    return PLATAFORMAS.find((p) => p.hosts.includes(host)) ?? null
  } catch {
    return null
  }
}

const ERROS = {
  'url-ausente': 'Cole um link para começar.',
  'url-invalida': 'Esse texto não parece um link válido. Confira se copiou o endereço inteiro.',
  'url-interna': 'Links de rede local ou de endereços internos não são aceitos.',
  'fonte-nao-suportada': 'Esse link não é do YouTube nem do TikTok, as plataformas suportadas por enquanto.',
  'fonte-planejada': 'Essa plataforma ainda não é suportada.',
  'link-sem-video': 'Reconhecemos a plataforma, mas o link não aponta para um vídeo. Copie o link do vídeo (Compartilhar → Copiar link).',
  'nao-encontrado': 'Não encontramos esse conteúdo. Ele pode ter sido removido ou o link está incompleto.',
  privado: 'Esse conteúdo é privado ou o autor não permite exibição fora da plataforma.',
  indisponivel: 'A plataforma não respondeu agora. Tente de novo em alguns segundos.',
  rede: 'Sem conexão com o servidor. Confira sua internet e tente de novo.',
  interno: 'Algo deu errado do nosso lado. Tente de novo em instantes.',
}

export class ErroConsulta extends Error {}

/** Busca as informações de um link. Lança ErroConsulta com mensagem pronta. */
export async function consultarMidia(url, sinal) {
  let resposta
  try {
    resposta = await fetch(`/api/midia?url=${encodeURIComponent(url)}`, { signal: sinal })
  } catch (erro) {
    if (erro.name === 'AbortError') throw erro
    throw new ErroConsulta(ERROS.rede)
  }
  const corpo = await resposta.json().catch(() => null)
  if (!resposta.ok || !corpo?.midia) throw new ErroConsulta(ERROS[corpo?.erro] ?? ERROS.interno)
  return corpo.midia
}

/** Por que o download não está disponível, em linguagem de gente. */
export const INDISPONIVEL = {
  'tiktok-bloqueado': {
    titulo: 'O TikTok não liberou este vídeo',
    texto: 'O TikTok bloqueou temporariamente nosso servidor ou não entregou os arquivos deste vídeo. Tente de novo em alguns minutos.',
  },
  'foto-tiktok': {
    titulo: 'Post de fotos',
    texto: 'Esse post do TikTok é um carrossel de fotos, não um vídeo. Por enquanto só baixamos vídeos.',
  },
  'youtube-bloqueado': {
    titulo: 'O YouTube não liberou este vídeo',
    texto: 'O vídeo pede login (restrição de idade ou privado) ou o YouTube bloqueou temporariamente nosso servidor. Tente de novo mais tarde.',
  },
  'ao-vivo': {
    titulo: 'Transmissão ao vivo',
    texto: 'Lives não podem ser baixadas enquanto estão no ar. Depois que a gravação for publicada, tente de novo.',
  },
  'muito-longo': {
    titulo: 'Vídeo longo demais',
    texto: 'Para manter o serviço gratuito, baixamos vídeos de até 2 horas.',
  },
  'indisponivel-youtube': {
    titulo: 'Vídeo sem formatos disponíveis',
    texto: 'O YouTube não ofereceu nenhum formato baixável para este vídeo (estreia, gravação de live em processamento ou conteúdo restrito).',
  },
}

const MIME = { mp4: 'video/mp4', webm: 'video/webm', mp3: 'audio/mpeg' }

/**
 * Prepara no navegador um formato com `processo`:
 *  - juntar: vídeo HD e áudio chegam separados do YouTube; `-c copy` só troca
 *    o "envelope" (sem recodificar), rápido mesmo em 1080p;
 *  - mp3: recodifica o áudio para MP3 192 kbps;
 *  - h264: recodifica o H.265 do TikTok para H.264, que abre em qualquer player.
 */
export async function prepararFormato(processo, { extensao, titulo }, aoProgredir, sinal) {
  const urls = processo.acao === 'juntar' ? [processo.video, processo.audio] : [processo.video ?? processo.audio]
  const parciais = urls.map(() => 0)
  const dados = await Promise.all(
    urls.map((url, i) =>
      baixarUrl(
        url,
        (v) => {
          parciais[i] = v
          aoProgredir(parciais.reduce((a, b) => a + b, 0) / parciais.length, 'Baixando')
        },
        sinal,
      ),
    ),
  )

  let entradas
  let args
  if (processo.acao === 'juntar') {
    const ext = extensao === 'mp4' ? ['mp4', 'm4a'] : ['webm', 'weba']
    entradas = [
      { nome: `video.${ext[0]}`, dados: dados[0] },
      { nome: `audio.${ext[1]}`, dados: dados[1] },
    ]
    args = ['-i', entradas[0].nome, '-i', entradas[1].nome, '-map', '0:v:0', '-map', '1:a:0', '-c', 'copy']
    if (extensao === 'mp4') args.push('-movflags', '+faststart')
  } else if (processo.acao === 'h264') {
    entradas = [{ nome: 'video.in', dados: dados[0] }]
    args = ['-i', 'video.in', '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '23', '-pix_fmt', 'yuv420p', '-c:a', 'copy', '-movflags', '+faststart']
  } else {
    entradas = [{ nome: 'audio.in', dados: dados[0] }]
    args = ['-i', 'audio.in', '-vn', '-c:a', 'libmp3lame', '-b:a', '192k', '-id3v2_version', '3', '-metadata', `title=${titulo}`]
  }
  const saida = await executarFfmpeg({ entradas, args, saida: `saida.${extensao}`, aoProgredir, sinal, rotulo: 'Convertendo' })
  return new Blob([saida], { type: MIME[extensao] })
}
