import { useEffect, useRef, useState } from 'react'
import { downloadTip } from '../../data/site'
import { nomeArquivo, processar } from '../../lib/ffmpeg'
import { formatBytes } from '../../lib/media'
import { Icon } from '../primitives/Icon'

const TIPOS = [
  { id: 'video', label: 'Vídeo', icon: 'film' },
  { id: 'audio', label: 'Áudio', icon: 'music' },
]

/** Alternância Vídeo | Áudio acima da tabela. */
export function TipoToggle({ tipos, ativo, onChange }) {
  return (
    <div role="tablist" aria-label="Tipo de arquivo" className="inline-flex rounded-xl border border-white/10 bg-white/[0.03] p-1">
      {TIPOS.filter((t) => tipos.includes(t.id)).map((t) => (
        <button
          key={t.id}
          type="button"
          role="tab"
          aria-selected={ativo === t.id}
          onClick={() => onChange(t.id)}
          className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
            ativo === t.id ? 'bg-brand text-bg' : 'text-muted hover:text-ink'
          }`}
        >
          <Icon name={t.icon} size={15} />
          {t.label}
        </button>
      ))}
    </div>
  )
}

const ACAO =
  'inline-flex h-9 items-center justify-center gap-1.5 rounded-lg px-3 text-xs font-semibold whitespace-nowrap transition-colors'

/**
 * Uma linha da tabela. Formatos diretos abrem na hora numa aba nova (player do
 * Chrome → ⋮ → Baixar). Formatos com `processo` (HD, MP3) são preparados no
 * navegador primeiro: a linha mostra o progresso e, no fim, oferece Abrir
 * (o mesmo player) e Salvar (já com o nome do vídeo).
 */
function Linha({ formato, titulo }) {
  const [estado, setEstado] = useState({ fase: 'parado' })
  const cancelar = useRef(null)
  const blobUrl = estado.fase === 'pronto' ? estado.url : null

  // Solta a memória do arquivo pronto quando a linha some.
  useEffect(() => () => blobUrl && URL.revokeObjectURL(blobUrl), [blobUrl])
  useEffect(() => () => cancelar.current?.abort(), [])

  const preparar = async () => {
    const controle = new AbortController()
    cancelar.current = controle
    setEstado({ fase: 'preparando', etapa: 'baixando', valor: 0 })
    try {
      const blob = await processar(
        formato.processo,
        { extensao: formato.extensao, titulo },
        ({ etapa, valor }) => setEstado({ fase: 'preparando', etapa, valor }),
        controle.signal,
      )
      setEstado({ fase: 'pronto', url: URL.createObjectURL(blob), tamanho: blob.size })
    } catch (erro) {
      if (!controle.signal.aborted) console.error('Falha ao preparar o arquivo:', erro)
      setEstado(controle.signal.aborted ? { fase: 'parado' } : { fase: 'erro' })
    }
  }

  // Pronto, vale o tamanho real do arquivo preparado.
  const tamanho = formatBytes(estado.fase === 'pronto' ? estado.tamanho : formato.tamanho)
  const estimado = formato.tamanhoEstimado && estado.fase !== 'pronto'
  const nome = nomeArquivo(titulo, formato.extensao)

  let acao
  if (formato.indisponivel) {
    acao = <span className="text-xs text-faint">Grande demais</span>
  } else if (formato.url) {
    acao = (
      <a href={formato.url} target="_blank" rel="noopener noreferrer" className={`${ACAO} bg-success/12 text-success hover:bg-success hover:text-bg`}>
        <Icon name="download" size={14} />
        Baixar
      </a>
    )
  } else if (estado.fase === 'preparando') {
    acao = (
      <div className="flex w-full min-w-[9rem] items-center gap-2">
        <div className="min-w-0 flex-1">
          <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
            <div
              className={`h-full rounded-full transition-[width] duration-300 ${estado.etapa === 'baixando' ? 'bg-info' : 'bg-success'}`}
              style={{ width: `${Math.round(estado.valor * 100)}%` }}
            />
          </div>
          <p className="mt-1 text-[0.68rem] text-faint tabular-nums">
            {estado.etapa === 'baixando' ? 'Baixando' : 'Convertendo'} {Math.round(estado.valor * 100)}%
          </p>
        </div>
        <button
          type="button"
          onClick={() => cancelar.current?.abort()}
          className="grid size-7 shrink-0 place-items-center rounded-md text-faint hover:bg-white/[0.06] hover:text-ink"
          aria-label="Cancelar"
        >
          <Icon name="close" size={13} />
        </button>
      </div>
    )
  } else if (estado.fase === 'pronto') {
    acao = (
      <div className="flex gap-1.5">
        <a href={estado.url} target="_blank" rel="noopener noreferrer" className={`${ACAO} border border-white/12 text-ink hover:border-white/30`}>
          <Icon name="play" size={12} />
          Abrir
        </a>
        <a href={estado.url} download={nome} className={`${ACAO} bg-success text-bg hover:brightness-95`}>
          <Icon name="download" size={14} />
          Salvar
        </a>
      </div>
    )
  } else {
    acao = (
      <button type="button" onClick={preparar} className={`${ACAO} ${estado.fase === 'erro' ? 'bg-danger/12 text-danger hover:bg-danger hover:text-bg' : 'bg-success/12 text-success hover:bg-success hover:text-bg'}`}>
        <Icon name={estado.fase === 'erro' ? 'alert' : 'download'} size={14} />
        {estado.fase === 'erro' ? 'Tentar de novo' : 'Baixar'}
      </button>
    )
  }

  return (
    <tr className="border-t border-white/6">
      <td className="py-3 pr-3">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-semibold text-ink">
          {formato.rotulo}
          {formato.recomendado ? (
            <span className="rounded-md border border-success/30 bg-success/10 px-1.5 py-0.5 text-[0.6rem] font-bold tracking-wide text-success uppercase">
              Recomendado
            </span>
          ) : null}
        </span>
        {formato.detalhe ? <span className="block text-xs text-faint">{formato.detalhe}</span> : null}
      </td>
      <td className="py-3 pr-3">
        <span className="rounded-md bg-white/[0.05] px-2 py-1 text-[0.66rem] font-bold tracking-wide text-accent uppercase">
          {formato.extensao}
        </span>
      </td>
      <td className="py-3 pr-3 text-sm whitespace-nowrap text-muted tabular-nums">
        {tamanho ? `${estimado ? '≈ ' : ''}${tamanho}` : '—'}
      </td>
      <td className="py-3 text-right">
        <div className="flex justify-end">{acao}</div>
      </td>
    </tr>
  )
}

/**
 * Tabela de downloads de um tipo (vídeo ou áudio). O painel monta as duas e
 * só esconde a inativa: trocar de aba não perde um arquivo já preparado.
 */
export function DownloadTable({ formatos, tipo, titulo }) {
  const visiveis = formatos.filter((f) => f.tipo === tipo)
  const temProcesso = visiveis.some((f) => f.processo)

  return (
    <div>
      <table className="w-full border-collapse text-left">
        <thead>
          <tr className="text-[0.66rem] font-semibold tracking-[0.14em] text-faint uppercase">
            <th className="pr-3 pb-2 font-semibold">Qualidade</th>
            <th className="pr-3 pb-2 font-semibold">Formato</th>
            <th className="pr-3 pb-2 font-semibold">Tamanho</th>
            <th className="pb-2 text-right font-semibold">
              <span className="sr-only">Ação</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {visiveis.map((formato) => (
            <Linha key={formato.id} formato={formato} titulo={titulo} />
          ))}
        </tbody>
      </table>

      <p className="mt-4 flex items-start gap-2 text-xs leading-relaxed text-faint">
        <Icon name="more" size={14} className="mt-0.5 shrink-0" />
        <span>
          {downloadTip}
          {temProcesso ? ' Alguns formatos (como o MP3 e o vídeo HD) são preparados no seu navegador antes — de alguns segundos a alguns minutos.' : ''}
        </span>
      </p>
    </div>
  )
}
