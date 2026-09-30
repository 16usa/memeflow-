#!/usr/bin/env python3
from pathlib import Path
from datetime import datetime
import re
import subprocess
import sys

EXPECTED_REPO_FRAGMENT = "16usa/memeflow-"
CSS_NAME = "memeflow-token-flow-final-controls-v239.css"
HTML_MARKER = "MEMEFLOW_TOKEN_FLOW_FINAL_CONTROLS_V239_ASSET"
JS_MARKER = "MEMEFLOW_TOKEN_FLOW_FINAL_CONTROLS_V239"

MARKUP = r'''
    <section
      id="mfMarketGridV235"
      class="mf-market-grid-v235 mf-market-grid-v239"
      aria-label="Token market controls"
    >
      <div class="mf-market-top-v239">
        <div class="mf-market-window-v235" aria-label="Market timeframe">
          <button type="button" data-mf-market-timeframe="1m">1M</button>
          <button type="button" data-mf-market-timeframe="5m">5M</button>
          <button type="button" data-mf-market-timeframe="15m">15M</button>
          <button type="button" data-mf-market-timeframe="1h">1H</button>
          <button type="button" data-mf-market-timeframe="6h">6H</button>
        </div>

        <button
          type="button"
          id="mfMarketInfoV239"
          class="mf-market-info-v239"
          aria-label="What do these metrics mean?"
          aria-expanded="false"
          aria-controls="mfMarketHelpV239"
        >!</button>

        <div
          id="mfMarketHelpV239"
          class="mf-market-help-v239"
          role="dialog"
          aria-label="Market metric help"
          hidden
        >
          <div class="mf-market-help-title-v239">Market data</div>
          <div><b>1M–6H</b><span>Window used by VOL, TX and Δ%.</span></div>
          <div><b>VOL</b><span>Trading volume in the selected window.</span></div>
          <div><b>TX</b><span>Transactions in the selected window.</span></div>
          <div><b>MC</b><span>Current live market cap.</span></div>
          <div><b>Δ%</b><span>Price change in the selected window.</span></div>
          <div><b>SCORE</b><span>Current system score.</span></div>
          <div class="mf-market-help-foot-v239">
            Tap a metric to sort ↓. Tap it again to reverse ↑.
          </div>
        </div>
      </div>

      <div class="mf-market-columns-v235" aria-label="Sort token cards">
        <span class="mf-market-token-head-v235">TOKEN</span>

        <button type="button" class="mf-market-head-v235" data-mf-market-sort="volume">
          <span>VOL</span><span class="mf-market-sort-arrow-v235"></span>
        </button>

        <button type="button" class="mf-market-head-v235" data-mf-market-sort="transactions">
          <span>TX</span><span class="mf-market-sort-arrow-v235"></span>
        </button>

        <button type="button" class="mf-market-head-v235" data-mf-market-sort="mc">
          <span>MC</span><span class="mf-market-sort-arrow-v235"></span>
        </button>

        <button type="button" class="mf-market-head-v235" data-mf-market-sort="change">
          <span>Δ%</span><span class="mf-market-sort-arrow-v235"></span>
        </button>

        <button type="button" class="mf-market-head-v235" data-mf-market-sort="score">
          <span>SCORE</span><span class="mf-market-sort-arrow-v235"></span>
        </button>
      </div>
    </section>
'''

