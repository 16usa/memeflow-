const $ = id => document.getElementById(id);
const finite = value => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value));
const num = (value, fallback = null) => finite(value) ? Number(value) : fallback;
const fmt = (value, digits = 2) => finite(value)
  ? Number(value).toLocaleString(undefined, { maximumFractionDigits: digits })
  : '—';
const short = (value = '', a = 5, b = 4) => value ? `${value.slice(0, a)}…${value.slice(-b)}` : '—';
const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));

const state = {
  settings: null,
  settingsVersion: null,
  capabilities: null,
  killSwitchActive: false,
  candidates: [],
  selectedMint: null,
  selected: null,
  filter: 'all',
  unit: 'SOL',
  timeframe: 1000,
  rawByMint: new Map(),
  chartSource: null,
  positions: [],
  trades: [],
  paperStatus: null,
  walletProvider: null,
  walletAddress: null,
  polling: false,
  chartRaf: null,
  lastCandidatePoll: 0
};

const STRATEGY_KEYS = [
  'hardStopPct', 'trailingStopPct',
  'tp1Pct', 'tp1SellPct',
  'tp2Pct', 'tp2SellPct',
  'runnerPct', 'maxHoldMinutes',
  'exitBuyPressure', 'exitOnWeakBuyPressure',
  'dailySpendLimit', 'dailyLossLimit',
  'maxOpenPositions', 'maxDailyEntries'
];

function showError(message) {
  const node = $('controlError');
  node.hidden = false;
  node.textContent = String(message || 'Unknown error');
}

function clearError() {
  const node = $('controlError');
  node.hidden = true;
  node.textContent = '';
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    credentials: 'same-origin',
    cache: 'no-store',
    ...options
  });
  let payload = {};
  try { payload = await response.json(); } catch {}
  if (!response.ok) {
    const error = new Error(payload?.message || payload?.error || `${response.status} ${response.statusText}`);
    error.status = response.status;
    error.payload = payload;
    throw error;
  }
  return payload;
}

function decisionClass(value) {
  const s = String(value || '').toUpperCase();
  if (s.includes('BUY')) return 'ready';
  if (s.includes('BLOCK')) return 'blocked';
  if (s.includes('WATCH')) return 'watch';
  return '';
}

function candidatePrice(candidate) {
  return num(candidate?.priceSol ?? candidate?.price);
}

function impliedSolUsd(candidate) {
  const mcUsd = num(candidate?.marketCapUsd);
  const mcSol = num(candidate?.marketCapSol ?? candidate?.marketCap);
  if (mcUsd > 0 && mcSol > 0) return mcUsd / mcSol;

  const liqUsd = num(candidate?.liquidityUsd);
  const liqSol = num(candidate?.liquiditySol ?? candidate?.liquidity);
  if (liqUsd > 0 && liqSol > 0) return liqUsd / liqSol;

  return null;
}

function amountSol() {
  const amount = num($('amountInput').value, 0);
  if (!(amount > 0)) throw new Error('Position amount must be greater than 0.');
  if (state.unit === 'SOL') return amount;

  const rate = impliedSolUsd(state.selected);
  if (!(rate > 0)) {
    throw new Error('USD → SOL conversion is unavailable until a selected candidate has both SOL and USD market data.');
  }
  return amount / rate;
}

function updateAmountHint() {
  const value = num($('amountInput').value, 0);
  const rate = impliedSolUsd(state.selected);

  if (state.unit === 'USD') {
    $('amountHint').textContent = rate > 0
      ? `$${fmt(value, 2)} ≈ ${fmt(value / rate, 5)} SOL · implied SOL/USD ${fmt(rate, 2)}`
      : 'Select a candidate with USD + SOL market data to convert the position into SOL.';
  } else {
    $('amountHint').textContent = rate > 0
      ? `${fmt(value, 5)} SOL ≈ $${fmt(value * rate, 2)} · engine position size`
      : `${fmt(value, 5)} SOL · engine position size`;
  }
}

function strategyFromUI() {
  const read = id => num($(id).value);
  const values = {
    hardStopPct: read('hardStopPct'),
    trailingStopPct: read('trailingStopPct'),
    tp1Pct: read('tp1Pct'),
    tp1SellPct: read('tp1SellPct'),
    tp2Pct: read('tp2Pct'),
    tp2SellPct: read('tp2SellPct'),
    runnerPct: read('runnerPct'),
    maxHoldMinutes: Math.trunc(read('maxHoldMinutes')),
    exitBuyPressure: read('exitBuyPressure'),
    exitOnWeakBuyPressure: $('exitOnWeakBuyPressure').checked,
    dailySpendLimit: read('dailySpendLimit'),
    dailyLossLimit: read('dailyLossLimit'),
    maxOpenPositions: Math.trunc(read('maxOpenPositions')),
    maxDailyEntries: Math.trunc(read('maxDailyEntries'))
  };

  for (const [key, value] of Object.entries(values)) {
    if (typeof value === 'number' && !Number.isFinite(value)) {
      throw new Error(`${key} must be a valid number.`);
    }
  }

  if (!(values.hardStopPct > 0 && values.hardStopPct <= 100)) throw new Error('Hard stop must be > 0% and ≤ 100%.');
  if (values.trailingStopPct < 0 || values.trailingStopPct > 100) throw new Error('Trailing stop must be between 0% and 100%.');
  if (!(values.tp1Pct > 0)) throw new Error('TP1 gain must be greater than 0%.');
  if (!(values.tp2Pct > values.tp1Pct)) throw new Error('TP2 gain must be greater than TP1.');
  const allocation = values.tp1SellPct + values.tp2SellPct + values.runnerPct;
  if (Math.abs(allocation - 100) > 0.001) throw new Error(`TP1 sell + TP2 sell + runner must equal 100% (currently ${fmt(allocation, 2)}%).`);
  if (!(values.maxHoldMinutes >= 1)) throw new Error('Maximum hold must be at least 1 minute.');
  if (values.maxOpenPositions < 0 || values.maxDailyEntries < 0) throw new Error('Position and entry limits cannot be negative.');

  return values;
}

