#!/usr/bin/env bash
set -euo pipefail

# MEMEFLOW MODERN TERMINAL V4
# Refines the EXISTING canonical MF_UNIFIED_APP_THEME in place.
# No second theme block. No standalone override layer.
# No JS/API/chart/3D/trading-logic changes.

if [[ -d "memeflow-app" ]]; then
  APP="memeflow-app"
elif [[ -f "memeflow-brand.css" ]]; then
  APP="."
else
  echo "ERROR: Run from MEMEFLOW repository root or memeflow-app." >&2
  exit 1
fi

CSS="$APP/memeflow-brand.css"
INDEX="$APP/index.html"
SYSTEM="$APP/system.html"
TOKENS="$APP/system-tokens.html"
TRADING="$APP/trading.html"

for f in "$CSS" "$SYSTEM" "$TOKENS" "$TRADING"; do
  [[ -f "$f" ]] || { echo "ERROR: Missing $f" >&2; exit 1; }
done

BRANCH="$(git branch --show-current)"
if [[ "$BRANCH" != "main" ]]; then
  echo "ERROR: Current branch is '$BRANCH'. Switch to main first." >&2
  exit 1
fi

git fetch origin
LOCAL_HEAD="$(git rev-parse HEAD)"
REMOTE_HEAD="$(git rev-parse origin/main)"
if [[ "$LOCAL_HEAD" != "$REMOTE_HEAD" ]]; then
  echo "ERROR: main differs from origin/main; refusing to mix changes." >&2
  echo "Local : $LOCAL_HEAD" >&2
  echo "Remote: $REMOTE_HEAD" >&2
  exit 1
fi

TARGETS=("$CSS" "$SYSTEM" "$TOKENS" "$TRADING")
[[ -f "$INDEX" ]] && TARGETS+=("$INDEX")

if ! git diff --quiet -- "${TARGETS[@]}"; then
  echo "ERROR: A visual target file already has local edits:" >&2
  git status --short -- "${TARGETS[@]}"
  exit 1
fi

if ! git diff --cached --quiet -- "${TARGETS[@]}"; then
  echo "ERROR: A visual target file is already staged:" >&2
  git status --short -- "${TARGETS[@]}"
  exit 1
fi

STAGED_OTHER="$(git diff --cached --name-only || true)"
if [[ -n "$STAGED_OTHER" ]]; then
  echo "ERROR: Unrelated files are already staged. Unstage them first:" >&2
  printf '%s\n' "$STAGED_OTHER" >&2
  exit 1
fi

echo "main matches origin/main."
echo "Runtime/backup changes will be left untouched."

STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="/tmp/memeflow-modern-terminal-v4-$STAMP"
mkdir -p "$BACKUP"
for f in "${TARGETS[@]}"; do cp "$f" "$BACKUP"/; done
echo "Backup: $BACKUP"

python3 - "$CSS" "$SYSTEM" "$TOKENS" "$TRADING" "$INDEX" <<'PY'
from pathlib import Path
import re
import sys

css_path = Path(sys.argv[1])
html_paths = [Path(p) for p in sys.argv[2:] if Path(p).is_file()]

START = "/* MF_UNIFIED_APP_THEME_START */"
END = "/* MF_UNIFIED_APP_THEME_END */"
OLD_MARKERS = [
    "/* QUIET HIERARCHY STRUCTURAL SEPARATORS */",
    "/* MODERN TERMINAL REFINEMENTS V4 START */",
]

css = css_path.read_text(encoding="utf-8")
if css.count(START) != 1 or css.count(END) != 1:
    raise SystemExit(
        f"ERROR: canonical theme markers are not unique (start={css.count(START)}, end={css.count(END)})."
    )
if "MF_STANDALONE_MISSION_THEME_START" in css:
    raise SystemExit("ERROR: old standalone visual layer detected; refusing to stack styles.")

a = css.index(START)
b = css.index(END, a) + len(END)
prefix, theme, suffix = css[:a], css[a:b], css[b:]

# Normalize the theme label without requiring an exact previous version name.
theme = re.sub(
    r"/\* MEMEFLOW UNIFIED APP THEME[^\n]*",
    "/* MEMEFLOW UNIFIED APP THEME V4 · MODERN TERMINAL",
    theme,
    count=1,
)

