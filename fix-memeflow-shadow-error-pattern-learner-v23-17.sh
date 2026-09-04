#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"

[[ -n "$ROOT" ]] || {
  echo "ERROR: run inside MEMEFLOW repo"
  exit 1
}

cd "$ROOT"

BRANCH="chart-debug-20260829-161234"
EXPECTED_HEAD="e66520f1a3c2f7935698d8c761f51b7c57add842"

APP="memeflow-app/app-server.mjs"
SHADOW="memeflow-app/src/token-intelligence-shadow-v23.mjs"
PKG="memeflow-app/package.json"
HTML="memeflow-app/owner-intelligence.html"
JS="memeflow-app/owner-intelligence.js"
CSS="memeflow-app/owner-intelligence.css"
LEARNER="memeflow-app/src/shadow-error-pattern-learner-v23_17.mjs"
TEST="memeflow-app/tests/shadow-error-pattern-learner-v23_17.mjs"

MODIFIED=("$APP" "$SHADOW" "$PKG" "$HTML" "$JS" "$CSS")
NEW_FILES=("$LEARNER" "$TEST")
ALL_FILES=("${MODIFIED[@]}" "${NEW_FILES[@]}")

echo "=== MEMEFLOW SHADOW ERROR PATTERN LEARNER V23.17 ==="

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
      echo "V23.17 REFUSED: active git process"
      echo "$active"
      exit 1
    fi

    rm -f .git/index.lock
  fi
}

clear_lock

[[ "$(git branch --show-current)" == "$BRANCH" ]] || {
  echo "V23.17 REFUSED: wrong branch"
  exit 1
}

[[ "$(git rev-parse HEAD)" == "$EXPECTED_HEAD" ]] || {
  echo "V23.17 REFUSED: audited HEAD changed"
  echo "expected: $EXPECTED_HEAD"
  echo "actual: $(git rev-parse HEAD)"
  exit 1
}

for f in "${MODIFIED[@]}"; do
  [[ -f "$f" ]] || {
    echo "V23.17 REFUSED: missing $f"
    exit 1
  }

  git diff --quiet -- "$f" || {
    echo "V23.17 REFUSED: local changes in $f"
    exit 1
  }

  git diff --cached --quiet -- "$f" || {
    echo "V23.17 REFUSED: staged changes in $f"
    exit 1
  }
done

for f in "${NEW_FILES[@]}"; do
  [[ ! -e "$f" ]] || {
    echo "V23.17 REFUSED: $f already exists"
    exit 1
  }
done

STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP=".memeflow-backups/shadow-error-pattern-learner-v23-17-$STAMP"

mkdir -p "$BACKUP"

for f in "${MODIFIED[@]}"; do
  mkdir -p "$BACKUP/$(dirname "$f")"
  cp "$f" "$BACKUP/$f"
done

