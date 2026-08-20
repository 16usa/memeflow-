#!/usr/bin/env python3
from pathlib import Path
import shutil
import subprocess
import sys
from datetime import datetime

VERSION = "V30.5"
EXPECTED_BRANCH = "debug-trading-v30-4-2026-08-19-1734"
EXPECTED_HEAD = "73f3cc338d69c6352e8df488363546fd80921d4d"
REPO = Path("/home/runner/workspace")
APP = REPO / "memeflow-app"

FILES = {
    "feed": APP / "src" / "pump-live-trade-feed.mjs",
    "server": APP / "app-server.mjs",
    "js": APP / "trading.js",
    "html": APP / "trading.html",
    "css": APP / "trading.css",
}

def fail(msg):
    print(f"[CHART-{VERSION}] ERROR: {msg}")
    sys.exit(1)

def run(cmd, cwd=None, check=True):
    print("[CHART-V30.5] $", " ".join(map(str, cmd)))
    return subprocess.run(cmd, cwd=cwd, text=True, check=check)

def replace_once(text, old, new, label):
    n = text.count(old)
    if n != 1:
        fail(f"{label}: expected exactly 1 anchor, found {n}")
    return text.replace(old, new, 1)

def replace_between(text, start, end, body, label):
    a = text.find(start)
    if a < 0:
        fail(f"{label}: start anchor not found")
    b = text.find(end, a + len(start))
    if b < 0:
        fail(f"{label}: end anchor not found")
    return text[:a] + body.rstrip() + "\n\n" + text[b:]

if not APP.is_dir():
    fail(f"app root not found: {APP}")

for name, path in FILES.items():
    if not path.is_file():
        fail(f"missing {name}: {path}")

js0 = FILES["js"].read_text()
html0 = FILES["html"].read_text()
feed0 = FILES["feed"].read_text()
server0 = FILES["server"].read_text()
css0 = FILES["css"].read_text()

if "MEMEFLOW_TRADING_CHART_V30_4" not in js0:
    fail("trading.js is not the expected fresh V30.4 build")
if "MEMEFLOW_TRADING_CHART_V30_4" not in html0:
    fail("trading.html is not the expected fresh V30.4 build")
if "MEMEFLOW_TRADING_CHART_V30_4" not in feed0:
    fail("pump-live-trade-feed.mjs is not the expected fresh V30.4 build")
if "function __mfChartTradeTick" not in server0 or "/api/chart/stream" not in server0:
    fail("app-server.mjs chart stream topology is not the expected V30.4 build")
if "LightweightCharts" not in js0 or "CandlestickSeries" not in js0:
    fail("TradingView Lightweight Charts candlestick renderer not found")

branch = subprocess.check_output(
    ["git", "-C", str(REPO), "branch", "--show-current"],
    text=True
).strip()
if not branch:
    fail("git is in detached HEAD state")
if branch != EXPECTED_BRANCH:
    fail(f"wrong branch: expected {EXPECTED_BRANCH}, got {branch}")

head = subprocess.check_output(
    ["git", "-C", str(REPO), "rev-parse", "HEAD"],
    text=True
).strip()
if head != EXPECTED_HEAD:
    fail(f"wrong baseline HEAD: expected {EXPECTED_HEAD}, got {head}")

rel_targets = [str(path.relative_to(REPO)) for path in FILES.values()]
dirty = subprocess.check_output(
    ["git", "-C", str(REPO), "status", "--porcelain", "--", *rel_targets],
    text=True
).strip()
if dirty:
    fail("target files have local changes before patch; refusing to layer over them:\n" + dirty)

print(f"[CHART-{VERSION}] branch: {branch}")
print(f"[CHART-{VERSION}] baseline: {head}")
print(f"[CHART-{VERSION}] target files clean: YES")

backup = Path("/home/runner/memeflow-patch-backups") / (
    "trading-chart-v30-5-" + datetime.now().strftime("%Y%m%d-%H%M%S")
)
backup.mkdir(parents=True, exist_ok=False)
for path in FILES.values():
    rel = path.relative_to(APP)
    dst = backup / rel
    dst.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(path, dst)
print(f"[CHART-{VERSION}] backup: {backup}")

# 1) Pump feed: engine keeps reserve mark; chart gets actual TradeEvent execution price.
feed = feed0