function updateAllocation() {
  const allocation = ['tp1SellPct', 'tp2SellPct', 'runnerPct']
    .reduce((sum, id) => sum + num($(id).value, 0), 0);
  const node = $('allocationBadge');
  node.textContent = `${fmt(allocation, 0)}% allocated`;
  node.style.color = Math.abs(allocation - 100) <= .001 ? '#4de6a1' : '#ff6679';
  scheduleChart();
}

function populateSettings() {
  const s = state.settings;
  if (!s) return;

  $('amountInput').value = finite(s.positionSize) ? s.positionSize : 0.1;

  for (const key of STRATEGY_KEYS) {
    const node = $(key);
    if (!node) continue;
    if (node.type === 'checkbox') node.checked = Boolean(s[key]);
    else node.value = s[key] ?? '';
  }

  const mode = String(s.operatingMode || 'observe').toLowerCase();
  $('modeBadge').textContent = mode.toUpperCase();
  $('modeBadge').dataset.mode = mode;

  $('engineText').textContent = mode === 'automate'
    ? 'PAPER AUTO ACTIVE'
    : mode === 'assist'
      ? 'PAPER ASSIST'
      : 'ENGINE OBSERVE';

  $('enginePill').dataset.active = mode === 'automate' && s.tradingEnvironment === 'paper' ? 'true' : 'false';

  $('saveState').textContent = `Settings v${state.settingsVersion ?? '—'} · ${s.tradingEnvironment || 'paper'}`;
  updateAllocation();
  updateAmountHint();
  scheduleChart();
}

async function loadSettings() {
  const payload = await api('/api/settings');
  state.settings = payload.settings || {};
  state.settingsVersion = payload.version ?? 1;
  state.capabilities = payload.capabilities || {};
  state.killSwitchActive = payload.killSwitchActive === true;
  populateSettings();

  if (state.killSwitchActive) {
    $('engineText').textContent = 'ENTRY LOCK ACTIVE';
    $('enginePill').dataset.active = 'false';
    $('startAutoBtn').disabled = true;
    $('killBtn').textContent = 'Emergency lock active';
    $('killBtn').disabled = true;
  }
}

async function saveSettings(mode = null) {
  clearError();
  if (!state.settings) await loadSettings();

  const strategy = strategyFromUI();
  const sizeSol = amountSol();

  // Trading Terminal owns only trading/risk fields. Never overwrite
  // discovery platform, AI profile, or unrelated System settings here.
  const next = {
    ...state.settings,
    ...strategy,
    positionSize: sizeSol
  };

  if (mode === 'automate') {
    next.operatingMode = 'automate';
    next.tradingEnvironment = 'paper';
    next.ownerApproval = false;
  } else if (mode === 'observe') {
    next.operatingMode = 'observe';
    next.tradingEnvironment = 'paper';
  }

  const payload = await api('/api/settings', {
    method: 'PUT',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({
      settings: next,
      version: state.settingsVersion
    })
  });

  state.settings = payload.settings || next;
  state.settingsVersion = payload.version ?? state.settingsVersion;
  populateSettings();

  const reevaluated = num(payload.decisionsReevaluated);
  $('saveState').textContent = Number.isFinite(reevaluated)
    ? `Saved v${state.settingsVersion} · ${reevaluated} decisions re-evaluated`
    : `Saved v${state.settingsVersion}`;

  return payload;
}

async function onSaveStrategy() {
  try {
    $('saveStrategyBtn').disabled = true;
    await saveSettings();
  } catch (error) {
    if (error.status === 409) await loadSettings().catch(() => {});
    showError(error.message);
  } finally {
    $('saveStrategyBtn').disabled = false;
  }
}

async function onStartAuto() {
  try {
    $('startAutoBtn').disabled = true;
    await saveSettings('automate');
    await loadPaper();
  } catch (error) {
    if (error.status === 409) await loadSettings().catch(() => {});
    showError(error.message);
  } finally {
    if (!state.killSwitchActive) $('startAutoBtn').disabled = false;
  }
}

async function onPause() {
  try {
    $('pauseBtn').disabled = true;
    await saveSettings('observe');
    $('saveState').textContent = `New entries paused · open paper positions continue receiving price updates`;
  } catch (error) {
    showError(error.message);
  } finally {
    $('pauseBtn').disabled = false;
  }
}

async function onKill() {
  const ok = window.confirm(
    'Activate the server entry kill switch? This blocks new paper entries. The current API does not expose a one-click unlock route, so use this only as an emergency lock.'
  );
  if (!ok) return;

  try {
    await saveSettings('observe');
    await api('/api/settings/kill-switch', { method: 'POST' });
    state.killSwitchActive = true;
    $('engineText').textContent = 'ENTRY LOCK ACTIVE';
    $('enginePill').dataset.active = 'false';
    $('startAutoBtn').disabled = true;
    $('killBtn').textContent = 'Emergency lock active';
    $('killBtn').disabled = true;
  } catch (error) {
    showError(error.message);
  }
}

