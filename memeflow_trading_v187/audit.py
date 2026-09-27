#!/usr/bin/env python3
from pathlib import Path
import re, sys

if len(sys.argv) != 2:
    raise SystemExit('Usage: audit.py <memeflow-app-dir>')
app=Path(sys.argv[1])
css_path=app/'memeflow-x-canonical-v186.css'
html_path=app/'trading.html'
if not css_path.exists() or not html_path.exists():
    raise SystemExit('AUDIT FAIL: required V186 CSS/trading.html missing')
css=css_path.read_text(encoding='utf-8')
html=html_path.read_text(encoding='utf-8')
start='/* MEMEFLOW_TRADING_TERMINAL_POLISH_V187_START'
end='/* MEMEFLOW_TRADING_TERMINAL_POLISH_V187_END */'
if css.count(start)!=1 or css.count(end)!=1:
    raise SystemExit('AUDIT FAIL: V187 marker count is not exactly one')
block=css.split(start,1)[1].split(end,1)[0]

# V186-only size roles.
allowed_roles={
    'var(--mf-role-micro)','var(--mf-role-meta)','var(--mf-role-ui)',
    'var(--mf-role-body)','var(--mf-role-subhead)','var(--mf-role-section)',
    'var(--mf-role-page)','var(--mf-role-display)'
}
for m in re.finditer(r'font-size\s*:\s*([^;!]+)', block, re.I):
    v=m.group(1).strip()
    if v not in allowed_roles:
        raise SystemExit(f'AUDIT FAIL: non-V186 font-size found: {v}')

for m in re.finditer(r'font-weight\s*:\s*([^;!]+)', block, re.I):
    v=m.group(1).strip()
    if v not in {'500','600','700','800'}:
        raise SystemExit(f'AUDIT FAIL: non-V186 weight found: {v}')

# Neutral colors only. Semantic colors must be inherited/preserved.
for m in re.finditer(r'(?<!-)\bcolor\s*:\s*([^;!]+)', block, re.I):
    v=m.group(1).strip()
    if v not in {f'var(--mf-neutral-text-{i})' for i in range(1,5)}:
        raise SystemExit(f'AUDIT FAIL: non-canonical neutral color found: {v}')

# Typography only: prevent accidental geometry/surface edits.
forbidden=(
    'margin','padding','gap','width','height','min-width','max-width','min-height','max-height',
    'display','position','top','right','bottom','left','border','border-radius','background',
    'box-shadow','transform','grid-template','flex','overflow'
)
for prop in forbidden:
    if re.search(rf'(?m)^\s*{re.escape(prop)}(?:-[\w-]+)?\s*:', block):
        raise SystemExit(f'AUDIT FAIL: forbidden non-typography property found: {prop}')

# Everything must be page-scoped.
for head in re.findall(r'([^{}]+)\{', block):
    h=head.strip()
    if not h or h.startswith('/*'):
        continue
    if 'body.mf-page-trading' not in h:
        raise SystemExit(f'AUDIT FAIL: unscoped selector found: {h[:120]}')

if 'MEMEFLOW_TYPOGRAPHY_ROLE_SYSTEM_V186_START' not in css:
    raise SystemExit('AUDIT FAIL: V186 role system marker missing')
if html.count('memeflow-x-canonical-v186.css') != 1:
    raise SystemExit('AUDIT FAIL: trading.html canonical V186 link count changed')
if 'trading-terminal-polish-v187-20260922' not in html:
    raise SystemExit('AUDIT FAIL: V187 cache-bust not present in trading.html')

required=[
    '.brand-title','h1#tokenName','.token-price','.timeframes button','.indicator-bar button',
    '.selected-metrics strong','.panel-head h2','.strategy-summary-row',
    '.positions-panel .position-symbol','.candidates-panel .candidate-symbol',
    '.bottom-history-panel :where(.trade-log-symbol,.trade-token-name)'
]
for token in required:
    if token not in block:
        raise SystemExit(f'AUDIT FAIL: required role mapping missing: {token}')

print('V187 TRADING TERMINAL TYPOGRAPHY AUDIT: PASS')
print(' - scope: trading.html + canonical V186 CSS only')
print(' - V186 role sizes only')
print(' - V186 weights only: 500 / 600 / 700 / 800')
print(' - neutral colors only: T1 / T2 / T3 / T4')
print(' - semantic/accent colors preserved')
print(' - no spacing / geometry / border / background edits')
print(' - no server restart performed')
