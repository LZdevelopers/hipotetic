import { useCallback, useEffect, useRef, useState } from 'react'
import { BotaoAcao, CampoTempo, SeletorCompacto, Velocidade, tempo, useHistorico } from '../../componentes/editor/Comum'
import { MenuContexto } from '../../componentes/editor/MenuContexto'
import { Resultados } from '../../componentes/ferramenta/Resultados'
import { Icone } from '../../componentes/Icone'
import { AreaTexto, Aviso, Botao, Caixa, Deslizante, Progresso, Segmentado, SeloCategoria } from '../../componentes/ui'
import { EXTENSOES_AUDIO, EXTENSOES_VIDEO, infoMidia, processarVideo } from '../../motores/midia'
import { EXTENSOES_IMAGEM } from '../../motores/imagem'
import { extensaoDe, trocarExtensao } from '../../nucleo/arquivos'
import { useEmEdicao } from '../../nucleo/edicao'
import { apagarTudo, guardar, haQuanto, ler } from '../../nucleo/rascunho'
import { useTarefa } from '../../nucleo/tarefa'
import { LinhaDoTempo } from './_linha'
import { Palco } from './_palco'
import { FONTES, PADRAO_AUDIO, PADRAO_BLUR, PADRAO_CAMADA, PADRAO_TEXTO, duracaoTotal, exportarProjeto, localizar, tamanhoFinal } from './_projeto'

const PADRAO = { clipes: [], recorte: null, girar: 0, espelhar: false, cor: { brilho: 0, contraste: 1, saturacao: 1 }, fadeIn: 0, fadeOut: 0, camadas: [], musica: null, audio: PADRAO_AUDIO, formato: 'mp4', resolucao: 0, qualidade: 'alta' }
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

