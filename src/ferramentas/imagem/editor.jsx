import { useCallback, useEffect, useRef, useState } from 'react'
import { BotaoAcao, useHistorico } from '../../componentes/editor/Comum'
import { DialogoBaixar, NomeEditavel, OpcoesCartoes } from '../../componentes/ferramenta/Baixar'
import { Icone } from '../../componentes/Icone'
import { AreaTexto, Aviso, Botao, Caixa, Deslizante, Entrada, Progresso, SeloCategoria, Seletor } from '../../componentes/ui'
import { DESCRICAO_IMAGEM, EXTENSOES_IMAGEM, LIMITE_IMAGEM, ehSvg, rasterizarSvg } from '../../motores/imagem'
import { FILTROS, NEUTRO, ehNeutro, renderizarAjustes } from '../../motores/imagem/ajustes'
import { MODELOS, apagarObjeto, modeloNoCache, removerFundo } from '../../motores/imagem/ia'
import { codificar } from '../../motores/imagem/nucleo'
import { baixarBlob, extensaoDe, formatarBytes, semExtensao } from '../../nucleo/arquivos'
import { useEmEdicao } from '../../nucleo/edicao'
import { useSalvo } from '../../nucleo/salvo'
import { useTarefa } from '../../nucleo/tarefa'
import { CorDeFundo } from './_comum'

/*
 * Editor de imagem (tela cheia, no jeito do Photopea, uma imagem por vez):
 *   - Ajustes e filtros (não destrutivos, mexem a qualquer hora);
 *   - Recortar, Tamanho (esticar/achatar arrastando), Girar/endireitar —
 *     cada um com "Aplicar", e a edição continua sobre o resultado;
 *   - Remover fundo e Apagar objeto (IA no navegador, ver motores/imagem/ia.js);
 *   - Pincel/borracha e Texto.
 * O projeto (imagem atual, ajustes, textos) fica salvo no navegador e tem
 * desfazer/refazer. Baixar mostra o tamanho estimado do arquivo.
 */

/* ─── Dados ──────────────────────────────────────────────────────────────── */

const FERRAMENTAS = [
  { id: 'ajustes', rotulo: 'Ajustes', icone: 'ajustar' },
  { id: 'recortar', rotulo: 'Recortar', icone: 'recortar' },
  { id: 'tamanho', rotulo: 'Tamanho', icone: 'regua' },
  { id: 'girar', rotulo: 'Girar', icone: 'girar' },
  { id: 'fundo', rotulo: 'Remover fundo', icone: 'borracha' },
  { id: 'apagar', rotulo: 'Apagar objeto', icone: 'filtro' },
  { id: 'pincel', rotulo: 'Pincel', icone: 'caneta' },
  { id: 'texto', rotulo: 'Texto', icone: 'tipo' },
]
const PROPORCOES = [
  { id: 'livre', rotulo: 'Livre', valor: null },
  { id: '1:1', rotulo: '1:1', valor: 1 },
  { id: '4:5', rotulo: '4:5', valor: 4 / 5 },
  { id: '4:3', rotulo: '4:3', valor: 4 / 3 },
  { id: '3:2', rotulo: '3:2', valor: 3 / 2 },
  { id: '16:9', rotulo: '16:9', valor: 16 / 9 },
  { id: '9:16', rotulo: '9:16', valor: 9 / 16 },
]
export const REDES = [
  { id: 'ig-quadrado', nome: 'Instagram · post quadrado', w: 1080, h: 1080 },
  { id: 'ig-retrato', nome: 'Instagram · post retrato', w: 1080, h: 1350 },
  { id: 'ig-story', nome: 'Stories, Reels e TikTok', w: 1080, h: 1920 },
  { id: 'yt-miniatura', nome: 'YouTube · miniatura', w: 1280, h: 720 },
  { id: 'fb-post', nome: 'Facebook · post', w: 1200, h: 630 },
  { id: 'x-post', nome: 'X · post', w: 1600, h: 900 },
  { id: 'li-post', nome: 'LinkedIn · post', w: 1200, h: 627 },
  { id: 'perfil', nome: 'Foto de perfil', w: 800, h: 800 },
  { id: 'fullhd', nome: 'Full HD', w: 1920, h: 1080 },
]
const FONTES = [
  { id: 'Inter Variable, system-ui, sans-serif', rotulo: 'Inter' },
  { id: "'Plus Jakarta Sans Variable', system-ui, sans-serif", rotulo: 'Jakarta' },
  { id: 'Georgia, serif', rotulo: 'Georgia' },
  { id: 'ui-monospace, Consolas, monospace', rotulo: 'Mono' },
  { id: 'Impact, Haettenschweiler, sans-serif', rotulo: 'Impact' },
]
const PREVIA_MAX = 1800 // lado maior da prévia (px)

let seq = 0
const novaId = () => `t${Date.now().toString(36)}${(seq += 1)}`
const canvas = (w, h) => new OffscreenCanvas(Math.max(1, Math.round(w)), Math.max(1, Math.round(h)))
const limitar = (v, a, b) => Math.min(b, Math.max(a, v))

/** Desenha os textos (mesma métrica da prévia: entrelinha 1,2, topo da linha). */
function desenharTextos(ctx, textos) {
  for (const t of textos) {
    ctx.save()
    ctx.font = `${t.negrito ? 700 : 400} ${t.tamanho}px ${t.fonte}`
    ctx.textBaseline = 'top'
    ctx.fillStyle = t.cor
    ctx.lineJoin = 'round'
    String(t.texto || ' ')
      .split('\n')
      .forEach((linha, n) => {
        const y = t.y + t.tamanho * 0.1 + n * t.tamanho * 1.2
        if (t.contorno) {
          ctx.strokeStyle = t.corContorno
          ctx.lineWidth = Math.max(1, t.tamanho * 0.12)
          ctx.strokeText(linha, t.x, y)
        }
        ctx.fillText(linha, t.x, y)
      })
    ctx.restore()
  }
}

/** Imagem final (tamanho real): base + ajustes + textos. */
function renderizarFinal(base, ajustes, textos) {
  const c = renderizarAjustes(base, ajustes)
  if (textos.length) desenharTextos(c.getContext('2d'), textos)
  return c
}

/** Maior retângulo (largura × altura) que cabe dentro da imagem girada em `ang` graus. */
function maiorDentroGirado(w, h, ang) {
  const a = Math.abs((ang * Math.PI) / 180)
  const sen = Math.sin(a)
  const cos = Math.cos(a)
  const ladoLongo = Math.max(w, h)
  const ladoCurto = Math.min(w, h)
  if (ladoCurto <= 2 * sen * cos * ladoLongo || Math.abs(sen - cos) < 1e-10) {
    const x = 0.5 * ladoCurto
    return w >= h ? { w: x / sen, h: x / cos } : { w: x / cos, h: x / sen }
  }
  const cos2 = cos * cos - sen * sen
  return { w: (w * cos - h * sen) / cos2, h: (h * cos - w * sen) / cos2 }
}

/* ─── Tela (a imagem, com as camadas de cada ferramenta) ─────────────────── */

