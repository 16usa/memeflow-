// Stage 12: read-only decision-path audit. No orders, no server start, no writes.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const app=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const files=['app-server.mjs','src/evaluate.mjs','src/settings-gate.mjs','src/quantum-decision-engine.mjs','src/quantum-pattern-provider.mjs','src/paper-engine.mjs'];
const patterns={legacyEvaluate:/\bevaluate\s*\(/g,entryAdmission:/\bevaluateEntryAdmission\s*\(/g,settingsAdmission:/\bevaluateSettingsAdmission\s*\(/g,policyBridge:/\b__mfApplyV24PolicyBridge\s*\(/g,quantumDecision:/\bquantumDecision\s*\(/g,execution:/\bexecuteTrade\s*\(/g};
const report={stage:12,mode:'READ_ONLY',liveReady:false,files:{},findings:[],checks:{}};
for(const file of files){
 const filename=path.join(app,file);
 if(!fs.existsSync(filename)){report.files[file]={exists:false};report.findings.push(`Missing: ${file}`);continue;}
 const lines=fs.readFileSync(filename,'utf8').split(/\r?\n/);
 const hits=[];
 for(let i=0;i<lines.length;i++){
  const line=lines[i];if(/^\s*(?:\/\/|\*|\/\*)/.test(line))continue;
  for(const [kind,regex] of Object.entries(patterns)){
   regex.lastIndex=0;if(regex.test(line))hits.push({line:i+1,kind,text:line.trim().slice(0,180)});
  }
 }
 report.files[file]={exists:true,lines:lines.length,hits};
}
const read=f=>fs.existsSync(path.join(app,f))?fs.readFileSync(path.join(app,f),'utf8'):'';
const evalSrc=read('src/evaluate.mjs'), server=read('app-server.mjs'), engine=read('src/quantum-decision-engine.mjs');
report.checks.quantumSwitch=/quantumMode\s*===\s*['"]ENFORCE['"]/.test(evalSrc);
report.checks.executionQuarantine=/MEMEFLOW_QUANTUM_MODE/.test(server)&&/executeTrade/.test(server);
report.checks.quantumEnginePresent=/export function quantumDecision\s*\(/.test(engine);
report.checks.legacyEvaluationPresent=/\bevaluate\s*\(/.test(server);
report.checks.policyBridgePresent=/__mfApplyV24PolicyBridge/.test(server);
report.checks.entryAdmissionPresent=/evaluateEntryAdmission/.test(server);
report.checks.patternProviderPresent=fs.existsSync(path.join(app,'src/quantum-pattern-provider.mjs'));
for(const [key,value] of Object.entries(report.checks))if(!value)report.findings.push(`Review: ${key} not verified by static scan`);
report.findings.push('Static inventory only. A matched call site is not proof of runtime reachability.');
report.findings.push('No live data, latency, wallet execution, or historical calibration validated.');
report.findings.push('Do not remove legacy code or enable automated trading based on this audit.');
console.log(JSON.stringify(report,null,2));
if(!report.checks.quantumEnginePresent||!report.checks.quantumSwitch)process.exitCode=1;