function filteredCandidates() {
  if (state.filter === 'all') return state.candidates;
  return state.candidates.filter(item => String(item.state || '').toUpperCase() === state.filter);
}

function renderCandidates() {
  const list = $('candidateList');
  const rows = filteredCandidates();

  if (!rows.length) {
    list.innerHTML = `<div class="empty">No ${state.filter === 'all' ? '' : esc(state.filter)} candidates right now</div>`;
    return;
  }

  list.innerHTML = rows.map(item => {
    const price = candidatePrice(item);
    const stateText = String(item.state || 'WAITING').toUpperCase();
    return `
      <button class="candidate ${item.mint === state.selectedMint ? 'selected' : ''}" data-mint="${esc(item.mint)}" type="button">
        <div class="candidate-top">
          <div class="candidate-name">
            <strong>${esc(item.symbol || item.name || short(item.mint))}</strong>
            <span>${esc(item.name || short(item.mint))}</span>
          </div>
          <span class="state-dot ${decisionClass(stateText)}">${esc(stateText)}</span>
        </div>
        <div class="candidate-bottom">
          <span>Score ${fmt(item.score, 0)} · Holders ${fmt(item.holderCount ?? item.holders, 0)}</span>
          <span class="candidate-price">${price ? `${fmt(price, 9)} SOL` : 'Price —'}</span>
        </div>
      </button>
    `;
  }).join('');

  list.querySelectorAll('.candidate').forEach(button => {
    button.addEventListener('click', () => selectCandidate(button.dataset.mint));
  });
}

async function loadCandidates() {
  const payload =
    await api(
      '/api/ai/decisions?scope=all&limit=100'
    );

  state.candidates =
    Array.isArray(payload.decisions)
      ? payload.decisions
      : [];

  $('candidateCount').textContent =
    `${state.candidates.length} candidates`;

  if(
    !state.selectedMint &&
    state.candidates.length
  ){
    const ready =
      state.candidates.find(
        item =>
          String(item.state).toUpperCase()===
          'BUY READY'
      );

    state.selectedMint =
      (ready||state.candidates[0]).mint;
  }

  if(state.selectedMint){
    const current =
      state.candidates.find(
        item =>
          item.mint===state.selectedMint
      );

    if(current){
      state.selected=current;
    }
  }

  // IMPORTANT V30.3.1:
  // candidate/decision prices never enter raw chart history.
  // /api/chart/stream is the one chart-data authority.
  renderCandidates();
  renderSelected();
}

function selectCandidate(mint) {
  if (!mint) return;
  state.selectedMint = mint;
  state.selected = state.candidates.find(item => item.mint === mint) || null;
  chartRuntime.forceFit = true;
  chartRuntime.dataKey = '';
  renderCandidates();
  renderSelected();
  connectChartStream(mint);
  updateAmountHint();
  scheduleChart();
}

function renderSelected() {
  const c = state.selected;
  if (!c) {
    $('tokenName').textContent = 'Select a candidate';
    return;
  }

  const stateText = String(c.state || 'WAITING').toUpperCase();
  $('tokenName').textContent = `${c.symbol || 'TOKEN'} · ${c.name || ''}`.replace(/\s+·\s*$/, '');
  $('tokenState').textContent = stateText;
  $('tokenState').className = `decision-badge ${decisionClass(stateText)}`;
  $('tokenMint').textContent = short(c.mint, 7, 6);

  const price = candidatePrice(c);
  $('tokenPrice').textContent = price > 0 ? `${fmt(price, 10)} SOL` : '— SOL';
  $('tokenMarket').textContent = `MC ${finite(c.marketCapUsd) ? '$' + fmt(c.marketCapUsd, 0) : fmt(c.marketCapSol ?? c.marketCap, 1) + ' SOL'} · BP ${fmt(c.buyPressure, 2)}×`;

  $('metricScore').textContent = fmt(c.score, 0);
  $('metricHolders').textContent = fmt(c.holderCount ?? c.holders, 0);
  $('metricTop10').textContent = finite(c.top10Pct ?? c.top10) ? `${fmt(c.top10Pct ?? c.top10, 1)}%` : '—';
  $('metricDev').textContent = finite(c.developerPct ?? c.developer) ? `${fmt(c.developerPct ?? c.developer, 1)}%` : '—';
  $('metricLiquidity').textContent = finite(c.liquidityUsd) ? `$${fmt(c.liquidityUsd, 0)}` : `${fmt(c.liquiditySol ?? c.liquidity, 2)} SOL`;

  const avatar = $('tokenAvatar');
  const image = c.imageUrl || c.image || c.logoUrl;
  avatar.innerHTML = image
    ? `<img alt="" src="${esc(image)}" referrerpolicy="no-referrer">`
    : esc((c.symbol || c.name || '?').slice(0, 2).toUpperCase());

  updateAmountHint();
  scheduleChart();

  if (!state.chartSource || state.chartSource.__mint !== c.mint) {
    connectChartStream(c.mint);
  }
}

function rawPoints(mint) {
  if(!state.rawByMint.has(mint)){
    state.rawByMint.set(mint,[]);
  }
  return state.rawByMint.get(mint);
}

