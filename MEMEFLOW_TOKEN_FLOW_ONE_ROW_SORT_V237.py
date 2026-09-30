#!/usr/bin/env python3
from pathlib import Path
from datetime import datetime
import subprocess
import sys

EXPECTED_REPO_FRAGMENT = "16usa/memeflow-"
CSS_NAME = "memeflow-token-flow-one-row-sort-v237.css"
HTML_MARKER = "MEMEFLOW_TOKEN_FLOW_ONE_ROW_SORT_V237_ASSET"
JS_MARKER = "MEMEFLOW_TOKEN_FLOW_ONE_ROW_SORT_V237"

CSS = r'''/* MEMEFLOW TOKEN FLOW ONE ROW SORT V237 */
body.mf-page-system-tokens{
  --mf-v237-line:#252525;
  --mf-v237-x:10px;
  --mf-v237-gap:4px;
}

body.mf-page-system-tokens #mfMarketGridV235{
  width:100% !important;
  min-width:0 !important;
  margin:0 !important;
  padding:0 !important;
  overflow:hidden !important;
  border:0.5px solid var(--mf-v237-line) !important;
  border-radius:14px !important;
  background:#000 !important;
  box-shadow:none !important;
  pointer-events:auto !important;
  touch-action:manipulation !important;
  position:relative !important;
  z-index:20 !important;
}

body.mf-page-system-tokens #mfMarketGridV235 .mf-market-window-v235{
  min-height:40px !important;
  padding:0 12px !important;
  display:flex !important;
  align-items:center !important;
  gap:20px !important;
  border-bottom:0.5px solid var(--mf-v237-line) !important;
  background:#000 !important;
  pointer-events:auto !important;
}

body.mf-page-system-tokens #mfMarketGridV235 .mf-market-window-v235 button{
  position:relative !important;
  min-height:40px !important;
  margin:0 !important;
  padding:0 !important;
  border:0 !important;
  background:transparent !important;
  box-shadow:none !important;
  opacity:.44 !important;
  cursor:pointer !important;
  pointer-events:auto !important;
  touch-action:manipulation !important;
  -webkit-tap-highlight-color:transparent !important;
}

body.mf-page-system-tokens #mfMarketGridV235 .mf-market-window-v235 button::after{
  content:"" !important;
  position:absolute !important;
  left:0 !important;
  right:0 !important;
  bottom:0 !important;
  height:1px !important;
  background:currentColor !important;
  transform:scaleX(0) !important;
  transform-origin:center !important;
}

body.mf-page-system-tokens #mfMarketGridV235 .mf-market-window-v235 button.is-active{
  opacity:1 !important;
}

body.mf-page-system-tokens #mfMarketGridV235 .mf-market-window-v235 button.is-active::after{
  transform:scaleX(1) !important;
}

/* ONE row header: TOKEN | VOL | TX | MC | Δ% | SCORE */
body.mf-page-system-tokens #mfMarketGridV235 .mf-market-columns-v235{
  width:100% !important;
  min-width:0 !important;
  height:42px !important;
  min-height:42px !important;
  padding:0 var(--mf-v237-x) !important;
  display:grid !important;
  grid-template-columns:minmax(0,2.45fr) minmax(0,.68fr) minmax(0,.54fr) minmax(0,.82fr) minmax(0,.66fr) minmax(0,.52fr) !important;
  grid-template-rows:42px !important;
  column-gap:var(--mf-v237-gap) !important;
  row-gap:0 !important;
  align-items:center !important;
  background:#000 !important;
}

body.mf-page-system-tokens #mfMarketGridV235 .mf-market-token-head-v235{
  grid-column:1 !important;
  grid-row:1 !important;
  min-width:0 !important;
  padding-left:48px !important;
  opacity:.48 !important;
}

body.mf-page-system-tokens #mfMarketGridV235 .mf-market-head-v235{
  grid-row:1 !important;
  width:100% !important;
  height:42px !important;
  min-width:0 !important;
  margin:0 !important;
  padding:0 !important;
  display:flex !important;
  align-items:center !important;
  justify-content:flex-start !important;
  gap:2px !important;
  border:0 !important;
  background:transparent !important;
  box-shadow:none !important;
  opacity:.48 !important;
  cursor:pointer !important;
  pointer-events:auto !important;
  touch-action:manipulation !important;
  -webkit-tap-highlight-color:transparent !important;
}
body.mf-page-system-tokens #mfMarketGridV235 .mf-market-head-v235[data-mf-market-sort="volume"]{grid-column:2 !important;}
body.mf-page-system-tokens #mfMarketGridV235 .mf-market-head-v235[data-mf-market-sort="transactions"]{grid-column:3 !important;}
body.mf-page-system-tokens #mfMarketGridV235 .mf-market-head-v235[data-mf-market-sort="mc"]{grid-column:4 !important;}
body.mf-page-system-tokens #mfMarketGridV235 .mf-market-head-v235[data-mf-market-sort="change"]{grid-column:5 !important;}
body.mf-page-system-tokens #mfMarketGridV235 .mf-market-head-v235[data-mf-market-sort="score"]{grid-column:6 !important;}
body.mf-page-system-tokens #mfMarketGridV235 .mf-market-head-v235.is-active{opacity:1 !important;}
body.mf-page-system-tokens #mfMarketGridV235 .mf-market-sort-arrow-v235{display:inline-block !important;min-width:7px !important;opacity:0 !important;}
body.mf-page-system-tokens #mfMarketGridV235 .mf-market-head-v235.is-active .mf-market-sort-arrow-v235{opacity:.9 !important;}

/* Cards use the exact SAME six-column grid, one metric row. */
body.mf-page-system-tokens .token-list > .flow-token{
  min-height:80px !important;
  padding:10px var(--mf-v237-x) !important;
  display:grid !important;
  grid-template-columns:minmax(0,2.45fr) minmax(0,.68fr) minmax(0,.54fr) minmax(0,.82fr) minmax(0,.66fr) minmax(0,.52fr) !important;
  grid-template-rows:minmax(0,1fr) !important;
  column-gap:var(--mf-v237-gap) !important;
  row-gap:0 !important;
  align-items:center !important;
  align-content:center !important;
}
body.mf-page-system-tokens .token-list > .flow-token > .token-primary{grid-column:1 !important;grid-row:1 !important;min-width:0 !important;width:100% !important;}
body.mf-page-system-tokens .token-list > .flow-token > :is(.mf-open-market-strip,.mf-regular-market-strip){display:contents !important;}
body.mf-page-system-tokens .token-list > .flow-token > .mf-open-market-strip > .mf-open-market-stat:nth-child(-n+2),
body.mf-page-system-tokens .token-list > .flow-token > .mf-regular-market-strip > .mf-regular-market-stat:nth-child(-n+2){display:none !important;}
body.mf-page-system-tokens .token-list > .flow-token > .mf-open-market-strip > .mf-open-market-stat:nth-child(3),
body.mf-page-system-tokens .token-list > .flow-token > .mf-regular-market-strip > .mf-regular-market-stat:nth-child(3){grid-column:2 !important;grid-row:1 !important;}
body.mf-page-system-tokens .token-list > .flow-token > .mf-open-market-strip > .mf-open-market-stat:nth-child(4),
body.mf-page-system-tokens .token-list > .flow-token > .mf-regular-market-strip > .mf-regular-market-stat:nth-child(4){grid-column:3 !important;grid-row:1 !important;}
body.mf-page-system-tokens .token-list > .flow-token > .mf-open-market-strip > .mf-open-market-stat:nth-child(5),
body.mf-page-system-tokens .token-list > .flow-token > .mf-regular-market-strip > .mf-regular-market-stat:nth-child(5){grid-column:4 !important;grid-row:1 !important;}
body.mf-page-system-tokens .token-list > .flow-token > .mf-open-market-strip > .mf-open-market-stat:nth-child(6),
body.mf-page-system-tokens .token-list > .flow-token > .mf-regular-market-strip > .mf-regular-market-stat:nth-child(6){grid-column:5 !important;grid-row:1 !important;}
body.mf-page-system-tokens .token-list > .flow-token > :is(.mf-score-slot,.mf-open-pnl-slot){grid-column:6 !important;grid-row:1 !important;min-width:0 !important;width:100% !important;height:auto !important;}
body.mf-page-system-tokens .token-list > .flow-token > :is(.mf-open-market-strip,.mf-regular-market-strip) > :is(.mf-open-market-stat,.mf-regular-market-stat),
body.mf-page-system-tokens .token-list > .flow-token > :is(.mf-score-slot,.mf-open-pnl-slot){min-width:0 !important;margin:0 !important;padding:0 !important;display:flex !important;align-items:flex-start !important;justify-content:center !important;}
body.mf-page-system-tokens .token-list > .flow-token .token-details{grid-column:1 / -1 !important;grid-row:2 !important;}

@media(min-width:761px){
  body.mf-page-system-tokens{--mf-v237-x:14px;--mf-v237-gap:9px;}
  body.mf-page-system-tokens #mfMarketGridV235 .mf-market-token-head-v235{padding-left:58px !important;}
}
@media(max-width:390px){
  body.mf-page-system-tokens{--mf-v237-x:8px;--mf-v237-gap:3px;}
  body.mf-page-system-tokens #mfMarketGridV235 .mf-market-window-v235{gap:16px !important;padding-inline:10px !important;}
  body.mf-page-system-tokens #mfMarketGridV235 .mf-market-token-head-v235{padding-left:44px !important;}
}
'''

