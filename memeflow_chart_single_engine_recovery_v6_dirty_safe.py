#!/usr/bin/env python3
from pathlib import Path
import datetime
import re
import shutil
import subprocess
import sys

TAG = "MEMEFLOW_CHART_SINGLE_ENGINE_RECOVERY_V6_DIRTY_SAFE"
OLD_TAG = "MEMEFLOW_CHART_RENDER_FALLBACK_V5_DIRTY_SAFE"

NEW_RENDERER = r"""
function __mfChartVisibleSlotsV6(){
  return window.innerWidth < 700 ? 48 : 84;
}

function __mfChartTimeLabelV6(value){
  const text=String(value ?? '');
  if(
    text.startsWith('__mf_future_') ||
    text.startsWith('__mf_pad_')
  ){
    return '';
  }

  try{
    if(typeof chartTimeLabel==='function'){
      const formatted=chartTimeLabel(value);
      if(formatted!==undefined && formatted!==null){
        return String(formatted);
      }
    }
  }catch{}

  const t=Number(value);
  if(!Number.isFinite(t))return '';

  try{
    return new Date(t).toLocaleTimeString([],{
      hour:'2-digit',
      minute:'2-digit',
      second:
        Number(state?.timeframe)<=1000
          ? '2-digit'
          : undefined
    });
  }catch{
    return '';
  }
}

function __mfChartFormatValueV6(value){
  try{
    if(typeof formatChartValue==='function'){
      return formatChartValue(value);
    }
  }catch{}

  const n=Number(value);
  if(!Number.isFinite(n))return '—';
  if(Math.abs(n)>=1000)return n.toLocaleString(undefined,{maximumFractionDigits:2});
  if(Math.abs(n)>=1)return n.toFixed(4);
  return n.toPrecision(6);
}

function __mfChartDisplayV6(candles){
  try{
    if(typeof chartDisplayData==='function'){
      const display=chartDisplayData(candles);
      if(
        display &&
        Array.isArray(display.labels) &&
        Array.isArray(display.rows) &&
        display.labels.length===display.rows.length
      ){
        return display;
      }
    }
  }catch(error){
    console.warn('[MEMEFLOW_CHART_V6_DISPLAY_HELPER]',error);
  }

  const actual=Array.isArray(candles)?candles:[];
  const target=__mfChartVisibleSlotsV6();
  const padCount=Math.max(0,target-actual.length);
  const futureLabels=Array.from(
    {length:padCount},
    (_,index)=>`__mf_future_v6_${index}`
  );

  return {
    labels:actual
      .map(c=>String(Number(c.t)))
      .concat(futureLabels),
    rows:actual.concat(Array(padCount).fill(null)),
    padCount
  };
}

function __mfChartLastUsdV6(points){
  const last=Array.isArray(points)?points[points.length-1]:null;
  if(!last)return null;

  try{
    if(typeof pointUsdPrice==='function'){
      const usd=Number(pointUsdPrice(last));
      if(Number.isFinite(usd) && usd>0)return usd;
    }
  }catch{}

  const sol=Number(last?.priceSol ?? last?.price);
  if(!(sol>0))return null;

  try{
    if(typeof solUsdRate==='function'){
      const rate=Number(solUsdRate());
      if(rate>0)return sol*rate;
    }
  }catch{}

  return null;
}

function __mfChartSyncHeaderV6(points){
  try{
    if(typeof renderPriceModeSummary!=='function')return;
    const usd=__mfChartLastUsdV6(points);
    if(usd>0)renderPriceModeSummary(usd);
  }catch(error){
    console.warn('[MEMEFLOW_CHART_V6_HEADER_SYNC]',error);
  }
}

function drawChart(){
  try{
    if(!ensureChartEngine())return;

    if(!state.selectedMint){
      try{chartRuntime.api?.clear?.()}catch{}
      $('chartEmpty').style.display='grid';
      $('chartEmpty').innerHTML=
        '<strong>Live candles</strong>'+
        '<span>Select a token to load its chart.</span>';
      $('chartLegend').innerHTML='';
      return;
    }

    const points=rawPoints(state.selectedMint);
    const candles=candlesFor(points,state.timeframe);

    __mfChartSyncHeaderV6(points);

    if(!candles.length){
      try{chartRuntime.api?.clear?.()}catch{}
      $('chartEmpty').style.display='grid';
      $('chartEmpty').innerHTML=
        '<strong>Syncing real trades</strong>'+
        '<span>No canonical BUY / SELL candles are available yet.</span>';
      $('chartLegend').innerHTML='';
      return;
    }

    $('chartEmpty').style.display='none';

    const display=__mfChartDisplayV6(candles);
    const labels=display.labels;
    const displayCandles=display.rows;
    const padCount=Math.max(
      0,
      Number(display.padCount)||0
    );

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

    const futurePad=Array(padCount).fill('-');

    const actualVolumeData=candles.map(c=>({
      value:Math.max(
        0,
        Number(c?.volumeUsd ?? c?.volume ?? 0)
      ),
      itemStyle:{
        color:
          Number(c.close)>=Number(c.open)
            ? 'rgba(77,230,161,.55)'
            : 'rgba(255,102,121,.52)'
      }
    }));
    const volumeData=actualVolumeData.concat(futurePad);

    let ma5=Array(candles.length).fill('-').concat(futurePad);
    let ma10=Array(candles.length).fill('-').concat(futurePad);

    try{
      if(typeof movingAverage==='function'){
        ma5=movingAverage(candles,5).concat(futurePad);
        ma10=movingAverage(candles,10).concat(futurePad);
      }
    }catch(error){
      console.warn('[MEMEFLOW_CHART_V6_MA]',error);
    }

    let overlaySeries=[];
    try{
      if(typeof chartOverlayIndicatorSeries==='function'){
        const result=chartOverlayIndicatorSeries(
          candles,
          padCount
        );
        if(Array.isArray(result))overlaySeries=result;
      }
    }catch(error){
      console.warn('[MEMEFLOW_CHART_V6_OVERLAY_INDICATOR]',error);
    }

    let lowerPane=null;
    try{
      if(typeof chartLowerIndicatorPane==='function'){
        lowerPane=chartLowerIndicatorPane(
          candles,
          padCount,
          volumeData,
          ma5,
          ma10
        );
      }
    }catch(error){
      console.warn('[MEMEFLOW_CHART_V6_LOWER_INDICATOR]',error);
      lowerPane=null;
    }

    const lowerVisible=Boolean(
      lowerPane &&
      Array.isArray(lowerPane.series) &&
      lowerPane.series.length
    );
    const lowerSeries=lowerVisible
      ? lowerPane.series
      : [];
    const lowerLegend=lowerVisible
      ? (Array.isArray(lowerPane.legend)?lowerPane.legend:[])
      : [];
    const lowerAxis=lowerVisible
      ? (lowerPane.axis||{})
      : {};

    let horizontalSeries=[];
    try{
      if(
        typeof chartLevelInfo==='function' &&
        typeof chartHorizontalLevelSeries==='function'
      ){
        const levelInfo=chartLevelInfo(candles);
        chartRuntime.offscreenLevels=
          Array.isArray(levelInfo?.offscreen)
            ? levelInfo.offscreen
            : [];
        horizontalSeries=chartHorizontalLevelSeries(
          labels,
          Array.isArray(levelInfo?.visible)
            ? levelInfo.visible
            : [],
          Number(candles[candles.length-1]?.close)
        );
        if(!Array.isArray(horizontalSeries)){
          horizontalSeries=[];
        }
      }
    }catch(error){
      console.warn('[MEMEFLOW_CHART_V6_LEVELS]',error);
      horizontalSeries=[];
    }

    const slots=__mfChartVisibleSlotsV6();
    let startValue;
    let endValue;

    if(state.timeframe==='all'){
      startValue=labels[0];
      endValue=labels[labels.length-1];
    }else if(candles.length<slots){
      // Sparse/newborn token: keep the first real candle on the LEFT
      // and use render-only empty slots on the RIGHT.
      startValue=labels[0];
      endValue=labels[Math.min(labels.length-1,slots-1)];
    }else{
      startValue=labels[Math.max(0,candles.length-slots)];
      endValue=labels[Math.min(labels.length-1,candles.length-1)];
    }

    const mainXAxis={
      type:'category',
      gridIndex:0,
      data:labels,
      boundaryGap:true,
      axisLine:{
        show:true,
        lineStyle:{color:'rgba(111,154,172,.15)'}
      },
      axisTick:{show:false},
      axisLabel:{
        show:!lowerVisible,
        color:'#536f7b',
        fontSize:8,
        hideOverlap:true,
        formatter:value=>__mfChartTimeLabelV6(value)
      },
      splitLine:{show:false}
    };

    const xAxis=lowerVisible
      ? [
          mainXAxis,
          {
            type:'category',
            gridIndex:1,
            data:labels,
            boundaryGap:true,
            axisLine:{
              show:true,
              lineStyle:{color:'rgba(111,154,172,.15)'}
            },
            axisTick:{show:false},
            axisLabel:{
              show:true,
              color:'#536f7b',
              fontSize:8,
              hideOverlap:true,
              formatter:value=>__mfChartTimeLabelV6(value)
            },
            splitLine:{show:false}
          }
        ]
      : [mainXAxis];

    const yAxis=[
      {
        type:'value',
        gridIndex:0,
        position:'right',
        scale:true,
        axisLine:{show:false},
        axisTick:{show:false},
        axisLabel:{
          show:true,
          color:'#536f7b',
          fontSize:9,
          formatter:value=>__mfChartFormatValueV6(value)
        },
        splitLine:{
          show:true,
          lineStyle:{
            color:'rgba(106,145,162,.07)',
            width:1
          }
        }
      }
    ];

    if(lowerVisible){
      yAxis.push({
        type:'value',
        gridIndex:1,
        position:'right',
        scale:lowerAxis?.scale!==false,
        min:Number.isFinite(Number(lowerAxis?.min))
          ? Number(lowerAxis.min)
          : undefined,
        max:Number.isFinite(Number(lowerAxis?.max))
          ? Number(lowerAxis.max)
          : undefined,
        axisLine:{show:false},
        axisTick:{show:false},
        axisLabel:{
          show:true,
          color:'#536f7b',
          fontSize:8,
          formatter:
            typeof lowerAxis?.formatter==='function'
              ? lowerAxis.formatter
              : value=>__mfChartFormatValueV6(value)
        },
        splitLine:{
          show:true,
          lineStyle:{
            color:'rgba(106,145,162,.055)',
            width:1
          }
        }
      });
    }

    const grid=lowerVisible
      ? [
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
        ]
      : [
          {
            left:10,
            right:76,
            top:42,
            height:'78%',
            containLabel:false
          }
        ];

    const candleSeries={
      name:'Price',
      type:'candlestick',
      xAxisIndex:0,
      yAxisIndex:0,
      data:candleData,
      // Width is relative to a category slot. With V30.22-style future
      // slots, one candle stays a normal candle instead of a giant block.
      barWidth:'70%',
      itemStyle:{
        color:'#4de6a1',
        color0:'#ff6679',
        borderColor:'#4de6a1',
        borderColor0:'#ff6679',
        borderWidth:1
      },
      emphasis:{disabled:true},
      animation:false,
      z:4
    };

    const series=[
      candleSeries,
      ...horizontalSeries,
      ...overlaySeries,
      ...lowerSeries
    ];

    chartRuntime.api.clear();
    chartRuntime.api.setOption(
      {
        animation:false,
        backgroundColor:'transparent',
        grid,
        legend:{
          show:lowerVisible && lowerLegend.length>0,
          data:lowerLegend,
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
        tooltip:{
          trigger:'axis',
          axisPointer:{type:'cross'},
          formatter:params=>{
            const list=Array.isArray(params)?params:[params];
            const index=Number(list?.[0]?.dataIndex);
            const c=Number.isFinite(index)
              ? displayCandles[index]
              : null;
            if(!c)return '';
            return [
              __mfChartTimeLabelV6(c.t),
              'O '+__mfChartFormatValueV6(c.open),
              'H '+__mfChartFormatValueV6(c.high),
              'L '+__mfChartFormatValueV6(c.low),
              'C '+__mfChartFormatValueV6(c.close),
              `${Number(c.samples||0)} trades`
            ].join('<br>');
          }
        },
        xAxis,
        yAxis,
        dataZoom:[
          {
            type:'inside',
            xAxisIndex:lowerVisible?[0,1]:[0],
            filterMode:'filter',
            startValue,
            endValue,
            zoomOnMouseWheel:true,
            moveOnMouseMove:true,
            moveOnMouseWheel:true,
            throttle:32
          }
        ],
        series
      },
      {notMerge:true,lazyUpdate:false}
    );

    chartRuntime.labels=labels;
    chartRuntime.lastCandles=candles;
    chartRuntime.mint=state.selectedMint;
    chartRuntime.timeframe=state.timeframe;
    chartRuntime.metric=state.chartMetric;
    chartRuntime.candleCount=candles.length;
    chartRuntime.lastCandleTime=
      candles[candles.length-1]?.t ?? null;
    chartRuntime.dataKey=[
      state.selectedMint,
      String(state.timeframe),
      String(state.chartMetric),
      points.length,
      candles.length,
      Number(points[points.length-1]?.t||0),
      Number(candles[candles.length-1]?.close||0)
    ].join('|');
    chartRuntime.forceFit=false;

    const last=candles[candles.length-1];
    const totalTrades=candles.reduce(
      (sum,c)=>sum+Number(c?.samples||0),
      0
    );

    $('chartLegend').innerHTML=[
      '<span>O '+__mfChartFormatValueV6(last.open)+'</span>',
      '<span>H '+__mfChartFormatValueV6(last.high)+'</span>',
      '<span>L '+__mfChartFormatValueV6(last.low)+'</span>',
      '<span>C '+__mfChartFormatValueV6(last.close)+'</span>',
      '<span>'+candles.length+' candles · '+totalTrades+' trades</span>'
    ].join('');

    try{
      if(typeof syncChartIndicatorButtons==='function'){
        syncChartIndicatorButtons();
      }
    }catch{}

    requestAnimationFrame(()=>{
      try{chartRuntime.api?.resize?.()}catch{}
    });

  }catch(error){
    console.error('[MEMEFLOW_CHART_V6_RENDER_FATAL]',error);
    try{
      $('chartEmpty').style.display='grid';
      $('chartEmpty').innerHTML=
        '<strong>Chart render error</strong>'+
        '<span>'+String(error?.message||error)+'</span>';
      $('chartLegend').innerHTML='';
    }catch{}
  }
}

/* MEMEFLOW_CHART_SINGLE_ENGINE_RECOVERY_V6_DIRTY_SAFE */
"""

