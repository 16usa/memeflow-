#!/usr/bin/env python3
from __future__ import annotations

import shutil
import subprocess
import sys
import time
from pathlib import Path

PATCH_ID = "MEMEFLOW_TRADING_CHART_V30_3_1"
STAMP = time.strftime("%Y%m%d-%H%M%S")

def log(msg):
    print(f"[CHART-V30.3.1] {msg}", flush=True)

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
        if (p / "app-server.mjs").is_file() and (p / "trading.js").is_file():
            return p
    raise RuntimeError("MEMEFLOW root with app-server.mjs + trading.js not found")

ROOT = locate()
APP = ROOT / "app-server.mjs"
TRADING = ROOT / "trading.js"

BACKUP = ROOT / f".trading-chart-v30-3-1-backup-{STAMP}"
BACKUP.mkdir(parents=True, exist_ok=True)

original = {}

def remember(path):
    text = path.read_text(encoding="utf-8")
    original[path] = text
    shutil.copy2(path, BACKUP / path.name)
    return text

def rollback(reason):
    log(f"ERROR: {reason}")
    for path, text in original.items():
        path.write_text(text, encoding="utf-8")
    log("ROLLBACK COMPLETE")
    sys.exit(1)

def node_check(path):
    p = subprocess.run(
        ["node", "--check", str(path)],
        cwd=ROOT,
        capture_output=True,
        text=True,
    )
    if p.returncode:
        raise RuntimeError(
            f"{path.name} syntax error:\n{p.stderr or p.stdout}"
        )

def find_function(text, name, start_at=0):
    marker = f"function {name}("
    start = text.find(marker, start_at)
    if start < 0:
        raise RuntimeError(f"function {name}() not found")

    # Include a directly preceding `async ` in the replacement range.
    # Otherwise replacing `async function foo()` would leave the old
    # async keyword in place and create `async async function foo()`.
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

def replace_function(text, name, replacement):
    start, end = find_function(text, name)
    return text[:start] + replacement.strip() + text[end:]

