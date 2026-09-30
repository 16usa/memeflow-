from pathlib import Path

ROOT=Path("memeflow-app")
feed=ROOT/"src/pump-live-trade-feed.mjs"
archive=ROOT/"src/chart-history-archive.mjs"
history=ROOT/"src/pump-history-backfill.mjs"
server=ROOT/"app-server.mjs"
trading=ROOT/"trading.js"

def replace_once(text, old, new, label):
    if old not in text:
        raise SystemExit(f"ERROR: {label}: target not found; repository is not the expected V15 state")
    return text.replace(old,new,1)

# 1) LIVE TRADE PRICE: execution amounts first, reserves fallback.
s=feed.read_text()
s=replace_once(s,"const VERSION='V15.0';","const VERSION='V16.0';","feed version")

start=s.index("function marketFromEvent(e,token,solUsd){")
end=s.index("\nfunction canonicalEventForMarket", start)

new_market=r"""function marketFromEvent(e,token,solUsd){
  // MEMEFLOW_EXECUTION_PRICE_AUTHORITY_V16
  // Confirmed BUY/SELL execution is the primary price authority.
  const tokenQuoteMint=String(token?.quoteMint||'').trim();
  const eventQuoteMint=String(e?.quoteMint||'').trim();
  const quoteMint=tokenQuoteMint||eventQuoteMint;

  const hasQuoteTail=Boolean(
    e?.quoteAmount!==null&&e?.quoteAmount!==undefined ||
    e?.virtualQuoteReserves!==null&&e?.virtualQuoteReserves!==undefined ||
    e?.realQuoteReserves!==null&&e?.realQuoteReserves!==undefined
  );

  const quoteKind=
    !quoteMint
      ? (hasQuoteTail?'UNSUPPORTED':'SOL')
      : quoteMint===DEFAULT_PUBKEY||quoteMint===WSOL_MINT
        ? 'SOL'
        : quoteMint===USDC_MINT
          ? 'USDC'
          : 'UNSUPPORTED';

  const decimals=Math.max(
    0,
    Math.min(12,Math.floor(Number(token?.decimals??token?.tokenDecimals??6)))
  );

  const quoteDecimals=Math.max(
    0,
    Math.min(12,Math.floor(Number(token?.quoteDecimals??6)))
  );

  const tokenRaw=e?.tokenAmount;
  const tokenUi=
    tokenRaw!==null&&tokenRaw!==undefined&&tokenRaw>0n
      ? Number(tokenRaw)/(10**decimals)
      : null;

  const usd=Number(solUsd);
  let priceSol=null;
  let priceUsd=null;
  let liquiditySol=null;
  let liquidityUsd=null;
  let priceMethod=null;

  if(quoteKind==='SOL'){
    if(
      e?.solAmount!==null&&
      e?.solAmount!==undefined&&
      e.solAmount>0n&&
      Number.isFinite(tokenUi)&&
      tokenUi>0
    ){
      const executionSol=Number(e.solAmount)/1e9;
      if(executionSol>0){
        priceSol=executionSol/tokenUi;
        priceMethod='trade-execution-sol';
      }
    }

    if(
      !(Number.isFinite(priceSol)&&priceSol>0)&&
      e.virtualSolReserves!==null&&
      e.virtualTokenReserves!==null&&
      e.virtualSolReserves>0n&&
      e.virtualTokenReserves>0n
    ){
      priceSol=
        (Number(e.virtualSolReserves)/1e9)/
        (Number(e.virtualTokenReserves)/(10**decimals));
      priceMethod='virtual-reserves-sol-fallback';
    }

    if(e.realSolReserves!==null){
      liquiditySol=Number(e.realSolReserves)/1e9;
    }

    if(Number.isFinite(priceSol)&&priceSol>0&&Number.isFinite(usd)&&usd>0){
      priceUsd=priceSol*usd;
    }
    if(Number.isFinite(liquiditySol)&&Number.isFinite(usd)&&usd>0){
      liquidityUsd=liquiditySol*usd;
    }
  }

  if(quoteKind==='USDC'){
    const quoteRaw=e.quoteAmount??e.solAmount;

    if(
      quoteRaw!==null&&quoteRaw!==undefined&&
      quoteRaw>0n&&
      Number.isFinite(tokenUi)&&
      tokenUi>0
    ){
      const quoteUi=Number(quoteRaw)/(10**quoteDecimals);
      if(quoteUi>0){
        priceUsd=quoteUi/tokenUi;
        priceMethod='trade-execution-usdc';
        if(Number.isFinite(usd)&&usd>0){
          priceSol=priceUsd/usd;
        }
      }
    }

    if(e.realQuoteReserves!==null&&e.realQuoteReserves!==undefined){
      liquidityUsd=Number(e.realQuoteReserves)/(10**quoteDecimals);
      if(Number.isFinite(usd)&&usd>0){
        liquiditySol=liquidityUsd/usd;
      }
    }
  }

  const quotePricingReady=
    Number.isFinite(priceSol)&&
    priceSol>0&&
    (quoteKind==='SOL'||quoteKind==='USDC');

  return {
    quoteMint:quoteMint||null,
    quoteKind,
    quotePricingReady,
    priceMethod,
    priceSol,
    priceUsd,
    liquiditySol,
    liquidityUsd
  };
}"""
s=s[:start]+new_market+s[end:]

