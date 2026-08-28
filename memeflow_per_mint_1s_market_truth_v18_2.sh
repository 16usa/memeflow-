#!/usr/bin/env bash
set -Eeuo pipefail

echo "[MEMEFLOW] Per-mint 1s card truth + market-cap repair v18.2"

ROOT="${HOME}/workspace"
if [[ ! -d "$ROOT/.git" ]]; then
  ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
fi

if [[ -z "${ROOT:-}" || ! -d "$ROOT/.git" ]]; then
  echo "ERROR: Git repository not found." >&2
  exit 1
fi

cd "$ROOT"

REQUIRED_FILES=(
  "memeflow-app/app-server.mjs"
  "memeflow-app/system-tokens.js"
  "memeflow-app/system-tokens.html"
  "memeflow-app/tests/realtime-update-path.mjs"
  "memeflow-app/tests/live-market-truth.mjs"
  "memeflow-app/tests/fresh-session-scanner.mjs"
  "memeflow-app/tests/mayhem-hard-block-v17.mjs"
)

PATCH_FILES=(
  "${REQUIRED_FILES[@]}"
  "memeflow-app/src/live-card-market.mjs"
  "memeflow-app/tests/per-mint-card-refresh-v18.mjs"
)

for f in "${REQUIRED_FILES[@]}"; do
  if [[ ! -f "$f" ]]; then
    echo "ERROR: required file missing: $f" >&2
    exit 1
  fi
done

echo "[git] fetch origin/main"
git fetch origin main

TMP="$(mktemp -d /tmp/memeflow-v18-2-XXXXXX)"

cleanup() {
  code=$?
  set +e
  cd "$ROOT" 2>/dev/null || true
  git worktree remove --force "$TMP" >/dev/null 2>&1 || true
  rm -rf "$TMP" >/dev/null 2>&1 || true

  if [[ $code -ne 0 ]]; then
    echo
    echo "[FAILED] v18.2 made no commit/push."
    echo "[FAILED] existing Replit M / D / ?? files were not touched."
  fi

  exit "$code"
}
trap cleanup EXIT

echo "[worktree] clean origin/main -> $TMP"
git worktree add --detach "$TMP" origin/main >/dev/null
cd "$TMP"

python3 - <<'PY'
from pathlib import Path
import re

ROOT=Path.cwd()
APP=ROOT/"memeflow-app"

def load(rel):
    return (APP/rel).read_text()

def save(rel,text):
    p=APP/rel
    p.parent.mkdir(parents=True,exist_ok=True)
    p.write_text(text)

def replace_once(text,old,new,marker,label):
    if marker and marker in text:
        print(f"[skip] {label}: already installed")
        return text
    count=text.count(old)
    if count!=1:
        raise SystemExit(
            f"[error] {label}: expected exactly 1 source match, found {count}"
        )
    print(f"[apply] {label}")
    return text.replace(old,new,1)

def replace_between(text,start,end,replacement,marker,label):
    if marker and marker in text:
        print(f"[skip] {label}: already installed")
        return text
    i=text.find(start)
    if i<0:
        raise SystemExit(f"[error] {label}: start anchor not found")
    j=text.find(end,i+len(start))
    if j<0:
        raise SystemExit(f"[error] {label}: end anchor not found")
    print(f"[apply] {label}")
    return text[:i]+replacement+text[j:]


market_module=r"""// MEMEFLOW_LIVE_CARD_MARKET_TRUTH_V18

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

  const validRows=rows.filter(row=>{
    const t=pointTime(row);
    return t!==null&&t<=now+30000;
  });

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

  for(let i=validRows.length-1;i>=0;i--){
    const price=pointPrice(validRows[i]);
    if(price===null)continue;

    latestTradePrice=price;
    latestTradeAt=pointTime(validRows[i]);
    break;
  }

  const tokenPrice=finite(
    token?.priceSol ??
    token?.price
  );

  const tokenTradeAt=finite(
    token?.lastPriceAt ??
    token?.lastMarketActivityAt
  );

  const marketSource=lower(token?.marketSource);
  const liveMarketCapSource=lower(token?.liveMarketCapSource);

  // MEMEFLOW_NO_FAKE_CREATE_MC_V18
  const tokenHasTradeEvidence=Boolean(
    tokenPrice!==null&&
    tokenPrice>0&&
    tokenTradeAt!==null&&
    tokenTradeAt>0&&
    (
      marketSource.includes('trade') ||
      liveMarketCapSource.includes('trade') ||
      finite(token?.lastMarketActivityAt)!==null
    )
  );

  const currentPrice=
    latestTradePrice ??
    (
      tokenHasTradeEvidence
        ? tokenPrice
        : null
    );

  const supply=normalizePumpSupplyForCard(token);

  const liveMarketCapSol=
    currentPrice!==null&&
    currentPrice>0&&
    supply!==null&&
    supply>0
      ? currentPrice*supply
      : null;

  const createOnly=Boolean(
    latestTradePrice===null&&
    !tokenHasTradeEvidence&&
    (
      marketSource.includes('create') ||
      lower(token?.source).includes('createevent')
    )
  );

  let storedMarketCapSol=finite(
    token?.marketCapSol ??
    token?.marketCap
  );

  if(
    storedMarketCapSol!==null&&
    storedMarketCapSol>1_000_000&&
    (
      token?.pumpMarketCapRawLamports!=null ||
      token?.registryHistorical===true ||
      lower(token?.source).includes('history')
    )
  ){
    storedMarketCapSol/=1e9;
  }

  if(createOnly){
    storedMarketCapSol=null;
  }

  const marketCapSol=
    liveMarketCapSol ??
    storedMarketCapSol;

  const usd=finite(solUsd);

  const pumpReferenceUsd=finite(
    token?.pumpReportedMarketCapUsd
  );

  const storedLiveUsd=
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
          storedLiveUsd
        );

  const volume5mUsd=
    usd!==null&&usd>0
      ? volume5mSol*usd
      : null;

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
  }else if(marketCapSol!==null){
    marketCapSource='stored-normalized';
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
      tokenTradeAt ??
      finite(token?.marketCapUpdatedAt),
    latestTradePriceSol:latestTradePrice,
    latestTradeAt,
    currentPriceSol:currentPrice,
    tradeEvidence:Boolean(
      latestTradePrice!==null||
      tokenHasTradeEvidence
    ),
    createOnly
  };
}
"""

