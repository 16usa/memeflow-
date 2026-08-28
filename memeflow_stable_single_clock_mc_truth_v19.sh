#!/usr/bin/env bash
set -Eeuo pipefail

echo "[MEMEFLOW] Stable one-clock live cards + MC truth v19"

ROOT="${HOME}/workspace"
if [[ ! -d "$ROOT/.git" ]]; then
  ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
fi

if [[ -z "${ROOT:-}" || ! -d "$ROOT/.git" ]]; then
  echo "ERROR: Git repository not found." >&2
  exit 1
fi

cd "$ROOT"

FILES=(
  "memeflow-app/app-server.mjs"
  "memeflow-app/src/live-card-market.mjs"
  "memeflow-app/system-tokens.js"
  "memeflow-app/system-tokens.html"
  "memeflow-app/tests/realtime-update-path.mjs"
  "memeflow-app/tests/live-market-truth.mjs"
  "memeflow-app/tests/per-mint-card-refresh-v18.mjs"
)

NEW_TEST="memeflow-app/tests/live-card-clock-v19.mjs"

for f in "${FILES[@]}"; do
  if [[ ! -f "$f" ]]; then
    echo "ERROR: required file missing: $f" >&2
    exit 1
  fi
done

echo "[git] fetch origin/main"
git fetch origin main

TMP="$(mktemp -d /tmp/memeflow-v19-XXXXXX)"

cleanup() {
  code=$?
  set +e
  cd "$ROOT" 2>/dev/null || true
  git worktree remove --force "$TMP" >/dev/null 2>&1 || true
  rm -rf "$TMP" >/dev/null 2>&1 || true

  if [[ $code -ne 0 ]]; then
    echo
    echo "[FAILED] v19 made no commit/push."
    echo "[FAILED] existing Replit M / D / ?? files were not touched."
  fi

  exit "$code"
}
trap cleanup EXIT

git worktree add --detach "$TMP" origin/main >/dev/null
cd "$TMP"

python3 - <<'PY'
from pathlib import Path
import re

APP=Path.cwd()/"memeflow-app"

def load(rel):
    return (APP/rel).read_text()

def save(rel,text):
    p=APP/rel
    p.parent.mkdir(parents=True,exist_ok=True)
    p.write_text(text)

def between(text,start,end,label):
    i=text.find(start)
    if i<0:
        raise SystemExit(f"[error] {label}: start anchor missing")
    j=text.find(end,i+len(start))
    if j<0:
        raise SystemExit(f"[error] {label}: end anchor missing")
    return i,j,text[i:j]

# ===========================================================================
# 1) BACKEND MARKET CAP TRUTH
# ===========================================================================
app=load("app-server.mjs")

start="function __mfCandidateMarket5mV4(mint,t){"
end="// MEMEFLOW_REALTIME_UI_FAIRNESS_V1"
i,j,current=between(app,start,end,"candidate market function")

if "MEMEFLOW_LIVE_CARD_MARKET_TRUTH_V19" not in current:
    replacement=r"""function __mfCandidateMarket5mV4(mint,t){
  // MEMEFLOW_CARD_MARKET_TRUTH_V5
  // MEMEFLOW_LIVE_CARD_MARKET_TRUTH_V19
  // IMPORTANT: this function MUST delegate to the tested V19 truth module.
  // Do not independently fall back to stored marketCapSol/marketCapUsd here.
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
    tradeEvidence:snapshot.tradeEvidence
  };
}

"""
    app=app[:i]+replacement+app[j:]
    print("[apply] candidate market function now uses V19 truth module")
else:
    print("[skip] candidate market function already V19")

save("app-server.mjs",app)


# Replace the pure market helper as one atomic unit.
market=r"""// MEMEFLOW_LIVE_CARD_MARKET_TRUTH_V18
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
    token?.lastMarketActivityAt
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

  const tokenHasTradeEvidence=Boolean(
    tokenPrice!==null&&
    tokenPrice>0&&
    tokenTradeAt!==null&&
    tokenTradeAt>0&&
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

  const pumpReferenceUsd=finite(
    token?.pumpReportedMarketCapUsd
  );

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
"""

save("src/live-card-market.mjs",market)
print("[apply] remove stale stored MC fallback completely")


