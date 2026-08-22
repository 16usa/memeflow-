import assert from 'node:assert/strict';
import { PROFILE_PRESETS, profilePreset, defaultSettings, validateSettings } from '../src/settings.mjs';

const expected = {
  conservative: {minScore:82,minConfidence:70,minBuyPressure:1.5,minHolders:60,maxTop10Pct:20,maxDeveloperPct:10,requireFreshHolderSnapshot:true},
  balanced: {minScore:72,minConfidence:70,minBuyPressure:1.2,minHolders:30,maxTop10Pct:25,maxDeveloperPct:20,requireFreshHolderSnapshot:true},
  aggressive: {minScore:65,minConfidence:70,minBuyPressure:1.1,minHolders:20,maxTop10Pct:30,maxDeveloperPct:25,requireFreshHolderSnapshot:true}
};

assert.deepEqual(PROFILE_PRESETS, expected);

for (const [name,preset] of Object.entries(expected)) {
  assert.deepEqual(profilePreset(name), preset);
  assert.deepEqual(profilePreset(name.toUpperCase()), preset);
  const checked=validateSettings({...defaultSettings(),profile:name,...preset});
  assert.equal(checked.ok,true,`${name} preset must validate`);
  for (const [key,value] of Object.entries(preset)) assert.equal(checked.settings[key],value,`${name}.${key}`);
}

const forbidden=new Set([
 'tradingCapital','dailySpendLimit','positionSize','maxPositionSize','maxOpenPositions','maxDailyEntries',
 'dailyLossLimit','feeReserve','hardStopPct','trailingStopPct','tp1Pct','tp1SellPct','tp2Pct','tp2SellPct',
 'runnerPct','maxHoldMinutes','exitBuyPressure','exitOnWeakBuyPressure'
]);
for (const [name,preset] of Object.entries(PROFILE_PRESETS)) {
  for (const key of Object.keys(preset)) assert.equal(forbidden.has(key),false,`${name} must not control money/exits: ${key}`);
}
assert.equal(profilePreset('unknown'),null);
console.log('profile presets ok');
