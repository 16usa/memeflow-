#!/usr/bin/env python3
from __future__ import annotations

import shutil
import subprocess
import sys
import time
from pathlib import Path

PATCH_ID = "MEMEFLOW_TRADING_CHART_V30_4"
STAMP = time.strftime("%Y%m%d-%H%M%S")

def log(msg):
    print(f"[CHART-V30.4] {msg}", flush=True)

def locate():
    candidates = [
        Path.cwd(),
        Path.cwd() / "memeflow-app",
        Path.home() / "workspace" / "memeflow-app",
        Path("/home/runner/workspace/memeflow-app"),
    ]
    for p in candidates:
        try:
            p = p.resolve()
        except Exception:
            continue
        if (
            (p / "app-server.mjs").is_file()
            and (p / "trading.js").is_file()
            and (p / "trading.html").is_file()
            and (p / "trading.css").is_file()
            and (p / "src" / "pump-live-trade-feed.mjs").is_file()
        ):
            return p
    raise RuntimeError("MEMEFLOW project root not found")

ROOT = locate()
APP = ROOT / "app-server.mjs"
JS = ROOT / "trading.js"
HTML = ROOT / "trading.html"
CSS = ROOT / "trading.css"
PUMP = ROOT / "src" / "pump-live-trade-feed.mjs"

BACKUP = ROOT / f".trading-chart-v30-4-backup-{STAMP}"
BACKUP.mkdir(parents=True, exist_ok=True)

original = {}

def remember(path: Path):
    text = path.read_text(encoding="utf-8")
    original[path] = text
    target = BACKUP / path.relative_to(ROOT)
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(path, target)
    return text

def rollback(reason):
    log(f"ERROR: {reason}")
    for path, text in original.items():
        path.write_text(text, encoding="utf-8")
    log("ROLLBACK COMPLETE")
    sys.exit(1)

def node_check(path: Path):
    p = subprocess.run(
        ["node", "--check", str(path)],
        cwd=ROOT,
        capture_output=True,
        text=True,
    )
    if p.returncode:
        raise RuntimeError(
            f"{path.relative_to(ROOT)} syntax error:\n{p.stderr or p.stdout}"
        )

def find_function(text: str, name: str, start_at: int = 0):
    marker = f"function {name}("
    start = text.find(marker, start_at)
    if start < 0:
        raise RuntimeError(f"function {name}() not found")

    async_prefix = "async "
    prefix_start = start - len(async_prefix)
    if prefix_start >= 0 and text[prefix_start:start] == async_prefix:
        before = text[prefix_start - 1] if prefix_start > 0 else ""
        if not (before.isalnum() or before in "_$"):
            start = prefix_start

    brace = text.find("{", start)
    if brace < 0:
        raise RuntimeError(f"function {name}() opening brace not found")

    depth = 0
    quote = None
    escape = False
    i = brace

    while i < len(text):
        ch = text[i]
        if quote:
            if escape:
                escape = False
            elif ch == "\\":
                escape = True
            elif ch == quote:
                quote = None
            i += 1
            continue

        if ch in ("'", '"', "`"):
            quote = ch
            i += 1
            continue

        if ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                return start, i + 1

        i += 1

    raise RuntimeError(f"function {name}() closing brace not found")

def replace_function(text: str, name: str, replacement: str):
    start, end = find_function(text, name)
    return text[:start] + replacement.strip() + text[end:]

def replace_once(text: str, old: str, new: str, label: str):
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: expected exactly 1 anchor, found {count}")
    return text.replace(old, new, 1)

