import { useEffect, useMemo, useState } from 'react'
import { Resultados } from '../../componentes/ferramenta/Resultados'
import { SeletorArquivos } from '../../componentes/ferramenta/SeletorArquivos'
import { Aviso, Botao, Campo, Deslizante, Entrada, Grupo, Progresso, Segmentado } from '../../componentes/ui'
import { ehSvg, rasterizarSvg } from '../../motores/imagem'
import { CorDeFundo } from './_comum'
import { useSalvo, useTarefaSalva } from '../../nucleo/salvo'

/** Desenha o ícone num quadrado de `lado` px, com fundo, margem e cantos. */
function desenhar(fonte, lado, { fundo, transparente, margem, cantos }) {
  const c = document.createElement('canvas')
  c.width = lado
  c.height = lado
  const ctx = c.getContext('2d')
  ctx.imageSmoothingQuality = 'high'
  const raio = (cantos / 100) * (lado / 2)
  if (!transparente) {
    ctx.fillStyle = fundo
    ctx.beginPath()
    ctx.roundRect(0, 0, lado, lado, raio)
    ctx.fill()
  }
  const area = lado * (1 - (margem / 100) * 2)
  const escala = Math.min(area / fonte.width, area / fonte.height)
  const w = fonte.width * escala
  const h = fonte.height * escala
  ctx.save()
  if (!transparente && raio) {
    ctx.beginPath()
    ctx.roundRect(0, 0, lado, lado, raio)
    ctx.clip()
  }
  ctx.drawImage(fonte, (lado - w) / 2, (lado - h) / 2, w, h)
  ctx.restore()
  return c
}

const paraPng = (canvas) => new Promise((ok) => canvas.toBlob(ok, 'image/png'))

/** .ico com imagens PNG embutidas (formato aceito desde o Windows Vista e por todos os navegadores). */
async function montarIco(pngs) {
  const dados = await Promise.all(pngs.map(async ({ lado, blob }) => ({ lado, bytes: new Uint8Array(await blob.arrayBuffer()) })))
  const cabecalho = 6 + 16 * dados.length
  const total = cabecalho + dados.reduce((s, d) => s + d.bytes.length, 0)
  const saida = new Uint8Array(total)
  const v = new DataView(saida.buffer)
  v.setUint16(2, 1, true) // tipo: ícone
  v.setUint16(4, dados.length, true)
  let deslocamento = cabecalho
  dados.forEach((d, i) => {
    const e = 6 + i * 16
    saida[e] = d.lado >= 256 ? 0 : d.lado
    saida[e + 1] = d.lado >= 256 ? 0 : d.lado
    v.setUint16(e + 4, 1, true) // planos
    v.setUint16(e + 6, 32, true) // bits por pixel
    v.setUint32(e + 8, d.bytes.length, true)
    v.setUint32(e + 12, deslocamento, true)
    saida.set(d.bytes, deslocamento)
    deslocamento += d.bytes.length
  })
  return new Blob([saida], { type: 'image/x-icon' })
}

function codigoHtml(nome, svg) {
  return [
    svg ? '<link rel="icon" href="/favicon.svg" type="image/svg+xml">' : null,
    '<link rel="icon" href="/favicon.ico" sizes="32x32">',
    '<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png">',
    '<link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png">',
    '<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">',
    '<link rel="manifest" href="/site.webmanifest">',
  ]
    .filter(Boolean)
    .join('\n')
}

