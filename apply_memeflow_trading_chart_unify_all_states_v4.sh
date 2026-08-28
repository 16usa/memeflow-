#!/usr/bin/env bash
set -Eeuo pipefail

PATCH_ID="MEMEFLOW_TRADING_CHART_UNIFY_ALL_STATES_V4"
COMMIT_MESSAGE="Unify trading chart background across all states"
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
echo "MEMEFLOW Trading Chart Unify All States V4"
echo "Goal: the chart area should use the SAME panel color in all states:"
echo "  - live candles"
echo "  - syncing real trades"
echo "  - select a candidate / empty state"
echo
echo "This patch DOES NOT touch chart rendering logic."
echo "It only normalizes the chart-area background presentation."
echo

grep -Fq "backgroundColor:'#131b23'" "$JS" || {
  echo "ERROR: expected current ECharts panel background #131b23 not found in trading.js." >&2
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
TARGETS=("$REL_HTML")

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
BACKUP="$ROOT/.patch-backups/trading-chart-unify-all-states-v4-$STAMP"
mkdir -p "$BACKUP"
cp -p "$HTML" "$BACKUP"/
echo "Backup: $BACKUP"

restore_on_error() {
  local rc=$?
  if [[ $rc -ne 0 ]]; then
    echo
    echo "Patch failed; restoring exact pre-patch file..."
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
import re

html_path = Path(os.environ["MF_TRADING_HTML"])
html = html_path.read_text(encoding="utf-8")

PATCH_ID = "MEMEFLOW_TRADING_CHART_UNIFY_ALL_STATES_V4"

if PATCH_ID in html:
    raise SystemExit("ERROR: partial V4 marker already exists")

STYLE_BLOCK = r'''
<style id="mfTradingChartUnifyAllStatesV4">
/* ===== MEMEFLOW_TRADING_CHART_UNIFY_ALL_STATES_V4 ===== */
/*
  The trading chart should feel like one unified panel in all states.
  We use the exact panel surface color already chosen for the live chart.
  This is presentation only. No chart rendering logic is touched.
*/
html[data-mf-chart-unify-all-states="1"] {
  --mf-chart-panel-bg: #131b23;
}

html[data-mf-chart-unify-all-states="1"] #chartCanvas,
html[data-mf-chart-unify-all-states="1"] #chartCanvas > div,
html[data-mf-chart-unify-all-states="1"] [data-mf-chart-unified="1"],
html[data-mf-chart-unify-all-states="1"] [data-mf-chart-placeholder="1"] {
  background: var(--mf-chart-panel-bg) !important;
  background-color: var(--mf-chart-panel-bg) !important;
}
/* ===== /MEMEFLOW_TRADING_CHART_UNIFY_ALL_STATES_V4 ===== */
</style>
'''

SCRIPT_BLOCK = r'''
<script>
/* ===== MEMEFLOW_TRADING_CHART_UNIFY_ALL_STATES_V4 ===== */
(() => {
  if (window.__mfTradingChartUnifyAllStatesV4) return;
  window.__mfTradingChartUnifyAllStatesV4 = true;
  document.documentElement.setAttribute('data-mf-chart-unify-all-states', '1');

  const BG = '#131b23';
  const STATE_MATCHERS = [
    /syncing real trades/i,
    /live candles/i,
    /select a token/i,
    /candles use confirmed buy\s*\/\s*sell events only/i,
    /history and the live pump trade stream reconnect automatically/i,
    /tap the top-right value to switch usd price \/ market cap/i
  ];

  const paint = (node, kind = 'unified') => {
    if (!(node instanceof HTMLElement)) return;
    node.style.background = BG;
    node.style.backgroundColor = BG;
    if (kind === 'placeholder') {
      node.setAttribute('data-mf-chart-placeholder', '1');
    } else {
      node.setAttribute('data-mf-chart-unified', '1');
    }
  };

  const normalizeChartArea = () => {
    const chartHost = document.getElementById('chartCanvas');

    if (chartHost instanceof HTMLElement) {
      paint(chartHost);
      if (chartHost.parentElement instanceof HTMLElement) paint(chartHost.parentElement);
      if (chartHost.parentElement?.parentElement instanceof HTMLElement) {
        paint(chartHost.parentElement.parentElement);
      }
      chartHost.querySelectorAll(':scope > div').forEach((child) => {
        if (child instanceof HTMLElement) paint(child);
      });
    }

    const all = Array.from(document.querySelectorAll('div, section, article'));
    for (const el of all) {
      if (!(el instanceof HTMLElement)) continue;
      const text = (el.textContent || '').replace(/\s+/g, ' ').trim();
      if (!text) continue;
      if (!STATE_MATCHERS.some((rx) => rx.test(text))) continue;

      let target = el;
      for (let i = 0; i < 5; i += 1) {
        const rect = target.getBoundingClientRect();
        if (rect.width >= 240 && rect.height >= 180) break;
        if (!(target.parentElement instanceof HTMLElement)) break;
        target = target.parentElement;
      }

      paint(target, 'placeholder');
      paint(el, 'placeholder');
    }
  };

  const run = () => {
    normalizeChartArea();
    setTimeout(normalizeChartArea, 250);
    setTimeout(normalizeChartArea, 1200);
    setTimeout(normalizeChartArea, 2600);
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run, { once: true });
  } else {
    run();
  }

  window.addEventListener('load', run, { once: true });
})();
/* ===== /MEMEFLOW_TRADING_CHART_UNIFY_ALL_STATES_V4 ===== */
</script>
'''

if STYLE_BLOCK in html or SCRIPT_BLOCK in html:
    raise SystemExit("ERROR: one of the V4 blocks already exists")

head_match = re.search(r'</head>', html, flags=re.I)
if not head_match:
    raise SystemExit("ERROR: could not find </head>")

html = html[:head_match.start()] + STYLE_BLOCK + "\n" + html[head_match.start():]

body_match = re.search(r'</body>', html, flags=re.I)
if not body_match:
    raise SystemExit("ERROR: could not find </body>")

html = html[:body_match.start()] + SCRIPT_BLOCK + "\n" + html[body_match.start():]

html = "\n".join(line.rstrip(" \t") for line in html.splitlines()) + "\n"
html_path.write_text(html, encoding="utf-8")

final_html = html_path.read_text(encoding="utf-8")
checks = {
    "style block": 'id="mfTradingChartUnifyAllStatesV4"' in final_html,
    "script block": "window.__mfTradingChartUnifyAllStatesV4" in final_html,
    "document marker": 'data-mf-chart-unify-all-states' in final_html,
    "shared bg": "--mf-chart-panel-bg: #131b23;" in final_html,
    "state matcher live candles": "live candles" in final_html.lower(),
    "state matcher syncing": "syncing real trades" in final_html.lower(),
}
failed = [name for name, ok in checks.items() if not ok]
if failed:
    raise SystemExit("ERROR: validation failed: " + ", ".join(failed))

bad = [
    i for i, line in enumerate(final_html.splitlines(), start=1)
    if line.endswith((" ", "\t"))
]
if bad:
    raise SystemExit(f"ERROR: trailing whitespace remains: {bad[:10]}")

print("V4 validation: PASS")
print("This patch only adds a small presentation layer in trading.html.")
print("No trading.js rendering logic is modified.")
PY

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
    echo "ERROR: staged set differs from the exact V4 file." >&2
    git -C "$ROOT" reset -- "${TARGETS[@]}" >/dev/null 2>&1 || true
    exit 1
  fi

  git -C "$ROOT" commit -m "$COMMIT_MESSAGE"

  git -C "$ROOT" fetch origin "$BRANCH"

  if [[ "$(git -C "$ROOT" rev-parse HEAD^)" != "$(git -C "$ROOT" rev-parse "origin/$BRANCH")" ]]; then
    echo "ERROR: origin/$BRANCH changed while V4 was running." >&2
    echo "Validated commit remains local. No force-push attempted." >&2
    exit 1
  fi

  git -C "$ROOT" push origin "$BRANCH"

  echo
  echo "SUCCESS: trading chart background is unified in all states and pushed."
  echo "Commit: $(git -C "$ROOT" rev-parse HEAD)"
else
  echo
  echo "SUCCESS: V4 installed locally (--no-push)."
fi

trap - EXIT

echo
echo "Result:"
echo "  - live candles state uses the same chart panel color"
echo "  - syncing state uses the same chart panel color"
echo "  - empty / select-token state uses the same chart panel color"
echo "  - no chart rendering logic was changed"
echo "Backup: $BACKUP"
