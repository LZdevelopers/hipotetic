import { OpcoesCartoes } from '../../componentes/ferramenta/Baixar'
import { Seletor } from '../../componentes/ui'
import { FORMATOS_AUDIO } from '../../motores/midia'

export const DICAS_FORMATO_AUDIO = {
  manter: 'Cada arquivo sai no formato em que entrou (MP3 continua MP3…).',
  original: 'Copia o áudio exatamente como está no vídeo: instantâneo e sem perda.',
  mp3: 'Toca em qualquer lugar. A escolha mais segura.',
  m4a: 'AAC: melhor qualidade que MP3 no mesmo tamanho. Padrão da Apple.',
  aac: 'AAC “puro” (ADTS). Prefira M4A, a não ser que o aparelho peça .aac.',
  ogg: 'Formato aberto. Bom para jogos e sites.',
  opus: 'O mais eficiente para voz e música na web. Programas antigos podem não abrir.',
  wav: 'Sem compressão: qualidade máxima e arquivo grande. Para edição.',
  flac: 'Sem perdas, cerca de metade do WAV. Para quem coleciona música.',
}
const CURTAS = { mp3: 'Toca em tudo', m4a: 'AAC · Apple', aac: 'AAC puro', ogg: 'Formato aberto', opus: 'Ótimo para voz', wav: 'Sem compressão', flac: 'Sem perdas' }
const QUALIDADES = [
  [96, 'Voz, podcast'],
  [128, 'Bom'],
  [192, 'Muito bom'],
  [256, 'Excelente'],
  [320, 'Máximo'],
]

/** Opções de áudio do modal de baixar: formato e qualidade (kbps). */
export function OpcoesSaidaAudio({ formato, bitrate, aoMudar }) {
  return (
    <>
      <OpcoesCartoes
        rotulo="Formato"
        valor={formato}
        aoMudar={(v) => aoMudar({ formato: v })}
        opcoes={Object.entries(FORMATOS_AUDIO).map(([v, f]) => ({ valor: v, rotulo: f.rotulo, dica: CURTAS[v] }))}
      />
      {FORMATOS_AUDIO[formato]?.semPerdas ? (
        <p className="-mt-2 text-xs text-fraca">{DICAS_FORMATO_AUDIO[formato]}</p>
      ) : (
        <OpcoesCartoes
          rotulo="Qualidade"
          valor={bitrate}
          aoMudar={(v) => aoMudar({ bitrate: v })}
          colunas="grid-cols-3 sm:grid-cols-5"
          opcoes={QUALIDADES.map(([k, d]) => ({ valor: k, rotulo: `${k} kbps`, dica: d }))}
        />
      )}
    </>
  )
}

export function FormatoAudio({ valor, aoMudar, comOriginal = false, comManter = false }) {
  const opcoes = [
    ...(comManter ? [{ valor: 'manter', rotulo: 'Mesmo formato do arquivo' }] : []),
    ...(comOriginal ? [{ valor: 'original', rotulo: 'Original (sem recodificar)' }] : []),
    ...Object.entries(FORMATOS_AUDIO).map(([v, f]) => ({ valor: v, rotulo: f.rotulo })),
  ]
  return <Seletor rotulo="Formato de saída" valor={valor} aoMudar={aoMudar} opcoes={opcoes} dica={DICAS_FORMATO_AUDIO[valor]} />
}

export function Bitrate({ valor, aoMudar, formato }) {
  if (FORMATOS_AUDIO[formato]?.semPerdas || formato === 'original') return null
  // 'manter' mostra a qualidade: vale para os formatos com perdas.
  return (
    <Seletor
      rotulo="Qualidade"
      valor={String(valor)}
      aoMudar={(v) => aoMudar(Number(v))}
      opcoes={[
        { valor: '96', rotulo: '96 kbps · voz, podcast' },
        { valor: '128', rotulo: '128 kbps · bom' },
        { valor: '192', rotulo: '192 kbps · muito bom' },
        { valor: '256', rotulo: '256 kbps · excelente' },
        { valor: '320', rotulo: '320 kbps · máximo' },
      ]}
    />
  )
}
