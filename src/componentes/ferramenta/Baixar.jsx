import { useEffect, useRef, useState } from 'react'
import { baixarBlob, extensaoDe, semExtensao } from '../../nucleo/arquivos'
import { Icone } from '../Icone'
import { Botao } from '../ui'

/*
 * Peças do "baixar" usadas em toda a plataforma:
 *   - NomeEditavel: clicar no nome do arquivo renomeia ali mesmo;
 *   - DialogoBaixar: o modal da hora de baixar (nome + opções do arquivo final);
 *   - OpcoesCartoes: escolha em cartões (formato, qualidade…) para o modal.
 */

/** Nome de arquivo sem caracteres que o sistema não aceita. */
export const limparNome = (nome) =>
  String(nome ?? '')
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120)

/** "foto.png" → ["foto", "png"]. */
export const partesDoNome = (nome) => {
  const ext = extensaoDe(nome)
  return [ext ? semExtensao(nome) : String(nome ?? ''), ext]
}

/**
 * Nome editável no lugar: mostra "nome.ext" com um lápis; ao clicar vira um
 * campo só para o nome (a extensão fica fixa). Enter confirma, Esc cancela.
 */
export function NomeEditavel({ nome, extensao, aoMudar, desativado = false, rotulo = 'Renomear o arquivo', className = '' }) {
  const [editando, setEditando] = useState(false)
  const [texto, setTexto] = useState(nome)
  const cancelado = useRef(false)
  const sufixo = extensao ? `.${extensao}` : ''

  if (editando) {
    return (
      <span className={`flex max-w-full min-w-0 items-center rounded-md border border-acento bg-superficie ${className}`}>
        <input
          // eslint-disable-next-line jsx-a11y/no-autofocus
          autoFocus
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onFocus={(e) => e.currentTarget.select()}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur()
            else if (e.key === 'Escape') {
              e.stopPropagation()
              cancelado.current = true
              e.currentTarget.blur()
            }
          }}
          onBlur={() => {
            const n = limparNome(texto)
            if (!cancelado.current && n && n !== nome) aoMudar(n)
            cancelado.current = false
            setEditando(false)
          }}
          aria-label="Nome do arquivo"
          spellCheck={false}
          className="h-7 min-w-0 flex-1 bg-transparent px-2 text-sm font-semibold text-tinta focus:outline-none"
        />
        {sufixo ? <span className="pr-2 text-sm text-fraca">{sufixo}</span> : null}
      </span>
    )
  }
  return (
    <button
      type="button"
      disabled={desativado}
      onClick={() => {
        setTexto(nome)
        setEditando(true)
      }}
      title={`${rotulo} (clique para trocar o nome)`}
      aria-label={`${rotulo}: ${nome}${sufixo}`}
      data-renomear=""
      className={`group -mx-1.5 flex h-7 max-w-full min-w-0 items-center gap-1.5 rounded-md px-1.5 text-left text-sm font-semibold text-tinta transition-colors hover:bg-superficie-2 disabled:pointer-events-none ${className}`}
    >
      <span className="truncate">
        {nome}
        <span className="font-normal text-fraca">{sufixo}</span>
      </span>
      {desativado ? null : <Icone nome="caneta" tamanho={13} className="shrink-0 text-fraca group-hover:text-tinta" />}
    </button>
  )
}

const classeCartao = (ativo) =>
  `flex flex-col items-start gap-0.5 rounded-xl border-2 px-3 py-2.5 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-45 ${ativo ? 'border-acento bg-acento-suave' : 'border-borda bg-superficie hover:border-borda-forte'}`

/** Escolha única em cartões (rótulo forte + dica curta). */
export function OpcoesCartoes({ rotulo, valor, aoMudar, opcoes, colunas = 'grid-cols-2 sm:grid-cols-3' }) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 text-[0.8125rem] font-semibold text-tinta">{rotulo}</legend>
      <div role="radiogroup" aria-label={rotulo} className={`grid gap-2 ${colunas}`}>
        {opcoes.map((op) => (
          <button key={op.valor} type="button" role="radio" aria-checked={valor === op.valor} disabled={op.desativado} onClick={() => aoMudar(op.valor)} className={classeCartao(valor === op.valor)}>
            <span className="text-sm font-bold text-tinta">{op.rotulo}</span>
            {op.dica ? <span className="text-xs text-fraca">{op.dica}</span> : null}
          </button>
        ))}
      </div>
    </fieldset>
  )
}

