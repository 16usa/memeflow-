#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

const ROOT=process.cwd();
const APP=path.join(ROOT,'memeflow-app','app-server.mjs');
const MARK='MEMEFLOW_V12_23_FRESH_WARMING_GATE_DIAGNOSTICS';

function fail(x){ console.error('ABORT:',x); process.exit(1); }
if(!fs.existsSync(APP)) fail('Run from ~/workspace. memeflow-app/app-server.mjs not found.');

let s=fs.readFileSync(APP,'utf8');
if(!s.includes('MEMEFLOW_V12_22_WS_DIRECT_TRADE_EVENT') && !s.includes("VERSION='V12.22'") && !s.includes('wsDirectCompatible')){
  fail('V12.22 WS-direct pipeline not detected. Refusing to patch an unknown version.');
}
if(s.includes(MARK)){
  console.log('PASS: V12.23 already installed');
  process.exit(0);
}

const stamp=new Date().toISOString().replace(/[:.]/g,'-');
const backup=APP+'.before-v12-23-'+stamp;
fs.copyFileSync(APP,backup);

// ---------- helper functions ----------
const helpers = `
// ${MARK}
const __V12_23_FRESH_EVENT_ONLY_MS=Math.max(30000,Number(process.env.FRESH_PUMP_EVENT_ONLY_MS||180000));

function __v1223Token(mint){
  try{
    return store?.getToken?.(mint) ||
      store?.state?.tokens?.[mint] ||
      (Array.isArray(store?.state?.tokens) ? store.state.tokens.find(x=>x?.mint===mint) : null) ||
      null;
  }catch{return null}
}
function __v1223Ts(t){
  for(const k of ['createdAt','discoveredAt','firstSeenAt','seenAt','created_at','discovered_at']){
    const v=t?.[k];
    if(v==null)continue;
    const n=typeof v==='number'?v:Date.parse(v);
    if(Number.isFinite(n)&&n>0)return n<1e12?n*1000:n;
  }
  return null;
}
function __v1223IsPump(t){
  return !!t && (
    String(t.launchPlatform||'').toLowerCase()==='pump' ||
    String(t.protocol||'').toLowerCase()==='pump' ||
    String(t.source||'').toLowerCase().includes('pump')
  );
}
function __v1223FreshPump(mint){
  const t=__v1223Token(mint);
  if(!__v1223IsPump(t))return false;
  const ts=__v1223Ts(t);
  if(ts==null){
    // Pump CREATE tokens without a usable timestamp are treated as fresh only
    // while the fast-phase flag/lane says they are still in the fresh path.
    return t?.fastPhaseReady===true || t?.schedulerLane==='fresh-priority' || String(t?.source||'').toLowerCase().includes('pump create');
  }
  return (Date.now()-ts)<=__V12_23_FRESH_EVENT_ONLY_MS;
}
function __v1223Gate(t,settings){
  const h=Number(t?.holderCount ?? t?.holders ?? t?.holder?.count);
  const top=Number(t?.top10Pct ?? t?.holder?.top10Pct);
  const dev=Number(t?.developerPct ?? t?.developerSharePct ?? t?.holder?.developerPct);
  const bp=Number(t?.buyPressure ?? t?.market?.buyPressure);

  const minH=Number(settings?.minHolders);
  const maxT=Number(settings?.maxTop10Pct);
  const maxD=Number(settings?.maxDeveloperPct);
  const minB=Number(settings?.minBuyPressure);

  const check=(value,limit,op)=>{
    if(!Number.isFinite(limit))return {state:'N/A',value:Number.isFinite(value)?value:null,limit:null};
    if(!Number.isFinite(value))return {state:'WAITING',value:null,limit};
    const pass=op==='min'?value>=limit:value<=limit;
    return {state:pass?'PASS':'FAIL',value,limit};
  };

  const holders=check(h,minH,'min');
  const top10=check(top,maxT,'max');
  const developer=check(dev,maxD,'max');
  const buyPressure=check(bp,minB,'min');

  const checks={holders,top10,developer,buyPressure};
  const failed=Object.entries(checks).filter(([,v])=>v.state==='FAIL').map(([k])=>k);
  const waiting=Object.entries(checks).filter(([,v])=>v.state==='WAITING').map(([k])=>k);
  return {
    state: failed.length?'BLOCKED':(waiting.length?'WAITING':'PASS'),
    failed,
    waiting,
    checks
  };
}
`;

