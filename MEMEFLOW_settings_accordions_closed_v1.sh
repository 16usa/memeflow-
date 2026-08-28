#!/usr/bin/env bash
set -euo pipefail

echo "=== MEMEFLOW SETTINGS ACCORDIONS CLOSED BY DEFAULT V1 ==="

ROOT="${ROOT:-$PWD}"
APP="$ROOT/memeflow-app"
SETTINGS_JS="$APP/settings-page.js"
WALLET_JS="$APP/account-wallet-settings.js"

if [[ ! -f "$SETTINGS_JS" || ! -f "$WALLET_JS" ]]; then
  echo "ERROR: expected files not found:"
  echo "  $SETTINGS_JS"
  echo "  $WALLET_JS"
  exit 1
fi

python3 - <<'PY'
from pathlib import Path

settings = Path("memeflow-app/settings-page.js")
wallet = Path("memeflow-app/account-wallet-settings.js")

s = settings.read_text(encoding="utf-8")
w = wallet.read_text(encoding="utf-8")

# 1) Native settings accordions:
# Force every normal Settings <details> group to start collapsed.
old = """    section.className = 'mf293-settings-group';
    section.open = open;
    const summary = document.createElement('summary');"""
new = """    section.className = 'mf293-settings-group';
    // MEMEFLOW_SETTINGS_ACCORDIONS_CLOSED_DEFAULT_V1
    // All Settings sections start collapsed. The user opens only what they need.
    section.open = false;
    const summary = document.createElement('summary');"""

if old not in s:
    if "MEMEFLOW_SETTINGS_ACCORDIONS_CLOSED_DEFAULT_V1" not in s:
        raise SystemExit("ERROR: settings-page.js accordion mount pattern not found")
else:
    s = s.replace(old, new, 1)

# Also make the group metadata truthful instead of leaving stale `true` defaults.
s = s.replace(
    "['logic', 'Logic', 'Post-admission decision rules · controls WAITING / WATCH / BUY READY', true, [",
    "['logic', 'Logic', 'Post-admission decision rules · controls WAITING / WATCH / BUY READY', false, [",
    1
)
s = s.replace(
    "['trading', 'Trading', 'Capital, position sizing and daily limits', true, [",
    "['trading', 'Trading', 'Capital, position sizing and daily limits', false, [",
    1
)
s = s.replace(
    "['exits', 'Risk & exits', 'Stops, take profit allocation and exit pressure', true, [",
    "['exits', 'Risk & exits', 'Stops, take profit allocation and exit pressure', false, [",
    1
)

# 2) Wallet + Execution & safety injected accordions:
# Normal Settings load => both collapsed.
w = w.replace(
    """    wallet.className = 'mf293-settings-group mf-account-settings-group';
    wallet.open = true;
    wallet.innerHTML = walletHtml();""",
    """    wallet.className = 'mf293-settings-group mf-account-settings-group';
    // MEMEFLOW_SETTINGS_ACCORDIONS_CLOSED_DEFAULT_V1
    wallet.open = false;
    wallet.innerHTML = walletHtml();""",
    1
)
w = w.replace(
    """    execution.className = 'mf293-settings-group mf-account-settings-group';
    execution.open = true;
    execution.innerHTML = executionHtml();""",
    """    execution.className = 'mf293-settings-group mf-account-settings-group';
    execution.open = false;
    execution.innerHTML = executionHtml();""",
    1
)

# Intentional deep-link exception:
# Trading Terminal -> /settings.html#wallet opens Wallet because the user explicitly
# requested that section. Plain /settings.html remains fully collapsed.
old_hash = """    if (location.hash === '#wallet') requestAnimationFrame(()=>wallet.scrollIntoView({behavior:'smooth',block:'start'}));"""
new_hash = """    if (location.hash === '#wallet') {
      wallet.open = true;
      requestAnimationFrame(()=>wallet.scrollIntoView({behavior:'smooth',block:'start'}));
    }"""
if old_hash in w:
    w = w.replace(old_hash, new_hash, 1)

settings.write_text(s, encoding="utf-8")
wallet.write_text(w, encoding="utf-8")
PY

echo
echo "=== CHECK ==="

# Syntax checks
node --check "$SETTINGS_JS"
node --check "$WALLET_JS"

# Behavioral source checks
grep -n "MEMEFLOW_SETTINGS_ACCORDIONS_CLOSED_DEFAULT_V1" "$SETTINGS_JS" "$WALLET_JS"
grep -n "section.open = false" "$SETTINGS_JS"
grep -n "wallet.open = false" "$WALLET_JS"
grep -n "execution.open = false" "$WALLET_JS"

# Make sure stale normal open defaults are gone from the injected groups.
if grep -q "wallet.open = true;" "$WALLET_JS"; then
  # Allowed only inside explicit #wallet deep-link block.
  count="$(grep -c "wallet.open = true;" "$WALLET_JS" || true)"
  if [[ "$count" -gt 1 ]]; then
    echo "ERROR: unexpected extra wallet.open=true found"
    exit 1
  fi
fi

echo
echo "=== GIT DIFF ==="
git diff -- "$SETTINGS_JS" "$WALLET_JS"

if git diff --quiet -- "$SETTINGS_JS" "$WALLET_JS"; then
  echo "No changes needed: patch is already applied."
  exit 0
fi

git add "$SETTINGS_JS" "$WALLET_JS"
git commit -m "fix(settings): collapse all accordions by default"
git push origin HEAD

echo
echo "DONE: all System Settings accordions are collapsed by default."
echo "NOTE: /settings.html#wallet intentionally opens Wallet because that is an explicit deep-link."
