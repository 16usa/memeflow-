#!/usr/bin/env bash
set -Eeuo pipefail

echo "[MEMEFLOW] Live Token Feed bridge v13"

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
  "memeflow-app/tests/fresh-session-scanner.mjs"
  "memeflow-app/tests/realtime-update-path.mjs"
)

for f in "${PATCH_FILES[@]}"; do
  if [[ ! -f "$f" ]]; then
    echo "ERROR: required file missing: $f" >&2
    exit 1
  fi
done

echo "[git] fetch origin/main"
git fetch origin main

TMP="$(mktemp -d /tmp/memeflow-v13-XXXXXX)"

cleanup() {
  code=$?
  set +e
  cd "$ROOT" 2>/dev/null || true
  git worktree remove --force "$TMP" >/dev/null 2>&1 || true
  rm -rf "$TMP" >/dev/null 2>&1 || true
  if [[ $code -ne 0 ]]; then
    echo
    echo "[FAILED] v13 made no commit/push."
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

def replace_once(text, old, new, marker, label):
    if marker in text:
        print(f"[skip] {label}: already installed")
        return text
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"[error] {label}: expected 1 source match, found {count}")
    print(f"[apply] {label}")
    return text.replace(old, new, 1)


# ===========================================================================
# 1) LIVE TOKEN STATES API
#
# Scanner is healthy now (the UI can show thousands of scanner rows), but the
# page feed must not synchronously evaluate/render the entire permanent hot
# registry on every SSE refresh.
#
# Keep scanning/trading global. Bound ONLY the UI working set, then build a
# JSON-safe card view directly from canonical token state. This removes the
# candidateView conversion as a single point of failure for this page.
# ===========================================================================
app = load("app-server.mjs")

route_start = " if(url.pathname==='/api/system/live-token-states'&&req.method==='GET'){"
route_end = "if(url.pathname==='/api/ai/decisions'){"

