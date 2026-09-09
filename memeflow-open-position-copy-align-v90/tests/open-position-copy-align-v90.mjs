import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync(
  new URL('../trading.html', import.meta.url),
  'utf8'
);
const v89 = fs.readFileSync(
  new URL('../trading-row-height-v89.css', import.meta.url),
  'utf8'
);
const v90 = fs.readFileSync(
  new URL('../open-position-copy-align-v90.css', import.meta.url),
  'utf8'
);

// V89 remains the row-size authority.
assert.match(v89, /--mf-v89-row-height:\s*64px;/);

// V90 must own only the Open Positions internal copy stack.
assert.match(
  v90,
  /\.positions-panel \.positions-list > \.position-row[\s\S]*?\.position-main\s*\{/
);
assert.match(v90, /grid-template-rows:\s*max-content max-content\s*!important;/);
assert.match(v90, /align-content:\s*center\s*!important;/);
assert.match(v90, /align-self:\s*center\s*!important;/);
assert.match(v90, /row-gap:\s*4px\s*!important;/);

// Prevent the two internal text rows from being stretched apart.
assert.match(
  v90,
  /\.positions-panel \.position-topline,[\s\S]*?\.positions-panel \.position-bottomline\s*\{[\s\S]*?height:\s*auto\s*!important;/
);

// Name and lower telemetry use the same compact operational baseline.
assert.match(
  v90,
  /\.positions-panel \.position-symbol\s*\{[\s\S]*?line-height:\s*1\.05\s*!important;/
);
assert.match(
  v90,
  /\.positions-panel \.position-bottomline\s*\{[\s\S]*?line-height:\s*1\.05\s*!important;/
);

// No semantic or row-height changes.
assert.doesNotMatch(v90, /(?:^|\s)color\s*:/m);
assert.doesNotMatch(v90, /background\s*:/);
assert.doesNotMatch(v90, /font-size\s*:/);
assert.doesNotMatch(v90, /(?:^|\s)(?:height|min-height|max-height):\s*64px/m);

// Must load after V89 so this is the final Open Positions copy geometry layer.
const i89 = html.indexOf('/trading-row-height-v89.css');
const i90 = html.indexOf('/open-position-copy-align-v90.css');
assert.ok(i89 >= 0, 'V89 asset missing');
assert.ok(i90 > i89, 'V90 must load after V89');

console.log('open-position-copy-align-v90: ok');
