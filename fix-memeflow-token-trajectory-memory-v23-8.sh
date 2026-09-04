#!/usr/bin/env bash
set -Eeuo pipefail
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
[[ -n "$ROOT" ]] || { echo "ERROR: run inside the MEMEFLOW Git repository"; exit 1; }
cd "$ROOT"
BRANCH="chart-debug-20260829-161234"
EXPECTED_HEAD="c471c325150ea38c840293bcba2b0404de1c162e"
APP="memeflow-app/app-server.mjs"
SHADOW="memeflow-app/src/token-intelligence-shadow-v23.mjs"
PKG="memeflow-app/package.json"
TRAJECTORY="memeflow-app/src/shadow-token-trajectory-v23_8.mjs"
TEST="memeflow-app/tests/shadow-token-trajectory-v23_8.mjs"
MODIFIED=("$APP" "$SHADOW" "$PKG")
NEW_FILES=("$TRAJECTORY" "$TEST")
ALL_FILES=("${MODIFIED[@]}" "${NEW_FILES[@]}")
echo "=== MEMEFLOW TOKEN TRAJECTORY MEMORY V23.8 ==="

mf_git_process_in_repo(){
  local root_real proc pid comm cwd
  root_real="$(readlink -f "$ROOT" 2>/dev/null || printf '%s' "$ROOT")"
  for proc in /proc/[0-9]*; do
    [[ -r "$proc/comm" ]] || continue
    pid="${proc##*/}"; [[ "$pid" == "$$" ]] && continue
    comm="$(cat "$proc/comm" 2>/dev/null || true)"
    case "$comm" in git|git-*) ;; *) continue ;; esac
    cwd="$(readlink -f "$proc/cwd" 2>/dev/null || true)"; [[ -n "$cwd" ]] || continue
    if [[ "$cwd" == "$root_real" || "$cwd" == "$root_real/"* ]]; then printf '%s\n' "$pid:$comm:$cwd"; return 0; fi
  done
  return 1
}

mf_clear_stale_index_lock(){
  local lock="$ROOT/.git/index.lock" active=""
  [[ -e "$lock" ]] || return 0
  active="$(mf_git_process_in_repo || true)"
  if [[ -n "$active" ]]; then echo "V23.8 REFUSED: .git/index.lock exists and active git is running:"; echo "$active"; return 1; fi
  echo "V23.8: removing stale .git/index.lock"; rm -f -- "$lock"
  [[ ! -e "$lock" ]] || { echo "V23.8 REFUSED: unable to remove stale .git/index.lock"; return 1; }
}

mf_clear_stale_index_lock
[[ "$(git branch --show-current)" == "$BRANCH" ]] || { echo "V23.8 REFUSED: expected branch $BRANCH"; echo "actual: $(git branch --show-current)"; exit 1; }
[[ "$(git rev-parse HEAD)" == "$EXPECTED_HEAD" ]] || { echo "V23.8 REFUSED: audited HEAD changed"; echo "expected: $EXPECTED_HEAD"; echo "actual:   $(git rev-parse HEAD)"; echo "Nothing changed."; exit 1; }
for f in "${MODIFIED[@]}"; do
  [[ -f "$f" ]] || { echo "V23.8 REFUSED: missing $f"; exit 1; }
  git diff --quiet -- "$f" || { echo "V23.8 REFUSED: local changes in $f"; exit 1; }
  git diff --cached --quiet -- "$f" || { echo "V23.8 REFUSED: staged changes in $f"; exit 1; }
done
for f in "${NEW_FILES[@]}"; do [[ ! -e "$f" ]] || { echo "V23.8 REFUSED: $f already exists"; exit 1; }; done
STAMP="$(date +%Y%m%d-%H%M%S)"; BACKUP=".memeflow-backups/token-trajectory-v23-8-$STAMP"; mkdir -p "$BACKUP"
for f in "${MODIFIED[@]}"; do mkdir -p "$BACKUP/$(dirname "$f")"; cp "$f" "$BACKUP/$f"; done
rollback(){
  rc=$?
  if [[ $rc -ne 0 ]]; then
    echo; echo "=== V23.8 FAILED - RESTORING ==="
    for f in "${MODIFIED[@]}"; do [[ -f "$BACKUP/$f" ]] && cp "$BACKUP/$f" "$f" || true; done
    for f in "${NEW_FILES[@]}"; do rm -f "$f"; done
    mf_clear_stale_index_lock >/dev/null 2>&1 || true
    git reset -- "${ALL_FILES[@]}" >/dev/null 2>&1 || true
    echo "ROLLBACK_COMPLETE; backup: $BACKUP"
  fi
  exit "$rc"
}
trap rollback EXIT INT TERM

cat > "$TRAJECTORY" <<'EOF_TRAJECTORY'
import fs from 'node:fs';
import path from 'node:path';

// MEMEFLOW_TOKEN_TRAJECTORY_MEMORY_V23_8
//
// SHADOW ONLY.
// Bounded temporal memory for each tracked token.
// It NEVER owns MEMEFLOW Score/State/settings/trade execution.

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

function classifyOutcome(outcome={}){
  if(outcome.dead===true)return 'NEGATIVE';

  const ret=finite(outcome.returnPct);
  const mfe=finite(outcome.maxFavorableExcursionPct);
  const mae=finite(outcome.maxAdverseExcursionPct);

  if(
    (ret!==null&&ret>=20) ||
    (
      mfe!==null &&
      mfe>=50 &&
      (mae===null||mae>-25)
    )
  ){
    return 'POSITIVE';
  }

  if(
    (ret!==null&&ret<=-20) ||
    (mae!==null&&mae<=-25)
  ){
    return 'NEGATIVE';
  }

  return 'NEUTRAL';
}

