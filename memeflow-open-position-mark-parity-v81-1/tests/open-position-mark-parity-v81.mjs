import assert from 'node:assert/strict';
import fs from 'node:fs';

import {
  resolvePaperPositionMarkV81,
  tokenPriceMarkTimeV81
} from '../src/paper-position-mark-v81.mjs';

import {
  resolveManualPaperExitMarkV78
} from '../src/paper-close-mark-v78.mjs';

const now = 2_000_000;

function position(overrides = {}) {
  return {
    id: 'p1',
    mint: 'mint1',
    status: 'OPEN',
    openedAtMs: 1_000_000,
    entryPriceSol: 1,
    currentPriceSol: 1,
    initialSizeSol: 1,
    remainingTokenQuantity: 1,
    realizedPnlSol: 0,
    lifecycleDecision: null,
    ...overrides
  };
}

// 1) A fresh token mark drives live P&L and manual close identically.
{
  const token = {
    priceSol: 0.8,
    lastPriceAt: now - 1_000
  };

  const live = resolvePaperPositionMarkV81({
    position: position(),
    token,
    nowMs: now
  });

  const close = resolveManualPaperExitMarkV78({
    position: position(),
    token,
    nowMs: now
  });

  assert.equal(live.ok, true);
  assert.equal(close.ok, true);
  assert.equal(live.priceSol, 0.8);
  assert.equal(close.priceSol, 0.8);
  assert.equal(live.source, 'token-market');
  assert.equal(close.source, 'token-market');
}

// 2) A fresh trade mark is the preferred live authority.
{
  const resolved = resolvePaperPositionMarkV81({
    position: position(),
    token: {
      priceSol: 0.9,
      lastPriceAt: now - 500
    },
    tradeMarkPriceSol: 0.75,
    tradeMarkAt: now - 100,
    tradeMarkSource: 'chart-trade-event',
    nowMs: now
  });

  assert.equal(resolved.ok, true);
  assert.equal(resolved.priceSol, 0.75);
  assert.equal(resolved.source, 'chart-trade-event');
}

// 3) A pre-entry trade must never value a post-entry position.
{
  const resolved = resolvePaperPositionMarkV81({
    position: position(),
    token: {
      priceSol: 0.9,
      lastPriceAt: now - 500
    },
    tradeMarkPriceSol: 0.5,
    tradeMarkAt: 900_000,
    tradeMarkSource: 'chart-trade-event',
    nowMs: now
  });

  assert.equal(resolved.ok, true);
  assert.equal(resolved.priceSol, 0.9);
  assert.equal(resolved.source, 'token-market');
}

// 4) A stale price-specific clock cannot be made fresh by generic updatedAt.
{
  const token = {
    priceSol: 0.7,
    lastPriceAt: now - 500_000,
    updatedAt: now - 100
  };

  assert.equal(
    tokenPriceMarkTimeV81(token),
    now - 500_000
  );

  const resolved = resolvePaperPositionMarkV81({
    position: position(),
    token,
    nowMs: now
  });

  assert.equal(resolved.ok, false);
  assert.equal(resolved.code, 'LIVE_MARK_UNAVAILABLE');
}

// 5) Generic scanner time remains a compatibility fallback only when no
// price-specific clock exists.
{
  const resolved = resolvePaperPositionMarkV81({
    position: position(),
    token: {
      priceSol: 1.15,
      marketScannedAt: now - 1_000
    },
    nowMs: now
  });

  assert.equal(resolved.ok, true);
  assert.equal(resolved.priceSol, 1.15);
}

// 6) Fresh engine lifecycle mark is allowed; untouched un-timestamped engine
// placeholder is not.
{
  const good = resolvePaperPositionMarkV81({
    position: position({
      currentPriceSol: 1.1,
      lifecycleDecision: {
        atMs: now - 1_000
      }
    }),
    token: {},
    nowMs: now
  });

  assert.equal(good.ok, true);
  assert.equal(good.source, 'paper-engine-mark');

  const bad = resolvePaperPositionMarkV81({
    position: position({
      currentPriceSol: 1.1,
      lifecycleDecision: null
    }),
    token: {},
    nowMs: now
  });

  assert.equal(bad.ok, false);
}

// 7) A genuine fresh breakeven remains a valid exact zero outcome.
{
  const resolved = resolvePaperPositionMarkV81({
    position: position(),
    token: {
      priceSol: 1,
      lastPriceAt: now - 100
    },
    nowMs: now
  });

  assert.equal(resolved.ok, true);
  assert.equal(resolved.priceSol, 1);
}

// 8) Static route contract: /positions/live must use the shared resolver and
// expose diagnostics. The old strict-only branch caused the observed dash.
const server = fs.readFileSync(
  new URL('../app-server.mjs', import.meta.url),
  'utf8'
);

const liveStart = server.indexOf(
  '// MEMEFLOW_OPEN_POSITION_LIVE_BATCH_V18'
);
const liveEnd = server.indexOf(
  '// MEMEFLOW_OPEN_POSITION_MARKET_METRICS_V3',
  liveStart
);

assert.ok(liveStart >= 0 && liveEnd > liveStart);

const route = server.slice(liveStart, liveEnd);

assert.match(
  server,
  /resolvePaperPositionMarkV81/
);
assert.match(
  route,
  /MEMEFLOW_OPEN_POSITION_MARK_PARITY_V81/
);
assert.match(
  route,
  /resolvePaperPositionMarkV81\(\{/
);
assert.doesNotMatch(
  route,
  /marketMarkSource\.toLowerCase\(\)\.includes\('trade'\)/
);
assert.match(route, /pnlMarkResolverVersion:/);
assert.match(route, /pnlUnavailableReason:/);
assert.match(route, /pnlMarkAgeMs:/);

console.log('open-position-mark-parity-v81: ok');
