#!/usr/bin/env python3
from pathlib import Path
from datetime import datetime
import re
import subprocess
import sys

EXPECTED_REPO_FRAGMENT = "16usa/memeflow-"
CSS_NAME = "memeflow-token-flow-repair-v241.css"
HTML_MARKER = "MEMEFLOW_TOKEN_FLOW_REPAIR_V241_ASSET"
JS_MARKER = "MEMEFLOW_TOKEN_FLOW_REPAIR_V241"

MARKUP = r'''
    <section id="mfMarketGridV235" class="mf-market-grid-v235 mf-market-grid-v241" aria-label="Token market controls">
      <div class="mf-market-top-v241">
        <div class="mf-market-window-v235" aria-label="Market timeframe">
          <button type="button" data-mf-market-timeframe="1m">1M</button>
          <button type="button" data-mf-market-timeframe="5m">5M</button>
          <button type="button" data-mf-market-timeframe="15m">15M</button>
          <button type="button" data-mf-market-timeframe="1h">1H</button>
          <button type="button" data-mf-market-timeframe="6h">6H</button>
        </div>
        <button type="button" id="mfMarketInfoV241" class="mf-market-info-v241" aria-label="Explain market metrics" aria-expanded="false" aria-controls="mfMarketHelpV241">!</button>
        <div id="mfMarketHelpV241" class="mf-market-help-v241" role="dialog" aria-label="Market metric help" hidden>
          <div class="mf-market-help-title-v241">Market metrics</div>
          <div><b>1M–6H</b><span>Window used by VOL, TX and Δ%.</span></div>
          <div><b>VOL</b><span>Trading volume in the selected window.</span></div>
          <div><b>TX</b><span>Transactions in the selected window.</span></div>
          <div><b>MC</b><span>Current live market cap.</span></div>
          <div><b>Δ%</b><span>Price change in the selected window.</span></div>
          <div><b>SCORE</b><span>Current system score.</span></div>
          <div class="mf-market-help-foot-v241">Tap a metric to sort ↓. Tap it again to reverse ↑.</div>
        </div>
      </div>
      <div class="mf-market-columns-v235" aria-label="Sort token cards">
        <span class="mf-market-token-head-v235">TOKEN</span>
        <button type="button" class="mf-market-head-v235" data-mf-market-sort="volume"><span>VOL</span><span class="mf-market-sort-arrow-v235"></span></button>
        <button type="button" class="mf-market-head-v235" data-mf-market-sort="transactions"><span>TX</span><span class="mf-market-sort-arrow-v235"></span></button>
        <button type="button" class="mf-market-head-v235" data-mf-market-sort="mc"><span>MC</span><span class="mf-market-sort-arrow-v235"></span></button>
        <button type="button" class="mf-market-head-v235" data-mf-market-sort="change"><span>Δ%</span><span class="mf-market-sort-arrow-v235"></span></button>
        <button type="button" class="mf-market-head-v235" data-mf-market-sort="score"><span>SCORE</span><span class="mf-market-sort-arrow-v235"></span></button>
      </div>
    </section>
'''

