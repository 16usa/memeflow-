#!/usr/bin/env node
// Read-only SHADOW retrospective. Not a backtest, prediction, or trade authorization.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const data=path.join(root,'data');
const journal=path.join(data,'quantum-stage24-decisions.ndjson');
const archive=path.join(data,'quantum-archive');
const snaps=path.join(data,'quantum-stage26/price-snapshots.ndjson');
const horizons=[5,15,30,60];
const finite=x=>x!==null&&x!==undefined&&x!==''&&Number.isFinite(Number(x))?Number(x):null;
export function readLines(files){const out=[];let bad=0;for(const f of files){if(!fs.existsSync(f))continue;const lines=fs.readFileSync(f,'utf8').split('\n');for(const line of lines){if(!line.trim())continue;try{out.push(JSON.parse(line))}catch{bad++}}}return {rows:out,bad}}
export function cohort(events){const unique=new Map();for(const e of events){if(e.version!==25||!e.mint||!(finite(e.at)>0)||!(finite(e.priceSol)>0))continue;const state=e.stage29ShadowDecision?.state;if(!['CANDIDATE','WATCH','WAITING','BLOCKED'].includes(state))continue;const key=e.mint+'|'+state;const old=unique.get(key);if(!old||e.at<old.at)unique.set(key,e)}return [...unique.values()].sort((a,b)=>a.at-b.at)}
export function analyze(events,snapshots,now=Date.now()){
 const decisions=cohort(events);const priceByMint=new Map();
 for(const s of snapshots){if(!s.mint||!(finite(s.priceAt)>0)||!(finite(s.priceSol)>0))continue;const arr=priceByMint.get(s.mint)||[];arr.push(s);priceByMint.set(s.mint,arr)}
 for(const a of priceByMint.values())a.sort((x,y)=>x.priceAt-y.priceAt);
 const rows=[];for(const e of decisions){const state=e.stage29ShadowDecision.state;for(const minutes of horizons){const target=e.at+minutes*60000;const p=(priceByMint.get(e.mint)||[]).find(s=>s.priceAt>=target&&s.priceAt<=target+120000&&s.priceAt>e.at);const status=p?'MATURED':now<target?'PENDING':'MISSING_FOLLOWUP';rows.push({mint:e.mint,decisionAt:e.at,quantumState:state,memflowState:e.state,minutes,status,returnPct:p?100*(p.priceSol/e.priceSol-1):null,priceAt:p?.priceAt??null})}}
 const summarize=a=>{const m=a.filter(x=>x.status==='MATURED');const n=m.length;return {cohort:a.length,matured:n,pending:a.filter(x=>x.status==='PENDING').length,missingFollowup:a.filter(x=>x.status==='MISSING_FOLLOWUP').length,coveragePct:a.length?Number((100*n/a.length).toFixed(2)):null,meanReturnPct:n?Number((m.reduce((s,x)=>s+x.returnPct,0)/n).toFixed(3)):null,positiveRatePct:n?Number((100*m.filter(x=>x.returnPct>0).length/n).toFixed(2)):null}};
 const groups={};for(const h of horizons){const hr=rows.filter(x=>x.minutes===h);groups[h]={all:summarize(hr),byQuantum:Object.fromEntries(['CANDIDATE','WATCH','WAITING','BLOCKED'].map(s=>[s,summarize(hr.filter(x=>x.quantumState===s))])),memflowBuyReady:summarize(hr.filter(x=>x.memflowState==='BUY READY')),memflowBuyReadyNotCandidate:summarize(hr.filter(x=>x.memflowState==='BUY READY'&&x.quantumState!=='CANDIDATE'))}}
 return {mode:'SHADOW_READ_ONLY',verifiedAccuracy:false,tradeAuthority:false,method:'Earliest Stage29 decision per mint and Quantum state; Stage26 exact-mint price snapshots at horizon to +2min; missing prices excluded from returns, never treated as zero. Historical comparisons are selection-biased.',decisions:decisions.length,priceSnapshots:snapshots.length,groups,rows};
}
function main(){const archives=fs.existsSync(archive)?fs.readdirSync(archive).filter(n=>n.endsWith('.ndjson')&&(n.startsWith('stage24-rotated-')||n==='stage24-before-stage28.ndjson')).map(n=>path.join(archive,n)):[];const jr=readLines([...archives,journal]);const sr=readLines([snaps]);const result=analyze(jr.rows,sr.rows);const {rows,...summary}=result;console.log(JSON.stringify({...summary,source:{journals:archives.length+1,journalRows:jr.rows.length,invalidJournalLines:jr.bad,invalidPriceLines:sr.bad}},null,2));if(process.argv.includes('--save')){const out=path.join(data,'quantum-stage30');fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({...summary,source:{journals:archives.length+1,journalRows:jr.rows.length,invalidJournalLines:jr.bad,invalidPriceLines:sr.bad}},null,2));fs.writeFileSync(path.join(out,'rows.json'),JSON.stringify(rows,null,2));console.error('Saved to '+out)}}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))main();
