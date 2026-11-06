import { Seletor } from '../../componentes/ui'
import { FORMATOS_AUDIO } from '../../motores/midia'

export function FormatoAudio({ valor, aoMudar, comOriginal = false, comManter = false }) {
  const opcoes = [
    ...(comManter ? [{ valor: 'manter', rotulo: 'Mesmo formato do arquivo' }] : []),
    ...(comOriginal ? [{ valor: 'original', rotulo: 'Original (sem recodificar)' }] : []),
    ...Object.entries(FORMATOS_AUDIO).map(([v, f]) => ({ valor: v, rotulo: f.rotulo })),
  ]
  const dicas = {
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
  return <Seletor rotulo="Formato de saída" valor={valor} aoMudar={aoMudar} opcoes={opcoes} dica={dicas[valor]} />
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
