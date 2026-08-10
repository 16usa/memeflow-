#!/usr/bin/env bash
set -euo pipefail

ROOT="${1:-${PROJECT_ROOT:-.}}"

if [[ -f "$ROOT/memeflow-app/index.html" ]]; then
  TARGET="$ROOT/memeflow-app/index.html"
elif [[ -f "$ROOT/index.html" ]]; then
  TARGET="$ROOT/index.html"
else
  echo "ERROR: memeflow-app/index.html not found. Run from ~/workspace."
  exit 1
fi

BACKUP_DIR="$(dirname "$TARGET")/.memeflow-patches/ai-analysis-clean-chevron"
mkdir -p "$BACKUP_DIR"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="$BACKUP_DIR/index.html.$STAMP.bak"
cp "$TARGET" "$BACKUP"
printf '%s\n' "$BACKUP" > "$BACKUP_DIR/latest-backup.txt"

python3 - "$TARGET" <<'PY'
from pathlib import Path
import re, sys

path = Path(sys.argv[1])
src = path.read_text(encoding='utf-8')

# 1) Remove every previous assistant AI-button runtime patch completely.
marker_pairs = [
    ('<!-- MF_AI_VIEW_CHECKS_PATCH:START -->', '<!-- MF_AI_VIEW_CHECKS_PATCH:END -->'),
    ('<!-- MF_AI_SINGLE_CHEVRON_PATCH:START -->', '<!-- MF_AI_SINGLE_CHEVRON_PATCH:END -->'),
    ('<!-- MF_AI_EXACT_CHEVRON_PATCH:START -->', '<!-- MF_AI_EXACT_CHEVRON_PATCH:END -->'),
]
for start, end in marker_pairs:
    src = re.sub(re.escape(start) + r'.*?' + re.escape(end) + r'\s*', '', src, flags=re.S)

# Defensive cleanup if a marker was ever partially lost.
for style_id in (
    'mf-ai-analysis-view-checks-style',
    'mf-ai-single-chevron-style',
    'mf-ai-exact-chevron-css',
):
    src = re.sub(
        rf'<style\b[^>]*id=["\']{re.escape(style_id)}["\'][^>]*>.*?</style>\s*',
        '', src, flags=re.S | re.I
    )
for script_id in (
    'mf-ai-analysis-view-checks-script',
    'mf-ai-single-chevron-script',
    'mf-ai-exact-chevron-js',
):
    src = re.sub(
        rf'<script\b[^>]*id=["\']{re.escape(script_id)}["\'][^>]*>.*?</script>\s*',
        '', src, flags=re.S | re.I
    )

# 2) Rewrite the REAL #ai-analysis summary in source.
# The SVG is exactly the chevron used by MEMEFLOW's existing button-icon system.
old_summary = '''<summary aria-label="AI Analysis and Market Data"><span><small>AI ANALYSIS</small><b>AI Analysis &amp; Market Data</b></span><span class="ai-analysis-chips"><em><span class="ai-data-val" id="decisionData">—</span>&#8201;DATA</em><em id="decisionLane">WAITING</em></span></summary>'''
new_summary = '''<summary aria-label="AI Analysis and Market Data"><span class="mf-btn-icon mf-icon-chevron ai-analysis-chevron" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="m9 6 6 6-6 6"/></svg></span><span class="ai-analysis-title"><small>AI ANALYSIS</small><b>AI Analysis &amp; Market Data</b></span><span class="ai-analysis-chips"><em><span class="ai-data-val" id="decisionData">—</span>&#8201;DATA</em><em id="decisionLane">WAITING</em></span></summary>'''

summary_count = src.count(old_summary)
if summary_count != 1:
    raise SystemExit(f'ERROR: expected exactly 1 current AI Analysis summary, found {summary_count}. No source was written.')
src = src.replace(old_summary, new_summary, 1)

