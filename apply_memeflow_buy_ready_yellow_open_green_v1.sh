#!/usr/bin/env bash
set -Eeuo pipefail

PATCH_ID="MEMEFLOW_BUY_READY_YELLOW_OPEN_GREEN_V1"
COMMIT_MESSAGE="[MEMEFLOW_BUY_READY_YELLOW_OPEN_GREEN_V1] Make BUY READY yellow"
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

TOKENS_CSS="$APP/system-tokens.css"
TOKENS_HTML="$APP/system-tokens.html"
TRADING_CSS="$APP/trading.css"
TRADING_HTML="$APP/trading.html"
SYSTEM_CSS="$APP/system.css"
SYSTEM_HTML="$APP/system.html"

FILES=(
  "$TOKENS_CSS"
  "$TOKENS_HTML"
  "$TRADING_CSS"
  "$TRADING_HTML"
  "$SYSTEM_CSS"
  "$SYSTEM_HTML"
)

for f in "${FILES[@]}"; do
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

if [[ "$ROLLBACK" == "1" ]]; then
  echo
  echo "MEMEFLOW BUY READY color rollback"
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
      --grep='^\[MEMEFLOW_BUY_READY_YELLOW_OPEN_GREEN_V1\] Make BUY READY yellow$' \
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
  echo "SUCCESS: BUY READY colors restored to their pre-patch state."
  exit 0
fi

echo
echo "MEMEFLOW BUY READY Yellow / OPEN POSITION Green V1"
echo
echo "Semantic status colors:"
echo "  BUY READY     -> yellow (#efc66a)"
echo "  OPEN POSITION -> green (#4de6a1), unchanged"
echo
echo "Positive P&L / positive 5m% remain green because they are metrics, not statuses."
echo

grep -Fq '.token-state.ready' "$TOKENS_CSS" || {
  echo "ERROR: system-tokens BUY READY style not found." >&2
  exit 1
}
grep -Fq '.token-state.open' "$TOKENS_CSS" || {
  echo "ERROR: OPEN POSITION style not found." >&2
  exit 1
}
grep -Fq '.state-dot.ready' "$TRADING_CSS" || {
  echo "ERROR: Trading BUY READY candidate style not found." >&2
  exit 1
}
grep -Fq '.legend-dot.ready' "$SYSTEM_CSS" || {
  echo "ERROR: System BUY READY legend style not found." >&2
  exit 1
}

if grep -Fq "$PATCH_ID" "$TOKENS_CSS" || \
   grep -Fq "$PATCH_ID" "$TRADING_CSS" || \
   grep -Fq "$PATCH_ID" "$SYSTEM_CSS"; then
  echo "Already installed: $PATCH_ID"
  exit 0
fi

RELS=()
for f in "${FILES[@]}"; do
  rel="${f#"$ROOT"/}"
  RELS+=("$rel")

  if ! git -C "$ROOT" diff --quiet -- "$rel" || \
     ! git -C "$ROOT" diff --cached --quiet -- "$rel"; then
    echo "ERROR: target file has local/staged edits: $rel" >&2
    echo "Commit or stash them first; nothing was changed." >&2
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
BACKUP="$ROOT/.patch-backups/buy-ready-yellow-open-green-v1-$STAMP"
mkdir -p "$BACKUP"

cp -p "$TOKENS_CSS" "$BACKUP/system-tokens.css"
cp -p "$TOKENS_HTML" "$BACKUP/system-tokens.html"
cp -p "$TRADING_CSS" "$BACKUP/trading.css"
cp -p "$TRADING_HTML" "$BACKUP/trading.html"
cp -p "$SYSTEM_CSS" "$BACKUP/system.css"
cp -p "$SYSTEM_HTML" "$BACKUP/system.html"

echo "Backup: $BACKUP"

restore_on_error() {
  local rc=$?
  if [[ $rc -ne 0 ]]; then
    echo
    echo "Patch failed; restoring exact pre-patch files..."
    cp -p "$BACKUP/system-tokens.css" "$TOKENS_CSS"
    cp -p "$BACKUP/system-tokens.html" "$TOKENS_HTML"
    cp -p "$BACKUP/trading.css" "$TRADING_CSS"
    cp -p "$BACKUP/trading.html" "$TRADING_HTML"
    cp -p "$BACKUP/system.css" "$SYSTEM_CSS"
    cp -p "$BACKUP/system.html" "$SYSTEM_HTML"
    echo "Rollback complete."
  fi
  exit "$rc"
}
trap restore_on_error EXIT

