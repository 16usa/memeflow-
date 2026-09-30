#!/usr/bin/env python3
from pathlib import Path
from datetime import datetime
import re
import shutil
import subprocess
import sys

EXPECTED_REPO_FRAGMENT = "16usa/memeflow-"
CSS_NAME = "memeflow-token-flow-compact-sort-v242.css"
HTML_MARKER = "MEMEFLOW_TOKEN_FLOW_COMPACT_SORT_V242_ASSET"
SERVER_MARKER = "MEMEFLOW_TOKEN_FLOW_WINDOWS_V242"
CLIENT_MARKER = "MEMEFLOW_TOKEN_FLOW_COMPACT_SORT_V242"

CONTROL_HTML = r'''
    <section
      id="mfCompactSortV242"
      class="mf-compact-sort-v242"
      aria-label="Token timeframe and sorting"
    >
      <div class="mf-compact-row-v242">
        <div class="mf-timeframes-v242" aria-label="Market timeframe">
          <button type="button" data-mf-v242-timeframe="1m">1M</button>
          <button type="button" data-mf-v242-timeframe="5m">5M</button>
          <button type="button" data-mf-v242-timeframe="15m">15M</button>
          <button type="button" data-mf-v242-timeframe="1h">1H</button>
          <button type="button" data-mf-v242-timeframe="6h">6H</button>
        </div>

        <span class="mf-compact-divider-v242" aria-hidden="true"></span>

        <div class="mf-sorters-v242" aria-label="Sort tokens">
          <button type="button" data-mf-v242-sort="volume"><span>VOL</span><i></i></button>
          <button type="button" data-mf-v242-sort="transactions"><span>TX</span><i></i></button>
          <button type="button" data-mf-v242-sort="mc"><span>MC</span><i></i></button>
          <button type="button" data-mf-v242-sort="change"><span>Δ%</span><i></i></button>
          <button type="button" data-mf-v242-sort="score"><span>SCORE</span><i></i></button>
        </div>

        <button
          id="mfCompactInfoV242"
          class="mf-compact-info-v242"
          type="button"
          aria-label="Explain market metrics"
          aria-expanded="false"
          aria-controls="mfCompactHelpV242"
        >!</button>

        <div
          id="mfCompactHelpV242"
          class="mf-compact-help-v242"
          role="dialog"
          aria-label="Market metrics explanation"
          hidden
        >
          <div class="mf-help-title-v242">Market metrics</div>
          <div><b>1M–6H</b><span>Window used for VOL, TX and Δ%.</span></div>
          <div><b>VOL</b><span>Trading volume during the selected window.</span></div>
          <div><b>TX</b><span>Transactions during the selected window.</span></div>
          <div><b>MC</b><span>Current live market cap.</span></div>
          <div><b>Δ%</b><span>Price change during the selected window.</span></div>
          <div><b>SCORE</b><span>Current system score.</span></div>
          <div class="mf-help-foot-v242">Tap a metric to sort high → low. Tap it again for low → high.</div>
        </div>
      </div>
    </section>
'''

