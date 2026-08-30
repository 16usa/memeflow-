#!/usr/bin/env python3
from pathlib import Path
import datetime
import re
import shutil
import subprocess
import sys

TAG="MEMEFLOW_CHART_HISTORY_LIVE_LEVELS_V9_1_DIRTY_SAFE"
EXPECTED_V8="MEMEFLOW_CHART_CLEAN_LIVE_LEVELS_V8_DIRTY_SAFE"

OLD_ENSURE = """  ensureBackfill(mint, { onProgress = null } = {}) {
    const safe = cleanMint(mint);
    if (!safe) return Promise.reject(new Error('invalid chart history mint'));
    const status = this.statusSync(safe);
    const result = {...status,mint:safe,wsOnly:true,backfillDisabled:true};
    if (typeof onProgress === 'function') { try { onProgress(result); } catch {} }
    return Promise.resolve(result);
  }"""

NEW_ENSURE = """  ensureBackfill(mint, { onProgress = null } = {}) {
    const safe = cleanMint(mint);
    if (!safe) {
      return Promise.reject(new Error('invalid chart history mint'));
    }

    const status = this.statusSync(safe);

    if (status.oldestComplete === true) {
      const result = {
        ...status,
        mint: safe,
        backfillDisabled: false,
        cached: true
      };
      if (typeof onProgress === 'function') {
        try { onProgress(result); } catch {}
      }
      return Promise.resolve(result);
    }

    const existing = this.inFlight.get(safe);
    if (existing) return existing;

    if (!this.rpc || typeof this.rpc.call !== 'function') {
      const error = new Error('CHART_HISTORY_RPC_UNAVAILABLE');
      error.code = 'CHART_HISTORY_RPC_UNAVAILABLE';
      return Promise.reject(error);
    }

    const job = this._runBackfill(safe, onProgress)
      .finally(() => {
        if (this.inFlight.get(safe) === job) {
          this.inFlight.delete(safe);
        }
      });

    this.inFlight.set(safe, job);
    return job;
  }"""

NEW_OFFSCREEN = r"""function chartOffscreenLevelGraphicsV8(candles,levels){
  const rows=(Array.isArray(levels)?levels:[])
    .filter(level=>Number.isFinite(Number(level?.price)));

  if(!rows.length)return [];

  const host=$('chartCanvas');
  const width=Math.max(260,Number(host?.clientWidth||0));
  const height=Math.max(220,Number(host?.clientHeight||0));
  const last=Number(candles?.[candles.length-1]?.close);

  const above=rows
    .filter(level=>Number(level.price)>=last)
    .sort((a,b)=>Number(b.price)-Number(a.price));

  const below=rows
    .filter(level=>Number(level.price)<last)
    .sort((a,b)=>Number(a.price)-Number(b.price));

  const make=(level,y,direction,index)=>{
    const color=levelColor(level);
    const label=`${direction==='up'?'↑':'↓'} ${String(level?.label||'')}`;
    const x1=18;
    const x2=Math.max(150,width-82);

    return {
      type:'group',
      id:`mf-offscreen-${direction}-${index}-${String(level?.kind||'level')}`,
      silent:true,
      z:30,
      children:[
        {
          type:'line',
          shape:{x1,y1:y,x2,y2:y},
          style:{
            stroke:color,
            lineWidth:1,
            lineDash:[6,5],
            opacity:.72
          }
        },
        {
          type:'text',
          x:x2-3,
          y:y-2,
          style:{
            text:label,
            fill:color,
            font:chartTouchUi()
              ? '700 9px ui-sans-serif, system-ui'
              : '700 10px ui-sans-serif, system-ui',
            textAlign:'right',
            textVerticalAlign:'bottom',
            backgroundColor:'rgba(5,12,17,.94)',
            borderColor:color,
            borderWidth:1,
            borderRadius:4,
            padding:[3,5]
          }
        }
      ]
    };
  };

  const graphics=[];

  above.slice(0,4).forEach((level,index)=>{
    graphics.push(make(level,58+index*24,'up',index));
  });

  below.slice(0,4).forEach((level,index)=>{
    graphics.push(
      make(
        level,
        Math.max(150,height-76-index*24),
        'down',
        index
      )
    );
  });

  return graphics;
}"""

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
        raise RuntimeError(f"command failed ({p.returncode}): {' '.join(args)}")
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
            i+=2; continue
        if ch=="/" and nxt=="*":
            block_comment=True
            i+=2; continue
        if ch in ("'",'"',"`"):
            quote=ch
            i+=1; continue
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

