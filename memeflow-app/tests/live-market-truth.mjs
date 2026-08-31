import assert from 'node:assert/strict';
import fs from 'node:fs';
import {liveCardMarketSnapshot} from '../src/live-card-market.mjs';

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

// MEMEFLOW_LIVE_MARKET_SHARED_HELPER_TEST_V35_7
//
// 5m market truth is shared. Candidate market calculation delegates to the
// same helper used by OPEN POSITION instead of duplicating volume logic.
const candidateMarketStart=
  app.indexOf('function __mfCandidateMarket5mV4(');
const candidateViewStart=
  app.indexOf('function candidateView(d){',candidateMarketStart);

assert.ok(
  candidateMarketStart>=0&&candidateViewStart>candidateMarketStart,
  '__mfCandidateMarket5mV4 block missing'
);

const candidateMarket=
  app.slice(candidateMarketStart,candidateViewStart);

// Current production intentionally calls the shared helper across multiple
// lines and passes a third `now` argument. The invariant is delegation itself,
// not exact argument spelling or formatting.
assert.match(
  candidateMarket,
  /return\s+__mfOpenPositionMarket5mV22\s*\(/s,
  'candidate market helper must delegate to shared V22 market truth'
);

// Extract the shared helper by its OWN boundaries. Do not assume whether it
// appears before or after __mfCandidateMarket5mV4 in app-server.mjs.
const sharedMarketMatch=app.match(
  /function\s+__mfOpenPositionMarket5mV22\s*\(\s*mint\s*,\s*t\s*,\s*now\s*=\s*Date\.now\(\)\s*\)\s*\{[\s\S]*?return\s+snapshot\s*;\s*\}/
);

assert.ok(
  sharedMarketMatch,
  '__mfOpenPositionMarket5mV22 block missing'
);

const sharedMarket=sharedMarketMatch[0];

assert.match(sharedMarket,/chartTradeHistory\.get\(mint\)/);
assert.match(sharedMarket,/solUsdOracle\.get\(\)/);
assert.match(sharedMarket,/liveCardMarketSnapshot\(\{/);
assert.doesNotMatch(sharedMarket,/storedMcSol/);

// Candidate API must surface the shared snapshot fields.
assert.match(candidate,/volume5mSol:market5m\.volume5mSol/);
assert.match(candidate,/volume5mUsd:market5m\.volume5mUsd/);
assert.match(candidate,/transactions5m:market5m\.transactions5m/);
assert.match(candidate,/priceChange5mPct:market5m\.priceChange5mPct/);

assert.match(app,/MEMEFLOW_LIVE_CARD_MARKET_TRUTH_V18/);
assert.match(app,/MEMEFLOW_OPEN_POSITION_MC_TRUTH_V18/);
assert.match(app,/MEMEFLOW_OPEN_POSITION_LIVE_BATCH_V18/);

// Functional proof that the shared implementation computes the fields.
{
  const now=Date.now();
  const snapshot=liveCardMarketSnapshot({
    token:{
      launchPlatform:'pump',
      totalSupply:1_000_000_000
    },
    points:[
      {
        t:now-2000,
        priceSol:0.000001,
        solAmount:1.25
      },
      {
        t:now-1000,
        priceSol:0.0000015,
        solAmount:2.75
      }
    ],
    solUsd:100,
    now,
    windowMs:300000
  });

  assert.equal(snapshot.volume5mSol,4);
  assert.equal(snapshot.volume5mUsd,400);
  assert.equal(snapshot.transactions5m,2);
  assert.ok(
    Math.abs(snapshot.priceChange5mPct-50)<1e-9,
    `expected 50% move, got ${snapshot.priceChange5mPct}`
  );
}

// Reference HTTP sync may refresh display/reference holders but cannot replace
// live WS price/reserve state.
assert.match(app,/pumpReportedMarketCapUsd/);
assert.match(app,/pumpReportedHolderCount/);


// MEMEFLOW_STALE_MARKET_REGRESSION_V21
// A stored TradeEvent market cap must expire when there has been no live trade
// inside the card window. This is the Milo stale-$33.5K regression.
{
  const now=Date.now();
  const stale=liveCardMarketSnapshot({
    token:{
      launchPlatform:'pump',
      priceSol:0.0000002,
      marketCapUsd:33500,
      marketSource:'ws-direct-trade-event-v13',
      liveMarketCapSource:'pump-trade-price-x-supply',
      lastPriceAt:now-6*60_000
    },
    points:[],
    solUsd:170,
    now,
    windowMs:300000
  });
  assert.equal(stale.marketCapUsd,null);

  const fresh=liveCardMarketSnapshot({
    token:{
      launchPlatform:'pump',
      priceSol:0.000000033,
      marketCapUsd:5600,
      marketSource:'ws-direct-trade-event-v13',
      liveMarketCapSource:'pump-trade-price-x-supply',
      lastPriceAt:now-1000
    },
    points:[],
    solUsd:170,
    now,
    windowMs:300000
  });
  assert.ok(Number(fresh.marketCapUsd)>0);
}

console.log('live market truth v1 ok');
