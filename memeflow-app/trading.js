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
  unit: 'USD',
  solUsd: null,
  solUsdUpdatedAt: null,
  timeframe: 1000,
  chartMetric: (() => {
    try {
      return localStorage.getItem('memeflow:chart-metric') === 'marketCap'
        ? 'marketCap'
        : 'price';
    } catch {
      return 'price';
    }
  })(),
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

function solUsdRate(candidate = state.selected) {
  const live = num(state.solUsd);
  if (live > 0) return live;

  const direct = impliedSolUsd(candidate);
  if (direct > 0) return direct;

  for (const row of state.candidates || []) {
    const inferred = impliedSolUsd(row);
    if (inferred > 0) return inferred;
  }

  return null;
}

function usdFromSol(value, candidate = state.selected) {
  const sol = num(value);
  const rate = solUsdRate(candidate);
  return sol !== null && rate > 0 ? sol * rate : null;
}

function tokenSupply(candidate = state.selected) {
  const direct = num(
    candidate?.totalSupply ??
    candidate?.supply ??
    candidate?.tokenSupply
  );
  if (direct > 0) return direct;

  const priceSol = candidatePrice(candidate);
  const mcSol = num(candidate?.marketCapSol ?? candidate?.marketCap);
  if (priceSol > 0 && mcSol > 0) return mcSol / priceSol;

  const priceUsd = usdFromSol(priceSol, candidate);
  const mcUsd = num(candidate?.marketCapUsd ?? candidate?.marketCapUSD);
  if (priceUsd > 0 && mcUsd > 0) return mcUsd / priceUsd;

  return null;
}

function marketCapUsdForPrice(priceUsd, candidate = state.selected) {
  const px = num(priceUsd);
  if (!(px > 0)) return null;

  const supply = tokenSupply(candidate);
  if (supply > 0) return px * supply;

  const storedUsd = num(candidate?.marketCapUsd ?? candidate?.marketCapUSD);
  if (storedUsd > 0) return storedUsd;

  const storedSol = num(candidate?.marketCapSol ?? candidate?.marketCap);
  const converted = usdFromSol(storedSol, candidate);
  return converted > 0 ? converted : null;
}

const breakoutFxRuntime={
  canvas:null,
  ctx:null,
  particles:[],
  raf:0,
  resizeObs:null,
  lastKey:''
};

function ensureBreakoutFxCanvas(){
  if(breakoutFxRuntime.canvas?.isConnected)return breakoutFxRuntime.canvas;

  const chartHost=$('chartCanvas');
  const mount=chartHost?.parentElement || chartHost;
  if(!mount)return null;

  const style=getComputedStyle(mount);
  if(style.position==='static'){
    mount.style.position='relative';
  }

  let canvas=mount.querySelector('.mf-breakout-fx');
  if(!canvas){
    canvas=document.createElement('canvas');
    canvas.className='mf-breakout-fx';
    canvas.style.position='absolute';
    canvas.style.inset='0';
    canvas.style.width='100%';
    canvas.style.height='100%';
    canvas.style.pointerEvents='none';
    canvas.style.zIndex='5';
    mount.appendChild(canvas);
  }

  breakoutFxRuntime.canvas=canvas;
  breakoutFxRuntime.ctx=canvas.getContext('2d');

  const resize=()=>resizeBreakoutFxCanvas();
  breakoutFxRuntime.resizeObs?.disconnect?.();

  if(typeof ResizeObserver==='function'){
    breakoutFxRuntime.resizeObs=new ResizeObserver(resize);
    breakoutFxRuntime.resizeObs.observe(mount);
  }

  resize();
  return canvas;
}

function resizeBreakoutFxCanvas(){
  const canvas=breakoutFxRuntime.canvas;
  const ctx=breakoutFxRuntime.ctx;
  if(!canvas || !ctx)return;

  const rect=canvas.getBoundingClientRect();
  const dpr=Math.max(1,window.devicePixelRatio||1);
  const width=Math.max(1,Math.round(rect.width*dpr));
  const height=Math.max(1,Math.round(rect.height*dpr));

  if(canvas.width!==width || canvas.height!==height){
    canvas.width=width;
    canvas.height=height;
  }

  ctx.setTransform(dpr,0,0,dpr,0,0);
}

function animateBreakoutFx(){
  if(breakoutFxRuntime.raf)return;

  const step=()=>{
    breakoutFxRuntime.raf=0;

    const canvas=breakoutFxRuntime.canvas;
    const ctx=breakoutFxRuntime.ctx;
    if(!canvas || !ctx)return;

    resizeBreakoutFxCanvas();
    const rect=canvas.getBoundingClientRect();
    ctx.clearRect(0,0,rect.width,rect.height);

    const next=[];

    for(const p of breakoutFxRuntime.particles){
      p.x+=p.vx;
      p.y+=p.vy;
      p.vy+=0.014;
      p.life*=0.94;
      p.radius*=p.glow ? 1.01 : 0.995;

      if(p.life<=0.03)continue;
      next.push(p);

      ctx.save();
      ctx.globalAlpha=Math.max(0,p.life);

      if(p.glow){
        const g=ctx.createRadialGradient(
          p.x,p.y,0,
          p.x,p.y,p.radius
        );
        g.addColorStop(0,'rgba(73,242,163,0.42)');
        g.addColorStop(0.4,'rgba(73,242,163,0.18)');
        g.addColorStop(1,'rgba(73,242,163,0)');
        ctx.fillStyle=g;
        ctx.beginPath();
        ctx.arc(p.x,p.y,p.radius,0,Math.PI*2);
        ctx.fill();
      }else{
        ctx.fillStyle=p.color;
        ctx.shadowColor=p.color;
        ctx.shadowBlur=10;
        ctx.beginPath();
        ctx.arc(p.x,p.y,p.radius,0,Math.PI*2);
        ctx.fill();
      }

      ctx.restore();
    }

    breakoutFxRuntime.particles=next;

    if(next.length){
      breakoutFxRuntime.raf=requestAnimationFrame(step);
    }else{
      ctx.clearRect(0,0,rect.width,rect.height);
    }
  };

  breakoutFxRuntime.raf=requestAnimationFrame(step);
}

function spawnBreakoutFx(x,y,power=1){
  if(!Number.isFinite(x) || !Number.isFinite(y))return;
  if(!ensureBreakoutFxCanvas())return;

  const count=Math.max(12,Math.min(28,Math.round(14*power)));
  const color='#49f2a3';

  for(let i=0;i<count;i++){
    const angle=(-Math.PI/2)+((Math.random()-0.5)*1.2);
    const speed=(1.3+Math.random()*3.4)*power;

    breakoutFxRuntime.particles.push({
      x,
      y,
      vx:Math.cos(angle)*speed + (Math.random()-0.5)*1.2,
      vy:Math.sin(angle)*speed,
      life:0.92,
      radius:1 + Math.random()*2.6,
      color,
      glow:false
    });
  }

  breakoutFxRuntime.particles.push({
    x,
    y,
    vx:0,
    vy:-0.12,
    life:0.9,
    radius:18*power,
    color,
    glow:true
  });

  animateBreakoutFx();
}

function breakoutLevelValue(level){
  if(!level || typeof level!=='object')return null;

  for(const key of [
    'price',
    'value',
    'level',
    'linePrice',
    'target',
    'triggerPrice',
    'y'
  ]){
    const raw=Number(level?.[key]);
    if(Number.isFinite(raw) && raw>0)return raw;
  }

  return null;
}

function breakoutLevelLooksGreen(level){
  const label=String(
    level?.label ||
    level?.text ||
    level?.title ||
    level?.name ||
    ''
  ).toLowerCase();

  const color=String(
    level?.color ||
    level?.stroke ||
    level?.lineColor ||
    ''
  ).toLowerCase();

  return (
    /tp|target|green|bull|resistance|break/i.test(label) ||
    /#0f|#1f|#2f|#3f|#4f|green|lime|emerald/.test(color)
  );
}

