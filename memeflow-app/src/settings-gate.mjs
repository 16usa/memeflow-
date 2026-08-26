import crypto from 'node:crypto';

const hasOwn=(obj,key)=>Object.prototype.hasOwnProperty.call(obj||{},key);

function finite(value){
  if(value===null||value===undefined||value==='')return null;
  const n=Number(value);
  return Number.isFinite(n)?n:null;
}

function readPath(obj,path){
  let cur=obj;
  for(const part of String(path).split('.')){
    if(cur==null||!hasOwn(cur,part))return undefined;
    cur=cur[part];
  }
  return cur;
}

function firstFinite(token,paths){
  for(const path of paths){
    const n=finite(readPath(token,path));
    if(n!==null)return n;
  }
  return null;
}

function firstText(token,paths){
  for(const path of paths){
    const value=readPath(token,path);
    if(typeof value==='string'&&value.trim())return value.trim();
  }
  return null;
}

function settingNumber(settings,key){
  return finite(settings?.[key]);
}

function enabledPositive(settings,key){
  const n=settingNumber(settings,key);
  return n!==null&&n>0?n:null;
}

function keywordList(value){
  return String(value||'')
    .split(/[\n,]+/)
    .map(x=>x.trim().toLowerCase())
    .filter(Boolean);
}

function tokenSearchText(token={}){
  return [
    token.name,token.symbol,token.uri,token.metadataName,token.metadataSymbol,
    token.description,token.metadata?.name,token.metadata?.symbol,token.metadata?.description
  ].filter(x=>typeof x==='string'&&x.trim()).join(' ').toLowerCase();
}

function socialState(token={},kind){
  const paths={
    twitter:['twitter','twitterUrl','x','xUrl','socials.twitter','socials.x','links.twitter','links.x','metadata.twitter','metadata.x'],
    website:['website','websiteUrl','site','siteUrl','socials.website','links.website','metadata.website'],
    telegram:['telegram','telegramUrl','socials.telegram','links.telegram','metadata.telegram']
  }[kind]||[];
  if(firstText(token,paths))return true;

  const explicitKnown=paths.some(path=>{
    const parts=String(path).split('.');
    let cur=token;
    for(let i=0;i<parts.length;i++){
      if(cur==null||!hasOwn(cur,parts[i]))return false;
      if(i===parts.length-1)return true;
      cur=cur[parts[i]];
    }
    return false;
  });
  if(explicitKnown)return false;

  if(token.metadataFetchedAt!=null||token.socialsFetchedAt!=null||token.socialsKnown===true||token.metadataKnown===true)return false;
  return null;
}

export function tokenAgeMinutes(token={},now=Date.now()){
  // MEMEFLOW_SETTINGS_ONLY_DISCOVERY_V1
  // Age filters must use chain/create evidence only.
  // discoveredAt / firstSeenAt / updatedAt describe MEMEFLOW runtime timing and
  // must never make an old token look newly created.
  const candidates=[
    token.pumpCreatedAt,
    token.createdAt,
    token.created_at,
    token.createTimestamp,
    token.blockTime
  ];
  for(const value of candidates){
    if(value===null||value===undefined||value==='')continue;
    const numeric=finite(value);
    const parsed=numeric!==null?numeric:Date.parse(value);
    if(!Number.isFinite(parsed)||parsed<=0)continue;
    const ms=parsed<1e12?parsed*1000:parsed;
    return Math.max(0,(Number(now)-ms)/60000);
  }
  // Unknown real creation time is incomplete evidence, not "0 minutes old".
  return null;
}

const METRICS={
  bondingCurvePct:['bondingCurvePct','bondingProgressPct','bondingCurveProgressPct','curveProgressPct','bondingCurveProgress'],
  marketCapUsd:['marketCapUsd','marketCapUSD','market.capUsd','market.marketCapUsd','fdvUsd','fdvUSD'],
  totalFeesSol:['totalFeesSol','feesSol','totalFeeSol','fees.totalSol'],
  volume24hUsd:['volume24hUsd','volume24hUSD','volumeUsd24h','volume.h24','market.volume24hUsd'],
  buyTransactions:['buyTransactions','buyTxCount','buys24h','txns24hBuys','transactions.buy','transactions.buys'],
  sellTransactions:['sellTransactions','sellTxCount','sells24h','txns24hSells','transactions.sell','transactions.sells'],
  totalTransactions:['totalTransactions','totalTxCount','txCount24h','transactions.total'],
  holders:['holderCount','holders','holder.count'],
  bundlePct:['bundlePct','bundledPct','bundlePercentage','bundle.percent'],
  top10Pct:['top10Pct','top10','holder.top10Pct'],
  developerPct:['developerPct','developerSharePct','developer','holder.developerPct'],
  sniperPct:['sniperPct','snipersPct','sniperSharePct','snipers.percent'],
  suspectedRiskyWalletsPct:['suspectedRiskyWalletsPct','walletClusterRiskPct','linkedWalletsPct'],
  insidersPct:['insidersPct','creatorLinkedWalletsPct','insiderWalletsPct'],
  liquidityUsd:['liquidityUsd','liquidityUSD','market.liquidityUsd','liquidity.usd'],
  buyPressure:['buyPressure','momentum','market.buyPressure']
};

