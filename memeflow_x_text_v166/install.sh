#!/usr/bin/env bash
set -euo pipefail

ROOT="${PWD}"
APP="memeflow-app"
CSS="$APP/memeflow-x-lights-out-v166.css"
BACKUP=".memeflow-pump-fee-palette-v166-backup"
TAG='<link rel="stylesheet" href="/memeflow-x-lights-out-v166.css?v=pump-fee-full-ui-v166-20260922">'

if [[ ! -d "$APP" ]]; then
  echo "ERROR: $APP not found. Run this from the existing Memflow workspace root."
  exit 1
fi

PAGES=(
  "$APP/index.html"
  "$APP/agent-performance.html"
  "$APP/how-it-works.html"
  "$APP/settings.html"
  "$APP/smart-vault.html"
  "$APP/system-tokens.html"
  "$APP/system.html"
  "$APP/trading.html"
  "$APP/owner-intelligence.html"
)

if [[ ! -f "$BACKUP/.created" ]]; then
  mkdir -p "$BACKUP/$APP"
  for f in "${PAGES[@]}"; do
    [[ -f "$f" ]] && cp -p "$f" "$BACKUP/$f"
  done
  if [[ -f "$CSS" ]]; then
    cp -p "$CSS" "$BACKUP/$CSS"
    printf '1\n' > "$BACKUP/.css-existed"
  else
    printf '0\n' > "$BACKUP/.css-existed"
  fi
  date -u +%FT%TZ > "$BACKUP/.created"
fi

cat > "$CSS" <<'CSS'
/* ========================================================================
   MEMEFLOW — PUMP FEE NEUTRAL PALETTE V166
   Source palette copied from 16usa/Pump-Fee-Routing/src/styles.css:
     page / canvas      #0A0A0A
     primary blocks     #111111
     token/card surface #121212
     inset surface      #171717
     border / divider   #252525

   Dark mode only. Light mode, semantic state colors, geometry, typography,
   animations, chart data, trading logic and the System Overview 3D viewport
   are intentionally untouched.
   ======================================================================== */

html:not([data-theme="light"]) {
  color-scheme: dark;

  --mf-pf-bg: #0a0a0a;
  --mf-pf-panel: #111111;
  --mf-pf-card: #121212;
  --mf-pf-inset: #171717;
  --mf-pf-line: #252525;

  /* Global Memflow aliases. */
  --mf-app-bg: var(--mf-pf-bg) !important;
  --mf-app-surface: var(--mf-pf-panel) !important;
  --mf-app-surface-2: var(--mf-pf-card) !important;
  --mf-app-surface-3: var(--mf-pf-inset) !important;
  --mf-app-panel-top: var(--mf-pf-panel) !important;
  --mf-app-panel-bottom: var(--mf-pf-panel) !important;
  --mf-app-line: var(--mf-pf-line) !important;
  --mf-app-line-strong: var(--mf-pf-line) !important;

  --bg: var(--mf-pf-bg) !important;
  --panel: var(--mf-pf-panel) !important;
  --panel-solid: var(--mf-pf-panel) !important;
  --panel-2: var(--mf-pf-inset) !important;
  --panel2: var(--mf-pf-inset) !important;
  --surface: var(--mf-pf-panel) !important;
  --surface2: var(--mf-pf-card) !important;
  --surface3: var(--mf-pf-inset) !important;
  --surface-2: var(--mf-pf-card) !important;
  --line: var(--mf-pf-line) !important;
  --line2: var(--mf-pf-line) !important;
  --line-strong: var(--mf-pf-line) !important;

  /* Existing late dark-surface contract aliases. */
  --mf-x-dark-canvas: var(--mf-pf-bg) !important;
  --mf-x-dark-inset: var(--mf-pf-inset) !important;
  --mf-x-dark-line: var(--mf-pf-line) !important;
  --mf-dark-canvas: var(--mf-pf-bg) !important;
  --mf-dark-surface-1: var(--mf-pf-panel) !important;
  --mf-dark-surface-2: var(--mf-pf-inset) !important;
  --mf-dark-line: var(--mf-pf-line) !important;

  --mf-structure-outer: var(--mf-pf-line) !important;
  --mf-structure-divider: rgba(37, 37, 37, .78) !important;
  --mf-structure-ultra: rgba(37, 37, 37, .52) !important;

  --mf-nav-bg: var(--mf-pf-bg) !important;
  --mf-nav-surface: var(--mf-pf-panel) !important;
  --mf-nav-surface-2: var(--mf-pf-inset) !important;
  --mf-nav-line: var(--mf-pf-line) !important;
  --mf-nav-line-strong: var(--mf-pf-line) !important;

  --hiw-bg: var(--mf-pf-bg) !important;
  --hiw-panel: var(--mf-pf-panel) !important;
  --hiw-panel-strong: var(--mf-pf-inset) !important;
  --hiw-line: var(--mf-pf-line) !important;
  --hiw-line-strong: var(--mf-pf-line) !important;

  --v-bg: var(--mf-pf-bg) !important;
  --v-panel: var(--mf-pf-panel) !important;
  --v-panel2: var(--mf-pf-inset) !important;
  --v-line: var(--mf-pf-line) !important;
  --v-line2: var(--mf-pf-line) !important;
}

/* Pump Fee flat app canvas. */
html:not([data-theme="light"]) body {
  background: var(--mf-pf-bg) !important;
  background-color: var(--mf-pf-bg) !important;
  background-image: none !important;
}

/* Shared structural blocks. Keep current radius/spacing/typography. */
html:not([data-theme="light"]) body :where(
  .panel,
  .glass:not(.viewport-wrap),
  .mf-infra,
  .activity-panel,
  .flow-hero,
  .flow-toolbar,
  .pagination,
  .mf-vault-card,
  .mf-vault-status-panel,
  .mf-vault-topbar,
  .mf293-settings-group,
  .settings-group,
  .settings-context,
  .mf-theme-appearance,
  .mf-hiw-status-card,
  .mf-hiw-map-shell,
  .mf-hiw-money,
  .mf-hiw-cta,
  .ap-source,
  .ap-panel
) {
  background: var(--mf-pf-panel) !important;
  background-color: var(--mf-pf-panel) !important;
  background-image: none !important;
  border-color: var(--mf-pf-line) !important;
  box-shadow: none !important;
}

/* Pump Fee token/card tone. */
html:not([data-theme="light"]) body :where(
  .token-row,
  .token-card,
  .token-card-expanded,
  .scanner-card,
  .mf-paper-position,
  .mf-paper-proposal,
  .mf-paper-status
) {
  background: var(--mf-pf-card) !important;
  background-color: var(--mf-pf-card) !important;
  background-image: none !important;
  border-color: var(--mf-pf-line) !important;
  box-shadow: none !important;
}

