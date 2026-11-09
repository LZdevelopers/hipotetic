import { Modos } from '../../componentes/ferramenta/Modos'
import MarcaDagua from './marca-dagua'
import Numerar from './numerar'

/** Numeração de páginas e marca d'água: as duas marcações que se aplicam em todas as páginas. */
export default function NumerarMarca() {
  return (
    <Modos
      modos={[
        { valor: 'numerar', rotulo: 'Números de página', icone: 'lista', Componente: Numerar },
        { valor: 'marca', rotulo: 'Marca d’água', icone: 'carimbo', Componente: MarcaDagua },
      ]}
    />
  )
}
