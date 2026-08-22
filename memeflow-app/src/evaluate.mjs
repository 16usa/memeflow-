// MEMEFLOW_V30_2_CORE_CLEANUP
// MEMEFLOW_UNIFIED_DECISION_V1_1
const clampScore=v=>Math.max(0,Math.min(100,Math.round(Number(v)||0)));
const finite=v=>v!==''&&v!==null&&v!==undefined&&Number.isFinite(Number(v));
const firstFinite=(...xs)=>{for(const v of xs)if(finite(v))return Number(v);return null};
const firstText=(...xs)=>{for(const v of xs){const s=String(v??'').trim();if(s)return s}return ''};
const list=v=>String(v??'').split(/[\n,]+/).map(x=>x.trim().toLowerCase()).filter(Boolean);

const __MF_HOLDER_CANONICAL_MAX_AGE_MS=Math.max(
  60000,
  Number(process.env.HOLDER_CANONICAL_MAX_AGE_MS||180000)
); // MEMEFLOW_DATA_INTEGRITY_V1_3_EXACT

function __mfV13EffectiveEvidence(token={},now=Date.now()){
  const source=String(token?.holderSource||'').toLowerCase();
  const canonicalSource=
    source.includes('getprogramaccounts')||
    source.includes('baseline + live')||
    source.includes('canonical');
  const scanned=firstFinite(token.holderCanonicalSeedAt,token.holderScannedAt);
  const canonicalAgeMs=scanned!==null&&scanned>0
    ? Math.max(0,Number(now)-Number(scanned))
    : null;
  const stale=
    token?.holderFresh===true&&
    canonicalSource&&
    canonicalAgeMs!==null&&
    canonicalAgeMs>__MF_HOLDER_CANONICAL_MAX_AGE_MS;

  if(!stale)return token;

  return {
    ...token,
    holderFresh:false,
    holderCount:null,
    holders:null,
    top10Pct:null,
    top10:null,
    developerPct:null,
    developerSharePct:null,
    creatorPct:null,
    holderEvidenceStale:true,
    holderCanonicalAgeMs:canonicalAgeMs
  };
}


function __mfCanonicalHolderEvidence(token={}){
  const source=String(token?.holderSource||'').toLowerCase();
  return token?.holderFresh===true&&(
    source.includes('getprogramaccounts')||
    source.includes('baseline + live')
  );
}

function independentAiScore(token={}){
  let score=0; const quality=[];
  const canonicalHolder=__mfCanonicalHolderEvidence(token);
  const h=canonicalHolder?firstFinite(token.holderCount,token.holders,token.holder?.count):null;
  if(h!==null){let p=0;if(h>=100)p=20;else if(h>=60)p=17;else if(h>=30)p=13;else if(h>=15)p=7;else if(h>0)p=3;score+=p;quality.push({key:'holders',value:h,points:p,maxPoints:20})}
  const t=canonicalHolder?firstFinite(token.top10Pct,token.top10,token.holder?.top10Pct):null;
  if(t!==null){let p=0;if(t<=15)p=20;else if(t<=25)p=17;else if(t<=35)p=12;else if(t<=50)p=6;score+=p;quality.push({key:'top10',value:t,points:p,maxPoints:20})}
  const d=canonicalHolder?firstFinite(token.developerPct,token.developerSharePct,token.creatorPct,token.holder?.developerPct):null;
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
  // A Pump CREATE name/symbol/URI does NOT mean off-chain metadata/socials
  // have already been resolved. Treat social absence as authoritative only
  // after metadata resolution (or when an enriched token has no metadata URI).
  const hasSocial=Boolean(firstText(
    t.twitter,t.twitterUrl,t.x,t.xUrl,
    t.website,t.websiteUrl,t.telegram,t.telegramUrl,
    t.socials?.twitter,t.socials?.x,t.socials?.website,t.socials?.telegram
  ));
  if(hasSocial)return true;
  if(t.metadataReady===true||t.metadataFetched===true||t.metadataResolved===true)return true;
  const hasUri=Boolean(firstText(t.uri,t.metadataUri,t.metadataUrl));
  if(!hasUri&&t.lastScannedAt)return true;
  return false;
}
function socials(t={}){
  return {
    twitter:firstText(t.twitter,t.twitterUrl,t.x,t.xUrl,t.socials?.twitter,t.socials?.x),
    website:firstText(t.website,t.websiteUrl,t.socials?.website),
    telegram:firstText(t.telegram,t.telegramUrl,t.socials?.telegram)
  };
}

