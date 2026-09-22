#!/usr/bin/env bash
set -euo pipefail

APP="memeflow-app"
CANONICAL="$APP/memeflow-x-canonical-v167.css"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP=".memeflow-style-cleanup-v167-backup-$STAMP"
POINTER=".memeflow-style-cleanup-v167-last-backup"

if [ ! -d "$APP" ]; then
  echo "ERROR: $APP not found. Run this from the existing Replit workspace root."
  exit 1
fi

mkdir -p "$BACKUP/memeflow-app"

PAGES=(
  "index.html"
  "agent-performance.html"
  "how-it-works.html"
  "settings.html"
  "smart-vault.html"
  "system-tokens.html"
  "system.html"
  "trading.html"
  "owner-intelligence.html"
)

OLD_CSS=(
  "memeflow-pump-fee-palette-v162.css"
  "memeflow-pump-fee-palette-v163.css"
  "memeflow-pump-fee-full-ui-v164.css"
  "memeflow-pure-black-v165.css"
  "memeflow-x-lights-out-v166.css"
)

OLD_DIRS=(
  "memeflow_pump_fee_v162"
  "memeflow_pump_fee_v163"
  "memeflow_pump_fee_v164"
  "memeflow_pure_black_v165"
  "memeflow_x_text_v166"
)

for page in "${PAGES[@]}"; do
  if [ -f "$APP/$page" ]; then
    cp -p "$APP/$page" "$BACKUP/memeflow-app/$page"
  fi
done

for file in "${OLD_CSS[@]}"; do
  if [ -f "$APP/$file" ]; then
    cp -p "$APP/$file" "$BACKUP/memeflow-app/$file"
  fi
done

if [ -f "$CANONICAL" ]; then
  cp -p "$CANONICAL" "$BACKUP/memeflow-app/$(basename "$CANONICAL").before"
fi

mkdir -p "$BACKUP/root-patch-dirs"
for dir in "${OLD_DIRS[@]}"; do
  if [ -d "$dir" ]; then
    cp -a "$dir" "$BACKUP/root-patch-dirs/"
  fi
done

printf '%s\n' "$BACKUP" > "$POINTER"

cat > "$CANONICAL" <<'CSS'
/* ==========================================================================
   MEMEFLOW X CANONICAL DARK STYLE V167
   Single visual source of truth for the final dark neutral system.

   FINAL CONTRACT
   --------------------------------------------------------------------------
   Canvas / neutral surfaces      #000000
   Primary reading text           #E7E9EA
   Strong / display text          #FFFFFF
   Secondary / metadata text      #71767B
   Tertiary text                  #536471
   Faint text                     #3E4A55
   Link / focus accent            #1D9BF0
   Neutral border / divider       #2F3336
   Neutral secondary button       #111111
   Neutral secondary hover        #171717
   Primary CTA                    #FFFFFF / #000000
   Border / divider thickness     1px

   SCOPE
   --------------------------------------------------------------------------
   - Dark mode only.
   - Light mode remains owned by the existing light-theme files.
   - Layout, spacing, typography sizing, responsive geometry, 3D rendering,
     chart rendering, trading logic and semantic state colors stay owned by
     their existing functional/component files.
   ========================================================================== */

