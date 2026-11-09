import { FORMATOS, opcoesPadrao } from '../../motores/conversor'
import { Deslizante, Entrada, Segmentado, Seletor } from '../ui'

/**
 * Ajustes opcionais de uma conversão (o padrão já é bom). Só aparecem os que
 * fazem sentido para o par origem → destino.
 */
export function OpcoesConversao({ entrada, destino, opcoes, mudar }) {
  const o = { ...opcoesPadrao(entrada, destino), ...opcoes }
  const grupo = FORMATOS[destino]?.grupo
  const campos = []

  if (typeof o.qualidade === 'number' && destino !== 'png') {
    campos.push(
      <Deslizante key="q" rotulo="Qualidade" valor={o.qualidade} aoMudar={(v) => mudar('qualidade', v)} min={10} max={100} formatar={(v) => `${v}%`} dica={o.qualidade >= 90 ? 'Quase sem perda visível; arquivo maior.' : o.qualidade >= 70 ? 'Bom equilíbrio entre qualidade e tamanho.' : 'Arquivo bem menor; detalhes finos podem borrar.'} />,
    )
  }
  if ('escalaSvg' in o) {
    campos.push(
      <Seletor
        key="svg"
        rotulo="Tamanho dos SVGs"
        valor={String(o.escalaSvg)}
        aoMudar={(v) => mudar('escalaSvg', Number(v))}
        opcoes={[
          { valor: '1', rotulo: '1× (tamanho original)' },
          { valor: '2', rotulo: '2× (telas retina)' },
          { valor: '4', rotulo: '4× (impressão)' },
          { valor: '8', rotulo: '8×' },
        ]}
      />,
    )
  }
  if ('dpi' in o) {
    campos.push(
      <Seletor
        key="dpi"
        rotulo="Resolução"
        valor={String(o.dpi)}
        aoMudar={(v) => mudar('dpi', Number(v))}
        opcoes={[
          { valor: '72', rotulo: '72 dpi · tela, arquivos pequenos' },
          { valor: '150', rotulo: '150 dpi · leitura confortável' },
          { valor: '200', rotulo: '200 dpi · boa nitidez' },
          { valor: '300', rotulo: '300 dpi · impressão' },
        ]}
      />,
      <Entrada key="pag" rotulo="Páginas" valor={o.paginas} aoMudar={(v) => mudar('paginas', v)} placeholder="Todas" dica="Vazio = todas. Ex.: 1-3, 5. Várias páginas saem num ZIP." />,
    )
  }
  if ('papel' in o) {
    campos.push(
      <Seletor
        key="papel"
        rotulo="Tamanho da página"
        valor={o.papel}
        aoMudar={(v) => mudar('papel', v)}
        opcoes={[
          { valor: 'imagem', rotulo: 'Igual à imagem' },
          { valor: 'a4', rotulo: 'A4' },
          { valor: 'carta', rotulo: 'Carta' },
          { valor: 'a5', rotulo: 'A5' },
        ]}
      />,
    )
    if (o.papel !== 'imagem') {
      campos.push(
        <Segmentado
          key="margem"
          rotulo="Margem"
          valor={String(o.margem)}
          aoMudar={(v) => mudar('margem', Number(v))}
          opcoes={[
            { valor: '0', rotulo: 'Sem' },
            { valor: '20', rotulo: 'Pequena' },
            { valor: '40', rotulo: 'Grande' },
          ]}
        />,
      )
    }
  }
  if ('largura' in o && 'fps' in o) {
    campos.push(
      <div key="trecho" className="grid grid-cols-2 gap-3">
        <Entrada rotulo="Início" valor={o.inicio} aoMudar={(v) => mudar('inicio', v)} placeholder="0:00" dica="minutos:segundos" />
        <Entrada rotulo="Fim" valor={o.fim} aoMudar={(v) => mudar('fim', v)} placeholder="até 30 s" />
      </div>,
      <Seletor
        key="largura"
        rotulo="Largura"
        valor={String(o.largura)}
        aoMudar={(v) => mudar('largura', Number(v))}
        opcoes={[240, 320, 480, 640, 800].map((v) => ({ valor: String(v), rotulo: `${v} px${v === 480 ? ' (recomendado)' : ''}` }))}
      />,
      <Segmentado key="fps" rotulo="Fluidez" valor={String(o.fps)} aoMudar={(v) => mudar('fps', Number(v))} opcoes={[8, 12, 15, 24].map((v) => ({ valor: String(v), rotulo: `${v} fps` }))} />,
    )
  }
  if (grupo === 'video' && typeof o.qualidade === 'string') {
    campos.push(
      <Segmentado
        key="qv"
        rotulo="Qualidade"
        valor={o.qualidade}
        aoMudar={(v) => mudar('qualidade', v)}
        opcoes={[
          { valor: 'baixa', rotulo: 'Menor' },
          { valor: 'media', rotulo: 'Média' },
          { valor: 'alta', rotulo: 'Alta' },
          { valor: 'muito_alta', rotulo: 'Máxima' },
        ]}
      />,
      <Seletor
        key="res"
        rotulo="Resolução"
        valor={String(o.resolucao)}
        aoMudar={(v) => mudar('resolucao', Number(v))}
        opcoes={[
          { valor: '0', rotulo: 'Manter a original' },
          { valor: '1080', rotulo: 'Full HD (1080p)' },
          { valor: '720', rotulo: 'HD (720p)' },
          { valor: '480', rotulo: '480p' },
          { valor: '360', rotulo: '360p' },
        ]}
        dica="Nunca aumentamos o vídeo: se ele já for menor, fica como está."
      />,
    )
  }
  if ('bitrate' in o) {
    campos.push(
      <Seletor
        key="br"
        rotulo="Qualidade do áudio"
        valor={String(o.bitrate)}
        aoMudar={(v) => mudar('bitrate', Number(v))}
        opcoes={[
          { valor: '96', rotulo: '96 kbps · voz, podcast' },
          { valor: '128', rotulo: '128 kbps · bom' },
          { valor: '192', rotulo: '192 kbps · muito bom' },
          { valor: '256', rotulo: '256 kbps · excelente' },
          { valor: '320', rotulo: '320 kbps · máximo' },
        ]}
      />,
    )
  }

  if (!campos.length) return <p className="text-sm text-fraca">Esta conversão não tem ajustes: sai com a melhor qualidade possível.</p>
  return <div className="grid gap-4 sm:grid-cols-2">{campos}</div>
}
