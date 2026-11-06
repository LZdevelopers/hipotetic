import { useEffect, useRef, useState } from 'react'
import { SeletorArquivos } from '../../componentes/ferramenta/SeletorArquivos'
import { Aviso, Botao } from '../../componentes/ui'
import { extrairTextoDocumento } from '../../motores/documentos'
import { detectarTipo, extensaoDe, formatarBytes } from '../../nucleo/arquivos'

/**
 * Visualizar documentos sem instalar nada: DOCX com o layout (docx-preview),
 * os demais (ODT, RTF, HTML, TXT, MD) como texto. Tudo no navegador.
 */
function Painel({ arquivo, aoTrocar }) {
  const area = useRef(null)
  const estilos = useRef(null)
  const [estado, setEstado] = useState({ fase: 'carregando' })

  useEffect(() => {
    let vivo = true
    ;(async () => {
      const tipo = (await detectarTipo(arquivo))?.ext
      const ehDocx = tipo === 'docx' || (tipo === 'zip' && extensaoDe(arquivo.name) === 'docx')
      if (ehDocx) {
        const { renderAsync } = await import('docx-preview')
        if (!vivo) return
        area.current.innerHTML = ''
        await renderAsync(arquivo, area.current, estilos.current, { inWrapper: true, ignoreLastRenderedPageBreak: true, experimental: true, useBase64URL: true })
        // Links do documento não navegam a página do site.
        area.current.querySelectorAll('a[href]').forEach((a) => {
          a.target = '_blank'
          a.rel = 'noopener noreferrer'
        })
        if (vivo) setEstado({ fase: 'docx' })
      } else {
        const { texto } = await extrairTextoDocumento(arquivo)
        if (vivo) setEstado({ fase: 'texto', texto })
      }
    })().catch((e) => vivo && setEstado({ fase: 'erro', mensagem: e?.mensagem ?? 'Não foi possível abrir este documento.' }))
    return () => {
      vivo = false
    }
  }, [arquivo])

  return (
    <div className="flex flex-col gap-4">
      <div className="cartao flex flex-wrap items-center gap-3 p-3">
        <p className="min-w-0 flex-1 truncate text-sm font-semibold text-tinta">
          {arquivo.name} <span className="font-normal text-fraca">· {formatarBytes(arquivo.size)}</span>
        </p>
        <Botao variante="secundario" tamanho="p" icone="refazer" onClick={aoTrocar}>
          Outro documento
        </Botao>
      </div>
      {estado.fase === 'erro' ? <Aviso tom="erro">{estado.mensagem}</Aviso> : null}
      {estado.fase === 'carregando' ? <div className="esqueleto h-96 rounded-[var(--radius-cartao)]" /> : null}
      {estado.fase === 'texto' ? (
        <article className="cartao mx-auto w-full max-w-3xl p-6 text-[0.9375rem] leading-relaxed whitespace-pre-wrap text-texto sm:p-10">{estado.texto || 'Documento sem texto.'}</article>
      ) : null}
      <div ref={estilos} hidden />
      {/* O docx-preview desenha as páginas aqui (fundo cinza, folhas brancas). */}
      <div ref={area} className={`overflow-auto rounded-[var(--radius-cartao)] bg-superficie-3 [&_.docx-wrapper]:bg-transparent ${estado.fase === 'docx' ? '' : 'hidden'}`} />
    </div>
  )
}

export default function Visualizar() {
  const [arquivos, setArquivos] = useState([])
  if (!arquivos.length) return <SeletorArquivos arquivos={arquivos} aoMudar={setArquivos} multiplos={false} extensoes={['docx', 'odt', 'rtf', 'txt', 'md', 'html', 'htm']} descricaoFormatos="DOCX, ODT, RTF, HTML, TXT, MD" limiteBytes={100 * 1024 * 1024} />
  return <Painel key={arquivos[0].id} arquivo={arquivos[0].arquivo} aoTrocar={() => setArquivos([])} />
}
