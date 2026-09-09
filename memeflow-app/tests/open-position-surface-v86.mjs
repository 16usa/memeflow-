import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync(
  new URL('../trading.html', import.meta.url),
  'utf8'
);
const css = fs.readFileSync(
  new URL('../open-position-surface-v86.css', import.meta.url),
  'utf8'
);

const v85 = html.indexOf('/open-position-popover-v85.css');
const v86 = html.indexOf('/open-position-surface-v86.css');

assert.ok(v85 >= 0, 'V85 stylesheet must remain installed');
assert.ok(v86 > v85, 'V86 must load after V85');

assert.match(
  css,
  /html\[data-theme="light"\] \.position-popover-v85[\s\S]*var\(--mf-app-surface-2, #f7f9fb\)/
);
assert.match(
  css,
  /html\[data-theme="dark"\] \.position-popover-v85[\s\S]*var\(--mf-x-dark-inset, #101113\)/
);
assert.match(css, /var\(--mf-x-dark-line, #2f3336\)/);

// V86 is intentionally surface-only: icon geometry and popover geometry
// stay owned by V85, preventing style conflicts.
assert.doesNotMatch(css, /\.position-info-v85/);
assert.doesNotMatch(css, /\bwidth\s*:/);
assert.doesNotMatch(css, /\bheight\s*:/);
assert.doesNotMatch(css, /\.position-pnl/);

console.log('open-position-surface-v86: ok');