CSS = r'''/* MEMEFLOW TOKEN FLOW COMPACT SORT V242 */
body.mf-page-system-tokens{
  --mf-v242-line:#252525;
  --mf-v242-line-soft:#1b1b1b;
  --mf-v242-line-active:rgba(255,255,255,.30);
  --mf-v242-radius:13px;
  --mf-v242-cell-radius:8px;
  --mf-v242-gap:3px;
  --mf-v242-x:7px;
}

body.mf-page-system-tokens #mfCompactSortV242{
  position:relative;z-index:20;width:100%;min-width:0;margin:0;padding:0;
  border:0.5px solid var(--mf-v242-line);border-radius:var(--mf-v242-radius);
  background:#000;box-shadow:none;overflow:visible;
}
body.mf-page-system-tokens .mf-compact-row-v242{
  width:100%;min-width:0;height:42px;padding:0 6px;display:flex;align-items:center;
  gap:3px;box-sizing:border-box;white-space:nowrap;
}
body.mf-page-system-tokens .mf-timeframes-v242,
body.mf-page-system-tokens .mf-sorters-v242{min-width:0;display:flex;align-items:center;gap:2px;}
body.mf-page-system-tokens .mf-timeframes-v242{flex:0 1 auto;}
body.mf-page-system-tokens .mf-sorters-v242{flex:1 1 auto;justify-content:space-between;}
body.mf-page-system-tokens .mf-compact-divider-v242{
  width:0.5px;height:19px;flex:0 0 0.5px;margin:0 2px;background:var(--mf-v242-line);
}
body.mf-page-system-tokens .mf-timeframes-v242 button,
body.mf-page-system-tokens .mf-sorters-v242 button,
body.mf-page-system-tokens #mfCompactInfoV242{
  margin:0;padding:0;border:0.5px solid transparent;background:transparent;background-image:none;
  box-shadow:none;color:inherit;font:inherit;cursor:pointer;touch-action:manipulation;
  -webkit-tap-highlight-color:transparent;
}
body.mf-page-system-tokens .mf-timeframes-v242 button{
  min-width:29px;height:30px;padding-inline:4px;border-radius:8px;opacity:.44;
}
body.mf-page-system-tokens .mf-timeframes-v242 button.is-active{
  opacity:1;border-color:var(--mf-v242-line-active);
}
body.mf-page-system-tokens #mfCompactSortV242.is-loading .mf-timeframes-v242 button.is-active{opacity:.62;}
body.mf-page-system-tokens .mf-sorters-v242 button{
  min-width:27px;height:30px;padding-inline:3px;border-radius:8px;opacity:.48;
  display:inline-flex;align-items:center;justify-content:center;gap:2px;
}
body.mf-page-system-tokens .mf-sorters-v242 button[data-mf-v242-sort="volume"]{min-width:34px;}
body.mf-page-system-tokens .mf-sorters-v242 button[data-mf-v242-sort="score"]{min-width:42px;}
body.mf-page-system-tokens .mf-sorters-v242 button.is-active{opacity:1;border-color:var(--mf-v242-line-active);}
body.mf-page-system-tokens .mf-sorters-v242 button i{width:6px;min-width:6px;font-style:normal;opacity:0;}
body.mf-page-system-tokens .mf-sorters-v242 button.is-active i{opacity:.9;}
body.mf-page-system-tokens #mfCompactInfoV242{
  width:26px;height:26px;min-width:26px;min-height:26px;flex:0 0 26px;display:grid;place-items:center;
  border-color:var(--mf-v242-line);border-radius:50%;opacity:.68;
}
body.mf-page-system-tokens #mfCompactInfoV242[aria-expanded="true"]{opacity:1;border-color:var(--mf-v242-line-active);}
body.mf-page-system-tokens .mf-compact-help-v242{
  position:absolute;z-index:200;top:36px;right:5px;width:min(330px,calc(100vw - 42px));padding:12px;
  display:grid;gap:8px;border:0.5px solid var(--mf-v242-line-active);border-radius:12px;
  background:#050505;box-shadow:0 14px 34px rgba(0,0,0,.52);
}
body.mf-page-system-tokens .mf-compact-help-v242[hidden]{display:none;}
body.mf-page-system-tokens .mf-compact-help-v242 > div:not(.mf-help-title-v242):not(.mf-help-foot-v242){
  display:grid;grid-template-columns:50px minmax(0,1fr);gap:8px;
}
body.mf-page-system-tokens .mf-help-title-v242{padding-bottom:7px;border-bottom:0.5px solid var(--mf-v242-line);}
body.mf-page-system-tokens .mf-help-foot-v242{padding-top:7px;border-top:0.5px solid var(--mf-v242-line);opacity:.64;}

body.mf-page-system-tokens .token-list > .flow-token{
  min-height:82px !important;display:grid !important;
  grid-template-columns:minmax(0,2.15fr) minmax(0,.88fr) minmax(0,.59fr) minmax(0,.94fr) minmax(0,.78fr) minmax(0,.56fr) !important;
  grid-template-rows:minmax(0,1fr) !important;column-gap:var(--mf-v242-gap) !important;row-gap:0 !important;
  padding:8px var(--mf-v242-x) !important;align-items:center !important;
}
body.mf-page-system-tokens .token-list > .flow-token > .token-primary{
  grid-column:1 !important;grid-row:1 !important;min-width:0 !important;width:100% !important;
}
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
body.mf-page-system-tokens .token-list > .flow-token > :is(.mf-score-slot,.mf-open-pnl-slot){grid-column:6 !important;grid-row:1 !important;}
body.mf-page-system-tokens .token-list > .flow-token > :is(.mf-open-market-strip,.mf-regular-market-strip) > :is(.mf-open-market-stat,.mf-regular-market-stat):nth-child(n+3) > span,
body.mf-page-system-tokens .token-list > .flow-token > .mf-score-slot > span{display:none !important;}
body.mf-page-system-tokens .token-list > .flow-token > :is(.mf-open-market-strip,.mf-regular-market-strip) > :is(.mf-open-market-stat,.mf-regular-market-stat):nth-child(n+3),
body.mf-page-system-tokens .token-list > .flow-token > .mf-score-slot,
body.mf-page-system-tokens .token-list > .flow-token > .mf-open-pnl-slot{
  min-width:0 !important;width:100% !important;min-height:42px !important;margin:0 !important;padding:0 2px !important;
  display:flex !important;flex-direction:column !important;align-items:center !important;justify-content:center !important;
  border:0.5px solid var(--mf-v242-line-soft) !important;border-radius:var(--mf-v242-cell-radius) !important;
  background:transparent !important;box-shadow:none !important;text-align:center !important;box-sizing:border-box !important;
}
body.mf-page-system-tokens .token-list > .flow-token > :is(.mf-open-market-strip,.mf-regular-market-strip) > :is(.mf-open-market-stat,.mf-regular-market-stat):nth-child(n+3) > strong,
body.mf-page-system-tokens .token-list > .flow-token > .mf-score-slot > strong{
  width:100% !important;min-width:0 !important;margin:0 !important;text-align:center !important;white-space:nowrap !important;
  overflow:hidden !important;text-overflow:ellipsis !important;font-variant-numeric:tabular-nums !important;
}
body.mf-page-system-tokens .token-list > .flow-token .token-details{grid-column:1 / -1 !important;grid-row:2 !important;}

@media(max-width:390px){
  body.mf-page-system-tokens{--mf-v242-x:6px;--mf-v242-gap:2px;}
  body.mf-page-system-tokens .mf-compact-row-v242{padding-inline:4px;gap:2px;}
  body.mf-page-system-tokens .mf-timeframes-v242,body.mf-page-system-tokens .mf-sorters-v242{gap:1px;}
  body.mf-page-system-tokens .mf-timeframes-v242 button{min-width:27px;padding-inline:3px;}
  body.mf-page-system-tokens .mf-sorters-v242 button{min-width:25px;padding-inline:2px;}
  body.mf-page-system-tokens .mf-sorters-v242 button[data-mf-v242-sort="volume"]{min-width:31px;}
  body.mf-page-system-tokens .mf-sorters-v242 button[data-mf-v242-sort="score"]{min-width:38px;}
  body.mf-page-system-tokens #mfCompactInfoV242{width:24px;height:24px;min-width:24px;min-height:24px;flex-basis:24px;}
  body.mf-page-system-tokens .token-list > .flow-token{
    grid-template-columns:minmax(0,2.05fr) minmax(0,.90fr) minmax(0,.56fr) minmax(0,.96fr) minmax(0,.76fr) minmax(0,.55fr) !important;
  }
}
'''