CSS = r'''/* MEMEFLOW TOKEN FLOW FINAL CONTROLS V239
   One control module. One listener. One card grid.
   Legacy V235-V238 market-control styles are unlinked by installer.
*/

body.mf-page-system-tokens{
  --mf-v239-line:#252525;
  --mf-v239-line-soft:#1b1b1b;
  --mf-v239-line-active:rgba(255,255,255,.30);
  --mf-v239-radius:14px;
  --mf-v239-cell-radius:9px;
  --mf-v239-x:9px;
  --mf-v239-gap:4px;
}

/* Search / Analyze: outline only, no interior slab. */
body.mf-page-system-tokens .flow-toolbar{
  padding:0 !important;
  gap:10px !important;
  border:0 !important;
  background:transparent !important;
  background-color:transparent !important;
  background-image:none !important;
  box-shadow:none !important;
}

body.mf-page-system-tokens .flow-toolbar .search-wrap,
body.mf-page-system-tokens .flow-toolbar #refreshButton{
  border:0.5px solid var(--mf-v239-line) !important;
  background:transparent !important;
  background-color:transparent !important;
  background-image:none !important;
  box-shadow:none !important;
}

/* SINGLE MARKET CONTROL MODULE */
body.mf-page-system-tokens #mfMarketGridV235{
  position:relative !important;
  z-index:30 !important;
  width:100% !important;
  min-width:0 !important;
  margin:0 !important;
  padding:0 !important;
  overflow:visible !important;
  border:0.5px solid var(--mf-v239-line) !important;
  border-radius:var(--mf-v239-radius) !important;
  background:#000 !important;
  background-color:#000 !important;
  background-image:none !important;
  box-shadow:none !important;
  pointer-events:auto !important;
  touch-action:manipulation !important;
}

body.mf-page-system-tokens #mfMarketGridV235 .mf-market-top-v239{
  position:relative !important;
  min-height:42px !important;
  padding:0 9px 0 12px !important;
  display:grid !important;
  grid-template-columns:minmax(0,1fr) 28px !important;
  align-items:center !important;
  gap:8px !important;
  border-bottom:0.5px solid var(--mf-v239-line) !important;
  background:#000 !important;
  border-radius:var(--mf-v239-radius) var(--mf-v239-radius) 0 0 !important;
}

body.mf-page-system-tokens #mfMarketGridV235 .mf-market-window-v235{
  min-width:0 !important;
  min-height:41px !important;
  margin:0 !important;
  padding:0 !important;
  display:flex !important;
  align-items:center !important;
  gap:5px !important;
  border:0 !important;
  background:transparent !important;
  overflow:visible !important;
}

body.mf-page-system-tokens #mfMarketGridV235 .mf-market-window-v235 button{
  min-width:40px !important;
  height:30px !important;
  min-height:30px !important;
  margin:0 !important;
  padding:0 8px !important;
  display:inline-flex !important;
  align-items:center !important;
  justify-content:center !important;
  border:0.5px solid transparent !important;
  border-radius:8px !important;
  background:transparent !important;
  background-color:transparent !important;
  background-image:none !important;
  box-shadow:none !important;
  opacity:.46 !important;
  cursor:pointer !important;
  pointer-events:auto !important;
  touch-action:manipulation !important;
  -webkit-tap-highlight-color:transparent !important;
}

body.mf-page-system-tokens #mfMarketGridV235 .mf-market-window-v235 button.is-active{
  opacity:1 !important;
  border-color:var(--mf-v239-line-active) !important;
}

body.mf-page-system-tokens #mfMarketGridV235.is-loading-v239 .mf-market-window-v235 button.is-active{
  opacity:.64 !important;
}

/* Help button + popover */
body.mf-page-system-tokens #mfMarketInfoV239{
  width:26px !important;
  height:26px !important;
  min-width:26px !important;
  min-height:26px !important;
  margin:0 !important;
  padding:0 !important;
  display:grid !important;
  place-items:center !important;
  border:0.5px solid var(--mf-v239-line) !important;
  border-radius:50% !important;
  background:transparent !important;
  box-shadow:none !important;
  opacity:.72 !important;
  cursor:pointer !important;
  pointer-events:auto !important;
}

body.mf-page-system-tokens #mfMarketInfoV239[aria-expanded="true"]{
  opacity:1 !important;
  border-color:var(--mf-v239-line-active) !important;
}

body.mf-page-system-tokens .mf-market-help-v239{
  position:absolute !important;
  z-index:200 !important;
  top:36px !important;
  right:7px !important;
  width:min(330px,calc(100vw - 42px)) !important;
  padding:12px !important;
  display:grid !important;
  gap:8px !important;
  border:0.5px solid var(--mf-v239-line-active) !important;
  border-radius:12px !important;
  background:#050505 !important;
  box-shadow:0 14px 34px rgba(0,0,0,.48) !important;
}

body.mf-page-system-tokens .mf-market-help-v239[hidden]{
  display:none !important;
}

body.mf-page-system-tokens .mf-market-help-v239 > div:not(.mf-market-help-title-v239):not(.mf-market-help-foot-v239){
  display:grid !important;
  grid-template-columns:50px minmax(0,1fr) !important;
  gap:8px !important;
}

body.mf-page-system-tokens .mf-market-help-title-v239{
  padding-bottom:7px !important;
  border-bottom:0.5px solid var(--mf-v239-line) !important;
}

body.mf-page-system-tokens .mf-market-help-foot-v239{
  padding-top:7px !important;
  border-top:0.5px solid var(--mf-v239-line) !important;
  opacity:.64 !important;
}

/* ONE SORT HEADER ROW */
body.mf-page-system-tokens #mfMarketGridV235 .mf-market-columns-v235{
  width:100% !important;
  min-width:0 !important;
  min-height:44px !important;
  margin:0 !important;
  padding:6px var(--mf-v239-x) !important;
  display:grid !important;
  grid-template-columns:
    minmax(0,2.15fr)
    minmax(0,.86fr)
    minmax(0,.60fr)
    minmax(0,.94fr)
    minmax(0,.78fr)
    minmax(0,.58fr) !important;
  grid-template-rows:32px !important;
  column-gap:var(--mf-v239-gap) !important;
  align-items:center !important;
  background:#000 !important;
  box-sizing:border-box !important;
  border-radius:0 0 var(--mf-v239-radius) var(--mf-v239-radius) !important;
}

body.mf-page-system-tokens #mfMarketGridV235 .mf-market-token-head-v235{
  grid-column:1 !important;
  grid-row:1 !important;
  min-width:0 !important;
  padding-left:48px !important;
  opacity:.50 !important;
  white-space:nowrap !important;
}

body.mf-page-system-tokens #mfMarketGridV235 .mf-market-head-v235{
  grid-row:1 !important;
  width:100% !important;
  min-width:0 !important;
  height:32px !important;
  margin:0 !important;
  padding:0 3px !important;
  display:flex !important;
  align-items:center !important;
  justify-content:center !important;
  gap:2px !important;
  border:0.5px solid var(--mf-v239-line-soft) !important;
  border-radius:8px !important;
  background:transparent !important;
  background-color:transparent !important;
  background-image:none !important;
  box-shadow:none !important;
  opacity:.54 !important;
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

body.mf-page-system-tokens #mfMarketGridV235 .mf-market-head-v235.is-active{
  opacity:1 !important;
  border-color:var(--mf-v239-line-active) !important;
}

body.mf-page-system-tokens #mfMarketGridV235 .mf-market-sort-arrow-v235{
  display:inline-block !important;
  min-width:7px !important;
  opacity:0 !important;
}

body.mf-page-system-tokens #mfMarketGridV235 .mf-market-head-v235.is-active .mf-market-sort-arrow-v235{
  opacity:.9 !important;
}

/* CARD GRID EXACTLY MATCHES HEADER */
body.mf-page-system-tokens .token-list > .flow-token{
  min-height:84px !important;
  display:grid !important;
  grid-template-columns:
    minmax(0,2.15fr)
    minmax(0,.86fr)
    minmax(0,.60fr)
    minmax(0,.94fr)
    minmax(0,.78fr)
    minmax(0,.58fr) !important;
  grid-template-rows:minmax(0,1fr) !important;
  column-gap:var(--mf-v239-gap) !important;
  row-gap:0 !important;
  padding:9px var(--mf-v239-x) !important;
  align-items:center !important;
}

body.mf-page-system-tokens .token-list > .flow-token > .token-primary{
  grid-column:1 !important;
  grid-row:1 !important;
  min-width:0 !important;
  width:100% !important;
}

body.mf-page-system-tokens .token-list > .flow-token > :is(.mf-open-market-strip,.mf-regular-market-strip){
  display:contents !important;
}

body.mf-page-system-tokens .token-list > .flow-token > .mf-open-market-strip > .mf-open-market-stat:nth-child(-n+2),
body.mf-page-system-tokens .token-list > .flow-token > .mf-regular-market-strip > .mf-regular-market-stat:nth-child(-n+2){
  display:none !important;
}

body.mf-page-system-tokens .token-list > .flow-token > .mf-open-market-strip > .mf-open-market-stat:nth-child(3),
body.mf-page-system-tokens .token-list > .flow-token > .mf-regular-market-strip > .mf-regular-market-stat:nth-child(3){
  grid-column:2 !important;grid-row:1 !important;
}

body.mf-page-system-tokens .token-list > .flow-token > .mf-open-market-strip > .mf-open-market-stat:nth-child(4),
body.mf-page-system-tokens .token-list > .flow-token > .mf-regular-market-strip > .mf-regular-market-stat:nth-child(4){
  grid-column:3 !important;grid-row:1 !important;
}

body.mf-page-system-tokens .token-list > .flow-token > .mf-open-market-strip > .mf-open-market-stat:nth-child(5),
body.mf-page-system-tokens .token-list > .flow-token > .mf-regular-market-strip > .mf-regular-market-stat:nth-child(5){
  grid-column:4 !important;grid-row:1 !important;
}

body.mf-page-system-tokens .token-list > .flow-token > .mf-open-market-strip > .mf-open-market-stat:nth-child(6),
body.mf-page-system-tokens .token-list > .flow-token > .mf-regular-market-strip > .mf-regular-market-stat:nth-child(6){
  grid-column:5 !important;grid-row:1 !important;
}

body.mf-page-system-tokens .token-list > .flow-token > :is(.mf-score-slot,.mf-open-pnl-slot){
  grid-column:6 !important;
  grid-row:1 !important;
}

/* Small outlined value windows */
body.mf-page-system-tokens .token-list > .flow-token > :is(.mf-open-market-strip,.mf-regular-market-strip) > :is(.mf-open-market-stat,.mf-regular-market-stat):nth-child(n+3),
body.mf-page-system-tokens .token-list > .flow-token > .mf-score-slot,
body.mf-page-system-tokens .token-list > .flow-token > .mf-open-pnl-slot{
  min-width:0 !important;
  width:100% !important;
  min-height:44px !important;
  margin:0 !important;
  padding:0 3px !important;
  display:flex !important;
  flex-direction:column !important;
  align-items:center !important;
  justify-content:center !important;
  border:0.5px solid var(--mf-v239-line-soft) !important;
  border-radius:var(--mf-v239-cell-radius) !important;
  background:transparent !important;
  background-color:transparent !important;
  background-image:none !important;
  box-shadow:none !important;
  text-align:center !important;
  box-sizing:border-box !important;
  cursor:pointer !important;
  pointer-events:auto !important;
  touch-action:manipulation !important;
}

body.mf-page-system-tokens .token-list > .flow-token > :is(.mf-open-market-strip,.mf-regular-market-strip) > :is(.mf-open-market-stat,.mf-regular-market-stat):nth-child(n+3).is-active-sort-v239,
body.mf-page-system-tokens .token-list > .flow-token > .mf-score-slot.is-active-sort-v239{
  border-color:var(--mf-v239-line-active) !important;
}

body.mf-page-system-tokens .token-list > .flow-token > :is(.mf-open-market-strip,.mf-regular-market-strip) > :is(.mf-open-market-stat,.mf-regular-market-stat):nth-child(n+3) > strong,
body.mf-page-system-tokens .token-list > .flow-token > .mf-score-slot > strong{
  width:100% !important;
  min-width:0 !important;
  text-align:center !important;
  white-space:nowrap !important;
  overflow:hidden !important;
  text-overflow:ellipsis !important;
  font-variant-numeric:tabular-nums !important;
}

body.mf-page-system-tokens .token-list > .flow-token .token-details{
  grid-column:1 / -1 !important;
  grid-row:2 !important;
}

@media(max-width:760px){
  body.mf-page-system-tokens{
    --mf-v239-x:7px;
    --mf-v239-gap:3px;
  }

  body.mf-page-system-tokens #mfMarketGridV235 .mf-market-top-v239{
    padding-left:8px !important;
    padding-right:7px !important;
  }

  body.mf-page-system-tokens #mfMarketGridV235 .mf-market-window-v235{
    gap:3px !important;
  }

  body.mf-page-system-tokens #mfMarketGridV235 .mf-market-window-v235 button{
    min-width:37px !important;
    padding-inline:6px !important;
  }

  body.mf-page-system-tokens #mfMarketGridV235 .mf-market-columns-v235,
  body.mf-page-system-tokens .token-list > .flow-token{
    grid-template-columns:
      minmax(0,2.10fr)
      minmax(0,.88fr)
      minmax(0,.60fr)
      minmax(0,.96fr)
      minmax(0,.80fr)
      minmax(0,.56fr) !important;
  }

  body.mf-page-system-tokens #mfMarketGridV235 .mf-market-token-head-v235{
    padding-left:43px !important;
  }
}
'''

