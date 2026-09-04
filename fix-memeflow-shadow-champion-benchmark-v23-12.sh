#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
[[ -n "$ROOT" ]] || {
  echo "ERROR: run inside MEMEFLOW repo"
  exit 1
}

cd "$ROOT"

BRANCH="chart-debug-20260829-161234"
EXPECTED_HEAD="f9625a0d55b33288da14fb1406a993d0d191d0f7"

APP="memeflow-app/app-server.mjs"
SHADOW="memeflow-app/src/token-intelligence-shadow-v23.mjs"
PKG="memeflow-app/package.json"
BENCH="memeflow-app/src/shadow-champion-benchmark-v23_12.mjs"
TEST="memeflow-app/tests/shadow-champion-benchmark-v23_12.mjs"

MODIFIED=("$APP" "$SHADOW" "$PKG")
NEW_FILES=("$BENCH" "$TEST")
ALL_FILES=("${MODIFIED[@]}" "${NEW_FILES[@]}")

echo "=== MEMEFLOW SHADOW CHAMPION BENCHMARK V23.12 ==="

clear_lock(){
  if [[ -e .git/index.lock ]]; then
    active=""

    for proc in /proc/[0-9]*; do
      [[ -r "$proc/comm" ]] || continue
      comm="$(cat "$proc/comm" 2>/dev/null || true)"

      case "$comm" in
        git|git-*)
          cwd="$(readlink -f "$proc/cwd" 2>/dev/null || true)"
          if [[ "$cwd" == "$ROOT" || "$cwd" == "$ROOT/"* ]]; then
            active="$proc:$comm:$cwd"
            break
          fi
        ;;
      esac
    done

    if [[ -n "$active" ]]; then
      echo "V23.12 REFUSED: active git process with index.lock"
      echo "$active"
      exit 1
    fi

    rm -f .git/index.lock
  fi
}

clear_lock

[[ "$(git branch --show-current)" == "$BRANCH" ]] || {
  echo "V23.12 REFUSED: wrong branch"
  echo "expected: $BRANCH"
  echo "actual: $(git branch --show-current)"
  exit 1
}

[[ "$(git rev-parse HEAD)" == "$EXPECTED_HEAD" ]] || {
  echo "V23.12 REFUSED: audited HEAD changed"
  echo "expected: $EXPECTED_HEAD"
  echo "actual: $(git rev-parse HEAD)"
  exit 1
}

for f in "${MODIFIED[@]}"; do
  [[ -f "$f" ]] || {
    echo "V23.12 REFUSED: missing $f"
    exit 1
  }

  git diff --quiet -- "$f" || {
    echo "V23.12 REFUSED: local changes in $f"
    exit 1
  }

  git diff --cached --quiet -- "$f" || {
    echo "V23.12 REFUSED: staged changes in $f"
    exit 1
  }
done

for f in "${NEW_FILES[@]}"; do
  [[ ! -e "$f" ]] || {
    echo "V23.12 REFUSED: $f already exists"
    exit 1
  }
done

STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP=".memeflow-backups/shadow-champion-benchmark-v23-12-$STAMP"

mkdir -p "$BACKUP"

for f in "${MODIFIED[@]}"; do
  mkdir -p "$BACKUP/$(dirname "$f")"
  cp "$f" "$BACKUP/$f"
done

rollback(){
  rc=$?

  if [[ $rc -ne 0 ]]; then
    echo
    echo "=== V23.12 FAILED - RESTORING ==="

    for f in "${MODIFIED[@]}"; do
      [[ -f "$BACKUP/$f" ]] && cp "$BACKUP/$f" "$f" || true
    done

    for f in "${NEW_FILES[@]}"; do
      rm -f "$f"
    done

    git reset -- "${ALL_FILES[@]}" >/dev/null 2>&1 || true

    echo "ROLLBACK_COMPLETE; backup: $BACKUP"
  fi

  exit "$rc"
}

trap rollback EXIT INT TERM

cat > "$BENCH" <<'EOF_BENCH'
import fs from 'node:fs';
import path from 'node:path';

// MEMEFLOW_SHADOW_CHAMPION_BENCHMARK_V23_12
// SHADOW ONLY. No Score/State/settings/BUY/SELL authority.
// Paired predictive benchmark on the exact same frozen anchor/outcome.
// V22 baseline = canonical Score / 100 signal (explicitly not calibrated probability / not PnL).
// V23 challenger = V23.11 calibrated probability when ready, else V23.10 synthesis.

const TARGET_HORIZON_MS=300_000;

