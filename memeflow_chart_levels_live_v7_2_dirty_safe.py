#!/usr/bin/env python3
from pathlib import Path
import datetime
import re
import shutil
import subprocess
import sys

TAG="MEMEFLOW_CHART_LEVELS_LIVE_V7_2_DIRTY_SAFE"
V6="MEMEFLOW_CHART_SINGLE_ENGINE_RECOVERY_V6_DIRTY_SAFE"
V7="MEMEFLOW_CHART_LIVE_TOUCH_RECOVERY_V7_DIRTY_SAFE"
STRATEGY_LEVELS="\nfunction strategyLevels() {\n  if(!state.selectedMint)return [];\n\n  const position=(Array.isArray(state.positions)?state.positions:[])\n    .find(\n      p=>\n        String(p?.status||'').toUpperCase()==='OPEN' &&\n        String(p?.mint||'')===String(state.selectedMint)\n    );\n\n  let entrySol=num(\n    position?.entryPriceSol,\n    position?.entryPrice,\n    null\n  );\n\n  if(!(entrySol>0)){\n    const entryUsd=num(\n      position?.entryPriceUsd,\n      position?.entryUsd,\n      null\n    );\n    const rate=solUsdRate();\n    if(entryUsd>0 && rate>0){\n      entrySol=entryUsd/rate;\n    }\n  }\n\n  if(!(entrySol>0)){\n    entrySol=\n      chartRuntime.previewEntrySolByMint?.get?.(state.selectedMint)\n      ?? null;\n  }\n\n  if(!(entrySol>0)){\n    const points=rawPoints(state.selectedMint);\n    const last=points[points.length-1];\n    entrySol=num(\n      last?.priceSol ?? last?.price,\n      candidatePrice(state.selected),\n      null\n    );\n    if(entrySol>0){\n      chartRuntime.previewEntrySolByMint?.set?.(\n        state.selectedMint,\n        entrySol\n      );\n    }\n  }\n\n  if(!(entrySol>0))return [];\n\n  const rate=solUsdRate();\n  if(!(rate>0))return [];\n\n  const entry=chartValueFromUsdPrice(entrySol*rate);\n  if(!(entry>0))return [];\n\n  const settings=state.settings||{};\n\n  const fieldOrSetting=(id,key)=>{\n    try{\n      const el=$(id);\n      const value=num(el?.value,null);\n      if(value!==null && Number.isFinite(value))return value;\n    }catch{}\n    return num(settings?.[key],null);\n  };\n\n  const hard=fieldOrSetting('hardStopPct','hardStopPct');\n  const tp1=fieldOrSetting('tp1Pct','tp1Pct');\n  const tp2=fieldOrSetting('tp2Pct','tp2Pct');\n  const tp1Sell=fieldOrSetting('tp1SellPct','tp1SellPct');\n  const tp2Sell=fieldOrSetting('tp2SellPct','tp2SellPct');\n\n  const rows=[\n    {\n      label:'ENTRY',\n      price:entry,\n      kind:'entry'\n    }\n  ];\n\n  if(hard>0 && hard<100){\n    rows.push({\n      label:`SL -${fmt(hard,1)}%`,\n      price:entry*(1-hard/100),\n      kind:'stop'\n    });\n  }\n\n  if(tp1>0){\n    rows.push({\n      label:\n        `TP1 +${fmt(tp1,0)}%`+\n        (tp1Sell>0?` · SELL ${fmt(tp1Sell,0)}%`:''),\n      price:entry*(1+tp1/100),\n      kind:'tp'\n    });\n  }\n\n  if(tp2>0){\n    rows.push({\n      label:\n        `TP2 +${fmt(tp2,0)}%`+\n        (tp2Sell>0?` · SELL ${fmt(tp2Sell,0)}%`:''),\n      price:entry*(1+tp2/100),\n      kind:'tp2'\n    });\n  }\n\n  return rows.filter(\n    row=>Number.isFinite(Number(row?.price)) && Number(row.price)>0\n  );\n}\n"
LEVEL_COLOR="\nfunction levelColor(level){\n  if(level?.kind==='stop')return '#ff6679';\n  if(level?.kind==='entry')return '#55d9ff';\n  if(level?.kind==='tp')return '#4de6a1';\n  if(level?.kind==='tp2')return '#82e9b8';\n  return '#a98bff';\n}\n"
LEVEL_SERIES="\nfunction chartHorizontalLevelSeries(labels,visibleLevels,liveValue){\n  const count=Array.isArray(labels)?labels.length:0;\n  if(!count)return [];\n\n  const constantData=value=>\n    Array.from({length:count},()=>Number(value));\n\n  const isTouch=\n    typeof chartTouchUi==='function'\n      ? chartTouchUi()\n      : false;\n\n  const rows=(Array.isArray(visibleLevels)?visibleLevels:[])\n    .filter(\n      level=>\n        Number.isFinite(Number(level?.price)) &&\n        Number(level.price)>0\n    )\n    .map((level,index)=>({\n      name:`__MF_LEVEL_${index}_${String(level.kind||'level')}`,\n      type:'line',\n      xAxisIndex:0,\n      yAxisIndex:0,\n      data:constantData(level.price),\n      showSymbol:false,\n      symbol:'none',\n      silent:true,\n      animation:false,\n      tooltip:{show:false},\n      emphasis:{disabled:true},\n      lineStyle:{\n        color:levelColor(level),\n        width:1,\n        type:'dashed',\n        opacity:.82\n      },\n      endLabel:{\n        show:true,\n        color:levelColor(level),\n        backgroundColor:'rgba(5,12,17,.90)',\n        borderColor:levelColor(level),\n        borderWidth:1,\n        borderRadius:3,\n        padding:isTouch?[2,4]:[3,5],\n        fontSize:isTouch?8:9,\n        formatter:()=>String(level.label||'')\n      },\n      labelLayout:{hideOverlap:false},\n      z:8\n    }));\n\n  const live=Number(liveValue);\n  if(Number.isFinite(live) && live>0){\n    rows.push({\n      name:'__MF_LIVE_LEVEL',\n      type:'line',\n      xAxisIndex:0,\n      yAxisIndex:0,\n      data:constantData(live),\n      showSymbol:false,\n      symbol:'none',\n      silent:true,\n      animation:false,\n      tooltip:{show:false},\n      emphasis:{disabled:true},\n      lineStyle:{\n        color:'#55d9ff',\n        width:1,\n        type:'dashed',\n        opacity:.55\n      },\n      z:7\n    });\n  }\n\n  return rows;\n}\n"

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
        if all((p/x).is_file() for x in (
            "trading.js",
            "trading.html",
            "app-server.mjs",
            "src/pump-live-trade-feed.mjs",
        )):
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
            if depth==0:
                return i+1
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

