// Read-only, deterministic audit. Does not start server, connect wallets, or place trades.
import {writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve,dirname} from 'node:path';
const app=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const {evaluate}=await import(resolve(app,'src/evaluate.mjs'));
const {evaluateEntryAdmission,evaluateSettingsGate}=await import(resolve(app,'src/settings-gate.mjs'));
const {resolveQuantumPattern}=await import(resolve(app,'src/quantum-pattern-provider.mjs'));
const {quantumDecision}=await import(resolve(app,'src/quantum-decision-engine.mjs'));
const previous=process.env.MEMEFLOW_QUANTUM_MODE;
const now=Date.now();
const token={mint:'stage13-fixture',priceSol:0.000001,holderCount:300,top10Pct:10,developerPct:3,buyPressure:95,suspectedRiskyWalletsPct:4,insidersPct:3,opportunityEvidenceReady:true,opportunityScore:90,qualityScore:90,opportunityTrendHealthy:true,holderFresh:true};
const pattern={shadowTokenPattern:{ready:true,patternProbabilityPositivePct:90,matchConfidencePct:90}};
const scenarios=[
 ['healthy',token,{},pattern],
 ['dead',{...token,dead:true},{},pattern],
 ['missing-price',{...token,priceSol:null},{},pattern],
 ['stale-pattern',token,{}, {shadowTokenPattern:{ready:false,status:'PATTERN_STALE'}}],
 ['concentrated',{...token,top10Pct:99,developerPct:80},{},pattern],
 ['configured-min-score',token,{minScore:100},pattern],
 ['configured-min-confidence',token,{minConfidence:101},pattern],
 ['configured-wallet-risk',token,{maxSuspectedRiskyWalletsPct:2},pattern],
 ['missing-wallet-risk',{...token,suspectedRiskyWalletsPct:null},{maxSuspectedRiskyWalletsPct:2},pattern],
];
const results=[];
try{
 for(const [name,t,s,intelligence] of scenarios){
   const record={name};
   for(const mode of ['SHADOW','ENFORCE']){
     process.env.MEMEFLOW_QUANTUM_MODE=mode;
     const d=evaluate(t,s,{quantumIntelligence:intelligence,includePreOpenRisk:true});
     const admission=evaluateEntryAdmission(t,s);
     const settings=evaluateSettingsGate(t,s,{includePreOpenRisk:true});
     record[mode]={state:d.state,score:d.score,authority:d.scoreAuthority,admission:admission.state,admitted:admission.admitted,settingsState:settings.state,settingsFailures:settings.failedGates?.map(g=>g.key),reason:d.primaryReason};
   }
   results.push(record);
 }
}finally{if(previous===undefined)delete process.env.MEMEFLOW_QUANTUM_MODE;else process.env.MEMEFLOW_QUANTUM_MODE=previous;}
const healthy=results.find(x=>x.name==='healthy');
const findings=[];
for(const row of results){
 if(row.ENFORCE.state==='BUY READY' && row.ENFORCE.admitted===false)findings.push({severity:'HIGH',scenario:row.name,issue:'Quantum BUY READY conflicts with entry admission; verify downstream veto is always applied.'});
 if(row.ENFORCE.state==='BUY READY' && row.ENFORCE.settingsFailures?.length)findings.push({severity:'HIGH',scenario:row.name,issue:'Quantum BUY READY conflicts with configured settings gate; verify downstream veto is always applied.'});
}
if(results.find(x=>x.name==='stale-pattern')?.ENFORCE.state==='BUY READY')findings.push({severity:'CRITICAL',issue:'Stale pattern permitted BUY READY'});
if(results.find(x=>x.name==='dead')?.ENFORCE.state!=='BLOCKED')findings.push({severity:'CRITICAL',issue:'Dead token not BLOCKED'});
const future=resolveQuantumPattern({snapshot:{observedAt:now+60000,shadowTokenPattern:{ready:true,patternProbabilityPositivePct:90,matchConfidencePct:90}}},{now});
if(future.shadowTokenPattern.ready===true)findings.push({severity:'CRITICAL',issue:'Future pattern timestamp accepted'});
const pure=quantumDecision(token,{},pattern);
const report={stage:13,mode:'READ_ONLY_RUNTIME_FIXTURES',liveReady:false,generatedAt:new Date().toISOString(),summary:{scenarios:results.length,findings:findings.length,healthyShadow:healthy?.SHADOW.state,healthyEnforce:healthy?.ENFORCE.state},findings,results,limitations:['Synthetic fixture data, not historical backtesting','Does not prove app-server routing, RPC admission, wallet or order execution','No production environment variables or user settings were modified']};
const out=process.argv.includes('--output')?process.argv[process.argv.indexOf('--output')+1]:null;
if(out)writeFileSync(resolve(out),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
if(findings.some(f=>f.severity==='CRITICAL'))process.exitCode=1;