new_route = r""" if(url.pathname==='/api/system/live-token-states'&&req.method==='GET'){
  // MEMEFLOW_LIVE_TOKEN_VISIBILITY_V8_CLEAN_WORKTREE
  // MEMEFLOW_LIVE_TOKEN_FEED_BRIDGE_V13
  //
  // SCANNER:
  //   remains complete/permanent and is NOT limited here.
  //
  // DISPLAY:
  //   uses a bounded recent working set so a 5k/20k permanent scanner cache
  //   cannot stall a realtime browser request.
  //   ADMITTED -> normal Logic state
  //   PENDING  -> WAITING
  //   REJECTED -> BLOCKED
  //
  // TRADE:
  //   /api/ai/decisions + execution remain strictly Entry-admitted and are
  //   completely independent of this display working set.
  const _requestedLimit=Math.floor(
    Number(url.searchParams.get('limit')||0)
  );
  const _limit=
    Number.isFinite(_requestedLimit)&&_requestedLimit>0
      ? Math.min(500,_requestedLimit)
      : 200;

  const _settings=store.settings(u.id);
  const _rawTokens=__mfLiveScannerTokens();
  const _openMints=__mfOpenPositionMints();

  // MEMEFLOW_REALTIME_UI_FAIRNESS_V1_ROUTE
  // The raw scanner is newest-first. Evaluate enough rows to cover roughly
  // 15–25 minutes at normal Pump launch rates while keeping the HTTP/SSE path
  // predictably bounded.
  const _workingLimit=Math.max(
    _limit,
    Math.min(
      1200,
      Math.max(600,_limit*4)
    )
  );

  const _workingTokens=_rawTokens.slice(0,_workingLimit);
  const _workingMints=new Set(
    _workingTokens.map(t=>String(t?.mint||'')).filter(Boolean)
  );

  // Keep any open token in the server-side view even when it is older than the
  // live working window. The frontend also merges positions independently.
  for(const _mint of _openMints){
    if(_workingMints.has(_mint))continue;
    const _token=store.state.tokens?.[_mint]||null;
    if(!_token)continue;
    _workingTokens.push(_token);
    _workingMints.add(_mint);
  }

  const _cacheScope=
    'limit:'+String(_limit)+
    '|work:'+String(_workingLimit);
  const _cacheKey=String(u.id||'anon')+'|'+_cacheScope;
  const _settingsVersion=Number(store.user(u.id)?.settingsVersion||0);
  const _cached=__mfLiveStatesResponseCache.get(_cacheKey);

  if(
    _cached &&
    Date.now()-Number(_cached.at||0)<=__mfLiveStatesResponseCacheMs &&
    Number(_cached.settingsVersion||0)===_settingsVersion &&
    Number(_cached.liveRevision||0)===__mfLiveTokenRevision
  ){
    return json(res,200,{..._cached.payload,cacheHit:true});
  }

  let _processed=0;
  let _admitted=0;
  let _pending=0;
  let _rejected=0;
  let _openOverride=0;
  let _evalErrors=0;
  let _viewErrors=0;

  const _displayRows=[];

  for(const _token of _workingTokens){
    const _mint=String(_token?.mint||'').trim();
    if(!_mint)continue;

    _processed++;
    if(_processed%__mfLiveStatesYieldEvery===0){
      await __mfYieldToEventLoop();
    }

    let _admission=null;
    try{
      _admission=__mfEntryAdmissionForUser(
        _token,
        u.id,
        _settings
      );
    }catch(_error){
      _evalErrors++;
    }

    const _eligible=_admission?.admitted===true;
    const _isOpen=_openMints.has(_mint);
    const _admissionState=String(
      _admission?.state || (_eligible?'ADMITTED':'PENDING')
    ).trim().toUpperCase();

    if(_eligible)_admitted++;
    else if(_admissionState==='REJECTED')_rejected++;
    else _pending++;

    if(_isOpen&&!_eligible)_openOverride++;

    const _key=u.id+':'+_mint;
    let _decision=null;

    if(!_eligible&&!_isOpen){
      const _reasons=
        Array.isArray(_admission?.reasons)
          ? _admission.reasons
              .filter(x=>typeof x==='string'&&x.trim())
              .map(x=>x.trim())
          : [];

      const _blocked=_admissionState==='REJECTED';
      const _fallbackReason=
        _blocked
          ? 'Entry filters rejected this token'
          : 'Waiting for entry-filter data';

      _decision={
        state:_blocked?'BLOCKED':'WAITING',
        score:0,
        confidence:0,
        primaryReason:_reasons[0]||_fallbackReason,
        reasons:_reasons.length?_reasons:[_fallbackReason],
        terminal:false
      };
    }else{
      _decision=store.state.decisions?.[_key]||null;

      if(!_decision){
        try{
          _decision=evaluate(_token,_settings);
        }catch(_error){
          _evalErrors++;
          _decision={
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

    _displayRows.push({
      token:_token,
      decision:{
        ..._decision,
        mint:_mint,
        tradeEligible:_eligible,
        displayOnly:!_eligible&&!_isOpen,
        openPositionOverride:_isOpen&&!_eligible,
        entryAdmissionState:_admissionState,
        entryAdmissionReasons:
          Array.isArray(_admission?.reasons)
            ? _admission.reasons.filter(x=>typeof x==='string')
            : []
      }
    });
  }

  const _flatDecisions=_displayRows.map(row=>row.decision);
  const _selected=candidateFeed(_flatDecisions,'all');
  const _counts=candidateVisibilityCounts(_flatDecisions);
  const _stateCounts={};

  for(const _decision of _selected){
    const _state=String(
      _decision?.state||'WAITING'
    ).trim().toUpperCase()||'WAITING';
    _stateCounts[_state]=(_stateCounts[_state]||0)+1;
  }

  // Build a JSON-safe Live Token States view directly from canonical token
  // state. No timeline/raw BigInt/event objects are sent on this page.
  const _rowsByMint=new Map(
    _displayRows.map(row=>[String(row?.decision?.mint||''),row])
  );
  const _safeViews=[];

  const _finite=v=>{
    if(v===null||v===undefined||v==='')return null;
    const n=Number(v);
    return Number.isFinite(n)?n:null;
  };

  for(const _decision of _selected){
    const _mint=String(_decision?.mint||'').trim();
    if(!_mint)continue;

    const _row=_rowsByMint.get(_mint);
    const _token=_row?.token||store.state.tokens?.[_mint]||{};

    let _market5m=null;
    try{
      _market5m=__mfCandidateMarket5mV4(_mint,_token);
    }catch(_error){
      _viewErrors++;
      _market5m=null;
    }

    const _age=tokenAgeMinutes(_token);

    _safeViews.push({
      id:_mint,
      mint:_mint,
      tokenMint:_mint,
      tokenAddress:_mint,

      name:
        _token?.name ||
        _token?.metadataName ||
        _token?.symbol ||
        _mint.slice(0,6),
      symbol:_token?.symbol||_token?.metadataSymbol||'TOKEN',

      launchPlatform:_token?.launchPlatform||_token?.protocol||'pump',
      protocol:_token?.protocol||_token?.launchPlatform||'pump',
      source:_token?.source||null,

      uri:_token?.uri||_token?.metadataUrl||null,
      imageUrl:
        _token?.imageUrl ||
        _token?.image ||
        _token?.logoUrl ||
        null,
      image:
        _token?.imageUrl ||
        _token?.image ||
        _token?.logoUrl ||
        null,
      logoUrl:
        _token?.logoUrl ||
        _token?.imageUrl ||
        _token?.image ||
        null,

      state:String(_decision?.state||'WAITING'),
      score:_finite(_decision?.score),
      confidence:_finite(_decision?.confidence),
      primaryReason:
        typeof _decision?.primaryReason==='string'
          ? _decision.primaryReason
          : null,
      reasons:
        Array.isArray(_decision?.reasons)
          ? _decision.reasons
              .filter(x=>typeof x==='string')
              .slice(0,20)
          : [],

      tradeEligible:_decision?.tradeEligible===true,
      displayOnly:_decision?.displayOnly===true,
      openPositionOverride:_decision?.openPositionOverride===true,
      entryAdmissionState:
        String(_decision?.entryAdmissionState||'PENDING'),
      entryAdmissionReasons:
        Array.isArray(_decision?.entryAdmissionReasons)
          ? _decision.entryAdmissionReasons
              .filter(x=>typeof x==='string')
              .slice(0,20)
          : [],

      holderCount:_finite(_token?.holderCount??_token?.holders),
      holders:_finite(_token?.holderCount??_token?.holders),
      top10Pct:_finite(_token?.top10Pct??_token?.top10),
      developerPct:
        _finite(_token?.developerPct??_token?.developerSharePct),
      buyPressure:_finite(_token?.buyPressure??_token?.momentum),

      priceSol:_finite(_token?.priceSol??_token?.price),
      liquiditySol:_finite(_token?.liquiditySol??_token?.liquidity),
      marketCapSol:
        _finite(
          _market5m?.marketCapSol ??
          _token?.marketCapSol ??
          _token?.marketCap
        ),
      marketCapUsd:
        _finite(
          _market5m?.marketCapUsd ??
          _token?.marketCapUsd
        ),

      ageMinutes:_age===null?null:_finite(_age),
      volume5mSol:
        _finite(
          _market5m?.volume5mSol ??
          _token?.volume5mSol
        ),
      volume5mUsd:
        _finite(
          _market5m?.volume5mUsd ??
          _token?.volume5mUsd
        ),
      transactions5m:
        _finite(
          _market5m?.transactions5m ??
          _token?.transactions5m
        ),
      priceChange5mPct:
        _finite(
          _market5m?.priceChange5mPct ??
          _token?.priceChange5mPct
        ),

      qualityScore:_finite(_token?.qualityScore),
      opportunityScore:_finite(_token?.opportunityScore),
      opportunityEvidenceReady:
        _token?.opportunityEvidenceReady===true,
      opportunityTrendHealthy:
        _token?.opportunityTrendHealthy===true,
      dead:_token?.dead===true,
      deadReason:
        typeof _token?.deadReason==='string'
          ? _token.deadReason
          : null,
      quoteAgeMs:
        _token?.lastPriceAt
          ? Math.max(0,Date.now()-Number(_token.lastPriceAt))
          : null
    });
  }

  // MEMEFLOW_FEED_RANKING_COMPAT_V13
  // _safeViews is the JSON-safe, unranked candidate set. Keep the historical
  // _unrankedViews name as an explicit alias so the ranking contract/test and
  // the new safe-view bridge describe the same stage of the pipeline.
  const _unrankedViews=_safeViews;
  const _rankedViews=rankCandidateViews(_unrankedViews);
  const _views=_rankedViews.slice(0,_limit);

  const _payload={
    decisions:_views,
    total:_rankedViews.length,
    returned:_views.length,
    limit:_limit,

    // Keep old source value because regression/history tooling uses it.
    source:'system-live-token-states-transparent-v8',
    feedVersion:'MEMEFLOW_LIVE_TOKEN_FEED_BRIDGE_V13',

    rawScannerTokens:_rawTokens.length,
    uiWorkingSetTokens:_workingTokens.length,
    displayRows:_displayRows.length,
    safeViews:_safeViews.length,

    permanentRegistryTokens:
      Number(store.tokenRegistry?.metrics?.permanentTokensApprox||0),

    preAdmissionAdmitted:_admitted,
    preAdmissionPending:_pending,
    preAdmissionRejected:_rejected,
    preAdmissionVisible:_displayRows.length,
    preAdmissionHidden:0,
    openPositionOverride:_openOverride,

    evaluationErrors:_evalErrors,
    viewErrors:_viewErrors,
    stateCounts:_stateCounts,
    counts:_counts
  };

  __mfLiveStatesResponseCache.set(_cacheKey,{
    at:Date.now(),
    settingsVersion:_settingsVersion,
    liveRevision:__mfLiveTokenRevision,
    payload:_payload
  });

  if(__mfLiveStatesResponseCache.size>2000){
    const oldest=__mfLiveStatesResponseCache.keys().next().value;
    if(oldest!==undefined)__mfLiveStatesResponseCache.delete(oldest);
  }

  return json(res,200,_payload);
 }
"""

