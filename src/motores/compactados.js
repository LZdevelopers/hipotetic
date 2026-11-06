/**
 * Arquivos compactados no navegador com o 7-Zip (WebAssembly): ZIP, 7Z, RAR,
 * TAR, GZ, BZ2, XZ, ISO, CAB… para extrair; ZIP, 7Z, TAR e TAR.GZ para criar.
 * RAR só se extrai — o formato é proprietário e não pode ser criado.
 *
 * Proteções:
 *  - lista antes de extrair e recusa "bombas" (tamanho descompactado
 *    absurdo ou taxa de compressão suspeita) antes de gastar memória;
 *  - caminhos sanitizados (sem "..", sem caminho absoluto, sem caracteres
 *    proibidos) — nada escapa da pasta de extração;
 *  - limite de quantidade de arquivos.
 */
import { formatarBytes, nomeSeguro } from '../nucleo/arquivos'
import { ErroAmigavel } from '../nucleo/tarefa'

export const EXTENSOES_COMPACTADOS = ['zip', 'rar', '7z', 'tar', 'gz', 'tgz', 'bz2', 'tbz2', 'xz', 'txz', 'iso', 'cab', 'lzh', 'arj', 'z', 'zst', 'wim', 'cpio', 'jar', 'apk', 'epub']
export const DESCRICAO_COMPACTADOS = 'ZIP, RAR, 7Z, TAR, GZ, BZ2, XZ, ISO e outros'
export const LIMITE_COMPACTADO = 1024 * 1024 * 1024
const LIMITE_DESCOMPACTADO = 2 * 1024 * 1024 * 1024 // o que cabe com folga na memória do navegador
const LIMITE_ITENS = 20_000
const TAXA_SUSPEITA = 200 // descompactado / compactado

async function criar7z() {
  const [{ default: SevenZip }, { default: wasmUrl }] = await Promise.all([import('7z-wasm'), import('7z-wasm/7zz.wasm?url')])
  const linhas = []
  const modulo = await SevenZip({
    locateFile: () => wasmUrl,
    print: (t) => linhas.push(t),
    printErr: (t) => linhas.push(t),
  })
  // O 7-Zip pediria a senha pelo teclado (stdin). Sem teclado, terminaria com erro; já o -p evita a pergunta.
  modulo.linhas = linhas
  return modulo
}

function executar(modulo, args) {
  modulo.linhas.length = 0
  let codigo = 0
  try {
    codigo = modulo.callMain(args) ?? 0 // 0 ok, 1 avisos, 2 erro fatal (ex.: senha errada)
  } catch (erro) {
    codigo = typeof erro?.status === 'number' ? erro.status : 2
  }
  return { codigo, saida: modulo.linhas.join('\n') }
}

function escreverArquivo(modulo, caminho, dados) {
  const partes = caminho.split('/').filter(Boolean)
  let atual = ''
  for (const p of partes.slice(0, -1)) {
    atual += `/${p}`
    try {
      modulo.FS.mkdir(atual)
    } catch {
      /* já existe */
    }
  }
  modulo.FS.writeFile(caminho, dados)
}

/** Caminho interno seguro: sem "..", sem raiz, sem caracteres proibidos. */
export function caminhoSeguro(caminho) {
  return String(caminho)
    .replace(/\\/g, '/')
    .split('/')
    .filter((p) => p && p !== '.' && p !== '..')
    .map((p) => nomeSeguro(p, '_'))
    .join('/')
}

const erroSenha = (saida) => /Wrong password|Can not open encrypted archive|Data Error in encrypted file/i.test(saida)

