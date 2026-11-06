# hipotetic (nome provisório)

Plataforma da LZdev de ferramentas de arquivo: vídeo, áudio, imagens, PDF,
documentos, arquivos compactados e utilitários — mais o download de vídeos do
YouTube e do TikTok. Gratuita, sem anúncios, sem cadastro.

**Princípio:** quase tudo roda **no navegador do usuário** (WebAssembly e a
aceleração de vídeo do navegador). O arquivo não sai do aparelho, não há custo
de servidor e não há limite de 4,5 MB. Só duas coisas usam servidor, e a
página avisa: o download por link e a conversão de documentos (LibreOffice).

## Ferramentas

O catálogo (`src/ferramentas/catalogo.js`) é a fonte única: navegação, busca,
páginas de categoria, SEO, sitemap e pré-renderização saem dele. **Uma
ferramenta só entra no catálogo quando funciona** — não existe “em breve”.

| Categoria | Ferramentas | Motor |
|---|---|---|
| Vídeo | baixar do YouTube/TikTok, converter (+ MP4↔WebM, MOV/MKV/AVI→MP4), comprimir (por nível ou em MB), editor (trecho, proporção, girar, resolução, velocidade, silenciar), vídeo→GIF, GIF→MP4, juntar, dividir, adicionar música | Mediabunny (WebCodecs) + ffmpeg.wasm |
| Áudio | converter (MP3, M4A, AAC, OGG, OPUS, WAV, FLAC), extrair de vídeo, cortar com forma de onda, juntar, volume/normalizar, remover silêncio, velocidade | ffmpeg.wasm |
| Imagens | converter (+ PNG↔JPG, PNG↔WebP, JPG↔WebP, SVG→PNG), comprimir, redimensionar, recortar, girar, ajustes e filtros, remover metadados (sem recomprimir), informações/EXIF, favicon, tamanhos para redes, miniatura, paleta de cores, Base64 | Web Workers + OffscreenCanvas + jSquash (MozJPEG, WebP, AVIF, OxiPNG) |
| PDF | unir, dividir, extrair/excluir/girar/organizar páginas, editar e assinar, comprimir, PDF→JPG/PNG, imagens→PDF, extrair texto, OCR, numerar, marca d’água, proteger/desbloquear, comparar, metadados | pdf-lib, pdf.js, qpdf-wasm, tesseract.js |
| Documentos | visualizar DOCX, extrair texto, contar palavras, metadados DOCX/ODT, Markdown→HTML/PDF; **com o serviço LibreOffice**: converter DOCX/DOC/ODT/RTF/HTML ↔ PDF/DOCX/ODT | navegador + contêiner LibreOffice |
| Compactados | criar ZIP/7Z/TAR/TAR.GZ (senha AES-256, pastas), extrair ZIP/RAR/7Z/TAR/GZ…, converter (RAR→ZIP…) | 7-Zip em WebAssembly |
| Utilitários | QR Code, hashes (MD5…SHA-512, CRC32), identificar arquivo, comparar arquivos, unidades, calculadora de download, visualizar/criar texto | navegador |

## Stack e estrutura

React 19 · Vite 7 · Tailwind CSS v4 · funções Node da Vercel em `api/`.
Roteamento próprio (History API) e **pré-renderização no build**: cada
ferramenta é um HTML estático com título, descrição, canonical, Open Graph e
JSON-LD (`dev/prerenderizar.mjs`), hidratado no navegador.

```
src/
  ferramentas/catalogo.js       categorias e ferramentas (textos, SEO, ícones)
  ferramentas/<categoria>/*.jsx  uma ferramenta por arquivo (chunk próprio)
  componentes/ferramenta/       modelo padrão: seletor, configurações, progresso, resultados
  motores/                      ffmpeg, mídia (Mediabunny), imagem (workers), pdf, ocr, compactados, documentos
  nucleo/                       roteador, rotas/metadados, arquivos, tarefa, preferências
  textos.js                     textos globais (pt-BR, pronto para tradução)
api/                            download por link (YouTube/TikTok) e miniatura
servicos/documentos/            contêiner LibreOffice (Dockerfile.vercel + servidor.mjs)
dev/                            pré-renderização e testes em navegador real
```