function Tela({ previa, w, h, zoom, ferramenta, rascunho, setRascunho, textos, selecionado, aoSelecionar, aoMoverTexto, aoClicarTexto, pintura, aoPintar, aoSoltarPintura, pincel, aoEscala }) {
  const area = useRef(null)
  const visor = useRef(null)
  const [tamArea, setTamArea] = useState({ w: 800, h: 600 })

  useEffect(() => {
    if (!area.current) return undefined
    const obs = new ResizeObserver(([e]) => setTamArea({ w: e.contentRect.width, h: e.contentRect.height }))
    obs.observe(area.current)
    return () => obs.disconnect()
  }, [])

  // Na ferramenta Tamanho, a prévia mostra o novo formato (esticada/achatada).
  const wv = ferramenta === 'tamanho' && rascunho ? rascunho.w : w
  const hv = ferramenta === 'tamanho' && rascunho ? rascunho.h : h
  const ajuste = Math.min((tamArea.w - 48) / wv, (tamArea.h - 48) / hv)
  const escala = zoom === 'ajustar' ? Math.max(0.02, ajuste) : zoom
  useEffect(() => aoEscala?.(escala), [escala, aoEscala])

  // Desenha a prévia (já com ajustes) no canvas visível.
  useEffect(() => {
    const c = visor.current
    if (!c || !previa) return
    c.width = previa.width
    c.height = previa.height
    c.getContext('2d').drawImage(previa, 0, 0)
  }, [previa])

  // Ponto da imagem (px reais) sob o ponteiro.
  const ponto = (e) => {
    const r = e.currentTarget.getBoundingClientRect()
    return { x: ((e.clientX - r.left) / r.width) * wv, y: ((e.clientY - r.top) / r.height) * hv }
  }
  const arrastar = (aoMover, aoSoltar) => (e) => {
    e.preventDefault()
    e.stopPropagation()
    const folha = e.currentTarget.closest('[data-folha]')
    const r = folha.getBoundingClientRect()
    const inicio = { x: e.clientX, y: e.clientY }
    const mover = (ev) => aoMover(((ev.clientX - inicio.x) / r.width) * wv, ((ev.clientY - inicio.y) / r.height) * hv, ev)
    const soltar = () => {
      removeEventListener('pointermove', mover)
      removeEventListener('pointerup', soltar)
      aoSoltar?.()
    }
    addEventListener('pointermove', mover)
    addEventListener('pointerup', soltar)
  }

  return (
    <div ref={area} className="rolagem-fina relative flex min-h-[22rem] flex-1 overflow-auto rounded-[var(--radius-cartao)] bg-superficie-2">
      <div className="m-auto p-6">
        <div
          data-folha=""
          className={`xadrez relative shadow-[var(--shadow-cartao)] ${ferramenta === 'apagar' || ferramenta === 'pincel' ? 'cursor-crosshair' : ferramenta === 'texto' ? 'cursor-text' : ''}`}
          style={{ width: wv * escala, height: hv * escala, touchAction: 'none' }}
          onPointerDown={(e) => {
            if (e.button !== 0) return
            if (ferramenta === 'texto' && e.target === e.currentTarget.querySelector('canvas')) aoClicarTexto(ponto(e))
            else if ((ferramenta === 'apagar' || ferramenta === 'pincel') && pintura) {
              const folha = e.currentTarget
              const r = folha.getBoundingClientRect()
              const p = (ev) => ({ x: ((ev.clientX - r.left) / r.width) * w, y: ((ev.clientY - r.top) / r.height) * h })
              aoPintar(p(e), true)
              const mover = (ev) => aoPintar(p(ev), false)
              const soltar = () => {
                removeEventListener('pointermove', mover)
                removeEventListener('pointerup', soltar)
                aoSoltarPintura()
              }
              addEventListener('pointermove', mover)
              addEventListener('pointerup', soltar)
            } else if (ferramenta !== 'texto') aoSelecionar(null)
          }}
        >
          <canvas ref={visor} className="absolute inset-0 size-full" aria-label="Imagem" />

          {/* Pintura (máscara do apagar, traço do pincel) */}
          {pintura ? <CanvasEspelho fonte={pintura} className={`pointer-events-none absolute inset-0 size-full ${ferramenta === 'apagar' ? 'opacity-55' : ''}`} /> : null}
          {(ferramenta === 'apagar' || ferramenta === 'pincel') && pincel ? <CursorPincel tamanho={pincel.tamanho * escala} /> : null}

          {/* Textos */}
          {textos.map((t) => (
            <div
              key={t.id}
              onPointerDown={arrastar((dx, dy) => aoMoverTexto(t.id, { x: t.x0 + dx, y: t.y0 + dy }), null)}
              onPointerDownCapture={() => {
                aoSelecionar(t.id)
                t.x0 = t.x
                t.y0 = t.y
              }}
              data-texto=""
              className={`absolute cursor-move whitespace-pre select-none ${t.id === selecionado ? 'outline-2 outline-offset-4 outline-acento' : 'hover:outline-1 hover:outline-dashed hover:outline-acento/60'}`}
              style={{
                left: t.x * escala,
                top: t.y * escala,
                fontFamily: t.fonte,
                fontSize: t.tamanho * escala,
                fontWeight: t.negrito ? 700 : 400,
                lineHeight: 1.2,
                color: t.cor,
                WebkitTextStroke: t.contorno ? `${Math.max(1, t.tamanho * 0.12 * escala) / 2}px ${t.corContorno}` : undefined,
                paintOrder: 'stroke fill',
              }}
            >
              {t.texto || ' '}
            </div>
          ))}

          {/* Recorte */}
          {ferramenta === 'recortar' && rascunho ? <CaixaRecorte r={rascunho} w={w} h={h} escala={escala} mudar={setRascunho} arrastar={arrastar} /> : null}

          {/* Tamanho: alças para esticar/achatar */}
          {ferramenta === 'tamanho' && rascunho ? (
            <>
              {[
                ['direita', 'top-1/2 -right-2 h-10 w-3 -translate-y-1/2 cursor-ew-resize'],
                ['base', '-bottom-2 left-1/2 h-3 w-10 -translate-x-1/2 cursor-ns-resize'],
                ['canto', '-right-2 -bottom-2 size-4 cursor-nwse-resize'],
              ].map(([lado, classe]) => (
                <span
                  key={lado}
                  aria-label={`Arrastar ${lado}`}
                  onPointerDown={(() => {
                    const r0 = { ...rascunho }
                    return arrastar((dx, dy) => {
                      let nw = lado === 'base' ? r0.w : Math.max(1, Math.round(r0.w + dx))
                      let nh = lado === 'direita' ? r0.h : Math.max(1, Math.round(r0.h + dy))
                      if (r0.trava) {
                        if (lado === 'base') nw = Math.round((nh * r0.w) / r0.h)
                        else nh = Math.round((nw * r0.h) / r0.w)
                      }
                      setRascunho({ ...r0, w: nw, h: nh })
                    })
                  })()}
                  className={`absolute rounded-sm border-2 border-white bg-acento shadow ${classe}`}
                />
              ))}
            </>
          ) : null}
        </div>
      </div>
    </div>
  )
}

