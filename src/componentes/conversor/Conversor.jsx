import { useEffect, useMemo, useRef, useState } from 'react'
import { converter, destinosPara, identificar, limiteDe, opcoesPadrao } from '../../motores/conversor'
import { servidorDocumentos } from '../../motores/documentos'
import { baixarBlob, formatarBytes, zipar } from '../../nucleo/arquivos'
import { Icone } from '../Icone'
import { Aviso, Botao, Caixa, SeloCategoria } from '../ui'
import { OpcoesConversao } from './Opcoes'
import { SeletorFormato } from './SeletorFormato'

/**
 * Conversor universal, no estilo "solte o arquivo e escolha o formato":
 *   1. a pessoa solta qualquer arquivo (ou vários, de tipos diferentes);
 *   2. cada um é identificado pelo conteúdo e ganha a lista de formatos
 *      para os quais PODE virar;
 *   3. escolhe o destino de cada um (ou "todos para") e converte;
 *   4. baixa um a um ou tudo em ZIP.
 * As conversões rodam uma por vez (os motores usam bastante memória); um
 * erro num arquivo não interrompe os outros.
 */

const MAXIMO = 50

const CATEGORIA = { imagem: 'imagem', video: 'video', audio: 'audio', pdf: 'pdf', documento: 'documentos', markdown: 'documentos', texto: 'documentos', compactado: 'compactados' }
const ICONE = { imagem: 'arquivoImagem', video: 'arquivoVideo', audio: 'arquivoAudio', pdf: 'pdf', documento: 'documentos', markdown: 'arquivoCodigo', texto: 'texto', compactado: 'pastaCompactada' }
const EXEMPLOS = ['MP4', 'MOV', 'MP3', 'WAV', 'JPG', 'PNG', 'WEBP', 'GIF', 'PDF', 'DOCX', 'ZIP', 'RAR']

let proximoId = 0

/** Liga o servidor de documentos antes de precisar dele (a 1ª chamada descompacta o LibreOffice). */
let aquecido = false
function aquecerServidor() {
  if (aquecido || !servidorDocumentos) return
  aquecido = true
  fetch('/api/documentos/converter', { method: 'GET' }).catch(() => {})
}

function useUrl(blob) {
  const url = useMemo(() => (blob ? URL.createObjectURL(blob) : null), [blob])
  useEffect(() => () => url && URL.revokeObjectURL(url), [url])
  return url
}

function LinkBaixar({ resultado }) {
  const url = useUrl(resultado.blob)
  return (
    <a
      href={url}
      download={resultado.nome}
      className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-marca px-3.5 text-[0.8125rem] font-semibold text-sobre-marca transition-colors hover:bg-marca-hover"
    >
      <Icone nome="baixar" tamanho={15} />
      Baixar
    </a>
  )
}

function Estado({ item }) {
  const base = 'inline-flex h-6 items-center gap-1 rounded-full px-2 text-[0.6875rem] font-bold tracking-wide uppercase tabular-nums'
  if (item.estado === 'convertendo') {
    return (
      <span className={`${base} bg-acento-suave text-acento`}>
        <Icone nome="carregando" tamanho={12} className="animate-girar" />
        {item.progresso == null ? 'Convertendo' : `${Math.round(item.progresso * 100)}%`}
      </span>
    )
  }
  if (item.estado === 'fila') return <span className={`${base} bg-superficie-2 text-fraca`}>Na fila</span>
  if (item.estado === 'concluido') {
    return (
      <span className={`${base} bg-sucesso-suave text-sucesso`}>
        <Icone nome="check" tamanho={12} strokeWidth={2.5} />
        Pronto
      </span>
    )
  }
  if (item.estado === 'erro') return <span className={`${base} bg-perigo-suave text-perigo`}>Erro</span>
  return null
}

function BotaoIcone({ rotulo, icone, ativo, ...props }) {
  return (
    <button
      type="button"
      aria-label={rotulo}
      title={rotulo}
      aria-pressed={ativo}
      className={`grid size-9 shrink-0 place-items-center rounded-lg transition-colors disabled:opacity-30 ${ativo ? 'bg-superficie-2 text-tinta' : 'text-fraca hover:bg-superficie-2 hover:text-tinta'}`}
      {...props}
    >
      <Icone nome={icone} tamanho={17} />
    </button>
  )
}