function metric(token,key){
  if(key==='totalTransactions'){
    const direct=firstFinite(token,METRICS.totalTransactions);
    if(direct!==null)return direct;
    const buys=firstFinite(token,METRICS.buyTransactions);
    const sells=firstFinite(token,METRICS.sellTransactions);
    if(buys!==null&&sells!==null)return buys+sells;
    return null;
  }
  return firstFinite(token,METRICS[key]||[]);
}

export function evaluateSettingsGate(token={},settings={}){
  const gates=[];
  let blocked=false;
  let waiting=false;

  const add=(name,result,reason,{key=null,value=null,threshold=null,operator=null,retryable=false,source=null}={})=>{
    const status=result===null||result===undefined?'WAITING':result?'PASS':'FAIL';
    const gate={name,key,status,pass:status==='PASS',reason,value,threshold,operator,retryable:Boolean(retryable),source};
    gates.push(gate);
    if(status==='FAIL')blocked=true;
    else if(status==='WAITING')waiting=true;
    return gate;
  };

  const range=(label,key,minKey,maxKey,{minRetryable=true,maxRetryable=true}={})=>{
    const value=metric(token,key);
    const min=settingNumber(settings,minKey);
    const max=settingNumber(settings,maxKey);
    if(min!==null&&min>0){
      add(`${label} minimum`,value===null?null:value>=min,`${label.toLowerCase()} below ${min}`,{key:minKey,value,threshold:min,operator:'>=',retryable:minRetryable,source:key});
    }
    if(max!==null){
      add(`${label} maximum`,value===null?null:value<=max,`${label.toLowerCase()} above ${max}`,{key:maxKey,value,threshold:max,operator:'<=',retryable:maxRetryable,source:key});
    }
  };

  if(Array.isArray(settings.launchPlatforms)&&settings.launchPlatforms.length){
    const platform=firstText(token,['launchPlatform','protocol','platform','source']);
    const requested=settings.launchPlatforms.map(x=>String(x||'').trim().toLowerCase()).filter(Boolean);
    add('Launch platform',platform?requested.some(p=>platform.toLowerCase().includes(p.replace('_',' '))):null,
      `launch platform not in ${requested.join(', ')}`,{key:'launchPlatforms',value:platform,threshold:requested,operator:'in',retryable:false,source:'launchPlatform'});
  }

  const text=tokenSearchText(token);
  const include=keywordList(settings.includeKeywords);
  const exclude=keywordList(settings.excludeKeywords);
  if(include.length){
    add('Include keywords',text?include.some(k=>text.includes(k)):null,
      `none of required keywords found: ${include.join(', ')}`,{key:'includeKeywords',value:text||null,threshold:include,operator:'contains-any',retryable:false,source:'tokenText'});
  }
  if(exclude.length){
    add('Exclude keywords',text?!exclude.some(k=>text.includes(k)):null,
      `excluded keyword found`,{key:'excludeKeywords',value:text||null,threshold:exclude,operator:'contains-none',retryable:false,source:'tokenText'});
  }

  range('Bonding curve','bondingCurvePct','minBondingCurvePct','maxBondingCurvePct',{minRetryable:true,maxRetryable:false});
  range('Market cap USD','marketCapUsd','minMarketCapUsd','maxMarketCapUsd');
  range('Total fees SOL','totalFeesSol','minTotalFeesSol','maxTotalFeesSol');
  range('24h volume USD','volume24hUsd','minVolume24hUsd','maxVolume24hUsd');
  range('Buy transactions','buyTransactions','minBuyTransactions','maxBuyTransactions');
  range('Sell transactions','sellTransactions','minSellTransactions','maxSellTransactions');
  range('Total transactions','totalTransactions','minTotalTransactions','maxTotalTransactions');
  range('Holders','holders','minHolders','maxHolders');
  range('Bundle','bundlePct','minBundlePct','maxBundlePct');

  const age=tokenAgeMinutes(token);
  const minAge=settingNumber(settings,'minTokenAgeMinutes');
  const maxAge=settingNumber(settings,'maxTokenAgeMinutes');
  if(minAge!==null&&minAge>0){
    add('Token minimum age',age===null?null:age>=minAge,`token younger than ${minAge}m`,{key:'minTokenAgeMinutes',value:age,threshold:minAge,operator:'>=',retryable:true,source:'tokenAgeMinutes'});
  }
  if(maxAge!==null){
    add('Token maximum age',age===null?null:age<=maxAge,`token older than ${maxAge}m`,{key:'maxTokenAgeMinutes',value:age,threshold:maxAge,operator:'<=',retryable:false,source:'tokenAgeMinutes'});
  }

  range('Top 10 concentration','top10Pct','minTop10Pct','maxTop10Pct');
  range('Developer share','developerPct','minDeveloperPct','maxDeveloperPct');
  range('Sniper share','sniperPct','minSniperPct','maxSniperPct');

  // MEMEFLOW_WS_FIRST_PREOPEN_RPC_V1
  // Final pre-open policy. Missing RPC evidence is intentionally absent from
  // the fast scanner. Once known, excess linked-wallet risk is hard BLOCKED.
  const maxRiskyWallets=settingNumber(settings,'maxSuspectedRiskyWalletsPct');

  if(maxRiskyWallets!==null){
    const value=metric(token,'suspectedRiskyWalletsPct');

    if(value!==null){
      add(
        'Suspected risky wallets maximum',
        value<=maxRiskyWallets,
        `suspected risky wallets above ${maxRiskyWallets}%`,
        {
          key:'maxSuspectedRiskyWalletsPct',
          value,
          threshold:maxRiskyWallets,
          operator:'<=',
          retryable:false,
          source:'suspectedRiskyWalletsPct'
        }
      );
    }
  }

  const maxInsiders=settingNumber(settings,'maxInsidersPct');

  if(maxInsiders!==null){
    const value=metric(token,'insidersPct');

    if(value!==null){
      add(
        'Insiders maximum',
        value<=maxInsiders,
        `creator-linked wallets above ${maxInsiders}%`,
        {
          key:'maxInsidersPct',
          value,
          threshold:maxInsiders,
          operator:'<=',
          retryable:false,
          source:'insidersPct'
        }
      );
    }
  }

  const minLiquidity=enabledPositive(settings,'minLiquidityUsd');
  if(minLiquidity!==null){
    const value=metric(token,'liquidityUsd');
    add('Minimum liquidity',value===null?null:value>=minLiquidity,`liquidity below $${minLiquidity}`,{key:'minLiquidityUsd',value,threshold:minLiquidity,operator:'>=',retryable:true,source:'liquidityUsd'});
  }

  const minPressure=enabledPositive(settings,'minBuyPressure');
  if(minPressure!==null){
    const value=metric(token,'buyPressure');
    add('Buy pressure',value===null?null:value>=minPressure,`buy pressure below ${minPressure}×`,{key:'minBuyPressure',value,threshold:minPressure,operator:'>=',retryable:true,source:'buyPressure'});
  }

  const blacklist=Array.isArray(settings.developerBlacklistWallets)
    ? settings.developerBlacklistWallets.map(x=>String(x||'').trim()).filter(Boolean)
    : String(settings.developerBlacklistWallets||'').split(/[\s,]+/).filter(Boolean);
  if(blacklist.length){
    const creator=firstText(token,['creator','creatorWallet','developerWallet','devWallet']);
    const lowered=new Set(blacklist.map(x=>x.toLowerCase()));
    add('Developer blacklist',creator? !lowered.has(creator.toLowerCase()):null,'developer wallet is blacklisted',{
      key:'developerBlacklistWallets',value:creator,threshold:blacklist,operator:'not-in',retryable:false,source:'creator'});
  }

  const twitter=socialState(token,'twitter');
  const website=socialState(token,'website');
  const telegram=socialState(token,'telegram');
  if(settings.requireTwitter===true){
    add('Twitter / X required',twitter,'Twitter / X is required',{key:'requireTwitter',value:twitter,threshold:true,operator:'present',retryable:false,source:'social'});
  }
  if(settings.requireWebsite===true){
    add('Website required',website,'website is required',{key:'requireWebsite',value:website,threshold:true,operator:'present',retryable:false,source:'social'});
  }
  if(settings.requireTelegram===true){
    add('Telegram required',telegram,'Telegram is required',{key:'requireTelegram',value:telegram,threshold:true,operator:'present',retryable:false,source:'social'});
  }
  if(settings.requireAnySocial===true){
    const values=[twitter,website,telegram];
    const result=values.some(v=>v===true)?true:(values.every(v=>v===false)?false:null);
    add('Any social required',result,'at least one social is required',{key:'requireAnySocial',value:values,threshold:true,operator:'any-present',retryable:false,source:'social'});
  }
  if(settings.requireWebsiteOrX===true){
    const values=[website,twitter];
    const result=values.some(v=>v===true)?true:(values.every(v=>v===false)?false:null);
    add('Website or X required',result,'website or X is required',{key:'requireWebsiteOrX',value:values,threshold:true,operator:'any-present',retryable:false,source:'social'});
  }

  if(settings.requireFreshHolderSnapshot===true){
    add('Fresh holder snapshot',token.holderFresh===true?true:null,'waiting for fresh holder snapshot',{
      key:'requireFreshHolderSnapshot',value:token.holderFresh===true,threshold:true,operator:'===',retryable:true,source:'holderFresh'});
  }

  const failedGates=gates.filter(g=>g.status==='FAIL');
  const waitingGates=gates.filter(g=>g.status==='WAITING');
  return {
    state:blocked?'BLOCKED':(waiting?'WAITING':'PASS'),
    blocked,
    waiting,
    gates,
    failedGates,
    waitingGates,
    hasRetryableFailure:failedGates.some(g=>g.retryable),
    hasStableFailure:failedGates.some(g=>!g.retryable),
    reasons:[...failedGates,...waitingGates].map(g=>g.reason)
  };
}


