import { Modos } from '../../componentes/ferramenta/Modos'
import Dividir from './dividir'
import Unir from './unir'

/** Juntar várias faixas em uma, ou dividir uma em várias. */
export default function JuntarDividirAudio() {
  return (
    <Modos
      rotulo="O que você quer fazer?"
      modos={[
        { valor: 'juntar', rotulo: 'Juntar', icone: 'unir', Componente: Unir },
        { valor: 'dividir', rotulo: 'Dividir', icone: 'dividir', Componente: Dividir },
      ]}
    />
  )
}