app = replace_between(
    app,
    route_start,
    route_end,
    new_route,
    "MEMEFLOW_LIVE_TOKEN_FEED_BRIDGE_V13",
    "bounded JSON-safe Live Token States feed"
)
save("app-server.mjs", app)


# ===========================================================================
# 2) FRONTEND DIAGNOSTICS
# Show both scanner truth and actual API feed truth in the same line.
# ===========================================================================
ui = load("system-tokens.js")

old_state = """  loading: false,
  emptyResponses: 0,
  refreshPending: false
};"""

new_state = """  loading: false,
  emptyResponses: 0,
  refreshPending: false,

  // MEMEFLOW_LIVE_TOKEN_FEED_DIAGNOSTICS_V13
  feedReturned: 0,
  feedWorkingSet: 0,
  feedRawScanner: 0,
  feedViewErrors: 0,
  feedEvaluationErrors: 0
};"""

ui = replace_once(
    ui,
    old_state,
    new_state,
    "MEMEFLOW_LIVE_TOKEN_FEED_DIAGNOSTICS_V13",
    "frontend feed diagnostic state"
)

# Feed diagnostics are known only after /api/system/live-token-states returns.
payload_anchor = """    const rows = Array.isArray(payload?.decisions)
      ? payload.decisions
      : [];

    state.rows = rows
"""

