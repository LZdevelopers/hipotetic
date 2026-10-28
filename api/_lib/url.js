// Validação do link colado pelo usuário, antes de qualquer adaptador.
//
// Regras: só http(s), sem usuário/senha embutidos, sem porta fora do padrão e
// sem hosts internos (localhost, IPs privados, .local). Nenhum adaptador busca
// essa URL diretamente — ainda assim o filtro existe para que um link interno
// nunca chegue nem a ser exibido como "suportado".

import { ErroHttp } from "./http.js";

const TAMANHO_MAXIMO = 2048;

const HOSTS_INTERNOS = /^(localhost|.*\.localhost|.*\.local|.*\.internal|.*\.lan|metadata\.google\.internal)$/i;

/** true para IPv4 privados, loopback, link-local, CGNAT e afins. */
export function ipv4Interno(host) {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (!m) return false;
  const [a, b] = [Number(m[1]), Number(m[2])];
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    a >= 224
  );
}

/**
 * Texto do usuário → URL validada. Aceita links sem esquema ("youtu.be/…"),
 * que é como muita gente copia do celular.
 */
export function validarUrl(entrada) {
  if (typeof entrada !== "string") throw new ErroHttp(400, "url-ausente");
  let bruto = entrada.trim();
  if (!bruto) throw new ErroHttp(400, "url-ausente");
  if (bruto.length > TAMANHO_MAXIMO) throw new ErroHttp(400, "url-invalida");
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(bruto)) bruto = `https://${bruto}`;

  let url;
  try {
    url = new URL(bruto);
  } catch {
    throw new ErroHttp(400, "url-invalida");
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") throw new ErroHttp(400, "url-invalida");
  if (url.username || url.password) throw new ErroHttp(400, "url-invalida");
  if (url.port && url.port !== "80" && url.port !== "443") throw new ErroHttp(400, "url-invalida");

  const host = url.hostname.toLowerCase();
  // IPv6 literal ([::1], [fd00::…]) e IPv4 numérico não são links de mídia
  // pública que alguém cola — recusar todos é mais simples que classificar.
  if (host.startsWith("[") || /^\d+$/.test(host) || ipv4Interno(host)) throw new ErroHttp(400, "url-interna");
  if (HOSTS_INTERNOS.test(host)) throw new ErroHttp(400, "url-interna");
  // Sem ponto: ou é texto solto ("abc") ou um nome de rede interna ("intranet").
  if (!host.includes(".")) throw new ErroHttp(400, "url-invalida");

  return url;
}

/** host sem "www." e "m." — "m.youtube.com" e "youtube.com" são a mesma fonte. */
export function hostBase(url) {
  return url.hostname.toLowerCase().replace(/^(www|m|mobile)\./, "");
}
