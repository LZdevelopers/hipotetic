import { useEffect, useMemo, useState } from 'react'
import { Resultados } from '../../componentes/ferramenta/Resultados'
import { SeletorArquivos } from '../../componentes/ferramenta/SeletorArquivos'
import { Icone } from '../../componentes/Icone'
import { Aviso, BotaoLink, Botao, Progresso } from '../../componentes/ui'
import { DESCRICAO_IMAGEM, EXTENSOES_IMAGEM, dimensoes } from '../../motores/imagem'
import { lerMetadados, removerMetadados } from '../../motores/imagem/metadados'
import { detectarTipo, formatarBytes } from '../../nucleo/arquivos'
import { ErroAmigavel, cancelado, useTarefa } from '../../nucleo/tarefa'

const mdc = (a, b) => (b ? mdc(b, a % b) : a)

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

function Informacoes({ arquivo }) {
  const url = useMemo(() => URL.createObjectURL(arquivo), [arquivo])
  useEffect(() => () => URL.revokeObjectURL(url), [url])
  const [info, setInfo] = useState(null)
  const [erro, setErro] = useState(false)

  useEffect(() => {
    let vivo = true
    setInfo(null)
    Promise.all([detectarTipo(arquivo), dimensoes(arquivo), lerMetadados(arquivo)])
      .then(([tipo, dim, meta]) => vivo && setInfo({ tipo, dim, meta }))
      .catch(() => vivo && setErro(true))
    return () => {
      vivo = false
    }
  }, [arquivo])

  if (erro) return <Aviso tom="erro">Não foi possível ler esta imagem.</Aviso>
  if (!info) return <div className="esqueleto h-72 rounded-[var(--radius-cartao)]" />

  const w = Math.round(info.dim.largura)
  const h = Math.round(info.dim.altura)
  const d = mdc(w, h)
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:items-start">
      <div className="xadrez grid min-h-56 place-items-center overflow-hidden rounded-[var(--radius-cartao)] border border-borda p-3">
        <img src={url} alt={arquivo.name} className="max-h-[50vh] max-w-full object-contain" />
      </div>
      <div className="flex flex-col gap-4">
        <Tabela
          titulo="Arquivo"
          itens={[
            ['Arquivo', arquivo.name],
            ['Formato', `${info.tipo?.ext?.toUpperCase() ?? '—'} (${info.tipo?.mime ?? 'desconhecido'})`],
            ['Tamanho', formatarBytes(arquivo.size)],
            ['Dimensões', `${w} × ${h} px · ${((w * h) / 1e6).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} MP`],
            ['Proporção', w / d <= 50 ? `${w / d}:${h / d}` : (w / h).toLocaleString('pt-BR', { maximumFractionDigits: 3 })],
          ]}
        />
        {info.meta.gps ? (
          <Aviso
            tom="alerta"
            titulo="Esta foto revela onde foi tirada"
            acao={
              <BotaoLink href={`https://www.openstreetmap.org/?mlat=${info.meta.gps.lat}&mlon=${info.meta.gps.lon}#map=16/${info.meta.gps.lat}/${info.meta.gps.lon}`} target="_blank" rel="noopener noreferrer" variante="secundario" tamanho="p" icone="externo">
                Ver no mapa
              </BotaoLink>
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
      </div>
    </div>
  )
}

/**
 * Metadados de imagem: ver tudo (formato real, dimensões, EXIF, câmera, GPS)
 * e remover SEM recomprimir — a imagem fica idêntica, pixel por pixel.
 */
export default function MetadadosImagem() {
  const [arquivos, setArquivos] = useState([])
  const [selecionado, setSelecionado] = useState(0)
  const tarefa = useTarefa()

  if (tarefa.fase === 'pronto') {
    return (
      <Resultados
        itens={tarefa.resultado}
        duracao={tarefa.duracao}
        nomeZip="imagens-sem-metadados.zip"
        aoReiniciar={() => {
          setArquivos([])
          tarefa.reiniciar()
        }}
      />
    )
  }
  if (!arquivos.length) return <SeletorArquivos arquivos={arquivos} aoMudar={setArquivos} extensoes={EXTENSOES_IMAGEM} descricaoFormatos={DESCRICAO_IMAGEM} limiteBytes={100 * 1024 * 1024} aceitarColar />

  const atual = arquivos[Math.min(selecionado, arquivos.length - 1)].arquivo
  const remover = () =>
    tarefa.executar(async ({ progresso, sinal }) => {
      const saida = []
      for (let i = 0; i < arquivos.length; i += 1) {
        cancelado(sinal)
        const { arquivo } = arquivos[i]
        const tipo = (await detectarTipo(arquivo))?.ext
        if (!['jpg', 'jpeg', 'png', 'webp'].includes(tipo)) throw new ErroAmigavel(`“${arquivo.name}” é ${tipo?.toUpperCase() ?? 'de outro formato'}: a remoção sem perdas funciona em JPG, PNG e WebP. Para os outros, use o editor de imagem (salvar já tira os metadados).`)
        const r = await removerMetadados(arquivo, tipo === 'jpeg' ? 'jpg' : tipo).catch(() => {
          throw new ErroAmigavel(`Não foi possível ler “${arquivo.name}”: o arquivo parece corrompido.`)
        })
        saida.push({ nome: arquivo.name, blob: new Blob([r.dados], { type: r.mime }), original: arquivo.size, detalhe: r.removidos ? `${r.removidos} ${r.removidos === 1 ? 'bloco removido' : 'blocos removidos'}` : 'não tinha metadados' })
        progresso((i + 1) / arquivos.length, `Limpando (${i + 1} de ${arquivos.length})`)
      }
      return saida
    }, 'Limpando')

  return (
    <div className="flex flex-col gap-5">
      <div className="cartao flex flex-wrap items-center gap-3 p-3">
        {arquivos.length > 1 ? (
          <label className="flex min-w-0 flex-1 items-center gap-2 text-sm text-suave">
            Ver:
            <select value={selecionado} onChange={(e) => setSelecionado(Number(e.target.value))} className="h-9 min-w-0 flex-1 rounded-lg border border-borda-forte bg-superficie px-2 text-sm text-tinta">
              {arquivos.map((a, i) => (
                <option key={a.id} value={i}>
                  {a.arquivo.name}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <p className="min-w-0 flex-1 truncate text-sm font-semibold text-tinta">{atual.name}</p>
        )}
        {tarefa.fase === 'processando' ? (
          <div className="w-64">
            <Progresso valor={tarefa.progresso} rotulo={tarefa.rotulo} />
          </div>
        ) : (
          <>
            <Botao variante="secundario" tamanho="p" onClick={() => setArquivos([])}>
              Trocar
            </Botao>
            <Botao tamanho="p" icone="borracha" onClick={remover}>
              Remover metadados{arquivos.length > 1 ? ` de ${arquivos.length}` : ''}
            </Botao>
          </>
        )}
      </div>
      {tarefa.fase === 'erro' ? <Aviso tom="erro">{tarefa.mensagem}</Aviso> : null}
      <Informacoes key={atual.name + atual.size} arquivo={atual} />
    </div>
  )
}