const finite=v=>{
  if(v===null||v===undefined||v==='')return null;
  const n=Number(v);
  return Number.isFinite(n)?n:null;
};
const clamp=(v,a,b)=>Math.max(a,Math.min(b,Number(v)||0));
const round=(v,d=2)=>{
  const n=finite(v);
  if(n===null)return null;
  const p=10**d;
  return Math.round(n*p)/p;
};
const upper=v=>String(v||'UNKNOWN').trim().toUpperCase()||'UNKNOWN';

function classifyOutcome(outcome={}){
  if(outcome.dead===true)return 'NEGATIVE';
  const ret=finite(outcome.returnPct);
  const mfe=finite(outcome.maxFavorableExcursionPct);
  const mae=finite(outcome.maxAdverseExcursionPct);

  if(
    (ret!==null&&ret>=20) ||
    (mfe!==null&&mfe>=50&&(mae===null||mae>-25))
  )return 'POSITIVE';

  if(
    (ret!==null&&ret<=-20) ||
    (mae!==null&&mae<=-25)
  )return 'NEGATIVE';

  return 'NEUTRAL';
}

function safeLogLoss(p,y){
  p=clamp(Number(p),1e-6,1-1e-6);
  return -(y*Math.log(p)+(1-y)*Math.log(1-p));
}

function readTailUtf8(file,maxBytes=20*1024*1024){
  try{
    if(!file||!fs.existsSync(file))return '';
    const st=fs.statSync(file);
    if(!(st.size>0))return '';
    if(st.size<=maxBytes)return fs.readFileSync(file,'utf8');

    const fd=fs.openSync(file,'r');
    try{
      const buf=Buffer.allocUnsafe(maxBytes);
      fs.readSync(fd,buf,0,maxBytes,st.size-maxBytes);
      let text=buf.toString('utf8');
      const nl=text.indexOf('\n');
      if(nl>=0)text=text.slice(nl+1);
      return text;
    }finally{
      fs.closeSync(fd);
    }
  }catch{
    return '';
  }
}

function summarize(rows=[]){
  const scored=rows.filter(row=>
    row.scored===true &&
    finite(row.v22SignalPct)!==null &&
    finite(row.v23ProbabilityPct)!==null
  );

  if(!scored.length){
    return {
      pairedRows:0,
      positive:0,
      negative:0,
      v22:{meanBrier:null,meanLogLoss:null,accuracyPct:null},
      v23:{meanBrier:null,meanLogLoss:null,accuracyPct:null},
      delta:{brier:null,logLoss:null,accuracyPct:null},
      pairedWins:{v22:0,v23:0,ties:0}
    };
  }

  let positive=0,negative=0;
  let v22Brier=0,v23Brier=0,v22LogLoss=0,v23LogLoss=0;
  let v22Correct=0,v23Correct=0,v22Wins=0,v23Wins=0,ties=0;

  for(const row of scored){
    const y=row.classification==='POSITIVE'?1:0;
    if(y)positive++; else negative++;

    const p22=clamp(Number(row.v22SignalPct)/100,0,1);
    const p23=clamp(Number(row.v23ProbabilityPct)/100,0,1);

    const b22=(p22-y)**2;
    const b23=(p23-y)**2;

    v22Brier+=b22;
    v23Brier+=b23;
    v22LogLoss+=safeLogLoss(p22,y);
    v23LogLoss+=safeLogLoss(p23,y);

    if((p22>=0.5?1:0)===y)v22Correct++;
    if((p23>=0.5?1:0)===y)v23Correct++;

    if(Math.abs(b22-b23)<=1e-9)ties++;
    else if(b23<b22)v23Wins++;
    else v22Wins++;
  }

  const n=scored.length;
  const mb22=v22Brier/n, mb23=v23Brier/n;
  const ml22=v22LogLoss/n, ml23=v23LogLoss/n;
  const a22=v22Correct/n*100, a23=v23Correct/n*100;

  return {
    pairedRows:n,
    positive,
    negative,
    v22:{
      meanBrier:round(mb22,6),
      meanLogLoss:round(ml22,6),
      accuracyPct:round(a22,2)
    },
    v23:{
      meanBrier:round(mb23,6),
      meanLogLoss:round(ml23,6),
      accuracyPct:round(a23,2)
    },
    delta:{
      brier:round(mb22-mb23,6),
      logLoss:round(ml22-ml23,6),
      accuracyPct:round(a23-a22,2)
    },
    pairedWins:{v22:v22Wins,v23:v23Wins,ties}
  };
}

