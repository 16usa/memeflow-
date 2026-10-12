#!/usr/bin/env node
// Stage37: diagnostic-only fixed momentum scenarios. Never selects or changes live thresholds.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const app=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const num=x=>typeof x==='number'&&Number.isFinite(x)?x:null;
const mean=a=>a.length?+(a.reduce((s,v)=>s+v,0)/a.length).toFixed(3):null;
const median=a=>a.length?[...a].sort((x,y)=>x-y)[Math.floor((a.length-1)/2)]:null;
const stats=rows=>{const returns=rows.map(r=>r.returnPct).filter(v=>num(v)!==null);return {count:rows.length,positive:returns.filter(v=>v>0).length,nonPositive:returns.filter(v=>v<=0).length,meanReturnPct:mean(returns),medianReturnPct:median(returns),minReturnPct:returns.length?Math.min(...returns):null,maxReturnPct:returns.length?Math.max(...returns):null};};
export function validateMomentum(rows){
 const all=rows.filter(r=>r.quantumState==='CANDIDATE'&&r.horizonMin===5);
 const matured=all.filter(r=>r.status==='MATURED'&&num(r.returnPct)!==null);
 const measured=matured.filter(r=>r.preEntry?.status==='OBSERVED'&&num(r.preEntry.accelerationPct)!==null);
 const unmeasured=matured.filter(r=>!measured.includes(r));
 const thresholds=[0,10,20,30,40];
 const scenarios=thresholds.map(threshold=>{
  const pass=measured.filter(r=>r.preEntry.accelerationPct>=threshold);
  const fail=measured.filter(r=>r.preEntry.accelerationPct<threshold);
  const distinctMints=new Set(pass.map(r=>r.mint)).size;
  const looMeans=pass.length>=2?pass.map((_,i)=>mean(pass.filter((_,j)=>i!==j).map(r=>r.returnPct))):[];
  return {threshold,measured:measured.length,pass:stats(pass),fail:stats(fail),missingFeature:unmeasured.length,distinctMints,leaveOneOutMeanRange:looMeans.length?[Math.min(...looMeans),Math.max(...looMeans)]:null,notValidated:true};
 });
 return {mode:'SHADOW_READ_ONLY',tradeAuthority:false,thresholdsChanged:false,validated:false,method:'Fixed exploratory acceleration thresholds (percentage-point delta between observed 30-second windows); no optimized selection.',warning:'Tiny, selected sample; first mint/state; missing followups not random; time windows may be sparse or uneven. Means exclude missing. This is not a prospective backtest, causal test or trading P&L.',candidateCohort:all.length,matured:stats(matured),withAcceleration:stats(measured),withoutAcceleration:stats(unmeasured),missingFollowup:all.filter(r=>r.status==='MISSING_FOLLOWUP').length,pending:all.filter(r=>['PENDING','WINDOW_OPEN'].includes(r.status)).length,scenarios};
}
function main(){const source=path.join(app,'data/quantum-stage36/rows.json');if(!fs.existsSync(source)){console.error('Missing Stage36 rows.json. Run Stage36 with --save first.');process.exitCode=1;return;}
 const rows=JSON.parse(fs.readFileSync(source,'utf8'));const report=validateMomentum(rows);console.log(JSON.stringify(report,null,2));if(process.argv.includes('--save')){const dest=path.join(app,'data/quantum-stage37');fs.mkdirSync(dest,{recursive:true});fs.writeFileSync(path.join(dest,'report.json'),JSON.stringify(report,null,2));console.error('Saved to '+dest);}}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))main();
