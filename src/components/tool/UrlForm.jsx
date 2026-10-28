import { useState } from 'react'
import { platforms } from '../../data/site'
import { Icon } from '../primitives/Icon'

const canPaste = typeof navigator !== 'undefined' && Boolean(navigator.clipboard?.readText)

/** Rede do link colado (pelo host), ou null se não for de nenhuma delas. */
function detectPlatform(text) {
  try {
    const host = new URL(/^https?:\/\//i.test(text) ? text : `https://${text}`).hostname.replace(/^(www|m|mobile)\./, '')
    return platforms.find((p) => p.hosts.includes(host)) ?? null
  } catch {
    return null
  }
}

/** Botões de rede acima do campo: mudam o título do Hero e o texto do input. */
function PlatformPicker({ active, onChange }) {
  return (
    <div role="radiogroup" aria-label="Rede social" className="mb-3 flex flex-wrap justify-center gap-2">
      {platforms.map((p) => {
        const selected = p.id === active
        return (
          <button
            key={p.id}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(p.id)}
            className={`inline-flex h-10 items-center gap-2 rounded-full border px-4 text-sm font-semibold transition-[border-color,background-color,color] duration-300 ${
              selected
                ? 'border-white/40 bg-white/[0.1] text-ink'
                : 'border-white/10 bg-white/[0.02] text-muted hover:border-white/25 hover:text-ink'
            }`}
          >
            <Icon name={p.icon} size={16} colored={selected} />
            {p.name}
          </button>
        )
      })}
    </div>
  )
}

/**
 * Campo principal: os botões de rede e uma cápsula com o input e o botão de
 * ação, como a busca do Hero da LZdev. Colar um link já dispara a consulta —
 * é o caminho de 99% dos usos — e troca o botão de rede para a do link.
 */
export function UrlForm({ platformId, onPlatformChange, onSubmit, loading }) {
  const [value, setValue] = useState('')
  const platform = platforms.find((p) => p.id === platformId)

  const submit = (url) => {
    const clean = url.trim()
    if (!clean) return
    const detected = detectPlatform(clean)
    if (detected) onPlatformChange(detected.id)
    onSubmit(clean)
  }

  const pasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText()
      if (!text) return
      setValue(text)
      submit(text)
    } catch {
      // Permissão negada: o usuário ainda pode colar com Ctrl+V no campo.
    }
  }

  return (
    <div className="w-full">
      <PlatformPicker active={platformId} onChange={onPlatformChange} />
      <form
        onSubmit={(event) => {
          event.preventDefault()
          submit(value)
        }}
        className="group/form relative flex w-full flex-col gap-2 rounded-[1.4rem] border border-white/12 bg-surface/80 p-2 shadow-[0_24px_80px_-36px_rgb(255_255_255/0.25)] backdrop-blur-md transition-[border-color,box-shadow] duration-300 focus-within:border-white/35 focus-within:shadow-[0_24px_90px_-30px_rgb(255_255_255/0.35)] sm:flex-row sm:items-center sm:rounded-full"
      >
        <label htmlFor="media-url" className="sr-only">
          Link do vídeo do {platform.name}
        </label>
        <span className="pointer-events-none absolute top-[1.45rem] left-5 text-faint sm:top-1/2 sm:-translate-y-1/2" aria-hidden="true">
          <Icon name={platform.icon} size={18} />
        </span>
        <input
          id="media-url"
          type="url"
          inputMode="url"
          autoComplete="off"
          spellCheck="false"
          placeholder={platform.placeholder}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onPaste={(event) => {
            const text = event.clipboardData.getData('text')
            if (!text) return
            event.preventDefault()
            setValue(text.trim())
            submit(text)
          }}
          className="h-12 w-full min-w-0 bg-transparent sm:flex-1 pr-3 pl-11 text-[0.95rem] text-ink placeholder:text-faint focus:outline-none sm:h-13"
          // O anel de foco fica no formulário inteiro (focus-within), não no input.
          style={{ outline: 'none' }}
        />

        <div className="flex gap-2">
          {canPaste && !value ? (
            <button
              type="button"
              onClick={pasteFromClipboard}
              className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-full border border-white/12 bg-white/[0.03] px-4 text-sm font-semibold text-muted transition-colors hover:border-white/30 hover:text-ink sm:h-13 sm:flex-none"
            >
              <Icon name="clipboard" size={16} />
              Colar
            </button>
          ) : null}
          <button
            type="submit"
            disabled={loading}
            className="group relative inline-flex h-12 flex-1 items-center justify-center gap-2 overflow-hidden rounded-full bg-brand px-6 text-sm font-semibold text-bg shadow-[0_10px_36px_-12px_rgb(255_255_255/0.3)] transition-[background-color,box-shadow,transform] duration-300 hover:bg-brand-hover active:translate-y-px disabled:opacity-70 sm:h-13 sm:flex-none"
          >
            {loading ? (
              <span className="size-4 rounded-full border-2 border-bg/25 border-t-bg animate-spin-slow" aria-hidden="true" />
            ) : (
              <Icon name="arrowRight" size={17} />
            )}
            <span className="relative z-10">{loading ? 'Buscando…' : 'Buscar'}</span>
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 -translate-x-[120%] skew-x-[-18deg] bg-black/20 blur-md group-hover:animate-sheen motion-reduce:hidden"
            />
          </button>
        </div>
      </form>
    </div>
  )
}
