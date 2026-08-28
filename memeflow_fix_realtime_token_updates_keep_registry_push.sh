#!/usr/bin/env bash
set -euo pipefail

echo "== MEMEFLOW realtime data repair: keep registry, restore non-blocking live updates =="

if [[ -d "memeflow-app" && -f "memeflow-app/app-server.mjs" ]]; then
  cd memeflow-app
elif [[ -f "app-server.mjs" && -d "src" && -d "tests" ]]; then
  :
else
  echo "ERROR: Run this from ~/workspace or memeflow-app."
  exit 1
fi

if [[ -n "$(git status --porcelain --untracked-files=no --untracked-files=no)" ]]; then
  echo "ERROR: Working tree has uncommitted changes. Nothing changed."
  git status --short
  exit 1
fi

git fetch origin main
git checkout main
git pull --ff-only origin main

python3 - <<'PY'
from pathlib import Path

# ---------------------------------------------------------------------------
# 1) token-registry.mjs
#    Keep permanent registry, but REMOVE synchronous DB writes from WebSocket
#    hot path. Checkpoints + token writes are queued and flushed in bounded
#    batches.
# ---------------------------------------------------------------------------
p=Path("src/token-registry.mjs")
s=p.read_text()

old="""    this.pending=new Map();
    this.flushMs=Math.max(100,Number(opts.flushMs||process.env.TOKEN_REGISTRY_FLUSH_MS||250));
    this.flushTimer=setInterval(()=>this.flush(),this.flushMs);
    this.flushTimer.unref?.();

    this.metrics={
"""
new="""    // MEMEFLOW_REALTIME_NONBLOCKING_REGISTRY_V1
    // Hot-path calls only mutate Maps. SQLite work is deferred and bounded.
    this.pending=new Map();
    this.pendingCheckpoints=new Map();
    this.flushMs=Math.max(
      250,
      Number(opts.flushMs||process.env.TOKEN_REGISTRY_FLUSH_MS||500)
    );
    this.flushBatchMax=Math.max(
      10,
      Number(opts.flushBatchMax||process.env.TOKEN_REGISTRY_FLUSH_BATCH_MAX||100)
    );
    this.checkpointBatchMax=Math.max(
      1,
      Number(process.env.TOKEN_REGISTRY_CHECKPOINT_BATCH_MAX||25)
    );
    this.flushTimer=setInterval(()=>this.flush(),this.flushMs);
    this.flushTimer.unref?.();

    this.metrics={
"""
if old in s:
    s=s.replace(old,new,1)
elif "MEMEFLOW_REALTIME_NONBLOCKING_REGISTRY_V1" not in s:
    raise SystemExit("PATCH FAILED: token registry constructor block changed")

old="""      dbFile:path.basename(this.file),
      lastFlushAt:null,
      lastError:null
"""
new="""      dbFile:path.basename(this.file),
      permanentTokensApprox:Number(this.countStmt.get()?.n||0),
      lastFlushAt:null,
      lastFlushDurationMs:0,
      maxFlushDurationMs:0,
      lastError:null
"""
if old in s:
    s=s.replace(old,new,1)
elif "permanentTokensApprox" not in s:
    raise SystemExit("PATCH FAILED: token registry metrics block changed")

start=s.find("  flush(){")
end=s.find("\n  get(mint){",start)
if start<0 or end<0:
    raise SystemExit("PATCH FAILED: token registry flush() boundaries not found")

