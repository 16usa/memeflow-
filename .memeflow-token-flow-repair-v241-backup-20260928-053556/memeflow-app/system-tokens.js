
const PAGE_SIZE = 20;
const EMPTY_CONFIRMATIONS = 5;
// MEMEFLOW_NO_DATA_POLL_TIMER_V16

const $ = (id) =>
  document.getElementById(id);

const finite = (value) =>
  value !== null &&
  value !== undefined &&
  value !== '' &&
  Number.isFinite(Number(value));

const fmt = (value, digits = 2) =>
  finite(value)
    ? Number(value).toLocaleString(
        undefined,
        {
          maximumFractionDigits: digits
        }
      )
    : '—';

const escapeHtml = (value) =>
  String(value ?? '')
    .replace(
      /[&<>'"]/g,
      (char) => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        "'": '&#39;',
        '"': '&quot;'
      }[char])
    );

const shortMint = (mint = '') =>
  mint
    ? `${mint.slice(0, 7)}…${mint.slice(-5)}`
    : '—';

function stateKey(state = '') {
  const value =
    String(state).toUpperCase();

  if (value.includes('OPEN')) {
    return 'open';
  }

  if (
    value.includes('BUY') ||
    value.includes('READY')
  ) {
    return 'ready';
  }

  if (value.includes('BLOCK')) {
    return 'blocked';
  }

  if (value.includes('WATCH')) {
    return 'watch';
  }

  return 'waiting';
}

function stateLabel(state = '') {
  const key = stateKey(state);

  if (key === 'open') {
    return 'OPEN POSITION';
  }

  if (key === 'ready') {
    return 'BUY READY';
  }

  if (key === 'watch') {
    return 'WATCH';
  }

  if (key === 'blocked') {
    return 'BLOCKED';
  }

  return 'WAITING';
}

function canonicalDecisionRow(row) {
  const nested =
    row?.decision && typeof row.decision === 'object'
      ? row.decision
      : {};

  return {
    ...row,
    decision: {
      ...nested,
      state:
        row?.state ??
        nested?.state ??
        'WAITING',
      score:
        row?.score ??
        nested?.score ??
        null,
      primaryReason:
        row?.primaryReason ??
        nested?.primaryReason ??
        nested?.reason ??
        null,
      reasons:
        Array.isArray(row?.reasons)
          ? row.reasons
          : Array.isArray(nested?.reasons)
            ? nested.reasons
            : []
    },
    holder: {
      ...(row?.holder || {}),
      count:
        row?.holder?.count ??
        row?.holderCount ??
        row?.holders ??
        null,
      top10Pct:
        row?.holder?.top10Pct ??
        row?.top10Pct ??
        row?.top10 ??
        null,
      developerPct:
        row?.holder?.developerPct ??
        row?.developerPct ??
        row?.developerSharePct ??
        null
    },
    market: {
      ...(row?.market || {}),
      buyPressure:
        row?.market?.buyPressure ??
        row?.buyPressure ??
        row?.momentum ??
        null,
      priceSol:
        row?.market?.priceSol ??
        row?.priceSol ??
        row?.price ??
        null,
      volume5mSol:
        row?.market?.volume5mSol ??
        row?.volume5mSol ??
        null,
      volume5mUsd:
        row?.market?.volume5mUsd ??
        row?.volume5mUsd ??
        null,
      transactions5m:
        row?.market?.transactions5m ??
        row?.transactions5m ??
        null,
      marketCapSol:
        row?.market?.marketCapSol ??
        row?.marketCapSol ??
        row?.marketCap ??
        null,
      marketCapUsd:
        row?.market?.marketCapUsd ??
        row?.marketCapUsd ??
        null,
      // MEMEFLOW_CANONICAL_MC_SOURCE_V22
      marketCapSource:
        row?.market?.marketCapSource ??
        row?.marketCapSource ??
        null,
      marketUpdatedAt:
        row?.market?.marketUpdatedAt ??
        row?.marketCapUpdatedAt ??
        null,
      priceChange5mPct:
        row?.market?.priceChange5mPct ??
        row?.priceChange5mPct ??
        null
    }
  };
}

const state = {
  rows: [],
  positions: [],
  filter: 'all',
  query: '',
  page: 1,
  loading: false,
  emptyResponses: 0,
  refreshPending: false,

  // MEMEFLOW_STABLE_POLL_POSITION_STATE_V15
  positionLoading: false,

  // MEMEFLOW_LIVE_TOKEN_FEED_DIAGNOSTICS_V13
  feedReturned: 0,
  feedWorkingSet: 0,
  feedRawScanner: 0,
  feedViewErrors: 0,
  feedEvaluationErrors: 0
};
const globalPruneV1=window.MEMEFLOW_GLOBAL_PRUNE_V1;

// MEMEFLOW_GLOBAL_INSTANT_PRUNE_V1
globalPruneV1?.subscribe(({mint})=>{
  state.rows=state.rows.filter(
    row=>String(row?.mint||'')!==mint
  );
  state.page=1;
  render();
});

/* MEMEFLOW_SYSTEM_TOKEN_OPEN_POSITIONS_V1
 * UI-only merge of the existing scanner feed with the existing paper-position feed.
 * Solana mint keys remain case-sensitive. No trading/risk settings are modified.
 */
/* MEMEFLOW_SYSTEM_TOKEN_OPEN_PNL_PERCENT_V2
 * OPEN POSITION P&L is shown and ranked as total return on the original
 * position capital:
 *   (realized P&L SOL + unrealized P&L SOL) / initialSizeSol * 100
 * This keeps partial take-profits reflected in the percentage.
 */
/* MEMEFLOW_OPEN_PNL_LIVE_MARK_V5 */
function openPositionPnlPct(position) {
  if (!position || typeof position !== 'object') {
    return null;
  }

  const telemetry =
    position?.tokenMetrics;

  if (
    telemetry &&
    Object.prototype.hasOwnProperty.call(
      telemetry,
      'pnlReady'
    )
  ) {
    if (
      telemetry.pnlReady !== true ||
      !finite(telemetry.pnlPct)
    ) {
      return null;
    }

    return Number(telemetry.pnlPct);
  }

  const initialSize =
    finite(position.initialSizeSol)
      ? Number(position.initialSizeSol)
      : null;

  const hasRealized =
    finite(position.realizedPnlSol);

  const hasUnrealized =
    finite(position.unrealizedPnlSol);

  if (
    initialSize !== null &&
    initialSize > 0 &&
    (hasRealized || hasUnrealized)
  ) {
    const realized =
      hasRealized
        ? Number(position.realizedPnlSol)
        : 0;

    const unrealized =
      hasUnrealized
        ? Number(position.unrealizedPnlSol)
        : 0;

    return (
      (realized + unrealized) /
      initialSize
    ) * 100;
  }

  // Compatibility fallback for older position records.
  if (finite(position.unrealizedPnlPct)) {
    return Number(position.unrealizedPnlPct);
  }

  return null;
}

