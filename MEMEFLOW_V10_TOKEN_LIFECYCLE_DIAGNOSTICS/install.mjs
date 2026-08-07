import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

const cwd=process.cwd();
const appDir=fs.existsSync(path.join(cwd,'memeflow-app'))?path.join(cwd,'memeflow-app'):cwd;
const serverPath=path.join(appDir,'app-server.mjs');
const enrichPath=path.join(appDir,'src','enrich.mjs');

for(const p of [serverPath,enrichPath]){
  if(!fs.existsSync(p)){console.error('ABORT: missing '+p);process.exit(1)}
  const b=p+'.before-v10-lifecycle-diag';
  if(!fs.existsSync(b))fs.copyFileSync(p,b);
}
function save(p,s){fs.writeFileSync(p,s,'utf8');console.log('Changed:',p)}
function check(p){
  const r=spawnSync(process.execPath,['--check',p],{encoding:'utf8'});
  if(r.status!==0){console.error(r.stderr||r.stdout);process.exit(r.status||1)}
  console.log('PASS syntax:',path.relative(appDir,p));
}

// ─────────────────────────────────────────────────────────────
// HOLDER QUEUE: diagnostic history per mint, no scheduling change
// ─────────────────────────────────────────────────────────────
let e=fs.readFileSync(enrichPath,'utf8');

if(!e.includes('const history=new Map(); // V10 holder lifecycle diagnostics')){
  const anchor="  const pending=new Map(); // mint -> {mint,retries,enqueuedAt,dueAt}\n  const active=new Set();";
  if(!e.includes(anchor)){console.error('ABORT: holder queue anchor missing');process.exit(1)}
  e=e.replace(anchor,anchor+"\n  const history=new Map(); // V10 holder lifecycle diagnostics");
}

if(!e.includes('function diagRow(mint)')){
  const anchor="  let wakeTimer=null;\n";
  const add=`  let wakeTimer=null;

  function diagRow(mint){
    let row=history.get(mint);
    if(!row){
      row={mint,queuedAt:null,nextDueAt:null,attempts:0,lastAttemptAt:null,lastSuccessAt:null,lastError:null,lastErrorAt:null,rateLimited:0,retries:0,status:'unknown'};
      history.set(mint,row);
    }
    return row;
  }
  function pruneHistory(){
    if(history.size<=2000)return;
    const rows=[...history.values()].sort((a,b)=>(b.lastAttemptAt||b.queuedAt||0)-(a.lastAttemptAt||a.queuedAt||0));
    history.clear();
    for(const row of rows.slice(0,1000))history.set(row.mint,row);
  }
`;
  if(!e.includes(anchor)){console.error('ABORT: wakeTimer anchor missing');process.exit(1)}
  e=e.replace(anchor,add);
}

// mark run attempt
e=e.replace(
"  async function run(item){\n    active.add(item.mint);",
`  async function run(item){
    active.add(item.mint);
    const _diag=diagRow(item.mint);
    _diag.attempts++;
    _diag.lastAttemptAt=Date.now();
    _diag.status='running';`
);

// rate limit path
e=e.replace(
"        holderMetrics.holderRateLimited++;\n        if(item.retries<maxRetries){",
`        holderMetrics.holderRateLimited++;
        _diag.rateLimited++;
        _diag.lastError='rate limited';
        _diag.lastErrorAt=Date.now();
        if(item.retries<maxRetries){`
);

// success path
e=e.replace(
"        holderMetrics.holderSucceeded++;\n        holderMetrics.lastHolderError=null;",
`        holderMetrics.holderSucceeded++;
        holderMetrics.lastHolderError=null;
        _diag.lastSuccessAt=Date.now();
        _diag.lastError=null;
        _diag.lastErrorAt=null;
        _diag.status='success';`
);

// catch failure
e=e.replace(
"        holderMetrics.holderFailed++;\n        holderMetrics.lastHolderError=sanitize(e?.message||'unknown');\n        holderMetrics.lastHolderErrorAt=Date.now();",
`        holderMetrics.holderFailed++;
        holderMetrics.lastHolderError=sanitize(e?.message||'unknown');
        holderMetrics.lastHolderErrorAt=Date.now();
        _diag.lastError=sanitize(e?.message||'unknown');
        _diag.lastErrorAt=Date.now();
        _diag.status='failed';`
);