NEW_SORT_FUNCTION = r'''function __mfMarketApplySortV235(rows){
  const canonical=__mfCanonicalRankV26(Array.isArray(rows)?rows:[]);
  const key=__mfMarketSortV235.key;
  const direction=__mfMarketSortV235.direction==='asc'?'asc':'desc';

  const stableIndex=new Map(
    canonical.map((row,index)=>[String(row?.mint||''),index])
  );

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
      return direction==='asc'
        ? Number(av)-Number(bv)
        : Number(bv)-Number(av);
    }

    const laneA=priority(a);
    const laneB=priority(b);
    if(laneA!==laneB)return laneA-laneB;

    return (
      (stableIndex.get(String(a?.mint||''))??0)-
      (stableIndex.get(String(b?.mint||''))??0)
    );
  });

  return [...open,...rest];
}'''

FINAL_UI = r'''
// MEMEFLOW_TOKEN_FLOW_FINAL_CONTROLS_V239
let __mfMarketUiBusyV239=false;

function __mfSyncMarketGridV235(){
  return __mfSyncMarketGridV239();
}

function __mfRefreshVisibleMarketCardsV235(){
  __mfReconcileVisibleCardsV183();

  for(const card of document.querySelectorAll('.flow-token[data-mint]')){
    const mint=String(card.dataset.mint||'').trim();
    if(mint)__mfPatchMutableCardV17(mint);
  }

  __mfDecorateMarketCardsV239();
}

function __mfSyncMarketGridV239(){
  const root=document.getElementById('mfMarketGridV235');
  if(!root)return;

  root.querySelectorAll('[data-mf-market-timeframe]').forEach(button=>{
    const active=
      String(button.dataset.mfMarketTimeframe||'').toLowerCase()===
      __mfMarketTimeframeV235;

    button.classList.toggle('is-active',active);
    button.setAttribute('aria-pressed',active?'true':'false');
  });

  root.querySelectorAll('[data-mf-market-sort]').forEach(button=>{
    const active=
      String(button.dataset.mfMarketSort||'')===
      __mfMarketSortV235.key;

    button.classList.toggle('is-active',active);
    button.setAttribute('aria-pressed',active?'true':'false');

    const arrow=button.querySelector('.mf-market-sort-arrow-v235');
    if(arrow){
      arrow.textContent=active
        ? (__mfMarketSortV235.direction==='asc'?'↑':'↓')
        : '';
    }
  });

  root.classList.toggle('is-loading-v239',__mfMarketUiBusyV239);
  __mfDecorateMarketCardsV239();
}

function __mfDecorateMarketCardsV239(){
  const activeKey=__mfMarketSortV235?.key||'';

  for(const card of document.querySelectorAll('.flow-token[data-mint]')){
    const strip=card.querySelector('.mf-regular-market-strip,.mf-open-market-strip');
    const stats=strip
      ? [...strip.querySelectorAll('.mf-regular-market-stat,.mf-open-market-stat')]
      : [];

    const keys=[null,null,'volume','transactions','mc','change'];

    stats.forEach((cell,index)=>{
      const key=keys[index]||'';
      if(!key)return;

      cell.dataset.mfCardSortV239=key;
      cell.setAttribute('role','button');
      cell.setAttribute('tabindex','0');
      cell.classList.toggle('is-active-sort-v239',key===activeKey);
    });

    const score=card.querySelector('.mf-score-slot');
    if(score){
      score.dataset.mfCardSortV239='score';
      score.setAttribute('role','button');
      score.setAttribute('tabindex','0');
      score.classList.toggle('is-active-sort-v239',activeKey==='score');
    }
  }
}

function __mfApplyMarketSortV239(key){
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

  __mfSyncMarketGridV239();
  __mfReconcileVisibleCardsV183();

  for(const card of document.querySelectorAll('.flow-token[data-mint]')){
    const mint=String(card.dataset.mint||'').trim();
    if(mint)__mfPatchMutableCardV17(mint);
  }

  __mfDecorateMarketCardsV239();
}

async function __mfWaitForStructureLaneV239(){
  for(let i=0;i<24;i++){
    if(!__mfStructureLoadingV18)return;
    await new Promise(resolve=>setTimeout(resolve,50));
  }
}

async function __mfApplyMarketTimeframeV239(next){
  next=String(next||'').toLowerCase();

  if(!__MF_MARKET_TIMEFRAMES_V235.has(next))return;
  if(__mfMarketUiBusyV239)return;

  __mfMarketTimeframeV235=next;
  __mfSaveMarketUiV235();
  state.page=1;

  __mfMarketUiBusyV239=true;
  __mfSyncMarketGridV239();

  try{
    await __mfWaitForStructureLaneV239();

    if(typeof __mfLoadStructureV18==='function'){
      await __mfLoadStructureV18();
    }

    if(typeof loadTokens==='function'&&state.rows.length){
      await loadTokens();
    }

    __mfReconcileVisibleCardsV183();

    for(const card of document.querySelectorAll('.flow-token[data-mint]')){
      const mint=String(card.dataset.mint||'').trim();
      if(mint)__mfPatchMutableCardV17(mint);
    }
  }finally{
    __mfMarketUiBusyV239=false;
    __mfSyncMarketGridV239();
  }
}

function __mfToggleMarketHelpV239(force){
  const button=document.getElementById('mfMarketInfoV239');
  const help=document.getElementById('mfMarketHelpV239');

  if(!button||!help)return;

  const open=typeof force==='boolean'
    ? force
    : help.hidden;

  help.hidden=!open;
  button.setAttribute('aria-expanded',open?'true':'false');
}

function __mfBindMarketGridV239(){
  const root=document.getElementById('mfMarketGridV235');
  const list=document.getElementById('tokenList');

  if(!root)return;

  if(root.dataset.mfV239Bound!=='1'){
    root.dataset.mfV239Bound='1';

    root.addEventListener('click',(event)=>{
      const info=event.target.closest?.('#mfMarketInfoV239');

      if(info){
        event.preventDefault();
        event.stopImmediatePropagation();
        __mfToggleMarketHelpV239();
        return;
      }

      const timeframe=event.target.closest?.('[data-mf-market-timeframe]');

      if(timeframe&&root.contains(timeframe)){
        event.preventDefault();
        event.stopImmediatePropagation();
        void __mfApplyMarketTimeframeV239(
          timeframe.dataset.mfMarketTimeframe
        );
        return;
      }

      const sort=event.target.closest?.('[data-mf-market-sort]');

      if(sort&&root.contains(sort)){
        event.preventDefault();
        event.stopImmediatePropagation();
        __mfApplyMarketSortV239(
          String(sort.dataset.mfMarketSort||'')
        );
      }
    },true);
  }

  if(list&&list.dataset.mfV239Bound!=='1'){
    list.dataset.mfV239Bound='1';

    const activateCardSort=event=>{
      const cell=event.target.closest?.('[data-mf-card-sort-v239]');
      if(!cell||!list.contains(cell))return;

      event.preventDefault();
      event.stopImmediatePropagation();

      __mfApplyMarketSortV239(
        String(cell.dataset.mfCardSortV239||'')
      );
    };

    list.addEventListener('click',activateCardSort,true);

    list.addEventListener('keydown',(event)=>{
      if(event.key!=='Enter'&&event.key!==' ')return;
      activateCardSort(event);
    },true);

    new MutationObserver(()=>{
      queueMicrotask(__mfDecorateMarketCardsV239);
    }).observe(list,{childList:true,subtree:true});
  }

  if(document.documentElement.dataset.mfV239OutsideBound!=='1'){
    document.documentElement.dataset.mfV239OutsideBound='1';

    document.addEventListener('click',(event)=>{
      const rootNow=document.getElementById('mfMarketGridV235');
      if(rootNow&&!rootNow.contains(event.target)){
        __mfToggleMarketHelpV239(false);
      }
    });

    document.addEventListener('keydown',(event)=>{
      if(event.key==='Escape')__mfToggleMarketHelpV239(false);
    });
  }

  __mfSyncMarketGridV239();
}

async function __mfRecoverTokenFeedV239(){
  if(state.rows.length)return;

  for(const delay of [150,900,1800]){
    await new Promise(resolve=>setTimeout(resolve,delay));

    if(state.rows.length)return;
    if(__mfStructureLoadingV18)continue;

    try{
      await __mfLoadStructureV18();
    }catch(error){
      console.warn('[token-flow] V239 feed recovery retry',error);
    }
  }
}

if(document.readyState==='loading'){
  document.addEventListener('DOMContentLoaded',()=>{
    __mfBindMarketGridV239();
    void __mfRecoverTokenFeedV239();
  },{once:true});
}else{
  __mfBindMarketGridV239();
  void __mfRecoverTokenFeedV239();
}
'''