# ===========================================================================
# 2) FRONTEND: ONE AUTOMATIC MUTABLE CLOCK, NO REPLAY/BURST
# ===========================================================================
ui=load("system-tokens.js")

# Market-cap source must be explicit/trusted in the UI too.
old=r"""function openMarketCapLabel(metrics) {
  if (finite(metrics?.marketCapUsd)) {
    return `$${compactMetricNumber(metrics.marketCapUsd, 1)}`;
  }

  if (finite(metrics?.marketCapSol)) {
    return `${compactMetricNumber(metrics.marketCapSol, 1)} SOL`;
  }

  return '—';
}"""

new=r"""// MEMEFLOW_TRUSTED_MC_SOURCE_V19
function trustedMarketCapSource(metrics) {
  const source=
    String(metrics?.marketCapSource||'')
      .trim()
      .toLowerCase();

  return (
    source.includes('trade') ||
    source==='pump-reference'
  );
}

function openMarketCapLabel(metrics) {
  if (!trustedMarketCapSource(metrics)) {
    return '—';
  }

  if (finite(metrics?.marketCapUsd)) {
    return `$${compactMetricNumber(metrics.marketCapUsd, 1)}`;
  }

  if (finite(metrics?.marketCapSol)) {
    return `${compactMetricNumber(metrics.marketCapSol, 1)} SOL`;
  }

  return '—';
}"""

if "MEMEFLOW_TRUSTED_MC_SOURCE_V19" not in ui:
    if old not in ui:
        raise SystemExit("[error] openMarketCapLabel anchor mismatch")
    ui=ui.replace(old,new,1)
    print("[apply] UI hides untrusted/stale Open Position MC")


old=r"""function regularMarketMetrics(row) {
  return {
    ageMinutes:
      tokenAge(row),
    holderCount:
      holderCount(row),
    volume5mSol:
      row?.market?.volume5mSol ??
      row?.volume5mSol ??
      null,
    volume5mUsd:
      row?.market?.volume5mUsd ??
      row?.volume5mUsd ??
      null,
    transactions5m:
      row?.market?.transactions5m ??
      row?.transactions5m ??
      null,
    marketCapSol:
      row?.market?.marketCapSol ??
      row?.marketCapSol ??
      row?.marketCap ??
      null,
    marketCapUsd:
      row?.market?.marketCapUsd ??
      row?.marketCapUsd ??
      null,
    priceChange5mPct:
      row?.market?.priceChange5mPct ??
      row?.priceChange5mPct ??
      null
  };
}

function regularVolumeLabel(metrics) {"""

new=r"""function regularMarketMetrics(row) {
  return {
    ageMinutes:
      tokenAge(row),
    holderCount:
      holderCount(row),
    volume5mSol:
      row?.market?.volume5mSol ??
      row?.volume5mSol ??
      null,
    volume5mUsd:
      row?.market?.volume5mUsd ??
      row?.volume5mUsd ??
      null,
    transactions5m:
      row?.market?.transactions5m ??
      row?.transactions5m ??
      null,
    marketCapSol:
      row?.market?.marketCapSol ??
      row?.marketCapSol ??
      row?.marketCap ??
      null,
    marketCapUsd:
      row?.market?.marketCapUsd ??
      row?.marketCapUsd ??
      null,
    marketCapSource:
      row?.market?.marketCapSource ??
      row?.marketCapSource ??
      null,
    priceChange5mPct:
      row?.market?.priceChange5mPct ??
      row?.priceChange5mPct ??
      null
  };
}

function regularVolumeLabel(metrics) {"""

if old not in ui:
    raise SystemExit("[error] regularMarketMetrics anchor mismatch")
ui=ui.replace(old,new,1)


old=r"""function regularMarketCapLabel(metrics) {
  if (finite(metrics?.marketCapUsd)) {
    return `$${compactMetricNumber(metrics.marketCapUsd, 1)}`;
  }

  if (finite(metrics?.marketCapSol)) {
    return `${compactMetricNumber(metrics.marketCapSol, 1)} SOL`;
  }

  return '—';
}"""

new=r"""function regularMarketCapLabel(metrics) {
  if (!trustedMarketCapSource(metrics)) {
    return '—';
  }

  if (finite(metrics?.marketCapUsd)) {
    return `$${compactMetricNumber(metrics.marketCapUsd, 1)}`;
  }

  if (finite(metrics?.marketCapSol)) {
    return `${compactMetricNumber(metrics.marketCapSol, 1)} SOL`;
  }

  return '—';
}"""

