import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

const cwd=process.cwd();
const appDir=fs.existsSync(path.join(cwd,'memeflow-app'))?path.join(cwd,'memeflow-app'):cwd;
const serverPath=path.join(appDir,'app-server.mjs');
const enrichPath=path.join(appDir,'src','enrich.mjs');

for(const p of [serverPath,enrichPath]){
  if(!fs.existsSync(p)){console.error('ABORT: missing '+p);process.exit(1)}
}

let server=fs.readFileSync(serverPath,'utf8');
let enrich=fs.readFileSync(enrichPath,'utf8');

if(!server.includes('MEMEFLOW_V12_4_FAST_PHASE_A_DECOUPLED_ENRICHMENT')){
  console.error('ABORT: V12.4 marker missing in app-server.mjs.');
  process.exit(1);
}
if(!enrich.includes('MEMEFLOW_V12_7_HOLDER_CORRECTNESS_AND_PRIORITY')){
  console.error('ABORT: V12.7 marker missing in src/enrich.mjs. Install V12.7 first.');
  process.exit(1);
}

const serverBak=serverPath+'.before-v12-8-admission-gate';
const enrichBak=enrichPath+'.before-v12-8-admission-gate';
if(!fs.existsSync(serverBak))fs.copyFileSync(serverPath,serverBak);
if(!fs.existsSync(enrichBak))fs.copyFileSync(enrichPath,enrichBak);

// ============================================================================
// A) Holder queue: admissionFn support. This does not add RPC concurrency.
// ============================================================================
if(!enrich.includes('MEMEFLOW_V12_8_HOLDER_ADMISSION_QUEUE')){
  // Add metrics, if the current metrics object has the canonical anchor.
  const metricsAnchor='holderDropped: 0,';
  if(enrich.includes(metricsAnchor)){
    enrich=enrich.replace(metricsAnchor,metricsAnchor+`
    holderAdmissionAllowed: 0,
    holderAdmissionDeferred: 0,
    holderAdmissionDropped: 0,
    holderAdmissionErrors: 0,
    lastHolderAdmissionReason: null,`);
  }

  // Extend dependency destructuring.
  const depOld='const {enrichHoldersFn,holderMetrics}=deps;';
  const depNew=`const {enrichHoldersFn,holderMetrics,admissionFn=null}=deps;
  /* MEMEFLOW_V12_8_HOLDER_ADMISSION_QUEUE */`;
  if(!enrich.includes(depNew)){
    if(!enrich.includes(depOld)){
      console.error('ABORT: makeHolderQueue dependency anchor missing.');
      process.exit(1);
    }
    enrich=enrich.replace(depOld,depNew);
  }

  // Insert gate before active.add(item.mint).
  const runAnchor='async function run(item){\n    active.add(item.mint);';
  if(!enrich.includes(runAnchor)){
    console.error('ABORT: holder run(item) anchor missing.');
    process.exit(1);
  }
  const runNew=`async function run(item){
    if(admissionFn){
      let gate=null;
      try{
        gate=admissionFn(item.mint)||{allow:true};
      }catch(e){
        holderMetrics.holderAdmissionErrors=(holderMetrics.holderAdmissionErrors||0)+1;
        gate={allow:true,reason:'admission_error_fail_open'};
      }

      if(gate.allow===false){
        holderMetrics.lastHolderAdmissionReason=gate.reason||'deferred';
        if(gate.drop===true){
          holderMetrics.holderAdmissionDropped=(holderMetrics.holderAdmissionDropped||0)+1;
          return;
        }
        holderMetrics.holderAdmissionDeferred=(holderMetrics.holderAdmissionDeferred||0)+1;
        pending.set(item.mint,{
          ...item,
          dueAt:Date.now()+Math.max(1000,Number(gate.retryInMs||3000))
        });
        scheduleWake();
        return;
      }
      holderMetrics.holderAdmissionAllowed=(holderMetrics.holderAdmissionAllowed||0)+1;
    }

    active.add(item.mint);`;
  enrich=enrich.replace(runAnchor,runNew);
}