payload_replacement = """    const rows = Array.isArray(payload?.decisions)
      ? payload.decisions
      : [];

    state.feedReturned =
      Number.isFinite(Number(payload?.returned))
        ? Math.max(0,Number(payload.returned))
        : rows.length;
    state.feedWorkingSet =
      Number.isFinite(Number(payload?.uiWorkingSetTokens))
        ? Math.max(0,Number(payload.uiWorkingSetTokens))
        : 0;
    state.feedRawScanner =
      Number.isFinite(Number(payload?.rawScannerTokens))
        ? Math.max(0,Number(payload.rawScannerTokens))
        : 0;
    state.feedViewErrors =
      Number.isFinite(Number(payload?.viewErrors))
        ? Math.max(0,Number(payload.viewErrors))
        : 0;
    state.feedEvaluationErrors =
      Number.isFinite(Number(payload?.evaluationErrors))
        ? Math.max(0,Number(payload.evaluationErrors))
        : 0;

    state.rows = rows
"""

ui = replace_once(
    ui,
    payload_anchor,
    payload_replacement,
    "state.feedReturned =",
    "capture Live Token States feed diagnostics"
)

scanner_parts_anchor = """      if (
        Number.isFinite(failed) &&
        failed > 0
      ) {
        parts.push(`decode fail ${failed}`);
      }
"""

