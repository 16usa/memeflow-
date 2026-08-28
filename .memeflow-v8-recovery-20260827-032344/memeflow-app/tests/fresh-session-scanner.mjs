import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';

import {JsonStore} from '../src/store.mjs';
import {startPumpLiveTradeFeed} from '../src/pump-live-trade-feed.mjs';

const app=fs.readFileSync(new URL('../app-server.mjs',import.meta.url),'utf8');
const holders=fs.readFileSync(new URL('../src/event-holder-ledger.mjs',import.meta.url),'utf8');
const trades=fs.readFileSync(new URL('../src/pump-live-trade-feed.mjs',import.meta.url),'utf8');

assert.match(app,/MEMEFLOW_PERMANENT_TOKEN_REGISTRY_V1/);
assert.match(app,/MEMEFLOW_RESTART_CONTINUITY_V1/);
assert.match(app,/__mfScannerRuntimeStartedAt/);
assert.match(app,/__mfLiveScannerTokens/);
assert.match(app,/freshScannerTokens:__mfLiveScannerTokens\(\)\.length/);
assert.match(app,/scannerTokenLifetime:'permanent-registry'/);
assert.match(app,/scannerCacheMaxTokens:__mfScannerCacheMaxTokens/);
assert.doesNotMatch(app,/LIVE_SCANNER_TOKEN_TTL_MS/);
assert.doesNotMatch(app,/SESSION_OR_TTL_EXPIRED/);
assert.match(app,/setHeader\('cache-control','no-store'\)/);