function __mfV14PumpOrigin(token={}){
  const mint=String(token?.mint||token?.tokenMint||token?.tokenAddress||'').toLowerCase();
  const launch=String(token?.launchPlatform||'').toLowerCase();
  const protocol=String(token?.protocol||'').toLowerCase();
  const source=String(token?.source||'').toLowerCase();
  return launch==='pump'||protocol==='pump'||source.includes('pump create')||mint.endsWith('pump');
}

function __mfV14TimestampMs(value){
  if(value===null||value===undefined||value==='')return null;
  const numeric=Number(value);
  if(Number.isFinite(numeric)&&numeric>0)return numeric<1e12?numeric*1000:numeric;
  const parsed=Date.parse(String(value));
  return Number.isFinite(parsed)&&parsed>0?parsed:null;
}

export function tokenAgeSource(token={}){
  if(__mfV14PumpOrigin(token)){
    const pumpTs=__mfV14TimestampMs(token.pumpCreatedAt??token.pumpCreateAt??token.pumpCreationAt);
    if(pumpTs!==null)return 'pump-create-block-time';
    if(token.pumpCreatedAtPending===true)return 'pump-create-time-pending';
    const legacy=__mfV14TimestampMs(
      token.createdAt??token.discoveredAt??token.firstSeenAt??token.seenAt??
      token.created_at??token.discovered_at??token.timestamp
    );
    return legacy!==null?'legacy-pump-time-fallback':null;
  }
  const generic=__mfV14TimestampMs(
    token.createdAt??token.discoveredAt??token.firstSeenAt??token.seenAt??
    token.created_at??token.discovered_at??token.timestamp
  );
  return generic!==null?'generic-token-time':null;
}

export function tokenAgeMinutes(token={},now=Date.now()){
  let created=null;
  if(__mfV14PumpOrigin(token)){
    created=__mfV14TimestampMs(token.pumpCreatedAt??token.pumpCreateAt??token.pumpCreationAt);
    if(created===null&&token.pumpCreatedAtPending===true)return null;
    if(created===null){
      created=__mfV14TimestampMs(
        token.createdAt??token.discoveredAt??token.firstSeenAt??token.seenAt??
        token.created_at??token.discovered_at??token.timestamp
      );
    }
  }else{
    created=__mfV14TimestampMs(
      token.createdAt??token.discoveredAt??token.firstSeenAt??token.seenAt??
      token.created_at??token.discovered_at??token.timestamp
    );
  }
  if(created===null)return null;
  return Math.max(0,(Number(now)-created)/60000);
}