function readTailUtf8(file,maxBytes=20*1024*1024){
  try{
    if(!file||!fs.existsSync(file))return '';

    const stat=fs.statSync(file);
    if(!(stat.size>0))return '';

    if(stat.size<=maxBytes){
      return fs.readFileSync(file,'utf8');
    }

    const start=stat.size-maxBytes;
    const fd=fs.openSync(file,'r');

    try{
      const buffer=Buffer.allocUnsafe(maxBytes);
      fs.readSync(fd,buffer,0,maxBytes,start);

      let text=buffer.toString('utf8');
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

function pointFromSnapshot(snapshot={},mint='',at=Date.now()){
  const governor=snapshot?.shadowConfidenceGovernor||{};
  const regime=snapshot?.shadowDriftRegime||{};
  const smartMoney=snapshot?.specialists?.smartMoneyMemory||{};
  const coordination=snapshot?.specialists?.coordination||{};
  const w15=snapshot?.windows?.['15000']||{};

  return {
    mint:String(mint||snapshot?.mint||''),
    at:finite(snapshot?.observedAt)??finite(at)??Date.now(),
    stage:upper(snapshot?.stage),
    regime:upper(snapshot?.evidence?.regime),
    governorStatus:upper(governor.status),
    driftStatus:upper(regime.driftStatus),
    consensusProbabilityPositivePct:
      finite(governor.consensusProbabilityPositivePct),
    ensembleConfidencePct:
      finite(governor.ensembleConfidencePct),
    disagreementPct:
      finite(governor.disagreementPct),
    agreementPct:
      finite(governor.agreementPct),
    effectiveSourceCount:
      finite(governor.effectiveSourceCount),
    priceReturn15s:
      finite(w15?.price?.returnPct),
    priceVolatility15s:
      finite(w15?.price?.volatility),
    netFlow5s:
      finite(snapshot?.evidence?.flowAcceleration?.netFlow5s),
    netFlow15s:
      finite(snapshot?.evidence?.flowAcceleration?.netFlow15s),
    uniqueBuyers15s:
      finite(w15?.flow?.uniqueBuyers),
    holderDelta:
      finite(snapshot?.evidence?.holders?.holderDelta),
    dataCompletenessPct:
      finite(snapshot?.evidence?.dataQuality?.completenessPct),
    smartMoneyProbabilityPct:
      finite(smartMoney.weightedPositiveProbabilityPct),
    smartMoneyConfidencePct:
      finite(smartMoney.historicalConfidencePct),
    coordinationSuspected:
      coordination.suspectedCoordination===true
  };
}

function delta(a,b){
  const x=finite(a);
  const y=finite(b);
  return x===null||y===null?null:x-y;
}

function trajectoryState({point,previous,windowStart}={}){
  if(!point)return 'COLD';

  if(point.driftStatus==='DRIFT'){
    return 'DRIFTED';
  }

  if(
    finite(point.disagreementPct)!==null &&
    Number(point.disagreementPct)>=20
  ){
    return 'CONFLICTED';
  }

  if(
    point.governorStatus==='INSUFFICIENT_EVIDENCE' ||
    finite(point.consensusProbabilityPositivePct)===null
  ){
    return 'COLD';
  }

  const probabilityDeltaWindow=
    delta(
      point.consensusProbabilityPositivePct,
      windowStart?.consensusProbabilityPositivePct
    );

  const confidenceDeltaWindow=
    delta(
      point.ensembleConfidencePct,
      windowStart?.ensembleConfidencePct
    );

  if(
    probabilityDeltaWindow!==null &&
    probabilityDeltaWindow>=8 &&
    (
      confidenceDeltaWindow===null ||
      confidenceDeltaWindow>=-10
    )
  ){
    return 'RISING';
  }

  if(
    probabilityDeltaWindow!==null &&
    probabilityDeltaWindow<=-8
  ){
    return 'FADING';
  }

  if(
    confidenceDeltaWindow!==null &&
    confidenceDeltaWindow>=10
  ){
    return 'BUILDING';
  }

  if(
    previous &&
    upper(previous.regime)!==upper(point.regime)
  ){
    return 'REGIME_SHIFT';
  }

  return 'STABLE';
}

function qualityView(outcomes=[]){
  const scored=outcomes.filter(
    row=>
      row.scored===true &&
      finite(row.brier)!==null
  );

  if(!scored.length){
    return {
      scored:0,
      correct:0,
      accuracyPct:null,
      meanBrier:null,
      meanAbsoluteProbabilityErrorPct:null
    };
  }

  const correct=scored.filter(
    row=>row.correct===true
  ).length;

  const meanBrier=
    scored.reduce(
      (sum,row)=>sum+Number(row.brier),
      0
    )/
    scored.length;

  const meanAbsoluteProbabilityErrorPct=
    scored.reduce(
      (sum,row)=>
        sum+Number(row.absoluteProbabilityErrorPct||0),
      0
    )/
    scored.length;

  return {
    scored:scored.length,
    correct,
    accuracyPct:round(correct/scored.length*100,2),
    meanBrier:round(meanBrier,6),
    meanAbsoluteProbabilityErrorPct:
      round(meanAbsoluteProbabilityErrorPct,2)
  };
}

function horizonQuality(outcomes=[]){
  const groups=new Map();

  for(const row of outcomes){
    const key=String(Number(row.horizonMs)||0);
    const list=groups.get(key)||[];
    list.push(row);
    groups.set(key,list);
  }

  return [...groups.entries()]
    .map(([key,rows])=>({
      horizonMs:Number(key)||0,
      ...qualityView(rows)
    }))
    .sort((a,b)=>a.horizonMs-b.horizonMs);
}

export function createShadowTokenTrajectoryMemoryV23_8({
  dataDir=null,
  maxMints=500,
  maxPointsPerMint=96,
  maxOutcomesPerMint=32,
  persistIntervalMs=5_000
}={}){
  const file=
    dataDir
      ? path.join(dataDir,'token-trajectory-v23-8.jsonl')
      : null;

  const trajectories=new Map();
  const queue=[];

  let draining=false;
  let rowsWritten=0;
  let rowsLoaded=0;
  let loadErrors=0;
  let writeErrors=0;
  let observations=0;
  let outcomesRecorded=0;
  let evictions=0;

  if(file){
    try{
      fs.mkdirSync(path.dirname(file),{recursive:true});
    }catch{}
  }

  function ensure(mint){
    mint=String(mint||'');
    if(!mint)return null;

    let entry=trajectories.get(mint);

    if(!entry){
      entry={
        mint,
        createdAt:Date.now(),
        lastObservedAt:0,
        lastPersistedAt:0,
        lastPersistedState:null,
        terminal:null,
        turningPoints:0,
        regimeSwitches:0,
        points:[],
        outcomes:[]
      };

      trajectories.set(mint,entry);
    }

    return entry;
  }

  function bound(){
    const limit=Math.max(1,Number(maxMints)||500);

    while(trajectories.size>limit){
      let oldestKey=null;
      let oldestAt=Infinity;

      for(const [mint,entry] of trajectories){
        const t=Number(entry.lastObservedAt||entry.createdAt||0);
        if(t<oldestAt){
          oldestAt=t;
          oldestKey=mint;
        }
      }

      if(oldestKey===null)break;

      trajectories.delete(oldestKey);
      evictions++;
    }
  }

  function append(row){
    if(!file)return;

    queue.push(row);

    if(queue.length>10_000){
      queue.splice(0,queue.length-10_000);
    }

    kick();
  }

  function kick(){
    if(draining||!queue.length||!file)return;

    draining=true;

    setImmediate(async()=>{
      try{
        while(queue.length){
          const batch=queue.splice(0,200);

          const payload=
            batch
              .map(row=>JSON.stringify(row))
              .join('\n')+
            '\n';

          await fs.promises.appendFile(
            file,
            payload,
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

  async function flush(){
    if(!file)return true;

    kick();
    const started=Date.now();

    while(draining||queue.length){
      if(Date.now()-started>5_000)return false;

      await new Promise(
        resolve=>setTimeout(resolve,5)
      );
    }

    return true;
  }

  function applyPoint(raw,{persist=false}={}){
    const mint=String(raw?.mint||'');
    if(!mint)return null;

    const entry=ensure(mint);
    if(!entry)return null;

    const previous=entry.points.at(-1)||null;

    const point={
      ...raw,
      mint,
      at:finite(raw?.at)??Date.now()
    };

    const windowStart=
      [...entry.points]
        .reverse()
        .find(
          row=>
            Number(point.at)-
            Number(row.at||0)>=15_000
        ) ||
      entry.points[0] ||
      previous;

    point.probabilityDelta1=
      delta(
        point.consensusProbabilityPositivePct,
        previous?.consensusProbabilityPositivePct
      );

    point.confidenceDelta1=
      delta(
        point.ensembleConfidencePct,
        previous?.ensembleConfidencePct
      );

    point.probabilityDeltaWindow=
      delta(
        point.consensusProbabilityPositivePct,
        windowStart?.consensusProbabilityPositivePct
      );

    point.confidenceDeltaWindow=
      delta(
        point.ensembleConfidencePct,
        windowStart?.ensembleConfidencePct
      );

    point.netFlowDeltaWindow=
      delta(
        point.netFlow5s,
        windowStart?.netFlow5s
      );

    point.regimeChanged=
      Boolean(
        previous &&
        upper(previous.regime)!==upper(point.regime)
      );

    point.trajectoryState=
      trajectoryState({
        point,
        previous,
        windowStart
      });

    point.stateChanged=
      Boolean(
        previous &&
        upper(previous.trajectoryState)!==
        upper(point.trajectoryState)
      );

    point.turningPoint=
      Boolean(
        point.regimeChanged ||
        (
          point.stateChanged &&
          [
            'RISING',
            'FADING',
            'CONFLICTED',
            'DRIFTED',
            'REGIME_SHIFT'
          ].includes(point.trajectoryState)
        )
      );

    point.stateStreak=
      previous &&
      previous.trajectoryState===point.trajectoryState
        ? Number(previous.stateStreak||1)+1
        : 1;

    if(point.regimeChanged){
      entry.regimeSwitches++;
    }

    if(point.turningPoint){
      entry.turningPoints++;
    }

    entry.points.push(point);

    const pointLimit=
      Math.max(8,Number(maxPointsPerMint)||96);

    if(entry.points.length>pointLimit){
      entry.points.splice(
        0,
        entry.points.length-pointLimit
      );
    }

    entry.lastObservedAt=Number(point.at)||Date.now();

    if(persist){
      const elapsed=
        Number(point.at)-
        Number(entry.lastPersistedAt||0);

      const shouldPersist=
        entry.lastPersistedAt===0 ||
        elapsed>=
          Math.max(1_000,Number(persistIntervalMs)||5_000) ||
        point.turningPoint===true ||
        entry.lastPersistedState!==point.trajectoryState;

      if(shouldPersist){
        append({
          type:'trajectory-point',
          version:'MEMEFLOW_TOKEN_TRAJECTORY_POINT_V23_8',
          shadowOnly:true,
          ...point
        });

        entry.lastPersistedAt=Number(point.at)||Date.now();
        entry.lastPersistedState=point.trajectoryState;
      }
    }

    bound();
    return point;
  }

  function applyOutcome(raw,{persist=false}={}){
    const mint=String(raw?.mint||'');
    if(!mint)return null;

    const entry=ensure(mint);
    if(!entry)return null;

    const key=[
      mint,
      String(raw?.anchorAt||0),
      String(raw?.horizonMs||0)
    ].join(':');

    if(
      entry.outcomes.some(
        row=>row.key===key
      )
    ){
      return null;
    }

    const row={
      ...raw,
      key,
      mint
    };

    entry.outcomes.push(row);

    const outcomeLimit=
      Math.max(5,Number(maxOutcomesPerMint)||32);

    if(entry.outcomes.length>outcomeLimit){
      entry.outcomes.splice(
        0,
        entry.outcomes.length-outcomeLimit
      );
    }

    outcomesRecorded++;

    if(persist){
      append({
        type:'trajectory-outcome',
        version:'MEMEFLOW_TOKEN_TRAJECTORY_OUTCOME_V23_8',
        shadowOnly:true,
        ...row
      });
    }

    bound();
    return row;
  }

  function load(){
    if(!file)return;

    const text=readTailUtf8(file);
    if(!text)return;

    for(const line of text.split('\n')){
      const trimmed=line.trim();
      if(!trimmed)continue;

      try{
        const row=JSON.parse(trimmed);

        if(row?.type==='trajectory-point'){
          applyPoint(row,{persist:false});
          rowsLoaded++;
        }else if(row?.type==='trajectory-outcome'){
          applyOutcome(row,{persist:false});
          rowsLoaded++;
        }else if(row?.type==='trajectory-terminal'){
          const entry=ensure(row.mint);

          if(entry){
            entry.terminal={
              at:finite(row.at),
              reason:row.reason||'TERMINAL'
            };
          }

          rowsLoaded++;
        }
      }catch{
        loadErrors++;
      }
    }
  }

  function observe(snapshot={},{
    mint=null,
    at=null
  }={}){
    const resolvedMint=
      String(mint||snapshot?.mint||'');

    if(!resolvedMint)return null;

    const raw=
      pointFromSnapshot(
        snapshot,
        resolvedMint,
        at??Date.now()
      );

    const point=
      applyPoint(raw,{persist:true});

    observations++;

    const entry=trajectories.get(resolvedMint);

    return {
      version:'MEMEFLOW_TOKEN_TRAJECTORY_V23_8',
      shadowOnly:true,
      mint:resolvedMint,
      trajectoryState:
        point?.trajectoryState||'COLD',
      stateStreak:
        point?.stateStreak||1,
      turningPoint:
        point?.turningPoint===true,
      regimeChanged:
        point?.regimeChanged===true,
      probabilityDelta1:
        round(point?.probabilityDelta1,2),
      probabilityDeltaWindow:
        round(point?.probabilityDeltaWindow,2),
      confidenceDeltaWindow:
        round(point?.confidenceDeltaWindow,2),
      netFlowDeltaWindow:
        round(point?.netFlowDeltaWindow,6),
      points:
        entry?.points?.length||0,
      turningPoints:
        entry?.turningPoints||0,
      regimeSwitches:
        entry?.regimeSwitches||0,
      forecastQuality:
        qualityView(entry?.outcomes||[])
    };
  }

  function recordOutcome({anchor,outcome}={}){
    const mint=
      String(anchor?.mint||outcome?.mint||'');

    if(!mint||!anchor||!outcome)return null;

    const classification=classifyOutcome(outcome);

    const governor=
      anchor?.features?.shadowConfidenceGovernor||{};

    const probabilityPct=
      finite(
        governor.consensusProbabilityPositivePct
      );

    const confidencePct=
      finite(
        governor.ensembleConfidencePct
      );

    const target=
      classification==='POSITIVE'
        ? 1
        : classification==='NEGATIVE'
          ? 0
          : null;

    const probability=
      probabilityPct===null
        ? null
        : clamp(probabilityPct/100,0,1);

    const scored=
      target!==null &&
      probability!==null;

    const brier=
      scored
        ? (probability-target)**2
        : null;

    const absoluteProbabilityErrorPct=
      scored
        ? Math.abs(probability-target)*100
        : null;

    const correct=
      scored
        ? (probability>=0.5?1:0)===target
        : null;

    return applyOutcome(
      {
        type:'trajectory-outcome',
        shadowOnly:true,
        mint,
        anchorAt:finite(anchor.at),
        observedAt:finite(outcome.observedAt),
        horizonMs:finite(outcome.horizonMs),
        classification,
        returnPct:finite(outcome.returnPct),
        maxFavorableExcursionPct:
          finite(outcome.maxFavorableExcursionPct),
        maxAdverseExcursionPct:
          finite(outcome.maxAdverseExcursionPct),
        forecastProbabilityPositivePct:
          probabilityPct,
        forecastConfidencePct:
          confidencePct,
        forecastStatus:
          upper(governor.status),
        scored,
        brier:round(brier,8),
        absoluteProbabilityErrorPct:
          round(absoluteProbabilityErrorPct,4),
        correct
      },
      {persist:true}
    );
  }

  function markTerminal(mint,reason='TERMINAL'){
    const entry=
      trajectories.get(String(mint||''));

    if(!entry)return false;

    entry.terminal={
      at:Date.now(),
      reason:String(reason||'TERMINAL')
    };

    append({
      type:'trajectory-terminal',
      version:'MEMEFLOW_TOKEN_TRAJECTORY_TERMINAL_V23_8',
      shadowOnly:true,
      mint:entry.mint,
      at:entry.terminal.at,
      reason:entry.terminal.reason
    });

    return true;
  }

  function inspect(mint){
    const entry=
      trajectories.get(String(mint||''));

    if(!entry)return null;

    const latest=entry.points.at(-1)||null;

    return {
      version:'MEMEFLOW_TOKEN_TRAJECTORY_V23_8',
      shadowOnly:true,
      mint:entry.mint,
      createdAt:entry.createdAt,
      lastObservedAt:entry.lastObservedAt||null,
      terminal:entry.terminal,
      points:entry.points.length,
      turningPoints:entry.turningPoints,
      regimeSwitches:entry.regimeSwitches,
      currentState:
        latest?.trajectoryState||'COLD',
      currentRegime:
        latest?.regime||'UNKNOWN',
      currentConsensusProbabilityPositivePct:
        latest?.consensusProbabilityPositivePct??null,
      currentEnsembleConfidencePct:
        latest?.ensembleConfidencePct??null,
      currentDisagreementPct:
        latest?.disagreementPct??null,
      probabilityDeltaWindow:
        round(latest?.probabilityDeltaWindow,2),
      confidenceDeltaWindow:
        round(latest?.confidenceDeltaWindow,2),
      forecastQuality:
        qualityView(entry.outcomes),
      horizonQuality:
        horizonQuality(entry.outcomes),
      timeline:
        entry.points.slice(-50),
      outcomes:
        entry.outcomes.slice(-20)
    };
  }

  function list({limit=50,state=null}={}){
    const safeLimit=
      Math.max(
        1,
        Math.min(100,Number(limit)||50)
      );

    const wanted=
      state===null||
      state===undefined||
      state===''
        ? null
        : upper(state);

    return [...trajectories.values()]
      .map(entry=>{
        const latest=entry.points.at(-1)||null;

        return {
          shadowOnly:true,
          mint:entry.mint,
          lastObservedAt:entry.lastObservedAt||null,
          currentState:
            latest?.trajectoryState||'COLD',
          currentRegime:
            latest?.regime||'UNKNOWN',
          points:entry.points.length,
          turningPoints:entry.turningPoints,
          regimeSwitches:entry.regimeSwitches,
          consensusProbabilityPositivePct:
            latest?.consensusProbabilityPositivePct??null,
          ensembleConfidencePct:
            latest?.ensembleConfidencePct??null,
          disagreementPct:
            latest?.disagreementPct??null,
          probabilityDeltaWindow:
            round(latest?.probabilityDeltaWindow,2),
          confidenceDeltaWindow:
            round(latest?.confidenceDeltaWindow,2),
          forecastQuality:
            qualityView(entry.outcomes),
          terminal:entry.terminal
        };
      })
      .filter(
        row=>
          !wanted ||
          row.currentState===wanted
      )
      .sort(
        (a,b)=>
          Number(b.lastObservedAt||0)-
          Number(a.lastObservedAt||0)
      )
      .slice(0,safeLimit);
  }

  function status(){
    const allOutcomes=
      [...trajectories.values()]
        .flatMap(entry=>entry.outcomes);

    const states={};
    let pointsInMemory=0;

    for(const entry of trajectories.values()){
      pointsInMemory+=entry.points.length;

      const state=
        entry.points.at(-1)?.trajectoryState||'COLD';

      states[state]=(states[state]||0)+1;
    }

    return {
      version:'MEMEFLOW_TOKEN_TRAJECTORY_MEMORY_V23_8',
      shadowOnly:true,
      authority:'DIAGNOSTIC_ONLY',
      file,
      trajectories:trajectories.size,
      pointsInMemory,
      observations,
      outcomesRecorded,
      evictions,
      states,
      forecastQuality:
        qualityView(allOutcomes),
      horizonQuality:
        horizonQuality(allOutcomes),
      rowsLoaded,
      rowsWritten,
      queued:queue.length,
      draining,
      loadErrors,
      writeErrors
    };
  }

  load();

  return {
    observe,
    recordOutcome,
    markTerminal,
    inspect,
    list,
    status,
    flush
  };
}
EOF_TRAJECTORY
cat > "$TEST" <<'EOF_TEST'
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  createShadowTokenTrajectoryMemoryV23_8
} from '../src/shadow-token-trajectory-v23_8.mjs';

const tmp=
  fs.mkdtempSync(
    path.join(os.tmpdir(),'mf-v23-8-')
  );

function snapshot({
  mint='T1',
  at,
  probability,
  confidence,
  disagreement=5,
  regime='EXPANSION',
  drift='STABLE',
  flow=0.2,
  priceReturn=2,
  smartMoney=70
}){
  return {
    mint,
    observedAt:at,
    stage:'DEEP',
    windows:{
      '15000':{
        price:{
          returnPct:priceReturn,
          volatility:0.03
        },
        flow:{
          uniqueBuyers:12
        }
      }
    },
    specialists:{
      coordination:{
        suspectedCoordination:false
      },
      smartMoneyMemory:{
        reputationReady:true,
        readyWallets:3,
        weightedPositiveProbabilityPct:smartMoney,
        historicalConfidencePct:65
      }
    },
    evidence:{
      regime,
      flowAcceleration:{
        netFlow5s:flow,
        netFlow15s:flow*2
      },
      holders:{
        holderDelta:10
      },
      dataQuality:{
        completenessPct:100
      }
    },
    shadowConfidenceGovernor:{
      status:
        disagreement>=20
          ? 'HIGH_DISAGREEMENT'
          : 'MODERATE_CONFIDENCE',
      ready:true,
      consensusProbabilityPositivePct:probability,
      ensembleConfidencePct:confidence,
      disagreementPct:disagreement,
      agreementPct:100-disagreement*2,
      effectiveSourceCount:2.8
    },
    shadowDriftRegime:{
      driftStatus:drift
    }
  };
}

try{
  const memory=
    createShadowTokenTrajectoryMemoryV23_8({
      dataDir:tmp,
      maxMints:10,
      maxPointsPerMint:20,
      persistIntervalMs:1_000
    });

  const base=1_800_800_000_000;

  let row=
    memory.observe(
      snapshot({
        at:base,
        probability:52,
        confidence:42,
        flow:0.1
      })
    );

  assert.equal(
    row.trajectoryState,
    'STABLE'
  );

  memory.observe(
    snapshot({
      at:base+8_000,
      probability:60,
      confidence:50,
      flow:0.2
    })
  );

  row=
    memory.observe(
      snapshot({
        at:base+18_000,
        probability:73,
        confidence:58,
        flow:0.4
      })
    );

  assert.equal(
    row.trajectoryState,
    'RISING'
  );

  assert.ok(
    row.probabilityDeltaWindow>=20
  );

  const conflict=
    memory.observe(
      snapshot({
        at:base+20_000,
        probability:70,
        confidence:55,
        disagreement:28
      })
    );

  assert.equal(
    conflict.trajectoryState,
    'CONFLICTED'
  );

  const drifted=
    memory.observe(
      snapshot({
        at:base+22_000,
        probability:68,
        confidence:20,
        drift:'DRIFT'
      })
    );

  assert.equal(
    drifted.trajectoryState,
    'DRIFTED'
  );

  const positive=
    memory.recordOutcome({
      anchor:{
        mint:'T1',
        at:base,
        features:{
          shadowConfidenceGovernor:{
            status:'MODERATE_CONFIDENCE',
            consensusProbabilityPositivePct:80,
            ensembleConfidencePct:70
          }
        }
      },
      outcome:{
        mint:'T1',
        observedAt:base+300_000,
        horizonMs:300_000,
        returnPct:35,
        maxFavorableExcursionPct:60,
        maxAdverseExcursionPct:-10,
        dead:false
      }
    });

  assert.equal(
    positive.classification,
    'POSITIVE'
  );

  assert.equal(
    positive.scored,
    true
  );

  assert.equal(
    positive.correct,
    true
  );

  assert.ok(
    positive.brier<0.05
  );

  const inspected=
    memory.inspect('T1');

  assert.equal(
    inspected.currentState,
    'DRIFTED'
  );

  assert.ok(
    inspected.turningPoints>=2
  );

  assert.equal(
    inspected.forecastQuality.scored,
    1
  );

  assert.equal(
    inspected.horizonQuality[0].horizonMs,
    300_000
  );

  const listed=
    memory.list({
      limit:10,
      state:'DRIFTED'
    });

  assert.equal(listed.length,1);
  assert.equal(listed[0].mint,'T1');

  const bounded=
    createShadowTokenTrajectoryMemoryV23_8({
      maxMints:2
    });

  for(const mint of ['A','B','C']){
    bounded.observe(
      snapshot({
        mint,
        at:
          base+
          (
            mint.charCodeAt(0)-65
          )*1_000,
        probability:50,
        confidence:40
      }),
      {mint}
    );
  }

  assert.ok(
    bounded.status().trajectories<=2
  );

  assert.ok(
    bounded.status().evictions>=1
  );

  assert.equal(
    await memory.flush(),
    true
  );

  const restored=
    createShadowTokenTrajectoryMemoryV23_8({
      dataDir:tmp
    });

  const restoredCell=
    restored.inspect('T1');

  assert.ok(restoredCell);

  assert.ok(
    restored.status().rowsLoaded>=1
  );

  assert.equal(
    restoredCell.forecastQuality.scored,
    1
  );

  assert.equal(
    typeof memory.buy,
    'undefined'
  );

  assert.equal(
    typeof memory.sell,
    'undefined'
  );

  assert.equal(
    typeof memory.execute,
    'undefined'
  );

  // Project wiring / strict SHADOW contract.
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

  assert.match(
    shadow,
    /createShadowTokenTrajectoryMemoryV23_8/
  );

  assert.match(
    shadow,
    /shadowTokenTrajectory\.observe/
  );

  assert.match(
    shadow,
    /shadowTokenTrajectory\.recordOutcome/
  );

  assert.match(
    shadow,
    /shadowTokenTrajectory:shadowTokenTrajectory\.status\(\)/
  );

  assert.match(
    app,
    /\/api\/owner\/intelligence\/token-trajectories/
  );

  assert.match(
    app,
    /\/api\/owner\/intelligence\/token-trajectory/
  );

  const source=
    fs.readFileSync(
      'src/shadow-token-trajectory-v23_8.mjs',
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

  assert.doesNotMatch(
    source,
    /trajectoryScore/
  );

  console.log(
    'shadow token trajectory v23.8 ok'
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
python3 - <<'PYEOFNORM238'
from pathlib import Path
for name in ["memeflow-app/src/shadow-token-trajectory-v23_8.mjs","memeflow-app/tests/shadow-token-trajectory-v23_8.mjs"]:
    p=Path(name)
    p.write_text(p.read_text(encoding="utf-8").rstrip("\n")+"\n",encoding="utf-8")
print("V23_8_EOF_NORMALIZATION_OK")
PYEOFNORM238
python3 - <<'PYTRANSFORM238'
from pathlib import Path

shadow_path=Path("memeflow-app/src/token-intelligence-shadow-v23.mjs")
app_path=Path("memeflow-app/app-server.mjs")
shadow=shadow_path.read_text(encoding="utf-8")
app=app_path.read_text(encoding="utf-8")

def once(text,old,new,label):
    count=text.count(old)
    if count!=1:
        raise SystemExit(f"V23.8 REFUSED: {label}: expected 1 exact match, got {count}")
    return text.replace(old,new,1)

old="""import {
  createShadowConfidenceGovernorV23_7
} from './shadow-confidence-governor-v23_7.mjs';"""
new=old+"""
import {
  createShadowTokenTrajectoryMemoryV23_8
} from './shadow-token-trajectory-v23_8.mjs';"""
shadow=once(shadow,old,new,"trajectory import")

old="""  const shadowConfidenceGovernor=
    createShadowConfidenceGovernorV23_7();"""
new=old+"""

  const shadowTokenTrajectory=
    createShadowTokenTrajectoryMemoryV23_8({
      dataDir,
      maxMints:maxCells
    });"""
shadow=once(shadow,old,new,"trajectory construction")

old="""      snapshot.shadowConfidenceGovernor=
        shadowConfidenceGovernor.predict(
          snapshot,
          {mint}
        );
"""
new=old+"""
      // MEMEFLOW_TOKEN_TRAJECTORY_MEMORY_V23_8
      // Temporal memory only. It observes existing shadow diagnostics and
      // cannot mutate evaluate()/V22 or trading state.
      snapshot.shadowTokenTrajectory=
        shadowTokenTrajectory.observe(
          snapshot,
          {mint}
        );
"""
shadow=once(shadow,old,new,"trajectory observe wiring")

old="""        learningDataset.recordOutcome({
          anchor:cell.anchor,
          outcome
        });
"""
new=old+"""
        shadowTokenTrajectory.recordOutcome({
          anchor:cell.anchor,
          outcome
        });
"""
shadow=once(shadow,old,new,"trajectory outcome wiring")

old="""  function dropMint(mint,reason='DROPPED'){
    mint=String(mint||'');
    const cell=cells.get(mint);
    if(!cell)return false;
"""
new="""  function dropMint(mint,reason='DROPPED'){
    mint=String(mint||'');
    const cell=cells.get(mint);
    if(!cell)return false;

    shadowTokenTrajectory.markTerminal(
      mint,
      reason
    );
"""
shadow=once(shadow,old,new,"trajectory terminal wiring")

old="""      if(oldestKey===null)break;
      cells.delete(oldestKey);
      metrics.cellsEvicted++;
"""
new="""      if(oldestKey===null)break;

      shadowTokenTrajectory.markTerminal(
        oldestKey,
        'CELL_EVICTED'
      );

      cells.delete(oldestKey);
      metrics.cellsEvicted++;
"""
shadow=once(shadow,old,new,"trajectory eviction wiring")

old="""          shadowConfidenceGovernor:{
            status:
              snap?.shadowConfidenceGovernor?.status||'COLD_START',
            ready:
              snap?.shadowConfidenceGovernor?.ready===true,
            consensusProbabilityPositivePct:
              snap?.shadowConfidenceGovernor
                ?.consensusProbabilityPositivePct??null,
            ensembleConfidencePct:
              snap?.shadowConfidenceGovernor
                ?.ensembleConfidencePct??0,
            disagreementPct:
              snap?.shadowConfidenceGovernor
                ?.disagreementPct??null,
            agreementPct:
              snap?.shadowConfidenceGovernor
                ?.agreementPct??null,
            sourceCount:
              snap?.shadowConfidenceGovernor
                ?.sourceCount??0,
            validatedSourceCount:
              snap?.shadowConfidenceGovernor
                ?.validatedSourceCount??0,
            effectiveSourceCount:
              snap?.shadowConfidenceGovernor
                ?.effectiveSourceCount??0
          },
"""
new=old+"""          shadowTokenTrajectory:{
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
shadow=once(shadow,old,new,"trajectory cell summary")

shadow=once(shadow,"version:'MEMEFLOW_TOKEN_INTELLIGENCE_NETWORK_V23_7'","version:'MEMEFLOW_TOKEN_INTELLIGENCE_NETWORK_V23_8'","network version")

old="""      shadowDriftRegime:shadowDriftRegime.status(),
      shadowConfidenceGovernor:shadowConfidenceGovernor.status()
"""
new="""      shadowDriftRegime:shadowDriftRegime.status(),
      shadowConfidenceGovernor:shadowConfidenceGovernor.status(),
      shadowTokenTrajectory:shadowTokenTrajectory.status()
"""
shadow=once(shadow,old,new,"trajectory status")

old="""    listShadowConfidenceGovernorPredictions:
      options=>shadowConfidenceGovernor.listRecent(options),
    status
"""
new="""    listShadowConfidenceGovernorPredictions:
      options=>shadowConfidenceGovernor.listRecent(options),
    listTokenTrajectories:
      options=>shadowTokenTrajectory.list(options),
    inspectTokenTrajectory:
      mint=>shadowTokenTrajectory.inspect(mint),
    flushTokenTrajectories:
      ()=>shadowTokenTrajectory.flush(),
    status
"""
shadow=once(shadow,old,new,"trajectory public methods")
shadow_path.write_text(shadow,encoding="utf-8")

anchor="""/* MEMEFLOW_PUBLIC_AGENT_ENTITY_V2_ROUTES */
"""
route="""/* MEMEFLOW_TOKEN_TRAJECTORY_MONITOR_V23_8
 * Owner-only, read-only temporal Token Intelligence memory.
 */
 if(
   url.pathname==='/api/owner/intelligence/token-trajectories' &&
   req.method==='GET'
 ){
   if(!u)return json(res,401,{error:'AUTH_REQUIRED'});
   if(u.isOwner!==true)return json(res,403,{error:'OWNER_REQUIRED'});

   const limit=Math.max(
     1,
     Math.min(100,Number(url.searchParams.get('limit')||50))
   );

   const state=String(
     url.searchParams.get('state')||''
   ).trim().toUpperCase();

   return json(res,200,{
     ok:true,
     shadowOnly:true,
     memory:
       tokenIntelligenceShadowV23
         .status()
         .shadowTokenTrajectory,
     trajectories:
       tokenIntelligenceShadowV23
         .listTokenTrajectories({
           limit,
           state:state||null
         })
   });
 }

 if(
   url.pathname==='/api/owner/intelligence/token-trajectory' &&
   req.method==='GET'
 ){
   if(!u)return json(res,401,{error:'AUTH_REQUIRED'});
   if(u.isOwner!==true)return json(res,403,{error:'OWNER_REQUIRED'});

   const mint=String(
     url.searchParams.get('mint')||''
   ).trim();

   if(!mint){
     return json(res,400,{error:'MINT_REQUIRED'});
   }

   const trajectory=
     tokenIntelligenceShadowV23
       .inspectTokenTrajectory(mint);

   if(!trajectory){
     return json(res,404,{
       error:'TOKEN_TRAJECTORY_NOT_FOUND',
       mint
     });
   }

   return json(res,200,{
     ok:true,
     shadowOnly:true,
     trajectory
   });
 }

/* MEMEFLOW_PUBLIC_AGENT_ENTITY_V2_ROUTES */
"""
app=once(app,anchor,route,"trajectory owner routes")
app_path.write_text(app,encoding="utf-8")
print("V23_8_TRANSFORM_OK")
PYTRANSFORM238
python3 - <<'PYPACKAGE238'
import json
from pathlib import Path
path=Path("memeflow-app/package.json")
data=json.loads(path.read_text(encoding="utf-8"))
script=data["scripts"]["test:core"]
needle="node tests/shadow-confidence-governor-v23_7.mjs && node tests/assist-fresh-decision-v22.mjs"
replacement="node tests/shadow-confidence-governor-v23_7.mjs && node tests/shadow-token-trajectory-v23_8.mjs && node tests/assist-fresh-decision-v22.mjs"
if script.count(needle)!=1:
    raise SystemExit("V23.8 REFUSED: package test anchor changed")
if "shadow-token-trajectory-v23_8.mjs" in script:
    raise SystemExit("V23.8 REFUSED: trajectory test already installed")
data["scripts"]["test:core"]=script.replace(needle,replacement,1)
path.write_text(json.dumps(data,indent=2)+"\n",encoding="utf-8")
print("PACKAGE_TRANSFORM_OK")
PYPACKAGE238

echo; echo "=== V23.8 PRECHECK ==="
grep -q "MEMEFLOW_TOKEN_TRAJECTORY_MEMORY_V23_8" "$TRAJECTORY"
grep -q "createShadowTokenTrajectoryMemoryV23_8" "$SHADOW"
grep -q "shadowTokenTrajectory.observe" "$SHADOW"
grep -q "MEMEFLOW_TOKEN_TRAJECTORY_MONITOR_V23_8" "$APP"
grep -q "shadow-token-trajectory-v23_8.mjs" "$PKG"
echo "PRECHECK_OK"

echo; echo "=== V23.8 SYNTAX ==="
node --check "$APP"
node --check "$SHADOW"
node --check "$TRAJECTORY"
node --check "$TEST"
node -e "JSON.parse(require('fs').readFileSync('$PKG','utf8')); console.log('PACKAGE_JSON_OK')"
echo "SYNTAX_OK"

echo; echo "=== V23.8 TARGETED TESTS ==="
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
  node tests/opportunity-engine.mjs
  node tests/canonical-live-score-pipeline-v20_8_8.mjs
  node tests/lifecycle-decision-v22.mjs
  node tests/assist-fresh-decision-v22.mjs
)
echo "TARGETED_TESTS_OK"

echo; echo "=== V23.8 FULL PROJECT TEST SUITE ==="
(cd memeflow-app && npm test)
echo "FULL_TEST_SUITE_OK"

echo; echo "=== V23.8 STATIC CONTRACT AUDIT ==="
python3 - <<'PYAUDIT238'
from pathlib import Path
trajectory=Path("memeflow-app/src/shadow-token-trajectory-v23_8.mjs").read_text(encoding="utf-8")
shadow=Path("memeflow-app/src/token-intelligence-shadow-v23.mjs").read_text(encoding="utf-8")
app=Path("memeflow-app/app-server.mjs").read_text(encoding="utf-8")
pkg=Path("memeflow-app/package.json").read_text(encoding="utf-8")
errors=[]
for marker in ["MEMEFLOW_TOKEN_TRAJECTORY_MEMORY_V23_8","trajectoryState","RISING","FADING","CONFLICTED","DRIFTED","recordOutcome","forecastQuality","horizonQuality","token-trajectory-v23-8.jsonl"]:
    if marker not in trajectory: errors.append(f"trajectory marker missing: {marker}")
for forbidden in ["from './evaluate.mjs'",'from "./evaluate.mjs"',"openPosition(","closePosition(","setSettings(","tradeEligible","decisionScore","trajectoryScore"]:
    if forbidden in trajectory: errors.append(f"trajectory trading authority forbidden: {forbidden}")
for marker in ["createShadowTokenTrajectoryMemoryV23_8","shadowTokenTrajectory.observe","shadowTokenTrajectory.recordOutcome","shadowTokenTrajectory.markTerminal","shadowTokenTrajectory:shadowTokenTrajectory.status()","listTokenTrajectories","inspectTokenTrajectory","MEMEFLOW_TOKEN_INTELLIGENCE_NETWORK_V23_8"]:
    if marker not in shadow: errors.append(f"trajectory wiring missing: {marker}")
pos=shadow.find("snapshot.shadowTokenTrajectory=")
for marker in ["snapshot.shadowMathBrain=","snapshot.shadowModelArena=","snapshot.shadowDriftRegime=","snapshot.shadowConfidenceGovernor="]:
    marker_pos=shadow.find(marker)
    if marker_pos<0 or pos<0 or marker_pos>=pos: errors.append(f"trajectory ordering invalid: {marker}")
for marker in ["/api/owner/intelligence/token-trajectories","/api/owner/intelligence/token-trajectory","MEMEFLOW_TOKEN_TRAJECTORY_MONITOR_V23_8","listTokenTrajectories","inspectTokenTrajectory"]:
    if marker not in app: errors.append(f"trajectory monitor missing: {marker}")
if "shadow-token-trajectory-v23_8.mjs" not in pkg: errors.append("V23.8 regression missing from test:core")
for marker in ["walletReputation.recordOutcome","learningDataset.recordOutcome","shadowMathBrain.predict","shadowModelArena.predict","shadowDriftRegime.predict","shadowConfidenceGovernor.predict"]:
    if marker not in shadow: errors.append(f"backward compatibility missing: {marker}")
if errors:
    raise SystemExit("V23_8_CONTRACT_FAILED:\n- "+"\n- ".join(errors))
print("V23_8_CONTRACT_OK")
PYAUDIT238

git diff --check -- "${ALL_FILES[@]}"
echo; echo "=== V23.8 DIFF ==="
git diff --stat -- "${ALL_FILES[@]}"
mf_clear_stale_index_lock
git reset >/dev/null
mf_clear_stale_index_lock
git add "${ALL_FILES[@]}"
ALLOWED_RE='^memeflow-app/(app-server\.mjs|package\.json|src/token-intelligence-shadow-v23\.mjs|src/shadow-token-trajectory-v23_8\.mjs|tests/shadow-token-trajectory-v23_8\.mjs)$'
BAD="$(git diff --cached --name-only | grep -Ev "$ALLOWED_RE" || true)"
if [[ -n "$BAD" ]]; then echo "ERROR: unrelated staged files:"; echo "$BAD"; git reset; exit 1; fi
git diff --cached --check
echo; echo "=== V23.8 STAGED ==="
git diff --cached --stat
git commit -m "feat: add persistent token trajectory memory v23.8"
git push origin HEAD
trap - EXIT INT TERM
echo; echo "=== DONE ==="
echo "Backup: $BACKUP"
git log -1 --oneline --decorate
echo; echo "V23.8 CONTRACT:"
echo "  evaluate()/V22 remains the only trading authority"
echo "  each tracked token gets bounded temporal trajectory memory"
echo "  trajectory tracks rising/fading/conflicted/drifted/regime-shift states"
echo "  meaningful trajectory points persist across restart in JSONL"
echo "  labeled outcomes measure historical forecast Brier/accuracy by horizon"
echo "  active-cell eviction does not erase persisted trajectory history"
echo "  owner-only trajectory list/inspect endpoints are read-only"
echo "  no Score/State/BUY/SELL mutation"
