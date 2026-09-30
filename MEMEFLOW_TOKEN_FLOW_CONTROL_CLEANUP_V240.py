#!/usr/bin/env python3
from pathlib import Path
from datetime import datetime
import re
import subprocess
import sys

EXPECTED_REPO_FRAGMENT = "16usa/memeflow-"
CSS_NAME = "memeflow-token-flow-control-cleanup-v240.css"
HTML_MARKER = "MEMEFLOW_TOKEN_FLOW_CONTROL_CLEANUP_V240_ASSET"
JS_MARKER = "MEMEFLOW_TOKEN_FLOW_CONTROL_CLEANUP_V240"

MARKUP = r'''
    <section
      id="mfMarketGridV235"
      class="mf-market-grid-v235 mf-market-grid-v240"
      aria-label="Token market controls"
    >
      <div class="mf-market-top-v240">
        <div class="mf-market-window-v235" aria-label="Market timeframe">
          <button type="button" data-mf-market-timeframe="1m">1M</button>
          <button type="button" data-mf-market-timeframe="5m">5M</button>
          <button type="button" data-mf-market-timeframe="15m">15M</button>
          <button type="button" data-mf-market-timeframe="1h">1H</button>
          <button type="button" data-mf-market-timeframe="6h">6H</button>
        </div>
        <button id="mfMarketInfoV240" class="mf-market-info-v240" type="button"
          aria-label="Explain market metrics" aria-expanded="false"
          aria-controls="mfMarketHelpV240">!</button>
        <div id="mfMarketHelpV240" class="mf-market-help-v240" role="dialog"
          aria-label="Market metric help" hidden>
          <div class="mf-market-help-title-v240">Market metrics</div>
          <div><b>1M–6H</b><span>Window used for VOL, TX and Δ%.</span></div>
          <div><b>VOL</b><span>Trading volume in the selected window.</span></div>
          <div><b>TX</b><span>Transactions in the selected window.</span></div>
          <div><b>MC</b><span>Current live market cap.</span></div>
          <div><b>Δ%</b><span>Price change in the selected window.</span></div>
          <div><b>SCORE</b><span>Current system score.</span></div>
          <div class="mf-market-help-foot-v240">Tap a metric to sort ↓. Tap it again to reverse ↑.</div>
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

CSS = r'''body.mf-page-system-tokens{--mf-v240-line:#252525;--mf-v240-line-soft:#1a1a1a;--mf-v240-line-active:rgba(255,255,255,.30);--mf-v240-radius:14px;--mf-v240-cell-radius:9px;--mf-v240-x:8px;--mf-v240-gap:3px}
body.mf-page-system-tokens .flow-toolbar{border:0!important;background:transparent!important;background-color:transparent!important;background-image:none!important;box-shadow:none!important}
body.mf-page-system-tokens .flow-toolbar .search-wrap,body.mf-page-system-tokens .flow-toolbar #refreshButton{border:.5px solid var(--mf-v240-line)!important;background:transparent!important;background-color:transparent!important;background-image:none!important;box-shadow:none!important}
body.mf-page-system-tokens #mfMarketGridV235{position:relative!important;z-index:40!important;width:100%!important;min-width:0!important;margin:0!important;padding:0!important;overflow:visible!important;border:.5px solid var(--mf-v240-line)!important;border-radius:var(--mf-v240-radius)!important;background:#000!important;box-shadow:none!important;pointer-events:auto!important;touch-action:manipulation!important}
body.mf-page-system-tokens #mfMarketGridV235 .mf-market-top-v240{position:relative!important;min-height:42px!important;padding:0 8px!important;display:grid!important;grid-template-columns:minmax(0,1fr) 28px!important;align-items:center!important;gap:6px!important;border-bottom:.5px solid var(--mf-v240-line)!important;background:#000!important;border-radius:var(--mf-v240-radius) var(--mf-v240-radius) 0 0!important}
body.mf-page-system-tokens #mfMarketGridV235 .mf-market-window-v235{min-width:0!important;min-height:41px!important;margin:0!important;padding:0!important;display:flex!important;align-items:center!important;gap:3px!important;border:0!important;background:transparent!important}
body.mf-page-system-tokens #mfMarketGridV235 .mf-market-window-v235 button{min-width:37px!important;height:30px!important;min-height:30px!important;margin:0!important;padding:0 6px!important;display:inline-flex!important;align-items:center!important;justify-content:center!important;border:.5px solid transparent!important;border-radius:8px!important;background:transparent!important;box-shadow:none!important;opacity:.46!important;cursor:pointer!important;pointer-events:auto!important;touch-action:manipulation!important;-webkit-tap-highlight-color:transparent!important}
body.mf-page-system-tokens #mfMarketGridV235 .mf-market-window-v235 button.is-active{opacity:1!important;border-color:var(--mf-v240-line-active)!important}
body.mf-page-system-tokens #mfMarketGridV235.is-loading-v240 .mf-market-window-v235 button.is-active{opacity:.62!important}
body.mf-page-system-tokens #mfMarketInfoV240{width:26px!important;height:26px!important;min-width:26px!important;min-height:26px!important;margin:0!important;padding:0!important;display:grid!important;place-items:center!important;border:.5px solid var(--mf-v240-line)!important;border-radius:50%!important;background:transparent!important;box-shadow:none!important;opacity:.70!important;cursor:pointer!important;pointer-events:auto!important}
body.mf-page-system-tokens #mfMarketInfoV240[aria-expanded="true"]{opacity:1!important;border-color:var(--mf-v240-line-active)!important}
body.mf-page-system-tokens .mf-market-help-v240{position:absolute!important;z-index:300!important;top:36px!important;right:7px!important;width:min(330px,calc(100vw - 42px))!important;padding:12px!important;display:grid!important;gap:8px!important;border:.5px solid var(--mf-v240-line-active)!important;border-radius:12px!important;background:#050505!important;box-shadow:0 14px 34px rgba(0,0,0,.5)!important}
body.mf-page-system-tokens .mf-market-help-v240[hidden]{display:none!important}
body.mf-page-system-tokens .mf-market-help-v240>div:not(.mf-market-help-title-v240):not(.mf-market-help-foot-v240){display:grid!important;grid-template-columns:50px minmax(0,1fr)!important;gap:8px!important}
body.mf-page-system-tokens .mf-market-help-title-v240{padding-bottom:7px!important;border-bottom:.5px solid var(--mf-v240-line)!important}
body.mf-page-system-tokens .mf-market-help-foot-v240{padding-top:7px!important;border-top:.5px solid var(--mf-v240-line)!important;opacity:.64!important}
body.mf-page-system-tokens #mfMarketGridV235 .mf-market-columns-v235{width:100%!important;min-width:0!important;min-height:44px!important;margin:0!important;padding:6px var(--mf-v240-x)!important;display:grid!important;grid-template-columns:minmax(0,2.10fr) minmax(0,.88fr) minmax(0,.60fr) minmax(0,.96fr) minmax(0,.80fr) minmax(0,.56fr)!important;grid-template-rows:32px!important;column-gap:var(--mf-v240-gap)!important;align-items:center!important;background:#000!important;box-sizing:border-box!important;border-radius:0 0 var(--mf-v240-radius) var(--mf-v240-radius)!important}
body.mf-page-system-tokens #mfMarketGridV235 .mf-market-token-head-v235{grid-column:1!important;grid-row:1!important;min-width:0!important;padding-left:43px!important;opacity:.50!important;white-space:nowrap!important}
body.mf-page-system-tokens #mfMarketGridV235 .mf-market-head-v235{grid-row:1!important;width:100%!important;min-width:0!important;height:32px!important;margin:0!important;padding:0 2px!important;display:flex!important;align-items:center!important;justify-content:center!important;gap:2px!important;border:.5px solid var(--mf-v240-line-soft)!important;border-radius:8px!important;background:transparent!important;box-shadow:none!important;opacity:.54!important;cursor:pointer!important;pointer-events:auto!important;touch-action:manipulation!important;-webkit-tap-highlight-color:transparent!important}
body.mf-page-system-tokens #mfMarketGridV235 .mf-market-head-v235[data-mf-market-sort="volume"]{grid-column:2!important}body.mf-page-system-tokens #mfMarketGridV235 .mf-market-head-v235[data-mf-market-sort="transactions"]{grid-column:3!important}body.mf-page-system-tokens #mfMarketGridV235 .mf-market-head-v235[data-mf-market-sort="mc"]{grid-column:4!important}body.mf-page-system-tokens #mfMarketGridV235 .mf-market-head-v235[data-mf-market-sort="change"]{grid-column:5!important}body.mf-page-system-tokens #mfMarketGridV235 .mf-market-head-v235[data-mf-market-sort="score"]{grid-column:6!important}
body.mf-page-system-tokens #mfMarketGridV235 .mf-market-head-v235.is-active{opacity:1!important;border-color:var(--mf-v240-line-active)!important}body.mf-page-system-tokens #mfMarketGridV235 .mf-market-sort-arrow-v235{display:inline-block!important;min-width:7px!important;opacity:0!important}body.mf-page-system-tokens #mfMarketGridV235 .mf-market-head-v235.is-active .mf-market-sort-arrow-v235{opacity:.9!important}
body.mf-page-system-tokens .token-list>.flow-token{min-height:84px!important;display:grid!important;grid-template-columns:minmax(0,2.10fr) minmax(0,.88fr) minmax(0,.60fr) minmax(0,.96fr) minmax(0,.80fr) minmax(0,.56fr)!important;grid-template-rows:minmax(0,1fr)!important;column-gap:var(--mf-v240-gap)!important;row-gap:0!important;padding:9px var(--mf-v240-x)!important;align-items:center!important}
body.mf-page-system-tokens .token-list>.flow-token>.token-primary{grid-column:1!important;grid-row:1!important;min-width:0!important;width:100%!important}body.mf-page-system-tokens .token-list>.flow-token>:is(.mf-open-market-strip,.mf-regular-market-strip){display:contents!important}
body.mf-page-system-tokens .token-list>.flow-token>.mf-open-market-strip>.mf-open-market-stat:nth-child(-n+2),body.mf-page-system-tokens .token-list>.flow-token>.mf-regular-market-strip>.mf-regular-market-stat:nth-child(-n+2){display:none!important}
body.mf-page-system-tokens .token-list>.flow-token>.mf-open-market-strip>.mf-open-market-stat:nth-child(3),body.mf-page-system-tokens .token-list>.flow-token>.mf-regular-market-strip>.mf-regular-market-stat:nth-child(3){grid-column:2!important;grid-row:1!important}body.mf-page-system-tokens .token-list>.flow-token>.mf-open-market-strip>.mf-open-market-stat:nth-child(4),body.mf-page-system-tokens .token-list>.flow-token>.mf-regular-market-strip>.mf-regular-market-stat:nth-child(4){grid-column:3!important;grid-row:1!important}body.mf-page-system-tokens .token-list>.flow-token>.mf-open-market-strip>.mf-open-market-stat:nth-child(5),body.mf-page-system-tokens .token-list>.flow-token>.mf-regular-market-strip>.mf-regular-market-stat:nth-child(5){grid-column:4!important;grid-row:1!important}body.mf-page-system-tokens .token-list>.flow-token>.mf-open-market-strip>.mf-open-market-stat:nth-child(6),body.mf-page-system-tokens .token-list>.flow-token>.mf-regular-market-strip>.mf-regular-market-stat:nth-child(6){grid-column:5!important;grid-row:1!important}body.mf-page-system-tokens .token-list>.flow-token>:is(.mf-score-slot,.mf-open-pnl-slot){grid-column:6!important;grid-row:1!important}
body.mf-page-system-tokens .token-list>.flow-token>:is(.mf-open-market-strip,.mf-regular-market-strip)>:is(.mf-open-market-stat,.mf-regular-market-stat):nth-child(n+3),body.mf-page-system-tokens .token-list>.flow-token>.mf-score-slot,body.mf-page-system-tokens .token-list>.flow-token>.mf-open-pnl-slot{min-width:0!important;width:100%!important;min-height:44px!important;margin:0!important;padding:0 2px!important;display:flex!important;flex-direction:column!important;align-items:center!important;justify-content:center!important;border:.5px solid var(--mf-v240-line-soft)!important;border-radius:var(--mf-v240-cell-radius)!important;background:transparent!important;box-shadow:none!important;text-align:center!important;box-sizing:border-box!important}
body.mf-page-system-tokens .token-list>.flow-token>:is(.mf-open-market-strip,.mf-regular-market-strip)>:is(.mf-open-market-stat,.mf-regular-market-stat):nth-child(n+3)>strong,body.mf-page-system-tokens .token-list>.flow-token>.mf-score-slot>strong{width:100%!important;min-width:0!important;text-align:center!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important;font-variant-numeric:tabular-nums!important}body.mf-page-system-tokens .token-list>.flow-token .token-details{grid-column:1/-1!important;grid-row:2!important}
@media(min-width:761px){body.mf-page-system-tokens{--mf-v240-x:12px;--mf-v240-gap:7px}body.mf-page-system-tokens #mfMarketGridV235 .mf-market-token-head-v235{padding-left:52px!important}}
'''

JS = r'''
// MEMEFLOW_TOKEN_FLOW_CONTROL_CLEANUP_V240
let __mfMarketBusyV240=false;

function __mfSyncMarketUiV240(){
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
  root.classList.toggle('is-loading-v240',__mfMarketBusyV240);
}

function __mfCloseMarketHelpV240(){
  const help=document.getElementById('mfMarketHelpV240');
  const button=document.getElementById('mfMarketInfoV240');
  if(help)help.hidden=true;
  if(button)button.setAttribute('aria-expanded','false');
}

function __mfToggleMarketHelpV240(){
  const help=document.getElementById('mfMarketHelpV240');
  const button=document.getElementById('mfMarketInfoV240');
  if(!help||!button)return;
  const open=help.hidden;
  help.hidden=!open;
  button.setAttribute('aria-expanded',open?'true':'false');
}

function __mfApplyMarketSortV240(key){
  if(!['volume','transactions','mc','change','score'].includes(key))return;
  if(__mfMarketSortV235.key===key){
    __mfMarketSortV235={key,direction:__mfMarketSortV235.direction==='desc'?'asc':'desc'};
  }else{
    __mfMarketSortV235={key,direction:'desc'};
  }
  if(typeof __mfSaveMarketUiV235==='function')__mfSaveMarketUiV235();
  state.page=1;
  __mfSyncMarketUiV240();
  render();
  if(typeof __mfKickCardClockV19==='function')__mfKickCardClockV19();
  __mfSyncMarketUiV240();
}

async function __mfApplyMarketTimeframeV240(next){
  next=String(next||'').toLowerCase();
  if(!__MF_MARKET_TIMEFRAMES_V235.has(next)||__mfMarketBusyV240)return;
  __mfMarketTimeframeV235=next;
  if(typeof __mfSaveMarketUiV235==='function')__mfSaveMarketUiV235();
  state.page=1;
  __mfMarketBusyV240=true;
  __mfSyncMarketUiV240();
  try{
    for(let i=0;i<20&&__mfStructureLoadingV18;i++)await new Promise(resolve=>setTimeout(resolve,50));
    if(typeof __mfLoadStructureV18==='function')await __mfLoadStructureV18();
    render();
    if(typeof __mfKickCardClockV19==='function')__mfKickCardClockV19();
  }finally{
    __mfMarketBusyV240=false;
    __mfSyncMarketUiV240();
  }
}

// Capture on document before old root listeners: one tap = one action.
document.addEventListener('click',(event)=>{
  const root=document.getElementById('mfMarketGridV235');
  if(!root)return;
  const info=event.target.closest?.('#mfMarketInfoV240');
  if(info&&root.contains(info)){
    event.preventDefault();event.stopImmediatePropagation();__mfToggleMarketHelpV240();return;
  }
  const timeframe=event.target.closest?.('[data-mf-market-timeframe]');
  if(timeframe&&root.contains(timeframe)){
    event.preventDefault();event.stopImmediatePropagation();void __mfApplyMarketTimeframeV240(timeframe.dataset.mfMarketTimeframe);return;
  }
  const sort=event.target.closest?.('[data-mf-market-sort]');
  if(sort&&root.contains(sort)){
    event.preventDefault();event.stopImmediatePropagation();__mfApplyMarketSortV240(String(sort.dataset.mfMarketSort||''));return;
  }
  if(!root.contains(event.target))__mfCloseMarketHelpV240();
},true);

document.addEventListener('keydown',(event)=>{if(event.key==='Escape')__mfCloseMarketHelpV240();});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',__mfSyncMarketUiV240,{once:true});else __mfSyncMarketUiV240();
'''

def fail(msg):
    print(f"\n[FAIL] {msg}")
    sys.exit(1)

def section_spans_by_id(html, target_id):
    tag_re=re.compile(r'<section\b[^>]*>|</section\s*>',re.I|re.S)
    id_re=re.compile(r'\bid\s*=\s*(["\'])'+re.escape(target_id)+r'\1',re.I|re.S)
    stack=[]
    spans=[]
    for match in tag_re.finditer(html):
        tag=match.group(0)
        if tag.lower().startswith('</section'):
            if not stack:
                continue
            opened=stack.pop()
            if opened['target']:
                spans.append((opened['start'],match.end()))
            continue
        stack.append({'start':match.start(),'target':bool(id_re.search(tag))})
    return spans

def remove_sections_by_id(html,target_id):
    spans=section_spans_by_id(html,target_id)
    for start,end in sorted(spans,reverse=True):
        html=html[:start]+html[end:]
    return html,len(spans)

def count_real_sections_by_id(html,target_id):
    return len(section_spans_by_id(html,target_id))

def find_function_span(js,name):
    needle=f"function {name}("
    start=js.find(needle)
    if start<0:return None
    brace=js.find('{',start)
    if brace<0:return None
    i=brace;depth=0;quote=None;line_comment=False;block_comment=False;escape=False
    while i<len(js):
        ch=js[i];nxt=js[i+1] if i+1<len(js) else ''
        if line_comment:
            if ch=='\n':line_comment=False
            i+=1;continue
        if block_comment:
            if ch=='*' and nxt=='/':block_comment=False;i+=2;continue
            i+=1;continue
        if quote is not None:
            if escape:escape=False;i+=1;continue
            if ch=='\\':escape=True;i+=1;continue
            if ch==quote:quote=None
            i+=1;continue
        if ch=='/' and nxt=='/':line_comment=True;i+=2;continue
        if ch=='/' and nxt=='*':block_comment=True;i+=2;continue
        if ch in ("'",'"','`'):quote=ch;i+=1;continue
        if ch=='{':depth+=1
        elif ch=='}':
            depth-=1
            if depth==0:return start,i+1
        i+=1
    return None

def ensure_market_sort_in_filtered_rows(js):
    marker='// MEMEFLOW_TOKEN_FLOW_MARKET_SORT_WRAPPER_V240'
    if marker in js:return js,False
    span=find_function_span(js,'filteredRows')
    if not span:fail('Could not locate filteredRows() safely.')
    start,end=span
    original=js[start:end]
    renamed=original.replace('function filteredRows(','function __mfFilteredRowsBeforeMarketV240(',1)
    wrapper=r'''
// MEMEFLOW_TOKEN_FLOW_MARKET_SORT_WRAPPER_V240
function filteredRows(){
  const rows=__mfFilteredRowsBeforeMarketV240();
  if(typeof __mfMarketApplySortV235==='function')return __mfMarketApplySortV235(rows);
  return rows;
}
'''
    return js[:start]+renamed+'\n'+wrapper+js[end:],True

def main():
    root=Path.cwd()
    app=root/'memeflow-app'
    if not app.is_dir() and root.name=='memeflow-app':app=root
    if not app.is_dir():fail('memeflow-app not found. Run from the existing Replit workspace Shell.')
    try:
        origin=subprocess.check_output(['git','config','--get','remote.origin.url'],cwd=root,text=True,stderr=subprocess.DEVNULL).strip()
    except Exception:
        origin=''
    if origin and EXPECTED_REPO_FRAGMENT not in origin:fail(f'Unexpected git origin: {origin}')

    html_path=app/'system-tokens.html';js_path=app/'system-tokens.js';css_path=app/CSS_NAME
    for path in (html_path,js_path):
        if not path.is_file():fail(f'Missing required file: {path}')

    html=html_path.read_text(encoding='utf-8');js=js_path.read_text(encoding='utf-8')
    original_html=html;original_js=js;original_css=css_path.read_text(encoding='utf-8') if css_path.exists() else None

    for required in ('__mfMarketTimeframeV235','__mfMarketSortV235','__MF_MARKET_TIMEFRAMES_V235','__mfMarketApplySortV235'):
        if required not in js:fail(f'Required V235 market logic missing: {required}. V240 will not guess or fabricate it.')

    html,removed_controls=remove_sections_by_id(html,'mfMarketGridV235')

    legacy_names=['memeflow-token-flow-market-grid-v235.css','memeflow-token-flow-sort-ui-fix-v236.css','memeflow-token-flow-sort-bar-fix-v236.css','memeflow-token-flow-one-row-sort-v237.css','memeflow-token-flow-pro-sort-v238.css','memeflow-token-flow-final-controls-v239.css',CSS_NAME]
    for name in legacy_names:
        html=re.sub(rf'[ \t]*<link[^>]+href=["\']/[^"\']*{re.escape(name)}[^"\']*["\'][^>]*>\s*','',html,flags=re.I)
    html=re.sub(r'[ \t]*<!--\s*/?MEMEFLOW_TOKEN_FLOW_(?:MARKET_GRID_V235|SORT_UI_FIX_V236|SORT_BAR_FIX_V236|ONE_ROW_SORT_V237|PRO_SORT_V238|FINAL_CONTROLS_V239|CONTROL_CLEANUP_V240)_ASSET\s*-->\s*','',html,flags=re.I)

    token_anchor=re.search(r'<section\b(?=[^>]*\bid\s*=\s*["\']tokenList["\'])[^>]*>',html,flags=re.I|re.S)
    if not token_anchor:fail('tokenList section not found.')
    html=html[:token_anchor.start()]+MARKUP+'\n'+html[token_anchor.start():]

    head_end=html.lower().rfind('</head>')
    if head_end<0:fail('</head> not found.')
    css_link=f'<!-- {HTML_MARKER} -->\n<link rel="stylesheet" href="/{CSS_NAME}?v=240-20260928">\n<!-- /{HTML_MARKER} -->\n'
    html=html[:head_end]+css_link+html[head_end:]

    js,wrapped=ensure_market_sort_in_filtered_rows(js)
    if JS_MARKER not in js:
        scan_anchor=js.find('// MEMEFLOW_TOKEN_SCAN_V27')
        if scan_anchor<0:fail('JavaScript insertion anchor MEMEFLOW_TOKEN_SCAN_V27 not found.')
        js=js[:scan_anchor]+JS+'\n\n'+js[scan_anchor:]

    stamp=datetime.now().strftime('%Y%m%d-%H%M%S')
    backup_dir=root/f'.memeflow-token-flow-control-cleanup-v240-backup-{stamp}'
    backup_dir.mkdir(parents=True,exist_ok=False)
    for path,content in ((html_path,original_html),(js_path,original_js)):
        target=backup_dir/path.relative_to(root);target.parent.mkdir(parents=True,exist_ok=True);target.write_text(content,encoding='utf-8')
    if original_css is not None:
        target=backup_dir/css_path.relative_to(root);target.parent.mkdir(parents=True,exist_ok=True);target.write_text(original_css,encoding='utf-8')

    real_controls=count_real_sections_by_id(html,'mfMarketGridV235')
    if real_controls!=1:fail(f'Internal V240 validation failed before write: expected 1 real control module, found {real_controls}. Backup: {backup_dir}')

    tmp_js=root/'.memeflow-v240-system-tokens-check.js';tmp_js.write_text(js,encoding='utf-8')
    try:
        subprocess.run(['node','--check',str(tmp_js)],cwd=root,check=True,stdout=subprocess.DEVNULL)
    except FileNotFoundError:
        print('[WARN] node unavailable; JS syntax check skipped.')
    except subprocess.CalledProcessError:
        tmp_js.unlink(missing_ok=True);fail(f'V240 JavaScript syntax check failed. Original source was NOT overwritten. Backup: {backup_dir}')
    finally:
        tmp_js.unlink(missing_ok=True)

    css_path.write_text(CSS,encoding='utf-8');html_path.write_text(html,encoding='utf-8');js_path.write_text(js,encoding='utf-8')
    try:
        subprocess.run(['git','diff','--check','--','memeflow-app/system-tokens.html','memeflow-app/system-tokens.js',f'memeflow-app/{CSS_NAME}'],cwd=root,check=True)
    except Exception:
        print('[WARN] git diff --check could not run.')

    print('\n[OK] MEMEFLOW TOKEN FLOW CONTROL CLEANUP V240 installed.')
    print(f'[BACKUP] {backup_dir}')
    print('\nV240:')
    print(f'  • removed {removed_controls} existing real market-control block(s)')
    print('  • inserted exactly ONE market-control module')
    print('  • old V235-V239 market-control styles are unlinked')
    print('  • document-capture controller makes one tap = one action')
    print('  • timeframe: 1M / 5M / 15M / 1H / 6H')
    print('  • sort: VOL / TX / MC / Δ% / SCORE; second tap reverses ↑/↓')
    print('  • final filteredRows result is explicitly passed through market sort')
    print('  • cards use one aligned row: TOKEN | VOL | TX | MC | Δ% | SCORE')
    print('  • metric values sit in clean 0.5px outlined cells')
    print('  • ! opens metric/timeframe explanation')
    print('  • Search + Analyze stay transparent with only outlines')
    print('  • trading / entry / score / scanner rules are not changed')
    print(f"  • filteredRows market wrapper added: {'yes' if wrapped else 'already present'}")
    print('\nNo process/server restart was performed.')
    print('\nPush only after visual/function check:')
    print(f'git add memeflow-app/system-tokens.html memeflow-app/system-tokens.js memeflow-app/{CSS_NAME} && git commit -m "Clean Token Flow controls and enforce sorting" && git push')

if __name__=='__main__':main()
