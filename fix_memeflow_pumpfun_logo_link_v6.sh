#!/usr/bin/env bash
set -Eeuo pipefail

PATCH_ID="MEMEFLOW_PUMPFUN_LOGO_LINK_V6"
REVIEWED_HEAD="c111883c37eb3b8101b98e088de4bd515261b513"
DO_PUSH=1

for arg in "$@"; do
  case "$arg" in
    --no-push) DO_PUSH=0 ;;
    --push) DO_PUSH=1 ;;
    *)
      echo "Unknown argument: $arg" >&2
      echo "Usage: $0 [--push|--no-push]" >&2
      exit 2
      ;;
  esac
done

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
if [[ -z "$ROOT" ]]; then
  echo "ERROR: run this script inside the MEMEFLOW git repository." >&2
  exit 1
fi

APP="$ROOT/memeflow-app"
JS="$APP/system-tokens.js"
CSS="$APP/system-tokens.css"
HTML="$APP/system-tokens.html"

for f in "$JS" "$CSS" "$HTML"; do
  [[ -f "$f" ]] || { echo "ERROR: missing $f" >&2; exit 1; }
done

CURRENT_HEAD="$(git -C "$ROOT" rev-parse HEAD)"
echo "MEMEFLOW Pump.fun official logo link v6"
echo "Reviewed main: $REVIEWED_HEAD"
echo "Current HEAD : $CURRENT_HEAD"

# Required current architecture.
grep -Fq 'class="token-source-link pump"' "$JS" || {
  echo "ERROR: current Pump.fun link template not found." >&2
  exit 1
}
grep -Fq '.token-source-link.pump{' "$CSS" || {
  echo "ERROR: current Pump.fun source-link styles not found." >&2
  exit 1
}
grep -Fq 'src="/system-tokens.js?v=open-pnl-live-v5"' "$HTML" || {
  echo "ERROR: expected current JS cache marker is missing." >&2
  exit 1
}

if grep -Fq "$PATCH_ID" "$JS" || grep -Fq "$PATCH_ID" "$CSS"; then
  echo "Already installed: $PATCH_ID"
  exit 0
fi

# Never overwrite unrelated work.
if ! git -C "$ROOT" diff --quiet -- \
  memeflow-app/system-tokens.js \
  memeflow-app/system-tokens.css \
  memeflow-app/system-tokens.html \
  || ! git -C "$ROOT" diff --cached --quiet -- \
  memeflow-app/system-tokens.js \
  memeflow-app/system-tokens.css \
  memeflow-app/system-tokens.html
then
  echo "ERROR: target files have uncommitted/staged changes." >&2
  echo "Commit or stash them first. Nothing was modified." >&2
  exit 1
fi

STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP_DIR="$ROOT/.patch-backups/pumpfun-logo-link-v6-$STAMP"
mkdir -p "$BACKUP_DIR"
cp "$JS" "$BACKUP_DIR/system-tokens.js"
cp "$CSS" "$BACKUP_DIR/system-tokens.css"
cp "$HTML" "$BACKUP_DIR/system-tokens.html"

rollback() {
  local rc=$?
  if [[ $rc -ne 0 ]]; then
    echo
    echo "Patch failed. Restoring files..."
    cp "$BACKUP_DIR/system-tokens.js" "$JS"
    cp "$BACKUP_DIR/system-tokens.css" "$CSS"
    cp "$BACKUP_DIR/system-tokens.html" "$HTML"
    echo "Rollback complete."
  fi
  exit "$rc"
}
trap rollback EXIT

export MF_JS="$JS"
export MF_CSS="$CSS"
export MF_HTML="$HTML"
export MF_PATCH_ID="$PATCH_ID"

python3 <<'PY'
from pathlib import Path
import os

js_path = Path(os.environ["MF_JS"])
css_path = Path(os.environ["MF_CSS"])
html_path = Path(os.environ["MF_HTML"])
PATCH_ID = os.environ["MF_PATCH_ID"]

js = js_path.read_text(encoding="utf-8")
css = css_path.read_text(encoding="utf-8")
html = html_path.read_text(encoding="utf-8")

