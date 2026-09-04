#!/usr/bin/env bash
set -euo pipefail

ROOT="${ROOT:-$HOME/workspace}"
APP="$ROOT/memeflow-app"
BRANCH="chart-debug-20260829-161234"
EXPECTED_HEAD="79f9a5c2137fb3219eda401230d2acaa75e89c24"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="$ROOT/.memeflow-backups/v24-1-probation-telemetry-$STAMP"

cd "$ROOT"

echo "=== V24.1 PRECHECK ==="
test "$(git branch --show-current)" = "$BRANCH" || { echo "ERROR: wrong branch"; exit 1; }
ACTUAL_HEAD="$(git rev-parse HEAD)"
test "$ACTUAL_HEAD" = "$EXPECTED_HEAD" || {
  echo "ERROR: HEAD moved."
  echo "Expected: $EXPECTED_HEAD"
  echo "Actual:   $ACTUAL_HEAD"
  exit 1
}
# V24.1 only refuses changes that can conflict with files it is about to edit.
# Safe untracked installer scripts and runtime JSONL data are intentionally allowed.
TARGETED_TRACKED=(
  "memeflow-app/app-server.mjs"
  "memeflow-app/package.json"
  "memeflow-app/src/controlled-policy-bridge-v24_0.mjs"
)

for f in "${TARGETED_TRACKED[@]}"; do
  if ! git diff --quiet -- "$f"; then
    echo "ERROR: tracked local changes in $f"
    git diff -- "$f"
    exit 1
  fi

  if ! git diff --cached --quiet -- "$f"; then
    echo "ERROR: staged local changes in $f"
    git diff --cached -- "$f"
    exit 1
  fi
done

NEW_FILES=(
  "memeflow-app/src/v24-probation-telemetry-v24_1.mjs"
  "memeflow-app/tests/v24-probation-telemetry-v24_1.mjs"
)

for f in "${NEW_FILES[@]}"; do
  if [[ -e "$f" ]]; then
    echo "ERROR: V24.1 target already exists: $f"
    exit 1
  fi
done

echo "V24.1 PRECHECK_OK"
echo "Safe untracked files are allowed and remain untouched."

mkdir -p "$BACKUP"
cp "$APP/app-server.mjs" "$BACKUP/app-server.mjs"
cp "$APP/package.json" "$BACKUP/package.json"
cp "$APP/src/controlled-policy-bridge-v24_0.mjs" "$BACKUP/controlled-policy-bridge-v24_0.mjs"

rollback() {
  echo "=== V24.1 FAILED - RESTORING ==="
  cp "$BACKUP/app-server.mjs" "$APP/app-server.mjs"
  cp "$BACKUP/package.json" "$APP/package.json"
  rm -f "$APP/src/v24-probation-telemetry-v24_1.mjs"
  rm -f "$APP/tests/v24-probation-telemetry-v24_1.mjs"
  git reset --     memeflow-app/app-server.mjs     memeflow-app/package.json     memeflow-app/src/v24-probation-telemetry-v24_1.mjs     memeflow-app/tests/v24-probation-telemetry-v24_1.mjs     >/dev/null 2>&1 || true

  git checkout --     memeflow-app/app-server.mjs     memeflow-app/package.json     >/dev/null 2>&1 || true

  echo "ROLLBACK_COMPLETE; backup: $BACKUP"
}
trap rollback ERR

cat > "$APP/src/v24-probation-telemetry-v24_1.mjs" <<'EOF'
import fs from 'node:fs';
import path from 'node:path';

// MEMEFLOW_V24_PROBATION_TELEMETRY_V24_1
//
// READ ONLY. Measures the observed/hypothetical quality of V24.0 downgrade
// decisions against completed frozen 5m outcomes from V23.16.
//
// It NEVER changes Score/State/Settings/BUY/SELL/forecast and cannot execute.
// V22 + the already-installed V24.0 bridge remain the only runtime path.

const TARGET_HORIZON_MS=300_000;
const MATCH_WINDOW_MS=10*60_000;
const ACTIONS=new Set([
  'WOULD_DOWNGRADE_TO_WATCH',
  'DOWNGRADE_TO_WATCH'
]);

const finite=value=>{
  if(value===null||value===undefined||value==='')return null;
  const n=Number(value);
  return Number.isFinite(n)?n:null;
};

const round=(value,digits=2)=>{
  const n=finite(value);
  if(n===null)return null;
  const p=10**digits;
  return Math.round(n*p)/p;
};

