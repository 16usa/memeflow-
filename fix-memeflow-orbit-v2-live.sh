#!/usr/bin/env bash
set -euo pipefail

APP="/home/runner/workspace/memeflow-app"

echo "=== MEMEFLOW ORBIT V2 LIVE FIX ==="

# ------------------------------------------------------------
# 1. Найти НАСТОЯЩУЮ страницу, полностью исключив backups.
# ------------------------------------------------------------

LIVE=""

# Самый вероятный production-файл.
if [ -f "$APP/system.html" ]; then
  if grep -qiE 'REAL-TIME ARCHITECTURE|Live MEMEFLOW pipeline|LIVE INSPECTOR|Reset view' "$APP/system.html"; then
    LIVE="$APP/system.html"
  fi
fi

# Если структура другая — ищем, но НЕ в backups/patches/node_modules.
if [ -z "$LIVE" ]; then
  while IFS= read -r f; do
    if grep -qiE 'REAL-TIME ARCHITECTURE|Live MEMEFLOW pipeline|LIVE INSPECTOR|Reset view' "$f"; then
      LIVE="$f"
      break
    fi
  done < <(
    find "$APP" \
      -type f \
      -name '*.html' \
      ! -path '*/.patch-backups/*' \
      ! -path '*/patch-backups/*' \
      ! -path '*/backups/*' \
      ! -path '*/backup/*' \
      ! -path '*/node_modules/*' \
      ! -path '*/.git/*' \
      ! -name '*.bak' \
      ! -name '*.bak.*' \
      | sort
  )
fi

if [ -z "$LIVE" ]; then
  echo
  echo "ERROR: Production Live Architecture page not found."
  echo
  echo "Possible production HTML files:"
  find "$APP" \
    -type f \
    -name '*.html' \
    ! -path '*/.patch-backups/*' \
    ! -path '*/node_modules/*' \
    ! -path '*/.git/*' \
    | sort
  echo
  echo "NOTHING CHANGED."
  exit 2
fi

echo "LIVE PAGE:"
echo "$LIVE"
echo

# Критическая защита.
case "$LIVE" in
  *".patch-backups"*|*"/backups/"*|*"/backup/"*)
    echo "SAFETY ERROR: selected file is a backup."
    exit 3
    ;;
esac

# ------------------------------------------------------------
# 2. Найти уже созданные Orbit V2 assets.
# ------------------------------------------------------------

OLD_CSS="$(find "$APP/.patch-backups" -type f -name 'memeflow-orbit-v2.css' 2>/dev/null | tail -n 1 || true)"
OLD_JS="$(find "$APP/.patch-backups" -type f -name 'memeflow-orbit-v2.js' 2>/dev/null | tail -n 1 || true)"

if [ -z "$OLD_CSS" ] || [ -z "$OLD_JS" ]; then
  echo "ERROR: Previous Orbit V2 files were not found."
  echo "Nothing changed."
  exit 4
fi

echo "SOURCE CSS: $OLD_CSS"
echo "SOURCE JS:  $OLD_JS"

# ------------------------------------------------------------
# 3. Сделать backup РЕАЛЬНОЙ production-страницы.
# ------------------------------------------------------------

STAMP="$(date +%Y%m%d-%H%M%S)"
LIVE_BACKUP="${LIVE}.before-orbit-v2-live.${STAMP}.bak"

cp "$LIVE" "$LIVE_BACKUP"

echo
echo "Production backup:"
echo "$LIVE_BACKUP"

# ------------------------------------------------------------
# 4. Положить assets в настоящий web root.
# app-server.mjs обслуживает файлы из memeflow-app.
# ------------------------------------------------------------

cp "$OLD_CSS" "$APP/memeflow-orbit-v2.css"
cp "$OLD_JS"  "$APP/memeflow-orbit-v2.js"

# ------------------------------------------------------------
# 5. Подключить их к production system page.
# Используем ROOT paths, чтобы не зависеть от URL страницы.
# ------------------------------------------------------------

python3 - "$LIVE" <<'PY'
from pathlib import Path
import sys
import re

p = Path(sys.argv[1])
s = p.read_text(encoding="utf-8")

# Убираем возможные старые/неправильные подключения Orbit.
s = re.sub(
    r'\s*<link[^>]+memeflow-orbit-v2\.css[^>]*>\s*',
    '\n',
    s,
    flags=re.I
)

s = re.sub(
    r'\s*<script[^>]+memeflow-orbit-v2\.js[^>]*>\s*</script>\s*',
    '\n',
    s,
    flags=re.I
)

css = '<link rel="stylesheet" href="/memeflow-orbit-v2.css?v=2.1">'
js  = '<script src="/memeflow-orbit-v2.js?v=2.1" defer></script>'

low = s.lower()

head_pos = low.rfind("</head>")
if head_pos < 0:
    raise SystemExit("ERROR: </head> not found in production page")

s = s[:head_pos] + css + "\n" + s[head_pos:]

low = s.lower()
body_pos = low.rfind("</body>")
if body_pos < 0:
    raise SystemExit("ERROR: </body> not found in production page")

s = s[:body_pos] + js + "\n" + s[body_pos:]

p.write_text(s, encoding="utf-8")
PY

# ------------------------------------------------------------
# 6. Проверка.
# ------------------------------------------------------------

echo
echo "=== VERIFY ==="

grep -n "memeflow-orbit-v2" "$LIVE" || {
  echo "ERROR: Orbit references missing from production page."
  cp "$LIVE_BACKUP" "$LIVE"
  exit 5
}

test -s "$APP/memeflow-orbit-v2.css"
test -s "$APP/memeflow-orbit-v2.js"

echo
echo "=============================================="
echo " MEMEFLOW ORBIT V2 -> PRODUCTION INSTALLED"
echo "=============================================="
echo
echo "LIVE PAGE:"
echo "$LIVE"
echo
echo "LIVE CSS:"
echo "$APP/memeflow-orbit-v2.css"
echo
echo "LIVE JS:"
echo "$APP/memeflow-orbit-v2.js"
echo
echo "BACKUP:"
echo "$LIVE_BACKUP"
echo
echo "Backend logic:     NOT MODIFIED"
echo "Trading logic:     NOT MODIFIED"
echo "Evaluator:         NOT MODIFIED"
echo "Settings:          NOT MODIFIED"
echo

echo "--- git diff ---"
cd /home/runner/workspace
git diff --stat -- "$LIVE" "$APP/memeflow-orbit-v2.css" "$APP/memeflow-orbit-v2.js" || true