function openPositionPnlClass(value) {
  if (!finite(value) || Number(value) === 0) {
    return 'mf-open-position-pnl is-flat';
  }

  return Number(value) > 0
    ? 'mf-open-position-pnl is-profit'
    : 'mf-open-position-pnl is-loss';
}

function formatSignedPnlPct(value) {
  if (!finite(value)) {
    return '—';
  }

  const number = Number(value);
  const sign = number > 0 ? '+' : '';
  const abs = Math.abs(number);

  const digits =
    abs === 0
      ? 2
      : abs < 0.001
        ? 6
        : abs < 0.01
          ? 4
          : abs < 0.1
            ? 3
            : 2;

  return `${sign}${fmt(number, digits)}%`;
}

/* MEMEFLOW_OPEN_POSITION_MARKET_METRICS_V3 */
function compactMetricNumber(value, digits = 1) {
  if (!finite(value)) {
    return '—';
  }

  const number = Number(value);
  const abs = Math.abs(number);

  if (abs >= 1_000_000_000) {
    return `${fmt(number / 1_000_000_000, digits)}B`;
  }

  if (abs >= 1_000_000) {
    return `${fmt(number / 1_000_000, digits)}M`;
  }

  if (abs >= 1_000) {
    return `${fmt(number / 1_000, digits)}K`;
  }

  return fmt(number, digits);
}

function compactTokenAge(value) {
  if (!finite(value)) {
    return '—';
  }

  const minutes = Math.max(0, Number(value));

  if (minutes < 60) {
    return `${fmt(minutes, minutes < 10 ? 1 : 0)}m`;
  }

  if (minutes < 1440) {
    const hours = Math.floor(minutes / 60);
    const rest = Math.floor(minutes % 60);
    return rest ? `${hours}h ${rest}m` : `${hours}h`;
  }

  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  return hours ? `${days}d ${hours}h` : `${days}d`;
}


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
}





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


// MEMEFLOW_TOKEN_SCAN_V27
let __mfTokenScanBusyV27=false;

function __mfScanNumberV27(value,digits=2){
  if(!finite(value))return '—';
  return Number(value).toLocaleString(
    undefined,
    {maximumFractionDigits:digits}
  );
}

function __mfScanCompactUsdV27(value){
  if(!finite(value))return '—';
  return '$'+compactMetricNumber(Number(value),1);
}

function __mfScanMintFromInputV27(value){
  const text=String(value||'').trim();
  if(!text)return '';
  const matches=text.match(/[1-9A-HJ-NP-Za-km-z]{32,44}/g)||[];
  return matches.find(mint=>mint.length>=32&&mint.length<=44)||'';
}

function __mfScanStateClassV27(value){
  const key=stateKey(value);
  return key==='ready'?'ready':
    key==='watch'?'watch':
    key==='blocked'?'blocked':
    key==='open'?'open':'waiting';
}

// MEMEFLOW_MANUAL_DECISION_EVIDENCE_V11_1
function __mfScanLiveEvidenceReadyV11(row){
  if(!row)return false;

  const holderKnown=
    (finite(row?.holderCount)&&Number(row.holderCount)>0) ||
    (finite(row?.holders)&&Number(row.holders)>0);

  const marketCapKnown=
    (finite(row?.marketCapUsd)&&Number(row.marketCapUsd)>0) ||
    (finite(row?.market?.marketCapUsd)&&Number(row.market.marketCapUsd)>0);

  const priceKnown=
    (finite(row?.priceSol)&&Number(row.priceSol)>0) ||
    (finite(row?.market?.priceSol)&&Number(row.market.priceSol)>0);

  const activityKnown=
    finite(row?.buyPressure) ||
    finite(row?.market?.buyPressure) ||
    finite(row?.volume5mUsd) ||
    finite(row?.market?.volume5mUsd) ||
    finite(row?.transactions5m) ||
    finite(row?.market?.transactions5m);

  return Boolean(
    holderKnown &&
    marketCapKnown &&
    priceKnown &&
    activityKnown
  );
}

function __mfScanDecisionV27(scan,liveRow){
  if(scan?.decisionEligible===false){
    return scan?.displayEvaluation||{
      state:'DATA INCOMPLETE',
      score:null,
      confidence:null,
      reasons:[]
    };
  }

  if(liveRow&&__mfScanLiveEvidenceReadyV11(liveRow)){
    return {
      state:liveRow?.decision?.state||liveRow?.state||'WAITING',
      score:liveRow?.decision?.score??liveRow?.score??null,
      confidence:liveRow?.decision?.confidence??liveRow?.confidence??null,
      primaryReason:liveRow?.decision?.primaryReason??liveRow?.primaryReason??null,
      reasons:liveRow?.decision?.reasons??liveRow?.reasons??[]
    };
  }

  return scan?.displayEvaluation||scan?.evaluation||{};
}

async function __mfScanFetchV27(path,options={}){
  const response=await fetch(path,{
    cache:'no-store',
    credentials:'same-origin',
    ...options
  });
  let payload={};
  try{payload=await response.json();}catch{}
  if(!response.ok){
    const error=new Error(
      payload?.message||payload?.error||`HTTP ${response.status}`
    );
    error.status=response.status;
    error.payload=payload;
    throw error;
  }
  return payload;
}

async function __mfTrackedLiveRowV27(mint){
  if(!mint)return null;
  try{
    const payload=await __mfScanFetchV27(
      '/api/system/live-token-state?mint='+
      encodeURIComponent(mint)+'&_='+Date.now()
    );
    return payload?.row||null;
  }catch(error){
    if(error?.status===404)return null;
    throw error;
  }
}

async function __mfBuyContextV27(mint,decision){
  const result={readiness:null,proposal:null};
  if(!mint||stateKey(decision?.state)!=='ready')return result;

  try{
    const [readyPayload,proposalPayload]=await Promise.all([
      __mfScanFetchV27(
        '/api/paper/readiness?mint='+encodeURIComponent(mint)+'&_='+Date.now()
      ),
      __mfScanFetchV27('/api/paper/proposals?_='+Date.now())
    ]);

    result.readiness=readyPayload;
    const proposals=Array.isArray(proposalPayload?.proposals)
      ? proposalPayload.proposals : [];

    result.proposal=proposals
      .filter(p=>
        String(p?.mint||'')===mint &&
        String(p?.status||'').toUpperCase()==='PENDING'
      )
      .sort((a,b)=>
        Number(b?.createdAtMs||Date.parse(b?.createdAt||'')||0)-
        Number(a?.createdAtMs||Date.parse(a?.createdAt||'')||0)
      )[0]||null;
  }catch(error){
    console.debug('[token-scan] buy context unavailable',error);
  }
  return result;
}