old_market = '''function marketFromEvent(e){
  let priceSol=null,liquiditySol=null;
  if(e.virtualSolReserves>0n && e.virtualTokenReserves>0n){
    // SOL has 9 decimals, Pump token commonly has 6 decimals.
    priceSol=(Number(e.virtualSolReserves)/1e9)/(Number(e.virtualTokenReserves)/1e6);
  }
  if(e.realSolReserves!==null)liquiditySol=Number(e.realSolReserves)/1e9;
  return {priceSol,liquiditySol};
}'''

new_market = '''function marketFromEvent(e){
  let priceSol=null,liquiditySol=null;
  if(e.virtualSolReserves>0n && e.virtualTokenReserves>0n){
    // Canonical post-trade bonding-curve mark price used by the engine.
    priceSol=(Number(e.virtualSolReserves)/1e9)/(Number(e.virtualTokenReserves)/1e6);
  }
  if(e.realSolReserves!==null)liquiditySol=Number(e.realSolReserves)/1e9;
  return {priceSol,liquiditySol};
}
function executionPriceFromEvent(e){
  // Pump base mints use 6 decimals; native SOL uses 9 decimals.
  // TradeEvent exposes the exchanged amounts separately from fees.
  const sol=Number(e?.solAmount)/1e9;
  const tokens=Number(e?.tokenAmount)/1e6;
  if(!(Number.isFinite(sol)&&sol>0&&Number.isFinite(tokens)&&tokens>0))return null;
  const price=sol/tokens;
  return Number.isFinite(price)&&price>0?price:null;
}'''
feed = replace_once(feed, old_market, new_market, "feed execution-price helper")

old_chart_tick = '''      // Chart is fed directly by the decoded TradeEvent.
      // It is intentionally NOT routed through generic publish().
      if(Number.isFinite(m.priceSol)&&m.priceSol>0){
        try{
          onChartTick?.({
            mint:e.mint,
            t:eventAt,
            priceSol:m.priceSol,
            isBuy:e.isBuy===true,
            solAmount:Number(e.solAmount)/1e9,
            source:'pump-ws-trade-event'
          });
        }catch{}
      }'''

new_chart_tick = '''      // Chart is fed directly by the decoded TradeEvent and never by
      // holder/AI/polling publishes. The engine continues using m.priceSol
      // (bonding-curve mark); the chart uses the actual trade execution price.
      const executionPriceSol=executionPriceFromEvent(e);
      const chartPriceSol=
        Number.isFinite(executionPriceSol)&&executionPriceSol>0
          ? executionPriceSol
          : m.priceSol;

      if(Number.isFinite(chartPriceSol)&&chartPriceSol>0){
        try{
          onChartTick?.({
            id:e.signature?`${e.signature}:${Number(e.eventIndex||0)}`:null,
            mint:e.mint,
            t:eventAt,
            priceSol:chartPriceSol,
            executionPriceSol:Number.isFinite(executionPriceSol)?executionPriceSol:null,
            markPriceSol:Number.isFinite(m.priceSol)?m.priceSol:null,
            isBuy:e.isBuy===true,
            solAmount:Number(e.solAmount)/1e9,
            tokenAmount:Number(e.tokenAmount)/1e6,
            source:Number.isFinite(executionPriceSol)
              ? 'pump-trade-execution'
              : 'pump-reserve-mark-fallback'
          });
        }catch{}
      }'''
feed = replace_once(feed, old_chart_tick, new_chart_tick, "feed chart tick")

old_ws_loop = '''          metrics.notifications++;
          for(const log of value.logs||[]){
            const b=programData(log);
            if(!b)continue;
            metrics.programDataSeen++;
            try{
              const e=decodeTradeEvent(b);
              if(e)applyEvent(e);
            }catch(err){
              metrics.decodeErrors++;
              metrics.lastError='decode:'+String(err?.message||err);
            }
          }'''

new_ws_loop = '''          metrics.notifications++;
          let eventIndex=0;
          for(const log of value.logs||[]){
            const b=programData(log);
            if(!b)continue;
            metrics.programDataSeen++;
            try{
              const e=decodeTradeEvent(b);
              if(e){
                e.signature=value.signature||null;
                e.eventIndex=eventIndex++;
                applyEvent(e);
              }
            }catch(err){
              metrics.decodeErrors++;
              metrics.lastError='decode:'+String(err?.message||err);
            }
          }'''
feed = replace_once(feed, old_ws_loop, new_ws_loop, "feed event identity")
feed = feed.replace(
    "// MEMEFLOW_TRADING_CHART_V30_4",
    "// MEMEFLOW_TRADING_CHART_V30_4\n// MEMEFLOW_TRADING_CHART_V30_5_EXECUTION_TICKS",
    1
)

