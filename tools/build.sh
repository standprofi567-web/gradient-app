#!/bin/bash
# Сборка сайта: копирует общий код из расширения и проставляет версию (чтобы телефоны брали свежие файлы).
set -e
cd "$(dirname "$0")/.."
# Папка расширения: по умолчанию лежит рядом с сайтом (../pomogator)
SRC=${SRC:-$(cd ../pomogator && pwd)}
mkdir -p shared fonts
rm -f shared/health.js shared/figures.js
for f in config calc homework charts season engine gfx ui pass devices profile bridge ownhw report net cloud game; do cp "$SRC/src/$f.js" shared/; done
cp "$SRC/ui.css" "$SRC/pass.css" shared/
cp "$SRC"/fonts/*.woff2 fonts/
# 3D-иконки игры (Microsoft Fluent Emoji, MIT) — вместе с лицензией
mkdir -p img/3d && cp "$SRC"/img/3d/* img/3d/
VER=$(date -u +%Y%m%d%H%M)
sed "s/__VER__/$VER/g" tools/index.template.html > index.html
sed "s/__VER__/$VER/g" tools/sw.template.js > sw.js
echo "built $VER"
