#!/usr/bin/env node
// Stage 17: read-only, fail-closed audit of both execution entry points.
// No server import, RPC, listener, transaction, wallet, or environment mutation.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
const repo=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const app=fs.readFileSync(path.join(repo,'memeflow-app/app-server.mjs'),'utf8');
const checks=[];
const add=(name,pass,detail='')=>checks.push({name,pass:Boolean(pass),...(detail?{detail}:{})});
const gateName='__mfQuantumExecutionBuyGate';
const gateStart=app.indexOf('function '+gateName+'(');
const gateEnd=app.indexOf('\nconst opportunityEngine=',gateStart);
const gateSource=gateStart>=0&&gateEnd>gateStart?app.slice(gateStart,gateEnd):'';
add('Stage 15 gate exists and has expected exception code',gateSource.includes('QUANTUM_EXECUTION_BUY_BLOCKED'));
add('Gate is default SHADOW (no implicit ENFORCE)',gateSource.includes("MEMEFLOW_QUANTUM_MODE||'SHADOW'"));
add('Gate skips non-BUY sides before checking token',gateSource.includes("String(side||'').trim().toUpperCase()!=='BUY')return"));
add('Gate checks final pre-open wallet risk',gateSource.includes('includePreOpenRisk:true'));
add('Gate requires quantum authority and BUY READY',gateSource.includes("scoreAuthority!=='quantum-decision-engine'")&&gateSource.includes("state!=='BUY READY'"));
add('Gate checks user, token, settings, and handles evaluation error',/!id\|\|!validPubkey/.test(gateSource)&&gateSource.includes('store.state.tokens')&&gateSource.includes('store.settings(id)')&&gateSource.includes("catch {fail('quantum evaluation unavailable')"));
const callbackPattern=/executeTrade\s*:\s*async\s*\(args\)\s*=>\s*\{([\s\S]*?)\n\s*\}/g;
const callbacks=[...app.matchAll(callbackPattern)];
const callback=callbacks.find(m=>m[1].includes(gateName)&&m[1].includes('__mfSmartVaultD4.executeTrade'));
add('OpenAI callback is a guarded block',Boolean(callback));
if(callback){
 const body=callback[1];
 const g=body.indexOf(gateName+'('), e=body.indexOf('__mfSmartVaultD4.executeTrade(');
 add('OpenAI callback checks before executing',g>=0&&e>g);
 add('OpenAI callback passes uid/mint/side from same args',body.includes('uid:args?.uid,mint:args?.mint,side:args?.side'));
 // Execute the actual extracted callback expression, with a fake vault. No network.
 const expression='({executeTrade:async(args)=>{'+body+'\n}}).executeTrade';
 for(const [name,args,blocked] of [
  ['callback: veto blocks BUY',{uid:'u',mint:'m',side:'BUY'},true],
  ['callback: SELL bypasses BUY veto',{uid:'u',mint:'m',side:'SELL'},false],
 ]){
  let calls=0,gateCalls=0;
  const context={__mfQuantumExecutionBuyGate:({side})=>{gateCalls++;if(side==='BUY')throw Object.assign(new Error('veto'),{code:'QUANTUM_EXECUTION_BUY_BLOCKED'});},__mfSmartVaultD4:{executeTrade:async()=>{calls++;return {ok:true};}}};
  try{
   const fn=vm.runInNewContext(expression,context,{timeout:1000});
   try{await fn(args);add(name,!blocked&&calls===1&&gateCalls===1)}catch(e){add(name,blocked&&e.code==='QUANTUM_EXECUTION_BUY_BLOCKED'&&calls===0&&gateCalls===1)}
  }catch(e){add(name,false,'Could not execute extracted callback: '+e.message)}
 }
}
const probeCalls=[...app.matchAll(/__mfSmartVaultD4\.executeTrade\s*\(\s*\{/g)];
add('D5 direct SmartVault probe found exactly once',probeCalls.length===1,`found ${probeCalls.length}`);
if(probeCalls.length===1){
 const pos=probeCalls[0].index;
 const preceding=app.slice(Math.max(0,pos-300),pos);
 add('D5 probe gate immediately precedes SmartVault execution',/__mfQuantumExecutionBuyGate\(\{uid:u\.id,mint,side\}\);\s*const result=await\s*$/.test(preceding));
 const after=app.slice(pos,pos+220);
 add('D5 probe passes same uid/mint/side to vault',/uid:u\.id,\s*mint,\s*side,/.test(after));
}
add('D5 rejection has explicit non-500 response',app.includes("e?.code==='QUANTUM_EXECUTION_BUY_BLOCKED'?423:500"));
const report={stage:17,mode:'READ_ONLY_SOURCE_AND_ISOLATED_CALLBACK',liveReady:false,liveTradingValidated:false,networkCalls:0,transactions:0,passed:checks.filter(c=>c.pass).length,failed:checks.filter(c=>!c.pass).length,checks,limitations:['Source and isolated callback checks cannot prove actual HTTP routing, authentication, RPC freshness, or vault execution','No production settings or wallets were accessed','Failing a check means inspect source; never automatically enable ENFORCE']};
console.log(JSON.stringify(report,null,2));
if(report.failed)process.exitCode=1;