if old not in ui:
    raise SystemExit("[error] regularMarketCapLabel anchor mismatch")
ui=ui.replace(old,new,1)
print("[apply] regular cards also reject untrusted stale MC")


# Open positions: one request per clock tick, never pending replay.
start="// MEMEFLOW_OPEN_POSITION_EVENT_FACT_V16"
end="// MEMEFLOW_PER_MINT_BATCH_REFRESH_V18"
i,j,current=between(ui,start,end,"Open Position refresher")

replacement=r"""// MEMEFLOW_OPEN_POSITION_EVENT_FACT_V16
// MEMEFLOW_OPEN_POSITION_SINGLE_FLIGHT_V19
let __mfPositionRequestActiveV16=false;

async function __mfRefreshOpenPositionsV16({
  patchDom=true
}={}){
  if(__mfPositionRequestActiveV16){
    return;
  }

  __mfPositionRequestActiveV16=true;

  try{
    const beforeOpen=new Set(
      state.positions
        .filter(
          position=>
            String(position?.status||'').toUpperCase()==='OPEN'
        )
        .map(position=>String(position?.mint||''))
        .filter(Boolean)
    );

    const payload=
      await __mfFetchJsonV16(
        '/api/paper/positions/live?_='+
        Date.now(),
        {
          timeoutMs:900
        }
      );

    state.positions=
      (
        Array.isArray(payload?.positions)
          ? payload.positions
          : []
      ).filter(
        position=>
          position?.mint &&
          String(position?.status||'').toUpperCase()==='OPEN'
      );

    const afterOpen=new Set(
      state.positions
        .map(position=>String(position?.mint||''))
        .filter(Boolean)
    );

    const membershipChanged=
      beforeOpen.size!==afterOpen.size ||
      [...beforeOpen].some(
        mint=>!afterOpen.has(mint)
      );

    if(membershipChanged){
      __mfReconcileVisibleCardsV183();
    }

    if(patchDom){
      for(const mint of afterOpen){
        __mfPatchMutableCardV17(mint);
      }
    }
  }catch(error){
    console.warn(
      '[token-flow] open-position live refresh failed',
      error
    );
  }finally{
    __mfPositionRequestActiveV16=false;
  }
}


"""

ui=ui[:i]+replacement+ui[j:]
print("[apply] remove Open Position pending/replay burst loop")


# Exact mounted-card mints only. Open cards are handled by the Open Position
# endpoint, so a card gets ONE automatic data writer per tick.
old=r"""    const mints=[
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
      );"""

new=r"""    // MEMEFLOW_VISIBLE_MINTS_ONLY_V19
    // Refresh only cards actually mounted on the current page (normally 20).
    // OPEN POSITION cards use /api/paper/positions/live instead, so no card
    // has two automatic mutable-data writers in the same clock tick.
    const openMints=new Set(
      state.positions
        .filter(
          position=>
            String(position?.status||'').toUpperCase()==='OPEN'
        )
        .map(position=>String(position?.mint||''))
        .filter(Boolean)
    );

    const mints=[
      ...new Set(
        [...document.querySelectorAll(
          '.flow-token[data-mint]'
        )]
          .map(
            card=>
              String(card.dataset.mint||'').trim()
          )
          .filter(
            mint=>
              mint &&
              !openMints.has(mint)
          )
      )
    ].slice(0,PAGE_SIZE);

    if(!mints.length){
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
        }`;
      return;
    }

    const payload=
      await __mfPostJsonV18(
        '/api/system/live-token-card-batch',
        {mints},
        {
          timeoutMs:900
        }
      );"""

if old not in ui:
    raise SystemExit("[error] V18 all-200 mint batch anchor mismatch")
ui=ui.replace(old,new,1)
print("[apply] 1-second batch reduced from up to 200 rows to mounted regular cards")


# The 10s structure reconciler must NEVER patch mutable values on existing cards.
old=r"""  // append() MOVES an existing node. It does not recreate it.
  for(const card of ordered){
    list.append(card);

    const mint=String(
      card.dataset.mint||''
    );

    if(mint){
      __mfPatchMutableCardV17(mint);
    }
  }
}"""

