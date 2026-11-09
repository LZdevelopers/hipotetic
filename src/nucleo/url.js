import { useLayoutEffect, useState } from 'react'

/*
 * URLs temporárias (blob:) para mostrar ou baixar arquivos gerados no
 * navegador, liberadas quando o arquivo muda ou o componente sai.
 *
 * A URL é criada DENTRO do efeito, junto com a limpeza que a libera. Criar
 * no useMemo e liberar no efeito parece equivalente, mas quebra: o React
 * (StrictMode, no desenvolvimento) desmonta e remonta para testar, a limpeza
 * libera a URL e o useMemo não cria outra — o link fica morto ("falha na
 * conexão" ao baixar, imagem quebrada na prévia).
 *
 * useLayoutEffect: a URL já existe antes da tela ser pintada, então nunca
 * aparece um link de download vazio.
 */

/** URL de um Blob/File (ou null). */
export function useUrlObjeto(blob) {
  const [estado, setEstado] = useState({ blob: null, url: null })
  useLayoutEffect(() => {
    if (!blob) return undefined
    const url = URL.createObjectURL(blob)
    setEstado({ blob, url })
    return () => URL.revokeObjectURL(url)
  }, [blob])
  return blob && estado.blob === blob ? estado.url : null
}

/** URLs de uma lista de Blobs. A lista precisa ser estável (useMemo) enquanto não mudar. */
export function useUrlsObjeto(blobs) {
  const [estado, setEstado] = useState({ blobs: null, urls: [] })
  useLayoutEffect(() => {
    const urls = blobs.map((b) => (b ? URL.createObjectURL(b) : null))
    setEstado({ blobs, urls })
    return () => urls.forEach((u) => u && URL.revokeObjectURL(u))
  }, [blobs])
  return estado.blobs === blobs ? estado.urls : []
}
