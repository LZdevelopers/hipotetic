// Extração de mídia do YouTube via InnerTube (a API interna que o próprio site
// e os apps usam), com a biblioteca youtubei.js.
//
// ⚠️ Decisão do produto (26/10/2026): baixar do YouTube contraria os Termos de
// Serviço da plataforma. Foi uma escolha consciente da LZdev, e o código fica
// isolado aqui, em po-token-worker.js e em api/youtube.js para poder ser
// desligado sem tocar no resto (YOUTUBE_DOWNLOAD=off na Vercel).
//
// Como funciona:
//  - os links do googlevideo vêm amarrados ao IP de quem os pediu, então o
//    arquivo passa por api/youtube.js em streaming;
//  - os formatos separados (vídeo HD, áudio) exigem um PO token, senão o
//    YouTube corta depois de ~1 minuto de mídia — o token vem do worker;
//  - juntar vídeo + áudio e converter para MP3 acontece no NAVEGADOR
//    (ffmpeg.wasm, src/lib/ffmpeg.js): zero CPU de servidor.

import { Worker } from "node:worker_threads";

import { Innertube, Platform } from "youtubei.js";

import { ErroHttp } from "./http.js";

// A youtubei.js precisa executar um trecho do player do YouTube para decifrar
// as assinaturas dos links. É código do próprio YouTube, rodado no servidor.
Platform.shim.eval = async (data, env) => {
  const props = [];
  if (env.n) props.push(`n: exportedVars.nFunction(${JSON.stringify(env.n)})`);
  if (env.sig) props.push(`sig: exportedVars.sigFunction(${JSON.stringify(env.sig)})`);
  return new Function(`${data.output}\nreturn { ${props.join(", ")} }`)();
};

// MWEB traz link para todas as qualidades e aceita o PO token web. A mesma
// pergunta às vezes volta sem links (modo SABR) e dá certo logo depois — daí
// as repetições. iOS é a reserva sem token (bom para o MP4 360p).
const CLIENTES = ["MWEB", "MWEB", "MWEB", "IOS", "WEB"];

// Áudio que acompanha o vídeo na junção: AAC no MP4, Opus no WebM.
const AUDIO_MP4 = 140;
const AUDIO_WEBM = 251;
// Único formato com vídeo + áudio no mesmo arquivo: toca e baixa direto.
const PROGRESSIVO_360 = 18;

// Teto do que o navegador consegue juntar/converter: o ffmpeg.wasm guarda as
// entradas e a saída na memória (WebAssembly de 32 bits, ~2 GB no total).
export const LIMITE_PROCESSAMENTO = 700 * 1024 * 1024;

export const downloadAtivo = () => process.env.YOUTUBE_DOWNLOAD !== "off";

/** Limite de duração para download, em segundos (padrão: 2 horas). */
export function duracaoMaxima() {
  const minutos = Number(process.env.YOUTUBE_MAX_MINUTOS);
  return (Number.isFinite(minutos) && minutos > 0 ? minutos : 120) * 60;
}

// ─── Sessão InnerTube ────────────────────────────────────────────────────────
// Uma por instância. Com o Fluid Compute a instância atende vários pedidos
// seguidos, então o player do YouTube não é baixado a cada clique.
let sessao = null;
function obterSessao() {
  sessao ??= Innertube.create({ retrieve_player: true, generate_session_locally: true }).catch((erro) => {
    sessao = null;
    throw erro;
  });
  return sessao;
}

// ─── PO token ────────────────────────────────────────────────────────────────
// Um worker por instância, recriado quando o token de integridade vence ou o
// worker morre. Se o BotGuard falhar, seguimos sem token: o MP4 360p continua
// funcionando, e os formatos separados podem falhar no meio.
let gerador = null;

function iniciarGerador() {
  const worker = new Worker(new URL("./po-token-worker.js", import.meta.url));
  worker.unref();
  const pendentes = new Map();
  let contador = 0;
  let validoAte = 0;

  const pronto = new Promise((ok, falha) => {
    const tempo = setTimeout(() => falha(new Error("po token: tempo esgotado")), 20000);
    worker.on("message", (msg) => {
      if (msg.pronto) {
        clearTimeout(tempo);
        // Renova com 10 min de folga antes de o token de integridade vencer.
        validoAte = Date.now() + (Number(msg.validade) || 3600) * 1000 - 10 * 60 * 1000;
        ok();
      } else if (msg.falhou) {
        clearTimeout(tempo);
        falha(new Error(`po token: ${msg.falhou}`));
      } else {
        pendentes.get(msg.n)?.(msg);
        pendentes.delete(msg.n);
      }
    });
    worker.on("error", (erro) => {
      clearTimeout(tempo);
      falha(erro);
    });
  });

  return {
    pronto,
    vencido: () => Date.now() > validoAte,
    encerrar: () => worker.terminate(),
    async gerar(id) {
      await pronto;
      const n = ++contador;
      const resposta = await new Promise((ok) => {
        pendentes.set(n, ok);
        worker.postMessage({ n, id });
      });
      if (!resposta.token) throw new Error(`po token: ${resposta.erro}`);
      return resposta.token;
    },
  };
}

