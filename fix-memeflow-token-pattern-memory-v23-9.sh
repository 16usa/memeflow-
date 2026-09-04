#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
[[ -n "$ROOT" ]] || { echo "ERROR: run inside MEMEFLOW repo"; exit 1; }
cd "$ROOT"

BRANCH="chart-debug-20260829-161234"
EXPECTED_HEAD="f54661614b82a36f8ed24b3b93c6977c322c86e2"
APP="memeflow-app/app-server.mjs"
SHADOW="memeflow-app/src/token-intelligence-shadow-v23.mjs"
PKG="memeflow-app/package.json"
PATTERN="memeflow-app/src/shadow-token-pattern-memory-v23_9.mjs"
TEST="memeflow-app/tests/shadow-token-pattern-memory-v23_9.mjs"
MODIFIED=("$APP" "$SHADOW" "$PKG")
NEW_FILES=("$PATTERN" "$TEST")
ALL_FILES=("${MODIFIED[@]}" "${NEW_FILES[@]}")

echo "=== MEMEFLOW TOKEN PATTERN MEMORY V23.9 ==="

clear_lock(){
  if [[ -e .git/index.lock ]]; then
    if pgrep -f '[g]it' >/dev/null 2>&1; then
      echo "V23.9 REFUSED: active git process with index.lock"
      exit 1
    fi
    rm -f .git/index.lock
  fi
}

clear_lock

[[ "$(git branch --show-current)" == "$BRANCH" ]] || {
  echo "V23.9 REFUSED: wrong branch"; exit 1;
}
[[ "$(git rev-parse HEAD)" == "$EXPECTED_HEAD" ]] || {
  echo "V23.9 REFUSED: audited HEAD changed"
  echo "expected: $EXPECTED_HEAD"
  echo "actual: $(git rev-parse HEAD)"
  exit 1
}

for f in "${MODIFIED[@]}"; do
  [[ -f "$f" ]] || { echo "missing $f"; exit 1; }
  git diff --quiet -- "$f" || { echo "local changes in $f"; exit 1; }
  git diff --cached --quiet -- "$f" || { echo "staged changes in $f"; exit 1; }
done
for f in "${NEW_FILES[@]}"; do
  [[ ! -e "$f" ]] || { echo "$f already exists"; exit 1; }
done

STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP=".memeflow-backups/token-pattern-memory-v23-9-$STAMP"
mkdir -p "$BACKUP"
for f in "${MODIFIED[@]}"; do
  mkdir -p "$BACKUP/$(dirname "$f")"
  cp "$f" "$BACKUP/$f"
done

rollback(){
  rc=$?
  if [[ $rc -ne 0 ]]; then
    echo "=== V23.9 FAILED - RESTORING ==="
    for f in "${MODIFIED[@]}"; do
      [[ -f "$BACKUP/$f" ]] && cp "$BACKUP/$f" "$f" || true
    done
    for f in "${NEW_FILES[@]}"; do rm -f "$f"; done
    git reset -- "${ALL_FILES[@]}" >/dev/null 2>&1 || true
    echo "ROLLBACK_COMPLETE; backup: $BACKUP"
  fi
  exit "$rc"
}
trap rollback EXIT INT TERM

cat > "$PATTERN" <<'EOF_PATTERN'
import fs from 'node:fs';
import path from 'node:path';

// MEMEFLOW_TOKEN_PATTERN_MEMORY_V23_9
// SHADOW ONLY. No Score/State/settings/BUY/SELL authority.

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
  const r=finite(outcome.returnPct);
  const mfe=finite(outcome.maxFavorableExcursionPct);
  const mae=finite(outcome.maxAdverseExcursionPct);
  if((r!==null&&r>=20)||(mfe!==null&&mfe>=50&&(mae===null||mae>-25)))return 'POSITIVE';
  if((r!==null&&r<=-20)||(mae!==null&&mae<=-25))return 'NEGATIVE';
  return 'NEUTRAL';
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
    }finally{fs.closeSync(fd);}
  }catch{return '';}
}

