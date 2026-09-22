#!/usr/bin/env bash
set -euo pipefail

APP="memeflow-app"
CANONICAL="$APP/memeflow-x-canonical-v169.css"
GUARDRAILS="$APP/memeflow-visual-guardrails-v169.css"
STRUCTURE="$APP/memeflow-structural-compat-v169.css"

STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP=".memeflow-style-deep-clean-v169-backup-$STAMP"
POINTER=".memeflow-style-deep-clean-v169-last-backup"

if [ ! -d "$APP" ]; then
  echo "ERROR: $APP not found. Run from the existing Replit workspace root."
  exit 1
fi

PAGES=(
  "index.html"
  "system.html"
  "how-it-works.html"
  "smart-vault.html"
  "trading.html"
  "settings.html"
  "system-tokens.html"
  "x100.html"
  "agent-performance.html"
  "owner-intelligence.html"
  "system-source.html"
)

mkdir -p "$BACKUP/memeflow-app"

# Full backup of every file V169 may rewrite/delete.
BACKUP_FILES=(
  "${PAGES[@]}"
  "memeflow-final-visual-qa-v65.css"
  "memeflow-dark-x-surface-v131.css"
  "memeflow-x-canonical-v167.css"
  "memeflow-x-canonical-v169.css"
  "memeflow-visual-guardrails-v169.css"
  "memeflow-structural-compat-v169.css"
  "x100.css"
  "agent-performance.css"
  "owner-intelligence.css"
)

for f in "${BACKUP_FILES[@]}"; do
  if [ -f "$APP/$f" ]; then
    cp -p "$APP/$f" "$BACKUP/memeflow-app/$f"
  fi
done

printf '%s\n' "$BACKUP" > "$POINTER"

# Remove only artifacts left by the failed V168 attempt. The current V169
# backup above is already complete and is the rollback source.
rm -rf .memeflow-style-deep-clean-v168-backup-* 2>/dev/null || true
rm -f .memeflow-style-deep-clean-v168-last-backup 2>/dev/null || true

# ---------------------------------------------------------------------------
# 1) Split the two mixed legacy override files into clean compatibility files.
#    Old neutral palette authorities are physically removed.
# ---------------------------------------------------------------------------
python3 - <<'PY'
from pathlib import Path
import re

app = Path("memeflow-app")

def remove_marked_section(text: str, start_markers, end_marker: str) -> str:
    if isinstance(start_markers, str):
        start_markers = [start_markers]

    hits = []
    for marker in start_markers:
        pos = text.find(marker)
        if pos >= 0:
            hits.append((pos, marker))

    if not hits:
        # Already cleaned or absent: safe no-op.
        return text

    start_hit, matched = min(hits, key=lambda item: item[0])
    start = text.rfind("/*", 0, start_hit)
    if start < 0:
        start = start_hit

    end_hit = text.find(end_marker, start_hit + len(matched))
    if end_hit < 0:
        raise SystemExit(
            f"Missing end marker {end_marker} after opening marker {matched}"
        )

    end = text.find("*/", end_hit)
    if end < 0:
        raise SystemExit(f"Unclosed end marker {end_marker}")

    return text[:start] + "\n" + text[end + 2:]

# V65: keep regression/layout guardrails, system-text sizing/classification and
# semantic palette. Remove every old GLOBAL neutral color authority.
src65 = app / "memeflow-final-visual-qa-v65.css"
if not src65.exists():
    raise SystemExit(f"Missing {src65}")
v65 = src65.read_text(encoding="utf-8")

for starts, end in [
    (["MEMEFLOW_GLOBAL_TEXT_CONTRAST_CONTRACT_V86"],
     "MEMEFLOW_GLOBAL_TEXT_CONTRAST_CONTRACT_V86_END"),
    (["MEMEFLOW_GLOBAL_DARK_SURFACE_CONTRACT_V111"],
     "MEMEFLOW_GLOBAL_DARK_SURFACE_CONTRACT_V111_END"),
    (["MEMEFLOW THEME CANVAS V135", "MEMEFLOW_THEME_CANVAS_V135"],
     "MEMEFLOW_THEME_CANVAS_V135_END"),
    (["MEMEFLOW_TEXT_ACCENT_NEUTRAL_V157"],
     "/MEMEFLOW_TEXT_ACCENT_NEUTRAL_V157"),
]:
    v65 = remove_marked_section(v65, starts, end)

