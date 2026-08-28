#!/usr/bin/env bash
set -Eeuo pipefail

PATCH_ID="MEMEFLOW_TRADING_CHART_TRANSPARENT_BG_V1"
COMMIT_MESSAGE="Remove dark chart background from trading terminal"
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

TRADING_HTML=""
for candidate in \
  "$APP/trading.html" \
  "$APP/trading-terminal.html" \
  "$APP/terminal.html" \
  "$APP/index.html"
do
  if [[ -f "$candidate" ]]; then
    if grep -qi "trading terminal\|connect wallet\|paper auto active\|pending approvals" "$candidate"; then
      TRADING_HTML="$candidate"
      break
    fi
  fi
done

if [[ -z "$TRADING_HTML" ]]; then
  echo "ERROR: could not locate the Trading Terminal HTML file." >&2
  exit 1
fi

echo
echo "MEMEFLOW Trading Chart Transparent Background V1"
echo "Goal: remove the dark/black chart plot background on Trading Terminal."
echo "Target: $TRADING_HTML"
echo

grep -Fq "MEMEFLOW" "$TRADING_HTML" || {
  echo "ERROR: selected HTML file does not look like the terminal page." >&2
  exit 1
}

if grep -Fq "$PATCH_ID" "$TRADING_HTML"; then
  echo "Already installed: $PATCH_ID"
  exit 0
fi

BRANCH="$(git -C "$ROOT" branch --show-current)"
[[ -n "$BRANCH" ]] || { echo "ERROR: detached HEAD." >&2; exit 1; }

REL_TRADING_HTML="${TRADING_HTML#"$ROOT"/}"
TARGETS=("$REL_TRADING_HTML")

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
BACKUP="$ROOT/.patch-backups/trading-chart-transparent-bg-v1-$STAMP"
mkdir -p "$BACKUP"
cp -p "$TRADING_HTML" "$BACKUP"/
echo "Backup: $BACKUP"

restore_on_error() {
  local rc=$?
  if [[ $rc -ne 0 ]]; then
    echo
    echo "Patch failed; restoring exact pre-patch file..."
    cp -p "$BACKUP/$(basename "$TRADING_HTML")" "$TRADING_HTML"
    echo "Rollback complete."
  fi
  exit "$rc"
}
trap restore_on_error EXIT

export MF_TRADING_HTML="$TRADING_HTML"

python3 <<'PY'
from pathlib import Path
import os
import re

html_path = Path(os.environ["MF_TRADING_HTML"])
html = html_path.read_text(encoding="utf-8")
PATCH_ID = "MEMEFLOW_TRADING_CHART_TRANSPARENT_BG_V1"

if PATCH_ID in html:
    raise SystemExit("ERROR: partial patch marker already exists")

STYLE_BLOCK = r'''
<style id="mfTradingChartTransparentBgV1">
/* ===== MEMEFLOW_TRADING_CHART_TRANSPARENT_BG_V1 ===== */
/*
  Remove the dark/black plot background inside the Trading Terminal chart.
  Scope is intentionally narrow:
  - only on pages marked by <html data-mf-chart-bg-clear="1">
  - only for likely chart containers/canvases
*/
html[data-mf-chart-bg-clear="1"] {
  --mf-chart-transparent: transparent;
}

html[data-mf-chart-bg-clear="1"] .tv-lightweight-charts,
html[data-mf-chart-bg-clear="1"] .tv-lightweight-charts > div,
html[data-mf-chart-bg-clear="1"] .klinecharts,
html[data-mf-chart-bg-clear="1"] .klinecharts-pro,
html[data-mf-chart-bg-clear="1"] .chart-wrap,
html[data-mf-chart-bg-clear="1"] .chart-shell,
html[data-mf-chart-bg-clear="1"] .chart-area,
html[data-mf-chart-bg-clear="1"] .chart-stage,
html[data-mf-chart-bg-clear="1"] .chart-surface,
html[data-mf-chart-bg-clear="1"] .chart-panel,
html[data-mf-chart-bg-clear="1"] .chart-container,
html[data-mf-chart-bg-clear="1"] .chart-viewport,
html[data-mf-chart-bg-clear="1"] .terminal-chart,
html[data-mf-chart-bg-clear="1"] .trade-chart,
html[data-mf-chart-bg-clear="1"] .price-chart,
html[data-mf-chart-bg-clear="1"] .candles,
html[data-mf-chart-bg-clear="1"] [data-chart-root],
html[data-mf-chart-bg-clear="1"] [data-mf-chart-bg-target] {
  background: transparent !important;
  background-color: transparent !important;
}

html[data-mf-chart-bg-clear="1"] [data-mf-chart-bg-target] canvas,
html[data-mf-chart-bg-clear="1"] [data-mf-chart-bg-target] svg,
html[data-mf-chart-bg-clear="1"] [data-mf-chart-bg-target] table,
html[data-mf-chart-bg-clear="1"] [data-mf-chart-bg-target] div {
  background-color: transparent !important;
}
/* ===== /MEMEFLOW_TRADING_CHART_TRANSPARENT_BG_V1 ===== */
</style>
'''

