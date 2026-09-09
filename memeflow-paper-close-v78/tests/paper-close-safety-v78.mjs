import assert from 'node:assert/strict';

import {PaperEngine} from '../src/paper-engine.mjs';
import '../src/paper-close-safety-v78.mjs';

function makeStore({position, token}) {
  return {
    state: {
      users: {
        u1: {
          settings: {
            tradingEnvironment: 'paper',
            operatingMode: 'automate'
          }
        }
      },
      tokens: token ? {[token.mint]: token} : {},
      paperPositions: {[position.id]: position},
      paperTrades: {},
      paperProposals: {},
      paperProcessed: {},
      paperMetrics: {entries: 1, exits: 0, errors: 0}
    },
    saveCount: 0,
    save() {
      this.saveCount += 1;
    }
  };
}

function basePosition(overrides = {}) {
  return {
    id: 'p1',
    userId: 'u1',
    mint: 'mint1',
    symbol: 'TEST',
    status: 'OPEN',
    mode: 'paper',
    openedAt: new Date(1_000_000).toISOString(),
    openedAtMs: 1_000_000,
    entryPriceSol: 1,
    currentPriceSol: 1,
    exitPriceSol: null,
    initialSizeSol: 1,
    remainingSizeSol: 1,
    initialTokenQuantity: 1,
    remainingTokenQuantity: 1,
    realizedPnlSol: 0,
    unrealizedPnlSol: 0,
    realizedPnlPct: 0,
    unrealizedPnlPct: 0,
    highestPriceSol: 1,
    trailingStopPriceSol: null,
    closeReason: null,
    takeProfitHistory: [],
    settingsSnapshot: {},
    ...overrides
  };
}

const now = 1_120_000;

// 1) Old bug: untouched entry placeholder must NOT become a fake Flat.
{
  const position = basePosition();
  const store = makeStore({
    position,
    token: {
      mint: 'mint1',
      priceSol: 1,
      lastPriceAt: 900_000
    }
  });
  const engine = new PaperEngine(store, {clock: () => now});

  const result = engine.closePosition(
    'u1',
    'p1',
    'MANUAL PAPER CLOSE'
  );

  assert.equal(result.ok, false);
  assert.equal(result.code, 'EXIT_PRICE_UNAVAILABLE');
  assert.equal(position.status, 'OPEN');
  assert.equal(position.realizedPnlSol, 0);
  assert.equal(Object.keys(store.state.paperTrades).length, 0);
}

// 2) Fresh token mark closes at the real price and records real P&L.
{
  const position = basePosition();
  const store = makeStore({
    position,
    token: {
      mint: 'mint1',
      priceSol: 1.2,
      lastPriceAt: now - 1_000
    }
  });
  const engine = new PaperEngine(store, {clock: () => now});

  const result = engine.closePosition(
    'u1',
    'p1',
    'MANUAL PAPER CLOSE'
  );

  assert.equal(result.ok, true);
  assert.equal(position.status, 'CLOSED');
  assert.equal(position.exitPriceSol, 1.2);
  assert.equal(position.exitPriceSource, 'token-market');
  assert.ok(Math.abs(position.realizedPnlSol - 0.2) < 1e-12);
  assert.ok(Math.abs(position.realizedPnlPct - 20) < 1e-12);

  const sells = Object.values(store.state.paperTrades).filter(
    trade => trade.side === 'SELL'
  );
  assert.equal(sells.length, 1);
  assert.ok(Math.abs(sells[0].realizedPnlSol - 0.2) < 1e-12);
}

// 3) A genuine breakeven is still allowed to be Flat when the mark is fresh.
{
  const position = basePosition();
  const store = makeStore({
    position,
    token: {
      mint: 'mint1',
      priceSol: 1,
      lastPriceAt: now - 500
    }
  });
  const engine = new PaperEngine(store, {clock: () => now});

  const result = engine.closePosition(
    'u1',
    'p1',
    'MANUAL PAPER CLOSE'
  );

  assert.equal(result.ok, true);
  assert.equal(position.status, 'CLOSED');
  assert.equal(position.exitPriceSol, 1);
  assert.equal(position.realizedPnlSol, 0);
  assert.equal(position.exitPriceSource, 'token-market');
}

console.log('paper-close-safety-v78: ok');
