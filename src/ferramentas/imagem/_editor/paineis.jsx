import { useEffect, useMemo, useRef, useState } from 'react'
import { SeletorCor } from '../../../componentes/SeletorCor'
import { Icone } from '../../../componentes/Icone'
import { AreaTexto, Aviso, Botao, Caixa, Deslizante, Progresso, Seletor } from '../../../componentes/ui'
import { FILTROS, NEUTRO, ehNeutro, misturarFiltro, renderizarAjustes } from '../../../motores/imagem/ajustes'
import { MODELOS, modeloNoCache, tempoEstimado } from '../../../motores/imagem/ia'
import { formatarBytes } from '../../../nucleo/arquivos'
import { FONTES, MISTURAS, PADRAO_CAMADA_IMAGEM } from './documento'
import { FORMAS, OPCOES_DO_PINCEL, PINCEIS, grupoDo, infoDo } from './pinceis'
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

/** Botões de escolha em grade (um ativo). */
/** `empilhado`: ícone em cima do rótulo (para rótulos que não cabem ao lado do ícone). */
export function Escolhas({ valor, aoMudar, opcoes, colunas = 2, rotulo, atributo, empilhado = false }) {
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
          className={`flex min-w-0 items-center justify-center rounded-lg border px-2 text-xs font-semibold transition-colors ${empilhado ? 'flex-col gap-1 py-2' : 'h-9 gap-1.5'} ${valor === v ? 'border-marca bg-marca text-sobre-marca' : 'border-borda text-suave hover:text-tinta'}`}
        >
          {icone ? <Icone nome={icone} tamanho={empilhado ? 16 : 14} className="shrink-0" /> : null}
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

/**
 * `personalizado`: os ajustes feitos à mão (aba Ajustes), guardados à parte —
 * trocar de filtro não os perde; clicar em "Personalizado" volta neles.
 */
export function PainelFiltros({ reduzida, versao, filtro, personalizado, aoEscolher, aoPersonalizar }) {
  const mini = useMemo(() => {
    if (!reduzida) return null
    const k = Math.min(1, 180 / Math.max(reduzida.width, reduzida.height))
    const c = new OffscreenCanvas(Math.max(1, Math.round(reduzida.width * k)), Math.max(1, Math.round(reduzida.height * k)))
    const ctx = c.getContext('2d')
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(reduzida, 0, 0, c.width, c.height)
    return c
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduzida, versao])
  const miniaturas = useMemo(() => (mini ? Object.fromEntries(FILTROS.map((f) => [f.id, renderizarAjustes(mini, f.ajustes)])) : {}), [mini])
  const miniPersonalizado = useMemo(() => (mini ? renderizarAjustes(mini, personalizado ?? NEUTRO) : null), [mini, personalizado])
  const ativo = filtro?.id ?? null
  const intensidade = ativo === 'personalizado' ? 1 : (filtro?.k ?? 1)
  const selP = ativo === 'personalizado'
  return (
    <div className="flex flex-col gap-4">
      <Grupo titulo="Filtros">
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            aria-pressed={selP}
            data-filtro="personalizado"
            onClick={aoPersonalizar}
            title={personalizado ? 'Volta aos seus ajustes e abre a aba Ajustes' : 'Abre a aba Ajustes para você montar o seu'}
            className={`group flex flex-col gap-1.5 rounded-lg border p-1.5 text-left transition-colors ${selP ? 'border-acento bg-acento/10' : 'border-dashed border-borda-forte hover:border-fraca'}`}
          >
            <span className="xadrez relative block aspect-[4/3] w-full overflow-hidden rounded-md">
              <Miniatura fonte={miniPersonalizado} className="size-full object-cover" />
              <span className="absolute inset-0 grid place-items-center bg-black/25 text-white">
                <Icone nome="ajustar" tamanho={20} />
              </span>
            </span>
            <span className={`px-0.5 text-xs font-semibold ${selP ? 'text-tinta' : 'text-suave group-hover:text-tinta'}`}>Personalizado</span>
          </button>
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
      {ativo && ativo !== 'original' && !selP ? <Deslizante rotulo="Intensidade" valor={Math.round(intensidade * 100)} aoMudar={(v) => aoEscolher(ativo, v / 100)} min={0} max={100} formatar={(v) => `${v}%`} /> : null}
      <p className="text-xs text-fraca">
        {personalizado ? 'Seus ajustes ficam guardados no Personalizado: pode testar os filtros e voltar neles quando quiser.' : 'Personalizado abre a aba Ajustes para você montar o seu; ele fica guardado ao testar os outros filtros.'}
      </p>
    </div>
  )
}
export const ajustesDoFiltro = (id, k) => misturarFiltro((FILTROS.find((f) => f.id === id) ?? FILTROS[0]).ajustes, k)

/* ─── Ajustes ──────────────────────────────────────────────────────────── */

export function PainelAjustes({ a, mudar, filtro }) {
  const m = (k) => (v) => mudar({ ...a, [k]: v })
  const sinal = (v) => `${v > 0 ? '+' : ''}${v}`
  const cem = (v) => sinal(v - 100)
  const base = filtro && filtro.id !== 'personalizado' ? FILTROS.find((f) => f.id === filtro.id) : null
  return (
    <div className="flex flex-col gap-5">
      {base ? (
        <p className="rounded-lg border border-borda bg-superficie-2 p-2.5 text-xs text-suave">
          Partindo do filtro <strong className="text-tinta">{base.nome}</strong>. O que você mudar aqui vira o seu filtro <strong className="text-tinta">Personalizado</strong>.
        </p>
      ) : null}
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

/** Remover fundo automático (IA): mostra download, tempo e progresso. */
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
        {feito ? 'Fundo removido' : 'Remover fundo'}
      </Botao>
      <p className="text-xs text-fraca">
        {feito
          ? 'Ajuste com as ferramentas de máscara abaixo. Para desfazer, Ctrl+Z.'
          : `Reconhece sozinho a pessoa ou o objeto principal da foto e tira o resto. ${segundos <= 3 ? 'Leva poucos segundos.' : `Leva uns ${segundos} s neste aparelho.`} ${
              noCache ? 'Processado no seu aparelho.' : `Na primeira vez, baixa o modelo (${formatarBytes(MODELOS.fundo.tamanho)}), que fica guardado no navegador.`
            }`}
      </p>
      {tarefa.fase === 'erro' ? <Aviso tom="erro">{tarefa.mensagem}</Aviso> : null}
    </div>
  )
}

/** Chroma key (como no CapCut): a cor a tirar (com conta-gotas na imagem), intensidade e suavidade. */
function ControlesChave({ cor, aoCor, tolerancia, aoTolerancia, suavidade, aoSuavidade, aoContaGotas, contaGotasAtivo }) {
  return (
    <>
      <SeletorCor valor={cor} aoMudar={aoCor} rotulo="Cor a remover" />
      <Botao variante={contaGotasAtivo ? 'primario' : 'secundario'} tamanho="p" icone="contaGotas" className="self-start" onClick={aoContaGotas} aria-pressed={contaGotasAtivo} title="Depois clique na imagem, na cor que quer tirar" data-conta-gotas-botao="">
        {contaGotasAtivo ? 'Clique na imagem…' : 'Pegar a cor na imagem'}
      </Botao>
      <Deslizante rotulo="Intensidade" valor={Math.round(tolerancia * 200)} aoMudar={(v) => aoTolerancia(v / 200)} min={1} max={100} formatar={(v) => `${v}%`} dica="Quanto a cor pode variar e ainda sair. Aumente se sobrar fundo; diminua se sumir parte do que fica." />
      <Deslizante rotulo="Suavidade da borda" valor={Math.round(suavidade * 400)} aoMudar={(v) => aoSuavidade(v / 400)} min={0} max={100} formatar={(v) => `${v}%`} />
    </>
  )
}

/**
 * Remover fundo: tudo vale na hora (aparece em todas as ferramentas e no
 * arquivo baixado) e cada mudança entra no Ctrl+Z — não há "Aplicar".
 */
export function PainelFundo({ r, mudar, restaurar, desfazerTraco, tamanhoPadrao, tamanhoMax, carregandoImagem, segmentar, aoContaGotas, contaGotasAtivo }) {
  const sinal = (v) => `${v > 0 ? '+' : ''}${v}`
  const tracos = r.tracos?.length ?? 0
  const entradaImagem = useRef(null)
  const DICAS = {
    varinha: r.varinhaAcao === 'recuperar' ? 'Clique numa área: adiciona à máscara tudo da mesma cor.' : 'Clique no fundo: subtrai da máscara tudo da mesma cor.',
    apagar: 'Pinte o que deve sair (oculta).',
    recuperar: 'Pinte o que deve voltar (revela).',
  }
  const alterado = r.automatico || tracos > 0 || r.chaveAtiva
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
          {r.pincel ? `${DICAS[r.pincel]} O que está fora da máscara aparece apagadinho.` : 'Escolha a varinha ou um pincel de máscara para tirar o fundo à mão, ou use o botão Remover fundo acima.'}
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
      <Grupo titulo="Remover uma cor (chroma key)">
        <Caixa
          rotulo="Tirar uma cor da imagem inteira"
          marcado={Boolean(r.chaveAtiva)}
          aoMudar={(v) => {
            mudar({ chaveAtiva: v })
            if (v !== Boolean(contaGotasAtivo)) aoContaGotas?.() // ligar já pede a cor na imagem; desligar cancela
          }}
        />
        {r.chaveAtiva ? (
          <ControlesChave
            cor={r.corChave}
            aoCor={(v) => mudar({ corChave: v })}
            tolerancia={r.toleranciaChave}
            aoTolerancia={(v) => mudar({ toleranciaChave: v })}
            suavidade={r.suavidadeChave}
            aoSuavidade={(v) => mudar({ suavidadeChave: v })}
            aoContaGotas={aoContaGotas}
            contaGotasAtivo={contaGotasAtivo}
          />
        ) : (
          <p className="text-xs text-fraca">Para fundos de uma cor só (tela verde, fundo branco ou preto): some tudo dessa cor, na intensidade que você escolher.</p>
        )}
      </Grupo>
      <Grupo titulo="Refinar borda">
        {r.automatico ? <Deslizante rotulo="Contrair / expandir" valor={r.contorno} aoMudar={(v) => mudar({ contorno: v })} min={-10} max={10} formatar={sinal} /> : null}
        <Deslizante rotulo="Difusão (feather)" valor={r.borda} aoMudar={(v) => mudar({ borda: v })} min={0} max={10} />
        {r.automatico ? <Deslizante rotulo="Limiar de opacidade" valor={r.limpar} aoMudar={(v) => mudar({ limpar: v })} formatar={(v) => `${v}%`} dica="Remove o halo semitransparente que sobra em volta do que ficou." /> : null}
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
      {alterado ? (
        <Botao variante="secundario" icone="redefinir" onClick={restaurar} data-restaurar-fundo="">
          Voltar à foto original
        </Botao>
      ) : null}
      <p className="text-xs text-fraca">O que você faz aqui já vale para a imagem e para o arquivo baixado. Não gostou? Ctrl+Z.</p>
    </>
  )
}

