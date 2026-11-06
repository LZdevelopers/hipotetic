import { ModeloConversao } from '../../componentes/ferramenta/ModeloConversao'
import { Entrada, Segmentado } from '../../componentes/ui'
import { DESCRICAO_COMPACTADOS, EXTENSOES_COMPACTADOS, FORMATOS_CRIACAO, LIMITE_COMPACTADO, conferirSeguranca, criar, extrair, listar } from '../../motores/compactados'
import { semExtensao } from '../../nucleo/arquivos'
import { ErroAmigavel, cancelado } from '../../nucleo/tarefa'

function Configuracoes({ opcoes, mudar }) {
  return (
    <div className="flex flex-col gap-5">
      <Segmentado
        rotulo="Converter para"
        valor={opcoes.formato}
        aoMudar={(v) => mudar('formato', v)}
        opcoes={Object.entries(FORMATOS_CRIACAO).map(([v, x]) => ({ valor: v, rotulo: x.rotulo }))}
        dica={FORMATOS_CRIACAO[opcoes.formato].dica}
      />
      <Entrada rotulo="Senha do arquivo original (se tiver)" type="password" valor={opcoes.senha} aoMudar={(v) => mudar('senha', v)} />
    </div>
  )
}

/** RAR → ZIP, 7Z → ZIP, ZIP → 7Z…: extrai e compacta de novo, mantendo as pastas. */
export default function ConverterCompactado({ entrada, saida = 'zip' }) {
  return (
    <ModeloConversao
      extensoes={entrada ? [entrada] : EXTENSOES_COMPACTADOS}
      descricaoFormatos={entrada ? entrada.toUpperCase() : DESCRICAO_COMPACTADOS}
      limiteBytes={LIMITE_COMPACTADO}
      maximo={20}
      opcoesIniciais={{ formato: saida, senha: '' }}
      Configuracoes={Configuracoes}
      rotuloAcao="Converter"
      nomeZip="compactados-convertidos.zip"
      processar={async (itens, o, { progresso, sinal }) => {
        const saidas = []
        for (let i = 0; i < itens.length; i += 1) {
          cancelado(sinal)
          const { arquivo } = itens[i]
          progresso(null, `Lendo ${arquivo.name}`)
          const l = await listar(arquivo, o.senha)
          if (l.senhaErrada) throw new ErroAmigavel(`Senha incorreta para “${arquivo.name}”.`)
          if (l.precisaSenha) throw new ErroAmigavel(`“${arquivo.name}” é protegido por senha. Informe a senha ao lado.`)
          conferirSeguranca(l, arquivo.size)
          const extraidos = await extrair(l, { senha: o.senha })
          const blob = await criar(extraidos.map((e) => ({ caminho: e.caminho, dados: e.blob })), { formato: o.formato, nivel: 5 }, (v, r) => progresso(v == null ? null : (i + v) / itens.length, r))
          const base = semExtensao(arquivo.name).replace(/\.tar$/, '')
          saidas.push({ nome: `${base}.${FORMATOS_CRIACAO[o.formato].ext}`, blob, original: arquivo.size, detalhe: `${extraidos.length} arquivos` })
        }
        return saidas
      }}
    />
  )
}
