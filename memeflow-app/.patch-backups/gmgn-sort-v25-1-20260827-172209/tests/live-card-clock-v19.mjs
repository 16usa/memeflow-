import assert from 'node:assert/strict';
import fs from 'node:fs';

const ui=fs.readFileSync(
  new URL('../system-tokens.js',import.meta.url),
  'utf8'
);

const app=fs.readFileSync(
  new URL('../app-server.mjs',import.meta.url),
  'utf8'
);

const moduleSource=fs.readFileSync(
  new URL('../src/live-card-market.mjs',import.meta.url),
  'utf8'
);

// Backend must ACTUALLY call the truth module; an import/marker alone is not enough.
const marketFn=app.slice(
  app.indexOf('function __mfCandidateMarket5mV4('),
  app.indexOf('// MEMEFLOW_REALTIME_UI_FAIRNESS_V1')
);

assert.match(marketFn,/MEMEFLOW_LIVE_CARD_MARKET_TRUTH_V19/);
assert.match(marketFn,/liveCardMarketSnapshot\(\{/);
assert.doesNotMatch(marketFn,/storedMcSol/);
assert.doesNotMatch(marketFn,/storedMcUsd/);

assert.match(moduleSource,/MEMEFLOW_NO_STORED_MC_FALLBACK_V19/);
assert.doesNotMatch(moduleSource,/liveMarketCapSol\s*\?\?\s*storedMarketCapSol/);

// One automatic mutable clock only.
assert.match(ui,/MEMEFLOW_SINGLE_CARD_CLOCK_V19/);
assert.match(ui,/MEMEFLOW_NO_CATCHUP_BURST_V19/);
assert.match(ui,/setTimeout\([\s\S]*?__mfRunCardClockV19/);
assert.doesNotMatch(
  ui,
  /setInterval\([\s\S]{0,300}?__mfPollOneSecondV17/
);

// The 10-second structure lane must not patch market values.
const reconcile=ui.slice(
  ui.indexOf('function __mfReconcileVisibleCardsV183(){'),
  ui.indexOf('async function loadDiscoveryStatus()')
);

assert.match(reconcile,/MEMEFLOW_STRUCTURE_MEMBERSHIP_ONLY_V19/);
assert.doesNotMatch(reconcile,/__mfPatchMutableCardV17/);

// No Open Position replay/catch-up loop.
const open=ui.slice(
  ui.indexOf('// MEMEFLOW_OPEN_POSITION_EVENT_FACT_V16'),
  ui.indexOf('// MEMEFLOW_PER_MINT_BATCH_REFRESH_V18')
);

assert.match(open,/MEMEFLOW_OPEN_POSITION_SINGLE_FLIGHT_V19/);
assert.doesNotMatch(open,/refreshPending/i);
assert.doesNotMatch(open,/do\s*\{/);
assert.doesNotMatch(open,/while\s*\(/);

// The regular batch is limited to mounted cards and excludes OPEN mints.
const load=ui.slice(
  ui.indexOf('async function loadTokens(){'),
  ui.indexOf("document\n  .querySelectorAll(\n    '.summary-card'")
);

assert.match(load,/MEMEFLOW_VISIBLE_MINTS_ONLY_V19/);
assert.match(load,/\.flow-token\[data-mint\]/);
assert.match(load,/!openMints\.has\(mint\)/);
assert.match(load,/slice\(0,PAGE_SIZE\)/);
assert.doesNotMatch(
  load,
  /state\.rows\s*\n?\s*\.map\(row=>String\(row\?\.mint/
);

// Static identity remains outside the automatic mutable patch.
const mutable=ui.slice(
  ui.indexOf('function __mfPatchMutableCardV17('),
  ui.indexOf('async function __mfPollOneSecondV17(')
);

assert.doesNotMatch(
  mutable,
  /querySelector(?:All)?\(\s*['"]\.token-name/
);
assert.doesNotMatch(
  mutable,
  /querySelector(?:All)?\(\s*['"]\.token-avatar/
);
assert.doesNotMatch(
  mutable,
  /querySelector(?:All)?\(\s*['"]\.token-pump-link/
);

console.log('live card clock v19 ok');