new=r"""  // MEMEFLOW_STRUCTURE_MEMBERSHIP_ONLY_V19
  // append() MOVES an existing node. It does not recreate it.
  // Crucially: structure reconciliation never patches mutable market values.
  // The single V19 one-second clock is the ONLY automatic mutable-data writer.
  for(const card of ordered){
    list.append(card);
  }
}"""

if old not in ui:
    raise SystemExit("[error] keyed structure mutable-patch anchor mismatch")
ui=ui.replace(old,new,1)
print("[apply] remove second automatic mutable writer from 10s structure sync")


# Replace timer declarations.
old=r"""let __mfOneSecondTimerV17=null;
let __mfStructureTimerV18=null;"""

new=r"""let __mfOneSecondTimerV17=null;
let __mfStructureTimerV18=null;

// MEMEFLOW_SINGLE_CARD_CLOCK_V19
let __mfCardClockRunningV19=false;
let __mfCardClockKickPendingV19=false;
let __mfCardClockNextAtV19=0;"""

if old not in ui:
    raise SystemExit("[error] clock declaration anchor mismatch")
ui=ui.replace(old,new,1)


# Keep __mfPollOneSecondV17 as the atomic tick; replace its misleading comment.
old=r"""async function __mfPollOneSecondV17(force=false){
  if(document.hidden&&!force){
    return;
  }

  // Exactly two bounded requests per tick:
  // 1) one ranked token-feed snapshot;
  // 2) one Open Position snapshot.
  // Both have their own in-flight guards and request timeouts.
  await Promise.allSettled([
    loadTokens(),
    __mfRefreshOpenPositionsV16()
  ]);
}

if(typeof loadDiscoveryStatus==='function'){
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

document.addEventListener(
  'visibilitychange',
  ()=>{
    if(!document.hidden){
      void __mfPollOneSecondV17(true);
    }
  }
);

window.addEventListener(
  'beforeunload',
  ()=>{
    if(__mfOneSecondTimerV17!==null){
      clearInterval(__mfOneSecondTimerV17);
    }

    if(__mfStructureTimerV18!==null){
      clearInterval(__mfStructureTimerV18);
    }
  },
  {once:true}
);"""

new=r"""async function __mfPollOneSecondV17(force=false){
  if(document.hidden&&!force){
    return;
  }

  // MEMEFLOW_DISJOINT_CARD_WRITERS_V19
  // Regular mounted cards and OPEN POSITION cards are separate data lanes.
  await Promise.allSettled([
    loadTokens(),
    __mfRefreshOpenPositionsV16()
  ]);
}

function __mfScheduleCardClockV19(){
  if(__mfOneSecondTimerV17!==null){
    clearTimeout(__mfOneSecondTimerV17);
  }

  const now=performance.now();

  if(!(__mfCardClockNextAtV19>now)){
    __mfCardClockNextAtV19=now;
  }

  __mfOneSecondTimerV17=
    setTimeout(
      ()=>{
        void __mfRunCardClockV19();
      },
      Math.max(
        0,
        __mfCardClockNextAtV19-now
      )
    );
}

async function __mfRunCardClockV19(){
  if(document.hidden){
    __mfCardClockNextAtV19=
      performance.now()+
      __MF_CARD_REFRESH_MS_V17;

    __mfScheduleCardClockV19();
    return;
  }

  if(__mfCardClockRunningV19){
    __mfCardClockKickPendingV19=true;
    return;
  }

  __mfCardClockRunningV19=true;

  const scheduledAt=
    __mfCardClockNextAtV19>0
      ? __mfCardClockNextAtV19
      : performance.now();

  try{
    await __mfPollOneSecondV17(true);
  }finally{
    __mfCardClockRunningV19=false;

    const now=performance.now();

    if(__mfCardClockKickPendingV19){
      __mfCardClockKickPendingV19=false;
      __mfCardClockNextAtV19=now;
    }else{
      let next=
        scheduledAt+
        __MF_CARD_REFRESH_MS_V17;

      // MEMEFLOW_NO_CATCHUP_BURST_V19
      // If a request was slow, SKIP missed slots. Never replay several updates
      // back-to-back to "catch up".
      while(next<=now){
        next+=__MF_CARD_REFRESH_MS_V17;
      }

      __mfCardClockNextAtV19=next;
    }

    __mfScheduleCardClockV19();
  }
}

function __mfKickCardClockV19(){
  if(__mfCardClockRunningV19){
    __mfCardClockKickPendingV19=true;
    return;
  }

  __mfCardClockNextAtV19=
    performance.now();

  __mfScheduleCardClockV19();
}

if(typeof loadDiscoveryStatus==='function'){
  void loadDiscoveryStatus();
}

// MEMEFLOW_PER_MINT_ONE_SECOND_CLOCK_V18
// MEMEFLOW_SINGLE_CARD_CLOCK_START_V19
void __mfLoadStructureV18()
  .finally(
    ()=>__mfKickCardClockV19()
  );

// Membership/ranking synchronization remains separate. It does not write
// mutable card data after MEMEFLOW_STRUCTURE_MEMBERSHIP_ONLY_V19.
__mfStructureTimerV18=
  setInterval(
    ()=>{
      if(!document.hidden){
        void __mfLoadStructureV18();
      }
    },
    __MF_STRUCTURE_REFRESH_MS_V18
  );

document.addEventListener(
  'visibilitychange',
  ()=>{
    if(!document.hidden){
      void __mfLoadStructureV18();
      __mfKickCardClockV19();
    }
  }
);

window.addEventListener(
  'pageshow',
  ()=>{
    __mfKickCardClockV19();
  }
);

window.addEventListener(
  'focus',
  ()=>{
    __mfKickCardClockV19();
  }
);

window.addEventListener(
  'online',
  ()=>{
    __mfKickCardClockV19();
  }
);

window.addEventListener(
  'beforeunload',
  ()=>{
    if(__mfOneSecondTimerV17!==null){
      clearTimeout(__mfOneSecondTimerV17);
    }

    if(__mfStructureTimerV18!==null){
      clearInterval(__mfStructureTimerV18);
    }
  },
  {once:true}
);"""