SERVER_HELPER = r'''
// MEMEFLOW_TOKEN_FLOW_WINDOWS_V242
const __MF_TOKEN_FLOW_WINDOWS_V242={
  '1m':60_000,'5m':300_000,'15m':900_000,'1h':3_600_000,'6h':21_600_000
};

function __mfTokenFlowWindowV242(mint,token,timeframe='5m',now=Date.now()){
  const tf=Object.prototype.hasOwnProperty.call(__MF_TOKEN_FLOW_WINDOWS_V242,String(timeframe||'').toLowerCase())
    ? String(timeframe).toLowerCase() : '5m';
  const windowMs=__MF_TOKEN_FLOW_WINDOWS_V242[tf];
  const cutoff=now-windowMs;
  const finiteLocal=value=>{
    if(value===null||value===undefined||value==='')return null;
    const n=Number(value);return Number.isFinite(n)?n:null;
  };

  let points=Array.isArray(chartTradeHistory.get(mint))?chartTradeHistory.get(mint).slice():[];
  points=__mfQuoteSafeChartPointsV14(mint,points)
    .filter(point=>{const at=finiteLocal(point?.t);return at!==null&&at>0&&at<=now+30_000;})
    .sort((a,b)=>Number(a.t)-Number(b.t));

  const earliestHot=points.length?finiteLocal(points[0]?.t):null;
  if(earliestHot===null||earliestHot>cutoff+30_000){
    try{
      const merged=__mfQuoteSafeChartPointsV14(mint,__mfChartArchive.mergePointsSync(mint,points)||[]);
      if(Array.isArray(merged)){
        points=merged
          .filter(point=>{const at=finiteLocal(point?.t);return at!==null&&at>0&&at<=now+30_000;})
          .sort((a,b)=>Number(a.t)-Number(b.t));
      }
    }catch{}
  }

  const snapshot=liveCardMarketSnapshot({token:token||{},points,solUsd:solUsdOracle.get(),now,windowMs});
  let createdAt=finiteLocal(token?.createdAt??token?.discoveredAt??token?.firstSeenAt);
  if(createdAt!==null&&createdAt>0&&createdAt<1e12)createdAt*=1000;
  const earliest=points.length?finiteLocal(points[0]?.t):null;
  let coverageComplete=false;
  if(earliest!==null){
    coverageComplete=(createdAt!==null&&createdAt>=cutoff)
      ? earliest<=createdAt+120_000
      : earliest<=cutoff+30_000;
  }

  return {
    mint,timeframe:tf,coverageComplete,
    volumeSol:coverageComplete?finiteLocal(snapshot?.volume5mSol):null,
    volumeUsd:coverageComplete?finiteLocal(snapshot?.volume5mUsd):null,
    transactions:coverageComplete?finiteLocal(snapshot?.transactions5m):null,
    changePct:coverageComplete?finiteLocal(snapshot?.priceChange5mPct):null,
    marketCapSol:finiteLocal(snapshot?.marketCapSol),
    marketCapUsd:finiteLocal(snapshot?.marketCapUsd),
    marketCapSource:snapshot?.marketCapSource||null,
    snapshotAt:now
  };
}
'''