/**
 * Para quem baixa direto (sem a tela de resultado): pergunta o nome num modal
 * antes de salvar. `pedir({ nome: 'arquivo.ext', titulo?, gerar })`, onde
 * `gerar` é o Blob ou uma função (async) que o devolve.
 */
export function useBaixarComNome() {
  const [pedido, setPedido] = useState(null)
  const pedir = ({ nome, titulo, gerar, aoBaixar }) => {
    const [base, ext] = partesDoNome(nome)
    setPedido({ base, ext, titulo, gerar, aoBaixar })
  }
  const dialogo = (
    <DialogoBaixar
      aberto={Boolean(pedido)}
      aoFechar={() => setPedido(null)}
      titulo={pedido?.titulo ?? 'Baixar'}
      nome={pedido?.base ?? ''}
      extensao={pedido?.ext}
      aoConfirmar={async (n) => {
        const p = pedido
        setPedido(null)
        const nome = p.ext ? `${n}.${p.ext}` : n
        if (p.aoBaixar) return p.aoBaixar(nome)
        const blob = typeof p.gerar === 'function' ? await p.gerar() : p.gerar
        if (blob) baixarBlob(blob, nome)
      }}
    />
  )
  return [pedir, dialogo]
}

/**
 * Modal da hora de baixar: o nome do arquivo (com a extensão do formato
 * escolhido) e, abaixo, as opções do arquivo final (`children`, controladas
 * por quem abre). `aoConfirmar(nome)` recebe o nome já limpo.
 * Sem `nome` (ex.: vários arquivos), o campo de nome não aparece.
 */
export function DialogoBaixar({ aberto, aoFechar, titulo = 'Baixar', nome, extensao, aoConfirmar, rotuloConfirmar, resumo, children }) {
  const dialogo = useRef(null)
  const [texto, setTexto] = useState(nome ?? '')

  useEffect(() => {
    const d = dialogo.current
    if (aberto) {
      setTexto(nome ?? '')
      if (!d.open) d.showModal()
    } else if (d.open) d.close()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto])

  const confirmar = (e) => {
    e?.preventDefault()
    aoConfirmar(nome == null ? null : limparNome(texto) || nome)
  }

  return (
    <dialog
      ref={dialogo}
      onClose={aoFechar}
      aria-labelledby="titulo-baixar"
      data-dialogo-baixar=""
      className="m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-xl overflow-hidden rounded-2xl border border-borda bg-superficie p-0 text-texto shadow-[var(--shadow-flutuante)] backdrop:bg-sobreposicao"
    >
      {aberto ? (
        <form onSubmit={confirmar} className="flex max-h-[calc(100dvh-2rem)] flex-col">
          <div className="flex items-center gap-3 border-b border-borda px-5 py-4">
            <h2 id="titulo-baixar" className="flex-1 text-lg">
              {titulo}
            </h2>
            <button type="button" onClick={aoFechar} aria-label="Fechar" className="grid size-9 place-items-center rounded-full text-suave hover:bg-superficie-2 hover:text-tinta">
              <Icone nome="fechar" tamanho={18} />
            </button>
          </div>

          <div className="rolagem-fina flex flex-1 flex-col gap-6 overflow-y-auto px-5 py-5">
            {nome != null ? (
              <label className="flex flex-col gap-1.5 text-[0.8125rem] font-semibold text-tinta">
                Nome do arquivo
                <span className="flex items-center rounded-lg border border-borda-forte bg-superficie focus-within:border-acento">
                  <input value={texto} onChange={(e) => setTexto(e.target.value)} aria-label="Nome do arquivo" spellCheck={false} className="h-10 min-w-0 flex-1 bg-transparent px-3 text-sm font-medium text-tinta focus:outline-none" />
                  {extensao ? <span className="pr-3 text-sm text-fraca">.{extensao}</span> : null}
                </span>
              </label>
            ) : null}
            {children}
          </div>

          <div className="flex flex-wrap items-center gap-3 border-t border-borda bg-fundo-suave px-5 py-4">
            <p className="min-w-0 flex-1 text-xs text-fraca">{resumo}</p>
            <Botao variante="secundario" onClick={aoFechar}>
              Cancelar
            </Botao>
            <Botao type="submit" icone="baixar" data-confirmar-baixar="">
              {rotuloConfirmar ?? (extensao ? `Baixar ${extensao.toUpperCase()}` : 'Baixar')}
            </Botao>
          </div>
        </form>
      ) : null}
    </dialog>
  )
}
