// MEMEFLOW_COPY_TRADING_V1
import {validPubkey} from './solana.mjs';
const PLATFORMS=['pump'];
const nullableNumbers=[
'minBondingCurvePct','maxBondingCurvePct','minMarketCapUsd','maxMarketCapUsd','minTotalFeesSol','maxTotalFeesSol',
'minVolume24hUsd','maxVolume24hUsd','minBuyTransactions','maxBuyTransactions','minSellTransactions','maxSellTransactions',
'minTotalTransactions','maxTotalTransactions','minHolders','maxHolders','minBundlePct','maxBundlePct',
'minTokenAgeMinutes','maxTokenAgeMinutes','minTop10Pct','maxTop10Pct','minDeveloperPct','maxDeveloperPct',
'minSniperPct','maxSniperPct','maxSuspectedRiskyWalletsPct','maxInsidersPct'
];
const booleans=[
'requireTwitter','requireWebsite','requireTelegram','requireAnySocial','requireFreshHolderSnapshot','requireWebsiteOrX','requireDexPaid',
'adaptiveProfile','shadowValidation','changeLog','exitOnWeakBuyPressure','copyTradingEnabled','copyTradingMirrorSells'
];
const finite=(v)=>v!==''&&v!==null&&v!==undefined&&Number.isFinite(Number(v));
const cleanText=v=>String(v??'').trim();
const bool=(v,fallback=false)=>{
 if(v===undefined||v===null||v==='')return fallback;
 if(typeof v==='boolean')return v;
 if(typeof v==='number')return v!==0;
 const s=String(v).trim().toLowerCase();
 if(['true','1','yes','on'].includes(s))return true;
 if(['false','0','no','off'].includes(s))return false;
 return fallback;
};
export const PROFILE_PRESETS=Object.freeze({
 conservative:Object.freeze({
  minScore:82,
  minConfidence:80,
  minBuyPressure:1.5,
  decisionFreshnessSec:30,
  requireFreshHolderSnapshot:true,
  requireWebsiteOrX:true
 }),
 balanced:Object.freeze({
  minScore:72,
  minConfidence:70,
  minBuyPressure:1.2,
  decisionFreshnessSec:60,
  requireFreshHolderSnapshot:true,
  requireWebsiteOrX:false
 }),
 aggressive:Object.freeze({
  minScore:65,
  minConfidence:65,
  minBuyPressure:1.1,
  decisionFreshnessSec:90,
  requireFreshHolderSnapshot:true,
  requireWebsiteOrX:false
 })
});
export function profilePreset(profile){
 const key=String(profile||'').trim().toLowerCase();
 const preset=PROFILE_PRESETS[key];
 return preset?{...preset}:null;
}

