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

  // MEMEFLOW_TERMINAL_WATCH_SYNC_V29
  // UI-only WATCH rows from Real-Time Pipeline.
  // Strict trading decisions remain in state.candidates.
  liveWatchCandidates: [],

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
  chartIndicators: (() => {
    const overlayAllowed = new Set(['MA', 'EMA', 'BOLL', 'SAR']);
    const lowerAllowed = new Set([
      'VOL', 'MACD', 'KDJ', 'RSI', 'STOCHRSI',
      'TRIX', 'OBV', 'WR', 'CCI', 'ROC', 'DMI',
      'VR', 'PSY', 'BIAS', 'DMA', 'EMV', 'ATR'
    ]);

    try {
      const parsed = JSON.parse(
        localStorage.getItem('memeflow:chart-indicators') || '{}'
      );

      const overlays = Array.isArray(parsed?.overlays)
        ? parsed.overlays.filter(name => overlayAllowed.has(name))
        : [];

      const lower = lowerAllowed.has(parsed?.lower)
        ? parsed.lower
        : null;

      return {
        overlays: [...new Set(overlays)],
        lower
      };
    } catch {
      return { overlays: [], lower: null };
    }
  })(),
  rawByMint: new Map(),
  chartSource: null,
  positions: [],
  trades: [],
  proposals: [],
  paperStatus: null,
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
  if (s.includes('OPEN')) return 'ready';
  if (s.includes('BUY')) return 'ready';
  if (s.includes('BLOCK')) return 'blocked';
  if (s.includes('WATCH')) return 'watch';
  return '';
}

function candidatePrice(candidate) {
  return num(candidate?.priceSol ?? candidate?.price);
}

/* MEMEFLOW_CANONICAL_TRADE_PRICE_AUTHORITY_V31
 *
 * PRICE / MC authority:
 *
 * 1. Once the selected mint has at least one canonical BUY/SELL TradeEvent,
 *    the newest TradeEvent price is the ONLY live price authority.
 *
 * 2. Candidate/AI polling is fallback-only and is never allowed to overwrite
 *    an already known canonical chart trade price.
 *
 * 3. This affects display PRICE/MC only.
 *    It does NOT create chart points and does NOT touch execution logic.
 */
function canonicalTradePriceSol(mint = state.selectedMint) {
  if (!mint) return null;

  const points = state.rawByMint.get(mint);

  if (!Array.isArray(points) || !points.length) {
    return null;
  }

  for (let i = points.length - 1; i >= 0; i--) {
    const point = points[i];

    const realSide =
      point?.isBuy === true ||
      point?.isBuy === false;

    const realSize =
      Number(point?.solAmount || 0) > 0 ||
      Number(point?.tokenAmount || 0) > 0;

    if (!realSide || !realSize) continue;

    const priceSol = num(
      point?.priceSol ??
      point?.markPrice ??
      point?.price
    );

    if (priceSol > 0) {
      return priceSol;
    }
  }

  return null;
}