old_core=r"""      const solUsd=typeof getSolUsd==='function'?getSolUsd():null;
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

"""
new_core=r"""      const solUsd=typeof getSolUsd==='function'?getSolUsd():null;
      const m=marketFromEvent(e,known,solUsd);
      const canonicalEvent=canonicalEventForMarket(e,m,solUsd);

      // MEMEFLOW_PUMP_REFERENCE_SANITY_V16
      // Pump HTTP is display/reference only. It never authorizes entry.
      // A catastrophic (>20x) mismatch fails CLOSED.
      const preFeatures={...known,...(holderSnap||{})};
      const liveSupply=normalizedPumpSupply(preFeatures);

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

      const referenceMarketCapUsd=Number(known?.pumpReportedMarketCapUsd);
      const referenceAt=Number(known?.pumpReferenceAt);
      const referenceFresh=
        Number.isFinite(referenceMarketCapUsd)&&
        referenceMarketCapUsd>0&&
        Number.isFinite(referenceAt)&&
        referenceAt>0&&
        Date.now()-referenceAt<=90_000;

      let marketSanityRatio=null;
      let marketReady=m.quotePricingReady===true;

      if(
        marketReady&&
        referenceFresh&&
        Number.isFinite(liveMarketCapUsd)&&
        liveMarketCapUsd>0
      ){
        marketSanityRatio=
          Math.max(liveMarketCapUsd,referenceMarketCapUsd)/
          Math.min(liveMarketCapUsd,referenceMarketCapUsd);

        if(marketSanityRatio>20){
          marketReady=false;
        }
      }

      const mergedForFeatures={
        ...preFeatures,
        priceSol:
          marketReady&&Number.isFinite(m.priceSol)&&m.priceSol>0
            ? m.priceSol
            : known.priceSol,
        liquiditySol:
          marketReady&&Number.isFinite(m.liquiditySol)&&m.liquiditySol>=0
            ? m.liquiditySol
            : known.liquiditySol
      };

      const opp=
        marketReady
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

"""
s=replace_once(s,old_core,new_core,"live market sanity block")

block_start=s.index("      const holderObservedPatch")
block_end=s.index("      try{publish?.(e.mint)}catch{}",block_start)
block=s[block_start:block_end]

block=block.replace("m.quotePricingReady===true","marketReady")
block=block.replace("m.quotePricingReady!==true","!marketReady")
block=block.replace("'ws-direct-trade-event-v14'","'ws-direct-trade-event-v16'")
block=block.replace("'quote-pricing-blocked-v14'","'quote-pricing-blocked-v16'")
block=block.replace("'pump-trade-price-x-supply-v14'","'pump-trade-price-x-supply-v16'")

