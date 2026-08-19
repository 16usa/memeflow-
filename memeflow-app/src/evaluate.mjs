// MEMEFLOW_V30_2_CORE_CLEANUP
// MEMEFLOW_V30_2_CORE_CLEANUP
const clampScore=v=>Math.max(0,Math.min(100,Math.round(Number(v)||0)));
const finite=v=>v!==''&&v!==null&&v!==undefined&&Number.isFinite(Number(v));
const firstFinite=(...xs)=>{for(const v of xs)if(finite(v))return Number(v);return null};
const firstText=(...xs)=>{for(const v of xs){const s=String(v??'').trim();if(s)return s}return ''};
const list=v=>String(v??'').split(/[\n,]+/).map(x=>x.trim().toLowerCase()).filter(Boolean);

function independentAiScore(token={}){
  let score=0; const quality=[];
  const h=firstFinite(token.holderCount,token.holders,token.holder?.count);
  if(h!==null){let p=0;if(h>=100)p=20;else if(h>=60)p=17;else if(h>=30)p=13;else if(h>=15)p=7;else if(h>0)p=3;score+=p;quality.push({key:'holders',value:h,points:p,maxPoints:20})}
  const t=firstFinite(token.top10Pct,token.top10,token.holder?.top10Pct);
  if(t!==null){let p=0;if(t<=15)p=20;else if(t<=25)p=17;else if(t<=35)p=12;else if(t<=50)p=6;score+=p;quality.push({key:'top10',value:t,points:p,maxPoints:20})}
  const d=firstFinite(token.developerPct,token.developerSharePct,token.creatorPct,token.holder?.developerPct);
  if(d!==null){let p=0;if(d<=5)p=20;else if(d<=10)p=18;else if(d<=20)p=14;else if(d<=30)p=7;score+=p;quality.push({key:'developer',value:d,points:p,maxPoints:20})}
  const b=firstFinite(token.buyPressure,token.momentum,token.market?.buyPressure);
  if(b!==null){let p=0;if(b>=3)p=20;else if(b>=2)p=17;else if(b>=1.5)p=13;else if(b>=1.2)p=9;else if(b>=1)p=4;score+=p;quality.push({key:'buyPressure',value:b,points:p,maxPoints:20})}
  const price=firstFinite(token.priceSol),hasPrice=price!==null&&price>0;
  if(hasPrice)score+=10;quality.push({key:'verifiedPrice',value:hasPrice,points:hasPrice?10:0,maxPoints:10});
  const fresh=token.holderFresh===true;
  if(fresh)score+=10;quality.push({key:'freshHolders',value:fresh,points:fresh?10:0,maxPoints:10});
  return {score:clampScore(score),quality};
}

function metadataKnown(t={}){
  return Boolean(t.metadataReady===true||t.metadataFetched===true||t.metadataResolved===true||t.name||t.symbol||t.uri||t.metadataUri);
}
function socials(t={}){
  return {
    twitter:firstText(t.twitter,t.twitterUrl,t.x,t.xUrl,t.socials?.twitter,t.socials?.x),
    website:firstText(t.website,t.websiteUrl,t.socials?.website),
    telegram:firstText(t.telegram,t.telegramUrl,t.socials?.telegram)
  };
}

export function tokenAgeMinutes(token={},now=Date.now()){
  const created=firstFinite(token.createdAt,token.discoveredAt,token.firstSeenAt,token.seenAt,token.created_at,token.discovered_at,token.timestamp);
  if(created===null||created<=0)return null;
  const ms=created<1e12?created*1000:created;
  return Math.max(0,(Number(now)-ms)/60000);
}

