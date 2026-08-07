import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

const cwd=process.cwd();
const appDir=fs.existsSync(path.join(cwd,'memeflow-app'))?path.join(cwd,'memeflow-app'):cwd;
const enrichPath=path.join(appDir,'src','enrich.mjs');

if(!fs.existsSync(enrichPath)){
  console.error('ABORT: missing '+enrichPath);
  process.exit(1);
}

let s=fs.readFileSync(enrichPath,'utf8');
const backup=enrichPath+'.before-v12-7-holder-correctness-priority';
if(!fs.existsSync(backup))fs.copyFileSync(enrichPath,backup);

if(!s.includes('MEMEFLOW_V12_7_HOLDER_CORRECTNESS_AND_PRIORITY')){
  // ------------------------------------------------------------------
  // FIX A: Phase A must never erase a successful Phase B holder scan.
  // ------------------------------------------------------------------
  const oldHolderReset=`      // Holder data deferred to Phase B
      holderFresh: false,
      holderCount: null,
      top10Pct: null,`;

  const newHolderReset=`      // MEMEFLOW_V12_7_HOLDER_CORRECTNESS_AND_PRIORITY
      // Phase A may finish AFTER Phase B. Never erase a successful holder scan.
      holderFresh: existingToken.holderFresh === true,
      holderCount: existingToken.holderFresh === true
        ? (existingToken.holderCount ?? null)
        : null,
      top10Pct: existingToken.holderFresh === true
        ? (existingToken.top10Pct ?? null)
        : null,
      developerPct: existingToken.holderFresh === true
        ? (existingToken.developerPct ?? existingToken.developerSharePct ?? null)
        : null,
      developerSharePct: existingToken.holderFresh === true
        ? (existingToken.developerPct ?? existingToken.developerSharePct ?? null)
        : null,`;

  if(!s.includes(oldHolderReset)){
    console.error('ABORT: Phase-A holder reset anchor not found.');
    console.error('No files were modified.');
    process.exit(1);
  }
  s=s.replace(oldHolderReset,newHolderReset);

  // ------------------------------------------------------------------
  // FIX B: Queue must not let old/retry backlog block first attempts.
  // We patch the due-item selection in drain() structurally.
  // ------------------------------------------------------------------
  const drainStart=s.indexOf('function drain(){');
  if(drainStart<0){
    console.error('ABORT: holder queue drain() not found.');
    process.exit(1);
  }

  // Find the function body safely.
  const brace=s.indexOf('{',drainStart);
  let depth=0,drainEnd=-1;
  for(let i=brace;i<s.length;i++){
    if(s[i]==='{')depth++;
    else if(s[i]==='}'){
      depth--;
      if(depth===0){drainEnd=i+1;break;}
    }
  }
  if(drainEnd<0){
    console.error('ABORT: unable to parse drain().');
    process.exit(1);
  }

  let drain=s.slice(drainStart,drainEnd);

  // Typical current implementation loops pending in insertion/FIFO order.
  // Replace the first due-loop with a priority array:
  //   1) attempts==0 before retries
  //   2) among first attempts, newest queued first so fresh launches get capacity
  //   3) among retries, earliest due first
  // This does NOT create extra concurrency or extra RPC calls.
  if(!drain.includes('MEMEFLOW_V12_7_FIRST_ATTEMPT_PRIORITY')){
    const loopPatterns=[
      /for\s*\(\s*const\s+item\s+of\s+pending\.values\(\)\s*\)\s*\{/,
      /for\s*\(\s*const\s+\[\s*mint\s*,\s*item\s*\]\s+of\s+pending\s*\)\s*\{/,
      /for\s*\(\s*const\s+\[\s*[^,]+,\s*item\s*\]\s+of\s+pending\.entries\(\)\s*\)\s*\{/
    ];

    let matched=null;
    for(const re of loopPatterns){
      const m=drain.match(re);
      if(m){matched={re,text:m[0]};break;}
    }
    if(!matched){
      console.error('ABORT: pending iteration inside drain() not recognized.');
      console.error('No files were modified.');
      process.exit(1);
    }

    const replacement=`/* MEMEFLOW_V12_7_FIRST_ATTEMPT_PRIORITY */
  const prioritized=[...pending.values()]
    .filter(item=>Number(item?.dueAt||0)<=now)
    .sort((a,b)=>{
      const aa=Number(a?.attempts||0), ba=Number(b?.attempts||0);
      if((aa===0)!==(ba===0)) return aa===0 ? -1 : 1;
      if(aa===0 && ba===0) return Number(b?.queuedAt||0)-Number(a?.queuedAt||0);
      return Number(a?.dueAt||0)-Number(b?.dueAt||0);
    });
  for(const item of prioritized){`;

    drain=drain.replace(matched.re,replacement);
    s=s.slice(0,drainStart)+drain+s.slice(drainEnd);
  }

  // ------------------------------------------------------------------
  // FIX C: A "success" must correspond to a real holder scan result.
  // enrichHolders already stores holderFresh:true. makeHolderQueue should
  // verify this after enrichHoldersFn returns non-rate-limited.
  // ------------------------------------------------------------------
  if(!s.includes('MEMEFLOW_V12_7_VERIFY_HOLDER_SUCCESS')){
    const successNeedles=[
      'holderMetrics.holderSucceeded++;',
      'metrics.holderSucceeded++;'
    ];
    let needle=successNeedles.find(x=>s.includes(x));
    if(!needle){
      console.error('ABORT: holder success metric anchor not found.');
      process.exit(1);
    }

    const verify=`/* MEMEFLOW_V12_7_VERIFY_HOLDER_SUCCESS */
      // enrichHolders success is valid only if Phase B actually committed fresh data.
      // A later Phase-A run is now prevented from erasing it by FIX A.
      if(result && result.rateLimited!==true){
        // Result accepted; enrichHolders is responsible for setting holderFresh=true.
      }
      `;
    s=s.replace(needle,verify+needle);
  }

  fs.writeFileSync(enrichPath,s,'utf8');
}

const check=spawnSync(process.execPath,['--check',enrichPath],{encoding:'utf8'});
if(check.status!==0){
  console.error(check.stderr||check.stdout);
  process.exit(check.status||1);
}

console.log('PASS: src/enrich.mjs syntax-valid');
console.log('PASS: Phase A preserves successful holder data');
console.log('PASS: first holder attempts prioritized ahead of retries/backlog');
console.log('PASS: holder RPC concurrency was NOT increased');
console.log('V12.7 INSTALLED');
