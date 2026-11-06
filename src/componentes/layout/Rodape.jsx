import { categoriasComFerramentas, caminhoDa, ferramentasDaCategoria } from '../../ferramentas/catalogo'
import { Link } from '../../nucleo/roteador'
import { rodape } from '../../textos'
import { AssinaturaLzdev, Marca } from './Marca'

export function Rodape() {
  const categorias = categoriasComFerramentas()
  return (
    <footer className="mt-24 border-t border-borda bg-fundo-suave">
      <div className="container-pagina grid gap-10 py-12 md:grid-cols-[16rem_minmax(0,1fr)]">
        <div className="flex flex-col items-start gap-4">
          <Marca />
          <p className="max-w-xs text-sm text-suave">{rodape.frase}</p>
          <AssinaturaLzdev />
        </div>
        <nav aria-label="Ferramentas" className="grid grid-cols-2 gap-x-6 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
          {categorias.map((c) => (
            <div key={c.id}>
              <Link para={`/${c.id}`} className="text-sm font-semibold text-tinta hover:underline">
                {c.nome}
              </Link>
              <ul className="mt-3 flex flex-col gap-2">
                {ferramentasDaCategoria(c.id)
                  .slice(0, 6)
                  .map((f) => (
                    <li key={f.slug}>
                      <Link para={caminhoDa(f)} className="text-sm text-suave transition-colors hover:text-tinta">
                        {f.nome}
                      </Link>
                    </li>
                  ))}
              </ul>
            </div>
          ))}
        </nav>
      </div>
      <div className="border-t border-borda">
        <div className="container-pagina flex flex-wrap items-center justify-between gap-3 py-5 text-xs text-fraca">
          <p>© {new Date().getFullYear()} LZdev. Grátis, sem anúncios e sem cadastro.</p>
          <ul className="flex gap-5">
            {rodape.links.map((l) => (
              <li key={l.para}>
                <Link para={l.para} className="hover:text-tinta">
                  {l.rotulo}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </footer>
  )
}