/* ─── Pincel ───────────────────────────────────────────────────────────── */

function GradeTipos({ itens, tipo, aoEscolher, rotulo, colunas = 2 }) {
  return (
    <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${colunas}, minmax(0, 1fr))` }} role="radiogroup" aria-label={rotulo}>
      {itens.map((x) => (
        <button
          key={x.id}
          type="button"
          role="radio"
          aria-checked={tipo === x.id}
          title={x.rotulo}
          data-pincel={x.id}
          onClick={() => aoEscolher(x.id)}
          className={`flex h-9 min-w-0 items-center gap-1.5 rounded-lg border px-2 text-xs font-semibold transition-colors ${tipo === x.id ? 'border-marca bg-marca text-sobre-marca' : 'border-borda text-suave hover:text-tinta'}`}
        >
          <Icone nome={x.icone} tamanho={14} className="shrink-0" />
          <span className="truncate">{x.rotulo}</span>
        </button>
      ))}
    </div>
  )
}

export function PainelPincel({ pincel, mudar, camada, aoNovaCamada }) {
  const usa = OPCOES_DO_PINCEL[pincel.tipo] ?? []
  const info = infoDo(pincel.tipo)
  const grupo = grupoDo(pincel.tipo)
  const escolher = (id) => mudar({ tipo: id, ...(grupoDo(id) === 'pinceis' ? { ultimoPincel: id } : grupoDo(id) === 'formas' ? { ultimaForma: id } : {}) })
  const forma = grupo === 'formas'
  return (
    <div className="flex flex-col gap-5">
      <Escolhas
        rotulo="Tipo de ferramenta"
        atributo="data-grupo-pincel"
        valor={grupo}
        colunas={3}
        empilhado
        aoMudar={(g) => escolher(g === 'borracha' ? 'borracha' : g === 'formas' ? (pincel.ultimaForma ?? 'retangulo') : (pincel.ultimoPincel ?? 'pincel'))}
        opcoes={[
          ['pinceis', 'Pincéis', 'pincel'],
          ['formas', 'Formas', 'formas'],
          ['borracha', 'Borracha', 'borracha'],
        ]}
      />
      {grupo === 'pinceis' ? (
        <Grupo titulo="Pincéis">
          <GradeTipos itens={PINCEIS} tipo={pincel.tipo} aoEscolher={escolher} rotulo="Pincel" />
        </Grupo>
      ) : grupo === 'formas' ? (
        <Grupo titulo="Formas geométricas">
          <GradeTipos itens={FORMAS} tipo={pincel.tipo} aoEscolher={escolher} rotulo="Forma" />
        </Grupo>
      ) : null}
      {info ? <p className="-mt-2 text-xs text-fraca">{info.dica}</p> : null}
      <Grupo titulo="Opções">
        {usa.includes('estilo') ? (
          <Escolhas
            rotulo="Estilo da forma"
            atributo="data-estilo-forma"
            valor={pincel.estilo}
            aoMudar={(v) => mudar({ estilo: v })}
            colunas={3}
            opcoes={[
              ['contorno', 'Contorno'],
              ['preenchido', 'Preenchida'],
              ['ambos', 'Os dois'],
            ]}
          />
        ) : null}
        {usa.includes('cor') || usa.includes('estilo') ? <SeletorCor valor={pincel.cor} aoMudar={(v) => mudar({ cor: v })} rotulo={forma && pincel.estilo === 'ambos' ? 'Cor do contorno' : 'Cor'} /> : null}
        {usa.includes('estilo') && pincel.estilo === 'ambos' ? <SeletorCor valor={pincel.corPreenchimento} aoMudar={(v) => mudar({ corPreenchimento: v })} rotulo="Cor do preenchimento" /> : null}
        {usa.includes('lados') ? <Deslizante rotulo="Lados" valor={pincel.lados} aoMudar={(v) => mudar({ lados: v })} min={3} max={12} /> : null}
        {usa.includes('pontas') ? <Deslizante rotulo="Pontas" valor={pincel.pontas} aoMudar={(v) => mudar({ pontas: v })} min={3} max={12} /> : null}
        {usa.includes('raio') ? <Deslizante rotulo="Arredondamento" valor={pincel.raio} aoMudar={(v) => mudar({ raio: v })} min={0} max={100} formatar={(v) => `${v}%`} /> : null}
        {usa.includes('tamanho') ? <Deslizante rotulo="Tamanho" valor={pincel.tamanho} aoMudar={(v) => mudar({ tamanho: v })} min={1} max={400} formatar={(v) => `${v} px`} /> : null}
        {usa.includes('espessura') && !(usa.includes('estilo') && pincel.estilo === 'preenchido') ? (
          <Deslizante rotulo="Espessura" valor={pincel.espessura} aoMudar={(v) => mudar({ espessura: v })} min={1} max={120} formatar={(v) => `${v} px`} />
        ) : null}
        {usa.includes('opacidade') ? <Deslizante rotulo="Opacidade" valor={pincel.opacidade} aoMudar={(v) => mudar({ opacidade: v })} min={1} max={100} formatar={(v) => `${v}%`} /> : null}
        {usa.includes('dureza') ? <Deslizante rotulo="Dureza" valor={pincel.dureza} aoMudar={(v) => mudar({ dureza: v })} min={0} max={100} formatar={(v) => `${v}%`} dica="100% = borda dura; menos = borda macia." /> : null}
        {usa.includes('fluxo') ? <Deslizante rotulo="Fluxo" valor={pincel.fluxo} aoMudar={(v) => mudar({ fluxo: v })} min={5} max={100} formatar={(v) => `${v}%`} /> : null}
        {usa.includes('tracejado') && !(usa.includes('estilo') && pincel.estilo === 'preenchido') ? <Caixa rotulo="Linha tracejada" marcado={pincel.tracejado} aoMudar={(v) => mudar({ tracejado: v })} /> : null}
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

/* ─── Camadas (opções; a lista fica em Camadas.jsx) ───────────────────── */

/** Tirar o fundo de uma camada de imagem (a mesma IA do Remover fundo). */
export function BotaoSegmentarCamada({ tarefa, aoClicar, aoRestaurar, desativado }) {
  if (tarefa.fase === 'processando') return <Progresso valor={tarefa.progresso} rotulo={tarefa.rotulo} aoCancelar={tarefa.cancelar} />
  return (
    <>
      <div className="flex flex-wrap gap-1.5">
        <Botao variante="secundario" tamanho="p" icone="magica" onClick={aoClicar} disabled={desativado} data-segmentar-camada="">
          {aoRestaurar ? 'Remover fundo de novo' : 'Remover fundo'}
        </Botao>
        {aoRestaurar ? (
          <Botao variante="fantasma" tamanho="p" icone="redefinir" onClick={aoRestaurar} disabled={desativado}>
            Restaurar original
          </Botao>
        ) : null}
      </div>
      <p className="text-xs text-fraca">{aoRestaurar ? 'Fundo removido. O original fica guardado.' : 'Deixa só a pessoa ou o objeto principal desta imagem.'}</p>
      {tarefa.fase === 'erro' ? <Aviso tom="erro">{tarefa.mensagem}</Aviso> : null}
    </>
  )
}

export function PainelCamada({ camada: bruta, mudar, acoes, focarTexto, aoFocado, segmentar, contaGotasAtivo }) {
  const texto = useRef(null)
  useEffect(() => {
    if (focarTexto && texto.current) {
      const t = texto.current.querySelector('textarea')
      t?.focus()
      t?.select()
      // Só uma vez (ao criar): selecionar o texto depois não rouba o foco — o Delete exclui a camada.
      aoFocado?.()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
                ['esquerda', 'Alinhar à esquerda', 'alinharEsquerda'],
                ['centro', 'Centralizar', 'alinharCentro'],
                ['direita', 'Alinhar à direita', 'alinharDireita'],
              ].map(([v, rotulo, s]) => (
                <Alternar key={v} rotulo={rotulo} ativo={c.alinhar === v} aoMudar={() => m({ alinhar: v })}>
                  <Icone nome={s} tamanho={16} />
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
          <Grupo titulo="Remover fundo">{segmentar}</Grupo>
          <Grupo titulo="Remover uma cor (chroma key)">
            <Escolhas
              rotulo="Chroma key"
              atributo="data-chave-camada"
              valor={c.semFundo ?? null}
              aoMudar={(v) => {
                m({ semFundo: v, ...(v === 'cor' && !c.corChave ? { corChave: '#00b140' } : {}) })
                // "Escolher cor" já pede a cor na imagem.
                if ((v === 'cor') !== Boolean(contaGotasAtivo)) acoes.contaGotas?.(v === 'cor' ? c.id : null)
              }}
              colunas={2}
              opcoes={[
                [null, 'Desligado'],
                ['cor', 'Escolher cor', 'contaGotas'],
                ['branco', 'Branco'],
                ['preto', 'Preto'],
              ]}
            />
            {c.semFundo === 'cor' ? (
              <ControlesChave
                cor={c.corChave ?? '#00b140'}
                aoCor={(v) => m({ corChave: v })}
                tolerancia={c.tolerancia}
                aoTolerancia={(v) => m({ tolerancia: v })}
                suavidade={c.suavidade ?? 0.08}
                aoSuavidade={(v) => m({ suavidade: v })}
                aoContaGotas={() => acoes.contaGotas?.(contaGotasAtivo ? null : c.id)}
                contaGotasAtivo={contaGotasAtivo}
              />
            ) : c.semFundo ? (
              <>
                <Deslizante rotulo="Intensidade" valor={Math.round(c.tolerancia * 200)} aoMudar={(v) => m({ tolerancia: v / 200 })} min={1} max={100} formatar={(v) => `${v}%`} />
                <Deslizante rotulo="Suavidade da borda" valor={Math.round((c.suavidade ?? 0.08) * 400)} aoMudar={(v) => m({ suavidade: v / 400 })} min={0} max={100} formatar={(v) => `${v}%`} />
              </>
            ) : null}
          </Grupo>
          <Deslizante rotulo="Cantos arredondados" valor={Math.round((c.raio ?? 0) * 100)} aoMudar={(v) => m({ raio: v / 100 })} min={0} max={100} formatar={(v) => `${v}%`} />
        </>
      ) : null}

      {c.tipo !== 'desenho' ? (
        <Grupo titulo="Posição e rotação">
          <div className="grid grid-cols-2 gap-2">
            <Botao variante="secundario" tamanho="p" icone="centroH" onClick={acoes.centroHorizontal}>
              Centro horizontal
            </Botao>
            <Botao variante="secundario" tamanho="p" icone="centroV" onClick={acoes.centroVertical}>
              Centro vertical
            </Botao>
          </div>
          {c.cantos ? null : <Deslizante rotulo="Rotação" valor={c.girar} aoMudar={(v) => m({ girar: v })} min={-180} max={180} formatar={(v) => `${v}°`} />}
          <div className="flex gap-2">
            {c.cantos ? null : (
              <>
                <Botao variante="secundario" tamanho="p" className="flex-1" icone="girarAnti" onClick={() => m({ girar: ((c.girar - 90 + 540) % 360) - 180 })}>
                  90°
                </Botao>
                <Botao variante="secundario" tamanho="p" className="flex-1" icone="girar" onClick={() => m({ girar: ((c.girar + 90 + 540) % 360) - 180 })}>
                  90°
                </Botao>
              </>
            )}
            <Botao variante={c.espelharH ? 'primario' : 'secundario'} tamanho="p" icone="espelhar" aria-pressed={c.espelharH} aria-label="Espelhar na horizontal" title="Espelhar na horizontal" onClick={() => m({ espelharH: !c.espelharH })} />
            <Botao variante={c.espelharV ? 'primario' : 'secundario'} tamanho="p" aria-pressed={c.espelharV} icone="espelharV" aria-label="Espelhar na vertical" title="Espelhar na vertical" onClick={() => m({ espelharV: !c.espelharV })} />
          </div>
        </Grupo>
      ) : null}

      {c.tipo !== 'desenho' ? (
        <Grupo titulo="Perspectiva e distorção">
          {c.cantos ? (
            <>
              <Escolhas
                rotulo="Como os cantos se movem"
                atributo="data-modo-cantos"
                valor={c.modoCantos ?? 'livre'}
                aoMudar={(v) => m({ modoCantos: v })}
                opcoes={[
                  ['livre', 'Distorcer (livre)'],
                  ['perspectiva', 'Perspectiva'],
                ]}
              />
              <p className="text-xs text-fraca">
                {(c.modoCantos ?? 'livre') === 'livre'
                  ? 'Arraste cada canto até onde ele deve ficar — por exemplo, nos cantos da estampa de uma camiseta.'
                  : 'Arrastar um canto move o vizinho do mesmo lado ao contrário: a camada inclina como se estivesse mais longe.'}{' '}
                Segure Shift para alternar o modo enquanto arrasta.
              </p>
              <Botao variante="secundario" tamanho="p" icone="redefinir" className="self-start" onClick={acoes.semDistorcao} data-sem-distorcao="">
                Tirar a distorção
              </Botao>
            </>
          ) : (
            <>
              <Botao variante="secundario" tamanho="p" icone="perspectiva" className="self-start" onClick={acoes.distorcer} data-distorcer="">
                Distorcer / perspectiva
              </Botao>
              <p className="text-xs text-fraca">Aparece um ponto em cada canto da camada: arraste para inclinar e encaixar (uma logo numa camiseta, numa parede, numa tela).</p>
            </>
          )}
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
