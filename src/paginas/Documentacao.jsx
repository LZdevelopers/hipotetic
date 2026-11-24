import { useEffect, useMemo, useRef, useState } from 'react'
import { Icone } from '../componentes/Icone'
import { SeloCategoria } from '../componentes/ui'
import { caminhoDa, categoriasComFerramentas, corDa, ferramentaPorSlug, ferramentas, ferramentasDaCategoria, normalizar } from '../ferramentas/catalogo'
import { Link } from '../nucleo/roteador'

/*
 * Documentação: como o site funciona e o que cada ferramenta faz. No jeito da
 * documentação do Global-Time: índice com busca à esquerda, o texto no meio e
 * "Nesta página" à direita (com a seção atual marcada).
 *
 * Âncoras das ferramentas: /documentacao#ferramenta-pdf-editor (as páginas
 * das ferramentas apontam para elas).
 */

export const ancoraDaFerramenta = (f) => `ferramenta-${f.slug.replace(/\//g, '-')}`

const Tecla = ({ children }) => <kbd className="rounded-md border border-borda-forte bg-superficie-2 px-1.5 py-px font-mono text-[0.75rem] text-tinta">{children}</kbd>

function Tabela({ cabecalho, linhas }) {
  return (
    <div className="rolagem-fina my-4 overflow-x-auto rounded-xl border border-borda">
      <table className="w-full border-collapse text-left text-sm">
        <thead className="bg-superficie-2 text-xs font-semibold tracking-wide text-fraca uppercase">
          <tr>
            {cabecalho.map((c) => (
              <th key={c} className="px-3 py-2">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-borda">
          {linhas.map((l, i) => (
            <tr key={i}>
              {l.map((c, j) => (
                <td key={j} className="px-3 py-2 align-top text-texto">
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

const LinkFerramenta = ({ slug, children }) => {
  const f = ferramentaPorSlug(slug)
  if (!f) return children ?? null
  return (
    <Link para={caminhoDa(f)} className="font-semibold text-tinta underline decoration-borda-forte underline-offset-4 hover:decoration-tinta">
      {children ?? f.nome}
    </Link>
  )
}

/* ─── Conteúdo ─────────────────────────────────────────────────────────── */

const SECOES = [
  {
    grupo: 'Começando',
    id: 'visao-geral',
    titulo: 'Visão geral',
    conteudo: (
      <>
        <p>
          O hipotetic reúne ferramentas para tudo o que você faz com arquivos: converter, comprimir, cortar, juntar, editar e organizar vídeos, áudios, imagens, PDFs,
          documentos e arquivos compactados. São {ferramentas.length} ferramentas, todas grátis.
        </p>
        <p>
          Há dois tipos. Os <strong>editores</strong> (vídeo, áudio, imagem e PDF) ocupam a tela inteira e fazem muita coisa num lugar só. As outras ferramentas fazem uma
          tarefa específica e direta, como baixar um vídeo, comprimir um PDF ou criar um QR Code. O <LinkFerramenta slug="converter">Conversor de arquivos</LinkFerramenta>{' '}
          transforma quase qualquer formato em outro.
        </p>
      </>
    ),
  },
  {
    grupo: 'Começando',
    id: 'privacidade',
    titulo: 'Onde os arquivos são processados',
    palavras: 'privacidade servidor upload enviar seguro',
    conteudo: (
      <>
        <p>
          Quase tudo roda <strong>no seu navegador</strong>, com WebAssembly e a aceleração de vídeo do próprio aparelho. O arquivo é lido, transformado e baixado sem sair do
          seu computador ou celular: não há envio para servidor nenhum.
        </p>
        <p>As exceções avisam na própria página, com o selo “Usa o servidor”:</p>
        <ul>
          <li>
            <LinkFerramenta slug="video/baixar" />: o link passa pelo nosso servidor para buscar o vídeo na plataforma. Nada fica guardado.
          </li>
          <li>Conversão de documentos (DOCX, ODT, DOC, RTF ↔ PDF), quando disponível: o arquivo vai ao servidor, é convertido e apagado em seguida.</li>
        </ul>
      </>
    ),
  },
  {
    grupo: 'Começando',
    id: 'gratis',
    titulo: 'Grátis e sem conta',
    palavras: 'preço pago assinatura cadastro anúncio marca d’água',
    conteudo: (
      <p>
        Não existe conta, cadastro, plano pago nem anúncios. O resultado sai sem marca d’água e sem limites artificiais: os únicos limites são os do seu aparelho (veja{' '}
        <a href="#limites" className="font-semibold text-tinta underline decoration-borda-forte underline-offset-4">Limites</a>).
      </p>
    ),
  },
  {
    grupo: 'Começando',
    id: 'navegadores',
    titulo: 'Navegadores e aparelhos',
    palavras: 'chrome edge firefox safari celular lento',
    conteudo: (
      <>
        <p>
          Funciona em qualquer navegador atual. Para vídeo, o <strong>Chrome</strong> e o <strong>Edge</strong> são os mais rápidos, porque usam a aceleração de vídeo do
          aparelho. Firefox e Safari funcionam, mas conversões de vídeo podem demorar mais.
        </p>
        <p>No celular tudo funciona, mas arquivos grandes dependem da memória do aparelho: se travar, feche outras abas e tente de novo.</p>
      </>
    ),
  },
  {
    grupo: 'Usando o site',
    id: 'buscar',
    titulo: 'Encontrar uma ferramenta',
    palavras: 'busca pesquisar menu atalho ctrl k',
    conteudo: (
      <>
        <p>
          Use a busca no alto da página (ou <Tecla>Ctrl</Tecla> + <Tecla>K</Tecla>, <Tecla>⌘</Tecla> + <Tecla>K</Tecla> no Mac) e escreva o que quer fazer: “juntar pdf”,
          “mp4 para mp3”, “tirar fundo”. Os menus do topo mostram as ferramentas de cada tipo de arquivo, com o editor primeiro; a página{' '}
          <Link para="/ferramentas" className="font-semibold text-tinta underline decoration-borda-forte underline-offset-4">
            Todas as ferramentas
          </Link>{' '}
          lista tudo, com filtro.
        </p>
      </>
    ),
  },
  {
    grupo: 'Usando o site',
    id: 'salvo',
    titulo: 'Seu trabalho fica salvo',
    palavras: 'salvar recuperar fechou perdi rascunho começar do zero',
    conteudo: (
      <>
        <p>
          Tudo o que você está fazendo numa ferramenta fica salvo no navegador: os arquivos escolhidos, as opções, os textos digitados, o resultado já processado e os nomes
          que você trocou. Se fechar a aba sem querer, é só abrir a mesma ferramenta de novo — aparece “Recuperamos o que você estava fazendo”.
        </p>
        <ul>
          <li>“Começar do zero”, nesse aviso, apaga o que estava salvo daquela ferramenta.</li>
          <li>Fica só neste navegador e neste aparelho: nada vai para a internet. Em janela anônima, some ao fechar.</li>
          <li>Os editores de vídeo e de áudio guardam o projeto inteiro; o editor de PDF também, com desfazer (<Tecla>Ctrl</Tecla> + <Tecla>Z</Tecla>).</li>
        </ul>
      </>
    ),
  },
  {
    grupo: 'Usando o site',
    id: 'baixar',
    titulo: 'Renomear e baixar',
    palavras: 'nome do arquivo renomear download zip formato qualidade',
    conteudo: (
      <>
        <p>
          Clique no nome de qualquer arquivo pronto (ou no nome do projeto, no topo dos editores) para trocar o nome antes de baixar; a extensão fica como está. Com vários
          arquivos, “Baixar tudo (.zip)” junta todos — e o nome do ZIP também pode ser trocado.
        </p>
        <p>
          Nos editores, o botão “Baixar” abre uma janela com o nome e as opções do arquivo final (formato, qualidade, tamanho estimado, páginas, senha…). Assim você decide
          tudo na hora de salvar.
        </p>
      </>
    ),
  },
  {
    grupo: 'Usando o site',
    id: 'tema',
    titulo: 'Tema claro e escuro',
    conteudo: <p>O botão de sol/lua no alto troca o tema. A escolha fica salva neste navegador. O tema escuro é o padrão.</p>,
  },
  {
    grupo: 'Editores',
    id: 'editor-video',
    titulo: 'Editor de vídeo',
    palavras: 'timeline clipes cortar texto música transição',
    conteudo: (
      <>
        <p>
          Linha do tempo com vídeos, imagens e GIFs: cortar, dividir, velocidade, transições, filtros, enquadramento (preencher, zoom, fundo desfocado), proporção da tela
          (9:16, 1:1…), camadas de texto e imagem, desfoque e trilha de áudio. A prévia é ao vivo. <LinkFerramenta slug="video/editor">Abrir o editor de vídeo</LinkFerramenta>.
        </p>
        <Tabela
          cabecalho={['Tecla', 'O que faz']}
          linhas={[
            [<Tecla key="a">Espaço</Tecla>, 'Tocar ou pausar'],
            [<Tecla key="a">S</Tecla>, 'Dividir no cursor'],
            [<><Tecla>Q</Tecla> / <Tecla>W</Tecla></>, 'Aparar antes / depois do cursor'],
            [<><Tecla>,</Tecla> / <Tecla>.</Tecla></>, 'Voltar / avançar um quadro'],
            [<><Tecla>←</Tecla> / <Tecla>→</Tecla></>, '1 segundo (com Shift, 5 segundos)'],
            [<><Tecla>Home</Tecla> / <Tecla>End</Tecla></>, 'Início / fim'],
            [<Tecla key="a">F</Tecla>, 'Tela cheia'],
            [<Tecla key="a">Delete</Tecla>, 'Apagar o que está selecionado'],
            [<><Tecla>Ctrl</Tecla> + <Tecla>C</Tecla> / <Tecla>V</Tecla> / <Tecla>D</Tecla></>, 'Copiar, colar, duplicar'],
            [<><Tecla>Ctrl</Tecla> + <Tecla>Z</Tecla></>, 'Desfazer (com Shift, refazer)'],
            [<Tecla key="a">Esc</Tecla>, 'Tirar a seleção'],
          ]}
        />
      </>
    ),
  },
  {
    grupo: 'Editores',
    id: 'editor-audio',
    titulo: 'Editor de áudio',
    palavras: 'cortar fade volume silêncio velocidade mp3',
    conteudo: (
      <>
        <p>
          Cortar com fade, volume (ajustar ou normalizar), tirar silêncio e mudar a velocidade (com ou sem mudar o tom). Vários arquivos entram em sequência. Tudo toca na
          hora no player. <LinkFerramenta slug="audio/editor">Abrir o editor de áudio</LinkFerramenta>.
        </p>
        <Tabela
          cabecalho={['Tecla', 'O que faz']}
          linhas={[
            [<Tecla key="a">Espaço</Tecla>, 'Tocar ou pausar'],
            [<><Tecla>I</Tecla> / <Tecla>O</Tecla></>, 'Marcar início / fim do trecho no cursor'],
            [<><Tecla>←</Tecla> / <Tecla>→</Tecla></>, '1 segundo (com Shift, 5 segundos)'],
            [<><Tecla>Ctrl</Tecla> + <Tecla>Z</Tecla></>, 'Desfazer (com Shift, refazer)'],
          ]}
        />
      </>
    ),
  },
  {
    grupo: 'Editores',
    id: 'editor-imagem',
    titulo: 'Editor de imagem',
    palavras: 'recortar girar redimensionar esticar filtros cores remover fundo apagar objeto pincel texto ia',
    conteudo: (
      <>
        <p>
          Uma imagem por vez, em tela cheia. Recortar, Tamanho e Girar têm “Aplicar”: a edição continua sobre o resultado, e tudo tem desfazer. Formato, qualidade e o
          tamanho estimado do arquivo aparecem ao baixar. <LinkFerramenta slug="imagem/editor">Abrir o editor de imagem</LinkFerramenta>.
        </p>
        <ul>
          <li>
            <strong>Ajustes</strong>: exposição, brilho, contraste, saturação, temperatura, matiz, P&B, sépia, nitidez, desfoque, vinheta e filtros prontos. Não estragam a
            imagem: dá para mudar a qualquer hora.
          </li>
          <li>
            <strong>Tamanho</strong>: largura e altura com ou sem manter a proporção — desmarque e arraste as alças para esticar ou achatar. Tamanhos de rede social cortam as
            sobras, sem esticar.
          </li>
          <li>
            <strong>Remover fundo</strong> e <strong>Apagar objeto</strong>: IA que roda no seu aparelho, sem travar a página (dá para cancelar a qualquer momento). Na
            primeira vez, o navegador baixa o modelo e guarda para as próximas: 25 MB no modo <em>Pessoas · rápido</em>, 190 MB no <em>Qualquer coisa · preciso</em> e 35 MB
            para apagar. A imagem nunca é enviada.
          </li>
          <li>
            Depois de remover o fundo, ajuste antes de aplicar: <strong>retoque à mão</strong> (pincel <em>Recuperar</em> traz de volta o que a IA tirou sem querer;
            <em>Apagar</em> tira o que sobrou — o que foi removido aparece apagadinho para guiar, e Ctrl+Z desfaz o último traço), <strong>encolher ou expandir</strong> a borda, <strong>suavizar</strong>, <strong>limpar sobras</strong> e o
            novo fundo (<strong>transparente</strong>, <strong>cor</strong> ou a própria foto <strong>desfocada</strong>). O fundo sai uma vez só; para refazer com outras
            opções, use Desfazer — as opções voltam sem rodar a IA de novo.
          </li>
          <li>
            <strong>Pincel</strong> (com borracha que deixa transparente) e <strong>Texto</strong> (fonte, cor, contorno; arraste para mover).
          </li>
        </ul>
        <Tabela
          cabecalho={['Tecla', 'O que faz']}
          linhas={[
            [<><Tecla>Ctrl</Tecla> + <Tecla>Z</Tecla></>, 'Desfazer (com Shift, refazer)'],
            [<Tecla key="a">Enter</Tecla>, 'Aplicar o recorte'],
            [<Tecla key="a">Delete</Tecla>, 'Apagar o texto selecionado'],
            [<Tecla key="a">Esc</Tecla>, 'Tirar a seleção'],
          ]}
        />
      </>
    ),
  },
  {
    grupo: 'Editores',
    id: 'editor-pdf',
    titulo: 'Editor de PDF',
    palavras: 'unir juntar dividir extrair organizar assinar numerar marca d’água senha',
    conteudo: (
      <>
        <p>Abra um ou vários PDFs e faça tudo numa tela:</p>
        <ul>
          <li>
            <strong>Páginas</strong> (à esquerda): arraste para reordenar, gire, duplique, exclua, junte outros PDFs, ponha páginas em branco e selecione (Ctrl+clique) as que
            quer extrair.
          </li>
          <li>
            <strong>Anotar</strong>: texto, assinatura (desenhada, digitada ou de foto), imagem, destaque, nota e retângulo.
          </li>
          <li>
            <strong>Números e marca</strong>: número em cada página (posição e formato, como “Página 1 de 3”) e marca d’água, com prévia.
          </li>
          <li>
            <strong>Documento</strong>: título, autor, assunto e palavras-chave.
          </li>
          <li>
            <strong>Baixar</strong>: todas as páginas, só as selecionadas ou as que você digitar (“3, 1-2”, na ordem digitada); um PDF, um por página ou a cada N páginas;
            reduzir o tamanho; senha para abrir.
          </li>
        </ul>
        <Tabela
          cabecalho={['Tecla', 'O que faz']}
          linhas={[
            [<><Tecla>Ctrl</Tecla> + <Tecla>Z</Tecla></>, 'Desfazer (com Shift, refazer)'],
            [<Tecla key="a">Delete</Tecla>, 'Apagar o item selecionado'],
            [<Tecla key="a">Esc</Tecla>, 'Tirar a seleção'],
          ]}
        />
        <p>
          <LinkFerramenta slug="pdf/editor">Abrir o editor de PDF</LinkFerramenta>.
        </p>
      </>
    ),
  },
  // As ferramentas de cada categoria entram aqui (geradas do catálogo).
  {
    grupo: 'Ajuda',
    id: 'limites',
    titulo: 'Limites',
    palavras: 'tamanho máximo gb mb grande',
    conteudo: (
      <>
        <p>O limite é a memória do aparelho. Os valores abaixo são o máximo que cada tipo aceita:</p>
        <Tabela
          cabecalho={['Tipo', 'Até']}
          linhas={[
            ['Vídeo', '2 GB'],
            ['Áudio', '1 GB'],
            ['Imagem', '60 MB'],
            ['PDF', '300 MB'],
            ['Compactados (ZIP, 7Z, RAR…)', '1 GB'],
            ['Documentos convertidos no servidor', '4,4 MB'],
          ]}
        />
      </>
    ),
  },
  {
    grupo: 'Ajuda',
    id: 'problemas',
    titulo: 'Problemas comuns',
    palavras: 'erro travou lento não funciona senha youtube',
    conteudo: (
      <ul>
        <li>
          <strong>Travou ou ficou muito lento</strong>: arquivos grandes usam bastante memória. Feche outras abas, use o Chrome ou o Edge e tente de novo.
        </li>
        <li>
          <strong>“Este PDF é protegido por senha”</strong>: tire a senha antes em <LinkFerramenta slug="pdf/senha" />.
        </li>
        <li>
          <strong>“Não reconhecemos este formato”</strong>: o arquivo pode estar corrompido ou ter a extensão errada. <LinkFerramenta slug="utilitarios/identificar" /> mostra
          o tipo real.
        </li>
        <li>
          <strong>O vídeo não baixa</strong>: algumas plataformas bloqueiam downloads de tempos em tempos. Tente de novo mais tarde.
        </li>
        <li>
          <strong>Perdi o que estava fazendo</strong>: abra a mesma ferramenta neste navegador; em janela anônima, o salvo não sobrevive ao fechar.
        </li>
      </ul>
    ),
  },
  {
    grupo: 'Ajuda',
    id: 'sobre',
    titulo: 'Sobre o projeto',
    conteudo: (
      <p>
        O hipotetic é um projeto da LZdev. Veja também a{' '}
        <Link para="/privacidade" className="font-semibold text-tinta underline decoration-borda-forte underline-offset-4">
          Privacidade
        </Link>{' '}
        e os{' '}
        <Link para="/termos" className="font-semibold text-tinta underline decoration-borda-forte underline-offset-4">
          Termos de uso
        </Link>
        .
      </p>
    ),
  },
]

/** Uma seção por categoria, com cada ferramenta (o que faz e as dúvidas dela). */
function secoesDasFerramentas() {
  const conversor = ferramentaPorSlug('converter')
  const lista = [
    ...(conversor ? [{ id: 'categoria-conversor', titulo: 'Conversor', itens: [conversor] }] : []),
    ...categoriasComFerramentas().map((c) => ({ id: `categoria-${c.id}`, titulo: c.nome, itens: ferramentasDaCategoria(c.id) })),
  ]
  return lista.map((s) => ({
    grupo: 'Ferramentas',
    id: s.id,
    titulo: s.titulo,
    palavras: s.itens.map((f) => `${f.nome} ${f.termos?.join(' ') ?? ''}`).join(' '),
    subtitulos: s.itens.map((f) => ({ id: ancoraDaFerramenta(f), titulo: f.nome })),
    conteudo: (
      <div className="flex flex-col gap-6">
        {s.itens.map((f) => (
          <div key={f.slug} id={ancoraDaFerramenta(f)} className="scroll-mt-24">
            <h3 className="flex items-center gap-2.5 text-base">
              <SeloCategoria categoria={corDa(f)} icone={f.icone} tamanho="pp" />
              {f.nome}
            </h3>
            <p className="mt-2">
              {f.descricao}{' '}
              <Link para={caminhoDa(f)} className="inline-flex items-center gap-1 font-semibold whitespace-nowrap text-tinta underline decoration-borda-forte underline-offset-4 hover:decoration-tinta">
                Abrir
                <Icone nome="seta" tamanho={13} />
              </Link>
            </p>
            {f.perguntas?.length ? (
              <dl className="mt-3 flex flex-col gap-2.5 border-l-2 border-borda pl-4">
                {f.perguntas.map((q) => (
                  <div key={q.p}>
                    <dt className="text-sm font-semibold text-tinta">{q.p}</dt>
                    <dd className="mt-0.5 text-sm text-suave">{q.r}</dd>
                  </div>
                ))}
              </dl>
            ) : null}
          </div>
        ))}
      </div>
    ),
  }))
}

/* ─── Página ───────────────────────────────────────────────────────────── */

export function Documentacao() {
  const secoes = useMemo(() => {
    const ajuda = SECOES.findIndex((s) => s.grupo === 'Ajuda')
    return [...SECOES.slice(0, ajuda), ...secoesDasFerramentas(), ...SECOES.slice(ajuda)]
  }, [])
  const grupos = useMemo(() => [...new Set(secoes.map((s) => s.grupo))], [secoes])
  const [busca, setBusca] = useState('')
  const [atual, setAtual] = useState(secoes[0].id)
  const [indiceAberto, setIndiceAberto] = useState(false)
  const textos = useRef({})

  // O texto de cada seção (para a busca), lido do que foi desenhado.
  useEffect(() => {
    for (const s of secoes) textos.current[s.id] = normalizar(`${s.titulo} ${s.palavras ?? ''} ${document.getElementById(s.id)?.textContent ?? ''}`)
  }, [secoes])

  // Seção atual: a última cujo topo já passou do alto da tela (abaixo do cabeçalho).
  useEffect(() => {
    let quadro = 0
    const medir = () => {
      cancelAnimationFrame(quadro)
      quadro = requestAnimationFrame(() => {
        let id = secoes[0].id
        for (const s of secoes) {
          const el = document.getElementById(s.id)
          if (el && !el.hidden && el.getBoundingClientRect().top <= 140) id = s.id
        }
        setAtual(id)
      })
    }
    medir()
    addEventListener('scroll', medir, { passive: true })
    addEventListener('hashchange', medir)
    return () => {
      cancelAnimationFrame(quadro)
      removeEventListener('scroll', medir)
      removeEventListener('hashchange', medir)
    }
  }, [secoes])

  const termos = normalizar(busca).split(/\s+/).filter(Boolean)
  const achadas = termos.length ? secoes.filter((s) => termos.every((t) => (textos.current[s.id] ?? normalizar(`${s.titulo} ${s.palavras ?? ''}`)).includes(t))) : secoes
  const secaoAtual = secoes.find((s) => s.id === atual) ?? secoes[0]
  const naPagina = secoes.filter((s) => s.grupo === secaoAtual.grupo)

  const indice = (
    <nav aria-label="Documentação" className="flex flex-col gap-5">
      {grupos.map((g) => {
        const itens = achadas.filter((s) => s.grupo === g)
        if (!itens.length) return null
        return (
          <div key={g}>
            <p className="mb-1.5 text-[0.6875rem] font-bold tracking-wider text-fraca uppercase">{g}</p>
            <ul className="flex flex-col">
              {itens.map((s) => (
                <li key={s.id}>
                  <a
                    href={`#${s.id}`}
                    onClick={() => setIndiceAberto(false)}
                    aria-current={s.id === atual ? 'location' : undefined}
                    className={`block rounded-md px-2 py-1 text-sm transition-colors ${s.id === atual ? 'bg-superficie-2 font-semibold text-tinta' : 'text-suave hover:text-tinta'}`}
                  >
                    {s.titulo}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )
      })}
    </nav>
  )

  return (
    <div className="mx-auto grid w-full max-w-[84rem] gap-8 px-4 pt-10 sm:px-6 lg:grid-cols-[15rem_minmax(0,1fr)] lg:px-8 xl:grid-cols-[15rem_minmax(0,1fr)_13rem]">
      {/* Índice + busca */}
      <aside className="lg:sticky lg:top-20 lg:max-h-[calc(100dvh-6rem)] lg:self-start lg:overflow-y-auto lg:pr-2">
        <label className="relative block">
          <span className="sr-only">Buscar na documentação</span>
          <Icone nome="buscar" tamanho={16} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-fraca" />
          <input
            type="search"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar na documentação"
            className="h-10 w-full rounded-[var(--radius-controle)] border border-borda bg-superficie pr-3 pl-9 text-sm text-tinta placeholder:text-fraca focus:border-acento focus:outline-none"
          />
        </label>
        <p className="mt-2 min-h-5 text-xs text-fraca" aria-live="polite">
          {termos.length ? (achadas.length ? `${achadas.length} ${achadas.length === 1 ? 'seção' : 'seções'}` : 'Nada encontrado') : ''}
        </p>
        <button type="button" onClick={() => setIndiceAberto((a) => !a)} aria-expanded={indiceAberto} className="mt-1 flex w-full items-center justify-between rounded-lg border border-borda px-3 py-2 text-sm font-semibold text-tinta lg:hidden">
          Índice
          <Icone nome="setaBaixo" tamanho={15} className={`transition-transform ${indiceAberto ? 'rotate-180' : ''}`} />
        </button>
        <div className={`mt-3 ${indiceAberto ? '' : 'max-lg:hidden'}`}>{indice}</div>
      </aside>

      {/* Texto */}
      <article className="min-w-0 pb-10">
        <header className="mb-10">
          <p className="text-sm font-semibold text-fraca">Documentação</p>
          <h1 className="mt-1 text-[clamp(1.9rem,3.4vw,2.6rem)] leading-tight font-extrabold tracking-[-0.03em]">Como usar o hipotetic</h1>
          <p className="mt-3 max-w-2xl text-suave">Tudo sobre como o site funciona, o que cada ferramenta faz e as dúvidas mais comuns.</p>
        </header>
        <div className="flex flex-col">
          {secoes.map((s, i) => (
            <section
              key={s.id}
              id={s.id}
              aria-labelledby={`${s.id}-titulo`}
              hidden={termos.length > 0 && !achadas.includes(s)}
              className={`scroll-mt-24 py-8 ${i ? 'border-t border-borda' : 'pt-0'} [&_li]:mt-1.5 [&_p]:leading-relaxed [&_p+p]:mt-3 [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:pl-5`}
            >
              {i === 0 || secoes[i - 1].grupo !== s.grupo ? <p className="mb-1 text-xs font-bold tracking-wider text-fraca uppercase">{s.grupo}</p> : null}
              <h2 id={`${s.id}-titulo`} className="mb-4 text-2xl">
                {s.titulo}
              </h2>
              <div className="text-[0.9375rem] text-texto">{s.conteudo}</div>
            </section>
          ))}
        </div>
      </article>

      {/* Nesta página */}
      <aside aria-labelledby="titulo-nesta-pagina" className="hidden xl:sticky xl:top-20 xl:block xl:self-start">
        <p id="titulo-nesta-pagina" className="mb-2 text-[0.6875rem] font-bold tracking-wider text-fraca uppercase">
          Nesta página
        </p>
        <ul className="flex flex-col border-l border-borda">
          {naPagina.map((s) => (
            <li key={s.id}>
              <a href={`#${s.id}`} className={`-ml-px block border-l-2 py-1 pl-3 text-sm transition-colors ${s.id === atual ? 'border-tinta font-semibold text-tinta' : 'border-transparent text-suave hover:text-tinta'}`}>
                {s.titulo}
              </a>
              {s.id === atual && s.subtitulos ? (
                <ul className="mb-1">
                  {s.subtitulos.map((x) => (
                    <li key={x.id}>
                      <a href={`#${x.id}`} className="block py-0.5 pl-6 text-xs text-fraca hover:text-tinta">
                        {x.titulo}
                      </a>
                    </li>
                  ))}
                </ul>
              ) : null}
            </li>
          ))}
        </ul>
      </aside>
    </div>
  )
}