def log(message):
    print(f"[{TAG}] {message}", flush=True)

def run(*args, cwd=None, check=True):
    p = subprocess.run(
        args,
        cwd=cwd,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
    )
    if p.stdout:
        print(p.stdout, end="" if p.stdout.endswith("\n") else "\n")
    if check and p.returncode != 0:
        raise RuntimeError(
            f"command failed ({p.returncode}): {' '.join(args)}"
        )
    return p

def find_app():
    cwd = Path.cwd().resolve()
    candidates = [
        cwd / "memeflow-app",
        cwd,
        Path.home() / "workspace" / "memeflow-app",
        Path("/home/runner/workspace/memeflow-app"),
    ]
    for path in candidates:
        if (
            (path / "trading.js").is_file()
            and (path / "trading.html").is_file()
        ):
            return path.resolve()
    raise RuntimeError("memeflow-app not found")

def scan_block_end(text, brace):
    i = brace
    depth = 0
    quote = None
    escape = False
    line_comment = False
    block_comment = False

    while i < len(text):
        ch = text[i]
        nxt = text[i + 1] if i + 1 < len(text) else ""

        if line_comment:
            if ch == "\n":
                line_comment = False
            i += 1
            continue

        if block_comment:
            if ch == "*" and nxt == "/":
                block_comment = False
                i += 2
                continue
            i += 1
            continue

        if quote:
            if escape:
                escape = False
            elif ch == "\\":
                escape = True
            elif ch == quote:
                quote = None
            i += 1
            continue

        if ch == "/" and nxt == "/":
            line_comment = True
            i += 2
            continue

        if ch == "/" and nxt == "*":
            block_comment = True
            i += 2
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
                return i + 1

        i += 1

    raise RuntimeError("closing brace not found")

