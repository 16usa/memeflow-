// Observational shadow decision only. Never attached to executable decision/state.
const num=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v))?Number(v):null;
export function inspectStage29Decision({score,risk,observedPattern}={}){
 const s=num(score),r=num(risk),p=observedPattern;
 const base={mode:'SHADOW',authority:false,validated:false,executionAllowed:false,method:'QUANTUM_STAGE29_OBSERVATIONAL_V1'};
 if(s===null||r===null||r<0||r>100)return {...base,state:'WAITING',reason:'MISSING_OR_INVALID_QUANTUM_SCORE_RISK'};
 if(p?.ready!==true||p?.validated!==false||!['BULLISH','BEARISH','NEUTRAL'].includes(p?.direction))return {...base,state:'WAITING',reason:'INSUFFICIENT_OBSERVED_PATTERN'};
 if(p.direction==='BEARISH')return {...base,state:'BLOCKED',reason:'OBSERVED_DOWNTREND'};
 if(r>=60)return {...base,state:'BLOCKED',reason:'HIGH_RISK'};
 if(p.direction==='BULLISH'&&s>=70&&r<=25)return {...base,state:'CANDIDATE',reason:'SHADOW_CANDIDATE_UNVALIDATED'};
 return {...base,state:'WATCH',reason:'NO_SHADOW_ENTRY_CONSENSUS'};
}
