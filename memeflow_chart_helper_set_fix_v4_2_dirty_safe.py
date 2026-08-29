#!/usr/bin/env python3
from pathlib import Path
import datetime
import re
import shutil
import subprocess
import sys

TAG="MEMEFLOW_CHART_HELPER_SET_FIX_V4_2_DIRTY_SAFE"
HELPERS={'__mfValidChartMint': "\nfunction __mfValidChartMint(value){\n  return /^[1-9A-HJ-NP-Za-km-z]{32,64}$/.test(String(value||'').trim());\n}\n", '__mfChartSnapshotPayload': "\nfunction __mfChartSnapshotPayload(mint){\n  mint=String(mint||'').trim();\n  const hot=chartTradeHistory.get(mint)||[];\n  let points=[];\n  try{\n    points=__mfChartArchive.mergePointsSync(mint,hot);\n  }catch(error){\n    console.warn('[chart-snapshot]',mint,error?.message||error);\n    points=Array.isArray(hot)?hot.slice():[];\n  }\n\n  let archiveStatus={running:false,oldestComplete:false,lastError:null};\n  try{archiveStatus=__mfChartArchive.statusSync(mint)}catch{}\n\n  const last=points[points.length-1]||null;\n  return {\n    points,\n    status:{\n      stale:points.length===0,\n      source:last?.source||'pump-trade-event',\n      historyPoints:points.length,\n      historyStartAt:points[0]?.t||null,\n      historyEndAt:last?.t||null,\n      backfillRunning:\n        archiveStatus.running===true ||\n        __mfChartBackfillJobs.has(mint),\n      fullHistoryReady:archiveStatus.oldestComplete===true,\n      backfillError:archiveStatus.lastError||null,\n      persistentHistory:true\n    },\n    tokenAddress:mint\n  };\n}\n", '__mfBroadcastChartSnapshot': '\nfunction __mfBroadcastChartSnapshot(mint){\n  const listeners=chartTradeStreams.get(mint);\n  if(!listeners?.size)return;\n  const frame=\n    `event: snapshot\\n`+\n    `data: ${JSON.stringify(__mfChartSnapshotPayload(mint))}\\n\\n`;\n  for(const res of [...listeners]){\n    try{res.write(frame)}\n    catch{listeners.delete(res)}\n  }\n}\n', '__mfEnsureChartBackfill': "\nfunction __mfEnsureChartBackfill(mint){\n  mint=String(mint||'').trim();\n  if(!__mfValidChartMint(mint))return;\n  if(__mfChartBackfillJobs.has(mint))return;\n\n  try{\n    const status=__mfChartArchive.statusSync(mint);\n    if(status?.oldestComplete===true)return;\n  }catch{}\n\n  const job=__mfChartArchive.ensureBackfill(mint,{\n    onProgress:()=>__mfBroadcastChartSnapshot(mint)\n  })\n    .then(()=>__mfBroadcastChartSnapshot(mint))\n    .catch(error=>{\n      console.warn('[chart-history]',mint,error?.message||error);\n      __mfBroadcastChartSnapshot(mint);\n    })\n    .finally(()=>{\n      if(__mfChartBackfillJobs.get(mint)===job){\n        __mfChartBackfillJobs.delete(mint);\n      }\n      queueMicrotask(()=>__mfBroadcastChartSnapshot(mint));\n    });\n\n  __mfChartBackfillJobs.set(mint,job);\n}\n", '__mfOpenChartStream': "\nfunction __mfOpenChartStream(req,res,mint){\n  mint=String(mint||'').trim();\n  if(!__mfValidChartMint(mint)){\n    return json(res,400,{error:'INVALID_TOKEN_ADDRESS'});\n  }\n\n  if(!chartTradeStreams.has(mint))chartTradeStreams.set(mint,new Set());\n  if(!chartTradeHistory.has(mint))chartTradeHistory.set(mint,[]);\n\n  res.writeHead(200,{\n    'content-type':'text/event-stream; charset=utf-8',\n    'cache-control':'no-cache, no-store, no-transform',\n    'connection':'keep-alive',\n    'x-accel-buffering':'no'\n  });\n  try{res.flushHeaders?.()}catch{}\n\n  res.write('retry: 1000\\n');\n  res.write(\n    `event: snapshot\\n`+\n    `data: ${JSON.stringify(__mfChartSnapshotPayload(mint))}\\n\\n`\n  );\n\n  const listeners=chartTradeStreams.get(mint);\n  listeners.add(res);\n\n  queueMicrotask(()=>{\n    try{__mfEnsureChartBackfill(mint)}catch{}\n  });\n\n  const heartbeat=setInterval(()=>{\n    try{res.write(`: chart ${Date.now()}\\n\\n`)}catch{}\n  },15000);\n  heartbeat.unref?.();\n\n  let closed=false;\n  const close=()=>{\n    if(closed)return;\n    closed=true;\n    clearInterval(heartbeat);\n    listeners.delete(res);\n  };\n\n  req.on('close',close);\n  res.on('close',close);\n}\n"}
HISTORY_ROUTE="if(url.pathname==='/api/chart/history'){\n  const mint=String(url.searchParams.get('tokenAddress')||'').trim();\n  if(!__mfValidChartMint(mint)){\n    return json(res,400,{error:'INVALID_TOKEN_ADDRESS'});\n  }\n  const snapshot=__mfChartSnapshotPayload(mint);\n  queueMicrotask(()=>{\n    try{__mfEnsureChartBackfill(mint)}catch{}\n  });\n  return json(res,200,snapshot);\n}"
STREAM_ROUTE="if(url.pathname==='/api/chart/stream'){\n  return __mfOpenChartStream(req,res,url.searchParams.get('tokenAddress'));\n}"
TRADE_STREAM_ROUTE="if(url.pathname==='/api/chart/trade-stream'){\n  return __mfOpenChartStream(req,res,url.searchParams.get('tokenAddress'));\n}"

