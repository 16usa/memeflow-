import {createHash} from 'node:crypto';
import {evaluate} from './evaluate.mjs';

// MEMEFLOW_LEGACY_EVALUATOR_ADAPTER_V21
// Historical API surface only. No independent evaluator remains.
export const DECISIONS=Object.freeze({
  BUY_READY:'BUY_READY',WATCH:'WATCH',WAITING:'WAITING',BLOCKED:'BLOCKED'
});

export function normalizeConfig(input={}){
  const n=(v,d)=>Number.isFinite(Number(v))?Number(v):d;
  const b=(v,d)=>typeof v==='boolean'?v:d;
  return Object.freeze({
    minScore:n(input.minScore,72),
    minConfidence:n(input.minConfidence,80),
    minLiquidityUsd:n(input.minLiquidityUsd,12000),
    minMarketCapUsd:n(input.minMarketCapUsd,10000),
    minHolders:n(input.minHolders,30),
    maxTop10Pct:n(input.maxTop10Pct??input.maxTop10,25),
    maxDeveloperPct:n(input.maxDeveloperPct??input.maxDeveloper,20),
    minBuyPressure:n(input.minBuyPressure,2),
    minTokenAgeMinutes:n(input.minTokenAgeMinutes??input.minAgeMin,1),
    maxTokenAgeMinutes:n(input.maxTokenAgeMinutes??input.maxAgeMin,150),
    requireFreshHolderSnapshot:b(input.requireFreshHolderSnapshot??input.requireFreshHolders,true),
    requireWebsiteOrX:b(input.requireWebsiteOrX??input.requireIdentity,false)
  });
}

export function configHash(config){
  return createHash('sha256').update(JSON.stringify(normalizeConfig(config))).digest('hex').slice(0,16);
}

function canonicalToken(token={}){
  const createdAt=
    Number.isFinite(Number(token?.createdAt))
      ?Number(token.createdAt)
      :Number.isFinite(Number(token?.ageMin))
        ?Date.now()-Number(token.ageMin)*60000
        :null;

  return {
    ...token,
    mint:token?.mint,
    priceSol:token?.priceSol??token?.price,
    liquidityUsd:token?.liquidityUsd,
    marketCapUsd:token?.marketCapUsd,
    holderCount:token?.holderCount??token?.holders,
    top10Pct:token?.top10Pct??token?.top10,
    developerPct:token?.developerPct??token?.developer,
    buyPressure:token?.buyPressure,
    holderFresh:token?.holderFresh??token?.holdersFresh,
    holderScannedAt:Number.isFinite(Number(token?.holderAgeSec))
      ?Date.now()-Number(token.holderAgeSec)*1000
      :token?.holderScannedAt,
    createdAt,
    opportunityEvidenceReady:token?.opportunityEvidenceReady===undefined
      ?true:token.opportunityEvidenceReady===true,
    opportunityTrendHealthy:token?.opportunityTrendHealthy===undefined
      ?true:token.opportunityTrendHealthy===true
  };
}

function legacyDecisionState(state){
  return String(state||'WAITING').trim().toUpperCase().replace(/\s+/g,'_');
}

export function evaluateToken(token,rawConfig){
  if(!token||!token.mint){
    return {
      decision:DECISIONS.BLOCKED,state:'BLOCKED',score:null,
      reasons:['INVALID_TOKEN'],scoreAuthority:'evaluate'
    };
  }
  const result=evaluate(canonicalToken(token),normalizeConfig(rawConfig));
  return {...result,decision:legacyDecisionState(result.state),scoreAuthority:'evaluate'};
}