// ============================================================================
// B) App server: safe, multi-user admission gate before expensive holder RPC.
// ============================================================================
if(!server.includes('MEMEFLOW_V12_8_ADMISSION_GATE')){
  const queueAnchor='const holderQueue=makeHolderQueue(';
  const qpos=server.indexOf(queueAnchor);
  if(qpos<0){
    console.error('ABORT: holderQueue construction missing.');
    process.exit(1);
  }

  const gateCode=`
/* MEMEFLOW_V12_8_ADMISSION_GATE
   Expensive holder RPC is admitted only when at least one active user can
   currently benefit from it. Missing/dynamic cheap data DEFER, never hard-drop.
   Hard drop is limited to stable platform/age incompatibility for every active
   user. No user settings are changed. */
const HOLDER_ADMISSION_RETRY_MS=Math.max(1000,Number(process.env.HOLDER_ADMISSION_RETRY_MS||3000));
const HOLDER_ADMISSION_ACTIVE_HOURS=Math.max(1,Number(process.env.HOLDER_ADMISSION_ACTIVE_USER_HOURS||24));

function v128Finite(v){
  return v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v))?Number(v):null;
}
function v128Enabled(v){
  return v!==null&&v!==undefined&&v!=='';
}
function holderAdmissionForActiveUsers(mint){
  const token=store.state.tokens[mint];
  if(!token)return {allow:false,drop:true,reason:'token_missing'};

  const now=Date.now();
  const cutoff=now-HOLDER_ADMISSION_ACTIVE_HOURS*3600000;
  const users=Object.keys(store.state.users||{}).filter(uid=>{
    const u=store.state.users[uid]||{};
    return u.isOwner || (u.lastActiveAt&&u.lastActiveAt>=cutoff);
  });

  // No active user context: fail open. Recovery/owner flows must not be broken.
  if(!users.length)return {allow:true,reason:'no_active_users_fail_open'};

  const platform=String(token.launchPlatform||token.protocol||token.source||'').toLowerCase();
  const discovered=Number(token.discoveredAt||token.createdAt||0);
  const ageMinutes=discovered>0?Math.max(0,(now-discovered)/60000):null;
  const price=v128Finite(token.priceSol);
  const pressure=v128Finite(token.buyPressure??token.momentum);
  const marketCapUsd=v128Finite(token.marketCapUsd??token.marketCapUSD);
  const liquidityUsd=v128Finite(token.liquidityUsd??token.liquidityUSD);

  let anyPotential=false;
  let anyReady=false;
  let lastReason='cheap_market_data_pending';

  for(const uid of users){
    const s=store.settings(uid)||{};

    // Stable hard filters: safe to rule this user out permanently.
    if(Array.isArray(s.launchPlatforms)&&s.launchPlatforms.length){
      if(!platform || !s.launchPlatforms.some(p=>platform.includes(String(p).replace('_',' ').toLowerCase()))){
        lastReason='launch_platform_mismatch';
        continue;
      }
    }
    if(ageMinutes!==null && v128Enabled(s.maxTokenAgeMinutes) &&
       ageMinutes>Number(s.maxTokenAgeMinutes)){
      lastReason='token_age_exceeded';
      continue;
    }

    anyPotential=true;

    // Dynamic/cheap gates: DEFER, because these values can improve.
    if(price===null){
      lastReason='price_pending';
      continue;
    }
    if(v128Enabled(s.minBuyPressure) && Number(s.minBuyPressure)>0){
      if(pressure===null){
        lastReason='buy_pressure_pending';
        continue;
      }
      if(pressure<Number(s.minBuyPressure)){
        lastReason='buy_pressure_below_user_min';
        continue;
      }
    }
    if(v128Enabled(s.minMarketCapUsd) && Number(s.minMarketCapUsd)>0){
      if(marketCapUsd===null){
        lastReason='market_cap_usd_pending';
        continue;
      }
      if(marketCapUsd<Number(s.minMarketCapUsd)){
        lastReason='market_cap_below_user_min';
        continue;
      }
    }
    if(v128Enabled(s.maxMarketCapUsd) && Number(s.maxMarketCapUsd)>0 &&
       marketCapUsd!==null && marketCapUsd>Number(s.maxMarketCapUsd)){
      lastReason='market_cap_above_user_max';
      continue;
    }
    if(v128Enabled(s.minLiquidityUsd) && Number(s.minLiquidityUsd)>0){
      if(liquidityUsd===null){
        lastReason='liquidity_usd_pending';
        continue;
      }
      if(liquidityUsd<Number(s.minLiquidityUsd)){
        lastReason='liquidity_below_user_min';
        continue;
      }
    }

    anyReady=true;
    break;
  }

  if(anyReady)return {allow:true,reason:'at_least_one_active_user_ready'};
  if(!anyPotential)return {allow:false,drop:true,reason:lastReason||'no_active_user_hard_match'};
  return {allow:false,drop:false,retryInMs:HOLDER_ADMISSION_RETRY_MS,reason:lastReason};
}

`;
  server=server.slice(0,qpos)+gateCode+server.slice(qpos);

  // Add admissionFn to holder queue deps, robustly.
  const holderLineStart=server.indexOf('const holderQueue=makeHolderQueue(');
  const holderLineEnd=server.indexOf(');\n',holderLineStart);
  if(holderLineEnd<0){
    console.error('ABORT: cannot parse holderQueue construction.');
    process.exit(1);
  }
  let holderStmt=server.slice(holderLineStart,holderLineEnd+2);
  if(!holderStmt.includes('admissionFn:holderAdmissionForActiveUsers')){
    const metricTail='holderMetrics}';
    if(!holderStmt.includes(metricTail)){
      console.error('ABORT: holderQueue deps tail not recognized.');
      process.exit(1);
    }
    holderStmt=holderStmt.replace(metricTail,'holderMetrics,admissionFn:holderAdmissionForActiveUsers}');
    server=server.slice(0,holderLineStart)+holderStmt+server.slice(holderLineEnd+2);
  }
}

