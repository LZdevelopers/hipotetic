# hipotetic (nome provisório)

Plataforma da LZdev para obter mídia a partir de links: o usuário cola uma URL,
vê título, autor, duração, licença e uma prévia no player, e escolhe o formato
para baixar. Gratuita, sem anúncios, sem cadastro.

Fluxo (como o ytultra.com): colar o link → abre a janela de formatos → o
formato escolhido abre numa aba nova, no player do Chrome → ⋮ → Baixar.

> ⚠️ **YouTube:** o download contraria os Termos de Serviço do YouTube. Foi uma
> decisão consciente da LZdev (26/10/2026), ciente do risco de bloqueio e de
> derrubada. O código fica isolado em `api/youtube.js` e
> `api/_lib/youtube-cliente.js` e desliga com `YOUTUBE_DOWNLOAD=off`.

## O que funciona hoje

| Fonte | Informações | Player | Download | Como |
|---|---|---|---|---|
| YouTube | ✅ título, canal, duração, miniatura | ✅ oficial (youtube-nocookie) | ✅ 144p a 4K, MP3, M4A, WebM (HD e MP3 preparados no navegador com ffmpeg.wasm) | InnerTube (youtubei.js) + repasse em streaming |
| TikTok | ✅ autor, duração, miniatura | ✅ oficial | ✅ MP4 sem marca d'água (até 1080p H.265; 540p H.264) e MP3 | página pública do vídeo + repasse em streaming (oEmbed de reserva) |
| Instagram, Facebook, Vimeo, X | — | — | — | marcados como **planejados** |

Nada aparece como funcional sem funcionar. As planejadas respondem "ainda não
suportado" em vez de "link inválido".

## Stack

React 19 · Vite 7 · Tailwind CSS v4 — as mesmas quatro dependências do site da
LZdev, com os mesmos tokens, fontes e componentes (`Button`, `Card`, `Section`,
`Reveal`, `Icon`). As funções ficam em `api/`, no padrão do Global-Time
(handlers Node `(req, res)`, `ErroHttp`, cache na CDN).

## Comandos

```bash
npm install
npm run dev      # interface + funções /api em http://localhost:5173
npm test         # testes da API (sem rede)
npm run build    # build de produção em dist/
```

O `npm run dev` executa as funções de `api/` pelo próprio Vite (plugin em
`vite.config.js`), então não precisa do Vercel CLI para testar o fluxo inteiro.

## Variáveis de ambiente

| Nome | Obrigatória | Para quê |
|---|---|---|
| `YOUTUBE_DOWNLOAD` | não | `off` desliga o download do YouTube (volta a só prévia). Padrão: ligado. |
| `YOUTUBE_MAX_MINUTOS` | não | Duração máxima de vídeo do YouTube para download. Padrão: 120. É o freio do tráfego. |

Veja `.env.example`.

## Arquitetura

```
api/
  midia.js                 GET /api/midia?url=…  → { midia } | { erro }
  youtube.js               GET /api/youtube?v=ID&itag=N → o arquivo (streaming, Range)
  tiktok.js                GET /api/tiktok?id=ID&q=QUALIDADE → o MP4 (streaming, Range)
  _lib/
    url.js                 validação do link (só http/s, sem hosts internos)
    http.js                respostas, erros, cache na CDN
    externo.js             fetch com timeout para as APIs das fontes
    youtube-cliente.js     InnerTube: info, formatos, link decifrado
    fontes/
      index.js             registro — a ordem decide quem reconhece o link
      youtube.js tiktok.js
src/
  data/site.js             TODO o conteúdo (textos, fontes, FAQ)
  lib/media.js             cliente da API + mensagens de erro + formatação
  hooks/useMediaLookup.js  estado da consulta (cancela a anterior)
  components/tool/         UrlForm, ResultCard, MediaPlayer, FormatList
  components/sections/     Hero (a ferramenta: título por rede, botões de rede, campo), HowTo, Faq, Legal
```