/** PO token do vídeo (ligado ao ID), ou null se o BotGuard falhar. */
export async function obterPoToken(id) {
  try {
    if (!gerador || gerador.vencido()) {
      gerador?.encerrar();
      gerador = iniciarGerador();
    }
    return await gerador.gerar(id);
  } catch (erro) {
    console.error(erro?.message ?? erro);
    gerador?.encerrar();
    gerador = null;
    return null;
  }
}

// ─── Informações e formatos ──────────────────────────────────────────────────
const todosFormatos = (info) => [...(info.streaming_data?.formats ?? []), ...(info.streaming_data?.adaptive_formats ?? [])];

// Modo SABR: formatos listados sem link nenhum. Não servem para baixar.
const temLink = (f) => Boolean(f && (f.url || f.signature_cipher || f.cipher));

/**
 * Informações de reprodução, tentando cada cliente até um responder com link
 * para os formatos pedidos (`itags`, padrão: o MP4 360p). Devolve
 * { yt, info, token } ou lança ErroHttp.
 */
export async function obterInfo(id, itags = [PROGRESSIVO_360]) {
  const [yt, token] = await Promise.all([obterSessao(), obterPoToken(id)]);
  let motivo = "nao-encontrado";
  for (const client of CLIENTES) {
    const comToken = token && client !== "IOS";
    try {
      const info = await yt.getBasicInfo(id, { client, ...(comToken ? { po_token: token } : {}) });
      const status = info.playability_status?.status;
      const formatos = todosFormatos(info);
      if (status === "OK" && itags.every((itag) => temLink(formatos.find((f) => f.itag === itag)))) {
        return { yt, info, token: comToken ? token : null };
      }
      // LOGIN_REQUIRED: restrição de idade, vídeo privado ou o YouTube pedindo
      // "confirme que não é um robô" ao IP do servidor.
      if (status === "OK") motivo = "indisponivel-youtube";
      else if (status === "LOGIN_REQUIRED") motivo = "youtube-bloqueado";
      else if (status === "UNPLAYABLE" || status === "LIVE_STREAM_OFFLINE") motivo = "indisponivel-youtube";
    } catch (erro) {
      if (!/unavailable/i.test(erro?.message ?? "")) motivo = "youtube-bloqueado";
    }
  }
  throw new ErroHttp(422, motivo);
}

/**
 * Informações para montar a tabela: exige link também para o áudio separado
 * (sinal de que os formatos HD vieram com link); se não sair, aceita só o
 * MP4 360p — melhor uma opção do que nenhuma.
 */
export async function obterInfoParaOpcoes(id) {
  try {
    return await obterInfo(id, [PROGRESSIVO_360, AUDIO_MP4]);
  } catch {
    return obterInfo(id);
  }
}

/** "video/mp4; codecs=..." → { mime, extensao, codec }. */
export function descreverMime(mimeType = "") {
  const [mime] = mimeType.split(";");
  const codec = /codecs="([^".,]+)/.exec(mimeType)?.[1] ?? "";
  const audio = mime.startsWith("audio/");
  const extensao = mime.endsWith("/mp4") ? (audio ? "m4a" : "mp4") : mime.endsWith("/webm") ? "webm" : null;
  return { mime: mime.trim(), extensao, codec };
}

const tamanhoDe = (f, duracao) =>
  Number(f?.content_length) || (f?.bitrate && duracao ? Math.round((f.bitrate / 8) * duracao) : 0);

const urlProxy = (id, itag) => `/api/youtube?v=${id}&itag=${itag}`;

const NOMES_CODEC = { avc1: "H.264", vp9: "VP9", av01: "AV1" };

// O "p" da qualidade é o lado MENOR da imagem: num Short (vertical) 360x640 é
// 360p, não 640p.
const qualidadeDe = (f) => Math.min(f.width || f.height, f.height);

/**
 * Opções de download do vídeo, prontas para a tabela da interface:
 *  - vídeo 360p: o MP4 progressivo, direto;
 *  - demais alturas: vídeo separado + áudio, juntados no navegador. Até 1080p
 *    em MP4/H.264 (toca em qualquer lugar); acima disso só existe VP9, em WebM;
 *  - áudio: MP3 (convertido no navegador a partir do Opus), M4A e WebM diretos.
 * Opções que passariam do limite de memória do navegador saem marcadas.
 */