save("src/live-card-market.mjs",market_module)
print("[apply] pure live-card market truth module")


app=load("app-server.mjs")

import_anchor="""import {createSolUsdOracle} from './src/sol-usd-oracle.mjs'; // MEMEFLOW_OPPORTUNITY_ENGINE_V1
"""
import_new="""import {createSolUsdOracle} from './src/sol-usd-oracle.mjs'; // MEMEFLOW_OPPORTUNITY_ENGINE_V1
import {liveCardMarketSnapshot} from './src/live-card-market.mjs'; // MEMEFLOW_LIVE_CARD_MARKET_TRUTH_V18
"""

app=replace_once(
    app,
    import_anchor,
    import_new,
    "from './src/live-card-market.mjs'",
    "import V18 card-market truth"
)

market_start="function __mfCandidateMarket5mV4(mint,t){"
market_end="// MEMEFLOW_REALTIME_UI_FAIRNESS_V1"

market_fn=r"""function __mfCandidateMarket5mV4(mint,t){
  // MEMEFLOW_CARD_MARKET_TRUTH_V5
  // MEMEFLOW_LIVE_CARD_MARKET_TRUTH_V18
  const rows=chartTradeHistory.get(mint)||[];
  const solUsd=solUsdOracle.get();

  const snapshot=liveCardMarketSnapshot({
    token:t||{},
    points:rows,
    solUsd,
    now:Date.now(),
    windowMs:300000
  });

  const volume5mSol=snapshot.volume5mSol;
  const volume5mUsd=snapshot.volume5mUsd;
  const transactions5m=snapshot.transactions5m;
  const marketCapSol=snapshot.marketCapSol;
  const marketCapUsd=snapshot.marketCapUsd;
  const priceChange5mPct=snapshot.priceChange5mPct;

  return {
    volume5mSol,
    volume5mUsd,
    transactions5m,
    marketCapSol,
    marketCapUsd,
    priceChange5mPct,
    marketCapSource:snapshot.marketCapSource,
    marketUpdatedAt:snapshot.marketUpdatedAt,
    latestTradePriceSol:snapshot.latestTradePriceSol,
    latestTradeAt:snapshot.latestTradeAt,
    tradeEvidence:snapshot.tradeEvidence,
    createOnly:snapshot.createOnly
  };
}

"""

app=replace_between(
    app,
    market_start,
    market_end,
    market_fn,
    "MEMEFLOW_LIVE_CARD_MARKET_TRUTH_V18",
    "replace fake/create-baseline MC with trade-backed market truth"
)


batch_anchor=" // MEMEFLOW_SINGLE_TOKEN_LIVE_ROUTE_V14\n"

batch_route=r""" // MEMEFLOW_LIVE_CARD_BATCH_V18
 if(url.pathname==='/api/system/live-token-card-batch'&&req.method==='POST'){
  let requestBody={};

  try{
    requestBody=await body(req);
  }catch{
    return json(res,400,{error:'INVALID_JSON'});
  }

  const requested=
    Array.isArray(requestBody?.mints)
      ? requestBody.mints
      : [];

  const mints=[
    ...new Set(
      requested
        .map(mint=>String(mint||'').trim())
        .filter(Boolean)
    )
  ].slice(0,200);

  const settings=store.settings(u.id)||{};
  const openMints=__mfOpenPositionMints();
  const rows=[];

  let processed=0;

  for(const mint of mints){
    const token=store.state.tokens?.[mint]||null;
    if(!token)continue;

    const isOpen=openMints.has(mint);

    if(
      !isOpen&&
      __mfIsCurrentScannerToken(token)!==true
    ){
      continue;
    }

    let decision=null;

    try{
      decision=__mfLiveDecisionForUserV14(
        u.id,
        token,
        settings
      );
    }catch{
      decision=null;
    }

    const row=__mfLiveCardViewV14(
      token,
      decision||{
        mint,
        state:'WAITING',
        score:0,
        primaryReason:'Live data pending',
        reasons:['Live data pending']
      }
    );

    if(row){
      rows.push(row);
    }

    processed++;

    if(processed%50===0){
      await __mfYieldToEventLoop();
    }
  }

  return json(res,200,{
    rows,
    requested:mints.length,
    returned:rows.length,
    liveRevision:__mfLiveTokenRevision,
    source:'per-mint-live-card-batch-v18',
    snapshotAt:Date.now()
  });
 }

"""

if "MEMEFLOW_LIVE_CARD_BATCH_V18" not in app:
    if batch_anchor not in app:
        raise SystemExit("[error] batch route insertion anchor missing")
    app=app.replace(batch_anchor,batch_route+batch_anchor,1)
    print("[apply] exact-mint batch card endpoint")
else:
    print("[skip] exact-mint batch card endpoint")


