#!/usr/bin/env bash
set -euo pipefail

# MEMEFLOW clean unified visual patch.
# Extends the EXISTING MF_UNIFIED_APP_THEME block.
# Removes the prior standalone override block if it exists.
# Does not modify 3D/chart/trading/API behavior.

if [[ -d "memeflow-app" ]]; then
  APP="memeflow-app"
elif [[ -f "memeflow-brand.css" ]]; then
  APP="."
else
  echo "ERROR: Run from MEMEFLOW repository root or memeflow-app." >&2
  exit 1
fi

git fetch origin
git checkout main
git pull --ff-only origin main

if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "ERROR: Tracked local changes exist. Commit/stash them first." >&2
  git status --short
  exit 1
fi

CSS="$APP/memeflow-brand.css"
SYSTEM="$APP/system.html"
TOKENS="$APP/system-tokens.html"
TRADING="$APP/trading.html"

for f in "$CSS" "$SYSTEM" "$TOKENS" "$TRADING"; do
  [[ -f "$f" ]] || { echo "ERROR: Missing $f" >&2; exit 1; }
done

STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="/tmp/memeflow-clean-unified-$STAMP"
mkdir -p "$BACKUP"
cp "$CSS" "$SYSTEM" "$TOKENS" "$TRADING" "$BACKUP"/
echo "Backup: $BACKUP"

python3 - "$CSS" "$SYSTEM" "$TOKENS" "$TRADING" <<'PY'
from pathlib import Path
import re, sys

css_path = Path(sys.argv[1])
html_paths = [Path(p) for p in sys.argv[2:]]
css = css_path.read_text(encoding="utf-8")

# 1) Remove the previous separate standalone visual layer if it was installed.
for s, e in [
    ("/* MF_STANDALONE_MISSION_THEME_START */", "/* MF_STANDALONE_MISSION_THEME_END */"),
    ("/* MF_UNIFIED_STANDALONE_START */", "/* MF_UNIFIED_STANDALONE_END */"),
]:
    if s in css and e in css:
        css = re.sub(re.escape(s) + r".*?" + re.escape(e) + r"\s*", "", css, flags=re.S)

# 2) Require the canonical unified theme and insert the standalone subsection INSIDE it.
theme_end = "/* MF_UNIFIED_APP_THEME_END */"
if theme_end not in css:
    raise SystemExit("ERROR: Canonical MF_UNIFIED_APP_THEME block not found; refusing to create another layer.")

