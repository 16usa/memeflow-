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
  'minSniperPct','maxSniperPct',
  // MEMEFLOW_PREOPEN_WALLET_RISK_ISOLATION_V43
  // maxSuspectedRiskyWalletsPct / maxInsidersPct are FINAL-only and must not
  // split ordinary live evaluate() policy groups.
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
    liveEvaluationInflightMints:0,
    liveEvaluationStaleSettingsSkipped:0,
    liveEvaluationSupersededSkipped:0,
    entryAdmissionUsersChecked:0,
    entryAdmissionUsersPassed:0,
    entryAdmissionUsersHidden:0,
    entryAdmissionDecisionsCleared:0,
    entryAdmissionLastPassedUsers:0
  };
}

export function makeEvaluateForActiveUsers({
  store,metrics,activeUserHoursMs=86400000,batchSize=25,delayMs=0,
  onDecision=null,admissionCheck=null,evaluateFn=evaluate
}){
  let lastEvictAt=0;
  const settingsCache=new Map();
  const inflight=new Map();
  const pending=new Map();

  // MEMEFLOW_LIVE_SNAPSHOT_REVISION_GUARD_V45
  // A newer same-mint snapshot must invalidate all side effects from an older
  // in-flight evaluation before that older result reaches setDecision/onDecision.
  const latestRevisionByMint=new Map();
  let nextSnapshotRevision=0;

  function currentSettingsVersion(uid){
    const u=store.state.users?.[uid]||{};
    return u.settingsVersion||u.updatedAt||u.createdAt||0;
  }

  function recordError(e){
    const msg=safeError(e);
    metrics.liveEvaluationBatchErrors++;
    metrics.lastLiveEvaluationError=msg;
    metrics.lastLiveEvaluationErrorAt=Date.now();
    metrics.liveEvaluationErrorReasons[msg]=(metrics.liveEvaluationErrorReasons[msg]||0)+1;
  }
  function cachedSettings(uid){
    const version=currentSettingsVersion(uid);
    const cached=settingsCache.get(uid);
    if(cached&&cached.version===version)return cached;
    const settings=store.settings(uid);
    if(!settings||typeof settings!=='object')throw new Error('user settings unavailable after normalization');
    const row={version,settings,key:policyKey(settings)};
    settingsCache.set(uid,row);
    return row;
  }

  async function _run(token,tokenRevision){
    const tokenMint=String(token?.mint||'');
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
    const settingsVersionByUid=new Map();
    let admittedUserCount=0;

    for(const uid of activeUids){
      try{
        const c=cachedSettings(uid);
        settingsVersionByUid.set(uid,c.version);

        if(typeof admissionCheck==='function'){
          metrics.entryAdmissionUsersChecked++;
          const admission=admissionCheck(token,c.settings,uid);

          if(admission?.admitted!==true){
            metrics.entryAdmissionUsersHidden++;
            const key=uid+':'+String(token?.mint||'');
            if(store.state.decisions?.[key]){
              delete store.state.decisions[key];
              store._uidDec?.[uid]?.delete?.(key);
              metrics.entryAdmissionDecisionsCleared++;
            }
            continue;
          }

          metrics.entryAdmissionUsersPassed++;
        }

        admittedUserCount++;
        let g=groups.get(c.key);
        if(!g){g={settings:c.settings,uids:[]};groups.set(c.key,g)}
        g.uids.push(uid);
      }catch(e){recordError(e)}
    }

    metrics.entryAdmissionLastPassedUsers=admittedUserCount;
    metrics.livePolicyGroups=groups.size;

    const stagedWrites=[];
    const rows=[...groups.values()];
    for(let i=0;i<rows.length;i+=Math.max(1,batchSize)){
      const batch=rows.slice(i,i+Math.max(1,batchSize));
      for(const group of batch){
        let d;
        try{
          d=evaluateFn(token,group.settings);
          metrics.liveUniquePolicyEvaluations++;
        }catch(e){
          recordError(e);
          continue;
        }
        for(const uid of group.uids){
          try{
            const evaluatedSettingsVersion=
              settingsVersionByUid.get(uid)??0;
            const currentVersion=currentSettingsVersion(uid);

            // MEMEFLOW_LIVE_SETTINGS_REVISION_GUARD_V39
            // Never write a decision calculated under an older settings
            // revision after a newer settings revision became authoritative.
            if(currentVersion!==evaluatedSettingsVersion){
              metrics.liveEvaluationStaleSettingsSkipped++;
              continue;
            }

            const savedDecision={
              ...d,
              primaryReason:d.primaryReason,
              settingsVersion:evaluatedSettingsVersion,
              reevaluatedAt:Date.now()
            };
            stagedWrites.push({
              uid,
              savedDecision
            });
          }catch(e){recordError(e)}
        }
      }
      if(i+Math.max(1,batchSize)<rows.length){
        if(delayMs>0)await new Promise(r=>setTimeout(r,delayMs));
        else await new Promise(r=>setImmediate(r));
      }
    }

    // Give already-arrived WS/TradeEvent work one chance to publish a newer
    // same-mint snapshot before any decision side effect is committed.
    await new Promise(resolve=>setImmediate(resolve));

    if(
      latestRevisionByMint.get(tokenMint)!==tokenRevision
    ){
      metrics.liveEvaluationSupersededSkipped+=
        stagedWrites.length;

      metrics.liveEvaluationTokensProcessed++;
      metrics.lastLiveEvaluationAt=Date.now();
      metrics.decisionsInMemoryByActiveUsers=
        activeUids.reduce(
          (s,uid)=>s+(store._uidDec[uid]?.size||0),
          0
        );

      return {
        decisionLike:true,
        superseded:true,
        activeUsers:activeUids.length,
        admittedUsers:admittedUserCount,
        evaluationsPerformed:0,
        policyGroups:groups.size
      };
    }

    let committed=0;

    for(const row of stagedWrites){
      const evaluatedSettingsVersion=
        row.savedDecision?.settingsVersion??0;
      const currentVersion=
        currentSettingsVersion(row.uid);

      // Re-check V39 at the actual side-effect boundary because settings may
      // have changed during the final event-loop yield.
      if(currentVersion!==evaluatedSettingsVersion){
        metrics.liveEvaluationStaleSettingsSkipped++;
        continue;
      }

      store.setDecision(
        row.uid,
        tokenMint,
        row.savedDecision
      );

      if(onDecision){
        onDecision(
          row.uid,
          token,
          row.savedDecision
        );
      }

      metrics.liveEvaluationsPerformed++;
      committed++;
    }

    metrics.liveEvaluationTokensProcessed++;
    metrics.lastLiveEvaluationAt=Date.now();
    metrics.decisionsInMemoryByActiveUsers=
      activeUids.reduce(
        (s,uid)=>s+(store._uidDec[uid]?.size||0),
        0
      );

    return {
      decisionLike:true,
      superseded:false,
      activeUsers:activeUids.length,
      admittedUsers:admittedUserCount,
      evaluationsPerformed:committed,
      policyGroups:groups.size
    };
  }

  async function drain(mint,first){
    let item=first,result=null;

    try{
      while(item){
        pending.delete(mint);

        result=await _run(
          item.token,
          item.revision
        );

        item=pending.get(mint)||null;
      }

      return result;
    }finally{
      inflight.delete(mint);
      pending.delete(mint);
      latestRevisionByMint.delete(mint);
      metrics.liveEvaluationInflightMints=inflight.size;
    }
  }

  return function evaluateForActiveUsers(token){
    const mint=String(token?.mint||'');
    if(!mint)return Promise.resolve(null);

    const revision=++nextSnapshotRevision;

    latestRevisionByMint.set(
      mint,
      revision
    );

    const item={
      token,
      revision
    };

    const existing=inflight.get(mint);

    if(existing){
      pending.set(mint,item);
      metrics.liveEvaluationCoalesced++;
      return existing;
    }

    const job=
      drain(mint,item)
        .catch(e=>{
          recordError(e);
          return null;
        });

    inflight.set(mint,job);
    metrics.liveEvaluationInflightMints=inflight.size;
    return job;
  };
}
