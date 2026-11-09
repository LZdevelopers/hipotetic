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

/** Editor de vídeo: um arquivo só, vai direto para a edição (sem lista). */
async function abrirNoEditor(t) {
  await t.js(`__t.enviar([${usar('mp4')}])`)
  await t.aguardar('document.querySelector(\'input[aria-label="Início (minutos:segundos)"]\')', 20000)
}

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
    nome: 'video/editor: cortar trecho de 1 s a 2,5 s',
    pagina: '/video/editor',
    async executar(t) {
      await abrirNoEditor(t)
      await t.js(`for (const [rotulo, valor] of [['Início (minutos:segundos)', '0:01'], ['Fim (minutos:segundos)', '0:02.5']]) {
          const el = document.querySelector('input[aria-label="' + rotulo + '"]')
          Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, valor)
          el.dispatchEvent(new FocusEvent('focusout', { bubbles: true }))
        }`)
      await t.aguardar('document.querySelector("main").innerText.includes("0:01.0 → 0:02.5")')
      await t.clicar('Exportar vídeo')
      await t.aguardarResultado(240000)
      perto((await t.js('return await __t.midia()')).duracao, 1.5, 0.35, 'duração do trecho')
    },
  },
  {
    nome: 'video/editor: proporção 16:9 → vertical 9:16',
    pagina: '/video/editor',
    async executar(t) {
      await abrirNoEditor(t)
      await t.js(`[...document.querySelectorAll('main button')].find((b) => b.textContent.trim() === '9:16').click()`)
      await t.clicar('Exportar vídeo')
      await t.aguardarResultado(240000)
      const m = await t.js('return await __t.midia()')
      perto(m.largura / m.altura, 9 / 16, 0.02, 'proporção')
    },
  },
  {
    nome: 'video/editor: velocidade 2× pelo ffmpeg (metade da duração)',
    pagina: '/video/editor',
    async executar(t) {
      await abrirNoEditor(t)
      await t.js(`__t.digitar('Velocidade', '2')`)
      await t.clicar('Exportar vídeo')
      await t.aguardarResultado(300000)
      perto((await t.js('return await __t.midia()')).duracao, 1.5, 0.35, 'duração a 2×')
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
  {
    nome: 'video/editor: trocar o som por uma música',
    pagina: '/video/editor',
    async executar(t) {
      await abrirNoEditor(t)
      await escolher(t, 'trocar')
      await t.aguardar('document.querySelector("main aside input[type=file]")')
      await t.js(`__t.enviar([__t.arquivo(__t.wav([{ s: 2, hz: 660 }]), 'musica.wav')], 'main aside input[type=file]')`)
      await t.clicar('Exportar vídeo')
      await t.aguardarResultado(240000)
      const b = await bytes(t)
      assert.ok(temTrilhaDeAudio(b), 'sem trilha de áudio')
      perto((await t.js('return await __t.midia()')).duracao, 3, 0.6, 'duração do vídeo mantida')
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
    pagina: '/audio/juntar',
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
]