// reschedule diagnostic
e=e.replace(
"  function reschedule(item,delayMs){\n    pending.set(item.mint,{",
`  function reschedule(item,delayMs){
    const _diag=diagRow(item.mint);
    _diag.retries=item.retries+1;
    _diag.status='retry_wait';
    _diag.nextDueAt=Date.now()+Math.max(1000,delayMs);
    pending.set(item.mint,{`
);

// enqueue diagnostic
e=e.replace(
"    pending.set(mint,{mint,retries:0,enqueuedAt:now,dueAt:now+initialDelayMs});\n    holderMetrics.holderQueued++;",
`    pending.set(mint,{mint,retries:0,enqueuedAt:now,dueAt:now+initialDelayMs});
    const _diag=diagRow(mint);
    _diag.queuedAt=_diag.queuedAt||now;
    _diag.nextDueAt=now+initialDelayMs;
    _diag.status='queued';
    holderMetrics.holderQueued++;
    pruneHistory();`
);

// return inspect interface
if(!e.includes('inspect(mint){')){
  const anchor="    get nextDueInMs(){\n      if(!pending.size)return null;\n      return Math.max(0,Math.min(...[...pending.values()].map(x=>x.dueAt))-Date.now());\n    }\n  };";
  const repl=`    get nextDueInMs(){
      if(!pending.size)return null;
      return Math.max(0,Math.min(...[...pending.values()].map(x=>x.dueAt))-Date.now());
    },
    inspect(mint){
      const row=history.get(mint)||null;
      const p=pending.get(mint)||null;
      return {
        ...(row||{mint,attempts:0,status:active.has(mint)?'running':'unknown'}),
        pending:Boolean(p),
        active:active.has(mint),
        nextDueAt:p?.dueAt??row?.nextDueAt??null,
        nextDueInMs:p?Math.max(0,p.dueAt-Date.now()):null,
        queueRetries:p?.retries??row?.retries??0
      };
    }
  };`;
  if(!e.includes(anchor)){console.error('ABORT: holder return anchor missing');process.exit(1)}
  e=e.replace(anchor,repl);
}
save(enrichPath,e);

// ─────────────────────────────────────────────────────────────
// APP SERVER: price snapshot diagnostics + read-only endpoint
// ─────────────────────────────────────────────────────────────
let s=fs.readFileSync(serverPath,'utf8');

if(!s.includes('const priceLifecycleDiag=new Map(); // V10')){
  const anchor="const streams=new Map(),priceTimers=new Map(),tradeWindows=new Map();";
  if(!s.includes(anchor)){console.error('ABORT: server maps anchor missing');process.exit(1)}
  s=s.replace(anchor,anchor+"\nconst priceLifecycleDiag=new Map(); // V10 read-only lifecycle diagnostics");
}

if(!s.includes('function priceDiagRow(mint)')){
  const anchor="// ── Extended discovery metrics";
  const helper=`function priceDiagRow(mint){
  let row=priceLifecycleDiag.get(mint);
  if(!row){
    row={mint,timerCreatedAt:null,pollAttempts:0,snapshotCount:0,lastPollAt:null,lastSnapshotAt:null,lastPollError:null,lastPollErrorAt:null};
    priceLifecycleDiag.set(mint,row);
  }
  return row;
}
function prunePriceDiag(){
  if(priceLifecycleDiag.size<=2000)return;
  const rows=[...priceLifecycleDiag.values()].sort((a,b)=>(b.lastPollAt||b.timerCreatedAt||0)-(a.lastPollAt||a.timerCreatedAt||0));
  priceLifecycleDiag.clear();
  for(const row of rows.slice(0,1000))priceLifecycleDiag.set(row.mint,row);
}

`;
  if(!s.includes(anchor)){console.error('ABORT: extended metrics anchor missing');process.exit(1)}
  s=s.replace(anchor,helper+anchor);
}

// timer creation diagnostic
s=s.replace(
"function ensurePriceTimer(mint,curve){\n  if(priceTimers.has(mint)||!curve)return;",
`function ensurePriceTimer(mint,curve){
  if(priceTimers.has(mint)||!curve)return;
  const _priceDiag=priceDiagRow(mint);
  _priceDiag.timerCreatedAt=Date.now();
  prunePriceDiag();`
);

// every actual poll attempt
s=s.replace(
"    try{\n      const info=await rpc.call('getAccountInfo',[curve,{encoding:'base64',commitment:'confirmed'}]);",
`    try{
      const _pd=priceDiagRow(mint);
      _pd.pollAttempts++;
      _pd.lastPollAt=Date.now();
      const info=await rpc.call('getAccountInfo',[curve,{encoding:'base64',commitment:'confirmed'}]);`
);

