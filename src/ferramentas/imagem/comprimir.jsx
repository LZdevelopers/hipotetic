import { ModeloConversao } from '../../componentes/ferramenta/ModeloConversao'
import { COMPRIMIR_INICIAL, OpcoesComprimir, comprimirImagens } from './_comprimir'

/**
 * Comprimir imagens: MozJPEG / WebP / AVIF com qualidade ajustada, e OxiPNG
 * (sem perdas) para PNG. Nunca piora o arquivo (ver _comprimir.jsx).
 */
export default function Comprimir() {
  return (
    <ModeloConversao
      extensoes={['jpg', 'jpeg', 'png', 'webp', 'avif']}
      descricaoFormatos="JPG, PNG, WebP, AVIF"
      limiteBytes={60 * 1024 * 1024}
      aceitarColar
      opcoesIniciais={COMPRIMIR_INICIAL}
      Configuracoes={OpcoesComprimir}
      rotuloAcao="Comprimir"
      nomeZip="imagens-comprimidas.zip"
      processar={comprimirImagens}
    />
  )
}