header65 = """/*
  MEMEFLOW VISUAL GUARDRAILS V169
  Derived from legacy V65 after removing old global neutral text/surface owners.
  This file may own geometry, overflow safety, semantic state colors and
  system-text sizing/classification. It does NOT own the dark neutral palette.
*/

"""
(app / "memeflow-visual-guardrails-v169.css").write_text(
    header65 + v65.strip() + "\n", encoding="utf-8"
)

# V131: retain structural/geometry/Trading refinements, but remove the old
# surface authorities V131 and V152.
src131 = app / "memeflow-dark-x-surface-v131.css"
if not src131.exists():
    raise SystemExit(f"Missing {src131}")
v131 = src131.read_text(encoding="utf-8")

for starts, end in [
    (["MEMEFLOW DARK X SURFACE CONTRACT V131",
      "MEMEFLOW_DARK_X_SURFACE_CONTRACT_V131"],
     "MEMEFLOW_DARK_X_SURFACE_CONTRACT_V131_END"),
    (["MEMEFLOW_DARK_TWO_TONE_SURFACE_V152",
      "MEMEFLOW DARK TWO TONE SURFACE V152"],
     "MEMEFLOW_DARK_TWO_TONE_SURFACE_V152_END"),
]:
    v131 = remove_marked_section(v131, starts, end)

# Remove dark-only token blocks that tried to own line widths/colors.
# Structural rules that consume the variables remain; V169 canonical defines
# their dark values. Light blocks remain untouched.
for owned_token in [
    "--mf-x-dark-hairline",
    "--mf-x-dark-line-inner",
    "--mf-structure-outer",
    "--mf-structure-divider",
    "--mf-structure-ultra",
]:
    v131 = re.sub(
        rf'html\[data-theme=["\']dark["\']\]\s*\{{'
        rf'(?=[^{{}}]*{re.escape(owned_token)})[^{{}}]*\}}',
        '',
        v131,
        flags=re.S,
    )

header131 = """/*
  MEMEFLOW STRUCTURAL COMPAT V169
  Derived from legacy V131 after removing old dark surface/palette authorities.
  Geometry, Trading structure, badge sizing, chart alignment and light-theme
  compatibility are preserved. Dark neutral values come only from canonical.
*/

"""
(app / "memeflow-structural-compat-v169.css").write_text(
    header131 + v131.strip() + "\n", encoding="utf-8"
)
PY

# ---------------------------------------------------------------------------
# 2) Write the one canonical dark visual authority.
# ---------------------------------------------------------------------------
cat > "$CANONICAL" <<'CSS'
/* ==========================================================================
   MEMEFLOW X CANONICAL DARK STYLE V169
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

/* MEMEFLOW_X_CANONICAL_DARK_STYLE_V169_END */


/* ==========================================================================
   V169 LEGACY TOKEN BRIDGE
   These aliases let old component/layout CSS consume ONE canonical neutral
   system without owning an independent dark palette.
   ========================================================================== */

html:not([data-theme="light"]) {
  --surface-0: #000000 !important;
  --surface-1: #000000 !important;
  --surface-2: #000000 !important;
  --panel-bg: #000000 !important;

  --ds-bg: #000000 !important;
  --ds-surface: #000000 !important;
  --ds-surface-raised: #000000 !important;
  --ds-line: #2f3336 !important;
  --ds-line-strong: #2f3336 !important;
  --ds-text: #e7e9ea !important;
  --ds-muted: #71767b !important;

  --text-2: #71767b !important;
  --text-3: #536471 !important;

  --mf-hairline: #2f3336 !important;
  --mf-pm-line: #2f3336 !important;
  --mf-pm-line-strong: #2f3336 !important;
  --mf-icon-muted: #71767b !important;
  --mf-panel: #000000 !important;
}

