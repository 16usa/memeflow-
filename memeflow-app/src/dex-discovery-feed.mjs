const VERSION='DEX_STREAM_V1_1';
const WSOL='So11111111111111111111111111111111111111112';

const PROGRAMS=[
  {key:'pumpswap',name:'PumpSwap',programId:'pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA',create:/Instruction:\s*(?:CreatePool|CreatePoolV2)\s*$/i,dex:/pump/i},
  {key:'raydium-cpmm',name:'Raydium CPMM',programId:'CPMMoo8L3F4NbTegBCKVNunggL7H1ZpdTHKxQB5qKP1C',create:/Instruction:\s*(?:Initialize|Initialize2|CreatePool|CreatePoolV2)\s*$/i,dex:/raydium/i},
  {key:'raydium-clmm',name:'Raydium CLMM',programId:'CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaW7grrKgrWqK',create:/Instruction:\s*(?:CreatePool|CreatePoolV2)\s*$/i,dex:/raydium/i}
];

const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const finite=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));

function envList(name){
  return String(process.env[name]||'').split(',').map(x=>x.trim()).filter(Boolean);
}
function wsFromHttp(u){
  try{
    const x=new URL(u);
    x.protocol=x.protocol==='https:'?'wss:':'ws:';
    return x.toString();
  }catch{return null}
}
async function makeWS(url){
  if(typeof globalThis.WebSocket==='function')return new globalThis.WebSocket(url);
  const mod=await import('ws');
  return new mod.WebSocket(url);
}
function txMints(tx){
  const out=new Set();
  for(const row of [...(tx?.meta?.preTokenBalances||[]),...(tx?.meta?.postTokenBalances||[])]){
    const mint=String(row?.mint||'').trim();
    if(mint)out.add(mint);
  }
  return [...out];
}
function firstWebsite(info){
  return Array.isArray(info?.websites)?(info.websites.find(x=>x?.url)?.url||null):null;
}
function social(info,platform){
  const rows=Array.isArray(info?.socials)?info.socials:[];
  const row=rows.find(x=>String(x?.platform||'').toLowerCase()===platform);
  return row?(row.url||row.handle||null):null;
}
function pairActivity(pair){
  for(const k of ['m5','h1','h6','h24']){
    const r=pair?.txns?.[k];
    const buys=Number(r?.buys||0),sells=Number(r?.sells||0);
    if(buys+sells>0)return {window:k,buys,sells};
  }
  return {window:null,buys:0,sells:0};
}
function marketPatch(pair,mint){
  const act=pairActivity(pair);
  const pressure=act.sells>0?act.buys/act.sells:(act.buys>0?Math.max(1,act.buys):null);
  const base=String(pair?.baseToken?.address||'');
  const quote=String(pair?.quoteToken?.address||'');
  let priceSol=null;

  if(base===mint&&quote===WSOL&&finite(pair?.priceNative)&&Number(pair.priceNative)>0){
    priceSol=Number(pair.priceNative);
  }else if(quote===mint&&base===WSOL&&finite(pair?.priceNative)&&Number(pair.priceNative)>0){
    priceSol=1/Number(pair.priceNative);
  }

  const patch={
    dexPairAddress:pair?.pairAddress||null,
    dexId:pair?.dexId||null,
    dexUrl:pair?.url||null,
    dexPairCreatedAt:Number(pair?.pairCreatedAt)||null,
    dexMarketUpdatedAt:Date.now(),
    marketSource:'dexscreener',
    priceSource:'dexscreener',
    buyPressureSource:'dexscreener-'+(act.window||'available')+'-tx-count',
    buyPressure:finite(pressure)?Number(pressure):null,
    buyTransactions:act.buys,
    sellTransactions:act.sells,
    totalTransactions:act.buys+act.sells,
    priceSol,
    priceUsd:finite(pair?.priceUsd)?Number(pair.priceUsd):null,
    liquidityUsd:finite(pair?.liquidity?.usd)?Number(pair.liquidity.usd):null,
    marketCapUsd:finite(pair?.marketCap)?Number(pair.marketCap):null,
    fdvUsd:finite(pair?.fdv)?Number(pair.fdv):null,
    volume24hUsd:finite(pair?.volume?.h24)?Number(pair.volume.h24):null,
    volume6hUsd:finite(pair?.volume?.h6)?Number(pair.volume.h6):null,
    volume1hUsd:finite(pair?.volume?.h1)?Number(pair.volume.h1):null,
    volume5mUsd:finite(pair?.volume?.m5)?Number(pair.volume.m5):null,
    lastPriceAt:Date.now()
  };
  for(const k of Object.keys(patch))if(patch[k]===null)delete patch[k];
  return patch;
}
function identityPatch(pair,mint,spec,signature,slot){
  const base=String(pair?.baseToken?.address||'')===mint?pair.baseToken:pair?.quoteToken;
  const info=pair?.info||{};
  return {
    mint,
    name:base?.name||null,
    symbol:base?.symbol||null,
    imageUrl:info?.imageUrl||null,
    image:info?.imageUrl||null,
    logoUrl:info?.imageUrl||null,
    website:firstWebsite(info),
    twitter:social(info,'twitter'),
    telegram:social(info,'telegram'),
    launchPlatform:'dex',
    protocol:spec.key,
    dexProtocol:spec.key,
    dexProgramId:spec.programId,
    dexDiscoveredAt:Date.now(),
    discoveredAt:Date.now(),
    signature,
    slot:Number(slot)||null,
    source:'DEX Paid stream',
    creator:null,
    creatorStatus:'unavailable-from-dex-pool'
  };
}
function choosePair(rows,mint,spec,eventAt){
  const maxAge=20*60*1000;
  const candidates=(Array.isArray(rows)?rows:[]).filter(pair=>{
    if(String(pair?.chainId||'').toLowerCase()!=='solana')return false;
    if(!spec.dex.test(String(pair?.dexId||'')))return false;

    const base=String(pair?.baseToken?.address||'');
    const quote=String(pair?.quoteToken?.address||'');
    if(!((base===mint&&quote===WSOL)||(quote===mint&&base===WSOL)))return false;

    const created=Number(pair?.pairCreatedAt);
    if(Number.isFinite(created)&&created>0&&Math.abs(created-eventAt)>maxAge)return false;

    const a=pairActivity(pair);
    return a.buys+a.sells>0;
  });

  candidates.sort((a,b)=>Number(b?.liquidity?.usd||0)-Number(a?.liquidity?.usd||0));
  return candidates[0]||null;
}

