// Testes das regras puras da API (sem rede). Rodar: npm test

import assert from "node:assert/strict";
import { test } from "node:test";

import { identificarFonte } from "../api/_lib/fontes/index.js";
import { extrairId as idTiktok, opcoesDeDownload as opcoesTiktok } from "../api/_lib/fontes/tiktok.js";
import { extrairVideo } from "../api/_lib/fontes/youtube.js";
import { lerRange, nomeArquivo } from "../api/youtube.js";
import { ErroHttp } from "../api/_lib/http.js";
import { qualidades, resolverDesafio } from "../api/_lib/tiktok-cliente.js";
import { opcoesDeDownload } from "../api/_lib/youtube-cliente.js";
import { validarUrl } from "../api/_lib/url.js";

const codigo = (fn) => {
  try {
    fn();
  } catch (erro) {
    assert.ok(erro instanceof ErroHttp);
    return erro.codigo;
  }
  return null;
};

test("validarUrl aceita links públicos e completa o esquema", () => {
  assert.equal(validarUrl("youtu.be/dQw4w9WgXcQ").href, "https://youtu.be/dQw4w9WgXcQ");
  assert.equal(validarUrl("  https://archive.org/details/x  ").hostname, "archive.org");
});

test("validarUrl recusa vazio, esquemas estranhos e credenciais", () => {
  assert.equal(codigo(() => validarUrl("")), "url-ausente");
  assert.equal(codigo(() => validarUrl(null)), "url-ausente");
  assert.equal(codigo(() => validarUrl("javascript:alert(1)")), "url-invalida");
  assert.equal(codigo(() => validarUrl("ftp://exemplo.com/a.mp4")), "url-invalida");
  assert.equal(codigo(() => validarUrl("https://user:senha@exemplo.com/a.mp4")), "url-invalida");
  assert.equal(codigo(() => validarUrl("https://exemplo.com:8080/a.mp4")), "url-invalida");
  assert.equal(codigo(() => validarUrl(`https://exemplo.com/${"a".repeat(3000)}`)), "url-invalida");
  assert.equal(codigo(() => validarUrl("abc")), "url-invalida");
  assert.equal(codigo(() => validarUrl("http://intranet/a.mp4")), "url-invalida");
});

test("validarUrl recusa hosts internos", () => {
  for (const url of [
    "http://localhost/a.mp4",
    "http://127.0.0.1/a.mp4",
    "http://10.0.0.5/a.mp4",
    "http://192.168.1.1/a.mp4",
    "http://172.20.0.1/a.mp4",
    "http://169.254.169.254/latest/meta-data",
    "http://[::1]/a.mp4",
    "http://2130706433/a.mp4",
    "http://servidor.local/a.mp4",
  ]) {
    assert.equal(codigo(() => validarUrl(url)), "url-interna", url);
  }
});

test("YouTube: extrai o ID de todos os formatos de link", () => {
  const id = "dQw4w9WgXcQ";
  for (const url of [
    `https://www.youtube.com/watch?v=${id}&t=10`,
    `https://m.youtube.com/watch?v=${id}`,
    `https://youtu.be/${id}?si=abc`,
    `https://www.youtube.com/embed/${id}`,
    `https://www.youtube.com/live/${id}`,
    `https://music.youtube.com/watch?v=${id}`,
  ]) {
    assert.deepEqual(extrairVideo(new URL(url)), { id, short: false }, url);
  }
  assert.deepEqual(extrairVideo(new URL(`https://youtube.com/shorts/${id}`)), { id, short: true });
  assert.equal(extrairVideo(new URL("https://www.youtube.com/@canal")), null);
  assert.equal(extrairVideo(new URL("https://www.youtube.com/watch?v=curto")), null);
});

test("YouTube: Range do player", () => {
  assert.equal(lerRange(undefined, 1000), null);
  assert.deepEqual(lerRange("bytes=0-", 1000), { inicio: 0, fim: 999 });
  assert.deepEqual(lerRange("bytes=100-199", 1000), { inicio: 100, fim: 199 });
  assert.deepEqual(lerRange("bytes=900-5000", 1000), { inicio: 900, fim: 999 });
  assert.deepEqual(lerRange("bytes=-100", 1000), { inicio: 900, fim: 999 });
  assert.equal(codigo(() => lerRange("bytes=1000-", 1000)), "range-invalido");
  assert.equal(codigo(() => lerRange("bytes=5-2", 1000)), "range-invalido");
  assert.equal(codigo(() => lerRange("bytes=0-1,5-9", 1000)), "range-invalido");
});

test("YouTube: nome do arquivo sem caracteres proibidos", () => {
  assert.equal(nomeArquivo("AC/DC: Back in Black?", "mp4"), "AC DC Back in Black.mp4");
  assert.equal(nomeArquivo("   ", "m4a"), "video.m4a");
  assert.equal(nomeArquivo("a".repeat(300), "webm").length, 125);
});

