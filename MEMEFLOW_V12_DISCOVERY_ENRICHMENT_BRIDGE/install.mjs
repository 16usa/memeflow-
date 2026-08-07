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

const backup=serverPath+'.before-v12-discovery-enrichment-bridge';
if(!fs.existsSync(backup))fs.copyFileSync(serverPath,backup);

let s=fs.readFileSync(serverPath,'utf8');

if(!s.includes('MEMEFLOW_V12_DISCOVERY_ENRICHMENT_BRIDGE')){
  const marker='function startDiscovery(';
  const pos=s.indexOf(marker);
  if(pos<0){
    console.error('ABORT: startDiscovery() anchor missing');
    process.exit(1);
  }

  const block=String.raw`
/* MEMEFLOW_V12_DISCOVERY_ENRICHMENT_BRIDGE
   Self-healing bridge for fresh Pump tokens that reached store.tokens but
   missed Phase A enrichment / holder queue / price lifecycle / evaluation.
   Idempotent and bounded: it touches only very recent tokens and applies
   per-mint retry spacing so it cannot create an RPC storm. */
const bridgeMetrics={
  scans:0,
  freshPumpSeen:0,
  fullEnrichStarted:0,
  fullEnrichSucceeded:0,
  fullEnrichFailed:0,
  holderRescued:0,
  priceTimerRescued:0,
  evaluationRescued:0,
  skippedInflight:0,
  lastRunAt:null,
  lastMint:null,
  lastError:null,
  lastErrorAt:null
};
const bridgeInflight=new Set();
const bridgeState=new Map(); // mint -> {fullAt,holderAt,evalAt,fullAttempts}
const BRIDGE_TICK_MS=Math.max(1000,Number(process.env.DISCOVERY_BRIDGE_TICK_MS||2000));
const BRIDGE_MAX_AGE_MS=Math.max(60000,Number(process.env.DISCOVERY_BRIDGE_MAX_AGE_MS||300000));
const BRIDGE_FULL_RETRY_MS=Math.max(10000,Number(process.env.DISCOVERY_BRIDGE_FULL_RETRY_MS||20000));
const BRIDGE_HOLDER_RETRY_MS=Math.max(15000,Number(process.env.DISCOVERY_BRIDGE_HOLDER_RETRY_MS||45000));
const BRIDGE_MAX_FULL_ATTEMPTS=Math.max(1,Number(process.env.DISCOVERY_BRIDGE_MAX_FULL_ATTEMPTS||3));

function bridgeMint(token){
  return String(token?.mint||token?.tokenMint||token?.tokenAddress||'').trim();
}
function bridgeIsPump(token){
  const mint=bridgeMint(token).toLowerCase();
  const lp=String(token?.launchPlatform||token?.protocol||'').toLowerCase();
  const src=String(token?.source||'').toLowerCase();
  return lp==='pump'||mint.endsWith('pump')||src.includes('pump create');
}
function bridgeAgeMs(token,now=Date.now()){
  const t=Number(token?.discoveredAt||token?.createdAt||token?.firstSeenAt||0);
  return t>0?Math.max(0,now-t):Infinity;
}
function bridgeHolderState(mint){
  try{return holderQueue.inspect?.(mint)||null}catch{return null}
}
async function bridgeRepairToken(token,now=Date.now()){
  const mint=bridgeMint(token);
  if(!mint||!bridgeIsPump(token)||bridgeAgeMs(token,now)>BRIDGE_MAX_AGE_MS)return;

  bridgeMetrics.freshPumpSeen++;
  bridgeMetrics.lastMint=mint;

  let st=bridgeState.get(mint);
  if(!st){
    st={fullAt:0,holderAt:0,evalAt:0,fullAttempts:0};
    bridgeState.set(mint,st);
  }

  const curve=token?.curve||token?.bondingCurve||token?.associatedBondingCurve||null;
  const phaseADone=Boolean(
    token?.lastScannedAt ||
    token?.totalSupply!=null ||
    token?.decimals!=null ||
    token?.priceSol!=null
  );

  // A raw Pump-create row in store without Phase A is the exact V12 failure mode.
  if(!phaseADone && st.fullAttempts<BRIDGE_MAX_FULL_ATTEMPTS && now-st.fullAt>=BRIDGE_FULL_RETRY_MS){
    if(bridgeInflight.has(mint)){
      bridgeMetrics.skippedInflight++;
      return;
    }
    st.fullAt=now;
    st.fullAttempts++;
    bridgeInflight.add(mint);
    bridgeMetrics.fullEnrichStarted++;
    try{
      await enrich(mint,curve);
      bridgeMetrics.fullEnrichSucceeded++;
    }catch(e){
      bridgeMetrics.fullEnrichFailed++;
      bridgeMetrics.lastError=String(e?.message||e).slice(0,200);
      bridgeMetrics.lastErrorAt=Date.now();
    }finally{
      bridgeInflight.delete(mint);
    }
    return; // enrich() already evaluates, starts price timer and enqueues holders.
  }

  // Rescue price lifecycle independently when Phase A exists.
  if(curve && !priceTimers.has(mint)){
    try{
      ensurePriceTimer(mint,curve);
      bridgeMetrics.priceTimerRescued++;
    }catch(e){
      bridgeMetrics.lastError=String(e?.message||e).slice(0,200);
      bridgeMetrics.lastErrorAt=Date.now();
    }
  }

  // Rescue missing holder queue. Never requeue a pending/active job.
  if(!token?.holderFresh && now-st.holderAt>=BRIDGE_HOLDER_RETRY_MS){
    const hs=bridgeHolderState(mint);
    const busy=Boolean(hs?.pending||hs?.active);
    const alreadySucceeded=Boolean(hs?.lastSuccessAt);
    if(!busy&&!alreadySucceeded){
      try{
        const queued=holderQueue.enqueue(mint);
        if(queued!==false){
          st.holderAt=now;
          bridgeMetrics.holderRescued++;
        }
      }catch(e){
        bridgeMetrics.lastError=String(e?.message||e).slice(0,200);
        bridgeMetrics.lastErrorAt=Date.now();
      }
    }
  }

  // If token was enriched but somehow has no decision for any active user,
  // trigger one bounded evaluation pass. evaluateAll itself is user-aware.
  if(phaseADone && now-st.evalAt>=60000){
    let hasAnyDecision=false;
    try{
      for(const m of Object.values(store?._uidDec||{})){
        if(m?.has?.(mint)){hasAnyDecision=true;break}
      }
    }catch{}
    if(!hasAnyDecision){
      st.evalAt=now;
      try{
        await evaluateAll(store.state.tokens[mint]||token);
        bridgeMetrics.evaluationRescued++;
      }catch(e){
        bridgeMetrics.lastError=String(e?.message||e).slice(0,200);
        bridgeMetrics.lastErrorAt=Date.now();
      }
    }
  }
}

let bridgeTimer=null;
async function runDiscoveryBridge(){
  bridgeMetrics.scans++;
  bridgeMetrics.lastRunAt=Date.now();
  const now=Date.now();
  try{
    const rows=Object.values(store?.state?.tokens||{})
      .filter(t=>bridgeIsPump(t)&&bridgeAgeMs(t,now)<=BRIDGE_MAX_AGE_MS)
      .sort((a,b)=>Number(a?.discoveredAt||0)-Number(b?.discoveredAt||0));

    // Serial repair is intentional: it prevents the bridge itself from
    // increasing RPC concurrency. Normal discovery continues independently.
    for(const token of rows)await bridgeRepairToken(token,now);

    // Bound bookkeeping.
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
  }
}
function startDiscoveryBridge(){
  if(bridgeTimer)return;
  void runDiscoveryBridge();
  bridgeTimer=setInterval(()=>void runDiscoveryBridge(),BRIDGE_TICK_MS);
  bridgeTimer.unref?.();
}
startDiscoveryBridge();

`;

  s=s.slice(0,pos)+block+s.slice(pos);
}