new_flush=r"""  flush(){
    const rowEntries=[...this.pending.entries()].slice(0,this.flushBatchMax);
    const checkpointEntries=[...this.pendingCheckpoints.entries()]
      .slice(0,this.checkpointBatchMax);

    if(!rowEntries.length&&!checkpointEntries.length)return 0;

    // Remove only the selected bounded batch. New live writes keep coalescing
    // in memory while the next timer tick waits.
    for(const [mint] of rowEntries)this.pending.delete(mint);
    for(const [key] of checkpointEntries)this.pendingCheckpoints.delete(key);

    const started=Date.now();

    try{
      this.db.exec('BEGIN IMMEDIATE');

      for(const [mint,row] of rowEntries){
        let token=row.token||{};
        if(!mint)continue;

        // Deep/history rows are intentionally sparse. Never let a later
        // historical page overwrite richer live scanner state already stored.
        if(row.historical){
          const existingRow=this.getStmt.get(mint);
          const existing=existingRow?.token_json
            ? parseJson(existingRow.token_json,null)
            : null;
          if(existing)token={...existing,...token};
        }

        const updatedAt=n(token.updatedAt)||Date.now();
        this.upsertStmt.run(
          mint,
          n(token.pumpCreatedAt??token.createdAt??token.created_at??token.createTimestamp??token.blockTime),
          n(token.discoveredAt),
          row.activityAt,
          updatedAt,
          token.wsFirst===true?1:0,
          row.historical?1:0,
          token.source?String(token.source):null,
          safeJson(token,'{}')
        );
      }

      for(const [key,row] of checkpointEntries){
        this.checkpointSetStmt.run(
          String(key),
          safeJson(row?.value,'null'),
          Number(row?.queuedAt)||Date.now()
        );
      }

      this.db.exec('COMMIT');

      const duration=Date.now()-started;
      this.metrics.flushed+=rowEntries.length;
      this.metrics.flushes++;
      this.metrics.lastFlushAt=Date.now();
      this.metrics.lastFlushDurationMs=duration;
      this.metrics.maxFlushDurationMs=Math.max(
        Number(this.metrics.maxFlushDurationMs||0),
        duration
      );

      // Count once per background flush, never once per UI request.
      this.metrics.permanentTokensApprox=Number(
        this.countStmt.get()?.n||this.metrics.permanentTokensApprox||0
      );

      this.metrics.lastError=null;
      return rowEntries.length;
    }catch(error){
      try{this.db.exec('ROLLBACK')}catch{}

      // Restore only if a newer live snapshot was not already queued.
      for(const [mint,row] of rowEntries){
        if(mint&&!this.pending.has(mint))this.pending.set(mint,row);
      }
      for(const [key,row] of checkpointEntries){
        if(key&&!this.pendingCheckpoints.has(key)){
          this.pendingCheckpoints.set(key,row);
        }
      }

      this.metrics.flushErrors++;
      this.metrics.lastError=String(error?.message||error);
      return 0;
    }
  }
"""
s=s[:start]+new_flush+s[end:]

old="""  getCheckpoint(key,fallback=null){
    const row=this.checkpointGetStmt.get(String(key));
    return row?.value_json?parseJson(row.value_json,fallback):fallback;
  }

  setCheckpoint(key,value){
    this.checkpointSetStmt.run(
      String(key),
      safeJson(value,'null'),
      Date.now()
    );
    return value;
  }

  status(){
    return {
      ...this.metrics,
      permanentTokens:this.count(),
      queuedWrites:this.pending.size
    };
  }

  close(){
    clearInterval(this.flushTimer);
    this.flush();
    try{this.db.close()}catch{}
  }
"""
new="""  getCheckpoint(key,fallback=null){
    key=String(key);
    const queued=this.pendingCheckpoints.get(key);
    if(queued)return queued.value;

    const row=this.checkpointGetStmt.get(key);
    return row?.value_json?parseJson(row.value_json,fallback):fallback;
  }

  setCheckpoint(key,value){
    // MEMEFLOW_REALTIME_NONBLOCKING_REGISTRY_V1
    // NEVER run SQLite from a Pump WebSocket callback.
    this.pendingCheckpoints.set(String(key),{
      value,
      queuedAt:Date.now()
    });
    return value;
  }

  status(){
    return {
      ...this.metrics,
      permanentTokens:Number(this.metrics.permanentTokensApprox||0),
      queuedWrites:this.pending.size,
      queuedCheckpoints:this.pendingCheckpoints.size,
      flushBatchMax:this.flushBatchMax
    };
  }

  close(){
    clearInterval(this.flushTimer);

    // Shutdown-only drain. Runtime hot path never enters this loop.
    let guard=0;
    while(
      (this.pending.size||this.pendingCheckpoints.size) &&
      guard++<10000
    ){
      this.flush();
    }

    try{this.db.close()}catch{}
  }
"""
if old in s:
    s=s.replace(old,new,1)
