import { categoriasComFerramentas } from '../../ferramentas/catalogo'
import { Link } from '../../nucleo/roteador'
import { rodape } from '../../textos'
import { AssinaturaLzdev, Marca } from './Marca'

/** Rodapé enxuto: marca, categorias e links legais (as ferramentas ficam no menu do topo). */
export function Rodape() {
  return (
    <footer className="mt-24 border-t border-borda bg-fundo-suave">
      <div className="container-pagina flex flex-col gap-10 py-12 md:flex-row md:items-start md:justify-between">
        <div className="flex flex-col items-start gap-4">
          <Marca />
          <p className="max-w-xs text-sm text-suave">{rodape.frase}</p>
          <AssinaturaLzdev />
        </div>
        <nav aria-label="Categorias">
          <p className="text-sm font-semibold text-tinta">Ferramentas</p>
          <ul className="mt-3 grid grid-cols-2 gap-x-10 gap-y-2">
            {categoriasComFerramentas().map((c) => (
              <li key={c.id}>
                <Link para={`/${c.id}`} className="text-sm text-suave transition-colors hover:text-tinta">
                  {c.nome}
                </Link>
              </li>
            ))}
          </ul>
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
