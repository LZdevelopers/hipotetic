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
 *   novo       mostra o selo "Novo" no cartão
 *   telaCheia  editor que ocupa a tela inteira (largura toda, título compacto)
 *   perguntas  perguntas frequentes da página [{ p, r }]
 *   requer     recurso de infraestrutura necessário (ex.: 'documentos' = serviço
 *              LibreOffice). Sem o recurso ativo no build, a ferramenta NÃO aparece.
 */

/** Recursos ativos neste build (variáveis VITE_*). */
const RECURSOS = {
  documentos: import.meta.env?.VITE_DOCUMENTOS === '1',
}

export const categorias = [
  {
    id: 'video',
    nome: 'Vídeo',
    titulo: 'Ferramentas de vídeo',
    descricao: 'Baixe do YouTube e do TikTok, edite com vários clipes, texto e música, comprima, junte e divida — direto no navegador.',
    icone: 'video',
  },
  {
    id: 'audio',
    nome: 'Áudio',
    titulo: 'Ferramentas de áudio',
    descricao: 'Edite, grave sua voz, limpe ruído, junte e divida áudios e edite as tags e a capa de músicas.',
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

const TODAS = [
  // ─── Conversor único (todos os tipos de arquivo) ──────────────────────────
  {
    slug: 'converter',
    modulo: 'conversor/converter',
    nome: 'Conversor de arquivos',
    titulo: 'Conversor de arquivos online',
    resumo: 'Solte qualquer arquivo e escolha o formato: vídeo, áudio, imagem, PDF, documento.',
    descricao: 'Converta vídeos, áudios, imagens, PDFs, documentos e compactados: solte o arquivo, o formato é reconhecido e você escolhe para qual converter. Grátis.',
    termos: [
      'converter', 'conversor', 'formato', 'mp4', 'webm', 'mov', 'mkv', 'avi', 'gif', 'mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a', 'opus',
      'jpg', 'jpeg', 'png', 'webp', 'avif', 'svg', 'bmp', 'pdf', 'word', 'docx', 'doc', 'odt', 'rtf', 'txt', 'html', 'markdown',
      'zip', 'rar', '7z', 'tar', 'vídeo para mp3', 'mp4 para mp3', 'vídeo para gif', 'gif para mp4', 'png para jpg', 'webp para png',
      'pdf para jpg', 'jpg para pdf', 'imagem para pdf', 'word para pdf', 'docx para pdf', 'rar para zip', 'extrair áudio',
    ],
    icone: 'conversor',
    popular: true,
    perguntas: [
      { p: 'Meus arquivos são enviados para algum servidor?', r: 'Vídeos, áudios, imagens, PDFs e compactados são convertidos no seu próprio aparelho e não saem dele. Só documentos (DOCX, ODT, RTF…) vão ao nosso servidor, onde o LibreOffice converte e apaga o arquivo na hora.' },
      { p: 'Quais formatos posso converter?', r: 'Vídeo (MP4, MOV, MKV, WebM, AVI, GIF…), áudio (MP3, WAV, M4A, FLAC, OGG, OPUS…), imagem (JPG, PNG, WebP, AVIF, SVG, GIF…), PDF (para imagem ou texto), documentos (DOCX, ODT, RTF, Markdown) e compactados (ZIP, RAR, 7Z, TAR).' },
      { p: 'Tem limite de tamanho?', r: 'O limite é a memória do aparelho: vídeos até cerca de 2 GB, imagens até 60 MB. Documentos convertidos no servidor vão até 4,4 MB.' },
    ],
  },
  // ─── Vídeo ────────────────────────────────────────────────────────────────
  {
    slug: 'video/baixar',
    modulo: 'video/baixar',
    nome: 'Baixar vídeo',
    titulo: 'Baixar vídeos do YouTube e do TikTok',
    resumo: 'Cole o link e baixe em MP4 ou MP3. TikTok sem marca d’água.',
    descricao: 'Baixe vídeos do YouTube e do TikTok pelo link: MP4 até 4K, MP3, miniatura e TikTok sem marca d’água. Grátis e sem cadastro.',
    termos: ['download', 'youtube', 'tiktok', 'mp3', 'mp4', 'link', 'url', 'marca d’água', 'shorts', 'baixar música'],
    icone: 'baixar',
    servidor: true,
    servidorDetalhe: 'O link passa pelo nosso servidor para buscar o vídeo. Nada fica guardado.',
    popular: true,
    perguntas: [
      { p: 'O vídeo do TikTok sai sem marca d’água?', r: 'Sim. Baixamos o arquivo original, sem a marca d’água e sem o @ do app.' },
      { p: 'Posso usar o que eu baixar como quiser?', r: 'Não necessariamente. Direitos autorais continuam valendo: baixe seus próprios vídeos ou conteúdo que o autor permite usar.' },
    ],
  },
  {
    slug: 'video/comprimir',
    modulo: 'video/comprimir',
    nome: 'Comprimir vídeo',
    titulo: 'Comprimir vídeo: reduzir o tamanho',
    resumo: 'Por nível ou para caber num tamanho, como 16 MB.',
    descricao: 'Reduza o tamanho de vídeos por nível de compressão ou para caber num limite, como os 16 MB do WhatsApp. Direto no navegador.',
    termos: ['comprimir', 'reduzir', 'diminuir', 'tamanho', 'mb', 'whatsapp', 'email', 'pesado'],
    icone: 'comprimir',
    popular: true,
  },
  {
    slug: 'video/editor',
    modulo: 'video/editor',
    telaCheia: true,
    nome: 'Editor de vídeo',
    novo: true,
    titulo: 'Editor de vídeo online: juntar, cortar, recortar, texto e música',
    resumo: 'Timeline com vídeos, imagens e GIFs, crop, camadas, texto, blur e áudio.',
    descricao: 'Timeline com vídeos, imagens e GIFs: trim, crop, velocidade, camadas, texto com várias fontes, blur e áudio (noise reduction, LUFS, ducking). Prévia ao vivo.',
    termos: ['editar', 'editor', 'juntar', 'cortar', 'aparar', 'dividir', 'recortar', 'crop', 'proporção', 'vertical', 'reels', 'velocidade', 'acelerar', 'câmera lenta', 'texto', 'legenda', 'logo', 'marca d’água', 'picture in picture', 'desfoque', 'borrar rosto', 'música', 'trilha', 'girar', 'cores', 'fade', 'capcut', 'trim', 'blur', 'pixelate', 'mosaico', 'chroma key', 'fonte', 'ducking', 'loudness', 'ruído', 'imagem', 'gif', 'slideshow'],
    icone: 'filme',
    popular: true,
  },
  {
    slug: 'video/juntar-dividir',
    modulo: 'video/juntar-dividir',
    nome: 'Juntar e dividir',
    titulo: 'Juntar vídeos ou dividir um vídeo em partes',
    resumo: 'Una vários vídeos ou corte um em partes.',
    descricao: 'Junte vários vídeos em um, mesmo de tamanhos diferentes, ou divida um vídeo em partes iguais, a cada X segundos ou em tempos escolhidos.',
    termos: ['juntar', 'unir', 'mesclar', 'emendar', 'dividir', 'separar', 'partes', 'stories', 'segmentar'],
    icone: 'unir',
  },

  // ─── Áudio ────────────────────────────────────────────────────────────────
  {
    slug: 'audio/editor',
    modulo: 'audio/editor',
    telaCheia: true,
    nome: 'Editor de áudio',
    titulo: 'Editor de áudio: cortar, volume, silêncio e velocidade',
    resumo: 'Cortar com fade, volume, tirar silêncio e acelerar.',
    descricao: 'Corte um trecho vendo a forma de onda, com fade, ajuste ou normalize o volume, remova silêncios e mude a velocidade. Tudo no navegador.',
    termos: ['cortar', 'aparar', 'toque', 'ringtone', 'fade', 'volume', 'normalizar', 'silêncio', 'velocidade', 'acelerar', 'podcast'],
    icone: 'onda',
    popular: true,
  },
  {
    slug: 'audio/gravador',
    modulo: 'audio/gravador',
    nome: 'Gravador de voz',
    novo: true,
    titulo: 'Gravador de voz online',
    resumo: 'Grave do microfone com redução de ruído e baixe em MP3.',
    descricao: 'Grave sua voz pelo microfone com redução de ruído e de eco, pause quando quiser e baixe em MP3, WAV ou M4A. Grátis, sem cadastro e sem enviar nada.',
    termos: ['gravar', 'gravador', 'microfone', 'voz', 'narração', 'podcast', 'áudio', 'mp3', 'memo', 'nota de voz'],
    icone: 'microfone',
    popular: true,
  },
  {
    slug: 'audio/melhorar-voz',
    modulo: 'audio/melhorar-voz',
    nome: 'Limpar e melhorar voz',
    novo: true,
    titulo: 'Remover ruído e melhorar a voz de áudios e vídeos',
    resumo: 'Tire chiado e zumbido, deixe a voz clara e no volume certo.',
    descricao: 'Remova ruído de fundo, chiado e zumbido, deixe a voz mais clara e o volume no padrão de podcasts. Compare antes e depois. Funciona com áudio e vídeo.',
    termos: ['ruído', 'chiado', 'barulho', 'zumbido', 'limpar', 'melhorar', 'voz', 'podcast', 'aula', 'redução de ruído', 'noise', 'volume', 'loudness', 'lufs'],
    icone: 'magica',
  },
  {
    slug: 'audio/juntar-dividir',
    modulo: 'audio/juntar-dividir',
    nome: 'Juntar e dividir',
    titulo: 'Juntar áudios ou dividir um áudio em partes',
    resumo: 'Una faixas, ou divida nas pausas, por tempo ou em partes iguais.',
    descricao: 'Junte músicas e gravações com pausa ou transição suave, ou divida um áudio longo nas pausas, a cada X minutos ou em partes iguais, sem perder qualidade.',
    termos: ['juntar', 'unir', 'mesclar', 'emendar', 'crossfade', 'dividir', 'separar', 'cortar em partes', 'faixas', 'pausas', 'audiobook'],
    icone: 'unir',
  },
  {
    slug: 'audio/tags',
    modulo: 'audio/tags',
    nome: 'Tags e capa',
    novo: true,
    titulo: 'Editar tags de música: título, artista, álbum e capa',
    resumo: 'Título, artista, álbum, ano e capa de MP3, M4A e FLAC.',
    descricao: 'Edite as tags de músicas MP3, M4A, FLAC e OGG: título, artista, álbum, ano, faixa, gênero e capa do álbum, sem recomprimir o áudio.',
    termos: ['tags', 'id3', 'metadados', 'capa', 'álbum', 'artista', 'título', 'mp3tag', 'música', 'informações'],
    icone: 'musica',
  },

  // ─── Imagens ──────────────────────────────────────────────────────────────
  {
    slug: 'imagem/comprimir',
    modulo: 'imagem/editor',
    predef: { modo: 'comprimir' },
    nome: 'Comprimir imagens',
    titulo: 'Comprimir imagens JPG, PNG e WebP',
    resumo: 'Reduza o tamanho sem perder qualidade visível.',
    descricao: 'Reduza o tamanho de fotos e imagens JPG, PNG, WebP e AVIF com MozJPEG e OxiPNG, em lote e sem perda visível. Grátis e privado.',
    termos: ['comprimir', 'compactar', 'reduzir', 'diminuir', 'otimizar', 'peso', 'kb', 'tamanho', 'tinypng'],
    icone: 'comprimir',
    popular: true,
  },
  {
    slug: 'imagem/editor',
    modulo: 'imagem/editor',
    nome: 'Editor de imagem',
    titulo: 'Editor de imagem: recortar, girar, redimensionar e filtros',
    resumo: 'Recortar, girar, redimensionar, cores e filtros, em lote.',
    descricao: 'Recorte, gire, espelhe, redimensione (inclusive para redes sociais), ajuste brilho e contraste e aplique filtros, em lote e com prévia.',
    termos: ['editar', 'recortar', 'cortar', 'crop', 'girar', 'espelhar', 'redimensionar', 'resize', 'tamanho', 'instagram', 'redes sociais', 'brilho', 'contraste', 'filtro', 'preto e branco'],
    icone: 'ajustar',
    popular: true,
  },
  {
    slug: 'imagem/metadados',
    modulo: 'imagem/metadados',
    nome: 'Metadados de imagem',
    titulo: 'Ver e remover metadados EXIF e GPS de fotos',
    resumo: 'Veja câmera, data e GPS, e remova sem perder qualidade.',
    descricao: 'Veja formato, dimensões e os metadados EXIF de fotos (câmera, data, localização GPS) e remova tudo sem recomprimir a imagem.',
    termos: ['metadados', 'exif', 'gps', 'localização', 'privacidade', 'informações', 'câmera', 'remover exif', 'propriedades'],
    icone: 'info',
  },
  {
    slug: 'imagem/favicon',
    modulo: 'imagem/favicon',
    nome: 'Criar favicon',
    titulo: 'Gerador de favicon (ICO, PNG e Apple Touch)',
    resumo: 'favicon.ico, ícones PNG e o código para o site.',
    descricao: 'Gere favicon.ico, ícones PNG, apple-touch-icon e site.webmanifest a partir de uma imagem ou SVG, com o código HTML pronto.',
    termos: ['favicon', 'ico', 'ícone', 'site', 'apple touch', 'manifest', 'pwa'],
    icone: 'moldura',
  },
  {
    slug: 'imagem/miniatura',
    modulo: 'imagem/miniatura',
    nome: 'Criar miniatura',
    titulo: 'Criar miniatura (thumbnail) de imagem ou vídeo',
    resumo: 'Escolha o quadro do vídeo e adicione um título.',
    descricao: 'Crie miniaturas (thumbnails) para YouTube e redes a partir de uma imagem ou de um quadro de vídeo, com título opcional.',
    termos: ['thumbnail', 'miniatura', 'capa', 'youtube', 'quadro', 'frame', 'poster'],
    icone: 'imagemBaixar',
  },
  {
    slug: 'imagem/cores',
    modulo: 'imagem/cores',
    nome: 'Paleta de cores',
    titulo: 'Extrair a paleta de cores de uma imagem',
    resumo: 'Cores predominantes e conta-gotas em HEX e RGB.',
    descricao: 'Descubra as cores predominantes de uma imagem e pegue cores com conta-gotas. Copie em HEX, RGB, HSL, CSS ou JSON.',
    termos: ['cores', 'paleta', 'hex', 'rgb', 'hsl', 'conta-gotas', 'color picker'],
    icone: 'paleta',
  },

  // ─── PDF ──────────────────────────────────────────────────────────────────
  {
    slug: 'pdf/unir',
    modulo: 'pdf/editor',
    predef: { modo: 'unir' },
    telaCheia: true,
    nome: 'Unir PDF',
    titulo: 'Unir PDF: juntar vários arquivos em um',
    resumo: 'Junte vários PDFs em um só, na ordem que quiser.',
    descricao: 'Junte vários PDFs em um único arquivo, escolhendo a ordem, com sumário opcional. Grátis e sem enviar nada para servidores.',
    termos: ['unir', 'juntar', 'mesclar', 'combinar', 'merge', 'agrupar'],
    icone: 'unir',
    popular: true,
  },
  {
    slug: 'pdf/dividir',
    modulo: 'pdf/editor',
    predef: { modo: 'dividir' },
    telaCheia: true,
    nome: 'Dividir PDF',
    titulo: 'Dividir PDF ou extrair páginas',
    resumo: 'Por página, a cada N, por intervalos ou só algumas.',
    descricao: 'Separe um PDF em vários (cada página, a cada N páginas, por intervalos) ou crie um PDF só com as páginas que escolher.',
    termos: ['dividir', 'separar', 'split', 'extrair páginas', 'partes', 'selecionar páginas'],
    icone: 'dividir',
    popular: true,
  },
  {
    slug: 'pdf/editor',
    modulo: 'pdf/editor',
    telaCheia: true,
    nome: 'Editor de PDF',
    novo: true,
    titulo: 'Editor de PDF online: organizar, juntar, anotar, assinar e numerar',
    resumo: 'Organize, junte, anote, assine e numere numa tela só.',
    descricao: 'Abra um ou vários PDFs e faça tudo numa tela: organize as páginas, junte arquivos, escreva, assine, numere, ponha marca d’água e baixe só o que quiser.',
    termos: ['editor', 'editar', 'organizar', 'reordenar', 'girar', 'rotacionar', 'excluir páginas', 'apagar páginas', 'duplicar', 'adicionar páginas', 'página em branco', 'juntar', 'unir', 'extrair páginas', 'assinar', 'assinatura', 'escrever', 'preencher', 'anotar', 'destacar', 'imagem', 'nota', 'rubrica', 'numerar', 'número de página', 'marca d’água', 'metadados', 'título', 'autor', 'senha', 'proteger'],
    icone: 'pdf',
    popular: true,
    perguntas: [
      { p: 'É uma assinatura digital com certificado?', r: 'Não. É a imagem da sua assinatura no documento, como assinar no papel. Assinaturas com certificado (ICP-Brasil) exigem um certificado próprio.' },
      { p: 'Se eu fechar a página, perco o que fiz?', r: 'Não. O projeto (os PDFs e tudo o que você fez) fica salvo só neste navegador e volta quando você abrir o editor de novo.' },
    ],
  },
  {
    slug: 'pdf/comprimir',
    modulo: 'pdf/comprimir',
    nome: 'Comprimir PDF',
    titulo: 'Comprimir PDF: reduzir o tamanho',
    resumo: 'Diminua o PDF mantendo o texto selecionável.',
    descricao: 'Reduza o tamanho do PDF recomprimindo as fotos e otimizando a estrutura. O texto continua selecionável. Grátis e no navegador.',
    termos: ['comprimir', 'compactar', 'reduzir', 'diminuir', 'otimizar', 'pesado', 'mb', 'email'],
    icone: 'comprimir',
    popular: true,
  },
  {
    slug: 'pdf/ocr',
    modulo: 'pdf/ocr',
    nome: 'OCR em PDF',
    titulo: 'OCR: transformar PDF digitalizado em pesquisável',
    resumo: 'Reconheça o texto de PDFs digitalizados e fotos.',
    descricao: 'Reconheça o texto de PDFs digitalizados e fotos de documentos e gere um PDF pesquisável ou um .txt. OCR em português, no navegador.',
    termos: ['ocr', 'reconhecer texto', 'digitalizado', 'escaneado', 'pesquisável', 'foto de documento', 'imagem para texto'],
    icone: 'ocr',
  },
  {
    slug: 'pdf/numerar-marca-dagua',
    modulo: 'pdf/editor',
    predef: { modo: 'numerar' },
    telaCheia: true,
    nome: 'Numerar e marca d’água',
    titulo: 'Numerar páginas e colocar marca d’água no PDF',
    resumo: 'Números de página e marca d’água de texto ou logo.',
    descricao: 'Numere as páginas do PDF no canto e formato que quiser, ou coloque uma marca d’água de texto ou imagem em todas as páginas.',
    termos: ['numerar', 'números de página', 'paginação', 'marca d’água', 'marca dagua', 'watermark', 'carimbo', 'confidencial'],
    icone: 'carimbo',
  },
  {
    slug: 'pdf/senha',
    modulo: 'pdf/senha',
    nome: 'Senha do PDF',
    titulo: 'Colocar ou remover senha de PDF',
    resumo: 'Proteja com AES-256 ou tire a senha que você tem.',
    descricao: 'Proteja um PDF com senha AES-256 e permissões, ou remova a senha de um PDF que você tem autorização para abrir.',
    termos: ['senha', 'proteger', 'criptografar', 'bloquear', 'desbloquear', 'remover senha', 'tirar senha'],
    icone: 'pdfCadeado',
  },
  {
    slug: 'pdf/comparar',
    modulo: 'pdf/comparar',
    nome: 'Comparar PDFs',
    titulo: 'Comparar dois PDFs',
    resumo: 'Veja o que mudou entre duas versões.',
    descricao: 'Compare duas versões de um PDF: o texto que entrou e saiu, página a página, e as diferenças visuais destacadas.',
    termos: ['comparar', 'diferença', 'diff', 'versões', 'alterações', 'revisão'],
    icone: 'comparar',
  },
  {
    slug: 'pdf/metadados',
    modulo: 'pdf/metadados',
    nome: 'Metadados do PDF',
    titulo: 'Ver, editar e remover metadados do PDF',
    resumo: 'Título, autor, datas e versão; edite ou limpe.',
    descricao: 'Veja as informações de um PDF (páginas, papel, versão, datas), edite título e autor ou remova todos os metadados.',
    termos: ['metadados', 'propriedades', 'informações', 'autor', 'título', 'remover metadados', 'xmp'],
    icone: 'info',
  },

  // ─── Documentos ───────────────────────────────────────────────────────────
  {
    slug: 'documentos/visualizar',
    modulo: 'documentos/visualizar',
    nome: 'Visualizar documento',
    titulo: 'Abrir DOCX e outros documentos sem o Word',
    resumo: 'Leia DOCX, ODT, RTF e TXT no navegador.',
    descricao: 'Abra e leia documentos DOCX com a formatação, além de ODT, RTF, HTML e TXT, sem instalar o Word nem enviar o arquivo.',
    termos: ['abrir', 'visualizar', 'ler', 'docx', 'word', 'sem word', 'odt', 'rtf'],
    icone: 'ver',
  },
  {
    slug: 'documentos/texto',
    modulo: 'documentos/texto',
    nome: 'Texto e contagem',
    titulo: 'Extrair texto e contar palavras de documentos',
    resumo: 'Texto de DOCX, PDF e ODT, palavras e caracteres.',
    descricao: 'Extraia o texto de DOCX, ODT, RTF e PDF e conte palavras, caracteres, frases e tempo de leitura, ou cole um texto para contar.',
    termos: ['texto', 'extrair texto', 'txt', 'contar palavras', 'contador', 'caracteres', 'tcc', 'redação', 'tempo de leitura'],
    icone: 'texto',
    popular: true,
  },
  {
    slug: 'documentos/metadados',
    modulo: 'documentos/metadados',
    nome: 'Metadados do documento',
    titulo: 'Ver e remover metadados de DOCX e ODT',
    resumo: 'Autor, empresa, datas e revisões do arquivo.',
    descricao: 'Veja quem criou e editou um DOCX ou ODT, a empresa, as datas e o tempo de edição, e remova esses dados sem mexer no conteúdo.',
    termos: ['metadados', 'autor', 'propriedades', 'remover autor', 'privacidade', 'docx', 'odt'],
    icone: 'borracha',
  },
  {
    slug: 'documentos/markdown',
    modulo: 'documentos/markdown',
    nome: 'Markdown para HTML',
    titulo: 'Converter Markdown para HTML (e PDF)',
    resumo: 'Prévia ao vivo, HTML completo e PDF.',
    descricao: 'Escreva ou abra Markdown e gere HTML limpo, com prévia ao vivo, tabelas e estilo opcional. Salve também como PDF.',
    termos: ['markdown', 'md', 'html', 'readme', 'md para html', 'md para pdf'],
    icone: 'arquivoCodigo',
  },

  // ─── Compactados ──────────────────────────────────────────────────────────
  {
    slug: 'compactados/compactar',
    modulo: 'compactados/compactar',
    nome: 'Compactar arquivos',
    titulo: 'Compactar arquivos e pastas em ZIP, 7Z ou TAR.GZ',
    resumo: 'ZIP, 7Z e TAR.GZ, com senha e pastas inteiras.',
    descricao: 'Compacte arquivos e pastas inteiras em ZIP, 7Z, TAR ou TAR.GZ, com nível de compressão e senha AES-256. Grátis e no navegador.',
    termos: ['compactar', 'zipar', 'zip', '7z', 'tar', 'gz', 'pasta', 'senha', 'criar zip'],
    icone: 'pastaCompactada',
    popular: true,
    perguntas: [{ p: 'Posso criar RAR?', r: 'Não. RAR é proprietário: só o WinRAR cria. Use ZIP (abre em tudo) ou 7Z (compressão maior).' }],
  },
  {
    slug: 'compactados/extrair',
    modulo: 'compactados/extrair',
    nome: 'Extrair arquivos',
    titulo: 'Extrair ZIP, RAR, 7Z, TAR e GZ',
    resumo: 'Veja o conteúdo e extraia tudo ou só o que quiser.',
    descricao: 'Abra ZIP, RAR, 7Z, TAR, GZ e outros, veja o que tem dentro e extraia tudo ou só alguns arquivos, inclusive com senha. Baixe como ZIP.',
    termos: ['extrair', 'descompactar', 'abrir', 'unzip', 'rar', 'zip', '7z', 'unrar', 'rar para zip', 'converter rar'],
    icone: 'extrair',
    popular: true,
  },

  // ─── Utilitários ──────────────────────────────────────────────────────────
  {
    slug: 'utilitarios/qr-code',
    modulo: 'utilitarios/qr-code',
    nome: 'QR Code',
    titulo: 'Gerador de QR Code (link, Wi-Fi, WhatsApp)',
    resumo: 'Links, Wi-Fi, WhatsApp, contato e mais.',
    descricao: 'Crie QR Codes para links, senha do Wi-Fi, WhatsApp, e-mail e cartão de contato, com cores, em PNG ou SVG. Não expira.',
    termos: ['qr', 'qr code', 'qrcode', 'wifi', 'whatsapp', 'link', 'gerar qr'],
    icone: 'qr',
    popular: true,
  },
  {
    slug: 'utilitarios/hash',
    modulo: 'utilitarios/hash',
    nome: 'Hash de arquivos',
    titulo: 'Gerar e verificar hash MD5, SHA-1, SHA-256 e SHA-512',
    resumo: 'MD5, SHA-256 e outros, com verificação.',
    descricao: 'Calcule MD5, SHA-1, SHA-256, SHA-512 e CRC32 de arquivos de qualquer tamanho ou de textos, e confira com o hash publicado.',
    termos: ['hash', 'md5', 'sha1', 'sha256', 'sha512', 'crc32', 'checksum', 'integridade'],
    icone: 'hash',
  },
  {
    slug: 'utilitarios/identificar',
    modulo: 'utilitarios/identificar',
    nome: 'Identificar arquivo',
    titulo: 'Identificar o tipo real e as propriedades de um arquivo',
    resumo: 'Formato real pelos bytes, dimensões e duração.',
    descricao: 'Descubra o formato real de um arquivo pela assinatura dos bytes, mesmo com extensão errada, e veja dimensões, duração e páginas.',
    termos: ['identificar', 'tipo', 'formato', 'extensão', 'mime', 'propriedades', 'que arquivo é'],
    icone: 'arquivoTipo',
  },
  {
    slug: 'utilitarios/comparar',
    modulo: 'utilitarios/comparar-arquivos',
    nome: 'Comparar arquivos',
    titulo: 'Comparar dois arquivos',
    resumo: 'São idênticos? Se forem texto, o que mudou.',
    descricao: 'Saiba se dois arquivos são idênticos byte a byte e, se forem de texto, veja as linhas que mudaram. Sem enviar os arquivos.',
    termos: ['comparar', 'diferença', 'diff', 'idêntico', 'igual', 'duplicado'],
    icone: 'comparar',
  },
  {
    slug: 'utilitarios/calculadoras',
    modulo: 'utilitarios/calculadoras',
    nome: 'Calculadoras',
    titulo: 'Converter KB, MB e GB e calcular tempo de download',
    resumo: 'Unidades de tamanho, download e compressão.',
    descricao: 'Converta tamanhos entre bytes, KB, MB, GB, TB e KiB/MiB/GiB, e calcule o tempo de download e a taxa de compressão.',
    termos: ['converter', 'kb', 'mb', 'gb', 'tb', 'gib', 'unidades', 'tempo de download', 'velocidade', 'mbps', 'compressão'],
    icone: 'calculadora',
  },
  {
    slug: 'utilitarios/texto',
    modulo: 'utilitarios/texto',
    nome: 'Editor de texto',
    titulo: 'Abrir e criar arquivos de texto (TXT, CSV, JSON)',
    resumo: 'Abra com a codificação certa ou crie um novo.',
    descricao: 'Abra TXT, CSV, JSON e LOG com busca e a codificação certa (acentos corrigidos), ou escreva e salve um novo arquivo de texto.',
    termos: ['texto', 'txt', 'abrir', 'criar', 'csv', 'json', 'log', 'codificação', 'acentos', 'utf-8', 'bloco de notas'],
    icone: 'texto',
  },
  {
    slug: 'utilitarios/base64',
    modulo: 'utilitarios/base64',
    nome: 'Base64',
    titulo: 'Converter arquivo para Base64 e Base64 para arquivo',
    resumo: 'Data URI, CSS e HTML, e o caminho inverso.',
    descricao: 'Transforme imagens e outros arquivos em Base64 (data URI, CSS, HTML ou Markdown) ou decodifique Base64 de volta em arquivo.',
    termos: ['base64', 'data uri', 'codificar', 'decodificar', 'css', 'embed', 'imagem para base64'],
    icone: 'binario',
  },
]

export const ferramentas = TODAS.filter((f) => !f.requer || RECURSOS[f.requer])

// ─── Consultas ──────────────────────────────────────────────────────────────

const porSlug = new Map(ferramentas.map((f) => [f.slug, f]))

/** Endereços antigos que viraram outra ferramenta (continuam abrindo a nova). */
export const APELIDOS = {
  'pdf/organizar': 'pdf/editor',
  'pdf/editar': 'pdf/editor',
}

export const ferramentaPorSlug = (slug) => porSlug.get(slug) ?? null
export const categoriaPorId = (id) => categorias.find((c) => c.id === id) ?? null
export const ferramentasDaCategoria = (id) => ferramentas.filter((f) => f.slug.split('/')[0] === id)
export const categoriaDa = (ferramenta) => (ferramenta.slug.includes('/') ? categoriaPorId(ferramenta.slug.split('/')[0]) : null)
/** Cor do selo da ferramenta: a da categoria, ou a do conversor (que não tem categoria). */
export const corDa = (ferramenta) => categoriaDa(ferramenta)?.id ?? 'conversor'
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
