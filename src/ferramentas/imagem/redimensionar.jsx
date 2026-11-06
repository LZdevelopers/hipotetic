import { ModeloConversao } from '../../componentes/ferramenta/ModeloConversao'
import { Caixa, Deslizante, Entrada, Segmentado } from '../../componentes/ui'
import { DESCRICAO_IMAGEM, EXTENSOES_IMAGEM, LIMITE_IMAGEM, dimensoes, formatoOriginal, processarLote } from '../../motores/imagem'
import { CorDeFundo, EscolhaFormato, Qualidade } from './_comum'

function Configuracoes({ opcoes, mudar }) {
  const medidas = opcoes.modo === 'medidas'
  return (
    <div className="flex flex-col gap-5">
      <Segmentado
        rotulo="Redimensionar por"
        valor={opcoes.modo}
        aoMudar={(v) => mudar('modo', v)}
        opcoes={[
          { valor: 'porcentagem', rotulo: 'Porcentagem' },
          { valor: 'medidas', rotulo: 'Largura × altura' },
          { valor: 'lado', rotulo: 'Lado maior' },
        ]}
      />
      {opcoes.modo === 'porcentagem' ? (
        <Deslizante rotulo="Novo tamanho" valor={opcoes.porcentagem} aoMudar={(v) => mudar('porcentagem', v)} min={5} max={200} passo={5} formatar={(v) => `${v}%`} />
      ) : null}
      {medidas ? (
        <>
          <div className="grid grid-cols-2 gap-3">
            <Entrada rotulo="Largura" type="number" min="1" max="20000" inputMode="numeric" sufixo="px" valor={opcoes.largura} aoMudar={(v) => mudar('largura', v)} placeholder={opcoes.manterProporcao ? 'auto' : ''} />
            <Entrada rotulo="Altura" type="number" min="1" max="20000" inputMode="numeric" sufixo="px" valor={opcoes.altura} aoMudar={(v) => mudar('altura', v)} placeholder={opcoes.manterProporcao ? 'auto' : ''} />
          </div>
          <Caixa
            rotulo="Manter a proporção"
            dica={opcoes.manterProporcao ? 'Preencha só um dos lados, ou os dois para caber dentro dessa área.' : 'A imagem é encaixada exatamente nessas medidas.'}
            marcado={opcoes.manterProporcao}
            aoMudar={(v) => mudar('manterProporcao', v)}
          />
          {!opcoes.manterProporcao ? (
            <Segmentado
              rotulo="Como encaixar"
              valor={opcoes.encaixe}
              aoMudar={(v) => mudar('encaixe', v)}
              opcoes={[
                { valor: 'cobrir', rotulo: 'Cortar sobras' },
                { valor: 'conter', rotulo: 'Com bordas' },
                { valor: 'esticar', rotulo: 'Esticar' },
              ]}
            />
          ) : null}
        </>
      ) : null}
      {opcoes.modo === 'lado' ? (
        <Entrada rotulo="Lado maior com" type="number" min="1" max="20000" inputMode="numeric" sufixo="px" valor={opcoes.lado} aoMudar={(v) => mudar('lado', v)} dica="Ótimo para lotes com fotos na horizontal e na vertical." />
      ) : null}
      <EscolhaFormato valor={opcoes.formato} aoMudar={(v) => mudar('formato', v)} comOriginal />
      <Qualidade valor={opcoes.qualidade} aoMudar={(v) => mudar('qualidade', v)} formato={opcoes.formato} />
      {(medidas && !opcoes.manterProporcao && opcoes.encaixe === 'conter') || opcoes.formato === 'jpg' ? (
        <CorDeFundo valor={opcoes.fundo} aoMudar={(v) => mudar('fundo', v)} rotulo="Cor das bordas e do fundo" />
      ) : null}
    </div>
  )
}

/** Medidas finais de uma imagem, dadas as opções. */
export function calcularTamanho({ largura, altura }, o) {
  if (o.modo === 'porcentagem') return { largura: (largura * o.porcentagem) / 100, altura: (altura * o.porcentagem) / 100, modo: 'esticar' }
  if (o.modo === 'lado') {
    const escala = Number(o.lado) / Math.max(largura, altura)
    return { largura: largura * escala, altura: altura * escala, modo: 'esticar' }
  }
  const w = Number(o.largura) || 0
  const h = Number(o.altura) || 0
  if (o.manterProporcao) {
    const escala = w && h ? Math.min(w / largura, h / altura) : w ? w / largura : h / altura
    return { largura: largura * escala, altura: altura * escala, modo: 'esticar' }
  }
  return { largura: w || largura, altura: h || altura, modo: o.encaixe, fundo: o.encaixe === 'conter' ? o.fundo : undefined }
}

function validar(o) {
  if (o.modo === 'medidas') {
    const w = Number(o.largura)
    const h = Number(o.altura)
    if (!w && !h) return 'Informe a largura, a altura ou as duas.'
    if (!o.manterProporcao && (!w || !h)) return 'Sem manter a proporção, informe largura e altura.'
    if (w > 20000 || h > 20000) return 'O máximo é 20.000 px por lado.'
  }
  if (o.modo === 'lado' && !(Number(o.lado) >= 1 && Number(o.lado) <= 20000)) return 'Informe o lado maior entre 1 e 20.000 px.'
  return null
}

export default function Redimensionar() {
  return (
    <ModeloConversao
      extensoes={EXTENSOES_IMAGEM}
      descricaoFormatos={DESCRICAO_IMAGEM}
      limiteBytes={LIMITE_IMAGEM}
      aceitarColar
      opcoesIniciais={{ modo: 'porcentagem', porcentagem: 50, largura: '', altura: '', lado: '1920', manterProporcao: true, encaixe: 'cobrir', formato: 'original', qualidade: 88, fundo: '#ffffff' }}
      Configuracoes={Configuracoes}
      validarOpcoes={validar}
      rotuloAcao="Redimensionar"
      nomeZip="imagens-redimensionadas.zip"
      processar={(itens, o, ctx) =>
        processarLote(
          itens,
          async (item) => {
            const formato = o.formato === 'original' ? await formatoOriginal(item.arquivo) : o.formato
            const tamanho = calcularTamanho(await dimensoes(item.arquivo), o)
            if (tamanho.largura > 20000 || tamanho.altura > 20000) throw new Error('grande demais')
            return { tamanho, saida: { formato, qualidade: o.qualidade, fundo: o.fundo } }
          },
          { ...ctx, rotulo: 'Redimensionando' },
        )
      }
    />
  )
}
