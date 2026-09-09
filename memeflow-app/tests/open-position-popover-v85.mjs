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
  new URL('../open-position-popover-v85.css', import.meta.url),
  'utf8'
);

assert.match(trading, /MEMEFLOW_OPEN_POSITION_POPOVER_V85/);
assert.match(trading, /function openPositionInfoV85\(/);
assert.match(trading, /function positionPositionInfoV85\(/);
assert.match(trading, /class="position-info-v85"/);
assert.match(trading, /data-position-info-v85=/);
assert.match(trading, /querySelectorAll\('\.position-info-v85'\)/);
assert.match(trading, /event\.target\.closest\('\.position-info-v85'\)/);
assert.match(trading, /Hard stop/);
assert.match(trading, /Trailing/);
assert.match(trading, /TP1/);
assert.match(trading, /TP2/);
assert.match(trading, /Runner/);
assert.match(trading, /Max hold/);
assert.match(trading, /Exit pressure/);
assert.ok(html.includes('/open-position-popover-v85.css'));
assert.ok(/\/trading\.js\?v=open-position-popover-v85-20260909/.test(html));
assert.match(css, /\.position-info-v85/);
assert.match(css, /\.position-popover-v85/);
assert.match(css, /\.positions-panel \.position-pnl\.pnl-positive/);
assert.match(css, /\.positions-panel \.position-pnl\.pnl-negative/);

console.log('open-position-popover-v85: ok');
