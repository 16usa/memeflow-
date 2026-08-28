#!/usr/bin/env bash
set -euo pipefail

# MEMEFLOW live ranking / stale market / holder-reference repair
# Safe to run from either repo root or memeflow-app/.
ROOT="${1:-.}"
cd "$ROOT"

if [[ -f "memeflow-app/package.json" ]]; then
  cd memeflow-app
fi

if [[ ! -f "package.json" || ! -f "app-server.mjs" ]]; then
  echo "ERROR: run this from the repository root or memeflow-app/"
  exit 1
fi

echo "==> Backing up touched files"
STAMP="$(date +%Y%m%d-%H%M%S)"
mkdir -p ".patch-backups/live-ranking-$STAMP"
for f in \
  app-server.mjs \
  src/feed-ranking.mjs \
  src/live-card-market.mjs \
  src/event-holder-ledger.mjs \
  tests/feed-ranking.mjs \
  tests/live-market-truth.mjs
do
  cp "$f" ".patch-backups/live-ranking-$STAMP/$(basename "$f")"
done

python3 <<'PY'
from pathlib import Path
import re

def replace_once(path, old, new, label):
    p = Path(path)
    s = p.read_text()
    count = s.count(old)
    if count != 1:
        raise SystemExit(f"{path}: expected exactly one '{label}' match, found {count}")
    p.write_text(s.replace(old, new, 1))
    print(f"patched {path}: {label}")