test("TikTok: só links completos trazem o ID", () => {
  assert.equal(idTiktok(new URL("https://www.tiktok.com/@scout2015/video/6718335390845095173")), "6718335390845095173");
  assert.equal(idTiktok(new URL("https://www.tiktok.com/@scout2015")), null);
});

test("identificarFonte: só redes sociais", () => {
  const fonte = (url) => identificarFonte(new URL(url))?.id ?? null;
  assert.equal(fonte("https://youtu.be/dQw4w9WgXcQ"), "youtube");
  assert.equal(fonte("https://www.tiktok.com/@a/video/123456789"), "tiktok");
  assert.equal(fonte("https://www.instagram.com/reel/abc"), "instagram");
  assert.equal(fonte("https://exemplo.com/a.webm"), null);
  assert.equal(fonte("https://exemplo.com/pagina"), null);
});

test("YouTube: Short vertical usa o lado menor como qualidade (sem 360p repetido)", () => {
  const f = (itag, width, height, mime, extra = {}) => ({ itag, width, height, mime_type: mime, url: "x", has_video: true, has_audio: false, ...extra });
  const info = {
    basic_info: { duration: 30 },
    streaming_data: {
      formats: [f(18, 360, 640, 'video/mp4; codecs="avc1.42001E, mp4a.40.2"', { has_audio: true })],
      adaptive_formats: [
        f(137, 1080, 1920, 'video/mp4; codecs="avc1.640028"'),
        f(248, 1080, 1920, 'video/webm; codecs="vp9"'),
        f(134, 360, 640, 'video/mp4; codecs="avc1.4d401e"'),
        { itag: 140, mime_type: 'audio/mp4; codecs="mp4a.40.2"', url: "x", has_audio: true },
        { itag: 251, mime_type: 'audio/webm; codecs="opus"', url: "x", has_audio: true },
      ],
    },
  };
  const video = opcoesDeDownload("abcdefghijk", info).filter((o) => o.tipo === "video");
  assert.deepEqual(video.map((o) => [o.altura, o.extensao]), [[1080, "mp4"], [360, "mp4"]]);
  assert.equal(video[1].url, "/api/youtube?v=abcdefghijk&itag=18");
});

test("TikTok: resolve o desafio anti-robô (prova de trabalho SHA-256)", async () => {
  const { createHash } = await import("node:crypto");
  const a = Buffer.from("prefixo-qualquer");
  const c = createHash("sha256").update(a).update("4242").digest();
  const cs = Buffer.from(JSON.stringify({ v: { a: a.toString("base64"), b: 1, c: c.toString("base64") }, s: "x" })).toString("base64");
  const html = `<p id="wci" class="_wafchallengeid"></p><p id="cs" class="${cs}"></p>`;
  const [nome, valor] = resolverDesafio(html).split("=");
  assert.equal(nome, "_wafchallengeid");
  assert.equal(Buffer.from(JSON.parse(Buffer.from(valor, "base64").toString()).d, "base64").toString(), "4242");
  assert.equal(resolverDesafio("<html>vídeo normal</html>"), null);
});

test("TikTok: uma opção por qualidade, H.264 preferido na mesma altura", () => {
  const b = (GearName, CodecType, Width, Height, Bitrate) => ({ GearName, CodecType, Bitrate, PlayAddr: { Width, Height, DataSize: Bitrate, UrlList: ["u"] } });
  const item = {
    video: {
      bitrateInfo: [
        b("adapt_lowest_1080_1", "h265_hvc1", 1080, 1920, 3),
        b("normal_540_0", "h264", 576, 1024, 5),
        b("adapt_540_1", "h265_hvc1", 576, 1024, 9),
        b("lowest_540_0", "h264", 576, 1024, 1),
      ],
    },
  };
  assert.deepEqual(qualidades(item).map((q) => [q.altura, q.chave]), [[1080, "adapt_lowest_1080_1"], [540, "normal_540_0"]]);
});

test("TikTok: H.264 primeiro e recomendado; H.265 convertido no navegador", () => {
  const b = (GearName, CodecType, Width, Height) => ({ GearName, CodecType, Bitrate: 1, PlayAddr: { Width, Height, DataSize: 10, UrlList: ["u"] } });
  const item = { video: { duration: 10, bitrateInfo: [b("adapt_lowest_1080_1", "h265_hvc1", 1080, 1920), b("normal_540_0", "h264", 576, 1024)] } };
  const video = opcoesTiktok("123456789", item).filter((o) => o.tipo === "video");
  assert.deepEqual(video.map((o) => o.rotulo), ["540p", "1080p"]);
  assert.equal(video[0].recomendado, true);
  assert.equal(video[0].url, "/api/tiktok?id=123456789&q=normal_540_0");
  assert.deepEqual(video[1].processo, { acao: "h264", video: "/api/tiktok?id=123456789&q=adapt_lowest_1080_1" });
});
