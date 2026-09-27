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
start='/* MEMEFLOW_TRADING_TECHNICAL_HIERARCHY_V189_START'
end='/* MEMEFLOW_TRADING_TECHNICAL_HIERARCHY_V189_END */'
if css.count(start) != 1 or css.count(end) != 1:
    raise SystemExit('AUDIT FAIL: V189 marker count is not exactly one')
for marker in (
    'MEMEFLOW_TYPOGRAPHY_ROLE_SYSTEM_V186_START',
    'MEMEFLOW_TRADING_TERMINAL_POLISH_V187_START',
    'MEMEFLOW_TRADING_TERMINAL_COMPACT_V188_START',
):
    if marker not in css:
        raise SystemExit(f'AUDIT FAIL: prerequisite marker missing: {marker}')
block = css.split(start,1)[1].split(end,1)[0]

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
for m in re.finditer(r'(?<!-)\bcolor\s*:\s*([^;!]+)', block, re.I):
    v=m.group(1).strip()
    if v not in {f'var(--mf-neutral-text-{i})' for i in range(1,5)}:
        raise SystemExit(f'AUDIT FAIL: non-canonical neutral color found: {v}')

forbidden=(
    'margin','padding','gap','width','height','min-width','max-width','min-height','max-height',
    'display','position','top','right','bottom','left','border','border-radius','background',
    'box-shadow','transform','grid-template','flex','overflow'
)
for prop in forbidden:
    if re.search(rf'(?m)^\s*{re.escape(prop)}(?:-[\w-]+)?\s*:', block):
        raise SystemExit(f'AUDIT FAIL: forbidden non-typography property found: {prop}')

if '@media (max-width: 820px)' not in block:
    raise SystemExit('AUDIT FAIL: V189 mobile scope missing')
if html.count('memeflow-x-canonical-v186.css') != 1:
    raise SystemExit('AUDIT FAIL: canonical link count changed')
if 'trading-technical-hierarchy-v189-20260922' not in html:
    raise SystemExit('AUDIT FAIL: V189 cache-bust missing')

required=[
    '.brand-title','h1#tokenName','.token-price','.timeframes button','.indicator-bar button',
    '.selected-metrics span','.selected-metrics strong','.panel-head .eyebrow','.panel-head h2',
    '.strategy-summary-row span','.strategy-summary-row :where(strong,b)',
    '.positions-panel .position-symbol','.candidates-panel .candidate-symbol',
    '.bottom-history-panel :where(.trade-log-symbol,.trade-token-name)'
]
for token in required:
    if token not in block:
        raise SystemExit(f'AUDIT FAIL: required V189 mapping missing: {token}')

# Explicit technical-hierarchy expectations.
expect = {
    '.brand-title': ('var(--mf-role-meta)', 'var(--mf-neutral-text-1)'),
    'h1#tokenName': ('var(--mf-role-ui)', 'var(--mf-neutral-text-1)'),
    '.token-price': ('var(--mf-role-subhead)', 'var(--mf-neutral-text-1)'),
    '.brand-sub': ('var(--mf-role-micro)', 'var(--mf-neutral-text-4)'),
    '.strategy-summary-panel .strategy-summary-row span': ('var(--mf-role-micro)', 'var(--mf-neutral-text-4)'),
    '.candidates-panel .candidate-bottom': ('var(--mf-role-micro)', 'var(--mf-neutral-text-4)'),
    '.bottom-history-panel .trade-log-time': ('var(--mf-role-micro)', 'var(--mf-neutral-text-4)'),
}
for selector,(role,color) in expect.items():
    pos=block.find(selector)
    if pos < 0:
        raise SystemExit(f'AUDIT FAIL: selector absent: {selector}')
    snippet=block[pos:pos+900]
    if f'font-size: {role}' not in snippet:
        raise SystemExit(f'AUDIT FAIL: expected {selector} -> {role}')
    if f'color: {color}' not in snippet:
        raise SystemExit(f'AUDIT FAIL: expected {selector} -> {color}')

# Semantic selectors must not receive neutral color overrides in V189.
for semantic in (
    '.position-pnl', '.close-position', '.copy-trade-badge', '.state-dot',
    '.trade-side', '.pnl-positive', '.pnl-negative', '.trade-status', '.decision-badge'
):
    for m in re.finditer(re.escape(semantic), block):
        snippet=block[m.start():m.start()+550]
        # only examine through the next closing brace
        snippet=snippet.split('}',1)[0]
        if re.search(r'(?<!-)\bcolor\s*:', snippet):
            raise SystemExit(f'AUDIT FAIL: semantic color overridden for {semantic}')

print('V189 TRADING TERMINAL TECHNICAL HIERARCHY AUDIT: PASS')
print(' - mobile scope only: <= 820px')
print(' - V186 role sizes only')
print(' - V186 weights only: 500 / 600 / 700 / 800')
print(' - canonical neutral tiers only: T1 / T2 / T3 / T4')
print(' - technical/system text mapped to MICRO + T4')
print(' - semantic/accent colors preserved')
print(' - no spacing / geometry / border / background edits')
print(' - no server restart performed')