function readJsonl(file,maxBytes=32*1024*1024){
  try{
    if(!file||!fs.existsSync(file))return [];
    const st=fs.statSync(file);
    if(!(st.size>0))return [];

    const bytes=Math.min(st.size,maxBytes);
    const fd=fs.openSync(file,'r');
    let text='';

    try{
      const buf=Buffer.allocUnsafe(bytes);
      fs.readSync(fd,buf,0,bytes,st.size-bytes);
      text=buf.toString('utf8');
    }finally{
      fs.closeSync(fd);
    }

    if(st.size>bytes){
      const nl=text.indexOf('\n');
      if(nl>=0)text=text.slice(nl+1);
    }

    return text
      .split('\n')
      .filter(Boolean)
      .map(line=>{
        try{return JSON.parse(line)}catch{return null}
      })
      .filter(Boolean);
  }catch{
    return [];
  }
}

function directionalClass(row={}){
  const c=String(
    row?.outcome?.classification||''
  ).toUpperCase();

  return ['POSITIVE','NEGATIVE','NEUTRAL'].includes(c)
    ? c
    : 'UNKNOWN';
}

export function createV24ProbationTelemetryV24_1({
  dataDir=null,
  bridgeStatusProvider=null,
  bridgeRecentProvider=null,
  outcomeRecentProvider=null
}={}){
  const bridgeFile=
    dataDir
      ? path.join(dataDir,'v24-policy-bridge-audit.jsonl')
      : null;

  const outcomeFile=
    dataDir
      ? path.join(dataDir,'shadow-outcome-review-v23-16.jsonl')
      : null;

  function bridgeRows(){
    const disk=readJsonl(bridgeFile);

    if(disk.length)return disk;

    try{
      return typeof bridgeRecentProvider==='function'
        ? bridgeRecentProvider({limit:200})
        : [];
    }catch{
      return [];
    }
  }

  function outcomeRows(){
    const disk=readJsonl(outcomeFile);

    if(disk.length)return disk;

    try{
      return typeof outcomeRecentProvider==='function'
        ? outcomeRecentProvider({
            limit:200,
            horizonMs:TARGET_HORIZON_MS
          })
        : [];
    }catch{
      return [];
    }
  }

  function matchOutcome(action,outcomes){
    const mint=String(action?.mint||'');
    const at=finite(action?.at);

    if(!mint||at===null)return null;

    let best=null;
    let bestDistance=Infinity;

    for(const row of outcomes){
      if(String(row?.mint||'')!==mint)continue;
      if(Number(row?.horizonMs)!==TARGET_HORIZON_MS)continue;

      const anchorAt=finite(row?.anchorAt);
      const observedAt=finite(row?.observedAt);

      if(anchorAt===null||observedAt===null)continue;
      if(observedAt<at)continue;

      // The bridge decision must belong to the same local frozen evidence
      // episode. This prevents a later same-mint outcome from being attached.
      const distance=Math.abs(at-anchorAt);
      if(distance>MATCH_WINDOW_MS)continue;

      if(distance<bestDistance){
        best=row;
        bestDistance=distance;
      }
    }

    return best;
  }

  function report({limit=100}={}){
    const safe=Math.max(1,Math.min(5000,Number(limit)||100));
    const allBridge=bridgeRows();
    const outcomes=outcomeRows();

    const interventions=allBridge
      .filter(row=>ACTIONS.has(String(row?.action||'').toUpperCase()))
      .slice(-safe);

    const matched=interventions.map(row=>({
      bridge:row,
      outcome:matchOutcome(row,outcomes)
    }));

    const resolved=matched.filter(x=>Boolean(x.outcome));
    const negatives=resolved.filter(
      x=>directionalClass(x.outcome)==='NEGATIVE'
    );
    const positives=resolved.filter(
      x=>directionalClass(x.outcome)==='POSITIVE'
    );
    const neutrals=resolved.filter(
      x=>directionalClass(x.outcome)==='NEUTRAL'
    );
    const directional=negatives.length+positives.length;

    let bridgeStatus=null;
    try{
      bridgeStatus=
        typeof bridgeStatusProvider==='function'
          ? bridgeStatusProvider()
          : null;
    }catch{}

    const buyReadySeen=
      finite(bridgeStatus?.buyReadySeen)??0;

    const triggered=interventions.length;
    const enforced=interventions.filter(
      row=>String(row?.action||'').toUpperCase()==='DOWNGRADE_TO_WATCH'
    ).length;
    const shadow=triggered-enforced;

    const rows=matched
      .slice()
      .reverse()
      .slice(0,100)
      .map(({bridge,outcome})=>({
        at:finite(bridge?.at),
        mint:bridge?.mint||null,
        mode:bridge?.mode||null,
        action:bridge?.action||null,
        candidateId:bridge?.candidateId||null,
        penaltyPct:finite(bridge?.penaltyPct),
        adjustedConfidencePct:
          finite(bridge?.adjustedConfidencePct),
        resolved:Boolean(outcome),
        outcomeClass:
          outcome?directionalClass(outcome):null,
        returnPct:
          finite(outcome?.outcome?.returnPct),
        maxFavorableExcursionPct:
          finite(outcome?.outcome?.maxFavorableExcursionPct),
        maxAdverseExcursionPct:
          finite(outcome?.outcome?.maxAdverseExcursionPct),
        observedAt:
          finite(outcome?.observedAt)
      }));

    const evidenceReady=
      directional>=50 &&
      negatives.length>=10 &&
      positives.length>=10;

    return {
      version:'MEMEFLOW_V24_PROBATION_TELEMETRY_V24_1',
      readOnly:true,
      authority:'DIAGNOSTIC_ONLY',
      targetHorizonMs:TARGET_HORIZON_MS,
      bridgeMode:bridgeStatus?.mode||'UNKNOWN',
      killSwitch:bridgeStatus?.killSwitch??null,

      sample:{
        buyReadySeen,
        interventions:triggered,
        shadowInterventions:shadow,
        enforcedInterventions:enforced,
        resolved:resolved.length,
        pending:matched.length-resolved.length,
        directional,
        negativeOutcomes:negatives.length,
        positiveOutcomes:positives.length,
        neutralOutcomes:neutrals.length
      },

      impact:{
        affectedRatePct:
          buyReadySeen>0
            ? round(triggered/buyReadySeen*100)
            : null,

        // Among resolved directional interventions, how often the guard
        // targeted a token whose 5m outcome was actually negative.
        blockedNegativePrecisionPct:
          directional>0
            ? round(negatives.length/directional*100)
            : null,

        // Good 5m outcomes that the guard would have suppressed.
        positiveOpportunityCostPct:
          directional>0
            ? round(positives.length/directional*100)
            : null,

        preventedNegativeCount:
          negatives.length,

        missedPositiveCount:
          positives.length
      },

      probation:{
        evidenceReady,
        minimumDirectional:50,
        minimumNegative:10,
        minimumPositive:10,
        verdict:
          evidenceReady
            ? 'EVIDENCE_READY_FOR_OWNER_REVIEW'
            : 'BUILDING_EVIDENCE',
        note:
          'Telemetry does not promote, enable, tune or apply V24 policy.'
      },

      safety:{
        scoreMutation:false,
        stateMutation:false,
        settingsMutation:false,
        buySellMutation:false,
        forecastMutation:false,
        automaticPromotion:false,
        applicationAllowed:false
      },

      recent:rows
    };
  }

  function status(){
    const r=report({limit:5000});
    return {
      version:r.version,
      readOnly:true,
      bridgeFile,
      outcomeFile,
      ...r.sample,
      ...r.impact,
      probation:r.probation
    };
  }

  return {
    report,
    status
  };
}
EOF

