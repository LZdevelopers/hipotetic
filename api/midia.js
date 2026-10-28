// Informações de mídia a partir de um link.
//
// GET /api/midia?url=<link>
//   → { midia: { fonte, origem, titulo, autor, miniatura, duracao, licenca,
//                player, formatos[], download: { disponivel, motivo } } }
//   ← { erro: "url-invalida" | "fonte-nao-suportada" | "fonte-planejada" | … }
//
// A função só consulta metadados; nenhum arquivo de mídia passa por aqui. Os
// downloads saem por api/youtube.js e api/tiktok.js.

import { ErroHttp, exigirGet, parametros, responder, responderComCache, rota } from "./_lib/http.js";
import { identificarFonte } from "./_lib/fontes/index.js";
import { validarUrl } from "./_lib/url.js";

const UMA_HORA = 60 * 60;
const UM_DIA = 24 * UMA_HORA;

export default rota(async (req, res) => {
  exigirGet(req);
  const url = validarUrl(parametros(req).get("url"));

  const fonte = identificarFonte(url);
  if (!fonte) throw new ErroHttp(422, "fonte-nao-suportada");

  try {
    const midia = await fonte.resolver(url);
    responderComCache(res, { midia }, { segundos: UMA_HORA, revalidar: UM_DIA });
  } catch (erro) {
    // "Planejada" leva junto qual fonte é, para a interface nomeá-la.
    if (erro instanceof ErroHttp && erro.fonte) return responder(res, erro.status, { erro: erro.codigo, fonte: erro.fonte });
    throw erro;
  }
});
