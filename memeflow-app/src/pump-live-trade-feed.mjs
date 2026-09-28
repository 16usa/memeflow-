// MEMEFLOW_OPPORTUNITY_ENGINE_V1
// Pump logsSubscribe -> one decoded TradeEvent -> one holder/market/opportunity
// snapshot -> one evaluation. No Solana HTTP RPC in the live scanner hot path.

import crypto from 'node:crypto';

const VERSION='V14.0';
const PUMP_PROGRAM='6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P';
const DISC=crypto.createHash('sha256').update('event:TradeEvent').digest().subarray(0,8);
const B58='123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

// MEMEFLOW_QUOTE_AWARE_PUMP_PRICE_V14
// Pump create_v2 can trade against a quote mint other than SOL.
// Internal engine still uses SOL-equivalent price, so USDC is converted
// to SOL only AFTER deriving the real USD execution price.
const DEFAULT_PUBKEY='11111111111111111111111111111111';
const WSOL_MINT='So11111111111111111111111111111111111111112';
const USDC_MINT='EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';

function envList(name){return String(process.env[name]||'').split(',').map(x=>x.trim()).filter(Boolean)}
async function makeWS(url){if(typeof globalThis.WebSocket==='function')return new globalThis.WebSocket(url);const mod=await import('ws');return new mod.WebSocket(url)}
function b58(buf){let x=0n;for(const b of buf)x=(x<<8n)+BigInt(b);let s='';while(x){const r=Number(x%58n);s=B58[r]+s;x/=58n}for(const b of buf){if(b!==0)break;s='1'+s}return s||'1'}
function u64(b,o){return b.length>=o+8?b.readBigUInt64LE(o):null}
function pk(b,o){return b.length>=o+32?b58(b.subarray(o,o+32)):null}

