export const TOKEN_CLEANUP_MAX_AGE_MS=30*60*1000;

export function tokenPriceDropPercent(token){
  if(
    token?.peakPriceSol==null ||
    token?.priceSol==null ||
    token.peakPriceSol==='' ||
    token.priceSol===''
  )return null;
  const peak=Number(token?.peakPriceSol);
  const price=Number(token?.priceSol);
  if(
    !Number.isFinite(peak) ||
    !Number.isFinite(price) ||
    peak<=0 ||
    price<0
  )return null;
  return (1-(price/peak))*100;
}

export function shouldDeleteToken(
  token,
  {now=Date.now(),score=token?.score}={}
){
  const priceDropPercent=tokenPriceDropPercent(token);
  if(priceDropPercent!==null&&priceDropPercent>=80)return true;

  const discoveredAt=Number(token?.discoveredAt);
  const numericScore=
    score==null||score===''
      ? NaN
      : Number(score);
  return (
    Number.isFinite(discoveredAt) &&
    discoveredAt>0 &&
    now-discoveredAt>TOKEN_CLEANUP_MAX_AGE_MS &&
    Number.isFinite(numericScore) &&
    numericScore<40
  );
}