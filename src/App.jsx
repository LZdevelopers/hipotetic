import { useEffect } from 'react'
import { Cabecalho } from './componentes/layout/Cabecalho'
import { Rodape } from './componentes/layout/Rodape'
import { Ferramenta } from './paginas/Ferramenta'
import { Ferramentas } from './paginas/Ferramentas'
import { Inicio } from './paginas/Inicio'
import { NaoEncontrada, Texto } from './paginas/Outras'
import { metadadosDa, resolverRota } from './nucleo/rotas'
import { Roteador, useRota } from './nucleo/roteador'
import { textos } from './textos'

/** Atualiza <title>, description e canonical a cada navegação interna. */
function useMetadados(rota) {
  useEffect(() => {
    const m = metadadosDa(rota)
    document.title = m.titulo
    const definir = (seletor, atributo, valor) => document.querySelector(seletor)?.setAttribute(atributo, valor)
    definir('meta[name="description"]', 'content', m.descricao)
    definir('link[rel="canonical"]', 'href', m.url)
    definir('meta[property="og:title"]', 'content', m.titulo)
    definir('meta[property="og:description"]', 'content', m.descricao)
    definir('meta[property="og:url"]', 'content', m.url)
  }, [rota])
}

function Conteudo() {
  const { caminho } = useRota()
  const rota = resolverRota(caminho)
  useMetadados(rota)

  switch (rota.tipo) {
    case 'inicio':
      return <Inicio />
    case 'ferramentas':
      return <Ferramentas />
    case 'ferramenta':
      return <Ferramenta key={rota.ferramenta.slug} ferramenta={rota.ferramenta} />
    case 'texto':
      return <Texto pagina={rota.pagina} />
    default:
      return <NaoEncontrada />
  }
}

export default function App({ caminho }) {
  // Marca que a página hidratou (os testes esperam por isso antes de interagir).
  useEffect(() => {
    document.documentElement.dataset.pronto = 'sim'
  }, [])

  return (
    <Roteador caminhoInicial={caminho}>
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[60] focus:rounded-lg focus:bg-marca focus:px-4 focus:py-2.5 focus:text-sm focus:font-semibold focus:text-sobre-marca"
      >
        {textos.pularParaConteudo}
      </a>
      <Cabecalho />
      <main id="conteudo" className="min-h-[60vh]">
        <Conteudo />
      </main>
      <Rodape />
    </Roteador>
  )
}
