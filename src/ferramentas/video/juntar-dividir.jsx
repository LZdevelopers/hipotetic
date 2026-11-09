import { Modos } from '../../componentes/ferramenta/Modos'
import Dividir from './dividir'
import Unir from './unir'

/** Juntar vários vídeos ou dividir um em partes, na mesma página. */
export default function JuntarDividir() {
  return (
    <Modos
      modos={[
        { valor: 'juntar', rotulo: 'Juntar', icone: 'unir', Componente: Unir },
        { valor: 'dividir', rotulo: 'Dividir', icone: 'dividir', Componente: Dividir },
      ]}
    />
  )
}
