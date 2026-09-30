#!/usr/bin/env python3
from pathlib import Path
from datetime import datetime
import subprocess
import sys

EXPECTED_REPO_FRAGMENT = "16usa/memeflow-"
CSS_NAME = "memeflow-pure-black-final-v225.css"
LINK_MARKER = "MEMEFLOW_PURE_BLACK_FINAL_V225_ASSET"
JS_MARKER = "MEMEFLOW_PURE_BLACK_FINAL_V225_CHART"

def fail(msg):
    print(f"\n[FAIL] {msg}")
    sys.exit(1)

root = Path.cwd()
app = root / "memeflow-app"
if not app.is_dir() and root.name == "memeflow-app":
    app = root
if not app.is_dir():
    fail("memeflow-app not found. Run this from the existing Replit workspace Shell.")

try:
    origin = subprocess.check_output(
        ["git", "config", "--get", "remote.origin.url"],
        cwd=root,
        text=True,
        stderr=subprocess.DEVNULL,
    ).strip()
except Exception:
    origin = ""

if origin and EXPECTED_REPO_FRAGMENT not in origin:
    fail(f"Unexpected git origin: {origin}")

html_names = [
    "index.html",
    "system.html",
    "system-tokens.html",
    "trading.html",
    "settings.html",
    "smart-vault.html",
    "how-it-works.html",
    "agent-performance.html",
    "owner-intelligence.html",
    "system-source.html",
    "x100.html",
]
html_paths = [app / name for name in html_names if (app / name).is_file()]
trading_js = app / "trading.js"
css_path = app / CSS_NAME

if not trading_js.is_file():
    fail(f"Missing required file: {trading_js}")

