#!/usr/bin/env bash
set -euo pipefail

echo "MEMEFLOW Typography Canonical Layer V1"
echo "====================================="

if [ -f "memeflow-app/memeflow-brand.css" ]; then
  APP_DIR="memeflow-app"
elif [ -f "memeflow-brand.css" ]; then
  APP_DIR="."
else
  echo "ERROR: memeflow-brand.css not found."
  echo "Run this script from the MEMEFLOW repository root."
  exit 1
fi

BRAND="$APP_DIR/memeflow-brand.css"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP_DIR="$APP_DIR/.typography-audit-backup-$STAMP"
mkdir -p "$BACKUP_DIR"

cp "$BRAND" "$BACKUP_DIR/memeflow-brand.css"
for f in index.html system.html trading.html system-tokens.html; do
  if [ -f "$APP_DIR/$f" ]; then
    cp "$APP_DIR/$f" "$BACKUP_DIR/$f"
  fi
done

python3 - "$APP_DIR" <<'PY'
from pathlib import Path
import re
import sys

app = Path(sys.argv[1])
brand = app / "memeflow-brand.css"

START = "/* ===== MEMEFLOW_CANONICAL_TYPOGRAPHY_V1_START ===== */"
END = "/* ===== MEMEFLOW_CANONICAL_TYPOGRAPHY_V1_END ===== */"

css = brand.read_text(encoding="utf-8")
css = re.sub(re.escape(START) + r".*?" + re.escape(END), "", css, flags=re.S).rstrip() + "\n\n"

