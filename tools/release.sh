#!/bin/bash
# Выпуск новой версии Gradely одной командой:
#   bash tools/release.sh 3.8.1            — собрать всё и отправить сайт на GitHub
#   bash tools/release.sh 3.8.1 --no-push  — только собрать и закоммитить (без отправки)
#
# Что делает: ставит версию в расширение, собирает zip для друзей, собирает сайт,
# коммитит оба проекта и отправляет сайт на GitHub под аккаунтом standprofi567-web.
# После — напиши Claude «выпустил 3.8.1»: он пропишет версию на сервере, и друзьям придёт обновление.
set -euo pipefail

VER="${1:-}"
PUSH=1
[ "${2:-}" = "--no-push" ] && PUSH=0
if ! [[ "$VER" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "Укажи версию, например: bash tools/release.sh 3.8.1"; exit 1
fi

SITE="$(cd "$(dirname "$0")/.." && pwd)"
EXT="$(cd "$SITE/../pomogator" && pwd)"
BOT=(-c user.name="Gradely Bot" -c user.email="standprofi567-web@users.noreply.github.com")

echo "1/5  Версия $VER в расширении"
python3 -I - "$EXT/manifest.json" "$VER" <<'PY'
import json, sys
p, ver = sys.argv[1], sys.argv[2]
s = open(p, encoding='utf-8').read()
old = json.loads(s)['version']
s = s.replace('"version": "' + old + '"', '"version": "' + ver + '"', 1)
json.loads(s)
open(p, 'w', encoding='utf-8').write(s)
PY

echo "2/5  Архив расширения ext/gradely-$VER.zip"
mkdir -p "$SITE/ext"
rm -f "$SITE"/ext/gradient-*.zip "$SITE"/ext/gradely-*.zip
(cd "$EXT" && zip -qr -X "$SITE/ext/gradely-$VER.zip" . -x '.git/*' -x '.gitignore' -x '*.DS_Store')

echo "3/5  Сборка сайта"
SRC="$EXT" bash "$SITE/tools/build.sh"

echo "4/5  Коммиты"
git -C "$EXT" add -A
git -C "$EXT" "${BOT[@]}" commit -qm "Gradely $VER" || echo "     (в расширении нечего коммитить)"
git -C "$SITE" add -A
git -C "$SITE" "${BOT[@]}" commit -qm "Gradely $VER" || echo "     (на сайте нечего коммитить)"

if [ "$PUSH" = 0 ]; then
  echo "Готово без отправки. Чтобы выложить: bash tools/release.sh $VER"; exit 0
fi

echo "5/5  Отправка на GitHub (аккаунт standprofi567-web)"
echo "     Нужен токен GitHub: Settings → Developer settings → Tokens (classic), галочка repo."
echo "     Токен не покажется на экране и нигде не сохранится. После выпуска его можно удалить."
read -rsp "     Токен: " GH_TOKEN; echo
[ -n "$GH_TOKEN" ] || { echo "Токен пустой — отменяю отправку."; exit 1; }

# Токен отдаём git через временный помощник, а не в адресе: так он не попадёт в историю терминала.
# credential.helper= отключает связку ключей macOS — там сохранён основной аккаунт, он дал бы ошибку 403.
ASK="$(mktemp)"; trap 'rm -f "$ASK"' EXIT
printf '#!/bin/sh\ncase "$1" in *sername*) echo standprofi567-web ;; *) printf "%%s\\n" "$GH_TOKEN" ;; esac\n' > "$ASK"
chmod 700 "$ASK"
GH_TOKEN="$GH_TOKEN" GIT_ASKPASS="$ASK" GIT_TERMINAL_PROMPT=0 \
  git -C "$SITE" -c credential.helper= push https://github.com/standprofi567-web/gradient-app.git main

echo
echo "Готово ✓  Gradely $VER на GitHub, сайт обновится за пару минут."
echo "Теперь напиши Claude: «выпустил $VER» — он пропишет версию, и друзьям придёт обновление."
