#!/usr/bin/env node
// Prospective SHADOW audit. Register new candidate decisions before outcomes; never trade.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const app=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const dir=path.join(app,'data/quantum-stage38');
const cutoffFile=path.join(dir,'cutoff.json');
const registryFile=path.join(dir,'registered.ndjson');
const resultFile=path.join(dir,'report.json');
const threshold=30;
const number=x=>typeof x==='number'&&Number.isFinite(x)?x:null;
const readJson=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const readLines=p=>fs.existsSync(p)?fs.readFileSync(p,'utf8').split(/\r?\n/).filter(Boolean).map(s=>JSON.parse(s)):[];
const mean=a=>a.length?+(a.reduce((x,y)=>x+y,0)/a.length).toFixed(3):null;
export function register(rows,prior,cutoff){
 const seen=new Set(prior.map(x=>x.key));const added=[];
 for(const r of rows){
  if(r.quantumState!=='CANDIDATE'||r.horizonMin!==5||!(number(r.at)>cutoff))continue;
  const key=`${r.mint}|${r.at}`;
  if(seen.has(key))continue;
  const a=r.preEntry?.status==='OBSERVED'?number(r.preEntry.accelerationPct):null;
  const item={key,mint:r.mint,decisionAt:r.at,registeredAt:Date.now(),threshold,accelerationPct:a,eligible:a===null?null:a>=threshold,baselineStatus:r.preEntry?.status??'MISSING',mode:'SHADOW_READ_ONLY'};
  seen.add(key);added.push(item);
 }
 return added;
}
export function summarize(registered,rows){
 const byKey=new Map(rows.filter(r=>r.horizonMin===5).map(r=>[`${r.mint}|${r.at}`,r]));
 const groups={pass:[],fail:[],unmeasured:[]};let pending=0,missing=0,matured=0;
 for(const item of registered){const r=byKey.get(item.key);if(!r||r.status!=='MATURED'||number(r.returnPct)===null){if(r?.status==='MISSING_FOLLOWUP')missing++;else pending++;continue;}
  matured++;groups[item.eligible===true?'pass':item.eligible===false?'fail':'unmeasured'].push(r.returnPct);
 }
 const stats=a=>({count:a.length,positive:a.filter(v=>v>0).length,nonPositive:a.filter(v=>v<=0).length,meanReturnPct:mean(a)});
 return {mode:'SHADOW_READ_ONLY',tradeAuthority:false,validated:false,thresholdFrozen:threshold,registered:registered.length,matured,pending,missingFollowup:missing,pass:stats(groups.pass),fail:stats(groups.fail),unmeasured:stats(groups.unmeasured),warning:'Prospective registrations only; missing followups are not zero returns. No live trading or causal claims.'};
}
function main(){const command=process.argv[2]||'report';fs.mkdirSync(dir,{recursive:true});
 if(command==='init'){
  if(fs.existsSync(cutoffFile)){console.log('Already initialized: '+JSON.stringify(readJson(cutoffFile)));return;}
  // Wall clock cutoff fixed before new events; future events only.
  const value={cutoffAt:Date.now(),threshold,createdAt:new Date().toISOString(),mode:'SHADOW_READ_ONLY'};
  fs.writeFileSync(cutoffFile,JSON.stringify(value,null,2),{flag:'wx'});console.log('Initialized: '+JSON.stringify(value));return;
 }
 if(!fs.existsSync(cutoffFile)){console.error('Run init first to freeze the prospective cutoff.');process.exitCode=1;return;}
 const source=path.join(app,'data/quantum-stage36/rows.json');if(!fs.existsSync(source)){console.error('Missing Stage36 rows. Refresh Stage36 --save first.');process.exitCode=1;return;}
 const cutoff=readJson(cutoffFile).cutoffAt;const rows=readJson(source);const prior=readLines(registryFile);
 if(command==='collect'){
  const added=register(rows,prior,cutoff);if(added.length)fs.appendFileSync(registryFile,added.map(x=>JSON.stringify(x)).join('\n')+'\n');
  const report=summarize([...prior,...added],rows);fs.writeFileSync(resultFile,JSON.stringify(report,null,2));console.log(JSON.stringify({newRegistrations:added.length,...report}));return;
 }
 if(command==='report'){const report=summarize(prior,rows);fs.writeFileSync(resultFile,JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));return;}
 console.error('Usage: init | collect | report');process.exitCode=1;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))main();
