import assert from 'node:assert/strict';
import fs from 'node:fs';

const app=fs.readFileSync(new URL('../app-server.mjs',import.meta.url),'utf8');
const ui=fs.readFileSync(new URL('../system-tokens.js',import.meta.url),'utf8');
const market=fs.readFileSync(new URL('../src/live-card-market.mjs',import.meta.url),'utf8');
const html=fs.readFileSync(new URL('../system-tokens.html',import.meta.url),'utf8');

assert.match(market,/tokenTradeAgeMs<=windowMs/);
assert.match(market,/MEMEFLOW_NO_STORED_MC_FALLBACK_V19/);
assert.match(app,/MEMEFLOW_LIVE_CARD_STALE_MC_FIX_V21/);

assert.match(ui,/MEMEFLOW_NO_DYNAMIC_CACHE_V20_2/);
assert.match(ui,/__mfInvalidateDynamicRowV20_2/);
assert.match(app,/MEMEFLOW_MANUAL_NO_DYNAMIC_CACHE_V20_2/);
assert.match(app,/MEMEFLOW_FINAL_ACTIVITY_GATE_V20_2/);
assert.match(app,/MEMEFLOW_TRADE_ELIGIBLE_CANONICAL_STATE_V21/);
assert.match(
  app,
  /eligible &&\s*liveTruth\.pass===true &&\s*String\(decision\?\.state\|\|''\)\.toUpperCase\(\)==='BUY READY'/
);
assert.doesNotMatch(
  app,
  /tradeEligible:isOpen\?true:eligible&&liveTruth\.pass===true/
);
assert.match(html,/system-tokens\.js\?v=[^\"']+/);

const ms=ui.indexOf('function __mfMergeMutableRowV18(');
const me=ui.indexOf('// MEMEFLOW_ONE_SECOND_SNAPSHOT_APPLY_V17',ms);
assert.ok(ms>=0&&me>ms);
const merge=ui.slice(ms,me);
assert.doesNotMatch(merge,/previous\?\.decision/);
assert.doesNotMatch(merge,/previous\?\.market/);
assert.doesNotMatch(merge,/previous\?\.holder/);

// Exact regression for the screenshot class: current 5m zero activity must
// force WAITING and cannot remain BUY READY because of an old decision.
const gateStart=app.indexOf('function __mfCurrentEntryTruthV20_2(');
const gateEnd=app.indexOf('function __mfLiveDecisionForUserV14(',gateStart);
const gate=app.slice(gateStart,gateEnd);
assert.match(gate,/No live market activity in the last 5 minutes/);
assert.match(gate,/tx!==null&&tx>0/);
assert.match(gate,/volSol!==null&&volSol>0/);
assert.match(gate,/volUsd!==null&&volUsd>0/);

console.log('LIVE_TRUTH_NO_DYNAMIC_CACHE_V20_3_OK');