function normalizeChartPoint(point){
  if(
    !finite(point?.t) ||
    !finite(point?.price) ||
    !(Number(point.price)>0)
  ){
    return null;
  }

  return {
    id:point?.id?String(point.id):null,
    t:Number(point.t),
    price:Number(point.price),
    source:point?.source||null,
    isBuy:point?.isBuy===true,
    solAmount:num(point?.solAmount,0),
    tokenAmount:num(point?.tokenAmount,0),
    markPrice:finite(point?.markPrice)?Number(point.markPrice):null
  };
}

function replaceChartSnapshot(mint,incoming){
  const seen=new Set();
  const points=(Array.isArray(incoming)?incoming:[])
    .map(normalizeChartPoint)
    .filter(Boolean)
    .sort((a,b)=>a.t-b.t)
    .filter(point=>{
      if(!point.id)return true;
      if(seen.has(point.id))return false;
      seen.add(point.id);
      return true;
    })
    .slice(-6000);

  state.rawByMint.set(mint,points);
  chartRuntime.dataKey='';
  chartRuntime.forceFit=true;
  chartRuntime.lastCandleTime=null;
  chartRuntime.candleCount=0;
}

function addPoint(mint,point,redraw=true) {
  if(!mint)return false;

  const next=normalizeChartPoint(point);
  if(!next)return false;

  const points=rawPoints(mint);
  const last=points[points.length-1];

  // Server history already de-duplicates by transaction signature + event index.
  // Do not rescan the whole browser history on every tick.
  const late=Boolean(last && next.t<last.t);
  points.push(next);

  if(late){
    points.sort((a,b)=>a.t-b.t);
  }

  if(points.length>8000){
    points.splice(0,points.length-8000);
  }

  if(redraw){
    if(late){
      chartRuntime.dataKey='';
      scheduleChart();
    }else{
      updateRealtimeChart(mint);
    }
  }

  return true;
}

function connectChartStream(mint) {
  if(state.chartSource){
    state.chartSource.close();
    state.chartSource=null;
  }

  if(!mint || !window.EventSource)return;

  $('feedState').textContent='CONNECTING';

  const source=new EventSource(
    `/api/chart/stream?tokenAddress=${encodeURIComponent(mint)}`
  );
  source.__mint=mint;

  const parseIncoming=event=>{
    const payload=JSON.parse(event.data||'{}');
    const incoming=[];
    if(payload.point)incoming.push(payload.point);
    if(Array.isArray(payload.points))incoming.push(...payload.points);
    return {payload,incoming};
  };

  source.addEventListener('snapshot',event=>{
    try{
      const {payload,incoming}=parseIncoming(event);
      replaceChartSnapshot(mint,incoming);
      $('feedState').textContent=
        payload?.status?.stale===false || incoming.length
          ? 'LIVE'
          : 'WAITING';
      scheduleChart();
    }catch(error){
      console.warn('[MEMEFLOW CHART] snapshot',error);
    }
  });

  source.addEventListener('update',event=>{
    try{
      const {payload,incoming}=parseIncoming(event);
      let changed=false;
      for(const point of incoming){
        changed=addPoint(mint,point,false)||changed;
      }
      if(changed)updateRealtimeChart(mint);
      if(payload?.status?.stale===false || incoming.length){
        $('feedState').textContent='LIVE';
      }
    }catch(error){
      console.warn('[MEMEFLOW CHART] update',error);
    }
  });

  source.onerror=()=>{
    $('feedState').textContent='RECONNECTING';
  };

  source.onopen=()=>{
    $('feedState').textContent='CONNECTED';
  };

  state.chartSource=source;
}

function chartInterval(points,timeframe){
  if(timeframe!=='all'){
    return Math.max(1000,Number(timeframe)||1000);
  }

  const clean=(Array.isArray(points)?points:[])
    .filter(point=>finite(point?.t));

  if(clean.length<2)return 1000;

  const span=Math.max(
    1,
    Number(clean[clean.length-1].t)-Number(clean[0].t)
  );
  const raw=Math.ceil(span/100);
  const steps=[
    1000,5000,15000,30000,
    60000,300000,900000,
    3600000
  ];
  return steps.find(step=>step>=raw)||3600000;
}

function candlesFor(points, timeframe) {
  const clean=(Array.isArray(points)?points:[])
    .filter(
      point=>
        finite(point?.t) &&
        finite(point?.price) &&
        Number(point.price)>0
    );

  if(!clean.length)return [];

  const interval=chartInterval(clean,timeframe);
  const candles=[];
  let candle=null;

  for(const point of clean){
    const price=Number(point.price);
    const bucket=
      Math.floor(Number(point.t)/interval)*interval;

    if(!candle || candle.t!==bucket){
      candle={
        t:bucket,
        open:price,
        high:price,
        low:price,
        close:price,
        samples:1,
        interval
      };
      candles.push(candle);
      continue;
    }

    candle.high=Math.max(candle.high,price);
    candle.low=Math.min(candle.low,price);
    candle.close=price;
    candle.samples++;
  }

  return candles.slice(-500);
}

