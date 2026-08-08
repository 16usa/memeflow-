#!/usr/bin/env node
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
const p='memeflow-app/src/enrich.mjs';
const s=fs.readFileSync(p,'utf8');
let bad=false;
function t(n,v){console.log((v?'PASS: ':'FAIL: ')+n);if(!v)bad=true}
t('marker',s.includes('MEMEFLOW_V12_15_3_HOLDER_QUEUE_WATCHDOG'));
t('watchdog interval',s.includes('HOLDER_QUEUE_WATCHDOG_MS'));
t('watchdog calls drain',/setInterval\([\s\S]*?drain\(\)/.test(s));
t('watchdog preserves concurrency',s.includes('active.size<maxConcurrent'));
t('enqueue microtask kick',s.includes('V12.15.3 enqueue kick'));
try{execFileSync(process.execPath,['--check',p],{stdio:'inherit'});console.log('PASS: node --check')}catch{bad=true;console.log('FAIL: node --check')}
if(bad)process.exit(1);
console.log('PASS: V12.15.3 self-test complete');
