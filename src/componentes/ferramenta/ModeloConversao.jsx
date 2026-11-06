import { useState } from 'react'
import { useTarefa } from '../../nucleo/tarefa'
import { Aviso, Botao, Progresso } from '../ui'
import { Resultados } from './Resultados'
import { SeletorArquivos } from './SeletorArquivos'

/**
 * Modelo das ferramentas "arquivos entram → arquivos saem", o padrão de toda
 * a plataforma:
 *   1. área para escolher/arrastar arquivos;
 *   2. configurações da ferramenta (ao lado no desktop, abaixo no celular);
 *   3. botão de ação → progresso com cancelar;
 *   4. resultado com prévia e download (um a um ou ZIP);
 *   5. "Nova operação" ou "Ajustar e refazer" (mantém os arquivos).
 *
 * `processar(itens, opcoes, { progresso, sinal })` devolve
 * [{ nome, blob, original?, detalhe? }].
 */
export function ModeloConversao({
  extensoes,
  descricaoFormatos,
  multiplos = true,
  limiteBytes,
  maximo,
  ordenavel,
  aceitarColar,
  pastas,
  minimoArquivos = 1,
  opcoesIniciais = {},
  Configuracoes,
  processar,
  rotuloAcao = 'Converter',
  rotuloProcessando = 'Processando',
  validarOpcoes,
  aviso,
  nomeZip,
}) {
  const [arquivos, setArquivos] = useState([])
  const [opcoes, setOpcoes] = useState(opcoesIniciais)
  const tarefa = useTarefa()

  const mudarOpcao = (chave, valor) => setOpcoes((o) => ({ ...o, [chave]: valor }))
  const problema = arquivos.length >= minimoArquivos ? validarOpcoes?.(opcoes, arquivos) : null
  const pronto = arquivos.length >= minimoArquivos && !problema

  const iniciar = () =>
    tarefa.executar((ctx) => processar(arquivos, opcoes, ctx), rotuloProcessando)

  if (tarefa.fase === 'pronto') {
    return (
      <Resultados
        itens={tarefa.resultado}
        duracao={tarefa.duracao}
        nomeZip={nomeZip}
        aoAjustar={() => tarefa.reiniciar()}
        aoReiniciar={() => {
          setArquivos([])
          tarefa.reiniciar()
        }}
      />
    )
  }

  const processando = tarefa.fase === 'processando'
  const temConfig = Boolean(Configuracoes)

  return (
    <div className={`grid gap-5 ${temConfig ? 'lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start' : ''}`}>
      <div className={processando ? 'pointer-events-none opacity-60' : ''} inert={processando ? true : undefined}>
        <SeletorArquivos
          arquivos={arquivos}
          aoMudar={setArquivos}
          extensoes={extensoes}
          descricaoFormatos={descricaoFormatos}
          multiplos={multiplos}
          limiteBytes={limiteBytes}
          maximo={maximo}
          ordenavel={ordenavel}
          aceitarColar={aceitarColar}
          pastas={pastas}
        />
      </div>

      <aside className={`cartao flex flex-col gap-5 p-4 sm:p-5 ${temConfig ? 'lg:sticky lg:top-20' : ''}`}>
        {temConfig ? (
          <div className={processando ? 'pointer-events-none opacity-60' : ''} inert={processando ? true : undefined}>
            <Configuracoes opcoes={opcoes} mudar={mudarOpcao} definir={setOpcoes} arquivos={arquivos} />
          </div>
        ) : null}

        {aviso ? <Aviso tom="info">{aviso}</Aviso> : null}
        {problema && !processando ? <Aviso tom="alerta">{problema}</Aviso> : null}
        {tarefa.fase === 'erro' ? (
          <Aviso tom="erro" titulo="Não deu certo">
            {tarefa.mensagem}
          </Aviso>
        ) : null}

        {processando ? (
          <Progresso valor={tarefa.progresso} rotulo={tarefa.rotulo} aoCancelar={tarefa.cancelar} />
        ) : (
          <Botao tamanho="g" className="w-full" icone="seta" onClick={iniciar} disabled={!pronto}>
            {rotuloAcao}
            {arquivos.length > 1 ? ` ${arquivos.length} arquivos` : ''}
          </Botao>
        )}
        {!arquivos.length && !processando ? (
          <p className="-mt-2 text-center text-xs text-fraca">
            {minimoArquivos > 1 ? `Adicione pelo menos ${minimoArquivos} arquivos para começar.` : 'Adicione um arquivo para começar.'}
          </p>
        ) : null}
      </aside>
    </div>
  )
}
