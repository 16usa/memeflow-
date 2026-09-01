import {evaluateSettingsGate,tokenAgeMinutes} from './settings-gate.mjs';
import {qualityScoreFromToken} from './opportunity-engine.mjs';

const clampScore=value=>Math.max(0,Math.min(100,Math.round(Number(value)||0)));
const finite=value=>value!==null&&value!==undefined&&value!==''&&Number.isFinite(Number(value));

function independentEvidenceConfidence(token={}){
  const components=[
    {key:'holders',available:finite(token.holderCount),points:20},
    {key:'top10',available:finite(token.top10Pct),points:20},
    {key:'developer',available:finite(token.developerPct),points:20},
    {key:'buyPressure',available:finite(token.buyPressure),points:20},
    {key:'verifiedPrice',available:finite(token.priceSol)&&Number(token.priceSol)>0,points:10},
    {key:'freshHolders',available:token.holderFresh===true,points:10},
  ];
  const confidence=components.reduce((s,c)=>s+(c.available?c.points:0),0);
  return {
    confidence:clampScore(confidence),
    components:components.map(c=>({...c,points:c.available?c.points:0,maxPoints:c.points}))
  };
}

export function evaluate(token,s={},options={}){
  const includePreOpenRisk=
    options?.includePreOpenRisk===true;
  const policy=evaluateSettingsGate(
    token,
    s,
    {includePreOpenRisk}
  );
  const reasons=[...policy.reasons];

  const qualityScore=finite(token.qualityScore)
    ?clampScore(token.qualityScore)
    :qualityScoreFromToken(token).score;
  const opportunityScore=finite(token.opportunityScore)?clampScore(token.opportunityScore):0;
  const score=clampScore(qualityScore*0.60+opportunityScore*0.40);

  const evidence=independentEvidenceConfidence(token);
  const confidence=evidence.confidence;

  let priceWaiting=false,priceBlocked=false,priceStatus='PASS';
  if(token.priceSol==null){
    priceWaiting=true;priceStatus='WAITING';reasons.push('price unavailable');
  }else if(!finite(token.priceSol)||Number(token.priceSol)<=0){
    priceBlocked=true;priceStatus='FAIL';reasons.push('price unavailable');
  }

  const minimumAiScore=finite(s.minScore)?Number(s.minScore):null;
  const minimumConfidence=finite(s.minConfidence)?Number(s.minConfidence):null;
  const aiScorePass=minimumAiScore===null?true:score>=minimumAiScore;
  const confidencePass=minimumConfidence===null?true:confidence>=minimumConfidence;

  if(minimumAiScore!==null&&!aiScorePass)reasons.push(`AI score ${score} below configured minimum ${minimumAiScore}`);
  if(minimumConfidence!==null&&!confidencePass)reasons.push(`confidence ${confidence}% below configured minimum ${minimumConfidence}%`);

  const walletRiskPending=
    includePreOpenRisk && (
      (finite(s.maxSuspectedRiskyWalletsPct)&&!finite(token.suspectedRiskyWalletsPct))||
      (finite(s.maxInsidersPct)&&!finite(token.insidersPct))
    );

  const dead=token.dead===true||Boolean(token.deadReason);
  const opportunityReady=token.opportunityEvidenceReady===true;
  const trendHealthy=token.opportunityTrendHealthy===true;
  const opportunityFloor=45;
  const opportunityFloorPass=opportunityScore>=opportunityFloor;

  if(dead)reasons.unshift(`token lifecycle dead: ${token.deadReason||'DEAD'}`);
  if(!opportunityReady)reasons.push('waiting for event-driven opportunity evidence');
  else{
    if(!trendHealthy)reasons.push('live opportunity trend is not healthy');
    if(!opportunityFloorPass)reasons.push(`opportunity score ${opportunityScore} below internal safety floor ${opportunityFloor}`);
  }

  const stablePolicyFail=policy.failedGates.some(g=>g.retryable!==true);
  const retryablePolicyFail=policy.failedGates.some(g=>g.retryable===true);

  let state;
  if(dead||stablePolicyFail||priceBlocked){
    state='BLOCKED';
  }else if(policy.waiting||priceWaiting||!opportunityReady){
    state='WAITING';
  }else if(retryablePolicyFail||!trendHealthy||!opportunityFloorPass){
    state='WATCH';
  }else if(aiScorePass&&confidencePass){
    state='BUY READY';
  }else{
    state='WATCH';
  }

  const gates=[
    ...policy.gates,
    {
      name:'Verified price',key:'verifiedPrice',status:priceStatus,pass:priceStatus==='PASS',
      value:token.priceSol??null,threshold:'> 0',operator:'>',retryable:true,
      reason:'price unavailable',source:'priceSol'
    },
    {
      name:'Opportunity evidence',key:'opportunityEvidenceReady',
      status:opportunityReady?'PASS':'WAITING',pass:opportunityReady,
      value:token.opportunityEventCount??0,threshold:'event evidence',operator:'ready',
      retryable:true,source:'opportunityEngine'
    },
    {
      name:'Opportunity trend',key:'opportunityTrendHealthy',
      status:opportunityReady?(trendHealthy?'PASS':'FAIL'):'WAITING',pass:trendHealthy,
      value:trendHealthy,threshold:true,operator:'===',retryable:true,source:'opportunityEngine'
    },
    {
      name:'Opportunity safety floor',key:'opportunityScore',
      status:opportunityReady?(opportunityFloorPass?'PASS':'FAIL'):'WAITING',pass:opportunityFloorPass,
      value:opportunityScore,threshold:opportunityFloor,operator:'>=',retryable:true,source:'opportunityEngine'
    },
    {
      name:'Minimum AI score',key:'minScore',status:aiScorePass?'PASS':'FAIL',pass:aiScorePass,
      value:score,threshold:minimumAiScore,operator:'>=',retryable:true
    },
    {
      name:'Minimum confidence',key:'minConfidence',status:confidencePass?'PASS':'FAIL',pass:confidencePass,
      value:confidence,threshold:minimumConfidence,operator:'>=',retryable:true
    }
  ];

  return {
    state,
    score,
    qualityScore,
    opportunityScore,
    opportunityEvidenceReady:opportunityReady,
    opportunityTrendHealthy:trendHealthy,
    opportunityFloor,
    scoreBeforeWalletRisk:score,
    walletRiskPenalty:0,
    walletRiskPending,
    walletRisk:{
      suspectedRiskyWalletsPct:finite(token.suspectedRiskyWalletsPct)?Number(token.suspectedRiskyWalletsPct):null,
      insidersPct:finite(token.insidersPct)?Number(token.insidersPct):null,
      scannedAt:token.walletClusterRiskScannedAt??null,
      version:token.walletClusterRiskVersion??null
    },
    confidence,
    reasons,
    primaryReason:reasons[0]||'All configured safety gates passed and live opportunity is healthy',
    aiQuality:{
      model:'MEMEFLOW_OPPORTUNITY_V1',
      score,qualityScore,opportunityScore,confidence,
      components:token.opportunityComponents||[],
      confidenceComponents:evidence.components
    },
    settingsEvaluation:{
      state:policy.state,
      minScore:minimumAiScore,
      minConfidence:minimumConfidence,
      gates,
      failedGates:policy.failedGates,
      waitingGates:policy.waitingGates,
      hasRetryableFailure:policy.hasRetryableFailure,
      hasStableFailure:policy.hasStableFailure
    }
  };
}
export {tokenAgeMinutes};