SERVER_ROUTE = r'''
 // MEMEFLOW_TOKEN_FLOW_WINDOW_BATCH_V242
 if(url.pathname==='/api/system/token-flow-window-batch'&&req.method==='POST'){
  let _body={};
  try{_body=await body(req);}catch{return json(res,400,{error:'INVALID_JSON'});}
  const _tfRaw=String(_body?.timeframe||'5m').trim().toLowerCase();
  const _timeframe=Object.prototype.hasOwnProperty.call(__MF_TOKEN_FLOW_WINDOWS_V242,_tfRaw)?_tfRaw:'5m';
  const _requested=Array.isArray(_body?.mints)?_body.mints:[];
  const _mints=[];const _seen=new Set();
  for(const _raw of _requested){
    const _mint=String(_raw||'').trim();if(!_mint||_seen.has(_mint))continue;
    _seen.add(_mint);_mints.push(_mint);if(_mints.length>=200)break;
  }
  const _rows=[];let _processed=0;
  for(const _mint of _mints){
    const _token=store.state.tokens?.[_mint]||null;if(!_token)continue;
    try{_rows.push(__mfTokenFlowWindowV242(_mint,_token,_timeframe,Date.now()));}
    catch{_rows.push({mint:_mint,timeframe:_timeframe,coverageComplete:false,volumeSol:null,volumeUsd:null,transactions:null,changePct:null,marketCapSol:null,marketCapUsd:null,marketCapSource:null,snapshotAt:Date.now()});}
    _processed++;if(_processed%20===0)await __mfYieldToEventLoop();
  }
  return json(res,200,{rows:_rows,timeframe:_timeframe,requested:_mints.length,returned:_rows.length,source:'token-flow-window-batch-v242',snapshotAt:Date.now()});
 }

'''

