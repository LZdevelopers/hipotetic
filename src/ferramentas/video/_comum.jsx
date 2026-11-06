import { Segmentado, Seletor } from '../../componentes/ui'

/** Controles e utilidades repetidos nas ferramentas de vídeo. */

export const FORMATOS_VIDEO = [
  { valor: 'mp4', rotulo: 'MP4' },
  { valor: 'webm', rotulo: 'WebM' },
  { valor: 'mov', rotulo: 'MOV' },
  { valor: 'mkv', rotulo: 'MKV' },
]

export function EscolhaFormatoVideo({ valor, aoMudar, rotulo = 'Formato de saída' }) {
  const dicas = {
    mp4: 'Abre em qualquer aparelho, rede social e programa. A escolha mais segura.',
    webm: 'Formato aberto da web (VP9). Ótimo para sites; menos aceito em programas de edição.',
    mov: 'Padrão da Apple (QuickTime). Bom para iPhone, Mac e Final Cut.',
    mkv: 'Contêiner flexível, comum em filmes e séries.',
  }
  return <Segmentado rotulo={rotulo} valor={valor} aoMudar={aoMudar} opcoes={FORMATOS_VIDEO} dica={dicas[valor]} />
}

export function QualidadeVideo({ valor, aoMudar }) {
  return (
    <Segmentado
      rotulo="Qualidade"
      valor={valor}
      aoMudar={aoMudar}
      opcoes={[
        { valor: 'baixa', rotulo: 'Menor' },
        { valor: 'media', rotulo: 'Média' },
        { valor: 'alta', rotulo: 'Alta' },
        { valor: 'muito_alta', rotulo: 'Máxima' },
      ]}
      dica={{ baixa: 'Arquivo pequeno, para enviar rápido.', media: 'Boa para redes sociais e mensagens.', alta: 'Quase igual ao original.', muito_alta: 'Prioriza a qualidade; arquivo maior.' }[valor]}
    />
  )
}

export function Resolucao({ valor, aoMudar }) {
  return (
    <Seletor
      rotulo="Resolução"
      valor={String(valor)}
      aoMudar={(v) => aoMudar(Number(v))}
      opcoes={[
        { valor: '0', rotulo: 'Manter a original' },
        { valor: '2160', rotulo: '4K (2160p)' },
        { valor: '1440', rotulo: '1440p' },
        { valor: '1080', rotulo: 'Full HD (1080p)' },
        { valor: '720', rotulo: 'HD (720p)' },
        { valor: '480', rotulo: '480p' },
        { valor: '360', rotulo: '360p' },
      ]}
      dica="Nunca aumentamos o vídeo: se ele já for menor, fica como está."
    />
  )
}

export function Fps({ valor, aoMudar }) {
  return (
    <Seletor
      rotulo="Quadros por segundo"
      valor={String(valor)}
      aoMudar={(v) => aoMudar(Number(v))}
      opcoes={[
        { valor: '0', rotulo: 'Manter o original' },
        { valor: '60', rotulo: '60 fps' },
        { valor: '30', rotulo: '30 fps' },
        { valor: '24', rotulo: '24 fps (cinema)' },
        { valor: '15', rotulo: '15 fps' },
      ]}
    />
  )
}

/**
 * Medidas de saída para "lado menor no máximo N" (720p = 720 no lado menor,
 * vale para vídeo deitado e em pé). Sem aumentar. Pares, como o H.264 exige.
 */
export function medidasPara(info, ladoMenor) {
  if (!ladoMenor || !info?.largura || !info?.altura) return {}
  const menor = Math.min(info.largura, info.altura)
  if (menor <= ladoMenor) return {}
  const escala = ladoMenor / menor
  return { largura: Math.round((info.largura * escala) / 2) * 2, altura: Math.round((info.altura * escala) / 2) * 2 }
}

export const nomeMotor = (motor) => (motor === 'navegador' ? 'acelerado pelo navegador' : 'convertido em WebAssembly')
