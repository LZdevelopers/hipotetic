import { Modos } from '../../componentes/ferramenta/Modos'
import Desbloquear from './desbloquear'
import Proteger from './proteger'

/** Colocar ou tirar a senha de um PDF. */
export default function Senha() {
  return (
    <Modos
      modos={[
        { valor: 'proteger', rotulo: 'Colocar senha', icone: 'pdfCadeado', Componente: Proteger },
        { valor: 'desbloquear', rotulo: 'Remover senha', icone: 'desbloquear', Componente: Desbloquear },
      ]}
    />
  )
}