# ---------------------------------------------------------------------------
# 1) WATCH + WAITING are ranked together by CURRENT live quality.
#    For those two states the UI score becomes the live feed score, while
#    decisionScore preserves the original trading decision score.
# ---------------------------------------------------------------------------
feed = r"""// MEMEFLOW_FEED_RELEVANCE_RANKING_V2
//
// Feed order policy:
// 1) OPEN POSITION stays first, BUY READY stays next, BLOCKED stays last.
// 2) WATCH and WAITING are one live-candidate pool and are ordered by CURRENT
//    market quality, not by the label alone.
// 3) The card score for WATCH/WAITING is a live feed score. The original
//    decision score is preserved as decisionScore and trading eligibility is
//    not changed here.

const STATE_PRIORITY = Object.freeze({
  'OPEN POSITION': 500,
  'OPEN_POSITION': 500,
  'OPEN': 500,
  'POSITION': 500,
  'BUY READY': 400,
  'BUY_READY': 400,
  'WATCH': 300,
  'WAITING': 300,
  'BLOCKED': 100,
  'REJECTED': 50,
  'EXPIRED': 25
});

const number = value => {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

const clamp01 = value => Math.max(0, Math.min(1, Number(value) || 0));
const clamp100 = value => Math.max(0, Math.min(100, Number(value) || 0));

function logSaturation(value, cap) {
  const n = number(value);
  if (n === null || n <= 0) return 0;
  const safeCap = Math.max(1, Number(cap) || 1);
  return clamp01(Math.log1p(n) / Math.log1p(safeCap));
}

function normalizedState(state) {
  return String(state || 'WAITING').trim().toUpperCase();
}

function statePriority(state) {
  return STATE_PRIORITY[normalizedState(state)] ?? 0;
}

function isLiveCandidateState(state) {
  const key = normalizedState(state);
  return key === 'WATCH' || key === 'WAITING';
}

function priceMomentumQuality(value) {
  const p = number(value);
  if (p === null) return 0;
  if (p <= -15) return 0;
  if (p < 0) return clamp01((p + 15) / 15) * 0.12;
  if (p < 5) return 0.20 + (p / 5) * 0.25;
  if (p < 40) return 0.45 + ((p - 5) / 35) * 0.35;
  if (p <= 120) return 0.80 + ((p - 40) / 80) * 0.20;
  if (p <= 180) return 1.00 - ((p - 120) / 60) * 0.12;
  if (p <= 300) return 0.88 - ((p - 180) / 120) * 0.33;
  return 0.50;
}

function ageQuality(ageMinutes) {
  const age = number(ageMinutes);
  if (age === null || age < 0) return 0.3;
  if (age <= 0.15) return 0.65;
  if (age <= 5) return 1;
  if (age <= 15) return 0.85;
  if (age <= 30) return 0.65;
  if (age <= 60) return 0.40;
  return 0.20;
}

function activityFreshness(quoteAgeMs) {
  const ms = number(quoteAgeMs);
  if (ms === null || ms < 0) return 0.25;
  if (ms <= 3_000) return 1;
  if (ms <= 10_000) return 0.85;
  if (ms <= 20_000) return 0.60;
  if (ms <= 30_000) return 0.40;
  return 0.15;
}

function volumeQuality(view) {
  const usd = number(view?.volume5mUsd);
  if (usd !== null) return logSaturation(usd, 10_000);
  const sol = number(view?.volume5mSol);
  if (sol !== null) return logSaturation(sol, 20);
  return 0;
}

function transactionQuality(view) {
  const tx = number(view?.transactions5m);
  return tx === null ? 0 : logSaturation(tx, 20);
}

function marketCapQuality(view) {
  const usd = number(view?.marketCapUsd);
  if (usd !== null) return logSaturation(usd, 50_000);
  const sol = number(view?.marketCapSol ?? view?.marketCap);
  if (sol !== null) return logSaturation(sol, 150);
  return 0;
}

function hasLiveActivity(view) {
  const tx = number(view?.transactions5m) ?? 0;
  const usd = number(view?.volume5mUsd) ?? 0;
  const sol = number(view?.volume5mSol) ?? 0;
  return tx > 0 || usd > 0 || sol > 0;
}

export function candidateRelevanceScore(view = {}) {
  const score = clamp01((number(view.score) ?? 0) / 100);
  const opportunity = clamp01((number(view.opportunityScore) ?? 0) / 100);
  const quality = clamp01((number(view.qualityScore) ?? 0) / 100);
  const holders = logSaturation(view.holderCount ?? view.holders, 120);
  const holdersWeight = view.holderCountIsLowerBound === true ? 3 : 8;
  const volume = volumeQuality(view);
  const tx = transactionQuality(view);
  const momentum = priceMomentumQuality(view.priceChange5mPct);
  const marketCap = marketCapQuality(view);
  const age = ageQuality(view.ageMinutes);
  const activity = activityFreshness(view.quoteAgeMs);
  const liveActivity = hasLiveActivity(view);

  // Current tape activity deliberately carries more weight than an old
  // decision score. This prevents a stale WATCH 74 with zero trades/volume
  // from sitting above a genuinely moving WAITING candidate.
  let relevance =
    score * 16 +
    opportunity * 10 +
    quality * 6 +
    holders * holdersWeight +
    volume * 14 +
    tx * 14 +
    momentum * 13 +
    marketCap * 10 +
    age * 2 +
    activity * 3;

  if (liveActivity) relevance += 15;
  else relevance -= 30;

  const priceChange = number(view.priceChange5mPct);
  const marketCapUsd = number(view.marketCapUsd);
  const marketCapSol = number(view.marketCapSol ?? view.marketCap);
  const txCount = number(view.transactions5m) ?? 0;

  if (priceChange === null) relevance -= 4;
  else if (priceChange <= -25) relevance -= 24;
  else if (priceChange <= -15) relevance -= 18;
  else if (priceChange <= -8) relevance -= 10;

  if (marketCapUsd === null && marketCapSol === null) relevance -= 3;

  if (txCount >= 4 && priceChange !== null && priceChange > 0) relevance += 5;
  if (txCount >= 8 && priceChange !== null && priceChange > 0) relevance += 3;

  const quoteAge = number(view.quoteAgeMs);
  if (quoteAge !== null && quoteAge > 30_000) relevance -= 8;
  if (quoteAge !== null && quoteAge > 60_000) relevance -= 8;

  const drawdown = Math.max(0, number(view.drawdownFromPeakPct) ?? 0);
  const whale = Math.max(0, number(view.whaleDominancePct) ?? 0);

  relevance -= Math.min(12, Math.max(0, drawdown - 12) * 0.14);
  relevance -= Math.min(7, Math.max(0, whale - 35) * 0.09);

  if (view.opportunityTrendHealthy === false) relevance -= 4;
  if (view.dead === true) relevance = 0;

  return Math.round(clamp100(relevance) * 100) / 100;
}

export function compareCandidateViews(a = {}, b = {}) {
  const stateDelta = statePriority(b.state) - statePriority(a.state);
  if (stateDelta) return stateDelta;

  const ar = number(a.relevanceScore) ?? candidateRelevanceScore(a);
  const br = number(b.relevanceScore) ?? candidateRelevanceScore(b);
  if (br !== ar) return br - ar;

  const ao = number(a.opportunityScore) ?? 0;
  const bo = number(b.opportunityScore) ?? 0;
  if (bo !== ao) return bo - ao;

  const at = number(a.transactions5m) ?? 0;
  const bt = number(b.transactions5m) ?? 0;
  if (bt !== at) return bt - at;

  const av = number(a.volume5mUsd) ?? number(a.volume5mSol) ?? 0;
  const bv = number(b.volume5mUsd) ?? number(b.volume5mSol) ?? 0;
  if (bv !== av) return bv - av;

  const amc = number(a.marketCapUsd) ?? number(a.marketCapSol ?? a.marketCap) ?? 0;
  const bmc = number(b.marketCapUsd) ?? number(b.marketCapSol ?? b.marketCap) ?? 0;
  if (bmc !== amc) return bmc - amc;

  const ah = number(a.holderCount ?? a.holders) ?? 0;
  const bh = number(b.holderCount ?? b.holders) ?? 0;
  if (bh !== ah) return bh - ah;

  const aq = number(a.quoteAgeMs) ?? Number.MAX_SAFE_INTEGER;
  const bq = number(b.quoteAgeMs) ?? Number.MAX_SAFE_INTEGER;
  if (aq !== bq) return aq - bq;

  return String(a.mint || a.id || '').localeCompare(String(b.mint || b.id || ''));
}

export function rankCandidateViews(views = []) {
  return (Array.isArray(views) ? views : [])
    .filter(Boolean)
    .map(view => {
      const decisionScore = number(view.score) ?? 0;
      const relevanceScore = candidateRelevanceScore(view);
      const liveCandidate = isLiveCandidateState(view.state);
      return {
        ...view,
        decisionScore,
        score: liveCandidate ? Math.round(relevanceScore) : decisionScore,
        feedScore: relevanceScore,
        relevanceScore,
        statePriority: statePriority(view.state)
      };
    })
    .sort(compareCandidateViews);
}

export { statePriority as candidateStatePriority };
"""
Path("src/feed-ranking.mjs").write_text(feed)
print("patched src/feed-ranking.mjs: live relevance ranking v2")

