#!/usr/bin/env python3
from pathlib import Path
import subprocess, shutil, datetime

ROOT = Path('/home/runner/workspace')
APP = ROOT / 'memeflow-app'
EXPECTED_BRANCH = 'debug-trading-v30-4-2026-08-19-1734'
EXPECTED_HEAD = 'c0106c22f23218beb5f64f9440e1d8b79acc8345'
TAG = 'CHART-V30.8'

def run(*args, check=True, cwd=ROOT):
    p = subprocess.run(args, cwd=cwd, text=True, capture_output=True)
    if p.stdout.strip():
        print(p.stdout.rstrip())
    if p.stderr.strip():
        print(p.stderr.rstrip())
    if check and p.returncode != 0:
        raise SystemExit(f'[{TAG}] command failed ({p.returncode}): {" ".join(args)}')
    return p

def read(path):
    return path.read_text(encoding='utf-8')

def write(path, text):
    path.write_text(text, encoding='utf-8')

def function_span(text, name):
    needle = f'function {name}('
    start = text.find(needle)
    if start < 0:
        raise RuntimeError(f'function anchor not found: {name}')
    brace = text.find('{', start)
    if brace < 0:
        raise RuntimeError(f'opening brace not found: {name}')
    depth = 0
    quote = None
    escape = False
    i = brace
    while i < len(text):
        ch = text[i]
        if quote:
            if escape:
                escape = False
            elif ch == '\\':
                escape = True
            elif ch == quote:
                quote = None
            i += 1
            continue
        if ch in ("'", '"', '`'):
            quote = ch
            i += 1
            continue
        if ch == '{':
            depth += 1
        elif ch == '}':
            depth -= 1
            if depth == 0:
                return start, i + 1
        i += 1
    raise RuntimeError(f'unterminated function: {name}')

def replace_function(text, name, replacement):
    start, end = function_span(text, name)
    return text[:start] + replacement.strip() + text[end:]

def insert_after_function(text, name, addition):
    _, end = function_span(text, name)
    return text[:end] + '\n\n' + addition.strip() + text[end:]

branch = run('git', 'branch', '--show-current').stdout.strip()
head = run('git', 'rev-parse', 'HEAD').stdout.strip()
print(f'[{TAG}] branch: {branch}')
print(f'[{TAG}] head:   {head}')

if branch != EXPECTED_BRANCH:
    raise SystemExit(f'[{TAG}] ERROR: wrong branch {branch}; expected {EXPECTED_BRANCH}. Nothing changed.')
if head != EXPECTED_HEAD:
    raise SystemExit(
        f'[{TAG}] ERROR: HEAD changed ({head}); expected verified V30.7 {EXPECTED_HEAD}. '
        'Nothing changed. Push the fresh state first.'
    )

targets = [APP / 'trading.js', APP / 'trading.html', APP / 'trading.css']
for p in targets:
    if not p.exists():
        raise SystemExit(f'[{TAG}] ERROR: missing {p}')

js = read(APP / 'trading.js')
html = read(APP / 'trading.html')
css = read(APP / 'trading.css')

for marker in [
    '/* MEMEFLOW_TRADING_CHART_V30_7_STABLE_HISTORY */',
    'function candlesFor(points, timeframe)',
    'function latestCandleFor(points,timeframe)',
    'function renderSelected()',
    'function drawChart()',
    'function bind()',
]:
    if marker not in js:
        raise SystemExit(f'[{TAG}] ERROR: V30.7 anchor missing: {marker}')

stamp = datetime.datetime.now().strftime('%Y%m%d-%H%M%S')
backup = APP / '.patch-backups' / f'trading-chart-v30-8-{stamp}'
backup.mkdir(parents=True, exist_ok=False)
for p in targets:
    shutil.copy2(p, backup / p.name)
print(f'[{TAG}] backup: {backup}')

old_state = '''  timeframe: 1000,
  rawByMint: new Map(),'''
new_state = '''  timeframe: 1000,
  chartMetric: (() => {
    try {
      return localStorage.getItem('memeflow:chart-metric') === 'marketCap'
        ? 'marketCap'
        : 'price';
    } catch {
      return 'price';
    }
  })(),
  rawByMint: new Map(),'''
if old_state not in js:
    raise SystemExit(f'[{TAG}] ERROR: state anchor missing')
js = js.replace(old_state, new_state, 1)

