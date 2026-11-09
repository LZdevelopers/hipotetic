# Ensaio da função de documentos num ambiente igual ao das funções da Vercel:
# Amazon Linux 2023 mínimo com Node 24 (imagem do AWS Lambda), SEM LibreOffice
# instalado — só o pacote lo.tar.br, como na Vercel.
#
# docker build -f servicos/libreoffice/teste.Dockerfile -t hipotetic-lo-teste .
# docker run --rm -p 8090:8090 --tmpfs /tmp:size=512m,exec hipotetic-lo-teste
FROM public.ecr.aws/lambda/nodejs:24
WORKDIR /var/task
RUN npm init -y >/dev/null && npm install tar@7 >/dev/null
COPY api/_lib/libreoffice.js api/_lib/libreoffice.js
COPY api/documentos/converter.js api/documentos/converter.js
COPY servicos/libreoffice/saida/lo.tar.br servicos/libreoffice/saida/lo.tar.br
COPY servicos/libreoffice/servidor-teste.mjs servidor-teste.mjs
RUN echo '{"type":"module"}' > api/package.json
ENTRYPOINT []
CMD ["node", "servidor-teste.mjs"]
