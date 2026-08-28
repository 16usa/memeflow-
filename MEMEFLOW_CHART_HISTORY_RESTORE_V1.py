#!/usr/bin/env python3
from pathlib import Path
import datetime
import shutil
import subprocess
import sys

TAG = "MEMEFLOW-CHART-HISTORY-RESTORE-V1"
TARGET_BRANCH = "memeflow-logo-sync"
EXPECTED_REMOTE_FRAGMENT = "16usa/memeflow-"
EXPECTED_BASE_HEAD = "bd3fbf3eb05754a600e9f5bd695a149cf094d08e"
COMMIT_MESSAGE = "Restore persistent Trading chart history"

def log(message):
    print(f"[{TAG}] {message}", flush=True)

def run(*args, cwd=None, check=True):
    print("+", " ".join(args), flush=True)
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
            f"Command failed ({p.returncode}): {' '.join(args)}"
        )
    return p

def out(*args, cwd=None):
    p = run(*args, cwd=cwd, check=True)
    return (p.stdout or "").strip()

def fail(message, code=1):
    print(f"[{TAG}] ERROR: {message}", file=sys.stderr)
    return code

def main():
    try:
        root = Path(out("git", "rev-parse", "--show-toplevel")).resolve()
    except Exception:
        # Replit normally opens /home/runner/workspace, but keep a friendly fallback.
        root = Path("/home/runner/workspace").resolve()
        if not (root / ".git").exists():
            return fail("Git repository was not found.")

    app = root / "memeflow-app"
    server = app / "app-server.mjs"
    archive = app / "src" / "chart-history-archive.mjs"

    if not server.exists():
        return fail(f"Missing {server}")
    if not archive.exists():
        return fail(
            "Missing memeflow-app/src/chart-history-archive.mjs. "
            "The restore patch expects the existing V30.10/V30.12 archive module."
        )

    remote = out("git", "remote", "get-url", "origin", cwd=root)
    if EXPECTED_REMOTE_FRAGMENT not in remote:
        return fail(f"Unexpected origin: {remote}")

    branch = out("git", "branch", "--show-current", cwd=root)
    if branch != TARGET_BRANCH:
        return fail(
            f"Current branch is {branch!r}; expected {TARGET_BRANCH!r}. "
            "No files were changed."
        )

    rel_server = str(server.relative_to(root))
    rel_archive = str(archive.relative_to(root))

    # Do not overwrite unrelated local work in the only file we edit.
    worktree_dirty = run(
        "git", "diff", "--quiet", "--", rel_server,
        cwd=root, check=False
    ).returncode != 0
    index_dirty = run(
        "git", "diff", "--cached", "--quiet", "--", rel_server,
        cwd=root, check=False
    ).returncode != 0

    if worktree_dirty or index_dirty:
        print(out("git", "status", "--short", "--", rel_server, cwd=root))
        return fail(
            "app-server.mjs already has local/staged edits. "
            "Commit/stash them first; patch refused to layer over them."
        )

    run("git", "fetch", "origin", TARGET_BRANCH, cwd=root)

    local_head = out("git", "rev-parse", "HEAD", cwd=root)
    remote_head = out("git", "rev-parse", f"origin/{TARGET_BRANCH}", cwd=root)

    if local_head != remote_head:
        return fail(
            "Local branch is not at the current GitHub tip.\n"
            f"Local : {local_head}\n"
            f"Origin: {remote_head}\n"
            "Pull/sync the branch first. No files were changed."
        )

    if remote_head != EXPECTED_BASE_HEAD:
        return fail(
            "GitHub HEAD changed since this patch was prepared.\n"
            f"Expected: {EXPECTED_BASE_HEAD}\n"
            f"Actual  : {remote_head}\n"
            "No files were changed. Rebuild the patch against the new HEAD."
        )

    server_text = server.read_text(encoding="utf-8")

    if "MEMEFLOW_CHART_HISTORY_RESTORE_V1" in server_text:
        log("Patch marker already present; nothing to do.")
        return 0

    # The archive module itself survived in GitHub; verify it is the expected implementation.
    archive_text = archive.read_text(encoding="utf-8")
    archive_needles = [
        "export class ChartHistoryArchive",
        "mergePointsSync(",
        "appendPoint(",
        "ensureBackfill(",
    ]
    missing_archive = [x for x in archive_needles if x not in archive_text]
    if missing_archive:
        return fail(
            "Existing chart-history-archive.mjs is not the expected implementation: "
            + ", ".join(missing_archive)
        )

    stamp = datetime.datetime.now().strftime("%Y%m%d-%H%M%S")
    backup = app / ".patch-backups" / f"chart-history-restore-v1-{stamp}"
    backup.mkdir(parents=True, exist_ok=True)
    shutil.copy2(server, backup / "app-server.mjs")
    log(f"Backup: {backup}")

    def rollback():
        log("Rolling back app-server.mjs from backup.")
        shutil.copy2(backup / "app-server.mjs", server)

    try:
        # ------------------------------------------------------------------
        # 1) Reconnect the existing persistent ChartHistoryArchive to server.
        # ------------------------------------------------------------------
        import_anchor = (
            "import { startPumpLiveTradeFeed } from './src/pump-live-trade-feed.mjs'; "
            "// MEMEFLOW_V12_21_LIVE_TRADE_STREAM_HOLDER_FEED\n"
        )
        import_line = (
            "import { ChartHistoryArchive } from './src/chart-history-archive.mjs'; "
            "// MEMEFLOW_CHART_HISTORY_RESTORE_V1\n"
        )

        if import_anchor not in server_text:
            raise RuntimeError("Chart restore import anchor not found.")
        server_text = server_text.replace(
            import_anchor,
            import_anchor + import_line,
            1
        )

        rpc_anchor = (
            "const rpcUrls=(process.env.SOLANA_RPC_URLS||'').split(',')"
            ".map(x=>x.trim()).filter(Boolean),wsUrls=(process.env.SOLANA_WS_URLS||'')"
            ".split(',').map(x=>x.trim()).filter(Boolean);"
            "const rpc=new RpcPool(rpcUrls,process.env.SOLANA_COMMITMENT||'confirmed');\n"
        )

        rpc_insert = rpc_anchor + r"""// MEMEFLOW_CHART_HISTORY_RESTORE_V1
const __mfChartHistoryRpcUrls=(process.env.CHART_HISTORY_RPC_URLS||process.env.SOLANA_RPC_URLS||'')
  .split(',').map(x=>x.trim()).filter(Boolean);
const __mfChartHistoryRpc=new RpcPool(
  __mfChartHistoryRpcUrls,
  process.env.SOLANA_COMMITMENT||'confirmed'
);
__mfChartHistoryRpc.minIntervalMs=Math.max(
  250,
  Number(process.env.CHART_HISTORY_RPC_MIN_INTERVAL_MS||450)
);
__mfChartHistoryRpc.methodMinIntervalMs.getTransaction=Math.max(
  250,
  Number(process.env.CHART_HISTORY_GET_TRANSACTION_MIN_INTERVAL_MS||350)
);
const __mfChartArchive=new ChartHistoryArchive({
  dataDir,
  rpc:__mfChartHistoryRpc,
  pageSize:Number(process.env.CHART_HISTORY_PAGE_SIZE||1000),
  txConcurrency:Number(process.env.CHART_HISTORY_TX_CONCURRENCY||3)
});
"""

        if rpc_anchor not in server_text:
            raise RuntimeError("Chart restore RPC anchor not found.")
        server_text = server_text.replace(rpc_anchor, rpc_insert, 1)

        # ------------------------------------------------------------------
        # 2) Restore merged snapshot + historical backfill around the current
        #    chartTradeHistory/chartTradeStreams hot cache.
        # ------------------------------------------------------------------
        map_anchor = "const chartTradeStreams=new Map(),chartTradeHistory=new Map();\n"

        helpers = r"""const chartTradeStreams=new Map(),chartTradeHistory=new Map();

// MEMEFLOW_CHART_HISTORY_RESTORE_V1
// Trading chart source of truth:
//   persistent archive + bounded real-time Pump TradeEvent hot cache.
// This is display-only and does not change AI/risk/trading decisions.
const __mfChartBackfillJobs=new Map();

function __mfChartSnapshotPayload(mint){
  const hot=chartTradeHistory.get(mint)||[];
  let points=[];

  try{
    points=__mfChartArchive.mergePointsSync(mint,hot);
  }catch{
    points=Array.isArray(hot)?hot.slice():[];
  }

  // Never leave an already-selected token visually blank while historical
  // RPC sync starts. This one-point seed is only a temporary current-price
  // fallback; real Pump TradeEvents remain the candle source.
  if(!points.length){
    const token=store?.state?.tokens?.[mint]||null;
    const px=Number(token?.priceSol);
    if(Number.isFinite(px)&&px>0){
      const at=Number(token?.lastPriceAt||token?.updatedAt)||Date.now();
      points=[{
        t:at,
        price:px,
        priceSol:px,
        source:'current-price-seed',
        isBuy:false,
        solAmount:0,
        tokenAmount:0
      }];
    }
  }

  let archiveStatus={
    running:false,
    oldestComplete:false,
    lastError:null
  };
  try{
    archiveStatus=__mfChartArchive.statusSync(mint);
  }catch{}

  const last=points[points.length-1]||null;

  return {
    points,
    status:{
      stale:points.length===0,
      source:last?.source||'pump-trade-event',
      historyPoints:points.length,
      historyStartAt:points[0]?.t||null,
      historyEndAt:last?.t||null,
      backfillRunning:
        archiveStatus.running===true ||
        __mfChartBackfillJobs.has(mint),
      fullHistoryReady:archiveStatus.oldestComplete===true,
      backfillError:archiveStatus.lastError||null
    },
    tokenAddress:mint
  };
}

function __mfBroadcastChartSnapshot(mint){
  const listeners=chartTradeStreams.get(mint);
  if(!listeners?.size)return;

  const frame=
    `event: snapshot\n`+
    `data: ${JSON.stringify(__mfChartSnapshotPayload(mint))}\n\n`;

  for(const res of [...listeners]){
    try{
      res.write(frame);
    }catch{
      listeners.delete(res);
    }
  }
}

function __mfEnsureChartBackfill(mint){
  if(!mint||__mfChartBackfillJobs.has(mint))return;

  try{
    const status=__mfChartArchive.statusSync(mint);
    if(status?.oldestComplete===true)return;
  }catch{}

  const job=__mfChartArchive.ensureBackfill(mint,{
    onProgress:()=>__mfBroadcastChartSnapshot(mint)
  })
    .then(()=>{
      __mfBroadcastChartSnapshot(mint);
    })
    .catch(error=>{
      console.warn(
        '[chart-history] backfill',
        mint,
        error?.message||error
      );
      __mfBroadcastChartSnapshot(mint);
    })
    .finally(()=>{
      if(__mfChartBackfillJobs.get(mint)===job){
        __mfChartBackfillJobs.delete(mint);
      }
    });

  __mfChartBackfillJobs.set(mint,job);
}
"""

        if map_anchor not in server_text:
            raise RuntimeError("chartTradeStreams/chartTradeHistory anchor not found.")
        server_text = server_text.replace(map_anchor, helpers, 1)

        # ------------------------------------------------------------------
        # 3) Persist every accepted real Pump TradeEvent so a Replit/server
        #    restart no longer empties the chart.
        # ------------------------------------------------------------------
        publish_anchor = (
            "  const rows=chartTradeHistory.get(mint)||[];\n"
            "  rows.push(point);\n"
        )
        publish_insert = publish_anchor + r"""
  // MEMEFLOW_CHART_HISTORY_RESTORE_V1
  // Persist accepted real chart ticks independently from the bounded RAM cache.
  try{
    __mfChartArchive.appendPoint(mint,point);
  }catch{}
"""

        if publish_anchor not in server_text:
            raise RuntimeError("publishTrade persistence anchor not found.")
        server_text = server_text.replace(publish_anchor, publish_insert, 1)

        # ------------------------------------------------------------------
        # 4) Replace the regressed RAM-only /api/chart/trade-stream route.
        # ------------------------------------------------------------------
        route_start_token = " if(url.pathname==='/api/chart/trade-stream'){"
        route_start = server_text.find(route_start_token)
        if route_start < 0:
            raise RuntimeError("/api/chart/trade-stream route start not found.")

        route_end_candidates = [
            "\n\n // MEMEFLOW_LIVE_SYSTEM_SSE_BACKEND_V4_ROUTE",
            "\n // MEMEFLOW_LIVE_SYSTEM_SSE_BACKEND_V4_ROUTE",
            "\n\n if(url.pathname==='/api/chart/stream')",
            "\n if(url.pathname==='/api/chart/stream')",
        ]
        route_end = -1
        for token in route_end_candidates:
            pos = server_text.find(token, route_start)
            if pos >= 0:
                route_end = pos
                break

        if route_end < 0:
            raise RuntimeError("/api/chart/trade-stream route end anchor not found.")

        current_route = server_text[route_start:route_end]
        required_old_route = [
            "chartTradeStreams",
            "chartTradeHistory",
            "event: snapshot",
            "points",
        ]
        if not all(x in current_route for x in required_old_route):
            raise RuntimeError(
                "Current /api/chart/trade-stream no longer matches the "
                "RAM-only route this patch was built against."
            )

        restored_route = r""" if(url.pathname==='/api/chart/trade-stream'){
  const mint=String(url.searchParams.get('tokenAddress')||'').trim();

  if(!validPubkey(mint)){
    return json(res,400,{error:'INVALID_TOKEN_ADDRESS'});
  }

  if(!chartTradeStreams.has(mint)){
    chartTradeStreams.set(mint,new Set());
  }
  if(!chartTradeHistory.has(mint)){
    chartTradeHistory.set(mint,[]);
  }

  res.writeHead(200,{
    'content-type':'text/event-stream; charset=utf-8',
    'cache-control':'no-cache, no-store, no-transform',
    'connection':'keep-alive',
    'x-accel-buffering':'no'
  });
  try{res.flushHeaders?.()}catch{}

  res.write('retry: 1000\n');
  res.write(
    `event: snapshot\n`+
    `data: ${JSON.stringify(__mfChartSnapshotPayload(mint))}\n\n`
  );

  const listeners=chartTradeStreams.get(mint);
  listeners.add(res);

  // History sync must never block opening Trading Terminal.
  queueMicrotask(()=>__mfEnsureChartBackfill(mint));

  const heartbeat=setInterval(()=>{
    try{
      res.write(`: chart ${Date.now()}\n\n`);
    }catch{}
  },15000);
  heartbeat.unref?.();

  let closed=false;
  const closeChartTradeStream=()=>{
    if(closed)return;
    closed=true;
    clearInterval(heartbeat);
    listeners.delete(res);
  };

  req.on('close',closeChartTradeStream);
  res.on('close',closeChartTradeStream);
  return
}"""

        server_text = (
            server_text[:route_start]
            + restored_route
            + server_text[route_end:]
        )

        server.write_text(server_text, encoding="utf-8")

        # ------------------------------------------------------------------
        # Static / syntax validation before commit.
        # ------------------------------------------------------------------
        final_server = server.read_text(encoding="utf-8")
        semantic_checks = {
            "archive import":
                "import { ChartHistoryArchive } from './src/chart-history-archive.mjs';"
                in final_server,
            "archive instance":
                "const __mfChartArchive=new ChartHistoryArchive" in final_server,
            "merged archive + hot cache":
                "__mfChartArchive.mergePointsSync(mint,hot)" in final_server,
            "live persistence":
                "__mfChartArchive.appendPoint(mint,point)" in final_server,
            "async historical backfill":
                "__mfEnsureChartBackfill(mint)" in final_server,
            "persistent route snapshot":
                "__mfChartSnapshotPayload(mint)" in final_server,
            "SSE heartbeat":
                "res.write(`: chart ${Date.now()}\\n\\n`)" in final_server,
            "restore marker":
                "MEMEFLOW_CHART_HISTORY_RESTORE_V1" in final_server,
        }

        for name, ok in semantic_checks.items():
            log(f"{'OK' if ok else 'FAIL'}: {name}")
            if not ok:
                raise RuntimeError(f"Post-patch semantic check failed: {name}")

        run("node", "--check", rel_archive, cwd=root)
        run("node", "--check", rel_server, cwd=root)
        run("git", "diff", "--check", "--", rel_server, cwd=root)

    except Exception:
        rollback()
        raise

    # Show exactly what will be committed.
    run("git", "diff", "--stat", "--", rel_server, cwd=root)
    run("git", "diff", "--", rel_server, cwd=root)

    run("git", "add", rel_server, cwd=root)

    if run("git", "diff", "--cached", "--quiet", cwd=root, check=False).returncode == 0:
        log("No staged changes; nothing to commit.")
        return 0

    run("git", "commit", "-m", COMMIT_MESSAGE, cwd=root)
    run("git", "push", "-u", "origin", TARGET_BRANCH, cwd=root)

    new_head = out("git", "rev-parse", "HEAD", cwd=root)
    log("INSTALL + CHECK + COMMIT + PUSH COMPLETE")
    log(f"branch: {TARGET_BRANCH}")
    log(f"commit: {new_head}")
    log(f"backup: {backup}")
    log(
        "Restart the Replit workflow/app and hard-refresh Trading Terminal. "
        "On first open the feed may show HISTORY SYNC, then LIVE · FULL HISTORY."
    )
    return 0

if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(f"[{TAG}] FATAL: {exc}", file=sys.stderr)
        raise