def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise SystemExit(
            f"PRECHECK FAILED [{label}]: expected exactly 1 match, found {count}. "
            "No partial patch will be kept."
        )
    return text.replace(old, new, 1)

old_pump = """  if (links.pump) {
    out.push(`
      <a class="token-source-link pump" href="${escapeHtml(links.pump)}" target="_blank"
         rel="noopener noreferrer" aria-label="Open on Pump.fun" title="Pump.fun">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M6 16V8h7.2a3.8 3.8 0 010 7.6H9.7"></path>
          <path d="M16.8 8.7H20v3.2"></path>
          <path d="M19.7 9l-3.8 3.8"></path>
        </svg>
      </a>`);
  }"""

new_pump = f"""  if (links.pump) {{
    out.push(`
      <!-- {PATCH_ID} -->
      <a
        class="token-source-link pump mf-pump-logo-link"
        href="${{escapeHtml(links.pump)}}"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Open token on Pump.fun"
        title="Open on Pump.fun"
      >
        <img
          class="mf-pump-logo"
          src="https://pump.fun/pump-logomark.svg"
          alt=""
          loading="lazy"
          decoding="async"
          referrerpolicy="no-referrer"
        >
      </a>`);
  }}"""

js = replace_once(js, old_pump, new_pump, "pump-link-template")

css_patch = f"""
/* {PATCH_ID}
 * Pump.fun is represented by the official Pump logomark.
 * The mark itself is the click target: no button frame, no tile background.
 */
.token-source-link.pump.mf-pump-logo-link {{
  width: 24px;
  height: 24px;
  min-width: 24px;

  display: inline-grid;
  place-items: center;

  padding: 0;
  margin: 0;

  border: 0 !important;
  border-radius: 0 !important;
  outline: 0;

  background: transparent !important;
  box-shadow: none !important;

  color: inherit;
  overflow: visible;

  transform: none;
}}

.token-source-link.pump.mf-pump-logo-link:hover {{
  border: 0 !important;
  background: transparent !important;
  box-shadow: none !important;
}}

.token-source-link.pump.mf-pump-logo-link:active {{
  transform: scale(.92);
}}

.mf-pump-logo {{
  width: 21px;
  height: 21px;

  display: block;

  object-fit: contain;
  object-position: center;

  border: 0;
  border-radius: 0;
  background: transparent;

  pointer-events: none;
  user-select: none;
  -webkit-user-drag: none;
}}

@media (max-width: 760px) {{
  .token-source-link.pump.mf-pump-logo-link {{
    width: 22px !important;
    height: 22px !important;
    min-width: 22px !important;

    border: 0 !important;
    border-radius: 0 !important;
    background: transparent !important;
  }}

  .mf-pump-logo {{
    width: 19px;
    height: 19px;
  }}
}}

@media (max-width: 390px) {{
  .token-source-link.pump.mf-pump-logo-link {{
    width: 21px !important;
    height: 21px !important;
    min-width: 21px !important;
  }}

  .mf-pump-logo {{
    width: 18px;
    height: 18px;
  }}
}}
"""

if PATCH_ID in css:
    raise SystemExit("PRECHECK FAILED [css]: patch marker already exists unexpectedly.")

css = css.rstrip() + "\n\n" + css_patch.strip() + "\n"

# Cache-bust only the files changed by this visual patch.
html = replace_once(
    html,
    'href="/system-tokens.css?v=all-market-metrics-v4"',
    'href="/system-tokens.css?v=pumpfun-logo-v6"',
    "css-cache"
)
html = replace_once(
    html,
    'src="/system-tokens.js?v=open-pnl-live-v5"',
    'src="/system-tokens.js?v=pumpfun-logo-v6"',
    "js-cache"
)

# Post-checks.
required_js = [
    PATCH_ID,
    'class="token-source-link pump mf-pump-logo-link"',
    'src="https://pump.fun/pump-logomark.svg"',
    'aria-label="Open token on Pump.fun"',
]
for marker in required_js:
    if marker not in js:
        raise SystemExit(f"POSTCHECK FAILED [js]: missing {marker!r}")