LEGACY_V236_RE = re.compile(
    r'''\n*// MEMEFLOW_TOKEN_FLOW_SORT_UI_FIX_V236\b.*?queueMicrotask\(\(\)=>\{\s*
  if\(typeof __mfSyncMarketGridV235==='function'\)\{\s*
    __mfSyncMarketGridV235\(\);\s*
  \}\s*
\}\);\s*''',
    re.S
)

LEGACY_LINK_RE = re.compile(
    r'''[ \t]*<link[^>]+href=["']/[^"']*(?:'''
    r'''memeflow-token-flow-market-grid-v235|'''
    r'''memeflow-token-flow-sort-ui-fix-v236|'''
    r'''memeflow-token-flow-sort-bar-fix-v236|'''
    r'''memeflow-token-flow-one-row-sort-v237|'''
    r'''memeflow-token-flow-pro-sort-v238'''
    r''')[^"']*["'][^>]*>\s*''',
    re.I
)

LEGACY_ASSET_COMMENT_RE = re.compile(
    r'''[ \t]*<!--\s*/?(?:'''
    r'''MEMEFLOW_TOKEN_FLOW_MARKET_GRID_V235_ASSET|'''
    r'''MEMEFLOW_TOKEN_FLOW_SORT_UI_FIX_V236_ASSET|'''
    r'''MEMEFLOW_TOKEN_FLOW_SORT_BAR_FIX_V236_ASSET|'''
    r'''MEMEFLOW_TOKEN_FLOW_ONE_ROW_SORT_V237_ASSET|'''
    r'''MEMEFLOW_TOKEN_FLOW_PRO_SORT_V238_ASSET'''
    r''')\s*-->\s*''',
    re.I
)

