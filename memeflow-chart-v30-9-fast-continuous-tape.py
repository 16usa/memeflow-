#!/usr/bin/env python3
from pathlib import Path
import subprocess, shutil, datetime

ROOT = Path('/home/runner/workspace')
APP = ROOT / 'memeflow-app'
BRANCH = 'debug-trading-v30-4-2026-08-19-1734'
EXPECTED_HEAD = 'f16393f78b12e260826e851961265fb660ff14a8'
TAG = 'CHART-V30.9'

def run(*args, check=True):
    p = subprocess.run(args, cwd=ROOT, text=True, capture_output=True)
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

branch = run('git', 'branch', '--show-current').stdout.strip()
head = run('git', 'rev-parse', 'HEAD').stdout.strip()
print(f'[{TAG}] branch: {branch}')
print(f'[{TAG}] head:   {head}')

if branch != BRANCH:
    raise SystemExit(f'[{TAG}] ERROR: wrong branch {branch}; expected {BRANCH}. Nothing changed.')
if head != EXPECTED_HEAD:
    raise SystemExit(
        f'[{TAG}] ERROR: HEAD is {head}; expected verified V30.8 {EXPECTED_HEAD}. '
        'Nothing changed. Push the fresh version first.'
    )

files = {
    'js': APP / 'trading.js',
    'html': APP / 'trading.html',
    'css': APP / 'trading.css',
    'feed': APP / 'src' / 'pump-live-trade-feed.mjs',
}
for p in files.values():
    if not p.exists():
        raise SystemExit(f'[{TAG}] ERROR: missing {p}')

js = read(files['js'])
html = read(files['html'])
css = read(files['css'])
feed = read(files['feed'])

for marker in [
    'MEMEFLOW_TRADING_CHART_V30_8_PRICE_MC_GAP_SAFE',
    'function candlesFor(points, timeframe)',
    'function latestCandleFor(points, timeframe)',
    'function strategyLevels()',
    'function connectChartStream(mint)',
    'function drawChart()',
]:
    if marker not in js:
        raise SystemExit(f'[{TAG}] ERROR: V30.8 anchor missing: {marker}')

if "params:[{mentions:[PUMP_PROGRAM]},{commitment:'confirmed'}]" not in feed:
    raise SystemExit(f'[{TAG}] ERROR: confirmed engine subscription anchor missing')

stamp = datetime.datetime.now().strftime('%Y%m%d-%H%M%S')
backup = APP / '.patch-backups' / f'trading-chart-v30-9-{stamp}'
backup.mkdir(parents=True, exist_ok=False)
for p in files.values():
    shutil.copy2(p, backup / p.name)
print(f'[{TAG}] backup: {backup}')

old_sol = '''  if (!previous || Math.abs(next / previous - 1) >= 0.0001) {
    chartRuntime.dataKey = '';
    chartRuntime.forceFit = true;
    renderCandidates();
    renderSelected();
    updateAmountHint();
    scheduleChart();
  }'''
new_sol = '''  if (!previous || Math.abs(next / previous - 1) >= 0.0001) {
    chartRuntime.dataKey = '';
    chartRuntime.levelsKey = '';
    // V30.9: FX refresh changes numeric USD values only.
    // Never call fitContent here; that was making the live viewport jump.
    renderCandidates();
    renderSelected();
    updateAmountHint();
    scheduleChart();
  }'''
if old_sol not in js:
    raise SystemExit(f'[{TAG}] ERROR: SOL/USD refresh anchor missing')
js = js.replace(old_sol, new_sol, 1)

strategy_levels = r'''
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
'''
js = replace_function(js, 'strategyLevels', strategy_levels)

old_runtime = '''  offscreenLevels:[]
};'''
new_runtime = '''  offscreenLevels:[],
  previewEntrySolByMint:new Map()
};'''
if old_runtime not in js:
    raise SystemExit(f'[{TAG}] ERROR: chartRuntime anchor missing')
js = js.replace(old_runtime, new_runtime, 1)

