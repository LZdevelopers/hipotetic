import { ModeloConversao } from '../../componentes/ferramenta/ModeloConversao'
import { Caixa, Campo, Deslizante, Entrada, Seletor } from '../../componentes/ui'
import { LIMITE_PDF, abrirEdicao, obterPdfLib, salvarPdf } from '../../motores/pdf'
import { fontePadrao, pontoNaPagina, tamanhoVisual, textoSeguro } from '../../motores/pdf/escrita'
import { trocarExtensao } from '../../nucleo/arquivos'

const POSICOES = [
  ['topo-esquerda', 'topo-centro', 'topo-direita'],
  ['base-esquerda', 'base-centro', 'base-direita'],
]

function Posicao({ valor, aoMudar }) {
  return (
    <Campo rotulo="Posição">
      <div className="grid w-40 grid-cols-3 gap-1 rounded-lg border border-borda bg-fundo-suave p-1.5" role="radiogroup" aria-label="Posição">
        {POSICOES.flat().map((p, i) => (
          <button
            key={p}
            type="button"
            role="radio"
            aria-checked={valor === p}
            aria-label={p.replace('-', ' ')}
            onClick={() => aoMudar(p)}
            className={`h-9 rounded-md border transition-colors ${i === 3 ? 'col-start-1' : ''} ${i >= 3 ? 'row-start-3' : ''} ${valor === p ? 'border-marca bg-marca' : 'border-borda bg-superficie hover:border-borda-forte'}`}
          />
        ))}
        <span className="col-span-3 row-start-2 h-10" aria-hidden="true" />
      </div>
    </Campo>
  )
}

function Configuracoes({ opcoes, mudar }) {
  return (
    <div className="flex flex-col gap-5">
      <Posicao valor={opcoes.posicao} aoMudar={(v) => mudar('posicao', v)} />
      <Seletor
        rotulo="Formato"
        valor={opcoes.formato}
        aoMudar={(v) => mudar('formato', v)}
        opcoes={[
          { valor: '{n}', rotulo: '1' },
          { valor: '{n} / {total}', rotulo: '1 / 10' },
          { valor: 'Página {n}', rotulo: 'Página 1' },
          { valor: 'Página {n} de {total}', rotulo: 'Página 1 de 10' },
          { valor: '- {n} -', rotulo: '- 1 -' },
        ]}
      />
      <div className="grid grid-cols-2 gap-3">
        <Entrada rotulo="Começar em" type="number" min="0" valor={opcoes.inicio} aoMudar={(v) => mudar('inicio', v)} />
        <Entrada rotulo="Pular as primeiras" type="number" min="0" sufixo="pág." valor={opcoes.pular} aoMudar={(v) => mudar('pular', v)} />
      </div>
      <Deslizante rotulo="Tamanho da fonte" valor={opcoes.tamanho} aoMudar={(v) => mudar('tamanho', v)} min={6} max={28} formatar={(v) => `${v} pt`} />
      <Deslizante rotulo="Distância da borda" valor={opcoes.margem} aoMudar={(v) => mudar('margem', v)} min={10} max={80} formatar={(v) => `${v} pt`} />
      <Caixa rotulo="Negrito" marcado={opcoes.negrito} aoMudar={(v) => mudar('negrito', v)} />
    </div>
  )
}

export default function Numerar() {
  return (
    <ModeloConversao
      extensoes={['pdf']}
      descricaoFormatos="PDF"
      limiteBytes={LIMITE_PDF}
      multiplos={false}
      opcoesIniciais={{ posicao: 'base-centro', formato: '{n} / {total}', inicio: '1', pular: '0', tamanho: 11, margem: 28, negrito: false }}
      Configuracoes={Configuracoes}
      rotuloAcao="Numerar páginas"
      processar={async ([item], o, { progresso }) => {
        const { rgb } = await obterPdfLib()
        const doc = await abrirEdicao(item.arquivo)
        const fonte = await fontePadrao(doc, o.negrito)
        const paginas = doc.getPages()
        const pular = Math.max(0, Number(o.pular) || 0)
        const inicio = Number(o.inicio) || 1
        const total = paginas.length - pular + inicio - 1
        const [vertical, horizontal] = o.posicao.split('-')
        paginas.forEach((pagina, i) => {
          if (i < pular) return
          const texto = textoSeguro(fonte, o.formato.replace('{n}', i - pular + inicio).replace('{total}', total))
          const largura = fonte.widthOfTextAtSize(texto, o.tamanho)
          const { largura: W, altura: H } = tamanhoVisual(pagina)
          const vx = horizontal === 'esquerda' ? o.margem : horizontal === 'direita' ? W - o.margem - largura : (W - largura) / 2
          const vy = vertical === 'topo' ? H - o.margem - o.tamanho * 0.75 : o.margem
          const { x, y, giro } = pontoNaPagina(pagina, vx, vy)
          pagina.drawText(texto, { x, y, size: o.tamanho, font: fonte, color: rgb(0.15, 0.15, 0.17), rotate: { type: 'degrees', angle: giro } })
          progresso((i + 1) / paginas.length, 'Numerando')
        })
        return [{ nome: trocarExtensao(item.arquivo.name, 'pdf', '-numerado'), blob: await salvarPdf(doc), detalhe: `${paginas.length - pular} páginas numeradas` }]
      }}
    />
  )
}
