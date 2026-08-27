import assert from 'node:assert/strict';
import fs from 'node:fs';

const app=fs.readFileSync(new URL('../app-server.mjs',import.meta.url),'utf8');
const registry=fs.readFileSync(new URL('../src/token-registry.mjs',import.meta.url),'utf8');
const trades=fs.readFileSync(new URL('../src/pump-live-trade-feed.mjs',import.meta.url),'utf8');
const tokenHtml=fs.readFileSync(new URL('../system-tokens.html',import.meta.url),'utf8');

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
assert.match(app,/if\(current\?\.wsFirst===true\)\{/);
assert.match(app,/pumpReportedMarketCapUsd/);
assert.match(app,/pumpReportedHolderCount/);
assert.match(app,/__mfQueueHistoryEvaluation\(hot\)/);
assert.match(app,/HISTORY_EVAL_INTERVAL_MS/);


// Live Token States must be event-driven, and a token mutation must invalidate
// any per-user response cached before that mutation.
const tokenUi=fs.readFileSync(new URL('../system-tokens.js',import.meta.url),'utf8');
assert.match(app,/let __mfLiveTokenRevision=0;/);
assert.match(app,/const __liveRevision=\+\+__mfLiveTokenRevision;/);
assert.match(app,/revision:__liveRevision/);
assert.match(app,/Number\(_cached\.liveRevision\|\|0\)===__mfLiveTokenRevision/);
assert.match(app,/liveRevision:__mfLiveTokenRevision/);
assert.match(tokenUi,/new EventSource\('\/api\/system\/stream'\)/);

// MEMEFLOW_REALTIME_CARD_DELTA_TEST_V14
assert.match(app,/MEMEFLOW_DECISION_REVISION_EVENT_V14/);
assert.match(app,/MEMEFLOW_DECISION_COMPLETE_REFRESH_V14/);
assert.match(app,/MEMEFLOW_ADMISSION_REVISION_EVENT_V14/);
assert.match(app,/MEMEFLOW_SINGLE_TOKEN_LIVE_ROUTE_V14/);
assert.match(app,/\/api\/system\/live-token-state/);
assert.match(app,/liveRevision:__mfLiveTokenRevision/);
assert.match(tokenUi,/MEMEFLOW_SYSTEM_TOKENS_REALTIME_V14/);
assert.match(tokenUi,/__mfScheduleMintRefreshV14/);
assert.match(tokenUi,/__mfHandleTokenEventV14/);
assert.match(tokenUi,/__mfHandleDecisionEventV14/);
assert.match(tokenUi,/source\.addEventListener\([\s\S]*?'token',[\s\S]*?__mfHandleTokenEventV14/);
assert.match(tokenUi,/source\.addEventListener\([\s\S]*?'decision',[\s\S]*?__mfHandleDecisionEventV14/);
assert.match(tokenUi,/\/api\/system\/live-token-state\?mint=/);
assert.match(tokenUi,/LIVE_RECONCILE_MS_V14 = 30000/);
assert.match(tokenUi,/state\.refreshPending = true;/);
assert.match(tokenUi,/queueMicrotask\(loadTokens\)/);
assert.match(tokenUi,/readyState !== EventSource\.OPEN/);

// MEMEFLOW_LIVE_TOKEN_ASSET_NO_STORE_V1
assert.match(app,/MEMEFLOW_LIVE_TOKEN_ASSET_NO_STORE_V1/);
assert.match(app,/url\.pathname==='\/system-tokens\.js'/);
assert.match(app,/url\.pathname==='\/system-tokens\.css'/);
assert.match(tokenHtml,/system-tokens\.js\?v=realtime-card-v14-20260827/);
assert.match(tokenHtml,/id="scannerStatus"/);
assert.match(tokenUi,/MEMEFLOW_SCANNER_STATUS_V9/);
assert.match(tokenUi,/MEMEFLOW_LIVE_TOKEN_TELEMETRY_V9/);
assert.match(tokenUi,/MINT_REFRESH_COALESCE_MS_V14 = 80/);
assert.match(route,/MEMEFLOW_LIVE_TOKEN_FEED_BRIDGE_V13/);
assert.match(tokenUi,/MEMEFLOW_LIVE_TOKEN_FEED_DIAGNOSTICS_V13/);
assert.match(tokenUi,/feed \$\{state\.feedReturned\}\/\$\{state\.feedWorkingSet\}/);

console.log('realtime update path v1 ok');