function Gerador({ arquivo, aoTrocar }) {
  const [fonte, setFonte] = useState(null)
  const [svg, setSvg] = useState(false)
  const [o, setO] = useSalvo('opcoes', { transparente: true, fundo: '#ffffff', margem: 6, cantos: 22, nome: '' })
  const tarefa = useTarefaSalva()
  const [copiado, setCopiado] = useState(false)

  useEffect(() => {
    let vivo = true
    ;(async () => {
      const ehVetor = await ehSvg(arquivo)
      const bmp = ehVetor ? await rasterizarSvg(arquivo, 1, 1024) : await createImageBitmap(arquivo, { imageOrientation: 'from-image' })
      if (vivo) {
        setSvg(ehVetor)
        setFonte(bmp)
      }
    })().catch(() => vivo && setFonte('erro'))
    return () => {
      vivo = false
    }
  }, [arquivo])

  const previas = useMemo(() => {
    if (!fonte || fonte === 'erro') return []
    return [64, 32, 16].map((lado) => ({ lado, url: desenhar(fonte, lado * 2, o).toDataURL() }))
  }, [fonte, o])

  if (fonte === 'erro') return <Aviso tom="erro" titulo="Não foi possível ler esta imagem" acao={<Botao variante="secundario" tamanho="p" onClick={aoTrocar}>Escolher outra</Botao>} />

  const gerar = () =>
    tarefa.executar(async ({ progresso }) => {
      const tamanhos = [16, 32, 48, 180, 192, 512]
      const pngs = {}
      for (const [i, lado] of tamanhos.entries()) {
        // O ícone da Apple não aceita transparência: usa sempre o fundo.
        const opcoes = lado === 180 ? { ...o, transparente: false, cantos: 0 } : o
        pngs[lado] = await paraPng(desenhar(fonte, lado, opcoes))
        progresso((i + 1) / (tamanhos.length + 1), 'Gerando os ícones')
      }
      const ico = await montarIco([16, 32, 48].map((lado) => ({ lado, blob: pngs[lado] })))
      const nome = o.nome.trim() || 'Meu site'
      const manifesto = {
        name: nome,
        short_name: nome.slice(0, 12),
        icons: [
          { src: '/android-chrome-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: '/android-chrome-512x512.png', sizes: '512x512', type: 'image/png' },
        ],
        theme_color: o.transparente ? '#ffffff' : o.fundo,
        background_color: o.transparente ? '#ffffff' : o.fundo,
        display: 'standalone',
      }
      const itens = [
        { nome: 'favicon.ico', blob: ico, detalhe: '16, 32 e 48 px' },
        { nome: 'favicon-16x16.png', blob: pngs[16] },
        { nome: 'favicon-32x32.png', blob: pngs[32] },
        { nome: 'apple-touch-icon.png', blob: pngs[180], detalhe: '180 px, com fundo' },
        { nome: 'android-chrome-192x192.png', blob: pngs[192] },
        { nome: 'android-chrome-512x512.png', blob: pngs[512] },
        { nome: 'site.webmanifest', blob: new Blob([JSON.stringify(manifesto, null, 2)], { type: 'application/manifest+json' }) },
      ]
      if (svg) itens.unshift({ nome: 'favicon.svg', blob: arquivo, detalhe: 'o seu SVG original' })
      return itens
    }, 'Gerando os ícones')

  if (tarefa.fase === 'pronto') {
    const html = codigoHtml(o.nome, svg)
    return (
      <div className="flex flex-col gap-5">
        <Resultados itens={tarefa.resultado} duracao={tarefa.duracao} nomeZip="favicon.zip" aoAjustar={tarefa.reiniciar} aoReiniciar={aoTrocar} rotuloNovo="Outra imagem" />
        <section className="cartao p-4 sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base">Cole no &lt;head&gt; do seu site</h2>
            <Botao
              variante="secundario"
              tamanho="p"
              icone={copiado ? 'check' : 'copiar'}
              onClick={async () => {
                await navigator.clipboard.writeText(html)
                setCopiado(true)
                setTimeout(() => setCopiado(false), 1500)
              }}
            >
              {copiado ? 'Copiado' : 'Copiar'}
            </Botao>
          </div>
          <pre className="mt-3 overflow-x-auto rounded-lg bg-fundo-suave p-3 font-mono text-xs leading-relaxed text-texto">{html}</pre>
          <p className="mt-2 text-xs text-fraca">Coloque os arquivos na raiz do site (a mesma pasta do index.html).</p>
        </section>
      </div>
    )
  }

  const processando = tarefa.fase === 'processando'
  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
      <div className="cartao flex flex-col items-center justify-center gap-6 p-6 sm:p-10">
        <div className="flex items-end gap-8">
          {previas.map((p) => (
            <figure key={p.lado} className="flex flex-col items-center gap-2">
              <div className="xadrez grid place-items-center rounded-lg border border-borda p-2">
                <img src={p.url} alt="" width={p.lado} height={p.lado} style={{ width: p.lado, height: p.lado }} />
              </div>
              <figcaption className="text-xs text-fraca tabular-nums">{p.lado} px</figcaption>
            </figure>
          ))}
        </div>
        {previas[0] ? (
          <div className="flex w-full max-w-sm items-center gap-2 rounded-t-lg border border-b-0 border-borda bg-superficie-2 px-3 py-2">
            <img src={previas[1].url} alt="" className="size-4" />
            <span className="truncate text-xs text-texto">{o.nome || 'Meu site'}</span>
            <span className="ml-auto text-xs text-fraca">×</span>
          </div>
        ) : null}
      </div>
      <aside className="cartao flex flex-col gap-5 p-4 sm:p-5 lg:sticky lg:top-20">
        <div className={processando ? 'pointer-events-none flex flex-col gap-5 opacity-60' : 'flex flex-col gap-5'}>
          <Segmentado
            rotulo="Fundo"
            valor={o.transparente ? 't' : 'c'}
            aoMudar={(v) => setO((x) => ({ ...x, transparente: v === 't' }))}
            opcoes={[
              { valor: 't', rotulo: 'Transparente' },
              { valor: 'c', rotulo: 'Cor sólida' },
            ]}
          />
          <CorDeFundo valor={o.fundo} aoMudar={(v) => setO((x) => ({ ...x, fundo: v }))} rotulo={o.transparente ? 'Cor do fundo (só no ícone da Apple)' : 'Cor do fundo'} />
          <Deslizante rotulo="Margem interna" valor={o.margem} aoMudar={(v) => setO((x) => ({ ...x, margem: v }))} min={0} max={30} formatar={(v) => `${v}%`} />
          {!o.transparente ? <Deslizante rotulo="Cantos arredondados" valor={o.cantos} aoMudar={(v) => setO((x) => ({ ...x, cantos: v }))} min={0} max={100} formatar={(v) => `${v}%`} /> : null}
          <Grupo titulo="Manifesto (Android)">
            <Entrada rotulo="Nome do site" valor={o.nome} aoMudar={(v) => setO((x) => ({ ...x, nome: v }))} placeholder="Meu site" maxLength={60} />
          </Grupo>
        </div>
        {processando ? (
          <Progresso valor={tarefa.progresso} rotulo={tarefa.rotulo} />
        ) : (
          <Campo>
            <div className="flex gap-2">
              <Botao variante="secundario" tamanho="g" onClick={aoTrocar}>
                Trocar
              </Botao>
              <Botao tamanho="g" className="flex-1" icone="magica" onClick={gerar} disabled={!fonte}>
                Gerar favicon
              </Botao>
            </div>
          </Campo>
        )}
      </aside>
    </div>
  )
}

export default function Favicon() {
  const [arquivos, setArquivos] = useSalvo('arquivos', [])
  if (!arquivos.length) {
    return (
      <SeletorArquivos
        arquivos={arquivos}
        aoMudar={setArquivos}
        multiplos={false}
        extensoes={['png', 'jpg', 'jpeg', 'webp', 'svg', 'avif']}
        descricaoFormatos="SVG, PNG, JPG, WebP · de preferência quadrada, com 512 px ou mais"
        aceitarColar
      />
    )
  }
  return <Gerador key={arquivos[0].id} arquivo={arquivos[0].arquivo} aoTrocar={() => setArquivos([])} />
}