elif "NEVER run SQLite from a Pump WebSocket callback" not in s:
    raise SystemExit("PATCH FAILED: checkpoint/status block changed")

p.write_text(s)
print("patched: src/token-registry.mjs :: non-blocking/bounded persistence")

# ---------------------------------------------------------------------------
# 2) app-server.mjs
# ---------------------------------------------------------------------------
p=Path("app-server.mjs")
app=p.read_text()

anchor="function candidateView(d){"
helper=r"""// MEMEFLOW_REALTIME_UI_FAIRNESS_V1
// Building a large Live Token States response must never monopolize Node's
// event loop and starve Pump WebSocket messages.
const __mfLiveStatesYieldEvery=Math.max(
  20,
  Number(process.env.LIVE_STATES_YIELD_EVERY||75)
);
const __mfLiveStatesResponseCacheMs=Math.max(
  100,
  Number(process.env.LIVE_STATES_RESPONSE_CACHE_MS||350)
);
const __mfLiveStatesResponseCache=new Map();
const __mfYieldToEventLoop=()=>new Promise(resolve=>setImmediate(resolve));

"""
if "MEMEFLOW_REALTIME_UI_FAIRNESS_V1" not in app:
    idx=app.find(anchor)
    if idx<0:
        raise SystemExit("PATCH FAILED: candidateView anchor not found")
    app=app[:idx]+helper+app[idx:]
    print("patched: app-server.mjs :: UI/event-loop fairness helpers")

route_start=app.find(" if(url.pathname==='/api/system/live-token-states'&&req.method==='GET'){")
route_end=app.find("if(url.pathname==='/api/ai/decisions'){",route_start)
if route_start<0 or route_end<0:
    raise SystemExit("PATCH FAILED: Live Token States route boundaries not found")

route=app[route_start:route_end]

