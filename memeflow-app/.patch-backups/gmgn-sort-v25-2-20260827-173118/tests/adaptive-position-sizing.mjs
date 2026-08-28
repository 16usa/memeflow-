import assert from 'node:assert/strict';
import {calculateAdaptivePositionSize} from '../src/adaptive-position-sizing.mjs';
import {PaperEngine} from '../src/paper-engine.mjs';

const now = Date.now();

const settings = {
  operatingMode: 'automate',
  tradingEnvironment: 'paper',
  ownerApproval: false,
  positionSize: 1,
  maxPositionSize: 1,
  maxOpenPositions: 4,
  maxDailyEntries: 10,
  dailySpendLimit: 0,
  tradingCapital: 0,
  dailyLossLimit: 0,
  feeReserve: 0.05,
  hardStopPct: 25,
  trailingStopPct: 15,
  tp1Pct: 100,
  tp1SellPct: 50,
  tp2Pct: 200,
  tp2SellPct: 25,
  runnerPct: 25,
  maxHoldMinutes: 1440,
  exitBuyPressure: 1,
  exitOnWeakBuyPressure: true,
  requireFreshHolderSnapshot: true,
  decisionFreshnessSec: 60,

  minScore: 0,
  minConfidence: 0,
  minHolders: 30,
  maxTop10Pct: 25,
  maxDeveloperPct: 20,
  minBuyPressure: 1.2,
  minLiquidityUsd: 1000
};

const strongToken = {
  mint: 'AdaptiveStrong1111111111111111111111111111',
  name: 'Adaptive Strong',
  symbol: 'AST',
  priceSol: 0.00001,
  holderCount: 140,
  top10Pct: 10,
  developerPct: 3,
  buyPressure: 3.5,
  liquidityUsd: 25000,
  holderFresh: true,
  dataQuality: 1,
  lastPriceAt: now,
  discoveredAt: now - 60_000
};

const qualifiedToken = {
  ...strongToken,
  mint: 'AdaptiveQualified111111111111111111111111',
  holderCount: 31,
  top10Pct: 24,
  developerPct: 19,
  buyPressure: 1.22,
  liquidityUsd: 1100,
  dataQuality: 0.80
};

const strong = calculateAdaptivePositionSize({
  token: strongToken,
  decision: {score: 100, confidence: 100},
  settings
});
assert.equal(strong.ok, true);
assert.equal(strong.amountSol, 1);

const qualified = calculateAdaptivePositionSize({
  token: qualifiedToken,
  decision: {score: 76, confidence: 80},
  settings
});
assert.equal(qualified.ok, true);
assert(qualified.amountSol > 0);
assert(qualified.amountSol < strong.amountSol);
assert(qualified.amountSol <= settings.positionSize);
assert(qualified.amountSol <= settings.maxPositionSize);

const store = {
  state: {
    users: {
      u1: {id: 'u1', settings: {...settings}, killSwitch: false}
    },
    tokens: {},
    paperPositions: {},
    paperTrades: {},
    paperProposals: {},
    paperProcessed: {},
    paperMetrics: {entries: 0, exits: 0, errors: 0}
  },
  save() {}
};

const engine = new PaperEngine(store, {clock: () => now});

const opened = engine.openPosition(
  'u1',
  strongToken,
  {state: 'BUY READY', score: 100, confidence: 100},
  settings,
  'adaptive-test'
);
assert.equal(opened.ok, true);
assert.equal(opened.position.initialSizeSol, 1);
assert.equal(opened.position.positionSizing.mode, 'adaptive');

const store2 = {
  state: {
    users: {
      u2: {id: 'u2', settings: {...settings}, killSwitch: false}
    },
    tokens: {},
    paperPositions: {},
    paperTrades: {},
    paperProposals: {},
    paperProcessed: {},
    paperMetrics: {entries: 0, exits: 0, errors: 0}
  },
  save() {}
};

const engine2 = new PaperEngine(store2, {clock: () => now});
const blockedToken = {...strongToken, mint: 'BlockedAdaptive111111111111111111111111111', top10Pct: 80};

const blocked = engine2.openPosition(
  'u2',
  blockedToken,
  {state: 'BUY READY', score: 100, confidence: 100},
  settings,
  'blocked-test'
);

assert.equal(blocked.ok, false);
assert.equal(blocked.code, 'DECISION_NOT_BUY_READY');
assert.notEqual(blocked.decision?.state, 'BUY READY');

console.log('adaptive position sizing ok');
