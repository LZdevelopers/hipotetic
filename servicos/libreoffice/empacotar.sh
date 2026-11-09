#!/bin/sh
# Monta /saida/lo (LibreOffice enxuto + bibliotecas + fontes) e compacta em
# /saida/lo.tar.br. Roda dentro do Dockerfile ao lado.
set -eu

ORIGEM=/opt/libreoffice26.2
LO=/saida/lo
mkdir -p "$LO"
cp -a "$ORIGEM/." "$LO/"

# ─── Enxugar: nada disso é usado numa conversão sem interface ──────────────
rm -rf "$LO/help" "$LO/readmes" "$LO/share/gallery" "$LO/share/template" "$LO/share/wizards" \
       "$LO/share/extensions" "$LO/share/autotext" "$LO/share/basic" "$LO/share/Scripts" \
       "$LO/program/wizards" "$LO/sdk" 2>/dev/null || true
# Ícones: só o tema padrão (o resto é peso morto sem interface).
find "$LO/share/config" -name 'images_*.zip' ! -name 'images_colibre.zip' -delete 2>/dev/null || true
# Python e o que só a interface usa.
rm -rf "$LO/program/python"* "$LO/program/libpython"* "$LO/program/pythonloader"* "$LO/program/pyuno"* 2>/dev/null || true
# Plugins de interface (Qt/GTK/KDE): sem tela, o LibreOffice usa o "svp"
# embutido. Removidos ANTES de coletar dependências, senão as bibliotecas Qt
# e GTK inteiras viriam junto.
rm -f "$LO/program/libvclplug_"* 2>/dev/null || true
# Bancos de dados (Base), LDAP, Firebird e filtros de formatos raros da Apple.
rm -f "$LO/program/"*postgresql* "$LO/program/"*mysql* "$LO/program/libEngine12.so" "$LO/program/libfbclient"* \
      "$LO/program/libldapbe2lo.so" "$LO/program/libetonyek"* "$LO/program/libfirebird_sdbc"* 2>/dev/null || true
rm -rf "$LO/program/firebird" 2>/dev/null || true
# Fontes embutidas do LibreOffice: usamos as nossas (abaixo), métrico-compatíveis com o Office.
rm -rf "$LO/share/fonts" 2>/dev/null || true

# ─── Bibliotecas de sistema que o LibreOffice usa (fora do glibc) ──────────
# O ambiente das funções é um Amazon Linux mínimo: levamos junto tudo o que o
# ldd encontra fora de /opt e que não é do próprio glibc.
mkdir -p "$LO/lib"
# Módulos do NSS que só são carregados em tempo de execução (dlopen), por isso
# o ldd não os acha. Sem eles a exportação para PDF falha ("Io Write Code 16").
cp -L /usr/lib64/libsoftokn3.* /usr/lib64/libfreebl3.* /usr/lib64/libfreeblpriv3.* /usr/lib64/libnssckbi.so "$LO/lib/" 2>/dev/null || true
find "$LO/program" "$LO/lib" -type f \( -name '*.so*' -o -name 'soffice.bin' -o -name 'oosplash' \) | while read -r arq; do
  ldd "$arq" 2>/dev/null | awk '/=> \// { print $3 }'
done | sort -u | while read -r lib; do
  case "$(basename "$lib")" in
    libc.so*|libm.so*|libdl.so*|libpthread.so*|librt.so*|ld-linux*|libresolv.so*|libutil.so*) continue ;;
  esac
  case "$lib" in "$LO"/*) continue ;; esac
  cp -L "$lib" "$LO/lib/" 2>/dev/null || true
done

# ─── Fontes + configuração do fontconfig apontando para /tmp/lo ─────────────
mkdir -p "$LO/fontes"
cp /fontes/* "$LO/fontes/"
# Noto variável (latim, grego, cirílico) da imagem: cobre acentos raros.
find /usr/share/fonts/google-noto-vf -name 'NotoSans*' -exec cp {} "$LO/fontes/" \; 2>/dev/null || true
cat > "$LO/fonts.conf" <<'XML'
<?xml version="1.0"?>
<!DOCTYPE fontconfig SYSTEM "fonts.dtd">
<fontconfig>
  <dir>/tmp/lo/fontes</dir>
  <cachedir>/tmp/lo-fontcache</cachedir>
  <config></config>
</fontconfig>
XML

echo "Tamanho descompactado: $(du -sh "$LO" | cut -f1) (bibliotecas: $(du -sh "$LO/lib" | cut -f1), program: $(du -sh "$LO/program" | cut -f1), fontes: $(du -sh "$LO/fontes" | cut -f1))"

# ─── Compactar (tar + Brotli, que o Node descompacta nativamente) ───────────
cd /saida
tar -cf lo.tar lo
node -e "
const fs = require('fs'); const zlib = require('zlib');
const entrada = fs.readFileSync('lo.tar');
const saida = zlib.brotliCompressSync(entrada, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 9, [zlib.constants.BROTLI_PARAM_LGWIN]: 24, [zlib.constants.BROTLI_PARAM_SIZE_HINT]: entrada.length } });
fs.writeFileSync('lo.tar.br', saida);
console.log('lo.tar.br:', (saida.length / 1048576).toFixed(1), 'MB');
"
sha256sum lo.tar.br | cut -d' ' -f1 > lo.sha256
rm -rf lo.tar lo