function chooseBreakoutLevel(levels,curr){
  const currentHigh=Number(curr?.high||0);
  const currentClose=Number(curr?.close||0);
  if(!(currentHigh>0) || !(currentClose>0))return null;

  const mapped=(Array.isArray(levels)?levels:[])
    .map(level=>({
      raw:level,
      value:breakoutLevelValue(level),
      green:breakoutLevelLooksGreen(level)
    }))
    .filter(item=>Number.isFinite(item.value) && item.value>0)
    .filter(item=>item.value<=currentHigh*1.02)
    .sort((a,b)=>a.value-b.value);

  if(!mapped.length)return null;

  const greenish=mapped.filter(item=>item.green);
  const pool=greenish.length ? greenish : mapped;
  let chosen=null;

  for(const item of pool){
    if(item.value<=currentClose*1.01){
      chosen=item;
    }
  }

  return chosen?.value ?? pool[pool.length-1]?.value ?? null;
}

function breakoutStrength(prev,curr,level){
  const range=Math.max(1e-12,Number(curr.high)-Number(curr.low));
  const body=Math.abs(Number(curr.close)-Number(curr.open));
  const closeOver=Math.max(0,Number(curr.close)-level)/Math.max(level,1e-12);

  let power=1;
  if(body/range>=0.65)power+=0.22;
  if(closeOver>=0.003)power+=0.22;
  if(closeOver>=0.008)power+=0.18;
  return Math.min(1.8,power);
}

function isStrongGreenBreakout(prev,curr,level){
  if(!prev || !curr || !(level>0))return false;

  const prevClose=Number(prev.close);
  const currOpen=Number(curr.open);
  const currClose=Number(curr.close);
  const currHigh=Number(curr.high);
  const currLow=Number(curr.low);

  if(
    !Number.isFinite(prevClose) ||
    !Number.isFinite(currOpen) ||
    !Number.isFinite(currClose) ||
    !Number.isFinite(currHigh) ||
    !Number.isFinite(currLow)
  ){
    return false;
  }

  const crossedUp=
    prevClose<=level &&
    currClose>level;

  const greenBody=currClose>currOpen;
  const range=Math.max(1e-12,currHigh-currLow);
  const body=Math.abs(currClose-currOpen);
  const bodyRatio=body/range;
  const decisiveClose=(currClose-level)/Math.max(level,1e-12)>=0.0025;

  return crossedUp && greenBody && bodyRatio>=0.55 && decisiveClose;
}

function maybeTriggerBullishBreakoutFx(prev,curr,levels){
  // Breakout FX is intentionally 1s-only.
  if(Number(state.timeframe)!==1000)return;
  if(!chartRuntime.api || !prev || !curr)return;

  const level=chooseBreakoutLevel(levels,curr);
  if(!(level>0))return;
  if(!isStrongGreenBreakout(prev,curr,level))return;

  const key=[
    state.selectedMint,
    state.timeframe,
    Number(curr.t||0),
    level.toFixed(12),
    Number(curr.close||0).toFixed(12)
  ].join('|');

  if(breakoutFxRuntime.lastKey===key)return;
  breakoutFxRuntime.lastKey=key;

  let pixel=null;
  try{
    pixel=chartRuntime.api.convertToPixel(
      {xAxisIndex:0,yAxisIndex:0},
      [String(Number(curr.t)),Number(curr.close)]
    );
  }catch{}

  const x=Array.isArray(pixel)?Number(pixel[0]):NaN;
  const y=Array.isArray(pixel)?Number(pixel[1]):NaN;

  if(!Number.isFinite(x) || !Number.isFinite(y))return;

  spawnBreakoutFx(
    x,
    y,
    breakoutStrength(prev,curr,level)
  );
}

function marketCapMetricAvailable(candidate = state.selected) {
  // Historical market cap requires a stable token supply.
  // Never fabricate a Pump supply just to keep the chart visible.
  return tokenSupply(candidate) > 0;
}

function persistChartMetric() {
  try {
    localStorage.setItem(
      'memeflow:chart-metric',
      state.chartMetric
    );
  } catch {}
}

function forcePriceMetricIfMarketCapUnavailable(candidate = state.selected) {
  if (state.chartMetric !== 'marketCap') return false;
  if (marketCapMetricAvailable(candidate)) return false;

  // V30.13: a missing supply/MC must NEVER erase valid BUY/SELL candles.
  // Stay in canonical price mode until enough data exists to calculate MC.
  state.chartMetric = 'price';
  persistChartMetric();
  return true;
}

function chartValueFromUsdPrice(priceUsd, candidate = state.selected) {
  const px = num(priceUsd);
  if (!(px > 0)) return null;
  if (state.chartMetric !== 'marketCap') return px;
  return marketCapUsdForPrice(px, candidate);
}

function formatMarketCap(value) {
  if (!finite(value)) return '$—';
  const n = Number(value);
  if (!(n >= 0)) return '$—';

  const abs = Math.abs(n);
  if (abs >= 1e9) return `$${fmt(n / 1e9, 2)}B`;
  if (abs >= 1e6) return `$${fmt(n / 1e6, 2)}M`;
  if (abs >= 1e3) return `$${fmt(n / 1e3, abs < 10000 ? 2 : 1)}K`;
  return `$${fmt(n, 2)}`;
}

function formatChartValue(value) {
  return state.chartMetric === 'marketCap'
    ? formatMarketCap(value)
    : formatPrice(value);
}

function renderPriceModeSummary(livePriceUsd = null) {
  const c = state.selected;
  if (!c) return;

  const priceUsd = num(livePriceUsd) > 0
    ? Number(livePriceUsd)
    : usdFromSol(candidatePrice(c), c);

  const mcUsd = marketCapUsdForPrice(priceUsd, c);
  const bp = fmt(c.buyPressure, 2);

  if (state.chartMetric === 'marketCap') {
    $('tokenPrice').textContent = mcUsd > 0 ? formatMarketCap(mcUsd) : '$—';
    $('tokenMarket').textContent =
      `MARKET CAP · PRICE ${priceUsd > 0 ? formatPrice(priceUsd) : '$—'} · BP ${bp}×`;
  } else {
    $('tokenPrice').textContent = priceUsd > 0 ? formatPrice(priceUsd) : '$—';
    $('tokenMarket').textContent =
      `PRICE · MC ${mcUsd > 0 ? formatMarketCap(mcUsd) : '—'} · BP ${bp}×`;
  }

  const button = $('priceModeBtn');
  if (button) {
    button.dataset.metric = state.chartMetric;
    button.setAttribute(
      'aria-label',
      state.chartMetric === 'marketCap'
        ? 'Market cap shown. Tap to show token price.'
        : 'Token price shown. Tap to show market cap.'
    );
    button.title =
      state.chartMetric === 'marketCap'
        ? 'Tap: show token price'
        : 'Tap: show market cap';
  }
}

function chartHorizonMs(timeframe) {
  // V30.12 FULL HISTORY:
  // Timeframe changes OHLC aggregation only. It never discards older trades.
  // 1s / 1m / 5m / 15m / 1h can all be dragged back to token creation.
  return null;
}

async function loadSolUsd() {
  const payload = await api('/api/market/sol-usd');
  const next = num(payload?.priceUsd);

  if (!(next > 0)) {
    throw new Error('SOL/USD rate is unavailable.');
  }

  const previous = num(state.solUsd);
  state.solUsd = next;
  state.solUsdUpdatedAt = payload?.updatedAt || Date.now();

  if (!previous || Math.abs(next / previous - 1) >= 0.0001) {
    // V30.11 REAL-TRADES-ONLY:
    // the 15s FX refresh may update labels/conversions, but it is not
    // chart market data and must never move/rebuild candles by itself.
    renderCandidates();
    renderSelected({ redrawChart: false });
    updateAmountHint();
  }

  return next;
}