candles_for = r'''
function candlesFor(points, timeframe) {
  let clean = (Array.isArray(points) ? points : [])
    .filter(
      point =>
        finite(point?.t) &&
        finite(point?.priceSol ?? point?.price) &&
        Number(point?.priceSol ?? point?.price) > 0
    )
    .sort((a, b) => Number(a.t) - Number(b.t));

  if (!clean.length) return [];

  const rate = solUsdRate();
  if (!(rate > 0)) return [];

  const horizon = chartHorizonMs(timeframe);
  if (horizon && clean.length > 1) {
    const end = Math.max(
      Number(clean[clean.length - 1].t),
      Date.now()
    );
    const floor = end - horizon;
    clean = clean.filter(point => Number(point.t) >= floor);
  }

  if (!clean.length) return [];

  const interval = chartInterval(clean, timeframe);
  const candles = [];
  let candle = null;
  let previousClose = null;
  let previousBucket = null;

  const pushFlat = bucket => {
    if (!(previousClose > 0)) return;
    candles.push({
      t: bucket,
      open: previousClose,
      high: previousClose,
      low: previousClose,
      close: previousClose,
      samples: 0,
      interval,
      carry: true
    });
    previousBucket = bucket;
  };

  for (const point of clean) {
    const priceSol = Number(point?.priceSol ?? point?.price);
    const price = chartValueFromUsdPrice(priceSol * rate);
    if (!(price > 0)) continue;

    const bucket =
      Math.floor(Number(point.t) / interval) * interval;

    if (!candle || candle.t !== bucket) {
      if (
        previousBucket !== null &&
        previousClose > 0 &&
        bucket > previousBucket + interval
      ) {
        for (
          let gap = previousBucket + interval;
          gap < bucket && candles.length < 520;
          gap += interval
        ) {
          pushFlat(gap);
        }
      }

      candle = {
        t: bucket,
        open: price,
        high: price,
        low: price,
        close: price,
        samples: 1,
        interval,
        carry: false
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

  if (previousBucket !== null && previousClose > 0) {
    const nowBucket =
      Math.floor(Date.now() / interval) * interval;

    const maxTailBars =
      interval <= 1000 ? 12 :
      interval <= 60_000 ? 2 :
      1;

    let added = 0;
    for (
      let gap = previousBucket + interval;
      gap <= nowBucket && added < maxTailBars && candles.length < 520;
      gap += interval
    ) {
      pushFlat(gap);
      added++;
    }
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
      candle = {
        t: bucket,
        open: price,
        high: price,
        low: price,
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
'''
js = replace_function(js, 'latestCandleFor', latest_candle)

tape_helpers = r'''
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
'''
needle = 'function connectChartStream(mint) {'
idx = js.find(needle)
if idx < 0:
    raise SystemExit(f'[{TAG}] ERROR: chart stream anchor missing')
js = js[:idx] + tape_helpers.strip() + '\n\n' + js[idx:]

old_update_loop = '''      for(const point of incoming){
        changed=addPoint(mint,point,false)||changed;
      }'''
new_update_loop = '''      for(const point of incoming){
        pushLiveTradeTape(mint, point);
        changed=addPoint(mint,point,false)||changed;
      }'''
if old_update_loop not in js:
    raise SystemExit(f'[{TAG}] ERROR: SSE update loop anchor missing')
js = js.replace(old_update_loop, new_update_loop, 1)

old_select = '''  state.selectedMint = mint;
  state.selected = state.candidates.find(item => item.mint === mint) || null;
  chartRuntime.forceFit = true;'''
new_select = '''  state.selectedMint = mint;
  state.selected = state.candidates.find(item => item.mint === mint) || null;
  clearLiveTradeTape();
  chartRuntime.forceFit = true;'''
if old_select not in js:
    raise SystemExit(f'[{TAG}] ERROR: selectCandidate anchor missing')
js = js.replace(old_select, new_select, 1)

old_time_options = '''        minBarSpacing:3,
        fixLeftEdge:false,
        fixRightEdge:false'''
new_time_options = '''        minBarSpacing:3,
        fixLeftEdge:false,
        fixRightEdge:false,
        shiftVisibleRangeOnNewBar:true,
        rightBarStaysOnScroll:true'''
if old_time_options not in js:
    raise SystemExit(f'[{TAG}] ERROR: timeScale init anchor missing')
js = js.replace(old_time_options, new_time_options, 1)

old_data_key = '''  const dataKey=[
    state.selectedMint,
    String(state.timeframe),
    state.chartMetric,
    points.length,
    Number(lastPoint?.t||0),
    Number(lastPoint?.price||0)
  ].join('|');'''
new_data_key = '''  const lastBuilt = candles[candles.length - 1];
  const dataKey=[
    state.selectedMint,
    String(state.timeframe),
    state.chartMetric,
    points.length,
    Number(lastPoint?.t||0),
    Number(lastPoint?.price||0),
    candles.length,
    Number(lastBuilt?.t||0)
  ].join('|');'''