block=block.replace(
"""        quotePricingMode:m.quoteKind,
        quotePriceUsd:""",
"""        quotePricingMode:
          marketReady
            ? m.quoteKind
            : (marketSanityRatio>20?'REFERENCE_MISMATCH':m.quoteKind),
        quotePriceMethod:m.priceMethod||null,
        marketSanityRatio:
          Number.isFinite(marketSanityRatio)?marketSanityRatio:null,
        pumpReportedMarketCapUsd:
          referenceFresh
            ? referenceMarketCapUsd
            : (known?.pumpReportedMarketCapUsd??null),
        quotePriceUsd:"""
)

block=block.replace(
"""      if(Number.isFinite(m.priceSol)&&m.priceSol>0)patch.priceSol=m.priceSol;
      if(Number.isFinite(m.liquiditySol)&&m.liquiditySol>=0)patch.liquiditySol=m.liquiditySol;
      if(Number.isFinite(m.liquidityUsd)&&m.liquidityUsd>=0)patch.liquidityUsd=m.liquidityUsd;
      if(Number.isFinite(liveSupply)&&liveSupply>0)patch.totalSupply=liveSupply;
      if(Number.isFinite(liveMarketCapSol)&&liveMarketCapSol>0)patch.marketCapSol=liveMarketCapSol;
      if(Number.isFinite(liveMarketCapUsd)&&liveMarketCapUsd>0)patch.marketCapUsd=liveMarketCapUsd;""",
"""      if(marketReady&&Number.isFinite(m.priceSol)&&m.priceSol>0)patch.priceSol=m.priceSol;
      if(marketReady&&Number.isFinite(m.liquiditySol)&&m.liquiditySol>=0)patch.liquiditySol=m.liquiditySol;
      if(marketReady&&Number.isFinite(m.liquidityUsd)&&m.liquidityUsd>=0)patch.liquidityUsd=m.liquidityUsd;
      if(Number.isFinite(liveSupply)&&liveSupply>0)patch.totalSupply=liveSupply;
      if(marketReady&&Number.isFinite(liveMarketCapSol)&&liveMarketCapSol>0)patch.marketCapSol=liveMarketCapSol;
      if(marketReady&&Number.isFinite(liveMarketCapUsd)&&liveMarketCapUsd>0)patch.marketCapUsd=liveMarketCapUsd;"""
)

block=block.replace(
"""      if(!marketReady){
        patch.priceSol=null;
        patch.marketCapSol=null;
        patch.marketCapUsd=null;
        patch.liquiditySol=null;
        patch.liquidityUsd=null;
      }""",
"""      if(!marketReady){
        patch.priceSol=null;
        patch.marketCapSol=null;
        patch.marketCapUsd=referenceFresh?referenceMarketCapUsd:null;
        patch.liquiditySol=null;
        patch.liquidityUsd=null;
      }"""
)

s=s[:block_start]+block+s[block_end:]
feed.write_text(s)

# 2) CHART BACKFILL: same execution-price authority, fresh namespace.
s=archive.read_text()
start=s.index("function marketPoint(event,{token={},solUsd=null,decimals=6}={}){")
end=s.index("\nfunction cleanMint",start)

