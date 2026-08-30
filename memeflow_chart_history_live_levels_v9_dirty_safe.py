#!/usr/bin/env python3
from pathlib import Path
import datetime
import re
import shutil
import subprocess
import sys

TAG="MEMEFLOW_CHART_HISTORY_LIVE_LEVELS_V9_DIRTY_SAFE"
EXPECTED_V8="MEMEFLOW_CHART_CLEAN_LIVE_LEVELS_V8_DIRTY_SAFE"
NEW_ENSURE_BACKFILL="\n  ensureBackfill(mint, { onProgress = null } = {}) {\n    const safe = cleanMint(mint);\n    if (!safe) {\n      return Promise.reject(new Error('invalid chart history mint'));\n    }\n\n    const status = this.statusSync(safe);\n    if (status.oldestComplete === true) {\n      const result = {\n        ...status,\n        mint: safe,\n        backfillDisabled: false,\n        cached: true\n      };\n      if (typeof onProgress === 'function') {\n        try { onProgress(result); } catch {}\n      }\n      return Promise.resolve(result);\n    }\n\n    const existing = this.inFlight.get(safe);\n    if (existing) return existing;\n\n    if (!this.rpc || typeof this.rpc.call !== 'function') {\n      const error = new Error('CHART_HISTORY_RPC_UNAVAILABLE');\n      error.code = 'CHART_HISTORY_RPC_UNAVAILABLE';\n      return Promise.reject(error);\n    }\n\n    const job = this._runBackfill(safe, onProgress)\n      .finally(() => {\n        if (this.inFlight.get(safe) === job) {\n          this.inFlight.delete(safe);\n        }\n      });\n\n    this.inFlight.set(safe, job);\n    return job;\n  }\n"
NEW_OFFSCREEN="\nfunction chartOffscreenLevelGraphicsV8(candles,levels){\n  const rows=(Array.isArray(levels)?levels:[])\n    .filter(level=>Number.isFinite(Number(level?.price)));\n\n  if(!rows.length)return [];\n\n  const host=$('chartCanvas');\n  const width=Math.max(260,Number(host?.clientWidth||0));\n  const height=Math.max(220,Number(host?.clientHeight||0));\n  const last=Number(candles?.[candles.length-1]?.close);\n\n  const above=rows\n    .filter(level=>Number(level.price)>=last)\n    .sort((a,b)=>Number(b.price)-Number(a.price));\n\n  const below=rows\n    .filter(level=>Number(level.price)<last)\n    .sort((a,b)=>Number(a.price)-Number(b.price));\n\n  const make=(level,y,direction,index)=>{\n    const color=levelColor(level);\n    const label=`${direction==='up'?'↑':'↓'} ${String(level?.label||'')}`;\n    const x1=18;\n    const x2=Math.max(150,width-82);\n\n    return {\n      type:'group',\n      id:`mf-offscreen-${direction}-${index}-${String(level?.kind||'level')}`,\n      silent:true,\n      z:30,\n      children:[\n        {\n          type:'line',\n          shape:{x1,y1:y,x2,y2:y},\n          style:{\n            stroke:color,\n            lineWidth:1,\n            lineDash:[6,5],\n            opacity:.72\n          }\n        },\n        {\n          type:'text',\n          x:x2-3,\n          y:y-2,\n          style:{\n            text:label,\n            fill:color,\n            font:chartTouchUi()\n              ? '700 9px ui-sans-serif, system-ui'\n              : '700 10px ui-sans-serif, system-ui',\n            textAlign:'right',\n            textVerticalAlign:'bottom',\n            backgroundColor:'rgba(5,12,17,.94)',\n            borderColor:color,\n            borderWidth:1,\n            borderRadius:4,\n            padding:[3,5]\n          }\n        }\n      ]\n    };\n  };\n\n  const graphics=[];\n\n  above.slice(0,4).forEach((level,index)=>{\n    graphics.push(make(level,58+index*24,'up',index));\n  });\n\n  below.slice(0,4).forEach((level,index)=>{\n    graphics.push(\n      make(\n        level,\n        Math.max(150,height-76-index*24),\n        'down',\n        index\n      )\n    );\n  });\n\n  return graphics;\n}\n"

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
            "src/chart-history-archive.mjs",
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
            if escape: escape=False
            elif ch=="\\": escape=True
            elif ch==quote: quote=None
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

def replace_class_method(text,name,replacement):
    m=re.search(r"\n\s{2}"+re.escape(name)+r"\s*\(",text)
    if not m:
        raise RuntimeError(f"class method not found: {name}")
    start=m.start()+1
    brace=text.find("{",m.end())
    if brace<0:
        raise RuntimeError(f"class method opening brace missing: {name}")
    end=scan_block_end(text,brace)
    return text[:start]+replacement.rstrip()+"\n"+text[end:]