export function defaultSettings(){return {
 operatingMode:'observe',tradingEnvironment:'paper',profile:'balanced',
 tradingCapital:0,dailySpendLimit:0,positionSize:0.1,maxPositionSize:0.5,maxOpenPositions:4,maxDailyEntries:10,dailyLossLimit:0,feeReserve:0.05,
 copyTradingEnabled:false,copyTradingWallet:'',copyTradingBuyAmountSol:0.1,copyTradingMirrorSells:true,
 minScore:72,minConfidence:70,minLiquidityUsd:0,minBuyPressure:1.2,requireFreshHolderSnapshot:true,requireWebsiteOrX:false,requireDexPaid:false,
 launchPlatforms:['pump'],includeKeywords:'',excludeKeywords:'',
 minBondingCurvePct:null,maxBondingCurvePct:null,minMarketCapUsd:null,maxMarketCapUsd:null,minTotalFeesSol:null,maxTotalFeesSol:null,
 minVolume24hUsd:null,maxVolume24hUsd:null,minBuyTransactions:null,maxBuyTransactions:null,minSellTransactions:null,maxSellTransactions:null,minTotalTransactions:null,maxTotalTransactions:null,
 minHolders:30,maxHolders:null,minBundlePct:null,maxBundlePct:null,minTokenAgeMinutes:0,maxTokenAgeMinutes:180,minTop10Pct:null,maxTop10Pct:25,minDeveloperPct:null,maxDeveloperPct:20,minSniperPct:null,maxSniperPct:null,maxSuspectedRiskyWalletsPct:35,maxInsidersPct:25,
 developerBlacklistWallets:[],requireTwitter:false,requireWebsite:false,requireTelegram:false,requireAnySocial:false,
 hardStopPct:25,trailingStopPct:15,tp1Pct:100,tp1SellPct:50,tp2Pct:200,tp2SellPct:25,runnerPct:25,maxHoldMinutes:1440,
 exitBuyPressure:1.0,exitOnWeakBuyPressure:true,
 adaptiveProfile:false,shadowValidation:true,changeLog:true,
 aiChangePolicy:'propose',decisionFreshnessSec:60
}}
export function normalizeSettings(raw={}){
 const d=defaultSettings(),o={...d,...raw};

 // Legacy UI-key migrations from builds that persisted view names directly.
 if(raw.paperBeforeChange!==undefined&&raw.shadowValidation===undefined)o.shadowValidation=bool(raw.paperBeforeChange,d.shadowValidation);
 if(raw.auditSettings!==undefined&&raw.changeLog===undefined)o.changeLog=bool(raw.auditSettings,d.changeLog);
 if(raw.decisionFreshness!==undefined&&raw.decisionFreshnessSec===undefined&&finite(raw.decisionFreshness))o.decisionFreshnessSec=Number(raw.decisionFreshness);
 if(raw.exitWeakPressure!==undefined&&raw.exitOnWeakBuyPressure===undefined)o.exitOnWeakBuyPressure=bool(raw.exitWeakPressure,d.exitOnWeakBuyPressure);

 o.operatingMode=String(o.operatingMode||d.operatingMode).trim().toLowerCase();
 o.tradingEnvironment=String(o.tradingEnvironment||d.tradingEnvironment).trim().toLowerCase();
 o.profile=String(o.profile||d.profile).trim().toLowerCase();
 o.aiChangePolicy='propose'; // AI may propose/explain; it cannot mutate owner policy automatically in this build.

 for(const k of nullableNumbers)o[k]=Object.prototype.hasOwnProperty.call(raw,k)&&!finite(raw[k])?null:(finite(o[k])?Number(o[k]):null);
 for(const k of booleans)o[k]=bool(o[k],d[k]);

 const requestedPlatforms=Array.isArray(o.launchPlatforms)
   ? [...new Set(o.launchPlatforms.map(x=>cleanText(x).toLowerCase()).filter(Boolean))]
   : [];
 // Current discovery backend is Pump.fun only. Do not expose a pretend multi-launchpad filter.
 o.launchPlatforms=['pump'];

 o.includeKeywords=cleanText(o.includeKeywords);o.excludeKeywords=cleanText(o.excludeKeywords);o.copyTradingWallet=cleanText(o.copyTradingWallet);
 o.developerBlacklistWallets=Array.isArray(o.developerBlacklistWallets)
   ? [...new Set(o.developerBlacklistWallets.map(cleanText).filter(Boolean))]
   : cleanText(o.developerBlacklistWallets).split(/[\s,]+/).filter(Boolean);

 for(const k of [
   'minScore','minConfidence','minLiquidityUsd','minBuyPressure','tradingCapital','dailySpendLimit','positionSize','maxPositionSize',
   'maxOpenPositions','maxDailyEntries','dailyLossLimit','feeReserve','copyTradingBuyAmountSol','hardStopPct','trailingStopPct','tp1Pct','tp1SellPct',
   'tp2Pct','tp2SellPct','runnerPct','maxHoldMinutes','exitBuyPressure','decisionFreshnessSec'
 ])if(finite(o[k]))o[k]=Number(o[k]);else o[k]=d[k];

 // Drop legacy view-only keys so GET /api/settings stays canonical and understandable.
 delete o.paperBeforeChange;delete o.auditSettings;delete o.decisionFreshness;delete o.exitWeakPressure;delete o.ownerApproval;
 delete o.requireTokenLogo;delete o.requireDevMigrated;delete o.maxDeveloperRugHistoryPct;delete o.maxDeveloperExitPct;
 return o;
}
export function validateSettings(raw={}){
 const s=normalizeSettings(raw),errors=[];
 const ranges=[
  ['Bonding curve',s.minBondingCurvePct,s.maxBondingCurvePct],['Market cap',s.minMarketCapUsd,s.maxMarketCapUsd],
  ['Total fees',s.minTotalFeesSol,s.maxTotalFeesSol],['24h volume',s.minVolume24hUsd,s.maxVolume24hUsd],
  ['Buy transactions',s.minBuyTransactions,s.maxBuyTransactions],['Sell transactions',s.minSellTransactions,s.maxSellTransactions],
  ['Total transactions',s.minTotalTransactions,s.maxTotalTransactions],['Holders',s.minHolders,s.maxHolders],
  ['Bundle',s.minBundlePct,s.maxBundlePct],['Token age',s.minTokenAgeMinutes,s.maxTokenAgeMinutes],
  ['Top 10',s.minTop10Pct,s.maxTop10Pct],['Developer share',s.minDeveloperPct,s.maxDeveloperPct],
  ['Sniper share',s.minSniperPct,s.maxSniperPct]
 ];
 for(const [name,min,max] of ranges)if(min!==null&&max!==null&&min>max)errors.push(`${name}: minimum cannot exceed maximum.`);
 for(const k of nullableNumbers)if(s[k]!==null&&s[k]<0)errors.push(`${k} cannot be negative.`);
 for(const k of ['minBondingCurvePct','maxBondingCurvePct','minBundlePct','maxBundlePct','minTop10Pct','maxTop10Pct','minDeveloperPct','maxDeveloperPct','minSniperPct','maxSniperPct','maxSuspectedRiskyWalletsPct','maxInsidersPct'])
   if(s[k]!==null&&s[k]>100)errors.push(`${k} cannot exceed 100%.`);

 if(s.minScore<0||s.minScore>100)errors.push('Minimum AI score must be between 0 and 100.');
 if(s.minConfidence<0||s.minConfidence>100)errors.push('Minimum confidence must be between 0 and 100.');
 if(s.minLiquidityUsd<0)errors.push('Minimum liquidity cannot be negative.');
 if(s.minBuyPressure<0)errors.push('Minimum buy pressure cannot be negative.');

 for(const k of ['tradingCapital','dailySpendLimit','positionSize','maxPositionSize','dailyLossLimit','feeReserve','copyTradingBuyAmountSol','trailingStopPct','tp1Pct','tp1SellPct','tp2Pct','tp2SellPct','runnerPct','exitBuyPressure'])
   if(!Number.isFinite(s[k])||s[k]<0)errors.push(`${k} must be a non-negative number.`);
 if(!(s.positionSize>0))errors.push('Default position must be greater than 0 SOL.');
 if(!(s.maxPositionSize>0))errors.push('Maximum position must be greater than 0 SOL.');
 if(s.positionSize>s.maxPositionSize)errors.push('Default position cannot exceed maximum position.');
 if(s.copyTradingEnabled){
  if(!s.copyTradingWallet||!validPubkey(s.copyTradingWallet))errors.push('Copy Trading wallet must be a valid Solana public address.');
  if(!(s.copyTradingBuyAmountSol>0))errors.push('Copy Trading BUY size must be greater than 0 SOL.');
  if(s.copyTradingBuyAmountSol>s.maxPositionSize)errors.push('Copy Trading BUY size cannot exceed maximum position.');
  if(s.dailySpendLimit>0&&s.copyTradingBuyAmountSol>s.dailySpendLimit)errors.push('Copy Trading BUY size cannot exceed the daily spending limit.');
 }
 if(s.tradingCapital>0&&s.maxPositionSize>s.tradingCapital)errors.push('Maximum position cannot exceed trading capital when a capital cap is enabled.');
 if(s.tradingCapital>0&&s.dailySpendLimit>s.tradingCapital)errors.push('Daily spending limit cannot exceed trading capital when a capital cap is enabled.');
 if(s.dailySpendLimit>0&&s.positionSize>s.dailySpendLimit)errors.push('Default position cannot exceed the daily spending limit.');
 if(s.tradingCapital>0&&s.feeReserve>=s.tradingCapital)errors.push('Fee reserve must be below trading capital when a capital cap is enabled.');
 if(s.tradingCapital>0&&s.dailyLossLimit>s.tradingCapital)errors.push('Daily loss limit cannot exceed trading capital.');

 for(const k of ['maxOpenPositions','maxDailyEntries'])if(!Number.isInteger(s[k])||s[k]<0)errors.push(`${k} must be a whole number of 0 or greater.`);
 if(!(s.hardStopPct>0&&s.hardStopPct<=100))errors.push('Hard stop must be greater than 0% and no more than 100%.');
 if(s.trailingStopPct>100)errors.push('Trailing stop cannot exceed 100%.');
 if(!(s.tp1Pct>0))errors.push('TP1 must be greater than 0%.');
 if(!(s.tp2Pct>s.tp1Pct))errors.push('TP2 must be greater than TP1.');
 for(const k of ['tp1SellPct','tp2SellPct','runnerPct'])if(s[k]>100)errors.push(`${k} cannot exceed 100%.`);
 const allocation=s.tp1SellPct+s.tp2SellPct+s.runnerPct;
 if(Math.abs(allocation-100)>0.001)errors.push(`Exit allocation must total 100% (currently ${allocation}%).`);
 if(!(s.maxHoldMinutes>=1))errors.push('Maximum hold must be at least 1 minute.');
 if(!(s.decisionFreshnessSec>=5&&s.decisionFreshnessSec<=3600))errors.push('Decision freshness must be between 5 and 3600 seconds.');

 const VALID_MODES=['observe','assist','automate'],VALID_ENVS=['paper','live'],VALID_PROFILES=['conservative','balanced','aggressive','custom'];
 if(!VALID_MODES.includes(s.operatingMode))errors.push('Invalid operatingMode: must be observe, assist or automate.');
 if(!VALID_ENVS.includes(s.tradingEnvironment))errors.push('Invalid tradingEnvironment: must be paper or live.');
 if(!VALID_PROFILES.includes(s.profile))errors.push('Invalid profile: must be conservative, balanced or aggressive.');
 if(s.aiChangePolicy!=='propose')errors.push('AI change policy is currently restricted to propose-only.');
 if(!Array.isArray(s.launchPlatforms)||s.launchPlatforms.length!==1||s.launchPlatforms[0]!=='pump')errors.push('Current discovery supports Pump.fun only.');

 return {ok:errors.length===0,errors,settings:s};
}
// MEMEFLOW_WALLET_CLUSTER_RISK_V3: existing UI controls are now canonical backend settings.