function canonicalDisplayPriceUsd(
  candidate = state.selected,
  fallbackUsd = null
) {
  if (!candidate) return null;

  /*
   * Highest priority:
   * canonical real BUY/SELL trade already accepted by chart stream.
   */
  const tradePriceSol =
    canonicalTradePriceSol(candidate?.mint || state.selectedMint);

  if (tradePriceSol > 0) {
    const tradePriceUsd =
      usdFromSol(tradePriceSol, candidate);

    if (tradePriceUsd > 0) {
      return tradePriceUsd;
    }
  }

  /*
   * Second priority:
   * explicit value supplied by chart renderer.
   */
  const explicitUsd = num(fallbackUsd);

  if (explicitUsd > 0) {
    return explicitUsd;
  }

  /*
   * Last-resort bootstrap only:
   * candidate price before the first canonical TradeEvent arrives.
   */
  return usdFromSol(
    candidatePrice(candidate),
    candidate
  );
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

  // Pump.fun canonical supply fallback. Backend sends normalized supply,
  // but keep the UI toggle functional during a transient candidate refresh.
  const platform = String(
    candidate?.launchPlatform ??
    candidate?.protocol ??
    candidate?.source ??
    ''
  ).toLowerCase();

  if (platform.includes('pump')) return 1_000_000_000;

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

  // Candidate polling may pass an older snapshot here.
  // Once real BUY/SELL data exists, canonical TradeEvent price always wins.
  const priceUsd =
    canonicalDisplayPriceUsd(c, livePriceUsd);

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
  const payload = await api('/api/market/sol-usd', { signal: AbortSignal.timeout(4000) });
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
  if (!$('amountInput') || !$('amountHint')) return;
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
  if (!$('allocationBadge')) return;
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

  const text = (id, value) => {
    const node = $(id);
    if (node) node.textContent = value;
  };

  const value = (v, digits = 2) =>
    finite(v) ? fmt(Number(v), digits) : '—';

  text(
    'strategyPosition',
    finite(s.positionSize)
      ? `${value(s.positionSize, 4)} SOL`
      : '—'
  );

  text(
    'strategyStops',
    `Hard ${value(s.hardStopPct, 1)}% · Trail ${value(s.trailingStopPct, 1)}%`
  );

  text(
    'strategyTp1',
    `+${value(s.tp1Pct, 0)}% · sell ${value(s.tp1SellPct, 0)}%`
  );

  text(
    'strategyTp2',
    `+${value(s.tp2Pct, 0)}% · sell ${value(s.tp2SellPct, 0)}%`
  );

  text(
    'strategyRunner',
    `${value(s.runnerPct, 0)}% · ${value(s.maxHoldMinutes, 0)} min`
  );

  text(
    'strategyExitPressure',
    `${value(s.exitBuyPressure, 2)}× · weak ${s.exitOnWeakBuyPressure ? 'ON' : 'OFF'}`
  );

  text(
    'strategyDailyLimits',
    `${value(s.dailySpendLimit, 2)} spend · ${value(s.dailyLossLimit, 2)} loss SOL`
  );

  text(
    'strategyPositionLimits',
    `${value(s.maxOpenPositions, 0)} positions · ${value(s.maxDailyEntries, 0)}/day`
  );

  const mode = String(s.operatingMode || 'observe').toLowerCase();
  const badge = $('modeBadge');
  if (badge) {
    badge.textContent = mode.toUpperCase();
    badge.dataset.mode = mode;
  }

  $('engineText').textContent = mode === 'automate'
    ? 'PAPER AUTO ACTIVE'
    : mode === 'assist'
      ? 'PAPER ASSIST'
      : 'ENGINE OBSERVE';

  $('enginePill').dataset.active =
    mode === 'automate' && s.tradingEnvironment === 'paper'
      ? 'true'
      : 'false';

  text(
    'saveState',
    `Synced from System Settings · ${s.tradingEnvironment || 'paper'}`
  );

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
    if ($('startAutoBtn')) $('startAutoBtn').disabled = true;
    if ($('killBtn')) $('killBtn').textContent = 'Emergency lock active';
    if ($('killBtn')) $('killBtn').disabled = true;
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
  } else if (mode === 'assist') {
    next.operatingMode = 'assist';
    next.tradingEnvironment = 'paper';
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


async function onAssist() {
  try {
    $('assistBtn').disabled = true;
    await saveSettings('assist');
    await loadPaper();
    $('saveState').textContent = 'Manual review active · BUY READY tokens wait for Approve buy / Reject';
  } catch (error) {
    if (error.status === 409) await loadSettings().catch(() => {});
    showError(error.message);
  } finally {
    $('assistBtn').disabled = false;
  }
}

async function onStartAuto() {
  try {
    if ($('startAutoBtn')) $('startAutoBtn').disabled = true;
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
    if ($('startAutoBtn')) $('startAutoBtn').disabled = true;
    if ($('killBtn')) $('killBtn').textContent = 'Emergency lock active';
    if ($('killBtn')) $('killBtn').disabled = true;
  } catch (error) {
    showError(error.message);
  }
}

// MEMEFLOW_OPEN_POSITION_UI_V1
function openPositionForMint(mint) {
  if (!mint) return null;
  return (state.positions || []).find(
    position =>
      position?.mint === mint &&
      String(position?.status || '').toUpperCase() === 'OPEN'
  ) || null;
}

function isMintOpen(mint) {
  return Boolean(openPositionForMint(mint));
}

function positionAsCandidate(position) {
  return {
    mint: position.mint,
    symbol: position.symbol || 'TOKEN',
    name: position.name || position.symbol || short(position.mint),
    priceSol: num(position.currentPriceSol) ?? num(position.entryPriceSol),
    score: position.decisionScore ?? null,
    confidence: position.decisionConfidence ?? null,
    strategySource: position.strategySource || null,
    copyTradingWallet: position.copyTradingWallet || null,
    state: 'OPEN POSITION',
    __openPosition: position
  };
}

function mergedCandidates() {
  const candidates =
    Array.isArray(state.candidates)
      ? state.candidates
      : [];

  const pipelineWatch =
    Array.isArray(state.liveWatchCandidates)
      ? state.liveWatchCandidates
      : [];

  // Strict row owns data/execution whenever both feeds contain a mint.
  // Pipeline WATCH may overlay display classification for strict WAITING only.
  const byMint = new Map(
    candidates
      .filter(candidate => candidate?.mint)
      .map(candidate => [candidate.mint, candidate])
  );

  for (const watch of pipelineWatch) {
    const mint = String(watch?.mint || '').trim();
    if (!mint) continue;

    const strict = byMint.get(mint) || null;

    if (strict) {
      const strictState =
        String(strict?.state || '').trim().toUpperCase();

      // MEMEFLOW_TERMINAL_WATCH_DUPLICATE_MERGE_V37
      //
      // Keep every strict field as the data/execution authority. Overlay ONLY
      // the terminal display classification when strict is still WAITING.
      if (
        strictState === 'WAITING' &&
        strict?.tradeEligible !== true
      ) {
        byMint.set(mint, {
          ...strict,
          state: 'WATCH',
          displayState: 'WATCH',
          tradeEligible: false,
          __strictState: strictState,
          __pipelineWatch: true
        });
      }

      // BUY READY / BLOCKED / WATCH / OPEN and all other strict states win.
      continue;
    }

    byMint.set(mint, {
      ...watch,

      // Pipeline-only row: terminal display classification only.
      state: 'WATCH',
      displayState: 'WATCH',

      // Never let a pipeline-only display row become executable.
      tradeEligible: false,
      __pipelineWatch: true
    });
  }

  const pinned = [];

  for (const position of state.positions || []) {
    if (
      !position?.mint ||
      String(position.status || '').toUpperCase() !== 'OPEN'
    ) continue;

    const existing = byMint.get(position.mint);
    if (existing) {
      pinned.push({
        ...existing,
        strategySource: position.strategySource || existing.strategySource || null,
        copyTradingWallet: position.copyTradingWallet || existing.copyTradingWallet || null,
        __openPosition: position
      });
      byMint.delete(position.mint);
    } else {
      pinned.push(positionAsCandidate(position));
    }
  }

  return [...pinned, ...byMint.values()];
}

function displayStateForCandidate(candidate) {
  return isMintOpen(candidate?.mint)
    ? 'OPEN POSITION'
    : String(candidate?.state || 'WAITING').toUpperCase();
}

function terminalHolderLabel(candidate) {
  const exact =
    candidate?.holderCount ??
    candidate?.holders;

  if (finite(exact)) {
    return fmt(exact, 0);
  }

  const observed =
    candidate?.observedHolderCount;

  if (finite(observed) && Number(observed) > 0) {
    return `${fmt(observed, 0)}+`;
  }

  return '—';
}

function updateCandidateCount() {
  $('candidateCount').textContent =
    `${mergedCandidates().length} candidates`;
}

function syncSelectedCandidate() {
  const rows = mergedCandidates();

  if (!rows.length) {
    state.selected = null;
    return rows;
  }

  if (
    !state.selectedMint ||
    !rows.some(item => item.mint === state.selectedMint)
  ) {
    const open = rows.find(item => isMintOpen(item?.mint));
    const ready = rows.find(
      item => String(item?.state || '').toUpperCase() === 'BUY READY'
    );
    state.selectedMint = (open || ready || rows[0]).mint;
  }

  state.selected =
    rows.find(item => item.mint === state.selectedMint) ||
    null;

  return rows;
}

function filteredCandidates() {
  const rows = mergedCandidates();
  if (state.filter === 'all') return rows;

  // Real OPEN positions stay pinned regardless of the scanner filter.
  return rows.filter(
    item =>
      isMintOpen(item?.mint) ||
      String(item.state || '').toUpperCase() === state.filter
  );
}

/* MEMEFLOW_CANDIDATES_RECENT_TRADES_LAYOUT_V1
 * Candidate rows use the same compact information hierarchy and
 * 28x28 token-avatar treatment as Recent trades.
 * Candidate selection, filters and trading behavior are unchanged.
 */
function candidateImageUrl(candidate) {
  if (!candidate) return '';

  const direct = String(
    candidate.logoUrl ||
    candidate.imageUrl ||
    candidate.image ||
    candidate.icon ||
    candidate.__openPosition?.logoUrl ||
    candidate.__openPosition?.imageUrl ||
    candidate.__openPosition?.image ||
    candidate.__openPosition?.icon ||
    ''
  ).trim();

  if (direct) {
    const normalized = tokenImageCandidates(direct);
    return normalized[0] || direct;
  }

  const mint = String(candidate.mint || '').trim();
  if (!mint) return '';

  const relatedTrade = (state.trades || []).find(trade => {
    if (String(trade?.mint || '') !== mint) return false;
    return Boolean(
      trade?.logoUrl ||
      trade?.imageUrl ||
      trade?.image ||
      trade?.icon
    );
  });

  const tradeImage = String(
    relatedTrade?.logoUrl ||
    relatedTrade?.imageUrl ||
    relatedTrade?.image ||
    relatedTrade?.icon ||
    ''
  ).trim();

  if (!tradeImage) return '';

  const normalized = tokenImageCandidates(tradeImage);
  return normalized[0] || tradeImage;
}

function candidateAvatarMarkup(candidate) {
  const symbol = String(
    candidate?.symbol ||
    candidate?.name ||
    'TK'
  ).trim();

  const fallback = symbol
    .replace(/[^A-Z0-9]/gi, '')
    .slice(0, 2)
    .toUpperCase() || 'TK';

  const url = candidateImageUrl(candidate);

  if (url) {
    return `
      <span class="trade-token-avatar candidate-token-avatar">
        <img
          src="${esc(url)}"
          alt="${esc(symbol)}"
          loading="lazy"
          onerror="this.parentElement.classList.add('is-fallback');this.remove();"
        >
        <span class="trade-avatar-fallback-text">${esc(fallback)}</span>
      </span>
    `;
  }

  return `
    <span class="trade-token-avatar candidate-token-avatar is-fallback">
      <span class="trade-avatar-fallback-text">${esc(fallback)}</span>
    </span>
  `;
}

/* MEMEFLOW_EXACT_THREE_VISIBLE_ROWS_V1
 * Candidates, Open positions and Recent trades show at most three COMPLETE rows.
 * Height is measured from the actual rendered rows, not a hardcoded pixel guess.
 */
const MF_VISIBLE_LIST_ROWS = 3;
let mfVisibleRowsResizeRaf = 0;

function fitListToVisibleRows(list, rowSelector, visibleRows = MF_VISIBLE_LIST_ROWS) {
  if (!list) return;

  const rows = Array.from(list.querySelectorAll(rowSelector));

  if (!rows.length) {
    list.style.height = '';
    list.style.maxHeight = '';
    list.style.overflowY = 'hidden';
    return;
  }

  requestAnimationFrame(() => {
    const liveRows = Array.from(list.querySelectorAll(rowSelector));
    const visible = liveRows.slice(0, visibleRows);
    if (!visible.length) return;

    const exactHeight = visible.reduce(
      (sum, row) => sum + row.getBoundingClientRect().height,
      0
    );

    const px = `${Math.round(exactHeight * 100) / 100}px`;
    list.style.height = px;
    list.style.maxHeight = px;
    list.style.overflowY = liveRows.length > visibleRows ? 'auto' : 'hidden';
  });
}

function refreshThreeRowListViewports() {
  cancelAnimationFrame(mfVisibleRowsResizeRaf);
  mfVisibleRowsResizeRaf = requestAnimationFrame(() => {
    fitListToVisibleRows($('candidateList'), '.candidate');
    fitListToVisibleRows($('positionsList'), '.position-row');
    fitListToVisibleRows($('tradeHistory'), '.trade-row.trade-log-row');
  });
}

window.addEventListener('resize', refreshThreeRowListViewports, { passive: true });
if (document.fonts?.ready) {
  document.fonts.ready.then(refreshThreeRowListViewports).catch(() => {});
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
    const stateText = displayStateForCandidate(item);

    return `
      <button
        class="candidate ${item.mint === state.selectedMint ? 'selected' : ''}"
        data-mint="${esc(item.mint)}"
        type="button"
      >
        ${candidateAvatarMarkup(item)}

        <div class="candidate-main">
          <div class="candidate-top">
            <div class="candidate-name">
              <strong>
                ${esc(item.symbol || item.name || short(item.mint))}
                ${String(item.strategySource || '').toLowerCase() === 'copy-trading'
                  ? ' <em class="copy-trade-badge">COPY TRADE</em>'
                  : ''}
              </strong>
              <span>${esc(item.name || short(item.mint))}</span>
            </div>

            <span class="state-dot ${decisionClass(stateText)}">${esc(stateText)}</span>
          </div>

          <div class="candidate-bottom">
            <span>
              Score ${fmt(item.score, 0)} · Holders ${terminalHolderLabel(item)}
            </span>
            <span class="candidate-price">
              ${price ? formatPrice(usdFromSol(price, item)) : '$—'}
            </span>
          </div>
        </div>
      </button>
    `;
  }).join('');

  fitListToVisibleRows(list, '.candidate');

  list.querySelectorAll('.candidate').forEach(button => {
    button.addEventListener('click', () => selectCandidate(button.dataset.mint));
  });
}

