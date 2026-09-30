#!/usr/bin/env python3
from pathlib import Path
from datetime import datetime
import subprocess
import sys

EXPECTED_REPO_FRAGMENT = "16usa/memeflow-"
CSS_NAME = "memeflow-token-flow-sort-ui-fix-v236.css"
HTML_MARKER = "MEMEFLOW_TOKEN_FLOW_SORT_UI_FIX_V236_ASSET"
JS_MARKER = "MEMEFLOW_TOKEN_FLOW_SORT_UI_FIX_V236"

MARKUP = r'''
    <!-- MEMEFLOW_TOKEN_FLOW_SORT_UI_V236 -->
    <section
      id="mfMarketGridV235"
      class="mf-market-grid-v235"
      aria-label="Token market controls"
    >
      <div class="mf-market-window-v235" aria-label="Market timeframe">
        <button type="button" data-mf-market-timeframe="1m">1M</button>
        <button type="button" data-mf-market-timeframe="5m">5M</button>
        <button type="button" data-mf-market-timeframe="15m">15M</button>
        <button type="button" data-mf-market-timeframe="1h">1H</button>
        <button type="button" data-mf-market-timeframe="6h">6H</button>
      </div>

      <div class="mf-market-columns-v235">
        <span class="mf-market-token-head-v235">TOKEN</span>
        <button type="button" class="mf-market-head-v235" data-mf-market-sort="volume"><span>VOL</span><span class="mf-market-sort-arrow-v235"></span></button>
        <button type="button" class="mf-market-head-v235" data-mf-market-sort="transactions"><span>TX</span><span class="mf-market-sort-arrow-v235"></span></button>
        <button type="button" class="mf-market-head-v235" data-mf-market-sort="mc"><span>MC</span><span class="mf-market-sort-arrow-v235"></span></button>
        <button type="button" class="mf-market-head-v235" data-mf-market-sort="change"><span>Δ%</span><span class="mf-market-sort-arrow-v235"></span></button>
        <button type="button" class="mf-market-head-v235" data-mf-market-sort="score"><span>SCORE</span><span class="mf-market-sort-arrow-v235"></span></button>
      </div>
    </section>
'''

CSS = r'''/* MEMEFLOW TOKEN FLOW SORT UI FIX V236 */
body.mf-page-system-tokens #mfMarketGridV235{
  display:block !important;
  visibility:visible !important;
  opacity:1 !important;
  width:100% !important;
  min-width:0 !important;
  height:auto !important;
  margin:0 !important;
  padding:0 !important;
  position:relative !important;
  z-index:2 !important;
  overflow:hidden !important;
  border:0.5px solid #252525 !important;
  border-radius:14px !important;
  background:#000 !important;
  box-shadow:none !important;
}

body.mf-page-system-tokens #mfMarketGridV235 .mf-market-window-v235{
  display:flex !important;
  visibility:visible !important;
  min-height:42px !important;
  padding:0 14px !important;
  align-items:center !important;
  gap:20px !important;
  border-bottom:0.5px solid #252525 !important;
  background:#000 !important;
}

body.mf-page-system-tokens #mfMarketGridV235 .mf-market-window-v235 button{
  display:inline-flex !important;
  visibility:visible !important;
  align-items:center !important;
  min-height:42px !important;
}

body.mf-page-system-tokens #mfMarketGridV235 .mf-market-columns-v235{
  display:grid !important;
  visibility:visible !important;
  min-height:44px !important;
}

body.mf-page-system-tokens #mfMarketGridV235 :is(.mf-market-token-head-v235,.mf-market-head-v235){
  visibility:visible !important;
}

@media(max-width:760px){
  body.mf-page-system-tokens #mfMarketGridV235 .mf-market-window-v235{
    padding-inline:12px !important;
    gap:18px !important;
  }
}
'''

