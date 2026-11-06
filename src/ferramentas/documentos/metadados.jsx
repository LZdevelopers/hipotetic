import { useEffect, useState } from 'react'
import { Resultados } from '../../componentes/ferramenta/Resultados'
import { SeletorArquivos } from '../../componentes/ferramenta/SeletorArquivos'
import { Icone } from '../../componentes/Icone'
import { Aviso, Botao, Progresso } from '../../componentes/ui'
import { lerMetadadosDocumento, removerMetadadosDocumento } from '../../motores/documentos'
import { formatarBytes, trocarExtensao } from '../../nucleo/arquivos'
import { useTarefa } from '../../nucleo/tarefa'

function Painel({ arquivo, aoTrocar }) {
  const [info, setInfo] = useState(null)
  const [erro, setErro] = useState(null)
  const tarefa = useTarefa()

  useEffect(() => {
    let vivo = true
    lerMetadadosDocumento(arquivo)
      .then((i) => vivo && setInfo(i))
      .catch((e) => vivo && setErro(e?.mensagem ?? 'Não foi possível ler este documento.'))
    return () => {
      vivo = false
    }
  }, [arquivo])

  if (erro) return <Aviso tom="erro" titulo={erro} acao={<Botao variante="secundario" tamanho="p" onClick={aoTrocar}>Escolher outro</Botao>} />
  if (tarefa.fase === 'pronto') return <Resultados itens={tarefa.resultado} aoAjustar={tarefa.reiniciar} aoReiniciar={aoTrocar} rotuloNovo="Outro documento" />
  if (!info) return <div className="esqueleto h-64 rounded-[var(--radius-cartao)]" />

  const remover = () =>
    tarefa.executar(async () => [{ nome: trocarExtensao(arquivo.name, info.tipo, '-sem-metadados'), blob: await removerMetadadosDocumento(arquivo), original: arquivo.size, detalhe: 'conteúdo intacto' }], 'Limpando')

  const pessoais = info.itens.filter((i) => /Autor|Modificado por|Empresa|Gerente/.test(i.rotulo))
  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
      <section className="cartao overflow-hidden" aria-label="Metadados">
        <h2 className="border-b border-borda bg-fundo-suave px-4 py-2.5 font-sans text-sm font-semibold text-tinta">
          {arquivo.name} <span className="font-normal text-fraca">· {info.tipo.toUpperCase()} · {formatarBytes(arquivo.size)}</span>
        </h2>
        {info.itens.length ? (
          <dl className="divide-y divide-borda">
            {info.itens.map((i) => (
              <div key={i.rotulo + i.valor} className="grid grid-cols-[10rem_minmax(0,1fr)] gap-3 px-4 py-2.5 text-sm">
                <dt className="text-suave">{i.rotulo}</dt>
                <dd className="font-medium [overflow-wrap:anywhere] text-tinta">{i.valor}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="flex items-center gap-2 p-4 text-sm text-suave">
            <Icone nome="info" tamanho={16} />
            Nenhum metadado encontrado.
          </p>
        )}
      </section>
      <aside className="cartao flex flex-col gap-4 p-4">
        {pessoais.length ? (
          <Aviso tom="alerta" titulo="Este documento identifica pessoas">
            {pessoais.map((p) => `${p.rotulo}: ${p.valor}`).join(' · ')}
          </Aviso>
        ) : null}
        {info.temPersonalizados ? <p className="text-xs text-fraca">Há também propriedades personalizadas, que serão removidas.</p> : null}
        {tarefa.fase === 'erro' ? <Aviso tom="erro">{tarefa.mensagem}</Aviso> : null}
        {tarefa.fase === 'processando' ? (
          <Progresso valor={null} rotulo="Limpando" />
        ) : (
          <>
            <Botao icone="borracha" onClick={remover}>
              Remover metadados
            </Botao>
            <Botao variante="secundario" onClick={aoTrocar}>
              Outro documento
            </Botao>
          </>
        )}
        <p className="text-xs text-fraca">Saem autor, empresa, datas, revisões e tempo de edição. O texto e a formatação ficam intactos.</p>
      </aside>
    </div>
  )
}

export default function MetadadosDocumento() {
  const [arquivos, setArquivos] = useState([])
  if (!arquivos.length) return <SeletorArquivos arquivos={arquivos} aoMudar={setArquivos} multiplos={false} extensoes={['docx', 'odt']} descricaoFormatos="DOCX ou ODT" limiteBytes={200 * 1024 * 1024} />
  return <Painel key={arquivos[0].id} arquivo={arquivos[0].arquivo} aoTrocar={() => setArquivos([])} />
}
