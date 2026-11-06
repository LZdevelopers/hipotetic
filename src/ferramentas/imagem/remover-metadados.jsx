import { ModeloConversao } from '../../componentes/ferramenta/ModeloConversao'
import { removerMetadados } from '../../motores/imagem/metadados'
import { detectarTipo } from '../../nucleo/arquivos'
import { ErroAmigavel, cancelado } from '../../nucleo/tarefa'

/**
 * Remove EXIF (inclusive GPS), XMP, IPTC e comentários sem recodificar:
 * a imagem fica idêntica, pixel por pixel. Tudo no navegador.
 */
export default function RemoverMetadados() {
  return (
    <ModeloConversao
      extensoes={['jpg', 'jpeg', 'png', 'webp']}
      descricaoFormatos="JPG, PNG, WebP"
      limiteBytes={100 * 1024 * 1024}
      aceitarColar
      rotuloAcao="Remover metadados"
      nomeZip="imagens-sem-metadados.zip"
      aviso="A localização (GPS), a câmera, as datas e o software saem. A imagem não é recomprimida: a qualidade fica exatamente a mesma."
      processar={async (itens, _o, { progresso, sinal }) => {
        const saida = []
        for (let i = 0; i < itens.length; i += 1) {
          cancelado(sinal)
          const { arquivo } = itens[i]
          const tipo = (await detectarTipo(arquivo))?.ext
          let r
          try {
            r = await removerMetadados(arquivo, tipo === 'jpeg' ? 'jpg' : tipo)
          } catch {
            throw new ErroAmigavel(`Não foi possível ler “${arquivo.name}”: o arquivo parece corrompido.`)
          }
          saida.push({
            nome: arquivo.name,
            blob: new Blob([r.dados], { type: r.mime }),
            original: arquivo.size,
            detalhe: r.removidos ? `${r.removidos} ${r.removidos === 1 ? 'bloco removido' : 'blocos removidos'}` : 'não tinha metadados',
          })
          progresso((i + 1) / itens.length, `Limpando (${i + 1} de ${itens.length})`)
        }
        return saida
      }}
    />
  )
}