draw_pos = js.find('function drawChart()')
if draw_pos < 0:
    raise SystemExit(f'[{TAG}] ERROR: drawChart missing')
prefix, tail = js[:draw_pos], js[draw_pos:]
if old_data_key not in tail:
    raise SystemExit(f'[{TAG}] ERROR: drawChart dataKey anchor missing')
tail = tail.replace(old_data_key, new_data_key, 1)
js = prefix + tail

old_init_tail = '''  setInterval(
    () => loadSolUsd().catch(
      error => console.warn('[MEMEFLOW USD]', error)
    ),
    15_000
  );

  scheduleChart();'''
new_init_tail = '''  setInterval(
    () => loadSolUsd().catch(
      error => console.warn('[MEMEFLOW USD]', error)
    ),
    15_000
  );

  setInterval(() => {
    if (
      state.selectedMint &&
      state.timeframe !== 'all' &&
      Number(state.timeframe) <= 1000
    ) {
      scheduleChart();
    }
  }, 1000);

  scheduleChart();'''
if old_init_tail not in js:
    raise SystemExit(f'[{TAG}] ERROR: init timer anchor missing')
js = js.replace(old_init_tail, new_init_tail, 1)

js += '\n/* MEMEFLOW_TRADING_CHART_V30_9_FAST_CONTINUOUS_TAPE_FIXED_LEVELS */\n'

old_chart_legend = '''            <div id="chartLegend" class="chart-legend"></div>'''
new_chart_legend = '''            <div id="chartLegend" class="chart-legend"></div>
            <div id="liveTradeTape" class="live-trade-tape" aria-hidden="true"></div>'''
if old_chart_legend not in html:
    raise SystemExit(f'[{TAG}] ERROR: chartLegend HTML anchor missing')
html = html.replace(old_chart_legend, new_chart_legend, 1)
html = html.replace('/trading.css?v=v308', '/trading.css?v=v309', 1)
html = html.replace('/trading.js?v=v308', '/trading.js?v=v309', 1)
html += '\n<!-- MEMEFLOW_TRADING_CHART_V30_9_FAST_CONTINUOUS_TAPE_FIXED_LEVELS -->\n'

css_add = r'''
.live-trade-tape {
  position: absolute;
  z-index: 5;
  left: 9px;
  top: 88px;
  width: 92px;
  display: grid;
  gap: 5px;
  pointer-events: none;
  contain: layout paint;
}

.live-tape-row {
  width: max-content;
  max-width: 90px;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  opacity: .84;
  transform: translate3d(0, 0, 0);
  transition:
    opacity .38s ease,
    transform .38s ease;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 10px;
  line-height: 1;
  text-shadow: 0 1px 10px rgba(0,0,0,.9);
}

.live-tape-row strong {
  font-weight: 820;
  font-variant-numeric: tabular-nums;
}

.live-tape-row.buy {
  color: rgba(77, 230, 161, .82);
}

.live-tape-row.sell {
  color: rgba(255, 102, 121, .78);
}

.live-tape-arrow {
  width: 9px;
  text-align: center;
  font-size: 8px;
}

.live-tape-row.leaving {
  opacity: 0;
  transform: translate3d(-5px, -2px, 0);
}

@media (max-width: 760px) {
  .live-trade-tape {
    top: 86px;
    left: 8px;
    width: 84px;
    gap: 4px;
  }

  .live-tape-row {
    max-width: 82px;
    font-size: 9px;
  }
}
'''
css += '\n' + css_add.strip() + '\n'
css += '/* MEMEFLOW_TRADING_CHART_V30_9_FAST_CONTINUOUS_TAPE_FIXED_LEVELS */\n'

old_vars = '''  let ws=null,stopped=false,idx=0,reconnectTimer=null;'''
new_vars = '''  let ws=null,stopped=false,idx=0,reconnectTimer=null;
  let fastChartWs=null,fastChartIdx=0,fastChartReconnectTimer=null;
  const fastWarmByMint=new Map();
  const FAST_WARM_MAX_MINTS=200;
  const FAST_WARM_MAX_TICKS=64;
  const FAST_WARM_TTL_MS=30_000;'''
if old_vars not in feed:
    raise SystemExit(f'[{TAG}] ERROR: feed variable anchor missing')
feed = feed.replace(old_vars, new_vars, 1)

old_metrics = '''    distinctMints:0,distinctUsers:0,lastMint:null,lastUser:null,lastError:null,
    httpRpcCalls:0,queueDepth:0,active:0,'''
