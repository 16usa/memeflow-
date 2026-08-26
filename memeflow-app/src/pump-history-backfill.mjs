const DEFAULT_URL='https://frontend-api-v3.pump.fun/coins';

function finite(v){
  const n=Number(v);
  return Number.isFinite(n)?n:null;
}
function createdMs(coin){
  const raw=finite(
    coin?.created_timestamp ??
    coin?.createdTimestamp ??
    coin?.created_at ??
    coin?.createdAt
  );
  if(raw===null||raw<=0)return null;
  return raw<1e12?raw*1000:raw;
}
function listFromBody(body){
  if(Array.isArray(body))return body;
  if(Array.isArray(body?.data))return body.data;
  if(Array.isArray(body?.coins))return body.coins;
  if(Array.isArray(body?.data?.coins))return body.data.coins;
  if(Array.isArray(body?.results))return body.results;
  return [];
}
function coinToken(coin,{recent=false}={}){
  const mint=String(coin?.mint||coin?.address||'').trim();
  if(!mint)return null;

  const created=createdMs(coin);
  const now=Date.now();

  return {
    mint,
    name:coin?.name||null,
    symbol:coin?.symbol||null,
    uri:coin?.metadata_uri||coin?.metadataUri||coin?.uri||null,
    imageUri:coin?.image_uri||coin?.imageUri||null,
    creator:coin?.creator||null,
    curve:coin?.bonding_curve||coin?.bondingCurve||null,
    bondingCurve:coin?.bonding_curve||coin?.bondingCurve||null,
    pumpCreatedAt:created,
    discoveredAt:created||now,
    marketCapUsd:finite(coin?.usd_market_cap??coin?.marketCapUsd),
    marketCapSol:finite(coin?.market_cap??coin?.marketCap),
    totalSupply:finite(coin?.total_supply??coin?.totalSupply),
    complete:coin?.complete===true,
    raydiumPool:coin?.raydium_pool||coin?.raydiumPool||null,
    twitterUrl:coin?.twitter||null,
    telegramUrl:coin?.telegram||null,
    websiteUrl:coin?.website||null,
    launchPlatform:'pump',
    protocol:'pump',
    registryHistorical:true,
    // Recent head-sync repairs a restart/deploy gap. Deep history stays cold
    // until it has fresh activity.
    wsFirst:recent===true,
    source:recent?'Pump history gap sync':'Pump historical backfill',
    updatedAt:now
  };
}

function sleep(ms){return new Promise(resolve=>setTimeout(resolve,ms))}

