#!/usr/bin/env python3
from pathlib import Path
import subprocess
import sys

MARK = "MEMEFLOW_FRESH_SESSION_SCANNER_V1"

root = Path.cwd()
if (root / "memeflow-app").is_dir():
    app = root / "memeflow-app"
elif (root / "app-server.mjs").is_file() and (root / "src").is_dir():
    app = root
else:
    raise SystemExit("ERROR: memeflow-app not found. Run from the Replit project root.")

targets = [
    app / "app-server.mjs",
    app / "src" / "store.mjs",
    app / "src" / "event-holder-ledger.mjs",
    app / "src" / "pump-live-trade-feed.mjs",
    app / "package.json",
]
new_test = app / "tests" / "fresh-session-scanner.mjs"

for p in targets:
    if not p.exists():
        raise SystemExit(f"ERROR: missing {p}")

def run(cmd, cwd=None):
    print("+", " ".join(map(str, cmd)))
    subprocess.run(cmd, cwd=cwd, check=True)

rel_targets = [str(p.relative_to(root)) for p in targets]
if new_test.exists():
    rel_targets.append(str(new_test.relative_to(root)))

status = subprocess.run(
    ["git", "status", "--porcelain", "--", *rel_targets],
    cwd=root,
    text=True,
    capture_output=True,
    check=True,
).stdout.strip()

if status:
    print("ERROR: target files already have local changes:")
    print(status)
    print("Nothing was changed.")
    raise SystemExit(1)

originals = {p: p.read_text(encoding="utf-8") for p in targets}
test_existed = new_test.exists()
test_original = new_test.read_text(encoding="utf-8") if test_existed else None

def replace_once(text, old, new, label):
    n = text.count(old)
    if n != 1:
        raise RuntimeError(f"PATCH ERROR [{label}]: expected exactly 1 anchor, found {n}")
    return text.replace(old, new, 1)

