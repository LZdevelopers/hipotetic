// Peças comuns das rotas que repassam arquivos de mídia em streaming
// (api/youtube.js e api/tiktok.js). Nada é armazenado: os bytes passam direto
// da plataforma para o navegador.

import { ErroHttp } from "./http.js";

/** "bytes=100-" / "bytes=100-199" → { inicio, fim } ou null (sem Range). */
export function lerRange(cabecalho, tamanho) {
  if (!cabecalho) return null;
  const m = /^bytes=(\d*)-(\d*)$/.exec(cabecalho.trim());
  if (!m || (m[1] === "" && m[2] === "")) throw new ErroHttp(416, "range-invalido");
  let inicio;
  let fim;
  if (m[1] === "") {
    // "bytes=-500": os últimos 500 bytes
    inicio = Math.max(0, tamanho - Number(m[2]));
    fim = tamanho - 1;
  } else {
    inicio = Number(m[1]);
    fim = m[2] === "" ? tamanho - 1 : Math.min(Number(m[2]), tamanho - 1);
  }
  if (inicio >= tamanho || inicio > fim) throw new ErroHttp(416, "range-invalido");
  return { inicio, fim };
}

/** Nome de arquivo seguro para o Content-Disposition. */
export function nomeArquivo(titulo, extensao) {
  const limpo = String(titulo)
    .replace(/[\\/:*?"<>|\u0000-\u001f]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
  return `${limpo || "video"}.${extensao}`;
}

/**
 * Cabeçalhos da resposta de um arquivo: tipo, tamanho, Range e
 * Content-Disposition inline — o Chrome abre no player nativo, e o menu
 * ⋮ → Baixar salva com o nome do vídeo. Os links das plataformas expiram,
 * então nenhuma CDN pode guardar a resposta.
 */
export function cabecalhosDeArquivo(res, { mime, extensao, titulo, tamanho, range, inicio, fim }) {
  res.statusCode = range ? 206 : 200;
  res.setHeader("Content-Type", mime);
  res.setHeader("Content-Length", String(fim - inicio + 1));
  res.setHeader("Accept-Ranges", "bytes");
  if (range) res.setHeader("Content-Range", `bytes ${inicio}-${fim}/${tamanho}`);
  res.setHeader("Content-Disposition", `inline; filename="midia.${extensao}"; filename*=UTF-8''${encodeURIComponent(nomeArquivo(titulo, extensao))}`);
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("CDN-Cache-Control", "no-store");
  res.setHeader("Vercel-CDN-Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
}

/** Escreve respeitando a pressão de volta do socket (não enche a memória). */
export function escrever(res, pedaco) {
  if (res.write(pedaco)) return Promise.resolve();
  return new Promise((ok) => res.once("drain", ok));
}
