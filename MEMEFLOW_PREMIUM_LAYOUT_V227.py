#!/usr/bin/env python3
from pathlib import Path
from datetime import datetime
import subprocess
import sys

EXPECTED_REPO_FRAGMENT = "16usa/memeflow-"
CSS_NAME = "memeflow-trading-premium-layout-v227.css"
MARKER = "MEMEFLOW_TRADING_PREMIUM_LAYOUT_V227_ASSET"

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

html_path = app / "trading.html"
css_path = app / CSS_NAME

if not html_path.is_file():
    fail(f"Missing required file: {html_path}")

premium_css = r'''/* MEMEFLOW TRADING PREMIUM LAYOUT V227
   GEOMETRY ONLY.
   Does not change text colors, text sizes, content, labels or DOM order.

   Goals:
   - one page grid
   - one module radius
   - one horizontal gutter
   - one vertical rhythm
   - table-like rows instead of card-inside-card
   - exact right-edge alignment
   - clean 2-column strategy matrix
   - compact intentional empty states
*/

body.mf-page-trading.mf-trading-terminal{
  --mf-v227-page-x:12px;
  --mf-v227-module-gap:10px;
  --mf-v227-module-radius:14px;
  --mf-v227-inner-x:14px;
  --mf-v227-row-gap:12px;
  --mf-v227-avatar-col:48px;
}

/* ---------- One global page grid ---------- */

body.mf-page-trading.mf-trading-terminal .shell{
  width:100%;
  min-width:0;
}

body.mf-page-trading.mf-trading-terminal .mf-site-header{
  width:min(1760px,100%);
  margin-inline:auto;
  padding-left:var(--mf-v227-page-x) !important;
  padding-right:var(--mf-v227-page-x) !important;
}

body.mf-page-trading.mf-trading-terminal .terminal{
  width:min(1760px,100%);
  margin-inline:auto;
  padding:10px var(--mf-v227-page-x) 28px !important;
  gap:var(--mf-v227-module-gap) !important;
  align-items:start;
}

body.mf-page-trading.mf-trading-terminal .center-stack{
  gap:var(--mf-v227-module-gap) !important;
  min-width:0;
}

/* ---------- One module geometry ---------- */

body.mf-page-trading.mf-trading-terminal .panel{
  width:100%;
  min-width:0;
  border-radius:var(--mf-v227-module-radius) !important;
  overflow:hidden;
  box-shadow:none !important;
}

body.mf-page-trading.mf-trading-terminal :where(
  .chart-panel,
  .candidates-panel,
  .approvals-panel,
  .strategy-summary-panel,
  .positions-panel,
  .bottom-history-panel
){
  margin:0 !important;
}

/* All module headers share the exact same horizontal rails. */
body.mf-page-trading.mf-trading-terminal .panel-head{
  min-height:52px !important;
  padding:10px var(--mf-v227-inner-x) !important;
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:12px;
}

body.mf-page-trading.mf-trading-terminal .panel-head.compact-head{
  min-height:52px !important;
}

body.mf-page-trading.mf-trading-terminal .panel-head > :last-child{
  margin-left:auto;
  flex:0 0 auto;
}

/* ---------- Chart = one continuous module ---------- */

body.mf-page-trading.mf-trading-terminal .chart-head{
  min-height:88px;
  padding:14px var(--mf-v227-inner-x) 12px !important;
  column-gap:14px !important;
}

body.mf-page-trading.mf-trading-terminal .chart-head .token-title{
  gap:12px !important;
}

body.mf-page-trading.mf-trading-terminal .chart-head .price-toggle{
  margin:0 !important;
  padding-left:10px !important;
  padding-right:0 !important;
}

body.mf-page-trading.mf-trading-terminal .timeframes{
  height:42px !important;
  padding:5px var(--mf-v227-inner-x) !important;
  gap:8px !important;
  align-items:center;
}

body.mf-page-trading.mf-trading-terminal .chart-wrap{
  width:100%;
  margin:0 !important;
  border-radius:0 !important;
}

body.mf-page-trading.mf-trading-terminal .selected-metrics{
  width:100%;
  grid-template-columns:repeat(5,minmax(0,1fr)) !important;
}

body.mf-page-trading.mf-trading-terminal .selected-metrics > div{
  min-width:0;
  min-height:48px !important;
  padding:8px 10px !important;
  display:flex;
  flex-direction:column;
  justify-content:center;
}

/* ---------- Candidates = table rows, not cards ---------- */

body.mf-page-trading.mf-trading-terminal .candidates-panel .panel-head{
  padding-inline:var(--mf-v227-inner-x) !important;
}

body.mf-page-trading.mf-trading-terminal .candidate-list{
  width:100%;
  padding:0 !important;
}

body.mf-page-trading.mf-trading-terminal .candidate{
  width:100%;
  min-height:74px !important;
  margin:0 !important;
  padding:11px var(--mf-v227-inner-x) !important;
  display:grid !important;
  grid-template-columns:var(--mf-v227-avatar-col) minmax(0,1fr) !important;
  align-items:center !important;
  gap:var(--mf-v227-row-gap) !important;
  border-radius:0 !important;
  box-shadow:none !important;
}

body.mf-page-trading.mf-trading-terminal .candidate-main{
  min-width:0;
  display:grid !important;
  gap:6px !important;
}

body.mf-page-trading.mf-trading-terminal .candidate-top,
body.mf-page-trading.mf-trading-terminal .candidate-bottom{
  min-width:0;
  display:grid !important;
  grid-template-columns:minmax(0,1fr) max-content !important;
  align-items:center !important;
  column-gap:12px !important;
}

body.mf-page-trading.mf-trading-terminal .candidate-name,
body.mf-page-trading.mf-trading-terminal .candidate-bottom > :first-child{
  min-width:0;
  overflow:hidden;
  text-overflow:ellipsis;
}

body.mf-page-trading.mf-trading-terminal .state-dot,
body.mf-page-trading.mf-trading-terminal .candidate-price{
  justify-self:end;
  text-align:right;
}

/* ---------- Pending / positions empty states ---------- */

body.mf-page-trading.mf-trading-terminal .approvals-panel > .approval-list{
  padding:0 !important;
}

body.mf-page-trading.mf-trading-terminal .approvals-panel .empty,
body.mf-page-trading.mf-trading-terminal .positions-panel .empty{
  min-height:76px !important;
  padding:18px var(--mf-v227-inner-x) !important;
  display:grid !important;
  place-items:center !important;
}

body.mf-page-trading.mf-trading-terminal .positions-list{
  width:100%;
  padding:0 !important;
}

body.mf-page-trading.mf-trading-terminal .positions-panel .position-row{
  min-height:74px !important;
  padding:11px var(--mf-v227-inner-x) !important;
  grid-template-columns:var(--mf-v227-avatar-col) minmax(0,1fr) max-content !important;
  gap:var(--mf-v227-row-gap) !important;
  align-items:center !important;
  border-radius:0 !important;
}

/* ---------- Strategy = exact 2-column matrix ---------- */

body.mf-page-trading.mf-trading-terminal .strategy-summary-panel .panel-head{
  padding-inline:var(--mf-v227-inner-x) !important;
}

body.mf-page-trading.mf-trading-terminal .strategy-head-actions{
  margin-left:auto;
  display:flex;
  align-items:center;
  justify-content:flex-end;
  gap:8px;
}

body.mf-page-trading.mf-trading-terminal .strategy-summary-list{
  width:100%;
  display:grid !important;
}

body.mf-page-trading.mf-trading-terminal .strategy-summary-row{
  width:100%;
  min-height:58px !important;
  display:grid !important;
  grid-template-columns:repeat(2,minmax(0,1fr)) !important;
  align-items:stretch;
}

body.mf-page-trading.mf-trading-terminal .strategy-summary-row > div{
  min-width:0;
  padding:10px var(--mf-v227-inner-x) !important;
  display:flex;
  flex-direction:column;
  justify-content:center;
}

body.mf-page-trading.mf-trading-terminal .strategy-summary-foot{
  min-height:38px !important;
  padding:9px var(--mf-v227-inner-x) !important;
  display:flex;
  align-items:center;
}

/* ---------- Recent trades = same row grid as Candidates ---------- */

body.mf-page-trading.mf-trading-terminal .bottom-history-panel .panel-head{
  padding-inline:var(--mf-v227-inner-x) !important;
}

body.mf-page-trading.mf-trading-terminal .bottom-history-panel .trade-history{
  width:100%;
  padding:0 !important;
}

body.mf-page-trading.mf-trading-terminal .bottom-history-panel .trade-row.trade-log-row{
  width:100%;
  height:auto !important;
  min-height:76px !important;
  max-height:none !important;
  padding:11px var(--mf-v227-inner-x) !important;
  display:grid !important;
  grid-template-columns:var(--mf-v227-avatar-col) minmax(0,1fr) !important;
  align-items:center !important;
  gap:var(--mf-v227-row-gap) !important;
  border-radius:0 !important;
}

body.mf-page-trading.mf-trading-terminal .trade-log-main{
  min-width:0;
  display:grid !important;
  gap:6px !important;
}

body.mf-page-trading.mf-trading-terminal .trade-log-topline{
  min-width:0;
  display:grid !important;
  grid-template-columns:minmax(0,1fr) max-content !important;
  align-items:center !important;
  gap:12px !important;
}

body.mf-page-trading.mf-trading-terminal .trade-log-symbol{
  min-width:0;
}

body.mf-page-trading.mf-trading-terminal .trade-log-reason-badge{
  justify-self:end;
}

body.mf-page-trading.mf-trading-terminal .trade-log-bottomline{
  width:100%;
  min-width:0;
}

body.mf-page-trading.mf-trading-terminal .trade-log-time{
  margin-left:auto !important;
  text-align:right;
}

/* ---------- Desktop rhythm ---------- */

@media (min-width:821px){
  body.mf-page-trading.mf-trading-terminal{
    --mf-v227-page-x:14px;
    --mf-v227-module-gap:12px;
    --mf-v227-inner-x:14px;
  }

  body.mf-page-trading.mf-trading-terminal .terminal{
    gap:12px !important;
  }

  body.mf-page-trading.mf-trading-terminal .center-stack{
    gap:12px !important;
  }
}

/* ---------- Mobile premium geometry ---------- */

@media (max-width:820px){
  body.mf-page-trading.mf-trading-terminal{
    --mf-v227-page-x:12px;
    --mf-v227-module-gap:10px;
    --mf-v227-inner-x:14px;
    --mf-v227-module-radius:14px;
    --mf-v227-avatar-col:48px;
  }

  body.mf-page-trading.mf-trading-terminal .terminal{
    padding:8px var(--mf-v227-page-x) 24px !important;
    gap:var(--mf-v227-module-gap) !important;
  }

  body.mf-page-trading.mf-trading-terminal .panel{
    border-radius:var(--mf-v227-module-radius) !important;
  }

  body.mf-page-trading.mf-trading-terminal .chart-head{
    min-height:86px;
    padding:12px var(--mf-v227-inner-x) 10px !important;
    column-gap:10px !important;
  }

  body.mf-page-trading.mf-trading-terminal .timeframes{
    height:42px !important;
    padding-inline:var(--mf-v227-inner-x) !important;
  }

  body.mf-page-trading.mf-trading-terminal .selected-metrics > div{
    min-height:48px !important;
    padding:8px 6px !important;
  }

  body.mf-page-trading.mf-trading-terminal .panel-head,
  body.mf-page-trading.mf-trading-terminal .panel-head.compact-head{
    min-height:50px !important;
    padding:9px var(--mf-v227-inner-x) !important;
  }

  body.mf-page-trading.mf-trading-terminal .candidate,
  body.mf-page-trading.mf-trading-terminal .positions-panel .position-row,
  body.mf-page-trading.mf-trading-terminal .bottom-history-panel .trade-row.trade-log-row{
    min-height:74px !important;
    padding:11px var(--mf-v227-inner-x) !important;
  }

  body.mf-page-trading.mf-trading-terminal .strategy-summary-row{
    min-height:58px !important;
  }

  body.mf-page-trading.mf-trading-terminal .strategy-summary-row > div{
    padding:10px var(--mf-v227-inner-x) !important;
  }
}

@media (max-width:430px){
  body.mf-page-trading.mf-trading-terminal{
    --mf-v227-page-x:10px;
    --mf-v227-inner-x:12px;
    --mf-v227-module-gap:9px;
    --mf-v227-avatar-col:46px;
  }

  body.mf-page-trading.mf-trading-terminal .terminal{
    padding-inline:var(--mf-v227-page-x) !important;
  }

  body.mf-page-trading.mf-trading-terminal .chart-head{
    padding-inline:var(--mf-v227-inner-x) !important;
  }

  body.mf-page-trading.mf-trading-terminal .candidate-top,
  body.mf-page-trading.mf-trading-terminal .candidate-bottom,
  body.mf-page-trading.mf-trading-terminal .trade-log-topline{
    column-gap:8px !important;
  }
}
'''

