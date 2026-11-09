import { useEffect, useState } from 'react'
import { MiniPlayer } from '../../componentes/MiniPlayer'
import { Resultados } from '../../componentes/ferramenta/Resultados'
import { SeletorArquivos } from '../../componentes/ferramenta/SeletorArquivos'
import { Aviso, Botao, Caixa, Progresso, Segmentado, SeloCategoria } from '../../componentes/ui'
import { executarFfmpeg } from '../../motores/ffmpeg'
import { DESCRICAO_AUDIO, EXTENSOES_AUDIO, EXTENSOES_VIDEO, FORMATOS_AUDIO, LIMITE_VIDEO, infoMidia, processarAudio } from '../../motores/midia'
import { extensaoDe, formatarDuracao, trocarExtensao } from '../../nucleo/arquivos'
import { ErroAmigavel, useTarefa } from '../../nucleo/tarefa'
import { useUrlObjeto } from '../../nucleo/url'

const REDUCAO = { leve: 10, medio: 18, forte: 28 }
const SEGUNDOS_PREVIA = 20

/**
 * Cadeia de filtros (ffmpeg), na ordem de um estúdio:
 * corta graves → tira ruído → equaliza → comprime → volume final.
 */
export function filtrosVoz(o) {
  return [
    o.graves ? 'highpass=f=80' : null,
    o.ruido !== 'nao' ? `afftdn=nr=${REDUCAO[o.ruido]}:nf=-42:tn=1` : null,
    o.clareza ? 'equalizer=f=250:t=q:w=1.2:g=-2,equalizer=f=3500:t=q:w=1.2:g=3' : null,
    o.nivelar ? 'acompressor=threshold=-20dB:ratio=3:attack=15:release=250:makeup=2' : null,
    o.volume === 'podcast' ? 'loudnorm=I=-16:TP=-1.5:LRA=11' : o.volume === 'musica' ? 'loudnorm=I=-14:TP=-1:LRA=11' : null,
  ]
    .filter(Boolean)
    .join(',')
}

const ehVideo = (arquivo) => EXTENSOES_VIDEO.includes(extensaoDe(arquivo.name))

