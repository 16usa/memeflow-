#!/usr/bin/env node
// Stage 18: source-only integration audit. Never imports the app or touches wallets.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

export function auditIntegration({root,readFile=fs.readFileSync}={}) {
  if(!root) root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
  const checks=[];
  const add=(name,pass,detail='')=>checks.push({name,pass:Boolean(pass),...(detail?{detail}:{})});
  const load=(rel)=>{
    try{return readFile(path.join(root,rel),'utf8');}
    catch(e){add(`Source present: ${rel}`,false,e.code||e.message);return '';}
  };
  const app=load('app-server.mjs');
  const decisionFiles=[
    'src/controlled-policy-bridge-v24_0.mjs',
    'src/token-intelligence-scorecard-v23_15.mjs'
  ];
  const policy=load(decisionFiles[0]);
  const scorecard=load(decisionFiles[1]);
  const quantumMode=/MEMEFLOW_QUANTUM_MODE\s*\|\|\s*['"]SHADOW['"]/.test(app);
  add('Quantum mode defaults to SHADOW',quantumMode);
  add('BUY execution gate exists',/function\s+__mfQuantumExecutionBuyGate\s*\(/.test(app));
  add('Execution gate is BUY-only',/String\(side\|\|['"]['"]\).*?BUY/s.test(app));
  add('Quantum execution gate rejects unsafe buys',/QUANTUM_EXECUTION_BUY_BLOCKED/.test(app));
  add('OpenAI trade callback passes through gate',/executeTrade\s*:\s*async\s*\(args\)\s*=>\s*\{\s*__mfQuantumExecutionBuyGate\(/s.test(app));
  add('Direct D5 trade passes through gate',/__mfQuantumExecutionBuyGate\(\{uid:u\.id,mint,side\}\);\s*const result\s*=\s*await\s+__mfSmartVaultD4\.executeTrade/s.test(app));
  add('V24 bridge retains explicit kill switch',/killSwitch/.test(policy)&&/MEMEFLOW_V24_POLICY_BRIDGE_KILL_SWITCH/.test(app));
  add('V24 bridge defaults OFF',/MEMEFLOW_V24_POLICY_BRIDGE_MODE\s*\|\|\s*['"]OFF['"]/.test(app));
  add('V23 scorecard remains diagnostic',/READ.ONLY|read.only|diagnostic/i.test(scorecard));
  // Functional authority checks: a gate alone is insufficient to establish that
  // all three quantum components affect decisions rather than only display.
  const decisionSlice=app.slice(0,Math.max(app.indexOf('const opportunityEngine='),0)+6000);
  add('Quantum Score wired into decision authority',/quantumScore|quantum_score/i.test(decisionSlice)&&/quantumScore|quantum_score/i.test(policy));
  add('Quantum Risk wired into decision authority',/quantumRisk|quantum_risk/i.test(decisionSlice)&&/quantumRisk|quantum_risk/i.test(policy));
  add('Quantum Pattern wired into decision authority',/quantumPattern|quantum_pattern/i.test(decisionSlice)&&/quantumPattern|quantum_pattern/i.test(policy));
  add('Shadow/Paper outcome validation present',/quantum.*(?:paper|outcome|backtest)|(?:paper|outcome|backtest).*quantum/i.test(policy));
  const failed=checks.filter(c=>!c.pass);
  return {stage:18,mode:'READ_ONLY_SOURCE_AUDIT',liveReady:false,liveTradingValidated:false,
    networkCalls:0,transactions:0,passed:checks.length-failed.length,failed:failed.length,
    checks,limitations:['Source pattern checks are not proof of runtime behavior.',
      'A failed authority check requires implementation review, not bypassing a gate.',
      'Do not enable ENFORCE based on this audit.']};
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const report=auditIntegration();
  console.log(JSON.stringify(report,null,2));
  if(report.failed)process.exitCode=1;
}
