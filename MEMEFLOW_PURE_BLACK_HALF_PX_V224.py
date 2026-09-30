#!/usr/bin/env python3
from pathlib import Path
from datetime import datetime
import re
import subprocess
import sys

EXPECTED_REPO_FRAGMENT = "16usa/memeflow-"
MARKER = "MEMEFLOW_PURE_BLACK_HALF_PX_V224"
CACHE_VERSION = "pure-black-half-px-v224-20260928"

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

css = css_path.read_text(encoding="utf-8")
html_before = {p: p.read_text(encoding="utf-8") for p in html_paths}
originals = {css_path: css, **html_before}
changed = False

override = r'''
/* ========================================================================
   MEMEFLOW_PURE_BLACK_HALF_PX_V224

   Dark theme only:
   - page canvas = pure black
   - every neutral block/module = pure black
   - no gradients on neutral surfaces
   - frames + divider lines = 0.5px
   - semantic status/accent colors remain untouched
   ======================================================================== */

html:not([data-theme="light"]){
  --mf-v224-black:#000000;
  --mf-v224-line:#252525;

  --bg:var(--mf-v224-black) !important;
  --panel:var(--mf-v224-black) !important;
  --panel-solid:var(--mf-v224-black) !important;
  --panel-2:var(--mf-v224-black) !important;
  --surface:var(--mf-v224-black) !important;
  --surface2:var(--mf-v224-black) !important;
  --surface3:var(--mf-v224-black) !important;
  --surface-2:var(--mf-v224-black) !important;

  --mf-app-bg:var(--mf-v224-black) !important;
  --mf-app-surface:var(--mf-v224-black) !important;
  --mf-app-surface-2:var(--mf-v224-black) !important;
  --mf-app-surface-3:var(--mf-v224-black) !important;
  --mf-app-panel-top:var(--mf-v224-black) !important;
  --mf-app-panel-bottom:var(--mf-v224-black) !important;
  --mf-app-soft:var(--mf-v224-black) !important;
  --mf-app-soft-hover:var(--mf-v224-black) !important;

  --mf-nav-bg:var(--mf-v224-black) !important;
  --mf-nav-surface:var(--mf-v224-black) !important;
  --mf-nav-surface-2:var(--mf-v224-black) !important;

  --hiw-bg:var(--mf-v224-black) !important;
  --hiw-panel:var(--mf-v224-black) !important;
  --hiw-panel-strong:var(--mf-v224-black) !important;

  --v-bg:var(--mf-v224-black) !important;
  --v-panel:var(--mf-v224-black) !important;
  --v-panel2:var(--mf-v224-black) !important;

  --line:var(--mf-v224-line) !important;
  --line2:var(--mf-v224-line) !important;
  --line-strong:var(--mf-v224-line) !important;
  --mf-app-line:var(--mf-v224-line) !important;
  --mf-app-line-strong:var(--mf-v224-line) !important;
  --mf-nav-line:var(--mf-v224-line) !important;
  --mf-nav-line-strong:var(--mf-v224-line) !important;
  --hiw-line:var(--mf-v224-line) !important;
  --hiw-line-strong:var(--mf-v224-line) !important;
  --v-line:var(--mf-v224-line) !important;
  --v-line2:var(--mf-v224-line) !important;
  --mf-v63-line-dark:var(--mf-v224-line) !important;
}

html:not([data-theme="light"]),
html:not([data-theme="light"]) body,
html:not([data-theme="light"]) body:where(
  .mf-page-index,
  .mf-page-system,
  .mf-page-system-tokens,
  .mf-page-trading,
  .mf-page-settings,
  .mf-page-smart-vault,
  .mf-page-how-it-works,
  .mf-page-agent-performance,
  .mf-page-x100,
  .mf-page-owner-intelligence,
  .mf-page-system-source
){
  background:#000000 !important;
  background-color:#000000 !important;
  background-image:none !important;
}

/* All neutral structural blocks are pure black. */
html:not([data-theme="light"]) body:where(
  .mf-page-index,
  .mf-page-system,
  .mf-page-system-tokens,
  .mf-page-trading,
  .mf-page-settings,
  .mf-page-smart-vault,
  .mf-page-how-it-works,
  .mf-page-agent-performance,
  .mf-page-x100,
  .mf-page-owner-intelligence,
  .mf-page-system-source
) :where(
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
  .mf293-settings-head,
  .mf293-settings-body,
  .mf293-settings-footer,
  .mf-vault-card,
  .mf-vault-status-panel,
  .mf-vault-stat,
  .mf-vault-control-row,
  .mf-vault-checklist > div,
  .mf-hiw-status-card,
  .mf-hiw-map-shell,
  .mf-hiw-card,
  .mf-hiw-node,
  .mf-hiw-step,
  .mf-hiw-map-detail,
  .mf-hiw-money,
  .mf-hiw-cta,
  .ap-panel,
  .ap-source,
  .ap-kpis article,
  .ap-summary > div,
  .factor,
  .rank,
  .empty,
  .activity-panel,
  .mf-infra,
  .metric,
  .approval-row,
  .selected-metrics > div,
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
  .mf-agent-event
){
  background:#000000 !important;
  background-color:#000000 !important;
  background-image:none !important;
  box-shadow:none !important;
}

/* Header/nav are also pure black. */
html:not([data-theme="light"]) .mf-site-header,
html:not([data-theme="light"]) .mf-nav-drawer{
  background:#000000 !important;
  background-color:#000000 !important;
  background-image:none !important;
  box-shadow:none !important;
}

/* Restore/normalize block frames at exactly 0.5px. */
html:not([data-theme="light"]) body:where(
  .mf-page-index,
  .mf-page-system,
  .mf-page-system-tokens,
  .mf-page-trading,
  .mf-page-settings,
  .mf-page-smart-vault,
  .mf-page-how-it-works,
  .mf-page-agent-performance,
  .mf-page-x100,
  .mf-page-owner-intelligence,
  .mf-page-system-source
) :where(
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
  border-color:var(--mf-v224-line) !important;
  box-shadow:none !important;
}

/* Nested neutral framed elements = same 0.5px contract. */
html:not([data-theme="light"]) :where(
  .metric,
  .approval-row,
  .wallet-stat,
  .wallet-security,
  .wallet-session-note,
  .wallet-rule,
  .subscription-metric,
  .settings-summary > div,
  .system-health-summary > div,
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
  border-width:0.5px !important;
  border-style:solid !important;
  border-color:var(--mf-v224-line) !important;
  box-shadow:none !important;
}

/* Every structural divider line = exactly 0.5px. */
html:not([data-theme="light"]) :where(
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
  .home-route-rail span,
  footer
){
  border-color:var(--mf-v224-line) !important;
  box-shadow:none !important;
}

/* Explicit bottom-divider normalization. */
html:not([data-theme="light"]) :where(
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
  .mf-hiw-faq details
){
  border-bottom-width:0.5px !important;
  border-bottom-style:solid !important;
}

/* Input/control borders follow the same half-pixel language. */
html:not([data-theme="light"]) :where(
  input,
  select,
  textarea,
  .mf-theme-segmented,
  .setting-field input,
  .setting-field select,
  .mf-vault-btn,
  .btn,
  .ghost-btn,
  .wallet-btn,
  .tool-btn,
  .decision-badge,
  .state-dot,
  .tiny-state,
  .mode-badge,
  .approval-count,
  .chart-axis-marker-v34,
  .token-avatar
){
  border-width:0.5px !important;
}

/* Trading chart shell itself is pure black. */
html:not([data-theme="light"]) body.mf-page-trading :where(
  .chart-wrap,
  #chartCanvas,
  .chart-ohlc-cell-v32,
  .chart-status-cell-v32
){
  background:#000000 !important;
  background-color:#000000 !important;
  background-image:none !important;
  box-shadow:none !important;
}

/* Do not alter light theme. */
/* ========================================================================
   /MEMEFLOW_PURE_BLACK_HALF_PX_V224
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
    next_content, n = version_pattern.subn(
        lambda m: m.group(1) + CACHE_VERSION,
        content
    )
    if n:
        updated_html[path] = next_content
        if next_content != content:
            changed = True

if not changed:
    print("\n[OK] V224 is already installed. No files changed.")
    sys.exit(0)

stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
backup_dir = root / f".memeflow-pure-black-half-px-v224-backup-{stamp}"
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
    subprocess.run(
        ["git", "diff", "--check", "--", "memeflow-app"],
        cwd=root,
        check=True
    )
except Exception:
    print("[WARN] git diff --check could not run.")

print("\n[OK] MEMEFLOW PURE BLACK + 0.5PX V224 installed.")
print(f"[BACKUP] {backup_dir}")
print("\nV224 dark-theme contract:")
print("  • Page background: #000000")
print("  • All neutral blocks/modules: #000000")
print("  • Neutral gradients removed")
print("  • Frames: 0.5px")
print("  • Divider lines: 0.5px")
print("  • Input/control borders: 0.5px")
print("  • Border color remains neutral #252525")
print("  • Light theme unchanged")
print("\nNo process/server restart was performed.")
print("\nPush after visual check:")
files = ["memeflow-app/memeflow-cash-dark-v220.css"] + [
    str(p.relative_to(root)) for p in updated_html.keys()
]
print(
    "git add " + " ".join(files) +
    ' && git commit -m "Use pure black dark surfaces and half pixel borders" && git push'
)
