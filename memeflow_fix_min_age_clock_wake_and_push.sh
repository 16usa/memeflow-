#!/usr/bin/env bash
set -euo pipefail

echo "== MEMEFLOW: fix age-gate wakeup + scanner coverage diagnostics =="

if [[ -d "memeflow-app" && -f "memeflow-app/app-server.mjs" ]]; then
  cd memeflow-app
elif [[ -f "app-server.mjs" && -d "src" && -d "tests" ]]; then
  :
else
  echo "ERROR: run from ~/workspace or memeflow-app."
  exit 1
fi

python3 - <<'PY'
from pathlib import Path

app_path=Path("app-server.mjs")
app=app_path.read_text()

MARKER="// MEMEFLOW_AGE_THRESHOLD_WAKE_V1"

if MARKER not in app:
    start=app.find("const evaluateAll=makeEvaluateForActiveUsers({")
    if start < 0:
        raise SystemExit("PATCH FAILED: evaluateAll construction not found")

    tail="""  onDecision:(uid,token,decision)=>{
    void __mfHandleDecision(uid,token,decision).catch(()=>{});
  }
});
"""
    end=app.find(tail,start)
    if end < 0:
        raise SystemExit("PATCH FAILED: evaluateAll tail not found")
    end += len(tail)

    scheduler=r"""
// MEMEFLOW_AGE_THRESHOLD_WAKE_V1
// Entry admission is event-driven, but token AGE changes even when no trade
// event arrives. Without this clock wake, a token that was PENDING at 4:59
// could remain hidden forever after crossing a user's 5m minimum.
// This scheduler wakes a token exactly once per distinct active-user minimum
// age threshold/settings signature. It performs no RPC/network scan.
const __mfAgeWakeState=new Map();
const __mfAgeWakeIntervalMs=Math.max(
  1000,
  Number(process.env.AGE_ADMISSION_WAKE_INTERVAL_MS||2000)
);
const __mfAgeWakeMaxPerSweep=Math.max(
  10,
  Number(process.env.AGE_ADMISSION_WAKE_MAX_PER_SWEEP||100)
);
let __mfAgeWakeRunning=false;

Object.assign(discMetrics,{
  ageWakeSweeps:Number(discMetrics.ageWakeSweeps||0),
  ageWakeTriggered:Number(discMetrics.ageWakeTriggered||0),
  ageWakeEvaluated:Number(discMetrics.ageWakeEvaluated||0),
  ageWakeErrors:Number(discMetrics.ageWakeErrors||0),
  ageWakeLastAt:discMetrics.ageWakeLastAt||null,
  ageWakeActiveThresholds:[],
  ageWakeLastRawTokenCount:0
});

function __mfAgeWakePolicy(now=Date.now()){
  const context=settingsGateContext(now);
  const thresholds=[
    ...new Set(
      (context.entries||[])
        .map(entry=>Number(entry?.settings?.minTokenAgeMinutes))
        .filter(value=>Number.isFinite(value)&&value>0)
    )
  ].sort((a,b)=>a-b);

  return {
    signature:String(context.signature||'no-active-users'),
    thresholds
  };
}

function __mfPruneAgeWakeState(liveMints){
  if(__mfAgeWakeState.size<=liveMints.size+500)return;
  for(const mint of __mfAgeWakeState.keys()){
    if(!liveMints.has(mint))__mfAgeWakeState.delete(mint);
  }
}

function __mfRunAgeAdmissionWake(){
  if(__mfAgeWakeRunning)return;
  __mfAgeWakeRunning=true;

  try{
    const now=Date.now();
    const policy=__mfAgeWakePolicy(now);
    const tokens=__mfLiveScannerTokens(now);
    const liveMints=new Set(tokens.map(t=>String(t?.mint||'')).filter(Boolean));

    discMetrics.ageWakeSweeps++;
    discMetrics.ageWakeLastAt=now;
    discMetrics.ageWakeActiveThresholds=policy.thresholds.slice();
    discMetrics.ageWakeLastRawTokenCount=tokens.length;

    if(!policy.thresholds.length){
      __mfPruneAgeWakeState(liveMints);
      return;
    }

    let scheduled=0;

    for(const token of tokens){
      if(scheduled>=__mfAgeWakeMaxPerSweep)break;

      const mint=String(token?.mint||'');
      if(!mint)continue;

      const age=tokenAgeMinutes(token,now);
      if(!Number.isFinite(age))continue;

      let row=__mfAgeWakeState.get(mint);
      if(!row||row.signature!==policy.signature){
        row={signature:policy.signature,fired:new Set()};
        __mfAgeWakeState.set(mint,row);
      }

      const crossed=[];
      for(const threshold of policy.thresholds){
        const key=String(threshold);
        if(age>=threshold&&!row.fired.has(key))crossed.push(key);
      }

      if(!crossed.length)continue;

      for(const key of crossed)row.fired.add(key);

      scheduled++;
      discMetrics.ageWakeTriggered++;

      Promise.resolve(evaluateAll(token))
        .then(()=>{
          discMetrics.ageWakeEvaluated++;
          try{publish(mint)}catch{}
        })
        .catch(error=>{
          discMetrics.ageWakeErrors++;
          discMetrics.lastErrorAt=Date.now();
          try{
            discovery.lastError={
              message:'age admission wake: '+String(error?.message||error),
              at:Date.now()
            };
          }catch{}
        });
    }

    __mfPruneAgeWakeState(liveMints);
  }finally{
    __mfAgeWakeRunning=false;
  }
}

const __mfAgeWakeTimer=setInterval(
  __mfRunAgeAdmissionWake,
  __mfAgeWakeIntervalMs
);
__mfAgeWakeTimer.unref?.();

"""
    app=app[:end]+scheduler+app[end:]
    print("patched: added clock-driven min-age admission wake")