function signature(snapshot={}){
  const g=snapshot?.shadowConfidenceGovernor||{};
  const t=snapshot?.shadowTokenTrajectory||{};
  const sm=snapshot?.specialists?.smartMoneyMemory||{};
  const w15=snapshot?.windows?.['15000']||{};
  return {
    trajectoryState:upper(t.trajectoryState),
    regime:upper(snapshot?.evidence?.regime),
    driftStatus:upper(snapshot?.shadowDriftRegime?.driftStatus),
    probability:finite(g.consensusProbabilityPositivePct),
    confidence:finite(g.ensembleConfidencePct),
    disagreement:finite(g.disagreementPct),
    probabilityDelta:finite(t.probabilityDeltaWindow),
    confidenceDelta:finite(t.confidenceDeltaWindow),
    netFlow:finite(snapshot?.evidence?.flowAcceleration?.netFlow5s),
    priceReturn:finite(w15?.price?.returnPct),
    smartMoney:finite(sm.weightedPositiveProbabilityPct),
    completeness:finite(snapshot?.evidence?.dataQuality?.completenessPct),
    coordinated:snapshot?.specialists?.coordination?.suspectedCoordination===true
  };
}

const scales={
  probability:30,confidence:30,disagreement:20,
  probabilityDelta:20,confidenceDelta:20,
  netFlow:0.75,priceReturn:35,smartMoney:30,completeness:30
};

function distance(a={},b={}){
  let cost=0,weight=0,seen=0;
  for(const [k,scale] of Object.entries(scales)){
    const x=finite(a[k]),y=finite(b[k]);
    weight+=1;
    if(x===null&&y===null)continue;
    if(x===null||y===null){cost+=0.35;continue;}
    cost+=Math.min(2,Math.abs(x-y)/scale);
    seen++;
  }
  const cat=(same,penalty,w=1)=>{
    cost+=(same?0:penalty)*w;
    weight+=w;
  };
  cat(upper(a.trajectoryState)===upper(b.trajectoryState),0.80,1.4);
  cat(upper(a.regime)===upper(b.regime),0.55,1);
  cat(upper(a.driftStatus)===upper(b.driftStatus),0.70,1);
  cat(a.coordinated===b.coordinated,0.70,0.8);
  return {
    d:weight?cost/weight:Infinity,
    coveragePct:seen/Object.keys(scales).length*100
  };
}

const similarity=d=>clamp(Math.exp(-2.2*d),0,1);

