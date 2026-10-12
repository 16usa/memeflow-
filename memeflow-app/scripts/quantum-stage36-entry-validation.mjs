#!/usr/bin/env node
// Stage36: read-only pre-entry price-path audit; no trade authority, no threshold tuning.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {readNdjson} from './quantum-stage34-report.mjs';
import {audit} from './quantum-stage35-candidate-audit.mjs';
const app=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const data=path.join(app,'data');
const N=x=>x!==null&&x!==undefined&&x!==''&&Number.isFinite(Number(x))?Number(x):null;
const avg=a=>a.length?+(a.reduce((s,x)=>s+x,0)/a.length).toFixed(3):null;
const pct=(a,b)=>a>0&&b>0?+((b/a-1)*100).toFixed(3):null;
export function preEntryPath(event,observations){
 const at=N(event?.at),mint=event?.mint;
 if(!(at>0)||!mint)return {status:'INVALID_EVENT'};
 // Use source timestamp only. Reject timestamps in future and duplicate timestamps.
 const seen=new Set();const p=[];
 for(const x of observations){if(x.mint!==mint)continue;const t=N(x.priceAt),v=N(x.priceSol);if(!(t>0&&v>0)||t>at||t<at-120000||seen.has(t))continue;seen.add(t);p.push({t,v});}
 p.sort((a,b)=>a.t-b.t);
 const baselineAt=N(event.priceAt),baseline=N(event.priceSol);
 if(!(baselineAt>0&&baseline>0)||baselineAt>at+1000)return {status:'NO_VALID_BASELINE',points:p.length};
 // Explicitly refuse to treat old baseline prices as a current entry price.
 const age=at-baselineAt;
 const endpoint={t:baselineAt,v:baseline};
 const valid=p.filter(x=>x.t<=baselineAt&&x.t>=baselineAt-120000);
 if(!valid.some(x=>x.t===baselineAt))valid.push(endpoint);
 valid.sort((a,b)=>a.t-b.t);
 function window(ms){const eligible=valid.filter(x=>x.t>=baselineAt-ms&&x.t<baselineAt);if(!eligible.length)return {returnPct:null,spanSec:null,points:0};const first=eligible[0];return {returnPct:pct(first.v,baseline),spanSec:+((baselineAt-first.t)/1000).toFixed(1),points:eligible.length+1};}
 const w30=window(30000),w60=window(60000);
 const prior=valid.filter(x=>x.t<baselineAt);
 const peak=Math.max(baseline,...prior.map(x=>x.v));
 const drawdown=pct(peak,baseline);
 const firstHalf=valid.filter(x=>x.t>=baselineAt-60000&&x.t<baselineAt-30000);
 const midpoint=firstHalf.length?firstHalf[firstHalf.length-1]:null;
 const prior30=midpoint?valid.filter(x=>x.t>=midpoint.t-30000&&x.t<midpoint.t):[];
 const prevReturn=midpoint&&prior30.length?pct(prior30[0].v,midpoint.v):null;
 return {status:age>60000?'STALE_BASELINE':'OBSERVED',baselineAgeSec:+(age/1000).toFixed(1),points:valid.length,return30sPct:w30.returnPct,span30sSec:w30.spanSec,return60sPct:w60.returnPct,span60sSec:w60.spanSec,prior30sPct:prevReturn,accelerationPct:w30.returnPct!==null&&prevReturn!==null?+(w30.returnPct-prevReturn).toFixed(3):null,drawdownFrom120sPeakPct:drawdown};
}
export function validate(events,snapshots,now=Date.now()){
 const a=audit(events,snapshots,now);
 const first=new Map();for(const e of events){const state=e.stage29ShadowDecision?.state;if(!['CANDIDATE','WATCH','WAITING','BLOCKED'].includes(state)||!(N(e.at)>0)||!(N(e.priceSol)>0)||!e.mint)continue;const k=e.mint+'|'+state;if(!first.has(k)||e.at<first.get(k).at)first.set(k,e)}
 // Include journal prices with original source timestamps, not capture wall timestamps.
 const observations=[...snapshots,...events.filter(e=>N(e.priceAt)>0&&N(e.priceSol)>0&&N(e.priceAt)<=N(e.at)+1000).map(e=>({mint:e.mint,priceAt:e.priceAt,priceSol:e.priceSol}))];
 const index=new Map();for(const x of observations){if(!x.mint)continue;const v=index.get(x.mint)||[];v.push(x);index.set(x.mint,v)}
 const rows=a.rows.filter(r=>r.horizonMin===5).map(r=>{const e=first.get(r.mint+'|'+r.quantumState);return {...r,preEntry:preEntryPath(e,index.get(r.mint)||[])};});
 const group=rr=>{const matured=rr.filter(r=>r.status==='MATURED');const measured=matured.filter(r=>r.preEntry.status==='OBSERVED');const field=k=>{const v=measured.map(r=>r.preEntry[k]).filter(x=>x!==null&&x!==undefined);return {available:v.length,mean:avg(v)}};return {cohort:rr.length,matured:matured.length,preEntryObserved:measured.length,with30s:field('return30sPct'),with60s:field('return60sPct'),withAcceleration:field('accelerationPct'),drawdownFromPeak:field('drawdownFrom120sPeakPct'),meanFutureReturnPct:avg(matured.map(r=>r.returnPct).filter(x=>N(x)!==null))};};
 const byState=Object.fromEntries(['CANDIDATE','WATCH','WAITING','BLOCKED'].map(s=>[s,group(rows.filter(r=>r.quantumState===s))]));
 const candidates=rows.filter(r=>r.quantumState==='CANDIDATE'&&r.status==='MATURED');
 return {mode:'SHADOW_READ_ONLY',tradeAuthority:false,validated:false,thresholdsChanged:false,method:'First decision per mint/state; historical source timestamps only; 30/60s windows require actual earlier observations; no interpolation; descriptive, not predictive.',warning:'Sparse sampling, nonrandom missing followups, baseline timestamp mismatch and small candidate cohort can bias results. Not trading P&L.',decisions:a.sourceDecisions,byState,candidatePositive:group(candidates.filter(r=>r.returnPct>0)),candidateNonPositive:group(candidates.filter(r=>r.returnPct<=0)),rows};
}
function main(){const archive=path.join(data,'quantum-archive');const archives=fs.existsSync(archive)?fs.readdirSync(archive).filter(n=>n==='stage24-before-stage28.ndjson'||/^stage24-rotated-.*\.ndjson$/.test(n)).map(n=>path.join(archive,n)):[];const j=readNdjson([...archives,path.join(data,'quantum-stage24-decisions.ndjson')]);const p=readNdjson([path.join(data,'quantum-stage26/price-snapshots.ndjson'),path.join(data,'quantum-stage33/price-snapshots.ndjson')]);const {rows,...report}=validate(j.rows,p.rows);report.source={journalRows:j.rows.length,snapshotRows:p.rows.length,invalidLines:j.invalid+p.invalid};console.log(JSON.stringify(report,null,2));if(process.argv.includes('--save')){const dest=path.join(data,'quantum-stage36');fs.mkdirSync(dest,{recursive:true});fs.writeFileSync(path.join(dest,'report.json'),JSON.stringify(report,null,2));fs.writeFileSync(path.join(dest,'rows.json'),JSON.stringify(rows));console.error('Saved to '+dest)}}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))main();