try:
    log(f"root: {ROOT}")

    app = remember(APP)
    js = remember(TRADING)

    if PATCH_ID in app or PATCH_ID in js:
        log("already installed")
        sys.exit(0)

    required_app = [
        "MEMEFLOW_TRADING_CHART_V30_2",
        "function __mfChartRecord(",
        "function __mfChartSnapshot(",
        "function publish(mint)",
        "if(url.pathname==='/api/chart/stream')",
        "startPumpLiveTradeFeed",
    ]

    required_js = [
        "MEMEFLOW_TRADING_CHART_V30_2",
        "function loadCandidates()",
        "function rawPoints(mint)",
        "function addPoint(mint, t, price",
        "function connectChartStream(mint)",
        "function candlesFor(points, timeframe)",
        "function drawChart()",
    ]

    missing = [x for x in required_app if x not in app]
    missing += [x for x in required_js if x not in js]

    if missing:
        raise RuntimeError(
            "PRE-FLIGHT refused unknown/non-V30.2 topology: "
            + ", ".join(missing)
        )

    log("PRE-FLIGHT OK")
    log("verified exact fresh V30.2 Trading Terminal topology")
    log("verified real Pump WS TradeEvent feed already drives token price + publish")

    # ------------------------------------------------------------------
    # SERVER 1: chart history must keep every distinct accepted price tick.
    #
    # V30.2 throttled to ~2 ticks/sec. That destroys real intrasecond trade
    # structure before the 1-second OHLC builder even sees it.
    #
    # We intentionally dedupe ONLY an identical (timestamp,price) sample.
    # Non-price publish calls reuse lastPriceAt and are therefore rejected.
    # ------------------------------------------------------------------
    chart_record_fn = r"""
function __mfChartRecord(mint,price,at=Date.now(),source=null){
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
      lastSeenAt:ts
    };
    __mfChartHistory.set(mint,row);
  }

  row.lastSeenAt=Math.max(
    Number(row.lastSeenAt||0),
    ts
  );

  const last=
    row.points[row.points.length-1];

  // Exact duplicate = same canonical price observation.
  // Do not throttle distinct TradeEvents: 1s OHLC needs all of them.
  if(
    last &&
    Number(last.t)===ts &&
    Number(last.price)===p
  ){
    return false;
  }

  row.points.push({
    t:ts,
    price:p,
    source:source||null
  });

  if(row.points.length>__MF_CHART_MAX_POINTS){
    row.points.splice(
      0,
      row.points.length-__MF_CHART_MAX_POINTS
    );
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
}
"""
    app = replace_function(
        app,
        "__mfChartRecord",
        chart_record_fn,
    )

    # ------------------------------------------------------------------
    # SERVER 2: publish only a REAL new chart point.
    #
    # V30.2 emitted Date.now() on every publish, so holder/evaluation updates
    # became fake price ticks. Use canonical lastPriceAt, and only emit when
    # __mfChartRecord() says this observation is new.
    # ------------------------------------------------------------------
    publish_fn = r"""
function publish(mint){
  // V31 System View: actual server publish cadence drives the 3D impulse.
  try{
    const __v31t=
      store?.state?.tokens?.[mint]||{};

    __systemViewEmitV31(
      'token',
      {
        mint:String(mint||''),
        updatedAt:Number(
          __v31t?.updatedAt||
          Date.now()
        )
      }
    );
  }catch{}

  // Game remains on the exact same authoritative token updates.
  try{
    pepeGame.onTokenUpdate(
      mint,
      store.state.tokens[mint]
    );
  }catch(_){}

  const t=
    store.state?.tokens?.[mint]||
    null;

  let chartPoint=null;

  if(t?.priceSol){
    const chartAt=
      Number(t.lastPriceAt)||
      Number(t.updatedAt)||
      Date.now();

    const chartSource=
      t.marketSource||
      t.priceSource||
      t.source||
      'Solana';

    const added=
      __mfChartRecord(
        mint,
        t.priceSol,
        chartAt,
        chartSource
      );

    if(added){
      chartPoint={
        t:chartAt,
        price:Number(t.priceSol),
        source:chartSource
      };
    }
  }

  const listeners=
    streams.get(mint);

  // A publish with no new price must NOT become a chart tick.
  if(
    !chartPoint ||
    !listeners ||
    listeners.size===0
  ){
    return;
  }

  const payload=
    `event: update\n`+
    `data: ${JSON.stringify({
      point:chartPoint,
      status:{
        stale:false,
        error:t?.scanError||null,
        source:chartPoint.source
      }
    })}\n\n`;

  for(const res of listeners){
    try{
      res.write(payload);
    }catch{}
  }
}
"""
    app = replace_function(
        app,
        "publish",
        publish_fn,
    )

    # ------------------------------------------------------------------
    # FRONTEND 1: no client-side candidate seed.
    #
    # V30.2 inserted Date.now() before EventSource snapshot. Historical server
    # points then looked "older" and addPoint discarded them. Server snapshot
    # already supplies a fallback point from canonical token.priceSol.
    # ------------------------------------------------------------------
    load_candidates_fn = r"""
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
"""
    js = replace_function(
        js,
        "loadCandidates",
        load_candidates_fn,
    )

    # ------------------------------------------------------------------
    # FRONTEND 2: clean V30.3 cache and exact duplicate handling.
    # ------------------------------------------------------------------
    raw_points_fn = r"""
function rawPoints(mint) {
  if (!state.rawByMint.has(mint)) {
    let points = [];

    try {
      // New cache namespace: V30.2 contained fake publish ticks and the
      // premature candidate seed, so none of it is reused.
      const saved = JSON.parse(
        sessionStorage.getItem(
          `mfchart:v3:${mint}`
        ) || '[]'
      );

      if (Array.isArray(saved)) {
        points = saved
          .filter(
            p =>
              finite(p?.t) &&
              finite(p?.price) &&
              Number(p.price) > 0
          )
          .map(p => ({
            t:Number(p.t),
            price:Number(p.price),
            source:p.source||null
          }))
          .sort((a,b)=>a.t-b.t)
          .slice(-1800);
      }
    } catch {}

    state.rawByMint.set(
      mint,
      points
    );
  }

  return state.rawByMint.get(mint);
}
"""
    js = replace_function(
        js,
        "rawPoints",
        raw_points_fn,
    )

    add_point_fn = r"""
function addPoint(mint, t, price, source = 'live') {
  if (
    !mint ||
    !(num(price) > 0)
  ){
    return;
  }

  const points =
    rawPoints(mint);

  const ts =
    num(t,Date.now());

  const p =
    num(price);

  if(
    !(ts > 0) ||
    !(p > 0)
  ){
    return;
  }

  // Snapshot can contain older rows than session cache. Merge it; do not
  // reject history merely because the browser already has a newer point.
  const duplicate =
    points.some(
      point =>
        Number(point.t)===ts &&
        Number(point.price)===p
    );

  if(duplicate)return;

  points.push({
    t:ts,
    price:p,
    source:source||null
  });

  points.sort(
    (a,b)=>a.t-b.t
  );

  if(points.length>2200){
    points.splice(
      0,
      points.length-2200
    );
  }

  try{
    sessionStorage.setItem(
      `mfchart:v3:${mint}`,
      JSON.stringify(
        points.slice(-1800)
      )
    );
  }catch{}

  scheduleChart();
}
"""
    js = replace_function(
        js,
        "addPoint",
        add_point_fn,
    )

    # ------------------------------------------------------------------
    # FRONTEND 3: real mark-price candle aggregation.
    #
    # Pump WS TradeEvent gives a reserve-derived MARK price after each trade.
    # Between updates the mark price remains at previous close. Therefore the
    # correct interval open for this sampled state series is previous close.
    # This creates normal bodies without inventing random OHLC values.
    # ------------------------------------------------------------------
    candles_fn = r"""
function candlesFor(points, timeframe) {
  const clean =
    (Array.isArray(points) ? points : [])
      .filter(
        point =>
          finite(point?.t) &&
          finite(point?.price) &&
          Number(point.price) > 0
      )
      .map(point => ({
        t:Number(point.t),
        price:Number(point.price)
      }))
      .sort((a,b)=>a.t-b.t);

  if(!clean.length)return [];

  let interval;

  if(timeframe==='all'){
    const span =
      Math.max(
        1,
        clean[clean.length-1].t-
        clean[0].t
      );

    interval =
      Math.max(
        1000,
        Math.ceil(span/100)
      );
  }else{
    interval =
      Math.max(
        1000,
        Number(timeframe)||1000
      );
  }

  const buckets =
    new Map();

  for(const point of clean){
    const bucket =
      Math.floor(
        point.t/interval
      )*interval;

    let row =
      buckets.get(bucket);

    if(!row){
      row={
        t:bucket,
        ticks:[],
        interval
      };

      buckets.set(
        bucket,
        row
      );
    }

    row.ticks.push(
      point.price
    );
  }

  const ordered =
    [...buckets.values()]
      .sort((a,b)=>a.t-b.t)
      .slice(-160);

  const candles=[];
  let previousClose=null;

  for(const row of ordered){
    const ticks =
      row.ticks.filter(
        value =>
          Number.isFinite(value) &&
          value>0
      );

    if(!ticks.length)continue;

    // This is a continuous mark-price series. At interval start the mark
    // remains the previous observed close until the first new trade update.
    const open =
      previousClose>0
        ? previousClose
        : ticks[0];

    const close =
      ticks[ticks.length-1];

    const high =
      Math.max(
        open,
        ...ticks
      );

    const low =
      Math.min(
        open,
        ...ticks
      );

    candles.push({
      t:row.t,
      open,
      high,
      low,
      close,
      samples:ticks.length,
      interval:row.interval
    });

    previousClose=close;
  }

  return candles;
}
"""
    js = replace_function(
        js,
        "candlesFor",
        candles_fn,
    )

    # ------------------------------------------------------------------
    # FRONTEND 4: time-correct X axis + non-overlapping top overlays.
    # ------------------------------------------------------------------
    draw_fn = r"""
function drawChart() {
  const canvas =
    $('chartCanvas');

  const rect =
    canvas.getBoundingClientRect();

  const dpr =
    Math.min(
      window.devicePixelRatio||1,
      2
    );

  const width =
    Math.max(
      1,
      Math.round(rect.width*dpr)
    );

  const height =
    Math.max(
      1,
      Math.round(rect.height*dpr)
    );

  if(
    canvas.width!==width ||
    canvas.height!==height
  ){
    canvas.width=width;
    canvas.height=height;
  }

  const ctx =
    canvas.getContext('2d');

  ctx.setTransform(
    dpr,0,0,dpr,0,0
  );

  const W=rect.width;
  const H=rect.height;

  ctx.clearRect(
    0,0,W,H
  );

  if(!state.selectedMint){
    $('chartEmpty').style.display='grid';
    $('chartLegend').innerHTML='';
    return;
  }

  const points =
    rawPoints(
      state.selectedMint
    );

  const candles =
    candlesFor(
      points,
      state.timeframe
    );

  const levels =
    strategyLevels();

  if(!candles.length){
    $('chartEmpty').style.display='grid';
    $('chartLegend').innerHTML='';
    return;
  }

  $('chartEmpty').style.display='none';

  // Reserve the first ~42 px for the HTML OHLC legend.
  // Strategy labels begin below it and can no longer overlap the legend.
  const pad={
    left:10,
    right:82,
    top:48,
    bottom:30
  };

  const candleValues =
    candles.flatMap(
      candle => [
        candle.high,
        candle.low
      ]
    );

  let min =
    Math.min(...candleValues);

  let max =
    Math.max(...candleValues);

  const reference =
    candles[candles.length-1]?.close||
    max||
    1;

  if(!(max>min)){
    const spread =
      Math.max(
        Math.abs(reference)*.012,
        1e-14
      );

    min=reference-spread;
    max=reference+spread;
  }

  const naturalSpan=max-min;

  const minUsefulSpan =
    Math.max(
      Math.abs(reference)*.006,
      1e-14
    );

  if(naturalSpan<minUsefulSpan){
    const mid=(max+min)/2;
    min=mid-minUsefulSpan/2;
    max=mid+minUsefulSpan/2;
  }

  const extra =
    Math.max(
      (max-min)*.10,
      Math.abs(reference)*.001
    );

  min=Math.max(
    0,
    min-extra
  );

  max+=extra;

  const plotW =
    Math.max(
      10,
      W-pad.left-pad.right
    );

  const plotH =
    Math.max(
      10,
      H-pad.top-pad.bottom
    );

  const y = price =>
    pad.top+
    (max-price)/
    Math.max(max-min,1e-20)*
    plotH;

  // X is real time, not candle index.
  const interval =
    Number(
      candles[0]?.interval
    )||1000;

  const firstT =
    candles[0].t;

  const lastT =
    candles[candles.length-1].t;

  const xSpan =
    Math.max(
      interval,
      lastT-firstT+interval
    );

  const x = t =>
    pad.left+
    ((t-firstT)/xSpan)*
    plotW;

  const intervalPx =
    plotW*
    interval/
    xSpan;

  const bodyW =
    Math.max(
      3,
      Math.min(
        13,
        intervalPx*.66
      )
    );

  ctx.font =
    '8px ui-monospace, SFMono-Regular, monospace';

  ctx.textBaseline='middle';

  // Grid + Y labels.
  for(let i=0;i<=5;i++){
    const yy =
      pad.top+
      plotH*i/5;

    const price =
      max-
      (max-min)*i/5;

    ctx.strokeStyle =
      'rgba(106,145,162,.09)';

    ctx.lineWidth=1;
    ctx.beginPath();
    ctx.moveTo(
      pad.left,
      yy
    );
    ctx.lineTo(
      W-pad.right,
      yy
    );
    ctx.stroke();

    ctx.fillStyle='#536f7b';

    ctx.fillText(
      formatPrice(price),
      W-pad.right+7,
      yy
    );
  }

  // Time axis uses actual elapsed time.
  const timeValues=[
    firstT,
    firstT+xSpan/2,
    firstT+xSpan
  ];

  ctx.fillStyle='#405b67';
  ctx.textBaseline='bottom';

  for(const value of timeValues){
    const xx=x(value);

    const stamp =
      new Date(value)
        .toLocaleTimeString(
          [],
          {
            hour:'2-digit',
            minute:'2-digit',
            second:
              Number(state.timeframe)<=1000
                ? '2-digit'
                : undefined
          }
        );

    const metrics =
      ctx.measureText(stamp);

    const tx =
      Math.max(
        pad.left,
        Math.min(
          W-pad.right-metrics.width,
          xx-metrics.width/2
        )
      );

    ctx.fillText(
      stamp,
      tx,
      H-4
    );
  }

  ctx.textBaseline='middle';

  // Candles: real time position; mark-price open carries previous close.
  candles.forEach(candle=>{
    const xx =
      x(candle.t+interval/2);

    const up =
      candle.close>=candle.open;

    const color =
      up
        ? '#4de6a1'
        : '#ff6679';

    const highY=y(candle.high);
    const lowY=y(candle.low);
    const openY=y(candle.open);
    const closeY=y(candle.close);

    ctx.strokeStyle=color;
    ctx.globalAlpha=.82;
    ctx.lineWidth=1.2;

    ctx.beginPath();
    ctx.moveTo(xx,highY);
    ctx.lineTo(xx,lowY);
    ctx.stroke();

    const top =
      Math.min(
        openY,
        closeY
      );

    const rawBodyH =
      Math.abs(
        closeY-openY
      );

    // A true unchanged mark remains a doji; changed marks get a real body.
    if(rawBodyH<1){
      ctx.globalAlpha=.95;
      ctx.strokeStyle=color;
      ctx.lineWidth=1.5;
      ctx.beginPath();
      ctx.moveTo(
        xx-bodyW/2,
        closeY
      );
      ctx.lineTo(
        xx+bodyW/2,
        closeY
      );
      ctx.stroke();
    }else{
      ctx.globalAlpha=.92;
      ctx.fillStyle=color;
      ctx.fillRect(
        xx-bodyW/2,
        top,
        bodyW,
        Math.max(2,rawBodyH)
      );
    }
  });

  ctx.globalAlpha=1;

  // Strategy levels are informational overlays only.
  // They never participate in autoscale.
  let topLabelOffset=0;
  let bottomLabelOffset=0;

  for(const level of levels){
    if(!(level?.price>0))continue;

    const color =
      level.kind==='stop'
        ? '#ff6679'
        : level.kind==='entry'
          ? '#55d9ff'
          : level.kind==='tp'
            ? '#4de6a1'
            : '#a98bff';

    const inside =
      level.price>=min &&
      level.price<=max;

    if(inside){
      const yy=y(level.price);

      ctx.strokeStyle=color;
      ctx.globalAlpha=.42;
      ctx.setLineDash([5,5]);
      ctx.beginPath();
      ctx.moveTo(
        pad.left,
        yy
      );
      ctx.lineTo(
        W-pad.right,
        yy
      );
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.globalAlpha=.9;
      ctx.fillStyle=color;

      ctx.fillText(
        level.label,
        pad.left+6,
        Math.max(
          pad.top+8,
          Math.min(
            pad.top+plotH-8,
            yy-8
          )
        )
      );
    }else{
      const above =
        level.price>max;

      const yy =
        above
          ? pad.top+8+topLabelOffset
          : pad.top+plotH-8-bottomLabelOffset;

      ctx.globalAlpha=.80;
      ctx.fillStyle=color;

      ctx.fillText(
        `${above?'↑':'↓'} ${level.label}`,
        pad.left+6,
        yy
      );

      if(above){
        topLabelOffset+=12;
      }else{
        bottomLabelOffset+=12;
      }
    }
  }

  ctx.globalAlpha=1;

  const last =
    candles[candles.length-1];

  const totalTicks =
    candles.reduce(
      (sum,candle)=>
        sum+Number(candle.samples||0),
      0
    );

  $('chartLegend').innerHTML=`
    <span>O ${formatPrice(last.open)}</span>
    <span>H ${formatPrice(last.high)}</span>
    <span>L ${formatPrice(last.low)}</span>
    <span>C ${formatPrice(last.close)}</span>
    <span>${candles.length} candles · ${totalTicks} ticks</span>
  `;
}
"""
    js = replace_function(
        js,
        "drawChart",
        draw_fn,
    )

    app = app.rstrip() + f"\n\n// {PATCH_ID}\n"
    js = js.rstrip() + f"\n\n/* {PATCH_ID} */\n"

    APP.write_text(app,encoding="utf-8")
    TRADING.write_text(js,encoding="utf-8")

    node_check(APP)
    node_check(TRADING)

    final_app=APP.read_text(encoding="utf-8")
    final_js=TRADING.read_text(encoding="utf-8")

    validations={
        "V30.2 present":
            "MEMEFLOW_TRADING_CHART_V30_2" in final_app,

        "server uses canonical lastPriceAt":
            "const chartAt=" in final_app
            and "Number(t.lastPriceAt)" in final_app,

        "fake publish Date.now point removed":
            "point:t?.priceSol?{" not in final_app,

        "server only emits added chart points":
            "if(added){" in final_app
            and "!chartPoint ||" in final_app,

        "candidate seed removed":
            "'candidate-seed'" not in final_js,

        "new clean cache":
            "mfchart:v3:" in final_js,

        "history backfill allowed":
            "points.some(" in final_js,

        "continuous mark candle":
            "previousClose>0" in final_js,

        "time based x":
            "const x = t =>" in final_js,

        "legend tick diagnostic":
            "candles · ${totalTicks} ticks" in final_js,

        "V30.3.1 app marker":
            PATCH_ID in final_app,

        "V30.3.1 js marker":
            PATCH_ID in final_js,
    }

    bad=[
        name
        for name,ok in validations.items()
        if not ok
    ]

    if bad:
        raise RuntimeError(
            "POST-INSTALL validation failed: "
            + ", ".join(bad)
        )

    log("app-server.mjs syntax OK")
    log("trading.js syntax OK")
    log("")
    log("INSTALL COMPLETE")
    log("")
    log("ROOT CAUSES FIXED:")
    log("  removed premature client candidate-price seed")
    log("  server snapshot history can now backfill the browser")
    log("  holder/evaluation publish calls no longer create fake price ticks")
    log("  SSE uses canonical token.lastPriceAt instead of arbitrary Date.now()")
    log("  V30.2 500ms chart throttle removed; distinct real TradeEvents are preserved")
    log("  1s OHLC is built as continuous Pump mark-price candles")
    log("  X positions now represent real elapsed time")
    log("  OHLC legend and TP/SL edge labels no longer overlap")
    log("  chart legend shows candle count + underlying tick count for verification")
    log("")
    log("UNTOUCHED:")
    log("  discovery V34.2")
    log("  Pump TradeEvent decoder")
    log("  AI / risk / holder logic")
    log("  PaperEngine / live execution gates")
    log("  settings")
    log("  trading.css / trading.html")
    log("")
    log(f"backup: {BACKUP}")
    log("Restart the Replit workflow/app, hard-refresh Trading Terminal, then leave 1s open for ~20 seconds.")

except Exception as exc:
    rollback(exc)
