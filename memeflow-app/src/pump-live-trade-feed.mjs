// MEMEFLOW V12.22 WS-DIRECT TRADE EVENT
// Pump logsSubscribe -> decode Program data directly.
// NO getTransaction in the live hot path. Public RPC HTTP 429 is avoided.

import crypto from 'node:crypto';

const VERSION='V12.22+V30.2';
const PUMP_PROGRAM='6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P';
const DISC=crypto.createHash('sha256').update('event:TradeEvent').digest().subarray(0,8);
const B58='123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

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
  if(typeof globalThis.WebSocket==='function') return new globalThis.WebSocket(url);
  const mod=await import('ws');
  return new mod.WebSocket(url);
}
function b58(buf){
  let x=0n;
  for(const b of buf)x=(x<<8n)+BigInt(b);
  let s='';
  while(x){const r=Number(x%58n);s=B58[r]+s;x/=58n}
  for(const b of buf){if(b!==0)break;s='1'+s}
  return s||'1';
}
function u64(b,o){
  return b.length>=o+8?b.readBigUInt64LE(o):null;
}
function decodeTradeEvent(buf){
  // Pump TradeEvent:
  // disc(8), mint(32), solAmount u64, tokenAmount u64, isBuy bool,
  // user(32), timestamp i64, virtualSolReserves u64, virtualTokenReserves u64,
  // realSolReserves u64, realTokenReserves u64, ...
  if(!Buffer.isBuffer(buf)||buf.length<89||!buf.subarray(0,8).equals(DISC))return null;
  let o=8;
  const mint=b58(buf.subarray(o,o+32)); o+=32;
  const solAmount=u64(buf,o); o+=8;
  const tokenAmount=u64(buf,o); o+=8;
  if(solAmount===null||tokenAmount===null)return null;
  const isBuy=buf[o++]!==0;
  const user=b58(buf.subarray(o,o+32)); o+=32;

  let timestamp=null,virtualSolReserves=null,virtualTokenReserves=null,realSolReserves=null,realTokenReserves=null;
  if(buf.length>=o+8){ timestamp=buf.readBigInt64LE(o); o+=8; }
  if(buf.length>=o+8){ virtualSolReserves=u64(buf,o); o+=8; }
  if(buf.length>=o+8){ virtualTokenReserves=u64(buf,o); o+=8; }
  if(buf.length>=o+8){ realSolReserves=u64(buf,o); o+=8; }
  if(buf.length>=o+8){ realTokenReserves=u64(buf,o); o+=8; }

  return {mint,user,isBuy,solAmount,tokenAmount,timestamp,
    virtualSolReserves,virtualTokenReserves,realSolReserves,realTokenReserves};
}
function programData(log){
  const m=/^Program data:\s*([A-Za-z0-9+/=]+)\s*$/.exec(String(log||'').trim());
  if(!m)return null;
  try{return Buffer.from(m[1],'base64')}catch{return null}
}
function marketFromEvent(e){
  let priceSol=null,liquiditySol=null;
  if(e.virtualSolReserves>0n && e.virtualTokenReserves>0n){
    // Canonical post-trade bonding-curve mark price used by the engine.
    priceSol=(Number(e.virtualSolReserves)/1e9)/(Number(e.virtualTokenReserves)/1e6);
  }
  if(e.realSolReserves!==null)liquiditySol=Number(e.realSolReserves)/1e9;
  return {priceSol,liquiditySol};
}
function tokenFromStore(store,mint){
  try{
    return store?.getToken?.(mint) ||
      store?.state?.tokens?.[mint] ||
      (Array.isArray(store?.state?.tokens)?store.state.tokens.find(x=>x?.mint===mint):null) ||
      null;
  }catch{return null}
}
function trackedPumpToken(store,mint){
  const token=tokenFromStore(store,mint);
  if(!token)return null;
  const discoveredAt=Number(token?.discoveredAt);
  const launch=String(token?.launchPlatform||'').toLowerCase();
  const protocol=String(token?.protocol||'').toLowerCase();
  const source=String(token?.source||'').toLowerCase();
  const discovered=Number.isFinite(discoveredAt)&&discoveredAt>0;
  const pumpOrigin=launch==='pump'||protocol==='pump'||source.includes('pump create');
  return discovered&&pumpOrigin?token:null;
}