helpers = r'''
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
  if (timeframe === 'all') return null;
  const tf = Math.max(1000, Number(timeframe) || 1000);
  if (tf <= 1000) return 90 * 1000;
  if (tf <= 60_000) return 90 * 60_000;
  if (tf <= 300_000) return 12 * 60 * 60_000;
  if (tf <= 900_000) return 36 * 60 * 60_000;
  return 7 * 24 * 60 * 60_000;
}
'''
js = insert_after_function(js, 'usdFromSol', helpers)

render_selected = r'''
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
'''
js = replace_function(js, 'renderSelected', render_selected)

candles_for = r'''
function candlesFor(points, timeframe) {
  let clean = (Array.isArray(points) ? points : [])
    .filter(
      point =>
        finite(point?.t) &&
        finite(point?.priceSol ?? point?.price) &&
        Number(point?.priceSol ?? point?.price) > 0
    );

  if (!clean.length) return [];

  const rate = solUsdRate();
  if (!(rate > 0)) return [];

  const horizon = chartHorizonMs(timeframe);
  if (horizon && clean.length > 1) {
    const end = Number(clean[clean.length - 1].t);
    const floor = end - horizon;
    clean = clean.filter(point => Number(point.t) >= floor);
  }

  if (!clean.length) return [];

  const interval = chartInterval(clean, timeframe);
  const candles = [];
  let candle = null;
  let previousClose = null;
  let previousBucket = null;

  for (const point of clean) {
    const priceSol = Number(point?.priceSol ?? point?.price);
    const priceUsd = priceSol * rate;
    const price = chartValueFromUsdPrice(priceUsd);
    if (!(price > 0)) continue;

    const bucket =
      Math.floor(Number(point.t) / interval) * interval;

    if (!candle || candle.t !== bucket) {
      const adjacent =
        previousClose !== null &&
        previousBucket !== null &&
        bucket - previousBucket === interval;

      const open = adjacent ? previousClose : price;

      candle = {
        t: bucket,
        open,
        high: Math.max(open, price),
        low: Math.min(open, price),
        close: price,
        samples: 1,
        interval
      };
      candles.push(candle);
      previousBucket = bucket;
    } else {
      candle.high = Math.max(candle.high, price);
      candle.low = Math.min(candle.low, price);
      candle.close = price;
      candle.samples++;
    }

    previousClose = candle.close;
  }

  return candles.slice(-500);
}
'''
js = replace_function(js, 'candlesFor', candles_for)

latest_candle = r'''
function latestCandleFor(points, timeframe) {
  if (timeframe === 'all') return null;
  if (!Array.isArray(points) || !points.length) return null;

  const rate = solUsdRate();
  if (!(rate > 0)) return null;

  const interval = Math.max(1000, Number(timeframe) || 1000);
  let i = points.length - 1;

  while (i >= 0 && !(
    finite(points[i]?.t) &&
    finite(points[i]?.priceSol ?? points[i]?.price) &&
    Number(points[i]?.priceSol ?? points[i]?.price) > 0
  )) i--;

  if (i < 0) return null;

  const bucket =
    Math.floor(Number(points[i].t) / interval) * interval;

  let first = i;
  while (
    first > 0 &&
    Number(points[first - 1]?.t) >= bucket
  ) {
    first--;
  }

  let previousClose = null;
  let previousBucket = null;

  for (let j = first - 1; j >= 0; j--) {
    const p = Number(points[j]?.priceSol ?? points[j]?.price);
    if (finite(points[j]?.t) && Number.isFinite(p) && p > 0) {
      const converted = chartValueFromUsdPrice(p * rate);
      if (converted > 0) {
        previousClose = converted;
        previousBucket =
          Math.floor(Number(points[j].t) / interval) * interval;
      }
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
      Math.floor(Number(point.t) / interval) * interval;
    if (pointBucket !== bucket) continue;

    const price = chartValueFromUsdPrice(pointSol * rate);
    if (!(price > 0)) continue;

    if (!candle) {
      const adjacent =
        previousClose !== null &&
        previousBucket !== null &&
        bucket - previousBucket === interval;

      const open = adjacent ? previousClose : price;

      candle = {
        t: bucket,
        open,
        high: Math.max(open, price),
        low: Math.min(open, price),
        close: price,
        samples: 1,
        interval
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
'''
js = replace_function(js, 'latestCandleFor', latest_candle)

