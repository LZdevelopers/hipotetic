import { useEffect, useRef, useState } from 'react'
import { Icone } from '../../../componentes/Icone'
import { Aviso, BotaoLink, Etiqueta, Segmentado } from '../../../componentes/ui'
import { formatarBytes, formatarDuracao, nomeSeguro } from '../../../nucleo/arquivos'
import { INDISPONIVEL, prepararFormato } from './api'

/** Prévia oficial da plataforma (iframe) ou a capa. */
function Player({ player, titulo, miniatura }) {
  if (player?.tipo === 'iframe') {
    const vertical = player.proporcao === '9/16'
    return (
      <div className={`mx-auto w-full overflow-hidden rounded-xl bg-black ${vertical ? 'max-w-[18rem]' : ''}`}>
        <iframe
          src={player.src}
          title={`Prévia: ${titulo}`}
          className="block w-full"
          style={{ aspectRatio: player.proporcao }}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          referrerPolicy="strict-origin-when-cross-origin"
          allowFullScreen
          loading="lazy"
        />
      </div>
    )
  }
  return miniatura ? (
    <img src={miniatura} alt="" className="aspect-video w-full rounded-xl object-cover" loading="lazy" />
  ) : (
    <div className="grid aspect-video w-full place-items-center rounded-xl bg-superficie-2 text-fraca">
      <Icone nome="filme" tamanho={32} />
    </div>
  )
}

const ACAO = 'inline-flex h-8 items-center justify-center gap-1.5 rounded-lg px-3 text-xs font-semibold whitespace-nowrap transition-colors'

/**
 * Uma linha da tabela. Formatos diretos abrem na hora numa aba nova (player
 * do navegador → ⋮ → Baixar). Formatos com `processo` (HD, MP3) são
 * preparados no navegador: a linha mostra o progresso e, no fim, Abrir/Salvar.
 */
function Linha({ formato, titulo }) {
  const [estado, setEstado] = useState({ fase: 'parado' })
  const controle = useRef(null)
  const url = estado.fase === 'pronto' ? estado.url : null

  useEffect(() => () => url && URL.revokeObjectURL(url), [url])
  useEffect(() => () => controle.current?.abort(), [])

  const preparar = async () => {
    const atual = new AbortController()
    controle.current = atual
    setEstado({ fase: 'preparando', valor: 0, rotulo: 'Baixando' })
    try {
      const blob = await prepararFormato(
        formato.processo,
        { extensao: formato.extensao, titulo },
        (valor, rotulo) => setEstado({ fase: 'preparando', valor, rotulo }),
        atual.signal,
      )
      setEstado({ fase: 'pronto', url: URL.createObjectURL(blob), tamanho: blob.size })
    } catch (erro) {
      if (!atual.signal.aborted) console.error('Falha ao preparar o arquivo:', erro)
      setEstado(atual.signal.aborted ? { fase: 'parado' } : { fase: 'erro' })
    }
  }

  const tamanho = estado.fase === 'pronto' ? estado.tamanho : formato.tamanho
  const estimado = formato.tamanhoEstimado && estado.fase !== 'pronto'
  const nome = nomeSeguro(`${titulo}.${formato.extensao}`)

  let acao
  if (formato.indisponivel) {
    acao = <span className="text-xs text-fraca">Grande demais</span>
  } else if (formato.url) {
    acao = (
      <a href={formato.url} target="_blank" rel="noopener noreferrer" className={`${ACAO} bg-marca text-sobre-marca hover:bg-marca-hover`}>
        <Icone nome="baixar" tamanho={14} />
        Baixar
      </a>
    )
  } else if (estado.fase === 'preparando') {
    const pct = estado.valor == null ? null : Math.round(estado.valor * 100)
    acao = (
      <div className="flex w-36 items-center gap-2">
        <div className="min-w-0 flex-1">
          <div className="h-1.5 overflow-hidden rounded-full bg-superficie-3">
            <div className={`h-full rounded-full bg-acento transition-[width] duration-200 ${pct == null ? 'esqueleto' : ''}`} style={{ width: `${pct ?? 100}%` }} />
          </div>
          <p className="mt-1 truncate text-[0.6875rem] text-fraca tabular-nums">
            {estado.rotulo} {pct == null ? '' : `${pct}%`}
          </p>
        </div>
        <button type="button" onClick={() => controle.current?.abort()} className="grid size-7 shrink-0 place-items-center rounded-md text-fraca hover:bg-superficie-2 hover:text-tinta" aria-label="Cancelar">
          <Icone nome="fechar" tamanho={14} />
        </button>
      </div>
    )
  } else if (estado.fase === 'pronto') {
    acao = (
      <div className="flex gap-1.5">
        <a href={estado.url} target="_blank" rel="noopener noreferrer" className={`${ACAO} border border-borda-forte text-tinta hover:bg-superficie-2`}>
          <Icone nome="play" tamanho={13} />
          Abrir
        </a>
        <a href={estado.url} download={nome} className={`${ACAO} bg-sucesso text-white escuro:text-fundo hover:brightness-110`}>
          <Icone nome="baixar" tamanho={14} />
          Salvar
        </a>
      </div>
    )
  } else {
    const erro = estado.fase === 'erro'
    acao = (
      <button type="button" onClick={preparar} className={`${ACAO} ${erro ? 'border border-perigo/40 bg-perigo-suave text-perigo' : 'bg-marca text-sobre-marca hover:bg-marca-hover'}`}>
        <Icone nome={erro ? 'refazer' : 'baixar'} tamanho={14} />
        {erro ? 'Tentar de novo' : 'Baixar'}
      </button>
    )
  }

  return (
    <tr className="border-t border-borda">
      <td className="py-2.5 pr-3">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-semibold text-tinta">
          {formato.rotulo}
          {formato.recomendado ? <Etiqueta tom="sucesso">Recomendado</Etiqueta> : null}
        </span>
        {formato.detalhe ? <span className="block text-xs text-fraca">{formato.detalhe}</span> : null}
      </td>
      <td className="py-2.5 pr-3">
        <span className="rounded-md bg-superficie-2 px-1.5 py-0.5 font-mono text-[0.6875rem] font-semibold text-suave uppercase">{formato.extensao}</span>
      </td>
      <td className="hidden py-2.5 pr-3 text-sm whitespace-nowrap text-suave tabular-nums sm:table-cell">
        {tamanho ? `${estimado ? '≈ ' : ''}${formatarBytes(tamanho)}` : '—'}
      </td>
      <td className="py-2.5 text-right">
        <div className="flex justify-end">{acao}</div>
      </td>
    </tr>
  )
}

