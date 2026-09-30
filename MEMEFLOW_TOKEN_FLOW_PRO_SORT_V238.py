#!/usr/bin/env python3
from pathlib import Path
from datetime import datetime
import re
import subprocess
import sys

EXPECTED_REPO_FRAGMENT = "16usa/memeflow-"
CSS_NAME = "memeflow-token-flow-pro-sort-v238.css"
HTML_MARKER = "MEMEFLOW_TOKEN_FLOW_PRO_SORT_V238_ASSET"
JS_MARKER = "MEMEFLOW_TOKEN_FLOW_PRO_SORT_V238"

MARKUP = r'''
    <section
      id="mfMarketGridV235"
      class="mf-market-grid-v235 mf-market-grid-v238"
      aria-label="Token market controls"
    >
      <div class="mf-market-top-v238">
        <div class="mf-market-window-v235" aria-label="Market timeframe">
          <button type="button" data-mf-market-timeframe="1m" aria-label="1 minute window">1M</button>
          <button type="button" data-mf-market-timeframe="5m" aria-label="5 minute window">5M</button>
          <button type="button" data-mf-market-timeframe="15m" aria-label="15 minute window">15M</button>
          <button type="button" data-mf-market-timeframe="1h" aria-label="1 hour window">1H</button>
          <button type="button" data-mf-market-timeframe="6h" aria-label="6 hour window">6H</button>
        </div>

        <button
          type="button"
          id="mfMarketInfoV238"
          class="mf-market-info-v238"
          aria-label="Explain market columns"
          aria-expanded="false"
          aria-controls="mfMarketHelpV238"
        >i</button>

        <div
          id="mfMarketHelpV238"
          class="mf-market-help-v238"
          role="dialog"
          aria-label="Market data help"
          hidden
        >
          <div class="mf-market-help-title-v238">Market controls</div>
          <div><b>1M–6H</b><span>Data window for VOL, TX and Δ%.</span></div>
          <div><b>VOL</b><span>Trading volume inside the selected window.</span></div>
          <div><b>TX</b><span>Transactions inside the selected window.</span></div>
          <div><b>MC</b><span>Current live market cap.</span></div>
          <div><b>Δ%</b><span>Price move inside the selected window.</span></div>
          <div><b>SCORE</b><span>Current system score.</span></div>
          <div class="mf-market-help-foot-v238">Tap a column once for ↓, again for ↑. You can also tap a metric value inside a card.</div>
        </div>
      </div>

      <div class="mf-market-columns-v235" aria-label="Sort token cards">
        <span class="mf-market-token-head-v235">TOKEN</span>

        <button type="button" class="mf-market-head-v235" data-mf-market-sort="volume" aria-label="Sort by volume">
          <span>VOL</span><span class="mf-market-sort-arrow-v235"></span>
        </button>

        <button type="button" class="mf-market-head-v235" data-mf-market-sort="transactions" aria-label="Sort by transactions">
          <span>TX</span><span class="mf-market-sort-arrow-v235"></span>
        </button>

        <button type="button" class="mf-market-head-v235" data-mf-market-sort="mc" aria-label="Sort by market cap">
          <span>MC</span><span class="mf-market-sort-arrow-v235"></span>
        </button>

        <button type="button" class="mf-market-head-v235" data-mf-market-sort="change" aria-label="Sort by price change">
          <span>Δ%</span><span class="mf-market-sort-arrow-v235"></span>
        </button>

        <button type="button" class="mf-market-head-v235" data-mf-market-sort="score" aria-label="Sort by score">
          <span>SCORE</span><span class="mf-market-sort-arrow-v235"></span>
        </button>
      </div>
    </section>
'''