rollback(){
  rc=$?

  if [[ $rc -ne 0 ]]; then
    echo
    echo "=== V23.17 FAILED - RESTORING ==="

    for f in "${MODIFIED[@]}"; do
      [[ -f "$BACKUP/$f" ]] &&
        cp "$BACKUP/$f" "$f" ||
        true
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

cat > "$LEARNER" <<'EOF_LEARNER'
import fs from 'node:fs';
import path from 'node:path';

// MEMEFLOW_SHADOW_ERROR_PATTERN_LEARNER_V23_17
//
// SHADOW ONLY.
//
// Learns recurring pre-outcome evidence combinations associated with
// V23.16 directional misses. Associations are NOT causal claims.
// Patterns are diagnostics only and never alter V22/V23 trading authority.
//
// Anti-overfit rules:
// - only directional hit/miss outcomes are learned
// - outcome-derived tags are excluded from pattern keys
// - only 1-way and 2-way combinations are considered
// - minimum support + minimum misses are required
// - empirical miss rates use Beta shrinkage toward global miss rate
// - a lower credible bound must still exceed baseline before maturity
//
// No Score/State/Settings/BUY/SELL mutation.

const TARGET_HORIZON_MS=300_000;
const PRIOR_STRENGTH=12;
const MIN_SUPPORT=12;
const MIN_MISSES=4;
const MIN_POSTERIOR_MISS_PCT=55;
const MIN_LIFT=1.25;
const MIN_LOWER_BOUND_EDGE_PCT=3;

const finite=value=>{
  if(value===null||value===undefined||value==='')return null;
  const n=Number(value);
  return Number.isFinite(n)?n:null;
};

const clamp=(value,min,max)=>
  Math.max(min,Math.min(max,Number(value)||0));

const round=(value,digits=2)=>{
  const n=finite(value);
  if(n===null)return null;
  const p=10**digits;
  return Math.round(n*p)/p;
};

const upper=value=>
  String(value||'UNKNOWN').trim().toUpperCase()||'UNKNOWN';

function confidenceBand(value){
  const n=finite(value);
  if(n===null)return 'UNKNOWN';
  if(n>=75)return 'HIGH';
  if(n>=50)return 'MEDIUM';
  if(n>=25)return 'LOW';
  return 'VERY_LOW';
}

function safeTag(value){
  return upper(value)
    .replace(/[^A-Z0-9_:-]+/g,'_')
    .replace(/^_+|_+$/g,'')
    .slice(0,96);
}

function isOutcomeDerivedTag(tag){
  const t=upper(tag);

  return [
    'HIGH_CONFIDENCE_MISS',
    'FALSE_POSITIVE',
    'FALSE_NEGATIVE',
    'TRUE_POSITIVE',
    'TRUE_NEGATIVE',
    'MISS',
    'HIT'
  ].some(
    forbidden=>
      t===forbidden ||
      t.startsWith(`${forbidden}_`)
  );
}

function evidenceTags(review={}){
  const tags=[];

  const raw=
    Array.isArray(review?.attributionTags)
      ? review.attributionTags
      : [];

  for(const item of raw){
    const tag=safeTag(item);

    if(
      tag &&
      !isOutcomeDerivedTag(tag)
    ){
      tags.push(tag);
    }
  }

  const regime=safeTag(review?.regimeAtAnchor);

  if(regime&&regime!=='UNKNOWN'){
    tags.push(`REGIME_${regime}`);
  }

  const stage=safeTag(review?.stageAtAnchor);

  if(stage&&stage!=='UNKNOWN'){
    tags.push(`STAGE_${stage}`);
  }

  const source=safeTag(review?.forecast?.source);

  if(
    source &&
    source!=='NONE' &&
    source!=='UNKNOWN'
  ){
    tags.push(`SOURCE_${source}`);
  }

  const predicted=safeTag(review?.forecast?.predictedClass);

  if(predicted&&predicted!=='UNKNOWN'){
    tags.push(`PREDICTED_${predicted}`);
  }

  const band=confidenceBand(review?.forecast?.confidencePct);

  if(band!=='UNKNOWN'){
    tags.push(`CONFIDENCE_${band}`);
  }

  return [...new Set(tags)]
    .sort()
    .slice(0,16);
}

function combinations(tags=[]){
  const out=[];

  for(let i=0;i<tags.length;i++){
    out.push([tags[i]]);

    for(let j=i+1;j<tags.length;j++){
      out.push([tags[i],tags[j]]);
    }
  }

  return out;
}

function readTailUtf8(file,maxBytes=20*1024*1024){
  try{
    if(!file||!fs.existsSync(file))return '';

    const st=fs.statSync(file);
    if(!(st.size>0))return '';

    if(st.size<=maxBytes){
      return fs.readFileSync(file,'utf8');
    }

    const fd=fs.openSync(file,'r');

    try{
      const buf=Buffer.allocUnsafe(maxBytes);

      fs.readSync(
        fd,
        buf,
        0,
        maxBytes,
        st.size-maxBytes
      );

      let text=buf.toString('utf8');
      const nl=text.indexOf('\n');

      if(nl>=0){
        text=text.slice(nl+1);
      }

      return text;
    }finally{
      fs.closeSync(fd);
    }
  }catch{
    return '';
  }
}

function betaPosterior({
  misses,
  support,
  baseRate
}){
  const alpha0=
    Math.max(
      0.001,
      baseRate*PRIOR_STRENGTH
    );

  const beta0=
    Math.max(
      0.001,
      (1-baseRate)*PRIOR_STRENGTH
    );

  const alpha=alpha0+misses;

  const beta=
    beta0+
    Math.max(
      0,
      support-misses
    );

  const total=alpha+beta;
  const mean=alpha/total;

  const variance=
    (alpha*beta)/
    (
      total*total*
      (total+1)
    );

  const sd=
    Math.sqrt(
      Math.max(0,variance)
    );

  const lower=
    clamp(
      mean-1.645*sd,
      0,
      1
    );

  return {
    mean,
    lower,
    alpha,
    beta
  };
}

export function createShadowErrorPatternLearnerV23_17({
  dataDir=null,
  maxRows=10_000
}={}){
  const file=
    dataDir
      ? path.join(
          dataDir,
          'shadow-error-pattern-learner-v23-17.jsonl'
        )
      : null;

  const rows=[];
  const seen=new Set();
  const queue=[];

  let draining=false;
  let rowsLoaded=0;
  let rowsWritten=0;
  let loadErrors=0;
  let writeErrors=0;
  let observed=0;
  let duplicates=0;

  if(file){
    try{
      fs.mkdirSync(
        path.dirname(file),
        {recursive:true}
      );
    }catch{}
  }

  function kick(){
    if(
      draining ||
      !queue.length ||
      !file
    ){
      return;
    }

    draining=true;

    setImmediate(async()=>{
      try{
        while(queue.length){
          const batch=queue.splice(0,200);

          await fs.promises.appendFile(
            file,
            batch
              .map(row=>JSON.stringify(row))
              .join('\n')+
              '\n',
            'utf8'
          );

          rowsWritten+=batch.length;
        }
      }catch{
        writeErrors++;
      }finally{
        draining=false;

        if(queue.length){
          kick();
        }
      }
    });
  }

  function append(row){
    if(!file)return;

    queue.push(row);

    if(queue.length>10_000){
      queue.splice(
        0,
        queue.length-10_000
      );
    }

    kick();
  }

  async function flush(){
    if(!file)return true;

    kick();
    const started=Date.now();

    while(draining||queue.length){
      if(Date.now()-started>5_000){
        return false;
      }

      await new Promise(
        resolve=>setTimeout(resolve,5)
      );
    }

    return true;
  }

  function add(row,{persist=false}={}){
    if(!row?.key||!row?.mint){
      return null;
    }

    if(seen.has(row.key)){
      duplicates++;
      return null;
    }

    seen.add(row.key);
    rows.push(row);

    const limit=
      Math.max(
        500,
        Number(maxRows)||10_000
      );

    if(rows.length>limit){
      rows.splice(
        0,
        rows.length-limit
      );
    }

    if(persist){
      append(row);
    }

    return row;
  }

  function load(){
    if(!file)return;

    const text=readTailUtf8(file);

    for(const line of text.split('\n')){
      if(!line.trim())continue;

      try{
        const row=JSON.parse(line);

        if(
          row?.type===
          'shadow-error-pattern-observation'
        ){
          if(
            add(
              row,
              {persist:false}
            )
          ){
            rowsLoaded++;
          }
        }
      }catch{
        loadErrors++;
      }
    }
  }

  function observeReview(review={}){
    const directional=
      review?.hit===true ||
      review?.miss===true;

    if(
      !review?.mint ||
      !directional ||
      !Number.isFinite(
        Number(review?.horizonMs)
      )
    ){
      return null;
    }

    const tags=evidenceTags(review);

    const row={
      type:'shadow-error-pattern-observation',
      version:'MEMEFLOW_SHADOW_ERROR_PATTERN_OBSERVATION_V23_17',
      shadowOnly:true,
      authority:'DIAGNOSTIC_ONLY',
      key:String(
        review?.key||
        [
          review.mint,
          review.anchorAt||0,
          review.horizonMs||0
        ].join(':')
      ),
      mint:String(review.mint),
      anchorAt:
        finite(review?.anchorAt),
      observedAt:
        finite(review?.observedAt),
      horizonMs:
        finite(review?.horizonMs),
      hit:
        review?.hit===true,
      miss:
        review?.miss===true,
      resultType:
        upper(review?.resultType),
      confidencePct:
        finite(review?.forecast?.confidencePct),
      tags,
      disclaimer:
        'PATTERN_ASSOCIATION_IS_NOT_CAUSAL_PROOF'
    };

    const added=
      add(
        row,
        {persist:true}
      );

    if(added){
      observed++;
    }

    return added;
  }

  function patternReport({
    horizonMs=TARGET_HORIZON_MS,
    limit=25,
    includeImmature=false
  }={}){
    const horizon=finite(horizonMs);

    const safeLimit=
      Math.max(
        1,
        Math.min(
          100,
          Number(limit)||25
        )
      );

    const source=
      rows.filter(
        row=>
          (row.hit===true||row.miss===true) &&
          (
            horizon===null ||
            Number(row.horizonMs)===
            Number(horizon)
          )
      );

    const total=source.length;

    const globalMisses=
      source.filter(
        row=>row.miss===true
      ).length;

    const baseRate=
      total
        ? globalMisses/total
        : 0;

    const buckets=new Map();

    for(const row of source){
      const tags=
        Array.isArray(row?.tags)
          ? row.tags
          : [];

      for(const combo of combinations(tags)){
        const key=combo.join(' + ');

        const prev=
          buckets.get(key)||
          {
            key,
            tags:combo,
            support:0,
            misses:0,
            hits:0,
            falsePositives:0,
            falseNegatives:0,
            highConfidenceMisses:0
          };

        prev.support++;

        if(row.miss===true){
          prev.misses++;

          if(row.resultType==='FALSE_POSITIVE'){
            prev.falsePositives++;
          }

          if(row.resultType==='FALSE_NEGATIVE'){
            prev.falseNegatives++;
          }

          if(Number(row.confidencePct)>=70){
            prev.highConfidenceMisses++;
          }
        }else{
          prev.hits++;
        }

        buckets.set(key,prev);
      }
    }

    const globalPosterior=
      betaPosterior({
        misses:globalMisses,
        support:Math.max(1,total),
        baseRate:
          total
            ? baseRate
            : 0.5
      });

    const baselinePct=
      total
        ? baseRate*100
        : null;

    const allPatterns=
      [...buckets.values()]
        .map(row=>{
          const posterior=
            betaPosterior({
              misses:row.misses,
              support:row.support,
              baseRate:
                total
                  ? baseRate
                  : 0.5
            });

          const posteriorPct=
            posterior.mean*100;

          const lowerPct=
            posterior.lower*100;

          const lift=
            total
              ? posterior.mean/
                Math.max(
                  0.01,
                  globalPosterior.mean
                )
              : null;

          const mature=
            row.support>=MIN_SUPPORT &&
            row.misses>=MIN_MISSES &&
            posteriorPct>=MIN_POSTERIOR_MISS_PCT &&
            lift!==null &&
            lift>=MIN_LIFT &&
            baselinePct!==null &&
            lowerPct>=
              baselinePct+
              MIN_LOWER_BOUND_EDGE_PCT;

          let severity='WATCH';

          if(mature){
            severity=
              row.support>=25 &&
              posteriorPct>=65 &&
              lift>=1.5
                ? 'HIGH'
                : 'MEDIUM';
          }

          return {
            patternId:
              row.key,
            tags:
              row.tags,
            support:
              row.support,
            misses:
              row.misses,
            hits:
              row.hits,
            rawMissRatePct:
              row.support
                ? round(
                    row.misses/
                    row.support*
                    100,
                    2
                  )
                : null,
            posteriorMissRatePct:
              round(
                posteriorPct,
                2
              ),
            lowerBoundMissRatePct:
              round(
                lowerPct,
                2
              ),
            baselineMissRatePct:
              baselinePct===null
                ? null
                : round(
                    baselinePct,
                    2
                  ),
            missLift:
              lift===null
                ? null
                : round(
                    lift,
                    3
                  ),
            falsePositives:
              row.falsePositives,
            falseNegatives:
              row.falseNegatives,
            highConfidenceMisses:
              row.highConfidenceMisses,
            mature,
            severity,
            disclaimer:
              'PATTERN_ASSOCIATION_IS_NOT_CAUSAL_PROOF'
          };
        });

    const matureTotal=
      allPatterns.filter(
        row=>row.mature===true
      ).length;

    const highRiskTotal=
      allPatterns.filter(
        row=>
          row.mature===true &&
          row.severity==='HIGH'
      ).length;

    const patterns=
      allPatterns
        .filter(
          row=>
            includeImmature===true ||
            row.mature===true
        )
        .sort(
          (a,b)=>
            Number(b.mature)-Number(a.mature) ||
            Number(b.missLift||0)-Number(a.missLift||0) ||
            Number(b.support||0)-Number(a.support||0)
        )
        .slice(0,safeLimit);

    return {
      version:'MEMEFLOW_SHADOW_ERROR_PATTERN_REPORT_V23_17',
      shadowOnly:true,
      authority:'DIAGNOSTIC_ONLY',
      autoCorrection:false,
      horizonMs:horizon,
      scoredRows:total,
      globalMisses,
      globalMissRatePct:
        baselinePct===null
          ? null
          : round(
              baselinePct,
              2
            ),
      maturePatterns:
        matureTotal,
      highRiskPatterns:
        highRiskTotal,
      patterns,
      policy:{
        priorStrength:PRIOR_STRENGTH,
        maxCombinationSize:2,
        minSupport:MIN_SUPPORT,
        minMisses:MIN_MISSES,
        minPosteriorMissRatePct:
          MIN_POSTERIOR_MISS_PCT,
        minLift:MIN_LIFT,
        minLowerBoundEdgePct:
          MIN_LOWER_BOUND_EDGE_PCT,
        outcomeDerivedTagsExcluded:true,
        causalClaims:false,
        autoCorrection:false
      }
    };
  }

  function status(){
    const target=
      patternReport({
        horizonMs:
          TARGET_HORIZON_MS,
        limit:100,
        includeImmature:false
      });

    return {
      version:'MEMEFLOW_SHADOW_ERROR_PATTERN_LEARNER_V23_17',
      shadowOnly:true,
      authority:'DIAGNOSTIC_ONLY',
      autoCorrection:false,
      targetHorizonMs:
        TARGET_HORIZON_MS,
      target:{
        scoredRows:
          target.scoredRows,
        globalMisses:
          target.globalMisses,
        globalMissRatePct:
          target.globalMissRatePct,
        maturePatterns:
          target.maturePatterns,
        highRiskPatterns:
          target.highRiskPatterns
      },
      rows:
        rows.length,
      observed,
      duplicates,
      rowsLoaded,
      rowsWritten,
      queued:
        queue.length,
      draining,
      loadErrors,
      writeErrors,
      file
    };
  }

  load();

  return {
    observeReview,
    patternReport,
    status,
    flush
  };
}

EOF_LEARNER

cat > "$TEST" <<'EOF_TEST'
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  createShadowErrorPatternLearnerV23_17
} from '../src/shadow-error-pattern-learner-v23_17.mjs';

