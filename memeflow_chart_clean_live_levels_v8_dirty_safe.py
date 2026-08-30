#!/usr/bin/env python3
from pathlib import Path
import datetime
import re
import shutil
import subprocess
import sys

TAG="MEMEFLOW_CHART_CLEAN_LIVE_LEVELS_V8_DIRTY_SAFE"
EXPECTED_V73="MEMEFLOW_CHART_VIEWPORT_LEVELS_V7_3_DIRTY_SAFE"

PUBLISH_TRADE="\nfunction publishTrade(mint,event,tokenOverride=null){\n  if(!mint||!event)return;\n\n  // Keep copy trading on the same already-deduplicated canonical Pump event.\n  try{\n    Promise\n      .resolve(\n        copyTrading.onTradeEvent(\n          event,\n          tokenOverride||store.state.tokens[mint]\n        )\n      )\n      .catch(\n        error=>console.warn(\n          '[copy-trading]',\n          error?.message||error\n        )\n      );\n  }catch(error){\n    console.warn('[copy-trading]',error?.message||error);\n  }\n\n  const token=tokenOverride||store.state.tokens[mint];\n  const price=Number(token?.priceSol);\n  if(!(price>0))return;\n\n  const isBuy=\n    event.isBuy===true\n      ? true\n      : event.isBuy===false\n        ? false\n        : null;\n  if(isBuy===null)return;\n\n  const solAmount=\n    typeof event.solAmount==='bigint'\n      ? Number(event.solAmount)/1e9\n      : Number(event.solAmount||0);\n\n  const tokenAmount=\n    typeof event.tokenAmount==='bigint'\n      ? Number(event.tokenAmount)\n      : Number(event.tokenAmount||0);\n\n  if(!(solAmount>0||tokenAmount>0))return;\n\n  let at=Number(event.timestamp);\n  if(Number.isFinite(at)&&at>0){\n    if(at<1e12)at*=1000;\n  }else{\n    at=Date.now();\n  }\n\n  const id=\n    event.signature\n      ? [\n          String(event.signature),\n          String(at),\n          isBuy?'B':'S',\n          String(solAmount),\n          String(tokenAmount)\n        ].join(':')\n      : null;\n\n  const point={\n    id,\n    t:at,\n    price,\n    priceSol:price,\n    markPrice:price,\n    source:'pump-trade-event',\n    isBuy,\n    solAmount,\n    tokenAmount\n  };\n\n  // 1) RAM hot history is updated first so any reconnecting snapshot\n  //    immediately sees the same canonical event.\n  const rows=chartTradeHistory.get(mint)||[];\n  rows.push(point);\n\n  if(rows.length>1200){\n    rows.splice(0,rows.length-1200);\n  }\n\n  chartTradeHistory.delete(mint);\n  chartTradeHistory.set(mint,rows);\n\n  while(chartTradeHistory.size>250){\n    const oldest=chartTradeHistory.keys().next().value;\n    if(oldest===undefined)break;\n    chartTradeHistory.delete(oldest);\n  }\n\n  // 2) LIVE FIRST. Exactly one SSE frame per accepted Pump TradeEvent.\n  //    This is intentionally independent of archive IO.\n  const listeners=chartTradeStreams.get(mint);\n  if(listeners?.size){\n    const frame=\n      `event: update\\n`+\n      `data: ${JSON.stringify({\n        point,\n        status:{\n          stale:false,\n          source:'pump-trade-event',\n          live:true,\n          persistentHistory:true\n        }\n      })}\\n\\n`;\n\n    for(const res of [...listeners]){\n      try{\n        res.write(frame);\n        try{res.flush?.()}catch{}\n      }catch{\n        listeners.delete(res);\n      }\n    }\n  }\n\n  // 3) Persistence happens after the live frame, so disk/archive work can\n  //    never delay or suppress the open Trading Terminal.\n  try{\n    __mfChartArchive.appendPoint(mint,point);\n  }catch(error){\n    console.warn(\n      '[chart-history-append]',\n      mint,\n      error?.message||error\n    );\n  }\n}\n"
LEVEL_INFO="\nfunction chartLevelInfo(candles){\n  const levels=\n    typeof strategyLevels==='function'\n      ? strategyLevels()\n      : [];\n\n  if(!candles.length || !levels.length){\n    return {visible:[],offscreen:levels};\n  }\n\n  // Scale is defined by recent PRICE ACTION, not TP +100/+200.\n  const basis=\n    state.timeframe==='all'\n      ? candles.slice(-Math.min(180,candles.length))\n      : candles.slice(-Math.min(120,candles.length));\n\n  const values=basis.flatMap(c=>[\n    Number(c.high),\n    Number(c.low)\n  ]).filter(Number.isFinite);\n\n  if(!values.length){\n    return {visible:[],offscreen:levels};\n  }\n\n  const min=Math.min(...values);\n  const max=Math.max(...values);\n  const span=Math.max(\n    max-min,\n    Math.abs(max||1)*.008\n  );\n\n  // Nearby levels are real markLines at their exact price.\n  // Distant levels are rendered as fixed edge indicators so they remain\n  // visible without destroying candle scale.\n  const low=Math.max(0,min-span*.55);\n  const high=max+span*.55;\n\n  return {\n    visible:levels.filter(level=>{\n      const price=Number(level?.price);\n      return Number.isFinite(price) && price>=low && price<=high;\n    }),\n    offscreen:levels.filter(level=>{\n      const price=Number(level?.price);\n      return !Number.isFinite(price) || price<low || price>high;\n    })\n  };\n}\n"
OFFSCREEN_HELPER="\nfunction chartOffscreenLevelGraphicsV8(candles,levels){\n  const rows=Array.isArray(levels)?levels:[];\n  if(!rows.length)return [];\n\n  const host=$('chartCanvas');\n  const width=Math.max(\n    260,\n    Number(host?.clientWidth||0)\n  );\n  const height=Math.max(\n    220,\n    Number(host?.clientHeight||0)\n  );\n\n  const last=Number(\n    candles?.[candles.length-1]?.close\n  );\n\n  const above=[];\n  const below=[];\n\n  for(const level of rows){\n    const price=Number(level?.price);\n    if(!Number.isFinite(price))continue;\n    (price>=last?above:below).push(level);\n  }\n\n  const make=(level,y,direction,index)=>{\n    const color=levelColor(level);\n    const label=\n      `${direction==='up'?'↑':'↓'} ${String(level?.label||'')}`;\n\n    const x1=18;\n    const x2=Math.max(\n      120,\n      width-90\n    );\n\n    return {\n      type:'group',\n      id:\n        `mf-offscreen-${direction}-${index}-`+\n        String(level?.kind||'level'),\n      silent:true,\n      z:30,\n      children:[\n        {\n          type:'line',\n          shape:{\n            x1,\n            y1:y,\n            x2,\n            y2:y\n          },\n          style:{\n            stroke:color,\n            lineWidth:1,\n            lineDash:[6,5],\n            opacity:.68\n          }\n        },\n        {\n          type:'text',\n          x:Math.max(22,x2-4),\n          y:y-1,\n          style:{\n            text:label,\n            fill:color,\n            font:\n              chartTouchUi()\n                ? '700 9px ui-sans-serif, system-ui'\n                : '700 10px ui-sans-serif, system-ui',\n            textAlign:'right',\n            textVerticalAlign:'bottom',\n            backgroundColor:'rgba(5,12,17,.92)',\n            borderColor:color,\n            borderWidth:1,\n            borderRadius:4,\n            padding:[3,5]\n          }\n        }\n      ]\n    };\n  };\n\n  const graphics=[];\n\n  above.slice(0,3).forEach((level,index)=>{\n    graphics.push(\n      make(\n        level,\n        56+index*25,\n        'up',\n        index\n      )\n    );\n  });\n\n  below.slice(0,3).forEach((level,index)=>{\n    graphics.push(\n      make(\n        level,\n        Math.max(\n          80,\n          height-44-index*25\n        ),\n        'down',\n        index\n      )\n    );\n  });\n\n  return graphics;\n}\n"