// MEMEFLOW_LIVE_TOKEN_VISIBILITY_V5_DIRTY_SAFE
// Scanner sees all. Entry Filters classify Live Token States and strictly gate
// trading. They must never silently erase PENDING/REJECTED rows from this UI.
const liveRoute=app.slice(
  app.indexOf("if(url.pathname==='/api/system/live-token-states'"),
  app.indexOf("if(url.pathname==='/api/ai/decisions'")
);
assert.match(liveRoute,/MEMEFLOW_LIVE_TOKEN_VISIBILITY_V5_DIRTY_SAFE/);
assert.match(liveRoute,/const _rawTokens=__mfLiveScannerTokens\(\)/);
assert.match(liveRoute,/state:_blocked\?'BLOCKED':'WAITING'/);
assert.match(liveRoute,/preAdmissionPending:_pending/);
assert.match(liveRoute,/preAdmissionRejected:_rejected/);
assert.match(liveRoute,/preAdmissionHidden:0/);
assert.match(liveRoute,/system-live-token-states-transparent-v5/);
assert.doesNotMatch(liveRoute,/_hiddenBySettings\+\+;\s*continue/);
assert.doesNotMatch(liveRoute,/Math\.min\(500/);
assert.doesNotMatch(liveRoute,/_rawTokens\.slice\(0,_lim\)/);

assert.doesNotMatch(app,/MEMEFLOW_AGE_THRESHOLD_WAKE_V1/);
assert.match(app,/const __mfPreAdmissionSweepTimer=setInterval/);
assert.match(app,/trade-ineligible -> trade-eligible/);
assert.match(app,/MEMEFLOW_CREATE_DECODE_COVERAGE_V1/);
assert.match(app,/createDecodeCoveragePct/);

const discovery=app.slice(
  app.indexOf('function startDiscovery(i=0){'),
  app.indexOf('function shadowValidateSettings')
);
const createAt=discovery.indexOf('__ingestPumpCreateEventDirect(');
const tradeAt=discovery.indexOf('__pumpLiveTradeFeed?.ingestLogs?.(');
assert.ok(createAt>=0,'direct CREATE ingest missing');
assert.ok(tradeAt>=0,'TradeEvent ingest missing');
assert.ok(createAt<tradeAt,'CREATE must establish mint before same-tx TradeEvent ingest');

// MEMEFLOW_SETTINGS_CONTROL_SCANNER_RETENTION_V1
// A token must be allowed to survive until the USER'S configured minimum age.
// Opportunity/dead signals can affect the decision, but cannot silently delete
// the raw Pump scanner row at 45/60/90 seconds.
const currentScannerFn=app.slice(
  app.indexOf('function __mfIsCurrentScannerToken('),
  app.indexOf('function __mfLiveScannerTokens(')
);
assert.doesNotMatch(currentScannerFn,/token\.dead\s*!==\s*true/);

const pruneScannerFn=app.slice(
  app.indexOf('function __mfPruneScannerRuntimeState('),
  app.indexOf('const __mfScannerPruneTimer=')
);
assert.doesNotMatch(pruneScannerFn,/opportunityEngine\?\.staleReason/);
assert.doesNotMatch(pruneScannerFn,/const lifecycleReason=/);
assert.doesNotMatch(pruneScannerFn,/STABLE_SETTINGS_REJECTED/);
assert.doesNotMatch(pruneScannerFn,/SESSION_OR_TTL_EXPIRED/);
assert.match(pruneScannerFn,/HOT_CACHE_CAPACITY_EVICTED/);

// Scanner/chart evidence collection must not depend on any user's filters.
const publishTradeFn=app.slice(
  app.indexOf('function publishTrade('),
  app.indexOf('function recordTradeWindow(')
);
assert.doesNotMatch(publishTradeFn,/__mfAnyActiveEntryAdmitted/);

const bridgeFn=app.slice(
  app.indexOf('async function runDiscoveryBridge()'),
  app.indexOf('function startDiscoveryBridge()')
);
assert.doesNotMatch(bridgeFn,/settingsGateCachedRejection/);

const bridgeRepairFn=app.slice(
  app.indexOf('async function bridgeRepairToken('),
  app.indexOf('let bridgeTimer=null')
);
assert.doesNotMatch(bridgeRepairFn,/settingsGateCheck\(token\)/);
assert.doesNotMatch(bridgeRepairFn,/holderAdmissionForActiveUsers\(mint\)/);

const fastPhaseFn=app.slice(
  app.indexOf('function fastPhaseAStart('),
  app.indexOf('// MEMEFLOW_WS_ONLY_PREOPEN_RPC_V1',app.indexOf('function fastPhaseAStart('))
);
assert.doesNotMatch(fastPhaseFn,/settingsGateCheck\(token\)/);
assert.doesNotMatch(fastPhaseFn,/holderAdmissionForActiveUsers\(mint\)/);

// Trading decisions remain gated.
assert.match(app,/admissionCheck:__mfLiveEvalAdmissionCheck/);
const aiDecisionRoute=app.slice(
  app.indexOf("if(url.pathname==='/api/ai/decisions'"),
  app.indexOf("if(url.pathname==='/api/debug/filter-pipeline'")
);
assert.match(aiDecisionRoute,/__mfAdmittedScannerTokensForUser\(u\.id\)/);

assert.doesNotMatch(
  app,
  /onDead:\s*\(mint,reason\)=>__mfDropScannerToken\(mint,reason\)/
);

// MEMEFLOW_SETTINGS_ONLY_DISCOVERY_V1 + MEMEFLOW_WS_ONLY_PREOPEN_RPC_V1
assert.doesNotMatch(discovery,/enqueue\s*\(/);
assert.doesNotMatch(discovery,/getTransaction/);
assert.doesNotMatch(app,/async function processSignature\s*\(/);
assert.doesNotMatch(app,/const discQueue=makeDiscoveryQueue\s*\(/);
assert.doesNotMatch(app,/directCreateFallbackQueued/);
assert.doesNotMatch(discovery,/EXCLUDE_MAYHEM_MODE/);

const directCreate=app.slice(
  app.indexOf('function __ingestPumpCreateEventDirect('),
  app.indexOf('function startDiscovery(i=0){')
);
assert.match(directCreate,/pumpCreatedAt/);
assert.match(directCreate,/isMayhemMode:e\.isMayhemMode===true/);
assert.match(directCreate,/source:'Pump CreateEvent WS'/);

assert.match(holders,/EVENT_HOLDER_LEDGER_PERSIST/);
assert.match(holders,/if\(!PERSIST\)return/);
assert.match(holders,/persistenceEnabled:PERSIST/);

const decodedAt=trades.indexOf('const e=decodeTradeEvent(b);');
const knownAt=trades.indexOf('const known=tokenFromStore(store,e.mint);');
const dedupeAt=trades.indexOf('const key=tradeEventKey(e,signature,i);');
assert.ok(decodedAt>=0&&knownAt>decodedAt,'known-mint gate must follow decode');
assert.ok(dedupeAt>knownAt,'known-mint gate must run before dedupe');

// state.json stays compact, while SQLite permanently preserves scanner tokens.
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'mf-registry-store-'));
let s=null,s2=null;
try{
  s=new JsonStore(tmp);
  s.state.paperPositions={
    p1:{id:'p1',mint:'open',status:'OPEN'}
  };

  s.addToken({
    mint:'recent',
    name:'RECENT',
    wsFirst:true,
    launchPlatform:'pump',
    pumpCreatedAt:Date.now()-60_000,
    discoveredAt:Date.now()-60_000
  });

  s.addToken({
    mint:'open',
    name:'OPEN',
    wsFirst:true,
    launchPlatform:'pump',
    pumpCreatedAt:Date.now()-120_000,
    discoveredAt:Date.now()-120_000
  });

  s.save();
  await new Promise(r=>setTimeout(r,500));
  s.tokenRegistry.flush();

  const disk=JSON.parse(fs.readFileSync(path.join(tmp,'state.json'),'utf8'));
  assert.deepEqual(Object.keys(disk.tokens||{}),['open']);
  assert.equal(disk.decisions,undefined);

  assert.ok(s.tokenRegistry.count()>=2);
  s.close();s=null;

  s2=new JsonStore(tmp);
  assert.equal(s2.getToken('recent')?.mint,'recent');
  assert.equal(s2.getToken('open')?.mint,'open');
  assert.ok(s2.registryStatus().permanentTokens>=2);
}finally{
  try{s?.close?.()}catch{}
  try{s2?.close?.()}catch{}
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
