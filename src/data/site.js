/**
 * Todo o conteúdo do site vive aqui — textos, fontes, FAQ e rodapé. Alterar
 * copy nunca exige tocar em JSX (mesma regra do site da LZdev).
 */

// ─── Produto ─────────────────────────────────────────────────────────────────
// TODO: nome provisório. Quando a marca for definida, trocar só aqui e no
// <title> do index.html.
export const product = {
  name: 'hipotetic',
  tagline: 'Baixe vídeos do YouTube e do TikTok sem complicação — e sem marca d’água.',
}

export const navLinks = [
  { label: 'Baixar', href: '#inicio' },
  { label: 'Como usar', href: '#como-usar' },
  { label: 'FAQ', href: '#faq' },
]

// ─── 1. Hero / ferramenta ───────────────────────────────────────────────────
// Redes com download funcionando: viram os botões acima do campo do link, e a
// escolhida define o título e o subtítulo do Hero. `hosts` só serve para a
// interface trocar de rede sozinha quando a pessoa cola um link da outra; quem
// decide de verdade é a API.
export const platforms = [
  {
    id: 'youtube',
    name: 'YouTube',
    icon: 'youtube',
    title: ['Downloader do YouTube', 'para MP3, MP4 e mais'],
    subtitle: 'Baixe vídeos do YouTube em MP4 até 4K, ou só o áudio em MP3, M4A e WebM. Shorts também. Grátis, sem anúncios e sem cadastro.',
    placeholder: 'Cole o link do YouTube',
    hosts: ['youtube.com', 'youtu.be', 'music.youtube.com', 'youtube-nocookie.com'],
  },
  {
    id: 'tiktok',
    name: 'TikTok',
    icon: 'tiktok',
    title: ['Downloader do TikTok', 'sem marca d’água'],
    subtitle: 'Baixe vídeos do TikTok em MP4 sem a marca d’água e o @ do app, ou só o áudio em MP3. Funciona com o link curto do app. Grátis, sem anúncios e sem cadastro.',
    placeholder: 'Cole o link do TikTok',
    hosts: ['tiktok.com', 'vm.tiktok.com', 'vt.tiktok.com'],
  },
]

// ─── 2. Como usar ───────────────────────────────────────────────────────────
export const howTo = {
  title: 'Como usar',
  steps: [
    {
      icon: 'link',
      title: 'Copie o link',
      text: 'No app, toque em Compartilhar → Copiar link. No computador, copie o endereço do navegador e cole acima.',
    },
    {
      icon: 'film',
      title: 'Escolha o formato',
      text: 'Vídeo ou só o áudio: a tabela mostra a qualidade, o formato (MP4, MP3…) e o tamanho de cada arquivo.',
    },
    {
      icon: 'download',
      title: 'Veja a prévia ou baixe direto',
      text: 'Assista à prévia no player antes, se quiser, ou baixe na hora — o arquivo abre no navegador: ⋮ → Baixar.',
    },
  ],
}

export const downloadTip =
  'O arquivo abre numa aba nova, no player do navegador. Para salvar, clique no ⋮ do player e escolha “Baixar”.'

// ─── 3. FAQ ─────────────────────────────────────────────────────────────────
export const faq = {
  title: 'Perguntas frequentes',
  items: [
    {
      q: 'O vídeo do TikTok sai sem marca d’água?',
      a: 'Sim. Baixamos o arquivo original, sem a marca d’água e sem o @ que o app coloca. O 540p sai na hora e abre em qualquer aparelho. O 1080p e o 720p o TikTok só entrega em H.265, que muitos players não abrem (a imagem fica preta): por isso o seu navegador converte esses para H.264 antes de salvar, o que leva alguns minutos. Também dá para baixar só o áudio em MP3. Funciona com o link completo ou o link curto (vm.tiktok.com) que o app compartilha. Posts de fotos ainda não são suportados.',
    },
    {
      q: 'Quais formatos do YouTube posso baixar?',
      a: 'Vídeo de 144p até 4K (quando o vídeo tem) e áudio em MP3, M4A ou WebM. Acima de 360p o YouTube entrega imagem e som separados: o seu navegador junta os dois antes de salvar, e o MP3 também é convertido nele. Vídeos de até 2 horas; lives no ar não podem ser baixadas.',
    },
    {
      q: 'Como salvo o arquivo?',
      a: 'Clique em “Baixar” na qualidade que quiser. A maioria abre numa aba nova, no player do navegador: é só clicar no ⋮ e escolher “Baixar”. Os formatos preparados no seu navegador (MP3 e vídeo HD do YouTube) mostram um botão “Salvar” quando terminam.',
    },
    {
      q: 'É gratuito mesmo?',
      a: 'Sim. Sem planos, sem limite artificial para vender assinatura, sem anúncios.',
    },
    {
      q: 'Vocês guardam os arquivos ou os links que eu colo?',
      a: 'Não. Não temos banco de dados e não salvamos nenhum arquivo: os bytes passam pelo nosso servidor direto para o seu navegador, sem ficar gravados.',
    },
    {
      q: 'Posso usar o que eu baixar como quiser?',
      a: 'Não necessariamente. Direitos autorais continuam valendo depois do download: baixe seus próprios vídeos ou conteúdo que o autor permite usar, e dê o crédito quando repostar.',
    },
    {
      q: 'Vão suportar Instagram, Facebook e outras redes?',
      a: 'Estão nos planos. Quando uma rede nova entrar, ela aparece como um botão acima do campo do link.',
    },
  ],
}

// ─── 4. Privacidade e termos ────────────────────────────────────────────────
export const legal = {
  privacy: {
    id: 'privacidade',
    title: 'Privacidade',
    items: [
      'Não usamos cookies, rastreadores nem anúncios.',
      'O link que você cola é enviado só para a nossa função de consulta e para a própria plataforma. Não registramos esse link.',
      'Nenhum arquivo de mídia é armazenado. Downloads do YouTube e do TikTok passam pelo nosso servidor em trânsito, sem ficar gravados.',
      'Os players do YouTube e do TikTok são carregados dos domínios deles e seguem as políticas de privacidade dessas empresas.',
    ],
  },
  terms: {
    id: 'termos',
    title: 'Condições de uso',
    items: [
      'A ferramenta mostra informações públicas e permite baixar vídeos e áudios do YouTube e do TikTok.',
      'Conteúdo protegido por direitos autorais continua protegido depois de baixado.',
      'Baixe apenas conteúdo que você tem direito de usar: seus próprios vídeos ou conteúdo com permissão do autor.',
      'O serviço é oferecido como está, sem garantia de disponibilidade das fontes de terceiros.',
    ],
  },
}

export const footer = {
  tagline: 'Uma ferramenta limpa, gratuita e honesta sobre o que pode e o que não pode fazer.',
  columns: [
    { title: 'Ferramenta', links: navLinks },
    {
      title: 'Transparência',
      links: [
        { label: 'Privacidade', href: '#privacidade' },
        { label: 'Condições de uso', href: '#termos' },
      ],
    },
  ],
}
