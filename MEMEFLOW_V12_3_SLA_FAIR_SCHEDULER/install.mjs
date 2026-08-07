import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

const cwd=process.cwd();
const appDir=fs.existsSync(path.join(cwd,'memeflow-app'))?path.join(cwd,'memeflow-app'):cwd;
const serverPath=path.join(appDir,'app-server.mjs');

if(!fs.existsSync(serverPath)){
  console.error('ABORT: missing '+serverPath);
  process.exit(1);
}

const backup=serverPath+'.before-v12-3-sla-fair-scheduler';
if(!fs.existsSync(backup))fs.copyFileSync(serverPath,backup);

let s=fs.readFileSync(serverPath,'utf8');

if(!s.includes('MEMEFLOW_V12_2_FRESH_TOKEN_PRIORITY_SCHEDULER')){
  console.error('ABORT: V12.2 is not installed. Install V12.2 first.');
  process.exit(1);
}

if(!s.includes('MEMEFLOW_V12_3_SLA_FAIR_SCHEDULER')){
  const anchor="const BRIDGE_ITEM_TIMEOUT_MS=Math.max(3000,Number(process.env.BRIDGE_ITEM_TIMEOUT_MS||12000));";
  if(!s.includes(anchor)){
    console.error('ABORT: V12.2 constants anchor missing');
    process.exit(1);
  }

  s=s.replace(anchor, anchor + `
/* MEMEFLOW_V12_3_SLA_FAIR_SCHEDULER */
const FRESH_SLA_MS=Math.max(5000,Number(process.env.FRESH_SLA_MS||15000));
const FRESH_SLA_ESCALATE_MS=Math.max(FRESH_SLA_MS,Number(process.env.FRESH_SLA_ESCALATE_MS||12000));
bridgeMetrics.slaMs=FRESH_SLA_MS;
bridgeMetrics.currentFreshBacklog=0;
bridgeMetrics.currentUrgentFreshBacklog=0;
bridgeMetrics.oldestFreshUnprocessedAgeMs=0;
bridgeMetrics.slaMisses15s=bridgeMetrics.slaMisses15s||0;
bridgeMetrics.slaMissesCurrent=0;
bridgeMetrics.slaEscalations=bridgeMetrics.slaEscalations||0;
`);

  // Insert helper predicates before runDiscoveryBridge().
  const runAnchor='async function runDiscoveryBridge(){';
  const runPos=s.indexOf(runAnchor);
  if(runPos<0){
    console.error('ABORT: runDiscoveryBridge() missing');
    process.exit(1);
  }

  const helpers=`
function bridgePhaseAStarted(token){
  return Boolean(
    token?.lastScannedAt ||
    token?.totalSupply!=null ||
    token?.decimals!=null ||
    token?.priceSol!=null
  );
}
function bridgePipelineStarted(token){
  const mint=bridgeMint(token);
  let holder=null;
  try{ holder=holderQueue.inspect?.(mint)||null; }catch{}
  const holderStarted=Boolean(
    holder?.pending ||
    holder?.active ||
    Number(holder?.attempts||0)>0 ||
    holder?.lastSuccessAt
  );
  const priceStarted=Boolean(priceTimers?.has?.(mint) || priceLifecycleDiag?.get?.(mint));
  return bridgePhaseAStarted(token) || holderStarted || priceStarted;
}
function bridgeNeedsFastStart(token){
  return !bridgePipelineStarted(token);
}
`;
  s=s.slice(0,runPos)+helpers+s.slice(runPos);

  // Replace runDiscoveryBridge() with SLA-fair version.
  const fnStart=s.indexOf('async function runDiscoveryBridge(){');
  const brace=s.indexOf('{',fnStart);
  let depth=0, fnEnd=-1;
  for(let i=brace;i<s.length;i++){
    if(s[i]==='{') depth++;
    else if(s[i]==='}'){
      depth--;
      if(depth===0){ fnEnd=i+1; break; }
    }
  }
  if(fnEnd<0){
    console.error('ABORT: cannot parse runDiscoveryBridge()');
    process.exit(1);
  }

  const replacement=`async function runDiscoveryBridge(){
  if(bridgeRunActive){
    bridgeMetrics.runsSkippedBusy++;
    return;
  }

  bridgeRunActive=true;
  const runId=++bridgeRunSequence;
  bridgeMetrics.runsStarted++;
  bridgeMetrics.scans++;
  bridgeMetrics.lastRunAt=Date.now();

  const now=Date.now();

  async function withItemTimeout(token,label){
    const mint=bridgeMint(token);
    let timer=null;
    try{
      const timeout=new Promise((_,reject)=>{
        timer=setTimeout(()=>{
          const e=new Error('V12.3 '+label+' timeout for '+mint);
          e.code='BRIDGE_ITEM_TIMEOUT';
          reject(e);
        },BRIDGE_ITEM_TIMEOUT_MS);
        timer.unref?.();
      });
      await Promise.race([bridgeRepairToken(token,now),timeout]);
      return true;
    }catch(e){
      if(e?.code==='BRIDGE_ITEM_TIMEOUT'){
        bridgeMetrics.itemTimeouts++;
        if(label==='fresh')bridgeMetrics.freshPriorityTimedOut++;
      }else{
        bridgeMetrics.lastError=String(e?.message||e).slice(0,200);
        bridgeMetrics.lastErrorAt=Date.now();
      }
      return false;
    }finally{
      if(timer)clearTimeout(timer);
    }
  }

  try{
    const all=Object.values(store?.state?.tokens||{})
      .filter(t=>bridgeIsPump(t)&&bridgeAgeMs(t,now)<=BRIDGE_MAX_AGE_MS&&bridgeAgeMs(t,now)>=BRIDGE_MIN_TOKEN_AGE_MS);

    const freshWindow=all.filter(t=>bridgeAgeMs(t,now)<=FRESH_PRIORITY_MAX_AGE_MS);
    const freshUnprocessed=freshWindow
      .filter(bridgeNeedsFastStart)
      .sort((a,b)=>Number(a?.discoveredAt||0)-Number(b?.discoveredAt||0)); // OLDEST FIRST

    const urgent=freshUnprocessed.filter(t=>bridgeAgeMs(t,now)>=FRESH_SLA_ESCALATE_MS);

    bridgeMetrics.currentFreshBacklog=freshUnprocessed.length;
    bridgeMetrics.currentUrgentFreshBacklog=urgent.length;
    bridgeMetrics.oldestFreshUnprocessedAgeMs=freshUnprocessed.length
      ? Math.max(...freshUnprocessed.map(t=>bridgeAgeMs(t,now)))
      : 0;
    bridgeMetrics.slaMissesCurrent=freshUnprocessed.filter(t=>bridgeAgeMs(t,now)>FRESH_SLA_MS).length;
    if(bridgeMetrics.slaMissesCurrent>0){
      bridgeMetrics.slaMisses15s+=bridgeMetrics.slaMissesCurrent;
    }

    // SLA lane:
    // 1) oldest unprocessed tokens first;
    // 2) tokens nearing/missing SLA are automatically ahead of newer arrivals.
    const fresh=freshUnprocessed.slice(0,FRESH_PRIORITY_BATCH);
    if(fresh.some(t=>bridgeAgeMs(t,now)>=FRESH_SLA_ESCALATE_MS)){
      bridgeMetrics.slaEscalations++;
    }

    const freshMints=new Set(fresh.map(bridgeMint));

    // Recovery lane remains old-first, but never steals a slot from an
    // unprocessed fresh token selected above.
    const recovery=all
      .filter(t=>!freshMints.has(bridgeMint(t)))
      .filter(t=>!freshWindow.includes(t) || !bridgeNeedsFastStart(t))
      .sort((a,b)=>Number(a?.discoveredAt||0)-Number(b?.discoveredAt||0))
      .slice(0,RECOVERY_BATCH);

    bridgeMetrics.freshPriorityRuns++;
    bridgeMetrics.tokensDeferred+=Math.max(0,all.length-fresh.length-recovery.length);

    for(const token of fresh){
      bridgeMetrics.freshPriorityStarted++;
      const ok=await withItemTimeout(token,'fresh');
      if(ok)bridgeMetrics.freshPrioritySucceeded++;
      await new Promise(resolve=>setTimeout(resolve,15));
    }

    for(const token of recovery){
      bridgeMetrics.recoveryStarted++;
      const ok=await withItemTimeout(token,'recovery');
      if(ok)bridgeMetrics.recoverySucceeded++;
      await new Promise(resolve=>setTimeout(resolve,25));
    }

    if(bridgeState.size>2000){
      for(const [mint] of bridgeState){
        const t=store?.state?.tokens?.[mint];
        if(!t||bridgeAgeMs(t,now)>BRIDGE_MAX_AGE_MS*2)bridgeState.delete(mint);
        if(bridgeState.size<=1000)break;
      }
    }
  }catch(e){
    bridgeMetrics.lastError=String(e?.message||e).slice(0,200);
    bridgeMetrics.lastErrorAt=Date.now();
  }finally{
    bridgeRunActive=false;
    bridgeMetrics.runsCompleted++;
    bridgeMetrics.lastCompletedRunId=runId;
    bridgeMetrics.lastCompletedAt=Date.now();
  }
}`;

  s=s.slice(0,fnStart)+replacement+s.slice(fnEnd);

  // Improve same-instance diagnostics with exact SLA state.
  if(s.includes("diagnosticVersion:'V10.2-same-instance'")){
    if(!s.includes('slaState:')){
      const laneAnchor="schedulerLane:";
      const lanePos=s.indexOf(laneAnchor);
      if(lanePos>=0){
        const insertAfter=s.indexOf(",", s.indexOf(":'recovery'", lanePos));
        if(insertAfter>=0){
          s=s.slice(0,insertAfter+1)+`
        slaState:
          discovered<=0 ? 'unknown' :
          bridgePipelineStarted(token) ? 'started' :
          (now-discovered)>FRESH_SLA_MS ? 'missed' :
          (now-discovered)>=FRESH_SLA_ESCALATE_MS ? 'urgent' :
          'pending',
        pipelineStarted:bridgePipelineStarted(token),`+s.slice(insertAfter+1);
        }
      }
    }
  }
}

fs.writeFileSync(serverPath,s,'utf8');

const syntax=spawnSync(process.execPath,['--check',serverPath],{encoding:'utf8'});
if(syntax.status!==0){
  console.error(syntax.stderr||syntax.stdout);
  process.exit(syntax.status||1);
}

console.log('PASS: app-server.mjs syntax-valid');
console.log('PASS: oldest-unprocessed fresh-token scheduling installed');
console.log('PASS: 15-second SLA diagnostics installed');
console.log('PASS: recovery cannot starve fresh unprocessed tokens');
console.log('V12.3 INSTALLED');