old_open_mc="""    const _supply=_finite(_token.totalSupply);
    const _storedMcSol=_finite(_token.marketCapSol??_token.marketCap);
    const _marketCapSol=
      _latestPrice!==null&&_latestPrice>0&&_supply!==null&&_supply>0
        ? _latestPrice*_supply
        : _storedMcSol;

    const _marketCapUsd=_finite(_token.marketCapUsd);
    const _impliedSolUsd=
      _marketCapUsd!==null&&
      _marketCapUsd>0&&
      _marketCapSol!==null&&
      _marketCapSol>0
        ? _marketCapUsd/_marketCapSol
        : null;

    const _volume5mUsd=
      _impliedSolUsd!==null
        ? _volume5mSol*_impliedSolUsd
        : null;
"""

new_open_mc="""    // MEMEFLOW_OPEN_POSITION_MC_TRUTH_V18
    const _supply=__mfNormalizePumpSupplyV5(_token);

    let _cardMarket=null;
    try{
      _cardMarket=__mfCandidateMarket5mV4(
        _mint,
        _token
      );
    }catch{
      _cardMarket=null;
    }

    const _marketCapSol=
      _latestPrice!==null&&
      _latestPrice>0&&
      _supply!==null&&
      _supply>0
        ? _latestPrice*_supply
        : _finite(_cardMarket?.marketCapSol);

    const _solUsd=_finite(solUsdOracle.get());

    const _marketCapUsd=
      _marketCapSol!==null&&
      _marketCapSol>0&&
      _solUsd!==null&&
      _solUsd>0
        ? _marketCapSol*_solUsd
        : _finite(
            _cardMarket?.marketCapUsd ??
            _token.pumpReportedMarketCapUsd
          );

    const _volume5mUsd=
      _solUsd!==null&&_solUsd>0
        ? _volume5mSol*_solUsd
        : _finite(_cardMarket?.volume5mUsd);
"""

app=replace_once(
    app,
    old_open_mc,
    new_open_mc,
    "MEMEFLOW_OPEN_POSITION_MC_TRUTH_V18",
    "repair full Open Position market-cap USD"
)


paper_anchor=" // MEMEFLOW_OPEN_POSITION_MARKET_METRICS_V3\n if(url.pathname==='/api/paper/positions'&&req.method==='GET'){\n"

paper_live_route=r""" // MEMEFLOW_OPEN_POSITION_LIVE_BATCH_V18
 if(url.pathname==='/api/paper/positions/live'&&req.method==='GET'){
  const now=Date.now();

  const finite=value=>{
    if(value===null||value===undefined||value==='')return null;
    const n=Number(value);
    return Number.isFinite(n)?n:null;
  };

  const positions=
    paper
      .userPositions(u.id)
      .filter(
        position=>
          String(position?.status||'').toUpperCase()==='OPEN'&&
          position?.mint
      )
      .map(position=>{
        const mint=String(position.mint);
        const token=store.state.tokens?.[mint]||{};

        let market=null;

        try{
          market=__mfCandidateMarket5mV4(
            mint,
            token
          );
        }catch{
          market=null;
        }

        const entryPrice=finite(position.entryPriceSol);
        const tokenPrice=finite(token.priceSol);
        const tokenMarkAt=finite(
          token.lastPriceAt ??
          token.lastMarketActivityAt
        );
        const enginePrice=finite(position.currentPriceSol);

        let markPrice=null;
        let markAt=null;
        let markSource=null;

        if(
          tokenPrice!==null&&
          tokenPrice>0&&
          tokenMarkAt!==null&&
          tokenMarkAt>0
        ){
          markPrice=tokenPrice;
          markAt=tokenMarkAt;
          markSource='token-live-trade';
        }else if(
          enginePrice!==null&&
          enginePrice>0&&
          entryPrice!==null&&
          Math.abs(enginePrice-entryPrice)>
            Math.max(
              1e-18,
              Math.abs(entryPrice)*1e-12
            )
        ){
          markPrice=enginePrice;
          markAt=null;
          markSource='paper-engine-mark';
        }

        const initialSize=finite(position.initialSizeSol);
        const remainingQty=finite(position.remainingTokenQuantity);
        const realized=finite(position.realizedPnlSol)??0;

        const pnlReady=Boolean(
          markPrice!==null&&
          markPrice>0&&
          entryPrice!==null&&
          entryPrice>0&&
          initialSize!==null&&
          initialSize>0&&
          remainingQty!==null&&
          remainingQty>=0
        );

        const unrealized=
          pnlReady
            ? remainingQty*(markPrice-entryPrice)
            : null;

        const pnlPct=
          pnlReady
            ? ((realized+unrealized)/initialSize)*100
            : null;

        let ageMinutes=null;

        try{
          const age=tokenAgeMinutes(token);
          ageMinutes=
            Number.isFinite(Number(age))
              ? Number(age)
              : null;
        }catch{}

        return {
          ...position,
          currentPriceSol:
            markPrice ??
            position.currentPriceSol ??
            position.entryPriceSol ??
            null,
          tokenMetrics:{
            ageMinutes,
            holderCount:finite(token.holderCount),
            volume5mSol:finite(market?.volume5mSol),
            volume5mUsd:finite(market?.volume5mUsd),
            transactions5m:finite(market?.transactions5m),
            marketCapSol:finite(market?.marketCapSol),
            marketCapUsd:finite(market?.marketCapUsd),
            marketCapSource:market?.marketCapSource||null,
            priceChange5mPct:finite(market?.priceChange5mPct),
            pnlReady,
            pnlPct,
            pnlUnrealizedSol:unrealized,
            pnlMarkPriceSol:markPrice,
            pnlMarkAt:markAt,
            pnlMarkSource:markSource,
            windowMinutes:5,
            source:'canonical-live-token-v18',
            snapshotAt:now
          }
        };
      });

  return json(res,200,{
    positions,
    snapshotAt:now,
    source:'paper-positions-live-v18'
  });
 }

"""

