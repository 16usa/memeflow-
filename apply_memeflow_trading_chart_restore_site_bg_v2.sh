#!/usr/bin/env bash
set -Eeuo pipefail

PATCH_ID="MEMEFLOW_TRADING_CHART_RESTORE_SITE_BG_V2"
COMMIT_MESSAGE="Restore trading chart and match site background"
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
echo "MEMEFLOW Trading Chart Restore + Site Background V2"
echo "Fixes the broken chart caused by the previous transparent-background patch."
echo "Then changes ONLY ECharts' own background from #02070a to site #0f141a."
echo

grep -Fq "MEMEFLOW_TRADING_CHART_TRANSPARENT_BG_V1" "$HTML" || {
  echo "ERROR: previous transparent-background patch marker was not found." >&2
  echo "Nothing was changed." >&2
  exit 1
}

grep -Fq "backgroundColor:'#02070a'" "$JS" || {
  echo "ERROR: expected native ECharts backgroundColor '#02070a' not found." >&2
  echo "Nothing was changed." >&2
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
BACKUP="$ROOT/.patch-backups/trading-chart-restore-site-bg-v2-$STAMP"
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

PATCH_ID = "MEMEFLOW_TRADING_CHART_RESTORE_SITE_BG_V2"

html = html_path.read_text(encoding="utf-8")
js = js_path.read_text(encoding="utf-8")

if PATCH_ID in html or PATCH_ID in js:
    raise SystemExit("ERROR: partial V2 marker already exists")

# -------------------------------------------------------------------
# 1) REMOVE the previous invasive patch completely.
#    It used a MutationObserver, touched arbitrary chart descendants,
#    canvases, divs and tried to monkey-patch chart APIs.
# -------------------------------------------------------------------
style_pattern = re.compile(
    r'\s*<style\s+id=["\']mfTradingChartTransparentBgV1["\']>'
    r'.*?'
    r'</style>\s*',
    re.S | re.I,
)

script_pattern = re.compile(
    r'\s*<script>\s*'
    r'/\*\s*=====\s*MEMEFLOW_TRADING_CHART_TRANSPARENT_BG_V1\s*=====\s*\*/'
    r'.*?'
    r'/\*\s*=====\s*/MEMEFLOW_TRADING_CHART_TRANSPARENT_BG_V1\s*=====\s*\*/'
    r'\s*</script>\s*',
    re.S | re.I,
)

html, removed_style = style_pattern.subn("\n", html, count=1)
html, removed_script = script_pattern.subn("\n", html, count=1)

if removed_style != 1:
    raise SystemExit(
        f"ERROR: expected exactly one old transparent style block, removed {removed_style}"
    )

if removed_script != 1:
    raise SystemExit(
        f"ERROR: expected exactly one old transparent script block, removed {removed_script}"
    )

# -------------------------------------------------------------------
# 2) CHANGE ONLY THE NATIVE ECHARTS BACKGROUND.
#    No DOM observer. No canvas manipulation. No chart API monkey patch.
#    The site itself uses #0f141a, so the plot blends into the page.
# -------------------------------------------------------------------
old_bg = "backgroundColor:'#02070a'"
new_bg = "backgroundColor:'#0f141a'"

bg_count = js.count(old_bg)
if bg_count != 1:
    raise SystemExit(
        f"ERROR: expected exactly one native ECharts background, found {bg_count}"
    )

js = js.replace(old_bg, new_bg, 1)

# Add a source marker beside the one deliberate chart option change.
js = js.replace(
    new_bg,
    (
        "/* MEMEFLOW_TRADING_CHART_RESTORE_SITE_BG_V2: "
        "match page background; render logic untouched */\n"
        "      backgroundColor:'#0f141a'"
    ),
    1,
)

# HTML marker + cache bust so iPhone Safari does not keep old trading.js.
html = html.replace(
    "</head>",
    "  <!-- MEMEFLOW_TRADING_CHART_RESTORE_SITE_BG_V2 -->\n</head>",
    1,
)

html, js_src_count = re.subn(
    r'src="/trading\.js(?:\?[^"]*)?"',
    'src="/trading.js?v=chart-restore-site-bg-v2"',
    html,
    count=1,
)

if js_src_count != 1:
    raise SystemExit(
        f"ERROR: expected exactly one /trading.js script reference, found {js_src_count}"
    )

# Clean whitespace.
def clean(text: str) -> str:
    return "\n".join(line.rstrip(" \t") for line in text.splitlines()) + "\n"

html = clean(html)
js = clean(js)

html_path.write_text(html, encoding="utf-8")
js_path.write_text(js, encoding="utf-8")

final_html = html_path.read_text(encoding="utf-8")
final_js = js_path.read_text(encoding="utf-8")

checks = {
    "old invasive style removed":
        'id="mfTradingChartTransparentBgV1"' not in final_html,
    "old invasive script removed":
        "window.__mfTradingChartTransparentBgV1" not in final_html,
    "old mutation observer removed":
        "data-mf-chart-bg-clear" not in final_html,
    "old dark ECharts bg removed":
        "backgroundColor:'#02070a'" not in final_js,
    "site ECharts bg installed":
        "backgroundColor:'#0f141a'" in final_js,
    "ECharts init preserved":
        "EC.init(" in final_js,
    "ECharts renderer preserved":
        "renderer:'canvas'" in final_js,
    "setOption preserved":
        "chartRuntime.api.setOption(" in final_js,
    "HTML marker installed":
        PATCH_ID in final_html,
    "JS marker installed":
        PATCH_ID in final_js,
    "cache bust":
        '/trading.js?v=chart-restore-site-bg-v2' in final_html,
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

print("V2 structural validation: PASS")
print("Removed old invasive transparent-background patch.")
print("Preserved ECharts init / setOption / canvas renderer.")
print("Changed exactly one native chart background:")
print("  #02070a -> #0f141a")
PY

# JS syntax must remain valid.
node --check "$JS"

# Git whitespace validation.
git -C "$ROOT" diff --check -- "${TARGETS[@]}"

echo
echo "Changed by this corrective patch:"
git -C "$ROOT" status --short -- "${TARGETS[@]}"
git -C "$ROOT" diff --stat -- "${TARGETS[@]}"

if [[ "$DO_PUSH" == "1" ]]; then
  git -C "$ROOT" add -- "${TARGETS[@]}"
  git -C "$ROOT" diff --cached --check

  EXPECTED="$(printf '%s\n' "${TARGETS[@]}" | sort)"
  ACTUAL="$(git -C "$ROOT" diff --cached --name-only | sort)"

  if [[ "$ACTUAL" != "$EXPECTED" ]]; then
    echo "ERROR: staged set differs from the exact two corrective files." >&2
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
    echo "ERROR: origin/$BRANCH changed while V2 was running." >&2
    echo "Validated commit remains local. No force-push attempted." >&2
    exit 1
  fi

  git -C "$ROOT" push origin "$BRANCH"

  echo
  echo "SUCCESS: chart restored and site background committed/pushed."
  echo "Commit: $(git -C "$ROOT" rev-parse HEAD)"
else
  echo
  echo "SUCCESS: chart restored locally (--no-push)."
fi

trap - EXIT

echo
echo "Result:"
echo "  - previous dangerous transparent-background patch is fully removed"
echo "  - candlestick rendering code remains untouched"
echo "  - ECharts canvas renderer remains untouched"
echo "  - chart background now matches site: #0f141a"
echo "  - no observers or blanket DOM/canvas background overrides remain"
echo "Backup: $BACKUP"