if old not in ui:
    raise SystemExit("[error] V18 one-second timer block mismatch")
ui=ui.replace(old,new,1)
print("[apply] setInterval overlap replaced by one self-scheduled non-overlap clock")


# Manual action should kick the same single clock, never call the tick directly.
old=r"""$('refreshButton')
  .addEventListener(
    'click',
    ()=>{
      void __mfLoadStructureV18()
        .finally(
          ()=>__mfPollOneSecondV17(true)
        );
    }
  );"""

new=r"""$('refreshButton')
  .addEventListener(
    'click',
    ()=>{
      void __mfLoadStructureV18()
        .finally(
          ()=>__mfKickCardClockV19()
        );
    }
  );"""

if old not in ui:
    raise SystemExit("[error] manual refresh clock anchor mismatch")
ui=ui.replace(old,new,1)


# User page/filter/search navigation: render structure, then immediately kick
# current mounted mints so the new page does not wait for the next clock slot.
ui=ui.replace(
    """          render();
        }
      );""",
    """          render();
          __mfKickCardClockV19();
        }
      );""",
    1
)
ui=ui.replace(
    """      render();
    }
  );""",
    """      render();
      __mfKickCardClockV19();
    }
  );""",
    1
)

save("system-tokens.js",ui)


# Cache bust.
html=load("system-tokens.html")
html,count=re.subn(
    r'(/system-tokens\.js\?v=)[^"\']+',
    r'\1single-clock-v19-20260827',
    html,
    count=1
)
if count!=1:
    raise SystemExit("[error] system-tokens.js cache-buster missing")
save("system-tokens.html",html)


# ===========================================================================
# 3) TESTS: verify behavior, not broad markers
# ===========================================================================
rt=load("tests/realtime-update-path.mjs")

rt=rt.replace(
    r"assert.match(tokenUi,/setInterval\([\s\S]*?__mfPollOneSecondV17[\s\S]*?__MF_CARD_REFRESH_MS_V17/);",
    r"""assert.match(tokenUi,/MEMEFLOW_SINGLE_CARD_CLOCK_V19/);
assert.match(tokenUi,/setTimeout\([\s\S]*?__mfRunCardClockV19/);
assert.doesNotMatch(tokenUi,/setInterval\([\s\S]*?__mfPollOneSecondV17/);
assert.match(tokenUi,/MEMEFLOW_NO_CATCHUP_BURST_V19/);"""
)