# ---------------------------------------------------------------------------
# 2) Event-ledger holder count is an OBSERVED LOWER BOUND, not total holders.
# ---------------------------------------------------------------------------
replace_once(
    "src/event-holder-ledger.mjs",
    """      holderFresh:true,
      holderSource:'event-ledger-v12-24-user-only',
      holderCount:holders.length,
      holderRiskWallets,""",
    """      holderFresh:true,
      holderSource:'event-ledger-v12-24-user-only',
      // TradeEvent.user only tells us how many holders MEMEFLOW has observed.
      // It is NOT an authoritative total-holder count.
      holderCount:holders.length,
      observedHolderCount:holders.length,
      holderCountAuthoritative:false,
      holderCountIsLowerBound:true,
      holderRiskWallets,""",
    "mark event-ledger holder count as lower bound"
)

# ---------------------------------------------------------------------------
# 3) Live card market truth: do not resurrect stale stored MC forever.
# ---------------------------------------------------------------------------
replace_once(
    "src/live-card-market.mjs",
    """  const tokenTradeAt=finite(
    token?.lastPriceAt ??
    token?.lastMarketActivityAt
  );""",
    """  const tokenTradeAt=finite(
    token?.lastPriceAt ??
    token?.lastMarketActivityAt ??
    token?.marketCapUpdatedAt ??
    token?.lastTradeAt
  );""",
    "use all fresh trade timestamps"
)

replace_once(
    "src/live-card-market.mjs",
    """  const tokenHasTradeEvidence=Boolean(
    tokenPrice!==null&&
    tokenPrice>0&&
    tokenTradeAt!==null&&
    tokenTradeAt>0&&
    explicitTradeEvidence
  );""",
    """  const tokenTradeAgeMs=
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
  );""",
    "expire stale token trade evidence"
)