CSS = r'''/* MEMEFLOW TOKEN FLOW PRO SORT V238
   Professional market controls + one-row metric cards.
   Keeps existing page text sizing/colors unless needed for control affordance.
*/

body.mf-page-system-tokens{
  --mf-v238-line:#252525;
  --mf-v238-line-soft:#1d1d1d;
  --mf-v238-line-active:rgba(255,255,255,.30);
  --mf-v238-radius:14px;
  --mf-v238-cell-radius:10px;
  --mf-v238-x:10px;
  --mf-v238-gap:5px;
}

/* =========================
   CONTROL MODULE
   ========================= */
body.mf-page-system-tokens #mfMarketGridV235{
  position:relative !important;
  z-index:20 !important;
  width:100% !important;
  min-width:0 !important;
  margin:0 !important;
  padding:0 !important;
  overflow:visible !important;
  border:0.5px solid var(--mf-v238-line) !important;
  border-radius:var(--mf-v238-radius) !important;
  background:#000 !important;
  background-color:#000 !important;
  background-image:none !important;
  box-shadow:none !important;
  pointer-events:auto !important;
  touch-action:manipulation !important;
}

body.mf-page-system-tokens #mfMarketGridV235 .mf-market-top-v238{
  position:relative !important;
  min-height:44px !important;
  display:grid !important;
  grid-template-columns:minmax(0,1fr) 30px !important;
  align-items:center !important;
  gap:8px !important;
  padding:0 10px 0 12px !important;
  border-bottom:0.5px solid var(--mf-v238-line) !important;
  background:#000 !important;
  border-radius:var(--mf-v238-radius) var(--mf-v238-radius) 0 0 !important;
}

body.mf-page-system-tokens #mfMarketGridV235 .mf-market-window-v235{
  min-width:0 !important;
  min-height:43px !important;
  margin:0 !important;
  padding:0 !important;
  display:flex !important;
  align-items:center !important;
  justify-content:flex-start !important;
  gap:7px !important;
  border:0 !important;
  background:transparent !important;
  overflow:visible !important;
  pointer-events:auto !important;
}

body.mf-page-system-tokens #mfMarketGridV235 .mf-market-window-v235 button{
  position:relative !important;
  z-index:3 !important;
  min-width:42px !important;
  height:30px !important;
  min-height:30px !important;
  margin:0 !important;
  padding:0 9px !important;
  display:inline-flex !important;
  align-items:center !important;
  justify-content:center !important;
  border:0.5px solid transparent !important;
  border-radius:9px !important;
  background:transparent !important;
  box-shadow:none !important;
  opacity:.46 !important;
  cursor:pointer !important;
  pointer-events:auto !important;
  touch-action:manipulation !important;
  -webkit-tap-highlight-color:transparent !important;
}

body.mf-page-system-tokens #mfMarketGridV235 .mf-market-window-v235 button::after{
  content:none !important;
  display:none !important;
}

body.mf-page-system-tokens #mfMarketGridV235 .mf-market-window-v235 button.is-active{
  opacity:1 !important;
  border-color:var(--mf-v238-line-active) !important;
}

body.mf-page-system-tokens #mfMarketGridV235.is-loading-v238 .mf-market-window-v235 button.is-active{
  opacity:.62 !important;
}

/* info */
body.mf-page-system-tokens #mfMarketInfoV238{
  position:relative !important;
  z-index:4 !important;
  width:28px !important;
  height:28px !important;
  min-width:28px !important;
  min-height:28px !important;
  margin:0 !important;
  padding:0 !important;
  display:grid !important;
  place-items:center !important;
  justify-self:end !important;
  border:0.5px solid var(--mf-v238-line) !important;
  border-radius:50% !important;
  background:transparent !important;
  box-shadow:none !important;
  opacity:.72 !important;
  cursor:pointer !important;
  pointer-events:auto !important;
  touch-action:manipulation !important;
}

body.mf-page-system-tokens #mfMarketInfoV238[aria-expanded="true"]{
  opacity:1 !important;
  border-color:var(--mf-v238-line-active) !important;
}

body.mf-page-system-tokens .mf-market-help-v238{
  position:absolute !important;
  z-index:100 !important;
  top:38px !important;
  right:8px !important;
  width:min(330px,calc(100vw - 44px)) !important;
  padding:12px !important;
  display:grid !important;
  gap:8px !important;
  border:0.5px solid var(--mf-v238-line-active) !important;
  border-radius:12px !important;
  background:#050505 !important;
  box-shadow:0 12px 30px rgba(0,0,0,.46) !important;
}

body.mf-page-system-tokens .mf-market-help-v238[hidden]{
  display:none !important;
}

body.mf-page-system-tokens .mf-market-help-v238 > div:not(.mf-market-help-title-v238):not(.mf-market-help-foot-v238){
  display:grid !important;
  grid-template-columns:48px minmax(0,1fr) !important;
  gap:8px !important;
  align-items:start !important;
}

body.mf-page-system-tokens .mf-market-help-title-v238{
  padding-bottom:7px !important;
  border-bottom:0.5px solid var(--mf-v238-line) !important;
}

body.mf-page-system-tokens .mf-market-help-foot-v238{
  padding-top:7px !important;
  border-top:0.5px solid var(--mf-v238-line) !important;
  opacity:.62 !important;
}

/* =========================
   ONE ROW SORT HEADER
   ========================= */
body.mf-page-system-tokens #mfMarketGridV235 .mf-market-columns-v235{
  width:100% !important;
  min-width:0 !important;
  min-height:46px !important;
  margin:0 !important;
  padding:7px var(--mf-v238-x) !important;
  display:grid !important;
  grid-template-columns:
    minmax(0,2.08fr)
    minmax(0,.90fr)
    minmax(0,.64fr)
    minmax(0,.95fr)
    minmax(0,.82fr)
    minmax(0,.56fr) !important;
  grid-template-rows:32px !important;
  column-gap:var(--mf-v238-gap) !important;
  row-gap:0 !important;
  align-items:center !important;
  background:#000 !important;
  border-radius:0 0 var(--mf-v238-radius) var(--mf-v238-radius) !important;
  box-sizing:border-box !important;
}

body.mf-page-system-tokens #mfMarketGridV235 .mf-market-token-head-v235{
  grid-column:1 !important;
  grid-row:1 !important;
  min-width:0 !important;
  padding-left:48px !important;
  align-self:center !important;
  opacity:.48 !important;
  white-space:nowrap !important;
}

body.mf-page-system-tokens #mfMarketGridV235 .mf-market-head-v235{
  grid-row:1 !important;
  position:relative !important;
  z-index:3 !important;
  width:100% !important;
  min-width:0 !important;
  height:32px !important;
  margin:0 !important;
  padding:0 5px !important;
  display:flex !important;
  align-items:center !important;
  justify-content:center !important;
  gap:3px !important;
  border:0.5px solid var(--mf-v238-line-soft) !important;
  border-radius:8px !important;
  background:transparent !important;
  box-shadow:none !important;
  text-align:center !important;
  opacity:.56 !important;
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
  border-color:var(--mf-v238-line-active) !important;
}

body.mf-page-system-tokens #mfMarketGridV235 .mf-market-sort-arrow-v235{
  display:inline-block !important;
  width:8px !important;
  min-width:8px !important;
  opacity:0 !important;
}

body.mf-page-system-tokens #mfMarketGridV235 .mf-market-head-v235.is-active .mf-market-sort-arrow-v235{
  opacity:.9 !important;
}

/* =========================
   TOKEN CARD — ONE ROW / FIVE VALUE WINDOWS
   ========================= */
body.mf-page-system-tokens .token-list > .flow-token{
  min-height:86px !important;
  display:grid !important;
  grid-template-columns:
    minmax(0,2.08fr)
    minmax(0,.90fr)
    minmax(0,.64fr)
    minmax(0,.95fr)
    minmax(0,.82fr)
    minmax(0,.56fr) !important;
  grid-template-rows:minmax(0,1fr) !important;
  column-gap:var(--mf-v238-gap) !important;
  row-gap:0 !important;
  padding:10px var(--mf-v238-x) !important;
  align-items:center !important;
  align-content:center !important;
}

body.mf-page-system-tokens .token-list > .flow-token > .token-primary{
  grid-column:1 !important;
  grid-row:1 !important;
  min-width:0 !important;
  width:100% !important;
  align-self:center !important;
}

body.mf-page-system-tokens .token-list > .flow-token > :is(.mf-open-market-strip,.mf-regular-market-strip){
  display:contents !important;
}

body.mf-page-system-tokens .token-list > .flow-token > .mf-open-market-strip > .mf-open-market-stat:nth-child(-n+2),
body.mf-page-system-tokens .token-list > .flow-token > .mf-regular-market-strip > .mf-regular-market-stat:nth-child(-n+2){
  display:none !important;
}

body.mf-page-system-tokens .token-list > .flow-token > .mf-open-market-strip > .mf-open-market-stat:nth-child(3),
body.mf-page-system-tokens .token-list > .flow-token > .mf-regular-market-strip > .mf-regular-market-stat:nth-child(3){grid-column:2 !important;grid-row:1 !important;}
body.mf-page-system-tokens .token-list > .flow-token > .mf-open-market-strip > .mf-open-market-stat:nth-child(4),
body.mf-page-system-tokens .token-list > .flow-token > .mf-regular-market-strip > .mf-regular-market-stat:nth-child(4){grid-column:3 !important;grid-row:1 !important;}
body.mf-page-system-tokens .token-list > .flow-token > .mf-open-market-strip > .mf-open-market-stat:nth-child(5),
body.mf-page-system-tokens .token-list > .flow-token > .mf-regular-market-strip > .mf-regular-market-stat:nth-child(5){grid-column:4 !important;grid-row:1 !important;}
body.mf-page-system-tokens .token-list > .flow-token > .mf-open-market-strip > .mf-open-market-stat:nth-child(6),
body.mf-page-system-tokens .token-list > .flow-token > .mf-regular-market-strip > .mf-regular-market-stat:nth-child(6){grid-column:5 !important;grid-row:1 !important;}

body.mf-page-system-tokens .token-list > .flow-token > :is(.mf-score-slot,.mf-open-pnl-slot){
  grid-column:6 !important;
  grid-row:1 !important;
}

/* metric windows */
body.mf-page-system-tokens .token-list > .flow-token > :is(.mf-open-market-strip,.mf-regular-market-strip) > :is(.mf-open-market-stat,.mf-regular-market-stat):nth-child(n+3),
body.mf-page-system-tokens .token-list > .flow-token > .mf-score-slot{
  min-width:0 !important;
  width:100% !important;
  min-height:46px !important;
  margin:0 !important;
  padding:0 5px !important;
  display:flex !important;
  flex-direction:column !important;
  align-items:center !important;
  justify-content:center !important;
  border:0.5px solid var(--mf-v238-line-soft) !important;
  border-radius:var(--mf-v238-cell-radius) !important;
  background:transparent !important;
  box-shadow:none !important;
  box-sizing:border-box !important;
  text-align:center !important;
  cursor:pointer !important;
  pointer-events:auto !important;
  touch-action:manipulation !important;
  -webkit-tap-highlight-color:transparent !important;
}

body.mf-page-system-tokens .token-list > .flow-token > :is(.mf-open-market-strip,.mf-regular-market-strip) > :is(.mf-open-market-stat,.mf-regular-market-stat):nth-child(n+3).is-active-sort-v238,
body.mf-page-system-tokens .token-list > .flow-token > .mf-score-slot.is-active-sort-v238{
  border-color:var(--mf-v238-line-active) !important;
}

body.mf-page-system-tokens .token-list > .flow-token > :is(.mf-open-market-strip,.mf-regular-market-strip) > :is(.mf-open-market-stat,.mf-regular-market-stat):nth-child(n+3) > strong,
body.mf-page-system-tokens .token-list > .flow-token > .mf-score-slot > strong{
  width:100% !important;
  min-width:0 !important;
  margin:0 !important;
  text-align:center !important;
  white-space:nowrap !important;
  overflow:hidden !important;
  text-overflow:ellipsis !important;
  font-variant-numeric:tabular-nums !important;
}

/* OPEN P&L keeps its semantic label, but gets same geometric cell. */
body.mf-page-system-tokens .token-list > .flow-token > .mf-open-pnl-slot{
  min-width:0 !important;
  min-height:46px !important;
  padding:0 5px !important;
  display:flex !important;
  flex-direction:column !important;
  align-items:center !important;
  justify-content:center !important;
  border:0.5px solid var(--mf-v238-line-soft) !important;
  border-radius:var(--mf-v238-cell-radius) !important;
  background:transparent !important;
  box-sizing:border-box !important;
}

body.mf-page-system-tokens .token-list > .flow-token .token-details{
  grid-column:1 / -1 !important;
  grid-row:2 !important;
}

@media(min-width:761px){
  body.mf-page-system-tokens{
    --mf-v238-x:14px;
    --mf-v238-gap:8px;
  }
  body.mf-page-system-tokens #mfMarketGridV235 .mf-market-token-head-v235{padding-left:58px !important;}
}

@media(max-width:760px){
  body.mf-page-system-tokens{
    --mf-v238-x:8px;
    --mf-v238-gap:3px;
  }
  body.mf-page-system-tokens #mfMarketGridV235 .mf-market-top-v238{padding-left:9px !important;padding-right:8px !important;}
  body.mf-page-system-tokens #mfMarketGridV235 .mf-market-window-v235{gap:4px !important;}
  body.mf-page-system-tokens #mfMarketGridV235 .mf-market-window-v235 button{min-width:38px !important;padding-inline:7px !important;}
  body.mf-page-system-tokens #mfMarketGridV235 .mf-market-columns-v235,
  body.mf-page-system-tokens .token-list > .flow-token{
    grid-template-columns:
      minmax(0,2.00fr)
      minmax(0,.92fr)
      minmax(0,.64fr)
      minmax(0,.98fr)
      minmax(0,.84fr)
      minmax(0,.54fr) !important;
  }
  body.mf-page-system-tokens #mfMarketGridV235 .mf-market-token-head-v235{padding-left:44px !important;}
  body.mf-page-system-tokens #mfMarketGridV235 .mf-market-head-v235{padding-inline:2px !important;}
  body.mf-page-system-tokens .token-list > .flow-token{min-height:82px !important;}
  body.mf-page-system-tokens .token-list > .flow-token > :is(.mf-open-market-strip,.mf-regular-market-strip) > :is(.mf-open-market-stat,.mf-regular-market-stat):nth-child(n+3),
  body.mf-page-system-tokens .token-list > .flow-token > .mf-score-slot,
  body.mf-page-system-tokens .token-list > .flow-token > .mf-open-pnl-slot{padding-inline:3px !important;}
}
'''

