// Teste de fumaça de TODAS as páginas em navegador real, sobre o build
// (npm run build antes). Para cada página, em desktop e em celular:
//  - erros de JavaScript, de console (inclui hidratação e CSP) e de rede;
//  - rolagem horizontal (layout quebrado no celular);
//  - título e h1 presentes;
// e salva capturas de tela para revisão visual.
//
// Uso: npm run test:paginas
//      SO=/pdf/unir npm run test:paginas    (só uma página)
//      TEMA=dark npm run test:paginas       (tema escuro)
//      SAIDA=/pasta npm run test:paginas    (onde salvar as capturas)

import { spawn } from 'node:child_process'
import { mkdirSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { abrirNavegador, capturar, esperar, navegar, tela } from './navegador.mjs'

const RAIZ = fileURLToPath(new URL('..', import.meta.url))
const PORTA = 4100 + Math.floor(Math.random() * 500)
const BASE = `http://localhost:${PORTA}`
const SAIDA = process.env.SAIDA || join(tmpdir(), 'hipotetic-capturas')
mkdirSync(SAIDA, { recursive: true })

const sitemap = readFileSync(join(RAIZ, 'dist', 'sitemap.xml'), 'utf8')
let caminhos = [...sitemap.matchAll(/<loc>[^<]*?(\/[^<]*)<\/loc>/g)].map((m) => new URL(m[1], BASE).pathname)
caminhos.push('/nao-existe')
if (process.env.SO) caminhos = process.env.SO.split(',')

const servidor = spawn(process.execPath, [join(RAIZ, 'node_modules/vite/bin/vite.js'), 'preview', '--port', String(PORTA), '--strictPort'], { cwd: RAIZ })
for (let i = 0; i < 100; i += 1) {
  if (await fetch(BASE).then(() => true).catch(() => false)) break
  await esperar(150)
}

const s = await abrirNavegador()
const problemas = []
let atual = ''
s.em('Runtime.exceptionThrown', (p) => problemas.push(`${atual}: exceção ${p.exceptionDetails.exception?.description?.split('\n')[0] ?? p.exceptionDetails.text}`))
s.em('Runtime.consoleAPICalled', (p) => {
  if (p.type === 'error') problemas.push(`${atual}: console.error ${p.args.map((a) => a.value ?? a.description).join(' ').slice(0, 300)}`)
})
s.em('Log.entryAdded', ({ entry }) => {
  if (entry.level === 'error' && !/404 \(Not Found\)/.test(entry.text) && !/youtube|tiktok|doubleclick/i.test(entry.url ?? '')) {
    problemas.push(`${atual}: log ${entry.text.slice(0, 200)} ${entry.url ?? ''}`)
  }
})

const TELAS = [
  { nome: 'desktop', largura: 1366, altura: 768 },
  { nome: 'celular', largura: 390, altura: 844, celular: true },
]

for (const caminho of caminhos) {
  for (const t of TELAS) {
    atual = `${caminho} [${t.nome}]`
    await tela(s, { ...t, tema: process.env.TEMA })
    await navegar(s, BASE + caminho)
    await esperar(700)
    const info = await s.avaliar(`({
      rolagem: document.documentElement.scrollWidth - innerWidth,
      titulo: document.title,
      h1: document.querySelector('h1')?.textContent ?? '',
      tema: document.documentElement.dataset.theme,
    })`)
    if (info.rolagem > 0) problemas.push(`${atual}: rolagem horizontal de ${info.rolagem}px`)
    if (!info.titulo) problemas.push(`${atual}: sem <title>`)
    if (!info.h1) problemas.push(`${atual}: sem <h1>`)
    const nome = `${caminho.slice(1).replace(/\//g, '_') || 'inicio'}-${t.nome}${process.env.TEMA ? `-${process.env.TEMA}` : ''}.png`
    await capturar(s, join(SAIDA, nome), true)
  }
}

await s.fechar()
servidor.kill()

console.log(`${caminhos.length} páginas × ${TELAS.length} telas. Capturas em ${SAIDA}`)
if (problemas.length) {
  console.error(`\n${problemas.length} problema(s):\n- ${[...new Set(problemas)].join('\n- ')}`)
  process.exit(1)
}
console.log('Nenhum problema encontrado.')
