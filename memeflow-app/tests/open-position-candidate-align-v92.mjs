import assert from 'node:assert/strict';
import fs from 'node:fs';

const trading = fs.readFileSync(
  new URL('../trading.css', import.meta.url),
  'utf8'
);
const hierarchy = fs.readFileSync(
  new URL('../trading-visual-hierarchy-v67.css', import.meta.url),
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
const v92 = fs.readFileSync(
  new URL('../open-position-candidate-align-v92.css', import.meta.url),
  'utf8'
);

// Candidate base model: auto-height grid text stack.
assert.match(
  trading,
  /\.candidate-main\s*\{[\s\S]*?display:\s*grid;[\s\S]*?gap:\s*5px;/
);

// Candidate mobile late layer: centered, 4px gap.
assert.match(
  hierarchy,
  /\.candidate-main\s*\{[\s\S]*?align-self:\s*center;[\s\S]*?gap:\s*4px\s*!important;/
);

// Old Open Position mobile conflict really exists.
assert.match(
  hierarchy,
  /\.position-bottomline\s*\{[\s\S]*?display:\s*block\s*!important;/
);

// V89 remains exact 64px authority.
assert.match(v89, /--mf-v89-row-height:\s*64px;/);

// V92 mirrors Candidate's auto-height grid model.
assert.match(
  v92,
  /\.position-main\s*\{[\s\S]*?height:\s*auto\s*!important;/
);
assert.match(v92, /display:\s*grid\s*!important;/);
assert.match(v92, /grid-template-rows:\s*auto auto\s*!important;/);
assert.match(v92, /align-self:\s*center\s*!important;/);

// Critical: no V91 full-height stretch model.
assert.doesNotMatch(v92, /height:\s*100%\s*!important;/);
assert.doesNotMatch(v92, /align-self:\s*stretch\s*!important;/);

// Neutralize V67 bottomline block rule.
assert.match(
  v92,
  /\.positions-panel \.position-bottomline\s*\{[\s\S]*?display:\s*flex\s*!important;/
);

// Runtime must have one Open Position alignment owner only.
assert.doesNotMatch(html, /open-position-copy-align-v90\.css/);
assert.doesNotMatch(html, /open-position-align-v91\.css/);
assert.match(
  html,
  /open-position-candidate-align-v92\.css\?v=open-position-candidate-align-v92-20260909-1/
);

// V92 loads after V89.
const i89 = html.indexOf('/trading-row-height-v89.css');
const i92 = html.indexOf('/open-position-candidate-align-v92.css');
assert.ok(i89 >= 0, 'V89 missing');
assert.ok(i92 > i89, 'V92 must load after V89');

// Geometry only.
assert.doesNotMatch(v92, /(?:^|\s)color\s*:/m);
assert.doesNotMatch(v92, /background\s*:/);
assert.doesNotMatch(v92, /font-size\s*:/);
assert.doesNotMatch(v92, /(?:^|\s)(?:height|min-height|max-height):\s*64px/m);

console.log('open-position-candidate-align-v92: ok');
