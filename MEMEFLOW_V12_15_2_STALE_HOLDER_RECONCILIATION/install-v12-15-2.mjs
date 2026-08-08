#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';

const ROOT=process.cwd();
const APP=path.join(ROOT,'memeflow-app','app-server.mjs');
const ENRICH=path.join(ROOT,'memeflow-app','src','enrich.mjs');
const MARKER='MEMEFLOW_V12_15_2_STALE_HOLDER_RECONCILIATION';

function die(m){console.error('ABORT:',m);process.exit(1)}
function read(p){if(!fs.existsSync(p))die('missing '+p);return fs.readFileSync(p,'utf8')}
function backup(p){const s=new Date().toISOString().replace(/[:.]/g,'-');const b=`${p}.before-v12-15-2-stale-holder-${s}`;fs.copyFileSync(p,b);return b}
function one(src,re,repl,label){const m=src.match(re);if(!m)die('insertion point not found: '+label);return src.replace(re,repl)}
function check(p){execFileSync(process.execPath,['--check',p],{stdio:'inherit'})}

let es=read(ENRICH), as=read(APP);
if(es.includes(MARKER)&&as.includes(MARKER)){console.log('PASS: V12.15.2 already installed');process.exit(0)}

const baseline=es.includes('MEMEFLOW_V12_15_1') || (es.includes('makeHolderQueue')&&es.includes('holder worker timeout')&&es.includes('jobsStarted'));
if(!baseline)die('V12.15.1 holder queue/worker baseline not detected');

const eb=backup(ENRICH), ab=backup(APP);

if(!es.includes('holderLateSucceeded:')){
  es=one(es,/(holderSucceeded\s*:\s*0\s*,)/,`$1
    holderLateSucceeded: 0,`,'holderLateSucceeded metric');
}

if(!/isHolderFreshFn\s*=/.test(es)){
  es=one(es,/const\s*\{\s*enrichHoldersFn\s*,\s*holderMetrics\s*,\s*admissionFn\s*=\s*null\s*\}\s*=\s*deps\s*;/,
`const {enrichHoldersFn,holderMetrics,admissionFn=null,isHolderFreshFn=null}=deps;
  /* ${MARKER}
   * A timed-out holder RPC may still finish later and commit holderFresh=true.
   * Reconcile that durable success before any retry can start.
   */`,'queue deps');
}

if(!es.includes('function reconcileLateHolderSuccess(')){
  es=one(es,/(function\s+pruneHistory\s*\(\)\s*\{[\s\S]*?\n\s*\})\n\s*\n\s*(function\s+scheduleWake)/,
`$1

  function reconcileLateHolderSuccess(mint){
    if(typeof isHolderFreshFn!=='function')return false;
    let fresh=false;
    try{fresh=Boolean(isHolderFreshFn(mint));}catch{fresh=false;}
    if(!fresh)return false;
    pending.delete(mint);
    const row=diagRow(mint);
    if(row.status!=='success'){
      row.status='success';
      row.lastSuccessAt=Date.now();
      row.lastError=null;
      row.lastErrorAt=null;
      holderMetrics.holderLateSucceeded=(holderMetrics.holderLateSucceeded||0)+1;
    }
    row.nextDueAt=null;
    return true;
  }

  $2`,'late-success helper');
}

if(!/function\s+reschedule\s*\(\s*item\s*,\s*delayMs\s*\)\s*\{\s*if\s*\(\s*reconcileLateHolderSuccess/.test(es)){
  es=one(es,/(function\s+reschedule\s*\(\s*item\s*,\s*delayMs\s*\)\s*\{)/,
`$1
    if(reconcileLateHolderSuccess(item.mint)){scheduleWake();return;}`,'reschedule reconciliation');
}

if(!es.includes('V12.15.2 purge durable late successes')){
  es=one(es,/(function\s+drain\s*\(\)\s*\{[\s\S]*?const\s+now\s*=\s*Date\.now\(\)\s*;)/,
`$1
    /* V12.15.2 purge durable late successes */
    for(const mint of [...pending.keys()])reconcileLateHolderSuccess(mint);`,'drain reconciliation');
}

if(!/function\s+enqueue\s*\(\s*mint\s*\)\s*\{\s*if\s*\(\s*reconcileLateHolderSuccess/.test(es)){
  es=one(es,/(function\s+enqueue\s*\(\s*mint\s*\)\s*\{)/,
`$1
    if(reconcileLateHolderSuccess(mint))return false;`,'enqueue reconciliation');
}

if(!as.includes(MARKER)){
  as=one(as,/(\bholderMetrics\s*,\s*)(admissionFn\s*:\s*holderAdmissionForActiveUsers)/,
`$1/* ${MARKER} */
isHolderFreshFn:(mint)=>Boolean(store.state?.tokens?.[mint]?.holderFresh===true),
$2`,'app-server holderQueue deps');
}

try{
  fs.writeFileSync(ENRICH,es);
  fs.writeFileSync(APP,as);
  check(ENRICH);check(APP);
}catch(e){
  fs.copyFileSync(eb,ENRICH);fs.copyFileSync(ab,APP);
  console.error('ROLLBACK: syntax check failed; originals restored');
  throw e;
}

console.log('PASS: MEMEFLOW V12.15.2 installed');
console.log('Backup:',eb);
console.log('Backup:',ab);
console.log('Next: node MEMEFLOW_V12_15_2_STALE_HOLDER_RECONCILIATION/self-test-v12-15-2.mjs');