export MF_TOKENS_CSS="$TOKENS_CSS"
export MF_TOKENS_HTML="$TOKENS_HTML"
export MF_TRADING_CSS="$TRADING_CSS"
export MF_TRADING_HTML="$TRADING_HTML"
export MF_SYSTEM_CSS="$SYSTEM_CSS"
export MF_SYSTEM_HTML="$SYSTEM_HTML"

python3 <<'PY'
from pathlib import Path
import os
import re

PATCH_ID = "MEMEFLOW_BUY_READY_YELLOW_OPEN_GREEN_V1"

paths = {
    "tokens_css": Path(os.environ["MF_TOKENS_CSS"]),
    "tokens_html": Path(os.environ["MF_TOKENS_HTML"]),
    "trading_css": Path(os.environ["MF_TRADING_CSS"]),
    "trading_html": Path(os.environ["MF_TRADING_HTML"]),
    "system_css": Path(os.environ["MF_SYSTEM_CSS"]),
    "system_html": Path(os.environ["MF_SYSTEM_HTML"]),
}

data = {k: p.read_text(encoding="utf-8") for k, p in paths.items()}

def yellowize_block(block):
    block = block.replace("var(--green)", "var(--yellow)")
    block = block.replace("rgba(77, 230, 161", "rgba(239, 198, 106")
    block = block.replace("rgba(77,230,161", "rgba(239,198,106")
    block = block.replace("#4de6a1", "#efc66a")
    return block

def transform_selector_blocks(text, selectors, label):
    total = 0

    for selector in selectors:
        pattern = re.compile(
            rf"({re.escape(selector)}\s*\{{)([^{{}}]*)(\}})",
            re.S
        )

        def repl(match):
            nonlocal total
            total += 1
            return match.group(1) + yellowize_block(match.group(2)) + match.group(3)

        text = pattern.sub(repl, text)

    if total < len(selectors):
        raise SystemExit(
            f"ERROR: {label}: expected at least {len(selectors)} READY blocks, updated {total}"
        )

    return text, total

tokens_selectors = [
    ".summary-card.ready",
    ".summary-card.ready.active",
    ".flow-token.ready",
    ".flow-token.ready::before",
    ".token-state.ready",
    ".token-avatar.ready",
]

data["tokens_css"], token_count = transform_selector_blocks(
    data["tokens_css"],
    tokens_selectors,
    "system-tokens.css"
)

trading_selectors = [
    ".state-dot.ready",
    ".decision-badge.ready",
]

data["trading_css"], trading_count = transform_selector_blocks(
    data["trading_css"],
    trading_selectors,
    "trading.css"
)

system_selectors = [
    ".legend-dot.ready",
    ".state-pill.ready",
    ".token-state.ready",
]

data["system_css"], system_count = transform_selector_blocks(
    data["system_css"],
    system_selectors,
    "system.css"
)

for key in ("tokens_css", "trading_css", "system_css"):
    data[key] = (
        data[key].rstrip()
        + f"\n\n/* {PATCH_ID}: BUY READY = yellow; OPEN POSITION = green. */\n"
    )

def bust(html, css_name):
    pattern = re.compile(
        rf'href="/{re.escape(css_name)}(?:\?[^"]*)?"'
    )
    html, count = pattern.subn(
        f'href="/{css_name}?v=buy-ready-yellow-v1"',
        html,
        count=1
    )
    if count != 1:
        raise SystemExit(
            f"ERROR: expected one /{css_name} stylesheet link, found {count}"
        )
    return html

data["tokens_html"] = bust(data["tokens_html"], "system-tokens.css")
data["trading_html"] = bust(data["trading_html"], "trading.css")
data["system_html"] = bust(data["system_html"], "system.css")

def clean(text):
    return "\n".join(line.rstrip(" \t") for line in text.splitlines()) + "\n"

for key in data:
    data[key] = clean(data[key])
    paths[key].write_text(data[key], encoding="utf-8")

tokens = data["tokens_css"]
trading = data["trading_css"]
system = data["system_css"]