cat > "$APP/tests/v24-probation-telemetry-v24_1.mjs" <<'EOF'
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  createV24ProbationTelemetryV24_1
} from '../src/v24-probation-telemetry-v24_1.mjs';

const tmp=fs.mkdtempSync(
  path.join(os.tmpdir(),'mf-v24-1-')
);

const bridgeFile=
  path.join(tmp,'v24-policy-bridge-audit.jsonl');
const outcomeFile=
  path.join(tmp,'shadow-outcome-review-v23-16.jsonl');

const base=1_800_000_000_000;

const bridges=[];
const outcomes=[];

for(let i=0;i<60;i++){
  const mint=`MintV241_${i}`;
  const at=base+i*1_000_000;

  bridges.push({
    at,
    mint,
    mode:i<30?'SHADOW':'ENFORCE',
    action:
      i<30
        ? 'WOULD_DOWNGRADE_TO_WATCH'
        : 'DOWNGRADE_TO_WATCH',
    candidateId:'candidate-v24-1',
    penaltyPct:20,
    adjustedConfidencePct:44
  });

  const negative=i<40;

  outcomes.push({
    mint,
    anchorAt:at-1_000,
    observedAt:at+300_000,
    horizonMs:300_000,
    outcome:{
      classification:
        negative?'NEGATIVE':'POSITIVE',
      returnPct:
        negative?-25:30,
      maxFavorableExcursionPct:
        negative?5:45,
      maxAdverseExcursionPct:
        negative?-30:-5
    }
  });
}