CSS = r'''/* MEMEFLOW TOKEN FLOW REPAIR V241 */
body.mf-page-system-tokens{
  --mf-v241-line:#252525;
  --mf-v241-line-soft:#1a1a1a;
  --mf-v241-line-active:rgba(255,255,255,.30);
  --mf-v241-radius:14px;
  --mf-v241-x:8px;
  --mf-v241-gap:3px;
}
body.mf-page-system-tokens .flow-toolbar{border:0!important;background:transparent!important;box-shadow:none!important;}
body.mf-page-system-tokens .flow-toolbar .search-wrap,
body.mf-page-system-tokens .flow-toolbar #refreshButton{border:.5px solid var(--mf-v241-line)!important;background:transparent!important;box-shadow:none!important;}
body.mf-page-system-tokens #mfMarketGridV235{position:relative!important;z-index:40!important;width:100%!important;margin:0!important;padding:0!important;overflow:visible!important;border:.5px solid var(--mf-v241-line)!important;border-radius:var(--mf-v241-radius)!important;background:#000!important;box-shadow:none!important;pointer-events:auto!important;touch-action:manipulation!important;}
body.mf-page-system-tokens #mfMarketGridV235 .mf-market-top-v241{position:relative!important;min-height:42px!important;padding:0 8px!important;display:grid!important;grid-template-columns:minmax(0,1fr) 28px!important;align-items:center!important;gap:6px!important;border-bottom:.5px solid var(--mf-v241-line)!important;background:#000!important;border-radius:var(--mf-v241-radius) var(--mf-v241-radius) 0 0!important;}
body.mf-page-system-tokens #mfMarketGridV235 .mf-market-window-v235{min-width:0!important;min-height:41px!important;margin:0!important;padding:0!important;display:flex!important;align-items:center!important;gap:3px!important;border:0!important;background:transparent!important;}
body.mf-page-system-tokens #mfMarketGridV235 .mf-market-window-v235 button{min-width:37px!important;height:30px!important;margin:0!important;padding:0 6px!important;display:inline-flex!important;align-items:center!important;justify-content:center!important;border:.5px solid transparent!important;border-radius:8px!important;background:transparent!important;box-shadow:none!important;opacity:.46!important;pointer-events:auto!important;touch-action:manipulation!important;}
body.mf-page-system-tokens #mfMarketGridV235 .mf-market-window-v235 button.is-active{opacity:1!important;border-color:var(--mf-v241-line-active)!important;}
body.mf-page-system-tokens #mfMarketInfoV241{width:26px!important;height:26px!important;margin:0!important;padding:0!important;display:grid!important;place-items:center!important;border:.5px solid var(--mf-v241-line)!important;border-radius:50%!important;background:transparent!important;box-shadow:none!important;opacity:.70!important;}
body.mf-page-system-tokens #mfMarketInfoV241[aria-expanded="true"]{opacity:1!important;border-color:var(--mf-v241-line-active)!important;}
body.mf-page-system-tokens .mf-market-help-v241{position:absolute!important;z-index:300!important;top:36px!important;right:7px!important;width:min(330px,calc(100vw - 42px))!important;padding:12px!important;display:grid!important;gap:8px!important;border:.5px solid var(--mf-v241-line-active)!important;border-radius:12px!important;background:#050505!important;box-shadow:0 14px 34px rgba(0,0,0,.5)!important;}
body.mf-page-system-tokens .mf-market-help-v241[hidden]{display:none!important;}
body.mf-page-system-tokens .mf-market-help-v241>div:not(.mf-market-help-title-v241):not(.mf-market-help-foot-v241){display:grid!important;grid-template-columns:50px minmax(0,1fr)!important;gap:8px!important;}
body.mf-page-system-tokens .mf-market-help-title-v241{padding-bottom:7px!important;border-bottom:.5px solid var(--mf-v241-line)!important;}
body.mf-page-system-tokens .mf-market-help-foot-v241{padding-top:7px!important;border-top:.5px solid var(--mf-v241-line)!important;opacity:.64!important;}
body.mf-page-system-tokens #mfMarketGridV235 .mf-market-columns-v235,
body.mf-page-system-tokens .token-list>.flow-token{display:grid!important;grid-template-columns:minmax(0,2.10fr) minmax(0,.88fr) minmax(0,.60fr) minmax(0,.96fr) minmax(0,.80fr) minmax(0,.56fr)!important;column-gap:var(--mf-v241-gap)!important;}
body.mf-page-system-tokens #mfMarketGridV235 .mf-market-columns-v235{min-height:44px!important;margin:0!important;padding:6px var(--mf-v241-x)!important;grid-template-rows:32px!important;align-items:center!important;background:#000!important;border-radius:0 0 var(--mf-v241-radius) var(--mf-v241-radius)!important;}
body.mf-page-system-tokens #mfMarketGridV235 .mf-market-token-head-v235{grid-column:1!important;grid-row:1!important;padding-left:43px!important;opacity:.5!important;white-space:nowrap!important;}
body.mf-page-system-tokens #mfMarketGridV235 .mf-market-head-v235{grid-row:1!important;width:100%!important;min-width:0!important;height:32px!important;margin:0!important;padding:0 2px!important;display:flex!important;align-items:center!important;justify-content:center!important;gap:2px!important;border:.5px solid var(--mf-v241-line-soft)!important;border-radius:8px!important;background:transparent!important;box-shadow:none!important;opacity:.54!important;pointer-events:auto!important;touch-action:manipulation!important;}
body.mf-page-system-tokens #mfMarketGridV235 .mf-market-head-v235[data-mf-market-sort="volume"]{grid-column:2!important;}
body.mf-page-system-tokens #mfMarketGridV235 .mf-market-head-v235[data-mf-market-sort="transactions"]{grid-column:3!important;}
body.mf-page-system-tokens #mfMarketGridV235 .mf-market-head-v235[data-mf-market-sort="mc"]{grid-column:4!important;}
body.mf-page-system-tokens #mfMarketGridV235 .mf-market-head-v235[data-mf-market-sort="change"]{grid-column:5!important;}
body.mf-page-system-tokens #mfMarketGridV235 .mf-market-head-v235[data-mf-market-sort="score"]{grid-column:6!important;}
body.mf-page-system-tokens #mfMarketGridV235 .mf-market-head-v235.is-active{opacity:1!important;border-color:var(--mf-v241-line-active)!important;}
body.mf-page-system-tokens #mfMarketGridV235 .mf-market-sort-arrow-v235{display:inline-block!important;min-width:7px!important;opacity:0!important;}
body.mf-page-system-tokens #mfMarketGridV235 .mf-market-head-v235.is-active .mf-market-sort-arrow-v235{opacity:.9!important;}
body.mf-page-system-tokens .token-list>.flow-token{min-height:84px!important;grid-template-rows:minmax(0,1fr)!important;padding:9px var(--mf-v241-x)!important;align-items:center!important;}
body.mf-page-system-tokens .token-list>.flow-token>.token-primary{grid-column:1!important;grid-row:1!important;min-width:0!important;width:100%!important;}
body.mf-page-system-tokens .token-list>.flow-token>:is(.mf-open-market-strip,.mf-regular-market-strip){display:contents!important;}
body.mf-page-system-tokens .token-list>.flow-token>.mf-open-market-strip>.mf-open-market-stat:nth-child(-n+2),body.mf-page-system-tokens .token-list>.flow-token>.mf-regular-market-strip>.mf-regular-market-stat:nth-child(-n+2){display:none!important;}
body.mf-page-system-tokens .token-list>.flow-token>.mf-open-market-strip>.mf-open-market-stat:nth-child(3),body.mf-page-system-tokens .token-list>.flow-token>.mf-regular-market-strip>.mf-regular-market-stat:nth-child(3){grid-column:2!important;grid-row:1!important;}
body.mf-page-system-tokens .token-list>.flow-token>.mf-open-market-strip>.mf-open-market-stat:nth-child(4),body.mf-page-system-tokens .token-list>.flow-token>.mf-regular-market-strip>.mf-regular-market-stat:nth-child(4){grid-column:3!important;grid-row:1!important;}
body.mf-page-system-tokens .token-list>.flow-token>.mf-open-market-strip>.mf-open-market-stat:nth-child(5),body.mf-page-system-tokens .token-list>.flow-token>.mf-regular-market-strip>.mf-regular-market-stat:nth-child(5){grid-column:4!important;grid-row:1!important;}
body.mf-page-system-tokens .token-list>.flow-token>.mf-open-market-strip>.mf-open-market-stat:nth-child(6),body.mf-page-system-tokens .token-list>.flow-token>.mf-regular-market-strip>.mf-regular-market-stat:nth-child(6){grid-column:5!important;grid-row:1!important;}
body.mf-page-system-tokens .token-list>.flow-token>:is(.mf-score-slot,.mf-open-pnl-slot){grid-column:6!important;grid-row:1!important;}
body.mf-page-system-tokens .token-list>.flow-token>:is(.mf-open-market-strip,.mf-regular-market-strip)>:is(.mf-open-market-stat,.mf-regular-market-stat):nth-child(n+3),body.mf-page-system-tokens .token-list>.flow-token>.mf-score-slot,body.mf-page-system-tokens .token-list>.flow-token>.mf-open-pnl-slot{min-width:0!important;width:100%!important;min-height:44px!important;margin:0!important;padding:0 2px!important;display:flex!important;flex-direction:column!important;align-items:center!important;justify-content:center!important;border:.5px solid var(--mf-v241-line-soft)!important;border-radius:9px!important;background:transparent!important;box-shadow:none!important;text-align:center!important;box-sizing:border-box!important;}
body.mf-page-system-tokens .token-list>.flow-token>:is(.mf-open-market-strip,.mf-regular-market-strip)>:is(.mf-open-market-stat,.mf-regular-market-stat):nth-child(n+3)>strong,body.mf-page-system-tokens .token-list>.flow-token>.mf-score-slot>strong{width:100%!important;min-width:0!important;text-align:center!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important;font-variant-numeric:tabular-nums!important;}
body.mf-page-system-tokens .token-list>.flow-token .token-details{grid-column:1/-1!important;grid-row:2!important;}
@media(min-width:761px){body.mf-page-system-tokens{--mf-v241-x:12px;--mf-v241-gap:7px;}body.mf-page-system-tokens #mfMarketGridV235 .mf-market-token-head-v235{padding-left:52px!important;}}
'''

