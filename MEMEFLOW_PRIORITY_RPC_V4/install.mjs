import fs from 'node:fs';
import path from 'node:path';

const cwd=process.cwd();
const appDir=fs.existsSync(path.join(cwd,'memeflow-app'))?path.join(cwd,'memeflow-app'):cwd;
const solanaPath=path.join(appDir,'src','solana.mjs');
const serverPath=path.join(appDir,'app-server.mjs');
const discPath=path.join(appDir,'src','discqueue.mjs');

for(const p of [solanaPath,serverPath,discPath]){
  if(!fs.existsSync(p)){console.error('ABORT: missing '+p);process.exit(1)}
  const b=p+'.before-priority-rpc-v4';
  if(!fs.existsSync(b))fs.copyFileSync(p,b);
}

function replaceOnce(s,a,b,label){
  if(s.includes(b))return s;
  if(!s.includes(a))throw new Error('ABORT: anchor not found: '+label);
  return s.replace(a,b);
}

// 1) FIX THE V3 HEAD-OF-LINE BLOCKING BUG.
// V3 correctly added method-specific limits, but _pace() waited for a slow
// getProgramAccounts interval while holding the one global queue. That means
// holder scans could make fresh getTransaction signatures wait ~seconds.
// V4 gives each RPC method its own wait lane, and only acquires the global
// start gate for the very short final global spacing window.
{
  let s=fs.readFileSync(solanaPath,'utf8');

  if(!s.includes('this._methodPaceTails=new Map();')){
    const anchor=`this._methodNextAllowedAt=new Map();`;
    if(!s.includes(anchor))throw new Error('ABORT: V3 method pacing state not found');
    s=s.replace(anchor,`${anchor}
    this._methodPaceTails=new Map();`);
  }

  const old=`  async _pace(method='default'){
    const previous=this._paceTail;
    let release;
    this._paceTail=new Promise(r=>{release=r});
    await previous;
    try{
      const now=Date.now();
      const methodInterval=this.methodMinIntervalMs?.[method]??this.methodMinIntervalMs?.default??this.minIntervalMs;
      const methodNext=this._methodNextAllowedAt?.get(method)||0;
      const wait=Math.max(0,this._nextAllowedAt-now,methodNext-now);
      if(wait)await sleep(wait);
      const started=Date.now();
      this._nextAllowedAt=started+this.minIntervalMs;
      if(this._methodNextAllowedAt)this._methodNextAllowedAt.set(method,started+methodInterval);
    }finally{
      release();
    }
  }`;

  const neu=`  async _pace(method='default'){
    // Serialize only calls of the SAME method while they wait for their own
    // method limit. A slow getProgramAccounts wait must not block getTransaction.
    const previousMethod=this._methodPaceTails.get(method)||Promise.resolve();
    let releaseMethod;
    const methodTurn=new Promise(r=>{releaseMethod=r});
    this._methodPaceTails.set(method,previousMethod.then(()=>methodTurn));
    await previousMethod;

    try{
      const methodInterval=this.methodMinIntervalMs?.[method]??this.methodMinIntervalMs?.default??this.minIntervalMs;
      const methodNext=this._methodNextAllowedAt?.get(method)||0;
      const methodWait=Math.max(0,methodNext-Date.now());
      if(methodWait)await sleep(methodWait);

      // Global gate protects only the actual request-start spacing.
      const previousGlobal=this._paceTail;
      let releaseGlobal;
      this._paceTail=new Promise(r=>{releaseGlobal=r});
      await previousGlobal;
      try{
        const globalWait=Math.max(0,this._nextAllowedAt-Date.now());
        if(globalWait)await sleep(globalWait);
        const started=Date.now();
        this._nextAllowedAt=started+this.minIntervalMs;
        this._methodNextAllowedAt.set(method,started+methodInterval);
      }finally{
        releaseGlobal();
      }
    }finally{
      releaseMethod();
    }
  }`;

  if(s.includes(old)){
    s=s.replace(old,neu);
  } else if(!s.includes('A slow getProgramAccounts wait must not block getTransaction')){
    throw new Error('ABORT: V3 _pace block not found');
  }

  // Faster discovery lane, still below typical public per-method limits.
  s=s.replace(
    `getTransaction:Math.max(250,Number(process.env.RPC_GET_TRANSACTION_MIN_INTERVAL_MS||450)),`,
    `getTransaction:Math.max(200,Number(process.env.RPC_GET_TRANSACTION_MIN_INTERVAL_MS||275)),`
  );
  // Global 200ms default = at most 5 request starts/sec across all methods.
  s=s.replace(
    `this.minIntervalMs=Math.max(0,Number(process.env.RPC_MIN_INTERVAL_MS||300));`,
    `this.minIntervalMs=Math.max(0,Number(process.env.RPC_MIN_INTERVAL_MS||200));`
  );

  fs.writeFileSync(solanaPath,s);
  console.log('Changed:',solanaPath);
}

// 2) Discovery needs more than one getTransaction worker now that RPC pacing
// itself safely governs the request rate. Two workers hide response latency
// without creating a burst because _pace('getTransaction') still serializes starts.
{
  let s=fs.readFileSync(serverPath,'utf8');

  s=s.replace(
    `const MAX_CONCURRENT=Number(process.env.RPC_MAX_CONCURRENCY||1),QUEUE_MAX=Number(process.env.DISCOVERY_QUEUE_MAX||1000);`,
    `const MAX_CONCURRENT=Math.max(2,Number(process.env.DISCOVERY_MAX_CONCURRENT||2)),QUEUE_MAX=Number(process.env.DISCOVERY_QUEUE_MAX||1000);`
  );

  // Older/current variants.
  s=s.replace(
    /MAX_CONCURRENT=Number\(process\.env\.RPC_MAX_CONCURRENCY\|\|1\)/g,
    `MAX_CONCURRENT=Math.max(2,Number(process.env.DISCOVERY_MAX_CONCURRENT||2))`
  );

  fs.writeFileSync(serverPath,s);
  console.log('Changed:',serverPath);
}

// 3) Shorten retry latency for transient getTransaction nulls while retaining
// the 15-minute signature lifetime. This improves fresh-token latency without
// dropping signatures.
{
  let s=fs.readFileSync(discPath,'utf8');

  s=s.replace(
    `retryDelays = [1000, 3000, 8000, 15000]`,
    `retryDelays = [500, 1500, 4000, 10000]`
  );

  fs.writeFileSync(discPath,s);
  console.log('Changed:',discPath);
}

console.log('');
console.log('Installed MEMEFLOW PRIORITY RPC V4.');
console.log('Run self-test.mjs. Restart only after ALL V4 SELF-TESTS PASSED.');