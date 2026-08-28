#!/usr/bin/env bash
set -euo pipefail

ROOT="${HOME}/workspace"
APP="$ROOT/memeflow-app"
BRANCH_EXPECTED="memeflow-logo-sync"

SYSTEM="$APP/system.js"
SETTINGS="$APP/src/settings.mjs"
INDEX="$APP/index.html"
TEST="$APP/tests/profile-presets.mjs"

EXPECTED_SYSTEM_BLOB="1d17b5c7b041905853c54098659b7cd6f2f53860"
EXPECTED_SETTINGS_BLOB="390a0735c337209d44db0a3e74b009d5a74bd579"
EXPECTED_INDEX_BLOB="87fc74830c1de172f3ca1d56049afdef31be84a4"
EXPECTED_TEST_BLOB="eed01d77caeb182569768199e34715a932899e6f"

cd "$ROOT"

branch="$(git branch --show-current)"
if [[ "$branch" != "$BRANCH_EXPECTED" ]]; then
  echo "ERROR: current branch is '$branch'. Expected '$BRANCH_EXPECTED'."
  exit 1
fi

# Runtime state and unrelated design work may be dirty. Refuse only if one of
# the exact files owned by this patch already has local edits.
if ! git diff --quiet -- "$SYSTEM" "$SETTINGS" "$INDEX" "$TEST"; then
  echo "ERROR: one of the profile-owned files has local edits."
  echo "Aborting without changing anything."
  exit 1
fi

check_blob() {
  local rel="${1#$ROOT/}"
  local expected="$2"
  local actual
  actual="$(git rev-parse "HEAD:$rel")"
  if [[ "$actual" != "$expected" ]]; then
    echo "ERROR: unexpected revision for $rel"
    echo "Actual:   $actual"
    echo "Expected: $expected"
    exit 1
  fi
}

check_blob "$SYSTEM"   "$EXPECTED_SYSTEM_BLOB"
check_blob "$SETTINGS" "$EXPECTED_SETTINGS_BLOB"
check_blob "$INDEX"    "$EXPECTED_INDEX_BLOB"
check_blob "$TEST"     "$EXPECTED_TEST_BLOB"

rollback() {
  echo
  echo "ROLLBACK: restoring Logic-profile files..."
  git restore --source=HEAD -- "$SYSTEM" "$SETTINGS" "$INDEX" "$TEST" || true
}
trap rollback ERR

echo "[1/8] Restricting server presets to Logic-only settings..."

python3 - <<'PY'
from pathlib import Path

p = Path.home() / "workspace/memeflow-app/src/settings.mjs"
text = p.read_text()

old = """export const PROFILE_PRESETS=Object.freeze({
 conservative:Object.freeze({minScore:82,minConfidence:70,minBuyPressure:1.5,minHolders:60,maxTop10Pct:20,maxDeveloperPct:10,requireFreshHolderSnapshot:true}),
 balanced:Object.freeze({minScore:72,minConfidence:70,minBuyPressure:1.2,minHolders:30,maxTop10Pct:25,maxDeveloperPct:20,requireFreshHolderSnapshot:true}),
 aggressive:Object.freeze({minScore:65,minConfidence:70,minBuyPressure:1.1,minHolders:20,maxTop10Pct:30,maxDeveloperPct:25,requireFreshHolderSnapshot:true})
});
"""

new = """export const PROFILE_PRESETS=Object.freeze({
 conservative:Object.freeze({
  minScore:82,
  minConfidence:80,
  minBuyPressure:1.5,
  decisionFreshnessSec:30,
  requireFreshHolderSnapshot:true,
  requireWebsiteOrX:true
 }),
 balanced:Object.freeze({
  minScore:72,
  minConfidence:70,
  minBuyPressure:1.2,
  decisionFreshnessSec:60,
  requireFreshHolderSnapshot:true,
  requireWebsiteOrX:false
 }),
 aggressive:Object.freeze({
  minScore:65,
  minConfidence:65,
  minBuyPressure:1.1,
  decisionFreshnessSec:90,
  requireFreshHolderSnapshot:true,
  requireWebsiteOrX:false
 })
});
"""