if "MEMEFLOW_OPEN_POSITION_LIVE_BATCH_V18" not in app:
    if paper_anchor not in app:
        raise SystemExit("[error] paper live route insertion anchor missing")
    app=app.replace(paper_anchor,paper_live_route+paper_anchor,1)
    print("[apply] lightweight 1-second Open Position endpoint")
else:
    print("[skip] lightweight 1-second Open Position endpoint")

save("app-server.mjs",app)


ui=load("system-tokens.js")

old_position_fetch="""      const payload=
        await __mfFetchJsonV16(
          '/api/paper/positions?_='+
          Date.now()
        );
"""

new_position_fetch="""      const payload=
        await __mfFetchJsonV16(
          '/api/paper/positions/live?_='+
          Date.now(),
          {
            timeoutMs:1500
          }
        );
"""

ui=replace_once(
    ui,
    old_position_fetch,
    new_position_fetch,
    "/api/paper/positions/live?_=",
    "switch 1-second Open Position refresh to live endpoint"
)


load_start="// MEMEFLOW_ONE_SECOND_SNAPSHOT_APPLY_V17\nasync function loadTokens() {"
load_end="document\n  .querySelectorAll(\n    '.summary-card'"

load_block=r"""// MEMEFLOW_PER_MINT_BATCH_REFRESH_V18
let __mfStructureLoadingV18=false;

async function __mfPostJsonV18(
  url,
  payload,
  {
    timeoutMs=1500
  }={}
){
  const controller=new AbortController();

  const timeout=setTimeout(
    ()=>controller.abort(),
    timeoutMs
  );

  try{
    const response=await fetch(
      url,
      {
        method:'POST',
        cache:'no-store',
        credentials:'same-origin',
        headers:{
          'content-type':'application/json'
        },
        body:JSON.stringify(payload||{}),
        signal:controller.signal
      }
    );

    if(!response.ok){
      const error=new Error(
        `HTTP ${response.status}`
      );
      error.status=response.status;
      throw error;
    }

    return await response.json();
  }finally{
    clearTimeout(timeout);
  }
}

function __mfMergeMutableRowV18(previous,incoming){
  if(!previous)return incoming;
  if(!incoming)return previous;

  const out={...previous};

  const mutableTopLevel=[
    'state',
    'score',
    'confidence',
    'primaryReason',
    'reasons',
    'tradeEligible',
    'displayOnly',
    'openPositionOverride',
    'entryAdmissionState',
    'entryAdmissionReasons',
    'holderCount',
    'holders',
    'top10Pct',
    'top10',
    'developerPct',
    'developerSharePct',
    'developer',
    'buyPressure',
    'momentum',
    'price',
    'priceSol',
    'liquidity',
    'liquiditySol',
    'liquidityUsd',
    'marketCap',
    'marketCapSol',
    'marketCapUsd',
    'marketCapSource',
    'marketCapUpdatedAt',
    'ageMinutes',
    'volume5mSol',
    'volume5mUsd',
    'transactions5m',
    'priceChange5mPct',
    'qualityScore',
    'opportunityScore',
    'opportunityEvidenceReady',
    'opportunityTrendHealthy',
    'uniqueBuyers',
    'netFlowSol',
    'recentNetFlowSol',
    'priceMomentumPct',
    'drawdownFromPeakPct',
    'whaleDominancePct',
    'dead',
    'deadReason',
    'riskApproved',
    'walletRiskPending',
    'preOpenRiskStatus',
    'routeApproved',
    'quoteAgeMs',
    'tokenUpdatedAt',
    'decisionUpdatedAt',
    'snapshotAt'
  ];

  for(const key of mutableTopLevel){
    if(
      Object.prototype.hasOwnProperty.call(
        incoming,
        key
      )
    ){
      out[key]=incoming[key];
    }
  }

  out.decision={
    ...(previous?.decision||{}),
    ...(incoming?.decision||{})
  };

  out.holder={
    ...(previous?.holder||{}),
    ...(incoming?.holder||{})
  };

  out.market={
    ...(previous?.market||{}),
    ...(incoming?.market||{})
  };

  return canonicalDecisionRow(out);
}

// MEMEFLOW_ONE_SECOND_SNAPSHOT_APPLY_V17
async function __mfLoadStructureV18(){
  if(__mfStructureLoadingV18){
    return;
  }

  __mfStructureLoadingV18=true;

  try{
    const payload=
      await __mfFetchJsonV16(
        '/api/system/live-token-states?limit=200&_='+
        Date.now(),
        {
          timeoutMs:5000
        }
      );

    const rows=
      Array.isArray(payload?.decisions)
        ? payload.decisions
        : [];

    const previousByMint=new Map(
      state.rows.map(
        row=>[String(row?.mint||''),row]
      )
    );

    state.rows=
      rows
        .map(canonicalDecisionRow)
        .filter(row=>row?.mint)
        .map(row=>{
          const mint=String(row.mint||'');
          const previous=previousByMint.get(mint);

          return previous
            ? canonicalDecisionRow(
                __mfPreserveIdentityV17(
                  previous,
                  row
                )
              )
            : row;
        });

    state.feedReturned=
      Number.isFinite(Number(payload?.returned))
        ? Math.max(0,Number(payload.returned))
        : state.rows.length;

    state.feedWorkingSet=
      Number.isFinite(Number(payload?.uiWorkingSetTokens))
        ? Math.max(0,Number(payload.uiWorkingSetTokens))
        : 0;

    state.feedRawScanner=
      Number.isFinite(Number(payload?.rawScannerTokens))
        ? Math.max(0,Number(payload.rawScannerTokens))
        : 0;

    state.feedViewErrors=
      Number.isFinite(Number(payload?.viewErrors))
        ? Math.max(0,Number(payload.viewErrors))
        : 0;

    state.feedEvaluationErrors=
      Number.isFinite(Number(payload?.evaluationErrors))
        ? Math.max(0,Number(payload.evaluationErrors))
        : 0;

    // MEMEFLOW_POSITIONS_DECOUPLED_FROM_TOKEN_FEED_V15

    // MEMEFLOW_LIVE_TOKEN_TELEMETRY_V9
    const scanned=Number(payload?.rawScannerTokens);
    const admitted=Number(payload?.preAdmissionAdmitted);
    const pending=Number(payload?.preAdmissionPending);
    const rejected=Number(payload?.preAdmissionRejected);

    const statusParts=[];

    if(Number.isFinite(scanned)){
      statusParts.push(`scanner ${Math.max(0,scanned)}`);
    }

    if(Number.isFinite(admitted)){
      statusParts.push(`admitted ${Math.max(0,admitted)}`);
    }

    if(Number.isFinite(pending)&&pending>0){
      statusParts.push(`waiting ${Math.max(0,pending)}`);
    }

    if(Number.isFinite(rejected)&&rejected>0){
      statusParts.push(`blocked ${Math.max(0,rejected)}`);
    }

    render();

    if(statusParts.length){
      $('lastUpdate').textContent=
        statusParts.join(' · ');
    }
  }catch(error){
    console.warn(
      '[token-flow] structural feed refresh failed',
      error
    );
  }finally{
    __mfStructureLoadingV18=false;
  }
}

async function loadTokens(){
  if(state.loading){
    return;
  }

  if(!state.rows.length){
    await __mfLoadStructureV18();
    return;
  }

  state.loading=true;

  try{
    const mints=[
      ...new Set(
        state.rows
          .map(row=>String(row?.mint||'').trim())
          .filter(Boolean)
      )
    ].slice(0,200);

    const payload=
      await __mfPostJsonV18(
        '/api/system/live-token-card-batch',
        {mints},
        {
          timeoutMs:1500
        }
      );

    const incomingRows=
      Array.isArray(payload?.rows)
        ? payload.rows
            .map(canonicalDecisionRow)
            .filter(row=>row?.mint)
        : [];

    const incomingByMint=new Map(
      incomingRows.map(
        row=>[String(row.mint),row]
      )
    );

    state.rows=
      state.rows.map(previous=>{
        const mint=String(previous?.mint||'');
        const incoming=incomingByMint.get(mint);

        return incoming
          ? __mfMergeMutableRowV18(
              previous,
              incoming
            )
          : previous;
      });

    for(
      const card of document.querySelectorAll(
        '.flow-token[data-mint]'
      )
    ){
      const mint=String(card.dataset.mint||'');
      if(mint){
        __mfPatchMutableCardV17(mint);
      }
    }

    renderCounts();

    $('lastUpdate').textContent=
      `Updated ${
        new Date().toLocaleTimeString(
          [],
          {
            hour:'2-digit',
            minute:'2-digit',
            second:'2-digit'
          }
        )
      } · cards ${
        Number(payload?.returned||incomingRows.length)
      }/${mints.length}`;

    if(
      Number(payload?.returned||0)<mints.length
    ){
      void __mfLoadStructureV18();
    }
  }catch(error){
    console.warn(
      '[token-flow] per-mint 1s batch failed',
      error
    );

    $('lastUpdate').textContent=
      'Live card refresh retrying';
  }finally{
    state.loading=false;
    state.refreshPending=false;
  }
}

"""

