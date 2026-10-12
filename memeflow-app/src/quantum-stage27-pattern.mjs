// Stage 27: deterministic, observational price-pattern evidence.
// No synthetic prices, predictive probability, trading side effects, or I/O.
const n=x=>x!==null&&x!==undefined&&x!==''&&Number.isFinite(Number(x))?Number(x):null;
export function inspectPricePattern(points=[],now=Date.now()){
  const unavailable=reason=>({ready:false,probability:null,confidence:null,direction:'UNKNOWN',reason,observations:0,method:'OBSERVED_PRICE_TREND_V27',validated:false});
  if(!Array.isArray(points))return unavailable('NO_PRICE_HISTORY');
  const valid=points.map(p=>({at:n(p?.at??p?.timestamp??p?.time),price:n(p?.priceSol??p?.price)}))
    .filter(p=>p.at!==null&&p.price!==null&&p.price>0&&p.at<=now&&p.at>=now-3600000)
    .sort((a,b)=>a.at-b.at);
  const unique=[];for(const p of valid){if(unique.length&&unique[unique.length-1].at===p.at)unique[unique.length-1]=p;else unique.push(p)}
  if(unique.length<8)return {...unavailable('INSUFFICIENT_OBSERVATIONS'),observations:unique.length};
  const span=unique.at(-1).at-unique[0].at;
  if(span<60000)return {...unavailable('INSUFFICIENT_TIME_SPAN'),observations:unique.length};
  if(now-unique.at(-1).at>120000)return {...unavailable('STALE_PRICE_HISTORY'),observations:unique.length};
  const changes=unique.slice(1).map((p,i)=>Math.log(p.price/unique[i].price));
  const total=Math.log(unique.at(-1).price/unique[0].price);
  const ups=changes.filter(x=>x>0).length,downs=changes.filter(x=>x<0).length;
  const direction=total>0.02&&ups>downs?'BULLISH':total< -0.02&&downs>ups?'BEARISH':'NEUTRAL';
  // Descriptive direction only; NOT a calibrated forecast or win probability.
  return {ready:true,probability:null,confidence:null,direction,reason:'DESCRIPTIVE_ONLY',observations:unique.length,spanMs:span,returnPct:(Math.exp(total)-1)*100,upMoves:ups,downMoves:downs,method:'OBSERVED_PRICE_TREND_V27',validated:false};
}
export function inspectQuantumPattern(token={},now=Date.now()){
  const history=token?.priceHistory??token?.priceSnapshots??token?.quantumPriceHistory;
  return inspectPricePattern(history,now);
}