html:not([data-theme="light"]) {
  color-scheme: dark;

  --mf-x-bg: #000000;
  --mf-x-surface: #000000;
  --mf-x-text: #e7e9ea;
  --mf-x-text-strong: #ffffff;
  --mf-x-text-muted: #71767b;
  --mf-x-text-tertiary: #536471;
  --mf-x-text-faint: #3e4a55;
  --mf-x-blue: #1d9bf0;
  --mf-x-line: #2f3336;
  --mf-x-button: #111111;
  --mf-x-button-hover: #171717;

  --bg: #000000 !important;
  --panel: #000000 !important;
  --panel-solid: #000000 !important;
  --panel-2: #000000 !important;
  --surface: #000000 !important;
  --surface2: #000000 !important;
  --surface3: #000000 !important;
  --surface-2: #000000 !important;

  --text: #e7e9ea !important;
  --muted: #71767b !important;
  --faint: #536471 !important;

  --line: #2f3336 !important;
  --line2: #2f3336 !important;
  --line-strong: #2f3336 !important;

  --mf-app-bg: #000000 !important;
  --mf-app-surface: #000000 !important;
  --mf-app-surface-2: #000000 !important;
  --mf-app-surface-3: #000000 !important;
  --mf-app-panel-top: #000000 !important;
  --mf-app-panel-bottom: #000000 !important;
  --mf-app-line: #2f3336 !important;
  --mf-app-line-strong: #2f3336 !important;
  --mf-app-text: #e7e9ea !important;
  --mf-app-muted: #71767b !important;

  --mf-nav-bg: #000000 !important;
  --mf-nav-surface: #000000 !important;
  --mf-nav-surface-2: #000000 !important;
  --mf-nav-line: #2f3336 !important;
  --mf-nav-line-strong: #2f3336 !important;
  --mf-nav-text: #e7e9ea !important;
  --mf-nav-muted: #71767b !important;

  --hiw-bg: #000000 !important;
  --hiw-panel: #000000 !important;
  --hiw-panel-strong: #000000 !important;
  --hiw-line: #2f3336 !important;
  --hiw-line-strong: #2f3336 !important;
  --hiw-text: #e7e9ea !important;
  --hiw-muted: #71767b !important;
  --hiw-muted-2: #536471 !important;
  --hiw-shadow: none !important;

  --v-bg: #000000 !important;
  --v-panel: #000000 !important;
  --v-panel2: #000000 !important;
  --v-line: #2f3336 !important;
  --v-line2: #2f3336 !important;
  --v-text: #e7e9ea !important;
  --v-muted: #71767b !important;
  --v-muted2: #536471 !important;

  --mf-dark-canvas: #000000 !important;
  --mf-dark-surface-1: #000000 !important;
  --mf-dark-surface-2: #000000 !important;
  --mf-dark-line: #2f3336 !important;

  --mf-x-dark-canvas: #000000 !important;
  --mf-x-dark-inset: #000000 !important;
  --mf-x-dark-line: #2f3336 !important;

  --mf-text-primary: #e7e9ea !important;
  --mf-text-secondary: #71767b !important;
  --mf-text-tertiary: #536471 !important;

  --mf-structure-outer: #2f3336 !important;
  --mf-structure-divider: #2f3336 !important;
  --mf-structure-ultra: #2f3336 !important;
  --mf-structure-hairline: 1px !important;
  --mf-x-dark-hairline: 1px !important;
}

/* ==========================================================================
   1. CANVAS + NEUTRAL SURFACES
   ========================================================================== */

html:not([data-theme="light"]),
html:not([data-theme="light"]) body,
html:not([data-theme="light"]) body[class] {
  background: #000000 !important;
  background-color: #000000 !important;
  background-image: none !important;
  color: #e7e9ea !important;
}

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

/* ==========================================================================
   2. TEXT HIERARCHY — X LIGHTS OUT
   ========================================================================== */

html:not([data-theme="light"]) body,
html:not([data-theme="light"]) body :where(
  p,
  li,
  td,
  th,
  label,
  .panel-copy,
  .token-meta,
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

html:not([data-theme="light"]) body :where(
  h1,
  h2,
  h3,
  h4,
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
  .page-state strong,
  .mf-nav-link-title,
  .mf-nav-drawer-title
) {
  color: #ffffff !important;
}

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

html:not([data-theme="light"]) body .mf-nav-link[aria-current="page"] .mf-nav-link-title {
  color: #ffffff !important;
}

html:not([data-theme="light"]) body :where(
  .text-link,
  .doc a,
  .mf-link
) {
  color: #1d9bf0 !important;
}

/* ==========================================================================
   3. FRAMES + DIVIDERS — ONE X RULE
   ========================================================================== */

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

/* ==========================================================================
   4. NEUTRAL BUTTONS
   ========================================================================== */

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
  border: 1px solid #2f3336 !important;
  background: #111111 !important;
  background-color: #111111 !important;
  background-image: none !important;
  color: #71767b !important;
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
  border-color: #2f3336 !important;
  background: #171717 !important;
  background-color: #171717 !important;
  color: #e7e9ea !important;
  box-shadow: none !important;
}

html:not([data-theme="light"]) body :where(
  .wallet-btn,
  .btn.primary,
  .mf293-primary,
  .mf-hiw-btn-primary,
  .mf-vault-btn-primary,
  .oi-btn.primary
) {
  border: 1px solid #ffffff !important;
  background: #ffffff !important;
  background-color: #ffffff !important;
  background-image: none !important;
  color: #000000 !important;
  box-shadow: none !important;
}