export function opcoesDeDownload(id, info) {
  const formatos = todosFormatos(info).filter(temLink);
  const duracao = info.basic_info?.duration ?? 0;
  const porItag = (itag) => formatos.find((f) => f.itag === itag);
  const audioMp4 = porItag(AUDIO_MP4);
  const audioWebm = porItag(AUDIO_WEBM);
  const progressivo = porItag(PROGRESSIVO_360);
  const opcoes = [];

  // Melhor vídeo por qualidade: H.264 até 1080p; VP9 acima. Mais fps ganha.
  const somenteVideo = formatos.filter((f) => f.has_video && !f.has_audio && f.height);
  const alturas = [...new Set(somenteVideo.map(qualidadeDe))].sort((a, b) => b - a);
  for (const altura of alturas) {
    if (altura === 360 && progressivo) continue; // coberto pelo progressivo
    const escolhido = somenteVideo
      .filter((f) => qualidadeDe(f) === altura)
      .map((f) => ({ f, ...descreverMime(f.mime_type) }))
      .filter(({ codec }) => (altura <= 1080 ? codec === "avc1" : codec === "vp9"))
      .sort((a, b) => (b.f.fps ?? 0) - (a.f.fps ?? 0))[0];
    const audio = escolhido?.extensao === "mp4" ? audioMp4 : audioWebm;
    if (!escolhido || !audio) continue;

    const tamanho = tamanhoDe(escolhido.f, duracao) + tamanhoDe(audio, duracao);
    opcoes.push({
      id: `v${escolhido.f.itag}`,
      tipo: "video",
      extensao: escolhido.extensao,
      rotulo: escolhido.f.quality_label ?? `${altura}p`,
      detalhe: `${escolhido.extensao.toUpperCase()} · ${NOMES_CODEC[escolhido.codec] ?? escolhido.codec}`,
      altura,
      tamanho,
      tamanhoEstimado: !Number(escolhido.f.content_length),
      processo: { acao: "juntar", video: urlProxy(id, escolhido.f.itag), audio: urlProxy(id, audio.itag) },
      ...(tamanho > LIMITE_PROCESSAMENTO ? { indisponivel: "grande-demais" } : {}),
    });
  }

  if (progressivo) {
    opcoes.push({
      id: `v${PROGRESSIVO_360}`,
      tipo: "video",
      extensao: "mp4",
      rotulo: "360p",
      detalhe: "MP4 · H.264",
      altura: 360,
      tamanho: tamanhoDe(progressivo, duracao),
      tamanhoEstimado: true,
      url: urlProxy(id, PROGRESSIVO_360),
    });
  }
  opcoes.sort((a, b) => b.altura - a.altura);

  if (audioWebm || audioMp4) {
    const fonte = audioWebm ?? audioMp4;
    opcoes.push({
      id: "mp3",
      tipo: "audio",
      extensao: "mp3",
      rotulo: "MP3 · 192 kbps",
      detalhe: "Toca em qualquer aparelho",
      // MP3 a 192 kbps: o tamanho sai da duração, não do arquivo de origem.
      tamanho: duracao ? Math.round((192000 / 8) * duracao) : null,
      tamanhoEstimado: true,
      processo: { acao: "mp3", audio: urlProxy(id, fonte.itag) },
      ...(tamanhoDe(fonte, duracao) > LIMITE_PROCESSAMENTO ? { indisponivel: "grande-demais" } : {}),
    });
  }
  for (const [audio, extensao, rotulo, detalhe] of [
    [audioMp4, "m4a", "M4A · 128 kbps", "AAC"],
    [audioWebm, "webm", "WebM · 160 kbps", "Opus"],
  ]) {
    if (!audio) continue;
    opcoes.push({
      id: `a${audio.itag}`,
      tipo: "audio",
      extensao,
      rotulo,
      detalhe,
      tamanho: tamanhoDe(audio, duracao),
      tamanhoEstimado: !Number(audio.content_length),
      url: urlProxy(id, audio.itag),
    });
  }
  return opcoes;
}

/**
 * Link direto (decifrado, com PO token), tipo e tamanho exato de um formato.
 * O tamanho do MP4 360p não vem nos metadados — sai do Content-Range de um
 * pedido de 1 byte.
 */
export async function resolverArquivo(id, itag) {
  const { yt, info, token } = await obterInfo(id, [itag]);
  const formato = todosFormatos(info).find((f) => f.itag === itag);
  const { mime, extensao } = descreverMime(formato.mime_type);
  if (!extensao) throw new ErroHttp(404, "formato-indisponivel");

  let url = await formato.decipher(yt.session.player);
  if (token) url += `&pot=${encodeURIComponent(token)}`;

  let tamanho = Number(formato.content_length);
  if (!tamanho) {
    const sonda = await fetch(url, { headers: { Range: "bytes=0-0" }, signal: AbortSignal.timeout(8000) });
    tamanho = Number(sonda.headers.get("content-range")?.split("/")[1]);
    await sonda.body?.cancel();
  }
  if (!tamanho) throw new ErroHttp(502, "indisponivel");

  return {
    url,
    tamanho,
    mime,
    extensao,
    titulo: info.basic_info?.title ?? id,
    duracao: info.basic_info?.duration ?? null,
  };
}