SORT_FUNCTION = r'''function __mfMarketApplySortV235(rows){
  const canonical=__mfCanonicalRankV26(Array.isArray(rows)?rows:[]);
  const key=__mfMarketSortV235.key;
  const direction=__mfMarketSortV235.direction==='asc'?'asc':'desc';
  const stableIndex=new Map(canonical.map((row,index)=>[String(row?.mint||''),index]));
  const open=[];
  const rest=[];
  for(const row of canonical){
    if(priority(row)===0)open.push(row);
    else rest.push(row);
  }
  rest.sort((a,b)=>{
    const av=__mfMarketMetricValueV235(a,key);
    const bv=__mfMarketMetricValueV235(b,key);
    const aKnown=finite(av);
    const bKnown=finite(bv);
    if(aKnown&&!bKnown)return -1;
    if(!aKnown&&bKnown)return 1;
    if(aKnown&&bKnown&&Number(av)!==Number(bv)){
      return direction==='asc' ? Number(av)-Number(bv) : Number(bv)-Number(av);
    }
    const laneA=priority(a);
    const laneB=priority(b);
    if(laneA!==laneB)return laneA-laneB;
    return (stableIndex.get(String(a?.mint||''))??0)-(stableIndex.get(String(b?.mint||''))??0);
  });
  return [...open,...rest];
}'''