html = html_path.read_text(encoding="utf-8")
original_html = html
original_css = css_path.read_text(encoding="utf-8") if css_path.exists() else None
changed = False

if original_css != premium_css:
    css_path.write_text(premium_css, encoding="utf-8")
    changed = True

if MARKER not in html:
    block = (
        f'<!-- {MARKER} -->\n'
        f'<link rel="stylesheet" href="/{CSS_NAME}?v=227-20260928">\n'
        f'<!-- /{MARKER} -->\n'
    )

    idx = html.lower().rfind("</head>")
    if idx < 0:
        fail("</head> not found in trading.html")

    html = html[:idx] + block + html[idx:]
    html_path.write_text(html, encoding="utf-8")
    changed = True

if not changed:
    print("\n[OK] V227 is already installed. No files changed.")
    sys.exit(0)

stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
backup_dir = root / f".memeflow-premium-layout-v227-backup-{stamp}"
backup_dir.mkdir(parents=True, exist_ok=False)

backup_html = backup_dir / html_path.relative_to(root)
backup_html.parent.mkdir(parents=True, exist_ok=True)
backup_html.write_text(original_html, encoding="utf-8")

if original_css is not None:
    backup_css = backup_dir / css_path.relative_to(root)
    backup_css.parent.mkdir(parents=True, exist_ok=True)
    backup_css.write_text(original_css, encoding="utf-8")

