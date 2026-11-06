/**
 * Metadados de imagem: ler (exifr) e remover SEM recodificar.
 *
 * A remoção mexe só nos "envelopes" do arquivo — os pixels ficam idênticos:
 *  - JPEG: tira APP1 (EXIF/XMP), APP13 (IPTC), demais APPn e comentários;
 *    mantém JFIF, o perfil de cor (ICC) e o marcador Adobe, que afetam as
 *    cores. Se a foto depende da orientação do EXIF, grava um EXIF mínimo
 *    só com ela (senão a foto apareceria deitada).
 *  - PNG: tira tEXt, zTXt, iTXt, eXIf e tIME; mantém cor e densidade.
 *  - WebP: tira os blocos EXIF e XMP e acerta os sinalizadores do VP8X.
 */

const u16 = (b, i) => (b[i] << 8) | b[i + 1]
const u32le = (b, i) => b[i] | (b[i + 1] << 8) | (b[i + 2] << 16) | (b[i + 3] << 24)
const u32be = (b, i) => ((b[i] << 24) >>> 0) + ((b[i + 1] << 16) | (b[i + 2] << 8) | b[i + 3])

function juntar(partes) {
  const total = partes.reduce((s, p) => s + p.length, 0)
  const saida = new Uint8Array(total)
  let pos = 0
  for (const p of partes) {
    saida.set(p, pos)
    pos += p.length
  }
  return saida
}

/** APP1 com um EXIF mínimo contendo só a orientação. */
function exifSoOrientacao(orientacao) {
  const corpo = [
    0x45, 0x78, 0x69, 0x66, 0x00, 0x00, // "Exif\0\0"
    0x4d, 0x4d, 0x00, 0x2a, 0x00, 0x00, 0x00, 0x08, // TIFF big-endian, IFD0 no byte 8
    0x00, 0x01, // 1 entrada
    0x01, 0x12, 0x00, 0x03, 0x00, 0x00, 0x00, 0x01, 0x00, orientacao, 0x00, 0x00, // Orientation (SHORT)
    0x00, 0x00, 0x00, 0x00, // sem próximo IFD
  ]
  const tam = corpo.length + 2
  return new Uint8Array([0xff, 0xe1, tam >> 8, tam & 0xff, ...corpo])
}

function limparJpeg(b, orientacao) {
  if (b[0] !== 0xff || b[1] !== 0xd8) throw new Error('JPEG inválido')
  const partes = [b.subarray(0, 2)]
  let i = 2
  let removidos = 0
  let inseriuOrientacao = false
  while (i < b.length) {
    if (b[i] !== 0xff) throw new Error('JPEG corrompido')
    const marcador = b[i + 1]
    if (marcador === 0xff) {
      i += 1
      continue
    }
    if (marcador === 0xda) {
      // Início dos dados da imagem: daqui em diante copia tudo.
      partes.push(b.subarray(i))
      break
    }
    const tamanho = u16(b, i + 2)
    const segmento = b.subarray(i, i + 2 + tamanho)
    const app = marcador >= 0xe0 && marcador <= 0xef
    const ehIcc = marcador === 0xe2 && String.fromCharCode(...segmento.subarray(4, 15)) === 'ICC_PROFILE'
    const manter = marcador === 0xe0 || ehIcc || marcador === 0xee || (!app && marcador !== 0xfe)
    if (manter) partes.push(segmento)
    else removidos += 1
    // Depois do JFIF (ou logo no começo), o EXIF mínimo com a orientação.
    if (!inseriuOrientacao && orientacao > 1 && (marcador === 0xe0 || partes.length === 1)) {
      partes.push(exifSoOrientacao(orientacao))
      inseriuOrientacao = true
    }
    i += 2 + tamanho
  }
  if (!inseriuOrientacao && orientacao > 1) partes.splice(1, 0, exifSoOrientacao(orientacao))
  return { dados: juntar(partes), removidos }
}

function limparPng(b) {
  const partes = [b.subarray(0, 8)]
  let i = 8
  let removidos = 0
  const remover = new Set(['tEXt', 'zTXt', 'iTXt', 'eXIf', 'tIME'])
  while (i < b.length) {
    const tamanho = u32be(b, i)
    const tipo = String.fromCharCode(b[i + 4], b[i + 5], b[i + 6], b[i + 7])
    const bloco = b.subarray(i, i + 12 + tamanho)
    if (remover.has(tipo)) removidos += 1
    else partes.push(bloco)
    i += 12 + tamanho
    if (tipo === 'IEND') break
  }
  return { dados: juntar(partes), removidos }
}