function __mfScanRenderV27({scan,liveRow,buyContext}){
  const host=$('tokenScanResult');
  if(!host)return;

  const tracked=Boolean(liveRow);
  const decision=__mfScanDecisionV27(scan,liveRow);
  const mint=String(scan?.mint||liveRow?.mint||'');
  const name=scan?.name||liveRow?.name||liveRow?.symbol||shortMint(mint);
  const symbol=scan?.symbol||liveRow?.symbol||'';
  const market=scan?.market||{};
  const chain=scan?.onchain||{};
  const manualDataIncomplete=
    scan?.decisionEligible===false ||
    (
      scan?.analysisStatus &&
      scan.analysisStatus!=='READY' &&
      !__mfScanLiveEvidenceReadyV11(liveRow)
    );
  const stateText=
    manualDataIncomplete
      ? 'DATA INCOMPLETE'
      : stateLabel(decision?.state||'WAITING');
  const stateClass=
    manualDataIncomplete
      ? 'waiting'
      : __mfScanStateClassV27(decision?.state);
  const scoreText=
    manualDataIncomplete
      ? '—'
      : __mfScanNumberV27(decision?.score,0);

  const reasons=manualDataIncomplete
    ? []
    : [
        decision?.primaryReason,
        ...(Array.isArray(decision?.reasons)?decision.reasons:[])
      ].filter(Boolean);

  const warnings=Array.isArray(scan?.warnings)?scan.warnings:[];

  const canApproveBuy=Boolean(
    tracked &&
    stateKey(decision?.state)==='ready' &&
    buyContext?.readiness?.ok===true &&
    buyContext?.proposal?.id
  );

  const buyTitle=!tracked
    ? 'Manual scans cannot bypass the canonical trading pipeline.'
    : stateKey(decision?.state)!=='ready'
      ? `Buy unavailable while state is ${stateText}.`
      : buyContext?.readiness?.ok!==true
        ? 'Canonical entry readiness is not passing.'
        : !buyContext?.proposal?.id
          ? 'No pending ASSIST proposal is available. AUTOMATE mode handles entry itself.'
          : 'Approve the current canonical MEMEFLOW proposal.';

  host.hidden=false;
  host.innerHTML=`
    <div class="mf-scan-card">
      <div class="mf-scan-head">
        <div class="mf-scan-title">
          <span class="mf-scan-kicker">
            ${tracked?'TRACKED BY MEMEFLOW':'MANUAL TOKEN SCAN'}
          </span>
          <strong>${escapeHtml(symbol?`${symbol} · ${name}`:name)}</strong>
          <span class="mf-scan-mint">${escapeHtml(mint)}</span>
        </div>
        <span class="mf-scan-state ${stateClass}">
          ${escapeHtml(stateText)}
        </span>
      </div>

      <div class="mf-scan-grid">
        <div class="mf-scan-metric"><span>Score</span><strong>${escapeHtml(scoreText)}</strong></div>
        <div class="mf-scan-metric"><span>Holders</span><strong>${escapeHtml(chain?.holderCountDisplay??chain?.holderCount??holderCount(liveRow||{}))}</strong></div>
        <div class="mf-scan-metric"><span>Top 10</span><strong>${chain?.top10PctDisplay?escapeHtml(chain.top10PctDisplay):(finite(chain?.top10Pct)?escapeHtml(__mfScanNumberV27(chain.top10Pct,1)+'%'):'—')}</strong></div>
        <div class="mf-scan-metric"><span>Dev</span><strong>${chain?.developerPctDisplay?escapeHtml(chain.developerPctDisplay):(finite(chain?.developerPct)?escapeHtml(__mfScanNumberV27(chain.developerPct,1)+'%'):'—')}</strong></div>
        <div class="mf-scan-metric"><span>MC</span><strong>${escapeHtml(__mfScanCompactUsdV27(market?.marketCapUsd))}</strong></div>
        <div class="mf-scan-metric"><span>Buy pressure</span><strong>${finite(market?.buyPressure)?escapeHtml(__mfScanNumberV27(market.buyPressure,2)+'×'):'—'}</strong></div>
      </div>

      <p class="mf-scan-reason">
        ${escapeHtml(
          manualDataIncomplete
            ? (scan?.analysisMessage||'Token data is incomplete.')
            : reasons[0]||(
                tracked
                  ? 'Current canonical MEMEFLOW live state.'
                  : 'Independent scan completed with the current MEMEFLOW evaluator.'
              )
        )}
      </p>

      <div class="mf-scan-actions">
        <button type="button" data-mf-scan-details>Full analysis</button>
        ${tracked?'<button type="button" data-mf-scan-open-card>Open card</button>':''}
        <button
          type="button"
          class="mf-scan-buy"
          data-mf-scan-buy
          ${canApproveBuy?'':'disabled'}
          title="${escapeHtml(buyTitle)}"
        >Buy</button>
        <a
          href="https://pump.fun/coin/${encodeURIComponent(mint)}"
          target="_blank"
          rel="noopener noreferrer"
        >Pump.fun</a>
      </div>

      <div class="mf-scan-details" data-mf-scan-details-panel hidden>
        <div class="mf-scan-detail-grid">
          <div class="mf-scan-detail"><span>Liquidity</span><strong>${escapeHtml(
            scan?.migrated===true&&Number(market?.liquidityUsd)===0
              ? '—'
              : __mfScanCompactUsdV27(market?.liquidityUsd)
          )}</strong></div>
          <div class="mf-scan-detail"><span>Vol 5m</span><strong>${escapeHtml(__mfScanCompactUsdV27(market?.volume5mUsd))}</strong></div>
          <div class="mf-scan-detail"><span>5m buys / sells</span><strong>${escapeHtml(`${__mfScanNumberV27(market?.buys5m,0)} / ${__mfScanNumberV27(market?.sells5m,0)}`)}</strong></div>
          <div class="mf-scan-detail"><span>Mint authority</span><strong>${escapeHtml(chain?.mintAuthorityStatus??(chain?.mintAuthority?'ACTIVE':'UNKNOWN'))}</strong></div>
          <div class="mf-scan-detail"><span>Freeze authority</span><strong>${escapeHtml(chain?.freezeAuthorityStatus??(chain?.freezeAuthority?'ACTIVE':'UNKNOWN'))}</strong></div>
          <div class="mf-scan-detail"><span>Sources</span><strong>${escapeHtml((scan?.sources||[]).join(' · ')||'MEMEFLOW live')}</strong></div>
        </div>

        ${manualDataIncomplete&&Array.isArray(scan?.knownPolicyFailures)&&scan.knownPolicyFailures.length
          ? `<div class="mf-scan-note-label">Known settings checks</div><ul class="mf-scan-notes">${scan.knownPolicyFailures.slice(0,6).map(g=>`<li>${escapeHtml(g?.reason||g?.name||'Known settings failure')}</li>`).join('')}</ul>`
          : reasons.length>1
            ? `<ul class="mf-scan-notes">${reasons.slice(1,8).map(r=>`<li>${escapeHtml(r)}</li>`).join('')}</ul>`
            : ''}
        ${warnings.length
          ? `<ul class="mf-scan-notes">${warnings.slice(0,8).map(w=>`<li>${escapeHtml(w)}</li>`).join('')}</ul>`
          : ''}
      </div>
    </div>
  `;

  host.querySelector('[data-mf-scan-details]')?.addEventListener(
    'click',
    event=>{
      const panel=host.querySelector('[data-mf-scan-details-panel]');
      if(!panel)return;
      panel.hidden=!panel.hidden;
      event.currentTarget.textContent=panel.hidden?'Full analysis':'Hide analysis';
    }
  );

  host.querySelector('[data-mf-scan-open-card]')?.addEventListener(
    'click',
    ()=>{
      const card=[...document.querySelectorAll('.flow-token[data-mint]')]
        .find(node=>String(node.dataset.mint||'')===mint);
      if(card){
        card.scrollIntoView({behavior:'smooth',block:'center'});
        card.classList.add('expanded');
        const button=card.querySelector('.details-button');
        if(button){
          button.setAttribute('aria-expanded','true');
          button.setAttribute('aria-label','Close details');
        }
      }
    }
  );

  const buyButton=host.querySelector('[data-mf-scan-buy]');
  if(canApproveBuy&&buyButton){
    buyButton.addEventListener('click',async ()=>{
      buyButton.disabled=true;
      buyButton.textContent='Buying…';
      try{
        await __mfScanFetchV27(
          '/api/paper/proposals/'+
          encodeURIComponent(buyContext.proposal.id)+
          '/approve',
          {method:'POST'}
        );
        buyButton.textContent='Approved';
        void __mfRefreshOpenPositionsV16({patchDom:true});
        void __mfLoadStructureV18();
      }catch(error){
        buyButton.disabled=false;
        buyButton.textContent='Buy';
        buyButton.title=error?.message||'Buy approval failed';
      }
    });
  }
}

