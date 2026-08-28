#!/usr/bin/env bash
set -Eeuo pipefail

PATCH_ID="MEMEFLOW_TRADING_CHART_MATCH_PANEL_V3"
COMMIT_MESSAGE="Match trading chart background to panel surface"
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
JS="$APP/trading.js"

for f in "$HTML" "$JS"; do
  [[ -f "$f" ]] || {
    echo "ERROR: missing $f" >&2
    exit 1
  }
done

echo
echo "MEMEFLOW Trading Chart Match Panel V3"
echo "Changes ONLY the ECharts plot background:"
echo "  #0f141a -> #131b23"
echo "Candles, data, zoom, axes and renderer are untouched."
echo

grep -Fq "MEMEFLOW_TRADING_CHART_RESTORE_SITE_BG_V2" "$HTML" || {
  echo "ERROR: corrective V2 marker not found in trading.html." >&2
  exit 1
}

grep -Fq "backgroundColor:'#0f141a'" "$JS" || {
  echo "ERROR: expected current chart background #0f141a not found." >&2
  exit 1
}

if grep -Fq "$PATCH_ID" "$HTML" || grep -Fq "$PATCH_ID" "$JS"; then
  echo "Already installed: $PATCH_ID"
  exit 0
fi

BRANCH="$(git -C "$ROOT" branch --show-current)"
[[ -n "$BRANCH" ]] || {
  echo "ERROR: detached HEAD." >&2
  exit 1
}

REL_HTML="${HTML#"$ROOT"/}"
REL_JS="${JS#"$ROOT"/}"
TARGETS=("$REL_HTML" "$REL_JS")

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
BACKUP="$ROOT/.patch-backups/trading-chart-match-panel-v3-$STAMP"
mkdir -p "$BACKUP"
cp -p "$HTML" "$JS" "$BACKUP"/
echo "Backup: $BACKUP"

restore_on_error() {
  local rc=$?
  if [[ $rc -ne 0 ]]; then
    echo
    echo "Patch failed; restoring exact pre-patch files..."
    cp -p "$BACKUP/trading.html" "$HTML"
    cp -p "$BACKUP/trading.js" "$JS"
    echo "Rollback complete."
  fi
  exit "$rc"
}
trap restore_on_error EXIT

export MF_TRADING_HTML="$HTML"
export MF_TRADING_JS="$JS"

python3 <<'PY'
from pathlib import Path
import os
import re

html_path = Path(os.environ["MF_TRADING_HTML"])
js_path = Path(os.environ["MF_TRADING_JS"])

PATCH_ID = "MEMEFLOW_TRADING_CHART_MATCH_PANEL_V3"

html = html_path.read_text(encoding="utf-8")
js = js_path.read_text(encoding="utf-8")

if PATCH_ID in html or PATCH_ID in js:
    raise SystemExit("ERROR: partial V3 marker already exists")

old = "backgroundColor:'#0f141a'"
new = "backgroundColor:'#131b23'"

count = js.count(old)
if count != 1:
    raise SystemExit(
        f"ERROR: expected exactly one ECharts background #0f141a, found {count}"
    )

js = js.replace(old, new, 1)

# Update the old V2 comment so it describes the new intent.
js = js.replace(
    "/* MEMEFLOW_TRADING_CHART_RESTORE_SITE_BG_V2: match page background; render logic untouched */",
    (
        "/* MEMEFLOW_TRADING_CHART_RESTORE_SITE_BG_V2: render logic untouched */\n"
        "      /* MEMEFLOW_TRADING_CHART_MATCH_PANEL_V3: match surrounding panel surface */"
    ),
    1,
)

html = html.replace(
    "</head>",
    "  <!-- MEMEFLOW_TRADING_CHART_MATCH_PANEL_V3 -->\n</head>",
    1,
)

html, src_count = re.subn(
    r'src="/trading\.js(?:\?[^"]*)?"',
    'src="/trading.js?v=chart-match-panel-v3"',
    html,
    count=1,
)

if src_count != 1:
    raise SystemExit(
        f"ERROR: expected one /trading.js script reference, found {src_count}"
    )

def clean(text: str) -> str:
    return "\n".join(line.rstrip(" \t") for line in text.splitlines()) + "\n"

html = clean(html)
js = clean(js)

html_path.write_text(html, encoding="utf-8")
js_path.write_text(js, encoding="utf-8")

final_html = html_path.read_text(encoding="utf-8")
final_js = js_path.read_text(encoding="utf-8")

checks = {
    "old plot bg removed": "backgroundColor:'#0f141a'" not in final_js,
    "panel plot bg installed": "backgroundColor:'#131b23'" in final_js,
    "ECharts init preserved": "EC.init(" in final_js,
    "canvas renderer preserved": "renderer:'canvas'" in final_js,
    "setOption preserved": "chartRuntime.api.setOption(" in final_js,
    "V3 HTML marker": PATCH_ID in final_html,
    "V3 JS marker": PATCH_ID in final_js,
    "cache bust": "/trading.js?v=chart-match-panel-v3" in final_html,
}

failed = [name for name, ok in checks.items() if not ok]
if failed:
    raise SystemExit("ERROR: validation failed: " + ", ".join(failed))

for path, text in ((html_path, final_html), (js_path, final_js)):
    bad = [
        i for i, line in enumerate(text.splitlines(), start=1)
        if line.endswith((" ", "\t"))
    ]
    if bad:
        raise SystemExit(
            f"ERROR: trailing whitespace remains in {path.name}: {bad[:10]}"
        )

print("V3 validation: PASS")
print("Only chart background changed:")
print("  #0f141a -> #131b23")
print("ECharts rendering pipeline preserved.")
PY

node --check "$JS"
git -C "$ROOT" diff --check -- "${TARGETS[@]}"

echo
echo "Changed by this patch:"
git -C "$ROOT" status --short -- "${TARGETS[@]}"
git -C "$ROOT" diff --stat -- "${TARGETS[@]}"

if [[ "$DO_PUSH" == "1" ]]; then
  git -C "$ROOT" add -- "${TARGETS[@]}"
  git -C "$ROOT" diff --cached --check

  EXPECTED="$(printf '%s\n' "${TARGETS[@]}" | sort)"
  ACTUAL="$(git -C "$ROOT" diff --cached --name-only | sort)"

  if [[ "$ACTUAL" != "$EXPECTED" ]]; then
    echo "ERROR: staged set differs from the exact two V3 files." >&2
    git -C "$ROOT" reset -- "${TARGETS[@]}" >/dev/null 2>&1 || true
    exit 1
  fi

  git -C "$ROOT" commit -m "$COMMIT_MESSAGE"

  git -C "$ROOT" fetch origin "$BRANCH"

  if [[ "$(git -C "$ROOT" rev-parse HEAD^)" != "$(git -C "$ROOT" rev-parse "origin/$BRANCH")" ]]; then
    echo "ERROR: origin/$BRANCH changed while V3 was running." >&2
    echo "Validated commit remains local. No force-push attempted." >&2
    exit 1
  fi

  git -C "$ROOT" push origin "$BRANCH"

  echo
  echo "SUCCESS: chart background now matches the panel and was pushed."
  echo "Commit: $(git -C "$ROOT" rev-parse HEAD)"
else
  echo
  echo "SUCCESS: V3 installed locally (--no-push)."
fi

trap - EXIT

echo
echo "Result:"
echo "  - chart plot uses #131b23, matching the visible panel surface"
echo "  - candles remain fully functional"
echo "  - chart renderer/data/zoom logic untouched"
echo "Backup: $BACKUP"
