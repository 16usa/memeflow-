// Read-only, offline Quantum Stage 10 audit. No server, wallet, network or trade access.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const root=process.cwd();
const app=fs.existsSync(path.join(root,'memeflow-app'))?path.join(root,'memeflow-app'):root;
const read=p=>fs.readFileSync(path.join(app,p),'utf8');
const checks=[];
const check=(name,pass,detail='')=>checks.push({name,status:pass?'PASS':'FAIL',detail});
const src=read('src/quantum-decision-engine.mjs');
const evalSrc=read('src/evaluate.mjs');
const server=read('app-server.mjs');
check('Quantum engine present',/export\s+function\s+quantumDecision\s*\(/.test(src));
check('Quantum ENFORCE switch',/MEMEFLOW_QUANTUM_MODE/.test(evalSrc)&&/ENFORCE/.test(evalSrc));
check('Quantum source attribution',/scoreAuthority\s*:\s*['"]quantum-decision-engine['"]/.test(src));
check('Legacy bridge bypass in ENFORCE',/function\s+__mfApplyV24PolicyBridge[\s\S]{0,350}MEMEFLOW_QUANTUM_MODE[\s\S]{0,160}ENFORCE[\s\S]{0,80}return decision/.test(server));
check('Execution quarantine in ENFORCE',/MEMEFLOW_QUANTUM_MODE/.test(server)&&/quantum.{0,80}(execution|quarantine)|execution.{0,80}quantum|ENFORCE.{0,200}(blocked|quarantine)/is.test(server));
check('Pattern provider present',fs.existsSync(path.join(app,'src/quantum-pattern-provider.mjs')));
const legacyCalls=[...server.matchAll(/\bevaluate\s*\(/g)].length;
const admission=[...server.matchAll(/__mfEntryAdmission/g)].length;
console.log('Quantum Stage 10 — READ-ONLY OFFLINE AUDIT');
console.log('Mode: inspection + synthetic cases; NOT live-trading validation');
for(const c of checks)console.log(`${c.status} | ${c.name}${c.detail?' | '+c.detail:''}`);
console.log(`INFO | app-server evaluate() references: ${legacyCalls}; entry-admission references: ${admission}`);
let q;
try{({quantumDecision:q}=await import(pathToFileURL(path.join(app,'src/quantum-decision-engine.mjs')).href));}
catch(e){check('Import Quantum Engine',false,e.message)}
if(q){
  const good={priceSol:0.001,holderCount:400,top10Pct:10,developerPct:2,buyPressure:95,suspectedRiskyWalletsPct:2,insidersPct:1};
  const intel={shadowTokenPattern:{ready:true,patternProbabilityPositivePct:82,matchConfidencePct:75}};
  const cases=[
    ['Dead token blocked',{...good,dead:true},intel,x=>x.state==='BLOCKED'],
    ['Missing price waits',{...good,priceSol:null},intel,x=>x.state==='WAITING'],
    ['No pattern waits',good,{},x=>x.state==='WAITING'],
    ['Strong positive case eligible',good,intel,x=>x.state==='BUY READY'],
    ['High wallet risk blocked',{...good,top10Pct:95,developerPct:80,suspectedRiskyWalletsPct:95,insidersPct:90},intel,x=>x.state==='BLOCKED'],
  ];
  for(const [name,token,i,assert] of cases){try{const result=q(token,{},i);check(name,assert(result),`state=${result.state}, score=${result.score}`)}catch(e){check(name,false,e.message)}}
}
console.log('\nSUMMARY',JSON.stringify({passed:checks.filter(c=>c.status==='PASS').length,failed:checks.filter(c=>c.status==='FAIL').length,legacyCalls,admission,liveReady:false}));
if(checks.some(c=>c.status==='FAIL'))process.exitCode=1;