const tmp=
  fs.mkdtempSync(
    path.join(
      os.tmpdir(),
      'mf-v23-17-'
    )
  );

function review({
  mint,
  at,
  miss,
  tags=[],
  resultType=null,
  confidence=80,
  horizonMs=300_000
}){
  return {
    key:`${mint}:${at}:${horizonMs}`,
    mint,
    anchorAt:at,
    observedAt:
      at+horizonMs,
    horizonMs,
    hit:miss!==true,
    miss:miss===true,
    resultType:
      resultType||
      (
        miss
          ? 'FALSE_POSITIVE'
          : 'TRUE_POSITIVE'
      ),
    stageAtAnchor:'DEEP',
    regimeAtAnchor:'EXPANSION',
    forecast:{
      source:'V23_11_CALIBRATED',
      predictedClass:'POSITIVE',
      confidencePct:confidence
    },
    attributionTags:tags
  };
}

try{
  const learner=
    createShadowErrorPatternLearnerV23_17({
      dataDir:tmp
    });

  const base=1_801_500_000_000;

  for(let i=0;i<20;i++){
    learner.observeReview(
      review({
        mint:`RISK_${i}`,
        at:base+i*1000,
        miss:i<16,
        tags:[
          'HIGH_MODEL_DISAGREEMENT',
          'TRAJECTORY_FADING',
          ...(i<16
            ? ['HIGH_CONFIDENCE_MISS']
            : [])
        ],
        resultType:
          i<16
            ? 'FALSE_POSITIVE'
            : 'TRUE_POSITIVE'
      })
    );
  }

  for(let i=0;i<30;i++){
    learner.observeReview(
      review({
        mint:`BASE_${i}`,
        at:base+100_000+i*1000,
        miss:i<3,
        tags:['DATA_OK'],
        resultType:
          i<3
            ? 'FALSE_POSITIVE'
            : 'TRUE_POSITIVE',
        confidence:60
      })
    );
  }

  const report=
    learner.patternReport({
      horizonMs:300_000,
      limit:100
    });

  assert.equal(
    report.scoredRows,
    50
  );

  assert.ok(
    report.globalMissRatePct>0
  );

  const pair=
    report.patterns.find(
      row=>
        row.tags.includes(
          'HIGH_MODEL_DISAGREEMENT'
        ) &&
        row.tags.includes(
          'TRAJECTORY_FADING'
        )
    );

  assert.ok(pair);
  assert.equal(
    pair.mature,
    true
  );
  assert.ok(
    pair.support>=20
  );
  assert.ok(
    pair.missLift>=1.25
  );

  assert.ok(
    report.patterns.every(
      row=>
        !row.tags.includes(
          'HIGH_CONFIDENCE_MISS'
        )
    )
  );

  assert.equal(
    report.autoCorrection,
    false
  );

  assert.equal(
    report.policy.maxCombinationSize,
    2
  );

  assert.equal(
    await learner.flush(),
    true
  );

  const restored=
    createShadowErrorPatternLearnerV23_17({
      dataDir:tmp
    });

  assert.equal(
    restored.status().rowsLoaded,
    50
  );

  const source=
    fs.readFileSync(
      'src/shadow-error-pattern-learner-v23_17.mjs',
      'utf8'
    );

  assert.doesNotMatch(
    source,
    /from ['"]\.\/evaluate\.mjs['"]/
  );

  assert.doesNotMatch(
    source,
    /openPosition\s*\(/
  );

  assert.doesNotMatch(
    source,
    /closePosition\s*\(/
  );

  assert.doesNotMatch(
    source,
    /setSettings\s*\(/
  );

  assert.doesNotMatch(
    source,
    /tradeEligible/
  );

  assert.doesNotMatch(
    source,
    /decisionScore/
  );

  const shadow=
    fs.readFileSync(
      'src/token-intelligence-shadow-v23.mjs',
      'utf8'
    );

  const app=
    fs.readFileSync(
      'app-server.mjs',
      'utf8'
    );

  const html=
    fs.readFileSync(
      'owner-intelligence.html',
      'utf8'
    );

  const js=
    fs.readFileSync(
      'owner-intelligence.js',
      'utf8'
    );

  assert.match(
    shadow,
    /createShadowErrorPatternLearnerV23_17/
  );

  assert.match(
    shadow,
    /shadowErrorPatternLearner\.observeReview/
  );

  assert.match(
    shadow,
    /errorPatternLearnerStatus/
  );

  assert.match(
    app,
    /\/api\/owner\/intelligence\/error-patterns/
  );

  assert.match(
    html,
    /id="errorPatternList"/
  );

  assert.match(
    js,
    /loadErrorPatterns/
  );

  console.log(
    'shadow error pattern learner v23.17 ok'
  );
}finally{
  fs.rmSync(
    tmp,
    {
      recursive:true,
      force:true
    }
  );
}

EOF_TEST

python3 - <<'PY'
from pathlib import Path

sp=Path("memeflow-app/src/token-intelligence-shadow-v23.mjs")
ap=Path("memeflow-app/app-server.mjs")
hp=Path("memeflow-app/owner-intelligence.html")
jp=Path("memeflow-app/owner-intelligence.js")
cp=Path("memeflow-app/owner-intelligence.css")

s=sp.read_text(encoding="utf-8")
a=ap.read_text(encoding="utf-8")
h=hp.read_text(encoding="utf-8")
j=jp.read_text(encoding="utf-8")
c=cp.read_text(encoding="utf-8")

def once(text,old,new,label):
    n=text.count(old)

    if n!=1:
        raise SystemExit(
            f"V23.17 REFUSED: {label}: expected 1 exact match, got {n}"
        )

    return text.replace(old,new,1)

old="""import {
  createShadowOutcomeReviewV23_16
} from './shadow-outcome-review-v23_16.mjs';"""

s=once(
    s,
    old,
    old+"""
import {
  createShadowErrorPatternLearnerV23_17
} from './shadow-error-pattern-learner-v23_17.mjs';""",
    "error pattern import"
)

old="""  const shadowOutcomeReview=
    createShadowOutcomeReviewV23_16({
      dataDir
    });"""

s=once(
    s,
    old,
    old+"""

  const shadowErrorPatternLearner=
    createShadowErrorPatternLearnerV23_17({
      dataDir
    });""",
    "error pattern construction"
)

old="""        shadowOutcomeReview.recordOutcome({
          anchor:cell.anchor,
          outcome
        });
"""

s=once(
    s,
    old,
    """        const outcomeReview=
          shadowOutcomeReview.recordOutcome({
            anchor:cell.anchor,
            outcome
          });

        if(outcomeReview){
          shadowErrorPatternLearner.observeReview(
            outcomeReview
          );
        }
""",
    "error pattern observation"
)

s=once(
    s,
    "version:'MEMEFLOW_TOKEN_INTELLIGENCE_NETWORK_V23_16'",
    "version:'MEMEFLOW_TOKEN_INTELLIGENCE_NETWORK_V23_17'",
    "network version"
)

old="""      tokenIntelligenceScorecard:tokenIntelligenceScorecard.status(),
      shadowOutcomeReview:shadowOutcomeReview.status()
"""

s=once(
    s,
    old,
    """      tokenIntelligenceScorecard:tokenIntelligenceScorecard.status(),
      shadowOutcomeReview:shadowOutcomeReview.status(),
      shadowErrorPatternLearner:shadowErrorPatternLearner.status()
""",
    "error pattern status"
)

old="""    flushOutcomeReviews:
      ()=>shadowOutcomeReview.flush(),
    status
"""

s=once(
    s,
    old,
    """    flushOutcomeReviews:
      ()=>shadowOutcomeReview.flush(),
    errorPatternLearnerStatus:
      ()=>shadowErrorPatternLearner.status(),
    errorPatternReport:
      options=>shadowErrorPatternLearner.patternReport(options),
    flushErrorPatternLearner:
      ()=>shadowErrorPatternLearner.flush(),
    status
""",
    "error pattern API"
)

sp.write_text(s,encoding="utf-8")

anchor="""/* MEMEFLOW_PUBLIC_AGENT_ENTITY_V2_ROUTES */
"""

route=r"""/* MEMEFLOW_SHADOW_ERROR_PATTERN_LEARNER_MONITOR_V23_17
 * Owner-only, read-only recurring miss association diagnostics.
 * Patterns are not causal claims and never auto-correct trading.
 */
 if(
   url.pathname==='/api/owner/intelligence/error-patterns' &&
   req.method==='GET'
 ){
   if(!u)return json(res,401,{error:'AUTH_REQUIRED'});
   if(u.isOwner!==true)return json(res,403,{error:'OWNER_REQUIRED'});

   const limit=Math.max(
     1,
     Math.min(
       100,
       Number(
         url.searchParams.get('limit')||25
       )
     )
   );

   const horizonMs=Math.max(
     1,
     Number(
       url.searchParams.get('horizonMs')||300000
     )
   );

   const includeImmature=
     String(
       url.searchParams.get('includeImmature')||''
     ).toLowerCase()==='true';

   return json(res,200,{
     ok:true,
     owner:true,
     shadowOnly:true,
     causalClaims:false,
     autoCorrection:false,
     status:
       tokenIntelligenceShadowV23
         .errorPatternLearnerStatus(),
     report:
       tokenIntelligenceShadowV23
         .errorPatternReport({
           horizonMs,
           limit,
           includeImmature
         })
   });
 }

/* MEMEFLOW_PUBLIC_AGENT_ENTITY_V2_ROUTES */
"""

a=once(
    a,
    anchor,
    route,
    "error pattern owner route"
)

ap.write_text(a,encoding="utf-8")

html_anchor="""      <!-- MEMEFLOW_PLATFORM_LEARNING_V2_UI -->
"""

html_block=r"""      <!-- MEMEFLOW_SHADOW_ERROR_PATTERN_LEARNER_V23_17_UI -->
      <section
        id="errorPatternMonitor"
        class="oi-panel oi-error-pattern-monitor"
      >
        <div class="oi-panel-head">
          <div>
            <span class="oi-eyebrow">
              RECURRING MISS STRUCTURE · SHADOW
            </span>
            <h2>V23 Error Pattern Learner</h2>
            <p>
              Finds repeated pre-outcome evidence combinations that
              occur disproportionately in V23 misses. Bayesian
              shrinkage and minimum support reduce fake certainty.
              Associations are not causal proof.
            </p>
          </div>

          <span
            id="errorPatternStatus"
            class="oi-ai-status"
          >
            LOADING
          </span>
        </div>

        <div class="oi-grid oi-grid-4">
          <article class="oi-stat">
            <span>SCORED 5M</span>
            <strong id="errorPatternScored">—</strong>
            <small>hit + miss observations</small>
          </article>

          <article class="oi-stat">
            <span>BASE MISS RATE</span>
            <strong id="errorPatternBaseline">—</strong>
            <small>all directional 5m rows</small>
          </article>

          <article class="oi-stat">
            <span>MATURE PATTERNS</span>
            <strong id="errorPatternMature">—</strong>
            <small>support + Bayesian gate</small>
          </article>

          <article class="oi-stat">
            <span>HIGH RISK</span>
            <strong id="errorPatternHigh">—</strong>
            <small>strongest recurring associations</small>
          </article>
        </div>

        <div class="oi-divider"></div>

        <div class="oi-promotion-check-head">
          <h3>Top recurring miss associations</h3>
          <span>diagnostic only · no auto-correction</span>
        </div>

        <div
          id="errorPatternList"
          class="oi-error-pattern-list"
        ></div>
      </section>

      <!-- MEMEFLOW_PLATFORM_LEARNING_V2_UI -->
"""

h=once(
    h,
    html_anchor,
    html_block,
    "error pattern UI"
)

hp.write_text(h,encoding="utf-8")

js_anchor="""/* MEMEFLOW_SHADOW_PROMOTION_REPORT_V23_14_UI_JS */
"""

js_block=r"""/* MEMEFLOW_SHADOW_ERROR_PATTERN_LEARNER_V23_17_UI_JS */
function renderErrorPatterns(payload={}){
  const report=payload?.report||{};
  const patterns=
    Array.isArray(report?.patterns)
      ? report.patterns
      : [];

  const badge=$('errorPatternStatus');

  if(badge){
    badge.className=
      'oi-ai-status '+
      (
        Number(report?.maturePatterns||0)>0
          ? 'online'
          : ''
      );

    badge.textContent=
      Number(report?.scoredRows||0)>=12
        ? 'LEARNING'
        : 'COLD START';
  }

  $('errorPatternScored').textContent=
    num(report?.scoredRows,0);

  $('errorPatternBaseline').textContent=
    pct(report?.globalMissRatePct);

  $('errorPatternMature').textContent=
    num(report?.maturePatterns,0);

  $('errorPatternHigh').textContent=
    num(report?.highRiskPatterns,0);

  $('errorPatternList').innerHTML=
    patterns.length
      ? patterns.slice(0,20).map(row=>`
          <div
            class="oi-error-pattern-row ${String(row?.severity||'watch').toLowerCase()}"
          >
            <div class="oi-error-pattern-head">
              <div class="oi-error-pattern-tags">
                ${
                  (Array.isArray(row?.tags)?row.tags:[])
                    .map(tag=>`
                      <span>
                        ${esc(String(tag).replaceAll('_',' '))}
                      </span>
                    `)
                    .join('')
                }
              </div>

              <strong>
                ${esc(String(row?.severity||'WATCH'))}
              </strong>
            </div>

            <div class="oi-error-pattern-metrics">
              <span>
                support ${num(row?.support,0)}
              </span>
              <span>
                misses ${num(row?.misses,0)}
              </span>
              <span>
                posterior ${pct(row?.posteriorMissRatePct)}
              </span>
              <span>
                lower bound ${pct(row?.lowerBoundMissRatePct)}
              </span>
              <span>
                lift ${Number.isFinite(Number(row?.missLift))
                  ? `${num(row.missLift,2)}×`
                  : '—'}
              </span>
              <span>
                FP/FN ${num(row?.falsePositives,0)} / ${num(row?.falseNegatives,0)}
              </span>
            </div>
          </div>
        `).join('')
      : `
          <div class="oi-empty">
            No mature recurring error patterns yet.
            V23.17 needs repeated directional 5m outcomes before
            declaring an association mature.
          </div>
        `;
}

async function loadErrorPatterns(){
  try{
    const payload=await api(
      '/api/owner/intelligence/error-patterns?limit=25&horizonMs=300000'
    );

    renderErrorPatterns(payload);
  }catch(error){
    const badge=$('errorPatternStatus');

    if(badge){
      badge.className='oi-ai-status offline';
      badge.textContent='UNAVAILABLE';
    }

    const list=$('errorPatternList');

    if(list){
      list.innerHTML=`
        <div class="oi-empty">
          ${esc(error.message)}
        </div>
      `;
    }
  }
}

/* MEMEFLOW_SHADOW_PROMOTION_REPORT_V23_14_UI_JS */
"""

j=once(
    j,
    js_anchor,
    js_block,
    "error pattern UI JS"
)

old="""    await Promise.all([
      loadPromotionReport(),
      loadTokenScorecards(),
      loadOutcomeReviews()
    ]);
"""

j=once(
    j,
    old,
    """    await Promise.all([
      loadPromotionReport(),
      loadTokenScorecards(),
      loadOutcomeReviews(),
      loadErrorPatterns()
    ]);
""",
    "error pattern load"
)

jp.write_text(j,encoding="utf-8")

css_anchor="""/* ==========================================================
   MEMEFLOW_SHADOW_PROMOTION_REPORT_V23_14
   ========================================================== */
"""

css_block=r"""/* ==========================================================
   MEMEFLOW_SHADOW_ERROR_PATTERN_LEARNER_V23_17
   ========================================================== */

.oi-error-pattern-list{
  display:grid;
  gap:8px;
  margin-top:9px;
}

.oi-error-pattern-row{
  padding:10px 11px;
  border:1px solid rgba(38,56,69,.68);
  border-radius:11px;
  background:rgba(255,255,255,.012);
}

.oi-error-pattern-row.medium{
  border-color:rgba(239,200,106,.24);
}

.oi-error-pattern-row.high{
  border-color:rgba(255,104,120,.28);
  background:rgba(255,104,120,.025);
}

.oi-error-pattern-head{
  display:flex;
  align-items:flex-start;
  justify-content:space-between;
  gap:10px;
}

.oi-error-pattern-head>strong{
  color:var(--muted);
  font-size:var(--mf-type-micro);
}

.oi-error-pattern-row.medium
.oi-error-pattern-head>strong{
  color:var(--amber);
}

.oi-error-pattern-row.high
.oi-error-pattern-head>strong{
  color:#ff9daa;
}

.oi-error-pattern-tags{
  display:flex;
  flex-wrap:wrap;
  gap:5px;
}

.oi-error-pattern-tags span{
  padding:4px 6px;
  border:1px solid rgba(87,220,255,.16);
  border-radius:999px;
  color:#9fdff0;
  font-size:var(--mf-type-micro);
  font-weight:800;
}

.oi-error-pattern-metrics{
  display:flex;
  flex-wrap:wrap;
  gap:10px;
  margin-top:8px;
  color:var(--muted);
  font-size:var(--mf-type-micro);
}

/* ==========================================================
   MEMEFLOW_SHADOW_PROMOTION_REPORT_V23_14
   ========================================================== */
"""

c=once(
    c,
    css_anchor,
    css_block,
    "error pattern CSS"
)

cp.write_text(c,encoding="utf-8")

print("V23_17_TRANSFORM_OK")

PY

python3 - <<'PY'
import json
from pathlib import Path

p=Path("memeflow-app/package.json")
d=json.loads(p.read_text(encoding="utf-8"))
s=d["scripts"]["test:core"]

needle="node tests/shadow-outcome-review-v23_16.mjs && node tests/assist-fresh-decision-v22.mjs"
replacement="node tests/shadow-outcome-review-v23_16.mjs && node tests/shadow-error-pattern-learner-v23_17.mjs && node tests/assist-fresh-decision-v22.mjs"

if s.count(needle)!=1:
    raise SystemExit(
        "V23.17 REFUSED: package test anchor changed"
    )

if "shadow-error-pattern-learner-v23_17.mjs" in s:
    raise SystemExit(
        "V23.17 REFUSED: error learner test already installed"
    )

d["scripts"]["test:core"]=s.replace(
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

python3 - <<'PY'
from pathlib import Path

for name in [
 "memeflow-app/app-server.mjs",
 "memeflow-app/src/token-intelligence-shadow-v23.mjs",
 "memeflow-app/package.json",
 "memeflow-app/owner-intelligence.html",
 "memeflow-app/owner-intelligence.js",
 "memeflow-app/owner-intelligence.css",
 "memeflow-app/src/shadow-error-pattern-learner-v23_17.mjs",
 "memeflow-app/tests/shadow-error-pattern-learner-v23_17.mjs"
]:
    p=Path(name)

    p.write_text(
        p.read_text(encoding="utf-8").rstrip("\n")+"\n",
        encoding="utf-8"
    )

print("V23_17_EOF_NORMALIZATION_OK")
PY

echo
echo "=== V23.17 SYNTAX ==="

node --check "$APP"
node --check "$SHADOW"
node --check "$LEARNER"
node --check "$TEST"
node --check "$JS"

node -e "JSON.parse(require('fs').readFileSync('$PKG','utf8')); console.log('PACKAGE_JSON_OK')"

echo "SYNTAX_OK"

echo
echo "=== V23.17 TARGETED TESTS ==="

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
  node tests/shadow-promotion-gate-v23_13.mjs
  node tests/shadow-promotion-report-v23_14.mjs
  node tests/token-intelligence-scorecard-v23_15.mjs
  node tests/shadow-outcome-review-v23_16.mjs
  node tests/shadow-error-pattern-learner-v23_17.mjs
  node tests/lifecycle-decision-v22.mjs
  node tests/assist-fresh-decision-v22.mjs
)

echo "TARGETED_TESTS_OK"

echo
echo "=== V23.17 FULL PROJECT TEST SUITE ==="

(
  cd memeflow-app
  npm test
)

echo "FULL_TEST_SUITE_OK"

echo
echo "=== V23.17 STATIC CONTRACT AUDIT ==="

python3 - <<'PY'
from pathlib import Path

m=Path(
 "memeflow-app/src/shadow-error-pattern-learner-v23_17.mjs"
).read_text()

s=Path(
 "memeflow-app/src/token-intelligence-shadow-v23.mjs"
).read_text()

a=Path(
 "memeflow-app/app-server.mjs"
).read_text()

h=Path(
 "memeflow-app/owner-intelligence.html"
).read_text()

j=Path(
 "memeflow-app/owner-intelligence.js"
).read_text()

c=Path(
 "memeflow-app/owner-intelligence.css"
).read_text()

p=Path(
 "memeflow-app/package.json"
).read_text()

errors=[]

for x in [
 "MEMEFLOW_SHADOW_ERROR_PATTERN_LEARNER_V23_17",
 "PATTERN_ASSOCIATION_IS_NOT_CAUSAL_PROOF",
 "autoCorrection:false",
 "PRIOR_STRENGTH=12",
 "MIN_SUPPORT=12",
 "MIN_MISSES=4",
 "MIN_LIFT=1.25",
 "maxCombinationSize:2",
 "outcomeDerivedTagsExcluded:true",
 "shadow-error-pattern-learner-v23-17.jsonl"
]:
    if x not in m:
        errors.append("learner marker missing: "+x)

for x in [
 "from './evaluate.mjs'",
 "openPosition(",
 "closePosition(",
 "setSettings(",
 "tradeEligible",
 "decisionScore"
]:
    if x in m:
        errors.append("forbidden authority: "+x)

for x in [
 "createShadowErrorPatternLearnerV23_17",
 "shadowErrorPatternLearner.observeReview",
 "shadowErrorPatternLearner:shadowErrorPatternLearner.status()",
 "errorPatternLearnerStatus",
 "errorPatternReport",
 "MEMEFLOW_TOKEN_INTELLIGENCE_NETWORK_V23_17"
]:
    if x not in s:
        errors.append("wiring missing: "+x)

for x in [
 "/api/owner/intelligence/error-patterns",
 "autoCorrection:false",
 "causalClaims:false"
]:
    if x not in a:
        errors.append("route missing: "+x)

for x in [
 'id="errorPatternList"',
 'id="errorPatternScored"',
 'id="errorPatternBaseline"',
 'id="errorPatternMature"',
 'id="errorPatternHigh"'
]:
    if x not in h:
        errors.append("UI missing: "+x)

for x in [
 "loadErrorPatterns",
 "renderErrorPatterns",
 "/api/owner/intelligence/error-patterns"
]:
    if x not in j:
        errors.append("UI JS missing: "+x)

for x in [
 ".oi-error-pattern-list",
 ".oi-error-pattern-row",
 ".oi-error-pattern-tags",
 ".oi-error-pattern-metrics"
]:
    if x not in c:
        errors.append("UI CSS missing: "+x)

if "shadow-error-pattern-learner-v23_17.mjs" not in p:
    errors.append("V23.17 test missing from package")

for x in [
 "shadowMathBrain.predict",
 "shadowModelArena.predict",
 "shadowDriftRegime.predict",
 "shadowConfidenceGovernor.predict",
 "shadowTokenTrajectory.observe",
 "shadowTokenPatternMemory.predict",
 "shadowEvidenceSynthesis.predict",
 "shadowOutcomeCalibration.predict",
 "shadowChampionBenchmark.recordOutcome",
 "shadowPromotionGate.status",
 "shadowPromotionReport.status",
 "tokenIntelligenceScorecard.status",
 "shadowOutcomeReview.recordOutcome"
]:
    if x not in s:
        errors.append("backward compatibility missing: "+x)

if errors:
    raise SystemExit(
        "V23_17_CONTRACT_FAILED:\n- "+
        "\n- ".join(errors)
    )

print("V23_17_CONTRACT_OK")

PY

git diff --check -- "${ALL_FILES[@]}"

echo
echo "=== V23.17 DIFF ==="

git diff --stat -- "${ALL_FILES[@]}"

clear_lock
git reset >/dev/null
clear_lock
git add "${ALL_FILES[@]}"

ALLOWED_RE='^memeflow-app/(app-server\.mjs|package\.json|owner-intelligence\.html|owner-intelligence\.js|owner-intelligence\.css|src/token-intelligence-shadow-v23\.mjs|src/shadow-error-pattern-learner-v23_17\.mjs|tests/shadow-error-pattern-learner-v23_17\.mjs)$'

BAD="$(
  git diff --cached --name-only |
  grep -Ev "$ALLOWED_RE" ||
  true
)"

if [[ -n "$BAD" ]]; then
  echo "V23.17 REFUSED: unrelated staged files:"
  echo "$BAD"
  git reset
  exit 1
fi

git diff --cached --check

echo
echo "=== V23.17 STAGED ==="

git diff --cached --stat

git commit -m "feat: add shadow recurring error pattern learner v23.17"

git push origin HEAD

trap - EXIT INT TERM

echo
echo "=== DONE ==="

echo "Backup: $BACKUP"

git log -1 --oneline --decorate

echo
echo "V23.17 CONTRACT:"
echo "  learns recurring PRE-OUTCOME evidence associations from completed directional outcomes"
echo "  outcome-derived tags are excluded from pattern keys"
echo "  only single factors and factor pairs are considered"
echo "  Beta shrinkage + support/miss/lift/lower-bound gates reduce overfit"
echo "  associations are explicitly NOT causal proof"
echo "  no automatic model correction or promotion"
echo "  V22 remains the only trading authority"
echo "  no Score/State/BUY/SELL mutation"