/** Lê a listagem técnica (-slt) do 7-Zip. */
function lerListagem(saida) {
  const blocos = saida.split(/\r?\n\r?\n/)
  const itens = []
  let tipo = null
  for (const bloco of blocos) {
    const campos = Object.fromEntries(
      bloco
        .split(/\r?\n/)
        .map((l) => /^([A-Za-z ]+?) = (.*)$/.exec(l))
        .filter(Boolean)
        .map((m) => [m[1], m[2]]),
    )
    if (campos.Type && !campos.Size && !tipo) tipo = campos.Type
    if (campos.Path == null || campos.Size == null && campos.Folder == null) continue
    if (campos.Type && campos.Physical) {
      tipo = campos.Type
      continue
    }
    itens.push({
      caminho: campos.Path,
      tamanho: Number(campos.Size) || 0,
      compactado: Number(campos['Packed Size']) || 0,
      pasta: campos.Folder === '+' || (campos.Attributes ?? '').startsWith('D'),
      cifrado: campos.Encrypted === '+',
      modificado: campos.Modified ?? null,
    })
  }
  return { itens, tipo }
}

/**
 * Abre um compactado: { itens, tipo, total, precisaSenha }.
 * Com `senha`, valida a senha (listagem com cabeçalho cifrado exige senha).
 */
export async function listar(arquivo, senha = '') {
  const modulo = await criar7z()
  const nome = `/entrada/${nomeSeguro(arquivo.name, 'arquivo')}`
  escreverArquivo(modulo, nome, new Uint8Array(await arquivo.arrayBuffer()))
  const r = executar(modulo, ['l', '-slt', `-p${senha}`, nome])
  if (erroSenha(r.saida)) return { itens: [], precisaSenha: true, senhaErrada: Boolean(senha) }
  if (r.codigo !== 0 && /Can not open the file as archive|is not archive/i.test(r.saida)) {
    throw new ErroAmigavel('Este arquivo não é um compactado válido ou está corrompido.')
  }
  const { itens, tipo } = lerListagem(r.saida)
  const arquivos = itens.filter((i) => !i.pasta)
  // No ZIP a lista abre sem senha: confere a senha testando o menor arquivo cifrado.
  const cifrados = arquivos.filter((i) => i.cifrado).sort((a, b) => a.tamanho - b.tamanho)
  if (senha && cifrados.length) {
    const teste = executar(modulo, ['t', `-p${senha}`, nome, cifrados[0].caminho])
    if (erroSenha(teste.saida) || teste.codigo >= 2) return { itens: [], precisaSenha: true, senhaErrada: true }
  }
  return {
    itens: arquivos,
    tipo,
    total: arquivos.reduce((s, i) => s + i.tamanho, 0),
    precisaSenha: arquivos.some((i) => i.cifrado) && !senha,
    modulo,
    nome,
  }
}

/** Recusa bombas de descompactação antes de extrair. */
export function conferirSeguranca(listagem, tamanhoCompactado) {
  if (listagem.itens.length > LIMITE_ITENS) throw new ErroAmigavel(`O compactado tem ${listagem.itens.length.toLocaleString('pt-BR')} arquivos — mais do que o navegador aguenta (máximo de ${LIMITE_ITENS.toLocaleString('pt-BR')}).`)
  if (listagem.total > LIMITE_DESCOMPACTADO) {
    throw new ErroAmigavel(`Descompactado, ele teria ${formatarBytes(listagem.total)} — acima do limite seguro de ${formatarBytes(LIMITE_DESCOMPACTADO)} no navegador.`)
  }
  if (listagem.total > 50 * 1024 * 1024 && listagem.total / Math.max(1, tamanhoCompactado) > TAXA_SUSPEITA) {
    throw new ErroAmigavel(`Este arquivo se expande ${Math.round(listagem.total / tamanhoCompactado).toLocaleString('pt-BR')} vezes ao descompactar. Isso é típico de uma “bomba de descompactação” e foi bloqueado por segurança.`)
  }
}

function lerPasta(modulo, raiz) {
  const saida = []
  const andar = (dir, prefixo) => {
    for (const nome of modulo.FS.readdir(dir)) {
      if (nome === '.' || nome === '..') continue
      const caminho = `${dir}/${nome}`
      const st = modulo.FS.stat(caminho)
      if (modulo.FS.isDir(st.mode)) andar(caminho, `${prefixo}${nome}/`)
      else saida.push({ caminho: `${prefixo}${nome}`, dados: modulo.FS.readFile(caminho) })
    }
  }
  andar(raiz, '')
  return saida
}

