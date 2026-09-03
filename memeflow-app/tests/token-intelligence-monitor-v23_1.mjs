import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  createTokenIntelligenceShadowV23
} from '../src/token-intelligence-shadow-v23.mjs';

const shadow=createTokenIntelligenceShadowV23({
  maxCells:20,
  maxEventsPerCell:128
});

const mint='MonitorV231111111111111111111111111111111';
const base=1_800_200_000_000;

function token(price,ready=false,extra={}){
  return {
    mint,
    priceSol:price,
    liquiditySol:8,
    marketCapSol:80,
    holderCount:120,
    holderFresh:true,
    top10Pct:17,
    developerPct:2,
    opportunityScore:82,
    opportunityEvidenceReady:ready,
    opportunityTrendHealthy:true,
    drawdownFromPeakPct:3,
    ...extra
  };
}

function event(offset,user,sol,slot,isBuy=true){
  return {
    mint,
    timestamp:base+offset,
    isBuy,
    solAmount:BigInt(Math.round(sol*1e9)),
    user,
    slot
  };
}

// Build a pre-anchor cohort. Repeated same-slot / similar-size buys are
// evidence only; they must never become a second MEMEFLOW Score.
shadow.observeTrade({
  mint,
  event:event(0,'W1',0.10,100),
  token:token(0.001,false)
});
shadow.observeTrade({
  mint,
  event:event(80,'W2',0.101,100),
  token:token(0.00102,false)
});
shadow.observeTrade({
  mint,
  event:event(160,'W3',0.099,100),
  token:token(0.00103,false)
});
shadow.observeTrade({
  mint,
  event:event(800,'W1',0.08,101),
  token:token(0.00104,false)
});

const observed=shadow.observeTrade({
  mint,
  event:event(1200,'W4',0.12,102),
  token:token(0.00106,true,{
    suspectedRiskyWalletsPct:5,
    insidersPct:1
  })
});

const specialists=observed.snapshot.specialists;

assert.equal(observed.snapshot.shadowOnly,true);
assert.equal(specialists.shadowOnly,true);

assert.equal(specialists.wallet.uniqueBuyerWallets,4);
assert.equal(specialists.wallet.repeatBuyerWallets,1);
assert.ok(specialists.wallet.topBuyerSolSharePct>0);
assert.ok(specialists.wallet.buyerConcentrationHhi>0);

assert.ok(specialists.coordination.sameSlotBuySharePct>=50);
assert.ok(specialists.coordination.maxDistinctBuyers250ms>=3);
assert.ok(specialists.coordination.similarAmountBuySharePct>=50);
assert.equal(specialists.coordination.suspectedCoordination,true);

assert.ok(Array.isArray(specialists.smartMoneySeed.candidateWallets));
assert.ok(specialists.smartMoneySeed.candidateWallets.length>=3);
assert.equal(
  specialists.smartMoneySeed.reputationReady,
  false
);

assert.ok(observed.snapshot.evidence.liquidity.mcToLiquidity>0);
assert.equal(
  observed.snapshot.evidence.dataQuality.checks.price,
  true
);

// Anchor now carries a bounded wallet cohort for future reputation learning.
const cell=shadow.inspect(mint);
assert.ok(cell.anchor);
assert.ok(Array.isArray(cell.anchor.walletCohort));
assert.ok(cell.anchor.walletCohort.length>=3);
assert.ok(cell.anchor.walletCohort.length<=12);

// Monitor list is bounded, sortable and stage-filterable.
const listed=shadow.listCells({limit:10});
assert.equal(listed.length,1);
assert.equal(listed[0].mint,mint);
assert.equal(listed[0].shadowOnly,true);
assert.ok(listed[0].dataCompletenessPct>=0);
assert.ok(typeof listed[0].regime==='string');

const active=shadow.listCells({
  limit:10,
  stage:listed[0].stage
});
assert.equal(active.length,1);

const none=shadow.listCells({
  limit:10,
  stage:'NOT_A_STAGE'
});
assert.equal(none.length,0);

// Status advertises specialist modules without creating score authorities.
const status=shadow.status();
assert.equal(status.shadowOnly,true);
assert.ok(status.specialists.includes('WALLET'));
assert.ok(status.specialists.includes('COORDINATION'));
assert.ok(status.specialists.includes('SMART_MONEY_SEED'));
assert.ok(status.specialists.includes('DATA_QUALITY'));

// Read-only owner monitor routes are wired into app-server.
const app=fs.readFileSync('app-server.mjs','utf8');
assert.match(app,/MEMEFLOW_TOKEN_INTELLIGENCE_MONITOR_V23_1/);
assert.match(app,/\/api\/owner\/intelligence\/token-cells/);
assert.match(app,/\/api\/owner\/intelligence\/token-cell/);
assert.match(app,/tokenIntelligenceShadowV23\.listCells/);
assert.match(app,/tokenIntelligenceShadowV23\.inspect/);

// Shadow contract remains strict.
const source=fs.readFileSync(
  'src/token-intelligence-shadow-v23.mjs',
  'utf8'
);

assert.doesNotMatch(source,/from ['"]\.\/evaluate\.mjs['"]/);
assert.doesNotMatch(source,/openPosition\s*\(/);
assert.doesNotMatch(source,/closePosition\s*\(/);
assert.doesNotMatch(source,/setSettings\s*\(/);

// Specialist outputs must be evidence, not competing public scores.
assert.doesNotMatch(
  source,
  /walletScore|coordinationScore|smartMoneyScore/
);

console.log('token intelligence monitor v23.1 ok');
