import { useEffect, useMemo, useState } from 'react'
import { Resultados } from '../../componentes/ferramenta/Resultados'
import { SeletorArquivos } from '../../componentes/ferramenta/SeletorArquivos'
import { Aviso, Botao, Caixa, Deslizante, Grupo, Progresso } from '../../componentes/ui'
import { DESCRICAO_IMAGEM, EXTENSOES_IMAGEM, LIMITE_IMAGEM, formatoOriginal, processarLote } from '../../motores/imagem'
import { filtroCss } from '../../motores/imagem/nucleo'
import { useTarefa } from '../../nucleo/tarefa'
import { EscolhaFormato, Qualidade } from './_comum'

const NEUTRO = { brilho: 100, contraste: 100, saturacao: 100, matiz: 0, cinza: 0, sepia: 0, inverter: false, desfoque: 0 }

const FILTROS = [
  { id: 'original', nome: 'Original', ajustes: NEUTRO },
  { id: 'pb', nome: 'Preto e branco', ajustes: { ...NEUTRO, cinza: 100, contraste: 110 } },
  { id: 'sepia', nome: 'Sépia', ajustes: { ...NEUTRO, sepia: 80, contraste: 95 } },
  { id: 'vintage', nome: 'Vintage', ajustes: { ...NEUTRO, sepia: 35, saturacao: 80, contraste: 90, brilho: 105 } },
  { id: 'vivido', nome: 'Vívido', ajustes: { ...NEUTRO, saturacao: 145, contraste: 112 } },
  { id: 'suave', nome: 'Suave', ajustes: { ...NEUTRO, saturacao: 75, contraste: 88, brilho: 106 } },
  { id: 'frio', nome: 'Frio', ajustes: { ...NEUTRO, matiz: 12, saturacao: 90, brilho: 102 } },
  { id: 'quente', nome: 'Quente', ajustes: { ...NEUTRO, sepia: 22, saturacao: 115 } },
  { id: 'dramatico', nome: 'Dramático', ajustes: { ...NEUTRO, contraste: 140, saturacao: 85, brilho: 95 } },
]

function useUrl(arquivo) {
  const url = useMemo(() => (arquivo ? URL.createObjectURL(arquivo) : null), [arquivo])
  useEffect(() => () => url && URL.revokeObjectURL(url), [url])
  return url
}

/**
 * Ajustes de cor com prévia ao vivo: a prévia usa filtros CSS e o arquivo
 * final é gerado no worker com a MESMA matemática (ver nucleo.js), então o
 * que se vê é o que se baixa. Vale para um lote inteiro.
 */
