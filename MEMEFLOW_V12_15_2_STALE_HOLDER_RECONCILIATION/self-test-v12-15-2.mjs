#!/usr/bin/env node
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
const e='memeflow-app/src/enrich.mjs',a='memeflow-app/app-server.mjs';
const es=fs.readFileSync(e,'utf8'),as=fs.readFileSync(a,'utf8');
let bad=false;
function t(n,v){console.log((v?'PASS: ':'FAIL: ')+n);if(!v)bad=true}
t('marker',es.includes('MEMEFLOW_V12_15_2_STALE_HOLDER_RECONCILIATION')&&as.includes('MEMEFLOW_V12_15_2_STALE_HOLDER_RECONCILIATION'));
t('late success metric',es.includes('holderLateSucceeded: 0'));
t('fresh predicate',es.includes('isHolderFreshFn=null'));
t('late success helper',es.includes('function reconcileLateHolderSuccess('));
t('reschedule guard',/function\s+reschedule[\s\S]*?reconcileLateHolderSuccess\(item\.mint\)/.test(es));
t('drain purge',es.includes('V12.15.2 purge durable late successes'));
t('enqueue guard',/function\s+enqueue[\s\S]*?reconcileLateHolderSuccess\(mint\)/.test(es));
t('app-server predicate',as.includes('isHolderFreshFn:(mint)=>Boolean(store.state?.tokens?.[mint]?.holderFresh===true)'));
for(const p of [e,a]){try{execFileSync(process.execPath,['--check',p],{stdio:'inherit'});console.log('PASS: node --check '+p)}catch{bad=true;console.log('FAIL: node --check '+p)}}
if(bad)process.exit(1);
console.log('PASS: V12.15.2 self-test complete');