JS = r'''
// MEMEFLOW_TOKEN_FLOW_SORT_UI_FIX_V236
// V236 places the V235 controls in HTML so they cannot miss DOMContentLoaded.
document.addEventListener('click',(event)=>{
  const timeframeButton=event.target.closest?.('[data-mf-market-timeframe]');

  if(timeframeButton){
    const next=String(timeframeButton.dataset.mfMarketTimeframe||'').toLowerCase();

    if(
      typeof __MF_MARKET_TIMEFRAMES_V235!=='undefined' &&
      __MF_MARKET_TIMEFRAMES_V235.has(next) &&
      next!==__mfMarketTimeframeV235
    ){
      __mfMarketTimeframeV235=next;
      __mfSaveMarketUiV235();
      state.page=1;
      __mfSyncMarketGridV235();
      __mfRefreshVisibleMarketCardsV235();
      if(typeof __mfKickCardClockV19==='function')__mfKickCardClockV19();
    }
    return;
  }

  const sortButton=event.target.closest?.('[data-mf-market-sort]');
  if(!sortButton)return;

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
  __mfRefreshVisibleMarketCardsV235();
});

queueMicrotask(()=>{
  if(typeof __mfSyncMarketGridV235==='function'){
    __mfSyncMarketGridV235();
  }
});
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

    required=["MEMEFLOW_TOKEN_FLOW_MARKET_GRID_V235","__mfMarketTimeframeV235","__mfMarketSortV235"]
    missing=[item for item in required if item not in js]
    if missing:
        fail("V235 market-grid logic is missing: "+", ".join(missing))

    changed=False

    if 'id="mfMarketGridV235"' not in html:
        anchor='''    <section
      id="tokenList"
      class="token-list"
    >'''
        if anchor not in html:
            fail("tokenList HTML anchor not found")
        html=html.replace(anchor,MARKUP+"\n"+anchor,1)
        changed=True

    if JS_MARKER not in js:
        js=js.rstrip()+"\n\n"+JS+"\n"
        changed=True

    if original_css!=CSS:
        css_path.write_text(CSS,encoding="utf-8")
        changed=True

    if HTML_MARKER not in html:
        block=(
            f'<!-- {HTML_MARKER} -->\n'
            f'<link rel="stylesheet" href="/{CSS_NAME}?v=236-20260928">\n'
            f'<!-- /{HTML_MARKER} -->\n'
        )
        idx=html.lower().rfind("</head>")
        if idx<0:
            fail("</head> not found in system-tokens.html")
        html=html[:idx]+block+html[idx:]
        changed=True

    if not changed:
        print("\n[OK] V236 is already installed. No files changed.")
        return

    stamp=datetime.now().strftime("%Y%m%d-%H%M%S")
    backup_dir=root/f".memeflow-token-flow-sort-ui-v236-backup-{stamp}"
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
            ["git","diff","--check","--","memeflow-app/system-tokens.html","memeflow-app/system-tokens.js",f"memeflow-app/{CSS_NAME}"],
            cwd=root,
            check=True
        )
    except Exception:
        print("[WARN] git diff --check could not run.")

    print("\n[OK] MEMEFLOW TOKEN FLOW SORT UI FIX V236 installed.")
    print(f"[BACKUP] {backup_dir}")
    print("\nV236 fixes the missing controls:")
    print("  • 1M / 5M / 15M / 1H / 6H is now static HTML and always visible")
    print("  • TOKEN / VOL / TX / MC / Δ% / SCORE header is always visible")
    print("  • VOL / TX / MC / Δ% / SCORE remain clickable sorting controls")
    print("  • active sort shows ↑ or ↓")
    print("  • timeframe switching stays connected to V235 real window data")
    print("  • token cards/trading logic are unchanged")
    print("\nNo process/server restart was performed.")
    print("\nPush after visual check:")
    print(
        f'git add memeflow-app/system-tokens.html memeflow-app/system-tokens.js memeflow-app/{CSS_NAME} && '
        'git commit -m "Fix visible Token Flow timeframe and sort controls" && git push'
    )

if __name__=="__main__":
    main()
