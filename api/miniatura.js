// Miniatura (capa) de um vídeo, para baixar como arquivo.
//
// GET /api/miniatura?yt=<id do YouTube>&nome=<título>
//   → a maior capa disponível (maxres → sd → hq), como anexo .jpg
// GET /api/miniatura?url=<capa do TikTok>&nome=<título>
//   → a capa, como anexo (só hosts do CDN do TikTok)
//
// Por que passar pelo servidor: o atributo `download` não funciona com
// imagens de outro domínio — o navegador só abriria a imagem. Só hosts de
// capa conhecidos são aceitos (nada de buscar URLs arbitrárias).

import { ErroHttp, exigirGet, parametros, rota } from "./_lib/http.js";
import { nomeArquivo } from "./_lib/repasse.js";

const ID_YT = /^[A-Za-z0-9_-]{11}$/;
const HOST_TIKTOK = /^[a-z0-9-]+\.(tiktokcdn|tiktokcdn-us|tiktokcdn-eu|ibyteimg)\.com$/;
const LIMITE = 4 * 1024 * 1024; // abaixo do limite de resposta das funções

async function buscarImagem(url) {
  const resposta = await fetch(url, { signal: AbortSignal.timeout(8000), redirect: "error" }).catch(() => null);
  if (!resposta?.ok) return null;
  const tipo = resposta.headers.get("content-type") ?? "";
  if (!/^image\/(jpeg|png|webp)/.test(tipo)) return null;
  const dados = Buffer.from(await resposta.arrayBuffer());
  if (dados.length > LIMITE || dados.length < 1500) return null; // < 1,5 KB = imagem "não existe" do YouTube
  return { dados, tipo };
}

export default rota(async (req, res) => {
  exigirGet(req);
  const busca = parametros(req);
  const titulo = (busca.get("nome") ?? "miniatura").slice(0, 200);

  let imagem = null;
  const yt = busca.get("yt");
  if (yt) {
    if (!ID_YT.test(yt)) throw new ErroHttp(400, "parametros");
    for (const tamanho of ["maxresdefault", "sddefault", "hqdefault"]) {
      imagem = await buscarImagem(`https://i.ytimg.com/vi/${yt}/${tamanho}.jpg`);
      if (imagem) break;
    }
  } else {
    let url;
    try {
      url = new URL(busca.get("url") ?? "");
    } catch {
      throw new ErroHttp(400, "parametros");
    }
    if (url.protocol !== "https:" || url.port || !HOST_TIKTOK.test(url.hostname)) throw new ErroHttp(400, "host-nao-permitido");
    imagem = await buscarImagem(url.href);
  }
  if (!imagem) throw new ErroHttp(404, "nao-encontrado");

  const extensao = imagem.tipo.includes("png") ? "png" : imagem.tipo.includes("webp") ? "webp" : "jpg";
  res.statusCode = 200;
  res.setHeader("Content-Type", imagem.tipo);
  res.setHeader("Content-Length", String(imagem.dados.length));
  res.setHeader("Content-Disposition", `attachment; filename="miniatura.${extensao}"; filename*=UTF-8''${encodeURIComponent(nomeArquivo(titulo, extensao))}`);
  res.setHeader("Cache-Control", "public, max-age=3600");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.end(imagem.dados);
});
