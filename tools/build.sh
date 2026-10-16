#!/bin/bash
# Сборка сайта: копирует общий код из расширения и проставляет версию (чтобы телефоны брали свежие файлы).
set -e
SRC=${SRC:-/home/claude/pomogator}
cd "$(dirname "$0")/.."
mkdir -p shared fonts
for f in config calc homework charts season engine gfx figures ui pass health ownhw report net cloud game; do cp "$SRC/src/$f.js" shared/; done
cp "$SRC/ui.css" "$SRC/pass.css" shared/
cp "$SRC"/fonts/*.woff2 fonts/
VER=$(date -u +%Y%m%d%H%M)
sed "s/__VER__/$VER/g" tools/index.template.html > index.html
sed "s/__VER__/$VER/g" tools/sw.template.js > sw.js
echo "built $VER"