export function decodeTradeEvent(buf){
  // Official Pump TradeEvent fixed prefix:
  // disc, mint, sol_amount, token_amount, is_buy, user, timestamp,
  // virtual_sol_reserves, virtual_token_reserves, real_sol_reserves,
  // real_token_reserves, fee_recipient, fee_basis_points, fee, creator,
  // creator_fee_basis_points, creator_fee, ...
  if(!Buffer.isBuffer(buf)||buf.length<89||!buf.subarray(0,8).equals(DISC))return null;
  let o=8;
  const mint=pk(buf,o);o+=32;
  const solAmount=u64(buf,o);o+=8;
  const tokenAmount=u64(buf,o);o+=8;
  if(!mint||solAmount===null||tokenAmount===null)return null;
  const isBuy=buf[o++]!==0;
  const user=pk(buf,o);o+=32;
  if(!user)return null;

  let timestamp=null,virtualSolReserves=null,virtualTokenReserves=null,realSolReserves=null,realTokenReserves=null;
  if(buf.length>=o+8){timestamp=buf.readBigInt64LE(o);o+=8}
  if(buf.length>=o+8){virtualSolReserves=u64(buf,o);o+=8}
  if(buf.length>=o+8){virtualTokenReserves=u64(buf,o);o+=8}
  if(buf.length>=o+8){realSolReserves=u64(buf,o);o+=8}
  if(buf.length>=o+8){realTokenReserves=u64(buf,o);o+=8}

  let feeRecipient=null,feeBasisPoints=null,fee=null,creator=null,creatorFeeBasisPoints=null,creatorFee=null;
  if(buf.length>=o+32){feeRecipient=pk(buf,o);o+=32}
  if(buf.length>=o+8){feeBasisPoints=u64(buf,o);o+=8}
  if(buf.length>=o+8){fee=u64(buf,o);o+=8}
  if(buf.length>=o+32){creator=pk(buf,o);o+=32}
  if(buf.length>=o+8){creatorFeeBasisPoints=u64(buf,o);o+=8}
  if(buf.length>=o+8){creatorFee=u64(buf,o);o+=8}

  // Newer Pump TradeEvent tail. EOF tolerant for legacy SOL events.
  let trackVolume=null;
  let totalUnclaimedTokens=null,totalClaimedTokens=null,currentSolVolume=null;
  let lastUpdateTimestamp=null,ixName=null,mayhemMode=null;
  let cashbackFeeBasisPoints=null,cashbackFee=null;
  let buybackFeeBasisPoints=null,buybackFee=null;
  let quoteMint=null,quoteAmount=null;
  let virtualQuoteReserves=null,realQuoteReserves=null;

  try{
    if(buf.length>=o+1)trackVolume=buf[o++]!==0;
    if(buf.length>=o+8){totalUnclaimedTokens=u64(buf,o);o+=8}
    if(buf.length>=o+8){totalClaimedTokens=u64(buf,o);o+=8}
    if(buf.length>=o+8){currentSolVolume=u64(buf,o);o+=8}
    if(buf.length>=o+8){lastUpdateTimestamp=buf.readBigInt64LE(o);o+=8}

    if(buf.length>=o+4){
      const n=buf.readUInt32LE(o);o+=4;
      if(n>256||buf.length<o+n)throw Error('invalid TradeEvent ix_name');
      ixName=buf.subarray(o,o+n).toString('utf8');o+=n;
    }

    if(buf.length>=o+1)mayhemMode=buf[o++]!==0;
    if(buf.length>=o+8){cashbackFeeBasisPoints=u64(buf,o);o+=8}
    if(buf.length>=o+8){cashbackFee=u64(buf,o);o+=8}
    if(buf.length>=o+8){buybackFeeBasisPoints=u64(buf,o);o+=8}
    if(buf.length>=o+8){buybackFee=u64(buf,o);o+=8}

    // Vec<Shareholder>: u32 length + (Pubkey 32 + u16 share_bps) per row.
    if(buf.length>=o+4){
      const count=buf.readUInt32LE(o);o+=4;
      const bytes=count*34;
      if(count>128||buf.length<o+bytes)throw Error('invalid TradeEvent shareholders');
      o+=bytes;
    }

    if(buf.length>=o+32){quoteMint=pk(buf,o);o+=32}
    if(buf.length>=o+8){quoteAmount=u64(buf,o);o+=8}
    if(buf.length>=o+8){virtualQuoteReserves=u64(buf,o);o+=8}
    if(buf.length>=o+8){realQuoteReserves=u64(buf,o);o+=8}
  }catch{
    // Legacy events remain valid. quoteMint can still come from CreateEvent.
  }

  return {
    mint,user,isBuy,solAmount,tokenAmount,timestamp,
    virtualSolReserves,virtualTokenReserves,realSolReserves,realTokenReserves,
    feeRecipient,feeBasisPoints,fee,creator,creatorFeeBasisPoints,creatorFee,
    trackVolume,totalUnclaimedTokens,totalClaimedTokens,currentSolVolume,
    lastUpdateTimestamp,ixName,mayhemMode,
    cashbackFeeBasisPoints,cashbackFee,buybackFeeBasisPoints,buybackFee,
    quoteMint,quoteAmount,virtualQuoteReserves,realQuoteReserves
  };
}
function programData(log){const m=/^Program data:\s*([A-Za-z0-9+/=]+)\s*$/.exec(String(log||'').trim());if(!m)return null;try{return Buffer.from(m[1],'base64')}catch{return null}}
function marketFromEvent(e,token,solUsd){
  const quoteMint=String(e?.quoteMint||token?.quoteMint||'').trim();

  const quoteKind=
    !quoteMint||quoteMint===DEFAULT_PUBKEY||quoteMint===WSOL_MINT
      ? 'SOL'
      : quoteMint===USDC_MINT
        ? 'USDC'
        : 'UNSUPPORTED';

  const decimals=Math.max(
    0,
    Math.min(
      12,
      Math.floor(Number(token?.decimals??token?.tokenDecimals??6))
    )
  );

  let priceSol=null;
  let priceUsd=null;
  let liquiditySol=null;
  let liquidityUsd=null;

  if(quoteKind==='SOL'){
    if(
      e.virtualSolReserves!==null&&
      e.virtualTokenReserves!==null&&
      e.virtualSolReserves>0n&&
      e.virtualTokenReserves>0n
    ){
      priceSol=
        (Number(e.virtualSolReserves)/1e9)/
        (Number(e.virtualTokenReserves)/(10**decimals));
    }

    if(e.realSolReserves!==null){
      liquiditySol=Number(e.realSolReserves)/1e9;
    }

    const usd=Number(solUsd);
    if(Number.isFinite(priceSol)&&priceSol>0&&Number.isFinite(usd)&&usd>0){
      priceUsd=priceSol*usd;
    }
    if(Number.isFinite(liquiditySol)&&Number.isFinite(usd)&&usd>0){
      liquidityUsd=liquiditySol*usd;
    }
  }

  if(quoteKind==='USDC'){
    // For quote-paired Pump trades, use the REAL quote execution amount.
    // Do NOT treat it as lamports and multiply it by SOL/USD.
    const quoteRaw=e.quoteAmount??e.solAmount;
    const tokenRaw=e.tokenAmount;
    const usd=Number(solUsd);

    if(
      quoteRaw!==null&&quoteRaw!==undefined&&
      tokenRaw!==null&&tokenRaw!==undefined&&
      quoteRaw>0n&&tokenRaw>0n
    ){
      const quoteUi=Number(quoteRaw)/1e6;
      const tokenUi=Number(tokenRaw)/(10**decimals);

      if(quoteUi>0&&tokenUi>0){
        priceUsd=quoteUi/tokenUi;

        if(Number.isFinite(usd)&&usd>0){
          priceSol=priceUsd/usd;
        }
      }
    }

    if(
      e.realQuoteReserves!==null&&
      e.realQuoteReserves!==undefined
    ){
      liquidityUsd=Number(e.realQuoteReserves)/1e6;

      if(Number.isFinite(usd)&&usd>0){
        liquiditySol=liquidityUsd/usd;
      }
    }
  }

  const quotePricingReady=
    Number.isFinite(priceSol)&&
    priceSol>0&&
    (
      quoteKind==='SOL'||
      quoteKind==='USDC'
    );

  return {
    quoteMint:quoteMint||null,
    quoteKind,
    quotePricingReady,
    priceSol,
    priceUsd,
    liquiditySol,
    liquidityUsd
  };
}

