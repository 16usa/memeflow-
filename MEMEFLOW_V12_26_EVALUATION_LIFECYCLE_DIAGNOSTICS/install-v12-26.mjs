#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

const ROOT=process.cwd();
const APP=path.join(ROOT,'memeflow-app','app-server.mjs');
const FEED=path.join(ROOT,'memeflow-app','src','pump-live-trade-feed.mjs');
const MARK='MEMEFLOW_V12_26_EVALUATION_LIFECYCLE_DIAGNOSTICS';
function fail(x){console.error('ABORT:',x);process.exit(1)}
if(!fs.existsSync(APP)||!fs.existsSync(FEED)) fail('Run from ~/workspace with V12.25.1 installed.');
let a=fs.readFileSync(APP,'utf8');
let f=fs.readFileSync(FEED,'utf8');
if(!a.includes("version:'V12.25.1'")) fail('V12.25.1 marker not found.');
if(!f.includes("version:VERSION")||!f.includes('evaluateAI')) fail('V12.22+ live trade feed not detected.');
if(a.includes(MARK)||f.includes(MARK)){console.log('PASS: V12.26 already installed');process.exit(0)}

const stamp=new Date().toISOString().replace(/[:.]/g,'-');
const ab=APP+'.before-v12-26-'+stamp;
const fb=FEED+'.before-v12-26-'+stamp;
fs.copyFileSync(APP,ab);fs.copyFileSync(FEED,fb);