/* Nested / elevated neutral surfaces. */
html:not([data-theme="light"]) body :where(
  .metric,
  .metric-card,
  .approval-row,
  .selected-metrics > div,
  .control-section,
  .wallet-card,
  .wallet-security,
  .wallet-stat,
  .wallet-session-note,
  .wallet-rule,
  .subscription-metric,
  .plan-card,
  .live-lock,
  .data-row,
  .settings-summary > div,
  .setting-field input,
  .setting-field select,
  .toggle-row,
  .execution-readiness,
  .primary-blocker,
  .signal-explainer,
  .execution-check-list,
  .wallet-note,
  .wallet-network,
  .wallet-option,
  .mobile-wallet-card,
  .mf-vault-row,
  .mf-vault-stat,
  .mf-vault-action,
  .mf-vault-note,
  .mf-hiw-status-stack > div,
  .mf-hiw-node,
  .mf-hiw-step,
  .mf-hiw-control-card,
  .mf-hiw-faq details,
  .mf-hiw-money-flow > div,
  .mf-paper-grid > div
) {
  background: var(--mf-pf-inset) !important;
  background-color: var(--mf-pf-inset) !important;
  background-image: none !important;
  border-color: var(--mf-pf-line) !important;
  box-shadow: none !important;
}

/* Trading: force only the main modules to Pump Fee primary block color.
   Candidate/recent-trade rows keep their current continuous-list behavior. */
html:not([data-theme="light"])
body.mf-page-trading.mf-trading-terminal
.terminal > .panel,
html:not([data-theme="light"])
body.mf-page-trading.mf-trading-terminal
.center-stack > .panel {
  background: var(--mf-pf-panel) !important;
  background-color: var(--mf-pf-panel) !important;
  background-image: none !important;
  border-color: var(--mf-pf-line) !important;
  box-shadow: none !important;
}

/* How It Works detail strip is a nested Pump Fee surface. */
html:not([data-theme="light"]) body.mf-page-how-it-works .mf-hiw-map-detail {
  background: var(--mf-pf-inset) !important;
  border-color: var(--mf-pf-line) !important;
}

/* Drawer/modal neutral surfaces follow Pump Fee without changing interactions. */
html:not([data-theme="light"]) body :where(
  .mf-nav-drawer,
  .mf293-settings-panel,
  .modal,
  .mobile-menu
) {
  background: var(--mf-pf-panel) !important;
  background-color: var(--mf-pf-panel) !important;
  background-image: none !important;
  border-color: var(--mf-pf-line) !important;
}

/* Neutral separators only. Semantic status/accent colors remain authoritative. */
html:not([data-theme="light"]) body :where(
  .panel-head,
  .chart-head,
  .candidate-filter,
  .timeframes,
  .indicator-bar,
  .details,
  .tx-details,
  .doc-section,
  footer
) {
  border-color: var(--mf-pf-line) !important;
}

/* IMPORTANT: System Overview 3D viewport/canvas remains untouched. */
html:not([data-theme="light"]) body.mf-page-system :where(
  .viewport-wrap,
  #memeflowTrue3DHost,
  #memeflowTrue3DCanvas,
  #systemCanvas
) {
  /* intentionally no background override */
}


/* ========================================================================
   MEMEFLOW — PUMP FEE BUTTON + FRAME CONTRACT V166
   Exact neutral reference from Pump Fee Routing:
     border/divider       #252525
     secondary button     #111111
     hover/inset          #171717
     inactive text        #777777 / #AAAAAA
     active/primary text  #FFFFFF
     primary CTA          #FFFFFF background / #000000 text

   Dark mode only. Semantic action colors (buy/sell, approve/reject, danger,
   status/state colors) remain functional and are intentionally not flattened.
   ======================================================================== */

html:not([data-theme="light"]) {
  --mf-pf-button: #111111;
  --mf-pf-button-hover: #171717;
  --mf-pf-button-text: #aaaaaa;
  --mf-pf-button-muted: #777777;
  --mf-pf-button-active: #ffffff;
  --mf-pf-primary-bg: #ffffff;
  --mf-pf-primary-text: #000000;

  /* Pump Fee uses normal 1 CSS px #252525 frames, not Retina hairlines. */
  --mf-structure-hairline: 1px !important;
  --mf-x-dark-hairline: 1px !important;
}

/* ------------------------------------------------------------------------
   FRAMES / OUTLINES
   Flat Pump Fee treatment: 1px #252525, no glow, no gradient-owned frame.
   Existing component radius and spacing are preserved.
   ------------------------------------------------------------------------ */

html:not([data-theme="light"]) body :where(
  .panel,
  .glass:not(.viewport-wrap),
  .mf-infra,
  .activity-panel,
  .flow-hero,
  .flow-toolbar,
  .pagination,
  .mf-vault-card,
  .mf-vault-status-panel,
  .mf-vault-topbar,
  .mf293-settings-group,
  .settings-group,
  .settings-context,
  .mf-theme-appearance,
  .mf-hiw-status-card,
  .mf-hiw-map-shell,
  .mf-hiw-money,
  .mf-hiw-cta,
  .ap-source,
  .ap-panel,
  .ap-kpis article,
  .oi-panel,
  .oi-stat
) {
  border-width: 1px !important;
  border-style: solid !important;
  border-color: var(--mf-pf-line) !important;
  box-shadow: none !important;
}

html:not([data-theme="light"]) body :where(
  .token-row,
  .token-card,
  .token-card-expanded,
  .scanner-card,
  .metric,
  .metric-card,
  .wallet-card,
  .wallet-security,
  .wallet-stat,
  .wallet-session-note,
  .wallet-rule,
  .subscription-metric,
  .plan-card,
  .data-row,
  .mf-vault-row,
  .mf-vault-stat,
  .mf-vault-action,
  .mf-vault-note,
  .mf-hiw-node,
  .mf-hiw-step,
  .mf-hiw-control-card,
  .mf-hiw-faq details,
  .mf-hiw-money-flow > div,
  .mf-paper-position,
  .mf-paper-proposal,
  .mf-paper-status,
  .mf-paper-grid > div
) {
  border-width: 1px !important;
  border-style: solid !important;
  border-color: var(--mf-pf-line) !important;
  box-shadow: none !important;
}

/* Shared neutral separators. */
html:not([data-theme="light"]) body :where(
  .panel-head,
  .chart-head,
  .candidate-filter,
  .timeframes,
  .indicator-bar,
  .selected-metrics,
  .details,
  .tx-details,
  .doc-section,
  footer
) {
  border-color: var(--mf-pf-line) !important;
}

/* ------------------------------------------------------------------------
   SECONDARY / NEUTRAL BUTTONS
   Pump Fee neutral action: #111 / #252525 / gray text.
   ------------------------------------------------------------------------ */

