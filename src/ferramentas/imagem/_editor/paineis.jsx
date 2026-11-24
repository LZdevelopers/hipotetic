import { useEffect, useMemo, useRef, useState } from 'react'
import { SeletorCor } from '../../../componentes/SeletorCor'
import { Icone } from '../../../componentes/Icone'
import { AreaTexto, Aviso, Botao, Caixa, Deslizante, Progresso, Seletor } from '../../../componentes/ui'
import { FILTROS, NEUTRO, ehNeutro, misturarFiltro, renderizarAjustes } from '../../../motores/imagem/ajustes'
import { MODELOS, modeloNoCache, tempoEstimado } from '../../../motores/imagem/ia'
import { formatarBytes } from '../../../nucleo/arquivos'
import { FONTES, MISTURAS, PADRAO_CAMADA_IMAGEM } from './documento'
import { OPCOES_DO_PINCEL, PINCEIS } from './pinceis'
import { PADRAO_TEXTO } from '../../video/_projeto'

/* ─── Peças ────────────────────────────────────────────────────────────── */

export function Grupo({ titulo, children, direita }) {
  return (
    <div className="flex flex-col gap-3">
      {titulo ? (
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-xs font-semibold tracking-wide text-fraca uppercase">{titulo}</h3>
          {direita}
        </div>
      ) : null}
      {children}
    </div>
  )
}

/** Botões Aplicar / Cancelar das ferramentas com rascunho. */
export function Acoes({ aplicar, cancelar, rotulo = 'Aplicar', desativado, rotuloCancelar = 'Cancelar' }) {
  return (
    <div className="flex gap-2">
      <Botao variante="secundario" onClick={cancelar}>
        {rotuloCancelar}
      </Botao>
      <Botao className="flex-1" icone="check" onClick={aplicar} disabled={desativado} data-aplicar="">
        {rotulo}
      </Botao>
    </div>
  )
}