function __mfEvaluateBaseV11(token,s={}){
  const reasons=[],gates=[];let waiting=false,blocked=false;
  const addGate=(name,result,reason,meta={})=>{
    const status=result===null||result===undefined?'WAITING':result?'PASS':'FAIL';
    gates.push({name,status,pass:status==='PASS',...meta});
    if(status==='WAITING'){waiting=true;reasons.push('Waiting: '+reason)}
    else if(status==='FAIL'){blocked=true;reasons.push(reason)}
  };
  const addMin=(name,value,limit,reason,zeroDisables=true)=>{
    if(!finite(limit))return;const x=Number(limit);if(zeroDisables&&x<=0)return;
    addGate(name,value===null?null:value>=x,reason,{value,threshold:x,operator:'>='});
  };
  const addMax=(name,value,limit,reason)=>{
    if(!finite(limit))return;const x=Number(limit);
    addGate(name,value===null?null:value<=x,reason,{value,threshold:x,operator:'<='});
  };

  const ai=independentAiScore(token),score=ai.score;
  const completeness=[
    firstFinite(token.holderCount,token.holders,token.holder?.count),
    firstFinite(token.top10Pct,token.top10,token.holder?.top10Pct),
    firstFinite(token.developerPct,token.developerSharePct,token.creatorPct,token.holder?.developerPct),
    firstFinite(token.buyPressure,token.momentum,token.market?.buyPressure),
    firstFinite(token.priceSol)
  ];
  const fallback=completeness.filter(v=>v!==null).length/completeness.length;
  const storedQuality=finite(token.dataQuality)?Math.max(0,Math.min(1,Number(token.dataQuality))):0;
  const q=Math.max(storedQuality,fallback);
  const confidence=clampScore(q*100);

  const v={
    bonding:firstFinite(token.bondingCurvePct,token.bondingCurve,token.bondingProgressPct,token.curvePct),
    marketCap:firstFinite(token.marketCapUsd,token.marketCapUSD),
    fees:firstFinite(token.totalFeesSol,token.feesSol,token.totalFees),
    volume:firstFinite(token.volume24hUsd,token.volume24hUSD,token.volume24h),
    buys:firstFinite(token.buyTransactions,token.buys,token.buyCount),
    sells:firstFinite(token.sellTransactions,token.sells,token.sellCount),
    holders:firstFinite(token.holderCount,token.holders,token.holder?.count),
    bundle:firstFinite(token.bundlePct,token.bundledPct,token.bundlePercent),
    age:tokenAgeMinutes(token),
    top10:firstFinite(token.top10Pct,token.top10,token.holder?.top10Pct),
    developer:firstFinite(token.developerPct,token.developerSharePct,token.creatorPct,token.holder?.developerPct),
    sniper:firstFinite(token.sniperPct,token.snipersPct,token.sniperPercent),
    liquidity:firstFinite(token.liquidityUsd,token.liquidityUSD),
    pressure:firstFinite(token.buyPressure,token.momentum,token.market?.buyPressure),
    price:firstFinite(token.priceSol)
  };
  v.totalTx=firstFinite(token.totalTransactions,token.transactions,(v.buys!==null&&v.sells!==null)?v.buys+v.sells:null);

  addMin('Minimum bonding curve',v.bonding,s.minBondingCurvePct,`bonding curve below ${s.minBondingCurvePct}%`);
  addMax('Maximum bonding curve',v.bonding,s.maxBondingCurvePct,`bonding curve above ${s.maxBondingCurvePct}%`);
  addMin('Minimum market cap',v.marketCap,s.minMarketCapUsd,`market cap below $${s.minMarketCapUsd}`);
  addMax('Maximum market cap',v.marketCap,s.maxMarketCapUsd,`market cap above $${s.maxMarketCapUsd}`);
  addMin('Minimum total fees',v.fees,s.minTotalFeesSol,`total fees below ${s.minTotalFeesSol} SOL`);
  addMax('Maximum total fees',v.fees,s.maxTotalFeesSol,`total fees above ${s.maxTotalFeesSol} SOL`);
  addMin('Minimum 24h volume',v.volume,s.minVolume24hUsd,`24h volume below $${s.minVolume24hUsd}`);
  addMax('Maximum 24h volume',v.volume,s.maxVolume24hUsd,`24h volume above $${s.maxVolume24hUsd}`);
  addMin('Minimum buy transactions',v.buys,s.minBuyTransactions,`buy transactions below ${s.minBuyTransactions}`);
  addMax('Maximum buy transactions',v.buys,s.maxBuyTransactions,`buy transactions above ${s.maxBuyTransactions}`);
  addMin('Minimum sell transactions',v.sells,s.minSellTransactions,`sell transactions below ${s.minSellTransactions}`);
  addMax('Maximum sell transactions',v.sells,s.maxSellTransactions,`sell transactions above ${s.maxSellTransactions}`);
  addMin('Minimum total transactions',v.totalTx,s.minTotalTransactions,`total transactions below ${s.minTotalTransactions}`);
  addMax('Maximum total transactions',v.totalTx,s.maxTotalTransactions,`total transactions above ${s.maxTotalTransactions}`);
  addMin('Minimum holders',v.holders,s.minHolders,`holders below ${s.minHolders}`);
  addMax('Maximum holders',v.holders,s.maxHolders,`holders above ${s.maxHolders}`);
  addMin('Minimum bundle',v.bundle,s.minBundlePct,`bundle below ${s.minBundlePct}%`);
  addMax('Maximum bundle',v.bundle,s.maxBundlePct,`bundle above ${s.maxBundlePct}%`);
  addMin('Minimum token age',v.age,s.minTokenAgeMinutes,`token age below ${s.minTokenAgeMinutes}m`);
  addMax('Maximum token age',v.age,s.maxTokenAgeMinutes,`token age above ${s.maxTokenAgeMinutes}m`);
  addMin('Minimum Top-10 concentration',v.top10,s.minTop10Pct,`Top 10 below ${s.minTop10Pct}%`);
  addMax('Maximum Top-10 concentration',v.top10,s.maxTop10Pct,`Top 10 above ${s.maxTop10Pct}%`);
  addMin('Minimum developer share',v.developer,s.minDeveloperPct,`developer below ${s.minDeveloperPct}%`);
  addMax('Maximum developer share',v.developer,s.maxDeveloperPct,`developer above ${s.maxDeveloperPct}%`);
  addMin('Minimum sniper share',v.sniper,s.minSniperPct,`sniper share below ${s.minSniperPct}%`);
  addMax('Maximum sniper share',v.sniper,s.maxSniperPct,`sniper share above ${s.maxSniperPct}%`);
  addMin('Minimum liquidity',v.liquidity,s.minLiquidityUsd,`liquidity below $${s.minLiquidityUsd}`);
  addMin('Buy pressure',v.pressure,s.minBuyPressure,`buy pressure below ${s.minBuyPressure}x`);

  const soc=socials(token),known=metadataKnown(token);
  if(s.requireTwitter===true)addGate('Twitter / X required',known?Boolean(soc.twitter):null,'Twitter / X is required');
  if(s.requireWebsite===true)addGate('Website required',known?Boolean(soc.website):null,'website is required');
  if(s.requireTelegram===true)addGate('Telegram required',known?Boolean(soc.telegram):null,'Telegram is required');
  if(s.requireAnySocial===true)addGate('Any social required',known?Boolean(soc.twitter||soc.website||soc.telegram):null,'at least one social link is required');
  if(s.requireWebsiteOrX===true)addGate('Website or X required',known?Boolean(soc.website||soc.twitter):null,'website or X is required');

  const hay=[token.name,token.symbol,token.description,token.metadata?.name,token.metadata?.symbol,token.metadata?.description].filter(Boolean).join(' ').toLowerCase();
  const inc=list(s.includeKeywords);
  if(inc.length)addGate('Include keywords',hay?inc.some(k=>hay.includes(k)):null,`required keyword not found (${inc.join(', ')})`);
  const exc=list(s.excludeKeywords);
  if(exc.length)addGate('Exclude keywords',!exc.some(k=>hay.includes(k)),'excluded keyword matched');

  const bl=Array.isArray(s.developerBlacklistWallets)?s.developerBlacklistWallets.map(x=>String(x||'').trim()).filter(Boolean):[];
  if(bl.length){
    const creator=firstText(token.creator,token.creatorWallet,token.developerWallet,token.devWallet,token.developer);
    addGate('Developer blacklist',creator?!bl.includes(creator):null,'developer wallet is blacklisted');
  }

  addGate('Verified price',v.price===null?null:v.price>0,'price unavailable',{value:v.price});
  if(s.requireFreshHolderSnapshot===true)addGate('Fresh holder snapshot',token.holderFresh==null?null:token.holderFresh===true,'holder snapshot unavailable');

  const minScore=finite(s.minScore)?Number(s.minScore):null;
  const minConfidence=finite(s.minConfidence)?Number(s.minConfidence):null;
  const scorePass=minScore===null||score>=minScore;
  const confPass=minConfidence===null||confidence>=minConfidence;
  gates.push({name:'Minimum AI score',status:scorePass?'PASS':'FAIL',pass:scorePass,value:score,threshold:minScore});
  if(!scorePass){blocked=true;reasons.push(`AI score ${score} below configured minimum ${minScore}`)}
  gates.push({name:'Minimum data confidence',status:confPass?'PASS':'FAIL',pass:confPass,value:confidence,threshold:minConfidence});
  if(!confPass){blocked=true;reasons.push(`data confidence ${confidence}% below configured minimum ${minConfidence}%`)}

  const state=blocked?'BLOCKED':waiting?'WAITING':scorePass&&confPass?'BUY READY':'WATCH';
  return {
    state,score,confidence,dataConfidence:confidence,confidenceKind:'data-completeness',reasons,
    primaryReason:reasons[0]||'Independent AI quality and all configured user gates passed',
    aiQuality:{model:'MEMEFLOW_INDEPENDENT_AI_V1',score,components:ai.quality},
    settingsEvaluation:{minScore,minConfidence,gates}
  };
}