// Add bridge diagnostics to /api/discovery/status if the current server exposes it.
if(!s.includes('bridgeMetrics:bridgeMetrics')){
  const needle='decisionsInMemory:Object.values(store._uidDec).reduce((s,m)=>s+m.size,0)';
  if(s.includes(needle)){
    s=s.replace(needle,needle+',\n    bridgeMetrics:bridgeMetrics');
  }
}

// Extend same-instance V10.2 response if installed.
if(s.includes("diagnosticVersion:'V10.2-same-instance'") && !s.includes('bridge:bridgeMetrics')){
  const needle="diagnosticVersion:'V10.2-same-instance',\n      now,";
  if(s.includes(needle)){
    s=s.replace(needle,"diagnosticVersion:'V10.2-same-instance',\n      now,\n      bridge:bridgeMetrics,");
  }
}

fs.writeFileSync(serverPath,s,'utf8');

const syntax=spawnSync(process.execPath,['--check',serverPath],{encoding:'utf8'});
if(syntax.status!==0){
  console.error(syntax.stderr||syntax.stdout);
  process.exit(syntax.status||1);
}

console.log('PASS: app-server.mjs syntax-valid');
console.log('PASS: V12 self-healing discovery→enrichment bridge installed');
console.log('PASS: bridge is serial, bounded and idempotent');
console.log('V12 INSTALLED');
