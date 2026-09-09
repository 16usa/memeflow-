import assert from 'node:assert/strict';
import fs from 'node:fs';

const css = fs.readFileSync(
  new URL('../chart-header-geometry-v97.css', import.meta.url),
  'utf8'
);
const html = fs.readFileSync(
  new URL('../trading.html', import.meta.url),
  'utf8'
);
const accessibility = fs.readFileSync(
  new URL('../memeflow-accessibility-usability-v64a.css', import.meta.url),
  'utf8'
);
const js = fs.readFileSync(
  new URL('../trading.js', import.meta.url),
  'utf8'
);

// Exactly one runtime chart-header authority.
assert.match(
  html,
  /chart-header-geometry-v97\.css\?v=chart-header-row-parity-v97-20260909/
);
assert.doesNotMatch(html, /chart-header-geometry-v95-1\.css/);

// Root coarse-pointer rule exists globally.
assert.match(
  accessibility,
  /@media\s*\(pointer:\s*coarse\)[\s\S]*?button[\s\S]*?min-block-size:\s*44px;/
);

// Canonical geometry.
assert.match(css, /height:\s*64px\s*!important;/);
assert.match(css, /padding:\s*8px 9px\s*!important;/);
assert.match(css, /grid-template-columns:\s*minmax\(0,\s*1fr\) 128px\s*!important;/);
assert.match(css, /grid-template-columns:\s*46px minmax\(0,\s*1fr\)\s*!important;/);
assert.match(css, /width:\s*36px\s*!important;/);
assert.match(css, /height:\s*36px\s*!important;/);

// Left and right text stacks share the SAME explicit tracks.
assert.match(css, /--mf-chart-head-primary-row:\s*20px;/);
assert.match(css, /--mf-chart-head-secondary-row:\s*14px;/);
assert.match(css, /--mf-chart-head-row-gap:\s*4px;/);
assert.match(css, /--mf-chart-head-stack-height:\s*38px;/);

const sharedTracks = /grid-template-rows:\s*var\(--mf-chart-head-primary-row\)\s*var\(--mf-chart-head-secondary-row\)\s*!important;/g;
assert.ok((css.match(sharedTracks) || []).length >= 2);

// Both native header buttons opt out of the global 44px LAYOUT minimum.
assert.match(
  css,
  /#copyMintBtn\s*\{[\s\S]*?min-block-size:\s*0\s*!important;/
);
assert.match(
  css,
  /\.chart-head > \.price-toggle\s*\{[\s\S]*?min-block-size:\s*0\s*!important;/
);

// Both keep separate 44px touch targets.
assert.match(
  css,
  /#copyMintBtn::before\s*\{[\s\S]*?width:\s*44px\s*!important;[\s\S]*?height:\s*44px\s*!important;/
);
assert.match(
  css,
  /\.chart-head > \.price-toggle::after\s*\{[\s\S]*?height:\s*44px\s*!important;/
);

// Price-mode text is explicitly contained.
for (const selector of ['.token-price', '.token-market']) {
  const i = css.indexOf(selector);
  assert.ok(i >= 0, `${selector} missing`);
  const chunk = css.slice(i, i + 900);
  assert.match(chunk, /max-width:\s*100%\s*!important;/);
  assert.match(chunk, /overflow:\s*hidden\s*!important;/);
  assert.match(chunk, /text-overflow:\s*ellipsis\s*!important;/);
  assert.match(chunk, /white-space:\s*nowrap\s*!important;/);
}

// Pump.fun badge is locked to the same bottom-right V76 geometry.
assert.match(
  css,
  /#chartTokenAvatarLinkV128 > \.mf-pump-avatar-badge-v76\s*\{[\s\S]*?right:\s*-4px\s*!important;[\s\S]*?bottom:\s*-4px\s*!important;[\s\S]*?width:\s*16px\s*!important;[\s\S]*?height:\s*16px\s*!important;/
);

// The toggle JS changes content/state, not CSS dimensions.
assert.match(js, /function renderPriceModeSummary\(/);
assert.match(js, /button\.dataset\.metric = state\.chartMetric;/);
assert.doesNotMatch(
  js,
  /priceModeBtn[\s\S]{0,350}\.style\.(?:width|height|minWidth|maxWidth)/
);

// Hard scope guard: chart itself is untouched.
for (const forbidden of [
  '.chart-wrap',
  '#chartCanvas',
  '.timeframes',
  '.chart-legend',
  '.indicator-bar',
  '.selected-metrics'
]) {
  assert.ok(!css.includes(forbidden), `forbidden chart selector in V97: ${forbidden}`);
}

console.log('chart-header-row-parity-v97: ok');
