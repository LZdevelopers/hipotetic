import { useEffect, useRef, useState } from 'react'
import { Resultados } from '../../componentes/ferramenta/Resultados'
import { SeletorArquivos } from '../../componentes/ferramenta/SeletorArquivos'
import { Aviso, Botao, Caixa, Deslizante, Entrada, Grupo, Segmentado, Seletor } from '../../componentes/ui'
import { formatarDuracao, semExtensao } from '../../nucleo/arquivos'
import { CorDeFundo, EscolhaFormato, Qualidade } from './_comum'
import { useUrlObjeto } from '../../nucleo/url'
import { useSalvo } from '../../nucleo/salvo'

const TAMANHOS = [
  { valor: '1280x720', rotulo: 'YouTube · 1280×720' },
  { valor: '1920x1080', rotulo: 'Full HD · 1920×1080' },
  { valor: '1080x1080', rotulo: 'Quadrada · 1080×1080' },
  { valor: '1080x1920', rotulo: 'Vertical · 1080×1920' },
  { valor: '1200x630', rotulo: 'Prévia de link · 1200×630' },
  { valor: '640x360', rotulo: 'Pequena · 640×360' },
]

/** Desenha a miniatura: quadro (cobrindo) + texto opcional com faixa escura. */
function desenhar(canvas, fonte, o) {
  const [w, h] = o.tamanho.split('x').map(Number)
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  ctx.imageSmoothingQuality = 'high'
  const fw = fonte.videoWidth ?? fonte.width
  const fh = fonte.videoHeight ?? fonte.height
  const escala = Math.max(w / fw, h / fh)
  ctx.drawImage(fonte, (w - fw * escala) / 2, (h - fh * escala) / 2, fw * escala, fh * escala)

  const texto = o.texto.trim()
  if (!texto) return
  const tamanhoFonte = Math.round((o.tamanhoTexto / 100) * h)
  ctx.font = `800 ${tamanhoFonte}px "Plus Jakarta Sans Variable", system-ui, sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  // Quebra em linhas que caibam em 90% da largura.
  const linhas = []
  for (const paragrafo of texto.split('\n')) {
    let linha = ''
    for (const palavra of paragrafo.split(/\s+/)) {
      const teste = linha ? `${linha} ${palavra}` : palavra
      if (ctx.measureText(teste).width > w * 0.9 && linha) {
        linhas.push(linha)
        linha = palavra
      } else linha = teste
    }
    linhas.push(linha)
  }
  const altLinha = tamanhoFonte * 1.15
  const bloco = altLinha * linhas.length
  const centro = o.posicao === 'topo' ? h * 0.08 + bloco / 2 : o.posicao === 'base' ? h * 0.92 - bloco / 2 : h / 2
  if (o.faixa) {
    const g = ctx.createLinearGradient(0, centro - bloco, 0, centro + bloco)
    g.addColorStop(0, 'rgba(0,0,0,0)')
    g.addColorStop(0.5, 'rgba(0,0,0,0.6)')
    g.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = g
    ctx.fillRect(0, centro - bloco, w, bloco * 2)
  }
  ctx.fillStyle = o.cor
  ctx.lineJoin = 'round'
  ctx.lineWidth = Math.max(2, tamanhoFonte * 0.08)
  ctx.strokeStyle = 'rgba(0,0,0,0.55)'
  linhas.forEach((l, i) => {
    const y = centro - bloco / 2 + altLinha * (i + 0.5)
    if (o.contorno) ctx.strokeText(l, w / 2, y)
    ctx.fillText(l, w / 2, y)
  })
}

const MIME = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp' }

function Editor({ arquivo, aoTrocar }) {
  const ehVideo = /^video\//.test(arquivo.type) || /\.(mp4|webm|mov|mkv|m4v)$/i.test(arquivo.name)
  const url = useUrlObjeto(arquivo)
  const fonte = useRef(null)
  const canvas = useRef(null)
  const [pronto, setPronto] = useState(false)
  const [erro, setErro] = useState(false)
  const [duracao, setDuracao] = useState(0)
  const [tempo, setTempo] = useState(0)
  const [o, setO] = useSalvo('opcoes', { tamanho: '1280x720', texto: '', tamanhoTexto: 12, posicao: 'base', cor: '#ffffff', faixa: true, contorno: false, formato: 'jpg', qualidade: 90 })
  const [resultado, setResultado] = useSalvo('resultado', null)
  const mudar = (k) => (v) => setO((x) => ({ ...x, [k]: v }))

  // Redesenha a prévia sempre que algo muda (fontes web carregadas antes).
  useEffect(() => {
    if (!pronto || !canvas.current) return
    document.fonts?.ready.then(() => desenhar(canvas.current, fonte.current, o))
  }, [pronto, o, tempo])

  const buscarQuadro = (t) => {
    setTempo(t)
    if (fonte.current) fonte.current.currentTime = t
  }

  const gerar = async () => {
    const final = document.createElement('canvas')
    desenhar(final, fonte.current, o)
    const formato = o.formato === 'avif' ? 'webp' : o.formato
    const blob = await new Promise((ok) => final.toBlob(ok, MIME[formato], o.qualidade / 100))
    setResultado([{ nome: `${semExtensao(arquivo.name)}-miniatura.${formato}`, blob, detalhe: `${final.width} × ${final.height} px` }])
  }

  if (resultado) return <Resultados itens={resultado} aoAjustar={() => setResultado(null)} aoReiniciar={aoTrocar} rotuloNovo="Outro arquivo" />
  if (erro) return <Aviso tom="erro" titulo="Não foi possível abrir este arquivo" acao={<Botao variante="secundario" tamanho="p" onClick={aoTrocar}>Escolher outro</Botao>}>Se for um vídeo, o navegador pode não ter o codec dele (ex.: H.265 em alguns navegadores).</Aviso>

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
      <div className="flex min-w-0 flex-col gap-3">
        {ehVideo ? (
          <video
            ref={fonte}
            src={url}
            muted
            playsInline
            preload="auto"
            className="hidden"
            onLoadedMetadata={(e) => {
              setDuracao(e.currentTarget.duration)
              const t = Math.min(1, e.currentTarget.duration / 3)
              e.currentTarget.currentTime = t
              setTempo(t)
            }}
            onSeeked={() => {
              setPronto(true)
              if (canvas.current) desenhar(canvas.current, fonte.current, o)
            }}
            onError={() => setErro(true)}
          />
        ) : (
          <img ref={fonte} src={url} alt="" className="hidden" onLoad={() => setPronto(true)} onError={() => setErro(true)} />
        )}
        <div className="grid place-items-center overflow-hidden rounded-[var(--radius-cartao)] border border-borda bg-fundo-suave p-3">
          <canvas ref={canvas} className={`max-h-[60vh] max-w-full rounded-md shadow-[var(--shadow-cartao)] ${pronto ? '' : 'esqueleto aspect-video w-full'}`} aria-label="Prévia da miniatura" />
        </div>
        {ehVideo && duracao ? (
          <Deslizante rotulo="Quadro do vídeo" valor={tempo} aoMudar={buscarQuadro} min={0} max={Math.max(0, duracao - 0.05)} passo={0.04} formatar={(v) => formatarDuracao(v)} dica="Arraste para escolher o momento do vídeo." />
        ) : null}
      </div>
      <aside className="cartao flex flex-col gap-5 p-4 sm:p-5 lg:sticky lg:top-20">
        <Seletor rotulo="Tamanho" valor={o.tamanho} aoMudar={mudar('tamanho')} opcoes={TAMANHOS} />
        <Grupo titulo="Texto (opcional)">
          <div className="flex flex-col gap-4">
            <Entrada rotulo="Título" valor={o.texto} aoMudar={mudar('texto')} placeholder="Ex.: Como fazer pão em casa" maxLength={90} />
            {o.texto.trim() ? (
              <>
                <Deslizante rotulo="Tamanho do texto" valor={o.tamanhoTexto} aoMudar={mudar('tamanhoTexto')} min={4} max={25} formatar={(v) => `${v}%`} />
                <Segmentado
                  rotulo="Posição"
                  valor={o.posicao}
                  aoMudar={mudar('posicao')}
                  opcoes={[
                    { valor: 'topo', rotulo: 'Topo' },
                    { valor: 'centro', rotulo: 'Centro' },
                    { valor: 'base', rotulo: 'Base' },
                  ]}
                />
                <CorDeFundo valor={o.cor} aoMudar={mudar('cor')} rotulo="Cor do texto" />
                <Caixa rotulo="Faixa escura atrás do texto" marcado={o.faixa} aoMudar={mudar('faixa')} />
                <Caixa rotulo="Contorno nas letras" marcado={o.contorno} aoMudar={mudar('contorno')} />
              </>
            ) : null}
          </div>
        </Grupo>
        <EscolhaFormato valor={o.formato} aoMudar={mudar('formato')} />
        {o.formato === 'avif' ? <p className="-mt-3 text-xs text-fraca">AVIF não está disponível aqui: será gerado WebP.</p> : null}
        <Qualidade valor={o.qualidade} aoMudar={mudar('qualidade')} formato={o.formato} />
        <div className="flex gap-2">
          <Botao variante="secundario" tamanho="g" onClick={aoTrocar}>
            Trocar
          </Botao>
          <Botao tamanho="g" className="flex-1" icone="imagemBaixar" onClick={gerar} disabled={!pronto}>
            Gerar miniatura
          </Botao>
        </div>
      </aside>
    </div>
  )
}

export default function Miniatura() {
  const [arquivos, setArquivos] = useSalvo('arquivos', [])
  if (!arquivos.length) {
    return (
      <SeletorArquivos
        arquivos={arquivos}
        aoMudar={setArquivos}
        multiplos={false}
        extensoes={['png', 'jpg', 'jpeg', 'webp', 'avif', 'mp4', 'webm', 'mov', 'm4v']}
        descricaoFormatos="Imagem (PNG, JPG, WebP) ou vídeo (MP4, WebM, MOV)"
        limiteBytes={2 * 1024 * 1024 * 1024}
        aceitarColar
      />
    )
  }
  return <Editor key={arquivos[0].id} arquivo={arquivos[0].arquivo} aoTrocar={() => setArquivos([])} />
}