function verdict(report){
  const n=Number(report?.pairedRows||0);
  const positive=Number(report?.positive||0);
  const negative=Number(report?.negative||0);

  if(n<50){
    return {
      status:'BENCHMARK_COLD_START',
      promotionEligible:false,
      reason:'NEED_AT_LEAST_50_PAIRED_5M_OUTCOMES'
    };
  }

  if(positive<10||negative<10){
    return {
      status:'BENCHMARK_CLASS_IMBALANCE',
      promotionEligible:false,
      reason:'NEED_AT_LEAST_10_POSITIVE_AND_10_NEGATIVE'
    };
  }

  const brier=finite(report?.delta?.brier)??0;
  const logLoss=finite(report?.delta?.logLoss)??0;
  const accuracy=finite(report?.delta?.accuracyPct)??0;

  if(brier>=0.005&&logLoss>=0.01&&accuracy>=-2){
    return {
      status:'V23_CHALLENGER_WINS',
      promotionEligible:true,
      reason:'V23_BEATS_V22_ON_BRIER_AND_LOG_LOSS'
    };
  }

  if(brier<=-0.005&&logLoss<=-0.01){
    return {
      status:'V22_BASELINE_WINS',
      promotionEligible:false,
      reason:'V22_BEATS_V23_ON_BRIER_AND_LOG_LOSS'
    };
  }

  return {
    status:'BENCHMARK_INCONCLUSIVE',
    promotionEligible:false,
    reason:'MIXED_OR_TOO_SMALL_PERFORMANCE_DELTA'
  };
}

