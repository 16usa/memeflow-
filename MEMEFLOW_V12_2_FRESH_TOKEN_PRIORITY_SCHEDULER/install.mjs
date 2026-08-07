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

const backup=serverPath+'.before-v12-2-fresh-token-priority';
if(!fs.existsSync(backup))fs.copyFileSync(serverPath,backup);

let s=fs.readFileSync(serverPath,'utf8');

if(!s.includes('MEMEFLOW_V12_1_PIPELINE_STABILITY')){
  console.error('ABORT: V12.1 is not installed. Install V12.1 first.');
  process.exit(1);
}

if(!s.includes('MEMEFLOW_V12_2_FRESH_TOKEN_PRIORITY_SCHEDULER')){
  const anchor="const BRIDGE_MIN_TOKEN_AGE_MS=Math.max(1500,Number(process.env.DISCOVERY_BRIDGE_MIN_TOKEN_AGE_MS||3000));";
  if(!s.includes(anchor)){
    console.error('ABORT: V12.1 constants anchor missing');
    process.exit(1);
  }

  s=s.replace(anchor, anchor + `
/* MEMEFLOW_V12_2_FRESH_TOKEN_PRIORITY_SCHEDULER */
const FRESH_PRIORITY_MAX_AGE_MS=Math.max(10000,Number(process.env.FRESH_PRIORITY_MAX_AGE_MS||45000));
const FRESH_PRIORITY_BATCH=Math.max(1,Number(process.env.FRESH_PRIORITY_BATCH||3));
const RECOVERY_BATCH=Math.max(1,Number(process.env.RECOVERY_BATCH||2));
const BRIDGE_ITEM_TIMEOUT_MS=Math.max(3000,Number(process.env.BRIDGE_ITEM_TIMEOUT_MS||12000));
bridgeMetrics.freshPriorityRuns=bridgeMetrics.freshPriorityRuns||0;
bridgeMetrics.freshPriorityStarted=bridgeMetrics.freshPriorityStarted||0;
bridgeMetrics.freshPrioritySucceeded=bridgeMetrics.freshPrioritySucceeded||0;
bridgeMetrics.freshPriorityTimedOut=bridgeMetrics.freshPriorityTimedOut||0;
bridgeMetrics.recoveryStarted=bridgeMetrics.recoveryStarted||0;
bridgeMetrics.recoverySucceeded=bridgeMetrics.recoverySucceeded||0;
bridgeMetrics.itemTimeouts=bridgeMetrics.itemTimeouts||0;
bridgeMetrics.freshPriorityBatch=FRESH_PRIORITY_BATCH;
bridgeMetrics.recoveryBatch=RECOVERY_BATCH;
`);

  const fnStart=s.indexOf('async function runDiscoveryBridge(){');
  if(fnStart<0){
    console.error('ABORT: runDiscoveryBridge() missing');
    process.exit(1);
  }
  const brace=s.indexOf('{',fnStart);
  let depth=0, fnEnd=-1;
  for(let i=brace;i<s.length;i++){
    if(s[i]==='{')depth++;
    else if(s[i]==='}'){
      depth--;
      if(depth===0){fnEnd=i+1;break}
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
          const e=new Error('V12.2 '+label+' timeout for '+mint);
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

    // V12.2: split the work into two lanes.
    // Lane A: newest fresh Pump tokens first.
    // Lane B: older missed work in the background.
    const fresh=all
      .filter(t=>bridgeAgeMs(t,now)<=FRESH_PRIORITY_MAX_AGE_MS)
      .sort((a,b)=>Number(b?.discoveredAt||0)-Number(a?.discoveredAt||0))
      .slice(0,FRESH_PRIORITY_BATCH);

    const freshMints=new Set(fresh.map(bridgeMint));
    const recovery=all
      .filter(t=>!freshMints.has(bridgeMint(t)))
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

  // Add scheduling lane diagnostics to same-instance output if present.
  if(s.includes("diagnosticVersion:'V10.2-same-instance'") && !s.includes('schedulerLane')){
    const ageAnchor="ageMinutes:discovered>0?Math.max(0,(now-discovered)/60000):null,";
    if(s.includes(ageAnchor)){
      s=s.replace(ageAnchor, ageAnchor + `
        schedulerLane:
          discovered>0 && now-discovered<=FRESH_PRIORITY_MAX_AGE_MS
            ?'fresh-priority'
            :'recovery',`);
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
console.log('PASS: fresh-token priority lane installed');
console.log('PASS: background recovery lane installed');
console.log('PASS: per-item timeout prevents one slow mint blocking the scheduler');
console.log('V12.2 INSTALLED');
