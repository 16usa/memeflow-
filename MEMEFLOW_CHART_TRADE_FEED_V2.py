#!/usr/bin/env python3
from pathlib import Path
import datetime
import shutil
import subprocess
import sys

TAG = "MEMEFLOW-CHART-TRADE-FEED-V2"
TARGET_BRANCH = "memeflow-logo-sync"
EXPECTED_REMOTE_FRAGMENT = "16usa/memeflow-"
EXPECTED_BASE_HEAD = "0077454fd2198c2cd45904dc05c6ef8e9179d1f7"
COMMIT_MESSAGE = "Fix Trading chart real trade feed"

TARGETS = [
    "memeflow-app/src/pump-live-trade-feed.mjs",
    "memeflow-app/app-server.mjs",
    "memeflow-app/trading.js",
]

def log(msg):
    print(f"[{TAG}] {msg}", flush=True)

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
        raise RuntimeError(f"Command failed ({p.returncode}): {' '.join(args)}")
    return p

def out(*args, cwd=None):
    return (run(*args, cwd=cwd).stdout or "").strip()

def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: expected exactly 1 match, found {count}")
    return text.replace(old, new, 1)

def main():
    root = Path(out("git", "rev-parse", "--show-toplevel")).resolve()
    remote = out("git", "remote", "get-url", "origin", cwd=root)
    if EXPECTED_REMOTE_FRAGMENT not in remote:
        raise RuntimeError(f"Unexpected origin: {remote}")

    branch = out("git", "branch", "--show-current", cwd=root)
    if branch != TARGET_BRANCH:
        raise RuntimeError(
            f"Wrong branch {branch!r}; expected {TARGET_BRANCH!r}. "
            "No files were changed."
        )

    paths = [root / rel for rel in TARGETS]
    for path in paths:
        if not path.is_file():
            raise RuntimeError(f"Missing target: {path}")

    # Refuse to layer over unrelated local/staged edits in our targets.
    dirty = out("git", "status", "--porcelain", "--", *TARGETS, cwd=root)
    if dirty:
        raise RuntimeError(
            "Target files already have local/staged edits. "
            "Commit/stash them first:\n" + dirty
        )

    run("git", "fetch", "origin", TARGET_BRANCH, cwd=root)
    local_head = out("git", "rev-parse", "HEAD", cwd=root)
    remote_head = out("git", "rev-parse", f"origin/{TARGET_BRANCH}", cwd=root)

    if local_head != remote_head:
        raise RuntimeError(
            "Local branch is not synced with GitHub.\n"
            f"Local : {local_head}\n"
            f"Origin: {remote_head}\n"
            "No files were changed."
        )

    if remote_head != EXPECTED_BASE_HEAD:
        raise RuntimeError(
            "GitHub HEAD changed since this patch was prepared.\n"
            f"Expected: {EXPECTED_BASE_HEAD}\n"
            f"Actual  : {remote_head}\n"
            "No files were changed. Build a fresh patch against the new HEAD."
        )

    pump_path = root / TARGETS[0]
    server_path = root / TARGETS[1]
    trading_path = root / TARGETS[2]

    pump = pump_path.read_text(encoding="utf-8")
    server = server_path.read_text(encoding="utf-8")
    trading = trading_path.read_text(encoding="utf-8")

    if "MEMEFLOW_CHART_TRADE_FEED_V2" in pump or "MEMEFLOW_CHART_TRADE_FEED_V2" in server:
        log("V2 marker already present; nothing to do.")
        return 0

    stamp = datetime.datetime.now().strftime("%Y%m%d-%H%M%S")
    backup = root / "memeflow-app" / ".patch-backups" / f"chart-trade-feed-v2-{stamp}"
    backup.mkdir(parents=True, exist_ok=True)
    for src in paths:
        shutil.copy2(src, backup / src.name)
    log(f"Backup: {backup}")

    def rollback():
        log("Rolling back target files.")
        for src in paths:
            saved = backup / src.name
            if saved.exists():
                shutil.copy2(saved, src)

    try:
        # ================================================================
        # 1) PUMP LIVE TRADE FEED:
        # Centralize decoding and deduplicate the same TradeEvent when it is
        # received from both the dedicated WS and the already-connected
        # discovery WS.
        # ================================================================
        metrics_old = """    evaluationCalls:0,evaluationResolved:0,evaluationRejected:0,evaluationNullResults:0,
    evaluationDecisionLikeResults:0,lastEvaluationMint:null,lastEvaluationTrigger:null,
    lastEvaluationAt:null,lastEvaluationResultType:null,lastEvaluationError:null
  };"""

        metrics_new = """    evaluationCalls:0,evaluationResolved:0,evaluationRejected:0,evaluationNullResults:0,
    evaluationDecisionLikeResults:0,lastEvaluationMint:null,lastEvaluationTrigger:null,
    lastEvaluationAt:null,lastEvaluationResultType:null,lastEvaluationError:null,
    // MEMEFLOW_CHART_TRADE_FEED_V2
    logBatchesIngested:0,externalLogBatches:0,dedicatedLogBatches:0,
    duplicateTradeEventsSkipped:0,lastTradeEventAt:null,lastTradeEventSource:null
  };"""
        pump = replace_once(pump, metrics_old, metrics_new, "pump metrics")

        state_old = """  const mintCounts=new Map(), users=new Set(), pressure=new Map();
  let ws=null,stopped=false,idx=0,reconnectTimer=null;"""

        state_new = """  const mintCounts=new Map(), users=new Set(), pressure=new Map();
  // MEMEFLOW_CHART_TRADE_FEED_V2
  // A provider may limit concurrent logsSubscribe sockets. The same Pump
  // notification can therefore arrive through the dedicated trade socket,
  // the discovery socket, or both. Keep one canonical event per signature/log.
  const seenTradeEvents=new Map();
  let ws=null,stopped=false,idx=0,reconnectTimer=null;"""
        pump = replace_once(pump, state_old, state_new, "pump runtime state")

        apply_anchor = """  function applyEvent(e){
    metrics.tradeEventsDecoded++;"""

        ingest_block = r"""  // MEMEFLOW_CHART_TRADE_FEED_V2
  function tradeEventKey(e,signature,index){
    const sig=String(signature||'').trim();
    if(sig)return `${sig}:${Number(index)||0}`;

    return [
      e?.mint||'',
      e?.user||'',
      e?.isBuy===true?'B':'S',
      String(e?.timestamp??''),
      String(e?.solAmount??''),
      String(e?.tokenAmount??'')
    ].join('|');
  }

  function acceptTradeEventKey(key){
    if(!key)return true;
    if(seenTradeEvents.has(key))return false;

    seenTradeEvents.set(key,Date.now());

    // Bounded insertion-order cache. Enough for many minutes of Pump traffic
    // without unbounded process memory.
    while(seenTradeEvents.size>25000){
      const oldest=seenTradeEvents.keys().next().value;
      if(oldest===undefined)break;
      seenTradeEvents.delete(oldest);
    }
    return true;
  }

  function ingestLogs(logs,{signature=null,source='external'}={}){
    const rows=Array.isArray(logs)?logs:[];
    if(!rows.length)return 0;

    metrics.logBatchesIngested++;
    if(source==='dedicated-ws')metrics.dedicatedLogBatches++;
    else metrics.externalLogBatches++;

    let accepted=0;

    for(let i=0;i<rows.length;i++){
      const b=programData(rows[i]);
      if(!b)continue;

      metrics.programDataSeen++;

      try{
        const e=decodeTradeEvent(b);
        if(!e)continue;

        const key=tradeEventKey(e,signature,i);
        if(!acceptTradeEventKey(key)){
          metrics.duplicateTradeEventsSkipped++;
          continue;
        }

        metrics.lastTradeEventAt=Date.now();
        metrics.lastTradeEventSource=source;
        applyEvent(e);
        accepted++;
      }catch(err){
        metrics.decodeErrors++;
        metrics.lastError='decode:'+String(err?.message||err);
      }
    }

    return accepted;
  }

  function applyEvent(e){
    metrics.tradeEventsDecoded++;"""
        pump = replace_once(pump, apply_anchor, ingest_block, "pump ingest helper")

        onmessage_old = r"""      ws.onmessage=ev=>{
        try{
          const j=JSON.parse(typeof ev.data==='string'?ev.data:String(ev.data));
          const value=j?.params?.result?.value;
          if(!value||value.err)return;
          metrics.notifications++;
          for(const log of value.logs||[]){
            const b=programData(log);
            if(!b)continue;
            metrics.programDataSeen++;
            try{
              const e=decodeTradeEvent(b);
              if(e)applyEvent(e);
            }catch(err){
              metrics.decodeErrors++;
              metrics.lastError='decode:'+String(err?.message||err);
            }
          }
        }catch(err){
          metrics.decodeErrors++;
          metrics.lastError='ws-message:'+String(err?.message||err);
        }
      };"""

        onmessage_new = r"""      ws.onmessage=ev=>{
        try{
          const j=JSON.parse(typeof ev.data==='string'?ev.data:String(ev.data));
          const value=j?.params?.result?.value;
          if(!value||value.err)return;
          metrics.notifications++;
          ingestLogs(value.logs||[],{
            signature:value.signature||null,
            source:'dedicated-ws'
          });
        }catch(err){
          metrics.decodeErrors++;
          metrics.lastError='ws-message:'+String(err?.message||err);
        }
      };"""
        pump = replace_once(pump, onmessage_old, onmessage_new, "dedicated WS onmessage")

        return_old = """  return {
    metrics:()=>({...metrics,queueDepth:0,active:0,httpRpcCalls:0,evaluationRecent:Array.from(__v1226EvalByMint.values()).slice(-12)}),
    stop:()=>{stopped=true;clearTimeout(reconnectTimer);try{ws?.close?.()}catch{}}
  };"""

        return_new = """  return {
    // MEMEFLOW_CHART_TRADE_FEED_V2
    // Allows the main discovery socket to feed the exact same decoder. This
    // removes the chart's dependency on a second successful WS connection.
    ingestLogs,
    metrics:()=>({...metrics,queueDepth:0,active:0,httpRpcCalls:0,evaluationRecent:Array.from(__v1226EvalByMint.values()).slice(-12)}),
    stop:()=>{stopped=true;clearTimeout(reconnectTimer);try{ws?.close?.()}catch{}}
  };"""
        pump = replace_once(pump, return_old, return_new, "pump returned API")

        # ================================================================
        # 2) APP SERVER:
        # Fan every Pump logsSubscribe notification from the discovery socket
        # into the trade decoder BEFORE the Create-only discovery filter.
        # The trade module deduplicates if the dedicated WS received it too.
        # ================================================================
        discovery_old = """        const logs=m.params?.result?.value?.logs;
        if(!Array.isArray(logs)){discMetrics.eventsWithoutLogs++;discMetrics.eventsFiltered++;return}
        // Accept only Pump.fun token creation instructions; drop Buy/Sell/Withdraw/Migrate/etc.
        const isCreate=logs.some(l=>/Instruction:\\s*Create(?:V2|\\s+V2|\\s*$)/i.test(l));"""

        discovery_new = """        const logs=m.params?.result?.value?.logs;
        if(!Array.isArray(logs)){discMetrics.eventsWithoutLogs++;discMetrics.eventsFiltered++;return}

        // MEMEFLOW_CHART_TRADE_FEED_V2
        // Reuse the already-connected discovery Pump logsSubscribe as a
        // redundant source of canonical TradeEvents. The decoder itself
        // deduplicates signature/log pairs if the dedicated trade WS also
        // received the same notification.
        try{
          __pumpLiveTradeFeed?.ingestLogs?.(logs,{
            signature:String(sig||''),
            source:'discovery-ws'
          });
        }catch{}

        // Accept only Pump.fun token creation instructions for DISCOVERY work.
        // Trade decoding above is read-only for discovery and does not enqueue
        // Buy/Sell/Withdraw/Migrate transactions into the create pipeline.
        const isCreate=logs.some(l=>/Instruction:\\s*Create(?:V2|\\s+V2|\\s*$)/i.test(l));"""
        server = replace_once(server, discovery_old, discovery_new, "discovery WS fanout")

        # Remove the V1 synthetic seed. V30.11 intentionally rejects it in the
        # browser, so keeping it only made server status misleading.
        seed_old = """  // Never leave an already-selected token visually blank while historical
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

"""
        seed_new = """  // MEMEFLOW_CHART_TRADE_FEED_V2
  // REAL-TRADES-ONLY: do not manufacture a candle from a timer/current-price
  // mark. If history is empty we wait for a canonical BUY/SELL TradeEvent.
"""
        server = replace_once(server, seed_old, seed_new, "remove rejected seed")

        finally_old = """    .finally(()=>{
      if(__mfChartBackfillJobs.get(mint)===job){
        __mfChartBackfillJobs.delete(mint);
      }
    });

  __mfChartBackfillJobs.set(mint,job);
}"""

        finally_new = """    .finally(()=>{
      if(__mfChartBackfillJobs.get(mint)===job){
        __mfChartBackfillJobs.delete(mint);
      }
      // MEMEFLOW_CHART_TRADE_FEED_V2
      // One final frame after deleting the job flips HISTORY SYNC to the
      // final status and exposes the last archived TradeEvents.
      queueMicrotask(()=>__mfBroadcastChartSnapshot(mint));
    });

  __mfChartBackfillJobs.set(mint,job);
}"""
        server = replace_once(server, finally_old, finally_new, "backfill final broadcast")

        # ================================================================
        # 3) FRONTEND:
        # Do not tell the user "Select a token" when a token is already
        # selected but there are temporarily zero canonical trades.
        # This does not create synthetic OHLC.
        # ================================================================
        draw_old = """  if(!candles.length){
    chartRuntime.api.clear();
    $('chartEmpty').style.display='grid';
    $('chartLegend').innerHTML='';
    renderPriceModeSummary();
    return;
  }"""

        draw_new = """  if(!candles.length){
    chartRuntime.api.clear();
    $('chartEmpty').style.display='grid';
    $('chartEmpty').innerHTML=
      '<strong>Syncing real trades</strong>'+
      '<span>Candles use confirmed BUY / SELL events only. History and the live Pump trade stream reconnect automatically.</span>';
    $('chartLegend').innerHTML='';
    renderPriceModeSummary();
    return;
  }"""
        trading = replace_once(trading, draw_old, draw_new, "chart empty selected state")

        # Write patched files.
        pump_path.write_text(pump, encoding="utf-8")
        server_path.write_text(server, encoding="utf-8")
        trading_path.write_text(trading, encoding="utf-8")

        # Syntax + semantic checks.
        run("node", "--check", TARGETS[0], cwd=root)
        run("node", "--check", TARGETS[1], cwd=root)
        run("node", "--check", TARGETS[2], cwd=root)
        run("git", "diff", "--check", "--", *TARGETS, cwd=root)

        final_pump = pump_path.read_text(encoding="utf-8")
        final_server = server_path.read_text(encoding="utf-8")
        final_trading = trading_path.read_text(encoding="utf-8")

        checks = {
            "shared decoder API":
                "ingestLogs," in final_pump,
            "signature/log dedupe":
                "duplicateTradeEventsSkipped" in final_pump and
                "tradeEventKey(e,signature,index)" in final_pump,
            "dedicated WS uses shared decoder":
                "source:'dedicated-ws'" in final_pump,
            "discovery WS feeds chart decoder":
                "source:'discovery-ws'" in final_server,
            "synthetic current-price seed removed":
                "source:'current-price-seed'" not in final_server,
            "final backfill status broadcast":
                "queueMicrotask(()=>__mfBroadcastChartSnapshot(mint));" in final_server,
            "frontend real-trade waiting message":
                "Syncing real trades" in final_trading,
            "frontend still rejects synthetic seeds":
                "source!=='current-price-seed'" in final_trading,
            "frontend still requires real trade size":
                "(solAmount>0 || tokenAmount>0)" in final_trading,
        }

        for name, ok in checks.items():
            log(f"{'OK' if ok else 'FAIL'}: {name}")
            if not ok:
                raise RuntimeError(f"Semantic check failed: {name}")

    except Exception:
        rollback()
        raise

    run("git", "diff", "--stat", "--", *TARGETS, cwd=root)
    run("git", "add", *TARGETS, cwd=root)

    if run("git", "diff", "--cached", "--quiet", cwd=root, check=False).returncode == 0:
        log("No staged changes.")
        return 0

    run("git", "commit", "-m", COMMIT_MESSAGE, cwd=root)
    run("git", "push", "-u", "origin", TARGET_BRANCH, cwd=root)

    new_head = out("git", "rev-parse", "HEAD", cwd=root)
    log("INSTALL + CHECK + COMMIT + PUSH COMPLETE")
    log(f"branch: {TARGET_BRANCH}")
    log(f"commit: {new_head}")
    log(f"backup: {backup}")
    log("Restart the Replit app/workflow, then hard-refresh Trading Terminal.")
    log("The chart remains REAL-TRADES-ONLY: no timers or synthetic price movement.")
    return 0

if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(f"[{TAG}] FATAL: {exc}", file=sys.stderr)
        raise
