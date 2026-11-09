import { Modos } from '../../componentes/ferramenta/Modos'
import DeImagens from './de-imagens'
import ParaImagens from './para-imagens'
import ParaTexto from './para-texto'

/** Converter PDF: para imagens (JPG/PNG/WebP), para texto, ou imagens para PDF. */
export default function ConverterPdf() {
  return (
    <Modos
      rotulo="O que você quer fazer?"
      modos={[
        { valor: 'para-imagem', rotulo: 'PDF para imagem', icone: 'imagem', Componente: ParaImagens },
        { valor: 'para-texto', rotulo: 'PDF para texto', icone: 'texto', Componente: ParaTexto },
        { valor: 'de-imagens', rotulo: 'Imagens para PDF', icone: 'pdfBaixar', Componente: DeImagens },
      ]}
    />
  )
}