function limparWebp(b) {
  if (String.fromCharCode(...b.subarray(0, 4)) !== 'RIFF' || String.fromCharCode(...b.subarray(8, 12)) !== 'WEBP') throw new Error('WebP inválido')
  const partes = []
  let i = 12
  let removidos = 0
  while (i + 8 <= b.length) {
    const tipo = String.fromCharCode(...b.subarray(i, i + 4))
    const tamanho = u32le(b, i + 4)
    const total = 8 + tamanho + (tamanho % 2)
    const bloco = b.slice(i, i + total)
    if (tipo === 'EXIF' || tipo === 'XMP ') removidos += 1
    else {
      if (tipo === 'VP8X') bloco[8] &= ~(0x08 | 0x04) // sinalizadores EXIF e XMP
      partes.push(bloco)
    }
    i += total
  }
  const corpo = juntar(partes)
  const cab = new Uint8Array(12)
  cab.set([0x52, 0x49, 0x46, 0x46])
  const tam = corpo.length + 4
  cab.set([tam & 0xff, (tam >> 8) & 0xff, (tam >> 16) & 0xff, (tam >>> 24) & 0xff], 4)
  cab.set([0x57, 0x45, 0x42, 0x50], 8)
  return { dados: juntar([cab, corpo]), removidos }
}

/** Remove os metadados. `tipo`: 'jpg' | 'png' | 'webp'. */
export async function removerMetadados(arquivo, tipo) {
  const bytes = new Uint8Array(await arquivo.arrayBuffer())
  if (tipo === 'jpg') {
    const orientacao = await lerOrientacao(arquivo)
    return { ...limparJpeg(bytes, orientacao), mime: 'image/jpeg' }
  }
  if (tipo === 'png') return { ...limparPng(bytes), mime: 'image/png' }
  if (tipo === 'webp') return { ...limparWebp(bytes), mime: 'image/webp' }
  throw new Error('formato sem suporte')
}

async function lerOrientacao(arquivo) {
  const { default: exifr } = await import('exifr')
  return (await exifr.orientation(arquivo).catch(() => 1)) || 1
}

/**
 * Lê os metadados em grupos legíveis. Devolve
 * { gps: { lat, lon } | null, grupos: [{ titulo, itens: [[rotulo, valor]] }] }.
 */
export async function lerMetadados(arquivo) {
  const { default: exifr } = await import('exifr')
  const dados = await exifr
    .parse(arquivo, { tiff: true, exif: true, gps: true, iptc: true, xmp: true, icc: true, interop: false, translateValues: true, reviveValues: true, mergeOutput: true })
    .catch(() => null)
  if (!dados) return { gps: null, grupos: [], total: 0 }

  const fmtData = (d) => (d instanceof Date && !Number.isNaN(d) ? d.toLocaleString('pt-BR') : d)
  const item = (rotulo, valor) => (valor == null || valor === '' ? null : [rotulo, String(fmtData(valor))])
  const gps = Number.isFinite(dados.latitude) && Number.isFinite(dados.longitude) ? { lat: dados.latitude, lon: dados.longitude } : null

  const grupos = [
    {
      titulo: 'Localização',
      itens: [
        gps ? ['Coordenadas', `${gps.lat.toFixed(6)}, ${gps.lon.toFixed(6)}`] : null,
        item('Altitude', dados.GPSAltitude != null ? `${Math.round(dados.GPSAltitude)} m` : null),
      ],
    },
    {
      titulo: 'Câmera',
      itens: [
        item('Fabricante', dados.Make),
        item('Modelo', dados.Model),
        item('Lente', dados.LensModel),
        item('Exposição', dados.ExposureTime ? (dados.ExposureTime < 1 ? `1/${Math.round(1 / dados.ExposureTime)} s` : `${dados.ExposureTime} s`) : null),
        item('Abertura', dados.FNumber ? `f/${dados.FNumber}` : null),
        item('ISO', dados.ISO),
        item('Distância focal', dados.FocalLength ? `${dados.FocalLength} mm` : null),
        item('Flash', dados.Flash),
      ],
    },
    {
      titulo: 'Datas e autoria',
      itens: [
        item('Criada em', dados.DateTimeOriginal ?? dados.CreateDate),
        item('Modificada em', dados.ModifyDate),
        item('Software', dados.Software ?? dados.CreatorTool),
        item('Autor', dados.Artist ?? dados.Creator ?? dados['By-line']),
        item('Direitos', dados.Copyright ?? dados.Rights),
        item('Descrição', dados.ImageDescription ?? dados.Description ?? dados['Caption-Abstract']),
      ],
    },
    {
      titulo: 'Imagem',
      itens: [
        item('Orientação', dados.Orientation),
        item('Perfil de cor', dados.ProfileDescription ?? dados.ColorSpace),
        item('Resolução', dados.XResolution ? `${dados.XResolution} dpi` : null),
      ],
    },
  ]
    .map((g) => ({ ...g, itens: g.itens.filter(Boolean) }))
    .filter((g) => g.itens.length)

  return { gps, grupos, total: grupos.reduce((s, g) => s + g.itens.length, 0) }
}