final_css = r"""
/* MEMEFLOW PURE BLACK FINAL V225
   Loaded LAST on every main page.
   Dark only: every structural surface is true #000000.
   Existing text/status/accent colors are preserved.
   Frames/dividers remain 0.5px.
*/

html:not([data-theme="light"]){
  --mf-v225-black:#000000;
  --mf-v225-line:#252525;

  --bg:#000000 !important;
  --panel:#000000 !important;
  --panel-solid:#000000 !important;
  --panel-2:#000000 !important;
  --surface:#000000 !important;
  --surface2:#000000 !important;
  --surface3:#000000 !important;
  --surface-2:#000000 !important;

  --mf-app-bg:#000000 !important;
  --mf-app-surface:#000000 !important;
  --mf-app-surface-2:#000000 !important;
  --mf-app-surface-3:#000000 !important;
  --mf-app-panel-top:#000000 !important;
  --mf-app-panel-bottom:#000000 !important;
  --mf-app-soft:#000000 !important;
  --mf-app-soft-hover:#000000 !important;

  --mf-nav-bg:#000000 !important;
  --mf-nav-surface:#000000 !important;
  --mf-nav-surface-2:#000000 !important;

  --hiw-bg:#000000 !important;
  --hiw-panel:#000000 !important;
  --hiw-panel-strong:#000000 !important;

  --v-bg:#000000 !important;
  --v-panel:#000000 !important;
  --v-panel2:#000000 !important;

  --line:var(--mf-v225-line) !important;
  --line2:var(--mf-v225-line) !important;
  --line-strong:var(--mf-v225-line) !important;
  --mf-app-line:var(--mf-v225-line) !important;
  --mf-app-line-strong:var(--mf-v225-line) !important;
  --mf-nav-line:var(--mf-v225-line) !important;
  --mf-nav-line-strong:var(--mf-v225-line) !important;
  --hiw-line:var(--mf-v225-line) !important;
  --hiw-line-strong:var(--mf-v225-line) !important;
  --v-line:var(--mf-v225-line) !important;
  --v-line2:var(--mf-v225-line) !important;
  --mf-v63-line-dark:var(--mf-v225-line) !important;
}

html:not([data-theme="light"]),
html:not([data-theme="light"]) body,
html:not([data-theme="light"]) body > .shell,
html:not([data-theme="light"]) body > main,
html:not([data-theme="light"]) .shell,
html:not([data-theme="light"]) .terminal,
html:not([data-theme="light"]) .center-stack{
  background:#000000 !important;
  background-color:#000000 !important;
  background-image:none !important;
  box-shadow:none !important;
}

html:not([data-theme="light"]) body :where(
  .panel,
  .sidebar,
  .chart-panel,
  .candidates-panel,
  .approvals-panel,
  .positions-panel,
  .control-panel,
  .history-panel,
  .flow-page,
  .flow-hero,
  .flow-toolbar,
  .pagination,
  .execution-preview,
  .advanced-intelligence,
  .mf293-settings-panel,
  .mf293-settings-head,
  .mf293-settings-body,
  .mf293-settings-group,
  .mf293-settings-footer,
  .mf-vault-shell,
  .mf-vault-card,
  .mf-vault-status-panel,
  .mf-hiw-shell,
  .mf-hiw-status-card,
  .mf-hiw-map-shell,
  .mf-hiw-card,
  .mf-hiw-money,
  .mf-hiw-cta,
  .ap-shell,
  .ap-panel,
  .ap-source,
  .activity-panel,
  .mf-infra,
  .mf-nav-drawer
){
  background:#000000 !important;
  background-color:#000000 !important;
  background-image:none !important;
  box-shadow:none !important;
}

html:not([data-theme="light"]) body :where(
  .panel-head,
  .panel-body,
  .panel-foot,
  .chart-head,
  .chart-wrap,
  #chartCanvas,
  .candidate-list,
  .approval-list,
  .positions-list,
  .history-list,
  .strategy-summary-list,
  .strategy-summary-row,
  .strategy-summary-row > div,
  .strategy-summary-foot,
  .selected-metrics,
  .selected-metrics > div,
  .chart-ohlc-row-v32,
  .chart-ohlc-cell-v32,
  .chart-status-row-v32,
  .chart-status-cell-v32,
  .metric,
  .approval-row,
  .control-section,
  .search-wrap,
  .mf-time-window-v47c,
  .wallet-stat,
  .wallet-security,
  .wallet-session-note,
  .wallet-rule,
  .subscription-metric,
  .settings-summary > div,
  .system-health-summary > div,
  .data-row,
  .settings-context,
  .settings-group,
  .mode-option label,
  .profile-option label,
  .toggle-row,
  .execution-readiness,
  .primary-blocker,
  .signal-explainer,
  .execution-check-list,
  .production-empty,
  .mf293-field,
  .mf-agent-item,
  .mf-agent-event,
  .mf-vault-stat,
  .mf-vault-control-row,
  .mf-vault-checklist > div,
  .mf-hiw-node,
  .mf-hiw-step,
  .mf-hiw-map-detail,
  .ap-kpis article,
  .ap-summary > div,
  .factor,
  .rank,
  .empty
){
  background:#000000 !important;
  background-color:#000000 !important;
  background-image:none !important;
  box-shadow:none !important;
}

html:not([data-theme="light"]) .mf-site-header,
html:not([data-theme="light"]) .mf-site-header:not(.mf-site-header--sticky),
html:not([data-theme="light"]) .mf-site-header.mf-site-header--sticky,
html:not([data-theme="light"]) .topbar{
  background:#000000 !important;
  background-color:#000000 !important;
  background-image:none !important;
  box-shadow:none !important;
  backdrop-filter:none !important;
  -webkit-backdrop-filter:none !important;
}

html:not([data-theme="light"]) body :where(
  input,
  select,
  textarea,
  .mf-theme-segmented,
  .setting-field input,
  .setting-field select,
  .ghost-btn,
  .wallet-btn,
  .tool-btn
){
  background:#000000 !important;
  background-color:#000000 !important;
  background-image:none !important;
  box-shadow:none !important;
}

html:not([data-theme="light"]) body :where(
  .panel,
  .sidebar,
  .chart-panel,
  .candidates-panel,
  .approvals-panel,
  .positions-panel,
  .control-panel,
  .history-panel,
  .flow-hero,
  .flow-toolbar,
  .pagination,
  .execution-preview,
  .advanced-intelligence,
  .mf293-settings-panel,
  .mf293-settings-group,
  .mf-vault-card,
  .mf-vault-status-panel,
  .mf-hiw-status-card,
  .mf-hiw-map-shell,
  .mf-hiw-card,
  .mf-hiw-money,
  .mf-hiw-cta,
  .ap-panel,
  .ap-source,
  .activity-panel,
  .mf-infra
){
  border-width:0.5px !important;
  border-style:solid !important;
  border-color:var(--mf-v225-line) !important;
}

html:not([data-theme="light"]) body :where(
  .panel-head,
  .panel-foot,
  .chart-head,
  .timeframes,
  .indicator-bar,
  .selected-metrics,
  .candidate-filter,
  .candidate,
  .data-row,
  .event,
  .details,
  .tx-details,
  .mf-vault-card-head,
  .mf293-settings-head,
  .mf293-settings-footer,
  .mf-hiw-topbar,
  .mf-hiw-faq details,
  .strategy-summary-row,
  .strategy-summary-row > div + div,
  .strategy-summary-foot
){
  border-color:var(--mf-v225-line) !important;
  box-shadow:none !important;
}

html:not([data-theme="light"]) body :where(
  .panel-head,
  .chart-head,
  .timeframes,
  .indicator-bar,
  .selected-metrics,
  .candidate-filter,
  .candidate,
  .data-row,
  .event,
  .details,
  .tx-details,
  .mf-vault-card-head,
  .mf293-settings-head,
  .mf-hiw-topbar,
  .mf-hiw-faq details,
  .strategy-summary-row
){
  border-bottom-width:0.5px !important;
  border-bottom-style:solid !important;
}

html:not([data-theme="light"]) body .selected-metrics > div{
  border-right-width:0.5px !important;
}
html:not([data-theme="light"]) body .strategy-summary-row > div + div{
  border-left-width:0.5px !important;
}

html:not([data-theme="light"]) body :where(
  input,
  select,
  textarea,
  .mf-theme-segmented,
  .decision-badge,
  .state-dot,
  .tiny-state,
  .mode-badge,
  .approval-count,
  .chart-axis-marker-v34,
  .token-avatar,
  button
){
  border-width:0.5px;
}

html:not([data-theme="light"]) body.mf-page-trading #chartCanvas,
html:not([data-theme="light"]) body.mf-page-trading #chartCanvas > div,
html:not([data-theme="light"]) body.mf-page-trading .chart-wrap{
  background:#000000 !important;
  background-color:#000000 !important;
  background-image:none !important;
}
"""