def log(msg):
    print(f"[{TAG}] {msg}",flush=True)

def run(*args,cwd=None,check=True):
    p=subprocess.run(
        args,
        cwd=cwd,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT
    )
    if p.stdout:
        print(
            p.stdout,
            end="" if p.stdout.endswith("\n") else "\n"
        )
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
        if (
            (p/"trading.js").is_file()
            and (p/"trading.html").is_file()
            and (p/"app-server.mjs").is_file()
        ):
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
            if ch=="\n":
                line_comment=False
            i+=1
            continue

        if block_comment:
            if ch=="*" and nxt=="/":
                block_comment=False
                i+=2
                continue
            i+=1
            continue

        if quote:
            if escape:
                escape=False
            elif ch=="\\":
                escape=True
            elif ch==quote:
                quote=None
            i+=1
            continue

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
    m=re.search(
        r"\bfunction\s+"+
        re.escape(name)+
        r"\s*\(",
        text
    )
    if not m:
        raise RuntimeError(
            f"function not found: {name}"
        )

    brace=text.find("{",m.end())
    if brace<0:
        raise RuntimeError(
            f"opening brace missing: {name}"
        )

    end=scan_block_end(text,brace)
    return m.start(),end,text[m.start():end]

def replace_function(text,name,replacement):
    start,end,_=extract_function(
        text,
        name
    )
    return (
        text[:start]+
        replacement.strip()+
        "\n"+
        text[end:]
    )

