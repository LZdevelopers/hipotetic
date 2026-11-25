import { useRef, useState } from 'react'
import { Icone } from '../../../componentes/Icone'

/*
 * Painel de camadas do editor de imagem: sempre à mão, no canto de baixo da
 * coluna da direita. Dá para soltá-lo (vira uma janelinha que se arrasta pela
 * tela), encaixar de volta ou fechar (o botão "Camadas" do topo abre de novo).
 *
 * Cada camada: mostrar/ocultar, bloquear (não seleciona nem arrasta na
 * imagem), lápis (abre as opções dela, esteja onde estiver) e arrastar a
 * linha para mudar a ordem. A imagem de fundo também é uma linha: nada vem
 * bloqueado — só o que a pessoa bloquear.
 */

const ICONE_CAMADA = { texto: 'tipo', imagem: 'imagem', desenho: 'caneta' }
const nomeDa = (c) => (c.tipo === 'texto' ? c.texto?.split('\n')[0] || 'Texto' : c.nome)

function BotaoLinha({ rotulo, icone, ativo, onClick, className = '', ...props }) {
  return (
    <button
      type="button"
      aria-label={rotulo}
      title={rotulo}
      onClick={onClick}
      className={`grid size-7 shrink-0 place-items-center rounded-md transition-colors hover:bg-superficie-3 ${ativo ? 'text-tinta' : 'text-fraca hover:text-tinta'} ${className}`}
      {...props}
    >
      <Icone nome={icone} tamanho={14} />
    </button>
  )
}

