import {evaluateSettingsGate,tokenAgeMinutes} from './settings-gate.mjs';
import {qualityScoreFromToken} from './opportunity-engine.mjs';

// MEMEFLOW_UNIFIED_ANALYSIS_ENGINE_V21
// Scanner = facts. Opportunity engine = private signal extraction.
// evaluate() = the ONLY decision brain and public Score / State authority.

const clampScore=value=>Math.max(0,Math.min(100,Math.round(Number(value)||0)));
const finite=value=>value!==null&&value!==undefined&&value!==''&&Number.isFinite(Number(value));

function evidenceCompleteness(token={}){
  const components=[
    {key:'holders',available:finite(token.holderCount),points:20},
    {key:'top10',available:finite(token.top10Pct),points:20},
    {key:'developer',available:finite(token.developerPct),points:20},
    {key:'buyPressure',available:finite(token.buyPressure),points:20},
    {key:'verifiedPrice',available:finite(token.priceSol)&&Number(token.priceSol)>0,points:10},
    {key:'freshHolders',available:token.holderFresh===true,points:10}
  ];
  const value=components.reduce((sum,row)=>sum+(row.available?row.points:0),0);
  return {
    value:clampScore(value),
    components:components.map(row=>({...row,points:row.available?row.points:0,maxPoints:row.points}))
  };
}

export function evaluate(token,s={},options={}){
  const includePreOpenRisk=options?.includePreOpenRisk===true;
  const policy=evaluateSettingsGate(token,s,{includePreOpenRisk});
  const reasons=[...policy.reasons];

  // Private implementation signals. V21 deliberately preserves the calibrated
  // 60/40 formula so architecture changes do not silently move minScore.
  const qualitySignal=finite(token.qualityScore)
    ?clampScore(token.qualityScore)
    :qualityScoreFromToken(token).score;
  const opportunitySignal=finite(token.opportunityScore)
    ?clampScore(token.opportunityScore)
    :0;

  // THE ONE SCORE.
  const score=clampScore(qualitySignal*0.60+opportunitySignal*0.40);

  const evidence=evidenceCompleteness(token);
  const dataCompleteness=evidence.value;
  const confidence=dataCompleteness; // compatibility alias, not another score

  let priceWaiting=false,priceBlocked=false,priceStatus='PASS';
  if(token.priceSol==null){
    priceWaiting=true;priceStatus='WAITING';reasons.push('price unavailable');
  }else if(!finite(token.priceSol)||Number(token.priceSol)<=0){
    priceBlocked=true;priceStatus='FAIL';reasons.push('price unavailable');
  }

  const minimumScore=finite(s.minScore)?Number(s.minScore):null;
  const minimumDataCompleteness=finite(s.minConfidence)?Number(s.minConfidence):null;
  const scorePass=minimumScore===null?true:score>=minimumScore;
  const dataPass=minimumDataCompleteness===null?true:dataCompleteness>=minimumDataCompleteness;

  if(minimumScore!==null&&!scorePass){
    reasons.push(`Score ${score} below configured minimum ${minimumScore}`);
  }
  if(minimumDataCompleteness!==null&&!dataPass){
    reasons.push(`data completeness ${dataCompleteness}% below configured minimum ${minimumDataCompleteness}%`);
  }

  const walletRiskPending=
    includePreOpenRisk && (
      (finite(s.maxSuspectedRiskyWalletsPct)&&!finite(token.suspectedRiskyWalletsPct))||
      (finite(s.maxInsidersPct)&&!finite(token.insidersPct))
    );

  const dead=token.dead===true||Boolean(token.deadReason);
  const opportunityReady=token.opportunityEvidenceReady===true;
  const trendHealthy=token.opportunityTrendHealthy===true;

  if(dead)reasons.unshift(`token lifecycle dead: ${token.deadReason||'DEAD'}`);
  if(!opportunityReady)reasons.push('waiting for event-driven opportunity evidence');
  else if(!trendHealthy)reasons.push('live opportunity trend is not healthy');

  const stablePolicyFail=policy.failedGates.some(g=>g.retryable!==true);
  const retryablePolicyFail=policy.failedGates.some(g=>g.retryable===true);

  let state;
  if(dead||stablePolicyFail||priceBlocked){
    state='BLOCKED';
  }else if(policy.waiting||priceWaiting||!opportunityReady){
    state='WAITING';
  }else if(retryablePolicyFail||!trendHealthy){
    state='WATCH';
  }else if(scorePass&&dataPass){
    state='BUY READY';
  }else{
    state='WATCH';
  }

  const gates=[
    ...policy.gates,
    {
      name:'Verified price',key:'verifiedPrice',status:priceStatus,
      pass:priceStatus==='PASS',value:token.priceSol??null,threshold:'> 0',
      operator:'>',retryable:true,reason:'price unavailable',source:'priceSol'
    },
    {
      name:'Opportunity evidence',key:'opportunityEvidenceReady',
      status:opportunityReady?'PASS':'WAITING',pass:opportunityReady,
      value:token.opportunityEventCount??0,threshold:'event evidence',
      operator:'ready',retryable:true,source:'opportunityEngine'
    },
    {
      name:'Opportunity trend',key:'opportunityTrendHealthy',
      status:opportunityReady?(trendHealthy?'PASS':'FAIL'):'WAITING',
      pass:trendHealthy,value:trendHealthy,threshold:true,operator:'===',
      retryable:true,source:'opportunityEngine'
    },
    {
      name:'Minimum Score',key:'minScore',
      status:scorePass?'PASS':'FAIL',pass:scorePass,
      value:score,threshold:minimumScore,operator:'>=',
      retryable:true,source:'evaluate'
    },
    {
      name:'Minimum data completeness',key:'minConfidence',
      status:dataPass?'PASS':'FAIL',pass:dataPass,
      value:dataCompleteness,threshold:minimumDataCompleteness,operator:'>=',
      retryable:true,source:'evaluate'
    }
  ];

  return {
    analysisVersion:'MEMEFLOW_UNIFIED_ANALYSIS_V21',
    scoreAuthority:'evaluate',
    state,
    score,

    // MEMEFLOW_CANONICAL_SCORE_COMPAT_ALIASES_V21_4
    // Historical fields are preserved as aliases only. They never calculate
    // or expose another decision score.
    scoreBeforeWalletRisk:score,
    walletRiskPenalty:0,

    confidence,
    dataCompleteness,
    aiQuality:{
      model:'MEMEFLOW_UNIFIED_ANALYSIS_V21',
      score,
      confidence,
      dataCompleteness,
      components:token.opportunityComponents||[]
    },

    opportunityEvidenceReady:opportunityReady,
    opportunityTrendHealthy:trendHealthy,
    walletRiskPending,
    walletRisk:{
      suspectedRiskyWalletsPct:finite(token.suspectedRiskyWalletsPct)?Number(token.suspectedRiskyWalletsPct):null,
      insidersPct:finite(token.insidersPct)?Number(token.insidersPct):null,
      scannedAt:token.walletClusterRiskScannedAt??null,
      version:token.walletClusterRiskVersion??null
    },
    reasons,
    primaryReason:reasons[0]||'All configured safety gates passed and live opportunity is healthy',
    settingsEvaluation:{
      state:policy.state,
      minScore:minimumScore,
      minConfidence:minimumDataCompleteness,
      gates,
      failedGates:policy.failedGates,
      waitingGates:policy.waitingGates,
      hasRetryableFailure:policy.hasRetryableFailure,
      hasStableFailure:policy.hasStableFailure
    }
  };
}

export {tokenAgeMinutes};
