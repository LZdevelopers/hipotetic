import { useEffect, useRef, useState } from 'react'
import { Icone } from '../../componentes/Icone'
import { Resultados } from '../../componentes/ferramenta/Resultados'
import { SeletorArquivos } from '../../componentes/ferramenta/SeletorArquivos'
import { Aviso, Botao, Entrada, Progresso } from '../../componentes/ui'
import { executarFfmpeg } from '../../motores/ffmpeg'
import { detectarTipo, extensaoDe, mimeDe } from '../../nucleo/arquivos'
import { ErroAmigavel } from '../../nucleo/tarefa'
import { useSalvo, useTarefaSalva } from '../../nucleo/salvo'
import { useUrlObjeto } from '../../nucleo/url'

const FORMATOS = ['mp3', 'm4a', 'flac', 'ogg', 'opus', 'wav']
const COM_CAPA = ['mp3', 'm4a', 'flac']

/** Campos editáveis → chave do ffmpeg (e apelidos com que ela pode aparecer). */
const CAMPOS = [
  { id: 'title', rotulo: 'Título', apelidos: ['title'] },
  { id: 'artist', rotulo: 'Artista', apelidos: ['artist'] },
  { id: 'album', rotulo: 'Álbum', apelidos: ['album'] },
  { id: 'album_artist', rotulo: 'Artista do álbum', apelidos: ['album_artist', 'albumartist', 'album artist'] },
  { id: 'date', rotulo: 'Ano', apelidos: ['date', 'year'], dica: 'Ex.: 2024' },
  { id: 'track', rotulo: 'Faixa', apelidos: ['track', 'tracknumber'], dica: 'Ex.: 3 ou 3/12' },
  { id: 'genre', rotulo: 'Gênero', apelidos: ['genre'] },
  { id: 'composer', rotulo: 'Compositor', apelidos: ['composer'] },
  { id: 'comment', rotulo: 'Comentário', apelidos: ['comment', 'description'], largo: true },
]
const VAZIO = Object.fromEntries(CAMPOS.map((c) => [c.id, '']))

