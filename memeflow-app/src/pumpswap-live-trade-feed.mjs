import crypto from 'node:crypto';

export const PUMPSWAP_PROGRAM=
  'pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA';
export const WRAPPED_SOL_MINT=
  'So11111111111111111111111111111111111111112';

const VERSION='PUMPSWAP_LIVE_V1';
const B58='123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const CREATE_DISC=Buffer.from([177,49,12,210,160,118,167,116]);
const BUY_DISC=Buffer.from([103,244,82,31,44,245,119,119]);
const SELL_DISC=Buffer.from([62,47,55,10,165,3,220,42]);
const POOL_ACCOUNT_DISC=Buffer.from([241,154,109,4,17,177,109,188]);

function envList(name){
  return String(process.env[name]||'')
    .split(',')
    .map(value=>value.trim())
    .filter(Boolean);
}
async function makeWS(url){
  if(typeof globalThis.WebSocket==='function'){
    return new globalThis.WebSocket(url);
  }
  const mod=await import('ws');
  return new mod.WebSocket(url);
}
function b58(buf){
  let value=0n;
  for(const byte of buf)value=(value<<8n)+BigInt(byte);
  let out='';
  while(value){
    out=B58[Number(value%58n)]+out;
    value/=58n;
  }
  for(const byte of buf){
    if(byte!==0)break;
    out='1'+out;
  }
  return out||'1';
}
function pk(buf,offset){
  return buf.length>=offset+32
    ? b58(buf.subarray(offset,offset+32))
    : null;
}
function u64(buf,offset){
  return buf.length>=offset+8
    ? buf.readBigUInt64LE(offset)
    : null;
}
function i64(buf,offset){
  return buf.length>=offset+8
    ? buf.readBigInt64LE(offset)
    : null;
}
function programData(log){
  const match=/^Program data:\s*([A-Za-z0-9+/=]+)\s*$/
    .exec(String(log||'').trim());
  if(!match)return null;
  try{return Buffer.from(match[1],'base64')}catch{return null}
}
function finitePositive(value){
  const number=Number(value);
  return Number.isFinite(number)&&number>0?number:null;
}
function validAddress(value){
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(String(value||''));
}

export function decodePumpSwapCreatePoolEvent(buffer){
  if(
    !Buffer.isBuffer(buffer) ||
    buffer.length<235 ||
    !buffer.subarray(0,8).equals(CREATE_DISC)
  )return null;
  let offset=8;
  const timestamp=i64(buffer,offset);offset+=8;
  const index=buffer.readUInt16LE(offset);offset+=2;
  const creator=pk(buffer,offset);offset+=32;
  const baseMint=pk(buffer,offset);offset+=32;
  const quoteMint=pk(buffer,offset);offset+=32;
  const baseMintDecimals=buffer[offset++];
  const quoteMintDecimals=buffer[offset++];
  const baseAmountIn=u64(buffer,offset);offset+=8;
  const quoteAmountIn=u64(buffer,offset);offset+=8;
  const poolBaseAmount=u64(buffer,offset);offset+=8;
  const poolQuoteAmount=u64(buffer,offset);offset+=8;
  const minimumLiquidity=u64(buffer,offset);offset+=8;
  const initialLiquidity=u64(buffer,offset);offset+=8;
  const lpTokenAmountOut=u64(buffer,offset);offset+=8;
  const poolBump=buffer[offset++];
  const pool=pk(buffer,offset);
  if(
    !baseMint ||
    !quoteMint ||
    !pool ||
    baseAmountIn===null ||
    quoteAmountIn===null ||
    poolBaseAmount===null ||
    poolQuoteAmount===null
  )return null;
  return {
    kind:'create_pool',
    timestamp,index,creator,baseMint,quoteMint,
    baseMintDecimals,quoteMintDecimals,
    baseAmountIn,quoteAmountIn,poolBaseAmount,poolQuoteAmount,
    minimumLiquidity,initialLiquidity,lpTokenAmountOut,poolBump,pool
  };
}