NEW_SORT_FUNCTION = r'''function __mfMarketApplySortV235(rows){
  const canonical=__mfCanonicalRankV26(Array.isArray(rows)?rows:[]);
  const key=__mfMarketSortV235.key;
  const direction=__mfMarketSortV235.direction==='asc'?'asc':'desc';

  const stableIndex=new Map(
    canonical.map((row,index)=>[String(row?.mint||''),index])
  );

  // OPEN POSITION remains pinned at the top in canonical P&L order.
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

    // Equal values keep state priority as a secondary order, then stable rank.
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

UI_CODE = r'''
// MEMEFLOW_TOKEN_FLOW_PRO_SORT_V238
let __mfMarketUiBusyV238=false;

function __mfSyncMarketGridV238(){
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

  root.classList.toggle('is-loading-v238',__mfMarketUiBusyV238);
  __mfDecorateMarketCardsV238();
}

function __mfDecorateMarketCardsV238(){
  const activeKey=__mfMarketSortV235?.key||'';

  for(const card of document.querySelectorAll('.flow-token[data-mint]')){
    const strip=card.querySelector('.mf-regular-market-strip,.mf-open-market-strip');
    const stats=strip
      ? [...strip.querySelectorAll('.mf-regular-market-stat,.mf-open-market-stat')]
      : [];

    const map=[null,null,'volume','transactions','mc','change'];

    stats.forEach((cell,index)=>{
      const key=map[index]||'';
      if(!key)return;

      cell.dataset.mfCardSortV238=key;
      cell.setAttribute('role','button');
      cell.setAttribute('tabindex','0');
      cell.setAttribute('aria-label',`Sort by ${key}`);
      cell.classList.toggle('is-active-sort-v238',key===activeKey);
    });

    const score=card.querySelector('.mf-score-slot');
    if(score){
      score.dataset.mfCardSortV238='score';
      score.setAttribute('role','button');
      score.setAttribute('tabindex','0');
      score.setAttribute('aria-label','Sort by score');
      score.classList.toggle('is-active-sort-v238',activeKey==='score');
    }
  }
}

