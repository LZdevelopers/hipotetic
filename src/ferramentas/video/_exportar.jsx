import { useEffect, useRef, useState } from 'react'
import { tempo } from '../../componentes/editor/Comum'
import { Icone } from '../../componentes/Icone'
import { Botao, Caixa, Segmentado } from '../../componentes/ui'
import { MAX_SEGUNDOS_GIF, PADRAO_GIF, QUALIDADES_VIDEO, duracaoTotal, emMB, estimarBytes, quadroGif, tamanhoFinal } from './_projeto'

export const FORMATOS = [
  { id: 'mp4', rotulo: 'MP4', dica: 'H.264 · abre em tudo' },
  { id: 'mov', rotulo: 'MOV', dica: 'QuickTime · Apple' },
  { id: 'mkv', rotulo: 'MKV', dica: 'Matroska' },
  { id: 'webm', rotulo: 'WebM', dica: 'VP9 · para a web' },
  { id: 'gif', rotulo: 'GIF', dica: 'Animado · sem som' },
  { id: 'mp3', rotulo: 'MP3', dica: 'Só o áudio' },
]

/** Nome de arquivo sem caracteres que o sistema não aceita. */
export const limparNome = (nome) =>
  String(nome ?? '')
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120)

const opcaoCartao = (ativo) =>
  `flex flex-col items-start gap-0.5 rounded-xl border-2 px-3 py-2.5 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-45 ${ativo ? 'border-acento bg-acento-suave' : 'border-borda bg-superficie hover:border-borda-forte'}`

/**
 * Modal de exportação: nome do arquivo, formato (vídeo, GIF ou só o áudio),
 * resolução, qualidade com o tamanho estimado de cada opção (ou um tamanho
 * exato em MB), FPS e as opções do GIF. As escolhas ficam salvas no projeto.
 */