html:not([data-theme="light"]) body :where(
  .tool-btn,
  .ghost-btn,
  .refresh-info button,
  .pagination button,
  .strategy-summary-panel .strategy-edit-link,
  .mf293-settings-head-actions button,
  .mf293-secondary,
  .mf-hiw-btn-ghost,
  .ap-refresh,
  .oi-btn.ghost,
  .oi-btn:not(.primary):not(.danger):not(.ghost),
  .inspector-foot button
) {
  border: 1px solid var(--mf-pf-line) !important;
  background: var(--mf-pf-button) !important;
  background-color: var(--mf-pf-button) !important;
  background-image: none !important;
  color: var(--mf-pf-button-text) !important;
  box-shadow: none !important;
}

html:not([data-theme="light"]) body :where(
  .tool-btn,
  .ghost-btn,
  .refresh-info button,
  .pagination button,
  .strategy-summary-panel .strategy-edit-link,
  .mf293-settings-head-actions button,
  .mf293-secondary,
  .mf-hiw-btn-ghost,
  .ap-refresh,
  .oi-btn.ghost,
  .oi-btn:not(.primary):not(.danger):not(.ghost),
  .inspector-foot button
):hover,
html:not([data-theme="light"]) body :where(
  .tool-btn,
  .ghost-btn,
  .refresh-info button,
  .pagination button,
  .strategy-summary-panel .strategy-edit-link,
  .mf293-settings-head-actions button,
  .mf293-secondary,
  .mf-hiw-btn-ghost,
  .ap-refresh,
  .oi-btn.ghost,
  .oi-btn:not(.primary):not(.danger):not(.ghost),
  .inspector-foot button
):focus-visible {
  border-color: var(--mf-pf-line) !important;
  background: var(--mf-pf-button-hover) !important;
  background-color: var(--mf-pf-button-hover) !important;
  color: var(--mf-pf-button-active) !important;
  box-shadow: none !important;
  outline-color: var(--mf-pf-line) !important;
}

/* Header wallet/connect action follows Pump Fee's white launch pill. */
html:not([data-theme="light"]) body .wallet-btn {
  border: 1px solid #ffffff !important;
  background: var(--mf-pf-primary-bg) !important;
  background-color: var(--mf-pf-primary-bg) !important;
  background-image: none !important;
  color: var(--mf-pf-primary-text) !important;
  box-shadow: none !important;
}

html:not([data-theme="light"]) body .wallet-btn:hover,
html:not([data-theme="light"]) body .wallet-btn:focus-visible {
  border-color: #e8e8e8 !important;
  background: #e8e8e8 !important;
  color: #000000 !important;
  box-shadow: none !important;
}

/* ------------------------------------------------------------------------
   PRIMARY CTA BUTTONS
   Pump Fee primary action = white button, black text.
   Transaction-semantic buttons are NOT included here.
   ------------------------------------------------------------------------ */

html:not([data-theme="light"]) body :where(
  .btn.primary,
  .mf293-primary,
  .mf-hiw-btn-primary,
  .mf-vault-btn-primary,
  .oi-btn.primary
) {
  border: 1px solid #ffffff !important;
  background: var(--mf-pf-primary-bg) !important;
  background-color: var(--mf-pf-primary-bg) !important;
  background-image: none !important;
  color: var(--mf-pf-primary-text) !important;
  box-shadow: none !important;
}

html:not([data-theme="light"]) body :where(
  .btn.primary,
  .mf293-primary,
  .mf-hiw-btn-primary,
  .mf-vault-btn-primary,
  .oi-btn.primary
):hover,
html:not([data-theme="light"]) body :where(
  .btn.primary,
  .mf293-primary,
  .mf-hiw-btn-primary,
  .mf-vault-btn-primary,
  .oi-btn.primary
):focus-visible {
  border-color: #e8e8e8 !important;
  background: #e8e8e8 !important;
  background-color: #e8e8e8 !important;
  color: #000000 !important;
  box-shadow: none !important;
}

/* Disabled buttons keep the same Pump Fee family without looking active. */
html:not([data-theme="light"]) body :where(
  .wallet-btn,
  .btn.primary,
  .mf293-primary,
  .mf-hiw-btn-primary,
  .mf-vault-btn-primary,
  .oi-btn.primary
):disabled {
  opacity: .35 !important;
  cursor: default !important;
}

/* ------------------------------------------------------------------------
   TAB / FILTER CONTROLS
   Pump Fee tabs are text-first: transparent background, no cyan boxes.
   Active state becomes white text. Semantic status filters are excluded.
   ------------------------------------------------------------------------ */

html:not([data-theme="light"]) body.mf-page-trading.mf-trading-terminal
.candidates-panel .candidate-filter > button[data-filter],
html:not([data-theme="light"]) body.mf-page-trading.mf-trading-terminal
.timeframes > button,
html:not([data-theme="light"]) body.mf-page-trading.mf-trading-terminal
.indicator-bar button,
html:not([data-theme="light"]) body.mf-page-agent-performance
.ap-periods button,
html:not([data-theme="light"]) body.mf-page-system-tokens
.mf-sort-direction-v25 button,
html:not([data-theme="light"]) body.mf-page-system-tokens
.mf-time-window-v47c button {
  border-color: transparent !important;
  background: transparent !important;
  background-color: transparent !important;
  background-image: none !important;
  color: var(--mf-pf-button-muted) !important;
  box-shadow: none !important;
}

html:not([data-theme="light"]) body.mf-page-trading.mf-trading-terminal
.candidates-panel .candidate-filter > button[data-filter].active,
html:not([data-theme="light"]) body.mf-page-trading.mf-trading-terminal
.timeframes > button.active,
html:not([data-theme="light"]) body.mf-page-trading.mf-trading-terminal
.indicator-bar button:is(.active,[aria-pressed="true"]),
html:not([data-theme="light"]) body.mf-page-agent-performance
.ap-periods button.active,
html:not([data-theme="light"]) body.mf-page-system-tokens
.mf-sort-direction-v25 button.is-active,
html:not([data-theme="light"]) body.mf-page-system-tokens
.mf-time-window-v47c button.is-active {
  border-color: transparent !important;
  background: transparent !important;
  background-color: transparent !important;
  background-image: none !important;
  color: #ffffff !important;
  box-shadow: none !important;
}

/* Pump Fee active tabs do not need a colored underline/fill. */
html:not([data-theme="light"]) body.mf-page-trading.mf-trading-terminal
.indicator-bar button::after,
html:not([data-theme="light"]) body.mf-page-trading.mf-trading-terminal
.indicator-bar button:is(.active,[aria-pressed="true"])::after {
  background: transparent !important;
}