else:
    print("already patched: min-age admission wake")

old="""          __ingestPumpCreateEventDirect(
            logs,
            {
              signature:String(sig||''),
              slot:m.params?.result?.context?.slot??null
            }
          );
"""
new="""          const directToken=__ingestPumpCreateEventDirect(
            logs,
            {
              signature:String(sig||''),
              slot:m.params?.result?.context?.slot??null
            }
          );

          // MEMEFLOW_CREATE_DECODE_COVERAGE_V1
          // Keep an explicit coverage ratio so provider/log-decoder loss can
          // never masquerade as a settings problem again.
          discMetrics.createDecodeCoveragePct=
            discMetrics.createEventsAccepted>0
              ? Number(
                  (
                    100*
                    Number(discMetrics.directCreateEvents||0)/
                    Number(discMetrics.createEventsAccepted||1)
                  ).toFixed(2)
                )
              : 100;
          if(!directToken){
            discMetrics.lastDirectCreateDecodeFailedAt=Date.now();
          }
"""
if old in app:
    app=app.replace(old,new,1)
    print("patched: added CREATE decode coverage diagnostics")
elif "MEMEFLOW_CREATE_DECODE_COVERAGE_V1" in app:
    print("already patched: CREATE decode coverage diagnostics")
else:
    raise SystemExit("PATCH FAILED: direct CREATE ingest block not found")

app_path.write_text(app)

test_path=Path("tests/fresh-session-scanner.mjs")
test=test_path.read_text()

