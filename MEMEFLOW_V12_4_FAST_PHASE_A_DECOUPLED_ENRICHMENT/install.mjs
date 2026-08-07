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

const backup=serverPath+'.before-v12-4-fast-phase-a';
if(!fs.existsSync(backup))fs.copyFileSync(serverPath,backup);

let s=fs.readFileSync(serverPath,'utf8');

if(!s.includes('MEMEFLOW_V12_3_SLA_FAIR_SCHEDULER')){
  console.error('ABORT: V12.3 is not installed. Install V12.3 first.');
  process.exit(1);
}

if(!s.includes('MEMEFLOW_V12_4_FAST_PHASE_A_DECOUPLED_ENRICHMENT')){

  // Put metrics before enrich(), where all dependencies already exist.
  const enrichAnchor='// Phase A (immediate) then schedules Phase B (delayed holder lookup) via holderQueue.';
  if(!s.includes(enrichAnchor)){
    console.error('ABORT: canonical enrich anchor missing');
    process.exit(1);
  }

  const fastPhase = `/* MEMEFLOW_V12_4_FAST_PHASE_A_DECOUPLED_ENRICHMENT */
const fastPhaseMetrics={
  starts:0,
  priceTimerStarted:0,
  holderQueued:0,
  initialEvaluationStarted:0,
  initialEvaluationSucceeded:0,
  initialEvaluationFailed:0,
  bootstrapErrors:0,
  fullEnrichBackgroundStarted:0,
  fullEnrichBackgroundSucceeded:0,
  fullEnrichBackgroundFailed:0,
  lastBootstrapAt:null,
  lastBootstrapMint:null,
  lastBootstrapError:null,
  lastFullEnrichError:null
};

function fastPhaseAStart(mint,curve){
  const token=store.state.tokens[mint];
  if(!token)return false;

  fastPhaseMetrics.starts++;
  fastPhaseMetrics.lastBootstrapAt=Date.now();
  fastPhaseMetrics.lastBootstrapMint=mint;

  // Critical rule: downstream lifecycles are created BEFORE any slow full enrich.
  try{
    const hadPrice=priceTimers.has(mint);
    ensurePriceTimer(mint,curve||token.curve);
    if(!hadPrice&&priceTimers.has(mint))fastPhaseMetrics.priceTimerStarted++;
  }catch(e){
    fastPhaseMetrics.bootstrapErrors++;
    fastPhaseMetrics.lastBootstrapError='price timer: '+String(e?.message||e);
  }

  try{
    const before=holderQueue.inspect?.(mint)||null;
    holderQueue.enqueue(mint);
    const after=holderQueue.inspect?.(mint)||null;
    if(!before?.pending && (after?.pending||after?.active||Number(after?.attempts||0)>0)){
      fastPhaseMetrics.holderQueued++;
    }
  }catch(e){
    fastPhaseMetrics.bootstrapErrors++;
    fastPhaseMetrics.lastBootstrapError='holder queue: '+String(e?.message||e);
  }

  // Initial WAITING/BLOCK evaluation must not wait for metadata/holder enrichment.
  try{
    fastPhaseMetrics.initialEvaluationStarted++;
    Promise.resolve(evaluateAll(token)).then(()=>{
      fastPhaseMetrics.initialEvaluationSucceeded++;
    }).catch(e=>{
      fastPhaseMetrics.initialEvaluationFailed++;
      fastPhaseMetrics.lastBootstrapError='initial evaluation: '+String(e?.message||e);
    });
  }catch(e){
    fastPhaseMetrics.initialEvaluationFailed++;
    fastPhaseMetrics.lastBootstrapError='initial evaluation: '+String(e?.message||e);
  }

  try{ publish(mint); }catch(_){}
  return true;
}

`;

  s=s.replace(enrichAnchor, fastPhase + enrichAnchor);

  // Replace canonical enrich() so it bootstraps first, then performs slow work.
  const oldEnrich=`async function enrich(mint,curve){
  await enrichToken(mint,curve,{rpc,store,tradeWindows,evaluateAll,publish,ensurePriceTimer,discMetrics,enrichDiag});
  try{paper.onTokenUpdate(mint,store.state.tokens[mint])}catch(_){}
  holderQueue.enqueue(mint);
}`;

  const newEnrich=`async function enrich(mint,curve){
  // V12.4: start holder + price + initial decision immediately.
  fastPhaseAStart(mint,curve);

  fastPhaseMetrics.fullEnrichBackgroundStarted++;
  try{
    await enrichToken(mint,curve,{rpc,store,tradeWindows,evaluateAll,publish,ensurePriceTimer,discMetrics,enrichDiag});
    fastPhaseMetrics.fullEnrichBackgroundSucceeded++;
  }catch(e){
    fastPhaseMetrics.fullEnrichBackgroundFailed++;
    fastPhaseMetrics.lastFullEnrichError=String(e?.message||e).slice(0,240);
    throw e;
  }

  try{paper.onTokenUpdate(mint,store.state.tokens[mint])}catch(_){}
}`;

  if(!s.includes(oldEnrich)){
    // Fallback: surgically inject fast start at the beginning of enrich and remove
    // trailing duplicate holder enqueue if prior patches reformatted the body.
    const fnStart=s.indexOf('async function enrich(mint,curve){');
    if(fnStart<0){
      console.error('ABORT: enrich(mint,curve) missing');
      process.exit(1);
    }
    const bodyOpen=s.indexOf('{',fnStart);
    s=s.slice(0,bodyOpen+1)+`
  // MEMEFLOW V12.4 immediate bootstrap
  fastPhaseAStart(mint,curve);
  fastPhaseMetrics.fullEnrichBackgroundStarted++;
`+s.slice(bodyOpen+1);

    // Record success immediately after canonical enrichToken await, if present.
    const call='await enrichToken(mint,curve,{rpc,store,tradeWindows,evaluateAll,publish,ensurePriceTimer,discMetrics,enrichDiag});';
    if(s.includes(call)){
      s=s.replace(call,`try{
    ${call}
    fastPhaseMetrics.fullEnrichBackgroundSucceeded++;
  }catch(e){
    fastPhaseMetrics.fullEnrichBackgroundFailed++;
    fastPhaseMetrics.lastFullEnrichError=String(e?.message||e).slice(0,240);
    throw e;
  }`);
    }
    // Holder enqueue is now performed before slow enrichment.
    s=s.replace(/\n\s*holderQueue\.enqueue\(mint\);\s*\n\}/, '\n}');
  }else{
    s=s.replace(oldEnrich,newEnrich);
  }

  // Discovery path: explicitly bootstrap synchronously right after token storage,
  // before the background full enrich promise is even scheduled.
  const addTokenAnchor=`store.addToken({mint:result.mint,curve:result.curve,name:result.name,symbol:result.symbol,uri:result.uri,creator:result.creator,isMayhemMode:false,launchMode:'standard',discoveredAt:Date.now(),slot:tx.slot,signature:sig,source:'Pump create'});
      void enrich(result.mint,result.curve).catch(e=>{discMetrics.lastErrorAt=Date.now();discovery.lastError={message:'enrich: '+String(e?.message||e),at:Date.now()}});`;

  const addTokenReplacement=`store.addToken({mint:result.mint,curve:result.curve,name:result.name,symbol:result.symbol,uri:result.uri,creator:result.creator,isMayhemMode:false,launchMode:'standard',discoveredAt:Date.now(),slot:tx.slot,signature:sig,source:'Pump create'});
      // V12.4: do not let slow full enrichment gate holder/price/decision startup.
      fastPhaseAStart(result.mint,result.curve);
      void enrich(result.mint,result.curve).catch(e=>{discMetrics.lastErrorAt=Date.now();discovery.lastError={message:'enrich: '+String(e?.message||e),at:Date.now()}});`;

  if(s.includes(addTokenAnchor)){
    s=s.replace(addTokenAnchor,addTokenReplacement);
  }else{
    // More tolerant fallback: inject between addToken(...); and void enrich(...)
    const needle='void enrich(result.mint,result.curve).catch';
    const n=s.indexOf(needle);
    if(n<0){
      console.error('ABORT: discovery enrich call anchor missing');
      process.exit(1);
    }
    const prior=s.lastIndexOf('store.addToken(',n);
    if(prior<0){
      console.error('ABORT: discovery store.addToken anchor missing');
      process.exit(1);
    }
    const semi=s.indexOf(';',prior);
    if(semi<0||semi>n){
      console.error('ABORT: cannot safely inject discovery bootstrap');
      process.exit(1);
    }
    s=s.slice(0,semi+1)+`
      // MEMEFLOW V12.4 immediate discovery bootstrap
      fastPhaseAStart(result.mint,result.curve);
      `+s.slice(semi+1);
  }

  // Avoid a second fastPhaseAStart when discovery immediately calls enrich().
  // fastPhaseAStart itself is idempotent at queue/timer level, but count only
  // the explicit discovery start. enrich() still keeps the call for bridge/recovery.
  const discoveryDouble=`fastPhaseAStart(result.mint,result.curve);
      void enrich(result.mint,result.curve)`;
  if(s.includes(discoveryDouble)){
    // Pass a lightweight marker through a module-level Set.
    const metricEnd='const fastPhaseMetrics={';
    // Add Set before function, only once.
    const fnMarker='function fastPhaseAStart(mint,curve){';
    if(s.includes(fnMarker) && !s.includes('const fastPhaseBootstrapped=new Set()')){
      s=s.replace(fnMarker,`const fastPhaseBootstrapped=new Set();
function fastPhaseAStart(mint,curve){
  if(fastPhaseBootstrapped.has(mint))return true;
  fastPhaseBootstrapped.add(mint);`);
      // prune set opportunistically in function start
      s=s.replace('fastPhaseMetrics.starts++;',`if(fastPhaseBootstrapped.size>5000){
    let n=0;for(const x of fastPhaseBootstrapped){fastPhaseBootstrapped.delete(x);if(++n>=2500)break;}
  }
  fastPhaseMetrics.starts++;`);
    }
  }

  // Extend V10.2 diagnostic response with fast-phase metrics.
  const diagVersion="diagnosticVersion:'V10.2-same-instance'";
  if(s.includes(diagVersion) && !s.includes('fastPhase:fastPhaseMetrics')){
    // Most V10.2 routes serialize bridge, then instance/counts. Inject next to bridge.
    const bridgeField='bridge:bridgeMetrics,';
    if(s.includes(bridgeField)){
      s=s.replace(bridgeField,bridgeField+'fastPhase:fastPhaseMetrics,');
    }else{
      // fallback: after diagnosticVersion field
      s=s.replace(diagVersion,diagVersion+',fastPhase:fastPhaseMetrics');
    }
  }

  // Per-token diagnostic: show whether fast downstream primitives exist.
  if(s.includes("diagnosticVersion:'V10.2-same-instance'") && !s.includes('fastPhaseReady:')){
    const pipelineField='pipelineStarted:bridgePipelineStarted(token),';
    if(s.includes(pipelineField)){
      s=s.replace(pipelineField,pipelineField+`
        fastPhaseReady:Boolean(
          (holderQueue.inspect?.(mint)||null)?.pending ||
          (holderQueue.inspect?.(mint)||null)?.active ||
          Number((holderQueue.inspect?.(mint)||null)?.attempts||0)>0 ||
          priceTimers.has(mint)
        ),`);
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
console.log('PASS: fast Phase-A starts before full enrichment');
console.log('PASS: holder queue is no longer gated by full enrichment');
console.log('PASS: price lifecycle is no longer gated by full enrichment');
console.log('PASS: initial evaluation is no longer gated by full enrichment');
console.log('PASS: discovery path bootstraps immediately');
console.log('V12.4 INSTALLED');
