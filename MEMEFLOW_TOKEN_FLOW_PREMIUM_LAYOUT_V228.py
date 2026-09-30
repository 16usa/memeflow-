#!/usr/bin/env python3
from pathlib import Path
from datetime import datetime
import subprocess
import sys

EXPECTED_REPO_FRAGMENT = "16usa/memeflow-"
CSS_NAME = "memeflow-token-flow-premium-layout-v228.css"
MARKER = "MEMEFLOW_TOKEN_FLOW_PREMIUM_LAYOUT_V228_ASSET"

def fail(msg):
    print(f"\n[FAIL] {msg}")
    sys.exit(1)

root = Path.cwd()
app = root / "memeflow-app"
if not app.is_dir() and root.name == "memeflow-app":
    app = root

if not app.is_dir():
    fail("memeflow-app not found. Run from the existing Replit workspace Shell.")

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

html_path = app / "system-tokens.html"
css_path = app / CSS_NAME

if not html_path.is_file():
    fail(f"Missing required file: {html_path}")

premium_css = r'''/* MEMEFLOW TOKEN FLOW PREMIUM LAYOUT V228
   GEOMETRY ONLY.

   Intentionally NOT changed:
   - text colors
   - text sizes
   - wording / information
   - state colors
   - token order
   - filters / ranking / scanner logic
   - dark/light theme logic

   The goal is one precise layout system:
   page gutter -> module -> inner rail -> row grid -> separator.
*/

body.mf-page-system-tokens{
  --mf-v228-page-x:12px;
  --mf-v228-gap:10px;
  --mf-v228-radius:14px;
  --mf-v228-inner-x:14px;
  --mf-v228-row-x:12px;
}

/* ONE PAGE GRID */
body.mf-page-system-tokens .flow-page{
  width:min(1180px,100%) !important;
  margin-inline:auto !important;
  padding:
    max(10px,env(safe-area-inset-top))
    var(--mf-v228-page-x)
    max(24px,env(safe-area-inset-bottom)) !important;

  display:grid !important;
  grid-template-columns:minmax(0,1fr) !important;
  align-content:start !important;
  row-gap:var(--mf-v228-gap) !important;
}

body.mf-page-system-tokens .flow-page > :where(
  .flow-header,
  .flow-hero,
  .state-summary,
  .mf-time-window-v47c,
  .flow-toolbar,
  .mf-token-scan-result,
  .token-list,
  .empty-state,
  .pagination
){
  width:100% !important;
  min-width:0 !important;
  margin-top:0 !important;
  margin-bottom:0 !important;
}

/* HEADER / HERO */
body.mf-page-system-tokens .flow-header{
  width:100% !important;
  min-height:68px !important;
  padding:10px var(--mf-v228-inner-x) !important;
  border-radius:var(--mf-v228-radius) !important;
  align-items:center !important;
}

body.mf-page-system-tokens .flow-header .header-left{
  min-width:0 !important;
  gap:11px !important;
}

body.mf-page-system-tokens .flow-header .header-title{
  min-width:0 !important;
}

body.mf-page-system-tokens .flow-header .live-status{
  margin-left:auto !important;
  flex:0 0 auto !important;
}

body.mf-page-system-tokens .flow-hero{
  width:100% !important;
  min-height:86px !important;
  padding:14px var(--mf-v228-inner-x) !important;
  gap:16px !important;
  border-radius:var(--mf-v228-radius) !important;
  align-items:center !important;
}

body.mf-page-system-tokens .flow-hero > :first-child{
  min-width:0 !important;
}

body.mf-page-system-tokens .hero-counter{
  min-width:94px !important;
  margin-left:auto !important;
  flex:0 0 auto !important;
  align-self:center !important;
}

/* STATUS COUNTERS */
body.mf-page-system-tokens .state-summary{
  display:grid !important;
  grid-template-columns:repeat(5,minmax(0,1fr)) !important;
  gap:6px !important;
  overflow:visible !important;
}

body.mf-page-system-tokens .summary-card{
  width:100% !important;
  min-width:0 !important;
  min-height:58px !important;
  height:auto !important;
  padding:10px 11px !important;
  border-radius:12px !important;

  display:flex !important;
  flex-direction:column !important;
  justify-content:center !important;
  align-items:flex-start !important;
}

/* AGE WINDOW / SMART RANK */
body.mf-page-system-tokens .mf-time-window-v47c{
  width:100% !important;
  min-height:42px !important;
  margin:0 !important;
  padding:4px !important;
  gap:4px !important;
  border-radius:12px !important;

  display:grid !important;
  grid-template-columns:
    repeat(4,minmax(44px,max-content))
    minmax(0,1fr) !important;
  align-items:center !important;
}

body.mf-page-system-tokens .mf-time-window-v47c button{
  min-width:44px !important;
  height:34px !important;
  padding-inline:10px !important;
  border-radius:9px !important;
}

body.mf-page-system-tokens .mf-time-window-v47c > span{
  min-width:0 !important;
  margin-left:0 !important;
  padding-inline:10px !important;
  justify-self:end !important;
  text-align:right !important;
  white-space:nowrap !important;
}

/* SEARCH / ANALYZE */
body.mf-page-system-tokens .flow-toolbar{
  position:sticky !important;
  top:0 !important;
  z-index:70 !important;

  width:100% !important;
  min-height:48px !important;
  height:auto !important;

  padding:5px !important;
  gap:6px !important;
  border-radius:12px !important;

  display:grid !important;
  grid-template-columns:minmax(0,1fr) auto !important;
  align-items:center !important;
}

body.mf-page-system-tokens .flow-toolbar .search-wrap{
  width:100% !important;
  min-width:0 !important;
  height:38px !important;
  min-height:38px !important;
  max-height:38px !important;
  margin:0 !important;
  padding-inline:12px !important;
  border-radius:10px !important;
}

body.mf-page-system-tokens .flow-toolbar .search-wrap input{
  width:100% !important;
  min-width:0 !important;
  height:36px !important;
  min-height:0 !important;
  margin:0 !important;
  padding-block:0 !important;
}

body.mf-page-system-tokens .flow-toolbar .refresh-info{
  min-width:0 !important;
  width:auto !important;
  margin:0 !important;
  padding:0 !important;
  display:flex !important;
  align-items:center !important;
  justify-content:flex-end !important;
  gap:6px !important;
}

body.mf-page-system-tokens .flow-toolbar #refreshButton{
  min-width:96px !important;
  height:38px !important;
  min-height:38px !important;
  max-height:38px !important;
  margin:0 !important;
  padding-inline:14px !important;
  border-radius:10px !important;
}

/* Sort control, when present, follows the same exact rail. */
body.mf-page-system-tokens .mf-sort-toolbar-v25{
  width:100% !important;
  margin:0 !important;
}

body.mf-page-system-tokens .mf-sort-trigger-v25{
  width:100% !important;
  min-height:38px !important;
  height:38px !important;
  border-radius:10px !important;
}

/* CONTINUOUS TOKEN TABLE */
body.mf-page-system-tokens .token-list{
  width:100% !important;
  min-width:0 !important;
  margin:0 !important;
  gap:0 !important;

  overflow:hidden !important;
  border-radius:var(--mf-v228-radius) !important;
}

body.mf-page-system-tokens .token-list > .flow-token{
  width:100% !important;
  min-width:0 !important;
  margin:0 !important;
  border-radius:0 !important;
  box-shadow:none !important;

  align-items:center !important;
  box-sizing:border-box !important;
}

body.mf-page-system-tokens .token-list > .flow-token:first-child{
  border-top-left-radius:var(--mf-v228-radius) !important;
  border-top-right-radius:var(--mf-v228-radius) !important;
}

body.mf-page-system-tokens .token-list > .flow-token:last-child{
  border-bottom-left-radius:var(--mf-v228-radius) !important;
  border-bottom-right-radius:var(--mf-v228-radius) !important;
}

body.mf-page-system-tokens .token-list > .flow-token > .token-primary,
body.mf-page-system-tokens .token-list > .flow-token > .mf-open-market-strip,
body.mf-page-system-tokens .token-list > .flow-token > .mf-regular-market-strip,
body.mf-page-system-tokens .token-list > .flow-token > .mf-score-slot,
body.mf-page-system-tokens .token-list > .flow-token > .mf-open-pnl-slot{
  min-width:0 !important;
  align-self:center !important;
}

body.mf-page-system-tokens .token-list > .flow-token .token-head{
  min-width:0 !important;
  width:100% !important;
  align-items:center !important;
}

body.mf-page-system-tokens .token-list > .flow-token .token-meta{
  min-width:0 !important;
  width:100% !important;
}

body.mf-page-system-tokens .token-list > .flow-token .token-top{
  min-width:0 !important;
  width:100% !important;
}

body.mf-page-system-tokens .token-list > .flow-token .token-name{
  min-width:0 !important;
  overflow:hidden !important;
  text-overflow:ellipsis !important;
  white-space:nowrap !important;
}

body.mf-page-system-tokens
.token-list > .flow-token
> :is(.mf-open-market-strip,.mf-regular-market-strip)
> :is(.mf-open-market-stat,.mf-regular-market-stat),
body.mf-page-system-tokens
.token-list > .flow-token
> :is(.mf-score-slot,.mf-open-pnl-slot){
  min-width:0 !important;
  justify-content:center !important;
}

body.mf-page-system-tokens .token-list > .flow-token .token-details{
  width:100% !important;
  margin-top:8px !important;
  padding-top:10px !important;
  gap:8px !important;
}

body.mf-page-system-tokens .token-list > .flow-token .detail-block{
  min-width:0 !important;
  padding:10px var(--mf-v228-row-x) !important;
  border-radius:10px !important;
}

body.mf-page-system-tokens .empty-state{
  width:100% !important;
  min-height:110px !important;
  margin:0 !important;
  padding:24px var(--mf-v228-inner-x) !important;
  border-radius:var(--mf-v228-radius) !important;

  display:grid !important;
  place-content:center !important;
  text-align:center !important;
}

/* DESKTOP / TABLET */
@media (min-width:761px){
  body.mf-page-system-tokens{
    --mf-v228-page-x:14px;
    --mf-v228-gap:12px;
    --mf-v228-inner-x:16px;
    --mf-v228-row-x:14px;
  }

  body.mf-page-system-tokens .flow-page{
    padding-inline:var(--mf-v228-page-x) !important;
  }

  body.mf-page-system-tokens .flow-token{
    min-height:82px !important;
    padding:12px var(--mf-v228-row-x) !important;
    column-gap:12px !important;
  }
}

/* MOBILE */
@media (max-width:760px){
  body.mf-page-system-tokens{
    --mf-v228-page-x:10px;
    --mf-v228-gap:9px;
    --mf-v228-radius:14px;
    --mf-v228-inner-x:12px;
    --mf-v228-row-x:10px;
  }

  body.mf-page-system-tokens .flow-page{
    padding:
      max(7px,env(safe-area-inset-top))
      var(--mf-v228-page-x)
      max(18px,env(safe-area-inset-bottom)) !important;
    row-gap:var(--mf-v228-gap) !important;
  }

  body.mf-page-system-tokens .flow-header{
    min-height:58px !important;
    padding:8px var(--mf-v228-inner-x) !important;
  }

  body.mf-page-system-tokens .flow-hero{
    min-height:78px !important;
    padding:12px var(--mf-v228-inner-x) !important;
    border-radius:var(--mf-v228-radius) !important;
  }

  body.mf-page-system-tokens .state-summary{
    grid-template-columns:repeat(5,minmax(0,1fr)) !important;
    gap:5px !important;
  }

  body.mf-page-system-tokens .summary-card{
    min-width:0 !important;
    min-height:52px !important;
    height:auto !important;
    padding:8px 9px !important;
    border-radius:11px !important;
  }

  body.mf-page-system-tokens .mf-time-window-v47c{
    min-height:40px !important;
    padding:3px !important;
    gap:3px !important;
    border-radius:11px !important;
    grid-template-columns:
      repeat(4,minmax(38px,max-content))
      minmax(0,1fr) !important;
  }

  body.mf-page-system-tokens .mf-time-window-v47c button{
    min-width:38px !important;
    height:32px !important;
    padding-inline:8px !important;
    border-radius:8px !important;
  }

  body.mf-page-system-tokens .mf-time-window-v47c > span{
    padding-inline:7px !important;
  }

  body.mf-page-system-tokens .flow-toolbar{
    min-height:44px !important;
    padding:4px !important;
    gap:5px !important;
    border-radius:11px !important;
  }

  body.mf-page-system-tokens .flow-toolbar .search-wrap{
    height:36px !important;
    min-height:36px !important;
    max-height:36px !important;
    border-radius:9px !important;
  }

  body.mf-page-system-tokens .flow-toolbar .search-wrap input{
    height:34px !important;
  }

  body.mf-page-system-tokens .flow-toolbar #refreshButton{
    min-width:88px !important;
    height:36px !important;
    min-height:36px !important;
    max-height:36px !important;
    padding-inline:12px !important;
    border-radius:9px !important;
  }

  body.mf-page-system-tokens .token-list{
    border-radius:var(--mf-v228-radius) !important;
  }

  body.mf-page-system-tokens .token-list > .flow-token{
    min-height:68px !important;
    padding:9px var(--mf-v228-row-x) !important;

    grid-template-columns:
      minmax(0,2.42fr)
      minmax(42px,.66fr)
      minmax(48px,.75fr)
      minmax(54px,.84fr) !important;

    column-gap:7px !important;
  }

  body.mf-page-system-tokens .token-list > .flow-token::before{
    top:8px !important;
    bottom:8px !important;
  }

  body.mf-page-system-tokens .token-list > .flow-token .token-head{
    grid-template-columns:40px minmax(0,1fr) !important;
    gap:8px !important;
    min-height:40px !important;
  }

  body.mf-page-system-tokens .token-list > .flow-token .token-avatar,
  body.mf-page-system-tokens .token-list > .flow-token .mf-token-avatar-anchor-v51,
  body.mf-page-system-tokens .token-list > .flow-token .mf-token-avatar-anchor-v51 > .token-avatar{
    width:40px !important;
    height:40px !important;
    min-width:40px !important;
    min-height:40px !important;
    max-width:40px !important;
    max-height:40px !important;
  }
}

@media (max-width:390px){
  body.mf-page-system-tokens{
    --mf-v228-page-x:8px;
    --mf-v228-inner-x:10px;
    --mf-v228-row-x:8px;
    --mf-v228-gap:8px;
  }

  body.mf-page-system-tokens .summary-card{
    min-height:48px !important;
    padding:7px !important;
  }

  body.mf-page-system-tokens .mf-time-window-v47c{
    grid-template-columns:
      repeat(4,minmax(34px,max-content))
      minmax(0,1fr) !important;
  }

  body.mf-page-system-tokens .mf-time-window-v47c button{
    min-width:34px !important;
    padding-inline:6px !important;
  }

  body.mf-page-system-tokens .token-list > .flow-token{
    min-height:64px !important;
    padding-inline:var(--mf-v228-row-x) !important;

    grid-template-columns:
      minmax(0,2.50fr)
      minmax(39px,.63fr)
      minmax(45px,.71fr)
      minmax(50px,.78fr) !important;

    column-gap:5px !important;
  }

  body.mf-page-system-tokens .token-list > .flow-token .token-head{
    grid-template-columns:38px minmax(0,1fr) !important;
    gap:6px !important;
    min-height:38px !important;
  }

  body.mf-page-system-tokens .token-list > .flow-token .token-avatar,
  body.mf-page-system-tokens .token-list > .flow-token .mf-token-avatar-anchor-v51,
  body.mf-page-system-tokens .token-list > .flow-token .mf-token-avatar-anchor-v51 > .token-avatar{
    width:38px !important;
    height:38px !important;
    min-width:38px !important;
    min-height:38px !important;
    max-width:38px !important;
    max-height:38px !important;
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
        f'<link rel="stylesheet" href="/{CSS_NAME}?v=228-20260928">\n'
        f'<!-- /{MARKER} -->\n'
    )

    idx = html.lower().rfind("</head>")
    if idx < 0:
        fail("</head> not found in system-tokens.html")

    html = html[:idx] + block + html[idx:]
    html_path.write_text(html, encoding="utf-8")
    changed = True

if not changed:
    print("\n[OK] V228 is already installed. No files changed.")
    sys.exit(0)

stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
backup_dir = root / f".memeflow-token-flow-premium-v228-backup-{stamp}"
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
        [
            "git", "diff", "--check", "--",
            "memeflow-app/system-tokens.html",
            f"memeflow-app/{CSS_NAME}"
        ],
        cwd=root,
        check=True
    )
except Exception:
    print("[WARN] git diff --check could not run.")

print("\n[OK] MEMEFLOW TOKEN FLOW PREMIUM LAYOUT V228 installed.")
print(f"[BACKUP] {backup_dir}")
print("\nV228 changes GEOMETRY ONLY:")
print("  • one page gutter and one vertical rhythm")
print("  • hero / filters / toolbar / list share exact left-right rails")
print("  • five status counters use one equal grid")
print("  • ALL / 1H / 6H / 24H / SMART RANK becomes one precise control rail")
print("  • search + Analyze align as one toolbar")
print("  • token rows become one continuous professional table module")
print("  • identity / VOL-TX / MC-5M / SCORE columns use stable rails")
print("  • expanded details use the same inner padding system")
print("  • one module radius and consistent mobile spacing")
print("\nNOT changed:")
print("  • text colors")
print("  • text sizes")
print("  • token information")
print("  • token order")
print("  • filter/ranking/scanner logic")
print("  • semantic state colors")
print("  • dark/light theme logic")
print("\nNo process/server restart was performed.")
print("\nPush after visual check:")
print(
    f'git add memeflow-app/system-tokens.html memeflow-app/{CSS_NAME} && '
    'git commit -m "Unify Token Flow premium layout geometry" && git push'
)