async function __mfAnalyzeTokenV27(){
  const input=String($('tokenSearch')?.value||'').trim();
  const host=$('tokenScanResult');
  const button=$('refreshButton');

  if(!input){
    state.query='';
    state.page=1;
    render();
    if(host){
      host.hidden=true;
      host.innerHTML='';
    }
    void __mfLoadStructureV18().finally(()=>__mfKickCardClockV19());
    return;
  }

  if(__mfTokenScanBusyV27)return;
  __mfTokenScanBusyV27=true;

  if(button){
    button.disabled=true;
    button.textContent='Scanning…';
  }
  if(host){
    host.hidden=false;
    host.innerHTML='<div class="mf-scan-loading">Running full MEMEFLOW token analysis…</div>';
  }

  try{
    const hintedMint=__mfScanMintFromInputV27(input);
    let liveRow=hintedMint
      ? await __mfTrackedLiveRowV27(hintedMint)
      : null;

    const payload=await __mfScanFetchV27(
      '/api/ai/standalone-scan',
      {
        method:'POST',
        headers:{'content-type':'application/json'},
        body:JSON.stringify({input})
      }
    );

    const scan=payload?.scan||null;
    if(!scan?.mint)throw new Error('Token scan returned no mint.');

    if(!liveRow||String(liveRow?.mint||'')!==String(scan.mint)){
      liveRow=await __mfTrackedLiveRowV27(scan.mint);
    }

    const decision=__mfScanDecisionV27(scan,liveRow);
    const buyContext=await __mfBuyContextV27(scan.mint,decision);

    state.query=liveRow?String(scan.mint):'';
    state.page=1;
    render();

    __mfScanRenderV27({scan,liveRow,buyContext});
  }catch(error){
    if(host){
      host.hidden=false;
      host.innerHTML=`<div class="mf-scan-error">${escapeHtml(error?.message||'Token analysis failed.')}</div>`;
    }
  }finally{
    __mfTokenScanBusyV27=false;
    if(button){
      button.disabled=false;
      button.textContent='Analyze';
    }
    __mfKickCardClockV19();
  }
}

$('refreshButton')
  .addEventListener(
    'click',
    ()=>{ void __mfAnalyzeTokenV27(); }
  );

$('tokenSearch')
  ?.addEventListener(
    'keydown',
    event=>{
      if(event.key==='Enter'){
        event.preventDefault();
        void __mfAnalyzeTokenV27();
      }
    }
  );

// MEMEFLOW_ONE_SECOND_MANUAL_REFRESH_V17
// Initial refresh starts after V17 mutable helpers are initialized.

/* MEMEFLOW_SYSTEM_TOKENS_ONE_SECOND_V17
 * UI PRESENTATION CONTRACT
 *
 * - canonical scanner/trading backend remains event-driven;
 * - browser reads the current truth once every 1000 ms;
 * - token feed + OPEN POSITION refresh independently/in parallel;
 * - no EventSource burst rendering on this page;
 * - no name/avatar/Pump.fun-link update in the 1-second mutable path.
 *
 * Static identity may be created only when feed membership changes or initial
 * metadata resolves. Normal one-second ticks patch mutable fields in-place.
 */
const __MF_CARD_REFRESH_MS_V17=1000;
const __MF_STRUCTURE_REFRESH_MS_V18=10000;

let __mfOneSecondTimerV17=null;
let __mfStructureTimerV18=null;

// MEMEFLOW_SINGLE_CARD_CLOCK_V19
let __mfCardClockRunningV19=false;
let __mfCardClockKickPendingV19=false;
let __mfCardClockNextAtV19=0;

function __mfPreserveIdentityV17(previous,next){
  if(!next||typeof next!=='object'){
    return next;
  }

  if(!previous||typeof previous!=='object'){
    return next;
  }

  const staticFields=[
    'name',
    'metadataName',
    'symbol',
    'metadataSymbol',
    'image',
    'imageUrl',
    'logo',
    'logoUrl',
    'logoURI',
    'uri',
    'metadataUri'
  ];

  const out={...next};

  if(previous?.marketWindow && !out.marketWindow){
    out.marketWindow={...previous.marketWindow};
  }

  for(const key of staticFields){
    if(
      previous[key]!==null &&
      previous[key]!==undefined &&
      previous[key]!==''
    ){
      out[key]=previous[key];
    }
  }

  return out;
}

function __mfMutableRowForMintV17(mint){
  mint=String(mint||'');

  return mergedRows().find(
    row=>String(row?.mint||'')===mint
  )||null;
}