new_metrics = '''    distinctMints:0,distinctUsers:0,lastMint:null,lastUser:null,lastError:null,
    fastChartConnected:false,fastChartReconnects:0,fastChartTicks:0,
    fastChartBuffered:0,fastChartFlushed:0,fastChartLastAt:null,
    httpRpcCalls:0,queueDepth:0,active:0,'''
if old_metrics not in feed:
    raise SystemExit(f'[{TAG}] ERROR: feed metrics anchor missing')
feed = feed.replace(old_metrics, new_metrics, 1)

fast_block = r'''
  function fastChartTickFromEvent(e){
    const market=marketFromEvent(e);
    if(!(Number.isFinite(market.priceSol)&&market.priceSol>0))return null;

    const eventAt=(
      e.timestamp!==null &&
      e.timestamp!==undefined &&
      e.timestamp>0n
    )
      ? Number(e.timestamp)*1000
      : Date.now();

    return {
      id:e.signature?`${e.signature}:${Number(e.eventIndex||0)}`:null,
      mint:e.mint,
      t:eventAt,
      priceSol:market.priceSol,
      markPriceSol:market.priceSol,
      isBuy:e.isBuy===true,
      solAmount:Number(e.solAmount)/1e9,
      tokenAmount:Number(e.tokenAmount)/1e6,
      source:'pump-curve-mark-processed'
    };
  }

  function rememberFastWarm(tick){
    if(!tick?.mint)return;
    const now=Date.now();
    let row=fastWarmByMint.get(tick.mint);
    if(!row){
      row={at:now,ticks:[]};
      fastWarmByMint.set(tick.mint,row);
    }
    row.at=now;
    row.ticks.push(tick);
    if(row.ticks.length>FAST_WARM_MAX_TICKS){
      row.ticks.splice(0,row.ticks.length-FAST_WARM_MAX_TICKS);
    }
    metrics.fastChartBuffered++;

    if(fastWarmByMint.size>FAST_WARM_MAX_MINTS){
      const stale=[...fastWarmByMint.entries()]
        .sort((a,b)=>Number(a[1]?.at||0)-Number(b[1]?.at||0))
        .slice(0,fastWarmByMint.size-FAST_WARM_MAX_MINTS);
      for(const [mint] of stale)fastWarmByMint.delete(mint);
    }

    for(const [mint,item] of fastWarmByMint){
      if(now-Number(item?.at||0)>FAST_WARM_TTL_MS){
        fastWarmByMint.delete(mint);
      }
    }
  }

  function emitFastChart(e){
    const tick=fastChartTickFromEvent(e);
    if(!tick)return;

    const known=trackedPumpToken(store,e.mint);
    if(!known){
      rememberFastWarm(tick);
      return;
    }

    const warm=fastWarmByMint.get(e.mint);
    if(warm?.ticks?.length){
      fastWarmByMint.delete(e.mint);
      for(const buffered of warm.ticks){
        try{
          onChartTick?.(buffered);
          metrics.fastChartFlushed++;
        }catch{}
      }
    }

    try{
      onChartTick?.(tick);
      metrics.fastChartTicks++;
      metrics.fastChartLastAt=Date.now();
    }catch{}
  }

  async function connectFastChart(){
    if(stopped||!urls.length||!onChartTick)return;

    const url=urls[fastChartIdx++%urls.length];

    try{
      fastChartWs=await makeWS(url);

      fastChartWs.onopen=()=>{
        metrics.fastChartConnected=true;
        try{
          fastChartWs.send(JSON.stringify({
            jsonrpc:'2.0',
            id:129,
            method:'logsSubscribe',
            params:[
              {mentions:[PUMP_PROGRAM]},
              {commitment:'processed'}
            ]
          }));
        }catch{}
      };

      fastChartWs.onmessage=ev=>{
        try{
          const j=JSON.parse(
            typeof ev.data==='string'
              ? ev.data
              : String(ev.data)
          );
          const value=j?.params?.result?.value;
          if(!value||value.err)return;

          let eventIndex=0;
          for(const log of value.logs||[]){
            const b=programData(log);
            if(!b)continue;
            const e=decodeTradeEvent(b);
            if(!e)continue;

            e.signature=value.signature||null;
            e.eventIndex=eventIndex++;
            emitFastChart(e);
          }
        }catch(err){
          metrics.lastError='fast-chart:'+String(err?.message||err);
        }
      };

      fastChartWs.onerror=()=>{
        metrics.lastError='fast-chart-ws-error';
      };

      fastChartWs.onclose=()=>{
        metrics.fastChartConnected=false;
        if(stopped)return;
        metrics.fastChartReconnects++;
        clearTimeout(fastChartReconnectTimer);
        fastChartReconnectTimer=setTimeout(
          connectFastChart,
          700
        );
        fastChartReconnectTimer.unref?.();
      };
    }catch(err){
      metrics.fastChartConnected=false;
      metrics.fastChartReconnects++;
      metrics.lastError='fast-chart-connect:'+String(err?.message||err);
      fastChartReconnectTimer=setTimeout(
        connectFastChart,
        700
      );
      fastChartReconnectTimer.unref?.();
    }
  }
'''
anchor = '  async function connect(){'
idx = feed.find(anchor)
if idx < 0:
    raise SystemExit(f'[{TAG}] ERROR: confirmed connect anchor missing')