checks = {
    "Pipeline READY badge yellow":
        re.search(r"\.token-state\.ready\s*\{[^{}]*var\(--yellow\)", tokens, re.S) is not None,

    "Pipeline READY left rail yellow":
        re.search(r"\.flow-token\.ready::before\s*\{[^{}]*var\(--yellow\)", tokens, re.S) is not None,

    "Pipeline READY summary yellow":
        re.search(r"\.summary-card\.ready\.active\s*\{[^{}]*239,\s*198,\s*106", tokens, re.S) is not None,

    "Pipeline READY avatar yellow":
        re.search(r"\.token-avatar\.ready\s*\{[^{}]*239,\s*198,\s*106", tokens, re.S) is not None,

    "OPEN POSITION badge still green":
        re.search(r"\.token-state\.open\s*\{[^{}]*var\(--green\)", tokens, re.S) is not None,

    "OPEN POSITION left rail still green":
        re.search(r"\.flow-token\.open::before\s*\{[^{}]*var\(--green\)", tokens, re.S) is not None,

    "Trading READY candidate yellow":
        re.search(r"\.state-dot\.ready\s*\{[^{}]*var\(--yellow\)", trading, re.S) is not None,

    "Trading READY decision badge yellow":
        re.search(r"\.decision-badge\.ready\s*\{[^{}]*var\(--yellow\)", trading, re.S) is not None,

    "System READY legend yellow":
        re.search(r"\.legend-dot\.ready\s*\{[^{}]*var\(--yellow\)", system, re.S) is not None,

    "System READY state pill yellow":
        re.search(r"\.state-pill\.ready\s*\{[^{}]*var\(--yellow\)", system, re.S) is not None,

    "Markers installed":
        all(PATCH_ID in data[key] for key in ("tokens_css", "trading_css", "system_css")),

    "Token CSS cache bust":
        "/system-tokens.css?v=buy-ready-yellow-v1" in data["tokens_html"],

    "Trading CSS cache bust":
        "/trading.css?v=buy-ready-yellow-v1" in data["trading_html"],

    "System CSS cache bust":
        "/system.css?v=buy-ready-yellow-v1" in data["system_html"],
}

failed = [name for name, ok in checks.items() if not ok]
if failed:
    raise SystemExit("ERROR: validation failed: " + ", ".join(failed))

for selector in tokens_selectors:
    for match in re.finditer(
        rf"{re.escape(selector)}\s*\{{[^{{}}]*\}}",
        tokens,
        re.S
    ):
        block = match.group(0)
        if (
            "var(--green)" in block
            or "77, 230, 161" in block
            or "77,230,161" in block
        ):
            raise SystemExit(
                f"ERROR: READY selector still contains green: {selector}"
            )

for path in paths.values():
    text = path.read_text(encoding="utf-8")
    bad = [
        i for i, line in enumerate(text.splitlines(), start=1)
        if line.endswith((" ", "\t"))
    ]
    if bad:
        raise SystemExit(
            f"ERROR: trailing whitespace remains in {path.name}: {bad[:10]}"
        )

print("BUY READY Yellow / OPEN POSITION Green validation: PASS")
print(
    f"Ready blocks changed: pipeline={token_count}, "
    f"trading={trading_count}, system={system_count}"
)
print("OPEN POSITION semantic green was explicitly validated and preserved.")
print("Positive P&L / positive percentage colors were not modified.")
PY

git -C "$ROOT" diff --check -- "${RELS[@]}"

echo
echo "Changed:"
git -C "$ROOT" status --short -- "${RELS[@]}"
git -C "$ROOT" diff --stat -- "${RELS[@]}"

if [[ "$DO_PUSH" == "1" ]]; then
  git -C "$ROOT" add -- "${RELS[@]}"
  git -C "$ROOT" diff --cached --check

  EXPECTED="$(printf '%s\n' "${RELS[@]}" | sort)"
  ACTUAL="$(git -C "$ROOT" diff --cached --name-only | sort)"

  if [[ "$ACTUAL" != "$EXPECTED" ]]; then
    echo "ERROR: staged set differs from the exact six status-color files." >&2
    git -C "$ROOT" reset -- "${RELS[@]}" >/dev/null 2>&1 || true
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
  echo "SUCCESS: BUY READY is yellow and changes were pushed."
  echo "Commit: $(git -C "$ROOT" rev-parse HEAD)"
else
  echo
  echo "SUCCESS: status colors changed locally (--no-push)."
fi

trap - EXIT

echo
echo "Result:"
echo "  - BUY READY summary/filter = yellow"
echo "  - BUY READY card left rail / subtle card accent = yellow"
echo "  - BUY READY badge = yellow"
echo "  - BUY READY avatar status accent = yellow"
echo "  - Trading Terminal BUY READY state badges = yellow"
echo "  - System architecture READY indicators = yellow"
echo "  - OPEN POSITION remains green"
echo "  - positive P&L and positive percentage metrics remain green"
echo
echo "Clean rollback:"
echo "  ./apply_memeflow_buy_ready_yellow_open_green_v1.sh --rollback"
echo
echo "Backup:"
echo "  $BACKUP"
