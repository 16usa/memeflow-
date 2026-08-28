#!/usr/bin/env bash
set -euo pipefail

ROOT="${HOME}/workspace"
APP="$ROOT/memeflow-app"
BRANCH_EXPECTED="memeflow-logo-sync"

INDEX="$APP/index.html"
SETTINGS="$APP/src/settings.mjs"
SERVER="$APP/app-server.mjs"
PKG="$APP/package.json"
TEST="$APP/tests/profile-presets.mjs"

EXPECTED_INDEX_BLOB="6f29fe51ca5e2534c7eb5db8af56c13217c14ae2"
EXPECTED_SETTINGS_BLOB="a15301d7d172525f294ba19676a773124821fba3"
EXPECTED_SERVER_BLOB="2b24c7bc2a950320faf96de9e15a744fdc67e144"
EXPECTED_PKG_BLOB="212124305d6918baf801ab1e5c3af1eb56ce38ad"

cd "$ROOT"

branch="$(git branch --show-current)"
[[ "$branch" == "$BRANCH_EXPECTED" ]] || { echo "ERROR: current branch is '$branch'. Expected '$BRANCH_EXPECTED'."; exit 1; }

if ! git diff --quiet -- "$INDEX" "$SETTINGS" "$SERVER" "$PKG"; then
  echo "ERROR: one of the profile-owned files has local edits. Aborting."
  exit 1
fi

check_blob() {
  local rel="${1#$ROOT/}"
  local actual
  actual="$(git rev-parse "HEAD:$rel")"
  [[ "$actual" == "$2" ]] || { echo "ERROR: unexpected revision for $rel: $actual"; echo "Expected: $2"; exit 1; }
}

check_blob "$INDEX" "$EXPECTED_INDEX_BLOB"
check_blob "$SETTINGS" "$EXPECTED_SETTINGS_BLOB"
check_blob "$SERVER" "$EXPECTED_SERVER_BLOB"
check_blob "$PKG" "$EXPECTED_PKG_BLOB"

if git cat-file -e "HEAD:memeflow-app/tests/profile-presets.mjs" 2>/dev/null; then
  echo "ERROR: tests/profile-presets.mjs already exists in HEAD."
  exit 1
fi

rollback() {
  echo
  echo "ROLLBACK: restoring strategy-profile files..."
  git restore --source=HEAD -- "$INDEX" "$SETTINGS" "$SERVER" "$PKG" || true
  rm -f "$TEST"
}
trap rollback ERR

echo "[1/8] Defining canonical profile presets..."
python3 - <<'PY'
from pathlib import Path
p = Path.home() / "workspace/memeflow-app/src/settings.mjs"
text = p.read_text()
anchor = """export function defaultSettings(){return {
 operatingMode:'observe',tradingEnvironment:'paper',profile:'balanced',
"""
insert = """export const PROFILE_PRESETS=Object.freeze({
 conservative:Object.freeze({minScore:82,minConfidence:70,minBuyPressure:1.5,minHolders:60,maxTop10Pct:20,maxDeveloperPct:10,requireFreshHolderSnapshot:true}),
 balanced:Object.freeze({minScore:72,minConfidence:70,minBuyPressure:1.2,minHolders:30,maxTop10Pct:25,maxDeveloperPct:20,requireFreshHolderSnapshot:true}),
 aggressive:Object.freeze({minScore:65,minConfidence:70,minBuyPressure:1.1,minHolders:20,maxTop10Pct:30,maxDeveloperPct:25,requireFreshHolderSnapshot:true})
});
export function profilePreset(profile){
 const key=String(profile||'').trim().toLowerCase();
 const preset=PROFILE_PRESETS[key];
 return preset?{...preset}:null;
}

"""
if text.count(anchor) != 1:
    raise SystemExit(f"ERROR: settings anchor count={text.count(anchor)}")
p.write_text(text.replace(anchor, insert + anchor, 1))
PY

echo "[2/8] Exposing presets through /api/settings..."
python3 - <<'PY'
from pathlib import Path
p = Path.home() / "workspace/memeflow-app/app-server.mjs"
text = p.read_text()
old = "import {validateSettings} from './src/settings.mjs';"
new = "import {validateSettings,PROFILE_PRESETS} from './src/settings.mjs';"
if text.count(old) != 1: raise SystemExit("ERROR: settings import anchor")
text = text.replace(old,new,1)
old = "capabilities:{liveAutomation:hasLiveEntitlement(u),paperAutomation:true,discoveryPlatforms:['pump'],adaptiveProfile:false}})"
new = "capabilities:{liveAutomation:hasLiveEntitlement(u),paperAutomation:true,discoveryPlatforms:['pump'],adaptiveProfile:false},profilePresets:PROFILE_PRESETS})"
if text.count(old) != 1: raise SystemExit("ERROR: settings GET anchor")
p.write_text(text.replace(old,new,1))
PY

echo "[3/8] Wiring profile selection to actual token filters..."
python3 - <<'PY'
from pathlib import Path
p = Path.home() / "workspace/memeflow-app/index.html"
text = p.read_text()