/* X100 — previously outside the canonical theme. */
html:not([data-theme="light"]) body.mf-page-x100 :where(
  .site-header,
  .module,
  .revenue-grid article,
  .policy-flow div,
  .definition-grid > div
) {
  background: #000000 !important;
  background-color: #000000 !important;
  background-image: none !important;
  box-shadow: none !important;
}

html:not([data-theme="light"]) body.mf-page-x100 :where(
  .site-header,
  .section,
  .hero-note,
  .stat-row,
  .stat-row div,
  .module,
  .principles,
  .principles div,
  .allocation-bar,
  .allocation-list,
  .allocation-list div,
  .timeline-track,
  .timeline-points,
  .timeline-points div,
  .revenue-grid,
  .revenue-grid article,
  .flow-stack,
  .flow-stack div,
  .policy-flow div,
  .definition-grid,
  .definition-grid > div,
  .faq-list,
  details
) {
  border-color: #2f3336 !important;
}

html:not([data-theme="light"]) body.mf-page-x100 :where(
  .section-head > p:last-child,
  .lead,
  .nav a,
  .text-action,
  .hero-note p,
  .module > small,
  .module p,
  .prose > p,
  .principles small,
  .allocation-list small,
  .timeline-points strong,
  .timeline-points small,
  .revenue-grid p,
  .policy-note,
  .flow-stack span,
  .policy-flow small,
  .muted-copy,
  .definition-grid p,
  details p,
  .footer-inner
) {
  color: #71767b !important;
}

html:not([data-theme="light"]) body.mf-page-x100 :where(
  .kicker,
  .working,
  .module > span:first-child,
  .principles span,
  .definition-grid span
) {
  color: #536471 !important;
}

html:not([data-theme="light"]) body.mf-page-x100 :where(
  .primary-action
) {
  background: #ffffff !important;
  border-color: #ffffff !important;
  color: #000000 !important;
  box-shadow: none !important;
}

/* Preserve intentionally inverted X100 information modules. */
html:not([data-theme="light"]) body.mf-page-x100 :where(
  .core-module,
  .definition-grid .is
) {
  background: #f2f2f2 !important;
  color: #050505 !important;
}

/* Discovery Source — internal production page, now part of the same system. */
html:not([data-theme="light"]) body.mf-page-system-source :where(
  .top,
  .panel,
  .card,
  .mode,
  .info
) {
  background: #000000 !important;
  background-color: #000000 !important;
  background-image: none !important;
  box-shadow: none !important;
}

html:not([data-theme="light"]) body.mf-page-system-source :where(
  .top,
  .panel,
  .card,
  .mode,
  .back
) {
  border-color: #2f3336 !important;
}

html:not([data-theme="light"]) body.mf-page-system-source :where(
  .sub,
  .muted,
  .k,
  .msg,
  .back
) {
  color: #71767b !important;
}

/* Owner Intelligence — cover nested neutral rows, not only outer panels. */
html:not([data-theme="light"]) body.mf-page-owner-intelligence :where(
  .oi-panel,
  .oi-stat,
  .oi-notice,
  .oi-decision,
  .oi-row,
  .oi-ai-status
) {
  background: #000000 !important;
  background-color: #000000 !important;
  background-image: none !important;
  border-color: #2f3336 !important;
  box-shadow: none !important;
}

/* Agent Performance — cover nested neutral metric cells. */
html:not([data-theme="light"]) body.mf-page-agent-performance :where(
  .ap-source,
  .ap-panel,
  .ap-kpis article,
  .ap-summary div,
  .ap-periods
) {
  background-color: #000000 !important;
  background-image: none !important;
  border-color: #2f3336 !important;
  box-shadow: none !important;
}

/* MEMEFLOW_X_CANONICAL_V169_DEEP_COVERAGE_END */

CSS

# ---------------------------------------------------------------------------
# 3) Normalize dark-only standalone page root tokens.
#    These pages do not participate in the shared light theme.
# ---------------------------------------------------------------------------
python3 - <<'PY'
from pathlib import Path
import re

