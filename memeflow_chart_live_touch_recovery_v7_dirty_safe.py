#!/usr/bin/env python3
from pathlib import Path
import datetime
import re
import shutil
import subprocess
import sys

TAG="MEMEFLOW_CHART_LIVE_TOUCH_RECOVERY_V7_DIRTY_SAFE"
V6="MEMEFLOW_CHART_SINGLE_ENGINE_RECOVERY_V6_DIRTY_SAFE"
LIVE_HELPER="\n// MEMEFLOW_CHART_LIVE_TOUCH_RECOVERY_V7_DIRTY_SAFE\n// One canonical live SSE fan-out for the same chartTradeStreams map opened by\n// /api/chart/stream. Display-only: no AI/trading decision logic is changed.\nconst __mfChartLiveLastKeyV7=new Map();\n\nfunction __mfChartBroadcastLiveV7(mint,point){\n  mint=String(mint||'').trim();\n  if(!mint||!point)return false;\n\n  const listeners=chartTradeStreams.get(mint);\n  if(!listeners?.size)return false;\n\n  const price=Number(point?.priceSol ?? point?.price);\n  const at=Number(point?.t);\n  if(!(Number.isFinite(price)&&price>0&&Number.isFinite(at)&&at>0)){\n    return false;\n  }\n\n  const key=\n    String(point?.id||'')+'|'+\n    String(at)+'|'+\n    String(price)+'|'+\n    String(point?.isBuy===true)+'|'+\n    String(Number(point?.solAmount)||0)+'|'+\n    String(Number(point?.tokenAmount)||0);\n\n  if(__mfChartLiveLastKeyV7.get(mint)===key)return false;\n  __mfChartLiveLastKeyV7.set(mint,key);\n\n  const frame=\n    `event: update\\n`+\n    `data: ${JSON.stringify({\n      point:{\n        id:point?.id||null,\n        t:at,\n        price,\n        priceSol:price,\n        source:point?.source||'pump-trade-event',\n        isBuy:point?.isBuy===true,\n        solAmount:Number(point?.solAmount)||0,\n        tokenAmount:Number(point?.tokenAmount)||0,\n        markPrice:Number.isFinite(Number(point?.markPrice))\n          ? Number(point.markPrice)\n          : null\n      },\n      status:{\n        stale:false,\n        source:point?.source||'pump-trade-event',\n        live:true,\n        persistentHistory:true\n      }\n    })}\\n\\n`;\n\n  for(const res of [...listeners]){\n    try{res.write(frame)}\n    catch{listeners.delete(res)}\n  }\n  return true;\n}\n"
NEW_ADD_POINT="\nfunction addPoint(mint,point,redraw=true) {\n  if(!mint)return false;\n\n  const next=normalizeChartPoint(point);\n  if(!next)return false;\n\n  const points=rawPoints(mint);\n\n  // SSE reconnect/snapshot can repeat the newest real event.\n  const recent=points.slice(-64);\n  const duplicate=recent.some(existing=>{\n    if(next.id && existing?.id){\n      return String(existing.id)===String(next.id);\n    }\n    return (\n      Number(existing?.t)===Number(next.t) &&\n      Number(existing?.price)===Number(next.price) &&\n      Boolean(existing?.isBuy)===Boolean(next.isBuy) &&\n      Number(existing?.solAmount||0)===Number(next.solAmount||0) &&\n      Number(existing?.tokenAmount||0)===Number(next.tokenAmount||0)\n    );\n  });\n  if(duplicate)return false;\n\n  const last=points[points.length-1];\n  const late=Boolean(last && Number(next.t)<Number(last.t));\n  points.push(next);\n\n  if(late){\n    points.sort((a,b)=>Number(a.t)-Number(b.t));\n  }\n\n  if(points.length>8000){\n    points.splice(0,points.length-8000);\n  }\n\n  if(redraw){\n    chartRuntime.dataKey='';\n    updateRealtimeChart(mint);\n  }\n\n  return true;\n}\n"
NEW_REALTIME="\nfunction updateRealtimeChart(mint){\n  if(mint!==state.selectedMint)return;\n\n  const points=rawPoints(mint);\n  const lastPoint=points[points.length-1]||null;\n\n  if(lastPoint){\n    try{\n      if(typeof __mfChartSyncHeaderV6==='function'){\n        __mfChartSyncHeaderV6(points);\n      }else if(typeof pointUsdPrice==='function'){\n        renderPriceModeSummary(pointUsdPrice(lastPoint));\n      }\n    }catch{}\n  }\n\n  // V6 uses ECharts full-series redraw. Never use a stale LightweightCharts\n  // series.update() path here.\n  chartRuntime.dataKey='';\n  scheduleChart();\n}\n"