export function createShadowChampionBenchmarkV23_12({
  dataDir=null,
  maxRows=10_000
}={}){
  const file=dataDir
    ? path.join(dataDir,'shadow-champion-benchmark-v23-12.jsonl')
    : null;

  const rows=[];
  const recent=[];
  const queue=[];

  let draining=false;
  let rowsLoaded=0,rowsWritten=0,loadErrors=0,writeErrors=0;
  let outcomesRecorded=0,duplicatesRejected=0;

  if(file){
    try{fs.mkdirSync(path.dirname(file),{recursive:true});}catch{}
  }

  function kick(){
    if(draining||!queue.length||!file)return;
    draining=true;

    setImmediate(async()=>{
      try{
        while(queue.length){
          const batch=queue.splice(0,200);
          await fs.promises.appendFile(
            file,
            batch.map(row=>JSON.stringify(row)).join('\n')+'\n',
            'utf8'
          );
          rowsWritten+=batch.length;
        }
      }catch{
        writeErrors++;
      }finally{
        draining=false;
        if(queue.length)kick();
      }
    });
  }

  function append(row){
    if(!file)return;
    queue.push(row);
    if(queue.length>10_000)queue.splice(0,queue.length-10_000);
    kick();
  }

  async function flush(){
    if(!file)return true;
    kick();
    const started=Date.now();

    while(draining||queue.length){
      if(Date.now()-started>5_000)return false;
      await new Promise(resolve=>setTimeout(resolve,5));
    }
    return true;
  }

  function addRow(raw,{persist=false}={}){
    const mint=String(raw?.mint||'');
    const anchorAt=Number(raw?.anchorAt||0);
    const horizonMs=Number(raw?.horizonMs||0);

    if(!mint||!(anchorAt>0)||!(horizonMs>0))return null;

    const key=[mint,anchorAt,horizonMs].join(':');

    if(rows.some(row=>row.key===key)){
      duplicatesRejected++;
      return null;
    }

    const row={
      type:'champion-benchmark-outcome',
      version:'MEMEFLOW_SHADOW_CHAMPION_BENCHMARK_ROW_V23_12',
      shadowOnly:true,
      key,
      mint,
      anchorAt,
      observedAt:Number(raw?.observedAt||0)||null,
      horizonMs,
      classification:upper(raw?.classification),
      scored:raw?.scored===true,
      v22SignalPct:finite(raw?.v22SignalPct),
      v23ProbabilityPct:finite(raw?.v23ProbabilityPct),
      v23ProbabilitySource:String(raw?.v23ProbabilitySource||'NONE'),
      v23ConfidencePct:finite(raw?.v23ConfidencePct),
      v23CalibrationReady:raw?.v23CalibrationReady===true,
      synthesisStatus:upper(raw?.synthesisStatus),
      calibrationStatus:upper(raw?.calibrationStatus)
    };

    rows.push(row);

    const limit=Math.max(500,Number(maxRows)||10_000);
    if(rows.length>limit)rows.splice(0,rows.length-limit);

    recent.unshift(row);
    if(recent.length>200)recent.length=200;

    if(persist)append(row);

    return row;
  }

  function load(){
    if(!file)return;
    const text=readTailUtf8(file);

    for(const line of text.split('\n')){
      if(!line.trim())continue;

      try{
        const row=JSON.parse(line);
        if(row?.type==='champion-benchmark-outcome'){
          const before=rows.length;
          addRow(row,{persist:false});
          if(rows.length>before)rowsLoaded++;
        }
      }catch{
        loadErrors++;
      }
    }
  }

  function recordOutcome({anchor,outcome}={}){
    const mint=String(anchor?.mint||outcome?.mint||'');

    if(!mint||!anchor||!outcome)return null;

    const v22SignalPct=finite(anchor?.canonicalScore);
    const features=anchor?.features||{};

    const synthesis=features?.shadowEvidenceSynthesis||{};
    const calibration=features?.shadowOutcomeCalibration||{};

    const calibratedP=calibration.ready===true
      ? finite(calibration.calibratedProbabilityPositivePct)
      : null;

    const synthesisP=synthesis.ready===true
      ? finite(synthesis.synthesisProbabilityPositivePct)
      : null;

    const v23ProbabilityPct=calibratedP!==null?calibratedP:synthesisP;

    if(v22SignalPct===null||v23ProbabilityPct===null)return null;

    const classification=classifyOutcome(outcome);
    const scored=['POSITIVE','NEGATIVE'].includes(classification);

    const row=addRow({
      mint,
      anchorAt:Number(anchor.at)||0,
      observedAt:Number(outcome.observedAt)||null,
      horizonMs:Number(outcome.horizonMs)||0,
      classification,
      scored,
      v22SignalPct:clamp(v22SignalPct,0,100),
      v23ProbabilityPct:clamp(v23ProbabilityPct,0,100),
      v23ProbabilitySource:calibratedP!==null
        ? 'V23_11_CALIBRATED'
        : 'V23_10_SYNTHESIS',
      v23ConfidencePct:calibratedP!==null
        ? finite(calibration.calibratedConfidencePct)
        : finite(synthesis.synthesisConfidencePct),
      v23CalibrationReady:calibration.ready===true,
      synthesisStatus:synthesis.status,
      calibrationStatus:calibration.status
    },{persist:true});

    if(row)outcomesRecorded++;

    return row;
  }

  function report({horizonMs=TARGET_HORIZON_MS}={}){
    const horizon=Number(horizonMs);

    const summary=summarize(
      rows.filter(row=>row.horizonMs===horizon)
    );

    return {
      version:'MEMEFLOW_SHADOW_CHAMPION_BENCHMARK_V23_12',
      shadowOnly:true,
      authority:'DIAGNOSTIC_ONLY',
      comparison:'V22_CANONICAL_SCORE_SIGNAL_VS_V23_PROBABILITY',
      caveat:'V22_SCORE_IS_NOT_A_CALIBRATED_PROBABILITY_AND_THIS_IS_NOT_PNL',
      horizonMs:horizon,
      ...summary,
      verdict:horizon===TARGET_HORIZON_MS
        ? verdict(summary)
        : {
            status:'DIAGNOSTIC_HORIZON_ONLY',
            promotionEligible:false,
            reason:'ONLY_5M_IS_PROMOTION_TARGET'
          }
    };
  }

  function horizonReport(){
    return [...new Set(rows.map(row=>row.horizonMs))]
      .sort((a,b)=>a-b)
      .map(horizonMs=>report({horizonMs}));
  }

  function listRecent({limit=50,source=null}={}){
    const safe=Math.max(1,Math.min(200,Number(limit)||50));
    const wanted=source?String(source).toUpperCase():null;

    return recent
      .filter(row=>
        !wanted ||
        String(row.v23ProbabilitySource).toUpperCase()===wanted
      )
      .slice(0,safe);
  }

  function status(){
    const target=report({horizonMs:TARGET_HORIZON_MS});

    return {
      version:'MEMEFLOW_SHADOW_CHAMPION_BENCHMARK_V23_12',
      shadowOnly:true,
      authority:'DIAGNOSTIC_ONLY',
      targetHorizonMs:TARGET_HORIZON_MS,
      comparison:target.comparison,
      caveat:target.caveat,
      target:{
        pairedRows:target.pairedRows,
        positive:target.positive,
        negative:target.negative,
        v22:target.v22,
        v23:target.v23,
        delta:target.delta,
        pairedWins:target.pairedWins,
        verdict:target.verdict
      },
      rows:rows.length,
      outcomesRecorded,
      duplicatesRejected,
      rowsLoaded,
      rowsWritten,
      queued:queue.length,
      draining,
      loadErrors,
      writeErrors,
      file
    };
  }

  load();

  return {
    recordOutcome,
    report,
    horizonReport,
    listRecent,
    status,
    flush
  };
}

EOF_BENCH