JS = r'''
// MEMEFLOW_TOKEN_FLOW_ONE_ROW_SORT_V237
function __mfBindMarketGridV237(){
  const root=document.getElementById('mfMarketGridV235');
  if(!root)return;
  if(root.dataset.mfV237Bound==='1'){
    __mfSyncMarketGridV235();
    return;
  }
  root.dataset.mfV237Bound='1';

  root.style.pointerEvents='auto';
  root.querySelectorAll('button').forEach(button=>{
    button.disabled=false;
    button.style.pointerEvents='auto';
    button.style.touchAction='manipulation';
  });

  root.addEventListener('click',(event)=>{
    const timeframeButton=event.target.closest?.('[data-mf-market-timeframe]');
    if(timeframeButton&&root.contains(timeframeButton)){
      event.preventDefault();
      event.stopPropagation();
      const next=String(timeframeButton.dataset.mfMarketTimeframe||'').toLowerCase();
      if(!__MF_MARKET_TIMEFRAMES_V235.has(next))return;

      __mfMarketTimeframeV235=next;
      __mfSaveMarketUiV235();
      state.page=1;
      __mfSyncMarketGridV235();

      if(typeof __mfLoadStructureV18==='function')void __mfLoadStructureV18();
      if(typeof __mfKickCardClockV19==='function')__mfKickCardClockV19();
      return;
    }

    const sortButton=event.target.closest?.('[data-mf-market-sort]');
    if(!sortButton||!root.contains(sortButton))return;

    event.preventDefault();
    event.stopPropagation();

    const key=String(sortButton.dataset.mfMarketSort||'');
    if(!['volume','transactions','mc','change','score'].includes(key))return;

    if(__mfMarketSortV235.key===key){
      __mfMarketSortV235={
        key,
        direction:__mfMarketSortV235.direction==='desc'?'asc':'desc'
      };
    }else{
      __mfMarketSortV235={key,direction:'desc'};
    }

    __mfSaveMarketUiV235();
    state.page=1;
    __mfSyncMarketGridV235();

    if(typeof __mfReconcileVisibleCardsV183==='function'){
      __mfReconcileVisibleCardsV183();
    }
  });

  __mfSyncMarketGridV235();
}

if(document.readyState==='loading'){
  document.addEventListener('DOMContentLoaded',__mfBindMarketGridV237,{once:true});
}else{
  __mfBindMarketGridV237();
}
'''


