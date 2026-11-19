import { useCallback, useEffect, useRef, useState } from 'react'
import { Icone } from '../../componentes/Icone'
import { Aviso, Botao } from '../../componentes/ui'
import { ErroConsulta, PLATAFORMAS, consultarMidia, detectarPlataforma } from './_baixar/api'
import { Resultado, ResultadoCarregando } from './_baixar/Resultado'
import { useSalvo } from '../../nucleo/salvo'

/**
 * Downloader por link (YouTube e TikTok). Colar um link já dispara a
 * consulta — é o caminho de quase todos os usos — e a plataforma é
 * reconhecida pelo endereço. Uma consulta nova cancela a anterior.
 */
export default function Baixar({ plataforma: inicial = null }) {
  const [plataforma, setPlataforma] = useSalvo('plataforma', inicial)
  const [valor, setValor] = useSalvo('link', '')
  const [estado, setEstado] = useState({ fase: 'ocioso' })
  const controle = useRef(null)
  const cache = useRef(new Map())
  const resultado = useRef(null)
  const atual = PLATAFORMAS.find((p) => p.id === plataforma)

  useEffect(() => () => controle.current?.abort(), [])

  const consultar = useCallback(async (texto) => {
    const url = texto.trim()
    if (!url) return
    const detectada = detectarPlataforma(url)
    if (detectada) setPlataforma(detectada.id)

    controle.current?.abort()
    if (cache.current.has(url)) {
      setEstado({ fase: 'pronto', midia: cache.current.get(url) })
      return
    }
    const atualControle = new AbortController()
    controle.current = atualControle
    setEstado({ fase: 'buscando' })
    try {
      const midia = await consultarMidia(url, atualControle.signal)
      cache.current.set(url, midia)
      setEstado({ fase: 'pronto', midia })
    } catch (erro) {
      if (erro.name === 'AbortError') return
      setEstado({ fase: 'erro', mensagem: erro instanceof ErroConsulta ? erro.message : 'Algo deu errado. Tente de novo.' })
    }
  }, [])

  // No celular, o resultado nasce abaixo da dobra: rola até ele.
  useEffect(() => {
    if (estado.fase === 'pronto' && innerWidth < 1024) resultado.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [estado])

  const podeColar = typeof navigator !== 'undefined' && Boolean(navigator.clipboard?.readText)
  const [mostrarColar, setMostrarColar] = useState(false)
  useEffect(() => setMostrarColar(podeColar), [podeColar])

  const colar = async () => {
    try {
      const texto = await navigator.clipboard.readText()
      if (texto) {
        setValor(texto.trim())
        consultar(texto)
      }
    } catch {
      /* permissão negada: Ctrl+V no campo continua funcionando */
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="cartao p-3 sm:p-4">
        <div role="radiogroup" aria-label="Plataforma" className="mb-3 flex flex-wrap gap-2">
          {PLATAFORMAS.map((p) => {
            const ativo = p.id === plataforma
            return (
              <button
                key={p.id}
                type="button"
                role="radio"
                aria-checked={ativo}
                onClick={() => setPlataforma(p.id)}
                className={`inline-flex h-8 items-center gap-2 rounded-full border px-3 text-[0.8125rem] font-semibold transition-colors ${
                  ativo ? 'border-borda-forte bg-superficie-2 text-tinta' : 'border-borda text-suave hover:text-tinta'
                }`}
              >
                <Icone nome={p.id} tamanho={14} colorido={ativo && p.id === 'youtube'} />
                {p.nome}
              </button>
            )
          })}
          <span className="self-center text-xs text-fraca">ou cole qualquer link: reconhecemos sozinhos</span>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            consultar(valor)
          }}
          className="flex flex-col gap-2 sm:flex-row"
        >
          <label htmlFor="link-video" className="sr-only">
            Link do vídeo
          </label>
          <div className="flex h-12 min-w-0 flex-1 items-center gap-2.5 rounded-xl border border-borda-forte bg-superficie px-3.5 transition-colors focus-within:border-acento">
            <Icone nome={atual?.id ?? 'link'} tamanho={18} className="text-fraca" />
            <input
              id="link-video"
              type="url"
              inputMode="url"
              autoComplete="off"
              spellCheck="false"
              placeholder={atual?.placeholder ?? 'Cole o link do YouTube ou do TikTok'}
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              onPaste={(e) => {
                const texto = e.clipboardData.getData('text')
                if (!texto) return
                e.preventDefault()
                setValor(texto.trim())
                consultar(texto)
              }}
              className="h-full min-w-0 flex-1 bg-transparent text-[0.9375rem] text-tinta placeholder:text-fraca focus:outline-none"
              style={{ outline: 'none' }}
            />
          </div>
          <div className="flex gap-2">
            {mostrarColar && !valor ? (
              <Botao variante="secundario" tamanho="g" icone="colar" onClick={colar} className="flex-1 sm:flex-none">
                Colar
              </Botao>
            ) : null}
            <Botao type="submit" tamanho="g" icone="buscar" carregando={estado.fase === 'buscando'} className="flex-1 sm:flex-none">
              {estado.fase === 'buscando' ? 'Buscando' : 'Buscar'}
            </Botao>
          </div>
        </form>
      </div>

      <div ref={resultado} className="scroll-mt-20" aria-live="polite">
        {estado.fase === 'buscando' ? <ResultadoCarregando /> : null}
        {estado.fase === 'erro' ? (
          <Aviso tom="erro" aoFechar={() => setEstado({ fase: 'ocioso' })}>
            {estado.mensagem}
          </Aviso>
        ) : null}
        {estado.fase === 'pronto' ? <Resultado key={estado.midia.origem} midia={estado.midia} aoLimpar={() => setEstado({ fase: 'ocioso' })} /> : null}
      </div>
    </div>
  )
}
