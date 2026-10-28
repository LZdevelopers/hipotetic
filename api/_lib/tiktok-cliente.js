// Extração de vídeo do TikTok a partir da página pública do vídeo.
//
// ⚠️ Decisão do produto (27/10/2026): baixar do TikTok contraria os Termos de
// Serviço da plataforma, assim como no YouTube. Foi uma escolha consciente da
// LZdev; o código fica isolado aqui e em api/tiktok.js, e TIKTOK_DOWNLOAD=off
// na Vercel volta ao modo só-prévia sem tocar no resto.
//
// Como funciona:
//  - a página do vídeo traz um JSON (__UNIVERSAL_DATA_FOR_REHYDRATION__) com
//    título, autor, duração e os links de cada qualidade — sem marca d'água;
//  - às vezes o TikTok responde "Please wait..." com um desafio anti-robô: uma
//    prova de trabalho SHA-256 que se resolve em milissegundos;
//  - os links do vídeo só abrem com os cookies daquela visita (tt_chain_token),
//    por isso o arquivo passa por api/tiktok.js, como no YouTube.

import { createHash } from "node:crypto";

import { ErroHttp } from "./http.js";

const AGENTE = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36";
const TEMPO_LIMITE_MS = 10000;
// Os links do CDN valem por algumas horas; 10 min de cache por instância evita
// buscar a página de novo a cada pedido de Range do player.
const VALIDADE_MS = 10 * 60 * 1000;

export const downloadAtivo = () => process.env.TIKTOK_DOWNLOAD !== "off";

/** Cabeçalhos que o CDN do TikTok exige para entregar o arquivo. */
export const cabecalhosCdn = (cookies) => ({ "User-Agent": AGENTE, Referer: "https://www.tiktok.com/", Cookie: cookies });

// ─── Desafio anti-robô ───────────────────────────────────────────────────────
const classeDe = (html, id) => new RegExp(`id="${id}" class="([^"]*)"`).exec(html)?.[1];

/**
 * Página de desafio → cookie que a libera, ou null se não for desafio.
 * O desafio (em base64 no #cs) traz `a` e `c`: achar o número n em que
 * sha256(a + n) = c, e devolver tudo com `d` = n no cookie nomeado pelo #wci.
 */
export function resolverDesafio(html) {
  const cs = classeDe(html, "cs");
  const nomeCookie = classeDe(html, "wci");
  if (!cs || !nomeCookie) return null;
  const desafio = JSON.parse(Buffer.from(cs, "base64").toString());
  const prefixo = Buffer.from(desafio.v.a, "base64");
  const alvo = Buffer.from(desafio.v.c, "base64");
  for (let n = 0; n <= 1_000_000; n++) {
    if (createHash("sha256").update(prefixo).update(String(n)).digest().equals(alvo)) {
      desafio.d = Buffer.from(String(n)).toString("base64");
      return `${nomeCookie}=${Buffer.from(JSON.stringify(desafio)).toString("base64")}`;
    }
  }
  throw new Error("tiktok: desafio sem solução");
}

// ─── Página do vídeo ─────────────────────────────────────────────────────────
async function buscarPagina(id) {
  let cookieDesafio = "";
  for (let tentativa = 0; tentativa < 2; tentativa++) {
    let resposta;
    try {
      // O @usuário do caminho não importa: o TikTok acha o vídeo pelo ID.
      resposta = await fetch(`https://www.tiktok.com/@i/video/${id}`, {
        headers: { "User-Agent": AGENTE, "Accept-Language": "en-US,en;q=0.9", Accept: "text/html", Cookie: cookieDesafio },
        signal: AbortSignal.timeout(TEMPO_LIMITE_MS),
      });
    } catch {
      throw new ErroHttp(502, "indisponivel");
    }
    const html = await resposta.text();
    const desafio = resolverDesafio(html);
    if (!desafio) {
      const cookies = resposta.headers.getSetCookie().map((c) => c.split(";")[0]);
      return { html, cookies: [cookieDesafio, ...cookies].filter(Boolean).join("; ") };
    }
    cookieDesafio = desafio;
  }
  throw new ErroHttp(422, "tiktok-bloqueado");
}

/** HTML da página → itemStruct do vídeo, ou ErroHttp com o motivo. */
export function lerItem(html) {
  const json = /<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__"[^>]*>([\s\S]*?)<\/script>/.exec(html)?.[1];
  if (!json) throw new ErroHttp(502, "indisponivel");
  const detalhe = JSON.parse(json).__DEFAULT_SCOPE__?.["webapp.video-detail"];
  const item = detalhe?.itemInfo?.itemStruct;
  // 10204: não existe/removido; 10216 e 10222: privado ou só para amigos.
  if (detalhe?.statusCode === 10216 || detalhe?.statusCode === 10222) throw new ErroHttp(404, "privado");
  if (!item || detalhe?.statusCode) throw new ErroHttp(404, "nao-encontrado");
  return item;
}

const cache = new Map();

/** { item, cookies } do vídeo, com cache curto por instância. */
export async function obterVideo(id) {
  const guardado = cache.get(id);
  if (guardado && guardado.expira > Date.now()) return guardado;
  const { html, cookies } = await buscarPagina(id);
  const dados = { item: lerItem(html), cookies, expira: Date.now() + VALIDADE_MS };
  if (cache.size > 200) cache.clear();
  cache.set(id, dados);
  return dados;
}

export const esquecerVideo = (id) => cache.delete(id);

// ─── Qualidades ──────────────────────────────────────────────────────────────
const NOMES_CODEC = { h264: "H.264", h265: "H.265" };
const codecDe = (b) => (/^h265|hevc|bytevc1/i.test(b.CodecType ?? "") ? "h265" : "h264");
// O nome que o próprio TikTok dá ("normal_540_0" → 540p); senão, o lado menor
// da imagem (um 576x1024 é o "540p" deles).
const qualidadeDe = (b) =>
  Number(/_(\d{3,4})_/.exec(b.GearName ?? "")?.[1]) || Math.min(b.PlayAddr?.Width || 0, b.PlayAddr?.Height || 0);

/**
 * Melhor arquivo de cada qualidade, da maior para a menor. Na mesma altura o
 * H.264 ganha (abre em qualquer aparelho) e, entre iguais, o de mais bitrate.
 * O TikTok costuma oferecer 1080p e 720p só em H.265.
 */
export function qualidades(item) {
  const porAltura = new Map();
  for (const b of item.video?.bitrateInfo ?? []) {
    const altura = qualidadeDe(b);
    if (!altura || !b.PlayAddr?.UrlList?.length) continue;
    const atual = porAltura.get(altura);
    const melhor =
      !atual ||
      (codecDe(b) === "h264" && codecDe(atual) !== "h264") ||
      (codecDe(b) === codecDe(atual) && (b.Bitrate ?? 0) > (atual.Bitrate ?? 0));
    if (melhor) porAltura.set(altura, b);
  }
  return [...porAltura.entries()]
    .sort(([a], [b]) => b - a)
    .map(([altura, b]) => ({
      chave: b.GearName,
      altura,
      codec: codecDe(b),
      nomeCodec: NOMES_CODEC[codecDe(b)],
      tamanho: Number(b.PlayAddr.DataSize) || 0,
      urls: b.PlayAddr.UrlList,
    }));
}
