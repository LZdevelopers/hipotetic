import { Link } from '../../nucleo/roteador'
import { rodape } from '../../textos'
import { AssinaturaLzdev, Marca } from './Marca'

const LINKS = [{ rotulo: 'Converter arquivos', para: '/converter' }, { rotulo: 'Todas as ferramentas', para: '/ferramentas' }, ...rodape.links]

/** Rodapé compacto: marca e assinatura de um lado, links do outro. */
export function Rodape() {
  return (
    <footer className="mt-20 border-t border-borda bg-fundo-suave">
      <div className="container-pagina flex flex-col gap-4 py-6 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <Marca />
          <AssinaturaLzdev />
        </div>
        <nav aria-label="Rodapé">
          <ul className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
            {LINKS.map((l) => (
              <li key={l.para}>
                <Link para={l.para} className="text-suave transition-colors hover:text-tinta">
                  {l.rotulo}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
      <div className="border-t border-borda">
        <p className="container-pagina py-3 text-xs text-fraca">
          © {new Date().getFullYear()} LZdev · {rodape.frase} Grátis, sem anúncios e sem cadastro.
        </p>
      </div>
    </footer>
  )
}
