import assert from 'node:assert/strict';
import fs from 'node:fs';

const ui=fs.readFileSync(new URL('../memeflow-insightx-v1.js',import.meta.url),'utf8');
const css=fs.readFileSync(new URL('../memeflow-insightx-v1.css',import.meta.url),'utf8');
const html=fs.readFileSync(new URL('../system-tokens.html',import.meta.url),'utf8');
const bootstrap=fs.readFileSync(new URL('../live-bootstrap.mjs',import.meta.url),'utf8');
const evaluate=fs.readFileSync(new URL('../src/evaluate.mjs',import.meta.url),'utf8');

assert.match(ui,/MEMEFLOW_INSIGHTX_WALLET_INTELLIGENCE_UI_V1/);
assert.match(ui,/mf-insightx-open-v1/);
assert.match(ui,/stopImmediatePropagation/);
assert.match(ui,/\/api\/insightx\/wallet-intelligence/);
assert.match(ui,/embed\.insightx\.network\/atlas/);
assert.match(css,/mf-insightx-panel-v1/);
assert.match(css,/@media\(max-width:760px\)/);
assert.match(html,/memeflow-insightx-v1\.css/);
assert.match(html,/memeflow-insightx-v1\.js/);
assert.match(bootstrap,/createInsightXWalletIntelligenceV1/);
assert.match(bootstrap,/\/api\/insightx\/config/);
assert.match(bootstrap,/\/api\/insightx\/wallet-intelligence/);
// Guardrail: this integration must not convert InsightX into the canonical score authority.
assert.match(evaluate,/scoreAuthority:'evaluate'/);
assert.match(evaluate,/walletRiskPenalty:0/);

console.log('InsightX UI v1 integration guard ok');
