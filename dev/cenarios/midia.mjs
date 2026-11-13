import assert from 'node:assert/strict'
import { ajustes, enviar, formato } from './comum.mjs'

// Arquivos produzidos por um cenário e usados nos seguintes (ex.: o MP4 da
// conversão vira entrada da compressão). Os cenários rodam em ordem.
const guardados = {}
const guardar = async (t, chave, i = 0) => (guardados[chave] = await t.js(`return await __t.guardar('${chave}', ${i})`))
const usar = (chave) => {
  const g = guardados[chave]
  if (!g) throw new Error(`o cenário que gera “${chave}” falhou antes`)
  return `new File([Uint8Array.from(atob('${g.base64}'), (c) => c.charCodeAt(0))], '${g.nome}', { type: '${g.tipo}' })`
}
const perto = (valor, esperado, folga, rotulo) => assert.ok(Math.abs(valor - esperado) <= folga, `${rotulo}: ${valor} (esperado ~${esperado})`)
const bytes = (t, i = 0) => t.js(`return await __t.bytes(${i})`)
const temTrilhaDeAudio = (b) => Buffer.from(b).includes('soun')
/** Editor de áudio: abre o arquivo e espera a duração aparecer. */
async function abrirEditorAudio(t, codigoArquivo, duracaoTexto) {
  await t.js(`__t.enviar([${codigoArquivo}])`)
  await t.aguardar(`document.querySelector('main audio') && document.querySelector('main').innerText.includes('${duracaoTexto}')`, 20000)
}

/** Escolhe a opção `valor` no <select> da página que tem essa opção. */
const escolher = (t, valor) =>
  t.js(`const s = [...document.querySelectorAll('main select')].find((x) => [...x.options].some((o) => o.value === ${JSON.stringify(valor)}))
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(s, ${JSON.stringify(valor)})
    s.dispatchEvent(new Event('change', { bubbles: true }))`)

/** Editor de vídeo: abre os arquivos como clipes e espera aparecerem na linha do tempo. */
async function abrirNoEditor(t, extra = '', n = 1) {
  await t.js(`__t.enviar([${usar('mp4')}${extra}], 'main input[aria-label="Escolher clipes"]')`)
  await t.aguardar(`document.querySelectorAll('main [aria-label^="Clipe "]').length === ${n}`, 30000)
}
/** Campo de tempo (aplica ao sair do campo). */
const campoTempo = (t, rotulo, valor, n = 0) =>
  t.js(`const l = [...document.querySelectorAll('main aside label')].filter((x) => x.firstChild?.textContent?.trim() === ${JSON.stringify(rotulo)})[${n}]
    const el = l.querySelector('input'); el.focus()
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, ${JSON.stringify(valor)})
    el.dispatchEvent(new Event('input', { bubbles: true }))
    // Sem foco de janela (navegador de teste), blur() não dispara o evento: dispara à mão.
    el.dispatchEvent(new FocusEvent('focusout', { bubbles: true })); el.blur()`)
/** Campo numérico do recorte (em %). */
const campoRecorte = (t, rotulo, valor) =>
  t.js(`const el = document.querySelector('main input[aria-label="${rotulo} do crop em %"]')
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, '${valor}')
    el.dispatchEvent(new Event('input', { bubbles: true }))`)
/** Exportar vídeo: abre o modal e confirma (com mudanças opcionais nos campos antes). */
async function exportarVideo(t, antes) {
  await t.clicar('Exportar vídeo')
  await t.aguardar("document.querySelector('main dialog[open] [data-exportar]')", 5000)
  if (antes) await antes()
  await t.js("document.querySelector('main dialog[open] [data-exportar]').click()")
}
/** Opção (cartão) dentro do modal de exportar. */
const opcaoModal = (t, texto) => t.js(`[...document.querySelectorAll('main dialog[open] [role=radio]')].find((b) => b.textContent.trim().startsWith(${JSON.stringify(texto)})).click()`)
/** Arrasta um elemento da linha do tempo na horizontal (eventos de ponteiro, passo a passo). */
const arrastarX = (t, seletor, dx, { soltar = true } = {}) =>
  t.js(`const el = document.querySelector(${JSON.stringify(seletor)}); const r = el.getBoundingClientRect(); const x0 = r.left + r.width / 2
    const ev = (tipo, x) => el.dispatchEvent(new PointerEvent(tipo, { bubbles: true, button: 0, clientX: x, clientY: r.top + r.height / 2, pointerId: 1 }))
    ev('pointerdown', x0); for (let i = 1; i <= 8; i += 1) ev('pointermove', x0 + (${dx} * i) / 8)
    ${soltar ? 'ev("pointerup", x0 + ' + dx + ')' : ''}`)
/** Aba do painel de propriedades. */
const aba = (t, nome) => t.js(`[...document.querySelectorAll('main aside [role=radio]')].find((b) => b.textContent.trim() === '${nome}').click()`)

