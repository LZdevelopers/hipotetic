// Consulta às APIs públicas das fontes (oEmbed, metadados).
//
// A função só fala com os hosts fixos de cada adaptador — nunca com uma URL
// colada pelo usuário. É isso que fecha a porta para SSRF: o link do usuário
// vira um ID validado, e o ID entra num endereço montado por nós.

import { ErroHttp } from "./http.js";

const TEMPO_LIMITE_MS = 8000;
// A Wikimedia exige um User-Agent identificável (política de uso da API).
const AGENTE = "hipotetic/0.1 (projeto LZdev; https://lzdev.com.br)";

/**
 * GET em JSON com limite de tempo. Devolve { status, dados } para 2xx e 4xx
 * (o adaptador decide o que um 404 significa); falha de rede, tempo esgotado
 * ou 5xx viram ErroHttp 502 "indisponivel".
 */
export async function buscarJson(url, { tempoLimiteMs = TEMPO_LIMITE_MS } = {}) {
  let resposta;
  try {
    resposta = await fetch(url, {
      headers: { Accept: "application/json", "User-Agent": AGENTE },
      redirect: "follow",
      signal: AbortSignal.timeout(tempoLimiteMs),
    });
  } catch {
    throw new ErroHttp(502, "indisponivel");
  }
  if (resposta.status >= 500) throw new ErroHttp(502, "indisponivel");
  let dados = null;
  try {
    dados = await resposta.json();
  } catch {
    if (resposta.ok) throw new ErroHttp(502, "indisponivel");
  }
  return { status: resposta.status, dados };
}

/** Texto curto e limpo vindo de uma fonte externa (ou null). */
export function texto(valor, limite = 200) {
  if (typeof valor !== "string") return null;
  const limpo = valor.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
  return limpo ? limpo.slice(0, limite) : null;
}

/** Número finito e positivo (ou null). */
export function numero(valor) {
  const n = typeof valor === "string" ? Number.parseFloat(valor) : valor;
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Só URLs https — o que vai para <img>, <video> ou link de download. */
export function urlSegura(valor) {
  if (typeof valor !== "string") return null;
  try {
    const url = new URL(valor);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}