def log(msg):
    print(f"[{TAG}] {msg}",flush=True)

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
            if ch=="\n": line_comment=False
            i+=1; continue
        if block_comment:
            if ch=="*" and nxt=="/":
                block_comment=False
                i+=2
                continue
            i+=1; continue
        if quote:
            if escape:
                escape=False
            elif ch=="\\":
                escape=True
            elif ch==quote:
                quote=None
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
    m=re.search(
        r"\bfunction\s+"+re.escape(name)+r"\s*\(",
        text
    )
    if not m:
        raise RuntimeError(f"function not found: {name}")
    brace=text.find("{",m.end())
    if brace<0:
        raise RuntimeError(f"opening brace not found: {name}")
    end=scan_block_end(text,brace)
    return m.start(),end,text[m.start():end]

def replace_function(text,name,replacement):
    start,end,_=extract_function(text,name)
    return text[:start]+replacement.strip()+"\n"+text[end:]

def patch_backend(app):
    if TAG in app:
        return app,False

    if "const chartTradeStreams=new Map()" not in app:
        raise RuntimeError("chartTradeStreams declaration missing")

    _,_,publish=extract_function(app,"publishTrade")
    if "rows.push(point);" not in publish:
        raise RuntimeError(
            "publishTrade no longer contains canonical chart point append"
        )

    m=re.search(
        r"const\s+chartTradeStreams\s*=\s*new Map\(\)\s*,\s*chartTradeHistory\s*=\s*new Map\(\)\s*;",
        app
    )
    if not m:
        raise RuntimeError(
            "chartTradeStreams/chartTradeHistory declaration shape changed"
        )

    app=app[:m.end()]+"\n"+LIVE_HELPER+"\n"+app[m.end():]

    start,end,publish=extract_function(app,"publishTrade")
    if "__mfChartBroadcastLiveV7(mint,point)" not in publish:
        archive_anchor="__mfChartArchive.appendPoint(mint,point)"
        if archive_anchor in publish:
            pos=publish.find(archive_anchor)
            stmt_end=publish.find(";",pos)
            if stmt_end<0:
                raise RuntimeError(
                    "archive append statement terminator not found"
                )
            insert_at=stmt_end+1
        else:
            anchor="rows.push(point);"
            pos=publish.find(anchor)
            insert_at=pos+len(anchor)

        publish=(
            publish[:insert_at]+
            "\n  try{__mfChartBroadcastLiveV7(mint,point)}catch{}\n"+
            publish[insert_at:]
        )
        app=app[:start]+publish+app[end:]

    return app,True

