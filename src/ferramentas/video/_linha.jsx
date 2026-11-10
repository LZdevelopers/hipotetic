import { Icone } from '../../componentes/Icone'
import { tempo } from '../../componentes/editor/Comum'
import { duracaoClipe, duracaoTotal, iniciosNaLinha } from './_projeto'

const ICONES = { texto: 'texto', imagem: 'imagem', video: 'arquivoVideo', desfoque: 'borracha' }
const NOMES = { texto: 'Texto', imagem: 'Imagem', video: 'Vídeo', desfoque: 'Desfoque' }
const CORES = { texto: 'var(--color-cat-documentos)', imagem: 'var(--color-cat-imagem)', video: 'var(--color-cat-video)', desfoque: 'var(--color-cat-utilitarios)' }

/** Passo das marcas da régua (segundos) para não amontoar. */
function passoRegua(total, largura) {
  const alvo = total / Math.max(1, largura / 70)
  return [0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300, 600].find((p) => p >= alvo) ?? 1200
}

function arrastar(e, mover, fim) {
  e.preventDefault()
  e.stopPropagation()
  const alvo = e.currentTarget
  try {
    alvo.setPointerCapture(e.pointerId)
  } catch {
    /* ponteiro já solto (ou evento sintético): segue sem captura */
  }
  const x0 = e.clientX
  const aoMover = (ev) => mover(ev.clientX - x0, ev)
  const soltar = () => {
    alvo.removeEventListener('pointermove', aoMover)
    alvo.removeEventListener('pointerup', soltar)
    alvo.removeEventListener('pointercancel', soltar)
    fim?.()
  }
  alvo.addEventListener('pointermove', aoMover)
  alvo.addEventListener('pointerup', soltar)
  alvo.addEventListener('pointercancel', soltar)
}

/**
 * Linha do tempo: régua, trilha dos clipes, uma faixa por camada e a música.
 * cabeca: ref do cursor (movido direto pelo editor a cada quadro).
 */
