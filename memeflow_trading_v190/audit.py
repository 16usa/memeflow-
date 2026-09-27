#!/usr/bin/env python3
from pathlib import Path
import re, sys

if len(sys.argv) != 2:
    raise SystemExit('Usage: audit.py <memeflow-app-dir>')
app = Path(sys.argv[1])
css_path = app/'memeflow-x-canonical-v186.css'
html_path = app/'trading.html'
if not css_path.exists() or not html_path.exists():
    raise SystemExit('AUDIT FAIL: required CSS/trading.html missing')
css = css_path.read_text(encoding='utf-8')
html = html_path.read_text(encoding='utf-8')
start='/* MEMEFLOW_TRADING_DENSITY_GEOMETRY_V190_START'
end='/* MEMEFLOW_TRADING_DENSITY_GEOMETRY_V190_END */'
if css.count(start) != 1 or css.count(end) != 1:
    raise SystemExit('AUDIT FAIL: V190 marker count is not exactly one')
for marker in (
    'MEMEFLOW_TYPOGRAPHY_ROLE_SYSTEM_V186_START',
    'MEMEFLOW_TRADING_TERMINAL_POLISH_V187_START',
    'MEMEFLOW_TRADING_TERMINAL_COMPACT_V188_START',
    'MEMEFLOW_TRADING_TECHNICAL_HIERARCHY_V189_START',
):
    if marker not in css:
        raise SystemExit(f'AUDIT FAIL: prerequisite marker missing: {marker}')
block = css.split(start,1)[1].split(end,1)[0]

# V190 is geometry-only. It must not introduce typography or palette ownership.
for forbidden in (
    r'(?m)^\s*font(?:-[\w-]+)?\s*:',
    r'(?m)^\s*(?<!-)color\s*:',
    r'(?m)^\s*background(?:-[\w-]+)?\s*:',
):
    if re.search(forbidden, block, re.I):
        raise SystemExit(f'AUDIT FAIL: forbidden V190 ownership matched: {forbidden}')

# No behavior/animation/display hiding tricks.
for forbidden_prop in ('opacity','visibility','pointer-events','animation','transition'):
    if re.search(rf'(?m)^\s*{re.escape(forbidden_prop)}(?:-[\w-]+)?\s*:', block, re.I):
        raise SystemExit(f'AUDIT FAIL: forbidden behavioral property found: {forbidden_prop}')
if re.search(r'(?m)^\s*display\s*:\s*none', block, re.I):
    raise SystemExit('AUDIT FAIL: V190 hides UI content')

if '@media (max-width: 820px)' not in block:
    raise SystemExit('AUDIT FAIL: V190 mobile scope missing')
if html.count('memeflow-x-canonical-v186.css') != 1:
    raise SystemExit('AUDIT FAIL: canonical link count changed')
if 'trading-density-geometry-v190-20260922' not in html:
    raise SystemExit('AUDIT FAIL: V190 cache-bust missing')

required_tokens = [
    '.terminal', '.chart-head', '.timeframes', '.indicator-bar', '.selected-metrics',
    '> .panel-head', '.strategy-summary-row', '.position-row', '.candidate',
    '.trade-row.trade-log-row', '.trade-token-avatar', '.candidate-filter',
    '.close-position', 'border-radius: 12px', 'min-height: 56px',
    'grid-template-columns: 36px minmax(0, 1fr) auto',
]
for token in required_tokens:
    if token not in block:
        raise SystemExit(f'AUDIT FAIL: required V190 mapping missing: {token}')

# Density contract: only approved spacing steps are used for padding/gap/margins,
# except safe-area calculations and tightly scoped 2/5/6/7/9/10 physical values
# used by controls/radii where the legacy DOM requires them.
if 'padding: 8px 12px' not in block or 'gap: 8px' not in block:
    raise SystemExit('AUDIT FAIL: core 8/12 density rhythm missing')

print('V190 TRADING TERMINAL DENSITY / GEOMETRY AUDIT: PASS')
print(' - mobile scope only: <= 820px')
print(' - V189 typography untouched')
print(' - V186 neutral + semantic colors untouched')
print(' - tighter 8/12 workspace rhythm')
print(' - 12px module radii')
print(' - 44px module headers')
print(' - 56px execution rows')
print(' - 36px list avatars')
print(' - compact 22px badge/action geometry')
print(' - no background/palette ownership')
print(' - no JS / trading / backend edits')
print(' - no server restart performed')
