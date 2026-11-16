import { useCallback, useEffect, useRef, useState } from 'react'
import { BotaoAcao, CampoTempo, Velocidade, tempo, useHistorico } from '../../componentes/editor/Comum'
import { MenuContexto } from '../../componentes/editor/MenuContexto'
import { Resultados } from '../../componentes/ferramenta/Resultados'
import { Icone } from '../../componentes/Icone'
import { AreaTexto, Aviso, Botao, Caixa, Deslizante, Progresso, Segmentado, SeloCategoria } from '../../componentes/ui'
import { EXTENSOES_AUDIO, EXTENSOES_VIDEO, infoMidia, processarVideo } from '../../motores/midia'
import { EXTENSOES_IMAGEM } from '../../motores/imagem'
import { extensaoDe } from '../../nucleo/arquivos'
import { useEmEdicao } from '../../nucleo/edicao'
import { apagarTudo, guardar, haQuanto, ler } from '../../nucleo/rascunho'
import { useTarefa } from '../../nucleo/tarefa'
import { DialogoExportar, limparNome } from './_exportar'
import { LinhaDoTempo } from './_linha'
import { Palco } from './_palco'
import { ANIMACOES, FILTROS, FONTES, PADRAO_AUDIO, PADRAO_COR, corDoFiltro, matrizCor, PADRAO_BLUR, PADRAO_CAMADA, PADRAO_GIF, PADRAO_TEXTO, duracaoTotal, exportarProjeto, iniciosNaLinha, localizar, projetoNoInstante, quadroGif, tamanhoFinal, trechoMusica, TRANSICOES, duracaoClipe, duracaoTransicao, corDoClipe, temCor, PADRAO_ENQUADRO, PROPORCOES, enquadroDoClipe, temEnquadro } from './_projeto'

const PADRAO = { clipes: [], proporcao: null, recorte: null, girar: 0, espelhar: false, cor: { brilho: 0, contraste: 1, saturacao: 1, temperatura: 0, matiz: 0, sepia: 0, vinheta: 0 }, fadeIn: 0, fadeOut: 0, camadas: [], musica: null, audio: PADRAO_AUDIO, nome: '', formato: 'mp4', resolucao: 0, qualidade: 'alta', alvoMB: 10, fps: 30, gif: PADRAO_GIF }
const segundos = (v) => (v ? `${v.toLocaleString('pt-BR')} s` : 'off')
/** Botão liga/desliga pequeno (negrito, itálico…). */
function Alternar({ ativo, aoMudar, rotulo, children, className = '' }) {
  return (
    <button
      type="button"
      aria-pressed={ativo}
      aria-label={rotulo}
      title={rotulo}
      onClick={() => aoMudar(!ativo)}
      className={`grid h-9 min-w-9 place-items-center rounded-lg border px-2 text-sm transition-colors ${ativo ? 'border-acento bg-acento-suave text-acento' : 'border-borda-forte bg-superficie text-texto hover:text-tinta'} ${className}`}
    >
      {children}
    </button>
  )
}
const corInput = 'h-9 w-11 cursor-pointer rounded-lg border border-borda-forte bg-transparent'
const ordemNatural = (a, b) => a.name.localeCompare(b.name, 'pt-BR', { numeric: true, sensitivity: 'base' })
let proximo = 0
const novoId = (prefixo) => `${prefixo}${(proximo += 1)}`
/** Depois de recuperar um rascunho, os ids novos não podem repetir os antigos. */
const reservarIds = (ids) => ids.forEach((id) => (proximo = Math.max(proximo, Number(String(id).replace(/\D/g, '')) || 0)))
const tipoDe = (arquivo) => {
  const ext = extensaoDe(arquivo.name)
  if (EXTENSOES_VIDEO.includes(ext) || ext === 'gif') return 'video'
  if (EXTENSOES_IMAGEM.includes(ext)) return 'imagem'
  if (EXTENSOES_AUDIO.includes(ext)) return 'audio'
  return null
}

/* ─── Leitura das fontes ─────────────────────────────────────────────────── */

function metadadosVideo(url) {
  return new Promise((ok, falha) => {
    const v = document.createElement('video')
    v.preload = 'metadata'
    v.muted = true
    v.onloadedmetadata = () => ok({ largura: v.videoWidth, altura: v.videoHeight, duracao: Number.isFinite(v.duration) ? v.duration : null })
    v.onerror = () => falha(new Error('sem prévia'))
    v.src = url
  })
}

/**
 * Tira de miniaturas para a linha do tempo: um quadro a cada `passo`
 * segundos (entre 6 e 48 quadros), na proporção do vídeo.
 */
async function quadrosDe(url, duracao) {
  const v = document.createElement('video')
  v.muted = true
  v.preload = 'auto'
  v.src = url
  await new Promise((ok, falha) => {
    v.onloadeddata = ok
    v.onerror = falha
  })
  const alto = 104 // 2× a altura do clipe na linha do tempo (fica nítido)
  const largo = Math.max(1, Math.round((v.videoWidth / v.videoHeight) * alto))
  const cv = document.createElement('canvas')
  cv.width = largo
  cv.height = alto
  const ctx = cv.getContext('2d')
  const d = duracao || 1
  const n = Math.min(48, Math.max(6, Math.round(d)))
  const passo = d / n
  const quadros = []
  for (let k = 0; k < n; k += 1) {
    await new Promise((ok) => {
      v.onseeked = ok
      v.currentTime = Math.min(d - 0.05, (k + 0.5) * passo)
    })
    ctx.drawImage(v, 0, 0, largo, alto)
    quadros.push(cv.toDataURL('image/jpeg', 0.62))
  }
  v.removeAttribute('src')
  v.load()
  return { quadros, passoQuadros: passo }
}

/** Picos do som (0–1) a cada `passoPicos` segundos, para desenhar a onda. */
async function picosDe(arquivo) {
  if (arquivo.size > 250 * 1024 * 1024) return null // arquivo enorme: não vale decodificar só para a onda
  const ctx = new OfflineAudioContext(1, 1, 8000)
  const buf = await ctx.decodeAudioData(await arquivo.arrayBuffer())
  const dados = buf.getChannelData(0)
  const n = Math.min(6000, Math.max(100, Math.round(buf.duration * 25)))
  const bloco = Math.max(1, Math.floor(dados.length / n))
  const picos = new Array(n)
  let max = 0
  for (let i = 0; i < n; i += 1) {
    let m = 0
    const fim = Math.min(dados.length, (i + 1) * bloco)
    for (let j = i * bloco; j < fim; j += 4) {
      const a = Math.abs(dados[j])
      if (a > m) m = a
    }
    picos[i] = m
    if (m > max) max = m
  }
  const k = max > 0 ? 1 / max : 1
  return { picos: picos.map((x) => Math.sqrt(x * k)), passoPicos: buf.duration / n }
}

async function lerFonte(arquivo, aoPreparar) {
  const tipo = tipoDe(arquivo)
  if (tipo === 'imagem') {
    const bmp = await createImageBitmap(arquivo)
    const r = { arquivo, tipo, largura: bmp.width, altura: bmp.height, url: URL.createObjectURL(arquivo) }
    bmp.close()
    return r
  }
  if (tipo === 'audio') {
    const url = URL.createObjectURL(arquivo)
    const info = await infoMidia(arquivo).catch(() => ({}))
    return { arquivo, tipo, url, duracao: info.duracao ?? null, temAudio: info.temAudio !== false }
  }
  const info = await infoMidia(arquivo).catch(() => ({}))
  let url = URL.createObjectURL(arquivo)
  let meta
  try {
    meta = await metadadosVideo(url)
  } catch {
    // O navegador não toca este formato (AVI, WMV…): prévia convertida para MP4; a exportação usa o original.
    URL.revokeObjectURL(url)
    aoPreparar?.(`Preparando a prévia de ${arquivo.name}`)
    const { blob } = await processarVideo(arquivo, { formato: 'mp4', qualidade: 'media' }, { progresso: () => {} })
    url = URL.createObjectURL(blob)
    meta = await metadadosVideo(url)
  }
  return { arquivo, tipo: 'video', url, largura: meta.largura || info.largura, altura: meta.altura || info.altura, duracao: meta.duracao ?? info.duracao, temAudio: Boolean(info.temAudio) }
}

/** Nome do arquivo exportado, editável no lugar (clique para renomear). */
function NomeArquivo({ nome, aoMudar, desativado }) {
  const [editando, setEditando] = useState(false)
  const [texto, setTexto] = useState(nome)
  const cancelado = useRef(false)
  if (editando) {
    return (
      <input
        // eslint-disable-next-line jsx-a11y/no-autofocus
        autoFocus
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        onFocus={(e) => e.currentTarget.select()}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur()
          else if (e.key === 'Escape') {
            cancelado.current = true
            e.currentTarget.blur()
          }
        }}
        onBlur={() => {
          const n = limparNome(texto)
          if (!cancelado.current && n && n !== nome) aoMudar(n)
          cancelado.current = false
          setEditando(false)
        }}
        aria-label="Nome do arquivo"
        spellCheck={false}
        className="h-7 w-full max-w-sm rounded-md border border-acento bg-superficie px-2 text-sm font-semibold text-tinta focus:outline-none"
      />
    )
  }
  return (
    <button
      type="button"
      disabled={desativado}
      onClick={() => {
        setTexto(nome)
        setEditando(true)
      }}
      title="Renomear o arquivo exportado"
      aria-label={`Renomear o arquivo: ${nome}`}
      className="group -mx-1.5 flex h-7 max-w-full items-center gap-1.5 rounded-md px-1.5 text-left text-sm font-semibold text-tinta transition-colors hover:bg-superficie-2 disabled:pointer-events-none"
    >
      <span className="truncate">{nome}</span>
      {desativado ? null : <Icone nome="caneta" tamanho={13} className="shrink-0 text-fraca group-hover:text-tinta" />}
    </button>
  )
}

/* ─── Painéis de propriedades ────────────────────────────────────────────── */

function Bloco({ titulo, children }) {
  return (
    <div className="flex flex-col gap-3">
      {titulo ? <h3 className="text-xs font-semibold tracking-wide text-fraca uppercase">{titulo}</h3> : null}
      {children}
    </div>
  )
}

/** Miniatura de uma transição (metade do caminho entre o clipe A e o B). */
function MiniaturaTransicao({ tipo }) {
  const b = {
    dissolver: { opacity: 0.5 },
    'deslizar-esq': { translate: '50% 0' },
    'deslizar-dir': { translate: '-50% 0' },
    'limpar-esq': { clipPath: 'inset(0 0 0 50%)' },
    'limpar-dir': { clipPath: 'inset(0 50% 0 0)' },
    circulo: { clipPath: 'circle(38% at 50% 50%)' },
  }[tipo]
  return (
    <span className="relative block aspect-video w-full overflow-hidden rounded-md bg-[linear-gradient(135deg,#2563eb,#38bdf8)]">
      {tipo === 'preto' || tipo === 'branco' ? <span className={`absolute inset-0 ${tipo === 'preto' ? 'bg-black' : 'bg-white'}`} /> : tipo ? <span className="absolute inset-0 bg-[linear-gradient(135deg,#f97316,#facc15)]" style={b} /> : null}
    </span>
  )
}

/** Transição de um clipe para o próximo. */
function PainelTransicao({ p, clipe, mudarClipe, mudar }) {
  const i = p.clipes.findIndex((c) => c.id === clipe.id)
  const prox = p.clipes[i + 1]
  if (!prox) return <p className="text-sm text-fraca">O último clipe não tem transição depois dele.</p>
  const atual = clipe.transicao
  const max = Math.max(0.2, Math.floor((Math.min(duracaoClipe(clipe), duracaoClipe(prox)) / 2) * 10) / 10)
  const d = duracaoTransicao(p, i)
  const opcao = (ativo) => `flex flex-col items-center gap-1 rounded-lg border-2 p-1.5 text-[0.6875rem] font-semibold transition-colors ${ativo ? 'border-acento bg-acento-suave text-acento' : 'border-transparent text-suave hover:border-borda-forte hover:text-tinta'}`
  return (
    <div className="flex flex-col gap-5">
      <p className="text-sm font-semibold text-tinta">
        Transição: clipe {i + 1} → clipe {i + 2}
      </p>
      <div className="grid grid-cols-3 gap-1.5" role="radiogroup" aria-label="Transições">
        <button type="button" role="radio" aria-checked={!atual} onClick={() => mudarClipe(clipe.id, { transicao: null })} className={opcao(!atual)}>
          <MiniaturaTransicao tipo={null} />
          Nenhuma
        </button>
        {TRANSICOES.map((x) => (
          <button key={x.id} type="button" role="radio" aria-checked={atual?.tipo === x.id} onClick={() => mudarClipe(clipe.id, { transicao: { tipo: x.id, dur: atual?.dur ?? Math.min(0.8, max) } })} className={opcao(atual?.tipo === x.id)}>
            <MiniaturaTransicao tipo={x.id} />
            {x.rotulo}
          </button>
        ))}
      </div>
      {atual ? (
        <>
          <Deslizante rotulo="Duração da transição" valor={Math.min(atual.dur, max)} aoMudar={(v) => mudarClipe(clipe.id, { transicao: { ...atual, dur: v } })} min={0.2} max={max} passo={0.1} formatar={(v) => `${v.toLocaleString('pt-BR')} s`} dica={d < atual.dur - 0.01 ? `Limitada a ${d.toLocaleString('pt-BR')} s (metade do clipe mais curto).` : undefined} />
          <Botao variante="secundario" tamanho="p" icone="transicao" onClick={() => mudar((x) => ({ clipes: x.clipes.map((c, j) => (j < x.clipes.length - 1 ? { ...c, transicao: { ...atual } } : c)) }))}>
            Aplicar em todas as junções
          </Botao>
          <p className="text-xs text-fraca">Os dois clipes se sobrepõem durante a transição, então o vídeo fica {d.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} s mais curto.</p>
        </>
      ) : null}
    </div>
  )
}

