import { useEffect, useRef, useState } from 'react'
import { SeletorArquivos } from '../../componentes/ferramenta/SeletorArquivos'
import { Botao, Caixa, Entrada, Segmentado } from '../../componentes/ui'

/** Recorta o canvas até o conteúdo (pixels não transparentes), com folga. */
function aparar(canvas) {
  const ctx = canvas.getContext('2d')
  const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height)
  let [x0, y0, x1, y1] = [width, height, -1, -1]
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (data[(y * width + x) * 4 + 3] > 8) {
        if (x < x0) x0 = x
        if (x > x1) x1 = x
        if (y < y0) y0 = y
        if (y > y1) y1 = y
      }
    }
  }
  if (x1 < 0) return null
  const folga = 6
  x0 = Math.max(0, x0 - folga)
  y0 = Math.max(0, y0 - folga)
  x1 = Math.min(width - 1, x1 + folga)
  y1 = Math.min(height - 1, y1 + folga)
  const saida = document.createElement('canvas')
  saida.width = x1 - x0 + 1
  saida.height = y1 - y0 + 1
  saida.getContext('2d').drawImage(canvas, x0, y0, saida.width, saida.height, 0, 0, saida.width, saida.height)
  return saida
}

function Desenhar({ cor, aoMudar }) {
  const canvas = useRef(null)
  const desenhando = useRef(null)
  useEffect(() => {
    const c = canvas.current
    const r = c.getBoundingClientRect()
    c.width = r.width * 2
    c.height = r.height * 2
  }, [])
  const ponto = (e) => {
    const r = canvas.current.getBoundingClientRect()
    return [(e.clientX - r.left) * 2, (e.clientY - r.top) * 2]
  }
  return (
    <div className="flex flex-col gap-2">
      <canvas
        ref={canvas}
        className="h-48 w-full touch-none rounded-lg border border-dashed border-borda-forte bg-white"
        aria-label="Área para desenhar a assinatura"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId)
          desenhando.current = ponto(e)
        }}
        onPointerMove={(e) => {
          if (!desenhando.current) return
          const ctx = canvas.current.getContext('2d')
          const [x, y] = ponto(e)
          const [px, py] = desenhando.current
          ctx.strokeStyle = cor
          ctx.lineWidth = Math.max(3, 7 - Math.hypot(x - px, y - py) / 12) // traço mais fino quando rápido
          ctx.lineCap = 'round'
          ctx.lineJoin = 'round'
          ctx.beginPath()
          ctx.moveTo(px, py)
          ctx.quadraticCurveTo(px, py, (px + x) / 2, (py + y) / 2)
          ctx.lineTo(x, y)
          ctx.stroke()
          desenhando.current = [x, y]
        }}
        onPointerUp={() => {
          desenhando.current = null
          aoMudar(aparar(canvas.current))
        }}
      />
      <Botao
        variante="fantasma"
        tamanho="p"
        className="self-start"
        onClick={() => {
          const c = canvas.current
          c.getContext('2d').clearRect(0, 0, c.width, c.height)
          aoMudar(null)
        }}
      >
        Limpar
      </Botao>
    </div>
  )
}

const FONTES_MANUSCRITAS = '"Segoe Script", "Brush Script MT", "Lucida Handwriting", "Apple Chancery", cursive'

function Digitar({ cor, aoMudar }) {
  const [nome, setNome] = useState('')
  useEffect(() => {
    if (!nome.trim()) return aoMudar(null)
    const c = document.createElement('canvas')
    c.width = 1200
    c.height = 300
    const ctx = c.getContext('2d')
    ctx.font = `italic 120px ${FONTES_MANUSCRITAS}`
    ctx.fillStyle = cor
    ctx.textBaseline = 'middle'
    ctx.fillText(nome, 20, 150, 1160)
    aoMudar(aparar(c))
    return undefined
  }, [nome, cor, aoMudar])
  return (
    <div className="flex flex-col gap-3">
      <Entrada rotulo="Seu nome" valor={nome} aoMudar={setNome} maxLength={60} autoFocus />
      <div className="grid h-28 place-items-center rounded-lg border border-borda bg-white px-4 text-4xl text-neutral-900" style={{ fontFamily: FONTES_MANUSCRITAS, fontStyle: 'italic', color: cor }}>
        {nome || <span className="text-sm text-neutral-400 not-italic">A prévia aparece aqui</span>}
      </div>
    </div>
  )
}