/* Settings appearance segmented control uses the Pump Fee neutral surface. */
html:not([data-theme="light"]) body .mf-theme-segmented {
  border: 1px solid var(--mf-pf-line) !important;
  background: var(--mf-pf-panel) !important;
  box-shadow: none !important;
}

html:not([data-theme="light"]) body .mf-theme-segmented button {
  border-color: transparent !important;
  background: transparent !important;
  color: var(--mf-pf-button-muted) !important;
  box-shadow: none !important;
}

html:not([data-theme="light"]) body .mf-theme-segmented button.is-active {
  border-color: transparent !important;
  background: var(--mf-pf-inset) !important;
  color: #ffffff !important;
  box-shadow: none !important;
}

/* ------------------------------------------------------------------------
   EXPLICIT SEMANTIC EXCLUSIONS
   Keep state/action meaning while normalizing only their neutral frame weight.
   ------------------------------------------------------------------------ */

html:not([data-theme="light"]) body :where(
  .approval-reject,
  .approval-approve,
  .positions-panel .close-position,
  .oi-btn.danger,
  .state-pill,
  .status-pill,
  .decision-badge,
  .copy-trade-badge
) {
  border-width: 1px !important;
  box-shadow: none !important;
}

/* Details disclosure button was intentionally frameless in Memflow. */
html:not([data-theme="light"]) body .details-button {
  border: 0 !important;
  background: transparent !important;
  box-shadow: none !important;
}

/* System Overview 3D viewport/canvas remains untouched by frame/background rules. */
html:not([data-theme="light"]) body.mf-page-system :where(
  .viewport-wrap,
  #memeflowTrue3DHost,
  #memeflowTrue3DCanvas,
  #systemCanvas
) {
  /* intentionally untouched */
}

/* MEMEFLOW_PUMP_FEE_UI_V166_END */

/* ========================================================================
   MEMEFLOW — PUMP FEE TEXT COLOR CONTRACT V166
   Source: Pump Fee Routing dark typography hierarchy.

   Primary       #F5F5F5 / #FFFFFF
   Secondary     #AAAAAA
   Soft          #B9B9B9
   Muted         #8B8B8B
   Meta          #777777
   Faint         #666666

   Dark mode only.
   Semantic status/action colors are intentionally preserved.
   ======================================================================== */

html:not([data-theme="light"]) {
  --mf-pf-text: #f5f5f5;
  --mf-pf-text-strong: #ffffff;
  --mf-pf-text-secondary: #aaaaaa;
  --mf-pf-text-soft: #b9b9b9;
  --mf-pf-text-muted: #8b8b8b;
  --mf-pf-text-meta: #777777;
  --mf-pf-text-faint: #666666;

  --text: var(--mf-pf-text) !important;
  --muted: var(--mf-pf-text-muted) !important;
  --faint: var(--mf-pf-text-faint) !important;

  --mf-app-text: var(--mf-pf-text) !important;
  --mf-app-muted: var(--mf-pf-text-muted) !important;

  --mf-nav-text: var(--mf-pf-text) !important;
  --mf-nav-muted: var(--mf-pf-text-muted) !important;

  --hiw-text: var(--mf-pf-text) !important;
  --hiw-muted: var(--mf-pf-text-muted) !important;
  --hiw-muted-2: var(--mf-pf-text-secondary) !important;

  --v-text: var(--mf-pf-text) !important;
  --v-muted: var(--mf-pf-text-muted) !important;
  --v-muted2: var(--mf-pf-text-secondary) !important;

  --mf-text-primary: var(--mf-pf-text) !important;
  --mf-text-secondary: var(--mf-pf-text-secondary) !important;
  --mf-text-tertiary: var(--mf-pf-text-meta) !important;
}

/* Main titles / values / names. */
html:not([data-theme="light"]) body :where(
  h1, h2, h3,
  .brand-title,
  .brand,
  .header-title > span,
  .mf-settings-page-title > span,
  .mf-vault-brand-copy > strong,
  .mf-hiw-brand-copy > strong,
  .scene-title h1,
  .activity-head h2,
  .token-symbol,
  .token-name,
  .candidate-name strong,
  .token-title h1,
  .selected-metrics strong,
  .summary-card strong,
  .metric-card strong,
  .telemetry-item strong,
  .mf-vault-card h2,
  .mf-vault-card strong,
  .mf-hiw-node strong,
  .mf-hiw-section-head h2,
  .mf-hiw-money h2,
  .mf-hiw-cta h2,
  .ap-kpis strong,
  .ap-head h2,
  .oi-panel h2,
  .oi-stat strong
) {
  color: var(--mf-pf-text) !important;
}

/* Secondary descriptive copy. */
html:not([data-theme="light"]) body :where(
  p,
  .panel-copy,
  .token-meta,
  .candidate-bottom,
  .scene-title p,
  .mf-vault-card p,
  .mf-vault-hero p,
  .mf-hiw-hero-copy > p,
  .mf-hiw-section-head > p,
  .mf-hiw-status-card > p,
  .mf-hiw-map-detail p,
  .mf-hiw-step p,
  .mf-hiw-control-card li,
  .mf-hiw-money-copy p,
  .mf-hiw-faq details p,
  .oi-notice span
) {
  color: var(--mf-pf-text-secondary) !important;
}

/* Labels / subtitles / metadata. */
html:not([data-theme="light"]) body :where(
  .brand-sub,
  .subtitle,
  .header-title > strong,
  .mf-settings-page-title > strong,
  .mf-vault-brand-copy > small,
  .mf-hiw-brand-copy > small,
  .eyebrow,
  .muted,
  .candidate-name span,
  .selected-metrics span,
  .summary-card span,
  .hero-counter span,
  .token-card-meta span,
  .telemetry-item span,
  .telemetry-item small,
  .node-label small,
  .mf-vault-card small,
  .mf-hiw-node small,
  .mf293-field-label,
  .mf293-settings-group summary small,
  .mf-theme-appearance-copy small,
  .mf-theme-appearance-label,
  .mf-theme-current,
  .ap-kpis span,
  .ap-kpis small,
  .oi-ai-status
) {
  color: var(--mf-pf-text-muted) !important;
}

/* Tiny / tertiary UI text. */
html:not([data-theme="light"]) body :where(
  .chart-legend,
  .chart-legend span,
  .page-state,
  .contract,
  .note,
  .update-note,
  .footer-brand p,
  .footer-brand span,
  .mf-nav-link-sub,
  .mf-nav-foot span
) {
  color: var(--mf-pf-text-meta) !important;
}

/* Navigation titles stay readable. */
html:not([data-theme="light"]) body :where(
  .mf-nav-link-title,
  .mf-nav-drawer-title
) {
  color: var(--mf-pf-text) !important;
}

html:not([data-theme="light"]) body .mf-nav-link-arrow {
  color: var(--mf-pf-text-meta) !important;
}

