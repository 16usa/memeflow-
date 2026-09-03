import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  createWalletReputationMemoryV23_2
} from '../src/wallet-reputation-shadow-v23_2.mjs';

const dir=fs.mkdtempSync(
  path.join(os.tmpdir(),'mf-wallet-reputation-v23-2-')
);

const memory=createWalletReputationMemoryV23_2({
  dataDir:dir,
  maxWallets:100
});

const goodWallet='GoodWallet111111111111111111111111111111';
const badWallet='BadWallet1111111111111111111111111111111';

function anchor(mint,wallet,buySol=0.2){
  return {
    mint,
    at:1_800_300_000_000,
    walletCohort:[
      {wallet,buySol,buys:2}
    ]
  };
}

function outcome({
  horizonMs=300_000,
  ret=40,
  mfe=80,
  mae=-8,
  dead=false,
  observedAt=1_800_300_300_000
}={}){
  return {
    horizonMs,
    observedAt,
    returnPct:ret,
    maxFavorableExcursionPct:mfe,
    maxAdverseExcursionPct:mae,
    dead
  };
}

// Independent good-token history.
for(const [i,mint] of ['GOOD1','GOOD2','GOOD3'].entries()){
  assert.equal(
    memory.recordOutcome({
      anchor:anchor(mint,goodWallet,0.25+i*0.01),
      outcome:outcome({
        ret:35+i*10,
        mfe:70+i*10,
        mae:-5-i
      })
    }),
    1
  );
}

// Independent bad-token history.
for(const [i,mint] of ['BAD1','BAD2','BAD3'].entries()){
  assert.equal(
    memory.recordOutcome({
      anchor:anchor(mint,badWallet,0.15),
      outcome:outcome({
        ret:-35-i*5,
        mfe:5,
        mae:-40,
        dead:i===2
      })
    }),
    1
  );
}

const good=memory.inspect(goodWallet);
const bad=memory.inspect(badWallet);

assert.equal(good.reputationReady,true);
assert.equal(good.strongSmartMoneyEvidence,true);
assert.equal(good.distinctTokens,3);
assert.ok(good.positiveProbabilityPct>60);
assert.ok(good.confidencePct>0);
assert.ok(good.meanReturnPct>0);

assert.equal(bad.reputationReady,true);
assert.equal(bad.strongSmartMoneyEvidence,false);
assert.equal(bad.distinctTokens,3);
assert.ok(bad.positiveProbabilityPct<50);
assert.ok(bad.meanReturnPct<0);

// One lucky token is never enough to become trusted Smart Money.
const lucky='LuckyOneToken11111111111111111111111111111';
memory.recordOutcome({
  anchor:anchor('LUCKY1',lucky),
  outcome:outcome({ret:200,mfe:250})
});
assert.equal(
  memory.inspect(lucky).reputationReady,
  false
);

// Current cohort enrichment is evidence-only and weighted by current buy size.
const evidence=memory.evidenceForCandidates([
  {wallet:goodWallet,buySol:0.30,buys:2},
  {wallet:badWallet,buySol:0.10,buys:1},
  {wallet:'Unknown1111111111111111111111111111111',buySol:0.10,buys:1}
]);

assert.equal(evidence.shadowOnly,true);
assert.equal(evidence.reputationReady,true);
assert.equal(evidence.candidateWallets,3);
assert.equal(evidence.knownWallets,2);
assert.equal(evidence.readyWallets,2);
assert.equal(evidence.strongWallets,1);
assert.ok(evidence.strongWalletSharePct>50);
assert.ok(
  evidence.weightedPositiveProbabilityPct!==null
);

// Duplicate outcome key must not double-count.
assert.equal(
  memory.recordOutcome({
    anchor:anchor('GOOD1',goodWallet,0.25),
    outcome:outcome({ret:35,mfe:70,mae:-5})
  }),
  0
);

const before=memory.inspect(goodWallet);
assert.equal(await memory.flush(),true);

// Persistence survives a new process-memory instance.
const reloaded=createWalletReputationMemoryV23_2({
  dataDir:dir,
  maxWallets:100
});

const after=reloaded.inspect(goodWallet);
assert.ok(after);
assert.equal(after.distinctTokens,before.distinctTokens);
assert.equal(after.historicalEvents,before.historicalEvents);
assert.equal(
  after.positiveProbabilityPct,
  before.positiveProbabilityPct
);

// 15-second observations contribute less than 5-minute observations.
const weighted='Weighted11111111111111111111111111111111';
memory.recordOutcome({
  anchor:anchor('W15',weighted),
  outcome:outcome({
    horizonMs:15_000,
    ret:30,
    mfe:60
  })
});
memory.recordOutcome({
  anchor:anchor('W300',weighted),
  outcome:outcome({
    horizonMs:300_000,
    ret:30,
    mfe:60
  })
});
const weightedView=memory.inspect(weighted);
assert.ok(weightedView.effectiveObservations<2);
assert.ok(weightedView.effectiveObservations>1);

// Source wiring contract: Token Intelligence consumes the memory as evidence,
// records outcomes, and still remains shadow-only.
const shadow=fs.readFileSync(
  'src/token-intelligence-shadow-v23.mjs',
  'utf8'
);
const app=fs.readFileSync(
  'app-server.mjs',
  'utf8'
);

assert.match(
  shadow,
  /createWalletReputationMemoryV23_2/
);
assert.match(
  shadow,
  /evidenceForCandidates/
);
assert.match(
  shadow,
  /walletReputation\.recordOutcome/
);
assert.match(
  shadow,
  /SMART_MONEY_MEMORY/
);

assert.doesNotMatch(
  shadow,
  /walletReputation.*openPosition\s*\(/
);
assert.doesNotMatch(
  shadow,
  /walletReputation.*closePosition\s*\(/
);

assert.match(
  app,
  /\/api\/owner\/intelligence\/wallet-reputations/
);
assert.match(
  app,
  /\/api\/owner\/intelligence\/wallet-reputation/
);
assert.match(
  app,
  /listWalletReputations/
);
assert.match(
  app,
  /inspectWalletReputation/
);

console.log('wallet reputation shadow v23.2 ok');