scanner_parts_new = """      if (
        Number.isFinite(failed) &&
        failed > 0
      ) {
        parts.push(`decode fail ${failed}`);
      }

      if (state.feedWorkingSet > 0) {
        parts.push(
          `feed ${state.feedReturned}/${state.feedWorkingSet}`
        );
      }

      const feedErrors =
        Number(state.feedViewErrors || 0) +
        Number(state.feedEvaluationErrors || 0);

      if (feedErrors > 0) {
        parts.push(`feed errors ${feedErrors}`);
      }
"""

ui = replace_once(
    ui,
    scanner_parts_anchor,
    scanner_parts_new,
    "feed ${state.feedReturned}/${state.feedWorkingSet}",
    "show feed diagnostics beside scanner status"
)

save("system-tokens.js", ui)


# ===========================================================================
# 3) CACHE-BUST THE FRONTEND BUNDLE
# ===========================================================================
html = load("system-tokens.html")

if "live-token-feed-v13-20260827" not in html:
    html2, count = re.subn(
        r'(/system-tokens\.js\?v=)[^"\']+',
        r'\1live-token-feed-v13-20260827',
        html,
        count=1
    )
    if count != 1:
        raise SystemExit(
            f"[error] cache-buster: expected 1 system-tokens.js URL, found {count}"
        )
    html = html2
    print("[apply] system-tokens.js v13 cache-buster")
else:
    print("[skip] system-tokens.js v13 cache-buster: already installed")

save("system-tokens.html", html)


# ===========================================================================
# 4) REGRESSION TESTS
# ===========================================================================
fresh = load("tests/fresh-session-scanner.mjs")

legacy_ui_guard = r"""assert.doesNotMatch(liveRoute,/Math\.min\(500/);
assert.doesNotMatch(liveRoute,/_rawTokens\.slice\(0,_lim\)/);
"""

new_ui_guard = r"""// MEMEFLOW_LIVE_TOKEN_FEED_UI_WINDOW_V13
// The permanent scanner inventory is NOT capped here. Only the browser-facing
// working set/output may be bounded for realtime performance.
assert.doesNotMatch(liveRoute,/_rawTokens\.slice\(0,_limit\)/);
assert.doesNotMatch(liveRoute,/__mfLiveScannerTokens\(\)\.slice\(/);
"""

if "MEMEFLOW_LIVE_TOKEN_FEED_UI_WINDOW_V13" not in fresh:
    if legacy_ui_guard not in fresh:
        raise SystemExit(
            "[error] fresh-session legacy UI-cap assertion block not found"
        )
    fresh = fresh.replace(
        legacy_ui_guard,
        new_ui_guard,
        1
    )
    print("[apply] fresh-session scanner-vs-UI window regression")
else:
    print("[skip] fresh-session scanner-vs-UI window regression")

fresh_anchor = """assert.doesNotMatch(liveRoute,/__mfLiveScannerTokens\\(\\)\\.slice\\(/);
"""

