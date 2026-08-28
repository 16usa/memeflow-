import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// ── evaluator: provisional data may be displayed but may not hard-block ─────
const {evaluate}=await import('../src/evaluate.mjs');

const provisional={
  mint:'AccuracyTestMint',
  priceSol:0.000001,
  buyPressure:2,
  holderFresh:false,
  holderSource:'event-ledger-user-only-provisional',
  holderCount:50,
  top10Pct:40,
  developerPct:0,
  bundlePct:35,
  sniperPct:12
};

let decision=evaluate(provisional,{
  maxTop10Pct:25,
  maxBundlePct:20,
  maxSniperPct:10,
  minScore:0,
  minConfidence:0
});

assert.equal(decision.state,'WAITING');
for(const name of [
  'Maximum Top-10 concentration',
  'Maximum bundle',
  'Maximum sniper share'
]){
  const gate=decision.settingsEvaluation.gates.find(g=>g.name===name);
  assert.equal(gate?.status,'WAITING',`${name} must WAIT on provisional evidence`);
}

const canonical={
  ...provisional,
  holderFresh:true,
  holderSource:'Solana getProgramAccounts baseline + live Pump TradeEvent delta',
  holderScannedAt:Date.now(),
  holderCanonicalSeedAt:Date.now()
};

decision=evaluate(canonical,{
  maxTop10Pct:25,
  maxBundlePct:20,
  maxSniperPct:10,
  minScore:0,
  minConfidence:0
});
assert.equal(decision.state,'BLOCKED');
assert.equal(
  decision.settingsEvaluation.gates
    .find(g=>g.name==='Maximum Top-10 concentration')?.status,
  'FAIL'
);

// ── ledger: canonical slot fence + post-snapshot replay + event dedupe ───────
const statePath=path.join(
  os.tmpdir(),
  `memeflow-holder-v36-${process.pid}-${Date.now()}.json`
);
process.env.EVENT_HOLDER_LEDGER_STATE_PATH_V12_20=statePath;
const {EventHolderLedger}=await import(
  `../src/event-holder-ledger.mjs?v36=${Date.now()}`
);

const mint='mint-v36';
const A='wallet-A';
const B='wallet-B';
const ledger=new EventHolderLedger();

ledger.seedCanonicalBalances(
  mint,
  new Map([[A,100],[B,100]]),
  {decimals:6,totalSupplyUi:1000,canonicalSlot:100}
);

const raw10=10_000_000n;

// Slot already covered by the canonical baseline: must not apply twice.
ledger.ingestTradeEventDirect({
  mint,user:A,isBuy:true,tokenAmount:raw10,
  timestamp:1700000000n,slot:100,signature:'sig-covered',eventIndex:0
});
assert.equal(ledger.byMint.get(mint).balances.get(A),100_000_000n);

// Newer slot applies once.
const newer={
  mint,user:A,isBuy:true,tokenAmount:raw10,
  timestamp:1700000001n,slot:101,signature:'sig-newer',eventIndex:0
};
ledger.ingestTradeEventDirect(newer);
assert.equal(ledger.byMint.get(mint).balances.get(A),110_000_000n);

// Same confirmed event delivered again after reconnect: no second delta.
ledger.ingestTradeEventDirect(newer);
assert.equal(ledger.byMint.get(mint).balances.get(A),110_000_000n);

// Race in the other direction: event arrives while RPC snapshot is in flight.
// When slot-200 baseline lands, slot-201 event must be replayed exactly once.
const mint2='mint-race-v36';
ledger.ingestTradeEventDirect({
  mint:mint2,user:A,isBuy:true,tokenAmount:raw10,
  timestamp:1700000002n,slot:201,signature:'sig-race',eventIndex:0
});
ledger.seedCanonicalBalances(
  mint2,
  new Map([[A,100],[B,100]]),
  {decimals:6,totalSupplyUi:1000,canonicalSlot:200}
);
assert.equal(ledger.byMint.get(mint2).balances.get(A),110_000_000n);

const snap=ledger.snapshot(mint2);
assert.equal(snap.holderCanonicalSlot,200);
assert.equal(snap.holderCalculationVersion,'V36_SLOT_FENCED_UNIQUE_WALLET');

try{fs.rmSync(statePath,{force:true})}catch{}

// ── static RPC invariants ───────────────────────────────────────────────────
const enrich=fs.readFileSync(new URL('../src/enrich.mjs',import.meta.url),'utf8');
assert.match(enrich,/withContext:true/);
assert.match(enrich,/holderCanonicalSlot:canonicalSlot/);
assert.match(enrich,/token\?\.tokenProgram/);
assert.match(enrich,/canonicalSlot\s*\}/);

console.log('holder accuracy v36 ok');
