#!/usr/bin/env python3
from pathlib import Path
from datetime import datetime
import re
import subprocess
import sys

EXPECTED_REPO_FRAGMENT = "16usa/memeflow-"
CSS_NAME = "memeflow-token-flow-market-grid-v235.css"
HTML_MARKER = "MEMEFLOW_TOKEN_FLOW_MARKET_GRID_V235_ASSET"
SERVER_MARKER = "MEMEFLOW_TOKEN_FLOW_MARKET_WINDOWS_V235"
CLIENT_MARKER = "MEMEFLOW_TOKEN_FLOW_MARKET_GRID_V235"

CSS = r'''/* MEMEFLOW TOKEN FLOW MARKET GRID V235
   One shared metric header for all token cards + real TradeEvent time windows.
   Keeps the existing text sizes/colors of the page except for control-state opacity.
*/

body.mf-page-system-tokens{
  --mf-v235-line:#252525;
  --mf-v235-radius:14px;
  --mf-v235-row-x:10px;
  --mf-v235-col-gap:7px;
}

/* =========================
   MARKET WINDOW + COLUMN HEAD
   ========================= */
body.mf-page-system-tokens .mf-market-grid-v235{
  width:100%;
  min-width:0;
  margin:0;
  overflow:hidden;
  border:0.5px solid var(--mf-v235-line);
  border-radius:var(--mf-v235-radius);
  background:#000;
  box-shadow:none;
}

body.mf-page-system-tokens .mf-market-window-v235{
  min-height:40px;
  padding:0 12px;
  display:flex;
  align-items:center;
  justify-content:flex-start;
  gap:20px;
  border-bottom:0.5px solid var(--mf-v235-line);
  background:#000;
}

body.mf-page-system-tokens .mf-market-window-v235 button{
  position:relative;
  min-width:0;
  min-height:40px;
  margin:0;
  padding:0;
  border:0;
  border-radius:0;
  background:transparent;
  box-shadow:none;
  color:inherit;
  font:inherit;
  opacity:.46;
  cursor:pointer;
  -webkit-tap-highlight-color:transparent;
}

body.mf-page-system-tokens .mf-market-window-v235 button::after{
  content:"";
  position:absolute;
  right:0;
  bottom:0;
  left:0;
  height:1px;
  transform:scaleX(0);
  transform-origin:center;
  background:currentColor;
  opacity:.82;
}

body.mf-page-system-tokens .mf-market-window-v235 button.is-active{
  opacity:1;
}

body.mf-page-system-tokens .mf-market-window-v235 button.is-active::after{
  transform:scaleX(1);
}

body.mf-page-system-tokens .mf-market-columns-v235{
  width:100%;
  min-width:0;
  min-height:42px;
  padding:6px var(--mf-v235-row-x);
  display:grid;
  grid-template-columns:
    minmax(0,2.58fr)
    minmax(45px,.74fr)
    minmax(49px,.80fr)
    minmax(43px,.64fr);
  grid-template-rows:1fr 1fr;
  column-gap:var(--mf-v235-col-gap);
  row-gap:0;
  align-items:center;
  background:#000;
  box-sizing:border-box;
}

body.mf-page-system-tokens .mf-market-token-head-v235{
  grid-column:1;
  grid-row:1 / span 2;
  min-width:0;
  padding-left:50px;
  align-self:center;
  opacity:.48;
}

body.mf-page-system-tokens .mf-market-head-v235{
  position:relative;
  width:100%;
  height:100%;
  min-width:0;
  margin:0;
  padding:0;
  display:flex;
  align-items:center;
  justify-content:flex-start;
  gap:4px;
  border:0;
  border-radius:0;
  background:transparent;
  box-shadow:none;
  color:inherit;
  font:inherit;
  text-align:left;
  opacity:.48;
  cursor:pointer;
  -webkit-tap-highlight-color:transparent;
}

body.mf-page-system-tokens .mf-market-head-v235[data-mf-market-sort="volume"]{grid-column:2;grid-row:1;}
body.mf-page-system-tokens .mf-market-head-v235[data-mf-market-sort="transactions"]{grid-column:2;grid-row:2;}
body.mf-page-system-tokens .mf-market-head-v235[data-mf-market-sort="mc"]{grid-column:3;grid-row:1;}
body.mf-page-system-tokens .mf-market-head-v235[data-mf-market-sort="change"]{grid-column:3;grid-row:2;}
body.mf-page-system-tokens .mf-market-head-v235[data-mf-market-sort="score"]{grid-column:4;grid-row:1 / span 2;align-self:stretch;}

body.mf-page-system-tokens .mf-market-head-v235.is-active{
  opacity:1;
}

body.mf-page-system-tokens .mf-market-sort-arrow-v235{
  display:inline-block;
  min-width:8px;
  opacity:0;
}

body.mf-page-system-tokens .mf-market-head-v235.is-active .mf-market-sort-arrow-v235{
  opacity:.8;
}

/* =========================
   CARD VALUES ONLY
   Repeated VOL/TX/MC/5m%/SCORE labels are removed from every card.
   ========================= */
body.mf-page-system-tokens .token-list > .flow-token :is(
  .mf-regular-market-stat,
  .mf-open-market-stat
) > span,
body.mf-page-system-tokens .token-list > .flow-token .mf-score-slot > span{
  display:none !important;
}

body.mf-page-system-tokens .token-list > .flow-token :is(
  .mf-regular-market-stat,
  .mf-open-market-stat,
  .mf-score-slot
) > strong{
  margin:0 !important;
  align-self:flex-start !important;
}

/* P&L stays explicitly labeled on OPEN POSITION because it is not Score. */
body.mf-page-system-tokens .token-list > .flow-token .mf-open-pnl-slot > span{
  display:block !important;
}

@media (min-width:761px){
  body.mf-page-system-tokens{
    --mf-v235-row-x:14px;
    --mf-v235-col-gap:12px;
  }

  body.mf-page-system-tokens .mf-market-columns-v235{
    grid-template-columns:
      minmax(0,2.60fr)
      minmax(68px,.82fr)
      minmax(72px,.90fr)
      minmax(58px,.68fr);
  }

  body.mf-page-system-tokens .mf-market-token-head-v235{
    padding-left:58px;
  }
}

@media (max-width:760px){
  body.mf-page-system-tokens .mf-market-window-v235{
    min-height:38px;
    padding-inline:10px;
    gap:17px;
  }

  body.mf-page-system-tokens .mf-market-window-v235 button{
    min-height:38px;
  }
}

@media (max-width:390px){
  body.mf-page-system-tokens{
    --mf-v235-row-x:8px;
    --mf-v235-col-gap:5px;
  }

  body.mf-page-system-tokens .mf-market-window-v235{
    gap:14px;
    padding-inline:8px;
  }

  body.mf-page-system-tokens .mf-market-columns-v235{
    grid-template-columns:
      minmax(0,2.62fr)
      minmax(42px,.72fr)
      minmax(46px,.78fr)
      minmax(40px,.62fr);
  }

  body.mf-page-system-tokens .mf-market-token-head-v235{
    padding-left:47px;
  }
}
'''

