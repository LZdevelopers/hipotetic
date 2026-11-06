import { useEffect, useState } from 'react'
import { ModeloConversao } from '../../componentes/ferramenta/ModeloConversao'
import { Botao, Campo } from '../../componentes/ui'
import { DESCRICAO_IMAGEM, EXTENSOES_IMAGEM, LIMITE_IMAGEM, formatoOriginal, processarLote } from '../../motores/imagem'

function Previa({ arquivo, girar, espelharH, espelharV }) {
  const [url, setUrl] = useState(null)
  useEffect(() => {
    if (!arquivo) return undefined
    const u = URL.createObjectURL(arquivo)
    setUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [arquivo])
  if (!url) return null
  return (
    <div className="xadrez grid aspect-square w-full place-items-center overflow-hidden rounded-xl border border-borda">
      <img
        src={url}
        alt="Prévia"
        className="max-h-[70%] max-w-[70%] object-contain transition-transform duration-300"
        style={{ transform: `rotate(${girar}deg) scale(${espelharH ? -1 : 1}, ${espelharV ? -1 : 1})` }}
      />
    </div>
  )
}

function Configuracoes({ opcoes, definir, arquivos }) {
  const girarPor = (delta) => definir((o) => ({ ...o, girar: (o.girar + delta + 360) % 360 }))
  return (
    <div className="flex flex-col gap-5">
      <Previa arquivo={arquivos[0]?.arquivo} {...opcoes} />
      <Campo rotulo="Girar" direita={`${opcoes.girar}°`}>
        <div className="grid grid-cols-2 gap-2">
          <Botao variante="secundario" icone="girar" className="[&>svg]:-scale-x-100" onClick={() => girarPor(-90)}>
            Anti-horário
          </Botao>
          <Botao variante="secundario" icone="girar" onClick={() => girarPor(90)}>
            Horário
          </Botao>
        </div>
      </Campo>
      <Campo rotulo="Espelhar">
        <div className="grid grid-cols-2 gap-2">
          <Botao variante={opcoes.espelharH ? 'primario' : 'secundario'} icone="espelhar" aria-pressed={opcoes.espelharH} onClick={() => definir((o) => ({ ...o, espelharH: !o.espelharH }))}>
            Horizontal
          </Botao>
          <Botao variante={opcoes.espelharV ? 'primario' : 'secundario'} icone="espelhar" className="[&>svg]:rotate-90" aria-pressed={opcoes.espelharV} onClick={() => definir((o) => ({ ...o, espelharV: !o.espelharV }))}>
            Vertical
          </Botao>
        </div>
      </Campo>
      {arquivos.length > 1 ? <p className="text-xs text-fraca">A prévia mostra a primeira imagem; a mesma rotação vale para todas.</p> : null}
    </div>
  )
}

export default function Girar() {
  return (
    <ModeloConversao
      extensoes={EXTENSOES_IMAGEM}
      descricaoFormatos={DESCRICAO_IMAGEM}
      limiteBytes={LIMITE_IMAGEM}
      aceitarColar
      opcoesIniciais={{ girar: 90, espelharH: false, espelharV: false }}
      Configuracoes={Configuracoes}
      validarOpcoes={(o) => (!o.girar && !o.espelharH && !o.espelharV ? 'Escolha uma rotação ou um espelhamento.' : null)}
      rotuloAcao="Aplicar"
      nomeZip="imagens-giradas.zip"
      processar={(itens, o, ctx) =>
        processarLote(
          itens,
          async (item) => {
            const formato = await formatoOriginal(item.arquivo)
            return { girar: o.girar, espelharH: o.espelharH, espelharV: o.espelharV, saida: { formato, qualidade: 92, otimizar: false } }
          },
          { ...ctx, rotulo: 'Girando' },
        )
      }
    />
  )
}
