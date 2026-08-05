const has=(v)=>v!==null&&v!==undefined&&v!=='';
const num=(t,...keys)=>{for(const k of keys)if(has(t?.[k])&&Number.isFinite(Number(t[k])))return Number(t[k]);return null};
const text=(t,...keys)=>{for(const k of keys)if(has(t?.[k]))return String(t[k]);return ''};
const enabled=(v)=>v!==null&&v!==undefined&&v!=='';
const words=v=>String(v||'').toLowerCase().split(',').map(x=>x.trim()).filter(Boolean);
export function evaluate(token,s){
 const reasons=[];let waiting=false,blocked=false,score=100;
 const need=(ok,msg,pen=12)=>{if(ok===null||ok===undefined){waiting=true;reasons.push('Waiting: '+msg);score-=pen/2}else if(!ok){blocked=true;reasons.push(msg);score-=pen}};
 const range=(value,min,max,label,unit='',pen=12)=>{if(!enabled(min)&&!enabled(max))return;if(value===null)return need(null,`${label} data pending`,pen);if(enabled(min))need(value>=Number(min),`${label} ${value}${unit} below minimum ${min}${unit}`,pen);if(enabled(max))need(value<=Number(max),`${label} ${value}${unit} above maximum ${max}${unit}`,pen)};
 const platform=text(token,'launchPlatform','protocol','source').toLowerCase();
 if(Array.isArray(s.launchPlatforms)&&s.launchPlatforms.length)need(platform? s.launchPlatforms.some(p=>platform.includes(String(p).replace('_',' '))):null,'Launch platform data pending',8);
 const searchable=[text(token,'name'),text(token,'symbol'),text(token,'uri'),text(token,'description')].join(' ').toLowerCase();
 const inc=words(s.includeKeywords),exc=words(s.excludeKeywords);if(inc.length)need(searchable?inc.some(w=>searchable.includes(w)):null,'Required keyword missing',8);if(exc.length&&searchable&&exc.some(w=>searchable.includes(w)))need(false,'Excluded keyword matched',15);
 range(num(token,'bondingCurvePct','curveProgressPct'),s.minBondingCurvePct,s.maxBondingCurvePct,'Bonding curve','%',10);
 range(num(token,'marketCapUsd','marketCapUSD'),s.minMarketCapUsd,s.maxMarketCapUsd,'Market cap','',12);
 range(num(token,'totalFeesSol','feesSol'),s.minTotalFeesSol,s.maxTotalFeesSol,'Total fees',' SOL',8);
 range(num(token,'volume24hUsd','volume24h','volumeUsd24h'),s.minVolume24hUsd,s.maxVolume24hUsd,'24h volume','',10);
 range(num(token,'buyTransactions','buys24h','buyCount'),s.minBuyTransactions,s.maxBuyTransactions,'Buy transactions','',8);
 range(num(token,'sellTransactions','sells24h','sellCount'),s.minSellTransactions,s.maxSellTransactions,'Sell transactions','',8);
 range(num(token,'totalTransactions','transactions24h','txCount'),s.minTotalTransactions,s.maxTotalTransactions,'Total transactions','',8);
 range(num(token,'holderCount','holders'),s.minHolders,s.maxHolders,'Holders','',15);
 range(num(token,'bundlePct','bundledPct'),s.minBundlePct,s.maxBundlePct,'Bundle','%',15);
 const age=num(token,'ageMinutes')??(token?.discoveredAt?Math.max(0,(Date.now()-Number(token.discoveredAt))/60000):null);
 range(age,s.minTokenAgeMinutes,s.maxTokenAgeMinutes,'Token age',' min',10);
 range(num(token,'top10Pct','top10'),s.minTop10Pct,s.maxTop10Pct,'Top-10 concentration','%',18);
 range(num(token,'developerPct','creatorPct'),s.minDeveloperPct,s.maxDeveloperPct,'Developer share','%',18);
 range(num(token,'sniperPct','sniperOwnershipPct'),s.minSniperPct,s.maxSniperPct,'Sniper ownership','%',15);
 if(Array.isArray(s.developerBlacklistWallets)&&s.developerBlacklistWallets.length){const creator=text(token,'creator','developerWallet');need(creator? !s.developerBlacklistWallets.includes(creator):null,'Developer wallet data pending',20)}
 const twitter=Boolean(token?.twitter||token?.x||token?.socials?.twitter),website=Boolean(token?.website||token?.socials?.website),telegram=Boolean(token?.telegram||token?.socials?.telegram);
 if(s.requireTwitter)need(twitter,'Twitter/X required',8);if(s.requireWebsite)need(website,'Website required',8);if(s.requireTelegram)need(telegram,'Telegram required',8);if(s.requireAnySocial)need(twitter||website||telegram,'At least one social link required',8);
 // Existing AI-specific gates remain active and unchanged.
 need(token.holderCount==null&&enabled(s.minHolders)?null:true,'holder data pending',5);
 if(enabled(s.minBuyPressure))need(token.buyPressure==null?null:Number(token.buyPressure)>=Number(s.minBuyPressure),`buy pressure below ${s.minBuyPressure}×`,15);
 need(token.priceSol!=null,'price unavailable',12);
 if(s.requireFreshHolderSnapshot)need(token.holderFresh===true,'holder snapshot unavailable',10);
 score=Math.max(0,Math.min(100,Math.round(score)));const confidence=Math.max(0,Math.min(100,Math.round((token.dataQuality||0)*100)));
 const state=waiting?'WAITING':blocked?'BLOCKED':score>=Number(s.minScore||0)&&confidence>=Number(s.minConfidence||0)?'BUY READY':'WATCH';
 return {state,score,confidence,reasons,primaryReason:reasons[0]||'All configured token filters and AI gates passed'};
}
