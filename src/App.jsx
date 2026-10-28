import { Footer } from './components/layout/Footer'
import { GridBackdrop } from './components/layout/GridBackdrop'
import { Navbar } from './components/layout/Navbar'
import { Faq } from './components/sections/Faq'
import { Hero } from './components/sections/Hero'
import { HowTo } from './components/sections/HowTo'
import { Legal } from './components/sections/Legal'
import { useReveal } from './hooks/useReveal'

export default function App() {
  useReveal()

  return (
    <>
      <GridBackdrop />

      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[60] focus:rounded-lg focus:bg-brand focus:px-4 focus:py-2.5 focus:text-sm focus:font-semibold focus:text-bg"
      >
        Ir para o conteúdo
      </a>

      <Navbar />

      <main id="conteudo">
        {/* Ferramenta primeiro; o resto responde as dúvidas e "posso confiar?" */}
        <Hero />
        <HowTo />
        <Faq />
        <Legal />
      </main>

      <Footer />
    </>
  )
}