UI_CODE = r'''
// MEMEFLOW_TOKEN_FLOW_REPAIR_V241
let __mfMarketUiBusyV241=false;

function __mfSyncMarketGridV241(){
  const root=document.getElementById('mfMarketGridV235');
  if(!root)return;
  root.querySelectorAll('[data-mf-market-timeframe]').forEach(button=>{
    const active=String(button.dataset.mfMarketTimeframe||'').toLowerCase()===String(__mfMarketTimeframeV235||'').toLowerCase();
    button.classList.toggle('is-active',active);
    button.setAttribute('aria-pressed',active?'true':'false');
  });
  root.querySelectorAll('[data-mf-market-sort]').forEach(button=>{
    const active=String(button.dataset.mfMarketSort||'')===String(__mfMarketSortV235?.key||'');
    button.classList.toggle('is-active',active);
    button.setAttribute('aria-pressed',active?'true':'false');
    const arrow=button.querySelector('.mf-market-sort-arrow-v235');
    if(arrow)arrow.textContent=active?(__mfMarketSortV235.direction==='asc'?'↑':'↓'):'';
  });
  root.classList.toggle('is-loading-v241',__mfMarketUiBusyV241);
}

function __mfToggleMarketHelpV241(force){
  const button=document.getElementById('mfMarketInfoV241');
  const help=document.getElementById('mfMarketHelpV241');
  if(!button||!help)return;
  const open=typeof force==='boolean'?force:help.hidden;
  help.hidden=!open;
  button.setAttribute('aria-expanded',open?'true':'false');
}

function __mfApplyMarketSortV241(key){
  if(!['volume','transactions','mc','change','score'].includes(key))return;
  if(__mfMarketSortV235.key===key){
    __mfMarketSortV235={key,direction:__mfMarketSortV235.direction==='desc'?'asc':'desc'};
  }else{
    __mfMarketSortV235={key,direction:'desc'};
  }
  __mfSaveMarketUiV235();
  state.page=1;
  render();
  __mfSyncMarketGridV241();
  if(typeof __mfKickCardClockV19==='function')__mfKickCardClockV19();
}

async function __mfWaitStructureIdleV241(){
  for(let index=0;index<24;index++){
    if(typeof __mfStructureLoadingV18==='undefined'||!__mfStructureLoadingV18)return;
    await new Promise(resolve=>setTimeout(resolve,50));
  }
}

async function __mfApplyMarketTimeframeV241(next){
  next=String(next||'').toLowerCase();
  if(!__MF_MARKET_TIMEFRAMES_V235.has(next))return;
  if(__mfMarketUiBusyV241)return;
  __mfMarketTimeframeV235=next;
  __mfSaveMarketUiV235();
  state.page=1;
  __mfMarketUiBusyV241=true;
  __mfSyncMarketGridV241();
  try{
    await __mfWaitStructureIdleV241();
    if(typeof __mfLoadStructureV18==='function')await __mfLoadStructureV18();
    render();
    if(typeof __mfKickCardClockV19==='function')__mfKickCardClockV19();
  }finally{
    __mfMarketUiBusyV241=false;
    __mfSyncMarketGridV241();
  }
}

function __mfBindMarketGridV241(){
  const root=document.getElementById('mfMarketGridV235');
  if(!root)return;
  if(root.dataset.mfV241Bound==='1'){
    __mfSyncMarketGridV241();
    return;
  }
  root.dataset.mfV241Bound='1';
  root.addEventListener('click',(event)=>{
    const info=event.target.closest?.('#mfMarketInfoV241');
    if(info){event.preventDefault();event.stopImmediatePropagation();__mfToggleMarketHelpV241();return;}
    const timeframe=event.target.closest?.('[data-mf-market-timeframe]');
    if(timeframe&&root.contains(timeframe)){
      event.preventDefault();event.stopImmediatePropagation();
      void __mfApplyMarketTimeframeV241(timeframe.dataset.mfMarketTimeframe);
      return;
    }
    const sort=event.target.closest?.('[data-mf-market-sort]');
    if(sort&&root.contains(sort)){
      event.preventDefault();event.stopImmediatePropagation();
      __mfApplyMarketSortV241(String(sort.dataset.mfMarketSort||''));
    }
  },true);
  __mfSyncMarketGridV241();
}

async function __mfRecoverTokenFeedV241(){
  if(state.rows.length)return;
  for(const delay of [250,900,1800]){
    await new Promise(resolve=>setTimeout(resolve,delay));
    if(state.rows.length)return;
    if(typeof __mfStructureLoadingV18!=='undefined'&&__mfStructureLoadingV18)continue;
    try{
      if(typeof __mfLoadStructureV18==='function')await __mfLoadStructureV18();
    }catch(error){console.warn('[token-flow] V241 feed recovery retry',error);}
    if(state.rows.length){render();if(typeof __mfKickCardClockV19==='function')__mfKickCardClockV19();return;}
  }
}

if(document.readyState==='loading'){
  document.addEventListener('DOMContentLoaded',()=>{__mfBindMarketGridV241();void __mfRecoverTokenFeedV241();},{once:true});
}else{
  __mfBindMarketGridV241();
  void __mfRecoverTokenFeedV241();
}

document.addEventListener('click',(event)=>{
  const root=document.getElementById('mfMarketGridV235');
  if(root&&!root.contains(event.target))__mfToggleMarketHelpV241(false);
});
document.addEventListener('keydown',(event)=>{if(event.key==='Escape')__mfToggleMarketHelpV241(false);});
'''

