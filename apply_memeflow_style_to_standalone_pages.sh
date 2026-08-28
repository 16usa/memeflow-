#!/usr/bin/env bash
set -euo pipefail

# MEMEFLOW — extend Mission Control visual language to standalone pages.
# Pages covered: system.html, system-tokens.html, trading.html.
# Presentation only; no JS/API/trading/chart/3D logic is changed.

if [[ -d "memeflow-app" ]]; then
  APP="memeflow-app"
elif [[ -f "memeflow-brand.css" ]]; then
  APP="."
else
  echo "ERROR: Run this from the MEMEFLOW repository root (or memeflow-app)." >&2
  exit 1
fi

echo "Syncing main..."
git fetch origin
git checkout main
git pull --ff-only origin main

if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "ERROR: Tracked local changes exist. Commit/stash them first; patch stopped safely." >&2
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
BACKUP="/tmp/memeflow-standalone-theme-$STAMP"
mkdir -p "$BACKUP"
cp "$CSS" "$SYSTEM" "$TOKENS" "$TRADING" "$BACKUP"/
echo "Backup: $BACKUP"

python3 - "$CSS" "$SYSTEM" "$TOKENS" "$TRADING" <<'PY'
from pathlib import Path
import re, sys

css_path = Path(sys.argv[1])
html_paths = [Path(p) for p in sys.argv[2:]]

