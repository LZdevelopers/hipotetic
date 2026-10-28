import { useEffect, useRef, useState } from 'react'
import { platforms } from '../../data/site'
import { useMediaLookup } from '../../hooks/useMediaLookup'
import { Reveal } from '../primitives/Reveal'
import { ResultCard, ResultError, ResultSkeleton } from '../tool/ResultCard'
import { UrlForm } from '../tool/UrlForm'

/**
 * Hero = a própria ferramenta. Promessa curta, campo de link em destaque e o
 * resultado logo abaixo, no mesmo bloco — o usuário nunca sai da dobra para
 * ver o que colou. Título e subtítulo acompanham a rede escolhida nos botões.
 */
export function Hero() {
  const { status, media, error, lookup, reset } = useMediaLookup()
  const resultRef = useRef(null)
  const [platformId, setPlatformId] = useState(platforms[0].id)
  // Só anima depois da primeira troca: na entrada da página quem anima é o Reveal.
  const [switched, setSwitched] = useState(false)
  const platform = platforms.find((p) => p.id === platformId)

  const changePlatform = (id) => {
    if (id === platformId) return
    setPlatformId(id)
    setSwitched(true)
  }

  // No celular o resultado nasce abaixo da dobra: rola até ele quando chega.
  useEffect(() => {
    if (status === 'success' && window.innerWidth < 1024) {
      resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [status, media])

  // A `key` recria o texto a cada troca, o que dispara a animação de novo.
  const swap = switched ? 'animate-swap' : ''

  return (
    <section id="inicio" className="relative pt-28 pb-10 sm:pt-32">
      <div className="container-page">
        <div className="mx-auto flex max-w-3xl flex-col items-center text-center">
          <Reveal>
            <h1 key={platform.id} className={`text-[clamp(2.3rem,6.4vw,4.4rem)] lg:-mx-24 ${swap}`}>
              <span className="block text-ink">{platform.title[0]}</span>
              <span className="block text-gradient pb-1">{platform.title[1]}</span>
            </h1>
          </Reveal>

          <Reveal delay={80}>
            <p
              key={platform.id}
              className={`mt-5 max-w-2xl text-base leading-relaxed text-muted sm:text-lg ${swap}`}
              style={switched ? { animationDelay: '80ms' } : undefined}
            >
              {platform.subtitle}
            </p>
          </Reveal>

          <Reveal delay={160} className="mt-8 w-full">
            <UrlForm platformId={platformId} onPlatformChange={changePlatform} onSubmit={lookup} loading={status === 'loading'} />
          </Reveal>
        </div>

        <div ref={resultRef} className={`mx-auto max-w-5xl scroll-mt-28 ${status === 'idle' ? '' : 'mt-10'}`} aria-live="polite">
          {status === 'loading' ? <ResultSkeleton /> : null}
          {status === 'error' ? (
            <div className="mx-auto max-w-3xl">
              <ResultError message={error} onReset={reset} />
            </div>
          ) : null}
          {status === 'success' && media ? (
            <ResultCard key={media.origem} media={media} onReset={reset} />
          ) : null}
        </div>
      </div>
    </section>
  )
}
