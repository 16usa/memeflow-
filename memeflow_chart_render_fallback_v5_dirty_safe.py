#!/usr/bin/env python3
from pathlib import Path
import datetime
import re
import shutil
import subprocess
import sys

TAG="MEMEFLOW_CHART_RENDER_FALLBACK_V5_DIRTY_SAFE"
FALLBACK="\nfunction __mfDrawChartFallback(error){\n  try{\n    console.error('[MEMEFLOW_CHART_RENDER_FALLBACK_V5]',error);\n\n    if(!ensureChartEngine()) return;\n\n    if(!state.selectedMint){\n      chartRuntime.api?.clear?.();\n      $('chartEmpty').style.display='grid';\n      $('chartEmpty').innerHTML=\n        '<strong>Live candles</strong>'+\n        '<span>Select a token to load its chart.</span>';\n      $('chartLegend').innerHTML='';\n      return;\n    }\n\n    const points=rawPoints(state.selectedMint);\n    const candles=candlesFor(points,state.timeframe);\n\n    if(!candles.length){\n      chartRuntime.api?.clear?.();\n      $('chartEmpty').style.display='grid';\n      $('chartEmpty').innerHTML=\n        '<strong>Syncing real trades</strong>'+\n        '<span>No valid BUY / SELL candles are available for this token yet.</span>';\n      $('chartLegend').innerHTML='';\n      return;\n    }\n\n    $('chartEmpty').style.display='none';\n\n    const labels=candles.map(c=>String(Number(c.t)));\n    const data=candles.map(c=>[\n      Number(c.open),\n      Number(c.close),\n      Number(c.low),\n      Number(c.high)\n    ]);\n\n    const visibleBars=window.innerWidth<700 ? 48 : 84;\n    const startValue=\n      state.timeframe==='all'\n        ? labels[0]\n        : labels[Math.max(0,labels.length-visibleBars)];\n    const endValue=labels[labels.length-1];\n\n    chartRuntime.api.clear();\n    chartRuntime.api.setOption(\n      {\n        animation:false,\n        backgroundColor:'transparent',\n        grid:{left:8,right:68,top:18,bottom:28,containLabel:false},\n        xAxis:{\n          type:'category',\n          data:labels,\n          boundaryGap:true,\n          axisLine:{show:true,lineStyle:{color:'rgba(111,154,172,.15)'}},\n          axisTick:{show:false},\n          axisLabel:{show:true,color:'#536f7b',fontSize:8,hideOverlap:true},\n          splitLine:{show:false}\n        },\n        yAxis:{\n          type:'value',\n          position:'right',\n          scale:true,\n          axisLine:{show:false},\n          axisTick:{show:false},\n          axisLabel:{show:true,color:'#536f7b',fontSize:9},\n          splitLine:{\n            show:true,\n            lineStyle:{color:'rgba(106,145,162,.07)',width:1}\n          }\n        },\n        dataZoom:[\n          {\n            type:'inside',\n            xAxisIndex:0,\n            filterMode:'filter',\n            startValue,\n            endValue,\n            zoomOnMouseWheel:true,\n            moveOnMouseMove:true,\n            moveOnMouseWheel:true,\n            throttle:32\n          }\n        ],\n        series:[\n          {\n            name:'Price',\n            type:'candlestick',\n            data,\n            barWidth:'72%',\n            itemStyle:{\n              color:'#4de6a1',\n              color0:'#ff6679',\n              borderColor:'#4de6a1',\n              borderColor0:'#ff6679',\n              borderWidth:1\n            },\n            emphasis:{disabled:true}\n          }\n        ]\n      },\n      {notMerge:true,lazyUpdate:false}\n    );\n\n    chartRuntime.labels=labels;\n    chartRuntime.lastCandles=candles;\n    chartRuntime.mint=state.selectedMint;\n    chartRuntime.timeframe=state.timeframe;\n    chartRuntime.metric=state.chartMetric;\n    chartRuntime.candleCount=candles.length;\n    chartRuntime.lastCandleTime=candles[candles.length-1]?.t||null;\n    chartRuntime.forceFit=false;\n\n    try{chartRuntime.api.resize()}catch{}\n\n    const last=candles[candles.length-1];\n    $('chartLegend').innerHTML=\n      '<span>Fallback renderer · '+candles.length+' candles</span>'+\n      '<span>O '+Number(last.open).toPrecision(6)+'</span>'+\n      '<span>H '+Number(last.high).toPrecision(6)+'</span>'+\n      '<span>L '+Number(last.low).toPrecision(6)+'</span>'+\n      '<span>C '+Number(last.close).toPrecision(6)+'</span>';\n\n  }catch(fallbackError){\n    console.error('[MEMEFLOW_CHART_RENDER_FALLBACK_V5_FATAL]',fallbackError);\n    try{\n      $('chartEmpty').style.display='grid';\n      $('chartEmpty').innerHTML=\n        '<strong>Chart render error</strong>'+\n        '<span>The price history loaded, but the browser renderer failed.</span>';\n    }catch{}\n  }\n}\n\nfunction drawChart(){\n  try{\n    const result=__mfDrawChartAdvanced();\n    requestAnimationFrame(()=>{\n      try{chartRuntime.api?.resize?.()}catch{}\n    });\n    return result;\n  }catch(error){\n    return __mfDrawChartFallback(error);\n  }\n}\n"