def patch_frontend(js):
    if EXPECTED_V73 not in js:
        raise RuntimeError(
            "V7.3 marker missing; refusing to patch a different chart build"
        )

    js=replace_function(
        js,
        "chartLevelInfo",
        LEVEL_INFO
    )

    # Add one fixed offscreen-level renderer.
    if "function chartOffscreenLevelGraphicsV8(" not in js:
        pos=js.find("function drawChart(")
        if pos<0:
            raise RuntimeError(
                "drawChart anchor missing"
            )
        js=(
            js[:pos]+
            OFFSCREEN_HELPER.strip()+
            "\n\n"+
            js[pos:]
        )

    start,end,draw=extract_function(
        js,
        "drawChart"
    )

    # Build fixed edge indicators from offscreen levels.
    anchor="""    const markLineData=["""
    if anchor not in draw:
        raise RuntimeError(
            "markLineData anchor missing"
        )

    # Insert after markLineData declaration closes, right before slots.
    slots_anchor="""    const slots=__mfChartVisibleSlotsV6();"""
    if slots_anchor not in draw:
        raise RuntimeError(
            "visible slots anchor missing"
        )

    if "const offscreenGraphics=chartOffscreenLevelGraphicsV8(" not in draw:
        draw=draw.replace(
            slots_anchor,
            """    const offscreenGraphics=
      chartOffscreenLevelGraphicsV8(
        candles,
        chartRuntime.offscreenLevels
      );

"""+slots_anchor,
            1
        )

    # Do not destroy/recreate the canvas model on every live trade.
    draw=draw.replace(
        """    chartRuntime.suppressZoom=true;
    chartRuntime.api.clear();
    chartRuntime.api.setOption(""",
        """    chartRuntime.suppressZoom=true;
    chartRuntime.api.setOption(""",
        1
    )

    # Fixed graphics belong to the chart viewport, not to X-series.
    draw=draw.replace(
        """        backgroundColor:'transparent',
        grid,""",
        """        backgroundColor:'transparent',
        grid,
        graphic:offscreenGraphics,""",
        1
    )

    # Offscreen level text now has an actual fixed dashed line in-chart.
    # Remove duplicate legend chips so the header remains clean.
    legend_loop=r"""    for(const level of (chartRuntime.offscreenLevels||[]).slice(0,3)){
      const arrow=Number(level?.price)>Number(last.close)?'↑':'↓';
      legendParts.push(
        '<span>'+arrow+' '+esc(String(level?.label||''))+'</span>'
      );
    }

"""
    if legend_loop in draw:
        draw=draw.replace(
            legend_loop,
            "",
            1
        )

    # Slightly fewer mobile visible slots -> larger, TradingView-like candles.
    # We patch the helper separately below; no width hacks here.
    js=js[:start]+draw+js[end:]

    js=replace_function(
        js,
        "__mfChartVisibleSlotsV6",
        """function __mfChartVisibleSlotsV6(){
  return window.innerWidth<700 ? 42 : 76;
}"""
    )

    # Use the one canonical endpoint so there is no route ambiguity.
    start,end,stream_fn=extract_function(
        js,
        "connectChartStream"
    )
    stream_fn=stream_fn.replace(
        "/api/chart/trade-stream?tokenAddress=",
        "/api/chart/stream?tokenAddress="
    )
    js=js[:start]+stream_fn+js[end:]

    if TAG not in js:
        js += "\n/* "+TAG+" */\n"

    return js

