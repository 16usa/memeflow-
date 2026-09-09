import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync(
  new URL('../trading.html', import.meta.url),
  'utf8'
);
const hierarchy = fs.readFileSync(
  new URL('../trading-visual-hierarchy-v67.css', import.meta.url),
  'utf8'
);
const v89 = fs.readFileSync(
  new URL('../trading-row-height-v89.css', import.meta.url),
  'utf8'
);
const v91 = fs.readFileSync(
  new URL('../open-position-align-v91.css', import.meta.url),
  'utf8'
);

// Confirm the real pre-existing mobile conflict exists.
assert.match(
  hierarchy,
  /\.position-bottomline\s*\{[\s\S]*?display:\s*block\s*!important;/
);

// V89 remains canonical 64px row-height authority.
assert.match(v89, /--mf-v89-row-height:\s*64px;/);

// V91 must use a vertically centered flex stack.
assert.match(
  v91,
  /\.position-main\s*\{[\s\S]*?display:\s*flex\s*!important;/
);
assert.match(v91, /flex-direction:\s*column\s*!important;/);
assert.match(v91, /justify-content:\s*center\s*!important;/);
assert.match(v91, /height:\s*100%\s*!important;/);

// V91 must explicitly neutralize V67's display:block mobile rule.
assert.match(
  v91,
  /\.positions-panel \.position-bottomline\s*\{[\s\S]*?display:\s*flex\s*!important;/
);
assert.match(v91, /flex-wrap:\s*nowrap\s*!important;/);

// V90 must be removed from runtime to avoid two competing alignment owners.
assert.doesNotMatch(html, /open-position-copy-align-v90\.css/);

// V91 must be linked and loaded after V89.
const i89 = html.indexOf('/trading-row-height-v89.css');
const i91 = html.indexOf('/open-position-align-v91.css');

assert.ok(i89 >= 0, 'V89 asset missing');
assert.ok(i91 > i89, 'V91 must load after V89');

// Geometry-only patch.
assert.doesNotMatch(v91, /(?:^|\s)color\s*:/m);
assert.doesNotMatch(v91, /background\s*:/);
assert.doesNotMatch(v91, /font-size\s*:/);
assert.doesNotMatch(v91, /(?:^|\s)(?:height|min-height|max-height):\s*64px/m);

console.log('open-position-align-v91: ok');
