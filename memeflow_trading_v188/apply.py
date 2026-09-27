#!/usr/bin/env python3
from pathlib import Path
import re, sys

if len(sys.argv) != 2:
    raise SystemExit('Usage: apply.py <memeflow-app-dir>')

app = Path(sys.argv[1])
css_path = app / 'memeflow-x-canonical-v186.css'
html_path = app / 'trading.html'

if not css_path.exists():
    raise SystemExit('ERROR: memeflow-x-canonical-v186.css not found')
if not html_path.exists():
    raise SystemExit('ERROR: trading.html not found')

css = css_path.read_text(encoding='utf-8')
html = html_path.read_text(encoding='utf-8')

if 'MEMEFLOW_TYPOGRAPHY_ROLE_SYSTEM_V186_START' not in css:
    raise SystemExit('ERROR: V186 role system marker not found')
if 'MEMEFLOW_TRADING_TERMINAL_POLISH_V187_START' not in css:
    raise SystemExit('ERROR: V187 Trading Terminal polish marker not found. Install V187 first.')
if 'MEMEFLOW_TRADING_TERMINAL_COMPACT_V188_START' in css:
    raise SystemExit('ERROR: V188 is already installed')
if 'memeflow-x-canonical-v186.css' not in html:
    raise SystemExit('ERROR: trading.html does not reference canonical V186 stylesheet')

