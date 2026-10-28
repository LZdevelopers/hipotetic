// TikTok — informações, player oficial e DOWNLOAD sem marca d'água (até
// 1080p quando o vídeo tem) e MP3.
//
// Caminho principal: a página pública do vídeo (tiktok-cliente.js). Os
// arquivos passam por /api/tiktok; o MP3 é convertido no navegador.
//
// Reserva: se o TikTok bloquear o servidor ou o download estiver desligado
// (TIKTOK_DOWNLOAD=off), o cartão sai pelo oEmbed público, só com informações
// e o player oficial — e diz por que não há download.

import { ErroHttp } from "../http.js";
import { buscarJson, texto, urlSegura } from "../externo.js";
import { downloadAtivo, obterVideo, qualidades } from "../tiktok-cliente.js";
import { hostBase } from "../url.js";

const HOSTS = new Set(["tiktok.com", "vm.tiktok.com", "vt.tiktok.com"]);
const CURTOS = new Set(["vm.tiktok.com", "vt.tiktok.com"]);

/** ID numérico de /@usuario/video/123… (links curtos vm./vt. não trazem o ID). */
export function extrairId(url) {
  const m = /^\/@[^/]*\/(?:video|photo)\/(\d{8,25})\/?$/.exec(url.pathname);
  return m ? m[1] : null;
}

/**
 * vm.tiktok.com/XXXX → link completo. Só pergunta ao próprio encurtador do
 * TikTok (host fixo) e só aceita um destino em tiktok.com: nada de seguir
 * redirecionamentos para hosts arbitrários.
 */
async function expandirLinkCurto(url) {
  const codigo = /^\/(?:t\/)?([A-Za-z0-9]{5,20})\/?$/.exec(url.pathname)?.[1];
  if (!codigo) throw new ErroHttp(400, "link-sem-video");
  let destino;
  try {
    const resposta = await fetch(`https://${hostBase(url)}/${codigo}/`, { redirect: "manual", signal: AbortSignal.timeout(8000) });
    destino = new URL(resposta.headers.get("location") ?? "");
  } catch {
    throw new ErroHttp(404, "nao-encontrado");
  }
  if (hostBase(destino) !== "tiktok.com" || !extrairId(destino)) throw new ErroHttp(404, "nao-encontrado");
  return destino;
}

const player = (id) => ({
  tipo: "iframe",
  src: `https://www.tiktok.com/player/v1/${id}?music_info=1&description=1`,
  proporcao: "9/16",
});

/** Cartão só com informações, via oEmbed — quando não há download. */
async function semDownload(id, canonica, motivo) {
  const { status, dados } = await buscarJson(`https://www.tiktok.com/oembed?url=${encodeURIComponent(canonica)}`);
  if (status !== 200 || !dados || dados.status_msg) throw new ErroHttp(404, "nao-encontrado");
  return {
    fonte: "tiktok",
    origem: canonica,
    titulo: texto(dados.title) ?? "Vídeo do TikTok",
    autor: texto(dados.author_name, 120),
    autorUrl: urlSegura(dados.author_url),
    miniatura: urlSegura(dados.thumbnail_url),
    duracao: null,
    licenca: null,
    player: player(id),
    formatos: [],
    download: { disponivel: false, motivo },
  };
}

const urlProxy = (id, chave) => `/api/tiktok?id=${id}&q=${encodeURIComponent(chave)}`;

/**
 * Opções de download do vídeo, prontas para a tabela da interface.
 *
 * O TikTok só entrega 1080p/720p em H.265, que o player padrão do Windows (e
 * outros) não abre sem codec pago: a imagem fica preta e só o som toca. Então:
 *  - o melhor H.264 (geralmente 540p) vem primeiro, como recomendado — sai na
 *    hora e abre em qualquer aparelho;
 *  - as qualidades em H.265 são convertidas para H.264 no navegador antes de
 *    salvar (leva alguns minutos, e o arquivo sai maior que o original).
 */
export function opcoesDeDownload(id, item) {
  const lista = qualidades(item);
  const duracao = Number(item.video?.duration) || 0;
  const recomendada = lista.find((q) => q.codec === "h264");
  const ordem = recomendada ? [recomendada, ...lista.filter((q) => q !== recomendada)] : lista;
  const opcoes = ordem.map((q) =>
    q.codec === "h264"
      ? {
          id: `v${q.chave}`,
          tipo: "video",
          extensao: "mp4",
          rotulo: `${q.altura}p`,
          detalhe: "Sem marca d'água · abre em qualquer aparelho",
          recomendado: q === recomendada,
          altura: q.altura,
          tamanho: q.tamanho,
          tamanhoEstimado: false,
          url: urlProxy(id, q.chave),
        }
      : {
          id: `v${q.chave}`,
          tipo: "video",
          extensao: "mp4",
          rotulo: `${q.altura}p`,
          detalhe: "Sem marca d'água · convertido no navegador (demora)",
          altura: q.altura,
          // O H.264 convertido sai maior que o H.265 original: o tamanho só se
          // sabe no fim.
          tamanho: null,
          processo: { acao: "h264", video: urlProxy(id, q.chave) },
        },
  );

  // MP3: sai do menor arquivo em H.264 (o áudio é o mesmo em todas).
  const fonte = [...lista].reverse().find((q) => q.codec === "h264") ?? lista.at(-1);
  if (fonte) {
    opcoes.push({
      id: "mp3",
      tipo: "audio",
      extensao: "mp3",
      rotulo: "MP3 · 192 kbps",
      detalhe: "Toca em qualquer aparelho",
      tamanho: duracao ? Math.round((192000 / 8) * duracao) : null,
      tamanhoEstimado: true,
      processo: { acao: "mp3", audio: urlProxy(id, fonte.chave) },
    });
  }
  return opcoes;
}

export const tiktok = {
  id: "tiktok",
  nome: "TikTok",
  reconhece: (url) => HOSTS.has(hostBase(url)),

  async resolver(url) {
    const completo = CURTOS.has(hostBase(url)) ? await expandirLinkCurto(url) : url;
    const id = extrairId(completo);
    if (!id) throw new ErroHttp(400, "link-sem-video");
    const canonica = `https://www.tiktok.com${completo.pathname}`;
    if (!downloadAtivo()) return semDownload(id, canonica, "termos-tiktok");

    let item;
    try {
      ({ item } = await obterVideo(id));
    } catch (erro) {
      // Bloqueio do servidor: ainda mostramos o que é público. Vídeo
      // inexistente ou privado segue como erro de verdade.
      if (erro instanceof ErroHttp && !["nao-encontrado", "privado"].includes(erro.codigo)) {
        return semDownload(id, canonica, "tiktok-bloqueado");
      }
      throw erro;
    }

    if (item.imagePost) return semDownload(id, canonica, "foto-tiktok");
    const formatos = opcoesDeDownload(id, item);
    if (!formatos.length) return semDownload(id, canonica, "tiktok-bloqueado");

    const autor = item.author ?? {};
    return {
      fonte: "tiktok",
      origem: canonica,
      titulo: texto(item.desc) ?? `Vídeo de @${autor.uniqueId ?? "tiktok"}`,
      autor: texto(autor.nickname || autor.uniqueId, 120),
      autorUrl: autor.uniqueId ? `https://www.tiktok.com/@${encodeURIComponent(autor.uniqueId)}` : null,
      miniatura: urlSegura(item.video?.cover) ?? urlSegura(item.video?.originCover),
      duracao: Number(item.video?.duration) || null,
      licenca: null,
      player: player(id),
      formatos,
      download: { disponivel: true, motivo: null },
    };
  },
};
