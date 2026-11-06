import { ModeloConversao } from '../../componentes/ferramenta/ModeloConversao'
import { Deslizante, Entrada, Segmentado } from '../../componentes/ui'
import { FORMATOS_CRIACAO, criar } from '../../motores/compactados'
import { formatarBytes, semExtensao } from '../../nucleo/arquivos'
import { ErroAmigavel } from '../../nucleo/tarefa'

function Configuracoes({ opcoes, mudar, arquivos }) {
  const f = FORMATOS_CRIACAO[opcoes.formato]
  return (
    <div className="flex flex-col gap-5">
      <Segmentado
        rotulo="Formato"
        valor={opcoes.formato}
        aoMudar={(v) => mudar('formato', v)}
        opcoes={Object.entries(FORMATOS_CRIACAO).map(([v, x]) => ({ valor: v, rotulo: x.rotulo }))}
        dica={f.dica}
      />
      {opcoes.formato !== 'tar' ? (
        <Deslizante
          rotulo="Nível de compressão"
          valor={opcoes.nivel}
          aoMudar={(v) => mudar('nivel', v)}
          min={0}
          max={9}
          formatar={(v) => (v === 0 ? 'só guardar' : v <= 3 ? 'rápido' : v <= 6 ? 'normal' : 'máximo')}
          dica="Fotos, vídeos e PDFs já são comprimidos: aumentar o nível quase não muda o tamanho deles."
        />
      ) : null}
      {f.senha ? (
        <Entrada
          rotulo="Senha (opcional)"
          type="password"
          autoComplete="new-password"
          valor={opcoes.senha}
          aoMudar={(v) => mudar('senha', v)}
          dica={opcoes.formato === '7z' ? 'AES-256. No 7Z, até os nomes dos arquivos ficam ocultos sem a senha.' : 'AES-256. Alguns programas antigos (como o compactador do Windows) não abrem ZIP com AES: use o 7-Zip.'}
        />
      ) : null}
      <Entrada rotulo="Nome do arquivo" valor={opcoes.nome} aoMudar={(v) => mudar('nome', v)} placeholder={arquivos.length === 1 ? semExtensao(arquivos[0].arquivo.name) : 'arquivos'} sufixo={`.${f.ext}`} />
    </div>
  )
}

/** Compactar arquivos e pastas (a estrutura de pastas é mantida). */
export default function Compactar({ formato = 'zip' }) {
  return (
    <ModeloConversao
      descricaoFormatos="Qualquer tipo de arquivo, ou pastas inteiras"
      limiteBytes={1024 * 1024 * 1024}
      maximo={5000}
      pastas
      opcoesIniciais={{ formato, nivel: 5, senha: '', nome: '' }}
      Configuracoes={Configuracoes}
      rotuloAcao="Compactar"
      processar={async (itens, o, { progresso }) => {
        const total = itens.reduce((s, i) => s + i.arquivo.size, 0)
        if (total > 1.5 * 1024 * 1024 * 1024) throw new ErroAmigavel(`São ${formatarBytes(total)} no total — acima do que o navegador consegue compactar com segurança (1,5 GB).`)
        const f = FORMATOS_CRIACAO[o.formato]
        const blob = await criar(
          itens.map((i) => ({ caminho: i.caminho ?? i.arquivo.name, dados: i.arquivo })),
          { formato: o.formato, nivel: o.nivel, senha: o.senha },
          progresso,
        )
        const base = o.nome.trim() || (itens.length === 1 ? semExtensao(itens[0].arquivo.name) : 'arquivos')
        return [{ nome: `${base}.${f.ext}`, blob, original: total, detalhe: `${itens.length} ${itens.length === 1 ? 'arquivo' : 'arquivos'}${o.senha && f.senha ? ' · com senha' : ''}` }]
      }}
    />
  )
}
