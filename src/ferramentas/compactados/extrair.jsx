import { useEffect, useMemo, useState } from 'react'
import { SeletorArquivos, iconeDoArquivo } from '../../componentes/ferramenta/SeletorArquivos'
import { Icone } from '../../componentes/Icone'
import { Aviso, Botao, Entrada, Progresso } from '../../componentes/ui'
import { DESCRICAO_COMPACTADOS, EXTENSOES_COMPACTADOS, LIMITE_COMPACTADO, conferirSeguranca, extrair, listar } from '../../motores/compactados'
import { baixarBlob, formatarBytes, semExtensao, zipar } from '../../nucleo/arquivos'
import { useTarefa } from '../../nucleo/tarefa'

function Painel({ arquivo, aoTrocar }) {
  const [listagem, setListagem] = useState(null)
  const [erro, setErro] = useState(null)
  const [senha, setSenha] = useState('')
  const [senhaUsada, setSenhaUsada] = useState('')
  const [selecao, setSelecao] = useState(new Set())
  const [filtro, setFiltro] = useState('')
  const tarefa = useTarefa()

  const abrir = async (s = '') => {
    setErro(null)
    try {
      const l = await listar(arquivo, s)
      if (l.senhaErrada) return setErro('Senha incorreta.')
      if (!l.precisaSenha) conferirSeguranca(l, arquivo.size)
      setListagem(l)
      setSenhaUsada(s)
      setSelecao(new Set(l.itens.map((i) => i.caminho)))
    } catch (e) {
      setErro(e?.mensagem ?? 'Não foi possível abrir este arquivo.')
    }
  }
  useEffect(() => {
    abrir()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [arquivo])

  const visiveis = useMemo(() => (listagem?.itens ?? []).filter((i) => !filtro || i.caminho.toLowerCase().includes(filtro.toLowerCase())), [listagem, filtro])

  const baixar = (comoZip) =>
    tarefa.executar(async ({ progresso }) => {
      progresso(null, 'Extraindo')
      const todos = selecao.size === listagem.itens.length
      const extraidos = await extrair(listagem, { senha: senhaUsada, selecionados: todos ? undefined : [...selecao] })
      if (comoZip || extraidos.length > 1) {
        progresso(null, 'Juntando em ZIP')
        const zip = await zipar(extraidos.map((e) => ({ nome: e.caminho, blob: e.blob })))
        baixarBlob(zip, `${semExtensao(arquivo.name).replace(/\.tar$/, '')}.zip`)
      } else if (extraidos[0]) {
        baixarBlob(extraidos[0].blob, extraidos[0].caminho.split('/').pop())
      }
      return extraidos.length
    }, 'Extraindo')

  const baixarUm = (item) =>
    tarefa.executar(async () => {
      const [e] = await extrair(listagem, { senha: senhaUsada, selecionados: [item.caminho] })
      if (e) baixarBlob(e.blob, e.caminho.split('/').pop())
      return 1
    }, 'Extraindo')

  if (erro && !listagem?.precisaSenha && erro !== 'Senha incorreta.') {
    return <Aviso tom="erro" titulo={erro} acao={<Botao variante="secundario" tamanho="p" onClick={aoTrocar}>Escolher outro</Botao>} />
  }
  if (!listagem) return <div className="esqueleto h-64 rounded-[var(--radius-cartao)]" />

  if (listagem.precisaSenha) {
    return (
      <form
        className="cartao mx-auto flex max-w-md flex-col gap-4 p-5"
        onSubmit={(e) => {
          e.preventDefault()
          abrir(senha)
        }}
      >
        <p className="flex items-center gap-2 text-sm font-semibold text-tinta">
          <Icone nome="bloquear" tamanho={17} />
          {arquivo.name} é protegido por senha
        </p>
        <Entrada rotulo="Senha" type="password" valor={senha} aoMudar={setSenha} autoFocus />
        {erro ? <Aviso tom="erro">{erro}</Aviso> : null}
        <div className="flex gap-2">
          <Botao variante="secundario" onClick={aoTrocar}>
            Trocar
          </Botao>
          <Botao type="submit" className="flex-1" disabled={!senha}>
            Abrir
          </Botao>
        </div>
      </form>
    )
  }

  const processando = tarefa.fase === 'processando'
  const tamanhoSel = listagem.itens.filter((i) => selecao.has(i.caminho)).reduce((s, i) => s + i.tamanho, 0)
  return (
    <div className="flex flex-col gap-4">
      <div className="cartao flex flex-wrap items-center gap-x-6 gap-y-2 p-4">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-tinta">{arquivo.name}</p>
          <p className="text-xs text-fraca">
            {listagem.tipo ? `${listagem.tipo.toUpperCase()} · ` : ''}
            {listagem.itens.length} {listagem.itens.length === 1 ? 'arquivo' : 'arquivos'} · {formatarBytes(arquivo.size)} → {formatarBytes(listagem.total)}
          </p>
        </div>
        <div className="ml-auto flex flex-wrap gap-2">
          <Botao variante="secundario" tamanho="p" icone="refazer" onClick={aoTrocar}>
            Outro arquivo
          </Botao>
        </div>
      </div>

      {listagem.itens.length > 8 ? <Entrada rotulo="Filtrar" valor={filtro} aoMudar={setFiltro} placeholder="Nome ou pasta…" /> : null}

      <div className="cartao overflow-hidden">
        <div className="flex items-center gap-3 border-b border-borda bg-fundo-suave px-4 py-2.5 text-xs text-fraca">
          <input
            type="checkbox"
            aria-label="Selecionar todos"
            checked={selecao.size === listagem.itens.length}
            onChange={(e) => setSelecao(e.target.checked ? new Set(listagem.itens.map((i) => i.caminho)) : new Set())}
            className="size-4 accent-[var(--color-marca)]"
          />
          <span>
            {selecao.size} de {listagem.itens.length} selecionados · {formatarBytes(tamanhoSel)}
          </span>
        </div>
        <ul className="max-h-[28rem] divide-y divide-borda overflow-y-auto">
          {visiveis.slice(0, 1000).map((item) => (
            <li key={item.caminho} className="flex items-center gap-3 px-4 py-2">
              <input
                type="checkbox"
                aria-label={`Selecionar ${item.caminho}`}
                checked={selecao.has(item.caminho)}
                onChange={(e) =>
                  setSelecao((s) => {
                    const n = new Set(s)
                    e.target.checked ? n.add(item.caminho) : n.delete(item.caminho)
                    return n
                  })
                }
                className="size-4 shrink-0 accent-[var(--color-marca)]"
              />
              <Icone nome={iconeDoArquivo(item.caminho)} tamanho={17} className="text-fraca" />
              <span className="min-w-0 flex-1 truncate text-sm text-tinta" title={item.caminho}>
                {item.caminho.includes('/') ? <span className="text-fraca">{item.caminho.slice(0, item.caminho.lastIndexOf('/') + 1)}</span> : null}
                {item.caminho.split('/').pop()}
              </span>
              {item.cifrado ? <Icone nome="bloquear" tamanho={14} className="text-fraca" /> : null}
              <span className="shrink-0 text-xs text-fraca tabular-nums">{formatarBytes(item.tamanho)}</span>
              <button type="button" onClick={() => baixarUm(item)} disabled={processando} aria-label={`Baixar ${item.caminho}`} className="grid size-8 shrink-0 place-items-center rounded-md text-fraca hover:bg-superficie-2 hover:text-tinta disabled:opacity-40">
                <Icone nome="baixar" tamanho={15} />
              </button>
            </li>
          ))}
        </ul>
        {visiveis.length > 1000 ? <p className="border-t border-borda px-4 py-2 text-xs text-fraca">Mostrando 1.000 de {visiveis.length}. Use o filtro para achar um arquivo.</p> : null}
      </div>

      {tarefa.fase === 'erro' ? <Aviso tom="erro">{tarefa.mensagem}</Aviso> : null}
      {tarefa.fase === 'pronto' ? <Aviso tom="sucesso">{tarefa.resultado === 1 ? 'Arquivo extraído e baixado.' : `${tarefa.resultado} arquivos extraídos e baixados em um ZIP.`}</Aviso> : null}
      {processando ? (
        <Progresso valor={tarefa.progresso} rotulo={tarefa.rotulo} />
      ) : (
        <div className="flex flex-wrap justify-end gap-2">
          <Botao icone="baixar" tamanho="g" onClick={() => baixar(false)} disabled={!selecao.size}>
            {selecao.size === 1 ? 'Baixar o selecionado' : `Baixar ${selecao.size} selecionados (.zip)`}
          </Botao>
        </div>
      )}
    </div>
  )
}

/** Ver o conteúdo e extrair ZIP, RAR, 7Z, TAR, GZ… (tudo ou só os escolhidos). */
export default function Extrair({ formato }) {
  const [arquivos, setArquivos] = useState([])
  if (!arquivos.length) {
    return (
      <SeletorArquivos
        arquivos={arquivos}
        aoMudar={setArquivos}
        multiplos={false}
        extensoes={formato ? [formato] : EXTENSOES_COMPACTADOS}
        descricaoFormatos={formato ? formato.toUpperCase() : DESCRICAO_COMPACTADOS}
        limiteBytes={LIMITE_COMPACTADO}
      />
    )
  }
  return <Painel key={arquivos[0].id} arquivo={arquivos[0].arquivo} aoTrocar={() => setArquivos([])} />
}