# 2) Server bounded chart history with deterministic event-id dedupe.
server = server0

new_record = '''function __mfChartRecord(mint,price,at=Date.now(),source=null,id=null,meta={}){
  const p=Number(price);
  const ts=Number(at);

  if(
    !mint ||
    !Number.isFinite(p) ||
    p<=0 ||
    !Number.isFinite(ts) ||
    ts<=0
  ){
    return false;
  }

  let row=__mfChartHistory.get(mint);

  if(!row){
    row={
      mint,
      points:[],
      seenIds:new Set(),
      lastSeenAt:ts
    };
    __mfChartHistory.set(mint,row);
  }

  row.seenIds ||= new Set();
  row.lastSeenAt=Math.max(
    Number(row.lastSeenAt||0),
    ts
  );

  const pointId=id?String(id):null;
  if(pointId && row.seenIds.has(pointId)){
    return false;
  }

  const last=row.points[row.points.length-1];

  if(
    !pointId &&
    last &&
    !last.id &&
    Number(last.t)===ts &&
    Number(last.price)===p &&
    String(last.source||'')===String(source||'')
  ){
    return false;
  }

  const point={
    t:ts,
    price:p,
    source:source||null,
    id:pointId,
    isBuy:meta?.isBuy===true,
    solAmount:Number(meta?.solAmount)||0,
    tokenAmount:Number(meta?.tokenAmount)||0,
    markPrice:Number.isFinite(Number(meta?.markPriceSol))
      ? Number(meta.markPriceSol)
      : null
  };

  row.points.push(point);
  if(pointId)row.seenIds.add(pointId);

  if(row.points.length>__MF_CHART_MAX_POINTS){
    const removed=row.points.splice(
      0,
      row.points.length-__MF_CHART_MAX_POINTS
    );
    for(const item of removed){
      if(item?.id)row.seenIds.delete(item.id);
    }
  }

  if(__mfChartHistory.size>__MF_CHART_MAX_MINTS){
    const old=[...__mfChartHistory.values()]
      .sort(
        (a,b)=>
          Number(a.lastSeenAt||0)-
          Number(b.lastSeenAt||0)
      )
      .slice(
        0,
        __mfChartHistory.size-__MF_CHART_MAX_MINTS
      );

    for(const item of old){
      __mfChartHistory.delete(item.mint);
    }
  }

  return true;
}'''
server = replace_between(
    server,
    "function __mfChartRecord(",
    "function __mfChartSnapshot(",
    new_record,
    "server bounded chart history"
)

new_trade_tick = '''function __mfChartTradeTick(tick){
  const mint=String(tick?.mint||'').trim();
  const price=Number(tick?.priceSol);
  const at=Number(tick?.t);

  if(
    !mint ||
    !Number.isFinite(price) ||
    price<=0 ||
    !Number.isFinite(at) ||
    at<=0
  ){
    return false;
  }

  const source=tick?.source||'pump-trade-execution';

  // A snapshot may have been seeded with the engine's reserve mark before the
  // first real trade arrived. Remove that seed as soon as real execution data
  // exists so it can never contaminate the first OHLC candle.
  const existing=__mfChartHistory.get(mint);
  if(
    existing?.points?.length===1 &&
    existing.points[0]?.source==='current-price-seed'
  ){
    existing.points.length=0;
    existing.seenIds?.clear?.();
  }

  const added=__mfChartRecord(
    mint,
    price,
    at,
    source,
    tick?.id||null,
    {
      isBuy:tick?.isBuy===true,
      solAmount:tick?.solAmount,
      tokenAmount:tick?.tokenAmount,
      markPriceSol:tick?.markPriceSol
    }
  );

  if(!added)return false;

  const listeners=streams.get(mint);
  if(!listeners?.size)return true;

  const payload=
    `event: update\\n`+
    `data: ${JSON.stringify({
      point:{
        id:tick?.id||null,
        t:at,
        price,
        source,
        isBuy:tick?.isBuy===true,
        solAmount:Number(tick?.solAmount)||0,
        tokenAmount:Number(tick?.tokenAmount)||0,
        markPrice:Number.isFinite(Number(tick?.markPriceSol))
          ? Number(tick.markPriceSol)
          : null
      },
      status:{
        stale:false,
        source,
        directTradeTicks:true,
        executionPriceTicks:source==='pump-trade-execution'
      }
    })}\\n\\n`;

  for(const res of [...listeners]){
    try{
      res.write(payload);
    }catch{}
  }

  return true;
}'''
server = replace_between(
    server,
    "function __mfChartTradeTick(",
    "// MEMEFLOW_V31_REAL_EVENT_WEB",
    new_trade_tick,
    "server chart SSE tick"
)