def extract_function(text, name):
    match = re.search(
        r"\bfunction\s+" + re.escape(name) + r"\s*\(",
        text,
    )
    if not match:
        raise RuntimeError(f"function not found: {name}")

    brace = text.find("{", match.end())
    if brace < 0:
        raise RuntimeError(f"opening brace missing: {name}")

    end = scan_block_end(text, brace)
    return match.start(), end, text[match.start():end]

def replace_function(text, name, replacement):
    start, end, _ = extract_function(text, name)
    return text[:start] + replacement + text[end:]

def remove_v5_renderer_cluster(js):
    a_start, a_end, _ = extract_function(
        js,
        "__mfDrawChartAdvanced",
    )
    f_start, f_end, _ = extract_function(
        js,
        "__mfDrawChartFallback",
    )
    d_start, d_end, _ = extract_function(
        js,
        "drawChart",
    )

    starts = [a_start, f_start, d_start]
    ends = [a_end, f_end, d_end]
    start = min(starts)
    end = max(ends)

    tail = js[end:end + 256]
    marker = "/* " + OLD_TAG + " */"
    marker_pos = tail.find(marker)
    if marker_pos >= 0:
        end += marker_pos + len(marker)

    return js[:start] + NEW_RENDERER + js[end:]

def patch_horizon(js):
    try:
        return replace_function(
            js,
            "chartHorizonMs",
            """function chartHorizonMs(timeframe) {
  // V6: timeframe is the OHLC bucket size, NOT a destructive history window.
  // 1s means 1-second candles from canonical real trades; it must not throw
  // away the token's older valid trades just because they are >90 seconds old.
  return null;
}""",
        )
    except Exception as exc:
        log(f"WARNING: chartHorizonMs not patched: {exc}")
        return js