function amountSol() {
  const amount = num($('amountInput').value, 0);
  if (!(amount > 0)) throw new Error('Position amount must be greater than 0.');
  if (state.unit === 'SOL') return amount;

  const rate = solUsdRate();
  if (!(rate > 0)) {
    throw new Error('USD → SOL conversion is temporarily unavailable.');
  }
  return amount / rate;
}

function updateAmountHint() {
  const value = num($('amountInput').value, 0);
  const rate = solUsdRate();

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

  const positionSol = finite(s.positionSize) ? Number(s.positionSize) : 0.1;
  const rate = solUsdRate();
  $('amountInput').value =
    state.unit === 'USD' && rate > 0
      ? (positionSol * rate).toFixed(2)
      : positionSol;

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
          <span class="candidate-price">${price ? formatPrice(usdFromSol(price, item)) : '$—'}</span>
        </div>
      </button>
    `;
  }).join('');

  list.querySelectorAll('.candidate').forEach(button => {
    button.addEventListener('click', () => selectCandidate(button.dataset.mint));
  });
}

async function loadCandidates({ redrawChart = true } = {}) {
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
  renderSelected({ redrawChart });
}

function selectCandidate(mint) {
  if (!mint) return;
  state.selectedMint = mint;
  state.selected = state.candidates.find(item => item.mint === mint) || null;
  clearLiveTradeTape();
  chartRuntime.forceFit = true;
  chartRuntime.dataKey = '';
  renderCandidates();
  renderSelected();
  connectChartStream(mint);
  updateAmountHint();
  scheduleChart();
}

function tokenImageCandidates(value){
  const raw=String(value||'').trim();
  if(!raw)return [];

  const out=[];
  const add=url=>{
    const clean=String(url||'').trim();
    if(
      clean &&
      /^https?:\/\//i.test(clean) &&
      !out.includes(clean)
    ){
      out.push(clean);
    }
  };

  if(/^https?:\/\//i.test(raw))add(raw);

  let ipfsPath=null;
  if(/^ipfs:\/\//i.test(raw)){
    ipfsPath=raw
      .replace(/^ipfs:\/\//i,'')
      .replace(/^ipfs\//i,'');
  }else{
    const match=/\/ipfs\/(.+)$/i.exec(raw);
    if(match?.[1])ipfsPath=match[1];
  }

  if(ipfsPath){
    const cleanPath=ipfsPath.replace(/^\/+/,'');
    add(`https://ipfs.io/ipfs/${cleanPath}`);
    add(`https://dweb.link/ipfs/${cleanPath}`);
    add(`https://gateway.pinata.cloud/ipfs/${cleanPath}`);
  }

  if(/^ar:\/\//i.test(raw)){
    add(`https://arweave.net/${raw.replace(/^ar:\/\//i,'').replace(/^\/+/,'')}`);
  }

  return out;
}

const tokenAvatarRuntime={
  resolvedUrlByMint:new Map(),
  loadingKey:'',
  generation:0
};

function renderTokenAvatar(candidate){
  const avatar=$('tokenAvatar');
  if(!avatar)return;

  const mint=String(candidate?.mint||'');
  const fallback=String(
    candidate?.symbol ||
    candidate?.name ||
    '?'
  ).slice(0,2).toUpperCase();

  const sameMint=
    avatar.dataset.mint===mint;

  const currentImg=
    sameMint
      ? avatar.querySelector('img')
      : null;

  // IMPORTANT V30.17:
  // Candidate polling may call renderSelected() several times per second.
  // Never erase an already loaded image for the same mint while metadata
  // refreshes. The old code did avatar.textContent=fallback on every call,
  // producing the visible IMAGE -> "FU" -> IMAGE flicker.
  if(!sameMint){
    avatar.dataset.mint=mint;
    avatar.dataset.imageSrc='';
    avatar.textContent=fallback;
  }

  const image=
    candidate?.imageUrl ||
    candidate?.image ||
    candidate?.logoUrl ||
    null;

  const cached=
    tokenAvatarRuntime.resolvedUrlByMint.get(mint) ||
    null;

  const urls=[
    ...(cached ? [cached] : []),
    ...tokenImageCandidates(image)
  ].filter((url,index,array)=>
    url && array.indexOf(url)===index
  );

  // Transient metadata responses are allowed to omit imageUrl.
  // If this mint already has a successful image, keep it on screen.
  if(!urls.length){
    if(currentImg)return;
    if(!sameMint){
      avatar.textContent=fallback;
    }
    return;
  }

  const currentSrc=
    currentImg?.currentSrc ||
    currentImg?.src ||
    avatar.dataset.imageSrc ||
    '';

  if(
    currentImg &&
    urls.some(url=>String(currentSrc)===String(url))
  ){
    return;
  }

  const requestKey=
    `${mint}|${urls.join('|')}`;

  if(
    sameMint &&
    tokenAvatarRuntime.loadingKey===requestKey
  ){
    return;
  }

  tokenAvatarRuntime.loadingKey=requestKey;
  const generation=++tokenAvatarRuntime.generation;
  let index=0;

  const tryNext=()=>{
    if(
      avatar.dataset.mint!==mint ||
      generation!==tokenAvatarRuntime.generation ||
      index>=urls.length
    ){
      if(tokenAvatarRuntime.loadingKey===requestKey){
        tokenAvatarRuntime.loadingKey='';
      }
      return;
    }

    const url=urls[index];
    const img=new Image();
    img.alt='';
    img.referrerPolicy='no-referrer';
    img.decoding='async';

    img.onload=()=>{
      if(
        avatar.dataset.mint!==mint ||
        generation!==tokenAvatarRuntime.generation
      ){
        return;
      }

      tokenAvatarRuntime.resolvedUrlByMint.set(
        mint,
        url
      );
      tokenAvatarRuntime.loadingKey='';

      avatar.dataset.imageSrc=url;
      avatar.replaceChildren(img);
    };

    img.onerror=()=>{
      index++;
      tryNext();
    };

    // Preload off-DOM. Existing image remains visible until this succeeds.
    img.src=url;
  };

  tryNext();
}

function renderSelected({ redrawChart = true } = {}) {
  const c = state.selected;
  if (!c) {
    $('tokenName').textContent = 'Select a candidate';
    return;
  }

  const metricForcedToPrice =
    forcePriceMetricIfMarketCapUnavailable(c);

  if (metricForcedToPrice) {
    chartRuntime.forceFit = true;
    chartRuntime.dataKey = '';
    chartRuntime.levelsKey = '';
    chartRuntime.metric = null;
  }

  const stateText = String(c.state || 'WAITING').toUpperCase();
  $('tokenName').textContent = `${c.symbol || 'TOKEN'} · ${c.name || ''}`.replace(/\s+·\s*$/, '');
  $('tokenState').textContent = stateText;
  $('tokenState').className = `decision-badge ${decisionClass(stateText)}`;
  $('tokenMint').textContent = short(c.mint, 7, 6);

  const price = candidatePrice(c);
  const priceUsd = usdFromSol(price, c);
  renderPriceModeSummary(priceUsd);

  $('metricScore').textContent = fmt(c.score, 0);
  $('metricHolders').textContent = fmt(c.holderCount ?? c.holders, 0);
  $('metricTop10').textContent = finite(c.top10Pct ?? c.top10) ? `${fmt(c.top10Pct ?? c.top10, 1)}%` : '—';
  $('metricDev').textContent = finite(c.developerPct ?? c.developer) ? `${fmt(c.developerPct ?? c.developer, 1)}%` : '—';

  const liquidityUsd =
    num(c.liquidityUsd) ??
    usdFromSol(c.liquiditySol ?? c.liquidity, c);
  $('metricLiquidity').textContent =
    liquidityUsd !== null ? `$${fmt(liquidityUsd, 0)}` : '—';

  renderTokenAvatar(c);

  updateAmountHint();
  if (redrawChart) scheduleChart();

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
  const source=String(point?.source||'').trim();
  const solAmount=num(point?.solAmount,0);
  const tokenAmount=num(point?.tokenAmount,0);
  const hasSide=
    point?.isBuy===true ||
    point?.isBuy===false;

  // V30.11: the chart accepts executions only.
  // A mark/seed/timer point without actual trade size is not chart data.
  const isRealTrade=
    hasSide &&
    (solAmount>0 || tokenAmount>0) &&
    source!=='current-price-seed';

  const priceSol =
    finite(point?.priceSol)
      ? Number(point.priceSol)
      : finite(point?.markPrice)
        ? Number(point.markPrice)
        : finite(point?.price)
          ? Number(point.price)
          : null;

  if(
    !isRealTrade ||
    !finite(point?.t) ||
    !(priceSol > 0)
  ){
    return null;
  }

  return {
    id:point?.id?String(point.id):null,
    t:Number(point.t),
    // Raw history is canonical SOL post-trade curve price.
    // USD/market-cap display conversion never creates a chart point.
    price:Number(priceSol),
    priceSol:Number(priceSol),
    source:source||null,
    isBuy:point.isBuy===true,
    solAmount,
    tokenAmount,
    markPrice:Number(priceSol)
  };
}