rt=rt.replace(
    r"assert.match(tokenHtml,/system-tokens\.js\?v=no-rerender-v18-3-20260827/);",
    r"assert.match(tokenHtml,/system-tokens\.js\?v=single-clock-v19-20260827/);"
)

if "MEMEFLOW_VISIBLE_MINTS_ONLY_V19" not in rt:
    anchor="""assert.match(tokenUi,/\\/api\\/paper\\/positions\\/live/);
"""
    extra="""assert.match(tokenUi,/\\/api\\/paper\\/positions\\/live/);
assert.match(tokenUi,/MEMEFLOW_VISIBLE_MINTS_ONLY_V19/);
assert.match(tokenUi,/MEMEFLOW_STRUCTURE_MEMBERSHIP_ONLY_V19/);
assert.match(tokenUi,/MEMEFLOW_OPEN_POSITION_SINGLE_FLIGHT_V19/);
"""
    if anchor not in rt:
        raise SystemExit("[error] realtime V19 assertion anchor missing")
    rt=rt.replace(anchor,extra,1)

save("tests/realtime-update-path.mjs",rt)


live=load("tests/live-market-truth.mjs")

if "MEMEFLOW_LIVE_CARD_MARKET_TRUTH_V19" not in live:
    anchor="""assert.match(market,/solUsdOracle\\.get\\(\\)/);
"""
    extra="""assert.match(market,/solUsdOracle\\.get\\(\\)/);
assert.match(market,/MEMEFLOW_LIVE_CARD_MARKET_TRUTH_V19/);
assert.match(market,/liveCardMarketSnapshot\\(\\{/);
assert.doesNotMatch(market,/storedMcSol/);
"""
    if anchor not in live:
        raise SystemExit("[error] live-market V19 assertion anchor missing")
    live=live.replace(anchor,extra,1)

save("tests/live-market-truth.mjs",live)


per=load("tests/per-mint-card-refresh-v18.mjs")
per=per.replace(
    r"/system-tokens\.js\?v=no-rerender-v18-3-20260827/",
    r"/system-tokens\.js\?v=single-clock-v19-20260827/"
)

# Add the exact stale-open-position regression that the screenshot exposed.
if "staleUnknownSource" not in per:
    anchor="""const referenced=liveCardMarketSnapshot({
"""
    block=r"""// V19: an old/open-position token with a stored 33.5K-ish baseline but
// NO proven TradeEvent must not display that baseline as live MC.
const staleUnknownSource=liveCardMarketSnapshot({
  token:{
    launchPlatform:'pump',
    priceSol:0.000000335,
    lastPriceAt:900_000,
    marketCapSol:335,
    marketCapUsd:33_500,
    totalSupply:1_000_000_000
  },
  points:[],
  solUsd:100,
  now:1_000_000
});

assert.equal(staleUnknownSource.tradeEvidence,false);
assert.equal(staleUnknownSource.marketCapSol,null);
assert.equal(staleUnknownSource.marketCapUsd,null);
assert.equal(staleUnknownSource.marketCapSource,null);

const referenced=liveCardMarketSnapshot({
"""
    if anchor not in per:
        raise SystemExit("[error] per-mint stale MC test anchor missing")
    per=per.replace(anchor,block,1)

save("tests/per-mint-card-refresh-v18.mjs",per)


