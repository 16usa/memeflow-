import assert from 'node:assert/strict';
import {
  PROFILE_PRESETS,
  profilePreset,
  defaultSettings,
  validateSettings
} from '../src/settings.mjs';

const LOGIC_PROFILE_KEYS = [
  'minScore',
  'minConfidence',
  'minBuyPressure',
  'decisionFreshnessSec',
  'requireFreshHolderSnapshot',
  'requireWebsiteOrX'
];

const expected = {
  conservative: {
    minScore:82,
    minConfidence:80,
    minBuyPressure:1.5,
    decisionFreshnessSec:30,
    requireFreshHolderSnapshot:true,
    requireWebsiteOrX:true
  },
  balanced: {
    minScore:72,
    minConfidence:70,
    minBuyPressure:1.2,
    decisionFreshnessSec:60,
    requireFreshHolderSnapshot:true,
    requireWebsiteOrX:false
  },
  aggressive: {
    minScore:65,
    minConfidence:65,
    minBuyPressure:1.1,
    decisionFreshnessSec:90,
    requireFreshHolderSnapshot:true,
    requireWebsiteOrX:false
  }
};

assert.deepEqual(PROFILE_PRESETS, expected);

for (const [name, preset] of Object.entries(expected)) {
  assert.deepEqual(
    Object.keys(preset).sort(),
    [...LOGIC_PROFILE_KEYS].sort(),
    `${name} must contain ONLY the approved Logic fields`
  );

  assert.deepEqual(profilePreset(name), preset);
  assert.deepEqual(profilePreset(name.toUpperCase()), preset);

  const base = defaultSettings();
  const checked = validateSettings({...base, profile:name, ...preset});
  assert.equal(checked.ok, true, `${name} preset must validate`);

  for (const [key, value] of Object.entries(preset)) {
    assert.equal(checked.settings[key], value, `${name}.${key}`);
  }

  // Explicitly prove that applying a profile cannot mutate any other setting.
  for (const [key, value] of Object.entries(base)) {
    if (key === 'profile' || LOGIC_PROFILE_KEYS.includes(key)) continue;
    assert.deepEqual(
      checked.settings[key],
      value,
      `${name} illegally changed non-profile setting: ${key}`
    );
  }
}

assert.equal(profilePreset('unknown'), null);

console.log('profile presets logic-only ok');
