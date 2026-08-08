#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
const ROOT=process.cwd();
const APP=path.join(ROOT,'memeflow-app','app-server.mjs');
const FEED=path.join(ROOT,'memeflow-app','src','pump-live-trade-feed.mjs');
let fails=0;function ok(n,v){console.log((v?'PASS: ':'FAIL: ')+n);if(!v)fails++}
const a=fs.readFileSync(APP,'utf8'),f=fs.readFileSync(FEED,'utf8');
ok('V12.26 marker app',a.includes("version:'V12.26'"));
ok('V12.26 marker feed',f.includes('MEMEFLOW_V12_26_EVALUATION_LIFECYCLE_DIAGNOSTICS'));
ok('lifecycle diagnostics',a.includes('evaluationLifecycleDiagnostics:sample.map'));
ok('evaluate wrapper',f.includes('function __v1226Evaluate'));
ok('holder event re-evaluation instrumented',f.includes("__v1226Evaluate(updated,e.mint,'holder-event')"));
ok('market event re-evaluation instrumented',f.includes("__v1226Evaluate(updated,e.mint,'market-event')"));
ok('evaluation counters',f.includes('evaluationCalls:0')&&f.includes('evaluationResolved:0')&&f.includes('evaluationRejected:0'));
ok('recent evaluation diagnostics',f.includes('evaluationRecent:Array.from(__v1226EvalByMint.values()).slice(-12)'));
ok('no trading logic change flag',a.includes('tradingLogicChanged:false'));
ok('V12.25.1 preserved',a.includes("version:'V12.25.1'"));
ok('V12.24 preserved',a.includes("version:'V12.24'"));
ok('V12.23 preserved',a.includes("version:'V12.23'"));
for(const p of [APP,FEED]){const r=spawnSync(process.execPath,['--check',p],{encoding:'utf8'});ok('node --check '+path.basename(p),r.status===0);if(r.status!==0)console.log(r.stderr||r.stdout)}
if(fails){console.error('FAIL: '+fails+' self-test(s)');process.exit(1)}
console.log('PASS: all V12.26 self-tests');