export function createShadowTokenPatternMemoryV23_9({
  dataDir=null,
  maxExamples=5000,
  topK=25,
  minimumExamples=12,
  minimumSimilarity=0.22
}={}){
  const file=dataDir?path.join(dataDir,'token-pattern-memory-v23-9.jsonl'):null;
  const examples=[],recent=[],queue=[];
  let draining=false,rowsLoaded=0,rowsWritten=0,loadErrors=0,writeErrors=0,predictions=0,outcomesRecorded=0,duplicatesRejected=0;

  if(file){try{fs.mkdirSync(path.dirname(file),{recursive:true});}catch{}}

  function kick(){
    if(draining||!queue.length||!file)return;
    draining=true;
    setImmediate(async()=>{
      try{
        while(queue.length){
          const batch=queue.splice(0,200);
          await fs.promises.appendFile(file,batch.map(JSON.stringify).join('\n')+'\n','utf8');
          rowsWritten+=batch.length;
        }
      }catch{writeErrors++;}
      finally{draining=false;if(queue.length)kick();}
    });
  }

  function append(row){
    if(!file)return;
    queue.push(row);
    if(queue.length>10000)queue.splice(0,queue.length-10000);
    kick();
  }

  async function flush(){
    if(!file)return true;
    kick();
    const started=Date.now();
    while(draining||queue.length){
      if(Date.now()-started>5000)return false;
      await new Promise(r=>setTimeout(r,5));
    }
    return true;
  }

  function addExample(raw,{persist=false}={}){
    const mint=String(raw?.mint||'');
    const anchorAt=Number(raw?.anchorAt||0);
    const horizonMs=Number(raw?.horizonMs||0);
    const classification=upper(raw?.classification);
    if(!mint||!(anchorAt>0)||horizonMs!==TARGET_HORIZON_MS)return null;
    if(!['POSITIVE','NEGATIVE'].includes(classification))return null;
    const key=`${mint}:${anchorAt}:${horizonMs}`;
    if(examples.some(x=>x.key===key)){duplicatesRejected++;return null;}
    const row={
      type:'pattern-example',
      version:'MEMEFLOW_TOKEN_PATTERN_EXAMPLE_V23_9',
      shadowOnly:true,key,mint,anchorAt,
      observedAt:Number(raw?.observedAt||0)||null,
      horizonMs,classification,signature:raw?.signature||{}
    };
    examples.push(row);
    const limit=Math.max(100,Number(maxExamples)||5000);
    if(examples.length>limit)examples.splice(0,examples.length-limit);
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
        if(row?.type==='pattern-example'){
          const n=examples.length;
          addExample(row,{persist:false});
          if(examples.length>n)rowsLoaded++;
        }
      }catch{loadErrors++;}
    }
  }

  function remember(row){
    recent.unshift(row);
    if(recent.length>200)recent.length=200;
  }

  function predict(snapshot={},meta={}){
    const mint=String(meta?.mint||snapshot?.mint||'');
    const now=Number(meta?.at||snapshot?.observedAt||Date.now());
    try{
      const sig=signature(snapshot);
      const eligible=examples.filter(row=>
        row.mint!==mint &&
        (!row.observedAt||Number(row.observedAt)<now)
      );

      if(eligible.length<Math.max(2,Number(minimumExamples)||12)){
        const row={
          version:'MEMEFLOW_TOKEN_PATTERN_MEMORY_V23_9',shadowOnly:true,
          status:'PATTERN_COLD_START',ready:false,historicalExamples:eligible.length,
          neighbourCount:0,patternProbabilityPositivePct:null,matchConfidencePct:0,
          meanSimilarityPct:0,nearestSimilarityPct:null,currentTrajectoryState:sig.trajectoryState,
          currentRegime:sig.regime,neighbours:[],mint:mint||null,observedAt:now
        };
        remember(row);return row;
      }

      const ranked=eligible.map(row=>{
        const m=distance(sig,row.signature);
        return {row,similarity:similarity(m.d),coveragePct:m.coveragePct};
      }).filter(x=>x.similarity>=Number(minimumSimilarity))
        .sort((a,b)=>b.similarity-a.similarity)
        .slice(0,Math.max(3,Number(topK)||25));

      if(ranked.length<3){
        const row={
          version:'MEMEFLOW_TOKEN_PATTERN_MEMORY_V23_9',shadowOnly:true,
          status:'PATTERN_NO_CLOSE_MATCH',ready:false,historicalExamples:eligible.length,
          neighbourCount:ranked.length,patternProbabilityPositivePct:null,matchConfidencePct:0,
          meanSimilarityPct:round(ranked.length?ranked.reduce((s,x)=>s+x.similarity,0)/ranked.length*100:0),
          nearestSimilarityPct:ranked[0]?round(ranked[0].similarity*100):null,
          currentTrajectoryState:sig.trajectoryState,currentRegime:sig.regime,
          neighbours:[],mint:mint||null,observedAt:now
        };
        remember(row);return row;
      }

      let posW=0,totalW=0,simSum=0,covSum=0;
      for(const x of ranked){
        const w=Math.max(0.01,x.similarity);
        totalW+=w;
        posW+=w*(x.row.classification==='POSITIVE'?1:0);
        simSum+=x.similarity;
        covSum+=x.coveragePct;
      }
      const alpha=2+posW;
      const beta=2+Math.max(0,totalW-posW);
      const probability=alpha/(alpha+beta)*100;
      const meanSimilarity=simSum/ranked.length*100;
      const coverage=covSum/ranked.length;
      const breadth=clamp(ranked.length/Math.max(8,Number(topK)||25),0,1);
      const confidence=clamp(meanSimilarity*(0.45+0.55*breadth)*clamp(coverage/100,0,1),0,100);
      const positive=ranked.filter(x=>x.row.classification==='POSITIVE').length;
      const negative=ranked.length-positive;
      const status=confidence>=55&&ranked.length>=8?'PATTERN_STRONG_MATCH':
        confidence>=30?'PATTERN_MATCH':'PATTERN_WEAK_MATCH';

      const row={
        version:'MEMEFLOW_TOKEN_PATTERN_MEMORY_V23_9',shadowOnly:true,status,ready:true,
        historicalExamples:eligible.length,neighbourCount:ranked.length,
        positiveNeighbours:positive,negativeNeighbours:negative,
        patternProbabilityPositivePct:round(probability),matchConfidencePct:round(confidence),
        meanSimilarityPct:round(meanSimilarity),nearestSimilarityPct:round(ranked[0].similarity*100),
        featureCoveragePct:round(coverage),effectiveNeighbourWeight:round(totalW,4),
        currentTrajectoryState:sig.trajectoryState,currentRegime:sig.regime,
        neighbours:ranked.slice(0,5).map(x=>({
          mint:x.row.mint,anchorAt:x.row.anchorAt,classification:x.row.classification,
          similarityPct:round(x.similarity*100),
          trajectoryState:x.row.signature?.trajectoryState||'UNKNOWN',
          regime:x.row.signature?.regime||'UNKNOWN'
        })),
        mint:mint||null,observedAt:now
      };
      predictions++;remember(row);return row;
    }catch{
      const row={
        version:'MEMEFLOW_TOKEN_PATTERN_MEMORY_V23_9',shadowOnly:true,status:'ERROR',
        ready:false,historicalExamples:0,neighbourCount:0,patternProbabilityPositivePct:null,
        matchConfidencePct:0,meanSimilarityPct:0,nearestSimilarityPct:null,
        currentTrajectoryState:'UNKNOWN',currentRegime:'UNKNOWN',
        neighbours:[],mint:mint||null,observedAt:now
      };
      remember(row);return row;
    }
  }

  function recordOutcome({anchor,outcome}={}){
    const mint=String(anchor?.mint||outcome?.mint||'');
    if(!mint||!anchor||!outcome)return null;
    if(Number(outcome.horizonMs)!==TARGET_HORIZON_MS)return null;
    const classification=classifyOutcome(outcome);
    if(!['POSITIVE','NEGATIVE'].includes(classification))return null;
    const row=addExample({
      mint,anchorAt:Number(anchor.at)||0,
      observedAt:Number(outcome.observedAt)||null,
      horizonMs:Number(outcome.horizonMs),
      classification,
      signature:signature(anchor.features||{})
    },{persist:true});
    if(row)outcomesRecorded++;
    return row;
  }

  function listRecent({limit=50}={}){
    return recent.slice(0,Math.max(1,Math.min(200,Number(limit)||50)));
  }

  function listExamples({limit=50,classification=null}={}){
    const wanted=classification?upper(classification):null;
    return examples.filter(x=>!wanted||x.classification===wanted)
      .slice(-Math.max(1,Math.min(200,Number(limit)||50))).reverse();
  }

  function status(){
    const positive=examples.filter(x=>x.classification==='POSITIVE').length;
    return {
      version:'MEMEFLOW_TOKEN_PATTERN_MEMORY_V23_9',shadowOnly:true,
      authority:'DIAGNOSTIC_ONLY',
      target:'P(POSITIVE_5M | SIMILAR_HISTORICAL_TRAJECTORY)',
      targetHorizonMs:TARGET_HORIZON_MS,
      method:'OUTCOME_LINKED_KERNEL_KNN_BETA_SHRINKAGE',
      file,examples:examples.length,positiveExamples:positive,
      negativeExamples:examples.length-positive,predictions,outcomesRecorded,
      duplicatesRejected,recentPredictions:recent.length,rowsLoaded,rowsWritten,
      queued:queue.length,draining,loadErrors,writeErrors
    };
  }

  load();
  return {predict,recordOutcome,listRecent,listExamples,status,flush};
}