theme = '/* MF_STANDALONE_MISSION_THEME_START */\n/* MEMEFLOW STANDALONE MISSION THEME V1\n   Extends the Mission Control visual language to:\n   - /system.html\n   - /system-tokens.html\n   - /trading.html\n   Presentation only. No graph, feed, chart, trading, API or navigation logic.\n*/\n\n/* ---------- shared standalone shell ---------- */\n.system-shell,\n.flow-page,\n.shell{\n  --mf-sa-panel:linear-gradient(180deg,rgba(15,21,28,.94),rgba(9,13,18,.96));\n  --mf-sa-panel-soft:rgba(255,255,255,.018);\n  --mf-sa-panel-hover:rgba(255,255,255,.032);\n  --mf-sa-line:rgba(145,166,190,.15);\n  --mf-sa-line-strong:rgba(145,166,190,.26);\n  --mf-sa-text:#f7f9fc;\n  --mf-sa-muted:#8d99a8;\n  --mf-sa-cyan:#61dfff;\n  --mf-sa-green:#58e4ad;\n  --mf-sa-yellow:#f2c668;\n  --mf-sa-red:#ff6c7b;\n  color:var(--mf-sa-text)!important;\n}\n\n.system-shell *,\n.flow-page *,\n.shell *{\n  scrollbar-color:rgba(145,166,190,.24) transparent;\n}\n\n.system-shell .eyebrow,\n.flow-page .eyebrow,\n.shell .eyebrow{\n  color:var(--mf-sa-cyan)!important;\n  font-weight:900!important;\n  letter-spacing:.13em!important;\n  text-transform:uppercase!important;\n}\n\n/* ---------- headers: same glass language as Mission Control ---------- */\n.system-shell .topbar,\n.flow-header,\n.shell>.topbar{\n  border:1px solid var(--mf-sa-line)!important;\n  border-radius:18px!important;\n  background:rgba(6,9,13,.78)!important;\n  box-shadow:inset 0 1px 0 rgba(255,255,255,.022)!important;\n  backdrop-filter:blur(24px) saturate(130%)!important;\n  -webkit-backdrop-filter:blur(24px) saturate(130%)!important;\n}\n\n.system-shell .brand,\n.flow-header .header-title span,\n.shell .brand-title{\n  color:var(--mf-sa-text)!important;\n  letter-spacing:.12em!important;\n  font-weight:900!important;\n}\n\n.system-shell .subtitle,\n.flow-header .header-title strong,\n.shell .brand-sub{\n  color:var(--mf-sa-muted)!important;\n}\n\n.system-shell .back,\n.flow-header .back-button,\n.shell .ghost-btn,\n.shell .wallet-btn,\n.system-shell .tool-btn{\n  border:1px solid var(--mf-sa-line)!important;\n  border-radius:12px!important;\n  background:#121a24!important;\n  color:#dce5ee!important;\n  box-shadow:none!important;\n}\n.system-shell .back:hover,\n.flow-header .back-button:hover,\n.shell .ghost-btn:hover,\n.shell .wallet-btn:hover,\n.system-shell .tool-btn:hover{\n  border-color:rgba(97,223,255,.44)!important;\n  background:#151f2b!important;\n}\n.shell .wallet-btn{\n  border-color:rgba(97,223,255,.34)!important;\n}\n.system-shell .tool-btn.active{\n  border-color:rgba(97,223,255,.32)!important;\n  background:rgba(97,223,255,.07)!important;\n  color:#dff9ff!important;\n}\n\n/* ---------- system / live pipeline ---------- */\n.system-shell .scene-title,\n.system-shell .viewport-wrap,\n.system-shell .telemetry,\n.system-shell .activity-panel,\n.system-shell .inspector{\n  border:1px solid var(--mf-sa-line)!important;\n  border-radius:18px!important;\n  background:var(--mf-sa-panel)!important;\n  box-shadow:none!important;\n}\n\n.system-shell .scene-title{\n  background:\n    radial-gradient(circle at 95% 5%,rgba(97,223,255,.065),transparent 38%),\n    var(--mf-sa-panel)!important;\n}\n\n.system-shell .scene-title h1,\n.system-shell .activity-head h2,\n.system-shell .inspector-head h2{\n  color:var(--mf-sa-text)!important;\n  letter-spacing:-.035em!important;\n}\n.system-shell .scene-title p,\n.system-shell .inspector-summary{\n  color:var(--mf-sa-muted)!important;\n}\n\n.system-shell .status-chip,\n.system-shell .state-pill,\n.system-shell .live-badge,\n.system-shell .metric-grid>*,\n.system-shell .reason-block,\n.system-shell .gate-list>*,\n.system-shell .telemetry-item{\n  border-color:var(--mf-sa-line)!important;\n  background:var(--mf-sa-panel-soft)!important;\n  box-shadow:none!important;\n}\n\n.system-shell .status-chip{\n  border-radius:999px!important;\n}\n.system-shell .state-pill,\n.system-shell .live-badge{\n  border-radius:999px!important;\n}\n.system-shell .metric-grid>*,\n.system-shell .reason-block,\n.system-shell .gate-list>*{\n  border-radius:10px!important;\n}\n\n.system-shell .status-chip span,\n.system-shell .metric-grid span,\n.system-shell .telemetry-item span,\n.system-shell .telemetry-item small,\n.system-shell .reason-block>span,\n.system-shell .gate-list span{\n  color:var(--mf-sa-muted)!important;\n}\n\n.system-shell .status-chip b,\n.system-shell .metric-grid strong,\n.system-shell .telemetry-item strong{\n  color:var(--mf-sa-text)!important;\n  font-variant-numeric:tabular-nums!important;\n}\n\n/* Keep the visualization itself dark and clean, but inside Mission geometry. */\n.system-shell .viewport-wrap{\n  background:\n    radial-gradient(ellipse at 50% 52%,rgba(97,223,255,.035),transparent 34%),\n    linear-gradient(180deg,rgba(7,11,16,.98),rgba(4,7,10,.99))!important;\n}\n.system-shell .mf-flow-v4-rates{\n  border-color:var(--mf-sa-line)!important;\n  border-radius:12px!important;\n  background:rgba(8,12,17,.82)!important;\n  box-shadow:inset 0 1px 0 rgba(255,255,255,.022)!important;\n}\n.system-shell .mf-flow-v4-rate span,\n.system-shell .mf-flow-v4-rate small,\n.system-shell .mf-flow-v4-foot{\n  color:var(--mf-sa-muted)!important;\n}\n.system-shell .mf-flow-v4-rate b{\n  color:var(--mf-sa-text)!important;\n}\n.system-shell .mf-flow-v4-rate.decode b{\n  color:var(--mf-sa-cyan)!important;\n}\n\n/* Recent token rail in System view */\n.system-shell .token-rail>*{\n  border-color:var(--mf-sa-line)!important;\n  background:var(--mf-sa-panel-soft)!important;\n  box-shadow:none!important;\n  border-radius:12px!important;\n}\n.system-shell .flow-view-all{\n  color:var(--mf-sa-cyan)!important;\n}\n\n/* ---------- token flow page ---------- */\n.flow-page .flow-hero,\n.flow-page .flow-toolbar,\n.flow-page .pagination{\n  border:1px solid var(--mf-sa-line)!important;\n  border-radius:18px!important;\n  background:var(--mf-sa-panel)!important;\n  box-shadow:none!important;\n}\n\n.flow-page .flow-hero{\n  background:\n    radial-gradient(circle at 95% 0,rgba(97,223,255,.065),transparent 42%),\n    var(--mf-sa-panel)!important;\n}\n.flow-page .flow-hero h1{\n  color:var(--mf-sa-text)!important;\n  letter-spacing:-.04em!important;\n}\n.flow-page .flow-hero p,\n.flow-page .hero-counter span,\n.flow-page .page-state span,\n.flow-page #lastUpdate{\n  color:var(--mf-sa-muted)!important;\n}\n.flow-page .hero-counter strong,\n.flow-page .page-state strong{\n  color:var(--mf-sa-text)!important;\n  font-variant-numeric:tabular-nums!important;\n}\n\n.flow-page .state-summary{\n  gap:8px!important;\n}\n.flow-page .summary-card{\n  border:1px solid var(--mf-sa-line)!important;\n  border-radius:12px!important;\n  background:var(--mf-sa-panel-soft)!important;\n  box-shadow:none!important;\n}\n.flow-page .summary-card:hover{\n  background:var(--mf-sa-panel-hover)!important;\n}\n.flow-page .summary-card.active{\n  border-color:rgba(97,223,255,.46)!important;\n  background:rgba(97,223,255,.055)!important;\n  box-shadow:inset 2px 0 0 var(--mf-sa-cyan)!important;\n}\n.flow-page .summary-card span{\n  color:var(--mf-sa-muted)!important;\n  letter-spacing:.10em!important;\n}\n.flow-page .summary-card strong{\n  color:var(--mf-sa-text)!important;\n  font-variant-numeric:tabular-nums!important;\n}\n/* Preserve state meaning, but remove heavy tinted card backgrounds. */\n.flow-page .summary-card.ready{border-color:rgba(88,228,173,.22)!important;}\n.flow-page .summary-card.blocked{border-color:rgba(255,108,123,.22)!important;}\n.flow-page .summary-card.watch{border-color:rgba(97,223,255,.18)!important;}\n.flow-page .summary-card.waiting{border-color:var(--mf-sa-line)!important;}\n\n.flow-page .search-wrap{\n  border:1px solid var(--mf-sa-line)!important;\n  border-radius:12px!important;\n  background:var(--mf-sa-panel-soft)!important;\n  box-shadow:none!important;\n}\n.flow-page .search-wrap input{\n  color:var(--mf-sa-text)!important;\n  background:transparent!important;\n}\n.flow-page .search-wrap input::placeholder{\n  color:var(--mf-sa-muted)!important;\n}\n.flow-page #refreshButton,\n.flow-page .pagination button,\n.flow-page .details-button{\n  border:1px solid var(--mf-sa-line)!important;\n  border-radius:12px!important;\n  background:#121a24!important;\n  color:#dce5ee!important;\n  box-shadow:none!important;\n}\n.flow-page #refreshButton:hover,\n.flow-page .pagination button:hover,\n.flow-page .details-button:hover{\n  border-color:rgba(97,223,255,.44)!important;\n  background:#151f2b!important;\n}\n\n.flow-page .flow-token{\n  border:1px solid var(--mf-sa-line)!important;\n  border-radius:16px!important;\n  background:var(--mf-sa-panel)!important;\n  box-shadow:none!important;\n}\n.flow-page .flow-token:hover{\n  border-color:rgba(97,223,255,.23)!important;\n  background:linear-gradient(180deg,rgba(17,24,32,.95),rgba(10,15,20,.97))!important;\n}\n.flow-page .flow-token::before{\n  opacity:.72!important;\n}\n.flow-page .token-avatar{\n  border-color:var(--mf-sa-line-strong)!important;\n  background:var(--mf-sa-panel-soft)!important;\n  box-shadow:none!important;\n}\n.flow-page .token-name,\n.flow-page .token-metric strong{\n  color:var(--mf-sa-text)!important;\n}\n.flow-page .token-metric span{\n  color:var(--mf-sa-muted)!important;\n  letter-spacing:.09em!important;\n}\n.flow-page .token-state{\n  border-radius:999px!important;\n  box-shadow:none!important;\n}\n.flow-page .token-details,\n.flow-page .detail-block{\n  border-color:var(--mf-sa-line)!important;\n  background:var(--mf-sa-panel-soft)!important;\n  box-shadow:none!important;\n}\n.flow-page .token-source-link{\n  box-shadow:none!important;\n}\n.flow-page .live-status{\n  border-color:transparent!important;\n  background:transparent!important;\n  box-shadow:none!important;\n}\n\n/* ---------- trading terminal ---------- */\n.shell>.topbar{\n  box-shadow:inset 0 1px 0 rgba(255,255,255,.022)!important;\n}\n.shell .engine-strip .status-pill,\n.shell .status-pill,\n.shell .decision-badge,\n.shell .tiny-state,\n.shell .mode-badge,\n.shell .approval-count{\n  border:1px solid var(--mf-sa-line)!important;\n  border-radius:999px!important;\n  background:var(--mf-sa-panel-soft)!important;\n  box-shadow:none!important;\n}\n\n.shell .panel{\n  border:1px solid var(--mf-sa-line)!important;\n  border-radius:18px!important;\n  background:var(--mf-sa-panel)!important;\n  box-shadow:none!important;\n}\n.shell .panel:hover{\n  border-color:rgba(97,223,255,.23)!important;\n}\n\n.shell .panel-head,\n.shell .chart-head{\n  border-color:var(--mf-sa-line)!important;\n  background:transparent!important;\n}\n.shell .panel-head h2,\n.shell .chart-head h1{\n  color:var(--mf-sa-text)!important;\n  letter-spacing:-.035em!important;\n}\n.shell .token-meta,\n.shell .token-market,\n.shell .field-hint,\n.shell .section-title,\n.shell .control-foot,\n.shell .empty{\n  color:var(--mf-sa-muted)!important;\n}\n\n.shell .token-avatar,\n.shell .price-block,\n.shell .timeframes button,\n.shell .indicator-bar,\n.shell .indicator-scroll button,\n.shell .selected-metrics>div,\n.shell .control-section,\n.shell .amount-box,\n.shell .strategy-grid label,\n.shell .wallet-address,\n.shell .live-warning,\n.shell .approval-list>*,\n.shell .positions-list>*,\n.shell .trade-history>*,\n.shell .candidate-filter,\n.shell .candidate-list>*{\n  border-color:var(--mf-sa-line)!important;\n  background:var(--mf-sa-panel-soft)!important;\n  box-shadow:none!important;\n}\n\n.shell .token-avatar,\n.shell .price-block,\n.shell .amount-box,\n.shell .wallet-address,\n.shell .live-warning{\n  border-radius:12px!important;\n}\n.shell .selected-metrics>div,\n.shell .strategy-grid label,\n.shell .candidate-list>*,\n.shell .approval-list>*,\n.shell .positions-list>*,\n.shell .trade-history>*{\n  border-radius:10px!important;\n}\n\n.shell .timeframes button,\n.shell .indicator-scroll button,\n.shell .candidate-filter button{\n  border-radius:10px!important;\n  color:var(--mf-sa-muted)!important;\n  box-shadow:none!important;\n}\n.shell .timeframes button.active,\n.shell .indicator-scroll button.active,\n.shell .indicator-scroll button[aria-pressed="true"],\n.shell .candidate-filter button.active{\n  border-color:rgba(97,223,255,.38)!important;\n  background:rgba(97,223,255,.065)!important;\n  color:var(--mf-sa-cyan)!important;\n  box-shadow:none!important;\n}\n\n.shell .chart-wrap{\n  background:\n    linear-gradient(180deg,rgba(5,9,13,.84),rgba(4,7,10,.94))!important;\n  border-color:var(--mf-sa-line)!important;\n}\n.shell .chart-legend{\n  color:var(--mf-sa-muted)!important;\n}\n.shell .selected-metrics span{\n  color:var(--mf-sa-muted)!important;\n}\n.shell .selected-metrics strong{\n  color:var(--mf-sa-text)!important;\n  font-variant-numeric:tabular-nums!important;\n}\n\n.shell input,\n.shell select{\n  border-color:var(--mf-sa-line-strong)!important;\n  border-radius:10px!important;\n  background:#10161d!important;\n  color:var(--mf-sa-text)!important;\n  box-shadow:none!important;\n}\n.shell input:focus,\n.shell select:focus{\n  border-color:rgba(97,223,255,.55)!important;\n  box-shadow:0 0 0 3px rgba(97,223,255,.07)!important;\n  outline:none!important;\n}\n\n.shell .secondary-btn,\n.shell .assist-btn,\n.shell .start-btn,\n.shell .pause-btn,\n.shell #killBtn,\n.shell .unit-toggle button,\n.shell #copyMintBtn{\n  border:1px solid var(--mf-sa-line)!important;\n  border-radius:12px!important;\n  background:#121a24!important;\n  color:#eaf0f6!important;\n  box-shadow:none!important;\n}\n.shell .secondary-btn:hover,\n.shell .assist-btn:hover,\n.shell .start-btn:hover,\n.shell .pause-btn:hover,\n.shell #killBtn:hover,\n.shell .unit-toggle button:hover,\n.shell #copyMintBtn:hover{\n  border-color:rgba(97,223,255,.44)!important;\n  background:#151f2b!important;\n}\n.shell .start-btn,\n.shell .unit-toggle button.active{\n  border-color:rgba(88,228,173,.30)!important;\n  background:rgba(88,228,173,.055)!important;\n  color:var(--mf-sa-green)!important;\n}\n.shell .pause-btn,\n.shell #killBtn{\n  border-color:rgba(255,108,123,.24)!important;\n  background:rgba(255,108,123,.035)!important;\n  color:var(--mf-sa-red)!important;\n}\n\n/* ---------- mobile density: same rhythm as Mission Control ---------- */\n@media(max-width:820px){\n  .system-shell .topbar,\n  .flow-header,\n  .shell>.topbar,\n  .system-shell .scene-title,\n  .system-shell .viewport-wrap,\n  .system-shell .telemetry,\n  .system-shell .activity-panel,\n  .system-shell .inspector,\n  .flow-page .flow-hero,\n  .flow-page .flow-toolbar,\n  .flow-page .pagination,\n  .flow-page .flow-token,\n  .shell .panel{\n    border-radius:16px!important;\n  }\n\n  .system-shell .scene-title,\n  .flow-page .flow-hero{\n    padding:16px!important;\n  }\n\n  .flow-page .state-summary{\n    gap:7px!important;\n  }\n  .flow-page .summary-card{\n    border-radius:11px!important;\n  }\n\n  .flow-page .flow-token{\n    background:linear-gradient(180deg,rgba(14,20,27,.94),rgba(8,12,17,.97))!important;\n  }\n\n  .shell .panel-head{\n    padding:10px 12px!important;\n  }\n  .shell .chart-head{\n    padding:12px!important;\n  }\n  .shell .control-section{\n    border-radius:12px!important;\n  }\n}\n\n@media(max-width:430px){\n  .system-shell .scene-title h1,\n  .flow-page .flow-hero h1{\n    letter-spacing:-.045em!important;\n  }\n\n  .flow-page .flow-token{\n    border-color:rgba(145,166,190,.14)!important;\n  }\n\n  .shell .selected-metrics>div{\n    background:rgba(255,255,255,.014)!important;\n  }\n}\n/* MF_STANDALONE_MISSION_THEME_END */'
start = "/* MF_STANDALONE_MISSION_THEME_START */"
end = "/* MF_STANDALONE_MISSION_THEME_END */"