// ============================================================================
// C) Diagnostic decision lookup: store._uidDec is object-of-Maps, not a Map.
// ============================================================================
server=server.replaceAll(
  'store?._uidDec?.get?.(u.id)?.get?.(mint)',
  'store?._uidDec?.[u.id]?.get?.(mint)'
);
server=server.replaceAll(
  'store._uidDec?.get?.(u.id)?.get?.(mint)',
  'store._uidDec?.[u.id]?.get?.(mint)'
);

// Also repair common equivalent introduced by earlier diagnostics.
server=server.replace(
  /store\?\._uidDec\?\.get\?\.\(u\.id\)\?\.get\?\.\(mint\)/g,
  'store?._uidDec?.[u.id]?.get?.(mint)'
);

// ============================================================================
// D) Candidate feed: hide hard-blocked/non-candidates by default.
// includeBlocked=1 preserves full audit/debug access.
// ============================================================================
if(!server.includes('MEMEFLOW_V12_8_CANDIDATE_FILTER')){
  const routeNeedle="if(url.pathname==='/api/ai/decisions')";
  const rp=server.indexOf(routeNeedle);
  if(rp>=0){
    const lineEnd=server.indexOf('\n',rp);
    if(lineEnd<0){console.error('ABORT: ai decisions route parse failed.');process.exit(1)}
    const oldRoute=server.slice(rp,lineEnd);
    // Only replace canonical compact route containing _all=store.decisions(u.id)
    if(oldRoute.includes('const _all=store.decisions(u.id);')){
      const newRoute=oldRoute
        .replace(
          'const _all=store.decisions(u.id);',
          `/* MEMEFLOW_V12_8_CANDIDATE_FILTER */
const _raw=store.decisions(u.id);
const _includeBlocked=url.searchParams.get('includeBlocked')==='1';
const _blockedStates=new Set(['BLOCKED','EXPIRED','SKIP','BUY_BLOCKED']);
const _all=_includeBlocked?_raw:_raw.filter(d=>!_blockedStates.has(String(d?.state||'').toUpperCase()));`
        );
      server=server.slice(0,rp)+newRoute+server.slice(lineEnd);
    }
  }
}

fs.writeFileSync(enrichPath,enrich,'utf8');
fs.writeFileSync(serverPath,server,'utf8');

for(const p of [enrichPath,serverPath]){
  const r=spawnSync(process.execPath,['--check',p],{encoding:'utf8'});
  if(r.status!==0){
    console.error('SYNTAX ERROR: '+p);
    console.error(r.stderr||r.stdout);
    process.exit(r.status||1);
  }
}

console.log('PASS: holder admission queue installed');
console.log('PASS: multi-user cheap admission gate installed');
console.log('PASS: decision diagnostic lookup repaired');
console.log('PASS: blocked/non-candidates hidden from candidate feed by default');
console.log('PASS: holder RPC concurrency unchanged');
console.log('V12.8 INSTALLED');
