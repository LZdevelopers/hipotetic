import { formatDuration, SOURCE_META, UNAVAILABLE } from '../../lib/media'
import { Button } from '../primitives/Button'
import { Icon } from '../primitives/Icon'
import { DownloadPanel } from './DownloadPanel'
import { MediaPlayer } from './MediaPlayer'

function Meta({ icon, children }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-sm text-muted">
      <Icon name={icon} size={15} className="text-faint" />
      {children}
    </span>
  )
}

/**
 * Resultado de um link: player à esquerda, informações e downloads à direita
 * (empilhados no celular). Tudo o que aparece veio da API — campos que a fonte
 * não informa simplesmente não são desenhados.
 */
export function ResultCard({ media, onReset }) {
  const source = SOURCE_META[media.fonte] ?? { name: media.fonte, icon: 'link' }
  const duration = formatDuration(media.duracao)
  const unavailable = !media.download.disponivel ? UNAVAILABLE[media.download.motivo] : null

  return (
    <article
      aria-label={`Resultado: ${media.titulo}`}
      className="card-base border-gradient relative overflow-hidden p-4 text-left sm:p-6"
    >
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:gap-8">
        {/* self-start: sem ele o player estica até a altura da coluna de formatos */}
        <div className="self-start">
          <MediaPlayer player={media.player} title={media.titulo} thumbnail={media.miniatura} />
        </div>

        <div className="flex min-w-0 flex-col">
          <div className="flex items-center justify-between gap-3">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-semibold text-accent">
              <Icon name={source.icon} size={14} colored />
              {source.name}
            </span>
            <button
              type="button"
              onClick={onReset}
              className="grid size-9 place-items-center rounded-lg text-faint transition-colors hover:bg-white/[0.05] hover:text-ink"
              aria-label="Limpar resultado"
            >
              <Icon name="close" size={16} />
            </button>
          </div>

          <h2 className="mt-4 text-[clamp(1.25rem,2.4vw,1.6rem)] leading-tight [overflow-wrap:anywhere] text-ink">{media.titulo}</h2>

          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
            {media.autor ? (
              <Meta icon="user">
                {media.autorUrl ? (
                  <a href={media.autorUrl} target="_blank" rel="noopener noreferrer" className="hover:text-ink">
                    {media.autor}
                  </a>
                ) : (
                  media.autor
                )}
              </Meta>
            ) : null}
            {duration ? <Meta icon="clock">{duration}</Meta> : null}
            {media.licenca ? (
              <Meta icon="scale">
                {media.licencaUrl ? (
                  <a href={media.licencaUrl} target="_blank" rel="noopener noreferrer" className="hover:text-ink">
                    {media.licenca}
                  </a>
                ) : (
                  media.licenca
                )}
              </Meta>
            ) : null}
          </div>

          <div className="mt-6 flex-1">
            {media.download.disponivel ? (
              <DownloadPanel media={media} />
            ) : (
              <div className="rounded-2xl border border-info/25 bg-info/[0.06] p-4 sm:p-5">
                <p className="flex items-center gap-2 text-sm font-semibold text-ink">
                  <Icon name="lock" size={16} className="text-info" />
                  {unavailable?.title ?? 'Download indisponível'}
                </p>
                <p className="mt-2 text-sm leading-relaxed text-muted">{unavailable?.text}</p>
                <Button
                  href={media.origem}
                  target="_blank"
                  rel="noopener noreferrer"
                  variant="outline"
                  className="mt-4"
                  icon="arrowUpRight"
                >
                  {unavailable?.cta ?? 'Abrir na origem'}
                </Button>
              </div>
            )}
          </div>

          {media.download.disponivel ? (
            <a
              href={media.origem}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-flex items-center gap-1.5 self-start text-xs font-medium text-faint transition-colors hover:text-ink"
            >
              Ver página original
              <Icon name="arrowUpRight" size={13} />
            </a>
          ) : null}
        </div>
      </div>
    </article>
  )
}

/** Esqueleto com a mesma geometria do cartão: o layout não pula quando chega. */
export function ResultSkeleton() {
  return (
    <div className="card-base border-gradient relative p-4 sm:p-6" aria-busy="true" aria-label="Buscando informações">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:gap-8">
        <div className="skeleton aspect-video w-full rounded-2xl" />
        <div className="flex flex-col gap-3">
          <div className="skeleton h-7 w-28 rounded-full" />
          <div className="skeleton mt-2 h-7 w-11/12 rounded-lg" />
          <div className="skeleton h-7 w-2/3 rounded-lg" />
          <div className="skeleton mt-2 h-4 w-1/2 rounded" />
          <div className="skeleton mt-4 h-14 w-full rounded-xl" />
          <div className="skeleton h-14 w-full rounded-xl" />
        </div>
      </div>
    </div>
  )
}

export function ResultError({ message, onReset }) {
  return (
    <div role="alert" className="flex items-start gap-3 rounded-2xl border border-danger/30 bg-danger/[0.07] p-4 text-left sm:p-5">
      <Icon name="alert" size={20} className="mt-0.5 shrink-0 text-danger" />
      <p className="flex-1 text-sm leading-relaxed text-ink/90">{message}</p>
      <button
        type="button"
        onClick={onReset}
        className="grid size-8 shrink-0 place-items-center rounded-lg text-faint transition-colors hover:bg-white/[0.05] hover:text-ink"
        aria-label="Fechar aviso"
      >
        <Icon name="close" size={15} />
      </button>
    </div>
  )
}