/* Neutral buttons inherit Pump Fee text hierarchy. */
html:not([data-theme="light"]) body :where(
  .tool-btn,
  .ghost-btn,
  .refresh-info button,
  .pagination button,
  .strategy-summary-panel .strategy-edit-link,
  .mf293-settings-head-actions button,
  .mf293-secondary,
  .mf-hiw-btn-ghost,
  .ap-refresh,
  .oi-btn.ghost,
  .oi-btn:not(.primary):not(.danger):not(.ghost),
  .inspector-foot button
) {
  color: var(--mf-pf-text-secondary) !important;
}

html:not([data-theme="light"]) body :where(
  .tool-btn,
  .ghost-btn,
  .refresh-info button,
  .pagination button,
  .strategy-summary-panel .strategy-edit-link,
  .mf293-settings-head-actions button,
  .mf293-secondary,
  .mf-hiw-btn-ghost,
  .ap-refresh,
  .oi-btn.ghost,
  .oi-btn:not(.primary):not(.danger):not(.ghost),
  .inspector-foot button
):hover,
html:not([data-theme="light"]) body :where(
  .tool-btn,
  .ghost-btn,
  .refresh-info button,
  .pagination button,
  .strategy-summary-panel .strategy-edit-link,
  .mf293-settings-head-actions button,
  .mf293-secondary,
  .mf-hiw-btn-ghost,
  .ap-refresh,
  .oi-btn.ghost,
  .oi-btn:not(.primary):not(.danger):not(.ghost),
  .inspector-foot button
):focus-visible {
  color: var(--mf-pf-text-strong) !important;
}

/* Keep meaning-bearing colors intact. */
html:not([data-theme="light"]) body :where(
  .approval-reject,
  .approval-approve,
  .positions-panel .close-position,
  .oi-btn.danger,
  .state-pill.ready,
  .state-pill.watch,
  .state-pill.blocked,
  .status-pill.live,
  .status-pill.live-locked,
  .copy-trade-badge,
  .decision-badge,
  .positive,
  .negative,
  .mf-positive,
  .mf-negative
) {
  /* semantic color remains owned by its component/state rule */
}

/* MEMEFLOW_PUMP_FEE_TEXT_COLOR_V166_END */

/* ========================================================================
   MEMEFLOW PURE BLACK SURFACE + DIVIDER CONTRACT V166

   User-requested dark-mode authority:
     canvas / page background  #000000
     all neutral blocks        #000000
     all neutral cards         #000000
     all neutral inset areas   #000000
     frame / divider           #252525
     divider style             1px solid
     gradients                 none
     neutral shadows/glow      none

   Light mode is untouched.
   Semantic state colors/actions remain functional.
   3D canvas content itself is not recolored.
   ======================================================================== */

html:not([data-theme="light"]) {
  color-scheme: dark;

  --mf-pb-bg: #000000;
  --mf-pb-surface: #000000;
  --mf-pb-line: #252525;

  --bg: #000000 !important;
  --panel: #000000 !important;
  --panel-solid: #000000 !important;
  --panel-2: #000000 !important;
  --surface: #000000 !important;
  --surface2: #000000 !important;
  --surface3: #000000 !important;
  --surface-2: #000000 !important;
  --line: #252525 !important;
  --line2: #252525 !important;
  --line-strong: #252525 !important;

  --mf-app-bg: #000000 !important;
  --mf-app-surface: #000000 !important;
  --mf-app-surface-2: #000000 !important;
  --mf-app-surface-3: #000000 !important;
  --mf-app-panel-top: #000000 !important;
  --mf-app-panel-bottom: #000000 !important;
  --mf-app-line: #252525 !important;
  --mf-app-line-strong: #252525 !important;

  --mf-nav-bg: #000000 !important;
  --mf-nav-surface: #000000 !important;
  --mf-nav-surface-2: #000000 !important;
  --mf-nav-line: #252525 !important;
  --mf-nav-line-strong: #252525 !important;

  --hiw-bg: #000000 !important;
  --hiw-panel: #000000 !important;
  --hiw-panel-strong: #000000 !important;
  --hiw-line: #252525 !important;
  --hiw-line-strong: #252525 !important;
  --hiw-shadow: none !important;

  --v-bg: #000000 !important;
  --v-panel: #000000 !important;
  --v-panel2: #000000 !important;
  --v-line: #252525 !important;
  --v-line2: #252525 !important;

  --mf-dark-canvas: #000000 !important;
  --mf-dark-surface-1: #000000 !important;
  --mf-dark-surface-2: #000000 !important;
  --mf-dark-line: #252525 !important;

  --mf-x-dark-canvas: #000000 !important;
  --mf-x-dark-inset: #000000 !important;
  --mf-x-dark-line: #252525 !important;

  --mf-structure-outer: #252525 !important;
  --mf-structure-divider: #252525 !important;
  --mf-structure-ultra: #252525 !important;
  --mf-structure-hairline: 1px !important;
  --mf-x-dark-hairline: 1px !important;
}

/* Entire page canvas is pure black. */
html:not([data-theme="light"]),
html:not([data-theme="light"]) body,
html:not([data-theme="light"]) body[class] {
  background: #000000 !important;
  background-color: #000000 !important;
  background-image: none !important;
}

/* Shared header/navigation surfaces are pure black. */
html:not([data-theme="light"]) body :where(
  .mf-site-header,
  .mf-nav-drawer,
  .sidebar,
  .topbar,
  .flow-header,
  .mf-vault-topbar,
  .mf-hiw-topbar
) {
  background: #000000 !important;
  background-color: #000000 !important;
  background-image: none !important;
  box-shadow: none !important;
}

/* All neutral structural blocks/cards: pure black only. */
html:not([data-theme="light"]) body :where(
  .panel,
  .glass:not(.viewport-wrap),
  .mf-infra,
  .activity-panel,
  .flow-hero,
  .flow-toolbar,
  .pagination,
  .summary-card,
  .token-row,
  .flow-token,
  .token-card,
  .token-card-expanded,
  .scanner-card,
  .metric,
  .metric-card,
  .candidate,
  .position-row,
  .trade-row,
  .approval-row,
  .selected-metrics,
  .strategy-summary-panel,
  .strategy-summary-list,
  .strategy-summary-row,
  .wallet-card,
  .wallet-security,
  .wallet-stat,
  .wallet-session-note,
  .wallet-rule,
  .subscription-metric,
  .plan-card,
  .live-lock,
  .system-health-summary > div,
  .data-row,
  .settings-summary > div,
  .settings-context,
  .settings-group,
  .mode-option label,
  .profile-option label,
  .setting-field input,
  .setting-field select,
  .toggle-row,
  .execution-readiness,
  .primary-blocker,
  .signal-explainer,
  .execution-check-list,
  .wallet-note,
  .wallet-network,
  .wallet-option,
  .mobile-wallet-card,
  .explain-step,
  .production-empty,
  .mf293-settings-panel,
  .mf293-settings-group,
  .mf293-field,
  .mf-theme-appearance,
  .mf-theme-segmented,
  .mf-vault-card,
  .mf-vault-status-panel,
  .mf-vault-row,
  .mf-vault-stat,
  .mf-vault-action,
  .mf-vault-note,
  .mf-hiw-status-card,
  .mf-hiw-map-shell,
  .mf-hiw-map-detail,
  .mf-hiw-node,
  .mf-hiw-step,
  .mf-hiw-control-card,
  .mf-hiw-money,
  .mf-hiw-money-flow > div,
  .mf-hiw-faq details,
  .mf-hiw-cta,
  .ap-source,
  .ap-panel,
  .ap-kpis article,
  .oi-panel,
  .oi-stat,
  .oi-notice,
  .mf-paper-position,
  .mf-paper-proposal,
  .mf-paper-status,
  .mf-paper-grid > div
) {
  background: #000000 !important;
  background-color: #000000 !important;
  background-image: none !important;
  box-shadow: none !important;
}