if text.count(old) != 1:
    raise SystemExit(f"ERROR: expected one PROFILE_PRESETS block, found {text.count(old)}")

p.write_text(text.replace(old, new, 1))
PY

echo "[2/8] Wiring the ACTIVE System settings dialog to presets..."

python3 - <<'PY'
from pathlib import Path

p = Path.home() / "workspace/memeflow-app/system.js"
text = p.read_text()

def once(old, new, label):
    global text
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"ERROR: {label}: expected one anchor, found {count}")
    text = text.replace(old, new, 1)

once(
"""  capabilities: null,
  killSwitchActive: false,
""",
"""  capabilities: null,
  profilePresets: {},
  killSwitchActive: false,
""",
"MF293 profilePresets state"
)

groups_end = """  ]]
];

function mf293Clone(value) {
"""
logic_guard = """  ]]
];

/*
 * Strategy profiles are deliberately scoped to the visible Logic group only.
 * Nothing outside this whitelist may be changed by Conservative / Balanced /
 * Aggressive, even if a future server response contains extra preset keys.
 */
const MF293_PROFILE_LOGIC_KEYS = Object.freeze([
  'minScore',
  'minConfidence',
  'minBuyPressure',
  'decisionFreshnessSec',
  'requireFreshHolderSnapshot',
  'requireWebsiteOrX'
]);

function mf293Clone(value) {
"""
once(groups_end, logic_guard, "profile Logic whitelist")

build_anchor = """function mf293Build() {
"""
profile_fn = """function mf293ApplyProfilePreset(profile) {
  const key = String(profile || '').trim().toLowerCase();
  const preset = MF293.profilePresets?.[key];

  if (!preset || typeof preset !== 'object') {
    mf293Error(`Profile preset is unavailable: ${key || 'unknown'}`);
    return false;
  }

  mf293ClearError();

  for (const settingKey of MF293_PROFILE_LOGIC_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(preset, settingKey)) continue;

    const input = document.querySelector(`[data-setting-key="${settingKey}"]`);
    if (!input) continue;

    const value = preset[settingKey];

    if (input.dataset.settingKind === 'boolean') {
      input.checked = Boolean(value);
    } else {
      input.value = value === null || value === undefined ? '' : String(value);
    }
  }

  MF293.dirty = true;
  mf293Status(`${key.charAt(0).toUpperCase()}${key.slice(1)} · Unsaved`, 'dirty');
  return true;
}

function mf293Build() {
"""
once(build_anchor, profile_fn, "profile application function")

event_anchor = """  document.getElementById('mf293DiscoverySource')?.addEventListener('change', mf293SetDiscoverySource);
  backdrop.addEventListener('click', event => {
"""
event_new = """  document.getElementById('mf293DiscoverySource')?.addEventListener('change', mf293SetDiscoverySource);

  document.querySelector('[data-setting-key="profile"]')?.addEventListener('change', event => {
    mf293ApplyProfilePreset(event.currentTarget?.value);
  });

  backdrop.addEventListener('click', event => {
"""
once(event_anchor, event_new, "profile select listener")

load_anchor = """    MF293.settings = mf293Clone(payload.settings || {});
    MF293.version = payload.version ?? 1;
    MF293.capabilities = payload.capabilities || {};
"""
load_new = """    MF293.settings = mf293Clone(payload.settings || {});
    MF293.version = payload.version ?? 1;
    MF293.capabilities = payload.capabilities || {};
    MF293.profilePresets = payload.profilePresets || {};
"""
once(load_anchor, load_new, "profile presets load")

p.write_text(text)
PY

echo "[3/8] Removing the old preset behavior from the OTHER settings UI..."

python3 - <<'PY'
from pathlib import Path

p = Path.home() / "workspace/memeflow-app/index.html"
text = p.read_text()

def once(old, new, label):
    global text
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"ERROR: {label}: expected one anchor, found {count}")
    text = text.replace(old, new, 1)