/** Botões de escolha em grade (um ativo). */
export function Escolhas({ valor, aoMudar, opcoes, colunas = 2, rotulo, atributo }) {
  return (
    <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${colunas}, minmax(0, 1fr))` }} role="radiogroup" aria-label={rotulo}>
      {opcoes.map(([v, rot, icone]) => (
        <button
          key={String(v)}
          type="button"
          role="radio"
          aria-checked={valor === v}
          {...(atributo ? { [atributo]: v ?? 'nenhum' } : {})}
          onClick={() => aoMudar(v)}
          className={`flex h-9 min-w-0 items-center justify-center gap-1.5 rounded-lg border px-2 text-xs font-semibold transition-colors ${valor === v ? 'border-marca bg-marca text-sobre-marca' : 'border-borda text-suave hover:text-tinta'}`}
        >
          {icone ? <Icone nome={icone} tamanho={14} className="shrink-0" /> : null}
          <span className="truncate">{rot}</span>
        </button>
      ))}
    </div>
  )
}

function Alternar({ ativo, aoMudar, rotulo, children }) {
  return (
    <button type="button" aria-pressed={ativo} aria-label={rotulo} title={rotulo} onClick={() => aoMudar(!ativo)} className={`grid h-9 min-w-9 place-items-center rounded-lg border px-2 text-sm transition-colors ${ativo ? 'border-marca bg-marca text-sobre-marca' : 'border-borda text-suave hover:text-tinta'}`}>
      {children}
    </button>
  )
}

/** Mostra um OffscreenCanvas num canvas da página. */
export function Miniatura({ fonte, className }) {
  const c = useRef(null)
  useEffect(() => {
    const el = c.current
    if (!el || !fonte) return
    el.width = fonte.width
    el.height = fonte.height
    el.getContext('2d').drawImage(fonte, 0, 0)
  }, [fonte])
  return <canvas ref={c} className={className} />
}

/* ─── Filtros (com a prévia de cada um na própria foto) ────────────────── */

export function PainelFiltros({ reduzida, versao, filtro, aoEscolher }) {
  const miniaturas = useMemo(() => {
    if (!reduzida) return {}
    const k = Math.min(1, 180 / Math.max(reduzida.width, reduzida.height))
    const mini = new OffscreenCanvas(Math.max(1, Math.round(reduzida.width * k)), Math.max(1, Math.round(reduzida.height * k)))
    const ctx = mini.getContext('2d')
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(reduzida, 0, 0, mini.width, mini.height)
    return Object.fromEntries(FILTROS.map((f) => [f.id, renderizarAjustes(mini, f.ajustes)]))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduzida, versao])
  const ativo = filtro?.id ?? null
  const intensidade = filtro?.k ?? 1
  return (
    <div className="flex flex-col gap-4">
      <Grupo titulo="Filtros">
        <div className="grid grid-cols-2 gap-2">
          {FILTROS.map((f) => {
            const sel = ativo === f.id || (!ativo && f.id === 'original')
            return (
              <button key={f.id} type="button" aria-pressed={sel} data-filtro={f.id} onClick={() => aoEscolher(f.id, f.id === 'original' ? 1 : intensidade)} className={`group flex flex-col gap-1.5 rounded-lg border p-1.5 text-left transition-colors ${sel ? 'border-acento bg-acento/10' : 'border-borda hover:border-borda-forte'}`}>
                <span className="xadrez block aspect-[4/3] w-full overflow-hidden rounded-md">
                  <Miniatura fonte={miniaturas[f.id]} className="size-full object-cover" />
                </span>
                <span className={`px-0.5 text-xs font-semibold ${sel ? 'text-tinta' : 'text-suave group-hover:text-tinta'}`}>{f.nome}</span>
              </button>
            )
          })}
        </div>
      </Grupo>
      {ativo && ativo !== 'original' ? <Deslizante rotulo="Intensidade" valor={Math.round(intensidade * 100)} aoMudar={(v) => aoEscolher(ativo, v / 100)} min={0} max={100} formatar={(v) => `${v}%`} /> : null}
    </div>
  )
}
export const ajustesDoFiltro = (id, k) => misturarFiltro((FILTROS.find((f) => f.id === id) ?? FILTROS[0]).ajustes, k)

/* ─── Ajustes ──────────────────────────────────────────────────────────── */

export function PainelAjustes({ a, mudar }) {
  const m = (k) => (v) => mudar({ ...a, [k]: v })
  const sinal = (v) => `${v > 0 ? '+' : ''}${v}`
  const cem = (v) => sinal(v - 100)
  return (
    <div className="flex flex-col gap-5">
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

/* ─── Remover fundo ────────────────────────────────────────────────────── */

/** Detecção automática do assunto (segmentação): mostra download, tempo e progresso. */
export function BotaoSegmentar({ tarefa, aoClicar, desativado, feito }) {
  const [noCache, setNoCache] = useState(true)
  useEffect(() => {
    modeloNoCache('fundo').then(setNoCache)
  }, [tarefa.fase])
  if (tarefa.fase === 'processando') return <Progresso valor={tarefa.progresso} rotulo={tarefa.rotulo} aoCancelar={tarefa.cancelar} />
  const segundos = tempoEstimado('fundo')
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-acento/40 bg-acento/8 p-3">
      <Botao tamanho="g" icone="magica" onClick={aoClicar} disabled={desativado || feito} data-ia="fundo">
        {feito ? 'Assunto já selecionado' : 'Selecionar assunto'}
      </Botao>
      <p className="text-xs text-fraca">
        {feito
          ? 'Refine com as ferramentas de máscara abaixo. Para detectar de novo, descarte a máscara.'
          : `Segmentação automática (BiRefNet): separa o objeto principal do plano de fundo. ${segundos <= 3 ? 'Leva poucos segundos.' : `Leva uns ${segundos} s neste aparelho.`} ${
              noCache ? 'Processado no seu aparelho.' : `Na primeira vez, baixa o modelo (${formatarBytes(MODELOS.fundo.tamanho)}), que fica guardado no navegador.`
            }`}
      </p>
      {tarefa.fase === 'erro' ? <Aviso tom="erro">{tarefa.mensagem}</Aviso> : null}
    </div>
  )
}

export function PainelFundo({ r, mudar, aplicar, descartar, desfazerTraco, tamanhoPadrao, tamanhoMax, carregandoImagem, desativado, segmentar }) {
  const sinal = (v) => `${v > 0 ? '+' : ''}${v}`
  const tracos = r.tracos?.length ?? 0
  const entradaImagem = useRef(null)
  const DICAS = {
    varinha: r.varinhaAcao === 'recuperar' ? 'Clique numa área: adiciona à máscara tudo da mesma cor.' : 'Clique no fundo: subtrai da máscara tudo da mesma cor.',
    apagar: 'Pinte o que deve sair (oculta).',
    recuperar: 'Pinte o que deve voltar (revela).',
  }
  const alterado = r.automatico || tracos > 0
  return (
    <>
      {segmentar}
      <Grupo titulo="Ferramentas de máscara">
        <Escolhas
          rotulo="Ferramenta de máscara"
          atributo="data-retoque"
          valor={r.pincel}
          aoMudar={(v) => mudar({ pincel: v })}
          opcoes={[
            ['varinha', 'Varinha mágica', 'magica'],
            ['apagar', 'Ocultar (pincel)', 'borracha'],
            ['recuperar', 'Revelar (pincel)', 'caneta'],
            [null, 'Nenhuma', 'fechar'],
          ]}
        />
        {r.pincel === 'varinha' ? (
          <>
            <Escolhas
              rotulo="Modo da varinha"
              atributo="data-varinha"
              valor={r.varinhaAcao}
              aoMudar={(v) => mudar({ varinhaAcao: v })}
              opcoes={[
                ['apagar', 'Subtrair'],
                ['recuperar', 'Adicionar'],
              ]}
            />
            <Deslizante rotulo="Tolerância" valor={r.tolerancia} aoMudar={(v) => mudar({ tolerancia: v })} min={1} max={100} dica="Quanto a cor pode variar da que você clicou." />
            <Caixa rotulo="Contíguo (só a área ligada ao clique)" marcado={r.contiguo} aoMudar={(v) => mudar({ contiguo: v })} />
          </>
        ) : r.pincel ? (
          <Deslizante rotulo="Tamanho do pincel" valor={r.tamanhoPincel ?? tamanhoPadrao} aoMudar={(v) => mudar({ tamanhoPincel: v })} min={2} max={tamanhoMax} formatar={(v) => `${v} px`} />
        ) : null}
        <p className="text-xs text-fraca">
          {r.pincel ? `${DICAS[r.pincel]} O que está fora da máscara aparece apagadinho.` : 'Escolha a varinha ou um pincel de máscara para tirar o fundo à mão, ou use a seleção de assunto acima.'}
        </p>
        {tracos ? (
          <div className="flex flex-wrap gap-1.5">
            <Botao variante="secundario" tamanho="p" icone="desfazer" onClick={desfazerTraco} data-desfazer-traco="">
              Desfazer (Ctrl+Z)
            </Botao>
            <Botao variante="fantasma" tamanho="p" onClick={() => mudar({ tracos: [] })}>
              Limpar retoques ({tracos})
            </Botao>
          </div>
        ) : null}
      </Grupo>
      <Grupo titulo="Refinar borda">
        {r.automatico ? <Deslizante rotulo="Contrair / expandir" valor={r.contorno} aoMudar={(v) => mudar({ contorno: v })} min={-10} max={10} formatar={sinal} /> : null}
        <Deslizante rotulo="Difusão (feather)" valor={r.borda} aoMudar={(v) => mudar({ borda: v })} min={0} max={10} />
        {r.automatico ? <Deslizante rotulo="Limiar de opacidade" valor={r.limpar} aoMudar={(v) => mudar({ limpar: v })} formatar={(v) => `${v}%`} dica="Remove o halo semitransparente que sobra em volta do assunto." /> : null}
      </Grupo>
      <Grupo titulo="Plano de fundo">
        <Escolhas
          rotulo="Plano de fundo"
          atributo="data-novo-fundo"
          valor={r.fundo}
          aoMudar={(v) => {
            mudar({ fundo: v })
            if (v === 'imagem' && !r.imagem) entradaImagem.current?.click()
          }}
          opcoes={[
            ['transparente', 'Transparente (alfa)'],
            ['cor', 'Cor sólida'],
            ['desfocado', 'Desfoque (bokeh)'],
            ['imagem', 'Imagem'],
          ]}
        />
        <input
          ref={entradaImagem}
          type="file"
          accept="image/*"
          className="sr-only"
          tabIndex={-1}
          aria-label="Imagem para o plano de fundo"
          data-imagem-fundo=""
          onChange={(e) => {
            const a = e.target.files?.[0]
            e.target.value = ''
            if (a) mudar({ imagem: a, fundo: 'imagem' })
          }}
        />
        {r.fundo === 'cor' ? (
          <SeletorCor valor={r.cor} aoMudar={(v) => mudar({ cor: v })} rotulo="Cor do plano de fundo" />
        ) : r.fundo === 'desfocado' ? (
          <Deslizante rotulo="Raio do desfoque" valor={r.desfoque} aoMudar={(v) => mudar({ desfoque: v })} min={2} max={60} />
        ) : r.fundo === 'imagem' ? (
          <>
            <Botao variante="secundario" tamanho="p" icone="imagemMais" onClick={() => entradaImagem.current?.click()}>
              {r.imagem ? 'Trocar a imagem' : 'Escolher a imagem'}
            </Botao>
            {carregandoImagem ? <p className="text-xs text-fraca">Carregando a imagem…</p> : null}
            {r.imagem ? <Deslizante rotulo="Desfoque da imagem" valor={r.desfoqueImagem} aoMudar={(v) => mudar({ desfoqueImagem: v })} min={0} max={60} /> : <p className="text-xs text-fraca">Ela cobre o quadro todo, sem esticar.</p>}
          </>
        ) : (
          <p className="text-xs text-fraca">Para manter a transparência, baixe em PNG ou WebP.</p>
        )}
      </Grupo>
      <Acoes rotulo="Aplicar máscara" aplicar={aplicar} cancelar={descartar} rotuloCancelar="Descartar" desativado={desativado || !alterado} />
    </>
  )
}

/* ─── Pincel ───────────────────────────────────────────────────────────── */

export function PainelPincel({ pincel, mudar, camada, aoNovaCamada }) {
  const usa = OPCOES_DO_PINCEL[pincel.tipo] ?? []
  const info = PINCEIS.find((x) => x.id === pincel.tipo)
  return (
    <div className="flex flex-col gap-5">
      <Grupo titulo="Ferramenta">
        <div className="grid grid-cols-2 gap-1.5" role="radiogroup" aria-label="Pincel">
          {PINCEIS.map((x) => (
            <button
              key={x.id}
              type="button"
              role="radio"
              aria-checked={pincel.tipo === x.id}
              data-pincel={x.id}
              onClick={() => mudar({ tipo: x.id })}
              className={`flex h-9 items-center gap-1.5 rounded-lg border px-2 text-xs font-semibold transition-colors ${pincel.tipo === x.id ? 'border-marca bg-marca text-sobre-marca' : 'border-borda text-suave hover:text-tinta'}`}
            >
              <Icone nome={x.icone} tamanho={14} className="shrink-0" />
              <span className="truncate">{x.rotulo}</span>
            </button>
          ))}
        </div>
        {info ? <p className="text-xs text-fraca">{info.dica}</p> : null}
      </Grupo>
      <Grupo titulo="Opções">
        {usa.includes('cor') ? <SeletorCor valor={pincel.cor} aoMudar={(v) => mudar({ cor: v })} rotulo="Cor" /> : null}
        {usa.includes('tamanho') ? <Deslizante rotulo={pincel.tipo === 'retangulo' || pincel.tipo === 'elipse' ? 'Espessura' : 'Tamanho'} valor={pincel.tamanho} aoMudar={(v) => mudar({ tamanho: v })} min={1} max={400} formatar={(v) => `${v} px`} /> : null}
        {usa.includes('opacidade') ? <Deslizante rotulo="Opacidade" valor={pincel.opacidade} aoMudar={(v) => mudar({ opacidade: v })} min={1} max={100} formatar={(v) => `${v}%`} /> : null}
        {usa.includes('dureza') ? <Deslizante rotulo="Dureza" valor={pincel.dureza} aoMudar={(v) => mudar({ dureza: v })} min={0} max={100} formatar={(v) => `${v}%`} dica="100% = borda dura; menos = borda macia." /> : null}
        {usa.includes('fluxo') ? <Deslizante rotulo="Fluxo" valor={pincel.fluxo} aoMudar={(v) => mudar({ fluxo: v })} min={5} max={100} formatar={(v) => `${v}%`} /> : null}
        {usa.includes('preencher') ? <Caixa rotulo="Preenchido" marcado={pincel.preencher} aoMudar={(v) => mudar({ preencher: v })} /> : null}
      </Grupo>
      <Grupo titulo="Camada">
        <p className="text-xs text-fraca">
          {camada ? (
            <>
              Desenhando em <strong className="text-tinta">{camada.nome}</strong>. A borracha apaga só o desenho; a foto fica intacta.
            </>
          ) : (
            'O primeiro traço cria uma camada de desenho, separada da foto.'
          )}
        </p>
        <Botao variante="secundario" tamanho="p" icone="camadas" className="self-start" onClick={aoNovaCamada}>
          Nova camada de desenho
        </Botao>
      </Grupo>
    </div>
  )
}

/* ─── Camadas ──────────────────────────────────────────────────────────── */

const ICONE_CAMADA = { texto: 'tipo', imagem: 'imagem', desenho: 'caneta' }

export function ListaCamadas({ camadas, selecionada, aoSelecionar, aoMudar, aoAdicionarImagem, aoAdicionarTexto, aoAdicionarDesenho }) {
  return (
    <Grupo titulo="Camadas">
      <div className="grid grid-cols-3 gap-1.5">
        <Botao variante="secundario" tamanho="p" icone="imagemMais" onClick={aoAdicionarImagem} data-add-imagem="">
          Imagem
        </Botao>
        <Botao variante="secundario" tamanho="p" icone="tipo" onClick={aoAdicionarTexto}>
          Texto
        </Botao>
        <Botao variante="secundario" tamanho="p" icone="caneta" onClick={aoAdicionarDesenho}>
          Desenho
        </Botao>
      </div>
      <ul className="flex flex-col gap-1" aria-label="Lista de camadas (a de cima fica na frente)">
        {[...camadas].reverse().map((c) => (
          <li key={c.id}>
            <div className={`flex items-center gap-1 rounded-lg border px-1.5 py-1 ${selecionada === c.id ? 'border-acento bg-acento/10' : 'border-borda'}`}>
              <button
                type="button"
                aria-label={c.visivel === false ? 'Mostrar camada' : 'Ocultar camada'}
                title={c.visivel === false ? 'Mostrar' : 'Ocultar'}
                onClick={() => aoMudar(c.id, { visivel: c.visivel === false })}
                className={`grid size-7 shrink-0 place-items-center rounded-md hover:bg-superficie-2 ${c.visivel === false ? 'text-fraca' : 'text-suave'}`}
              >
                <Icone nome={c.visivel === false ? 'fechar' : 'ver'} tamanho={14} />
              </button>
              <button type="button" onClick={() => aoSelecionar(c.id)} className="flex min-w-0 flex-1 items-center gap-2 py-1 text-left text-sm" data-camada-item={c.tipo}>
                <Icone nome={ICONE_CAMADA[c.tipo]} tamanho={14} className="shrink-0 text-fraca" />
                <span className={`truncate ${c.visivel === false ? 'text-fraca line-through' : 'text-tinta'}`}>{c.tipo === 'texto' ? c.texto?.split('\n')[0] || 'Texto' : c.nome}</span>
              </button>
            </div>
          </li>
        ))}
        <li>
          <div className="flex items-center gap-2 rounded-lg border border-dashed border-borda px-3 py-2 text-sm text-fraca">
            <Icone nome="bloquear" tamanho={14} />
            Imagem de fundo (base)
          </div>
        </li>
      </ul>
    </Grupo>
  )
}

export function PainelCamada({ camada: bruta, mudar, acoes, focarTexto }) {
  const texto = useRef(null)
  useEffect(() => {
    if (focarTexto && texto.current) {
      const t = texto.current.querySelector('textarea')
      t?.focus()
      t?.select()
    }
  }, [focarTexto, bruta?.id])
  if (!bruta) return null
  const c = { ...PADRAO_CAMADA_IMAGEM, ...(bruta.tipo === 'texto' ? PADRAO_TEXTO : {}), ...bruta }
  const m = (d) => mudar(c.id, d)
  const r = c.recorte ?? { x: 0, y: 0, w: 1, h: 1 }
  const contorno = c.contorno ?? !c.fundo
  const aj = { brilho: 0, contraste: 1, saturacao: 1, ...c.ajuste }
  return (
    <div className="flex flex-col gap-5" data-painel-camada={c.tipo}>
      {c.tipo === 'texto' ? (
        <>
          <div ref={texto}>
            <AreaTexto rotulo="Texto" valor={c.texto} aoMudar={(v) => m({ texto: v })} rows={3} className="[&_textarea]:min-h-20 [&_textarea]:font-sans [&_textarea]:text-sm" />
          </div>
          <Grupo titulo="Tipografia">
            <label className="relative flex flex-col gap-1.5 text-[0.8125rem] font-semibold text-tinta">
              Fonte
              <select
                value={c.fonte}
                onChange={(e) => m({ fonte: e.target.value })}
                className="h-10 appearance-none rounded-lg border border-borda-forte bg-superficie pr-8 pl-3 text-sm font-medium text-tinta focus:border-acento focus:outline-none"
                style={{ fontFamily: (FONTES.find((x) => x.id === c.fonte) ?? FONTES[0]).css }}
              >
                {FONTES.map((x) => (
                  <option key={x.id} value={x.id} style={{ fontFamily: x.css }}>
                    {x.rotulo}
                  </option>
                ))}
              </select>
              <Icone nome="setaBaixo" tamanho={14} className="pointer-events-none absolute right-2.5 bottom-3 text-fraca" />
            </label>
            <Deslizante rotulo="Tamanho" valor={Math.round(c.tamanho * 1000) / 10} aoMudar={(v) => m({ tamanho: v / 100 })} min={1} max={40} passo={0.5} formatar={(v) => `${v}%`} />
            <SeletorCor valor={c.cor} aoMudar={(v) => m({ cor: v })} rotulo="Cor do texto" />
            <div className="flex flex-wrap items-center gap-1.5">
              <Alternar rotulo="Negrito" ativo={c.negrito} aoMudar={(v) => m({ negrito: v })}>
                <b>B</b>
              </Alternar>
              <Alternar rotulo="Itálico" ativo={c.italico} aoMudar={(v) => m({ italico: v })}>
                <i className="font-serif">I</i>
              </Alternar>
              <Alternar rotulo="Caixa alta (maiúsculas)" ativo={c.maiusculas} aoMudar={(v) => m({ maiusculas: v })}>
                <span className="text-xs font-bold">AA</span>
              </Alternar>
              <span className="mx-1 h-6 w-px bg-borda" />
              {[
                ['esquerda', 'Alinhar à esquerda', '⇤'],
                ['centro', 'Centralizar', '↔'],
                ['direita', 'Alinhar à direita', '⇥'],
              ].map(([v, rotulo, s]) => (
                <Alternar key={v} rotulo={rotulo} ativo={c.alinhar === v} aoMudar={() => m({ alinhar: v })}>
                  {s}
                </Alternar>
              ))}
            </div>
            <Deslizante rotulo="Espaçamento (tracking)" valor={Math.round(c.espacamento * 100)} aoMudar={(v) => m({ espacamento: v / 100 })} min={-5} max={50} formatar={(v) => `${(v / 100).toLocaleString('pt-BR')} em`} />
            <Deslizante rotulo="Largura da caixa" valor={Math.round(c.w * 100)} aoMudar={(v) => m({ w: v / 100 })} min={5} max={100} formatar={(v) => `${v}%`} />
          </Grupo>
          <Grupo titulo="Contorno e sombra">
            <Caixa rotulo="Contorno (stroke)" marcado={contorno} aoMudar={(v) => m({ contorno: v })} />
            {contorno ? (
              <>
                <SeletorCor valor={c.corContorno} aoMudar={(v) => m({ corContorno: v })} rotulo="Cor do contorno" />
                <Deslizante rotulo="Espessura do contorno" valor={Math.round(c.espessuraContorno * 100)} aoMudar={(v) => m({ espessuraContorno: v / 100 })} min={2} max={30} formatar={(v) => `${v}%`} />
              </>
            ) : null}
            <Caixa rotulo="Sombra projetada" marcado={c.sombra} aoMudar={(v) => m({ sombra: v })} />
          </Grupo>
          <Grupo titulo="Caixa de fundo">
            <Caixa rotulo="Fundo atrás do texto" marcado={c.fundo} aoMudar={(v) => m({ fundo: v })} />
            {c.fundo ? (
              <>
                <SeletorCor valor={c.corFundo} aoMudar={(v) => m({ corFundo: v })} rotulo="Cor da caixa" />
                <Deslizante rotulo="Opacidade da caixa" valor={Math.round(c.opacidadeFundo * 100)} aoMudar={(v) => m({ opacidadeFundo: v / 100 })} min={10} max={100} formatar={(v) => `${v}%`} />
              </>
            ) : null}
          </Grupo>
        </>
      ) : null}

      {c.tipo === 'imagem' ? (
        <>
          <Grupo titulo="Tamanho">
            <div className="grid grid-cols-3 gap-1.5">
              <Botao variante="secundario" tamanho="p" onClick={acoes.ajustarTela}>
                Caber
              </Botao>
              <Botao variante="secundario" tamanho="p" onClick={acoes.cobrirTela}>
                Cobrir
              </Botao>
              <Botao variante="secundario" tamanho="p" onClick={acoes.tamanhoOriginal}>
                Original
              </Botao>
            </div>
          </Grupo>
          <Grupo titulo="Recorte (crop)">
            <div className="grid grid-cols-2 gap-2">
              {[
                ['x', 'Esquerda'],
                ['y', 'Topo'],
                ['w', 'Largura'],
                ['h', 'Altura'],
              ].map(([k, rotulo]) => (
                <label key={k} className="flex flex-col gap-1 text-[0.6875rem] font-semibold tracking-wide text-fraca uppercase">
                  {rotulo} (%)
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={Math.round(r[k] * 100)}
                    onChange={(e) => {
                      const n = { ...r, [k]: Math.min(Math.max(Number(e.target.value) / 100, 0), 1) }
                      n.w = Math.min(Math.max(0.05, n.w), 1 - n.x)
                      n.h = Math.min(Math.max(0.05, n.h), 1 - n.y)
                      m({ recorte: n.x === 0 && n.y === 0 && n.w === 1 && n.h === 1 ? null : n, h: c.h * (n.h / r.h) * (r.w / n.w) })
                    }}
                    className="h-9 rounded-lg border border-borda-forte bg-superficie px-2.5 text-sm font-semibold text-tinta normal-case tabular-nums focus:border-acento focus:outline-none"
                  />
                </label>
              ))}
            </div>
          </Grupo>
          <Grupo titulo="Correção de cor">
            <Deslizante rotulo="Brilho" valor={Math.round(aj.brilho * 100)} aoMudar={(v) => m({ ajuste: { ...aj, brilho: v / 100 } })} min={-50} max={50} formatar={(v) => `${v > 0 ? '+' : ''}${v}`} />
            <Deslizante rotulo="Contraste" valor={Math.round(aj.contraste * 100)} aoMudar={(v) => m({ ajuste: { ...aj, contraste: v / 100 } })} min={50} max={150} formatar={(v) => `${v}%`} />
            <Deslizante rotulo="Saturação" valor={Math.round(aj.saturacao * 100)} aoMudar={(v) => m({ ajuste: { ...aj, saturacao: v / 100 } })} min={0} max={200} formatar={(v) => (v ? `${v}%` : 'P&B')} />
          </Grupo>
          <Grupo titulo="Chroma key">
            <Escolhas
              rotulo="Chroma key"
              valor={c.semFundo ?? null}
              aoMudar={(v) => m({ semFundo: v })}
              colunas={3}
              opcoes={[
                [null, 'Desligado'],
                ['branco', 'Branco'],
                ['preto', 'Preto'],
              ]}
            />
            {c.semFundo ? <Deslizante rotulo="Similaridade (tolerância)" valor={Math.round(c.tolerancia * 100)} aoMudar={(v) => m({ tolerancia: v / 100 })} min={2} max={50} formatar={(v) => `${v}%`} /> : null}
          </Grupo>
          <Deslizante rotulo="Cantos arredondados" valor={Math.round((c.raio ?? 0) * 100)} aoMudar={(v) => m({ raio: v / 100 })} min={0} max={100} formatar={(v) => `${v}%`} />
        </>
      ) : null}

      {c.tipo !== 'desenho' ? (
        <Grupo titulo="Posição e rotação">
          <div className="grid grid-cols-2 gap-2">
            <Botao variante="secundario" tamanho="p" onClick={() => m({ x: 0.5 - c.w / 2 })}>
              Centro ↔
            </Botao>
            <Botao variante="secundario" tamanho="p" onClick={acoes.centroVertical}>
              Centro ↕
            </Botao>
          </div>
          <Deslizante rotulo="Rotação" valor={c.girar} aoMudar={(v) => m({ girar: v })} min={-180} max={180} formatar={(v) => `${v}°`} />
          <div className="flex gap-2">
            <Botao variante="secundario" tamanho="p" className="flex-1" onClick={() => m({ girar: ((c.girar - 90 + 540) % 360) - 180 })}>
              ↺ 90°
            </Botao>
            <Botao variante="secundario" tamanho="p" className="flex-1" onClick={() => m({ girar: ((c.girar + 90 + 540) % 360) - 180 })}>
              ↻ 90°
            </Botao>
            <Botao variante={c.espelharH ? 'primario' : 'secundario'} tamanho="p" icone="espelhar" aria-pressed={c.espelharH} aria-label="Espelhar na horizontal" title="Espelhar na horizontal" onClick={() => m({ espelharH: !c.espelharH })} />
            <Botao variante={c.espelharV ? 'primario' : 'secundario'} tamanho="p" aria-pressed={c.espelharV} aria-label="Espelhar na vertical" title="Espelhar na vertical" onClick={() => m({ espelharV: !c.espelharV })}>
              ⇵
            </Botao>
          </div>
        </Grupo>
      ) : null}

      <Grupo titulo="Mesclagem">
        <Deslizante rotulo="Opacidade" valor={Math.round((c.opacidade ?? 1) * 100)} aoMudar={(v) => m({ opacidade: v / 100 })} min={0} max={100} formatar={(v) => `${v}%`} />
        <Seletor rotulo="Modo de mesclagem" valor={c.mistura ?? 'normal'} aoMudar={(v) => m({ mistura: v })} opcoes={MISTURAS} />
      </Grupo>

      <div className="grid grid-cols-2 gap-2">
        <Botao variante="secundario" tamanho="p" onClick={() => acoes.ordem(c.id, 1)}>
          Trazer p/ frente
        </Botao>
        <Botao variante="secundario" tamanho="p" onClick={() => acoes.ordem(c.id, -1)}>
          Enviar p/ trás
        </Botao>
        <Botao variante="secundario" tamanho="p" onClick={() => acoes.duplicar(c.id)}>
          Duplicar
        </Botao>
        {c.tipo === 'desenho' ? (
          <Botao variante="secundario" tamanho="p" onClick={() => acoes.limparDesenho(c.id)}>
            Limpar desenho
          </Botao>
        ) : (
          <span />
        )}
      </div>
      <Botao variante="perigo" tamanho="p" icone="apagar" onClick={() => acoes.excluir(c.id)}>
        Excluir camada
      </Botao>
    </div>
  )
}
