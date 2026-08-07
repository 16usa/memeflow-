import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

const cwd=process.cwd();
const appDir=fs.existsSync(path.join(cwd,'memeflow-app'))?path.join(cwd,'memeflow-app'):cwd;
const serverPath=path.join(appDir,'app-server.mjs');
const solanaPath=path.join(appDir,'src','solana.mjs');

for(const p of [serverPath,solanaPath]){
  if(!fs.existsSync(p)){
    console.error('ABORT: missing '+p);
    process.exit(1);
  }
}

let server=fs.readFileSync(serverPath,'utf8');
let solana=fs.readFileSync(solanaPath,'utf8');

if(!server.includes('MEMEFLOW_V12_4_FAST_PHASE_A_DECOUPLED_ENRICHMENT')){
  console.error('ABORT: V12.4 is not installed. Install V12.4 first.');
  process.exit(1);
}
if(!solana.includes('MEMEFLOW V11 HOLDER BACKOFF')){
  console.error('ABORT: V11 holder queue/backoff marker is missing in src/solana.mjs.');
  console.error('V12.5 refuses to guess against an unknown holder worker.');
  process.exit(1);
}

const serverBackup=serverPath+'.before-v12-5-first-snapshot';
const solanaBackup=solanaPath+'.before-v12-5-first-snapshot';
if(!fs.existsSync(serverBackup))fs.copyFileSync(serverPath,serverBackup);
if(!fs.existsSync(solanaBackup))fs.copyFileSync(solanaPath,solanaBackup);

if(!solana.includes('MEMEFLOW_V12_5_FIRST_SNAPSHOT_ACCELERATOR')){
  const marker='/* MEMEFLOW V11 HOLDER BACKOFF */';
  const mpos=solana.indexOf(marker);
  const regionStart=Math.max(0,mpos-10000);
  const regionEnd=Math.min(solana.length,mpos+14000);
  let region=solana.slice(regionStart,regionEnd);
  let changedInitial=false;
  let changedTick=false;

  // V12.4 live diagnostics proved the initial holder due time is ~10 seconds.
  // Change ONLY the first-attempt scheduling delay. Retry/backoff stays intact.
  const initialPatterns=[
    [/(nextDueAt\s*:\s*Date\.now\(\)\s*\+\s*)10000\b/g,'$1750'],
    [/(nextDueAt\s*=\s*Date\.now\(\)\s*\+\s*)10000\b/g,'$1750'],
    [/(queuedAt\s*:\s*Date\.now\(\)[\s\S]{0,300}?nextDueAt\s*:\s*Date\.now\(\)\s*\+\s*)10_000\b/g,'$1750'],
    [/(initialDelayMs\s*[:=]\s*)10000\b/g,'$1750'],
    [/(firstAttemptDelayMs\s*[:=]\s*)10000\b/g,'$1750'],
    [/(HOLDER_[A-Z_]*INITIAL[A-Z_]*\s*=\s*)10000\b/g,'$1750'],
    [/(HOLDER_[A-Z_]*FIRST[A-Z_]*\s*=\s*)10000\b/g,'$1750']
  ];

  for(const [re,repl] of initialPatterns){
    const before=region;
    region=region.replace(re,repl);
    if(region!==before){changedInitial=true;break;}
  }

  // If V11 used an environment/default expression, reduce only the DEFAULT.
  if(!changedInitial){
    const envPatterns=[
      [/(HOLDER_[A-Z_]*(?:INITIAL|FIRST)[A-Z_]*\s*\|\|\s*)10000\b/g,'$1750'],
      [/(Number\(process\.env\.[A-Z_]*(?:INITIAL|FIRST)[A-Z_]*\)\s*\|\|\s*)10000\b/g,'$1750']
    ];
    for(const [re,repl] of envPatterns){
      const before=region;
      region=region.replace(re,repl);
      if(region!==before){changedInitial=true;break;}
    }
  }

  if(!changedInitial){
    console.error('ABORT: could not safely locate the V11 ~10s FIRST holder-attempt delay.');
    console.error('No files were modified.');
    process.exit(1);
  }

  // Worker wake-up cadence. We only reduce a slow queue scheduler cadence;
  // RPC pacing/backoff/circuit-breaker timing is NOT touched.
  const tickPatterns=[
    [/(setInterval\s*\(\s*(?:async\s*)?\(\)\s*=>[\s\S]{0,2500}?(?:holder|queue)[\s\S]{0,2500}?,\s*)10000(\s*\))/g,'$1500$2'],
    [/(queueTickMs\s*[:=]\s*)10000\b/g,'$1500'],
    [/(workerIntervalMs\s*[:=]\s*)10000\b/g,'$1500'],
    [/(HOLDER_[A-Z_]*(?:TICK|WORKER|QUEUE_INTERVAL)[A-Z_]*\s*=\s*)10000\b/g,'$1500']
  ];
  for(const [re,repl] of tickPatterns){
    const before=region;
    region=region.replace(re,repl);
    if(region!==before){changedTick=true;break;}
  }

  // It is safe if no 10s worker tick exists; some versions already wake often.
  // Insert explicit V12.5 constants/marker near the V11 marker for auditability.
  region=region.replace(marker,`${marker}
/* MEMEFLOW_V12_5_FIRST_SNAPSHOT_ACCELERATOR
   First attempt target: 750 ms.
   Worker wake target: <= 500 ms when a slow 10s cadence existed.
   IMPORTANT: V11 exponential retry/backoff, provider cooldown, circuit breaker,
   and single-flight/RPC pacing remain unchanged. */`);

  solana=solana.slice(0,regionStart)+region+solana.slice(regionEnd);
  fs.writeFileSync(solanaPath,solana,'utf8');

  console.log('PASS: first holder attempt delay accelerated to 750ms');
  console.log(changedTick
    ? 'PASS: slow holder worker wake cadence accelerated to 500ms'
    : 'PASS: no separate 10s holder worker cadence found; existing wake cadence retained');
}

