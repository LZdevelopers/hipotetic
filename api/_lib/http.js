// Utilidades HTTP das funções (pasta _lib: a Vercel não a publica como rota).
// Mesmo padrão do Global-Time: erros viram JSON com um código curto que a
// interface traduz, sem detalhes internos.

const CABECALHOS = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
  "CDN-Cache-Control": "no-store",
  "Vercel-CDN-Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
};

export function responder(res, status, corpo, extras = {}) {
  res.statusCode = status;
  for (const [nome, valor] of Object.entries({ ...CABECALHOS, ...extras })) res.setHeader(nome, valor);
  res.end(corpo == null ? "" : JSON.stringify(corpo));
}

/**
 * Resposta que a CDN pode guardar por `segundos` e continuar servindo por
 * `revalidar` segundos enquanto busca a versão nova. Muitos visitantes colando
 * o mesmo link custam uma consulta só às fontes — e uma invocação só da função.
 */
export function responderComCache(res, corpo, { segundos, revalidar = segundos }) {
  const cdn = `public, s-maxage=${segundos}, stale-while-revalidate=${revalidar}`;
  responder(res, 200, corpo, {
    "Cache-Control": "public, max-age=0, must-revalidate",
    "CDN-Cache-Control": cdn,
    "Vercel-CDN-Cache-Control": cdn,
  });
}

/** Erro com status HTTP e código para a interface traduzir. */
export class ErroHttp extends Error {
  constructor(status, codigo) {
    super(codigo);
    this.status = status;
    this.codigo = codigo;
  }
}

/** Parâmetros da URL do pedido (req.query não existe no servidor local). */
export function parametros(req) {
  return new URL(req.url, "http://local").searchParams;
}

/** Recusa métodos que não sejam GET/HEAD. */
export function exigirGet(req) {
  if (req.method !== "GET" && req.method !== "HEAD") throw new ErroHttp(405, "metodo");
}

/** Envolve o handler: converte ErroHttp e falhas inesperadas em JSON. */
export function rota(handler) {
  return async (req, res) => {
    try {
      await handler(req, res);
    } catch (erro) {
      if (erro instanceof ErroHttp) return responder(res, erro.status, { erro: erro.codigo });
      console.error(erro);
      return responder(res, 500, { erro: "interno" });
    }
  };
}