export function settingsContextSignature(entries=[]){
  if(!Array.isArray(entries)||entries.length===0)return 'no-active-users';
  const raw=entries
    .map(entry=>`${String(entry?.uid||'')}:${String(entry?.version??'')}`)
    .sort()
    .join('|');
  return crypto.createHash('sha1').update(raw).digest('hex').slice(0,20);
}

export function evaluateSettingsAdmission(token={},entries=[],options={}){
  const now=Number(options.recheckMs)||5000;
  void now;
  const at=Number(options.now)||Date.now();
  const recheckMs=Math.max(1000,Number(options.recheckMs)||5000);
  const context=Array.isArray(entries)?entries:[];
  const signature=settingsContextSignature(context);

  if(context.length===0){
    return {
      allow:true,
      drop:false,
      reason:'no_active_users_fail_open',
      signature,
      users:0,
      retryable:false,
      recheckAt:null,
      blockedUsers:0,
      reasons:[]
    };
  }

  const blocked=[];

  for(const entry of context){
    const gate=evaluateEntryAdmission(
      token,
      entry?.settings||{},
      {now:at}
    );

    // At least one active user already passes every real Entry Filter.
    if(gate.admitted===true){
      return {
        allow:true,
        drop:false,
        reason:'active_user_entry_filters_pass',
        signature,
        users:context.length,
        retryable:false,
        recheckAt:null,
        blockedUsers:blocked.length,
        uid:entry?.uid||null,
        gate
      };
    }

    // Missing data for an ENABLED Entry Filter must be allowed to warm.
    // This preserves holder/market enrichment without letting Logic settings
    // (buy pressure, confidence, website/X decision rule, etc.) reject raw WS.
    if(
      gate.state==='PENDING' &&
      Array.isArray(gate.waitingGates) &&
      gate.waitingGates.length>0
    ){
      return {
        allow:true,
        drop:false,
        reason:'active_user_entry_data_pending',
        signature,
        users:context.length,
        retryable:false,
        recheckAt:null,
        blockedUsers:blocked.length,
        uid:entry?.uid||null,
        gate
      };
    }

    blocked.push({uid:entry?.uid||null,gate});
  }

  const failed=blocked.flatMap(row=>row.gate.failedGates||[]);

  // Retry only if at least one user is blocked exclusively by market facts
  // that can recover (MC/holders/concentration/etc.). Stable failures such as
  // platform/keyword/blacklist can be safely discarded for that settings set.
  const retryable=blocked.some(
    row=>row.gate.hasStableFailure!==true
  );

  const reasons=[
    ...new Set(
      failed.map(g=>g.reason).filter(Boolean)
    )
  ].slice(0,8);

  return {
    allow:false,
    drop:true,
    reason:'entry_filters_rejected_for_all_active_users',
    signature,
    users:context.length,
    retryable,
    recheckAt:retryable?at+recheckMs:null,
    blockedUsers:blocked.length,
    reasons,
    failedKeys:[
      ...new Set(
        failed.map(g=>g.key).filter(Boolean)
      )
    ].slice(0,16)
  };
}

