import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { FORMATOS, GRUPOS } from '../../motores/conversor'
import { Icone } from '../Icone'

/**
 * Botão "para [formato ▾]" que abre a lista de formatos possíveis, separados
 * por grupo (Imagem, Vídeo, Áudio…), com busca. No celular abre como uma
 * folha presa na parte de baixo da tela.
 *
 * destinos: [{ ext, servidor?, bloqueio? }] — só o que vale para o arquivo.
 */
export function SeletorFormato({ destinos, valor, aoEscolher, desativado, compacto = false }) {
  const [aberto, setAberto] = useState(false)
  const [busca, setBusca] = useState('')
  const grupos = useMemo(() => GRUPOS.filter((g) => destinos.some((d) => FORMATOS[d.ext]?.grupo === g.id)), [destinos])
  const [grupo, setGrupo] = useState(null)
  const caixa = useRef(null)
  const botao = useRef(null)
  const campo = useRef(null)
  const id = useId()

  const grupoAtual = grupo ?? (valor ? FORMATOS[valor]?.grupo : null) ?? grupos[0]?.id

  useEffect(() => {
    if (!aberto) return undefined
    campo.current?.focus({ preventScroll: true })
    const fora = (e) => {
      if (!caixa.current?.contains(e.target)) setAberto(false)
    }
    const tecla = (e) => {
      if (e.key === 'Escape') {
        setAberto(false)
        botao.current?.focus()
      }
    }
    document.addEventListener('pointerdown', fora)
    document.addEventListener('keydown', tecla)
    return () => {
      document.removeEventListener('pointerdown', fora)
      document.removeEventListener('keydown', tecla)
    }
  }, [aberto])

  const termo = busca.trim().toLowerCase().replace(/^\./, '')
  const visiveis = termo
    ? destinos.filter((d) => d.ext.includes(termo) || FORMATOS[d.ext].rotulo.toLowerCase().includes(termo))
    : destinos.filter((d) => FORMATOS[d.ext]?.grupo === grupoAtual)

  const escolher = (ext) => {
    aoEscolher(ext)
    setAberto(false)
    setBusca('')
    botao.current?.focus()
  }

  return (
    <div ref={caixa} className="relative">
      <button
        ref={botao}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={aberto}
        aria-controls={aberto ? id : undefined}
        aria-label={valor ? `Formato de saída: ${FORMATOS[valor].rotulo}. Trocar` : 'Escolher o formato de saída'}
        disabled={desativado}
        onClick={() => setAberto((a) => !a)}
        className={`inline-flex items-center justify-between gap-2 rounded-lg border font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
          compacto ? 'h-8 min-w-20 px-2.5 text-xs' : 'h-9 min-w-24 px-3 text-[0.8125rem]'
        } ${
          valor
            ? 'border-borda-forte bg-superficie text-tinta hover:bg-superficie-2'
            : 'border-acento/50 bg-acento-suave text-acento hover:border-acento'
        }`}
      >
        {valor ? FORMATOS[valor].rotulo : 'Escolher'}
        <Icone nome="setaBaixo" tamanho={14} className={`transition-transform ${aberto ? 'rotate-180' : ''}`} />
      </button>

      {aberto ? (
        <div
          id={id}
          role="dialog"
          aria-label="Escolher o formato de saída"
          className="cartao animate-surgir fixed inset-x-3 bottom-3 z-40 overflow-hidden shadow-[0_18px_50px_-12px_rgb(0_0_0/0.45)] sm:absolute sm:inset-x-auto sm:top-full sm:right-0 sm:bottom-auto sm:mt-2 sm:w-[25rem]"
        >
          <div className="border-b border-borda p-2">
            <label className="relative block">
              <span className="sr-only">Buscar formato</span>
              <Icone nome="buscar" tamanho={15} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-fraca" />
              <input
                ref={campo}
                type="search"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar formato"
                className="h-9 w-full rounded-lg border border-borda bg-fundo-suave pr-3 pl-9 text-sm text-tinta placeholder:text-fraca focus:border-acento focus:outline-none"
              />
            </label>
          </div>
          <div className="flex max-h-[min(20rem,55vh)]">
            {!termo && grupos.length > 1 ? (
              <ul className="w-36 shrink-0 overflow-y-auto border-r border-borda p-1.5">
                {grupos.map((g) => (
                  <li key={g.id}>
                    <button
                      type="button"
                      onClick={() => setGrupo(g.id)}
                      onPointerEnter={(e) => e.pointerType === 'mouse' && setGrupo(g.id)}
                      className={`flex h-9 w-full items-center gap-2 rounded-md px-2.5 text-[0.8125rem] font-medium transition-colors ${
                        g.id === grupoAtual ? 'bg-superficie-2 text-tinta' : 'text-suave hover:text-tinta'
                      }`}
                    >
                      <Icone nome={g.icone} tamanho={15} />
                      {g.nome}
                      <Icone nome="setaDireita" tamanho={13} className={`ml-auto ${g.id === grupoAtual ? 'opacity-60' : 'opacity-0'}`} />
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
            <div className="grid flex-1 grid-cols-3 content-start gap-1.5 overflow-y-auto p-2">
              {visiveis.length ? (
                visiveis.map((d) => {
                  const f = FORMATOS[d.ext]
                  const ativo = d.ext === valor
                  return (
                    <button
                      key={d.ext}
                      type="button"
                      disabled={Boolean(d.bloqueio)}
                      title={d.bloqueio ?? (d.servidor ? `${f.dica} Convertido no nosso servidor.` : f.dica)}
                      onClick={() => escolher(d.ext)}
                      className={`relative inline-flex h-9 items-center justify-center gap-1 rounded-md border text-[0.8125rem] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                        ativo ? 'border-marca bg-marca text-sobre-marca' : 'border-borda bg-superficie text-tinta hover:border-borda-forte hover:bg-superficie-2'
                      }`}
                    >
                      {f.rotulo}
                      {d.servidor ? <Icone nome="servidor" tamanho={11} className="opacity-60" /> : null}
                    </button>
                  )
                })
              ) : (
                <p className="col-span-3 px-1 py-3 text-sm text-fraca">Nenhum formato com “{busca}”.</p>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
