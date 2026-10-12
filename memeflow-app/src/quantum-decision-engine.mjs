import {assessQuantumEntry} from './quantum-stage19-policy.mjs';
// MEMEFLOW_QUANTUM_STAGE19_POLICY
// Memflow Quantum Decision Engine v1 — classical computation, no quantum hardware.
// Pure function: no wallet access, no order execution, no external I/O.
const num = x => x === null || x === undefined || x === '' || !Number.isFinite(Number(x)) ? null : Number(x);
const clamp = x => Math.max(0, Math.min(100, Math.round(x)));
const average = values => values.reduce((a,b)=>a+b,0)/values.length;
function finalSettingsUnavailable(settings,token){
  return (num(settings.maxSuspectedRiskyWalletsPct)!==null && num(token.suspectedRiskyWalletsPct)===null) ||
    (num(settings.maxInsidersPct)!==null && num(token.insidersPct)===null);
}
export function quantumDecision(token={}, settings={}, intelligence={}) {
  const reasons=[];
  const price=num(token.priceSol);
  const holders=num(token.holderCount);
  const top10=num(token.top10Pct);
  const developer=num(token.developerPct);
  const pressure=num(token.buyPressure);
  const riskWallets=num(token.suspectedRiskyWalletsPct);
  const insiders=num(token.insidersPct);
  const pattern=intelligence?.shadowTokenPattern || intelligence?.snapshot?.shadowTokenPattern || {};
  const probability=num(pattern.patternProbabilityPositivePct);
  const patternConfidence=num(pattern.matchConfidencePct);
  const features=[holders,top10,developer,pressure].filter(v=>v!==null);
  const completeness=clamp(100*features.length/4);
  const riskParts=[];
  if(top10!==null) riskParts.push(clamp(top10*1.2));
  if(developer!==null) riskParts.push(clamp(developer*2));
  if(riskWallets!==null) riskParts.push(clamp(riskWallets));
  if(insiders!==null) riskParts.push(clamp(insiders));
  const risk=riskParts.length ? clamp(average(riskParts)) : null;
  const base=pressure===null?null:clamp(50+pressure/2);
  const score=base===null ? null : clamp(base*(1-(risk??50)/200));
  // MEMEFLOW_QUANTUM_STAGE9_SETTINGS_AUTHORITY
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
  const patternReady=pattern.ready===true && probability!==null && patternConfidence!==null;
  // MEMEFLOW_QUANTUM_STAGE5_GUARDS
  // Final pre-open checks are execution safety, NOT a competing legacy score.
  const finalPreOpen=intelligence?.__quantumPreOpen===true;
  const bullish=patternReady && probability>=60 && patternConfidence>=40;
  const bearish=patternReady && probability<=35 && patternConfidence>=40;
  let state='WAITING';
  if(token.dead===true || token.deadReason){state='BLOCKED';reasons.push('token lifecycle dead');}
  else if(price!==null && price<=0){state='BLOCKED';reasons.push('invalid price');}
  else if(price===null){reasons.push('price unavailable');}
  else if(score===null || risk===null || completeness<75){reasons.push('insufficient live evidence');}
  else if(risk>=75){state='BLOCKED';reasons.push('high concentration or wallet risk');}
  else if(finalPreOpen && (
    (num(settings.maxSuspectedRiskyWalletsPct)!==null && (riskWallets===null || riskWallets>num(settings.maxSuspectedRiskyWalletsPct))) ||
    (num(settings.maxInsidersPct)!==null && (insiders===null || insiders>num(settings.maxInsidersPct)))
  )){state='BLOCKED';reasons.push('final pre-open wallet safety check failed or unavailable');}
  else if(walletThresholdExceeded || insiderThresholdExceeded){state='BLOCKED';reasons.push('configured wallet safety limit exceeded');}
  else if(settingsMissing){reasons.push('configured wallet safety evidence unavailable');}
  else if(scoreBelowMin || dataBelowMin){state='WATCH';reasons.push('configured quantum score or evidence minimum not met');}
  else if(!patternReady){reasons.push('historical pattern evidence unavailable');}
  else if(bearish){state='WATCH';reasons.push('historical pattern bearish');}
  else if(score>=70 && risk<=35 && bullish){state='BUY READY';}
  else {state='WATCH';reasons.push('entry conditions not met');}
  // All three signals now drive a single conservative entry authority.
  // Existing lifecycle, price and evidence blocks remain authoritative.
  const stage19=assessQuantumEntry({score,risk,pattern:{ready:patternReady,probability,confidence:patternConfidence}});
  if(state==='BUY READY'&&!stage19.eligible){state=stage19.proposedState;reasons.push(...stage19.reasons);}
  return {
    analysisVersion:'MEMEFLOW_QUANTUM_V1',scoreAuthority:'quantum-decision-engine',
    score,scoreAvailable:score!==null,scoreFresh:score!==null,scoreSource:'quantum-live',
    scoreBeforeWalletRisk:score,walletRiskPenalty:0,
    stage19Policy:stage19,
    state,confidence:completeness,dataCompleteness:completeness,
    quantum:{score,risk,pattern:{ready:patternReady,probability,confidence:patternConfidence,direction:bullish?'BULLISH':bearish?'BEARISH':'UNKNOWN'}},
    aiQuality:{model:'MEMEFLOW_QUANTUM_V1',score,confidence:completeness,dataCompleteness:completeness,components:[]},
    opportunityEvidenceReady:score!==null,opportunityTrendHealthy:bullish,
    walletRiskPending:risk===null,walletRisk:{suspectedRiskyWalletsPct:riskWallets,insidersPct:insiders,scannedAt:token.walletClusterRiskScannedAt??null,version:token.walletClusterRiskVersion??null},
    reasons,primaryReason:reasons[0]||'Quantum criteria passed',
    settingsEvaluation:{state,minScore,minConfidence:minData,gates:[],failedGates:[],waitingGates:[],hasRetryableFailure:false,hasStableFailure:false}
  };
}