// MEMEFLOW_STRICT_ENTRY_ADMISSION_V1
// MEMEFLOW_SETTINGS_ARCHITECTURE_V2
//
// Settings are intentionally split into three non-overlapping policy layers:
//
// 1) ENTRY_ADMISSION_KEYS
//    Decide TRADE eligibility only. They never control Pump discovery,
//    scanner retention, data collection, or Live Token States visibility.
//
// 2) LOGIC_DECISION_KEYS
//    Run only AFTER trade admission. They may produce WAITING / WATCH /
//    BUY READY, but they never remove a token from scanner/display inventory.
//
// 3) PREOPEN_RPC_KEYS
//    Heavy linked/funded-wallet verification. These are FINAL-ONLY and remain
//    behind BUY READY. They never participate in scanner/display admission.
export const ENTRY_ADMISSION_KEYS = Object.freeze([
  'launchPlatforms',
  'includeKeywords',
  'excludeKeywords',

  'minBondingCurvePct',
  'maxBondingCurvePct',
  'minMarketCapUsd',
  'maxMarketCapUsd',
  'minTotalFeesSol',
  'maxTotalFeesSol',
  'minVolume24hUsd',
  'maxVolume24hUsd',
  'minBuyTransactions',
  'maxBuyTransactions',
  'minSellTransactions',
  'maxSellTransactions',
  'minTotalTransactions',
  'maxTotalTransactions',
  'minHolders',
  'maxHolders',
  'minBundlePct',
  'maxBundlePct',
  'minTokenAgeMinutes',
  'maxTokenAgeMinutes',
  'minTop10Pct',
  'maxTop10Pct',
  'minDeveloperPct',
  'maxDeveloperPct',
  'minSniperPct',
  'maxSniperPct',
  'minLiquidityUsd',

  'developerBlacklistWallets',
  'requireTwitter',
  'requireWebsite',
  'requireTelegram',
  'requireAnySocial'
]);