CLIENT_CODE = r'''
// MEMEFLOW_TOKEN_FLOW_COMPACT_SORT_V242
const __MF_TIMEFRAMES_V242=new Set(['1m','5m','15m','1h','6h']);
let __mfTimeframeV242='5m';
let __mfSortV242={key:'score',direction:'desc'};
let __mfWindowBusyV242=false;
let __mfWindowRowsV242=new Map();

function __mfBaseMetricsV242(row){return isOpenPositionRow(row)?openPositionMetrics(row):regularMarketMetrics(row);}
function __mfMetricsV242(row){
  const base=__mfBaseMetricsV242(row);
  if(__mfTimeframeV242==='5m')return base;
  const windowRow=__mfWindowRowsV242.get(String(row?.mint||''));
  return {...base,
    volume5mSol:windowRow?.coverageComplete===true?windowRow?.volumeSol:null,
    volume5mUsd:windowRow?.coverageComplete===true?windowRow?.volumeUsd:null,
    transactions5m:windowRow?.coverageComplete===true?windowRow?.transactions:null,
    priceChange5mPct:windowRow?.coverageComplete===true?windowRow?.changePct:null,
    marketCapSol:finite(windowRow?.marketCapSol)?windowRow.marketCapSol:base?.marketCapSol,
    marketCapUsd:finite(windowRow?.marketCapUsd)?windowRow.marketCapUsd:base?.marketCapUsd,
    marketCapSource:windowRow?.marketCapSource||base?.marketCapSource
  };
}
function __mfSortValueV242(row,key){
  if(key==='score'){const v=row?.decision?.score??row?.score;return finite(v)?Number(v):null;}
  const m=__mfMetricsV242(row);
  if(key==='volume'){const v=m?.volume5mUsd??m?.volume5mSol;return finite(v)?Number(v):null;}
  if(key==='transactions')return finite(m?.transactions5m)?Number(m.transactions5m):null;
  if(key==='mc'){const v=m?.marketCapUsd??m?.marketCapSol;return finite(v)?Number(v):null;}
  if(key==='change')return finite(m?.priceChange5mPct)?Number(m.priceChange5mPct):null;
  return null;
}
function __mfSortRowsV242(rows){
  const source=Array.isArray(rows)?rows.slice():[];const open=[];const rest=[];
  source.forEach((row,index)=>{(stateKey(row?.decision?.state)==='open'?open:rest).push({row,index});});
  const key=__mfSortV242.key;const dir=__mfSortV242.direction==='asc'?1:-1;
  rest.sort((a,b)=>{
    const av=__mfSortValueV242(a.row,key),bv=__mfSortValueV242(b.row,key);const ak=finite(av),bk=finite(bv);
    if(ak&&!bk)return -1;if(!ak&&bk)return 1;if(ak&&bk&&Number(av)!==Number(bv))return dir*(Number(av)-Number(bv));
    return a.index-b.index;
  });
  return [...open.map(x=>x.row),...rest.map(x=>x.row)];
}
const __mfFilteredRowsBeforeV242=filteredRows;
filteredRows=function(){return __mfSortRowsV242(__mfFilteredRowsBeforeV242());};

function __mfSyncControlsV242(){
  const root=document.getElementById('mfCompactSortV242');if(!root)return;
  root.classList.toggle('is-loading',__mfWindowBusyV242);
  root.querySelectorAll('[data-mf-v242-timeframe]').forEach(button=>{
    const active=String(button.dataset.mfV242Timeframe||'')===__mfTimeframeV242;
    button.classList.toggle('is-active',active);button.setAttribute('aria-pressed',active?'true':'false');
  });
  root.querySelectorAll('[data-mf-v242-sort]').forEach(button=>{
    const active=String(button.dataset.mfV242Sort||'')===__mfSortV242.key;
    button.classList.toggle('is-active',active);button.setAttribute('aria-pressed',active?'true':'false');
    const arrow=button.querySelector('i');if(arrow)arrow.textContent=active?(__mfSortV242.direction==='asc'?'↑':'↓'):'';
  });
}
function __mfRowByMintV242(mint){return mergedRows().find(row=>String(row?.mint||'')===String(mint||''))||null;}
function __mfPatchCardWindowV242(card){
  if(!card)return;const mint=String(card.dataset.mint||'').trim();if(!mint)return;
  const row=__mfRowByMintV242(mint);if(!row)return;const metrics=__mfMetricsV242(row);
  const strip=card.querySelector('.mf-regular-market-strip,.mf-open-market-strip');if(!strip)return;
  const cells=[...strip.querySelectorAll('.mf-regular-market-stat,.mf-open-market-stat')];
  const volume=cells[2]?.querySelector('strong'),tx=cells[3]?.querySelector('strong'),mc=cells[4]?.querySelector('strong'),change=cells[5]?.querySelector('strong');
  if(volume)volume.textContent=isOpenPositionRow(row)?openVolumeLabel(metrics):regularVolumeLabel(metrics);
  if(tx)tx.textContent=finite(metrics?.transactions5m)?fmt(metrics.transactions5m,0):'—';
  if(mc)mc.textContent=isOpenPositionRow(row)?openMarketCapLabel(metrics):regularMarketCapLabel(metrics);
  if(change){change.textContent=signedPercent(metrics?.priceChange5mPct);change.classList.remove('is-profit','is-loss','is-flat');change.classList.add(marketMoveClass(metrics?.priceChange5mPct));}
}
function __mfPatchAllCardsV242(){document.querySelectorAll('.flow-token[data-mint]').forEach(__mfPatchCardWindowV242);}

async function __mfFetchWindowV242({rerender=true}={}){
  if(__mfTimeframeV242==='5m'){
    __mfWindowRowsV242.clear();if(rerender){render();queueMicrotask(__mfPatchAllCardsV242);}return true;
  }
  if(__mfWindowBusyV242)return false;
  const mints=[...new Set(mergedRows().map(row=>String(row?.mint||'').trim()).filter(Boolean))].slice(0,200);
  if(!mints.length)return false;
  __mfWindowBusyV242=true;__mfSyncControlsV242();
  try{
    const payload=await __mfPostJsonV18('/api/system/token-flow-window-batch',{mints,timeframe:__mfTimeframeV242},{timeoutMs:8000});
    const rows=Array.isArray(payload?.rows)?payload.rows:[];
    __mfWindowRowsV242=new Map(rows.filter(row=>row?.mint).map(row=>[String(row.mint),row]));
    if(rerender){state.page=1;render();queueMicrotask(__mfPatchAllCardsV242);}else __mfPatchAllCardsV242();
    return true;
  }catch(error){
    console.warn('[token-flow-v242] window fetch failed',error);__mfWindowRowsV242.clear();
    if(rerender){render();queueMicrotask(__mfPatchAllCardsV242);}return false;
  }finally{__mfWindowBusyV242=false;__mfSyncControlsV242();}
}
async function __mfSetTimeframeV242(next){
  next=String(next||'').toLowerCase();if(!__MF_TIMEFRAMES_V242.has(next)||next===__mfTimeframeV242)return;
  __mfTimeframeV242=next;__mfWindowRowsV242.clear();__mfSyncControlsV242();
  if(next==='5m'){state.page=1;render();queueMicrotask(__mfPatchAllCardsV242);return;}
  await __mfFetchWindowV242({rerender:true});
}
function __mfSetSortV242(key){
  if(!['volume','transactions','mc','change','score'].includes(key))return;
  __mfSortV242=__mfSortV242.key===key?{key,direction:__mfSortV242.direction==='desc'?'asc':'desc'}:{key,direction:'desc'};
  state.page=1;render();__mfSyncControlsV242();queueMicrotask(__mfPatchAllCardsV242);
}
function __mfToggleHelpV242(force){
  const help=document.getElementById('mfCompactHelpV242'),button=document.getElementById('mfCompactInfoV242');if(!help||!button)return;
  const open=typeof force==='boolean'?force:help.hidden;help.hidden=!open;button.setAttribute('aria-expanded',open?'true':'false');
}
function __mfBindCompactSortV242(){
  const root=document.getElementById('mfCompactSortV242');if(!root||root.dataset.bound==='1'){__mfSyncControlsV242();return;}
  root.dataset.bound='1';root.addEventListener('click',event=>{
    const info=event.target.closest?.('#mfCompactInfoV242');if(info){event.preventDefault();event.stopPropagation();__mfToggleHelpV242();return;}
    const tf=event.target.closest?.('[data-mf-v242-timeframe]');if(tf){event.preventDefault();event.stopPropagation();void __mfSetTimeframeV242(tf.dataset.mfV242Timeframe);return;}
    const sort=event.target.closest?.('[data-mf-v242-sort]');if(sort){event.preventDefault();event.stopPropagation();__mfSetSortV242(String(sort.dataset.mfV242Sort||''));}
  });__mfSyncControlsV242();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{__mfBindCompactSortV242();queueMicrotask(__mfPatchAllCardsV242);},{once:true});
else{__mfBindCompactSortV242();queueMicrotask(__mfPatchAllCardsV242);}
setInterval(()=>{if(__mfTimeframeV242==='5m'){__mfPatchAllCardsV242();return;}void __mfFetchWindowV242({rerender:false});},10_000);
document.addEventListener('click',event=>{const root=document.getElementById('mfCompactSortV242');if(root&&!root.contains(event.target))__mfToggleHelpV242(false);});
document.addEventListener('keydown',event=>{if(event.key==='Escape')__mfToggleHelpV242(false);});
'''