function latestCandleFor(points,timeframe){
  if(timeframe==='all')return null;
  if(!Array.isArray(points)||!points.length)return null;

  const interval=Math.max(1000,Number(timeframe)||1000);
  let i=points.length-1;

  while(i>=0 && !(
    finite(points[i]?.t) &&
    finite(points[i]?.price) &&
    Number(points[i].price)>0
  ))i--;

  if(i<0)return null;

  const bucket=
    Math.floor(Number(points[i].t)/interval)*interval;

  let first=i;
  while(
    first>0 &&
    Number(points[first-1]?.t)>=bucket
  ){
    first--;
  }

  let candle=null;
  for(let j=first;j<=i;j++){
    const point=points[j];
    if(
      !finite(point?.t) ||
      !finite(point?.price) ||
      Number(point.price)<=0
    )continue;

    const pointBucket=
      Math.floor(Number(point.t)/interval)*interval;
    if(pointBucket!==bucket)continue;

    const price=Number(point.price);
    if(!candle){
      candle={
        t:bucket,
        open:price,
        high:price,
        low:price,
        close:price,
        samples:1,
        interval
      };
    }else{
      candle.high=Math.max(candle.high,price);
      candle.low=Math.min(candle.low,price);
      candle.close=price;
      candle.samples++;
    }
  }

  return candle;
}

function strategyLevels() {
  if (!state.selectedMint) return [];
  const position = state.positions.find(p => p.status === 'OPEN' && p.mint === state.selectedMint);
  const entry = num(position?.entryPriceSol, candidatePrice(state.selected));
  if (!(entry > 0)) return [];

  const hard = num($('hardStopPct').value, state.settings?.hardStopPct);
  const tp1 = num($('tp1Pct').value, state.settings?.tp1Pct);
  const tp2 = num($('tp2Pct').value, state.settings?.tp2Pct);
  const tp1Sell = num($('tp1SellPct').value, state.settings?.tp1SellPct);
  const tp2Sell = num($('tp2SellPct').value, state.settings?.tp2SellPct);

  return [
    { label: 'ENTRY', price: entry, kind: 'entry' },
    hard > 0 ? { label: `SL -${fmt(hard, 1)}%`, price: entry * (1 - hard / 100), kind: 'stop' } : null,
    tp1 > 0 ? { label: `TP1 +${fmt(tp1, 0)}% · SELL ${fmt(tp1Sell, 0)}%`, price: entry * (1 + tp1 / 100), kind: 'tp' } : null,
    tp2 > 0 ? { label: `TP2 +${fmt(tp2, 0)}% · SELL ${fmt(tp2Sell, 0)}%`, price: entry * (1 + tp2 / 100), kind: 'tp2' } : null
  ].filter(Boolean);
}

const chartRuntime={
  api:null,
  series:null,
  priceLines:[],
  dataKey:'',
  levelsKey:'',
  mint:null,
  timeframe:null,
  raf:null,
  forceFit:true,
  initialized:false,
  candleCount:0,
  lastCandleTime:null,
  offscreenLevels:[]
};

function ensureChartEngine(){
  if(chartRuntime.initialized){
    return Boolean(chartRuntime.api&&chartRuntime.series);
  }

  chartRuntime.initialized=true;

  const LW=window.LightweightCharts;
  const host=$('chartCanvas');

  if(
    !LW ||
    typeof LW.createChart!=='function' ||
    !LW.CandlestickSeries
  ){
    $('chartEmpty').style.display='grid';
    $('chartEmpty').innerHTML=
      '<strong>Chart library unavailable</strong>'+
      '<span>Lightweight Charts did not load. Reload the page or check network access.</span>';
    return false;
  }

  chartRuntime.api=LW.createChart(
    host,
    {
      autoSize:true,
      layout:{
        background:{
          type:'solid',
          color:'#02070a'
        },
        textColor:'#536f7b',
        attributionLogo:true,
        fontFamily:'ui-monospace, SFMono-Regular, Menlo, monospace',
        fontSize:9
      },
      grid:{
        vertLines:{
          color:'rgba(106,145,162,.055)'
        },
        horzLines:{
          color:'rgba(106,145,162,.07)'
        }
      },
      rightPriceScale:{
        borderVisible:false,
        scaleMargins:{
          top:.14,
          bottom:.14
        }
      },
      timeScale:{
        borderVisible:false,
        timeVisible:true,
        secondsVisible:true,
        rightOffset:3,
        barSpacing:11,
        minBarSpacing:3,
        fixLeftEdge:false,
        fixRightEdge:false
      },
      crosshair:{
        mode:LW.CrosshairMode?.Normal ?? 0,
        vertLine:{
          color:'rgba(120,176,195,.28)',
          width:1,
          style:LW.LineStyle?.Dotted ?? 1,
          labelBackgroundColor:'#0b171d'
        },
        horzLine:{
          color:'rgba(120,176,195,.28)',
          width:1,
          style:LW.LineStyle?.Dotted ?? 1,
          labelBackgroundColor:'#0b171d'
        }
      },
      handleScroll:{
        mouseWheel:true,
        pressedMouseMove:true,
        horzTouchDrag:true,
        vertTouchDrag:false
      },
      handleScale:{
        axisPressedMouseMove:true,
        mouseWheel:true,
        pinch:true
      }
    }
  );

  chartRuntime.series=chartRuntime.api.addSeries(
    LW.CandlestickSeries,
    {
      upColor:'#4de6a1',
      downColor:'#ff6679',
      wickUpColor:'#4de6a1',
      wickDownColor:'#ff6679',
      borderVisible:false,
      priceLineVisible:false,
      lastValueVisible:true,
      priceFormat:{
        type:'custom',
        minMove:1e-14,
        formatter:formatPrice
      }
    }
  );

  chartRuntime.api.subscribeCrosshairMove(param=>{
    if(!param?.time)return;

    const data=param.seriesData?.get?.(
      chartRuntime.series
    );

    if(
      data &&
      finite(data.open) &&
      finite(data.high) &&
      finite(data.low) &&
      finite(data.close)
    ){
      $('chartLegend').dataset.crosshair='true';
      renderLegend(
        data,
        null,
        null
      );
    }
  });

  return true;
}