export function startPumpHistoryBackfill({
  registry,
  onRecentToken=null
}={}){
  const metrics={
    version:'PUMP_HISTORY_BACKFILL_V1',
    enabled:process.env.PUMPFUN_HISTORY_ENABLED!=='false',
    startedAt:Date.now(),
    running:false,
    authRequired:false,
    requests:0,
    pages:0,
    coinsSeen:0,
    coinsStored:0,
    recentGapCoins:0,
    rateLimited:0,
    errors:0,
    offset:0,
    caughtUp:false,
    lastRequestAt:null,
    lastSuccessAt:null,
    lastError:null
  };

  if(!registry||metrics.enabled!==true){
    return {metrics:()=>({...metrics}),stop(){}};
  }

  const endpoint=String(process.env.PUMPFUN_HISTORY_URL||DEFAULT_URL).trim();
  const jwt=String(process.env.PUMPFUN_HISTORY_JWT||'').trim();
  const pageSize=Math.max(10,Math.min(100,Number(process.env.PUMPFUN_HISTORY_PAGE_SIZE||100)));
  const intervalMs=Math.max(1000,Number(process.env.PUMPFUN_HISTORY_INTERVAL_MS||2500));
  const recentEveryMs=Math.max(30000,Number(process.env.PUMPFUN_HISTORY_RECENT_SYNC_MS||60000));
  const startDelayMs=Math.max(3000,Number(process.env.PUMPFUN_HISTORY_START_DELAY_MS||5000));

  let stopped=false;
  let lastRecentAt=0;

  const checkpoint=registry.getCheckpoint('pump-history-deep-v1',{offset:0})||{offset:0};
  metrics.offset=Math.max(0,Number(checkpoint.offset)||0);

  async function requestPage({offset,order}){
    const url=new URL(endpoint);
    url.searchParams.set('limit',String(pageSize));
    url.searchParams.set('offset',String(offset));
    url.searchParams.set('sort','created_timestamp');
    url.searchParams.set('order',order);
    url.searchParams.set('includeNsfw','true');

    const headers={
      accept:'application/json',
      origin:'https://pump.fun'
    };
    if(jwt)headers.authorization=`Bearer ${jwt}`;

    metrics.requests++;
    metrics.lastRequestAt=Date.now();

    const response=await fetch(url,{
      method:'GET',
      headers,
      signal:AbortSignal.timeout(12000)
    });

    if(response.status===401||response.status===403){
      metrics.authRequired=true;
      throw new Error('PUMPFUN_HISTORY_AUTH_REQUIRED');
    }

    if(response.status===429){
      metrics.rateLimited++;
      const retry=Number(response.headers.get('retry-after'));
      const error=new Error('PUMPFUN_HISTORY_RATE_LIMITED');
      error.retryAfterMs=Number.isFinite(retry)&&retry>0?retry*1000:60000;
      throw error;
    }

    if(!response.ok){
      throw new Error(`PUMPFUN_HISTORY_HTTP_${response.status}`);
    }

    metrics.authRequired=false;
    const body=await response.json();
    return listFromBody(body);
  }

  async function recentGapSync(){
    const coins=await requestPage({offset:0,order:'DESC'});
    metrics.pages++;

    for(const coin of coins){
      const token=coinToken(coin,{recent:true});
      if(!token)continue;

      metrics.coinsSeen++;
      metrics.recentGapCoins++;
      registry.queueUpsert(token,{historical:true});
      metrics.coinsStored++;

      try{onRecentToken?.(token)}catch{}
    }

    registry.setCheckpoint('pump-history-head-v1',{
      syncedAt:Date.now(),
      count:coins.length
    });

    lastRecentAt=Date.now();
  }

  async function deepStep(){
    const coins=await requestPage({
      offset:metrics.offset,
      order:'ASC'
    });

    metrics.pages++;

    for(const coin of coins){
      const token=coinToken(coin,{recent:false});
      if(!token)continue;
      metrics.coinsSeen++;
      registry.queueUpsert(token,{historical:true});
      metrics.coinsStored++;
    }

    if(coins.length){
      metrics.offset+=coins.length;
      registry.setCheckpoint('pump-history-deep-v1',{
        offset:metrics.offset,
        updatedAt:Date.now()
      });
    }

    metrics.caughtUp=coins.length<pageSize;
    metrics.lastSuccessAt=Date.now();
    metrics.lastError=null;
  }

  async function loop(){
    await sleep(startDelayMs);

    while(!stopped){
      metrics.running=true;

      try{
        // Head sync first: deploy/restart gaps are repaired before deep history.
        if(Date.now()-lastRecentAt>=recentEveryMs){
          await recentGapSync();
          await sleep(Math.min(1000,intervalMs));
        }

        await deepStep();
      }catch(error){
        metrics.errors++;
        metrics.lastError=String(error?.message||error);

        const wait=
          Number(error?.retryAfterMs) ||
          (metrics.authRequired?10*60_000:Math.max(5000,intervalMs*2));

        await sleep(wait);
        continue;
      }

      await sleep(metrics.caughtUp?Math.max(30000,recentEveryMs):intervalMs);
    }

    metrics.running=false;
  }

  void loop();

  return {
    metrics:()=>({...metrics}),
    stop(){stopped=true;metrics.running=false}
  };
}