strategy_levels = r'''
function strategyLevels() {
  if (!state.selectedMint) return [];

  const rate = solUsdRate();
  if (!(rate > 0)) return [];

  const position = state.positions.find(
    p => p.status === 'OPEN' && p.mint === state.selectedMint
  );

  const entrySol = num(
    position?.entryPriceSol,
    candidatePrice(state.selected)
  );

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
'''
js = replace_function(js, 'strategyLevels', strategy_levels)

old_runtime = '''  timeframe:null,
  raf:null,'''
new_runtime = '''  timeframe:null,
  metric:null,
  raf:null,'''
if old_runtime not in js:
    raise SystemExit(f'[{TAG}] ERROR: runtime anchor missing')
js = js.replace(old_runtime, new_runtime, 1)

if '        formatter:formatPrice' not in js:
    raise SystemExit(f'[{TAG}] ERROR: chart formatter anchor missing')
js = js.replace('        formatter:formatPrice', '        formatter:formatChartValue', 1)

render_legend = r'''
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
'''
js = replace_function(js, 'renderLegend', render_legend)

update_realtime = r'''
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
    chartRuntime.timeframe!==state.timeframe ||
    chartRuntime.metric!==state.chartMetric;

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
    state.chartMetric,
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

  if(mint===state.selectedMint){
    const rawSol=Number(lastPoint?.priceSol ?? lastPoint?.price);
    renderPriceModeSummary(
      Number.isFinite(rawSol) && rawSol>0
        ? rawSol*solUsdRate()
        : null
    );
  }
}
'''
js = replace_function(js, 'updateRealtimeChart', update_realtime)

draw_chart = r'''
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
    renderPriceModeSummary();
    return;
  }

  $('chartEmpty').style.display='none';

  try{
    chartRuntime.series.applyOptions({
      priceFormat:{
        type:'custom',
        minMove:state.chartMetric==='marketCap' ? 0.01 : 1e-14,
        formatter:formatChartValue
      }
    });
  }catch{}

  const lastPoint=points[points.length-1];

  const dataKey=[
    state.selectedMint,
    String(state.timeframe),
    state.chartMetric,
    points.length,
    Number(lastPoint?.t||0),
    Number(lastPoint?.price||0)
  ].join('|');

  const contextChanged=
    chartRuntime.mint!==state.selectedMint ||
    chartRuntime.timeframe!==state.timeframe ||
    chartRuntime.metric!==state.chartMetric;

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
    chartRuntime.metric=state.chartMetric;
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
        ? 9
        : 8,
    minBarSpacing:
      Number(state.timeframe)<=1000
        ? 4
        : 3
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

  const rawSol=Number(lastPoint?.priceSol ?? lastPoint?.price);
  renderPriceModeSummary(
    Number.isFinite(rawSol) && rawSol>0
      ? rawSol*solUsdRate()
      : null
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
'''
js = replace_function(js, 'drawChart', draw_chart)

old_bind = '''function bind() {
  $('walletBtn').addEventListener('click', connectWallet);'''
new_bind = '''function bind() {
  $('walletBtn').addEventListener('click', connectWallet);

  $('priceModeBtn').addEventListener('click', () => {
    state.chartMetric =
      state.chartMetric === 'price'
        ? 'marketCap'
        : 'price';

    try {
      localStorage.setItem(
        'memeflow:chart-metric',
        state.chartMetric
      );
    } catch {}

    chartRuntime.forceFit = true;
    chartRuntime.dataKey = '';
    chartRuntime.levelsKey = '';
    chartRuntime.metric = null;
    renderPriceModeSummary();
    scheduleChart();
  });'''
if old_bind not in js:
    raise SystemExit(f'[{TAG}] ERROR: bind anchor missing')
js = js.replace(old_bind, new_bind, 1)

js = js.replace(
    '/* MEMEFLOW_TRADING_CHART_V30_7_STABLE_HISTORY */',
    '/* MEMEFLOW_TRADING_CHART_V30_7_STABLE_HISTORY */\n/* MEMEFLOW_TRADING_CHART_V30_8_PRICE_MC_GAP_SAFE */',
    1
)

old_price_html = '''            <div class="price-block">
              <div id="tokenPrice" class="token-price">$—</div>
              <div id="tokenMarket" class="token-market">MC — · BP —</div>
            </div>'''
