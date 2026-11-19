import { useEffect, useState } from 'react'
import { SeletorArquivos } from '../../componentes/ferramenta/SeletorArquivos'
import { Icone } from '../../componentes/Icone'
import { Etiqueta } from '../../componentes/ui'
import { detectarTipo, extensaoDe, formatarBytes, formatarDuracao } from '../../nucleo/arquivos'
import { useSalvo } from '../../nucleo/salvo'

/** Propriedades extras conforme o tipo: dimensões, duração, páginas. */
async function propriedades(arquivo, real) {
  try {
    if (/^(jpg|png|gif|webp|avif|bmp|svg|ico)$/.test(real)) {
      const { dimensoes } = await import('../../motores/imagem')
      const d = await dimensoes(arquivo)
      return [['Dimensões', `${Math.round(d.largura)} × ${Math.round(d.altura)} px`]]
    }
    if (/^(mp4|mov|webm|mkv|avi|mp3|m4a|wav|ogg|flac|opus|aac)$/.test(real)) {
      const { infoMidia } = await import('../../motores/midia')
      const i = await infoMidia(arquivo)
      return [
        i.duracao ? ['Duração', formatarDuracao(i.duracao)] : null,
        i.largura ? ['Dimensões', `${i.largura} × ${i.altura} px`] : null,
        i.codecVideo ? ['Codec de vídeo', i.codecVideo] : null,
        i.codecAudio ? ['Codec de áudio', i.codecAudio] : null,
      ].filter(Boolean)
    }
    if (real === 'pdf') {
      const { abrirLeitura } = await import('../../motores/pdf')
      const doc = await abrirLeitura(arquivo)
      const n = doc.numPages
      doc.destroy()
      return [['Páginas', String(n)]]
    }
  } catch {
    /* sem propriedades extras */
  }
  return []
}

const DESCRICOES = {
  jpg: 'Imagem JPEG',
  png: 'Imagem PNG',
  gif: 'Imagem GIF',
  webp: 'Imagem WebP',
  avif: 'Imagem AVIF',
  heic: 'Imagem HEIC (iPhone)',
  svg: 'Imagem vetorial SVG',
  bmp: 'Imagem BMP',
  ico: 'Ícone ICO',
  pdf: 'Documento PDF',
  zip: 'Arquivo ZIP',
  rar: 'Arquivo RAR',
  '7z': 'Arquivo 7-Zip',
  gz: 'Arquivo GZIP',
  tar: 'Arquivo TAR',
  docx: 'Documento do Word (DOCX)',
  xlsx: 'Planilha do Excel (XLSX)',
  pptx: 'Apresentação do PowerPoint (PPTX)',
  odt: 'Documento ODT (LibreOffice)',
  cfb: 'Documento antigo do Office (DOC/XLS/PPT)',
  mp4: 'Vídeo MP4',
  mov: 'Vídeo QuickTime (MOV)',
  webm: 'Vídeo WebM',
  mkv: 'Vídeo Matroska (MKV)',
  avi: 'Vídeo AVI',
  mp3: 'Áudio MP3',
  m4a: 'Áudio M4A (AAC)',
  wav: 'Áudio WAV',
  ogg: 'Áudio OGG',
  flac: 'Áudio FLAC',
  exe: 'Programa do Windows (EXE)',
  elf: 'Programa do Linux (ELF)',
  html: 'Página HTML',
  txt: 'Texto',
  rtf: 'Documento RTF',
  epub: 'Livro digital EPUB',
}
const EXE = new Set(['exe', 'elf', 'msi', 'dll', 'mach', 'apk', 'deb', 'rpm', 'dmg'])

const IGUAIS = { jpeg: 'jpg', jpg: 'jpg', htm: 'html', tif: 'tiff', m4v: 'mp4', oga: 'ogg', opus: 'ogg' }
const norm = (e) => IGUAIS[e] ?? e