ui=replace_between(
    ui,
    load_start,
    load_end,
    load_block,
    "MEMEFLOW_PER_MINT_BATCH_REFRESH_V18",
    "replace 1-second full feed rebuild with exact per-mint batch"
)


old_manual="""$('refreshButton')
  .addEventListener(
    'click',
    ()=>{
      void __mfPollOneSecondV17(true);
    }
  );
"""

new_manual="""$('refreshButton')
  .addEventListener(
    'click',
    ()=>{
      void __mfLoadStructureV18()
        .finally(
          ()=>__mfPollOneSecondV17(true)
        );
    }
  );
"""

ui=replace_once(
    ui,
    old_manual,
    new_manual,
    "=>__mfPollOneSecondV17(true)",
    "manual refresh reconciles structure then exact card truth"
)


const_anchor="""const __MF_CARD_REFRESH_MS_V17=1000;
let __mfOneSecondTimerV17=null;
"""

const_new="""const __MF_CARD_REFRESH_MS_V17=1000;
const __MF_STRUCTURE_REFRESH_MS_V18=10000;

let __mfOneSecondTimerV17=null;
let __mfStructureTimerV18=null;
"""

ui=replace_once(
    ui,
    const_anchor,
    const_new,
    "__MF_STRUCTURE_REFRESH_MS_V18",
    "add separate 10s feed-membership reconciliation"
)


initial_old="""if(typeof loadDiscoveryStatus==='function'){
  void loadDiscoveryStatus();
}

void __mfPollOneSecondV17(true);

__mfOneSecondTimerV17=
  setInterval(
    ()=>{
      void __mfPollOneSecondV17();
    },
    __MF_CARD_REFRESH_MS_V17
  );
"""

initial_new="""if(typeof loadDiscoveryStatus==='function'){
  void loadDiscoveryStatus();
}

// MEMEFLOW_PER_MINT_ONE_SECOND_CLOCK_V18
void __mfLoadStructureV18()
  .finally(
    ()=>__mfPollOneSecondV17(true)
  );

__mfOneSecondTimerV17=
  setInterval(
    ()=>{
      void __mfPollOneSecondV17();
    },
    __MF_CARD_REFRESH_MS_V17
  );

__mfStructureTimerV18=
  setInterval(
    ()=>{
      if(!document.hidden){
        void __mfLoadStructureV18();
      }
    },
    __MF_STRUCTURE_REFRESH_MS_V18
  );
"""

