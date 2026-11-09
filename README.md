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
o índice da página inicial, SEO, sitemap e pré-renderização saem dele. **Uma
ferramenta só entra no catálogo quando funciona** — não existe “em breve”.
Não há páginas de categoria: as categorias são âncoras do índice (`/#audio`…).
As ferramentas não têm "Como usar" — precisam se explicar sozinhas. Nos
editores, com um arquivo aberto, a página mostra só o editor (`useEmEdicao`).

**Conversão é uma página só** (`/converter`, como no Convertio): a pessoa solta
qualquer arquivo, o tipo real é reconhecido pelos bytes e cada arquivo mostra
só os formatos para os quais pode virar (`src/motores/conversor.js`). As demais
ferramentas são poucas páginas que fazem muito: um editor por tipo, com as
operações em abas ou opções.

| Conversor | De → para | Motor |
|---|---|---|
| Imagem | JPG, PNG, WebP, AVIF, GIF, BMP, SVG, ICO → JPG, PNG, WebP, AVIF, PDF (GIF → MP4/WebM) | Workers + jSquash, pdf-lib |
| Vídeo | MP4, MOV, MKV, WebM, AVI… → MP4, WebM, MOV, MKV, GIF, MP3, M4A, WAV, FLAC, OGG, OPUS | Mediabunny + ffmpeg.wasm |
| Áudio | MP3, WAV, M4A, AAC, FLAC, OGG, OPUS… → os mesmos | ffmpeg.wasm |
| PDF | → JPG, PNG, WebP (uma imagem por página; várias em ZIP), TXT | pdf.js |
| Documentos | DOCX, DOC, ODT, RTF, HTML, TXT, Markdown → PDF, DOCX, ODT, RTF, TXT, HTML | LibreOffice no servidor; Markdown→HTML e texto no navegador |
| Compactados | ZIP, RAR, 7Z, TAR, GZ… → ZIP, 7Z, TAR, TAR.GZ | 7-Zip em WebAssembly |

| Demais ferramentas | Páginas | Motor |
|---|---|---|
| Vídeo | baixar (YouTube/TikTok) · comprimir · editor (trecho, proporção, girar, resolução, velocidade, som: silenciar, trocar ou misturar música) · juntar e dividir | Mediabunny (WebCodecs) + ffmpeg.wasm |
| Áudio | editor (player próprio, prévia ao vivo, velocidade livre, desfazer) · gravador de voz · limpar e melhorar voz (ruído, zumbido, clareza, volume padrão; também em vídeo) · juntar e dividir (inclusive nas pausas) · tags e capa | Web Audio + MediaRecorder + ffmpeg.wasm |
| Imagens | comprimir · editor (recortar, girar, tamanho/redes sociais, cores e filtros, formato) · metadados (ver EXIF/GPS e remover sem recomprimir) · favicon · miniatura · paleta de cores | Web Workers + OffscreenCanvas + jSquash |
| PDF | unir · dividir · organizar · editar e assinar · comprimir · OCR · numerar e marca d’água · senha (colocar/remover) · comparar · metadados | pdf-lib, pdf.js, qpdf-wasm, tesseract.js |
| Documentos | visualizar DOCX · texto e contagem · metadados · Markdown→HTML/PDF | navegador + função LibreOffice |
| Compactados | compactar (ZIP/7Z/TAR/TAR.GZ, senha AES-256) · extrair (ZIP/RAR/7Z/TAR/GZ…) | 7-Zip em WebAssembly |
| Utilitários | QR Code · hash · identificar arquivo · comparar arquivos · calculadoras (unidades, download) · editor de texto · Base64 | navegador |

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
api/documentos/converter.js     conversão de documentos (LibreOffice dentro da função)
servicos/libreoffice/           gera o pacote do LibreOffice para a função (Docker)
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

## Conversão de documentos (LibreOffice)

Converter DOCX/ODT/DOC/RTF com fidelidade exige um processador de texto
completo. Para não pagar contêiner, o LibreOffice roda **dentro de uma função
comum da Vercel** (`api/documentos/converter.js`, gratuita no plano Hobby):

1. `npm run empacotar:libreoffice` (precisa do Docker) monta um LibreOffice
   enxuto — sem interface, ajuda, Python, bancos de dados — com as bibliotecas
   de sistema e fontes métrico-compatíveis com as do Office (Liberation,
   Carlito, Caladea), e gera `servicos/libreoffice/saida/lo.tar.br`
   (~430 MB aberto, Brotli). Esse arquivo não vai para o Git.
2. A função leva o pacote (`includeFiles` no `vercel.json`) e, na primeira
   chamada de cada instância, o descompacta em `/tmp/lo` (alguns segundos);
   as chamadas seguintes reaproveitam. A página “acorda” a função ao abrir.
3. Cada conversão usa uma pasta temporária exclusiva, apagada na hora. Limites:
   4,5 MB por arquivo (corpo das funções), 100 s por conversão, uma por vez por
   instância, 20 por IP a cada 10 min; macros e links externos desativados;
   tipo validado pelo conteúdo.

O build ativa as ferramentas de documentos sozinho quando o pacote existe
(ou com `VITE_DOCUMENTOS=1`). Testando localmente num ambiente igual ao da
Vercel (Amazon Linux + Node 24, sem LibreOffice instalado):

```bash
npm run empacotar:libreoffice
docker build -f servicos/libreoffice/teste.Dockerfile -t hipotetic-lo-teste .
docker run --rm -p 8090:8090 --tmpfs /tmp:size=512m,exec hipotetic-lo-teste
npm run build
DOCUMENTOS_URL=http://localhost:8090 SO=documentos npm run test:ferramentas
```

## Variáveis de ambiente

| Nome | Para quê |
|---|---|
| `VITE_DOCUMENTOS` | `1` força as ferramentas de conversão de documentos (o build já ativa sozinho se o pacote existir). |
| `DOCUMENTOS_URL` | em desenvolvimento, repassa `/api/documentos` para outro servidor (ex.: o contêiner de teste). |
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
