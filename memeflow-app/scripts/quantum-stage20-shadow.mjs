#!/usr/bin/env node
// Offline-only Stage 20: append predictions, evaluate outcomes from independent snapshots.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const out=path.join(root,'quantum-stage20');
const finite=x=>typeof x==='number'&&Number.isFinite(x);
const read=p=>fs.existsSync(p)?fs.readFileSync(p,'utf8').split(/\r?\n/).filter(Boolean).map((s,i)=>{try{return JSON.parse(s)}catch{throw Error(`Invalid JSONL line ${i+1}`)}}):[];
const fail=s=>{console.error(s);process.exitCode=1};
export function normalize(r){
 if(!r||typeof r!=='object'||typeof r.mint!=='string'||!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(r.mint)||!finite(r.timestamp)||r.timestamp<=0||!finite(r.price)||r.price<=0)throw Error('mint/timestamp/positive price required');
 return r;
}
export function evaluate(predictions,prices,horizonMs){
 const byMint=new Map();for(const r of prices){normalize(r);const a=byMint.get(r.mint)||[];a.push(r);byMint.set(r.mint,a)}
 for(const a of byMint.values())a.sort((x,y)=>x.timestamp-y.timestamp);
 const rows=[];for(const p of predictions){normalize(p);if(!['BUY_READY','WAITING','BLOCKED'].includes(p.decision))throw Error('Invalid decision');
 const a=byMint.get(p.mint)||[];const target=p.timestamp+horizonMs;
 // Strictly forward observation: never use a snapshot before target or the prediction itself.
 const end=a.find(x=>x.timestamp>=target&&x.timestamp<=target+Math.min(horizonMs/2,300000));
 if(!end){rows.push({mint:p.mint,timestamp:p.timestamp,decision:p.decision,status:'PENDING'});continue}
 const returnPct=(end.price/p.price-1)*100;
 rows.push({mint:p.mint,timestamp:p.timestamp,decision:p.decision,status:'MATURED',returnPct:Number(returnPct.toFixed(4)),endTimestamp:end.timestamp});
 }
 const mature=rows.filter(x=>x.status==='MATURED');const buy=mature.filter(x=>x.decision==='BUY_READY');
 const mean=a=>a.length?a.reduce((s,x)=>s+x.returnPct,0)/a.length:null;
 return {mode:'SHADOW_ONLY',liveReady:false,horizonMs,observations:rows.length,matured:mature.length,pending:rows.length-mature.length,buyReadyCount:buy.length,buyReadyWinRate:buy.length?buy.filter(x=>x.returnPct>0).length/buy.length:null,buyReadyMeanReturnPct:mean(buy),allMeanReturnPct:mean(mature),rows};
}
function main(){const [command,arg]=process.argv.slice(2);if(command==='record'){
 if(!arg)throw Error('Usage: record <snapshot.jsonl>');const snapshots=read(path.resolve(arg)).map(normalize);
 fs.mkdirSync(out,{recursive:true});const dest=path.join(out,'predictions.jsonl');const keys=new Set(read(dest).map(r=>`${r.mint}:${r.timestamp}`));let count=0;
 for(const s of snapshots){if(!['BUY_READY','WAITING','BLOCKED'].includes(s.decision))throw Error('decision required');if(keys.has(`${s.mint}:${s.timestamp}`))continue;
 const row={mint:s.mint,timestamp:s.timestamp,price:s.price,decision:s.decision,quantumScore:finite(s.quantumScore)?s.quantumScore:null,quantumRisk:finite(s.quantumRisk)?s.quantumRisk:null,quantumPattern:s.quantumPattern??null};fs.appendFileSync(dest,JSON.stringify(row)+'\n');keys.add(`${s.mint}:${s.timestamp}`);count++}
 console.log(`Recorded ${count} shadow predictions. No trading or RPC.`);
 }else if(command==='evaluate'){
 if(!arg)throw Error('Usage: evaluate <future-prices.jsonl> [horizon-minutes]');const mins=Number(process.argv[4]??'5');if(!Number.isInteger(mins)||mins<1||mins>1440)throw Error('Horizon must be 1..1440 minutes');
 const report=evaluate(read(path.join(out,'predictions.jsonl')),read(path.resolve(arg)),mins*60000);fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({...report,rows:undefined},null,2));
 }else fail('Usage: node memeflow-app/scripts/quantum-stage20-shadow.mjs record <snapshots.jsonl> | evaluate <future-prices.jsonl> [minutes]');}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){try{main()}catch(e){fail(e.message)}}
