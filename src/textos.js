/**
 * Textos globais da interface (pt-BR). Textos de cada ferramenta ficam no
 * catálogo (src/ferramentas/catalogo.js). Para traduzir o site, estes dois
 * arquivos são o ponto de partida — nenhum texto global fica no JSX.
 */

// TODO: nome provisório. Quando a marca for definida, trocar só aqui.
export const produto = {
  nome: 'hipotetic',
  // Endereço canônico (SEO, Open Graph, sitemap). Trocar ao ter domínio próprio.
  url: 'https://hipotetic.vercel.app',
  slogan: 'Ferramentas de arquivo, sem instalar nada',
  descricao:
    'Converta, comprima e edite vídeos, áudios, imagens, PDFs, documentos e arquivos compactados direto no navegador. Grátis, sem cadastro e sem anúncios.',
}

export const textos = {
  pularParaConteudo: 'Ir para o conteúdo',
  buscarFerramenta: 'Buscar ferramenta',
  buscarPlaceholder: 'O que você quer fazer? Ex.: comprimir PDF, MP4 para GIF',
  semResultados: 'Nenhuma ferramenta encontrada para essa busca.',
  maisUsadas: 'Mais usadas',
  recentes: 'Usadas recentemente',
  limparRecentes: 'Limpar',
  todasAsFerramentas: 'Todas as ferramentas',
  verTodas: 'Ver todas',
  temaClaro: 'Usar tema claro',
  temaEscuro: 'Usar tema escuro',
  menu: 'Menu',
  fechar: 'Fechar',
  inicio: 'Início',
  perguntas: 'Perguntas frequentes',
  relacionadas: 'Ferramentas relacionadas',
  noNavegador: 'Processado no seu navegador',
  noNavegadorDetalhe: 'Seus arquivos não saem do seu aparelho.',
  noServidor: 'Usa o nosso servidor',
  noServidorDetalhe: 'O arquivo é enviado, processado e apagado em seguida. Nada fica guardado.',
  carregandoFerramenta: 'Carregando a ferramenta…',
}

export const inicio = {
  titulo: ['Tudo o que você faz com arquivos,', 'num só lugar'],
  subtitulo:
    'Converta, comprima, corte, junte e organize vídeos, áudios, imagens, PDFs e documentos. Quase tudo roda no seu navegador: rápido, gratuito e sem enviar seus arquivos para ninguém.',
  categorias: 'Categorias',
  principios: [
    {
      icone: 'seguro',
      titulo: 'Privado por padrão',
      texto: 'A maioria das ferramentas processa tudo no seu navegador. Quando uma precisa do servidor, a página avisa antes.',
    },
    {
      icone: 'brilho',
      titulo: 'Grátis de verdade',
      texto: 'Sem cadastro, sem marca d’água no resultado, sem limite artificial para vender assinatura e sem anúncios.',
    },
    {
      icone: 'cpu',
      titulo: 'Rápido no seu aparelho',
      texto: 'Usa WebAssembly e a aceleração de vídeo do navegador. Nada de esperar na fila de um servidor.',
    },
  ],
}

export const rodape = {
  frase: 'Ferramentas de arquivo gratuitas, privadas e honestas sobre o que fazem.',
  links: [
    { rotulo: 'Privacidade', para: '/privacidade' },
    { rotulo: 'Termos de uso', para: '/termos' },
  ],
}

export const paginas = {
  privacidade: {
    titulo: 'Privacidade',
    descricao: 'Como tratamos os seus arquivos e dados: o que roda no navegador, o que passa pelo servidor e o que nunca guardamos.',
    secoes: [
      {
        titulo: 'Seus arquivos',
        itens: [
          'A maior parte das ferramentas processa os arquivos no seu próprio navegador, com WebAssembly. Nesses casos o arquivo nunca sai do seu aparelho. A página da ferramenta mostra “Processado no seu navegador”.',
          'Algumas ferramentas precisam do servidor, como a conversão de documentos (DOCX, ODT, DOC, RTF) e o download de vídeos por link. Elas mostram “Usa o nosso servidor”. O arquivo é enviado por conexão segura, processado e apagado imediatamente. Não guardamos cópias.',
          'Não temos banco de dados de arquivos e não usamos seus arquivos para nenhum outro fim.',
        ],
      },
      {
        titulo: 'Dados de uso',
        itens: [
          'Não usamos cookies de rastreamento, anúncios nem ferramentas de análise de terceiros.',
          'Suas preferências (tema e ferramentas usadas recentemente) ficam só no seu navegador, no armazenamento local, e podem ser apagadas a qualquer momento.',
          'Links que você cola no download de vídeos são enviados à nossa função de consulta e à própria plataforma (YouTube, TikTok). Não registramos esses links.',
        ],
      },
      {
        titulo: 'Serviços de terceiros',
        itens: [
          'Os players do YouTube e do TikTok são carregados dos domínios dessas empresas e seguem as políticas delas.',
          'Alguns motores de processamento (como o do ffmpeg) são baixados de uma CDN pública (jsDelivr) na primeira vez que você usa a ferramenta. Seus arquivos não são enviados para essa CDN.',
        ],
      },
    ],
  },
  termos: {
    titulo: 'Termos de uso',
    descricao: 'Condições de uso das ferramentas: uso gratuito, direitos autorais, limites e responsabilidades.',
    secoes: [
      {
        titulo: 'Uso das ferramentas',
        itens: [
          'As ferramentas são gratuitas e oferecidas como estão, sem garantia de disponibilidade ou de resultado perfeito em todos os arquivos.',
          'Conversões entre formatos diferentes podem perder recursos que o formato de destino não suporta. Confira o resultado antes de apagar o original.',
          'Para manter o serviço gratuito, há limites de tamanho e de uso, informados em cada ferramenta.',
        ],
      },
      {
        titulo: 'Direitos autorais',
        itens: [
          'Você é responsável pelo conteúdo que processa. Use apenas arquivos que você tem direito de usar.',
          'Conteúdo baixado de plataformas continua protegido por direitos autorais. Baixe seus próprios vídeos ou conteúdo que o autor permite usar.',
          'As ferramentas de PDF não removem senhas de arquivos sem a senha correta.',
        ],
      },
    ],
  },
}
