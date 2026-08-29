#!/usr/bin/env python3
from pathlib import Path
import datetime
import re
import shutil
import subprocess
import sys

TAG="MEMEFLOW_CHART_VIEWPORT_LEVELS_V7_3_DIRTY_SAFE"
V6="MEMEFLOW_CHART_SINGLE_ENGINE_RECOVERY_V6_DIRTY_SAFE"
V72="MEMEFLOW_CHART_LEVELS_LIVE_V7_2_1_DIRTY_SAFE"
LEVEL_INFO="\nfunction chartLevelInfo(candles){\n  const levels=\n    typeof strategyLevels==='function'\n      ? strategyLevels()\n      : [];\n\n  if(!candles.length || !levels.length){\n    return {visible:[],offscreen:levels};\n  }\n\n  const basis=\n    state.timeframe==='all'\n      ? candles.slice(-Math.min(180,candles.length))\n      : candles.slice(-Math.min(120,candles.length));\n\n  const values=basis.flatMap(c=>[\n    Number(c.high),\n    Number(c.low)\n  ]).filter(Number.isFinite);\n\n  if(!values.length){\n    return {visible:[],offscreen:levels};\n  }\n\n  const min=Math.min(...values);\n  const max=Math.max(...values);\n  const rawSpan=Math.max(\n    max-min,\n    Math.abs(max||1)*.008\n  );\n\n  const low=Math.max(0,min-rawSpan*.45);\n  const high=max+rawSpan*.45;\n\n  return {\n    visible:levels.filter(level=>{\n      const price=Number(level?.price);\n      return Number.isFinite(price) && price>=low && price<=high;\n    }),\n    offscreen:levels.filter(level=>{\n      const price=Number(level?.price);\n      return !Number.isFinite(price) || price<low || price>high;\n    })\n  };\n}\n"

def log(msg):
    print(f"[{TAG}] {msg}", flush=True)

def run(*args,cwd=None,check=True):
    p=subprocess.run(
        args,cwd=cwd,text=True,
        stdout=subprocess.PIPE,stderr=subprocess.STDOUT
    )
    if p.stdout:
        print(p.stdout,end="" if p.stdout.endswith("\n") else "\n")
    if check and p.returncode!=0:
        raise RuntimeError(
            f"command failed ({p.returncode}): {' '.join(args)}"
        )
    return p