fs.writeFileSync(
  bridgeFile,
  bridges.map(JSON.stringify).join('\n')+'\n'
);
fs.writeFileSync(
  outcomeFile,
  outcomes.map(JSON.stringify).join('\n')+'\n'
);

const telemetry=createV24ProbationTelemetryV24_1({
  dataDir:tmp,
  bridgeStatusProvider:()=>({
    mode:'ENFORCE',
    killSwitch:false,
    buyReadySeen:120
  })
});

const report=telemetry.report({limit:100});

assert.equal(report.readOnly,true);
assert.equal(report.authority,'DIAGNOSTIC_ONLY');
assert.equal(report.sample.interventions,60);
assert.equal(report.sample.shadowInterventions,30);
assert.equal(report.sample.enforcedInterventions,30);
assert.equal(report.sample.resolved,60);
assert.equal(report.sample.directional,60);
assert.equal(report.sample.negativeOutcomes,40);
assert.equal(report.sample.positiveOutcomes,20);
assert.equal(report.impact.affectedRatePct,50);
assert.equal(report.impact.blockedNegativePrecisionPct,66.67);
assert.equal(report.impact.positiveOpportunityCostPct,33.33);
assert.equal(report.impact.preventedNegativeCount,40);
assert.equal(report.impact.missedPositiveCount,20);
assert.equal(report.probation.evidenceReady,true);
assert.equal(
  report.probation.verdict,
  'EVIDENCE_READY_FOR_OWNER_REVIEW'
);
assert.equal(report.safety.stateMutation,false);
assert.equal(report.safety.automaticPromotion,false);
assert.equal(report.safety.applicationAllowed,false);

// A later same-mint episode outside the match window must not be attributed.
fs.appendFileSync(
  bridgeFile,
  JSON.stringify({
    at:base+99_000_000,
    mint:'NoMatchingEpisode',
    mode:'SHADOW',
    action:'WOULD_DOWNGRADE_TO_WATCH'
  })+'\n'
);

fs.appendFileSync(
  outcomeFile,
  JSON.stringify({
    mint:'NoMatchingEpisode',
    anchorAt:base,
    observedAt:base+100_000_000,
    horizonMs:300_000,
    outcome:{classification:'NEGATIVE'}
  })+'\n'
);

const report2=telemetry.report({limit:100});
assert.equal(report2.sample.interventions,61);
assert.equal(report2.sample.resolved,60);
assert.equal(report2.sample.pending,1);

console.log('v24 probation telemetry v24.1 ok');
EOF

python3 - <<'PY'
from pathlib import Path
import json

app=Path("memeflow-app/app-server.mjs")
text=app.read_text()

import_anchor="import {createV24ControlledPolicyBridgeV24_0} from './src/controlled-policy-bridge-v24_0.mjs'; // MEMEFLOW_V24_CONTROLLED_POLICY_BRIDGE_V24_0\n"
import_line=import_anchor+"import {createV24ProbationTelemetryV24_1} from './src/v24-probation-telemetry-v24_1.mjs'; // MEMEFLOW_V24_PROBATION_TELEMETRY_V24_1\n"
if import_anchor not in text:
    raise SystemExit("V24.1 import anchor missing")
text=text.replace(import_anchor,import_line,1)

bridge_anchor="""function __mfApplyV24PolicyBridge(uid,token,decision){
  return v24ControlledPolicyBridge.apply({
    uid,
    token,
    decision
  });
}
"""
telemetry_init=bridge_anchor+"""const v24ProbationTelemetry=createV24ProbationTelemetryV24_1({
  dataDir,
  bridgeStatusProvider:
    ()=>v24ControlledPolicyBridge.status(),
  bridgeRecentProvider:
    options=>v24ControlledPolicyBridge.listRecent(options),
  outcomeRecentProvider:
    options=>tokenIntelligenceShadowV23.listOutcomeReviews(options)
}); // V24.1 read-only impact telemetry; no runtime authority
"""
if bridge_anchor not in text:
    raise SystemExit("V24.1 bridge init anchor missing")
text=text.replace(bridge_anchor,telemetry_init,1)

