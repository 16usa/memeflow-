#!/usr/bin/env bash
set -Eeuo pipefail

PATCH_ID="MEMEFLOW_REMOVE_LEGACY_BACK_BUTTONS_V1"
COMMIT_MESSAGE="[MEMEFLOW_REMOVE_LEGACY_BACK_BUTTONS_V1] Remove legacy back arrows"
DO_PUSH=1
ROLLBACK=0

for arg in "$@"; do
  case "$arg" in
    --push) DO_PUSH=1 ;;
    --no-push) DO_PUSH=0 ;;
    --rollback) ROLLBACK=1 ;;
    *)
      echo "Usage: $0 [--push|--no-push|--rollback]" >&2
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

TRADING="$APP/trading.html"
SETTINGS="$APP/settings.html"
TOKENS="$APP/system-tokens.html"

for f in "$TRADING" "$SETTINGS" "$TOKENS"; do
  [[ -f "$f" ]] || {
    echo "ERROR: missing $f" >&2
    exit 1
  }
done

BRANCH="$(git -C "$ROOT" branch --show-current)"
[[ -n "$BRANCH" ]] || {
  echo "ERROR: detached HEAD." >&2
  exit 1
}

# ---------------------------------------------------------------------------
# CLEAN ROLLBACK
# ---------------------------------------------------------------------------
if [[ "$ROLLBACK" == "1" ]]; then
  echo
  echo "MEMEFLOW legacy back-arrow rollback"
  echo

  if [[ -n "$(git -C "$ROOT" status --porcelain)" ]]; then
    echo "ERROR: working tree is not clean. Commit/stash changes first." >&2
    exit 1
  fi

  if [[ "$DO_PUSH" == "1" ]]; then
    git -C "$ROOT" fetch origin "$BRANCH"
    if [[ "$(git -C "$ROOT" rev-parse HEAD)" != "$(git -C "$ROOT" rev-parse "origin/$BRANCH")" ]]; then
      echo "ERROR: local $BRANCH differs from origin/$BRANCH." >&2
      exit 1
    fi
  fi

  INSTALL_COMMIT="$(
    git -C "$ROOT" log \
      --format='%H' \
      --grep='^\[MEMEFLOW_REMOVE_LEGACY_BACK_BUTTONS_V1\] Remove legacy back arrows$' \
      -n 1
  )"

  if [[ -z "$INSTALL_COMMIT" ]]; then
    echo "ERROR: install commit was not found." >&2
    exit 1
  fi

  echo "Reverting: $INSTALL_COMMIT"
  git -C "$ROOT" revert --no-edit "$INSTALL_COMMIT"

  if [[ "$DO_PUSH" == "1" ]]; then
    git -C "$ROOT" push origin "$BRANCH"
  fi

  echo
  echo "SUCCESS: the three old back-arrow buttons were restored."
  exit 0
fi

echo
echo "MEMEFLOW Remove Legacy Back Buttons V1"
echo
echo "Removes the obsolete ← buttons from:"
echo "  1. Trading Terminal"
echo "  2. System Settings"
echo "  3. Real-Time Pipeline / Token Flow"
echo
echo "The new two-line burger/right drawer remains the navigation system."
echo

# Exact current-state anchors.
grep -Fq 'class="mf-trading-back-button"' "$TRADING" || {
  echo "ERROR: Trading back button not found." >&2
  exit 1
}

grep -Fq 'class="mf-settings-page-back"' "$SETTINGS" || {
  echo "ERROR: Settings back button not found." >&2
  exit 1
}

grep -Fq 'class="back-button"' "$TOKENS" || {
  echo "ERROR: Token Flow back button not found." >&2
  exit 1
}

# Protect the new menu from accidental removal.
for f in "$TRADING" "$SETTINGS" "$TOKENS"; do
  grep -Fq 'MEMEFLOW_GLOBAL_RIGHT_DRAWER_NAV_V1' "$f" || {
    echo "ERROR: global right-drawer menu is missing from $f." >&2
    exit 1
  }
done

if grep -Fq "$PATCH_ID" "$TRADING" || \
   grep -Fq "$PATCH_ID" "$SETTINGS" || \
   grep -Fq "$PATCH_ID" "$TOKENS"; then
  echo "Already installed: $PATCH_ID"
  exit 0
fi

REL_TRADING="${TRADING#"$ROOT"/}"
REL_SETTINGS="${SETTINGS#"$ROOT"/}"
REL_TOKENS="${TOKENS#"$ROOT"/}"
TARGETS=("$REL_TRADING" "$REL_SETTINGS" "$REL_TOKENS")

