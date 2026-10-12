// Stage 19: deterministic three-signal entry policy. No I/O, orders or network.
const finite=x=>x!==null&&x!==undefined&&x!==''&&Number.isFinite(Number(x))?Number(x):null;
export function assessQuantumEntry(quantum={}){
  const score=finite(quantum?.score),risk=finite(quantum?.risk);
  const pattern=quantum?.pattern||{};
  const probability=finite(pattern.probability),confidence=finite(pattern.confidence);
  const complete=score!==null&&risk!==null&&pattern.ready===true&&probability!==null&&confidence!==null;
  const reasons=[];
  if(!complete)reasons.push('QUANTUM_EVIDENCE_INCOMPLETE');
  if(risk!==null&&risk>=75)reasons.push('QUANTUM_RISK_HIGH');
  if(score!==null&&score<70)reasons.push('QUANTUM_SCORE_LOW');
  if(complete&&(probability<60||confidence<40))reasons.push('QUANTUM_PATTERN_NOT_CONFIRMED');
  const eligible=complete&&reasons.length===0&&risk<=35;
  if(complete&&risk>35&&risk<75)reasons.push('QUANTUM_RISK_ABOVE_ENTRY_THRESHOLD');
  return {version:'MEMEFLOW_QUANTUM_STAGE19',eligible,complete,score,risk,pattern:{probability,confidence,ready:pattern.ready===true},reasons,proposedState:!complete?'WAITING':risk>=75?'BLOCKED':eligible?'BUY READY':'WATCH'};
}
// Shadow/paper outcome evaluator. The label must come from a future observed result,
// not from the entry prediction. No real trades, synthetic profit or promises.
export function validatePaperOutcomes(rows=[]){
  const eligible=rows.filter(x=>x&&typeof x==='object'&&typeof x.predictedEligible==='boolean'&&typeof x.observedPositive==='boolean');
  const tp=eligible.filter(x=>x.predictedEligible&&x.observedPositive).length;
  const fp=eligible.filter(x=>x.predictedEligible&&!x.observedPositive).length;
  const tn=eligible.filter(x=>!x.predictedEligible&&!x.observedPositive).length;
  const fn=eligible.filter(x=>!x.predictedEligible&&x.observedPositive).length;
  return {sampleSize:eligible.length,excluded:rows.length-eligible.length,tp,fp,tn,fn,precision:tp+fp?tp/(tp+fp):null,recall:tp+fn?tp/(tp+fn):null,validated:eligible.length>=100};
}
