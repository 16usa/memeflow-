#!/usr/bin/env node
// Read-only adapter for the existing Memflow persisted state. No server edits, RPC, or trading.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {ingest,report} from './quantum-stage21-monitor.mjs';
const appRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const base=path.resolve(appRoot,process.env.DATA_DIR||'data');
const output=path.resolve(appRoot,'quantum-stage21');
const states=new Set(['BUY_READY','WAITING','BLOCKED']);
const mintOK=s=>typeof s==='string'&&/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(s);
const number=v=>v===null||v===undefined||v===''?null:Number.isFinite(Number(v))?Number(v):null;
const label=v=>String(v||'').trim().toUpperCase().replace(/[ -]/g,'_');
export function snapshotEvents(state,{timestamp=Date.now()}={}){
 if(!state||typeof state!=='object')throw Error('invalid state');
 const tokens=Object.values(state.tokens||{});
 const prices=[];
 const byMint=new Map();
 for(const t of tokens){const mint=String(t?.mint||'');const price=number(t?.priceSol);if(!mintOK(mint)||price===null||price<=0)continue;byMint.set(mint,price);prices.push({type:'price',mint,timestamp,price})}
 const predictions=[];
 for(const d of Object.values(state.decisions||{})){
  const mint=String(d?.mint||'');const price=byMint.get(mint);const decision=label(d?.status??d?.state??d?.decision);
  if(!price||!states.has(decision))continue;
  // Quantum fields are only recorded when actually present in the persisted decision.
  const quantumDecision=label(d?.quantumDecision??d?.quantum?.decision);
  const qScore=number(d?.quantumScore??d?.quantum?.score);
  const qRisk=number(d?.quantumRisk??d?.quantum?.risk);
  predictions.push({type:'prediction',mint,timestamp,price,decision,
   ...(states.has(quantumDecision)?{quantumDecision}:{}),
   ...(qScore!==null?{quantumScore:qScore}:{}),
   ...(qRisk!==null?{quantumRisk:qRisk}:{}),
   ...(d?.quantumPattern!==undefined?{quantumPattern:d.quantumPattern}:{})});
 }
 return {prices,predictions};
}
export function sample({stateFile=path.join(base,'state.json'),directory=output,timestamp=Date.now()}={}){
 const raw=fs.readFileSync(stateFile,'utf8');const state=JSON.parse(raw);
 const {prices,predictions}=snapshotEvents(state,{timestamp});
 // Price snapshots are sampled every interval; predictions are emitted only on a new
 // (mint,decision,quantumDecision) transition, not on every price poll.
 fs.mkdirSync(directory,{recursive:true});const cacheFile=path.join(directory,'stage22-last-decisions.json');
 let prior={};try{prior=JSON.parse(fs.readFileSync(cacheFile,'utf8'))}catch{}
 const next={};const changed=[];
 for(const p of predictions){const key=p.mint;const signature=`${p.decision}|${p.quantumDecision??''}|${p.quantumScore??''}|${p.quantumRisk??''}|${JSON.stringify(p.quantumPattern??null)}`;next[key]=signature;if(prior[key]!==signature)changed.push(p)}
 const ingested=ingest([...prices,...changed],{directory});
 const tmp=cacheFile+'.tmp';fs.writeFileSync(tmp,JSON.stringify(next));fs.renameSync(tmp,cacheFile);
 return {timestamp,prices:prices.length,predictionsObserved:predictions.length,newPredictions:changed.length,...ingested,source:'LOCAL_MEMFLOW_STATE',trading:false,quantumAuthorityVerified:false};
}
function main(){const [command,...args]=process.argv.slice(2);if(command==='once'){console.log(JSON.stringify(sample({stateFile:args[0]?path.resolve(args[0]):undefined}),null,2));return}
 if(command==='report'){const f=path.join(output,'events.jsonl');const events=fs.existsSync(f)?fs.readFileSync(f,'utf8').split('\n').filter(Boolean).map(JSON.parse):[];console.log(JSON.stringify(report(events,{feePct:Number(args[0]||0)}),null,2));return}
 if(command==='watch'){const seconds=Number(args[0]||30);if(!Number.isInteger(seconds)||seconds<10)throw Error('poll interval must be >=10 seconds');console.log('Stage22 read-only local state monitor; Ctrl+C to stop. No RPC/trading.');const poll=()=>{try{console.log(JSON.stringify(sample()))}catch(e){console.error('Sample failed:',e.message)}};poll();setInterval(poll,seconds*1000);return}
 throw Error('Usage: once [state.json] | watch [seconds>=10] | report [feePct]');}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){try{main()}catch(e){console.error(e.message);process.exitCode=1}}