replace_once(
    "src/live-card-market.mjs",
    """  const pumpReferenceUsd=finite(
    token?.pumpReportedMarketCapUsd
  );""",
    """  const pumpReferenceAt=finite(token?.pumpReferenceAt);
  const pumpReferenceFresh=Boolean(
    pumpReferenceAt!==null&&
    pumpReferenceAt>0&&
    Math.max(0,now-pumpReferenceAt)<=Math.min(windowMs,90_000)
  );

  const pumpReferenceUsd=
    pumpReferenceFresh
      ? finite(token?.pumpReportedMarketCapUsd)
      : null;""",
    "expire stale Pump reference MC"
)

# ---------------------------------------------------------------------------
# 4) app-server:
#    - live card must not fall back to stale stored MC;
#    - use fresh Pump holder count when present;
#    - WAITING gets a preview/live score instead of hardcoded 0, but remains
#      non-tradable until admission passes.
# ---------------------------------------------------------------------------
replace_once(
    "app-server.mjs",
    """  const marketCapSol=
    finite(
      market5m?.marketCapSol ??
      t?.marketCapSol ??
      t?.marketCap
    );

  const marketCapUsd=
    finite(
      market5m?.marketCapUsd ??
      t?.marketCapUsd
    );

  const holderCount=
    finite(t?.holderCount??t?.holders);""",
    """  // MEMEFLOW_LIVE_CARD_STALE_MC_FIX_V21
  // The V19 market truth module is authoritative. Never resurrect a stale
  // stored marketCapUsd/marketCapSol after the live snapshot rejected it.
  const marketCapSol=
    finite(market5m?.marketCapSol);

  const marketCapUsd=
    finite(market5m?.marketCapUsd);

  const pumpHolderCount=
    finite(t?.pumpReportedHolderCount)!==null &&
    Date.now()-Number(t?.pumpReferenceAt||0)<=90_000
      ? finite(t?.pumpReportedHolderCount)
      : null;

  const holderCount=
    pumpHolderCount ?? finite(t?.holderCount??t?.holders);

  const holderCountAuthoritative=
    pumpHolderCount!==null ||
    t?.holderCountAuthoritative===true;

  const holderCountIsLowerBound=
    pumpHolderCount===null &&
    (
      t?.holderCountIsLowerBound===true ||
      String(t?.holderSource||t?.eventLedgerVersion||'')
        .toLowerCase()
        .includes('event-ledger')
    );""",
    "remove stale MC fallback and prefer Pump holder reference"
)

replace_once(
    "app-server.mjs",
    """    holders:holderCount,
    holderCount,
    holderSource:t?.holderSource||t?.eventLedgerVersion||'ws-event-ledger',
    holderFresh:t?.holderFresh===true,""",
    """    holders:holderCount,
    holderCount,
    observedHolderCount:finite(t?.observedHolderCount),
    holderCountAuthoritative,
    holderCountIsLowerBound,
    holderSource:
      pumpHolderCount!==null
        ? 'pump-reference'
        : (t?.holderSource||t?.eventLedgerVersion||'ws-event-ledger'),
    holderFresh:t?.holderFresh===true,""",
    "expose holder truth metadata on live cards"
)

# candidateView already prefers Pump holder reference; expose lower-bound flags
# so feed ranking does not over-trust an event-ledger count.
candidate_holder_old = """    holderSource:
      finite(t.pumpReportedHolderCount)!==null &&
      Date.now()-Number(t.pumpReferenceAt||0)<=90000
        ? 'pump-reference'
        : (t.holderSource||t.eventLedgerVersion||'ws-event-ledger'),
    top10:top10Pct,"""