function replaceChartSnapshot(mint,incoming){
  const previous=rawPoints(mint).slice();
  const merged=[
    ...previous,
    ...(Array.isArray(incoming)?incoming:[])
      .map(normalizeChartPoint)
      .filter(Boolean)
  ].sort((a,b)=>a.t-b.t);

  const seenIds=new Set();
  const seenFallback=new Set();
  const points=[];

  for(const point of merged){
    if(point.id){
      if(seenIds.has(point.id))continue;
      seenIds.add(point.id);
    }else{
      const key=[
        Number(point.t),
        Number(point.priceSol||point.price||0),
        point.isBuy===true?1:0,
        Number(point.solAmount||0),
        Number(point.tokenAmount||0)
      ].join('|');
      if(seenFallback.has(key))continue;
      seenFallback.add(key);
    }
    points.push(point);
  }

  // Snapshot/reconnect packets can repeat the same history.
  // Rebuild only when at least one NEW real trade was actually added.
  const changed=points.length!==previous.length;

  state.rawByMint.set(mint,points);

  if(changed){
    chartRuntime.dataKey='';
    // Fit only on the first real trade snapshot.
    if(!previous.length)chartRuntime.forceFit=true;
  }

  return changed;
}

function addPoint(mint,point,redraw=true) {
  if(!mint)return false;

  const next=normalizeChartPoint(point);
  if(!next)return false;

  const points=rawPoints(mint);
  const last=points[points.length-1];

  if(
    next.id &&
    (last?.id===next.id || points.slice(-64).some(item=>item?.id===next.id))
  ){
    return false;
  }

  // Server history already de-duplicates by transaction signature + event index.
  // Do not rescan the whole browser history on every tick.
  const late=Boolean(last && next.t<last.t);
  points.push(next);

  if(late){
    points.sort((a,b)=>a.t-b.t);
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

function formatTapeAmount(value) {
  const n = Number(value);
  if (!(n > 0)) return '$0';
  if (n >= 1000000) return `$${fmt(n / 1000000, 1)}M`;
  if (n >= 1000) return `$${fmt(n / 1000, 1)}K`;
  if (n >= 100) return `$${fmt(n, 0)}`;
  if (n >= 10) return `$${fmt(n, 1)}`;
  if (n >= 1) return `$${fmt(n, 1)}`;
  return `$${fmt(n, 2)}`;
}

function clearLiveTradeTape() {
  const host = $('liveTradeTape');
  if (host) host.replaceChildren();
}

function pushLiveTradeTape(mint, point) {
  if (mint !== state.selectedMint) return;

  const host = $('liveTradeTape');
  if (!host) return;

  const sol = num(point?.solAmount);
  const rate = solUsdRate();
  const usd = sol > 0 && rate > 0 ? sol * rate : null;
  if (!(usd > 0)) return;

  const row = document.createElement('div');
  row.className = `live-tape-row ${point?.isBuy === true ? 'buy' : 'sell'}`;
  row.innerHTML =
    `<span class="live-tape-arrow">${point?.isBuy === true ? '▲' : '▼'}</span>` +
    `<strong>${esc(formatTapeAmount(usd))}</strong>`;

  host.prepend(row);

  while (host.children.length > 8) {
    host.lastElementChild?.remove();
  }

  window.setTimeout(() => {
    row.classList.add('leaving');
    window.setTimeout(() => row.remove(), 420);
  }, 3300);
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
      const changed=replaceChartSnapshot(mint,incoming);
      $('feedState').textContent=
        payload?.status?.backfillRunning===true
          ? 'HISTORY SYNC'
          : payload?.status?.fullHistoryReady===true
            ? 'LIVE · FULL HISTORY'
            : payload?.status?.stale===false || incoming.length
              ? 'LIVE'
              : 'WAITING';

      // History sync is allowed to redraw only when it supplied new,
      // canonical BUY/SELL TradeEvents.
      if(changed) scheduleChart();
    }catch(error){
      console.warn('[MEMEFLOW CHART] snapshot',error);
    }
  });

  source.addEventListener('update',event=>{
    try{
      const {payload,incoming}=parseIncoming(event);
      let changed=false;
      for(const point of incoming){
        pushLiveTradeTape(mint, point);
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

function chartBirthAnchor(points){
  const rows=Array.isArray(points)?points:[];
  for(const point of rows){
    const t=Number(point?.t);
    if(Number.isFinite(t))return t;
  }
  return null;
}

function chartBucketFromBirth(time,interval,anchor){
  const t=Number(time);
  const step=Math.max(1,Number(interval)||1);
  const origin=Number(anchor);

  if(!Number.isFinite(t))return null;
  if(!Number.isFinite(origin))return t;

  // V30.18:
  // A newborn token must never appear to have existed before its first trade.
  // Buckets are aligned to token birth (first canonical real execution), not
  // to wall-clock boundaries such as 09:00 / 09:45 / 09:55.
  const offset=Math.max(0,t-origin);
  return origin + Math.floor(offset/step)*step;
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
  const clean = (Array.isArray(points) ? points : [])
    .filter(
      point =>
        finite(point?.t) &&
        finite(point?.priceSol ?? point?.price) &&
        Number(point?.priceSol ?? point?.price) > 0 &&
        (point?.isBuy===true || point?.isBuy===false) &&
        (Number(point?.solAmount||0)>0 || Number(point?.tokenAmount||0)>0)
    )
    .sort((a, b) => Number(a.t) - Number(b.t));

  if (!clean.length) return [];

  const rate = solUsdRate();
  if (!(rate > 0)) return [];

  const interval = chartInterval(clean, timeframe);
  const anchor = chartBirthAnchor(clean);
  const candles = [];
  let candle = null;

  for (const point of clean) {
    const priceSol = Number(point?.priceSol ?? point?.price);
    const price = chartValueFromUsdPrice(priceSol * rate);
    if (!(price > 0)) continue;

    const volumeUsd =
      Math.max(0, Number(point?.solAmount||0)) * rate;

    const bucket =
      chartBucketFromBirth(point.t,interval,anchor);

    if (!candle || candle.t !== bucket) {
      const open =
        candle && finite(candle.close)
          ? Number(candle.close)
          : price;

      candle = {
        t: bucket,
        open,
        high: Math.max(open, price),
        low: Math.min(open, price),
        close: price,
        samples: 1,
        interval,
        carry: false,
        volumeUsd,
        buyVolumeUsd: point?.isBuy===true ? volumeUsd : 0,
        sellVolumeUsd: point?.isBuy===false ? volumeUsd : 0
      };
      candles.push(candle);
    } else {
      candle.high = Math.max(candle.high, price);
      candle.low = Math.min(candle.low, price);
      candle.close = price;
      candle.samples++;
      candle.volumeUsd += volumeUsd;
      if(point?.isBuy===true)candle.buyVolumeUsd += volumeUsd;
      if(point?.isBuy===false)candle.sellVolumeUsd += volumeUsd;
    }
  }

  // Full real-trade history. No wall-clock filler and no empty candles.
  return candles;
}

function latestCandleFor(points, timeframe) {
  if (timeframe === 'all') return null;
  if (!Array.isArray(points) || !points.length) return null;

  const rate = solUsdRate();
  if (!(rate > 0)) return null;

  const interval = Math.max(1000, Number(timeframe) || 1000);
  const anchor = chartBirthAnchor(points);
  let i = points.length - 1;

  while (i >= 0 && !(
    finite(points[i]?.t) &&
    finite(points[i]?.priceSol ?? points[i]?.price) &&
    Number(points[i]?.priceSol ?? points[i]?.price) > 0
  )) i--;

  if (i < 0) return null;

  const bucket =
    chartBucketFromBirth(points[i].t,interval,anchor);

  let first = i;
  while (
    first > 0 &&
    Number(points[first - 1]?.t) >= bucket
  ) {
    first--;
  }

  let previousClose = null;
  for (let j = first - 1; j >= 0; j--) {
    const pointSol = Number(points[j]?.priceSol ?? points[j]?.price);
    if (!(Number.isFinite(pointSol) && pointSol > 0)) continue;
    const converted = chartValueFromUsdPrice(pointSol * rate);
    if (converted > 0) {
      previousClose = converted;
      break;
    }
  }

  let candle = null;

  for (let j = first; j <= i; j++) {
    const point = points[j];
    const pointSol = Number(point?.priceSol ?? point?.price);

    if (
      !finite(point?.t) ||
      !Number.isFinite(pointSol) ||
      pointSol <= 0
    ) continue;

    const pointBucket =
      chartBucketFromBirth(point.t,interval,anchor);
    if (pointBucket !== bucket) continue;

    const price = chartValueFromUsdPrice(pointSol * rate);
    if (!(price > 0)) continue;

    if (!candle) {
      const open =
        previousClose > 0
          ? previousClose
          : price;

      candle = {
        t: bucket,
        open,
        high: Math.max(open, price),
        low: Math.min(open, price),
        close: price,
        samples: 1,
        interval,
        carry: false
      };
    } else {
      candle.high = Math.max(candle.high, price);
      candle.low = Math.min(candle.low, price);
      candle.close = price;
      candle.samples++;
    }
  }

  return candle;
}

function strategyLevels() {
  if (!state.selectedMint) return [];

  const rate = solUsdRate();
  if (!(rate > 0)) return [];

  const position = state.positions.find(
    p => p.status === 'OPEN' && p.mint === state.selectedMint
  );

  let entrySol = num(position?.entryPriceSol);

  if (!(entrySol > 0)) {
    entrySol = chartRuntime.previewEntrySolByMint.get(state.selectedMint) ?? null;

    if (!(entrySol > 0)) {
      const points = rawPoints(state.selectedMint);
      const last = points[points.length - 1];
      entrySol = num(
        last?.priceSol ?? last?.price,
        candidatePrice(state.selected)
      );

      if (entrySol > 0) {
        chartRuntime.previewEntrySolByMint.set(
          state.selectedMint,
          entrySol
        );
      }
    }
  }

  if (!(entrySol > 0)) return [];

  const entry = chartValueFromUsdPrice(entrySol * rate);
  if (!(entry > 0)) return [];

  const hard = num($('hardStopPct').value, state.settings?.hardStopPct);
  const tp1 = num($('tp1Pct').value, state.settings?.tp1Pct);
  const tp2 = num($('tp2Pct').value, state.settings?.tp2Pct);
  const tp1Sell = num($('tp1SellPct').value, state.settings?.tp1SellPct);
  const tp2Sell = num($('tp2SellPct').value, state.settings?.tp2SellPct);

  return [
    { label: 'ENTRY', price: entry, kind: 'entry' },
    hard > 0
      ? { label: `SL -${fmt(hard, 1)}%`, price: entry * (1 - hard / 100), kind: 'stop' }
      : null,
    tp1 > 0
      ? { label: `TP1 +${fmt(tp1, 0)}% · SELL ${fmt(tp1Sell, 0)}%`, price: entry * (1 + tp1 / 100), kind: 'tp' }
      : null,
    tp2 > 0
      ? { label: `TP2 +${fmt(tp2, 0)}% · SELL ${fmt(tp2Sell, 0)}%`, price: entry * (1 + tp2 / 100), kind: 'tp2' }
      : null
  ].filter(Boolean);
}

const chartRuntime={
  api:null,
  series:{engine:'echarts'},
  dataKey:'',
  levelsKey:'',
  mint:null,
  timeframe:null,
  metric:null,
  raf:null,
  forceFit:true,
  initialized:false,
  candleCount:0,
  lastCandleTime:null,
  offscreenLevels:[],
  previewEntrySolByMint:new Map(),
  labels:[],
  lastCandles:[],
  viewport:{
    followLatest:true,
    startValue:null,
    endValue:null
  },
  suppressZoom:false,
  resizeObserver:null,
  pendingFx:null
};

function chartTimeLabel(value){
  const ms=Number(value);
  if(!Number.isFinite(ms))return '';

  const d=new Date(ms);
  const includeSeconds=
    Number(state.timeframe)<=30000;

  if(includeSeconds){
    return d.toLocaleTimeString([],{
      hour:'2-digit',
      minute:'2-digit',
      second:'2-digit'
    });
  }

  return d.toLocaleTimeString([],{
    hour:'2-digit',
    minute:'2-digit'
  });
}

function chartTouchUi(){
  return Boolean(
    (typeof window.matchMedia==='function' &&
      window.matchMedia('(pointer: coarse)').matches) ||
    Number(navigator.maxTouchPoints||0)>0
  );
}

function chartPointerTimeLabel(params){
  return chartTimeLabel(params?.value);
}

function compactVolume(value){
  const n=Number(value);
  if(!Number.isFinite(n))return '';
  if(Math.abs(n)>=1e6)return `${fmt(n/1e6,1)}M`;
  if(Math.abs(n)>=1e3)return `${fmt(n/1e3,1)}K`;
  if(Math.abs(n)>=100)return fmt(n,0);
  return fmt(n,1);
}

function movingAverage(candles,period,key='volumeUsd'){
  const out=new Array(candles.length).fill('-');
  let sum=0;

  for(let i=0;i<candles.length;i++){
    const value=Math.max(0,Number(candles[i]?.[key]||0));
    sum+=value;

    if(i>=period){
      sum-=Math.max(0,Number(candles[i-period]?.[key]||0));
    }

    if(i>=period-1){
      out[i]=sum/period;
    }
  }

  return out;
}

function chartLevelInfo(candles){
  const levels=strategyLevels();
  if(!candles.length || !levels.length){
    return {visible:[],offscreen:levels};
  }

  const basis=
    state.timeframe==='all'
      ? candles
      : candles.slice(-Math.min(140,candles.length));

  const values=basis.flatMap(c=>[
    Number(c.high),
    Number(c.low)
  ]).filter(Number.isFinite);

  if(!values.length){
    return {visible:[],offscreen:levels};
  }

  const min=Math.min(...values);
  const max=Math.max(...values);
  const span=Math.max(
    max-min,
    Math.abs(max||1)*.006
  );

  const low=Math.max(0,min-span*.30);
  const high=max+span*.30;

  return {
    visible:levels.filter(level=>
      Number(level?.price)>=low &&
      Number(level?.price)<=high
    ),
    offscreen:levels.filter(level=>
      Number(level?.price)<low ||
      Number(level?.price)>high
    )
  };
}

function levelColor(level){
  if(level?.kind==='stop')return '#ff6679';
  if(level?.kind==='entry')return '#55d9ff';
  if(level?.kind==='tp')return '#4de6a1';
  return '#a98bff';
}

// V30.19: keep sparse timeframes visually dense without inventing candles.
// These are render-only empty category slots. They never enter OHLC, volume,
// moving-average, trade, signal, TP/SL, or execution logic.
function chartVisibleBarsTarget(){
  return window.innerWidth<700
    ? 48
    : 84;
}

function chartDisplayData(candles){
  const actual=Array.isArray(candles)?candles:[];
  const target=chartVisibleBarsTarget();
  const padCount=Math.max(0,target-actual.length);

  // V30.22: newborn/sparse chart starts on the LEFT and grows to the RIGHT.
  // Empty render-only slots represent future screen space AFTER real candles.
  // They are not timestamps and never enter OHLC, volume, trade or signal logic.
  const futureLabels=Array.from(
    {length:padCount},
    (_,index)=>`__mf_future_${index}`
  );

  return {
    labels:actual
      .map(c=>String(Number(c.t)))
      .concat(futureLabels),
    rows:actual.concat(
      Array(padCount).fill(null)
    ),
    padCount
  };
}

function chartInitialRange(labels){
  const count=labels.length;
  if(!count){
    return {startValue:null,endValue:null};
  }

  if(state.timeframe==='all'){
    return {
      startValue:labels[0],
      endValue:labels[count-1]
    };
  }

  const visibleBars=chartVisibleBarsTarget();

  return {
    startValue:labels[Math.max(0,count-visibleBars)],
    endValue:labels[count-1]
  };
}

function captureChartViewport(){
  if(
    chartRuntime.suppressZoom ||
    !chartRuntime.api ||
    !chartRuntime.labels.length
  ){
    return;
  }

  try{
    const option=chartRuntime.api.getOption();
    const dz=option?.dataZoom?.[0]||{};
    const labels=chartRuntime.labels;
    const count=labels.length;

    let startIndex=0;
    let endIndex=count-1;

    if(Number.isFinite(Number(dz.start))){
      startIndex=Math.max(
        0,
        Math.min(
          count-1,
          Math.round(Number(dz.start)/100*Math.max(0,count-1))
        )
      );
    }

    if(Number.isFinite(Number(dz.end))){
      endIndex=Math.max(
        startIndex,
        Math.min(
          count-1,
          Math.round(Number(dz.end)/100*Math.max(0,count-1))
        )
      );
    }

    if(dz.startValue!==undefined && dz.startValue!==null){
      const i=labels.indexOf(String(dz.startValue));
      if(i>=0)startIndex=i;
    }

    if(dz.endValue!==undefined && dz.endValue!==null){
      const i=labels.indexOf(String(dz.endValue));
      if(i>=0)endIndex=i;
    }

    chartRuntime.viewport.followLatest=
      endIndex>=count-2;

    chartRuntime.viewport.startValue=
      labels[startIndex]??null;

    chartRuntime.viewport.endValue=
      labels[endIndex]??null;
  }catch{}
}

function ensureChartEngine(){
  if(chartRuntime.initialized){
    return Boolean(chartRuntime.api);
  }

  chartRuntime.initialized=true;

  const EC=window.echarts;
  const host=$('chartCanvas');

  if(
    !EC ||
    typeof EC.init!=='function' ||
    !host
  ){
    $('chartEmpty').style.display='grid';
    $('chartEmpty').innerHTML=
      '<strong>Chart library unavailable</strong>'+
      '<span>Apache ECharts did not load. Reload the page or check network access.</span>';
    return false;
  }

  chartRuntime.api=EC.init(
    host,
    null,
    {
      renderer:'canvas',
      useDirtyRect:true
    }
  );

  chartRuntime.api.on('datazoom',()=>{
    captureChartViewport();
  });

  if(chartTouchUi()){
    host.addEventListener(
      'touchstart',
      ()=>{
        try{
          chartRuntime.api?.dispatchAction?.({type:'hideTip'});
          chartRuntime.api?.dispatchAction?.({
            type:'updateAxisPointer',
            currTrigger:'leave'
          });
        }catch{}
      },
      {passive:true}
    );
  }

  chartRuntime.resizeObserver?.disconnect?.();

  if(typeof ResizeObserver==='function'){
    chartRuntime.resizeObserver=new ResizeObserver(()=>{
      try{chartRuntime.api?.resize?.()}catch{}
      resizeBreakoutFxCanvas();
    });
    chartRuntime.resizeObserver.observe(host);
  }else{
    window.addEventListener('resize',()=>{
      try{chartRuntime.api?.resize?.()}catch{}
      resizeBreakoutFxCanvas();
    },{passive:true});
  }

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

function renderLegend(last,totalCandles,totalTicks,offscreenLevels=[]){
  if(!last){
    $('chartLegend').innerHTML='';
    return;
  }

  const parts=[
    `<span>O ${formatChartValue(last.open)}</span>`,
    `<span>H ${formatChartValue(last.high)}</span>`,
    `<span>L ${formatChartValue(last.low)}</span>`,
    `<span>C ${formatChartValue(last.close)}</span>`
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

  const points=rawPoints(mint);
  const candles=candlesFor(
    points,
    state.timeframe
  );

  if(
    Number(state.timeframe)===1000 &&
    candles.length>=2
  ){
    chartRuntime.pendingFx={
      prev:candles[candles.length-2],
      curr:candles[candles.length-1],
      levels:strategyLevels()
    };
  }

  // ECharts receives one coalesced rAF redraw. The dataZoom viewport is
  // preserved by timestamp, so a viewer panned into history is not yanked live.
  chartRuntime.dataKey='';
  scheduleChart();
}

function drawChart(){
  if(!ensureChartEngine())return;

  if(!state.selectedMint){
    chartRuntime.api.clear();
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
    chartRuntime.api.clear();
    $('chartEmpty').style.display='grid';
    $('chartLegend').innerHTML='';
    renderPriceModeSummary();
    return;
  }

  $('chartEmpty').style.display='none';

  const display=chartDisplayData(candles);
  const labels=display.labels;
  const displayCandles=display.rows;

  const candleData=displayCandles.map(c=>
    c
      ? [
          Number(c.open),
          Number(c.close),
          Number(c.low),
          Number(c.high)
        ]
      : '-'
  );

  const actualVolumeData=candles.map(c=>({
    value:Math.max(0,Number(c.volumeUsd||0)),
    itemStyle:{
      color:
        Number(c.close)>=Number(c.open)
          ? 'rgba(77,230,161,.68)'
          : 'rgba(255,102,121,.64)'
    }
  }));

  // V30.22: indicator/volume geometry follows the same left-anchored
  // real-candle order. Future render slots stay empty on the RIGHT.
  const futurePad=Array(display.padCount).fill('-');
  const volumeData=actualVolumeData.concat(futurePad);
  const ma5=movingAverage(candles,5).concat(futurePad);
  const ma10=movingAverage(candles,10).concat(futurePad);

  const levelInfo=chartLevelInfo(candles);
  chartRuntime.offscreenLevels=levelInfo.offscreen;

  const last=candles[candles.length-1];

  const markLines=[
    ...levelInfo.visible.map(level=>({
      yAxis:Number(level.price),
      name:String(level.label||''),
      lineStyle:{
        color:levelColor(level),
        width:1,
        type:'dashed',
        opacity:.85
      },
      label:{
        show:false
      }
    })),
    {
      yAxis:Number(last.close),
      name:'LIVE',
      lineStyle:{
        color:'#55d9ff',
        width:1,
        type:'dashed',
        opacity:.82
      },
      label:{
        show:true,
        position:'end',
        color:'#021014',
        backgroundColor:'#55d9ff',
        borderRadius:2,
        padding:[2,4],
        fontSize:9,
        formatter:()=>formatChartValue(last.close)
      }
    }
  ];

  const contextChanged=
    chartRuntime.mint!==state.selectedMint ||
    chartRuntime.timeframe!==state.timeframe ||
    chartRuntime.metric!==state.chartMetric;

  let range=null;

  if(
    chartRuntime.forceFit ||
    contextChanged ||
    !chartRuntime.viewport.startValue ||
    !chartRuntime.viewport.endValue
  ){
    range=chartInitialRange(labels);
    chartRuntime.viewport.followLatest=true;
  }else if(chartRuntime.viewport.followLatest){
    range=chartInitialRange(labels);
  }else{
    const startExists=
      labels.includes(String(chartRuntime.viewport.startValue));
    const endExists=
      labels.includes(String(chartRuntime.viewport.endValue));

    range=
      startExists && endExists
        ? {
            startValue:String(chartRuntime.viewport.startValue),
            endValue:String(chartRuntime.viewport.endValue)
          }
        : chartInitialRange(labels);
  }

  const touchUi=chartTouchUi();

  chartRuntime.suppressZoom=true;

  chartRuntime.api.setOption(
    {
      animation:false,
      backgroundColor:'#02070a',
      textStyle:{
        color:'#536f7b',
        fontFamily:'ui-monospace, SFMono-Regular, Menlo, monospace',
        fontSize:9
      },
      axisPointer:{
        // Mobile Safari was interpreting a finger drag as an axis selection.
        // Touch mode must pan/zoom with no category shadow or raw timestamp label.
        show:!touchUi,
        triggerTooltip:!touchUi,
        link:touchUi ? [] : [{xAxisIndex:'all'}],
        snap:false,
        animation:false,
        label:{
          show:!touchUi,
          backgroundColor:'#0b171d',
          formatter:chartPointerTimeLabel
        }
      },
      tooltip:{
        show:!touchUi,
        showContent:!touchUi,
        trigger:touchUi ? 'none' : 'axis',
        triggerOn:touchUi ? 'none' : 'mousemove|click',
        alwaysShowContent:false,
        confine:true,
        axisPointer:{
          show:!touchUi,
          type:'line',
          snap:false,
          lineStyle:{
            color:'rgba(120,176,195,.30)',
            width:1,
            type:'dashed'
          },
          label:{
            show:!touchUi,
            formatter:chartPointerTimeLabel,
            backgroundColor:'#0b171d'
          }
        },
        backgroundColor:'rgba(5,12,17,.96)',
        borderColor:'rgba(111,170,190,.22)',
        textStyle:{
          color:'#cfe0e7',
          fontSize:10
        },
        extraCssText:'box-shadow:0 8px 30px rgba(0,0,0,.32);',
        formatter:params=>{
          const rows=Array.isArray(params)?params:[];
          const candleParam=rows.find(row=>row?.seriesName==='Price');
          const index=Number(candleParam?.dataIndex);
          const c=Number.isFinite(index)?displayCandles[index]:null;
          if(!c)return '';

          const time=chartTimeLabel(c.t);
          return [
            `<strong>${time}</strong>`,
            `O ${formatChartValue(c.open)}`,
            `H ${formatChartValue(c.high)}`,
            `L ${formatChartValue(c.low)}`,
            `C ${formatChartValue(c.close)}`,
            `VOL $${compactVolume(c.volumeUsd)}`
          ].join('<br>');
        }
      },
      legend:{
        data:['VOL','MAVOL5','MAVOL10'],
        left:10,
        top:'72%',
        itemWidth:10,
        itemHeight:6,
        textStyle:{
          color:'#718894',
          fontSize:8
        },
        selectedMode:false
      },
      grid:[
        {
          left:10,
          right:76,
          top:42,
          height:'55%',
          containLabel:false
        },
        {
          left:10,
          right:76,
          top:'77%',
          height:'15%',
          containLabel:false
        }
      ],
      xAxis:[
        {
          type:'category',
          data:labels,
          gridIndex:0,
          boundaryGap:true,
          axisLine:{show:false},
          axisTick:{show:false},
          axisLabel:{show:false},
          splitLine:{show:false},
          axisPointer:{
            show:!touchUi,
            type:'line',
            snap:false,
            label:{show:false}
          },
          // V30.20: force the full synthetic category range to exist.
          // Without this, dataMin/dataMax removes the empty pad slots and
          // stretches a few real candles across the entire chart.
          min:0,
          max:Math.max(0,labels.length-1)
        },
        {
          type:'category',
          data:labels,
          gridIndex:1,
          boundaryGap:true,
          axisLine:{
            show:true,
            lineStyle:{color:'rgba(111,154,172,.10)'}
          },
          axisTick:{show:false},
          axisLabel:{
            color:'#536f7b',
            fontSize:8,
            hideOverlap:true,
            formatter:value=>chartTimeLabel(value)
          },
          splitLine:{show:false},
          axisPointer:{
            show:!touchUi,
            type:'line',
            snap:false,
            label:{
              show:!touchUi,
              formatter:chartPointerTimeLabel,
              backgroundColor:'#0b171d'
            }
          },
          // V30.20: force the full synthetic category range to exist.
          // Without this, dataMin/dataMax removes the empty pad slots and
          // stretches a few real candles across the entire chart.
          min:0,
          max:Math.max(0,labels.length-1)
        }
      ],
      yAxis:[
        {
          type:'value',
          gridIndex:0,
          position:'right',
          scale:true,
          axisLine:{show:false},
          axisTick:{show:false},
          axisLabel:{
            color:'#536f7b',
            fontSize:9,
            margin:10,
            formatter:value=>formatChartValue(value)
          },
          splitLine:{
            show:true,
            lineStyle:{
              color:'rgba(106,145,162,.07)',
              width:1
            }
          }
        },
        {
          type:'value',
          gridIndex:1,
          position:'right',
          scale:true,
          axisLine:{show:false},
          axisTick:{show:false},
          axisLabel:{
            color:'#455c67',
            fontSize:7,
            margin:10,
            formatter:value=>compactVolume(value)
          },
          splitLine:{
            show:true,
            lineStyle:{
              color:'rgba(106,145,162,.045)',
              width:1
            }
          }
        }
      ],
      dataZoom:[
        {
          type:'inside',
          xAxisIndex:[0,1],
          filterMode:'filter',
          startValue:range.startValue,
          endValue:range.endValue,
          // V30.21: never let pinch/wheel zoom stretch just 1-2 candles
          // over the whole chart. Keep a professional minimum viewport.
          minValueSpan:window.innerWidth<700 ? 8 : 12,
          zoomOnMouseWheel:true,
          moveOnMouseMove:true,
          moveOnMouseWheel:true,
          preventDefaultMouseMove:true,
          throttle:24,
          cursorGrab:'grab',
          cursorGrabbing:'grabbing'
        }
      ],
      series:[
        {
          name:'Price',
          type:'candlestick',
          xAxisIndex:0,
          yAxisIndex:0,
          data:candleData,
          itemStyle:{
            color:'#4de6a1',
            color0:'#ff6679',
            borderColor:'#4de6a1',
            borderColor0:'#ff6679',
            borderWidth:1
          },
          // V30.21: candle body tracks category width while zooming.
          // Percentage width keeps the inter-candle gap proportional instead
          // of leaving a fixed 14px candle inside an ever-wider category.
          barWidth:'78%',
          emphasis:{disabled:true},
          markLine:{
            silent:true,
            symbol:['none','none'],
            data:markLines,
            lineStyle:{width:1}
          }
        },
        {
          name:'VOL',
          type:'bar',
          xAxisIndex:1,
          yAxisIndex:1,
          data:volumeData,
          // Keep volume aligned with the same zoom geometry.
          barWidth:'64%',
          large:true,
          largeThreshold:800,
          emphasis:{disabled:true}
        },
        {
          name:'MAVOL5',
          type:'line',
          xAxisIndex:1,
          yAxisIndex:1,
          data:ma5,
          showSymbol:false,
          connectNulls:false,
          smooth:false,
          silent:true,
          lineStyle:{
            width:1,
            color:'#ef9d42',
            opacity:.9
          }
        },
        {
          name:'MAVOL10',
          type:'line',
          xAxisIndex:1,
          yAxisIndex:1,
          data:ma10,
          showSymbol:false,
          connectNulls:false,
          smooth:false,
          silent:true,
          lineStyle:{
            width:1,
            color:'#d36bdf',
            opacity:.86
          }
        }
      ]
    },
    {
      notMerge:true,
      lazyUpdate:true
    }
  );

  chartRuntime.labels=labels;
  chartRuntime.lastCandles=candles;
  chartRuntime.mint=state.selectedMint;
  chartRuntime.timeframe=state.timeframe;
  chartRuntime.metric=state.chartMetric;
  chartRuntime.candleCount=candles.length;
  chartRuntime.lastCandleTime=last.t;
  chartRuntime.forceFit=false;

  chartRuntime.viewport.startValue=range.startValue;
  chartRuntime.viewport.endValue=range.endValue;

  setTimeout(()=>{
    chartRuntime.suppressZoom=false;
  },0);

  const totalTicks=candles.reduce(
    (sum,candle)=>
      sum+Number(candle.samples||0),
    0
  );

  renderLegend(
    last,
    candles.length,
    totalTicks,
    chartRuntime.offscreenLevels
  );

  const lastPoint=points[points.length-1];
  const rawSol=Number(lastPoint?.priceSol ?? lastPoint?.price);
  renderPriceModeSummary(
    Number.isFinite(rawSol) && rawSol>0
      ? rawSol*solUsdRate()
      : null
  );

  const fx=chartRuntime.pendingFx;
  chartRuntime.pendingFx=null;

  if(
    fx &&
    Number(state.timeframe)===1000
  ){
    requestAnimationFrame(()=>{
      try{
        maybeTriggerBullishBreakoutFx(
          fx.prev,
          fx.curr,
          fx.levels
        );
      }catch{}
    });
  }
}

function formatPrice(price) {
  if (!finite(price)) return '$—';

  const p = Number(price);
  if (!(p >= 0)) return '$—';

  let body;

  if (p >= 1000) {
    body = p.toLocaleString(
      undefined,
      {maximumFractionDigits:2}
    );
  } else if (p >= 1) {
    body = p.toFixed(4);
  } else if (p >= .01) {
    body = p.toFixed(6);
  } else if (p >= .0001) {
    body = p.toFixed(8);
  } else if (p === 0) {
    body = '0';
  } else {
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

    body = p
      .toFixed(decimals)
      .replace(/0+$/,'')
      .replace(/\.$/,'');
  }

  return `$${body}`;
}

async function loadPaper({ redrawChart = true } = {}) {
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

  if (redrawChart) scheduleChart();
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

  $('priceModeBtn').addEventListener('click', () => {
    const nextMetric =
      state.chartMetric === 'price'
        ? 'marketCap'
        : 'price';

    // Do not enter an impossible market-cap mode.
    // The old code switched first, then candlesFor() converted every real
    // trade to null when supply was unavailable, making the entire chart blank.
    if (
      nextMetric === 'marketCap' &&
      !marketCapMetricAvailable(state.selected)
    ) {
      state.chartMetric = 'price';
      persistChartMetric();

      chartRuntime.dataKey = '';
      chartRuntime.levelsKey = '';
      chartRuntime.metric = null;

      renderPriceModeSummary();
      scheduleChart();
      return;
    }

    state.chartMetric = nextMetric;
    persistChartMetric();

    chartRuntime.forceFit = true;
    chartRuntime.dataKey = '';
    chartRuntime.levelsKey = '';
    chartRuntime.metric = null;
    renderPriceModeSummary();
    scheduleChart();
  });
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
      const nextUnit = button.dataset.unit;
      if (nextUnit === state.unit) return;

      const rate = solUsdRate();
      const value = num($('amountInput').value, 0);

      if (!(rate > 0)) {
        showError('SOL/USD conversion is temporarily unavailable.');
        return;
      }

      if (state.unit === 'SOL' && nextUnit === 'USD') {
        $('amountInput').value = (value * rate).toFixed(2);
      } else if (state.unit === 'USD' && nextUnit === 'SOL') {
        $('amountInput').value = (value / rate).toFixed(5);
      }

      state.unit = nextUnit;

      document
        .querySelectorAll('#unitToggle button')
        .forEach(
          b => b.classList.toggle(
            'active',
            b.dataset.unit === state.unit
          )
        );

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

async function poll({ redrawChart = false } = {}) {
  if (state.polling) return;
  state.polling = true;
  try {
    // Polling may refresh cards/paper state, but it is not chart market data.
    await loadCandidates({ redrawChart });
    await loadPaper({ redrawChart });
  } catch (error) {
    $('feedState').textContent = 'DEGRADED';
  } finally {
    state.polling = false;
  }
}

async function init() {
  bind();

  try {
    await loadSolUsd();
  } catch (error) {
    console.warn('[MEMEFLOW USD]', error);
  }

  try {
    await loadSettings();
  } catch (error) {
    showError(`Settings: ${error.message}`);
  }

  // One initial draw is fine. Recurring UI polling must not redraw candles.
  await poll({ redrawChart: true });
  setInterval(
    () => poll({ redrawChart: false }),
    1800
  );

  // Currency refresh updates labels only; loadSolUsd() is chart-silent.
  setInterval(
    () => loadSolUsd().catch(
      error => console.warn('[MEMEFLOW USD]', error)
    ),
    15_000
  );

  // IMPORTANT V30.11:
  // There is intentionally NO 1-second chart timer here.
  // EventSource BUY/SELL TradeEvents are the live chart clock.
  scheduleChart();
}

init();

/* MEMEFLOW_TRADING_CHART_V30_2 */

/* MEMEFLOW_TRADING_CHART_V30_3_1 */

/* MEMEFLOW_TRADING_CHART_V30_4 */
/* MEMEFLOW_TRADING_CHART_V30_5_EXECUTION_OHLC */
/* MEMEFLOW_TRADING_CHART_V30_6_USD_CURVE_MARK */
/* MEMEFLOW_TRADING_CHART_V30_7_STABLE_HISTORY */
/* MEMEFLOW_TRADING_CHART_V30_8_PRICE_MC_GAP_SAFE */

/* MEMEFLOW_TRADING_CHART_V30_9_FAST_CONTINUOUS_TAPE_FIXED_LEVELS */
/* MEMEFLOW_TRADING_CHART_V30_11_REAL_TRADES_ONLY */
/* MEMEFLOW_TRADING_CHART_V30_12_FULL_HISTORY_FREE_PAN_IMAGES */
/* MEMEFLOW_TRADING_CHART_V30_13_SAFE_MARKET_CAP_TOGGLE */
/* MEMEFLOW_TRADING_CHART_V30_14_BREAKOUT_FX */
/* MEMEFLOW_TRADING_CHART_V30_14_1_BREAKOUT_FX_1S_ONLY */
/* MEMEFLOW_TRADING_CHART_V30_15_2_GMGN_ECHARTS */
/* MEMEFLOW_TRADING_CHART_V30_16_MOBILE_PAN_NO_SHADOW */
/* MEMEFLOW_TRADING_CHART_V30_17_STABLE_TOKEN_AVATAR */
/* MEMEFLOW_TRADING_CHART_V30_18_TOKEN_BIRTH_ANCHORED_TIMEFRAMES */
