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
const v951 = fs.readFileSync(
  new URL('../chart-header-geometry-v95-1.css', import.meta.url),
  'utf8'
);

// Canonical V94 avatar geometry remains 36px.
// Do NOT couple this test to V94's old cache-bust query string.
assert.match(
  trading,
  /\.trade-token-avatar\s*\{[\s\S]*?width:\s*36px;[\s\S]*?height:\s*36px;/
);

// Historical late chart-header owners must be removed.
assert.doesNotMatch(hierarchy, /MEMEFLOW CHART HEADER ROW V129/);
assert.doesNotMatch(hierarchy, /MEMEFLOW CHART HEADER ROW V130/);
assert.doesNotMatch(hierarchy, /MEMEFLOW_CHART_HEADER_ROW_V129_END/);
assert.doesNotMatch(hierarchy, /MEMEFLOW_CHART_HEADER_ROW_V130_END/);

// Old chart-specific avatar sizes are gone.
assert.doesNotMatch(
  trading,
  /\.chart-head\s+\.token-avatar\s*\{[\s\S]*?(?:width|height):\s*40px/
);
assert.doesNotMatch(
  trading,
  /\.token-avatar\s*\{\s*width:\s*(?:31|33)px;\s*height:\s*(?:31|33)px;/
);

// Repaired asset is the single final chart-header authority.
assert.doesNotMatch(html, /chart-header-geometry-v95\.css\?/);
assert.match(
  html,
  /chart-header-geometry-v95-1\.css\?v=chart-header-geometry-v95-1-20260909/
);

const v951Index = html.indexOf('/chart-header-geometry-v95-1.css');
const v89Index = html.indexOf('/trading-row-height-v89.css');
assert.ok(v951Index > v89Index);

// Required geometry.
assert.match(v951, /height:\s*64px\s*!important;/);
assert.match(v951, /padding:\s*8px 9px\s*!important;/);
assert.match(v951, /grid-template-columns:\s*46px minmax\(0,\s*1fr\)\s*!important;/);
assert.match(v951, /column-gap:\s*7px\s*!important;/);
assert.match(v951, /width:\s*36px\s*!important;/);
assert.match(v951, /height:\s*36px\s*!important;/);

// Hard scope guard: chart/canvas controls are not selected by this stylesheet.
for (const forbidden of [
  '.chart-wrap',
  '#chartCanvas',
  '.timeframes',
  '.chart-legend',
  '.indicator-bar',
  '.selected-metrics'
]) {
  assert.ok(!v951.includes(forbidden), `forbidden chart selector in V95.1: ${forbidden}`);
}

console.log('chart-header-geometry-v95-1: ok');
