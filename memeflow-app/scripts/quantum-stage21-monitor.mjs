#!/usr/bin/env node
// Stage 21 opt-in local stream monitor. No network, wallet, server, or trading access.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {evaluate,normalize} from './quantum-stage20-shadow.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const base=path.join(root,'quantum-stage21');
const horizons=[5,15,30,60];
const allowed=new Set(['BUY_READY','WAITING','BLOCKED']);
const load=(f)=>fs.existsSync(f)?fs.readFileSync(f,'utf8').split(/\r?\n/).filter(Boolean).map(x=>JSON.parse(x)):[];
const append=(f,row)=>{fs.mkdirSync(path.dirname(f),{recursive:true});fs.appendFileSync(f,JSON.stringify(row)+'\n')};
export function validateEvent(event){
 if(!event||!['prediction','price'].includes(event.type))throw Error('type must be prediction or price');
 normalize(event);
 if(event.type==='prediction'&&!allowed.has(event.decision))throw Error('invalid decision');
 if(event.type==='prediction'&&event.quantumDecision!==undefined&&!allowed.has(event.quantumDecision))throw Error('invalid quantumDecision');
 return event;
}
export function ingest(events,{directory=base}={}){
 const ledger=path.join(directory,'events.jsonl');const seen=new Set(load(ledger).map(e=>`${e.type}|${e.mint}|${e.timestamp}|${e.type==='prediction'?e.decision:e.price}`));
 let added=0,duplicates=0;
 for(const raw of events){const e=validateEvent(raw);const key=`${e.type}|${e.mint}|${e.timestamp}|${e.type==='prediction'?e.decision:e.price}`;if(seen.has(key)){duplicates++;continue}
 const row={type:e.type,mint:e.mint,timestamp:e.timestamp,price:e.price,...(e.type==='prediction'?{decision:e.decision,quantumDecision:e.quantumDecision??null,quantumScore:Number.isFinite(e.quantumScore)?e.quantumScore:null,quantumRisk:Number.isFinite(e.quantumRisk)?e.quantumRisk:null,quantumPattern:e.quantumPattern??null}:{})};
 append(ledger,row);seen.add(key);added++;
 }return {added,duplicates};
}
export function report(events,{feePct=0}={}){
 if(!Number.isFinite(feePct)||feePct<0||feePct>100)throw Error('feePct must be 0..100');
 const predictions=events.filter(e=>e.type==='prediction');const prices=events.filter(e=>e.type==='price');
 const results=horizons.map(min=>{
  const r=evaluate(predictions,prices,min*60000);
  const baseline=r.rows.filter(x=>x.status==='MATURED'&&x.decision==='BUY_READY');
  const quantum=r.rows.filter(x=>x.status==='MATURED'&&predictions.some(p=>p.mint===x.mint&&p.timestamp===x.timestamp&&p.quantumDecision==='BUY_READY'));
  const metric=arr=>({count:arr.length,meanGrossPct:arr.length?Number((arr.reduce((s,x)=>s+x.returnPct,0)/arr.length).toFixed(4)):null,meanNetPct:arr.length?Number((arr.reduce((s,x)=>s+x.returnPct-feePct,0)/arr.length).toFixed(4)):null,netWinRate:arr.length?Number((arr.filter(x=>x.returnPct>feePct).length/arr.length).toFixed(4)):null});
  return {minutes:min,matured:r.matured,pending:r.pending,baseline:metric(baseline),quantum:metric(quantum),comparisonCaution:'Selection differs; descriptive only, not causal proof'};
 });
 return {mode:'OFFLINE_READ_ONLY',liveConnected:false,feePctRoundTrip:feePct,predictions:predictions.length,priceObservations:prices.length,horizons:results};
}
function main(){const [command,arg]=process.argv.slice(2);if(command==='ingest'){
 if(!arg)throw Error('Usage: ingest <events.jsonl>');console.log(JSON.stringify(ingest(load(path.resolve(arg))),null,2));
 }else if(command==='report'){
 const fee=Number(arg??'0');const r=report(load(path.join(base,'events.jsonl')),{feePct:fee});fs.mkdirSync(base,{recursive:true});fs.writeFileSync(path.join(base,'report.json'),JSON.stringify(r,null,2));console.log(JSON.stringify(r,null,2));
 }else if(command==='watch'){
 if(!arg)throw Error('Usage: watch <events.jsonl> (file is produced by external trusted live adapter)');const file=path.resolve(arg);let offset=0;let partial='';console.log('Stage 21 watching local JSONL only. Ctrl+C to stop. No RPC or trades.');
 const poll=()=>{if(!fs.existsSync(file))return;const stat=fs.statSync(file);if(stat.size<offset){offset=0;partial=''}if(stat.size===offset)return;const fd=fs.openSync(file,'r');try{const buf=Buffer.alloc(Math.min(stat.size-offset,2*1024*1024));const n=fs.readSync(fd,buf,0,buf.length,offset);offset+=n;const lines=(partial+buf.toString('utf8',0,n)).split('\n');partial=lines.pop();const rows=lines.filter(Boolean).map(x=>JSON.parse(x));if(rows.length){const x=ingest(rows);console.log(JSON.stringify({at:new Date().toISOString(),...x}))}}finally{fs.closeSync(fd)}};
 poll();setInterval(()=>{try{poll()}catch(e){console.error('Input rejected:',e.message)}},2000);
 }else throw Error('Usage: ingest <events.jsonl> | watch <events.jsonl> | report [roundTripFeePct]');}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){try{main()}catch(e){console.error(e.message);process.exitCode=1}}
