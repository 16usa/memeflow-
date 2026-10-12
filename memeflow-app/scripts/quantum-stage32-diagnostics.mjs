#!/usr/bin/env node
// Read-only diagnostics for Stage31; no execution or score modifications.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {analyze,readNdjson} from './quantum-stage31-report.mjs';
const finite=x=>x!==null&&x!==undefined&&x!==''&&Number.isFinite(Number(x))?Number(x):null;
const validStates=new Set(['CANDIDATE','WATCH','WAITING','BLOCKED']);
const round=x=>x===null?null:+x.toFixed(3);
export function diagnose(events,snapshots,now=Date.now()){
 const result=analyze(events,snapshots,now);
 const first=new Map();const priceByMint=new Map();
 function price(mint,t,p){if(!mint||!(finite(t)>0)||!(finite(p)>0)||t>now+60000)return;const a=priceByMint.get(mint)||[];a.push(t);priceByMint.set(mint,a)}
 for(const s of snapshots)price(s.mint,s.priceAt,s.priceSol);
 for(const e of events){if(finite(e.priceAt)>0&&finite(e.at)>0&&e.priceAt<=e.at+1000)price(e.mint,e.priceAt,e.priceSol);
  const state=e.stage29ShadowDecision?.state;if(!validStates.has(state)||!(finite(e.at)>0)||!(finite(e.priceSol)>0)||!e.mint)continue;
  const k=e.mint+'|'+state;if(!first.has(k)||e.at<first.get(k).at)first.set(k,e);
 }
 for(const a of priceByMint.values())a.sort((x,y)=>x-y);
 const diagnostics=[];
 for(const row of result.rows){const e=first.get(row.mint+'|'+row.quantumState);if(!e)continue;
  const times=priceByMint.get(row.mint)||[];const target=e.at+row.horizonMin*60000,end=target+120000;
  const later=times.filter(t=>t>e.at), before=later.filter(t=>t<target), after=later.filter(t=>t>end);
  const reason=row.status==='MATURED'?'MATCHED':row.status==='PENDING'?'NOT_DUE':row.status==='WINDOW_OPEN'?'WINDOW_STILL_OPEN':!later.length?'NO_LATER_PRICE':before.length&&after.length?'GAP_ACROSS_WINDOW':before.length?'ONLY_BEFORE_WINDOW':after.length?'ONLY_AFTER_WINDOW':'NO_PRICE_IN_WINDOW';
  diagnostics.push({mint:row.mint,horizonMin:row.horizonMin,quantumState:row.quantumState,memflowState:row.memflowState,status:row.status,missingReason:reason,decisionAt:e.at,followupAt:row.followupAt,returnPct:row.returnPct,quantumScore:finite(e.quantumScore),quantumRisk:finite(e.quantumRisk),patternDirection:e.observedPattern?.direction??null,patternReturnPct:finite(e.observedPattern?.returnPct),patternObservations:finite(e.observedPattern?.observations),decisionReason:e.stage29ShadowDecision?.reason??null,priceSamplesForMint:times.length,lastPriceAt:times.at(-1)??null});
 }
 const byHorizon={};for(const h of [5,15,30,60]){const rows=diagnostics.filter(r=>r.horizonMin===h);const reasons={};for(const r of rows)reasons[r.missingReason]=(reasons[r.missingReason]||0)+1;
  const byQuantum={};for(const state of validStates){const a=rows.filter(r=>r.quantumState===state),m=a.filter(r=>r.status==='MATURED');byQuantum[state]={cohort:a.length,matured:m.length,meanReturnPct:m.length?round(m.reduce((s,r)=>s+r.returnPct,0)/m.length):null,meanScore:m.some(r=>r.quantumScore!==null)?round(m.reduce((s,r)=>s+(r.quantumScore??0),0)/m.filter(r=>r.quantumScore!==null).length):null,scoreAvailable:m.filter(r=>r.quantumScore!==null).length,meanRisk:m.some(r=>r.quantumRisk!==null)?round(m.reduce((s,r)=>s+(r.quantumRisk??0),0)/m.filter(r=>r.quantumRisk!==null).length):null,patternDirections:Object.fromEntries(['BULLISH','BEARISH','NEUTRAL','UNKNOWN'].map(k=>[k,a.filter(r=>r.patternDirection===k).length]))};}
  byHorizon[h]={reasons,byQuantum};}
 return {mode:'SHADOW_READ_ONLY',verifiedAccuracy:false,tradeAuthority:false,method:'Stage31 exact-mint source-time matching; first decision per mint/state; 2-minute post-horizon window; diagnostics only, no causal attribution, no fees/slippage.',decisions:result.decisions,priceObservations:result.priceObservations,byHorizon,rows:diagnostics};
}
function main(){const app=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),data=path.join(app,'data'),archive=path.join(data,'quantum-archive');const archives=fs.existsSync(archive)?fs.readdirSync(archive).filter(n=>n==='stage24-before-stage28.ndjson'||/^stage24-rotated-.*\.ndjson$/.test(n)).map(n=>path.join(archive,n)):[];
 const j=readNdjson([...archives,path.join(data,'quantum-stage24-decisions.ndjson')]);const p=readNdjson([path.join(data,'quantum-stage26/price-snapshots.ndjson')]);const r=diagnose(j.rows,p.rows);const {rows,...summary}=r;summary.source={journalRows:j.rows.length,stage26Rows:p.rows.length,invalidJournalLines:j.invalid,invalidPriceLines:p.invalid};console.log(JSON.stringify(summary,null,2));if(process.argv.includes('--save')){const out=path.join(data,'quantum-stage32');fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(summary,null,2));fs.writeFileSync(path.join(out,'rows.json'),JSON.stringify(rows));console.error('Saved to '+out);}}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))main();