function Linha({ item, ocupado, aoEscolher, aoMudarOpcoes, aoRemover }) {
  const [ajustes, setAjustes] = useState(false)
  const destinos = useMemo(() => destinosPara(item.entrada, item.arquivo.size), [item.entrada, item.arquivo.size])
  const temAjustes = item.destino && Object.keys(opcoesPadrao(item.entrada, item.destino)).length > 0
  const travado = ocupado && (item.estado === 'fila' || item.estado === 'convertendo')
  const resultado = item.resultado

  return (
    <li className="relative px-4 py-3 sm:px-5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2.5">
        <div className="flex min-w-0 flex-[1_1_14rem] items-center gap-3">
          <SeloCategoria categoria={CATEGORIA[item.entrada.tipo]} icone={ICONE[item.entrada.tipo]} />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-tinta" title={resultado?.nome ?? item.arquivo.name}>
              {resultado?.nome ?? item.arquivo.name}
            </p>
            <p className="mt-0.5 truncate text-xs text-fraca tabular-nums">
              {resultado ? (
                <>
                  {formatarBytes(resultado.blob.size)}
                  {resultado.detalhe ? ` · ${resultado.detalhe}` : ''}
                </>
              ) : item.incluidoEm ? (
                'Junto no mesmo PDF'
              ) : (
                <>
                  {item.entrada.rotulo} · {formatarBytes(item.arquivo.size)}
                </>
              )}
            </p>
          </div>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs text-fraca">para</span>
          <SeletorFormato destinos={destinos} valor={item.destino} aoEscolher={aoEscolher} desativado={travado} />
          <span className="flex w-24 justify-center max-sm:hidden">
            <Estado item={item} />
          </span>
          {temAjustes ? <BotaoIcone rotulo="Ajustes da conversão" icone="ajustar" ativo={ajustes} disabled={travado} onClick={() => setAjustes((a) => !a)} /> : <span className="size-9 max-sm:hidden" />}
          {resultado ? <LinkBaixar resultado={resultado} /> : <BotaoIcone rotulo={`Remover ${item.arquivo.name}`} icone="fechar" disabled={travado} onClick={aoRemover} />}
        </div>
      </div>

      {item.estado === 'convertendo' || item.estado === 'erro' || item.estado === 'concluido' ? (
        <div className="mt-2 sm:hidden">
          <Estado item={item} />
        </div>
      ) : null}

      {item.estado === 'convertendo' ? (
        <div className="mt-2.5">
          <div className="mb-1 truncate text-xs text-fraca">{item.rotulo}</div>
          <div className="h-1 overflow-hidden rounded-full bg-superficie-3" role="progressbar" aria-label={`Convertendo ${item.arquivo.name}`} aria-valuenow={item.progresso == null ? undefined : Math.round(item.progresso * 100)}>
            {item.progresso == null ? (
              <div className="esqueleto h-full w-full" style={{ backgroundImage: 'linear-gradient(90deg, transparent, var(--color-acento), transparent)' }} />
            ) : (
              <div className="h-full rounded-full bg-acento transition-[width] duration-200" style={{ width: `${Math.round(item.progresso * 100)}%` }} />
            )}
          </div>
        </div>
      ) : null}

      {item.estado === 'erro' ? (
        <p role="alert" className="mt-2 flex items-start gap-1.5 text-[0.8125rem] text-perigo">
          <Icone nome="alerta" tamanho={15} className="mt-0.5 shrink-0" />
          {item.erro}
        </p>
      ) : null}

      {ajustes && temAjustes ? (
        <div className="mt-3 rounded-xl border border-borda bg-fundo-suave p-4">
          <OpcoesConversao entrada={item.entrada} destino={item.destino} opcoes={item.opcoes} mudar={aoMudarOpcoes} />
        </div>
      ) : null}
    </li>
  )
}

