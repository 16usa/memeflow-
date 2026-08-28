#!/usr/bin/env bash
set -Eeuo pipefail

PATCH="copy-trading-system-settings-v3"
APP="memeflow-app"
SYSTEM_JS="$APP/system.js"
OLD_SYNC="$APP/copy-trading-settings-sync-v2.js"
MARKER="MEMEFLOW_COPY_TRADING_SETTINGS_SYNC_V2"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="/tmp/${PATCH}-${STAMP}"

log(){ printf '\n[%s] %s\n' "$PATCH" "$*"; }
die(){ printf '\n[%s] ERROR: %s\n' "$PATCH" "$*" >&2; exit 1; }

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
[[ -n "$ROOT" ]] || die "Run this inside the MEMEFLOW git repository."
cd "$ROOT"

[[ -f "$SYSTEM_JS" ]] || die "Missing $SYSTEM_JS"
BRANCH="$(git branch --show-current)"
[[ -n "$BRANCH" ]] || die "Detached HEAD is not supported."

log "Repository: $ROOT"
log "Branch: $BRANCH"
log "Unrelated dirty files are allowed."

# The real System settings implementation must match the current architecture.
grep -q "const MF293_GROUPS = \[" "$SYSTEM_JS" \
  || die "MF293_GROUPS not found in system.js"
grep -q "\['trading', 'Trading', 'Capital, position sizing and daily limits'" "$SYSTEM_JS" \
  || die "Trading settings group not found in system.js"
grep -q "\['filters', 'Entry filters', 'Market, holder, concentration and token filters'" "$SYSTEM_JS" \
  || die "Entry filters group not found in system.js"

# Backend Copy Trading fields must already exist.
for key in copyTradingEnabled copyTradingWallet copyTradingBuyAmountSol copyTradingMirrorSells; do
  grep -q "$key" "$APP/src/settings.mjs" \
    || die "Backend field $key is missing from src/settings.mjs"
done

# Avoid mixing this fix with unrelated edits to the one source file we must modify.
if ! git diff --quiet -- "$SYSTEM_JS"; then
  die "$SYSTEM_JS has uncommitted local edits. Commit/stash that file first; unrelated dirty files are fine."
fi

# Find only tracked HTML files that still contain the bad global injector.
mapfile -t OLD_HTML < <(
  git grep -l "$MARKER" -- "$APP/*.html" "$APP/**/*.html" 2>/dev/null || true
)

# Protect marker-bearing HTML files from accidentally staging unrelated local edits.
for f in "${OLD_HTML[@]}"; do
  [[ -f "$f" ]] || continue
  if ! git diff --quiet -- "$f"; then
    die "$f has uncommitted local edits. This patch will not mix them into its commit."
  fi
done

mkdir -p "$BACKUP"
cp -p "$SYSTEM_JS" "$BACKUP/system.js"
if [[ -f "$OLD_SYNC" ]]; then
  cp -p "$OLD_SYNC" "$BACKUP/copy-trading-settings-sync-v2.js"
fi

for f in "${OLD_HTML[@]}"; do
  [[ -f "$f" ]] || continue
  mkdir -p "$BACKUP/$(dirname "$f")"
  cp -p "$f" "$BACKUP/$f"
done

restore(){
  local code=$?
  [[ $code -eq 0 ]] && return 0
  printf '\n[%s] Failure: restoring files touched by this patch...\n' "$PATCH" >&2
  cp -p "$BACKUP/system.js" "$SYSTEM_JS"
  if [[ -f "$BACKUP/copy-trading-settings-sync-v2.js" ]]; then
    cp -p "$BACKUP/copy-trading-settings-sync-v2.js" "$OLD_SYNC"
  fi
  for f in "${OLD_HTML[@]}"; do
    [[ -f "$BACKUP/$f" ]] && cp -p "$BACKUP/$f" "$f"
  done
  git reset -q HEAD -- "$SYSTEM_JS" "$OLD_SYNC" "${OLD_HTML[@]}" 2>/dev/null || true
  printf '[%s] Restored. Unrelated files were untouched.\n' "$PATCH" >&2
  exit "$code"
}
trap restore ERR

log "Adding Copy trading directly to the native System settings group list..."

python3 - <<'PY'
from pathlib import Path

p = Path("memeflow-app/system.js")
s = p.read_text(encoding="utf-8")

marker = "MEMEFLOW_NATIVE_COPY_TRADING_SETTINGS_V3"

if marker in s:
    print("Native Copy trading group is already present.")