const firstFunction = s.search(/\n(?:async\s+)?function\s+/);
if(firstFunction>0){
  s=s.slice(0,firstFunction)+helpers+s.slice(firstFunction);
}else{
  s=helpers+s;
}

// ---------- fresh Pump holder RPC bypass ----------
const fnNeedle='function holderAdmissionForActiveUsers(mint){';
const fnAt=s.indexOf(fnNeedle);
if(fnAt<0){
  fs.copyFileSync(backup,APP);
  fail('holderAdmissionForActiveUsers(mint) not found; backup restored.');
}
const braceAt=s.indexOf('{',fnAt);

const freshGuard = `
  // ${MARK}: WS-direct V12.22 is authoritative for the fresh Pump hot path.
  // Never send a fresh Pump token to legacy getProgramAccounts holder RPC.
  try{
    if(__v1223FreshPump(mint)){
      const __eventHolder=eventHolderLedger?.inspect?.(mint)||null;
      if(__eventHolder){
        const __u=eventHolderLedger?.applyToStore?.(store,mint);
        if(__u){
          try{Promise.resolve(evaluateAI(__u)).catch(()=>{})}catch{}
          try{publish(mint)}catch{}
        }
        return {allow:false,drop:true,reason:'fresh_pump_event_holder_ready',source:'ws-direct'};
      }
      return {allow:false,drop:true,reason:'fresh_pump_holder_warming',source:'ws-direct'};
    }
  }catch(__e){}
`;
s=s.slice(0,braceAt+1)+freshGuard+s.slice(braceAt+1);

// ---------- diagnostics ----------
const diagNeedle="diagnosticVersion:'V10.2-same-instance',";
if(s.includes(diagNeedle)){
  s=s.replace(diagNeedle, diagNeedle+`
      v12_23:{
        version:'V12.23',
        freshEventOnlyMs:__V12_23_FRESH_EVENT_ONLY_MS,
        legacyHolderRpcForFreshPump:false
      },`);
}

// Add gate diagnostics to sample entries by augmenting decision:null / decision field
// where token object is in scope. This is intentionally best-effort: if the exact
// sample renderer differs, top-level diagnostics still remain valid.
const gatePatterns=[
  /(decision:\s*token\?\.decision\s*\|\|\s*null)/g,
  /(decision:\s*t\?\.decision\s*\|\|\s*null)/g,
  /(decision:\s*row\?\.decision\s*\|\|\s*null)/g
];
for(const re of gatePatterns){
  s=s.replace(re, m=>{
    const varName=m.startsWith('decision:token')?'token':m.startsWith('decision:t')?'t':'row';
    return `${m}, gate:__v1223Gate(${varName},effectiveSettings)`;
  });
}

// Common direct "decision:null" inside a token map is unsafe to patch blindly.
// Instead expose a helper function globally for any later diagnostic renderer.
s += `
// ${MARK}: diagnostic helper available for token-level inspection.
globalThis.__MEMEFLOW_V12_23_GATE__=(token,settings)=>__v1223Gate(token,settings);
`;

fs.writeFileSync(APP,s);

const check=spawnSync(process.execPath,['--check',APP],{encoding:'utf8'});
if(check.status!==0){
  fs.copyFileSync(backup,APP);
  console.error('ABORT: syntax check failed; backup restored.');
  console.error(check.stderr||check.stdout);
  process.exit(2);
}

console.log('PASS: V12.23 FRESH WARMING + GATE DIAGNOSTICS installed');
console.log('Backup:',backup);
console.log('Fresh Pump legacy holder RPC: DISABLED for first',__V12_23_FRESH_EVENT_ONLY_MS,'ms');
console.log('V12.22 WS-direct feed untouched.');