new_price_html = '''            <button id="priceModeBtn" class="price-block price-toggle" type="button"
                    aria-label="Token price shown. Tap to show market cap.">
              <div id="tokenPrice" class="token-price">$—</div>
              <div id="tokenMarket" class="token-market">PRICE · MC — · BP —</div>
            </button>'''
if old_price_html not in html:
    raise SystemExit(f'[{TAG}] ERROR: price HTML anchor missing')
html = html.replace(old_price_html, new_price_html, 1)
html = html.replace(
    'Select a token. USD candles build from the canonical Pump curve price.',
    'Select a token. Tap the top-right value to switch USD price / market cap.',
    1
)
html = html.replace('/trading.css?v=v306', '/trading.css?v=v308', 1)
html = html.replace('/trading.js?v=v306', '/trading.js?v=v308', 1)
html += '\n<!-- MEMEFLOW_TRADING_CHART_V30_8_PRICE_MC_GAP_SAFE -->\n'

old_css = '''.price-block { text-align: right; }
.token-price { font-size: 15px; font-weight: 760; font-variant-numeric: tabular-nums; }
.token-market { margin-top: 4px; color: #647d88; font-size: 7px; }'''
new_css = '''.price-block { text-align: right; }
.price-toggle {
  min-width: 170px;
  padding: 6px 0 6px 8px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: inherit;
  appearance: none;
  -webkit-appearance: none;
  touch-action: manipulation;
}
.price-toggle:active {
  background: rgba(85, 217, 255, .035);
}
.price-toggle:focus-visible {
  outline: 1px solid rgba(85, 217, 255, .34);
  outline-offset: 2px;
}
.price-toggle[data-metric="marketCap"] .token-price {
  letter-spacing: -.015em;
}
.token-price { font-size: 15px; font-weight: 760; font-variant-numeric: tabular-nums; }
.token-market { margin-top: 4px; color: #647d88; font-size: 7px; }'''
if old_css not in css:
    raise SystemExit(f'[{TAG}] ERROR: price CSS anchor missing')
css = css.replace(old_css, new_css, 1)
css += '\n/* MEMEFLOW_TRADING_CHART_V30_8_PRICE_MC_GAP_SAFE */\n'

write(APP / 'trading.js', js)
write(APP / 'trading.html', html)
write(APP / 'trading.css', css)

print(f'[{TAG}] patched PRICE/MC tap toggle')
print(f'[{TAG}] patched chart to switch price scale together with the top value')
print(f'[{TAG}] patched gap-safe OHLC + recent timeframe windows')
print(f'[{TAG}] running checks...')

run('node', '--check', str(APP / 'trading.js'))
run('git', 'diff', '--check')

checks = {
    'price/mc state': 'chartMetric:' in js,
    'market cap formatter': 'function formatMarketCap' in js,
    'gap-safe candles': 'bucket - previousBucket === interval' in js,
    '1s recent horizon': 'return 90 * 1000' in js,
    'tap target': 'id="priceModeBtn"' in html,
    'v308 cache bust': 'trading.js?v=v308' in html and 'trading.css?v=v308' in html,
    'V30.8 marker': 'MEMEFLOW_TRADING_CHART_V30_8_PRICE_MC_GAP_SAFE' in js,
}
for name, ok in checks.items():
    print(f'[{TAG}] {"OK" if ok else "FAIL"}: {name}')
    if not ok:
        raise SystemExit(f'[{TAG}] verification failed: {name}')

print(f'[{TAG}] diff stat:')
run('git', 'diff', '--stat')

run(
    'git', 'add',
    'memeflow-app/trading.js',
    'memeflow-app/trading.html',
    'memeflow-app/trading.css'
)
run('git', 'diff', '--cached', '--check')

run(
    'git', 'commit', '-m',
    'Trading chart V30.8 price market-cap toggle and gap-safe OHLC'
)
run('git', 'push', '-u', 'origin', EXPECTED_BRANCH)

new_head = run('git', 'rev-parse', 'HEAD').stdout.strip()
print(f'[{TAG}] INSTALL + CHECK + COMMIT + PUSH COMPLETE')
print(f'[{TAG}] branch: {EXPECTED_BRANCH}')
print(f'[{TAG}] commit: {new_head}')
print(f'[{TAG}] backup: {backup}')
print(f'[{TAG}] restart Replit workflow/app, hard-refresh Trading Terminal, then tap the top-right quote.')