try:
    app_text = originals[app / "app-server.mjs"]
    store_text = originals[app / "src" / "store.mjs"]
    holder_text = originals[app / "src" / "event-holder-ledger.mjs"]
    trade_text = originals[app / "src" / "pump-live-trade-feed.mjs"]
    pkg_text = originals[app / "package.json"]

    if MARK in app_text:
        print("Patch is already installed.")
        raise SystemExit(0)

    # Existing WS-first regression scans the discovery function text for the
    # literal word getTransaction. The current main still contains an obsolete
    # comment using that word even though there is no call in the hot path.
    # Remove the stale comment so the regression checks actual architecture.
    app_text = replace_once(
        app_text,
        "// Filter: only create instructions are worth a getTransaction call",
        "// WS-first discovery: Pump CREATE is decoded directly from WebSocket logs.",
        "app/remove-stale-gettransaction-comment",
    )

    # 1) Tokens are runtime scanner state. Persist only token snapshots required
    #    by currently OPEN positions.
    store_old = '''  // Debounced async save — decisions excluded (re-evaluated after restart, not needed on disk)
  save(){clearTimeout(this._st);this._st=setTimeout(()=>{this._st=null;const {decisions:_d,...persist}=this.state;const tmp=this.file+'.tmp';fs.promises.writeFile(tmp,JSON.stringify(persist),'utf8').then(()=>fs.promises.rename(tmp,this.file)).catch(()=>{})},200)}'''
    store_new = '''  // MEMEFLOW_FRESH_SESSION_SCANNER_V1
  // Scanner tokens are runtime state. Persist only snapshots needed by an OPEN
  // position. Decisions remain memory-only and are never restored as live.
  save(){
    clearTimeout(this._st);
    this._st=setTimeout(()=>{
      this._st=null;
      const openMints=new Set();
      for(const p of Object.values(this.state.paperPositions||{})){
        if(String(p?.status||'').toUpperCase()==='OPEN'&&p?.mint)openMints.add(String(p.mint));
      }
      for(const p of Object.values(this.state.positions||{})){
        if(String(p?.status||'').toUpperCase()==='OPEN'&&p?.mint)openMints.add(String(p.mint));
      }
      const persistedTokens=Object.fromEntries(
        Object.entries(this.state.tokens||{}).filter(([mint])=>openMints.has(String(mint)))
      );
      const {decisions:_d,tokens:_tokens,...rest}=this.state;
      const persist={...rest,tokens:persistedTokens};
      const tmp=this.file+'.tmp';
      fs.promises.writeFile(tmp,JSON.stringify(persist),'utf8')
        .then(()=>fs.promises.rename(tmp,this.file))
        .catch(()=>{});
    },200)
  }'''
    store_text = replace_once(store_text, store_old, store_new, "store/runtime-token-persistence")

    # 2) Fresh scanner session at backend boot. Keep OPEN-position snapshots,
    #    purge every old scanner candidate/decision.
    app_old = '''const root=path.dirname(fileURLToPath(import.meta.url)),dataDir=path.resolve(root,process.env.DATA_DIR||'data'),store=new JsonStore(dataDir);
const paper=new PaperEngine(store);'''
    app_new = '''const root=path.dirname(fileURLToPath(import.meta.url)),dataDir=path.resolve(root,process.env.DATA_DIR||'data'),store=new JsonStore(dataDir);

// MEMEFLOW_FRESH_SESSION_SCANNER_V1
// Live scanner data is session-scoped. A restart starts a clean scanner while
// OPEN-position token snapshots remain available for position continuity.
const __mfScannerRuntimeStartedAt=Date.now();
const __mfScannerTokenTtlMs=Math.max(
  5*60_000,
  Number(process.env.LIVE_SCANNER_TOKEN_TTL_MS||3*60*60_000)
);

function __mfOpenPositionMints(){
  const out=new Set();
  for(const p of Object.values(store.state.paperPositions||{})){
    if(String(p?.status||'').toUpperCase()==='OPEN'&&p?.mint)out.add(String(p.mint));
  }
  for(const p of Object.values(store.state.positions||{})){
    if(String(p?.status||'').toUpperCase()==='OPEN'&&p?.mint)out.add(String(p.mint));
  }
  return out;
}

{
  const keep=__mfOpenPositionMints();
  for(const mint of Object.keys(store.state.tokens||{})){
    if(!keep.has(String(mint)))delete store.state.tokens[mint];
  }
  store.state.decisions={};
  store._uidDec={};
  store.save();
}

function __mfIsCurrentScannerToken(token,now=Date.now()){
  if(!token||token.wsFirst!==true)return false;
  const discovered=Number(token.discoveredAt||0);
  if(!(discovered>=__mfScannerRuntimeStartedAt))return false;
  return now-discovered<=__mfScannerTokenTtlMs;
}

function __mfLiveScannerTokens(now=Date.now()){
  return store.tokens().filter(token=>__mfIsCurrentScannerToken(token,now));
}

function __mfPruneScannerRuntimeState(now=Date.now()){
  const open=__mfOpenPositionMints();
  const liveMints=new Set();

  for(const token of Object.values(store.state.tokens||{})){
    const mint=String(token?.mint||'');
    if(__mfIsCurrentScannerToken(token,now)){
      if(mint)liveMints.add(mint);
      continue;
    }
    if(mint&&!open.has(mint))delete store.state.tokens[mint];
  }

  for(const [key,d] of Object.entries(store.state.decisions||{})){
    const mint=String(d?.mint||'');
    if(mint&&!liveMints.has(mint))delete store.state.decisions[key];
  }

  for(const [uid,index] of Object.entries(store._uidDec||{})){
    for(const key of [...index.keys()]){
      if(!store.state.decisions?.[key])index.delete(key);
    }
    if(!index.size)delete store._uidDec[uid];
  }
}

const __mfScannerPruneTimer=setInterval(
  ()=>__mfPruneScannerRuntimeState(),
  Math.max(15_000,Number(process.env.LIVE_SCANNER_PRUNE_MS||60_000))
);
__mfScannerPruneTimer.unref?.();

const paper=new PaperEngine(store);'''
    app_text = replace_once(app_text, app_old, app_new, "app/fresh-session-runtime")

    # Current-session data only in scanner views and settings re-evaluation.
    app_text = replace_once(
        app_text,
        "  const _tokens=store.tokens().slice(0,_lim);",
        "  const _tokens=__mfLiveScannerTokens().slice(0,_lim);",
        "app/live-token-states-current-session",
    )

    app_text = replace_once(
        app_text,
        "function shadowValidateSettings(settings,limit=50){const rows=store.tokens().slice(0,Math.max(1,Math.min(200,limit)));",
        "function shadowValidateSettings(settings,limit=50){const rows=__mfLiveScannerTokens().slice(0,Math.max(1,Math.min(200,limit)));",
        "app/shadow-current-session",
    )

    app_text = replace_once(
        app_text,
        '''function reevaluateUser(uid){
  const settings=store.settings(uid);
  const tokens=store.tokens();''',
        '''function reevaluateUser(uid){
  const settings=store.settings(uid);
  const tokens=__mfLiveScannerTokens();''',
        "app/reevaluate-current-session",
    )

    # Do not resurrect old persisted scanner tokens into /api/ai/decisions.
    ai_old = '''  if(!store._uidDec[u.id]?.size)await lazyRecoverUser({store,uid:u.id,metrics:recoveryMetrics,tokenLimit:DECISION_RECOVERY_TOKEN_LIMIT});
  const _raw=store.decisions(u.id);'''
    ai_new = '''  // MEMEFLOW_FRESH_SESSION_SCANNER_V1
  // Never rebuild the live candidate feed from persisted pre-restart tokens.
  if(!store._uidDec[u.id]?.size){
    const _fresh=__mfLiveScannerTokens().slice(0,DECISION_RECOVERY_TOKEN_LIMIT);
    const _settings=store.settings(u.id);
    for(const _token of _fresh){
      try{
        const _decision=evaluate(_token,_settings);
        store.setDecision(u.id,_token.mint,{..._decision,primaryReason:_decision.primaryReason});
      }catch{}
    }
  }
  const _liveMintSet=new Set(__mfLiveScannerTokens().map(t=>String(t?.mint||'')));
  const _raw=store.decisions(u.id).filter(d=>_liveMintSet.has(String(d?.mint||'')));'''
    app_text = replace_once(app_text, ai_old, ai_new, "app/no-stale-ai-recovery")

    # Discovery diagnostics expose the fresh-session boundary.
    app_text = replace_once(
        app_text,
        '''    tokens:store.tokens().length,
    users:Object.keys(store.state.users).length,''',
        '''    tokens:store.tokens().length,
    freshScannerTokens:__mfLiveScannerTokens().length,
    scannerSessionStartedAt:__mfScannerRuntimeStartedAt,
    scannerTokenTtlMs:__mfScannerTokenTtlMs,
    users:Object.keys(store.state.users).length,''',
        "app/fresh-session-metrics",
    )

    # 3) Establish CREATE token first, then let same transaction's TradeEvent
    #    enrich it. This prevents a race between two WebSocket subscriptions.
    discovery_old = '''        // MEMEFLOW_CHART_TRADE_FEED_V2
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
        const isCreate=logs.some(l=>/Instruction:\\s*Create(?:V2|\\s+V2|\\s*$)/i.test(l));
        if(!isCreate){discMetrics.nonCreateEventsIgnored++;discMetrics.eventsFiltered++;return}
        // V4 System View: accepted real Pump CREATE event.
        try{__systemViewEmitV31('create',{signature:String(sig||''),ts:Date.now()})}catch{}
        discMetrics.createEventsAccepted++;
        discovery.lastEventAt=Date.now();

        // MEMEFLOW_WS_FIRST_PREOPEN_RPC_V1
        // CREATE is decoded directly from the WebSocket payload.
        // There is NO getTransaction request here.
        __ingestPumpCreateEventDirect(
          logs,
          {
            signature:String(sig||''),
            slot:m.params?.result?.context?.slot??null
          }
        );'''
    discovery_new = '''        const isCreate=logs.some(l=>/Instruction:\\s*Create(?:V2|\\s+V2|\\s*$)/i.test(l));

        // MEMEFLOW_FRESH_SESSION_SCANNER_V1
        // CREATE establishes the mint before TradeEvents from the same tx are
        // applied. Unknown global Pump trades are not allowed to create rows.
        if(isCreate){
          try{__systemViewEmitV31('create',{signature:String(sig||''),ts:Date.now()})}catch{}
          discMetrics.createEventsAccepted++;
          discovery.lastEventAt=Date.now();
          __ingestPumpCreateEventDirect(
            logs,
            {
              signature:String(sig||''),
              slot:m.params?.result?.context?.slot??null
            }
          );
        }

        try{
          __pumpLiveTradeFeed?.ingestLogs?.(logs,{
            signature:String(sig||''),
            source:'discovery-ws'
          });
        }catch{}

        if(!isCreate){
          discMetrics.nonCreateEventsIgnored++;
          discMetrics.eventsFiltered++;
          return;
        }'''
    app_text = replace_once(app_text, discovery_old, discovery_new, "app/create-before-trade")

    # 4) Holder ledger is runtime RAM by default. Old holder balances do not
    #    come back as holderFresh after restart.
    holder_old = '''const STATE=process.env.EVENT_HOLDER_LEDGER_STATE_PATH_V12_20 ||
  path.join(process.cwd(),'data','event-holder-ledger-v12-20.json');
const DEFAULT_SUPPLY_UI'''
    holder_new = '''const STATE=process.env.EVENT_HOLDER_LEDGER_STATE_PATH_V12_20 ||
  path.join(process.cwd(),'data','event-holder-ledger-v12-20.json');
// MEMEFLOW_FRESH_SESSION_SCANNER_V1
// Runtime holder state only by default. Disk persistence is opt-in.
const PERSIST=String(process.env.EVENT_HOLDER_LEDGER_PERSIST||'false').toLowerCase()==='true';
if(!PERSIST){try{fs.rmSync(STATE,{force:true})}catch{}}
const DEFAULT_SUPPLY_UI'''
    holder_text = replace_once(holder_text, holder_old, holder_new, "holder/runtime-only")

    holder_text = replace_once(
        holder_text,
        '''    this.t=null;
    this.load();''',
        '''    this.t=null;
    if(PERSIST)this.load();''',
        "holder/no-default-load",
    )

    holder_text = replace_once(
        holder_text,
        '''  schedule(){
    if(this.t)return;''',
        '''  schedule(){
    if(!PERSIST)return;
    if(this.t)return;''',
        "holder/no-default-save",
    )

    holder_text = replace_once(
        holder_text,
        "      stateFile:path.basename(STATE),liveTradeStreamCompatible:true,wsDirectCompatible:true,v12_24CreatorLink:true",
        "      stateFile:path.basename(STATE),persistenceEnabled:PERSIST,liveTradeStreamCompatible:true,wsDirectCompatible:true,v12_24CreatorLink:true",
        "holder/persistence-diagnostic",
    )

    # 5) Global Pump trade stream can enrich only an already-known token.
    #    Gate BEFORE dedupe so a create-race event can be accepted later from
    #    the discovery socket after CREATE establishes the mint.
    trade_text = replace_once(
        trade_text,
        "    duplicateTradeEventsSkipped:0,lastTradeEventAt:null,lastTradeEventSource:null",
        "    duplicateTradeEventsSkipped:0,unknownMintEventsIgnored:0,lastTradeEventAt:null,lastTradeEventSource:null",
        "trade/unknown-mint-metric",
    )

    trade_old = '''        const e=decodeTradeEvent(b);
        if(!e)continue;

        const key=tradeEventKey(e,signature,i);'''
    trade_new = '''        const e=decodeTradeEvent(b);
        if(!e)continue;

        // MEMEFLOW_FRESH_SESSION_SCANNER_V1
        // Pump TradeEvent is enrichment only. It may NEVER manufacture a
        // scanner token that current-session CREATE did not establish.
        const known=tokenFromStore(store,e.mint);
        if(!known){
          metrics.unknownMintEventsIgnored++;
          continue;
        }

        const key=tradeEventKey(e,signature,i);'''
    trade_text = replace_once(trade_text, trade_old, trade_new, "trade/known-mint-gate")

    # 6) Strong regression test: persistence, source architecture, and actual
    #    unknown-mint TradeEvent behavior.
    test_text = r'''import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';

import {JsonStore} from '../src/store.mjs';
import {startPumpLiveTradeFeed} from '../src/pump-live-trade-feed.mjs';

const app=fs.readFileSync(new URL('../app-server.mjs',import.meta.url),'utf8');
const holders=fs.readFileSync(new URL('../src/event-holder-ledger.mjs',import.meta.url),'utf8');
const trades=fs.readFileSync(new URL('../src/pump-live-trade-feed.mjs',import.meta.url),'utf8');

assert.match(app,/MEMEFLOW_FRESH_SESSION_SCANNER_V1/);
assert.match(app,/__mfScannerRuntimeStartedAt/);
assert.match(app,/__mfLiveScannerTokens/);
assert.match(app,/const _tokens=__mfLiveScannerTokens\(\)\.slice\(0,_lim\)/);
assert.match(app,/freshScannerTokens:__mfLiveScannerTokens\(\)\.length/);
assert.match(app,/setHeader\('cache-control','no-store'\)/);

const discovery=app.slice(
  app.indexOf('function startDiscovery(i=0){'),
  app.indexOf('function shadowValidateSettings')
);
const createAt=discovery.indexOf('__ingestPumpCreateEventDirect(');
const tradeAt=discovery.indexOf('__pumpLiveTradeFeed?.ingestLogs?.(');
assert.ok(createAt>=0,'direct CREATE ingest missing');
assert.ok(tradeAt>=0,'TradeEvent ingest missing');
assert.ok(createAt<tradeAt,'CREATE must establish mint before same-tx TradeEvent ingest');

assert.match(holders,/EVENT_HOLDER_LEDGER_PERSIST/);
assert.match(holders,/if\(!PERSIST\)return/);
assert.match(holders,/persistenceEnabled:PERSIST/);

const decodedAt=trades.indexOf('const e=decodeTradeEvent(b);');
const knownAt=trades.indexOf('const known=tokenFromStore(store,e.mint);');
const dedupeAt=trades.indexOf('const key=tradeEventKey(e,signature,i);');
assert.ok(decodedAt>=0&&knownAt>decodedAt,'known-mint gate must follow decode');
assert.ok(dedupeAt>knownAt,'known-mint gate must run before dedupe');

// JsonStore must persist token snapshots ONLY for OPEN positions.
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'mf-fresh-store-'));
try{
  const s=new JsonStore(tmp);
  s.state.tokens={
    stale:{mint:'stale',name:'STALE'},
    open:{mint:'open',name:'OPEN'}
  };
  s.state.paperPositions={
    p1:{id:'p1',mint:'open',status:'OPEN'}
  };
  s.save();
  await new Promise(r=>setTimeout(r,350));
  const disk=JSON.parse(fs.readFileSync(path.join(tmp,'state.json'),'utf8'));
  assert.deepEqual(Object.keys(disk.tokens||{}),['open']);
  assert.equal(disk.decisions,undefined);
}finally{
  fs.rmSync(tmp,{recursive:true,force:true});
}

// Actual TradeEvent test: unknown mint must not create a token row, and because
// the gate is before dedupe the same event can be accepted once CREATE is known.
const oldWs=process.env.SOLANA_WS_URLS;
const oldRpc=process.env.SOLANA_RPC_URLS;
process.env.SOLANA_WS_URLS='';
process.env.SOLANA_RPC_URLS='';

const B58='123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
function b58(buf){
  let x=0n;
  for(const b of buf)x=(x<<8n)+BigInt(b);
  let s='';
  while(x){const r=Number(x%58n);s=B58[r]+s;x/=58n}
  for(const b of buf){if(b!==0)break;s='1'+s}
  return s||'1';
}
const u64=n=>{const b=Buffer.alloc(8);b.writeBigUInt64LE(BigInt(n));return b};
const i64=n=>{const b=Buffer.alloc(8);b.writeBigInt64LE(BigInt(n));return b};
const disc=crypto.createHash('sha256').update('event:TradeEvent').digest().subarray(0,8);
const mintBytes=Buffer.alloc(32,7);
const userBytes=Buffer.alloc(32,8);
const mint=b58(mintBytes);
const event=Buffer.concat([
  disc,
  mintBytes,
  u64(1_000_000_000n),
  u64(100_000_000n),
  Buffer.from([1]),
  userBytes,
  i64(1_700_000_000n),
  u64(30_000_000_000n),
  u64(1_000_000_000_000n),
  u64(20_000_000_000n),
  u64(500_000_000_000n)
]);
const log='Program data: '+event.toString('base64');

let writes=0;
const fakeStore={
  state:{tokens:{}},
  setToken(m,patch){
    writes++;
    this.state.tokens[m]={...(this.state.tokens[m]||{}),...patch,mint:m};
    return this.state.tokens[m];
  }
};
const fakeHolder={
  ingestTradeEventDirect(){return {mint}},
  applyToStore(store,m){return store.setToken(m,{holderFresh:true,holderCount:1})},
  setCreator(){}
};
const feed=startPumpLiveTradeFeed({
  eventHolderLedger:fakeHolder,
  store:fakeStore,
  publish(){},
  publishTrade(){},
  evaluateAI(){return null}
});

const first=feed.ingestLogs([log],{signature:'same-signature',source:'test'});
assert.equal(first,0);
assert.equal(writes,0);
assert.equal(feed.metrics().unknownMintEventsIgnored,1);

fakeStore.state.tokens[mint]={mint,wsFirst:true};
const second=feed.ingestLogs([log],{signature:'same-signature',source:'test'});
assert.equal(second,1);
assert.ok(writes>0);
feed.stop();

if(oldWs===undefined)delete process.env.SOLANA_WS_URLS;else process.env.SOLANA_WS_URLS=oldWs;
if(oldRpc===undefined)delete process.env.SOLANA_RPC_URLS;else process.env.SOLANA_RPC_URLS=oldRpc;

console.log('fresh session scanner v1 ok');
'''
    new_test.write_text(test_text, encoding="utf-8")

    pkg_text = replace_once(
        pkg_text,
        '"test": "node tests/ws-first-preopen-rpc.mjs &&',
        '"test": "node tests/fresh-session-scanner.mjs && node tests/ws-first-preopen-rpc.mjs &&',
        "package/add-regression-test",
    )

    (app / "app-server.mjs").write_text(app_text, encoding="utf-8")
    (app / "src" / "store.mjs").write_text(store_text, encoding="utf-8")
    (app / "src" / "event-holder-ledger.mjs").write_text(holder_text, encoding="utf-8")
    (app / "src" / "pump-live-trade-feed.mjs").write_text(trade_text, encoding="utf-8")
    (app / "package.json").write_text(pkg_text, encoding="utf-8")

    print("=== Syntax checks ===")
    for p in [
        app / "app-server.mjs",
        app / "src" / "store.mjs",
        app / "src" / "event-holder-ledger.mjs",
        app / "src" / "pump-live-trade-feed.mjs",
        new_test,
    ]:
        run(["node", "--check", str(p)], cwd=root)

    print("=== Fresh-session regression ===")
    run(["node", "tests/fresh-session-scanner.mjs"], cwd=app)

    print("=== Full test suite ===")
    run(["npm", "test"], cwd=app)

    print("=== Diff validation ===")
    run(["git", "diff", "--check"], cwd=root)

