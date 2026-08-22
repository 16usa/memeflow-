import assert from 'node:assert/strict';
import { PaperEngine } from '../src/paper-engine.mjs';

function makeStore(userId = 'user-1') {
  return {
    state: {
      users: {
        [userId]: {
          id: userId,
          killSwitch: false,
          settings: {}
        }
      },
      paperPositions: {},
      paperTrades: {},
      paperProposals: {},
      paperProcessed: {},
      paperMetrics: { entries: 0, exits: 0, errors: 0 }
    },
    save() {}
  };
}

function baseSettings(overrides = {}) {
  return {
    operatingMode: 'automate',
    tradingEnvironment: 'paper',
    ownerApproval: true,
    positionSize: 0.1,
    maxPositionSize: 0.5,
    maxOpenPositions: 4,
    maxDailyEntries: 10,
    dailySpendLimit: 0,
    tradingCapital: 0,
    dailyLossLimit: 0,
    decisionFreshnessSec: 60,
    ...overrides
  };
}

function buyReadyToken(now, mint = 'TestMint111111111111111111111111111111111') {
  return {
    mint,
    name: 'Nobody Cares Test',
    symbol: 'TEST',
    priceSol: 0.000001,
    holderFresh: true,
    updatedAt: now,
    lastPriceAt: now
  };
}

function buyReadyDecision(now) {
  return {
    state: 'BUY READY',
    score: 94,
    confidence: 100,
    updatedAt: now
  };
}

// Regression: ownerApproval=true must NOT downgrade AUTOMATE + PAPER to PROPOSED.
{
  let now = Date.parse('2026-08-22T20:00:00Z');
  const store = makeStore();
  const paper = new PaperEngine(store, { clock: () => now });
  const token = buyReadyToken(now);
  const settings = baseSettings({ ownerApproval: true });

  const first = paper.onDecision('user-1', token, buyReadyDecision(now), settings);

  assert.equal(first.action, 'OPENED');
  assert.equal(Object.keys(store.state.paperPositions).length, 1);
  assert.equal(Object.keys(store.state.paperTrades).length, 1);
  assert.equal(Object.keys(store.state.paperProposals).length, 0);
  assert.equal(Object.keys(store.state.paperProcessed).length, 1);

  // A fresh evaluator revision for the same still-open mint must not create
  // another entry or another processed record.
  now += 1000;
  token.updatedAt = now;
  token.lastPriceAt = now;
  const second = paper.onDecision('user-1', token, buyReadyDecision(now), settings);

  assert.equal(second.action, 'NONE');
  assert.equal(second.reason, 'POSITION_EXISTS');
  assert.equal(Object.keys(store.state.paperPositions).length, 1);
  assert.equal(Object.keys(store.state.paperTrades).length, 1);
  assert.equal(Object.keys(store.state.paperProposals).length, 0);
  assert.equal(Object.keys(store.state.paperProcessed).length, 1);
}

// ASSIST remains proposal-only and repeated BUY READY revisions create only
// one pending proposal for the same user + mint.
{
  let now = Date.parse('2026-08-22T20:10:00Z');
  const store = makeStore();
  const paper = new PaperEngine(store, { clock: () => now });
  const token = buyReadyToken(now, 'AssistMint11111111111111111111111111111111');
  const settings = baseSettings({ operatingMode: 'assist', ownerApproval: true });

  const first = paper.onDecision('user-1', token, buyReadyDecision(now), settings);
  assert.equal(first.action, 'PROPOSED');
  assert.equal(Object.keys(store.state.paperProposals).length, 1);
  assert.equal(Object.keys(store.state.paperPositions).length, 0);

  now += 1000;
  token.updatedAt = now;
  token.lastPriceAt = now;
  const second = paper.onDecision('user-1', token, buyReadyDecision(now), settings);

  assert.equal(second.action, 'PROPOSAL_EXISTS');
  assert.equal(Object.keys(store.state.paperProposals).length, 1);
  assert.equal(Object.keys(store.state.paperProcessed).length, 1);
  assert.equal(Object.keys(store.state.paperPositions).length, 0);
}

// LIVE behavior is unchanged: PaperEngine itself never opens a paper position
// when the configured environment is live.
{
  const now = Date.parse('2026-08-22T20:20:00Z');
  const store = makeStore();
  const paper = new PaperEngine(store, { clock: () => now });
  const token = buyReadyToken(now, 'LiveMint111111111111111111111111111111111');
  const result = paper.onDecision(
    'user-1',
    token,
    buyReadyDecision(now),
    baseSettings({ tradingEnvironment: 'live', ownerApproval: false })
  );

  assert.equal(result.action, 'NONE');
  assert.equal(result.reason, 'NOT_PAPER');
  assert.equal(Object.keys(store.state.paperPositions).length, 0);
  assert.equal(Object.keys(store.state.paperTrades).length, 0);
}

console.log('paper automate ok');