new_test=r"""import assert from 'node:assert/strict';
import fs from 'node:fs';

const ui=fs.readFileSync(
  new URL('../system-tokens.js',import.meta.url),
  'utf8'
);

const app=fs.readFileSync(
  new URL('../app-server.mjs',import.meta.url),
  'utf8'
);

const moduleSource=fs.readFileSync(
  new URL('../src/live-card-market.mjs',import.meta.url),
  'utf8'
);

// Backend must ACTUALLY call the truth module; an import/marker alone is not enough.
const marketFn=app.slice(
  app.indexOf('function __mfCandidateMarket5mV4('),
  app.indexOf('// MEMEFLOW_REALTIME_UI_FAIRNESS_V1')
);

assert.match(marketFn,/MEMEFLOW_LIVE_CARD_MARKET_TRUTH_V19/);
assert.match(marketFn,/liveCardMarketSnapshot\(\{/);
assert.doesNotMatch(marketFn,/storedMcSol/);
assert.doesNotMatch(marketFn,/storedMcUsd/);

assert.match(moduleSource,/MEMEFLOW_NO_STORED_MC_FALLBACK_V19/);
assert.doesNotMatch(moduleSource,/liveMarketCapSol\s*\?\?\s*storedMarketCapSol/);

// One automatic mutable clock only.
assert.match(ui,/MEMEFLOW_SINGLE_CARD_CLOCK_V19/);
assert.match(ui,/MEMEFLOW_NO_CATCHUP_BURST_V19/);
assert.match(ui,/setTimeout\([\s\S]*?__mfRunCardClockV19/);
assert.doesNotMatch(
  ui,
  /setInterval\([\s\S]{0,300}?__mfPollOneSecondV17/
);

// The 10-second structure lane must not patch market values.
const reconcile=ui.slice(
  ui.indexOf('function __mfReconcileVisibleCardsV183(){'),
  ui.indexOf('async function loadDiscoveryStatus()')
);

assert.match(reconcile,/MEMEFLOW_STRUCTURE_MEMBERSHIP_ONLY_V19/);
assert.doesNotMatch(reconcile,/__mfPatchMutableCardV17/);

// No Open Position replay/catch-up loop.
const open=ui.slice(
  ui.indexOf('// MEMEFLOW_OPEN_POSITION_EVENT_FACT_V16'),
  ui.indexOf('// MEMEFLOW_PER_MINT_BATCH_REFRESH_V18')
);

assert.match(open,/MEMEFLOW_OPEN_POSITION_SINGLE_FLIGHT_V19/);
assert.doesNotMatch(open,/refreshPending/i);
assert.doesNotMatch(open,/do\s*\{/);
assert.doesNotMatch(open,/while\s*\(/);

// The regular batch is limited to mounted cards and excludes OPEN mints.
const load=ui.slice(
  ui.indexOf('async function loadTokens(){'),
  ui.indexOf("document\n  .querySelectorAll(\n    '.summary-card'")
);

assert.match(load,/MEMEFLOW_VISIBLE_MINTS_ONLY_V19/);
assert.match(load,/\.flow-token\[data-mint\]/);
assert.match(load,/!openMints\.has\(mint\)/);
assert.match(load,/slice\(0,PAGE_SIZE\)/);
assert.doesNotMatch(
  load,
  /state\.rows\s*\n?\s*\.map\(row=>String\(row\?\.mint/
);

// Static identity remains outside the automatic mutable patch.
const mutable=ui.slice(
  ui.indexOf('function __mfPatchMutableCardV17('),
  ui.indexOf('async function __mfPollOneSecondV17(')
);

assert.doesNotMatch(
  mutable,
  /querySelector(?:All)?\(\s*['"]\.token-name/
);
assert.doesNotMatch(
  mutable,
  /querySelector(?:All)?\(\s*['"]\.token-avatar/
);
assert.doesNotMatch(
  mutable,
  /querySelector(?:All)?\(\s*['"]\.token-pump-link/
);

console.log('live card clock v19 ok');
"""

save("tests/live-card-clock-v19.mjs",new_test)
print("[apply] V19 exact regression tests")


# ===========================================================================
# Static install-time guards
# ===========================================================================
app=load("app-server.mjs")
ui=load("system-tokens.js")
market=load("src/live-card-market.mjs")

market_fn=app[
    app.find("function __mfCandidateMarket5mV4("):
    app.find("// MEMEFLOW_REALTIME_UI_FAIRNESS_V1")
]

for needle in [
    "MEMEFLOW_LIVE_CARD_MARKET_TRUTH_V19",
    "liveCardMarketSnapshot({"
]:
    if needle not in market_fn:
        raise SystemExit(f"[verify] candidate market truth missing: {needle}")

for forbidden in ["storedMcSol","storedMcUsd"]:
    if forbidden in market_fn:
        raise SystemExit(
            f"[verify] old stale-MC fallback remains in candidate function: {forbidden}"
        )