SERVER_HELPER = r'''
// MEMEFLOW_TOKEN_FLOW_MARKET_WINDOWS_V235
// DISPLAY ONLY. Trading admission / score / strategy remain on the canonical 5m truth.
// Other windows are calculated only from REAL Pump TradeEvent chart history.
const __MF_TOKEN_FLOW_WINDOW_MS_V235={
  '1m':60_000,
  '5m':300_000,
  '15m':900_000,
  '1h':3_600_000,
  '6h':21_600_000
};

function __mfTokenFlowWindowSnapshotV235(
  mint,
  token,
  timeframe='5m',
  baseRow=null,
  now=Date.now()
){
  const tf=Object.prototype.hasOwnProperty.call(
    __MF_TOKEN_FLOW_WINDOW_MS_V235,
    String(timeframe||'').toLowerCase()
  )
    ? String(timeframe).toLowerCase()
    : '5m';

  const windowMs=__MF_TOKEN_FLOW_WINDOW_MS_V235[tf];
  const sourceRows=Array.isArray(chartTradeHistory.get(mint))
    ? chartTradeHistory.get(mint).slice()
    : [];

  const finiteLocal=value=>{
    if(value===null||value===undefined||value==='')return null;
    const n=Number(value);
    return Number.isFinite(n)?n:null;
  };

  // The canonical row already contains the exact current 5m truth. Reuse it
  // instead of recomputing the default window from a possibly shorter hot list.
  if(tf==='5m'){
    return {
      timeframe:'5m',
      windowMs,
      available:true,
      coverageComplete:true,
      coverageStartAt:sourceRows.length?finiteLocal(sourceRows[0]?.t):null,
      volumeSol:finiteLocal(baseRow?.volume5mSol),
      volumeUsd:finiteLocal(baseRow?.volume5mUsd),
      transactions:finiteLocal(baseRow?.transactions5m),
      priceChangePct:finiteLocal(baseRow?.priceChange5mPct),
      marketCapSol:finiteLocal(baseRow?.marketCapSol),
      marketCapUsd:finiteLocal(baseRow?.marketCapUsd??baseRow?.marketCap),
      marketCapSource:baseRow?.marketCapSource||null,
      snapshotAt:now
    };
  }

  const validRows=sourceRows
    .filter(point=>{
      const t=finiteLocal(point?.t);
      return t!==null&&t>0&&t<=now+30_000;
    })
    .sort((a,b)=>Number(a.t)-Number(b.t));

  const snapshot=liveCardMarketSnapshot({
    token:token||{},
    points:validRows,
    solUsd:solUsdOracle.get(),
    now,
    windowMs
  });

  const cutoff=now-windowMs;
  const earliestAt=validRows.length
    ? finiteLocal(validRows[0]?.t)
    : null;

  let createdAt=finiteLocal(
    token?.createdAt ??
    token?.discoveredAt ??
    token?.firstSeenAt
  );
  if(createdAt!==null&&createdAt>0&&createdAt<1e12){
    createdAt*=1000;
  }

  // A window is complete when history reaches the window boundary, or when the
  // token itself was created inside that window and history reaches its launch.
  let coverageComplete=tf==='5m';
  if(tf!=='5m'&&earliestAt!==null){
    if(createdAt!==null&&createdAt>=cutoff){
      coverageComplete=earliestAt<=createdAt+120_000;
    }else{
      coverageComplete=earliestAt<=cutoff+30_000;
    }
  }

  // Price delta uses the real last trade at/before the requested boundary when
  // available. This avoids inventing candles/timer prices.
  let baselinePrice=null;
  for(const point of validRows){
    const t=finiteLocal(point?.t);
    const price=finiteLocal(point?.priceSol??point?.price);
    if(t===null||price===null||price<=0)continue;
    if(t<=cutoff){
      baselinePrice=price;
      continue;
    }
    break;
  }

  const currentPrice=
    finiteLocal(snapshot?.currentPriceSol) ??
    finiteLocal(baseRow?.priceSol) ??
    finiteLocal(baseRow?.price);

  let priceChangePct=finiteLocal(snapshot?.priceChange5mPct);
  if(
    baselinePrice!==null&&baselinePrice>0&&
    currentPrice!==null&&currentPrice>0
  ){
    priceChangePct=((currentPrice-baselinePrice)/baselinePrice)*100;
  }

  const available=coverageComplete===true;

  return {
    timeframe:tf,
    windowMs,
    available,
    coverageComplete,
    coverageStartAt:earliestAt,
    volumeSol:available?finiteLocal(snapshot?.volume5mSol):null,
    volumeUsd:available?finiteLocal(snapshot?.volume5mUsd):null,
    transactions:available?finiteLocal(snapshot?.transactions5m):null,
    priceChangePct:available?priceChangePct:null,
    // MC is current live MC; it is intentionally not a historical-window MC.
    marketCapSol:finiteLocal(baseRow?.marketCapSol),
    marketCapUsd:finiteLocal(baseRow?.marketCapUsd??baseRow?.marketCap),
    marketCapSource:baseRow?.marketCapSource||null,
    snapshotAt:now
  };
}
'''

