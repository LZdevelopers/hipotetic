import { useEffect, useState } from 'react'
import { DialogoBaixar, OpcoesCartoes } from '../../componentes/ferramenta/Baixar'
import { AreaTexto, Aviso, Botao, Entrada, Grupo, Segmentado, Seletor, Deslizante } from '../../componentes/ui'
import { baixarBlob } from '../../nucleo/arquivos'
import { CorDeFundo } from '../imagem/_comum'

const TIPOS = [
  { valor: 'link', rotulo: 'Link' },
  { valor: 'texto', rotulo: 'Texto' },
  { valor: 'wifi', rotulo: 'Wi-Fi' },
  { valor: 'whatsapp', rotulo: 'WhatsApp' },
  { valor: 'email', rotulo: 'E-mail' },
  { valor: 'contato', rotulo: 'Contato' },
]

/** Escapa ; , : \ " como pedem os formatos WIFI: e MECARD/vCard. */
const esc = (t) => String(t).replace(/([\\;,:"])/g, '\\$1')

/** Conteúdo do QR a partir dos campos de cada tipo. */
export function conteudoQr(tipo, c) {
  switch (tipo) {
    case 'link': {
      const u = c.url?.trim() ?? ''
      return u && !/^[a-z][a-z0-9+.-]*:/i.test(u) ? `https://${u}` : u
    }
    case 'wifi':
      return c.rede ? `WIFI:T:${c.seguranca};S:${esc(c.rede)};P:${c.seguranca === 'nopass' ? '' : esc(c.senha ?? '')};${c.oculta ? 'H:true;' : ''};` : ''
    case 'whatsapp': {
      const n = String(c.telefone ?? '').replace(/\D/g, '')
      return n ? `https://wa.me/${n}${c.mensagem ? `?text=${encodeURIComponent(c.mensagem)}` : ''}` : ''
    }
    case 'email':
      return c.para ? `mailto:${c.para}?subject=${encodeURIComponent(c.assunto ?? '')}&body=${encodeURIComponent(c.corpo ?? '')}` : ''
    case 'contato':
      return c.nome
        ? ['BEGIN:VCARD', 'VERSION:3.0', `FN:${esc(c.nome)}`, c.telefone ? `TEL:${c.telefone}` : null, c.email ? `EMAIL:${c.email}` : null, c.empresa ? `ORG:${esc(c.empresa)}` : null, c.site ? `URL:${c.site}` : null, 'END:VCARD'].filter(Boolean).join('\n')
        : ''
    default:
      return c.texto ?? ''
  }
}

function Campos({ tipo, c, mudar }) {
  const m = (k) => (v) => mudar({ ...c, [k]: v })
  if (tipo === 'link') return <Entrada rotulo="Endereço" valor={c.url ?? ''} aoMudar={m('url')} placeholder="https://exemplo.com.br" inputMode="url" />
  if (tipo === 'texto') return <AreaTexto rotulo="Texto" valor={c.texto ?? ''} aoMudar={m('texto')} placeholder="Qualquer texto" className="[&_textarea]:font-sans" />
  if (tipo === 'wifi')
    return (
      <>
        <Entrada rotulo="Nome da rede (SSID)" valor={c.rede ?? ''} aoMudar={m('rede')} />
        <Segmentado
          rotulo="Segurança"
          valor={c.seguranca ?? 'WPA'}
          aoMudar={m('seguranca')}
          opcoes={[
            { valor: 'WPA', rotulo: 'WPA/WPA2/WPA3' },
            { valor: 'WEP', rotulo: 'WEP' },
            { valor: 'nopass', rotulo: 'Aberta' },
          ]}
        />
        {(c.seguranca ?? 'WPA') !== 'nopass' ? <Entrada rotulo="Senha" valor={c.senha ?? ''} aoMudar={m('senha')} /> : null}
      </>
    )
  if (tipo === 'whatsapp')
    return (
      <>
        <Entrada rotulo="Número com DDD e país" valor={c.telefone ?? ''} aoMudar={m('telefone')} placeholder="55 11 91234-5678" inputMode="tel" />
        <AreaTexto rotulo="Mensagem pronta (opcional)" valor={c.mensagem ?? ''} aoMudar={m('mensagem')} className="[&_textarea]:min-h-20 [&_textarea]:font-sans" />
      </>
    )
  if (tipo === 'email')
    return (
      <>
        <Entrada rotulo="Para" valor={c.para ?? ''} aoMudar={m('para')} type="email" />
        <Entrada rotulo="Assunto" valor={c.assunto ?? ''} aoMudar={m('assunto')} />
        <AreaTexto rotulo="Mensagem" valor={c.corpo ?? ''} aoMudar={m('corpo')} className="[&_textarea]:min-h-20 [&_textarea]:font-sans" />
      </>
    )
  return (
    <>
      <Entrada rotulo="Nome" valor={c.nome ?? ''} aoMudar={m('nome')} />
      <Entrada rotulo="Telefone" valor={c.telefone ?? ''} aoMudar={m('telefone')} inputMode="tel" />
      <Entrada rotulo="E-mail" valor={c.email ?? ''} aoMudar={m('email')} type="email" />
      <Entrada rotulo="Empresa" valor={c.empresa ?? ''} aoMudar={m('empresa')} />
      <Entrada rotulo="Site" valor={c.site ?? ''} aoMudar={m('site')} />
    </>
  )
}

export default function QrCode() {
  const [tipo, setTipo] = useState('link')
  const [campos, setCampos] = useState({ url: '' })
  const [estilo, setEstilo] = useState({ frente: '#0b0b0d', fundo: '#ffffff', margem: 2, correcao: 'M', tamanho: 1024 })
  const [svg, setSvg] = useState('')
  const [erro, setErro] = useState(null)
  const conteudo = conteudoQr(tipo, campos)

  useEffect(() => {
    let vivo = true
    if (!conteudo) {
      setSvg('')
      return undefined
    }
    import('qrcode').then(async (QR) => {
      try {
        const s = await QR.toString(conteudo, { type: 'svg', errorCorrectionLevel: estilo.correcao, margin: estilo.margem, color: { dark: estilo.frente, light: estilo.fundo } })
        if (vivo) {
          setSvg(s)
          setErro(null)
        }
      } catch {
        if (vivo) setErro('Conteúdo longo demais para um QR Code. Encurte o texto ou baixe o nível de correção.')
      }
    })
    return () => {
      vivo = false
    }
  }, [conteudo, estilo])

  const [baixando, setBaixando] = useState(null)
  const baixarPng = async (tamanho, nome) => {
    const QR = await import('qrcode')
    // Pelo canvas (e não por data URL + fetch, que a CSP do site bloqueia).
    const canvas = document.createElement('canvas')
    await QR.toCanvas(canvas, conteudo, { errorCorrectionLevel: estilo.correcao, margin: estilo.margem, width: tamanho, color: { dark: estilo.frente, light: estilo.fundo } })
    baixarBlob(await new Promise((ok) => canvas.toBlob(ok, 'image/png')), nome)
  }

  // Contraste baixo = QR que muitas câmeras não leem.
  const lum = (h) => {
    const n = parseInt(h.slice(1), 16)
    return 0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)
  }
  const contrastePoucos = Math.abs(lum(estilo.frente) - lum(estilo.fundo)) < 100

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
      <div className="cartao flex flex-col gap-5 p-4 sm:p-5">
        <Segmentado valor={tipo} aoMudar={(v) => { setTipo(v); setCampos({}) }} opcoes={TIPOS} />
        <div className="flex flex-col gap-4">
          <Campos tipo={tipo} c={campos} mudar={setCampos} />
        </div>
        <Grupo titulo="Aparência">
          <div className="grid gap-4 sm:grid-cols-2">
            <CorDeFundo valor={estilo.frente} aoMudar={(v) => setEstilo((e) => ({ ...e, frente: v }))} rotulo="Cor dos módulos" />
            <CorDeFundo valor={estilo.fundo} aoMudar={(v) => setEstilo((e) => ({ ...e, fundo: v }))} rotulo="Cor do fundo" />
            <Deslizante rotulo="Margem" valor={estilo.margem} aoMudar={(v) => setEstilo((e) => ({ ...e, margem: v }))} min={0} max={8} formatar={(v) => `${v} módulos`} />
            <Seletor
              rotulo="Correção de erros"
              valor={estilo.correcao}
              aoMudar={(v) => setEstilo((e) => ({ ...e, correcao: v }))}
              opcoes={[
                { valor: 'L', rotulo: 'Baixa (7%)' },
                { valor: 'M', rotulo: 'Média (15%)' },
                { valor: 'Q', rotulo: 'Alta (25%)' },
                { valor: 'H', rotulo: 'Máxima (30%)' },
              ]}
              dica="Mais correção = continua legível mesmo amassado ou sujo, mas o código fica mais denso."
            />
          </div>
        </Grupo>
      </div>
      <aside className="cartao flex flex-col items-center gap-4 p-4 sm:p-5 lg:sticky lg:top-20">
        {svg ? (
          <div className="w-full max-w-72 overflow-hidden rounded-lg border border-borda" role="img" aria-label="QR Code gerado" dangerouslySetInnerHTML={{ __html: svg }} />
        ) : (
          <div className="grid aspect-square w-full max-w-72 place-items-center rounded-lg border border-dashed border-borda-forte p-6 text-center text-sm text-fraca">Preencha ao lado para ver o QR Code</div>
        )}
        {erro ? <Aviso tom="erro">{erro}</Aviso> : null}
        {contrastePoucos && svg ? <Aviso tom="alerta">Pouco contraste entre as cores: alguns celulares podem não ler.</Aviso> : null}
        <Botao icone="baixar" className="w-full" onClick={() => setBaixando({ formato: 'png', tamanho: estilo.tamanho })} disabled={!svg}>
          Baixar
        </Botao>
      </aside>

      {/* Hora de baixar: nome, formato (PNG ou SVG) e o tamanho do PNG */}
      <DialogoBaixar
        aberto={Boolean(baixando)}
        aoFechar={() => setBaixando(null)}
        titulo="Baixar o QR Code"
        nome="qr-code"
        extensao={baixando?.formato}
        aoConfirmar={async (nome) => {
          const b = baixando
          setBaixando(null)
          setEstilo((e) => ({ ...e, tamanho: b.tamanho }))
          if (b.formato === 'svg') baixarBlob(new Blob([svg], { type: 'image/svg+xml' }), `${nome}.svg`)
          else await baixarPng(b.tamanho, `${nome}.png`)
        }}
      >
        {baixando ? (
          <>
            <OpcoesCartoes
              rotulo="Formato"
              valor={baixando.formato}
              aoMudar={(v) => setBaixando((b) => ({ ...b, formato: v }))}
              colunas="grid-cols-2"
              opcoes={[
                { valor: 'png', rotulo: 'PNG', dica: 'Imagem comum: redes, sites, documentos' },
                { valor: 'svg', rotulo: 'SVG', dica: 'Vetorial: impressão em qualquer tamanho' },
              ]}
            />
            {baixando.formato === 'png' ? (
              <OpcoesCartoes
                rotulo="Tamanho"
                valor={baixando.tamanho}
                aoMudar={(v) => setBaixando((b) => ({ ...b, tamanho: v }))}
                colunas="grid-cols-2 sm:grid-cols-4"
                opcoes={[512, 1024, 2048, 4096].map((v) => ({ valor: v, rotulo: `${v} px`, dica: v <= 1024 ? 'Tela' : 'Impressão' }))}
              />
            ) : null}
          </>
        ) : null}
      </DialogoBaixar>
    </div>
  )
}
