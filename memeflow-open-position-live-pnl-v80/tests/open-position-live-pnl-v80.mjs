import assert from 'node:assert/strict';
import fs from 'node:fs';

const trading = fs.readFileSync(
  new URL('../trading.js', import.meta.url),
  'utf8'
);

const server = fs.readFileSync(
  new URL('../app-server.mjs', import.meta.url),
  'utf8'
);

const renderStart = trading.indexOf('function renderPositions()');
const renderEnd = trading.indexOf('\nfunction renderTrades(', renderStart);

assert.ok(renderStart >= 0, 'renderPositions() not found');
assert.ok(renderEnd > renderStart, 'renderPositions() end not found');

const render = trading.slice(renderStart, renderEnd);

assert.match(render, /MEMEFLOW_OPEN_POSITION_LIVE_PNL_V80/);
assert.match(
  render,
  /position\?\.tokenMetrics\?\.pnlReady\s*===\s*true/
);
assert.match(
  render,
  /num\(position\?\.tokenMetrics\?\.pnlPct\)/
);
assert.doesNotMatch(
  render,
  /num\(position\.unrealizedPnlPct,\s*0\)/
);
assert.match(
  render,
  /const pnlText\s*=\s*finite\(pnl\)[\s\S]*?:\s*'—'/
);
assert.match(render, /pnl\s*>\s*0\s*\?\s*'\+'/);
assert.match(
  render,
  /pnl\s*>\s*0\s*\?\s*'pnl-positive'[\s\S]*pnl\s*<\s*0\s*\?\s*'pnl-negative'/
);
assert.match(render, /Math\.abs\(pnl\)\s*<\s*0\.01/);

const liveStart = server.indexOf(
  '// MEMEFLOW_OPEN_POSITION_LIVE_BATCH_V18'
);
const liveEnd = server.indexOf(
  '// MEMEFLOW_OPEN_POSITION_MARKET_METRICS_V3',
  liveStart
);

assert.ok(liveStart >= 0 && liveEnd > liveStart);

const liveRoute = server.slice(liveStart, liveEnd);

assert.match(liveRoute, /const pnlReady=Boolean\(/);
assert.match(liveRoute, /remainingQty\*\(markPrice-entryPrice\)/);
assert.match(
  liveRoute,
  /\(\(realized\+unrealized\)\/initialSize\)\*100/
);
assert.match(liveRoute, /tokenMetrics:\{/);
assert.match(liveRoute, /pnlReady,/);
assert.match(liveRoute, /pnlPct,/);
assert.match(liveRoute, /pnlMarkPriceSol:markPrice/);
assert.match(liveRoute, /pnlMarkSource:markSource/);

assert.match(
  trading,
  /\(\)\s*=>\s*poll\(\{\s*redrawChart:\s*false\s*\}\),\s*1800/
);

console.log('open-position-live-pnl-v80: ok');
