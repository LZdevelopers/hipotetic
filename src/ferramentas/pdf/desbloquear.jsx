import { ModeloConversao } from '../../componentes/ferramenta/ModeloConversao'
import { Entrada } from '../../componentes/ui'
import { LIMITE_PDF, executarQpdf, infoCriptografia } from '../../motores/pdf'
import { trocarExtensao } from '../../nucleo/arquivos'
import { ErroAmigavel } from '../../nucleo/tarefa'

function Configuracoes({ opcoes, mudar }) {
  return (
    <div className="flex flex-col gap-4">
      <Entrada rotulo="Senha do PDF" type="password" autoComplete="current-password" valor={opcoes.senha} aoMudar={(v) => mudar('senha', v)} />
      <p className="text-xs text-fraca">
        A senha de abrir o arquivo ou, se ele abre sem senha mas bloqueia impressão/cópia, a senha do dono (de permissões). Sem a senha correta não é possível desbloquear.
      </p>
    </div>
  )
}

/**
 * Remove a senha de um PDF de quem TEM a senha. Regras:
 *  - PDF que pede senha para abrir: exige essa senha (ou a do dono);
 *  - PDF que abre sem senha mas restringe impressão/cópia: exige a senha do
 *    dono — não removemos restrições de quem não tem autorização.
 */
export default function Desbloquear() {
  return (
    <ModeloConversao
      extensoes={['pdf']}
      descricaoFormatos="PDF protegido"
      limiteBytes={LIMITE_PDF}
      multiplos={false}
      opcoesIniciais={{ senha: '' }}
      Configuracoes={Configuracoes}
      validarOpcoes={(o) => (!o.senha ? 'Digite a senha do PDF.' : null)}
      rotuloAcao="Desbloquear"
      processar={async ([item], o, { progresso }) => {
        progresso(null, 'Verificando a senha')
        const semSenha = await infoCriptografia(item.arquivo)
        if (!semSenha.protegido) throw new ErroAmigavel('Este PDF não tem senha nem restrições. Não há o que desbloquear.')
        const comSenha = await infoCriptografia(item.arquivo, o.senha)
        if (comSenha.senhaIncorreta || (!comSenha.ehSenhaDoDono && !comSenha.ehSenhaDeAbrir)) throw new ErroAmigavel('Senha incorreta.')
        // Abre sem senha (só restrições): só a senha do dono autoriza tirar.
        const abreSemSenha = !semSenha.senhaIncorreta
        if (abreSemSenha && !comSenha.ehSenhaDoDono) {
          throw new ErroAmigavel('Este PDF abre sem senha, mas tem restrições de uso. Para removê-las, é preciso a senha do dono (de permissões), não a de abrir.')
        }
        progresso(null, 'Removendo a proteção')
        const r = await executarQpdf(item.arquivo, [`--password=${o.senha}`, '--decrypt'])
        if (r.codigo === 2 || !r.saida) throw new ErroAmigavel('Não foi possível desbloquear este PDF.', r.texto)
        return [{ nome: trocarExtensao(item.arquivo.name, 'pdf', '-desbloqueado'), blob: new Blob([r.saida], { type: 'application/pdf' }), detalhe: 'sem senha' }]
      }}
    />
  )
}
