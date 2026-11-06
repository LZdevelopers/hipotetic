import { ModeloConversao } from '../../componentes/ferramenta/ModeloConversao'
import { Seletor, Segmentado } from '../../componentes/ui'
import { obterPdfLib, salvarPdf } from '../../motores/pdf'
import { detectarTipo } from '../../nucleo/arquivos'
import { cancelado } from '../../nucleo/tarefa'

const PAPEIS = { a4: [595.28, 841.89], carta: [612, 792], a5: [419.53, 595.28] }

function Configuracoes({ opcoes, mudar }) {
  return (
    <div className="flex flex-col gap-5">
      <Seletor
        rotulo="Tamanho da página"
        valor={opcoes.papel}
        aoMudar={(v) => mudar('papel', v)}
        opcoes={[
          { valor: 'imagem', rotulo: 'Igual à imagem' },
          { valor: 'a4', rotulo: 'A4' },
          { valor: 'carta', rotulo: 'Carta' },
          { valor: 'a5', rotulo: 'A5' },
        ]}
      />
      {opcoes.papel !== 'imagem' ? (
        <>
          <Segmentado
            rotulo="Orientação"
            valor={opcoes.orientacao}
            aoMudar={(v) => mudar('orientacao', v)}
            opcoes={[
              { valor: 'auto', rotulo: 'Automática' },
              { valor: 'retrato', rotulo: 'Retrato' },
              { valor: 'paisagem', rotulo: 'Paisagem' },
            ]}
          />
          <Segmentado
            rotulo="Margem"
            valor={opcoes.margem}
            aoMudar={(v) => mudar('margem', v)}
            opcoes={[
              { valor: '0', rotulo: 'Sem' },
              { valor: '20', rotulo: 'Pequena' },
              { valor: '40', rotulo: 'Grande' },
            ]}
          />
        </>
      ) : null}
      <p className="text-xs text-fraca">Uma imagem por página, na ordem da lista.</p>
    </div>
  )
}

/** Imagem → bytes que o pdf-lib aceita (JPG ou PNG); outros formatos passam pelo canvas. */
async function paraEmbutir(arquivo) {
  const tipo = (await detectarTipo(arquivo))?.ext
  if (tipo === 'jpg' || tipo === 'png') return { tipo, bytes: new Uint8Array(await arquivo.arrayBuffer()) }
  const bmp = await createImageBitmap(arquivo, { imageOrientation: 'from-image' })
  const c = new OffscreenCanvas(bmp.width, bmp.height)
  c.getContext('2d').drawImage(bmp, 0, 0)
  const temAlfa = tipo === 'gif' || tipo === 'webp' || tipo === 'avif'
  const blob = await c.convertToBlob(temAlfa ? { type: 'image/png' } : { type: 'image/jpeg', quality: 0.92 })
  return { tipo: temAlfa ? 'png' : 'jpg', bytes: new Uint8Array(await blob.arrayBuffer()) }
}

/** JPEG com orientação EXIF ≠ 1 sai deitado no PDF: normaliza pelo canvas. */
async function orientacaoJpeg(arquivo) {
  const { default: exifr } = await import('exifr')
  return (await exifr.orientation(arquivo).catch(() => 1)) || 1
}

export default function DeImagens() {
  return (
    <ModeloConversao
      extensoes={['jpg', 'jpeg', 'png', 'webp', 'avif', 'gif', 'bmp']}
      descricaoFormatos="JPG, PNG, WebP, AVIF, GIF"
      limiteBytes={60 * 1024 * 1024}
      ordenavel
      aceitarColar
      maximo={300}
      opcoesIniciais={{ papel: 'a4', orientacao: 'auto', margem: '20' }}
      Configuracoes={Configuracoes}
      rotuloAcao="Criar PDF"
      processar={async (itens, o, { progresso, sinal }) => {
        const { PDFDocument } = await obterPdfLib()
        const doc = await PDFDocument.create()
        for (let i = 0; i < itens.length; i += 1) {
          cancelado(sinal)
          const arq = itens[i].arquivo
          let { tipo, bytes } = await paraEmbutir(arq)
          if (tipo === 'jpg' && (await orientacaoJpeg(arq)) !== 1) {
            const bmp = await createImageBitmap(arq, { imageOrientation: 'from-image' })
            const c = new OffscreenCanvas(bmp.width, bmp.height)
            c.getContext('2d').drawImage(bmp, 0, 0)
            bytes = new Uint8Array(await (await c.convertToBlob({ type: 'image/jpeg', quality: 0.92 })).arrayBuffer())
          }
          const img = tipo === 'jpg' ? await doc.embedJpg(bytes) : await doc.embedPng(bytes)
          if (o.papel === 'imagem') {
            // 1 px = 0,75 pt (96 dpi): a página fica do tamanho "natural" da imagem.
            const w = img.width * 0.75
            const h = img.height * 0.75
            doc.addPage([w, h]).drawImage(img, { x: 0, y: 0, width: w, height: h })
          } else {
            let [pw, ph] = PAPEIS[o.papel]
            const deitada = o.orientacao === 'paisagem' || (o.orientacao === 'auto' && img.width > img.height)
            if (deitada) [pw, ph] = [ph, pw]
            const m = Number(o.margem)
            const escala = Math.min((pw - 2 * m) / img.width, (ph - 2 * m) / img.height)
            const w = img.width * escala
            const h = img.height * escala
            doc.addPage([pw, ph]).drawImage(img, { x: (pw - w) / 2, y: (ph - h) / 2, width: w, height: h })
          }
          progresso((i + 1) / itens.length, `Adicionando (${i + 1} de ${itens.length})`)
        }
        return [{ nome: itens.length === 1 ? itens[0].arquivo.name.replace(/\.[^.]+$/, '.pdf') : 'imagens.pdf', blob: await salvarPdf(doc), detalhe: `${doc.getPageCount()} páginas` }]
      }}
    />
  )
}