layer = r"""
/* ===== MEMEFLOW_CANONICAL_TYPOGRAPHY_V1_START ===== */
/*
  Canonical MEMEFLOW typography scale.
  Presentation only. No trading, scanner, API, wallet, chart or state logic.
  Loaded after page-specific CSS so obsolete compact/mobile font patches
  cannot shrink normal UI text to 4–6px.
*/
:root{
  --mf-type-micro:8px;
  --mf-type-meta:9px;
  --mf-type-ui:10px;
  --mf-type-body:11px;
  --mf-type-panel:13px;
  --mf-type-title:15px;
}

html{font-size:16px!important}

/* Shared semantic roles */
.eyebrow{font-size:var(--mf-type-micro)!important}
.panel-head h2,
.execution-head h2,
.wallet-dialog-head h2,
.sheet-top h2{
  font-size:var(--mf-type-panel)!important;
  line-height:1.2!important;
}
.btn{font-size:var(--mf-type-body)!important}

/* SYSTEM / REAL-TIME 3D */
.system-shell .brand{font-size:12px!important}
.system-shell .subtitle{font-size:var(--mf-type-micro)!important}
.system-shell .status-chip span{font-size:var(--mf-type-micro)!important}
.system-shell .status-chip b{font-size:var(--mf-type-ui)!important}
.system-shell .tool-btn{font-size:var(--mf-type-meta)!important}
.system-shell .node-label strong{font-size:var(--mf-type-meta)!important}
.system-shell .node-label small{font-size:var(--mf-type-micro)!important}
.system-shell .scene-title .eyebrow{font-size:var(--mf-type-micro)!important}
.system-shell .legend span,
.system-shell .scene-hint{font-size:var(--mf-type-micro)!important}
.system-shell .inspector h2{
  font-size:var(--mf-type-panel)!important;
  line-height:1.15!important;
}
.system-shell .inspector .eyebrow,
.system-shell .state-pill{font-size:var(--mf-type-micro)!important}
.system-shell .inspector-summary{font-size:var(--mf-type-meta)!important}
.system-shell .metric-card span,
.system-shell .reason-block span{font-size:var(--mf-type-micro)!important}
.system-shell .metric-card strong{font-size:var(--mf-type-body)!important}
.system-shell .reason-block p{
  font-size:var(--mf-type-meta)!important;
  line-height:1.4!important;
}
.system-shell .gate{font-size:var(--mf-type-meta)!important}
.system-shell .gate b,
.system-shell .inspector-foot span,
.system-shell .inspector-foot button{font-size:var(--mf-type-micro)!important}
.system-shell .telemetry-item span,
.system-shell .telemetry-item small,
.system-shell .telemetry.mf-telemetry-standalone-v3 .telemetry-item span,
.system-shell .telemetry.mf-telemetry-standalone-v3 .telemetry-item small{
  font-size:var(--mf-type-micro)!important;
}
.system-shell .telemetry-item strong,
.system-shell .telemetry.mf-telemetry-standalone-v3 .telemetry-item strong{
  font-size:12px!important;
}
.system-shell .activity-head h2{font-size:var(--mf-type-panel)!important}
.system-shell .live-badge,
.system-shell .token-state,
.system-shell .token-card-meta span,
.system-shell .token-card-meta b{font-size:var(--mf-type-micro)!important}
.system-shell .token-symbol{font-size:var(--mf-type-ui)!important}

/* TOKEN FLOW */
.flow-page .header-title span{font-size:12px!important}
.flow-page .header-title strong{font-size:var(--mf-type-micro)!important}
.flow-page .live-status{font-size:var(--mf-type-micro)!important}
.flow-page .flow-hero .eyebrow{font-size:var(--mf-type-micro)!important}
.flow-page .flow-hero p{font-size:var(--mf-type-body)!important}
.flow-page .hero-counter span,
.flow-page .summary-card span{font-size:var(--mf-type-micro)!important}
.flow-page .search-wrap input{font-size:var(--mf-type-ui)!important}
.flow-page .refresh-info span{font-size:var(--mf-type-micro)!important}
.flow-page .refresh-info button,
.flow-page .pagination button,
.flow-page .page-state{font-size:var(--mf-type-micro)!important}
.flow-page .token-mint{font-size:var(--mf-type-panel)!important}
.flow-page .token-state{
  font-size:var(--mf-type-micro)!important;
  line-height:1!important;
}
.flow-page .token-full-mint{font-size:var(--mf-type-micro)!important}
.flow-page .token-metric span{
  font-size:var(--mf-type-micro)!important;
  line-height:1.15!important;
}
.flow-page .token-metric strong{
  font-size:var(--mf-type-body)!important;
  line-height:1.15!important;
}
.flow-page .details-button{font-size:var(--mf-type-micro)!important}
.flow-page .detail-block span{font-size:var(--mf-type-micro)!important}
.flow-page .detail-block p{
  font-size:var(--mf-type-meta)!important;
  line-height:1.45!important;
}
.flow-page .token-name{font-size:var(--mf-type-ui)!important}
.flow-page .token-meta{
  font-size:var(--mf-type-meta)!important;
  line-height:1.15!important;
}
.flow-page .token-pump-link{font-size:var(--mf-type-micro)!important}

/* TRADING TERMINAL */
.terminal .eyebrow{font-size:var(--mf-type-micro)!important}
.shell > .topbar .brand-title{font-size:12px!important}
.shell > .topbar .brand-sub{font-size:var(--mf-type-micro)!important}
.shell > .topbar .status-pill,
.shell > .topbar .ghost-btn,
.shell > .topbar .wallet-btn{font-size:var(--mf-type-meta)!important}
.terminal .panel-head h2{font-size:var(--mf-type-panel)!important}
.terminal .tiny-state,
.terminal .mode-badge{font-size:var(--mf-type-micro)!important}
.terminal .candidate-filter button,
.terminal .timeframes button,
.terminal .indicator-bar button{font-size:var(--mf-type-micro)!important}
.terminal .candidate-name strong{font-size:var(--mf-type-ui)!important}
.terminal .candidate-name span,
.terminal .candidate-bottom,
.terminal .candidate-price{font-size:var(--mf-type-micro)!important}
.terminal .state-dot,
.terminal .decision-badge{font-size:var(--mf-type-micro)!important}
.terminal .token-meta,
.terminal .token-meta button,
.terminal .token-market{font-size:var(--mf-type-micro)!important}
.terminal .selected-metrics span,
.terminal .pnl-summary span,
.terminal .position-row span,
.terminal .trade-log-time,
.terminal .trade-log-details b{font-size:var(--mf-type-micro)!important}
.terminal .selected-metrics strong,
.terminal .pnl-summary strong,
.terminal .position-row strong,
.terminal .trade-log-symbol,
.terminal .trade-log-details strong,
.terminal .trade-side{font-size:var(--mf-type-meta)!important}
.terminal .position-symbol{font-size:var(--mf-type-ui)!important}
.terminal .close-position,
.terminal .section-title,
.terminal .row-title > span:last-child,
.terminal .field-hint,
.terminal .strategy-grid label > span,
.terminal .strategy-grid b,
.terminal .live-warning strong,
.terminal .live-warning span,
.terminal .control-error{font-size:var(--mf-type-micro)!important}
.terminal .control-actions button{font-size:var(--mf-type-meta)!important}
.terminal .empty{font-size:var(--mf-type-meta)!important}

/* DASHBOARD / SETTINGS */
#settings .setting-field label,
#settings .setting-field > span{font-size:var(--mf-type-ui)!important}
#settings .setting-field small,
#settings .toggle-copy span,
#settings .settings-footer p{font-size:var(--mf-type-ui)!important}
#settings .toggle-copy b{font-size:var(--mf-type-body)!important}
#settings .settings-group > summary small{font-size:var(--mf-type-micro)!important}
#settings .settings-group > summary em{font-size:var(--mf-type-meta)!important}

/* Phone: keep compact geometry, restore readable type floor. */
@media(max-width:760px){
  .system-shell .scene-title .eyebrow,
  .system-shell .legend span,
  .system-shell .metric-card span,
  .system-shell .reason-block span,
  .system-shell .telemetry-item span,
  .system-shell .telemetry-item small,
  .system-shell .telemetry.mf-telemetry-standalone-v3 .telemetry-item span,
  .system-shell .telemetry.mf-telemetry-standalone-v3 .telemetry-item small{
    font-size:var(--mf-type-micro)!important;
  }

  .flow-page .summary-card span,
  .flow-page .token-state,
  .flow-page .token-metric span,
  .flow-page .details-button,
  .flow-page .detail-block span{
    font-size:var(--mf-type-micro)!important;
  }
  .flow-page .token-metric strong,
  .flow-page .detail-block p{font-size:var(--mf-type-meta)!important}

  .terminal .token-name-row h1{font-size:12px!important}
  .terminal .decision-badge,
  .terminal .token-meta,
  .terminal .token-market,
  .terminal .timeframes button,
  .terminal .indicator-bar button,
  .terminal .selected-metrics span,
  .terminal .field-hint,
  .terminal .strategy-grid label > span,
  .terminal .strategy-grid b,
  .terminal .positions-panel .eyebrow,
  .terminal .history-panel .eyebrow,
  .terminal .candidates-panel .eyebrow,
  .terminal .candidate-filter button,
  .terminal .candidate-name span,
  .terminal .candidate-bottom,
  .terminal .state-dot,
  .terminal .compact-wallet-panel .wallet-address,
  .terminal .compact-wallet-panel .live-warning strong,
  .terminal .compact-wallet-panel .live-warning span{
    font-size:var(--mf-type-micro)!important;
  }
  .terminal .selected-metrics strong,
  .terminal .position-row strong,
  .terminal .candidate-name strong,
  .terminal .candidate-price{font-size:var(--mf-type-meta)!important}
  .terminal .trade-row{font-size:var(--mf-type-micro)!important}

  #settings .setting-field label,
  #settings .setting-field > span,
  #settings .toggle-copy span{font-size:var(--mf-type-meta)!important}
  #settings .toggle-copy b{font-size:var(--mf-type-ui)!important}
}

@media(max-width:430px){
  .panel-head h2,
  .execution-head h2{font-size:12px!important}

  .flow-page .header-title strong,
  .flow-page .live-status,
  .flow-page .hero-counter span,
  .flow-page .summary-card span,
  .flow-page .refresh-info button,
  .flow-page .token-state,
  .flow-page .token-metric span,
  .flow-page .details-button,
  .flow-page .detail-block span,
  .flow-page .pagination button,
  .flow-page .page-state{
    font-size:var(--mf-type-micro)!important;
  }
}
/* ===== MEMEFLOW_CANONICAL_TYPOGRAPHY_V1_END ===== */
"""

brand.write_text(css + layer.strip() + "\n", encoding="utf-8")

for name in ("index.html", "system.html", "trading.html", "system-tokens.html"):
    p = app / name
    if not p.exists():
        continue
    text = p.read_text(encoding="utf-8")
    text = re.sub(
        r'(memeflow-brand\.css\?v=)[^"\'\s>]+',
        r'\1typography-v1-20260829',
        text
    )
    p.write_text(text, encoding="utf-8")

print(f"Patched {brand}")
PY

echo
echo "Verification:"
grep -n "MEMEFLOW_CANONICAL_TYPOGRAPHY_V1_START" "$BRAND"
grep -n -- "--mf-type-micro" "$BRAND" | tail -1

echo
echo "Cache-buster references:"
for f in index.html system.html trading.html system-tokens.html; do
  if [ -f "$APP_DIR/$f" ]; then
    grep -n "memeflow-brand.css?v=typography-v1-20260829" "$APP_DIR/$f" || \
      echo "WARNING: $f has no matching brand stylesheet reference"
  fi
done

echo
echo "Backup created at: $BACKUP_DIR"
echo "DONE: canonical typography V1 installed."