export default [
  // ─── Vídeo ────────────────────────────────────────────────────────────────
  {
    nome: 'converter: gravação WebM vira MP4 (H.264)',
    pagina: '/converter',
    async executar(t) {
      await enviar(t, `[__t.arquivo(await __t.gravarVideo(3), 'gravacao.webm')]`)
      await formato(t, 'MP4')
      await t.clicar('Converter')
      await t.aguardarResultado(180000)
      const [r] = await t.js('return await __t.resultados()')
      assert.equal(r.tipo, 'mp4')
      const m = await t.js('return await __t.midia()')
      assert.deepEqual([m.largura, m.altura], [640, 360])
      perto(m.duracao, 3, 0.6, 'duração')
      assert.ok(temTrilhaDeAudio(await bytes(t)), 'o MP4 deveria ter áudio')
      await guardar(t, 'mp4')
    },
  },
  {
    nome: 'converter: MP4 → WebM em 360p',
    pagina: '/converter',
    async executar(t) {
      await enviar(t, `[${usar('mp4')}]`)
      await formato(t, 'WEBM')
      await ajustes(t)
      await t.js(`__t.digitar('Resolução', '360')`)
      await t.clicar('Converter')
      await t.aguardarResultado(240000)
      const [r] = await t.js('return await __t.resultados()')
      assert.equal(r.tipo, 'webm')
      const m = await t.js('return await __t.midia()')
      assert.equal(Math.min(m.largura, m.altura), 360)
    },
  },
  {
    nome: 'video/comprimir: para caber em 1 MB',
    pagina: '/video/comprimir',
    async executar(t) {
      await enviar(t, `[${usar('mp4')}]`)
      await t.clicar('Tamanho final')
      await t.js(`__t.digitar('Tamanho máximo', '1')`)
      await t.clicar('Comprimir vídeo')
      await t.aguardarResultado(240000)
      const [r] = await t.js('return await __t.resultados()')
      assert.ok(r.tamanho <= 1.1 * 1024 * 1024, `ficou com ${r.tamanho} bytes`)
    },
  },
  {
    nome: 'video/editor: aparece vazio, junta 2 vídeos e corta um trecho',
    pagina: '/video/editor',
    async executar(t) {
      assert.ok(await t.js("return Boolean(document.querySelector('main section[aria-label=Player] button[aria-label=Tocar]') && document.querySelector('main aside[aria-label=Propriedades]'))"), 'o editor deveria aparecer antes do arquivo')
      await abrirNoEditor(t, `, __t.arquivo(await __t.gravarVideo(2, 640, 360), 'zz-segunda.webm')`, 2)
      await t.aguardar("document.querySelector('main').innerText.includes('2 clipes em sequência')", 5000)
      // Clipe 1 (3 s): usa só de 0:01 a 0:02.5 → 1,5 s + 2 s do segundo.
      await t.js("document.querySelector('main [aria-label^=\"Clipe 1\"]').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0 }))")
      await aba(t, 'Clipe')
      await campoTempo(t, 'De', '0:01')
      await campoTempo(t, 'Até', '0:02.5')
      await t.aguardar("document.querySelector('[title=\"Duração do vídeo final\"]').textContent.includes('0:03.5')", 5000)
      await exportarVideo(t)
      await t.aguardarResultado(300000)
      const m = await t.js('return await __t.midia()')
      perto(m.duracao, 3.5, 0.4, 'duração dos dois clipes')
      assert.deepEqual([m.largura, m.altura], [640, 360])
    },
  },
  {
    nome: 'video/editor: recorte livre e velocidade 2×',
    pagina: '/video/editor',
    async executar(t) {
      await abrirNoEditor(t)
      await t.clicar('Crop')
      await t.aguardar("document.querySelector('main [aria-label=\"Área do recorte\"]')", 5000)
      await campoRecorte(t, 'Esquerda', 25)
      await campoRecorte(t, 'Largura', 50)
      await campoRecorte(t, 'Topo', 0)
      await campoRecorte(t, 'Altura', 100)
      await t.clicar('Aplicar crop')
      await aba(t, 'Clipe')
      await t.js("__t.digitar('Velocidade', '2')")
      await t.aguardar("document.querySelector('[title=\"Duração do vídeo final\"]').textContent.includes('0:01.5')", 5000)
      await exportarVideo(t)
      await t.aguardarResultado(300000)
      const m = await t.js('return await __t.midia()')
      assert.deepEqual([m.largura, m.altura], [320, 360], 'recorte de metade da largura')
      perto(m.duracao, 1.5, 0.35, 'duração a 2×')
    },
  },
  {
    nome: 'video/editor: texto, imagem, desfoque e música',
    pagina: '/video/editor',
    async executar(t) {
      await abrirNoEditor(t)
      await t.clicar('Texto')
      await t.js("__t.digitar('Texto', 'Olá, mundo')")
      await t.clicar('Blur')
      await t.js(`__t.enviar([__t.arquivo(await __t.imagem(200, 100), 'logo.png')], 'main input[aria-label="Escolher camada"]')`)
      await t.js(`__t.enviar([__t.arquivo(__t.wav([{ s: 2, hz: 660 }]), 'musica.wav')], 'main input[aria-label="Escolher musica"]')`)
      await t.aguardar("document.querySelectorAll('main [aria-label^=\"Camada \"][role=button]').length === 3 && document.querySelector('main').innerText.includes('musica.wav')", 20000)
      await exportarVideo(t)
      await t.aguardarResultado(300000)
      const m = await t.js('return await __t.midia()')
      assert.deepEqual([m.largura, m.altura], [640, 360])
      perto(m.duracao, 3, 0.5, 'duração')
      assert.ok(temTrilhaDeAudio(await bytes(t)), 'sem trilha de áudio')
    },
  },
  {
    nome: 'video/editor: camada girada, espelhada, sem fundo e com entrada suave',
    pagina: '/video/editor',
    async executar(t) {
      await abrirNoEditor(t)
      // Logo com fundo branco (um círculo vermelho num quadrado branco).
      await t.js(`const c = document.createElement('canvas'); c.width = 200; c.height = 200; const x = c.getContext('2d')
        x.fillStyle = '#fff'; x.fillRect(0, 0, 200, 200); x.fillStyle = '#e11d48'; x.beginPath(); x.arc(100, 100, 70, 0, 7); x.fill()
        const b = await new Promise((ok) => c.toBlob(ok, 'image/png'))
        __t.enviar([new File([b], 'logo-branco.png', { type: 'image/png' })], 'main input[aria-label="Escolher camada"]')`)
      await t.aguardar("document.querySelector('main [aria-label^=\"Camada Imagem\"][role=button]')", 10000)
      await t.js("document.querySelector('main [aria-label^=\"Camada Imagem\"][role=button]').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0 }))")
      await aba(t, 'Camada')
      await t.js("__t.digitar('Rotação', '30')")
      await t.js("document.querySelector('main button[aria-label=\"Flip horizontal\"]').click()")
      await t.clicar('Branco')
      await t.js("__t.digitar('Fade in', '0.5')")
      // Na prévia: a camada gira e o fundo branco some.
      await t.aguardar("document.querySelector('main [aria-label=\"Camada: imagem\"]')?.style.transform.includes('rotate(30deg)')", 5000)
      await t.aguardar("document.querySelector('main [aria-label=\"Camada: imagem\"] img')?.src.startsWith('blob:')", 5000)
      await exportarVideo(t)
      await t.aguardarResultado(300000)
      const m = await t.js('return await __t.midia()')
      assert.deepEqual([m.largura, m.altura], [640, 360])
      perto(m.duracao, 3, 0.5, 'duração')
    },
  },
  {
    nome: 'video/editor: imagem como clipe pelo +, reordenada para o início',
    pagina: '/video/editor',
    async executar(t) {
      await abrirNoEditor(t)
      // O + da trilha abre o seletor de clipes (vídeo, imagem ou GIF).
      assert.ok(await t.js("return Boolean(document.querySelector('main button[aria-label=\"Adicionar vídeo, imagem ou GIF\"]'))"), 'falta o + na trilha')
      await t.js(`__t.enviar([__t.arquivo(await __t.imagem(640, 360), 'foto.png')], 'main input[aria-label="Escolher clipes"]')`)
      await t.aguardar("document.querySelectorAll('main [aria-label^=\"Clipe \"]').length === 2", 15000)
      await t.aguardar("document.querySelector('[title=\"Duração do vídeo final\"]').textContent.includes('0:06')", 5000)
      // Arrasta a imagem (clipe 2) para antes do vídeo.
      await t.js(`const el = document.querySelector('main [aria-label^="Clipe 2"]'); const r = el.getBoundingClientRect(); const trilha = el.parentElement.getBoundingClientRect()
        const ev = (tipo, x) => el.dispatchEvent(new PointerEvent(tipo, { bubbles: true, button: 0, clientX: x, clientY: r.top + 5, pointerId: 1 }))
        ev('pointerdown', r.left + r.width / 2); ev('pointermove', r.left + r.width / 2 - 20); ev('pointermove', trilha.left + 4); ev('pointerup', trilha.left + 4)`)
      await t.aguardar("document.querySelector('main [aria-label^=\"Clipe 1\"]').getAttribute('aria-label').includes('foto.png')", 5000)
      await exportarVideo(t)
      await t.aguardarResultado(300000)
      const m = await t.js('return await __t.midia()')
      assert.deepEqual([m.largura, m.altura], [640, 360])
      perto(m.duracao, 6, 0.5, 'imagem (3 s) + vídeo (3 s)')
    },
  },
  {
    nome: 'video/editor: texto com fonte, itálico, stroke e sombra; blur pixelate em elipse',
    pagina: '/video/editor',
    async executar(t) {
      await abrirNoEditor(t)
      await t.clicar('Texto')
      await t.js("__t.digitar('Texto', 'Fonte nova')")
      await t.js(`const s = [...document.querySelectorAll('main aside label')].find((l) => l.firstChild?.textContent?.trim() === 'Fonte').querySelector('select')
        Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(s, 'georgia'); s.dispatchEvent(new Event('change', { bubbles: true }))`)
      await t.js("document.querySelector('main aside button[aria-label=\"Itálico\"]').click()")
      await t.js("document.querySelector('main aside button[aria-label=\"Caixa alta (maiúsculas)\"]').click()")
      await t.js("[...document.querySelectorAll('main aside label')].find((l) => l.textContent.trim().startsWith('Drop shadow')).click()")
      await t.aguardar("(() => { const e = document.querySelector('main [aria-label=\"Camada: texto\"] div'); return e && e.style.fontFamily.includes('Georgia') && e.style.fontStyle === 'italic' && e.textContent.includes('FONTE NOVA') })()", 5000)
      await t.clicar('Blur')
      await t.clicar('Pixelate')
      await t.clicar('Elipse')
      await t.js("__t.digitar('Intensidade', '80')")
      await t.aguardar("document.querySelector('main [aria-label=\"Camada: desfoque\"] div')?.style.borderRadius === '50%'", 5000)
      await exportarVideo(t)
      await t.aguardarResultado(300000)
      const m = await t.js('return await __t.midia()')
      assert.deepEqual([m.largura, m.altura], [640, 360])
      perto(m.duracao, 3, 0.5, 'duração')
    },
  },
  {
    nome: 'video/editor: aba Áudio (noise reduction, LUFS, fades, trilha com ducking) e exportar só o áudio',
    pagina: '/video/editor',
    async executar(t) {
      await abrirNoEditor(t)
      await aba(t, 'Áudio')
      await t.clicar('Média')
      await t.clicar('-14 LUFS')
      await t.aguardar("[...document.querySelectorAll('main aside label')].some((l) => l.textContent.trim().startsWith('Voice enhance'))", 10000)
      await t.js("[...document.querySelectorAll('main aside label')].find((l) => l.textContent.trim().startsWith('Voice enhance')).click()")
      await t.js("__t.digitar('Fade in do áudio', '1')")
      await t.js(`__t.enviar([__t.arquivo(__t.wav([{ s: 2, hz: 660 }]), 'trilha.wav')], 'main input[aria-label="Escolher musica"]')`)
      await t.aguardar("document.querySelector('main').innerText.includes('trilha.wav')", 15000)
      await t.aguardar("[...document.querySelectorAll('main aside label')].some((l) => l.textContent.trim().startsWith('Ducking'))", 10000)
      await t.js("[...document.querySelectorAll('main aside label')].find((l) => l.textContent.trim().startsWith('Ducking')).click()")
      await t.js("__t.digitar('Fade out da trilha', '1')")
      await t.clicar('Exportar só o áudio')
      await t.aguardarResultado(300000)
      const [r] = await t.js('return await __t.resultados()')
      assert.equal(r.tipo, 'mp3')
      const m = await t.js('return await __t.midia()')
      perto(m.duracao, 3, 0.5, 'duração do áudio')
    },
  },
  {
    nome: 'video/editor: modal de exportar — renomear, qualidade com tamanho estimado e GIF',
    pagina: '/video/editor',
    async executar(t) {
      await abrirNoEditor(t)
      // Renomear pelo nome no topo do editor.
      await t.js("document.querySelector('main button[aria-label^=\"Renomear o arquivo\"]').click()")
      await t.aguardar("document.querySelector('main input[aria-label=\"Nome do arquivo\"]')", 3000)
      await t.js(`const el = document.querySelector('main input[aria-label="Nome do arquivo"]')
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, 'Minha viagem')
        el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new FocusEvent('focusout', { bubbles: true })); el.blur()`)
      await t.aguardar("document.querySelector('main button[aria-label=\"Renomear o arquivo: Minha viagem\"]')", 3000)
      // Os seletores de formato/resolução saíram do topo.
      assert.ok(!(await t.js("return Boolean(document.querySelector('main select[title=\"Formato do vídeo final\"]'))")), 'o formato deveria estar só no modal')
      await exportarVideo(t, async () => {
        assert.equal(await t.js("return document.querySelector('main dialog[open] input[aria-label=\"Nome do arquivo\"]').value"), 'Minha viagem')
        // Cada qualidade mostra o tamanho estimado; máxima > mínima.
        const mb = (txt) => Number(txt.replace(/[^\d,]/g, '').replace(',', '.')) * (txt.includes('KB') ? 1 / 1024 : 1)
        const tamanhos = await t.js("return [...document.querySelectorAll('main dialog[open] [role=radio]')].filter((b) => /^(Máxima|Mínima)/.test(b.textContent.trim())).map((b) => b.textContent)")
        assert.ok(mb(tamanhos[0].split('~')[1]) > mb(tamanhos[1].split('~')[1]), `estimativas: ${tamanhos}`)
        await opcaoModal(t, 'GIF')
        await t.aguardar("document.querySelector('main dialog[open] [data-exportar]').textContent.includes('GIF')", 3000)
      })
      await t.aguardarResultado(300000)
      const [r] = await t.js('return await __t.resultados()')
      assert.equal(r.tipo, 'gif')
      assert.equal(r.nome, 'Minha viagem.gif')
      assert.equal(r.largura, 480)
    },
  },
  {
    nome: 'video/editor: exportar com tamanho exato (MB) em MKV',
    pagina: '/video/editor',
    async executar(t) {
      await abrirNoEditor(t)
      await exportarVideo(t, async () => {
        await opcaoModal(t, 'MKV')
        await t.js(`const el = document.querySelector('main dialog[open] input[aria-label="Tamanho do arquivo em MB"]'); el.focus()
          Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, '1')
          el.dispatchEvent(new Event('input', { bubbles: true }))`)
        await t.aguardar("document.querySelector('main dialog[open] [data-estimativa]').textContent.includes('1 MB') || document.querySelector('main dialog[open] [data-estimativa]').textContent.includes('KB')", 3000)
      })
      await t.aguardarResultado(300000)
      const [r] = await t.js('return await __t.resultados()')
      assert.ok(r.nome.endsWith('-editado.mkv'), r.nome)
      assert.ok(r.tamanho < 1.3 * 1024 * 1024, `deveria caber em ~1 MB: ${r.tamanho}`)
    },
  },
  {
    nome: 'video/editor: timeline — aparar o começo e voltar não sai da tela; zoom',
    pagina: '/video/editor',
    async executar(t) {
      await abrirNoEditor(t)
      const inicio = 'main [aria-label^="Clipe 1"] [aria-label="Aparar o início"]'
      const duracao = () => t.js("return document.querySelector('[title=\"Duração do vídeo final\"]').textContent")
      const original = await duracao()
      await arrastarX(t, inicio, 120)
      assert.notEqual(await duracao(), original, 'o trim deveria encurtar o clipe')
      // Voltando: a borda fica embaixo do mouse desde o começo do arrasto…
      const bordaSegue = await t.js(`const h = document.querySelector(${JSON.stringify(inicio)}); const r = h.getBoundingClientRect(); const x0 = r.left + r.width / 2
        h.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, clientX: x0, clientY: r.top + 5, pointerId: 1 }))
        await new Promise((ok) => requestAnimationFrame(() => requestAnimationFrame(ok)))
        h.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, button: 0, clientX: x0 - 6, clientY: r.top + 5, pointerId: 1 }))
        await new Promise((ok) => requestAnimationFrame(() => requestAnimationFrame(ok)))
        const r2 = h.getBoundingClientRect(); window.__x0 = x0
        return Math.abs(r2.left + r2.width / 2 - (x0 - 6))`)
      assert.ok(bordaSegue < 4, `a borda deveria seguir o mouse (diferença de ${bordaSegue}px)`)
      // …e com o mouse muito além da borda (outro monitor), ela para na beirada e a linha rola sozinha.
      await t.js(`const h = document.querySelector(${JSON.stringify(inicio)}); h.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, button: 0, clientX: -900, clientY: 10, pointerId: 1 }))`)
      await t.esperar(1500)
      const dentro = await t.js(`const clipe = document.querySelector('main [aria-label^="Clipe 1"]').getBoundingClientRect()
        const vista = document.querySelector('main [aria-label="Zoom da linha do tempo"]').closest('div.flex.flex-col').querySelector('.overflow-auto').getBoundingClientRect()
        return clipe.left >= vista.left + 96 - 2 && clipe.left <= vista.left + 96 + 30`)
      await t.js(`const el = document.querySelector(${JSON.stringify(inicio)}); el.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, button: 0, clientX: -900, pointerId: 1 }))`)
      assert.ok(dentro, 'a borda deveria ficar na beirada visível da linha do tempo')
      assert.equal(await duracao(), original, 'voltando, o clipe deveria ficar inteiro de novo')
      // Etiqueta do trecho escondido: um clique traz tudo de volta.
      await arrastarX(t, inicio, 100)
      assert.notEqual(await duracao(), original)
      await t.js("document.querySelector('main button[aria-label^=\"Restaurar o começo\"]').click()")
      await t.aguardar(`document.querySelector('[title="Duração do vídeo final"]').textContent === ${JSON.stringify(original)}`, 3000)
      // Zoom: aumenta a largura do clipe; "Ajustar" volta a caber tudo.
      const larg = () => t.js("return document.querySelector('main [aria-label^=\"Clipe 1\"]').getBoundingClientRect().width")
      const antes = await larg()
      await t.js("document.querySelector('main button[aria-label=\"Aumentar zoom\"]').click()")
      await t.esperar(150)
      assert.ok((await larg()) > antes * 1.4, 'o zoom deveria aumentar o clipe')
      await t.js("document.querySelector('main button[aria-label=\"Ajustar à largura\"]').click()")
      await t.esperar(150)
      assert.ok(Math.abs((await larg()) - antes) < 3, 'ajustar deveria voltar à largura inicial')
    },
  },
  {
    nome: 'video/editor: arrastando uma borda, o player mostra aquele quadro (e volta ao soltar)',
    pagina: '/video/editor',
    async executar(t) {
      await abrirNoEditor(t)
      const seg = (txt) => { const [m, s] = txt.trim().split(':'); return Number(m) * 60 + Number(s) }
      const relogio = () => t.js("return document.querySelector('main section[aria-label=Player] p.font-display span').textContent")
      const quadros = () => t.js('return new Promise((ok) => requestAnimationFrame(() => requestAnimationFrame(ok)))')
      await t.clicar('Texto')
      // Cursor em ~0:01 antes de arrastar.
      await t.js(`const r = document.querySelector('main [aria-label="Zoom da linha do tempo"]').closest('div.flex.flex-col').querySelector('.overflow-auto .sticky.top-0 > div:last-child'); const b = r.getBoundingClientRect()
        r.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, clientX: b.left + 1 + (b.width - 110) * 0.33, pointerId: 2 })); r.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, button: 0, pointerId: 2 }))`)
      await quadros()
      const antes = await relogio()
      // Arrasta o fim da camada de texto para a esquerda, sem soltar.
      await arrastarX(t, 'main [aria-label^="Camada Texto"] [aria-label="Fim da camada"]', -90, { soltar: false })
      await quadros()
      const ate = await t.js(`return [...document.querySelectorAll('main aside label')].find((x) => x.firstChild?.textContent?.trim() === 'Até').querySelector('input').value`)
      const durante = await relogio()
      assert.ok(Math.abs(seg(durante) - seg(ate)) <= 0.1, `o player deveria estar no fim da camada (${ate}), está em ${durante}`)
      await t.js("document.querySelector('main [aria-label^=\"Camada Texto\"] [aria-label=\"Fim da camada\"]').dispatchEvent(new PointerEvent('pointerup', { bubbles: true, button: 0, pointerId: 1 }))")
      await quadros()
      assert.equal(await relogio(), antes, 'ao soltar, o player volta para onde estava')
      // Fim do clipe: mostra o último quadro do trecho.
      await arrastarX(t, 'main [aria-label^="Clipe 1"] [aria-label="Aparar o fim"]', -80, { soltar: false })
      await quadros()
      const total = await t.js("return document.querySelector('[title=\"Duração do vídeo final\"]').textContent.replace('/', '')")
      const noFim = await relogio()
      assert.ok(Math.abs(seg(noFim) - seg(total)) <= 0.1, `o player deveria estar no fim do clipe (${total}), está em ${noFim}`)
      await t.js("document.querySelector('main [aria-label^=\"Clipe 1\"] [aria-label=\"Aparar o fim\"]').dispatchEvent(new PointerEvent('pointerup', { bubbles: true, button: 0, pointerId: 1 }))")
      await quadros()
      assert.equal(await relogio(), antes)
    },
  },
  {
    nome: 'video/editor: Q/W, quadro a quadro, congelar quadro e salvar quadro (PNG)',
    pagina: '/video/editor',
    async executar(t) {
      await abrirNoEditor(t)
      const seg = (txt) => { const [m, s] = txt.replace('/', '').trim().split(':'); return Number(m) * 60 + Number(s) }
      const total = async () => seg(await t.js("return document.querySelector('[title=\"Duração do vídeo final\"]').textContent"))
      const relogio = async () => seg(await t.js("return document.querySelector('main section[aria-label=Player] p.font-display span').textContent"))
      const tecla = (key, extra = '') => t.js(`dispatchEvent(new KeyboardEvent('keydown', { key: ${JSON.stringify(key)}, bubbles: true${extra} }))`)
      const irPara = (fracao) => t.js(`const r = document.querySelector('main [aria-label="Zoom da linha do tempo"]').closest('div.flex.flex-col').querySelector('.overflow-auto .sticky.top-0 > div:last-child'); const b = r.getBoundingClientRect()
        const clipe = document.querySelector('main [aria-label^="Clipe 1"]').getBoundingClientRect()
        r.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, clientX: clipe.left + clipe.width * ${fracao}, pointerId: 3 })); r.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, button: 0, pointerId: 3 }))`)
      const original = await total()
      await irPara(0.4)
      const cursor = await relogio()
      // W: corta do cursor até o fim do clipe.
      await tecla('w')
      await t.esperar(200)
      assert.ok(Math.abs((await total()) - cursor) < 0.15, `W deveria deixar ${cursor}s, ficou ${await total()}s`)
      await tecla('z', ', ctrlKey: true')
      await t.esperar(200)
      assert.equal(await total(), original, 'Ctrl+Z desfaz o corte')
      // Quadro a quadro.
      await irPara(0.4)
      const t0 = await relogio()
      for (let i = 0; i < 3; i += 1) await tecla('.')
      await t.esperar(150)
      assert.ok(Math.abs((await relogio()) - t0 - 0.1) < 0.06, 'três quadros ≈ 0,1 s')
      // Congelar quadro: o clipe se divide e entra uma imagem de 2 s.
      await t.js("document.querySelector('main [aria-label^=\"Clipe 1\"]').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, pointerId: 4 })); document.querySelector('main [aria-label^=\"Clipe 1\"]').dispatchEvent(new PointerEvent('pointerup', { bubbles: true, button: 0, pointerId: 4 }))")
      await irPara(0.4)
      await aba(t, 'Clipe')
      await t.clicar('Congelar quadro')
      await t.aguardar("document.querySelectorAll('main [aria-label^=\"Clipe \"]').length === 3", 10000)
      assert.ok(Math.abs((await total()) - original - 2) < 0.15, 'congelar soma 2 s')
      assert.ok(await t.js("return document.querySelector('main [aria-label^=\"Clipe 2\"]').getAttribute('aria-label').includes('quadro-')"), 'o clipe do meio é a imagem congelada')
      // Salvar quadro (PNG): intercepta o download.
      await t.js(`window.__baixado = null; const orig = HTMLAnchorElement.prototype.click
        HTMLAnchorElement.prototype.click = function () { if (this.download) { window.__baixado = { nome: this.download, href: this.href }; return } return orig.call(this) }`)
      await t.js("document.querySelector('main button[aria-label=\"Salvar este quadro (PNG)\"]').click()")
      await t.aguardar('window.__baixado', 60000)
      const png = await t.js(`const b = await (await fetch(window.__baixado.href)).blob(); const bmp = await createImageBitmap(b); return { nome: window.__baixado.nome, tipo: b.type, w: bmp.width, h: bmp.height }`)
      assert.ok(png.nome.endsWith('.png'), png.nome)
      assert.deepEqual([png.tipo, png.w, png.h], ['image/png', 640, 360])
    },
  },
  {
    nome: 'video/editor: filtros prontos, sépia e vinheta (prévia e exportação)',
    pagina: '/video/editor',
    async executar(t) {
      await abrirNoEditor(t)
      await t.js("[...document.querySelectorAll('main aside [role=radiogroup][aria-label=Filtros] [role=radio]')].find((b) => b.textContent.trim() === 'P&B').click()")
      await t.aguardar("[...document.querySelectorAll('main aside [aria-label=Filtros] [role=radio]')].find((b) => b.textContent.trim() === 'P&B').getAttribute('aria-checked') === 'true'", 3000)
      await t.js("__t.digitar('Sépia', '100')")
      await t.js("__t.digitar('Vinheta', '60')")
      // Prévia: matriz de cor (SVG) no vídeo e a vinheta por cima.
      await t.aguardar("[...document.querySelectorAll('main video')].some((v) => v.style.filter.includes('url(')) && [...document.querySelectorAll('main img')].some((i) => i.src.startsWith('blob:') && i.className.includes('inset-0 size-full'))", 5000)
      await exportarVideo(t)
      await t.aguardarResultado(300000)
      const px = await t.js(`const a = document.querySelector('section[aria-label=Resultado] a[download]')
        const v = document.createElement('video'); v.muted = true; v.src = a.href
        await new Promise((ok) => (v.onloadeddata = ok)); v.currentTime = 1; await new Promise((ok) => (v.onseeked = ok))
        const c = document.createElement('canvas'); c.width = 64; c.height = 36; const x = c.getContext('2d'); x.drawImage(v, 0, 0, 64, 36)
        return [...x.getImageData(32, 18, 1, 1).data]`)
      assert.ok(px[0] > px[1] && px[1] > px[2] && px[0] - px[2] > 12, `deveria sair em sépia (R > G > B): ${px}`)
    },
  },
  {
    nome: 'video/editor: animações de entrada e saída nas camadas',
    pagina: '/video/editor',
    async executar(t) {
      await abrirNoEditor(t)
      await t.clicar('Texto')
      const escolher = (rotulo, valor) => t.js(`const s = document.querySelector('main aside select[aria-label="${rotulo}"]'); Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(s, '${valor}'); s.dispatchEvent(new Event('change', { bubbles: true }))`)
      await t.aguardar("document.querySelector('main aside select[aria-label=\"Animação de entrada\"]')", 5000)
      await escolher('Animação de entrada', 'baixo')
      await escolher('Animação de saída', 'zoom')
      // No começo da animação, a camada está deslocada para baixo e quase transparente.
      await t.js("dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }))")
      for (let i = 0; i < 3; i += 1) await t.js("dispatchEvent(new KeyboardEvent('keydown', { key: '.', bubbles: true }))")
      await t.esperar(200)
      const estilo = await t.js("const el = document.querySelector('main [aria-label=\"Camada: texto\"]'); return { translate: el.style.translate, opacity: Number(el.style.opacity) }")
      assert.ok(/px/.test(estilo.translate) && !estilo.translate.startsWith('0px 0px'), `deveria estar deslocada: ${estilo.translate}`)
      assert.ok(estilo.opacity < 0.5, `deveria estar quase transparente: ${estilo.opacity}`)
      // Exporta (deslize na posição e zoom com escala quadro a quadro).
      await exportarVideo(t)
      await t.aguardarResultado(300000)
      const m = await t.js('return await __t.midia()')
      assert.deepEqual([m.largura, m.altura], [640, 360])
      perto(m.duracao, 3, 0.5, 'duração')
    },
  },
  {
    nome: 'video/editor: cores do quadro saem na exportação (P&B)',
    pagina: '/video/editor',
    async executar(t) {
      await abrirNoEditor(t)
      await t.js("__t.digitar('Saturação', '0')")
      await t.js("__t.digitar('Contraste', '120')")
      await t.js("__t.digitar('Brilho', '10')")
      await exportarVideo(t)
      await t.aguardarResultado(300000)
      // Um quadro do resultado: em preto e branco, R = G = B.
      const px = await t.js(`const a = document.querySelector('section[aria-label=Resultado] a[download]')
        const v = document.createElement('video'); v.muted = true; v.src = a.href
        await new Promise((ok) => (v.onloadeddata = ok)); v.currentTime = 1; await new Promise((ok) => (v.onseeked = ok))
        const c = document.createElement('canvas'); c.width = 64; c.height = 36; const x = c.getContext('2d'); x.drawImage(v, 0, 0, 64, 36)
        return [...x.getImageData(10, 10, 1, 1).data]`)
      assert.ok(Math.abs(px[0] - px[1]) <= 6 && Math.abs(px[1] - px[2]) <= 6, `o quadro deveria ser cinza: ${px}`)
    },
  },
  {
    nome: 'video/editor: recupera a edição ao voltar para a página',
    pagina: '/video/editor',
    async executar(t) {
      await abrirNoEditor(t)
      await t.clicar('Texto')
      // Espera o rascunho (com o texto) chegar ao IndexedDB antes de sair.
      const salvou = await t.js(`for (let i = 0; i < 50; i += 1) {
          const p = await new Promise((ok) => { const r = indexedDB.open('hipotetic', 1); r.onsuccess = () => { try { const g = r.result.transaction('rascunhos').objectStore('rascunhos').get('video:projeto'); g.onsuccess = () => { ok(g.result?.p); r.result.close() }; g.onerror = () => ok(null) } catch { ok(null) } }; r.onerror = () => ok(null) })
          if (p?.camadas?.some((c) => c.tipo === 'texto')) return true
          await new Promise((ok) => setTimeout(ok, 200))
        }
        return false`)
      assert.ok(salvou, 'o rascunho não foi salvo')
      await t.navegar('/video/editor')
      await t.aguardar("document.querySelectorAll('main [aria-label^=\"Clipe \"]').length === 1 && document.querySelector('main').innerText.includes('Recuperamos a edição')", 30000)
      assert.ok(await t.js("return Boolean(document.querySelector('main [aria-label^=\"Camada Texto\"][role=button]'))"), 'o texto deveria ter voltado')
      await t.clicar('Começar do zero')
      await t.aguardar("document.querySelector('main').innerText.includes('Nenhum vídeo aberto')", 5000)
    },
  },
  {
    nome: 'converter: trecho de vídeo vira GIF animado',
    pagina: '/converter',
    async executar(t) {
      await enviar(t, `[${usar('mp4')}]`)
      await formato(t, 'GIF')
      await ajustes(t)
      await t.js(`__t.digitar('Fim', '0:02')`)
      await t.clicar('Converter')
      await t.aguardarResultado(240000)
      const [r] = await t.js('return await __t.resultados()')
      assert.equal(r.tipo, 'gif')
      assert.equal(r.largura, 480)
      await guardar(t, 'gif')
    },
  },
  {
    nome: 'converter: GIF vira MP4',
    pagina: '/converter',
    async executar(t) {
      await enviar(t, `[${usar('gif')}]`)
      await formato(t, 'MP4')
      await t.clicar('Converter')
      await t.aguardarResultado(240000)
      const [r] = await t.js('return await __t.resultados()')
      assert.equal(r.tipo, 'mp4')
      perto((await t.js('return await __t.midia()')).duracao, 2, 0.4, 'duração')
    },
  },
  {
    nome: 'video/juntar-dividir: juntar soma as durações',
    pagina: '/video/juntar-dividir',
    async executar(t) {
      await enviar(t, `[${usar('mp4')}, __t.arquivo(await __t.gravarVideo(2, 320, 240), 'b.webm')]`)
      await t.clicar('Juntar vídeos')
      await t.aguardarResultado(420000)
      const m = await t.js('return await __t.midia()')
      perto(m.duracao, 5, 0.8, 'duração total')
      assert.deepEqual([m.largura, m.altura], [640, 360], 'tamanho do primeiro')
    },
  },
  {
    nome: 'video/juntar-dividir: dividir em 2 partes sem recodificar',
    pagina: '/video/juntar-dividir',
    async executar(t) {
      await t.clicar('Dividir')
      await enviar(t, `[${usar('mp4')}]`)
      await t.clicar('Dividir vídeo')
      await t.aguardarResultado(240000)
      const rs = await t.js('return await __t.resultados()')
      assert.ok(rs.length >= 2, `${rs.length} parte(s)`)
      assert.ok(rs.every((r) => r.tipo === 'mp4'))
    },
  },

  // ─── Áudio ────────────────────────────────────────────────────────────────
  {
    nome: 'converter: WAV para MP3',
    pagina: '/converter',
    async executar(t) {
      await enviar(t, `[__t.arquivo(__t.wav([{ s: 2, hz: 440 }]), 'tom.wav')]`)
      await formato(t, 'MP3')
      await t.clicar('Converter')
      await t.aguardarResultado(120000)
      const [r] = await t.js('return await __t.resultados()')
      assert.equal(r.tipo, 'mp3')
      perto((await t.js('return await __t.midia()')).duracao, 2, 0.15, 'duração')
      await guardar(t, 'mp3')
    },
  },
  {
    nome: 'converter: vídeo para MP3 (extrai o som)',
    pagina: '/converter',
    async executar(t) {
      await enviar(t, `[${usar('mp4')}]`)
      await formato(t, 'MP3')
      await t.clicar('Converter')
      await t.aguardarResultado(120000)
      const [r] = await t.js('return await __t.resultados()')
      assert.equal(r.tipo, 'mp3')
      perto((await t.js('return await __t.midia()')).duracao, 3, 0.6, 'duração')
    },
  },
  {
    nome: 'audio/editor: remover silêncio deixa 1 s de som',
    pagina: '/audio/editor',
    async executar(t) {
      await abrirEditorAudio(t, `__t.arquivo(__t.wav([{ s: 1.5, hz: 0 }, { s: 1, hz: 440 }, { s: 1.5, hz: 0 }]), 'fala.wav')`, '0:04.0')
      await t.js(`[...document.querySelectorAll('main label')].find((l) => l.textContent.trim().startsWith('Remover silêncio')).click()`)
      await t.clicar('Aplicar e baixar')
      await t.aguardarResultado(120000)
      perto((await t.js('return await __t.midia()')).duracao, 1, 0.25, 'duração sem silêncio')
    },
  },
  {
    nome: 'audio/editor: velocidade 2× mantendo o tom',
    pagina: '/audio/editor',
    async executar(t) {
      await abrirEditorAudio(t, `__t.arquivo(__t.wav([{ s: 4, hz: 440 }]), 'aula.wav')`, '0:04.0')
      await t.js("__t.digitar('Velocidade', '2')")
      await t.clicar('Aplicar e baixar')
      await t.aguardarResultado(120000)
      perto((await t.js('return await __t.midia()')).duracao, 2, 0.2, 'duração a 2×')
    },
  },
  {
    nome: 'audio/editor: velocidade 2× com o tom junto (arquivo 48 kHz)',
    pagina: '/audio/editor',
    async executar(t) {
      await abrirEditorAudio(t, `__t.arquivo(__t.wav([{ s: 4, hz: 440 }], 48000), 'tom48.wav')`, '0:04.0')
      await t.js("__t.digitar('Velocidade', '2')")
      await t.js("[...document.querySelectorAll('main label')].find((l) => l.textContent.trim() === 'Mudar tom').click()")
      await t.clicar('Aplicar e baixar')
      await t.aguardarResultado(120000)
      perto((await t.js('return await __t.midia()')).duracao, 2, 0.2, 'duração a 2× com tom')
    },
  },
  {
    nome: 'audio/editor: normalizar o volume',
    pagina: '/audio/editor',
    async executar(t) {
      await abrirEditorAudio(t, `__t.arquivo(__t.wav([{ s: 2, hz: 440 }]), 'baixo.wav')`, '0:02.0')
      await t.clicar('Normalizar')
      await t.clicar('Aplicar e baixar')
      await t.aguardarResultado(120000)
      perto((await t.js('return await __t.midia()')).duracao, 2, 0.2, 'duração')
    },
  },
  {
    nome: 'audio/juntar: 2 + 1 s com 1 s de pausa = 4 s',
    pagina: '/audio/juntar-dividir',
    async executar(t) {
      await enviar(t, `[__t.arquivo(__t.wav([{ s: 2, hz: 440 }]), 'a.wav'), __t.arquivo(__t.wav([{ s: 1, hz: 660 }]), 'b.wav')]`)
      await t.js(`__t.digitar('Entre as faixas', 'pausa1')`)
      await t.clicar('Juntar áudios')
      await t.aguardarResultado(120000)
      perto((await t.js('return await __t.midia()')).duracao, 4, 0.2, 'duração total')
    },
  },
  {
    nome: 'audio/editor: player próprio, prévia ao vivo, loop e desfazer',
    pagina: '/audio/editor',
    async executar(t) {
      await abrirEditorAudio(t, `__t.arquivo(__t.wav([{ s: 1, hz: 0 }, { s: 2, hz: 440 }, { s: 1, hz: 0 }]), 'voz.wav')`, '0:04.0')
      await t.aguardar("document.querySelector('main canvas')", 10000)
      assert.equal(await t.js("return document.querySelector('main audio').controls"), false, 'não deveria usar o player do navegador')
      const duracaoNoPlayer = () => t.js("return document.querySelector('main section[aria-label=Player] [title=\"Duração do áudio final\"]').textContent.replace('/', '').trim()")
      // "Mudar tom" só aparece com a velocidade alterada.
      assert.equal(await t.js("return [...document.querySelectorAll('main label')].some((l) => l.textContent.trim() === 'Mudar tom')"), false)
      // Velocidade livre (digitada): vai para o player e muda a duração mostrada.
      await t.js("__t.digitar('Velocidade', '1,5')")
      assert.deepEqual(await t.js("const a = document.querySelector('main audio'); return [a.playbackRate, a.preservesPitch]"), [1.5, true])
      assert.equal(await duracaoNoPlayer(), '0:02.7', '4 s a 1,5× = 2,7 s')
      await t.js("[...document.querySelectorAll('main label')].find((l) => l.textContent.trim() === 'Mudar tom').click()")
      assert.equal(await t.js("return document.querySelector('main audio').preservesPitch"), false)
      // Silêncio: some 1 s de cada ponta → 2 s a 1,5× = 1,3 s.
      await t.esperar(450)
      await t.js("[...document.querySelectorAll('main label')].find((l) => l.textContent.startsWith('Remover silêncio')).click()")
      await t.aguardar("document.querySelector('main').innerText.includes('de silêncio a menos')", 5000)
      assert.equal(await duracaoNoPlayer(), '0:01.3')
      // Repetir: o trecho final tem 1,3 s; depois de 2,2 s ainda está tocando (voltou ao início).
      await t.js("document.querySelector('main button[aria-label=\"Repetir o trecho\"]').click()")
      await t.js("document.querySelector('main button[aria-label=Tocar]').click()")
      await t.esperar(2200)
      const tocando = await t.js("const a = document.querySelector('main audio'); return [a.paused, a.currentTime]")
      assert.equal(tocando[0], false, 'com repetir ligado deveria continuar tocando')
      assert.ok(tocando[1] >= 1 && tocando[1] <= 3, `deveria estar dentro do trecho com som (tempo ${tocando[1]})`)
      await t.js("document.querySelector('main button[aria-label=Pausar]').click()")
      await t.esperar(100)
      assert.equal(await t.js("return document.querySelector('main audio').paused"), true)
      // Ctrl+Z desfaz a remoção de silêncio; Ctrl+Shift+Z refaz.
      await t.esperar(450)
      const tecla = (shift) => t.js(`document.body.dispatchEvent(new KeyboardEvent('keydown', { key: ${shift ? "'Z'" : "'z'"}, ctrlKey: true, shiftKey: ${shift}, bubbles: true }))`)
      await tecla(false)
      await t.aguardar(`!document.querySelector('main').innerText.includes('de silêncio a menos')`, 3000)
      assert.equal(await duracaoNoPlayer(), '0:02.7')
      await tecla(true)
      await t.aguardar(`document.querySelector('main').innerText.includes('de silêncio a menos')`, 3000)
      // Redefinir tudo: volta ao original.
      await t.clicar('Redefinir tudo')
      await t.aguardar("document.querySelector('main audio').playbackRate === 1", 3000)
      assert.equal(await duracaoNoPlayer(), '0:04.0')
    },
  },
  {
    nome: 'audio/editor: aparece antes do arquivo e junta vários áudios',
    pagina: '/audio/editor',
    async executar(t) {
      // Antes de escolher: o editor (player e ajustes) já está na tela.
      assert.ok(await t.js("return Boolean(document.querySelector('main section[aria-label=Player] button[aria-label=Tocar]') && document.querySelector('main section[aria-label=Ajustes]'))"), 'o editor deveria aparecer vazio')
      await t.js(`__t.enviar([__t.arquivo(__t.wav([{ s: 2, hz: 440 }]), 'parte 2.wav'), __t.arquivo(__t.wav([{ s: 1, hz: 660 }]), 'parte 1.wav')])`)
      await t.aguardar("document.querySelector('main canvas') && document.querySelector('main').innerText.includes('2 áudios em sequência')", 20000)
      // Ordem natural pelo nome: "parte 1" primeiro.
      assert.equal(await t.js("return document.querySelector('main ol[aria-label=\"Ordem dos áudios\"] li').textContent.includes('parte 1.wav')"), true)
      await t.aguardar("document.querySelector('[title=\"Duração do áudio final\"]').textContent.includes('0:03.0')", 5000)
      await t.clicar('Aplicar e baixar')
      await t.aguardarResultado(120000)
      perto((await t.js('return await __t.midia()')).duracao, 3, 0.15, 'duração dos dois juntos')
    },
  },
  {
    nome: 'audio/editor: cortar trecho com fade',
    pagina: '/audio/editor',
    async executar(t) {
      await t.js(`__t.enviar([__t.arquivo(__t.wav([{ s: 5, hz: 440 }]), 'musica.wav')])`)
      await t.aguardar('document.querySelector("main audio") && document.querySelector("main").innerText.includes("0:05.0")', 20000)
      await t.js(`const a = document.querySelector('main audio'); a.currentTime = 1; await new Promise((ok) => a.addEventListener('timeupdate', ok, { once: true }))`)
      await t.clicar('Início aqui')
      await t.js(`const a = document.querySelector('main audio'); a.currentTime = 3; await new Promise((ok) => a.addEventListener('timeupdate', ok, { once: true }))`)
      await t.clicar('Fim aqui')
      await t.clicar('Aplicar e baixar')
      await t.aguardarResultado(120000)
      perto((await t.js('return await __t.midia()')).duracao, 2, 0.2, 'duração do trecho')
    },
  },
  {
    nome: 'audio/editor: recupera a edição ao voltar para a página',
    pagina: '/audio/editor',
    async executar(t) {
      await abrirEditorAudio(t, `__t.arquivo(__t.wav([{ s: 4, hz: 440 }]), 'aula.wav')`, '0:04.0')
      await t.js("__t.digitar('Velocidade', '2')")
      await t.esperar(1200)
      await t.navegar('/audio/editor')
      await t.aguardar("document.querySelector('main canvas') && document.querySelector('main').innerText.includes('Recuperamos a edição')", 30000)
      await t.aguardar("document.querySelector('[title=\"Duração do áudio final\"]')?.textContent.includes('0:02.0')", 10000)
      assert.equal(await t.js("return document.querySelector('main audio').playbackRate"), 2)
    },
  },
  // ─── Áudio: ferramentas novas ─────────────────────────────────────────────
  {
    nome: 'audio/gravador: grava do microfone, pausa e salva em MP3',
    pagina: '/audio/gravador',
    async executar(t) {
      await t.js("window.__baixados = []; const __orig = URL.createObjectURL.bind(URL); URL.createObjectURL = (b) => { if (b instanceof Blob) window.__baixados.push(b); return __orig(b) }")
      await t.js("document.querySelector('main button[aria-label=Gravar]').click()")
      await t.aguardar("document.querySelector('main button[aria-label=Parar]')", 10000)
      await t.esperar(1000)
      await t.js("document.querySelector('main button[aria-label=Pausar]').click()")
      await t.esperar(700)
      await t.js("document.querySelector('main button[aria-label=Continuar]').click()")
      await t.esperar(800)
      await t.js("document.querySelector('main button[aria-label=Parar]').click()")
      await t.aguardar("document.querySelector('main section[aria-label=Gravações]')", 10000)
      await t.clicar('Baixar MP3')
      await t.aguardar("window.__baixados.some((b) => b.type === 'audio/mpeg')", 60000)
      const r = await t.js(`const b = window.__baixados.find((x) => x.type === 'audio/mpeg'); const u = new Uint8Array(await b.slice(0, 3).arrayBuffer())
        const a = new Audio(URL.createObjectURL(b)); await new Promise((ok) => (a.onloadedmetadata = ok)); return [String.fromCharCode(...u), a.duration]`)
      assert.ok(r[0] === 'ID3' || r[0].charCodeAt(0) === 0xff, 'deveria ser MP3')
      perto(r[1], 1.8, 0.5, 'duração sem a pausa')
      // "Editar" leva a gravação para o editor de áudio.
      await t.clicar('Editar')
      await t.aguardar("location.pathname === '/audio/editor' && document.querySelector('main canvas')", 20000)
    },
  },
  {
    nome: 'audio/melhorar-voz: prévia antes/depois e áudio limpo em MP3',
    pagina: '/audio/melhorar-voz',
    async executar(t) {
      await t.js(`__t.enviar(${`[__t.arquivo(__t.wav([{ s: 3, hz: 330 }]), 'fala.wav')]`})`)
      await t.clicar('Gerar prévia')
      await t.aguardar("[...document.querySelectorAll('main [role=radio]')].some((b) => b.textContent.trim() === 'Antes')", 60000)
      await escolher(t, 'mp3')
      await t.clicar('Limpar e baixar')
      await t.aguardarResultado(120000)
      const [r] = await t.js('return await __t.resultados()')
      assert.equal(r.tipo, 'mp3')
      assert.equal(r.nome, 'fala-voz-limpa.mp3')
      perto((await t.js('return await __t.midia()')).duracao, 3, 0.2, 'duração')
    },
  },
  {
    nome: 'audio/melhorar-voz: vídeo mantém a imagem e limpa o som',
    pagina: '/audio/melhorar-voz',
    async executar(t) {
      await t.js(`__t.enviar(${`[${usar('mp4')}]`})`)
      await t.clicar('Limpar e baixar')
      await t.aguardarResultado(180000)
      const [r] = await t.js('return await __t.resultados()')
      assert.equal(r.tipo, 'mp4')
      assert.ok(r.nome.endsWith('-voz-limpa.mp4'), r.nome)
      const m = await t.js('return await __t.midia()')
      assert.deepEqual([m.largura, m.altura], [640, 360])
      assert.ok(temTrilhaDeAudio(await bytes(t)), 'deveria ter áudio')
    },
  },
  {
    nome: 'audio/tags: grava título, artista e capa no MP3 e lê de volta',
    pagina: '/audio/tags',
    async executar(t) {
      await t.js(`__t.enviar(${`[${usar('mp3')}]`})`)
      await t.aguardar("[...document.querySelectorAll('main label')].some((l) => l.textContent.trim() === 'Título')", 60000)
      await t.js("__t.digitar('Título', 'Faixa de teste')")
      await t.js("__t.digitar('Artista', 'Banda X')")
      await t.js("__t.digitar('Ano', '2024')")
      await t.js(`__t.enviar([__t.arquivo(await __t.imagem(300, 300), 'capa.png')], 'main input[aria-label="Imagem da capa"]')`)
      await t.aguardar("document.querySelector('main img[alt=Capa]')?.naturalWidth > 0", 10000)
      await t.clicar('Salvar e baixar')
      await t.aguardarResultado(60000)
      const b = Buffer.from(await bytes(t))
      assert.equal(b.subarray(0, 3).toString(), 'ID3')
      assert.ok(b.includes('Faixa de teste') && b.includes('Banda X') && b.includes('APIC'), 'tags ou capa ausentes')
      // Abre o resultado de novo: os campos e a capa voltam preenchidos.
      const b64 = b.toString('base64')
      await t.clicar('Outro arquivo')
      await t.js(`__t.enviar(${`[new File([Uint8Array.from(atob('${b64}'), (c) => c.charCodeAt(0))], 'com-tags.mp3', { type: 'audio/mpeg' })]`})`)
      await t.aguardar("[...document.querySelectorAll('main input')].some((i) => i.value === 'Faixa de teste')", 60000)
      await t.aguardar("document.querySelector('main img[alt=Capa]')?.naturalWidth === 300", 10000)
    },
  },
  {
    nome: 'audio/juntar-dividir: dividir nas pausas gera 3 partes',
    pagina: '/audio/juntar-dividir',
    async executar(t) {
      await t.clicar('Dividir')
      await enviar(t, `[__t.arquivo(__t.wav([{ s: 1, hz: 440 }, { s: 2, hz: 0 }, { s: 1, hz: 550 }, { s: 2, hz: 0 }, { s: 1, hz: 660 }]), 'tres-faixas.wav')]`)
      await t.clicar('Dividir áudio')
      await t.aguardarResultado(60000)
      const rs = await t.js('return await __t.resultados()')
      assert.deepEqual(rs.map((r) => r.nome), ['tres-faixas-parte-01.wav', 'tres-faixas-parte-02.wav', 'tres-faixas-parte-03.wav'])
    },
  },
]