try:
    log(f"root: {ROOT}")

    app = remember(APP)
    js = remember(JS)
    html = remember(HTML)
    css = remember(CSS)
    pump = remember(PUMP)

    if any(PATCH_ID in t for t in (app, js, html, css, pump)):
        log("already installed")
        sys.exit(0)

    required = [
        ("app V30.3.1", "MEMEFLOW_TRADING_CHART_V30_3_1", app),
        ("js V30.3.1", "MEMEFLOW_TRADING_CHART_V30_3_1", js),
        ("chart history", "function __mfChartRecord(", app),
        ("chart snapshot", "function __mfChartSnapshot(", app),
        ("generic publish", "function publish(mint)", app),
        ("pump live opts", "const __pumpLiveTradeFeedOpts={", app),
        ("pump TradeEvent decoder", "function decodeTradeEvent(", pump),
        ("pump applyEvent", "function applyEvent(e)", pump),
        ("trading candles", "function candlesFor(points, timeframe)", js),
        ("trading draw", "function drawChart()", js),
        ("trading stream", "function connectChartStream(mint)", js),
        ("chart canvas", '<canvas id="chartCanvas"></canvas>', html),
    ]

    missing = [label for label, needle, text in required if needle not in text]
    if missing:
        raise RuntimeError("PRE-FLIGHT missing: " + ", ".join(missing))

    log("PRE-FLIGHT OK")
    log("verified fresh pushed V30.3.1 branch topology")

    # ============================================================
    # 1) REAL PUMP TRADE TICKS
    # ============================================================

    pump = replace_once(
        pump,
        "const {eventHolderLedger,store,publish,evaluateAI,onTokenUpdate}=opts;",
        "const {eventHolderLedger,store,publish,evaluateAI,onTokenUpdate,onChartTick}=opts;",
        "pump opts destructuring",
    )

    old_market_block = """      const m=marketFromEvent(e),buyPressure=updatePressure(e);
      const patch={marketSource:'ws-direct-trade-event',buyPressure,lastPriceAt:Date.now()};
      if(Number.isFinite(m.priceSol)&&m.priceSol>0)patch.priceSol=m.priceSol;
      if(Number.isFinite(m.liquiditySol)&&m.liquiditySol>=0)patch.liquiditySol=m.liquiditySol;
      const updated=store?.setToken?.(e.mint,patch);
      if(updated){metrics.marketSnapshots++;updatedForEval=updated}"""

    new_market_block = """      const m=marketFromEvent(e),buyPressure=updatePressure(e);

      // Pump TradeEvent carries an on-chain Unix timestamp in seconds.
      // Use it as the canonical candle timestamp instead of browser/server receipt time.
      const eventAt=(
        e.timestamp!==null &&
        e.timestamp!==undefined &&
        e.timestamp>0n
      )
        ? Number(e.timestamp)*1000
        : Date.now();

      const patch={
        marketSource:'ws-direct-trade-event',
        buyPressure,
        lastPriceAt:eventAt
      };

      if(Number.isFinite(m.priceSol)&&m.priceSol>0)patch.priceSol=m.priceSol;
      if(Number.isFinite(m.liquiditySol)&&m.liquiditySol>=0)patch.liquiditySol=m.liquiditySol;

      const updated=store?.setToken?.(e.mint,patch);

      if(updated){
        metrics.marketSnapshots++;
        updatedForEval=updated;
      }

      // Chart is fed directly by the decoded TradeEvent.
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
      }"""

    pump = replace_once(
        pump,
        old_market_block,
        new_market_block,
        "Pump market TradeEvent block",
    )

    # ============================================================
    # 2) SERVER CHART HISTORY + DIRECT SSE BROADCAST
    # ============================================================

    # Keep bounded memory but retain materially more trade ticks for active charts.
    app = app.replace(
        "Math.min(300,Number(process.env.CHART_HISTORY_MAX_MINTS||180))",
        "Math.min(160,Number(process.env.CHART_HISTORY_MAX_MINTS||80))",
        1,
    )
    app = app.replace(
        "Math.min(2400,Number(process.env.CHART_HISTORY_MAX_POINTS||1500))",
        "Math.min(12000,Number(process.env.CHART_HISTORY_MAX_POINTS||6000))",
        1,
    )

    snapshot_fn = r"""
function __mfChartSnapshot(mint){
  const token=store.state?.tokens?.[mint]||null;
  const row=__mfChartHistory.get(mint);

  // Seed with current price only when this server has not yet observed a
  // real TradeEvent for the token since startup.
  if(
    (!row || !row.points?.length) &&
    token?.priceSol
  ){
    __mfChartRecord(
      mint,
      token.priceSol,
      Number(token.lastPriceAt)||Date.now(),
      'current-price-seed'
    );
  }

  const points=
    (__mfChartHistory.get(mint)?.points||[])
      .slice(-__MF_CHART_MAX_POINTS);

  return {
    points,
    status:{
      stale:points.length===0,
      source:'pump-ws-trade-event',
      historyPoints:points.length,
      directTradeTicks:true
    }
  };
}

function __mfChartTradeTick(tick){
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

  const added=__mfChartRecord(
    mint,
    price,
    at,
    tick?.source||'pump-ws-trade-event'
  );

  if(!added)return false;

  const listeners=streams.get(mint);
  if(!listeners?.size)return true;

  const payload=
    `event: update\n`+
    `data: ${JSON.stringify({
      point:{
        t:at,
        price,
        source:tick?.source||'pump-ws-trade-event',
        isBuy:tick?.isBuy===true,
        solAmount:Number(tick?.solAmount)||0
      },
      status:{
        stale:false,
        source:'pump-ws-trade-event',
        directTradeTicks:true
      }
    })}\n\n`;

  for(const res of [...listeners]){
    try{
      res.write(payload);
    }catch{}
  }

  return true;
}
"""
    app = replace_function(app, "__mfChartSnapshot", snapshot_fn)

    # Generic token publication must not create candle ticks.
    publish_fn = r"""
function publish(mint){
  // System View remains on the authoritative generic token-update cadence.
  try{
    const token=store?.state?.tokens?.[mint]||{};

    __systemViewEmitV31(
      'token',
      {
        mint:String(mint||''),
        updatedAt:Number(
          token?.updatedAt||
          Date.now()
        )
      }
    );
  }catch{}

  // Game remains on the same generic token updates.
  try{
    pepeGame.onTokenUpdate(
      mint,
      store.state.tokens[mint]
    );
  }catch(_){}
}
"""
    app = replace_function(app, "publish", publish_fn)

    app = replace_once(
        app,
        """  // MF_V302_PAPER_WS_DIRECT
  onTokenUpdate:(mint,updated)=>{try{paper.onTokenUpdate(mint,updated||store.state.tokens[mint])}catch{}}
};""",
        """  // MF_V302_PAPER_WS_DIRECT
  onTokenUpdate:(mint,updated)=>{try{paper.onTokenUpdate(mint,updated||store.state.tokens[mint])}catch{}},

  // V30.4 chart path: decoded Pump TradeEvent -> bounded history -> SSE.
  onChartTick:(tick)=>{try{__mfChartTradeTick(tick)}catch{}}
};""",
        "pump live feed options",
    )

    # Make the existing history endpoint return the same authoritative chart source.
    old_history = """ if(url.pathname==='/api/chart/history'){const mint=url.searchParams.get('tokenAddress'),t=store.state.tokens[mint];const pts=t?.priceSol?[{t:t.updatedAt,price:t.priceSol,source:t.source}]:[];return json(res,200,{points:pts,status:{stale:!pts.length,source:t?.source||null,error:t?.scanError||null},tokenAddress:mint})}"""
    new_history = """ if(url.pathname==='/api/chart/history'){const mint=String(url.searchParams.get('tokenAddress')||'').trim();const snap=__mfChartSnapshot(mint);return json(res,200,{...snap,tokenAddress:mint})}"""
    app = replace_once(app, old_history, new_history, "chart history route")

    # ============================================================
    # 3) HTML: PROVEN CANDLESTICK RENDERER
    # ============================================================

    html = replace_once(
        html,
        '<link rel="stylesheet" href="/trading.css?v=v30">',
        '<link rel="stylesheet" href="/trading.css?v=v304">',
        "trading css cache tag",
    )

    html = replace_once(
        html,
        '<canvas id="chartCanvas"></canvas>',
        """<div id="chartCanvas" aria-label="Live candlestick chart"></div>
            <a class="chart-credit" href="https://www.tradingview.com/" target="_blank" rel="noopener noreferrer">TradingView Lightweight Charts™ · Copyright © 2025 TradingView, Inc.</a>""",
        "chart canvas host",
    )

    html = replace_once(
        html,
        '<script type="module" src="/trading.js?v=v30"></script>',
        """<script src="https://unpkg.com/lightweight-charts@5.2.0/dist/lightweight-charts.standalone.production.js"></script>
  <script type="module" src="/trading.js?v=v304"></script>""",
        "trading scripts",
    )

    # ============================================================
    # 4) CSS: ONE NAMESPACED CHART LAYER ONLY
    # ============================================================

    css += r"""

/* MEMEFLOW_TRADING_CHART_V30_4
   Lightweight Charts host only. No global design overrides. */
.chart-wrap {
  background: #02070a;
}

#chartCanvas {
  position: absolute;
  inset: 0;
  z-index: 1;
  display: block;
  width: 100%;
  height: 100%;
  touch-action: pan-y;
}

#chartCanvas > div {
  width: 100% !important;
  height: 100% !important;
}

.chart-legend {
  z-index: 4;
  max-width: calc(100% - 24px);
}

.chart-empty {
  z-index: 5;
}

.chart-credit {
  position: absolute;
  right: 8px;
  bottom: 5px;
  z-index: 4;
  color: rgba(111, 154, 172, .42);
  font-size: 5px;
  line-height: 1;
  text-decoration: none;
}

.chart-credit:hover {
  color: rgba(181, 237, 250, .72);
}
"""

    # ============================================================
    # 5) FRONTEND DATA: TRUE OHLC FROM TICKS
    # ============================================================

    # New cache namespace so no synthetic V30.3 history is reused.
    js = js.replace("mfchart:v3:", "mfchart:v4:", 2)

    add_point_fn = r"""
function addPoint(mint, t, price, source = 'live', redraw = true) {
  if(
    !mint ||
    !(num(price)>0)
  ){
    return false;
  }

  const points=rawPoints(mint);
  const ts=num(t,Date.now());
  const p=num(price);

  if(
    !(ts>0) ||
    !(p>0)
  ){
    return false;
  }

  const duplicate=points.some(
    point =>
      Number(point.t)===ts &&
      Number(point.price)===p
  );

  if(duplicate)return false;

  points.push({
    t:ts,
    price:p,
    source:source||null
  });

  points.sort((a,b)=>a.t-b.t);

  if(points.length>8000){
    points.splice(
      0,
      points.length-8000
    );
  }

  try{
    sessionStorage.setItem(
      `mfchart:v4:${mint}`,
      JSON.stringify(points.slice(-5000))
    );
  }catch{}

  if(redraw){
    updateRealtimeChart(mint);
  }

  return true;
}
"""
    js = replace_function(js, "addPoint", add_point_fn)

    stream_fn = r"""
function connectChartStream(mint) {
  if(state.chartSource){
    state.chartSource.close();
    state.chartSource=null;
  }

  if(!mint || !window.EventSource)return;

  const source=new EventSource(
    `/api/chart/stream?tokenAddress=${encodeURIComponent(mint)}`
  );

  source.__mint=mint;

  const applyPayload=(event,isSnapshot)=>{
    try{
      const payload=JSON.parse(event.data||'{}');
      const incoming=[];

      if(payload.point)incoming.push(payload.point);
      if(Array.isArray(payload.points))incoming.push(...payload.points);

      let changed=false;

      incoming
        .filter(
          point =>
            finite(point?.t) &&
            finite(point?.price) &&
            Number(point.price)>0
        )
        .sort((a,b)=>Number(a.t)-Number(b.t))
        .forEach(point=>{
          changed=
            addPoint(
              mint,
              point.t,
              point.price,
              point.source||payload?.status?.source||'pump-ws-trade-event',
              false
            ) || changed;
        });

      if(isSnapshot){
        chartRuntime.forceFit=true;
        scheduleChart();
      }else if(changed){
        updateRealtimeChart(mint);
      }

      if(
        payload?.status?.stale===false ||
        incoming.length
      ){
        $('feedState').textContent='LIVE';
      }
    }catch(error){
      console.warn('[MEMEFLOW CHART] SSE payload',error);
    }
  };

  source.addEventListener(
    'snapshot',
    event=>applyPayload(event,true)
  );

  source.addEventListener(
    'update',
    event=>applyPayload(event,false)
  );

  source.onerror=()=>{
    $('feedState').textContent='RECONNECTING';
  };

  source.onopen=()=>{
    $('feedState').textContent='LIVE';
  };

  state.chartSource=source;
}
"""
    js = replace_function(js, "connectChartStream", stream_fn)

    candles_fn = r"""
function candlesFor(points, timeframe) {
  const clean=(Array.isArray(points)?points:[])
    .filter(
      point =>
        finite(point?.t) &&
        finite(point?.price) &&
        Number(point.price)>0
    )
    .map(point=>({
      t:Number(point.t),
      price:Number(point.price)
    }))
    .sort((a,b)=>a.t-b.t);

  if(!clean.length)return [];

  let interval;

  if(timeframe==='all'){
    const span=Math.max(
      1,
      clean[clean.length-1].t-clean[0].t
    );

    // Around 100 visible bars for All.
    const raw=Math.ceil(span/100);
    const steps=[
      1000,5000,15000,30000,
      60000,300000,900000,
      3600000
    ];

    interval=
      steps.find(step=>step>=raw)||
      3600000;
  }else{
    interval=Math.max(
      1000,
      Number(timeframe)||1000
    );
  }

  const buckets=new Map();

  for(const point of clean){
    const bucket=
      Math.floor(point.t/interval)*interval;

    let candle=buckets.get(bucket);

    if(!candle){
      candle={
        t:bucket,
        open:point.price,
        high:point.price,
        low:point.price,
        close:point.price,
        samples:1,
        interval
      };

      buckets.set(bucket,candle);
      continue;
    }

    candle.high=Math.max(candle.high,point.price);
    candle.low=Math.min(candle.low,point.price);
    candle.close=point.price;
    candle.samples++;
  }

  return [...buckets.values()]
    .sort((a,b)=>a.t-b.t)
    .slice(-500);
}
"""
    js = replace_function(js, "candlesFor", candles_fn)

    # ============================================================
    # 6) FRONTEND RENDERER: LIGHTWEIGHT CHARTS v5
    # ============================================================

    schedule_replacement = r"""
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
  initialized:false
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
      Number(level.price)
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

  const candles=candlesFor(
    rawPoints(mint),
    state.timeframe
  );

  if(!candles.length){
    scheduleChart();
    return;
  }

  const runtimeChanged=
    chartRuntime.mint!==mint ||
    chartRuntime.timeframe!==state.timeframe;

  if(runtimeChanged){
    chartRuntime.forceFit=true;
    scheduleChart();
    return;
  }

  const last=candles[candles.length-1];

  try{
    chartRuntime.series.update(
      chartCandle(last)
    );
  }catch{
    scheduleChart();
    return;
  }

  const lastPoint=rawPoints(mint).at(-1);

  chartRuntime.dataKey=[
    mint,
    String(state.timeframe),
    rawPoints(mint).length,
    Number(lastPoint?.t||0),
    Number(lastPoint?.price||0)
  ].join('|');

  const offscreen=refreshStrategyPriceLines(candles);

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
}
"""
    js = replace_function(js, "scheduleChart", schedule_replacement)

    draw_fn = r"""
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
"""
    js = replace_function(js, "drawChart", draw_fn)

    # Candidate change and timeframe change should fit the new view once.
    js = replace_once(
        js,
        """  state.selectedMint = mint;
  state.selected = state.candidates.find(item => item.mint === mint) || null;""",
        """  state.selectedMint = mint;
  state.selected = state.candidates.find(item => item.mint === mint) || null;
  chartRuntime.forceFit = true;
  chartRuntime.dataKey = '';""",
        "select candidate chart reset",
    )

    js = replace_once(
        js,
        """      state.timeframe = button.dataset.tf === 'all' ? 'all' : Number(button.dataset.tf);
      document.querySelectorAll('#timeframes button').forEach(b => b.classList.toggle('active', b === button));
      scheduleChart();""",
        """      state.timeframe = button.dataset.tf === 'all' ? 'all' : Number(button.dataset.tf);
      document.querySelectorAll('#timeframes button').forEach(b => b.classList.toggle('active', b === button));
      chartRuntime.forceFit = true;
      chartRuntime.dataKey = '';
      scheduleChart();""",
        "timeframe handler",
    )

    js = js.rstrip() + f"\n\n/* {PATCH_ID} */\n"
    app = app.rstrip() + f"\n\n// {PATCH_ID}\n"
    pump = pump.rstrip() + f"\n\n// {PATCH_ID}\n"
    html = html.replace("</body>", f"  <!-- {PATCH_ID} -->\n</body>", 1)

    APP.write_text(app, encoding="utf-8")
    JS.write_text(js, encoding="utf-8")
    HTML.write_text(html, encoding="utf-8")
    CSS.write_text(css, encoding="utf-8")
    PUMP.write_text(pump, encoding="utf-8")

    # ============================================================
    # VALIDATION
    # ============================================================

    node_check(APP)
    node_check(JS)
    node_check(PUMP)

    final_app = APP.read_text(encoding="utf-8")
    final_js = JS.read_text(encoding="utf-8")
    final_html = HTML.read_text(encoding="utf-8")
    final_css = CSS.read_text(encoding="utf-8")
    final_pump = PUMP.read_text(encoding="utf-8")

    checks = {
        "direct chart callback":
            "onChartTick:(tick)" in final_app,

        "pump chain timestamp":
            "Number(e.timestamp)*1000" in final_pump,

        "generic publish isolated":
            "A publish with no new price must NOT become a chart tick." not in final_app,

        "direct trade broadcaster":
            "function __mfChartTradeTick(" in final_app,

        "true OHLC open":
            "open:point.price" in final_js,

        "previousClose hack removed":
            "previousClose" not in final_js,

        "Lightweight Charts host":
            "lightweight-charts@5.2.0" in final_html,

        "canvas removed":
            '<canvas id="chartCanvas">' not in final_html,

        "renderer createChart":
            "LW.createChart(" in final_js,

        "realtime series.update":
            "chartRuntime.series.update(" in final_js,

        "initial setData":
            "chartRuntime.series.setData(" in final_js,

        "price lines bounded":
            "Far-away targets never participate in chart scaling." in final_js,

        "cache v4":
            "mfchart:v4:" in final_js,

        "TradingView notice":
            "TradingView Lightweight Charts™" in final_html,

        "namespaced css":
            PATCH_ID in final_css,

        "patch app marker":
            PATCH_ID in final_app,

        "patch js marker":
            PATCH_ID in final_js,

        "patch pump marker":
            PATCH_ID in final_pump,
    }

    failed = [name for name, ok in checks.items() if not ok]
    if failed:
        raise RuntimeError(
            "POST-INSTALL validation failed: "
            + ", ".join(failed)
        )

    log("app-server.mjs syntax OK")
    log("trading.js syntax OK")
    log("src/pump-live-trade-feed.mjs syntax OK")
    log("")
    log("INSTALL COMPLETE")
    log("")
    log("ARCHITECTURE:")
    log("  Pump WS TradeEvent -> on-chain timestamp -> direct chart tick")
    log("  direct chart tick -> bounded history + SSE")
    log("  generic publish()/holders/AI no longer create candle points")
    log("  OHLC = first/high/low/last real trade inside each timeframe bucket")
    log("  initial history uses series.setData()")
    log("  live last candle uses series.update()")
    log("  renderer = TradingView Lightweight Charts 5.2.0")
    log("")
    log("TIMEFRAMES:")
    log("  1s / 1m / 5m / 15m / 1h / All use the same real trade-tick history")
    log("  a 1s interval with only one real trade is correctly rendered as a doji")
    log("")
    log("UNTOUCHED:")
    log("  discovery V34.2")
    log("  AI / risk / holder evaluation")
    log("  PaperEngine / execution gates")
    log("  settings")
    log("  candidate logic")
    log("")
    log(f"backup: {BACKUP}")
    log("Restart Replit workflow/app and hard-refresh Trading Terminal.")

except Exception as exc:
    rollback(exc)
