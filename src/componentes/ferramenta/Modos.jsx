import { useState } from 'react'
import { Segmentado } from '../ui'

/**
 * Uma página, várias operações próximas (ex.: "Proteger | Desbloquear"): a
 * pessoa escolhe o que quer no topo, sem precisar achar outra ferramenta.
 * modos = [{ valor, rotulo, icone?, Componente, props? }]
 */
export function Modos({ modos, inicial, rotulo }) {
  const [atual, setAtual] = useState(inicial ?? modos[0].valor)
  const modo = modos.find((m) => m.valor === atual) ?? modos[0]
  const { Componente } = modo
  return (
    <div className="flex flex-col gap-5">
      <Segmentado
        rotulo={rotulo}
        valor={modo.valor}
        aoMudar={setAtual}
        opcoes={modos.map(({ valor, rotulo: r, icone }) => ({ valor, rotulo: r, icone }))}
        className="max-w-xl"
      />
      <Componente key={modo.valor} {...modo.props} />
    </div>
  )
}
