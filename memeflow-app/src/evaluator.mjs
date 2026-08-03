import { createHash } from 'node:crypto';

export const DECISIONS = Object.freeze({ BUY_READY:'BUY_READY', WATCH:'WATCH', WAITING:'WAITING', BLOCKED:'BLOCKED' });

export function normalizeConfig(input={}) {
  const n=(v,d)=>Number.isFinite(Number(v))?Number(v):d;
  const b=(v,d)=>typeof v==='boolean'?v:d;
  return Object.freeze({
    minScore:n(input.minScore,72), minConfidence:n(input.minConfidence,80),
    minLiquidityUsd:n(input.minLiquidityUsd,12000), minMarketCapUsd:n(input.minMarketCapUsd,10000),
    minHolders:n(input.minHolders,30), maxTop10:n(input.maxTop10,25), maxDeveloper:n(input.maxDeveloper,20),
    minBuyPressure:n(input.minBuyPressure,2), minAgeMin:n(input.minAgeMin,1), maxAgeMin:n(input.maxAgeMin,150),
    requireFreshHolders:b(input.requireFreshHolders,true), requireIdentity:b(input.requireIdentity,false),
    freshnessSec:n(input.freshnessSec,15), mode:String(input.mode||'Observe')
  });
}

export function configHash(config){
  return createHash('sha256').update(JSON.stringify(normalizeConfig(config))).digest('hex').slice(0,16);
}

export function evaluateToken(token, rawConfig){
  const c=normalizeConfig(rawConfig);
  if (!token || !token.mint) return {decision:DECISIONS.BLOCKED,reasons:['INVALID_TOKEN']};
  const missing=[];
  for (const key of ['score','confidence','liquidityUsd','marketCapUsd','holders','top10','developer','buyPressure','ageMin']) {
    if (!Number.isFinite(token[key])) missing.push(key);
  }
  if (c.requireFreshHolders && (!token.holdersFresh || !Number.isFinite(token.holderAgeSec) || token.holderAgeSec>c.freshnessSec)) missing.push('freshHolders');
  if (missing.length) return {decision:DECISIONS.WAITING,reasons:[...new Set(missing.map(x=>`MISSING_${x.toUpperCase()}`))]};
  const hard=[];
  if (token.top10>c.maxTop10) hard.push('TOP10');
  if (token.developer>c.maxDeveloper) hard.push('DEVELOPER');
  if (token.ageMin>c.maxAgeMin) hard.push('TOO_OLD');
  if (c.requireIdentity && !token.hasIdentity) hard.push('IDENTITY');
  if (token.securityBlocked) hard.push('SECURITY');
  if (hard.length) return {decision:DECISIONS.BLOCKED,reasons:hard};
  const pass={
    score:token.score>=c.minScore, confidence:token.confidence>=c.minConfidence,
    liquidity:token.liquidityUsd>=c.minLiquidityUsd, marketCap:token.marketCapUsd>=c.minMarketCapUsd,
    holders:token.holders>=c.minHolders, buyPressure:token.buyPressure>=c.minBuyPressure,
    age:token.ageMin>=c.minAgeMin
  };
  const passed=Object.values(pass).filter(Boolean).length;
  if (passed===Object.keys(pass).length) return {decision:DECISIONS.BUY_READY,reasons:['ALL_GATES_PASS'],pass};
  if (passed>=5 && pass.liquidity && pass.marketCap && pass.age) return {decision:DECISIONS.WATCH,reasons:Object.entries(pass).filter(([,v])=>!v).map(([k])=>k.toUpperCase()),pass};
  return {decision:DECISIONS.BLOCKED,reasons:Object.entries(pass).filter(([,v])=>!v).map(([k])=>k.toUpperCase()),pass};
}