MARKET_SECTION_RE = re.compile(
    r'''\s*<section\s+id=["']mfMarketGridV235["']\b.*?</section>\s*''',
    re.S | re.I
)

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

    for required in (
        "MEMEFLOW_TOKEN_FLOW_MARKET_GRID_V235",
        "__mfMarketTimeframeV235",
        "__mfMarketSortV235",
        "__mfMarketMetricValueV235"
    ):
        if required not in js:
            fail(f"Required V235 market logic missing: {required}")

    # 1) Remove EVERY old/duplicated market-control module, then insert exactly one.
    html,count_sections=MARKET_SECTION_RE.subn("\n",html)

    token_anchor=re.search(
        r'''(?m)^[ \t]*<section\s*\n[ \t]*id=["']tokenList["']\s*\n[ \t]*class=["']token-list["']\s*\n[ \t]*>''',
        html
    )

    if not token_anchor:
        fail("tokenList insertion anchor not found")

    html=html[:token_anchor.start()]+MARKUP+"\n"+html[token_anchor.start():]

    # 2) Unlink all old V235-V238 market-control CSS.
    html,_=LEGACY_LINK_RE.subn("",html)
    html,_=LEGACY_ASSET_COMMENT_RE.subn("",html)

    # 3) Remove old V236 document-wide click listener.
    js,_=LEGACY_V236_RE.subn("\n",js)

    # 4) Replace sorter.
    sort_start=js.find("function __mfMarketApplySortV235(rows){")
    if sort_start<0:
        fail("V235 sort function not found")

    after_sort_candidates=[
        pos for pos in (
            js.find("// MEMEFLOW_TOKEN_FLOW_MARKET_GRID_V235_UI",sort_start),
            js.find("// MEMEFLOW_TOKEN_FLOW_ONE_ROW_SORT_V237",sort_start),
            js.find("// MEMEFLOW_TOKEN_FLOW_PRO_SORT_V238",sort_start),
            js.find("// MEMEFLOW_TOKEN_FLOW_FINAL_CONTROLS_V239",sort_start),
            js.find("// MEMEFLOW_TOKEN_SCAN_V27",sort_start)
        )
        if pos>=0
    ]

    if not after_sort_candidates:
        fail("Could not locate sort-function boundary")

    sort_boundary=min(after_sort_candidates)
    sort_close=js.rfind("\n}",sort_start,sort_boundary)

    if sort_close<0:
        fail("Could not locate end of V235 sort function")

    js=js[:sort_start]+NEW_SORT_FUNCTION+js[sort_close+2:]

    # 5) Replace every previous market UI controller before token scan with one controller.
    scan_anchor=js.find("// MEMEFLOW_TOKEN_SCAN_V27")
    if scan_anchor<0:
        fail("Token scan anchor not found")

    ui_markers=[
        "// MEMEFLOW_TOKEN_FLOW_MARKET_GRID_V235_UI",
        "// MEMEFLOW_TOKEN_FLOW_ONE_ROW_SORT_V237",
        "// MEMEFLOW_TOKEN_FLOW_PRO_SORT_V238",
        "// MEMEFLOW_TOKEN_FLOW_FINAL_CONTROLS_V239"
    ]

    ui_positions=[]
    for marker in ui_markers:
        pos=js.find(marker)
        if pos>=0 and pos<scan_anchor:
            ui_positions.append(pos)

    if ui_positions:
        ui_start=min(ui_positions)
        js=js[:ui_start]+FINAL_UI+"\n\n"+js[scan_anchor:]
    else:
        js=js[:scan_anchor]+FINAL_UI+"\n\n"+js[scan_anchor:]

    # 6) Write final CSS.
    css_path.write_text(CSS,encoding="utf-8")

    # Remove an older V239 link if re-running, then add exactly one.
    html=re.sub(
        r'''[ \t]*<link[^>]+href=["']/memeflow-token-flow-final-controls-v239\.css[^"']*["'][^>]*>\s*''',
        "",
        html,
        flags=re.I
    )
    html=re.sub(
        r'''[ \t]*<!--\s*/?MEMEFLOW_TOKEN_FLOW_FINAL_CONTROLS_V239_ASSET\s*-->\s*''',
        "",
        html,
        flags=re.I
    )

    block=(
        f'<!-- {HTML_MARKER} -->\n'
        f'<link rel="stylesheet" href="/{CSS_NAME}?v=239-20260928">\n'
        f'<!-- /{HTML_MARKER} -->\n'
    )

    head_end=html.lower().rfind("</head>")
    if head_end<0:
        fail("</head> not found")

    html=html[:head_end]+block+html[head_end:]

    changed=(html!=original_html or js!=original_js or original_css!=CSS)

    if not changed:
        print("\n[OK] V239 is already installed. No files changed.")
        return

    stamp=datetime.now().strftime("%Y%m%d-%H%M%S")
    backup_dir=root/f".memeflow-token-flow-final-controls-v239-backup-{stamp}"
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

    # Verify exactly one control module.
    final_sections=len(
        re.findall(
            r'''id=["']mfMarketGridV235["']''',
            html,
            flags=re.I
        )
    )

    if final_sections!=1:
        html_path.write_text(original_html,encoding="utf-8")
        js_path.write_text(original_js,encoding="utf-8")
        if original_css is None:
            css_path.unlink(missing_ok=True)
        else:
            css_path.write_text(original_css,encoding="utf-8")
        fail(f"Expected exactly one market-control module after patch, got {final_sections}. Source restored.")

    try:
        subprocess.run(
            ["node","--check",str(js_path)],
            cwd=root,
            check=True
        )
    except FileNotFoundError:
        print("[WARN] node unavailable; JS syntax check skipped.")
    except subprocess.CalledProcessError:
        html_path.write_text(original_html,encoding="utf-8")
        js_path.write_text(original_js,encoding="utf-8")
        if original_css is None:
            css_path.unlink(missing_ok=True)
        else:
            css_path.write_text(original_css,encoding="utf-8")
        fail("system-tokens.js syntax check failed; source restored. Backup: "+str(backup_dir))

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

    print("\n[OK] MEMEFLOW TOKEN FLOW FINAL CONTROLS V239 installed.")
    print(f"[BACKUP] {backup_dir}")
    print("\nV239 cleanup/fixes:")
    print(f"  • removed {count_sections} old/duplicate market-control HTML block(s)")
    print("  • exactly ONE timeframe + sort module remains")
    print("  • unlinked V235/V236/V237/V238 market-control CSS conflicts")
    print("  • removed the old V236 global click listener")
    print("  • one tap now causes exactly one timeframe/sort transition")
    print("  • VOL / TX / MC / Δ% / SCORE reorder visible cards")
    print("  • second tap reverses ↓ / ↑")
    print("  • card metric windows align to the same six-column header")
    print("  • ! button opens metric/timeframe help")
    print("  • Search + Analyze stay outline-only / transparent")
    print("  • empty-feed startup gets three bounded recovery attempts")
    print("  • trading / entry / score calculation / scanner rules are unchanged")
    print("\nNo process/server restart was performed.")
    print("\nPush after visual check:")
    print(
        f'git add memeflow-app/system-tokens.html '
        f'memeflow-app/system-tokens.js '
        f'memeflow-app/{CSS_NAME} && '
        'git commit -m "Clean Token Flow controls and fix sorting" && git push'
    )

if __name__=="__main__":
    main()