if "MEMEFLOW_REALTIME_UI_FAIRNESS_V1_ROUTE" not in route:
    old="""  const _settings=store.settings(u.id);
  const _rawTokens=__mfLiveScannerTokens();
  const _openMints=__mfOpenPositionMints();

  let _admitted=0;
"""
    new="""  const _settings=store.settings(u.id);
  const _rawTokens=__mfLiveScannerTokens();
  const _openMints=__mfOpenPositionMints();

  // MEMEFLOW_REALTIME_UI_FAIRNESS_V1_ROUTE
  // A tiny cache stops multiple browser polls from rebuilding the same large
  // response at the same instant. 350ms is still effectively real-time.
  const _cacheKey=String(u.id||'anon');
  const _settingsVersion=Number(store.user(u.id)?.settingsVersion||0);
  const _cached=__mfLiveStatesResponseCache.get(_cacheKey);

  if(
    _cached &&
    Date.now()-Number(_cached.at||0)<=__mfLiveStatesResponseCacheMs &&
    Number(_cached.settingsVersion||0)===_settingsVersion
  ){
    return json(res,200,{..._cached.payload,cacheHit:true});
  }

  let _processed=0;
  let _admitted=0;
"""
    if old not in route:
        raise SystemExit("PATCH FAILED: Live route settings/open block changed")
    route=route.replace(old,new,1)

    old="""    const _mint=String(_token?.mint||'').trim();
    if(!_mint)continue;

    let _admission=null;
"""
    new="""    const _mint=String(_token?.mint||'').trim();
    if(!_mint)continue;

    // Yield periodically so Pump WS onmessage callbacks can update prices,
    // holders, volume, TX count and 5m metrics while this response is built.
    _processed++;
    if(_processed%__mfLiveStatesYieldEvery===0){
      await __mfYieldToEventLoop();
    }

    let _admission=null;
"""
    if old not in route:
        raise SystemExit("PATCH FAILED: Live route token loop anchor changed")
    route=route.replace(old,new,1)

    old="    permanentRegistryTokens:store.tokenRegistry?.count?.()||0,"
    new="""    // Never run synchronous SQLite COUNT from the live-card request path.
    permanentRegistryTokens:
      Number(store.tokenRegistry?.metrics?.permanentTokensApprox||0),"""
    if old not in route:
        raise SystemExit("PATCH FAILED: Live route registry count anchor changed")
    route=route.replace(old,new,1)

    old="""  return json(res,200,{
    decisions:_views,
"""
    new="""  const _payload={
    decisions:_views,
"""
    if old not in route:
        raise SystemExit("PATCH FAILED: Live route response start changed")
    route=route.replace(old,new,1)

    old="""    stateCounts:_stateCounts,
    counts:_counts
  });
 }
"""
    new="""    stateCounts:_stateCounts,
    counts:_counts
  };

  __mfLiveStatesResponseCache.set(_cacheKey,{
    at:Date.now(),
    settingsVersion:_settingsVersion,
    payload:_payload
  });

  // Bound per-user cache cardinality.
  if(__mfLiveStatesResponseCache.size>1000){
    const oldest=__mfLiveStatesResponseCache.keys().next().value;
    if(oldest!==undefined)__mfLiveStatesResponseCache.delete(oldest);
  }

  return json(res,200,_payload);
 }
"""
    if old not in route:
        raise SystemExit("PATCH FAILED: Live route response end changed")
    route=route.replace(old,new,1)

    app=app[:route_start]+route+app[route_end:]
    print("patched: app-server.mjs :: non-blocking Live Token States route")
else:
    print("already patched: app-server.mjs :: Live route fairness")

start_anchor="const server=http.createServer("
if "MEMEFLOW_HISTORY_LOW_PRIORITY_EVAL_V1" not in app:
    idx=app.find(start_anchor)
    if idx<0:
        raise SystemExit("PATCH FAILED: server startup anchor not found")

    history_helper=r"""// MEMEFLOW_HISTORY_LOW_PRIORITY_EVAL_V1
// Historical/gap recovery must never compete with current Pump TradeEvents.
// At most one recovered token is evaluated per interval.
const __mfHistoryEvalQueue=[];
const __mfHistoryEvalQueued=new Set();
let __mfHistoryEvalTimer=null;

function __mfQueueHistoryEvaluation(token){
  const mint=String(token?.mint||'');
  if(!mint||__mfHistoryEvalQueued.has(mint))return false;

  __mfHistoryEvalQueued.add(mint);
  __mfHistoryEvalQueue.push(token);

  if(!__mfHistoryEvalTimer){
    const interval=Math.max(
      100,
      Number(process.env.HISTORY_EVAL_INTERVAL_MS||250)
    );

    __mfHistoryEvalTimer=setInterval(()=>{
      const next=__mfHistoryEvalQueue.shift();
      if(!next){
        clearInterval(__mfHistoryEvalTimer);
        __mfHistoryEvalTimer=null;
        return;
      }

      const nextMint=String(next?.mint||'');
      __mfHistoryEvalQueued.delete(nextMint);

      Promise.resolve(evaluateAll(next))
        .then(()=>{try{publish(nextMint)}catch{}})
        .catch(()=>{});
    },interval);

    __mfHistoryEvalTimer.unref?.();
  }

  return true;
}

"""
    app=app[:idx]+history_helper+app[idx:]
    print("patched: app-server.mjs :: low-priority history evaluation queue")