/* Exact frame language: one simple #252525 line. */
html:not([data-theme="light"]) body :where(
  .panel,
  .glass:not(.viewport-wrap),
  .mf-infra,
  .activity-panel,
  .flow-hero,
  .flow-toolbar,
  .pagination,
  .summary-card,
  .token-row,
  .flow-token,
  .token-card,
  .token-card-expanded,
  .scanner-card,
  .metric,
  .metric-card,
  .wallet-card,
  .wallet-security,
  .wallet-stat,
  .subscription-metric,
  .plan-card,
  .data-row,
  .settings-context,
  .settings-group,
  .mf293-settings-panel,
  .mf293-settings-group,
  .mf293-field,
  .mf-theme-appearance,
  .mf-theme-segmented,
  .mf-vault-card,
  .mf-vault-status-panel,
  .mf-vault-row,
  .mf-vault-stat,
  .mf-vault-action,
  .mf-vault-note,
  .mf-hiw-status-card,
  .mf-hiw-map-shell,
  .mf-hiw-node,
  .mf-hiw-step,
  .mf-hiw-control-card,
  .mf-hiw-money,
  .mf-hiw-money-flow > div,
  .mf-hiw-faq details,
  .ap-source,
  .ap-panel,
  .ap-kpis article,
  .oi-panel,
  .oi-stat,
  .mf-paper-position,
  .mf-paper-proposal,
  .mf-paper-status,
  .mf-paper-grid > div
) {
  border-width: 1px !important;
  border-style: solid !important;
  border-color: #252525 !important;
  box-shadow: none !important;
}

/* Divider/separator lines: same exact style everywhere. */
html:not([data-theme="light"]) body :where(
  .panel-head,
  .chart-head,
  .candidate-filter,
  .timeframes,
  .indicator-bar,
  .selected-metrics,
  .strategy-summary-foot,
  .details,
  .tx-details,
  .doc-section,
  .mf293-settings-head,
  .mf293-settings-meta,
  .mf293-settings-footer,
  .mf-hiw-status-head,
  .mf-hiw-map-detail,
  .mf-nav-drawer-head,
  .mf-nav-link,
  .mf-nav-foot,
  footer
) {
  border-color: #252525 !important;
  box-shadow: none !important;
}

/* Trading/list row separators: clean, full neutral line. */
html:not([data-theme="light"]) body.mf-page-trading.mf-trading-terminal
:where(.candidate, .position-row, .trade-row.trade-log-row)::after {
  background: #252525 !important;
  height: 1px !important;
  opacity: 1 !important;
}

/* System Token Flow separators. */
html:not([data-theme="light"]) body.mf-page-system-tokens
.token-list > .flow-token {
  border-color: #252525 !important;
}

/* Neutral fields/inputs also stay pure black. */
html:not([data-theme="light"]) body :where(
  input,
  select,
  textarea,
  .home-preview-input,
  .filter-row input,
  .launch-form input,
  .launch-form select
) {
  background: #000000 !important;
  background-color: #000000 !important;
  background-image: none !important;
  border-color: #252525 !important;
  box-shadow: none !important;
}

/* Keep the actual 3D viewport/canvas content untouched.
   Only its outer frame follows the common line if present. */
html:not([data-theme="light"]) body.mf-page-system .viewport-wrap {
  border: 1px solid #252525 !important;
  box-shadow: none !important;
}

/* Prevent old decorative neutral overlays/gradients from reappearing. */
html:not([data-theme="light"]) body :where(
  .viewport-wrap:after,
  .home-hero-media-empty
) {
  box-shadow: none !important;
}

/* Semantic status/action colors intentionally remain owned by existing rules. */
/* MEMEFLOW_PURE_BLACK_SURFACE_DIVIDERS_V166_END */

/* ========================================================================
   MEMEFLOW — X.COM LIGHTS OUT TYPOGRAPHY + LINE CONTRACT V166

   X Lights Out neutral reference:
     background       #000000
     primary text     #E7E9EA
     strong text      #FFFFFF
     secondary/meta   #71767B
     tertiary         #536471
     faint            #3E4A55
     links / focus    #1D9BF0
     border/divider   #2F3336
     line thickness   1px

   Pure-black surfaces from V165 remain authoritative.
   Semantic trading/status colors remain functional.
   Light mode is untouched.
   ======================================================================== */

html:not([data-theme="light"]) {
  color-scheme: dark;

  --mf-x-bg: #000000;
  --mf-x-text: #e7e9ea;
  --mf-x-text-strong: #ffffff;
  --mf-x-text-muted: #71767b;
  --mf-x-text-tertiary: #536471;
  --mf-x-text-faint: #3e4a55;
  --mf-x-blue: #1d9bf0;
  --mf-x-line: #2f3336;

  --text: #e7e9ea !important;
  --muted: #71767b !important;
  --faint: #536471 !important;

  --mf-app-text: #e7e9ea !important;
  --mf-app-muted: #71767b !important;

  --mf-nav-text: #e7e9ea !important;
  --mf-nav-muted: #71767b !important;

  --hiw-text: #e7e9ea !important;
  --hiw-muted: #71767b !important;
  --hiw-muted-2: #536471 !important;

  --v-text: #e7e9ea !important;
  --v-muted: #71767b !important;
  --v-muted2: #536471 !important;

  --mf-text-primary: #e7e9ea !important;
  --mf-text-secondary: #71767b !important;
  --mf-text-tertiary: #536471 !important;

  --line: #2f3336 !important;
  --line2: #2f3336 !important;
  --line-strong: #2f3336 !important;

  --mf-app-line: #2f3336 !important;
  --mf-app-line-strong: #2f3336 !important;

  --mf-nav-line: #2f3336 !important;
  --mf-nav-line-strong: #2f3336 !important;

  --hiw-line: #2f3336 !important;
  --hiw-line-strong: #2f3336 !important;

  --v-line: #2f3336 !important;
  --v-line2: #2f3336 !important;

  --mf-dark-line: #2f3336 !important;
  --mf-x-dark-line: #2f3336 !important;
  --mf-structure-outer: #2f3336 !important;
  --mf-structure-divider: #2f3336 !important;
  --mf-structure-ultra: #2f3336 !important;

  --mf-structure-hairline: 1px !important;
  --mf-x-dark-hairline: 1px !important;
}

