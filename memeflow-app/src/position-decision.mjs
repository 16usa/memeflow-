import {evaluate} from './evaluate.mjs';

// MEMEFLOW_UNIFIED_POSITION_DECISION_V22
// One lifecycle brain for every OPEN position.
// evaluate() remains the ONLY canonical Score/State authority.
// This module converts current facts + canonical assessment into one
// execution-neutral lifecycle decision: HOLD / REDUCE / CLOSE.

const finite=value=>{
  if(value===null||value===undefined||value==='')return null;
  const n=Number(value);
  return Number.isFinite(n)?n:null;
};

const clamp=(value,min,max)=>Math.max(min,Math.min(max,Number(value)||0));

export const POSITION_DECISION_PRIORITY_V22=Object.freeze({
  EMERGENCY:900,
  HARD_STOP:800,
  TRAILING_STOP:700,
  TAKE_PROFIT:600,
  DETERIORATION:500,
  MAX_HOLD:400,
  WEAK_PRESSURE:300,
  HOLD:0
});

export const POSITION_DETERIORATION_POLICY_V22=Object.freeze({
  minimumScoreDrop:25,
  minimumDrawdownFromPeakPct:20
});

function safeAssessment(token,settings,currentDecision){
  if(currentDecision&&typeof currentDecision==='object'){
    return currentDecision;
  }
  try{
    return evaluate(token,settings);
  }catch{
    return {
      state:'WAITING',
      score:null,
      scoreAvailable:false,
      scoreFresh:false,
      scoreSource:'unavailable',
      primaryReason:'Current canonical assessment unavailable'
    };
  }
}

function closeDecision(reason,priority,metrics,assessment,code){
  return {
    version:'MEMEFLOW_POSITION_DECISION_V22',
    action:'CLOSE',
    reason,
    code,
    priority,
    actions:[{type:'CLOSE',reason,code}],
    metrics,
    assessment
  };
}

