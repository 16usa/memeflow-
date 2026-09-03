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
