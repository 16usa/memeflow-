#!/usr/bin/env node
// Stage34: observational SHADOW report. No trading, no database writes.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const app=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const data=path.join(app,'data');
const finite=x=>x!==null&&x!==undefined&&x!==''&&Number.isFinite(Number(x))?Number(x):null;
const H=[5,15,30,60];
export function readNdjson(files){let invalid=0,rows=[];for(const file of files){if(!fs.existsSync(file))continue;for(const line of fs.readFileSync(file,'utf8').split('\n')){if(!line.trim())continue;try{rows.push(JSON.parse(line))}catch{invalid++}}}return {rows,invalid};}
export function analyze(events, snapshots, now=Date.now()){
 const prices=new Map();let rejected=0;const unique=new Set();let duplicates=0;
 function add(mint,at,price,source){if(typeof mint!=='string'||!mint||!(finite(at)>0)||!(finite(price)>0)||at>now+60000){rejected++;return}const key=mint+'|'+at;if(unique.has(key)){duplicates++;return}unique.add(key);const a=prices.get(mint)||[];a.push({at,price,source});prices.set(mint,a)}
 for(const s of snapshots)add(s.mint,finite(s.priceAt),finite(s.priceSol),s.source==='STAGE33_SQLITE_REGISTRY'?'stage33':'stage26');
 // A capture event only proves a price at its original source timestamp; never use capture wall time.
 for(const e of events){if(!(finite(e.at)>0)||!(finite(e.priceAt)>0)||e.priceAt>e.at+1000)continue;add(e.mint,finite(e.priceAt),finite(e.priceSol),'journal')}
 for(const a of prices.values())a.sort((x,y)=>x.at-y.at);
 const first=new Map();for(const e of events){if(!e.stage29ShadowDecision||!['CANDIDATE','WATCH','WAITING','BLOCKED'].includes(e.stage29ShadowDecision.state)||!(finite(e.at)>0)||!(finite(e.priceSol)>0)||!e.mint)continue;const key=e.mint+'|'+e.stage29ShadowDecision.state;if(!first.has(key)||e.at<first.get(key).at)first.set(key,e)}
 const decisions=[...first.values()];const rows=[];
 for(const e of decisions){const p=prices.get(e.mint)||[];for(const h of H){const target=e.at+h*60000;const end=target+120000;const price=p.find(s=>s.at>=target&&s.at<=end&&s.at>e.at);const status=price?'MATURED':now<target?'PENDING':now<=end?'WINDOW_OPEN':'MISSING_FOLLOWUP';rows.push({mint:e.mint,at:e.at,horizonMin:h,quantumState:e.stage29ShadowDecision.state,memflowState:e.state,source:price?.source??null,followupAt:price?.at??null,status,returnPct:price?100*(price.price/e.priceSol-1):null})}}
 function stats(a){const m=a.filter(r=>r.status==='MATURED');const n=m.length;return {cohort:a.length,matured:n,pending:a.filter(r=>r.status==='PENDING').length,windowOpen:a.filter(r=>r.status==='WINDOW_OPEN').length,missingFollowup:a.filter(r=>r.status==='MISSING_FOLLOWUP').length,coveragePct:a.length?+(100*n/a.length).toFixed(2):null,meanReturnPct:n?+(m.reduce((s,r)=>s+r.returnPct,0)/n).toFixed(3):null,positiveRatePct:n?+(100*m.filter(r=>r.returnPct>0).length/n).toFixed(2):null}}
 const groups={};for(const h of H){const hr=rows.filter(r=>r.horizonMin===h);groups[h]={all:stats(hr),byQuantum:Object.fromEntries(['CANDIDATE','WATCH','WAITING','BLOCKED'].map(q=>[q,stats(hr.filter(r=>r.quantumState===q))])),memflowBuyReady:stats(hr.filter(r=>r.memflowState==='BUY READY')),pairedBuyReadyCandidate:stats(hr.filter(r=>r.memflowState==='BUY READY'&&r.quantumState==='CANDIDATE')),pairedBuyReadyNotCandidate:stats(hr.filter(r=>r.memflowState==='BUY READY'&&r.quantumState!=='CANDIDATE'))}}
 return {mode:'SHADOW_READ_ONLY',tradeAuthority:false,verifiedAccuracy:false,method:'First decision per mint and Quantum state; exact-mint source-timestamp price from Stage26, Stage33 OR decision journal within horizon to +2m; observational only, biased coverage and no fees/slippage; same decision baseline for Memflow comparison.',decisions:decisions.length,priceObservations:[...prices.values()].reduce((n,a)=>n+a.length,0),rejectedPriceObservations:rejected,duplicatePriceObservations:duplicates,groups,rows};
}
function main(){const archive=path.join(data,'quantum-archive');const archives=fs.existsSync(archive)?fs.readdirSync(archive).filter(n=>n==='stage24-before-stage28.ndjson'||/^stage24-rotated-.*\.ndjson$/.test(n)).map(n=>path.join(archive,n)):[];const journal=path.join(data,'quantum-stage24-decisions.ndjson');const j=readNdjson([...archives,journal]);const p=readNdjson([path.join(data,'quantum-stage26/price-snapshots.ndjson'),path.join(data,'quantum-stage33/price-snapshots.ndjson')]);const result=analyze(j.rows,p.rows);const {rows,...summary}=result;summary.source={journals:archives.length+1,journalRows:j.rows.length,stage26And33Rows:p.rows.length,invalidJournalLines:j.invalid,invalidPriceLines:p.invalid};console.log(JSON.stringify(summary,null,2));if(process.argv.includes('--save')){const dir=path.join(data,'quantum-stage34');fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,'report.json'),JSON.stringify(summary,null,2));fs.writeFileSync(path.join(dir,'rows.json'),JSON.stringify(rows));console.error('Saved to '+dir)}}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))main();