new_point=r"""function marketPoint(event,{token={},solUsd=null,decimals=6}={}){
  // MEMEFLOW_CHART_EXECUTION_PRICE_AUTHORITY_V16
  const tokenQuote=String(token?.quoteMint||'').trim();
  const eventQuote=String(event?.quoteMint||'').trim();
  const quoteMint=tokenQuote||eventQuote;

  const hasQuoteTail=Boolean(
    event?.quoteAmount!==null&&event?.quoteAmount!==undefined ||
    event?.virtualQuoteReserves!==null&&event?.virtualQuoteReserves!==undefined ||
    event?.realQuoteReserves!==null&&event?.realQuoteReserves!==undefined
  );

  const kind=
    !quoteMint
      ? (hasQuoteTail?'UNSUPPORTED':'SOL')
      : quoteMint===DEFAULT_PUBKEY||quoteMint===WSOL_MINT
        ? 'SOL'
        : quoteMint===USDC_MINT
          ? 'USDC'
          : 'UNSUPPORTED';

  const rate=Number(solUsd);
  const tokenRaw=event?.tokenAmount;
  const tokenUi=tokenRaw>0n?Number(tokenRaw)/(10**decimals):null;

  if(kind==='SOL'){
    let priceSol=null;
    let source='pump-history-backfill-execution-v16';

    if(event?.solAmount>0n&&Number.isFinite(tokenUi)&&tokenUi>0){
      priceSol=(Number(event.solAmount)/1e9)/tokenUi;
    }

    if(
      !(Number.isFinite(priceSol)&&priceSol>0)&&
      event?.virtualSolReserves>0n&&
      event?.virtualTokenReserves>0n
    ){
      priceSol=
        (Number(event.virtualSolReserves)/1e9)/
        (Number(event.virtualTokenReserves)/(10**decimals));
      source='pump-history-backfill-reserve-fallback-v16';
    }

    if(!(Number.isFinite(priceSol)&&priceSol>0))return null;
    return {
      priceSol,
      solAmount:Number(event.solAmount||0n)/1e9,
      source
    };
  }

  if(kind==='USDC'){
    const quoteDecimals=Math.max(
      0,
      Math.min(12,Math.floor(Number(token?.quoteDecimals??6)))
    );
    const quoteRaw=event?.quoteAmount??event?.solAmount;

    if(
      !(quoteRaw>0n&&
        Number.isFinite(tokenUi)&&tokenUi>0&&
        Number.isFinite(rate)&&rate>0)
    )return null;

    const quoteUsd=Number(quoteRaw)/(10**quoteDecimals);
    const priceUsd=quoteUsd/tokenUi;
    const priceSol=priceUsd/rate;

    if(!(Number.isFinite(priceSol)&&priceSol>0))return null;

    return {
      priceSol,
      priceUsd,
      solAmount:quoteUsd/rate,
      source:'pump-history-backfill-quote-execution-v16'
    };
  }

  return null;
}"""
s=s[:start]+new_point+s[end:]
s=replace_once(
    s,
    "'chart-history-v30-10-quote-v15'",
    "'chart-history-v30-10-execution-v16'",
    "V16 chart namespace"
)
archive.write_text(s)

# 3) PUMP HTTP REFERENCE: normalize current market_cap shape and keep quote metadata.
s=history.read_text()
s=replace_once(
    s,
"""// MEMEFLOW_PUMP_UNIT_NORMALIZATION_V1
// Pump frontend API uses raw integer units for several fields.
// `market_cap` is lamport-denominated; `total_supply` is token base units.
function pumpMarketCapSol(coin){
  const raw=finite(coin?.market_cap);
  if(raw!==null)return raw/1e9;

  // Camel-case fallbacks from other adapters are assumed already normalized.
  return finite(coin?.marketCapSol??coin?.marketCap);
}""",
"""// MEMEFLOW_PUMP_UNIT_NORMALIZATION_V16
// Current Pump payloads commonly expose market_cap in SOL; legacy/adapted
// payloads can still expose lamport-sized integers. Normalize both shapes.
function pumpMarketCapSol(coin){
  const raw=finite(coin?.market_cap);
  if(raw!==null){
    return raw>1_000_000?raw/1e9:raw;
  }
  return finite(coin?.marketCapSol??coin?.marketCap);
}""",
    "Pump market_cap unit normalization"
)
s=replace_once(
    s,
"""    marketCapUsd:finite(coin?.usd_market_cap??coin?.marketCapUsd),
    marketCapSol:pumpMarketCapSol(coin),
    totalSupply:pumpSupplyTokens(coin),
    pumpMarketCapRawLamports:finite(coin?.market_cap),
    pumpTotalSupplyRaw:finite(coin?.total_supply),
    tokenDecimals:finite(coin?.decimals)??6,""",
"""    marketCapUsd:finite(
      coin?.usd_market_cap ??
      coin?.market_cap_usd ??
      coin?.marketCapUsd
    ),
    marketCapSol:pumpMarketCapSol(coin),
    totalSupply:pumpSupplyTokens(coin),
    pumpMarketCapRaw:finite(coin?.market_cap),
    pumpTotalSupplyRaw:finite(coin?.total_supply),
    tokenDecimals:finite(coin?.base_decimals??coin?.decimals)??6,
    quoteMint:coin?.quote_mint??coin?.quoteMint??null,
    quoteDecimals:finite(coin?.quote_decimals??coin?.quoteDecimals),
    virtualQuoteReservesRaw:
      coin?.virtual_quote_reserves??coin?.virtualQuoteReserves??null,
    realQuoteReservesRaw:
      coin?.real_quote_reserves??coin?.realQuoteReserves??null,""",
    "Pump quote metadata"
)
history.write_text(s)

