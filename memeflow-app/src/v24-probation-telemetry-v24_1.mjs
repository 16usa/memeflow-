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
