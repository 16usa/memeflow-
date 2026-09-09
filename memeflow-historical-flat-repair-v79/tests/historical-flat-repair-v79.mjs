import assert from 'node:assert/strict';

import {
  isLegacyManualFlatCandidate,
  buildHistoricalFlatPlan,
  summarizePlans
} from '../src/historical-flat-repair-v79.mjs';

function position(overrides = {}) {
  return {
    id: 'p1',
    mint: 'mint1',
    symbol: 'TEST',
    status: 'CLOSED',
    openedAtMs: 1_000_000,
    closedAtMs: 1_100_000,
    entryPriceSol: 1,
    exitPriceSol: 1,
    initialSizeSol: 1,
    realizedPnlSol: 0,
    realizedPnlPct: 0,
    closeReason: 'MANUAL PAPER CLOSE',
    ...overrides
  };
}

function finalSell(overrides = {}) {
  return {
    id: 't1',
    positionId: 'p1',
    side: 'SELL',
    quantity: 1,
    priceSol: 1,
    valueSol: 1,
    realizedPnlSol: 0,
    executedAtMs: 1_100_000,
    ...overrides
  };
}

// Legacy manual zero is a candidate.
assert.equal(isLegacyManualFlatCandidate(position()), true);

// New V78 verified breakeven must never be rewritten.
assert.equal(
  isLegacyManualFlatCandidate(
    position({
      exitSettlementVersion: 'MEMEFLOW_PAPER_CLOSE_SAFETY_V78'
    })
  ),
  false
);

// Automatic/lifecycle close is not in this repair set.
assert.equal(
  isLegacyManualFlatCandidate(
    position({closeReason: 'HARD STOP'})
  ),
  false
);

// Fresh historical archive mark recovers a WIN.
{
  const plan = buildHistoricalFlatPlan({
    position: position(),
    trades: [finalSell()],
    archivePoint: {
      t: 1_099_000,
      priceSol: 1.2
    },
    maxGapMs: 120_000
  });

  assert.equal(plan.kind, 'RECOVERABLE');
  assert.equal(plan.outcome, 'WIN');
  assert.ok(Math.abs(plan.newRealizedPnlSol - 0.2) < 1e-12);
  assert.ok(Math.abs(plan.newRealizedPnlPct - 20) < 1e-12);
}

// Fresh historical archive mark recovers a LOSS.
{
  const plan = buildHistoricalFlatPlan({
    position: position(),
    trades: [finalSell()],
    archivePoint: {
      t: 1_099_000,
      priceSol: 0.8
    }
  });

  assert.equal(plan.kind, 'RECOVERABLE');
  assert.equal(plan.outcome, 'LOSS');
  assert.ok(Math.abs(plan.newRealizedPnlSol + 0.2) < 1e-12);
}

// A real archived breakeven remains verified Flat.
{
  const plan = buildHistoricalFlatPlan({
    position: position(),
    trades: [finalSell()],
    archivePoint: {
      t: 1_099_000,
      priceSol: 1
    }
  });

  assert.equal(plan.kind, 'RECOVERABLE');
  assert.equal(plan.outcome, 'FLAT');
  assert.equal(plan.newRealizedPnlSol, 0);
}

// Stale evidence is not guessed; it becomes Unknown.
{
  const plan = buildHistoricalFlatPlan({
    position: position(),
    trades: [finalSell()],
    archivePoint: {
      t: 900_000,
      priceSol: 1.3
    },
    maxGapMs: 120_000
  });

  assert.equal(plan.kind, 'UNKNOWN');
  assert.ok(
    ['ARCHIVE_MARK_BEFORE_ENTRY', 'ARCHIVE_MARK_STALE'].includes(plan.code)
  );
}

// Missing price evidence becomes Unknown.
{
  const plan = buildHistoricalFlatPlan({
    position: position(),
    trades: [finalSell()],
    archivePoint: null
  });

  assert.equal(plan.kind, 'UNKNOWN');
  assert.equal(plan.code, 'NO_RELIABLE_ARCHIVE_MARK');
}

// Partial prior exit is preserved in total realized P&L.
{
  const prior = {
    id: 'tp1',
    positionId: 'p1',
    side: 'SELL',
    quantity: 0.5,
    priceSol: 1.2,
    valueSol: 0.6,
    realizedPnlSol: 0.1,
    executedAtMs: 1_050_000
  };
  const last = finalSell({
    id: 't2',
    quantity: 0.5
  });

  const plan = buildHistoricalFlatPlan({
    position: position(),
    trades: [prior, last],
    archivePoint: {
      t: 1_099_000,
      priceSol: 0.8
    }
  });

  // +0.1 prior, -0.1 final = verified true flat.
  assert.equal(plan.kind, 'RECOVERABLE');
  assert.equal(plan.outcome, 'FLAT');
  assert.equal(plan.newRealizedPnlSol, 0);
}

const summary = summarizePlans([
  {kind: 'RECOVERABLE', outcome: 'WIN'},
  {kind: 'RECOVERABLE', outcome: 'LOSS'},
  {kind: 'RECOVERABLE', outcome: 'FLAT'},
  {kind: 'UNKNOWN', code: 'NO_RELIABLE_ARCHIVE_MARK'}
]);

assert.deepEqual(summary, {
  candidates: 4,
  recoverable: 3,
  wouldBecomeWins: 1,
  wouldBecomeLosses: 1,
  verifiedTrueFlat: 1,
  wouldBecomeUnknown: 1,
  unknownReasons: {
    NO_RELIABLE_ARCHIVE_MARK: 1
  }
});

console.log('historical-flat-repair-v79: ok');