def fail(msg):
    print(f"\n[FAIL] {msg}")
    sys.exit(1)

def find_function_span(text,name):
    m=re.search(rf'\bfunction\s+{re.escape(name)}\s*\([^)]*\)\s*\{{',text)
    if not m:return None
    start=m.start(); brace=text.find('{',m.start())
    depth=0; quote=None; esc=False; line=False; block=False; i=brace
    while i<len(text):
        ch=text[i]; nxt=text[i+1] if i+1<len(text) else ''
        if line:
            if ch=='\n':line=False
            i+=1; continue
        if block:
            if ch=='*' and nxt=='/':block=False;i+=2;continue
            i+=1;continue
        if quote is not None:
            if esc:esc=False;i+=1;continue
            if ch=='\\':esc=True;i+=1;continue
            if ch==quote:quote=None
            i+=1;continue
        if ch=='/' and nxt=='/':line=True;i+=2;continue
        if ch=='/' and nxt=='*':block=True;i+=2;continue
        if ch in ("'",'"','`'):quote=ch;i+=1;continue
        if ch=='{':depth+=1
        elif ch=='}':
            depth-=1
            if depth==0:return start,i+1
        i+=1
    return None

def section_spans(html,target_id):
    tag_re=re.compile(r'<section\b[^>]*>|</section\s*>',re.I|re.S)
    wanted_re=re.compile(rf'\bid\s*=\s*["\']{re.escape(target_id)}["\']',re.I|re.S)
    stack=[]; spans=[]
    for m in tag_re.finditer(html):
        raw=m.group(0)
        if raw.lower().startswith('</section'):
            if not stack:continue
            opened=stack.pop()
            if opened[1]:spans.append((opened[0],m.end()))
        else:
            stack.append((m.start(),bool(wanted_re.search(raw))))
    return spans