function Tabela({ formatos, tipo, titulo }) {
  const visiveis = formatos.filter((f) => f.tipo === tipo)
  return (
    <table className="w-full border-collapse text-left">
      <thead>
        <tr className="text-[0.6875rem] font-semibold tracking-wide text-fraca uppercase">
          <th className="pr-3 pb-2 font-semibold">Qualidade</th>
          <th className="pr-3 pb-2 font-semibold">Formato</th>
          <th className="hidden pr-3 pb-2 font-semibold sm:table-cell">Tamanho</th>
          <th className="pb-2 text-right font-semibold">
            <span className="sr-only">Ação</span>
          </th>
        </tr>
      </thead>
      <tbody>
        {visiveis.map((f) => (
          <Linha key={f.id} formato={f} titulo={titulo} />
        ))}
      </tbody>
    </table>
  )
}

function Downloads({ midia }) {
  const tipos = [...new Set(midia.formatos.map((f) => f.tipo))]
  const [tipo, setTipo] = useState(tipos[0] ?? 'video')
  const temProcesso = midia.formatos.some((f) => f.processo)
  return (
    <div>
      {tipos.length > 1 ? (
        <Segmentado
          valor={tipo}
          aoMudar={setTipo}
          opcoes={[
            { valor: 'video', rotulo: 'Vídeo', icone: 'filme' },
            { valor: 'audio', rotulo: 'Só o áudio', icone: 'musica' },
          ].filter((o) => tipos.includes(o.valor))}
          className="mb-3"
        />
      ) : null}
      {/* As duas tabelas ficam montadas: trocar de aba não perde um arquivo sendo preparado. */}
      {tipos.map((t) => (
        <div key={t} hidden={t !== tipo}>
          <Tabela formatos={midia.formatos} tipo={t} titulo={midia.titulo} />
        </div>
      ))}
      <p className="mt-4 flex items-start gap-2 text-xs leading-relaxed text-fraca">
        <Icone nome="info" tamanho={14} className="mt-px" />
        <span>
          Os formatos diretos abrem no player do navegador: para salvar, use o menu ⋮ → Baixar.
          {temProcesso ? ' Os marcados para preparo (HD e MP3) são montados no seu navegador e mostram “Salvar” ao terminar.' : ''}
        </span>
      </p>
    </div>
  )
}