repls = [
(""" const controls=[...form.querySelectorAll('input,select,button')]; let loaded=null, capabilities={};
 let walletGate={connected:false,verified:false}, billingGate={};
""",
""" const controls=[...form.querySelectorAll('input,select,button')]; let loaded=null, capabilities={}, profilePresets={};
 let walletGate={connected:false,verified:false}, billingGate={};
"""),
(""" const apply=s=>{loaded=s||null;const view=serverToView(s);ids.forEach(id=>{const el=$('#'+id);if(!el)return;const v=view?.[id];if(el.type==='checkbox')el.checked=Boolean(v);else el.value=v??''});if(view?.operatingMode&&form.elements.operatingMode)form.elements.operatingMode.value=view.operatingMode;if(view?.strategyProfile&&form.elements.strategyProfile)form.elements.strategyProfile.value=view.strategyProfile;form.querySelectorAll('[data-platform]').forEach(x=>x.checked=(s?.launchPlatforms||[]).includes(x.dataset.platform));render(false)};
 function validate(o){
""",
""" const apply=s=>{loaded=s||null;const view=serverToView(s);ids.forEach(id=>{const el=$('#'+id);if(!el)return;const v=view?.[id];if(el.type==='checkbox')el.checked=Boolean(v);else el.value=v??''});if(view?.operatingMode&&form.elements.operatingMode)form.elements.operatingMode.value=view.operatingMode;if(view?.strategyProfile&&form.elements.strategyProfile)form.elements.strategyProfile.value=view.strategyProfile;form.querySelectorAll('[data-platform]').forEach(x=>x.checked=(s?.launchPlatforms||[]).includes(x.dataset.platform));render(false)};
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
"""),
("capabilities=d.capabilities||{};apply(d.settings||{});",
 "capabilities=d.capabilities||{};profilePresets=d.profilePresets||{};apply(d.settings||{});"),
(""" form.addEventListener('input',()=>render(true));form.addEventListener('change',()=>render(true));
""",
""" form.addEventListener('input',()=>render(true));
 form.addEventListener('change',e=>{if(e.target?.name==='strategyProfile')applySelectedProfilePreset(e.target.value);render(true)});
"""),
('<b>Conservative</b><span>Stricter evidence and fewer entries.</span>',
 '<b>Conservative</b><span>Stricter token filters · does not change capital or exits.</span>'),
('<b>Balanced</b><span>Selective momentum with protected risk.</span>',
 '<b>Balanced</b><span>Current balanced token filters · does not change capital or exits.</span>'),
('<b>Aggressive</b><span>Wider opportunity set within owner limits.</span>',
 '<b>Aggressive</b><span>Wider token filters · does not change capital or exits.</span>')
]
for old,new in repls:
    if text.count(old) != 1:
        raise SystemExit(f"ERROR: index anchor count={text.count(old)} for {old[:60]!r}")
    text=text.replace(old,new,1)
p.write_text(text)
PY

echo "[4/8] Adding profile regression tests..."
cat > "$TEST" <<'EOF'
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
EOF

echo "[5/8] Registering regression test..."
python3 - <<'PY'
import json
from pathlib import Path
p=Path.home()/"workspace/memeflow-app/package.json"
d=json.loads(p.read_text())
old="node tests/settings-gate.mjs && node tests/paper-engine-auto.mjs && node tests/integration.mjs && node tests/billing-cycle.mjs && node tests/owner-live.mjs"
new="node tests/settings-gate.mjs && node tests/profile-presets.mjs && node tests/paper-engine-auto.mjs && node tests/integration.mjs && node tests/billing-cycle.mjs && node tests/owner-live.mjs"
if d.get("scripts",{}).get("test")!=old: raise SystemExit("ERROR: unexpected npm test command")
d["scripts"]["test"]=new
p.write_text(json.dumps(d,indent=2)+"\n")
PY

echo "[6/8] Static/syntax checks..."
node --check "$SETTINGS"
node --check "$SERVER"
node --check "$TEST"
node - <<'NODE'
const fs=require('fs');
const html=fs.readFileSync('memeflow-app/index.html','utf8');
const server=fs.readFileSync('memeflow-app/app-server.mjs','utf8');
const checks=[
 ['server sends presets',server.includes('profilePresets:PROFILE_PRESETS')],
 ['UI receives presets',html.includes('profilePresets=d.profilePresets||{}')],
 ['UI applies selected preset',html.includes('applySelectedProfilePreset(e.target.value)')],
 ['save-before-commit message',html.includes('preset loaded · review values, then Save settings')],
 ['safe Conservative copy',html.includes('Stricter token filters · does not change capital or exits.')],
 ['safe Balanced copy',html.includes('Current balanced token filters · does not change capital or exits.')],
 ['safe Aggressive copy',html.includes('Wider token filters · does not change capital or exits.')]
];
for(const [name,ok] of checks){if(!ok)throw Error(name);console.log('ok:',name)}
console.log('profile UI wiring ok');
NODE
git diff --check -- "$INDEX" "$SETTINGS" "$SERVER" "$PKG" "$TEST"

echo "[7/8] Running full project tests..."
(cd "$APP" && npm test)

echo "[8/8] Verifying exact change set, committing and pushing..."
git diff --name-only -- "$INDEX" "$SETTINGS" "$SERVER" "$PKG" "$TEST"
git diff --stat -- "$INDEX" "$SETTINGS" "$SERVER" "$PKG" "$TEST"

git add -- \
  memeflow-app/index.html \
  memeflow-app/src/settings.mjs \
  memeflow-app/app-server.mjs \
  memeflow-app/package.json \
  memeflow-app/tests/profile-presets.mjs

git diff --cached --check
git commit -m "feat: make strategy profiles apply real token filters"
git push origin "$BRANCH_EXPECTED"

trap - ERR

echo
echo "DONE: real strategy profiles tested, committed and pushed."
echo "Conservative: Score 82 / Confidence 70 / BP 1.5 / Holders 60 / Top10 20 / Dev 10"
echo "Balanced:     Score 72 / Confidence 70 / BP 1.2 / Holders 30 / Top10 25 / Dev 20"
echo "Aggressive:   Score 65 / Confidence 70 / BP 1.1 / Holders 20 / Top10 30 / Dev 25"
echo "Fresh holders required in all three."
echo "Capital, position size, SL/TP and session limits are untouched."
echo "A profile only fills fields; nothing changes on the server until Save settings."