/** Texto no formato FFMETADATA1 → { chave: valor } (só as tags globais). */
function lerFfmetadata(texto) {
  const tags = {}
  const linhas = texto.replace(/\\\n/g, '\u0000').split('\n')
  for (const linha of linhas) {
    if (linha.startsWith('[')) break // seções de stream/capítulo
    if (!linha || linha.startsWith(';') || linha.startsWith('#')) continue
    const i = linha.search(/(?<!\\)=/)
    if (i < 0) continue
    const desescapar = (s) => s.replace(/\u0000/g, '\n').replace(/\\([=;#\\])/g, '$1')
    tags[desescapar(linha.slice(0, i)).toLowerCase()] = desescapar(linha.slice(i + 1))
  }
  return tags
}

async function lerArquivo(arquivo) {
  const ext = extensaoDe(arquivo.name)
  const entrada = `tags.${ext}`
  let temCapa = false
  const meta = await executarFfmpeg({
    entradas: [{ nome: entrada, dados: arquivo }],
    args: ['-i', entrada, '-f', 'ffmetadata'],
    saida: 'meta.txt',
    aoLog: (l) => {
      if (/Stream #.*Video:/.test(l)) temCapa = true
    },
    rotulo: 'Lendo as tags',
  })
  const brutas = lerFfmetadata(new TextDecoder().decode(meta))
  const valores = { ...VAZIO }
  for (const c of CAMPOS) valores[c.id] = c.apelidos.map((a) => brutas[a]).find((v) => v != null) ?? ''
  let capa = null
  if (temCapa) {
    const dados = await executarFfmpeg({ entradas: [{ nome: entrada, dados: arquivo }], args: ['-i', entrada, '-an', '-map', '0:v:0', '-c', 'copy', '-f', 'image2'], saida: 'capa.img', rotulo: 'Lendo a capa' }).catch(() => null)
    if (dados?.length) {
      const blob = new Blob([dados])
      const tipo = await detectarTipo(blob)
      capa = new Blob([dados], { type: tipo?.mime ?? 'image/jpeg' })
    }
  }
  return { valores, capa }
}

/** Capa como JPEG ou PNG de até 1400 px (o que players e lojas aceitam). */
async function prepararCapa(imagem) {
  const tipo = (await detectarTipo(imagem))?.ext
  const bmp = await createImageBitmap(imagem)
  const lado = Math.max(bmp.width, bmp.height)
  if ((tipo === 'jpg' || tipo === 'png') && lado <= 1400) {
    bmp.close()
    return { blob: imagem, ext: tipo }
  }
  const escala = Math.min(1, 1400 / lado)
  const c = new OffscreenCanvas(Math.round(bmp.width * escala), Math.round(bmp.height * escala))
  const ctx = c.getContext('2d')
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, c.width, c.height)
  ctx.drawImage(bmp, 0, 0, c.width, c.height)
  bmp.close()
  return { blob: await c.convertToBlob({ type: 'image/jpeg', quality: 0.9 }), ext: 'jpg' }
}

function Editor({ arquivo, aoTrocar }) {
  const ext = extensaoDe(arquivo.name)
  const aceitaCapa = COM_CAPA.includes(ext)
  const [lido, setLido] = useState(null) // { valores, capa }
  const [erro, setErro] = useState(null)
  // O que a pessoa editou fica salvo (por arquivo); sem edição, vale o que foi lido do arquivo.
  const [edicao, setEdicao] = useSalvo(`edicao:${arquivo.name}:${arquivo.size}`, null)
  const valores = edicao?.valores ?? lido?.valores ?? VAZIO
  const capa = edicao ? edicao.capa : (lido?.capa ?? null) // Blob | null
  const setValores = (f) => setEdicao((e) => ({ capa: e ? e.capa : (lido?.capa ?? null), valores: typeof f === 'function' ? f(e?.valores ?? lido?.valores ?? VAZIO) : f }))
  const setCapa = (c) => setEdicao((e) => ({ valores: e?.valores ?? lido?.valores ?? VAZIO, capa: c }))
  const tarefa = useTarefaSalva()
  const entradaCapa = useRef(null)
  const urlCapa = useUrlObjeto(capa)

  useEffect(() => {
    let vivo = true
    lerArquivo(arquivo)
      .then((r) => {
        if (!vivo) return
        setLido(r)
      })
      .catch((e) => {
        console.error(e)
        if (vivo) setErro('Não foi possível ler este arquivo. Ele pode estar corrompido.')
      })
    return () => {
      vivo = false
    }
  }, [arquivo])

  const salvar = () =>
    tarefa.executar(async (ctx) => {
      const entrada = `in.${ext}`
      const entradas = [{ nome: entrada, dados: arquivo }]
      const args = ['-i', entrada]
      const capaNova = capa && capa !== lido.capa
      let nomeCapa = null
      if (aceitaCapa && capaNova) {
        const p = await prepararCapa(capa)
        nomeCapa = `capa.${p.ext}`
        entradas.push({ nome: nomeCapa, dados: p.blob })
        args.push('-i', nomeCapa)
      }
      args.push('-map', '0:a')
      const comCapa = aceitaCapa && capa
      if (comCapa) args.push('-map', capaNova ? '1:0' : '0:v:0')
      // Tira todas as tags antigas e grava só as do formulário.
      args.push('-c', 'copy', '-map_metadata', '-1')
      for (const c of CAMPOS) {
        const v = valores[c.id].trim()
        if (v) args.push('-metadata', `${c.id}=${v}`)
      }
      if (comCapa) {
        args.push('-disposition:v:0', 'attached_pic')
        if (ext === 'mp3') args.push('-metadata:s:v', 'title=Album cover', '-metadata:s:v', 'comment=Cover (front)')
      }
      if (ext === 'mp3') args.push('-id3v2_version', '3', '-write_id3v1', '1')
      const dados = await executarFfmpeg({ entradas, args, saida: `saida.${ext}`, aoProgredir: ctx.progresso, sinal: ctx.sinal, rotulo: 'Gravando as tags' }).catch((e) => {
        if (e?.name === 'AbortError') throw e
        throw new ErroAmigavel('Não foi possível gravar as tags neste arquivo.')
      })
      return [{ nome: arquivo.name, blob: new Blob([dados], { type: mimeDe(ext) }), detalhe: 'tags atualizadas, áudio intacto' }]
    }, 'Gravando as tags')

  if (tarefa.fase === 'pronto') return <Resultados itens={tarefa.resultado} duracao={tarefa.duracao} aoAjustar={tarefa.reiniciar} aoReiniciar={aoTrocar} rotuloNovo="Outro arquivo" />
  if (erro) {
    return (
      <Aviso tom="erro" titulo="Não deu para abrir" acao={<Botao variante="secundario" tamanho="p" onClick={aoTrocar}>Escolher outro</Botao>}>
        {erro}
      </Aviso>
    )
  }
  if (!lido) {
    return (
      <div className="cartao p-8">
        <Progresso valor={null} rotulo="Lendo as tags" />
      </div>
    )
  }

  const processando = tarefa.fase === 'processando'
  return (
    <section aria-label="Tags" className="cartao">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-borda px-4 py-3 sm:px-5">
        <p className="min-w-0 flex-1 truncate text-sm font-semibold text-tinta" title={arquivo.name}>
          {arquivo.name}
        </p>
        <Botao variante="fantasma" tamanho="p" icone="refazer" onClick={aoTrocar} disabled={processando}>
          Trocar arquivo
        </Botao>
      </div>

      <div className={`grid gap-6 p-4 sm:p-5 md:grid-cols-[14rem_minmax(0,1fr)] ${processando ? 'pointer-events-none opacity-60' : ''}`} inert={processando ? true : undefined}>
        <div className="flex flex-col gap-3">
          <div className="xadrez grid aspect-square w-full place-items-center overflow-hidden rounded-xl border border-borda bg-fundo-suave">
            {urlCapa ? <img src={urlCapa} alt="Capa" className="size-full object-cover" /> : <Icone nome="musica" tamanho={48} className="text-fraca" />}
          </div>
          {aceitaCapa ? (
            <div className="flex gap-2">
              <input
                ref={entradaCapa}
                type="file"
                accept="image/*"
                className="sr-only"
                aria-label="Imagem da capa"
                onChange={(e) => {
                  const img = e.target.files?.[0]
                  e.target.value = ''
                  if (img) setCapa(img)
                }}
              />
              <Botao variante="secundario" tamanho="p" icone="imagemMais" className="flex-1" onClick={() => entradaCapa.current?.click()}>
                {capa ? 'Trocar capa' : 'Pôr capa'}
              </Botao>
              {capa ? <Botao variante="fantasma" tamanho="p" icone="apagar" onClick={() => setCapa(null)} aria-label="Remover capa" title="Remover capa" /> : null}
            </div>
          ) : (
            <p className="text-xs text-fraca">{ext.toUpperCase()} não guarda capa. Para ter capa, converta para MP3, M4A ou FLAC.</p>
          )}
        </div>

        <div className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            {CAMPOS.map((c) => (
              <Entrada key={c.id} rotulo={c.rotulo} valor={valores[c.id]} aoMudar={(v) => setValores((x) => ({ ...x, [c.id]: v }))} placeholder={c.dica} className={c.largo ? 'sm:col-span-2' : ''} />
            ))}
          </div>
          {tarefa.fase === 'erro' ? <Aviso tom="erro">{tarefa.mensagem}</Aviso> : null}
          <div className="mt-1 flex flex-wrap items-center justify-between gap-3 border-t border-borda pt-4">
            <Botao
              variante="fantasma"
              tamanho="p"
              icone="borracha"
              onClick={() => {
                setValores(VAZIO)
                setCapa(null)
              }}
            >
              Apagar todas as tags
            </Botao>
            {processando ? (
              <div className="w-72">
                <Progresso valor={tarefa.progresso} rotulo={tarefa.rotulo} aoCancelar={tarefa.cancelar} />
              </div>
            ) : (
              <Botao icone="baixar" onClick={salvar}>
                Salvar e baixar
              </Botao>
            )}
          </div>
          <p className="text-xs text-fraca">O áudio não é recomprimido: só as informações mudam.</p>
        </div>
      </div>
    </section>
  )
}

/** Tags e capa: título, artista, álbum, ano, faixa, gênero e capa, sem mexer no som. */
export default function Tags() {
  const [arquivos, setArquivos] = useSalvo('arquivos', [])
  if (!arquivos.length) return <SeletorArquivos arquivos={arquivos} aoMudar={setArquivos} multiplos={false} extensoes={FORMATOS} descricaoFormatos="MP3, M4A, FLAC, OGG, OPUS, WAV" limiteBytes={1024 * 1024 * 1024} />
  return <Editor key={arquivos[0].id} arquivo={arquivos[0].arquivo} aoTrocar={() => setArquivos([])} />
}