/** Mostra um OffscreenCanvas (de pintura) num canvas da página, redesenhando a cada mudança. */
function CanvasEspelho({ fonte, className }) {
  const c = useRef(null)
  useEffect(() => {
    let quadro = 0
    const desenhar = () => {
      const el = c.current
      if (!el) return
      if (el.width !== fonte.canvas.width || el.height !== fonte.canvas.height) {
        el.width = fonte.canvas.width
        el.height = fonte.canvas.height
      }
      const ctx = el.getContext('2d')
      ctx.clearRect(0, 0, el.width, el.height)
      ctx.drawImage(fonte.canvas, 0, 0)
    }
    desenhar()
    fonte.ouvir = () => {
      cancelAnimationFrame(quadro)
      quadro = requestAnimationFrame(desenhar)
    }
    return () => {
      cancelAnimationFrame(quadro)
      fonte.ouvir = null
    }
  }, [fonte])
  return <canvas ref={c} className={className} />
}

/** Círculo do tamanho do pincel seguindo o mouse. */
function CursorPincel({ tamanho }) {
  const [p, setP] = useState(null)
  useEffect(() => {
    const mover = (e) => {
      const folha = document.querySelector('[data-folha]')
      if (!folha) return
      const r = folha.getBoundingClientRect()
      const dentro = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom
      setP(dentro ? { x: e.clientX - r.left, y: e.clientY - r.top } : null)
    }
    addEventListener('pointermove', mover)
    return () => removeEventListener('pointermove', mover)
  }, [])
  if (!p) return null
  return <span className="pointer-events-none absolute rounded-full border-2 border-white mix-blend-difference" style={{ left: p.x - tamanho / 2, top: p.y - tamanho / 2, width: tamanho, height: tamanho }} />
}

function CaixaRecorte({ r, w, h, escala, mudar, arrastar }) {
  const alcas = [
    ['nw', -1, -1, 'cursor-nwse-resize'],
    ['ne', 1, -1, 'cursor-nesw-resize'],
    ['sw', -1, 1, 'cursor-nesw-resize'],
    ['se', 1, 1, 'cursor-nwse-resize'],
  ]
  const ajustar = (n) => {
    let { x, y, w: rw, h: rh } = n
    rw = limitar(rw, 8, w)
    rh = limitar(rh, 8, h)
    x = limitar(x, 0, w - rw)
    y = limitar(y, 0, h - rh)
    return { ...n, x, y, w: rw, h: rh }
  }
  return (
    <>
      {/* escurece fora do recorte */}
      <div className="pointer-events-none absolute inset-0 bg-black/50" style={{ clipPath: `polygon(0 0,100% 0,100% 100%,0 100%,0 0,${(r.x / w) * 100}% ${(r.y / h) * 100}%,${(r.x / w) * 100}% ${((r.y + r.h) / h) * 100}%,${((r.x + r.w) / w) * 100}% ${((r.y + r.h) / h) * 100}%,${((r.x + r.w) / w) * 100}% ${(r.y / h) * 100}%,${(r.x / w) * 100}% ${(r.y / h) * 100}%)` }} />
      <div
        data-recorte=""
        className="absolute cursor-move border-2 border-white shadow-[0_0_0_1px_rgb(0_0_0/0.4)]"
        style={{ left: r.x * escala, top: r.y * escala, width: r.w * escala, height: r.h * escala }}
        onPointerDown={(() => {
          const r0 = { ...r }
          return arrastar((dx, dy) => mudar(ajustar({ ...r0, x: r0.x + dx, y: r0.y + dy })))
        })()}
      >
        <span className="pointer-events-none absolute inset-0 [background:linear-gradient(to_right,transparent_33.2%,rgb(255_255_255/0.5)_33.3%,transparent_33.5%,transparent_66.5%,rgb(255_255_255/0.5)_66.6%,transparent_66.8%),linear-gradient(to_bottom,transparent_33.2%,rgb(255_255_255/0.5)_33.3%,transparent_33.5%,transparent_66.5%,rgb(255_255_255/0.5)_66.6%,transparent_66.8%)]" />
        {alcas.map(([id, sx, sy, cursor]) => (
          <span
            key={id}
            className={`absolute size-4 rounded-sm border-2 border-acento bg-white ${cursor}`}
            style={{ left: sx < 0 ? -8 : undefined, right: sx > 0 ? -8 : undefined, top: sy < 0 ? -8 : undefined, bottom: sy > 0 ? -8 : undefined }}
            onPointerDown={(() => {
              const r0 = { ...r }
              return arrastar((dx, dy) => {
                let nw = r0.w + sx * dx
                let nh = r0.h + sy * dy
                if (r0.proporcao) nh = nw / r0.proporcao
                nw = limitar(nw, 8, w)
                nh = limitar(nh, 8, h)
                const nx = sx < 0 ? r0.x + r0.w - nw : r0.x
                const ny = sy < 0 ? r0.y + r0.h - nh : r0.y
                mudar(ajustar({ ...r0, x: nx, y: ny, w: nw, h: nh }))
              })
            })()}
          />
        ))}
      </div>
    </>
  )
}

/* ─── Painéis (direita) ──────────────────────────────────────────────────── */

function Grupo({ titulo, children }) {
  return (
    <div className="flex flex-col gap-3">
      {titulo ? <h3 className="text-xs font-semibold tracking-wide text-fraca uppercase">{titulo}</h3> : null}
      {children}
    </div>
  )
}

function PainelAjustes({ a, mudar }) {
  const m = (k) => (v) => mudar({ ...a, [k]: v })
  const sinal = (v) => `${v > 0 ? '+' : ''}${v}`
  const cem = (v) => sinal(v - 100)
  return (
    <div className="flex flex-col gap-5">
      <Grupo titulo="Filtros">
        <div className="grid grid-cols-3 gap-1.5">
          {FILTROS.map((f) => {
            const ativo = JSON.stringify({ ...NEUTRO, ...f.ajustes }) === JSON.stringify({ ...NEUTRO, ...a })
            return (
              <button key={f.id} type="button" aria-pressed={ativo} onClick={() => mudar({ ...NEUTRO, ...f.ajustes })} className={`rounded-lg border px-2 py-2 text-xs font-semibold transition-colors ${ativo ? 'border-marca bg-marca text-sobre-marca' : 'border-borda text-suave hover:border-borda-forte hover:text-tinta'}`}>
                {f.nome}
              </button>
            )
          })}
        </div>
      </Grupo>
      <Grupo titulo="Luz">
        <Deslizante rotulo="Exposição" valor={a.exposicao} aoMudar={m('exposicao')} min={-100} max={100} formatar={sinal} />
        <Deslizante rotulo="Brilho" valor={a.brilho} aoMudar={m('brilho')} min={0} max={200} formatar={cem} />
        <Deslizante rotulo="Contraste" valor={a.contraste} aoMudar={m('contraste')} min={0} max={200} formatar={cem} />
      </Grupo>
      <Grupo titulo="Cor">
        <Deslizante rotulo="Saturação" valor={a.saturacao} aoMudar={m('saturacao')} min={0} max={200} formatar={cem} />
        <Deslizante rotulo="Temperatura" valor={a.temperatura} aoMudar={m('temperatura')} min={-100} max={100} formatar={sinal} />
        <Deslizante rotulo="Matiz" valor={a.matiz} aoMudar={m('matiz')} min={-180} max={180} formatar={(v) => `${v}°`} />
        <Deslizante rotulo="Preto e branco" valor={a.cinza} aoMudar={m('cinza')} formatar={(v) => `${v}%`} />
        <Deslizante rotulo="Sépia" valor={a.sepia} aoMudar={m('sepia')} formatar={(v) => `${v}%`} />
        <Caixa rotulo="Inverter cores (negativo)" marcado={a.inverter} aoMudar={m('inverter')} />
      </Grupo>
      <Grupo titulo="Detalhe">
        <Deslizante rotulo="Nitidez" valor={a.nitidez} aoMudar={m('nitidez')} formatar={(v) => `${v}%`} />
        <Deslizante rotulo="Desfoque" valor={a.desfoque} aoMudar={m('desfoque')} min={0} max={20} passo={0.5} formatar={(v) => (v ? v.toLocaleString('pt-BR') : '0')} />
        <Deslizante rotulo="Vinheta" valor={a.vinheta} aoMudar={m('vinheta')} formatar={(v) => `${v}%`} />
      </Grupo>
      {!ehNeutro(a) ? (
        <Botao variante="secundario" tamanho="p" icone="redefinir" className="self-start" onClick={() => mudar(NEUTRO)}>
          Zerar ajustes
        </Botao>
      ) : null}
    </div>
  )
}