# 4) Recent Pump head sync repairs missing quote metadata and blocks >20x mismatch.
s=server.read_text()
old=r"""        if(Number.isFinite(Number(token?.marketCapUsd))){
          referencePatch.pumpReportedMarketCapUsd=Number(token.marketCapUsd);
        }


        store.setToken(token.mint,referencePatch);"""
new=r"""        // MEMEFLOW_REFERENCE_REPAIR_AND_CIRCUIT_BREAKER_V16
        if(token?.quoteMint){
          referencePatch.quoteMint=String(token.quoteMint);
        }
        if(Number.isFinite(Number(token?.quoteDecimals))){
          referencePatch.quoteDecimals=Number(token.quoteDecimals);
        }
        if(Number.isFinite(Number(token?.tokenDecimals))){
          referencePatch.tokenDecimals=Number(token.tokenDecimals);
        }
        if(token?.virtualQuoteReservesRaw!=null){
          referencePatch.virtualQuoteReservesRaw=String(token.virtualQuoteReservesRaw);
        }
        if(token?.realQuoteReservesRaw!=null){
          referencePatch.realQuoteReservesRaw=String(token.realQuoteReservesRaw);
        }

        if(Number.isFinite(Number(token?.marketCapUsd))){
          const referenceMc=Number(token.marketCapUsd);
          referencePatch.pumpReportedMarketCapUsd=referenceMc;

          const localMc=Number(current?.marketCapUsd);
          if(Number.isFinite(localMc)&&localMc>0&&referenceMc>0){
            const ratio=
              Math.max(localMc,referenceMc)/
              Math.min(localMc,referenceMc);

            if(ratio>20){
              referencePatch.quotePricingReady=false;
              referencePatch.quotePricingMode='REFERENCE_MISMATCH';
              referencePatch.marketSanityRatio=ratio;
              referencePatch.priceSol=null;
              referencePatch.marketCapSol=null;
              referencePatch.marketCapUsd=referenceMc;
              referencePatch.liquiditySol=null;
              referencePatch.liquidityUsd=null;
            }
          }
        }

        store.setToken(token.mint,referencePatch);"""
s=replace_once(s,old,new,"history head-sync circuit breaker")
server.write_text(s)

# 5) UI can show trusted backend USD MC even while canonical price is blocked.
s=trading.read_text()
s=replace_once(
    s,
"""function marketCapUsdForPrice(priceUsd, candidate = state.selected) {
  const px = num(priceUsd);
  if (!(px > 0)) return null;

  const supply = tokenSupply(candidate);""",
"""function marketCapUsdForPrice(priceUsd, candidate = state.selected) {
  const px = num(priceUsd);

  // MEMEFLOW_REFERENCE_MC_DISPLAY_FALLBACK_V16
  if (!(px > 0)) {
    const storedUsd=num(candidate?.marketCapUsd??candidate?.marketCapUSD);
    return storedUsd>0?storedUsd:null;
  }

  const supply = tokenSupply(candidate);""",
    "UI market-cap fallback"
)
trading.write_text(s)

print("V16 PATCH APPLIED")