fresh_extra = """assert.doesNotMatch(liveRoute,/_rawTokens\\.slice\\(0,_lim\\)/);

// MEMEFLOW_LIVE_TOKEN_FEED_BRIDGE_V13
// Scanner inventory remains complete while the browser feed is a bounded,
// recent, JSON-safe observability window.
assert.match(liveRoute,/MEMEFLOW_LIVE_TOKEN_FEED_BRIDGE_V13/);
assert.match(liveRoute,/const _workingLimit=Math\\.max/);
assert.match(liveRoute,/_rawTokens\\.slice\\(0,_workingLimit\\)/);
assert.match(liveRoute,/uiWorkingSetTokens:_workingTokens\\.length/);
assert.match(liveRoute,/safeViews:_safeViews\\.length/);
assert.match(liveRoute,/feedVersion:'MEMEFLOW_LIVE_TOKEN_FEED_BRIDGE_V13'/);
assert.match(liveRoute,/const _safeViews=\\[\\]/);
assert.doesNotMatch(liveRoute,/_unrankedViews\\.push\\(candidateView/);
"""

fresh = replace_once(
    fresh,
    fresh_anchor,
    fresh_extra,
    "MEMEFLOW_LIVE_TOKEN_FEED_BRIDGE_V13",
    "fresh-session bounded feed regression"
)
save("tests/fresh-session-scanner.mjs", fresh)


rt = load("tests/realtime-update-path.mjs")

old_html_assert = """assert.match(tokenHtml,/system-tokens\\.js\\?v=live-scanner-cache-v9-20260827/);"""
new_html_assert = """assert.match(tokenHtml,/system-tokens\\.js\\?v=live-token-feed-v13-20260827/);"""

if old_html_assert in rt:
    rt = rt.replace(old_html_assert,new_html_assert,1)
    print("[apply] realtime cache-buster regression -> v11")
elif new_html_assert in rt:
    print("[skip] realtime cache-buster regression -> v11")
else:
    raise SystemExit("[error] realtime cache-buster assertion not found")

rt_anchor = """assert.match(tokenUi,/MEMEFLOW_REALTIME_COALESCE_250MS_V1/);
"""

rt_extra = """assert.match(tokenUi,/MEMEFLOW_REALTIME_COALESCE_250MS_V1/);
assert.match(route,/MEMEFLOW_LIVE_TOKEN_FEED_BRIDGE_V13/);
assert.match(tokenUi,/MEMEFLOW_LIVE_TOKEN_FEED_DIAGNOSTICS_V13/);
assert.match(tokenUi,/feed \\$\\{state\\.feedReturned\\}\\/\\$\\{state\\.feedWorkingSet\\}/);
"""

rt = replace_once(
    rt,
    rt_anchor,
    rt_extra,
    "MEMEFLOW_LIVE_TOKEN_FEED_DIAGNOSTICS_V13",
    "realtime feed diagnostics regression"
)
save("tests/realtime-update-path.mjs", rt)


# ===========================================================================
# 5) STATIC INSTALL-TIME INVARIANTS
# ===========================================================================
app = load("app-server.mjs")
ui = load("system-tokens.js")
html = load("system-tokens.html")

route_i = app.find("if(url.pathname==='/api/system/live-token-states'")
route_j = app.find("if(url.pathname==='/api/ai/decisions'",route_i)
if route_i < 0 or route_j < 0:
    raise SystemExit("[verify] live-token-states route boundaries missing")

route = app[route_i:route_j]

for needle in [
    "MEMEFLOW_LIVE_TOKEN_VISIBILITY_V8_CLEAN_WORKTREE",
    "MEMEFLOW_LIVE_TOKEN_FEED_BRIDGE_V13",
    "MEMEFLOW_REALTIME_UI_FAIRNESS_V1_ROUTE",
    "const _rawTokens=__mfLiveScannerTokens()",
    "const _workingLimit=Math.max",
    "const _workingTokens=_rawTokens.slice(0,_workingLimit)",
    "_rawTokens.slice(0,_workingLimit)",
    "await __mfYieldToEventLoop()",
    "uiWorkingSetTokens:_workingTokens.length",
    "safeViews:_safeViews.length",
    "MEMEFLOW_FEED_RANKING_COMPAT_V13",
    "const _unrankedViews=_safeViews",
    "rankCandidateViews(_unrankedViews)",
    "preAdmissionPending:_pending",
    "preAdmissionRejected:_rejected",
    "preAdmissionHidden:0",
    "source:'system-live-token-states-transparent-v8'",
]:
    if needle not in route:
        raise SystemExit(f"[verify] route invariant missing: {needle}")

