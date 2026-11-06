import { useEffect, useMemo, useState } from 'react'
import { SeletorArquivos } from '../../componentes/ferramenta/SeletorArquivos'
import { Icone } from '../../componentes/Icone'
import { Aviso, BotaoLink, Botao } from '../../componentes/ui'
import { DESCRICAO_IMAGEM, EXTENSOES_IMAGEM, dimensoes } from '../../motores/imagem'
import { lerMetadados } from '../../motores/imagem/metadados'
import { detectarTipo, formatarBytes } from '../../nucleo/arquivos'

function mdc(a, b) {
  return b ? mdc(b, a % b) : a
}

function Tabela({ titulo, itens }) {
  return (
    <section className="cartao overflow-hidden">
      <h2 className="border-b border-borda bg-fundo-suave px-4 py-2.5 font-sans text-xs font-semibold tracking-wide text-fraca uppercase">{titulo}</h2>
      <dl className="divide-y divide-borda">
        {itens.map(([rotulo, valor]) => (
          <div key={rotulo} className="grid grid-cols-[9rem_minmax(0,1fr)] gap-3 px-4 py-2.5 text-sm">
            <dt className="text-suave">{rotulo}</dt>
            <dd className="font-medium [overflow-wrap:anywhere] text-tinta">{valor}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

function Painel({ arquivo, aoTrocar }) {
  const url = useMemo(() => URL.createObjectURL(arquivo), [arquivo])
  useEffect(() => () => URL.revokeObjectURL(url), [url])
  const [info, setInfo] = useState(null)
  const [erro, setErro] = useState(false)

  useEffect(() => {
    let vivo = true
    ;(async () => {
      try {
        const [tipo, dim, meta] = await Promise.all([detectarTipo(arquivo), dimensoes(arquivo), lerMetadados(arquivo)])
        if (vivo) setInfo({ tipo, dim, meta })
      } catch (e) {
        console.error(e)
        if (vivo) setErro(true)
      }
    })()
    return () => {
      vivo = false
    }
  }, [arquivo])

  if (erro) return <Aviso tom="erro" titulo="Não foi possível ler esta imagem" acao={<Botao variante="secundario" tamanho="p" onClick={aoTrocar}>Escolher outra</Botao>} />

  const basico = info
    ? [
        ['Arquivo', arquivo.name],
        ['Formato', `${info.tipo?.ext?.toUpperCase() ?? '—'} (${info.tipo?.mime ?? arquivo.type ?? 'desconhecido'})`],
        ['Tamanho', `${formatarBytes(arquivo.size)} (${arquivo.size.toLocaleString('pt-BR')} bytes)`],
        ['Dimensões', `${Math.round(info.dim.largura)} × ${Math.round(info.dim.altura)} px`],
        ['Megapixels', ((info.dim.largura * info.dim.altura) / 1e6).toLocaleString('pt-BR', { maximumFractionDigits: 1 })],
        ['Proporção', (() => {
          const w = Math.round(info.dim.largura)
          const h = Math.round(info.dim.altura)
          const d = mdc(w, h)
          return w / d <= 50 ? `${w / d}:${h / d}` : (w / h).toLocaleString('pt-BR', { maximumFractionDigits: 3 })
        })()],
        ['Modificado em', new Date(arquivo.lastModified).toLocaleString('pt-BR')],
      ]
    : null

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:items-start">
      <div className="flex flex-col gap-3 lg:sticky lg:top-20">
        <div className="xadrez grid min-h-64 place-items-center overflow-hidden rounded-[var(--radius-cartao)] border border-borda p-3">
          <img src={url} alt={arquivo.name} className="max-h-[60vh] max-w-full object-contain" />
        </div>
        <Botao variante="secundario" icone="refazer" onClick={aoTrocar} className="self-start">
          Outra imagem
        </Botao>
      </div>
      <div className="flex flex-col gap-4">
        {!info ? (
          <div className="esqueleto h-72 rounded-[var(--radius-cartao)]" />
        ) : (
          <>
            <Tabela titulo="Arquivo" itens={basico} />
            {info.meta.gps ? (
              <Aviso
                tom="alerta"
                titulo="Esta foto revela onde foi tirada"
                acao={
                  <div className="flex flex-wrap gap-2">
                    <BotaoLink href={`https://www.openstreetmap.org/?mlat=${info.meta.gps.lat}&mlon=${info.meta.gps.lon}#map=16/${info.meta.gps.lat}/${info.meta.gps.lon}`} target="_blank" rel="noopener noreferrer" variante="secundario" tamanho="p" icone="externo">
                      Ver no mapa
                    </BotaoLink>
                    <BotaoLink para="/imagem/remover-metadados" variante="secundario" tamanho="p" icone="borracha">
                      Remover metadados
                    </BotaoLink>
                  </div>
                }
              >
                Quem receber o arquivo original pode ver as coordenadas GPS. Remova os metadados antes de compartilhar.
              </Aviso>
            ) : null}
            {info.meta.grupos.map((g) => (
              <Tabela key={g.titulo} titulo={g.titulo} itens={g.itens} />
            ))}
            {!info.meta.total ? (
              <p className="flex items-center gap-2 text-sm text-suave">
                <Icone nome="info" tamanho={16} />
                Nenhum metadado EXIF, XMP ou IPTC encontrado.
              </p>
            ) : null}
          </>
        )}
      </div>
    </div>
  )
}

export default function Informacoes() {
  const [arquivos, setArquivos] = useState([])
  if (!arquivos.length) {
    return <SeletorArquivos arquivos={arquivos} aoMudar={setArquivos} multiplos={false} extensoes={EXTENSOES_IMAGEM} descricaoFormatos={DESCRICAO_IMAGEM} aceitarColar />
  }
  return <Painel key={arquivos[0].id} arquivo={arquivos[0].arquivo} aoTrocar={() => setArquivos([])} />
}