async function loadCandidates({ redrawChart = true } = {}) {
  // MEMEFLOW_TERMINAL_WATCH_RESILIENT_V30
  //
  // Strict trading decisions and Pipeline WATCH are two independent feeds.
  // A failure in one must not suppress a healthy other feed.
  const [strictResult, liveResult] =
    await Promise.allSettled([
      api('/api/ai/decisions?scope=all&limit=100'),
      api('/api/system/live-token-states?limit=200')
    ]);

  const payload =
    strictResult.status === 'fulfilled'
      ? strictResult.value
      : null;

  const livePayload =
    liveResult.status === 'fulfilled'
      ? liveResult.value
      : null;

  // IMPORTANT:
  // Never retain stale BUY READY rows when strict trading feed is unavailable.
  state.candidates =
    Array.isArray(payload?.decisions)
      ? payload.decisions
      : [];

  if (Array.isArray(livePayload?.decisions)) {
    state.liveWatchCandidates =
      livePayload.decisions
        .filter(item => {
          if (!item?.mint) return false;

          const liveState =
            String(
              item?.displayState ??
              item?.state ??
              ''
            )
              .trim()
              .toUpperCase();

          return liveState === 'WATCH';
        })
        .map(item => ({
          ...item,

          // UI state only. Never execution authority.
          state: 'WATCH',
          displayState: 'WATCH',
          tradeEligible: false,
          __pipelineWatch: true
        }));
  } else if (liveResult.status === 'fulfilled') {
    // Healthy live endpoint with no rows means there are no current WATCH rows.
    state.liveWatchCandidates = [];
  }

  // If both candidate sources are unavailable, propagate a real candidate-feed
  // failure to the outer poll. If either source is healthy, render what is safe.
  if (
    strictResult.status === 'rejected' &&
    liveResult.status === 'rejected'
  ) {
    throw (
      strictResult.reason ||
      liveResult.reason ||
      new Error('Candidate feeds unavailable')
    );
  }

  const rows = mergedCandidates();

  $('candidateCount').textContent =
    `${rows.length} candidates`;

  if(
    !state.selectedMint &&
    rows.length
  ){
    const ready =
      rows.find(
        item =>
          String(item?.state || '').toUpperCase() ===
          'BUY READY'
      );

    const watch =
      rows.find(
        item =>
          String(item?.state || '').toUpperCase() ===
          'WATCH'
      );

    state.selectedMint =
      (ready || watch || rows[0]).mint;
  }

  if(state.selectedMint){
    const current =
      rows.find(
        item =>
          item.mint===state.selectedMint
      );

    if(current){
      state.selected=current;
    }
  }

  syncSelectedCandidate();
  updateCandidateCount();

  // IMPORTANT V30.3.1:
  // candidate/decision prices never enter raw chart history.
  // /api/chart/stream is the one chart-data authority.
  renderCandidates();
  renderSelected({ redrawChart });
}