server=fs.readFileSync(serverPath,'utf8');

if(!server.includes('MEMEFLOW_V12_5_FIRST_SNAPSHOT_METRICS')){
  // Add metrics beside fastPhase metrics.
  const anchor='const fastPhaseMetrics={';
  const apos=server.indexOf(anchor);
  if(apos<0){
    console.error('ABORT: V12.4 fastPhaseMetrics anchor missing');
    process.exit(1);
  }

  const metrics=`/* MEMEFLOW_V12_5_FIRST_SNAPSHOT_METRICS */
const firstSnapshotMetrics={
  targetFirstAttemptMs:750,
  targetHolderSnapshotMs:5000,
  observedFreshQueuedNoAttempt:0,
  observedHolderFresh:0,
  oldestQueuedNoAttemptAgeMs:0,
  firstSnapshotSlaMissesCurrent:0,
  lastObservedAt:null
};

function refreshFirstSnapshotMetrics(){
  const now=Date.now();
  let queuedNoAttempt=0,holderFreshCount=0,oldest=0,misses=0;
  try{
    for(const token of Object.values(store?.state?.tokens||{})){
      const discovered=Number(token?.discoveredAt||0);
      if(!discovered||now-discovered>45000)continue;
      const mint=token?.mint;
      if(!mint)continue;
      let h=null;try{h=holderQueue.inspect?.(mint)||null}catch{}
      if(token?.holderFresh)holderFreshCount++;
      if(h?.pending && Number(h?.attempts||0)===0){
        queuedNoAttempt++;
        const age=now-discovered;
        if(age>oldest)oldest=age;
        if(age>5000)misses++;
      }
    }
  }catch{}
  firstSnapshotMetrics.observedFreshQueuedNoAttempt=queuedNoAttempt;
  firstSnapshotMetrics.observedHolderFresh=holderFreshCount;
  firstSnapshotMetrics.oldestQueuedNoAttemptAgeMs=oldest;
  firstSnapshotMetrics.firstSnapshotSlaMissesCurrent=misses;
  firstSnapshotMetrics.lastObservedAt=now;
}

`;
  server=server.slice(0,apos)+metrics+server.slice(apos);

  // Refresh metrics whenever same-instance diagnostics are requested.
  const diag="diagnosticVersion:'V10.2-same-instance'";
  const dpos=server.indexOf(diag);
  if(dpos>=0){
    // Add field to the response object.
    if(!server.includes('firstSnapshot:firstSnapshotMetrics')){
      if(server.includes('fastPhase:fastPhaseMetrics,')){
        server=server.replace('fastPhase:fastPhaseMetrics,',
          'fastPhase:fastPhaseMetrics,firstSnapshot:firstSnapshotMetrics,');
      }else{
        server=server.replace(diag,diag+',firstSnapshot:firstSnapshotMetrics');
      }
    }

    // Best-effort refresh before response construction: place after route condition if found.
    const routeNeedle="url.pathname==='/api/debug/filter-pipeline-lifecycle'";
    const rp=server.indexOf(routeNeedle);
    if(rp>=0){
      const brace=server.indexOf('{',rp);
      if(brace>=0){
        server=server.slice(0,brace+1)+'refreshFirstSnapshotMetrics();'+server.slice(brace+1);
      }
    }
  }

  fs.writeFileSync(serverPath,server,'utf8');
}

for(const p of [solanaPath,serverPath]){
  const r=spawnSync(process.execPath,['--check',p],{encoding:'utf8'});
  if(r.status!==0){
    console.error('SYNTAX FAILURE: '+p);
    console.error(r.stderr||r.stdout);
    process.exit(r.status||1);
  }
}

console.log('PASS: src/solana.mjs syntax-valid');
console.log('PASS: app-server.mjs syntax-valid');
console.log('PASS: V11 retry/backoff marker preserved');
console.log('PASS: V12.5 first-snapshot diagnostics installed');
console.log('V12.5 INSTALLED');