old_snapshot_status = '''  return {
    points,
    status:{
      stale:points.length===0,
      source:'pump-ws-trade-event',
      historyPoints:points.length,
      directTradeTicks:true
    }
  };'''
new_snapshot_status = '''  const lastSource=points[points.length-1]?.source||'pump-trade-execution';
  return {
    points,
    status:{
      stale:points.length===0,
      source:lastSource,
      historyPoints:points.length,
      directTradeTicks:true,
      executionPriceTicks:lastSource==='pump-trade-execution'
    }
  };'''
server = replace_once(server, old_snapshot_status, new_snapshot_status, "server snapshot status")

# 3) Browser: preserve settings, remove local chart cache, snapshot replace, incremental updates.
js = js0

old_next = '''  const next = {
    ...state.settings,
    ...strategy,
    positionSize: sizeSol,
    maxPositionSize: num(state.settings.maxPositionSize, 0.5),
    launchPlatforms: ['pump'],
    aiChangePolicy: 'propose',
    adaptiveProfile: false
  };'''
new_next = '''  // Trading Terminal owns only trading/risk fields. Never overwrite
  // discovery platform, AI profile, or unrelated System settings here.
  const next = {
    ...state.settings,
    ...strategy,
    positionSize: sizeSol
  };'''
js = replace_once(js, old_next, new_next, "preserve unrelated settings")

new_raw_block = '''function rawPoints(mint) {
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
}'''
js = replace_between(
    js,
    "function rawPoints(mint) {",
    "function connectChartStream(mint) {",
    new_raw_block,
    "browser raw chart history"
)

new_stream = '''function connectChartStream(mint) {
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
}'''
js = replace_between(
    js,
    "function connectChartStream(mint) {",
    "function candlesFor(points, timeframe) {",
    new_stream,
    "browser SSE snapshot/update"
)

new_candles = '''function chartInterval(points,timeframe){
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
}'''
js = replace_between(
    js,
    "function candlesFor(points, timeframe) {",
    "function strategyLevels() {",
    new_candles,
    "OHLC aggregation"
)

old_runtime_tail = '''  raf:null,
  forceFit:true,
  initialized:false
};'''
new_runtime_tail = '''  raf:null,
  forceFit:true,
  initialized:false,
  candleCount:0,
  lastCandleTime:null,
  offscreenLevels:[]
};'''
js = replace_once(js, old_runtime_tail, new_runtime_tail, "chart runtime counters")

old_levels_key = '''  const key=JSON.stringify(
    levels.map(level=>[
      level.label,
      Number(level.price)
    ])
  );'''
new_levels_key = '''  const key=JSON.stringify(
    levels.map(level=>[
      level.label,
      Number(level.price),
      level.price>=visibleMin && level.price<=visibleMax
    ])
  );'''
js = replace_once(js, old_levels_key, new_levels_key, "strategy line visibility key")

new_realtime = '''function updateRealtimeChart(mint){
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
}'''
js = replace_between(
    js,
    "function updateRealtimeChart(mint){",
    "function drawChart() {",
    new_realtime,
    "incremental realtime chart"
)

old_context_assign = '''    chartRuntime.dataKey=dataKey;
    chartRuntime.mint=state.selectedMint;
    chartRuntime.timeframe=state.timeframe;
  }'''
new_context_assign = '''    chartRuntime.dataKey=dataKey;
    chartRuntime.mint=state.selectedMint;
    chartRuntime.timeframe=state.timeframe;
    chartRuntime.candleCount=candles.length;
    chartRuntime.lastCandleTime=candles[candles.length-1]?.t??null;
  }'''
js = replace_once(js, old_context_assign, new_context_assign, "chart full-set counters")

old_offscreen = '''  const offscreen=refreshStrategyPriceLines(
    candles
  );'''
new_offscreen = '''  const offscreen=refreshStrategyPriceLines(
    candles
  );
  chartRuntime.offscreenLevels=offscreen;'''
js = replace_once(js, old_offscreen, new_offscreen, "chart strategy line cache")

js = js.replace(
    "/* MEMEFLOW_TRADING_CHART_V30_4 */",
    "/* MEMEFLOW_TRADING_CHART_V30_4 */\n/* MEMEFLOW_TRADING_CHART_V30_5_EXECUTION_OHLC */",
    1
)

