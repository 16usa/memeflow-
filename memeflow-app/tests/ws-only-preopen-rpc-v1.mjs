import assert from 'node:assert/strict';
import fs from 'node:fs';

const app=fs.readFileSync(new URL('../app-server.mjs',import.meta.url),'utf8');
const settings=fs.readFileSync(new URL('../src/settings.mjs',import.meta.url),'utf8');
const gate=fs.readFileSync(new URL('../src/settings-gate.mjs',import.meta.url),'utf8');
const page=fs.readFileSync(new URL('../settings-page.js',import.meta.url),'utf8');
const system=fs.readFileSync(new URL('../system.js',import.meta.url),'utf8');
const feed=fs.readFileSync(new URL('../src/pump-live-trade-feed.mjs',import.meta.url),'utf8');
const holders=fs.readFileSync(new URL('../src/event-holder-ledger.mjs',import.meta.url),'utf8');
const chart=fs.readFileSync(new URL('../src/chart-history-archive.mjs',import.meta.url),'utf8');
const discoveryMetrics=fs.readFileSync(new URL('../src/discqueue.mjs',import.meta.url),'utf8');

// Automatic scanner transport is WebSocket-only.
assert.match(feed,/const urls=envList\('SOLANA_WS_URLS'\)/);
assert.doesNotMatch(feed,/SOLANA_RPC_URLS/);
assert.match(feed,/No Solana HTTP RPC in the live scanner hot path/);
assert.match(feed,/httpRpcCalls:0/);

// Keep the newer authoritative Pump creation-time fix while removing its
// getTransaction fallback.
assert.match(gate,/token\.pumpCreatedAt/);
const directCreateSource=app.slice(
  app.indexOf('function __ingestPumpCreateEventDirect('),
  app.indexOf('function startDiscovery(i=0){')
);
assert.match(directCreateSource,/pumpCreatedAt/);
assert.match(directCreateSource,/source:'Pump CreateEvent WS'/);
assert.doesNotMatch(app,/enqueue\(String\(sig\)\)/);
assert.doesNotMatch(app,/directCreateFallbackQueued/);
assert.doesNotMatch(discoveryMetrics,/directCreateFallbackQueued/);

// MEMEFLOW_TEST_ARCHITECTURE_CLEANUP_V35_7
//
// Live discovery/market observation stays WS-only. Canonical holder evidence
// and DISPLAY-ONLY chart history are bounded users of the ONE protected pool.
for(const obsolete of [
  'enrichToken',
  'makeDiscoveryQueue',
  'discQueue',
  'processSignature(sig)',
  'dexPaidVerifier',
  'createDexPaidVerifier',
  '__mfDexPaid'
]){
  assert.equal(app.includes(obsolete),false,`obsolete runtime path remains: ${obsolete}`);
}

const rpcPools=[...app.matchAll(/new RpcPool\s*\(/g)];
assert.equal(rpcPools.length,1,'exactly one protected RpcPool may exist');
assert.match(app,/const __mfPreOpenRpc[\s\S]*?new RpcPool\s*\(/);

// Final wallet-risk verification stays on the protected pool.
assert.match(app,/scanWalletClusterRisk\(\{\s*rpc:__mfPreOpenRpc,\s*token\s*\}\)/s);
assert.match(app,/THIS is the first automatic Solana HTTP RPC stage/);

// Canonical exact holders are allowed only with the current pressure controls.
assert.match(app,/const holderQueue=makeHolderQueue\(/);
assert.match(
  app,
  /enrichHolders\(mint,\{rpc:__mfPreOpenRpc,store,evaluateAll,publish,enrichDiag\}\)/
);
assert.match(app,/MEMEFLOW_WS_HOLDER_PREVIEW_RPC_CLEANUP_V32/);
assert.match(app,/MEMEFLOW_CANONICAL_HOLDER_SCHEDULER_V33/);
assert.match(app,/MEMEFLOW_CANONICAL_HOLDER_STABLE_GATE_V34/);
assert.match(app,/MEMEFLOW_CANONICAL_HOLDER_LEGACY_ADMISSION_UNUSED_V34/);

const holderQueueConstruction=
  app.match(/const holderQueue=makeHolderQueue\([^\n]+/)?.[0]||'';
assert.ok(holderQueueConstruction,'holderQueue construction missing');
assert.doesNotMatch(holderQueueConstruction,/admissionFn/);

// Historical chart backfill is read-only DISPLAY work on the same pool.
assert.match(app,/const __mfChartHistoryRpc=/);
assert.match(app,/method!=='getSignaturesForAddress'/);
assert.match(app,/method!=='getTransaction'/);
assert.match(app,/new ChartHistoryArchive\(\{/);
assert.match(app,/rpc:__mfChartHistoryRpc/);

// Generic legacy callers remain fail-fast. Copy Trading is the only additional
// consumer of the existing protected pool, and its wrapper permits only exact
// tracked-wallet SELL reconciliation methods. Scanner transport stays WS-only.
// MEMEFLOW_COPY_TRADING_RPC_TEST_V2
assert.match(app,/SOLANA_HTTP_RPC_DISABLED_OUTSIDE_PREOPEN/);
assert.match(app,/new CopyTradingManager\(\{store,paper,rpc:__mfCopyTradingRpc\}\)/);
assert.match(app,/MEMEFLOW_COPY_TRADING_RPC_RECONCILIATION_V2/);
assert.match(app,/method!=='getTransaction'&&method!=='getTokenAccountsByOwner'/);

// Fast market + holder OBSERVATION comes from WebSocket TradeEvents.
// Validate actual semantics, not a disposable source-code comment.
assert.match(app,/function ensurePriceTimer\(\)\{\s*return false;\s*\}/s);
assert.match(holders,/ingestTradeEventDirect/);
assert.match(holders,/holderRiskWallets/);
assert.match(holders,/setCreateState/);
assert.match(holders,/holderCountAuthoritative:false/);
assert.match(holders,/holderCountIsLowerBound:true/);
assert.match(app,/observedHolderCount/);
assert.match(app,/holderCountIsLowerBound/);

// Live chart ticks remain TradeEvent-driven. Persistent historical chart
// backfill may use the restricted read-only wrapper and is explicitly excluded
// from AI/risk/execution decisions.
assert.match(chart,/ensureBackfill\(mint,/);
assert.match(chart,/getSignaturesForAddress/);
assert.match(chart,/getTransaction/);
assert.match(chart,/source: 'pump-history-backfill'/);
assert.match(
  chart,
  /history is never used for AI\/risk\/execution decisions/
);

// DEX Paid is fully inactive/removed. settings.mjs retains one cleanup-only
// delete so stale saved user objects cannot resurrect the old key.
for(const source of [app,gate,page,system]){
  assert.doesNotMatch(source,/requireDexPaid|dexPaidConfirmed|dexPaidVerifier|DEX Paid/i);
}
assert.doesNotMatch(settings,/booleans=\[[^\]]*requireDexPaid/s);
assert.doesNotMatch(settings,/requireWebsiteOrX:false,requireDexPaid:false/);
assert.match(settings,/delete o\.requireDexPaid/);

// Final wallet-risk controls stay final-only.
assert.match(gate,/PREOPEN_RPC_KEYS/);
assert.match(gate,/maxSuspectedRiskyWalletsPct/);
assert.match(gate,/maxInsidersPct/);
assert.match(page,/Pre-open RPC verification/);
assert.match(page,/Maximum linked \/ risky wallets %/);
assert.match(page,/Maximum insiders \/ common-funder wallets %/);

console.log('ws-only pre-open rpc cleanup v1.1 ok');