once(
""" const controls=[...form.querySelectorAll('input,select,button')]; let loaded=null, capabilities={}, profilePresets={};
 let walletGate={connected:false,verified:false}, billingGate={};
""",
""" const controls=[...form.querySelectorAll('input,select,button')]; let loaded=null, capabilities={};
 let walletGate={connected:false,verified:false}, billingGate={};
""",
"remove legacy profilePresets state"
)

old_apply = """ const apply=s=>{loaded=s||null;const view=serverToView(s);ids.forEach(id=>{const el=$('#'+id);if(!el)return;const v=view?.[id];if(el.type==='checkbox')el.checked=Boolean(v);else el.value=v??''});if(view?.operatingMode&&form.elements.operatingMode)form.elements.operatingMode.value=view.operatingMode;if(view?.strategyProfile&&form.elements.strategyProfile)form.elements.strategyProfile.value=view.strategyProfile;form.querySelectorAll('[data-platform]').forEach(x=>x.checked=(s?.launchPlatforms||[]).includes(x.dataset.platform));render(false)};
 const applySelectedProfilePreset=profile=>{
   const key=String(profile||'').trim().toLowerCase(), preset=profilePresets?.[key];
   if(!preset||typeof preset!=='object')return false;
   const view=serverToView(preset);
   Object.entries(view).forEach(([id,value])=>{const el=$('#'+id);if(!el)return;if(el.type==='checkbox')el.checked=Boolean(value);else el.value=value??''});
   $('#settingsSaveState').textContent=`${profile} preset loaded · review values, then Save settings`;
   $('#settingsSaveState').style.color='var(--yellow)';
   return true;
 };
 function validate(o){
"""

new_apply = """ const apply=s=>{loaded=s||null;const view=serverToView(s);ids.forEach(id=>{const el=$('#'+id);if(!el)return;const v=view?.[id];if(el.type==='checkbox')el.checked=Boolean(v);else el.value=v??''});if(view?.operatingMode&&form.elements.operatingMode)form.elements.operatingMode.value=view.operatingMode;if(view?.strategyProfile&&form.elements.strategyProfile)form.elements.strategyProfile.value=view.strategyProfile;form.querySelectorAll('[data-platform]').forEach(x=>x.checked=(s?.launchPlatforms||[]).includes(x.dataset.platform));render(false)};
 function validate(o){
"""
once(old_apply, new_apply, "remove legacy applySelectedProfilePreset")

once(
"capabilities=d.capabilities||{};profilePresets=d.profilePresets||{};apply(d.settings||{});",
"capabilities=d.capabilities||{};apply(d.settings||{});",
"remove legacy preset load"
)

once(
""" form.addEventListener('input',()=>render(true));
 form.addEventListener('change',e=>{if(e.target?.name==='strategyProfile')applySelectedProfilePreset(e.target.value);render(true)});
""",
""" form.addEventListener('input',()=>render(true));form.addEventListener('change',()=>render(true));
""",
"remove legacy preset change listener"
)

# Restore the old interface copy too, so it no longer claims to own the preset.
copy_reverts = [
  (
    '<b>Conservative</b><span>Stricter token filters · does not change capital or exits.</span>',
    '<b>Conservative</b><span>Stricter evidence and fewer entries.</span>'
  ),
  (
    '<b>Balanced</b><span>Current balanced token filters · does not change capital or exits.</span>',
    '<b>Balanced</b><span>Selective momentum with protected risk.</span>'
  ),
  (
    '<b>Aggressive</b><span>Wider token filters · does not change capital or exits.</span>',
    '<b>Aggressive</b><span>Wider opportunity set within owner limits.</span>'
  )
]

for old, new in copy_reverts:
    once(old, new, "restore legacy profile copy")

p.write_text(text)
PY

echo "[4/8] Strengthening the profile regression test..."

cat > "$TEST" <<'EOF'
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
EOF

echo "[5/8] Static safety checks..."

node --check "$SYSTEM"
node --check "$SETTINGS"
node --check "$TEST"

