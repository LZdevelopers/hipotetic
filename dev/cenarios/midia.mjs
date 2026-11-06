import assert from 'node:assert/strict'
import { enviar } from './comum.mjs'

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
/** Editor de vídeo: um arquivo só, vai direto para a edição (sem lista). */
async function abrirNoEditor(t) {
  await t.js(`__t.enviar([${usar('mp4')}])`)
  await t.aguardar('document.querySelector(\'input[aria-label="Início (minutos:segundos)"]\')', 20000)
}

export default [
  // ─── Vídeo ────────────────────────────────────────────────────────────────
  {
    nome: 'video/webm-para-mp4: gravação WebM vira MP4 (H.264)',
    pagina: '/video/webm-para-mp4',
    async executar(t) {
      await enviar(t, `[__t.arquivo(await __t.gravarVideo(3), 'gravacao.webm')]`)
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
    nome: 'video/converter: MP4 → WebM em 360p',
    pagina: '/video/converter',
    async executar(t) {
      await enviar(t, `[${usar('mp4')}]`)
      await t.clicar('WebM')
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
    nome: 'video/cortar: trecho de 1 s a 2,5 s',
    pagina: '/video/cortar',
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
    nome: 'video/mudar-proporcao: 16:9 → vertical 9:16',
    pagina: '/video/mudar-proporcao',
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
    nome: 'video/velocidade: 2× pelo ffmpeg (metade da duração)',
    pagina: '/video/velocidade',
    async executar(t) {
      await abrirNoEditor(t)
      await t.clicar('Exportar vídeo')
      await t.aguardarResultado(300000)
      perto((await t.js('return await __t.midia()')).duracao, 1.5, 0.35, 'duração a 2×')
    },
  },
  {
    nome: 'video/para-gif: trecho vira GIF animado',
    pagina: '/video/para-gif',
    async executar(t) {
      await enviar(t, `[${usar('mp4')}]`)
      await t.js(`__t.digitar('Fim', '0:02')`)
      await t.clicar('Criar GIF')
      await t.aguardarResultado(240000)
      const [r] = await t.js('return await __t.resultados()')
      assert.equal(r.tipo, 'gif')
      assert.equal(r.largura, 480)
      await guardar(t, 'gif')
    },
  },
  {
    nome: 'video/gif-para-mp4: GIF vira MP4',
    pagina: '/video/gif-para-mp4',
    async executar(t) {
      await enviar(t, `[${usar('gif')}]`)
      await t.clicar('Converter')
      await t.aguardarResultado(240000)
      const [r] = await t.js('return await __t.resultados()')
      assert.equal(r.tipo, 'mp4')
      perto((await t.js('return await __t.midia()')).duracao, 2, 0.4, 'duração')
    },
  },
  {
    nome: 'video/unir: dois vídeos somam as durações',
    pagina: '/video/unir',
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
    nome: 'video/dividir: em 2 partes sem recodificar',
    pagina: '/video/dividir',
    async executar(t) {
      await enviar(t, `[${usar('mp4')}]`)
      await t.clicar('Dividir vídeo')
      await t.aguardarResultado(240000)
      const rs = await t.js('return await __t.resultados()')
      assert.ok(rs.length >= 2, `${rs.length} parte(s)`)
      assert.ok(rs.every((r) => r.tipo === 'mp4'))
    },
  },
  {
    nome: 'video/adicionar-audio: troca o som do vídeo',
    pagina: '/video/adicionar-audio',
    async executar(t) {
      await t.js(`const inputs = document.querySelectorAll('main input[type=file]')
        const pares = [[inputs[0], ${usar('mp4')}], [inputs[1], __t.arquivo(__t.wav([{ s: 2, hz: 660 }]), 'musica.wav')]]
        for (const [input, arquivo] of pares) { const dt = new DataTransfer(); dt.items.add(arquivo); input.files = dt.files; input.dispatchEvent(new Event('change', { bubbles: true })) }`)
      await t.clicar('Adicionar áudio')
      await t.aguardarResultado(240000)
      const b = await bytes(t)
      assert.ok(temTrilhaDeAudio(b), 'sem trilha de áudio')
      perto((await t.js('return await __t.midia()')).duracao, 3, 0.6, 'duração do vídeo mantida')
    },
  },

  // ─── Áudio ────────────────────────────────────────────────────────────────
  {
    nome: 'audio/wav-para-mp3: 2 s de tom',
    pagina: '/audio/wav-para-mp3',
    async executar(t) {
      await enviar(t, `[__t.arquivo(__t.wav([{ s: 2, hz: 440 }]), 'tom.wav')]`)
      await t.clicar('Converter')
      await t.aguardarResultado(120000)
      const [r] = await t.js('return await __t.resultados()')
      assert.equal(r.tipo, 'mp3')
      perto((await t.js('return await __t.midia()')).duracao, 2, 0.15, 'duração')
    },
  },
  {
    nome: 'audio/extrair-de-video: MP4 → MP3 e cópia exata (M4A)',
    pagina: '/audio/extrair-de-video',
    async executar(t) {
      await enviar(t, `[${usar('mp4')}]`)
      await t.clicar('Extrair áudio')
      await t.aguardarResultado(120000)
      assert.equal((await t.js('return await __t.resultados()'))[0].tipo, 'mp3')
      await t.clicar('Ajustar e refazer')
      await t.js(`__t.digitar('Formato de saída', 'original')`)
      await t.clicar('Extrair áudio')
      await t.aguardarResultado(120000)
      const [r] = await t.js('return await __t.resultados()')
      assert.ok(/\.(m4a|opus|ogg)$/.test(r.nome), r.nome)
    },
  },
  {
    nome: 'audio/remover-silencio: 1 s de som entre silêncios',
    pagina: '/audio/remover-silencio',
    async executar(t) {
      await enviar(t, `[__t.arquivo(__t.wav([{ s: 1.5, hz: 0 }, { s: 1, hz: 440 }, { s: 1.5, hz: 0 }]), 'fala.wav')]`)
      await t.clicar('Remover silêncio')
      await t.aguardarResultado(120000)
      perto((await t.js('return await __t.midia()')).duracao, 1, 0.25, 'duração sem silêncio')
    },
  },
  {
    nome: 'audio/velocidade: 2× mantendo o tom',
    pagina: '/audio/velocidade',
    async executar(t) {
      await enviar(t, `[__t.arquivo(__t.wav([{ s: 4, hz: 440 }]), 'aula.wav')]`)
      await t.js(`__t.digitar('Velocidade', '2')`)
      await t.clicar('Mudar velocidade')
      await t.aguardarResultado(120000)
      perto((await t.js('return await __t.midia()')).duracao, 2, 0.2, 'duração a 2×')
    },
  },
  {
    nome: 'audio/volume: normalizar gera áudio válido',
    pagina: '/audio/volume',
    async executar(t) {
      await enviar(t, `[__t.arquivo(__t.wav([{ s: 2, hz: 440 }]), 'baixo.wav')]`)
      await t.clicar('Normalizar')
      await t.clicar('Ajustar volume')
      await t.aguardarResultado(120000)
      perto((await t.js('return await __t.midia()')).duracao, 2, 0.2, 'duração')
    },
  },
  {
    nome: 'audio/unir: 2 + 1 s com 1 s de pausa = 4 s',
    pagina: '/audio/unir',
    async executar(t) {
      await enviar(t, `[__t.arquivo(__t.wav([{ s: 2, hz: 440 }]), 'a.wav'), __t.arquivo(__t.wav([{ s: 1, hz: 660 }]), 'b.wav')]`)
      await t.js(`__t.digitar('Entre as faixas', 'pausa1')`)
      await t.clicar('Juntar áudios')
      await t.aguardarResultado(120000)
      perto((await t.js('return await __t.midia()')).duracao, 4, 0.2, 'duração total')
    },
  },
  {
    nome: 'audio/cortar: trecho com fade',
    pagina: '/audio/cortar',
    async executar(t) {
      await t.js(`__t.enviar([__t.arquivo(__t.wav([{ s: 5, hz: 440 }]), 'musica.wav')])`)
      await t.aguardar('document.querySelector("main audio") && document.querySelector("main").innerText.includes("0:05.0")', 20000)
      await t.js(`const a = document.querySelector('main audio'); a.currentTime = 1; await new Promise((ok) => a.addEventListener('timeupdate', ok, { once: true }))`)
      await t.clicar('Início aqui')
      await t.js(`const a = document.querySelector('main audio'); a.currentTime = 3; await new Promise((ok) => a.addEventListener('timeupdate', ok, { once: true }))`)
      await t.clicar('Fim aqui')
      await t.clicar('Cortar')
      await t.aguardarResultado(120000)
      perto((await t.js('return await __t.midia()')).duracao, 2, 0.2, 'duração do trecho')
    },
  },
]