SCRIPT_BLOCK = r'''
<script>
/* ===== MEMEFLOW_TRADING_CHART_TRANSPARENT_BG_V1 ===== */
(() => {
  if (window.__mfTradingChartTransparentBgV1) return;
  window.__mfTradingChartTransparentBgV1 = true;
  document.documentElement.setAttribute('data-mf-chart-bg-clear', '1');

  const transparentChartOptions = (options = {}) => {
    const layout = options.layout || {};
    const background = layout.background || {};
    return {
      ...options,
      layout: {
        ...layout,
        background: {
          ...background,
          color: 'transparent',
        },
      },
    };
  };

  const clearElement = (node) => {
    if (!node || !(node instanceof HTMLElement)) return;
    node.dataset.mfChartBgTarget = '1';
    node.style.background = 'transparent';
    node.style.backgroundColor = 'transparent';
  };

  const likelyChartRoot = (node) => {
    if (!(node instanceof HTMLElement)) return false;
    const idClass = `${node.id || ''} ${node.className || ''}`.toLowerCase();

    if (
      /chart|candle|kline|tradingview|lightweight/.test(idClass) ||
      node.hasAttribute('data-chart-root')
    ) {
      return node.querySelector('canvas,svg') !== null || node.tagName === 'CANVAS';
    }

    return false;
  };

  const clearChartRoots = (root = document) => {
    const selectors = [
      '.tv-lightweight-charts',
      '.klinecharts',
      '.klinecharts-pro',
      '.chart-wrap',
      '.chart-shell',
      '.chart-area',
      '.chart-stage',
      '.chart-surface',
      '.chart-panel',
      '.chart-container',
      '.chart-viewport',
      '.terminal-chart',
      '.trade-chart',
      '.price-chart',
      '.candles',
      '[data-chart-root]',
      '[id*="chart"]',
      '[class*="chart"]',
      '[id*="candle"]',
      '[class*="candle"]',
      '[id*="kline"]',
      '[class*="kline"]'
    ];

    const seen = new Set();

    root.querySelectorAll(selectors.join(',')).forEach((node) => {
      if (!(node instanceof HTMLElement)) return;
      if (seen.has(node)) return;
      if (!likelyChartRoot(node)) return;
      seen.add(node);
      clearElement(node);
      node.querySelectorAll('canvas, svg, table, div').forEach((child) => {
        if (!(child instanceof HTMLElement)) return;
        child.style.backgroundColor = 'transparent';
      });
    });

    // As an extra safety net, clear large canvases inside the main content.
    root.querySelectorAll('canvas').forEach((canvas) => {
      if (!(canvas instanceof HTMLCanvasElement)) return;
      const rect = canvas.getBoundingClientRect();
      if (rect.width >= 240 && rect.height >= 180) {
        canvas.style.backgroundColor = 'transparent';
        const host = canvas.parentElement;
        if (host) clearElement(host);
      }
    });
  };

  const patchLightweightCharts = () => {
    const lib = window.LightweightCharts;
    if (!lib || typeof lib.createChart !== 'function' || lib.__mfBgPatched) return;
    const originalCreateChart = lib.createChart.bind(lib);

    lib.createChart = function(container, options = {}) {
      const chart = originalCreateChart(container, transparentChartOptions(options));
      requestAnimationFrame(() => {
        if (container instanceof HTMLElement) clearElement(container);
        clearChartRoots(document);
        try {
          if (chart && typeof chart.applyOptions === 'function') {
            chart.applyOptions(transparentChartOptions({}));
          }
        } catch (_) {}
      });
      return chart;
    };

    lib.__mfBgPatched = true;
  };

  const tryPatchKnownCharts = () => {
    patchLightweightCharts();

    // Try to update already-created chart instances that expose applyOptions().
    Object.keys(window).forEach((key) => {
      let value;
      try { value = window[key]; } catch (_) { return; }
      if (!value || typeof value !== 'object') return;
      if (typeof value.applyOptions !== 'function') return;

      const looksLikeChart =
        typeof value.timeScale === 'function' ||
        typeof value.priceScale === 'function' ||
        typeof value.subscribeCrosshairMove === 'function';

      if (!looksLikeChart) return;

      try {
        value.applyOptions(transparentChartOptions({}));
      } catch (_) {}
    });
  };

  const boot = () => {
    clearChartRoots(document);
    tryPatchKnownCharts();

    const observer = new MutationObserver((mutations) => {
      let needsRefresh = false;
      for (const mutation of mutations) {
        if (mutation.type === 'childList' && mutation.addedNodes.length) {
          needsRefresh = true;
          break;
        }
        if (mutation.type === 'attributes') {
          needsRefresh = true;
          break;
        }
      }
      if (needsRefresh) {
        clearChartRoots(document);
        tryPatchKnownCharts();
      }
    });

    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'style', 'id']
    });

    window.addEventListener('load', () => {
      clearChartRoots(document);
      tryPatchKnownCharts();
      setTimeout(() => {
        clearChartRoots(document);
        tryPatchKnownCharts();
      }, 350);
      setTimeout(() => {
        clearChartRoots(document);
        tryPatchKnownCharts();
      }, 1200);
    }, { once: true });
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
/* ===== /MEMEFLOW_TRADING_CHART_TRANSPARENT_BG_V1 ===== */
</script>
'''