/** Botões Aplicar / Cancelar das ferramentas com rascunho. */
function Acoes({ aplicar, cancelar, rotulo = 'Aplicar', desativado }) {
  return (
    <div className="flex gap-2">
      <Botao variante="secundario" onClick={cancelar}>
        Cancelar
      </Botao>
      <Botao className="flex-1" icone="check" onClick={aplicar} disabled={desativado} data-aplicar="">
        {rotulo}
      </Botao>
    </div>
  )
}

/** Botão de IA: avisa do download (só na primeira vez) e mostra o progresso. */
function BotaoIa({ chave, rotulo, aoClicar, tarefa, desativado }) {
  const [noCache, setNoCache] = useState(true)
  useEffect(() => {
    modeloNoCache(chave).then(setNoCache)
  }, [chave, tarefa.fase])
  if (tarefa.fase === 'processando') return <Progresso valor={tarefa.progresso} rotulo={tarefa.rotulo} aoCancelar={tarefa.cancelar} />
  return (
    <div className="flex flex-col gap-2">
      <Botao tamanho="g" icone="filtro" onClick={aoClicar} disabled={desativado} data-ia={chave}>
        {rotulo}
      </Botao>
      <p className="text-xs text-fraca">
        {noCache
          ? 'Roda no seu aparelho: nada é enviado.'
          : `Na primeira vez, baixa a IA (${formatarBytes(MODELOS[chave].tamanho)}) — depois fica guardada no navegador. Nada da sua imagem é enviado.`}
      </p>
      {tarefa.fase === 'erro' ? <Aviso tom="erro">{tarefa.mensagem}</Aviso> : null}
    </div>
  )
}

/* ─── Editor ─────────────────────────────────────────────────────────────── */

const corBaseDe = (formato) => (formato === 'jpg' ? 'jpg' : formato)

