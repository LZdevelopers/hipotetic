import { useState } from 'react'
import { SeletorArquivos } from '../../componentes/ferramenta/SeletorArquivos'
import { Icone } from '../../componentes/Icone'
import { AreaTexto, Aviso, Botao, Entrada, Progresso, Segmentado } from '../../componentes/ui'
import { formatarBytes } from '../../nucleo/arquivos'
import { cancelado, useTarefa } from '../../nucleo/tarefa'

const ALGORITMOS = ['MD5', 'SHA-1', 'SHA-256', 'SHA-512', 'CRC32']
const PEDACO = 8 * 1024 * 1024

/** Calcula vários hashes lendo o arquivo em pedaços de 8 MB (arquivos de vários GB, sem estourar a memória). */
export async function calcularHashes(fonte, aoProgredir, sinal) {
  const hw = await import('hash-wasm')
  const h = { MD5: await hw.createMD5(), 'SHA-1': await hw.createSHA1(), 'SHA-256': await hw.createSHA256(), 'SHA-512': await hw.createSHA512(), CRC32: await hw.createCRC32() }
  Object.values(h).forEach((x) => x.init())
  if (typeof fonte === 'string') {
    const bytes = new TextEncoder().encode(fonte)
    Object.values(h).forEach((x) => x.update(bytes))
  } else {
    for (let pos = 0; pos < fonte.size; pos += PEDACO) {
      cancelado(sinal)
      const parte = new Uint8Array(await fonte.slice(pos, pos + PEDACO).arrayBuffer())
      Object.values(h).forEach((x) => x.update(parte))
      aoProgredir?.(Math.min(1, (pos + PEDACO) / fonte.size))
    }
  }
  return Object.fromEntries(Object.entries(h).map(([k, x]) => [k, x.digest('hex')]))
}

function Linha({ algoritmo, valor, esperado }) {
  const [copiado, setCopiado] = useState(false)
  const confere = esperado && esperado === valor
  return (
    <div className={`grid grid-cols-[5rem_minmax(0,1fr)_auto] items-center gap-3 px-4 py-2.5 ${confere ? 'bg-sucesso-suave' : ''}`}>
      <span className="text-xs font-semibold text-suave">{algoritmo}</span>
      <code className="font-mono text-xs break-all text-tinta">{valor}</code>
      <button
        type="button"
        aria-label={`Copiar ${algoritmo}`}
        onClick={async () => {
          await navigator.clipboard.writeText(valor)
          setCopiado(true)
          setTimeout(() => setCopiado(false), 1200)
        }}
        className="grid size-8 place-items-center rounded-md text-fraca hover:bg-superficie-2 hover:text-tinta"
      >
        <Icone nome={copiado ? 'check' : confere ? 'check' : 'copiar'} tamanho={15} className={confere ? 'text-sucesso' : ''} />
      </button>
    </div>
  )
}

export default function Hash() {
  const [modo, setModo] = useState('arquivo')
  const [arquivos, setArquivos] = useState([])
  const [texto, setTexto] = useState('')
  const [esperado, setEsperado] = useState('')
  const tarefa = useTarefa()

  const calcular = () =>
    tarefa.executar(async ({ progresso, sinal }) => {
      if (modo === 'texto') return [{ nome: 'Texto', hashes: await calcularHashes(texto) }]
      const saida = []
      for (let i = 0; i < arquivos.length; i += 1) {
        const { arquivo } = arquivos[i]
        const hashes = await calcularHashes(arquivo, (v) => progresso((i + v) / arquivos.length, `Calculando ${arquivo.name}`), sinal)
        saida.push({ nome: arquivo.name, tamanho: arquivo.size, hashes })
      }
      return saida
    }, 'Calculando')

  const alvo = esperado.trim().toLowerCase()
  const resultado = tarefa.fase === 'pronto' ? tarefa.resultado : null
  const encontrou = alvo && resultado?.some((r) => Object.values(r.hashes).includes(alvo))

  return (
    <div className="flex flex-col gap-5">
      <Segmentado
        valor={modo}
        aoMudar={(v) => {
          setModo(v)
          tarefa.reiniciar()
        }}
        className="max-w-sm"
        opcoes={[
          { valor: 'arquivo', rotulo: 'Arquivos' },
          { valor: 'texto', rotulo: 'Texto' },
        ]}
      />
      {modo === 'arquivo' ? (
        <SeletorArquivos arquivos={arquivos} aoMudar={(l) => { setArquivos(l); tarefa.reiniciar() }} descricaoFormatos="Qualquer arquivo, de qualquer tamanho" compacto={Boolean(arquivos.length)} />
      ) : (
        <AreaTexto rotulo="Texto" valor={texto} aoMudar={(v) => { setTexto(v); tarefa.reiniciar() }} className="[&_textarea]:font-sans" />
      )}
      <Entrada rotulo="Conferir com um hash (opcional)" valor={esperado} aoMudar={setEsperado} placeholder="Cole o hash publicado pelo site para verificar se o arquivo é íntegro" spellCheck="false" />
      {tarefa.fase === 'processando' ? (
        <Progresso valor={tarefa.progresso} rotulo={tarefa.rotulo} aoCancelar={tarefa.cancelar} />
      ) : (
        <Botao tamanho="g" icone="hash" className="self-start" onClick={calcular} disabled={modo === 'arquivo' ? !arquivos.length : !texto}>
          Calcular hashes
        </Botao>
      )}
      {tarefa.fase === 'erro' ? <Aviso tom="erro">{tarefa.mensagem}</Aviso> : null}
      {resultado ? (
        <>
          {alvo ? (
            <Aviso tom={encontrou ? 'sucesso' : 'erro'} titulo={encontrou ? 'O hash confere' : 'O hash NÃO confere'}>
              {encontrou ? 'O arquivo é idêntico ao original publicado.' : 'O arquivo é diferente do esperado: pode estar corrompido, incompleto ou ter sido alterado.'}
            </Aviso>
          ) : null}
          {resultado.map((r) => (
            <section key={r.nome} className="cartao overflow-hidden" aria-label={`Hashes de ${r.nome}`}>
              <h2 className="border-b border-borda bg-fundo-suave px-4 py-2.5 font-sans text-sm font-semibold text-tinta">
                {r.nome} {r.tamanho != null ? <span className="font-normal text-fraca">· {formatarBytes(r.tamanho)}</span> : null}
              </h2>
              <div className="divide-y divide-borda">
                {ALGORITMOS.map((a) => (
                  <Linha key={a} algoritmo={a} valor={r.hashes[a]} esperado={alvo} />
                ))}
              </div>
            </section>
          ))}
        </>
      ) : null}
    </div>
  )
}