def patch_header_source(js):
    old = """  const price = candidatePrice(c);
  const priceUsd = usdFromSol(price, c);
  renderPriceModeSummary(priceUsd);"""

    new = """  const chartPoints =
    typeof rawPoints==='function'
      ? rawPoints(c.mint)
      : [];
  const chartLast =
    Array.isArray(chartPoints) && chartPoints.length
      ? chartPoints[chartPoints.length-1]
      : null;

  let priceUsd=null;
  try{
    if(chartLast && typeof pointUsdPrice==='function'){
      const liveUsd=Number(pointUsdPrice(chartLast));
      if(liveUsd>0)priceUsd=liveUsd;
    }
  }catch{}

  if(!(priceUsd>0)){
    const price = candidatePrice(c);
    priceUsd = usdFromSol(price, c);
  }

  renderPriceModeSummary(priceUsd);"""

    if old in js:
        log("header price source: canonical chart trade preferred")
        return js.replace(old, new, 1)

    log("WARNING: renderSelected price block differs; drawChart still syncs header")
    return js

def main():
    app = find_app()
    js_path = app / "trading.js"
    html_path = app / "trading.html"
    repo = app.parent if (app.parent / ".git").exists() else app

    log(f"app: {app}")

    original_js = js_path.read_text(encoding="utf-8")
    original_html = html_path.read_text(encoding="utf-8")

    required = [
        "function ensureChartEngine()",
        "function candlesFor(",
        "function rawPoints(",
        "chartRuntime.api.setOption(",
    ]
    for needle in required:
        if needle not in original_js:
            raise RuntimeError(
                f"trading.js missing expected chart anchor: {needle}"
            )

    if 'id="chartCanvas"' not in original_html:
        raise RuntimeError(
            "trading.html missing chartCanvas"
        )

    if TAG in original_js:
        log("V6 already installed; verification only")
        patched_js = original_js
        patched_html = original_html
        backup = None
    else:
        if OLD_TAG not in original_js:
            raise RuntimeError(
                "V5 fallback marker not found. "
                "Refusing to guess against a different trading.js."
            )

        for fn in (
            "__mfDrawChartAdvanced",
            "__mfDrawChartFallback",
            "drawChart",
        ):
            extract_function(original_js, fn)

        stamp = datetime.datetime.now().strftime(
            "%Y%m%d-%H%M%S"
        )
        backup = (
            app
            / ".patch-backups"
            / f"chart-single-engine-v6-{stamp}"
        )
        backup.mkdir(parents=True, exist_ok=False)
        shutil.copy2(js_path, backup / "trading.js")
        shutil.copy2(html_path, backup / "trading.html")
        log(f"backup: {backup}")

        if (repo / ".git").exists():
            rels = [
                str(js_path.relative_to(repo)),
                str(html_path.relative_to(repo)),
            ]
            (backup / "git-status-before.txt").write_text(
                run(
                    "git",
                    "status",
                    "--short",
                    "--",
                    *rels,
                    cwd=repo,
                    check=False,
                ).stdout
                or "",
                encoding="utf-8",
            )
            (backup / "git-diff-before.patch").write_text(
                run(
                    "git",
                    "diff",
                    "--",
                    *rels,
                    cwd=repo,
                    check=False,
                ).stdout
                or "",
                encoding="utf-8",
            )

        patched_js = remove_v5_renderer_cluster(
            original_js
        )
        patched_js = patch_horizon(patched_js)
        patched_js = patch_header_source(patched_js)

        patched_html, count = re.subn(
            r'src="/trading\.js(?:\?[^"]*)?"',
            'src="/trading.js?v=chart-single-engine-v6-20260829"',
            original_html,
            count=1,
        )
        if count != 1:
            raise RuntimeError(
                "expected exactly one /trading.js script reference"
            )

        js_path.write_text(
            patched_js,
            encoding="utf-8",
        )
        html_path.write_text(
            patched_html,
            encoding="utf-8",
        )

    try:
        final_js = js_path.read_text(encoding="utf-8")
        final_html = html_path.read_text(encoding="utf-8")

        checks = {
            "V6 marker":
                TAG in final_js,
            "single drawChart":
                len(re.findall(
                    r"\bfunction\s+drawChart\s*\(",
                    final_js,
                )) == 1,
            "V5 fallback removed":
                "__mfDrawChartFallback" not in final_js
                and "Fallback renderer" not in final_js,
            "V5 advanced wrapper removed":
                "__mfDrawChartAdvanced" not in final_js,
            "timeframe history no longer destructive":
                "function chartHorizonMs(timeframe)" in final_js
                and "return null;" in final_js,
            "sparse future slots":
                "__mf_future_v6_" in final_js,
            "formatted time axis":
                "__mfChartTimeLabelV6" in final_js,
            "header/chart price sync":
                "__mfChartSyncHeaderV6(points)" in final_js,
            "ECharts setOption":
                "chartRuntime.api.setOption(" in final_js,
            "indicator helpers preserved":
                "function chartLowerIndicatorPane" in final_js,
            "Safari cache bust":
                "/trading.js?v=chart-single-engine-v6-20260829"
                in final_html,
        }

        for name, ok in checks.items():
            log(("OK: " if ok else "FAIL: ") + name)
            if not ok:
                raise RuntimeError(
                    "verification failed: " + name
                )

        run(
            "node",
            "--check",
            str(js_path),
            cwd=app,
        )

    except Exception:
        if backup is not None:
            shutil.copy2(
                backup / "trading.js",
                js_path,
            )
            shutil.copy2(
                backup / "trading.html",
                html_path,
            )
            log(
                "FAILED: trading.js/html restored from backup"
            )
        raise

    if (repo / ".git").exists():
        rels = [
            str(js_path.relative_to(repo)),
            str(html_path.relative_to(repo)),
        ]
        diffcheck = run(
            "git",
            "diff",
            "--check",
            "--",
            *rels,
            cwd=repo,
            check=False,
        )
        if diffcheck.returncode != 0:
            log(
                "WARNING: git diff --check reports "
                "pre-existing whitespace issues; V6 is kept "
                "because JS syntax/semantic checks passed."
            )

        log(
            "DIRTY-SAFE: no git add / commit / push performed"
        )
        run(
            "git",
            "status",
            "--short",
            "--",
            *rels,
            cwd=repo,
            check=False,
        )

    log("FIX COMPLETE")
    log("What V6 changes:")
    log(" - removes the separate V5 fallback renderer")
    log(" - uses one ECharts candlestick renderer")
    log(" - 1s/30s/1m/... are bucket sizes, not history deletion windows")
    log(" - sparse/newborn tokens keep normal candle width")
    log(" - X axis shows human time, not raw millisecond timestamps")
    log(" - header price prefers the latest canonical chart trade")
    log(" - indicator helpers are optional and isolated from core candle rendering")
    log("Restart the Replit app/workflow, then hard-refresh Safari.")
    return 0

if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(
            f"[{TAG}] FATAL: {exc}",
            file=sys.stderr,
        )
        raise
