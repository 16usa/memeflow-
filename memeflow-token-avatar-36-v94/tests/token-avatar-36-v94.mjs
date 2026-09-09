import assert from 'node:assert/strict';
import fs from 'node:fs';

const trading = fs.readFileSync(new URL('../trading.css', import.meta.url), 'utf8');
const hierarchy = fs.readFileSync(new URL('../trading-visual-hierarchy-v67.css', import.meta.url), 'utf8');
const html = fs.readFileSync(new URL('../trading.html', import.meta.url), 'utf8');
const v89 = fs.readFileSync(new URL('../trading-row-height-v89.css', import.meta.url), 'utf8');

assert.match(trading, /\.trade-token-avatar\s*\{[\s\S]*?width:\s*36px;[\s\S]*?height:\s*36px;/);
assert.doesNotMatch(trading, /\.trade-token-avatar\s*\{[\s\S]*?width:\s*(?:42|46)px;/);
assert.match(hierarchy, /\.mf-trading-pump-avatar-link-v76\s*\{[\s\S]*?width:\s*36px\s*!important;[\s\S]*?height:\s*36px\s*!important;/);
assert.match(hierarchy, /\.mf-trading-pump-avatar-link-v76 > \.trade-token-avatar\s*\{[\s\S]*?width:\s*36px\s*!important;[\s\S]*?height:\s*36px\s*!important;/);
assert.doesNotMatch(hierarchy, /\.mf-trading-pump-avatar-link-v76[\s\S]{0,500}?width:\s*(?:29|32)px\s*!important;/);
assert.match(v89, /--mf-v89-row-height:\s*64px;/);
assert.match(html, /trading\.css\?v=token-avatar-36-v94-20260909/);
assert.match(html, /trading-visual-hierarchy-v67\.css\?v=token-avatar-36-v94-20260909/);
console.log('token-avatar-36-v94: ok');
