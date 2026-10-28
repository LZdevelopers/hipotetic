import { Icon } from '../primitives/Icon'

/**
 * Prévia do conteúdo, no formato que a fonte permite:
 *  - iframe  · player oficial da plataforma (YouTube, TikTok);
 *  - video   · <video> nativo tocando direto da origem;
 *  - audio   · capa + <audio> nativo.
 * O controle de download dos players nativos (menu ⋮) continua disponível,
 * como na referência — o navegador cuida disso, não nós.
 */
export function MediaPlayer({ player, title, thumbnail }) {
  if (!player) {
    return thumbnail ? (
      <img src={thumbnail} alt="" className="aspect-video w-full rounded-2xl object-cover" loading="lazy" />
    ) : (
      <div className="grid aspect-video w-full place-items-center rounded-2xl bg-surface-2 text-faint">
        <Icon name="film" size={32} />
      </div>
    )
  }

  if (player.tipo === 'iframe') {
    const vertical = player.proporcao === '9/16'
    return (
      <div className={`mx-auto w-full overflow-hidden rounded-2xl bg-black ${vertical ? 'max-w-[20rem]' : ''}`}>
        <iframe
          src={player.src}
          title={`Player: ${title}`}
          className="block w-full"
          style={{ aspectRatio: player.proporcao }}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          referrerPolicy="strict-origin-when-cross-origin"
          allowFullScreen
          loading="lazy"
        />
      </div>
    )
  }

  if (player.tipo === 'audio') {
    return (
      <div className="flex flex-col gap-4 rounded-2xl bg-surface-2/70 p-4">
        {thumbnail ? (
          <img src={thumbnail} alt="" className="mx-auto aspect-square w-full max-w-[16rem] rounded-xl object-cover" loading="lazy" />
        ) : (
          <div className="mx-auto grid aspect-square w-full max-w-[16rem] place-items-center rounded-xl bg-black/40 text-faint">
            <Icon name="music" size={40} />
          </div>
        )}
        <audio controls preload="metadata" src={player.src} className="w-full">
          Seu navegador não reproduz este áudio.
        </audio>
      </div>
    )
  }

  return (
    <video
      controls
      preload="metadata"
      playsInline
      poster={player.poster ?? undefined}
      src={player.src}
      className="aspect-video w-full rounded-2xl bg-black"
    >
      Seu navegador não reproduz este vídeo.
    </video>
  )
}