route_anchor="""/* MEMEFLOW_PUBLIC_AGENT_ENTITY_V2_ROUTES */
"""
route="""/* MEMEFLOW_V24_PROBATION_TELEMETRY_MONITOR_V24_1
 * Owner-only, read-only measured impact of V24.0 against completed 5m outcomes.
 * No enable/apply/tune endpoint exists here.
 */
 if(
   url.pathname==='/api/owner/intelligence/v24-probation' &&
   req.method==='GET'
 ){
   if(!u)return json(res,401,{error:'AUTH_REQUIRED'});
   if(u.isOwner!==true)return json(res,403,{error:'OWNER_REQUIRED'});

   const limit=Math.max(
     1,
     Math.min(
       5000,
       Number(url.searchParams.get('limit')||500)
     )
   );

   return json(res,200,{
     ok:true,
     owner:true,
     readOnly:true,
     telemetry:
       v24ProbationTelemetry.report({limit})
   });
 }

/* MEMEFLOW_PUBLIC_AGENT_ENTITY_V2_ROUTES */
"""
if route_anchor not in text:
    raise SystemExit("V24.1 route anchor missing")
text=text.replace(route_anchor,route,1)
app.write_text(text)

pkg=Path("memeflow-app/package.json")
data=json.loads(pkg.read_text())
needle="node tests/controlled-policy-bridge-v24_0.mjs"
replacement=needle+" && node tests/v24-probation-telemetry-v24_1.mjs"
core=data["scripts"]["test:core"]
if needle not in core:
    raise SystemExit("V24.1 package anchor missing")
data["scripts"]["test:core"]=core.replace(needle,replacement,1)
pkg.write_text(json.dumps(data,indent=2)+"\n")
PY

echo "=== V24.1 STATIC ==="
node --check "$APP/src/v24-probation-telemetry-v24_1.mjs"
node --check "$APP/tests/v24-probation-telemetry-v24_1.mjs"
node --check "$APP/app-server.mjs"
node "$APP/tests/v24-probation-telemetry-v24_1.mjs"
git diff --check

echo "=== V24.1 CONTRACT AUDIT ==="
python3 - <<'PY'
from pathlib import Path
s=Path("memeflow-app/src/v24-probation-telemetry-v24_1.mjs").read_text()
a=Path("memeflow-app/app-server.mjs").read_text()

assert "DIAGNOSTIC_ONLY" in s
assert "stateMutation:false" in s
assert "scoreMutation:false" in s
assert "settingsMutation:false" in s
assert "buySellMutation:false" in s
assert "forecastMutation:false" in s
assert "automaticPromotion:false" in s
assert "applicationAllowed:false" in s
assert "/api/owner/intelligence/v24-probation" in a
assert "v24ProbationTelemetry.report" in a
assert "v24ProbationTelemetry.apply" not in a
assert "v24ProbationTelemetry.set" not in a
print("V24_1_CONTRACT_OK")
PY

echo "=== FULL TEST SUITE ==="
cd "$APP"
npm test
cd "$ROOT"

echo "=== V24.1 DIFF ==="
git diff --stat
git diff --check

git add \
  memeflow-app/app-server.mjs \
  memeflow-app/package.json \
  memeflow-app/src/v24-probation-telemetry-v24_1.mjs \
  memeflow-app/tests/v24-probation-telemetry-v24_1.mjs

ALLOWED_RE='^memeflow-app/(app-server\.mjs|package\.json|src/v24-probation-telemetry-v24_1\.mjs|tests/v24-probation-telemetry-v24_1\.mjs)$'
BAD="$(
  git diff --cached --name-only |
  grep -Ev "$ALLOWED_RE" ||
  true
)"

if [[ -n "$BAD" ]]; then
  echo "ERROR: unrelated staged files detected:"
  echo "$BAD"
  git reset
  exit 1
fi

git diff --cached --check

git commit -m "feat: add v24.1 probation impact telemetry"
git push origin "$BRANCH"

trap - ERR

echo
echo "=== DONE ==="
echo "Backup: $BACKUP"
git --no-pager log -1 --oneline
echo
echo "V24.1 CONTRACT:"
echo "  reads V24.0 audit + frozen V23.16 completed 5m outcomes"
echo "  measures affected rate / blocked-negative precision / positive opportunity cost"
echo "  distinguishes SHADOW vs ENFORCE interventions"
echo "  owner-only endpoint: GET /api/owner/intelligence/v24-probation"
echo "  evidence gate: >=50 directional, >=10 negative, >=10 positive"
echo "  telemetry is DIAGNOSTIC ONLY"
echo "  no Score/State/Settings/BUY/SELL/forecast mutation"
echo "  no automatic promotion"
echo "  no apply/tune endpoint"
