// Cenários dos testes de integração (dev/testar-ferramentas.mjs), um arquivo
// por módulo em dev/cenarios/. Cada um: { nome, pagina, executar(t) };
// `t.js(código)` roda na página, onde window.__t tem os ajudantes.

import imagem from './cenarios/imagem.mjs'
import pdf from './cenarios/pdf.mjs'

export const CENARIOS = [...imagem, ...pdf]
