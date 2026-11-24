import { SeletorCor } from '../../componentes/SeletorCor'
import { Deslizante, Segmentado, Seletor } from '../../componentes/ui'

/** Controles repetidos nas ferramentas de imagem. */

export const FORMATOS_SAIDA = [
  { valor: 'jpg', rotulo: 'JPG' },
  { valor: 'png', rotulo: 'PNG' },
  { valor: 'webp', rotulo: 'WebP' },
  { valor: 'avif', rotulo: 'AVIF' },
]

export function EscolhaFormato({ valor, aoMudar, comOriginal = false, rotulo = 'Formato de saída' }) {
  const opcoes = comOriginal ? [{ valor: 'original', rotulo: 'Manter' }, ...FORMATOS_SAIDA] : FORMATOS_SAIDA
  const dicas = {
    original: 'Cada imagem sai no formato em que entrou.',
    jpg: 'Compatível com tudo. Sem transparência.',
    png: 'Sem perdas e com transparência. Arquivos maiores.',
    webp: 'Bem menor que JPG e PNG, com transparência. Aceito por todos os navegadores atuais.',
    avif: 'O menor de todos, com transparência. Mais lento para gerar; alguns programas antigos não abrem.',
  }
  return <Segmentado rotulo={rotulo} valor={valor} aoMudar={aoMudar} opcoes={opcoes} dica={dicas[valor]} />
}

export function Qualidade({ valor, aoMudar, formato }) {
  if (formato === 'png') return null
  return (
    <Deslizante
      rotulo="Qualidade"
      valor={valor}
      aoMudar={aoMudar}
      min={10}
      max={100}
      formatar={(v) => `${v}%`}
      dica={valor >= 90 ? 'Quase sem perda visível; arquivo maior.' : valor >= 70 ? 'Bom equilíbrio entre qualidade e tamanho.' : 'Arquivo bem menor; detalhes finos podem borrar.'}
    />
  )
}

/** Cor (fundo de quem perde a transparência, texto, pincel…): o seletor de cor do site. */
export function CorDeFundo({ valor, aoMudar, rotulo = 'Fundo (no lugar da transparência)' }) {
  return <SeletorCor valor={valor} aoMudar={aoMudar} rotulo={rotulo} />
}

export function EscalaSvg({ valor, aoMudar }) {
  return (
    <Seletor
      rotulo="Tamanho dos SVGs"
      valor={String(valor)}
      aoMudar={(v) => aoMudar(Number(v))}
      opcoes={[
        { valor: '1', rotulo: '1× (tamanho original)' },
        { valor: '2', rotulo: '2× (telas retina)' },
        { valor: '4', rotulo: '4× (impressão)' },
        { valor: '8', rotulo: '8×' },
      ]}
      dica="SVG é vetorial: escolha em que tamanho ele vira imagem."
    />
  )
}

export const temSvg = (arquivos) => arquivos.some((a) => /\.svg$/i.test(a.arquivo.name))
