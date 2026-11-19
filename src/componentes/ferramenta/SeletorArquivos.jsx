import { useEffect, useId, useRef, useState } from 'react'
import { detectarTipo, extensaoDe, formatarBytes } from '../../nucleo/arquivos'
import { Icone } from '../Icone'
import { Aviso, Botao } from '../ui'

/** jpg e jpeg são o mesmo formato; tif/tiff idem; etc. */
const SINONIMOS = { jpeg: 'jpg', tif: 'tiff', htm: 'html', markdown: 'md', mpga: 'mp3', qt: 'mov', oga: 'ogg', m4v: 'mp4' }
const canonica = (ext) => SINONIMOS[ext] ?? ext

/**
 * Tipos que o detector reporta de outro jeito: um .docx é um ZIP por dentro,
 * um .m4a é um MP4 de áudio, um .md é texto…
 */
const EQUIVALENTES = {
  docx: ['docx', 'zip'],
  odt: ['odt', 'zip'],
  m4a: ['m4a', 'mp4'],
  aac: ['aac', 'm4a', 'mp4'],
  mov: ['mov', 'qt', 'mp4'],
  mp4: ['mp4', 'm4v', 'mov'],
  opus: ['opus', 'ogg'],
  ogg: ['ogg', 'opus', 'oga'],
  weba: ['webm', 'weba'],
  webm: ['webm', 'mkv'],
  mkv: ['mkv', 'webm'],
  md: ['txt'],
  csv: ['txt'],
  json: ['txt'],
  txt: ['txt'],
  html: ['html', 'txt'],
  svg: ['svg', 'xml', 'txt'],
  gz: ['gz'],
  tgz: ['gz'],
  doc: ['cfb', 'doc'],
}

async function validar(arquivo, extensoes, limiteBytes) {
  if (arquivo.size === 0) return 'arquivo vazio'
  if (limiteBytes && arquivo.size > limiteBytes) return `maior que o limite de ${formatarBytes(limiteBytes)}`
  if (!extensoes) return null
  const pedida = canonica(extensaoDe(arquivo.name))
  const real = await detectarTipo(arquivo)
  const realExt = real ? canonica(real.ext) : null
  const aceitas = extensoes.map(canonica)
  // O tipo real manda: um .png que na verdade é JPEG é aceito como JPEG.
  if (realExt && aceitas.some((a) => (EQUIVALENTES[a] ?? [a]).includes(realExt))) return null
  if (!realExt && aceitas.includes(pedida)) return null
  if (realExt) return `o conteúdo é ${realExt.toUpperCase()}, que esta ferramenta não aceita`
  return 'formato não suportado'
}

let proximoId = 0

/** Arquivos de uma pasta arrastada, com o caminho relativo (recursivo). */
async function lerEntrada(entrada, prefixo = '') {
  if (entrada.isFile) {
    const arquivo = await new Promise((ok, falha) => entrada.file(ok, falha))
    return [{ arquivo, caminho: prefixo + arquivo.name }]
  }
  const leitor = entrada.createReader()
  const filhos = []
  // readEntries devolve em lotes: lê até vir vazio.
  for (;;) {
    const lote = await new Promise((ok, falha) => leitor.readEntries(ok, falha))
    if (!lote.length) break
    filhos.push(...lote)
  }
  const saida = []
  for (const filho of filhos) saida.push(...(await lerEntrada(filho, `${prefixo}${entrada.name}/`)))
  return saida
}

/**
 * Área para soltar/escolher arquivos + lista dos escolhidos.
 *
 * Valida cada arquivo pelo CONTEÚDO (assinatura dos bytes), não só pela
 * extensão, e rejeita com um motivo claro. `ordenavel` mostra setas para
 * mudar a ordem (unir PDFs, juntar vídeos…).
 */
