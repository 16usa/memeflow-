#!/usr/bin/env bash
set -Eeuo pipefail

PATCH_ID="MEMEFLOW_TRADING_BACK_BUTTON_V1"
COMMIT_MESSAGE="Add system back button to trading terminal"
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
elif [[ -f "$ROOT/trading.html" ]]; then
  APP="$ROOT"
else
  echo "ERROR: memeflow-app was not found." >&2
  exit 1
fi

HTML="$APP/trading.html"
CSS="$APP/trading.css"

for f in "$HTML" "$CSS"; do
  [[ -f "$f" ]] || { echo "ERROR: missing $f" >&2; exit 1; }
done

echo
echo "MEMEFLOW Trading Back Button V1"
echo "Adds the same ← button used on Live Token States to Trading Terminal."
echo "Destination: /system.html"
echo

grep -Fq 'MEMEFLOW Trading Terminal' "$HTML" || {
  echo "ERROR: trading.html is not the expected Trading Terminal page." >&2
  exit 1
}

grep -Fq '<div class="brand">' "$HTML" || {
  echo "ERROR: Trading Terminal brand block not found." >&2
  exit 1
}

if grep -Fq "$PATCH_ID" "$HTML" || grep -Fq "$PATCH_ID" "$CSS"; then
  echo "Already installed: $PATCH_ID"
  exit 0
fi

BRANCH="$(git -C "$ROOT" branch --show-current)"
[[ -n "$BRANCH" ]] || { echo "ERROR: detached HEAD." >&2; exit 1; }

REL_HTML="${HTML#"$ROOT"/}"
REL_CSS="${CSS#"$ROOT"/}"
TARGETS=("$REL_HTML" "$REL_CSS")

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
    echo "Local : $LOCAL_HEAD" >&2
    echo "Remote: $REMOTE_HEAD" >&2
    echo "Nothing changed." >&2
    exit 1
  fi
fi

STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="$ROOT/.patch-backups/trading-back-button-v1-$STAMP"
mkdir -p "$BACKUP"
cp -p "$HTML" "$CSS" "$BACKUP"/
echo "Backup: $BACKUP"

restore_on_error() {
  local rc=$?
  if [[ $rc -ne 0 ]]; then
    echo
    echo "Patch failed; restoring exact pre-patch files..."
    cp -p "$BACKUP/trading.html" "$HTML"
    cp -p "$BACKUP/trading.css" "$CSS"
    echo "Rollback complete."
  fi
  exit "$rc"
}
trap restore_on_error EXIT

export MF_HTML="$HTML"
export MF_CSS="$CSS"

python3 <<'PY'
from pathlib import Path
import os
import re

html_path = Path(os.environ["MF_HTML"])
css_path = Path(os.environ["MF_CSS"])
PATCH_ID = "MEMEFLOW_TRADING_BACK_BUTTON_V1"

html = html_path.read_text(encoding="utf-8")
css = css_path.read_text(encoding="utf-8")

if PATCH_ID in html or PATCH_ID in css:
    raise SystemExit("ERROR: partial Trading Back Button V1 marker already exists")

# Insert immediately before the dragonfly logo, matching Token Flow placement.
needle = '''      <div class="brand">
        <a class="brand-mark" href="/system.html" aria-label="Back to MEMEFLOW system">'''

replacement = '''      <div class="brand">
        <!-- MEMEFLOW_TRADING_BACK_BUTTON_V1 -->
        <a
          class="mf-trading-back-button"
          href="/system.html"
          aria-label="Back to system view"
        >
          ←
        </a>

        <a class="brand-mark" href="/system.html" aria-label="Back to MEMEFLOW system">'''

count = html.count(needle)
if count != 1:
    raise SystemExit(
        f"ERROR: expected exactly one Trading brand insertion anchor, found {count}"
    )

html = html.replace(needle, replacement, 1)