try:
    subprocess.run(
        ["git", "diff", "--check", "--", "memeflow-app/trading.html", f"memeflow-app/{CSS_NAME}"],
        cwd=root,
        check=True
    )
except Exception:
    print("[WARN] git diff --check could not run.")

print("\n[OK] MEMEFLOW TRADING PREMIUM LAYOUT V227 installed.")
print(f"[BACKUP] {backup_dir}")
print("\nV227 changes GEOMETRY ONLY:")
print("  • one consistent page gutter")
print("  • one module radius")
print("  • one vertical gap rhythm")
print("  • identical module-header padding")
print("  • Candidates rows aligned as a table")
print("  • Strategy becomes a clean exact 2-column matrix")
print("  • Open positions uses the same row grid")
print("  • Recent trades uses the same row grid as Candidates")
print("  • right-side badges/prices align to one visual rail")
print("  • empty-state blocks become compact and intentional")
print("  • chart header/timeframes/metrics share the same horizontal rails")
print("\nNOT changed:")
print("  • text colors")
print("  • text sizes")
print("  • wording / information")
print("  • block order")
print("  • trading logic")
print("  • dark/light theme logic")
print("\nNo process/server restart was performed.")
print("\nPush after visual check:")
print(
    f'git add memeflow-app/trading.html memeflow-app/{CSS_NAME} && '
    'git commit -m "Unify trading terminal premium layout geometry" && git push'
)
