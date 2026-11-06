import { ModeloConversao } from '../../componentes/ferramenta/ModeloConversao'
import { Entrada, Segmentado } from '../../componentes/ui'
import { DESCRICAO_VIDEO, EXTENSOES_VIDEO, LIMITE_VIDEO, infoMidia, processarVideo } from '../../motores/midia'
import { trocarExtensao } from '../../nucleo/arquivos'
import { ErroAmigavel, cancelado } from '../../nucleo/tarefa'
import { medidasPara, nomeMotor } from './_comum'

const NIVEIS = {
  leve: { qualidade: 'alta', lado: 1080 },
  recomendado: { qualidade: 'media', lado: 720 },
  forte: { qualidade: 'baixa', lado: 480 },
}

function Configuracoes({ opcoes, mudar }) {
  return (
    <div className="flex flex-col gap-5">
      <Segmentado
        rotulo="Como comprimir"
        valor={opcoes.modo}
        aoMudar={(v) => mudar('modo', v)}
        opcoes={[
          { valor: 'nivel', rotulo: 'Por nível' },
          { valor: 'tamanho', rotulo: 'Tamanho final' },
        ]}
      />
      {opcoes.modo === 'nivel' ? (
        <Segmentado
          rotulo="Compressão"
          valor={opcoes.nivel}
          aoMudar={(v) => mudar('nivel', v)}
          opcoes={[
            { valor: 'leve', rotulo: 'Leve' },
            { valor: 'recomendado', rotulo: 'Recomendada' },
            { valor: 'forte', rotulo: 'Forte' },
          ]}
          dica={{ leve: 'Até 1080p, qualidade alta.', recomendado: 'Até 720p: ótimo para WhatsApp e e-mail.', forte: 'Até 480p: o menor arquivo.' }[opcoes.nivel]}
        />
      ) : (
        <Entrada
          rotulo="Tamanho máximo"
          type="number"
          min="1"
          sufixo="MB"
          valor={opcoes.mb}
          aoMudar={(v) => mudar('mb', v)}
          dica="Calculamos a qualidade para caber nesse tamanho (ex.: 16 MB para o WhatsApp, 25 MB para e-mail)."
        />
      )}
    </div>
  )
}

/** Comprimir vídeo: por nível ou para caber num tamanho. Sempre MP4 (H.264), o mais compatível. */
export default function Comprimir() {
  return (
    <ModeloConversao
      extensoes={EXTENSOES_VIDEO}
      descricaoFormatos={DESCRICAO_VIDEO}
      limiteBytes={LIMITE_VIDEO}
      multiplos={false}
      opcoesIniciais={{ modo: 'nivel', nivel: 'recomendado', mb: '16' }}
      Configuracoes={Configuracoes}
      validarOpcoes={(o) => (o.modo === 'tamanho' && !(Number(o.mb) > 0) ? 'Informe o tamanho máximo em MB.' : null)}
      rotuloAcao="Comprimir vídeo"
      processar={async ([item], o, { progresso, sinal }) => {
        const info = await infoMidia(item.arquivo)
        cancelado(sinal)
        let opcoes
        if (o.modo === 'nivel') {
          const n = NIVEIS[o.nivel]
          opcoes = { formato: 'mp4', qualidade: n.qualidade, ...medidasPara(info, n.lado), forcar: true }
        } else {
          if (!info.duracao) throw new ErroAmigavel('Não foi possível ler a duração deste vídeo para calcular o tamanho.')
          // bits disponíveis − áudio (128 kb/s), com 5% de folga para o contêiner.
          const bits = Number(o.mb) * 8 * 1024 * 1024 * 0.95
          const bitrate = Math.floor(bits / info.duracao - (info.temAudio ? 128_000 : 0))
          if (bitrate < 150_000) throw new ErroAmigavel(`${o.mb} MB é pouco para ${Math.round(info.duracao)} segundos de vídeo. Aumente o tamanho ou corte o vídeo antes.`)
          // Bitrate baixo fica melhor em resolução menor.
          const lado = bitrate < 600_000 ? 480 : bitrate < 1_500_000 ? 720 : 1080
          opcoes = { formato: 'mp4', qualidade: bitrate, ...medidasPara(info, lado), forcar: true }
        }
        const { blob, motor } = await processarVideo(item.arquivo, opcoes, { progresso, sinal })
        if (blob.size >= item.arquivo.size) {
          return [{ nome: item.arquivo.name, blob: item.arquivo, original: item.arquivo.size, detalhe: 'já estava menor que isso: mantido o original' }]
        }
        return [{ nome: trocarExtensao(item.arquivo.name, 'mp4', '-comprimido'), blob, original: item.arquivo.size, detalhe: nomeMotor(motor) }]
      }}
    />
  )
}
