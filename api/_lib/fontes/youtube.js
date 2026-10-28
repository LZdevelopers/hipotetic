// YouTube — informações, player oficial e DOWNLOAD em todas as qualidades
// (144p a 4K), MP3, M4A e WebM.
//
// Caminho principal: InnerTube (youtube-cliente.js) — título, canal, duração,
// miniatura e as opções reais do vídeo. Os arquivos passam por /api/youtube;
// opções com `processo` são juntadas/convertidas no navegador.
//
// Reserva: se o YouTube bloquear o servidor ou o download estiver desligado
// (YOUTUBE_DOWNLOAD=off), o cartão ainda sai pelo oEmbed público, só com
// informações e o player oficial — e diz por que não há download.

import { ErroHttp } from "../http.js";
import { buscarJson, texto, urlSegura } from "../externo.js";
import { hostBase } from "../url.js";
import { downloadAtivo, duracaoMaxima, obterInfoParaOpcoes, opcoesDeDownload } from "../youtube-cliente.js";

const HOSTS = new Set(["youtube.com", "youtu.be", "music.youtube.com", "youtube-nocookie.com"]);
const ID = /^[A-Za-z0-9_-]{11}$/;

/** URL → { id, short } ou null. Cobre watch, youtu.be, shorts, embed e live. */
export function extrairVideo(url) {
  const host = hostBase(url);
  if (!HOSTS.has(host)) return null;
  const partes = url.pathname.split("/").filter(Boolean);

  let id = null;
  let short = false;
  if (host === "youtu.be") id = partes[0];
  else if (partes[0] === "watch") id = url.searchParams.get("v");
  else if (["shorts", "embed", "live", "v"].includes(partes[0])) {
    id = partes[1];
    short = partes[0] === "shorts";
  }
  return id && ID.test(id) ? { id, short } : null;
}

const player = (video) => ({
  tipo: "iframe",
  src: `https://www.youtube-nocookie.com/embed/${video.id}?rel=0`,
  proporcao: video.short ? "9/16" : "16/9",
});

/** Cartão só com informações, via oEmbed — quando não há download. */
async function semDownload(video, motivo) {
  const canonica = `https://www.youtube.com/watch?v=${video.id}`;
  const { status, dados } = await buscarJson(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(canonica)}`);
  // 401/403: incorporação desativada ou vídeo privado; 400/404: não existe.
  if (status === 401 || status === 403) throw new ErroHttp(404, "privado");
  if (status !== 200 || !dados) throw new ErroHttp(404, "nao-encontrado");

  return {
    fonte: "youtube",
    origem: canonica,
    titulo: texto(dados.title) ?? "Vídeo do YouTube",
    autor: texto(dados.author_name, 120),
    autorUrl: urlSegura(dados.author_url),
    miniatura: `https://i.ytimg.com/vi/${video.id}/hqdefault.jpg`,
    duracao: null,
    licenca: null,
    player: player(video),
    formatos: [],
    download: { disponivel: false, motivo },
  };
}

export const youtube = {
  id: "youtube",
  nome: "YouTube",
  reconhece: (url) => HOSTS.has(hostBase(url)),

  async resolver(url) {
    const video = extrairVideo(url);
    if (!video) throw new ErroHttp(400, "link-sem-video");
    if (!downloadAtivo()) return semDownload(video, "termos-youtube");

    let info;
    try {
      ({ info } = await obterInfoParaOpcoes(video.id));
    } catch (erro) {
      // Bloqueio do servidor ou vídeo sem reprodução: ainda mostramos o que é
      // público. "nao-encontrado" segue como erro de verdade.
      if (erro instanceof ErroHttp && erro.codigo !== "nao-encontrado") return semDownload(video, erro.codigo);
      throw erro;
    }

    const basico = info.basic_info ?? {};
    if (basico.is_live) return semDownload(video, "ao-vivo");
    const duracao = basico.duration > 0 ? basico.duration : null;
    if (duracao && duracao > duracaoMaxima()) return semDownload(video, "muito-longo");

    const formatos = opcoesDeDownload(video.id, info);
    if (!formatos.length) return semDownload(video, "indisponivel-youtube");

    return {
      fonte: "youtube",
      origem: `https://www.youtube.com/watch?v=${video.id}`,
      titulo: texto(basico.title) ?? "Vídeo do YouTube",
      autor: texto(basico.author, 120),
      autorUrl: basico.channel_id ? `https://www.youtube.com/channel/${basico.channel_id}` : null,
      miniatura: `https://i.ytimg.com/vi/${video.id}/hqdefault.jpg`,
      duracao,
      licenca: null,
      player: player(video),
      formatos,
      download: { disponivel: true, motivo: null },
    };
  },
};
