import { useState } from 'react'
import { Icon } from '../primitives/Icon'
import { DownloadTable, TipoToggle } from './DownloadTable'

const ESCOLHAS = [
  { tipo: 'video', icon: 'film', titulo: 'Vídeo', texto: 'Com imagem e som' },
  { tipo: 'audio', icon: 'music', titulo: 'Áudio', texto: 'Só o som, em MP3 e outros' },
]

/**
 * Downloads, direto no cartão do resultado (sem janela por cima):
 *  1. pergunta o que a pessoa quer — Vídeo ou Áudio;
 *  2. mostra a tabela daquele tipo, com a alternância para trocar depois.
 * Se a fonte só tem um tipo, pula direto para a tabela. As duas tabelas ficam
 * montadas e só a inativa é escondida: trocar de aba não perde um arquivo que
 * já está sendo preparado.
 */
export function DownloadPanel({ media }) {
  const tipos = [...new Set(media.formatos.map((f) => f.tipo))]
  const [tipo, setTipo] = useState(tipos.length === 1 ? tipos[0] : null)

  if (!tipo) {
    return (
      <div>
        <p className="text-sm font-semibold text-ink">O que você quer baixar?</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {ESCOLHAS.filter((e) => tipos.includes(e.tipo)).map((escolha) => (
            <button
              key={escolha.tipo}
              type="button"
              onClick={() => setTipo(escolha.tipo)}
              className="group flex items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-left transition-[border-color,background-color] duration-300 hover:border-white/30 hover:bg-white/[0.06]"
            >
              <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand text-bg">
                <Icon name={escolha.icon} size={20} />
              </span>
              <span>
                <span className="block text-base font-bold text-ink">{escolha.titulo}</span>
                <span className="block text-xs text-muted">{escolha.texto}</span>
              </span>
            </button>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div>
      {tipos.length > 1 ? (
        <div className="mb-3">
          <TipoToggle tipos={tipos} ativo={tipo} onChange={setTipo} />
        </div>
      ) : null}
      {tipos.map((t) => (
        <div key={t} hidden={t !== tipo}>
          <DownloadTable formatos={media.formatos} tipo={t} titulo={media.titulo} />
        </div>
      ))}
    </div>
  )
}
