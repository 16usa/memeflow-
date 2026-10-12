#!/usr/bin/env node
// Offline runtime test of the exact Stage 15 gate extracted from current app-server.
// No app import, HTTP listener, RPC, wallet, transactions or environment writes.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const file=path.join(root,'memeflow-app/app-server.mjs');
const source=fs.readFileSync(file,'utf8');
const marker='// MEMEFLOW_QUANTUM_STAGE15_EXECUTION_GATE';
const start=source.indexOf('function __mfQuantumExecutionBuyGate(');
const end=source.indexOf('\nconst opportunityEngine=',start);
if(source.indexOf(marker)<0||start<0||end<0)throw Error('Stage 15 gate not found; abort');
const fnSource=source.slice(start,end);
if(!fnSource.includes('QUANTUM_EXECUTION_BUY_BLOCKED'))throw Error('Gate source unexpected');
const results=[];
function test(name, mode, side, decision, tokenPresent=true, settingsPresent=true, expected='allow'){
  let vaultCalls=0;
  let evalCalls=0;
  const mint='11111111111111111111111111111111';
  const token={mint,priceSol:1};
  const sandbox={
    process:{env:{MEMEFLOW_QUANTUM_MODE:mode}},
    validPubkey:x=>x===mint,
    store:{state:{tokens:tokenPresent?{[mint]:token}:{}},settings:()=>settingsPresent?{minScore:70}:null},
    evaluate:(t,s,opts)=>{evalCalls++;if(opts.includePreOpenRisk!==true)throw Error('Missing final risk');if(decision==='throw')throw Error('simulated evaluation failure');return decision;},
    Error,
  };
  const gate=vm.runInNewContext(`${fnSource}\n__mfQuantumExecutionBuyGate`,sandbox,{timeout:1000});
  let actual='allow';
  try{gate({uid:'test-user',mint,side});vaultCalls++;}catch(e){actual=e.code==='QUANTUM_EXECUTION_BUY_BLOCKED'?'blocked':`error:${e.message}`;}
  const pass=actual===expected && vaultCalls===(expected==='allow'?1:0) && (mode==='SHADOW'||side==='SELL'?evalCalls===0:true);
  results.push({name,pass,actual,expected,vaultCalls,evalCalls});
}
const ready={scoreAuthority:'quantum-decision-engine',state:'BUY READY'};
const waiting={scoreAuthority:'quantum-decision-engine',state:'WAITING'};
const blocked={scoreAuthority:'quantum-decision-engine',state:'BLOCKED'};
const watch={scoreAuthority:'quantum-decision-engine',state:'WATCH'};
test('SHADOW BUY unchanged','SHADOW','BUY',waiting,true,true,'allow');
test('SHADOW SELL unchanged','SHADOW','SELL',waiting,true,true,'allow');
test('ENFORCE BLOCKED veto','ENFORCE','BUY',blocked,true,true,'blocked');
test('ENFORCE WAITING veto','ENFORCE','BUY',waiting,true,true,'blocked');
test('ENFORCE WATCH veto','ENFORCE','BUY',watch,true,true,'blocked');
test('ENFORCE BUY READY reaches existing execution gates','ENFORCE','BUY',ready,true,true,'allow');
test('ENFORCE missing token veto','ENFORCE','BUY',ready,false,true,'blocked');
test('ENFORCE missing settings veto','ENFORCE','BUY',ready,true,false,'blocked');
test('ENFORCE evaluation error veto','ENFORCE','BUY','throw',true,true,'blocked');
test('ENFORCE legacy authority veto','ENFORCE','BUY',{scoreAuthority:'evaluate',state:'BUY READY'},true,true,'blocked');
test('ENFORCE SELL not blocked','ENFORCE','SELL',blocked,true,true,'allow');
// Verify wrappers in app-server actually call the gate before both vault calls.
const callback=source.indexOf('executeTrade:async(args)=>{');
const callbackGate=source.indexOf('__mfQuantumExecutionBuyGate({uid:args?.uid,mint:args?.mint,side:args?.side});',callback);
const callbackExec=source.indexOf('return __mfSmartVaultD4.executeTrade(args);',callback);
const probeGate=source.indexOf('__mfQuantumExecutionBuyGate({uid:u.id,mint,side});');
const probeExec=source.indexOf('const result=await __mfSmartVaultD4.executeTrade({',probeGate);
const wrappers=callback>=0&&callbackGate>callback&&callbackExec>callbackGate&&callbackExec-callbackGate<250&&probeGate>=0&&probeExec>probeGate&&probeExec-probeGate<250;
results.push({name:'Both Stage 15 wrappers gate before vault call',pass:wrappers});
const report={stage:16,mode:'OFFLINE_EXTRACTED_RUNTIME',liveReady:false,liveTradeValidation:false,networkCalls:0,transactions:0,passed:results.filter(r=>r.pass).length,failed:results.filter(r=>!r.pass).length,results,limitations:['Tests extracted Stage 15 function with mocked store/evaluate, not complete server routing','BUY READY only passes this veto; other safety gates are not simulated','No evidence of mainnet readiness, freshness, RPC, wallet or real order execution']};
console.log(JSON.stringify(report,null,2));
if(report.failed)process.exitCode=1;