CSS_BLOCK = r'''
/* ===== MEMEFLOW_TRADING_BACK_BUTTON_V1 ===== */
/*
  Exact visual dimensions/function copied from the Live Token States
  .back-button. It sits before the dragonfly in the Trading header.
*/
.mf-trading-back-button {
  width: 38px;
  height: 38px;
  flex: 0 0 38px;

  display: grid;
  place-items: center;

  border: 1px solid var(--line);
  border-radius: 10px;

  background: rgba(255, 255, 255, .015);
  color: #94a8b6;

  font-size: 18px;
  line-height: 1;
  text-decoration: none;

  -webkit-tap-highlight-color: transparent;
}

.mf-trading-back-button:hover,
.mf-trading-back-button:focus-visible {
  border-color: rgba(85, 217, 255, .24);
  color: #c7d7df;
  outline: none;
}

/* Preserve the Trading header on narrow phones after adding the button. */
@media (max-width: 820px) {
  .brand {
    gap: 8px;
    min-width: 0;
  }

  .mf-trading-back-button {
    width: 38px;
    height: 38px;
    flex-basis: 38px;
  }

  .brand > div:last-child {
    min-width: 0;
  }
}

@media (max-width: 430px) {
  .topbar {
    column-gap: 5px;
  }

  .brand {
    gap: 7px;
  }

  .top-actions {
    gap: 5px;
  }

  .ghost-btn,
  .wallet-btn {
    padding-left: 7px;
    padding-right: 7px;
  }
}
/* ===== /MEMEFLOW_TRADING_BACK_BUTTON_V1 ===== */
'''

css = css.rstrip() + "\n\n" + CSS_BLOCK.strip() + "\n"

# Cache-bust Trading CSS so Safari does not show the markup without its styling.
html, css_count = re.subn(
    r'href="/trading\.css(?:\?[^"]*)?"',
    'href="/trading.css?v=trading-back-button-v1"',
    html,
    count=1,
)

if css_count != 1:
    raise SystemExit(f"ERROR: expected one trading.css link, found {css_count}")

# Strip trailing whitespace so git diff --check is guaranteed clean.
html = "\n".join(line.rstrip(" \t") for line in html.splitlines()) + "\n"
css = "\n".join(line.rstrip(" \t") for line in css.splitlines()) + "\n"

html_path.write_text(html, encoding="utf-8")
css_path.write_text(css, encoding="utf-8")

final_html = html_path.read_text(encoding="utf-8")
final_css = css_path.read_text(encoding="utf-8")

checks = {
    "HTML marker once": final_html.count(PATCH_ID) == 1,
    "CSS marker present": PATCH_ID in final_css,
    "back href exact": 'class="mf-trading-back-button"' in final_html
        and 'href="/system.html"' in final_html,
    "back before logo":
        final_html.index('class="mf-trading-back-button"')
        < final_html.index('class="brand-mark"'),
    "exact size": "width: 38px;" in final_css and "height: 38px;" in final_css,
    "exact radius": "border-radius: 10px;" in final_css,
    "exact color": "color: #94a8b6;" in final_css,
    "CSS cache bust": "/trading.css?v=trading-back-button-v1" in final_html,
    "System top action preserved": '<a href="/system.html" class="ghost-btn">System</a>' in final_html,
    "Wallet preserved": 'id="walletBtn"' in final_html,
}

failed = [name for name, ok in checks.items() if not ok]
if failed:
    raise SystemExit("ERROR: validation failed: " + ", ".join(failed))

for path, text in ((html_path, final_html), (css_path, final_css)):
    bad = [
        i for i, line in enumerate(text.splitlines(), start=1)
        if line.endswith((" ", "\t"))
    ]
    if bad:
        raise SystemExit(
            f"ERROR: trailing whitespace remains in {path.name}: {bad[:10]}"
        )

print("Trading Back Button V1 validation: PASS")
print("Placement: left of dragonfly/logo")
print("Destination: /system.html")
print("Visual size: 38x38, radius 10px — same as Live Token States")
PY

git -C "$ROOT" diff --check -- "${TARGETS[@]}"

echo
echo "Expected diff:"
git -C "$ROOT" diff --stat -- "${TARGETS[@]}"

if [[ "$DO_PUSH" == "1" ]]; then
  git -C "$ROOT" add -- "${TARGETS[@]}"
  git -C "$ROOT" diff --cached --check

  EXPECTED="$(printf '%s\n' "${TARGETS[@]}" | sort)"
  ACTUAL="$(git -C "$ROOT" diff --cached --name-only | sort)"

  if [[ "$ACTUAL" != "$EXPECTED" ]]; then
    echo "ERROR: staged set differs from the exact two Trading Back files." >&2
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
  echo "SUCCESS: Trading Back Button committed and pushed."
  echo "Commit: $(git -C "$ROOT" rev-parse HEAD)"
else
  echo
  echo "SUCCESS: Trading Back Button installed locally (--no-push)."
fi

trap - EXIT

echo
echo "Result:"
echo "  - Trading Terminal now has the same ← button on the far left"
echo "  - it returns to /system.html, just like Live Token States"
echo "  - logo, System button and Connect wallet remain intact"
echo "  - mobile header spacing is protected"
echo "Backup: $BACKUP"