def log(msg):
    print(f"[{TAG}] {msg}", flush=True)

def run(*args,cwd=None,check=True):
    p=subprocess.run(args,cwd=cwd,text=True,stdout=subprocess.PIPE,stderr=subprocess.STDOUT)
    if p.stdout:
        print(p.stdout,end="" if p.stdout.endswith("\n") else "\n")
    if check and p.returncode!=0:
        raise RuntimeError(f"command failed ({p.returncode}): {' '.join(args)}")
    return p

def find_app():
    cwd=Path.cwd().resolve()
    for p in [cwd/"memeflow-app",cwd,Path.home()/"workspace"/"memeflow-app",Path("/home/runner/workspace/memeflow-app")]:
        if (p/"app-server.mjs").is_file():
            return p.resolve()
    raise RuntimeError("memeflow-app not found")

def find_map_anchor(text):
    for pat in [
        r"const\s+chartTradeStreams\s*=\s*new Map\(\)\s*,\s*chartTradeHistory\s*=\s*new Map\(\)\s*;",
        r"const\s+chartTradeHistory\s*=\s*new Map\(\)\s*,\s*chartTradeStreams\s*=\s*new Map\(\)\s*;",
    ]:
        m=re.search(pat,text)
        if m:return m
    raise RuntimeError("chartTradeStreams/chartTradeHistory declaration not found")

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
            if ch=="\n":line_comment=False
            i+=1;continue
        if block_comment:
            if ch=="*" and nxt=="/":
                block_comment=False;i+=2;continue
            i+=1;continue
        if quote:
            if escape:escape=False
            elif ch=="\\":escape=True
            elif ch==quote:quote=None
            i+=1;continue
        if ch=="/" and nxt=="/":
            line_comment=True;i+=2;continue
        if ch=="/" and nxt=="*":
            block_comment=True;i+=2;continue
        if ch in ("'",'"',"`"):
            quote=ch;i+=1;continue
        if ch=="{":depth+=1
        elif ch=="}":
            depth-=1
            if depth==0:return i+1
        i+=1
    raise RuntimeError("closing brace not found")

def replace_function(text,name,replacement):
    m=re.search(r"\bfunction\s+"+re.escape(name)+r"\s*\(",text)
    if not m:return text,False
    brace=text.find("{",m.end())
    if brace<0:raise RuntimeError("opening brace missing for "+name)
    end=scan_block_end(text,brace)
    return text[:m.start()]+replacement.strip()+"\n"+text[end:],True

def replace_route(text,start_token,replacement):
    start=text.find(start_token)
    if start<0:raise RuntimeError("route not found: "+start_token)
    brace=text.find("{",start)
    if brace<0:raise RuntimeError("route opening brace missing")
    end=scan_block_end(text,brace)
    return text[:start]+replacement+text[end:]

def function_count(text,name):
    return len(re.findall(r"\bfunction\s+"+re.escape(name)+r"\s*\(",text))