cat > "$TEST" <<'EOF_TEST'
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  createShadowChampionBenchmarkV23_12
} from '../src/shadow-champion-benchmark-v23_12.mjs';

const tmp=fs.mkdtempSync(
  path.join(os.tmpdir(),'mf-v23-12-')
);

function anchor({
  mint,
  at,
  canonicalScore,
  v23Probability,
  calibrated=true,
  confidence=75
}){
  return {
    mint,
    at,
    canonicalScore,
    features:{
      shadowEvidenceSynthesis:{
        ready:true,
        status:'SYNTHESIS_MODERATE',
        synthesisProbabilityPositivePct:v23Probability,
        synthesisConfidencePct:confidence
      },
      shadowOutcomeCalibration:{
        ready:calibrated,
        status:calibrated?'CALIBRATION_HEALTHY':'CALIBRATION_LEARNING',
        calibratedProbabilityPositivePct:calibrated?v23Probability:null,
        calibratedConfidencePct:calibrated?confidence:0
      }
    }
  };
}

function outcome({mint,at,positive,horizonMs=300_000}){
  return {
    mint,
    observedAt:at+horizonMs,
    horizonMs,
    returnPct:positive?35:-30,
    maxFavorableExcursionPct:positive?60:5,
    maxAdverseExcursionPct:positive?-5:-35,
    dead:false
  };
}