export function LinhaDoTempo({ p, fontes, selecao, aoSelecionar, aoBuscar, aoMudarClipe, aoMudarCamada, cabeca, larguraRef }) {
  const total = duracaoTotal(p)
  const inicios = iniciosNaLinha(p)
  const pct = (t) => `${total ? (t / total) * 100 : 0}%`
  const pxPorSegundo = () => (larguraRef.current?.clientWidth ?? 1) / (total || 1)

  // Clicar/arrastar na régua ou no fundo das trilhas: percorre.
  const percorrer = (e) => {
    if (e.button !== 0 || !total) return
    const area = larguraRef.current
    const r = area.getBoundingClientRect()
    const ir = (x) => aoBuscar(Math.min(Math.max(0, ((x - r.left) / r.width) * total), total))
    ir(e.clientX)
    arrastar(e, (_, ev) => ir(ev.clientX))
  }

  const aparar = (c, lado) => (e) => {
    aoSelecionar({ tipo: 'clipe', id: c.id })
    const c0 = { ...c }
    const k = pxPorSegundo()
    const max = fontes[c.fonte]?.duracao ?? c.fim
    arrastar(e, (dx) => {
      const dt = (dx / k) * c0.velocidade
      if (lado === 'inicio') aoMudarClipe(c.id, { inicio: Math.min(Math.max(0, c0.inicio + dt), c0.fim - 0.1) })
      else aoMudarClipe(c.id, { fim: Math.max(Math.min(max, c0.fim + dt), c0.inicio + 0.1) })
    })
  }

  const moverCamada = (cam, modo) => (e) => {
    aoSelecionar({ tipo: 'camada', id: cam.id })
    const c0 = { ...cam }
    const k = pxPorSegundo()
    arrastar(e, (dx) => {
      const dt = dx / k
      if (modo === 'mover') {
        const d = c0.fim - c0.inicio
        const inicio = Math.min(Math.max(0, c0.inicio + dt), Math.max(0, total - d))
        aoMudarCamada(cam.id, { inicio, fim: inicio + d })
      } else if (modo === 'inicio') aoMudarCamada(cam.id, { inicio: Math.min(Math.max(0, c0.inicio + dt), c0.fim - 0.2) })
      else aoMudarCamada(cam.id, { fim: Math.max(Math.min(total, c0.fim + dt), c0.inicio + 0.2) })
    })
  }

  const passo = passoRegua(total, larguraRef.current?.clientWidth ?? 800)
  const marcas = []
  for (let t = 0; t <= total + 1e-6 && total; t += passo) marcas.push(t)

  const rotulo = 'w-24 shrink-0 flex items-center gap-1.5 px-3 text-[0.6875rem] font-semibold text-fraca uppercase tracking-wide'

  return (
    <div className="max-h-56 overflow-y-auto">
      {/* Régua */}
      <div className="flex border-b border-borda">
        <div className={rotulo} />
        <div className="relative h-7 flex-1 cursor-pointer" onPointerDown={percorrer}>
          {marcas.map((t) => (
            <span key={t} className="pointer-events-none absolute top-0 flex h-full flex-col justify-end pl-1 text-[0.625rem] text-fraca tabular-nums" style={{ left: pct(t) }}>
              <span className="absolute top-0 left-0 h-2 w-px bg-borda-forte" />
              {passo < 1 ? tempo(t) : tempo(t).replace(/\.\d$/, '')}
            </span>
          ))}
        </div>
      </div>

      <div className="relative">
        {/* Trilha de vídeo */}
        <div className="flex">
          <div className={rotulo}>
            <Icone nome="filme" tamanho={13} /> Vídeo
          </div>
          <div ref={larguraRef} className="relative h-16 flex-1 cursor-pointer py-1.5" onPointerDown={percorrer}>
            {p.clipes.length ? null : <p className="pointer-events-none grid h-full place-items-center rounded-lg border border-dashed border-borda text-xs text-fraca">Os vídeos aparecem aqui, em sequência</p>}
            {p.clipes.map((c, i) => {
              const fonte = fontes[c.fonte]
              const sel = selecao?.tipo === 'clipe' && selecao.id === c.id
              return (
                <div
                  key={c.id}
                  role="button"
                  tabIndex={0}
                  aria-label={`Clipe ${i + 1}: ${fonte?.arquivo.name}`}
                  aria-pressed={sel}
                  onPointerDown={(e) => {
                    e.stopPropagation()
                    aoSelecionar({ tipo: 'clipe', id: c.id })
                    percorrer(e)
                  }}
                  onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && aoSelecionar({ tipo: 'clipe', id: c.id })}
                  className={`group absolute top-1.5 bottom-1.5 overflow-hidden rounded-lg border-2 bg-superficie-3 ${sel ? 'z-10 border-acento' : 'border-transparent hover:border-borda-forte'}`}
                  style={{ left: `calc(${pct(inicios[i])} + 1px)`, width: `calc(${pct(duracaoClipe(c))} - 2px)` }}
                >
                  {fonte?.quadros?.length ? (
                    <div className="pointer-events-none absolute inset-0 flex opacity-80">
                      {fonte.quadros.map((q, j) => (
                        <img key={j} src={q} alt="" className="h-full min-w-0 flex-1 object-cover" />
                      ))}
                    </div>
                  ) : null}
                  <span className="pointer-events-none absolute bottom-0.5 left-1.5 max-w-[calc(100%-0.75rem)] truncate rounded bg-black/60 px-1 text-[0.625rem] font-semibold text-white tabular-nums">
                    {c.velocidade !== 1 ? `${c.velocidade.toLocaleString('pt-BR')}× · ` : ''}
                    {tempo(duracaoClipe(c))}
                  </span>
                  <span onPointerDown={aparar(c, 'inicio')} className={`absolute inset-y-0 left-0 w-2.5 cursor-ew-resize bg-acento/90 ${sel ? '' : 'opacity-0 group-hover:opacity-100'}`} aria-label="Aparar o início" />
                  <span onPointerDown={aparar(c, 'fim')} className={`absolute inset-y-0 right-0 w-2.5 cursor-ew-resize bg-acento/90 ${sel ? '' : 'opacity-0 group-hover:opacity-100'}`} aria-label="Aparar o fim" />
                </div>
              )
            })}
          </div>
        </div>

        {/* Uma faixa por camada (a de cima na lista é a que fica por cima) */}
        {[...p.camadas].reverse().map((cam) => {
          const sel = selecao?.tipo === 'camada' && selecao.id === cam.id
          const nome = cam.tipo === 'texto' ? cam.texto?.split('\n')[0] || 'Texto' : cam.tipo === 'desfoque' ? 'Desfoque' : (fontes[cam.fonte]?.arquivo.name ?? NOMES[cam.tipo])
          return (
            <div key={cam.id} className="flex">
              <div className={rotulo}>
                <Icone nome={ICONES[cam.tipo]} tamanho={13} /> {NOMES[cam.tipo]}
              </div>
              <div className="relative h-9 flex-1 cursor-pointer py-1" onPointerDown={percorrer}>
                <div
                  role="button"
                  tabIndex={0}
                  aria-label={`Camada ${NOMES[cam.tipo]}: ${nome}`}
                  aria-pressed={sel}
                  onPointerDown={moverCamada(cam, 'mover')}
                  onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && aoSelecionar({ tipo: 'camada', id: cam.id })}
                  className={`group absolute top-1 bottom-1 flex cursor-grab items-center overflow-hidden rounded-md border-2 px-2.5 text-[0.6875rem] font-semibold text-white active:cursor-grabbing ${sel ? 'z-10 border-white' : 'border-transparent'}`}
                  style={{ left: pct(cam.inicio), width: pct(cam.fim - cam.inicio), backgroundColor: CORES[cam.tipo] }}
                >
                  <span className="pointer-events-none truncate">{nome}</span>
                  <span onPointerDown={moverCamada(cam, 'inicio')} className="absolute inset-y-0 left-0 w-2 cursor-ew-resize bg-black/25 opacity-0 group-hover:opacity-100" aria-label="Início da camada" />
                  <span onPointerDown={moverCamada(cam, 'fim')} className="absolute inset-y-0 right-0 w-2 cursor-ew-resize bg-black/25 opacity-0 group-hover:opacity-100" aria-label="Fim da camada" />
                </div>
              </div>
            </div>
          )
        })}

        {/* Música */}
        {p.musica ? (
          <div className="flex">
            <div className={rotulo}>
              <Icone nome="musica" tamanho={13} /> Música
            </div>
            <div className="relative h-9 flex-1 cursor-pointer py-1" onPointerDown={percorrer}>
              <div
                role="button"
                tabIndex={0}
                onPointerDown={(e) => {
                  e.stopPropagation()
                  aoSelecionar({ tipo: 'musica' })
                  percorrer(e)
                }}
                className={`absolute inset-y-1 right-0 left-0 flex items-center overflow-hidden rounded-md border-2 px-2.5 text-[0.6875rem] font-semibold text-white ${selecao?.tipo === 'musica' ? 'border-white' : 'border-transparent'}`}
                style={{ backgroundColor: 'var(--color-cat-audio)' }}
              >
                <span className="truncate">
                  {fontes[p.musica.fonte]?.arquivo.name}
                  {p.musica.repetir ? ' · repetindo' : ''}
                </span>
              </div>
            </div>
          </div>
        ) : null}

        {/* Cursor de reprodução (movido direto, sem re-renderizar) */}
        {total ? (
          <div className="pointer-events-none absolute inset-y-0 right-0 left-24">
            <div ref={cabeca} className="absolute inset-y-0 left-0 z-20 w-0.5 -translate-x-1/2 bg-tinta">
              <span className="absolute -top-1 left-1/2 size-2.5 -translate-x-1/2 rotate-45 rounded-[2px] bg-tinta" />
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}
