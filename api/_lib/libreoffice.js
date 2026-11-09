// LibreOffice dentro de uma função comum da Vercel (sem contêiner).
//
// O pacote lo.tar.br (gerado por servicos/libreoffice, ~100 MB) vai junto com
// a função (includeFiles no vercel.json). Na primeira execução de cada
// instância ele é descompactado em /tmp/lo; as seguintes reaproveitam.
//
// Cada conversão usa uma pasta temporária exclusiva, apagada ao terminar —
// com ou sem erro. Nada do documento fica gravado nem vai para os logs.

import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { createReadStream, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pipeline } from "node:stream/promises";
import { createBrotliDecompress } from "node:zlib";

const RAIZ = join(tmpdir(), "lo");
const PRONTO = join(RAIZ, ".pronto");
const PERFIL = join(tmpdir(), "lo-perfil");
const TEMPO_LIMITE = 100_000;

/** Onde está o pacote: variável LO_PACOTE ou o caminho incluído na função. */
function caminhoDoPacote() {
  const candidatos = [process.env.LO_PACOTE, join(process.cwd(), "servicos/libreoffice/saida/lo.tar.br")].filter(Boolean);
  return candidatos.find((c) => existsSync(c)) ?? null;
}

export const libreofficeDisponivel = () => Boolean(caminhoDoPacote());

let preparando = null;

/** Descompacta o LibreOffice em /tmp/lo (uma vez por instância). */
export function prepararLibreoffice() {
  preparando ??= (async () => {
    if (existsSync(PRONTO)) return;
    const pacote = caminhoDoPacote();
    if (!pacote) throw new Error("pacote-ausente");
    rmSync(RAIZ, { recursive: true, force: true });
    const tar = await import("tar");
    await pipeline(createReadStream(pacote), createBrotliDecompress(), tar.x({ cwd: tmpdir() }));
    // Perfil com macros desativadas e sem buscar links externos.
    mkdirSync(join(PERFIL, "user"), { recursive: true });
    writeFileSync(join(PERFIL, "user", "registrymodifications.xcu"), PERFIL_XCU);
    writeFileSync(PRONTO, String(Date.now()));
  })().catch((erro) => {
    preparando = null;
    throw erro;
  });
  return preparando;
}

const PERFIL_XCU = `<?xml version="1.0" encoding="UTF-8"?>
<oor:items xmlns:oor="http://openoffice.org/2001/registry" xmlns:xs="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
<item oor:path="/org.openoffice.Office.Common/Security/Scripting"><prop oor:name="MacroSecurityLevel" oor:op="fuse"><value>3</value></prop></item>
<item oor:path="/org.openoffice.Office.Common/Security/Scripting"><prop oor:name="DisableMacrosExecution" oor:op="fuse"><value>true</value></prop></item>
<item oor:path="/org.openoffice.Office.Common/Security/Scripting"><prop oor:name="BlockUntrustedRefererLinks" oor:op="fuse"><value>true</value></prop></item>
<item oor:path="/org.openoffice.Office.Writer/Content/Update"><prop oor:name="Link" oor:op="fuse"><value>2</value></prop></item>
<item oor:path="/org.openoffice.Office.Common/Misc"><prop oor:name="FirstRun" oor:op="fuse"><value>false</value></prop></item>
</oor:items>
`;

/** Entradas aceitas e a assinatura esperada dos primeiros bytes. */
export const ENTRADAS = {
  docx: (b) => b[0] === 0x50 && b[1] === 0x4b,
  odt: (b) => b[0] === 0x50 && b[1] === 0x4b,
  doc: (b) => b[0] === 0xd0 && b[1] === 0xcf && b[2] === 0x11 && b[3] === 0xe0,
  rtf: (b) => b.subarray(0, 5).toString("latin1") === "{\\rtf",
  txt: (b) => !b.subarray(0, 4096).includes(0),
  html: (b) => !b.subarray(0, 4096).includes(0),
  htm: (b) => !b.subarray(0, 4096).includes(0),
};

/** Filtros de exportação do LibreOffice por formato de saída. */
export const SAIDAS = {
  pdf: { filtro: "pdf:writer_pdf_Export", mime: "application/pdf" },
  docx: { filtro: "docx:MS Word 2007 XML", mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" },
  odt: { filtro: "odt:writer8", mime: "application/vnd.oasis.opendocument.text" },
  rtf: { filtro: "rtf:Rich Text Format", mime: "application/rtf" },
  txt: { filtro: "txt:Text (encoded):UTF8", mime: "text/plain; charset=utf-8" },
  html: { filtro: "html:XHTML Writer File:UTF8", mime: "text/html; charset=utf-8" },
};

function executarSoffice(args, pasta) {
  return new Promise((resolve, reject) => {
    const proc = spawn(join(RAIZ, "program", "soffice.bin"), [`-env:UserInstallation=file://${PERFIL}`, "--headless", "--invisible", "--norestore", "--nolockcheck", "--nodefault", "--nologo", ...args], {
      cwd: pasta,
      env: {
        ...process.env,
        HOME: tmpdir(),
        LD_LIBRARY_PATH: [join(RAIZ, "lib"), join(RAIZ, "program"), process.env.LD_LIBRARY_PATH].filter(Boolean).join(":"),
        FONTCONFIG_FILE: join(RAIZ, "fonts.conf"),
        SAL_USE_VCLPLUGIN: "svp",
      },
    });
    let erro = "";
    proc.stderr.on("data", (d) => (erro += d));
    const relogio = setTimeout(() => {
      proc.kill("SIGKILL");
      reject(new Error("tempo-esgotado"));
    }, TEMPO_LIMITE);
    proc.on("error", (e) => {
      clearTimeout(relogio);
      reject(e);
    });
    proc.on("close", (codigo) => {
      clearTimeout(relogio);
      if (codigo === 0) resolve();
      else reject(new Error(`soffice saiu com ${codigo}: ${erro.slice(0, 300)}`));
    });
  });
}

// Uma conversão por vez por instância: o LibreOffice não roda em paralelo no mesmo perfil.
let fila = Promise.resolve();

/** Converte `bytes` (com a extensão de origem) para `para`. Devolve Buffer. */
export function converter(bytes, extensao, para) {
  const vez = fila.then(async () => {
    await prepararLibreoffice();
    const pasta = join(tmpdir(), `conv-${randomUUID()}`);
    mkdirSync(pasta, { recursive: true });
    try {
      const entrada = join(pasta, `documento.${extensao}`);
      writeFileSync(entrada, bytes);
      const saidaDir = join(pasta, "saida");
      mkdirSync(saidaDir);
      const args = ["--convert-to", SAIDAS[para].filtro, "--outdir", saidaDir, entrada];
      try {
        await executarSoffice(args, pasta);
      } catch (e) {
        // 81 = primeira execução com perfil novo: o LibreOffice cria o perfil
        // e pede para ser "reiniciado" sem converter. Basta rodar de novo.
        if (!String(e.message).startsWith("soffice saiu com 81")) throw e;
        await executarSoffice(args, pasta);
      }
      const gerado = readdirSync(saidaDir)[0];
      if (!gerado) throw new Error("sem-saida");
      return readFileSync(join(saidaDir, gerado));
    } finally {
      rmSync(pasta, { recursive: true, force: true });
    }
  });
  fila = vez.catch(() => {});
  return vez;
}
