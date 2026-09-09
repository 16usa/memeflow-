import assert from 'node:assert/strict';
import fs from 'node:fs';

const trading = fs.readFileSync(
  new URL('../trading.js', import.meta.url),
  'utf8'
);
const html = fs.readFileSync(
  new URL('../trading.html', import.meta.url),
  'utf8'
);
const css = fs.readFileSync(
  new URL('../open-position-info-v84.css', import.meta.url),
  'utf8'
);

const renderStart = trading.indexOf('function renderPositions()');
const renderEnd = trading.indexOf('\nfunction renderTrades(', renderStart);
assert.ok(renderStart >= 0 && renderEnd > renderStart);
const render = trading.slice(renderStart, renderEnd);

assert.match(render, /position-size/);
assert.match(render, /position-pnl/);
assert.match(render, /class="position-info-v84"/);
assert.match(render, /data-position-info-v84=/);

assert.doesNotMatch(render, /<span>SL \$\{fmt\(settings\.hardStopPct/);
assert.doesNotMatch(render, /<span>TP1 \$\{fmt\(settings\.tp1Pct/);
assert.doesNotMatch(render, /<span>TP2 \$\{fmt\(settings\.tp2Pct/);

assert.match(
  render,
  /event\.target\.closest\('\.position-info-v84'\)/
);
assert.match(
  render,
  /querySelectorAll\('\.position-info-v84'\)/
);
assert.match(render, /openPositionInfoV84\(position\)/);

assert.match(trading, /function openPositionInfoV84\(/);
assert.match(trading, /Hard stop/);
assert.match(trading, /Trailing/);
assert.match(trading, /TP1/);
assert.match(trading, /TP2/);
assert.match(trading, /Runner/);
assert.match(trading, /Max hold/);

const v84Index = html.indexOf('/open-position-info-v84.css');
const oldFinalIndex = html.indexOf('/memeflow-dark-x-surface-v131.css');
assert.ok(v84Index > oldFinalIndex);

assert.match(
  css,
  /\.positions-panel \.position-pnl\.pnl-positive\s*\{[\s\S]*color:\s*#22b67a\s*!important/
);
assert.match(
  css,
  /\.positions-panel \.position-pnl\.pnl-negative\s*\{[\s\S]*color:\s*#e3485d\s*!important/
);

assert.match(
  css,
  /\.positions-panel \.position-bottomline\s*\{[\s\S]*flex-wrap:\s*nowrap\s*!important/
);

assert.match(
  render,
  /num\(position\?\.tokenMetrics\?\.liveValueSol\)/
);
assert.match(
  render,
  /num\(position\?\.tokenMetrics\?\.pnlSol\)/
);

console.log('open-position-info-v84: ok');
