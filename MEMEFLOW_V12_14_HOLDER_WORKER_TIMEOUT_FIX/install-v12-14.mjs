import fs from 'node:fs';
import path from 'node:path';
const root=process.cwd();
const ep=path.join(root,'memeflow-app','src','enrich.mjs');
const sp=path.join(root,'memeflow-app','src','solana.mjs');
const ap=path.join(root,'memeflow-app','app-server.mjs');
for(const p of [ep,sp,ap]) if(!fs.existsSync(p)){console.error('ABORT: missing '+p);process.exit(1)}
const stamp=new Date().toISOString().replace(/[:.]/g,'-');
for(const p of [ep,sp,ap]) fs.copyFileSync(p,p+'.before-v12-14-'+stamp);
let e=fs.readFileSync(ep,'utf8'), s=fs.readFileSync(sp,'utf8'), a=fs.readFileSync(ap,'utf8');
if(!e.includes('MEMEFLOW_V12_14_HOLDER_WORKER_TIMEOUT')){
  e=e.replace("    holderAdmissionErrors: 0,\n    lastHolderAdmissionReason: null,","    holderAdmissionErrors: 0,\n    holderWorkerTimeouts: 0,\n    lastHolderWorkerTimeoutAt: null,\n    lastHolderAdmissionReason: null,");
  e=e.replace("  const maxRetries=Math.max(1,Number(config?.maxRetries??8));\n  const {enrichHoldersFn,holderMetrics,admissionFn=null}=deps;","  const maxRetries=Math.max(1,Number(config?.maxRetries??8));\n  /* MEMEFLOW_V12_14_HOLDER_WORKER_TIMEOUT */\n  const workerTimeoutMs=Math.max(5000,Number(config?.workerTimeoutMs??process.env.HOLDER_WORKER_TIMEOUT_MS??11000));\n  const {enrichHoldersFn,holderMetrics,admissionFn=null}=deps;");
  e=e.replace("      const result=await enrichHoldersFn(item.mint);","      const timeoutError=()=>Object.assign(new Error('holder worker timeout after '+workerTimeoutMs+'ms'),{holderWorkerTimeout:true,retryAfterMs:Math.max(retryDelayMs,15000)});\n      let timeoutId=null;\n      const result=await Promise.race([\n        Promise.resolve(enrichHoldersFn(item.mint)),\n        new Promise((_,reject)=>{timeoutId=setTimeout(()=>reject(timeoutError()),workerTimeoutMs)})\n      ]).finally(()=>{if(timeoutId)clearTimeout(timeoutId)});");
  e=e.replace("    }catch(e){\n      if(item.retries<maxRetries && isRateLimited(e)){","    }catch(e){\n      if(e?.holderWorkerTimeout){\n        holderMetrics.holderWorkerTimeouts=(holderMetrics.holderWorkerTimeouts||0)+1;\n        holderMetrics.lastHolderWorkerTimeoutAt=Date.now();\n        holderMetrics.lastHolderError=sanitize(e.message);\n        holderMetrics.lastHolderErrorAt=Date.now();\n        _diag.lastError=sanitize(e.message);\n        _diag.lastErrorAt=Date.now();\n        _diag.status='timeout';\n        if(item.retries<maxRetries){holderMetrics.holderRetries++;reschedule(item,e.retryAfterMs??retryDelayMs)}else{holderMetrics.holderFailed++}\n      }else if(item.retries<maxRetries && isRateLimited(e)){");
}
if(!s.includes('MEMEFLOW_V12_14_METHOD_TIMEOUT')){
  s=s.replace("if(method==='getProgramAccounts')return Math.max(8000,Number(process.env.RPC_GET_PROGRAM_ACCOUNTS_TIMEOUT_MS||20000));","if(method==='getProgramAccounts')return Math.max(5000,Number(process.env.RPC_GET_PROGRAM_ACCOUNTS_TIMEOUT_MS||9000)); // MEMEFLOW_V12_14_METHOD_TIMEOUT");
  s=s.replace("    const TIMEOUT=Number(process.env.SOLANA_RPC_TIMEOUT_MS||20000);","    const TIMEOUT=this.methodTimeoutMs(method); // MEMEFLOW_V12_14_METHOD_TIMEOUT");
}
if(!a.includes('MEMEFLOW_V12_14_HOLDER_CONCURRENCY')){
  a=a.replace(/const holderQueue=makeHolderQueue\(\{maxConcurrent:1,/,"const holderQueue=makeHolderQueue({maxConcurrent:Math.max(1,Number(process.env.HOLDER_QUEUE_CONCURRENCY||2)),workerTimeoutMs:Math.max(5000,Number(process.env.HOLDER_WORKER_TIMEOUT_MS||11000)), /* MEMEFLOW_V12_14_HOLDER_CONCURRENCY */ ");
}
if(!e.includes('MEMEFLOW_V12_14_HOLDER_WORKER_TIMEOUT')){console.error('ABORT: enrich patch failed');process.exit(2)}
if(!s.includes('MEMEFLOW_V12_14_METHOD_TIMEOUT')){console.error('ABORT: solana patch failed');process.exit(3)}
if(!a.includes('MEMEFLOW_V12_14_HOLDER_CONCURRENCY')){console.error('ABORT: app-server patch failed');process.exit(4)}
fs.writeFileSync(ep,e);fs.writeFileSync(sp,s);fs.writeFileSync(ap,a);
console.log('PASS: MEMEFLOW V12.14 installed');
console.log('Next: node MEMEFLOW_V12_14_HOLDER_WORKER_TIMEOUT_FIX/self-test-v12-14.mjs && cd memeflow-app && npm start');
