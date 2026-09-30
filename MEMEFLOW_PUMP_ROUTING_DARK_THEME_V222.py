#!/usr/bin/env python3
from pathlib import Path
from datetime import datetime
import re
import subprocess
import sys

EXPECTED_REPO_FRAGMENT = "16usa/memeflow-"
MARKER = "MEMEFLOW_PUMP_ROUTING_DARK_V222"
CACHE_VERSION = "pump-routing-dark-v222-20260928"

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

css_path = app / "memeflow-cash-dark-v220.css"
if not css_path.is_file():
    fail(f"Missing required file: {css_path}")

html_names = [
    "index.html","system.html","system-tokens.html","trading.html","settings.html",
    "smart-vault.html","how-it-works.html","agent-performance.html",
    "owner-intelligence.html","system-source.html","x100.html"
]
html_paths = [app / name for name in html_names if (app / name).is_file()]

css = css_path.read_text(encoding="utf-8")
html_before = {p: p.read_text(encoding="utf-8") for p in html_paths}
originals = {css_path: css, **html_before}
changed = False

override = r'''
/* ========================================================================
   MEMEFLOW_PUMP_ROUTING_DARK_V222
   Dark-theme visual contract copied from Pump-Fee-Routing:
   canvas #0A0A0A; panel #111111; nested #171717; line #252525;
   primary #FFFFFF; soft #B9B9B9; muted #8B8B8B; faint #666666.
   Border language: 1px solid neutral line, restrained radii, no shadows.
   Light theme and semantic trading/status colors are intentionally untouched.
   ======================================================================== */

html:not([data-theme="light"]){
  color-scheme:dark;

  --mf-pfr-bg:#0A0A0A;
  --mf-pfr-panel:#111111;
  --mf-pfr-panel-2:#171717;
  --mf-pfr-control:#101010;
  --mf-pfr-hover:#191919;
  --mf-pfr-line:#252525;
  --mf-pfr-text:#FFFFFF;
  --mf-pfr-soft:#B9B9B9;
  --mf-pfr-muted:#8B8B8B;
  --mf-pfr-faint:#666666;

  --mf-cash-bg:var(--mf-pfr-bg);
  --mf-cash-surface:var(--mf-pfr-panel);
  --mf-cash-surface-2:var(--mf-pfr-panel-2);
  --mf-cash-surface-hover:var(--mf-pfr-hover);
  --mf-cash-line:var(--mf-pfr-line);
  --mf-cash-line-strong:var(--mf-pfr-line);
  --mf-cash-text:var(--mf-pfr-text);
  --mf-cash-text-soft:#F5F5F5;
  --mf-cash-muted:var(--mf-pfr-muted);
  --mf-cash-faint:var(--mf-pfr-faint);

  --mf-neutral-text-1:var(--mf-pfr-text);
  --mf-neutral-text-2:#F5F5F5;
  --mf-neutral-text-3:var(--mf-pfr-muted);
  --mf-neutral-text-4:var(--mf-pfr-faint);

  --mf-text-primary:var(--mf-pfr-text);
  --mf-text-secondary:var(--mf-pfr-soft);
  --mf-text-tertiary:var(--mf-pfr-muted);
  --mf-text-faint:var(--mf-pfr-faint);

  --bg:var(--mf-pfr-bg) !important;
  --panel:var(--mf-pfr-panel) !important;
  --panel-solid:var(--mf-pfr-panel) !important;
  --panel-2:var(--mf-pfr-panel-2) !important;
  --surface:var(--mf-pfr-panel) !important;
  --surface2:var(--mf-pfr-panel-2) !important;
  --surface3:var(--mf-pfr-hover) !important;
  --surface-2:var(--mf-pfr-panel-2) !important;
  --line:var(--mf-pfr-line) !important;
  --line2:var(--mf-pfr-line) !important;
  --line-strong:var(--mf-pfr-line) !important;
  --text:#F5F5F5 !important;
  --muted:var(--mf-pfr-muted) !important;
  --faint:var(--mf-pfr-faint) !important;

  --mf-app-bg:var(--mf-pfr-bg) !important;
  --mf-app-surface:var(--mf-pfr-panel) !important;
  --mf-app-surface-2:var(--mf-pfr-panel-2) !important;
  --mf-app-surface-3:var(--mf-pfr-hover) !important;
  --mf-app-panel-top:var(--mf-pfr-panel) !important;
  --mf-app-panel-bottom:var(--mf-pfr-panel) !important;
  --mf-app-line:var(--mf-pfr-line) !important;
  --mf-app-line-strong:var(--mf-pfr-line) !important;
  --mf-app-soft:var(--mf-pfr-panel-2) !important;
  --mf-app-soft-hover:var(--mf-pfr-hover) !important;
  --mf-app-text:#F5F5F5 !important;
  --mf-app-muted:var(--mf-pfr-muted) !important;

  --mf-nav-bg:var(--mf-pfr-bg) !important;
  --mf-nav-surface:var(--mf-pfr-panel) !important;
  --mf-nav-surface-2:var(--mf-pfr-panel-2) !important;
  --mf-nav-line:var(--mf-pfr-line) !important;
  --mf-nav-line-strong:var(--mf-pfr-line) !important;
  --mf-nav-text:#F5F5F5 !important;
  --mf-nav-muted:var(--mf-pfr-muted) !important;

  --hiw-bg:var(--mf-pfr-bg) !important;
  --hiw-panel:var(--mf-pfr-panel) !important;
  --hiw-panel-strong:var(--mf-pfr-panel-2) !important;
  --hiw-line:var(--mf-pfr-line) !important;
  --hiw-line-strong:var(--mf-pfr-line) !important;
  --hiw-text:#F5F5F5 !important;
  --hiw-muted:var(--mf-pfr-muted) !important;
  --hiw-muted-2:var(--mf-pfr-faint) !important;

  --v-bg:var(--mf-pfr-bg) !important;
  --v-panel:var(--mf-pfr-panel) !important;
  --v-panel2:var(--mf-pfr-panel-2) !important;
  --v-line:var(--mf-pfr-line) !important;
  --v-line2:var(--mf-pfr-line) !important;
  --v-text:#F5F5F5 !important;
  --v-muted:var(--mf-pfr-muted) !important;
  --v-muted2:var(--mf-pfr-faint) !important;

  --mf-v63-line-dark:var(--mf-pfr-line);
}

html:not([data-theme="light"]),
html:not([data-theme="light"]) body,
html:not([data-theme="light"]) body:where(
  .mf-page-index,.mf-page-system,.mf-page-system-tokens,.mf-page-trading,
  .mf-page-settings,.mf-page-smart-vault,.mf-page-how-it-works,
  .mf-page-agent-performance,.mf-page-x100,.mf-page-owner-intelligence,
  .mf-page-system-source
){
  background:var(--mf-pfr-bg) !important;
  background-color:var(--mf-pfr-bg) !important;
  background-image:none !important;
  color:#F5F5F5 !important;
}

html:not([data-theme="light"]) .mf-site-header,
html:not([data-theme="light"]) .mf-site-header:not(.mf-site-header--sticky),
html:not([data-theme="light"]) .mf-site-header.mf-site-header--sticky{
  background:var(--mf-pfr-bg) !important;
  background-color:var(--mf-pfr-bg) !important;
  background-image:none !important;
  border-bottom:1px solid var(--mf-pfr-line) !important;
  box-shadow:none !important;
}

html:not([data-theme="light"]) .mf-nav-drawer{
  background:#0D0D0D !important;
  background-image:none !important;
  border-color:var(--mf-pfr-line) !important;
  box-shadow:none !important;
}
html:not([data-theme="light"]) .mf-nav-link{
  border-color:var(--mf-pfr-line) !important;
  box-shadow:none !important;
}
html:not([data-theme="light"]) .mf-nav-link:hover,
html:not([data-theme="light"]) .mf-nav-link:focus-visible,
html:not([data-theme="light"]) .mf-nav-link[aria-current="page"]{
  background:var(--mf-pfr-hover) !important;
}

/* Main modules: source project #111111 + 1px #252525 frame. */
html:not([data-theme="light"]) body:where(
  .mf-page-index,.mf-page-system,.mf-page-system-tokens,.mf-page-trading,
  .mf-page-settings,.mf-page-smart-vault,.mf-page-how-it-works,
  .mf-page-agent-performance,.mf-page-x100,.mf-page-owner-intelligence,
  .mf-page-system-source
) :where(
  .panel,.sidebar,.chart-panel,.flow-hero,.flow-toolbar,.pagination,
  .execution-preview,.advanced-intelligence,.mf293-settings-panel,
  .mf293-settings-group,.mf-vault-card,.mf-vault-status-panel,
  .mf-hiw-status-card,.mf-hiw-map-shell,.mf-hiw-card,.mf-hiw-money,
  .mf-hiw-cta,.ap-panel,.ap-source,.activity-panel,.mf-infra
){
  background:var(--mf-pfr-panel) !important;
  background-color:var(--mf-pfr-panel) !important;
  background-image:none !important;
  border-width:1px !important;
  border-style:solid !important;
  border-color:var(--mf-pfr-line) !important;
  border-radius:15px !important;
  box-shadow:none !important;
}

/* Nested modules/rows: source project #171717. */
html:not([data-theme="light"]) body:where(
  .mf-page-index,.mf-page-system,.mf-page-system-tokens,.mf-page-trading,
  .mf-page-settings,.mf-page-smart-vault,.mf-page-how-it-works,
  .mf-page-agent-performance,.mf-page-x100,.mf-page-owner-intelligence,
  .mf-page-system-source
) :where(
  .metric,.approval-row,.selected-metrics > div,.control-section,.search-wrap,
  .mf-time-window-v47c,.wallet-stat,.wallet-security,.wallet-session-note,
  .wallet-rule,.subscription-metric,.settings-summary > div,
  .system-health-summary > div,.data-row,.settings-context,.settings-group,
  .mode-option label,.profile-option label,.toggle-row,.execution-readiness,
  .primary-blocker,.signal-explainer,.execution-check-list,.production-empty,
  .mf293-field,.mf-agent-item,.mf-agent-event,.mf-vault-stat,
  .mf-vault-control-row,.mf-vault-checklist > div,.mf-hiw-node,.mf-hiw-step,
  .mf-hiw-map-detail,.ap-kpis article,.ap-summary > div,.factor,.rank,.empty
){
  background:var(--mf-pfr-panel-2) !important;
  background-color:var(--mf-pfr-panel-2) !important;
  background-image:none !important;
  border-width:1px !important;
  border-style:solid !important;
  border-color:var(--mf-pfr-line) !important;
  border-radius:12px !important;
  box-shadow:none !important;
}

/* Neutral inputs/controls: source #101010 field treatment. */
html:not([data-theme="light"]) :where(
  input,select,textarea,.mf-theme-segmented,.setting-field input,
  .setting-field select,.mf-vault-btn:not(.mf-vault-btn-primary),
  .btn:not(.primary),.ghost-btn,.wallet-btn,.tool-btn
){
  background:var(--mf-pfr-control) !important;
  background-color:var(--mf-pfr-control) !important;
  border-color:var(--mf-pfr-line) !important;
  box-shadow:none !important;
}

/* Divider language: one clean 1px solid #252525 line. */
html:not([data-theme="light"]) :where(
  .panel-head,.panel-foot,.indicator-bar,.selected-metrics,
  .selected-metrics > div,.details,.tx-details,.data-row,.event,
  .mf-vault-card-head,.mf-nav-link,.mf293-settings-head,
  .mf293-settings-footer,.mf-hiw-topbar,.mf-hiw-faq details,footer
){
  border-color:var(--mf-pfr-line) !important;
  box-shadow:none !important;
}

/* Neutral text hierarchy from Pump-Fee-Routing. */
html:not([data-theme="light"]) :where(
  h1,h2,h3,h4,h5,h6,strong,.brand-title,.token-name,.candidate-name
){
  color:var(--mf-pfr-text);
}
html:not([data-theme="light"]) :where(
  .muted,.sub,.subtitle,.hint,.note,.eyebrow
){
  color:var(--mf-pfr-muted);
}

/* Trading plot shell follows the same grayscale contract. */
html:not([data-theme="light"]) body.mf-page-trading :where(
  .chart-wrap,#chartCanvas
){
  background:var(--mf-pfr-bg) !important;
}
html:not([data-theme="light"]) body.mf-page-trading :where(
  .chart-ohlc-cell-v32,.chart-status-cell-v32
){
  background:var(--mf-pfr-panel) !important;
  border-color:var(--mf-pfr-line) !important;
  box-shadow:none !important;
}

/* Semantic colors (BUY READY / WATCH / SL / TP / LIVE / P&L) are preserved. */
html:not([data-theme="light"]) :where(
  .state-pill,.status-pill,.status-chip,.live-badge,.tx-status,
  [class*="is-profit"],[class*="is-loss"],
  [class*="positive"],[class*="negative"]
){
  box-shadow:none !important;
}

/* ========================================================================
   /MEMEFLOW_PUMP_ROUTING_DARK_V222
   ======================================================================== */
'''