export default function Ajustar() {
  const [arquivos, setArquivos] = useState([])
  const [selecionado, setSelecionado] = useState(0)
  const [ajustes, setAjustes] = useState(NEUTRO)
  const [saida, setSaida] = useState({ formato: 'original', qualidade: 90 })
  const [comparar, setComparar] = useState(false)
  const [lado, setLado] = useState(1000)
  const tarefa = useTarefa()

  const atual = arquivos[Math.min(selecionado, arquivos.length - 1)]?.arquivo
  const url = useUrl(atual)
  const mudar = (chave) => (valor) => setAjustes((a) => ({ ...a, [chave]: valor }))
  const alterado = JSON.stringify(ajustes) !== JSON.stringify(NEUTRO)

  if (tarefa.fase === 'pronto') {
    return (
      <Resultados
        itens={tarefa.resultado}
        duracao={tarefa.duracao}
        nomeZip="imagens-ajustadas.zip"
        aoAjustar={tarefa.reiniciar}
        aoReiniciar={() => {
          setArquivos([])
          tarefa.reiniciar()
        }}
      />
    )
  }

  if (!arquivos.length) {
    return <SeletorArquivos arquivos={arquivos} aoMudar={setArquivos} extensoes={EXTENSOES_IMAGEM} descricaoFormatos={DESCRICAO_IMAGEM} limiteBytes={LIMITE_IMAGEM} aceitarColar />
  }

  const processando = tarefa.fase === 'processando'
  const aplicar = () =>
    tarefa.executar(
      (ctx) =>
        processarLote(
          arquivos,
          async (item) => {
            const formato = saida.formato === 'original' ? await formatoOriginal(item.arquivo) : saida.formato
            return { ajustes, saida: { formato, qualidade: saida.qualidade } }
          },
          { ...ctx, rotulo: 'Aplicando ajustes' },
        ),
      'Aplicando ajustes',
    )

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
      <div className="flex min-w-0 flex-col gap-3">
        <div className="xadrez relative grid min-h-72 place-items-center overflow-hidden rounded-[var(--radius-cartao)] border border-borda p-3">
          {url ? (
            <img
              src={url}
              alt="Prévia com os ajustes"
              // O desfoque é relativo ao maior lado: na prévia, ao tamanho exibido.
              onLoad={(e) => setLado(Math.max(e.currentTarget.clientWidth, e.currentTarget.clientHeight))}
              className="max-h-[60vh] max-w-full object-contain"
              style={{ filter: comparar ? 'none' : filtroCss(ajustes, lado) }}
            />
          ) : null}
          <button
            type="button"
            onPointerDown={() => setComparar(true)}
            onPointerUp={() => setComparar(false)}
            onPointerLeave={() => setComparar(false)}
            onKeyDown={(e) => e.key === ' ' && setComparar(true)}
            onKeyUp={() => setComparar(false)}
            className="absolute right-3 bottom-3 rounded-lg border border-borda bg-superficie/90 px-3 py-1.5 text-xs font-semibold text-tinta shadow-[var(--shadow-cartao)] backdrop-blur"
          >
            {comparar ? 'Original' : 'Segure para comparar'}
          </button>
        </div>
        {arquivos.length > 1 ? (
          <ul className="flex gap-2 overflow-x-auto pb-1" aria-label="Imagens do lote">
            {arquivos.map((a, i) => (
              <li key={a.id}>
                <Miniatura arquivo={a.arquivo} ativo={a.arquivo === atual} aoEscolher={() => setSelecionado(i)} />
              </li>
            ))}
          </ul>
        ) : null}
        <div className={processando ? 'pointer-events-none opacity-60' : ''}>
          <SeletorArquivos arquivos={arquivos} aoMudar={setArquivos} extensoes={EXTENSOES_IMAGEM} descricaoFormatos={DESCRICAO_IMAGEM} limiteBytes={LIMITE_IMAGEM} />
        </div>
      </div>

      <aside className="cartao flex flex-col gap-5 p-4 sm:p-5 lg:sticky lg:top-20">
        <div className={processando ? 'pointer-events-none opacity-60' : ''}>
          <Grupo titulo="Filtros">
            <div className="grid grid-cols-3 gap-1.5">
              {FILTROS.map((f) => {
                const ativo = JSON.stringify(f.ajustes) === JSON.stringify(ajustes)
                return (
                  <button
                    key={f.id}
                    type="button"
                    aria-pressed={ativo}
                    onClick={() => setAjustes(f.ajustes)}
                    className={`rounded-lg border px-2 py-2 text-xs font-semibold transition-colors ${ativo ? 'border-marca bg-marca text-sobre-marca' : 'border-borda text-suave hover:border-borda-forte hover:text-tinta'}`}
                  >
                    {f.nome}
                  </button>
                )
              })}
            </div>
          </Grupo>
          <Grupo titulo="Ajustes" className="mt-6">
            <div className="flex flex-col gap-4">
              <Deslizante rotulo="Brilho" valor={ajustes.brilho} aoMudar={mudar('brilho')} min={0} max={200} formatar={(v) => `${v - 100 > 0 ? '+' : ''}${v - 100}`} />
              <Deslizante rotulo="Contraste" valor={ajustes.contraste} aoMudar={mudar('contraste')} min={0} max={200} formatar={(v) => `${v - 100 > 0 ? '+' : ''}${v - 100}`} />
              <Deslizante rotulo="Saturação" valor={ajustes.saturacao} aoMudar={mudar('saturacao')} min={0} max={200} formatar={(v) => `${v - 100 > 0 ? '+' : ''}${v - 100}`} />
              <Deslizante rotulo="Matiz" valor={ajustes.matiz} aoMudar={mudar('matiz')} min={-180} max={180} formatar={(v) => `${v}°`} />
              <Deslizante rotulo="Sépia" valor={ajustes.sepia} aoMudar={mudar('sepia')} formatar={(v) => `${v}%`} />
              <Deslizante rotulo="Preto e branco" valor={ajustes.cinza} aoMudar={mudar('cinza')} formatar={(v) => `${v}%`} />
              <Deslizante rotulo="Desfoque" valor={ajustes.desfoque} aoMudar={mudar('desfoque')} min={0} max={20} passo={0.5} formatar={(v) => (v ? v.toLocaleString('pt-BR') : '0')} />
              <Caixa rotulo="Inverter cores (negativo)" marcado={ajustes.inverter} aoMudar={mudar('inverter')} />
            </div>
          </Grupo>
          <Grupo titulo="Arquivo" className="mt-6">
            <div className="flex flex-col gap-4">
              <EscolhaFormato valor={saida.formato} aoMudar={(v) => setSaida((s) => ({ ...s, formato: v }))} comOriginal />
              <Qualidade valor={saida.qualidade} aoMudar={(v) => setSaida((s) => ({ ...s, qualidade: v }))} formato={saida.formato} />
            </div>
          </Grupo>
        </div>
        {tarefa.fase === 'erro' ? <Aviso tom="erro">{tarefa.mensagem}</Aviso> : null}
        {processando ? (
          <Progresso valor={tarefa.progresso} rotulo={tarefa.rotulo} aoCancelar={tarefa.cancelar} />
        ) : (
          <div className="flex gap-2">
            <Botao variante="secundario" tamanho="g" onClick={() => setAjustes(NEUTRO)} disabled={!alterado}>
              Zerar
            </Botao>
            <Botao tamanho="g" className="flex-1" icone="seta" onClick={aplicar} disabled={!alterado}>
              Aplicar{arquivos.length > 1 ? ` em ${arquivos.length}` : ''}
            </Botao>
          </div>
        )}
      </aside>
    </div>
  )
}

function Miniatura({ arquivo, ativo, aoEscolher }) {
  const url = useUrl(arquivo)
  return (
    <button
      type="button"
      onClick={aoEscolher}
      aria-pressed={ativo}
      aria-label={arquivo.name}
      className={`block size-16 overflow-hidden rounded-lg border-2 ${ativo ? 'border-acento' : 'border-transparent opacity-70 hover:opacity-100'}`}
    >
      {url ? <img src={url} alt="" className="size-full object-cover" /> : null}
    </button>
  )
}
