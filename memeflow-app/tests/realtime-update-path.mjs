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
assert.match(app,/MEMEFLOW_NO_DYNAMIC_RESPONSE_CACHE_V20_8_8/);
assert.doesNotMatch(route,/tokenRegistry\?\.count\?\.\(\)/);

// Historical HTTP sync cannot overwrite an already-live WS snapshot and its
// expensive evaluations are explicitly low priority.
assert.match(app,/MEMEFLOW_REALTIME_HISTORY_ISOLATION_V1/);
assert.match(app,/if\(current\?\.wsFirst===true\)\{/);
assert.match(app,/pumpReportedMarketCapUsd/);
assert.match(app,/pumpReportedHolderCount/);
assert.match(app,/__mfQueueHistoryEvaluation\(hot\)/);
assert.match(app,/HISTORY_EVAL_INTERVAL_MS/);


// MEMEFLOW_ONE_SECOND_MUTABLE_UI_TEST_V17
// Backend remains event-driven, but the page deliberately refreshes current
// mutable truth every exactly 1000ms. Static token identity/source UI must not
// be touched by the one-second patcher.
const tokenUi=fs.readFileSync(new URL('../system-tokens.js',import.meta.url),'utf8');

assert.match(app,/let __mfLiveTokenRevision=0;/);
assert.match(app,/MEMEFLOW_DECISION_MICROTASK_EVENT_V16/);
assert.match(app,/MEMEFLOW_SINGLE_TOKEN_LIVE_ROUTE_V14/);

assert.match(tokenUi,/MEMEFLOW_SYSTEM_TOKENS_ONE_SECOND_V17/);
assert.match(tokenUi,/MEMEFLOW_PER_MINT_BATCH_REFRESH_V18/);

// MEMEFLOW_KEYED_CARD_RECONCILE_TEST_V18_3
assert.match(tokenUi,/MEMEFLOW_KEYED_CARD_RECONCILE_V18_3/);
assert.match(tokenUi,/MEMEFLOW_STRUCTURE_NO_FULL_RENDER_V18_3/);
assert.match(tokenUi,/list\.append\(card\)/);

const structureV183=tokenUi.slice(
  tokenUi.indexOf('async function __mfLoadStructureV18(){'),
  tokenUi.indexOf('async function loadTokens(){')
);

assert.doesNotMatch(
  structureV183,
  /\brender\(\);/
);

const oneSecondV183=tokenUi.slice(
  tokenUi.indexOf('async function loadTokens(){'),
  tokenUi.indexOf("document\n  .querySelectorAll(\n    '.summary-card'")
);

assert.doesNotMatch(
  oneSecondV183,
  /tokenList['"]?\)?\.innerHTML/
);
assert.doesNotMatch(
  oneSecondV183,
  /\brender\(\);/
);
assert.match(tokenUi,/MEMEFLOW_PER_MINT_ONE_SECOND_CLOCK_V18/);
assert.match(tokenUi,/\/api\/system\/live-token-card-batch/);
assert.match(tokenUi,/\/api\/paper\/positions\/live/);
assert.match(tokenUi,/MEMEFLOW_VISIBLE_MINTS_ONLY_V19/);
assert.match(tokenUi,/MEMEFLOW_STRUCTURE_MEMBERSHIP_ONLY_V19/);
assert.match(tokenUi,/MEMEFLOW_OPEN_POSITION_SINGLE_FLIGHT_V19/);
assert.match(tokenUi,/const __MF_CARD_REFRESH_MS_V17=1000/);
assert.match(tokenUi,/MEMEFLOW_SINGLE_CARD_CLOCK_V19/);
assert.match(tokenUi,/setTimeout\([\s\S]*?__mfRunCardClockV19/);
assert.doesNotMatch(tokenUi,/setInterval\([\s\S]*?__mfPollOneSecondV17/);
assert.match(tokenUi,/MEMEFLOW_NO_CATCHUP_BURST_V19/);
assert.match(tokenUi,/Promise\.allSettled\(\[[\s\S]*?loadTokens\(\)[\s\S]*?__mfRefreshOpenPositionsV16\(\)/);
assert.match(tokenUi,/MEMEFLOW_ONE_SECOND_SNAPSHOT_APPLY_V17/);
assert.match(tokenUi,/MEMEFLOW_ONE_SECOND_MUTABLE_ONLY_V17/);
assert.match(tokenUi,/MEMEFLOW_STATIC_TOKEN_IDENTITY_V16/);
assert.match(tokenUi,/MEMEFLOW_NO_METADATA_POLLING_V16/);
assert.match(tokenUi,/MEMEFLOW_NO_TOKEN_MEDIA_POLLING_V16/);

const mutablePatch=tokenUi.slice(
  tokenUi.indexOf('function __mfPatchMutableCardV17('),
  tokenUi.indexOf('async function __mfPollOneSecondV17(')
);

assert.doesNotMatch(mutablePatch,/querySelector\(['"]\.token-name/);
assert.doesNotMatch(mutablePatch,/querySelector\(['"]\.token-avatar/);
assert.doesNotMatch(mutablePatch,/querySelector\(['"]\.token-pump-link/);
assert.doesNotMatch(mutablePatch,/\.src\s*=/);
assert.doesNotMatch(mutablePatch,/\.href\s*=/);

assert.doesNotMatch(tokenUi,/MEMEFLOW_SYSTEM_TOKENS_EVENT_FACT_V16/);
assert.doesNotMatch(tokenUi,/new EventSource\('\/api\/system\/stream'\)/);
const oneSecondPoll=tokenUi.slice(
  tokenUi.indexOf('async function __mfPollOneSecondV17('),
  tokenUi.indexOf("if(typeof loadDiscoveryStatus==='function')")
);

assert.ok(
  oneSecondPoll.length>0,
  'V17 one-second poll function must exist'
);
assert.doesNotMatch(oneSecondPoll,/hydrateTokenCardsV16/);
assert.doesNotMatch(oneSecondPoll,/hydrateTokenMediaV25/);

// MEMEFLOW_VERSIONED_LIVE_TOKEN_ASSET_CACHE_V20_8_8
assert.match(app,/MEMEFLOW_LOAD_PERF_V1_CACHE/);
assert.match(app,/const isVersionedLiveTokenAsset=/);
assert.match(app,/isLiveTokenAsset&&!isVersionedLiveTokenAsset/);
assert.match(app,/public, max-age=31536000, immutable/);
assert.match(app,/url\.pathname==='\/system-tokens\.js'/);
assert.match(app,/url\.pathname==='\/system-tokens\.css'/);
assert.match(
  tokenHtml,
  /system-tokens\.js\?v=[^"]+/,
  'system-tokens.js must remain cache-busted'
);
assert.match(tokenHtml,/id="scannerStatus"/);
assert.match(tokenUi,/MEMEFLOW_SCANNER_STATUS_V9/);
assert.match(tokenUi,/MEMEFLOW_LIVE_TOKEN_TELEMETRY_V9/);
assert.match(tokenUi,/MEMEFLOW_SYSTEM_TOKENS_ONE_SECOND_V17/);
assert.match(route,/MEMEFLOW_LIVE_TOKEN_FEED_BRIDGE_V13/);
assert.match(tokenUi,/MEMEFLOW_LIVE_TOKEN_FEED_DIAGNOSTICS_V13/);
assert.match(tokenUi,/feed \$\{state\.feedReturned\}\/\$\{state\.feedWorkingSet\}/);

console.log('realtime update path v1 ok');
