import { useState } from 'react'
import { ModeloConversao } from '../../componentes/ferramenta/ModeloConversao'
import { SeletorArquivos } from '../../componentes/ferramenta/SeletorArquivos'
import { Campo, Deslizante, Entrada, Segmentado } from '../../componentes/ui'
import { LIMITE_PDF, abrirEdicao, salvarPdf } from '../../motores/pdf'
import { cor, fontePadrao, pontoNaPagina, tamanhoVisual, textoSeguro } from '../../motores/pdf/escrita'
import { detectarTipo, trocarExtensao } from '../../nucleo/arquivos'
import { ErroAmigavel } from '../../nucleo/tarefa'
import { CorDeFundo } from '../imagem/_comum'

function Configuracoes({ opcoes, mudar }) {
  const [logo, setLogo] = useState(opcoes.logo ? [opcoes.logo] : [])
  return (
    <div className="flex flex-col gap-5">
      <Segmentado
        rotulo="Tipo"
        valor={opcoes.tipo}
        aoMudar={(v) => mudar('tipo', v)}
        opcoes={[
          { valor: 'texto', rotulo: 'Texto', icone: 'tipo' },
          { valor: 'imagem', rotulo: 'Imagem', icone: 'imagem' },
        ]}
      />
      {opcoes.tipo === 'texto' ? (
        <>
          <Entrada rotulo="Texto" valor={opcoes.texto} aoMudar={(v) => mudar('texto', v)} maxLength={80} />
          <Deslizante rotulo="Tamanho" valor={opcoes.tamanho} aoMudar={(v) => mudar('tamanho', v)} min={12} max={140} formatar={(v) => `${v} pt`} />
          <CorDeFundo valor={opcoes.cor} aoMudar={(v) => mudar('cor', v)} rotulo="Cor" />
        </>
      ) : (
        <Campo rotulo="Imagem (PNG com transparência fica melhor)">
          <SeletorArquivos
            arquivos={logo}
            aoMudar={(l) => {
              setLogo(l)
              mudar('logo', l[0] ?? null)
            }}
            multiplos={false}
            extensoes={['png', 'jpg', 'jpeg']}
            descricaoFormatos="PNG ou JPG"
            compacto
          />
        </Campo>
      )}
      {opcoes.tipo === 'imagem' ? <Deslizante rotulo="Largura da imagem" valor={opcoes.escala} aoMudar={(v) => mudar('escala', v)} min={5} max={100} formatar={(v) => `${v}% da página`} /> : null}
      <Segmentado
        rotulo="Disposição"
        valor={opcoes.disposicao}
        aoMudar={(v) => mudar('disposicao', v)}
        opcoes={[
          { valor: 'diagonal', rotulo: 'Diagonal' },
          { valor: 'centro', rotulo: 'Centro' },
          { valor: 'mosaico', rotulo: 'Mosaico' },
        ]}
      />
      <Deslizante rotulo="Opacidade" valor={opcoes.opacidade} aoMudar={(v) => mudar('opacidade', v)} min={5} max={100} formatar={(v) => `${v}%`} />
    </div>
  )
}

export default function MarcaDagua() {
  return (
    <ModeloConversao
      extensoes={['pdf']}
      descricaoFormatos="PDF"
      limiteBytes={LIMITE_PDF}
      multiplos={false}
      opcoesIniciais={{ tipo: 'texto', texto: 'CONFIDENCIAL', tamanho: 64, cor: '#c8242b', disposicao: 'diagonal', opacidade: 20, logo: null, escala: 40 }}
      Configuracoes={Configuracoes}
      validarOpcoes={(o) => (o.tipo === 'texto' && !o.texto.trim() ? 'Escreva o texto da marca d’água.' : o.tipo === 'imagem' && !o.logo ? 'Escolha a imagem da marca d’água.' : null)}
      rotuloAcao="Aplicar marca d’água"
      processar={async ([item], o, { progresso }) => {
        const doc = await abrirEdicao(item.arquivo)
        const opacity = o.opacidade / 100
        let desenhar
        if (o.tipo === 'texto') {
          const fonte = await fontePadrao(doc, true)
          const texto = textoSeguro(fonte, o.texto.trim())
          const color = await cor(o.cor)
          const largura = fonte.widthOfTextAtSize(texto, o.tamanho)
          const altura = fonte.heightAtSize(o.tamanho) * 0.7
          desenhar = (pagina, cx, cy, angulo) => {
            // (cx, cy) é o centro do texto; gira em torno dele.
            const rad = (angulo * Math.PI) / 180
            const vx = cx - (largura / 2) * Math.cos(rad) + (altura / 2) * Math.sin(rad)
            const vy = cy - (largura / 2) * Math.sin(rad) - (altura / 2) * Math.cos(rad)
            const { x, y, giro } = pontoNaPagina(pagina, vx, vy)
            pagina.drawText(texto, { x, y, size: o.tamanho, font: fonte, color, opacity, rotate: { type: 'degrees', angle: angulo + giro } })
          }
        } else {
          const tipo = (await detectarTipo(o.logo.arquivo))?.ext
          const bytes = new Uint8Array(await o.logo.arquivo.arrayBuffer())
          if (tipo !== 'png' && tipo !== 'jpg') throw new ErroAmigavel('A imagem precisa ser PNG ou JPG.')
          const img = tipo === 'png' ? await doc.embedPng(bytes) : await doc.embedJpg(bytes)
          desenhar = (pagina, cx, cy, angulo, W) => {
            const w = (W * o.escala) / 100
            const h = (w * img.height) / img.width
            const rad = (angulo * Math.PI) / 180
            const vx = cx - (w / 2) * Math.cos(rad) + (h / 2) * Math.sin(rad)
            const vy = cy - (w / 2) * Math.sin(rad) - (h / 2) * Math.cos(rad)
            const { x, y, giro } = pontoNaPagina(pagina, vx, vy)
            pagina.drawImage(img, { x, y, width: w, height: h, opacity, rotate: { type: 'degrees', angle: angulo + giro } })
          }
        }
        const paginas = doc.getPages()
        paginas.forEach((pagina, i) => {
          const { largura: W, altura: H } = tamanhoVisual(pagina)
          if (o.disposicao === 'mosaico') {
            const passoX = W / 3
            const passoY = H / 4
            for (let lin = 0; lin < 4; lin += 1) for (let col = 0; col < 3; col += 1) desenhar(pagina, passoX * (col + 0.5) + (lin % 2 ? passoX / 4 : -passoX / 4), passoY * (lin + 0.5), 30, W / 3)
          } else {
            desenhar(pagina, W / 2, H / 2, o.disposicao === 'diagonal' ? (Math.atan2(H, W) * 180) / Math.PI : 0, W)
          }
          progresso((i + 1) / paginas.length, 'Aplicando')
        })
        return [{ nome: trocarExtensao(item.arquivo.name, 'pdf', '-marca-dagua'), blob: await salvarPdf(doc), detalhe: `${paginas.length} páginas` }]
      }}
    />
  )
}