function __mfSetStrongByLabelV17(
  card,
  selector,
  label,
  value,
  className=null
){
  for(const node of card.querySelectorAll(selector)){
    const labelNode=node.querySelector('span');
    const strong=node.querySelector('strong');

    if(
      !labelNode ||
      !strong ||
      labelNode.textContent.trim()!==label
    ){
      continue;
    }

    strong.textContent=String(value);

    if(className!==null){
      strong.className=className;
    }

    return true;
  }

  return false;
}

function __mfSetDetailByLabelV17(
  card,
  label,
  value
){
  for(const block of card.querySelectorAll('.detail-block')){
    const labelNode=block.querySelector('span');
    const body=block.querySelector('p');

    if(
      labelNode?.textContent.trim()===label &&
      body
    ){
      body.textContent=String(value);
      return true;
    }
  }

  return false;
}

// MEMEFLOW_ONE_SECOND_MUTABLE_ONLY_V17
function __mfPatchMutableCardV17(mint){
  mint=String(mint||'').trim();
  if(!mint)return;

  const row=__mfMutableRowForMintV17(mint);
  if(!row)return;

  const card=[
    ...document.querySelectorAll(
      '.flow-token[data-mint]'
    )
  ].find(
    node=>String(node.dataset.mint||'')===mint
  );

  if(!card)return;

  const key=stateKey(row?.decision?.state);
  const label=stateLabel(row?.decision?.state);

  // IMPORTANT:
  // Do NOT touch:
  //   .token-name
  //   .token-avatar
  //   .token-pump-link
  // Those are static identity/source controls.
  for(const stateClass of [
    'open',
    'ready',
    'watch',
    'waiting',
    'blocked'
  ]){
    card.classList.remove(stateClass);
  }
  card.classList.add(key);

  const stateNode=card.querySelector('.token-state');
  if(stateNode){
    stateNode.textContent=label;
    stateNode.className=`token-state ${key}`;
  }

  const score=tokenScore(row);
  const pnl=
    key==='open'
      ? openPositionPnlPct(row?.__openPosition)
      : null;

  __mfSetStrongByLabelV17(
    card,
    '.token-metric',
    key==='open'?'P&L':'Score',
    key==='open'
      ? formatSignedPnlPct(pnl)
      : (finite(score)?fmt(score,0):'—'),
    key==='open'
      ? openPositionPnlClass(pnl)
      : ''
  );

  __mfSetStrongByLabelV17(
    card,
    '.token-metric',
    'Holders',
    holderCount(row)
  );

  const top=top10(row);
  __mfSetStrongByLabelV17(
    card,
    '.token-metric',
    'Top 10',
    finite(top)?`${fmt(top,1)}%`:'—'
  );

  const pressure=buyPressure(row);
  __mfSetStrongByLabelV17(
    card,
    '.token-metric',
    'Buy pressure',
    finite(pressure)?`${fmt(pressure,2)}×`:'—'
  );

  const age=tokenAge(row);
  __mfSetStrongByLabelV17(
    card,
    '.token-metric',
    'Age',
    finite(age)?`${fmt(age,1)}m`:'—'
  );

  const price=priceSol(row);
  __mfSetStrongByLabelV17(
    card,
    '.token-metric',
    'Price SOL',
    finite(price)?fmt(price,9):'—'
  );
  const ageChipV47c=card.querySelector('.mf-token-age-chip-v47c');
  if(ageChipV47c){
    ageChipV47c.textContent=compactTokenAge(tokenAge(row));
  }

  const holderMiniV47c=card.querySelector('.mf-holder-mini-value-v47c');
  if(holderMiniV47c){
    holderMiniV47c.textContent=holderCount(row);
  }


  const metrics=
    key==='open'
      ? openPositionMetrics(row)
      : regularMarketMetrics(row);

  const stripSelector=
    key==='open'
      ? '.mf-open-market-stat'
      : '.mf-regular-market-stat';

  const stripAge=
    key==='open'
      ? (
          metrics?.ageMinutes ??
          tokenAge(row)
        )
      : metrics?.ageMinutes;

  const stripHolders=
    key==='open'
      ? (
          metrics?.holderCount ??
          holderCount(row)
        )
      : metrics?.holderCount;

  __mfSetStrongByLabelV17(
    card,
    stripSelector,
    'Age',
    compactTokenAge(stripAge)
  );

  __mfSetStrongByLabelV17(
    card,
    stripSelector,
    'Holders',
    stripHolders??'—'
  );

  __mfSetStrongByLabelV17(
    card,
    stripSelector,
    'Vol',
    key==='open'
      ? openVolumeLabel(metrics)
      : regularVolumeLabel(metrics)
  );

  __mfSetStrongByLabelV17(
    card,
    stripSelector,
    'Tx',
    finite(metrics?.transactions5m)
      ? fmt(metrics.transactions5m,0)
      : '—'
  );

  __mfSetStrongByLabelV17(
    card,
    stripSelector,
    'MC',
    key==='open'
      ? openMarketCapLabel(metrics)
      : regularMarketCapLabel(metrics)
  );

  const move=metrics?.priceChange5mPct;
  __mfSetStrongByLabelV17(
    card,
    stripSelector,
    'Δ%',
    signedPercent(move),
    marketMoveClass(move)
  );

  __mfSetDetailByLabelV17(
    card,
    'Primary signal',
    tokenReason(row)
  );

  __mfSetDetailByLabelV17(
    card,
    'Risk gates',
    tokenGateSummary(row)
  );

  const dev=developer(row);
  __mfSetDetailByLabelV17(
    card,
    'Developer',
    finite(dev)?`${fmt(dev,2)}%`:'—'
  );
}

async function __mfPollOneSecondV17(force=false){
  if(document.hidden&&!force){
    return;
  }

  // MEMEFLOW_DISJOINT_CARD_WRITERS_V19
  // Regular mounted cards and OPEN POSITION cards are separate data lanes.
  await Promise.allSettled([
    loadTokens(),
    __mfRefreshOpenPositionsV16()
  ]);
}

function __mfScheduleCardClockV19(){
  if(__mfOneSecondTimerV17!==null){
    clearTimeout(__mfOneSecondTimerV17);
  }

  const now=performance.now();

  if(!(__mfCardClockNextAtV19>now)){
    __mfCardClockNextAtV19=now;
  }

  __mfOneSecondTimerV17=
    setTimeout(
      ()=>{
        void __mfRunCardClockV19();
      },
      Math.max(
        0,
        __mfCardClockNextAtV19-now
      )
    );
}

