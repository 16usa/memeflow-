#!/usr/bin/env bash
set -Eeuo pipefail

PATCH_ID="MEMEFLOW_TRADING_REMOVE_SYSTEM_BUTTON_V1"
COMMIT_MESSAGE="Remove System button from trading header"
DO_PUSH=1

for arg in "$@"; do
  case "$arg" in
    --push) DO_PUSH=1 ;;
    --no-push) DO_PUSH=0 ;;
    *)
      echo "Usage: $0 [--push|--no-push]" >&2
      exit 2
      ;;
  esac
done

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
if [[ -z "$ROOT" ]]; then
  echo "ERROR: run this inside the MEMEFLOW git repository." >&2
  exit 1
fi

if [[ -d "$ROOT/memeflow-app" ]]; then
  APP="$ROOT/memeflow-app"
else
  APP="$ROOT"
fi

HTML="$APP/trading.html"
[[ -f "$HTML" ]] || {
  echo "ERROR: missing $HTML" >&2
  exit 1
}

echo
echo "MEMEFLOW Trading Remove System Button V1"
echo "Removes ONLY the System button from the Trading Terminal header."
echo "Back arrow and Connect wallet stay untouched."
echo

grep -Fq 'class="mf-trading-back-button"' "$HTML" || {
  echo "ERROR: Trading back button was not found." >&2
  exit 1
}

grep -Fq '<button id="walletBtn" class="wallet-btn"' "$HTML" || {
  echo "ERROR: Connect wallet button was not found." >&2
  exit 1
}

if grep -Fq "$PATCH_ID" "$HTML"; then
  echo "Already installed: $PATCH_ID"
  exit 0
fi

BRANCH="$(git -C "$ROOT" branch --show-current)"
[[ -n "$BRANCH" ]] || {
  echo "ERROR: detached HEAD." >&2
  exit 1
}

REL_HTML="${HTML#"$ROOT"/}"

if ! git -C "$ROOT" diff --quiet -- "$REL_HTML" || \
   ! git -C "$ROOT" diff --cached --quiet -- "$REL_HTML"; then
  echo "ERROR: $REL_HTML has local/staged edits." >&2
  echo "Commit or stash it first; nothing was changed." >&2
  exit 1
fi

if [[ -n "$(git -C "$ROOT" diff --cached --name-only)" ]]; then
  echo "ERROR: unrelated files are already staged. Unstage them first." >&2
  git -C "$ROOT" diff --cached --name-only >&2
  exit 1
fi

if [[ "$DO_PUSH" == "1" ]]; then
  git -C "$ROOT" fetch origin "$BRANCH"
  LOCAL_HEAD="$(git -C "$ROOT" rev-parse HEAD)"
  REMOTE_HEAD="$(git -C "$ROOT" rev-parse "origin/$BRANCH")"

  if [[ "$LOCAL_HEAD" != "$REMOTE_HEAD" ]]; then
    echo "ERROR: local $BRANCH differs from origin/$BRANCH." >&2
    echo "Nothing changed." >&2
    exit 1
  fi
fi

STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="$ROOT/.patch-backups/trading-remove-system-button-v1-$STAMP"
mkdir -p "$BACKUP"
cp -p "$HTML" "$BACKUP/trading.html"

restore_on_error() {
  local rc=$?
  if [[ $rc -ne 0 ]]; then
    echo
    echo "Patch failed; restoring exact pre-patch trading.html..."
    cp -p "$BACKUP/trading.html" "$HTML"
    echo "Rollback complete."
  fi
  exit "$rc"
}
trap restore_on_error EXIT

export MF_TRADING_HTML="$HTML"

python3 <<'PY'
from pathlib import Path
import os

html_path = Path(os.environ["MF_TRADING_HTML"])
html = html_path.read_text(encoding="utf-8")

PATCH_ID = "MEMEFLOW_TRADING_REMOVE_SYSTEM_BUTTON_V1"
target = '        <a href="/system.html" class="ghost-btn">System</a>\n'

count = html.count(target)
if count != 1:
    raise SystemExit(
        f"ERROR: expected exactly one Trading header System button, found {count}"
    )

html = html.replace(
    target,
    f'        <!-- {PATCH_ID}: System button removed; back arrow remains -->\n',
    1
)

checks = {
    "System header button removed":
        '<a href="/system.html" class="ghost-btn">System</a>' not in html,
    "Back arrow preserved":
        'class="mf-trading-back-button"' in html,
    "Wallet preserved":
        '<button id="walletBtn" class="wallet-btn"' in html,
    "Top actions preserved":
        '<div class="top-actions">' in html,
    "Marker installed":
        PATCH_ID in html,
}

failed = [name for name, ok in checks.items() if not ok]
if failed:
    raise SystemExit("ERROR: validation failed: " + ", ".join(failed))

html = "\n".join(line.rstrip(" \t") for line in html.splitlines()) + "\n"
html_path.write_text(html, encoding="utf-8")

print("Trading Remove System Button V1 validation: PASS")
print("Removed: System")
print("Preserved: ← back button")
print("Preserved: Connect wallet")
PY

git -C "$ROOT" diff --check -- "$REL_HTML"

echo
echo "Changed:"
git -C "$ROOT" status --short -- "$REL_HTML"
git -C "$ROOT" diff --stat -- "$REL_HTML"

if [[ "$DO_PUSH" == "1" ]]; then
  git -C "$ROOT" add -- "$REL_HTML"
  git -C "$ROOT" diff --cached --check

  ACTUAL="$(git -C "$ROOT" diff --cached --name-only)"
  if [[ "$ACTUAL" != "$REL_HTML" ]]; then
    echo "ERROR: staged set is not exactly $REL_HTML" >&2
    git -C "$ROOT" reset -- "$REL_HTML" >/dev/null 2>&1 || true
    exit 1
  fi

  git -C "$ROOT" commit -m "$COMMIT_MESSAGE"

  git -C "$ROOT" fetch origin "$BRANCH"
  if [[ "$(git -C "$ROOT" rev-parse HEAD^)" != "$(git -C "$ROOT" rev-parse "origin/$BRANCH")" ]]; then
    echo "ERROR: origin/$BRANCH changed while patch was running." >&2
    echo "Validated commit remains local. No force-push attempted." >&2
    exit 1
  fi

  git -C "$ROOT" push origin "$BRANCH"

  echo
  echo "SUCCESS: System button removed and pushed."
  echo "Commit: $(git -C "$ROOT" rev-parse HEAD)"
else
  echo
  echo "SUCCESS: System button removed locally (--no-push)."
fi

trap - EXIT

echo
echo "Result:"
echo "  - Trading header System button is completely gone"
echo "  - left ← back button remains"
echo "  - Connect wallet remains"
echo "  - chart/trading logic untouched"
echo "Backup: $BACKUP"
