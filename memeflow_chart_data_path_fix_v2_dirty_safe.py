#!/usr/bin/env python3
from pathlib import Path
import datetime
import re
import shutil
import subprocess
import sys

TAG = "MEMEFLOW_CHART_DATA_PATH_FIX_V2_DIRTY_SAFE"

def log(msg):
    print(f"[{TAG}] {msg}", flush=True)

def run(*args, cwd=None, check=True):
    p = subprocess.run(args, cwd=cwd, text=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
    if p.stdout:
        print(p.stdout, end="" if p.stdout.endswith("\n") else "\n")
    if check and p.returncode != 0:
        raise RuntimeError(f"command failed ({p.returncode}): {' '.join(args)}")
    return p

def find_app():
    cwd = Path.cwd().resolve()
    candidates = [
        cwd,
        cwd / "memeflow-app",
        Path.home() / "workspace" / "memeflow-app",
        Path("/home/runner/workspace/memeflow-app"),
    ]
    for app in candidates:
        if (app / "app-server.mjs").exists():
            return app.resolve()
    raise RuntimeError("memeflow-app/app-server.mjs not found")

def replace_js_block(text, start_token, replacement):
    start = text.find(start_token)
    if start < 0:
        raise RuntimeError(f"route not found: {start_token}")
    brace = text.find("{", start)
    if brace < 0:
        raise RuntimeError(f"opening brace not found: {start_token}")

    depth = 0
    quote = None
    escape = False
    line_comment = False
    block_comment = False
    i = brace
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
                end = i + 1
                return text[:start] + replacement + text[end:]
        i += 1

    raise RuntimeError(f"closing brace not found: {start_token}")

def main():
    app = find_app()
    server = app / "app-server.mjs"
    archive = app / "src" / "chart-history-archive.mjs"
    repo = app.parent if (app.parent / ".git").exists() else app

    log(f"app: {app}")

    if not archive.exists():
        raise RuntimeError(
            "src/chart-history-archive.mjs is missing. Refusing a partial repair; "
            "the persistent history module must be restored first."
        )

    archive_text = archive.read_text(encoding="utf-8")
    for needle in ("export class ChartHistoryArchive", "mergePointsSync(", "appendPoint(", "ensureBackfill("):
        if needle not in archive_text:
            raise RuntimeError(f"chart-history-archive.mjs is not the expected module: missing {needle}")

    # DIRTY-SAFE MODE:
    # The current Replit app-server.mjs may contain important uncommitted work.
    # Do NOT stash/reset/commit it. Preserve the exact file + git diffs first,
    # then make only surgical chart-data-path edits below.
    rel = str(server.relative_to(repo)) if (repo / ".git").exists() else None
    dirty = False
    staged = False
    if rel:
        dirty = run("git", "diff", "--quiet", "--", rel, cwd=repo, check=False).returncode != 0
        staged = run("git", "diff", "--cached", "--quiet", "--", rel, cwd=repo, check=False).returncode != 0
        if dirty or staged:
            log("app-server.mjs has existing uncommitted edits; DIRTY-SAFE mode will preserve them")
            run("git", "status", "--short", "--", rel, cwd=repo, check=False)

    original = server.read_text(encoding="utf-8")
    if TAG in original:
        log("patch marker already present; running verification only")
        patched = original
    else:
        # Confirm the exact regression observed in Shell before editing.
        if "if(url.pathname==='/api/chart/history')" not in original:
            raise RuntimeError("/api/chart/history route not found")
        if "if(url.pathname==='/api/chart/stream')" not in original:
            raise RuntimeError("/api/chart/stream route not found")
        if "chartTradeHistory" not in original or "chartTradeStreams" not in original:
            raise RuntimeError("chartTradeHistory/chartTradeStreams topology not found")

        stamp = datetime.datetime.now().strftime("%Y%m%d-%H%M%S")
        backup = app / ".patch-backups" / f"chart-data-path-fix-v2-dirty-safe-{stamp}"
        backup.mkdir(parents=True, exist_ok=True)
        shutil.copy2(server, backup / "app-server.mjs")
        if rel:
            try:
                (backup / "git-status-before.txt").write_text(
                    run("git", "status", "--short", "--", rel, cwd=repo, check=False).stdout or "",
                    encoding="utf-8"
                )
                (backup / "git-diff-before.patch").write_text(
                    run("git", "diff", "--", rel, cwd=repo, check=False).stdout or "",
                    encoding="utf-8"
                )
                (backup / "git-diff-cached-before.patch").write_text(
                    run("git", "diff", "--cached", "--", rel, cwd=repo, check=False).stdout or "",
                    encoding="utf-8"
                )
            except Exception:
                pass
        log(f"backup: {backup}")

        patched = original

        # 1. Reconnect the existing persistent history module.
        import_line = (
            "import { ChartHistoryArchive } from './src/chart-history-archive.mjs'; "
            f"// {TAG}\n"
        )
        if "import { ChartHistoryArchive } from './src/chart-history-archive.mjs';" not in patched:
            lines = patched.splitlines(keepends=True)
            last_import = -1
            for idx, line in enumerate(lines):
                if line.lstrip().startswith("import "):
                    last_import = idx
            if last_import < 0:
                raise RuntimeError("no import section found")
            lines.insert(last_import + 1, import_line)
            patched = "".join(lines)
        elif TAG not in patched:
            # Add marker separately when import already exists from an older build.
            patched = patched.replace(
                "import { ChartHistoryArchive } from './src/chart-history-archive.mjs';",
                "import { ChartHistoryArchive } from './src/chart-history-archive.mjs'; " + f"// {TAG}",
                1,
            )

        # 2. Create a dedicated low-priority RPC pool for historical backfill.
        if "const __mfChartArchive=new ChartHistoryArchive" not in patched:
            rpc_match = re.search(
                r"const\s+rpc\s*=\s*new\s+RpcPool\(\s*rpcUrls\s*,\s*process\.env\.SOLANA_COMMITMENT\s*\|\|\s*'confirmed'\s*\)\s*;",
                patched,
            )
            if not rpc_match:
                raise RuntimeError("current RpcPool initialization anchor changed; no files were written")
            rpc_anchor = rpc_match.group(0)
            rpc_block = rpc_anchor + f"""\n// {TAG}\nconst __mfChartHistoryRpcUrls=(process.env.CHART_HISTORY_RPC_URLS||process.env.SOLANA_RPC_URLS||'')\n  .split(',').map(x=>x.trim()).filter(Boolean);\nconst __mfChartHistoryRpc=new RpcPool(\n  __mfChartHistoryRpcUrls,\n  process.env.SOLANA_COMMITMENT||'confirmed'\n);\ntry{{\n  __mfChartHistoryRpc.minIntervalMs=Math.max(\n    250,\n    Number(process.env.CHART_HISTORY_RPC_MIN_INTERVAL_MS||450)\n  );\n  if(__mfChartHistoryRpc.methodMinIntervalMs instanceof Map){{\n    __mfChartHistoryRpc.methodMinIntervalMs.set(\n      'getTransaction',\n      Math.max(250,Number(process.env.CHART_HISTORY_GET_TRANSACTION_MIN_INTERVAL_MS||350))\n    );\n  }}else if(__mfChartHistoryRpc.methodMinIntervalMs&&typeof __mfChartHistoryRpc.methodMinIntervalMs==='object'){{\n    __mfChartHistoryRpc.methodMinIntervalMs.getTransaction=Math.max(\n      250,Number(process.env.CHART_HISTORY_GET_TRANSACTION_MIN_INTERVAL_MS||350)\n    );\n  }}\n}}catch{{}}\nconst __mfChartArchive=new ChartHistoryArchive({{\n  dataDir,\n  rpc:__mfChartHistoryRpc,\n  pageSize:Number(process.env.CHART_HISTORY_PAGE_SIZE||1000),\n  txConcurrency:Number(process.env.CHART_HISTORY_TX_CONCURRENCY||3)\n}});\n"""
            patched = patched[:rpc_match.start()] + rpc_block + patched[rpc_match.end():]

        # 3. Merge persistent history with the real TradeEvent hot cache and make
        # both chart endpoints use the same source of truth.
        if "function __mfChartSnapshotPayload(mint)" not in patched:
            map_match = re.search(
                r"const\s+chartTradeStreams\s*=\s*new Map\(\)\s*,\s*chartTradeHistory\s*=\s*new Map\(\)\s*;\s*\n",
                patched,
            )
            if not map_match:
                raise RuntimeError("chartTradeStreams/chartTradeHistory declaration anchor changed")
            map_decl = map_match.group(0)
            helpers = map_decl + f"""\n// {TAG}\n// Display-only chart data path. It does not change AI/risk/execution decisions.\nconst __mfChartBackfillJobs=new Map();\n\nfunction __mfValidChartMint(value){{\n  return /^[1-9A-HJ-NP-Za-km-z]{{32,64}}$/.test(String(value||'').trim());\n}}\n\nfunction __mfChartSnapshotPayload(mint){{\n  mint=String(mint||'').trim();\n  const hot=chartTradeHistory.get(mint)||[];\n  let points=[];\n\n  try{{\n    points=__mfChartArchive.mergePointsSync(mint,hot);\n  }}catch{{\n    points=Array.isArray(hot)?hot.slice():[];\n  }}\n\n  // Never leave a selected token completely blank while history sync starts.\n  // This seed is replaced/augmented by canonical Pump TradeEvents.\n  if(!points.length){{\n    const token=store?.state?.tokens?.[mint]||null;\n    const px=Number(token?.priceSol);\n    if(Number.isFinite(px)&&px>0){{\n      const at=Number(token?.lastPriceAt||token?.updatedAt)||Date.now();\n      points=[{{\n        t:at,\n        price:px,\n        priceSol:px,\n        markPrice:px,\n        source:'current-price-seed',\n        isBuy:false,\n        solAmount:0,\n        tokenAmount:0\n      }}];\n    }}\n  }}\n\n  let archiveStatus={{running:false,oldestComplete:false,lastError:null}};\n  try{{archiveStatus=__mfChartArchive.statusSync(mint)}}catch{{}}\n  const last=points[points.length-1]||null;\n\n  return {{\n    points,\n    status:{{\n      stale:points.length===0,\n      source:last?.source||'pump-trade-event',\n      historyPoints:points.length,\n      historyStartAt:points[0]?.t||null,\n      historyEndAt:last?.t||null,\n      backfillRunning:archiveStatus.running===true||__mfChartBackfillJobs.has(mint),\n      fullHistoryReady:archiveStatus.oldestComplete===true,\n      backfillError:archiveStatus.lastError||null,\n      persistentHistory:true\n    }},\n    tokenAddress:mint\n  }};\n}}\n\nfunction __mfBroadcastChartSnapshot(mint){{\n  const listeners=chartTradeStreams.get(mint);\n  if(!listeners?.size)return;\n  const frame=`event: snapshot\\n`+`data: ${{JSON.stringify(__mfChartSnapshotPayload(mint))}}\\n\\n`;\n  for(const res of [...listeners]){{\n    try{{res.write(frame)}}catch{{listeners.delete(res)}}\n  }}\n}}\n\nfunction __mfEnsureChartBackfill(mint){{\n  mint=String(mint||'').trim();\n  if(!__mfValidChartMint(mint)||__mfChartBackfillJobs.has(mint))return;\n  try{{\n    const status=__mfChartArchive.statusSync(mint);\n    if(status?.oldestComplete===true)return;\n  }}catch{{}}\n\n  const job=__mfChartArchive.ensureBackfill(mint,{{\n    onProgress:()=>__mfBroadcastChartSnapshot(mint)\n  }})\n    .then(()=>__mfBroadcastChartSnapshot(mint))\n    .catch(error=>{{\n      console.warn('[chart-history]',mint,error?.message||error);\n      __mfBroadcastChartSnapshot(mint);\n    }})\n    .finally(()=>{{\n      if(__mfChartBackfillJobs.get(mint)===job)__mfChartBackfillJobs.delete(mint);\n    }});\n\n  __mfChartBackfillJobs.set(mint,job);\n}}\n\nfunction __mfOpenChartStream(req,res,mint){{\n  mint=String(mint||'').trim();\n  if(!__mfValidChartMint(mint)){{\n    return json(res,400,{{error:'INVALID_TOKEN_ADDRESS'}});\n  }}\n\n  if(!chartTradeStreams.has(mint))chartTradeStreams.set(mint,new Set());\n  if(!chartTradeHistory.has(mint))chartTradeHistory.set(mint,[]);\n\n  res.writeHead(200,{{\n    'content-type':'text/event-stream; charset=utf-8',\n    'cache-control':'no-cache, no-store, no-transform',\n    'connection':'keep-alive',\n    'x-accel-buffering':'no'\n  }});\n  try{{res.flushHeaders?.()}}catch{{}}\n  res.write('retry: 1000\\n');\n  res.write(`event: snapshot\\n`+`data: ${{JSON.stringify(__mfChartSnapshotPayload(mint))}}\\n\\n`);\n\n  const listeners=chartTradeStreams.get(mint);\n  listeners.add(res);\n  queueMicrotask(()=>__mfEnsureChartBackfill(mint));\n\n  const heartbeat=setInterval(()=>{{\n    try{{res.write(`: chart ${{Date.now()}}\\n\\n`)}}catch{{}}\n  }},15000);\n  heartbeat.unref?.();\n\n  let closed=false;\n  const close=()=>{{\n    if(closed)return;\n    closed=true;\n    clearInterval(heartbeat);\n    listeners.delete(res);\n  }};\n  req.on('close',close);\n  res.on('close',close);\n  return;\n}}\n\n"""
            patched = patched[:map_match.start()] + helpers + patched[map_match.end():]

        # 4. Persist every accepted real chart TradeEvent before RAM trimming.
        if "__mfChartArchive.appendPoint(mint,point)" not in patched:
            persist_match = re.search(
                r"(?P<indent>[ \t]*)const\s+rows\s*=\s*chartTradeHistory\.get\(mint\)\|\|\[\];\s*\n(?P=indent)rows\.push\(point\);",
                patched,
            )
            if not persist_match:
                raise RuntimeError("real TradeEvent history append anchor not found")
            indent = persist_match.group("indent")
            old = persist_match.group(0)
            new = old + f"\n{indent}// {TAG}: persist accepted real chart ticks across restarts.\n{indent}try{{__mfChartArchive.appendPoint(mint,point)}}catch{{}}"
            patched = patched[:persist_match.start()] + new + patched[persist_match.end():]

        # 5. Replace the one-point history route with the merged persistent snapshot.
        history_route = f"""if(url.pathname==='/api/chart/history'){{\n  const mint=String(url.searchParams.get('tokenAddress')||'').trim();\n  if(!__mfValidChartMint(mint))return json(res,400,{{error:'INVALID_TOKEN_ADDRESS'}});\n  const snapshot=__mfChartSnapshotPayload(mint);\n  queueMicrotask(()=>__mfEnsureChartBackfill(mint));\n  return json(res,200,snapshot);\n}}"""
        patched = replace_js_block(
            patched,
            "if(url.pathname==='/api/chart/history'){",
            history_route,
        )

        # 6. Both old and current frontend endpoints now attach to the SAME real
        # TradeEvent stream and receive the same persistent snapshot.
        trade_stream_route = """if(url.pathname==='/api/chart/trade-stream'){
  return __mfOpenChartStream(req,res,url.searchParams.get('tokenAddress'));
}"""
        if "if(url.pathname==='/api/chart/trade-stream'){" in patched:
            patched = replace_js_block(
                patched,
                "if(url.pathname==='/api/chart/trade-stream'){",
                trade_stream_route,
            )

        stream_route = """if(url.pathname==='/api/chart/stream'){
  return __mfOpenChartStream(req,res,url.searchParams.get('tokenAddress'));
}"""
        patched = replace_js_block(
            patched,
            "if(url.pathname==='/api/chart/stream'){",
            stream_route,
        )

        # Write only after every anchor succeeded.
        server.write_text(patched, encoding="utf-8")

    # Verification. If anything fails and we have a backup, restore it.
    try:
        final = server.read_text(encoding="utf-8")
        checks = {
            "archive import": "import { ChartHistoryArchive } from './src/chart-history-archive.mjs';" in final,
            "archive instance": "const __mfChartArchive=new ChartHistoryArchive" in final,
            "merged snapshot": "__mfChartArchive.mergePointsSync(mint,hot)" in final,
            "persistent live append": "__mfChartArchive.appendPoint(mint,point)" in final,
            "history backfill": "__mfEnsureChartBackfill(mint)" in final,
            "history endpoint fixed": "const snapshot=__mfChartSnapshotPayload(mint);" in final,
            "stream endpoint fixed": "return __mfOpenChartStream(req,res,url.searchParams.get('tokenAddress'));" in final,
            "empty stub removed": "JSON.stringify({points:[],status:{stale:true,source:'Solana'}})" not in final,
            "marker": TAG in final,
        }
        for name, ok in checks.items():
            log(f"{'OK' if ok else 'FAIL'}: {name}")
            if not ok:
                raise RuntimeError(f"verification failed: {name}")

        run("node", "--check", str(archive), cwd=app)
        run("node", "--check", str(server), cwd=app)
        if (repo / ".git").exists():
            run("git", "diff", "--check", "--", str(server.relative_to(repo)), cwd=repo)
    except Exception:
        # Roll back only when this invocation actually created a backup.
        if 'backup' in locals() and (backup / "app-server.mjs").exists():
            shutil.copy2(backup / "app-server.mjs", server)
            log("verification failed; app-server.mjs restored from backup")
        raise

    # IMPORTANT: do not stage/commit/push automatically in DIRTY-SAFE mode.
    # Existing uncommitted app-server work belongs to the user and must not be
    # mixed into an automatic commit. The exact pre-repair file/diff is in backup.
    if rel:
        log("DIRTY-SAFE: no git add/commit/push was performed")
        run("git", "status", "--short", "--", rel, cwd=repo, check=False)
        try:
            if 'backup' in locals():
                (backup / "git-diff-after.patch").write_text(
                    run("git", "diff", "--", rel, cwd=repo, check=False).stdout or "",
                    encoding="utf-8"
                )
        except Exception:
            pass

    log("FIX COMPLETE")
    log("Restart the Replit app/workflow, then hard-refresh Trading Terminal.")
    log("Existing uncommitted app-server edits were NOT discarded, stashed, staged, or committed.")
    log("Expected: first snapshot contains points/current seed; history then fills asynchronously.")
    return 0

if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(f"[{TAG}] FATAL: {exc}", file=sys.stderr)
        raise
