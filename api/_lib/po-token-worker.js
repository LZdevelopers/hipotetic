// Gerador de PO token ("proof of origin") do YouTube — roda num worker thread.
//
// Sem PO token, o YouTube só libera ~1 minuto dos formatos separados (vídeo
// HD e áudio M4A/WebM) e responde 403 no resto. O token sai do BotGuard, o
// desafio anti-robô do próprio YouTube, executado aqui com a bgutils-js num
// DOM falso (jsdom), como no exemplo oficial da biblioteca.
//
// Por que um worker: o BotGuard exige `window`, `document` e `navigator`
// GLOBAIS. Num worker esses globais ficam presos nele e não contaminam o
// servidor (nem o Vite em desenvolvimento).
//
// Protocolo: o worker avisa { pronto } ou { falhou }; depois responde cada
// { n, id } com { n, token } ou { n, erro }.

import { parentPort } from "node:worker_threads";

import { BotGuardClient } from "bgutils-js/botguard";
import { buildURL, getHeaders, parseLooseJSON, USER_AGENT } from "bgutils-js/utils";
import { WebPoMinter } from "bgutils-js/webpo";
import { JSDOM } from "jsdom";

// Chave pública do cliente web do YouTube para o GenerateIT (vem da bgutils).
const REQUEST_KEY = "O43z0dpjhgX20SCx4KAo";

async function criarMinter() {
  const html = await (
    await fetch("https://www.youtube.com", {
      headers: { accept: "*/*", "accept-language": "en-US,en;q=0.7", "user-agent": USER_AGENT },
      signal: AbortSignal.timeout(10000),
    })
  ).text();

  const config = html.match(/ytcfg\.set\(({.+?})\);/s)?.[1];
  const desafio = html.match(/window\.ytAtN\(\s*({[\s\S]*?})\s*\)/)?.[1];
  if (!config || !desafio) throw new Error("página do YouTube sem ytcfg/desafio");

  const dom = new JSDOM("<!DOCTYPE html><html lang='en'><head><title></title></head><body></body></html>", {
    url: "https://www.youtube.com",
    referrer: "https://www.youtube.com/",
    userAgent: USER_AGENT,
  });
  dom.window.yt = { config_: JSON.parse(config) };
  Object.assign(globalThis, {
    yt: dom.window.yt,
    window: dom.window,
    document: dom.window.document,
    location: dom.window.location,
    origin: dom.window.origin,
  });
  if (!("navigator" in globalThis)) Object.defineProperty(globalThis, "navigator", { value: dom.window.navigator });

  const { bgChallenge } = parseLooseJSON(desafio).R;
  const interpretador = await (
    await fetch(`https:${bgChallenge.interpreterUrl.privateDoNotAccessOrElseTrustedResourceUrlWrappedValue}`, {
      signal: AbortSignal.timeout(10000),
    })
  ).text();
  new Function(interpretador)();

  const botguard = await BotGuardClient.create({
    program: bgChallenge.program,
    globalName: bgChallenge.globalName,
    globalObject: globalThis,
  });
  const sinais = [];
  const resposta = await botguard.snapshot({ webPoSignalOutput: sinais });
  const [integrityToken, estimatedTtlSecs, mintRefreshThreshold, websafeFallbackToken] = await (
    await fetch(buildURL("GenerateIT", true), {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify([REQUEST_KEY, resposta]),
      signal: AbortSignal.timeout(10000),
    })
  ).json();

  const minter = await WebPoMinter.create({ integrityToken, estimatedTtlSecs, mintRefreshThreshold, websafeFallbackToken }, sinais);
  return { minter, validade: estimatedTtlSecs };
}

criarMinter().then(
  ({ minter, validade }) => {
    parentPort.on("message", async ({ n, id }) => {
      try {
        parentPort.postMessage({ n, token: await minter.mintAsWebsafeString(id) });
      } catch (erro) {
        parentPort.postMessage({ n, erro: String(erro?.message ?? erro) });
      }
    });
    parentPort.postMessage({ pronto: true, validade });
  },
  (erro) => parentPort.postMessage({ falhou: String(erro?.message ?? erro) }),
);