for rel in "${TARGETS[@]}"; do
  if ! git -C "$ROOT" diff --quiet -- "$rel" || \
     ! git -C "$ROOT" diff --cached --quiet -- "$rel"; then
    echo "ERROR: target file has local/staged edits: $rel" >&2
    echo "Commit or stash it first; nothing was changed." >&2
    exit 1
  fi
done

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
BACKUP="$ROOT/.patch-backups/remove-legacy-back-buttons-v1-$STAMP"
mkdir -p "$BACKUP"

cp -p "$TRADING" "$BACKUP/trading.html"
cp -p "$SETTINGS" "$BACKUP/settings.html"
cp -p "$TOKENS" "$BACKUP/system-tokens.html"

echo "Backup: $BACKUP"

restore_on_error() {
  local rc=$?
  if [[ $rc -ne 0 ]]; then
    echo
    echo "Patch failed; restoring exact pre-patch files..."
    cp -p "$BACKUP/trading.html" "$TRADING"
    cp -p "$BACKUP/settings.html" "$SETTINGS"
    cp -p "$BACKUP/system-tokens.html" "$TOKENS"
    echo "Rollback complete."
  fi
  exit "$rc"
}
trap restore_on_error EXIT

export MF_TRADING="$TRADING"
export MF_SETTINGS="$SETTINGS"
export MF_TOKENS="$TOKENS"

python3 <<'PY'
from pathlib import Path
import os
import re

PATCH_ID = "MEMEFLOW_REMOVE_LEGACY_BACK_BUTTONS_V1"

trading_path = Path(os.environ["MF_TRADING"])
settings_path = Path(os.environ["MF_SETTINGS"])
tokens_path = Path(os.environ["MF_TOKENS"])

trading = trading_path.read_text(encoding="utf-8")
settings = settings_path.read_text(encoding="utf-8")
tokens = tokens_path.read_text(encoding="utf-8")

# ---------------------------------------------------------------------
# Trading Terminal
# Remove the old dedicated back-link markup only.
# ---------------------------------------------------------------------
trading_pattern = re.compile(
    r'\n\s*<!-- MEMEFLOW_TRADING_BACK_BUTTON_V1 -->\s*'
    r'<a\s+'
    r'class="mf-trading-back-button"\s+'
    r'href="/system\.html"\s+'
    r'aria-label="Back to system view"\s*'
    r'>\s*←\s*</a>\s*',
    re.S,
)

trading, count_trading = trading_pattern.subn(
    f'\n        <!-- {PATCH_ID}: legacy back arrow removed -->\n',
    trading,
    count=1,
)

if count_trading != 1:
    raise SystemExit(
        f"ERROR: expected one Trading back button, removed {count_trading}"
    )

# The older System-button-removal comment still says "back arrow remains".
# Correct that stale comment while we are touching this exact header.
trading = trading.replace(
    '<!-- MEMEFLOW_TRADING_REMOVE_SYSTEM_BUTTON_V1: System button removed; back arrow remains -->',
    '<!-- MEMEFLOW_TRADING_REMOVE_SYSTEM_BUTTON_V1: System button removed -->',
    1,
)

# ---------------------------------------------------------------------
# System Settings
# ---------------------------------------------------------------------
settings_pattern = re.compile(
    r'\s*<a\s+'
    r'class="mf-settings-page-back"\s+'
    r'href="/system\.html"\s+'
    r'aria-label="Back to system view"'
    r'>\s*←\s*</a>\s*',
    re.S,
)

settings, count_settings = settings_pattern.subn(
    f'\n        <!-- {PATCH_ID}: legacy back arrow removed -->\n        ',
    settings,
    count=1,
)

if count_settings != 1:
    raise SystemExit(
        f"ERROR: expected one Settings back button, removed {count_settings}"
    )

# ---------------------------------------------------------------------
# Real-Time Pipeline / Token Flow
# ---------------------------------------------------------------------
tokens_pattern = re.compile(
    r'\n\s*<a\s+'
    r'class="back-button"\s+'
    r'href="/system\.html"\s+'
    r'aria-label="Back to system view"\s*'
    r'>\s*←\s*</a>\s*',
    re.S,
)

tokens, count_tokens = tokens_pattern.subn(
    f'\n        <!-- {PATCH_ID}: legacy back arrow removed -->\n',
    tokens,
    count=1,
)

if count_tokens != 1:
    raise SystemExit(
        f"ERROR: expected one Token Flow back button, removed {count_tokens}"
    )

def clean(text: str) -> str:
    return "\n".join(
        line.rstrip(" \t") for line in text.splitlines()
    ) + "\n"

trading = clean(trading)
settings = clean(settings)
tokens = clean(tokens)