function Enviar({ aoMudar }) {
  const [arquivos, setArquivos] = useState([])
  const [tirarFundo, setTirarFundo] = useState(true)
  useEffect(() => {
    const a = arquivos[0]?.arquivo
    if (!a) return void aoMudar(null)
    ;(async () => {
      const bmp = await createImageBitmap(a, { imageOrientation: 'from-image' })
      const c = document.createElement('canvas')
      c.width = bmp.width
      c.height = bmp.height
      const ctx = c.getContext('2d')
      ctx.drawImage(bmp, 0, 0)
      if (tirarFundo) {
        // Papel branco/claro vira transparente (assinatura fotografada).
        const img = ctx.getImageData(0, 0, c.width, c.height)
        const d = img.data
        for (let i = 0; i < d.length; i += 4) {
          const luz = (d[i] + d[i + 1] + d[i + 2]) / 3
          if (luz > 200) d[i + 3] = 0
          else if (luz > 150) d[i + 3] = Math.round(((200 - luz) / 50) * d[i + 3])
        }
        ctx.putImageData(img, 0, 0)
      }
      aoMudar(aparar(c))
    })()
  }, [arquivos, tirarFundo, aoMudar])
  return (
    <div className="flex flex-col gap-3">
      <SeletorArquivos arquivos={arquivos} aoMudar={setArquivos} multiplos={false} extensoes={['png', 'jpg', 'jpeg', 'webp']} descricaoFormatos="Foto ou imagem da assinatura" compacto />
      <Caixa rotulo="Remover o fundo branco" dica="Para assinaturas fotografadas em papel." marcado={tirarFundo} aoMudar={setTirarFundo} />
    </div>
  )
}

/** Diálogo de assinatura: devolve um canvas PNG (fundo transparente) por `aoConfirmar`. */
export function DialogoAssinatura({ aberto, aoFechar, aoConfirmar }) {
  const dialogo = useRef(null)
  const [modo, setModo] = useState('desenhar')
  const [cor, setCor] = useState('#1a2b6d')
  const [resultado, setResultado] = useState(null)

  useEffect(() => {
    const d = dialogo.current
    if (aberto && !d.open) d.showModal()
    else if (!aberto && d.open) d.close()
  }, [aberto])

  return (
    <dialog ref={dialogo} onClose={aoFechar} className="m-auto w-[calc(100%-2rem)] max-w-lg rounded-2xl border border-borda bg-superficie p-0 text-texto shadow-[var(--shadow-flutuante)] backdrop:bg-sobreposicao">
      {aberto ? (
        <div className="flex flex-col gap-4 p-5">
          <h2 className="text-lg">Sua assinatura</h2>
          <Segmentado
            valor={modo}
            aoMudar={(m) => {
              setModo(m)
              setResultado(null)
            }}
            opcoes={[
              { valor: 'desenhar', rotulo: 'Desenhar', icone: 'caneta' },
              { valor: 'digitar', rotulo: 'Digitar', icone: 'tipo' },
              { valor: 'enviar', rotulo: 'Imagem', icone: 'imagem' },
            ]}
          />
          {modo !== 'enviar' ? (
            <div className="flex gap-2" role="radiogroup" aria-label="Cor da tinta">
              {['#1a2b6d', '#0b0b0d', '#1d5bd8'].map((c) => (
                <button key={c} type="button" role="radio" aria-checked={cor === c} aria-label={c} onClick={() => setCor(c)} className={`size-7 rounded-full border-2 ${cor === c ? 'border-acento' : 'border-transparent'}`} style={{ background: c }} />
              ))}
            </div>
          ) : null}
          {modo === 'desenhar' ? <Desenhar key="d" cor={cor} aoMudar={setResultado} /> : null}
          {modo === 'digitar' ? <Digitar key="t" cor={cor} aoMudar={setResultado} /> : null}
          {modo === 'enviar' ? <Enviar key="e" aoMudar={setResultado} /> : null}
          <div className="flex justify-end gap-2">
            <Botao variante="secundario" onClick={aoFechar}>
              Cancelar
            </Botao>
            <Botao icone="check" disabled={!resultado} onClick={() => aoConfirmar(resultado)}>
              Usar assinatura
            </Botao>
          </div>
        </div>
      ) : null}
    </dialog>
  )
}
