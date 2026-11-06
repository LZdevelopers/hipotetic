import { ModeloConversao } from '../../componentes/ferramenta/ModeloConversao'
import { Segmentado } from '../../componentes/ui'
import { LIMITE_SERVIDOR, converterNoServidor } from '../../motores/documentos'
import { trocarExtensao } from '../../nucleo/arquivos'
import { cancelado } from '../../nucleo/tarefa'

const SAIDAS = [
  { valor: 'pdf', rotulo: 'PDF' },
  { valor: 'docx', rotulo: 'DOCX' },
  { valor: 'odt', rotulo: 'ODT' },
  { valor: 'rtf', rotulo: 'RTF' },
  { valor: 'txt', rotulo: 'TXT' },
  { valor: 'html', rotulo: 'HTML' },
]
const DICAS = {
  pdf: 'Layout fixo, para enviar e imprimir. Abre igual em qualquer lugar.',
  docx: 'Formato do Microsoft Word.',
  odt: 'Formato aberto do LibreOffice e do Google Docs.',
  rtf: 'Texto formatado simples, abre em quase qualquer editor.',
  txt: 'Só o texto, sem formatação.',
  html: 'Página web com o conteúdo do documento.',
}

function Configuracoes({ opcoes, mudar }) {
  return <Segmentado rotulo="Converter para" valor={opcoes.para} aoMudar={(v) => mudar('para', v)} opcoes={SAIDAS} dica={DICAS[opcoes.para]} />
}

/**
 * Converte documentos com o LibreOffice no nosso servidor (único jeito de
 * manter a formatação). O arquivo é apagado assim que a conversão termina.
 */
export default function ConverterDocumento({ entrada, saida = 'pdf' }) {
  const extensoes = entrada ? [entrada] : ['docx', 'doc', 'odt', 'rtf', 'txt', 'html', 'htm']
  return (
    <ModeloConversao
      extensoes={extensoes}
      descricaoFormatos={entrada ? entrada.toUpperCase() : 'DOCX, DOC, ODT, RTF, TXT, HTML'}
      limiteBytes={LIMITE_SERVIDOR}
      maximo={10}
      opcoesIniciais={{ para: saida }}
      Configuracoes={Configuracoes}
      validarOpcoes={(o, arquivos) => (arquivos.some((a) => a.arquivo.name.toLowerCase().endsWith(`.${o.para}`)) ? `Um dos arquivos já é ${o.para.toUpperCase()}.` : null)}
      rotuloAcao="Converter"
      aviso="Este conversor envia o arquivo para o nosso servidor (LibreOffice). Ele é convertido e apagado na hora; nada fica guardado."
      nomeZip="documentos-convertidos.zip"
      processar={async (itens, o, { progresso, sinal }) => {
        const saidas = []
        for (let i = 0; i < itens.length; i += 1) {
          cancelado(sinal)
          const { arquivo } = itens[i]
          progresso(itens.length > 1 ? i / itens.length : null, itens.length > 1 ? `Convertendo ${i + 1} de ${itens.length}` : 'Convertendo no servidor')
          const blob = await converterNoServidor(arquivo, o.para, sinal)
          saidas.push({ nome: trocarExtensao(arquivo.name, o.para), blob })
        }
        return saidas
      }}
    />
  )
}
