import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync(
  new URL('../trading.html', import.meta.url),
  'utf8'
);
const trading = fs.readFileSync(
  new URL('../trading.css', import.meta.url),
  'utf8'
);
const hierarchy = fs.readFileSync(
  new URL('../trading-visual-hierarchy-v67.css', import.meta.url),
  'utf8'
);
const v95 = fs.readFileSync(
  new URL('../chart-header-geometry-v95.css', import.meta.url),
  'utf8'
);

// V94 canonical avatar rule remains 36px.
assert.match(
  trading,
  /\.trade-token-avatar\s*\{[\s\S]*?width:\s*36px;[\s\S]*?height:\s*36px;/
);

// Old marked chart-header experiments are removed from the existing hierarchy.
assert.doesNotMatch(hierarchy, /MEMEFLOW CHART HEADER ROW V129/);
assert.doesNotMatch(hierarchy, /MEMEFLOW CHART HEADER ROW V130/);
assert.doesNotMatch(hierarchy, /MEMEFLOW_CHART_HEADER_ROW_V129_END/);
assert.doesNotMatch(hierarchy, /MEMEFLOW_CHART_HEADER_ROW_V130_END/);

// Old base image-size overrides for this chart position are removed.
assert.doesNotMatch(
  trading,
  /\.chart-head\s+\.token-avatar\s*\{[\s\S]*?(?:width|height):\s*40px/
);
assert.doesNotMatch(
  trading,
  /\.token-avatar\s*\{\s*width:\s*(?:31|33)px;\s*height:\s*(?:31|33)px;/
);

// One final, isolated authority is loaded last.
assert.match(
  html,
  /chart-header-geometry-v95\.css\?v=chart-header-geometry-v95-20260909/
);

const v95Index = html.indexOf('/chart-header-geometry-v95.css');
const v89Index = html.indexOf('/trading-row-height-v89.css');
assert.ok(v95Index > v89Index);

// Required geometry.
assert.match(v95, /height:\s*64px\s*!important;/);
assert.match(v95, /padding:\s*8px 9px\s*!important;/);
assert.match(v95, /grid-template-columns:\s*46px minmax\(0,\s*1fr\)\s*!important;/);
assert.match(v95, /column-gap:\s*7px\s*!important;/);
assert.match(v95, /width:\s*36px\s*!important;/);
assert.match(v95, /height:\s*36px\s*!important;/);

// Scope guard: this patch must not touch chart/canvas/timeframes/legend/indicators.
for (const forbidden of [
  '.chart-wrap',
  '#chartCanvas',
  '.timeframes',
  '.chart-legend',
  '.indicator-bar',
  '.selected-metrics'
]) {
  assert.ok(!v95.includes(forbidden), `forbidden chart selector in V95: ${forbidden}`);
}

console.log('chart-header-geometry-v95: ok');