EOF_PATTERN

cat > "$TEST" <<'EOF_TEST'
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createShadowTokenPatternMemoryV23_9} from '../src/shadow-token-pattern-memory-v23_9.mjs';

const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'mf-v23-9-'));

function snap({mint,at,state='RISING',regime='EXPANSION',p=75,c=70,d=5,pd=15,cd=10,flow=.55,ret=20,sm=74}){
  return {
    mint,observedAt:at,
    windows:{'15000':{price:{returnPct:ret}}},
    specialists:{coordination:{suspectedCoordination:false},smartMoneyMemory:{weightedPositiveProbabilityPct:sm}},
    evidence:{regime,flowAcceleration:{netFlow5s:flow},dataQuality:{completenessPct:100}},
    shadowDriftRegime:{driftStatus:'STABLE'},
    shadowConfidenceGovernor:{status:'MODERATE_CONFIDENCE',consensusProbabilityPositivePct:p,ensembleConfidencePct:c,disagreementPct:d},
    shadowTokenTrajectory:{trajectoryState:state,probabilityDeltaWindow:pd,confidenceDeltaWindow:cd}
  };
}

function labeled({mint,at,positive}){
  return {
    anchor:{mint,at,features:snap({
      mint,at,
      state:positive?'RISING':'FADING',
      regime:positive?'EXPANSION':'CHOP',
      p:positive?76:28,c:positive?70:52,d:positive?5:17,
      pd:positive?16:-17,cd:positive?10:-9,
      flow:positive?.58:-.28,ret:positive?21:-14,sm:positive?76:33
    })},
    outcome:{
      mint,observedAt:at+300_000,horizonMs:300_000,
      returnPct:positive?40:-35,
      maxFavorableExcursionPct:positive?65:4,
      maxAdverseExcursionPct:positive?-8:-40,
      dead:false
    }
  };
}