async function __mfRunCardClockV19(){
  if(document.hidden){
    __mfCardClockNextAtV19=
      performance.now()+
      __MF_CARD_REFRESH_MS_V17;

    __mfScheduleCardClockV19();
    return;
  }

  if(__mfCardClockRunningV19){
    __mfCardClockKickPendingV19=true;
    return;
  }

  __mfCardClockRunningV19=true;

  const scheduledAt=
    __mfCardClockNextAtV19>0
      ? __mfCardClockNextAtV19
      : performance.now();

  try{
    await __mfPollOneSecondV17(true);
  }finally{
    __mfCardClockRunningV19=false;

    const now=performance.now();

    if(__mfCardClockKickPendingV19){
      __mfCardClockKickPendingV19=false;
      __mfCardClockNextAtV19=now;
    }else{
      let next=
        scheduledAt+
        __MF_CARD_REFRESH_MS_V17;

      // MEMEFLOW_NO_CATCHUP_BURST_V19
      // If a request was slow, SKIP missed slots. Never replay several updates
      // back-to-back to "catch up".
      while(next<=now){
        next+=__MF_CARD_REFRESH_MS_V17;
      }

      __mfCardClockNextAtV19=next;
    }

    __mfScheduleCardClockV19();
  }
}

function __mfKickCardClockV19(){
  if(__mfCardClockRunningV19){
    __mfCardClockKickPendingV19=true;
    return;
  }

  __mfCardClockNextAtV19=
    performance.now();

  __mfScheduleCardClockV19();
}

if(typeof loadDiscoveryStatus==='function'){
  void loadDiscoveryStatus();
}

// MEMEFLOW_PER_MINT_ONE_SECOND_CLOCK_V18
// MEMEFLOW_SINGLE_CARD_CLOCK_START_V19
void __mfLoadStructureV18()
  .finally(
    ()=>__mfKickCardClockV19()
  );

// Membership/ranking synchronization remains separate. It does not write
// mutable card data after MEMEFLOW_STRUCTURE_MEMBERSHIP_ONLY_V19.
__mfStructureTimerV18=
  setInterval(
    ()=>{
      if(!document.hidden){
        void __mfLoadStructureV18();
      }
    },
    __MF_STRUCTURE_REFRESH_MS_V18
  );

document.addEventListener(
  'visibilitychange',
  ()=>{
    if(!document.hidden){
      void __mfLoadStructureV18();
      __mfKickCardClockV19();
    }
  }
);

window.addEventListener(
  'pageshow',
  ()=>{
    __mfKickCardClockV19();
  }
);

window.addEventListener(
  'focus',
  ()=>{
    __mfKickCardClockV19();
  }
);

window.addEventListener(
  'online',
  ()=>{
    __mfKickCardClockV19();
  }
);

window.addEventListener(
  'beforeunload',
  ()=>{
    if(__mfOneSecondTimerV17!==null){
      clearTimeout(__mfOneSecondTimerV17);
    }

    if(__mfStructureTimerV18!==null){
      clearInterval(__mfStructureTimerV18);
    }
  },
  {once:true}
);



/* ===== LIVE TOKEN METADATA V16 ===== */

const TOKEN_META_V16={
  cache:new Map(),
  pending:new Set()
};

function applyTokenMetaV16(card,meta){
  if(!card||!meta){
    return;
  }

  const mint=
    String(card.dataset.mint||'').trim();

  if(!mint){
    return;
  }

  const displayName=
    String(
      meta.name||
      meta.metadataName||
      meta.symbol||
      meta.metadataSymbol||
      ''
    ).trim();

  const image=canonicalTokenImageUrlV1(mint);

  const locked=
    __mfLockStaticIdentityV16(
      mint,
      {
        name:displayName,
        image
      }
    );

  if(locked.nameAdded){
    const nameEl=
      card.querySelector('.token-name');

    if(nameEl){
      nameEl.textContent=
        locked.entry.name;
    }
  }

  const link=
    card.querySelector('.token-pump-link');

  if(link&&mint){
    link.href=
      'https://pump.fun/coin/'+
      encodeURIComponent(mint);
  }

  if(!locked.imageAdded){
    return;
  }

  const avatar=
    card.querySelector('.token-avatar');

  if(!avatar){
    return;
  }

  let img=
    avatar.querySelector('img');

  if(!img){
    img=document.createElement('img');
    img.alt='';
    img.loading='lazy';
    img.decoding='async';

    img.addEventListener(
      'error',
      ()=>{
        avatar.classList.add('is-broken');
      }
    );

    avatar.prepend(img);
  }

  avatar.classList.remove('is-broken');
  img.src=locked.entry.image;
  avatar.classList.add('has-image');
  avatar.classList.remove('fallback-only');
}

async function hydrateTokenCardsV16(){
  const cards=[
    ...document.querySelectorAll(
      '.flow-token[data-mint]'
    )
  ];

  if(!cards.length){
    return;
  }

  const missing=[];

  for(const card of cards){
    const mint=
      card.dataset.mint;

    if(!mint){
      continue;
    }

    const cached=
      TOKEN_META_V16.cache.get(
        mint
      );

    if(cached){
      applyTokenMetaV16(
        card,
        cached
      );
      continue;
    }

    if(
      !TOKEN_META_V16.pending.has(
        mint
      )
    ){
      missing.push(mint);
    }
  }

  if(!missing.length){
    return;
  }

  const batch=[
    ...new Set(missing)
  ].slice(0,20);

  for(const mint of batch){
    TOKEN_META_V16.pending.add(
      mint
    );
  }

  try{
    const response=
      await fetch(
        '/api/system/token-card-meta?mints='+
        encodeURIComponent(
          batch.join(',')
        ),
        {
          cache:'no-store',
          credentials:'same-origin'
        }
      );

    if(!response.ok){
      throw new Error(
        'Metadata HTTP '+
        response.status
      );
    }

    const payload=
      await response.json();

    const rows=
      Array.isArray(payload?.tokens)
        ? payload.tokens
        : [];

    const returned=
      new Set();

    for(const meta of rows){
      if(!meta?.mint){
        continue;
      }

      returned.add(
        meta.mint
      );

      TOKEN_META_V16.cache.set(
        meta.mint,
        meta
      );
    }

    for(const mint of batch){
      if(!returned.has(mint)){
        TOKEN_META_V16.cache.set(
          mint,
          {mint}
        );
      }
    }

    for(const card of cards){
      const meta=
        TOKEN_META_V16.cache.get(
          card.dataset.mint
        );

      if(meta){
        applyTokenMetaV16(
          card,
          meta
        );
      }
    }
  }catch(error){
    console.error(
      '[MEMEFLOW TOKEN META]',
      error
    );
  }finally{
    for(const mint of batch){
      TOKEN_META_V16.pending.delete(
        mint
      );
    }
  }
}

const tokenListV16=
  document.getElementById(
    'tokenList'
  );