if "MEMEFLOW_AGE_THRESHOLD_WAKE_V1 regression" not in test:
    anchor="""assert.match(app,/setHeader\\('cache-control','no-store'\\)/);

"""
    addition="""assert.match(app,/setHeader\\('cache-control','no-store'\\)/);

// MEMEFLOW_AGE_THRESHOLD_WAKE_V1 regression
// A configured minimum age is a CLOCK transition; it must not depend on a
// later BUY/SELL event to re-run Entry Admission.
assert.match(app,/MEMEFLOW_AGE_THRESHOLD_WAKE_V1/);
assert.match(app,/function __mfRunAgeAdmissionWake\\(\\)/);
assert.match(app,/tokenAgeMinutes\\(token,now\\)/);
assert.match(app,/Promise\\.resolve\\(evaluateAll\\(token\\)\\)/);
assert.match(app,/AGE_ADMISSION_WAKE_INTERVAL_MS/);
assert.match(app,/ageWakeTriggered/);
assert.match(app,/MEMEFLOW_CREATE_DECODE_COVERAGE_V1/);
assert.match(app,/createDecodeCoveragePct/);

"""
    if anchor not in test:
        raise SystemExit("PATCH FAILED: fresh-session-scanner insertion anchor not found")
    test=test.replace(anchor,addition,1)
    test_path.write_text(test)
    print("patched: added scanner age-wake regression checks")
else:
    print("already patched: scanner age-wake regression checks")

strict_path=Path("tests/strict-entry-admission.mjs")
strict=strict_path.read_text()
if "clock threshold admission regression" not in strict:
    marker="""const good=evaluateEntryAdmission(admitted,strictSettings);
assert.equal(good.admitted,true);
assert.equal(good.state,'ADMITTED');

"""
    block="""const good=evaluateEntryAdmission(admitted,strictSettings);
assert.equal(good.admitted,true);
assert.equal(good.state,'ADMITTED');

// clock threshold admission regression
const fiveMinuteSettings={
  ...strictSettings,
  minTokenAgeMinutes:5,
  minMarketCapUsd:null,
  minHolders:null,
  maxTop10Pct:null,
  maxDeveloperPct:null,
  minBuyPressure:null,
  requireAnySocial:false,
  requireFreshHolderSnapshot:false
};
const justBeforeFive={
  ...admitted,
  pumpCreatedAt:now-(5*60_000)+1000
};
const justAfterFive={
  ...admitted,
  pumpCreatedAt:now-(5*60_000)-1000
};
assert.equal(
  evaluateEntryAdmission(justBeforeFive,fiveMinuteSettings,{now}).admitted,
  false
);
assert.equal(
  evaluateEntryAdmission(justAfterFive,fiveMinuteSettings,{now}).admitted,
  true
);

"""
    if marker not in strict:
        raise SystemExit("PATCH FAILED: strict-entry-admission anchor not found")
    strict=strict.replace(marker,block,1)
    strict_path.write_text(strict)
    print("patched: added functional 5-minute threshold regression")
else:
    print("already patched: functional 5-minute threshold regression")
PY

echo
echo "== Focused tests =="
node tests/strict-entry-admission.mjs
node tests/fresh-session-scanner.mjs

echo
echo "== Full npm test =="
npm test

echo
echo "== Stage only this fix =="
git add \
  app-server.mjs \
  tests/fresh-session-scanner.mjs \
  tests/strict-entry-admission.mjs

echo
echo "== Diff summary (no pager) =="
git --no-pager diff --cached --stat
git --no-pager diff --cached -- \
  app-server.mjs \
  tests/fresh-session-scanner.mjs \
  tests/strict-entry-admission.mjs

if git diff --cached --quiet; then
  echo "No new changes to commit."
else
  git commit -m "fix: wake scanner admission when token reaches minimum age"
fi

echo
echo "== Push =="
git push origin HEAD

echo
echo "SUCCESS."
echo "What changed:"
echo "  - A token hidden at 0-5m is re-evaluated by CLOCK when it crosses 5m."
echo "  - It no longer needs a new trade after 5m to appear."
echo "  - Distinct active-user min-age thresholds are handled separately."
echo "  - No scanner RPC was added."
echo "  - /api/discovery/status now exposes ageWake* and createDecodeCoveragePct."
