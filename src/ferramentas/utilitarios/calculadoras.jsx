import { Modos } from '../../componentes/ferramenta/Modos'
import Calculadora from './calculadora'
import Unidades from './unidades'

/** Conversor de unidades (KB, MB, GiB…) e calculadoras de download e compressão. */
export default function Calculadoras() {
  return (
    <Modos
      modos={[
        { valor: 'unidades', rotulo: 'Converter unidades', icone: 'disco', Componente: Unidades },
        { valor: 'calcular', rotulo: 'Download e compressão', icone: 'calculadora', Componente: Calculadora },
      ]}
    />
  )
}
