import assert from 'node:assert/strict';
import fs from 'node:fs';

import {
  ENTRY_ADMISSION_KEYS,
  LOGIC_DECISION_KEYS,
  PREOPEN_RPC_KEYS,
  evaluateEntryAdmission
} from '../src/settings-gate.mjs';

import {defaultSettings} from '../src/settings.mjs';

assert.equal(
  ENTRY_ADMISSION_KEYS.includes('requireDexPaid'),
  true,
  'DEX Paid must be an Entry Filter'
);
assert.equal(
  LOGIC_DECISION_KEYS.includes('requireDexPaid'),
  false,
  'DEX Paid must not be a post-admission Logic rule'
);
assert.equal(
  PREOPEN_RPC_KEYS.includes('requireDexPaid'),
  false,
  'DEX Paid must not be a pre-open wallet RPC rule'
);

const now = Date.now();
const base = {
  ...defaultSettings(),

  minLiquidityUsd: 0,
  minHolders: null,
  maxHolders: null,
  minTokenAgeMinutes: null,
  maxTokenAgeMinutes: null,
  minMarketCapUsd: null,
  maxMarketCapUsd: null,
  minBondingCurvePct: null,
  maxBondingCurvePct: null,
  minTotalFeesSol: null,
  maxTotalFeesSol: null,
  minVolume24hUsd: null,
  maxVolume24hUsd: null,
  minBuyTransactions: null,
  maxBuyTransactions: null,
  minSellTransactions: null,
  maxSellTransactions: null,
  minTotalTransactions: null,
  maxTotalTransactions: null,
  minTop10Pct: null,
  maxTop10Pct: null,
  minDeveloperPct: null,
  maxDeveloperPct: null,
  minBundlePct: null,
  maxBundlePct: null,
  minSniperPct: null,
  maxSniperPct: null,

  requireTwitter: false,
  requireWebsite: false,
  requireTelegram: false,
  requireAnySocial: false,
  includeKeywords: '',
  excludeKeywords: '',
  developerBlacklistWallets: []
};

const token = {
  mint: 'DexStage11111111111111111111111111111111',
  launchPlatform: 'pump',
  discoveredAt: now
};

// OFF: DEX Paid must have zero effect.
assert.equal(
  evaluateEntryAdmission(
    token,
    {...base, requireDexPaid: false},
    {now}
  ).admitted,
  true
);

// ON + unknown: hidden in pre-admission.
const unknown = evaluateEntryAdmission(
  token,
  {...base, requireDexPaid: true},
  {now}
);
assert.equal(unknown.admitted, false);
assert.equal(
  unknown.waitingGates.some(g => g.key === 'requireDexPaid'),
  true
);

// ON + not paid: hidden.
const unpaid = evaluateEntryAdmission(
  {...token, dexPaidConfirmed: false},
  {...base, requireDexPaid: true},
  {now}
);
assert.equal(unpaid.admitted, false);
assert.equal(
  unpaid.failedGates.some(g => g.key === 'requireDexPaid'),
  true
);

// ON + paid: admitted.
const paid = evaluateEntryAdmission(
  {...token, dexPaidConfirmed: true},
  {...base, requireDexPaid: true},
  {now}
);
assert.equal(paid.admitted, true);

// DEX Paid is checked only after the other Entry Filters pass.
// The runtime helper explicitly disables requireDexPaid while checking
// the cheap/local Entry Filters, then schedules the paid-order request.
const app = fs.readFileSync(
  new URL('../app-server.mjs', import.meta.url),
  'utf8'
);

assert.match(app, /function __mfDexPaidPassesOtherEntryFilters/);
assert.match(
  app,
  /const settings=\{\s*\.\.\.\(entry\.settings\|\|\{\}\),\s*requireDexPaid:false\s*\}/s
);
assert.match(
  app,
  /entries\.some\(\s*entry=>__mfDexPaidPassesOtherEntryFilters\(token,entry,now\)\s*\)/s
);
assert.match(app, /dexPaidVerifier\.check\(token\.mint\)/);
assert.match(app, /MEMEFLOW_DEX_PAID_ENTRY_FILTER_V1/);

// Standalone Settings UI: DEX Paid must live inside Entry filters, not in
// the top metadata strip and not as a special browser/view switch.
const settingsPage = fs.readFileSync(
  new URL('../settings-page.js', import.meta.url),
  'utf8'
);

const filtersStart = settingsPage.indexOf("['filters', 'Entry filters'");
const preopenStart = settingsPage.indexOf("['preopen', 'Pre-open RPC verification'");
assert.ok(filtersStart >= 0 && preopenStart > filtersStart);

const filtersBlock = settingsPage.slice(filtersStart, preopenStart);
assert.match(
  filtersBlock,
  /\['requireDexPaid', 'Require confirmed DEX Paid', 'boolean'\]/
);
assert.equal(
  settingsPage.includes('mf293DexPaidFilter'),
  false,
  'special top-level DEX switch must be removed'
);
assert.equal(
  settingsPage.includes('mf293-dex-filter-meta'),
  false,
  'DEX Paid must no longer be top metadata'
);

// Legacy System overlay must use the same semantic placement.
const system = fs.readFileSync(
  new URL('../system.js', import.meta.url),
  'utf8'
);
const systemFilterStart = system.indexOf("['filters', 'Entry filters'");
assert.ok(systemFilterStart >= 0);
const systemTail = system.slice(systemFilterStart, systemFilterStart + 6000);
assert.match(
  systemTail,
  /\['requireDexPaid', 'Require confirmed DEX Paid', 'boolean'\]/
);
assert.equal(system.includes('mf293DexPaidFilter'), false);

// No DEX pool/view filter may come back.
for (const source of [app, settingsPage, system]) {
  assert.equal(source.includes('memeflow:dex-pool-filter'), false);
  assert.equal(source.includes('dexViewRequested'), false);
  assert.equal(source.includes('mf293DexPoolFilterEnabled'), false);
}

console.log('dex paid scanner level v2 ok');
