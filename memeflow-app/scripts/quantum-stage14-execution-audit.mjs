// Stage 14: read-only audit of quantum decision and execution boundaries.
// No server startup, RPC, wallet access or state mutation.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=(p)=>fs.readFileSync(path.join(root,p),'utf8');
const files=['app-server.mjs','src/evaluate.mjs','src/quantum-decision-engine.mjs','src/settings-gate.mjs'];
const report={stage:14,mode:'READ_ONLY',liveReady:false,generatedAt:new Date().toISOString(),checks:[],executionSites:[],limitations:[]};
for(const file of files){try{read(file);report.checks.push({name:`file:${file}`,pass:true});}catch{report.checks.push({name:`file:${file}`,pass:false});}}
if(report.checks.some(x=>!x.pass)){console.log(JSON.stringify(report,null,2));process.exitCode=2;}else{
 const server=read('app-server.mjs');
 const evaluate=read('src/evaluate.mjs');
 const engine=read('src/quantum-decision-engine.mjs');
 const lines=server.split('\n');
 for(let i=0;i<lines.length;i++){
  const line=lines[i];
  if(/\bexecuteTrade\s*\(/.test(line)){
   const nearby=lines.slice(Math.max(0,i-45),Math.min(lines.length,i+8)).join('\n');
   report.executionSites.push({file:'app-server.mjs',line:i+1,text:line.trim().slice(0,200),nearbyQuantumCheck:/quantumDecision|quantumDecisionGuard|evaluate\([^\n]*includePreOpenRisk/.test(nearby),nearbyExecutionLock:/LIVE_EXECUTION_NOT_READY|DEVNET|d5Probe|EXECUTION_LOCK|QUARANTINE/.test(nearby)});
  }
 }
 report.checks.push({name:'enforce-returns-quantum',pass:/quantumMode\s*===\s*['"]ENFORCE['"]\s*\)\s*return quantum/.test(evaluate)});
 report.checks.push({name:'quantum-preopen-wallet-guard',pass:/finalPreOpen\s*&&/.test(engine)&&/riskWallets===null/.test(engine)});
 report.checks.push({name:'execution-sites-found',pass:report.executionSites.length>0});
 report.checks.push({name:'all-execution-sites-proven-quantum-gated',pass:report.executionSites.length>0&&report.executionSites.every(x=>x.nearbyQuantumCheck)});
 report.limitations.push('Static proximity checks are NOT runtime call-graph proof. A positive proximity result cannot authorize live trading.');
 report.limitations.push('No wallet, RPC, transaction, historical calibration or live trading was tested.');
 report.limitations.push('Existing execution locks must remain enabled.');
 report.summary={passed:report.checks.filter(x=>x.pass).length,failed:report.checks.filter(x=>!x.pass).length,executionSites:report.executionSites.length,quantumGateProven:false,liveReady:false};
 console.log(JSON.stringify(report,null,2));
 // Audit findings are not a script failure. Use report checks to plan integration.
}