try{
  const m=createShadowTokenPatternMemoryV23_9({
    dataDir:tmp,minimumExamples:8,topK:12,minimumSimilarity:.10
  });
  const base=1_801_000_000_000;

  for(let i=0;i<12;i++)assert.ok(m.recordOutcome(labeled({mint:`P${i}`,at:base+i*1000,positive:true})));
  for(let i=0;i<8;i++)assert.ok(m.recordOutcome(labeled({mint:`N${i}`,at:base+20000+i*1000,positive:false})));
  assert.equal(m.status().examples,20);

  const now=base+1_000_000;
  const pos=m.predict(snap({mint:'CURP',at:now}),{mint:'CURP',at:now});
  assert.equal(pos.ready,true);
  assert.ok(pos.patternProbabilityPositivePct>60);
  assert.ok(pos.positiveNeighbours>pos.negativeNeighbours);

  const neg=m.predict(snap({
    mint:'CURN',at:now,state:'FADING',regime:'CHOP',
    p:28,c:52,d:17,pd:-17,cd:-9,flow:-.28,ret:-14,sm:33
  }),{mint:'CURN',at:now});
  assert.equal(neg.ready,true);
  assert.ok(neg.patternProbabilityPositivePct<50);
  assert.ok(neg.negativeNeighbours>=neg.positiveNeighbours);

  const early=m.predict(snap({mint:'EARLY',at:base+50_000}),{mint:'EARLY',at:base+50_000});
  assert.ok(early.historicalExamples<m.status().examples);

  m.recordOutcome(labeled({mint:'SELF',at:base+40_000,positive:true}));
  const self=m.predict(snap({mint:'SELF',at:now}),{mint:'SELF',at:now});
  assert.ok(self.neighbours.every(x=>x.mint!=='SELF'));

  assert.equal(await m.flush(),true);
  const restored=createShadowTokenPatternMemoryV23_9({dataDir:tmp,minimumExamples:8});
  assert.ok(restored.status().rowsLoaded>=20);

  assert.equal(typeof m.buy,'undefined');
  assert.equal(typeof m.sell,'undefined');
  assert.equal(typeof m.execute,'undefined');

  // Project wiring / strict SHADOW contract.
  const shadow=fs.readFileSync('src/token-intelligence-shadow-v23.mjs','utf8');
  const app=fs.readFileSync('app-server.mjs','utf8');
  assert.match(shadow,/createShadowTokenPatternMemoryV23_9/);
  assert.match(shadow,/shadowTokenPatternMemory\.predict/);
  assert.match(shadow,/shadowTokenPatternMemory\.recordOutcome/);
  assert.match(shadow,/shadowTokenPatternMemory:shadowTokenPatternMemory\.status\(\)/);
  assert.match(app,/\/api\/owner\/intelligence\/token-pattern-memory/);
  assert.match(app,/listTokenPatternPredictions/);

  const source=fs.readFileSync('src/shadow-token-pattern-memory-v23_9.mjs','utf8');
  assert.doesNotMatch(source,/from ['"]\.\/evaluate\.mjs['"]/);
  assert.doesNotMatch(source,/openPosition\s*\(/);
  assert.doesNotMatch(source,/closePosition\s*\(/);
  assert.doesNotMatch(source,/setSettings\s*\(/);
  assert.doesNotMatch(source,/tradeEligible/);
  assert.doesNotMatch(source,/decisionScore/);
  assert.doesNotMatch(source,/patternScore/);

  console.log('shadow token pattern memory v23.9 ok');
}finally{
  fs.rmSync(tmp,{recursive:true,force:true});
}

EOF_TEST

python3 - <<'PY'
from pathlib import Path
for name in [
 "memeflow-app/src/shadow-token-pattern-memory-v23_9.mjs",
 "memeflow-app/tests/shadow-token-pattern-memory-v23_9.mjs"
]:
    p=Path(name)
    p.write_text(p.read_text().rstrip("\n")+"\n")
print("V23_9_EOF_NORMALIZATION_OK")
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
        raise SystemExit(f"V23.9 REFUSED: {label}: expected 1 exact match, got {n}")
    return text.replace(old,new,1)

old="""import {
  createShadowTokenTrajectoryMemoryV23_8
} from './shadow-token-trajectory-v23_8.mjs';"""
s=once(s,old,old+"""
import {
  createShadowTokenPatternMemoryV23_9
} from './shadow-token-pattern-memory-v23_9.mjs';""","pattern import")

old="""  const shadowTokenTrajectory=
    createShadowTokenTrajectoryMemoryV23_8({
      dataDir,
      maxMints:maxCells
    });"""
s=once(s,old,old+"""

  const shadowTokenPatternMemory=
    createShadowTokenPatternMemoryV23_9({
      dataDir
    });""","pattern construction")

old="""      snapshot.shadowTokenTrajectory=
        shadowTokenTrajectory.observe(
          snapshot,
          {mint}
        );
"""
s=once(s,old,old+"""
      // MEMEFLOW_TOKEN_PATTERN_MEMORY_V23_9
      // Similar-history probability only; no evaluate()/V22 authority.
      snapshot.shadowTokenPattern=
        shadowTokenPatternMemory.predict(
          snapshot,
          {
            mint,
            at:snapshot.observedAt
          }
        );
""","pattern prediction")

old="""        shadowTokenTrajectory.recordOutcome({
          anchor:cell.anchor,
          outcome
        });
"""
s=once(s,old,old+"""
        shadowTokenPatternMemory.recordOutcome({
          anchor:cell.anchor,
          outcome
        });
""","pattern outcome")

old="""          shadowTokenTrajectory:{
            trajectoryState:
              snap?.shadowTokenTrajectory
                ?.trajectoryState||'COLD',
            stateStreak:
              snap?.shadowTokenTrajectory
                ?.stateStreak??1,
            turningPoint:
              snap?.shadowTokenTrajectory
                ?.turningPoint===true,
            probabilityDeltaWindow:
              snap?.shadowTokenTrajectory
                ?.probabilityDeltaWindow??null,
            confidenceDeltaWindow:
              snap?.shadowTokenTrajectory
                ?.confidenceDeltaWindow??null,
            turningPoints:
              snap?.shadowTokenTrajectory
                ?.turningPoints??0,
            regimeSwitches:
              snap?.shadowTokenTrajectory
                ?.regimeSwitches??0,
            forecastQuality:
              snap?.shadowTokenTrajectory
                ?.forecastQuality||null
          },
"""
s=once(s,old,old+"""          shadowTokenPattern:{
            status:
              snap?.shadowTokenPattern?.status||'PATTERN_COLD_START',
            ready:
              snap?.shadowTokenPattern?.ready===true,
            historicalExamples:
              snap?.shadowTokenPattern?.historicalExamples??0,
            neighbourCount:
              snap?.shadowTokenPattern?.neighbourCount??0,
            patternProbabilityPositivePct:
              snap?.shadowTokenPattern?.patternProbabilityPositivePct??null,
            matchConfidencePct:
              snap?.shadowTokenPattern?.matchConfidencePct??0,
            meanSimilarityPct:
              snap?.shadowTokenPattern?.meanSimilarityPct??0,
            nearestSimilarityPct:
              snap?.shadowTokenPattern?.nearestSimilarityPct??null
          },
""","pattern list summary")

s=once(s,"version:'MEMEFLOW_TOKEN_INTELLIGENCE_NETWORK_V23_8'","version:'MEMEFLOW_TOKEN_INTELLIGENCE_NETWORK_V23_9'","version")

old="""      shadowConfidenceGovernor:shadowConfidenceGovernor.status(),
      shadowTokenTrajectory:shadowTokenTrajectory.status()
"""
s=once(s,old,"""      shadowConfidenceGovernor:shadowConfidenceGovernor.status(),
      shadowTokenTrajectory:shadowTokenTrajectory.status(),
      shadowTokenPatternMemory:shadowTokenPatternMemory.status()
""","pattern status")

old="""    flushTokenTrajectories:
      ()=>shadowTokenTrajectory.flush(),
    status
"""
s=once(s,old,"""    flushTokenTrajectories:
      ()=>shadowTokenTrajectory.flush(),
    listTokenPatternPredictions:
      options=>shadowTokenPatternMemory.listRecent(options),
    listTokenPatternExamples:
      options=>shadowTokenPatternMemory.listExamples(options),
    flushTokenPatternMemory:
      ()=>shadowTokenPatternMemory.flush(),
    status
""","pattern API")

sp.write_text(s,encoding="utf-8")

anchor="/* MEMEFLOW_PUBLIC_AGENT_ENTITY_V2_ROUTES */\n"
route=r"""/* MEMEFLOW_TOKEN_PATTERN_MEMORY_MONITOR_V23_9
 * Owner-only, read-only similar-history diagnostics.
 */
 if(
   url.pathname==='/api/owner/intelligence/token-pattern-memory' &&
   req.method==='GET'
 ){
   if(!u)return json(res,401,{error:'AUTH_REQUIRED'});
   if(u.isOwner!==true)return json(res,403,{error:'OWNER_REQUIRED'});

   const limit=Math.max(
     1,
     Math.min(200,Number(url.searchParams.get('limit')||50))
   );

   const classification=String(
     url.searchParams.get('classification')||''
   ).trim().toUpperCase();

   return json(res,200,{
     ok:true,
     shadowOnly:true,
     memory:
       tokenIntelligenceShadowV23
         .status()
         .shadowTokenPatternMemory,
     predictions:
       tokenIntelligenceShadowV23
         .listTokenPatternPredictions({limit}),
     examples:
       tokenIntelligenceShadowV23
         .listTokenPatternExamples({
           limit,
           classification:classification||null
         })
   });
 }

/* MEMEFLOW_PUBLIC_AGENT_ENTITY_V2_ROUTES */
"""
a=once(a,anchor,route,"pattern route")
ap.write_text(a,encoding="utf-8")
print("V23_9_TRANSFORM_OK")

PY

python3 - <<'PY'
import json
from pathlib import Path
p=Path("memeflow-app/package.json")
d=json.loads(p.read_text(encoding="utf-8"))
s=d["scripts"]["test:core"]
needle="node tests/shadow-token-trajectory-v23_8.mjs && node tests/assist-fresh-decision-v22.mjs"
replacement="node tests/shadow-token-trajectory-v23_8.mjs && node tests/shadow-token-pattern-memory-v23_9.mjs && node tests/assist-fresh-decision-v22.mjs"
if s.count(needle)!=1:
    raise SystemExit("V23.9 REFUSED: package test anchor changed")
if "shadow-token-pattern-memory-v23_9.mjs" in s:
    raise SystemExit("V23.9 REFUSED: pattern test already installed")
d["scripts"]["test:core"]=s.replace(needle,replacement,1)
p.write_text(json.dumps(d,indent=2)+"\n",encoding="utf-8")
print("PACKAGE_TRANSFORM_OK")

PY

echo "=== V23.9 SYNTAX ==="
node --check "$APP"
node --check "$SHADOW"
node --check "$PATTERN"
node --check "$TEST"
node -e "JSON.parse(require('fs').readFileSync('$PKG','utf8')); console.log('PACKAGE_JSON_OK')"

echo "=== V23.9 TARGETED TESTS ==="
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
 node tests/lifecycle-decision-v22.mjs
 node tests/assist-fresh-decision-v22.mjs
)
echo "TARGETED_TESTS_OK"

echo "=== V23.9 FULL PROJECT TEST SUITE ==="
(cd memeflow-app && npm test)
echo "FULL_TEST_SUITE_OK"

echo "=== V23.9 STATIC CONTRACT AUDIT ==="
python3 - <<'PY'
from pathlib import Path
p=Path("memeflow-app/src/shadow-token-pattern-memory-v23_9.mjs").read_text()
s=Path("memeflow-app/src/token-intelligence-shadow-v23.mjs").read_text()
a=Path("memeflow-app/app-server.mjs").read_text()
pkg=Path("memeflow-app/package.json").read_text()
errors=[]

for m in [
 "MEMEFLOW_TOKEN_PATTERN_MEMORY_V23_9",
 "OUTCOME_LINKED_KERNEL_KNN_BETA_SHRINKAGE",
 "PATTERN_COLD_START","PATTERN_STRONG_MATCH",
 "token-pattern-memory-v23-9.jsonl",
 "TARGET_HORIZON_MS=300_000"
]:
    if m not in p: errors.append("pattern marker missing: "+m)

for m in [
 "from './evaluate.mjs'",'from "./evaluate.mjs"',
 "openPosition(","closePosition(","setSettings(",
 "tradeEligible","decisionScore","patternScore"
]:
    if m in p: errors.append("forbidden authority: "+m)

for m in [
 "createShadowTokenPatternMemoryV23_9",
 "shadowTokenPatternMemory.predict",
 "shadowTokenPatternMemory.recordOutcome",
 "shadowTokenPatternMemory:shadowTokenPatternMemory.status()",
 "listTokenPatternPredictions",
 "listTokenPatternExamples",
 "MEMEFLOW_TOKEN_INTELLIGENCE_NETWORK_V23_9"
]:
    if m not in s: errors.append("wiring missing: "+m)

pos=s.find("snapshot.shadowTokenPattern=")
for m in ["snapshot.shadowConfidenceGovernor=","snapshot.shadowTokenTrajectory="]:
    q=s.find(m)
    if q<0 or pos<0 or q>=pos: errors.append("ordering invalid: "+m)

for m in [
 "/api/owner/intelligence/token-pattern-memory",
 "MEMEFLOW_TOKEN_PATTERN_MEMORY_MONITOR_V23_9",
 "listTokenPatternPredictions"
]:
    if m not in a: errors.append("monitor missing: "+m)

for m in ["row.mint!==mint","Number(row.observedAt)<now"]:
    if m not in p: errors.append("anti-leakage missing: "+m)

if "shadow-token-pattern-memory-v23_9.mjs" not in pkg:
    errors.append("test missing from package")

if errors:
    raise SystemExit("V23_9_CONTRACT_FAILED:\n- "+"\n- ".join(errors))
print("V23_9_CONTRACT_OK")

PY

git diff --check -- "${ALL_FILES[@]}"
echo "=== V23.9 DIFF ==="
git diff --stat -- "${ALL_FILES[@]}"

clear_lock
git reset >/dev/null
clear_lock
git add "${ALL_FILES[@]}"

ALLOWED_RE='^memeflow-app/(app-server\.mjs|package\.json|src/token-intelligence-shadow-v23\.mjs|src/shadow-token-pattern-memory-v23_9\.mjs|tests/shadow-token-pattern-memory-v23_9\.mjs)$'
BAD="$(git diff --cached --name-only | grep -Ev "$ALLOWED_RE" || true)"
[[ -z "$BAD" ]] || { echo "unrelated staged files:"; echo "$BAD"; exit 1; }

git diff --cached --check
git commit -m "feat: add outcome-linked token pattern memory v23.9"
git push origin HEAD

trap - EXIT INT TERM

echo "=== DONE ==="
echo "Backup: $BACKUP"
git log -1 --oneline --decorate
echo "V23.9 CONTRACT:"
echo "  V22 evaluate remains the only trading authority"
echo "  only completed 5m outcomes become pattern examples"
echo "  same-token and future-outcome leakage are blocked"
echo "  kernel kNN + Beta shrinkage prevent fake certainty"
echo "  pattern probability remains SHADOW diagnostic only"