try{
  const benchmark=createShadowChampionBenchmarkV23_12({
    dataDir:tmp
  });

  const base=1_801_300_000_000;

  for(let i=0;i<60;i++){
    const positive=i<30;
    const mint=`PAIR_${i}`;
    const at=base+i*1000;

    assert.ok(
      benchmark.recordOutcome({
        anchor:anchor({
          mint,
          at,
          canonicalScore:positive?58:42,
          v23Probability:positive?80:20,
          calibrated:i%2===0
        }),
        outcome:outcome({mint,at,positive})
      })
    );
  }

  const report=benchmark.report({
    horizonMs:300_000
  });

  assert.equal(report.pairedRows,60);
  assert.equal(report.positive,30);
  assert.equal(report.negative,30);

  assert.ok(report.v23.meanBrier<report.v22.meanBrier);
  assert.ok(report.v23.meanLogLoss<report.v22.meanLogLoss);

  assert.equal(
    report.verdict.status,
    'V23_CHALLENGER_WINS'
  );

  assert.equal(
    report.verdict.promotionEligible,
    true
  );

  benchmark.recordOutcome({
    anchor:anchor({
      mint:'ONE_MINUTE',
      at:base+100_000,
      canonicalScore:55,
      v23Probability:70
    }),
    outcome:outcome({
      mint:'ONE_MINUTE',
      at:base+100_000,
      positive:true,
      horizonMs:60_000
    })
  });

  assert.equal(
    benchmark.report({horizonMs:60_000}).verdict.status,
    'DIAGNOSTIC_HORIZON_ONLY'
  );

  const recent=benchmark.listRecent({limit:100});

  assert.ok(
    recent.some(row=>row.v23ProbabilitySource==='V23_11_CALIBRATED')
  );

  assert.ok(
    recent.some(row=>row.v23ProbabilitySource==='V23_10_SYNTHESIS')
  );

  assert.equal(await benchmark.flush(),true);

  const restored=createShadowChampionBenchmarkV23_12({
    dataDir:tmp
  });

  assert.ok(restored.status().rowsLoaded>=60);

  assert.equal(typeof benchmark.buy,'undefined');
  assert.equal(typeof benchmark.sell,'undefined');
  assert.equal(typeof benchmark.execute,'undefined');

  // Project wiring / strict SHADOW contract.
  const shadow=fs.readFileSync(
    'src/token-intelligence-shadow-v23.mjs',
    'utf8'
  );

  const app=fs.readFileSync(
    'app-server.mjs',
    'utf8'
  );

  assert.match(shadow,/createShadowChampionBenchmarkV23_12/);
  assert.match(shadow,/shadowChampionBenchmark\.recordOutcome/);
  assert.match(shadow,/shadowChampionBenchmark:shadowChampionBenchmark\.status\(\)/);

  assert.match(app,/\/api\/owner\/intelligence\/champion-benchmark/);
  assert.match(app,/championBenchmarkHorizonReport/);

  const source=fs.readFileSync(
    'src/shadow-champion-benchmark-v23_12.mjs',
    'utf8'
  );

  assert.doesNotMatch(source,/from ['"]\.\/evaluate\.mjs['"]/);
  assert.doesNotMatch(source,/openPosition\s*\(/);
  assert.doesNotMatch(source,/closePosition\s*\(/);
  assert.doesNotMatch(source,/setSettings\s*\(/);
  assert.doesNotMatch(source,/tradeEligible/);
  assert.doesNotMatch(source,/decisionScore/);
  assert.doesNotMatch(source,/benchmarkScore/);

  console.log('shadow champion benchmark v23.12 ok');
}finally{
  fs.rmSync(tmp,{recursive:true,force:true});
}

EOF_TEST

python3 - <<'PY'
from pathlib import Path

for name in [
    "memeflow-app/src/shadow-champion-benchmark-v23_12.mjs",
    "memeflow-app/tests/shadow-champion-benchmark-v23_12.mjs"
]:
    p=Path(name)
    p.write_text(
        p.read_text(encoding="utf-8").rstrip("\n")+"\n",
        encoding="utf-8"
    )

print("V23_12_EOF_NORMALIZATION_OK")
PY

python3 - <<'PY'
from pathlib import Path

sp=Path("memeflow-app/src/token-intelligence-shadow-v23.mjs")
ap=Path("memeflow-app/app-server.mjs")

s=sp.read_text(encoding="utf-8")
a=ap.read_text(encoding="utf-8")

def once(text,old,new,label):
    n=text.count(old)
    if n!=1:
        raise SystemExit(
            f"V23.12 REFUSED: {label}: expected 1 exact match, got {n}"
        )
    return text.replace(old,new,1)

old="""import {
  createShadowOutcomeCalibrationV23_11
} from './shadow-outcome-calibration-v23_11.mjs';"""

s=once(
    s,
    old,
    old+"""
import {
  createShadowChampionBenchmarkV23_12
} from './shadow-champion-benchmark-v23_12.mjs';""",
    "benchmark import"
)

old="""  const shadowOutcomeCalibration=
    createShadowOutcomeCalibrationV23_11({
      dataDir
    });"""

s=once(
    s,
    old,
    old+"""

  const shadowChampionBenchmark=
    createShadowChampionBenchmarkV23_12({
      dataDir
    });""",
    "benchmark construction"
)

old="""        shadowOutcomeCalibration.recordOutcome({
          anchor:cell.anchor,
          outcome
        });
"""

s=once(
    s,
    old,
    old+"""
        shadowChampionBenchmark.recordOutcome({
          anchor:cell.anchor,
          outcome
        });
""",
    "benchmark outcome"
)

s=once(
    s,
    "version:'MEMEFLOW_TOKEN_INTELLIGENCE_NETWORK_V23_11'",
    "version:'MEMEFLOW_TOKEN_INTELLIGENCE_NETWORK_V23_12'",
    "network version"
)

old="""      shadowEvidenceSynthesis:shadowEvidenceSynthesis.status(),
      shadowOutcomeCalibration:shadowOutcomeCalibration.status()
"""

s=once(
    s,
    old,
    """      shadowEvidenceSynthesis:shadowEvidenceSynthesis.status(),
      shadowOutcomeCalibration:shadowOutcomeCalibration.status(),
      shadowChampionBenchmark:shadowChampionBenchmark.status()
""",
    "benchmark status"
)

old="""    flushOutcomeCalibration:
      ()=>shadowOutcomeCalibration.flush(),
    status
"""

s=once(
    s,
    old,
    """    flushOutcomeCalibration:
      ()=>shadowOutcomeCalibration.flush(),
    championBenchmarkStatus:
      ()=>shadowChampionBenchmark.status(),
    championBenchmarkReport:
      options=>shadowChampionBenchmark.report(options),
    championBenchmarkHorizonReport:
      ()=>shadowChampionBenchmark.horizonReport(),
    listChampionBenchmarkRows:
      options=>shadowChampionBenchmark.listRecent(options),
    flushChampionBenchmark:
      ()=>shadowChampionBenchmark.flush(),
    status
""",
    "benchmark API"
)

sp.write_text(s,encoding="utf-8")

anchor="""/* MEMEFLOW_PUBLIC_AGENT_ENTITY_V2_ROUTES */
"""

route=r"""/* MEMEFLOW_SHADOW_CHAMPION_BENCHMARK_MONITOR_V23_12
 * Owner-only, read-only paired V22-vs-V23 predictive benchmark.
 */
 if(
   url.pathname==='/api/owner/intelligence/champion-benchmark' &&
   req.method==='GET'
 ){
   if(!u)return json(res,401,{error:'AUTH_REQUIRED'});
   if(u.isOwner!==true)return json(res,403,{error:'OWNER_REQUIRED'});

   const limit=Math.max(
     1,
     Math.min(
       200,
       Number(
         url.searchParams.get('limit')||50
       )
     )
   );

   const horizonMs=Math.max(
     1,
     Number(
       url.searchParams.get('horizonMs')||300000
     )
   );

   const source=String(
     url.searchParams.get('source')||''
   ).trim().toUpperCase();

   return json(res,200,{
     ok:true,
     shadowOnly:true,
     benchmark:
       tokenIntelligenceShadowV23
         .championBenchmarkStatus(),
     selected:
       tokenIntelligenceShadowV23
         .championBenchmarkReport({
           horizonMs
         }),
     horizons:
       tokenIntelligenceShadowV23
         .championBenchmarkHorizonReport(),
     recent:
       tokenIntelligenceShadowV23
         .listChampionBenchmarkRows({
           limit,
           source:source||null
         })
   });
 }

/* MEMEFLOW_PUBLIC_AGENT_ENTITY_V2_ROUTES */
"""

a=once(
    a,
    anchor,
    route,
    "benchmark owner route"
)

ap.write_text(a,encoding="utf-8")

print("V23_12_TRANSFORM_OK")

PY

python3 - <<'PY'
import json
from pathlib import Path

p=Path("memeflow-app/package.json")

d=json.loads(
    p.read_text(
        encoding="utf-8"
    )
)

s=d["scripts"]["test:core"]

needle="node tests/shadow-outcome-calibration-v23_11.mjs && node tests/assist-fresh-decision-v22.mjs"
replacement="node tests/shadow-outcome-calibration-v23_11.mjs && node tests/shadow-champion-benchmark-v23_12.mjs && node tests/assist-fresh-decision-v22.mjs"

if s.count(needle)!=1:
    raise SystemExit(
        "V23.12 REFUSED: package test anchor changed"
    )

if "shadow-champion-benchmark-v23_12.mjs" in s:
    raise SystemExit(
        "V23.12 REFUSED: benchmark test already installed"
    )

d["scripts"]["test:core"] = s.replace(
    needle,
    replacement,
    1
)

p.write_text(
    json.dumps(d,indent=2)+"\n",
    encoding="utf-8"
)

print("PACKAGE_TRANSFORM_OK")

PY

echo
echo "=== V23.12 SYNTAX ==="

node --check "$APP"
node --check "$SHADOW"
node --check "$BENCH"
node --check "$TEST"

node -e "JSON.parse(require('fs').readFileSync('$PKG','utf8')); console.log('PACKAGE_JSON_OK')"

echo "SYNTAX_OK"

echo
echo "=== V23.12 TARGETED TESTS ==="

(
  cd memeflow-app

  node tests/token-intelligence-shadow-v23.mjs
  node tests/token-intelligence-monitor-v23_1.mjs
  node tests/wallet-reputation-shadow-v23_2.mjs
  node tests/learning-dataset-shadow-v23_3.mjs
  node tests/shadow-math-brain-v23_4.mjs
  node tests/shadow-model-arena-v23_5.mjs
  node tests/shadow-drift-regime-v23_6.mjs
  node tests/shadow-confidence-governor-v23_7.mjs
  node tests/shadow-token-trajectory-v23_8.mjs
  node tests/shadow-token-pattern-memory-v23_9.mjs
  node tests/shadow-evidence-synthesis-v23_10.mjs
  node tests/shadow-outcome-calibration-v23_11.mjs
  node tests/shadow-champion-benchmark-v23_12.mjs
  node tests/lifecycle-decision-v22.mjs
  node tests/assist-fresh-decision-v22.mjs
)

echo "TARGETED_TESTS_OK"

echo
echo "=== V23.12 FULL PROJECT TEST SUITE ==="

(
  cd memeflow-app
  npm test
)

echo "FULL_TEST_SUITE_OK"

echo
echo "=== V23.12 STATIC CONTRACT AUDIT ==="

python3 - <<'PY'
from pathlib import Path

m=Path(
    "memeflow-app/src/shadow-champion-benchmark-v23_12.mjs"
).read_text(encoding="utf-8")

s=Path(
    "memeflow-app/src/token-intelligence-shadow-v23.mjs"
).read_text(encoding="utf-8")

a=Path(
    "memeflow-app/app-server.mjs"
).read_text(encoding="utf-8")

pkg=Path(
    "memeflow-app/package.json"
).read_text(encoding="utf-8")

errors=[]

for marker in [
    "MEMEFLOW_SHADOW_CHAMPION_BENCHMARK_V23_12",
    "V23_CHALLENGER_WINS",
    "V22_BASELINE_WINS",
    "BENCHMARK_INCONCLUSIVE",
    "BENCHMARK_CLASS_IMBALANCE",
    "V22_SCORE_IS_NOT_A_CALIBRATED_PROBABILITY_AND_THIS_IS_NOT_PNL",
    "shadow-champion-benchmark-v23-12.jsonl",
    "TARGET_HORIZON_MS=300_000"
]:
    if marker not in m:
        errors.append("benchmark marker missing: "+marker)

for forbidden in [
    "from './evaluate.mjs'",
    'from "./evaluate.mjs"',
    "openPosition(",
    "closePosition(",
    "setSettings(",
    "tradeEligible",
    "decisionScore",
    "benchmarkScore"
]:
    if forbidden in m:
        errors.append("forbidden authority: "+forbidden)

for marker in [
    "createShadowChampionBenchmarkV23_12",
    "shadowChampionBenchmark.recordOutcome",
    "shadowChampionBenchmark:shadowChampionBenchmark.status()",
    "championBenchmarkStatus",
    "championBenchmarkReport",
    "championBenchmarkHorizonReport",
    "listChampionBenchmarkRows",
    "MEMEFLOW_TOKEN_INTELLIGENCE_NETWORK_V23_12"
]:
    if marker not in s:
        errors.append("wiring missing: "+marker)

for marker in [
    "/api/owner/intelligence/champion-benchmark",
    "MEMEFLOW_SHADOW_CHAMPION_BENCHMARK_MONITOR_V23_12",
    "championBenchmarkHorizonReport"
]:
    if marker not in a:
        errors.append("monitor missing: "+marker)

if "shadow-champion-benchmark-v23_12.mjs" not in pkg:
    errors.append("V23.12 test missing from package")

for marker in [
    "anchor?.canonicalScore",
    "anchor?.features",
    "shadowEvidenceSynthesis",
    "shadowOutcomeCalibration"
]:
    if marker not in m:
        errors.append("paired-anchor contract missing: "+marker)

for marker in [
    "n<50",
    "positive<10",
    "negative<10",
    "brier>=0.005",
    "logLoss>=0.01"
]:
    if marker not in m:
        errors.append("promotion guard missing: "+marker)

for marker in [
    "shadowMathBrain.predict",
    "shadowModelArena.predict",
    "shadowDriftRegime.predict",
    "shadowConfidenceGovernor.predict",
    "shadowTokenTrajectory.observe",
    "shadowTokenPatternMemory.predict",
    "shadowEvidenceSynthesis.predict",
    "shadowOutcomeCalibration.predict"
]:
    if marker not in s:
        errors.append("backward compatibility missing: "+marker)

if errors:
    raise SystemExit(
        "V23_12_CONTRACT_FAILED:\n- "+
        "\n- ".join(errors)
    )

print("V23_12_CONTRACT_OK")

PY

git diff --check -- "${ALL_FILES[@]}"

echo
echo "=== V23.12 DIFF ==="

git diff --stat -- "${ALL_FILES[@]}"

clear_lock
git reset >/dev/null
clear_lock
git add "${ALL_FILES[@]}"

ALLOWED_RE='^memeflow-app/(app-server\.mjs|package\.json|src/token-intelligence-shadow-v23\.mjs|src/shadow-champion-benchmark-v23_12\.mjs|tests/shadow-champion-benchmark-v23_12\.mjs)$'

BAD="$(
  git diff --cached --name-only |
  grep -Ev "$ALLOWED_RE" ||
  true
)"

if [[ -n "$BAD" ]]; then
  echo "V23.12 REFUSED: unrelated staged files:"
  echo "$BAD"
  git reset
  exit 1
fi

git diff --cached --check

echo
echo "=== V23.12 STAGED ==="

git diff --cached --stat

git commit -m "feat: add shadow V22 versus V23 champion benchmark v23.12"

git push origin HEAD

trap - EXIT INT TERM

echo
echo "=== DONE ==="

echo "Backup: $BACKUP"

git log -1 --oneline --decorate

echo
echo "V23.12 CONTRACT:"
echo "  V22 evaluate remains the only trading authority"
echo "  V22 and V23 are compared on the exact same frozen anchor and completed outcome"
echo "  V22 baseline is canonical Score/100 predictive signal; explicitly not calibrated probability or PnL"
echo "  V23 uses V23.11 calibrated probability when ready, otherwise V23.10 synthesis"
echo "  Brier, log-loss, threshold accuracy and paired wins are compared"
echo "  only 5m can produce a challenger verdict"
echo "  promotion eligibility requires >=50 paired 5m rows, >=10 positive, >=10 negative, and better Brier + log-loss"
echo "  promotionEligible is diagnostic only and never changes authority"
echo "  no Score/State/BUY/SELL mutation"
