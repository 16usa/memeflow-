import assert from 'node:assert/strict';
import fs from 'node:fs';
import {openPositionLiveMarketCap} from '../src/live-card-market.mjs';

const token={
  launchPlatform:'pump',
  totalSupply:1_000_000_000,
  pumpReportedMarketCapUsd:33_500,
  marketCapUsd:33_500
};

const stale=openPositionLiveMarketCap({
  token,
  markPriceSol:0.000000335,
  markSource:'pump-reference',
  solUsd:100
});

assert.equal(stale.marketCapSol,null);
assert.equal(stale.marketCapUsd,null);
assert.equal(stale.marketCapSource,null);

const first=openPositionLiveMarketCap({
  token,
  markPriceSol:0.0000001,
  markSource:'token-live-trade',
  solUsd:100
});

const second=openPositionLiveMarketCap({
  token,
  markPriceSol:0.0000002,
  markSource:'chart-trade-event',
  solUsd:100
});

assert.equal(first.marketCapSol,100);
assert.equal(first.marketCapUsd,10_000);
assert.equal(first.marketCapSource,'token-live-trade-price-x-supply');

assert.equal(second.marketCapSol,200);
assert.equal(second.marketCapUsd,20_000);
assert.equal(second.marketCapSource,'chart-trade-event-price-x-supply');

assert.notEqual(first.marketCapUsd,second.marketCapUsd);
assert.notEqual(first.marketCapUsd,33_500);
assert.notEqual(second.marketCapUsd,33_500);

const app=fs.readFileSync(new URL('../app-server.mjs',import.meta.url),'utf8');
const start=app.indexOf('// MEMEFLOW_OPEN_POSITION_LIVE_BATCH_V18');
const end=app.indexOf('// MEMEFLOW_OPEN_POSITION_MARKET_METRICS_V3',start);
assert.ok(start>=0&&end>start);

const route=app.slice(start,end);
assert.match(route,/MEMEFLOW_OPEN_POSITION_LIVE_MC_V20/);
assert.match(route,/openPositionLiveMarketCap\(\{/);
assert.match(route,/marketCapSol:liveMc\.marketCapSol/);
assert.match(route,/marketCapUsd:liveMc\.marketCapUsd/);
assert.match(route,/marketCapSource:liveMc\.marketCapSource/);
assert.doesNotMatch(route,/marketCapUsd:finite\(market\?\.marketCapUsd\)/);

console.log('open position live MC v20 ok');