export function startDexDiscoveryFeed(opts={}){
  const {rpc,onDiscover,onMarket}=opts;

  let urls=Array.isArray(opts.wsUrls)?opts.wsUrls.filter(Boolean):[];
  if(!urls.length)urls=envList('SOLANA_WS_URLS');
  if(!urls.length)urls=envList('SOLANA_RPC_URLS').map(wsFromHttp).filter(Boolean);

  const maxConcurrent=Math.max(1,Math.min(12,Number(process.env.DEX_DISCOVERY_MAX_CONCURRENT||6)));
  const queueMax=Math.max(50,Math.min(2000,Number(process.env.DEX_DISCOVERY_QUEUE_MAX||400)));
  const jobMaxAgeMs=Math.max(3000,Math.min(60000,Number(process.env.DEX_DISCOVERY_JOB_MAX_AGE_MS||15000)));
  const pendingMax=Math.max(60,Math.min(1500,Number(process.env.DEX_DISCOVERY_PENDING_MAX||450)));
  const confirmLifeMs=Math.max(5000,Math.min(60000,Number(process.env.DEX_DISCOVERY_CONFIRM_LIFE_MS||22000)));
  const marketTrackMax=Math.max(30,Math.min(500,Number(process.env.DEX_DISCOVERY_TRACK_MAX||120)));

  const metrics={
    version:VERSION,
    startedAt:Date.now(),
    connected:false,
    url:null,
    reconnects:0,
    programs:PROGRAMS.map(x=>({key:x.key,name:x.name,programId:x.programId})),
    notifications:0,
    createSignals:0,
    signaturesQueued:0,
    queueDropped:0,
    staleDropped:0,
    transactionsFetched:0,
    transactionRetries:0,
    transactionErrors:0,
    candidateMints:0,
    pendingRejected:0,
    dexChecks:0,
    dexRateLimited:0,
    dexCheckErrors:0,
    confirmBatches:0,
    confirmAddresses:0,
    pairsConfirmed:0,
    pairsRejected:0,
    duplicates:0,
    discovered:0,
    marketUpdates:0,
    pendingConfirms:0,
    queueDepth:0,
    active:0,
    tracked:0,
    lastMint:null,
    lastProtocol:null,
    lastPair:null,
    lastError:null,
    lastEventAt:null
  };

  const seenSig=new Map();
  const seenMint=new Map();
  const pending=new Map();
  const tracked=new Map();
  const q=[];

  const pendingIds=new Map();
  const subscriptions=new Map();

  let active=0;
  let ws=null;
  let stopped=false;
  let reconnectTimer=null;
  let wsIndex=0;
  let dexChain=Promise.resolve();
  let lastDexAt=0;
  let pollTimer=null;
  let confirmTimer=null;
  let roundRobin=0;

  function prune(map,max=5000){
    if(map.size<=max)return;
    const rows=[...map.entries()]
      .sort((a,b)=>Number(b[1]?.seenAt||b[1]||0)-Number(a[1]?.seenAt||a[1]||0))
      .slice(0,Math.floor(max/2));
    map.clear();
    for(const [k,v] of rows)map.set(k,v);
  }

  async function dexJson(url){
    metrics.dexChecks++;

    const run=dexChain.then(async()=>{
      // 300 req/min API ceiling -> keep a small safety margin.
      const wait=Math.max(0,215-(Date.now()-lastDexAt));
      if(wait)await sleep(wait);
      lastDexAt=Date.now();

      const controller=new AbortController();
      const timeout=setTimeout(()=>controller.abort(),4200);

      try{
        const r=await fetch(url,{
          signal:controller.signal,
          headers:{
            accept:'application/json',
            'user-agent':'MEMEFLOW/DEX-Discovery-V1.1'
          }
        });

        if(r.status===429){
          metrics.dexRateLimited++;
          throw new Error('DEX Screener rate limited');
        }
        if(!r.ok)throw new Error('DEX Screener HTTP '+r.status);

        return await r.json();
      }finally{
        clearTimeout(timeout);
      }
    });

    dexChain=run.catch(()=>{});
    return run;
  }

  function enqueue(signature,spec,eventAt){
    const now=Date.now();

    if(seenSig.has(signature)){
      metrics.duplicates++;
      return;
    }

    seenSig.set(signature,now);
    prune(seenSig);

    if(q.length>=queueMax){
      // Realtime system: drop oldest work instead of building seconds/minutes of lag.
      q.shift();
      metrics.queueDropped++;
    }

    q.push({signature,spec,eventAt,queuedAt:now});
    metrics.signaturesQueued++;
    metrics.queueDepth=q.length;
    pumpQueue();
  }

  function pumpQueue(){
    while(!stopped&&active<maxConcurrent&&q.length){
      const job=q.shift();
      metrics.queueDepth=q.length;

      if(Date.now()-job.queuedAt>jobMaxAgeMs){
        metrics.staleDropped++;
        continue;
      }

      active++;
      metrics.active=active;

      Promise.resolve(processJob(job))
        .catch(e=>{metrics.lastError=String(e?.message||e)})
        .finally(()=>{
          active--;
          metrics.active=active;
          pumpQueue();
        });
    }
  }

  async function getTransactionFresh(signature){
    const waits=[0,160,360,760];

    for(let i=0;i<waits.length;i++){
      if(stopped)return null;
      if(waits[i])await sleep(waits[i]);

      try{
        const tx=await rpc.callOnce('getTransaction',[
          signature,
          {
            encoding:'jsonParsed',
            commitment:'confirmed',
            maxSupportedTransactionVersion:0
          }
        ]);

        if(tx){
          metrics.transactionsFetched++;
          return tx;
        }

        if(i<waits.length-1)metrics.transactionRetries++;
      }catch(e){
        if(i<waits.length-1){
          metrics.transactionRetries++;
          continue;
        }
        metrics.transactionErrors++;
        metrics.lastError='tx:'+String(e?.message||e);
      }
    }

    return null;
  }

  async function processJob({signature,spec,eventAt}){
    const tx=await getTransactionFresh(signature);
    if(!tx)return;

    const mints=txMints(tx).filter(x=>x!==WSOL);
    metrics.candidateMints+=mints.length;

    for(const mint of mints){
      if(seenMint.has(mint)){
        metrics.duplicates++;
        continue;
      }
      if(pending.has(mint))continue;

      if(pending.size>=pendingMax){
        metrics.pendingRejected++;
        continue;
      }

      pending.set(mint,{
        mint,
        spec,
        signature,
        slot:tx.slot,
        eventAt,
        seenAt:Date.now(),
        dueAt:Date.now()+320,
        expiresAt:Date.now()+confirmLifeMs,
        attempts:0
      });
    }

    metrics.pendingConfirms=pending.size;
  }

  async function confirmBatch(){
    if(stopped||!pending.size)return;

    const now=Date.now();
    const due=[...pending.values()]
      .filter(x=>x.dueAt<=now)
      .sort((a,b)=>a.dueAt-b.dueAt)
      .slice(0,30);

    if(!due.length)return;

    for(const item of due){
      if(now>item.expiresAt){
        pending.delete(item.mint);
        metrics.pairsRejected++;
      }
    }

    const live=due.filter(x=>pending.has(x.mint));
    metrics.pendingConfirms=pending.size;
    if(!live.length)return;

    metrics.confirmBatches++;
    metrics.confirmAddresses+=live.length;

    let rows;
    try{
      rows=await dexJson(
        'https://api.dexscreener.com/tokens/v1/solana/'
        +live.map(x=>encodeURIComponent(x.mint)).join(',')
      );
    }catch(e){
      metrics.dexCheckErrors++;
      metrics.lastError='dex-confirm:'+String(e?.message||e);

      for(const item of live){
        item.attempts++;
        item.dueAt=Date.now()+Math.min(5000,450*2**Math.min(item.attempts,4));
      }
      return;
    }

    for(const item of live){
      const mint=item.mint;
      const pair=choosePair(rows,mint,item.spec,item.eventAt);

      if(!pair){
        item.attempts++;

        if(Date.now()>item.expiresAt){
          pending.delete(mint);
          metrics.pairsRejected++;
        }else{
          const schedule=[420,750,1300,2400,4200,6500];
          item.dueAt=Date.now()+schedule[Math.min(item.attempts-1,schedule.length-1)];
        }
        continue;
      }

      pending.delete(mint);

      if(seenMint.has(mint)){
        metrics.duplicates++;
        continue;
      }

      seenMint.set(mint,Date.now());
      prune(seenMint,3000);

      const identity=identityPatch(pair,mint,item.spec,item.signature,item.slot);
      const market=marketPatch(pair,mint);

      tracked.set(mint,{
        pairAddress:pair.pairAddress,
        lastSeenAt:Date.now()
      });
      while(tracked.size>marketTrackMax){
        tracked.delete(tracked.keys().next().value);
      }

      metrics.pairsConfirmed++;
      metrics.discovered++;
      metrics.lastMint=mint;
      metrics.lastProtocol=item.spec.key;
      metrics.lastPair=pair.pairAddress||null;

      try{
        await onDiscover?.({mint,identity,market,pair,spec:item.spec});
      }catch(e){
        metrics.lastError='discover-callback:'+String(e?.message||e);
      }
    }

    metrics.pendingConfirms=pending.size;
    metrics.tracked=tracked.size;
  }

  async function pollMarket(){
    if(stopped||!tracked.size)return;

    const keys=[...tracked.keys()];
    const batch=[];

    for(let i=0;i<Math.min(30,keys.length);i++){
      batch.push(keys[(roundRobin+i)%keys.length]);
    }

    roundRobin=(roundRobin+batch.length)%Math.max(1,keys.length);
    if(!batch.length)return;

    try{
      const rows=await dexJson(
        'https://api.dexscreener.com/tokens/v1/solana/'
        +batch.map(encodeURIComponent).join(',')
      );

      for(const mint of batch){
        const pairs=(Array.isArray(rows)?rows:[])
          .filter(p=>{
            const base=String(p?.baseToken?.address||'');
            const quote=String(p?.quoteToken?.address||'');
            return (base===mint&&quote===WSOL)||(quote===mint&&base===WSOL);
          })
          .sort((a,b)=>Number(b?.liquidity?.usd||0)-Number(a?.liquidity?.usd||0));

        if(!pairs[0])continue;

        try{
          await onMarket?.(mint,marketPatch(pairs[0],mint),pairs[0]);
          metrics.marketUpdates++;
        }catch(e){
          metrics.lastError='market-callback:'+String(e?.message||e);
        }
      }
    }catch(e){
      metrics.dexCheckErrors++;
      metrics.lastError='market-poll:'+String(e?.message||e);
    }
  }

  async function connect(){
    if(stopped||!urls.length){
      if(!urls.length)metrics.lastError='No SOLANA_WS_URLS/SOLANA_RPC_URLS';
      return;
    }

    const url=urls[wsIndex++%urls.length];

    try{
      ws=await makeWS(url);
      metrics.url=url;

      ws.onopen=()=>{
        metrics.connected=true;
        metrics.lastError=null;
        pendingIds.clear();
        subscriptions.clear();

        for(let i=0;i<PROGRAMS.length;i++){
          const id=7000+i;
          const spec=PROGRAMS[i];

          pendingIds.set(id,spec);

          try{
            ws.send(JSON.stringify({
              jsonrpc:'2.0',
              id,
              method:'logsSubscribe',
              params:[
                {mentions:[spec.programId]},
                {commitment:'confirmed'}
              ]
            }));
          }catch{}
        }
      };

      ws.onmessage=ev=>{
        try{
          const j=JSON.parse(typeof ev.data==='string'?ev.data:String(ev.data));

          if(j?.id!=null&&j?.result!=null&&pendingIds.has(j.id)){
            subscriptions.set(j.result,pendingIds.get(j.id));
            pendingIds.delete(j.id);
            return;
          }

          const sub=j?.params?.subscription;
          const spec=subscriptions.get(sub);
          const value=j?.params?.result?.value;

          if(!spec||!value||value.err)return;

          metrics.notifications++;
          metrics.lastEventAt=Date.now();

          const logs=Array.isArray(value.logs)?value.logs:[];
          const create=logs.some(
            x=>spec.create.test(String(x).replace(/^Program log:\s*/i,'').trim())
          );
          if(!create)return;

          const signature=String(value.signature||'');
          if(!signature)return;

          metrics.createSignals++;
          enqueue(signature,spec,Date.now());
        }catch(e){
          metrics.lastError='ws-message:'+String(e?.message||e);
        }
      };

      ws.onerror=()=>{
        metrics.lastError='ws-error';
      };

      ws.onclose=()=>{
        metrics.connected=false;
        if(stopped)return;

        metrics.reconnects++;
        clearTimeout(reconnectTimer);
        reconnectTimer=setTimeout(connect,1200);
        reconnectTimer.unref?.();
      };
    }catch(e){
      metrics.connected=false;
      metrics.reconnects++;
      metrics.lastError=String(e?.message||e);

      reconnectTimer=setTimeout(connect,1200);
      reconnectTimer.unref?.();
    }
  }

  connect();

  confirmTimer=setInterval(()=>void confirmBatch(),300);
  confirmTimer.unref?.();

  pollTimer=setInterval(()=>void pollMarket(),2500);
  pollTimer.unref?.();

  return {
    metrics:()=>({
      ...metrics,
      queueDepth:q.length,
      active,
      pendingConfirms:pending.size,
      tracked:tracked.size
    }),
    stop:()=>{
      stopped=true;
      clearTimeout(reconnectTimer);
      clearInterval(confirmTimer);
      clearInterval(pollTimer);

      q.length=0;
      pending.clear();

      try{if(ws)ws.onclose=null}catch{}
      try{ws?.close?.()}catch{}

      metrics.connected=false;
      metrics.queueDepth=0;
      metrics.pendingConfirms=0;
    }
  };
}