def fail(msg):
    print(f"\n[FAIL] {msg}")
    sys.exit(1)

def find_function_span(text,name):
    match=re.search(rf'\bfunction\s+{re.escape(name)}\s*\([^)]*\)\s*\{{',text)
    if not match:return None
    start=match.start();brace=text.find('{',match.start())
    depth=0;quote=None;escaped=False;line_comment=False;block_comment=False;i=brace
    while i<len(text):
        ch=text[i];nxt=text[i+1] if i+1<len(text) else ''
        if line_comment:
            if ch=='\n':line_comment=False
            i+=1;continue
        if block_comment:
            if ch=='*' and nxt=='/':block_comment=False;i+=2;continue
            i+=1;continue
        if quote is not None:
            if escaped:escaped=False;i+=1;continue
            if ch=='\\':escaped=True;i+=1;continue
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

def latest_good_v235_backup(root):
    candidates=sorted(root.glob('.memeflow-token-flow-market-grid-v235-backup-*'),reverse=True)
    required=[Path('memeflow-app/app-server.mjs'),Path('memeflow-app/system-tokens.js'),Path('memeflow-app/system-tokens.html')]
    for candidate in candidates:
        if all((candidate/item).is_file() for item in required):return candidate
    return None

def remove_legacy_market_assets(html):
    names=[
      'memeflow-token-flow-market-grid-v235.css','memeflow-token-flow-sort-ui-fix-v236.css','memeflow-token-flow-sort-bar-fix-v236.css',
      'memeflow-token-flow-one-row-sort-v237.css','memeflow-token-flow-pro-sort-v238.css','memeflow-token-flow-final-controls-v239.css',
      'memeflow-token-flow-control-cleanup-v240.css','memeflow-token-flow-repair-v241.css',CSS_NAME
    ]
    for name in names:
        html=re.sub(rf'[ \t]*<link\b[^>]*href=["\'][^"\']*{re.escape(name)}[^"\']*["\'][^>]*>\s*','',html,flags=re.I)
    html=re.sub(r'[ \t]*<!--\s*/?MEMEFLOW_TOKEN_FLOW_(?:MARKET_GRID_V235|SORT_UI_FIX_V236|SORT_BAR_FIX_V236|ONE_ROW_SORT_V237|PRO_SORT_V238|FINAL_CONTROLS_V239|CONTROL_CLEANUP_V240|REPAIR_V241|COMPACT_SORT_V242)_ASSET\s*-->\s*','',html,flags=re.I)
    return html

