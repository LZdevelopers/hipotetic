// Conversão de documentos com o LibreOffice (função comum da Vercel).
//
// POST /api/documentos/converter?para=<pdf|docx|odt|rtf|txt|html>
//   Cabeçalho X-Nome-Arquivo: nome original (para a extensão)
//   Corpo: o arquivo (até 4,5 MB — limite de corpo das funções)
//   → o arquivo convertido
// GET /api/documentos/converter → { disponivel } (aquece a instância)
//
// O arquivo é processado numa pasta temporária e apagado ao terminar.

import { ENTRADAS, SAIDAS, converter, libreofficeDisponivel, prepararLibreoffice } from "../_lib/libreoffice.js";

const LIMITE = 4.5 * 1024 * 1024;

// Limite simples por IP (por instância): 20 conversões a cada 10 minutos.
const JANELA = 10 * 60 * 1000;
const MAXIMO = 20;
const porIp = new Map();
function permitido(ip) {
  const agora = Date.now();
  const lista = (porIp.get(ip) ?? []).filter((t) => agora - t < JANELA);
  if (lista.length >= MAXIMO) return false;
  lista.push(agora);
  porIp.set(ip, lista);
  if (porIp.size > 10_000) porIp.clear();
  return true;
}

function json(res, status, corpo) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.end(JSON.stringify(corpo));
}

async function lerCorpo(req) {
  const partes = [];
  let total = 0;
  for await (const parte of req) {
    total += parte.length;
    if (total > LIMITE) throw Object.assign(new Error("grande"), { status: 413 });
    partes.push(parte);
  }
  return Buffer.concat(partes);
}

export default async function handler(req, res) {
  try {
    if (req.method === "GET") {
      // Aquecimento: a página pode chamar isto ao abrir, para a descompactação
      // do LibreOffice (a parte lenta) acontecer antes de o usuário converter.
      if (libreofficeDisponivel()) await prepararLibreoffice();
      return json(res, 200, { disponivel: libreofficeDisponivel() });
    }
    if (req.method !== "POST") return json(res, 405, { erro: "metodo" });
    if (!libreofficeDisponivel()) return json(res, 503, { erro: "indisponivel" });

    const ip = String(req.headers["x-forwarded-for"] ?? req.socket?.remoteAddress ?? "").split(",")[0].trim();
    if (!permitido(ip)) return json(res, 429, { erro: "limite" });

    const url = new URL(req.url, "http://local");
    const para = url.searchParams.get("para");
    if (!SAIDAS[para]) return json(res, 400, { erro: "formato-saida" });
    const nome = decodeURIComponent(String(req.headers["x-nome-arquivo"] ?? ""));
    const extensao = (/\.([a-z0-9]{1,5})$/i.exec(nome)?.[1] ?? "").toLowerCase();
    if (!ENTRADAS[extensao]) return json(res, 415, { erro: "formato-entrada" });

    const bytes = await lerCorpo(req);
    if (!bytes.length) return json(res, 400, { erro: "vazio" });
    if (!ENTRADAS[extensao](bytes)) return json(res, 415, { erro: "conteudo-invalido" });

    const saida = await converter(bytes, extensao, para);
    res.statusCode = 200;
    res.setHeader("Content-Type", SAIDAS[para].mime);
    res.setHeader("Content-Length", String(saida.length));
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Content-Disposition", "attachment");
    res.end(saida);
  } catch (erro) {
    if (erro.status === 413) return json(res, 413, { erro: "grande" });
    console.error("documentos: conversão falhou:", String(erro?.message).slice(0, 160));
    if (!res.headersSent) json(res, erro?.message === "tempo-esgotado" ? 504 : 422, { erro: erro?.message === "tempo-esgotado" ? "tempo-esgotado" : "falha" });
  }
}
