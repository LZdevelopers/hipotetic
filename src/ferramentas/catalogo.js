/**
 * Catálogo da plataforma: categorias e ferramentas.
 *
 * É a fonte única de verdade para a navegação, a busca, as páginas de
 * categoria, os metadados de SEO, o sitemap e a pré-renderização. Uma
 * ferramenta SÓ entra aqui quando está implementada de verdade — nada de
 * "em breve" com interface fingindo funcionar.
 *
 * Campos de uma ferramenta:
 *   slug       caminho da página, "categoria/nome"
 *   modulo     arquivo em src/ferramentas/ que exporta o componente (default)
 *   predef     props extras para o componente (páginas que reaproveitam o
 *              mesmo motor com outro ponto de partida, como "MP4 para GIF")
 *   nome       nome curto (cartões, menu, busca)
 *   titulo     <h1> e <title>
 *   resumo     uma linha para os cartões
 *   descricao  meta description (até ~160 caracteres)
 *   termos     sinônimos para a busca
 *   icone      nome do ícone (src/componentes/Icone.jsx)
 *   servidor   true quando o arquivo vai ao servidor (a página avisa)
 *   servidorDetalhe  o que exatamente passa pelo servidor (opcional)
 *   popular    aparece em "Mais usadas" na página inicial
 *   passos     "Como usar" da página (3 passos curtos)
 *   perguntas  perguntas frequentes da página [{ p, r }]
 */

export const categorias = [
  {
    id: 'video',
    nome: 'Vídeo',
    titulo: 'Ferramentas de vídeo',
    descricao: 'Baixe vídeos do YouTube e do TikTok, converta entre formatos, corte, comprima e transforme vídeos em GIF direto no navegador.',
    icone: 'video',
  },
  {
    id: 'audio',
    nome: 'Áudio',
    titulo: 'Ferramentas de áudio',
    descricao: 'Converta entre MP3, WAV, OGG, FLAC e AAC, extraia o áudio de vídeos, corte, junte e ajuste o volume.',
    icone: 'audio',
  },
  {
    id: 'imagem',
    nome: 'Imagens',
    titulo: 'Ferramentas de imagem',
    descricao: 'Converta, comprima, redimensione, recorte e ajuste imagens em lote, sem enviar nada para servidores.',
    icone: 'imagem',
  },
  {
    id: 'pdf',
    nome: 'PDF',
    titulo: 'Ferramentas de PDF',
    descricao: 'Una, divida, organize, comprima, proteja e converta PDFs. Tudo processado no seu navegador.',
    icone: 'pdf',
  },
  {
    id: 'documentos',
    nome: 'Documentos',
    titulo: 'Ferramentas de documentos',
    descricao: 'Converta DOCX, ODT, DOC e RTF para PDF e entre si, transforme Markdown em HTML e conte palavras.',
    icone: 'documentos',
  },
  {
    id: 'compactados',
    nome: 'Compactados',
    titulo: 'Arquivos compactados',
    descricao: 'Crie ZIP e 7Z com senha, extraia ZIP, RAR, 7Z, TAR e GZ e veja o conteúdo antes de extrair.',
    icone: 'compactados',
  },
  {
    id: 'utilitarios',
    nome: 'Utilitários',
    titulo: 'Utilitários de arquivos',
    descricao: 'QR Code, hashes MD5 e SHA, identificador de formato, comparador de arquivos e outras ferramentas rápidas.',
    icone: 'utilitarios',
  },
]