try{
  // 1) Live feed: instrument evaluateAI result/error without changing evaluator semantics.
  if(!f.includes('evaluationCalls:0')){
    f=f.replace(
      "httpRpcCalls:0,queueDepth:0,active:0",
      "httpRpcCalls:0,queueDepth:0,active:0,\n    evaluationCalls:0,evaluationResolved:0,evaluationRejected:0,evaluationNullResults:0,\n    evaluationDecisionLikeResults:0,lastEvaluationMint:null,lastEvaluationTrigger:null,\n    lastEvaluationAt:null,lastEvaluationResultType:null,lastEvaluationError:null"
    );
  }

  const anchor="  function applyEvent(e){";
  const at=f.indexOf(anchor);
  if(at<0) throw new Error('applyEvent(e) anchor not found');
  const helper=`  // ${MARK}\n  const __v1226EvalByMint=new Map();\n  function __v1226ResultType(r){\n    if(r===null||r===undefined)return 'null';\n    if(Array.isArray(r))return 'array';\n    return typeof r==='object'?(r.state||r.decision||r.result?'decision-like':'object'):typeof r;\n  }\n  function __v1226Remember(mint,trigger,status,result,error){\n    const row={mint,trigger,status,at:Date.now(),resultType:__v1226ResultType(result),error:error?String(error?.message||error):null};\n    __v1226EvalByMint.set(mint,row);\n    if(__v1226EvalByMint.size>80){const k=__v1226EvalByMint.keys().next().value;__v1226EvalByMint.delete(k)}\n  }\n  function __v1226Evaluate(updated,mint,trigger){\n    metrics.evaluationCalls++;\n    metrics.lastEvaluationMint=mint||updated?.mint||null;\n    metrics.lastEvaluationTrigger=trigger;\n    metrics.lastEvaluationAt=Date.now();\n    try{\n      const p=Promise.resolve(evaluateAI?.(updated));\n      p.then((r)=>{\n        metrics.evaluationResolved++;\n        if(r===null||r===undefined)metrics.evaluationNullResults++;\n        else if(typeof r==='object'&&(r.state||r.decision||r.result||r.primaryReason||r.reasons))metrics.evaluationDecisionLikeResults++;\n        metrics.lastEvaluationResultType=__v1226ResultType(r);\n        metrics.lastEvaluationError=null;\n        __v1226Remember(mint||updated?.mint||null,trigger,'resolved',r,null);\n      }).catch((err)=>{\n        metrics.evaluationRejected++;\n        metrics.lastEvaluationError=String(err?.message||err);\n        __v1226Remember(mint||updated?.mint||null,trigger,'rejected',null,err);\n      });\n      return p;\n    }catch(err){\n      metrics.evaluationRejected++;\n      metrics.lastEvaluationError=String(err?.message||err);\n      __v1226Remember(mint||updated?.mint||null,trigger,'threw',null,err);\n      return Promise.resolve(null);\n    }\n  }\n\n`;
  f=f.slice(0,at)+helper+f.slice(at);

  let replaced=0;
  f=f.replace(/try\{Promise\.resolve\(evaluateAI\?\.\(updated\)\)\.catch\(\(\)=>\{\}\)\}catch\{\}/g,()=>{
    replaced++;
    const trigger=replaced===1?'holder-event':'market-event';
    return `try{__v1226Evaluate(updated,e.mint,'${trigger}')}catch{}`;
  });
  if(replaced<2) throw new Error('Expected 2 evaluateAI hot-path calls; found '+replaced);

  f=f.replace(
    "metrics:()=>({...metrics,queueDepth:0,active:0,httpRpcCalls:0})",
    "metrics:()=>({...metrics,queueDepth:0,active:0,httpRpcCalls:0,evaluationRecent:Array.from(__v1226EvalByMint.values()).slice(-12)})"
  );
  if(!f.includes('evaluationRecent:Array.from(__v1226EvalByMint.values())')) throw new Error('metrics return hook not patched');
  f += `\n// ${MARK}: evaluateAI hot-path instrumentation only; evaluator/execution semantics unchanged.\n`;

  // 2) Main diagnostics: expose explicit lifecycle interpretation beside V12.25 gate sample.
  const diag="diagnosticVersion:'V10.2-same-instance',";
  const matches=a.split(diag).length-1;
  if(matches!==1) throw new Error('Expected exactly 1 diagnostics anchor; found '+matches);
  a=a.replace(diag,diag+`\n      v12_26:{\n        version:'V12.26',\n        diagnosticsOnly:true,\n        tradingLogicChanged:false,\n        eventReevaluationAlreadyPresent:true,\n        note:'Captures evaluateAI call/result lifecycle from the existing V12.22 holder+market event re-evaluation hot path.'\n      },`);

  const gateAnchor='gateSampleDiagnostics:sample.map((row)=>{';
  const gi=a.indexOf(gateAnchor);
  if(gi<0) throw new Error('V12.25.1 gateSampleDiagnostics anchor not found');
  const before=a.slice(0,gi);
  const after=a.slice(gi);
  const lifecycle=`evaluationLifecycleDiagnostics:sample.map((row)=>{\n        const d=row?.decision||null;\n        const h=row?.holder||{};\n        const m=row?.market||{};\n        return {\n          mint:row?.mint??null,\n          ageMinutes:row?.ageMinutes??null,\n          holderFresh:h.fresh===true,\n          holderKnown:h.count!=null,\n          marketKnown:(m.priceSol!=null||m.buyPressure!=null||m.liquiditySol!=null),\n          decisionAttached:!!d,\n          decisionState:d?.state??null,\n          decisionReason:d?.primaryReason??(Array.isArray(d?.reasons)&&d.reasons.length?d.reasons[0]:null),\n          settingsVersion:d?.settingsVersion??null,\n          reevaluatedAt:d?.reevaluatedAt??null\n        };\n      }),\n      `;
  a=before+lifecycle+after;
  a += `\n// ${MARK}\n`;

  fs.writeFileSync(APP,a);fs.writeFileSync(FEED,f);
  for(const p of [APP,FEED]){
    const r=spawnSync(process.execPath,['--check',p],{encoding:'utf8'});
    if(r.status!==0) throw new Error('node --check failed for '+p+'\n'+(r.stderr||r.stdout));
  }
  console.log('PASS: V12.26 installed');
  console.log('Backups:',ab,fb);
  console.log('IMPORTANT: trading logic/thresholds were NOT changed.');
  console.log('Existing event re-evaluation remains active; V12.26 now proves whether evaluateAI resolves, rejects, or returns null.');
  console.log('Next: node MEMEFLOW_V12_26_EVALUATION_LIFECYCLE_DIAGNOSTICS/self-test-v12-26.mjs');
}catch(e){
  try{fs.copyFileSync(ab,APP)}catch{}
  try{fs.copyFileSync(fb,FEED)}catch{}
  console.error('ABORT:',e.message);console.error('Backups restored.');process.exit(2);
}