if(tokenListV16){
  const observerV16=
    new MutationObserver(
      ()=>{
        queueMicrotask(
          ()=>{
            void hydrateTokenCardsV16();
            void hydrateTokenMediaV25();
          }
        );
      }
    );

  observerV16.observe(
    tokenListV16,
    {
      childList:true
    }
  );
}

// MEMEFLOW_NO_METADATA_POLLING_V16
// Initial/new-card hydration is driven by tokenList structural mutation only.


/* ===== TOKEN MEDIA V25 ===== */

const TOKEN_MEDIA_V25 = {
  rows: new Map(),
  meta: new Map(),
  pending: new Map(),
  lastLoad: 0
};

function mediaUriV25(value) {
  const uri = String(value || '').trim();

  if (!uri) {
    return '';
  }

  if (uri.startsWith('ipfs://')) {
    return (
      'https://ipfs.io/ipfs/' +
      uri
        .slice(7)
        .replace(/^ipfs\//, '')
    );
  }

  if (uri.startsWith('ar://')) {
    return (
      'https://arweave.net/' +
      uri.slice(5)
    );
  }

  return uri;
}

function findTokenRowsV25(payload) {
  const queue = [payload];
  const visited = new Set();

  while (queue.length) {
    const value = queue.shift();

    if (
      !value ||
      typeof value !== 'object' ||
      visited.has(value)
    ) {
      continue;
    }

    visited.add(value);

    if (Array.isArray(value)) {
      if (
        value.some(
          item =>
            item &&
            typeof item === 'object' &&
            typeof item.mint === 'string'
        )
      ) {
        return value;
      }

      for (const item of value) {
        if (
          item &&
          typeof item === 'object'
        ) {
          queue.push(item);
        }
      }

      continue;
    }

    for (const child of Object.values(value)) {
      if (
        child &&
        typeof child === 'object'
      ) {
        queue.push(child);
      }
    }
  }

  return [];
}

async function loadTokenRowsV25(force = false) {
  const now = Date.now();

  if (
    !force &&
    now - TOKEN_MEDIA_V25.lastLoad < 5000
  ) {
    return;
  }

  TOKEN_MEDIA_V25.lastLoad = now;

  try {
    const response = await fetch(
      '/api/debug/filter-pipeline-lifecycle?limit=250&_=' +
      now,
      {
        cache: 'no-store',
        credentials: 'same-origin'
      }
    );

    if (!response.ok) {
      return;
    }

    const payload = await response.json();
    const rows = findTokenRowsV25(payload);

    for (const row of rows) {
      const mint = String(
        row?.mint || ''
      ).trim();

      if (mint) {
        TOKEN_MEDIA_V25.rows.set(
          mint,
          row
        );
      }
    }
  } catch (error) {
    console.debug(
      '[TOKEN MEDIA V25]',
      error
    );
  }
}

function directImageV25(row) {
  const values = [
    row?.imageUrl,
    row?.image,
    row?.logoUrl,
    row?.logo,
    row?.logoURI,
    row?.metadata?.image,
    row?.metadata?.imageUrl
  ];

  for (const value of values) {
    const uri = mediaUriV25(value);

    if (uri) {
      return uri;
    }
  }

  return '';
}

function metadataUriV25(row) {
  const values = [
    row?.uri,
    row?.metadataUrl,
    row?.metadataUri,
    row?.metadataURI,
    row?.metadata?.uri
  ];

  for (const value of values) {
    const uri = mediaUriV25(value);

    if (uri) {
      return uri;
    }
  }

  return '';
}

async function resolveTokenMetaV25(row) {
  const mint = String(row?.mint || '').trim();
  if (!mint) return null;

  return {
    mint,
    name:
      row?.name ||
      row?.metadataName ||
      row?.symbol ||
      '',
    symbol:
      row?.symbol ||
      row?.metadataSymbol ||
      '',
    image: canonicalTokenImageUrlV1(mint)
  };
}

function applyTokenMediaV25(card, meta) {
  if (!card || !meta) {
    return;
  }

  const name =
    card.querySelector(
      '.token-name, .token-mint'
    );

  if (
    name &&
    meta.name
  ) {
    name.textContent =
      String(meta.name).trim();
  }

  const avatar =
    card.querySelector(
      '.token-avatar'
    );

  if (
    !avatar ||
    !meta.image
  ) {
    return;
  }

  let image =
    avatar.querySelector('img');

  if (!image) {
    image =
      document.createElement('img');

    image.alt = '';
    image.loading = 'lazy';
    image.decoding = 'async';
    image.referrerPolicy =
      'no-referrer';

    avatar.prepend(image);
  }

  if (
    image.dataset.mediaV25 !==
    meta.image
  ) {
    image.dataset.mediaV25 =
      meta.image;

    image.onload = () => {
      avatar.classList.add(
        'has-image'
      );

      avatar.classList.remove(
        'is-broken',
        'fallback-only'
      );
    };

    image.onerror = () => {
      avatar.classList.remove(
        'has-image'
      );

      avatar.classList.add(
        'is-broken'
      );
    };

    image.src = meta.image;
  }
}

function visibleCardsV25() {
  return [
    ...document.querySelectorAll(
      '.flow-token[data-mint]'
    )
  ].filter(card => {
    const rect =
      card.getBoundingClientRect();

    return (
      rect.bottom > -200 &&
      rect.top <
        window.innerHeight + 200
    );
  });
}

async function hydrateTokenMediaV25() {
  await loadTokenRowsV25(true);

  const cards =
    visibleCardsV25();

  const jobs = [];

  for (const card of cards) {
    const mint = String(
      card.dataset.mint || ''
    ).trim();

    if (!mint) {
      continue;
    }

    const row =
      TOKEN_MEDIA_V25.rows.get(mint);

    if (!row) {
      continue;
    }

    jobs.push(
      resolveTokenMetaV25(row)
        .then(meta =>
          applyTokenMediaV25(
            card,
            meta
          )
        )
    );

    if (jobs.length >= 6) {
      await Promise.allSettled(
        jobs.splice(0, jobs.length)
      );
    }
  }

  if (jobs.length) {
    await Promise.allSettled(jobs);
  }
}

// MEMEFLOW_NO_TOKEN_MEDIA_POLLING_V16
// No body-wide observer, scroll refresh, or 6-second media timer.
// TOKEN_STATIC_IDENTITY_V16 is hydrated by the tokenList observer only.

// MEMEFLOW_DEX_TOKEN_FLOW_V26

// MEMEFLOW_LIVE_TOKEN_STATES_V7

// ===== MEMEFLOW_TOKEN_FLOW_STICKY_SEARCH_SHADOW_V38 =====
(function mfStickySearchShadowV38() {
  function init() {
    const toolbar = document.querySelector('.flow-toolbar');
    if (!toolbar || toolbar.dataset.mfStickyShadowV38 === '1') return;

    toolbar.dataset.mfStickyShadowV38 = '1';

    let raf = 0;

    const sync = () => {
      raf = 0;

      const rect = toolbar.getBoundingClientRect();
      const style = getComputedStyle(toolbar);
      const stickyTop = Number.parseFloat(style.top) || 0;

      const stuck =
        window.scrollY > 0 &&
        rect.top <= stickyTop + 1;

      toolbar.classList.toggle('mf-stuck', stuck);
    };

    const schedule = () => {
      if (raf) return;
      raf = requestAnimationFrame(sync);
    };

    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule, { passive: true });

    schedule();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
// ===== /MEMEFLOW_TOKEN_FLOW_STICKY_SEARCH_SHADOW_V38 =====

// ===== MEMEFLOW_TOKEN_FLOW_REVENUE_ROWS_V43 =====
(function mfTokenFlowRevenueRowsV43() {
  function init() {
    const list = document.querySelector('.token-list');
    if (!list || list.dataset.mfRevenueRowsV43 === '1') return;

    list.dataset.mfRevenueRowsV43 = '1';

    list.addEventListener('click', (event) => {
      const card = event.target.closest('.flow-token');
      if (!card || !list.contains(card)) return;

      list
        .querySelectorAll('.flow-token.mf-row-selected')
        .forEach((node) => {
          if (node !== card) node.classList.remove('mf-row-selected');
        });

      if (
        card.classList.contains('open') ||
        card.classList.contains('ready') ||
        card.classList.contains('watch')
      ) {
        card.classList.add('mf-row-selected');
      } else {
        card.classList.remove('mf-row-selected');
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
// ===== /MEMEFLOW_TOKEN_FLOW_REVENUE_ROWS_V43 =====

// ===== MEMEFLOW_TOKEN_FLOW_CARD_CLICK_TOGGLE_V44 =====
(function mfTokenFlowCardClickToggleV44() {
  function init() {
    const list = document.querySelector('.token-list');
    if (!list || list.dataset.mfCardToggleV44 === '1') return;

    list.dataset.mfCardToggleV44 = '1';

    list.addEventListener('click', (event) => {
      const card = event.target.closest('.flow-token');
      if (!card || !list.contains(card)) return;

      // Keep real controls/links working normally.
      if (
        event.target.closest(
          'a, button, input, select, textarea, label, [role="button"]'
        )
      ) {
        return;
      }

      const expanded = card.classList.toggle('expanded');

      card.setAttribute(
        'aria-expanded',
        expanded ? 'true' : 'false'
      );

      if (expanded && typeof __mfRunCardAnalysisV13 === 'function') {
        void __mfRunCardAnalysisV13(card);
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
// ===== /MEMEFLOW_TOKEN_FLOW_CARD_CLICK_TOGGLE_V44 =====

// ===== MEMEFLOW_TOKEN_FLOW_TIME_WINDOW_V47C =====
(function mfTokenFlowTimeWindowV47C(){
  const storageKey='memeflow:token-age-window-v47c';

  function apply(raw, rerender){
    const value=raw==='all'?null:Number(raw);

    __mfSortConfigV25={
      ...__mfSortConfigV25,
      key:'smart',
      direction:'desc',
      ageMaxMinutes:Number.isFinite(value)&&value>0?value:null
    };

    document.querySelectorAll('[data-mf-age-window-v47c]').forEach(button=>{
      const active=raw==='all'
        ? __mfSortConfigV25.ageMaxMinutes===null
        : Number(button.dataset.mfAgeWindowV47c)===__mfSortConfigV25.ageMaxMinutes;

      button.classList.toggle('is-active',active);
      button.setAttribute('aria-pressed',active?'true':'false');
    });

    try{localStorage.setItem(storageKey,raw)}catch{}

    if(rerender){
      state.page=1;
      render();
      if(typeof __mfKickCardClockV19==='function'){
        __mfKickCardClockV19();
      }
    }
  }

  function init(){
    const bar=document.querySelector('.mf-time-window-v47c');
    if(!bar||bar.dataset.mfBoundV47c==='1')return;

    bar.dataset.mfBoundV47c='1';

    let saved='all';
    try{
      const candidate=localStorage.getItem(storageKey);
      if(['all','60','360','1440'].includes(candidate)){
        saved=candidate;
      }
    }catch{}

    apply(saved,false);

    bar.addEventListener('click',event=>{
      const button=event.target.closest('[data-mf-age-window-v47c]');
      if(!button)return;
      apply(button.dataset.mfAgeWindowV47c,true);
    });
  }

  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',init,{once:true});
  }else{
    init();
  }
})();
// ===== /MEMEFLOW_TOKEN_FLOW_TIME_WINDOW_V47C =====


/* ===== MEMEFLOW_TOKEN_FLOW_CONTINUOUS_COMPACT_V1 =====
 * Pagination UI is intentionally removed. state.page is retained as a
 * backwards-compatible chunk counter so every existing filter/sort/search
 * reset (state.page = 1) keeps working exactly as before.
 *
 * When the user approaches the bottom of the document, reveal one more
 * PAGE_SIZE chunk and re-render in place. No network request, trading state,
 * scoring rule, holder logic or market data source is changed here.
 */
let __mfContinuousScrollRafV1 = 0;
let __mfContinuousScrollBusyV1 = false;

function __mfContinuousScrollCheckV1(){
  if (__mfContinuousScrollBusyV1) return;

  const rows = filteredRows();
  const totalChunks = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));

  if (state.page >= totalChunks) return;

  const root = document.documentElement;
  const scrollBottom = window.scrollY + window.innerHeight;
  const triggerAt = Math.max(0, root.scrollHeight - Math.max(640, window.innerHeight * 0.75));

  if (scrollBottom < triggerAt) return;

  __mfContinuousScrollBusyV1 = true;
  state.page += 1;

  try {
    render();
    if (typeof __mfKickCardClockV19 === 'function') {
      __mfKickCardClockV19();
    }
  } finally {
    __mfContinuousScrollBusyV1 = false;
  }

  // If the newly revealed chunk still does not fill the viewport, continue.
  requestAnimationFrame(__mfContinuousScrollCheckV1);
}

function __mfContinuousScrollScheduleV1(){
  if (__mfContinuousScrollRafV1) return;
  __mfContinuousScrollRafV1 = requestAnimationFrame(() => {
    __mfContinuousScrollRafV1 = 0;
    __mfContinuousScrollCheckV1();
  });
}

window.addEventListener('scroll', __mfContinuousScrollScheduleV1, {passive:true});
window.addEventListener('resize', __mfContinuousScrollScheduleV1, {passive:true});
requestAnimationFrame(__mfContinuousScrollCheckV1);
/* ===== /MEMEFLOW_TOKEN_FLOW_CONTINUOUS_COMPACT_V1 ===== */


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