def patch_frontend(js):
    if V6 not in js:
        raise RuntimeError(
            "V6 single-engine marker missing; refusing to layer V7 blindly"
        )

    if "function chartTouchUi()" not in js:
        anchor="function __mfChartVisibleSlotsV6(){"
        helper="""function chartTouchUi(){
  return Boolean(
    (typeof window.matchMedia==='function' &&
      window.matchMedia('(pointer: coarse)').matches) ||
    Number(navigator.maxTouchPoints||0)>0
  );
}

"""
        if anchor not in js:
            raise RuntimeError("V6 chart helper anchor missing")
        js=js.replace(anchor,helper+anchor,1)

    js=replace_function(js,"updateRealtimeChart",NEW_REALTIME)
    js=replace_function(js,"addPoint",NEW_ADD_POINT)

    start,end,draw=extract_function(js,"drawChart")

    if "const touchUi=chartTouchUi();" not in draw:
        anchor="    chartRuntime.api.clear();"
        if anchor not in draw:
            raise RuntimeError("V6 drawChart ECharts clear anchor missing")
        draw=draw.replace(
            anchor,
            "    const touchUi=chartTouchUi();\n\n"+anchor,
            1
        )

    old_tooltip="""        tooltip:{
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
        },"""

    new_tooltip="""        axisPointer:{
          show:!touchUi,
          triggerTooltip:!touchUi,
          snap:false,
          animation:false,
          label:{show:false}
        },
        tooltip:{
          show:!touchUi,
          showContent:!touchUi,
          trigger:touchUi ? 'none' : 'axis',
          triggerOn:touchUi ? 'none' : 'mousemove|click',
          alwaysShowContent:false,
          confine:true,
          axisPointer:{
            show:!touchUi,
            type:'line',
            snap:false,
            label:{show:false},
            lineStyle:{
              color:'rgba(120,176,195,.30)',
              width:1,
              type:'dashed'
            }
          },
          backgroundColor:'rgba(5,12,17,.96)',
          borderColor:'rgba(111,170,190,.22)',
          textStyle:{
            color:'#cfe0e7',
            fontSize:10
          },
          extraCssText:
            'box-shadow:0 8px 30px rgba(0,0,0,.32);'+
            'max-width:220px;',
          formatter:params=>{
            const list=Array.isArray(params)?params:[params];
            const priceRow=list.find(
              row=>row?.seriesName==='Price'
            )||list[0];
            const index=Number(priceRow?.dataIndex);
            const c=Number.isFinite(index)
              ? displayCandles[index]
              : null;
            if(!c)return '';
            return [
              '<strong>'+__mfChartTimeLabelV6(c.t)+'</strong>',
              'O '+__mfChartFormatValueV6(c.open),
              'H '+__mfChartFormatValueV6(c.high),
              'L '+__mfChartFormatValueV6(c.low),
              'C '+__mfChartFormatValueV6(c.close),
              Number(c.samples||0)+' trades'
            ].join('<br>');
          }
        },"""

    if old_tooltip in draw:
        draw=draw.replace(old_tooltip,new_tooltip,1)
    elif "trigger:touchUi ? 'none' : 'axis'" not in draw:
        raise RuntimeError("V6 tooltip block changed; refusing to guess")

    # Suppress axis-pointer labels for both chart panes on touch.
    draw=draw.replace(
        """      splitLine:{show:false}
    };""",
        """      splitLine:{show:false},
      axisPointer:{
        show:!touchUi,
        type:'line',
        snap:false,
        label:{show:false}
      }
    };""",
        1
    )

    second_axis_anchor="""            splitLine:{show:false}
          }
        ]"""
    if second_axis_anchor in draw:
        draw=draw.replace(
            second_axis_anchor,
            """            splitLine:{show:false},
            axisPointer:{
              show:!touchUi,
              type:'line',
              snap:false,
              label:{show:false}
            }
          }
        ]""",
            1
        )

    js=js[:start]+draw+js[end:]
    if TAG not in js:
        js += "\n/* "+TAG+" */\n"

    return js,True