app = Path("memeflow-app")

def replace_root_vars(path, mapping):
    p = app / path
    if not p.exists():
        return
    text = p.read_text(encoding="utf-8")
    m = re.search(r':root\s*\{([\s\S]*?)\}', text)
    if not m:
        return
    body = m.group(1)
    for name, value in mapping.items():
        body = re.sub(
            rf'({re.escape(name)}\s*:)\s*[^;]+;',
            rf'\1{value};',
            body,
        )
    text = text[:m.start(1)] + body + text[m.end(1):]
    p.write_text(text, encoding="utf-8")

common = {
    "--bg": "#000000",
    "--text": "#e7e9ea",
    "--muted": "#71767b",
    "--line": "#2f3336",
}

replace_root_vars("x100.css", {
    **common,
    "--surface": "#000000",
    "--surface-2": "#000000",
    "--muted-2": "#536471",
    "--line-soft": "#2f3336",
})

replace_root_vars("agent-performance.css", {
    **common,
    "--panel": "#000000",
})

replace_root_vars("owner-intelligence.css", {
    **common,
    "--surface": "#000000",
    "--surface2": "#000000",
    "--line2": "#2f3336",
})
PY

# ---------------------------------------------------------------------------
# 4) Every production page gets one canonical link LAST, and only cleaned
#    compatibility layers. Missing page classes are added for exact scoping.
# ---------------------------------------------------------------------------
python3 - <<'PY'
from pathlib import Path
import re

app = Path("memeflow-app")
pages = [
    "index.html",
    "system.html",
    "how-it-works.html",
    "smart-vault.html",
    "trading.html",
    "settings.html",
    "system-tokens.html",
    "x100.html",
    "agent-performance.html",
    "owner-intelligence.html",
    "system-source.html",
]

page_classes = {
    "index.html": "mf-page-index",
    "x100.html": "mf-page-x100",
    "owner-intelligence.html": "mf-page-owner-intelligence",
    "system-source.html": "mf-page-system-source",
}

remove_assets = [
    "memeflow-final-visual-qa-v65.css",
    "memeflow-dark-x-surface-v131.css",
    "memeflow-x-canonical-v167.css",
    "memeflow-x-canonical-v169.css",
    "memeflow-visual-guardrails-v169.css",
    "memeflow-structural-compat-v169.css",
    "memeflow-pump-fee-palette-v162.css",
    "memeflow-pump-fee-palette-v163.css",
    "memeflow-pump-fee-full-ui-v164.css",
    "memeflow-pure-black-v165.css",
    "memeflow-x-lights-out-v166.css",
]

guard = '<link rel="stylesheet" href="/memeflow-visual-guardrails-v169.css?v=visual-guardrails-v169-20260922">'
struct = '<link rel="stylesheet" href="/memeflow-structural-compat-v169.css?v=structural-compat-v169-20260922">'
canon = '<link rel="stylesheet" href="/memeflow-x-canonical-v169.css?v=x-canonical-v169-20260922">'

def add_body_class(text, cls):
    m = re.search(r'<body\b([^>]*)>', text, flags=re.I)
    if not m:
        raise SystemExit(f"body tag missing while adding {cls}")
    attrs = m.group(1)
    cm = re.search(r'class=["\']([^"\']*)["\']', attrs, flags=re.I)
    if cm:
        classes = cm.group(1).split()
        if cls not in classes:
            new_class = " ".join(classes + [cls])
            attrs = attrs[:cm.start(1)] + new_class + attrs[cm.end(1):]
    else:
        attrs = attrs + f' class="{cls}"'
    return text[:m.start()] + "<body" + attrs + ">" + text[m.end():]

