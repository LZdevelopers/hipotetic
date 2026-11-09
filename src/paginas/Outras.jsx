import { Pilulas } from '../componentes/ListaFerramentas'
import { BotaoLink } from '../componentes/ui'
import { populares } from '../ferramentas/catalogo'
import { paginas, textos } from '../textos'

export function Texto({ pagina }) {
  const p = paginas[pagina]
  return (
    <div className="container-pagina max-w-3xl pt-12">
      <h1 className="text-[clamp(1.75rem,3.6vw,2.5rem)]">{p.titulo}</h1>
      <p className="mt-3 text-suave">{p.descricao}</p>
      {p.secoes.map((s) => (
        <section key={s.titulo} className="mt-10">
          <h2 className="text-lg">{s.titulo}</h2>
          <ul className="mt-4 flex list-disc flex-col gap-3 pl-5 text-sm text-texto marker:text-fraca">
            {s.itens.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}

export function NaoEncontrada() {
  return (
    <div className="container-pagina pt-16">
      <div className="mx-auto max-w-xl text-center">
        <p className="font-display text-6xl font-extrabold text-fraca tabular-nums">404</p>
        <h1 className="mt-4 text-2xl">Página não encontrada</h1>
        <p className="mt-3 text-suave">O endereço pode ter mudado ou a ferramenta não existe. Use a busca (Ctrl+K) ou volte ao início.</p>
        <BotaoLink para="/" className="mt-6" icone="inicio">
          Ir para o início
        </BotaoLink>
      </div>
      <section className="mt-16">
        <h2 className="mb-4 text-lg">{textos.maisUsadas}</h2>
        <Pilulas lista={populares()} />
      </section>
    </div>
  )
}