function PainelClipe({ p, fontes, clipe, mudarClipe, mudar, acoes }) {
  if (!clipe) return <p className="text-sm text-fraca">Clique num clipe da linha do tempo para ajustar velocidade, volume e trecho.</p>
  const fonte = fontes[clipe.fonte]
  const i = p.clipes.findIndex((c) => c.id === clipe.id)
  const miniatura = fonte?.tipo === 'imagem' ? fonte.url : fonte?.quadros?.[Math.floor((fonte.quadros.length ?? 0) / 2)]
  const enquadro = (
    <EnquadroDoClipe
      enquadro={enquadroDoClipe(clipe)}
      aoMudar={(e) => mudarClipe(clipe.id, { enquadro: e })}
      varios={p.clipes.length > 1}
      aoAplicarTodos={() => mudar((x) => ({ clipes: x.clipes.map((y) => ({ ...y, enquadro: enquadroDoClipe(clipe) })) }))}
    />
  )
  const cores = (
    <CoresDoClipe
      cor={corDoClipe(clipe)}
      aoMudar={(c) => mudarClipe(clipe.id, { cor: c })}
      miniatura={miniatura}
      varios={p.clipes.length > 1}
      aoAplicarTodos={() => mudar((x) => ({ clipes: x.clipes.map((y) => ({ ...y, cor: corDoClipe(clipe) })) }))}
    />
  )
  if (fonte?.tipo === 'imagem') {
    return (
      <div className="flex flex-col gap-5">
        <p className="truncate text-sm font-semibold text-tinta" title={fonte.arquivo.name}>
          Clipe {i + 1} · {fonte.arquivo.name}
        </p>
        <Bloco titulo="Duração da imagem">
          <CampoTempo rotulo="Duração" valor={clipe.fim} aoMudar={(v) => mudarClipe(clipe.id, { inicio: 0, fim: Math.min(600, Math.max(0.2, v)) })} />
          <p className="text-xs text-fraca">Ou arraste a ponta do clipe na timeline.</p>
        </Bloco>
        {enquadro}
        {cores}
        <div className="grid grid-cols-2 gap-2">
          <Botao variante="secundario" tamanho="p" icone="copiar" onClick={() => acoes.duplicar(clipe.id)}>
            Duplicar
          </Botao>
          <Botao variante="perigo" tamanho="p" icone="apagar" onClick={() => acoes.remover({ tipo: 'clipe', id: clipe.id })}>
            Excluir
          </Botao>
        </div>
      </div>
    )
  }
  return (
    <div className="flex flex-col gap-5">
      <p className="truncate text-sm font-semibold text-tinta" title={fonte?.arquivo.name}>
        Clipe {i + 1} · {fonte?.arquivo.name}
      </p>
      {enquadro}
      {cores}
      <Velocidade valor={clipe.velocidade} aoMudar={(v) => mudarClipe(clipe.id, { velocidade: v })} />
      <Bloco titulo="Áudio do clipe">
        {fonte?.temAudio ? (
          <>
            <Deslizante rotulo="Volume" valor={Math.round(clipe.volume * 100)} aoMudar={(v) => mudarClipe(clipe.id, { volume: v / 100 })} min={0} max={100} formatar={(v) => `${v}%`} />
            <Caixa rotulo="Mudo" marcado={clipe.mudo} aoMudar={(v) => mudarClipe(clipe.id, { mudo: v })} />
          </>
        ) : (
          <p className="text-xs text-fraca">Este vídeo não tem áudio.</p>
        )}
      </Bloco>
      <Bloco titulo="Trim (trecho do arquivo)">
        <div className="flex gap-2">
          <CampoTempo rotulo="De" valor={clipe.inicio} aoMudar={(v) => mudarClipe(clipe.id, { inicio: Math.min(Math.max(0, v), clipe.fim - 0.1) })} />
          <CampoTempo rotulo="Até" valor={clipe.fim} aoMudar={(v) => mudarClipe(clipe.id, { fim: Math.max(Math.min(fonte?.duracao ?? v, v), clipe.inicio + 0.1) })} />
        </div>
      </Bloco>
      <div className="grid grid-cols-2 gap-2">
        <Botao variante="secundario" tamanho="p" icone="cortar" onClick={acoes.dividir} title="Divide o clipe onde está o cursor (S)">
          Dividir
        </Botao>
        <Botao variante="secundario" tamanho="p" icone="copiar" onClick={() => acoes.duplicar(clipe.id)}>
          Duplicar
        </Botao>
        <Botao variante="secundario" tamanho="p" icone="congelar" onClick={acoes.congelar} title="Congela o quadro do cursor por 2 s">
          Congelar quadro
        </Botao>
        <Botao variante="secundario" tamanho="p" icone="camera" onClick={acoes.salvarQuadro} title="Salva o quadro do cursor como PNG">
          Salvar quadro
        </Botao>
        <Botao variante="secundario" tamanho="p" onClick={() => acoes.mover(clipe.id, -1)} disabled={i === 0}>
          ← Antes
        </Botao>
        <Botao variante="secundario" tamanho="p" onClick={() => acoes.mover(clipe.id, 1)} disabled={i === p.clipes.length - 1}>
          Depois →
        </Botao>
      </div>
      <Botao variante="perigo" tamanho="p" icone="apagar" onClick={() => acoes.remover({ tipo: 'clipe', id: clipe.id })}>
        Excluir clipe
      </Botao>
    </div>
  )
}