export function startPumpLiveTradeFeed(opts={}){
  const {eventHolderLedger,store,publish,evaluateAI,onTokenUpdate,onChartTick}=opts;
  let urls=envList('SOLANA_WS_URLS');
  if(!urls.length)urls=envList('SOLANA_RPC_URLS').map(wsFromHttp).filter(Boolean);

  const metrics={
    version:VERSION,startedAt:Date.now(),connected:false,reconnects:0,
    notifications:0,programDataSeen:0,tradeEventsDecoded:0,decodeErrors:0,
    holderSnapshots:0,marketSnapshots:0,repeatTradeEvents:0,ignoredUntrackedTradeEvents:0,
    distinctMints:0,distinctUsers:0,lastMint:null,lastUser:null,lastError:null,
    fastChartConnected:false,fastChartReconnects:0,fastChartTicks:0,
    fastChartBuffered:0,fastChartFlushed:0,fastChartLastAt:null,
    httpRpcCalls:0,queueDepth:0,active:0,
    evaluationCalls:0,evaluationResolved:0,evaluationRejected:0,evaluationNullResults:0,
    evaluationDecisionLikeResults:0,lastEvaluationMint:null,lastEvaluationTrigger:null,
    lastEvaluationAt:null,lastEvaluationResultType:null,lastEvaluationError:null
  };

  const mintCounts=new Map(), users=new Set(), pressure=new Map();
  let ws=null,stopped=false,idx=0,reconnectTimer=null;
  let fastChartWs=null,fastChartIdx=0,fastChartReconnectTimer=null;
  const fastWarmByMint=new Map();
  const FAST_WARM_MAX_MINTS=200;
  const FAST_WARM_MAX_TICKS=64;
  const FAST_WARM_TTL_MS=30_000;

  function updatePressure(e){
    const now=Date.now(), windowMs=60_000;
    let a=pressure.get(e.mint);
    if(!a){a=[];pressure.set(e.mint,a)}
    a.push({t:now,buy:e.isBuy,sol:Number(e.solAmount)/1e9});
    while(a.length&&a[0].t<now-windowMs)a.shift();

    let buySol=0,sellSol=0,buyTransactions=0,sellTransactions=0;
    for(const x of a){
      if(x.buy){buySol+=x.sol;buyTransactions++}
      else{sellSol+=x.sol;sellTransactions++}
    }

    const buyPressure=sellSol>0
      ? buySol/sellSol
      : (buySol>0?Math.max(1,buySol):null);

    return {
      buyPressure,
      buyTransactions,
      sellTransactions,
      totalTransactions:buyTransactions+sellTransactions,
      pumpBuyVolumeSol:buySol,
      pumpSellVolumeSol:sellSol,
      windowMs
    };
  }

  // MEMEFLOW_V12_26_EVALUATION_LIFECYCLE_DIAGNOSTICS
  const __v1226EvalByMint=new Map();
  function __v1226ResultType(r){
    if(r===null||r===undefined)return 'null';
    if(Array.isArray(r))return 'array';
    return typeof r==='object'?(r.state||r.decision||r.result?'decision-like':'object'):typeof r;
  }
  function __v1226Remember(mint,trigger,status,result,error){
    const row={mint,trigger,status,at:Date.now(),resultType:__v1226ResultType(result),error:error?String(error?.message||error):null};
    __v1226EvalByMint.set(mint,row);
    if(__v1226EvalByMint.size>80){const k=__v1226EvalByMint.keys().next().value;__v1226EvalByMint.delete(k)}
  }
  function __v1226Evaluate(updated,mint,trigger){
    metrics.evaluationCalls++;
    metrics.lastEvaluationMint=mint||updated?.mint||null;
    metrics.lastEvaluationTrigger=trigger;
    metrics.lastEvaluationAt=Date.now();
    try{
      const p=Promise.resolve(evaluateAI?.(updated));
      p.then((r)=>{
        metrics.evaluationResolved++;
        if(r===null||r===undefined)metrics.evaluationNullResults++;
        else if(typeof r==='object'&&(r.decisionLike===true||r.state||r.decision||r.result||r.primaryReason||r.reasons))metrics.evaluationDecisionLikeResults++;
        metrics.lastEvaluationResultType=__v1226ResultType(r);
        metrics.lastEvaluationError=null;
        __v1226Remember(mint||updated?.mint||null,trigger,'resolved',r,null);
      }).catch((err)=>{
        metrics.evaluationRejected++;
        metrics.lastEvaluationError=String(err?.message||err);
        __v1226Remember(mint||updated?.mint||null,trigger,'rejected',null,err);
      });
      return p;
    }catch(err){
      metrics.evaluationRejected++;
      metrics.lastEvaluationError=String(err?.message||err);
      __v1226Remember(mint||updated?.mint||null,trigger,'threw',null,err);
      return Promise.resolve(null);
    }
  }

  function applyEvent(e){
    // Decode metrics count the physical Pump stream; expensive engine work below
    // is limited to tokens MEMEFLOW actually discovered.
    metrics.tradeEventsDecoded++;
    metrics.lastMint=e.mint;
    metrics.lastUser=e.user;

    const knownToken=trackedPumpToken(store,e.mint);
    if(!knownToken){
      metrics.ignoredUntrackedTradeEvents++;
      return;
    }

    users.add(e.user);
    metrics.distinctUsers=users.size;
    const prev=mintCounts.get(e.mint)||0;
    mintCounts.set(e.mint,prev+1);
    if(prev>0)metrics.repeatTradeEvents++;
    metrics.distinctMints=mintCounts.size;

    const eventAt=(
      e.timestamp!==null &&
      e.timestamp!==undefined &&
      e.timestamp>0n
    )
      ? Number(e.timestamp)*1000
      : Date.now();

    const market=marketFromEvent(e);

    // CHART FIRST: a browser candle must not wait for holder sorting,
    // disk scheduling, per-user evaluation, or paper-engine callbacks.
    if(Number.isFinite(market.priceSol)&&market.priceSol>0){
      try{
        onChartTick?.({
          id:e.signature?`${e.signature}:${Number(e.eventIndex||0)}`:null,
          mint:e.mint,
          t:eventAt,
          priceSol:market.priceSol,
          markPriceSol:market.priceSol,
          isBuy:e.isBuy===true,
          solAmount:Number(e.solAmount)/1e9,
          tokenAmount:Number(e.tokenAmount)/1e6,
          source:'pump-curve-mark'
        });
      }catch{}
    }

    let updatedForEval=null;

    try{
      const creator=knownToken?.creator||knownToken?.developer||knownToken?.creatorWallet||null;
      if(creator)eventHolderLedger?.setCreator?.(e.mint,creator);
    }catch{}

    try{
      const snap=eventHolderLedger?.ingestTradeEventDirect?.(e);
      if(snap){
        metrics.holderSnapshots++;
        // ingestTradeEventDirect already calculated this exact snapshot.
        // Do not sort the same holder ledger a second time in applyToStore().
        const updated=store?.setToken?.(e.mint,snap);
        if(updated)updatedForEval=updated;
      }
    }catch(err){metrics.lastError='holder:'+String(err?.message||err)}

    try{
      const flow=updatePressure(e);
      const patch={
        marketSource:'pump-trade-event',
        priceSource:'pump-trade-event',
        buyPressureSource:'pump-trade-event-60s-sol-flow',
        buyPressure:flow.buyPressure,
        momentum:flow.buyPressure,
        buyTransactions:flow.buyTransactions,
        sellTransactions:flow.sellTransactions,
        totalTransactions:flow.totalTransactions,
        pumpBuyVolumeSol:flow.pumpBuyVolumeSol,
        pumpSellVolumeSol:flow.pumpSellVolumeSol,
        pumpFlowWindowMs:flow.windowMs,
        canonicalMarket:true,
        pumpMarketUpdatedAt:eventAt,
        lastPriceAt:eventAt
      };

      if(Number.isFinite(market.priceSol)&&market.priceSol>0){
        patch.priceSol=market.priceSol;
        const supply=Number(knownToken?.totalSupply);
        if(Number.isFinite(supply)&&supply>0){
          const marketCapSol=market.priceSol*supply;
          patch.marketCapSol=marketCapSol;
          patch.marketCap=marketCapSol;
        }
      }
      if(Number.isFinite(market.liquiditySol)&&market.liquiditySol>=0){
        patch.liquiditySol=market.liquiditySol;
        patch.liquidity=market.liquiditySol;
      }

      const updated=store?.setToken?.(e.mint,patch);
      if(updated){
        metrics.marketSnapshots++;
        updatedForEval=updated;
      }
    }catch(err){metrics.lastError='market:'+String(err?.message||err)}

    if(updatedForEval){
      try{__v1226Evaluate(updatedForEval,e.mint,'trade-event')}catch{}
      try{onTokenUpdate?.(e.mint,updatedForEval)}catch{}
      try{publish?.(e.mint)}catch{}
    }
  }

function fastChartTickFromEvent(e){
    const market=marketFromEvent(e);
    if(!(Number.isFinite(market.priceSol)&&market.priceSol>0))return null;

    const eventAt=(
      e.timestamp!==null &&
      e.timestamp!==undefined &&
      e.timestamp>0n
    )
      ? Number(e.timestamp)*1000
      : Date.now();

    return {
      id:e.signature?`${e.signature}:${Number(e.eventIndex||0)}`:null,
      mint:e.mint,
      t:eventAt,
      priceSol:market.priceSol,
      markPriceSol:market.priceSol,
      isBuy:e.isBuy===true,
      solAmount:Number(e.solAmount)/1e9,
      tokenAmount:Number(e.tokenAmount)/1e6,
      source:'pump-curve-mark-processed'
    };
  }

  function rememberFastWarm(tick){
    if(!tick?.mint)return;
    const now=Date.now();
    let row=fastWarmByMint.get(tick.mint);
    if(!row){
      row={at:now,ticks:[]};
      fastWarmByMint.set(tick.mint,row);
    }
    row.at=now;
    row.ticks.push(tick);
    if(row.ticks.length>FAST_WARM_MAX_TICKS){
      row.ticks.splice(0,row.ticks.length-FAST_WARM_MAX_TICKS);
    }
    metrics.fastChartBuffered++;

    if(fastWarmByMint.size>FAST_WARM_MAX_MINTS){
      const stale=[...fastWarmByMint.entries()]
        .sort((a,b)=>Number(a[1]?.at||0)-Number(b[1]?.at||0))
        .slice(0,fastWarmByMint.size-FAST_WARM_MAX_MINTS);
      for(const [mint] of stale)fastWarmByMint.delete(mint);
    }

    for(const [mint,item] of fastWarmByMint){
      if(now-Number(item?.at||0)>FAST_WARM_TTL_MS){
        fastWarmByMint.delete(mint);
      }
    }
  }

  function emitFastChart(e){
    const tick=fastChartTickFromEvent(e);
    if(!tick)return;

    const known=trackedPumpToken(store,e.mint);
    if(!known){
      rememberFastWarm(tick);
      return;
    }

    const warm=fastWarmByMint.get(e.mint);
    if(warm?.ticks?.length){
      fastWarmByMint.delete(e.mint);
      for(const buffered of warm.ticks){
        try{
          onChartTick?.(buffered);
          metrics.fastChartFlushed++;
        }catch{}
      }
    }

    try{
      onChartTick?.(tick);
      metrics.fastChartTicks++;
      metrics.fastChartLastAt=Date.now();
    }catch{}
  }

  async function connectFastChart(){
    if(stopped||!urls.length||!onChartTick)return;

    const url=urls[fastChartIdx++%urls.length];

    try{
      fastChartWs=await makeWS(url);

      fastChartWs.onopen=()=>{
        metrics.fastChartConnected=true;
        try{
          fastChartWs.send(JSON.stringify({
            jsonrpc:'2.0',
            id:129,
            method:'logsSubscribe',
            params:[
              {mentions:[PUMP_PROGRAM]},
              {commitment:'processed'}
            ]
          }));
        }catch{}
      };

      fastChartWs.onmessage=ev=>{
        try{
          const j=JSON.parse(
            typeof ev.data==='string'
              ? ev.data
              : String(ev.data)
          );
          const value=j?.params?.result?.value;
          if(!value||value.err)return;

          let eventIndex=0;
          for(const log of value.logs||[]){
            const b=programData(log);
            if(!b)continue;
            const e=decodeTradeEvent(b);
            if(!e)continue;

            e.signature=value.signature||null;
            e.eventIndex=eventIndex++;
            emitFastChart(e);
          }
        }catch(err){
          metrics.lastError='fast-chart:'+String(err?.message||err);
        }
      };

      fastChartWs.onerror=()=>{
        metrics.lastError='fast-chart-ws-error';
      };

      fastChartWs.onclose=()=>{
        metrics.fastChartConnected=false;
        if(stopped)return;
        metrics.fastChartReconnects++;
        clearTimeout(fastChartReconnectTimer);
        fastChartReconnectTimer=setTimeout(
          connectFastChart,
          700
        );
        fastChartReconnectTimer.unref?.();
      };
    }catch(err){
      metrics.fastChartConnected=false;
      metrics.fastChartReconnects++;
      metrics.lastError='fast-chart-connect:'+String(err?.message||err);
      fastChartReconnectTimer=setTimeout(
        connectFastChart,
        700
      );
      fastChartReconnectTimer.unref?.();
    }
  }

  async function connect(){
    if(stopped||!urls.length){
      if(!urls.length)metrics.lastError='No SOLANA_WS_URLS/SOLANA_RPC_URLS';
      return;
    }
    const url=urls[idx++%urls.length];
    try{
      ws=await makeWS(url);
      ws.onopen=()=>{
        metrics.connected=true;
        try{
          ws.send(JSON.stringify({
            jsonrpc:'2.0',id:122,method:'logsSubscribe',
            params:[{mentions:[PUMP_PROGRAM]},{commitment:'confirmed'}]
          }));
        }catch{}
      };
      ws.onmessage=ev=>{
        try{
          const j=JSON.parse(typeof ev.data==='string'?ev.data:String(ev.data));
          const value=j?.params?.result?.value;
          if(!value||value.err)return;
          metrics.notifications++;
          let eventIndex=0;
          for(const log of value.logs||[]){
            const b=programData(log);
            if(!b)continue;
            metrics.programDataSeen++;
            try{
              const e=decodeTradeEvent(b);
              if(e){
                e.signature=value.signature||null;
                e.eventIndex=eventIndex++;
                applyEvent(e);
              }
            }catch(err){
              metrics.decodeErrors++;
              metrics.lastError='decode:'+String(err?.message||err);
            }
          }
        }catch(err){
          metrics.decodeErrors++;
          metrics.lastError='ws-message:'+String(err?.message||err);
        }
      };
      ws.onerror=()=>{metrics.lastError='ws-error'};
      ws.onclose=()=>{
        metrics.connected=false;
        if(stopped)return;
        metrics.reconnects++;
        clearTimeout(reconnectTimer);
        reconnectTimer=setTimeout(connect,1500);reconnectTimer.unref?.();
      };
    }catch(err){
      metrics.connected=false;
      metrics.reconnects++;
      metrics.lastError=String(err?.message||err);
      reconnectTimer=setTimeout(connect,1500);reconnectTimer.unref?.();
    }
  }

  // V30.9: low-latency processed stream is chart/tape ONLY.
  // Existing confirmed stream still owns engine/holder/AI semantics.
  connectFastChart();
  connect();

  return {
    metrics:()=>({...metrics,queueDepth:0,active:0,httpRpcCalls:0,evaluationRecent:Array.from(__v1226EvalByMint.values()).slice(-12)}),
    stop:()=>{
      stopped=true;
      clearTimeout(reconnectTimer);
      clearTimeout(fastChartReconnectTimer);
      try{ws?.close?.()}catch{}
      try{fastChartWs?.close?.()}catch{}
    }
  };
}

// MEMEFLOW_V12_26_EVALUATION_LIFECYCLE_DIAGNOSTICS: evaluateAI hot-path instrumentation only; evaluator/execution semantics unchanged.

// MEMEFLOW_TRADING_CHART_V30_4
// MEMEFLOW_TRADING_CHART_V30_5_EXECUTION_TICKS
// MEMEFLOW_TRADING_CHART_V30_6_CURVE_MARK
// MEMEFLOW_TRADING_CHART_V30_7_CHART_FIRST_TRACKED_ONLY

// MEMEFLOW_TRADING_CHART_V30_9_PROCESSED_CHART_ONLY
