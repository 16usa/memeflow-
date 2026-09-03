
const finite=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

async function fetchJson(url,timeoutMs=4000){
  const c=new AbortController();
  const t=setTimeout(()=>c.abort(),timeoutMs);
  try{
    const r=await fetch(url,{signal:c.signal,headers:{accept:'application/json','user-agent':'MEMEFLOW/1.0 sol-usd-oracle'}});
    if(!r.ok)throw new Error(`HTTP ${r.status}`);
    return await r.json();
  }finally{clearTimeout(t)}
}

function fromCoinGecko(data){
  const n=data?.solana?.usd;
  return finite(n)?Number(n):null;
}

export function createSolUsdOracle(options={}){
  const fixed=finite(process.env.SOL_USD_PRICE)?Number(process.env.SOL_USD_PRICE):null;
  let price=fixed,updatedAt=fixed?Date.now():0,lastError=null,source=fixed?'env':null,timer=null,stopped=false,inflight=null;
  const intervalMs=Math.max(10_000,Number(options.intervalMs||process.env.SOL_USD_ORACLE_INTERVAL_MS||30_000));
  const maxAgeMs=Math.max(intervalMs*2,Number(options.maxAgeMs||process.env.SOL_USD_ORACLE_MAX_AGE_MS||120_000));

  async function refresh(){
    if(fixed!==null)return fixed;
    if(inflight)return inflight;
    inflight=(async()=>{
      const attempts=[
        async()=>['coingecko',fromCoinGecko(await fetchJson('https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd'))]
      ];
      let err=null;
      for(const fn of attempts){
        try{
          const [src,p]=await fn();
          if(finite(p)&&p>0){
            price=Number(p);updatedAt=Date.now();source=src;lastError=null;
            return price;
          }
        }catch(e){err=e}
      }
      lastError=String(err?.message||err||'SOL/USD unavailable').slice(0,160);
      return null;
    })().finally(()=>{inflight=null});
    return inflight;
  }

  function schedule(){
    if(stopped||fixed!==null)return;
    clearTimeout(timer);
    timer=setTimeout(async()=>{
      await refresh().catch(()=>{});
      schedule();
    },intervalMs);
    timer.unref?.();
  }
  function start(){
    if(fixed!==null)return;
    void refresh().finally(schedule);
  }
  function get(){
    if(!finite(price)||price<=0)return null;
    if(fixed!==null)return fixed;
    return Date.now()-updatedAt<=maxAgeMs?price:null;
  }
  function stop(){stopped=true;clearTimeout(timer)}
  function diagnostics(){return {price:get(),rawPrice:price,updatedAt:updatedAt||null,source,lastError,fixed:fixed!==null,intervalMs,maxAgeMs}}
  return {start,refresh,get,stop,diagnostics};
}
