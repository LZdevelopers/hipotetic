import { Deslizante, Segmentado, Seletor } from '../../componentes/ui'
import { dimensoes, formatoOriginal, processarLote } from '../../motores/imagem'
import { trocarExtensao } from '../../nucleo/arquivos'
import { EscolhaFormato } from './_comum'

/*
 * Comprimir imagens (usado pelo editor de imagem no modo "comprimir"):
 * MozJPEG / WebP / AVIF com qualidade ajustada, e OxiPNG (sem perdas) para
 * PNG. Se o resultado sair MAIOR que o original (imagem que já estava
 * otimizada), devolve o original — nunca piora o arquivo.
 */

const NIVEIS = { leve: 88, equilibrado: 76, forte: 58 }

export const COMPRIMIR_INICIAL = { nivel: 'equilibrado', qualidade: 76, formato: 'original', ladoMaximo: 0 }

export function OpcoesComprimir({ opcoes, mudar }) {
  return (
    <div className="flex flex-col gap-5">
      <Segmentado
        rotulo="Compressão"
        valor={opcoes.nivel}
        aoMudar={(v) => mudar('nivel', v)}
        opcoes={[
          { valor: 'leve', rotulo: 'Leve' },
          { valor: 'equilibrado', rotulo: 'Equilibrada' },
          { valor: 'forte', rotulo: 'Forte' },
          { valor: 'manual', rotulo: 'Manual' },
        ]}
        dica={
          {
            leve: 'Diferença invisível a olho nu. Reduz menos.',
            equilibrado: 'O melhor custo-benefício para sites e envio por mensagem.',
            forte: 'Arquivos bem pequenos; pode aparecer perda em detalhes finos.',
            manual: 'Escolha a qualidade exata.',
          }[opcoes.nivel]
        }
      />
      {opcoes.nivel === 'manual' ? <Deslizante rotulo="Qualidade" valor={opcoes.qualidade} aoMudar={(v) => mudar('qualidade', v)} min={10} max={100} formatar={(v) => `${v}%`} /> : null}
      <EscolhaFormato rotulo="Formato" valor={opcoes.formato} aoMudar={(v) => mudar('formato', v)} comOriginal />
      <Seletor
        rotulo="Reduzir dimensões"
        valor={String(opcoes.ladoMaximo)}
        aoMudar={(v) => mudar('ladoMaximo', Number(v))}
        opcoes={[
          { valor: '0', rotulo: 'Não reduzir' },
          { valor: '3840', rotulo: 'Até 3840 px (4K)' },
          { valor: '2560', rotulo: 'Até 2560 px' },
          { valor: '1920', rotulo: 'Até 1920 px (Full HD)' },
          { valor: '1280', rotulo: 'Até 1280 px' },
          { valor: '800', rotulo: 'Até 800 px' },
        ]}
        dica="Fotos de celular costumam ter 4000 px ou mais: reduzir é o que mais diminui o arquivo."
      />
    </div>
  )
}

export async function comprimirImagens(itens, o, ctx) {
  const qualidade = o.nivel === 'manual' ? o.qualidade : NIVEIS[o.nivel]
  const formatos = new Map()
  const resultados = await processarLote(
    itens,
    async (item) => {
      const formato = o.formato === 'original' ? await formatoOriginal(item.arquivo) : o.formato
      formatos.set(item.id, formato)
      let tamanho
      if (o.ladoMaximo) {
        const { largura, altura } = await dimensoes(item.arquivo)
        const escala = o.ladoMaximo / Math.max(largura, altura)
        if (escala < 1) tamanho = { largura: largura * escala, altura: altura * escala, modo: 'esticar' }
      }
      return { tamanho, saida: { formato, qualidade, otimizar: formato === 'png' } }
    },
    { ...ctx, rotulo: 'Comprimindo' },
  )
  return resultados.map((r, i) => {
    const item = itens[i]
    const mesmoFormato = o.formato === 'original'
    if (mesmoFormato && !o.ladoMaximo && r.blob.size >= item.arquivo.size) {
      return { ...r, nome: item.arquivo.name, blob: item.arquivo, detalhe: 'já estava otimizada: mantida a original' }
    }
    return { ...r, nome: mesmoFormato ? item.arquivo.name : trocarExtensao(item.arquivo.name, formatos.get(item.id)) }
  })
}