feed = feed[:idx] + fast_block.strip() + '\n\n' + feed[idx:]

old_start = '''  connect();

  return {'''
new_start = '''  // V30.9: low-latency processed stream is chart/tape ONLY.
  // Existing confirmed stream still owns engine/holder/AI semantics.
  connectFastChart();
  connect();

  return {'''
if old_start not in feed:
    raise SystemExit(f'[{TAG}] ERROR: feed start anchor missing')
feed = feed.replace(old_start, new_start, 1)

old_stop = '''    stop:()=>{stopped=true;clearTimeout(reconnectTimer);try{ws?.close?.()}catch{}}
  };'''
new_stop = '''    stop:()=>{
      stopped=true;
      clearTimeout(reconnectTimer);
      clearTimeout(fastChartReconnectTimer);
      try{ws?.close?.()}catch{}
      try{fastChartWs?.close?.()}catch{}
    }
  };'''
if old_stop not in feed:
    raise SystemExit(f'[{TAG}] ERROR: feed stop anchor missing')
feed = feed.replace(old_stop, new_stop, 1)
feed += '\n// MEMEFLOW_TRADING_CHART_V30_9_PROCESSED_CHART_ONLY\n'

write(files['js'], js)
write(files['html'], html)
write(files['css'], css)
write(files['feed'], feed)

print(f'[{TAG}] patched: continuous no-trade candles')
print(f'[{TAG}] patched: processed chart-only low-latency WS; confirmed engine preserved')
print(f'[{TAG}] patched: fixed SL/TP preview anchor + no FX viewport refit')
print(f'[{TAG}] patched: transient Pump-style live buy/sell tape')
print(f'[{TAG}] running checks...')

run('node', '--check', str(files['js']))
run('node', '--check', str(files['feed']))
run('git', 'diff', '--check')

checks = {
    'confirmed engine subscription preserved':
        "params:[{mentions:[PUMP_PROGRAM]},{commitment:'confirmed'}]" in feed,
    'processed chart-only subscription':
        "{commitment:'processed'}" in feed,
    'fast chart function':
        'function connectFastChart()' in feed,
    'carry-forward candles':
        'carry: true' in js and 'pushFlat(gap)' in js,
    'real bucket first-trade open':
        'open: price' in js,
    'stable preview entry':
        'previewEntrySolByMint:new Map()' in js,
    'no FX force fit':
        'Never call fitContent here' in js,
    'trade tape HTML':
        'id="liveTradeTape"' in html,
    'trade tape JS':
        'function pushLiveTradeTape' in js,
    'cache bust V309':
        '/trading.js?v=v309' in html and '/trading.css?v=v309' in html,
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
    'memeflow-app/trading.css',
    'memeflow-app/src/pump-live-trade-feed.mjs'
)
run('git', 'diff', '--cached', '--check')

run(
    'git', 'commit', '-m',
    'Trading chart V30.9 fast continuous candles fixed levels and live tape'
)
run('git', 'push', '-u', 'origin', BRANCH)

new_head = run('git', 'rev-parse', 'HEAD').stdout.strip()
print(f'[{TAG}] INSTALL + CHECK + COMMIT + PUSH COMPLETE')
print(f'[{TAG}] branch: {BRANCH}')
print(f'[{TAG}] commit: {new_head}')
print(f'[{TAG}] backup: {backup}')
print(f'[{TAG}] restart Replit workflow/app and hard-refresh Trading Terminal.')
print(f'[{TAG}] compare the SAME token on 1s against Pump.fun for 30-60 seconds.')