export function PainelCamadas({
  camadas,
  selecionada,
  aoSelecionar,
  aoEditar,
  aoMudar,
  aoReordenar,
  aoAdicionarImagem,
  aoAdicionarTexto,
  aoAdicionarDesenho,
  base,
  aoMudarBase,
  aoEditarBase,
  modo,
  aoModo,
  aoArrastarPainel,
}) {
  const [arrastando, setArrastando] = useState(null) // id da linha sendo arrastada
  const [alvo, setAlvo] = useState(null) // id da linha onde vai cair
  const cabeca = useRef(null)

  // Arrastar o cabeçalho: solta o painel (se estiver encaixado) e o leva junto.
  const aoApertarCabeca = (e) => {
    if (e.button !== 0 || e.target.closest('button')) return
    e.preventDefault()
    const r = cabeca.current.closest('[data-painel-camadas]').getBoundingClientRect()
    const dx = e.clientX - r.left
    const dy = e.clientY - r.top
    const x0 = e.clientX
    const y0 = e.clientY
    let soltou = modo === 'flutuante'
    const mover = (ev) => {
      if (!soltou && Math.hypot(ev.clientX - x0, ev.clientY - y0) < 6) return
      soltou = true
      aoArrastarPainel({ x: ev.clientX - dx, y: ev.clientY - dy, largura: r.width })
    }
    const fim = () => {
      removeEventListener('pointermove', mover)
      removeEventListener('pointerup', fim)
    }
    addEventListener('pointermove', mover)
    addEventListener('pointerup', fim)
  }

  const linhaArrastavel = (c) => ({
    draggable: true,
    onDragStart: (e) => {
      e.dataTransfer.effectAllowed = 'move'
      e.dataTransfer.setData('text/x-camada', c.id)
      setArrastando(c.id)
    },
    onDragOver: (e) => {
      if (!arrastando) return
      e.preventDefault()
      e.dataTransfer.dropEffect = 'move'
      if (alvo !== c.id) setAlvo(c.id)
    },
    onDrop: (e) => {
      if (!arrastando) return
      e.preventDefault()
      if (arrastando !== c.id) aoReordenar(arrastando, c.id)
      setArrastando(null)
      setAlvo(null)
    },
    onDragEnd: () => {
      setArrastando(null)
      setAlvo(null)
    },
  })

  return (
    <section aria-label="Camadas" className="flex min-h-0 flex-col" data-painel-camadas={modo}>
      <div ref={cabeca} onPointerDown={aoApertarCabeca} className="flex shrink-0 cursor-grab items-center gap-1 border-b border-borda px-2 py-1.5 select-none active:cursor-grabbing" title="Arraste para mover o painel">
        <Icone nome="arrastar" tamanho={14} className="text-fraca" />
        <h3 className="mr-auto text-xs font-semibold tracking-wide text-fraca uppercase">Camadas</h3>
        <BotaoLinha rotulo="Adicionar imagem" icone="imagemMais" onClick={aoAdicionarImagem} data-add-imagem="" />
        <BotaoLinha rotulo="Adicionar texto" icone="tipo" onClick={aoAdicionarTexto} />
        <BotaoLinha rotulo="Adicionar camada de desenho" icone="caneta" onClick={aoAdicionarDesenho} />
        <span className="mx-0.5 h-4 w-px bg-borda" />
        {modo === 'flutuante' ? <BotaoLinha rotulo="Encaixar na coluna da direita" icone="encaixarPainel" onClick={() => aoModo('fixo')} /> : <BotaoLinha rotulo="Soltar o painel (arrastar pela tela)" icone="soltarPainel" onClick={() => aoModo('flutuante')} />}
        <BotaoLinha rotulo="Fechar o painel de camadas" icone="fechar" onClick={() => aoModo('fechado')} />
      </div>
      <ul className="rolagem-fina flex min-h-0 flex-col gap-1 overflow-y-auto p-1.5" aria-label="Lista de camadas (a de cima fica na frente)">
        {[...camadas].reverse().map((c) => {
          const oculta = c.visivel === false
          return (
            <li key={c.id} {...linhaArrastavel(c)} className={`rounded-lg ${alvo === c.id && arrastando !== c.id ? 'outline-2 outline-acento' : ''} ${arrastando === c.id ? 'opacity-50' : ''}`}>
              <div className={`group flex items-center gap-0.5 rounded-lg border px-1 py-0.5 ${selecionada === c.id ? 'border-acento bg-acento/10' : 'border-transparent hover:bg-superficie-2'}`}>
                <Icone nome="arrastar" tamanho={13} className="shrink-0 cursor-grab text-fraca/60" />
                <button type="button" onClick={() => aoSelecionar(c.id)} onDoubleClick={() => aoEditar(c.id)} className="flex min-w-0 flex-1 items-center gap-2 py-1 text-left text-sm" data-camada-item={c.tipo}>
                  <Icone nome={ICONE_CAMADA[c.tipo]} tamanho={14} className="shrink-0 text-fraca" />
                  <span className={`truncate ${oculta ? 'text-fraca line-through' : 'text-tinta'}`}>{nomeDa(c)}</span>
                </button>
                <BotaoLinha rotulo="Editar a camada" icone="lapis" onClick={() => aoEditar(c.id)} data-editar-camada={c.id} />
                <BotaoLinha rotulo={c.bloqueada ? 'Desbloquear' : 'Bloquear (não seleciona nem arrasta na imagem)'} icone={c.bloqueada ? 'bloquear' : 'desbloquear'} ativo={c.bloqueada} onClick={() => aoMudar(c.id, { bloqueada: !c.bloqueada })} className={c.bloqueada ? '' : 'opacity-0 group-hover:opacity-100 focus-visible:opacity-100'} />
                <BotaoLinha rotulo={oculta ? 'Mostrar' : 'Ocultar'} icone={oculta ? 'verNao' : 'ver'} ativo={!oculta} onClick={() => aoMudar(c.id, { visivel: oculta })} />
              </div>
            </li>
          )
        })}
        <li>
          <div className="group flex items-center gap-0.5 rounded-lg border border-dashed border-borda px-1 py-0.5" data-camada-base="">
            <span className="size-[13px] shrink-0" />
            <button type="button" onClick={aoEditarBase} className="flex min-w-0 flex-1 items-center gap-2 py-1 text-left text-sm" title="Imagem de fundo: filtros, recorte, tamanho, remover fundo…">
              <Icone nome="imagem" tamanho={14} className="shrink-0 text-fraca" />
              <span className={`truncate ${base.oculta ? 'text-fraca line-through' : 'text-tinta'}`}>Imagem de fundo</span>
            </button>
            <BotaoLinha rotulo="Editar a imagem de fundo" icone="lapis" onClick={aoEditarBase} />
            <BotaoLinha
              rotulo={base.bloqueada ? 'Desbloquear a imagem de fundo' : 'Bloquear a imagem de fundo (ninguém mexe nela sem querer)'}
              icone={base.bloqueada ? 'bloquear' : 'desbloquear'}
              ativo={base.bloqueada}
              onClick={() => aoMudarBase({ baseBloqueada: !base.bloqueada })}
              className={base.bloqueada ? '' : 'opacity-0 group-hover:opacity-100 focus-visible:opacity-100'}
              data-bloquear-base=""
            />
            <BotaoLinha rotulo={base.oculta ? 'Mostrar a imagem de fundo' : 'Ocultar a imagem de fundo'} icone={base.oculta ? 'verNao' : 'ver'} ativo={!base.oculta} onClick={() => aoMudarBase({ baseOculta: !base.oculta })} />
          </div>
        </li>
      </ul>
    </section>
  )
}
