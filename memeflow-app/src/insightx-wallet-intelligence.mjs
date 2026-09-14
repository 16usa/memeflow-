// MEMEFLOW_INSIGHTX_WALLET_INTELLIGENCE_V1
// Supplemental, read-only holder intelligence. It must never become a hidden
// scoring authority. Existing Solana RPC holder data and canonical evaluate()
// remain authoritative unless a future, separately reviewed policy says so.

const DEFAULT_API_BASE='https://api.insightx.network';
const DEFAULT_EMBED_BASE='https://embed.insightx.network/atlas';

const asBool=(value,fallback=false)=>{
  if(value===undefined||value===null||value==='')return fallback;
  return /^(1|true|yes|on)$/i.test(String(value));
};
const finite=value=>{
  if(value===null||value===undefined||value==='')return null;
  const n=Number(value);
  return Number.isFinite(n)?n:null;
};
const clampPct=value=>{
  const n=finite(value);
  return n===null?null:Math.max(0,Math.min(100,n));
};
const array=value=>Array.isArray(value)?value:[];
const object=value=>value&&typeof value==='object'&&!Array.isArray(value)?value:{};
const unwrap=value=>{
  const row=object(value);
  return object(row.data && !Array.isArray(row.data) ? row.data : row);
};

function safeTags(value){
  return array(value)
    .map(tag=>String(tag||'').trim().toLowerCase())
    .filter(Boolean)
    .slice(0,24);
}

export function buildInsightXAtlasUrlV1(
  mint,
  {
    network='sol',
    embedId='',
    embedBase=DEFAULT_EMBED_BASE
  }={}
){
  const address=String(mint||'').trim();
  if(!address)return null;
  const base=String(embedBase||DEFAULT_EMBED_BASE).replace(/\/+$/,'');
  const url=new URL(`${base}/${encodeURIComponent(network)}/${encodeURIComponent(address)}`);
  const id=String(embedId||'').trim();
  if(id)url.searchParams.set('embed_id',id);
  return url.toString();
}

export function normalizeInsightXWalletIntelligenceV1({
  mint='',
  clusters=null,
  distribution=null,
  bundlers=null,
  insiders=null,
  snipers=null,
  fetchedAt=Date.now()
}={}){
  const clusterData=unwrap(clusters);
  const distributionData=unwrap(distribution);
  const bundlerData=unwrap(bundlers);
  const insiderData=unwrap(insiders);
  const sniperData=unwrap(snipers);

  const clusterRows=array(clusterData.clusters);
  const linkedWallets=new Set();
  const tagCounts={};
  const tagSupplyPct={};
  let largestClusterPct=null;

  const normalizedClusters=clusterRows
    .map((cluster,index)=>{
      const pct=clampPct(cluster?.pct ?? cluster?.percentage);
      const tags=safeTags(cluster?.tags);
      const addresses=array(cluster?.cluster_addresses ?? cluster?.addresses ?? cluster?.wallets);
      const wallets=[];

      for(const row of addresses){
        const address=String(row?.address||row?.wallet||'').trim();
        if(address)linkedWallets.add(address);
        const rowTags=safeTags(row?.tags);
        for(const tag of rowTags)tagCounts[tag]=(tagCounts[tag]||0)+1;
        if(address){
          wallets.push({
            address,
            percentage:clampPct(row?.percentage ?? row?.pct),
            tags:rowTags
          });
        }
      }

      for(const tag of tags){
        tagCounts[tag]=(tagCounts[tag]||0)+1;
        if(pct!==null)tagSupplyPct[tag]=(tagSupplyPct[tag]||0)+pct;
      }

      if(pct!==null&&(largestClusterPct===null||pct>largestClusterPct))largestClusterPct=pct;

      return {
        index:index+1,
        pct,
        tags,
        walletCount:wallets.length,
        wallets:wallets.slice(0,12)
      };
    })
    .sort((a,b)=>(b.pct??-1)-(a.pct??-1))
    .slice(0,20);

  const insidersPct=clampPct(
    insiderData.insiders_pct ??
    insiderData.total_insiders_pct ??
    insiderData.total_insider_pct
  );
  const devPct=clampPct(
    insiderData.dev_pct ??
    insiderData.developer_pct ??
    insiderData.creator_pct
  );
  const insiderCombinedPct=(insidersPct===null&&devPct===null)
    ? null
    : Math.min(100,(insidersPct||0)+(devPct||0));

  return {
    provider:'InsightX',
    mode:'shadow',
    scoreAuthority:false,
    mint:String(mint||''),
    fetchedAt:Number(fetchedAt)||Date.now(),
    clusterCount:clusterRows.length,
    linkedWalletCount:linkedWallets.size,
    clusteredSupplyPct:clampPct(
      clusterData.total_cluster_pct ??
      clusterData.clustered_supply_pct ??
      clusterData.total_clusters_pct
    ),
    largestClusterPct,
    clusters:normalizedClusters,
    tagCounts,
    tagSupplyPct:Object.fromEntries(
      Object.entries(tagSupplyPct).map(([tag,pct])=>[tag,Math.min(100,pct)])
    ),
    distribution:{
      gini:finite(distributionData.gini),
      hhi:finite(distributionData.hhi),
      nakamoto:finite(distributionData.nakamoto),
      top10Pct:clampPct(
        distributionData.top_10_holder_concentration ??
        distributionData.top10_pct ??
        distributionData.top_10_pct
      )
    },
    bundlersPct:clampPct(
      bundlerData.total_bundlers_pct ?? bundlerData.bundlers_pct
    ),
    bundlerCount:array(bundlerData.bundlers).length,
    insidersPct,
    devPct,
    insiderCombinedPct,
    insiderCount:array(insiderData.insiders).length,
    snipersPct:clampPct(
      sniperData.total_sniper_pct ?? sniperData.snipers_pct
    ),
    sniperCount:finite(sniperData?.count?.total) ?? array(sniperData.snipers).length
  };
}