CLIENT_HELPER = r'''
// MEMEFLOW_TOKEN_FLOW_MARKET_GRID_V235
const __MF_MARKET_TIMEFRAME_STORAGE_V235='memeflow:token-flow-market-window-v235';
const __MF_MARKET_SORT_STORAGE_V235='memeflow:token-flow-market-sort-v235';
const __MF_MARKET_TIMEFRAMES_V235=new Set(['1m','5m','15m','1h','6h']);

function __mfLoadMarketTimeframeV235(){
  try{
    const value=String(localStorage.getItem(__MF_MARKET_TIMEFRAME_STORAGE_V235)||'5m').toLowerCase();
    return __MF_MARKET_TIMEFRAMES_V235.has(value)?value:'5m';
  }catch{return '5m';}
}

function __mfLoadMarketSortV235(){
  try{
    const value=JSON.parse(localStorage.getItem(__MF_MARKET_SORT_STORAGE_V235)||'null');
    const allowed=new Set(['volume','transactions','mc','change','score']);
    return {
      key:allowed.has(value?.key)?value.key:'score',
      direction:value?.direction==='asc'?'asc':'desc'
    };
  }catch{return {key:'score',direction:'desc'};}
}

let __mfMarketTimeframeV235=__mfLoadMarketTimeframeV235();
let __mfMarketSortV235=__mfLoadMarketSortV235();

function __mfSaveMarketUiV235(){
  try{
    localStorage.setItem(__MF_MARKET_TIMEFRAME_STORAGE_V235,__mfMarketTimeframeV235);
    localStorage.setItem(__MF_MARKET_SORT_STORAGE_V235,JSON.stringify(__mfMarketSortV235));
  }catch{}
}

function __mfApplyMarketWindowToMetricsV235(row,base={}){
  const metrics={...(base||{})};
  const windowRow=row?.marketWindow;
  const matches=Boolean(
    windowRow&&
    String(windowRow.timeframe||'').toLowerCase()===__mfMarketTimeframeV235
  );

  // MC remains current. Only activity + delta are windowed.
  if(matches){
    metrics.volume5mSol=windowRow?.volumeSol??null;
    metrics.volume5mUsd=windowRow?.volumeUsd??null;
    metrics.transactions5m=windowRow?.transactions??null;
    metrics.priceChange5mPct=windowRow?.priceChangePct??null;
    metrics.marketCapSol=windowRow?.marketCapSol??metrics.marketCapSol??null;
    metrics.marketCapUsd=windowRow?.marketCapUsd??metrics.marketCapUsd??null;
    metrics.marketCapSource=windowRow?.marketCapSource??metrics.marketCapSource??null;
    metrics.marketWindowAvailable=windowRow?.available===true;
    return metrics;
  }

  // Existing canonical data is exactly 5m, so it is a valid initial fallback
  // only while 5m is selected. Never relabel 5m data as another timeframe.
  if(__mfMarketTimeframeV235==='5m'){
    metrics.marketWindowAvailable=true;
    return metrics;
  }

  metrics.volume5mSol=null;
  metrics.volume5mUsd=null;
  metrics.transactions5m=null;
  metrics.priceChange5mPct=null;
  metrics.marketWindowAvailable=false;
  return metrics;
}

function __mfMarketMetricValueV235(row,key){
  if(key==='score'){
    return finite(tokenScore(row))?Number(tokenScore(row)):null;
  }

  const metrics=stateKey(row?.decision?.state)==='open'
    ? openPositionMetrics(row)
    : regularMarketMetrics(row);

  if(key==='volume'){
    if(finite(metrics?.volume5mUsd))return Number(metrics.volume5mUsd);
    if(finite(metrics?.volume5mSol))return Number(metrics.volume5mSol);
    return null;
  }
  if(key==='transactions'){
    return finite(metrics?.transactions5m)?Number(metrics.transactions5m):null;
  }
  if(key==='mc'){
    if(finite(metrics?.marketCapUsd))return Number(metrics.marketCapUsd);
    if(finite(metrics?.marketCapSol))return Number(metrics.marketCapSol);
    return null;
  }
  if(key==='change'){
    return finite(metrics?.priceChange5mPct)?Number(metrics.priceChange5mPct):null;
  }
  return null;
}

function __mfMarketApplySortV235(rows){
  const canonical=__mfCanonicalRankV26(Array.isArray(rows)?rows:[]);
  const key=__mfMarketSortV235.key;
  const direction=__mfMarketSortV235.direction==='asc'?'asc':'desc';

  // Score ↓ is the native canonical order.
  if(key==='score'&&direction==='desc')return canonical;

  const stableIndex=new Map(canonical.map((row,index)=>[String(row?.mint||''),index]));

  return canonical.slice().sort((a,b)=>{
    const laneA=priority(a);
    const laneB=priority(b);
    if(laneA!==laneB)return laneA-laneB;

    // OPEN POSITION keeps its canonical P&L ordering.
    if(laneA===0){
      return (stableIndex.get(String(a?.mint||''))??0)-(stableIndex.get(String(b?.mint||''))??0);
    }

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

    return (stableIndex.get(String(a?.mint||''))??0)-(stableIndex.get(String(b?.mint||''))??0);
  });
}
'''