node - <<'NODE'
const fs = require('fs');

const system = fs.readFileSync('memeflow-app/system.js', 'utf8');
const index = fs.readFileSync('memeflow-app/index.html', 'utf8');
const settings = fs.readFileSync('memeflow-app/src/settings.mjs', 'utf8');

const requiredSystem = [
  'MF293_PROFILE_LOGIC_KEYS',
  "'minScore'",
  "'minConfidence'",
  "'minBuyPressure'",
  "'decisionFreshnessSec'",
  "'requireFreshHolderSnapshot'",
  "'requireWebsiteOrX'",
  'mf293ApplyProfilePreset',
  'MF293.profilePresets = payload.profilePresets || {}'
];

for (const needle of requiredSystem) {
  if (!system.includes(needle)) throw new Error(`system.js missing: ${needle}`);
}

const forbiddenPresetKeys = [
  'minHolders',
  'maxTop10Pct',
  'maxDeveloperPct',
  'operatingMode',
  'tradingEnvironment',
  'ownerApproval',
  'shadowValidation',
  'changeLog',
  'tradingCapital',
  'positionSize',
  'hardStopPct',
  'tp1Pct'
];

const presetBlock = settings.match(
  /export const PROFILE_PRESETS=Object\.freeze\(\{([\s\S]*?)\n\}\);/
)?.[1] || '';

for (const key of forbiddenPresetKeys) {
  if (presetBlock.includes(key)) {
    throw new Error(`PROFILE_PRESETS illegally contains non-Logic key: ${key}`);
  }
}

if (index.includes('applySelectedProfilePreset')) {
  throw new Error('legacy index.html still owns profile preset behavior');
}

if (index.includes('profilePresets=d.profilePresets')) {
  throw new Error('legacy index.html still loads profile presets');
}

console.log('logic-only profile static checks ok');
NODE

git diff --check -- "$SYSTEM" "$SETTINGS" "$INDEX" "$TEST"

echo "[6/8] Running the full project test suite..."
(
  cd "$APP"
  npm test
)

echo "[7/8] Verifying exact change set..."

echo "Only these files are allowed in this commit:"
git diff --name-only -- "$SYSTEM" "$SETTINGS" "$INDEX" "$TEST"
git diff --stat -- "$SYSTEM" "$SETTINGS" "$INDEX" "$TEST"

git add -- \
  memeflow-app/system.js \
  memeflow-app/src/settings.mjs \
  memeflow-app/index.html \
  memeflow-app/tests/profile-presets.mjs

git diff --cached --check

# Final staged safety check: no unrelated file can enter this commit.
unexpected="$(
  git diff --cached --name-only |
  grep -vE '^(memeflow-app/system\.js|memeflow-app/src/settings\.mjs|memeflow-app/index\.html|memeflow-app/tests/profile-presets\.mjs)$' || true
)"
if [[ -n "$unexpected" ]]; then
  echo "ERROR: unexpected staged files:"
  echo "$unexpected"
  exit 1
fi

echo "[8/8] Committing and pushing..."
git commit -m "fix: bind strategy profiles to Logic settings only"
git push origin "$BRANCH_EXPECTED"

trap - ERR

echo
echo "DONE: Logic-only strategy profiles tested, committed and pushed."
echo
echo "Conservative:"
echo "  Score 82 | Confidence 80 | Buy pressure 1.50"
echo "  Freshness 30s | Fresh holders ON | Website/X ON"
echo
echo "Balanced:"
echo "  Score 72 | Confidence 70 | Buy pressure 1.20"
echo "  Freshness 60s | Fresh holders ON | Website/X OFF"
echo
echo "Aggressive:"
echo "  Score 65 | Confidence 65 | Buy pressure 1.10"
echo "  Freshness 90s | Fresh holders ON | Website/X OFF"
echo
echo "GUARANTEE: profiles cannot change Trading, Entry filters, Risk & exits,"
echo "Operating mode, Trading environment, Owner approval, Shadow validation,"
echo "Settings change log, capital, position size, SL/TP or session limits."