if MARKER not in css:
    css += override
    changed = True

version_pattern = re.compile(r'(/memeflow-cash-dark-v220\.css\?v=)[^"\'\s>]+')
updated_html = {}
for path, content in html_before.items():
    if "memeflow-cash-dark-v220.css" not in content:
        continue
    next_content, n = version_pattern.subn(lambda m: m.group(1) + CACHE_VERSION, content)
    if n:
        updated_html[path] = next_content
        if next_content != content:
            changed = True

if not changed:
    print("\n[OK] Pump-Fee-Routing dark theme V222 is already installed.")
    sys.exit(0)

stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
backup_dir = root / f".memeflow-pump-routing-dark-v222-backup-{stamp}"
backup_dir.mkdir(parents=True, exist_ok=False)

for path, content in originals.items():
    rel = path.relative_to(root) if root in path.parents else Path(path.name)
    target = backup_dir / rel
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(content, encoding="utf-8")

css_path.write_text(css, encoding="utf-8")
for path, content in updated_html.items():
    path.write_text(content, encoding="utf-8")

try:
    subprocess.run(["git", "diff", "--check", "--", "memeflow-app"], cwd=root, check=True)
except Exception:
    print("[WARN] git diff --check could not run.")

changed_paths = [css_path, *updated_html.keys()]

print("\n[OK] MEMEFLOW PUMP-FEE-ROUTING DARK THEME V222 installed.")
print(f"[BACKUP] {backup_dir}")
print("\nCopied dark-theme contract:")
print("  • Canvas: #0A0A0A")
print("  • Main blocks: #111111")
print("  • Nested blocks: #171717")
print("  • Borders/dividers: 1px solid #252525")
print("  • Primary text: #FFFFFF / #F5F5F5")
print("  • Soft text: #B9B9B9")
print("  • Muted text: #8B8B8B")
print("  • Faint text: #666666")
print("  • Frames: 15px / 12px radii, no shadows")
print("  • Light theme unchanged")
print("  • Trading/status semantic colors unchanged")
print("\nNo process/server restart was performed.")
print("\nFiles changed:")
for path in changed_paths:
    print("  -", path.relative_to(root))

print("\nPush after visual check:")
print(
    "git add memeflow-app/memeflow-cash-dark-v220.css "
    + " ".join(str(p.relative_to(root)) for p in updated_html.keys())
    + ' && git commit -m "Match dark theme to Pump Fee Routing visual contract" && git push'
)