def log(msg):
    print(f"[{TAG}] {msg}",flush=True)

def run(*args,cwd=None,check=True):
    p=subprocess.run(args,cwd=cwd,text=True,stdout=subprocess.PIPE,stderr=subprocess.STDOUT)
    if p.stdout:
        print(p.stdout,end="" if p.stdout.endswith("\n") else "\n")
    if check and p.returncode!=0:
        raise RuntimeError("command failed: "+" ".join(args))
    return p

def find_app():
    cwd=Path.cwd().resolve()
    for p in [
        cwd/"memeflow-app", cwd,
        Path.home()/"workspace"/"memeflow-app",
        Path("/home/runner/workspace/memeflow-app")
    ]:
        if (p/"trading.js").is_file() and (p/"trading.html").is_file():
            return p.resolve()
    raise RuntimeError("memeflow-app not found")

def scan_block_end(text,brace):
    i=brace
    depth=0
    quote=None
    escape=False
    line_comment=False
    block_comment=False
    while i<len(text):
        ch=text[i]
        nxt=text[i+1] if i+1<len(text) else ""
        if line_comment:
            if ch=="\n": line_comment=False
            i+=1; continue
        if block_comment:
            if ch=="*" and nxt=="/":
                block_comment=False; i+=2; continue
            i+=1; continue
        if quote:
            if escape: escape=False
            elif ch=="\\": escape=True
            elif ch==quote: quote=None
            i+=1; continue
        if ch=="/" and nxt=="/":
            line_comment=True; i+=2; continue
        if ch=="/" and nxt=="*":
            block_comment=True; i+=2; continue
        if ch in ("'",'"',"`"):
            quote=ch; i+=1; continue
        if ch=="{":
            depth+=1
        elif ch=="}":
            depth-=1
            if depth==0: return i+1
        i+=1
    raise RuntimeError("closing brace not found")

def extract_function(text,name):
    m=re.search(r"\bfunction\s+"+re.escape(name)+r"\s*\(",text)
    if not m:
        raise RuntimeError("function not found: "+name)
    brace=text.find("{",m.end())
    if brace<0:
        raise RuntimeError("opening brace missing: "+name)
    end=scan_block_end(text,brace)
    return m.start(),end,text[m.start():end]