function PainelCamada({ camada: bruta, mudarCamada, acoes, total }) {
  if (!bruta) return <p className="text-sm text-fraca">Adicione texto, camada (imagem, vídeo ou GIF) ou blur pelos botões abaixo do player, ou clique numa camada para editar.</p>
  const camada = { ...PADRAO_CAMADA, ...(bruta.tipo === 'texto' ? PADRAO_TEXTO : bruta.tipo === 'desfoque' ? PADRAO_BLUR : {}), ...bruta }
  const m = (d) => mudarCamada(camada.id, d)
  const midia = camada.tipo === 'imagem' || camada.tipo === 'video'
  const r = camada.recorte ?? { x: 0, y: 0, w: 1, h: 1 }
  const contorno = camada.contorno ?? !camada.fundo
  return (
    <div className="flex flex-col gap-5">
      {camada.tipo === 'texto' ? (
        <>
          <AreaTexto rotulo="Texto" valor={camada.texto} aoMudar={(v) => m({ texto: v })} rows={3} className="[&_textarea]:min-h-20 [&_textarea]:font-sans [&_textarea]:text-sm" />
          <Bloco titulo="Tipografia">
            <label className="relative flex flex-col gap-1.5 text-[0.8125rem] font-semibold text-tinta">
              Fonte
              <select
                value={camada.fonte}
                onChange={(e) => m({ fonte: e.target.value })}
                className="h-10 appearance-none rounded-lg border border-borda-forte bg-superficie pr-8 pl-3 text-sm font-medium text-tinta focus:border-acento focus:outline-none"
                style={{ fontFamily: (FONTES.find((x) => x.id === camada.fonte) ?? FONTES[0]).css }}
              >
                {FONTES.map((x) => (
                  <option key={x.id} value={x.id} style={{ fontFamily: x.css }}>
                    {x.rotulo}
                  </option>
                ))}
              </select>
              <Icone nome="setaBaixo" tamanho={14} className="pointer-events-none absolute right-2.5 bottom-3 text-fraca" />
            </label>
            <Deslizante rotulo="Tamanho" valor={Math.round(camada.tamanho * 1000) / 10} aoMudar={(v) => m({ tamanho: v / 100 })} min={2} max={25} passo={0.5} formatar={(v) => `${v}%`} />
            <div className="flex flex-wrap items-center gap-1.5">
              <input type="color" aria-label="Cor do texto" title="Cor do texto" value={camada.cor} onChange={(e) => m({ cor: e.target.value })} className={corInput} />
              <Alternar rotulo="Negrito" ativo={camada.negrito} aoMudar={(v) => m({ negrito: v })}>
                <b>B</b>
              </Alternar>
              <Alternar rotulo="Itálico" ativo={camada.italico} aoMudar={(v) => m({ italico: v })}>
                <i className="font-serif">I</i>
              </Alternar>
              <Alternar rotulo="Caixa alta (maiúsculas)" ativo={camada.maiusculas} aoMudar={(v) => m({ maiusculas: v })}>
                <span className="text-xs font-bold">AA</span>
              </Alternar>
              <span className="mx-1 h-6 w-px bg-borda" />
              {[
                ['esquerda', 'Alinhar à esquerda', '⇤'],
                ['centro', 'Centralizar', '↔'],
                ['direita', 'Alinhar à direita', '⇥'],
              ].map(([v, rotulo, s]) => (
                <Alternar key={v} rotulo={rotulo} ativo={camada.alinhar === v} aoMudar={() => m({ alinhar: v })}>
                  {s}
                </Alternar>
              ))}
            </div>
            <Deslizante rotulo="Espaçamento (tracking)" valor={Math.round(camada.espacamento * 100)} aoMudar={(v) => m({ espacamento: v / 100 })} min={-5} max={50} formatar={(v) => `${(v / 100).toLocaleString('pt-BR')} em`} />
          </Bloco>
          <Bloco titulo="Stroke e sombra">
            <div className="flex flex-wrap items-center gap-3">
              <Caixa rotulo="Stroke (contorno)" marcado={contorno} aoMudar={(v) => m({ contorno: v })} />
              {contorno ? <input type="color" aria-label="Cor do stroke" title="Cor do stroke" value={camada.corContorno} onChange={(e) => m({ corContorno: e.target.value })} className={corInput} /> : null}
            </div>
            {contorno ? <Deslizante rotulo="Espessura do stroke" valor={Math.round(camada.espessuraContorno * 100)} aoMudar={(v) => m({ espessuraContorno: v / 100 })} min={2} max={30} formatar={(v) => `${v}%`} /> : null}
            <Caixa rotulo="Drop shadow (sombra)" marcado={camada.sombra} aoMudar={(v) => m({ sombra: v })} />
          </Bloco>
          <Bloco titulo="Background">
            <div className="flex flex-wrap items-center gap-3">
              <Caixa rotulo="Caixa de fundo" marcado={camada.fundo} aoMudar={(v) => m({ fundo: v })} />
              {camada.fundo ? <input type="color" aria-label="Cor da caixa" value={camada.corFundo} onChange={(e) => m({ corFundo: e.target.value })} className={corInput} /> : null}
            </div>
            {camada.fundo ? <Deslizante rotulo="Opacidade da caixa" valor={Math.round(camada.opacidadeFundo * 100)} aoMudar={(v) => m({ opacidadeFundo: v / 100 })} min={10} max={100} formatar={(v) => `${v}%`} /> : null}
          </Bloco>
        </>
      ) : null}
      {camada.tipo === 'video' ? <Deslizante rotulo="Volume da camada" valor={Math.round((camada.volume ?? 0) * 100)} aoMudar={(v) => m({ volume: v / 100 })} min={0} max={100} formatar={(v) => (v ? `${v}%` : 'mudo')} /> : null}
      {camada.tipo === 'desfoque' ? (
        <Bloco titulo="Blur">
          <p className="text-xs text-fraca">Arraste a área no player para cobrir rostos, placas ou dados; as alças mudam o tamanho.</p>
          <Segmentado
            rotulo="Efeito"
            valor={camada.estilo}
            aoMudar={(v) => m({ estilo: v })}
            opcoes={[
              { valor: 'blur', rotulo: 'Blur' },
              { valor: 'mosaico', rotulo: 'Pixelate (mosaico)' },
            ]}
          />
          <Segmentado
            rotulo="Máscara"
            valor={camada.forma}
            aoMudar={(v) => m({ forma: v })}
            opcoes={[
              { valor: 'retangulo', rotulo: 'Retângulo' },
              { valor: 'elipse', rotulo: 'Elipse' },
            ]}
          />
          <Deslizante rotulo="Intensidade" valor={Math.round(camada.intensidade * 100)} aoMudar={(v) => m({ intensidade: v / 100 })} min={10} max={100} formatar={(v) => `${v}%`} />
        </Bloco>
      ) : null}
      <Bloco titulo="Posição">
        <div className="grid grid-cols-2 gap-2">
          <Botao variante="secundario" tamanho="p" onClick={() => m({ x: 0.5 - camada.w / 2 })}>
            Centro ↔
          </Botao>
          <Botao variante="secundario" tamanho="p" onClick={() => m({ y: 0.5 - (camada.tipo === 'texto' ? 0.05 : camada.h / 2) })}>
            Centro ↕
          </Botao>
        </div>
      </Bloco>
      {camada.tipo !== 'desfoque' ? (
        <Bloco titulo="Rotação e flip">
          <Deslizante rotulo="Rotação" valor={camada.girar} aoMudar={(v) => m({ girar: v })} min={-180} max={180} formatar={(v) => `${v}°`} />
          <div className="flex gap-2">
            <Botao variante="secundario" tamanho="p" className="flex-1" onClick={() => m({ girar: ((camada.girar - 90 + 540) % 360) - 180 })}>
              ↺ 90°
            </Botao>
            <Botao variante="secundario" tamanho="p" className="flex-1" onClick={() => m({ girar: ((camada.girar + 90 + 540) % 360) - 180 })}>
              ↻ 90°
            </Botao>
            <Botao variante={camada.espelharH ? 'primario' : 'secundario'} tamanho="p" icone="espelhar" aria-pressed={camada.espelharH} aria-label="Flip horizontal" title="Flip horizontal" onClick={() => m({ espelharH: !camada.espelharH })} />
            <Botao variante={camada.espelharV ? 'primario' : 'secundario'} tamanho="p" aria-pressed={camada.espelharV} aria-label="Flip vertical" title="Flip vertical" onClick={() => m({ espelharV: !camada.espelharV })}>
              ⇵
            </Botao>
          </div>
        </Bloco>
      ) : null}
      {midia ? (
        <Bloco titulo="Crop">
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
                  step={1}
                  value={Math.round(r[k] * 100)}
                  aria-label={`${rotulo} do crop da camada em %`}
                  onChange={(e) => {
                    const n = { ...r, [k]: Math.min(Math.max(Number(e.target.value) / 100, 0), 1) }
                    n.w = Math.min(Math.max(0.05, n.w), 1 - n.x)
                    n.h = Math.min(Math.max(0.05, n.h), 1 - n.y)
                    // A caixa acompanha o recorte (a imagem não estica).
                    m({ recorte: n.x === 0 && n.y === 0 && n.w === 1 && n.h === 1 ? null : n, h: camada.h * (n.h / r.h) * (r.w / n.w) })
                  }}
                  className="h-9 rounded-lg border border-borda-forte bg-superficie px-2.5 text-sm font-semibold text-tinta normal-case tabular-nums focus:border-acento focus:outline-none"
                />
              </label>
            ))}
          </div>
        </Bloco>
      ) : null}
      {midia ? (
        <Bloco titulo="Chroma key (remover fundo)">
          <Segmentado
            valor={camada.semFundo ?? 'nao'}
            aoMudar={(v) => m({ semFundo: v === 'nao' ? null : v })}
            opcoes={[
              { valor: 'nao', rotulo: 'Off' },
              { valor: 'branco', rotulo: 'Branco' },
              { valor: 'preto', rotulo: 'Preto' },
            ]}
          />
          {camada.semFundo ? <Deslizante rotulo="Similaridade (tolerância)" valor={Math.round(camada.tolerancia * 100)} aoMudar={(v) => m({ tolerancia: v / 100 })} min={2} max={50} formatar={(v) => `${v}%`} dica="Aumente se sobrar fundo; diminua se sumir parte da imagem." /> : null}
        </Bloco>
      ) : null}
      {midia ? (
        <Bloco titulo="Correção de cor">
          <Deslizante rotulo="Brilho" valor={Math.round(camada.ajuste.brilho * 100)} aoMudar={(v) => m({ ajuste: { ...camada.ajuste, brilho: v / 100 } })} min={-50} max={50} formatar={(v) => `${v > 0 ? '+' : ''}${v}`} />
          <Deslizante rotulo="Contraste" valor={Math.round(camada.ajuste.contraste * 100)} aoMudar={(v) => m({ ajuste: { ...camada.ajuste, contraste: v / 100 } })} min={50} max={150} formatar={(v) => `${v}%`} />
          <Deslizante rotulo="Saturação" valor={Math.round(camada.ajuste.saturacao * 100)} aoMudar={(v) => m({ ajuste: { ...camada.ajuste, saturacao: v / 100 } })} min={0} max={200} formatar={(v) => (v ? `${v}%` : 'P&B')} />
        </Bloco>
      ) : null}
      {camada.tipo !== 'desfoque' ? (
        <>
        <Bloco titulo="Animação">
          {[
            ['animEntrada', 'Entrada'],
            ['animSaida', 'Saída'],
          ].map(([chave, rotulo]) => {
            const an = camada[chave]
            return (
              <div key={chave} className="flex flex-col gap-2">
                <label className="relative flex flex-col gap-1.5 text-[0.8125rem] font-semibold text-tinta">
                  {rotulo}
                  <select
                    value={an?.tipo ?? ''}
                    aria-label={`Animação de ${rotulo.toLowerCase()}`}
                    onChange={(e) => m({ [chave]: e.target.value ? { tipo: e.target.value, dur: an?.dur ?? 0.6 } : null })}
                    className="h-10 appearance-none rounded-lg border border-borda-forte bg-superficie pr-8 pl-3 text-sm font-medium text-tinta focus:border-acento focus:outline-none"
                  >
                    <option value="">Nenhuma</option>
                    {ANIMACOES.map((x) => (
                      <option key={x.id} value={x.id}>
                        {x.rotulo}
                      </option>
                    ))}
                  </select>
                  <Icone nome="setaBaixo" tamanho={14} className="pointer-events-none absolute right-2.5 bottom-3 text-fraca" />
                </label>
                {an ? <Deslizante rotulo={`Duração da ${rotulo.toLowerCase()}`} valor={an.dur} aoMudar={(v) => m({ [chave]: { ...an, dur: v } })} min={0.2} max={2} passo={0.1} formatar={(v) => `${v.toLocaleString('pt-BR')} s`} /> : null}
              </div>
            )
          })}
        </Bloco>
        <Bloco titulo="Fade">
          <Deslizante rotulo="Fade in" valor={camada.fadeIn} aoMudar={(v) => m({ fadeIn: v })} min={0} max={3} passo={0.25} formatar={segundos} />
          <Deslizante rotulo="Fade out" valor={camada.fadeOut} aoMudar={(v) => m({ fadeOut: v })} min={0} max={3} passo={0.25} formatar={segundos} />
        </Bloco>
        </>
      ) : null}
      {camada.tipo !== 'desfoque' ? <Deslizante rotulo="Opacidade" valor={Math.round((camada.opacidade ?? 1) * 100)} aoMudar={(v) => m({ opacidade: v / 100 })} min={10} max={100} formatar={(v) => `${v}%`} /> : null}
      <Bloco titulo="In / out na timeline">
        <div className="flex gap-2">
          <CampoTempo rotulo="De" valor={camada.inicio} aoMudar={(v) => m({ inicio: Math.min(Math.max(0, v), camada.fim - 0.2) })} />
          <CampoTempo rotulo="Até" valor={camada.fim} aoMudar={(v) => m({ fim: Math.max(Math.min(total, v), camada.inicio + 0.2) })} />
        </div>
        <button type="button" onClick={() => m({ inicio: 0, fim: total })} className="self-start text-xs font-semibold text-suave hover:text-tinta">
          O vídeo todo
        </button>
      </Bloco>
      <div className="grid grid-cols-2 gap-2">
        <Botao variante="secundario" tamanho="p" onClick={() => acoes.ordem(camada.id, 1)}>
          Trazer p/ frente
        </Botao>
        <Botao variante="secundario" tamanho="p" onClick={() => acoes.ordem(camada.id, -1)}>
          Enviar p/ trás
        </Botao>
      </div>
      <Botao variante="perigo" tamanho="p" icone="apagar" onClick={() => acoes.remover({ tipo: 'camada', id: camada.id })}>
        Excluir camada
      </Botao>
    </div>
  )
}