def main():
    app=find_app()
    js_path=app/"trading.js"
    html_path=app/"trading.html"
    server_path=app/"app-server.mjs"
    repo=app.parent if (app.parent/".git").exists() else app

    log(f"app: {app}")

    original_js=js_path.read_text(encoding="utf-8")
    original_html=html_path.read_text(encoding="utf-8")
    original_server=server_path.read_text(encoding="utf-8")

    audit={
        "V6 single ECharts renderer":
            V6 in original_js,
        "browser snapshot listener":
            "addEventListener('snapshot'" in original_js,
        "browser update listener":
            "addEventListener('update'" in original_js,
        "browser addPoint":
            "function addPoint(" in original_js,
        "browser realtime redraw":
            "function updateRealtimeChart(" in original_js,
        "server publishTrade":
            "function publishTrade(" in original_server,
        "server chart stream map":
            "chartTradeStreams" in original_server,
        "persistent archive":
            "__mfChartArchive.appendPoint" in original_server,
    }

    for name,ok in audit.items():
        log(("AUDIT OK: " if ok else "AUDIT FAIL: ")+name)
        if not ok:
            raise RuntimeError("current project topology mismatch: "+name)

    stamp=datetime.datetime.now().strftime("%Y%m%d-%H%M%S")
    backup=app/".patch-backups"/f"chart-live-touch-v7-{stamp}"
    backup.mkdir(parents=True,exist_ok=False)

    for path in (js_path,html_path,server_path):
        shutil.copy2(path,backup/path.name)
    log(f"backup: {backup}")

    if (repo/".git").exists():
        rels=[
            str(js_path.relative_to(repo)),
            str(html_path.relative_to(repo)),
            str(server_path.relative_to(repo)),
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
        server,_=patch_backend(original_server)
        js,_=patch_frontend(original_js)

        html,count=re.subn(
            r'src="/trading\.js(?:\?[^"]*)?"',
            'src="/trading.js?v=chart-live-touch-v7-20260829"',
            original_html,
            count=1
        )
        if count!=1:
            raise RuntimeError("expected exactly one trading.js script tag")

        server_path.write_text(server,encoding="utf-8")
        js_path.write_text(js,encoding="utf-8")
        html_path.write_text(html,encoding="utf-8")

        final_server=server_path.read_text(encoding="utf-8")
        final_js=js_path.read_text(encoding="utf-8")
        final_html=html_path.read_text(encoding="utf-8")

        checks={
            "server live update helper":
                "function __mfChartBroadcastLiveV7" in final_server,
            "publishTrade live fanout":
                "__mfChartBroadcastLiveV7(mint,point)" in final_server,
            "same SSE map":
                "chartTradeStreams.get(mint)" in final_server,
            "browser update listener preserved":
                "addEventListener('update'" in final_js,
            "browser duplicate protection":
                "const recent=points.slice(-64);" in final_js,
            "ECharts-safe realtime redraw":
                "chartRuntime.dataKey='';\n  scheduleChart();" in final_js,
            "touch detection":
                "function chartTouchUi()" in final_js,
            "mobile tooltip disabled":
                "trigger:touchUi ? 'none' : 'axis'" in final_js,
            "raw pointer labels disabled":
                "label:{show:false}" in final_js,
            "V6 single renderer preserved":
                V6 in final_js,
            "V5 fallback remains removed":
                "__mfDrawChartFallback" not in final_js,
            "cache bust":
                "/trading.js?v=chart-live-touch-v7-20260829" in final_html,
        }

        for name,ok in checks.items():
            log(("OK: " if ok else "FAIL: ")+name)
            if not ok:
                raise RuntimeError("verification failed: "+name)

        run("node","--check",str(server_path),cwd=app)
        run("node","--check",str(js_path),cwd=app)

    except Exception:
        shutil.copy2(backup/"app-server.mjs",server_path)
        shutil.copy2(backup/"trading.js",js_path)
        shutil.copy2(backup/"trading.html",html_path)
        log("FAILED: all target files restored from backup")
        raise

    if (repo/".git").exists():
        rels=[
            str(js_path.relative_to(repo)),
            str(html_path.relative_to(repo)),
            str(server_path.relative_to(repo)),
        ]
        diffcheck=run(
            "git","diff","--check","--",*rels,
            cwd=repo,check=False
        )
        if diffcheck.returncode!=0:
            log(
                "WARNING: pre-existing whitespace issues remain; "
                "V7 is kept because syntax/semantic checks passed."
            )
        log("DIRTY-SAFE: no git add / commit / push performed")
        run("git","status","--short","--",*rels,cwd=repo,check=False)

    log("FIX COMPLETE")
    log("V7 repaired:")
    log(" - every accepted Pump TradeEvent is fanned into /api/chart/stream live")
    log(" - browser de-duplicates reconnect/snapshot repeats")
    log(" - every new live point schedules the ECharts redraw")
    log(" - iPhone touch no longer opens crosshair/black tooltip/raw timestamp labels")
    log(" - V6 full-history/sparse-candle renderer remains intact")
    log("Restart Replit app/workflow and hard-refresh Safari.")
    return 0

if __name__=="__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(f"[{TAG}] FATAL: {exc}",file=sys.stderr)
        raise
