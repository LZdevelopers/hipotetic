// Registro das fontes. Cada uma é um adaptador independente com
// { id, nome, reconhece(url), resolver(url) } — adicionar uma plataforma é
// criar um arquivo aqui e incluí-lo na lista, sem tocar no resto.
//
// As "planejadas" só reconhecem o host para a interface dizer "ainda não"
// em vez de "link inválido". Nenhuma finge funcionar.

import { ErroHttp } from "../http.js";
import { hostBase } from "../url.js";
import { tiktok } from "./tiktok.js";
import { youtube } from "./youtube.js";

function planejada(id, nome, hosts) {
  const conjunto = new Set(hosts);
  return {
    id,
    nome,
    planejada: true,
    reconhece: (url) => conjunto.has(hostBase(url)),
    async resolver() {
      const erro = new ErroHttp(422, "fonte-planejada");
      erro.fonte = id;
      throw erro;
    },
  };
}

// O foco são redes sociais que não oferecem download fácil (e, no TikTok,
// sem marca d'água).
export const FONTES = [
  youtube,
  tiktok,
  // Instagram e Facebook: o oEmbed da Meta exige app aprovado e token, e os
  // termos proíbem download. Vimeo: download só com permissão do dono, via API
  // autenticada. X: API paga. O site responde "ainda não" para elas.
  planejada("instagram", "Instagram", ["instagram.com", "instagr.am"]),
  planejada("facebook", "Facebook", ["facebook.com", "fb.watch", "fb.com"]),
  planejada("vimeo", "Vimeo", ["vimeo.com", "player.vimeo.com"]),
  planejada("x", "X (Twitter)", ["x.com", "twitter.com"]),
];

/** Primeira fonte que reconhece a URL (ou null). */
export function identificarFonte(url) {
  return FONTES.find((fonte) => fonte.reconhece(url)) ?? null;
}