html:not([data-theme="light"]) body :where(
  .wallet-btn,
  .btn.primary,
  .mf293-primary,
  .mf-hiw-btn-primary,
  .mf-vault-btn-primary,
  .oi-btn.primary
):hover,
html:not([data-theme="light"]) body :where(
  .wallet-btn,
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

/* ==========================================================================
   5. TABS / FILTERS — TEXT-FIRST
   ========================================================================== */

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
.mf-time-window-v47c button,
html:not([data-theme="light"]) body .mf-theme-segmented button {
  border-color: transparent !important;
  background: transparent !important;
  background-color: transparent !important;
  background-image: none !important;
  color: #71767b !important;
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
.mf-time-window-v47c button.is-active,
html:not([data-theme="light"]) body .mf-theme-segmented button.is-active {
  border-color: transparent !important;
  background: transparent !important;
  background-color: transparent !important;
  background-image: none !important;
  color: #e7e9ea !important;
  box-shadow: none !important;
}

html:not([data-theme="light"]) body.mf-page-trading.mf-trading-terminal
.indicator-bar button::after,
html:not([data-theme="light"]) body.mf-page-trading.mf-trading-terminal
.indicator-bar button:is(.active,[aria-pressed="true"])::after {
  background: transparent !important;
}

/* ==========================================================================
   6. INPUTS + FOCUS
   ========================================================================== */

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
  border-color: #2f3336 !important;
  color: #e7e9ea !important;
  box-shadow: none !important;
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

/* ==========================================================================
   7. INTENTIONAL EXCLUSIONS / PRESERVATION
   ========================================================================== */

/* Token disclosure stays frameless. */
html:not([data-theme="light"]) body .details-button {
  border: 0 !important;
  background: transparent !important;
  box-shadow: none !important;
}

/* System Overview 3D content stays untouched; only the outer frame is neutral. */
html:not([data-theme="light"]) body.mf-page-system .viewport-wrap {
  border: 1px solid #2f3336 !important;
  box-shadow: none !important;
}

/* Semantic state/action colors remain owned by their existing component rules:
   approve/reject, buy/sell, danger, open-position, watch, ready, blocked, P&L. */

/* MEMEFLOW_X_CANONICAL_DARK_STYLE_V167_END */

CSS

python3 - <<'PY'
from pathlib import Path
import re

app = Path("memeflow-app")
pages = [
    "index.html",
    "agent-performance.html",
    "how-it-works.html",
    "settings.html",
    "smart-vault.html",
    "system-tokens.html",
    "system.html",
    "trading.html",
    "owner-intelligence.html",
]

old_names = {
    "memeflow-pump-fee-palette-v162.css",
    "memeflow-pump-fee-palette-v163.css",
    "memeflow-pump-fee-full-ui-v164.css",
    "memeflow-pure-black-v165.css",
    "memeflow-x-lights-out-v166.css",
    "memeflow-x-canonical-v167.css",
}

new_link = '<link rel="stylesheet" href="/memeflow-x-canonical-v167.css?v=x-canonical-v167-20260922">'

for name in pages:
    path = app / name
    if not path.exists():
        print(f"SKIP missing {path}")
        continue

    text = path.read_text(encoding="utf-8")

    # Remove every recent incremental style link, including duplicate canonical links.
    lines = []
    for line in text.splitlines():
        if any(old in line for old in old_names):
            continue
        lines.append(line)
    text = "\n".join(lines)

    # Insert one and only one canonical visual authority at the end of <head>.
    if "</head>" not in text:
        raise SystemExit(f"ERROR: </head> missing in {path}")
    text = text.replace("</head>", f"  {new_link}\n</head>", 1)

    path.write_text(text + ("\n" if not text.endswith("\n") else ""), encoding="utf-8")
    print(f"UPDATED {path}")
PY

for file in "${OLD_CSS[@]}"; do
  rm -f "$APP/$file"
done

for dir in "${OLD_DIRS[@]}"; do
  rm -rf "$dir"
done

python3 - <<'PY'
from pathlib import Path

app = Path("memeflow-app")
pages = [
    "index.html",
    "agent-performance.html",
    "how-it-works.html",
    "settings.html",
    "smart-vault.html",
    "system-tokens.html",
    "system.html",
    "trading.html",
    "owner-intelligence.html",
]
old = [
    "memeflow-pump-fee-palette-v162.css",
    "memeflow-pump-fee-palette-v163.css",
    "memeflow-pump-fee-full-ui-v164.css",
    "memeflow-pure-black-v165.css",
    "memeflow-x-lights-out-v166.css",
]
needle = "memeflow-x-canonical-v167.css"

errors = []
for name in pages:
    path = app / name
    if not path.exists():
        continue
    text = path.read_text(encoding="utf-8")
    count = text.count(needle)
    if count != 1:
        errors.append(f"{path}: canonical link count={count}")
    for old_name in old:
        if old_name in text:
            errors.append(f"{path}: stale link {old_name}")

for old_name in old:
    if (app / old_name).exists():
        errors.append(f"stale file still exists: {app / old_name}")

canonical = app / needle
if not canonical.exists():
    errors.append(f"missing canonical file: {canonical}")

if errors:
    print("VALIDATION FAILED")
    for e in errors:
        print(" -", e)
    raise SystemExit(1)

print("VALIDATION PASS")
print(" - one canonical dark style link per production page")
print(" - V162-V166 generated CSS files removed")
print(" - old recent patch directories removed when present")
print(" - no server restart performed")
PY

echo
echo "Installed MEMEFLOW X CANONICAL CLEANUP V167"
echo "Backup: $BACKUP"
echo "No server restart was performed."
echo
git status --short
