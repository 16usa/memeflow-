import assert from 'node:assert/strict';
import fs from 'node:fs';

const base = fs.readFileSync(
  new URL('../trading.css', import.meta.url),
  'utf8'
);
const html = fs.readFileSync(
  new URL('../trading.html', import.meta.url),
  'utf8'
);
const v89 = fs.readFileSync(
  new URL('../trading-row-height-v89.css', import.meta.url),
  'utf8'
);

// Historical source of truth: Candidates were designed at min-height 64px.
assert.match(
  base,
  /\.candidate\s*\{[\s\S]*?min-height:\s*64px;[\s\S]*?padding:\s*8px 10px;/
);

// V89 defines one fixed 64px token.
assert.match(v89, /--mf-v89-row-height:\s*64px;/);
assert.match(v89, /--mf-v89-row-pad-y:\s*8px;/);

// All three families must consume the same height token.
assert.match(
  v89,
  /\.candidates-panel #candidateList > \.candidate\s*\{[\s\S]*?height:\s*var\(--mf-v89-row-height\)\s*!important;/
);
assert.match(
  v89,
  /\.positions-panel \.positions-list > \.position-row\s*\{[\s\S]*?height:\s*var\(--mf-v89-row-height\)\s*!important;/
);
assert.match(
  v89,
  /\.bottom-history-panel \.trade-history > \.trade-row\.trade-log-row\s*\{[\s\S]*?height:\s*var\(--mf-v89-row-height\)\s*!important;/
);

// Exact box, not only min-height.
for (const selector of [
  '.candidate',
  '.position-row',
  '.trade-row.trade-log-row'
]) {
  assert.ok(v89.includes('max-height: var(--mf-v89-row-height) !important;'));
}

// V89 must be the final row-geometry asset.
assert.match(
  html,
  /trading-row-height-v89\.css\?v=row-height-canonical-v89-20260909/
);

// Old V87 runtime layer and experimental V88 runtime sync must not be loaded.
assert.doesNotMatch(html, /trading-row-height-v87\.css/);
assert.doesNotMatch(html, /trading-row-height-sync-v88\.js/);

// Geometry-only: no semantic visual changes.
assert.doesNotMatch(v89, /(?:^|\s)color\s*:/m);
assert.doesNotMatch(v89, /background\s*:/);
assert.doesNotMatch(v89, /font-size\s*:/);

console.log('row-height-canonical-v89: ok');