def main():
    app=find_app()
    js_path=app/"trading.js"
    html_path=app/"trading.html"
    repo=app.parent if (app.parent/".git").exists() else app

    log("app: "+str(app))
    original_js=js_path.read_text(encoding="utf-8")
    original_html=html_path.read_text(encoding="utf-8")

    for needle in (
        "function drawChart()",
        "function ensureChartEngine()",
        "chartRuntime.api.setOption(",
        "function candlesFor(",
        "function rawPoints("
    ):
        if needle not in original_js:
            raise RuntimeError("trading.js missing expected chart anchor: "+needle)
    if 'id="chartCanvas"' not in original_html:
        raise RuntimeError("trading.html missing chartCanvas")

    if TAG in original_js:
        log("patch already installed; verification only")
        patched_js=original_js
        patched_html=original_html
    else:
        stamp=datetime.datetime.now().strftime("%Y%m%d-%H%M%S")
        backup=app/".patch-backups"/("chart-render-v5-"+stamp)
        backup.mkdir(parents=True,exist_ok=True)
        shutil.copy2(js_path,backup/"trading.js")
        shutil.copy2(html_path,backup/"trading.html")
        log("backup: "+str(backup))

        if (repo/".git").exists():
            rels=[str(js_path.relative_to(repo)),str(html_path.relative_to(repo))]
            (backup/"git-status-before.txt").write_text(
                run("git","status","--short","--",*rels,cwd=repo,check=False).stdout or "",
                encoding="utf-8"
            )
            (backup/"git-diff-before.patch").write_text(
                run("git","diff","--",*rels,cwd=repo,check=False).stdout or "",
                encoding="utf-8"
            )

        patched_js=original_js
        start,end,draw_src=extract_function(patched_js,"drawChart")
        advanced=draw_src.replace(
            "function drawChart()",
            "function __mfDrawChartAdvanced()",
            1
        )
        replacement=advanced+"\n\n"+FALLBACK+"\n\n/* "+TAG+" */"
        patched_js=patched_js[:start]+replacement+patched_js[end:]

        old_init="""  chartRuntime.initialized=true;

  const EC=window.echarts;"""
        if old_init in patched_js:
            patched_js=patched_js.replace(
                old_init,
                "  const EC=window.echarts;",
                1
            )

        old_ec="""  chartRuntime.api=EC.init(
    host,
    null,
    {
      renderer:'canvas',
      useDirtyRect:true
    }
  );"""
        new_ec="""  try{
    chartRuntime.api=EC.init(
      host,
      null,
      {
        renderer:'canvas',
        useDirtyRect:true
      }
    );
    chartRuntime.initialized=true;
  }catch(error){
    chartRuntime.api=null;
    chartRuntime.initialized=false;
    console.error('[MEMEFLOW_ECHARTS_INIT_V5]',error);
    $('chartEmpty').style.display='grid';
    $('chartEmpty').innerHTML=
      '<strong>Chart renderer unavailable</strong>'+
      '<span>ECharts initialization failed in this browser.</span>';
    return false;
  }"""
        if old_ec in patched_js:
            patched_js=patched_js.replace(old_ec,new_ec,1)
        else:
            log("WARNING: EC.init block differs; safe draw wrapper still installed")

        patched_html,count=re.subn(
            r'src="/trading\.js(?:\?[^"]*)?"',
            'src="/trading.js?v=chart-render-fallback-v5-20260829"',
            original_html,
            count=1
        )
        if count!=1:
            raise RuntimeError("expected exactly one trading.js script reference")

        js_path.write_text(patched_js,encoding="utf-8")
        html_path.write_text(patched_html,encoding="utf-8")

    try:
        final_js=js_path.read_text(encoding="utf-8")
        final_html=html_path.read_text(encoding="utf-8")
        checks={
            "advanced renderer preserved":
                "function __mfDrawChartAdvanced()" in final_js,
            "safe draw wrapper":
                "function drawChart()" in final_js and
                "__mfDrawChartFallback(error)" in final_js,
            "fallback candlestick":
                "Fallback renderer" in final_js and
                "barWidth:'72%'" in final_js,
            "post-layout Safari resize":
                "chartRuntime.api?.resize?.()" in final_js,
            "ECharts init retry safe":
                "chartRuntime.initialized=false;" in final_js,
            "Safari cache bust":
                "/trading.js?v=chart-render-fallback-v5-20260829" in final_html,
            "indicator engine preserved":
                "function chartLowerIndicatorPane" in final_js,
        }
        for name,ok in checks.items():
            log(("OK: " if ok else "FAIL: ")+name)
            if not ok:
                raise RuntimeError("verification failed: "+name)

        run("node","--check",str(js_path),cwd=app)

    except Exception:
        if 'backup' in locals():
            shutil.copy2(backup/"trading.js",js_path)
            shutil.copy2(backup/"trading.html",html_path)
            log("FAILED: trading.js/html restored from backup")
        raise

    if (repo/".git").exists():
        rels=[str(js_path.relative_to(repo)),str(html_path.relative_to(repo))]
        log("DIRTY-SAFE: no git add / commit / push performed")
        run("git","status","--short","--",*rels,cwd=repo,check=False)

    log("FIX COMPLETE")
    log("Restart Replit app/workflow and hard-refresh Safari.")
    log("Advanced chart remains primary; fallback renders candles only if the advanced ECharts path throws.")
    return 0

if __name__=="__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(f"[{TAG}] FATAL: {exc}",file=sys.stderr)
        raise
