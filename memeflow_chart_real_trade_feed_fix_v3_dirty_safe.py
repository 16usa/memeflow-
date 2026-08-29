#!/usr/bin/env python3
from pathlib import Path
import datetime
import re
import shutil
import subprocess
import sys

TAG="MEMEFLOW_CHART_REAL_TRADE_FEED_FIX_V3_DIRTY_SAFE"

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
    for p in [
        cwd/"memeflow-app",
        cwd,
        Path.home()/"workspace"/"memeflow-app",
        Path("/home/runner/workspace/memeflow-app"),
    ]:
        if (p/"app-server.mjs").is_file() and (p/"src"/"pump-live-trade-feed.mjs").is_file():
            return p.resolve()
    raise RuntimeError("memeflow-app not found")

def replace_once(text,old,new,label):
    n=text.count(old)
    if n!=1:
        raise RuntimeError(f"{label}: expected exactly 1 match, found {n}")
    return text.replace(old,new,1)

def patch_feed(feed):
    changed=False

    # Newer builds already contain the shared decoder. In that case preserve it.
    has_ingest=("function ingestLogs(" in feed and "ingestLogs," in feed)
    has_dedicated=("source:'dedicated-ws'" in feed)

    if has_ingest and has_dedicated:
        return feed, changed

    # Fallback for the pre-V2 feed shape. Apply the proven shared decoder patch.
    metrics_old="""    evaluationCalls:0,evaluationResolved:0,evaluationRejected:0,evaluationNullResults:0,
    evaluationDecisionLikeResults:0,lastEvaluationMint:null,lastEvaluationTrigger:null,
    lastEvaluationAt:null,lastEvaluationResultType:null,lastEvaluationError:null
  };"""
    metrics_new="""    evaluationCalls:0,evaluationResolved:0,evaluationRejected:0,evaluationNullResults:0,
    evaluationDecisionLikeResults:0,lastEvaluationMint:null,lastEvaluationTrigger:null,
    lastEvaluationAt:null,lastEvaluationResultType:null,lastEvaluationError:null,
    // MEMEFLOW_CHART_TRADE_FEED_V2 / V3 recovery
    logBatchesIngested:0,externalLogBatches:0,dedicatedLogBatches:0,
    duplicateTradeEventsSkipped:0,lastTradeEventAt:null,lastTradeEventSource:null
  };"""
    if metrics_old in feed:
        feed=replace_once(feed,metrics_old,metrics_new,"feed metrics")
        changed=True

    state_old="""  const mintCounts=new Map(), users=new Set(), pressure=new Map();
  let ws=null,stopped=false,idx=0,reconnectTimer=null;"""
    state_new="""  const mintCounts=new Map(), users=new Set(), pressure=new Map();
  // MEMEFLOW_CHART_TRADE_FEED_V2 / V3 recovery
  const seenTradeEvents=new Map();
  let ws=null,stopped=false,idx=0,reconnectTimer=null;"""
    if state_old in feed:
        feed=replace_once(feed,state_old,state_new,"feed runtime state")
        changed=True

    if "function ingestLogs(" not in feed:
        apply_anchor="""  function applyEvent(e){
    metrics.tradeEventsDecoded++;"""
        ingest_block=r"""  // MEMEFLOW_CHART_TRADE_FEED_V2 / V3 recovery
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
    while(seenTradeEvents.size>25000){
      const oldest=seenTradeEvents.keys().next().value;
      if(oldest===undefined)break;
      seenTradeEvents.delete(oldest);
    }
    return true;
  }

  function ingestLogs(logs,{signature=null,source='external',slot=null}={}){
    const rows=Array.isArray(logs)?logs:[];
    if(!rows.length)return 0;

    if('logBatchesIngested' in metrics)metrics.logBatchesIngested++;
    if(source==='dedicated-ws'){
      if('dedicatedLogBatches' in metrics)metrics.dedicatedLogBatches++;
    }else{
      if('externalLogBatches' in metrics)metrics.externalLogBatches++;
    }

    let accepted=0;
    for(let i=0;i<rows.length;i++){
      const b=programData(rows[i]);
      if(!b)continue;
      metrics.programDataSeen++;

      try{
        const e=decodeTradeEvent(b);
        if(!e)continue;

        // Preserve the current project's unknown-mint safety gate if present
        // elsewhere. Known Trading candidates/positions continue normally.
        const key=tradeEventKey(e,signature,i);
        if(!acceptTradeEventKey(key)){
          if('duplicateTradeEventsSkipped' in metrics)metrics.duplicateTradeEventsSkipped++;
          continue;
        }

        metrics.lastTradeEventAt=Date.now();
        metrics.lastTradeEventSource=source;
        applyEvent({...e,signature:signature||null,slot});
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
        if apply_anchor not in feed:
            raise RuntimeError("pump feed has no shared ingestLogs and applyEvent anchor changed")
        feed=replace_once(feed,apply_anchor,ingest_block,"feed ingest helper")
        changed=True

    # Make the dedicated socket use the same decoder if it still has legacy loop.
    if "source:'dedicated-ws'" not in feed:
        legacy=re.search(
            r"""      ws\.onmessage=ev=>\{\s*
        try\{\s*
          const j=JSON\.parse\(typeof ev\.data==='string'\?ev\.data:String\(ev\.data\)\);\s*
          const value=j\?\.params\?\.result\?\.value;\s*
          if\(!value\|\|value\.err\)return;\s*
          metrics\.notifications\+\+;\s*
          for\(const log of value\.logs\|\|\[\]\)\{.*?
        \}\s*catch\(err\)\{\s*
          metrics\.decodeErrors\+\+;\s*
          metrics\.lastError='ws-message:'\+String\(err\?\.message\|\|err\);\s*
        \}\s*
      \};""",
            feed,re.S
        )
        if legacy:
            new=r"""      ws.onmessage=ev=>{
        try{
          const j=JSON.parse(typeof ev.data==='string'?ev.data:String(ev.data));
          const value=j?.params?.result?.value;
          if(!value||value.err)return;
          metrics.notifications++;
          ingestLogs(value.logs||[],{
            signature:value.signature||null,
            source:'dedicated-ws',
            slot:value?.context?.slot??null
          });
        }catch(err){
          metrics.decodeErrors++;
          metrics.lastError='ws-message:'+String(err?.message||err);
        }
      };"""
            feed=feed[:legacy.start()]+new+feed[legacy.end():]
            changed=True
        else:
            raise RuntimeError("dedicated WS does not use shared decoder and legacy onmessage anchor changed")

    # Expose ingestLogs to app-server discovery WS.
    if "ingestLogs," not in feed:
        # Insert just before metrics in returned API.
        anchor="    metrics:()=>"
        idx=feed.rfind(anchor)
        if idx<0:
            raise RuntimeError("feed returned API metrics anchor not found")
        feed=feed[:idx]+"    ingestLogs,\n"+feed[idx:]
        changed=True

    return feed, changed

def patch_server(server):
    changed=False

    # The discovery socket is already connected for Pump Create detection.
    # Feed ALL Pump log batches into the canonical TradeEvent decoder before
    # the Create-only filter. This does not alter discovery decisions.
    if "source:'discovery-ws'" not in server:
        old="""        const logs=m.params?.result?.value?.logs;
        if(!Array.isArray(logs)){discMetrics.eventsWithoutLogs++;discMetrics.eventsFiltered++;return}
        // Accept only Pump.fun token creation instructions; drop Buy/Sell/Withdraw/Migrate/etc.
        const isCreate=logs.some(l=>/Instruction:\\s*Create(?:V2|\\s+V2|\\s*$)/i.test(l));"""
        new="""        const logs=m.params?.result?.value?.logs;
        if(!Array.isArray(logs)){discMetrics.eventsWithoutLogs++;discMetrics.eventsFiltered++;return}

        // MEMEFLOW_CHART_REAL_TRADE_FEED_FIX_V3_DIRTY_SAFE
        // The discovery Pump logsSubscribe is already alive. Reuse the same
        // notifications as a redundant canonical BUY/SELL TradeEvent source.
        // The feed deduplicates the same signature/log if its dedicated socket
        // receives it too.
        try{
          __pumpLiveTradeFeed?.ingestLogs?.(logs,{
            signature:String(sig||''),
            source:'discovery-ws',
            slot:m?.params?.result?.context?.slot??null
          });
        }catch{}

        // Discovery itself still accepts Create only. Trade decoding above is
        // chart/market feed input; it does not enqueue BUY/SELL into discovery.
        const isCreate=logs.some(l=>/Instruction:\\s*Create(?:V2|\\s+V2|\\s*$)/i.test(l));"""
        if old not in server:
            # A later comment wording may differ. Use a constrained insertion
            # after the exact logs validation and before the next isCreate.
            anchor="""        const logs=m.params?.result?.value?.logs;
        if(!Array.isArray(logs)){discMetrics.eventsWithoutLogs++;discMetrics.eventsFiltered++;return}"""
            pos=server.find(anchor)
            if pos<0:
                raise RuntimeError("discovery Pump logs anchor not found")
            insert_pos=pos+len(anchor)
            next_create=server.find("const isCreate=logs.some",insert_pos)
            if next_create<0 or next_create-insert_pos>700:
                raise RuntimeError("discovery Create filter not found near logs anchor")
            block="""

        // MEMEFLOW_CHART_REAL_TRADE_FEED_FIX_V3_DIRTY_SAFE
        try{
          __pumpLiveTradeFeed?.ingestLogs?.(logs,{
            signature:String(sig||''),
            source:'discovery-ws',
            slot:m?.params?.result?.context?.slot??null
          });
        }catch{}
"""
            server=server[:insert_pos]+block+server[insert_pos:]
        else:
            server=replace_once(server,old,new,"discovery WS fanout")
        changed=True

    # V2 data-path repair broadcasts in .then() while the job is still present.
    # Send one more snapshot AFTER job deletion so frontend sees the final state.
    marker="MEMEFLOW_CHART_DATA_PATH_FIX_V2_DIRTY_SAFE"
    if "__mfChartBackfillJobs" in server and "__mfBroadcastChartSnapshot" in server:
        if "V3_FINAL_BACKFILL_BROADCAST" not in server:
            patterns=[
                r"""(\.finally\(\(\)=>\{\s*
\s*if\(__mfChartBackfillJobs\.get\(mint\)===job\)__mfChartBackfillJobs\.delete\(mint\);\s*)
(\}\);)""",
                r"""(\.finally\(\(\)=>\{\s*
\s*if\(__mfChartBackfillJobs\.get\(mint\)===job\)\{\s*
\s*__mfChartBackfillJobs\.delete\(mint\);\s*
\s*\}\s*)
(\}\);)"""
            ]
            for pat in patterns:
                m=re.search(pat,server,re.S)
                if m:
                    replacement=m.group(1)+"""  // V3_FINAL_BACKFILL_BROADCAST
      queueMicrotask(()=>__mfBroadcastChartSnapshot(mint));
    """+m.group(2)
                    server=server[:m.start()]+replacement+server[m.end():]
                    changed=True
                    break

    return server, changed

def main():
    app=find_app()
    repo=app.parent if (app.parent/".git").exists() else app
    server_path=app/"app-server.mjs"
    feed_path=app/"src"/"pump-live-trade-feed.mjs"

    log(f"app: {app}")

    # Preflight: the chart frontend is REAL-TRADES-ONLY in this build.
    trading=(app/"trading.js").read_text(encoding="utf-8")
    if "Syncing real trades" not in trading:
        log("WARNING: 'Syncing real trades' marker not found in trading.js")
    if "source!=='current-price-seed'" in trading:
        log("OK: frontend rejects synthetic current-price seed")
    if "(solAmount>0 || tokenAmount>0)" in trading:
        log("OK: frontend requires real trade size")

    originals={
        server_path:server_path.read_text(encoding="utf-8"),
        feed_path:feed_path.read_text(encoding="utf-8"),
    }

    stamp=datetime.datetime.now().strftime("%Y%m%d-%H%M%S")
    backup=app/".patch-backups"/f"chart-real-trade-feed-v3-{stamp}"
    backup.mkdir(parents=True,exist_ok=True)
    for p in originals:
        shutil.copy2(p,backup/p.name)
    log(f"backup: {backup}")

    # Preserve current dirty state; never stash/reset/stage/commit.
    if (repo/".git").exists():
        rels=[str(server_path.relative_to(repo)),str(feed_path.relative_to(repo))]
        try:
            (backup/"git-status-before.txt").write_text(
                run("git","status","--short","--",*rels,cwd=repo,check=False).stdout or "",
                encoding="utf-8"
            )
            (backup/"git-diff-before.patch").write_text(
                run("git","diff","--",*rels,cwd=repo,check=False).stdout or "",
                encoding="utf-8"
            )
        except Exception:
            pass

    try:
        feed,feed_changed=patch_feed(originals[feed_path])
        server,server_changed=patch_server(originals[server_path])

        feed_path.write_text(feed,encoding="utf-8")
        server_path.write_text(server,encoding="utf-8")

        final_feed=feed_path.read_text(encoding="utf-8")
        final_server=server_path.read_text(encoding="utf-8")

        checks={
            "feed exposes ingestLogs": "ingestLogs," in final_feed,
            "dedicated WS feeds shared decoder": "source:'dedicated-ws'" in final_feed,
            "discovery WS feeds shared decoder": "source:'discovery-ws'" in final_server,
            "real trade reaches publishTrade": "publishTrade?.(e.mint,e,updated" in final_feed,
            "chart persistent append still present": "__mfChartArchive.appendPoint(mint,point)" in final_server,
            "chart stream still uses repaired snapshot": "__mfChartSnapshotPayload" in final_server,
        }
        for name,ok in checks.items():
            log(f"{'OK' if ok else 'FAIL'}: {name}")
            if not ok:
                raise RuntimeError(f"verification failed: {name}")

        run("node","--check",str(feed_path),cwd=app)
        run("node","--check",str(server_path),cwd=app)

        if (repo/".git").exists():
            rels=[str(server_path.relative_to(repo)),str(feed_path.relative_to(repo))]
            run("git","diff","--check","--",*rels,cwd=repo)

        # Do not print secret values. Only say whether history RPC is configured.
        import os
        rpc_present=bool(os.environ.get("CHART_HISTORY_RPC_URLS") or os.environ.get("SOLANA_RPC_URLS"))
        log("RPC configured for historical backfill: "+("YES" if rpc_present else "NO"))
        if not rpc_present:
            log("WARNING: historical backfill has no configured RPC URL; live TradeEvents will still feed new candles after restart.")

        log(f"feed changed: {'YES' if feed_changed else 'NO (already had shared decoder)'}")
        log(f"server changed: {'YES' if server_changed else 'NO (fanout already present)'}")

    except Exception:
        for p,text in originals.items():
            p.write_text(text,encoding="utf-8")
        log("FAILED: target files restored exactly from backup")
        raise

    if (repo/".git").exists():
        rels=[str(server_path.relative_to(repo)),str(feed_path.relative_to(repo))]
        log("DIRTY-SAFE: no git add / commit / push performed")
        run("git","status","--short","--",*rels,cwd=repo,check=False)

    log("FIX COMPLETE")
    log("Restart the Replit app/workflow, then hard-refresh Trading Terminal.")
    log("Expected after restart: the next canonical Pump BUY/SELL events populate chart candles; historical archive backfill fills older candles.")
    return 0

if __name__=="__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(f"[{TAG}] FATAL: {exc}",file=sys.stderr)
        raise
