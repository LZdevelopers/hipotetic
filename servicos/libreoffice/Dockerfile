# Empacota o LibreOffice para rodar DENTRO de uma função Node da Vercel
# (sem contêiner, sem custo de registro de imagens).
#
# Resultado: lo.tar.br (~100 MB) com o LibreOffice 26.2 compilado para
# Amazon Linux 2023 (o sistema das funções), as bibliotecas de sistema que ele
# usa e fontes compatíveis com as do Office. A função descompacta em /tmp na
# primeira execução (api/_lib/libreoffice.js).
#
# Uso: npm run empacotar:libreoffice   (precisa do Docker)

# Fontes métrico-compatíveis com as do Office: Liberation (Arial, Times New
# Roman, Courier New), Carlito (Calibri), Caladea (Cambria) e DejaVu.
FROM debian:bookworm-slim AS fontes
RUN apt-get update && apt-get install -y --no-install-recommends \
      fonts-liberation2 fonts-crosextra-carlito fonts-crosextra-caladea fonts-dejavu-core \
 && mkdir -p /fontes \
 && find /usr/share/fonts -type f \( -name '*.ttf' -o -name '*.otf' \) -exec cp {} /fontes/ \;

# LibreOffice já compilado para Amazon Linux 2023 (projeto shelfio, usado em AWS Lambda).
FROM public.ecr.aws/shelf/lambda-libreoffice-base:26.2-node22-x86_64 AS empacotar
COPY --from=fontes /fontes /fontes
COPY empacotar.sh /empacotar.sh
RUN dnf install -y tar findutils >/dev/null 2>&1 || true
ENTRYPOINT []
RUN sh /empacotar.sh

FROM scratch AS saida
COPY --from=empacotar /saida/lo.tar.br /lo.tar.br
COPY --from=empacotar /saida/lo.sha256 /lo.sha256