export function decodePumpSwapTradeEvent(buffer){
  if(!Buffer.isBuffer(buffer)||buffer.length<184)return null;
  const isBuy=buffer.subarray(0,8).equals(BUY_DISC)
    ? true
    : buffer.subarray(0,8).equals(SELL_DISC)
      ? false
      : null;
  if(isBuy===null)return null;
  let offset=8;
  const timestamp=i64(buffer,offset);offset+=8;
  const tokenAmount=u64(buffer,offset);offset+=8;
  offset+=8; // max quote in / min quote out
  offset+=16; // user reserves
  const poolBaseTokenReserves=u64(buffer,offset);offset+=8;
  const poolQuoteTokenReserves=u64(buffer,offset);offset+=8;
  const solAmount=u64(buffer,offset);offset+=8;
  offset+=48; // fee fields and user quote amount
  const pool=pk(buffer,offset);offset+=32;
  const user=pk(buffer,offset);
  if(
    !pool ||
    !user ||
    tokenAmount===null ||
    solAmount===null ||
    poolBaseTokenReserves===null ||
    poolQuoteTokenReserves===null
  )return null;
  return {
    kind:isBuy?'buy':'sell',
    isBuy,timestamp,tokenAmount,solAmount,pool,user,
    poolBaseTokenReserves,poolQuoteTokenReserves
  };
}

export function decodePumpSwapPoolAccount(buffer){
  if(
    !Buffer.isBuffer(buffer) ||
    buffer.length<107 ||
    !buffer.subarray(0,8).equals(POOL_ACCOUNT_DISC)
  )return null;
  let offset=8;
  const poolBump=buffer[offset++];
  const index=buffer.readUInt16LE(offset);offset+=2;
  const creator=pk(buffer,offset);offset+=32;
  const baseMint=pk(buffer,offset);offset+=32;
  const quoteMint=pk(buffer,offset);
  if(!creator||!baseMint||!quoteMint)return null;
  return {poolBump,index,creator,baseMint,quoteMint};
}

export function pumpSwapMarketFromReserves({
  poolBaseTokenReserves,
  poolQuoteTokenReserves,
  baseMintDecimals=6,
  quoteMintDecimals=9,
  tokenIsBase=true
}={}){
  if(
    typeof poolBaseTokenReserves!=='bigint' ||
    typeof poolQuoteTokenReserves!=='bigint' ||
    poolBaseTokenReserves<=0n ||
    poolQuoteTokenReserves<=0n
  )return {priceSol:null,liquiditySol:null};
  const baseDecimals=Math.max(0,Math.min(18,Number(baseMintDecimals)||0));
  const quoteDecimals=Math.max(0,Math.min(18,Number(quoteMintDecimals)||0));
  const base=Number(poolBaseTokenReserves)/(10**baseDecimals);
  const quote=Number(poolQuoteTokenReserves)/(10**quoteDecimals);
  const tokenReserve=tokenIsBase?base:quote;
  const solReserve=tokenIsBase?quote:base;
  return {
    priceSol:
      Number.isFinite(tokenReserve)&&tokenReserve>0&&
      Number.isFinite(solReserve)&&solReserve>0
        ? solReserve/tokenReserve
        : null,
    liquiditySol:
      Number.isFinite(solReserve)&&solReserve>=0
        ? solReserve
        : null
  };
}