trading_path.write_text(trading, encoding="utf-8")
settings_path.write_text(settings, encoding="utf-8")
tokens_path.write_text(tokens, encoding="utf-8")

finals = {
    "Trading": trading,
    "Settings": settings,
    "Token Flow": tokens,
}

checks = {
    "Trading arrow DOM gone":
        'class="mf-trading-back-button"' not in trading,
    "Settings arrow DOM gone":
        'class="mf-settings-page-back"' not in settings,
    "Token Flow arrow DOM gone":
        'class="back-button"' not in tokens,
    "Trading burger preserved":
        'MEMEFLOW_GLOBAL_RIGHT_DRAWER_NAV_V1' in trading
        and '/memeflow-nav.js' in trading,
    "Settings burger preserved":
        'MEMEFLOW_GLOBAL_RIGHT_DRAWER_NAV_V1' in settings
        and '/memeflow-nav.js' in settings,
    "Token Flow burger preserved":
        'MEMEFLOW_GLOBAL_RIGHT_DRAWER_NAV_V1' in tokens
        and '/memeflow-nav.js' in tokens,
    "Trading wallet preserved":
        'id="walletBtn"' in trading,
    "Settings CONFIG preserved":
        'mf-settings-page-live' in settings,
    "Token Flow LIVE preserved":
        'class="live-status"' in tokens,
}

failed = [name for name, ok in checks.items() if not ok]
if failed:
    raise SystemExit(
        "ERROR: validation failed: " + ", ".join(failed)
    )

for path in (trading_path, settings_path, tokens_path):
    text = path.read_text(encoding="utf-8")
    bad = [
        i for i, line in enumerate(text.splitlines(), start=1)
        if line.endswith((" ", "\t"))
    ]
    if bad:
        raise SystemExit(
            f"ERROR: trailing whitespace remains in {path.name}: {bad[:10]}"
        )

print("Remove Legacy Back Buttons V1 validation: PASS")
print("Removed from DOM:")
print("  Trading Terminal ←")
print("  System Settings ←")
print("  Real-Time Pipeline ←")
print("Preserved:")
print("  two-line burger/right drawer")
print("  Connect wallet")
print("  CONFIG / LIVE status")
PY

git -C "$ROOT" diff --check -- "${TARGETS[@]}"

echo
echo "Changed:"
git -C "$ROOT" status --short -- "${TARGETS[@]}"
git -C "$ROOT" diff --stat -- "${TARGETS[@]}"

if [[ "$DO_PUSH" == "1" ]]; then
  git -C "$ROOT" add -- "${TARGETS[@]}"
  git -C "$ROOT" diff --cached --check

  EXPECTED="$(printf '%s\n' "${TARGETS[@]}" | sort)"
  ACTUAL="$(git -C "$ROOT" diff --cached --name-only | sort)"

  if [[ "$ACTUAL" != "$EXPECTED" ]]; then
    echo "ERROR: staged set differs from the exact three HTML files." >&2
    echo "Expected:" >&2
    printf '%s\n' "$EXPECTED" >&2
    echo "Actual:" >&2
    printf '%s\n' "$ACTUAL" >&2

    git -C "$ROOT" reset -- "${TARGETS[@]}" >/dev/null 2>&1 || true
    exit 1
  fi

  git -C "$ROOT" commit -m "$COMMIT_MESSAGE"

  git -C "$ROOT" fetch origin "$BRANCH"

  if [[ "$(git -C "$ROOT" rev-parse HEAD^)" != "$(git -C "$ROOT" rev-parse "origin/$BRANCH")" ]]; then
    echo "ERROR: origin/$BRANCH changed while the patch was running." >&2
    echo "Validated commit remains local. No force-push attempted." >&2
    exit 1
  fi

  git -C "$ROOT" push origin "$BRANCH"

  echo
  echo "SUCCESS: all three legacy arrows were removed and pushed."
  echo "Commit: $(git -C "$ROOT" rev-parse HEAD)"
else
  echo
  echo "SUCCESS: legacy arrows removed locally (--no-push)."
fi

trap - EXIT

echo
echo "Result:"
echo "  - Trading Terminal: old ← button completely removed from DOM"
echo "  - System Settings: old ← button completely removed from DOM"
echo "  - Real-Time Pipeline: old ← button completely removed from DOM"
echo "  - burger/right-drawer navigation stays untouched"
echo "  - no chart, settings, token-flow, API, or trading logic changed"
echo
echo "Clean rollback:"
echo "  ./apply_memeflow_remove_legacy_back_buttons_v1.sh --rollback"
echo
echo "Backup:"
echo "  $BACKUP"