async function analisar(arquivo) {
  const [tipo, inicio] = await Promise.all([detectarTipo(arquivo), arquivo.slice(0, 32).arrayBuffer()])
  const ext = extensaoDe(arquivo.name)
  const real = tipo?.ext ?? null
  const extras = [
    ['Modificado em', new Date(arquivo.lastModified).toLocaleString('pt-BR')],
    ...(await propriedades(arquivo, real)),
  ]
  // .docx/.xlsx são ZIP por dentro, .m4a é MP4 de áudio etc.: não acusar diferença à toa.
  const compativel = !real || !ext || norm(ext) === norm(real) || (real === 'zip' && /^(docx|xlsx|pptx|odt|ods|odp|jar|apk|epub)$/.test(ext)) || (real === 'mp4' && /^(m4a|m4v|mov)$/.test(ext)) || (real === 'cfb' && /^(doc|xls|ppt|msg)$/.test(ext)) || (real === 'txt' && /^(csv|md|json|log|xml|js|css|ini|srt|vtt|yml|yaml)$/.test(ext))
  return {
    arquivo,
    ext,
    real,
    extras,
    mime: tipo?.mime ?? arquivo.type ?? '',
    descricao: real ? DESCRICOES[real] ?? real.toUpperCase() : 'Formato não reconhecido',
    compativel,
    executavel: real && EXE.has(real) && !EXE.has(ext),
    hex: [...new Uint8Array(inicio)].map((b) => b.toString(16).padStart(2, '0')).join(' '),
    ascii: [...new Uint8Array(inicio)].map((b) => (b >= 32 && b < 127 ? String.fromCharCode(b) : '·')).join(''),
  }
}

/** Identifica o tipo REAL de arquivos pela assinatura dos bytes, e acusa extensões enganosas. */
export default function Identificar() {
  const [arquivos, setArquivos] = useSalvo('arquivos', [])
  const [analises, setAnalises] = useState([])

  useEffect(() => {
    let vivo = true
    Promise.all(arquivos.map((a) => analisar(a.arquivo))).then((r) => vivo && setAnalises(r))
    return () => {
      vivo = false
    }
  }, [arquivos])

  return (
    <div className="flex flex-col gap-5">
      <SeletorArquivos arquivos={arquivos} aoMudar={setArquivos} descricaoFormatos="Qualquer arquivo" compacto={Boolean(arquivos.length)} />
      {analises.map((a) => (
        <section key={a.arquivo.name + a.arquivo.size} className={`cartao p-4 ${a.executavel ? 'border-perigo/50' : !a.compativel ? 'border-alerta/50' : ''}`} aria-label={`Análise de ${a.arquivo.name}`}>
          <div className="flex flex-wrap items-start gap-x-4 gap-y-2">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-tinta">{a.arquivo.name}</p>
              <p className="text-xs text-fraca">{formatarBytes(a.arquivo.size)}</p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <Etiqueta tom={a.real ? 'info' : 'neutro'}>{a.descricao}</Etiqueta>
              {a.real ? <Etiqueta>.{a.real}</Etiqueta> : null}
              {a.mime ? <Etiqueta>{a.mime}</Etiqueta> : null}
            </div>
          </div>
          {a.executavel ? (
            <p className="mt-3 flex items-start gap-2 text-sm text-perigo">
              <Icone nome="alerta" tamanho={16} className="mt-0.5" />
              <span>
                <strong>Cuidado:</strong> este arquivo se diz <strong>.{a.ext || 'sem extensão'}</strong>, mas é um <strong>programa executável</strong>. Não abra se não souber a origem.
              </span>
            </p>
          ) : !a.compativel ? (
            <p className="mt-3 flex items-start gap-2 text-sm text-alerta">
              <Icone nome="alerta" tamanho={16} className="mt-0.5" />
              <span>
                A extensão diz <strong>.{a.ext}</strong>, mas o conteúdo é <strong>{a.real.toUpperCase()}</strong>. Renomeie para .{a.real} para abrir no programa certo.
              </span>
            </p>
          ) : a.real ? (
            <p className="mt-3 flex items-center gap-2 text-sm text-sucesso">
              <Icone nome="check" tamanho={16} />A extensão corresponde ao conteúdo.
            </p>
          ) : null}
          <dl className="mt-3 grid gap-x-6 gap-y-1 text-xs sm:grid-cols-2">
            {a.extras.map(([r, v]) => (
              <div key={r} className="flex gap-2">
                <dt className="text-fraca">{r}:</dt>
                <dd className="font-medium text-tinta">{v}</dd>
              </div>
            ))}
          </dl>
          <details className="mt-3">
            <summary className="cursor-pointer text-xs font-semibold text-suave">Primeiros bytes (assinatura)</summary>
            <pre className="mt-2 overflow-x-auto rounded-md bg-fundo-suave p-3 font-mono text-[0.6875rem] leading-relaxed text-texto">
              {a.hex}
              {'\n'}
              {a.ascii}
            </pre>
          </details>
        </section>
      ))}
    </div>
  )
}