# Remove the old refinement section if present, so we never build a layered cake.
for marker in OLD_MARKERS:
    if marker in theme:
        theme = re.sub(
            re.escape(marker) + r".*?(?=/\* MF_UNIFIED_APP_THEME_END \*/)",
            "",
            theme,
            count=1,
            flags=re.S,
        )

modern = r'''
/* MODERN TERMINAL REFINEMENTS V4 START */
/* One canonical theme block, refined in place. */

/* Calm the shell a little more and reduce "inflated mobile app" feeling. */
.shell>.topbar,
.system-shell .topbar,
.flow-header{
  padding:14px 16px!important;
  border-radius:14px!important;
}

.shell>.topbar .header-brand,
.system-shell .topbar .header-brand,
.flow-header .flow-brand{
  gap:12px!important;
}

.shell .hero-panel,
.shell .hero-card,
.system-shell .scene-title,
.flow-page .flow-hero{
  border-radius:16px!important;
  padding:18px 18px!important;
}

.shell .panel,
.system-shell .panel,
.flow-page .panel,
.shell .section-card,
.system-shell .scene-card,
.flow-page .flow-card,
.settings-group,
.settings-context,
.plan-card{
  border-radius:14px!important;
}

.shell .panel-head,
.system-shell .panel-head,
.flow-page .section-head,
.settings-group>summary{
  padding:16px 18px!important;
  min-height:auto!important;
}

.shell .panel-body,
.system-shell .panel-body,
.flow-page .section-body{
  padding:14px 18px!important;
}

/* Compact action rows and filter rows. */
.shell .timeframes,
.shell .indicator-scroll,
.shell .candidate-filter,
.flow-page .pager,
.flow-page .status-grid{
  gap:8px!important;
}

.shell .timeframes button,
.shell .indicator-scroll button,
.shell .candidate-filter button,
.flow-page .pager button,
.flow-page .search-row button,
.shell .topbar button,
.system-shell .topbar button,
.flow-header button{
  min-height:36px!important;
  padding:0 14px!important;
  border-radius:10px!important;
}

/* Make metrics read as one system row instead of many mini-cards. */
.shell .selected-metrics>div,
.system-shell .telemetry-item,
.flow-page .summary-card{
  min-height:auto!important;
  padding:14px 14px!important;
}

.shell .selected-metrics>div{
  background:transparent!important;
  border:0!important;
  border-right:1px solid rgba(145,166,190,.08)!important;
  border-radius:0!important;
}
.shell .selected-metrics>div:last-child{
  border-right:0!important;
}

.system-shell .telemetry-item{
  background:transparent!important;
  border:0!important;
}
.system-shell .telemetry-item:not(:last-child){
  border-right:1px solid rgba(145,166,190,.08)!important;
}

.flow-page .summary-card{
  border-radius:12px!important;
  background:rgba(255,255,255,.02)!important;
  border:1px solid rgba(145,166,190,.08)!important;
}

/* Token Flow rows: slightly tighter and less "card in card". */
.flow-page .flow-token{
  padding:12px 14px!important;
  border:0!important;
  border-radius:14px!important;
  background:rgba(255,255,255,.018)!important;
  box-shadow:none!important;
}

.flow-page .flow-token:hover{
  background:rgba(255,255,255,.028)!important;
}

/* Trading lists: cleaner terminal rows with separators, not bulky rounded cards. */
.shell .positions-list>*,
.shell .trade-history>*,
.shell .candidate-list>*,
.shell .approval-list>*{
  padding:14px 10px!important;
  background:transparent!important;
  border-left:0!important;
  border-right:0!important;
  border-top:0!important;
  border-bottom:1px solid rgba(145,166,190,.08)!important;
  border-radius:0!important;
  box-shadow:none!important;
}

.shell .positions-list>*:last-child,
.shell .trade-history>*:last-child,
.shell .candidate-list>*:last-child,
.shell .approval-list>*:last-child{
  border-bottom:0!important;
}

/* Keep strong CTA elements readable, but calm passive sub-blocks. */
.shell .price-block,
.shell .amount-box,
.shell .wallet-address,
.shell .live-warning,
.shell .token-avatar{
  border-radius:12px!important;
  box-shadow:none!important;
}

.shell .control-section{
  padding:14px 18px!important;
  border:0!important;
  border-top:1px solid rgba(145,166,190,.08)!important;
  border-radius:0!important;
  background:transparent!important;
}

.shell .control-section:first-of-type{
  border-top:0!important;
}

.shell .strategy-grid{
  gap:10px!important;
}

.shell .strategy-grid label,
.settings-summary>div,
.system-health-summary>div,
.wallet-stat,
.subscription-metric,
.data-row,
.toggle-row,
.mode-option label,
.profile-option label,
.setting-field input,
.setting-field select,
.shell input,
.shell select{
  border:0!important;
  border-radius:12px!important;
  background:rgba(255,255,255,.018)!important;
  box-shadow:none!important;
}

/* Settings and control surfaces should feel like one form, not many boxes. */
.settings-group,
.settings-context,
.plan-card,
.wallet-card,
.wallet-security,
.execution-readiness,
.primary-blocker,
.wallet-note,
.wallet-network{
  border-color:rgba(145,166,190,.10)!important;
  box-shadow:none!important;
}

/* Tone down uppercase utility text a little for a more premium look. */
.shell .eyebrow,
.system-shell .eyebrow,
.flow-page .eyebrow,
.shell .section-kicker,
.system-shell .section-kicker,
.flow-page .section-kicker{
  letter-spacing:.18em!important;
  opacity:.86!important;
}

/* Make inactive timeframe/filter chips quieter while preserving active state. */
.shell .timeframes button:not(.active):not([aria-pressed="true"]),
.shell .indicator-scroll button:not(.active):not([aria-pressed="true"]),
.shell .candidate-filter button:not(.active):not([aria-pressed="true"]){
  background:transparent!important;
  border-color:transparent!important;
  color:var(--mf-app-muted)!important;
}

/* Preserve chart/3D zones: do not touch canvas/svg layout. */
/* MODERN TERMINAL REFINEMENTS V4 END */
'''.strip()