def patch_server(server):
    old="const __mfChartArchive=new ChartHistoryArchive({dataDir});"
    if old not in server:
        if "CHART_HISTORY_RPC_V9_1" in server:
            return server
        raise RuntimeError("ChartHistoryArchive construction anchor changed")

    new=r"""// CHART_HISTORY_RPC_V9_1
// Read-only historical chart RPC. It is isolated from AI/risk/execution.
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

def patch_archive(archive):
    if OLD_ENSURE in archive:
        return archive.replace(OLD_ENSURE,NEW_ENSURE,1)

    # Accept an already-patched method only if it is the intended semantic form.
    if (
        "this._runBackfill(safe, onProgress)" in archive and
        "CHART_HISTORY_RPC_UNAVAILABLE" in archive and
        "const existing = this.inFlight.get(safe);" in archive
    ):
        return archive

    raise RuntimeError("ensureBackfill block differs from audited V8 source")

def patch_frontend(js):
    if EXPECTED_V8 not in js:
        raise RuntimeError("V8 marker missing")

    js=replace_function(js,"chartOffscreenLevelGraphicsV8",NEW_OFFSCREEN)

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
        raise RuntimeError("snapshot state block changed")
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

    originals={
        js_path:js_path.read_text(encoding="utf-8"),
        html_path:html_path.read_text(encoding="utf-8"),
        server_path:server_path.read_text(encoding="utf-8"),
        archive_path:archive_path.read_text(encoding="utf-8"),
    }

    js=originals[js_path]
    html=originals[html_path]
    server=originals[server_path]
    archive=originals[archive_path]

    audit={
        "V8 frontend installed":EXPECTED_V8 in js,
        "canonical /api/chart/stream frontend":
            "/api/chart/stream?tokenAddress=" in js,
        "live update listener":
            "source.addEventListener('update'" in js,
        "historical decoder present":
            "_transactionPoints(mint, signatureRow)" in archive,
        "historical walker present":
            "async _runBackfill(mint, onProgress)" in archive,
        "V8 disabled method present":
            OLD_ENSURE in archive,
        "configured Solana pool present":
            "const __mfPreOpenRpcUrls=" in server and
            "const __mfPreOpenRpc=" in server,
    }
    for name,ok in audit.items():
        log(("AUDIT OK: " if ok else "AUDIT FAIL: ")+name)
        if not ok:
            raise RuntimeError("audit failed: "+name)

    stamp=datetime.datetime.now().strftime("%Y%m%d-%H%M%S")
    backup=app/".patch-backups"/f"chart-history-live-v9-1-{stamp}"
    backup.mkdir(parents=True,exist_ok=False)
    for p,content in originals.items():
        (backup/p.name).write_text(content,encoding="utf-8")
    log(f"backup: {backup}")

    try:
        server2=patch_server(server)
        archive2=patch_archive(archive)
        js2=patch_frontend(js)

        html2,count=re.subn(
            r'src="/trading\.js(?:\?[^"]*)?"',
            'src="/trading.js?v=chart-history-live-levels-v9-1-20260829"',
            html,
            count=1
        )
        if count!=1:
            raise RuntimeError("trading.js cache-bust anchor not found")

        if TAG not in server2:
            server2 += "\n// "+TAG+"\n"
        if TAG not in archive2:
            archive2 += "\n// "+TAG+"\n"

        js_path.write_text(js2,encoding="utf-8")
        html_path.write_text(html2,encoding="utf-8")
        server_path.write_text(server2,encoding="utf-8")
        archive_path.write_text(archive2,encoding="utf-8")

        final_archive=archive_path.read_text(encoding="utf-8")
        final_server=server_path.read_text(encoding="utf-8")
        final_js=js_path.read_text(encoding="utf-8")
        final_html=html_path.read_text(encoding="utf-8")

        # IMPORTANT: verify ONLY the active ensureBackfill method, not a global
        # string search. V9's old verifier was too broad and caused the rollback.
        active_start=final_archive.index("  ensureBackfill(mint")
        active_end=final_archive.index("\n  async _runBackfill",active_start)
        active_method=final_archive[active_start:active_end]

        checks={
            "active ensureBackfill no longer disabled":
                "backfillDisabled:true" not in active_method,
            "active ensureBackfill calls real walker":
                "this._runBackfill(safe, onProgress)" in active_method,
            "one job per mint":
                "this.inFlight.get(safe)" in active_method,
            "archive receives chart RPC":
                "rpc:__mfChartHistoryRpc" in final_server,
            "RPC limited to read-only chart methods":
                "CHART_HISTORY_RPC_METHOD_BLOCKED" in final_server,
            "live SSE preserved":
                "source.addEventListener('update'" in final_js,
            "history state visible":
                "HISTORY SYNC ·" in final_js,
            "TP2/TP1 order fixed":
                ".sort((a,b)=>Number(b.price)-Number(a.price))" in final_js,
            "bottom level indicators inside chart":
                "height-76-index*24" in final_js,
            "cache bust updated":
                "chart-history-live-levels-v9-1-20260829" in final_html,
        }

        for name,ok in checks.items():
            log(("OK: " if ok else "FAIL: ")+name)
            if not ok:
                raise RuntimeError("verification failed: "+name)

        run("node","--check",str(js_path),cwd=app)
        run("node","--check",str(server_path),cwd=app)
        run("node","--check",str(archive_path),cwd=app)

    except Exception:
        for p,content in originals.items():
            p.write_text(content,encoding="utf-8")
        log("FAILED: all target files restored from backup")
        raise

    if (repo/".git").exists():
        rels=[
            str(js_path.relative_to(repo)),
            str(html_path.relative_to(repo)),
            str(server_path.relative_to(repo)),
            str(archive_path.relative_to(repo)),
        ]
        diffcheck=run("git","diff","--check","--",*rels,cwd=repo,check=False)
        if diffcheck.returncode!=0:
            log("WARNING: pre-existing whitespace warnings remain; patch kept.")
        log("DIRTY-SAFE: no git add / commit / push performed")
        run("git","status","--short","--",*rels,cwd=repo,check=False)

    log("FIX COMPLETE")
    log("V9.1 verifier fixed: checks the active ensureBackfill method only.")
    log("Historical chart backfill is enabled; live SSE remains unchanged.")
    log("Restart Replit app/workflow, then hard-refresh Safari.")
    return 0

if __name__=="__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(f"[{TAG}] FATAL: {exc}",file=sys.stderr)
        raise