function selectCandidate(mint) {
  if (!mint) return;
  state.selectedMint = mint;
  state.selected = mergedCandidates().find(item => item.mint === mint) || null;
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

  const stateText = displayStateForCandidate(c);
  $('tokenName').textContent = `${c.symbol || 'TOKEN'} · ${c.name || ''}`.replace(/\s+·\s*$/, '');
  $('tokenState').textContent = stateText;
  $('tokenState').className = `decision-badge ${decisionClass(stateText)}`;
  $('tokenMint').textContent = short(c.mint, 7, 6);

  const price = candidatePrice(c);
  const priceUsd = usdFromSol(price, c);
  renderPriceModeSummary(priceUsd);

  $('metricScore').textContent = fmt(c.score, 0);
  $('metricHolders').textContent = terminalHolderLabel(c);
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
    `/api/chart/trade-stream?tokenAddress=${encodeURIComponent(mint)}`
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

  const hard = num($('hardStopPct')?.value, state.settings?.hardStopPct);
  const tp1 = num($('tp1Pct')?.value, state.settings?.tp1Pct);
  const tp2 = num($('tp2Pct')?.value, state.settings?.tp2Pct);
  const tp1Sell = num($('tp1SellPct')?.value, state.settings?.tp1SellPct);
  const tp2Sell = num($('tp2SellPct')?.value, state.settings?.tp2SellPct);

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

function persistChartIndicators(){
  try{
    localStorage.setItem(
      'memeflow:chart-indicators',
      JSON.stringify({
        overlays:Array.isArray(state.chartIndicators?.overlays)
          ? state.chartIndicators.overlays
          : [],
        lower:state.chartIndicators?.lower || null
      })
    );
  }catch{}
}

function syncChartIndicatorButtons(){
  const overlays=new Set(
    Array.isArray(state.chartIndicators?.overlays)
      ? state.chartIndicators.overlays
      : []
  );
  const lower=state.chartIndicators?.lower || null;

  document
    .querySelectorAll('#indicatorBar [data-indicator]')
    .forEach(button=>{
      const name=String(button.dataset.indicator||'').toUpperCase();
      const kind=String(button.dataset.kind||'');
      const active=
        kind==='overlay'
          ? overlays.has(name)
          : lower===name;

      button.classList.toggle('active',active);
      button.setAttribute('aria-pressed',active?'true':'false');
    });
}

function toggleChartIndicator(button){
  if(!button)return;

  const name=String(button.dataset.indicator||'').toUpperCase();
  const kind=String(button.dataset.kind||'');

  if(kind==='overlay'){
    const overlays=new Set(
      Array.isArray(state.chartIndicators?.overlays)
        ? state.chartIndicators.overlays
        : []
    );

    if(overlays.has(name))overlays.delete(name);
    else overlays.add(name);

    state.chartIndicators.overlays=[...overlays];
  }else if(kind==='lower'){
    state.chartIndicators.lower=
      state.chartIndicators?.lower===name
        ? null
        : name;
  }else{
    return;
  }

  persistChartIndicators();
  syncChartIndicatorButtons();

  // Presentation-only toggle: preserve zoom/pan/timeframe/metric.
  scheduleChart();
}

function indicatorPad(values,padCount){
  return values.concat(
    Array(Math.max(0,Number(padCount)||0)).fill('-')
  );
}

function simpleMovingAverageValues(values,period){
  const clean=Array.isArray(values)?values:[];
  const out=new Array(clean.length).fill('-');
  const p=Math.max(1,Number(period)||1);
  let sum=0;

  for(let i=0;i<clean.length;i++){
    const value=Number(clean[i]);
    if(!Number.isFinite(value))continue;

    sum+=value;

    if(i>=p){
      const old=Number(clean[i-p]);
      if(Number.isFinite(old))sum-=old;
    }

    if(i>=p-1)out[i]=sum/p;
  }

  return out;
}

function sparseMovingAverageValues(values,period){
  const clean=Array.isArray(values)?values:[];
  const out=new Array(clean.length).fill('-');
  const p=Math.max(1,Number(period)||1);

  for(let i=p-1;i<clean.length;i++){
    const window=clean.slice(i-p+1,i+1).map(Number);
    if(window.every(Number.isFinite)){
      out[i]=window.reduce((sum,value)=>sum+value,0)/p;
    }
  }

  return out;
}

function emaValues(values,period){
  const clean=Array.isArray(values)?values.map(Number):[];
  const out=new Array(clean.length).fill('-');
  if(!clean.length)return out;

  const p=Math.max(1,Number(period)||1);
  const alpha=2/(p+1);
  let ema=Number(clean[0]);

  if(!Number.isFinite(ema))return out;
  out[0]=ema;

  for(let i=1;i<clean.length;i++){
    const value=Number(clean[i]);
    if(!Number.isFinite(value))continue;
    ema=value*alpha+ema*(1-alpha);
    out[i]=ema;
  }

  return out;
}

function bollingerValues(values,period=20,multiplier=2){
  const clean=Array.isArray(values)?values.map(Number):[];
  const middle=simpleMovingAverageValues(clean,period);
  const upper=new Array(clean.length).fill('-');
  const lower=new Array(clean.length).fill('-');
  const p=Math.max(2,Number(period)||20);
  const mult=Math.max(0,Number(multiplier)||2);

  for(let i=p-1;i<clean.length;i++){
    const window=clean.slice(i-p+1,i+1);
    if(!window.every(Number.isFinite))continue;

    const mean=Number(middle[i]);
    if(!Number.isFinite(mean))continue;

    const variance=
      window.reduce(
        (sum,value)=>sum+Math.pow(value-mean,2),
        0
      )/p;

    const deviation=Math.sqrt(Math.max(0,variance));
    upper[i]=mean+deviation*mult;
    lower[i]=Math.max(0,mean-deviation*mult);
  }

  return {middle,upper,lower};
}

function parabolicSarValues(candles,step=.02,maxStep=.2){
  const rows=Array.isArray(candles)?candles:[];
  const out=new Array(rows.length).fill('-');
  if(rows.length<2)return out;

  let up=Number(rows[1].close)>=Number(rows[0].close);
  let sar=up ? Number(rows[0].low) : Number(rows[0].high);
  let ep=up ? Number(rows[0].high) : Number(rows[0].low);
  let af=step;

  out[0]=sar;

  for(let i=1;i<rows.length;i++){
    const high=Number(rows[i].high);
    const low=Number(rows[i].low);
    const prevHigh=Number(rows[i-1].high);
    const prevLow=Number(rows[i-1].low);

    sar=sar+af*(ep-sar);

    if(up){
      sar=Math.min(sar,prevLow);
      if(i>=2)sar=Math.min(sar,Number(rows[i-2].low));

      if(low<sar){
        up=false;
        sar=ep;
        ep=low;
        af=step;
      }else if(high>ep){
        ep=high;
        af=Math.min(maxStep,af+step);
      }
    }else{
      sar=Math.max(sar,prevHigh);
      if(i>=2)sar=Math.max(sar,Number(rows[i-2].high));

      if(high>sar){
        up=true;
        sar=ep;
        ep=high;
        af=step;
      }else if(low<ep){
        ep=low;
        af=Math.min(maxStep,af+step);
      }
    }

    out[i]=sar;
  }

  return out;
}

function rsiValues(values,period=14){
  const clean=Array.isArray(values)?values.map(Number):[];
  const out=new Array(clean.length).fill('-');
  const p=Math.max(2,Number(period)||14);

  if(clean.length<=p)return out;

  let gains=0;
  let losses=0;

  for(let i=1;i<=p;i++){
    const delta=clean[i]-clean[i-1];
    if(delta>=0)gains+=delta;
    else losses-=delta;
  }

  let avgGain=gains/p;
  let avgLoss=losses/p;

  const calc=()=>{
    if(avgLoss===0)return 100;
    const rs=avgGain/avgLoss;
    return 100-(100/(1+rs));
  };

  out[p]=calc();

  for(let i=p+1;i<clean.length;i++){
    const delta=clean[i]-clean[i-1];
    const gain=Math.max(0,delta);
    const loss=Math.max(0,-delta);

    avgGain=(avgGain*(p-1)+gain)/p;
    avgLoss=(avgLoss*(p-1)+loss)/p;
    out[i]=calc();
  }

  return out;
}

function macdValues(values){
  const fast=emaValues(values,12);
  const slow=emaValues(values,26);
  const macd=new Array(values.length).fill('-');

  for(let i=0;i<values.length;i++){
    const a=Number(fast[i]);
    const b=Number(slow[i]);
    if(Number.isFinite(a) && Number.isFinite(b)){
      macd[i]=a-b;
    }
  }

  const signalInput=macd.map(value=>
    Number.isFinite(Number(value))
      ? Number(value)
      : 0
  );
  const signalRaw=emaValues(signalInput,9);
  const signal=new Array(values.length).fill('-');
  const histogram=new Array(values.length).fill('-');

  for(let i=0;i<values.length;i++){
    const m=Number(macd[i]);
    const s=Number(signalRaw[i]);
    if(Number.isFinite(m) && Number.isFinite(s)){
      signal[i]=s;
      histogram[i]=m-s;
    }
  }

  return {macd,signal,histogram};
}

function kdjValues(candles,period=9){
  const rows=Array.isArray(candles)?candles:[];
  const k=new Array(rows.length).fill('-');
  const d=new Array(rows.length).fill('-');
  const j=new Array(rows.length).fill('-');
  const p=Math.max(2,Number(period)||9);

  let kv=50;
  let dv=50;

  for(let i=p-1;i<rows.length;i++){
    const window=rows.slice(i-p+1,i+1);
    const high=Math.max(...window.map(row=>Number(row.high)));
    const low=Math.min(...window.map(row=>Number(row.low)));
    const close=Number(rows[i].close);

    if(!(Number.isFinite(high) && Number.isFinite(low) && Number.isFinite(close))){
      continue;
    }

    const rsv=high===low ? 50 : ((close-low)/(high-low))*100;
    kv=(2/3)*kv+(1/3)*rsv;
    dv=(2/3)*dv+(1/3)*kv;

    k[i]=kv;
    d[i]=dv;
    j[i]=3*kv-2*dv;
  }

  return {k,d,j};
}

function stochRsiValues(values,rsiPeriod=14,stochPeriod=14){
  const rsi=rsiValues(values,rsiPeriod);
  const raw=new Array(values.length).fill('-');
  const p=Math.max(2,Number(stochPeriod)||14);

  for(let i=0;i<rsi.length;i++){
    if(i<p-1)continue;

    const window=rsi.slice(i-p+1,i+1).map(Number);
    if(!window.every(Number.isFinite))continue;

    const min=Math.min(...window);
    const max=Math.max(...window);
    const current=Number(rsi[i]);

    raw[i]=max===min
      ? 50
      : ((current-min)/(max-min))*100;
  }

  const k=sparseMovingAverageValues(raw,3);
  const d=sparseMovingAverageValues(k,3);

  return {k,d};
}

function trueRangeValues(candles){
  const rows=Array.isArray(candles)?candles:[];
  const out=new Array(rows.length).fill('-');

  for(let i=0;i<rows.length;i++){
    const high=Number(rows[i]?.high);
    const low=Number(rows[i]?.low);
    if(!(Number.isFinite(high) && Number.isFinite(low)))continue;

    if(i===0){
      out[i]=Math.max(0,high-low);
      continue;
    }

    const prevClose=Number(rows[i-1]?.close);
    if(!Number.isFinite(prevClose))continue;

    out[i]=Math.max(
      Math.max(0,high-low),
      Math.abs(high-prevClose),
      Math.abs(low-prevClose)
    );
  }

  return out;
}

function atrValues(candles,period=14){
  const tr=trueRangeValues(candles).map(value=>
    Number.isFinite(Number(value)) ? Number(value) : 0
  );
  const out=new Array(tr.length).fill('-');
  const p=Math.max(2,Number(period)||14);
  if(tr.length<p)return out;

  let atr=tr.slice(0,p).reduce((sum,value)=>sum+value,0)/p;
  out[p-1]=atr;

  for(let i=p;i<tr.length;i++){
    atr=((atr*(p-1))+tr[i])/p;
    out[i]=atr;
  }

  return out;
}

function trixValues(values,period=12){
  const clean=Array.isArray(values)?values.map(Number):[];
  const ema1=emaValues(clean,period).map(value=>Number(value)||0);
  const ema2=emaValues(ema1,period).map(value=>Number(value)||0);
  const ema3=emaValues(ema2,period);
  const out=new Array(clean.length).fill('-');

  for(let i=1;i<ema3.length;i++){
    const prev=Number(ema3[i-1]);
    const current=Number(ema3[i]);
    if(Number.isFinite(prev) && prev!==0 && Number.isFinite(current)){
      out[i]=100*((current-prev)/Math.abs(prev));
    }
  }

  return out;
}

function obvValues(candles){
  const rows=Array.isArray(candles)?candles:[];
  const out=new Array(rows.length).fill('-');
  let obv=0;

  for(let i=0;i<rows.length;i++){
    const volume=Math.max(0,Number(rows[i]?.volumeUsd||0));

    if(i===0){
      out[i]=obv;
      continue;
    }

    const close=Number(rows[i]?.close);
    const prev=Number(rows[i-1]?.close);
    if(!(Number.isFinite(close) && Number.isFinite(prev)))continue;

    if(close>prev)obv+=volume;
    else if(close<prev)obv-=volume;

    out[i]=obv;
  }

  return out;
}

function williamsRValues(candles,period=14){
  const rows=Array.isArray(candles)?candles:[];
  const out=new Array(rows.length).fill('-');
  const p=Math.max(2,Number(period)||14);

  for(let i=p-1;i<rows.length;i++){
    const window=rows.slice(i-p+1,i+1);
    const high=Math.max(...window.map(row=>Number(row.high)));
    const low=Math.min(...window.map(row=>Number(row.low)));
    const close=Number(rows[i]?.close);

    if(!(Number.isFinite(high) && Number.isFinite(low) && Number.isFinite(close)))continue;

    out[i]=high===low
      ? -50
      : -100*((high-close)/(high-low));
  }

  return out;
}

function cciValues(candles,period=20){
  const rows=Array.isArray(candles)?candles:[];
  const typical=rows.map(row=>
    (Number(row.high)+Number(row.low)+Number(row.close))/3
  );
  const out=new Array(rows.length).fill('-');
  const p=Math.max(2,Number(period)||20);

  for(let i=p-1;i<rows.length;i++){
    const window=typical.slice(i-p+1,i+1);
    if(!window.every(Number.isFinite))continue;

    const mean=window.reduce((sum,value)=>sum+value,0)/p;
    const deviation=
      window.reduce((sum,value)=>sum+Math.abs(value-mean),0)/p;

    out[i]=deviation===0
      ? 0
      : (typical[i]-mean)/(.015*deviation);
  }

  return out;
}

function rocValues(values,period=12){
  const clean=Array.isArray(values)?values.map(Number):[];
  const out=new Array(clean.length).fill('-');
  const p=Math.max(1,Number(period)||12);

  for(let i=p;i<clean.length;i++){
    const prev=Number(clean[i-p]);
    const current=Number(clean[i]);
    if(Number.isFinite(prev) && prev!==0 && Number.isFinite(current)){
      out[i]=100*((current-prev)/Math.abs(prev));
    }
  }

  return out;
}

function dmiValues(candles,period=14){
  const rows=Array.isArray(candles)?candles:[];
  const p=Math.max(2,Number(period)||14);
  const plusDm=new Array(rows.length).fill(0);
  const minusDm=new Array(rows.length).fill(0);
  const tr=trueRangeValues(rows).map(value=>Number(value)||0);
  const plusDi=new Array(rows.length).fill('-');
  const minusDi=new Array(rows.length).fill('-');
  const dx=new Array(rows.length).fill('-');
  const adx=new Array(rows.length).fill('-');

  for(let i=1;i<rows.length;i++){
    const up=Number(rows[i].high)-Number(rows[i-1].high);
    const down=Number(rows[i-1].low)-Number(rows[i].low);
    plusDm[i]=up>down && up>0 ? up : 0;
    minusDm[i]=down>up && down>0 ? down : 0;
  }

  if(rows.length<=p)return {plusDi,minusDi,adx};

  let smTr=tr.slice(1,p+1).reduce((sum,value)=>sum+value,0);
  let smPlus=plusDm.slice(1,p+1).reduce((sum,value)=>sum+value,0);
  let smMinus=minusDm.slice(1,p+1).reduce((sum,value)=>sum+value,0);

  for(let i=p;i<rows.length;i++){
    if(i>p){
      smTr=smTr-(smTr/p)+tr[i];
      smPlus=smPlus-(smPlus/p)+plusDm[i];
      smMinus=smMinus-(smMinus/p)+minusDm[i];
    }

    if(smTr<=0)continue;

    const plus=100*(smPlus/smTr);
    const minus=100*(smMinus/smTr);
    plusDi[i]=plus;
    minusDi[i]=minus;

    const denom=plus+minus;
    dx[i]=denom===0 ? 0 : 100*Math.abs(plus-minus)/denom;
  }

  const first=(p*2)-1;
  if(rows.length>first){
    const initial=dx.slice(p,first+1).map(Number).filter(Number.isFinite);
    if(initial.length){
      let current=initial.reduce((sum,value)=>sum+value,0)/initial.length;
      adx[first]=current;

      for(let i=first+1;i<rows.length;i++){
        const value=Number(dx[i]);
        if(!Number.isFinite(value))continue;
        current=((current*(p-1))+value)/p;
        adx[i]=current;
      }
    }
  }

  return {plusDi,minusDi,adx};
}

function vrValues(candles,period=26){
  const rows=Array.isArray(candles)?candles:[];
  const out=new Array(rows.length).fill('-');
  const p=Math.max(2,Number(period)||26);

  for(let i=p;i<rows.length;i++){
    let up=0;
    let down=0;
    let flat=0;

    for(let j=i-p+1;j<=i;j++){
      const close=Number(rows[j]?.close);
      const prev=Number(rows[j-1]?.close);
      const volume=Math.max(0,Number(rows[j]?.volumeUsd||0));
      if(!(Number.isFinite(close) && Number.isFinite(prev)))continue;

      if(close>prev)up+=volume;
      else if(close<prev)down+=volume;
      else flat+=volume;
    }

    const denom=down+(flat*.5);
    out[i]=denom===0
      ? (up>0 ? 400 : 100)
      : 100*((up+(flat*.5))/denom);
  }

  return out;
}

function psyValues(values,period=12){
  const clean=Array.isArray(values)?values.map(Number):[];
  const out=new Array(clean.length).fill('-');
  const p=Math.max(2,Number(period)||12);

  for(let i=p;i<clean.length;i++){
    let advances=0;
    for(let j=i-p+1;j<=i;j++){
      if(clean[j]>clean[j-1])advances++;
    }
    out[i]=100*(advances/p);
  }

  return out;
}

function biasValues(values,period=12){
  const clean=Array.isArray(values)?values.map(Number):[];
  const ma=simpleMovingAverageValues(clean,period);
  const out=new Array(clean.length).fill('-');

  for(let i=0;i<clean.length;i++){
    const avg=Number(ma[i]);
    const close=Number(clean[i]);
    if(Number.isFinite(avg) && avg!==0 && Number.isFinite(close)){
      out[i]=100*((close-avg)/Math.abs(avg));
    }
  }

  return out;
}

function dmaValues(values,fastPeriod=10,slowPeriod=50,amaPeriod=10){
  const clean=Array.isArray(values)?values.map(Number):[];
  const fast=simpleMovingAverageValues(clean,fastPeriod);
  const slow=simpleMovingAverageValues(clean,slowPeriod);
  const dma=new Array(clean.length).fill('-');

  for(let i=0;i<clean.length;i++){
    const a=Number(fast[i]);
    const b=Number(slow[i]);
    if(Number.isFinite(a) && Number.isFinite(b))dma[i]=a-b;
  }

  return {
    dma,
    ama:sparseMovingAverageValues(dma,amaPeriod)
  };
}

function emvValues(candles,period=14){
  const rows=Array.isArray(candles)?candles:[];
  const raw=new Array(rows.length).fill('-');

  for(let i=1;i<rows.length;i++){
    const high=Number(rows[i]?.high);
    const low=Number(rows[i]?.low);
    const prevHigh=Number(rows[i-1]?.high);
    const prevLow=Number(rows[i-1]?.low);
    const volume=Math.max(0,Number(rows[i]?.volumeUsd||0));

    if(![high,low,prevHigh,prevLow].every(Number.isFinite))continue;

    const midpointMove=((high+low)/2)-((prevHigh+prevLow)/2);
    const range=Math.max(
      Math.abs(high-low),
      Math.max(Math.abs(high),1)*1e-12
    );
    const boxRatio=(volume||1)/range;

    raw[i]=boxRatio===0 ? 0 : midpointMove/boxRatio;
  }

  return sparseMovingAverageValues(raw,period);
}

function compactIndicatorValue(value){
  const n=Number(value);
  if(!Number.isFinite(n))return '';
  const abs=Math.abs(n);

  if(abs>=1e6)return `${fmt(n/1e6,1)}M`;
  if(abs>=1e3)return `${fmt(n/1e3,1)}K`;
  if(abs>=100)return fmt(n,0);
  if(abs>=1)return fmt(n,2);
  if(abs>=.01)return fmt(n,3);
  if(abs===0)return '0';
  return n.toExponential(1);
}

function chartOverlayIndicatorSeries(candles,padCount){
  const active=new Set(
    Array.isArray(state.chartIndicators?.overlays)
      ? state.chartIndicators.overlays
      : []
  );

  if(!active.size)return [];

  const close=candles.map(candle=>Number(candle.close));
  const pad=data=>indicatorPad(data,padCount);
  const line=(name,data,color,width=1)=>({
    name,
    type:'line',
    xAxisIndex:0,
    yAxisIndex:0,
    data:pad(data),
    showSymbol:false,
    connectNulls:false,
    smooth:false,
    silent:true,
    animation:false,
    tooltip:{show:false},
    emphasis:{disabled:true},
    lineStyle:{color,width,opacity:.9},
    z:4
  });

  const series=[];

  if(active.has('MA')){
    series.push(
      line('MA5',simpleMovingAverageValues(close,5),'#55d9ff'),
      line('MA10',simpleMovingAverageValues(close,10),'#a98bff'),
      line('MA20',simpleMovingAverageValues(close,20),'#849aa5')
    );
  }

  if(active.has('EMA')){
    series.push(
      line('EMA7',emaValues(close,7),'#4de6a1'),
      line('EMA21',emaValues(close,21),'#6a99ff')
    );
  }

  if(active.has('BOLL')){
    const boll=bollingerValues(close,20,2);
    series.push(
      line('BOLL U',boll.upper,'#6a99ff'),
      line('BOLL M',boll.middle,'#91a6b0'),
      line('BOLL L',boll.lower,'#6a99ff')
    );
  }

  if(active.has('SAR')){
    series.push({
      name:'SAR',
      type:'scatter',
      xAxisIndex:0,
      yAxisIndex:0,
      data:pad(parabolicSarValues(candles)),
      symbol:'circle',
      symbolSize:3,
      silent:true,
      animation:false,
      tooltip:{show:false},
      emphasis:{disabled:true},
      itemStyle:{color:'#b9cbd3',opacity:.86},
      z:5
    });
  }

  return series;
}

function chartLowerIndicatorPane(candles,padCount,volumeData,ma5,ma10){
  const name=String(state.chartIndicators?.lower||'').toUpperCase();
  if(!name)return null;

  const close=candles.map(candle=>Number(candle.close));
  const pad=data=>indicatorPad(data,padCount);

  const line=(seriesName,data,color,width=1)=>({
    name:seriesName,
    type:'line',
    xAxisIndex:1,
    yAxisIndex:1,
    data:pad(data),
    showSymbol:false,
    connectNulls:false,
    smooth:false,
    silent:true,
    animation:false,
    emphasis:{disabled:true},
    lineStyle:{color,width,opacity:.9}
  });

  const base={
    name,
    legend:[],
    series:[],
    axis:{
      scale:true,
      formatter:value=>compactIndicatorValue(value)
    }
  };

  if(name==='VOL'){
    base.legend=['VOL','MAVOL5','MAVOL10'];
    base.axis.formatter=value=>compactVolume(value);
    base.series=[
      {
        name:'VOL',
        type:'bar',
        xAxisIndex:1,
        yAxisIndex:1,
        data:volumeData,
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
        lineStyle:{width:1,color:'#ef9d42',opacity:.9}
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
        lineStyle:{width:1,color:'#d36bdf',opacity:.86}
      }
    ];
    return base;
  }

  if(name==='MACD'){
    const macd=macdValues(close);
    const histogram=pad(macd.histogram).map(value=>{
      const n=Number(value);
      if(!Number.isFinite(n))return '-';
      return {
        value:n,
        itemStyle:{
          color:n>=0
            ? 'rgba(77,230,161,.62)'
            : 'rgba(255,102,121,.62)'
        }
      };
    });

    base.legend=['MACD','SIGNAL','HIST'];
    base.series=[
      {
        name:'HIST',
        type:'bar',
        xAxisIndex:1,
        yAxisIndex:1,
        data:histogram,
        barWidth:'58%',
        emphasis:{disabled:true}
      },
      line('MACD',macd.macd,'#55d9ff'),
      line('SIGNAL',macd.signal,'#d36bdf')
    ];
    return base;
  }

  if(name==='KDJ'){
    const kdj=kdjValues(candles,9);
    base.legend=['K','D','J'];
    base.axis.formatter=value=>fmt(value,0);
    base.series=[
      line('K',kdj.k,'#55d9ff'),
      line('D',kdj.d,'#d36bdf'),
      line('J',kdj.j,'#4de6a1')
    ];
    return base;
  }

  if(name==='RSI'){
    base.legend=['RSI6','RSI12','RSI24'];
    base.axis={
      scale:false,
      min:0,
      max:100,
      formatter:value=>fmt(value,0)
    };
    base.series=[
      line('RSI6',rsiValues(close,6),'#55d9ff'),
      line('RSI12',rsiValues(close,12),'#a98bff'),
      line('RSI24',rsiValues(close,24),'#4de6a1')
    ];
    return base;
  }

  if(name==='STOCHRSI'){
    const stoch=stochRsiValues(close,14,14);
    base.legend=['STOCH K','STOCH D'];
    base.axis={
      scale:false,
      min:0,
      max:100,
      formatter:value=>fmt(value,0)
    };
    base.series=[
      line('STOCH K',stoch.k,'#55d9ff'),
      line('STOCH D',stoch.d,'#d36bdf')
    ];
    return base;
  }

  if(name==='TRIX'){
    const trix=trixValues(close,12);
    const signal=sparseMovingAverageValues(trix,9);
    base.legend=['TRIX','MATRIX'];
    base.series=[
      line('TRIX',trix,'#55d9ff'),
      line('MATRIX',signal,'#d36bdf')
    ];
    return base;
  }

  if(name==='OBV'){
    const obv=obvValues(candles);
    const numeric=obv.map(value=>Number.isFinite(Number(value)) ? Number(value) : 0);
    base.legend=['OBV','MA20'];
    base.series=[
      line('OBV',obv,'#55d9ff'),
      line('MA20',simpleMovingAverageValues(numeric,20),'#d36bdf')
    ];
    return base;
  }

  if(name==='WR'){
    base.legend=['WR14'];
    base.axis={scale:false,min:-100,max:0,formatter:value=>fmt(value,0)};
    base.series=[line('WR14',williamsRValues(candles,14),'#55d9ff')];
    return base;
  }

  if(name==='CCI'){
    base.legend=['CCI20'];
    base.series=[line('CCI20',cciValues(candles,20),'#55d9ff')];
    return base;
  }

  if(name==='ROC'){
    const roc=rocValues(close,12);
    base.legend=['ROC12','MAROC6'];
    base.series=[
      line('ROC12',roc,'#55d9ff'),
      line('MAROC6',sparseMovingAverageValues(roc,6),'#d36bdf')
    ];
    return base;
  }

  if(name==='DMI'){
    const dmi=dmiValues(candles,14);
    base.legend=['+DI','-DI','ADX'];
    base.axis={scale:false,min:0,max:100,formatter:value=>fmt(value,0)};
    base.series=[
      line('+DI',dmi.plusDi,'#4de6a1'),
      line('-DI',dmi.minusDi,'#ff6679'),
      line('ADX',dmi.adx,'#55d9ff')
    ];
    return base;
  }

  if(name==='VR'){
    base.legend=['VR26'];
    base.series=[line('VR26',vrValues(candles,26),'#55d9ff')];
    return base;
  }

  if(name==='PSY'){
    base.legend=['PSY12'];
    base.axis={scale:false,min:0,max:100,formatter:value=>fmt(value,0)};
    base.series=[line('PSY12',psyValues(close,12),'#55d9ff')];
    return base;
  }

  if(name==='BIAS'){
    base.legend=['BIAS6','BIAS12','BIAS24'];
    base.series=[
      line('BIAS6',biasValues(close,6),'#55d9ff'),
      line('BIAS12',biasValues(close,12),'#a98bff'),
      line('BIAS24',biasValues(close,24),'#4de6a1')
    ];
    return base;
  }

  if(name==='DMA'){
    const dma=dmaValues(close,10,50,10);
    base.legend=['DMA','AMA'];
    base.series=[
      line('DMA',dma.dma,'#55d9ff'),
      line('AMA',dma.ama,'#d36bdf')
    ];
    return base;
  }

  if(name==='EMV'){
    const emv=emvValues(candles,14);
    base.legend=['EMV14','MAEMV9'];
    base.series=[
      line('EMV14',emv,'#55d9ff'),
      line('MAEMV9',sparseMovingAverageValues(emv,9),'#d36bdf')
    ];
    return base;
  }

  if(name==='ATR'){
    base.legend=['ATR14'];
    base.series=[line('ATR14',atrValues(candles,14),'#55d9ff')];
    return base;
  }

  return null;
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

// V30.23: horizontal overlays are normal line series instead of candlestick
// markLine. This keeps LIVE / ENTRY / SL / TP identical in PRICE and MARKET CAP,
// including very small price values such as 0.00000x.
function chartHorizontalLevelSeries(labels,visibleLevels,liveValue){
  const count=Array.isArray(labels)?labels.length:0;
  if(!count)return [];

  const constantData=value=>
    Array.from({length:count},()=>Number(value));

  const rows=(Array.isArray(visibleLevels)?visibleLevels:[])
    .filter(level=>Number.isFinite(Number(level?.price)) && Number(level.price)>0)
    .map((level,index)=>({
      name:`__MF_LEVEL_${index}_${String(level.kind||'level')}`,
      type:'line',
      xAxisIndex:0,
      yAxisIndex:0,
      data:constantData(level.price),
      showSymbol:false,
      symbol:'none',
      silent:true,
      animation:false,
      tooltip:{show:false},
      emphasis:{disabled:true},
      lineStyle:{
        color:levelColor(level),
        width:1,
        type:'dashed',
        opacity:.85
      },
      z:5
    }));

  const live=Number(liveValue);
  if(Number.isFinite(live) && live>0){
    rows.push({
      name:'__MF_LIVE_LEVEL',
      type:'line',
      xAxisIndex:0,
      yAxisIndex:0,
      data:constantData(live),
      showSymbol:false,
      symbol:'none',
      silent:true,
      animation:false,
      tooltip:{show:false},
      emphasis:{disabled:true},
      lineStyle:{
        color:'#55d9ff',
        width:1,
        type:'dashed',
        opacity:.82
      },
      endLabel:{
        show:true,
        color:'#021014',
        backgroundColor:'#55d9ff',
        borderRadius:2,
        padding:[2,4],
        fontSize:9,
        formatter:()=>formatChartValue(live)
      },
      labelLayout:{hideOverlap:false},
      z:6
    });
  }

  return rows;
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

/* ===== MEMEFLOW_TRADING_LIGHT_CHART_V2 ===== */
function mfTradingChartPaletteV2(){
  const light =
    document.documentElement.getAttribute('data-theme') === 'light';

  if(light){
    return {
      background:'transparent',
      text:'#607783',
      pointerLabelBg:'#ffffff',
      pointerLabelText:'#263b47',
      pointerLine:'rgba(52,94,113,.30)',
      tooltipBg:'rgba(255,255,255,.985)',
      tooltipBorder:'rgba(55,93,111,.20)',
      tooltipText:'#263b47',
      tooltipShadow:'box-shadow:0 10px 28px rgba(27,42,53,.12);',
      legend:'#607783',
      axis:'#607783',
      lowerAxis:'#7a8f99',
      axisLine:'rgba(55,79,94,.14)',
      grid:'rgba(55,79,94,.10)',
      lowerGrid:'rgba(55,79,94,.07)'
    };
  }

  return {
    background:'transparent',
    text:'#536f7b',
    pointerLabelBg:'#0b171d',
    pointerLabelText:'#cfe0e7',
    pointerLine:'rgba(120,176,195,.30)',
    tooltipBg:'rgba(5,12,17,.96)',
    tooltipBorder:'rgba(111,170,190,.22)',
    tooltipText:'#cfe0e7',
    tooltipShadow:'box-shadow:0 8px 30px rgba(0,0,0,.32);',
    legend:'#718894',
    axis:'#536f7b',
    lowerAxis:'#455c67',
    axisLine:'rgba(111,154,172,.10)',
    grid:'rgba(106,145,162,.07)',
    lowerGrid:'rgba(106,145,162,.045)'
  };
}

if(!window.__mfTradingLightChartThemeObserverV2){
  window.__mfTradingLightChartThemeObserverV2 = true;

  try{
    new MutationObserver(mutations=>{
      if(!mutations.some(m=>m.attributeName==='data-theme'))return;
      chartRuntime.dataKey='';
      scheduleChart();
    }).observe(
      document.documentElement,
      {attributes:true,attributeFilter:['data-theme']}
    );
  }catch{}
}
/* ===== /MEMEFLOW_TRADING_LIGHT_CHART_V2 ===== */

function drawChart(){
  try {
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
    $('chartEmpty').innerHTML=
      '<strong>Syncing real trades</strong>'+
      '<span>Candles use confirmed BUY / SELL events only. History and the live Pump trade stream reconnect automatically.</span>';
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

  const overlayIndicatorSeries=
    chartOverlayIndicatorSeries(
      candles,
      display.padCount
    );

  const lowerIndicatorPane=
    chartLowerIndicatorPane(
      candles,
      display.padCount,
      volumeData,
      ma5,
      ma10
    );

  const lowerIndicatorVisible=Boolean(lowerIndicatorPane);
  const lowerIndicatorSeries=lowerIndicatorPane?.series || [];
  const lowerIndicatorLegend=lowerIndicatorPane?.legend || [];
  const lowerIndicatorAxis=lowerIndicatorPane?.axis || {
    scale:true,
    formatter:value=>compactIndicatorValue(value)
  };

  const levelInfo=chartLevelInfo(candles);
  chartRuntime.offscreenLevels=levelInfo.offscreen;

  const last=candles[candles.length-1];

  // V30.23: use one shared overlay model for both metrics.
  const horizontalLevelSeries=chartHorizontalLevelSeries(
    labels,
    levelInfo.visible,
    last.close
  );

  // V30.23: PRICE <-> MARKET CAP is a Y-axis unit conversion only.
  // Mint/timeframe changes may refit X; metric changes must preserve X viewport.
  const xContextChanged=
    chartRuntime.mint!==state.selectedMint ||
    chartRuntime.timeframe!==state.timeframe;

  let range=null;

  if(
    chartRuntime.forceFit ||
    xContextChanged ||
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
  const chartTheme=mfTradingChartPaletteV2();

  chartRuntime.suppressZoom=true;

  chartRuntime.api.setOption(
    {
      animation:false,
      /* MEMEFLOW_TRADING_CHART_RESTORE_SITE_BG_V2: render logic untouched */
      /* MEMEFLOW_TRADING_CHART_MATCH_PANEL_V3: match surrounding panel surface */
      backgroundColor:chartTheme.background,
      textStyle:{
        color:chartTheme.text,
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
          backgroundColor:chartTheme.pointerLabelBg,
          color:chartTheme.pointerLabelText,
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
            color:chartTheme.pointerLine,
            width:1,
            type:'dashed'
          },
          label:{
            show:!touchUi,
            formatter:chartPointerTimeLabel,
            backgroundColor:chartTheme.pointerLabelBg,
            color:chartTheme.pointerLabelText
          }
        },
        backgroundColor:chartTheme.tooltipBg,
        borderColor:chartTheme.tooltipBorder,
        textStyle:{
          color:chartTheme.tooltipText,
          fontSize:10
        },
        extraCssText:chartTheme.tooltipShadow,
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
        show:lowerIndicatorVisible,
        data:lowerIndicatorLegend,
        left:10,
        top:'72%',
        itemWidth:10,
        itemHeight:6,
        textStyle:{
          color:chartTheme.legend,
          fontSize:8
        },
        selectedMode:false
      },
      grid:[
        {
          left:10,
          right:76,
          top:42,
          height:lowerIndicatorVisible ? '55%' : '78%',
          containLabel:false
        },
        {
          show:lowerIndicatorVisible,
          left:10,
          right:76,
          top:lowerIndicatorVisible ? '77%' : '94%',
          height:lowerIndicatorVisible ? '15%' : 0,
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
          axisLabel:{
            show:!lowerIndicatorVisible,
            color:chartTheme.axis,
            fontSize:8,
            hideOverlap:true,
            formatter:value=>chartTimeLabel(value)
          },
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
          show:lowerIndicatorVisible,
          type:'category',
          data:labels,
          gridIndex:1,
          boundaryGap:true,
          axisLine:{
            show:lowerIndicatorVisible,
            lineStyle:{color:chartTheme.axisLine}
          },
          axisTick:{show:false},
          axisLabel:{
            show:lowerIndicatorVisible,
            color:chartTheme.axis,
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
              backgroundColor:chartTheme.pointerLabelBg,
              color:chartTheme.pointerLabelText
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
            color:chartTheme.axis,
            fontSize:9,
            margin:10,
            formatter:value=>formatChartValue(value)
          },
          splitLine:{
            show:true,
            lineStyle:{
              color:chartTheme.grid,
              width:1
            }
          }
        },
        {
          show:lowerIndicatorVisible,
          type:'value',
          gridIndex:1,
          position:'right',
          scale:lowerIndicatorAxis.scale!==false,
          min:lowerIndicatorAxis.min,
          max:lowerIndicatorAxis.max,
          axisLine:{show:false},
          axisTick:{show:false},
          axisLabel:{
            show:lowerIndicatorVisible,
            color:chartTheme.lowerAxis,
            fontSize:7,
            margin:10,
            formatter:lowerIndicatorAxis.formatter
          },
          splitLine:{
            show:lowerIndicatorVisible,
            lineStyle:{
              color:chartTheme.lowerGrid,
              width:1
            }
          }
        }
      ],
      dataZoom:[
        {
          type:'inside',
          xAxisIndex:lowerIndicatorVisible ? [0,1] : [0],
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
          emphasis:{disabled:true}
        },
        ...overlayIndicatorSeries,
        ...horizontalLevelSeries,
        ...lowerIndicatorSeries
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
  } catch (err) {
    console.error('[MF_CHART_RENDER_ERROR]', err);
    const el=document.getElementById('chartEmpty');
    if(el){
      el.style.display='grid';
      el.innerHTML=
        '<strong>Chart render error</strong>'+
        '<span>'+String(err?.stack || err?.message || err)+'</span>';
    }
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
  // MEMEFLOW_TERMINAL_PAPER_POLL_HOTPATH_V59_UI
  // Keep the existing 1.8s visual freshness, but never download/sort durable
  // paper history that this screen does not render.
  const [positionsPayload, tradesPayload, proposalsPayload, statusPayload] = await Promise.all([
    api('/api/paper/positions/live'),
    api('/api/paper/trades?limit=40'),
    api('/api/paper/proposals?actionable=1'),
    api('/api/paper/status')
  ]);

  state.positions = Array.isArray(positionsPayload.positions) ? positionsPayload.positions : [];
  state.trades = Array.isArray(tradesPayload.trades) ? tradesPayload.trades : [];
  state.proposals = Array.isArray(proposalsPayload.proposals) ? proposalsPayload.proposals : [];
  state.paperStatus = statusPayload || {};

  const previousSelectedMint = state.selectedMint;
  syncSelectedCandidate();
  updateCandidateCount();
  renderCandidates();
  renderSelected({
    redrawChart: redrawChart || previousSelectedMint !== state.selectedMint
  });

  renderProposals();
  renderPositions();
  renderTrades();

  const pnl = num(statusPayload.realizedPnlSol, 0);
  $('paperPnl').textContent = `${pnl >= 0 ? '+' : ''}${fmt(pnl, 5)} SOL`;
  $('paperPnl').className = pnl > 0 ? 'pnl-positive' : pnl < 0 ? 'pnl-negative' : '';

  if (redrawChart) scheduleChart();
}


function proposalTimestamp(proposal) {
  const direct = num(proposal?.createdAtMs);
  if (direct > 0) return direct;
  const parsed = Date.parse(proposal?.createdAt || '');
  return Number.isFinite(parsed) ? parsed : 0;
}

function actionableProposals() {
  const freshnessSec = Math.max(5, num(state.settings?.decisionFreshnessSec, 60));
  const cutoff = Date.now() - freshnessSec * 1000;
  const latestByMint = new Map();

  for (const proposal of state.proposals || []) {
    if (String(proposal?.status || '').toUpperCase() !== 'PENDING') continue;

    const createdAtMs = proposalTimestamp(proposal);
    if (createdAtMs > 0 && createdAtMs < cutoff) continue;

    const mint = String(proposal?.mint || '').trim();
    if (!mint) continue;

    const existing = latestByMint.get(mint);
    if (!existing || proposalTimestamp(existing) < createdAtMs) {
      latestByMint.set(mint, proposal);
    }
  }

  return [...latestByMint.values()]
    .sort((a, b) => proposalTimestamp(b) - proposalTimestamp(a));
}

async function resolveProposal(proposalId, action, sourceButton) {
  if (!proposalId || !['approve', 'reject'].includes(action)) return;

  const row = sourceButton?.closest?.('.approval-row');
  const buttons = row ? [...row.querySelectorAll('button')] : [];
  buttons.forEach(button => { button.disabled = true; });
  clearError();

  try {
    await api(
      `/api/paper/proposals/${encodeURIComponent(proposalId)}/${action}`,
      { method: 'POST' }
    );
    await loadPaper();
  } catch (error) {
    showError(error.message);
    await loadPaper().catch(() => {});
  } finally {
    buttons.forEach(button => { button.disabled = false; });
  }
}

function renderProposals() {
  const panel = $('approvalsPanel');
  const list = $('approvalList');
  const count = $('approvalCount');
  if (!panel || !list || !count) return;

  const mode = String(state.settings?.operatingMode || 'observe').toLowerCase();
  const rows = actionableProposals();

  panel.dataset.active = mode === 'assist' ? 'true' : 'false';
  count.dataset.active = mode === 'assist' ? 'true' : 'false';
  count.textContent = rows.length
    ? `${rows.length} PENDING`
    : mode === 'assist'
      ? 'ASSIST ACTIVE'
      : 'ASSIST OFF';

  if (!rows.length) {
    list.innerHTML = `
      <div class="empty approval-empty">
        ${mode === 'assist'
          ? 'Waiting for a fresh BUY READY token to review…'
          : 'Switch Trade control to Review manually to approve BUY READY entries.'}
      </div>
    `;
    return;
  }

  list.innerHTML = rows.map(proposal => {
    const createdAtMs = proposalTimestamp(proposal);
    const time = createdAtMs
      ? new Date(createdAtMs).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})
      : '—';
    const score = finite(proposal.decisionScore) ? fmt(proposal.decisionScore, 0) : '—';
    const confidence = finite(proposal.decisionConfidence) ? `${fmt(proposal.decisionConfidence, 0)}%` : '—';
    const price = finite(proposal.proposedPriceSol) ? `${fmt(proposal.proposedPriceSol, 9)} SOL` : '—';
    const size = finite(proposal.proposedSizeSol) ? `${fmt(proposal.proposedSizeSol, 4)} SOL` : '—';

    return `
      <div class="approval-row" data-id="${esc(proposal.id)}">
        <div class="approval-main">
          <strong>${esc(proposal.name || proposal.symbol || short(proposal.mint))}</strong>
          <span>${esc(proposal.symbol || short(proposal.mint))} · ${esc(short(proposal.mint, 6, 5))} · ${esc(time)}</span>
        </div>
        <div class="approval-stats">
          <span><b>SIZE</b><strong>${size}</strong></span>
          <span><b>SCORE</b><strong>${score}</strong></span>
          <span><b>CONF</b><strong>${confidence}</strong></span>
          <span><b>PRICE</b><strong>${price}</strong></span>
        </div>
        <div class="approval-actions">
          <button class="approval-reject" type="button" data-action="reject" data-id="${esc(proposal.id)}">Reject</button>
          <button class="approval-approve" type="button" data-action="approve" data-id="${esc(proposal.id)}">Approve buy</button>
        </div>
      </div>
    `;
  }).join('');

  list.querySelectorAll('[data-action][data-id]').forEach(button => {
    button.addEventListener('click', () => {
      resolveProposal(button.dataset.id, button.dataset.action, button);
    });
  });
}

/* MEMEFLOW_OPEN_POSITIONS_TRADE_ROW_LAYOUT_V1
 * Open positions use the same row hierarchy/avatar treatment as Candidates
 * and Recent trades. Position data and Close behavior are unchanged.
 */
function positionImageUrl(position) {
  if (!position) return '';

  const mint = String(position.mint || '').trim();

  const relatedCandidate =
    (state.candidates || []).find(item => String(item?.mint || '') === mint) ||
    null;

  const relatedTrade =
    (state.trades || []).find(trade =>
      String(trade?.mint || '') === mint &&
      Boolean(
        trade?.logoUrl ||
        trade?.imageUrl ||
        trade?.image ||
        trade?.icon
      )
    ) ||
    null;

  const raw = String(
    position.logoUrl ||
    position.imageUrl ||
    position.image ||
    position.icon ||
    relatedCandidate?.logoUrl ||
    relatedCandidate?.imageUrl ||
    relatedCandidate?.image ||
    relatedCandidate?.icon ||
    relatedTrade?.logoUrl ||
    relatedTrade?.imageUrl ||
    relatedTrade?.image ||
    relatedTrade?.icon ||
    ''
  ).trim();

  if (!raw) return '';

  const normalized = tokenImageCandidates(raw);
  return normalized[0] || raw;
}

function positionAvatarMarkup(position) {
  const symbol = String(
    position?.symbol ||
    position?.name ||
    'TK'
  ).trim();

  const fallback = symbol
    .replace(/[^A-Z0-9]/gi, '')
    .slice(0, 2)
    .toUpperCase() || 'TK';

  const url = positionImageUrl(position);

  if (url) {
    return `
      <span class="trade-token-avatar position-token-avatar">
        <img
          src="${esc(url)}"
          alt="${esc(symbol)}"
          loading="lazy"
          onerror="this.parentElement.classList.add('is-fallback');this.remove();"
        >
        <span class="trade-avatar-fallback-text">${esc(fallback)}</span>
      </span>
    `;
  }

  return `
    <span class="trade-token-avatar position-token-avatar is-fallback">
      <span class="trade-avatar-fallback-text">${esc(fallback)}</span>
    </span>
  `;
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
    const copyTrade =
      String(position.strategySource || '').toLowerCase() === 'copy-trading';

    const size =
      `${fmt(position.remainingSizeSol ?? position.initialSizeSol, 4)} SOL`;

    const pnlText =
      `${pnl >= 0 ? '+' : ''}${fmt(pnl, 2)}%`;

    return `
      <div class="position-row">
        ${positionAvatarMarkup(position)}

        <div class="position-main">
          <div class="position-topline">
            <strong class="position-symbol">
              ${esc(position.symbol || short(position.mint))}
              ${copyTrade
                ? ' <em class="copy-trade-badge">COPY TRADE</em>'
                : ''}
            </strong>
          </div>

          <div class="position-bottomline">
            <span class="position-size">${esc(size)}</span>
            <i>·</i>
            <strong class="position-pnl ${pnl >= 0 ? 'pnl-positive' : 'pnl-negative'}">
              ${esc(pnlText)}
            </strong>
            <i>·</i>
            <span>SL ${fmt(settings.hardStopPct, 1)}%</span>
            <i>·</i>
            <span>TP1 ${fmt(settings.tp1Pct, 0)}%</span>
            <i>·</i>
            <span>TP2 ${fmt(settings.tp2Pct, 0)}%</span>
          </div>
        </div>

        <button
          class="close-position"
          data-id="${esc(position.id)}"
          type="button"
        >Close</button>
      </div>
    `;
  }).join('');

  fitListToVisibleRows(list, '.position-row');

  list.querySelectorAll('.close-position').forEach(button => {
    button.addEventListener('click', async () => {
      if (!window.confirm('Close this PAPER position at the engine current price?')) return;
      button.disabled = true;
      try {
        await api(
          `/api/paper/positions/${encodeURIComponent(button.dataset.id)}/close`,
          { method: 'POST' }
        );
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

  const tradeTime = raw => {
    if (raw === null || raw === undefined || raw === '') return '—';

    let value = raw;
    if (typeof value === 'number' && value > 0 && value < 1e12) {
      value *= 1000;
    }

    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) return '—';

    return date.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const avatarMarkup = (url, symbol) => {
    const fallback = String(symbol || 'TK')
      .replace(/[^A-Z0-9]/gi, '')
      .slice(0, 2)
      .toUpperCase() || 'TK';

    if (url) {
      return `
        <span class="trade-token-avatar">
          <img
            src="${esc(url)}"
            alt="${esc(symbol)}"
            onerror="this.parentElement.classList.add('is-fallback');this.remove();"
          >
          <span class="trade-avatar-fallback-text">${esc(fallback)}</span>
        </span>
      `;
    }

    return `
      <span class="trade-token-avatar is-fallback">
        <span class="trade-avatar-fallback-text">${esc(fallback)}</span>
      </span>
    `;
  };

  list.innerHTML = rows.map(trade => {
    const side = String(trade.side || '').toUpperCase() || '—';
    const sideClass = side.toLowerCase();
    const mint = String(trade.mint || '').trim();

    const related =
      (state.candidates || []).find(item => item?.mint === mint) ||
      (state.positions || []).find(item => item?.mint === mint) ||
      null;

    const symbol = String(
      trade.symbol ||
      related?.symbol ||
      (mint ? short(mint) : 'TOKEN')
    ).trim();

    const tokenName = String(
      trade.name ||
      related?.name ||
      symbol
    ).trim();

    const avatarUrl = String(
      trade.logoUrl ||
      trade.imageUrl ||
      trade.image ||
      related?.logoUrl ||
      related?.imageUrl ||
      related?.image ||
      related?.icon ||
      ''
    ).trim();

    const rawTime =
      trade.at ??
      trade.createdAt ??
      trade.timestamp ??
      trade.executedAt;

    const reason = String(
      trade.reason ||
      trade.exitReason ||
      'ENGINE'
    ).trim();

    const sizeSol =
      num(trade.valueSol) ??
      num(trade.amountSol) ??
      num(trade.sizeSol);

    const pnl = num(trade.realizedPnlSol);
    const pnlText = finite(pnl)
      ? `${pnl >= 0 ? '+' : ''}${fmt(pnl, 5)} SOL`
      : '—';

    const pnlClass = finite(pnl)
      ? (pnl >= 0 ? 'pnl-positive' : 'pnl-negative')
      : '';

    const pumpUrl = mint
      ? `https://pump.fun/coin/${encodeURIComponent(mint)}`
      : '';

    return `
      <article class="trade-row trade-log-row">
        ${avatarMarkup(avatarUrl, symbol)}

        <div class="trade-log-main">
          <div class="trade-log-topline">
            <strong class="trade-side ${sideClass}">${esc(side)}</strong>
            <strong class="trade-log-symbol">${esc(symbol)}</strong>

            ${pumpUrl
              ? `<a class="trade-pump-link"
                    href="${esc(pumpUrl)}"
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Open ${esc(symbol)} on Pump.fun">Pump &#8599;</a>`
              : ''}

            <time class="trade-log-time">${esc(tradeTime(rawTime))}</time>
          </div>

          <div class="trade-log-bottomline">
            <span class="trade-token-name">${esc(tokenName)}</span>
            <i>·</i>
            <span>${finite(sizeSol) ? `${fmt(sizeSol, 4)} SOL` : '—'}</span>
            <i>·</i>
            <span class="${pnlClass}">${esc(pnlText)}</span>
            <i>·</i>
            <span class="trade-log-reason">${esc(reason)}</span>
          </div>
        </div>
      </article>
    `;
  }).join('');

  fitListToVisibleRows(list, '.trade-row.trade-log-row');
}

function openWalletSettings() {
  window.location.href = '/settings.html?v=cachefix-c6663c7-20260826-v1#wallet';
}

function bind() {
  $('walletBtn')?.addEventListener('click', openWalletSettings);

  const indicatorBar=$('indicatorBar');
  indicatorBar?.addEventListener('click',event=>{
    const button=event.target.closest('[data-indicator]');
    if(button)toggleChartIndicator(button);
  });
  syncChartIndicatorButtons();

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

    // V30.23: switching the display metric must not move/zoom the chart.
    // If a chart is already mounted, preserve its exact X viewport.
    chartRuntime.forceFit = !chartRuntime.labels.length;
    chartRuntime.dataKey = '';
    chartRuntime.levelsKey = '';
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

  $('amountInput')?.addEventListener('input', updateAmountHint);
  ['hardStopPct', 'trailingStopPct', 'tp1Pct', 'tp1SellPct', 'tp2Pct', 'tp2SellPct', 'runnerPct']
    .forEach(id => $(id)?.addEventListener('input', updateAllocation));

  $('saveStrategyBtn')?.addEventListener('click', onSaveStrategy);
  $('editStrategyBtn')?.addEventListener('click', () => {
    window.location.href = '/settings.html?v=cachefix-c6663c7-20260826-v1';
  });
  $('assistBtn')?.addEventListener('click', onAssist);
  $('startAutoBtn')?.addEventListener('click', onStartAuto);
  $('pauseBtn')?.addEventListener('click', onPause);
  $('killBtn')?.addEventListener('click', onKill);

  window.addEventListener('resize', scheduleChart);
}

async function poll({ redrawChart = false } = {}) {
  if (state.polling) return;
  state.polling = true;

  try {
    // MEMEFLOW_TERMINAL_WATCH_RESILIENT_V30
    //
    // Paper state and candidate feeds are independent UI domains.
    // A paper endpoint problem must never prevent Pipeline WATCH from rendering.
    const [paperResult, candidateResult] =
      await Promise.allSettled([
        loadPaper({ redrawChart }),
        loadCandidates({ redrawChart })
      ]);

    if (
      paperResult.status === 'rejected' ||
      candidateResult.status === 'rejected'
    ) {
      $('feedState').textContent = 'DEGRADED';

      if (paperResult.status === 'rejected') {
        console.warn(
          '[MEMEFLOW TERMINAL] paper refresh degraded',
          paperResult.reason
        );
      }

      if (candidateResult.status === 'rejected') {
        console.warn(
          '[MEMEFLOW TERMINAL] candidate refresh degraded',
          candidateResult.reason
        );
      }
    }
  } finally {
    state.polling = false;
  }
}

async function init() {
  bind();

  loadSolUsd().catch(
    error => console.warn('[MEMEFLOW USD]', error)
  );

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

/* MEMEFLOW_TRADING_CHART_V30_24_OPTIONAL_INDICATORS */

/* MEMEFLOW_TRADING_CHART_V30_26_EXTENDED_INDICATORS */
