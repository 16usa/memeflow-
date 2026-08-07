import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

const cwd=process.cwd();
const appDir=fs.existsSync(path.join(cwd,'memeflow-app'))?path.join(cwd,'memeflow-app'):cwd;
const serverPath=path.join(appDir,'app-server.mjs');
const enrichPath=path.join(appDir,'src','enrich.mjs');
const solanaPath=path.join(appDir,'src','solana.mjs');

for(const p of [serverPath,enrichPath,solanaPath]){
  if(!fs.existsSync(p)){console.error('ABORT: missing '+p);process.exit(1)}
  const b=p+'.before-v11-1-repair';
  if(!fs.existsSync(b))fs.copyFileSync(p,b);
}

function check(p){
  const r=spawnSync(process.execPath,['--check',p],{encoding:'utf8'});
  if(r.status!==0){console.error(r.stderr||r.stdout);process.exit(r.status||1)}
  console.log('PASS syntax:',path.relative(appDir,p));
}
function write(p,s){fs.writeFileSync(p,s,'utf8');console.log('Changed:',p)}
function replaceIfPresent(src,oldText,newText){
  return src.includes(oldText)?src.replace(oldText,newText):src;
}

// ─────────────────────────────────────────────────────────────────────────────
// SOLANA.MJS — finish/verify partial V11 install idempotently
// ─────────────────────────────────────────────────────────────────────────────
let so=fs.readFileSync(solanaPath,'utf8');

if(!so.includes('connection rate limits')){
  so=replaceIfPresent(
    so,
    "/network|connection reset|ECONNRESET/i.test(e.message);",
    "/network|connection reset|ECONNRESET|rate limit|too many requests|connection rate limits|quota|credits|data allowance/i.test(e.message);"
  );
}

if(!so.includes('cooldownEvents:0')){
  so=replaceIfPresent(
    so,
    "this.metrics={retries:0,timeouts:0,http429:0,nonJsonResponses:0,endpointFailovers:0,lastHttpStatus:null};",
    "this.metrics={retries:0,timeouts:0,http429:0,nonJsonResponses:0,endpointFailovers:0,lastHttpStatus:null,cooldownEvents:0,cooldownUntil:null};"
  );
}
so=so.replace("RPC_MIN_INTERVAL_MS||200","RPC_MIN_INTERVAL_MS||350");
so=so.replace("RPC_GET_PROGRAM_ACCOUNTS_MIN_INTERVAL_MS||2500","RPC_GET_PROGRAM_ACCOUNTS_MIN_INTERVAL_MS||3500");
so=so.replace("RPC_GET_TRANSACTION_MIN_INTERVAL_MS||250","RPC_GET_TRANSACTION_MIN_INTERVAL_MS||400");
so=so.replace("RPC_GET_TOKEN_SUPPLY_MIN_INTERVAL_MS||800","RPC_GET_TOKEN_SUPPLY_MIN_INTERVAL_MS||1000");
so=so.replace("RPC_GET_ACCOUNT_INFO_MIN_INTERVAL_MS||300","RPC_GET_ACCOUNT_INFO_MIN_INTERVAL_MS||1000");

if(!so.includes('_globalCooldownUntil')){
  const anchor="this._nextAllowedAt=0;\n  }";
  if(!so.includes(anchor)){console.error('ABORT: RpcPool constructor anchor missing');process.exit(1)}
  so=so.replace(anchor,
`this._nextAllowedAt=0;
    this._globalCooldownUntil=0;
  }

  _isRateLimitError(e){
    const msg=String(e?.message||'').toLowerCase();
    return e?.status===429||msg.includes('429')||msg.includes('rate limit')||msg.includes('too many requests')||msg.includes('quota')||msg.includes('credits')||msg.includes('data allowance');
  }

  _noteProviderCooldown(e){
    if(!this._isRateLimitError(e))return;
    const now=Date.now();
    const explicit=Number(e?.retryAfterMs||0);
    const base=Math.max(3000,Number(process.env.RPC_RATE_LIMIT_COOLDOWN_MS||8000));
    const jitter=Math.floor(Math.random()*1500);
    this._globalCooldownUntil=Math.max(this._globalCooldownUntil,now+(explicit>0?explicit:base)+jitter);
    this.metrics.cooldownEvents++;
    this.metrics.cooldownUntil=this._globalCooldownUntil;
  }`);
}

if(!so.includes("cooldownWait=Math.max(0,(this._globalCooldownUntil||0)-Date.now())")){
  const a="try{\n      const methodInterval=this.methodMinIntervalMs?.[method]??this.methodMinIntervalMs?.default??this.minIntervalMs;";
  const b="try{\n      const cooldownWait=Math.max(0,(this._globalCooldownUntil||0)-Date.now());\n      if(cooldownWait)await sleep(cooldownWait);\n      const methodInterval=this.methodMinIntervalMs?.[method]??this.methodMinIntervalMs?.default??this.minIntervalMs;";
  if(!so.includes(a)){console.error('ABORT: _pace anchor missing');process.exit(1)}
  so=so.replace(a,b);
}

