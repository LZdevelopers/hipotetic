// Arquivo de mídia do YouTube, repassado em streaming.
//
// GET /api/youtube?v=<id>&itag=<n>
//   → o arquivo, com Content-Disposition inline: o Chrome abre no player
//     nativo, e o menu ⋮ → Baixar salva com o nome do vídeo. Também é a fonte
//     dos bytes que o navegador junta/converte com o ffmpeg.wasm.
//
// Suporta Range (o player pede pedaços para avançar/voltar). Do lado do
// YouTube o arquivo é buscado em blocos de 10 MB: pedidos maiores numa
// conexão só são derrubados pelo googlevideo.
//
// Nada é armazenado: os bytes passam direto do YouTube para o navegador.

import { ErroHttp, exigirGet, parametros, rota } from "./_lib/http.js";
import { cabecalhosDeArquivo, escrever, lerRange, nomeArquivo } from "./_lib/repasse.js";
import { downloadAtivo, duracaoMaxima, resolverArquivo } from "./_lib/youtube-cliente.js";

export { lerRange, nomeArquivo };

const ID = /^[A-Za-z0-9_-]{11}$/;
const BLOCO = 10 * 1024 * 1024;

export default rota(async (req, res) => {
  exigirGet(req);
  if (!downloadAtivo()) throw new ErroHttp(403, "desativado");

  const busca = parametros(req);
  const id = busca.get("v") ?? "";
  const itag = Number(busca.get("itag"));
  // Qualquer formato do próprio vídeo; resolverArquivo confere se ele existe.
  if (!ID.test(id) || !Number.isInteger(itag) || itag < 1 || itag > 999) throw new ErroHttp(400, "parametros");

  const arquivo = await resolverArquivo(id, itag);
  if (arquivo.duracao && arquivo.duracao > duracaoMaxima()) throw new ErroHttp(422, "muito-longo");

  const range = lerRange(req.headers.range, arquivo.tamanho);
  const inicio = range?.inicio ?? 0;
  const fim = range?.fim ?? arquivo.tamanho - 1;
  // Link do googlevideo expira e é por IP: a CDN nunca pode guardar isto.
  cabecalhosDeArquivo(res, { ...arquivo, range, inicio, fim });

  if (req.method === "HEAD") return res.end();

  // O player cancela pedidos o tempo todo (ao avançar o vídeo, por exemplo):
  // parar de buscar no YouTube assim que o navegador desiste.
  const cancelar = new AbortController();
  res.on("close", () => cancelar.abort());

  try {
    for (let pos = inicio; pos <= fim && !cancelar.signal.aborted; pos += BLOCO) {
      const ate = Math.min(pos + BLOCO - 1, fim);
      const resposta = await fetch(arquivo.url, { headers: { Range: `bytes=${pos}-${ate}` }, signal: cancelar.signal });
      if (resposta.status !== 206 || !resposta.body) throw new Error(`googlevideo respondeu ${resposta.status}`);
      for await (const pedaco of resposta.body) await escrever(res, pedaco);
    }
    res.end();
  } catch (erro) {
    // Cabeçalhos já enviados: não dá para responder JSON. Encerrar a conexão
    // faz o navegador acusar o download incompleto em vez de salvar lixo.
    if (!cancelar.signal.aborted) console.error("youtube: streaming interrompido", erro?.message);
    res.destroy();
  }
});