text = css_path.read_text(encoding="utf-8")
if start in text and end in text:
    rx = re.compile(re.escape(start) + r".*?" + re.escape(end), re.S)
    text, n = rx.subn(theme, text, count=1)
    if n != 1:
        raise SystemExit("Could not safely replace standalone theme block.")
else:
    text = text.rstrip() + "\n\n" + theme + "\n"
css_path.write_text(text, encoding="utf-8")

# Cache-bust the shared stylesheet on the three standalone pages.
for path in html_paths:
    html = path.read_text(encoding="utf-8")
    html2, n = re.subn(
        r'href=(["\'])/memeflow-brand\.css\?v=[^"\']+\1',
        lambda m: f'href={m.group(1)}/memeflow-brand.css?v=mission-all-v1{m.group(1)}',
        html,
        count=1
    )
    if n != 1:
        # Also support an unversioned link if it ever appears.
        html2, n = re.subn(
            r'href=(["\'])/memeflow-brand\.css\1',
            lambda m: f'href={m.group(1)}/memeflow-brand.css?v=mission-all-v1{m.group(1)}',
            html,
            count=1
        )
    if n != 1:
        raise SystemExit(f"Could not find memeflow-brand.css link in {path}")
    path.write_text(html2, encoding="utf-8")

print("Updated shared theme + cache-busting links.")
PY

git diff --check -- "$CSS" "$SYSTEM" "$TOKENS" "$TRADING"

echo
echo "Changed files:"
git diff --stat -- "$CSS" "$SYSTEM" "$TOKENS" "$TRADING"

git add "$CSS" "$SYSTEM" "$TOKENS" "$TRADING"

if git diff --cached --quiet; then
  echo "No new changes to commit."
else
  git commit -m "Apply Mission Control style to standalone system and trading pages"
fi

echo
echo "Pushing main..."
git push origin main

echo
echo "DONE — Mission Control style applied to System, Token Flow and Trading."