def main():
    app=find_app()
    js_path=app/"trading.js"
    html_path=app/"trading.html"
    server_path=app/"app-server.mjs"
    repo=(
        app.parent
        if (app.parent/".git").exists()
        else app
    )

    log(f"app: {app}")

    original_js=js_path.read_text(
        encoding="utf-8"
    )
    original_html=html_path.read_text(
        encoding="utf-8"
    )
    original_server=server_path.read_text(
        encoding="utf-8"
    )

    audit={
        "exact V7.3 frontend":
            EXPECTED_V73 in original_js,
        "EventSource update listener":
            "source.addEventListener('update'" in original_js,
        "viewport capture":
            "function captureChartViewport(" in original_js,
        "markLine renderer":
            "markLine:{" in original_js,
        "current server publishTrade":
            "function publishTrade(" in original_server,
        "persistent archive":
            "__mfChartArchive.appendPoint" in original_server,
        "chart SSE map":
            "chartTradeStreams" in original_server,
    }

    for name,ok in audit.items():
        log(
            ("AUDIT OK: " if ok else "AUDIT FAIL: ")+name
        )
        if not ok:
            raise RuntimeError(
                "current topology mismatch: "+name
            )

    stamp=datetime.datetime.now().strftime(
        "%Y%m%d-%H%M%S"
    )
    backup=(
        app/
        ".patch-backups"/
        f"chart-clean-live-levels-v8-{stamp}"
    )
    backup.mkdir(
        parents=True,
        exist_ok=False
    )

    for p in (
        js_path,
        html_path,
        server_path
    ):
        shutil.copy2(
            p,
            backup/p.name
        )

    log(f"backup: {backup}")

    if (repo/".git").exists():
        rels=[
            str(js_path.relative_to(repo)),
            str(html_path.relative_to(repo)),
            str(server_path.relative_to(repo)),
        ]

        (backup/"git-status-before.txt").write_text(
            run(
                "git",
                "status",
                "--short",
                "--",
                *rels,
                cwd=repo,
                check=False
            ).stdout or "",
            encoding="utf-8"
        )

        (backup/"git-diff-before.patch").write_text(
            run(
                "git",
                "diff",
                "--",
                *rels,
                cwd=repo,
                check=False
            ).stdout or "",
            encoding="utf-8"
        )

    try:
        js=patch_frontend(
            original_js
        )

        server=replace_function(
            original_server,
            "publishTrade",
            PUBLISH_TRADE
        )

        if TAG not in server:
            server += "\n// "+TAG+"\n"

        html,count=re.subn(
            r'src="/trading\.js(?:\?[^"]*)?"',
            'src="/trading.js?v=chart-clean-live-levels-v8-20260829"',
            original_html,
            count=1
        )

        if count!=1:
            raise RuntimeError(
                "expected exactly one trading.js script reference"
            )

        js_path.write_text(
            js,
            encoding="utf-8"
        )
        server_path.write_text(
            server,
            encoding="utf-8"
        )
        html_path.write_text(
            html,
            encoding="utf-8"
        )

        final_js=js_path.read_text(
            encoding="utf-8"
        )
        final_server=server_path.read_text(
            encoding="utf-8"
        )
        final_html=html_path.read_text(
            encoding="utf-8"
        )

        _,_,publish=extract_function(
            final_server,
            "publishTrade"
        )

        checks={
            "one canonical live frame in publishTrade":
                publish.count("event: update")==1,
            "old V7 live helper not called by publishTrade":
                "__mfChartBroadcastLiveV7(mint,point)"
                not in publish,
            "live frame before archive persistence":
                publish.find("res.write(frame)")
                <
                publish.find("__mfChartArchive.appendPoint"),
            "live write flush":
                "res.flush?.()" in publish,
            "unique real-event id":
                "event.signature" in publish,
            "canonical /api/chart/stream endpoint":
                "/api/chart/stream?tokenAddress="
                in final_js,
            "fixed offscreen level graphics":
                "function chartOffscreenLevelGraphicsV8("
                in final_js,
            "near levels remain markLine":
                "data:markLineData" in final_js,
            "offscreen fixed graphics in ECharts":
                "graphic:offscreenGraphics"
                in final_js,
            "no api.clear on each live redraw":
                "chartRuntime.suppressZoom=true;\n    chartRuntime.api.clear();"
                not in final_js,
            "viewport preservation retained":
                "const userPanned=" in final_js,
            "42 mobile visible slots":
                "window.innerWidth<700 ? 42 : 76"
                in final_js,
            "touch safety retained":
                "function chartTouchUi()" in final_js,
            "cache bust":
                "/trading.js?v=chart-clean-live-levels-v8-20260829"
                in final_html,
        }

        for name,ok in checks.items():
            log(
                ("OK: " if ok else "FAIL: ")+name
            )
            if not ok:
                raise RuntimeError(
                    "verification failed: "+name
                )

        run(
            "node",
            "--check",
            str(js_path),
            cwd=app
        )
        run(
            "node",
            "--check",
            str(server_path),
            cwd=app
        )

    except Exception:
        shutil.copy2(
            backup/"trading.js",
            js_path
        )
        shutil.copy2(
            backup/"trading.html",
            html_path
        )
        shutil.copy2(
            backup/"app-server.mjs",
            server_path
        )
        log(
            "FAILED: all target files restored from backup"
        )
        raise

    if (repo/".git").exists():
        rels=[
            str(js_path.relative_to(repo)),
            str(html_path.relative_to(repo)),
            str(server_path.relative_to(repo)),
        ]

        diffcheck=run(
            "git",
            "diff",
            "--check",
            "--",
            *rels,
            cwd=repo,
            check=False
        )

        if diffcheck.returncode!=0:
            log(
                "WARNING: pre-existing whitespace issues remain; "
                "V8 is kept because JS syntax/semantic checks passed."
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
            check=False
        )

    log("FIX COMPLETE")
    log("V8 clean chart path:")
    log(" - exactly one live SSE update per accepted real Pump TradeEvent")
    log(" - live SSE is sent before archive IO, so persistence cannot delay the chart")
    log(" - frontend uses one canonical /api/chart/stream endpoint")
    log(" - live redraw no longer clears/recreates the ECharts model every tick")
    log(" - nearby ENTRY/SL/TP are true price markLines")
    log(" - distant levels remain visible as fixed dashed edge indicators")
    log(" - level graphics do not move horizontally with candle pan/zoom")
    log(" - user viewport preservation and iPhone touch safety stay enabled")
    log(" - mobile chart shows 42 slots for larger candles")
    log("Restart Replit app/workflow and hard-refresh Safari.")
    return 0

if __name__=="__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(
            f"[{TAG}] FATAL: {exc}",
            file=sys.stderr
        )
        raise
