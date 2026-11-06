import { useState } from 'react'
import { Resultados } from '../../componentes/ferramenta/Resultados'
import { SeletorArquivos } from '../../componentes/ferramenta/SeletorArquivos'
import { Aviso, BotaoLink, Botao, Caixa, Progresso } from '../../componentes/ui'
import { LIMITE_PDF, abrirLeitura, extrairTexto } from '../../motores/pdf'
import { semExtensao } from '../../nucleo/arquivos'
import { useTarefa } from '../../nucleo/tarefa'

/** Extrai o texto de um PDF: mostra para copiar e gera um .txt. */
export default function ParaTexto() {
  const [arquivos, setArquivos] = useState([])
  const [separar, setSeparar] = useState(true)
  const [copiado, setCopiado] = useState(false)
  const tarefa = useTarefa()

  const extrair = () =>
    tarefa.executar(async ({ progresso, sinal }) => {
      const doc = await abrirLeitura(arquivos[0].arquivo)
      try {
        const paginas = await extrairTexto(doc, (v) => progresso(v, 'Lendo as páginas'), sinal)
        const texto = separar ? paginas.map((p, i) => `--- Página ${i + 1} ---\n${p}`).join('\n\n') : paginas.join('\n\n')
        const vazio = !paginas.join('').trim()
        return { texto, vazio, paginas: paginas.length }
      } finally {
        doc.destroy()
      }
    }, 'Lendo as páginas')

  if (tarefa.fase === 'pronto') {
    const r = tarefa.resultado
    const nome = `${semExtensao(arquivos[0].arquivo.name)}.txt`
    const palavras = r.texto.split(/\s+/).filter(Boolean).length
    return (
      <div className="flex flex-col gap-5">
        {r.vazio ? (
          <Aviso tom="alerta" titulo="Nenhum texto encontrado" acao={<BotaoLink para="/pdf/ocr" variante="secundario" tamanho="p" icone="ocr">Usar OCR</BotaoLink>}>
            Este PDF parece ser digitalizado (as páginas são imagens). Use o OCR para reconhecer o texto.
          </Aviso>
        ) : null}
        <Resultados
          itens={[{ nome, blob: new Blob([r.texto], { type: 'text/plain;charset=utf-8' }), detalhe: `${r.paginas} páginas · ${palavras.toLocaleString('pt-BR')} palavras` }]}
          duracao={tarefa.duracao}
          aoAjustar={tarefa.reiniciar}
          aoReiniciar={() => {
            setArquivos([])
            tarefa.reiniciar()
          }}
          extra={
            r.vazio ? null : (
              <div className="border-b border-borda p-4 sm:p-5">
                <div className="mb-2 flex justify-end">
                  <Botao
                    variante="secundario"
                    tamanho="p"
                    icone={copiado ? 'check' : 'copiar'}
                    onClick={async () => {
                      await navigator.clipboard.writeText(r.texto)
                      setCopiado(true)
                      setTimeout(() => setCopiado(false), 1500)
                    }}
                  >
                    {copiado ? 'Copiado' : 'Copiar texto'}
                  </Botao>
                </div>
                <pre className="max-h-96 overflow-auto rounded-lg bg-fundo-suave p-4 font-mono text-xs leading-relaxed whitespace-pre-wrap text-texto">{r.texto.slice(0, 200_000)}</pre>
              </div>
            )
          }
        />
      </div>
    )
  }

  const processando = tarefa.fase === 'processando'
  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
      <SeletorArquivos arquivos={arquivos} aoMudar={setArquivos} extensoes={['pdf']} descricaoFormatos="PDF" multiplos={false} limiteBytes={LIMITE_PDF} />
      <aside className="cartao flex flex-col gap-5 p-4 sm:p-5">
        <Caixa rotulo="Separar por página" dica="Insere “--- Página N ---” antes de cada página." marcado={separar} aoMudar={setSeparar} />
        {tarefa.fase === 'erro' ? <Aviso tom="erro">{tarefa.mensagem}</Aviso> : null}
        {processando ? (
          <Progresso valor={tarefa.progresso} rotulo={tarefa.rotulo} aoCancelar={tarefa.cancelar} />
        ) : (
          <Botao tamanho="g" icone="texto" onClick={extrair} disabled={!arquivos.length}>
            Extrair texto
          </Botao>
        )}
      </aside>
    </div>
  )
}