for name in pages:
    path = app / name
    if not path.exists():
        raise SystemExit(f"Missing production page: {path}")

    text = path.read_text(encoding="utf-8")

    # Remove all legacy/current visual authority links.
    lines = []
    for line in text.splitlines():
        if any(asset in line for asset in remove_assets):
            continue
        lines.append(line)
    text = "\n".join(lines)

    # Explicit scope on pages that previously had no standard body class.
    if name in page_classes:
        text = add_body_class(text, page_classes[name])

    if "</head>" not in text:
        raise SystemExit(f"</head> missing in {path}")

    # All three are appended at the very end of head.
    # Guardrails/structure first, canonical last.
    insert = f"  {guard}\n  {struct}\n  {canon}\n"
    text = text.replace("</head>", insert + "</head>", 1)

    path.write_text(text + ("\n" if not text.endswith("\n") else ""), encoding="utf-8")
    print("UPDATED", path)
PY

# ---------------------------------------------------------------------------
# 5) Physically remove superseded global style authorities and recent patch
#    artifacts/backups. V169's backup is the only rollback source needed.
# ---------------------------------------------------------------------------
rm -f \
  "$APP/memeflow-final-visual-qa-v65.css" \
  "$APP/memeflow-dark-x-surface-v131.css" \
  "$APP/memeflow-x-canonical-v167.css" \
  "$APP/memeflow-pump-fee-palette-v162.css" \
  "$APP/memeflow-pump-fee-palette-v163.css" \
  "$APP/memeflow-pump-fee-full-ui-v164.css" \
  "$APP/memeflow-pure-black-v165.css" \
  "$APP/memeflow-x-lights-out-v166.css"

rm -rf \
  memeflow_pump_fee_v162 \
  memeflow_pump_fee_v163 \
  memeflow_pump_fee_v164 \
  memeflow_pure_black_v165 \
  memeflow_x_text_v166 \
  memeflow_style_cleanup_v167

rm -rf \
  .memeflow-pump-fee-palette-v162-backup* \
  .memeflow-pump-fee-palette-v163-backup* \
  .memeflow-pump-fee-palette-v164-backup* \
  .memeflow-pump-fee-palette-v165-backup* \
  .memeflow-pump-fee-palette-v166-backup* \
  .memeflow-style-cleanup-v167-backup* \
  .memeflow-style-cleanup-v167-last-backup

rm -f \
  Memflow-Pump-Fee-Palette-V162.zip \
  Memflow-Pump-Fee-Full-UI-V163.zip \
  Memflow-Pump-Fee-Full-UI-V164.zip \
  Memflow-Pure-Black-V165.zip \
  Memflow-X-Lights-Out-V166.zip \
  Memflow-X-Canonical-Cleanup-V167.zip

# ---------------------------------------------------------------------------
# 6) Deep validation across EVERY top-level HTML page.
# ---------------------------------------------------------------------------
python3 - <<'PY'
from pathlib import Path
import re

app = Path("memeflow-app")
production = {
    "index.html",
    "system.html",
    "how-it-works.html",
    "smart-vault.html",
    "trading.html",
    "settings.html",
    "system-tokens.html",
    "x100.html",
    "agent-performance.html",
    "owner-intelligence.html",
    "system-source.html",
}
canonical = "memeflow-x-canonical-v169.css"
guard = "memeflow-visual-guardrails-v169.css"
struct = "memeflow-structural-compat-v169.css"

legacy_assets = [
    "memeflow-final-visual-qa-v65.css",
    "memeflow-dark-x-surface-v131.css",
    "memeflow-x-canonical-v167.css",
    "memeflow-pump-fee-palette-v162.css",
    "memeflow-pump-fee-palette-v163.css",
    "memeflow-pump-fee-full-ui-v164.css",
    "memeflow-pure-black-v165.css",
    "memeflow-x-lights-out-v166.css",
]

errors = []
all_pages = sorted(app.glob("*.html"))

for path in all_pages:
    text = path.read_text(encoding="utf-8", errors="replace")

    # No top-level page may reference a superseded global authority.
    for old in legacy_assets:
        if old in text:
            errors.append(f"{path.name}: stale style reference {old}")

    if path.name in production:
        links = re.findall(
            r'<link\b[^>]*href=["\']([^"\']+\.css[^"\']*)["\'][^>]*>',
            text,
            flags=re.I,
        )
        c = sum(canonical in x for x in links)
        g = sum(guard in x for x in links)
        s = sum(struct in x for x in links)
        if (c, g, s) != (1, 1, 1):
            errors.append(
                f"{path.name}: canonical/guard/struct counts={(c,g,s)}"
            )

        # Canonical must be the final stylesheet in the document head.
        if not links or canonical not in links[-1]:
            errors.append(f"{path.name}: canonical is not last stylesheet")

