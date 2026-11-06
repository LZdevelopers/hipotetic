import { ModeloConversao } from '../../componentes/ferramenta/ModeloConversao'
import { Segmentado, Seletor } from '../../componentes/ui'
import { IDIOMAS_OCR, criarOcr, reconhecer } from '../../motores/ocr'
import { LIMITE_PDF, abrirEdicao, abrirLeitura, desenharPagina, obterPdfLib, salvarPdf } from '../../motores/pdf'
import { fontePadrao, pontoNaPagina, tamanhoVisual, textoSeguro } from '../../motores/pdf/escrita'
import { detectarTipo, semExtensao } from '../../nucleo/arquivos'
import { ErroAmigavel, cancelado } from '../../nucleo/tarefa'

const DPI = 200

function Configuracoes({ opcoes, mudar }) {
  return (
    <div className="flex flex-col gap-5">
      <Seletor rotulo="Idioma do documento" valor={opcoes.idioma} aoMudar={(v) => mudar('idioma', v)} opcoes={IDIOMAS_OCR} />
      <Segmentado
        rotulo="Resultado"
        valor={opcoes.saida}
        aoMudar={(v) => mudar('saida', v)}
        opcoes={[
          { valor: 'pdf', rotulo: 'PDF pesquisável' },
          { valor: 'txt', rotulo: 'Só o texto' },
          { valor: 'ambos', rotulo: 'Os dois' },
        ]}
        dica={opcoes.saida === 'txt' ? 'Um arquivo .txt com o texto reconhecido.' : 'O mesmo documento, com o texto por trás da imagem: dá para buscar, selecionar e copiar.'}
      />
      <p className="text-xs text-fraca">O reconhecimento roda no seu aparelho: leva de alguns segundos a meio minuto por página.</p>
    </div>
  )
}

/**
 * Escreve as palavras reconhecidas por trás da página, invisíveis (opacidade
 * 0): a aparência não muda, mas o texto fica pesquisável e selecionável.
 */
function escreverCamada(pagina, palavras, escalaPx, fonte) {
  const { altura: H } = tamanhoVisual(pagina)
  for (const p of palavras) {
    const texto = textoSeguro(fonte, p.texto)
    if (!texto.trim()) continue
    const w = (p.x1 - p.x0) / escalaPx
    const h = (p.y1 - p.y0) / escalaPx
    const larguraUnitaria = fonte.widthOfTextAtSize(texto, 1) || 1
    const tamanho = Math.max(1, Math.min(h * 1.05, w / larguraUnitaria))
    const { x, y, giro } = pontoNaPagina(pagina, p.x0 / escalaPx, H - p.y1 / escalaPx + h * 0.15)
    pagina.drawText(texto, { x, y, size: tamanho, font: fonte, opacity: 0, rotate: { type: 'degrees', angle: giro } })
  }
}

export default function Ocr() {
  return (
    <ModeloConversao
      extensoes={['pdf', 'jpg', 'jpeg', 'png', 'webp']}
      descricaoFormatos="PDF digitalizado ou imagens (JPG, PNG)"
      limiteBytes={LIMITE_PDF}
      multiplos={false}
      opcoesIniciais={{ idioma: 'por', saida: 'pdf' }}
      Configuracoes={Configuracoes}
      rotuloAcao="Reconhecer texto"
      processar={async ([item], o, { progresso, sinal }) => {
        const tipo = (await detectarTipo(item.arquivo))?.ext
        let paginaAtual = 0
        let totalPaginas = 1
        const ocr = await criarOcr(o.idioma, (v, rotulo) => {
          if (rotulo) progresso(null, rotulo)
          else progresso((paginaAtual + (v ?? 0)) / totalPaginas, `Reconhecendo a página ${paginaAtual + 1} de ${totalPaginas}`)
        })
        sinal?.addEventListener('abort', () => ocr.terminate(), { once: true })
        try {
          const textos = []
          const base = semExtensao(item.arquivo.name)
          let pdf
          let fonte
          if (tipo === 'pdf') {
            const leitura = await abrirLeitura(item.arquivo)
            pdf = o.saida === 'txt' ? null : await abrirEdicao(item.arquivo)
            fonte = pdf ? await fontePadrao(pdf) : null
            totalPaginas = leitura.numPages
            if (totalPaginas > 200) throw new ErroAmigavel('O OCR aceita até 200 páginas por vez. Divida o PDF antes.')
            try {
              for (paginaAtual = 0; paginaAtual < totalPaginas; paginaAtual += 1) {
                cancelado(sinal)
                const canvas = await desenharPagina(leitura, paginaAtual + 1, DPI / 72, { sinal })
                const r = await reconhecer(ocr, canvas)
                textos.push(r.texto.trim())
                if (pdf) escreverCamada(pdf.getPage(paginaAtual), r.palavras, DPI / 72, fonte)
                canvas.width = 0
              }
            } finally {
              leitura.destroy()
            }
          } else {
            // Imagem: vira uma página de PDF do tamanho dela, com a camada de texto.
            const r = await reconhecer(ocr, item.arquivo)
            textos.push(r.texto.trim())
            if (o.saida !== 'txt') {
              const { PDFDocument } = await obterPdfLib()
              pdf = await PDFDocument.create()
              fonte = await fontePadrao(pdf)
              const bmp = await createImageBitmap(item.arquivo, { imageOrientation: 'from-image' })
              const c = new OffscreenCanvas(bmp.width, bmp.height)
              c.getContext('2d').drawImage(bmp, 0, 0)
              const jpg = await pdf.embedJpg(new Uint8Array(await (await c.convertToBlob({ type: 'image/jpeg', quality: 0.9 })).arrayBuffer()))
              const escala = 72 / 150 // considera a imagem em 150 dpi
              const pagina = pdf.addPage([bmp.width * escala, bmp.height * escala])
              pagina.drawImage(jpg, { x: 0, y: 0, width: bmp.width * escala, height: bmp.height * escala })
              escreverCamada(pagina, r.palavras, 1 / escala, fonte)
            }
          }

          const texto = textos.map((t, i) => (textos.length > 1 ? `--- Página ${i + 1} ---\n${t}` : t)).join('\n\n')
          if (!texto.replace(/---[^\n]*---/g, '').trim()) throw new ErroAmigavel('Nenhum texto foi reconhecido. Confira o idioma e se a imagem está nítida e na posição certa.')
          const saida = []
          if (pdf) saida.push({ nome: `${base}-pesquisavel.pdf`, blob: await salvarPdf(pdf), detalhe: `${totalPaginas} ${totalPaginas === 1 ? 'página' : 'páginas'} com texto` })
          if (o.saida !== 'pdf') saida.push({ nome: `${base}.txt`, blob: new Blob([texto], { type: 'text/plain;charset=utf-8' }), detalhe: `${texto.split(/\s+/).filter(Boolean).length.toLocaleString('pt-BR')} palavras` })
          return saida
        } finally {
          await ocr.terminate().catch(() => {})
        }
      }}
    />
  )
}