# Inject the style into <head>.
if STYLE_BLOCK in html or SCRIPT_BLOCK in html:
    raise SystemExit("ERROR: one of the patch blocks already exists")

head_match = re.search(r'</head>', html, flags=re.IGNORECASE)
if not head_match:
    raise SystemExit("ERROR: could not find </head> in trading HTML")

html = html[:head_match.start()] + STYLE_BLOCK + "\n" + html[head_match.start():]

# Inject the script near the end of the document.
body_match = re.search(r'</body>', html, flags=re.IGNORECASE)
if not body_match:
    raise SystemExit("ERROR: could not find </body> in trading HTML")

html = html[:body_match.start()] + SCRIPT_BLOCK + "\n" + html[body_match.start():]

# Clean trailing whitespace.
html = "\n".join(line.rstrip(" \t") for line in html.splitlines()) + "\n"
html_path.write_text(html, encoding="utf-8")

final_html = html_path.read_text(encoding="utf-8")
checks = {
    "style block installed": 'id="mfTradingChartTransparentBgV1"' in final_html,
    "script block installed": "window.__mfTradingChartTransparentBgV1" in final_html,
    "html marker": 'data-mf-chart-bg-clear' in final_html,
    "transparent options": "background: {\n          ...background,\n          color: 'transparent'," in final_html,
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

print("Trading Chart Transparent Background V1 validation: PASS")
print("Installed into:", html_path)
print("Behavior:")
print("  - clears dark/black plot background from likely chart containers")
print("  - patches Lightweight Charts createChart() to use transparent layout")
print("  - retries after load and on DOM mutations")
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
    echo "ERROR: staged set differs from the exact terminal HTML file." >&2
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
    echo "ERROR: origin/$BRANCH changed while this patch was running." >&2
    echo "Validated commit remains local. No force-push attempted." >&2
    exit 1
  fi

  git -C "$ROOT" push origin "$BRANCH"

  echo
  echo "SUCCESS: trading chart background patch committed and pushed."
  echo "Commit: $(git -C "$ROOT" rev-parse HEAD)"
else
  echo
  echo "SUCCESS: trading chart background patch installed locally (--no-push)."
fi

trap - EXIT

echo
echo "Result:"
echo "  - dark/black chart background is cleared on Trading Terminal"
echo "  - likely chart wrappers and canvases become transparent"
echo "  - Lightweight Charts is patched to use transparent layout background"
echo "  - all trading logic remains untouched"
echo "Backup: $BACKUP"