section = '/* MF_UNIFIED_STANDALONE_START */\n/* Standalone application surfaces.\n   This section is part of the ONE canonical MF_UNIFIED_APP_THEME block.\n   It intentionally does not restyle the 3D renderer / chart internals. */\n\n/* Shared standalone chrome */\n.system-shell,\n.flow-page,\n.shell{\n  color:var(--mf-app-text)!important;\n}\n\n.system-shell .topbar,\n.flow-header,\n.shell>.topbar{\n  border:1px solid var(--mf-app-line)!important;\n  border-radius:var(--mf-app-radius)!important;\n  background:rgba(6,9,13,.78)!important;\n  box-shadow:inset 0 1px 0 rgba(255,255,255,.022)!important;\n  backdrop-filter:blur(24px) saturate(130%)!important;\n  -webkit-backdrop-filter:blur(24px) saturate(130%)!important;\n}\n\n.system-shell .brand,\n.flow-header .header-title span,\n.shell .brand-title{\n  color:var(--mf-app-text)!important;\n  font-weight:900!important;\n  letter-spacing:.12em!important;\n}\n\n.system-shell .subtitle,\n.flow-header .header-title strong,\n.shell .brand-sub{\n  color:var(--mf-app-muted)!important;\n}\n\n.system-shell .back,\n.flow-header .back-button,\n.shell .ghost-btn,\n.shell .wallet-btn,\n.system-shell .tool-btn{\n  border:1px solid var(--mf-app-line)!important;\n  border-radius:12px!important;\n  background:#121a24!important;\n  color:#dce5ee!important;\n  box-shadow:none!important;\n}\n\n.system-shell .back:hover,\n.flow-header .back-button:hover,\n.shell .ghost-btn:hover,\n.shell .wallet-btn:hover,\n.system-shell .tool-btn:hover{\n  border-color:rgba(97,223,255,.44)!important;\n  background:#151f2b!important;\n}\n\n.shell .wallet-btn,\n.system-shell .tool-btn.active{\n  border-color:rgba(97,223,255,.34)!important;\n}\n\n.system-shell .tool-btn.active{\n  background:rgba(97,223,255,.07)!important;\n  color:#dff9ff!important;\n}\n\n/* System page shell only — leave MEMEFLOW 3D renderer styling to memeflow-flow-v4.css */\n.system-shell .scene-title,\n.system-shell .telemetry,\n.system-shell .activity-panel,\n.system-shell .inspector{\n  border:1px solid var(--mf-app-line)!important;\n  border-radius:var(--mf-app-radius)!important;\n  background:linear-gradient(180deg,var(--mf-app-panel-top),var(--mf-app-panel-bottom))!important;\n  box-shadow:none!important;\n}\n\n.system-shell .scene-title{\n  background:\n    radial-gradient(circle at 95% 5%,rgba(97,223,255,.065),transparent 38%),\n    linear-gradient(180deg,var(--mf-app-panel-top),var(--mf-app-panel-bottom))!important;\n}\n\n.system-shell .scene-title h1,\n.system-shell .activity-head h2,\n.system-shell .inspector-head h2{\n  color:var(--mf-app-text)!important;\n  letter-spacing:-.035em!important;\n}\n\n.system-shell .scene-title p,\n.system-shell .inspector-summary{\n  color:var(--mf-app-muted)!important;\n}\n\n.system-shell .status-chip,\n.system-shell .state-pill,\n.system-shell .live-badge,\n.system-shell .metric-grid>*,\n.system-shell .reason-block,\n.system-shell .gate-list>*,\n.system-shell .telemetry-item,\n.system-shell .token-rail>*{\n  border-color:var(--mf-app-line)!important;\n  background:var(--mf-app-soft)!important;\n  box-shadow:none!important;\n}\n\n.system-shell .status-chip,\n.system-shell .state-pill,\n.system-shell .live-badge{\n  border-radius:999px!important;\n}\n\n.system-shell .metric-grid>*,\n.system-shell .reason-block,\n.system-shell .gate-list>*,\n.system-shell .token-rail>*{\n  border-radius:10px!important;\n}\n\n.system-shell .status-chip span,\n.system-shell .metric-grid span,\n.system-shell .telemetry-item span,\n.system-shell .telemetry-item small,\n.system-shell .reason-block>span{\n  color:var(--mf-app-muted)!important;\n}\n\n.system-shell .status-chip b,\n.system-shell .metric-grid strong,\n.system-shell .telemetry-item strong{\n  color:var(--mf-app-text)!important;\n  font-variant-numeric:tabular-nums!important;\n}\n\n.system-shell .flow-view-all{\n  color:var(--mf-app-cyan)!important;\n}\n\n/* Token Flow */\n.flow-page .flow-hero,\n.flow-page .flow-toolbar,\n.flow-page .pagination{\n  border:1px solid var(--mf-app-line)!important;\n  border-radius:var(--mf-app-radius)!important;\n  background:linear-gradient(180deg,var(--mf-app-panel-top),var(--mf-app-panel-bottom))!important;\n  box-shadow:none!important;\n}\n\n.flow-page .flow-hero{\n  background:\n    radial-gradient(circle at 95% 0,rgba(97,223,255,.065),transparent 42%),\n    linear-gradient(180deg,var(--mf-app-panel-top),var(--mf-app-panel-bottom))!important;\n}\n\n.flow-page .flow-hero h1{\n  color:var(--mf-app-text)!important;\n  letter-spacing:-.04em!important;\n}\n\n.flow-page .flow-hero p,\n.flow-page .hero-counter span,\n.flow-page .page-state span,\n.flow-page #lastUpdate{\n  color:var(--mf-app-muted)!important;\n}\n\n.flow-page .hero-counter strong,\n.flow-page .page-state strong{\n  color:var(--mf-app-text)!important;\n  font-variant-numeric:tabular-nums!important;\n}\n\n.flow-page .state-summary{\n  gap:8px!important;\n}\n\n.flow-page .summary-card{\n  border:1px solid var(--mf-app-line)!important;\n  border-radius:12px!important;\n  background:var(--mf-app-soft)!important;\n  box-shadow:none!important;\n}\n\n.flow-page .summary-card:hover{\n  background:var(--mf-app-soft-hover)!important;\n}\n\n.flow-page .summary-card.active{\n  border-color:rgba(97,223,255,.46)!important;\n  background:rgba(97,223,255,.055)!important;\n  box-shadow:inset 2px 0 0 var(--mf-app-cyan)!important;\n}\n\n.flow-page .summary-card span,\n.flow-page .token-metric span{\n  color:var(--mf-app-muted)!important;\n}\n\n.flow-page .summary-card strong,\n.flow-page .token-name,\n.flow-page .token-metric strong{\n  color:var(--mf-app-text)!important;\n  font-variant-numeric:tabular-nums!important;\n}\n\n.flow-page .summary-card.ready{border-color:rgba(88,228,173,.22)!important;}\n.flow-page .summary-card.blocked{border-color:rgba(255,108,123,.22)!important;}\n.flow-page .summary-card.watch{border-color:rgba(97,223,255,.18)!important;}\n\n.flow-page .search-wrap{\n  border:1px solid var(--mf-app-line)!important;\n  border-radius:12px!important;\n  background:var(--mf-app-soft)!important;\n  box-shadow:none!important;\n}\n\n.flow-page .search-wrap input{\n  color:var(--mf-app-text)!important;\n  background:transparent!important;\n}\n\n.flow-page .search-wrap input::placeholder{\n  color:var(--mf-app-muted)!important;\n}\n\n.flow-page #refreshButton,\n.flow-page .pagination button,\n.flow-page .details-button{\n  border:1px solid var(--mf-app-line)!important;\n  border-radius:12px!important;\n  background:#121a24!important;\n  color:#dce5ee!important;\n  box-shadow:none!important;\n}\n\n.flow-page #refreshButton:hover,\n.flow-page .pagination button:hover,\n.flow-page .details-button:hover{\n  border-color:rgba(97,223,255,.44)!important;\n  background:#151f2b!important;\n}\n\n.flow-page .flow-token{\n  border:1px solid var(--mf-app-line)!important;\n  border-radius:16px!important;\n  background:linear-gradient(180deg,var(--mf-app-panel-top),var(--mf-app-panel-bottom))!important;\n  box-shadow:none!important;\n}\n\n.flow-page .flow-token:hover{\n  border-color:rgba(97,223,255,.23)!important;\n  background:linear-gradient(180deg,rgba(17,24,32,.95),rgba(10,15,20,.97))!important;\n}\n\n.flow-page .token-avatar,\n.flow-page .token-details,\n.flow-page .detail-block{\n  border-color:var(--mf-app-line)!important;\n  background:var(--mf-app-soft)!important;\n  box-shadow:none!important;\n}\n\n.flow-page .token-avatar{border-radius:12px!important;}\n.flow-page .token-details,\n.flow-page .detail-block{border-radius:10px!important;}\n.flow-page .token-state{border-radius:999px!important;box-shadow:none!important;}\n\n/* Trading terminal — component chrome only; chart rendering remains owned by trading.css/js */\n.shell .engine-strip .status-pill,\n.shell .status-pill,\n.shell .decision-badge,\n.shell .tiny-state,\n.shell .mode-badge,\n.shell .approval-count{\n  border:1px solid var(--mf-app-line)!important;\n  border-radius:999px!important;\n  background:var(--mf-app-soft)!important;\n  box-shadow:none!important;\n}\n\n.shell .panel{\n  border:1px solid var(--mf-app-line)!important;\n  border-radius:var(--mf-app-radius)!important;\n  background:linear-gradient(180deg,var(--mf-app-panel-top),var(--mf-app-panel-bottom))!important;\n  box-shadow:none!important;\n}\n\n.shell .panel:hover{\n  border-color:rgba(97,223,255,.23)!important;\n}\n\n.shell .panel-head,\n.shell .chart-head{\n  border-color:var(--mf-app-line)!important;\n  background:transparent!important;\n}\n\n.shell .panel-head h2,\n.shell .chart-head h1{\n  color:var(--mf-app-text)!important;\n  letter-spacing:-.035em!important;\n}\n\n.shell .token-market,\n.shell .field-hint,\n.shell .section-title,\n.shell .control-foot,\n.shell .empty{\n  color:var(--mf-app-muted)!important;\n}\n\n.shell .token-avatar,\n.shell .price-block,\n.shell .timeframes button,\n.shell .indicator-bar,\n.shell .indicator-scroll button,\n.shell .selected-metrics>div,\n.shell .control-section,\n.shell .amount-box,\n.shell .strategy-grid label,\n.shell .wallet-address,\n.shell .live-warning,\n.shell .approval-list>*,\n.shell .positions-list>*,\n.shell .trade-history>*,\n.shell .candidate-filter,\n.shell .candidate-list>*{\n  border-color:var(--mf-app-line)!important;\n  background:var(--mf-app-soft)!important;\n  box-shadow:none!important;\n}\n\n.shell .token-avatar,\n.shell .price-block,\n.shell .amount-box,\n.shell .wallet-address,\n.shell .live-warning{\n  border-radius:12px!important;\n}\n\n.shell .selected-metrics>div,\n.shell .strategy-grid label,\n.shell .candidate-list>*,\n.shell .approval-list>*,\n.shell .positions-list>*,\n.shell .trade-history>*{\n  border-radius:10px!important;\n}\n\n.shell .timeframes button,\n.shell .indicator-scroll button,\n.shell .candidate-filter button{\n  border-radius:10px!important;\n  color:var(--mf-app-muted)!important;\n  box-shadow:none!important;\n}\n\n.shell .timeframes button.active,\n.shell .indicator-scroll button.active,\n.shell .indicator-scroll button[aria-pressed="true"],\n.shell .candidate-filter button.active{\n  border-color:rgba(97,223,255,.38)!important;\n  background:rgba(97,223,255,.065)!important;\n  color:var(--mf-app-cyan)!important;\n  box-shadow:none!important;\n}\n\n.shell .selected-metrics span{\n  color:var(--mf-app-muted)!important;\n}\n\n.shell .selected-metrics strong{\n  color:var(--mf-app-text)!important;\n  font-variant-numeric:tabular-nums!important;\n}\n\n.shell input,\n.shell select{\n  border-color:var(--mf-app-line-strong)!important;\n  border-radius:10px!important;\n  background:#10161d!important;\n  color:var(--mf-app-text)!important;\n  box-shadow:none!important;\n}\n\n.shell input:focus,\n.shell select:focus{\n  border-color:rgba(97,223,255,.55)!important;\n  box-shadow:0 0 0 3px rgba(97,223,255,.07)!important;\n  outline:none!important;\n}\n\n.shell .secondary-btn,\n.shell .assist-btn,\n.shell .start-btn,\n.shell .pause-btn,\n.shell #killBtn,\n.shell .unit-toggle button,\n.shell #copyMintBtn{\n  border:1px solid var(--mf-app-line)!important;\n  border-radius:12px!important;\n  background:#121a24!important;\n  color:#eaf0f6!important;\n  box-shadow:none!important;\n}\n\n.shell .start-btn,\n.shell .unit-toggle button.active{\n  border-color:rgba(88,228,173,.30)!important;\n  background:rgba(88,228,173,.055)!important;\n  color:var(--mf-app-green)!important;\n}\n\n.shell .pause-btn,\n.shell #killBtn{\n  border-color:rgba(255,108,123,.24)!important;\n  background:rgba(255,108,123,.035)!important;\n  color:var(--mf-app-red)!important;\n}\n\n@media(max-width:820px){\n  .system-shell .topbar,\n  .flow-header,\n  .shell>.topbar,\n  .system-shell .scene-title,\n  .system-shell .telemetry,\n  .system-shell .activity-panel,\n  .system-shell .inspector,\n  .flow-page .flow-hero,\n  .flow-page .flow-toolbar,\n  .flow-page .pagination,\n  .flow-page .flow-token,\n  .shell .panel{\n    border-radius:16px!important;\n  }\n\n  .system-shell .scene-title,\n  .flow-page .flow-hero{\n    padding:16px!important;\n  }\n\n  .shell .panel-head{padding:10px 12px!important;}\n  .shell .chart-head{padding:12px!important;}\n}\n/* MF_UNIFIED_STANDALONE_END */'
css = css.replace(theme_end, section + "\n" + theme_end, 1)
css_path.write_text(css.rstrip() + "\n", encoding="utf-8")