def patch_server(server):
    old="const __mfChartArchive=new ChartHistoryArchive({dataDir});"
    if old not in server:
        if "CHART_HISTORY_RPC_V9" in server:
            return server
        raise RuntimeError("ChartHistoryArchive construction anchor changed")

    new=r"""// CHART_HISTORY_RPC_V9
// Reuse the already configured Solana pool, but allow only the two read-only
// methods needed by chart history. This does not enter AI/risk/execution.
const __mfChartHistoryRpc=
  __mfPreOpenRpcUrls.length
    ? {
        async call(method,args=[]){
          if(
            method!=='getSignaturesForAddress' &&
            method!=='getTransaction'
          ){
            const error=new Error('CHART_HISTORY_RPC_METHOD_BLOCKED');
            error.code='CHART_HISTORY_RPC_METHOD_BLOCKED';
            throw error;
          }
          return __mfPreOpenRpc.call(method,args);
        }
      }
    : null;

const __mfChartArchive=new ChartHistoryArchive({
  dataDir,
  rpc:__mfChartHistoryRpc,
  pageSize:250,
  txConcurrency:2
});"""
    return server.replace(old,new,1)

def patch_frontend(js):
    if EXPECTED_V8 not in js:
        raise RuntimeError(
            "V8 marker missing. Current Replit build is not the audited V8 build."
        )

    js=replace_function(
        js,
        "chartOffscreenLevelGraphicsV8",
        NEW_OFFSCREEN
    )

    start,end,fn=extract_function(js,"connectChartStream")

    old="""      $('feedState').textContent=
        payload?.status?.backfillRunning===true
          ? 'HISTORY SYNC'
          : payload?.status?.fullHistoryReady===true
            ? 'LIVE · FULL HISTORY'
            : payload?.status?.stale===false || incoming.length
              ? 'LIVE'
              : 'WAITING';"""

    new="""      $('feedState').textContent=
        payload?.status?.backfillRunning===true
          ? `HISTORY SYNC · ${Number(payload?.status?.historyPoints||incoming.length||0)}`
          : payload?.status?.fullHistoryReady===true
            ? 'LIVE · FULL HISTORY'
            : payload?.status?.backfillError
              ? 'LIVE · HISTORY ERROR'
              : payload?.status?.stale===false || incoming.length
                ? 'LIVE'
                : 'WAITING';"""

    if old in fn:
        fn=fn.replace(old,new,1)
    elif "HISTORY SYNC ·" not in fn:
        raise RuntimeError("snapshot feed-state block changed")

    js=js[:start]+fn+js[end:]

    if TAG not in js:
        js += "\n/* "+TAG+" */\n"

    return js