/** Link para baixar a capa (via /api/miniatura, que só aceita hosts de capa). */
function linkMiniatura(midia) {
  const nome = encodeURIComponent(`${midia.titulo} (miniatura)`)
  if (midia.fonte === 'youtube') {
    const id = /[?&]v=([\w-]{11})/.exec(midia.origem)?.[1]
    return id ? `/api/miniatura?yt=${id}&nome=${nome}` : null
  }
  return midia.miniatura ? `/api/miniatura?url=${encodeURIComponent(midia.miniatura)}&nome=${nome}` : null
}

export function Resultado({ midia, aoLimpar }) {
  const indisponivel = !midia.download.disponivel ? INDISPONIVEL[midia.download.motivo] : null
  const duracao = midia.duracao ? formatarDuracao(midia.duracao) : null
  const miniatura = linkMiniatura(midia)

  return (
    <article aria-label={`Resultado: ${midia.titulo}`} className="cartao animate-surgir p-4 sm:p-5">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        <div className="flex flex-col gap-3 self-start">
          <Player player={midia.player} titulo={midia.titulo} miniatura={midia.miniatura} />
          {miniatura ? (
            <a href={miniatura} className="inline-flex items-center gap-1.5 self-start text-xs font-semibold text-suave hover:text-tinta">
              <Icone nome="imagemBaixar" tamanho={15} />
              Baixar a miniatura
            </a>
          ) : null}
        </div>

        <div className="flex min-w-0 flex-col">
          <div className="flex items-start justify-between gap-3">
            <h2 className="text-xl leading-snug [overflow-wrap:anywhere]">{midia.titulo}</h2>
            <button type="button" onClick={aoLimpar} className="grid size-8 shrink-0 place-items-center rounded-lg text-fraca hover:bg-superficie-2 hover:text-tinta" aria-label="Limpar resultado">
              <Icone nome="fechar" tamanho={16} />
            </button>
          </div>
          <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-suave">
            <span className="inline-flex items-center gap-1.5">
              <Icone nome={midia.fonte} tamanho={14} colorido={midia.fonte === 'youtube'} />
              {midia.fonte === 'youtube' ? 'YouTube' : 'TikTok'}
            </span>
            {midia.autor ? (
              <span className="inline-flex items-center gap-1.5">
                <Icone nome="usuario" tamanho={14} className="text-fraca" />
                {midia.autor}
              </span>
            ) : null}
            {duracao ? (
              <span className="inline-flex items-center gap-1.5 tabular-nums">
                <Icone nome="relogio" tamanho={14} className="text-fraca" />
                {duracao}
              </span>
            ) : null}
          </p>

          <div className="mt-5">
            {midia.download.disponivel ? (
              <Downloads midia={midia} />
            ) : (
              <Aviso
                tom="alerta"
                titulo={indisponivel?.titulo ?? 'Download indisponível'}
                acao={
                  <BotaoLink href={midia.origem} target="_blank" rel="noopener noreferrer" variante="secundario" tamanho="p" icone="externo">
                    Abrir na plataforma
                  </BotaoLink>
                }
              >
                {indisponivel?.texto}
              </Aviso>
            )}
          </div>
        </div>
      </div>
    </article>
  )
}

export function ResultadoCarregando() {
  return (
    <div className="cartao p-4 sm:p-5" aria-busy="true" aria-label="Buscando informações">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        <div className="esqueleto aspect-video w-full rounded-xl" />
        <div className="flex flex-col gap-3">
          <div className="esqueleto h-6 w-11/12 rounded-md" />
          <div className="esqueleto h-6 w-2/3 rounded-md" />
          <div className="esqueleto mt-1 h-4 w-1/2 rounded" />
          <div className="esqueleto mt-4 h-10 w-full rounded-lg" />
          <div className="esqueleto h-10 w-full rounded-lg" />
          <div className="esqueleto h-10 w-full rounded-lg" />
        </div>
      </div>
    </div>
  )
}