ui=replace_once(
    ui,
    initial_old,
    initial_new,
    "MEMEFLOW_PER_MINT_ONE_SECOND_CLOCK_V18",
    "start exact 1s batch clock after initial structure"
)


visibility_old="""document.addEventListener(
  'visibilitychange',
  ()=>{
    if(!document.hidden){
      void __mfPollOneSecondV17(true);
    }
  }
);
"""

visibility_new="""document.addEventListener(
  'visibilitychange',
  ()=>{
    if(!document.hidden){
      void __mfLoadStructureV18()
        .finally(
          ()=>__mfPollOneSecondV17(true)
        );
    }
  }
);
"""

ui=replace_once(
    ui,
    visibility_old,
    visibility_new,
    "void __mfLoadStructureV18()\n        .finally",
    "resume with structural reconciliation + immediate batch"
)


unload_old="""    if(__mfOneSecondTimerV17!==null){
      clearInterval(__mfOneSecondTimerV17);
    }
"""

unload_new="""    if(__mfOneSecondTimerV17!==null){
      clearInterval(__mfOneSecondTimerV17);
    }

    if(__mfStructureTimerV18!==null){
      clearInterval(__mfStructureTimerV18);
    }
"""

ui=replace_once(
    ui,
    unload_old,
    unload_new,
    "clearInterval(__mfStructureTimerV18)",
    "clear V18 structure timer"
)

save("system-tokens.js",ui)


html=load("system-tokens.html")

if "per-mint-batch-v18-20260827" not in html:
    html2,count=re.subn(
        r'(/system-tokens\.js\?v=)[^"\']+',
        r'\1per-mint-batch-v18-20260827',
        html,
        count=1
    )
    if count!=1:
        raise SystemExit(
            f"[error] cache-buster: expected one system-tokens.js URL, found {count}"
        )
    html=html2
    print("[apply] V18 system-tokens cache-buster")
else:
    print("[skip] V18 system-tokens cache-buster")

save("system-tokens.html",html)


rt=load("tests/realtime-update-path.mjs")

old_cache="""assert.match(tokenHtml,/system-tokens\\.js\\?v=one-second-mutable-v17-20260827/);"""
new_cache="""assert.match(tokenHtml,/system-tokens\\.js\\?v=per-mint-batch-v18-20260827/);"""

if old_cache in rt:
    rt=rt.replace(old_cache,new_cache,1)
    print("[apply] realtime cache-buster assertion -> V18")
elif new_cache in rt:
    print("[skip] realtime cache-buster assertion -> V18")
else:
    raise SystemExit("[error] V17 realtime cache-buster assertion not found")

marker="""assert.match(tokenUi,/MEMEFLOW_SYSTEM_TOKENS_ONE_SECOND_V17/);
"""

extra="""assert.match(tokenUi,/MEMEFLOW_SYSTEM_TOKENS_ONE_SECOND_V17/);
assert.match(tokenUi,/MEMEFLOW_PER_MINT_BATCH_REFRESH_V18/);
assert.match(tokenUi,/MEMEFLOW_PER_MINT_ONE_SECOND_CLOCK_V18/);
assert.match(tokenUi,/\\/api\\/system\\/live-token-card-batch/);
assert.match(tokenUi,/\\/api\\/paper\\/positions\\/live/);
"""

if "MEMEFLOW_PER_MINT_BATCH_REFRESH_V18" not in rt:
    if marker not in rt:
        raise SystemExit("[error] V18 realtime assertion anchor missing")
    rt=rt.replace(marker,extra,1)
    print("[apply] V18 realtime per-mint assertions")

save("tests/realtime-update-path.mjs",rt)


market_test=load("tests/live-market-truth.mjs")

market_assert_anchor="""assert.match(market,/solUsdOracle\\.get\\(\\)/);
"""

market_assert_new="""assert.match(market,/solUsdOracle\\.get\\(\\)/);
assert.match(app,/MEMEFLOW_LIVE_CARD_MARKET_TRUTH_V18/);
assert.match(app,/MEMEFLOW_OPEN_POSITION_MC_TRUTH_V18/);
assert.match(app,/MEMEFLOW_OPEN_POSITION_LIVE_BATCH_V18/);
"""

if "MEMEFLOW_OPEN_POSITION_MC_TRUTH_V18" not in market_test:
    if market_assert_anchor not in market_test:
        raise SystemExit("[error] live-market-truth assertion anchor missing")
    market_test=market_test.replace(
        market_assert_anchor,
        market_assert_new,
        1
    )
    print("[apply] V18 market-truth compatibility assertions")

save("tests/live-market-truth.mjs",market_test)