old="""      const current=store.getToken(token.mint);
      const hot=current
        ? store.setToken(token.mint,{...token,wsFirst:true,historyGapRestored:true})
        : store.addToken({...token,wsFirst:true,historyGapRestored:true});

      Promise.resolve(evaluateAll(hot)).catch(()=>{});
      try{publish(token.mint)}catch{}
"""
new="""      // MEMEFLOW_REALTIME_HISTORY_ISOLATION_V1
      // Do not lazy-hydrate or overwrite an already-live token with a sparse
      // HTTP history snapshot. Live WS state is always authoritative.
      const current=store.state.tokens?.[token.mint]||null;
      if(current?.wsFirst===true)return;

      const hot=current
        ? store.setToken(
            token.mint,
            {...token,wsFirst:true,historyGapRestored:true}
          )
        : store.addToken(
            {...token,wsFirst:true,historyGapRestored:true}
          );

      // History is deliberately slower than the live path.
      __mfQueueHistoryEvaluation(hot);
"""
if old in app:
    app=app.replace(old,new,1)
elif "MEMEFLOW_REALTIME_HISTORY_ISOLATION_V1" not in app:
    raise SystemExit("PATCH FAILED: history onRecentToken callback changed")
else:
    print("already patched: app-server.mjs :: history isolation")

p.write_text(app)

# ---------------------------------------------------------------------------
# 3) pump-live-trade-feed.mjs diagnostics.
# ---------------------------------------------------------------------------
p=Path("src/pump-live-trade-feed.mjs")
live=p.read_text()

old="""    deadTokensDetected:0,deadTokensDropped:0,
    lastTradeEventAt:null,lastTradeEventSource:null
"""
new="""    deadTokensDetected:0,deadTokensDropped:0,
    lastTradeEventAt:null,lastTradeEventSource:null,
    lastStoreUpdateAt:null,lastStoreUpdateMint:null
"""
if old in live:
    live=live.replace(old,new,1)
elif "lastStoreUpdateAt" not in live:
    raise SystemExit("PATCH FAILED: live-feed metrics anchor changed")

old="""      const updated=store?.setToken?.(e.mint,patch);
      if(!updated)return;
      metrics.marketSnapshots++;

      let dropped=false;
"""
new="""      const updated=store?.setToken?.(e.mint,patch);
      if(!updated)return;
      metrics.marketSnapshots++;
      metrics.lastStoreUpdateAt=Date.now();
      metrics.lastStoreUpdateMint=e.mint;

      let dropped=false;
"""
if old in live:
    live=live.replace(old,new,1)
elif "metrics.lastStoreUpdateAt=Date.now()" not in live:
    raise SystemExit("PATCH FAILED: live store-update anchor changed")

p.write_text(live)
print("patched: src/pump-live-trade-feed.mjs :: realtime update diagnostics")

# ---------------------------------------------------------------------------
# 4) env example tuning.
# ---------------------------------------------------------------------------
p=Path(".env.example")
env=p.read_text()

env=env.replace("TOKEN_REGISTRY_FLUSH_MS=250","TOKEN_REGISTRY_FLUSH_MS=500")

if "TOKEN_REGISTRY_FLUSH_BATCH_MAX" not in env:
    env += """

# Realtime fairness — persistence is bounded and never runs per WS event.
TOKEN_REGISTRY_FLUSH_BATCH_MAX=100
TOKEN_REGISTRY_CHECKPOINT_BATCH_MAX=25
LIVE_STATES_YIELD_EVERY=75
LIVE_STATES_RESPONSE_CACHE_MS=350
HISTORY_EVAL_INTERVAL_MS=250
"""

p.write_text(env)

