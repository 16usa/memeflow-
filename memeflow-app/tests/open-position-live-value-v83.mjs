import assert from 'node:assert/strict';
import fs from 'node:fs';

import {
  resolvePaperPositionMarkV81
} from '../src/paper-position-mark-v81.mjs';

const now = 10_000_000;

function position(overrides = {}) {
  return {
    id: 'p1',
    mint: 'mint1',
    status: 'OPEN',
    openedAtMs: 1_000_000,
    entryPriceSol: 1,
    currentPriceSol: 1,
    initialSizeSol: 1,
    remainingSizeSol: 1,
    initialTokenQuantity: 1,
    remainingTokenQuantity: 1,
    realizedPnlSol: 0,
    lifecycleDecision: null,
    ...overrides
  };
}

// 1) Confirmed post-entry trade remains the latest known price in a quiet market.
{
  const resolved = resolvePaperPositionMarkV81({
    position: position(),
    token: {},
    tradeMarkPriceSol: 0.8,
    tradeMarkAt: now - 600_000,
    tradeMarkSource: 'chart-trade-event',
    nowMs: now,
    maxAgeMs: 120_000
  });

  assert.equal(resolved.ok, true);
  assert.equal(resolved.priceSol, 0.8);
  assert.equal(resolved.continuity, 'last-confirmed-trade');
}

// 2) Trade-backed canonical token price gets the same continuity.
{
  const resolved = resolvePaperPositionMarkV81({
    position: position(),
    token: {
      priceSol: 1.2,
      lastPriceAt: now - 600_000,
      marketSource: 'ws-direct-trade-event-v13',
      eventSignature: 'sig'
    },
    nowMs: now
  });

  assert.equal(resolved.ok, true);
  assert.equal(resolved.priceSol, 1.2);
  assert.equal(resolved.source, 'token-live-trade');
}

// 3) Stale non-trade telemetry is still rejected.
{
  const resolved = resolvePaperPositionMarkV81({
    position: position(),
    token: {
      priceSol: 1.2,
      lastPriceAt: now - 600_000,
      marketSource: 'scanner'
    },
    nowMs: now,
    maxAgeMs: 120_000
  });

  assert.equal(resolved.ok, false);
}

// 4) Pre-entry trade is rejected.
{
  const resolved = resolvePaperPositionMarkV81({
    position: position(),
    token: {},
    tradeMarkPriceSol: 0.7,
    tradeMarkAt: 900_000,
    tradeMarkSource: 'chart-trade-event',
    nowMs: now
  });

  assert.equal(resolved.ok, false);
}

// 5) API contract: live value = remaining quantity * live mark.
// Total P&L = realized + remaining unrealized P&L.
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

assert.match(route, /const liveValueSol=/);
assert.match(route, /remainingQty\*markPrice/);
assert.match(route, /const pnlSol=/);
assert.match(route, /realized\+unrealized/);
assert.match(route, /liveValueSol,/);
assert.match(route, /pnlSol,/);

// 6) UI contract: first number is current live value, second is total P&L in SOL.
const trading = fs.readFileSync(
  new URL('../trading.js', import.meta.url),
  'utf8'
);

const renderStart = trading.indexOf('function renderPositions()');
const renderEnd = trading.indexOf('\nfunction renderTrades(', renderStart);

assert.ok(renderStart >= 0 && renderEnd > renderStart);
const render = trading.slice(renderStart, renderEnd);

assert.match(render, /MEMEFLOW_OPEN_POSITION_LIVE_VALUE_V83/);
assert.match(
  render,
  /num\(position\?\.tokenMetrics\?\.liveValueSol\)/
);
assert.match(
  render,
  /num\(position\?\.tokenMetrics\?\.pnlSol\)/
);
assert.match(
  render,
  /\$\{fmt\(liveValueSol,\s*valueDigits\)\}\s*SOL/
);
assert.match(
  render,
  /\$\{fmt\(pnlSol,\s*pnlDigits\)\}\s*SOL/
);

// Never show remainingSizeSol as if it were live market value.
assert.doesNotMatch(
  render,
  /position\.remainingSizeSol\s*\?\?/
);

// Existing 1.8s terminal poll is preserved.
assert.match(
  trading,
  /\(\)\s*=>\s*poll\(\{\s*redrawChart:\s*false\s*\}\),\s*1800/
);

console.log('open-position-live-value-v83: ok');