export default function EditorImagem() {
  const [p, setP] = useSalvo('projeto', null) // { nome, base: Blob, w, h, ajustes, textos, tipo }
  useEmEdicao(Boolean(p))
  const historico = useHistorico(p, setP, Boolean(p))
  const [bitmap, setBitmap] = useState(null)
  const [previa, setPrevia] = useState(null)
  const [ferramenta, setFerramenta] = useState('ajustes')
  const [rascunho, setRascunho] = useState(null)
  const [selecionado, setSelecionado] = useState(null)
  const [zoom, setZoom] = useState('ajustar')
  const [escalaAtual, setEscalaAtual] = useState(1)
  const [pincel, setPincel] = useState({ tamanho: 40, cor: '#e11d48', opacidade: 100, borracha: false })
  const [pintura, setPintura] = useState(null) // { canvas, ctx, sujo, ouvir }
  const [estiloTexto, setEstiloTexto] = useState({ tamanho: 64, cor: '#ffffff', fonte: FONTES[0].id, negrito: true, contorno: true, corContorno: '#000000' })
  const [baixando, setBaixando] = useState(null)
  const [estimativa, setEstimativa] = useState(null) // { chave, blob } | { chave, calculando }
  const [erro, setErro] = useState(null)
  const [aplicando, setAplicando] = useState(false)
  const tarefaIa = useTarefa()
  const entrada = useRef(null)

  const mudar = useCallback((d) => setP((x) => (x ? { ...x, ...(typeof d === 'function' ? d(x) : d) } : x)), [setP])

  // Base (Blob) → bitmap; prévia reduzida com os ajustes.
  useEffect(() => {
    if (!p?.base) {
      setBitmap(null)
      return undefined
    }
    let vivo = true
    createImageBitmap(p.base).then((b) => vivo && setBitmap(b))
    return () => {
      vivo = false
    }
  }, [p?.base])
  const reduzida = useRef(null)
  useEffect(() => {
    if (!bitmap) return
    const k = Math.min(1, PREVIA_MAX / Math.max(bitmap.width, bitmap.height))
    const c = canvas(bitmap.width * k, bitmap.height * k)
    const ctx = c.getContext('2d')
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(bitmap, 0, 0, c.width, c.height)
    reduzida.current = c
    setPrevia(renderizarAjustes(c, p?.ajustes ?? NEUTRO))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bitmap])
  useEffect(() => {
    if (!reduzida.current) return undefined
    const q = requestAnimationFrame(() => setPrevia(renderizarAjustes(reduzida.current, p?.ajustes ?? NEUTRO)))
    return () => cancelAnimationFrame(q)
  }, [p?.ajustes])

  /* abrir */
  const abrir = async (lista) => {
    const a = [...(lista ?? [])][0]
    if (!a) return
    setErro(null)
    if (a.size > LIMITE_IMAGEM) return setErro('Essa imagem passa do limite de 60 MB.')
    try {
      const fonte = (await ehSvg(a)) ? await rasterizarSvg(a, 2) : await createImageBitmap(a, { imageOrientation: 'from-image' })
      const c = canvas(fonte.width, fonte.height)
      c.getContext('2d').drawImage(fonte, 0, 0)
      const base = await c.convertToBlob({ type: 'image/png' })
      historico.reiniciar()
      setFerramenta('ajustes')
      setRascunho(null)
      setPintura(null)
      setZoom('ajustar')
      const ext = extensaoDe(a.name)
      setP({ nome: `${semExtensao(a.name)}-editada`, base, w: c.width, h: c.height, ajustes: NEUTRO, textos: [], tipo: ['jpg', 'jpeg'].includes(ext) ? 'jpg' : ['png', 'webp', 'avif'].includes(ext) ? ext : 'png' })
    } catch (e) {
      console.error(e)
      setErro('Não foi possível abrir essa imagem.')
    }
  }

  /** Troca a imagem-base por um canvas novo (com os textos acompanhando, se preciso). */
  const comprometer = async (novo, transformarTexto) => {
    setAplicando(true)
    try {
      const base = await novo.convertToBlob({ type: 'image/png' })
      mudar((x) => ({ base, w: novo.width, h: novo.height, textos: transformarTexto ? x.textos.map(transformarTexto) : x.textos }))
    } finally {
      setAplicando(false)
    }
  }

  /* ferramentas */
  const novaPintura = (w, h) => {
    const c = canvas(w, h)
    return { canvas: c, ctx: c.getContext('2d'), sujo: false, ouvir: null }
  }
  const escolher = (id) => {
    setFerramenta(id)
    setSelecionado(null)
    if (!p) return
    if (id === 'recortar') setRascunho({ x: p.w * 0.1, y: p.h * 0.1, w: p.w * 0.8, h: p.h * 0.8, proporcao: null, prop: 'livre' })
    else if (id === 'tamanho') setRascunho({ w: p.w, h: p.h, trava: true })
    else if (id === 'girar') setRascunho({ angulo: 0 })
    else setRascunho(null)
    setPintura(id === 'apagar' || id === 'pincel' ? novaPintura(p.w, p.h) : null)
  }
  // Mudou o tamanho da imagem (aplicou, desfez…): a pintura acompanha.
  useEffect(() => {
    if (p && pintura && (pintura.canvas.width !== p.w || pintura.canvas.height !== p.h)) setPintura(novaPintura(p.w, p.h))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p?.w, p?.h])

  const aplicarRecorte = () => {
    const r = rascunho
    const c = canvas(r.w, r.h)
    c.getContext('2d').drawImage(bitmap, r.x, r.y, r.w, r.h, 0, 0, Math.round(r.w), Math.round(r.h))
    comprometer(c, (t) => ({ ...t, x: t.x - r.x, y: t.y - r.y }))
    setRascunho(null)
    setFerramenta('ajustes')
  }
  const aplicarTamanho = (nw = rascunho.w, nh = rascunho.h, cobrir = false) => {
    const c = canvas(nw, nh)
    const ctx = c.getContext('2d')
    ctx.imageSmoothingQuality = 'high'
    if (cobrir) {
      // Corta as sobras para caber na proporção, sem esticar.
      const k = Math.max(nw / bitmap.width, nh / bitmap.height)
      const sw = nw / k
      const sh = nh / k
      ctx.drawImage(bitmap, (bitmap.width - sw) / 2, (bitmap.height - sh) / 2, sw, sh, 0, 0, nw, nh)
    } else ctx.drawImage(bitmap, 0, 0, nw, nh)
    const kx = nw / p.w
    const ky = nh / p.h
    const trava = rascunho?.trava ?? true
    comprometer(c, (t) => ({ ...t, x: t.x * kx, y: t.y * ky, tamanho: t.tamanho * Math.min(kx, ky) })).then(() => setRascunho({ w: Math.round(nw), h: Math.round(nh), trava }))
  }
  const girar90 = (sentido) => {
    const c = canvas(bitmap.height, bitmap.width)
    const ctx = c.getContext('2d')
    ctx.translate(c.width / 2, c.height / 2)
    ctx.rotate((sentido * Math.PI) / 2)
    ctx.drawImage(bitmap, -bitmap.width / 2, -bitmap.height / 2)
    const W = p.w
    const H = p.h
    comprometer(c, (t) => (sentido > 0 ? { ...t, x: H - t.y - t.tamanho, y: t.x } : { ...t, x: t.y, y: W - t.x - t.tamanho }))
  }
  const espelhar = (horizontal) => {
    const c = canvas(bitmap.width, bitmap.height)
    const ctx = c.getContext('2d')
    if (horizontal) {
      ctx.translate(c.width, 0)
      ctx.scale(-1, 1)
    } else {
      ctx.translate(0, c.height)
      ctx.scale(1, -1)
    }
    ctx.drawImage(bitmap, 0, 0)
    comprometer(c)
  }
  const aplicarEndireitar = () => {
    const ang = rascunho?.angulo ?? 0
    if (!ang) return
    const { w: iw, h: ih } = maiorDentroGirado(bitmap.width, bitmap.height, ang)
    const c = canvas(iw, ih)
    const ctx = c.getContext('2d')
    ctx.imageSmoothingQuality = 'high'
    ctx.translate(c.width / 2, c.height / 2)
    ctx.rotate((ang * Math.PI) / 180)
    ctx.drawImage(bitmap, -bitmap.width / 2, -bitmap.height / 2)
    const dx = (bitmap.width - iw) / 2
    const dy = (bitmap.height - ih) / 2
    comprometer(c, (t) => ({ ...t, x: t.x - dx, y: t.y - dy })).then(() => setRascunho({ angulo: 0 }))
  }
  const executarIa = (tipo) =>
    tarefaIa.executar(
      async ({ progresso, sinal }) => {
        const r = tipo === 'fundo' ? await removerFundo(bitmap, { progresso, sinal }) : await apagarObjeto(bitmap, pintura.canvas, { progresso, sinal })
        await comprometer(r)
        if (tipo === 'apagar') {
          pintura.ctx.clearRect(0, 0, pintura.canvas.width, pintura.canvas.height)
          pintura.sujo = false
          pintura.ouvir?.()
        }
        if (tipo === 'fundo') setP((x) => ({ ...x, tipo: x.tipo === 'jpg' ? 'png' : x.tipo }))
        return true
      },
      tipo === 'fundo' ? 'Removendo o fundo' : 'Apagando',
    )
  const preencherFundo = (cor) => {
    const c = canvas(bitmap.width, bitmap.height)
    const ctx = c.getContext('2d')
    ctx.fillStyle = cor
    ctx.fillRect(0, 0, c.width, c.height)
    ctx.drawImage(bitmap, 0, 0)
    comprometer(c)
  }

  /* pintura (pincel e máscara do apagar) */
  const aoPintar = ({ x, y }, comeco) => {
    const ctx = pintura.ctx
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.lineWidth = pincel.tamanho
    ctx.strokeStyle = ferramenta === 'apagar' || pincel.borracha ? '#ff2d55' : pincel.cor
    ctx.globalAlpha = ferramenta === 'apagar' || pincel.borracha ? 1 : pincel.opacidade / 100
    if (comeco) {
      ctx.beginPath()
      ctx.moveTo(x, y)
      ctx.lineTo(x + 0.01, y)
    } else ctx.lineTo(x, y)
    ctx.stroke()
    pintura.sujo = true
    pintura.ouvir?.()
  }
  const aoSoltarPintura = () => {
    if (ferramenta !== 'pincel' || !pintura.sujo) return
    // Cada traço do pincel entra na imagem (e no desfazer).
    const c = canvas(bitmap.width, bitmap.height)
    const ctx = c.getContext('2d')
    ctx.drawImage(bitmap, 0, 0)
    if (pincel.borracha) ctx.globalCompositeOperation = 'destination-out'
    ctx.drawImage(pintura.canvas, 0, 0)
    pintura.ctx.clearRect(0, 0, pintura.canvas.width, pintura.canvas.height)
    pintura.sujo = false
    comprometer(c).then(() => pintura.ouvir?.())
  }

  /* textos */
  const textoSel = p?.textos?.find((t) => t.id === selecionado)
  const mudarTexto = (id, d) => mudar((x) => ({ textos: x.textos.map((t) => (t.id === id ? { ...t, ...d } : t)) }))
  const aoClicarTexto = ({ x, y }) => {
    const tamanho = Math.round(Math.max(estiloTexto.tamanho, Math.min(p.w, p.h) / 14))
    const t = { id: novaId(), texto: 'Seu texto', x, y: y - tamanho * 0.6, ...estiloTexto, tamanho }
    mudar((q) => ({ textos: [...q.textos, t] }))
    setSelecionado(t.id)
  }
  const removerTexto = (id) => {
    mudar((x) => ({ textos: x.textos.filter((t) => t.id !== id) }))
    setSelecionado(null)
  }

  /* baixar: estimativa do tamanho (codifica de verdade, com atraso) */
  const chaveEstimativa = baixando ? JSON.stringify([baixando.formato, baixando.qualidade, baixando.fundo, p?.base?.size, p?.w, p?.h, p?.ajustes, p?.textos]) : null
  useEffect(() => {
    if (!baixando || !bitmap) return undefined
    let vivo = true
    const t = setTimeout(async () => {
      try {
        const final = renderizarFinal(bitmap, p.ajustes, p.textos)
        const blob = await codificar(final, { formato: baixando.formato, qualidade: baixando.qualidade, fundo: baixando.fundo, otimizar: baixando.formato === 'png' })
        if (vivo) setEstimativa({ chave: chaveEstimativa, blob })
      } catch (e) {
        console.error(e)
        if (vivo) setEstimativa(null)
      }
    }, 450)
    return () => {
      vivo = false
      clearTimeout(t)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chaveEstimativa])

  const baixarAgora = async (nome) => {
    const s = baixando
    const chave = chaveEstimativa
    setBaixando(null)
    mudar({ nome })
    const pronta = estimativa?.chave === chave ? estimativa.blob : null
    const blob = pronta ?? (await codificar(renderizarFinal(bitmap, p.ajustes, p.textos), { formato: s.formato, qualidade: s.qualidade, fundo: s.fundo, otimizar: s.formato === 'png' }))
    baixarBlob(blob, `${nome}.${s.formato}`)
  }

  /* atalhos */
  const teclas = useRef(null)
  teclas.current = (e) => {
    if (document.querySelector('dialog[open]')) return
    if ((e.ctrlKey || e.metaKey) && !e.altKey) {
      if (e.target.closest?.('input:not([type=range]):not([type=checkbox]), textarea, [contenteditable]')) return
      const k = e.key.toLowerCase()
      if (k === 'z' && !e.shiftKey) {
        e.preventDefault()
        historico.desfazer()
      } else if ((k === 'z' && e.shiftKey) || k === 'y') {
        e.preventDefault()
        historico.refazer()
      }
      return
    }
    if (e.target.closest?.('input, textarea, select, [contenteditable]')) return
    if (selecionado && (e.key === 'Delete' || e.key === 'Backspace')) removerTexto(selecionado)
    else if (e.key === 'Escape') setSelecionado(null)
    else if (e.key === 'Enter' && ferramenta === 'recortar' && rascunho) aplicarRecorte()
  }
  useEffect(() => {
    const f = (e) => teclas.current(e)
    addEventListener('keydown', f)
    return () => removeEventListener('keydown', f)
  }, [])

  const ocupado = aplicando || tarefaIa.fase === 'processando'
  const zoomEm = (fator) => setZoom(limitar((zoom === 'ajustar' ? escalaAtual : zoom) * fator, 0.05, 8))
  const estimado = estimativa && estimativa.chave === chaveEstimativa ? estimativa.blob : null

  /* ─── tela ─── */
  return (
    <div className="flex flex-col gap-3 lg:h-[calc(100dvh-5.5rem)] lg:min-h-[34rem]">
      {/* Barra do topo */}
      <section aria-label="Imagem" className="cartao flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 sm:px-5">
        <SeloCategoria categoria="imagem" icone="imagem" tamanho="p" />
        <div className="min-w-0 flex-1 basis-40">
          {p ? <NomeEditavel key={p.nome} nome={p.nome} extensao={corBaseDe(p.tipo)} aoMudar={(n) => mudar({ nome: n })} rotulo="Renomear a imagem final" /> : <p className="text-sm font-semibold text-tinta">Nenhuma imagem aberta</p>}
          <p className="text-xs text-fraca tabular-nums">{p ? `${p.w} × ${p.h} px` : 'Escolha uma imagem para começar'}</p>
        </div>
        <input
          ref={entrada}
          type="file"
          accept={EXTENSOES_IMAGEM.map((e) => `.${e}`).join(',')}
          className="sr-only"
          tabIndex={-1}
          aria-label="Escolher imagem"
          onChange={(e) => {
            abrir(e.target.files)
            e.target.value = ''
          }}
        />
        <Botao variante="secundario" tamanho="p" icone="arquivoMais" onClick={() => entrada.current?.click()} disabled={ocupado}>
          {p ? 'Abrir outra' : 'Escolher imagem'}
        </Botao>
        <div className="flex items-center gap-0.5">
          <BotaoAcao rotulo="Desfazer (Ctrl+Z)" icone="desfazer" onClick={historico.desfazer} disabled={!historico.podeDesfazer || ocupado} />
          <BotaoAcao rotulo="Refazer (Ctrl+Shift+Z)" icone="refazerAcao" onClick={historico.refazer} disabled={!historico.podeRefazer || ocupado} />
        </div>
        <div className="flex items-center gap-0.5 rounded-lg border border-borda px-0.5">
          <BotaoAcao rotulo="Diminuir o zoom" icone="zoomMenos" onClick={() => zoomEm(1 / 1.25)} disabled={!p} />
          <button type="button" onClick={() => setZoom('ajustar')} disabled={!p} className="min-w-14 text-xs font-semibold text-suave tabular-nums hover:text-tinta" title="Ajustar à tela">
            {Math.round(escalaAtual * 100)}%
          </button>
          <BotaoAcao rotulo="Aumentar o zoom" icone="zoomMais" onClick={() => zoomEm(1.25)} disabled={!p} />
        </div>
        <Botao icone="baixar" onClick={() => setBaixando({ formato: p.tipo, qualidade: 90, fundo: '#ffffff' })} disabled={!p || ocupado}>
          Baixar
        </Botao>
      </section>

      {erro ? (
        <Aviso tom="erro" aoFechar={() => setErro(null)}>
          {erro}
        </Aviso>
      ) : null}

      <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-[4.75rem_minmax(0,1fr)_19rem]">
        {/* Ferramentas */}
        <nav aria-label="Ferramentas" className="cartao flex gap-1 overflow-x-auto p-1.5 lg:flex-col lg:overflow-visible">
          {FERRAMENTAS.map((f) => (
            <button
              key={f.id}
              type="button"
              aria-pressed={ferramenta === f.id}
              disabled={!p || ocupado}
              onClick={() => escolher(f.id)}
              className={`flex min-w-16 flex-col items-center gap-1 rounded-lg px-1 py-2 text-[0.625rem] leading-tight font-semibold transition-colors disabled:opacity-40 ${ferramenta === f.id ? 'bg-marca text-sobre-marca' : 'text-suave hover:bg-superficie-2 hover:text-tinta'}`}
            >
              <Icone nome={f.icone} tamanho={18} />
              {f.rotulo}
            </button>
          ))}
        </nav>

        {/* Imagem */}
        <div className="flex min-h-0 flex-col">
          {p && previa ? (
            <Tela
              previa={previa}
              w={p.w}
              h={p.h}
              zoom={zoom}
              ferramenta={ferramenta}
              rascunho={rascunho}
              setRascunho={setRascunho}
              textos={p.textos}
              selecionado={selecionado}
              aoSelecionar={setSelecionado}
              aoMoverTexto={mudarTexto}
              aoClicarTexto={aoClicarTexto}
              pintura={pintura}
              aoPintar={aoPintar}
              aoSoltarPintura={aoSoltarPintura}
              pincel={ferramenta === 'pincel' || ferramenta === 'apagar' ? pincel : null}
              aoEscala={setEscalaAtual}
            />
          ) : (
            <label
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault()
                abrir(e.dataTransfer.files)
              }}
              className="flex min-h-[22rem] flex-1 cursor-pointer flex-col items-center justify-center gap-3 rounded-[var(--radius-cartao)] border-2 border-dashed border-borda-forte bg-superficie-2 px-6 text-center hover:border-fraca"
            >
              <input type="file" accept={EXTENSOES_IMAGEM.map((e) => `.${e}`).join(',')} className="sr-only" onChange={(e) => abrir(e.target.files)} />
              <SeloCategoria categoria="imagem" icone="imagem" tamanho="gg" />
              <span className="font-display text-lg font-bold text-tinta">Escolha ou arraste uma imagem</span>
              <span className="max-w-sm text-sm text-suave">{DESCRICAO_IMAGEM} · até 60 MB. Ajuste, recorte, remova o fundo, apague objetos, escreva — tudo no seu aparelho.</span>
            </label>
          )}
        </div>

        {/* Opções da ferramenta */}
        <aside className="cartao rolagem-fina flex min-h-0 flex-col gap-5 overflow-y-auto p-4" aria-label="Opções da ferramenta">
          {!p ? (
            <p className="text-sm text-suave">Abra uma imagem para ver as opções.</p>
          ) : ferramenta === 'ajustes' ? (
            <PainelAjustes a={p.ajustes} mudar={(a) => mudar({ ajustes: a })} />
          ) : ferramenta === 'recortar' && rascunho ? (
            <>
              <Grupo titulo="Proporção">
                <div className="grid grid-cols-4 gap-1.5">
                  {PROPORCOES.map((pr) => (
                    <button
                      key={pr.id}
                      type="button"
                      aria-pressed={rascunho.prop === pr.id}
                      onClick={() => {
                        if (!pr.valor) return setRascunho((r) => ({ ...r, proporcao: null, prop: pr.id }))
                        const w = Math.min(p.w, p.h * pr.valor)
                        const h = w / pr.valor
                        return setRascunho({ x: (p.w - w) / 2, y: (p.h - h) / 2, w, h, proporcao: pr.valor, prop: pr.id })
                      }}
                      className={`h-8 rounded-lg border text-xs font-semibold tabular-nums transition-colors ${rascunho.prop === pr.id ? 'border-marca bg-marca text-sobre-marca' : 'border-borda text-suave hover:text-tinta'}`}
                    >
                      {pr.rotulo}
                    </button>
                  ))}
                </div>
              </Grupo>
              <p className="text-xs text-fraca tabular-nums">
                Arraste a área clara; as alças mudam o tamanho. {Math.round(rascunho.w)} × {Math.round(rascunho.h)} px
              </p>
              <Acoes rotulo="Aplicar recorte" aplicar={aplicarRecorte} cancelar={() => escolher('ajustes')} />
            </>
          ) : ferramenta === 'tamanho' && rascunho ? (
            <>
              <Grupo titulo="Largura e altura">
                <div className="grid grid-cols-2 gap-3">
                  <Entrada
                    rotulo="Largura"
                    type="number"
                    min="1"
                    sufixo="px"
                    valor={String(rascunho.w)}
                    aoMudar={(v) => {
                      const nw = Math.max(1, Math.round(Number(v) || 1))
                      setRascunho((r) => ({ ...r, w: nw, h: r.trava ? Math.max(1, Math.round((nw * p.h) / p.w)) : r.h }))
                    }}
                  />
                  <Entrada
                    rotulo="Altura"
                    type="number"
                    min="1"
                    sufixo="px"
                    valor={String(rascunho.h)}
                    aoMudar={(v) => {
                      const nh = Math.max(1, Math.round(Number(v) || 1))
                      setRascunho((r) => ({ ...r, h: nh, w: r.trava ? Math.max(1, Math.round((nh * p.w) / p.h)) : r.w }))
                    }}
                  />
                </div>
                <Caixa rotulo="Manter a proporção" marcado={rascunho.trava} aoMudar={(v) => setRascunho((r) => ({ ...r, trava: v, h: v ? Math.round((r.w * p.h) / p.w) : r.h }))} />
                <p className="text-xs text-fraca">Desmarque e arraste as alças da imagem para esticar ou achatar.</p>
                <div className="flex flex-wrap gap-1.5">
                  {[25, 50, 75, 150, 200].map((pc) => (
                    <button key={pc} type="button" onClick={() => setRascunho((r) => ({ ...r, w: Math.round((p.w * pc) / 100), h: Math.round((p.h * pc) / 100) }))} className="h-8 rounded-lg border border-borda px-2.5 text-xs font-semibold text-suave tabular-nums hover:text-tinta">
                      {pc}%
                    </button>
                  ))}
                </div>
              </Grupo>
              <Acoes rotulo="Aplicar tamanho" aplicar={() => aplicarTamanho()} cancelar={() => setRascunho({ w: p.w, h: p.h, trava: true })} desativado={rascunho.w === p.w && rascunho.h === p.h} />
              <Grupo titulo="Tamanho de rede social">
                <Seletor
                  valor=""
                  aoMudar={(id) => {
                    const r = REDES.find((x) => x.id === id)
                    if (r) aplicarTamanho(r.w, r.h, true)
                  }}
                  opcoes={[{ valor: '', rotulo: 'Escolha para aplicar…' }, ...REDES.map((r) => ({ valor: r.id, rotulo: `${r.nome} · ${r.w}×${r.h}` }))]}
                />
                <p className="text-xs text-fraca">Corta as sobras para caber no formato, sem esticar.</p>
              </Grupo>
            </>
          ) : ferramenta === 'girar' && rascunho ? (
            <>
              <Grupo titulo="Girar e espelhar">
                <div className="grid grid-cols-2 gap-2">
                  <Botao variante="secundario" icone="girar" className="[&>svg]:-scale-x-100" onClick={() => girar90(-1)}>
                    Anti-horário
                  </Botao>
                  <Botao variante="secundario" icone="girar" onClick={() => girar90(1)}>
                    Horário
                  </Botao>
                  <Botao variante="secundario" icone="espelhar" onClick={() => espelhar(true)}>
                    Espelhar ↔
                  </Botao>
                  <Botao variante="secundario" icone="espelhar" className="[&>svg]:rotate-90" onClick={() => espelhar(false)}>
                    Espelhar ↕
                  </Botao>
                </div>
              </Grupo>
              <Grupo titulo="Endireitar">
                <Deslizante rotulo="Ângulo" valor={rascunho.angulo} aoMudar={(v) => setRascunho({ angulo: v })} min={-45} max={45} passo={0.5} formatar={(v) => `${v.toLocaleString('pt-BR')}°`} />
                <p className="text-xs text-fraca">Gira um pouco e corta as bordas para a imagem continuar retangular.</p>
                <Acoes rotulo="Aplicar" aplicar={aplicarEndireitar} cancelar={() => setRascunho({ angulo: 0 })} desativado={!rascunho.angulo} />
              </Grupo>
            </>
          ) : ferramenta === 'fundo' ? (
            <>
              <Grupo titulo="Remover fundo">
                <p className="text-sm text-suave">A IA separa a pessoa ou o objeto principal e deixa o fundo transparente.</p>
                <BotaoIa chave="fundo" rotulo="Remover fundo" aoClicar={() => executarIa('fundo')} tarefa={tarefaIa} desativado={ocupado} />
              </Grupo>
              <Grupo titulo="Pôr uma cor no fundo">
                <p className="text-xs text-fraca">Depois de remover, preencha o transparente com uma cor (ou baixe em PNG/WebP para manter transparente).</p>
                <CorFundo aoAplicar={preencherFundo} desativado={ocupado} />
              </Grupo>
            </>
          ) : ferramenta === 'apagar' ? (
            <Grupo titulo="Apagar objeto">
              <p className="text-sm text-suave">Pinte por cima do que quer apagar (pessoa, texto, sujeira…) e clique em Apagar. A IA preenche o lugar com o que estaria atrás.</p>
              <Deslizante rotulo="Tamanho do pincel" valor={pincel.tamanho} aoMudar={(v) => setPincel((x) => ({ ...x, tamanho: v }))} min={4} max={300} formatar={(v) => `${v} px`} />
              <BotaoIa chave="apagar" rotulo="Apagar o que foi pintado" aoClicar={() => executarIa('apagar')} tarefa={tarefaIa} desativado={ocupado} />
              <Botao
                variante="fantasma"
                tamanho="p"
                className="self-start"
                onClick={() => {
                  if (!pintura) return
                  pintura.ctx.clearRect(0, 0, pintura.canvas.width, pintura.canvas.height)
                  pintura.sujo = false
                  pintura.ouvir?.()
                }}
              >
                Limpar a pintura
              </Botao>
            </Grupo>
          ) : ferramenta === 'pincel' ? (
            <Grupo titulo="Pincel">
              <div className="grid grid-cols-2 gap-1.5">
                {[
                  [false, 'Pincel'],
                  [true, 'Borracha'],
                ].map(([b, r]) => (
                  <button key={r} type="button" aria-pressed={pincel.borracha === b} onClick={() => setPincel((x) => ({ ...x, borracha: b }))} className={`h-9 rounded-lg border text-xs font-semibold ${pincel.borracha === b ? 'border-marca bg-marca text-sobre-marca' : 'border-borda text-suave hover:text-tinta'}`}>
                    {r}
                  </button>
                ))}
              </div>
              {pincel.borracha ? <p className="text-xs text-fraca">A borracha deixa transparente (baixe em PNG ou WebP para manter).</p> : <CorDeFundo valor={pincel.cor} aoMudar={(v) => setPincel((x) => ({ ...x, cor: v }))} rotulo="Cor" />}
              <Deslizante rotulo="Tamanho" valor={pincel.tamanho} aoMudar={(v) => setPincel((x) => ({ ...x, tamanho: v }))} min={1} max={300} formatar={(v) => `${v} px`} />
              {pincel.borracha ? null : <Deslizante rotulo="Opacidade" valor={pincel.opacidade} aoMudar={(v) => setPincel((x) => ({ ...x, opacidade: v }))} min={5} max={100} formatar={(v) => `${v}%`} />}
            </Grupo>
          ) : ferramenta === 'texto' ? (
            textoSel ? (
              <Grupo titulo="Texto selecionado">
                <AreaTexto rotulo="Texto" valor={textoSel.texto} aoMudar={(v) => mudarTexto(textoSel.id, { texto: v })} rows={3} className="[&_textarea]:min-h-20 [&_textarea]:font-sans" />
                <EstiloTexto t={textoSel} mudar={(d) => mudarTexto(textoSel.id, d)} />
                <Botao variante="perigo" tamanho="p" icone="apagar" onClick={() => removerTexto(textoSel.id)}>
                  Excluir texto
                </Botao>
              </Grupo>
            ) : (
              <Grupo titulo="Texto">
                <p className="text-sm text-suave">Clique na imagem onde quer escrever. Arraste para mover; Delete apaga.</p>
                <EstiloTexto t={estiloTexto} mudar={(d) => setEstiloTexto((s) => ({ ...s, ...d }))} />
              </Grupo>
            )
          ) : null}
          {aplicando ? <p className="text-xs text-fraca">Aplicando…</p> : null}
        </aside>
      </div>

      {/* Baixar: nome, formato, qualidade e o tamanho estimado */}
      <DialogoBaixar
        aberto={Boolean(baixando)}
        aoFechar={() => setBaixando(null)}
        titulo="Baixar a imagem"
        nome={p?.nome ?? 'imagem'}
        extensao={baixando?.formato}
        resumo={
          baixando && p ? (
            <span data-estimativa="">
              {p.w} × {p.h} px · Tamanho estimado: {estimado ? `~${formatarBytes(estimado.size)}` : 'calculando…'}
            </span>
          ) : null
        }
        aoConfirmar={baixarAgora}
      >
        {baixando ? (
          <>
            <OpcoesCartoes
              rotulo="Formato"
              valor={baixando.formato}
              aoMudar={(v) => setBaixando((b) => ({ ...b, formato: v }))}
              colunas="grid-cols-2 sm:grid-cols-4"
              opcoes={[
                { valor: 'png', rotulo: 'PNG', dica: 'Sem perdas, transparência' },
                { valor: 'jpg', rotulo: 'JPG', dica: 'Abre em tudo' },
                { valor: 'webp', rotulo: 'WebP', dica: 'Menor, transparência' },
                { valor: 'avif', rotulo: 'AVIF', dica: 'O menor de todos' },
              ]}
            />
            {baixando.formato === 'png' ? null : <Deslizante rotulo="Qualidade" valor={baixando.qualidade} aoMudar={(v) => setBaixando((b) => ({ ...b, qualidade: v }))} min={10} max={100} formatar={(v) => `${v}%`} />}
            {baixando.formato === 'jpg' ? <CorDeFundo valor={baixando.fundo} aoMudar={(v) => setBaixando((b) => ({ ...b, fundo: v }))} /> : null}
            <p className="text-xs text-fraca">Ao salvar, os metadados (EXIF, GPS) saem junto.</p>
          </>
        ) : null}
      </DialogoBaixar>
    </div>
  )
}