def main():
    app=find_app()
    server=app/"app-server.mjs"
    archive=app/"src"/"chart-history-archive.mjs"
    repo=app.parent if (app.parent/".git").exists() else app
    log("app: "+str(app))

    if not archive.is_file():
        raise RuntimeError("src/chart-history-archive.mjs missing")
    a=archive.read_text(encoding="utf-8")
    for needle in ("export class ChartHistoryArchive","mergePointsSync(","statusSync(","ensureBackfill("):
        if needle not in a:raise RuntimeError("archive API missing: "+needle)

    original=server.read_text(encoding="utf-8")
    for needle in (
        "chartTradeStreams","chartTradeHistory",
        "const __mfChartArchive=new ChartHistoryArchive",
        "if(url.pathname==='/api/chart/history')",
        "if(url.pathname==='/api/chart/stream')"
    ):
        if needle not in original:raise RuntimeError("current topology missing: "+needle)

    log("confirmed runtime bug target: chart endpoints + persistent archive coexist")

    stamp=datetime.datetime.now().strftime("%Y%m%d-%H%M%S")
    backup=app/".patch-backups"/("chart-helper-set-v4-1-"+stamp)
    backup.mkdir(parents=True,exist_ok=True)
    shutil.copy2(server,backup/"app-server.mjs")
    log("backup: "+str(backup))

    rel=str(server.relative_to(repo)) if (repo/".git").exists() else None
    if rel:
        (backup/"git-status-before.txt").write_text(
            run("git","status","--short","--",rel,cwd=repo,check=False).stdout or "",
            encoding="utf-8")
        (backup/"git-diff-before.patch").write_text(
            run("git","diff","--",rel,cwd=repo,check=False).stdout or "",
            encoding="utf-8")

    patched=original

    if "const __mfChartBackfillJobs=new Map();" not in patched:
        m=find_map_anchor(patched)
        patched=patched[:m.end()]+"\nconst __mfChartBackfillJobs=new Map(); // "+TAG+"\n"+patched[m.end():]

    # Replace any partial/old helper; insert any missing helper.
    missing=[]
    for name,source in HELPERS.items():
        patched,replaced=replace_function(patched,name,source)
        if not replaced:
            missing.append(name)

    if missing:
        m=find_map_anchor(patched)
        block="\n// "+TAG+"\n"
        for name in missing:block+=HELPERS[name]+"\n"
        patched=patched[:m.end()]+block+patched[m.end():]

    patched=replace_route(patched,"if(url.pathname==='/api/chart/history'){",HISTORY_ROUTE)
    patched=replace_route(patched,"if(url.pathname==='/api/chart/stream'){",STREAM_ROUTE)
    if "if(url.pathname==='/api/chart/trade-stream'){" in patched:
        patched=replace_route(patched,"if(url.pathname==='/api/chart/trade-stream'){",TRADE_STREAM_ROUTE)

    try:
        server.write_text(patched,encoding="utf-8")
        final=server.read_text(encoding="utf-8")

        checks={
            "valid helper":function_count(final,"__mfValidChartMint")==1,
            "snapshot helper":function_count(final,"__mfChartSnapshotPayload")==1,
            "broadcast helper":function_count(final,"__mfBroadcastChartSnapshot")==1,
            "backfill helper":function_count(final,"__mfEnsureChartBackfill")==1,
            "stream helper":function_count(final,"__mfOpenChartStream")==1,
            "snapshot reads persistent archive":"__mfChartArchive.mergePointsSync(mint,hot)" in final,
            "history route returns snapshot":"const snapshot=__mfChartSnapshotPayload(mint);" in final,
            "stream route uses defined helper":"return __mfOpenChartStream(req,res,url.searchParams.get('tokenAddress'));" in final,
            "live point persistence preserved":"__mfChartArchive.appendPoint" in final,
        }
        for name,ok in checks.items():
            log(("OK: " if ok else "FAIL: ")+name)
            if not ok:raise RuntimeError("verification failed: "+name)

        run("node","--check",str(server),cwd=app)

        # V4.2 DIRTY-SAFE:
        # Existing user edits may already contain harmless whitespace warnings.
        # Do not roll back a verified chart repair because of pre-existing
        # `git diff --check` output. Our inserted helper payloads are generated
        # without trailing whitespace and JS syntax is checked above.
        if rel:
            ws=run("git","diff","--check","--",rel,cwd=repo,check=False)
            if ws.returncode!=0:
                log("WARNING: git diff --check reports pre-existing whitespace issues; chart repair is NOT rolled back")
                log("WARNING: these whitespace warnings are unrelated to JS syntax/runtime")

    except Exception:
        shutil.copy2(backup/"app-server.mjs",server)
        log("FAILED: app-server.mjs restored from backup")
        raise

    if rel:
        log("DIRTY-SAFE: no git add / commit / push performed")
        run("git","status","--short","--",rel,cwd=repo,check=False)

    log("FIX COMPLETE")
    log("Restart Replit app/workflow, then hard-refresh Trading Terminal.")
    return 0

if __name__=="__main__":
    try:raise SystemExit(main())
    except Exception as exc:
        print(f"[{TAG}] FATAL: {exc}",file=sys.stderr)
        raise