/* ------------------------------------------------------------------------
   PRIMARY TEXT
   X uses #E7E9EA for normal reading text.
   ------------------------------------------------------------------------ */
html:not([data-theme="light"]) body,
html:not([data-theme="light"]) body :where(
  p,
  li,
  td,
  th,
  label,
  .panel-copy,
  .token-meta,
  .candidate-bottom,
  .scene-title p,
  .mf-vault-card p,
  .mf-vault-hero p,
  .mf-hiw-hero-copy > p,
  .mf-hiw-section-head > p,
  .mf-hiw-status-card > p,
  .mf-hiw-map-detail p,
  .mf-hiw-step p,
  .mf-hiw-control-card li,
  .mf-hiw-money-copy p,
  .mf-hiw-faq details p
) {
  color: #e7e9ea !important;
}

/* ------------------------------------------------------------------------
   STRONG / DISPLAY TEXT
   X display/CTA strong text = white.
   ------------------------------------------------------------------------ */
html:not([data-theme="light"]) body :where(
  h1, h2, h3, h4,
  .brand-title,
  .brand,
  .header-title > span,
  .mf-settings-page-title > span,
  .mf-vault-brand-copy > strong,
  .mf-hiw-brand-copy > strong,
  .scene-title h1,
  .activity-head h2,
  .token-symbol,
  .token-name,
  .candidate-name strong,
  .token-title h1,
  .selected-metrics strong,
  .summary-card strong,
  .metric-card strong,
  .telemetry-item strong,
  .mf-vault-card h2,
  .mf-vault-card strong,
  .mf-hiw-node strong,
  .mf-hiw-section-head h2,
  .mf-hiw-money h2,
  .mf-hiw-cta h2,
  .ap-kpis strong,
  .ap-head h2,
  .oi-panel h2,
  .oi-stat strong,
  .page-state strong
) {
  color: #ffffff !important;
}

/* ------------------------------------------------------------------------
   MUTED / META TEXT
   X handle, timestamp, counts, metadata = #71767B.
   ------------------------------------------------------------------------ */
html:not([data-theme="light"]) body :where(
  .brand-sub,
  .subtitle,
  .header-title > strong,
  .mf-settings-page-title > strong,
  .mf-vault-brand-copy > small,
  .mf-hiw-brand-copy > small,
  .muted,
  .candidate-name span,
  .candidate-bottom,
  .token-card-meta span,
  .summary-card span,
  .hero-counter span,
  .telemetry-item span,
  .telemetry-item small,
  .node-label small,
  .mf-vault-card small,
  .mf-hiw-node small,
  .mf293-field-label,
  .mf293-settings-group summary small,
  .mf-theme-appearance-copy small,
  .mf-theme-appearance-label,
  .mf-theme-current,
  .ap-kpis span,
  .ap-kpis small,
  .oi-notice span,
  .page-state,
  .contract,
  .note,
  .update-note,
  .footer-brand p,
  .footer-brand span,
  .mf-nav-link-sub,
  .mf-nav-foot span,
  .chart-legend,
  .chart-legend span
) {
  color: #71767b !important;
}

/* ------------------------------------------------------------------------
   TERTIARY / FAINT TEXT
   X quieter captions = #536471; ultra-faint = #3E4A55.
   ------------------------------------------------------------------------ */
html:not([data-theme="light"]) body :where(
  .eyebrow,
  .mf-nav-link-arrow,
  .selected-metrics span,
  .strategy-summary-row span,
  .gate,
  .mf-hiw-status-head > span,
  .mf-hiw-map-detail > span,
  .mf-hiw-money-flow small,
  .mf-hiw-network-note
) {
  color: #536471 !important;
}

html:not([data-theme="light"]) body :where(
  .scene-hint,
  .home-preview-empty
) {
  color: #3e4a55 !important;
}

/* ------------------------------------------------------------------------
   LINKS / FOCUS
   X link + focus blue.
   Do not recolor semantic state controls.
   ------------------------------------------------------------------------ */
html:not([data-theme="light"]) body a:not(
  .mf-nav-link
):not(
  .wallet-btn
):not(
  .mf-hiw-btn
):not(
  .oi-btn
):not(
  .token-pump-link
):not(
  .trade-pump-link
) {
  color: inherit;
}

html:not([data-theme="light"]) body :where(
  .text-link,
  .doc a,
  .mf-link
) {
  color: #1d9bf0 !important;
}

html:not([data-theme="light"]) body :where(
  input,
  select,
  textarea
):focus,
html:not([data-theme="light"]) body :where(
  input,
  select,
  textarea
):focus-visible {
  border-color: #1d9bf0 !important;
  outline: 0 !important;
  box-shadow: 0 0 0 1px #1d9bf0 !important;
}

/* ------------------------------------------------------------------------
   NAVIGATION
   ------------------------------------------------------------------------ */
html:not([data-theme="light"]) body :where(
  .mf-nav-link-title,
  .mf-nav-drawer-title
) {
  color: #e7e9ea !important;
}

html:not([data-theme="light"]) body .mf-nav-link[aria-current="page"] .mf-nav-link-title {
  color: #ffffff !important;
}

html:not([data-theme="light"]) body .mf-nav-link-sub,
html:not([data-theme="light"]) body .mf-nav-foot span {
  color: #71767b !important;
}

/* ------------------------------------------------------------------------
   NEUTRAL BUTTON TEXT
   X inactive neutral = muted; hover/active = primary.
   Primary CTA remains white button with black label from V163/V165.
   ------------------------------------------------------------------------ */
html:not([data-theme="light"]) body :where(
  .tool-btn,
  .ghost-btn,
  .refresh-info button,
  .pagination button,
  .strategy-summary-panel .strategy-edit-link,
  .mf293-settings-head-actions button,
  .mf293-secondary,
  .mf-hiw-btn-ghost,
  .ap-refresh,
  .oi-btn.ghost,
  .oi-btn:not(.primary):not(.danger):not(.ghost),
  .inspector-foot button,
  .mf-theme-segmented button,
  .candidates-panel .candidate-filter > button[data-filter],
  .timeframes > button,
  .indicator-bar button,
  .ap-periods button,
  .mf-sort-direction-v25 button,
  .mf-time-window-v47c button
) {
  color: #71767b !important;
}

