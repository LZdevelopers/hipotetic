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
  // ─── Imagens ───────────────────────────────────────────────────────────────
  {
    slug: 'imagem/converter',
    modulo: 'imagem/converter',
    nome: 'Converter imagens',
    titulo: 'Converter imagens para JPG, PNG, WebP e AVIF',
    resumo: 'JPG, PNG, WebP, AVIF, GIF, BMP e SVG, em lote.',
    descricao: 'Converta imagens entre JPG, PNG, WebP e AVIF em lote, com controle de qualidade. Aceita também GIF, BMP e SVG. Tudo no navegador.',
    termos: ['converter', 'formato', 'jpg', 'jpeg', 'png', 'webp', 'avif', 'gif', 'bmp', 'svg', 'transformar'],
    icone: 'substituir',
    popular: true,
    passos: [
      'Arraste as imagens ou cole com Ctrl+V. Pode ser um lote inteiro.',
      'Escolha o formato de saída e a qualidade.',
      'Converta e baixe uma a uma ou tudo em um ZIP.',
    ],
    perguntas: [
      {
        p: 'Qual formato devo escolher?',
        r: 'JPG para fotos que precisam abrir em qualquer lugar; PNG para logos e imagens com transparência sem perda; WebP para sites (bem menor, com transparência); AVIF para o menor tamanho possível em navegadores atuais.',
      },
      {
        p: 'As imagens são enviadas para algum servidor?',
        r: 'Não. A conversão acontece no seu navegador, com WebAssembly. As imagens não saem do seu aparelho.',
      },
      {
        p: 'E a transparência ao converter para JPG?',
        r: 'JPG não tem transparência: as áreas transparentes recebem a cor de fundo que você escolher (branco, por padrão).',
      },
    ],
  },
  {
    slug: 'imagem/comprimir',
    modulo: 'imagem/comprimir',
    nome: 'Comprimir imagens',
    titulo: 'Comprimir imagens JPG, PNG e WebP',
    resumo: 'Reduza o tamanho mantendo a qualidade visual.',
    descricao: 'Reduza o tamanho de fotos e imagens JPG, PNG, WebP e AVIF com MozJPEG e OxiPNG, em lote e sem perder qualidade visível. Grátis e privado.',
    termos: ['comprimir', 'compactar', 'reduzir', 'diminuir', 'otimizar', 'peso', 'kb', 'mb', 'tamanho', 'tinypng'],
    icone: 'comprimir',
    popular: true,
    passos: [
      'Arraste as imagens (JPG, PNG, WebP ou AVIF).',
      'Escolha o nível de compressão e, se quiser, reduza as dimensões.',
      'Compare os tamanhos e baixe.',
    ],
    perguntas: [
      {
        p: 'Quanto o arquivo diminui?',
        r: 'Fotos de celular costumam cair de 60% a 90%, principalmente ao reduzir para 1920 px. Imagens que já estavam otimizadas mudam pouco; nesse caso devolvemos a original, nunca um arquivo maior.',
      },
      {
        p: 'O PNG perde qualidade?',
        r: 'Não. PNG é recomprimido sem perdas (OxiPNG). Para reduzir muito mais, converta para WebP.',
      },
    ],
  },
  {
    slug: 'imagem/redimensionar',
    modulo: 'imagem/redimensionar',
    nome: 'Redimensionar imagens',
    titulo: 'Redimensionar imagens em lote',
    resumo: 'Por porcentagem, medidas exatas ou lado maior.',
    descricao: 'Mude o tamanho de imagens por porcentagem, largura e altura ou lado maior, mantendo a proporção. Em lote, com alta qualidade, no navegador.',
    termos: ['redimensionar', 'resize', 'tamanho', 'dimensões', 'largura', 'altura', 'pixels', 'diminuir', 'aumentar', 'escala'],
    icone: 'regua',
    popular: true,
    passos: ['Arraste as imagens.', 'Escolha como redimensionar: porcentagem, medidas ou lado maior.', 'Gere e baixe.'],
  },
  {
    slug: 'imagem/recortar',
    modulo: 'imagem/recortar',
    nome: 'Recortar imagem',
    titulo: 'Recortar imagem online',
    resumo: 'Corte livre ou em proporções como 1:1 e 16:9.',
    descricao: 'Recorte imagens arrastando a seleção ou digitando as medidas exatas, com proporções prontas (1:1, 4:3, 16:9, 9:16). Grátis, no navegador.',
    termos: ['recortar', 'cortar', 'crop', 'proporção', 'quadrado', 'enquadrar'],
    icone: 'recortar',
    passos: [
      'Escolha a imagem.',
      'Arraste a área de recorte ou digite as medidas. Use as setas do teclado para ajustes finos.',
      'Recorte e baixe.',
    ],
  },
  {
    slug: 'imagem/girar',
    modulo: 'imagem/girar',
    nome: 'Girar e espelhar',
    titulo: 'Girar e espelhar imagens',
    resumo: 'Gire 90°, 180° e espelhe, em lote.',
    descricao: 'Gire imagens 90° ou 180° e espelhe na horizontal ou na vertical, várias de uma vez. Com prévia, direto no navegador.',
    termos: ['girar', 'rotacionar', 'rodar', 'espelhar', 'inverter', 'virar', 'flip', 'rotate'],
    icone: 'girar',
    passos: ['Arraste as imagens.', 'Gire e espelhe conferindo na prévia.', 'Aplique e baixe.'],
  },
  {
    slug: 'imagem/ajustar',
    modulo: 'imagem/ajustar',
    nome: 'Ajustar cores e filtros',
    titulo: 'Ajustar brilho, contraste e aplicar filtros',
    resumo: 'Brilho, contraste, saturação e filtros prontos.',
    descricao: 'Ajuste brilho, contraste, saturação e matiz, aplique filtros como preto e branco, sépia e vintage, com prévia ao vivo e em lote.',
    termos: [
      'brilho',
      'contraste',
      'saturação',
      'filtro',
      'preto e branco',
      'sépia',
      'vintage',
      'cor',
      'editar',
      'matiz',
      'desfoque',
      'negativo',
    ],
    icone: 'ajustar',
    passos: [
      'Arraste as imagens.',
      'Escolha um filtro ou mexa nos ajustes. Segure “comparar” para ver o original.',
      'Aplique em todas e baixe.',
    ],
  },
  {
    slug: 'imagem/remover-metadados',
    modulo: 'imagem/remover-metadados',
    nome: 'Remover metadados',
    titulo: 'Remover metadados EXIF e GPS de fotos',
    resumo: 'Tire localização, câmera e datas sem perder qualidade.',
    descricao: 'Remova EXIF, GPS, XMP e IPTC de fotos JPG, PNG e WebP sem recomprimir: a imagem fica idêntica. Proteja sua privacidade antes de compartilhar.',
    termos: ['metadados', 'exif', 'gps', 'localização', 'privacidade', 'limpar', 'remover', 'xmp', 'iptc'],
    icone: 'borracha',
    passos: [
      'Arraste as fotos.',
      'Clique em remover: só os metadados saem, os pixels continuam iguais.',
      'Baixe e compartilhe com segurança.',
    ],
    perguntas: [
      {
        p: 'A foto vai aparecer deitada depois?',
        r: 'Não. Quando a foto depende da orientação gravada pela câmera, mantemos só essa informação, sem nenhum dado pessoal.',
      },
    ],
  },
  {
    slug: 'imagem/informacoes',
    modulo: 'imagem/informacoes',
    nome: 'Informações da imagem',
    titulo: 'Ver informações e metadados EXIF da imagem',
    resumo: 'Dimensões, formato, câmera, data e GPS.',
    descricao: 'Veja formato real, dimensões, megapixels, proporção e os metadados EXIF de uma foto: câmera, lente, data e localização GPS.',
    termos: ['exif', 'metadados', 'informações', 'dimensões', 'resolução', 'câmera', 'gps', 'visualizar', 'propriedades'],
    icone: 'info',
    passos: [
      'Escolha a imagem.',
      'Veja as informações do arquivo e os metadados.',
      'Se houver localização, remova os metadados antes de compartilhar.',
    ],
  },
  {
    slug: 'imagem/favicon',
    modulo: 'imagem/favicon',
    nome: 'Criar favicon',
    titulo: 'Gerador de favicon (ICO, PNG e Apple Touch)',
    resumo: 'favicon.ico, ícones PNG e o código para o site.',
    descricao: 'Gere favicon.ico, ícones PNG, apple-touch-icon e site.webmanifest a partir de uma imagem ou SVG, com o código HTML pronto para copiar.',
    termos: ['favicon', 'ico', 'ícone', 'icon', 'site', 'apple touch', 'manifest', 'pwa'],
    icone: 'moldura',
    passos: [
      'Escolha um logo, de preferência quadrado ou em SVG.',
      'Ajuste fundo, margem e cantos conferindo nas prévias.',
      'Baixe o ZIP e cole o código no <head> do site.',
    ],
  },
  {
    slug: 'imagem/tamanhos-redes-sociais',
    modulo: 'imagem/tamanhos',
    nome: 'Tamanhos para redes sociais',
    titulo: 'Gerar imagem nos tamanhos das redes sociais',
    resumo: 'Instagram, YouTube, X, LinkedIn e mais de uma vez.',
    descricao: 'Gere a mesma imagem nos tamanhos certos para Instagram, Stories, YouTube, Facebook, X e LinkedIn, ou em medidas personalizadas, de uma só vez.',
    termos: [
      'instagram',
      'stories',
      'youtube',
      'facebook',
      'linkedin',
      'twitter',
      'redes sociais',
      'tamanhos',
      'dimensões',
      'post',
      'capa',
      'banner',
    ],
    icone: 'imagens',
    passos: [
      'Escolha as imagens.',
      'Marque os tamanhos (ou digite medidas próprias) e como encaixar.',
      'Gere tudo e baixe em ZIP.',
    ],
  },
  {
    slug: 'imagem/miniatura',
    modulo: 'imagem/miniatura',
    nome: 'Criar miniatura',
    titulo: 'Criar miniatura (thumbnail) de imagem ou vídeo',
    resumo: 'Escolha o quadro do vídeo e adicione um título.',
    descricao: 'Crie miniaturas (thumbnails) para YouTube e redes a partir de uma imagem ou de um quadro de vídeo, com título opcional. Grátis, no navegador.',
    termos: ['thumbnail', 'miniatura', 'capa', 'youtube', 'quadro', 'frame', 'vídeo', 'poster'],
    icone: 'imagemBaixar',
    passos: [
      'Escolha uma imagem ou um vídeo.',
      'No vídeo, arraste para escolher o quadro. Adicione um título, se quiser.',
      'Gere e baixe.',
    ],
  },
  {
    slug: 'imagem/cores',
    modulo: 'imagem/cores',
    nome: 'Extrair cores',
    titulo: 'Extrair a paleta de cores de uma imagem',
    resumo: 'Cores predominantes em HEX, RGB e HSL.',
    descricao: 'Descubra as cores predominantes de uma imagem e pegue cores com conta-gotas. Copie em HEX, RGB, HSL, CSS ou JSON.',
    termos: ['cores', 'paleta', 'hex', 'rgb', 'hsl', 'conta-gotas', 'eyedropper', 'color picker', 'extrair'],
    icone: 'paleta',
    passos: [
      'Escolha a imagem.',
      'Veja as cores predominantes e clique na imagem para pegar cores exatas.',
      'Copie as cores no formato que precisar.',
    ],
  },
  {
    slug: 'imagem/base64',
    modulo: 'imagem/base64',
    nome: 'Imagem para Base64',
    titulo: 'Converter imagem para Base64 e Base64 para imagem',
    resumo: 'Data URI, CSS, HTML e o caminho inverso.',
    descricao: 'Transforme uma imagem em Base64 (data URI, CSS, HTML ou Markdown) ou decodifique Base64 de volta em imagem para baixar.',
    termos: ['base64', 'data uri', 'datauri', 'codificar', 'decodificar', 'css', 'embed', 'inline'],
    icone: 'binario',
    passos: [
      'Escolha o sentido: imagem para Base64 ou o contrário.',
      'Envie a imagem ou cole o texto em Base64.',
      'Copie o resultado ou baixe a imagem.',
    ],
  },
  {
    slug: 'imagem/png-para-jpg',
    modulo: 'imagem/converter',
    predef: { entrada: 'png', saida: 'jpg' },
    nome: 'PNG para JPG',
    titulo: 'Converter PNG para JPG',
    resumo: 'Fotos mais leves; transparência vira fundo branco.',
    descricao: 'Converta PNG para JPG em lote e reduza o tamanho das imagens. Escolha a qualidade e a cor de fundo da transparência. Grátis e no navegador.',
    termos: ['png', 'jpg', 'converter', 'png para jpg', 'png em jpg'],
    icone: 'substituir',
    passos: [
      'Arraste as imagens PNG (pode ser um lote).',
      'Ajuste a qualidade, se quiser.',
      'Converta e baixe uma a uma ou tudo em ZIP.',
    ],
  },
  {
    slug: 'imagem/jpg-para-png',
    modulo: 'imagem/converter',
    predef: { entrada: 'jpg', saida: 'png' },
    nome: 'JPG para PNG',
    titulo: 'Converter JPG para PNG',
    resumo: 'Sem perdas, para editar sem degradar.',
    descricao: 'Converta JPG para PNG em lote, sem perda adicional de qualidade. Ideal para editar a imagem depois. Grátis e no navegador.',
    termos: ['jpg', 'png', 'converter', 'jpg para png', 'jpg em png'],
    icone: 'substituir',
    passos: [
      'Arraste as imagens JPG (pode ser um lote).',
      'Ajuste a qualidade, se quiser.',
      'Converta e baixe uma a uma ou tudo em ZIP.',
    ],
  },
  {
    slug: 'imagem/png-para-webp',
    modulo: 'imagem/converter',
    predef: { entrada: 'png', saida: 'webp' },
    nome: 'PNG para WebP',
    titulo: 'Converter PNG para WebP',
    resumo: 'Bem menor, mantendo a transparência.',
    descricao: 'Converta PNG para WebP e reduza muito o tamanho, mantendo a transparência. Em lote, grátis e sem enviar as imagens para servidores.',
    termos: ['png', 'webp', 'converter', 'png para webp', 'png em webp'],
    icone: 'substituir',
    passos: [
      'Arraste as imagens PNG (pode ser um lote).',
      'Ajuste a qualidade, se quiser.',
      'Converta e baixe uma a uma ou tudo em ZIP.',
    ],
  },
  {
    slug: 'imagem/webp-para-png',
    modulo: 'imagem/converter',
    predef: { entrada: 'webp', saida: 'png' },
    nome: 'WebP para PNG',
    titulo: 'Converter WebP para PNG',
    resumo: 'Para abrir em qualquer programa.',
    descricao: 'Converta imagens WebP para PNG para abrir em qualquer programa ou editor. Em lote, grátis e direto no navegador.',
    termos: ['webp', 'png', 'converter', 'webp para png', 'webp em png'],
    icone: 'substituir',
    passos: [
      'Arraste as imagens WebP (pode ser um lote).',
      'Ajuste a qualidade, se quiser.',
      'Converta e baixe uma a uma ou tudo em ZIP.',
    ],
  },
  {
    slug: 'imagem/jpg-para-webp',
    modulo: 'imagem/converter',
    predef: { entrada: 'jpg', saida: 'webp' },
    nome: 'JPG para WebP',
    titulo: 'Converter JPG para WebP',
    resumo: 'Fotos até 30% menores para sites.',
    descricao: 'Converta fotos JPG para WebP e deixe seu site mais rápido: arquivos menores com a mesma qualidade visual. Em lote e grátis.',
    termos: ['jpg', 'webp', 'converter', 'jpg para webp', 'jpg em webp'],
    icone: 'substituir',
    passos: [
      'Arraste as imagens JPG (pode ser um lote).',
      'Ajuste a qualidade, se quiser.',
      'Converta e baixe uma a uma ou tudo em ZIP.',
    ],
  },
  {
    slug: 'imagem/webp-para-jpg',
    modulo: 'imagem/converter',
    predef: { entrada: 'webp', saida: 'jpg' },
    nome: 'WebP para JPG',
    titulo: 'Converter WebP para JPG',
    resumo: 'Compatível com todo aparelho e programa.',
    descricao: 'Converta WebP para JPG para abrir e compartilhar em qualquer aparelho. Em lote, com controle de qualidade, no navegador.',
    termos: ['webp', 'jpg', 'converter', 'webp para jpg', 'webp em jpg'],
    icone: 'substituir',
    passos: [
      'Arraste as imagens WebP (pode ser um lote).',
      'Ajuste a qualidade, se quiser.',
      'Converta e baixe uma a uma ou tudo em ZIP.',
    ],
  },
  {
    slug: 'imagem/svg-para-png',
    modulo: 'imagem/converter',
    predef: { entrada: 'svg', saida: 'png' },
    nome: 'SVG para PNG',
    titulo: 'Converter SVG para PNG',
    resumo: 'Vetor em imagem, no tamanho que quiser.',
    descricao: 'Converta SVG para PNG em 1×, 2×, 4× ou 8× o tamanho original, com transparência. Grátis e direto no navegador.',
    termos: ['svg', 'png', 'converter', 'svg para png', 'svg em png'],
    icone: 'substituir',
    passos: [
      'Arraste as imagens SVG (pode ser um lote).',
      'Ajuste a qualidade, se quiser.',
      'Converta e baixe uma a uma ou tudo em ZIP.',
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