export function DialogoExportar({ aberto, aoFechar, p, fontes, nomePadrao, aoExportar }) {
  const dialogo = useRef(null)
  const [o, setO] = useState(null)

  useEffect(() => {
    const d = dialogo.current
    if (aberto) {
      setO({ nome: p.nome || nomePadrao, formato: p.formato, resolucao: p.resolucao, qualidade: p.qualidade, alvoMB: p.alvoMB || 10, fps: p.fps || 30, gif: { ...PADRAO_GIF, ...p.gif } })
      if (!d.open) d.showModal()
    } else if (d.open) d.close()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto])

  const T = duracaoTotal(p)
  const podeGif = T <= MAX_SEGUNDOS_GIF + 0.05
  const m = (d) => setO((x) => ({ ...x, ...d }))
  const q = o ? { ...p, ...o } : p
  const original = tamanhoFinal({ ...p, resolucao: 0 }, fontes)
  const final = tamanhoFinal(q, fontes)
  const menor = Math.min(original.w, original.h)
  const resolucoes = [{ valor: 0, rotulo: `Original (${original.w} × ${original.h})` }, ...[2160, 1440, 1080, 720, 480, 360].filter((r) => r < menor).map((r) => ({ valor: r, rotulo: `${r}p` }))]
  const video = o && o.formato !== 'gif' && o.formato !== 'mp3'
  const estimado = o ? estimarBytes(p, fontes, o) : 0
  const ext = o?.formato ?? 'mp4'
  const g = o ? quadroGif(q, final) : null

  const confirmar = (e) => {
    e?.preventDefault()
    const nome = limparNome(o.nome) || nomePadrao
    aoExportar({ ...o, nome, formato: o.formato === 'gif' && !podeGif ? 'mp4' : o.formato })
  }

  return (
    <dialog
      ref={dialogo}
      onClose={aoFechar}
      aria-labelledby="titulo-exportar"
      className="m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-2xl overflow-hidden rounded-2xl border border-borda bg-superficie p-0 text-texto shadow-[var(--shadow-flutuante)] backdrop:bg-sobreposicao"
    >
      {aberto && o ? (
        <form onSubmit={confirmar} className="flex max-h-[calc(100dvh-2rem)] flex-col">
          <div className="flex items-center gap-3 border-b border-borda px-5 py-4">
            <h2 id="titulo-exportar" className="flex-1 text-lg">
              Exportar
            </h2>
            <button type="button" onClick={aoFechar} aria-label="Fechar" className="grid size-9 place-items-center rounded-full text-suave hover:bg-superficie-2 hover:text-tinta">
              <Icone nome="fechar" tamanho={18} />
            </button>
          </div>

          <div className="rolagem-fina flex flex-1 flex-col gap-6 overflow-y-auto px-5 py-5">
            {/* Nome */}
            <label className="flex flex-col gap-1.5 text-[0.8125rem] font-semibold text-tinta">
              Nome do arquivo
              <span className="flex items-center rounded-lg border border-borda-forte bg-superficie focus-within:border-acento">
                <input
                  value={o.nome}
                  onChange={(e) => m({ nome: e.target.value })}
                  aria-label="Nome do arquivo"
                  spellCheck={false}
                  className="h-10 min-w-0 flex-1 bg-transparent px-3 text-sm font-medium text-tinta focus:outline-none"
                />
                <span className="pr-3 text-sm text-fraca">.{ext}</span>
              </span>
            </label>

            {/* Formato */}
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-2 text-[0.8125rem] font-semibold text-tinta">Formato</legend>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {FORMATOS.map((f) => {
                  const bloqueado = f.id === 'gif' && !podeGif
                  return (
                    <button key={f.id} type="button" role="radio" aria-checked={o.formato === f.id} disabled={bloqueado} onClick={() => m({ formato: f.id })} className={opcaoCartao(o.formato === f.id)} title={bloqueado ? `GIF só para vídeos de até ${MAX_SEGUNDOS_GIF} s (este tem ${tempo(T)})` : undefined}>
                      <span className="text-sm font-bold text-tinta">{f.rotulo}</span>
                      <span className="text-xs text-fraca">{bloqueado ? `Até ${MAX_SEGUNDOS_GIF} s de vídeo` : f.dica}</span>
                    </button>
                  )
                })}
              </div>
            </fieldset>

            {video ? (
              <>
                <Segmentado rotulo="Resolução" valor={o.resolucao} aoMudar={(v) => m({ resolucao: v })} opcoes={resolucoes} />

                {/* Qualidade, com o tamanho de cada opção */}
                <fieldset className="flex flex-col gap-2">
                  <legend className="mb-2 text-[0.8125rem] font-semibold text-tinta">Qualidade</legend>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {QUALIDADES_VIDEO.map((x) => (
                      <button key={x.id} type="button" role="radio" aria-checked={o.qualidade === x.id} onClick={() => m({ qualidade: x.id })} className={opcaoCartao(o.qualidade === x.id)}>
                        <span className="flex w-full items-baseline gap-2">
                          <span className="text-sm font-bold text-tinta">{x.rotulo}</span>
                          <span className="ml-auto text-xs font-semibold text-suave tabular-nums">~{emMB(estimarBytes(p, fontes, { ...o, qualidade: x.id }))}</span>
                        </span>
                        <span className="text-xs text-fraca">{x.dica}</span>
                      </button>
                    ))}
                    <div className={opcaoCartao(o.qualidade === 'alvo')}>
                      <button type="button" role="radio" aria-checked={o.qualidade === 'alvo'} onClick={() => m({ qualidade: 'alvo' })} className="text-left">
                        <span className="text-sm font-bold text-tinta">Tamanho exato</span>
                        <span className="block text-xs text-fraca">A qualidade se ajusta para caber.</span>
                      </button>
                      <label className="mt-1 flex items-center gap-1.5 text-xs text-fraca">
                        <input
                          type="number"
                          min={1}
                          max={4000}
                          step={1}
                          value={o.alvoMB}
                          onFocus={() => m({ qualidade: 'alvo' })}
                          onChange={(e) => m({ qualidade: 'alvo', alvoMB: Math.max(1, Number(e.target.value) || 1) })}
                          aria-label="Tamanho do arquivo em MB"
                          className="h-8 w-20 rounded-lg border border-borda-forte bg-superficie px-2 text-sm font-semibold text-tinta tabular-nums focus:border-acento focus:outline-none"
                        />
                        MB
                      </label>
                    </div>
                  </div>
                </fieldset>

                <Segmentado
                  rotulo="Quadros por segundo (FPS)"
                  valor={o.fps}
                  aoMudar={(v) => m({ fps: v })}
                  opcoes={[24, 25, 30, 60].map((v) => ({ valor: v, rotulo: `${v} fps` }))}
                />
              </>
            ) : null}

            {o.formato === 'gif' ? (
              <>
                <Segmentado
                  rotulo="Largura do GIF"
                  valor={Math.min(o.gif.largura, final.w)}
                  aoMudar={(v) => m({ gif: { ...o.gif, largura: v } })}
                  opcoes={[...new Set([320, 480, 640, 800].filter((v) => v < final.w).concat(Math.min(800, final.w)))].map((v) => ({ valor: v, rotulo: `${v} px` }))}
                />
                <Segmentado rotulo="Quadros por segundo" valor={o.gif.fps} aoMudar={(v) => m({ gif: { ...o.gif, fps: v } })} opcoes={[10, 15, 20, 25].map((v) => ({ valor: v, rotulo: `${v} fps` }))} />
                <Caixa rotulo="Repetir sem parar (loop)" marcado={o.gif.loop} aoMudar={(v) => m({ gif: { ...o.gif, loop: v } })} />
                <p className="text-xs text-fraca">O GIF não tem som. Para arquivos menores, diminua a largura ou o FPS.</p>
              </>
            ) : null}

            {o.formato === 'mp3' ? <p className="text-sm text-suave">Só o áudio do vídeo montado (som dos clipes, trilha e ajustes da aba Áudio), em MP3 de 192 kbps.</p> : null}
          </div>

          <div className="flex flex-wrap items-center gap-3 border-t border-borda bg-fundo-suave px-5 py-4">
            <div className="min-w-0 flex-1 text-xs text-fraca tabular-nums">
              <p className="text-sm font-semibold text-tinta">
                Tamanho estimado: <span data-estimativa="">~{emMB(estimado)}</span>
              </p>
              <p>
                {o.formato === 'mp3' ? 'Áudio' : o.formato === 'gif' ? `${g.w} × ${g.h} px · ${g.fps} fps` : `${final.w} × ${final.h} px · ${o.fps} fps`} · {tempo(T)}
              </p>
            </div>
            <Botao variante="secundario" onClick={aoFechar}>
              Cancelar
            </Botao>
            <Botao type="submit" icone="baixar" data-exportar="">
              Exportar {FORMATOS.find((f) => f.id === o.formato)?.rotulo}
            </Botao>
          </div>
        </form>
      ) : null}
    </dialog>
  )
}