export const ferramentas = [
  // ─── Vídeo ────────────────────────────────────────────────────────────────
  {
    slug: 'video/baixar',
    modulo: 'video/baixar',
    nome: 'Baixar vídeo por link',
    titulo: 'Baixar vídeos do YouTube e do TikTok',
    resumo: 'Cole o link e baixe em MP4 ou MP3, até 4K.',
    descricao: 'Baixe vídeos do YouTube e do TikTok pelo link: MP4 até 4K, MP3, miniatura e TikTok sem marca d’água. Grátis e sem cadastro.',
    termos: ['download', 'youtube', 'tiktok', 'mp3', 'mp4', 'link', 'url', 'marca d’água', 'shorts'],
    icone: 'baixar',
    servidor: true,
    servidorDetalhe: 'O link passa pelo nosso servidor para buscar o vídeo. Nada fica guardado.',
    popular: true,
    passos: [
      'Copie o link do vídeo no app ou no navegador (Compartilhar → Copiar link).',
      'Cole aqui: a plataforma é reconhecida sozinha e as qualidades aparecem.',
      'Escolha vídeo ou áudio e a qualidade. Os formatos HD e o MP3 são preparados no seu navegador.',
    ],
    perguntas: [
      {
        p: 'O vídeo do TikTok sai sem marca d’água?',
        r: 'Sim. Baixamos o arquivo original, sem a marca d’água e sem o @ do app. O 540p sai na hora; 1080p e 720p chegam em H.265 e são convertidos para H.264 no seu navegador para abrir em qualquer player.',
      },
      {
        p: 'Quais formatos do YouTube posso baixar?',
        r: 'Vídeo de 144p até 4K (quando o vídeo tem) e áudio em MP3, M4A ou WebM. Acima de 360p o YouTube entrega imagem e som separados, e o seu navegador junta os dois.',
      },
      {
        p: 'Posso usar o que eu baixar como quiser?',
        r: 'Não necessariamente. Direitos autorais continuam valendo: baixe seus próprios vídeos ou conteúdo que o autor permite usar.',
      },
    ],
  },
  {
    slug: 'video/baixar-do-youtube',
    modulo: 'video/baixar',
    predef: { plataforma: 'youtube' },
    nome: 'Baixar do YouTube',
    titulo: 'Baixar vídeos do YouTube em MP4 e MP3',
    resumo: 'MP4 de 144p a 4K, MP3, M4A e Shorts.',
    descricao: 'Baixe vídeos do YouTube em MP4 de 144p a 4K, ou só o áudio em MP3 e M4A. Shorts também. Grátis, sem anúncios e sem cadastro.',
    termos: ['youtube', 'yt', 'mp3', 'mp4', 'shorts', 'música', 'download'],
    icone: 'youtube',
    servidor: true,
    servidorDetalhe: 'O link passa pelo nosso servidor para buscar o vídeo. Nada fica guardado.',
    passos: [
      'Copie o link do vídeo do YouTube (Compartilhar → Copiar link).',
      'Cole aqui e veja o título, a duração e as qualidades disponíveis.',
      'Escolha a qualidade ou o MP3 e baixe.',
    ],
  },
  {
    slug: 'video/baixar-do-tiktok',
    modulo: 'video/baixar',
    predef: { plataforma: 'tiktok' },
    nome: 'Baixar do TikTok',
    titulo: 'Baixar vídeos do TikTok sem marca d’água',
    resumo: 'Vídeo original sem marca d’água, ou MP3.',
    descricao: 'Baixe vídeos do TikTok sem marca d’água em MP4, ou só o áudio em MP3. Funciona com o link curto do app. Grátis e sem cadastro.',
    termos: ['tiktok', 'marca d’água', 'watermark', 'mp4', 'mp3', 'download'],
    icone: 'tiktok',
    servidor: true,
    servidorDetalhe: 'O link passa pelo nosso servidor para buscar o vídeo. Nada fica guardado.',
    popular: true,
    passos: [
      'No TikTok, toque em Compartilhar → Copiar link.',
      'Cole aqui: aceitamos o link completo e o curto (vm.tiktok.com).',
      'Escolha a qualidade ou o MP3 e baixe sem marca d’água.',
    ],
  },
]

// ─── Consultas ──────────────────────────────────────────────────────────────

const porSlug = new Map(ferramentas.map((f) => [f.slug, f]))

export const ferramentaPorSlug = (slug) => porSlug.get(slug) ?? null
export const categoriaPorId = (id) => categorias.find((c) => c.id === id) ?? null
export const ferramentasDaCategoria = (id) => ferramentas.filter((f) => f.slug.split('/')[0] === id)
export const categoriaDa = (ferramenta) => categoriaPorId(ferramenta.slug.split('/')[0])
export const caminhoDa = (ferramenta) => `/${ferramenta.slug}`
export const populares = () => ferramentas.filter((f) => f.popular)

/** Só as categorias que já têm ao menos uma ferramenta. */
export const categoriasComFerramentas = () => categorias.filter((c) => ferramentasDaCategoria(c.id).length > 0)

/** "Conversão" → "conversao": a busca ignora acentos e maiúsculas. */
export const normalizar = (texto) =>
  String(texto ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()

/**
 * Busca por nome, resumo e sinônimos. Cada palavra digitada precisa aparecer
 * em algum campo; acertos no nome valem mais.
 */
export function buscarFerramentas(consulta, limite = 12) {
  const palavras = normalizar(consulta).split(/\s+/).filter(Boolean)
  if (!palavras.length) return []
  const resultados = []
  for (const f of ferramentas) {
    const nome = normalizar(f.nome)
    const resto = normalizar([f.titulo, f.resumo, categoriaDa(f)?.nome, ...(f.termos ?? [])].join(' '))
    let pontos = 0
    for (const p of palavras) {
      if (nome.includes(p)) pontos += nome.startsWith(p) ? 4 : 3
      else if (resto.includes(p)) pontos += 1
      else {
        pontos = 0
        break
      }
    }
    if (pontos) resultados.push({ f, pontos })
  }
  return resultados
    .sort((a, b) => b.pontos - a.pontos || (b.f.popular ? 1 : 0) - (a.f.popular ? 1 : 0))
    .slice(0, limite)
    .map((r) => r.f)
}