v18_test=r"""import assert from 'node:assert/strict';
import fs from 'node:fs';

import {
  liveCardMarketSnapshot,
  normalizePumpSupplyForCard
} from '../src/live-card-market.mjs';

const app=fs.readFileSync(
  new URL('../app-server.mjs',import.meta.url),
  'utf8'
);

const ui=fs.readFileSync(
  new URL('../system-tokens.js',import.meta.url),
  'utf8'
);

const html=fs.readFileSync(
  new URL('../system-tokens.html',import.meta.url),
  'utf8'
);

assert.equal(
  normalizePumpSupplyForCard({
    launchPlatform:'pump'
  }),
  1_000_000_000
);

const createOnly=liveCardMarketSnapshot({
  token:{
    launchPlatform:'pump',
    marketSource:'pump-create-event-ws',
    source:'Pump CreateEvent WS',
    priceSol:0.0000335,
    marketCapSol:33500,
    totalSupply:1_000_000_000
  },
  points:[],
  solUsd:100,
  now:1_000_000
});

assert.equal(createOnly.createOnly,true);
assert.equal(createOnly.tradeEvidence,false);
assert.equal(createOnly.marketCapSol,null);
assert.equal(createOnly.marketCapUsd,null);

const traded=liveCardMarketSnapshot({
  token:{
    launchPlatform:'pump',
    totalSupply:1_000_000_000
  },
  points:[
    {
      t:999_000,
      price:0.000002,
      solAmount:1
    },
    {
      t:999_500,
      price:0.0000025,
      solAmount:2
    }
  ],
  solUsd:100,
  now:1_000_000
});

assert.equal(traded.tradeEvidence,true);
assert.equal(traded.marketCapSol,2500);
assert.equal(traded.marketCapUsd,250000);
assert.equal(traded.transactions5m,2);
assert.equal(traded.volume5mSol,3);
assert.ok(
  Math.abs(traded.priceChange5mPct-25)<1e-9,
  `expected ~25%, got ${traded.priceChange5mPct}`
);

const referenced=liveCardMarketSnapshot({
  token:{
    launchPlatform:'pump',
    marketSource:'pump-create-event-ws',
    pumpReportedMarketCapUsd:12345
  },
  points:[],
  solUsd:null,
  now:1_000_000
});

assert.equal(referenced.marketCapUsd,12345);
assert.equal(referenced.marketCapSource,'pump-reference');

assert.match(app,/MEMEFLOW_LIVE_CARD_BATCH_V18/);
assert.match(app,/\/api\/system\/live-token-card-batch/);
assert.match(app,/MEMEFLOW_OPEN_POSITION_LIVE_BATCH_V18/);
assert.match(app,/\/api\/paper\/positions\/live/);
assert.match(app,/MEMEFLOW_OPEN_POSITION_MC_TRUTH_V18/);
assert.match(app,/liveCardMarketSnapshot/);

assert.match(ui,/MEMEFLOW_PER_MINT_BATCH_REFRESH_V18/);
assert.match(ui,/MEMEFLOW_PER_MINT_ONE_SECOND_CLOCK_V18/);
assert.match(ui,/const __MF_CARD_REFRESH_MS_V17=1000/);
assert.match(ui,/\/api\/system\/live-token-card-batch/);
assert.match(ui,/\/api\/paper\/positions\/live/);
assert.match(ui,/__mfMergeMutableRowV18/);

const merge=ui.slice(
  ui.indexOf('function __mfMergeMutableRowV18('),
  ui.indexOf('// MEMEFLOW_ONE_SECOND_SNAPSHOT_APPLY_V17')
);

assert.doesNotMatch(merge,/'name'/);
assert.doesNotMatch(merge,/'image'/);
assert.doesNotMatch(merge,/'imageUrl'/);
assert.doesNotMatch(merge,/'logoUrl'/);
assert.doesNotMatch(merge,/'uri'/);

const mutablePatch=ui.slice(
  ui.indexOf('function __mfPatchMutableCardV17('),
  ui.indexOf('async function __mfPollOneSecondV17(')
);

// V18.2: comments may mention static selectors. What is forbidden is an
// executable DOM lookup/write inside the one-second mutable patch.
assert.doesNotMatch(
  mutablePatch,
  /querySelector(?:All)?\(\s*['"]\.token-name/
);
assert.doesNotMatch(
  mutablePatch,
  /querySelector(?:All)?\(\s*['"]\.token-avatar/
);
assert.doesNotMatch(
  mutablePatch,
  /querySelector(?:All)?\(\s*['"]\.token-pump-link/
);
assert.doesNotMatch(
  mutablePatch,
  /\.src\s*=/
);
assert.doesNotMatch(
  mutablePatch,
  /\.href\s*=/
);

assert.match(
  html,
  /system-tokens\.js\?v=per-mint-batch-v18-20260827/
);

console.log('per-mint card refresh v18 ok');
"""

save("tests/per-mint-card-refresh-v18.mjs",v18_test)
print("[apply] dedicated V18 market/per-mint behavioral regression")


app=load("app-server.mjs")
ui=load("system-tokens.js")
html=load("system-tokens.html")
market_module=load("src/live-card-market.mjs")

for needle in [
    "MEMEFLOW_MAYHEM_HARD_BLOCK_V17",
    "MEMEFLOW_MAYHEM_DIRECT_CREATE_DROP_V17",
    "MEMEFLOW_LIVE_CARD_MARKET_TRUTH_V18",
    "MEMEFLOW_LIVE_CARD_BATCH_V18",
    "MEMEFLOW_OPEN_POSITION_MC_TRUTH_V18",
    "MEMEFLOW_OPEN_POSITION_LIVE_BATCH_V18",
]:
    if needle not in app:
        raise SystemExit(f"[verify] backend invariant missing: {needle}")

for needle in [
    "MEMEFLOW_NO_FAKE_CREATE_MC_V18",
    "tokenHasTradeEvidence",
    "pumpReportedMarketCapUsd",
    "latestTradePrice",
]:
    if needle not in market_module:
        raise SystemExit(f"[verify] market module invariant missing: {needle}")