html:not([data-theme="light"]) body :where(
  .tool-btn,
  .ghost-btn,
  .refresh-info button,
  .pagination button,
  .strategy-summary-panel .strategy-edit-link,
  .mf293-settings-head-actions button,
  .mf293-secondary,
  .mf-hiw-btn-ghost,
  .ap-refresh,
  .oi-btn.ghost,
  .oi-btn:not(.primary):not(.danger):not(.ghost),
  .inspector-foot button
):hover,
html:not([data-theme="light"]) body :where(
  .tool-btn,
  .ghost-btn,
  .refresh-info button,
  .pagination button,
  .strategy-summary-panel .strategy-edit-link,
  .mf293-settings-head-actions button,
  .mf293-secondary,
  .mf-hiw-btn-ghost,
  .ap-refresh,
  .oi-btn.ghost,
  .oi-btn:not(.primary):not(.danger):not(.ghost),
  .inspector-foot button
):focus-visible {
  color: #e7e9ea !important;
}

html:not([data-theme="light"]) body :where(
  .mf-theme-segmented button.is-active,
  .candidates-panel .candidate-filter > button[data-filter].active,
  .timeframes > button.active,
  .indicator-bar button:is(.active,[aria-pressed="true"]),
  .ap-periods button.active,
  .mf-sort-direction-v25 button.is-active,
  .mf-time-window-v47c button.is-active
) {
  color: #e7e9ea !important;
}

/* ------------------------------------------------------------------------
   ALL NEUTRAL FRAMES / DIVIDERS
   X Lights Out = exactly 1px #2F3336.
   ------------------------------------------------------------------------ */
html:not([data-theme="light"]) body :where(
  .panel,
  .glass:not(.viewport-wrap),
  .mf-infra,
  .activity-panel,
  .flow-hero,
  .flow-toolbar,
  .pagination,
  .summary-card,
  .token-row,
  .flow-token,
  .token-card,
  .token-card-expanded,
  .scanner-card,
  .metric,
  .metric-card,
  .wallet-card,
  .wallet-security,
  .wallet-stat,
  .subscription-metric,
  .plan-card,
  .data-row,
  .settings-context,
  .settings-group,
  .mf293-settings-panel,
  .mf293-settings-group,
  .mf293-field,
  .mf-theme-appearance,
  .mf-theme-segmented,
  .mf-vault-card,
  .mf-vault-status-panel,
  .mf-vault-row,
  .mf-vault-stat,
  .mf-vault-action,
  .mf-vault-note,
  .mf-hiw-status-card,
  .mf-hiw-map-shell,
  .mf-hiw-node,
  .mf-hiw-step,
  .mf-hiw-control-card,
  .mf-hiw-money,
  .mf-hiw-money-flow > div,
  .mf-hiw-faq details,
  .ap-source,
  .ap-panel,
  .ap-kpis article,
  .oi-panel,
  .oi-stat,
  .mf-paper-position,
  .mf-paper-proposal,
  .mf-paper-status,
  .mf-paper-grid > div,
  input,
  select,
  textarea
) {
  border-width: 1px !important;
  border-style: solid !important;
  border-color: #2f3336 !important;
  box-shadow: none !important;
}

/* Internal structural separator lines use the exact same X line. */
html:not([data-theme="light"]) body :where(
  .panel-head,
  .chart-head,
  .candidate-filter,
  .timeframes,
  .indicator-bar,
  .selected-metrics,
  .strategy-summary-foot,
  .details,
  .tx-details,
  .doc-section,
  .mf293-settings-head,
  .mf293-settings-meta,
  .mf293-settings-footer,
  .mf-hiw-status-head,
  .mf-hiw-map-detail,
  .mf-nav-drawer-head,
  .mf-nav-link,
  .mf-nav-foot,
  footer
) {
  border-color: #2f3336 !important;
  box-shadow: none !important;
}

/* Runtime list separators. */
html:not([data-theme="light"]) body.mf-page-trading.mf-trading-terminal
:where(.candidate, .position-row, .trade-row.trade-log-row)::after {
  background: #2f3336 !important;
  height: 1px !important;
  opacity: 1 !important;
}

html:not([data-theme="light"]) body.mf-page-system-tokens
.token-list > .flow-token {
  border-color: #2f3336 !important;
}

/* Keep semantic colors for status/action controls. */
html:not([data-theme="light"]) body :where(
  .approval-reject,
  .approval-approve,
  .positions-panel .close-position,
  .oi-btn.danger,
  .state-pill.ready,
  .state-pill.watch,
  .state-pill.blocked,
  .status-pill.live,
  .status-pill.live-locked,
  .copy-trade-badge,
  .decision-badge,
  .positive,
  .negative,
  .mf-positive,
  .mf-negative
) {
  /* intentionally untouched */
}

/* MEMEFLOW_X_LIGHTS_OUT_TEXT_LINES_V166_END */

CSS

python3 - <<'PY'
from pathlib import Path

pages = [
    Path('memeflow-app/index.html'),
    Path('memeflow-app/agent-performance.html'),
    Path('memeflow-app/how-it-works.html'),
    Path('memeflow-app/settings.html'),
    Path('memeflow-app/smart-vault.html'),
    Path('memeflow-app/system-tokens.html'),
    Path('memeflow-app/system.html'),
    Path('memeflow-app/trading.html'),
    Path('memeflow-app/owner-intelligence.html'),
]
tag = '<link rel="stylesheet" href="/memeflow-x-lights-out-v166.css?v=pump-fee-full-ui-v166-20260922">'
needle = 'memeflow-x-lights-out-v166.css'

for path in pages:
    if not path.exists():
        continue
    text = path.read_text(encoding='utf-8')
    lines = [
        line for line in text.splitlines()
        if needle not in line
        and 'memeflow-pure-black-v165.css' not in line
        and 'memeflow-pump-fee-full-ui-v164.css' not in line
        and 'memeflow-x-lights-out-v166.css' not in line
        and 'memeflow-pump-fee-palette-v162.css' not in line
        and 'memeflow-pump-fee-palette-v163.css' not in line
        and 'memeflow-pump-fee-full-ui-v163.css' not in line
    ]
    text = '\n'.join(lines)
    if text and not text.endswith('\n'):
        text += '\n'
    if '</head>' not in text:
        raise SystemExit(f'ERROR: </head> not found in {path}')
    text = text.replace('</head>', f'  {tag}\n</head>', 1)
    path.write_text(text, encoding='utf-8')
    print(f'updated {path}')
PY

echo
echo "Pump Fee palette V166 installed. No server restart was performed."
echo "Changed files:"
git status --short -- "$APP" || true