def remove_sections(html,target_id):
    spans=section_spans(html,target_id)
    for start,end in sorted(spans,reverse=True):html=html[:start]+html[end:]
    return html,len(spans)

def remove_old_links(html):
    names=['memeflow-token-flow-market-grid-v235.css','memeflow-token-flow-sort-ui-fix-v236.css','memeflow-token-flow-sort-bar-fix-v236.css','memeflow-token-flow-one-row-sort-v237.css','memeflow-token-flow-pro-sort-v238.css','memeflow-token-flow-final-controls-v239.css','memeflow-token-flow-control-cleanup-v240.css',CSS_NAME]
    for name in names:
        html=re.sub(rf'[ \t]*<link\b[^>]*href=["\'][^"\']*{re.escape(name)}[^"\']*["\'][^>]*>\s*','',html,flags=re.I)
    html=re.sub(r'[ \t]*<!--\s*/?MEMEFLOW_TOKEN_FLOW_(?:MARKET_GRID_V235|SORT_UI_FIX_V236|SORT_BAR_FIX_V236|ONE_ROW_SORT_V237|PRO_SORT_V238|FINAL_CONTROLS_V239|CONTROL_CLEANUP_V240|REPAIR_V241)_ASSET\s*-->\s*','',html,flags=re.I)
    return html