function __mfEvaluateBaseV11(token,s={}){
  token=__mfV13EffectiveEvidence(token);
  const reasons=[],gates=[];let waiting=false,blocked=false;
  const addGate=(name,result,reason,meta={})=>{
    const status=result===null||result===undefined?'WAITING':result?'PASS':'FAIL';
    gates.push({name,status,pass:status==='PASS',...meta});
    if(status==='WAITING'){waiting=true;reasons.push('Waiting: '+reason)}
    else if(status==='FAIL'){blocked=true;reasons.push(reason)}
  };
  const addMin=(name,value,limit,reason,zeroDisables=true)=>{
    if(!finite(limit))return;const x=Number(limit);if(zeroDisables&&x<=0)return;
    const pending=`${name.replace(/^(Minimum|Maximum)\s+/,'')} data pending`;
    addGate(name,value===null?null:value>=x,value===null?pending:reason,{value,threshold:x,operator:'>='});
  };
  const addMax=(name,value,limit,reason)=>{
    if(!finite(limit))return;const x=Number(limit);
    const pending=`${name.replace(/^(Minimum|Maximum)\s+/,'')} data pending`;
    addGate(name,value===null?null:value<=x,value===null?pending:reason,{value,threshold:x,operator:'<='});
  };

  const holderCanonical=__mfCanonicalHolderEvidence(token);
  const ai=independentAiScore(token);
  let score=ai.score;
  const completeness=[
    holderCanonical?firstFinite(token.holderCount,token.holders,token.holder?.count):null,
    holderCanonical?firstFinite(token.top10Pct,token.top10,token.holder?.top10Pct):null,
    holderCanonical?firstFinite(token.developerPct,token.developerSharePct,token.creatorPct,token.holder?.developerPct):null,
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
  // MEMEFLOW_HOLDER_ACCURACY_V36
  // Keep provisional holder metrics visible in token state, but never let a
  // partial live ledger hard-block a user. All holder-derived hard settings
  // become decision-grade only after the canonical unique-wallet snapshot.
  const hv=holderCanonical
    ? {holders:v.holders,bundle:v.bundle,top10:v.top10,developer:v.developer,sniper:v.sniper}
    : {holders:null,bundle:null,top10:null,developer:null,sniper:null};

  addMin('Minimum holders',hv.holders,s.minHolders,`holders below ${s.minHolders}`);
  addMax('Maximum holders',hv.holders,s.maxHolders,`holders above maximum ${s.maxHolders}`);
  addMin('Minimum bundle',hv.bundle,s.minBundlePct,`bundle below ${s.minBundlePct}%`);
  addMax('Maximum bundle',hv.bundle,s.maxBundlePct,`bundle above ${s.maxBundlePct}%`);
  addMin('Minimum token age',v.age,s.minTokenAgeMinutes,`token age below ${s.minTokenAgeMinutes}m`);
  addMax('Maximum token age',v.age,s.maxTokenAgeMinutes,`token age above ${s.maxTokenAgeMinutes}m`);
  addMin('Minimum Top-10 concentration',hv.top10,s.minTop10Pct,`Top 10 below ${s.minTop10Pct}%`);
  addMax('Maximum Top-10 concentration',hv.top10,s.maxTop10Pct,`Top 10 above ${s.maxTop10Pct}%`);
  addMin('Minimum developer share',hv.developer,s.minDeveloperPct,`developer below ${s.minDeveloperPct}%`);
  addMax('Maximum developer share',hv.developer,s.maxDeveloperPct,`developer above ${s.maxDeveloperPct}%`);
  addMin('Minimum sniper share',hv.sniper,s.minSniperPct,`sniper share below ${s.minSniperPct}%`);
  addMax('Maximum sniper share',hv.sniper,s.maxSniperPct,`sniper share above ${s.maxSniperPct}%`);
  addMin('Minimum liquidity',v.liquidity,s.minLiquidityUsd,`liquidity below $${s.minLiquidityUsd}`);
  addMin('Buy pressure',v.pressure,s.minBuyPressure,`buy pressure below ${s.minBuyPressure}x`);

  const soc=socials(token),known=metadataKnown(token);
  if(s.requireTwitter===true)addGate('Twitter / X required',known?Boolean(soc.twitter):null,'Twitter/X required');
  if(s.requireWebsite===true)addGate('Website required',known?Boolean(soc.website):null,'Website required');
  if(s.requireTelegram===true)addGate('Telegram required',known?Boolean(soc.telegram):null,'Telegram required');
  if(s.requireAnySocial===true)addGate('Any social required',known?Boolean(soc.twitter||soc.website||soc.telegram):null,'At least one social link is required');
  if(s.requireWebsiteOrX===true)addGate('Website or X required',known?Boolean(soc.website||soc.twitter):null,'Website or X required');

  const hay=[token.name,token.symbol,token.description,token.metadata?.name,token.metadata?.symbol,token.metadata?.description].filter(Boolean).join(' ').toLowerCase();
  const inc=list(s.includeKeywords);
  if(inc.length)addGate('Include keywords',hay?inc.some(k=>hay.includes(k)):null,`required keyword not found (${inc.join(', ')})`);
  const exc=list(s.excludeKeywords);
  if(exc.length)addGate('Exclude keywords',!exc.some(k=>hay.includes(k)),'excluded keyword matched');

  const bl=Array.isArray(s.developerBlacklistWallets)?s.developerBlacklistWallets.map(x=>String(x||'').trim()).filter(Boolean):[];
  if(bl.length){
    const creator=firstText(token.creator,token.creatorWallet,token.developerWallet,token.devWallet,token.developer);
    addGate('Developer blacklist',creator?!bl.includes(creator):null,'Developer wallet is blacklisted');
  }

  // MEMEFLOW_RUNTIME_TRUTH_V1_4_EXACT
  // DEX display updates never refresh this gate. It is driven only by the
  // canonical Pump/Solana market path.
  const __mfMarketSource=String(token?.marketSource||token?.priceSource||'').toLowerCase();
  const __mfCanonicalPumpMarket=
    token?.canonicalMarket===true||
    __mfMarketSource.startsWith('pump')||
    __mfMarketSource.includes('ws-direct')||
    String(token?.source||'').toLowerCase().includes('bonding curve');

  if(__mfV14PumpOrigin(token)&&__mfCanonicalPumpMarket){
    const __mfMarketAt=__mfV14TimestampMs(token?.pumpMarketUpdatedAt??token?.lastPriceAt);
    const __mfConfiguredMarketAge=Number(process.env.PUMP_CANONICAL_MARKET_MAX_AGE_MS);
    const __mfMarketMaxAge=Number.isFinite(__mfConfiguredMarketAge)
      ? Math.max(15000,__mfConfiguredMarketAge)
      : 120000;
    const __mfMarketAge=__mfMarketAt===null?null:Math.max(0,Date.now()-__mfMarketAt);

    addGate(
      'Fresh Pump market data',
      __mfMarketAge===null?null:(__mfMarketAge<=__mfMarketMaxAge?true:null),
      __mfMarketAge===null
        ? 'canonical Pump market timestamp pending'
        : `canonical Pump market data is ${Math.round(__mfMarketAge/1000)}s old`,
      {value:__mfMarketAge,threshold:__mfMarketMaxAge,operator:'<='}
    );
  }

  // MEMEFLOW_ANTI_RUG_V1_4_2_EXACT
  // Canonical Pump anti-rug circuit breaker.
  // DEX values never participate: only priceSol/peakPriceSol/Pump flow/history.
  const __mfCurrentPrice=finite(token?.priceSol)?Number(token.priceSol):null;
  const __mfPeakPrice=finite(token?.peakPriceSol)?Number(token.peakPriceSol):null;
  const __mfHardPeakConfigured=Number(process.env.MEMEFLOW_RUG_HARD_DRAWDOWN_PCT);
  const __mfHardPeakLimit=Number.isFinite(__mfHardPeakConfigured)
    ? Math.max(70,Math.min(95,__mfHardPeakConfigured))
    : 75;
  const __mfRapid30Configured=Number(process.env.MEMEFLOW_RUG_30S_DROP_PCT);
  const __mfRapid30Limit=Number.isFinite(__mfRapid30Configured)
    ? Math.max(25,Math.min(80,__mfRapid30Configured))
    : 40;
  const __mfRapid120Configured=Number(process.env.MEMEFLOW_RUG_120S_DROP_PCT);
  const __mfRapid120Limit=Number.isFinite(__mfRapid120Configured)
    ? Math.max(35,Math.min(90,__mfRapid120Configured))
    : 55;
  const __mfHoldConfigured=Number(process.env.MEMEFLOW_RUG_RECOVERY_HOLD_DRAWDOWN_PCT);
  const __mfHoldLimit=Number.isFinite(__mfHoldConfigured)
    ? Math.max(25,Math.min(70,__mfHoldConfigured))
    : 45;
  const __mfHoldPressureConfigured=Number(process.env.MEMEFLOW_RUG_RECOVERY_MAX_BUY_PRESSURE);
  const __mfHoldPressure=Number.isFinite(__mfHoldPressureConfigured)
    ? Math.max(0.1,Math.min(1.5,__mfHoldPressureConfigured))
    : 0.80;

  const __mfDrawdownPct=
    __mfCurrentPrice!==null&&__mfCurrentPrice>0&&
    __mfPeakPrice!==null&&__mfPeakPrice>0&&
    __mfPeakPrice>=__mfCurrentPrice
      ? (1-__mfCurrentPrice/__mfPeakPrice)*100
      : null;

  const __mfHistory=Array.isArray(token?.antiRugHistory)
    ? token.antiRugHistory.filter(row=>finite(row?.priceSol)&&finite(row?.at))
    : [];
  const __mfNow=Date.now();
  const __mfRecentPeak=(windowMs)=>{
    let peak=__mfCurrentPrice||0;
    for(const row of __mfHistory){
      const at=Number(row.at);
      const price=Number(row.priceSol);
      if(__mfNow-at<=windowMs&&price>peak)peak=price;
    }
    return peak>0?peak:null;
  };
  const __mfDropFromRecent=(windowMs)=>{
    const peak=__mfRecentPeak(windowMs);
    return peak!==null&&__mfCurrentPrice!==null&&__mfCurrentPrice>0&&peak>=__mfCurrentPrice
      ? (1-__mfCurrentPrice/peak)*100
      : null;
  };
  const __mfDrop30=__mfDropFromRecent(30_000);
  const __mfDrop120=__mfDropFromRecent(120_000);

  // Missing peak history is not incomplete decision evidence.
  // A token can be evaluated normally before its first local peak snapshot exists.
  // The anti-rug gate becomes active only after a real canonical Pump peak exists.
  const __mfPeakSafe=__mfDrawdownPct===null||__mfDrawdownPct<__mfHardPeakLimit;
  if(__mfDrawdownPct!==null){
    addGate(
      'Peak drawdown safety',
      __mfPeakSafe,
      `token collapsed ${__mfDrawdownPct.toFixed(1)}% from observed peak (canonical Pump)`,
      {value:__mfDrawdownPct,threshold:__mfHardPeakLimit,operator:'<'}
    );
  }

  const __mfRapid30Fail=__mfDrop30!==null&&__mfDrop30>=__mfRapid30Limit;
  const __mfRapid120Fail=__mfDrop120!==null&&__mfDrop120>=__mfRapid120Limit;
  const __mfRapidFail=__mfRapid30Fail||__mfRapid120Fail;
  if(__mfDrop30!==null||__mfDrop120!==null){
    addGate(
      'Rapid drawdown safety',
      !__mfRapidFail,
      __mfRapid30Fail
        ? `rapid Pump dump ${__mfDrop30.toFixed(1)}% inside 30s`
        : `rapid Pump dump ${Number(__mfDrop120||0).toFixed(1)}% inside 120s`,
      {
        value30s:__mfDrop30,
        threshold30s:__mfRapid30Limit,
        value120s:__mfDrop120,
        threshold120s:__mfRapid120Limit
      }
    );
  }

  const __mfLatchUntil=finite(token?.rugRiskUntil)?Number(token.rugRiskUntil):0;
  const __mfLatchActive=__mfLatchUntil>Date.now();
  if(__mfLatchActive){
    addGate(
      'Anti-rug cooldown',
      false,
      token?.rugRiskReason||'recent Pump dump remains inside anti-rug cooldown',
      {until:__mfLatchUntil}
    );
  }

  const __mfHardRisk=!__mfPeakSafe||__mfRapidFail||__mfLatchActive;
  if(__mfHardRisk){
    score=Math.min(score,20);
  }else{
    const __mfPressure=v.pressure;
    const __mfBuyCount=v.buys;
    const __mfSellCount=v.sells;
    const __mfBearishPressure=
      __mfPressure!==null&&__mfPressure<__mfHoldPressure;
    const __mfBearishCounts=
      __mfBuyCount!==null&&__mfSellCount!==null&&
      __mfSellCount>=Math.max(2,__mfBuyCount*2);
    const __mfRecoveryHold=
      __mfDrawdownPct!==null&&
      __mfDrawdownPct>=__mfHoldLimit&&
      (__mfBearishPressure||__mfBearishCounts);

    if(__mfRecoveryHold){
      addGate(
        'Selloff recovery hold',
        null,
        `Pump price is ${__mfDrawdownPct.toFixed(1)}% below peak while sell pressure remains elevated`,
        {
          drawdownPct:__mfDrawdownPct,
          drawdownThreshold:__mfHoldLimit,
          buyPressure:__mfPressure,
          buyPressureThreshold:__mfHoldPressure,
          buys:__mfBuyCount,
          sells:__mfSellCount
        }
      );
      score=Math.min(score,55);
    }
  }

  addGate('Verified price',v.price===null?null:v.price>0,'price unavailable',{value:v.price});
  if(s.requireFreshHolderSnapshot===true){
    // holderFresh=false is provisional while the holder scan is still running.
    // Missing/freshness-pending evidence must WAIT; only known hard gates BLOCK.
    addGate('Fresh holder snapshot',token.holderFresh===true?true:null,'fresh holder snapshot data pending');
  }

  const minScore=finite(s.minScore)?Number(s.minScore):null;
  const minConfidence=finite(s.minConfidence)?Number(s.minConfidence):null;

  // The independent score allocates holder/top10/developer components.
  // Therefore a configured score/confidence threshold cannot be finalized
  // against provisional holder evidence.
  if(!holderCanonical&&(
    (minScore!==null&&minScore>0)||
    (minConfidence!==null&&minConfidence>0)
  )){
    waiting=true;
    reasons.push('Waiting: canonical holder evidence for score/confidence pending');
  }

  const scorePass=minScore===null||score>=minScore;
  const confPass=minConfidence===null||confidence>=minConfidence;

  // Critical lifecycle rule:
  // incomplete enabled evidence is WAITING, never a synthetic low-score BLOCK.
  // Known hard gate failures still win and remain BLOCKED.
  if(waiting){
    gates.push({name:'Minimum AI score',status:'WAITING',pass:false,value:score,threshold:minScore});
    gates.push({name:'Minimum data confidence',status:'WAITING',pass:false,value:confidence,threshold:minConfidence});
  }else{
    gates.push({name:'Minimum AI score',status:scorePass?'PASS':'FAIL',pass:scorePass,value:score,threshold:minScore});
    if(!scorePass){blocked=true;reasons.push(`AI score ${score} below configured minimum ${minScore}`)}
    gates.push({name:'Minimum data confidence',status:confPass?'PASS':'FAIL',pass:confPass,value:confidence,threshold:minConfidence});
    if(!confPass){blocked=true;reasons.push(`data confidence ${confidence}% below configured minimum ${minConfidence}%`)}
  }

  const state=blocked?'BLOCKED':waiting?'WAITING':scorePass&&confPass?'BUY READY':'WATCH';
  const primaryReason=blocked
    ? (reasons.find(r=>!String(r).startsWith('Waiting: '))||reasons[0])
    : reasons[0];

  return {
    state,score,confidence,dataConfidence:confidence,confidenceKind:'data-completeness',reasons,
    primaryReason:primaryReason||'Independent AI quality and all configured user gates passed',
    aiQuality:{model:'MEMEFLOW_INDEPENDENT_AI_V1',score,components:ai.quality},
    settingsEvaluation:{minScore,minConfidence,gates}
  };
}

// MEMEFLOW_DEX_SOURCE_COMPATIBILITY_V2
// DEX pools do not provide Pump bonding-curve/fee/bundle/sniper semantics.
// Developer identity is also not a reliable DEX-pool property.
// These owner settings remain active for Pump tokens and are N/A for DEX tokens.
function __mfV15BaseEvaluate(token, s = {}) {
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

// MEMEFLOW_ANTI_RUG_V1_5_EXACT
// Evidence-only wrapper around canonical V1.4.2. No DEX price/quote/pool-price inputs.
export function evaluate(token={},s={}){
  const base=__mfV15BaseEvaluate(token,s);
  const originalState=String(base?.state||'WAITING').toUpperCase();
  const gates=Array.isArray(base?.settingsEvaluation?.gates)?[...base.settingsEvaluation.gates]:[];
  const reasons=Array.isArray(base?.reasons)?[...base.reasons]:[];
  let blocked=false,waiting=false,primary=null;
  const finite=v=>{if(v===''||v===null||v===undefined)return null;const n=Number(v);return Number.isFinite(n)?n:null};
  const push=(name,status,reason,detail={})=>{
    gates.push({name,status,pass:status==='PASS',...detail});
    if(status==='FAIL'){blocked=true;if(reason)reasons.push(reason);if(!primary&&reason)primary=reason}
    else if(status==='WAITING'){waiting=true;const r=reason?.startsWith('Waiting: ')?reason:`Waiting: ${reason||name+' evidence pending'}`;reasons.push(r);if(!primary)primary=r}
  };
  const maxGate=(name,settingKey,tokenKey,pending,failLabel)=>{
    const threshold=finite(s?.[settingKey]);if(threshold===null)return;
    const value=finite(token?.[tokenKey]);
    if(value===null)return push(name,'WAITING',pending,{value:null,threshold,operator:'<='});
    if(value>threshold)return push(name,'FAIL',`${failLabel} ${value}% above configured maximum ${threshold}%`,{value,threshold,operator:'<='});
    push(name,'PASS',null,{value,threshold,operator:'<='});
  };
  maxGate('Suspected risky wallets','maxSuspectedRiskyWalletsPct','suspectedRiskyWalletsPct','suspected risky wallets evidence pending','suspected risky wallets');
  maxGate('Insiders','maxInsidersPct','insidersPct','insider evidence pending','insiders');
  maxGate('Developer rug history','maxDeveloperRugHistoryPct','developerRugHistoryPct','developer rug history evidence pending','developer rug history');
  maxGate('Developer exit','maxDeveloperExitPct','developerExitPct','developer exit evidence pending','developer exit');
  if(s?.requireDevMigrated===true){
    if(typeof token?.devMigrated!=='boolean')push('Developer migrated','WAITING','developer migration evidence pending',{value:null,required:true});
    else if(token.devMigrated!==true)push('Developer migrated','FAIL','developer migration requirement failed',{value:false,required:true});
    else push('Developer migrated','PASS',null,{value:true,required:true});
  }
  if(s?.requireTokenLogo===true){
    const logo=typeof token?.imageUrl==='string'&&token.imageUrl.trim()?token.imageUrl.trim():null;
    const resolved=token?.metadataResolved===true||token?.metadataReady===true||token?.metadataFetched===true||Boolean(token?.metadataFetchedAt&&!token?.metadataError);
    if(logo)push('Token logo','PASS',null,{value:logo,required:true});
    else if(resolved)push('Token logo','FAIL','token logo is required',{value:null,required:true});
    else push('Token logo','WAITING','token logo metadata pending',{value:null,required:true});
  }
  let state=originalState;if(blocked)state='BLOCKED';else if(waiting&&originalState!=='BLOCKED')state='WAITING';
  const preservePrimary=originalState==='BLOCKED'&&!blocked;
  return {...base,state,reasons,primaryReason:preservePrimary?base?.primaryReason:(primary||base?.primaryReason||reasons[0]||null),settingsEvaluation:{...(base?.settingsEvaluation||{}),gates},antiRugEvidenceVersion:'V1.5'};
}