# ---------------------------------------------------------------------------
# 5) Regression test.
# ---------------------------------------------------------------------------
test = r"""import assert from 'node:assert/strict';
import fs from 'node:fs';

const app=fs.readFileSync(new URL('../app-server.mjs',import.meta.url),'utf8');
const registry=fs.readFileSync(new URL('../src/token-registry.mjs',import.meta.url),'utf8');
const trades=fs.readFileSync(new URL('../src/pump-live-trade-feed.mjs',import.meta.url),'utf8');

// Pump TradeEvent must update canonical token state and publish it.
assert.match(trades,/const updated=store\?\.setToken\?\.\(e\.mint,patch\)/);
assert.match(trades,/metrics\.lastStoreUpdateAt=Date\.now\(\)/);
assert.match(trades,/publishTrade\?\.\(e\.mint,e,updated\)/);
assert.match(trades,/publish\?\.\(e\.mint\)/);

// CREATE checkpoint persistence must be queued, not a synchronous SQLite write
// in the WebSocket callback.
const setCheckpoint=registry.slice(
  registry.indexOf('  setCheckpoint(key,value){'),
  registry.indexOf('  status(){')
);
assert.match(setCheckpoint,/pendingCheckpoints\.set/);
assert.doesNotMatch(setCheckpoint,/checkpointSetStmt\.run/);

// SQLite flushes must be bounded.
assert.match(registry,/TOKEN_REGISTRY_FLUSH_BATCH_MAX/);
assert.match(registry,/slice\(0,this\.flushBatchMax\)/);
assert.match(registry,/TOKEN_REGISTRY_CHECKPOINT_BATCH_MAX/);

// Large card responses must yield to the event loop instead of starving WS.
const route=app.slice(
  app.indexOf("if(url.pathname==='/api/system/live-token-states'"),
  app.indexOf("if(url.pathname==='/api/ai/decisions'")
);
assert.match(route,/MEMEFLOW_REALTIME_UI_FAIRNESS_V1_ROUTE/);
assert.match(route,/await __mfYieldToEventLoop\(\)/);
assert.match(app,/LIVE_STATES_RESPONSE_CACHE_MS/);
assert.doesNotMatch(route,/tokenRegistry\?\.count\?\.\(\)/);

// Historical HTTP sync cannot overwrite an already-live WS snapshot and its
// expensive evaluations are explicitly low priority.
assert.match(app,/MEMEFLOW_REALTIME_HISTORY_ISOLATION_V1/);
assert.match(app,/if\(current\?\.wsFirst===true\)return/);
assert.match(app,/__mfQueueHistoryEvaluation\(hot\)/);
assert.match(app,/HISTORY_EVAL_INTERVAL_MS/);

console.log('realtime update path v1 ok');
"""
Path("tests/realtime-update-path.mjs").write_text(test)
print("created: tests/realtime-update-path.mjs")

p=Path("package.json")
pkg=p.read_text()
if "tests/realtime-update-path.mjs" not in pkg:
    pkg=pkg.replace(
        "node tests/token-registry.mjs &&",
        "node tests/token-registry.mjs && node tests/realtime-update-path.mjs &&",
        1
    )
    p.write_text(pkg)
    print("patched: package.json :: realtime regression test")

PY

echo
echo "== Focused realtime tests =="
node tests/token-registry.mjs
node tests/realtime-update-path.mjs
node tests/fresh-session-scanner.mjs
node tests/ws-first-preopen-rpc.mjs

echo
echo "== Full project tests =="
npm test

echo
echo "== Stage =="
git add \
  app-server.mjs \
  src/token-registry.mjs \
  src/pump-live-trade-feed.mjs \
  tests/realtime-update-path.mjs \
  package.json \
  .env.example

echo
echo "== Diff summary =="
git --no-pager diff --cached --stat

if git diff --cached --quiet; then
  echo "No new changes to commit."
else
  git commit -m "fix: keep live token metrics updating in real time"
fi

echo
echo "== Push =="
git push origin main

echo
echo "SUCCESS."
echo "Permanent registry/history remains installed."
echo "Fixed only the realtime path:"
echo "  - no synchronous checkpoint SQLite write inside Pump CREATE callback"
echo "  - bounded registry flush batches"
echo "  - Live Token States yields to Pump WS while building large responses"
echo "  - short UI response cache prevents duplicate heavy rebuilds"
echo "  - history sync never overwrites an already-live WS token"
echo "  - history evaluations are throttled below live traffic"
echo "  - live feed exposes lastStoreUpdateAt / lastStoreUpdateMint diagnostics"
