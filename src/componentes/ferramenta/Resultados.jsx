import { useMemo, useState } from 'react'
import { baixarBlob, extensaoDe, formatarBytes, variacao, zipar } from '../../nucleo/arquivos'
import { Icone } from '../Icone'
import { Botao, Etiqueta } from '../ui'
import { iconeDoArquivo } from './SeletorArquivos'
import { useUrlsObjeto } from '../../nucleo/url'

/** URLs temporárias dos resultados, liberadas quando o componente sai. */
function useUrls(itens) {
  return useUrlsObjeto(useMemo(() => itens.map((i) => i.blob), [itens]))
}

function Previa({ item, url }) {
  const ext = extensaoDe(item.nome)
  if (/^(png|jpe?g|webp|avif|gif|bmp|svg|ico)$/.test(ext)) {
    return (
      <span className="xadrez grid size-14 shrink-0 place-items-center overflow-hidden rounded-lg border border-borda">
        <img src={url} alt="" className="max-h-full max-w-full object-contain" loading="lazy" />
      </span>
    )
  }
  return (
    <span className="grid size-14 shrink-0 place-items-center rounded-lg border border-borda bg-superficie-2 text-fraca">
      <Icone nome={iconeDoArquivo(item.nome)} tamanho={22} />
    </span>
  )
}

/**
 * Arquivos gerados: prévia, nome, tamanho (e a variação em relação ao
 * original, quando há), baixar um a um ou tudo em ZIP.
 * Mídia (vídeo/áudio) ganha um player para conferir antes de salvar.
 */
export function Resultados({ itens, aoReiniciar, aoAjustar, duracao, rotuloNovo = 'Nova operação', nomeZip = 'arquivos.zip', extra }) {
  const urls = useUrls(itens)
  const [zipando, setZipando] = useState(null)
  const total = itens.reduce((s, i) => s + i.blob.size, 0)
  const unico = itens.length === 1 ? itens[0] : null
  const ext = unico ? extensaoDe(unico.nome) : ''
  const midia = unico && /^(mp4|webm|mov|mkv|mp3|wav|ogg|opus|flac|m4a|aac)$/.test(ext)

  const baixarTudo = async () => {
    setZipando(0)
    try {
      baixarBlob(await zipar(itens, setZipando), nomeZip)
    } finally {
      setZipando(null)
    }
  }

  return (
    <section aria-label="Resultado" className="cartao animate-surgir overflow-hidden">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-borda bg-sucesso-suave/60 px-4 py-3 sm:px-5">
        <p className="flex items-center gap-2 text-sm font-semibold text-tinta">
          <span className="grid size-6 place-items-center rounded-full bg-sucesso text-white escuro:text-fundo">
            <Icone nome="check" tamanho={14} strokeWidth={2.5} />
          </span>
          {itens.length === 1 ? 'Arquivo pronto' : `${itens.length} arquivos prontos`}
          <span className="font-normal text-fraca">
            · {formatarBytes(total)}
            {duracao ? ` · ${duracao < 1000 ? 'menos de 1 s' : `${(duracao / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} s`}` : ''}
          </span>
        </p>
        <div className="flex flex-wrap gap-2">
          {aoAjustar ? (
            <Botao variante="fantasma" tamanho="p" icone="ajustar" onClick={aoAjustar}>
              Ajustar e refazer
            </Botao>
          ) : null}
          <Botao variante="secundario" tamanho="p" icone="refazer" onClick={aoReiniciar}>
            {rotuloNovo}
          </Botao>
        </div>
      </header>

      {midia ? (
        <div className="border-b border-borda bg-fundo-suave p-4 sm:p-5">
          {/^(mp4|webm|mov|mkv)$/.test(ext) ? (
            <video src={urls[0]} controls playsInline className="mx-auto max-h-[60vh] w-full rounded-lg bg-black" />
          ) : (
            <audio src={urls[0]} controls className="w-full" />
          )}
        </div>
      ) : null}

      {extra}

      <ul className="max-h-[28rem] divide-y divide-borda overflow-y-auto">
        {itens.map((item, i) => (
          <li key={`${item.nome}-${i}`} className="flex items-center gap-3 px-4 py-3 sm:px-5">
            <Previa item={item} url={urls[i]} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-tinta" title={item.nome}>
                {item.nome}
              </p>
              <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-fraca tabular-nums">
                {formatarBytes(item.blob.size)}
                {item.original ? (
                  <Etiqueta tom={item.blob.size < item.original ? 'sucesso' : 'neutro'}>
                    {variacao(item.original, item.blob.size)} ({formatarBytes(item.original)} antes)
                  </Etiqueta>
                ) : null}
                {item.detalhe ? <span>{item.detalhe}</span> : null}
              </p>
            </div>
            <a
              href={urls[i]}
              download={item.nome}
              className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-marca px-3.5 text-[0.8125rem] font-semibold text-sobre-marca transition-colors hover:bg-marca-hover"
            >
              <Icone nome="baixar" tamanho={15} />
              Baixar
            </a>
          </li>
        ))}
      </ul>

      {itens.length > 1 ? (
        <footer className="flex justify-end border-t border-borda px-4 py-3 sm:px-5">
          <Botao icone="pastaCompactada" carregando={zipando != null} onClick={baixarTudo}>
            {zipando != null ? `Compactando ${Math.round(zipando * 100)}%` : 'Baixar tudo (.zip)'}
          </Botao>
        </footer>
      ) : null}
    </section>
  )
}