/** Quatro quadros pequenos para a linha do tempo. */
async function quadrosDe(url, duracao) {
  const v = document.createElement('video')
  v.muted = true
  v.preload = 'auto'
  v.src = url
  await new Promise((ok, falha) => {
    v.onloadeddata = ok
    v.onerror = falha
  })
  const alto = 72
  const largo = Math.max(1, Math.round((v.videoWidth / v.videoHeight) * alto))
  const cv = document.createElement('canvas')
  cv.width = largo
  cv.height = alto
  const ctx = cv.getContext('2d')
  const saida = []
  for (const f of [0.08, 0.36, 0.64, 0.92]) {
    await new Promise((ok) => {
      v.onseeked = ok
      v.currentTime = Math.max(0, (duracao || 1) * f)
    })
    ctx.drawImage(v, 0, 0, largo, alto)
    saida.push(cv.toDataURL('image/jpeg', 0.6))
  }
  v.removeAttribute('src')
  v.load()
  return saida
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

/* ─── Painéis de propriedades ────────────────────────────────────────────── */

function Bloco({ titulo, children }) {
  return (
    <div className="flex flex-col gap-3">
      {titulo ? <h3 className="text-xs font-semibold tracking-wide text-fraca uppercase">{titulo}</h3> : null}
      {children}
    </div>
  )
}

function PainelClipe({ p, fontes, clipe, mudarClipe, acoes }) {
  if (!clipe) return <p className="text-sm text-fraca">Clique num clipe da linha do tempo para ajustar velocidade, volume e trecho.</p>
  const fonte = fontes[clipe.fonte]
  const i = p.clipes.findIndex((c) => c.id === clipe.id)
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
        <Bloco titulo="Fade">
          <Deslizante rotulo="Fade in" valor={camada.fadeIn} aoMudar={(v) => m({ fadeIn: v })} min={0} max={3} passo={0.25} formatar={segundos} />
          <Deslizante rotulo="Fade out" valor={camada.fadeOut} aoMudar={(v) => m({ fadeOut: v })} min={0} max={3} passo={0.25} formatar={segundos} />
        </Bloco>
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

function PainelQuadro({ p, mudar, recorte, acoesRecorte, final }) {
  return (
    <div className="flex flex-col gap-5">
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
      <Bloco titulo="Correção de cor">
        <Deslizante rotulo="Brilho" valor={Math.round(p.cor.brilho * 100)} aoMudar={(v) => mudar((x) => ({ cor: { ...x.cor, brilho: v / 100 } }))} min={-50} max={50} formatar={(v) => `${v > 0 ? '+' : ''}${v}`} />
        <Deslizante rotulo="Contraste" valor={Math.round(p.cor.contraste * 100)} aoMudar={(v) => mudar((x) => ({ cor: { ...x.cor, contraste: v / 100 } }))} min={50} max={150} formatar={(v) => `${v}%`} />
        <Deslizante rotulo="Saturação" valor={Math.round(p.cor.saturacao * 100)} aoMudar={(v) => mudar((x) => ({ cor: { ...x.cor, saturacao: v / 100 } }))} min={0} max={200} formatar={(v) => (v ? `${v}%` : 'P&B')} />
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
            <Caixa rotulo="Loop até o fim do vídeo" marcado={mu.repetir} aoMudar={(v) => mm({ repetir: v })} />
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
  const cabeca = useRef(null)
  const larguraLinha = useRef(null)
  const escalaLinha = useRef(1)
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
    const T = escalaLinha.current || duracaoTotal(pAtual.current)
    if (relogio.current) relogio.current.textContent = tempo(t)
    if (cabeca.current) cabeca.current.style.left = `${T ? (t / T) * 100 : 0}%`
  }
  const agora = () => palco.current?.tempo() ?? 0

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
    for (const f of lista.filter((l) => l.tipo === 'video')) {
      quadrosDe(f.url, f.duracao)
        .then((quadros) => setFontes((x) => (x[f.id] ? { ...x, [f.id]: { ...x[f.id], quadros } } : x)))
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
        clipes: salvo.p.clipes.filter((c) => novas[c.fonte]),
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
  }

  const acoes = {
    dividir: () => {
      const t = agora()
      const loc = localizar(p, t)
      const c = p.clipes[loc.indice]
      if (!c || loc.local <= c.inicio + 0.1 || loc.local >= c.fim - 0.1) {
        setAviso('Posicione o cursor no meio de um clipe para dividir.')
        return
      }
      const novo = { ...c, id: novoId('c'), inicio: loc.local }
      mudar((x) => ({ clipes: x.clipes.flatMap((y) => (y.id === c.id ? [{ ...y, fim: loc.local }, novo] : [y])) }))
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
        { rotulo: 'Duplicar', icone: 'copiar', acao: () => duplicarCamada(c.id) },
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
    mudar((x) => ({ ...PADRAO, clipes: x.clipes.map((c) => ({ ...c, inicio: 0, fim: fontes[c.fonte]?.duracao ?? c.fim, velocidade: 1, volume: 1, mudo: false })) }))
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
      }
      return
    }
    if (e.target.closest?.('input, textarea, select, button, [role=slider], [contenteditable]') || e.altKey || vazio) return
    if (rascunho && e.key === 'Enter') acoesRecorte.aplicar()
    else if (rascunho && e.key === 'Escape') acoesRecorte.cancelar()
    else if (e.code === 'Space') {
      e.preventDefault()
      palco.current?.alternar()
    } else if (e.key === 's' || e.key === 'S') acoes.dividir()
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

  const exportar = () =>
    tarefa.executar(async (ctx) => {
      palco.current?.pausar()
      await document.fonts?.ready
      const { blob, motor } = await exportarProjeto(p, fontes, ctx)
      const primeiro = fontes[p.clipes[0].fonte].arquivo
      return [{ nome: trocarExtensao(primeiro.name, p.formato, '-editado'), blob, detalhe: `${final.w} × ${final.h} px · ${tempo(total)}${motor === 'navegador' ? ' · acelerado pelo navegador' : ''}` }]
    }, 'Preparando')
  const exportarAudio = () =>
    tarefa.executar(async (ctx) => {
      palco.current?.pausar()
      const { blob } = await exportarProjeto(p, fontes, ctx, null, { soAudio: true })
      const primeiro = fontes[p.clipes[0].fonte].arquivo
      return [{ nome: trocarExtensao(primeiro.name, 'mp3', '-audio'), blob, detalhe: `MP3 · ${tempo(total)}` }]
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
            <p className="truncate text-sm font-semibold text-tinta" title={nomes.join(' + ')}>
              {vazio ? 'Nenhum vídeo aberto' : nomes.length === 1 ? nomes[0] : `${nomes.length} clipes em sequência`}
            </p>
            <p className="text-xs text-fraca tabular-nums">{vazio ? 'Escolha vídeos, imagens ou GIFs para começar' : `${tempo(total)} · ${final.w} × ${final.h} px`}</p>
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
            <SeletorCompacto
              rotulo="Formato do vídeo final"
              valor={p.formato}
              aoMudar={(v) => mudar({ formato: v })}
              opcoes={[
                { valor: 'mp4', rotulo: 'MP4' },
                { valor: 'mov', rotulo: 'MOV' },
                { valor: 'mkv', rotulo: 'MKV' },
              ]}
            />
            <SeletorCompacto
              rotulo="Resolução do vídeo final"
              valor={String(p.resolucao)}
              aoMudar={(v) => mudar({ resolucao: Number(v) })}
              opcoes={[
                { valor: '0', rotulo: 'Resolução original' },
                { valor: '1080', rotulo: '1080p' },
                { valor: '720', rotulo: '720p' },
                { valor: '480', rotulo: '480p' },
              ]}
            />
            {processando ? (
              <div className="w-60">
                <Progresso valor={tarefa.progresso} rotulo={tarefa.rotulo} aoCancelar={tarefa.cancelar} />
              </div>
            ) : (
              <Botao icone="baixar" onClick={exportar} disabled={vazio || Boolean(rascunho)}>
                Exportar vídeo
              </Botao>
            )}
          </div>
        </div>

        <div className="grid min-h-0 lg:flex-1 lg:grid-cols-[minmax(0,1fr)_21rem]">
          {/* Palco + controles */}
          <div className="flex min-h-0 min-w-0 flex-col">
            <div className="relative mx-4 mt-3 h-[clamp(12rem,40vh,30rem)] overflow-hidden rounded-xl bg-fundo-suave sm:mx-5 lg:h-auto lg:min-h-[12rem] lg:flex-1">
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
              <span />
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
              {aba === 'clipe' ? <PainelClipe p={p} fontes={fontes} clipe={clipeSel} mudarClipe={mudarClipe} acoes={acoes} /> : null}
              {aba === 'camada' ? <PainelCamada camada={camadaSel} mudarCamada={mudarCamada} acoes={acoes} total={total} /> : null}
              {aba === 'musica' ? <PainelAudio p={p} fontes={fontes} mudar={mudar} abrir={() => entradas.musica.current?.click()} exportarAudio={exportarAudio} processando={processando} /> : null}
            </div>
          </aside>
        </div>

        {/* Linha do tempo */}
        <div className="border-t border-borda py-2 pr-4 sm:pr-5">
          <LinhaDoTempo p={p} fontes={fontes} selecao={selecao} aoSelecionar={selecionar} aoBuscar={(t) => palco.current?.buscar(t)} aoMudarClipe={mudarClipe} aoMudarCamada={mudarCamada} aoReordenar={acoes.reordenar} aoAdicionar={() => entradas.clipes.current?.click()} aoMenu={abrirMenu} agora={agora} cabeca={cabeca} larguraRef={larguraLinha} escalaRef={escalaLinha} />
        </div>
      </section>

      <MenuContexto menu={menu} aoFechar={fecharMenu} />

      {aviso ? (
        <Aviso tom="alerta" aoFechar={() => setAviso(null)}>
          {aviso}
        </Aviso>
      ) : null}
      {tarefa.fase === 'erro' ? <Aviso tom="erro">{tarefa.mensagem}</Aviso> : null}

      <p className="flex flex-wrap items-center gap-x-1.5 text-xs text-fraca">
        <span className="size-1.5 rounded-full bg-sucesso" />
        Tudo o que você muda já aparece no player. Na timeline: arraste um clipe para reordenar, as pontas para fazer trim (as partes escondidas aparecem tracejadas) e o + para adicionar vídeo, imagem ou GIF. Botão direito mostra as opções de cada item. Atalhos: espaço toca/pausa · S divide · Delete apaga · Ctrl+Z desfaz.
      </p>
    </div>
  )
}