else:
    needle = """  ['filters', 'Entry filters', 'Market, holder, concentration and token filters', false, ["""
    if needle not in s:
        raise SystemExit("Entry filters anchor not found.")

    group = """  /* MEMEFLOW_NATIVE_COPY_TRADING_SETTINGS_V3 */
  ['copyTrading', 'Copy trading', 'Mirror a Solana wallet with your own position size', false, [
    ['copyTradingEnabled', 'Enable copy trading', 'boolean'],
    ['copyTradingWallet', 'Tracked Solana wallet', 'text'],
    ['copyTradingBuyAmountSol', 'Your BUY size · SOL', 'number', 0.001, null, 0.001],
    ['copyTradingMirrorSells', 'Mirror sells proportionally', 'boolean']
  ]],
"""

    # Inserting directly before Entry filters guarantees:
    # Logic -> Trading -> Copy trading -> Entry filters -> Risk & exits.
    s = s.replace(needle, group + needle, 1)
    p.write_text(s, encoding="utf-8")
    print("Inserted native Copy trading group after Trading.")
PY

log "Removing the old global injector from HTML entry points..."

python3 - <<'PY'
from pathlib import Path
import re
import subprocess

marker = "MEMEFLOW_COPY_TRADING_SETTINGS_SYNC_V2"

proc = subprocess.run(
    ["git", "grep", "-l", marker, "--", "memeflow-app/*.html", "memeflow-app/**/*.html"],
    text=True,
    capture_output=True
)

files = [Path(x.strip()) for x in proc.stdout.splitlines() if x.strip()]
removed = 0

for p in files:
    s = p.read_text(encoding="utf-8")
    before = s

    # Remove only script tags created by the bad v2 global patch.
    s = re.sub(
        r'\s*<script\b[^>]*data-patch=["\']MEMEFLOW_COPY_TRADING_SETTINGS_SYNC_V2["\'][^>]*>\s*</script>\s*',
        '\n',
        s,
        flags=re.I
    )

    # Fallback for exact src tag if attribute order differs.
    s = re.sub(
        r'\s*<script\b[^>]*src=["\']/copy-trading-settings-sync-v2\.js(?:\?[^"\']*)?["\'][^>]*>\s*</script>\s*',
        '\n',
        s,
        flags=re.I
    )

    if s != before:
        p.write_text(s, encoding="utf-8")
        removed += 1

print(f"Removed old injector from {removed} HTML file(s).")
PY

# The v2 file is no longer required: System settings is native, and the original
# AI & Trading Settings already uses the same backend settings profile.
if [[ -f "$OLD_SYNC" ]]; then
  rm -f "$OLD_SYNC"
fi

log "Verifying exact System settings order and backend wiring..."

python3 - <<'PY'
from pathlib import Path

s = Path("memeflow-app/system.js").read_text(encoding="utf-8")

required = [
    "MEMEFLOW_NATIVE_COPY_TRADING_SETTINGS_V3",
    "['copyTradingEnabled', 'Enable copy trading', 'boolean']",
    "['copyTradingWallet', 'Tracked Solana wallet', 'text']",
    "['copyTradingBuyAmountSol', 'Your BUY size · SOL', 'number', 0.001, null, 0.001]",
    "['copyTradingMirrorSells', 'Mirror sells proportionally', 'boolean']",
    "fetch('/api/settings'",
    "method: 'PUT'",
]
for x in required:
    if x not in s:
        raise SystemExit(f"Missing required wiring: {x}")

trading = s.index("['trading', 'Trading'")
copy = s.index("['copyTrading', 'Copy trading'")
filters = s.index("['filters', 'Entry filters'")
exits = s.index("['exits', 'Risk & exits'")

if not (trading < copy < filters < exits):
    raise SystemExit("Wrong System settings group order.")

print("Order OK: Trading -> Copy trading -> Entry filters -> Risk & exits")
PY

# No active tracked HTML page may still load the global v2 injector.
if git grep -n "$MARKER" -- "$APP/*.html" "$APP/**/*.html" 2>/dev/null; then
  die "Old global Copy Trading injector is still referenced by an active HTML file."
fi

# Syntax check the actual module.
node --check "$SYSTEM_JS"

log "Running project tests..."
(
  cd "$APP"
  npm test
)

log "Staging ONLY this fix..."

git add -- "$SYSTEM_JS"

for f in "${OLD_HTML[@]}"; do
  [[ -f "$f" ]] && git add -- "$f"
done

if git ls-files --error-unmatch "$OLD_SYNC" >/dev/null 2>&1; then
  git add -u -- "$OLD_SYNC"
fi

if git diff --cached --quiet; then
  log "Nothing to commit: the native fix is already installed."
  trap - ERR
  exit 0
fi

log "Staged changes:"
git diff --cached --name-status

# Final safety: this patch must not stage data/backups/old installers.
if git diff --cached --name-only | grep -E '(^|/)(data|\.patch-backups|.*backup.*)(/|$)|\.bak$|\.before-' >/dev/null; then
  die "Safety check: unexpected backup/data file was staged."
fi

git commit -m "fix(settings): put copy trading inside System settings"

log "Pushing $BRANCH without force..."
git push origin "$BRANCH"

trap - ERR
log "DONE"
printf '%s\n' \
  "Native System settings now contains:" \
  "Logic -> Trading -> Copy trading -> Entry filters -> Risk & exits" \
  "The incorrect global Copy Trading block was removed from normal pages." \
  "Both settings UIs use the same /api/settings backend profile."
