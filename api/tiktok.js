// Arquivo de vídeo do TikTok, repassado em streaming.
//
// GET /api/tiktok?id=<id>&q=<qualidade>
//   → o MP4 (sem marca d'água), com Content-Disposition inline. Também é a
//     fonte dos bytes que o navegador converte para MP3 com o ffmpeg.wasm.
//
// O CDN do TikTok só entrega o arquivo com os cookies da visita à página, que
// o navegador do usuário não tem — por isso o repasse. Suporta Range.

import { ErroHttp, exigirGet, parametros, rota } from "./_lib/http.js";
import { cabecalhosDeArquivo, escrever, lerRange } from "./_lib/repasse.js";
import { cabecalhosCdn, downloadAtivo, esquecerVideo, obterVideo, qualidades } from "./_lib/tiktok-cliente.js";

const ID = /^\d{8,25}$/;
const CHAVE = /^[a-z0-9_]{1,40}$/;

/** Primeiro link da qualidade que o CDN aceita para o trecho pedido. */
async function abrir(urls, cookies, inicio, fim, signal) {
  for (const url of urls) {
    const resposta = await fetch(url, { headers: { ...cabecalhosCdn(cookies), Range: `bytes=${inicio}-${fim}` }, signal }).catch(() => null);
    if (resposta?.status === 206 && resposta.body) return resposta;
    await resposta?.body?.cancel();
  }
  return null;
}

export default rota(async (req, res) => {
  exigirGet(req);
  if (!downloadAtivo()) throw new ErroHttp(403, "desativado");

  const busca = parametros(req);
  const id = busca.get("id") ?? "";
  const chave = busca.get("q") ?? "";
  if (!ID.test(id) || !CHAVE.test(chave)) throw new ErroHttp(400, "parametros");

  let { item, cookies } = await obterVideo(id);
  const qualidade = qualidades(item).find((q) => q.chave === chave);
  if (!qualidade?.tamanho) throw new ErroHttp(404, "formato-indisponivel");

  const range = lerRange(req.headers.range, qualidade.tamanho);
  const inicio = range?.inicio ?? 0;
  const fim = range?.fim ?? qualidade.tamanho - 1;

  const cancelar = new AbortController();
  res.on("close", () => cancelar.abort());

  let resposta = await abrir(qualidade.urls, cookies, inicio, fim, cancelar.signal);
  if (!resposta) {
    // Links ou cookies vencidos: busca a página de novo, uma vez.
    esquecerVideo(id);
    ({ item, cookies } = await obterVideo(id));
    const nova = qualidades(item).find((q) => q.chave === chave);
    resposta = nova && (await abrir(nova.urls, cookies, inicio, fim, cancelar.signal));
    if (!resposta) throw new ErroHttp(502, "indisponivel");
  }

  cabecalhosDeArquivo(res, {
    mime: "video/mp4",
    extensao: "mp4",
    titulo: item.desc || `TikTok ${id}`,
    tamanho: qualidade.tamanho,
    range,
    inicio,
    fim,
  });
  if (req.method === "HEAD") {
    await resposta.body.cancel();
    return res.end();
  }

  try {
    for await (const pedaco of resposta.body) await escrever(res, pedaco);
    res.end();
  } catch (erro) {
    // Cabeçalhos já enviados: encerrar a conexão faz o navegador acusar o
    // download incompleto em vez de salvar lixo.
    if (!cancelar.signal.aborted) console.error("tiktok: streaming interrompido", erro?.message);
    res.destroy();
  }
});
