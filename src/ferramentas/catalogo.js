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
  // ─── PDF ───────────────────────────────────────────────────────────────────
  {
    slug: 'pdf/unir',
    modulo: 'pdf/unir',
    nome: 'Unir PDF',
    titulo: 'Unir PDF: juntar vários arquivos em um',
    resumo: 'Junte vários PDFs em um só, na ordem que quiser.',
    descricao: 'Junte vários PDFs em um único arquivo, escolhendo a ordem, com sumário opcional. Grátis, sem limite de arquivos e sem enviar nada para servidores.',
    termos: ['unir', 'juntar', 'mesclar', 'combinar', 'merge', 'agrupar', 'concatenar'],
    icone: 'unir',
    popular: true,
    passos: ['Adicione os PDFs (dois ou mais).', 'Ordene a lista com as setas.', 'Clique em unir e baixe o PDF final.'],
    perguntas: [
      {
        p: 'Os arquivos vão para algum servidor?',
        r: 'Não. A união acontece no seu navegador: os PDFs não saem do seu aparelho.',
      },
      {
        p: 'E se um dos PDFs tiver senha?',
        r: 'Desbloqueie antes com a ferramenta “Desbloquear PDF”, usando a senha dele.',
      },
    ],
  },
  {
    slug: 'pdf/dividir',
    modulo: 'pdf/dividir',
    nome: 'Dividir PDF',
    titulo: 'Dividir PDF em vários arquivos',
    resumo: 'Por página, a cada N páginas ou por intervalos.',
    descricao: 'Separe um PDF em vários: uma página por arquivo, a cada N páginas ou por intervalos como 1-3, 4-8. Grátis e direto no navegador.',
    termos: ['dividir', 'separar', 'split', 'quebrar', 'partes', 'desmembrar'],
    icone: 'dividir',
    popular: true,
    passos: [
      'Escolha o PDF.',
      'Escolha como dividir: cada página, a cada N ou por intervalos.',
      'Baixe as partes (ou tudo em ZIP).',
    ],
  },
  {
    slug: 'pdf/extrair-paginas',
    modulo: 'pdf/dividir',
    predef: { modo: 'extrair' },
    nome: 'Extrair páginas',
    titulo: 'Extrair páginas de um PDF',
    resumo: 'Um PDF novo só com as páginas que você escolher.',
    descricao: 'Crie um novo PDF só com as páginas que você escolher, por exemplo 1, 3 e 5-7, na ordem que quiser. Grátis e no navegador.',
    termos: ['extrair', 'páginas', 'selecionar', 'copiar páginas', 'salvar páginas'],
    icone: 'extrair',
    passos: ['Escolha o PDF.', 'Digite as páginas, como 1, 3, 5-7.', 'Baixe o novo PDF.'],
  },
  {
    slug: 'pdf/organizar',
    modulo: 'pdf/organizar',
    nome: 'Organizar PDF',
    titulo: 'Organizar páginas do PDF',
    resumo: 'Reordene, gire, exclua, duplique e adicione páginas.',
    descricao: 'Organize as páginas do PDF arrastando miniaturas: mude a ordem, gire, exclua, duplique, adicione páginas em branco ou de outro PDF.',
    termos: [
      'organizar',
      'reordenar',
      'ordem',
      'mover páginas',
      'girar',
      'excluir',
      'apagar páginas',
      'duplicar',
      'adicionar páginas',
      'inserir',
    ],
    icone: 'galeria',
    popular: true,
    passos: [
      'Escolha o PDF: as páginas aparecem como miniaturas.',
      'Arraste para reordenar e use os botões para girar, duplicar ou excluir.',
      'Salve o PDF organizado.',
    ],
  },
  {
    slug: 'pdf/excluir-paginas',
    modulo: 'pdf/organizar',
    predef: { foco: 'excluir' },
    nome: 'Excluir páginas',
    titulo: 'Excluir páginas de um PDF',
    resumo: 'Tire as páginas que você não quer.',
    descricao: 'Remova páginas de um PDF clicando nas miniaturas: veja o que está apagando antes de salvar. Grátis e sem enviar o arquivo.',
    termos: ['excluir', 'apagar', 'remover', 'deletar', 'tirar páginas'],
    icone: 'apagar',
    passos: ['Escolha o PDF.', 'Selecione as páginas a remover e clique em excluir.', 'Salve o PDF.'],
  },
  {
    slug: 'pdf/girar',
    modulo: 'pdf/organizar',
    predef: { foco: 'girar' },
    nome: 'Girar PDF',
    titulo: 'Girar páginas do PDF',
    resumo: 'Gire uma página ou todas, de 90 em 90°.',
    descricao: 'Gire páginas de um PDF de 90 em 90 graus, uma a uma ou todas de uma vez, vendo as miniaturas. Grátis e direto no navegador.',
    termos: ['girar', 'rotacionar', 'virar', 'rodar', 'deitado', 'de cabeça para baixo', 'rotate'],
    icone: 'girar',
    passos: ['Escolha o PDF.', 'Gire as páginas que precisar.', 'Salve o PDF.'],
  },
  {
    slug: 'pdf/editar',
    modulo: 'pdf/editar',
    nome: 'Editar PDF',
    titulo: 'Editar PDF: adicionar texto, imagens e destaques',
    resumo: 'Texto, imagens, destaques, notas e retângulos.',
    descricao: 'Escreva sobre o PDF, insira imagens, destaque trechos, adicione notas e retângulos e assine. Tudo no navegador, sem enviar o arquivo.',
    termos: ['editar', 'escrever', 'adicionar texto', 'preencher', 'anotar', 'destacar', 'marcar', 'imagem', 'nota', 'comentar'],
    icone: 'caneta',
    popular: true,
    passos: [
      'Escolha o PDF.',
      'Escolha a ferramenta (texto, imagem, destaque…) e clique onde quer colocar.',
      'Ajuste, mova e salve o PDF.',
    ],
  },
  {
    slug: 'pdf/assinar',
    modulo: 'pdf/editar',
    predef: { ferramenta: 'assinatura' },
    nome: 'Assinar PDF',
    titulo: 'Assinar PDF online',
    resumo: 'Desenhe, digite ou envie sua assinatura.',
    descricao: 'Assine PDFs desenhando com o mouse ou o dedo, digitando seu nome ou enviando uma foto da assinatura. Grátis e sem enviar o documento.',
    termos: ['assinar', 'assinatura', 'rubrica', 'sign', 'firmar'],
    icone: 'assinatura',
    popular: true,
    passos: [
      'Escolha o PDF.',
      'Crie a assinatura: desenhe, digite ou envie uma imagem.',
      'Clique onde ela vai, ajuste o tamanho e salve.',
    ],
    perguntas: [
      {
        p: 'É uma assinatura digital com certificado?',
        r: 'Não. É a imagem da sua assinatura no documento, como assinar no papel. Assinaturas com certificado digital (ICP-Brasil) exigem um certificado próprio.',
      },
    ],
  },
  {
    slug: 'pdf/comprimir',
    modulo: 'pdf/comprimir',
    nome: 'Comprimir PDF',
    titulo: 'Comprimir PDF: reduzir o tamanho',
    resumo: 'Diminua o PDF mantendo o texto selecionável.',
    descricao: 'Reduza o tamanho do PDF recomprimindo as fotos e otimizando a estrutura. O texto continua selecionável. Grátis e no navegador.',
    termos: ['comprimir', 'compactar', 'reduzir', 'diminuir', 'otimizar', 'tamanho', 'pesado', 'mb', 'email'],
    icone: 'comprimir',
    popular: true,
    passos: ['Escolha o PDF.', 'Escolha o nível de compressão.', 'Compare os tamanhos e baixe.'],
    perguntas: [
      {
        p: 'Por que meu PDF diminuiu pouco?',
        r: 'A compressão age principalmente nas fotos. PDFs só de texto já costumam ser pequenos; nesse caso, só a estrutura é otimizada.',
      },
    ],
  },
  {
    slug: 'pdf/para-jpg',
    modulo: 'pdf/para-imagens',
    nome: 'PDF para JPG',
    titulo: 'Converter PDF para JPG',
    resumo: 'Cada página vira uma imagem JPG.',
    descricao: 'Converta cada página do PDF em uma imagem JPG, de 72 a 300 dpi, todas de uma vez ou só as páginas escolhidas. Grátis e no navegador.',
    termos: ['pdf para jpg', 'pdf em jpg', 'pdf para imagem', 'converter pdf', 'jpeg', 'foto'],
    icone: 'imagem',
    popular: true,
    passos: ['Escolha o PDF.', 'Escolha a resolução e as páginas.', 'Baixe as imagens (ou o ZIP).'],
  },
  {
    slug: 'pdf/para-png',
    modulo: 'pdf/para-imagens',
    predef: { formato: 'png' },
    nome: 'PDF para PNG',
    titulo: 'Converter PDF para PNG',
    resumo: 'Páginas em PNG, sem perdas.',
    descricao: 'Converta páginas de PDF em imagens PNG nítidas, sem perda de qualidade, de 72 a 300 dpi. Grátis e direto no navegador.',
    termos: ['pdf para png', 'pdf em png', 'pdf para imagem', 'converter pdf'],
    icone: 'imagem',
    passos: ['Escolha o PDF.', 'Escolha a resolução e as páginas.', 'Baixe as imagens.'],
  },
  {
    slug: 'pdf/de-imagens',
    modulo: 'pdf/de-imagens',
    nome: 'Imagens para PDF',
    titulo: 'Converter imagens (JPG, PNG) para PDF',
    resumo: 'Junte fotos e imagens num PDF.',
    descricao: 'Transforme fotos e imagens JPG, PNG e WebP em um PDF, uma por página, em A4, Carta ou no tamanho da imagem. Grátis e no navegador.',
    termos: ['imagem para pdf', 'jpg para pdf', 'png para pdf', 'foto para pdf', 'juntar fotos', 'digitalizar'],
    icone: 'pdfBaixar',
    popular: true,
    passos: ['Adicione as imagens e ordene.', 'Escolha o tamanho da página e a margem.', 'Crie e baixe o PDF.'],
  },
  {
    slug: 'pdf/para-texto',
    modulo: 'pdf/para-texto',
    nome: 'PDF para texto',
    titulo: 'Extrair texto de PDF (PDF para TXT)',
    resumo: 'Copie ou baixe o texto do PDF.',
    descricao: 'Extraia todo o texto de um PDF para copiar ou baixar como .txt, separado por página. Para PDFs digitalizados, use o OCR.',
    termos: ['texto', 'txt', 'extrair texto', 'copiar texto', 'pdf para txt', 'pdf para word'],
    icone: 'texto',
    passos: ['Escolha o PDF.', 'Extraia o texto.', 'Copie ou baixe o .txt.'],
  },
  {
    slug: 'pdf/ocr',
    modulo: 'pdf/ocr',
    nome: 'OCR em PDF',
    titulo: 'OCR: transformar PDF digitalizado em pesquisável',
    resumo: 'Reconheça o texto de PDFs digitalizados e fotos.',
    descricao: 'Reconheça o texto de PDFs digitalizados e fotos de documentos e gere um PDF pesquisável ou um .txt. OCR em português, no seu navegador.',
    termos: [
      'ocr',
      'reconhecer texto',
      'digitalizado',
      'escaneado',
      'scanner',
      'pesquisável',
      'foto de documento',
      'imagem para texto',
    ],
    icone: 'ocr',
    popular: true,
    passos: [
      'Escolha o PDF digitalizado ou a foto do documento.',
      'Escolha o idioma do texto.',
      'Baixe o PDF pesquisável ou o texto.',
    ],
    perguntas: [
      {
        p: 'O documento vai para algum servidor?',
        r: 'Não. O reconhecimento roda no seu navegador. Só o modelo do idioma é baixado na primeira vez, sem nenhum dado seu.',
      },
    ],
  },
  {
    slug: 'pdf/numerar-paginas',
    modulo: 'pdf/numerar',
    nome: 'Numerar páginas',
    titulo: 'Adicionar números de página ao PDF',
    resumo: 'Numeração em qualquer canto, em vários formatos.',
    descricao: 'Numere as páginas do PDF no canto que quiser, no formato “1”, “1 / 10” ou “Página 1 de 10”, pulando a capa se precisar.',
    termos: ['numerar', 'números', 'paginação', 'número de página', 'rodapé'],
    icone: 'lista',
    passos: ['Escolha o PDF.', 'Escolha a posição, o formato e onde começar.', 'Baixe o PDF numerado.'],
  },
  {
    slug: 'pdf/marca-dagua',
    modulo: 'pdf/marca-dagua',
    nome: 'Marca d’água',
    titulo: 'Adicionar marca d’água ao PDF',
    resumo: 'Texto ou logo, em diagonal, centro ou mosaico.',
    descricao: 'Coloque uma marca d’água de texto ou imagem em todas as páginas do PDF, com opacidade, cor e disposição ajustáveis.',
    termos: ['marca d’água', 'marca dagua', 'watermark', 'carimbo', 'confidencial', 'logo'],
    icone: 'carimbo',
    passos: ['Escolha o PDF.', 'Escreva o texto ou escolha a imagem e ajuste.', 'Baixe o PDF com a marca.'],
  },
  {
    slug: 'pdf/proteger',
    modulo: 'pdf/proteger',
    nome: 'Proteger PDF',
    titulo: 'Proteger PDF com senha',
    resumo: 'Senha AES-256 e permissões de uso.',
    descricao: 'Coloque senha no PDF com criptografia AES-256 e escolha se quem abrir pode imprimir, copiar ou modificar. Grátis e no navegador.',
    termos: ['senha', 'proteger', 'criptografar', 'bloquear', 'segurança', 'password'],
    icone: 'pdfCadeado',
    passos: ['Escolha o PDF.', 'Defina a senha e as permissões.', 'Baixe o PDF protegido.'],
  },
  {
    slug: 'pdf/desbloquear',
    modulo: 'pdf/desbloquear',
    nome: 'Desbloquear PDF',
    titulo: 'Remover senha de PDF',
    resumo: 'Tire a senha de um PDF quando você a tem.',
    descricao: 'Remova a senha de um PDF que você tem autorização para abrir, informando a senha. Não quebramos senhas de arquivos de terceiros.',
    termos: ['desbloquear', 'remover senha', 'tirar senha', 'descriptografar', 'unlock'],
    icone: 'desbloquear',
    passos: ['Escolha o PDF protegido.', 'Digite a senha dele.', 'Baixe o PDF sem senha.'],
  },
  {
    slug: 'pdf/comparar',
    modulo: 'pdf/comparar',
    nome: 'Comparar PDFs',
    titulo: 'Comparar dois PDFs',
    resumo: 'Veja o que mudou entre duas versões.',
    descricao: 'Compare duas versões de um PDF: o texto que entrou e saiu, página a página, e as diferenças visuais destacadas em vermelho.',
    termos: ['comparar', 'diferença', 'diff', 'versões', 'alterações', 'revisão', 'mudanças'],
    icone: 'comparar',
    passos: [
      'Escolha o PDF original e a nova versão.',
      'Compare.',
      'Veja as diferenças de texto e as visuais, página a página.',
    ],
  },
  {
    slug: 'pdf/informacoes',
    modulo: 'pdf/metadados',
    nome: 'Informações do PDF',
    titulo: 'Ver e editar informações e metadados do PDF',
    resumo: 'Título, autor, datas, páginas e versão.',
    descricao: 'Veja as informações de um PDF (páginas, tamanho do papel, versão, datas) e edite título, autor, assunto e palavras-chave.',
    termos: ['metadados', 'propriedades', 'informações', 'autor', 'título', 'versão', 'editar metadados'],
    icone: 'info',
    passos: ['Escolha o PDF.', 'Veja as informações e edite o que quiser.', 'Salve o PDF.'],
  },
  {
    slug: 'pdf/remover-metadados',
    modulo: 'pdf/metadados',
    predef: { modo: 'limpar' },
    nome: 'Remover metadados do PDF',
    titulo: 'Remover metadados do PDF',
    resumo: 'Apague autor, programa e datas do arquivo.',
    descricao: 'Remova autor, programa de origem, datas e metadados XMP de um PDF antes de compartilhar. Grátis e sem enviar o arquivo.',
    termos: ['metadados', 'limpar', 'remover autor', 'privacidade', 'anonimizar', 'xmp'],
    icone: 'borracha',
    passos: ['Escolha o PDF.', 'Confira os metadados encontrados.', 'Remova e baixe.'],
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
