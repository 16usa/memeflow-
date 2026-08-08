#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

const ROOT=process.cwd();
const APP=path.join(ROOT,'memeflow-app','app-server.mjs');
const MARK='MEMEFLOW_V12_25_GATE_SAMPLE_DIAGNOSTICS';

function fail(x){console.error('ABORT:',x);process.exit(1)}
if(!fs.existsSync(APP)) fail('Run from ~/workspace.');
let s=fs.readFileSync(APP,'utf8');

if(!s.includes('MEMEFLOW_V12_24_CREATOR_GATE_RECOVERY')) fail('V12.24 not detected.');
if(s.includes(MARK)){console.log('PASS: V12.25 already installed');process.exit(0)}

const stamp=new Date().toISOString().replace(/[:.]/g,'-');
const backup=APP+'.before-v12-25-'+stamp;
fs.copyFileSync(APP,backup);

// ---- generic diagnostic augmenter ----
// This does not change trading logic. It only enriches diagnostics payloads.
const helper = `
// ${MARK}
function __v1225GateValue(v){
  return Number.isFinite(Number(v)) ? Number(v) : null;
}
function __v1225GateCheck(value,limit,kind){
  const v=__v1225GateValue(value), l=__v1225GateValue(limit);
  if(l===null)return {state:'N/A',value:v,limit:null};
  if(v===null)return {state:'WAITING',value:null,limit:l};
  const pass=kind==='min' ? v>=l : v<=l;
  return {state:pass?'PASS':'FAIL',value:v,limit:l};
}
function __v1225GateFromSampleRow(row,settings){
  const holder=row?.holder||{};
  const market=row?.market||{};
  const checks={
    holders:__v1225GateCheck(holder.count ?? row?.holderCount, settings?.minHolders,'min'),
    top10:__v1225GateCheck(holder.top10Pct ?? row?.top10Pct, settings?.maxTop10Pct,'max'),
    developer:__v1225GateCheck(holder.developerPct ?? row?.developerPct, settings?.maxDeveloperPct,'max'),
    buyPressure:__v1225GateCheck(market.buyPressure ?? row?.buyPressure, settings?.minBuyPressure,'min')
  };
  const failed=Object.entries(checks).filter(([,x])=>x.state==='FAIL').map(([k])=>k);
  const waiting=Object.entries(checks).filter(([,x])=>x.state==='WAITING').map(([k])=>k);
  return {
    state:failed.length?'BLOCKED':(waiting.length?'WAITING':'PASS'),
    failed,waiting,checks,
    decisionExpected:failed.length===0&&waiting.length===0
  };
}
function __v1225AugmentDiagnostic(body){
  try{
    if(!body || body.diagnosticVersion!=='V10.2-same-instance')return body;
    const settings=body.effectiveSettings||{};
    if(Array.isArray(body.sample)){
      body.sample=body.sample.map(row=>{
        if(!row||typeof row!=='object')return row;
        const gate=__v1225GateFromSampleRow(row,settings);
        const decisionReason=row.decision
          ? 'decision_present'
          : gate.state==='PASS'
            ? 'all_visible_gates_pass_but_no_decision'
            : gate.state==='WAITING'
              ? 'waiting_for_'+gate.waiting.join(',')
              : 'blocked_by_'+gate.failed.join(',');
        return {...row,gate,decisionReason};
      });
    }
    body.v12_25={
      version:'V12.25',
      sampleGateDiagnostics:true,
      tradingLogicChanged:false
    };
    return body;
  }catch{
    return body;
  }
}
globalThis.__MEMEFLOW_V12_25_AUGMENT_DIAGNOSTIC__=__v1225AugmentDiagnostic;
`;

// Insert helper before first regular function.
const firstFn=s.search(/\n(?:async\s+)?function\s+/);
s=firstFn>0?s.slice(0,firstFn)+helper+s.slice(firstFn):helper+s;

// ---- Hook diagnostics with the safest available strategy ----
// 1. Express-style middleware: wrap res.json globally but only mutate the V10.2 diagnostics object.
let hooked=false;
const expressDecls=[
  /const\s+([A-Za-z_$][\w$]*)\s*=\s*express\s*\(\s*\)\s*;/,
  /let\s+([A-Za-z_$][\w$]*)\s*=\s*express\s*\(\s*\)\s*;/
];
for(const re of expressDecls){
  const m=s.match(re);
  if(!m)continue;
  const appVar=m[1];
  const pos=m.index+m[0].length;
  const mid=`
${appVar}.use((req,res,next)=>{
  const __origJson=res.json.bind(res);
  res.json=(body)=>__origJson(__v1225AugmentDiagnostic(body));
  next();
}); // ${MARK}
`;
  s=s.slice(0,pos)+mid+s.slice(pos);
  hooked=true;
  break;
}

// 2. If no Express declaration was found, wrap an obvious diagnostic response
//    variable just before res.json(payload)/reply.send(payload).
if(!hooked){
  const candidates=[
    /res\.json\(\s*([A-Za-z_$][\w$]*)\s*\)\s*;/g,
    /reply\.send\(\s*([A-Za-z_$][\w$]*)\s*\)\s*;/g
  ];
  for(const re of candidates){
    let match;
    while((match=re.exec(s))){
      const varName=match[1];
      const prior=s.slice(Math.max(0,match.index-5000),match.index);
      if(!prior.includes("V10.2-same-instance"))continue;
      const original=match[0];
      const replacement=original.replace(varName,`__v1225AugmentDiagnostic(${varName})`);
      s=s.slice(0,match.index)+replacement+s.slice(match.index+original.length);
      hooked=true;
      break;
    }
    if(hooked)break;
  }
}

// 3. Last resort: expose a dedicated diagnostics endpoint is impossible without
//    knowing framework shape, so fail safely rather than silently patching nothing.
if(!hooked){
  fs.copyFileSync(backup,APP);
  fail('Could not safely locate diagnostics response hook. Backup restored. Send the installer output to ChatGPT.');
}

fs.writeFileSync(APP,s);

const check=spawnSync(process.execPath,['--check',APP],{encoding:'utf8'});
if(check.status!==0){
  fs.copyFileSync(backup,APP);
  console.error('ABORT: syntax check failed; backup restored.');
  console.error(check.stderr||check.stdout);
  process.exit(2);
}

console.log('PASS: V12.25 GATE SAMPLE DIAGNOSTICS installed');
console.log('Backup:',backup);
console.log('Trading logic changed: NO');
console.log('Diagnostics sample enrichment: ON');
console.log('Expected fields: gate, decisionReason, v12_25');
