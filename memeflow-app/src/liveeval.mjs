/**
 * Live token evaluation — active-user registry.
 * V13: policy grouping + per-mint coalescing.
 */
import {evaluate} from './evaluate.mjs';

function safeError(e){
  return String(e?.message||e||'unknown error')
    .replace(/https?:\/\/\S+/gi,'[url]')
    .replace(/[1-9A-HJ-NP-Za-km-z]{32,}/g,'[addr]')
    .slice(0,240);
}

const SCANNER_POLICY_KEYS=[
  'launchPlatforms','includeKeywords','excludeKeywords',
  'minBondingCurvePct','maxBondingCurvePct','minMarketCapUsd','maxMarketCapUsd',
  'minTotalFeesSol','maxTotalFeesSol','minVolume24hUsd','maxVolume24hUsd',
  'minBuyTransactions','maxBuyTransactions','minSellTransactions','maxSellTransactions',
  'minTotalTransactions','maxTotalTransactions','minHolders','maxHolders',
  'minBundlePct','maxBundlePct','minTokenAgeMinutes','maxTokenAgeMinutes',
  'minTop10Pct','maxTop10Pct','minDeveloperPct','maxDeveloperPct',
  'minSniperPct','maxSniperPct','maxSuspectedRiskyWalletsPct','maxInsidersPct',
  'minLiquidityUsd','minBuyPressure','developerBlacklistWallets',
  'requireTwitter','requireWebsite','requireTelegram','requireAnySocial',
  'requireWebsiteOrX','requireFreshHolderSnapshot','minScore','minConfidence'
];
function stableValue(v){
  if(Array.isArray(v))return v.map(x=>String(x)).sort();
  if(v&&typeof v==='object')return Object.keys(v).sort().reduce((o,k)=>(o[k]=stableValue(v[k]),o),{});
  return v;
}
function policyKey(settings){
  return JSON.stringify(SCANNER_POLICY_KEYS.map(k=>[k,stableValue(settings?.[k])]));
}

export function makeLiveEvalMetrics(){
  return {
    activeEvaluationUsers:0,
    liveEvaluationsPerformed:0,
    liveEvaluationTokensProcessed:0,
    liveEvaluationUsersSkipped:0,
    liveEvaluationBatchErrors:0,
    decisionsInMemoryByActiveUsers:0,
    lastLiveEvaluationAt:null,
    lastLiveEvaluationError:null,
    lastLiveEvaluationErrorAt:null,
    liveEvaluationErrorReasons:{},
    liveUniquePolicyEvaluations:0,
    livePolicyGroups:0,
    liveEvaluationCoalesced:0,
    liveEvaluationInflightMints:0
  };
}

export function makeEvaluateForActiveUsers({
  store,metrics,activeUserHoursMs=86400000,batchSize=25,delayMs=0,onDecision=null
}){
  let lastEvictAt=0;
  const settingsCache=new Map();
  const inflight=new Map();
  const pending=new Map();

  function recordError(e){
    const msg=safeError(e);
    metrics.liveEvaluationBatchErrors++;
    metrics.lastLiveEvaluationError=msg;
    metrics.lastLiveEvaluationErrorAt=Date.now();
    metrics.liveEvaluationErrorReasons[msg]=(metrics.liveEvaluationErrorReasons[msg]||0)+1;
  }
  function cachedSettings(uid){
    const u=store.state.users?.[uid]||{};
    const version=u.settingsVersion||u.updatedAt||u.createdAt||0;
    const cached=settingsCache.get(uid);
    if(cached&&cached.version===version)return cached;
    const settings=store.settings(uid);
    if(!settings||typeof settings!=='object')throw new Error('user settings unavailable after normalization');
    const row={version,settings,key:policyKey(settings)};
    settingsCache.set(uid,row);
    return row;
  }

  async function _run(token){
    const now=Date.now();
    const cutoff=now-activeUserHoursMs;
    const allUids=Object.keys(store.state.users||{});

    if(now-lastEvictAt>60000){
      lastEvictAt=now;
      for(const uid of allUids){
        const u=store.state.users[uid];
        if(!u?.isOwner&&(!u?.lastActiveAt||u.lastActiveAt<cutoff)){
          settingsCache.delete(uid);
          if(store._uidDec[uid]){
            for(const key of store._uidDec[uid].keys())delete store.state.decisions[key];
            delete store._uidDec[uid];
          }
        }
      }
    }

    const activeUids=allUids.filter(uid=>{
      const u=store.state.users[uid]||{};
      return (u.lastActiveAt&&u.lastActiveAt>=cutoff)||u.isOwner;
    });
    metrics.liveEvaluationUsersSkipped+=allUids.length-activeUids.length;
    metrics.activeEvaluationUsers=activeUids.length;

    const groups=new Map();
    for(const uid of activeUids){
      try{
        const c=cachedSettings(uid);
        let g=groups.get(c.key);
        if(!g){g={settings:c.settings,uids:[]};groups.set(c.key,g)}
        g.uids.push(uid);
      }catch(e){recordError(e)}
    }
    metrics.livePolicyGroups=groups.size;

    const rows=[...groups.values()];
    for(let i=0;i<rows.length;i+=Math.max(1,batchSize)){
      const batch=rows.slice(i,i+Math.max(1,batchSize));
      for(const group of batch){
        let d;
        try{
          d=evaluate(token,group.settings);
          metrics.liveUniquePolicyEvaluations++;
        }catch(e){
          recordError(e);
          continue;
        }
        for(const uid of group.uids){
          try{
            const u=store.state.users?.[uid]||{};
            const settingsVersion=u.settingsVersion||u.updatedAt||Date.now();
            const savedDecision={...d,primaryReason:d.primaryReason,settingsVersion,reevaluatedAt:Date.now()};
            store.setDecision(uid,token.mint,savedDecision);
            if(onDecision)onDecision(uid,token,savedDecision);
            metrics.liveEvaluationsPerformed++;
          }catch(e){recordError(e)}
        }
      }
      if(i+Math.max(1,batchSize)<rows.length){
        if(delayMs>0)await new Promise(r=>setTimeout(r,delayMs));
        else await new Promise(r=>setImmediate(r));
      }
    }

    metrics.liveEvaluationTokensProcessed++;
    metrics.lastLiveEvaluationAt=Date.now();
    metrics.decisionsInMemoryByActiveUsers=activeUids.reduce((s,uid)=>s+(store._uidDec[uid]?.size||0),0);
    return {decisionLike:true,activeUsers:activeUids.length,evaluationsPerformed:activeUids.length,policyGroups:groups.size};
  }

  async function drain(mint,first){
    let token=first,result=null;
    try{
      while(token){
        pending.delete(mint);
        result=await _run(token);
        token=pending.get(mint)||null;
      }
      return result;
    }finally{
      inflight.delete(mint);
      pending.delete(mint);
      metrics.liveEvaluationInflightMints=inflight.size;
    }
  }

  return function evaluateForActiveUsers(token){
    const mint=String(token?.mint||'');
    if(!mint)return Promise.resolve(null);
    const existing=inflight.get(mint);
    if(existing){
      pending.set(mint,token);
      metrics.liveEvaluationCoalesced++;
      return existing;
    }
    const job=drain(mint,token).catch(e=>{recordError(e);return null});
    inflight.set(mint,job);
    metrics.liveEvaluationInflightMints=inflight.size;
    return job;
  };
}
