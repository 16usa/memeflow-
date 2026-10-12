#!/usr/bin/env node
// SHADOW-only analysis. Reads Stage25 journal and live token registry; writes independent local analytics.
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const data=path.join(root,'data');
const out=path.join(data,'quantum-stage26');
const journal=path.join(data,'quantum-stage24-decisions.ndjson');
const snapshotFile=path.join(out,'price-snapshots.ndjson');
const horizon=[5,15,30,60];
const num=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v))?Number(v):null;
const read=(file)=>{if(!fs.existsSync(file))return [];const result=[];for(const line of fs.readFileSync(file,'utf8').split('\n')){if(!line.trim())continue;try{result.push(JSON.parse(line))}catch{}}return result};
export function decisions(rows){
 const first=new Map();
 for(const e of rows){if(e.version!==25||!e.mint||!Number.isFinite(num(e.at))||!(num(e.priceSol)>0))continue;
  if(!['BUY READY','WATCH','WAITING','BLOCKED'].includes(e.state))continue;
  const key=e.mint+'|'+e.state;
  if(!first.has(key)||e.at<first.get(key).at)first.set(key,e);
 }
 return [...first.values()];
}
export function measure(ds,snapshots,now=Date.now()){
 const byMint=new Map();for(const s of snapshots){if(!s.mint||!(num(s.priceSol)>0)||!Number.isFinite(num(s.priceAt)))continue;const list=byMint.get(s.mint)||[];list.push(s);byMint.set(s.mint,list)}
 for(const list of byMint.values())list.sort((a,b)=>a.priceAt-b.priceAt);
 const rows=[];
 for(const d of ds){const prices=byMint.get(d.mint)||[];
  for(const min of horizon){const target=d.at+min*60000;
   // Price must be observed AFTER target, no more than 2 minutes late, and after decision.
   const p=prices.find(s=>s.priceAt>=target&&s.priceAt<=target+120000&&s.priceAt>d.at);
   const status=p?'MATURED':now<target?'PENDING':'MISSING_FOLLOWUP';
   rows.push({mint:d.mint,decisionAt:d.at,memflowState:d.state,quantumState:d.quantumState??null,quantumScore:num(d.quantumScore),quantumRisk:num(d.quantumRisk),patternReady:d.quantumPattern?.ready===true,minutes:min,status,returnPct:p?100*(p.priceSol/d.priceSol-1):null,observedAt:p?.priceAt??null});
  }
 }
 const groups={};
 for(const min of horizon){const relevant=rows.filter(r=>r.minutes===min);const summary=arr=>{const mature=arr.filter(r=>r.status==='MATURED');return {cohort:arr.length,matured:mature.length,pending:arr.filter(r=>r.status==='PENDING').length,missingFollowup:arr.filter(r=>r.status==='MISSING_FOLLOWUP').length,meanReturnPct:mature.length?Number((mature.reduce((s,r)=>s+r.returnPct,0)/mature.length).toFixed(4)):null,positiveRate:mature.length?Number((mature.filter(r=>r.returnPct>0).length/mature.length).toFixed(4)):null}};
  groups[min]={all:summary(relevant),memflowBuyReady:summary(relevant.filter(r=>r.memflowState==='BUY READY')),memflowBuyReadyQuantumWaiting:summary(relevant.filter(r=>r.memflowState==='BUY READY'&&r.quantumState==='WAITING')),quantumBuyReady:summary(relevant.filter(r=>r.quantumState==='BUY READY'))};
 }
 return {mode:'SHADOW_OBSERVATIONAL',liveTradingValidated:false,quantumAccuracyVerified:false,method:'First Stage25 decision per mint and Memflow state; exact-mint SQLite price snapshots, matched by source priceAt within 2m after each horizon. Missing data never counted as zero return.',decisions:ds.length,snapshots:snapshots.length,groups,rows};
}
function main(){const cmd=process.argv[2]||'once';if(!['once','report','watch'].includes(cmd))throw Error('Usage: once | report | watch');if(cmd==='watch'){console.log('Stage 26 SHADOW polling once per minute. Ctrl+C stops; no trades.');mainOnce();setInterval(()=>{try{mainOnce()}catch(e){console.error(e.message)}},60000);return}mainOnce(cmd);}
function mainOnce(cmd='once'){ fs.mkdirSync(out,{recursive:true});
 const ds=decisions(read(journal));let snaps=read(snapshotFile);let capture=null;
 if(cmd==='once'){
  // Cap exact-mint lookup to 400 recently decided tokens; repeat runs can fill the history.
  const mints=[...new Set([...ds].sort((a,b)=>b.at-a.at).map(d=>d.mint))].slice(0,400);
  const proc=spawnSync('python3',[path.join(root,'scripts/quantum-stage26-prices.py'),path.join(data,'token-registry-v1.sqlite'),'400'],{input:JSON.stringify(mints),encoding:'utf8',timeout:15000,maxBuffer:2*1024*1024});
  if(proc.status!==0)throw Error('SQLite read failed: '+String(proc.stderr||proc.error||'').slice(0,400));
  capture=JSON.parse(proc.stdout);let added=0;const seen=new Set(snaps.map(s=>s.mint+'|'+s.priceAt));
  for(const s of capture.rows||[]){if(!(s.priceAt>0)||s.priceAt>Date.now()+60000)continue;const key=s.mint+'|'+s.priceAt;if(seen.has(key))continue;fs.appendFileSync(snapshotFile,JSON.stringify(s)+'\n',{mode:0o600});snaps.push(s);seen.add(key);added++}capture={queried:capture.queried||0,available:(capture.rows||[]).length,added,error:capture.error||null};
 }
 const result=measure(ds,snaps);const {rows,...summary}=result;fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({...summary,capture},null,2));
 console.log(JSON.stringify({...summary,capture},null,2));
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){try{main()}catch(e){console.error(e.message);process.exitCode=1}}