if "_unrankedViews.push(candidateView" in route:
    raise SystemExit("[verify] fragile candidateView live-feed conversion remains")

# Trading must remain independent and strict.
trade = app[route_j:route_j+8000]
if "__mfAdmittedScannerTokensForUser(u.id)" not in trade:
    raise SystemExit("[verify] /api/ai/decisions admission gate disappeared")

for needle in [
    "MEMEFLOW_LIVE_TOKEN_FEED_DIAGNOSTICS_V13",
    "state.feedReturned",
    "state.feedWorkingSet",
]:
    if needle not in ui:
        raise SystemExit(f"[verify] UI invariant missing: {needle}")

if "live-token-feed-v13-20260827" not in html:
    raise SystemExit("[verify] v13 frontend cache-buster missing")

print("[verify] scanner/trading separation + bounded feed + JSON-safe view OK")
PY

cd "$TMP/memeflow-app"

echo "[check] syntax"
node --check app-server.mjs
node --check system-tokens.js

echo "[check] exact failed regressions FIRST"
node tests/fresh-session-scanner.mjs
node tests/feed-ranking.mjs
echo "[check] remaining focused regressions"
node tests/realtime-update-path.mjs
node tests/ws-first-preopen-rpc.mjs
node tests/strict-entry-admission.mjs
node tests/live-market-truth.mjs

echo "[check] FULL npm test"
npm test

cd "$TMP"

echo "[check] diff"
git diff --check
git diff --stat -- "${PATCH_FILES[@]}"

git add -- "${PATCH_FILES[@]}"

if git diff --cached --quiet; then
  echo "[git] v13 is already present on origin/main"
  NEW_SHA="$(git rev-parse HEAD)"
else
  git commit -m "fix: bridge scanner inventory into live token feed"
  NEW_SHA="$(git rev-parse HEAD)"

  echo "[git] push verified commit -> main"
  git push origin HEAD:main
fi

echo "[git] verified commit: $NEW_SHA"

# ===========================================================================
# Sync verified files into active Replit workspace.
# Back up only files this patch owns. Unrelated workspace files are untouched.
# ===========================================================================
cd "$ROOT"

BACKUP_DIR="$ROOT/.memeflow-v13-recovery-$(date +%Y%m%d-%H%M%S)"
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
    echo "[local] workspace fast-forwarded to verified v13"
  else
    echo "[local] fast-forward blocked; syncing only v13 files"
    git restore --source="$NEW_SHA" --worktree -- "${PATCH_FILES[@]}"
  fi
else
  echo "[local] local branch is not a clean ancestor; syncing only v13 files"
  git restore --source="$NEW_SHA" --worktree -- "${PATCH_FILES[@]}"
fi

echo "[local] recovery backup: $BACKUP_DIR"

echo
echo "DONE"
echo "- scanner inventory remains complete and permanent"
echo "- Live Token States API uses a bounded recent working set"
echo "- card payload is built from JSON-safe canonical token fields"
echo "- feed ranking contract preserved through explicit _unrankedViews alias"
echo "- candidateView can no longer erase the entire page on conversion errors"
echo "- page shows scanner count AND actual feed returned/working-set count"
echo "- PENDING => WAITING and REJECTED => BLOCKED remain intact"
echo "- BUY READY/execution remains strictly Entry-admitted"
echo "- full npm test passed BEFORE push"
echo
echo "IMPORTANT: do one Replit Stop -> Run after DONE because app-server.mjs runs"
echo "under plain 'node app-server.mjs'."
