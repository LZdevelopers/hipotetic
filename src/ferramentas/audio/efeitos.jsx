import { ModeloConversao } from '../../componentes/ferramenta/ModeloConversao'
import { Caixa, Deslizante, Segmentado, Seletor } from '../../componentes/ui'
import { DESCRICAO_AUDIO, EXTENSOES_AUDIO, LIMITE_AUDIO, filtroVelocidadeAudio, infoMidia, processarAudio } from '../../motores/midia'
import { extensaoDe, formatarDuracao, trocarExtensao } from '../../nucleo/arquivos'
import { cancelado } from '../../nucleo/tarefa'
import { Bitrate, FormatoAudio } from './_comum'

/**
 * Efeitos de áudio em lote, cada um uma página: volume, remover silêncio e
 * velocidade. Mesma estrutura; muda o filtro do ffmpeg e as configurações.
 */
const EFEITOS = {
  volume: {
    rotulo: 'Ajustar volume',
    iniciais: { modo: 'ganho', ganho: 6 },
    Configuracoes: ({ opcoes, mudar }) => (
      <>
        <Segmentado
          rotulo="Como ajustar"
          valor={opcoes.modo}
          aoMudar={(v) => mudar('modo', v)}
          opcoes={[
            { valor: 'ganho', rotulo: 'Aumentar/diminuir' },
            { valor: 'normalizar', rotulo: 'Normalizar' },
          ]}
          dica={opcoes.modo === 'normalizar' ? 'Deixa o volume no padrão de streaming (−14 LUFS): igual entre faixas e sem distorcer.' : undefined}
        />
        {opcoes.modo === 'ganho' ? <Deslizante rotulo="Ganho" valor={opcoes.ganho} aoMudar={(v) => mudar('ganho', v)} min={-20} max={20} formatar={(v) => `${v > 0 ? '+' : ''}${v} dB`} dica="+6 dB ≈ o dobro do volume percebido. Acima de +10 dB pode distorcer." /> : null}
      </>
    ),
    filtro: (o) => (o.modo === 'normalizar' ? 'loudnorm=I=-14:TP=-1.5:LRA=11' : `volume=${o.ganho}dB,alimiter=limit=0.98`),
    sufixo: (o) => (o.modo === 'normalizar' ? '-normalizado' : '-volume'),
    duracao: (d) => d,
  },
  silencio: {
    rotulo: 'Remover silêncio',
    iniciais: { onde: 'pontas', limiar: -45, minimo: 0.5 },
    Configuracoes: ({ opcoes, mudar }) => (
      <>
        <Segmentado
          rotulo="Onde"
          valor={opcoes.onde}
          aoMudar={(v) => mudar('onde', v)}
          opcoes={[
            { valor: 'pontas', rotulo: 'Início e fim' },
            { valor: 'tudo', rotulo: 'Todas as pausas' },
          ]}
          dica={opcoes.onde === 'tudo' ? 'Corta também as pausas no meio (bom para aulas e podcasts).' : 'Só o silêncio antes do primeiro som e depois do último.'}
        />
        <Deslizante rotulo="O que conta como silêncio" valor={opcoes.limiar} aoMudar={(v) => mudar('limiar', v)} min={-70} max={-20} formatar={(v) => `${v} dB`} dica="Mais alto (−30) corta mais; mais baixo (−60) só o silêncio absoluto." />
        {opcoes.onde === 'tudo' ? <Deslizante rotulo="Pausas maiores que" valor={opcoes.minimo} aoMudar={(v) => mudar('minimo', v)} min={0.2} max={3} passo={0.1} formatar={(v) => `${v.toLocaleString('pt-BR')} s`} /> : null}
      </>
    ),
    filtro: (o) => {
      const ponta = `silenceremove=start_periods=1:start_duration=0.05:start_threshold=${o.limiar}dB`
      if (o.onde === 'tudo') return `${ponta},silenceremove=stop_periods=-1:stop_duration=${o.minimo}:stop_threshold=${o.limiar}dB`
      return `${ponta},areverse,${ponta},areverse`
    },
    sufixo: () => '-sem-silencio',
    duracao: (d) => d,
  },
  velocidade: {
    rotulo: 'Mudar velocidade',
    iniciais: { velocidade: 1.25, tom: false },
    Configuracoes: ({ opcoes, mudar }) => (
      <>
        <Seletor
          rotulo="Velocidade"
          valor={String(opcoes.velocidade)}
          aoMudar={(v) => mudar('velocidade', Number(v))}
          opcoes={[0.5, 0.75, 0.9, 1.1, 1.25, 1.5, 1.75, 2, 3].map((v) => ({ valor: String(v), rotulo: `${v.toLocaleString('pt-BR')}×` }))}
        />
        <Caixa rotulo="Mudar o tom junto (efeito “esquilo”)" dica="Desmarcado, a voz continua natural." marcado={opcoes.tom} aoMudar={(v) => mudar('tom', v)} />
      </>
    ),
    filtro: (o) => (o.tom ? `asetrate=44100*${o.velocidade},aresample=44100` : filtroVelocidadeAudio(o.velocidade)),
    sufixo: (o) => `-${String(o.velocidade).replace('.', '_')}x`,
    duracao: (d, o) => d / o.velocidade,
  },
}

/** Componente estável (definido fora do render): os controles não remontam a cada mudança. */
function ConfiguracoesEfeito({ opcoes, mudar }) {
  const e = EFEITOS[opcoes.efeito]
  return (
    <div className="flex flex-col gap-5">
      <e.Configuracoes opcoes={opcoes} mudar={mudar} />
      <FormatoAudio valor={opcoes.formato} aoMudar={(v) => mudar('formato', v)} comManter />
      <Bitrate valor={opcoes.bitrate} aoMudar={(v) => mudar('bitrate', v)} formato={opcoes.formato} />
    </div>
  )
}

export default function Efeitos({ efeito }) {
  const e = EFEITOS[efeito]
  return (
    <ModeloConversao
      extensoes={EXTENSOES_AUDIO}
      descricaoFormatos={DESCRICAO_AUDIO}
      limiteBytes={LIMITE_AUDIO}
      maximo={50}
      opcoesIniciais={{ ...e.iniciais, efeito, formato: 'manter', bitrate: 192 }}
      Configuracoes={ConfiguracoesEfeito}
      rotuloAcao={e.rotulo}
      nomeZip="audios.zip"
      processar={async (itens, o, { progresso, sinal }) => {
        const saidas = []
        for (let i = 0; i < itens.length; i += 1) {
          cancelado(sinal)
          const { arquivo } = itens[i]
          const formato = o.formato === 'manter' ? (['mp3', 'wav', 'ogg', 'flac', 'm4a', 'opus', 'aac'].includes(extensaoDe(arquivo.name)) ? extensaoDe(arquivo.name) : 'mp3') : o.formato
          const info = await infoMidia(arquivo).catch(() => ({}))
          const blob = await processarAudio(
            arquivo,
            { formato, bitrate: o.bitrate, filtros: e.filtro(o) },
            { progresso: (v, r) => progresso(v == null ? null : (i + v) / itens.length, r), sinal },
            info.duracao ? e.duracao(info.duracao, o) : undefined,
          )
          const nova = await infoMidia(new File([blob], `x.${formato}`)).catch(() => ({}))
          saidas.push({ nome: trocarExtensao(arquivo.name, formato, e.sufixo(o)), blob, detalhe: nova.duracao ? `${formatarDuracao(info.duracao)} → ${formatarDuracao(nova.duracao)}` : undefined })
        }
        return saidas
      }}
    />
  )
}