function Previa({ arquivo, o }) {
  const [estado, setEstado] = useState({ fase: 'nada' })
  const [lado, setLado] = useState('depois')
  const [chave, setChave] = useState('')
  const antes = useUrlObjeto(estado.antes)
  const depois = useUrlObjeto(estado.depois)
  const filtros = filtrosVoz(o)
  const desatualizada = estado.fase === 'pronta' && chave !== filtros

  const gerar = async () => {
    setEstado((e) => ({ ...e, fase: 'gerando' }))
    try {
      const entrada = `previa.${extensaoDe(arquivo.name) || 'bin'}`
      const base = ['-t', String(SEGUNDOS_PREVIA), '-i', entrada, '-vn', '-map', '0:a:0', '-ac', '2', '-ar', '44100']
      const [a, d] = await Promise.all([
        executarFfmpeg({ entradas: [{ nome: entrada, dados: arquivo }], args: [...base, '-c:a', 'pcm_s16le'], saida: 'antes.wav', rotulo: 'Preparando a prévia' }),
        executarFfmpeg({ entradas: [{ nome: entrada, dados: arquivo }], args: [...base, ...(filtros ? ['-af', filtros] : []), '-c:a', 'pcm_s16le'], saida: 'depois.wav', rotulo: 'Preparando a prévia' }),
      ])
      setEstado({ fase: 'pronta', antes: new Blob([a], { type: 'audio/wav' }), depois: new Blob([d], { type: 'audio/wav' }) })
      setChave(filtros)
    } catch (e) {
      console.error(e)
      setEstado({ fase: 'erro' })
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-xs font-semibold tracking-wide text-fraca uppercase">Ouvir antes e depois</h3>
        {estado.fase === 'pronta' ? (
          <Segmentado
            valor={lado}
            aoMudar={setLado}
            opcoes={[
              { valor: 'antes', rotulo: 'Antes' },
              { valor: 'depois', rotulo: 'Depois' },
            ]}
          />
        ) : null}
      </div>
      {estado.fase === 'pronta' ? (
        <>
          <MiniPlayer url={lado === 'antes' ? antes : depois} rotulo={lado === 'antes' ? 'original' : 'melhorado'} />
          <p className="text-xs text-fraca">Troque entre Antes e Depois tocando: continua do mesmo ponto. Prévia dos primeiros {SEGUNDOS_PREVIA} s.</p>
          {desatualizada ? (
            <Botao variante="secundario" tamanho="p" icone="refazer" onClick={gerar} className="self-start">
              Atualizar a prévia com os ajustes novos
            </Botao>
          ) : null}
        </>
      ) : estado.fase === 'gerando' ? (
        <Progresso valor={null} rotulo="Preparando a prévia" />
      ) : (
        <>
          {estado.fase === 'erro' ? <Aviso tom="erro">Não foi possível gerar a prévia deste arquivo.</Aviso> : null}
          <Botao variante="secundario" icone="play" onClick={gerar} className="self-start">
            Gerar prévia de {SEGUNDOS_PREVIA} s
          </Botao>
        </>
      )}
    </div>
  )
}

function Ajustador({ arquivo, aoTrocar }) {
  const video = ehVideo(arquivo)
  const formatoInicial = FORMATOS_AUDIO[extensaoDe(arquivo.name)] ? extensaoDe(arquivo.name) : 'mp3'
  const [o, setO] = useState({ ruido: 'medio', graves: true, clareza: true, nivelar: true, volume: 'podcast', formato: formatoInicial })
  const [duracao, setDuracao] = useState(null)
  const tarefa = useTarefa()
  const mudar = (m) => setO((x) => ({ ...x, ...m }))

  useEffect(() => {
    let vivo = true
    infoMidia(arquivo)
      .then((i) => {
        if (!vivo) return
        if (i.temAudio === false) setDuracao(-1)
        else setDuracao(i.duracao ?? 0)
      })
      .catch(() => vivo && setDuracao(0))
    return () => {
      vivo = false
    }
  }, [arquivo])

  const aplicar = () =>
    tarefa.executar(async (ctx) => {
      const filtros = filtrosVoz(o)
      if (!filtros) throw new ErroAmigavel('Ligue pelo menos um ajuste.')
      if (video) {
        // Vídeo: a imagem é copiada como está; só o som é processado.
        const ext = ['mp4', 'mov', 'mkv', 'webm'].includes(extensaoDe(arquivo.name)) ? extensaoDe(arquivo.name) : 'mp4'
        const entrada = `entrada.${extensaoDe(arquivo.name) || 'mp4'}`
        const audio = ext === 'webm' ? ['-c:a', 'libopus', '-b:a', '160k'] : ['-c:a', 'aac', '-b:a', '192k']
        const dados = await executarFfmpeg({
          entradas: [{ nome: entrada, dados: arquivo }],
          args: ['-i', entrada, '-map', '0:v:0?', '-map', '0:a:0', '-c:v', 'copy', '-af', filtros, ...audio, ...(ext === 'mp4' || ext === 'mov' ? ['-movflags', '+faststart'] : [])],
          saida: `saida.${ext}`,
          duracao: duracao > 0 ? duracao : undefined,
          aoProgredir: ctx.progresso,
          sinal: ctx.sinal,
          rotulo: 'Limpando o áudio',
        })
        return [{ nome: trocarExtensao(arquivo.name, ext, '-voz-limpa'), blob: new Blob([dados], { type: ext === 'webm' ? 'video/webm' : ext === 'mov' ? 'video/quicktime' : ext === 'mkv' ? 'video/x-matroska' : 'video/mp4' }), original: arquivo.size }]
      }
      const blob = await processarAudio(arquivo, { formato: o.formato, bitrate: 192, filtros }, { progresso: (v, r) => ctx.progresso(v, r === 'Processando o áudio' ? 'Limpando o áudio' : r), sinal: ctx.sinal }, duracao > 0 ? duracao : undefined)
      return [{ nome: trocarExtensao(arquivo.name, o.formato, '-voz-limpa'), blob, detalhe: duracao > 0 ? formatarDuracao(duracao) : undefined }]
    }, 'Limpando o áudio')

  if (tarefa.fase === 'pronto') return <Resultados itens={tarefa.resultado} duracao={tarefa.duracao} aoAjustar={tarefa.reiniciar} aoReiniciar={aoTrocar} rotuloNovo="Outro arquivo" />
  if (duracao === -1) {
    return (
      <Aviso tom="erro" titulo="Este arquivo não tem som" acao={<Botao variante="secundario" tamanho="p" onClick={aoTrocar}>Escolher outro</Botao>}>
        Não há trilha de áudio para limpar.
      </Aviso>
    )
  }

  const processando = tarefa.fase === 'processando'
  return (
    <section aria-label="Melhorar voz" className="cartao">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-borda px-4 py-3 sm:px-5">
        <SeloCategoria categoria="audio" icone={video ? 'arquivoVideo' : 'arquivoAudio'} tamanho="p" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-tinta" title={arquivo.name}>
            {arquivo.name}
          </p>
          <p className="text-xs text-fraca tabular-nums">{duracao > 0 ? formatarDuracao(duracao) : '…'}{video ? ' · vídeo: a imagem fica igual, só o som muda' : ''}</p>
        </div>
        <Botao variante="fantasma" tamanho="p" icone="refazer" onClick={aoTrocar} disabled={processando}>
          Trocar arquivo
        </Botao>
      </div>

      <div className={`grid gap-6 p-4 sm:p-5 lg:grid-cols-2 ${processando ? 'pointer-events-none opacity-60' : ''}`} inert={processando ? true : undefined}>
        <div className="flex flex-col gap-5">
          <Segmentado
            rotulo="Ruído de fundo"
            valor={o.ruido}
            aoMudar={(v) => mudar({ ruido: v })}
            opcoes={[
              { valor: 'nao', rotulo: 'Manter' },
              { valor: 'leve', rotulo: 'Leve' },
              { valor: 'medio', rotulo: 'Médio' },
              { valor: 'forte', rotulo: 'Forte' },
            ]}
            dica={{ nao: 'Não mexe no chiado.', leve: 'Tira chiado suave sem mudar a voz.', medio: 'Bom para ventilador, ar-condicionado e chiado de microfone.', forte: 'Ruído alto; pode deixar a voz um pouco “metálica”.' }[o.ruido]}
          />
          <div className="flex flex-col gap-3">
            <Caixa rotulo="Cortar zumbido grave" dica="Tira vento, batidas na mesa e o zumbido de aparelhos." marcado={o.graves} aoMudar={(v) => mudar({ graves: v })} />
            <Caixa rotulo="Voz mais clara" dica="Menos som abafado, mais presença na fala." marcado={o.clareza} aoMudar={(v) => mudar({ clareza: v })} />
            <Caixa rotulo="Nivelar o volume" dica="Aproxima partes baixas e altas da fala." marcado={o.nivelar} aoMudar={(v) => mudar({ nivelar: v })} />
          </div>
          <Segmentado
            rotulo="Volume final"
            valor={o.volume}
            aoMudar={(v) => mudar({ volume: v })}
            opcoes={[
              { valor: 'podcast', rotulo: 'Voz / podcast' },
              { valor: 'musica', rotulo: 'Música' },
              { valor: 'manter', rotulo: 'Manter' },
            ]}
            dica={{ podcast: 'Padrão de podcasts (−16 LUFS): volume igual ao das plataformas.', musica: 'Padrão de streaming de música (−14 LUFS).', manter: 'Não mexe no volume geral.' }[o.volume]}
          />
        </div>

        <div className="flex flex-col gap-5 lg:border-l lg:border-borda lg:pl-6">
          <Previa arquivo={arquivo} o={o} />
          <div className="mt-auto flex flex-wrap items-end gap-3 border-t border-borda pt-4">
            {video ? null : (
              <label className="flex flex-col gap-1.5 text-[0.8125rem] font-semibold text-tinta">
                Salvar como
                <select
                  value={o.formato}
                  onChange={(e) => mudar({ formato: e.target.value })}
                  className="h-10 rounded-[var(--radius-controle)] border border-borda-forte bg-superficie px-3 text-sm text-tinta focus:border-acento focus:outline-none"
                >
                  {Object.entries(FORMATOS_AUDIO).map(([v, f]) => (
                    <option key={v} value={v}>
                      {f.rotulo}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <div className="ml-auto flex-1 sm:flex-none">
              {processando ? (
                <div className="w-full sm:w-72">
                  <Progresso valor={tarefa.progresso} rotulo={tarefa.rotulo} aoCancelar={tarefa.cancelar} />
                </div>
              ) : (
                <Botao tamanho="g" icone="magica" className="w-full" onClick={aplicar}>
                  Limpar e baixar
                </Botao>
              )}
            </div>
          </div>
          {tarefa.fase === 'erro' ? <Aviso tom="erro">{tarefa.mensagem}</Aviso> : null}
        </div>
      </div>
    </section>
  )
}

/** Limpar e melhorar voz: ruído, zumbido, clareza, nivelamento e volume padrão — com antes/depois. */
export default function MelhorarVoz() {
  const [arquivos, setArquivos] = useState([])
  if (!arquivos.length) {
    return (
      <SeletorArquivos
        arquivos={arquivos}
        aoMudar={setArquivos}
        multiplos={false}
        extensoes={[...EXTENSOES_AUDIO, ...EXTENSOES_VIDEO]}
        descricaoFormatos={`${DESCRICAO_AUDIO} ou vídeo (gravações, aulas, podcasts, áudios de WhatsApp)`}
        limiteBytes={LIMITE_VIDEO}
      />
    )
  }
  return <Ajustador key={arquivos[0].id} arquivo={arquivos[0].arquivo} aoTrocar={() => setArquivos([])} />
}