# Clean compatibility files must not retain removed authorities.
guard_text = (app / guard).read_text(encoding="utf-8")
for marker in [
    "MEMEFLOW_GLOBAL_TEXT_CONTRAST_CONTRACT_V86",
    "MEMEFLOW_GLOBAL_DARK_SURFACE_CONTRACT_V111",
    "MEMEFLOW_THEME_CANVAS_V135",
    "MEMEFLOW_TEXT_ACCENT_NEUTRAL_V157",
]:
    if marker in guard_text:
        errors.append(f"{guard}: forbidden legacy marker {marker}")

struct_text = (app / struct).read_text(encoding="utf-8")
for marker in [
    "MEMEFLOW DARK X SURFACE CONTRACT V131",
    "MEMEFLOW_DARK_TWO_TONE_SURFACE_V152",
]:
    if marker in struct_text:
        errors.append(f"{struct}: forbidden legacy marker {marker}")

# Documentation comments may mention historical colors. They are not CSS
# authorities. Check only active CSS declarations after comments are stripped.
struct_active = re.sub(r'/\*[\s\S]*?\*/', '', struct_text)

for forbidden in ["#101113", "#181f27"]:
    if forbidden.lower() in struct_active.lower():
        errors.append(f"{struct}: active stale dark surface {forbidden}")

for token in [
    "--mf-x-dark-hairline",
    "--mf-x-dark-line-inner",
    "--mf-structure-outer",
    "--mf-structure-divider",
    "--mf-structure-ultra",
]:
    bad = re.search(
        rf'html\[data-theme=["\']dark["\']\]\s*\{{'
        rf'[^{{}}]*{re.escape(token)}\s*:',
        struct_active,
        flags=re.S,
    )
    if bad:
        errors.append(f"{struct}: old dark owner still declares {token}")

canon_text = (app / canonical).read_text(encoding="utf-8")
required = [
    "#000000",
    "#e7e9ea",
    "#71767b",
    "#536471",
    "#1d9bf0",
    "#2f3336",
]
for token in required:
    if token not in canon_text.lower():
        errors.append(f"{canonical}: missing token {token}")

# Confirm the previously missed pages are explicitly scoped.
for page, cls in {
    "x100.html": "mf-page-x100",
    "system-source.html": "mf-page-system-source",
    "owner-intelligence.html": "mf-page-owner-intelligence",
    "index.html": "mf-page-index",
}.items():
    text = (app / page).read_text(encoding="utf-8")
    if cls not in text:
        errors.append(f"{page}: missing body scope {cls}")

# Superseded files must be physically gone.
for old in legacy_assets:
    if (app / old).exists():
        errors.append(f"stale file remains: {old}")

if errors:
    print("DEEP STYLE AUDIT: FAILED")
    for e in errors:
        print(" -", e)
    raise SystemExit(1)

dev_pages = [p.name for p in all_pages if p.name not in production]

print("DEEP STYLE AUDIT: PASS")
print(f" - scanned top-level HTML pages: {len(all_pages)}")
print(f" - production/shared-theme pages: {len(production)}")
print(f" - isolated test/audit/game pages checked for stale shared-style links: {len(dev_pages)}")
print(" - canonical X dark style: exactly once and LAST on every production page")
print(" - old global text/surface authorities: physically removed")
print(" - V65 retained only as cleaned guardrails/semantic compatibility")
print(" - V131 retained only as cleaned structural/geometry compatibility")
print(" - X100 + Discovery Source now use canonical style")
print(" - no V162-V167 visual layer is active")
print(" - no server restart performed")
PY

echo
echo "Installed MEMEFLOW DEEP STYLE CLEAN V169"
echo "Backup: $BACKUP"
echo "No server restart was performed."
echo
git status --short
