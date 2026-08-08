import fs from 'node:fs';import {spawnSync} from 'node:child_process';
const files=['memeflow-app/src/enrich.mjs','memeflow-app/src/solana.mjs','memeflow-app/app-server.mjs'];
let bad=0;const e=fs.readFileSync(files[0],'utf8'),s=fs.readFileSync(files[1],'utf8'),a=fs.readFileSync(files[2],'utf8');
for(const [n,ok] of [['holder timeout marker',e.includes('MEMEFLOW_V12_14_HOLDER_WORKER_TIMEOUT')],['timeout metric',e.includes('holderWorkerTimeouts')],['method timeout marker',s.includes('MEMEFLOW_V12_14_METHOD_TIMEOUT')],['method-specific RPC timeout',s.includes('const TIMEOUT=this.methodTimeoutMs(method)')],['concurrency default 2',a.includes('HOLDER_QUEUE_CONCURRENCY||2')]]){console.log((ok?'PASS: ':'FAIL: ')+n);if(!ok)bad++}
for(const f of files){const r=spawnSync(process.execPath,['--check',f],{encoding:'utf8'});console.log((r.status===0?'PASS: ':'FAIL: ')+'node --check '+f);if(r.status!==0){bad++;console.log(r.stderr)}}
process.exit(bad?1:0);