candidate_holder_new = """    holderSource:
      finite(t.pumpReportedHolderCount)!==null &&
      Date.now()-Number(t.pumpReferenceAt||0)<=90000
        ? 'pump-reference'
        : (t.holderSource||t.eventLedgerVersion||'ws-event-ledger'),
    holderCountAuthoritative:
      finite(t.pumpReportedHolderCount)!==null &&
      Date.now()-Number(t.pumpReferenceAt||0)<=90000
        ? true
        : t.holderCountAuthoritative===true,
    holderCountIsLowerBound:
      !(
        finite(t.pumpReportedHolderCount)!==null &&
        Date.now()-Number(t.pumpReferenceAt||0)<=90000
      ) &&
      (
        t.holderCountIsLowerBound===true ||
        String(t.holderSource||t.eventLedgerVersion||'')
          .toLowerCase()
          .includes('event-ledger')
      ),
    observedHolderCount:finite(t.observedHolderCount),
    top10:top10Pct,"""
replace_once(
    "app-server.mjs",
    candidate_holder_old,
    candidate_holder_new,
    "expose holder lower-bound metadata on candidateView"
)

decision_pattern = re.compile(
    r"""  if\(!eligible&&!isOpen\)\{\n"""
    r"""    const reasons=[\s\S]*?"""
    r"""    decision=\{\n"""
    r"""      state:blocked\?'BLOCKED':'WAITING',\n"""
    r"""      score:0,\n"""
    r"""      confidence:0,\n"""
    r"""      primaryReason:reasons\[0\]\|\|fallbackReason,\n"""
    r"""      reasons:reasons\.length\?reasons:\[fallbackReason\],\n"""
    r"""      terminal:false\n"""
    r"""    \};\n"""
    r"""  \}else\{"""
)

decision_replacement = """  if(!eligible&&!isOpen){
    const reasons=
      Array.isArray(admission?.reasons)
        ? admission.reasons
            .filter(x=>typeof x==='string'&&x.trim())
            .map(x=>x.trim())
        : [];

    const blocked=admissionState==='REJECTED';
    const fallbackReason=
      blocked
        ? 'Entry filters rejected this token'
        : 'Waiting for entry-filter data';

    if(blocked){
      decision={
        state:'BLOCKED',
        score:0,
        confidence:0,
        primaryReason:reasons[0]||fallbackReason,
        reasons:reasons.length?reasons:[fallbackReason],
        terminal:false
      };
    }else{
      // MEMEFLOW_WAITING_PREVIEW_SCORE_V21
      // WAITING is a trade-admission state, not a quality score. Calculate a
      // read-only preview score from the evidence already present so a moving
      // token is not displayed as "0" merely because one gate is still pending.
      let preview=null;
      try{preview=evaluate(token,settings)}catch{}

      const numeric=v=>{
        const n=Number(v);
        return Number.isFinite(n)?n:0;
      };
      const previewScore=Math.max(
        numeric(preview?.score),
        numeric(token?.opportunityScore),
        numeric(token?.qualityScore)
      );
      const previewConfidence=Math.max(
        numeric(preview?.confidence),
        numeric(token?.dataQuality)*100
      );

      decision={
        ...(preview&&typeof preview==='object'?preview:{}),
        state:'WAITING',
        score:Math.max(0,Math.min(100,Math.round(previewScore))),
        confidence:Math.max(0,Math.min(100,Math.round(previewConfidence))),
        primaryReason:
          reasons[0]||
          preview?.primaryReason||
          fallbackReason,
        reasons:
          reasons.length
            ? reasons
            : (
                Array.isArray(preview?.reasons)&&preview.reasons.length
                  ? preview.reasons
                  : [fallbackReason]
              ),
        terminal:false
      };
    }
  }else{"""

app_path = Path("app-server.mjs")
app = app_path.read_text()
app2, n = decision_pattern.subn(decision_replacement, app, count=1)
if n != 1:
    raise SystemExit(f"app-server.mjs: expected one WAITING score block, found {n}")
app_path.write_text(app2)
print("patched app-server.mjs: WAITING preview score")

