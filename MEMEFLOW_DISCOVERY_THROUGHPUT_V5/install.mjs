import fs from 'node:fs';
import path from 'node:path';

const cwd=process.cwd();
const appDir=fs.existsSync(path.join(cwd,'memeflow-app'))?path.join(cwd,'memeflow-app'):cwd;
const solanaPath=path.join(appDir,'src','solana.mjs');
const serverPath=path.join(appDir,'app-server.mjs');
const discPath=path.join(appDir,'src','discqueue.mjs');

for(const p of [solanaPath,serverPath,discPath]){
  if(!fs.existsSync(p)){console.error('ABORT: missing '+p);process.exit(1)}
  const b=p+'.before-discovery-throughput-v5';
  if(!fs.existsSync(b))fs.copyFileSync(p,b);
}

// 1) More in-flight getTransaction workers.
// Request STARTS are still paced by RpcPool, so this does not create a burst.
// It only prevents two slow HTTP responses from freezing the whole discovery lane.
{
  let s=fs.readFileSync(serverPath,'utf8');

  s=s.replace(
    /MAX_CONCURRENT=Math\.max\(2,Number\(process\.env\.DISCOVERY_MAX_CONCURRENT\|\|2\)\)/g,
    `MAX_CONCURRENT=Math.max(6,Number(process.env.DISCOVERY_MAX_CONCURRENT||6))`
  );
  s=s.replace(
    /DISCOVERY_MAX_CONCURRENT\|\|2/g,
    `DISCOVERY_MAX_CONCURRENT||6`
  );

  fs.writeFileSync(serverPath,s);
  console.log('Changed:',serverPath);
}

// 2) Keep getTransaction fresh.
// V4 showed no 429 but queue age climbed to ~97 seconds because two workers could
// sit on slow public-RPC responses. Increase parallel in-flight capacity while
// preserving paced starts. Start interval stays conservative at 250 ms.
{
  let s=fs.readFileSync(solanaPath,'utf8');

  s=s.replace(
    `getTransaction:Math.max(200,Number(process.env.RPC_GET_TRANSACTION_MIN_INTERVAL_MS||275)),`,
    `getTransaction:Math.max(200,Number(process.env.RPC_GET_TRANSACTION_MIN_INTERVAL_MS||250)),`
  );

  // Add method-specific timeout helper if not already present.
  if(!s.includes('methodTimeoutMs(method)')){
    const paceMarker=`  async _pace(method='default'){`;
    if(!s.includes(paceMarker))throw new Error('ABORT: V4 _pace() not found');
    const helper=`  methodTimeoutMs(method){
    if(method==='getTransaction')return Math.max(3000,Number(process.env.RPC_GET_TRANSACTION_TIMEOUT_MS||6000));
    if(method==='getProgramAccounts')return Math.max(8000,Number(process.env.RPC_GET_PROGRAM_ACCOUNTS_TIMEOUT_MS||20000));
    return Math.max(5000,Number(process.env.SOLANA_RPC_TIMEOUT_MS||20000));
  }

`;
    s=s.replace(paceMarker,helper+paceMarker);
  }

  // Patch the AbortController timeout inside call() in a source-tolerant way.
  // Common patched source contains this.timeoutMs or process SOLANA_RPC_TIMEOUT_MS.
  s=s.replace(
    /setTimeout\(\(\)=>ac\.abort\(\),this\.timeoutMs\)/g,
    `setTimeout(()=>ac.abort(),this.methodTimeoutMs(method))`
  );
  s=s.replace(
    /setTimeout\(\(\)=>ac\.abort\(\),Math\.max\(5000,Number\(process\.env\.SOLANA_RPC_TIMEOUT_MS\|\|20000\)\)\)/g,
    `setTimeout(()=>ac.abort(),this.methodTimeoutMs(method))`
  );
  s=s.replace(
    /setTimeout\(\(\)=>c\.abort\(\),this\.timeoutMs\)/g,
    `setTimeout(()=>c.abort(),this.methodTimeoutMs(method))`
  );

  fs.writeFileSync(solanaPath,s);
  console.log('Changed:',solanaPath);
}

// 3) Faster retry of a temporarily unavailable transaction.
// Signature lifetime remains 15 minutes, so nothing is discarded.
{
  let s=fs.readFileSync(discPath,'utf8');

  s=s.replace(
    `retryDelays = [500, 1500, 4000, 10000]`,
    `retryDelays = [250, 750, 2000, 5000]`
  );

  fs.writeFileSync(discPath,s);
  console.log('Changed:',discPath);
}

console.log('');
console.log('Installed MEMEFLOW DISCOVERY THROUGHPUT V5.');
console.log('Run self-test.mjs. Do not restart unless it passes.');