export const LOGIC_DECISION_KEYS = Object.freeze([
  'minScore',
  'minConfidence',
  'minBuyPressure',
  'decisionFreshnessSec',
  'requireFreshHolderSnapshot',
  'requireWebsiteOrX'
]);

export const PREOPEN_RPC_KEYS = Object.freeze([
  'maxSuspectedRiskyWalletsPct',
  'maxInsidersPct'
]);

const ENTRY_ADMISSION_KEY_SET = new Set(ENTRY_ADMISSION_KEYS);

export function evaluateEntryAdmission(token={},settings={},options={}){
  const now=Number(options?.now)||Date.now();
  void now;

  // evaluateSettingsGate is CPU-only. We intentionally reuse its canonical
  // metric readers, then keep ONLY real Entry Filter gates.
  const full=evaluateSettingsGate(token,settings);

  const gates=(full.gates||[])
    .filter(g=>ENTRY_ADMISSION_KEY_SET.has(String(g?.key||'')));

  const failedGates=gates.filter(g=>g?.status==='FAIL');
  const waitingGates=gates.filter(g=>g?.status==='WAITING');

  const hasStableFailure=failedGates.some(g=>g?.retryable!==true);
  const hasRetryableFailure=failedGates.some(g=>g?.retryable===true);
  const admitted=failedGates.length===0&&waitingGates.length===0;

  let state='ADMITTED';
  if(!admitted){
    state=hasStableFailure?'REJECTED':'PENDING';
  }

  return {
    admitted,
    state,
    gates,
    failedGates,
    waitingGates,
    hasStableFailure,
    hasRetryableFailure,
    entryKeys:ENTRY_ADMISSION_KEYS,
    logicKeys:LOGIC_DECISION_KEYS,
    finalOnlyKeys:PREOPEN_RPC_KEYS,
    reasons:[...failedGates,...waitingGates]
      .map(g=>g?.reason)
      .filter(Boolean)
  };
}

export function isEntryAdmitted(token={},settings={},options={}){
  return evaluateEntryAdmission(token,settings,options).admitted===true;
}