# ---------------------------------------------------------------------------
# 5) Regression tests: reproduce Milo vs rizztek from the screenshots.
# ---------------------------------------------------------------------------
feed_test = r"""import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  candidateRelevanceScore,
  rankCandidateViews,
  candidateStatePriority
} from '../src/feed-ranking.mjs';

const activeWatch={
  mint:'ActiveWatch',
  state:'WATCH',
  score:71,
  qualityScore:78,
  opportunityScore:76,
  holderCount:21,
  volume5mUsd:1600,
  transactions5m:35,
  marketCapUsd:5000,
  priceChange5mPct:35.5,
  ageMinutes:1.4,
  quoteAgeMs:1000,
  drawdownFromPeakPct:3,
  whaleDominancePct:22,
  opportunityTrendHealthy:true
};

const weakWatch={
  mint:'WeakWatch',
  state:'WATCH',
  score:70,
  qualityScore:63,
  opportunityScore:42,
  holderCount:5,
  volume5mUsd:198,
  transactions5m:9,
  marketCapUsd:2400,
  priceChange5mPct:1.1,
  ageMinutes:0.7,
  quoteAgeMs:1000,
  drawdownFromPeakPct:4,
  whaleDominancePct:45,
  opportunityTrendHealthy:true
};

assert.ok(
  candidateRelevanceScore(activeWatch) >
  candidateRelevanceScore(weakWatch),
  'stronger current card metrics must rank higher'
);

const hugeButWeakPump={
  ...weakWatch,
  mint:'HugeButWeakPump',
  priceChange5mPct:620
};

assert.ok(
  candidateRelevanceScore(activeWatch) >
  candidateRelevanceScore(hugeButWeakPump),
  'raw vertical price change alone must not dominate relevance'
);

// Regression from the 2026-08-27 screenshots:
// Milo was WATCH/74 but had zero 5m activity and a stale card.
// rizztek was WAITING/0 but had fresh trades, volume and +5m movement.
// The active token must rank above the stale one regardless of WAITING/WATCH.
const milo={
  mint:'Milo',
  state:'WATCH',
  score:74,
  holderCount:73,
  holderCountIsLowerBound:true,
  volume5mUsd:0,
  volume5mSol:0,
  transactions5m:0,
  marketCapUsd:null,
  priceChange5mPct:null,
  ageMinutes:11,
  quoteAgeMs:90_000,
  opportunityScore:0,
  qualityScore:40
};

const rizztek={
  mint:'rizztek',
  state:'WAITING',
  score:0,
  holderCount:4,
  holderCountIsLowerBound:true,
  volume5mUsd:179.7,
  transactions5m:4,
  marketCapUsd:5600,
  priceChange5mPct:10.6,
  ageMinutes:6.4,
  quoteAgeMs:1000,
  opportunityScore:52,
  qualityScore:45,
  opportunityTrendHealthy:true
};

const screenshotRegression=rankCandidateViews([milo,rizztek]);
assert.equal(screenshotRegression[0].mint,'rizztek');
assert.ok(
  screenshotRegression[0].score > screenshotRegression[1].score,
  'live feed score must agree with live ordering'
);
assert.equal(screenshotRegression[0].decisionScore,0);
assert.equal(screenshotRegression[1].decisionScore,74);

const lowBuyReady={
  ...weakWatch,
  mint:'LowBuyReady',
  state:'BUY READY',
  score:72
};

const spectacularWaiting={
  ...activeWatch,
  mint:'SpectacularWaiting',
  state:'WAITING',
  score:0,
  opportunityScore:99,
  qualityScore:99,
  holderCount:200,
  volume5mUsd:25000,
  transactions5m:180,
  priceChange5mPct:90
};

const blockedStrong={
  ...spectacularWaiting,
  mint:'BlockedStrong',
  state:'BLOCKED'
};

const ranked=rankCandidateViews([
  blockedStrong,
  activeWatch,
  spectacularWaiting,
  lowBuyReady
]);

assert.equal(ranked[0].mint,'LowBuyReady');
assert.equal(ranked.at(-1).mint,'BlockedStrong');
assert.ok(
  ranked.findIndex(x=>x.mint==='SpectacularWaiting') <
  ranked.findIndex(x=>x.mint==='ActiveWatch'),
  'WAITING and WATCH must compete by live quality'
);

assert.ok(ranked.every(row=>Number.isFinite(row.relevanceScore)));
assert.ok(candidateStatePriority('OPEN POSITION')>candidateStatePriority('BUY READY'));
assert.ok(candidateStatePriority('BUY READY')>candidateStatePriority('WATCH'));
assert.equal(candidateStatePriority('WATCH'),candidateStatePriority('WAITING'));
assert.ok(candidateStatePriority('WAITING')>candidateStatePriority('BLOCKED'));

const app=fs.readFileSync(new URL('../app-server.mjs',import.meta.url),'utf8');
const liveStart=app.indexOf("if(url.pathname==='/api/system/live-token-states'");
const aiStart=app.indexOf("if(url.pathname==='/api/ai/decisions')");
const debugStart=app.indexOf("if(url.pathname==='/api/debug/filter-pipeline')");
const liveSlice=app.slice(liveStart,aiStart);
const aiSlice=app.slice(aiStart,debugStart);

assert.match(liveSlice,/rankCandidateViews\(_unrankedViews\)/);
assert.match(aiSlice,/rankCandidateViews\(_selected\.map\(candidateView\)\)/);
assert.match(app,/MEMEFLOW_WAITING_PREVIEW_SCORE_V21/);
assert.match(app,/MEMEFLOW_LIVE_CARD_STALE_MC_FIX_V21/);

console.log('feed relevance ranking v2 ok');
"""
Path("tests/feed-ranking.mjs").write_text(feed_test)
print("patched tests/feed-ranking.mjs: screenshot regression")

