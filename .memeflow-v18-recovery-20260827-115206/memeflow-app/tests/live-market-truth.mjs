import assert from 'node:assert/strict';
import fs from 'node:fs';

const app=fs.readFileSync(new URL('../app-server.mjs',import.meta.url),'utf8');
const live=fs.readFileSync(new URL('../src/pump-live-trade-feed.mjs',import.meta.url),'utf8');
const history=fs.readFileSync(new URL('../src/pump-history-backfill.mjs',import.meta.url),'utf8');

// Pump history must normalize raw units.
assert.match(history,/MEMEFLOW_PUMP_UNIT_NORMALIZATION_V1/);
assert.match(history,/return raw\/1e9/);
assert.match(history,/raw\/\(10\*\*decimals\)/);
assert.match(history,/pumpReportedHolderCount/);

// Every real TradeEvent heals current MC.
assert.match(live,/MEMEFLOW_LIVE_MARKET_CAP_V1/);
assert.match(live,/liveMarketCapSol/);
assert.match(live,/liveMarketCapUsd/);
assert.match(live,/patch\.marketCapSol=liveMarketCapSol/);
assert.match(live,/patch\.marketCapUsd=liveMarketCapUsd/);
assert.match(live,/lastMarketActivityAt:Date\.now\(\)/);

// The card's generic `marketCap` is USD. It must never be marketCapSol.
const candidate=app.slice(
  app.indexOf('function candidateView(d){'),
  app.indexOf('function publish(',app.indexOf('function candidateView(d){'))
);
assert.match(candidate,/marketCap:market5m\.marketCapUsd/);
assert.match(candidate,/marketCapSol:market5m\.marketCapSol/);
assert.match(candidate,/marketCapUsd:market5m\.marketCapUsd/);
assert.doesNotMatch(candidate,/marketCap:marketCapSol/);

// 5m card volume/transactions come from real chart TradeEvents.
const market=app.slice(
  app.indexOf('function __mfCandidateMarket5mV4('),
  app.indexOf('function candidateView(d){')
);
assert.match(market,/chartTradeHistory\.get\(mint\)/);
assert.match(market,/volume5mSol/);
assert.match(market,/transactions5m/);
assert.match(market,/solUsdOracle\.get\(\)/);

// Reference HTTP sync may refresh display/reference holders but cannot replace
// live WS price/reserve state.
assert.match(app,/pumpReportedMarketCapUsd/);
assert.match(app,/pumpReportedHolderCount/);

console.log('live market truth v1 ok');
