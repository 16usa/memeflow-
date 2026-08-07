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
  const b=p+'.before-v11-rpc-load-controller';
  if(!fs.existsSync(b))fs.copyFileSync(p,b);
}
function write(p,s){fs.writeFileSync(p,s,'utf8');console.log('Changed:',p)}
function check(p){const r=spawnSync(process.execPath,['--check',p],{encoding:'utf8'});if(r.status!==0){console.error(r.stderr||r.stdout);process.exit(1)}console.log('PASS syntax:',path.relative(appDir,p))}
function rep(src,a,b,label){if(src.includes(b))return src;if(!src.includes(a)){console.error('ABORT anchor missing: '+label);process.exit(1)}return src.replace(a,b)}

let so=fs.readFileSync(solanaPath,'utf8');
so=rep(so,
"/network|connection reset|ECONNRESET/i.test(e.message);",
"/network|connection reset|ECONNRESET|rate limit|too many requests|connection rate limits|quota|credits|data allowance/i.test(e.message);",
"retryable rate-limit");
so=rep(so,
"this.metrics={retries:0,timeouts:0,http429:0,nonJsonResponses:0,endpointFailovers:0,lastHttpStatus:null};\n    this.minIntervalMs=Math.max(0,Number(process.env.RPC_MIN_INTERVAL_MS||200));",
"this.metrics={retries:0,timeouts:0,http429:0,nonJsonResponses:0,endpointFailovers:0,lastHttpStatus:null,cooldownEvents:0,cooldownUntil:null};\n    this.minIntervalMs=Math.max(0,Number(process.env.RPC_MIN_INTERVAL_MS||350));",
"rpc metrics");
so=rep(so,
"getProgramAccounts:Math.max(750,Number(process.env.RPC_GET_PROGRAM_ACCOUNTS_MIN_INTERVAL_MS||2500)),\n      getTransaction:Math.max(200,Number(process.env.RPC_GET_TRANSACTION_MIN_INTERVAL_MS||250)),\n      getTokenSupply:Math.max(350,Number(process.env.RPC_GET_TOKEN_SUPPLY_MIN_INTERVAL_MS||800)),\n      getAccountInfo:Math.max(150,Number(process.env.RPC_GET_ACCOUNT_INFO_MIN_INTERVAL_MS||300)),",
"getProgramAccounts:Math.max(1500,Number(process.env.RPC_GET_PROGRAM_ACCOUNTS_MIN_INTERVAL_MS||3500)),\n      getTransaction:Math.max(250,Number(process.env.RPC_GET_TRANSACTION_MIN_INTERVAL_MS||400)),\n      getTokenSupply:Math.max(500,Number(process.env.RPC_GET_TOKEN_SUPPLY_MIN_INTERVAL_MS||1000)),\n      getAccountInfo:Math.max(500,Number(process.env.RPC_GET_ACCOUNT_INFO_MIN_INTERVAL_MS||1000)),",
"method pacing");
so=rep(so,
"this._nextAllowedAt=0;\n  }\n\n  /** Sanitized hostname",
"this._nextAllowedAt=0;\n    this._globalCooldownUntil=0;\n  }\n\n  _isRateLimitError(e){const msg=String(e?.message||'').toLowerCase();return e?.status===429||msg.includes('429')||msg.includes('rate limit')||msg.includes('too many requests')||msg.includes('quota')||msg.includes('credits')||msg.includes('data allowance')}\n  _noteProviderCooldown(e){if(!this._isRateLimitError(e))return;const now=Date.now(),explicit=Number(e?.retryAfterMs||0),base=Math.max(3000,Number(process.env.RPC_RATE_LIMIT_COOLDOWN_MS||8000)),jitter=Math.floor(Math.random()*1500);this._globalCooldownUntil=Math.max(this._globalCooldownUntil,now+(explicit>0?explicit:base)+jitter);this.metrics.cooldownEvents++;this.metrics.cooldownUntil=this._globalCooldownUntil}\n\n  /** Sanitized hostname",
"cooldown helpers");
so=rep(so,
"try{\n      const methodInterval=this.methodMinIntervalMs?.[method]??this.methodMinIntervalMs?.default??this.minIntervalMs;",
"try{\n      const cooldownWait=Math.max(0,(this._globalCooldownUntil||0)-Date.now());\n      if(cooldownWait)await sleep(cooldownWait);\n      const methodInterval=this.methodMinIntervalMs?.[method]??this.methodMinIntervalMs?.default??this.minIntervalMs;",
"pace cooldown");
so=rep(so,
"if(e.name==='AbortError'||/abort/i.test(e.message))this.metrics.timeouts++;\n      throw e;",
"if(e.name==='AbortError'||/abort/i.test(e.message))this.metrics.timeouts++;\n      this._noteProviderCooldown(e);\n      throw e;",
"callOnce cooldown");
so=rep(so,
"if(e.permanent)throw e;           // never retry permanent parameter errors\n          if(!retryable(e))throw e;",
"if(e.permanent)throw e;           // never retry permanent parameter errors\n          this._noteProviderCooldown(e);\n          if(!retryable(e))throw e;",
"call cooldown");
write(solanaPath,so);

let en=fs.readFileSync(enrichPath,'utf8');
if(!en.includes('MEMEFLOW_V11_HOLDER_BACKOFF')){
  const a=`  function reschedule(item,delayMs){
    pending.set(item.mint,{
      ...item,
      retries:item.retries+1,
      dueAt:Date.now()+Math.max(1000,delayMs)
    });
  }`;
  const b=`  function reschedule(item,delayMs){
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
  if(!en.includes(a)){console.error('ABORT holder reschedule anchor missing');process.exit(1)}
  en=en.replace(a,b);
}
write(enrichPath,en);

let sv=fs.readFileSync(serverPath,'utf8');
if(!sv.includes('MEMEFLOW_V11_PRICE_LOAD_SHED')){
  const a=`    let backgroundEveryMs=5000;
    if(ageMs>15*60_000)backgroundEveryMs=60_000;
    else if(ageMs>3*60_000)backgroundEveryMs=15_000;

    if(!hasStream&&now-lastBackgroundPollAt<backgroundEveryMs)return;
    lastBackgroundPollAt=now;`;
  const b=`    /* MEMEFLOW_V11_PRICE_LOAD_SHED */
    let backgroundEveryMs=12000;
    if(ageMs>15*60_000)backgroundEveryMs=90000;
    else if(ageMs>3*60_000)backgroundEveryMs=30000;

    if(!hasStream&&now-lastBackgroundPollAt<backgroundEveryMs)return;

    const holderBacklog=(holderQueue.queueDepth||0)+(holderQueue.processing||0);
    const lastPriceAt=Number(t.lastPriceAt||0);
    const priceAgeMs=lastPriceAt>0?now-lastPriceAt:Infinity;
    if(!hasStream&&holderBacklog>0&&priceAgeMs<30000)return;

    lastBackgroundPollAt=now;`;
  if(!sv.includes(a)){console.error('ABORT price polling anchor missing');process.exit(1)}
  sv=sv.replace(a,b);
}
write(serverPath,sv);

for(const p of [solanaPath,enrichPath,serverPath])check(p);
console.log('');
console.log('INSTALLED MEMEFLOW V11 RPC LOAD CONTROLLER');
console.log('Run self-test.mjs. Restart only after ALL V11 SELF-TESTS PASSED.');
