import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {defaultSettings} from './settings.mjs';
import {evaluate,tokenAgeMinutes,tokenAgeSource} from './evaluate.mjs';

const now=Date.now();
const goodPump=(patch={})=>({
  mint:'GoodPump111111111111111111111111111111pump',
  name:'Good',symbol:'GOOD',launchPlatform:'pump',protocol:'pump',source:'Pump create',
  discoveredAt:now-60_000,pumpCreatedAt:now-60_000,pumpCreatedAtPending:false,
  holderCount:120,holderWalletCount:120,holderTokenAccountCount:145,holderFresh:true,
  holderSource:'Solana getProgramAccounts unique-wallet scan',holderScannedAt:now,holderCanonicalSeedAt:now,
  top10Pct:10,developerPct:2,buyPressure:3,buyTransactions:8,sellTransactions:2,totalTransactions:10,
  priceSol:1,peakPriceSol:1,lastPriceAt:now,pumpMarketUpdatedAt:now,
  marketSource:'pump-trade-event',canonicalMarket:true,dataQuality:1,metadataResolved:true,...patch
});

test('Pump age uses canonical create block time instead of recent discovery time',()=>{
  const old=goodPump({discoveredAt:now-30_000,pumpCreatedAt:now-18*60*60_000});
  const age=tokenAgeMinutes(old,now);
  assert.ok(age>1079&&age<1081);
  assert.equal(tokenAgeSource(old),'pump-create-block-time');
  const d=evaluate(old,defaultSettings());
  assert.equal(d.state,'BLOCKED');
  assert.match(d.reasons.join(' '),/token age above 180m/i);
});

test('persisted Pump token awaiting canonical create time cannot become BUY READY',()=>{
  const pending=goodPump({pumpCreatedAt:null,pumpCreatedAtPending:true,discoveredAt:now-30_000});
  assert.equal(tokenAgeMinutes(pending,now),null);
  assert.equal(tokenAgeSource(pending),'pump-create-time-pending');
  const d=evaluate(pending,defaultSettings());
  assert.equal(d.state,'WAITING');
  assert.ok(d.settingsEvaluation.gates.some(gate=>gate.name==='Maximum token age'&&gate.status==='WAITING'));
});

test('DEX display fields do not override healthy Pump decision evidence',()=>{
  const token=goodPump({dexConfirmed:true,dexPriceSol:0.00000001,dexBuyPressure:0.01,dexBuyTransactions:0,dexSellTransactions:999,dexMarketUpdatedAt:now,dexMarketSource:'dexscreener'});
  const d=evaluate(token,defaultSettings());
  assert.equal(d.state,'BUY READY');
  assert.equal(d.aiQuality.components.find(x=>x.key==='buyPressure')?.value,3);
});

test('stale canonical Pump market data waits even when DEX display is fresh',()=>{
  const token=goodPump({lastPriceAt:now-10*60_000,pumpMarketUpdatedAt:now-10*60_000,dexConfirmed:true,dexMarketUpdatedAt:now,dexPriceSol:2});
  const d=evaluate(token,defaultSettings());
  assert.equal(d.state,'WAITING');
  assert.ok(d.settingsEvaluation.gates.some(gate=>gate.name==='Fresh Pump market data'&&gate.status==='WAITING'));
});

test('source code keeps DEX out of canonical runtime evidence',()=>{
  const dex=fs.readFileSync(new URL('./dex-verification-gate.mjs',import.meta.url),'utf8');
  const app=fs.readFileSync(new URL('../app-server.mjs',import.meta.url),'utf8');
  const store=fs.readFileSync(new URL('./store.mjs',import.meta.url),'utf8');
  assert.match(dex,/dexPriceSol/);
  assert.match(dex,/dexBuyPressure/);
  assert.doesNotMatch(dex,/\n\s+marketSource:\s*'dexscreener'/);
  assert.doesNotMatch(dex,/\n\s+lastPriceAt:/);
  assert.doesNotMatch(app,/__stopPumpPriceTimerForDex/);
  assert.match(app,/pumpCreatedAt:/);
  assert.match(app,/__v14NormalizePersistedEvidence/);
  assert.match(store,/MEMEFLOW_RUNTIME_TRUTH_V1_4_EXACT/);
});

test('holder scan exposes both risk-wallet and token-account counts',()=>{
  const enrich=fs.readFileSync(new URL('./enrich.mjs',import.meta.url),'utf8');
  const ledger=fs.readFileSync(new URL('./event-holder-ledger.mjs',import.meta.url),'utf8');
  assert.match(enrich,/holderWalletCount:holderCount/);
  assert.match(enrich,/holderTokenAccountCount/);
  assert.match(enrich,/callOnce\('getProgramAccounts'/);
  assert.match(ledger,/canonicalTokenAccountCount/);
  assert.match(ledger,/eventLedgerCanonicalSupplyUi/);
});

test('paper freshness uses canonical market timestamps, not generic token updatedAt',()=>{
  const paper=fs.readFileSync(new URL('./paper-engine.mjs',import.meta.url),'utf8');
  assert.match(paper,/pumpMarketUpdatedAt \|\| token\?\.lastPriceAt/);
  assert.doesNotMatch(paper,/token\?\.updatedAt \|\| token\?\.lastPriceAt/);
});

test('Pump live flow owns canonical pressure and transaction counts',()=>{
  const live=fs.readFileSync(new URL('./pump-live-trade-feed.mjs',import.meta.url),'utf8');
  assert.match(live,/pump-trade-event-60s-sol-flow/);
  assert.match(live,/buyTransactions:flow\.buyTransactions/);
  assert.match(live,/canonicalMarket:true/);
});

test('discovery controller defaults to Pump',()=>{
  const source=fs.readFileSync(new URL('./discovery-source.mjs',import.meta.url),'utf8');
  assert.match(source,/defaultMode='pump'/);
  assert.doesNotMatch(source,/defaultMode='dex'/);
});
