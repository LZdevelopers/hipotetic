import { ModeloConversao } from '../../componentes/ferramenta/ModeloConversao'
import { Caixa, Entrada, Grupo } from '../../componentes/ui'
import { LIMITE_PDF, infoCriptografia } from '../../motores/pdf'
import { protegerPdf } from '../../motores/pdf/otimizar'
import { trocarExtensao } from '../../nucleo/arquivos'
import { ErroAmigavel } from '../../nucleo/tarefa'

function Configuracoes({ opcoes, mudar }) {
  return (
    <div className="flex flex-col gap-5">
      <Entrada rotulo="Senha para abrir" type="password" autoComplete="new-password" valor={opcoes.senha} aoMudar={(v) => mudar('senha', v)} />
      <Entrada rotulo="Repita a senha" type="password" autoComplete="new-password" valor={opcoes.confirmar} aoMudar={(v) => mudar('confirmar', v)} />
      <Grupo titulo="Permissões de quem abrir">
        <div className="flex flex-col gap-2.5">
          <Caixa rotulo="Imprimir" marcado={opcoes.imprimir} aoMudar={(v) => mudar('imprimir', v)} />
          <Caixa rotulo="Copiar texto e imagens" marcado={opcoes.copiar} aoMudar={(v) => mudar('copiar', v)} />
          <Caixa rotulo="Modificar o documento" marcado={opcoes.modificar} aoMudar={(v) => mudar('modificar', v)} />
        </div>
        <p className="mt-2 text-xs text-fraca">Permissões são respeitadas pelos leitores de PDF, mas não são uma proteção absoluta.</p>
      </Grupo>
    </div>
  )
}

export default function Proteger() {
  return (
    <ModeloConversao
      extensoes={['pdf']}
      descricaoFormatos="PDF"
      limiteBytes={LIMITE_PDF}
      multiplos={false}
      opcoesIniciais={{ senha: '', confirmar: '', imprimir: true, copiar: false, modificar: false }}
      Configuracoes={Configuracoes}
      validarOpcoes={(o) => {
        if (o.senha.length < 4) return 'Use uma senha com pelo menos 4 caracteres.'
        if (o.senha !== o.confirmar) return 'As senhas não conferem.'
        return null
      }}
      rotuloAcao="Proteger PDF"
      aviso="Criptografia AES-256. Guarde a senha: sem ela não há como abrir o arquivo."
      processar={async ([item], o, { progresso }) => {
        progresso(null, 'Criptografando')
        if ((await infoCriptografia(item.arquivo)).protegido) throw new ErroAmigavel('Este PDF já está protegido. Desbloqueie antes para trocar a senha.')
        const r = await protegerPdf(item.arquivo, o.senha, { imprimir: o.imprimir, copiar: o.copiar, modificar: o.modificar })
        if (!r.bytes) throw new ErroAmigavel('Não foi possível proteger este PDF. Ele pode estar corrompido.', r.texto)
        return [{ nome: trocarExtensao(item.arquivo.name, 'pdf', '-protegido'), blob: new Blob([r.bytes], { type: 'application/pdf' }), detalhe: 'AES-256' }]
      }}
    />
  )
}