function __mfApplyMarketSortV238(key){
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
  __mfSyncMarketGridV238();

  // This is the actual visible sort: filteredRows() now calls the V238 sorter,
  // and the keyed reconciler MOVES existing cards instead of rebuilding them.
  __mfReconcileVisibleCardsV183();

  for(const card of document.querySelectorAll('.flow-token[data-mint]')){
    const mint=String(card.dataset.mint||'').trim();
    if(mint)__mfPatchMutableCardV17(mint);
  }

  __mfDecorateMarketCardsV238();
}

async function __mfWaitForStructureLaneV238(){
  for(let index=0;index<20;index++){
    if(typeof __mfStructureLoadingV18==='undefined'||!__mfStructureLoadingV18){
      return;
    }
    await new Promise(resolve=>setTimeout(resolve,50));
  }
}

async function __mfApplyMarketTimeframeV238(next){
  next=String(next||'').toLowerCase();
  if(!__MF_MARKET_TIMEFRAMES_V235.has(next))return;
  if(__mfMarketUiBusyV238)return;

  __mfMarketTimeframeV235=next;
  __mfSaveMarketUiV235();
  state.page=1;

  __mfMarketUiBusyV238=true;
  __mfSyncMarketGridV238();

  try{
    await __mfWaitForStructureLaneV238();

    if(typeof __mfLoadStructureV18==='function'){
      await __mfLoadStructureV18();
    }

    // Refresh mounted cards immediately in the same selected window.
    if(typeof loadTokens==='function'){
      await loadTokens();
    }

    __mfReconcileVisibleCardsV183();

    for(const card of document.querySelectorAll('.flow-token[data-mint]')){
      const mint=String(card.dataset.mint||'').trim();
      if(mint)__mfPatchMutableCardV17(mint);
    }
  }finally{
    __mfMarketUiBusyV238=false;
    __mfSyncMarketGridV238();
  }
}

