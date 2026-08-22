import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {defaultSettings} from './settings.mjs';
import {evaluate} from './evaluate.mjs';

const now=Date.now();
const base=(patch={})=>({
  mint:'RiskTest111111111111111111111111111pump',
  name:'Risk Test',
  symbol:'RISK',
  launchPlatform:'pump',
  protocol:'pump',
  source:'Pump create',
  discoveredAt:now-60_000,
  pumpCreatedAt:now-60_000,
  pumpCreatedAtPending:false,
  holderCount:120,
  holderFresh:true,
  holderSource:'Solana getProgramAccounts unique-wallet scan',
  holderScannedAt:now,
  holderCanonicalSeedAt:now,
  top10Pct:10,
  developerPct:2,
  buyPressure:3,
  buyTransactions:10,
  sellTransactions:2,
  totalTransactions:12,
  priceSol:1,
  peakPriceSol:1,
  pumpMarketUpdatedAt:now,
  lastPriceAt:now,
  marketSource:'pump-trade-event',
  canonicalMarket:true,
  dataQuality:1,
  metadataResolved:true,
  ...patch
});

test('missing local peak history does not force a healthy token into WAITING',()=>{
  const token=base();
  delete token.peakPriceSol;
  token.antiRugHistory=[];
  const d=evaluate(token,defaultSettings());
  assert.equal(d.state,'BUY READY');
  assert.equal(
    d.settingsEvaluation.gates.some(x=>x.name==='Peak drawdown safety'),
    false
  );
});

test('85 percent Pump peak drawdown is hard BLOCKED',()=>{
  const d=evaluate(base({priceSol:0.15,peakPriceSol:1}),defaultSettings());
  assert.equal(d.state,'BLOCKED');
  assert.ok(d.score<=20);
  assert.match(d.reasons.join(' '),/collapsed 85\.0% from observed peak/i);
  const gate=d.settingsEvaluation.gates.find(x=>x.name==='Peak drawdown safety');
  assert.equal(gate?.status,'FAIL');
});

test('70 percent pullback with strong buyers is not a hard rug by peak alone',()=>{
  const d=evaluate(base({priceSol:0.30,peakPriceSol:1}),defaultSettings());
  const gate=d.settingsEvaluation.gates.find(x=>x.name==='Peak drawdown safety');
  assert.equal(gate?.status,'PASS');
});

test('40 percent dump inside 30 seconds is hard BLOCKED before 75 percent peak collapse',()=>{
  const d=evaluate(base({
    priceSol:0.60,
    peakPriceSol:1,
    antiRugHistory:[
      {at:now-20_000,priceSol:1},
      {at:now-10_000,priceSol:0.82}
    ]
  }),defaultSettings());
  assert.equal(d.state,'BLOCKED');
  assert.ok(d.score<=20);
  const gate=d.settingsEvaluation.gates.find(x=>x.name==='Rapid drawdown safety');
  assert.equal(gate?.status,'FAIL');
});

test('moderate deep drawdown plus sell pressure becomes recovery WAITING when owner pressure gate is disabled',()=>{
  const settings={...defaultSettings(),minBuyPressure:0};
  const d=evaluate(base({
    priceSol:0.50,
    peakPriceSol:1,
    buyPressure:0.4,
    buyTransactions:2,
    sellTransactions:8
  }),settings);
  assert.equal(d.state,'WAITING');
  assert.ok(d.score<=55);
  assert.ok(d.reasons.some(x=>/sell pressure remains elevated/i.test(x)));
});

test('owner minimum buy-pressure gate remains a hard BLOCKED rule during a selloff',()=>{
  const d=evaluate(base({
    priceSol:0.50,
    peakPriceSol:1,
    buyPressure:0.4,
    buyTransactions:2,
    sellTransactions:8
  }),defaultSettings());
  assert.equal(d.state,'BLOCKED');
  assert.ok(d.reasons.some(x=>/buy pressure below/i.test(x)));
});

test('anti-rug latch keeps a bounced token BLOCKED during cooldown',()=>{
  const d=evaluate(base({
    priceSol:0.92,
    peakPriceSol:1,
    rugRiskUntil:now+10*60_000,
    rugRiskReason:'Pump rapid dump 58.0% / 30s'
  }),defaultSettings());
  assert.equal(d.state,'BLOCKED');
  assert.ok(d.score<=20);
  const gate=d.settingsEvaluation.gates.find(x=>x.name==='Anti-rug cooldown');
  assert.equal(gate?.status,'FAIL');
});

test('store keeps 3 minutes of anti-rug snapshots and persistent latch fields',()=>{
  const store=fs.readFileSync(new URL('./store.mjs',import.meta.url),'utf8');
  assert.match(store,/slice\(-36\)/);
  assert.match(store,/rugRiskUntil/);
  assert.match(store,/MEMEFLOW_RUG_LATCH_MS/);
  assert.match(store,/rugRiskVersion:'V1\.4\.2'/);
});

test('candidate payload exposes anti-rug diagnostics',()=>{
  const app=fs.readFileSync(new URL('../app-server.mjs',import.meta.url),'utf8');
  assert.match(app,/antiRug:\{/);
  assert.match(app,/peakDrawdownPct:finite\(t\.rugRiskPeakDrawdownPct\)/);
});