export function startPumpSwapLiveTradeFeed(opts={}){
  const {
    eventHolderLedger,store,publish,publishTrade,evaluateAI,
    opportunityEngine,getSolUsd
  }=opts;
  const urls=envList('SOLANA_WS_URLS');
  const metrics={
    version:VERSION,
    startedAt:Date.now(),
    connected:false,
    reconnects:0,
    notifications:0,
    programDataSeen:0,
    createPoolEventsDecoded:0,
    tradeEventsDecoded:0,
    migrationsDetected:0,
    poolsIdentified:0,
    sourceSwitches:0,
    liveUpdates:0,
    unknownPoolEvents:0,
    invalidPools:0,
    poolOrientationResolved:0,
    poolOrientationFailed:0,
    staleOrDuplicateEvents:0,
    evaluationCalls:0,
    lastMigrationMint:null,
    lastPool:null,
    lastObservedCreateMint:null,
    lastObservedCreatePool:null,
    lastLiveMint:null,
    lastLiveUpdateAt:null,
    lastError:null
  };
  const poolToToken=new Map();
  const pendingByPool=new Map();
  const seenEvents=new Map();
  const logged=new Set();
  let ws=null;
  let stopped=false;
  let endpointIndex=0;
  let reconnectTimer=null;
  let syncTimer=null;

  function logOnce(key,label,detail){
    if(logged.has(key))return;
    logged.add(key);
    console.info(`[${label}]`,JSON.stringify(detail));
  }
  function fail(mint,reason){
    const key=`fail:${mint||'unknown'}:${reason}`;
    metrics.lastError=String(reason);
    if(logged.has(key))return;
    logged.add(key);
    console.warn(
      '[PUMPSWAP_UPDATE_FAILED]',
      JSON.stringify({mint:mint||null,reason:String(reason)})
    );
  }
  function tokenFromStore(mint){
    try{
      return (
        store?.getToken?.(mint) ||
        store?.state?.tokens?.[mint] ||
        null
      );
    }catch{
      return null;
    }
  }
  function registerPool(pool,mint,meta={}){
    pool=String(pool||'');
    mint=String(mint||'');
    if(!validAddress(pool)||!validAddress(mint)){
      metrics.invalidPools++;
      return false;
    }
    const current=poolToToken.get(pool)||{};
    poolToToken.set(pool,{
      ...current,
      ...meta,
      pool,
      mint,
      baseMintDecimals:
        Number(meta.baseMintDecimals??current.baseMintDecimals??6),
      quoteMintDecimals:
        Number(meta.quoteMintDecimals??current.quoteMintDecimals??9),
      tokenIsBase:
        typeof meta.tokenIsBase==='boolean'
          ? meta.tokenIsBase
          : typeof current.tokenIsBase==='boolean'
            ? current.tokenIsBase
            : null,
      tokenDecimals:
        Number(meta.tokenDecimals??current.tokenDecimals??6)
    });
    return true;
  }
  function registerToken(token){
    const pool=
      token?.pumpSwapPool ||
      token?.raydiumPool ||
      token?.raydium_pool ||
      null;
    if(!pool||!token?.mint)return false;
    return registerPool(pool,token.mint,{
      tokenDecimals:token?.tokenDecimals??token?.decimals??6,
      tokenIsBase:null
    });
  }
  function syncStorePools(){
    for(const token of Object.values(store?.state?.tokens||{})){
      if(token?.complete===true||token?.migrated===true){
        registerToken(token);
      }
    }
  }
  function rememberEvent(key){
    if(!key)return true;
    if(seenEvents.has(key)){
      metrics.staleOrDuplicateEvents++;
      return false;
    }
    seenEvents.set(key,Date.now());
    while(seenEvents.size>25000){
      seenEvents.delete(seenEvents.keys().next().value);
    }
    return true;
  }
  function cleanupPendingPools(){
    const now=Date.now();
    for(const [pool,rows] of pendingByPool){
      const fresh=rows.filter(row=>now-row.at<10000);
      if(fresh.length)pendingByPool.set(pool,fresh.slice(-25));
      else pendingByPool.delete(pool);
    }
    while(pendingByPool.size>500){
      pendingByPool.delete(pendingByPool.keys().next().value);
    }
  }
  function replayPending(pool){
    const pending=pendingByPool.get(pool)||[];
    pendingByPool.delete(pool);
    for(const row of pending)applyTrade(row.event,row.context);
  }
  function resolvePoolMeta(meta,event,known){
    if(typeof meta?.tokenIsBase==='boolean'){
      return meta;
    }
    const tokenDecimals=Number(
      known?.tokenDecimals??
      known?.decimals??
      meta.tokenDecimals??
      6
    );
    const referencePrice=
      finitePositive(known?.priceSol) ??
      (
        finitePositive(known?.marketCapSol)!==null &&
        finitePositive(known?.totalSupply)!==null
          ? Number(known.marketCapSol)/Number(known.totalSupply)
          : null
      );
    if(referencePrice===null||!event){
      metrics.poolOrientationFailed++;
      fail(meta?.mint,'pool_orientation_reference_unavailable');
      return null;
    }
    const asBase=pumpSwapMarketFromReserves({
      poolBaseTokenReserves:event.poolBaseTokenReserves,
      poolQuoteTokenReserves:event.poolQuoteTokenReserves,
      baseMintDecimals:tokenDecimals,
      quoteMintDecimals:9,
      tokenIsBase:true
    }).priceSol;
    const asQuote=pumpSwapMarketFromReserves({
      poolBaseTokenReserves:event.poolBaseTokenReserves,
      poolQuoteTokenReserves:event.poolQuoteTokenReserves,
      baseMintDecimals:9,
      quoteMintDecimals:tokenDecimals,
      tokenIsBase:false
    }).priceSol;
    if(finitePositive(asBase)===null&&finitePositive(asQuote)===null){
      metrics.poolOrientationFailed++;
      fail(meta?.mint,'pool_orientation_invalid_reserves');
      return null;
    }
    const distance=value=>
      finitePositive(value)===null
        ? Number.POSITIVE_INFINITY
        : Math.abs(Math.log(Number(value)/referencePrice));
    meta.tokenIsBase=distance(asBase)<=distance(asQuote);
    meta.baseMintDecimals=meta.tokenIsBase?tokenDecimals:9;
    meta.quoteMintDecimals=meta.tokenIsBase?9:tokenDecimals;
    metrics.poolOrientationResolved++;
    metrics.poolsIdentified++;
    logOnce(
      `pool:${meta.mint}:${meta.pool}`,
      'PUMPSWAP_POOL_IDENTIFIED',
      {mint:meta.mint,pool:meta.pool}
    );
    return meta;
  }
  function marketPatch(meta,reserves,source,slot,signature){
    const market=pumpSwapMarketFromReserves({
      ...reserves,
      baseMintDecimals:meta.baseMintDecimals,
      quoteMintDecimals:meta.quoteMintDecimals,
      tokenIsBase:meta.tokenIsBase
    });
    const patch={
      complete:true,
      migrated:true,
      pumpSwapPool:meta.pool,
      raydiumPool:meta.pool,
      marketProtocol:'pumpswap',
      pumpSwapSourceActive:true,
      marketSource:source,
      lastPriceAt:Date.now(),
      lastMarketActivityAt:Date.now(),
      marketCapUpdatedAt:Date.now(),
      pumpSwapPoolBaseTokenReservesRaw:
        reserves.poolBaseTokenReserves?.toString?.()||null,
      pumpSwapPoolQuoteTokenReservesRaw:
        reserves.poolQuoteTokenReserves?.toString?.()||null,
      pumpSwapEventSlot:slot??null,
      pumpSwapEventSignature:signature||null
    };
    if(finitePositive(market.priceSol)!==null){
      patch.priceSol=market.priceSol;
      const known=tokenFromStore(meta.mint);
      const supply=finitePositive(known?.totalSupply);
      const solUsd=
        typeof getSolUsd==='function'
          ? finitePositive(getSolUsd())
          : null;
      if(supply!==null){
        patch.marketCapSol=market.priceSol*supply;
        if(solUsd!==null)patch.marketCapUsd=patch.marketCapSol*solUsd;
      }
    }
    if(
      market.liquiditySol!==null &&
      Number.isFinite(market.liquiditySol)
    ){
      patch.liquiditySol=market.liquiditySol;
    }
    return patch;
  }
  function switchSource(meta,reserves,context={}){
    const known=tokenFromStore(meta.mint);
    if(!known)return null;
    const wasActive=known.pumpSwapSourceActive===true;
    const updated=store?.setToken?.(
      meta.mint,
      marketPatch(
        meta,
        reserves,
        context.source||'pumpswap-live',
        context.slot,
        context.signature
      )
    );
    if(!updated)return null;
    if(!wasActive){
      if(!logged.has(`migration:${meta.mint}`)){
        metrics.migrationsDetected++;
        logOnce(
          `migration:${meta.mint}`,
          'PUMPSWAP_MIGRATION_DETECTED',
          {mint:meta.mint}
        );
      }
      metrics.sourceSwitches++;
      logOnce(
        `switch:${meta.mint}`,
        'PUMPSWAP_SOURCE_SWITCHED',
        {mint:meta.mint,from:'pumpfun',to:'pumpswap'}
      );
    }
    return updated;
  }
  function evaluate(updated){
    metrics.evaluationCalls++;
    try{Promise.resolve(evaluateAI?.(updated)).catch(()=>{})}catch{}
  }
  function applyCreate(event,context={}){
    const tokenIsBase=
      event.quoteMint===WRAPPED_SOL_MINT
        ? true
        : event.baseMint===WRAPPED_SOL_MINT
          ? false
          : null;
    if(event.index!==0||tokenIsBase===null){
      fail(event.baseMint,'unsupported_pool');
      return false;
    }
    const mint=tokenIsBase?event.baseMint:event.quoteMint;
    metrics.lastObservedCreateMint=mint;
    metrics.lastObservedCreatePool=event.pool;
    const known=tokenFromStore(mint);
    if(!known)return false;
    const meta={
      pool:event.pool,
      mint,
      baseMintDecimals:event.baseMintDecimals,
      quoteMintDecimals:event.quoteMintDecimals,
      tokenIsBase
    };
    if(!registerPool(event.pool,mint,meta)){
      fail(mint,'invalid_pool');
      return false;
    }
    metrics.migrationsDetected++;
    metrics.poolsIdentified++;
    metrics.lastMigrationMint=mint;
    metrics.lastPool=event.pool;
    logOnce(
      `migration:${mint}`,
      'PUMPSWAP_MIGRATION_DETECTED',
      {mint}
    );
    logOnce(
      `pool:${mint}:${event.pool}`,
      'PUMPSWAP_POOL_IDENTIFIED',
      {mint,pool:event.pool}
    );
    const updated=switchSource(
      meta,
      {
        poolBaseTokenReserves:event.poolBaseAmount,
        poolQuoteTokenReserves:event.poolQuoteAmount
      },
      {...context,source:'pumpswap-create-pool'}
    );
    if(!updated)return false;
    evaluate(updated);
    try{publish?.(mint)}catch{}
    replayPending(event.pool);
    return true;
  }
  function queueUnknownPool(event,context){
    metrics.unknownPoolEvents++;
    const rows=pendingByPool.get(event.pool)||[];
    rows.push({event,context,at:Date.now()});
    pendingByPool.set(
      event.pool,
      rows.filter(row=>Date.now()-row.at<10000).slice(-25)
    );
    cleanupPendingPools();
  }
  function applyTrade(event,context={}){
    syncStorePools();
    const meta=poolToToken.get(event.pool);
    if(!meta){
      queueUnknownPool(event,context);
      return false;
    }
    const known=tokenFromStore(meta.mint);
    if(!known)return false;
    if(typeof meta.tokenIsBase!=='boolean'){
      if(!resolvePoolMeta(meta,event,known)){
        queueUnknownPool(event,context);
        return false;
      }
    }
    const normalized={
      ...event,
      mint:meta.mint,
      isBuy:
        meta.tokenIsBase
          ? event.isBuy
          : !event.isBuy,
      tokenAmount:
        meta.tokenIsBase
          ? event.tokenAmount
          : event.solAmount,
      solAmount:
        meta.tokenIsBase
          ? event.solAmount
          : event.tokenAmount,
      virtualTokenReserves:
        meta.tokenIsBase
          ? event.poolBaseTokenReserves
          : event.poolQuoteTokenReserves,
      virtualSolReserves:
        meta.tokenIsBase
          ? event.poolQuoteTokenReserves
          : event.poolBaseTokenReserves,
      realTokenReserves:
        meta.tokenIsBase
          ? event.poolBaseTokenReserves
          : event.poolQuoteTokenReserves,
      realSolReserves:
        meta.tokenIsBase
          ? event.poolQuoteTokenReserves
          : event.poolBaseTokenReserves,
      signature:context.signature||null,
      slot:context.slot??null,
      marketProtocol:'pumpswap'
    };
    let holderSnapshot=null;
    try{
      holderSnapshot=
        eventHolderLedger?.ingestTradeEventDirect?.(normalized)||null;
    }catch(error){
      fail(meta.mint,'holder:'+String(error?.message||error));
    }
    const market=pumpSwapMarketFromReserves({
      poolBaseTokenReserves:event.poolBaseTokenReserves,
      poolQuoteTokenReserves:event.poolQuoteTokenReserves,
      baseMintDecimals:meta.baseMintDecimals,
      quoteMintDecimals:meta.quoteMintDecimals,
      tokenIsBase:meta.tokenIsBase
    });
    const opportunity=opportunityEngine?.update?.(
      normalized,
      {
        creator:known.creator||known.developer||null,
        priceSol:market.priceSol,
        liquiditySol:market.liquiditySol,
        holderCount:holderSnapshot?.holderCount??known.holderCount,
        top10Pct:holderSnapshot?.top10Pct??known.top10Pct,
        developerPct:
          holderSnapshot?.developerPct??
          known.developerPct??
          known.developerSharePct,
        holderFresh:
          holderSnapshot?.holderFresh===true ||
          known.holderFresh===true,
        totalSupplyRaw:known.tokenTotalSupplyRaw,
        totalSupply:known.totalSupply,
        launchSlot:known.createSlot??known.slot,
        launchSignature:
          known.createSignature||known.signature,
        solUsd:
          typeof getSolUsd==='function'?getSolUsd():null
      }
    )||{};
    const updated=store?.setToken?.(
      meta.mint,
      {
        ...(holderSnapshot||{}),
        ...opportunity,
        ...marketPatch(
          meta,
          {
            poolBaseTokenReserves:event.poolBaseTokenReserves,
            poolQuoteTokenReserves:event.poolQuoteTokenReserves
          },
          'pumpswap-live-trade',
          context.slot,
          context.signature
        ),
        pumpSwapTradeIsBuy:event.isBuy,
        pumpSwapTradeSolAmountRaw:event.solAmount.toString(),
        pumpSwapTradeTokenAmountRaw:event.tokenAmount.toString()
      }
    );
    if(!updated)return false;
    if(
      known.pumpSwapSourceActive!==true &&
      known.marketProtocol!=='pumpswap'
    ){
      if(!logged.has(`migration:${meta.mint}`)){
        metrics.migrationsDetected++;
        logOnce(
          `migration:${meta.mint}`,
          'PUMPSWAP_MIGRATION_DETECTED',
          {mint:meta.mint}
        );
      }
      metrics.sourceSwitches++;
      logOnce(
        `switch:${meta.mint}`,
        'PUMPSWAP_SOURCE_SWITCHED',
        {mint:meta.mint,from:'pumpfun',to:'pumpswap'}
      );
    }
    metrics.liveUpdates++;
    metrics.lastLiveMint=meta.mint;
    metrics.lastLiveUpdateAt=Date.now();
    logOnce(
      `live:${meta.mint}`,
      'PUMPSWAP_LIVE_UPDATE',
      {mint:meta.mint,price:updated.priceSol}
    );
    evaluate(updated);
    try{publishTrade?.(meta.mint,normalized,updated)}catch{}
    try{publish?.(meta.mint)}catch{}
    return true;
  }
  function ingestLogs(logs,context={}){
    const rows=Array.isArray(logs)?logs:[];
    let accepted=0;
    for(let index=0;index<rows.length;index++){
      const buffer=programData(rows[index]);
      if(!buffer)continue;
      metrics.programDataSeen++;
      const key=context.signature
        ? `${context.signature}:${index}`
        : crypto.createHash('sha256').update(buffer).digest('hex');
      let event=null;
      try{
        event=
          decodePumpSwapCreatePoolEvent(buffer) ||
          decodePumpSwapTradeEvent(buffer);
      }catch(error){
        fail(null,'decode:'+String(error?.message||error));
      }
      if(!event||!rememberEvent(key))continue;
      if(event.kind==='create_pool'){
        metrics.createPoolEventsDecoded++;
        if(applyCreate(event,context))accepted++;
      }else{
        metrics.tradeEventsDecoded++;
        if(applyTrade(event,context))accepted++;
      }
    }
    return accepted;
  }
  async function connect(){
    if(stopped||!urls.length){
      if(!urls.length)metrics.lastError='No SOLANA_WS_URLS';
      return;
    }
    const url=urls[endpointIndex++%urls.length];
    try{
      ws=await makeWS(url);
      ws.onopen=()=>{
        metrics.connected=true;
        try{
          ws.send(JSON.stringify({
            jsonrpc:'2.0',
            id:221,
            method:'logsSubscribe',
            params:[
              {mentions:[PUMPSWAP_PROGRAM]},
              {commitment:'confirmed'}
            ]
          }));
        }catch{}
      };
      ws.onmessage=message=>{
        try{
          const data=JSON.parse(
            typeof message.data==='string'
              ? message.data
              : String(message.data)
          );
          const result=data?.params?.result;
          const value=result?.value;
          if(!value||value.err)return;
          metrics.notifications++;
          ingestLogs(
            value.logs||[],
            {
              signature:value.signature||null,
              slot:result?.context?.slot??null,
              source:'dedicated-ws'
            }
          );
        }catch(error){
          fail(null,'ws-message:'+String(error?.message||error));
        }
      };
      ws.onerror=()=>{metrics.lastError='ws-error'};
      ws.onclose=()=>{
        metrics.connected=false;
        if(stopped)return;
        metrics.reconnects++;
        reconnectTimer=setTimeout(connect,1500);
        reconnectTimer.unref?.();
      };
    }catch(error){
      metrics.connected=false;
      metrics.reconnects++;
      metrics.lastError=String(error?.message||error);
      reconnectTimer=setTimeout(connect,1500);
      reconnectTimer.unref?.();
    }
  }

  syncStorePools();
  syncTimer=setInterval(()=>{
    syncStorePools();
    cleanupPendingPools();
  },5000);
  syncTimer.unref?.();
  connect();
  return {
    ingestLogs,
    registerToken,
    dropMint(mint){
      mint=String(mint||'');
      for(const [pool,meta] of poolToToken){
        if(meta.mint===mint){
          poolToToken.delete(pool);
          pendingByPool.delete(pool);
        }
      }
      return true;
    },
    metrics:()=>({
      ...metrics,
      trackedPools:poolToToken.size,
      pendingPools:pendingByPool.size
    }),
    stop(){
      stopped=true;
      clearTimeout(reconnectTimer);
      clearInterval(syncTimer);
      try{ws?.close?.()}catch{}
    }
  };
}