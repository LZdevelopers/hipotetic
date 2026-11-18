import { useId } from 'react'
import { Link } from '../nucleo/roteador'
import { Icone } from './Icone'
import { CORES_3D, Glifo, temGlifo } from './inicio/Glifo'

/* ==========================================================================
   Primitivas de interface. Todas as ferramentas usam só estas peças, o que
   mantém a plataforma consistente: mesmo botão, mesmo campo, mesmo aviso.
   ========================================================================== */

const VARIANTES = {
  primario: 'bg-marca text-sobre-marca hover:bg-marca-hover disabled:bg-marca/40',
  secundario: 'border border-borda-forte bg-superficie text-tinta hover:bg-superficie-2 disabled:text-fraca',
  fantasma: 'text-suave hover:bg-superficie-2 hover:text-tinta disabled:text-fraca',
  sucesso: 'bg-sucesso text-white escuro:text-fundo hover:brightness-110',
  perigo: 'border border-perigo/30 bg-perigo-suave text-perigo hover:border-perigo/60',
}

const TAMANHOS = {
  p: 'h-8 gap-1.5 rounded-lg px-3 text-[0.8125rem]',
  m: 'h-10 gap-2 rounded-[var(--radius-controle)] px-4 text-sm',
  g: 'h-12 gap-2 rounded-xl px-6 text-[0.9375rem]',
}

export function classesBotao(variante = 'primario', tamanho = 'm', extra = '') {
  return `inline-flex shrink-0 items-center justify-center font-semibold whitespace-nowrap transition-[background-color,border-color,color,filter] duration-150 active:translate-y-px disabled:cursor-not-allowed disabled:active:translate-y-0 ${VARIANTES[variante]} ${TAMANHOS[tamanho]} ${extra}`
}

export function Botao({ variante, tamanho, icone, iconeDireita, carregando, children, className = '', type = 'button', ...props }) {
  const t = tamanho === 'p' ? 15 : 17
  return (
    <button type={type} className={classesBotao(variante, tamanho, className)} disabled={carregando || props.disabled} {...props}>
      {carregando ? <Icone nome="carregando" tamanho={t} className="animate-girar" /> : icone ? <Icone nome={icone} tamanho={t} /> : null}
      {children}
      {iconeDireita ? <Icone nome={iconeDireita} tamanho={t} /> : null}
    </button>
  )
}

/** Botão com aparência de link interno (navega sem recarregar) ou externo. */
export function BotaoLink({ para, href, variante, tamanho, icone, iconeDireita, children, className = '', ...props }) {
  const t = tamanho === 'p' ? 15 : 17
  const conteudo = (
    <>
      {icone ? <Icone nome={icone} tamanho={t} /> : null}
      {children}
      {iconeDireita ? <Icone nome={iconeDireita} tamanho={t} /> : null}
    </>
  )
  const classes = classesBotao(variante, tamanho, className)
  return para ? (
    <Link para={para} className={classes} {...props}>
      {conteudo}
    </Link>
  ) : (
    <a href={href} className={classes} {...props}>
      {conteudo}
    </a>
  )
}

/** Rótulo + controle + dica, empilhados. */
export function Campo({ rotulo, dica, id, children, className = '', direita }) {
  return (
    <div className={`flex min-w-0 flex-col gap-1.5 ${className}`}>
      {rotulo ? (
        <div className="flex items-baseline justify-between gap-3">
          <label htmlFor={id} className="text-[0.8125rem] font-semibold text-tinta">
            {rotulo}
          </label>
          {direita ? <span className="text-xs text-fraca tabular-nums">{direita}</span> : null}
        </div>
      ) : null}
      {children}
      {dica ? <p className="text-xs leading-relaxed text-fraca">{dica}</p> : null}
    </div>
  )
}

const CONTROLE =
  'h-10 w-full min-w-0 rounded-[var(--radius-controle)] border border-borda-forte bg-superficie px-3 text-sm text-tinta transition-colors hover:border-fraca/60 focus:border-acento focus:outline-none disabled:opacity-60'

export function Seletor({ rotulo, dica, valor, aoMudar, opcoes, className, ...props }) {
  const id = useId()
  return (
    <Campo rotulo={rotulo} dica={dica} id={id} className={className}>
      <div className="relative">
        <select id={id} value={valor} onChange={(e) => aoMudar(e.target.value)} className={`${CONTROLE} appearance-none pr-9`} {...props}>
          {opcoes.map((o) => (
            <option key={o.valor} value={o.valor} disabled={o.desativado}>
              {o.rotulo}
            </option>
          ))}
        </select>
        <Icone nome="setaBaixo" tamanho={16} className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-fraca" />
      </div>
    </Campo>
  )
}