export function Conversor() {
  const [itens, setItens] = useState([])
  const [rejeitados, setRejeitados] = useState([])
  const [validando, setValidando] = useState(false)
  const [arrastando, setArrastando] = useState(false)
  const [convertendo, setConvertendo] = useState(false)
  const [juntarPdf, setJuntarPdf] = useState(false)
  const [zipando, setZipando] = useState(null)
  const entradaArquivo = useRef(null)
  const controle = useRef(null)
  const itensRef = useRef(itens)
  itensRef.current = itens

  useEffect(() => () => controle.current?.abort(), [])

  const atualizar = (ids, mudanca) => {
    const alvo = new Set(Array.isArray(ids) ? ids : [ids])
    setItens((lista) => lista.map((i) => (alvo.has(i.id) ? { ...i, ...(typeof mudanca === 'function' ? mudanca(i) : mudanca) } : i)))
  }

  const adicionar = async (lista) => {
    const novos = [...(lista ?? [])]
    if (!novos.length) return
    setValidando(true)
    const aceitos = []
    const recusados = []
    for (const arquivo of novos) {
      if (!arquivo.size) {
        recusados.push({ nome: arquivo.name, motivo: 'arquivo vazio' })
        continue
      }
      const entrada = await identificar(arquivo).catch(() => null)
      if (!entrada) {
        recusados.push({ nome: arquivo.name, motivo: 'não reconhecemos este formato (ou ainda não há conversão para ele)' })
        continue
      }
      if (arquivo.size > limiteDe(entrada)) {
        recusados.push({ nome: arquivo.name, motivo: `maior que o limite de ${formatarBytes(limiteDe(entrada))} para ${entrada.rotulo}` })
        continue
      }
      const destinos = destinosPara(entrada, arquivo.size)
      if (!destinos.length) {
        recusados.push({ nome: arquivo.name, motivo: entrada.tipo === 'documento' || entrada.tipo === 'texto' ? 'a conversão de documentos não está disponível agora' : 'ainda não há conversão para este formato' })
        continue
      }
      if (destinos.some((d) => d.servidor)) aquecerServidor()
      aceitos.push({ id: `c${(proximoId += 1)}`, arquivo, entrada, destino: null, opcoes: {}, estado: 'pronto' })
    }
    setValidando(false)
    const vagas = MAXIMO - itensRef.current.length
    if (aceitos.length > vagas) recusados.push({ nome: `${aceitos.length - vagas} arquivo(s)`, motivo: `o máximo é ${MAXIMO} por vez` })
    setRejeitados(recusados)
    if (aceitos.length && vagas > 0) setItens((atual) => [...atual, ...aceitos.slice(0, MAXIMO - atual.length)])
  }

  // Colar arquivos (Ctrl+V) em qualquer lugar da página.
  const adicionarRef = useRef(adicionar)
  adicionarRef.current = adicionar
  useEffect(() => {
    const aoColar = (e) => {
      if (e.target.closest?.('input, textarea, [contenteditable]')) return
      const lista = [...(e.clipboardData?.files ?? [])]
      if (lista.length) {
        e.preventDefault()
        adicionarRef.current(lista)
      }
    }
    addEventListener('paste', aoColar)
    return () => removeEventListener('paste', aoColar)
  }, [])

  const escolher = (id, destino) =>
    atualizar(id, (i) => (i.destino === destino ? {} : { destino, opcoes: {}, estado: 'pronto', resultado: null, incluidoEm: null, erro: null }))

  // "Converter todos para": só os formatos que servem para TODOS os arquivos.
  const destinosComuns = useMemo(() => {
    if (itens.length < 2) return []
    const listas = itens.map((i) => destinosPara(i.entrada, i.arquivo.size).filter((d) => !d.bloqueio))
    return listas[0].filter((d) => listas.every((l) => l.some((x) => x.ext === d.ext)))
  }, [itens])
  const destinoComum = itens.length > 1 && itens.every((i) => i.destino && i.destino === itens[0].destino) ? itens[0].destino : null

  const pendentes = itens.filter((i) => i.destino && (i.estado === 'pronto' || i.estado === 'erro'))
  const semDestino = itens.filter((i) => !i.destino && i.estado === 'pronto')
  const imagensParaPdf = itens.filter((i) => i.entrada.tipo === 'imagem' && i.destino === 'pdf')
  const concluidos = itens.filter((i) => i.estado === 'concluido' && i.resultado)
  const terminou = !convertendo && itens.length > 0 && !pendentes.length && !semDestino.length && concluidos.length > 0
  const usaServidor = itens.some((i) => i.destino && destinosPara(i.entrada).find((d) => d.ext === i.destino)?.servidor)

  const converterTudo = async () => {
    const atual = new AbortController()
    controle.current = atual
    const fila = itensRef.current.filter((i) => i.destino && (i.estado === 'pronto' || i.estado === 'erro'))
    if (!fila.length) return
    setConvertendo(true)
    setRejeitados([])
    atualizar(
      fila.map((i) => i.id),
      { estado: 'fila', erro: null, progresso: null },
    )

    // "Juntar em um PDF": as imagens com destino PDF viram uma tarefa só.
    const juntas = juntarPdf ? fila.filter((i) => i.entrada.tipo === 'imagem' && i.destino === 'pdf') : []
    const tarefas = juntas.length > 1 ? [juntas, ...fila.filter((i) => !juntas.includes(i)).map((i) => [i])] : fila.map((i) => [i])

    for (const grupo of tarefas) {
      if (atual.signal.aborted) break
      const [principal] = grupo
      const ids = grupo.map((i) => i.id)
      atualizar(ids, { estado: 'convertendo', progresso: null, rotulo: 'Preparando' })
      let ultimo = 0
      const ctx = {
        sinal: atual.signal,
        progresso: (valor, rotulo) => {
          const agora = performance.now()
          if (valor != null && valor < 1 && agora - ultimo < 80 && !rotulo) return
          ultimo = agora
          atualizar(principal.id, (i) => ({ progresso: valor, rotulo: rotulo ?? i.rotulo }))
        },
      }
      try {
        let resultado
        if (grupo.length > 1) {
          const { imagensParaPdf: juntar } = await import('../../motores/pdf/imagens')
          const r = await juntar(
            grupo.map((i) => i.arquivo),
            { ...opcoesPadrao(principal.entrada, 'pdf'), ...principal.opcoes },
            ctx,
          )
          resultado = { nome: 'imagens.pdf', blob: r.blob, detalhe: `${r.paginas} páginas` }
        } else {
          resultado = await converter(principal.arquivo, principal.entrada, principal.destino, principal.opcoes, ctx)
        }
        if (atual.signal.aborted) break
        atualizar(principal.id, { estado: 'concluido', resultado, incluidoEm: null })
        if (grupo.length > 1) atualizar(ids.slice(1), { estado: 'concluido', resultado: null, incluidoEm: principal.id })
      } catch (erro) {
        if (atual.signal.aborted || erro?.name === 'AbortError') break
        console.error(erro)
        atualizar(ids, { estado: 'erro', erro: erro?.mensagem ?? 'Não foi possível converter este arquivo. Ele pode estar corrompido ou usar um recurso que o navegador não lê.' })
      }
    }
    if (atual.signal.aborted) {
      setItens((lista) => lista.map((i) => (i.estado === 'fila' || i.estado === 'convertendo' ? { ...i, estado: 'pronto', progresso: null } : i)))
    }
    setConvertendo(false)
  }

  const cancelar = () => controle.current?.abort()

  const baixarTudo = async () => {
    setZipando(0)
    try {
      baixarBlob(await zipar(concluidos.map((i) => i.resultado), setZipando), 'convertidos.zip')
    } finally {
      setZipando(null)
    }
  }

  const recomecar = () => {
    setItens([])
    setRejeitados([])
    setJuntarPdf(false)
  }

  const vazio = itens.length === 0
  const total = itens.reduce((s, i) => s + i.arquivo.size, 0)

  return (
    <div
      className="relative flex flex-col gap-4"
      onDragEnter={(e) => {
        if (convertendo) return
        e.preventDefault()
        setArrastando(true)
      }}
      onDragOver={(e) => e.preventDefault()}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setArrastando(false)
      }}
      onDrop={(e) => {
        e.preventDefault()
        setArrastando(false)
        if (!convertendo) adicionar(e.dataTransfer.files)
      }}
    >
      <input
        ref={entradaArquivo}
        type="file"
        multiple
        className="sr-only"
        tabIndex={-1}
        onChange={(e) => {
          adicionar(e.target.files)
          e.target.value = ''
        }}
      />

      {vazio ? (
        <div
          className={`flex min-h-72 flex-col items-center justify-center rounded-[var(--radius-cartao)] border-2 border-dashed px-6 py-12 text-center transition-colors ${
            arrastando ? 'border-acento bg-acento-suave' : 'border-borda-forte bg-fundo-suave'
          }`}
        >
          <span className="grid size-14 place-items-center rounded-2xl bg-marca text-sobre-marca shadow-[var(--shadow-cartao)]">
            <Icone nome={validando ? 'carregando' : 'enviar'} tamanho={24} className={validando ? 'animate-girar' : ''} />
          </span>
          <p className="mt-5 text-lg font-semibold text-tinta">{arrastando ? 'Solte para adicionar' : 'Solte seus arquivos aqui'}</p>
          <p className="mt-1 text-sm text-suave">O formato é reconhecido sozinho e você escolhe para qual quer converter.</p>
          <Botao tamanho="g" icone="arquivoMais" className="mt-5" onClick={() => entradaArquivo.current?.click()} disabled={validando}>
            Escolher arquivos
          </Botao>
          <p className="mt-4 text-xs text-fraca">ou cole com Ctrl+V</p>
          <ul className="mt-6 flex max-w-lg flex-wrap justify-center gap-1.5" aria-label="Alguns formatos aceitos">
            {EXEMPLOS.map((e) => (
              <li key={e} className="rounded-md border border-borda bg-superficie px-2 py-0.5 text-[0.6875rem] font-semibold text-fraca">
                {e}
              </li>
            ))}
            <li className="px-1 py-0.5 text-[0.6875rem] text-fraca">e outros</li>
          </ul>
        </div>
      ) : (
        <section aria-label={terminou ? 'Resultado' : 'Arquivos'} className="cartao overflow-visible">
          <header className="flex flex-wrap items-center justify-between gap-3 border-b border-borda px-4 py-2.5 text-xs text-fraca sm:px-5">
            <span className="tabular-nums">
              {itens.length} {itens.length === 1 ? 'arquivo' : 'arquivos'} · {formatarBytes(total)}
            </span>
            {destinosComuns.length && !terminou ? (
              <span className="flex items-center gap-2">
                Converter todos para
                <SeletorFormato
                  destinos={destinosComuns}
                  valor={destinoComum}
                  desativado={convertendo}
                  aoEscolher={(d) => itensRef.current.forEach((i) => escolher(i.id, d))}
                  compacto
                />
              </span>
            ) : null}
          </header>
          <ul className="divide-y divide-borda">
            {itens.map((item) => (
              <Linha
                key={item.id}
                item={item}
                ocupado={convertendo}
                aoEscolher={(d) => escolher(item.id, d)}
                aoMudarOpcoes={(chave, valor) => atualizar(item.id, (i) => ({ opcoes: { ...i.opcoes, [chave]: valor }, ...(i.estado === 'concluido' || i.estado === 'erro' ? { estado: 'pronto', resultado: null, erro: null } : {}) }))}
                aoRemover={() => setItens((lista) => lista.filter((i) => i.id !== item.id))}
              />
            ))}
          </ul>
          {arrastando ? (
            <div className="pointer-events-none absolute inset-0 grid place-items-center rounded-[var(--radius-cartao)] border-2 border-dashed border-acento bg-acento-suave/90 text-sm font-semibold text-acento">
              Solte para adicionar
            </div>
          ) : null}
        </section>
      )}

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
        <>
          {imagensParaPdf.length > 1 && !terminou ? (
            <Caixa rotulo="Juntar as imagens em um PDF só" dica="Uma imagem por página, na ordem da lista." marcado={juntarPdf} aoMudar={setJuntarPdf} />
          ) : null}
          {usaServidor && !terminou ? (
            <p className="flex items-start gap-1.5 text-xs text-fraca">
              <Icone nome="servidor" tamanho={14} className="mt-px shrink-0" />
              Documentos (DOCX, ODT, PDF…) são convertidos no nosso servidor com o LibreOffice e apagados na hora. O resto não sai do seu aparelho.
            </p>
          ) : null}

          <div className="flex flex-wrap items-center justify-between gap-3">
            {terminou ? (
              <Botao variante="secundario" icone="refazer" onClick={recomecar}>
                Converter outros arquivos
              </Botao>
            ) : (
              <Botao variante="secundario" icone={validando ? undefined : 'arquivoMais'} carregando={validando} disabled={convertendo || itens.length >= MAXIMO} onClick={() => entradaArquivo.current?.click()}>
                Adicionar mais arquivos
              </Botao>
            )}

            <div className="flex flex-wrap items-center gap-3">
              {terminou && concluidos.length > 1 ? (
                <Botao icone="pastaCompactada" carregando={zipando != null} onClick={baixarTudo}>
                  {zipando != null ? `Compactando ${Math.round(zipando * 100)}%` : 'Baixar tudo (.zip)'}
                </Botao>
              ) : null}
              {convertendo ? (
                <Botao variante="secundario" onClick={cancelar}>
                  Cancelar
                </Botao>
              ) : null}
              {!terminou ? (
                <Botao tamanho="g" iconeDireita="seta" onClick={converterTudo} disabled={convertendo || !pendentes.length} carregando={convertendo}>
                  {convertendo ? 'Convertendo' : 'Converter'}
                </Botao>
              ) : null}
            </div>
          </div>
          {semDestino.length && !convertendo ? (
            <p className="-mt-1 text-right text-xs text-fraca">
              {semDestino.length === itens.length ? 'Escolha o formato de saída de cada arquivo.' : `Falta escolher o formato de ${semDestino.length} ${semDestino.length === 1 ? 'arquivo' : 'arquivos'}.`}
            </p>
          ) : null}
        </>
      ) : null}
    </div>
  )
}

