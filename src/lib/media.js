/**
 * Cliente da API /api/midia e formatação dos dados para a interface.
 */

/** Mensagem humana para cada código de erro que a API devolve. */
const ERRORS = {
  'url-ausente': 'Cole um link para começar.',
  'url-invalida': 'Esse texto não parece um link válido. Confira se copiou o endereço inteiro.',
  'url-interna': 'Links de rede local ou de endereços internos não são aceitos.',
  'fonte-nao-suportada':
    'Esse link não é de uma rede que suportamos. Por enquanto funciona com YouTube e TikTok.',
  'fonte-planejada': (source) =>
    `${source ?? 'Essa plataforma'} ainda não é suportado — está nos planos, assim que houver uma integração autorizada e gratuita.`,
  'link-sem-video': 'Reconhecemos a rede, mas o link não aponta para um vídeo específico. Copie o link do vídeo (botão Compartilhar → Copiar link).',
  'nao-encontrado': 'Não encontramos esse conteúdo. Ele pode ter sido removido ou o link está incompleto.',
  privado: 'Esse conteúdo é privado ou o autor não permite exibição fora da plataforma.',
  indisponivel: 'A fonte não respondeu agora. Tente de novo em alguns segundos.',
  rede: 'Sem conexão com o servidor. Confira sua internet e tente de novo.',
  interno: 'Algo deu errado do nosso lado. Tente de novo em instantes.',
}

const SOURCE_NAMES = { instagram: 'Instagram', facebook: 'Facebook', vimeo: 'Vimeo', x: 'O X (Twitter)' }

export function errorMessage(code, source) {
  const message = ERRORS[code] ?? ERRORS.interno
  return typeof message === 'function' ? message(SOURCE_NAMES[source]) : message
}

export class LookupError extends Error {
  constructor(code, source) {
    super(errorMessage(code, source))
    this.code = code
  }
}

/** Busca as informações de um link. Lança LookupError com mensagem pronta. */
export async function lookupMedia(url, signal) {
  let response
  try {
    response = await fetch(`/api/midia?url=${encodeURIComponent(url)}`, { signal })
  } catch (error) {
    if (error.name === 'AbortError') throw error
    throw new LookupError('rede')
  }
  const body = await response.json().catch(() => null)
  if (!response.ok || !body?.midia) throw new LookupError(body?.erro ?? 'interno', body?.fonte)
  return body.midia
}

/** 5717 → "1:35:17"; 213 → "3:33". */
export function formatDuration(seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0) return null
  const total = Math.round(seconds)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = String(total % 60).padStart(2, '0')
  return h ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`
}

const UNITS = ['B', 'KB', 'MB', 'GB']

/** 596399542 → "569 MB". */
export function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return null
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), UNITS.length - 1)
  const value = bytes / 1024 ** i
  return `${value.toLocaleString('pt-BR', { maximumFractionDigits: value < 10 && i > 1 ? 1 : 0 })} ${UNITS[i]}`
}

/** Metadados de exibição de cada fonte (nome e ícone do cartão). */
export const SOURCE_META = {
  youtube: { name: 'YouTube', icon: 'youtube' },
  tiktok: { name: 'TikTok', icon: 'tiktok' },
}

/** Por que o download não está disponível, em linguagem de gente. */
export const UNAVAILABLE = {
  'termos-youtube': {
    title: 'Download indisponível para o YouTube',
    text: 'Os termos do YouTube não permitem baixar vídeos fora do app oficial. Você pode assistir aqui pelo player oficial ou usar o modo offline do YouTube Premium.',
    cta: 'Abrir no YouTube',
  },
  'termos-tiktok': {
    title: 'Download indisponível para o TikTok',
    text: 'Os termos do TikTok não permitem baixar vídeos por ferramentas externas. Se o autor permitir, o próprio app tem a opção “Salvar vídeo”.',
    cta: 'Abrir no TikTok',
  },
  'tiktok-bloqueado': {
    title: 'O TikTok não liberou este vídeo',
    text: 'O TikTok bloqueou temporariamente nosso servidor ou não entregou os arquivos deste vídeo. Tente de novo em alguns minutos.',
    cta: 'Abrir no TikTok',
  },
  'foto-tiktok': {
    title: 'Post de fotos',
    text: 'Esse post do TikTok é um carrossel de fotos, não um vídeo. Por enquanto só baixamos vídeos.',
    cta: 'Abrir no TikTok',
  },
  'youtube-bloqueado': {
    title: 'O YouTube não liberou este vídeo',
    text: 'O vídeo pede login (restrição de idade ou privado) ou o YouTube bloqueou temporariamente nosso servidor. Tente de novo em alguns minutos.',
    cta: 'Abrir no YouTube',
  },
  'ao-vivo': {
    title: 'Transmissão ao vivo',
    text: 'Lives não podem ser baixadas enquanto estão no ar. Depois que a transmissão terminar e a gravação for publicada, tente de novo.',
    cta: 'Abrir no YouTube',
  },
  'muito-longo': {
    title: 'Vídeo longo demais',
    text: 'Para manter o serviço gratuito, baixamos vídeos de até 2 horas.',
    cta: 'Abrir no YouTube',
  },
  'indisponivel-youtube': {
    title: 'Vídeo sem formatos disponíveis',
    text: 'O YouTube não ofereceu nenhum formato baixável para este vídeo (pode ser uma estreia, uma gravação de live ainda em processamento ou conteúdo restrito).',
    cta: 'Abrir no YouTube',
  },
}