function canonicalEventForMarket(e,m,solUsd){
  if(m?.quoteKind!=='USDC'){
    return {
      ...e,
      quoteMint:m?.quoteMint||e?.quoteMint||null,
      marketQuoteKind:m?.quoteKind||'SOL'
    };
  }

  let normalizedSolAmount=e.solAmount;

  const quoteRaw=e.quoteAmount??e.solAmount;
  const usd=Number(solUsd);

  if(
    quoteRaw!==null&&quoteRaw!==undefined&&
    quoteRaw>0n&&
    Number.isFinite(usd)&&
    usd>0
  ){
    const quoteUsd=Number(quoteRaw)/1e6;
    const equivalentSol=quoteUsd/usd;

    normalizedSolAmount=
      BigInt(
        Math.max(
          0,
          Math.round(equivalentSol*1e9)
        )
      );
  }

  return {
    ...e,
    solAmount:normalizedSolAmount,
    quoteAmount:e.quoteAmount??e.solAmount,
    quoteMint:m.quoteMint,
    marketQuoteKind:'USDC'
  };
}

// MEMEFLOW_LIVE_MARKET_CAP_V1
function normalizedPumpSupply(token){
  const direct=Number(token?.totalSupply);
  if(Number.isFinite(direct)&&direct>0){
    // Repair registry rows created before Pump base-unit normalization.
    return direct>1e12?direct/1e6:direct;
  }

  const raw=Number(
    token?.tokenTotalSupplyRaw ??
    token?.pumpTotalSupplyRaw
  );
  if(Number.isFinite(raw)&&raw>0){
    const decimals=Math.max(
      0,
      Math.min(12,Math.floor(Number(token?.tokenDecimals??6)))
    );
    return raw/(10**decimals);
  }

  // Pump bonding-curve tokens use the canonical 1B-token supply unless a
  // decoded supply says otherwise.
  const pump=String(
    token?.launchPlatform ??
    token?.protocol ??
    token?.source ??
    ''
  ).toLowerCase();

  return pump.includes('pump')?1_000_000_000:null;
}
function tokenFromStore(store,mint){
  try{
    const token=
      store?.getToken?.(mint)||
      store?.state?.tokens?.[mint]||
      (Array.isArray(store?.state?.tokens)
        ? store.state.tokens.find(x=>x?.mint===mint)
        : null)||
      null;

    if(
      token?.registryHistorical===true &&
      token?.wsFirst!==true &&
      typeof store?.setToken==='function'
    ){
      return store.setToken(mint,{
        wsFirst:true,
        registryReactivatedAt:Date.now(),
        source:token.source||'Pump registry reactivated by live trade'
      });
    }

    return token;
  }catch{
    return null
  }
}