function chartCandle(candle){
  return {
    time:Math.floor(Number(candle.t)/1000),
    open:Number(candle.open),
    high:Number(candle.high),
    low:Number(candle.low),
    close:Number(candle.close)
  };
}

function clearStrategyPriceLines(){
  if(!chartRuntime.series)return;

  for(const line of chartRuntime.priceLines){
    try{
      chartRuntime.series.removePriceLine(line);
    }catch{}
  }

  chartRuntime.priceLines=[];
}

function refreshStrategyPriceLines(candles){
  if(
    !chartRuntime.series ||
    !candles?.length
  ){
    clearStrategyPriceLines();
    return [];
  }

  const levels=strategyLevels();

  const values=candles.flatMap(c=>[
    Number(c.high),
    Number(c.low)
  ]);

  const min=Math.min(...values);
  const max=Math.max(...values);
  const span=Math.max(
    max-min,
    Math.abs(max||1)*.005
  );

  const visibleMin=Math.max(
    0,
    min-span*.25
  );
  const visibleMax=max+span*.25;

  const key=JSON.stringify(
    levels.map(level=>[
      level.label,
      Number(level.price),
      level.price>=visibleMin && level.price<=visibleMax
    ])
  );

  if(key===chartRuntime.levelsKey){
    return levels.filter(
      level =>
        level.price<visibleMin ||
        level.price>visibleMax
    );
  }

  chartRuntime.levelsKey=key;
  clearStrategyPriceLines();

  const LW=window.LightweightCharts;

  for(const level of levels){
    if(!(level?.price>0))continue;

    // Far-away targets never participate in chart scaling.
    if(
      level.price<visibleMin ||
      level.price>visibleMax
    ){
      continue;
    }

    const color=
      level.kind==='stop'
        ? '#ff6679'
        : level.kind==='entry'
          ? '#55d9ff'
          : level.kind==='tp'
            ? '#4de6a1'
            : '#a98bff';

    try{
      chartRuntime.priceLines.push(
        chartRuntime.series.createPriceLine({
          price:Number(level.price),
          color,
          lineWidth:1,
          lineStyle:LW.LineStyle?.Dashed ?? 2,
          axisLabelVisible:false,
          title:level.label
        })
      );
    }catch{}
  }

  return levels.filter(
    level =>
      level.price<visibleMin ||
      level.price>visibleMax
  );
}

function renderLegend(last,totalCandles,totalTicks,offscreenLevels=[]){
  if(!last){
    $('chartLegend').innerHTML='';
    return;
  }

  const parts=[
    `<span>O ${formatPrice(last.open)}</span>`,
    `<span>H ${formatPrice(last.high)}</span>`,
    `<span>L ${formatPrice(last.low)}</span>`,
    `<span>C ${formatPrice(last.close)}</span>`
  ];

  if(totalCandles!==null && totalCandles!==undefined){
    parts.push(
      `<span>${totalCandles} candles · ${totalTicks||0} trades</span>`
    );
  }

  for(const level of offscreenLevels.slice(0,3)){
    const current=Number(last.close);
    const arrow=Number(level.price)>current?'↑':'↓';
    parts.push(
      `<span>${arrow} ${esc(level.label)}</span>`
    );
  }

  $('chartLegend').innerHTML=parts.join('');
}

function scheduleChart(){
  if(chartRuntime.raf)return;

  chartRuntime.raf=requestAnimationFrame(()=>{
    chartRuntime.raf=null;
    drawChart();
  });
}

function updateRealtimeChart(mint){
  if(
    mint!==state.selectedMint ||
    !ensureChartEngine()
  ){
    return;
  }

  if(state.timeframe==='all'){
    chartRuntime.dataKey='';
    scheduleChart();
    return;
  }

  const points=rawPoints(mint);
  const last=latestCandleFor(
    points,
    state.timeframe
  );

  if(!last){
    scheduleChart();
    return;
  }

  const runtimeChanged=
    chartRuntime.mint!==mint ||
    chartRuntime.timeframe!==state.timeframe;

  if(runtimeChanged){
    chartRuntime.forceFit=true;
    chartRuntime.dataKey='';
    scheduleChart();
    return;
  }

  try{
    chartRuntime.series.update(
      chartCandle(last)
    );
  }catch{
    chartRuntime.dataKey='';
    scheduleChart();
    return;
  }

  if(chartRuntime.lastCandleTime!==last.t){
    if(
      chartRuntime.lastCandleTime!==null &&
      last.t>chartRuntime.lastCandleTime
    ){
      chartRuntime.candleCount++;
    }
    chartRuntime.lastCandleTime=last.t;
  }

  const lastPoint=points[points.length-1];
  chartRuntime.dataKey=[
    mint,
    String(state.timeframe),
    points.length,
    Number(lastPoint?.t||0),
    Number(lastPoint?.price||0)
  ].join('|');

  renderLegend(
    last,
    chartRuntime.candleCount||1,
    points.length,
    chartRuntime.offscreenLevels||[]
  );
}