# 3) Replace the existing right-chevron CSS IN THE SAME EXISTING STYLESHEET.
# No new <style> layer, and no dimensions/padding are changed.
old_css = ''' /* Chevron: rotated › character, flips on open */
 #ai-analysis>summary::after{content:"›"!important;font-size:18px!important;color:var(--muted)!important;opacity:.6!important;flex-shrink:0!important;display:inline-block!important;transform:rotate(90deg)!important;transition:transform .2s ease!important;margin-left:2px!important}
 #ai-analysis[open]>summary::after{transform:rotate(-90deg)!important}'''
new_css = ''' /* AI Analysis toggle: one source chevron, identical to View all checks. */
 #ai-analysis>summary{list-style:none!important}
 #ai-analysis>summary::-webkit-details-marker{display:none!important}
 #ai-analysis>summary::marker{content:""!important}
 #ai-analysis>summary::after{content:none!important;display:none!important}
 #ai-analysis>summary .ai-analysis-chevron{display:none!important}
 @media(max-width:820px){
  #ai-analysis>summary{justify-content:center!important;gap:var(--mf-icon-gap,7px)!important}
  #ai-analysis>summary .ai-analysis-chevron{display:inline-block!important;color:currentColor!important;opacity:.92!important}
  #ai-analysis>summary .ai-analysis-title{display:block!important;min-width:0!important}
  #ai-analysis>summary .ai-analysis-title small{display:none!important}
  #ai-analysis>summary .ai-analysis-title b{display:block!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important}
  #ai-analysis>summary .ai-analysis-chips{display:none!important}
 }'''

css_count = src.count(old_css)
if css_count != 1:
    raise SystemExit(f'ERROR: expected exactly 1 current AI chevron CSS block, found {css_count}. No source was written.')
src = src.replace(old_css, new_css, 1)

# 4) Strict clean-source verification before writing.
for forbidden in (
    'mf-ai-single-chevron-style',
    'mf-ai-single-chevron-script',
    'mf-ai-single-chevron-target',
    'mf-ai-single-chevron-row',
    'mf-ai-exact-overlay',
    'mf-ai-view-checks-row',
):
    if forbidden in src:
        raise SystemExit(f'ERROR: old patch artifact still present: {forbidden}')

if src.count('class="mf-btn-icon mf-icon-chevron ai-analysis-chevron"') != 1:
    raise SystemExit('ERROR: clean AI chevron markup verification failed.')
if src.count('id="decisionData"') != 1 or src.count('id="decisionLane"') != 1:
    raise SystemExit('ERROR: decisionData/decisionLane IDs were not preserved exactly once.')
if '#ai-analysis>summary::after{content:none!important;display:none!important}' not in src:
    raise SystemExit('ERROR: right-side chevron cleanup verification failed.')

path.write_text(src, encoding='utf-8')
print('Clean source rewrite complete.')
print('Removed old runtime AI-button patch blocks.')
print('Rewrote the real #ai-analysis <summary>.')
print('Replaced right-chevron CSS in the existing stylesheet.')
print('Native <details>/<summary> open/close behavior preserved.')
PY

# Restore automatically if final verification fails.
if grep -q 'mf-ai-single-chevron-script\|mf-ai-single-chevron-style\|mf-ai-exact-overlay' "$TARGET"; then
  echo "ERROR: stale AI patch detected after rewrite. Restoring backup."
  cp "$BACKUP" "$TARGET"
  exit 1
fi
if ! grep -q 'ai-analysis-chevron' "$TARGET"; then
  echo "ERROR: final chevron not found. Restoring backup."
  cp "$BACKUP" "$TARGET"
  exit 1
fi
if ! grep -q 'path d="m9 6 6 6-6 6"' "$TARGET"; then
  echo "ERROR: View-all-checks chevron path missing. Restoring backup."
  cp "$BACKUP" "$TARGET"
  exit 1
fi

echo
echo "OK: CLEAN AI Analysis source fix installed."
echo "File: $TARGET"
echo "Backup: $BACKUP"
echo "No overlay. No MutationObserver. No injected runtime UI patch."
echo "No button height/min-height/padding changes."
echo
echo "Now Stop -> Run in Replit and refresh the page."