export function startPumpLiveTradeFeed(opts={}){
  const {
    eventHolderLedger,store,publish,publishTrade,preprocessTrade,evaluateAI,
    opportunityEngine,getSolUsd,onDead,onTokenUpdate
  }=opts;
  const urls=envList('SOLANA_WS_URLS');

  const metrics={
    version:VERSION,startedAt:Date.now(),connected:false,reconnects:0,
    notifications:0,programDataSeen:0,tradeEventsDecoded:0,decodeErrors:0,
    holderSnapshots:0,marketSnapshots:0,repeatTradeEvents:0,
    distinctMints:0,distinctUsers:0,lastMint:null,lastUser:null,lastError:null,
    httpRpcCalls:0,queueDepth:0,active:0,
    evaluationCalls:0,evaluationResolved:0,evaluationRejected:0,evaluationNullResults:0,
    evaluationDecisionLikeResults:0,lastEvaluationMint:null,lastEvaluationTrigger:null,
    lastEvaluationAt:null,lastEvaluationResultType:null,lastEvaluationError:null,
    logBatchesIngested:0,externalLogBatches:0,dedicatedLogBatches:0,
    duplicateTradeEventsSkipped:0,unknownMintEventsIgnored:0,
    deadTokensDetected:0,deadTokensDropped:0,
    lastTradeEventAt:null,lastTradeEventSource:null,
    lastStoreUpdateAt:null,lastStoreUpdateMint:null,
    migratedPumpEventsIgnored:0
  };

  const mintCounts=new Map(),users=new Set();
  const seenTradeEvents=new Map();
  const __v1226EvalByMint=new Map();
  let ws=null,stopped=false,idx=0,reconnectTimer=null;

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
      p.then(r=>{
        metrics.evaluationResolved++;
        if(r===null||r===undefined)metrics.evaluationNullResults++;
        else if(typeof r==='object'&&(r.decisionLike===true||r.state||r.decision||r.result||r.primaryReason||r.reasons))metrics.evaluationDecisionLikeResults++;
        metrics.lastEvaluationResultType=__v1226ResultType(r);
        metrics.lastEvaluationError=null;
        __v1226Remember(mint||updated?.mint||null,trigger,'resolved',r,null);
      }).catch(err=>{
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

  function tradeEventKey(e,signature,index){
    const sig=String(signature||'').trim();
    if(sig)return `${sig}:${Number(index)||0}`;
    return [e?.mint||'',e?.user||'',e?.isBuy===true?'B':'S',String(e?.timestamp??''),String(e?.solAmount??''),String(e?.tokenAmount??'')].join('|');
  }
  function acceptTradeEventKey(key){
    if(!key)return true;
    if(seenTradeEvents.has(key))return false;
    seenTradeEvents.set(key,Date.now());
    while(seenTradeEvents.size>25000){const oldest=seenTradeEvents.keys().next().value;if(oldest===undefined)break;seenTradeEvents.delete(oldest)}
    return true;
  }

  function ingestLogs(logs,{signature=null,source='external',slot=null}={}){
    const rows=Array.isArray(logs)?logs:[];
    if(!rows.length)return 0;
    metrics.logBatchesIngested++;
    if(source==='dedicated-ws')metrics.dedicatedLogBatches++;else metrics.externalLogBatches++;
    let accepted=0;

    for(let i=0;i<rows.length;i++){
      const b=programData(rows[i]);
      if(!b)continue;
      metrics.programDataSeen++;
      try{
        const e=decodeTradeEvent(b);
        if(!e)continue;

        /* MEMEFLOW_COPY_TRADING_PREPROCESS_UNKNOWN_MINT_V2
         * Preserve the fresh-session scanner contract exactly:
         * decode -> optional tracked-wallet materialization -> const known gate
         * -> dedupe. The original `const known=tokenFromStore(...)` statement
         * deliberately remains intact because it is the canonical scanner gate.
         */
        const event={...e,signature:signature||null,slot};

        if(!tokenFromStore(store,e.mint)){
          try{preprocessTrade?.(event)}catch(err){
            metrics.lastError='copy-preprocess:'+String(err?.message||err);
          }
        }

        // MEMEFLOW_FRESH_SESSION_SCANNER_V1
        const known=tokenFromStore(store,e.mint);
        if(!known){metrics.unknownMintEventsIgnored++;continue}

        const key=tradeEventKey(e,signature,i);
        if(!acceptTradeEventKey(key)){metrics.duplicateTradeEventsSkipped++;continue}

        metrics.lastTradeEventAt=Date.now();
        metrics.lastTradeEventSource=source;
        applyEvent(event);
        accepted++;
      }catch(err){
        metrics.decodeErrors++;
        metrics.lastError='decode:'+String(err?.message||err);
      }
    }
    return accepted;
  }

  function applyEvent(e){
    metrics.tradeEventsDecoded++;
    metrics.lastMint=e.mint;
    metrics.lastUser=e.user;
    users.add(e.user);metrics.distinctUsers=users.size;
    const prev=mintCounts.get(e.mint)||0;
    mintCounts.set(e.mint,prev+1);
    if(prev>0)metrics.repeatTradeEvents++;
    metrics.distinctMints=mintCounts.size;

    const known=tokenFromStore(store,e.mint);
    if(!known)return;
    if(
      known.pumpSwapSourceActive===true ||
      known.marketProtocol==='pumpswap'
    ){
      metrics.migratedPumpEventsIgnored++;
      return;
    }

    let holderSnap=null;
    try{
      const creator=known?.creator||known?.developer||known?.creatorWallet||e?.creator||null;
      if(creator)eventHolderLedger?.setCreator?.(e.mint,creator);
      holderSnap=eventHolderLedger?.ingestTradeEventDirect?.(e)||null;
      if(holderSnap)metrics.holderSnapshots++;
    }catch(err){metrics.lastError='holder:'+String(err?.message||err)}

    try{
      const solUsd=typeof getSolUsd==='function'?getSolUsd():null;
      const m=marketFromEvent(e,known,solUsd);
      const canonicalEvent=canonicalEventForMarket(e,m,solUsd);

      const mergedForFeatures={
        ...known,...(holderSnap||{}),
        priceSol:
          m.quotePricingReady===true&&
          Number.isFinite(m.priceSol)&&
          m.priceSol>0
            ? m.priceSol
            : known.priceSol,
        liquiditySol:
          m.quotePricingReady===true&&
          Number.isFinite(m.liquiditySol)&&
          m.liquiditySol>=0
            ? m.liquiditySol
            : known.liquiditySol
      };

      const opp=
        m.quotePricingReady===true
          ? (
              opportunityEngine?.update?.(canonicalEvent,{
                creator:mergedForFeatures.creator||e.creator||null,
                priceSol:mergedForFeatures.priceSol,
                liquiditySol:mergedForFeatures.liquiditySol,
                holderCount:mergedForFeatures.holderCount,
                top10Pct:mergedForFeatures.top10Pct,
                developerPct:mergedForFeatures.developerPct??mergedForFeatures.developerSharePct,
                holderFresh:mergedForFeatures.holderFresh===true,
                totalSupplyRaw:mergedForFeatures.tokenTotalSupplyRaw,
                totalSupply:mergedForFeatures.totalSupply,
                initialRealTokenReservesRaw:mergedForFeatures.initialRealTokenReservesRaw||mergedForFeatures.realTokenReservesRaw,
                launchSlot:mergedForFeatures.createSlot??mergedForFeatures.slot,
                launchSignature:mergedForFeatures.createSignature||mergedForFeatures.signature,
                solUsd
              })||{}
            )
          : {};

      const liveSupply=normalizedPumpSupply(mergedForFeatures);
      const liveMarketCapSol=
        Number.isFinite(m.priceSol)&&m.priceSol>0&&
        Number.isFinite(liveSupply)&&liveSupply>0
          ? m.priceSol*liveSupply
          : null;

      const liveMarketCapUsd=
        Number.isFinite(liveMarketCapSol)&&liveMarketCapSol>0&&
        Number.isFinite(Number(solUsd))&&Number(solUsd)>0
          ? liveMarketCapSol*Number(solUsd)
          : null;

      const holderObservedPatch=holderSnap?{
        observedHolderCount:holderSnap.observedHolderCount??null,
        holderRiskWallets:holderSnap.holderRiskWallets??[],
        holderRiskWalletsKey:holderSnap.holderRiskWalletsKey??null,
        holderRiskWalletsScannedAt:holderSnap.holderRiskWalletsScannedAt??null,
        eventLedgerVersion:holderSnap.eventLedgerVersion??null,
        eventLedgerLastUser:holderSnap.eventLedgerLastUser??null,
        eventLedgerTxCount:holderSnap.eventLedgerTxCount??null,
        eventLedgerCreator:holderSnap.eventLedgerCreator??null,
        eventLedgerTrackedSupplyRaw:holderSnap.eventLedgerTrackedSupplyRaw??null,
        eventLedgerTotalSupplyRaw:holderSnap.eventLedgerTotalSupplyRaw??null,
        eventLedgerDecimals:holderSnap.eventLedgerDecimals??null,
        eventLedgerCoveragePct:holderSnap.eventLedgerCoveragePct??null
      }:{};

      const patch={
        ...holderObservedPatch,
        ...opp,
        marketSource:
          m.quotePricingReady===true
            ? 'ws-direct-trade-event-v14'
            : 'quote-pricing-blocked-v14',
        liveMarketCapSource:
          m.quotePricingReady===true
            ? 'pump-trade-price-x-supply-v14'
            : 'quote-pricing-blocked-v14',
        eventSlot:e.slot??null,
        eventSignature:
          m.quotePricingReady===true
            ? e.signature||null
            : null,
        quoteMint:m.quoteMint||known?.quoteMint||null,
        quotePricingReady:m.quotePricingReady===true,
        quotePricingMode:m.quoteKind,
        quotePriceUsd:
          Number.isFinite(m.priceUsd)&&m.priceUsd>0
            ? m.priceUsd
            : null,
        virtualSolReservesRaw:e.virtualSolReserves?.toString?.()||null,
        virtualTokenReservesRaw:e.virtualTokenReserves?.toString?.()||null,
        realSolReservesRaw:e.realSolReserves?.toString?.()||null,
        realTokenReservesRaw:e.realTokenReserves?.toString?.()||null,
        virtualQuoteReservesRaw:e.virtualQuoteReserves?.toString?.()||null,
        realQuoteReservesRaw:e.realQuoteReserves?.toString?.()||null,
        quoteAmountRaw:(e.quoteAmount??null)?.toString?.()||null
      };

      if(m.quotePricingReady===true){
        patch.lastPriceAt=Date.now();
        patch.lastMarketActivityAt=Date.now();
        patch.marketCapUpdatedAt=Date.now();
      }

      if(Number.isFinite(m.priceSol)&&m.priceSol>0)patch.priceSol=m.priceSol;
      if(Number.isFinite(m.liquiditySol)&&m.liquiditySol>=0)patch.liquiditySol=m.liquiditySol;
      if(Number.isFinite(m.liquidityUsd)&&m.liquidityUsd>=0)patch.liquidityUsd=m.liquidityUsd;
      if(Number.isFinite(liveSupply)&&liveSupply>0)patch.totalSupply=liveSupply;
      if(Number.isFinite(liveMarketCapSol)&&liveMarketCapSol>0)patch.marketCapSol=liveMarketCapSol;
      if(Number.isFinite(liveMarketCapUsd)&&liveMarketCapUsd>0)patch.marketCapUsd=liveMarketCapUsd;

      const updated=store?.setToken?.(e.mint,patch);
      if(!updated)return;
      metrics.marketSnapshots++;
      metrics.lastStoreUpdateAt=Date.now();
      metrics.lastStoreUpdateMint=e.mint;

      // MEMEFLOW_PAPER_LIFECYCLE_LIVE_WIRE_V84
      // Every confirmed Pump TradeEvent updates OPEN PAPER positions using
      // the same canonical token snapshot that drives Score / State.
      try{
        if(m.quotePricingReady===true){
          onTokenUpdate?.(e.mint,updated);
        }
      }catch(err){
        metrics.lastError=
          'paper-lifecycle:'+String(err?.message||err);
      }

      let dropped=false;
      if(updated.dead===true){
        metrics.deadTokensDetected++;
        try{dropped=onDead?.(e.mint,updated.deadReason||'DEAD')===true}catch{}
        if(dropped)metrics.deadTokensDropped++;
      }
      if(dropped)return;

      // One TradeEvent -> one evaluation, after holder + market + momentum are
      // already merged into the same canonical token snapshot.
      if(m.quotePricingReady===true){
        try{__v1226Evaluate(updated,e.mint,'trade-event-complete')}catch{}
        try{publishTrade?.(e.mint,canonicalEvent,updated)}catch{}
      }
      try{publish?.(e.mint)}catch{}
    }catch(err){
      metrics.lastError='market:'+String(err?.message||err);
    }
  }

  async function connect(){
    if(stopped||!urls.length){if(!urls.length)metrics.lastError='No SOLANA_WS_URLS';return}
    const url=urls[idx++%urls.length];
    try{
      ws=await makeWS(url);
      ws.onopen=()=>{
        metrics.connected=true;
        try{ws.send(JSON.stringify({jsonrpc:'2.0',id:122,method:'logsSubscribe',params:[{mentions:[PUMP_PROGRAM]},{commitment:'confirmed'}]}))}catch{}
      };
      ws.onmessage=ev=>{
        try{
          const j=JSON.parse(typeof ev.data==='string'?ev.data:String(ev.data));
          const result=j?.params?.result;
          const value=result?.value;
          if(!value||value.err)return;
          metrics.notifications++;
          ingestLogs(value.logs||[],{
            signature:value.signature||null,
            source:'dedicated-ws',
            slot:result?.context?.slot??null
          });
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

  connect();

  return {
    ingestLogs,
    dropMint:(mint)=>{mintCounts.delete(String(mint||''));return true},
    metrics:()=>({...metrics,queueDepth:0,active:0,httpRpcCalls:0,evaluationRecent:Array.from(__v1226EvalByMint.values()).slice(-12)}),
    stop:()=>{stopped=true;clearTimeout(reconnectTimer);try{ws?.close?.()}catch{}}
  };
}