function drawChart() {
  if(!ensureChartEngine())return;

  if(!state.selectedMint){
    chartRuntime.series.setData([]);
    $('chartEmpty').style.display='grid';
    $('chartLegend').innerHTML='';
    return;
  }

  const points=rawPoints(
    state.selectedMint
  );

  const candles=candlesFor(
    points,
    state.timeframe
  );

  if(!candles.length){
    chartRuntime.series.setData([]);
    $('chartEmpty').style.display='grid';
    $('chartLegend').innerHTML='';
    return;
  }

  $('chartEmpty').style.display='none';

  const lastPoint=points[points.length-1];

  const dataKey=[
    state.selectedMint,
    String(state.timeframe),
    points.length,
    Number(lastPoint?.t||0),
    Number(lastPoint?.price||0)
  ].join('|');

  const contextChanged=
    chartRuntime.mint!==state.selectedMint ||
    chartRuntime.timeframe!==state.timeframe;

  if(
    dataKey!==chartRuntime.dataKey ||
    contextChanged
  ){
    chartRuntime.series.setData(
      candles.map(chartCandle)
    );

    chartRuntime.dataKey=dataKey;
    chartRuntime.mint=state.selectedMint;
    chartRuntime.timeframe=state.timeframe;
    chartRuntime.candleCount=candles.length;
    chartRuntime.lastCandleTime=candles[candles.length-1]?.t??null;
  }

  chartRuntime.api.timeScale().applyOptions({
    timeVisible:true,
    secondsVisible:
      Number(state.timeframe)<=1000,
    rightOffset:
      Number(state.timeframe)<=1000
        ? 3
        : 2,
    barSpacing:
      Number(state.timeframe)<=1000
        ? 12
        : 9
  });

  const offscreen=refreshStrategyPriceLines(
    candles
  );
  chartRuntime.offscreenLevels=offscreen;

  const last=candles[candles.length-1];

  const totalTicks=candles.reduce(
    (sum,candle)=>
      sum+Number(candle.samples||0),
    0
  );

  renderLegend(
    last,
    candles.length,
    totalTicks,
    offscreen
  );

  if(
    chartRuntime.forceFit ||
    contextChanged
  ){
    chartRuntime.forceFit=false;

    requestAnimationFrame(()=>{
      try{
        chartRuntime.api.timeScale().fitContent();
      }catch{}
    });
  }
}

function formatPrice(price) {
  if (!finite(price)) return '—';

  const p = Number(price);

  if (!(p >= 0)) return '—';

  if (p >= 1000) {
    return p.toLocaleString(
      undefined,
      {maximumFractionDigits:2}
    );
  }

  if (p >= 1) return p.toFixed(4);
  if (p >= .01) return p.toFixed(6);
  if (p >= .0001) return p.toFixed(8);

  if (p === 0) return '0';

  const magnitude =
    Math.floor(Math.log10(Math.abs(p)));

  const decimals =
    Math.max(
      8,
      Math.min(
        14,
        -magnitude + 4
      )
    );

  return p
    .toFixed(decimals)
    .replace(/0+$/,'')
    .replace(/\.$/,'');
}

async function loadPaper() {
  const [positionsPayload, tradesPayload, statusPayload] = await Promise.all([
    api('/api/paper/positions'),
    api('/api/paper/trades'),
    api('/api/paper/status')
  ]);

  state.positions = Array.isArray(positionsPayload.positions) ? positionsPayload.positions : [];
  state.trades = Array.isArray(tradesPayload.trades) ? tradesPayload.trades : [];
  state.paperStatus = statusPayload || {};
  renderPositions();
  renderTrades();

  const pnl = num(statusPayload.realizedPnlSol, 0);
  $('paperPnl').textContent = `${pnl >= 0 ? '+' : ''}${fmt(pnl, 5)} SOL`;
  $('paperPnl').className = pnl > 0 ? 'pnl-positive' : pnl < 0 ? 'pnl-negative' : '';

  scheduleChart();
}

function renderPositions() {
  const rows = state.positions.filter(p => p.status === 'OPEN');
  const list = $('positionsList');

  if (!rows.length) {
    list.innerHTML = `<div class="empty">No open paper positions</div>`;
    return;
  }

  list.innerHTML = rows.map(position => {
    const pnl = num(position.unrealizedPnlPct, 0);
    const settings = position.settingsSnapshot || {};
    return `
      <div class="position-row">
        <div><span>TOKEN</span><strong class="position-symbol">${esc(position.symbol || short(position.mint))}</strong></div>
        <div><span>SIZE</span><strong>${fmt(position.remainingSizeSol ?? position.initialSizeSol, 4)} SOL</strong></div>
        <div><span>P&L</span><strong class="${pnl >= 0 ? 'pnl-positive' : 'pnl-negative'}">${pnl >= 0 ? '+' : ''}${fmt(pnl, 2)}%</strong></div>
        <div><span>SL</span><strong>${fmt(settings.hardStopPct, 1)}%</strong></div>
        <div><span>TP1 / TP2</span><strong>${fmt(settings.tp1Pct, 0)}% / ${fmt(settings.tp2Pct, 0)}%</strong></div>
        <button class="close-position" data-id="${esc(position.id)}" type="button">Close</button>
      </div>
    `;
  }).join('');

  list.querySelectorAll('.close-position').forEach(button => {
    button.addEventListener('click', async () => {
      if (!window.confirm('Close this PAPER position at the engine current price?')) return;
      button.disabled = true;
      try {
        await api(`/api/paper/positions/${encodeURIComponent(button.dataset.id)}/close`, { method: 'POST' });
        await loadPaper();
      } catch (error) {
        showError(error.message);
      } finally {
        button.disabled = false;
      }
    });
  });
}