block = r'''
/* MEMEFLOW_TRADING_TERMINAL_COMPACT_V188_START
   Compact/readable refinement on top of V187.

   STRICT V186 TYPOGRAPHY CONTRACT:
   - sizes ONLY through V186 role variables
   - weights ONLY 500 / 600 / 700 / 800
   - neutral text ONLY T1 / T2 / T3 / T4
   - semantic/accent colors inherited unchanged
   - NO spacing, geometry, border, radius, background, chart or logic edits

   Goal: reduce visual mass while keeping fast scanability on mobile.
*/

/* 1. Identity: compact software header, not marketing masthead. */
body.mf-page-trading .brand-title {
  font-size: var(--mf-role-ui) !important;
  font-weight: 700 !important;
  line-height: 1.15 !important;
  letter-spacing: 0 !important;
  color: var(--mf-neutral-text-1) !important;
}
body.mf-page-trading .brand-sub {
  font-size: var(--mf-role-micro) !important;
  font-weight: 600 !important;
  line-height: 1.15 !important;
  letter-spacing: .08em !important;
  color: var(--mf-neutral-text-3) !important;
}
body.mf-page-trading :where(.topbar .status-pill,.topbar .ghost-btn,.topbar .wallet-btn) {
  font-size: var(--mf-role-micro) !important;
  font-weight: 600 !important;
  line-height: 1.1 !important;
  letter-spacing: .03em !important;
}

/* 2. Selected token: preserve hierarchy, remove oversized feel/truncation. */
body.mf-page-trading h1#tokenName {
  font-size: var(--mf-role-subhead) !important;
  font-weight: 700 !important;
  line-height: 1.1 !important;
  letter-spacing: -.01em !important;
  color: var(--mf-neutral-text-1) !important;
}
body.mf-page-trading .token-price {
  font-size: var(--mf-role-section) !important;
  font-weight: 800 !important;
  line-height: 1.05 !important;
  letter-spacing: -.015em !important;
  color: var(--mf-neutral-text-1) !important;
  font-variant-numeric: tabular-nums lining-nums !important;
}
body.mf-page-trading :where(.token-meta,.token-market) {
  font-size: var(--mf-role-micro) !important;
  font-weight: 500 !important;
  line-height: 1.2 !important;
  letter-spacing: 0 !important;
  color: var(--mf-neutral-text-3) !important;
}
body.mf-page-trading .token-meta button {
  font-size: var(--mf-role-meta) !important;
  font-weight: 600 !important;
  line-height: 1.15 !important;
  letter-spacing: 0 !important;
}
body.mf-page-trading :where(.decision-badge,.tiny-state,.mode-badge,.approval-count) {
  font-size: var(--mf-role-micro) !important;
  font-weight: 600 !important;
  line-height: 1.1 !important;
  letter-spacing: .03em !important;
}

/* 3. Chart chrome: controls become compact; chart remains the visual anchor. */
body.mf-page-trading :where(.timeframes button,.indicator-bar button,.candidate-filter button) {
  font-size: var(--mf-role-meta) !important;
  font-weight: 600 !important;
  line-height: 1.15 !important;
  letter-spacing: 0 !important;
}
body.mf-page-trading :where(.timeframes button,.indicator-bar button,.candidate-filter button):not(.active):not([aria-selected="true"]):not([aria-pressed="true"]) {
  color: var(--mf-neutral-text-2) !important;
}
body.mf-page-trading .chart-legend,
body.mf-page-trading .chart-legend :where(b,strong) {
  font-size: var(--mf-role-micro) !important;
  font-weight: 500 !important;
  line-height: 1.2 !important;
  letter-spacing: 0 !important;
  color: var(--mf-neutral-text-3) !important;
  font-variant-numeric: tabular-nums lining-nums !important;
}
body.mf-page-trading .chart-legend :where(b,strong) {
  color: var(--mf-neutral-text-2) !important;
}
body.mf-page-trading .selected-metrics span {
  font-size: var(--mf-role-micro) !important;
  font-weight: 500 !important;
  line-height: 1.15 !important;
  letter-spacing: 0 !important;
  color: var(--mf-neutral-text-3) !important;
}
body.mf-page-trading .selected-metrics strong {
  font-size: var(--mf-role-meta) !important;
  font-weight: 600 !important;
  line-height: 1.15 !important;
  letter-spacing: 0 !important;
  color: var(--mf-neutral-text-1) !important;
  font-variant-numeric: tabular-nums lining-nums !important;
}

/* 4. Module headers: MICRO context + UI title. This is the terminal standard. */
body.mf-page-trading :where(
  .approvals-panel,
  .strategy-summary-panel,
  .positions-panel,
  .candidates-panel,
  .bottom-history-panel
) .panel-head .eyebrow {
  font-size: var(--mf-role-micro) !important;
  font-weight: 600 !important;
  line-height: 1.15 !important;
  letter-spacing: .08em !important;
  color: var(--mf-neutral-text-4) !important;
  text-transform: uppercase !important;
}
body.mf-page-trading :where(
  .approvals-panel,
  .strategy-summary-panel,
  .positions-panel,
  .candidates-panel,
  .bottom-history-panel
) .panel-head h2 {
  font-size: var(--mf-role-ui) !important;
  font-weight: 700 !important;
  line-height: 1.15 !important;
  letter-spacing: 0 !important;
  color: var(--mf-neutral-text-1) !important;
}
body.mf-page-trading #paperPnl {
  font-size: var(--mf-role-ui) !important;
  font-weight: 700 !important;
  line-height: 1.1 !important;
  letter-spacing: 0 !important;
  font-variant-numeric: tabular-nums lining-nums !important;
}

/* 5. Strategy: smallest readable labels, compact UI-level values. */
body.mf-page-trading .strategy-summary-panel .strategy-summary-row span {
  font-size: var(--mf-role-micro) !important;
  font-weight: 500 !important;
  line-height: 1.2 !important;
  letter-spacing: 0 !important;
  color: var(--mf-neutral-text-3) !important;
  text-transform: none !important;
}
body.mf-page-trading .strategy-summary-panel .strategy-summary-row :where(strong,b) {
  font-size: var(--mf-role-ui) !important;
  font-weight: 600 !important;
  line-height: 1.15 !important;
  letter-spacing: 0 !important;
  color: var(--mf-neutral-text-1) !important;
  text-transform: none !important;
  font-variant-numeric: tabular-nums lining-nums !important;
}
body.mf-page-trading .strategy-summary-panel :where(.strategy-note,.panel-note,.synced-note) {
  font-size: var(--mf-role-micro) !important;
  font-weight: 500 !important;
  line-height: 1.2 !important;
  color: var(--mf-neutral-text-3) !important;
}

/* 6. Positions: compact execution rows. */
body.mf-page-trading .positions-panel .position-symbol {
  font-size: var(--mf-role-meta) !important;
  font-weight: 600 !important;
  line-height: 1.15 !important;
  letter-spacing: 0 !important;
  color: var(--mf-neutral-text-1) !important;
  text-transform: none !important;
}
body.mf-page-trading .positions-panel .position-bottomline,
body.mf-page-trading .positions-panel .position-bottomline :where(span,i,strong) {
  font-size: var(--mf-role-micro) !important;
  font-weight: 500 !important;
  line-height: 1.15 !important;
  letter-spacing: 0 !important;
  color: var(--mf-neutral-text-3) !important;
  text-transform: none !important;
  font-variant-numeric: tabular-nums lining-nums !important;
}
body.mf-page-trading .positions-panel .position-pnl {
  font-size: var(--mf-role-meta) !important;
  font-weight: 600 !important;
  line-height: 1.15 !important;
  font-variant-numeric: tabular-nums lining-nums !important;
}
body.mf-page-trading .positions-panel :where(.close-position,.copy-trade-badge) {
  font-size: var(--mf-role-micro) !important;
  font-weight: 600 !important;
  line-height: 1.1 !important;
  letter-spacing: .03em !important;
}

/* 7. Candidates: dense scan list, evidence is secondary. */
body.mf-page-trading .candidates-panel .candidate-symbol {
  font-size: var(--mf-role-meta) !important;
  font-weight: 600 !important;
  line-height: 1.15 !important;
  letter-spacing: 0 !important;
  color: var(--mf-neutral-text-1) !important;
  text-transform: none !important;
}
body.mf-page-trading .candidates-panel .candidate-bottom,
body.mf-page-trading .candidates-panel .candidate-bottom :where(span,i,strong) {
  font-size: var(--mf-role-micro) !important;
  font-weight: 500 !important;
  line-height: 1.15 !important;
  letter-spacing: 0 !important;
  color: var(--mf-neutral-text-3) !important;
  text-transform: none !important;
}
body.mf-page-trading .candidates-panel .candidate-price {
  font-size: var(--mf-role-micro) !important;
  font-weight: 500 !important;
  line-height: 1.15 !important;
  letter-spacing: 0 !important;
  color: var(--mf-neutral-text-2) !important;
  font-variant-numeric: tabular-nums lining-nums !important;
}
body.mf-page-trading .candidates-panel :where(.state-dot,.copy-trade-badge) {
  font-size: var(--mf-role-micro) !important;
  font-weight: 600 !important;
  line-height: 1.1 !important;
  letter-spacing: .03em !important;
}

/* 8. Recent trades: log typography, not content-card typography. */
body.mf-page-trading .bottom-history-panel :where(.trade-log-symbol,.trade-token-name) {
  font-size: var(--mf-role-meta) !important;
  font-weight: 600 !important;
  line-height: 1.15 !important;
  letter-spacing: 0 !important;
  color: var(--mf-neutral-text-1) !important;
  text-transform: none !important;
}
body.mf-page-trading .bottom-history-panel .trade-log-bottomline,
body.mf-page-trading .bottom-history-panel .trade-log-bottomline :where(span,i,strong),
body.mf-page-trading .bottom-history-panel .trade-log-time {
  font-size: var(--mf-role-micro) !important;
  font-weight: 500 !important;
  line-height: 1.15 !important;
  letter-spacing: 0 !important;
  color: var(--mf-neutral-text-3) !important;
  text-transform: none !important;
  font-variant-numeric: tabular-nums lining-nums !important;
}
body.mf-page-trading .bottom-history-panel :where(.trade-side,.pnl-positive,.pnl-negative) {
  font-size: var(--mf-role-meta) !important;
  font-weight: 600 !important;
  line-height: 1.15 !important;
  font-variant-numeric: tabular-nums lining-nums !important;
}
body.mf-page-trading .bottom-history-panel :where(.trade-pump-link,.trade-status,.trade-log-hint) {
  font-size: var(--mf-role-micro) !important;
  font-weight: 600 !important;
  line-height: 1.1 !important;
  letter-spacing: .03em !important;
}

/* MEMEFLOW_TRADING_TERMINAL_COMPACT_V188_END */
'''

css = css.rstrip() + '\n\n' + block.strip() + '\n'
css_path.write_text(css, encoding='utf-8')

pat = re.compile(r'(/memeflow-x-canonical-v186\.css)(?:\?[^"\']*)?')
matches = list(pat.finditer(html))
if len(matches) != 1:
    raise SystemExit(f'ERROR: expected exactly one canonical V186 link in trading.html, found {len(matches)}')
html = pat.sub(r'\1?v=trading-terminal-compact-v188-20260922', html, count=1)
html_path.write_text(html, encoding='utf-8')
print('V188 Trading Terminal compact typography applied.')
