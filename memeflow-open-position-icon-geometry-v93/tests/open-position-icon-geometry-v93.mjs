import assert from 'node:assert/strict';
import fs from 'node:fs';

const a11y = fs.readFileSync(
  new URL('../memeflow-accessibility-usability-v64a.css', import.meta.url),
  'utf8'
);
const popover = fs.readFileSync(
  new URL('../open-position-popover-v85.css', import.meta.url),
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

assert.match(
  a11y,
  /@media\s*\(pointer:\s*coarse\)[\s\S]*?:where\([\s\S]*?button,[\s\S]*?\)\s*\{[\s\S]*?min-block-size:\s*44px;/
);

assert.match(
  popover,
  /\.position-info-v85\s*\{[\s\S]*?width:\s*16px;[\s\S]*?height:\s*16px;/
);
assert.match(
  popover,
  /@media\s*\(max-width:\s*430px\)[\s\S]*?\.position-info-v85,[\s\S]*?width:\s*14px;[\s\S]*?height:\s*14px;/
);

assert.match(popover, /MEMEFLOW_OPEN_POSITION_ICON_GEOMETRY_V93/);
assert.match(
  popover,
  /body\.mf-accessibility-v64a \.position-info-v85\s*\{[\s\S]*?min-block-size:\s*16px\s*!important;[\s\S]*?max-block-size:\s*16px\s*!important;/
);
assert.match(
  popover,
  /@media\s*\(pointer:\s*coarse\)\s*and\s*\(max-width:\s*430px\)[\s\S]*?min-block-size:\s*14px\s*!important;/
);

assert.match(v89, /--mf-v89-row-height:\s*64px;/);
assert.doesNotMatch(html, /open-position-copy-align-v90\.css/);
assert.doesNotMatch(html, /open-position-align-v91\.css/);
assert.doesNotMatch(html, /open-position-candidate-align-v92\.css/);
assert.match(html, /open-position-popover-v85\.css/);

console.log('open-position-icon-geometry-v93: ok');