function renderTrades() {
  const rows = state.trades.slice(0, 40);
  const list = $('tradeHistory');

  if (!rows.length) {
    list.innerHTML = `<div class="empty">No paper trades yet</div>`;
    return;
  }

  list.innerHTML = rows.map(trade => {
    const side = String(trade.side || '').toUpperCase();
    const time = trade.at || trade.createdAt || trade.timestamp;
    const reason = trade.reason || trade.exitReason || 'ENGINE';
    return `
      <div class="trade-row">
        <strong class="trade-side ${side.toLowerCase()}">${esc(side || '—')}</strong>
        <span>${esc(trade.symbol || short(trade.mint))}</span>
        <span>${fmt(trade.valueSol ?? trade.amountSol ?? trade.sizeSol, 4)} SOL</span>
        <span>${finite(trade.realizedPnlSol) ? `${num(trade.realizedPnlSol) >= 0 ? '+' : ''}${fmt(trade.realizedPnlSol, 5)}` : '—'}</span>
        <span>${esc(reason)}${time ? ` · ${new Date(time).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}` : ''}</span>
      </div>
    `;
  }).join('');
}

function walletProvider() {
  if (window.phantom?.solana?.isPhantom) return window.phantom.solana;
  if (window.solana?.isPhantom) return window.solana;
  if (window.solflare?.isSolflare) return window.solflare;
  return null;
}

async function connectWallet() {
  clearError();
  const provider = walletProvider();
  if (!provider) {
    showError('No injected Solana wallet provider detected. Open this page inside Phantom/Solflare or install a compatible wallet. MEMEFLOW will never request a seed phrase.');
    return;
  }

  try {
    const result = await provider.connect();
    const publicKey = result?.publicKey || provider.publicKey;
    if (!publicKey) throw new Error('Wallet connected without a public key.');

    state.walletProvider = provider;
    state.walletAddress = String(publicKey.toString());
    $('walletState').textContent = 'CONNECTED';
    $('walletState').style.color = '#4de6a1';
    $('walletAddress').textContent = state.walletAddress;
    $('walletBtn').textContent = short(state.walletAddress, 5, 4);
  } catch (error) {
    showError(error.message || 'Wallet connection failed.');
  }
}

function bind() {
  $('walletBtn').addEventListener('click', connectWallet);
  $('copyMintBtn').addEventListener('click', async () => {
    if (!state.selectedMint) return;
    try {
      await navigator.clipboard.writeText(state.selectedMint);
      $('copyMintBtn').textContent = 'Copied';
      setTimeout(() => $('copyMintBtn').textContent = 'Copy', 900);
    } catch {}
  });

  $('candidateList').addEventListener('click', event => {
    const button = event.target.closest('.candidate');
    if (button?.dataset.mint) selectCandidate(button.dataset.mint);
  });

  document.querySelectorAll('.candidate-filter button').forEach(button => {
    button.addEventListener('click', () => {
      state.filter = button.dataset.filter;
      document.querySelectorAll('.candidate-filter button').forEach(b => b.classList.toggle('active', b === button));
      renderCandidates();
    });
  });

  document.querySelectorAll('#timeframes button').forEach(button => {
    button.addEventListener('click', () => {
      state.timeframe = button.dataset.tf === 'all' ? 'all' : Number(button.dataset.tf);
      document.querySelectorAll('#timeframes button').forEach(b => b.classList.toggle('active', b === button));
      chartRuntime.forceFit = true;
      chartRuntime.dataKey = '';
      scheduleChart();
    });
  });

  document.querySelectorAll('#unitToggle button').forEach(button => {
    button.addEventListener('click', () => {
      state.unit = button.dataset.unit;
      document.querySelectorAll('#unitToggle button').forEach(b => b.classList.toggle('active', b === button));
      updateAmountHint();
    });
  });

  $('amountInput').addEventListener('input', updateAmountHint);
  ['hardStopPct', 'trailingStopPct', 'tp1Pct', 'tp1SellPct', 'tp2Pct', 'tp2SellPct', 'runnerPct']
    .forEach(id => $(id).addEventListener('input', updateAllocation));

  $('saveStrategyBtn').addEventListener('click', onSaveStrategy);
  $('startAutoBtn').addEventListener('click', onStartAuto);
  $('pauseBtn').addEventListener('click', onPause);
  $('killBtn').addEventListener('click', onKill);

  window.addEventListener('resize', scheduleChart);
}

async function poll() {
  if (state.polling) return;
  state.polling = true;
  try {
    await loadCandidates();
    await loadPaper();
  } catch (error) {
    $('feedState').textContent = 'DEGRADED';
  } finally {
    state.polling = false;
  }
}

async function init() {
  bind();
  try {
    await loadSettings();
  } catch (error) {
    showError(`Settings: ${error.message}`);
  }

  await poll();
  setInterval(poll, 1800);
  scheduleChart();
}

init();

/* MEMEFLOW_TRADING_CHART_V30_2 */

/* MEMEFLOW_TRADING_CHART_V30_3_1 */

/* MEMEFLOW_TRADING_CHART_V30_4 */
/* MEMEFLOW_TRADING_CHART_V30_5_EXECUTION_OHLC */