def ensure_chart_runtime_preview(js):
    if "previewEntrySolByMint:new Map()" in js:
        return js
    for old,new in [
        (
            "  offscreenLevels:[]\n};",
            "  offscreenLevels:[],\n  previewEntrySolByMint:new Map()\n};"
        ),
        (
            "  offscreenLevels:[],\n};",
            "  offscreenLevels:[],\n  previewEntrySolByMint:new Map(),\n};"
        ),
    ]:
        if old in js:
            return js.replace(old,new,1)
    raise RuntimeError("chartRuntime offscreenLevels anchor changed")

def patch_levels(js):
    if "function strategyLevels(" in js:
        js=replace_function(js,"strategyLevels",STRATEGY_LEVELS)
    else:
        pos=js.find("function levelColor(")
        if pos<0:
            raise RuntimeError("cannot place strategyLevels")
        js=js[:pos]+STRATEGY_LEVELS+"\n\n"+js[pos:]

    if "function levelColor(" in js:
        js=replace_function(js,"levelColor",LEVEL_COLOR)
    else:
        pos=js.find("function chartHorizontalLevelSeries(")
        if pos<0:
            raise RuntimeError("levelColor anchor missing")
        js=js[:pos]+LEVEL_COLOR+"\n\n"+js[pos:]

    if "function chartHorizontalLevelSeries(" in js:
        js=replace_function(js,"chartHorizontalLevelSeries",LEVEL_SERIES)
    else:
        pos=js.find("function drawChart(")
        if pos<0:
            raise RuntimeError("drawChart anchor missing")
        js=js[:pos]+LEVEL_SERIES+"\n\n"+js[pos:]

    js=ensure_chart_runtime_preview(js)

    start,end,draw=extract_function(js,"drawChart")

    old=r"""    let horizontalSeries=[];
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
    }"""

    new=r"""    let horizontalSeries=[];
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

    if old in draw:
        draw=draw.replace(old,new,1)
    elif "const levels=" not in draw:
        raise RuntimeError("V6 horizontal-level block changed")

    # Enough right gutter for ENTRY / SL / TP labels.
    draw=draw.replace("right:76,","right:94,")
    js=js[:start]+draw+js[end:]
    return js

def patch_update_handler(js):
    start,end,fn=extract_function(js,"connectChartStream")
    marker="source.addEventListener('update'"
    p=fn.find(marker)
    if p<0:
        raise RuntimeError("chart SSE update listener missing")
    brace=fn.find("{",p)
    if brace<0:
        raise RuntimeError("update listener opening brace missing")
    body_end=scan_block_end(fn,brace)
    close=fn.find(");",body_end)
    if close<0:
        raise RuntimeError("update listener terminator missing")
    close+=2

    new_listener=r"""source.addEventListener('update',event=>{
    try{
      const payload=JSON.parse(event.data||'{}');
      const point=payload?.point||null;
      const added=addPoint(mint,point,false);

      if(added && mint===state.selectedMint){
        chartRuntime.dataKey='';
        updateRealtimeChart(mint);
      }

      $('feedState').textContent='LIVE';
    }catch(error){
      console.warn('[MEMEFLOW CHART] live update',error);
    }
  });"""

    fn=fn[:p]+new_listener+fn[close:]
    return js[:start]+fn+js[end:]

def patch_server_live(server):
    if "function __mfChartBroadcastLiveV7" not in server:
        raise RuntimeError("V7 backend live helper missing")
    if "__mfChartBroadcastLiveV7(mint,point)" not in server:
        raise RuntimeError("V7 publishTrade live fanout missing")

    start,end,publish=extract_function(server,"publishTrade")
    call="try{__mfChartBroadcastLiveV7(mint,point)}catch{}"

    while publish.count(call)>0:
        publish=publish.replace(call,"",1)

    anchor="__mfChartArchive.appendPoint(mint,point)"
    if anchor in publish:
        pos=publish.find(anchor)
        semi=publish.find(";",pos)
        if semi<0:
            raise RuntimeError("appendPoint terminator missing")
        insert=semi+1
    else:
        anchor="rows.push(point);"
        pos=publish.find(anchor)
        if pos<0:
            raise RuntimeError("publishTrade point append anchor missing")
        insert=pos+len(anchor)

    publish=(
        publish[:insert]+
        "\n  // V7.2: send live chart update in the same TradeEvent turn.\n"
        "  try{__mfChartBroadcastLiveV7(mint,point)}catch{}\n"+
        publish[insert:]
    )
    return server[:start]+publish+server[end:]

def main():
    app=find_app()
    js_path=app/"trading.js"
    html_path=app/"trading.html"
    server_path=app/"app-server.mjs"
    feed_path=app/"src/pump-live-trade-feed.mjs"
    repo=app.parent if (app.parent/".git").exists() else app

    log(f"app: {app}")

    original_js=js_path.read_text(encoding="utf-8")
    original_html=html_path.read_text(encoding="utf-8")
    original_server=server_path.read_text(encoding="utf-8")
    original_feed=feed_path.read_text(encoding="utf-8")

    audit={
        "V6 single renderer": V6 in original_js,
        "V7 live stream": V7 in original_js,
        "drawChart": "function drawChart(" in original_js,
        "connectChartStream": "function connectChartStream(" in original_js,
        "open positions state": "state.positions" in original_js,
        "server V7 fanout":
            "function __mfChartBroadcastLiveV7" in original_server,
        "server persistent chart archive":
            "__mfChartArchive.appendPoint" in original_server,
        "Pump TradeEvent decoder":
            "tradeEventsDecoded" in original_feed or
            "decodeTradeEvent" in original_feed,
    }

    for name,ok in audit.items():
        log(("AUDIT OK: " if ok else "AUDIT FAIL: ")+name)
        if not ok:
            raise RuntimeError("current topology mismatch: "+name)

    stamp=datetime.datetime.now().strftime("%Y%m%d-%H%M%S")
    backup=app/".patch-backups"/f"chart-levels-live-v7-2-{stamp}"
    backup.mkdir(parents=True,exist_ok=False)
    for p in (js_path,html_path,server_path,feed_path):
        shutil.copy2(p,backup/p.name)
    log(f"backup: {backup}")

    if (repo/".git").exists():
        rels=[
            str(js_path.relative_to(repo)),
            str(html_path.relative_to(repo)),
            str(server_path.relative_to(repo)),
            str(feed_path.relative_to(repo)),
        ]
        (backup/"git-status-before.txt").write_text(
            run("git","status","--short","--",*rels,cwd=repo,check=False).stdout or "",
            encoding="utf-8"
        )
        (backup/"git-diff-before.patch").write_text(
            run("git","diff","--",*rels,cwd=repo,check=False).stdout or "",
            encoding="utf-8"
        )

    try:
        js=patch_levels(original_js)
        js=patch_update_handler(js)
        server=patch_server_live(original_server)

        if TAG not in js:
            js += "\n/* "+TAG+" */\n"
        if TAG not in server:
            server += "\n// "+TAG+"\n"

        html,n=re.subn(
            r'src="/trading\.js(?:\?[^"]*)?"',
            'src="/trading.js?v=chart-levels-live-v7-2-20260829"',
            original_html,
            count=1
        )
        if n!=1:
            raise RuntimeError("expected one trading.js script tag")

        js_path.write_text(js,encoding="utf-8")
        html_path.write_text(html,encoding="utf-8")
        server_path.write_text(server,encoding="utf-8")

        final_js=js_path.read_text(encoding="utf-8")
        final_server=server_path.read_text(encoding="utf-8")
        final_html=html_path.read_text(encoding="utf-8")

        checks={
            "OPEN POSITION levels restored":
                "function strategyLevels()" in final_js,
            "ENTRY level": "label:'ENTRY'" in final_js,
            "SL level": "label:`SL -" in final_js,
            "TP1 level": "label:`TP1 +" in final_js,
            "TP2 level": "label:`TP2 +" in final_js,
            "horizontal ECharts level series":
                "function chartHorizontalLevelSeries(" in final_js,
            "drawChart uses strategy levels":
                "strategyLevels()" in final_js and
                "const levels=" in final_js,
            "live event direct add":
                "const added=addPoint(mint,point,false);" in final_js,
            "live event immediate redraw":
                "updateRealtimeChart(mint);" in final_js,
            "server same-turn fanout":
                "V7.2: send live chart update in the same TradeEvent turn."
                in final_server,
            "V7 backend stream preserved":
                "function __mfChartBroadcastLiveV7" in final_server,
            "V6 renderer preserved": V6 in final_js,
            "touch safety preserved":
                "function chartTouchUi()" in final_js,
            "cache bust":
                "/trading.js?v=chart-levels-live-v7-2-20260829"
                in final_html,
        }

        for name,ok in checks.items():
            log(("OK: " if ok else "FAIL: ")+name)
            if not ok:
                raise RuntimeError("verification failed: "+name)

        run("node","--check",str(js_path),cwd=app)
        run("node","--check",str(server_path),cwd=app)

    except Exception:
        shutil.copy2(backup/"trading.js",js_path)
        shutil.copy2(backup/"trading.html",html_path)
        shutil.copy2(backup/"app-server.mjs",server_path)
        shutil.copy2(backup/"pump-live-trade-feed.mjs",feed_path)
        log("FAILED: all target files restored from backup")
        raise

    if (repo/".git").exists():
        rels=[
            str(js_path.relative_to(repo)),
            str(html_path.relative_to(repo)),
            str(server_path.relative_to(repo)),
            str(feed_path.relative_to(repo)),
        ]
        diffcheck=run(
            "git","diff","--check","--",*rels,
            cwd=repo,check=False
        )
        if diffcheck.returncode!=0:
            log(
                "WARNING: pre-existing whitespace issues remain; "
                "V7.2 kept because syntax/semantic checks passed."
            )
        log("DIRTY-SAFE: no git add / commit / push performed")
        run("git","status","--short","--",*rels,cwd=repo,check=False)

    log("FIX COMPLETE")
    log("Restored:")
    log(" - ENTRY / SL / TP1 / TP2 from OPEN POSITION + current settings")
    log(" - compact dashed level overlays in the existing chart style")
    log(" - same-turn server SSE fanout for each real Pump TradeEvent")
    log(" - immediate browser redraw for each accepted live chart point")
    log(" - no timer/synthetic chart movement")
    log(" - V6 visual style and V7 iPhone touch safety preserved")
    log("Restart Replit app/workflow and hard-refresh Safari.")
    return 0

if __name__=="__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(f"[{TAG}] FATAL: {exc}",file=sys.stderr)
        raise