def main():
    root=Path.cwd();app=root/'memeflow-app'
    if not app.is_dir() and root.name=='memeflow-app':app=root;root=app.parent
    if not app.is_dir():fail('memeflow-app not found. Run from the existing Replit workspace Shell.')
    try:origin=subprocess.check_output(['git','config','--get','remote.origin.url'],cwd=root,text=True,stderr=subprocess.DEVNULL).strip()
    except Exception:origin=''
    if origin and EXPECTED_REPO_FRAGMENT not in origin:fail(f'Unexpected git origin: {origin}')

    current_paths={'server':app/'app-server.mjs','js':app/'system-tokens.js','html':app/'system-tokens.html'}
    for path in current_paths.values():
        if not path.is_file():fail(f'Missing required file: {path}')

    good_backup=latest_good_v235_backup(root)
    if good_backup is None:fail('Pre-V235 known-good backup was not found. Nothing was changed.')

    server=(good_backup/'memeflow-app/app-server.mjs').read_text(encoding='utf-8')
    js=(good_backup/'memeflow-app/system-tokens.js').read_text(encoding='utf-8')
    html=(good_backup/'memeflow-app/system-tokens.html').read_text(encoding='utf-8')
    if 'MEMEFLOW_TOKEN_FLOW_MARKET_GRID_V235' in js:fail(f'Backup {good_backup.name} already contains V235 client code. Nothing was changed.')

    if SERVER_MARKER not in server:
        anchor='// MEMEFLOW_REALTIME_UI_FAIRNESS_V1'
        if anchor not in server:fail('Server helper anchor not found in known-good backup.')
        server=server.replace(anchor,SERVER_HELPER+'\n\n'+anchor,1)
    if 'MEMEFLOW_TOKEN_FLOW_WINDOW_BATCH_V242' not in server:
        anchor='// MEMEFLOW_LIVE_CARD_BATCH_V18'
        if anchor not in server:fail('Server route anchor not found in known-good backup.')
        server=server.replace(anchor,SERVER_ROUTE+'\n '+anchor,1)

    for fn in ('filteredRows','render','regularMarketMetrics','openPositionMetrics','mergedRows'):
        if find_function_span(js,fn) is None:fail(f'Required client function not found: {fn}. Nothing was changed.')
    anchor='// MEMEFLOW_TOKEN_SCAN_V27'
    if anchor not in js:fail('Client insertion anchor not found in known-good backup.')
    js=js.replace(anchor,CLIENT_CODE+'\n\n'+anchor,1)

    html=remove_legacy_market_assets(html)
    token_anchor=re.search(r'<section\b(?=[^>]*\bid\s*=\s*["\']tokenList["\'])[^>]*>',html,flags=re.I|re.S)
    if not token_anchor:fail('tokenList section not found in known-good backup.')
    html=html[:token_anchor.start()]+CONTROL_HTML+'\n'+html[token_anchor.start():]
    head_end=html.lower().rfind('</head>')
    if head_end<0:fail('</head> not found in known-good backup.')
    link=f'<!-- {HTML_MARKER} -->\n<link rel="stylesheet" href="/{CSS_NAME}?v=242-20260928">\n<!-- /{HTML_MARKER} -->\n'
    html=html[:head_end]+link+html[head_end:]

    if html.count('id="mfCompactSortV242"')!=1:fail('Internal validation: compact control is not unique.')
    if js.count(CLIENT_MARKER)!=1:fail('Internal validation: V242 client marker is not unique.')
    if server.count(SERVER_MARKER)!=1:fail('Internal validation: V242 server helper marker is not unique.')

    tmp_dir=root/'.memeflow-v242-check';tmp_dir.mkdir(exist_ok=True)
    tmp_server=tmp_dir/'app-server.mjs';tmp_js=tmp_dir/'system-tokens.js'
    tmp_server.write_text(server,encoding='utf-8');tmp_js.write_text(js,encoding='utf-8')
    try:
        subprocess.run(['node','--check',str(tmp_server)],cwd=root,check=True,stdout=subprocess.DEVNULL)
        subprocess.run(['node','--check',str(tmp_js)],cwd=root,check=True,stdout=subprocess.DEVNULL)
    except FileNotFoundError:print('[WARN] node unavailable; JS syntax check skipped.')
    except subprocess.CalledProcessError:fail('V242 JavaScript syntax validation failed. Project files were NOT changed.')
    finally:shutil.rmtree(tmp_dir,ignore_errors=True)

    stamp=datetime.now().strftime('%Y%m%d-%H%M%S');current_backup=root/f'.memeflow-token-flow-before-v242-{stamp}';current_backup.mkdir(parents=True,exist_ok=False)
    for path in current_paths.values():
        target=current_backup/path.relative_to(root);target.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(path,target)

    css_path=app/CSS_NAME;css_path.write_text(CSS,encoding='utf-8')
    current_paths['server'].write_text(server,encoding='utf-8');current_paths['js'].write_text(js,encoding='utf-8');current_paths['html'].write_text(html,encoding='utf-8')
    try:
        subprocess.run(['node','--check',str(current_paths['server'])],cwd=root,check=True)
        subprocess.run(['node','--check',str(current_paths['js'])],cwd=root,check=True)
    except Exception as exc:
        for path in current_paths.values():shutil.copy2(current_backup/path.relative_to(root),path)
        fail(f'Final syntax check failed; pre-V242 worktree was restored. Error: {exc}')

    try:subprocess.run(['git','diff','--check','--','memeflow-app/app-server.mjs','memeflow-app/system-tokens.js','memeflow-app/system-tokens.html',f'memeflow-app/{CSS_NAME}'],cwd=root,check=True)
    except Exception:print('[WARN] git diff --check reported an issue; inspect git diff before push.')

    print('\n[OK] MEMEFLOW TOKEN FLOW RECOVER + COMPACT SORT V242 installed.')
    print(f'[RESTORED BASE] {good_backup}')
    print(f'[CURRENT STATE BACKUP] {current_backup}')
    print('\nV242:')
    print('  • restored the known-good pre-V235 live token feed first')
    print('  • live-token-states route is untouched')
    print('  • separate read-only endpoint handles 1M/15M/1H/6H display metrics')
    print('  • one compact line: 1M 5M 15M 1H 6H | VOL TX MC Δ% SCORE !')
    print('  • TOKEN heading removed')
    print('  • sort is immediate; second tap reverses ↑/↓')
    print('  • OPEN POSITION stays pinned above sorted non-open rows')
    print('  • cards use one aligned metric row with subtle 0.5px value windows')
    print('  • optional timeframe failure can never blank the base token list')
    print('  • trading / Entry / Score / scanner logic unchanged')
    print('\nNo process/server restart was performed.')
    print('\nAfter visual/function check, push:')
    print(f'git add memeflow-app/app-server.mjs memeflow-app/system-tokens.js memeflow-app/system-tokens.html memeflow-app/{CSS_NAME} && git commit -m "Recover Token Flow and add compact market sorting" && git push')

if __name__=='__main__':main()
