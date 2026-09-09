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
const v87 = fs.readFileSync(
  new URL('../trading-row-height-v87.css', import.meta.url),
  'utf8'
);

// Candidates are the requested source of truth.
assert.match(
  base,
  /\.candidate\s*\{[\s\S]*?min-height:\s*64px;[\s\S]*?padding:\s*8px 10px;/
);

// Recent trades' canonical base contract is also 64px.
assert.match(
  base,
  /\.bottom-history-panel \.trade-row\.trade-log-row\s*\{[\s\S]*?height:\s*64px;[\s\S]*?min-height:\s*64px;[\s\S]*?max-height:\s*64px;/
);

// V87 must normalize Open positions to that same 64px contract.
assert.match(
  v87,
  /\.positions-panel \.positions-list > \.position-row\s*\{[\s\S]*?height:\s*var\(--mf-v87-operational-row-h\)\s*!important;[\s\S]*?min-height:\s*var\(--mf-v87-operational-row-h\)\s*!important;[\s\S]*?max-height:\s*var\(--mf-v87-operational-row-h\)\s*!important;/
);

// V87 re-asserts Recent trades in the same final layer.
assert.match(
  v87,
  /\.bottom-history-panel \.trade-history > \.trade-row\.trade-log-row\s*\{[\s\S]*?height:\s*var\(--mf-v87-operational-row-h\)\s*!important;/
);

assert.match(v87, /--mf-v87-operational-row-h:\s*64px;/);

// Important: do not change Candidate cards themselves.
assert.doesNotMatch(
  v87,
  /(?:^|[\s,>])\.candidate(?:\s|[{:.,>#])/m
);

// The V87 geometry authority must load after the current V86/V85 layers.
const v85 = html.indexOf('/open-position-popover-v85.css');
const v86 = html.indexOf('/open-position-surface-v86.css');
const v87Index = html.indexOf('/trading-row-height-v87.css');

assert.ok(v87Index >= 0, 'V87 stylesheet is not linked');
if (v85 >= 0) assert.ok(v87Index > v85, 'V87 must load after V85');
if (v86 >= 0) assert.ok(v87Index > v86, 'V87 must load after V86');

// Geometry-only patch: no JS asset/cache-bust is needed.
assert.doesNotMatch(v87, /color\s*:/);
assert.doesNotMatch(v87, /background\s*:/);
assert.doesNotMatch(v87, /font-size\s*:/);

console.log('row-height-unify-v87: ok');
