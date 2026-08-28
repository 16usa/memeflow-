#!/usr/bin/env bash
set -Eeuo pipefail

echo "[MEMEFLOW] Realtime card data repair v14"

ROOT="${HOME}/workspace"
if [[ ! -d "$ROOT/.git" ]]; then
  ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
fi

if [[ -z "${ROOT:-}" || ! -d "$ROOT/.git" ]]; then
  echo "ERROR: Git repository not found." >&2
  exit 1
fi

cd "$ROOT"

PATCH_FILES=(
  "memeflow-app/app-server.mjs"
  "memeflow-app/system-tokens.js"
  "memeflow-app/system-tokens.html"
  "memeflow-app/tests/realtime-update-path.mjs"
)

for f in "${PATCH_FILES[@]}"; do
  if [[ ! -f "$f" ]]; then
    echo "ERROR: required file missing: $f" >&2
    exit 1
  fi
done

# Work only from a clean origin/main copy. Existing Replit M / D / ?? files
# never participate in patching or tests.
echo "[git] fetch origin/main"
git fetch origin main

TMP="$(mktemp -d /tmp/memeflow-v14-XXXXXX)"

cleanup() {
  code=$?
  set +e
  cd "$ROOT" 2>/dev/null || true
  git worktree remove --force "$TMP" >/dev/null 2>&1 || true
  rm -rf "$TMP" >/dev/null 2>&1 || true
  if [[ $code -ne 0 ]]; then
    echo
    echo "[FAILED] v14 made no commit/push."
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

ROOT = Path.cwd()
APP = ROOT / "memeflow-app"

def load(rel):
    return (APP / rel).read_text()

def save(rel, text):
    (APP / rel).write_text(text)

def replace_once(text, old, new, marker, label):
    if marker in text:
        print(f"[skip] {label}: already installed")
        return text
    count = text.count(old)
    if count != 1:
        raise SystemExit(
            f"[error] {label}: expected exactly 1 source match, found {count}"
        )
    print(f"[apply] {label}")
    return text.replace(old, new, 1)

def insert_before(text, anchor, insertion, marker, label):
    if marker in text:
        print(f"[skip] {label}: already installed")
        return text
    i = text.find(anchor)
    if i < 0:
        raise SystemExit(f"[error] {label}: anchor not found")
    print(f"[apply] {label}")
    return text[:i] + insertion + text[i:]

def replace_between(text, start, end, replacement, marker, label):
    if marker in text:
        print(f"[skip] {label}: already installed")
        return text
    i = text.find(start)
    if i < 0:
        raise SystemExit(f"[error] {label}: start anchor not found")
    j = text.find(end, i + len(start))
    if j < 0:
        raise SystemExit(f"[error] {label}: end anchor not found")
    print(f"[apply] {label}")
    return text[:i] + replacement + text[j:]


# ===========================================================================
# BACKEND
# ===========================================================================
app = load("app-server.mjs")

# ---------------------------------------------------------------------------
# 1) Decision changes need their OWN revision/event.
#
# Current flow publishes the token immediately after holder/market mutation,
# while evaluateAll() finishes asynchronously. The browser can therefore fetch
# the new market snapshot while still receiving the OLD score/state and there
# is no guaranteed later invalidation.
#
# Coalesce all per-user decisions for the same mint into one decision event.
# ---------------------------------------------------------------------------
revision_anchor = """const __mfYieldToEventLoop=()=>new Promise(resolve=>setImmediate(resolve));

function candidateView(d){"""

revision_insert = """const __mfYieldToEventLoop=()=>new Promise(resolve=>setImmediate(resolve));

// MEMEFLOW_DECISION_REVISION_EVENT_V14
// Token market mutation and per-user decision completion are separate moments.
// One mint-level decision event is emitted after the decision write(s), so a
// realtime card can never stop on a pre-evaluation score/state snapshot.
const __mfDecisionRefreshTimersV14=new Map();

function __mfEmitDecisionRefreshV14(mint){
  mint=String(mint||'').trim();
  if(!mint)return;

  const revision=++__mfLiveTokenRevision;

  try{
    __systemViewEmitV31(
      'decision',
      {
        mint,
        revision,
        updatedAt:Date.now()
      }
    );
  }catch{}
}

function __mfQueueDecisionRefreshV14(mint){
  mint=String(mint||'').trim();
  if(!mint||__mfDecisionRefreshTimersV14.has(mint))return;

  const timer=setTimeout(()=>{
    __mfDecisionRefreshTimersV14.delete(mint);
    __mfEmitDecisionRefreshV14(mint);
  },25);

  timer.unref?.();
  __mfDecisionRefreshTimersV14.set(mint,timer);
}

function candidateView(d){"""

app = replace_once(
    app,
    revision_anchor,
    revision_insert,
    "MEMEFLOW_DECISION_REVISION_EVENT_V14",
    "decision revision/event transport"
)


# ---------------------------------------------------------------------------
# 2) One canonical JSON-safe builder for the lightweight per-mint endpoint.
# It reads the SAME canonical token + real 5m Pump TradeEvent window as cards.
# ---------------------------------------------------------------------------
card_helper = r"""
// MEMEFLOW_SINGLE_TOKEN_LIVE_VIEW_V14
function __mfLiveDecisionForUserV14(uid,token,settingsOverride=null){
  const mint=String(token?.mint||'').trim();
  if(!mint)return null;

  const settings=
    settingsOverride && typeof settingsOverride==='object'
      ? settingsOverride
      : (store.settings(uid)||{});

  const admission=__mfEntryAdmissionForUser(
    token,
    uid,
    settings
  );

  const eligible=admission?.admitted===true;
  const isOpen=__mfOpenPositionMints().has(mint);
  const admissionState=String(
    admission?.state || (eligible?'ADMITTED':'PENDING')
  ).trim().toUpperCase();

  let decision=null;

  if(!eligible&&!isOpen){
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

    decision={
      state:blocked?'BLOCKED':'WAITING',
      score:0,
      confidence:0,
      primaryReason:reasons[0]||fallbackReason,
      reasons:reasons.length?reasons:[fallbackReason],
      terminal:false
    };
  }else{
    decision=store.state.decisions?.[uid+':'+mint]||null;

    if(!decision){
      try{
        decision=evaluate(token,settings);
      }catch{
        decision={
          state:'WAITING',
          score:0,
          confidence:0,
          primaryReason:'Scanner data is still being collected',
          reasons:['Scanner data is still being collected'],
          terminal:false
        };
      }
    }
  }

  return {
    ...decision,
    mint,
    tradeEligible:eligible,
    displayOnly:!eligible&&!isOpen,
    openPositionOverride:isOpen&&!eligible,
    entryAdmissionState:admissionState,
    entryAdmissionReasons:
      Array.isArray(admission?.reasons)
        ? admission.reasons.filter(x=>typeof x==='string').slice(0,20)
        : []
  };
}

function __mfLiveCardViewV14(token,decision){
  const t=token||{};
  const mint=String(t?.mint||decision?.mint||'').trim();
  if(!mint)return null;

  const finite=v=>{
    if(v===null||v===undefined||v==='')return null;
    const n=Number(v);
    return Number.isFinite(n)?n:null;
  };

  let market5m=null;
  try{
    market5m=__mfCandidateMarket5mV4(mint,t);
  }catch{
    market5m=null;
  }

  let ageMinutes=null;
  try{
    const age=tokenAgeMinutes(t);
    ageMinutes=Number.isFinite(Number(age))?Number(age):null;
  }catch{}

  const marketCapSol=
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
    finite(t?.holderCount??t?.holders);

  const top10Pct=
    finite(t?.top10Pct??t?.top10);

  const developerPct=
    finite(t?.developerPct??t?.developerSharePct);

  const buyPressure=
    finite(t?.buyPressure??t?.momentum);

  const priceSol=
    finite(t?.priceSol??t?.price);

  const liquiditySol=
    finite(t?.liquiditySol??t?.liquidity);

  const volume5mSol=
    finite(market5m?.volume5mSol??t?.volume5mSol);

  const volume5mUsd=
    finite(market5m?.volume5mUsd??t?.volume5mUsd);

  const transactions5m=
    finite(market5m?.transactions5m??t?.transactions5m);

  const priceChange5mPct=
    finite(market5m?.priceChange5mPct??t?.priceChange5mPct);

  return {
    id:mint,
    mint,
    tokenMint:mint,
    tokenAddress:mint,

    name:
      t?.name ||
      t?.metadataName ||
      t?.symbol ||
      mint.slice(0,6),
    symbol:t?.symbol||t?.metadataSymbol||'TOKEN',

    launchPlatform:t?.launchPlatform||t?.protocol||'pump',
    protocol:t?.protocol||t?.launchPlatform||'pump',
    source:t?.source||null,

    uri:t?.uri||t?.metadataUrl||null,
    metadataUri:t?.metadataUrl||t?.uri||null,
    imageUrl:t?.imageUrl||t?.image||t?.logoUrl||null,
    image:t?.imageUrl||t?.image||t?.logoUrl||null,
    logoUrl:t?.logoUrl||t?.imageUrl||t?.image||null,

    state:String(decision?.state||'WAITING'),
    score:finite(decision?.score),
    confidence:finite(decision?.confidence),
    primaryReason:
      typeof decision?.primaryReason==='string'
        ? decision.primaryReason
        : null,
    reasons:
      Array.isArray(decision?.reasons)
        ? decision.reasons.filter(x=>typeof x==='string').slice(0,20)
        : [],

    tradeEligible:decision?.tradeEligible===true,
    displayOnly:decision?.displayOnly===true,
    openPositionOverride:decision?.openPositionOverride===true,
    entryAdmissionState:
      String(decision?.entryAdmissionState||'PENDING'),
    entryAdmissionReasons:
      Array.isArray(decision?.entryAdmissionReasons)
        ? decision.entryAdmissionReasons
            .filter(x=>typeof x==='string')
            .slice(0,20)
        : [],

    data:
      Number.isFinite(Number(t?.dataQuality))
        ? Math.round(Number(t.dataQuality)*100)
        : null,

    price:priceSol,
    priceSol,
    liquidity:liquiditySol,
    liquiditySol,
    liquidityUsd:finite(t?.liquidityUsd),

    marketCap:marketCapUsd,
    marketCapSol,
    marketCapUsd,
    marketCapSource:market5m?.marketCapSource||null,
    marketCapUpdatedAt:
      finite(market5m?.marketUpdatedAt??t?.marketCapUpdatedAt),

    holders:holderCount,
    holderCount,
    holderSource:t?.holderSource||t?.eventLedgerVersion||'ws-event-ledger',
    holderFresh:t?.holderFresh===true,
    top10:top10Pct,
    top10Pct,
    developer:developerPct,
    developerPct,
    developerSharePct:developerPct,
    buyPressure,
    momentum:buyPressure,

    ageMinutes,
    volume5mSol,
    volume5mUsd,
    transactions5m,
    priceChange5mPct,

    qualityScore:finite(t?.qualityScore),
    opportunityScore:finite(t?.opportunityScore),
    opportunityEvidenceReady:t?.opportunityEvidenceReady===true,
    opportunityTrendHealthy:t?.opportunityTrendHealthy===true,
    uniqueBuyers:finite(t?.uniqueBuyers),
    netFlowSol:finite(t?.netFlowSol),
    recentNetFlowSol:finite(t?.recentNetFlowSol),
    priceMomentumPct:finite(t?.priceMomentumPct),
    drawdownFromPeakPct:finite(t?.drawdownFromPeakPct),
    whaleDominancePct:finite(t?.whaleDominancePct),

    dead:t?.dead===true,
    deadReason:
      typeof t?.deadReason==='string'
        ? t.deadReason
        : null,

    riskApproved:
      decision?.preOpenRiskVerified===true ||
      (
        decision?.state==='BUY READY' &&
        decision?.walletRiskPending===false
      ),
    walletRiskPending:decision?.walletRiskPending===true,
    preOpenRiskStatus:t?.preOpenRiskStatus||null,
    routeApproved:priceSol!==null,

    quoteAgeMs:
      t?.lastPriceAt
        ? Math.max(0,Date.now()-Number(t.lastPriceAt))
        : null,

    tokenUpdatedAt:finite(t?.updatedAt),
    decisionUpdatedAt:
      finite(decision?.updatedAt??decision?.reevaluatedAt),
    snapshotAt:Date.now()
  };
}

"""

app = insert_before(
    app,
    "// MEMEFLOW_STRICT_ENTRY_ADMISSION_V1",
    card_helper,
    "MEMEFLOW_SINGLE_TOKEN_LIVE_VIEW_V14",
    "single-token canonical card builder"
)


# ---------------------------------------------------------------------------
# 3) Admission transitions must also invalidate a card even when no decision is
# created (ADMITTED -> PENDING/REJECTED).
# ---------------------------------------------------------------------------
admission_old = """function __mfLiveEvalAdmissionCheck(token,settings,uid){
  const admission=__mfEntryAdmissionForUser(token,uid,settings);
  const key=String(uid||'')+':'+String(token?.mint||'');

  if(uid&&token?.mint){
    __mfEntryAdmissionState.set(key,admission?.admitted===true);
  }

  return admission;
}"""

admission_new = """function __mfLiveEvalAdmissionCheck(token,settings,uid){
  const admission=__mfEntryAdmissionForUser(token,uid,settings);
  const key=String(uid||'')+':'+String(token?.mint||'');

  if(uid&&token?.mint){
    const previous=__mfEntryAdmissionState.get(key);
    const admitted=admission?.admitted===true;

    __mfEntryAdmissionState.set(key,admitted);

    // MEMEFLOW_ADMISSION_REVISION_EVENT_V14
    if(previous!==undefined&&previous!==admitted){
      __mfQueueDecisionRefreshV14(token.mint);
    }
  }

  return admission;
}"""

app = replace_once(
    app,
    admission_old,
    admission_new,
    "MEMEFLOW_ADMISSION_REVISION_EVENT_V14",
    "admission transition card invalidation"
)


# ---------------------------------------------------------------------------
# 4) Once liveeval has actually written the new decision, queue one mint-level
# decision event. This is coalesced across all active users.
# ---------------------------------------------------------------------------
ondecision_old = """  onDecision:(uid,token,decision)=>{
    void __mfHandleDecision(uid,token,decision).catch(()=>{});
  }
});"""

ondecision_new = """  onDecision:(uid,token,decision)=>{
    void __mfHandleDecision(uid,token,decision).catch(()=>{});

    // MEMEFLOW_DECISION_COMPLETE_REFRESH_V14
    __mfQueueDecisionRefreshV14(token?.mint);
  }
});"""

app = replace_once(
    app,
    ondecision_old,
    ondecision_new,
    "MEMEFLOW_DECISION_COMPLETE_REFRESH_V14",
    "decision-complete realtime refresh"
)


# ---------------------------------------------------------------------------
# 5) Age/settings sweep demotion clears a decision. Emit a decision revision.
# ---------------------------------------------------------------------------
sweep_old = """        }else if(!admitted&&previous===true){
          __mfClearDecisionForUserMint(row.uid,token.mint);
        }

        __mfEntryAdmissionState.set(key,admitted);"""

sweep_new = """        }else if(!admitted&&previous===true){
          __mfClearDecisionForUserMint(row.uid,token.mint);

          // MEMEFLOW_SWEEP_DECISION_REFRESH_V14
          __mfQueueDecisionRefreshV14(token.mint);
        }

        __mfEntryAdmissionState.set(key,admitted);"""

app = replace_once(
    app,
    sweep_old,
    sweep_new,
    "MEMEFLOW_SWEEP_DECISION_REFRESH_V14",
    "sweep demotion realtime refresh"
)


# ---------------------------------------------------------------------------
# 6) Add a lightweight, user-aware, one-mint endpoint.
# Every token TradeEvent can now refresh ONE card instead of rebuilding the
# 800-token working set. Full snapshots remain for structure/reconciliation.
# ---------------------------------------------------------------------------
single_route = r"""
 // MEMEFLOW_SINGLE_TOKEN_LIVE_ROUTE_V14
 if(url.pathname==='/api/system/live-token-state'&&req.method==='GET'){
  const mint=String(url.searchParams.get('mint')||'').trim();

  if(!mint){
    return json(res,400,{error:'MINT_REQUIRED'});
  }

  const token=store.state.tokens?.[mint]||null;
  const isOpen=__mfOpenPositionMints().has(mint);

  if(
    !token ||
    (
      !isOpen &&
      __mfIsCurrentScannerToken(token)!==true
    )
  ){
    return json(res,404,{
      error:'TOKEN_NOT_IN_LIVE_STATE',
      mint,
      liveRevision:__mfLiveTokenRevision
    });
  }

  const settings=store.settings(u.id);
  const decision=__mfLiveDecisionForUserV14(
    u.id,
    token,
    settings
  );

  const row=__mfLiveCardViewV14(
    token,
    decision
  );

  if(!row){
    return json(res,404,{
      error:'TOKEN_VIEW_UNAVAILABLE',
      mint,
      liveRevision:__mfLiveTokenRevision
    });
  }

  return json(res,200,{
    row,
    mint,
    liveRevision:__mfLiveTokenRevision,
    source:'single-token-live-v14'
  });
 }

"""

app = insert_before(
    app,
    "  // MEMEFLOW_LIVE_TOKEN_STATES_V7",
    single_route,
    "MEMEFLOW_SINGLE_TOKEN_LIVE_ROUTE_V14",
    "single-token live endpoint"
)


# ---------------------------------------------------------------------------
# 7) Expose global revision in full snapshots too.
# ---------------------------------------------------------------------------
payload_old = """    decisions:_views,
    total:_rankedViews.length,
    returned:_views.length,
    limit:_limit,

    // Keep old source value because regression/history tooling uses it."""

payload_new = """    decisions:_views,
    total:_rankedViews.length,
    returned:_views.length,
    limit:_limit,
    liveRevision:__mfLiveTokenRevision,

    // MEMEFLOW_FULL_SNAPSHOT_REVISION_V14
    // Keep old source value because regression/history tooling uses it."""

app = replace_once(
    app,
    payload_old,
    payload_new,
    "MEMEFLOW_FULL_SNAPSHOT_REVISION_V14",
    "full snapshot revision"
)

save("app-server.mjs", app)


# ===========================================================================
# FRONTEND
# ===========================================================================
ui = load("system-tokens.js")

# ---------------------------------------------------------------------------
# 8) Full snapshot tells client which global revision it represents.
# ---------------------------------------------------------------------------
payload_capture_old = """    const payload = await response.json();
    const rows = Array.isArray(payload?.decisions)
      ? payload.decisions
      : [];
"""

payload_capture_new = """    const payload = await response.json();

    // MEMEFLOW_FULL_SNAPSHOT_REVISION_CLIENT_V14
    const snapshotRevision=Number(payload?.liveRevision||0);
    if(
      Number.isFinite(snapshotRevision) &&
      snapshotRevision>__mfLastRealtimeRevision
    ){
      __mfLastRealtimeRevision=snapshotRevision;
    }

    const rows = Array.isArray(payload?.decisions)
      ? payload.decisions
      : [];
"""

ui = replace_once(
    ui,
    payload_capture_old,
    payload_capture_new,
    "MEMEFLOW_FULL_SNAPSHOT_REVISION_CLIENT_V14",
    "client full-snapshot revision"
)


# ---------------------------------------------------------------------------
# 9) Replace full-snapshot-on-every-token architecture with:
#
# TOKEN    -> one-mint endpoint (market, holders, 5m metrics, metadata)
# DECISION -> one-mint endpoint (state/score/reasons after evaluation completed)
# CREATE   -> structural full snapshot
# REMOVE   -> local remove + reconciliation
# fallback -> 3s only while SSE disconnected
# healthy  -> one full reconciliation every 30s
#
# This is faster AND more immediate.
# ---------------------------------------------------------------------------
rt_start = "/* MEMEFLOW_SYSTEM_TOKENS_REALTIME_V1"
rt_end = "/* ===== LIVE TOKEN METADATA V16 ===== */"

new_rt = r"""/* MEMEFLOW_SYSTEM_TOKENS_REALTIME_V14
 * Realtime card architecture:
 *
 * TOKEN mutation:
 *   refresh exactly ONE known card through /api/system/live-token-state.
 *
 * DECISION completion:
 *   refresh that same card after evaluateAll() actually wrote its new
 *   state/score/reasons.
 *
 * CREATE/unknown promotion:
 *   coalesced full snapshot for feed membership/ranking.
 *
 * The old behavior rebuilt an ~800-token working set on every global Pump
 * TradeEvent. V14 removes that unnecessary work while making visible card
 * fields react faster.
 */
const LIVE_RECONCILE_MS_V14 = 30000;
const MINT_REFRESH_COALESCE_MS_V14 = 80;
const POSITION_REFRESH_COALESCE_MS_V14 = 120;

let __mfTokenStateStream = null;
let __mfRealtimeRefreshTimer = null;
let __mfLastRealtimeRevision = 0;
let __mfOpenPositionRefreshTimerV14 = null;

const __mfMintRefreshV14 = new Map();

function __mfReadRealtimeEventV14(event) {
  let payload = {};

  if (event?.data) {
    try {
      payload = JSON.parse(event.data) || {};
    } catch {}
  }

  const revision = Number(payload?.revision || 0);

  if (
    Number.isFinite(revision) &&
    revision > 0
  ) {
    if (revision <= __mfLastRealtimeRevision) {
      return { payload, stale: true };
    }

    __mfLastRealtimeRevision = revision;
  }

  return { payload, stale: false };
}

function __mfScheduleFullSnapshotV14() {
  if (__mfRealtimeRefreshTimer !== null) {
    return;
  }

  __mfRealtimeRefreshTimer = setTimeout(() => {
    __mfRealtimeRefreshTimer = null;
    void loadTokens();
  }, 250);
}

function __mfKnownScannerRowV14(mint) {
  mint = String(mint || '');

  return state.rows.some(
    row => String(row?.mint || '') === mint
  );
}

function __mfKnownOpenPositionV14(mint) {
  mint = String(mint || '');

  return state.positions.some(
    position =>
      String(position?.mint || '') === mint &&
      String(position?.status || '').toUpperCase() === 'OPEN'
  );
}

function __mfReplaceScannerRowV14(row) {
  const mint = String(row?.mint || '').trim();
  if (!mint) return false;

  const index = state.rows.findIndex(
    item => String(item?.mint || '') === mint
  );

  if (index < 0) {
    return false;
  }

  state.rows[index] =
    canonicalDecisionRow(row);

  return true;
}

async function __mfRefreshMintNowV14(mint) {
  mint = String(mint || '').trim();
  if (!mint) return;

  let slot = __mfMintRefreshV14.get(mint);

  if (!slot) {
    slot = {
      timer: null,
      inflight: false,
      pending: false
    };
    __mfMintRefreshV14.set(mint, slot);
  }

  if (slot.inflight) {
    slot.pending = true;
    return;
  }

  slot.inflight = true;

  try {
    do {
      slot.pending = false;

      const response = await fetch(
        '/api/system/live-token-state?mint=' +
          encodeURIComponent(mint) +
          '&_=' +
          Date.now(),
        {
          cache: 'no-store',
          credentials: 'same-origin'
        }
      );

      if (response.status === 404) {
        // Membership may have changed. Do not keep a stale row forever.
        __mfScheduleFullSnapshotV14();
        return;
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const payload = await response.json();

      const revision =
        Number(payload?.liveRevision || 0);

      if (
        Number.isFinite(revision) &&
        revision > __mfLastRealtimeRevision
      ) {
        __mfLastRealtimeRevision = revision;
      }

      const row = payload?.row;

      if (!row?.mint) {
        continue;
      }

      const replaced =
        __mfReplaceScannerRowV14(row);

      if (!replaced) {
        // A promoted token may now belong in the ranked top-200.
        __mfScheduleFullSnapshotV14();
        return;
      }

      render();
    } while (slot.pending);
  } catch (error) {
    console.warn(
      '[token-flow] one-mint refresh failed',
      mint,
      error
    );
  } finally {
    slot.inflight = false;

    if (
      !slot.pending &&
      slot.timer === null
    ) {
      __mfMintRefreshV14.delete(mint);
    }
  }
}

function __mfScheduleMintRefreshV14(mint) {
  mint = String(mint || '').trim();
  if (!mint) return;

  let slot = __mfMintRefreshV14.get(mint);

  if (!slot) {
    slot = {
      timer: null,
      inflight: false,
      pending: false
    };
    __mfMintRefreshV14.set(mint, slot);
  }

  if (slot.timer !== null) {
    return;
  }

  slot.timer = setTimeout(() => {
    slot.timer = null;
    void __mfRefreshMintNowV14(mint);
  }, MINT_REFRESH_COALESCE_MS_V14);
}

function __mfScheduleOpenPositionRefreshV14() {
  if (__mfOpenPositionRefreshTimerV14 !== null) {
    return;
  }

  __mfOpenPositionRefreshTimerV14 = setTimeout(async () => {
    __mfOpenPositionRefreshTimerV14 = null;

    try {
      const response = await fetch(
        '/api/paper/positions?_=' + Date.now(),
        {
          cache: 'no-store',
          credentials: 'same-origin'
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const payload = await response.json();

      state.positions =
        (
          Array.isArray(payload?.positions)
            ? payload.positions
            : []
        ).filter(
          position =>
            position?.mint &&
            String(position?.status || '').toUpperCase() === 'OPEN'
        );

      render();
    } catch (error) {
      console.warn(
        '[token-flow] open-position realtime refresh failed',
        error
      );
    }
  }, POSITION_REFRESH_COALESCE_MS_V14);
}

function __mfHandleTokenEventV14(event) {
  const { payload, stale } =
    __mfReadRealtimeEventV14(event);

  if (stale) return;

  const mint =
    String(payload?.mint || '').trim();

  if (!mint) return;

  // Market/holder/volume/tx/MC/5m data for known feed rows.
  if (__mfKnownScannerRowV14(mint)) {
    __mfScheduleMintRefreshV14(mint);
  }

  // P&L + market strip for OPEN POSITION cards.
  if (__mfKnownOpenPositionV14(mint)) {
    __mfScheduleOpenPositionRefreshV14();
  }

  // Intentionally do NOT full-refresh for every unknown global Pump trade.
  // If it becomes decision-relevant, the decision event below reconciles it.
}

function __mfHandleDecisionEventV14(event) {
  const { payload, stale } =
    __mfReadRealtimeEventV14(event);

  if (stale) return;

  const mint =
    String(payload?.mint || '').trim();

  if (!mint) {
    __mfScheduleFullSnapshotV14();
    return;
  }

  if (__mfKnownScannerRowV14(mint)) {
    __mfScheduleMintRefreshV14(mint);
  } else {
    // Promotion/ranking may pull a previously unreturned token into top-200.
    __mfScheduleFullSnapshotV14();
  }

  if (__mfKnownOpenPositionV14(mint)) {
    __mfScheduleOpenPositionRefreshV14();
  }
}

function __mfHandleCreateEventV14() {
  // CREATE changes feed membership. One bounded snapshot is appropriate.
  __mfScheduleFullSnapshotV14();
}

function __mfHandleRemovedEventV14(event) {
  const { payload } =
    __mfReadRealtimeEventV14(event);

  const mint =
    String(payload?.mint || '').trim();

  if (!mint) {
    __mfScheduleFullSnapshotV14();
    return;
  }

  const before = state.rows.length;

  state.rows =
    state.rows.filter(
      row => String(row?.mint || '') !== mint
    );

  if (state.rows.length !== before) {
    render();
  }

  __mfScheduleFullSnapshotV14();
}

function __mfConnectTokenStateStream() {
  if (typeof EventSource === 'undefined') return;

  try {
    __mfTokenStateStream?.close?.();
  } catch {}

  const source =
    new EventSource('/api/system/stream');

  __mfTokenStateStream = source;

  source.addEventListener(
    'hello',
    __mfScheduleFullSnapshotV14
  );

  source.addEventListener(
    'create',
    __mfHandleCreateEventV14
  );

  source.addEventListener(
    'token',
    __mfHandleTokenEventV14
  );

  source.addEventListener(
    'decision',
    __mfHandleDecisionEventV14
  );

  source.addEventListener(
    'token_removed',
    __mfHandleRemovedEventV14
  );

  source.onopen = () => {
    __mfScheduleFullSnapshotV14();
  };
}

__mfConnectTokenStateStream();

// Disconnected-stream safety net: preserve the existing 3s behavior only when
// SSE is unavailable. No wasteful 3s polling while realtime transport is live.
setInterval(() => {
  if (
    !__mfTokenStateStream ||
    typeof EventSource === 'undefined' ||
    __mfTokenStateStream.readyState !== EventSource.OPEN
  ) {
    void loadTokens();
  }
}, REFRESH_MS);

// Low-frequency structural/time-window reconciliation while SSE is healthy.
// This updates age/5m-window decay even when a specific token receives no new
// TradeEvent. It is deliberately 30s, not 3s.
setInterval(() => {
  if (
    __mfTokenStateStream &&
    typeof EventSource !== 'undefined' &&
    __mfTokenStateStream.readyState === EventSource.OPEN
  ) {
    void loadTokens();
  }
}, LIVE_RECONCILE_MS_V14);

document.addEventListener(
  'visibilitychange',
  () => {
    if (!document.hidden) {
      __mfScheduleFullSnapshotV14();
    }
  }
);

window.addEventListener(
  'beforeunload',
  () => {
    if (__mfRealtimeRefreshTimer !== null) {
      clearTimeout(__mfRealtimeRefreshTimer);
    }

    if (__mfOpenPositionRefreshTimerV14 !== null) {
      clearTimeout(__mfOpenPositionRefreshTimerV14);
    }

    for (const slot of __mfMintRefreshV14.values()) {
      if (slot?.timer !== null) {
        clearTimeout(slot.timer);
      }
    }

    try {
      __mfTokenStateStream?.close?.();
    } catch {}
  },
  { once: true }
);



"""

ui = replace_between(
    ui,
    rt_start,
    rt_end,
    new_rt,
    "MEMEFLOW_SYSTEM_TOKENS_REALTIME_V14",
    "per-card realtime frontend"
)

save("system-tokens.js", ui)


# ===========================================================================
# CACHE BUSTER
# ===========================================================================
html = load("system-tokens.html")

if "realtime-card-v14-20260827" not in html:
    html2, count = re.subn(
        r'(/system-tokens\.js\?v=)[^"\']+',
        r'\1realtime-card-v14-20260827',
        html,
        count=1
    )

    if count != 1:
        raise SystemExit(
            f"[error] system-tokens cache-buster: expected 1 URL, found {count}"
        )

    html = html2
    print("[apply] system-tokens v14 cache-buster")
else:
    print("[skip] system-tokens v14 cache-buster")

save("system-tokens.html", html)


# ===========================================================================
# REGRESSION TEST
# ===========================================================================
test = load("tests/realtime-update-path.mjs")

old_asserts = """assert.match(tokenUi,/new EventSource\\('\\/api\\/system\\/stream'\\)/);
assert.match(tokenUi,/source\\.addEventListener\\('token', __mfScheduleRealtimeRefresh\\)/);
assert.match(tokenUi,/state\\.refreshPending = true;/);
assert.match(tokenUi,/queueMicrotask\\(loadTokens\\)/);
assert.match(tokenUi,/readyState !== EventSource\\.OPEN/);
"""

new_asserts = """assert.match(tokenUi,/new EventSource\\('\\/api\\/system\\/stream'\\)/);

// MEMEFLOW_REALTIME_CARD_DELTA_TEST_V14
assert.match(app,/MEMEFLOW_DECISION_REVISION_EVENT_V14/);
assert.match(app,/MEMEFLOW_DECISION_COMPLETE_REFRESH_V14/);
assert.match(app,/MEMEFLOW_ADMISSION_REVISION_EVENT_V14/);
assert.match(app,/MEMEFLOW_SINGLE_TOKEN_LIVE_ROUTE_V14/);
assert.match(app,/\\/api\\/system\\/live-token-state/);
assert.match(app,/liveRevision:__mfLiveTokenRevision/);
assert.match(tokenUi,/MEMEFLOW_SYSTEM_TOKENS_REALTIME_V14/);
assert.match(tokenUi,/__mfScheduleMintRefreshV14/);
assert.match(tokenUi,/__mfHandleTokenEventV14/);
assert.match(tokenUi,/__mfHandleDecisionEventV14/);
assert.match(tokenUi,/source\\.addEventListener\\([\\s\\S]*?'token',[\\s\\S]*?__mfHandleTokenEventV14/);
assert.match(tokenUi,/source\\.addEventListener\\([\\s\\S]*?'decision',[\\s\\S]*?__mfHandleDecisionEventV14/);
assert.match(tokenUi,/\\/api\\/system\\/live-token-state\\?mint=/);
assert.match(tokenUi,/LIVE_RECONCILE_MS_V14 = 30000/);
assert.match(tokenUi,/state\\.refreshPending = true;/);
assert.match(tokenUi,/queueMicrotask\\(loadTokens\\)/);
assert.match(tokenUi,/readyState !== EventSource\\.OPEN/);
"""

test = replace_once(
    test,
    old_asserts,
    new_asserts,
    "MEMEFLOW_REALTIME_CARD_DELTA_TEST_V14",
    "realtime per-card regression assertions"
)

old_cache = """assert.match(tokenHtml,/system-tokens\\.js\\?v=live-token-feed-v13-20260827/);"""
new_cache = """assert.match(tokenHtml,/system-tokens\\.js\\?v=realtime-card-v14-20260827/);"""

if old_cache in test:
    test = test.replace(old_cache,new_cache,1)
    print("[apply] realtime v14 cache-buster assertion")
elif new_cache in test:
    print("[skip] realtime v14 cache-buster assertion")
else:
    raise SystemExit("[error] current system-tokens cache-buster assertion not found")

# The old coalesce marker belonged to full-snapshot-on-every-token.
old_marker = """assert.match(tokenUi,/MEMEFLOW_REALTIME_COALESCE_250MS_V1/);"""
new_marker = """assert.match(tokenUi,/MINT_REFRESH_COALESCE_MS_V14 = 80/);"""
if old_marker in test:
    test = test.replace(old_marker,new_marker,1)
    print("[apply] realtime coalescing assertion -> per-mint v14")
elif new_marker in test:
    print("[skip] realtime coalescing assertion -> per-mint v14")
else:
    raise SystemExit("[error] realtime coalescing assertion not found")

save("tests/realtime-update-path.mjs", test)


# ===========================================================================
# INSTALL-TIME INVARIANTS
# ===========================================================================
app = load("app-server.mjs")
ui = load("system-tokens.js")
html = load("system-tokens.html")

for needle in [
    "MEMEFLOW_DECISION_REVISION_EVENT_V14",
    "MEMEFLOW_SINGLE_TOKEN_LIVE_VIEW_V14",
    "MEMEFLOW_ADMISSION_REVISION_EVENT_V14",
    "MEMEFLOW_DECISION_COMPLETE_REFRESH_V14",
    "MEMEFLOW_SINGLE_TOKEN_LIVE_ROUTE_V14",
    "liveRevision:__mfLiveTokenRevision",
    "MEMEFLOW_LIVE_TOKEN_FEED_BRIDGE_V13",
]:
    if needle not in app:
        raise SystemExit(f"[verify] backend invariant missing: {needle}")

# V13 scanner/feed work must remain intact.
route_i=app.find("if(url.pathname==='/api/system/live-token-states'")
route_j=app.find("if(url.pathname==='/api/ai/decisions'",route_i)
if route_i<0 or route_j<0:
    raise SystemExit("[verify] full live-token-states route missing")
route=app[route_i:route_j]

for needle in [
    "MEMEFLOW_LIVE_TOKEN_FEED_BRIDGE_V13",
    "const _workingTokens=_rawTokens.slice(0,_workingLimit)",
    "rankCandidateViews(_unrankedViews)",
    "preAdmissionHidden:0",
]:
    if needle not in route:
        raise SystemExit(f"[verify] V13 invariant missing: {needle}")

# Trading feed remains strict and independent.
trade=app[route_j:route_j+8000]
if "__mfAdmittedScannerTokensForUser(u.id)" not in trade:
    raise SystemExit("[verify] trading admission gate disappeared")

for needle in [
    "MEMEFLOW_SYSTEM_TOKENS_REALTIME_V14",
    "__mfScheduleMintRefreshV14",
    "__mfHandleTokenEventV14",
    "__mfHandleDecisionEventV14",
    "/api/system/live-token-state?mint=",
    "LIVE_RECONCILE_MS_V14 = 30000",
]:
    if needle not in ui:
        raise SystemExit(f"[verify] frontend invariant missing: {needle}")

if "realtime-card-v14-20260827" not in html:
    raise SystemExit("[verify] v14 frontend cache-buster missing")

print("[verify] v13 feed + v14 realtime card invariants OK")
PY

cd "$TMP/memeflow-app"

echo "[check] syntax"
node --check app-server.mjs
node --check system-tokens.js

echo "[check] exact realtime tests FIRST"
node tests/realtime-update-path.mjs
node tests/live-market-truth.mjs
node tests/feed-ranking.mjs
node tests/fresh-session-scanner.mjs
node tests/ws-first-preopen-rpc.mjs
node tests/strict-entry-admission.mjs

echo "[check] FULL npm test"
npm test

echo "[check] performance benchmark"
npm run benchmark

cd "$TMP"

echo "[check] diff"
git diff --check
git diff --stat -- "${PATCH_FILES[@]}"

git add -- "${PATCH_FILES[@]}"

if git diff --cached --quiet; then
  echo "[git] v14 is already present on origin/main"
  NEW_SHA="$(git rev-parse HEAD)"
else
  git commit -m "fix: update every live token card field event-first"
  NEW_SHA="$(git rev-parse HEAD)"

  echo "[git] push verified commit -> main"
  git push origin HEAD:main
fi

echo "[git] verified commit: $NEW_SHA"

# ===========================================================================
# Sync verified files into active Replit workspace.
# Only files owned by this patch are backed up/restored. Unrelated dirty files
# are never touched.
# ===========================================================================
cd "$ROOT"

BACKUP_DIR="$ROOT/.memeflow-v14-recovery-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR"

for f in "${PATCH_FILES[@]}"; do
  if [[ -f "$f" ]]; then
    mkdir -p "$BACKUP_DIR/$(dirname "$f")"
    cp -p "$f" "$BACKUP_DIR/$f"
  fi
done

LOCAL_HEAD="$(git rev-parse HEAD)"

if git merge-base --is-ancestor "$LOCAL_HEAD" "$NEW_SHA" 2>/dev/null; then
  git restore --staged --worktree -- "${PATCH_FILES[@]}" 2>/dev/null || true

  if git merge --ff-only "$NEW_SHA"; then
    echo "[local] workspace fast-forwarded to verified v14"
  else
    echo "[local] fast-forward blocked; syncing only v14 files"
    git restore --source="$NEW_SHA" --worktree -- "${PATCH_FILES[@]}"
  fi
else
  echo "[local] local branch is not a clean ancestor; syncing only v14 files"
  git restore --source="$NEW_SHA" --worktree -- "${PATCH_FILES[@]}"
fi

echo "[local] recovery backup: $BACKUP_DIR"

echo
echo "DONE"
echo "- holder/price/MC/volume/tx/5m card data refreshes per mint"
echo "- decision state/score/reasons get a guaranteed post-evaluation event"
echo "- OPEN POSITION telemetry refreshes on that mint's live TradeEvent"
echo "- global Pump trades no longer rebuild the ~800-token UI working set"
echo "- CREATE/decision promotion still reconciles ranked feed membership"
echo "- SSE-disconnected 3s fallback remains"
echo "- healthy SSE full reconciliation is only every 30s"
echo "- full npm test AND benchmark passed before push"
echo
echo "IMPORTANT: do one Replit Stop -> Run after DONE because app-server.mjs"
echo "runs under plain 'node app-server.mjs'."
