import { useState } from 'react'
import { SeletorArquivos } from '../../componentes/ferramenta/SeletorArquivos'
import { Aviso, Botao, Campo, Progresso } from '../../componentes/ui'
import { detectarTipo, formatarBytes, lerTexto } from '../../nucleo/arquivos'
import { useTarefa } from '../../nucleo/tarefa'
import { calcularHashes } from './hash'

const ehTexto = async (a) => a.size < 5 * 1024 * 1024 && (await detectarTipo(a))?.ext === 'txt' || /\.(txt|md|csv|json|xml|html?|css|js|ts|jsx|py|log|ini|ya?ml|srt|sql)$/i.test(a.name)

/** Primeiro byte diferente e quantos diferem (só faz sentido com o mesmo tamanho). */
async function diferencasBinarias(a, b) {
  const PEDACO = 4 * 1024 * 1024
  let primeiro = -1
  let diferentes = 0
  const n = Math.min(a.size, b.size)
  for (let pos = 0; pos < n; pos += PEDACO) {
    const [x, y] = await Promise.all([a.slice(pos, pos + PEDACO).arrayBuffer(), b.slice(pos, pos + PEDACO).arrayBuffer()].map(async (p) => new Uint8Array(await p)))
    for (let i = 0; i < x.length; i += 1) {
      if (x[i] !== y[i]) {
        if (primeiro < 0) primeiro = pos + i
        diferentes += 1
      }
    }
  }
  return { primeiro, diferentes }
}

export default function CompararArquivos() {
  const [a, setA] = useState([])
  const [b, setB] = useState([])
  const tarefa = useTarefa()

  const comparar = () =>
    tarefa.executar(async ({ progresso, sinal }) => {
      const [x, y] = [a[0].arquivo, b[0].arquivo]
      const [hx, hy] = [await calcularHashes(x, (v) => progresso(v / 2, 'Lendo o arquivo A'), sinal), await calcularHashes(y, (v) => progresso(0.5 + v / 2, 'Lendo o arquivo B'), sinal)]
      const iguais = hx['SHA-256'] === hy['SHA-256']
      const r = { x, y, iguais, hx, hy }
      if (!iguais && (await ehTexto(x)) && (await ehTexto(y))) {
        const { diffLines } = await import('diff')
        r.linhas = diffLines(await lerTexto(x), await lerTexto(y))
      } else if (!iguais && x.size === y.size) {
        r.binario = await diferencasBinarias(x, y)
      }
      return r
    }, 'Comparando')

  const r = tarefa.fase === 'pronto' ? tarefa.resultado : null
  const adicionadas = r?.linhas?.filter((p) => p.added).reduce((s, p) => s + p.count, 0) ?? 0
  const removidas = r?.linhas?.filter((p) => p.removed).reduce((s, p) => s + p.count, 0) ?? 0

  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-5 md:grid-cols-2">
        <Campo rotulo="Arquivo A">
          <SeletorArquivos arquivos={a} aoMudar={(l) => { setA(l); tarefa.reiniciar() }} multiplos={false} descricaoFormatos="Qualquer arquivo" compacto />
        </Campo>
        <Campo rotulo="Arquivo B">
          <SeletorArquivos arquivos={b} aoMudar={(l) => { setB(l); tarefa.reiniciar() }} multiplos={false} descricaoFormatos="Qualquer arquivo" compacto />
        </Campo>
      </div>
      {tarefa.fase === 'processando' ? (
        <Progresso valor={tarefa.progresso} rotulo={tarefa.rotulo} aoCancelar={tarefa.cancelar} />
      ) : (
        <Botao tamanho="g" icone="comparar" className="self-start" onClick={comparar} disabled={!a.length || !b.length}>
          Comparar
        </Botao>
      )}
      {tarefa.fase === 'erro' ? <Aviso tom="erro">{tarefa.mensagem}</Aviso> : null}
      {r ? (
        <>
          <Aviso tom={r.iguais ? 'sucesso' : 'alerta'} titulo={r.iguais ? 'Os arquivos são idênticos' : 'Os arquivos são diferentes'}>
            {r.iguais
              ? 'Mesmo conteúdo, byte a byte (SHA-256 igual), mesmo que os nomes sejam diferentes.'
              : `A: ${formatarBytes(r.x.size)} · B: ${formatarBytes(r.y.size)}${r.binario ? ` · ${r.binario.diferentes.toLocaleString('pt-BR')} bytes diferentes, o primeiro na posição ${r.binario.primeiro.toLocaleString('pt-BR')}` : r.x.size !== r.y.size && !r.linhas ? ' · tamanhos diferentes' : ''}`}
          </Aviso>
          {r.linhas ? (
            <section className="cartao overflow-hidden" aria-label="Diferenças linha a linha">
              <p className="border-b border-borda bg-fundo-suave px-4 py-2.5 text-xs text-fraca">
                <span className="text-sucesso">+{adicionadas} linhas</span> · <span className="text-perigo">−{removidas} linhas</span>
              </p>
              <pre className="max-h-[32rem] overflow-auto p-0 font-mono text-xs leading-relaxed">
                {r.linhas.map((p, i) =>
                  p.value
                    .replace(/\n$/, '')
                    .split('\n')
                    .map((linha, j) => (
                      <div key={`${i}-${j}`} className={`px-4 ${p.added ? 'bg-sucesso-suave text-sucesso' : p.removed ? 'bg-perigo-suave text-perigo' : 'text-texto'}`}>
                        {p.added ? '+ ' : p.removed ? '− ' : '  '}
                        {linha}
                      </div>
                    )),
                )}
              </pre>
            </section>
          ) : null}
        </>
      ) : null}
    </div>
  )
}
