import { ModeloConversao } from '../../componentes/ferramenta/ModeloConversao'
import { AreaTexto, Caixa, Grupo, Segmentado } from '../../componentes/ui'
import { DESCRICAO_IMAGEM, EXTENSOES_IMAGEM, LIMITE_IMAGEM, processarLote } from '../../motores/imagem'
import { nomeSeguro, semExtensao } from '../../nucleo/arquivos'
import { CorDeFundo, EscolhaFormato, Qualidade } from './_comum'

export const PREDEFINIDOS = [
  { grupo: 'Instagram', id: 'ig-quadrado', nome: 'Post quadrado', w: 1080, h: 1080 },
  { grupo: 'Instagram', id: 'ig-retrato', nome: 'Post retrato', w: 1080, h: 1350 },
  { grupo: 'Instagram', id: 'ig-story', nome: 'Stories e Reels', w: 1080, h: 1920 },
  { grupo: 'YouTube', id: 'yt-miniatura', nome: 'Miniatura', w: 1280, h: 720 },
  { grupo: 'YouTube', id: 'yt-banner', nome: 'Banner do canal', w: 2560, h: 1440 },
  { grupo: 'Facebook', id: 'fb-post', nome: 'Post', w: 1200, h: 630 },
  { grupo: 'Facebook', id: 'fb-capa', nome: 'Capa', w: 1640, h: 624 },
  { grupo: 'X (Twitter)', id: 'x-post', nome: 'Post', w: 1600, h: 900 },
  { grupo: 'X (Twitter)', id: 'x-capa', nome: 'Cabeçalho', w: 1500, h: 500 },
  { grupo: 'LinkedIn', id: 'li-post', nome: 'Post', w: 1200, h: 627 },
  { grupo: 'LinkedIn', id: 'li-capa', nome: 'Capa', w: 1584, h: 396 },
  { grupo: 'Outros', id: 'og', nome: 'Prévia de link (Open Graph)', w: 1200, h: 630 },
  { grupo: 'Outros', id: 'perfil', nome: 'Foto de perfil', w: 800, h: 800 },
  { grupo: 'Outros', id: 'pinterest', nome: 'Pin do Pinterest', w: 1000, h: 1500 },
  { grupo: 'Outros', id: 'fullhd', nome: 'Papel de parede Full HD', w: 1920, h: 1080 },
]

/** "1200x800, 600 × 400" → [{ w, h }] */
export function lerPersonalizados(texto) {
  return [...String(texto).matchAll(/(\d{1,5})\s*[x×*]\s*(\d{1,5})/gi)]
    .map((m) => ({ w: Number(m[1]), h: Number(m[2]) }))
    .filter((t) => t.w >= 1 && t.h >= 1 && t.w <= 10000 && t.h <= 10000)
}

function Configuracoes({ opcoes, mudar, definir }) {
  const grupos = [...new Set(PREDEFINIDOS.map((p) => p.grupo))]
  const alternar = (id, marcado) => definir((o) => ({ ...o, escolhidos: marcado ? [...o.escolhidos, id] : o.escolhidos.filter((x) => x !== id) }))
  return (
    <div className="flex flex-col gap-5">
      <Grupo titulo="Tamanhos">
        <div className="flex max-h-72 flex-col gap-4 overflow-y-auto pr-1">
          {grupos.map((g) => (
            <div key={g}>
              <p className="mb-1.5 text-xs font-semibold text-tinta">{g}</p>
              <div className="flex flex-col gap-1.5">
                {PREDEFINIDOS.filter((p) => p.grupo === g).map((p) => (
                  <Caixa key={p.id} rotulo={`${p.nome} · ${p.w}×${p.h}`} marcado={opcoes.escolhidos.includes(p.id)} aoMudar={(m) => alternar(p.id, m)} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </Grupo>
      <AreaTexto rotulo="Tamanhos personalizados" valor={opcoes.personalizados} aoMudar={(v) => mudar('personalizados', v)} placeholder="Ex.: 1200x800, 600x400" rows={2} className="[&_textarea]:min-h-16" />
      <Segmentado
        rotulo="Quando a proporção não bate"
        valor={opcoes.modo}
        aoMudar={(v) => mudar('modo', v)}
        opcoes={[
          { valor: 'cobrir', rotulo: 'Cortar sobras' },
          { valor: 'conter', rotulo: 'Com bordas' },
        ]}
      />
      {opcoes.modo === 'conter' || opcoes.formato === 'jpg' ? <CorDeFundo valor={opcoes.fundo} aoMudar={(v) => mudar('fundo', v)} rotulo="Cor das bordas" /> : null}
      <EscolhaFormato valor={opcoes.formato} aoMudar={(v) => mudar('formato', v)} />
      <Qualidade valor={opcoes.qualidade} aoMudar={(v) => mudar('qualidade', v)} formato={opcoes.formato} />
    </div>
  )
}

export default function Tamanhos() {
  return (
    <ModeloConversao
      extensoes={EXTENSOES_IMAGEM}
      descricaoFormatos={DESCRICAO_IMAGEM}
      limiteBytes={LIMITE_IMAGEM}
      maximo={20}
      aceitarColar
      opcoesIniciais={{ escolhidos: ['ig-quadrado', 'ig-story', 'yt-miniatura', 'og'], personalizados: '', modo: 'cobrir', fundo: '#ffffff', formato: 'jpg', qualidade: 88 }}
      Configuracoes={Configuracoes}
      validarOpcoes={(o, arquivos) => {
        const n = o.escolhidos.length + lerPersonalizados(o.personalizados).length
        if (!n) return 'Escolha pelo menos um tamanho.'
        if (n * arquivos.length > 300) return 'Muitas combinações de uma vez (máximo de 300 imagens geradas).'
        return null
      }}
      rotuloAcao="Gerar"
      nomeZip="imagens-redimensionadas.zip"
      processar={(itens, o, ctx) => {
        const alvos = [
          ...PREDEFINIDOS.filter((p) => o.escolhidos.includes(p.id)).map((p) => ({ ...p, rotulo: `${p.grupo}-${p.nome}` })),
          ...lerPersonalizados(o.personalizados).map((t) => ({ ...t, rotulo: '' })),
        ]
        const combinacoes = itens.flatMap((item) => alvos.map((alvo) => ({ ...item, alvo })))
        return processarLote(
          combinacoes,
          ({ arquivo, alvo }) => ({
            nome: nomeSeguro(`${semExtensao(arquivo.name)}${alvo.rotulo ? `-${alvo.rotulo.toLowerCase().replace(/[^a-z0-9]+/gi, '-')}` : ''}-${alvo.w}x${alvo.h}.${o.formato}`),
            escalaSvg: 4,
            tamanho: { largura: alvo.w, altura: alvo.h, modo: o.modo, fundo: o.modo === 'conter' ? o.fundo : undefined },
            saida: { formato: o.formato, qualidade: o.qualidade, fundo: o.fundo },
          }),
          { ...ctx, rotulo: 'Gerando' },
        )
      }}
    />
  )
}