def fail(msg):
    print(f"\n[FAIL] {msg}")
    sys.exit(1)


def main():
    root=Path.cwd()
    app=root/"memeflow-app"
    if not app.is_dir() and root.name=="memeflow-app":
        app=root
    if not app.is_dir():
        fail("memeflow-app not found. Run from the existing Replit workspace Shell.")

    try:
        origin=subprocess.check_output(
            ["git","config","--get","remote.origin.url"],
            cwd=root,
            text=True,
            stderr=subprocess.DEVNULL
        ).strip()
    except Exception:
        origin=""

    if origin and EXPECTED_REPO_FRAGMENT not in origin:
        fail(f"Unexpected git origin: {origin}")

    html_path=app/"system-tokens.html"
    js_path=app/"system-tokens.js"
    css_path=app/CSS_NAME

    for path in (html_path,js_path):
        if not path.is_file():
            fail(f"Missing required file: {path}")

    html=html_path.read_text(encoding="utf-8")
    js=js_path.read_text(encoding="utf-8")
    original_html=html
    original_js=js
    original_css=css_path.read_text(encoding="utf-8") if css_path.exists() else None

    required=[
        "MEMEFLOW_TOKEN_FLOW_MARKET_GRID_V235",
        "__mfMarketTimeframeV235",
        "__mfMarketSortV235",
        'id="mfMarketGridV235"'
    ]
    combined=js+"\n"+html
    missing=[item for item in required if item not in combined]
    if missing:
        fail("Required V235/V236 installation is missing: "+", ".join(missing))

    changed=False

    if JS_MARKER not in js:
        anchor="// MEMEFLOW_TOKEN_SCAN_V27"
        if anchor not in js:
            fail("V237 JavaScript insertion anchor not found")
        js=js.replace(anchor,JS+"\n\n"+anchor,1)
        changed=True

    if original_css!=CSS:
        css_path.write_text(CSS,encoding="utf-8")
        changed=True

    if HTML_MARKER not in html:
        block=(
            f'<!-- {HTML_MARKER} -->\n'
            f'<link rel="stylesheet" href="/{CSS_NAME}?v=237-20260928">\n'
            f'<!-- /{HTML_MARKER} -->\n'
        )
        idx=html.lower().rfind("</head>")
        if idx<0:
            fail("</head> not found in system-tokens.html")
        html=html[:idx]+block+html[idx:]
        changed=True

    if not changed:
        print("\n[OK] V237 is already installed. No files changed.")
        return

    stamp=datetime.now().strftime("%Y%m%d-%H%M%S")
    backup_dir=root/f".memeflow-token-flow-one-row-sort-v237-backup-{stamp}"
    backup_dir.mkdir(parents=True,exist_ok=False)

    for path,content in ((html_path,original_html),(js_path,original_js)):
        target=backup_dir/path.relative_to(root)
        target.parent.mkdir(parents=True,exist_ok=True)
        target.write_text(content,encoding="utf-8")

    if original_css is not None:
        target=backup_dir/css_path.relative_to(root)
        target.parent.mkdir(parents=True,exist_ok=True)
        target.write_text(original_css,encoding="utf-8")

    html_path.write_text(html,encoding="utf-8")
    js_path.write_text(js,encoding="utf-8")

    try:
        subprocess.run(["node","--check",str(js_path)],cwd=root,check=True)
    except FileNotFoundError:
        print("[WARN] node unavailable; JS syntax check skipped.")
    except subprocess.CalledProcessError:
        fail("system-tokens.js syntax check failed. Backup: "+str(backup_dir))

    try:
        subprocess.run(
            [
                "git","diff","--check","--",
                "memeflow-app/system-tokens.html",
                "memeflow-app/system-tokens.js",
                f"memeflow-app/{CSS_NAME}"
            ],
            cwd=root,
            check=True
        )
    except Exception:
        print("[WARN] git diff --check could not run.")

    print("\n[OK] MEMEFLOW TOKEN FLOW ONE ROW SORT V237 installed.")
    print(f"[BACKUP] {backup_dir}")
    print("\nV237:")
    print("  • fixes timeframe taps on iPhone/Safari")
    print("  • fixes VOL / TX / MC / Δ% / SCORE sorting")
    print("  • active timeframe is visibly underlined")
    print("  • active sort shows ↑ / ↓")
    print("  • shared header is one row")
    print("  • each token card is one row: TOKEN | VOL | TX | MC | Δ% | SCORE")
    print("  • status hierarchy and OPEN POSITION ordering remain unchanged")
    print("  • trading / entry / score logic remains unchanged")
    print("\nNo process/server restart was performed.")
    print("\nPush after visual check:")
    print(
        f'git add memeflow-app/system-tokens.html memeflow-app/system-tokens.js memeflow-app/{CSS_NAME} && '
        'git commit -m "Fix Token Flow sorting and one-row market grid" && git push'
    )


if __name__=="__main__":
    main()