export function createInsightXWalletIntelligenceV1({
  env=process.env,
  fetchImpl=globalThis.fetch,
  now=()=>Date.now()
}={}){
  const apiKey=String(env.INSIGHTX_API_KEY||'').trim();
  const enabled=asBool(env.INSIGHTX_ENABLED,true);
  const extended=asBool(env.INSIGHTX_EXTENDED_METRICS,true);
  const shadowPrefetch=asBool(env.INSIGHTX_SHADOW_PREFETCH,false);
  const apiBase=String(env.INSIGHTX_API_BASE_URL||DEFAULT_API_BASE).replace(/\/+$/,'');
  const embedBase=String(env.INSIGHTX_ATLAS_EMBED_BASE_URL||DEFAULT_EMBED_BASE).replace(/\/+$/,'');
  const embedId=String(env.INSIGHTX_ATLAS_EMBED_ID||'').trim();
  const timeoutMs=Math.max(1000,Math.min(15000,Number(env.INSIGHTX_REQUEST_TIMEOUT_MS||5000)));
  const cacheTtlMs=Math.max(5000,Math.min(15*60_000,Number(env.INSIGHTX_CACHE_TTL_MS||60_000)));
  const maxCache=Math.max(20,Math.min(2000,Number(env.INSIGHTX_CACHE_MAX_TOKENS||500)));
  const cache=new Map();
  const inFlight=new Map();

  function atlasUrl(mint){
    return buildInsightXAtlasUrlV1(mint,{network:'sol',embedId,embedBase});
  }

  function publicConfig(mint=''){
    return {
      provider:'InsightX',
      enabled,
      apiConfigured:Boolean(apiKey),
      atlasConfigured:Boolean(embedId),
      shadowPrefetch,
      scoreAuthority:false,
      mode:'shadow',
      atlasUrl:mint?atlasUrl(mint):null
    };
  }

  async function requestEndpoint(mint,suffix){
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),timeoutMs);
    const endpoint=`${apiBase}/dex-metrics/v1/sol/${encodeURIComponent(mint)}/${suffix}`;
    try{
      const response=await fetchImpl(endpoint,{
        method:'GET',
        headers:{
          accept:'application/json',
          'X-API-Key':apiKey
        },
        signal:controller.signal
      });
      const text=await response.text();
      let data=null;
      try{data=text?JSON.parse(text):{}}catch{data={detail:text.slice(0,240)}}
      if(!response.ok){
        return {
          ok:false,
          status:response.status,
          retryAfter:response.headers?.get?.('retry-after')||null,
          error:String(data?.detail||data?.message||`InsightX HTTP ${response.status}`).slice(0,240),
          data:null
        };
      }
      return {ok:true,status:response.status,data,error:null};
    }catch(error){
      return {
        ok:false,
        status:0,
        error:error?.name==='AbortError'?'InsightX request timeout':String(error?.message||error).slice(0,240),
        data:null
      };
    }finally{
      clearTimeout(timer);
    }
  }

  function remember(key,value){
    cache.delete(key);
    cache.set(key,{at:now(),value});
    while(cache.size>maxCache){
      const first=cache.keys().next().value;
      if(first===undefined)break;
      cache.delete(first);
    }
  }

  async function load(mint,{force=false,compact=false}={}){
    mint=String(mint||'').trim();
    const key=`${mint}:${compact?'compact':'full'}`;
    const cached=cache.get(key);
    if(!force&&cached&&(now()-cached.at)<cacheTtlMs){
      return {...cached.value,cached:true};
    }
    if(!force&&inFlight.has(key))return inFlight.get(key);

    const job=(async()=>{
      const base={
        ok:false,
        status:'DISABLED',
        mint,
        cached:false,
        ...publicConfig(mint),
        intelligence:null,
        endpointStatus:{}
      };

      if(!enabled)return base;
      if(!apiKey)return {...base,status:'API_KEY_MISSING'};
      if(typeof fetchImpl!=='function')return {...base,status:'FETCH_UNAVAILABLE'};

      const names=compact||!extended
        ? ['clusters']
        : ['clusters','distribution','bundlers','insiders','snipers'];
      const settled=await Promise.all(
        names.map(async name=>[name,await requestEndpoint(mint,name)])
      );
      const endpoints=Object.fromEntries(settled);
      const successCount=Object.values(endpoints).filter(row=>row.ok).length;
      const intelligence=normalizeInsightXWalletIntelligenceV1({
        mint,
        clusters:endpoints.clusters?.data,
        distribution:endpoints.distribution?.data,
        bundlers:endpoints.bundlers?.data,
        insiders:endpoints.insiders?.data,
        snipers:endpoints.snipers?.data,
        fetchedAt:now()
      });
      const endpointStatus=Object.fromEntries(
        Object.entries(endpoints).map(([name,row])=>[
          name,
          {ok:row.ok,status:row.status,error:row.error||null,retryAfter:row.retryAfter||null}
        ])
      );
      const value={
        ...base,
        ok:successCount>0,
        status:successCount===names.length?'READY':successCount>0?'PARTIAL':'UPSTREAM_ERROR',
        intelligence,
        endpointStatus
      };
      remember(key,value);
      return value;
    })().finally(()=>inFlight.delete(key));

    inFlight.set(key,job);
    return job;
  }

  return {
    get:load,
    publicConfig,
    atlasUrl,
    clear:()=>cache.clear()
  };
}
