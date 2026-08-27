// MEMEFLOW_LIVE_CARD_MARKET_TRUTH_V18
// MEMEFLOW_LIVE_CARD_MARKET_TRUTH_V19
//
// Live-card MC policy:
//   real TradeEvent price x normalized supply x current SOL/USD
// OR explicit Pump reference USD as a labeled fallback.
// Historical/stored marketCapSol/marketCapUsd are NEVER treated as live truth.

const finite=value=>{
  if(value===null||value===undefined||value==='')return null;
  const n=Number(value);
  return Number.isFinite(n)?n:null;
};

const lower=value=>String(value??'').trim().toLowerCase();

export function normalizePumpSupplyForCard(token={}){
  const direct=finite(token?.totalSupply);

  if(direct!==null&&direct>0){
    return direct>1e12
      ? direct/1e6
      : direct;
  }

  const raw=finite(
    token?.tokenTotalSupplyRaw ??
    token?.pumpTotalSupplyRaw
  );

  if(raw!==null&&raw>0){
    const decimals=Math.max(
      0,
      Math.min(
        12,
        Math.floor(
          finite(token?.tokenDecimals??token?.decimals) ?? 6
        )
      )
    );

    return raw/(10**decimals);
  }

  const pump=lower(
    token?.launchPlatform ??
    token?.protocol ??
    token?.source
  );

  return pump.includes('pump')
    ? 1_000_000_000
    : null;
}

function pointPrice(point){
  const p=finite(
    point?.priceSol ??
    point?.price
  );

  return p!==null&&p>0
    ? p
    : null;
}

function pointTime(point){
  const t=finite(point?.t);
  return t!==null&&t>0?t:null;
}