/** Os mesmos ajustes iguais? (para marcar o filtro escolhido) */
const mesmaCor = (a, b) => Object.keys(PADRAO_COR).every((k) => Math.abs((a[k] ?? PADRAO_COR[k]) - (b[k] ?? PADRAO_COR[k])) < 0.005)
const cssCor = (c, idMatriz) => `brightness(${1 + c.brilho}) contrast(${c.contraste}) saturate(${c.saturacao})${idMatriz ? ` url(#${idMatriz})` : ''}`

/** Grade de filtros prontos, com a miniatura do próprio vídeo (como no CapCut). */
function Filtros({ cor, miniatura, aoEscolher }) {
  return (
    <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Filtros">
      <svg width="0" height="0" className="absolute" aria-hidden="true">
        {FILTROS.map((f) => {
          const M = matrizCor(f.cor)
          return M ? (
            <filter key={f.id} id={`filtro-${f.id}`} colorInterpolationFilters="sRGB">
              <feColorMatrix type="matrix" values={`${M[0].join(' ')} 0 0 ${M[1].join(' ')} 0 0 ${M[2].join(' ')} 0 0 0 0 0 1 0`} />
            </filter>
          ) : null
        })}
      </svg>
      {FILTROS.map((f) => {
        const c = corDoFiltro(f)
        const ativo = mesmaCor(cor, c)
        return (
          <button key={f.id} type="button" role="radio" aria-checked={ativo} onClick={() => aoEscolher(c)} className="group flex flex-col items-center gap-1 text-[0.6875rem] font-semibold text-suave">
            <span className={`relative block aspect-video w-full overflow-hidden rounded-lg border-2 bg-superficie-3 transition-colors ${ativo ? 'border-acento' : 'border-transparent group-hover:border-borda-forte'}`}>
              {miniatura ? <img src={miniatura} alt="" className="size-full object-cover" style={{ filter: cssCor(c, matrizCor(f.cor) ? `filtro-${f.id}` : null) }} /> : null}
              {c.vinheta ? <span className="absolute inset-0" style={{ background: `radial-gradient(ellipse at center, transparent 42%, rgb(0 0 0 / ${0.9 * c.vinheta}) 100%)` }} /> : null}
            </span>
            <span className={ativo ? 'text-acento' : 'group-hover:text-tinta'}>{f.rotulo}</span>
          </button>
        )
      })}
    </div>
  )
}

/** Onde o clipe fica na tela: encaixar/preencher, zoom, posição e o fundo das sobras. */
function EnquadroDoClipe({ enquadro: e, aoMudar, aoAplicarTodos, varios }) {
  const m = (d) => aoMudar({ ...e, ...d })
  const pct = (v) => `${v > 0 ? '+' : ''}${v}%`
  return (
    <Bloco titulo="Enquadramento na tela">
      <Segmentado
        rotulo="Ajuste"
        valor={e.modo}
        aoMudar={(v) => m({ modo: v, zoom: 1, x: 0, y: 0 })}
        opcoes={[
          { valor: 'encaixar', rotulo: 'Encaixar' },
          { valor: 'preencher', rotulo: 'Preencher' },
        ]}
        dica={e.modo === 'encaixar' ? 'O vídeo inteiro aparece; sobra borda se a proporção for diferente.' : 'Cobre a tela toda, sem bordas; corta o que sobrar.'}
      />
      <Deslizante rotulo="Zoom" valor={Math.round(e.zoom * 100)} aoMudar={(v) => m({ zoom: v / 100 })} min={20} max={500} passo={1} formatar={(v) => `${v}%`} />
      <Deslizante rotulo="Posição horizontal" valor={Math.round(e.x * 100)} aoMudar={(v) => m({ x: v / 100 })} min={-100} max={100} formatar={pct} />
      <Deslizante rotulo="Posição vertical" valor={Math.round(e.y * 100)} aoMudar={(v) => m({ y: v / 100 })} min={-100} max={100} formatar={pct} />
      <Segmentado
        rotulo="Fundo das bordas"
        valor={e.fundo}
        aoMudar={(v) => m({ fundo: v })}
        opcoes={[
          { valor: 'preto', rotulo: 'Preto' },
          { valor: 'desfocado', rotulo: 'Desfocado' },
        ]}
      />
      <p className="text-xs text-fraca">Ou ajuste direto no player: arraste o vídeo para mover e puxe os cantos para dar zoom. Duplo clique no player seleciona o clipe que está na tela.</p>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {temEnquadro({ enquadro: e }) ? (
          <button type="button" onClick={() => aoMudar({ ...PADRAO_ENQUADRO })} className="text-xs font-semibold text-suave hover:text-tinta">
            Redefinir enquadramento
          </button>
        ) : null}
        {varios ? (
          <button type="button" onClick={aoAplicarTodos} className="text-xs font-semibold text-acento hover:underline">
            Aplicar em todos os clipes
          </button>
        ) : null}
      </div>
    </Bloco>
  )
}

/** Filtros e correção de cor de UM clipe (com a opção de copiar para todos). */
function CoresDoClipe({ cor, aoMudar, miniatura, aoAplicarTodos, varios }) {
  const mc = (d) => aoMudar({ ...cor, ...d })
  return (
    <>
      <Bloco titulo="Filtro deste clipe">
        <Filtros cor={cor} miniatura={miniatura} aoEscolher={(c) => aoMudar(c)} />
      </Bloco>
      <Bloco titulo="Correção de cor deste clipe">
        <Deslizante rotulo="Brilho" valor={Math.round(cor.brilho * 100)} aoMudar={(v) => mc({ brilho: v / 100 })} min={-50} max={50} formatar={(v) => `${v > 0 ? '+' : ''}${v}`} />
        <Deslizante rotulo="Contraste" valor={Math.round(cor.contraste * 100)} aoMudar={(v) => mc({ contraste: v / 100 })} min={50} max={150} formatar={(v) => `${v}%`} />
        <Deslizante rotulo="Saturação" valor={Math.round(cor.saturacao * 100)} aoMudar={(v) => mc({ saturacao: v / 100 })} min={0} max={200} formatar={(v) => (v ? `${v}%` : 'P&B')} />
        <Deslizante rotulo="Temperatura" valor={Math.round(cor.temperatura * 100)} aoMudar={(v) => mc({ temperatura: v / 100 })} min={-100} max={100} formatar={(v) => (v ? `${v > 0 ? '+' : ''}${v} ${v > 0 ? 'quente' : 'frio'}` : '0')} />
        <Deslizante rotulo="Matiz" valor={Math.round(cor.matiz)} aoMudar={(v) => mc({ matiz: v })} min={-180} max={180} formatar={(v) => `${v > 0 ? '+' : ''}${v}°`} />
        <Deslizante rotulo="Sépia" valor={Math.round(cor.sepia * 100)} aoMudar={(v) => mc({ sepia: v / 100 })} min={0} max={100} formatar={(v) => `${v}%`} />
        <Deslizante rotulo="Vinheta" valor={Math.round(cor.vinheta * 100)} aoMudar={(v) => mc({ vinheta: v / 100 })} min={0} max={100} formatar={(v) => `${v}%`} />
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          {!mesmaCor(cor, PADRAO_COR) ? (
            <button type="button" onClick={() => aoMudar({ ...PADRAO_COR })} className="text-xs font-semibold text-suave hover:text-tinta">
              Redefinir cores
            </button>
          ) : null}
          {varios ? (
            <button type="button" onClick={aoAplicarTodos} className="text-xs font-semibold text-acento hover:underline">
              Aplicar estas cores em todos os clipes
            </button>
          ) : null}
        </div>
      </Bloco>
    </>
  )
}

function PainelQuadro({ p, mudar, recorte, acoesRecorte, final }) {
  return (
    <div className="flex flex-col gap-5">
      {recorte ? null : (
        <Bloco titulo="Proporção da tela">
          <div className="grid grid-cols-3 gap-1.5" role="radiogroup" aria-label="Proporção da tela">
            {PROPORCOES.map((o) => {
              const ativo = (p.proporcao ?? null) === o.id
              const [a, b] = o.id ? o.id.split(':').map(Number) : [final.w, final.h]
              const k = a / b
              return (
                <button
                  key={o.id ?? 'original'}
                  type="button"
                  role="radio"
                  aria-checked={ativo}
                  title={o.dica}
                  onClick={() => mudar({ proporcao: o.id })}
                  className={`flex flex-col items-center gap-1 rounded-lg border-2 px-1 py-1.5 text-[0.6875rem] font-semibold transition-colors ${ativo ? 'border-acento bg-acento-suave text-acento' : 'border-transparent text-suave hover:border-borda-forte hover:text-tinta'}`}
                >
                  <span className="grid h-7 place-items-center">
                    <span className="block rounded-[3px] border-2 border-current" style={{ width: k >= 1 ? 28 : 28 * k, height: k >= 1 ? 28 / k : 28 }} />
                  </span>
                  {o.rotulo}
                  <span className="text-[0.625rem] font-normal text-fraca">{o.dica}</span>
                </button>
              )
            })}
          </div>
          <p className="text-xs text-fraca">Para tirar as bordas de um clipe, use Preencher, zoom ou fundo desfocado na aba Clipe.</p>
        </Bloco>
      )}
      <Bloco titulo="Crop">
        {recorte ? (
          <>
            <p className="text-xs text-fraca">Arraste o retângulo e as alças no vídeo. Proporção livre.</p>
            <div className="grid grid-cols-2 gap-2">
              {[
                ['x', 'Esquerda'],
                ['y', 'Topo'],
                ['w', 'Largura'],
                ['h', 'Altura'],
              ].map(([k, r]) => (
                <label key={k} className="flex flex-col gap-1 text-[0.6875rem] font-semibold tracking-wide text-fraca uppercase">
                  {r} (%)
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step={0.5}
                    value={Math.round(recorte.valor[k] * 1000) / 10}
                    aria-label={`${r} do crop em %`}
                    onChange={(e) => {
                      const v = Math.min(Math.max(Number(e.target.value) / 100, 0), 1)
                      const n = { ...recorte.valor, [k]: v }
                      n.w = Math.min(Math.max(0.05, n.w), 1 - n.x)
                      n.h = Math.min(Math.max(0.05, n.h), 1 - n.y)
                      recorte.aoMudar(n)
                    }}
                    className="h-9 rounded-lg border border-borda-forte bg-superficie px-2.5 text-sm font-semibold text-tinta normal-case tabular-nums focus:border-acento focus:outline-none"
                  />
                </label>
              ))}
            </div>
            <div className="flex gap-2">
              <Botao tamanho="p" icone="check" className="flex-1" onClick={acoesRecorte.aplicar}>
                Aplicar crop
              </Botao>
              <Botao variante="secundario" tamanho="p" onClick={acoesRecorte.cancelar}>
                Cancelar
              </Botao>
            </div>
          </>
        ) : (
          <>
            <div className="flex gap-2">
              <Botao variante="secundario" tamanho="p" icone="recortar" className="flex-1" onClick={acoesRecorte.abrir} disabled={!p.clipes.length}>
                {p.recorte ? 'Ajustar crop' : 'Crop'}
              </Botao>
              {p.recorte ? (
                <Botao variante="fantasma" tamanho="p" onClick={() => mudar({ recorte: null })}>
                  Remover crop
                </Botao>
              ) : null}
            </div>
            <p className="text-xs text-fraca tabular-nums">
              Vídeo final: {final.w} × {final.h} px
            </p>
          </>
        )}
      </Bloco>
      <Bloco titulo="Rotação e flip">
        <div className="flex gap-2">
          <Botao variante="secundario" tamanho="p" className="flex-1" onClick={() => mudar((x) => ({ girar: (x.girar + 270) % 360, recorte: null }))} aria-label="Rotacionar 90° anti-horário">
            ↺ 90°
          </Botao>
          <Botao variante="secundario" tamanho="p" className="flex-1" onClick={() => mudar((x) => ({ girar: (x.girar + 90) % 360, recorte: null }))} aria-label="Rotacionar 90° horário">
            ↻ 90°
          </Botao>
          <Botao variante={p.espelhar ? 'primario' : 'secundario'} tamanho="p" icone="espelhar" onClick={() => mudar((x) => ({ espelhar: !x.espelhar }))} aria-pressed={p.espelhar} aria-label="Flip horizontal" title="Flip horizontal" />
        </div>
      </Bloco>
      <Bloco titulo="Filtros e cor">
        <p className="text-xs text-fraca">Agora cada clipe tem o seu filtro: selecione um clipe na timeline e use a aba Clipe.</p>
      </Bloco>
      <Bloco titulo="Fade (preto)">
        <Deslizante rotulo="Fade in" valor={p.fadeIn} aoMudar={(v) => mudar({ fadeIn: v })} min={0} max={5} passo={0.25} formatar={segundos} />
        <Deslizante rotulo="Fade out" valor={p.fadeOut} aoMudar={(v) => mudar({ fadeOut: v })} min={0} max={5} passo={0.25} formatar={segundos} />
        <p className="text-xs text-fraca">Vale para imagem e áudio. Para mexer só no áudio, use a aba Áudio.</p>
      </Bloco>
    </div>
  )
}

/** Aba Áudio: o editor de áudio dentro do editor de vídeo (master + trilha). */
function PainelAudio({ p, fontes, mudar, abrir, exportarAudio, processando }) {
  const au = { ...PADRAO_AUDIO, ...p.audio }
  const ma = (d) => mudar((x) => ({ audio: { ...PADRAO_AUDIO, ...x.audio, ...d } }))
  const mu = p.musica ? { fadeIn: 0, fadeOut: 0, ducking: false, ...p.musica } : null
  const mm = (d) => mudar((x) => ({ musica: { ...x.musica, ...d } }))
  return (
    <div className="flex flex-col gap-6">
      <Bloco titulo="Master (áudio do vídeo)">
        <Deslizante rotulo="Ganho (volume)" valor={Math.round(au.volume * 100)} aoMudar={(v) => ma({ volume: v / 100 })} min={0} max={200} passo={5} formatar={(v) => `${v}%`} dica={au.volume > 1 ? 'Acima de 100% o ganho vale na exportação; a prévia toca no máximo em 100%.' : undefined} />
        <Caixa rotulo="Mudo (mute)" marcado={au.mudo} aoMudar={(v) => ma({ mudo: v })} />
        <Segmentado
          rotulo="Noise reduction"
          valor={au.ruido}
          aoMudar={(v) => ma({ ruido: v })}
          opcoes={[
            { valor: 'nao', rotulo: 'Off' },
            { valor: 'leve', rotulo: 'Leve' },
            { valor: 'medio', rotulo: 'Média' },
            { valor: 'forte', rotulo: 'Forte' },
          ]}
        />
        <Caixa rotulo="Voice enhance (EQ + compressor)" dica="Realça a voz e deixa o volume mais constante." marcado={au.voz} aoMudar={(v) => ma({ voz: v })} />
        <Segmentado
          rotulo="Normalização (loudness)"
          valor={au.normalizar}
          aoMudar={(v) => ma({ normalizar: v })}
          opcoes={[
            { valor: 'nao', rotulo: 'Off' },
            { valor: 'streaming', rotulo: '-14 LUFS' },
            { valor: 'podcast', rotulo: '-16 LUFS' },
          ]}
          dica="-14 LUFS: YouTube, Spotify, Instagram. -16 LUFS: podcast e voz."
        />
        <Deslizante rotulo="Fade in do áudio" valor={au.fadeIn} aoMudar={(v) => ma({ fadeIn: v })} min={0} max={5} passo={0.25} formatar={segundos} />
        <Deslizante rotulo="Fade out do áudio" valor={au.fadeOut} aoMudar={(v) => ma({ fadeOut: v })} min={0} max={5} passo={0.25} formatar={segundos} />
        {au.ruido !== 'nao' || au.voz || au.normalizar !== 'nao' ? <p className="text-xs text-fraca">Noise reduction, voice enhance e normalização são aplicados na exportação.</p> : null}
      </Bloco>

      <Bloco titulo="Trilha (música ou narração)">
        {mu ? (
          <>
            <p className="truncate text-sm font-semibold text-tinta">{fontes[mu.fonte]?.arquivo.name}</p>
            <Deslizante rotulo="Volume da trilha" valor={Math.round(mu.volume * 100)} aoMudar={(v) => mm({ volume: v / 100 })} min={0} max={100} formatar={(v) => `${v}%`} />
            <Deslizante rotulo="Volume do vídeo" valor={Math.round(mu.volumeOriginal * 100)} aoMudar={(v) => mm({ volumeOriginal: v / 100 })} min={0} max={100} formatar={(v) => (v ? `${v}%` : 'mudo')} />
            <Caixa rotulo="Ducking automático" dica="A trilha abaixa sozinha quando há fala no vídeo (aplicado na exportação)." marcado={mu.ducking} aoMudar={(v) => mm({ ducking: v })} />
            <Caixa rotulo="Loop até o fim do vídeo" marcado={mu.repetir} aoMudar={(v) => mm({ repetir: v, duracao: null })} />
            {(() => {
              const tm = trechoMusica(mu, fontes[mu.fonte], duracaoTotal(p))
              return (
                <div className="flex gap-2">
                  <CampoTempo rotulo="Começa em" valor={tm.inicio} aoMudar={(v) => mm({ inicio: Math.max(0, v) })} />
                  <CampoTempo rotulo="Do arquivo, a partir de" valor={tm.corte} aoMudar={(v) => mm({ corte: Math.max(0, Math.min(v, (fontes[mu.fonte]?.duracao ?? v + 1) - 0.3)), duracao: null })} />
                </div>
              )
            })()}
            <p className="text-xs text-fraca">Na timeline: arraste a trilha para mudar onde ela começa e as pontas para escolher o trecho.</p>
            <Deslizante rotulo="Fade in da trilha" valor={mu.fadeIn} aoMudar={(v) => mm({ fadeIn: v })} min={0} max={5} passo={0.25} formatar={segundos} />
            <Deslizante rotulo="Fade out da trilha" valor={mu.fadeOut} aoMudar={(v) => mm({ fadeOut: v })} min={0} max={5} passo={0.25} formatar={(v) => (v ? `${v.toLocaleString('pt-BR')} s` : 'auto')} />
            <div className="flex gap-2">
              <Botao variante="secundario" tamanho="p" icone="refazer" onClick={abrir}>
                Trocar
              </Botao>
              <Botao variante="perigo" tamanho="p" icone="apagar" onClick={() => mudar({ musica: null })}>
                Remover trilha
              </Botao>
            </div>
          </>
        ) : (
          <>
            <p className="text-sm text-fraca">Coloque uma música ou narração por baixo do vídeo.</p>
            <Botao variante="secundario" icone="musica" onClick={abrir} disabled={!p.clipes.length}>
              Adicionar trilha
            </Botao>
          </>
        )}
      </Bloco>

      <Bloco titulo="Exportar">
        <Botao variante="secundario" icone="baixar" onClick={exportarAudio} disabled={!p.clipes.length || processando}>
          Exportar só o áudio (MP3)
        </Botao>
      </Bloco>
    </div>
  )
}

/* ─── Editor ─────────────────────────────────────────────────────────────── */

/**
 * Editor de vídeo: vários clipes em sequência, recorte livre, velocidade
 * livre, camadas (texto, imagem, vídeo sobreposto, desfoque), cores, fades e
 * música — tudo com prévia ao vivo no player próprio.
 */
export default function EditorVideo() {
  const [p, setP] = useState(PADRAO)
  const [fontes, setFontes] = useState({})
  const [selecao, setSelecao] = useState(null)
  const [aba, setAba] = useState('quadro')
  const [rascunho, setRascunho] = useState(null) // recorte em edição
  const [tocando, setTocando] = useState(false)
  const [lendo, setLendo] = useState(null)
  const [aviso, setAviso] = useState(null)
  const tarefa = useTarefa()
  const historico = useHistorico(p, setP, p.clipes.length > 0)
  const mudar = (m) => setP((x) => ({ ...x, ...(typeof m === 'function' ? m(x) : m) }))
  const mudarClipe = (id, d) => mudar((x) => ({ clipes: x.clipes.map((c) => (c.id === id ? { ...c, ...d } : c)) }))
  const mudarCamada = (id, d) => mudar((x) => ({ camadas: x.camadas.map((c) => (c.id === id ? { ...c, ...d } : c)) }))

  const palco = useRef(null)
  const relogio = useRef(null)
  const linha = useRef(null)
  const caixaPalco = useRef(null)
  const relogioCheio = useRef(null)
  const barraCheia = useRef(null)
  const [cheia, setCheia] = useState(false)
  const [controlesVisiveis, setControlesVisiveis] = useState(true)
  const esconder = useRef(0)
  const [exportando, setExportando] = useState(false)
  const raiz = useRef(null)
  const entradas = { clipes: useRef(null), camada: useRef(null), musica: useRef(null) }

  const vazio = p.clipes.length === 0
  useEmEdicao(!vazio)
  const total = duracaoTotal(p)
  const final = tamanhoFinal(p, fontes)

  // Libera as URLs ao sair.
  const fontesRef = useRef(fontes)
  fontesRef.current = fontes
  useEffect(() => () => Object.values(fontesRef.current).forEach((f) => f.url && URL.revokeObjectURL(f.url)), [])

  // Primeiro vídeo aberto: o editor ocupa a tela.
  useEffect(() => {
    if (!vazio) raiz.current?.scrollIntoView({ block: 'start', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })
  }, [vazio])

  // O palco chama isto a cada quadro: lê o projeto atual pela ref.
  const pAtual = useRef(p)
  pAtual.current = p
  const aoTempo = (t) => {
    const T = duracaoTotal(pAtual.current)
    if (relogio.current) relogio.current.textContent = tempo(t)
    if (relogioCheio.current) relogioCheio.current.textContent = tempo(t)
    if (barraCheia.current) barraCheia.current.style.width = `${T ? Math.min(100, (t / T) * 100) : 0}%`
    linha.current?.mover(t, palco.current?.tocando())
  }
  const agora = () => palco.current?.tempo() ?? 0

  /**
   * Prévia ao arrastar bordas na linha do tempo (como no CapCut): o player
   * pausa e mostra o quadro exato da borda; ao soltar (t = null), volta.
   */
  const tempoAntesDaPrevia = useRef(null)
  const aoPrevia = (t) => {
    if (t == null) {
      if (tempoAntesDaPrevia.current != null) palco.current?.buscar(tempoAntesDaPrevia.current)
      tempoAntesDaPrevia.current = null
      return
    }
    if (tempoAntesDaPrevia.current == null) {
      tempoAntesDaPrevia.current = agora()
      palco.current?.pausar()
    }
    palco.current?.buscar(t)
  }

  /** Lê os arquivos e os coloca onde fazem sentido (clipes, camadas ou música). */
  const adicionar = async (lista, destino) => {
    const arquivos = [...(lista ?? [])].filter((a) => a.size).sort(ordemNatural)
    if (!arquivos.length) return
    setAviso(null)
    const lidas = []
    for (const arquivo of arquivos) {
      const tipo = tipoDe(arquivo)
      if (!tipo) {
        setAviso(`“${arquivo.name}” não é vídeo, imagem nem áudio.`)
        continue
      }
      setLendo(`Lendo ${arquivo.name}`)
      try {
        const fonte = await lerFonte(arquivo, setLendo)
        lidas.push({ id: novoId('f'), ...fonte })
      } catch (e) {
        console.error(e)
        setAviso(`Não foi possível abrir “${arquivo.name}”.`)
      }
    }
    setLendo(null)
    if (!lidas.length) return
    setFontes((f) => ({ ...f, ...Object.fromEntries(lidas.map((x) => [x.id, x])) }))
    lidas.forEach((l) => guardar(`video:arquivo:${l.id}`, l.arquivo))
    const t = agora()
    mudar((x) => {
      const n = { ...x, clipes: [...x.clipes], camadas: [...x.camadas] }
      const T = duracaoTotal(x)
      const fimQ = tamanhoFinal(x, { ...fontesRef.current, ...Object.fromEntries(lidas.map((l) => [l.id, l])) })
      for (const f of lidas) {
        const temClipe = x.clipes.length || n.clipes.length
        if (f.tipo === 'audio' || (destino === 'musica' && f.tipo === 'video')) {
          if (temClipe) n.musica = { fonte: f.id, volume: 0.5, volumeOriginal: 1, repetir: true, fadeIn: 0, fadeOut: 0, ducking: false }
          else setAviso('Comece por um vídeo ou imagem: o áudio entra por baixo dele.')
        } else if (destino === 'clipes' || !temClipe || (destino !== 'camada' && f.tipo === 'video')) {
          // Clipe na trilha principal (imagem fica 3 s; dá para esticar).
          n.clipes.push(f.tipo === 'imagem' ? { id: novoId('c'), fonte: f.id, inicio: 0, fim: 3, velocidade: 1, volume: 1, mudo: false } : { id: novoId('c'), fonte: f.id, inicio: 0, fim: f.duracao || 1, velocidade: 1, volume: 1, mudo: false })
        } else {
          const aspecto = (f.altura / f.largura) * (fimQ.w / fimQ.h)
          const totalAgora = T || duracaoTotal(n)
          if (f.tipo === 'imagem') n.camadas.push({ id: novoId('k'), tipo: 'imagem', fonte: f.id, inicio: 0, fim: totalAgora, x: 0.7, y: 0.05, w: 0.25, h: 0.25 * aspecto, opacidade: 1 })
          else n.camadas.push({ id: novoId('k'), tipo: 'video', fonte: f.id, inicio: Math.min(t, Math.max(0, totalAgora - 1)), fim: Math.min(totalAgora, t + (f.duracao || 5)), x: 0.6, y: 0.6, w: 0.35, h: 0.35 * aspecto, opacidade: 1, volume: 0 })
        }
      }
      return n
    })
    gerarQuadros(lidas)
  }

  /** Quadros da linha do tempo, sem travar a tela. */
  const gerarQuadros = (lista) => {
    const juntar = (id, d) => setFontes((x) => (x[id] ? { ...x, [id]: { ...x[id], ...d } } : x))
    for (const f of lista.filter((l) => l.tipo === 'video')) {
      quadrosDe(f.url, f.duracao)
        .then((d) => juntar(f.id, d))
        .catch(() => {})
    }
    // Onda do som (clipes com áudio e trilhas).
    for (const f of lista.filter((l) => l.tipo === 'audio' || (l.tipo === 'video' && l.temAudio))) {
      picosDe(f.arquivo)
        .then((d) => d && juntar(f.id, d))
        .catch(() => {})
    }
  }

  // ─── Rascunho: recupera ao abrir e salva a cada mudança ───────────────────
  const restaurando = useRef(true)
  const salvou = useRef(false)
  const [recuperado, setRecuperado] = useState(null)
  useEffect(() => {
    let vivo = true
    ;(async () => {
      const salvo = await ler('video:projeto')
      if (!vivo) return
      if (!salvo?.p?.clipes?.length) {
        restaurando.current = false
        return
      }
      setLendo('Recuperando a sua edição')
      const novas = {}
      for (const id of Object.keys(salvo.fontes ?? {})) {
        const arquivo = await ler(`video:arquivo:${id}`)
        if (!arquivo) continue
        try {
          novas[id] = { id, ...(await lerFonte(arquivo)) }
        } catch {
          /* arquivo que não abre mais: fica de fora */
        }
      }
      if (!vivo) return
      const p2 = {
        ...PADRAO,
        ...salvo.p,
        clipes: salvo.p.clipes.filter((c) => novas[c.fonte]).map((c) => (c.cor || !temCor(salvo.p.cor) ? c : { ...c, cor: { ...PADRAO_COR, ...salvo.p.cor } })),
        cor: { ...PADRAO_COR },
        camadas: (salvo.p.camadas ?? []).filter((c) => c.tipo === 'texto' || c.tipo === 'desfoque' || novas[c.fonte]),
        musica: salvo.p.musica && novas[salvo.p.musica.fonte] ? salvo.p.musica : null,
      }
      reservarIds([...Object.keys(novas), ...p2.clipes.map((c) => c.id), ...p2.camadas.map((c) => c.id)])
      setFontes(novas)
      setP(p2)
      setLendo(null)
      historico.reiniciar()
      if (p2.clipes.length) setRecuperado(salvo.salvoEm ?? Date.now())
      salvou.current = true
      restaurando.current = false
      gerarQuadros(Object.values(novas))
    })()
    return () => {
      vivo = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useEffect(() => {
    if (restaurando.current) return undefined
    const espera = setTimeout(() => {
      if (!p.clipes.length) {
        if (salvou.current) apagarTudo('video:')
        salvou.current = false
        return undefined
      }
      salvou.current = true
      const meta = Object.fromEntries(Object.entries(fontes).map(([id, x]) => [id, { tipo: x.tipo, nome: x.arquivo.name }]))
      return guardar('video:projeto', { p, fontes: meta, salvoEm: Date.now() })
    }, 500)
    return () => clearTimeout(espera)
  }, [p, fontes])

  const novaCamada = (tipo, { t = agora(), pos } = {}) => {
    if (vazio) return
    const ini = Math.min(t, Math.max(0, total - 1))
    const id = novoId('k')
    if (tipo === 'texto') {
      const x0 = pos ? Math.min(Math.max(0, pos.x - 0.3), 0.4) : 0.1
      mudar((x) => ({ camadas: [...x.camadas, { id, tipo, inicio: ini, fim: Math.min(total, ini + 3), x: x0, y: pos ? Math.min(pos.y, 0.9) : 0.72, w: pos ? 0.6 : 0.8, h: 0.15, texto: 'Seu texto aqui', tamanho: 0.07, cor: '#ffffff', negrito: true, alinhar: 'centro', fundo: true, corFundo: '#000000', opacidadeFundo: 0.55, opacidade: 1 }] }))
    } else {
      mudar((x) => ({ camadas: [...x.camadas, { id, tipo: 'desfoque', inicio: pos ? 0 : ini, fim: total, x: pos ? Math.min(Math.max(0, pos.x - 0.15), 0.7) : 0.35, y: pos ? Math.min(Math.max(0, pos.y - 0.15), 0.7) : 0.3, w: 0.3, h: 0.3 }] }))
    }
    setSelecao({ tipo: 'camada', id })
    setAba('camada')
  }

  const selecionar = (s) => {
    setSelecao(s)
    if (s?.tipo === 'clipe') setAba('clipe')
    else if (s?.tipo === 'camada') setAba('camada')
    else if (s?.tipo === 'musica') setAba('musica')
    else if (s?.tipo === 'transicao') setAba('clipe')
  }

  // Clique numa área vazia (fora de botões, campos, painel e itens) tira a seleção.
  useEffect(() => {
    if (!selecao) return undefined
    const aoApertar = (e) => {
      const alvo = e.target
      if (e.button !== 0 || !(alvo instanceof Element)) return
      if (alvo.closest('button, a, input, select, textarea, label, summary, [role=button], [role=slider], [role=radio], [role=tab], [role=menu], [role=menuitem], [role=dialog], dialog,[role=group], [contenteditable], aside, [data-palco], [data-manter-selecao]')) return
      // Clique na barra de rolagem de uma área com scroll: não é "clicar fora".
      if (alvo.clientWidth && (e.offsetX > alvo.clientWidth || e.offsetY > alvo.clientHeight)) return
      setSelecao(null)
    }
    document.addEventListener('pointerdown', aoApertar, true)
    return () => document.removeEventListener('pointerdown', aoApertar, true)
  }, [selecao])

  /** Baixa um arquivo gerado sem sair do editor. */
  const baixarArquivo = (blob, nome) => {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = nome
    document.body.append(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 60_000)
  }
  const copiado = useRef(null)

  const acoes = {
    /** Q / W (como no CapCut): corta do começo do clipe até o cursor, ou do cursor até o fim. */
    apararNoCursor: (lado) => {
      const t = agora()
      const loc = localizar(p, t)
      const c = p.clipes[loc.indice]
      if (!c) return
      const imagem = fontes[c.fonte]?.tipo === 'imagem'
      const passou = t - loc.inicio
      const dur = (c.fim - c.inicio) / c.velocidade
      if (passou < 0.05 || dur - passou < 0.05) {
        setAviso('Posicione o cursor no meio de um clipe.')
        return
      }
      if (lado === 'antes') {
        mudarClipe(c.id, imagem ? { fim: c.fim - passou } : { inicio: loc.local })
        requestAnimationFrame(() => palco.current?.buscar(loc.inicio))
      } else mudarClipe(c.id, imagem ? { fim: passou } : { fim: loc.local })
      selecionar({ tipo: 'clipe', id: c.id })
    },
    /** Congela o quadro do cursor: vira uma imagem de 2 s no meio do clipe. */
    congelar: async () => {
      const t = agora()
      const loc = localizar(p, t)
      const c = p.clipes[loc.indice]
      if (!c) return
      palco.current?.pausar()
      palco.current?.buscar(t)
      const blob = await palco.current?.capturar()
      if (!blob) {
        setAviso('Não foi possível capturar este quadro.')
        return
      }
      const arquivo = new File([blob], `quadro-${tempo(t).replace(/[:.]/g, '-')}.png`, { type: 'image/png' })
      const fonte = { id: novoId('f'), ...(await lerFonte(arquivo)) }
      setFontes((f) => ({ ...f, [fonte.id]: fonte }))
      guardar(`video:arquivo:${fonte.id}`, arquivo)
      const congelado = { id: novoId('c'), fonte: fonte.id, inicio: 0, fim: 2, velocidade: 1, volume: 1, mudo: false, cor: c.cor, enquadro: c.enquadro }
      const resto = { id: novoId('c') }
      const imagem = fontes[c.fonte]?.tipo === 'imagem'
      mudar((x) => ({
        clipes: x.clipes.flatMap((y) => {
          if (y.id !== c.id) return [y]
          if (imagem || y.fim - loc.local < 0.05) return [y, congelado]
          if (loc.local - y.inicio < 0.05) return [congelado, y]
          return [{ ...y, fim: loc.local, transicao: null }, congelado, { ...y, ...resto, inicio: loc.local }]
        }),
      }))
      selecionar({ tipo: 'clipe', id: congelado.id })
    },
    /** Salva o quadro do cursor como PNG, com textos e camadas (como no vídeo final). */
    salvarQuadro: async () => {
      const t = agora()
      const pq = projetoNoInstante(p, fontes, t)
      if (!pq) return
      palco.current?.pausar()
      setLendo('Gerando a imagem do quadro')
      try {
        await document.fonts?.ready
        const { blob } = await exportarProjeto(pq, fontes, { progresso: () => {} }, null, { quadroPng: true })
        baixarArquivo(blob, `${nomeArquivo}-${tempo(t).replace(/[:.]/g, '-')}.png`)
      } catch (erro) {
        console.error(erro)
        setAviso(erro?.mensagem ?? 'Não foi possível salvar este quadro.')
      } finally {
        setLendo(null)
      }
    },
    copiar: () => {
      if (selecao?.tipo === 'camada') copiado.current = { tipo: 'camada', dado: p.camadas.find((c) => c.id === selecao.id) }
      else if (selecao?.tipo === 'clipe') copiado.current = { tipo: 'clipe', dado: p.clipes.find((c) => c.id === selecao.id) }
    },
    colar: () => {
      const cp = copiado.current
      if (!cp?.dado) return
      if (cp.tipo === 'camada') {
        const id = novoId('k')
        const d = cp.dado.fim - cp.dado.inicio
        const ini = Math.min(agora(), Math.max(0, total - Math.min(d, total)))
        mudar((x) => ({ camadas: [...x.camadas, { ...cp.dado, id, inicio: ini, fim: Math.min(total, ini + d) }] }))
        selecionar({ tipo: 'camada', id })
      } else if (fontes[cp.dado.fonte]) {
        const id = novoId('c')
        const depois = selecao?.tipo === 'clipe' ? selecao.id : null
        mudar((x) => {
          const i = depois ? x.clipes.findIndex((c) => c.id === depois) : x.clipes.length - 1
          const clipes = [...x.clipes]
          clipes.splice(i + 1, 0, { ...cp.dado, id })
          return { clipes }
        })
        selecionar({ tipo: 'clipe', id })
      }
    },
    dividir: () => {
      const t = agora()
      const loc = localizar(p, t)
      const c = p.clipes[loc.indice]
      if (!c || loc.local <= c.inicio + 0.1 || loc.local >= c.fim - 0.1) {
        setAviso('Posicione o cursor no meio de um clipe para dividir.')
        return
      }
      const novo = { ...c, id: novoId('c'), inicio: loc.local }
      // A transição (para o próximo) fica com a segunda parte.
      mudar((x) => ({ clipes: x.clipes.flatMap((y) => (y.id === c.id ? [{ ...y, fim: loc.local, transicao: null }, novo] : [y])) }))
      selecionar({ tipo: 'clipe', id: novo.id })
    },
    duplicar: (id) => mudar((x) => ({ clipes: x.clipes.flatMap((c) => (c.id === id ? [c, { ...c, id: novoId('c') }] : [c])) })),
    mover: (id, d) =>
      mudar((x) => {
        const i = x.clipes.findIndex((c) => c.id === id)
        const j = i + d
        if (j < 0 || j >= x.clipes.length) return {}
        const clipes = [...x.clipes]
        ;[clipes[i], clipes[j]] = [clipes[j], clipes[i]]
        return { clipes }
      }),
    reordenar: (id, destino) =>
      mudar((x) => {
        const c = x.clipes.find((y) => y.id === id)
        if (!c) return {}
        const clipes = x.clipes.filter((y) => y.id !== id)
        clipes.splice(Math.min(Math.max(0, destino), clipes.length), 0, c)
        return { clipes }
      }),
    ordem: (id, d) =>
      mudar((x) => {
        const i = x.camadas.findIndex((c) => c.id === id)
        const j = Math.min(Math.max(0, i + d), x.camadas.length - 1)
        const camadas = [...x.camadas]
        const [c] = camadas.splice(i, 1)
        camadas.splice(j, 0, c)
        return { camadas }
      }),
    remover: (s) => {
      if (!s) return
      if (s.tipo === 'clipe') mudar((x) => ({ clipes: x.clipes.filter((c) => c.id !== s.id) }))
      else if (s.tipo === 'camada') mudar((x) => ({ camadas: x.camadas.filter((c) => c.id !== s.id) }))
      else if (s.tipo === 'musica') mudar({ musica: null })
      else if (s.tipo === 'transicao') mudarClipe(s.id, { transicao: null })
      setSelecao(null)
    },
  }

  const duplicarCamada = (id) => {
    const nova = novoId('k')
    mudar((x) => ({ camadas: x.camadas.flatMap((c) => (c.id === id ? [c, { ...c, id: nova, x: Math.min(c.x + 0.03, 0.95), y: Math.min(c.y + 0.03, 0.95) }] : [c])) }))
    selecionar({ tipo: 'camada', id: nova })
  }

  const [menu, setMenu] = useState(null)
  const fecharMenu = useCallback(() => setMenu(null), [])
  /** Monta o menu conforme o que foi clicado com o botão direito. */
  const abrirMenu = (e, alvo) => {
    if (vazio && alvo.tipo !== 'palco') return
    let titulo
    let itens
    if (alvo.tipo === 'clipe') {
      const i = p.clipes.findIndex((c) => c.id === alvo.id)
      const c = p.clipes[i]
      if (!c) return
      selecionar({ tipo: 'clipe', id: c.id })
      titulo = `Clipe ${i + 1}`
      itens = [
        {
          rotulo: 'Dividir aqui',
          icone: 'cortar',
          atalho: 'S',
          acao: () => {
            palco.current?.buscar(alvo.t)
            acoes.dividir()
          },
        },
        { rotulo: fontes[c.fonte]?.tipo === 'imagem' ? 'Duração…' : 'Velocidade, volume e trim…', icone: 'ajustar', acao: () => selecionar({ tipo: 'clipe', id: c.id }) },
        { rotulo: 'Filtro e cor deste clipe…', icone: 'filtro', acao: () => selecionar({ tipo: 'clipe', id: c.id }) },
        { rotulo: 'Transição para o próximo…', icone: 'transicao', acao: () => selecionar({ tipo: 'transicao', id: c.id }), desativado: i === p.clipes.length - 1 },
        { rotulo: 'Cortar até o cursor', icone: 'cortar', atalho: 'Q', acao: () => acoes.apararNoCursor('antes') },
        { rotulo: 'Cortar a partir do cursor', icone: 'cortar', atalho: 'W', acao: () => acoes.apararNoCursor('depois') },
        { rotulo: 'Congelar quadro (2 s)', icone: 'congelar', acao: acoes.congelar },
        { rotulo: c.mudo ? 'Ativar áudio' : 'Mute', icone: 'semAudio', acao: () => mudarClipe(c.id, { mudo: !c.mudo }), desativado: !fontes[c.fonte]?.temAudio },
        { rotulo: 'Duplicar', icone: 'copiar', acao: () => acoes.duplicar(c.id) },
        { rotulo: 'Mover para antes', acao: () => acoes.mover(c.id, -1), desativado: i === 0 },
        { rotulo: 'Mover para depois', acao: () => acoes.mover(c.id, 1), desativado: i === p.clipes.length - 1 },
        '-',
        { rotulo: 'Excluir clipe', icone: 'apagar', atalho: 'Del', perigo: true, acao: () => acoes.remover({ tipo: 'clipe', id: c.id }) },
      ]
    } else if (alvo.tipo === 'camada') {
      const c = p.camadas.find((x) => x.id === alvo.id)
      if (!c) return
      selecionar({ tipo: 'camada', id: c.id })
      const cursor = agora()
      titulo = c.tipo === 'texto' ? c.texto.split('\n')[0] || 'Texto' : { imagem: 'Camada · imagem', video: 'Camada · vídeo', desfoque: 'Blur' }[c.tipo]
      itens = [
        { rotulo: 'Editar', icone: 'caneta', acao: () => selecionar({ tipo: 'camada', id: c.id }) },
        { rotulo: 'Duplicar', icone: 'copiar', atalho: 'Ctrl+D', acao: () => duplicarCamada(c.id) },
        { rotulo: 'Copiar', atalho: 'Ctrl+C', acao: () => (copiado.current = { tipo: 'camada', dado: c }) },
        '-',
        { rotulo: 'Começar no cursor', icone: 'tempo', acao: () => mudarCamada(c.id, { inicio: Math.min(cursor, c.fim - 0.2) }), desativado: cursor >= c.fim - 0.2 },
        { rotulo: 'Terminar no cursor', icone: 'tempo', acao: () => mudarCamada(c.id, { fim: Math.max(cursor, c.inicio + 0.2) }), desativado: cursor <= c.inicio + 0.2 },
        { rotulo: 'Aparecer no vídeo todo', acao: () => mudarCamada(c.id, { inicio: 0, fim: total }) },
        '-',
        { rotulo: 'Trazer para frente', icone: 'camadas', acao: () => acoes.ordem(c.id, 1) },
        { rotulo: 'Enviar para trás', acao: () => acoes.ordem(c.id, -1) },
        '-',
        { rotulo: 'Excluir camada', icone: 'apagar', atalho: 'Del', perigo: true, acao: () => acoes.remover({ tipo: 'camada', id: c.id }) },
      ]
    } else if (alvo.tipo === 'musica') {
      selecionar({ tipo: 'musica' })
      titulo = 'Trilha de áudio'
      itens = [
        { rotulo: 'Volume e opções…', icone: 'ajustar', acao: () => selecionar({ tipo: 'musica' }) },
        { rotulo: p.musica?.repetir ? 'Desligar loop' : 'Loop até o fim', icone: 'repetir', acao: () => mudar((x) => ({ musica: { ...x.musica, repetir: !x.musica.repetir } })) },
        { rotulo: 'Trocar trilha', icone: 'musica', acao: () => entradas.musica.current?.click() },
        '-',
        { rotulo: 'Excluir trilha', icone: 'apagar', perigo: true, acao: () => acoes.remover({ tipo: 'musica' }) },
      ]
    } else if (alvo.tipo === 'palco') {
      if (vazio) {
        itens = [{ rotulo: 'Escolher vídeos ou imagens', icone: 'arquivoMais', acao: () => entradas.clipes.current?.click() }]
      } else {
        itens = [
          { rotulo: palco.current?.tocando() ? 'Pausar' : 'Tocar', icone: palco.current?.tocando() ? 'pausa' : 'play', atalho: 'Espaço', acao: () => palco.current?.alternar() },
          '-',
          { rotulo: 'Texto aqui', icone: 'texto', acao: () => novaCamada('texto', { pos: alvo.pos }) },
          { rotulo: 'Blur aqui', icone: 'borracha', acao: () => novaCamada('desfoque', { pos: alvo.pos }) },
          { rotulo: 'Camada (imagem, vídeo, GIF)', icone: 'camadas', acao: () => entradas.camada.current?.click() },
          '-',
          { rotulo: 'Crop', icone: 'recortar', acao: acoesRecorte.abrir },
          { rotulo: 'Rotacionar 90°', icone: 'girar', acao: () => mudar((x) => ({ girar: (x.girar + 90) % 360, recorte: null })) },
          { rotulo: 'Dividir no cursor', icone: 'cortar', atalho: 'S', acao: acoes.dividir },
          { rotulo: 'Congelar quadro (2 s)', icone: 'congelar', acao: acoes.congelar },
          { rotulo: 'Salvar este quadro (PNG)', icone: 'imagem', acao: acoes.salvarQuadro },
        ]
      }
    } else {
      itens = [
        { rotulo: 'Ir para cá', icone: 'seta', acao: () => palco.current?.buscar(alvo.t) },
        {
          rotulo: 'Dividir aqui',
          icone: 'cortar',
          acao: () => {
            palco.current?.buscar(alvo.t)
            acoes.dividir()
          },
        },
        { rotulo: 'Texto aqui', icone: 'texto', acao: () => novaCamada('texto', { t: alvo.t }) },
        { rotulo: 'Blur aqui', icone: 'borracha', acao: () => novaCamada('desfoque', { t: alvo.t }) },
        { rotulo: 'Adicionar clipe no fim', icone: 'mais', acao: () => entradas.clipes.current?.click() },
      ]
    }
    setMenu({ x: e.clientX, y: e.clientY, titulo, itens })
  }

  const acoesRecorte = {
    abrir: () => {
      palco.current?.pausar()
      setRascunho(p.recorte ?? { x: 0.05, y: 0.05, w: 0.9, h: 0.9 })
      setAba('quadro')
    },
    aplicar: () => {
      const r = rascunho
      setRascunho(null)
      mudar({ recorte: r.w > 0.995 && r.h > 0.995 ? null : r })
    },
    cancelar: () => setRascunho(null),
  }

  const redefinir = () => {
    palco.current?.pausar()
    setRascunho(null)
    setSelecao(null)
    // Mantém os clipes (inteiros, na ordem) e zera todo o resto.
    mudar((x) => ({ ...PADRAO, clipes: x.clipes.map((c) => ({ ...c, inicio: 0, fim: fontes[c.fonte]?.duracao ?? c.fim, velocidade: 1, volume: 1, mudo: false, cor: undefined, transicao: undefined, enquadro: undefined })) }))
    palco.current?.buscar(0)
  }
  const recomecar = () => {
    palco.current?.pausar()
    setRecuperado(null)
    apagarTudo('video:')
    Object.values(fontes).forEach((f) => f.url && URL.revokeObjectURL(f.url))
    setFontes({})
    setP(PADRAO)
    setSelecao(null)
    setRascunho(null)
    historico.reiniciar()
    tarefa.reiniciar()
  }

  // ─── Tela cheia do player ─────────────────────────────────────────────────
  useEffect(() => {
    const mudou = () => {
      const agoraCheia = document.fullscreenElement === caixaPalco.current && Boolean(caixaPalco.current)
      setCheia(agoraCheia)
      setControlesVisiveis(true)
      if (agoraCheia) {
        setSelecao(null)
        // O botão clicado não fica com o foco: o espaço passa a tocar/pausar.
        document.activeElement?.blur?.()
      }
      requestAnimationFrame(() => aoTempo(agora()))
    }
    document.addEventListener('fullscreenchange', mudou)
    return () => document.removeEventListener('fullscreenchange', mudou)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const alternarTelaCheia = () => {
    if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {})
    else caixaPalco.current?.requestFullscreen?.().catch(() => setAviso('O navegador não deixou abrir em tela cheia.'))
  }
  const mostrarControles = () => {
    setControlesVisiveis(true)
    clearTimeout(esconder.current)
    esconder.current = setTimeout(() => palco.current?.tocando() && setControlesVisiveis(false), 2600)
  }
  useEffect(() => {
    if (cheia && tocando) mostrarControles()
    else setControlesVisiveis(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cheia, tocando])
  /** Barra de progresso da tela cheia: clicar/arrastar percorre o vídeo. */
  const percorrerCheia = (e) => {
    const barra = e.currentTarget
    const ir = (clientX) => {
      const r = barra.getBoundingClientRect()
      palco.current?.buscar(Math.min(Math.max(0, (clientX - r.left) / r.width), 1) * total)
    }
    ir(e.clientX)
    try {
      barra.setPointerCapture(e.pointerId)
    } catch {
      /* evento sintético */
    }
    const mover = (ev) => ir(ev.clientX)
    const soltar = () => {
      barra.removeEventListener('pointermove', mover)
      barra.removeEventListener('pointerup', soltar)
    }
    barra.addEventListener('pointermove', mover)
    barra.addEventListener('pointerup', soltar)
  }

  // Atalhos: espaço, S (dividir), Delete, setas, Ctrl+Z / Ctrl+Shift+Z, Enter/Esc no recorte.
  const teclas = useRef(null)
  teclas.current = (e) => {
    if ((e.ctrlKey || e.metaKey) && !e.altKey) {
      if (e.target.closest?.('input:not([type=range]):not([type=checkbox]), textarea, [contenteditable]')) return
      const k = e.key.toLowerCase()
      if (k === 'z' && !e.shiftKey) {
        e.preventDefault()
        historico.desfazer()
      } else if ((k === 'z' && e.shiftKey) || k === 'y') {
        e.preventDefault()
        historico.refazer()
      } else if (k === 'c' && selecao && !vazio) acoes.copiar()
      else if (k === 'v' && !vazio) {
        e.preventDefault()
        acoes.colar()
      } else if (k === 'd' && selecao && !vazio) {
        e.preventDefault()
        if (selecao.tipo === 'clipe') acoes.duplicar(selecao.id)
        else if (selecao.tipo === 'camada') duplicarCamada(selecao.id)
      }
      return
    }
    if (e.target.closest?.('input, textarea, select, button, [role=slider], [contenteditable]') || e.altKey || vazio) return
    if (rascunho && e.key === 'Enter') acoesRecorte.aplicar()
    else if (rascunho && e.key === 'Escape') acoesRecorte.cancelar()
    else if (e.key === 'Escape' && selecao) setSelecao(null)
    else if (e.code === 'Space') {
      e.preventDefault()
      palco.current?.alternar()
    } else if (e.key === 's' || e.key === 'S') acoes.dividir()
    else if (e.key === 'q' || e.key === 'Q') acoes.apararNoCursor('antes')
    else if (e.key === 'w' || e.key === 'W') acoes.apararNoCursor('depois')
    else if (e.key === ',' || e.key === '.') {
      // Quadro a quadro.
      palco.current?.pausar()
      palco.current?.buscar(agora() + (e.key === ',' ? -1 : 1) / (p.fps || 30))
    } else if (e.key === 'Home') palco.current?.buscar(0)
    else if (e.key === 'End') palco.current?.buscar(total)
    else if (e.key === 'f' || e.key === 'F') alternarTelaCheia()
    else if (e.key === 'Delete' || e.key === 'Backspace') acoes.remover(selecao)
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault()
      palco.current?.buscar(agora() + (e.key === 'ArrowLeft' ? -1 : 1) * (e.shiftKey ? 5 : 1))
    }
  }
  useEffect(() => {
    const f = (e) => teclas.current(e)
    addEventListener('keydown', f)
    return () => removeEventListener('keydown', f)
  }, [])

  // Nome do arquivo exportado: o que a pessoa escolheu ou "<primeiro arquivo>-editado".
  const primeiroArquivo = p.clipes.length ? fontes[p.clipes[0].fonte]?.arquivo.name : null
  const nomePadrao = primeiroArquivo ? `${primeiroArquivo.replace(/\.[^.]+$/, '')}-editado` : 'video-editado'
  const nomeArquivo = p.nome || nomePadrao

  const exportar = (escolhas) => {
    setExportando(false)
    if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {})
    const q = { ...p, ...escolhas }
    mudar(escolhas) // as escolhas ficam salvas no projeto
    tarefa.executar(async (ctx) => {
      palco.current?.pausar()
      await document.fonts?.ready
      const { blob, motor } = await exportarProjeto(q, fontes, ctx)
      const fq = tamanhoFinal(q, fontes)
      const g = quadroGif(q, fq)
      const detalhe = q.formato === 'mp3' ? `MP3 · ${tempo(total)}` : q.formato === 'gif' ? `GIF · ${g.w} × ${g.h} px · ${g.fps} fps · ${tempo(total)}` : `${fq.w} × ${fq.h} px · ${q.fps || 30} fps · ${tempo(total)}${motor === 'navegador' ? ' · acelerado pelo navegador' : ''}`
      return [{ nome: `${escolhas.nome}.${q.formato}`, blob, detalhe }]
    }, 'Preparando')
  }
  const exportarAudio = () =>
    tarefa.executar(async (ctx) => {
      palco.current?.pausar()
      const { blob } = await exportarProjeto(p, fontes, ctx, null, { soAudio: true })
      return [{ nome: `${nomeArquivo}.mp3`, blob, detalhe: `MP3 · ${tempo(total)}` }]
    }, 'Preparando')

  if (tarefa.fase === 'pronto') return <Resultados itens={tarefa.resultado} duracao={tarefa.duracao} aoAjustar={tarefa.reiniciar} aoReiniciar={recomecar} rotuloNovo="Outro vídeo" />

  const processando = tarefa.fase === 'processando'
  const clipeSel = selecao?.tipo === 'clipe' ? p.clipes.find((c) => c.id === selecao.id) : p.clipes[0]
  const camadaSel = selecao?.tipo === 'camada' ? p.camadas.find((c) => c.id === selecao.id) : null
  const nomes = p.clipes.map((c) => fontes[c.fonte]?.arquivo.name).filter(Boolean)
  const ABAS = [
    { valor: 'quadro', rotulo: 'Quadro' },
    { valor: 'clipe', rotulo: 'Clipe' },
    { valor: 'camada', rotulo: 'Camada' },
    { valor: 'musica', rotulo: 'Áudio' },
  ]
  const botaoAdd = 'inline-flex h-9 items-center gap-1.5 rounded-lg border border-borda bg-superficie px-3 text-[0.8125rem] font-semibold text-texto transition-colors hover:border-borda-forte hover:text-tinta disabled:opacity-40'

  const entradaArquivo = (chave, accept, destino, multiplo = false) => (
    <input
      ref={entradas[chave]}
      type="file"
      accept={accept}
      multiple={multiplo}
      className="sr-only"
      tabIndex={-1}
      aria-label={`Escolher ${chave}`}
      onChange={(e) => {
        adicionar(e.target.files, destino)
        e.target.value = ''
      }}
    />
  )
  const aceitaVisual = [...new Set([...EXTENSOES_VIDEO, 'gif', ...EXTENSOES_IMAGEM])].map((e) => `.${e}`).join(',')

  return (
    <div
      ref={raiz}
      className="flex flex-col gap-2 lg:h-[calc(100dvh-5.5rem)] lg:min-h-[36rem]"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault()
        adicionar(e.dataTransfer.files)
      }}
    >
      {entradaArquivo('clipes', aceitaVisual, 'clipes', true)}
      {entradaArquivo('camada', aceitaVisual, 'camada')}
      {entradaArquivo('musica', [...EXTENSOES_AUDIO, ...EXTENSOES_VIDEO].map((e) => `.${e}`).join(','), 'musica')}

      {recuperado ? (
        <Aviso
          tom="info"
          aoFechar={() => setRecuperado(null)}
          acao={
            <Botao variante="secundario" tamanho="p" onClick={recomecar}>
              Começar do zero
            </Botao>
          }
        >
          Recuperamos a edição que você deixou aberta ({haQuanto(recuperado)}). Ela fica salva só neste navegador.
        </Aviso>
      ) : null}

      <section aria-label="Player" className="cartao flex min-h-0 flex-col lg:flex-1">
        {/* Barra do topo */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-borda px-4 py-3 sm:px-5">
          <SeloCategoria categoria="video" icone="arquivoVideo" tamanho="p" />
          <div className="min-w-0 flex-1 basis-40">
            {vazio ? <p className="text-sm font-semibold text-tinta">Nenhum vídeo aberto</p> : <NomeArquivo key={nomeArquivo} nome={nomeArquivo} aoMudar={(n) => mudar({ nome: n })} desativado={processando} />}
            <p className="truncate text-xs text-fraca tabular-nums" title={nomes.join(' + ')}>
              {vazio ? 'Escolha vídeos, imagens ou GIFs para começar' : `${tempo(total)} · ${final.w} × ${final.h} px · ${nomes.length === 1 ? nomes[0] : `${nomes.length} clipes em sequência`}`}
            </p>
          </div>
          <div className="flex items-center gap-0.5">
            <BotaoAcao rotulo="Desfazer (Ctrl+Z)" icone="desfazer" onClick={historico.desfazer} disabled={!historico.podeDesfazer || processando} />
            <BotaoAcao rotulo="Refazer (Ctrl+Shift+Z)" icone="refazerAcao" onClick={historico.refazer} disabled={!historico.podeRefazer || processando} />
            <Botao variante="fantasma" tamanho="p" icone="redefinir" onClick={redefinir} disabled={vazio || processando}>
              Redefinir tudo
            </Botao>
            <Botao variante="fantasma" tamanho="p" icone="refazer" onClick={recomecar} disabled={vazio || processando}>
              Recomeçar
            </Botao>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {processando ? (
              <div className="w-60">
                <Progresso valor={tarefa.progresso} rotulo={tarefa.rotulo} aoCancelar={tarefa.cancelar} />
              </div>
            ) : (
              <Botao icone="baixar" onClick={() => setExportando(true)} disabled={vazio || Boolean(rascunho)}>
                Exportar vídeo
              </Botao>
            )}
          </div>
        </div>

        <div className="grid min-h-0 lg:flex-1 lg:grid-cols-[minmax(0,1fr)_21rem]">
          {/* Palco + controles */}
          <div className="flex min-h-0 min-w-0 flex-col">
            <div
              ref={caixaPalco}
              className={cheia ? `relative bg-black ${controlesVisiveis ? '' : 'cursor-none'}` : 'relative mx-4 mt-3 h-[clamp(12rem,40vh,30rem)] overflow-hidden rounded-xl bg-fundo-suave sm:mx-5 lg:h-auto lg:min-h-[12rem] lg:flex-1'}
              onPointerMove={cheia ? mostrarControles : undefined}
              onDoubleClick={(e) => !e.target.closest('[aria-label^="Camada"]') && !vazio && alternarTelaCheia()}
            >
              {vazio ? (
                <div className="absolute inset-0 z-10 grid place-items-center border-2 border-dashed border-borda-forte bg-fundo-suave">
                  <div className="flex flex-col items-center gap-3 px-4 text-center">
                    {lendo ? (
                      <div className="w-60">
                        <Progresso valor={null} rotulo={lendo} />
                      </div>
                    ) : (
                      <>
                        <Icone nome="filme" tamanho={30} className="text-fraca" />
                        <p className="text-sm font-semibold text-tinta">Solte aqui vídeos, imagens ou GIFs</p>
                        <Botao icone="arquivoMais" onClick={() => entradas.clipes.current?.click()}>
                          Escolher arquivos
                        </Botao>
                        <p className="text-xs text-fraca">Vários arquivos entram em sequência, na ordem dos nomes. Depois é só arrastar para reordenar.</p>
                      </>
                    )}
                  </div>
                </div>
              ) : null}
              <Palco
                ref={palco}
                p={p}
                fontes={fontes}
                selecao={selecao}
                aoSelecionar={selecionar}
                aoMudarCamada={mudarCamada}
                aoMudarClipe={mudarClipe}
                recortando={rascunho ? { valor: rascunho, aoMudar: setRascunho } : null}
                aoTempo={aoTempo}
                aoTocando={setTocando}
                aoMenu={abrirMenu}
                vazio={vazio}
              />
              {lendo && !vazio ? (
                <div className="absolute top-3 left-1/2 w-60 -translate-x-1/2 rounded-xl bg-superficie/95 p-3 shadow">
                  <Progresso valor={null} rotulo={lendo} />
                </div>
              ) : null}

              {/* Controles da tela cheia (somem enquanto toca; voltam ao mexer o mouse) */}
              {cheia ? (
                <div className={`absolute inset-x-0 bottom-0 z-40 bg-gradient-to-t from-black/85 via-black/45 to-transparent px-6 pt-16 pb-5 text-white transition-opacity duration-300 ${controlesVisiveis ? 'opacity-100' : 'pointer-events-none opacity-0'}`}>
                  <div role="slider" tabIndex={0} aria-label="Posição no vídeo" aria-valuemin={0} aria-valuemax={Math.round(total)} aria-valuenow={0} className="group relative h-4 cursor-pointer" onPointerDown={percorrerCheia}>
                    <div className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-white/25 transition-[height] group-hover:h-1.5">
                      <div ref={barraCheia} className="relative h-full rounded-full bg-white">
                        <span className="absolute top-1/2 right-0 size-3.5 translate-x-1/2 -translate-y-1/2 rounded-full bg-white opacity-0 shadow transition-opacity group-hover:opacity-100" />
                      </div>
                    </div>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <button type="button" onClick={() => palco.current?.alternar()} aria-label={tocando ? 'Pausar' : 'Tocar'} title={`${tocando ? 'Pausar' : 'Tocar'} (espaço)`} className="grid size-11 place-items-center rounded-full hover:bg-white/15">
                      <Icone nome={tocando ? 'pausa' : 'play'} tamanho={24} fill="currentColor" className={tocando ? '' : 'translate-x-0.5'} />
                    </button>
                    <button type="button" onClick={() => palco.current?.buscar(0)} aria-label="Voltar ao início" title="Voltar ao início" className="grid size-10 place-items-center rounded-full hover:bg-white/15">
                      <Icone nome="voltarInicio" tamanho={20} />
                    </button>
                    <p className="ml-1 text-base font-semibold tabular-nums">
                      <span ref={relogioCheio}>0:00.0</span>
                      <span className="text-white/60"> / {tempo(total)}</span>
                    </p>
                    <p className="mx-auto truncate px-4 text-sm text-white/70">{nomeArquivo}</p>
                    <button type="button" onClick={alternarTelaCheia} aria-label="Sair da tela cheia" title="Sair da tela cheia (F ou Esc)" className="grid size-10 place-items-center rounded-full hover:bg-white/15">
                      <Icone nome="reduzir" tamanho={20} />
                    </button>
                  </div>
                </div>
              ) : null}
            </div>

            {/* Player próprio: controles no centro, tempo à esquerda */}
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 px-4 pt-3 sm:px-5">
              <p className="font-display text-lg leading-none font-bold text-tinta tabular-nums sm:text-xl">
                <span ref={relogio}>0:00.0</span>
                <span className="text-sm font-semibold text-fraca" title="Duração do vídeo final">
                  {' '}
                  / {tempo(total)}
                </span>
              </p>
              <div className="flex items-center gap-1.5">
                <button type="button" onClick={() => palco.current?.buscar(0)} disabled={vazio} aria-label="Voltar ao início" title="Voltar ao início" className="grid size-10 place-items-center rounded-full text-suave transition-colors hover:bg-superficie-2 hover:text-tinta disabled:opacity-40">
                  <Icone nome="voltarInicio" tamanho={19} />
                </button>
                <button
                  type="button"
                  onClick={() => palco.current?.alternar()}
                  disabled={vazio || Boolean(rascunho)}
                  aria-label={tocando ? 'Pausar' : 'Tocar'}
                  title={`${tocando ? 'Pausar' : 'Tocar'} (espaço)`}
                  className="grid size-12 place-items-center rounded-full bg-marca text-sobre-marca shadow-[var(--shadow-cartao)] transition-[background-color,transform] hover:bg-marca-hover active:scale-95 disabled:opacity-40"
                >
                  <Icone nome={tocando ? 'pausa' : 'play'} tamanho={22} className={tocando ? '' : 'translate-x-0.5'} fill="currentColor" />
                </button>
                <button type="button" onClick={acoes.dividir} disabled={vazio} aria-label="Dividir no cursor" title="Dividir o clipe no cursor (S)" className="grid size-10 place-items-center rounded-full text-suave transition-colors hover:bg-superficie-2 hover:text-tinta disabled:opacity-40">
                  <Icone nome="cortar" tamanho={18} />
                </button>
              </div>
              <div className="flex justify-end gap-0.5">
                <button type="button" onClick={acoes.salvarQuadro} disabled={vazio || Boolean(lendo)} aria-label="Salvar este quadro (PNG)" title="Salvar este quadro como imagem (PNG)" className="grid size-10 place-items-center rounded-full text-suave transition-colors hover:bg-superficie-2 hover:text-tinta disabled:opacity-40">
                  <Icone nome="camera" tamanho={18} />
                </button>
                <button type="button" onClick={alternarTelaCheia} disabled={vazio} aria-label="Tela cheia" title="Tela cheia (F)" className="grid size-10 place-items-center rounded-full text-suave transition-colors hover:bg-superficie-2 hover:text-tinta disabled:opacity-40">
                  <Icone nome="ampliar" tamanho={18} />
                </button>
              </div>
            </div>

            {/* Adicionar */}
            <div className="flex flex-wrap items-center justify-center gap-1.5 px-4 pt-2.5 pb-3 sm:px-5">
              <button type="button" className={botaoAdd} onClick={() => novaCamada('texto')} disabled={vazio} title="Texto por cima do vídeo">
                <Icone nome="texto" tamanho={15} /> Texto
              </button>
              <button type="button" className={botaoAdd} onClick={() => entradas.camada.current?.click()} disabled={vazio} title="Imagem, logo, vídeo ou GIF por cima (overlay / picture-in-picture)">
                <Icone nome="camadas" tamanho={15} /> Camada
              </button>
              <button type="button" className={botaoAdd} onClick={() => novaCamada('desfoque')} disabled={vazio} title="Blur ou pixelate para esconder rosto, placa ou dados">
                <Icone nome="borracha" tamanho={15} /> Blur
              </button>
              <button type="button" className={botaoAdd} onClick={() => entradas.musica.current?.click()} disabled={vazio} title="Música ou narração por baixo do vídeo">
                <Icone nome="musica" tamanho={15} /> Áudio
              </button>
            </div>
          </div>

          {/* Propriedades */}
          <aside aria-label="Propriedades" className={`flex min-h-0 flex-col border-t border-borda lg:border-t-0 lg:border-l ${vazio || processando ? 'pointer-events-none opacity-50' : ''}`} inert={vazio || processando ? true : undefined}>
            <div className="border-b border-borda p-3">
              <Segmentado valor={aba} aoMudar={setAba} opcoes={ABAS} />
            </div>
            <div className="rolagem-fina flex-1 overflow-y-auto p-4">
              {aba === 'quadro' ? <PainelQuadro p={p} mudar={mudar} final={final} recorte={rascunho ? { valor: rascunho, aoMudar: setRascunho } : null} acoesRecorte={acoesRecorte} /> : null}
              {aba === 'clipe' && selecao?.tipo === 'transicao' && p.clipes.some((c) => c.id === selecao.id) ? <PainelTransicao p={p} clipe={p.clipes.find((c) => c.id === selecao.id)} mudarClipe={mudarClipe} mudar={mudar} /> : null}
              {aba === 'clipe' && selecao?.tipo !== 'transicao' ? <PainelClipe p={p} fontes={fontes} clipe={clipeSel} mudarClipe={mudarClipe} mudar={mudar} acoes={acoes} /> : null}
              {aba === 'camada' ? <PainelCamada camada={camadaSel} mudarCamada={mudarCamada} acoes={acoes} total={total} /> : null}
              {aba === 'musica' ? <PainelAudio p={p} fontes={fontes} mudar={mudar} abrir={() => entradas.musica.current?.click()} exportarAudio={exportarAudio} processando={processando} /> : null}
            </div>
          </aside>
        </div>

        {/* Linha do tempo */}
        <div className="border-t border-borda">
          <LinhaDoTempo
            ref={linha}
            p={p}
            fontes={fontes}
            selecao={selecao}
            aoSelecionar={selecionar}
            aoBuscar={(t) => palco.current?.buscar(t)}
            aoMudarClipe={mudarClipe}
            aoMudarCamada={mudarCamada}
            aoReordenar={acoes.reordenar}
            aoAdicionar={() => entradas.clipes.current?.click()}
            aoMenu={abrirMenu}
            aoDividir={acoes.dividir}
            aoRemover={acoes.remover}
            aoPrevia={aoPrevia}
            aoMudarMusica={(d) => mudar((x) => ({ musica: { ...x.musica, ...d } }))}
            agora={agora}
          />
        </div>
      </section>

      <MenuContexto menu={menu} aoFechar={fecharMenu} />
      <DialogoExportar aberto={exportando} aoFechar={() => setExportando(false)} p={p} fontes={fontes} nomePadrao={nomeArquivo} aoExportar={exportar} />

      {aviso ? (
        <Aviso tom="alerta" aoFechar={() => setAviso(null)}>
          {aviso}
        </Aviso>
      ) : null}
      {tarefa.fase === 'erro' ? <Aviso tom="erro">{tarefa.mensagem}</Aviso> : null}

      <p className="flex flex-wrap items-center gap-x-1.5 text-xs text-fraca">
        <span className="size-1.5 rounded-full bg-sucesso" />
        Tudo o que você muda já aparece no player. Na timeline: arraste um clipe para reordenar, as pontas para fazer trim (as partes escondidas aparecem tracejadas) e o + para adicionar vídeo, imagem ou GIF. Botão direito mostra as opções de cada item. Atalhos: espaço toca/pausa · , e . quadro a quadro · S divide · Q/W cortam até/a partir do cursor · F tela cheia · Delete apaga · Ctrl+C/V/D copia, cola e duplica · Ctrl+Z desfaz · Ctrl + roda dá zoom na timeline.
      </p>
    </div>
  )
}

