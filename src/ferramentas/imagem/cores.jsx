import { useEffect, useMemo, useRef, useState } from 'react'
import { SeletorArquivos } from '../../componentes/ferramenta/SeletorArquivos'
import { Icone } from '../../componentes/Icone'
import { Aviso, Botao, Deslizante } from '../../componentes/ui'
import { ehSvg, rasterizarSvg } from '../../motores/imagem'

const hex = ([r, g, b]) => `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`
function hsl([r, g, b]) {
  r /= 255
  g /= 255
  b /= 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  let h = 0
  let s = 0
  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4
    h *= 60
  }
  return `hsl(${Math.round(h)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%)`
}
/** Texto legível sobre a cor (preto ou branco), pela luminância. */
const contraste = ([r, g, b]) => (0.2126 * r + 0.7152 * g + 0.0722 * b > 150 ? '#0b0b0d' : '#ffffff')

/**
 * Paleta por k-means (k-means++ na inicialização) sobre uma amostra de até
 * ~40 mil pixels. Determinístico: mesma imagem, mesma paleta.
 */
export function extrairPaleta(pixels, k) {
  const pts = []
  for (let i = 0; i < pixels.length; i += 4) if (pixels[i + 3] > 127) pts.push([pixels[i], pixels[i + 1], pixels[i + 2]])
  if (!pts.length) return []
  const passo = Math.max(1, Math.floor(pts.length / 40000))
  const amostra = pts.filter((_, i) => i % passo === 0)
  const d2 = (a, b) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2
  // k-means++ com sementes determinísticas (gerador simples).
  let semente = 42
  const aleatorio = () => ((semente = (semente * 16807) % 2147483647) / 2147483647)
  const centros = [amostra[Math.floor(aleatorio() * amostra.length)]]
  while (centros.length < Math.min(k, amostra.length)) {
    const dist = amostra.map((p) => Math.min(...centros.map((c) => d2(p, c))))
    const total = dist.reduce((a, b) => a + b, 0)
    if (!total) break
    let alvo = aleatorio() * total
    let i = 0
    while ((alvo -= dist[i]) > 0 && i < dist.length - 1) i += 1
    centros.push(amostra[i])
  }
  let grupos = []
  for (let iter = 0; iter < 12; iter += 1) {
    grupos = centros.map(() => ({ soma: [0, 0, 0], n: 0 }))
    for (const p of amostra) {
      let melhor = 0
      let menor = Infinity
      for (let c = 0; c < centros.length; c += 1) {
        const d = d2(p, centros[c])
        if (d < menor) {
          menor = d
          melhor = c
        }
      }
      const g = grupos[melhor]
      g.soma[0] += p[0]
      g.soma[1] += p[1]
      g.soma[2] += p[2]
      g.n += 1
    }
    centros.forEach((_, c) => {
      if (grupos[c].n) centros[c] = grupos[c].soma.map((v) => v / grupos[c].n)
    })
  }
  return centros
    .map((c, i) => ({ rgb: c.map(Math.round), fracao: grupos[i].n / amostra.length }))
    .filter((c) => c.fracao > 0)
    .sort((a, b) => b.fracao - a.fracao)
}

function Amostra({ cor, aoCopiar, copiado }) {
  return (
    <button
      type="button"
      onClick={() => aoCopiar(hex(cor.rgb))}
      className="group flex min-w-0 flex-col overflow-hidden rounded-xl border border-borda text-left transition-shadow hover:shadow-[var(--shadow-cartao)]"
      aria-label={`Copiar ${hex(cor.rgb)}`}
    >
      <span className="grid h-20 place-items-center text-xs font-semibold" style={{ backgroundColor: hex(cor.rgb), color: contraste(cor.rgb) }}>
        {copiado === hex(cor.rgb) ? 'Copiado' : <span className="opacity-0 transition-opacity group-hover:opacity-100">Copiar</span>}
      </span>
      <span className="bg-superficie px-3 py-2">
        <span className="block font-mono text-sm font-semibold text-tinta uppercase">{hex(cor.rgb)}</span>
        <span className="block truncate font-mono text-[0.6875rem] text-fraca">rgb({cor.rgb.join(' ')})</span>
        <span className="block truncate font-mono text-[0.6875rem] text-fraca">{hsl(cor.rgb)}</span>
        {cor.fracao != null ? <span className="mt-1 block text-[0.6875rem] text-fraca tabular-nums">{Math.round(cor.fracao * 100)}% da imagem</span> : null}
      </span>
    </button>
  )
}