for needle in [
    "MEMEFLOW_PER_MINT_BATCH_REFRESH_V18",
    "MEMEFLOW_PER_MINT_ONE_SECOND_CLOCK_V18",
    "__MF_CARD_REFRESH_MS_V17=1000",
    "/api/system/live-token-card-batch",
    "/api/paper/positions/live",
    "__mfMergeMutableRowV18",
    "MEMEFLOW_STATIC_TOKEN_IDENTITY_V16",
    "MEMEFLOW_NO_METADATA_POLLING_V16",
    "MEMEFLOW_NO_TOKEN_MEDIA_POLLING_V16",
    "MEMEFLOW_LIVE_TOKEN_TELEMETRY_V9",
    "MEMEFLOW_SCANNER_STATUS_V9",
]:
    if needle not in ui:
        raise SystemExit(f"[verify] frontend invariant missing: {needle}")

merge_i=ui.find("function __mfMergeMutableRowV18(")
merge_j=ui.find("// MEMEFLOW_ONE_SECOND_SNAPSHOT_APPLY_V17",merge_i)
merge=ui[merge_i:merge_j]

for forbidden in [
    "'name'",
    "'metadataName'",
    "'symbol'",
    "'image'",
    "'imageUrl'",
    "'logoUrl'",
    "'uri'",
    "'metadataUri'",
]:
    if forbidden in merge:
        raise SystemExit(
            f"[verify] static field leaked into one-second merge list: {forbidden}"
        )

if "per-mint-batch-v18-20260827" not in html:
    raise SystemExit("[verify] V18 cache-buster missing")

print("[verify] V17 Mayhem + V18 per-mint/MC/static-identity invariants OK")
PY

cd "$TMP/memeflow-app"

echo "[check] syntax"
node --check app-server.mjs
node --check system-tokens.js
node --check src/live-card-market.mjs
node --check tests/per-mint-card-refresh-v18.mjs
node --check tests/realtime-update-path.mjs
node --check tests/live-market-truth.mjs
node --check tests/fresh-session-scanner.mjs
node --check tests/mayhem-hard-block-v17.mjs

echo "[check] V18.2 static-identity assertion sanity"
node - <<'NODE'
const fs=require('fs');
const ui=fs.readFileSync('system-tokens.js','utf8');
const start=ui.indexOf('function __mfPatchMutableCardV17(');
const end=ui.indexOf('async function __mfPollOneSecondV17(',start);
if(start<0||end<0)throw new Error('mutable patch function not found');
const block=ui.slice(start,end);

// Comments containing ".token-name" are allowed. Executable DOM access is not.
for(const re of [
  /querySelector(?:All)?\(\s*['"]\.token-name/,
  /querySelector(?:All)?\(\s*['"]\.token-avatar/,
  /querySelector(?:All)?\(\s*['"]\.token-pump-link/,
  /\.src\s*=/,
  /\.href\s*=/
]){
  if(re.test(block))throw new Error('static identity mutation found: '+re);
}
console.log('V18.2 static identity executable-access guard ok');
NODE

echo "[check] exact V18 regression FIRST"
node tests/per-mint-card-refresh-v18.mjs

echo "[check] related regressions"
node tests/realtime-update-path.mjs
node tests/live-market-truth.mjs
node tests/fresh-session-scanner.mjs
node tests/mayhem-hard-block-v17.mjs
node tests/feed-ranking.mjs
node tests/ws-first-preopen-rpc.mjs
node tests/strict-entry-admission.mjs

echo "[check] FULL npm test"
npm test

echo "[check] benchmark"
npm run benchmark

cd "$TMP"

echo "[check] diff"
git diff --check
git diff --stat -- "${PATCH_FILES[@]}"

git add -- "${PATCH_FILES[@]}"

if git diff --cached --quiet; then
  echo "[git] v18 is already present on origin/main"
  NEW_SHA="$(git rev-parse HEAD)"
else
  git commit -m "fix: refresh each card by mint and remove fake market caps"
  NEW_SHA="$(git rev-parse HEAD)"

  echo "[git] push verified commit -> main"
  git push origin HEAD:main
fi

echo "[git] verified commit: $NEW_SHA"

cd "$ROOT"

BACKUP_DIR="$ROOT/.memeflow-v18-recovery-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR"

for f in "${REQUIRED_FILES[@]}"; do
  if [[ -f "$f" ]]; then
    mkdir -p "$BACKUP_DIR/$(dirname "$f")"
    cp -p "$f" "$BACKUP_DIR/$f"
  fi
done

LOCAL_HEAD="$(git rev-parse HEAD)"

git restore --staged --worktree -- "${REQUIRED_FILES[@]}" 2>/dev/null || true

if git merge-base --is-ancestor "$LOCAL_HEAD" "$NEW_SHA" 2>/dev/null; then
  if git merge --ff-only "$NEW_SHA"; then
    echo "[local] workspace fast-forwarded to verified v18"
  else
    echo "[local] fast-forward blocked; syncing only v18 files"
    git restore --source="$NEW_SHA" --worktree -- "${PATCH_FILES[@]}"
  fi
else
  echo "[local] local branch is not a clean ancestor; syncing only v18 files"
  git restore --source="$NEW_SHA" --worktree -- "${PATCH_FILES[@]}"
fi

echo "[local] recovery backup: $BACKUP_DIR"

echo
echo "DONE"
echo "- every existing card mint gets its own canonical snapshot every 1 second"
echo "- the 1-second path no longer rebuilds/ranks the ~800-token working set"
echo "- OPEN POSITION uses a lightweight live endpoint every 1 second"
echo "- name/avatar/Pump.fun static identity is never copied by the 1-second merge"
echo "- CreateEvent-only baseline MC is no longer shown as fake live MC"
echo "- MC uses real TradeEvent price x normalized supply x current SOL/USD"
echo "- Pump reference MC is used only as an explicit fallback"
echo "- V17 Mayhem hard-block remains intact"
echo "- full npm test AND benchmark passed before push"
echo
echo "IMPORTANT: app-server.mjs changed. After DONE do one Replit Stop -> Run,"
echo "then refresh the browser page once."
