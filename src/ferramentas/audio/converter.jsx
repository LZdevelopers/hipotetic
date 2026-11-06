import { ModeloConversao } from '../../componentes/ferramenta/ModeloConversao'
import { Segmentado } from '../../componentes/ui'
import { executarFfmpeg } from '../../motores/ffmpeg'
import { DESCRICAO_AUDIO, DESCRICAO_VIDEO, EXTENSOES_AUDIO, EXTENSOES_VIDEO, FORMATOS_AUDIO, LIMITE_VIDEO, infoMidia, processarAudio } from '../../motores/midia'
import { extensaoDe, formatarDuracao, trocarExtensao } from '../../nucleo/arquivos'
import { ErroAmigavel, cancelado } from '../../nucleo/tarefa'
import { Bitrate, FormatoAudio } from './_comum'

function Configuracoes({ opcoes, mudar }) {
  return (
    <div className="flex flex-col gap-5">
      <FormatoAudio valor={opcoes.formato} aoMudar={(v) => mudar('formato', v)} comOriginal={opcoes.deVideo} />
      <Bitrate valor={opcoes.bitrate} aoMudar={(v) => mudar('bitrate', v)} formato={opcoes.formato} />
      {opcoes.formato !== 'original' ? (
        <Segmentado
          rotulo="Canais"
          valor={opcoes.canais}
          aoMudar={(v) => mudar('canais', v)}
          opcoes={[
            { valor: '', rotulo: 'Manter' },
            { valor: '1', rotulo: 'Mono' },
            { valor: '2', rotulo: 'Estéreo' },
          ]}
        />
      ) : null}
    </div>
  )
}

/** Extensão e MIME para copiar o áudio sem recodificar, pelo codec de origem. */
const COPIA = { aac: ['m4a', 'audio/mp4'], mp3: ['mp3', 'audio/mpeg'], opus: ['opus', 'audio/ogg'], vorbis: ['ogg', 'audio/ogg'], flac: ['flac', 'audio/flac'] }

/**
 * Converter áudio — ou extrair o áudio de vídeos (`deVideo`). As páginas
 * específicas (WAV para MP3…) passam `entrada` e `saida`.
 */
export default function ConverterAudio({ entrada, saida = 'mp3', deVideo = false }) {
  const extensoes = entrada ? [entrada] : deVideo ? EXTENSOES_VIDEO : [...EXTENSOES_AUDIO, ...EXTENSOES_VIDEO]
  return (
    <ModeloConversao
      extensoes={extensoes}
      descricaoFormatos={entrada ? entrada.toUpperCase() : deVideo ? DESCRICAO_VIDEO : `${DESCRICAO_AUDIO} (ou vídeo)`}
      limiteBytes={LIMITE_VIDEO}
      maximo={50}
      opcoesIniciais={{ formato: saida, bitrate: 192, canais: '', deVideo }}
      Configuracoes={Configuracoes}
      rotuloAcao={deVideo ? 'Extrair áudio' : 'Converter'}
      nomeZip="audios.zip"
      processar={async (itens, o, { progresso, sinal }) => {
        const saidas = []
        for (let i = 0; i < itens.length; i += 1) {
          cancelado(sinal)
          const { arquivo } = itens[i]
          const info = await infoMidia(arquivo).catch(() => ({}))
          if (info.temAudio === false) throw new ErroAmigavel(`“${arquivo.name}” não tem áudio.`)
          const ctx = { progresso: (v, r) => progresso(v == null ? null : (i + v) / itens.length, itens.length > 1 ? `${r ?? 'Processando'} (${i + 1} de ${itens.length})` : r), sinal }
          let blob
          let ext = o.formato
          if (o.formato === 'original') {
            const copia = COPIA[info.codecAudio]
            if (!copia) throw new ErroAmigavel(`O áudio de “${arquivo.name}” (${info.codecAudio ?? 'desconhecido'}) não pode ser copiado direto. Escolha MP3 ou M4A.`)
            ;[ext] = copia
            const entradaNome = `entrada.${extensaoDe(arquivo.name) || 'mp4'}`
            const dados = await executarFfmpeg({ entradas: [{ nome: entradaNome, dados: arquivo }], args: ['-i', entradaNome, '-vn', '-map', '0:a:0', '-c:a', 'copy'], saida: `saida.${ext}`, aoProgredir: ctx.progresso, sinal, rotulo: 'Extraindo' })
            blob = new Blob([dados], { type: copia[1] })
          } else {
            blob = await processarAudio(arquivo, { formato: o.formato, bitrate: o.bitrate, canais: o.canais || undefined }, ctx, info.duracao)
          }
          saidas.push({ nome: trocarExtensao(arquivo.name, ext), blob, original: deVideo ? undefined : arquivo.size, detalhe: [info.duracao ? formatarDuracao(info.duracao) : null, FORMATOS_AUDIO[ext]?.semPerdas ? 'sem perdas' : o.formato === 'original' ? 'cópia exata' : `${o.bitrate} kbps`].filter(Boolean).join(' · ') })
        }
        return saidas
      }}
    />
  )
}