function __mfToggleMarketHelpV238(force){
  const button=document.getElementById('mfMarketInfoV238');
  const help=document.getElementById('mfMarketHelpV238');
  if(!button||!help)return;

  const open=typeof force==='boolean'
    ? force
    : help.hidden;

  help.hidden=!open;
  button.setAttribute('aria-expanded',open?'true':'false');
}

function __mfBindMarketGridV238(){
  const root=document.getElementById('mfMarketGridV235');
  const list=document.getElementById('tokenList');
  if(!root)return;

  if(root.dataset.mfV238Bound!=='1'){
    root.dataset.mfV238Bound='1';

    // Capture-phase handler intentionally wins over old V235/V236/V237
    // listeners so one tap causes exactly ONE state transition.
    root.addEventListener('click',(event)=>{
      const info=event.target.closest?.('#mfMarketInfoV238');
      if(info){
        event.preventDefault();
        event.stopImmediatePropagation();
        __mfToggleMarketHelpV238();
        return;
      }

      const timeframe=event.target.closest?.('[data-mf-market-timeframe]');
      if(timeframe&&root.contains(timeframe)){
        event.preventDefault();
        event.stopImmediatePropagation();
        void __mfApplyMarketTimeframeV238(timeframe.dataset.mfMarketTimeframe);
        return;
      }

      const sort=event.target.closest?.('[data-mf-market-sort]');
      if(sort&&root.contains(sort)){
        event.preventDefault();
        event.stopImmediatePropagation();
        __mfApplyMarketSortV238(String(sort.dataset.mfMarketSort||''));
      }
    },true);
  }

  if(list&&list.dataset.mfV238Bound!=='1'){
    list.dataset.mfV238Bound='1';

    list.addEventListener('click',(event)=>{
      const cell=event.target.closest?.('[data-mf-card-sort-v238]');
      if(!cell||!list.contains(cell))return;

      event.preventDefault();
      event.stopImmediatePropagation();
      __mfApplyMarketSortV238(String(cell.dataset.mfCardSortV238||''));
    },true);

    list.addEventListener('keydown',(event)=>{
      if(event.key!=='Enter'&&event.key!==' ')return;
      const cell=event.target.closest?.('[data-mf-card-sort-v238]');
      if(!cell||!list.contains(cell))return;

      event.preventDefault();
      event.stopImmediatePropagation();
      __mfApplyMarketSortV238(String(cell.dataset.mfCardSortV238||''));
    },true);

    new MutationObserver(()=>{
      queueMicrotask(__mfDecorateMarketCardsV238);
    }).observe(list,{childList:true,subtree:true});
  }

  if(document.documentElement.dataset.mfV238OutsideBound!=='1'){
    document.documentElement.dataset.mfV238OutsideBound='1';

    document.addEventListener('click',(event)=>{
      const rootNow=document.getElementById('mfMarketGridV235');
      if(rootNow&&!rootNow.contains(event.target)){
        __mfToggleMarketHelpV238(false);
      }
    });

    document.addEventListener('keydown',(event)=>{
      if(event.key==='Escape')__mfToggleMarketHelpV238(false);
    });
  }

  __mfSyncMarketGridV238();
}

