#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';

const ROOT=process.cwd();
const ENRICH=path.join(ROOT,'memeflow-app','src','enrich.mjs');
const MARKER='MEMEFLOW_V12_15_3_HOLDER_QUEUE_WATCHDOG';

function die(m){console.error('ABORT:',m);process.exit(1)}
function read(p){if(!fs.existsSync(p))die('missing '+p);return fs.readFileSync(p,'utf8')}
function backup(p){const s=new Date().toISOString().replace(/[:.]/g,'-');const b=`${p}.before-v12-15-3-watchdog-${s}`;fs.copyFileSync(p,b);return b}
function check(p){execFileSync(process.execPath,['--check',p],{stdio:'inherit'})}
function one(src,re,repl,label){if(!re.test(src))die('insertion point not found: '+label);return src.replace(re,repl)}

let s=read(ENRICH);
if(s.includes(MARKER)){console.log('PASS: V12.15.3 already installed');process.exit(0)}

if(!s.includes('function drain()')) die('holder queue drain() not found');
if(!s.includes('function enqueue(')) die('holder queue enqueue() not found');

const b=backup(ENRICH);

// Add watchdog state next to wake timer.
s=one(s,
  /(let\s+wakeTimer\s*=\s*null\s*;[\s\S]*?let\s+wakeAt\s*=\s*0\s*;[^\n]*\n)/,
  `$1
  /* ${MARKER}
   * Safety net for missed/late wake timers. It never bypasses maxConcurrent;
   * it only calls drain(), which retains the queue's normal admission and
   * concurrency rules.
   */
  const HOLDER_QUEUE_WATCHDOG_MS=Math.max(100,Number(process.env.HOLDER_QUEUE_WATCHDOG_MS||250));
  let watchdogTimer=null;

  function ensureWatchdog(){
    if(watchdogTimer)return;
    watchdogTimer=setInterval(()=>{
      try{
        if(pending.size && active.size<maxConcurrent)drain();
      }catch{}
    },HOLDER_QUEUE_WATCHDOG_MS);
    watchdogTimer.unref?.();
  }
`,
  'watchdog state'
);

// Ensure watchdog starts as soon as queue object is constructed.
s=one(s,
  /(function\s+scheduleWake\s*\(\)\s*\{)/,
  `ensureWatchdog();

  $1`,
  'watchdog startup'
);

// After enqueue, force an immediate drain pass in a microtask.
// drain() itself honors dueAt, so this does not skip initial delay.
if(!s.includes('V12.15.3 enqueue kick')){
  s=one(s,
    /(scheduleWake\(\);\s*\n\s*return\s+true\s*;\s*\n\s*\})/,
    `scheduleWake();
    /* V12.15.3 enqueue kick */
    queueMicrotask(()=>{try{drain();}catch{}});
    return true;
  }`,
    'enqueue kick'
  );
}

// Make scheduleWake robust when next due is already in the past.
if(!s.includes('V12.15.3 overdue wake')){
  s=one(s,
    /(wakeTimer=setTimeout\(\(\)=>\{[\s\S]*?drain\(\);\s*\n\s*\},)(Math\.max\(0,next-now\))(\);)/,
    `$1/* V12.15.3 overdue wake */$2$3`,
    'overdue wake marker'
  );
}

try{
  fs.writeFileSync(ENRICH,s);
  check(ENRICH);
}catch(e){
  fs.copyFileSync(b,ENRICH);
  console.error('ROLLBACK: syntax check failed; original restored');
  throw e;
}
console.log('PASS: MEMEFLOW V12.15.3 HOLDER QUEUE WATCHDOG installed');
console.log('Backup:',b);
console.log('Next: node MEMEFLOW_V12_15_3_HOLDER_QUEUE_WATCHDOG/self-test-v12-15-3.mjs');
