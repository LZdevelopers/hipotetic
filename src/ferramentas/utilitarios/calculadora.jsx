
import { Entrada, Seletor } from '../../componentes/ui'
import { formatarBytes } from '../../nucleo/arquivos'
import { UNIDADES, converter } from './unidades'
import { useSalvo } from '../../nucleo/salvo'

const VELOCIDADES = [
  { id: 'kbps', rotulo: 'kbit/s', bits: 1e3 },
  { id: 'Mbps', rotulo: 'Mbit/s (Mega)', bits: 1e6 },
  { id: 'Gbps', rotulo: 'Gbit/s', bits: 1e9 },
  { id: 'MBps', rotulo: 'MB/s (megabytes)', bits: 8e6 },
]

function duracao(segundos) {
  if (!Number.isFinite(segundos) || segundos < 0) return '—'
  if (segundos < 1) return 'menos de 1 segundo'
  const d = Math.floor(segundos / 86400)
  const h = Math.floor((segundos % 86400) / 3600)
  const m = Math.floor((segundos % 3600) / 60)
  const s = Math.round(segundos % 60)
  return [d && `${d} d`, h && `${h} h`, m && `${m} min`, !d && s && `${s} s`].filter(Boolean).join(' ')
}

const num = (v) => Number(String(v).replace(',', '.'))
const opcoesUnidade = UNIDADES.filter((u) => u.id !== 'bit').map((u) => ({ valor: u.id, rotulo: u.id }))

/** Tempo de download/upload e taxa de compressão. */
export default function Calculadora() {
  const [tam, setTam] = useSalvo('tamanho', { valor: '4.7', unidade: 'GB' })
  const [vel, setVel] = useSalvo('velocidade', { valor: '100', unidade: 'Mbps' })
  const [comp, setComp] = useSalvo('comparar', { antes: '120', depois: '45', unidade: 'MB' })

  const bytes = converter(num(tam.valor), tam.unidade, 'B')
  const bitsPorSegundo = num(vel.valor) * VELOCIDADES.find((v) => v.id === vel.unidade).bits
  const segundos = (bytes * 8) / bitsPorSegundo
  const antes = num(comp.antes)
  const depois = num(comp.depois)
  const reducao = antes > 0 ? (1 - depois / antes) * 100 : NaN

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <section className="cartao flex flex-col gap-4 p-4 sm:p-5" aria-labelledby="t-transferencia">
        <h2 id="t-transferencia" className="text-base">
          Tempo de download ou upload
        </h2>
        <div className="grid grid-cols-[minmax(0,1fr)_7rem] gap-3">
          <Entrada rotulo="Tamanho do arquivo" valor={tam.valor} aoMudar={(v) => setTam((t) => ({ ...t, valor: v }))} inputMode="decimal" />
          <Seletor rotulo="Unidade" valor={tam.unidade} aoMudar={(v) => setTam((t) => ({ ...t, unidade: v }))} opcoes={opcoesUnidade} />
        </div>
        <div className="grid grid-cols-[minmax(0,1fr)_9rem] gap-3">
          <Entrada rotulo="Velocidade da internet" valor={vel.valor} aoMudar={(v) => setVel((t) => ({ ...t, valor: v }))} inputMode="decimal" />
          <Seletor rotulo="Unidade" valor={vel.unidade} aoMudar={(v) => setVel((t) => ({ ...t, unidade: v }))} opcoes={VELOCIDADES.map((v) => ({ valor: v.id, rotulo: v.rotulo }))} />
        </div>
        <div className="rounded-xl bg-fundo-suave p-4">
          <p className="text-xs text-fraca">Tempo estimado</p>
          <p className="mt-1 font-display text-2xl font-bold text-tinta" aria-live="polite">
            {duracao(segundos)}
          </p>
          <p className="mt-1 text-xs text-fraca">Na prática, conte de 10% a 30% a mais: protocolos e oscilações da rede “comem” parte da velocidade.</p>
        </div>
      </section>

      <section className="cartao flex flex-col gap-4 p-4 sm:p-5" aria-labelledby="t-compressao">
        <h2 id="t-compressao" className="text-base">
          Taxa de compressão
        </h2>
        <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_7rem] gap-3">
          <Entrada rotulo="Antes" valor={comp.antes} aoMudar={(v) => setComp((c) => ({ ...c, antes: v }))} inputMode="decimal" />
          <Entrada rotulo="Depois" valor={comp.depois} aoMudar={(v) => setComp((c) => ({ ...c, depois: v }))} inputMode="decimal" />
          <Seletor rotulo="Unidade" valor={comp.unidade} aoMudar={(v) => setComp((c) => ({ ...c, unidade: v }))} opcoes={opcoesUnidade} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-fundo-suave p-4">
            <p className="text-xs text-fraca">Redução</p>
            <p className="mt-1 font-display text-2xl font-bold text-tinta">{Number.isFinite(reducao) ? `${reducao.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%` : '—'}</p>
          </div>
          <div className="rounded-xl bg-fundo-suave p-4">
            <p className="text-xs text-fraca">Proporção</p>
            <p className="mt-1 font-display text-2xl font-bold text-tinta">{depois > 0 && antes > 0 ? `${(antes / depois).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} : 1` : '—'}</p>
          </div>
        </div>
        <p className="text-xs text-fraca">Economia: {Number.isFinite(antes - depois) ? formatarBytes(converter(Math.max(0, antes - depois), comp.unidade, 'B')) : '—'}</p>
      </section>
    </div>
  )
}