if(document.readyState==='loading'){
  document.addEventListener('DOMContentLoaded',__mfBindMarketGridV238,{once:true});
}else{
  __mfBindMarketGridV238();
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
        "__mfMarketMetricValueV235"
    ]

    missing=[item for item in required if item not in js]
    if missing:
        fail("V235 market-window logic is missing: "+", ".join(missing))

    changed=False

    # ------------------------------------------------------------
    # 1) Replace the market-control HTML with the premium V238 module.
    # ------------------------------------------------------------
    market_re=re.compile(
        r'\s*<section\s+id="mfMarketGridV235"\b.*?</section>\s*',
        re.S
    )

    html,new_count=market_re.subn("\n"+MARKUP+"\n",html,count=1)

    if new_count==0:
        anchor='''    <section\n      id="tokenList"\n      class="token-list"\n    >'''
        if anchor not in html:
            fail("Could not find mfMarketGridV235 or tokenList insertion anchor")
        html=html.replace(anchor,MARKUP+"\n"+anchor,1)

    if html!=original_html:
        changed=True

    # ------------------------------------------------------------
    # 2) Make sort visibly/globally effective for non-open cards.
    #    OPEN POSITION remains pinned in canonical P&L order.
    # ------------------------------------------------------------
    sort_start=js.find("function __mfMarketApplySortV235(rows){")
    ui_marker=js.find("// MEMEFLOW_TOKEN_FLOW_MARKET_GRID_V235_UI",sort_start)

    if sort_start<0 or ui_marker<0:
        fail("Could not locate V235 sort function/UI boundary")

    sort_close=js.rfind("\n}",sort_start,ui_marker)
    if sort_close<0:
        fail("Could not locate end of V235 sort function")

    sort_end=sort_close+2
    current_sort=js[sort_start:sort_end]

    if current_sort!=NEW_SORT_FUNCTION:
        js=js[:sort_start]+NEW_SORT_FUNCTION+js[sort_end:]
        changed=True

    # ------------------------------------------------------------
    # 3) Replace all old V235/V237 UI code before token scan with ONE
    #    capture-phase V238 controller. This prevents double-click toggles.
    # ------------------------------------------------------------
    ui_start=js.find("// MEMEFLOW_TOKEN_FLOW_MARKET_GRID_V235_UI")
    scan_anchor=js.find("// MEMEFLOW_TOKEN_SCAN_V27",ui_start)

    if ui_start<0 or scan_anchor<0:
        fail("Could not locate V235 UI -> token scan range")

    old_ui=js[ui_start:scan_anchor]
    if JS_MARKER not in old_ui or old_ui.strip()!=UI_CODE.strip():
        js=js[:ui_start]+UI_CODE+"\n\n"+js[scan_anchor:]
        changed=True

    # ------------------------------------------------------------
    # 4) Last-loaded CSS wins over old V235/V236/V237 visual rules.
    # ------------------------------------------------------------
    if original_css!=CSS:
        css_path.write_text(CSS,encoding="utf-8")
        changed=True

    if HTML_MARKER not in html:
        block=(
            f'<!-- {HTML_MARKER} -->\n'
            f'<link rel="stylesheet" href="/{CSS_NAME}?v=238-20260928">\n'
            f'<!-- /{HTML_MARKER} -->\n'
        )

        idx=html.lower().rfind("</head>")
        if idx<0:
            fail("</head> not found in system-tokens.html")

        html=html[:idx]+block+html[idx:]
        changed=True

    if not changed:
        print("\n[OK] V238 is already installed. No files changed.")
        return

    # Back up BEFORE writes.
    stamp=datetime.now().strftime("%Y%m%d-%H%M%S")
    backup_dir=root/f".memeflow-token-flow-pro-sort-v238-backup-{stamp}"
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

    # Validate source syntax after patch.
    try:
        subprocess.run(["node","--check",str(js_path)],cwd=root,check=True)
    except FileNotFoundError:
        print("[WARN] node unavailable; JS syntax check skipped.")
    except subprocess.CalledProcessError:
        # Restore source files automatically if JS is invalid.
        html_path.write_text(original_html,encoding="utf-8")
        js_path.write_text(original_js,encoding="utf-8")
        if original_css is None:
            css_path.unlink(missing_ok=True)
        else:
            css_path.write_text(original_css,encoding="utf-8")
        fail("system-tokens.js syntax check failed; source files were restored. Backup: "+str(backup_dir))

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

    print("\n[OK] MEMEFLOW TOKEN FLOW PRO SORT V238 installed.")
    print(f"[BACKUP] {backup_dir}")
    print("\nV238 fixes:")
    print("  • one tap = one sort action; old duplicate listeners cannot double-toggle it")
    print("  • timeframe 1M / 5M / 15M / 1H / 6H refreshes real window data")
    print("  • VOL / TX / MC / Δ% / SCORE sort globally across non-open cards")
    print("  • OPEN POSITION remains pinned at the top in canonical P&L order")
    print("  • tap active sort again to reverse ↓ / ↑")
    print("  • shared header is one row")
    print("  • each card is one row: TOKEN | VOL | TX | MC | Δ% | SCORE")
    print("  • each numeric value sits inside a clean 0.5px metric window")
    print("  • metric windows themselves are tappable sort controls")
    print("  • info (i) opens a help panel explaining every timeframe/metric")
    print("  • scanner / entry / score calculation / trading logic are unchanged")
    print("\nNo process/server restart was performed.")
    print("\nPush after visual check:")
    print(
        f'git add memeflow-app/system-tokens.html '
        f'memeflow-app/system-tokens.js '
        f'memeflow-app/{CSS_NAME} && '
        'git commit -m "Fix Token Flow controls and premium metric cards" && git push'
    )


if __name__=="__main__":
    main()
