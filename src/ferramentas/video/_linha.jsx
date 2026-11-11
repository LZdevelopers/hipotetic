import { useState } from 'react'
import { Icone } from '../../componentes/Icone'
import { tempo } from '../../componentes/editor/Comum'
import { duracaoClipe, duracaoTotal, iniciosNaLinha } from './_projeto'

const ICONES = { texto: 'texto', imagem: 'imagem', video: 'arquivoVideo', desfoque: 'borracha' }
const NOMES = { texto: 'Texto', imagem: 'Imagem', video: 'Vídeo', desfoque: 'Blur' }
const CORES = { texto: 'var(--color-cat-documentos)', imagem: 'var(--color-cat-imagem)', video: 'var(--color-cat-video)', desfoque: 'var(--color-cat-utilitarios)' }
const IMA = 9 // px: distância em que um item gruda no cursor (e em outras bordas)

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
 * - Durante um arrasto a escala fica congelada (a linha não "pula" enquanto
 *   o tamanho total muda).
 * - Camadas e pontas de clipe grudam no cursor de reprodução e nas bordas.
 * - Botão direito abre o menu do item (aoMenu).
 */
export function LinhaDoTempo({ p, fontes, selecao, aoSelecionar, aoBuscar, aoMudarClipe, aoMudarCamada, aoReordenar, aoAdicionar, aoMenu, agora, cabeca, larguraRef, escalaRef }) {
  const total = duracaoTotal(p)
  const inicios = iniciosNaLinha(p)
  const [congelado, setCongelado] = useState(null)
  const [guia, setGuia] = useState(null)
  // Aparando um clipe: as posições ficam como estavam até soltar (a ponta arrastada segue o mouse).
  const [fixos, setFixos] = useState(null)
  const [arrastando, setArrastando] = useState(null)
  // Reordenando um clipe (arrastado pelo meio): { id, dx, destino }.
  const [reordenando, setReordenando] = useState(null)
  const comprimento = congelado ?? Math.max(total, ...p.camadas.map((c) => c.fim), 0.001)
  escalaRef.current = comprimento
  const pct = (t) => `${(t / comprimento) * 100}%`
  const pxPorSegundo = () => (larguraRef.current?.clientWidth ?? 1) / comprimento
  const tempoNoPonto = (clientX) => {
    const r = larguraRef.current.getBoundingClientRect()
    return Math.min(Math.max(0, ((clientX - r.left) / r.width) * comprimento), total)
  }

  // Bordas em que dá para grudar: cursor, começo/fim, clipes e outras camadas.
  const pontos = (excluir) => [agora(), 0, total, ...inicios, ...inicios.map((s, i) => s + duracaoClipe(p.clipes[i])), ...p.camadas.filter((c) => c.id !== excluir).flatMap((c) => [c.inicio, c.fim])]
  const grudar = (t, lista, k) => {
    let melhor = null
    let dist = IMA / k
    for (const q of lista) {
      const d = Math.abs(q - t)
      if (d < dist) {
        dist = d
        melhor = q
      }
    }
    return melhor
  }
  const congelar = () => setCongelado(comprimento)
  const soltar = () => {
    setCongelado(null)
    setGuia(null)
    setFixos(null)
    setArrastando(null)
  }
  /** Onde o clipe i aparece (durante um aparo, a partir das posições congeladas). */
  const posicao = (i, c) => {
    const dur = duracaoClipe(c)
    if (!fixos) return { left: inicios[i], dur }
    const base = fixos.inicios[i] ?? inicios[i]
    if (c.id === fixos.id && fixos.lado === 'inicio') return { left: base + (fixos.dur - dur), dur }
    return { left: base, dur }
  }

  // Clicar/arrastar na régua ou no fundo das trilhas: percorre.
  const percorrer = (e) => {
    if (e.button !== 0 || !total) return
    aoBuscar(tempoNoPonto(e.clientX))
    arrastar(e, (_, ev) => aoBuscar(tempoNoPonto(ev.clientX)))
  }

  const aparar = (c, i, lado) => (e) => {
    if (e.button !== 0) return
    aoSelecionar({ tipo: 'clipe', id: c.id })
    const c0 = { ...c }
    const k = pxPorSegundo()
    const max = fontes[c.fonte]?.tipo === 'imagem' ? 600 : (fontes[c.fonte]?.duracao ?? c.fim)
    const lista = pontos().filter((q) => Math.abs(q - inicios[i]) > 0.05)
    congelar()
    setFixos({ inicios: [...inicios], id: c.id, lado, dur: duracaoClipe(c) })
    setArrastando(c.id)
    arrastar(
      e,
      (dx) => {
        const dt = (dx / k) * c0.velocidade
        if (lado === 'inicio') aoMudarClipe(c.id, { inicio: Math.min(Math.max(0, c0.inicio + dt), c0.fim - 0.1) })
        else {
          // Fim do clipe na linha do tempo gruda no cursor/bordas.
          const fimNaLinha = inicios[i] + (c0.fim + dt - c0.inicio) / c0.velocidade
          const g = grudar(fimNaLinha, lista, k)
          setGuia(g)
          const fim = g != null ? c0.inicio + (g - inicios[i]) * c0.velocidade : c0.fim + dt
          aoMudarClipe(c.id, { fim: Math.max(Math.min(max, fim), c0.inicio + 0.1) })
        }
      },
      soltar,
    )
  }

  const moverCamada = (cam, modo) => (e) => {
    if (e.button !== 0) return
    aoSelecionar({ tipo: 'camada', id: cam.id })
    const c0 = { ...cam }
    const k = pxPorSegundo()
    const lista = pontos(cam.id)
    congelar()
    setArrastando(cam.id)
    arrastar(
      e,
      (dx) => {
        const dt = dx / k
        if (modo === 'mover') {
          const d = c0.fim - c0.inicio
          let inicio = c0.inicio + dt
          const gi = grudar(inicio, lista, k)
          const gf = grudar(inicio + d, lista, k)
          if (gi != null && (gf == null || Math.abs(gi - inicio) <= Math.abs(gf - inicio - d))) inicio = gi
          else if (gf != null) inicio = gf - d
          setGuia(gi != null && inicio === gi ? gi : gf != null && inicio === gf - d ? gf : null)
          inicio = Math.min(Math.max(0, inicio), Math.max(0, total - d))
          aoMudarCamada(cam.id, { inicio, fim: inicio + d })
        } else if (modo === 'inicio') {
          let t = c0.inicio + dt
          const g = grudar(t, lista, k)
          setGuia(g)
          if (g != null) t = g
          aoMudarCamada(cam.id, { inicio: Math.min(Math.max(0, t), c0.fim - 0.2) })
        } else {
          let t = c0.fim + dt
          const g = grudar(t, lista, k)
          setGuia(g)
          if (g != null) t = g
          aoMudarCamada(cam.id, { fim: Math.max(Math.min(total, t), c0.inicio + 0.2) })
        }
      },
      soltar,
    )
  }

  const menu = (alvo) => (e) => {
    e.preventDefault()
    e.stopPropagation()
    aoMenu(e, { ...alvo, t: larguraRef.current ? tempoNoPonto(e.clientX) : 0 })
  }

  const passo = passoRegua(comprimento, larguraRef.current?.clientWidth ?? 800)
  const marcas = []
  for (let t = 0; t <= comprimento + 1e-6 && total; t += passo) marcas.push(t)

  const rotulo = 'w-24 shrink-0 flex items-center gap-1.5 px-3 text-[0.6875rem] font-semibold text-fraca uppercase tracking-wide'

  return (
    <div className="rolagem-fina max-h-56 overflow-y-auto" onContextMenu={menu({ tipo: 'linha' })}>
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
        <div className="w-12 shrink-0" />
      </div>

      <div className="relative">
        {/* Trilha de vídeo (com o + no fim, como no CapCut) */}
        <div className="flex">
          <div className={rotulo}>
            <Icone nome="filme" tamanho={13} /> Vídeo
          </div>
          <div ref={larguraRef} className="relative h-16 flex-1 cursor-pointer overflow-hidden py-1.5" onPointerDown={percorrer}>
            {p.clipes.length ? null : <p className="pointer-events-none grid h-full place-items-center rounded-lg border border-dashed border-borda text-xs text-fraca">Os vídeos aparecem aqui, em sequência</p>}

            {/* Aparando: o que ficou escondido antes e depois do trecho */}
            {fixos
              ? (() => {
                  const i = p.clipes.findIndex((x) => x.id === fixos.id)
                  const c = p.clipes[i]
                  const fonte = c && fontes[c.fonte]
                  if (!c || fonte?.tipo !== 'video') return null
                  const pos = posicao(i, c)
                  const antes = c.inicio / c.velocidade
                  const depois = Math.max(0, ((fonte.duracao ?? c.fim) - c.fim) / c.velocidade)
                  const fantasma = 'pointer-events-none absolute top-1.5 bottom-1.5 z-20 flex items-center overflow-hidden rounded-lg border-2 border-dashed border-acento/70 bg-acento/15 text-[0.625rem] font-bold text-acento tabular-nums'
                  return (
                    <>
                      {antes > 0.02 ? (
                        <div className={`${fantasma} justify-end pr-1.5`} style={{ left: pct(pos.left - antes), width: pct(antes) }}>
                          +{tempo(antes)}
                        </div>
                      ) : null}
                      {depois > 0.02 ? (
                        <div className={`${fantasma} justify-start pl-1.5`} style={{ left: pct(pos.left + pos.dur), width: pct(depois) }}>
                          +{tempo(depois)}
                        </div>
                      ) : null}
                    </>
                  )
                })()
              : null}

            {p.clipes.map((c, i) => {
              const fonte = fontes[c.fonte]
              const sel = selecao?.tipo === 'clipe' && selecao.id === c.id
              const pos = posicao(i, c)
              const temAntes = fonte?.tipo === 'video' && c.inicio > 0.05
              const temDepois = fonte?.tipo === 'video' && (fonte.duracao ?? c.fim) - c.fim > 0.05
              const movendo = reordenando?.id === c.id
              return (
                <div
                  key={c.id}
                  role="button"
                  tabIndex={0}
                  aria-label={`Clipe ${i + 1}: ${fonte?.arquivo.name}`}
                  aria-pressed={sel}
                  onPointerDown={(e) => {
                    if (e.button !== 0) return
                    e.stopPropagation()
                    aoSelecionar({ tipo: 'clipe', id: c.id })
                    // Clicar: vai para o ponto. Arrastar pelo meio: muda a ordem do clipe.
                    const alvo = e.currentTarget
                    try {
                      alvo.setPointerCapture(e.pointerId)
                    } catch {
                      /* evento sintético */
                    }
                    const x0 = e.clientX
                    const t0 = tempoNoPonto(x0)
                    let modo = null
                    const meios = p.clipes.map((x, j) => ({ id: x.id, meio: inicios[j] + duracaoClipe(x) / 2 }))
                    const destinoEm = (clientX) => meios.filter((m) => m.id !== c.id && m.meio < tempoNoPonto(clientX)).length
                    const mover = (ev) => {
                      if (!modo && Math.abs(ev.clientX - x0) > 6 && p.clipes.length > 1) {
                        modo = 'reordenar'
                        congelar()
                      }
                      if (modo) setReordenando({ id: c.id, dx: ev.clientX - x0, destino: destinoEm(ev.clientX) })
                    }
                    const soltarClipe = (ev) => {
                      alvo.removeEventListener('pointermove', mover)
                      alvo.removeEventListener('pointerup', soltarClipe)
                      alvo.removeEventListener('pointercancel', soltarClipe)
                      if (modo) {
                        const d = destinoEm(ev.clientX)
                        soltar()
                        if (d !== i) aoReordenar(c.id, d)
                      } else aoBuscar(t0)
                    }
                    alvo.addEventListener('pointermove', mover)
                    alvo.addEventListener('pointerup', soltarClipe)
                    alvo.addEventListener('pointercancel', soltarClipe)
                  }}
                  onContextMenu={menu({ tipo: 'clipe', id: c.id })}
                  onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && aoSelecionar({ tipo: 'clipe', id: c.id })}
                  className={`group absolute top-1.5 bottom-1.5 overflow-hidden rounded-lg border-2 bg-superficie-3 ${movendo ? 'z-30 cursor-grabbing opacity-85 shadow-[0_8px_24px_-6px_rgb(0_0_0/0.6)]' : sel ? 'z-10 border-acento' : 'border-transparent hover:border-borda-forte'} ${movendo ? 'border-acento' : ''}`}
                  style={{ left: `calc(${pct(pos.left)} + 2px)`, width: `calc(${pct(pos.dur)} - 4px)`, transform: movendo ? `translateX(${reordenando.dx}px)` : undefined }}
                >
                  {fonte?.quadros?.length ? (
                    <div className="pointer-events-none absolute inset-0 flex opacity-80">
                      {fonte.quadros.map((q, j) => (
                        <img key={j} src={q} alt="" className="h-full min-w-0 flex-1 object-cover" />
                      ))}
                    </div>
                  ) : fonte?.tipo === 'imagem' ? (
                    <img src={fonte.url} alt="" className="pointer-events-none absolute inset-0 size-full object-cover opacity-80" />
                  ) : null}
                  {/* Há vídeo escondido antes/depois: marca na ponta */}
                  {temAntes ? (
                    <>
                      <span className="pointer-events-none absolute inset-y-0 left-3.5 w-1 bg-[repeating-linear-gradient(180deg,white_0_3px,transparent_3px_6px)] opacity-80" />
                      <span className="pointer-events-none absolute top-0.5 left-5 rounded bg-black/70 px-1 text-[0.5625rem] font-bold text-white tabular-nums" title="Há vídeo escondido antes: arraste a ponta para a esquerda">
                        ‹ {tempo(c.inicio / c.velocidade)}
                      </span>
                    </>
                  ) : null}
                  {temDepois ? (
                    <>
                      <span className="pointer-events-none absolute inset-y-0 right-3.5 w-1 bg-[repeating-linear-gradient(180deg,white_0_3px,transparent_3px_6px)] opacity-80" />
                      <span className="pointer-events-none absolute top-0.5 right-5 rounded bg-black/70 px-1 text-[0.5625rem] font-bold text-white tabular-nums" title="Há vídeo escondido depois: arraste a ponta para a direita">
                        {tempo(((fonte.duracao ?? c.fim) - c.fim) / c.velocidade)} ›
                      </span>
                    </>
                  ) : null}
                  <span className="pointer-events-none absolute bottom-0.5 left-2 max-w-[calc(100%-1rem)] truncate rounded bg-black/60 px-1 text-[0.625rem] font-semibold text-white tabular-nums">
                    {fonte?.tipo === 'imagem' ? 'imagem · ' : ''}
                    {c.velocidade !== 1 ? `${c.velocidade.toLocaleString('pt-BR')}× · ` : ''}
                    {c.mudo ? 'sem som · ' : ''}
                    {tempo(duracaoClipe(c))}
                  </span>
                  <span onPointerDown={aparar(c, i, 'inicio')} className={`absolute inset-y-0 left-0 grid w-3.5 cursor-ew-resize place-items-center bg-acento ${sel ? '' : 'opacity-0 group-hover:opacity-100'}`} aria-label="Aparar o início">
                    <span className="h-5 w-0.5 rounded-full bg-white/80" />
                  </span>
                  <span onPointerDown={aparar(c, i, 'fim')} className={`absolute inset-y-0 right-0 grid w-3.5 cursor-ew-resize place-items-center bg-acento ${sel ? '' : 'opacity-0 group-hover:opacity-100'}`} aria-label="Aparar o fim">
                    <span className="h-5 w-0.5 rounded-full bg-white/80" />
                  </span>
                  {arrastando === c.id ? <span className="pointer-events-none absolute top-1 left-1/2 -translate-x-1/2 rounded bg-black/80 px-1.5 py-0.5 text-[0.6875rem] font-bold text-white tabular-nums">{tempo(pos.dur)}</span> : null}
                </div>
              )
            })}

            {/* Onde o clipe arrastado vai entrar */}
            {reordenando
              ? (() => {
                  const outros = p.clipes.map((x, j) => ({ x, j })).filter(({ x }) => x.id !== reordenando.id)
                  const antes = outros[reordenando.destino - 1]
                  const em = antes ? inicios[antes.j] + duracaoClipe(antes.x) : 0
                  return <div className="pointer-events-none absolute inset-y-0 z-40 w-1 -translate-x-1/2 rounded-full bg-acento shadow-[0_0_10px_var(--color-acento)]" style={{ left: pct(em) }} />
                })()
              : null}
          </div>
          <div className="flex w-12 shrink-0 items-center justify-center">
            <button
              type="button"
              onClick={aoAdicionar}
              aria-label="Adicionar vídeo, imagem ou GIF"
              title="Adicionar vídeo, imagem ou GIF ao fim"
              className="grid h-12 w-9 place-items-center rounded-lg border-2 border-dashed border-borda-forte text-suave transition-colors hover:border-acento hover:bg-acento-suave hover:text-acento"
            >
              <Icone nome="mais" tamanho={18} />
            </button>
          </div>
        </div>

        {/* Uma faixa por camada (a de cima na lista é a que fica por cima) */}
        {[...p.camadas].reverse().map((cam) => {
          const sel = selecao?.tipo === 'camada' && selecao.id === cam.id
          const nome = cam.tipo === 'texto' ? cam.texto?.split('\n')[0] || 'Texto' : cam.tipo === 'desfoque' ? 'Blur' : (fontes[cam.fonte]?.arquivo.name ?? NOMES[cam.tipo])
          return (
            <div key={cam.id} className="flex">
              <div className={rotulo}>
                <Icone nome={ICONES[cam.tipo]} tamanho={13} /> {NOMES[cam.tipo]}
              </div>
              <div className="relative h-9 flex-1 cursor-pointer overflow-hidden py-1" onPointerDown={percorrer}>
                <div
                  role="button"
                  tabIndex={0}
                  aria-label={`Camada ${NOMES[cam.tipo]}: ${nome}`}
                  aria-pressed={sel}
                  onPointerDown={moverCamada(cam, 'mover')}
                  onContextMenu={menu({ tipo: 'camada', id: cam.id })}
                  onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && aoSelecionar({ tipo: 'camada', id: cam.id })}
                  className={`group absolute top-1 bottom-1 flex cursor-grab items-center overflow-hidden rounded-md border-2 px-2.5 text-[0.6875rem] font-semibold text-white active:cursor-grabbing ${sel ? 'z-10 border-white' : 'border-transparent'}`}
                  style={{ left: pct(cam.inicio), width: pct(Math.max(0, Math.min(cam.fim, comprimento) - cam.inicio)), backgroundColor: CORES[cam.tipo] }}
                >
                  <span className="pointer-events-none truncate">{nome}</span>
                  <span onPointerDown={moverCamada(cam, 'inicio')} className={`absolute inset-y-0 left-0 grid w-3 cursor-ew-resize place-items-center bg-black/35 ${sel ? '' : 'opacity-0 group-hover:opacity-100'}`} aria-label="Início da camada">
                    <span className="h-3.5 w-0.5 rounded-full bg-white/90" />
                  </span>
                  <span onPointerDown={moverCamada(cam, 'fim')} className={`absolute inset-y-0 right-0 grid w-3 cursor-ew-resize place-items-center bg-black/35 ${sel ? '' : 'opacity-0 group-hover:opacity-100'}`} aria-label="Fim da camada">
                    <span className="h-3.5 w-0.5 rounded-full bg-white/90" />
                  </span>
                  {arrastando === cam.id ? <span className="pointer-events-none absolute right-4 rounded bg-black/70 px-1 text-[0.625rem] font-bold tabular-nums">{tempo(cam.fim - cam.inicio)}</span> : null}
                </div>
              </div>
              <div className="w-12 shrink-0" />
            </div>
          )
        })}

        {/* Música */}
        {p.musica ? (
          <div className="flex">
            <div className={rotulo}>
              <Icone nome="musica" tamanho={13} /> Áudio
            </div>
            <div className="relative h-9 flex-1 cursor-pointer py-1" onPointerDown={percorrer}>
              <div
                role="button"
                tabIndex={0}
                aria-label="Trilha de áudio"
                onPointerDown={(e) => {
                  if (e.button !== 0) return
                  e.stopPropagation()
                  aoSelecionar({ tipo: 'musica' })
                  percorrer(e)
                }}
                onContextMenu={menu({ tipo: 'musica' })}
                className={`absolute inset-y-1 left-0 flex items-center overflow-hidden rounded-md border-2 px-2.5 text-[0.6875rem] font-semibold text-white ${selecao?.tipo === 'musica' ? 'border-white' : 'border-transparent'}`}
                style={{ width: pct(total), backgroundColor: 'var(--color-cat-audio)' }}
              >
                <span className="truncate">
                  {fontes[p.musica.fonte]?.arquivo.name}
                  {p.musica.repetir ? ' · repetindo' : ''}
                </span>
              </div>
            </div>
            <div className="w-12 shrink-0" />
          </div>
        ) : null}

        {/* Cursor de reprodução (movido direto, sem re-renderizar) e guia do ímã */}
        {total ? (
          <div className="pointer-events-none absolute inset-y-0 right-12 left-24">
            <div ref={cabeca} data-cursor="" className="absolute inset-y-0 left-0 z-20 w-0.5 -translate-x-1/2 bg-tinta">
              <span className="absolute -top-1 left-1/2 size-2.5 -translate-x-1/2 rotate-45 rounded-[2px] bg-tinta" />
            </div>
            {guia != null ? <div className="absolute inset-y-0 z-30 w-0.5 -translate-x-1/2 bg-acento shadow-[0_0_8px_var(--color-acento)]" style={{ left: pct(guia) }} /> : null}
          </div>
        ) : null}
      </div>
    </div>
  )
}
