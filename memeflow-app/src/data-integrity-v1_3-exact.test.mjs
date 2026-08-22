import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {defaultSettings} from './settings.mjs';
import {evaluate} from './evaluate.mjs';

const good=(patch={})=>({
  mint:'Good111',
  name:'Good',
  symbol:'GOOD',
  launchPlatform:'pump',
  protocol:'pump',
  source:'Pump create',
  discoveredAt:Date.now()-5*60_000,
  holderCount:120,
  holderFresh:true,
  holderSource:'Solana getProgramAccounts unique-wallet scan',
  holderScannedAt:Date.now(),
  top10Pct:10,
  developerPct:2,
  buyPressure:3,
  priceSol:1,
  peakPriceSol:1,
  dataQuality:1,
  metadataResolved:true,
  ...patch
});

test('fresh canonical holder evidence can qualify normally',()=>{
  const d=evaluate(good(),defaultSettings());
  assert.equal(d.state,'BUY READY');
});

test('stale canonical holder evidence cannot remain BUY READY',()=>{
  const d=evaluate(
    good({holderScannedAt:Date.now()-10*60_000}),
    defaultSettings()
  );
  assert.equal(d.state,'WAITING');
  assert.ok(
    d.settingsEvaluation.gates.some(
      gate=>gate.name==='Fresh holder snapshot'&&gate.status==='WAITING'
    )
  );
});

test('95 percent observed-peak collapse is hard BLOCKED and score-capped',()=>{
  const d=evaluate(
    good({priceSol:0.05,peakPriceSol:1}),
    defaultSettings()
  );
  assert.equal(d.state,'BLOCKED');
  assert.ok(d.score<=20);
  assert.match(d.reasons.join(' '),/collapsed 95\.0% from observed peak/i);
  const gate=d.settingsEvaluation.gates.find(
    item=>item.name==='Peak drawdown safety'
  );
  assert.equal(gate?.status,'FAIL');
});

test('70 percent pullback is not catastrophic collapse',()=>{
  const d=evaluate(
    good({priceSol:0.30,peakPriceSol:1}),
    defaultSettings()
  );
  const gate=d.settingsEvaluation.gates.find(
    item=>item.name==='Peak drawdown safety'
  );
  assert.equal(gate?.status,'PASS');
  assert.doesNotMatch(d.reasons.join(' '),/token collapsed/i);
});

test('event holder ledger keeps canonical scan time separate from trade time',()=>{
  const source=fs.readFileSync(
    new URL('./event-holder-ledger.mjs',import.meta.url),
    'utf8'
  );
  assert.match(source,/HOLDER_CANONICAL_MAX_AGE_MS/);
  assert.match(source,/holderCanonicalSeedAt/);
  assert.match(source,/holderScannedAt:canonicalSeedAt\|\|null/);
  assert.match(source,/canonical-refresh-pending/);
});

test('runtime has bounded holder reconciliation and metadata retry workers',()=>{
  const app=fs.readFileSync(
    new URL('../app-server.mjs',import.meta.url),
    'utf8'
  );
  const enrich=fs.readFileSync(
    new URL('./enrich.mjs',import.meta.url),
    'utf8'
  );
  assert.match(app,/MEMEFLOW_DATA_INTEGRITY_V1_3_EXACT/);
  assert.match(app,/__v13RunHolderReconcile/);
  assert.match(app,/__v13RunMetadataRetry/);
  assert.match(enrich,/export async function refreshTokenMetadata/);
  assert.match(enrich,/METADATA_IMAGE_RETRY_MAX/);
});