theme = theme.replace(END, modern + "\n" + END, 1)
css2 = prefix + theme + suffix

if css2.count(START) != 1 or css2.count(END) != 1:
    raise SystemExit("ERROR: canonical theme count changed unexpectedly.")
if css2.count("MF_STANDALONE_MISSION_THEME_START") != 0:
    raise SystemExit("ERROR: independent standalone theme layer exists.")
if css2.count("/* MODERN TERMINAL REFINEMENTS V4 START */") != 1:
    raise SystemExit("ERROR: modern refinement section is not unique.")

css_path.write_text(css2, encoding="utf-8")

for path in html_paths:
    html = path.read_text(encoding="utf-8")
    html2, n = re.subn(
        r'href=(["\'])/memeflow-brand\.css(?:\?v=[^"\']+)?\1',
        lambda m: f'href={m.group(1)}/memeflow-brand.css?v=modern-terminal-v4{m.group(1)}',
        html,
        count=1,
    )
    if n == 1:
        path.write_text(html2, encoding="utf-8")
        print(f"Cache-busted {path}")
    elif path.name in {"system.html", "system-tokens.html", "trading.html"}:
        raise SystemExit(f"ERROR: memeflow-brand.css link not found in {path}")
    else:
        print(f"Note: no memeflow-brand.css link found in optional {path}; left unchanged.")

print("Canonical theme refined in place.")
PY

git diff --check -- "${TARGETS[@]}"

python3 - "$CSS" <<'PY'
from pathlib import Path
import sys
s = Path(sys.argv[1]).read_text(encoding="utf-8")
checks = {
    "MF_UNIFIED_APP_THEME_START": 1,
    "MF_UNIFIED_APP_THEME_END": 1,
    "MODERN TERMINAL REFINEMENTS V4 START": 1,
    "MF_STANDALONE_MISSION_THEME_START": 0,
}
for marker, expected in checks.items():
    actual = s.count(marker)
    if actual != expected:
        raise SystemExit(f"ERROR: {marker}: {actual}, expected {expected}")
print("Single-theme guardrails passed.")
PY

echo
echo "Changed visual files:"
git diff --stat -- "${TARGETS[@]}"

git add -- "${TARGETS[@]}"

if git diff --cached --quiet -- "${TARGETS[@]}"; then
  echo "No visual changes to commit."
else
  echo
  echo "Staged files only:"
  git diff --cached --name-only
  git commit -m "Modernize canonical Mission Control terminal UI" -- "${TARGETS[@]}"
fi

git push origin main

echo
echo "DONE — modern terminal refinements applied inside ONE canonical Mission Control theme."
echo "No second visual theme layer was created."