// MEMEFLOW_DEX_SOURCE_COMPATIBILITY_V2
// DEX pools do not provide Pump bonding-curve/fee/bundle/sniper semantics.
// Developer identity is also not a reliable DEX-pool property.
// These owner settings remain active for Pump tokens and are N/A for DEX tokens.
export function evaluate(token, s = {}) {
  const isDex = String(token?.launchPlatform || '').toLowerCase() === 'dex';

  if (!isDex) {
    return __mfEvaluateBaseV11(token, s);
  }

  const dexSettings = {
    ...s,
    minBondingCurvePct:null,
    maxBondingCurvePct:null,
    minTotalFeesSol:null,
    maxTotalFeesSol:null,
    minDeveloperPct:null,
    maxDeveloperPct:null,
    minBundlePct:null,
    maxBundlePct:null,
    minSniperPct:null,
    maxSniperPct:null,
    developerBlacklistWallets:[]
  };

  const result = __mfEvaluateBaseV11(token, dexSettings);
  const gates = result?.settingsEvaluation?.gates;

  if (Array.isArray(gates)) {
    gates.push(
      {name:'Bonding curve / Pump fees',status:'N/A',pass:true,reason:'not used for DEX tokens'},
      {name:'Developer / creator filters',status:'N/A',pass:true,reason:'not reliable from confirmed DEX pool'},
      {name:'Bundle / sniper filters',status:'N/A',pass:true,reason:'not provided by the DEX discovery path'}
    );
  }

  return result;
}