# 4) Mobile: chart -> Trade control -> positions -> history -> candidates.
css = css0
old_mobile_order = '''  .candidates-panel { order: 2; }
  .center-stack { order: 1; width: 100%; }
  .control-panel { order: 3; }'''
new_mobile_order = '''  .center-stack { display: contents; }
  .chart-panel { order: 1; width: 100%; }
  .control-panel { order: 2; width: 100%; }
  .positions-panel { order: 3; width: 100%; }
  .history-panel { order: 4; width: 100%; }
  .candidates-panel { order: 5; width: 100%; }'''
css = replace_once(css, old_mobile_order, new_mobile_order, "mobile Trade control order")

css = css.replace(
    "/* MEMEFLOW_TRADING_CHART_V30_4",
    "/* MEMEFLOW_TRADING_CHART_V30_5\n   Execution-price OHLC + mobile control placement. No global visual overrides. */\n\n/* MEMEFLOW_TRADING_CHART_V30_4",
    1
)

# 5) HTML cache bust. Keep TradingView Lightweight Charts pinned at 5.2.0.
html = html0
html = replace_once(
    html,
    '<link rel="stylesheet" href="/trading.css?v=v304">',
    '<link rel="stylesheet" href="/trading.css?v=v305">',
    "trading.css cache bust"
)
html = replace_once(
    html,
    '<script type="module" src="/trading.js?v=v304"></script>',
    '<script type="module" src="/trading.js?v=v305"></script>',
    "trading.js cache bust"
)
html = html.replace(
    "<!-- MEMEFLOW_TRADING_CHART_V30_4 -->",
    "<!-- MEMEFLOW_TRADING_CHART_V30_4 -->\n  <!-- MEMEFLOW_TRADING_CHART_V30_5_EXECUTION_OHLC -->",
    1
)

FILES["feed"].write_text(feed)
FILES["server"].write_text(server)
FILES["js"].write_text(js)
FILES["css"].write_text(css)
FILES["html"].write_text(html)

print(f"[CHART-{VERSION}] files patched")

for path in (FILES["server"], FILES["feed"], FILES["js"]):
    run(["node", "--check", str(path)])

run(["git", "-C", str(REPO), "diff", "--check"])

checks = {
    "TradingView 5.2.0": "lightweight-charts@5.2.0" in html,
    "CandlestickSeries": "LW.CandlestickSeries" in js,
    "execution price": "executionPriceFromEvent" in feed,
    "chart execution source": "pump-trade-execution" in feed,
    "engine mark remains": "patch.priceSol=m.priceSol" in feed,
    "snapshot replaces browser cache": "replaceChartSnapshot" in js,
    "no chart sessionStorage": "sessionStorage" not in js,
    "incremental latest candle": "latestCandleFor" in js,
    "no per-tick browser history scan": "points.some(item=>item.id===next.id)" not in js,
    "seed removed on first real trade": "current-price-seed" in server and "existing.points.length=0" in server,
    "Trading save no Pump override": "launchPlatforms: ['pump']" not in js,
    "mobile control after chart": ".control-panel { order: 2; width: 100%; }" in css,
    "V30.5 html marker": "MEMEFLOW_TRADING_CHART_V30_5_EXECUTION_OHLC" in html,
}
for name, ok in checks.items():
    print(f"[CHART-{VERSION}] {'OK' if ok else 'FAIL'} {name}")
    if not ok:
        fail(f"post-flight check failed: {name}")

rel_paths = [str(path.relative_to(REPO)) for path in FILES.values()]
run(["git", "-C", str(REPO), "add", "--", *rel_paths])
run(["git", "-C", str(REPO), "diff", "--cached", "--check"])

cached_rc = subprocess.run(
    ["git", "-C", str(REPO), "diff", "--cached", "--quiet"],
    check=False
).returncode

if cached_rc == 1:
    run([
        "git", "-C", str(REPO), "commit",
        "-m", "Trading chart V30.5 real execution OHLC"
    ])
else:
    print(f"[CHART-{VERSION}] no staged diff; nothing new to commit")

run(["git", "-C", str(REPO), "push", "-u", "origin", branch])

print()
print(f"[CHART-{VERSION}] INSTALL + CHECK + COMMIT + PUSH COMPLETE")
print(f"[CHART-{VERSION}] branch: {branch}")
print(f"[CHART-{VERSION}] backup: {backup}")
print(f"[CHART-{VERSION}] restart the Replit workflow/app, then hard-refresh Trading Terminal")
print(f"[CHART-{VERSION}] test 1s for 20-30s, then 1m / 5m / 15m / 1h / All")