function CorFundo({ aoAplicar, desativado }) {
  const [cor, setCor] = useState('#ffffff')
  return (
    <div className="flex items-end gap-2">
      <CorDeFundo valor={cor} aoMudar={setCor} rotulo="Cor" />
      <Botao variante="secundario" tamanho="p" onClick={() => aoAplicar(cor)} disabled={desativado}>
        Preencher
      </Botao>
    </div>
  )
}

function EstiloTexto({ t, mudar }) {
  return (
    <div className="flex flex-col gap-4">
      <Seletor rotulo="Fonte" valor={t.fonte} aoMudar={(v) => mudar({ fonte: v })} opcoes={FONTES.map((f) => ({ valor: f.id, rotulo: f.rotulo }))} />
      <Deslizante rotulo="Tamanho" valor={t.tamanho} aoMudar={(v) => mudar({ tamanho: v })} min={8} max={600} formatar={(v) => `${v} px`} />
      <CorDeFundo valor={t.cor} aoMudar={(v) => mudar({ cor: v })} rotulo="Cor" />
      <Caixa rotulo="Negrito" marcado={t.negrito} aoMudar={(v) => mudar({ negrito: v })} />
      <Caixa rotulo="Contorno" marcado={t.contorno} aoMudar={(v) => mudar({ contorno: v })} />
      {t.contorno ? <CorDeFundo valor={t.corContorno} aoMudar={(v) => mudar({ corContorno: v })} rotulo="Cor do contorno" /> : null}
    </div>
  )
}
