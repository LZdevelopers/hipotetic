// Gera os ícones e a imagem de compartilhamento a partir do símbolo da marca
// (o mesmo SVG do componente Marca), renderizando no Chrome headless:
//   public/favicon.svg, favicon.ico (16/32/48), apple-touch-icon.png (180),
//   icone-192.png, icone-512.png e og.png (1200×630).
// Uso: node dev/gerar-icones.mjs  (rodar de novo quando a marca mudar)

import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { abrirNavegador, esperar } from './navegador.mjs'

const PUBLICO = fileURLToPath(new URL('../public/', import.meta.url))
const NOME = 'hipotetic' // TODO: nome provisório (src/textos.js)

const simbolo = (fundo = '#0b0b0d', frente = '#ffffff') => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <rect width="32" height="32" rx="8" fill="${fundo}"/>
  <path d="M9 9.5A1.5 1.5 0 0 1 10.5 8H16l4 4v7.5a1.5 1.5 0 0 1-1.5 1.5h-8A1.5 1.5 0 0 1 9 19.5z" fill="${frente}" opacity="0.38"/>
  <path d="M13 12.5a1.5 1.5 0 0 1 1.5-1.5H20l4 4v8.5a1.5 1.5 0 0 1-1.5 1.5h-8a1.5 1.5 0 0 1-1.5-1.5z" fill="${frente}"/>
  <path d="M17 19.2h3.6m0 0-1.5-1.5m1.5 1.5-1.5 1.5" stroke="${fundo}" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`

const s = await abrirNavegador()
await s.enviar('Emulation.setDefaultBackgroundColorOverride', { color: { r: 0, g: 0, b: 0, a: 0 } })

async function capturar(html, largura, altura) {
  await s.enviar('Emulation.setDeviceMetricsOverride', { width: largura, height: altura, deviceScaleFactor: 1, mobile: false })
  await s.avaliar(`document.open(); document.write(${JSON.stringify(html)}); document.close()`)
  await s.avaliar('document.fonts.ready.then(() => true)')
  await esperar(150)
  const { data } = await s.enviar('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width: largura, height: altura, scale: 1 } })
  return Buffer.from(data, 'base64')
}

const icone = (lado, margem = 0, fundoPagina = 'transparent') =>
  capturar(`<html><body style="margin:0;background:${fundoPagina}"><div style="width:${lado}px;height:${lado}px;padding:${margem}px;box-sizing:border-box">${simbolo().replace('<svg ', `<svg width="${lado - 2 * margem}" height="${lado - 2 * margem}" `)}</div></body></html>`, lado, lado)

writeFileSync(join(PUBLICO, 'favicon.svg'), simbolo())
const png = {}
for (const lado of [16, 32, 48, 192, 512]) png[lado] = await icone(lado)
writeFileSync(join(PUBLICO, 'icone-192.png'), png[192])
writeFileSync(join(PUBLICO, 'icone-512.png'), png[512])
// Apple: sem transparência (o iOS pinta de preto) — fundo branco com margem.
writeFileSync(join(PUBLICO, 'apple-touch-icon.png'), await icone(180, 18, '#ffffff'))

// favicon.ico com PNGs embutidos (16, 32, 48).
const tamanhos = [16, 32, 48]
const cabecalho = 6 + 16 * tamanhos.length
const ico = Buffer.alloc(cabecalho + tamanhos.reduce((t, l) => t + png[l].length, 0))
ico.writeUInt16LE(1, 2)
ico.writeUInt16LE(tamanhos.length, 4)
let pos = cabecalho
tamanhos.forEach((l, i) => {
  const e = 6 + i * 16
  ico[e] = l
  ico[e + 1] = l
  ico.writeUInt16LE(1, e + 4)
  ico.writeUInt16LE(32, e + 6)
  ico.writeUInt32LE(png[l].length, e + 8)
  ico.writeUInt32LE(pos, e + 12)
  png[l].copy(ico, pos)
  pos += png[l].length
})
writeFileSync(join(PUBLICO, 'favicon.ico'), ico)

// Imagem de compartilhamento (WhatsApp, X, LinkedIn…): 1200×630.
const og = await capturar(
  `<html><head><style>
    body{margin:0;width:1200px;height:630px;background:#0b0b0d;color:#f4f5f6;font-family:"Segoe UI",system-ui,sans-serif;display:flex;flex-direction:column;justify-content:space-between;padding:72px 80px;box-sizing:border-box}
    .marca{display:flex;align-items:center;gap:20px;font-size:40px;font-weight:800;letter-spacing:-1px}
    h1{font-size:76px;line-height:1.04;letter-spacing:-2.5px;margin:0;font-weight:800;max-width:980px}
    h1 span{color:#8b909b}
    .cats{display:flex;gap:14px;flex-wrap:wrap}
    .cats span{border:1px solid #33363e;border-radius:999px;padding:10px 22px;font-size:26px;color:#dfe1e5}
  </style></head><body>
    <div class="marca">${simbolo('#f4f5f6', '#0b0b0d').replace('<svg ', '<svg width="64" height="64" ')}${NOME}</div>
    <h1>Tudo o que você faz com arquivos, <span>num só lugar</span></h1>
    <div class="cats"><span>Vídeo</span><span>Áudio</span><span>Imagens</span><span>PDF</span><span>Documentos</span><span>Compactados</span></div>
  </body></html>`,
  1200,
  630,
)
writeFileSync(join(PUBLICO, 'og.png'), og)

await s.fechar()
console.log('Ícones e og.png gerados em public/.')