originals = {}
for p in html_paths + [trading_js]:
    originals[p] = p.read_text(encoding="utf-8")
if css_path.exists():
    originals[css_path] = css_path.read_text(encoding="utf-8")

changed = False

if (not css_path.exists()) or css_path.read_text(encoding="utf-8") != final_css:
    css_path.write_text(final_css, encoding="utf-8")
    changed = True

link_block = (
    f'<!-- {LINK_MARKER} -->\n'
    f'<link rel="stylesheet" href="/{CSS_NAME}?v=225-20260928">\n'
    f'<!-- /{LINK_MARKER} -->\n'
)

for path in html_paths:
    content = originals[path]
    if LINK_MARKER in content:
        continue
    idx = content.lower().rfind("</head>")
    if idx < 0:
        fail(f"</head> not found in {path}")
    content = content[:idx] + link_block + content[idx:]
    path.write_text(content, encoding="utf-8")
    changed = True

js = originals[trading_js]
if JS_MARKER not in js:
    old = "  return {\n    background:'transparent',\n    text:'#536f7b',"
    new = (
        f"  /* {JS_MARKER}: real dark canvas, not transparent. */\n"
        "  return {\n"
        "    background:'#000000',\n"
        "    text:'#536f7b',"
    )
    if old not in js:
        fail("Dark chart palette anchor not found in trading.js")
    js = js.replace(old, new, 1)
    trading_js.write_text(js, encoding="utf-8")
    changed = True

if not changed:
    print("\n[OK] V225 is already installed. No files changed.")
    sys.exit(0)

stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
backup_dir = root / f".memeflow-pure-black-final-v225-backup-{stamp}"
backup_dir.mkdir(parents=True, exist_ok=False)

for path, content in originals.items():
    rel = path.relative_to(root)
    target = backup_dir / rel
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(content, encoding="utf-8")

try:
    subprocess.run(["node", "--check", str(trading_js)], cwd=root, check=True)
except FileNotFoundError:
    print("[WARN] node is unavailable; JS syntax check skipped.")
except subprocess.CalledProcessError:
    fail("node --check failed. Restore from backup: " + str(backup_dir))

try:
    subprocess.run(["git", "diff", "--check", "--", "memeflow-app"], cwd=root, check=True)
except Exception:
    print("[WARN] git diff --check could not run.")

print("\n[OK] MEMEFLOW PURE BLACK FINAL V225 installed.")
print(f"[BACKUP] {backup_dir}")
print("\nWhy V224 still looked gray:")
print("  • older page-specific surface rules were still winning on some inner blocks")
print("  • the chart canvas was still transparent and exposed an older surface underneath")
print("\nV225 fixes:")
print("  • new stylesheet loads LAST on every main page")
print("  • html/body/shell/header/modules/nested structural surfaces = #000000")
print("  • ECharts dark background = real #000000")
print("  • frames/dividers stay at 0.5px")
print("  • light theme and semantic status colors stay unchanged")
print("\nNo process/server restart was performed.")
print("\nPush after visual check:")
files = [f"memeflow-app/{CSS_NAME}", "memeflow-app/trading.js"] + [
    str(p.relative_to(root)) for p in html_paths
]
print(
    "git add " + " ".join(files)
    + ' && git commit -m "Force final pure black dark surfaces site wide" && git push'
)