def find_app():
    cwd=Path.cwd().resolve()
    for p in [
        cwd/"memeflow-app",
        cwd,
        Path.home()/"workspace"/"memeflow-app",
        Path("/home/runner/workspace/memeflow-app"),
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
                block_comment=False
                i+=2
                continue
            i+=1; continue
        if quote:
            if escape: escape=False
            elif ch=="\\": escape=True
            elif ch==quote: quote=None
            i+=1; continue
        if ch=="/" and nxt=="/":
            line_comment=True
            i+=2
            continue
        if ch=="/" and nxt=="*":
            block_comment=True
            i+=2
            continue
        if ch in ("'",'"',"`"):
            quote=ch
            i+=1
            continue
        if ch=="{":
            depth+=1
        elif ch=="}":
            depth-=1
            if depth==0:return i+1
        i+=1
    raise RuntimeError("closing brace not found")

def extract_function(text,name):
    m=re.search(r"\bfunction\s+"+re.escape(name)+r"\s*\(",text)
    if not m:
        raise RuntimeError(f"function not found: {name}")
    brace=text.find("{",m.end())
    if brace<0:
        raise RuntimeError(f"opening brace missing: {name}")
    end=scan_block_end(text,brace)
    return m.start(),end,text[m.start():end]

def replace_function(text,name,replacement):
    start,end,_=extract_function(text,name)
    return text[:start]+replacement.strip()+"\n"+text[end:]

def ensure_viewport_runtime(js):
    if "viewport:{" in js and "followLatest:true" in js:
        return js
    for anchor in [
        "  offscreenLevels:[],\n  previewEntrySolByMint:new Map()",
        "  offscreenLevels:[],\n  previewEntrySolByMint:new Map(),",
        "  offscreenLevels:[],",
    ]:
        if anchor in js:
            repl=anchor+""",
  viewport:{
    followLatest:true,
    startValue:null,
    endValue:null
  },
  suppressZoom:false"""
            return js.replace(anchor,repl,1)
    raise RuntimeError("chartRuntime viewport anchor not found")

def ensure_capture_listener(js):
    if "function captureChartViewport()" not in js:
        anchor="function scheduleChart(){"
        pos=js.find(anchor)
        if pos<0:
            raise RuntimeError("scheduleChart anchor missing")
        helper=r"""
function captureChartViewport(){
  if(
    chartRuntime.suppressZoom ||
    !chartRuntime.api ||
    !chartRuntime.labels?.length
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

"""
        js=js[:pos]+helper+js[pos:]

    start,end,fn=extract_function(js,"ensureChartEngine")
    if "captureChartViewport();" not in fn:
        pos=fn.rfind("  return true;")
        if pos<0:
            raise RuntimeError("ensureChartEngine return anchor missing")
        fn=fn[:pos]+r"""  try{
    chartRuntime.api?.off?.('datazoom');
    chartRuntime.api?.on?.('datazoom',()=>{
      captureChartViewport();
    });
  }catch{}

"""+fn[pos:]
        js=js[:start]+fn+js[end:]
    return js

def patch_draw(js):
    start,end,draw=extract_function(js,"drawChart")

    old_levels=r"""    let horizontalSeries=[];
    try{
      const levels=
        typeof strategyLevels==='function'
          ? strategyLevels()
          : [];

      chartRuntime.offscreenLevels=[];

      horizontalSeries=
        typeof chartHorizontalLevelSeries==='function'
          ? chartHorizontalLevelSeries(
              labels,
              levels,
              Number(candles[candles.length-1]?.close)
            )
          : [];

      if(!Array.isArray(horizontalSeries)){
        horizontalSeries=[];
      }
    }catch(error){
      console.warn('[MEMEFLOW_CHART_V7_2_LEVELS]',error);
      horizontalSeries=[];
    }"""

    new_levels=r"""    let levelInfo={visible:[],offscreen:[]};
    try{
      levelInfo=
        typeof chartLevelInfo==='function'
          ? chartLevelInfo(candles)
          : {visible:[],offscreen:[]};

      chartRuntime.offscreenLevels=
        Array.isArray(levelInfo?.offscreen)
          ? levelInfo.offscreen
          : [];
    }catch(error){
      console.warn('[MEMEFLOW_CHART_V7_3_LEVELS]',error);
      levelInfo={visible:[],offscreen:[]};
      chartRuntime.offscreenLevels=[];
    }

    const markLineData=[
      ...(Array.isArray(levelInfo.visible)?levelInfo.visible:[])
        .map(level=>({
          yAxis:Number(level.price),
          name:String(level.label||''),
          lineStyle:{
            color:levelColor(level),
            width:1,
            type:'dashed',
            opacity:.84
          },
          label:{
            show:true,
            position:'end',
            color:levelColor(level),
            backgroundColor:'rgba(5,12,17,.92)',
            borderColor:levelColor(level),
            borderWidth:1,
            borderRadius:3,
            padding:chartTouchUi()?[2,4]:[3,5],
            fontSize:chartTouchUi()?8:9,
            formatter:()=>String(level.label||'')
          }
        })),
      {
        yAxis:Number(candles[candles.length-1]?.close),
        name:'LIVE',
        lineStyle:{
          color:'#55d9ff',
          width:1,
          type:'dashed',
          opacity:.42
        },
        label:{show:false}
      }
    ];"""

    if old_levels not in draw:
        raise RuntimeError("V7.2 horizontal level block not found")
    draw=draw.replace(old_levels,new_levels,1)

    old_range=r"""    const slots=__mfChartVisibleSlotsV6();
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
    }"""

    new_range=r"""    const slots=__mfChartVisibleSlotsV6();
    let startValue;
    let endValue;

    const sameXContext=
      chartRuntime.mint===state.selectedMint &&
      chartRuntime.timeframe===state.timeframe;

    const userPanned=
      sameXContext &&
      chartRuntime.viewport?.followLatest===false &&
      chartRuntime.viewport?.startValue &&
      chartRuntime.viewport?.endValue &&
      labels.includes(String(chartRuntime.viewport.startValue)) &&
      labels.includes(String(chartRuntime.viewport.endValue));

    if(userPanned){
      startValue=String(chartRuntime.viewport.startValue);
      endValue=String(chartRuntime.viewport.endValue);
    }else if(state.timeframe==='all'){
      startValue=labels[0];
      endValue=labels[labels.length-1];
    }else if(candles.length<slots){
      startValue=labels[0];
      endValue=labels[Math.min(labels.length-1,slots-1)];
    }else{
      startValue=labels[Math.max(0,candles.length-slots)];
      endValue=labels[Math.min(labels.length-1,candles.length-1)];
    }"""

    if old_range not in draw:
        raise RuntimeError("V6 range block not found")
    draw=draw.replace(old_range,new_range,1)

    old_candle=r"""      emphasis:{disabled:true},
      animation:false,
      z:4
    };"""
    new_candle=r"""      emphasis:{disabled:true},
      animation:false,
      markLine:{
        silent:true,
        symbol:['none','none'],
        data:markLineData,
        animation:false
      },
      z:4
    };"""
    if old_candle not in draw:
        raise RuntimeError("candleSeries anchor not found")
    draw=draw.replace(old_candle,new_candle,1)

    old_series=r"""    const series=[
      candleSeries,
      ...horizontalSeries,
      ...overlaySeries,
      ...lowerSeries
    ];"""
    new_series=r"""    const series=[
      candleSeries,
      ...overlaySeries,
      ...lowerSeries
    ];"""
    if old_series not in draw:
        raise RuntimeError("series array horizontal overlay anchor not found")
    draw=draw.replace(old_series,new_series,1)

    draw=draw.replace("barWidth:'70%',","barWidth:'78%',",1)

    old_zoom=r"""            startValue,
            endValue,
            zoomOnMouseWheel:true,"""
    new_zoom=r"""            startValue,
            endValue,
            minValueSpan:window.innerWidth<700 ? 8 : 12,
            zoomOnMouseWheel:true,"""
    if old_zoom not in draw:
        raise RuntimeError("dataZoom anchor missing")
    draw=draw.replace(old_zoom,new_zoom,1)

    draw=draw.replace("right:94,","right:76,")

    old_legend=r"""    $('chartLegend').innerHTML=[
      '<span>O '+__mfChartFormatValueV6(last.open)+'</span>',
      '<span>H '+__mfChartFormatValueV6(last.high)+'</span>',
      '<span>L '+__mfChartFormatValueV6(last.low)+'</span>',
      '<span>C '+__mfChartFormatValueV6(last.close)+'</span>',
      '<span>'+candles.length+' candles · '+totalTrades+' trades</span>'
    ].join('');"""

    new_legend=r"""    const legendParts=[
      '<span>O '+__mfChartFormatValueV6(last.open)+'</span>',
      '<span>H '+__mfChartFormatValueV6(last.high)+'</span>',
      '<span>L '+__mfChartFormatValueV6(last.low)+'</span>',
      '<span>C '+__mfChartFormatValueV6(last.close)+'</span>',
      '<span>'+candles.length+' candles · '+totalTrades+' trades</span>'
    ];

    for(const level of (chartRuntime.offscreenLevels||[]).slice(0,3)){
      const arrow=Number(level?.price)>Number(last.close)?'↑':'↓';
      legendParts.push(
        '<span>'+arrow+' '+esc(String(level?.label||''))+'</span>'
      );
    }

    $('chartLegend').innerHTML=legendParts.join('');"""

    if old_legend not in draw:
        raise RuntimeError("chart legend anchor missing")
    draw=draw.replace(old_legend,new_legend,1)

    old_set=r"""    chartRuntime.api.clear();
    chartRuntime.api.setOption("""
    new_set=r"""    chartRuntime.suppressZoom=true;
    chartRuntime.api.clear();
    chartRuntime.api.setOption("""
    if old_set not in draw:
        raise RuntimeError("setOption anchor missing")
    draw=draw.replace(old_set,new_set,1)

    old_after=r"""      {notMerge:true,lazyUpdate:false}
    );

    chartRuntime.labels=labels;"""
    new_after=r"""      {notMerge:true,lazyUpdate:false}
    );
    queueMicrotask(()=>{
      chartRuntime.suppressZoom=false;
    });

    chartRuntime.labels=labels;"""
    if old_after not in draw:
        raise RuntimeError("setOption completion anchor missing")
    draw=draw.replace(old_after,new_after,1)

    return js[:start]+draw+js[end:]

def main():
    app=find_app()
    js_path=app/"trading.js"
    html_path=app/"trading.html"
    repo=app.parent if (app.parent/".git").exists() else app

    log(f"app: {app}")

    original_js=js_path.read_text(encoding="utf-8")
    original_html=html_path.read_text(encoding="utf-8")

    audit={
        "V6 renderer": V6 in original_js,
        "V7.2.1 levels/live": V72 in original_js,
        "drawChart": "function drawChart(" in original_js,
        "strategyLevels": "function strategyLevels(" in original_js,
        "chartHorizontalLevelSeries": "function chartHorizontalLevelSeries(" in original_js,
        "touch-safe helper": "function chartTouchUi()" in original_js,
    }
    for name,ok in audit.items():
        log(("AUDIT OK: " if ok else "AUDIT FAIL: ")+name)
        if not ok:
            raise RuntimeError("current topology mismatch: "+name)

    stamp=datetime.datetime.now().strftime("%Y%m%d-%H%M%S")
    backup=app/".patch-backups"/f"chart-v7-3-viewport-levels-{stamp}"
    backup.mkdir(parents=True,exist_ok=False)
    shutil.copy2(js_path,backup/"trading.js")
    shutil.copy2(html_path,backup/"trading.html")
    log(f"backup: {backup}")

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

    try:
        js=original_js

        if "function chartLevelInfo(" in js:
            js=replace_function(js,"chartLevelInfo",LEVEL_INFO)
        else:
            pos=js.find("function levelColor(")
            if pos<0:
                raise RuntimeError("cannot insert chartLevelInfo")
            js=js[:pos]+LEVEL_INFO+"\n\n"+js[pos:]

        js=ensure_viewport_runtime(js)
        js=ensure_capture_listener(js)
        js=patch_draw(js)

        if TAG not in js:
            js += "\n/* "+TAG+" */\n"

        html,n=re.subn(
            r'src="/trading\.js(?:\?[^"]*)?"',
            'src="/trading.js?v=chart-v7-3-viewport-levels-20260829"',
            original_html,
            count=1
        )
        if n!=1:
            raise RuntimeError("expected one trading.js script tag")

        js_path.write_text(js,encoding="utf-8")
        html_path.write_text(html,encoding="utf-8")

        final_js=js_path.read_text(encoding="utf-8")
        final_html=html_path.read_text(encoding="utf-8")

        checks={
            "level autoscale filter":
                "const low=Math.max(0,min-rawSpan*.45);" in final_js,
            "markLine attached to candles":
                "markLine:{" in final_js and "data:markLineData" in final_js,
            "separate level series removed from active series":
                "candleSeries,\n      ...overlaySeries" in final_js,
            "viewport capture":
                "function captureChartViewport()" in final_js,
            "user pan preserved":
                "const userPanned=" in final_js,
            "minimum zoom span":
                "minValueSpan:window.innerWidth<700 ? 8 : 12" in final_js,
            "professional candle width":
                "barWidth:'78%'" in final_js,
            "offscreen level indicators":
                "chartRuntime.offscreenLevels||[]" in final_js,
            "V7.2 live logic preserved":
                V72 in final_js,
            "touch safety preserved":
                "function chartTouchUi()" in final_js,
            "cache bust":
                "/trading.js?v=chart-v7-3-viewport-levels-20260829" in final_html,
        }

        for name,ok in checks.items():
            log(("OK: " if ok else "FAIL: ")+name)
            if not ok:
                raise RuntimeError("verification failed: "+name)

        run("node","--check",str(js_path),cwd=app)

    except Exception:
        shutil.copy2(backup/"trading.js",js_path)
        shutil.copy2(backup/"trading.html",html_path)
        log("FAILED: trading.js/html restored from backup")
        raise

    if (repo/".git").exists():
        rels=[str(js_path.relative_to(repo)),str(html_path.relative_to(repo))]
        diffcheck=run(
            "git","diff","--check","--",*rels,
            cwd=repo,check=False
        )
        if diffcheck.returncode!=0:
            log(
                "WARNING: pre-existing whitespace issues remain; "
                "V7.3 kept because JS syntax/semantic checks passed."
            )
        log("DIRTY-SAFE: no git add / commit / push performed")
        run("git","status","--short","--",*rels,cwd=repo,check=False)

    log("FIX COMPLETE")
    log("V7.3 fixes:")
    log(" - distant TP levels no longer shrink candle Y-scale")
    log(" - nearby ENTRY/SL levels are native candlestick markLines, not scrolling X-series")
    log(" - distant TP levels become compact offscreen indicators")
    log(" - user pan/zoom viewport survives live redraws")
    log(" - candle width restored to 78% with mobile minimum zoom span")
    log("Restart Replit app/workflow and hard-refresh Safari.")
    return 0

if __name__=="__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(f"[{TAG}] FATAL: {exc}",file=sys.stderr)
        raise