// snapshot success
s=s.replace(
"        const updated=store.setToken(mint,{",
`        const _pd2=priceDiagRow(mint);
        _pd2.snapshotCount++;
        _pd2.lastSnapshotAt=Date.now();
        _pd2.lastPollError=null;
        _pd2.lastPollErrorAt=null;
        const updated=store.setToken(mint,{`
);

// poll error
s=s.replace(
"    }catch(e){\n      const updated=store.setToken(mint,{scanError:e.message});",
`    }catch(e){
      const _pd=priceDiagRow(mint);
      _pd.lastPollError=String(e?.message||e).slice(0,200);
      _pd.lastPollErrorAt=Date.now();
      const updated=store.setToken(mint,{scanError:e.message});`
);

// endpoint before /api/settings GET if possible
if(!s.includes("'/api/debug/token-lifecycle'")){
  const marker=" if(url.pathname==='/api/settings'&&req.method==='GET')";
  if(!s.includes(marker)){console.error('ABORT: settings route marker missing');process.exit(1)}
  const route=` if(url.pathname==='/api/debug/token-lifecycle'){
    const mint=String(url.searchParams.get('mint')||'').trim();
    if(!mint)return json(res,400,{error:'MINT_REQUIRED',usage:'/api/debug/token-lifecycle?mint=<token-mint>'});
    const token=store.state.tokens[mint]||null;
    const decision=store.decisions(u.id).find(d=>d.mint===mint)||null;
    const holder=holderQueue.inspect?.(mint)||null;
    const price=priceLifecycleDiag.get(mint)||null;
    const now=Date.now();
    return json(res,200,{
      mint,
      found:Boolean(token),
      now,
      token:token?{
        ageMinutes:tokenAgeMinutes(token),
        launchPlatform:token.launchPlatform||null,
        protocol:token.protocol||null,
        source:token.source||null,
        discoveredAt:token.discoveredAt||null,
        lastScannedAt:token.lastScannedAt||null,
        holderFresh:Boolean(token.holderFresh),
        holderCount:token.holderCount??null,
        top10Pct:token.top10Pct??null,
        developerPct:token.developerPct??token.developerSharePct??null,
        holderScannedAt:token.holderScannedAt||null,
        priceSol:token.priceSol??null,
        liquiditySol:token.liquiditySol??null,
        buyPressure:token.buyPressure??token.momentum??null,
        lastPriceAt:token.lastPriceAt||null,
        lastPriceChangeAt:token.lastPriceChangeAt||null,
        lastMarketActivityAt:token.lastMarketActivityAt||null,
        scanError:token.scanError||null
      }:null,
      holderQueue:holder,
      pricePolling:price?{
        ...price,
        lastSnapshotAgeMs:price.lastSnapshotAt?now-price.lastSnapshotAt:null,
        lastPollAgeMs:price.lastPollAt?now-price.lastPollAt:null
      }:null,
      decision:decision?{
        state:decision.state,
        score:decision.score,
        confidence:decision.confidence??null,
        primaryReason:decision.primaryReason||null,
        reasons:decision.reasons||[],
        settingsVersion:decision.settingsVersion??null,
        reevaluatedAt:decision.reevaluatedAt??null
      }:null,
      effectiveSettings:{
        minHolders:store.settings(u.id).minHolders,
        maxTop10Pct:store.settings(u.id).maxTop10Pct,
        maxDeveloperPct:store.settings(u.id).maxDeveloperPct,
        minBuyPressure:store.settings(u.id).minBuyPressure,
        minLiquidityUsd:store.settings(u.id).minLiquidityUsd,
        minMarketCapUsd:store.settings(u.id).minMarketCapUsd,
        launchPlatforms:store.settings(u.id).launchPlatforms
      }
    });
  }
`;
  s=s.replace(marker,route+marker);
}

save(serverPath,s);
check(enrichPath);check(serverPath);

console.log('');
console.log('INSTALLED MEMEFLOW V10 TOKEN LIFECYCLE DIAGNOSTICS');
console.log('This patch does NOT change trading thresholds, queue timing, retries or decision logic.');
console.log('Run self-test.mjs. Restart only after ALL V10 SELF-TESTS PASSED.');
