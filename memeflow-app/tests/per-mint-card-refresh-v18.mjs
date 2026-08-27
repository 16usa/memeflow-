import assert from 'node:assert/strict';
import fs from 'node:fs';

import {
  liveCardMarketSnapshot,
  normalizePumpSupplyForCard
} from '../src/live-card-market.mjs';

const app=fs.readFileSync(
  new URL('../app-server.mjs',import.meta.url),
  'utf8'
);

const ui=fs.readFileSync(
  new URL('../system-tokens.js',import.meta.url),
  'utf8'
);

const html=fs.readFileSync(
  new URL('../system-tokens.html',import.meta.url),
  'utf8'
);

assert.equal(
  normalizePumpSupplyForCard({
    launchPlatform:'pump'
  }),
  1_000_000_000
);

const createOnly=liveCardMarketSnapshot({
  token:{
    launchPlatform:'pump',
    marketSource:'pump-create-event-ws',
    source:'Pump CreateEvent WS',
    priceSol:0.0000335,
    marketCapSol:33500,
    totalSupply:1_000_000_000
  },
  points:[],
  solUsd:100,
  now:1_000_000
});

assert.equal(createOnly.createOnly,true);
assert.equal(createOnly.tradeEvidence,false);
assert.equal(createOnly.marketCapSol,null);
assert.equal(createOnly.marketCapUsd,null);

const traded=liveCardMarketSnapshot({
  token:{
    launchPlatform:'pump',
    totalSupply:1_000_000_000
  },
  points:[
    {
      t:999_000,
      price:0.000002,
      solAmount:1
    },
    {
      t:999_500,
      price:0.0000025,
      solAmount:2
    }
  ],
  solUsd:100,
  now:1_000_000
});

assert.equal(traded.tradeEvidence,true);
assert.equal(traded.marketCapSol,2500);
assert.equal(traded.marketCapUsd,250000);
assert.equal(traded.transactions5m,2);
assert.equal(traded.volume5mSol,3);
assert.ok(
  Math.abs(traded.priceChange5mPct-25)<1e-9,
  `expected ~25%, got ${traded.priceChange5mPct}`
);

// V19: an old/open-position token with a stored 33.5K-ish baseline but
// NO proven TradeEvent must not display that baseline as live MC.
const staleUnknownSource=liveCardMarketSnapshot({
  token:{
    launchPlatform:'pump',
    priceSol:0.000000335,
    lastPriceAt:900_000,
    marketCapSol:335,
    marketCapUsd:33_500,
    totalSupply:1_000_000_000
  },
  points:[],
  solUsd:100,
  now:1_000_000
});

assert.equal(staleUnknownSource.tradeEvidence,false);
assert.equal(staleUnknownSource.marketCapSol,null);
assert.equal(staleUnknownSource.marketCapUsd,null);
assert.equal(staleUnknownSource.marketCapSource,null);

const referenced=liveCardMarketSnapshot({
  token:{
    launchPlatform:'pump',
    marketSource:'pump-create-event-ws',
    pumpReportedMarketCapUsd:12345,
    pumpReferenceAt:999_500
  },
  points:[],
  solUsd:null,
  now:1_000_000
});

assert.equal(referenced.marketCapUsd,12345);
assert.equal(referenced.marketCapSource,'pump-reference');

assert.match(app,/MEMEFLOW_LIVE_CARD_BATCH_V18/);
assert.match(app,/\/api\/system\/live-token-card-batch/);
assert.match(app,/MEMEFLOW_OPEN_POSITION_LIVE_BATCH_V18/);
assert.match(app,/\/api\/paper\/positions\/live/);
assert.match(app,/MEMEFLOW_OPEN_POSITION_MC_TRUTH_V18/);
assert.match(app,/liveCardMarketSnapshot/);

assert.match(ui,/MEMEFLOW_PER_MINT_BATCH_REFRESH_V18/);
assert.match(ui,/MEMEFLOW_KEYED_CARD_RECONCILE_V18_3/);
assert.match(ui,/MEMEFLOW_STRUCTURE_NO_FULL_RENDER_V18_3/);

const structureNoReload=ui.slice(
  ui.indexOf('async function __mfLoadStructureV18(){'),
  ui.indexOf('async function loadTokens(){')
);

assert.doesNotMatch(
  structureNoReload,
  /\brender\(\);/
);
assert.match(ui,/MEMEFLOW_PER_MINT_ONE_SECOND_CLOCK_V18/);
assert.match(ui,/const __MF_CARD_REFRESH_MS_V17=1000/);
assert.match(ui,/\/api\/system\/live-token-card-batch/);
assert.match(ui,/\/api\/paper\/positions\/live/);
assert.match(ui,/__mfMergeMutableRowV18/);

const merge=ui.slice(
  ui.indexOf('function __mfMergeMutableRowV18('),
  ui.indexOf('// MEMEFLOW_ONE_SECOND_SNAPSHOT_APPLY_V17')
);

assert.doesNotMatch(merge,/'name'/);
assert.doesNotMatch(merge,/'image'/);
assert.doesNotMatch(merge,/'imageUrl'/);
assert.doesNotMatch(merge,/'logoUrl'/);
assert.doesNotMatch(merge,/'uri'/);

const mutablePatch=ui.slice(
  ui.indexOf('function __mfPatchMutableCardV17('),
  ui.indexOf('async function __mfPollOneSecondV17(')
);

// V18.2: comments may mention static selectors. What is forbidden is an
// executable DOM lookup/write inside the one-second mutable patch.
assert.doesNotMatch(
  mutablePatch,
  /querySelector(?:All)?\(\s*['"]\.token-name/
);
assert.doesNotMatch(
  mutablePatch,
  /querySelector(?:All)?\(\s*['"]\.token-avatar/
);
assert.doesNotMatch(
  mutablePatch,
  /querySelector(?:All)?\(\s*['"]\.token-pump-link/
);
assert.doesNotMatch(
  mutablePatch,
  /\.src\s*=/
);
assert.doesNotMatch(
  mutablePatch,
  /\.href\s*=/
);

assert.match(
  html,
  /system-tokens\.js\?v=gmgn-sort-v25-1-20260827/
);

console.log('per-mint card refresh v18 ok');