# Add direct live-market freshness tests without disturbing existing source checks.
p = Path("tests/live-market-truth.mjs")
s = p.read_text()
if "MEMEFLOW_STALE_MARKET_REGRESSION_V21" not in s:
    s = s.replace(
        "import fs from 'node:fs';\n",
        "import fs from 'node:fs';\nimport {liveCardMarketSnapshot} from '../src/live-card-market.mjs';\n",
        1
    )
    insertion = r"""
// MEMEFLOW_STALE_MARKET_REGRESSION_V21
// A stored TradeEvent market cap must expire when there has been no live trade
// inside the card window. This is the Milo stale-$33.5K regression.
{
  const now=Date.now();
  const stale=liveCardMarketSnapshot({
    token:{
      launchPlatform:'pump',
      priceSol:0.0000002,
      marketCapUsd:33500,
      marketSource:'ws-direct-trade-event-v13',
      liveMarketCapSource:'pump-trade-price-x-supply',
      lastPriceAt:now-6*60_000
    },
    points:[],
    solUsd:170,
    now,
    windowMs:300000
  });
  assert.equal(stale.marketCapUsd,null);

  const fresh=liveCardMarketSnapshot({
    token:{
      launchPlatform:'pump',
      priceSol:0.000000033,
      marketCapUsd:5600,
      marketSource:'ws-direct-trade-event-v13',
      liveMarketCapSource:'pump-trade-price-x-supply',
      lastPriceAt:now-1000
    },
    points:[],
    solUsd:170,
    now,
    windowMs:300000
  });
  assert.ok(Number(fresh.marketCapUsd)>0);
}

"""
    s = s.replace("console.log('live market truth v1 ok');", insertion + "console.log('live market truth v1 ok');")
    p.write_text(s)
    print("patched tests/live-market-truth.mjs: stale MC regression")
else:
    print("tests/live-market-truth.mjs: stale MC regression already present")
PY

echo "==> Syntax / diff check"
git diff --check
node --check app-server.mjs
node --check src/feed-ranking.mjs
node --check src/live-card-market.mjs
node --check src/event-holder-ledger.mjs

echo "==> Running focused regression tests"
node tests/feed-ranking.mjs
node tests/live-market-truth.mjs

echo "==> Running full project test suite"
npm test

echo "==> Committing and pushing"
git add \
  app-server.mjs \
  src/feed-ranking.mjs \
  src/live-card-market.mjs \
  src/event-holder-ledger.mjs \
  tests/feed-ranking.mjs \
  tests/live-market-truth.mjs

if git diff --cached --quiet; then
  echo "No changes to commit."
else
  git commit -m "Fix live token ranking, stale score and market truth"
  git push
fi

echo
echo "DONE."
echo "WATCH/WAITING now rank by current live quality."
echo "WAITING no longer displays a forced 0 score."
echo "Stale stored market cap is not resurrected on the live card."
echo "Fresh Pump holder reference is preferred; event-ledger count is marked as an observed lower bound."