UI_CODE = r'''

// MEMEFLOW_TOKEN_FLOW_MARKET_GRID_V235_UI
function __mfSyncMarketGridV235(){
  document.querySelectorAll('[data-mf-market-timeframe]').forEach(button=>{
    const active=button.dataset.mfMarketTimeframe===__mfMarketTimeframeV235;
    button.classList.toggle('is-active',active);
    button.setAttribute('aria-pressed',active?'true':'false');
  });

  document.querySelectorAll('[data-mf-market-sort]').forEach(button=>{
    const active=button.dataset.mfMarketSort===__mfMarketSortV235.key;
    button.classList.toggle('is-active',active);
    button.setAttribute('aria-pressed',active?'true':'false');
    const arrow=button.querySelector('.mf-market-sort-arrow-v235');
    if(arrow){
      arrow.textContent=active
        ? (__mfMarketSortV235.direction==='asc'?'↑':'↓')
        : '';
    }
  });
}

function __mfRefreshVisibleMarketCardsV235(){
  __mfReconcileVisibleCardsV183();
  for(const card of document.querySelectorAll('.flow-token[data-mint]')){
    const mint=String(card.dataset.mint||'').trim();
    if(mint)__mfPatchMutableCardV17(mint);
  }
}

function __mfEnsureMarketGridV235(){
  if(document.getElementById('mfMarketGridV235')){
    __mfSyncMarketGridV235();
    return;
  }

  const tokenList=document.getElementById('tokenList');
  if(!tokenList)return;

  tokenList.insertAdjacentHTML('beforebegin',`
    <section id="mfMarketGridV235" class="mf-market-grid-v235" aria-label="Token market columns">
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
  `);

  document.querySelectorAll('[data-mf-market-timeframe]').forEach(button=>{
    button.addEventListener('click',()=>{
      const next=String(button.dataset.mfMarketTimeframe||'').toLowerCase();
      if(!__MF_MARKET_TIMEFRAMES_V235.has(next))return;
      if(next===__mfMarketTimeframeV235)return;
      __mfMarketTimeframeV235=next;
      __mfSaveMarketUiV235();
      state.page=1;
      __mfSyncMarketGridV235();
      __mfRefreshVisibleMarketCardsV235();
      if(typeof __mfKickCardClockV19==='function')__mfKickCardClockV19();
    });
  });

  document.querySelectorAll('[data-mf-market-sort]').forEach(button=>{
    button.addEventListener('click',()=>{
      const key=String(button.dataset.mfMarketSort||'');
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
  });

  __mfSyncMarketGridV235();
}

if(document.readyState==='loading'){
  document.addEventListener('DOMContentLoaded',__mfEnsureMarketGridV235,{once:true});
}else{
  __mfEnsureMarketGridV235();
}
'''


