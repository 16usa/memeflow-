from pathlib import Path
import shutil, sys
p=Path('memeflow-app/src/quantum-decision-engine.mjs')
s=p.read_text()
marker='// MEMEFLOW_QUANTUM_STAGE9_SETTINGS_AUTHORITY'
if marker in s:
 print('Stage 9 already installed');sys.exit(0)
anchor='  const patternReady=pattern.ready===true && probability!==null && patternConfidence!==null;'
assert s.count(anchor)==1, 'Unexpected Quantum Engine version; no files modified'
s=s.replace(anchor,'''  // MEMEFLOW_QUANTUM_STAGE9_SETTINGS_AUTHORITY
  // Settings are constraints on the new decision, never a second score.
  const minScore=num(settings.minScore);
  const minData=num(settings.minConfidence);
  const maxWalletRisk=num(settings.maxSuspectedRiskyWalletsPct);
  const maxInsiders=num(settings.maxInsidersPct);
  const settingsMissing=finalSettingsUnavailable(settings,token);
  const scoreBelowMin=minScore!==null && score!==null && score<minScore;
  const dataBelowMin=minData!==null && completeness<minData;
  const walletThresholdExceeded=maxWalletRisk!==null && riskWallets!==null && riskWallets>maxWalletRisk;
  const insiderThresholdExceeded=maxInsiders!==null && insiders!==null && insiders>maxInsiders;
  const patternReady=pattern.ready===true && probability!==null && patternConfidence!==null;''')
anchor2="  else if(!patternReady){reasons.push('historical pattern evidence unavailable');}"
assert s.count(anchor2)==1, 'Unexpected decision flow; no files modified'
s=s.replace(anchor2,'''  else if(walletThresholdExceeded || insiderThresholdExceeded){state='BLOCKED';reasons.push('configured wallet safety limit exceeded');}
  else if(settingsMissing){reasons.push('configured wallet safety evidence unavailable');}
  else if(scoreBelowMin || dataBelowMin){state='WATCH';reasons.push('configured quantum score or evidence minimum not met');}
  else if(!patternReady){reasons.push('historical pattern evidence unavailable');}''')
anchor3='export function quantumDecision(token={}, settings={}, intelligence={}) {'
assert s.count(anchor3)==1
s=s.replace(anchor3,'''function finalSettingsUnavailable(settings,token){
  return (num(settings.maxSuspectedRiskyWalletsPct)!==null && num(token.suspectedRiskyWalletsPct)===null) ||
    (num(settings.maxInsidersPct)!==null && num(token.insidersPct)===null);
}
export function quantumDecision(token={}, settings={}, intelligence={}) {''')
anchor4='settingsEvaluation:{state,minScore:null,minConfidence:null,gates:[],failedGates:[],waitingGates:[],hasRetryableFailure:false,hasStableFailure:false}'
assert s.count(anchor4)==1
s=s.replace(anchor4,'settingsEvaluation:{state,minScore,minConfidence:minData,gates:[],failedGates:[],waitingGates:[],hasRetryableFailure:false,hasStableFailure:false}')
backup=p.with_name(p.name+'.pre-quantum-stage9.bak')
if not backup.exists():shutil.copy2(p,backup)
p.write_text(s)
print('Stage 9 installed: Quantum settings constraints integrated; no server restart or trading changes')