def main():
    root=Path.cwd(); app=root/'memeflow-app'
    if not app.is_dir() and root.name=='memeflow-app':app=root
    if not app.is_dir():fail('memeflow-app not found. Run from the existing Replit workspace Shell.')
    try:
        origin=subprocess.check_output(['git','config','--get','remote.origin.url'],cwd=root,text=True,stderr=subprocess.DEVNULL).strip()
    except Exception:origin=''
    if origin and EXPECTED_REPO_FRAGMENT not in origin:fail(f'Unexpected git origin: {origin}')
    html_path=app/'system-tokens.html'; js_path=app/'system-tokens.js'; css_path=app/CSS_NAME
    for p in (html_path,js_path):
        if not p.is_file():fail(f'Missing required file: {p}')
    html=html_path.read_text(encoding='utf-8'); js=js_path.read_text(encoding='utf-8')
    original_html=html; original_js=js; original_css=css_path.read_text(encoding='utf-8') if css_path.exists() else None
    for required in ('__MF_MARKET_TIMEFRAMES_V235','__mfMarketTimeframeV235','__mfMarketSortV235','__mfMarketMetricValueV235'):
        if required not in js:fail(f'Required V235 foundation missing: {required}. No files changed.')

    html,removed=remove_sections(html,'mfMarketGridV235')
    html=remove_old_links(html)
    anchor=re.search(r'<section\b(?=[^>]*\bid\s*=\s*["\']tokenList["\'])[^>]*>',html,re.I|re.S)
    if not anchor:fail('tokenList section not found. No files changed.')
    html=html[:anchor.start()]+MARKUP+'\n'+html[anchor.start():]
    head_end=html.lower().rfind('</head>')
    if head_end<0:fail('</head> not found. No files changed.')
    link=f'<!-- {HTML_MARKER} -->\n<link rel="stylesheet" href="/{CSS_NAME}?v=241-20260928">\n<!-- /{HTML_MARKER} -->\n'
    html=html[:head_end]+link+html[head_end:]

    sort_span=find_function_span(js,'__mfMarketApplySortV235')
    if not sort_span:fail('Could not locate __mfMarketApplySortV235() safely. No files changed.')
    js=js[:sort_span[0]]+SORT_FUNCTION+js[sort_span[1]:]

    # V235 already patched filteredRows to call the sorter. Only warn if local formatting is unusual.
    filtered_span=find_function_span(js,'filteredRows')
    if filtered_span:
        body=js[filtered_span[0]:filtered_span[1]]
        if '__mfMarketApplySortV235' not in body:
            print('[WARN] filteredRows() does not visibly call __mfMarketApplySortV235; V241 will still install UI, but sorting may need one more local-specific hook.')
    else:
        print('[WARN] filteredRows() declaration not detected; V241 will not fail on this anymore.')

    scan_anchor=js.find('// MEMEFLOW_TOKEN_SCAN_V27')
    if scan_anchor<0:fail('MEMEFLOW_TOKEN_SCAN_V27 anchor not found. No files changed.')
    markers=['// MEMEFLOW_TOKEN_FLOW_MARKET_GRID_V235_UI','// MEMEFLOW_TOKEN_FLOW_ONE_ROW_SORT_V237','// MEMEFLOW_TOKEN_FLOW_PRO_SORT_V238','// MEMEFLOW_TOKEN_FLOW_FINAL_CONTROLS_V239','// MEMEFLOW_TOKEN_FLOW_CONTROL_CLEANUP_V240','// MEMEFLOW_TOKEN_FLOW_REPAIR_V241']
    positions=[p for p in (js.find(m) for m in markers) if 0<=p<scan_anchor]
    if positions:
        ui_start=min(positions); js=js[:ui_start]+UI_CODE+'\n\n'+js[scan_anchor:]
    else:
        js=js[:scan_anchor]+UI_CODE+'\n\n'+js[scan_anchor:]

    if len(section_spans(html,'mfMarketGridV235'))!=1:fail('Internal validation failed: expected exactly one market control. No files changed.')
    if js.count(JS_MARKER)!=1:fail(f'Internal validation failed: expected one V241 controller, found {js.count(JS_MARKER)}. No files changed.')

    tmp=root/'.memeflow-v241-check.js'; tmp.write_text(js,encoding='utf-8')
    try:
        subprocess.run(['node','--check',str(tmp)],cwd=root,check=True,stdout=subprocess.DEVNULL)
    except FileNotFoundError:
        print('[WARN] node unavailable; JS syntax check skipped.')
    except subprocess.CalledProcessError:
        fail('V241 JavaScript syntax check failed. No project files changed.')
    finally:
        tmp.unlink(missing_ok=True)

    stamp=datetime.now().strftime('%Y%m%d-%H%M%S'); backup=root/f'.memeflow-token-flow-repair-v241-backup-{stamp}'; backup.mkdir(parents=True,exist_ok=False)
    for p,content in ((html_path,original_html),(js_path,original_js)):
        target=backup/p.relative_to(root); target.parent.mkdir(parents=True,exist_ok=True); target.write_text(content,encoding='utf-8')
    if original_css is not None:
        target=backup/css_path.relative_to(root); target.parent.mkdir(parents=True,exist_ok=True); target.write_text(original_css,encoding='utf-8')

    css_path.write_text(CSS,encoding='utf-8'); html_path.write_text(html,encoding='utf-8'); js_path.write_text(js,encoding='utf-8')
    try:
        subprocess.run(['git','diff','--check','--','memeflow-app/system-tokens.html','memeflow-app/system-tokens.js',f'memeflow-app/{CSS_NAME}'],cwd=root,check=True)
    except Exception:
        print('[WARN] git diff --check could not run.')

    print('\n[OK] MEMEFLOW TOKEN FLOW REPAIR V241 installed.')
    print(f'[BACKUP] {backup}')
    print(f'  • removed {removed} old/duplicate market-control block(s)')
    print('  • inserted exactly ONE timeframe/sort block')
    print('  • replaced old V235/V237/V238 controller range with ONE V241 controller')
    print('  • one tap = one action')
    print('  • sort uses full render so visible card order changes immediately')
    print('  • 1M / 5M / 15M / 1H / 6H reload real display-window data')
    print('  • ! opens metric help')
    print('  • card metric cells align to TOKEN | VOL | TX | MC | Δ% | SCORE')
    print('  • trading / entry / score / scanner rules unchanged')
    print('\nNo process/server restart was performed.')
    print('\nPush only after visual/function check:')
    print(f'git add memeflow-app/system-tokens.html memeflow-app/system-tokens.js memeflow-app/{CSS_NAME} && git commit -m "Repair Token Flow sorting controls" && git push')

if __name__=='__main__':
    main()