function Painel({ arquivo, aoTrocar }) {
  const url = useMemo(() => URL.createObjectURL(arquivo), [arquivo])
  useEffect(() => () => URL.revokeObjectURL(url), [url])
  const [pixels, setPixels] = useState(null)
  const [quantidade, setQuantidade] = useState(6)
  const [escolhidas, setEscolhidas] = useState([])
  const [copiado, setCopiado] = useState(null)
  const canvasCompleto = useRef(null)

  useEffect(() => {
    let vivo = true
    ;(async () => {
      const bmp = (await ehSvg(arquivo)) ? await rasterizarSvg(arquivo, 1, 1024) : await createImageBitmap(arquivo, { imageOrientation: 'from-image' })
      // Paleta numa versão reduzida (rápido); conta-gotas na imagem inteira.
      const escala = Math.min(1, 240 / Math.max(bmp.width, bmp.height))
      const pequeno = document.createElement('canvas')
      pequeno.width = Math.max(1, Math.round(bmp.width * escala))
      pequeno.height = Math.max(1, Math.round(bmp.height * escala))
      const ctx = pequeno.getContext('2d', { willReadFrequently: true })
      ctx.drawImage(bmp, 0, 0, pequeno.width, pequeno.height)
      const completo = document.createElement('canvas')
      completo.width = bmp.width
      completo.height = bmp.height
      completo.getContext('2d', { willReadFrequently: true }).drawImage(bmp, 0, 0)
      canvasCompleto.current = completo
      if (vivo) setPixels(ctx.getImageData(0, 0, pequeno.width, pequeno.height).data)
    })().catch(() => vivo && setPixels('erro'))
    return () => {
      vivo = false
    }
  }, [arquivo])

  const paleta = useMemo(() => (pixels && pixels !== 'erro' ? extrairPaleta(pixels, quantidade) : []), [pixels, quantidade])

  const copiar = async (texto) => {
    await navigator.clipboard.writeText(texto)
    setCopiado(texto)
    setTimeout(() => setCopiado(null), 1200)
  }

  const conta = (e) => {
    const c = canvasCompleto.current
    if (!c) return
    const caixa = e.currentTarget.getBoundingClientRect()
    const x = Math.floor(((e.clientX - caixa.left) / caixa.width) * c.width)
    const y = Math.floor(((e.clientY - caixa.top) / caixa.height) * c.height)
    const [r, g, b] = c.getContext('2d').getImageData(x, y, 1, 1).data
    setEscolhidas((l) => [{ rgb: [r, g, b] }, ...l.filter((x2) => hex(x2.rgb) !== hex([r, g, b]))].slice(0, 8))
  }

  const [temConta, setTemConta] = useState(false)
  useEffect(() => setTemConta('EyeDropper' in window), [])
  const contaTela = async () => {
    try {
      const { sRGBHex } = await new window.EyeDropper().open()
      const n = parseInt(sRGBHex.slice(1), 16)
      setEscolhidas((l) => [{ rgb: [(n >> 16) & 255, (n >> 8) & 255, n & 255] }, ...l].slice(0, 8))
    } catch {
      /* cancelado */
    }
  }

  if (pixels === 'erro') return <Aviso tom="erro" titulo="Não foi possível ler esta imagem" acao={<Botao variante="secundario" tamanho="p" onClick={aoTrocar}>Escolher outra</Botao>} />

  const css = paleta.map((c, i) => `  --cor-${i + 1}: ${hex(c.rgb)};`).join('\n')

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:items-start">
      <div className="flex flex-col gap-3 lg:sticky lg:top-20">
        <div className="xadrez grid place-items-center overflow-hidden rounded-[var(--radius-cartao)] border border-borda p-3">
          <img src={url} alt="Clique para pegar uma cor" onClick={conta} className="max-h-[55vh] max-w-full cursor-crosshair object-contain" />
        </div>
        <p className="flex items-center gap-2 text-xs text-fraca">
          <Icone nome="conta_gotas" tamanho={14} />
          Clique na imagem para pegar a cor de um ponto exato.
        </p>
        <div className="flex flex-wrap gap-2">
          <Botao variante="secundario" tamanho="p" icone="refazer" onClick={aoTrocar}>
            Outra imagem
          </Botao>
          {temConta ? (
            <Botao variante="secundario" tamanho="p" icone="conta_gotas" onClick={contaTela}>
              Pegar cor da tela
            </Botao>
          ) : null}
        </div>
      </div>
      <div className="flex flex-col gap-6">
        <section>
          <div className="mb-3 flex items-end justify-between gap-4">
            <h2 className="text-base">Cores predominantes</h2>
            <Deslizante rotulo="Quantidade" valor={quantidade} aoMudar={setQuantidade} min={2} max={12} className="w-40" />
          </div>
          {!paleta.length ? (
            <div className="esqueleto h-40 rounded-xl" />
          ) : (
            <>
              <div className="mb-3 flex h-8 overflow-hidden rounded-lg border border-borda">
                {paleta.map((c) => (
                  <span key={hex(c.rgb)} style={{ backgroundColor: hex(c.rgb), flexGrow: c.fracao }} title={`${hex(c.rgb)} · ${Math.round(c.fracao * 100)}%`} />
                ))}
              </div>
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                {paleta.map((c) => (
                  <Amostra key={hex(c.rgb)} cor={c} aoCopiar={copiar} copiado={copiado} />
                ))}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Botao variante="secundario" tamanho="p" icone="copiar" onClick={() => copiar(`:root {\n${css}\n}`)}>
                  Copiar como CSS
                </Botao>
                <Botao variante="secundario" tamanho="p" icone="copiar" onClick={() => copiar(JSON.stringify(paleta.map((c) => hex(c.rgb))))}>
                  Copiar como JSON
                </Botao>
              </div>
            </>
          )}
        </section>
        {escolhidas.length ? (
          <section>
            <h2 className="mb-3 text-base">Cores escolhidas</h2>
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              {escolhidas.map((c) => (
                <Amostra key={hex(c.rgb)} cor={c} aoCopiar={copiar} copiado={copiado} />
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </div>
  )
}

export default function Cores() {
  const [arquivos, setArquivos] = useState([])
  if (!arquivos.length) {
    return <SeletorArquivos arquivos={arquivos} aoMudar={setArquivos} multiplos={false} extensoes={['png', 'jpg', 'jpeg', 'webp', 'avif', 'gif', 'bmp', 'svg']} descricaoFormatos="PNG, JPG, WebP, AVIF, GIF, SVG" aceitarColar />
  }
  return <Painel key={arquivos[0].id} arquivo={arquivos[0].arquivo} aoTrocar={() => setArquivos([])} />
}