const callOnceOld="if(e.name==='AbortError'||/abort/i.test(e.message))this.metrics.timeouts++;\n      throw e;";
const callOnceNew="if(e.name==='AbortError'||/abort/i.test(e.message))this.metrics.timeouts++;\n      this._noteProviderCooldown(e);\n      throw e;";
if(!so.includes(callOnceNew) && so.includes(callOnceOld)) so=so.replace(callOnceOld,callOnceNew);

const callOld="if(e.permanent)throw e;           // never retry permanent parameter errors\n          if(!retryable(e))throw e;";
const callNew="if(e.permanent)throw e;           // never retry permanent parameter errors\n          this._noteProviderCooldown(e);\n          if(!retryable(e))throw e;";
if(!so.includes(callNew) && so.includes(callOld)) so=so.replace(callOld,callNew);

write(solanaPath,so);

// ─────────────────────────────────────────────────────────────────────────────
// ENRICH.MJS — robustly replace reschedule() regardless of formatting
// ─────────────────────────────────────────────────────────────────────────────
let en=fs.readFileSync(enrichPath,'utf8');

if(!en.includes('MEMEFLOW_V11_HOLDER_BACKOFF')){
  const start=en.indexOf('function reschedule(');
  if(start<0){console.error('ABORT: function reschedule() not found in enrich.mjs');process.exit(1)}

  let brace=en.indexOf('{',start);
  if(brace<0){console.error('ABORT: reschedule opening brace missing');process.exit(1)}

  let depth=0,end=-1;
  for(let i=brace;i<en.length;i++){
    if(en[i]==='{')depth++;
    else if(en[i]==='}'){
      depth--;
      if(depth===0){end=i+1;break}
    }
  }
  if(end<0){console.error('ABORT: reschedule closing brace missing');process.exit(1)}

  const replacement=`function reschedule(item,delayMs){
    /* MEMEFLOW_V11_HOLDER_BACKOFF */
    const base=Math.max(5000,Number(delayMs)||retryDelayMs);
    const exponential=Math.min(120000,base*Math.pow(2,Math.min(item.retries,3)));
    const jitter=Math.floor(Math.random()*2000);
    pending.set(item.mint,{
      ...item,
      retries:item.retries+1,
      dueAt:Date.now()+exponential+jitter
    });
  }`;
  en=en.slice(0,start)+replacement+en.slice(end);
}

write(enrichPath,en);

// ─────────────────────────────────────────────────────────────────────────────
// APP-SERVER.MJS — adaptive price load shedding, robust insertion
// ─────────────────────────────────────────────────────────────────────────────
let sv=fs.readFileSync(serverPath,'utf8');

if(!sv.includes('MEMEFLOW_V11_PRICE_LOAD_SHED')){
  const start=sv.indexOf('let backgroundEveryMs=');
  if(start<0){console.error('ABORT: backgroundEveryMs block not found');process.exit(1)}
  const after=sv.indexOf('lastBackgroundPollAt=now;',start);
  if(after<0){console.error('ABORT: lastBackgroundPollAt anchor not found');process.exit(1)}
  const end=after+'lastBackgroundPollAt=now;'.length;

  const block=`let backgroundEveryMs=12000;
    /* MEMEFLOW_V11_PRICE_LOAD_SHED */
    if(ageMs>15*60_000)backgroundEveryMs=90000;
    else if(ageMs>3*60_000)backgroundEveryMs=30000;

    if(!hasStream&&now-lastBackgroundPollAt<backgroundEveryMs)return;

    const holderBacklog=(holderQueue.queueDepth||0)+(holderQueue.processing||0);
    const lastPriceAt=Number(t.lastPriceAt||0);
    const priceAgeMs=lastPriceAt>0?now-lastPriceAt:Infinity;

    // Reserve RPC capacity for holder scans, while still allowing a price
    // refresh roughly every 30s so anti-rug snapshots continue to progress.
    if(!hasStream&&holderBacklog>0&&priceAgeMs<30000)return;

    lastBackgroundPollAt=now;`;

  sv=sv.slice(0,start)+block+sv.slice(end);
}

write(serverPath,sv);

// Validate all touched modules
for(const p of [solanaPath,enrichPath,serverPath])check(p);

console.log('');
console.log('V11.1 REPAIR INSTALLED');
console.log('This repair is safe for the partial V11 state shown in your Shell.');
console.log('Run self-test.mjs next.');