export function liveCardMarketSnapshot({
  token={},
  points=[],
  solUsd=null,
  now=Date.now(),
  windowMs=300000
}={}){
  const rows=Array.isArray(points)?points:[];
  const cutoff=now-windowMs;

  const validRows=rows
    .filter(row=>{
      const t=pointTime(row);
      return t!==null&&t<=now+30000;
    })
    .sort(
      (a,b)=>
        Number(a?.t||0)-
        Number(b?.t||0)
    );

  const recent=validRows.filter(
    row=>Number(row.t)>=cutoff
  );

  const volume5mSol=recent.reduce(
    (sum,row)=>
      sum+Math.abs(
        finite(row?.solAmount) ?? 0
      ),
    0
  );

  const transactions5m=recent.length;

  let latestTradePrice=null;
  let latestTradeAt=null;

  for(let index=validRows.length-1;index>=0;index--){
    const price=pointPrice(validRows[index]);
    if(price===null)continue;

    latestTradePrice=price;
    latestTradeAt=pointTime(validRows[index]);
    break;
  }

  const tokenPrice=finite(
    token?.priceSol ??
    token?.price
  );

  const tokenTradeAt=finite(
    token?.lastPriceAt ??
    token?.lastMarketActivityAt ??
    token?.marketCapUpdatedAt ??
    token?.lastTradeAt
  );

  const marketSource=lower(token?.marketSource);
  const liveMarketCapSource=lower(token?.liveMarketCapSource);

  const explicitTradeEvidence=Boolean(
    marketSource.includes('trade') ||
    liveMarketCapSource.includes('trade') ||
    (
      token?.eventSignature &&
      !marketSource.includes('create')
    ) ||
    token?.copyTradingDiscovered===true
  );

  const tokenTradeAgeMs=
    tokenTradeAt!==null&&tokenTradeAt>0
      ? Math.max(0,now-tokenTradeAt)
      : Number.POSITIVE_INFINITY;

  const tokenHasTradeEvidence=Boolean(
    tokenPrice!==null&&
    tokenPrice>0&&
    tokenTradeAt!==null&&
    tokenTradeAt>0&&
    tokenTradeAgeMs<=windowMs&&
    explicitTradeEvidence
  );

  const currentPrice=
    latestTradePrice ??
    (
      tokenHasTradeEvidence
        ? tokenPrice
        : null
    );

  const supply=normalizePumpSupplyForCard(token);

  // MEMEFLOW_NO_STORED_MC_FALLBACK_V19
  // No real trade price = no live SOL market cap.
  const marketCapSol=
    currentPrice!==null&&
    currentPrice>0&&
    supply!==null&&
    supply>0
      ? currentPrice*supply
      : null;

  const usd=finite(solUsd);

  const pumpReferenceAt=finite(token?.pumpReferenceAt);
  const pumpReferenceFresh=Boolean(
    pumpReferenceAt!==null&&
    pumpReferenceAt>0&&
    Math.max(0,now-pumpReferenceAt)<=Math.min(windowMs,90_000)
  );

  const pumpReferenceUsd=
    pumpReferenceFresh
      ? finite(token?.pumpReportedMarketCapUsd)
      : null;

  const storedTradeUsd=
    tokenHasTradeEvidence
      ? finite(token?.marketCapUsd)
      : null;

  const marketCapUsd=
    marketCapSol!==null&&
    marketCapSol>0&&
    usd!==null&&
    usd>0
      ? marketCapSol*usd
      : (
          pumpReferenceUsd ??
          storedTradeUsd
        );

  const volume5mUsd=
    usd!==null&&usd>0
      ? volume5mSol*usd
      : (
          tokenHasTradeEvidence
            ? finite(token?.volume5mUsd)
            : null
        );

  const pricedRecent=recent
    .map(row=>({
      price:pointPrice(row),
      t:pointTime(row)
    }))
    .filter(row=>row.price!==null);

  let priceChange5mPct=null;

  if(pricedRecent.length>=2){
    const first=pricedRecent[0].price;
    const last=pricedRecent[pricedRecent.length-1].price;

    if(first>0){
      priceChange5mPct=
        ((last-first)/first)*100;
    }
  }

  let marketCapSource=null;

  if(latestTradePrice!==null){
    marketCapSource='chart-trade-event';
  }else if(tokenHasTradeEvidence){
    marketCapSource='token-live-trade';
  }else if(pumpReferenceUsd!==null){
    marketCapSource='pump-reference';
  }

  return {
    volume5mSol,
    volume5mUsd,
    transactions5m,
    marketCapSol,
    marketCapUsd,
    priceChange5mPct,
    marketCapSource,
    marketUpdatedAt:
      latestTradeAt ??
      (
        tokenHasTradeEvidence
          ? tokenTradeAt
          : finite(token?.pumpReferenceAt)
      ),
    latestTradePriceSol:latestTradePrice,
    latestTradeAt,
    currentPriceSol:currentPrice,
    tradeEvidence:Boolean(
      latestTradePrice!==null ||
      tokenHasTradeEvidence
    ),
    createOnly:!Boolean(
      latestTradePrice!==null ||
      tokenHasTradeEvidence
    )
  };
}


// MEMEFLOW_OPEN_POSITION_LIVE_MC_V20
// OPEN POSITION market cap must come from the same confirmed live trade mark
// used to value the position. Stored or Pump-reference MC is never accepted.
export function openPositionLiveMarketCap({
  token={},
  markPriceSol=null,
  markSource=null,
  solUsd=null
}={}){
  const price=finite(markPriceSol);
  const usd=finite(solUsd);
  const source=lower(markSource);

  const trustedTradeSource=Boolean(
    source.includes('trade')
  );

  const supply=normalizePumpSupplyForCard(token);

  const marketCapSol=
    trustedTradeSource&&
    price!==null&&
    price>0&&
    supply!==null&&
    supply>0
      ? price*supply
      : null;

  const marketCapUsd=
    marketCapSol!==null&&
    marketCapSol>0&&
    usd!==null&&
    usd>0
      ? marketCapSol*usd
      : null;

  return {
    marketCapSol,
    marketCapUsd,
    marketCapSource:
      marketCapUsd!==null
        ? (
            source.includes('chart')
              ? 'chart-trade-event-price-x-supply'
              : 'token-live-trade-price-x-supply'
          )
        : null,
    trustedTradeSource
  };
}
