/**
 * Processamento de mídia NO NAVEGADOR, com ffmpeg.wasm.
 *
 * Três operações, todas sem gastar CPU de servidor:
 *  - juntar: vídeo HD e áudio chegam separados do YouTube; `-c copy` só troca
 *    o "envelope" (sem recodificar), então é rápido mesmo em 1080p;
 *  - mp3: recodifica o áudio para MP3 192 kbps;
 *  - h264: recodifica o vídeo H.265 do TikTok para H.264, que abre em
 *    qualquer player — o passo mais pesado (~4x a duração do vídeo em 1080p).
 *
 * O núcleo do ffmpeg (~30 MB) vem do jsDelivr só na primeira vez que alguém
 * prepara um arquivo; o navegador guarda em cache. A biblioteca entra por
 * import() dinâmico para não pesar o carregamento inicial do site.
 */

const CORE = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/esm'

let carregando = null

async function obterFfmpeg() {
  carregando ??= (async () => {
    const [{ FFmpeg }, { toBlobURL }] = await Promise.all([import('@ffmpeg/ffmpeg'), import('@ffmpeg/util')])
    const ffmpeg = new FFmpeg()
    // Blob URLs: o worker do ffmpeg só importa scripts da própria origem.
    await ffmpeg.load({
      coreURL: await toBlobURL(`${CORE}/ffmpeg-core.js`, 'text/javascript'),
      wasmURL: await toBlobURL(`${CORE}/ffmpeg-core.wasm`, 'application/wasm'),
    })
    return ffmpeg
  })().catch((erro) => {
    carregando = null
    throw erro
  })
  return carregando
}

/** Baixa um arquivo inteiro na memória, informando o progresso (0 → 1). */
async function baixar(url, aoProgredir, signal) {
  const resposta = await fetch(url, { signal })
  if (!resposta.ok || !resposta.body) throw new Error('download')
  const total = Number(resposta.headers.get('content-length')) || 0
  const partes = []
  let recebido = 0
  for await (const parte of resposta.body) {
    partes.push(parte)
    recebido += parte.byteLength
    if (total) aoProgredir(recebido / total)
  }
  const dados = new Uint8Array(recebido)
  let pos = 0
  for (const parte of partes) {
    dados.set(parte, pos)
    pos += parte.byteLength
  }
  return dados
}

const MIME = { mp4: 'video/mp4', webm: 'video/webm', mp3: 'audio/mpeg' }

/**
 * Executa o `processo` de uma opção e devolve o arquivo pronto (Blob).
 * `aoProgredir({ etapa, valor })`: etapa 'baixando' ou 'convertendo', valor 0 → 1.
 */
export async function processar(processo, { extensao, titulo }, aoProgredir, signal) {
  const ffmpeg = obterFfmpeg() // começa a carregar enquanto os bytes chegam
  const entradas = processo.acao === 'juntar' ? [processo.video, processo.audio] : [processo.video ?? processo.audio]

  // Download das entradas em paralelo; o progresso é a média delas.
  const progresso = entradas.map(() => 0)
  const dados = await Promise.all(
    entradas.map((url, i) =>
      baixar(
        url,
        (valor) => {
          progresso[i] = valor
          aoProgredir({ etapa: 'baixando', valor: progresso.reduce((a, b) => a + b, 0) / progresso.length })
        },
        signal,
      ),
    ),
  )

  const ff = await ffmpeg
  const saida = `saida.${extensao}`
  const aoConverter = ({ progress }) => aoProgredir({ etapa: 'convertendo', valor: Math.min(Math.max(progress, 0), 1) })
  ff.on('progress', aoConverter)
  aoProgredir({ etapa: 'convertendo', valor: 0 })

  try {
    let args
    if (processo.acao === 'juntar') {
      const ext = extensao === 'mp4' ? ['mp4', 'm4a'] : ['webm', 'weba']
      await ff.writeFile(`video.${ext[0]}`, dados[0])
      await ff.writeFile(`audio.${ext[1]}`, dados[1])
      args = ['-i', `video.${ext[0]}`, '-i', `audio.${ext[1]}`, '-map', '0:v:0', '-map', '1:a:0', '-c', 'copy']
      if (extensao === 'mp4') args.push('-movflags', '+faststart')
    } else if (processo.acao === 'h264') {
      // H.265 → H.264: recodifica a imagem (pesado); o áudio só é copiado.
      // ultrafast: metade do tempo do superfast, ao custo de um arquivo ~2x maior.
      await ff.writeFile('video.in', dados[0])
      args = ['-i', 'video.in', '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '23', '-pix_fmt', 'yuv420p', '-c:a', 'copy', '-movflags', '+faststart']
    } else {
      await ff.writeFile('audio.in', dados[0])
      args = ['-i', 'audio.in', '-vn', '-c:a', 'libmp3lame', '-b:a', '192k', '-id3v2_version', '3', '-metadata', `title=${titulo}`]
    }
    const codigo = await ff.exec([...args, '-y', saida], -1, { signal })
    if (codigo !== 0) throw new Error('ffmpeg')
    const resultado = await ff.readFile(saida)
    return new Blob([resultado], { type: MIME[extensao] })
  } finally {
    ff.off('progress', aoConverter)
    // Libera a memória do wasm para o próximo arquivo.
    for (const nome of ['video.mp4', 'audio.m4a', 'video.webm', 'audio.weba', 'audio.in', 'video.in', saida]) {
      await ff.deleteFile(nome).catch(() => {})
    }
  }
}

/** Nome de arquivo seguro a partir do título. */
export function nomeArquivo(titulo, extensao) {
  const limpo = String(titulo ?? '')
    .replace(/[\\/:*?"<>|\u0000-\u001f]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120)
  return `${limpo || 'midia'}.${extensao}`
}
