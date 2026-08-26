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

// The automatic scanner has no legacy HTTP holder/discovery/price poll engine.
for(const obsolete of [
  'makeHolderQueue',
  'enrichHolders',
  'enrichToken',
  'makeDiscoveryQueue',
  'discQueue',
  'processSignature(sig)',
  'getProgramAccounts(holder scan)',
  'dexPaidVerifier',
  'createDexPaidVerifier',
  '__mfDexPaid'
]){
  assert.equal(app.includes(obsolete),false,`obsolete runtime path remains: ${obsolete}`);
}

// Exactly one real RpcPool may exist in the application runtime,
// and it is the dedicated BUY READY -> pre-open wallet-cluster verifier.
const rpcPools=[...app.matchAll(/new RpcPool\s*\(/g)];
assert.equal(rpcPools.length,1,'only the final pre-open RpcPool may exist');
assert.match(app,/const __mfPreOpenRpc[\s\S]*?new RpcPool\s*\(/);
assert.match(app,/scanWalletClusterRisk\(\{\s*rpc:__mfPreOpenRpc,\s*token\s*\}\)/s);
assert.match(app,/THIS is the first automatic Solana HTTP RPC stage/);

// Generic legacy callers are deliberately wired to a fail-fast NO-NETWORK shim.
assert.match(app,/SOLANA_HTTP_RPC_DISABLED_OUTSIDE_PREOPEN/);
assert.match(app,/new CopyTradingManager\(\{store,paper,rpc:null\}\)/);

// Price/holder scanner evidence now comes from WebSocket TradeEvents only.
assert.match(app,/function ensurePriceTimer\(\)\{\s*return false;\s*\}/s);
assert.match(app,/WS-only compatibility holder adapter/);
assert.match(holders,/ingestTradeEventDirect/);
assert.match(holders,/holderRiskWallets/);
assert.match(holders,/setCreateState/);

// Chart keeps live/disk history, but historical HTTP RPC backfill is disabled.
assert.match(chart,/backfillDisabled:true/);

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
