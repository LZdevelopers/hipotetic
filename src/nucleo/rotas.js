import { caminhoDa, categoriaDa, categorias, ferramentaPorSlug, ferramentas } from '../ferramentas/catalogo'
import { paginas, produto } from '../textos'
import { normalizarCaminho } from './roteador'

/**
 * Resolve um caminho em uma rota:
 *   /                     → início
 *   /pdf/unir             → ferramenta
 *   /privacidade, /termos → páginas de texto
 *   resto                 → 404
 */
export function resolverRota(caminhoBruto) {
  const caminho = normalizarCaminho(caminhoBruto)
  if (caminho === '/') return { tipo: 'inicio', caminho }
  const partes = caminho.slice(1).split('/')
  if (partes.length === 1) {
    if (paginas[partes[0]]) return { tipo: 'texto', caminho, pagina: partes[0] }
    if (partes[0] === 'ferramentas') return { tipo: 'ferramentas', caminho }
    const geral = ferramentaPorSlug(partes[0])
    if (geral) return { tipo: 'ferramenta', caminho, ferramenta: geral }
  }
  if (partes.length === 2) {
    const ferramenta = ferramentaPorSlug(partes.join('/'))
    if (ferramenta) return { tipo: 'ferramenta', caminho, ferramenta }
  }
  return { tipo: '404', caminho }
}

/** Todos os endereços para pré-renderizar e para o sitemap. */
export function todasAsRotas() {
  return [
    '/',
    '/ferramentas',
    ...ferramentas.map(caminhoDa),
    ...Object.keys(paginas).map((p) => `/${p}`),
  ]
}

const sufixo = ` · ${produto.nome}`

/**
 * Metadados da página: <title>, description, canonical, Open Graph e dados
 * estruturados (JSON-LD). Usados no build (HTML estático) e na navegação.
 */
export function metadadosDa(rota) {
  const url = produto.url + (rota.caminho === '/' ? '/' : rota.caminho)
  const base = { url, indexar: true }

  if (rota.tipo === 'inicio') {
    return {
      ...base,
      titulo: `${produto.nome} · ${produto.slogan}`,
      descricao: produto.descricao,
      jsonld: {
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        name: produto.nome,
        url: `${produto.url}/`,
        description: produto.descricao,
        inLanguage: 'pt-BR',
      },
    }
  }

  if (rota.tipo === 'ferramentas') {
    return {
      ...base,
      titulo: `Todas as ferramentas${sufixo}`,
      descricao: `${ferramentas.length} ferramentas grátis para vídeo, áudio, imagens, PDF, documentos e arquivos compactados. Sem cadastro e, quase sempre, sem enviar nada.`,
    }
  }

  if (rota.tipo === 'ferramenta') {
    const f = rota.ferramenta
    const c = categoriaDa(f)
    const migalhas = {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Início', item: `${produto.url}/` },
        ...(c ? [{ '@type': 'ListItem', position: 2, name: c.nome, item: `${produto.url}/ferramentas#${c.id}` }] : []),
        { '@type': 'ListItem', position: c ? 3 : 2, name: f.nome, item: url },
      ],
    }
    const app = {
      '@context': 'https://schema.org',
      '@type': 'WebApplication',
      name: f.titulo,
      description: f.descricao,
      url,
      applicationCategory: 'MultimediaApplication',
      operatingSystem: 'Qualquer (navegador)',
      browserRequirements: 'Requer JavaScript e um navegador atual.',
      isAccessibleForFree: true,
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'BRL' },
      inLanguage: 'pt-BR',
    }
    const extras = [migalhas, app]
    if (f.perguntas?.length) {
      extras.push({
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: f.perguntas.map((q) => ({ '@type': 'Question', name: q.p, acceptedAnswer: { '@type': 'Answer', text: q.r } })),
      })
    }
    return { ...base, titulo: `${f.titulo}${sufixo}`, descricao: f.descricao, jsonld: extras }
  }

  if (rota.tipo === 'texto') {
    const p = paginas[rota.pagina]
    return { ...base, titulo: `${p.titulo}${sufixo}`, descricao: p.descricao }
  }

  return { ...base, indexar: false, titulo: `Página não encontrada${sufixo}`, descricao: produto.descricao }
}

export { categorias }
