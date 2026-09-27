#!/usr/bin/env bash
set -euo pipefail
ROOT="${1:-$PWD}"
APP="$ROOT/memeflow-app"
HERE="$(cd "$(dirname "$0")" && pwd)"

for f in app-server.mjs settings-page.js settings.html memeflow-theme.js memeflow-theme.css account-wallet-settings.js memeflow-nav.js; do
  [[ -f "$APP/$f" ]] || { echo "ERROR: missing memeflow-app/$f"; exit 1; }
done

STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="$ROOT/.memeflow-settings-v191-backup-$STAMP"
LAST="$ROOT/.memeflow-settings-v191-last"
mkdir -p "$BACKUP/memeflow-app/tests"

python3 - "$ROOT" "$BACKUP" <<'PY'
from pathlib import Path
import json, shutil, sys
root=Path(sys.argv[1]); backup=Path(sys.argv[2]); app=root/'memeflow-app'
files=[
 'memeflow-app/app-server.mjs','memeflow-app/settings-page.js','memeflow-app/settings.html',
 'memeflow-app/memeflow-theme.js','memeflow-app/memeflow-theme.css',
 'memeflow-app/account-wallet-settings.js','memeflow-app/memeflow-nav.js'
]
for pkg in ('package.json','memeflow-app/package.json'):
    if (root/pkg).is_file(): files.append(pkg)
if (app/'tests').is_dir():
    for p in (app/'tests').iterdir():
        if p.is_file() and 'public-agent' in p.name.lower().replace('_','-'):
            files.append(str(p.relative_to(root)))
manifest=[]
for rel in files:
    src=root/rel; dst=backup/rel
    dst.parent.mkdir(parents=True,exist_ok=True)
    shutil.copy2(src,dst)
    manifest.append(rel)
(backup/'manifest.json').write_text(json.dumps({'files':manifest},indent=2),encoding='utf-8')
print('Backup files:',len(manifest))
PY

echo "$BACKUP" > "$LAST"
echo "Backup: $BACKUP"

python3 "$HERE/apply.py" "$ROOT"

node --check "$APP/app-server.mjs"
node --check "$APP/settings-page.js"
node --check "$APP/memeflow-theme.js"
node --check "$APP/account-wallet-settings.js"
node --check "$APP/memeflow-nav.js"

git -C "$ROOT" diff --check -- memeflow-app || { echo "ERROR: git diff --check failed"; exit 1; }
python3 "$HERE/audit.py" "$ROOT"

echo
echo "Installed MEMEFLOW SYSTEM SETTINGS CLEANUP V191"
echo "Backup: $BACKUP"
echo "No server restart was performed."
echo
echo "Rollback:"
echo "  bash memeflow_settings_cleanup_v191/rollback.sh"
echo
echo "Changed scope:"
echo "  - Public Agent removed from backend + Settings + tests"
echo "  - Wallet & Smart Vault removed from System Settings only"
echo "  - Theme selector compacted into top System Settings meta grid"
