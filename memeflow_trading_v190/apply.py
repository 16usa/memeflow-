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

required = [
    'MEMEFLOW_TYPOGRAPHY_ROLE_SYSTEM_V186_START',
    'MEMEFLOW_TRADING_TERMINAL_POLISH_V187_START',
    'MEMEFLOW_TRADING_TERMINAL_COMPACT_V188_START',
    'MEMEFLOW_TRADING_TECHNICAL_HIERARCHY_V189_START',
]
for marker in required:
    if marker not in css:
        raise SystemExit(f'ERROR: required marker missing: {marker}')
if 'MEMEFLOW_TRADING_DENSITY_GEOMETRY_V190_START' in css:
    raise SystemExit('ERROR: V190 is already installed')
if 'memeflow-x-canonical-v186.css' not in html:
    raise SystemExit('ERROR: trading.html does not reference canonical V186 stylesheet')

block = r'''
/* MEMEFLOW_TRADING_DENSITY_GEOMETRY_V190_START
   Professional mobile density / geometry layer on top of V189.

   DESIGN CONTRACT
   - V189 typography remains untouched
   - V186 T1/T2/T3/T4 colors remain untouched
   - semantic state/accent colors remain untouched
   - chart/data/trading behavior remains untouched
   - geometry only: spacing, alignment, radii, row density, avatar scale,
     module/tool-strip height, grid fit and truncation safety

   Visual target:
   compact professional execution software rather than stacked mobile cards.
*/

@media (max-width: 820px) {
  /* ----------------------------------------------------------------------
     1. Workspace rhythm — one dense software surface
     ---------------------------------------------------------------------- */
  html[data-theme] body.mf-page-trading.mf-trading-terminal .terminal {
    gap: 8px !important;
    padding-left: 8px !important;
    padding-right: 8px !important;
    padding-bottom: calc(24px + env(safe-area-inset-bottom)) !important;
  }

  html[data-theme] body.mf-page-trading.mf-trading-terminal .center-stack {
    gap: 8px !important;
  }

  html[data-theme] body.mf-page-trading.mf-trading-terminal :is(
    .chart-panel,
    .approvals-panel,
    .strategy-summary-panel,
    .positions-panel,
    .candidates-panel,
    .bottom-history-panel
  ) {
    width: 100% !important;
    margin: 0 !important;
    border-radius: 12px !important;
    overflow: hidden !important;
    box-shadow: none !important;
  }

  /* ----------------------------------------------------------------------
     2. Header / status chrome — compact, aligned, no oversized pills
     ---------------------------------------------------------------------- */
  html[data-theme] body.mf-page-trading.mf-trading-terminal .topbar {
    min-height: 88px !important;
    height: auto !important;
    padding: max(8px, env(safe-area-inset-top)) 12px 8px !important;
    row-gap: 4px !important;
  }

  html[data-theme] body.mf-page-trading.mf-trading-terminal .brand {
    min-height: 40px !important;
    gap: 8px !important;
  }

  html[data-theme] body.mf-page-trading.mf-trading-terminal .brand-mark {
    width: 30px !important;
    height: 30px !important;
    flex: 0 0 30px !important;
  }

  html[data-theme] body.mf-page-trading.mf-trading-terminal .engine-strip {
    gap: 8px !important;
  }

  html[data-theme] body.mf-page-trading.mf-trading-terminal .engine-strip .status-pill {
    min-height: 22px !important;
    height: 22px !important;
    padding: 0 6px !important;
    border-radius: 5px !important;
  }

  /* ----------------------------------------------------------------------
     3. Selected instrument — compact hero header, chart stays primary
     ---------------------------------------------------------------------- */
  html[data-theme] body.mf-page-trading.mf-trading-terminal .chart-head {
    min-height: 68px !important;
    padding: 10px 12px 8px !important;
    gap: 8px !important;
    align-items: center !important;
  }

  html[data-theme] body.mf-page-trading.mf-trading-terminal .token-title {
    min-width: 0 !important;
    gap: 8px !important;
    align-items: center !important;
  }

  html[data-theme] body.mf-page-trading.mf-trading-terminal .chart-head .token-avatar {
    width: 40px !important;
    height: 40px !important;
    flex: 0 0 40px !important;
    border-radius: 9px !important;
  }

  html[data-theme] body.mf-page-trading.mf-trading-terminal .token-name-row {
    min-width: 0 !important;
    gap: 6px !important;
    align-items: center !important;
  }

  html[data-theme] body.mf-page-trading.mf-trading-terminal .token-name-row h1 {
    min-width: 0 !important;
    overflow: hidden !important;
    text-overflow: ellipsis !important;
    white-space: nowrap !important;
  }

  html[data-theme] body.mf-page-trading.mf-trading-terminal .token-meta {
    margin-top: 4px !important;
    gap: 6px !important;
    min-width: 0 !important;
    overflow: hidden !important;
    white-space: nowrap !important;
  }

  html[data-theme] body.mf-page-trading.mf-trading-terminal .price-toggle {
    min-width: 132px !important;
    max-width: 44% !important;
    margin-left: auto !important;
    padding-left: 8px !important;
    flex: 0 0 auto !important;
  }

  html[data-theme] body.mf-page-trading.mf-trading-terminal .token-price,
  html[data-theme] body.mf-page-trading.mf-trading-terminal .token-market {
    overflow: hidden !important;
    text-overflow: ellipsis !important;
    white-space: nowrap !important;
  }

  html[data-theme] body.mf-page-trading.mf-trading-terminal .token-market {
    margin-top: 4px !important;
  }

  /* ----------------------------------------------------------------------
     4. Chart controls — dense toolbars, consistent baseline
     ---------------------------------------------------------------------- */
  html[data-theme] body.mf-page-trading.mf-trading-terminal .timeframes {
    min-height: 40px !important;
    height: 40px !important;
    padding: 0 8px !important;
    gap: 0 !important;
    align-items: stretch !important;
  }

  html[data-theme] body.mf-page-trading.mf-trading-terminal .timeframes button {
    flex: 1 1 0 !important;
    min-width: 0 !important;
    height: 40px !important;
    padding: 0 4px !important;
    border-radius: 0 !important;
  }

  html[data-theme] body.mf-page-trading.mf-trading-terminal .chart-legend {
    min-height: 28px !important;
    padding: 6px 12px 4px !important;
    gap: 4px !important;
    overflow: hidden !important;
    flex-wrap: nowrap !important;
    white-space: nowrap !important;
  }

  html[data-theme] body.mf-page-trading.mf-trading-terminal .indicator-bar {
    min-height: 36px !important;
    height: 36px !important;
  }

  html[data-theme] body.mf-page-trading.mf-trading-terminal .indicator-scroll {
    height: 36px !important;
    padding: 0 4px !important;
    gap: 0 !important;
  }

  html[data-theme] body.mf-page-trading.mf-trading-terminal .indicator-bar button {
    flex: 1 1 0 !important;
    min-width: 0 !important;
    height: 36px !important;
    padding: 0 4px !important;
  }

  html[data-theme] body.mf-page-trading.mf-trading-terminal .selected-metrics {
    min-height: 52px !important;
  }

  html[data-theme] body.mf-page-trading.mf-trading-terminal .selected-metrics > div {
    min-height: 52px !important;
    padding: 8px 6px !important;
  }

  html[data-theme] body.mf-page-trading.mf-trading-terminal .selected-metrics strong {
    margin-top: 4px !important;
  }

  /* ----------------------------------------------------------------------
     5. One module-header grammar — slim toolbar row everywhere
     ---------------------------------------------------------------------- */
  html[data-theme] body.mf-page-trading.mf-trading-terminal :is(
    .approvals-panel,
    .strategy-summary-panel,
    .positions-panel,
    .candidates-panel,
    .bottom-history-panel
  ) > .panel-head {
    min-height: 44px !important;
    height: 44px !important;
    padding: 8px 12px !important;
    gap: 8px !important;
    align-items: center !important;
    flex-wrap: nowrap !important;
  }

  html[data-theme] body.mf-page-trading.mf-trading-terminal :is(
    .approvals-panel,
    .strategy-summary-panel,
    .positions-panel,
    .candidates-panel,
    .bottom-history-panel
  ) > .panel-head :is(.eyebrow,h2) {
    margin: 0 !important;
    white-space: nowrap !important;
  }

  html[data-theme] body.mf-page-trading.mf-trading-terminal :is(
    .approvals-panel,
    .strategy-summary-panel,
    .positions-panel,
    .candidates-panel,
    .bottom-history-panel
  ) > .panel-head h2 {
    min-width: 0 !important;
    overflow: hidden !important;
    text-overflow: ellipsis !important;
  }

  html[data-theme] body.mf-page-trading.mf-trading-terminal :is(
    .strategy-head-actions,
    .pnl-summary,
    .approval-count,
    .mode-badge,
    .tiny-state
  ) {
    margin-left: auto !important;
    flex: 0 0 auto !important;
    white-space: nowrap !important;
  }

  /* Pending approvals becomes a true one-row status module when empty. */
  html[data-theme] body.mf-page-trading.mf-trading-terminal .approvals-panel > .panel-head {
    min-height: 44px !important;
    height: 44px !important;
  }

  /* ----------------------------------------------------------------------
     6. Strategy — dense two-column data grid
     ---------------------------------------------------------------------- */
  html[data-theme] body.mf-page-trading.mf-trading-terminal .strategy-summary-list {
    padding: 0 12px 4px !important;
    gap: 0 !important;
  }

  html[data-theme] body.mf-page-trading.mf-trading-terminal .strategy-summary-row {
    min-height: 44px !important;
    gap: 12px !important;
  }

  html[data-theme] body.mf-page-trading.mf-trading-terminal .strategy-summary-row > div {
    min-width: 0 !important;
    padding: 6px 0 !important;
  }

  html[data-theme] body.mf-page-trading.mf-trading-terminal .strategy-summary-row > div + div {
    padding-left: 12px !important;
  }

  html[data-theme] body.mf-page-trading.mf-trading-terminal .strategy-summary-row :is(span,strong,b) {
    overflow: hidden !important;
    text-overflow: ellipsis !important;
    white-space: nowrap !important;
  }

  html[data-theme] body.mf-page-trading.mf-trading-terminal .strategy-summary-foot {
    min-height: 34px !important;
    padding: 7px 12px 9px !important;
  }

  html[data-theme] body.mf-page-trading.mf-trading-terminal .strategy-head-actions {
    gap: 6px !important;
  }

  /* ----------------------------------------------------------------------
     7. Lists — execution-table density and one consistent row system
     ---------------------------------------------------------------------- */
  html[data-theme] body.mf-page-trading.mf-trading-terminal :is(
    .positions-list,
    .candidate-list,
    .trade-history
  ) {
    max-height: none !important;
    overflow: visible !important;
    padding: 0 !important;
  }

  html[data-theme] body.mf-page-trading.mf-trading-terminal :is(
    .position-row,
    .candidate,
    .trade-row.trade-log-row
  ) {
    min-height: 56px !important;
    margin: 0 !important;
    padding: 8px 12px !important;
    gap: 8px !important;
    border-radius: 0 !important;
    box-shadow: none !important;
    align-items: center !important;
  }

  html[data-theme] body.mf-page-trading.mf-trading-terminal .position-row {
    grid-template-columns: 36px minmax(0, 1fr) auto !important;
  }

  html[data-theme] body.mf-page-trading.mf-trading-terminal .candidate {
    grid-template-columns: 36px minmax(0, 1fr) !important;
  }

  html[data-theme] body.mf-page-trading.mf-trading-terminal .trade-row.trade-log-row {
    grid-template-columns: 36px minmax(0, 1fr) !important;
  }

  html[data-theme] body.mf-page-trading.mf-trading-terminal :is(
    .position-main,
    .candidate-main,
    .candidate-name,
    .trade-log-details
  ) {
    min-width: 0 !important;
  }

  html[data-theme] body.mf-page-trading.mf-trading-terminal .trade-token-avatar {
    width: 36px !important;
    height: 36px !important;
    flex: 0 0 36px !important;
    border-radius: 8px !important;
  }

  html[data-theme] body.mf-page-trading.mf-trading-terminal :is(
    .position-bottomline,
    .candidate-top,
    .candidate-bottom,
    .trade-log-topline,
    .trade-log-bottomline
  ) {
    min-width: 0 !important;
    white-space: nowrap !important;
  }

  html[data-theme] body.mf-page-trading.mf-trading-terminal :is(
    .position-bottomline,
    .candidate-bottom,
    .trade-log-bottomline
  ) {
    overflow: hidden !important;
    text-overflow: ellipsis !important;
  }

  /* ----------------------------------------------------------------------
     8. Candidate navigation — compact software tab strip
     ---------------------------------------------------------------------- */
  html[data-theme] body.mf-page-trading.mf-trading-terminal .candidate-filter {
    min-height: 40px !important;
    height: 40px !important;
    padding: 0 8px !important;
    gap: 0 !important;
    grid-template-columns: repeat(5, minmax(0, 1fr)) !important;
  }

  html[data-theme] body.mf-page-trading.mf-trading-terminal .candidate-filter > button[data-filter] {
    min-width: 0 !important;
    min-height: 40px !important;
    height: 40px !important;
    padding: 0 2px !important;
    border-radius: 0 !important;
  }

  /* ----------------------------------------------------------------------
     9. Badges/actions — one compact physical system
     ---------------------------------------------------------------------- */
  html[data-theme] body.mf-page-trading.mf-trading-terminal :is(
    .decision-badge,
    .mode-badge,
    .strategy-edit-link,
    .close-position,
    .copy-trade-badge,
    .trade-status,
    .trade-pump-link,
    .tiny-state,
    .approval-count
  ) {
    min-height: 22px !important;
    height: 22px !important;
    padding: 0 6px !important;
    border-radius: 5px !important;
    white-space: nowrap !important;
  }
}

@media (max-width: 430px) {
  html[data-theme] body.mf-page-trading.mf-trading-terminal .terminal {
    padding-left: 8px !important;
    padding-right: 8px !important;
  }

  html[data-theme] body.mf-page-trading.mf-trading-terminal .chart-head {
    padding-left: 10px !important;
    padding-right: 10px !important;
  }

  html[data-theme] body.mf-page-trading.mf-trading-terminal .price-toggle {
    min-width: 118px !important;
    max-width: 42% !important;
  }

  html[data-theme] body.mf-page-trading.mf-trading-terminal .strategy-summary-row {
    gap: 8px !important;
  }

  html[data-theme] body.mf-page-trading.mf-trading-terminal .strategy-summary-row > div + div {
    padding-left: 8px !important;
  }
}

/* MEMEFLOW_TRADING_DENSITY_GEOMETRY_V190_END */
'''

css = css.rstrip() + '\n\n' + block.strip() + '\n'
css_path.write_text(css, encoding='utf-8')

pat = re.compile(r'(/memeflow-x-canonical-v186\.css)(?:\?[^"\']*)?')
matches = list(pat.finditer(html))
if len(matches) != 1:
    raise SystemExit(f'ERROR: expected exactly one canonical V186 link in trading.html, found {len(matches)}')
html = pat.sub(r'\1?v=trading-density-geometry-v190-20260922', html, count=1)
html_path.write_text(html, encoding='utf-8')
print('V190 Trading Terminal density / geometry applied.')