**Nova plataforma** = um arquivo em `api/_lib/fontes/` com
`{ id, nome, reconhece(url), resolver(url) }`, uma linha em `fontes/index.js` e
um item em `platforms` (`src/data/site.js`) — vira um botão acima do campo.

### Segurança

- A função **nunca** acessa a URL colada pelo usuário. O link vira um ID
  validado, e só os hosts fixos de cada adaptador são consultados — sem SSRF.
- Links diretos são tocados e baixados pelo navegador, direto da origem.
- Recusa `localhost`, IPs privados/link-local, IPv6 literal, credenciais na URL
  e portas não padrão.
- Cabeçalhos de segurança e CSP em `vercel.json` (só os players do YouTube e do
  TikTok podem ser incorporados).
- Sem cookies, sem banco de dados, sem log de links.

## Publicar na Vercel sem custo

1. Importe o repositório na Vercel (framework detectado: Vite).
2. Opcional: adicione `YOUTUBE_API_KEY` em *Settings → Environment Variables*.
3. Não ative nada além disso. O projeto não usa Blob, banco, filas nem
   integrações do Marketplace.

De onde vem o consumo:

- **YouTube e TikTok: os bytes passam pela Vercel.** Os links do googlevideo são
  amarrados ao IP de quem os gerou, então a função `api/youtube.js` repassa o
  arquivo em streaming (blocos de 10 MB; ~5 MB/s nos testes locais). Isso
  consome a cota mensal de transferência e de CPU do plano. No Hobby, ao
  esgotar, o projeto **pausa** — não cobra. `YOUTUBE_MAX_MINUTOS` limita o
  tamanho de cada download.
- Consultas de informação ficam **1 hora em cache na CDN**.

⚠️ **Atenção ao plano.** O plano Hobby (gratuito) da Vercel é para uso
**pessoal e não comercial**, e não gera cobrança: ao passar dos limites, o
projeto pausa. Se a LZdev publicar como produto da empresa, avaliem se isso
conta como uso comercial — nesse caso o plano Pro é pago. Limites atuais em
https://vercel.com/docs/limits.

## Limitações conhecidas

- **Não testado ainda na Vercel.** O YouTube costuma bloquear IPs de datacenter
  ("confirme que não é um robô"). Localmente funciona; na Vercel só o deploy
  dirá. Se bloquear, o cartão cai para só prévia com a mensagem certa, e a
  saída é um proxy residencial (pago) — decisão a tomar antes.
- Juntar HD e converter para MP3 acontece no navegador (ffmpeg.wasm, ~30 MB
  baixados do jsDelivr na primeira vez). Arquivos acima de ~700 MB (ex.: 4K
  longo) aparecem como "Grande demais": é o teto de memória do WebAssembly.
- O YouTube muda a API com frequência: manter a `youtubei.js` atualizada
  (`npm update youtubei.js`) é parte da manutenção.
- TikTok: 1080p e 720p só existem em H.265 (HEVC), que o player padrão do
  Windows não abre sem codec pago (imagem preta). O 540p em H.264 vem primeiro,
  como recomendado; o HD é convertido para H.264 no navegador (ffmpeg.wasm,
  ~4× a duração do vídeo em 1080p num PC de 4 núcleos). Posts de fotos ainda não são suportados.
  O desafio anti-robô do TikTok é resolvido automaticamente, mas na Vercel só o
  deploy dirá se o IP é bloqueado. TIKTOK_DOWNLOAD=off desliga o download.
- Sem limite de requisições por IP além da CDN. Se houver abuso, a regra de
  *rate limit* do Vercel Firewall é o caminho (conferir disponibilidade no plano).
- Links curtos do TikTok (`vm.tiktok.com`) são expandidos perguntando só ao
  próprio encurtador, e só um destino em tiktok.com é aceito.
- O atributo `download` é ignorado pelo navegador em links de outro domínio:
  dependendo da fonte o arquivo abre no player nativo, e o menu ⋮ → Baixar
  conclui (a dica aparece no cartão).