except BaseException as e:
    print(f"ERROR: {e}")
    print("Rolling back local patch changes...")
    for p, text in originals.items():
        p.write_text(text, encoding="utf-8")
    if test_existed:
        new_test.write_text(test_original, encoding="utf-8")
    else:
        try:
            new_test.unlink()
        except FileNotFoundError:
            pass
    print("Rollback complete. No commit/push was made.")
    raise

print("=== Commit + push ===")
changed = [
    app / "app-server.mjs",
    app / "src" / "store.mjs",
    app / "src" / "event-holder-ledger.mjs",
    app / "src" / "pump-live-trade-feed.mjs",
    app / "package.json",
    new_test,
]
rel = [str(p.relative_to(root)) for p in changed]
run(["git", "add", "--", *rel], cwd=root)
run(
    ["git", "commit", "-m", "[MEMEFLOW_FRESH_SESSION_SCANNER_V1_FIXED] Remove stale scanner cache"],
    cwd=root,
)
run(["git", "push", "origin", "HEAD"], cwd=root)

print()
print("============================================================")
print(" MEMEFLOW_FRESH_SESSION_SCANNER_V1_FIXED INSTALLED SUCCESSFULLY")
print("============================================================")
print("Restart the Replit backend/deployment.")
print("Expected after restart:")
print(" - old scanner candidates do not return")
print(" - holder ledger persistenceEnabled=false")
print(" - freshScannerTokens contains only current-session CREATE tokens")
print(" - unknown Pump trade mints are ignored instead of creating scanner rows")