# 3) Cache-bust only the existing shared stylesheet links.
for path in html_paths:
    html = path.read_text(encoding="utf-8")
    html2, n = re.subn(
        r'href=(["\'])/memeflow-brand\.css(?:\?v=[^"\']+)?\1',
        lambda m: f'href={m.group(1)}/memeflow-brand.css?v=unified-mission-v2{m.group(1)}',
        html,
        count=1,
    )
    if n != 1:
        raise SystemExit(f"ERROR: memeflow-brand.css link not found in {path}")
    path.write_text(html2, encoding="utf-8")

print("Clean unified theme installed.")
PY

# Guardrails:
# - exactly one canonical theme
# - no old standalone theme
# - standalone subsection exactly once
python3 - "$CSS" <<'PY'
from pathlib import Path
import sys
s = Path(sys.argv[1]).read_text(encoding="utf-8")
checks = {
    "MF_UNIFIED_APP_THEME_START": 1,
    "MF_UNIFIED_APP_THEME_END": 1,
    "MF_UNIFIED_STANDALONE_START": 1,
    "MF_UNIFIED_STANDALONE_END": 1,
    "MF_STANDALONE_MISSION_THEME_START": 0,
}
for marker, expected in checks.items():
    actual = s.count(marker)
    if actual != expected:
        raise SystemExit(f"ERROR: {marker} count={actual}, expected={expected}")
print("Theme layer guardrails passed.")
PY

git diff --check -- "$CSS" "$SYSTEM" "$TOKENS" "$TRADING"

echo
git diff --stat -- "$CSS" "$SYSTEM" "$TOKENS" "$TRADING"

git add "$CSS" "$SYSTEM" "$TOKENS" "$TRADING"

if git diff --cached --quiet; then
  echo "No changes to commit."
else
  git commit -m "Extend single Mission Control theme to standalone pages"
fi

git push origin main

echo
echo "DONE — one canonical Mission Control visual layer, no standalone override stack."