for needle in [
    "MEMEFLOW_NO_STORED_MC_FALLBACK_V19",
    "MEMEFLOW_SINGLE_CARD_CLOCK_V19",
    "MEMEFLOW_NO_CATCHUP_BURST_V19",
    "MEMEFLOW_VISIBLE_MINTS_ONLY_V19",
    "MEMEFLOW_STRUCTURE_MEMBERSHIP_ONLY_V19",
    "MEMEFLOW_OPEN_POSITION_SINGLE_FLIGHT_V19",
    "MEMEFLOW_TRUSTED_MC_SOURCE_V19"
]:
    source=market if needle=="MEMEFLOW_NO_STORED_MC_FALLBACK_V19" else ui
    if needle not in source:
        raise SystemExit(f"[verify] V19 invariant missing: {needle}")

reconcile=ui[
    ui.find("function __mfReconcileVisibleCardsV183(){"):
    ui.find("async function loadDiscoveryStatus()")
]

if "__mfPatchMutableCardV17" in reconcile:
    raise SystemExit(
        "[verify] structure sync still writes mutable card data"
    )

open_block=ui[
    ui.find("// MEMEFLOW_OPEN_POSITION_EVENT_FACT_V16"):
    ui.find("// MEMEFLOW_PER_MINT_BATCH_REFRESH_V18")
]

if re.search(r"\bdo\s*\{",open_block) or re.search(r"\bwhile\s*\(",open_block):
    raise SystemExit(
        "[verify] Open Position catch-up/replay loop still exists"
    )

print("[verify] V19 single clock + no stale MC + disjoint writers OK")
PY

cd "$TMP/memeflow-app"

echo "[check] syntax"
node --check app-server.mjs
node --check src/live-card-market.mjs
node --check system-tokens.js
node --check tests/live-card-clock-v19.mjs
node --check tests/realtime-update-path.mjs
node --check tests/live-market-truth.mjs
node --check tests/per-mint-card-refresh-v18.mjs

echo "[check] exact V19 tests FIRST"
node tests/live-card-clock-v19.mjs
node tests/per-mint-card-refresh-v18.mjs

echo "[check] related live regressions"
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

git diff --check
git diff --stat -- "${FILES[@]}" "$NEW_TEST"

git add -- "${FILES[@]}" "$NEW_TEST"

if git diff --cached --quiet; then
  echo "[git] v19 already present on origin/main"
  NEW_SHA="$(git rev-parse HEAD)"
else
  git commit -m "fix: stabilize one-second card clock and live market cap truth"
  NEW_SHA="$(git rev-parse HEAD)"
  git push origin HEAD:main
fi

echo "[git] verified commit: $NEW_SHA"

cd "$ROOT"

BACKUP="$ROOT/.memeflow-v19-recovery-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP"

for f in "${FILES[@]}"; do
  mkdir -p "$BACKUP/$(dirname "$f")"
  cp -p "$f" "$BACKUP/$f"
done

LOCAL_HEAD="$(git rev-parse HEAD)"

git restore --staged --worktree -- "${FILES[@]}" 2>/dev/null || true

if git merge-base --is-ancestor "$LOCAL_HEAD" "$NEW_SHA" 2>/dev/null; then
  if git merge --ff-only "$NEW_SHA"; then
    echo "[local] workspace fast-forwarded to verified v19"
  else
    git restore --source="$NEW_SHA" --worktree -- "${FILES[@]}" "$NEW_TEST"
    echo "[local] synced only v19 files"
  fi
else
  git restore --source="$NEW_SHA" --worktree -- "${FILES[@]}" "$NEW_TEST"
  echo "[local] synced only v19 files"
fi

echo "[local] recovery backup: $BACKUP"

echo
echo "DONE"
echo "- exactly ONE automatic mutable-data clock controls card refresh"
echo "- missed/slow ticks are skipped, never replayed in a burst"
echo "- regular cards refresh only the mounted page mints (max PAGE_SIZE)"
echo "- OPEN POSITION cards use one separate request per tick with no pending replay"
echo "- 10s structure sync no longer writes mutable market/card values"
echo "- stale stored 33.5K-style MC is never accepted as live market cap"
echo "- backend candidate market function now ACTUALLY calls liveCardMarketSnapshot"
echo "- name/avatar/Pump.fun static identity remains untouched"
echo "- V17 Mayhem hard block remains untouched"
echo "- full npm test + benchmark passed before push"
echo
echo "IMPORTANT: backend market logic changed. After DONE do one Replit Stop -> Run,"
echo "then refresh the browser once."