/**
 * Extrai (tudo ou só `selecionados`, caminhos internos). Devolve
 * [{ caminho (seguro), blob }].
 */
export async function extrair(listagem, { senha = '', selecionados } = {}) {
  const { modulo, nome } = listagem
  const args = ['x', nome, '-o/saida', `-p${senha}`, '-y', '-snl-'] // -snl-: não criar links simbólicos
  if (selecionados?.length) args.push(...selecionados)
  const r = executar(modulo, args)
  if (erroSenha(r.saida)) throw new ErroAmigavel(senha ? 'Senha incorreta.' : 'Este arquivo é protegido por senha.', 'senha')
  if (r.codigo >= 2) throw new ErroAmigavel('Não foi possível extrair: o arquivo pode estar corrompido ou incompleto.')
  let extraidos
  try {
    extraidos = lerPasta(modulo, '/saida')
  } catch {
    extraidos = []
  }
  return extraidos.map((e) => ({ caminho: caminhoSeguro(e.caminho), blob: new Blob([e.dados]) }))
}

export const FORMATOS_CRIACAO = {
  zip: { rotulo: 'ZIP', ext: 'zip', tipo: 'zip', senha: true, dica: 'Abre em qualquer computador e celular, sem instalar nada.' },
  '7z': { rotulo: '7Z', ext: '7z', tipo: '7z', senha: true, dica: 'Compressão bem maior que o ZIP. Precisa do 7-Zip (ou similar) para abrir.' },
  'tar.gz': { rotulo: 'TAR.GZ', ext: 'tar.gz', tipo: 'tar', senha: false, dica: 'Padrão em Linux e servidores. Mantém a estrutura de pastas.' },
  tar: { rotulo: 'TAR', ext: 'tar', tipo: 'tar', senha: false, dica: 'Só empacota, sem comprimir.' },
}

/**
 * Cria um compactado. `arquivos`: [{ caminho, dados: Blob | Uint8Array }].
 * nivel: 0 (só guardar) a 9 (máximo). Com senha: ZIP usa AES-256; 7Z também
 * cifra os nomes dos arquivos.
 */
export async function criar(arquivos, { formato = 'zip', nivel = 5, senha = '' }, aoProgredir) {
  const modulo = await criar7z()
  for (let i = 0; i < arquivos.length; i += 1) {
    const a = arquivos[i]
    const dados = a.dados instanceof Uint8Array ? a.dados : new Uint8Array(await a.dados.arrayBuffer())
    escreverArquivo(modulo, `/entrada/${caminhoSeguro(a.caminho) || `arquivo-${i + 1}`}`, dados)
    aoProgredir?.((i + 1) / arquivos.length * 0.4, 'Preparando os arquivos')
  }
  const f = FORMATOS_CRIACAO[formato]
  modulo.FS.chdir('/entrada')
  const alvo = formato === 'tar.gz' ? '/saida.tar' : `/saida.${f.ext}`
  const args = ['a', alvo, '*', `-t${f.tipo}`, '-r']
  if (f.tipo !== 'tar') args.push(`-mx=${nivel}`)
  if (senha && f.senha) {
    args.push(`-p${senha}`)
    if (formato === 'zip') args.push('-mem=AES256')
    if (formato === '7z') args.push('-mhe=on')
  }
  aoProgredir?.(null, 'Compactando')
  let r = executar(modulo, args)
  if (r.codigo >= 2) throw new ErroAmigavel('Não foi possível criar o arquivo compactado.', r.saida)
  let saida = modulo.FS.readFile(alvo)
  if (formato === 'tar.gz') {
    modulo.FS.chdir('/')
    r = executar(modulo, ['a', '/saida.tar.gz', '/saida.tar', '-tgzip', `-mx=${nivel}`])
    if (r.codigo >= 2) throw new ErroAmigavel('Não foi possível comprimir o TAR.', r.saida)
    saida = modulo.FS.readFile('/saida.tar.gz')
  }
  return new Blob([saida], { type: formato === 'zip' ? 'application/zip' : formato === '7z' ? 'application/x-7z-compressed' : formato === 'tar' ? 'application/x-tar' : 'application/gzip' })
}