# The old hand-drawn Pump icon must be gone.
for stale in [
    '<path d="M6 16V8h7.2a3.8 3.8 0 010 7.6H9.7"></path>',
    '<path d="M16.8 8.7H20v3.2"></path>',
]:
    if stale in js:
        raise SystemExit(f"POSTCHECK FAILED [js]: stale generic Pump icon remains: {stale}")

required_css = [
    PATCH_ID,
    ".token-source-link.pump.mf-pump-logo-link",
    "border: 0 !important;",
    "background: transparent !important;",
    ".mf-pump-logo",
]
for marker in required_css:
    if marker not in css:
        raise SystemExit(f"POSTCHECK FAILED [css]: missing {marker!r}")

if html.count("pumpfun-logo-v6") != 2:
    raise SystemExit("POSTCHECK FAILED [html]: cache markers missing.")

js_path.write_text(js, encoding="utf-8")
css_path.write_text(css, encoding="utf-8")
html_path.write_text(html, encoding="utf-8")
PY

echo
echo "[1/4] Frontend JavaScript syntax..."
node --check "$JS"

echo "[2/4] Patch invariants..."
python3 <<'PY'
from pathlib import Path
import os

js = Path(os.environ["MF_JS"]).read_text(encoding="utf-8")
css = Path(os.environ["MF_CSS"]).read_text(encoding="utf-8")
html = Path(os.environ["MF_HTML"]).read_text(encoding="utf-8")
patch = os.environ["MF_PATCH_ID"]

checks = {
    "JS marker": js.count(patch) == 1,
    "CSS marker": css.count(patch) == 1,
    "official Pump logomark": "https://pump.fun/pump-logomark.svg" in js,
    "Pump token link preserved": 'href="${escapeHtml(links.pump)}"' in js,
    "new-tab behavior preserved": 'target="_blank"' in js,
    "no Pump frame": (
        ".token-source-link.pump.mf-pump-logo-link" in css
        and "border: 0 !important;" in css
        and "background: transparent !important;" in css
    ),
    "old generic Pump SVG removed": "M6 16V8h7.2a3.8" not in js,
    "cache bust": html.count("pumpfun-logo-v6") == 2,
    "P&L v5 preserved": "MEMEFLOW_OPEN_PNL_LIVE_MARK_V5" in js,
    "market metrics v4 preserved": "MEMEFLOW_ALL_TOKEN_MARKET_METRICS_V4" in js,
}
failed = [name for name, ok in checks.items() if not ok]
if failed:
    raise SystemExit("Invariant check failed: " + ", ".join(failed))
print("  OK:", ", ".join(checks))
PY

echo "[3/4] Git whitespace/conflict check..."
git -C "$ROOT" diff --check -- \
  memeflow-app/system-tokens.js \
  memeflow-app/system-tokens.css \
  memeflow-app/system-tokens.html

echo "[4/4] MEMEFLOW test suite..."
(
  cd "$APP"
  npm test
)

trap - EXIT

echo
echo "Patch validated successfully."
echo "Backup: ${BACKUP_DIR#$ROOT/}"
echo
git -C "$ROOT" --no-pager diff --stat -- \
  memeflow-app/system-tokens.js \
  memeflow-app/system-tokens.css \
  memeflow-app/system-tokens.html

git -C "$ROOT" add -- \
  memeflow-app/system-tokens.js \
  memeflow-app/system-tokens.css \
  memeflow-app/system-tokens.html

if ! git -C "$ROOT" diff --cached --quiet; then
  git -C "$ROOT" commit -m "fix(token-flow): use clean Pump.fun logo link"
fi

if [[ "$DO_PUSH" -eq 1 ]]; then
  echo
  echo "Pushing validated commit..."
  if git -C "$ROOT" remote get-url origin >/dev/null 2>&1; then
    if ! git -C "$ROOT" push; then
      echo "WARNING: patch installed and committed, but push failed." >&2
      echo "Retry with: git push" >&2
    fi
  else
    echo "WARNING: origin remote not found; commit is local." >&2
  fi
fi

echo
echo "DONE:"
echo "  Pump.fun now uses the official Pump logomark."
echo "  The logo has no border, tile, or background."
echo "  The logo itself remains the clickable link to the token on Pump.fun."
echo "  DexScreener and all trading/P&L/market-metric logic are unchanged."