export function SeletorArquivos({
  arquivos,
  aoMudar,
  extensoes,
  descricaoFormatos,
  multiplos = true,
  limiteBytes,
  maximo = 200,
  ordenavel = false,
  aceitarColar = false,
  compacto = false,
  pastas = false,
}) {
  const id = useId()
  const entrada = useRef(null)
  const entradaPasta = useRef(null)
  const [arrastando, setArrastando] = useState(false)
  const [validando, setValidando] = useState(false)
  const [rejeitados, setRejeitados] = useState([])

  const adicionar = async (lista) => {
    const novos = [...lista]
    if (!novos.length) return
    setValidando(true)
    const aceitos = []
    const recusados = []
    for (const novo of novos) {
      const arquivo = novo instanceof File ? novo : novo.arquivo
      const caminho = novo instanceof File ? novo.webkitRelativePath || novo.name : novo.caminho
      const motivo = await validar(arquivo, extensoes, limiteBytes)
      if (motivo) recusados.push({ nome: caminho, motivo })
      else aceitos.push({ id: `a${Date.now().toString(36)}${(proximoId += 1)}`, arquivo, caminho })
    }
    setValidando(false)
    setRejeitados(recusados)
    if (!aceitos.length) return
    const base = multiplos ? arquivos : []
    const combinados = [...base, ...(multiplos ? aceitos : aceitos.slice(0, 1))]
    if (combinados.length > maximo) {
      recusados.push({ nome: `${combinados.length - maximo} arquivo(s)`, motivo: `o máximo é ${maximo} por vez` })
      setRejeitados([...recusados])
    }
    aoMudar(combinados.slice(0, maximo))
  }

  // Colar imagens/arquivos da área de transferência (Ctrl+V) em qualquer
  // lugar da página, quando a ferramenta aceita.
  const adicionarRef = useRef(adicionar)
  adicionarRef.current = adicionar
  useEffect(() => {
    if (!aceitarColar) return undefined
    const aoColar = (evento) => {
      if (evento.target.closest?.('input, textarea, [contenteditable]')) return
      const lista = [...(evento.clipboardData?.files ?? [])]
      if (lista.length) {
        evento.preventDefault()
        adicionarRef.current(lista)
      }
    }
    addEventListener('paste', aoColar)
    return () => removeEventListener('paste', aoColar)
  }, [aceitarColar])

  const remover = (alvo) => aoMudar(arquivos.filter((a) => a.id !== alvo))
  const mover = (indice, delta) => {
    const destino = indice + delta
    if (destino < 0 || destino >= arquivos.length) return
    const copia = [...arquivos]
    ;[copia[indice], copia[destino]] = [copia[destino], copia[indice]]
    aoMudar(copia)
  }

  const accept = extensoes?.map((e) => `.${e}`).join(',')
  const vazio = arquivos.length === 0
  const total = arquivos.reduce((s, a) => s + a.arquivo.size, 0)

  return (
    <div className="flex flex-col gap-3">
      <div
        onDragEnter={(e) => {
          e.preventDefault()
          setArrastando(true)
        }}
        onDragOver={(e) => e.preventDefault()}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget)) setArrastando(false)
        }}
        onDrop={async (e) => {
          e.preventDefault()
          setArrastando(false)
          const entradas = pastas ? [...(e.dataTransfer.items ?? [])].map((i) => i.webkitGetAsEntry?.()).filter(Boolean) : []
          if (entradas.some((x) => x.isDirectory)) {
            const lista = []
            for (const x of entradas) lista.push(...(await lerEntrada(x)))
            adicionar(lista)
          } else adicionar(e.dataTransfer.files)
        }}
        className={`relative flex flex-col items-center justify-center rounded-[var(--radius-cartao)] border-2 border-dashed text-center transition-colors ${
          arrastando ? 'border-acento bg-acento-suave' : 'border-borda-forte bg-fundo-suave hover:border-fraca/50'
        } ${vazio && !compacto ? 'min-h-56 px-6 py-10' : 'px-4 py-5'}`}
      >
        <input
          ref={entrada}
          id={id}
          type="file"
          accept={accept}
          multiple={multiplos}
          className="sr-only"
          onChange={(e) => {
            adicionar(e.target.files)
            e.target.value = ''
          }}
        />
        {pastas ? (
          <input
            ref={entradaPasta}
            type="file"
            webkitdirectory=""
            multiple
            className="sr-only"
            tabIndex={-1}
            onChange={(e) => {
              adicionar(e.target.files)
              e.target.value = ''
            }}
          />
        ) : null}
        {vazio && !compacto ? (
          <>
            <span className="grid size-12 place-items-center rounded-xl border border-borda bg-superficie text-suave shadow-[var(--shadow-cartao)]">
              <Icone nome={validando ? 'carregando' : 'enviar'} tamanho={22} className={validando ? 'animate-girar' : ''} />
            </span>
            <p className="mt-4 text-base font-semibold text-tinta">
              {arrastando ? 'Solte para adicionar' : multiplos ? 'Arraste os arquivos para cá' : 'Arraste o arquivo para cá'}
            </p>
            <p className="mt-1 text-sm text-suave">ou</p>
            <div className="mt-3 flex flex-wrap justify-center gap-2">
              <Botao icone="arquivoMais" onClick={() => entrada.current?.click()} disabled={validando}>
                {multiplos ? 'Escolher arquivos' : 'Escolher arquivo'}
              </Botao>
              {pastas ? (
                <Botao variante="secundario" icone="pastaCompactada" onClick={() => entradaPasta.current?.click()} disabled={validando}>
                  Escolher pasta
                </Botao>
              ) : null}
            </div>
            <p className="mt-4 text-xs text-fraca">
              {descricaoFormatos}
              {limiteBytes ? ` · até ${formatarBytes(limiteBytes)}${multiplos ? ' cada' : ''}` : ''}
              {aceitarColar ? ' · ou cole com Ctrl+V' : ''}
            </p>
          </>
        ) : (
          <div className="flex w-full flex-wrap items-center justify-center gap-x-3 gap-y-2 text-sm">
            <Botao variante="secundario" tamanho="p" icone={validando ? undefined : 'arquivoMais'} carregando={validando} onClick={() => entrada.current?.click()}>
              {vazio ? (multiplos ? 'Escolher arquivos' : 'Escolher arquivo') : multiplos ? 'Adicionar mais' : 'Trocar arquivo'}
            </Botao>
            {pastas ? (
              <Botao variante="secundario" tamanho="p" icone="pastaCompactada" onClick={() => entradaPasta.current?.click()}>
                Adicionar pasta
              </Botao>
            ) : null}
            <span className="text-xs text-fraca">{arrastando ? 'Solte para adicionar' : `ou arraste para cá · ${descricaoFormatos}`}</span>
          </div>
        )}
      </div>

      {rejeitados.length ? (
        <Aviso tom="alerta" titulo={rejeitados.length === 1 ? 'Um arquivo não foi aceito' : `${rejeitados.length} arquivos não foram aceitos`} aoFechar={() => setRejeitados([])}>
          <ul className="mt-1 space-y-0.5">
            {rejeitados.slice(0, 6).map((r, i) => (
              <li key={i} className="[overflow-wrap:anywhere]">
                <strong className="font-medium">{r.nome}</strong>: {r.motivo}.
              </li>
            ))}
          </ul>
        </Aviso>
      ) : null}

      {!vazio ? (
        <div className="cartao overflow-hidden">
          <div className="flex items-center justify-between gap-3 border-b border-borda px-4 py-2.5 text-xs text-fraca">
            <span>
              {arquivos.length} {arquivos.length === 1 ? 'arquivo' : 'arquivos'} · {formatarBytes(total)}
            </span>
            {arquivos.length > 1 ? (
              <button type="button" className="font-semibold text-suave hover:text-perigo" onClick={() => aoMudar([])}>
                Remover todos
              </button>
            ) : null}
          </div>
          <ul className="max-h-80 divide-y divide-borda overflow-y-auto">
            {arquivos.map((item, i) => (
              <li key={item.id} className="flex items-center gap-3 px-4 py-2.5">
                {ordenavel ? <span className="w-5 shrink-0 text-center text-xs font-semibold text-fraca tabular-nums">{i + 1}</span> : null}
                <Icone nome={iconeDoArquivo(item.arquivo.name)} tamanho={18} className="text-fraca" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-tinta" title={item.caminho ?? item.arquivo.name}>
                    {item.caminho ?? item.arquivo.name}
                  </p>
                  <p className="text-xs text-fraca tabular-nums">{formatarBytes(item.arquivo.size)}</p>
                </div>
                {ordenavel && arquivos.length > 1 ? (
                  <div className="flex shrink-0">
                    <BotaoIcone rotulo="Mover para cima" icone="setaBaixo" girar disabled={i === 0} onClick={() => mover(i, -1)} />
                    <BotaoIcone rotulo="Mover para baixo" icone="setaBaixo" disabled={i === arquivos.length - 1} onClick={() => mover(i, 1)} />
                  </div>
                ) : null}
                <BotaoIcone rotulo={`Remover ${item.arquivo.name}`} icone="fechar" onClick={() => remover(item.id)} />
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}

function BotaoIcone({ rotulo, icone, girar, ...props }) {
  return (
    <button
      type="button"
      aria-label={rotulo}
      title={rotulo}
      className="grid size-8 shrink-0 place-items-center rounded-md text-fraca transition-colors hover:bg-superficie-2 hover:text-tinta disabled:opacity-30 disabled:hover:bg-transparent"
      {...props}
    >
      <Icone nome={icone} tamanho={16} className={girar ? 'rotate-180' : ''} />
    </button>
  )
}

export function iconeDoArquivo(nome) {
  const ext = extensaoDe(nome)
  if (/^(png|jpe?g|webp|avif|gif|bmp|svg|ico|heic|tiff?)$/.test(ext)) return 'arquivoImagem'
  if (/^(mp4|webm|mov|mkv|avi|m4v|3gp)$/.test(ext)) return 'arquivoVideo'
  if (/^(mp3|wav|ogg|opus|flac|aac|m4a|weba)$/.test(ext)) return 'arquivoAudio'
  if (/^(zip|rar|7z|tar|gz|tgz|bz2|xz)$/.test(ext)) return 'pastaCompactada'
  if (/^(html?|css|js|json|xml|md)$/.test(ext)) return 'arquivoCodigo'
  if (ext === 'pdf') return 'pdf'
  return 'arquivo'
}
