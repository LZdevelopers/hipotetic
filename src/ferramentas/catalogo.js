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
 *   enxuta     true = página só com a ferramenta (sem "Como usar", perguntas e relacionadas),
 *              para editores que precisam da tela inteira
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
    icone: 'substituir',
    popular: true,
    passos: [
      'Solte os arquivos (ou clique em Escolher arquivos). Pode misturar tipos.',
      'Em cada arquivo, escolha para qual formato converter: só aparecem os que funcionam para ele.',
      'Clique em Converter e baixe um a um ou tudo em ZIP.',
    ],
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
    passos: [
      'Copie o link do vídeo no app ou no navegador (Compartilhar → Copiar link).',
      'Cole aqui: a plataforma é reconhecida sozinha e as qualidades aparecem.',
      'Escolha vídeo ou só o áudio e a qualidade, e baixe.',
    ],
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
    passos: ['Escolha o vídeo.', 'Escolha o nível ou o tamanho máximo em MB.', 'Comprima e compare os tamanhos.'],
  },
  {
    slug: 'video/editor',
    modulo: 'video/editor',
    nome: 'Editor de vídeo',
    titulo: 'Editor de vídeo: cortar, girar, proporção, velocidade e música',
    resumo: 'Cortar trecho, 9:16, girar, acelerar, silenciar e pôr música.',
    descricao: 'Corte trechos, mude a proporção para Reels ou feed, gire, redimensione, acelere, silencie ou coloque música, com prévia. No navegador.',
    termos: ['editar', 'cortar', 'aparar', 'trecho', 'girar', 'proporção', 'vertical', '9:16', 'reels', 'velocidade', 'câmera lenta', 'silenciar', 'sem som', 'música', 'trilha', 'adicionar áudio'],
    icone: 'filme',
    popular: true,
    passos: ['Escolha o vídeo.', 'Ajuste o trecho, a proporção, o giro, a velocidade e o som, vendo a prévia.', 'Exporte e baixe.'],
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
    passos: ['Escolha juntar ou dividir.', 'Adicione os vídeos e ajuste.', 'Gere e baixe.'],
  },

  // ─── Áudio ────────────────────────────────────────────────────────────────
  {
    slug: 'audio/editor',
    modulo: 'audio/editor',
    nome: 'Editor de áudio',
    titulo: 'Editor de áudio: cortar, volume, silêncio e velocidade',
    resumo: 'Cortar com fade, volume, tirar silêncio e acelerar.',
    descricao: 'Corte um trecho vendo a forma de onda, com fade, ajuste ou normalize o volume, remova silêncios e mude a velocidade. Tudo no navegador.',
    termos: ['cortar', 'aparar', 'toque', 'ringtone', 'fade', 'volume', 'normalizar', 'silêncio', 'velocidade', 'acelerar', 'podcast'],
    icone: 'onda',
    popular: true,
    enxuta: true,
  },
  {
    slug: 'audio/juntar',
    modulo: 'audio/unir',
    nome: 'Juntar áudios',
    titulo: 'Juntar áudios e músicas em um arquivo',
    resumo: 'Una faixas com pausa ou transição suave.',
    descricao: 'Junte várias músicas ou gravações em um arquivo, emendando direto, com pausa ou com transição suave (crossfade). Grátis e no navegador.',
    termos: ['juntar', 'unir', 'mesclar', 'mixar', 'emendar', 'crossfade', 'playlist'],
    icone: 'unir',
    passos: ['Adicione os áudios e ordene.', 'Escolha a transição e o formato.', 'Junte e baixe.'],
  },

  // ─── Imagens ──────────────────────────────────────────────────────────────
  {
    slug: 'imagem/comprimir',
    modulo: 'imagem/comprimir',
    nome: 'Comprimir imagens',
    titulo: 'Comprimir imagens JPG, PNG e WebP',
    resumo: 'Reduza o tamanho sem perder qualidade visível.',
    descricao: 'Reduza o tamanho de fotos e imagens JPG, PNG, WebP e AVIF com MozJPEG e OxiPNG, em lote e sem perda visível. Grátis e privado.',
    termos: ['comprimir', 'compactar', 'reduzir', 'diminuir', 'otimizar', 'peso', 'kb', 'tamanho', 'tinypng'],
    icone: 'comprimir',
    popular: true,
    passos: ['Arraste as imagens.', 'Escolha o nível de compressão e, se quiser, reduza as dimensões.', 'Compare os tamanhos e baixe.'],
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
    passos: ['Escolha uma ou várias imagens.', 'Use as abas: recortar, girar, tamanho, cores e formato de saída.', 'Aplique e baixe.'],
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
    passos: ['Escolha as fotos.', 'Veja o que cada uma revela.', 'Remova os metadados e baixe.'],
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
    passos: ['Escolha o logo (de preferência quadrado ou SVG).', 'Ajuste fundo, margem e cantos.', 'Baixe o ZIP e cole o código no <head>.'],
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
    passos: ['Escolha uma imagem ou um vídeo.', 'Escolha o quadro e, se quiser, um título.', 'Gere e baixe.'],
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
    passos: ['Escolha a imagem.', 'Veja as cores e clique na imagem para pegar uma cor exata.', 'Copie no formato que precisar.'],
  },

  // ─── PDF ──────────────────────────────────────────────────────────────────
  {
    slug: 'pdf/unir',
    modulo: 'pdf/unir',
    nome: 'Unir PDF',
    titulo: 'Unir PDF: juntar vários arquivos em um',
    resumo: 'Junte vários PDFs em um só, na ordem que quiser.',
    descricao: 'Junte vários PDFs em um único arquivo, escolhendo a ordem, com sumário opcional. Grátis e sem enviar nada para servidores.',
    termos: ['unir', 'juntar', 'mesclar', 'combinar', 'merge', 'agrupar'],
    icone: 'unir',
    popular: true,
    passos: ['Adicione os PDFs.', 'Ordene a lista.', 'Una e baixe.'],
  },
  {
    slug: 'pdf/dividir',
    modulo: 'pdf/dividir',
    nome: 'Dividir PDF',
    titulo: 'Dividir PDF ou extrair páginas',
    resumo: 'Por página, a cada N, por intervalos ou só algumas.',
    descricao: 'Separe um PDF em vários (cada página, a cada N páginas, por intervalos) ou crie um PDF só com as páginas que escolher.',
    termos: ['dividir', 'separar', 'split', 'extrair páginas', 'partes', 'selecionar páginas'],
    icone: 'dividir',
    popular: true,
    passos: ['Escolha o PDF.', 'Escolha como dividir ou quais páginas extrair.', 'Baixe as partes.'],
  },
  {
    slug: 'pdf/organizar',
    modulo: 'pdf/organizar',
    nome: 'Organizar PDF',
    titulo: 'Organizar PDF: reordenar, girar, excluir e adicionar páginas',
    resumo: 'Reordene, gire, exclua e adicione páginas vendo tudo.',
    descricao: 'Organize as páginas do PDF arrastando miniaturas: reordene, gire, exclua, duplique e adicione páginas em branco ou de outro PDF.',
    termos: ['organizar', 'reordenar', 'girar', 'rotacionar', 'excluir páginas', 'apagar páginas', 'duplicar', 'adicionar páginas', 'mover'],
    icone: 'galeria',
    popular: true,
    passos: ['Escolha o PDF.', 'Arraste, gire, duplique ou exclua as páginas.', 'Salve o PDF.'],
  },
  {
    slug: 'pdf/editar',
    modulo: 'pdf/editar',
    nome: 'Editar e assinar PDF',
    titulo: 'Editar e assinar PDF',
    resumo: 'Texto, assinatura, imagens, destaques e notas.',
    descricao: 'Escreva sobre o PDF, assine (desenhando, digitando ou com foto), insira imagens, destaque trechos e adicione notas. No navegador.',
    termos: ['editar', 'assinar', 'assinatura', 'escrever', 'preencher', 'anotar', 'destacar', 'imagem', 'nota', 'rubrica'],
    icone: 'assinatura',
    popular: true,
    passos: ['Escolha o PDF.', 'Escolha a ferramenta e clique onde quer colocar.', 'Ajuste e salve.'],
    perguntas: [{ p: 'É uma assinatura digital com certificado?', r: 'Não. É a imagem da sua assinatura no documento, como assinar no papel. Assinaturas com certificado (ICP-Brasil) exigem um certificado próprio.' }],
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
    passos: ['Escolha o PDF.', 'Escolha o nível de compressão.', 'Compare os tamanhos e baixe.'],
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
    passos: ['Escolha o PDF digitalizado ou a foto.', 'Escolha o idioma.', 'Baixe o PDF pesquisável ou o texto.'],
  },
  {
    slug: 'pdf/numerar-marca-dagua',
    modulo: 'pdf/numerar-marca',
    nome: 'Numerar e marca d’água',
    titulo: 'Numerar páginas e colocar marca d’água no PDF',
    resumo: 'Números de página e marca d’água de texto ou logo.',
    descricao: 'Numere as páginas do PDF no canto e formato que quiser, ou coloque uma marca d’água de texto ou imagem em todas as páginas.',
    termos: ['numerar', 'números de página', 'paginação', 'marca d’água', 'marca dagua', 'watermark', 'carimbo', 'confidencial'],
    icone: 'carimbo',
    passos: ['Escolha numerar ou marca d’água.', 'Escolha o PDF e ajuste.', 'Baixe.'],
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
    passos: ['Escolha colocar ou remover a senha.', 'Escolha o PDF e digite a senha.', 'Baixe.'],
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
    passos: ['Escolha o original e a nova versão.', 'Compare.', 'Veja as diferenças página a página.'],
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
    passos: ['Escolha o PDF.', 'Veja e edite as informações.', 'Salve ou remova tudo.'],
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
    passos: ['Escolha o documento.', 'Leia direto na página.', 'Abra outro quando quiser.'],
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
    passos: ['Escolha um documento ou cole o texto.', 'Veja as contagens.', 'Copie ou baixe o texto.'],
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
    passos: ['Escolha o DOCX ou ODT.', 'Veja os metadados.', 'Remova e baixe.'],
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
    passos: ['Escreva ou abra um .md.', 'Confira a prévia.', 'Baixe o HTML ou salve como PDF.'],
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
    passos: ['Adicione os arquivos ou uma pasta.', 'Escolha o formato, o nível e, se quiser, uma senha.', 'Compacte e baixe.'],
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
    passos: ['Escolha o arquivo compactado.', 'Marque o que quer (ou tudo).', 'Baixe: vários arquivos saem juntos num ZIP.'],
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
    passos: ['Escolha o tipo e preencha.', 'Ajuste as cores.', 'Baixe em PNG ou SVG.'],
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
    passos: ['Escolha os arquivos (ou digite um texto).', 'Cole o hash esperado, se quiser conferir.', 'Calcule.'],
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
    passos: ['Escolha os arquivos.', 'Veja o tipo real e as propriedades.', 'Renomeie se a extensão estiver errada.'],
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
    passos: ['Escolha os dois arquivos.', 'Compare.', 'Veja o resultado.'],
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
    passos: ['Escolha a calculadora.', 'Digite os valores.', 'Veja o resultado na hora.'],
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
    passos: ['Abra um arquivo ou escreva um novo.', 'Busque, corrija a codificação ou edite.', 'Salve.'],
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
    passos: ['Escolha o sentido.', 'Envie o arquivo ou cole o Base64.', 'Copie ou baixe.'],
  },
]

export const ferramentas = TODAS.filter((f) => !f.requer || RECURSOS[f.requer])

// ─── Consultas ──────────────────────────────────────────────────────────────

const porSlug = new Map(ferramentas.map((f) => [f.slug, f]))

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