## Comandos

```bash
npm install
npm run dev                # site + funções /api em http://localhost:5173
npm run build              # build de produção (dist/ com páginas pré-renderizadas)
npm run preview            # serve o build como a Vercel (URLs limpas, CSP)
npm test                   # testes da API (sem rede)
npm run test:paginas       # todas as páginas em Chrome real: erros, CSP, layout no celular
npm run test:ferramentas   # cada ferramenta processa arquivos reais e o resultado é conferido
```

Testando também a conversão de documentos (precisa do Docker):

```bash
docker build -f servicos/documentos/Dockerfile.vercel -t hipotetic-documentos servicos/documentos
docker run -d -p 8090:80 hipotetic-documentos
VITE_DOCUMENTOS=1 npm run build
DOCUMENTOS_URL=http://localhost:8090 npm run test:ferramentas
```

## Serviço de documentos (LibreOffice)

Converter DOCX/ODT/DOC/RTF com fidelidade exige um processador de texto
completo. `servicos/documentos/` é um contêiner (Node 24 + LibreOffice Writer +
fontes compatíveis com as do Office) que recebe o arquivo, converte e **apaga na
hora**. Limites: 4,5 MB por arquivo (limite de corpo das funções), 100 s por
conversão, uma por vez por instância, 20 por IP a cada 10 min; macros e links
externos desativados; tipo validado pelo conteúdo.

As ferramentas que dependem dele têm `requer: 'documentos'` no catálogo e **só
aparecem no build com `VITE_DOCUMENTOS=1`**. Para ativar na Vercel é preciso
publicar o contêiner como *service* — veja `servicos/vercel.servicos.json`
(proposta do `vercel.json` com Services). Custo: o registro de imagens da
Vercel cobra armazenamento (US$ 0,10/GB/mês; a imagem tem ~0,9 GB).

## Variáveis de ambiente

| Nome | Para quê |
|---|---|
| `VITE_DOCUMENTOS` | `1` publica as ferramentas de conversão de documentos (exige o serviço). |
| `YOUTUBE_DOWNLOAD` | `off` desliga o download do YouTube. |
| `YOUTUBE_MAX_MINUTOS` | duração máxima para download do YouTube (padrão 120). |
| `TIKTOK_DOWNLOAD` | `off` desliga o download do TikTok. |

## Segurança e privacidade

- Arquivos processados no navegador nunca saem do aparelho.
- Validação do **tipo real** pelos bytes em todo envio; limites de tamanho por
  ferramenta; nomes de arquivo sanitizados.
- Compactados: proteção contra bombas de descompactação (tamanho total e taxa),
  caminhos sem `..`, sem links simbólicos, limite de itens.
- PDF: desbloqueio só com a senha; restrições só com a senha do dono.
- CSP rígida em `vercel.json`; bibliotecas pesadas (pdf.js, OCR) servidas pelo
  próprio site. Do jsDelivr vêm só o núcleo do ffmpeg e os modelos de idioma
  do OCR — nenhum arquivo do usuário.
- `api/miniatura.js` só busca hosts de capa conhecidos (sem SSRF); o download
  por link valida a URL e recusa hosts internos.

## Limitações conhecidas

- **YouTube bloqueia IPs de datacenter**: na Vercel o download do YouTube falha
  (“confirme que não é um robô”). Informações e player funcionam. Ver o
  histórico de decisões; o TikTok funciona.
- Vídeo em WebAssembly (AVI, GIF, velocidade, juntar) é mais lento que pela
  aceleração do navegador; o limite prático é a memória (≈2 GB).
- Textos em PDF usam a Helvetica padrão: letras com acento funcionam; emojis e
  outros alfabetos não.
- RAR só se extrai (formato proprietário).
- Plano Hobby da Vercel é para uso pessoal e não comercial.
