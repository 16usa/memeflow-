const PLATFORMS=['pump','launchlab','believe','moonshot','bonkfun','bags','jup_studio'];
const nullableNumbers=[
'minBondingCurvePct','maxBondingCurvePct','minMarketCapUsd','maxMarketCapUsd','minTotalFeesSol','maxTotalFeesSol',
'minVolume24hUsd','maxVolume24hUsd','minBuyTransactions','maxBuyTransactions','minSellTransactions','maxSellTransactions',
'minTotalTransactions','maxTotalTransactions','minHolders','maxHolders','minBundlePct','maxBundlePct',
'minTokenAgeMinutes','maxTokenAgeMinutes','minTop10Pct','maxTop10Pct','minDeveloperPct','maxDeveloperPct',
'minSniperPct','maxSniperPct'
];
const booleans=['requireTwitter','requireWebsite','requireTelegram','requireAnySocial','requireFreshHolderSnapshot','requireWebsiteOrX','adaptiveProfile','ownerApproval','shadowValidation','changeLog'];
const finite=(v)=>v!==''&&v!==null&&v!==undefined&&Number.isFinite(Number(v));
const cleanText=v=>String(v??'').trim();
export function defaultSettings(){return {
 operatingMode:'observe',tradingEnvironment:'paper',profile:'balanced',tradingCapital:0,dailySpendLimit:0,positionSize:0.1,maxPositionSize:0.5,maxOpenPositions:4,maxDailyEntries:10,dailyLossLimit:0,feeReserve:0.05,
 minScore:72,minConfidence:70,minLiquidityUsd:0,minBuyPressure:1.2,requireFreshHolderSnapshot:true,requireWebsiteOrX:false,
 launchPlatforms:[],includeKeywords:'',excludeKeywords:'',
 minBondingCurvePct:null,maxBondingCurvePct:null,minMarketCapUsd:null,maxMarketCapUsd:null,minTotalFeesSol:null,maxTotalFeesSol:null,
 minVolume24hUsd:null,maxVolume24hUsd:null,minBuyTransactions:null,maxBuyTransactions:null,minSellTransactions:null,maxSellTransactions:null,minTotalTransactions:null,maxTotalTransactions:null,
 minHolders:30,maxHolders:null,minBundlePct:null,maxBundlePct:null,minTokenAgeMinutes:0,maxTokenAgeMinutes:180,minTop10Pct:null,maxTop10Pct:25,minDeveloperPct:null,maxDeveloperPct:20,minSniperPct:null,maxSniperPct:null,
 developerBlacklistWallets:[],requireTwitter:false,requireWebsite:false,requireTelegram:false,requireAnySocial:false,
 hardStopPct:25,trailingStopPct:15,tp1Pct:100,tp1SellPct:50,tp2Pct:200,tp2SellPct:25,runnerPct:25,maxHoldMinutes:1440,exitBuyPressure:1.0,
 adaptiveProfile:false,ownerApproval:true,shadowValidation:true,changeLog:true
}}
export function normalizeSettings(raw={}){
 const d=defaultSettings(),o={...d,...raw};
 // Normalize operating mode and trading environment to lowercase
 o.operatingMode=String(o.operatingMode||'observe').trim().toLowerCase();
 o.tradingEnvironment=String(o.tradingEnvironment||'paper').trim().toLowerCase();
 // Backward-compatible migration from the previous settings schema.
 if(raw.maxDeveloperPct!==undefined&&raw.maxDeveloperPct!==null)o.maxDeveloperPct=Number(raw.maxDeveloperPct);
 if(raw.minMarketCapUsd!==undefined&&raw.minMarketCapUsd!==null)o.minMarketCapUsd=Number(raw.minMarketCapUsd);
 if(raw.minHolders!==undefined&&raw.minHolders!==null)o.minHolders=Number(raw.minHolders);
 if(raw.maxTop10Pct!==undefined&&raw.maxTop10Pct!==null)o.maxTop10Pct=Number(raw.maxTop10Pct);
 if(raw.minTokenAgeMinutes!==undefined&&raw.minTokenAgeMinutes!==null)o.minTokenAgeMinutes=Number(raw.minTokenAgeMinutes);
 if(raw.maxTokenAgeMinutes!==undefined&&raw.maxTokenAgeMinutes!==null)o.maxTokenAgeMinutes=Number(raw.maxTokenAgeMinutes);
 for(const k of nullableNumbers)o[k]=Object.prototype.hasOwnProperty.call(raw,k)&&!finite(raw[k])?null:(finite(o[k])?Number(o[k]):null);
 for(const k of booleans)o[k]=Boolean(o[k]);
 o.launchPlatforms=Array.isArray(o.launchPlatforms)?[...new Set(o.launchPlatforms.map(x=>cleanText(x).toLowerCase()).filter(x=>PLATFORMS.includes(x)))]:[];
 o.includeKeywords=cleanText(o.includeKeywords);o.excludeKeywords=cleanText(o.excludeKeywords);
 o.developerBlacklistWallets=Array.isArray(o.developerBlacklistWallets)?[...new Set(o.developerBlacklistWallets.map(cleanText).filter(Boolean))]:cleanText(o.developerBlacklistWallets).split(/[\s,]+/).filter(Boolean);
 for(const k of ['minScore','minConfidence','minLiquidityUsd','minBuyPressure','tradingCapital','dailySpendLimit','positionSize','maxPositionSize','maxOpenPositions','maxDailyEntries','dailyLossLimit','feeReserve','hardStopPct','trailingStopPct','tp1Pct','tp1SellPct','tp2Pct','tp2SellPct','runnerPct','maxHoldMinutes','exitBuyPressure'])if(finite(o[k]))o[k]=Number(o[k]);
 return o;
}
export function validateSettings(raw={}){
 const s=normalizeSettings(raw),errors=[];
 const ranges=[['Bonding curve',s.minBondingCurvePct,s.maxBondingCurvePct],['Market cap',s.minMarketCapUsd,s.maxMarketCapUsd],['Total fees',s.minTotalFeesSol,s.maxTotalFeesSol],['24h volume',s.minVolume24hUsd,s.maxVolume24hUsd],['Buy transactions',s.minBuyTransactions,s.maxBuyTransactions],['Sell transactions',s.minSellTransactions,s.maxSellTransactions],['Total transactions',s.minTotalTransactions,s.maxTotalTransactions],['Holders',s.minHolders,s.maxHolders],['Bundle',s.minBundlePct,s.maxBundlePct],['Token age',s.minTokenAgeMinutes,s.maxTokenAgeMinutes],['Top 10',s.minTop10Pct,s.maxTop10Pct],['Developer share',s.minDeveloperPct,s.maxDeveloperPct],['Sniper share',s.minSniperPct,s.maxSniperPct]];
 for(const [name,min,max] of ranges)if(min!==null&&max!==null&&min>max)errors.push(`${name}: minimum cannot exceed maximum.`);
 for(const k of nullableNumbers)if(s[k]!==null&&s[k]<0)errors.push(`${k} cannot be negative.`);
 for(const k of ['minBondingCurvePct','maxBondingCurvePct','minBundlePct','maxBundlePct','minTop10Pct','maxTop10Pct','minDeveloperPct','maxDeveloperPct','minSniperPct','maxSniperPct'])if(s[k]!==null&&s[k]>100)errors.push(`${k} cannot exceed 100%.`);
 if(s.minScore<0||s.minScore>100)errors.push('Minimum AI score must be between 0 and 100.');
 if(s.minConfidence<0||s.minConfidence>100)errors.push('Minimum confidence must be between 0 and 100.');
 if(s.positionSize>s.maxPositionSize)errors.push('Default position cannot exceed maximum position.');
 const VALID_MODES=['observe','assist','automate'];
 const VALID_ENVS=['paper','live'];
 if(!VALID_MODES.includes(s.operatingMode))errors.push(`Invalid operatingMode: must be observe, assist or automate.`);
 if(!VALID_ENVS.includes(s.tradingEnvironment))errors.push(`Invalid tradingEnvironment: must be paper or live.`);
 return {ok:errors.length===0,errors,settings:s};
}
