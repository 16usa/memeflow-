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

const backup=serverPath+'.before-v12-1-pipeline-stability';
if(!fs.existsSync(backup))fs.copyFileSync(serverPath,backup);

let s=fs.readFileSync(serverPath,'utf8');

if(!s.includes('MEMEFLOW_V12_DISCOVERY_ENRICHMENT_BRIDGE')){
  console.error('ABORT: V12 bridge is not installed. Install V12 first.');
  process.exit(1);
}

if(!s.includes('MEMEFLOW_V12_1_PIPELINE_STABILITY')){
  // 1) Add a true global run lock + bounded batch controls next to V12 constants.
  const constAnchor="const BRIDGE_MAX_FULL_ATTEMPTS=Math.max(1,Number(process.env.DISCOVERY_BRIDGE_MAX_FULL_ATTEMPTS||3));";
  if(!s.includes(constAnchor)){
    console.error('ABORT: V12 constants anchor missing');
    process.exit(1);
  }
  s=s.replace(constAnchor, constAnchor + `
/* MEMEFLOW_V12_1_PIPELINE_STABILITY */
const BRIDGE_MAX_PER_RUN=Math.max(1,Number(process.env.DISCOVERY_BRIDGE_MAX_PER_RUN||4));
const BRIDGE_MIN_TOKEN_AGE_MS=Math.max(1500,Number(process.env.DISCOVERY_BRIDGE_MIN_TOKEN_AGE_MS||3000));
let bridgeRunActive=false;
let bridgeRunSequence=0;
bridgeMetrics.runsStarted=bridgeMetrics.runsStarted||0;
bridgeMetrics.runsCompleted=bridgeMetrics.runsCompleted||0;
bridgeMetrics.runsSkippedBusy=bridgeMetrics.runsSkippedBusy||0;
bridgeMetrics.tokensDeferred=bridgeMetrics.tokensDeferred||0;
bridgeMetrics.maxPerRun=BRIDGE_MAX_PER_RUN;
`);

  // 2) Do not touch a token in the first few seconds after discovery.
  const repairGuard="if(!mint||!bridgeIsPump(token)||bridgeAgeMs(token,now)>BRIDGE_MAX_AGE_MS)return;";
  if(!s.includes(repairGuard)){
    console.error('ABORT: bridgeRepairToken guard anchor missing');
    process.exit(1);
  }
  s=s.replace(repairGuard,
`if(!mint||!bridgeIsPump(token)||bridgeAgeMs(token,now)>BRIDGE_MAX_AGE_MS)return;
  // Give the normal discovery path a short head start. The bridge is recovery,
  // not the primary pipeline.
  if(bridgeAgeMs(token,now)<BRIDGE_MIN_TOKEN_AGE_MS)return;`);

  // 3) Replace runDiscoveryBridge with a locked/bounded version.
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
  try{
    const all=Object.values(store?.state?.tokens||{})
      .filter(t=>bridgeIsPump(t)&&bridgeAgeMs(t,now)<=BRIDGE_MAX_AGE_MS&&bridgeAgeMs(t,now)>=BRIDGE_MIN_TOKEN_AGE_MS)
      .sort((a,b)=>Number(a?.discoveredAt||0)-Number(b?.discoveredAt||0));

    // Recovery must never monopolize RPC. Process only a small bounded batch,
    // oldest-first, and let the normal holder/price workers breathe.
    const rows=all.slice(0,BRIDGE_MAX_PER_RUN);
    bridgeMetrics.tokensDeferred+=Math.max(0,all.length-rows.length);

    for(const token of rows){
      await bridgeRepairToken(token,now);
      // Small cooperative yield: lets holder queue timers and HTTP work run.
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

  // 4) Add a lightweight stalled-work diagnosis to the same-instance endpoint.
  if(s.includes("diagnosticVersion:'V10.2-same-instance'")){
    const sampleMapAnchor="const sample=pumpTokens.map(token=>{";
    if(s.includes(sampleMapAnchor)){
      // Add computed queue age/stall info immediately after holder lookup.
      const holderAnchor="const holder=holderQueue.inspect?.(mint)||null;";
      if(s.includes(holderAnchor) && !s.includes('holderStallReason')){
        s=s.replace(holderAnchor, holderAnchor + `
      const queuedAt=Number(holder?.queuedAt||0);
      const nextDueAt=Number(holder?.nextDueAt||0);
      const holderStallReason=
        holder?.pending&&!holder?.active&&Number(holder?.attempts||0)===0&&
        nextDueAt>0&&nextDueAt<=now&&queuedAt>0&&now-queuedAt>10000
          ?'READY_BUT_NOT_STARTED_10S'
          :null;`);
        const outAnchor="holderQueue:holder,";
        if(s.includes(outAnchor)){
          s=s.replace(outAnchor,"holderQueue:holder,\n        holderStallReason,");
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
console.log('PASS: V12 bridge global lock installed');
console.log('PASS: V12 recovery batch bounded to a small number per run');
console.log('PASS: normal discovery gets a short head start before recovery');
console.log('PASS: stalled-holder diagnostic added when V10.2 endpoint is present');
console.log('V12.1 INSTALLED');