export function evaluatePositionDecision({
  position={},
  token={},
  settings={},
  currentDecision=null,
  now=Date.now()
}={}){
  const price=finite(token.priceSol);
  const entryPrice=finite(position.entryPriceSol);
  const previousHigh=finite(position.highestPriceSol);
  const highestPrice=
    price!==null
      ? Math.max(previousHigh??price,price)
      : previousHigh;

  const remainingQuantity=Math.max(0,finite(position.remainingTokenQuantity)??0);
  const profitPct=
    price!==null&&entryPrice!==null&&entryPrice>0
      ? ((price/entryPrice)-1)*100
      : null;

  const trailingStopPct=Math.max(0,finite(settings.trailingStopPct)??15);
  let trailingStopPrice=finite(position.trailingStopPriceSol);

  if(
    price!==null &&
    profitPct!==null &&
    profitPct>0 &&
    trailingStopPct>0 &&
    highestPrice!==null
  ){
    trailingStopPrice=
      highestPrice*(1-trailingStopPct/100);
  }

  const assessment=safeAssessment(token,settings,currentDecision);
  const currentScore=finite(assessment?.score);
  const entryScore=finite(position.decisionScore);
  const scoreDelta=
    currentScore!==null&&entryScore!==null
      ? currentScore-entryScore
      : null;

  const openedAt=finite(position.openedAtMs);
  const heldMinutes=
    openedAt!==null&&finite(now)!==null
      ? Math.max(0,(Number(now)-openedAt)/60000)
      : null;

  const buyPressure=finite(token.buyPressure);
  const recentNetFlowSol=finite(token.recentNetFlowSol);
  const drawdownFromPeakPct=finite(token.drawdownFromPeakPct);

  const metrics={
    priceSol:price,
    entryPriceSol:entryPrice,
    profitPct,
    highestPriceSol:highestPrice,
    trailingStopPriceSol:trailingStopPrice,
    heldMinutes,
    remainingTokenQuantity:remainingQuantity,
    entryScore,
    currentScore,
    scoreDeltaFromEntry:scoreDelta,
    currentState:String(assessment?.state||'WAITING'),
    scoreFresh:assessment?.scoreFresh===true,
    scoreSource:assessment?.scoreSource||null,
    buyPressure,
    recentNetFlowSol,
    drawdownFromPeakPct,
    opportunityEvidenceReady:token.opportunityEvidenceReady===true,
    opportunityTrendHealthy:token.opportunityTrendHealthy===true
  };

  const deadReason=String(token.deadReason||'').trim();
  if(token.dead===true||deadReason){
    return closeDecision(
      `EMERGENCY EXIT${deadReason?`: ${deadReason}`:''}`,
      POSITION_DECISION_PRIORITY_V22.EMERGENCY,
      metrics,
      assessment,
      'EMERGENCY_EXIT'
    );
  }

  const hardStopPct=Math.max(0,finite(settings.hardStopPct)??25);
  if(profitPct!==null&&profitPct<=-hardStopPct){
    return closeDecision(
      'HARD STOP',
      POSITION_DECISION_PRIORITY_V22.HARD_STOP,
      metrics,
      assessment,
      'HARD_STOP'
    );
  }

  if(
    price!==null &&
    trailingStopPrice!==null &&
    price<=trailingStopPrice
  ){
    return closeDecision(
      'TRAILING STOP',
      POSITION_DECISION_PRIORITY_V22.TRAILING_STOP,
      metrics,
      assessment,
      'TRAILING_STOP'
    );
  }

  const actions=[];
  const tp1Pct=Math.max(0,finite(settings.tp1Pct)??100);
  const tp2Pct=Math.max(0,finite(settings.tp2Pct)??200);
  const tp1SellPct=clamp(finite(settings.tp1SellPct)??50,0,100);
  const tp2SellPct=clamp(finite(settings.tp2SellPct)??25,0,100);

  if(
    profitPct!==null &&
    position.tp1Executed!==true &&
    profitPct>=tp1Pct &&
    tp1SellPct>0
  ){
    actions.push({
      type:'PARTIAL_EXIT',
      reason:'TP1',
      code:'TP1',
      percentOfInitial:tp1SellPct
    });
  }

  if(
    profitPct!==null &&
    position.tp2Executed!==true &&
    profitPct>=tp2Pct &&
    tp2SellPct>0
  ){
    actions.push({
      type:'PARTIAL_EXIT',
      reason:'TP2',
      code:'TP2',
      percentOfInitial:tp2SellPct
    });
  }

  if(actions.length){
    return {
      version:'MEMEFLOW_POSITION_DECISION_V22',
      action:'REDUCE',
      reason:actions.map(x=>x.reason).join(' + '),
      code:'TAKE_PROFIT',
      priority:POSITION_DECISION_PRIORITY_V22.TAKE_PROFIT,
      actions,
      metrics,
      assessment
    };
  }

  // Conservative deterioration exit: do not sell merely because an entry gate
  // changed. Require a large canonical Score deterioration PLUS unhealthy live
  // opportunity, negative recent flow and meaningful peak drawdown.
  const deterioration=
    token.opportunityEvidenceReady===true &&
    token.opportunityTrendHealthy===false &&
    scoreDelta!==null &&
    scoreDelta<=-POSITION_DETERIORATION_POLICY_V22.minimumScoreDrop &&
    recentNetFlowSol!==null &&
    recentNetFlowSol<0 &&
    drawdownFromPeakPct!==null &&
    drawdownFromPeakPct>=POSITION_DETERIORATION_POLICY_V22.minimumDrawdownFromPeakPct;

  if(deterioration){
    return closeDecision(
      'DETERIORATION EXIT',
      POSITION_DECISION_PRIORITY_V22.DETERIORATION,
      metrics,
      assessment,
      'DETERIORATION_EXIT'
    );
  }

  const maxHoldMinutes=Math.max(1,finite(settings.maxHoldMinutes)??1440);
  if(heldMinutes!==null&&heldMinutes>=maxHoldMinutes){
    return closeDecision(
      'MAX HOLD TIME',
      POSITION_DECISION_PRIORITY_V22.MAX_HOLD,
      metrics,
      assessment,
      'MAX_HOLD_TIME'
    );
  }

  const exitOnWeakBuyPressure=settings.exitOnWeakBuyPressure!==false;
  const exitBuyPressure=Math.max(0,finite(settings.exitBuyPressure)??1);

  if(
    exitOnWeakBuyPressure &&
    buyPressure!==null &&
    buyPressure<exitBuyPressure
  ){
    return closeDecision(
      'BUY PRESSURE EXIT',
      POSITION_DECISION_PRIORITY_V22.WEAK_PRESSURE,
      metrics,
      assessment,
      'BUY_PRESSURE_EXIT'
    );
  }

  return {
    version:'MEMEFLOW_POSITION_DECISION_V22',
    action:'HOLD',
    reason:'HOLD',
    code:'HOLD',
    priority:POSITION_DECISION_PRIORITY_V22.HOLD,
    actions:[],
    metrics,
    assessment
  };
}
