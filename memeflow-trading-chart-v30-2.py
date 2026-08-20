#!/usr/bin/env python3
from __future__ import annotations

import shutil
import subprocess
import sys
import time
from pathlib import Path

PATCH_ID = "MEMEFLOW_TRADING_CHART_V30_2"
STAMP = time.strftime("%Y%m%d-%H%M%S")

def log(msg):
    print(f"[CHART-V30.2] {msg}", flush=True)

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

BACKUP = ROOT / f".trading-chart-v30-2-backup-{STAMP}"
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

def find_function(text, name):
    marker = f"function {name}("
    start = text.find(marker)
    if start < 0:
        raise RuntimeError(f"function {name}() not found")

    brace = text.find("{", start)
    if brace < 0:
        raise RuntimeError(f"function {name}() opening brace not found")

    depth = 0
    quote = None
    escape = False
    template_depth = 0

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

    # ------------------------------------------------------------
    # PRE-FLIGHT
    # ------------------------------------------------------------
    app_required = [
        "const streams=new Map(),priceTimers=new Map(),tradeWindows=new Map();",
        "function publish(mint)",
        "if(url.pathname==='/api/chart/stream')",
        "if(url.pathname==='/api/live/execute')",
    ]
    js_required = [
        "function loadCandidates()",
        "function rawPoints(mint)",
        "function addPoint(mint, t, price)",
        "function connectChartStream(mint)",
        "function candlesFor(points, timeframe)",
        "function drawChart()",
        "function formatPrice(price)",
        "setInterval(poll, 1800)",
    ]

    missing = [x for x in app_required if x not in app]
    missing += [x for x in js_required if x not in js]
    if missing:
        raise RuntimeError(
            "PRE-FLIGHT refused unknown chart topology: " + ", ".join(missing)
        )

    log("PRE-FLIGHT OK")
    log("verified Trading Terminal canvas + SSE chart + polling feed")
    log("verified server chart stream route + publish hot path")

    # ------------------------------------------------------------
    # SERVER: bounded real price history.
    #
    # This is intentionally isolated from trading/discovery logic:
    # it only observes accepted store price updates.
    # ------------------------------------------------------------
    streams_anchor = "const streams=new Map(),priceTimers=new Map(),tradeWindows=new Map();"

    history_helpers = r"""
const streams=new Map(),priceTimers=new Map(),tradeWindows=new Map();

// MEMEFLOW_TRADING_CHART_V30_2
// Small bounded chart cache. It never decides trades and never writes token state.
const __mfChartHistory=new Map();
const __MF_CHART_MAX_MINTS=Math.max(
  40,
  Math.min(300,Number(process.env.CHART_HISTORY_MAX_MINTS||180))
);
const __MF_CHART_MAX_POINTS=Math.max(
  240,
  Math.min(2400,Number(process.env.CHART_HISTORY_MAX_POINTS||1500))
);
const __MF_CHART_MIN_GAP_MS=Math.max(
  100,
  Math.min(1000,Number(process.env.CHART_HISTORY_MIN_GAP_MS||500))
);

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

  row.lastSeenAt=ts;

  const last=row.points[row.points.length-1];

  if(last){
    const gap=ts-last.t;
    const move=
      last.price>0
        ? Math.abs(p-last.price)/last.price
        : 1;

    // Normal updates: at most ~2 points/sec.
    // Large moves are preserved immediately so a real fast move is not hidden.
    if(
      gap>=0 &&
      gap<__MF_CHART_MIN_GAP_MS &&
      move<0.025
    ){
      return false;
    }

    if(
      gap>=0 &&
      gap<80 &&
      p===last.price
    ){
      return false;
    }
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

  // Global cap: evict the least recently updated token histories.
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

function __mfChartSnapshot(mint){
  const token=store.state?.tokens?.[mint]||null;

  if(token?.priceSol){
    __mfChartRecord(
      mint,
      token.priceSol,
      Number(token.lastPriceAt)||Date.now(),
      token.marketSource||
      token.priceSource||
      token.source||
      null
    );
  }

  const points=
    (__mfChartHistory.get(mint)?.points||[])
      .slice(-__MF_CHART_MAX_POINTS);

  return {
    points,
    status:{
      stale:points.length===0,
      source:
        token?.marketSource||
        token?.priceSource||
        token?.source||
        'Solana',
      historyPoints:points.length
    }
  };
}
""".strip()

    app = app.replace(streams_anchor, history_helpers, 1)

    # Record every accepted published price BEFORE the old "no listeners" fast return.
    listener_anchor = "  const listeners=streams.get(mint);"
    if app.count(listener_anchor) != 1:
        raise RuntimeError(
            f"publish listener anchor expected once, found {app.count(listener_anchor)}"
        )

    record_hook = r"""  const __mfChartToken=store.state?.tokens?.[mint]||null;

  if(__mfChartToken?.priceSol){
    __mfChartRecord(
      mint,
      __mfChartToken.priceSol,
      Number(__mfChartToken.lastPriceAt)||Date.now(),
      __mfChartToken.marketSource||
      __mfChartToken.priceSource||
      __mfChartToken.source||
      null
    );
  }

  const listeners=streams.get(mint);"""

    app = app.replace(listener_anchor, record_hook, 1)

    # Replace chart stream endpoint as one isolated route block.
    route_start = app.find(" if(url.pathname==='/api/chart/stream')")
    route_end = app.find(" if(url.pathname==='/api/live/execute')", route_start)

    if route_start < 0 or route_end < 0:
        raise RuntimeError("chart stream route boundaries not found")

    new_route = r""" if(url.pathname==='/api/chart/stream'){
   const mint=String(
     url.searchParams.get('tokenAddress')||''
   ).trim();

   if(!mint){
     return json(res,400,{
       error:'TOKEN_REQUIRED',
       message:'tokenAddress is required.'
     });
   }

   res.writeHead(200,{
     'content-type':'text/event-stream; charset=utf-8',
     'cache-control':'no-cache, no-transform',
     'connection':'keep-alive',
     'x-accel-buffering':'no'
   });

   res.flushHeaders?.();

   const snapshot=__mfChartSnapshot(mint);

   res.write(
     `event: snapshot\n`+
     `data: ${JSON.stringify(snapshot)}\n\n`
   );

   if(!streams.has(mint)){
     streams.set(mint,new Set());
   }

   streams.get(mint).add(res);

   const heartbeat=setInterval(()=>{
     try{
       res.write(`: mf-chart-heartbeat ${Date.now()}\n\n`);
     }catch{}
   },15000);

   heartbeat.unref?.();

   req.on('close',()=>{
     clearInterval(heartbeat);

     const set=streams.get(mint);

     set?.delete(res);

     if(set && set.size===0){
       streams.delete(mint);
     }
   });

   return;
 }
"""

    app = app[:route_start] + new_route + app[route_end:]

    # ------------------------------------------------------------
    # FRONTEND
    # ------------------------------------------------------------

    # Candidate feed must NOT continuously inject stale prices into live candles.
    old_candidate_point = """      const price = candidatePrice(current);
      if (price > 0) addPoint(state.selectedMint, Date.now(), price);"""

    new_candidate_point = """      const price = candidatePrice(current);
      const existingPoints = rawPoints(state.selectedMint);

      // Candidate/decision price is only a one-time fallback seed.
      // Live candles are owned by /api/chart/stream after that.
      if (price > 0 && existingPoints.length === 0) {
        addPoint(
          state.selectedMint,
          Date.now(),
          price,
          'candidate-seed'
        );
      }"""

    if js.count(old_candidate_point) != 1:
        raise RuntimeError(
            "loadCandidates stale-price injection anchor not found exactly once"
        )

    js = js.replace(old_candidate_point, new_candidate_point, 1)

    raw_points_fn = r"""
function rawPoints(mint) {
  if (!state.rawByMint.has(mint)) {
    let points = [];

    try {
      // V30.2 uses a new cache key so old mixed decision/SSE spikes
      // from the previous chart implementation are not reloaded.
      const saved = JSON.parse(
        sessionStorage.getItem(`mfchart:v2:${mint}`) || '[]'
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
          .slice(-1500);
      }
    } catch {}

    state.rawByMint.set(mint, points);
  }

  return state.rawByMint.get(mint);
}
"""

    add_point_fn = r"""
function addPoint(mint, t, price, source = 'live') {
  if (!mint || !(num(price) > 0)) return;

  const points = rawPoints(mint);
  const ts = num(t, Date.now());
  const p = num(price);

  if (!(ts > 0) || !(p > 0)) return;

  const last = points[points.length - 1];

  if (last) {
    // Do not let a late/replayed SSE frame move chart time backwards.
    if (ts < last.t - 1000) return;

    if (
      Math.abs(last.t - ts) < 250 &&
      last.price === p
    ) {
      return;
    }
  }

  points.push({
    t:ts,
    price:p,
    source:source||null
  });

  points.sort((a,b)=>a.t-b.t);

  if (points.length > 1800) {
    points.splice(0, points.length - 1800);
  }

  try {
    sessionStorage.setItem(
      `mfchart:v2:${mint}`,
      JSON.stringify(points.slice(-1200))
    );
  } catch {}

  scheduleChart();
}
"""

    connect_fn = r"""
function connectChartStream(mint) {
  if (state.chartSource) {
    state.chartSource.close();
    state.chartSource = null;
  }

  if (!mint || !window.EventSource) return;

  const source = new EventSource(
    `/api/chart/stream?tokenAddress=${encodeURIComponent(mint)}`
  );

  source.__mint = mint;

  const handler = event => {
    try {
      const payload = JSON.parse(event.data || '{}');
      const incoming = [];

      if (payload.point) incoming.push(payload.point);
      if (Array.isArray(payload.points)) incoming.push(...payload.points);

      incoming
        .filter(
          point =>
            finite(point?.t) &&
            finite(point?.price) &&
            Number(point.price) > 0
        )
        .sort(
          (a,b)=>
            Number(a.t)-
            Number(b.t)
        )
        .forEach(point => {
          addPoint(
            mint,
            point.t || Date.now(),
            point.price,
            point.source || payload?.status?.source || 'live'
          );
        });

      if (payload?.status?.stale === false || incoming.length) {
        $('feedState').textContent = 'LIVE';
      }
    } catch {}
  };

  source.addEventListener('snapshot', handler);
  source.addEventListener('update', handler);

  source.onerror = () => {
    $('feedState').textContent = 'RECONNECTING';
  };

  source.onopen = () => {
    $('feedState').textContent = 'LIVE';
  };

  state.chartSource = source;
}
"""

    candles_fn = r"""
function candlesFor(points, timeframe) {
  const clean = (Array.isArray(points) ? points : [])
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

  if (!clean.length) return [];

  let interval;

  if (timeframe === 'all') {
    const span = Math.max(
      1,
      clean[clean.length - 1].t - clean[0].t
    );

    // Keep All readable rather than generating hundreds of hairline bars.
    interval = Math.max(
      1000,
      Math.ceil(span / 100)
    );
  } else {
    interval = Math.max(
      1000,
      Number(timeframe) || 1000
    );
  }

  const buckets = new Map();

  for (const point of clean) {
    const bucket =
      Math.floor(point.t / interval) * interval;

    let candle = buckets.get(bucket);

    if (!candle) {
      candle = {
        t:bucket,
        open:point.price,
        high:point.price,
        low:point.price,
        close:point.price,
        samples:1
      };

      buckets.set(bucket,candle);
    } else {
      candle.high = Math.max(candle.high,point.price);
      candle.low = Math.min(candle.low,point.price);
      candle.close = point.price;
      candle.samples++;
    }
  }

  return [...buckets.values()]
    .sort((a,b)=>a.t-b.t)
    .slice(-160);
}
"""

    draw_fn = r"""
function drawChart() {
  const canvas = $('chartCanvas');
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.min(
    window.devicePixelRatio || 1,
    2
  );

  const width = Math.max(
    1,
    Math.round(rect.width * dpr)
  );

  const height = Math.max(
    1,
    Math.round(rect.height * dpr)
  );

  if (
    canvas.width !== width ||
    canvas.height !== height
  ) {
    canvas.width = width;
    canvas.height = height;
  }

  const ctx = canvas.getContext('2d');

  ctx.setTransform(
    dpr,
    0,
    0,
    dpr,
    0,
    0
  );

  const W = rect.width;
  const H = rect.height;

  ctx.clearRect(0,0,W,H);

  if (!state.selectedMint) {
    $('chartEmpty').style.display = 'grid';
    $('chartLegend').innerHTML = '';
    return;
  }

  const points = rawPoints(state.selectedMint);
  const candles = candlesFor(
    points,
    state.timeframe
  );
  const levels = strategyLevels();

  if (!candles.length) {
    $('chartEmpty').style.display = 'grid';
    $('chartLegend').innerHTML = '';
    return;
  }

  $('chartEmpty').style.display = 'none';

  const pad = {
    left:10,
    right:82,
    top:18,
    bottom:28
  };

  // IMPORTANT:
  // only actual market candles determine the Y scale.
  // SL/TP levels must never crush live price action.
  const candleValues =
    candles.flatMap(
      candle => [
        candle.high,
        candle.low
      ]
    );

  let min = Math.min(...candleValues);
  let max = Math.max(...candleValues);

  const reference =
    candles[candles.length - 1]?.close ||
    max ||
    1;

  if (!(max > min)) {
    const spread = Math.max(
      Math.abs(reference) * .012,
      1e-14
    );

    min = reference - spread;
    max = reference + spread;
  }

  // Do not allow a nearly flat few-tick chart to become visually absurd.
  const naturalSpan = max - min;
  const minUsefulSpan = Math.max(
    Math.abs(reference) * .006,
    1e-14
  );

  if (naturalSpan < minUsefulSpan) {
    const mid = (max + min) / 2;
    min = mid - minUsefulSpan / 2;
    max = mid + minUsefulSpan / 2;
  }

  const extra = Math.max(
    (max - min) * .12,
    Math.abs(reference) * .001
  );

  min = Math.max(
    0,
    min - extra
  );
  max += extra;

  const plotW = Math.max(
    10,
    W - pad.left - pad.right
  );

  const plotH = Math.max(
    10,
    H - pad.top - pad.bottom
  );

  const y = price =>
    pad.top +
    (max - price) /
    Math.max(max - min,1e-20) *
    plotH;

  const xStep =
    plotW /
    Math.max(candles.length,1);

  const bodyW = Math.max(
    2,
    Math.min(
      12,
      xStep * .60
    )
  );

  ctx.font =
    '8px ui-monospace, SFMono-Regular, monospace';

  ctx.textBaseline = 'middle';

  // Grid + Y-axis
  for (let i = 0; i <= 5; i++) {
    const yy =
      pad.top +
      plotH * i / 5;

    const price =
      max -
      (max - min) * i / 5;

    ctx.strokeStyle =
      'rgba(106,145,162,.09)';

    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(pad.left,yy);
    ctx.lineTo(W-pad.right,yy);
    ctx.stroke();

    ctx.fillStyle = '#536f7b';

    ctx.fillText(
      formatPrice(price),
      W-pad.right+7,
      yy
    );
  }

  // A small time axis makes sparse 1s candles understandable.
  const timeIndices = [...new Set([
    0,
    Math.floor((candles.length-1)/2),
    candles.length-1
  ])];

  ctx.fillStyle = '#405b67';
  ctx.textBaseline = 'bottom';

  for (const idx of timeIndices) {
    const candle = candles[idx];

    if (!candle) continue;

    const xx =
      pad.left +
      xStep * (idx + .5);

    const stamp =
      new Date(candle.t)
        .toLocaleTimeString(
          [],
          {
            hour:'2-digit',
            minute:'2-digit',
            second:
              Number(state.timeframe) <= 1000
                ? '2-digit'
                : undefined
          }
        );

    const metrics =
      ctx.measureText(stamp);

    const tx = Math.max(
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

  ctx.textBaseline = 'middle';

  // Candles
  candles.forEach((candle,i)=>{
    const xx =
      pad.left +
      xStep * (i + .5);

    const up =
      candle.close >= candle.open;

    const color =
      up
        ? '#4de6a1'
        : '#ff6679';

    const highY = y(candle.high);
    const lowY = y(candle.low);
    const openY = y(candle.open);
    const closeY = y(candle.close);

    ctx.strokeStyle = color;
    ctx.globalAlpha = .76;
    ctx.lineWidth = 1;

    ctx.beginPath();
    ctx.moveTo(xx,highY);
    ctx.lineTo(xx,lowY);
    ctx.stroke();

    ctx.globalAlpha = .9;
    ctx.fillStyle = color;

    const top =
      Math.min(openY,closeY);

    const bodyH = Math.max(
      2,
      Math.abs(closeY-openY)
    );

    ctx.fillRect(
      xx-bodyW/2,
      top,
      bodyW,
      bodyH
    );
  });

  ctx.globalAlpha = 1;

  // Strategy levels are informational overlays.
  // Off-screen levels get an edge label instead of stretching the chart.
  let topLabelOffset = 0;
  let bottomLabelOffset = 0;

  for (const level of levels) {
    if (!(level?.price > 0)) continue;

    const color =
      level.kind === 'stop'
        ? '#ff6679'
        : level.kind === 'entry'
          ? '#55d9ff'
          : level.kind === 'tp'
            ? '#4de6a1'
            : '#a98bff';

    const inside =
      level.price >= min &&
      level.price <= max;

    if (inside) {
      const yy = y(level.price);

      ctx.strokeStyle = color;
      ctx.globalAlpha = .44;
      ctx.setLineDash([5,5]);
      ctx.beginPath();
      ctx.moveTo(pad.left,yy);
      ctx.lineTo(W-pad.right,yy);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.globalAlpha = .9;
      ctx.fillStyle = color;

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
    } else {
      const above =
        level.price > max;

      const yy =
        above
          ? pad.top + 8 + topLabelOffset
          : pad.top + plotH - 8 - bottomLabelOffset;

      ctx.globalAlpha = .78;
      ctx.fillStyle = color;

      ctx.fillText(
        `${above ? '↑' : '↓'} ${level.label}`,
        pad.left+6,
        yy
      );

      if (above) {
        topLabelOffset += 12;
      } else {
        bottomLabelOffset += 12;
      }
    }
  }

  ctx.globalAlpha = 1;

  const last =
    candles[candles.length - 1];

  $('chartLegend').innerHTML = `
    <span>O ${formatPrice(last.open)}</span>
    <span>H ${formatPrice(last.high)}</span>
    <span>L ${formatPrice(last.low)}</span>
    <span>C ${formatPrice(last.close)}</span>
    <span>${candles.length} candles</span>
  `;
}
"""

    format_fn = r"""
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
"""

    js = replace_function(js, "rawPoints", raw_points_fn)
    js = replace_function(js, "addPoint", add_point_fn)
    js = replace_function(js, "connectChartStream", connect_fn)
    js = replace_function(js, "candlesFor", candles_fn)
    js = replace_function(js, "drawChart", draw_fn)
    js = replace_function(js, "formatPrice", format_fn)

    js = js.rstrip() + f"\n\n/* {PATCH_ID} */\n"
    app = app.rstrip() + f"\n\n// {PATCH_ID}\n"

    APP.write_text(app, encoding="utf-8")
    TRADING.write_text(js, encoding="utf-8")

    # ------------------------------------------------------------
    # VALIDATION
    # ------------------------------------------------------------
    node_check(APP)
    node_check(TRADING)

    final_app = APP.read_text(encoding="utf-8")
    final_js = TRADING.read_text(encoding="utf-8")

    validations = {
        "server history cache":
            "__mfChartHistory" in final_app,

        "server snapshot history":
            "const snapshot=__mfChartSnapshot(mint);" in final_app,

        "SSE heartbeat":
            "mf-chart-heartbeat" in final_app,

        "stale candidate injection removed":
            "if (price > 0) addPoint(state.selectedMint, Date.now(), price);" not in final_js,

        "new chart cache key":
            "mfchart:v2:" in final_js,

        "candle-only autoscale":
            "only actual market candles determine the Y scale" in final_js,

        "offscreen strategy labels":
            "Off-screen levels get an edge label" in final_js,

        "smart tiny price formatter":
            "Math.log10(Math.abs(p))" in final_js,

        "patch marker server":
            PATCH_ID in final_app,

        "patch marker frontend":
            PATCH_ID in final_js,
    }

    bad = [
        name
        for name, ok
        in validations.items()
        if not ok
    ]

    if bad:
        raise RuntimeError(
            "post-install validation failed: "
            + ", ".join(bad)
        )

    log("app-server.mjs syntax OK")
    log("trading.js syntax OK")
    log("")
    log("INSTALL COMPLETE")
    log("")
    log("FIXES:")
    log("  chart snapshot now includes bounded real server price history")
    log("  stale 1.8s candidate polling no longer contaminates live candles")
    log("  old polluted session chart cache is ignored")
    log("  EventSource has heartbeat + no-buffer headers")
    log("  1s candles aggregate actual live SSE price points")
    log("  TP/SL levels no longer control Y autoscale")
    log("  off-screen TP/SL levels remain visible as edge labels")
    log("  tiny token prices no longer use scientific notation")
    log("  chart now has simple time-axis labels")
    log("")
    log("UNTOUCHED:")
    log("  discovery V34.2")
    log("  AI/Risk evaluation")
    log("  paper/live execution logic")
    log("  settings")
    log("  trading.css / visual layout")
    log("")
    log(f"backup: {BACKUP}")
    log("Restart the Replit workflow/app, then reload Trading Terminal.")

except Exception as exc:
    rollback(exc)