def main():
    app=find_app()
    js_path=app/"trading.js"
    html_path=app/"trading.html"
    server_path=app/"app-server.mjs"
    archive_path=app/"src"/"chart-history-archive.mjs"
    repo=app.parent if (app.parent/".git").exists() else app

    log(f"app: {app}")

    original_js=js_path.read_text(encoding="utf-8")
    original_html=html_path.read_text(encoding="utf-8")
    original_server=server_path.read_text(encoding="utf-8")
    original_archive=archive_path.read_text(encoding="utf-8")

    audit={
        "V8 frontend installed":
            EXPECTED_V8 in original_js,
        "canonical chart stream":
            "/api/chart/stream?tokenAddress=" in original_js,
        "live EventSource update listener":
            "source.addEventListener('update'" in original_js,
        "server chart archive":
            "new ChartHistoryArchive" in original_server,
        "historical transaction decoder already present":
            "_transactionPoints(mint, signatureRow)" in original_archive,
        "historical walker already present":
            "async _runBackfill(mint, onProgress)" in original_archive,
        "backfill currently disabled":
            "backfillDisabled:true" in original_archive,
        "configured Solana read pool available":
            "const __mfPreOpenRpcUrls=" in original_server and
            "const __mfPreOpenRpc=" in original_server,
    }

    for name,ok in audit.items():
        log(("AUDIT OK: " if ok else "AUDIT FAIL: ")+name)
        if not ok:
            raise RuntimeError("current topology mismatch: "+name)

    stamp=datetime.datetime.now().strftime("%Y%m%d-%H%M%S")
    backup=app/".patch-backups"/f"chart-history-live-v9-{stamp}"
    backup.mkdir(parents=True,exist_ok=False)

    for p in (js_path,html_path,server_path,archive_path):
        shutil.copy2(p,backup/p.name)
    log(f"backup: {backup}")

    if (repo/".git").exists():
        rels=[
            str(js_path.relative_to(repo)),
            str(html_path.relative_to(repo)),
            str(server_path.relative_to(repo)),
            str(archive_path.relative_to(repo)),
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
        server=patch_server(original_server)
        archive=replace_class_method(
            original_archive,
            "ensureBackfill",
            NEW_ENSURE_BACKFILL
        )
        js=patch_frontend(original_js)

        html,count=re.subn(
            r'src="/trading\.js(?:\?[^"]*)?"',
            'src="/trading.js?v=chart-history-live-levels-v9-20260829"',
            original_html,
            count=1
        )
        if count!=1:
            raise RuntimeError(
                "expected exactly one trading.js script reference"
            )

        if TAG not in server:
            server += "\n// "+TAG+"\n"
        if TAG not in archive:
            archive += "\n// "+TAG+"\n"

        js_path.write_text(js,encoding="utf-8")
        html_path.write_text(html,encoding="utf-8")
        server_path.write_text(server,encoding="utf-8")
        archive_path.write_text(archive,encoding="utf-8")

        final_js=js_path.read_text(encoding="utf-8")
        final_server=server_path.read_text(encoding="utf-8")
        final_archive=archive_path.read_text(encoding="utf-8")
        final_html=html_path.read_text(encoding="utf-8")

        checks={
            "chart RPC is read-only":
                "CHART_HISTORY_RPC_METHOD_BLOCKED" in final_server,
            "archive receives chart RPC":
                "rpc:__mfChartHistoryRpc" in final_server,
            "bounded history page":
                "pageSize:250" in final_server,
            "bounded history concurrency":
                "txConcurrency:2" in final_server,
            "backfill enabled":
                "this._runBackfill(safe, onProgress)" in final_archive,
            "one job per mint":
                "this.inFlight.get(safe)" in final_archive,
            "completed history cached":
                "status.oldestComplete === true" in final_archive,
            "old disabled return removed":
                "backfillDisabled:true" not in final_archive,
            "live path preserved":
                "source.addEventListener('update'" in final_js,
            "history sync visible":
                "HISTORY SYNC ·" in final_js,
            "TP order corrected":
                ".sort((a,b)=>Number(b.price)-Number(a.price))" in final_js,
            "bottom levels inside plot":
                "height-76-index*24" in final_js,
            "V8 live model retained":
                EXPECTED_V8 in final_js,
            "cache bust":
                "/trading.js?v=chart-history-live-levels-v9-20260829"
                in final_html,
        }

        for name,ok in checks.items():
            log(("OK: " if ok else "FAIL: ")+name)
            if not ok:
                raise RuntimeError("verification failed: "+name)

        run("node","--check",str(js_path),cwd=app)
        run("node","--check",str(server_path),cwd=app)
        run("node","--check",str(archive_path),cwd=app)

    except Exception:
        shutil.copy2(backup/"trading.js",js_path)
        shutil.copy2(backup/"trading.html",html_path)
        shutil.copy2(backup/"app-server.mjs",server_path)
        shutil.copy2(backup/"chart-history-archive.mjs",archive_path)
        log("FAILED: all target files restored from backup")
        raise

    if (repo/".git").exists():
        rels=[
            str(js_path.relative_to(repo)),
            str(html_path.relative_to(repo)),
            str(server_path.relative_to(repo)),
            str(archive_path.relative_to(repo)),
        ]
        diffcheck=run(
            "git","diff","--check","--",*rels,
            cwd=repo,check=False
        )
        if diffcheck.returncode!=0:
            log(
                "WARNING: pre-existing whitespace issues remain; "
                "V9 kept because syntax/semantic checks passed."
            )
        log("DIRTY-SAFE: no git add / commit / push performed")
        run("git","status","--short","--",*rels,cwd=repo,check=False)

    log("FIX COMPLETE")
    log("ROOT CAUSE:")
    log(" - full historical decoder/walker already existed")
    log(" - but ensureBackfill() was hard-disabled and archive had no RPC")
    log(" - new tokens therefore showed only trades captured since this process saw them")
    log("V9:")
    log(" - enables on-demand read-only history for the selected mint")
    log(" - allows only getSignaturesForAddress/getTransaction")
    log(" - leaves AI/risk/execution unchanged")
    log(" - leaves V8 live SSE path unchanged")
    log(" - corrects TP2/TP1 visual order and keeps ENTRY/SL edge levels inside plot")
    log("Restart Replit app/workflow, then reopen Safari.")
    return 0

if __name__=="__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(f"[{TAG}] FATAL: {exc}",file=sys.stderr)
        raise
