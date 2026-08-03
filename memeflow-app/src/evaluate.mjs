export function evaluate(token,s){const reasons=[];let waiting=false,blocked=false,score=100;
 const need=(ok,msg,pen=15)=>{if(ok===null||ok===undefined){waiting=true;reasons.push('Waiting: '+msg);score-=pen/2}else if(!ok){blocked=true;reasons.push(msg);score-=pen}};
 need(token.holderCount==null?null:token.holderCount>=s.minHolders,`holders below ${s.minHolders}`,15);
 need(token.top10Pct==null?null:token.top10Pct<=s.maxTop10Pct,`Top 10 above ${s.maxTop10Pct}%`,18);
 need(token.developerPct==null?null:token.developerPct<=s.maxDeveloperPct,`developer above ${s.maxDeveloperPct}%`,18);
 need(token.buyPressure==null?null:token.buyPressure>=s.minBuyPressure,`buy pressure below ${s.minBuyPressure}×`,15);
 need(token.priceSol!=null,'price unavailable',12);
 if(s.requireFreshHolderSnapshot)need(token.holderFresh===true,'holder snapshot unavailable',10);
 score=Math.max(0,Math.min(100,Math.round(score)));const confidence=Math.max(0,Math.min(100,Math.round((token.dataQuality||0)*100)));
 let state=waiting?'WAITING':blocked?'BLOCKED':score>=s.minScore&&confidence>=s.minConfidence?'BUY READY':'WATCH';
 return {state,score,confidence,reasons,primaryReason:reasons[0]||'All configured on-chain gates passed'} }
