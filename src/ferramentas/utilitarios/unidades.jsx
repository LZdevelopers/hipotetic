import { useState } from 'react'
import { Entrada, Seletor } from '../../componentes/ui'

/** Unidades em bytes. Decimais (SI, como os fabricantes de disco) e binárias (como o Windows). */
export const UNIDADES = [
  { id: 'bit', rotulo: 'bits', bytes: 1 / 8 },
  { id: 'B', rotulo: 'bytes (B)', bytes: 1 },
  { id: 'KB', rotulo: 'kilobytes (KB)', bytes: 1e3 },
  { id: 'MB', rotulo: 'megabytes (MB)', bytes: 1e6 },
  { id: 'GB', rotulo: 'gigabytes (GB)', bytes: 1e9 },
  { id: 'TB', rotulo: 'terabytes (TB)', bytes: 1e12 },
  { id: 'KiB', rotulo: 'kibibytes (KiB)', bytes: 1024 },
  { id: 'MiB', rotulo: 'mebibytes (MiB)', bytes: 1024 ** 2 },
  { id: 'GiB', rotulo: 'gibibytes (GiB)', bytes: 1024 ** 3 },
  { id: 'TiB', rotulo: 'tebibytes (TiB)', bytes: 1024 ** 4 },
]

export function converter(valor, de, para) {
  const a = UNIDADES.find((u) => u.id === de)
  const b = UNIDADES.find((u) => u.id === para)
  return (valor * a.bytes) / b.bytes
}

const fmt = (n) => (Number.isFinite(n) ? n.toLocaleString('pt-BR', { maximumFractionDigits: n < 1 ? 8 : n < 100 ? 4 : 2 }) : '—')

export default function Unidades() {
  const [valor, setValor] = useState('1')
  const [de, setDe] = useState('GB')
  const n = Number(String(valor).replace(',', '.'))

  return (
    <div className="grid gap-5 lg:grid-cols-[20rem_minmax(0,1fr)] lg:items-start">
      <div className="cartao flex flex-col gap-4 p-4 sm:p-5">
        <Entrada rotulo="Valor" valor={valor} aoMudar={setValor} inputMode="decimal" />
        <Seletor rotulo="Unidade" valor={de} aoMudar={setDe} opcoes={UNIDADES.map((u) => ({ valor: u.id, rotulo: u.rotulo }))} />
        <p className="text-xs leading-relaxed text-fraca">
          <strong className="text-suave">Por que meu HD de 1 TB aparece com 931 GB?</strong> Fabricantes usam unidades decimais (1 TB = 10¹² bytes); o Windows mostra em binárias (1 TiB = 2⁴⁰ bytes) mas escreve “GB”.
        </p>
      </div>
      <div className="cartao overflow-hidden">
        <table className="w-full text-left text-sm">
          <tbody className="divide-y divide-borda">
            {UNIDADES.map((u) => (
              <tr key={u.id} className={u.id === de ? 'bg-acento-suave' : ''}>
                <th scope="row" className="px-4 py-2.5 font-medium text-suave">{u.rotulo}</th>
                <td className="px-4 py-2.5 text-right font-mono text-tinta tabular-nums">{Number.isFinite(n) ? fmt(converter(n, de, u.id)) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