def fail(msg):
    print(f"\n[FAIL] {msg}")
    sys.exit(1)


def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        fail(f"{label}: expected 1 exact match, found {count}")
    return text.replace(old, new, 1)


def main():
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

    server_path = app / "app-server.mjs"
    js_path = app / "system-tokens.js"
    html_path = app / "system-tokens.html"
    css_path = app / CSS_NAME

    for p in (server_path, js_path, html_path):
        if not p.is_file():
            fail(f"Missing required file: {p}")

    original = {
        server_path: server_path.read_text(encoding="utf-8"),
        js_path: js_path.read_text(encoding="utf-8"),
        html_path: html_path.read_text(encoding="utf-8"),
    }
    original_css = css_path.read_text(encoding="utf-8") if css_path.exists() else None

    server = original[server_path]
    js = original[js_path]
    html = original[html_path]
    changed = False

    # ---------------- SERVER ----------------
    if SERVER_MARKER not in server:
        anchor = "// MEMEFLOW_REALTIME_UI_FAIRNESS_V1"
        if anchor not in server:
            fail("Server helper anchor not found")
        server = server.replace(anchor, SERVER_HELPER + "\n\n" + anchor, 1)
        changed = True

        batch_start = server.find("// MEMEFLOW_LIVE_CARD_BATCH_V18")
        batch_end = server.find("// MEMEFLOW_SINGLE_TOKEN_LIVE_ROUTE_V14", batch_start)
        if batch_start < 0 or batch_end < 0:
            fail("live-token-card-batch route block not found")
        batch = server[batch_start:batch_end]

        settings_anchor = "  const settings=store.settings(u.id)||{};\n  const openMints=__mfOpenPositionMints();"
        timeframe_insert = """  const settings=store.settings(u.id)||{};
  const timeframeRaw=String(requestBody?.timeframe||'5m').trim().toLowerCase();
  const timeframe=Object.prototype.hasOwnProperty.call(
    __MF_TOKEN_FLOW_WINDOW_MS_V235,
    timeframeRaw
  ) ? timeframeRaw : '5m';
  const openMints=__mfOpenPositionMints();"""
        if settings_anchor not in batch:
            fail("batch timeframe anchor not found")
        batch = batch.replace(settings_anchor, timeframe_insert, 1)

        row_anchor = """    if(row){
      rows.push(row);
    }"""
        row_replace = """    if(row){
      row.marketWindow=__mfTokenFlowWindowSnapshotV235(
        mint,
        token,
        timeframe,
        row,
        Date.now()
      );
      rows.push(row);
    }"""
        if row_anchor not in batch:
            fail("batch row enrichment anchor not found")
        batch = batch.replace(row_anchor, row_replace, 1)
        server = server[:batch_start] + batch + server[batch_end:]

        # The 10s structural feed carries the selected window for all 200 rows,
        # so sorting is global rather than limited to the currently mounted cards.
        states_start = server.find("// MEMEFLOW_LIVE_TOKEN_STATES_V7")
        states_end = server.find("if(url.pathname==='/api/ai/decisions')", states_start)
        if states_start < 0 or states_end < 0:
            fail("live-token-states route block not found")
        states = server[states_start:states_end]

        states_settings_anchor = "  const _settings=store.settings(u.id);\n  const _openMints=__mfOpenPositionMints();"
        states_settings_replace = """  const _settings=store.settings(u.id);
  const _timeframeRaw=String(url.searchParams.get('timeframe')||'5m').trim().toLowerCase();
  const _timeframe=Object.prototype.hasOwnProperty.call(
    __MF_TOKEN_FLOW_WINDOW_MS_V235,
    _timeframeRaw
  ) ? _timeframeRaw : '5m';
  const _openMints=__mfOpenPositionMints();"""
        if states_settings_anchor not in states:
            fail("live states timeframe anchor not found")
        states = states.replace(states_settings_anchor, states_settings_replace, 1)

        states_view_anchor = """      const _view=__mfLiveCardViewV14(_token,_decision);
      if(_view)_safeViews.push(_view);else _viewErrors++;"""
        states_view_replace = """      const _view=__mfLiveCardViewV14(_token,_decision);
      if(_view){
        _view.marketWindow=__mfTokenFlowWindowSnapshotV235(
          _mint,
          _token,
          _timeframe,
          _view,
          Date.now()
        );
        _safeViews.push(_view);
      }else _viewErrors++;"""
        if states_view_anchor not in states:
            fail("live states view enrichment anchor not found")
        states = states.replace(states_view_anchor, states_view_replace, 1)
        server = server[:states_start] + states + server[states_end:]

    # ---------------- CLIENT CORE ----------------
    if CLIENT_MARKER not in js:
        open_anchor = "function openPositionMetrics(row) {\n  return row?.__openPosition?.tokenMetrics || {};\n}"
        if open_anchor not in js:
            fail("openPositionMetrics anchor not found")
        js = js.replace(
            open_anchor,
            CLIENT_HELPER + "\n\n" +
            "function openPositionMetrics(row) {\n"
            "  const base=row?.__openPosition?.tokenMetrics || {};\n"
            "  return __mfApplyMarketWindowToMetricsV235(row,base);\n"
            "}",
            1,
        )
        changed = True

        # Replace regularMarketMetrics with selected-window aware version.
        pattern = re.compile(
            r"function regularMarketMetrics\(row\) \{.*?\n\}\n\nfunction regularVolumeLabel",
            re.S,
        )
        match = pattern.search(js)
        if not match:
            fail("regularMarketMetrics function not found")
        regular_new = r'''function regularMarketMetrics(row) {
  const base={
    ageMinutes:tokenAge(row),
    holderCount:holderCount(row),
    volume5mSol:row?.market?.volume5mSol ?? row?.volume5mSol ?? null,
    volume5mUsd:row?.market?.volume5mUsd ?? row?.volume5mUsd ?? null,
    transactions5m:row?.market?.transactions5m ?? row?.transactions5m ?? null,
    marketCapSol:row?.market?.marketCapSol ?? row?.marketCapSol ?? row?.marketCap ?? null,
    marketCapUsd:row?.market?.marketCapUsd ?? row?.marketCapUsd ?? null,
    marketCapSource:row?.market?.marketCapSource ?? row?.marketCapSource ?? null,
    priceChange5mPct:row?.market?.priceChange5mPct ?? row?.priceChange5mPct ?? null
  };
  return __mfApplyMarketWindowToMetricsV235(row,base);
}

function regularVolumeLabel'''
        js = js[:match.start()] + regular_new + js[match.end():]

        # Only the two card market templates: generic labels are hidden visually,
        # but they remain semantic anchors for the 1-second patcher.
        template_start = js.find("function openMarketStripTemplate")
        template_end = js.find("function positionAsDecisionRow", template_start)
        if template_start < 0 or template_end < 0:
            fail("market template range not found")
        template_slice = js[template_start:template_end]
        template_slice = template_slice.replace("<span>Vol 5m</span>", "<span>Vol</span>")
        template_slice = template_slice.replace("<span>Tx 5m</span>", "<span>Tx</span>")
        template_slice = template_slice.replace("<span>5m%</span>", "<span>Δ%</span>")
        js = js[:template_start] + template_slice + js[template_end:]

        # filteredRows keeps lane hierarchy but can sort within each non-open lane.
        filtered_pattern = re.compile(
            r"function filteredRows\(\)\{.*?\n\}\n\nfunction renderCounts",
            re.S,
        )
        fm = filtered_pattern.search(js)
        if not fm:
            fail("filteredRows function not found")
        filtered_new = r'''function filteredRows(){
  let rows=globalPruneV1
    ? globalPruneV1.filterRows(__mfBaseFilteredRowsV25())
    : __mfBaseFilteredRowsV25();
  const maxAge=__mfSortConfigV25.ageMaxMinutes;

  if(finite(maxAge)&&Number(maxAge)>0){
    rows=rows.filter(row=>{
      if(stateKey(row?.decision?.state)==='open')return true;
      const age=__mfManualSortValueV25(row,'age');
      return age!==null&&age<=Number(maxAge);
    });
  }

  return __mfMarketApplySortV235(rows);
}

function renderCounts'''
        js = js[:fm.start()] + filtered_new + js[fm.end():]

        # Preserve the last selected display window through the slower 10s
        # structure refresh; the next 1s batch replaces it with fresh values.
        preserve_start = js.find("function __mfPreserveIdentityV17")
        preserve_end = js.find("function __mfMutableRowForMintV17", preserve_start)
        if preserve_start < 0 or preserve_end < 0:
            fail("identity preservation range not found")
        preserve_slice = js[preserve_start:preserve_end]
        preserve_anchor = "  const out={...next};\n"
        preserve_insert = """  const out={...next};

  if(previous?.marketWindow && !out.marketWindow){
    out.marketWindow={...previous.marketWindow};
  }
"""
        if preserve_anchor not in preserve_slice:
            fail("identity preservation anchor not found")
        preserve_slice = preserve_slice.replace(preserve_anchor, preserve_insert, 1)
        js = js[:preserve_start] + preserve_slice + js[preserve_end:]

        # 1-second card patcher uses generic labels.
        patch_start = js.find("function __mfPatchMutableCardV17")
        patch_end = js.find("async function __mfPollOneSecondV17", patch_start)
        if patch_start < 0 or patch_end < 0:
            fail("mutable-card patcher range not found")
        patch_slice = js[patch_start:patch_end]
        patch_slice = patch_slice.replace("'Vol 5m'", "'Vol'")
        patch_slice = patch_slice.replace("'Tx 5m'", "'Tx'")
        patch_slice = patch_slice.replace("'5m%'", "'Δ%'")
        js = js[:patch_start] + patch_slice + js[patch_end:]

        # Structural feed also requests the selected window for all rows.
        structure_anchor = """'/api/system/live-token-states?limit=200&_='+
        Date.now(),"""
        structure_replace = """'/api/system/live-token-states?limit=200&timeframe='+
        encodeURIComponent(__mfMarketTimeframeV235)+'&_='+
        Date.now(),"""
        if structure_anchor not in js:
            fail("structural live-state URL anchor not found")
        js = js.replace(structure_anchor, structure_replace, 1)

        # Send selected display timeframe to the 1-second visible-card batch.
        load_start = js.find("async function loadTokens()")
        load_end = js.find("document\n  .querySelectorAll(\n    '.summary-card'", load_start)
        if load_start < 0 or load_end < 0:
            fail("loadTokens range not found")
        load_slice = js[load_start:load_end]
        request_anchor = """'/api/system/live-token-card-batch',
        {mints},"""
        request_replace = """'/api/system/live-token-card-batch',
        {mints,timeframe:__mfMarketTimeframeV235},"""
        if request_anchor not in load_slice:
            fail("live card batch request anchor not found")
        load_slice = load_slice.replace(request_anchor, request_replace, 1)
        js = js[:load_start] + load_slice + js[load_end:]

        # Add top timeframe/sort header UI after the legacy sort cleanup and before scan code.
        ui_anchor = "// MEMEFLOW_TOKEN_SCAN_V27"
        if ui_anchor not in js:
            fail("client UI insertion anchor not found")
        js = js.replace(ui_anchor, UI_CODE + "\n\n" + ui_anchor, 1)

    # ---------------- CSS + HTML LINK ----------------
    if original_css != CSS:
        css_path.write_text(CSS, encoding="utf-8")
        changed = True

    if HTML_MARKER not in html:
        block = (
            f'<!-- {HTML_MARKER} -->\n'
            f'<link rel="stylesheet" href="/{CSS_NAME}?v=235-20260928">\n'
            f'<!-- /{HTML_MARKER} -->\n'
        )
        idx = html.lower().rfind("</head>")
        if idx < 0:
            fail("</head> not found in system-tokens.html")
        html = html[:idx] + block + html[idx:]
        changed = True

    if not changed:
        print("\n[OK] V235 is already installed. No files changed.")
        return

    # Back up ORIGINAL files before writing source changes.
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    backup_dir = root / f".memeflow-token-flow-market-grid-v235-backup-{stamp}"
    backup_dir.mkdir(parents=True, exist_ok=False)
    for path, content in original.items():
        target = backup_dir / path.relative_to(root)
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(content, encoding="utf-8")
    if original_css is not None:
        target = backup_dir / css_path.relative_to(root)
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(original_css, encoding="utf-8")

    server_path.write_text(server, encoding="utf-8")
    js_path.write_text(js, encoding="utf-8")
    html_path.write_text(html, encoding="utf-8")

    # Syntax + whitespace checks. No process restart.
    try:
        subprocess.run(["node", "--check", str(server_path)], cwd=root, check=True)
        subprocess.run(["node", "--check", str(js_path)], cwd=root, check=True)
    except Exception as exc:
        fail(f"JavaScript syntax check failed after install: {exc}")

    try:
        subprocess.run(
            [
                "git", "diff", "--check", "--",
                "memeflow-app/app-server.mjs",
                "memeflow-app/system-tokens.js",
                "memeflow-app/system-tokens.html",
                f"memeflow-app/{CSS_NAME}",
            ],
            cwd=root,
            check=True,
        )
    except Exception:
        print("[WARN] git diff --check reported an issue; inspect git diff before push.")

    print("\n[OK] MEMEFLOW TOKEN FLOW MARKET GRID V235 installed.")
    print(f"[BACKUP] {backup_dir}")
    print("\nV235 behavior:")
    print("  • one shared column header: TOKEN / VOL / TX / MC / Δ% / SCORE")
    print("  • repeated VOL/TX/MC/Δ%/SCORE labels are removed from regular cards")
    print("  • real TradeEvent display windows: 1M / 5M / 15M / 1H / 6H")
    print("  • VOL / TX / Δ% change with the selected real window")
    print("  • MC remains the current live market cap")
    print("  • click VOL / TX / MC / Δ% / SCORE to sort within each state lane")
    print("  • OPEN POSITION keeps canonical P&L ordering")
    print("  • incomplete historical coverage is shown as —, never relabeled fake data")
    print("  • trading/entry/score logic remains canonical 5m and is NOT changed")
    print("\nNo process/server restart was performed.")
    print("\nPush after visual check:")
    print(
        f'git add memeflow-app/app-server.mjs memeflow-app/system-tokens.js '
        f'memeflow-app/system-tokens.html memeflow-app/{CSS_NAME} && '
        'git commit -m "Add Token Flow market windows and shared metric header" && git push'
    )


if __name__ == "__main__":
    main()