export function Entrada({ rotulo, dica, valor, aoMudar, className, sufixo, ...props }) {
  const id = useId()
  return (
    <Campo rotulo={rotulo} dica={dica} id={id} className={className}>
      <div className="relative">
        <input id={id} value={valor} onChange={(e) => aoMudar(e.target.value)} className={`${CONTROLE} ${sufixo ? 'pr-12' : ''}`} {...props} />
        {sufixo ? <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-xs text-fraca">{sufixo}</span> : null}
      </div>
    </Campo>
  )
}

export function AreaTexto({ rotulo, dica, valor, aoMudar, className, ...props }) {
  const id = useId()
  return (
    <Campo rotulo={rotulo} dica={dica} id={id} className={className}>
      <textarea
        id={id}
        value={valor}
        onChange={(e) => aoMudar(e.target.value)}
        className="min-h-32 w-full rounded-[var(--radius-controle)] border border-borda-forte bg-superficie p-3 font-mono text-[0.8125rem] leading-relaxed text-tinta transition-colors focus:border-acento focus:outline-none"
        spellCheck="false"
        {...props}
      />
    </Campo>
  )
}

/** Escolha única em botões lado a lado (radio group). */
export function Segmentado({ rotulo, dica, valor, aoMudar, opcoes, className = '' }) {
  const id = useId()
  return (
    <Campo rotulo={rotulo} dica={dica} id={id} className={className}>
      <div role="radiogroup" aria-labelledby={id} className="flex flex-wrap gap-1 rounded-[var(--radius-controle)] border border-borda bg-superficie-2 p-1">
        {opcoes.map((o) => {
          const ativo = o.valor === valor
          return (
            <button
              key={o.valor}
              type="button"
              role="radio"
              aria-checked={ativo}
              disabled={o.desativado}
              onClick={() => aoMudar(o.valor)}
              className={`inline-flex h-8 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-md px-3 text-[0.8125rem] font-semibold whitespace-nowrap transition-colors disabled:opacity-40 ${
                ativo ? 'bg-superficie text-tinta shadow-[0_1px_2px_rgb(0_0_0/0.12)] ring-1 ring-borda' : 'text-suave hover:text-tinta'
              }`}
            >
              {o.icone ? <Icone nome={o.icone} tamanho={15} /> : null}
              {o.rotulo}
            </button>
          )
        })}
      </div>
      <span id={id} className="sr-only">
        {rotulo}
      </span>
    </Campo>
  )
}

export function Deslizante({ rotulo, dica, valor, aoMudar, min = 0, max = 100, passo = 1, formatar = (v) => v, className }) {
  const id = useId()
  const preenchido = `${((valor - min) / (max - min)) * 100}%`
  return (
    <Campo rotulo={rotulo} dica={dica} id={id} className={className} direita={formatar(valor)}>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={passo}
        value={valor}
        onChange={(e) => aoMudar(Number(e.target.value))}
        className="deslizante"
        style={{ '--preenchido': preenchido }}
      />
    </Campo>
  )
}

export function Caixa({ rotulo, dica, marcado, aoMudar, className = '' }) {
  const id = useId()
  return (
    <div className={`flex items-start gap-2.5 ${className}`}>
      <input
        id={id}
        type="checkbox"
        checked={marcado}
        onChange={(e) => aoMudar(e.target.checked)}
        className="mt-0.5 size-4 shrink-0 cursor-pointer accent-[var(--color-marca)]"
      />
      <label htmlFor={id} className="cursor-pointer text-sm leading-snug text-texto">
        {rotulo}
        {dica ? <span className="mt-0.5 block text-xs text-fraca">{dica}</span> : null}
      </label>
    </div>
  )
}

const TONS = {
  info: { caixa: 'border-acento/25 bg-acento-suave', icone: 'info', cor: 'text-acento' },
  sucesso: { caixa: 'border-sucesso/25 bg-sucesso-suave', icone: 'check', cor: 'text-sucesso' },
  alerta: { caixa: 'border-alerta/30 bg-alerta-suave', icone: 'alerta', cor: 'text-alerta' },
  erro: { caixa: 'border-perigo/30 bg-perigo-suave', icone: 'alerta', cor: 'text-perigo' },
}

export function Aviso({ tom = 'info', titulo, children, acao, aoFechar, className = '' }) {
  const t = TONS[tom]
  return (
    <div role={tom === 'erro' ? 'alert' : 'status'} className={`flex items-start gap-3 rounded-xl border p-3.5 text-sm ${t.caixa} ${className}`}>
      <Icone nome={t.icone} tamanho={18} className={`mt-px ${t.cor}`} />
      <div className="min-w-0 flex-1 leading-relaxed text-texto">
        {titulo ? <p className="font-semibold text-tinta">{titulo}</p> : null}
        {children ? <div className={titulo ? 'mt-0.5' : ''}>{children}</div> : null}
        {acao ? <div className="mt-2.5">{acao}</div> : null}
      </div>
      {aoFechar ? (
        <button type="button" onClick={aoFechar} className="grid size-7 shrink-0 place-items-center rounded-md text-fraca hover:bg-black/5 hover:text-tinta" aria-label="Fechar aviso">
          <Icone nome="fechar" tamanho={15} />
        </button>
      ) : null}
    </div>
  )
}

export function Etiqueta({ children, tom = 'neutro', icone, className = '' }) {
  const cores = {
    neutro: 'border-borda bg-superficie-2 text-suave',
    sucesso: 'border-sucesso/25 bg-sucesso-suave text-sucesso',
    alerta: 'border-alerta/30 bg-alerta-suave text-alerta',
    info: 'border-acento/25 bg-acento-suave text-acento',
  }
  return (
    <span className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[0.6875rem] font-semibold whitespace-nowrap ${cores[tom]} ${className}`}>
      {icone ? <Icone nome={icone} tamanho={12} /> : null}
      {children}
    </span>
  )
}

/** Barra de progresso. `valor` 0→1, ou null para indeterminado. */
export function Progresso({ valor, rotulo, detalhe, aoCancelar }) {
  const pct = valor == null ? null : Math.round(Math.min(Math.max(valor, 0), 1) * 100)
  return (
    <div className="flex items-center gap-3" role="status" aria-live="polite">
      <div className="min-w-0 flex-1">
        <div className="mb-1.5 flex items-baseline justify-between gap-3 text-[0.8125rem]">
          <span className="truncate font-semibold text-tinta">{rotulo}</span>
          <span className="shrink-0 text-xs text-fraca tabular-nums">{detalhe ?? (pct == null ? '' : `${pct}%`)}</span>
        </div>
        <div
          className="h-1.5 overflow-hidden rounded-full bg-superficie-3"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={pct ?? undefined}
          aria-label={rotulo}
        >
          {pct == null ? (
            <div className="esqueleto h-full w-full" style={{ backgroundImage: 'linear-gradient(90deg, transparent, var(--color-acento), transparent)' }} />
          ) : (
            <div className="h-full rounded-full bg-acento transition-[width] duration-200" style={{ width: `${pct}%` }} />
          )}
        </div>
      </div>
      {aoCancelar ? (
        <Botao variante="secundario" tamanho="p" onClick={aoCancelar}>
          Cancelar
        </Botao>
      ) : null}
    </div>
  )
}

/** Bloco com título para agrupar as configurações de uma ferramenta. */
export function Grupo({ titulo, children, className = '' }) {
  return (
    <fieldset className={`min-w-0 ${className}`}>
      {titulo ? <legend className="mb-3 text-xs font-semibold tracking-wide text-fraca uppercase">{titulo}</legend> : null}
      {children}
    </fieldset>
  )
}

/** Ícone de categoria em um quadrado com a cor da categoria. */
/**
 * Ícone de ferramenta/categoria: o mesmo "bloco" brilhante da página inicial
 * (mesmas cores e glifos dos blocos 3D), em tamanho pequeno. Se o ícone tem
 * glifo próprio (as categorias), usa o glifo; senão, o ícone de traço em branco.
 */
export function SeloCategoria({ categoria, icone, tamanho = 'm', className = '' }) {
  const medidas = { pp: ['size-7 rounded-[0.5rem]', 14], p: ['size-8 rounded-[0.6rem]', 16], m: ['size-10 rounded-xl', 19], g: ['size-12 rounded-[0.9rem]', 22], gg: ['size-14 rounded-2xl', 26] }[tamanho]
  const [a, b] = CORES_3D[categoria] ?? CORES_3D.documentos
  return (
    <span aria-hidden="true" className={`selo-bloco grid shrink-0 place-items-center ${medidas[0]} ${className}`} style={{ '--a': a, '--b': b }}>
      {temGlifo(icone) ? (
        <Glifo nome={icone} className="relative" style={{ width: medidas[1] * 1.15, height: medidas[1] * 1.15 }} />
      ) : (
        <Icone nome={icone} tamanho={medidas[1]} strokeWidth={2.2} colorido={icone === 'youtube'} className="relative" />
      )}
    </span>
  )
}
