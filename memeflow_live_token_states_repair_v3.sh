#!/usr/bin/env bash
set -euo pipefail

echo "[MEMEFLOW] live token states repair v3"

ROOT="${HOME}/workspace"
if [[ ! -d "$ROOT/.git" ]]; then
  ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
fi

if [[ -z "${ROOT:-}" || ! -d "$ROOT/.git" ]]; then
  echo "ERROR: Git repository root was not found." >&2
  exit 1
fi

cd "$ROOT"

if [[ ! -f "memeflow-app/app-server.mjs" ]]; then
  echo "ERROR: memeflow-app/app-server.mjs was not found under $ROOT" >&2
  exit 1
fi

if [[ -n "$(git status --porcelain)" ]]; then
  echo "ERROR: working tree is not clean. Commit/stash your current changes first." >&2
  git status --short
  exit 1
fi

echo "[git] update main"
git checkout main
git pull --ff-only

python3 - <<'PY'
from pathlib import Path

ROOT = Path.cwd()
APP = ROOT / "memeflow-app"

def read(name):
    return (APP / name).read_text()

def write(name, text):
    (APP / name).write_text(text)

def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"[patch] {label}: expected exactly 1 match, found {count}")
    return text.replace(old, new, 1)

def replace_between(text, start, end, new, label):
    i = text.find(start)
    if i < 0:
        raise SystemExit(f"[patch] {label}: start marker not found")
    j = text.find(end, i)
    if j < 0:
        raise SystemExit(f"[patch] {label}: end marker not found")
    return text[:i] + new + text[j:]

# ---------------------------------------------------------------------------
# 1) Backend: make Live Token States transparent and keep trading strict.
# PENDING -> WAITING, REJECTED -> BLOCKED, ADMITTED -> normal Logic.
# No Entry Filter is weakened and /api/ai/decisions remains admission-gated.
# ---------------------------------------------------------------------------
app = read("app-server.mjs")

route_start = "  // MEMEFLOW_LIVE_TOKEN_STATES_V7\n if(url.pathname==='/api/system/live-token-states'&&req.method==='GET'){"
route_end = "if(url.pathname==='/api/ai/decisions'){"

new_route = r"""  // MEMEFLOW_LIVE_TOKEN_STATES_V8
 if(url.pathname==='/api/system/live-token-states'&&req.method==='GET'){
  // MEMEFLOW_LIVE_TOKEN_VISIBILITY_V3
  //
  // SCAN: every Pump token in the hot scanner cache.
  // DISPLAY:
  //   ADMITTED -> canonical Logic state (WAITING / WATCH / BUY READY / BLOCKED)
  //   PENDING  -> WAITING with the real Entry Filter reason
  //   REJECTED -> BLOCKED with the real Entry Filter reason
  //   OPEN     -> always remains visible
  // TRADE: /api/ai/decisions and execution are still strictly Entry-admitted.
  //
  // This separation is intentional: an incomplete token must never disappear
  // from a page whose job is to show live token states.
  const _requestedLimit=Math.floor(Number(url.searchParams.get('limit')||0));
  const _limit=Number.isFinite(_requestedLimit)&&_requestedLimit>0
    ? _requestedLimit
    : null;

  const _settings=store.settings(u.id);
  const _rawTokens=__mfLiveScannerTokens();
  const _openMints=__mfOpenPositionMints();

  // MEMEFLOW_REALTIME_UI_FAIRNESS_V2_ROUTE
  // Cache identity includes response shape. A request with another limit must
  // never receive a snapshot cached for a different limit.
  const _cacheScope='limit:' + String(_limit??'all');
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

  for(const _token of _rawTokens){
    const _mint=String(_token?.mint||'').trim();
    if(!_mint)continue;

    // Yield periodically so Pump WS callbacks remain higher priority than UI.
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
      // Do NOT run Logic on a token that has not passed Entry Filters.
      // Represent admission truth directly instead of silently hiding the card.
      const _reasons=Array.isArray(_admission?.reasons)
        ? _admission.reasons.filter(Boolean)
        : [];
      const _blocked=_admissionState==='REJECTED';
      const _fallbackReason=_blocked
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
            reasons:['Scanner data is still being collected']
          };
        }
      }
    }

    _displayRows.push({
      ..._decision,
      mint:_mint,
      tradeEligible:_eligible,
      displayOnly:!_eligible&&!_isOpen,
      openPositionOverride:_isOpen&&!_eligible,
      entryAdmissionState:_admissionState,
      entryAdmissionReasons:Array.isArray(_admission?.reasons)
        ? _admission.reasons
        : []
    });
  }

  const _selected=candidateFeed(_displayRows,'all');
  const _counts=candidateVisibilityCounts(_displayRows);
  const _stateCounts={};

  for(const _decision of _selected){
    const _state=String(_decision?.state||'WAITING').trim().toUpperCase()||'WAITING';
    _stateCounts[_state]=(_stateCounts[_state]||0)+1;
  }

  const _unrankedViews=[];
  for(const _decision of _selected){
    try{_unrankedViews.push(candidateView(_decision))}
    catch(_error){_viewErrors++}
  }

  const _rankedViews=rankCandidateViews(_unrankedViews);
  const _views=_limit
    ? _rankedViews.slice(0,_limit)
    : _rankedViews;

  const _payload={
    decisions:_views,
    total:_rankedViews.length,
    returned:_views.length,
    limit:_limit,
    source:'system-live-token-states-transparent-v3',

    // Scanner truth.
    rawScannerTokens:_rawTokens.length,
    permanentRegistryTokens:
      Number(store.tokenRegistry?.metrics?.permanentTokensApprox||0),

    // Admission truth. "Hidden" stays for compatibility and is deliberately 0:
    // Entry Filters classify cards here; they still strictly gate trading.
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

  // Bound per-user/scope cache cardinality.
  if(__mfLiveStatesResponseCache.size>2000){
    const oldest=__mfLiveStatesResponseCache.keys().next().value;
    if(oldest!==undefined)__mfLiveStatesResponseCache.delete(oldest);
  }

  return json(res,200,_payload);
 }
"""

app = replace_between(app, route_start, route_end, new_route, "live-token-states route")
write("app-server.mjs", app)

# ---------------------------------------------------------------------------
# 2) Frontend: diagnostics must explain scanner/admission truth.
# ---------------------------------------------------------------------------
ui = read("system-tokens.js")

ui = replace_once(
    ui,
    """  emptyResponses: 0,
  refreshPending: false
};""",
    """  emptyResponses: 0,
  refreshPending: false,
  scannerTotal: 0,
  admissionPending: 0,
  admissionRejected: 0
};""",
    "frontend state diagnostics"
)

telemetry_start = "    const persisted = Number(payload?.persistedTokens);"
telemetry_end = "    $('lastUpdate').textContent = parts.join(' · ');"

telemetry_new = r"""    const scanned = Number(payload?.rawScannerTokens);
    const admitted = Number(payload?.preAdmissionAdmitted);
    const pending = Number(payload?.preAdmissionPending);
    const rejected = Number(payload?.preAdmissionRejected);
    const evalErrors = Number(payload?.evaluationErrors);
    const viewErrors = Number(payload?.viewErrors);

    if (Number.isFinite(scanned)) {
      state.scannerTotal = Math.max(0, scanned);
    }
    if (Number.isFinite(pending)) {
      state.admissionPending = Math.max(0, pending);
    }
    if (Number.isFinite(rejected)) {
      state.admissionRejected = Math.max(0, rejected);
    }

    const parts = [
      `Updated ${new Date().toLocaleTimeString(
        [],
        {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit'
        }
      )}`
    ];

    if (Number.isFinite(scanned)) {
      parts.push(`loaded ${state.rows.length}/${Math.max(0, scanned)}`);
    } else {
      parts.push(`loaded ${state.rows.length}`);
    }

    if (Number.isFinite(admitted)) {
      parts.push(`admitted ${Math.max(0, admitted)}`);
    }

    if (Number.isFinite(pending) && pending > 0) {
      parts.push(`waiting ${Math.max(0, pending)}`);
    }

    if (Number.isFinite(rejected) && rejected > 0) {
      parts.push(`blocked ${Math.max(0, rejected)}`);
    }

    if (
      (Number.isFinite(evalErrors) && evalErrors > 0) ||
      (Number.isFinite(viewErrors) && viewErrors > 0)
    ) {
      parts.push(
        `errors ${
          Math.max(0, evalErrors || 0) +
          Math.max(0, viewErrors || 0)
        }`
      );
    }

    $('lastUpdate').textContent = parts.join(' · ');"""

i = ui.find(telemetry_start)
if i < 0:
    raise SystemExit("[patch] frontend telemetry: start marker not found")
j = ui.find(telemetry_end, i)
if j < 0:
    raise SystemExit("[patch] frontend telemetry: end marker not found")
j += len(telemetry_end)
ui = ui[:i] + telemetry_new + ui[j:]

ui = replace_once(
    ui,
    """  $('emptyState').hidden =
    pageRows.length !== 0;

  $('tokenList').innerHTML =""",
    """  const emptyState = $('emptyState');
  emptyState.hidden = pageRows.length !== 0;

  if (pageRows.length === 0) {
    const title = emptyState.querySelector('strong');
    const subtitle = emptyState.querySelector('span');

    if (
      state.scannerTotal === 0 &&
      state.filter === 'all' &&
      !state.query.trim()
    ) {
      if (title) title.textContent = 'Waiting for live Pump tokens';
      if (subtitle) {
        subtitle.textContent =
          'Scanner is live; cards will appear as soon as Pump tokens are discovered.';
      }
    } else {
      if (title) title.textContent = 'No tokens in this view';
      if (subtitle) {
        subtitle.textContent =
          'Try another state filter or search.';
      }
    }
  }

  $('tokenList').innerHTML =""",
    "empty-state diagnostics"
)

# ---------------------------------------------------------------------------
# 3) Frontend realtime: keep event-driven correctness but coalesce bursts.
# 80ms full-snapshot reloads are unnecessarily aggressive on busy Pump traffic.
# ---------------------------------------------------------------------------
rt_start = "/* MEMEFLOW_SYSTEM_TOKENS_REALTIME_V1"
rt_end = "/* ===== LIVE TOKEN METADATA V16 ===== */"

rt_new = r"""/* MEMEFLOW_SYSTEM_TOKENS_REALTIME_V2
 * /api/system/stream is the canonical change trigger.
 * Token bursts are coalesced into one full per-user snapshot refresh every
 * 250ms at most. That is still effectively real-time while avoiding an 80ms
 * request storm on active Pump traffic. 3s polling remains fallback ONLY when
 * EventSource is disconnected.
 */
const REALTIME_COALESCE_MS = 250;
let __mfTokenStateStream = null;
let __mfRealtimeRefreshTimer = null;
let __mfLastRealtimeRevision = 0;

function __mfScheduleRealtimeRefresh(event = null) {
  if (event?.data) {
    try {
      const payload = JSON.parse(event.data);
      const revision = Number(payload?.revision || 0);
      if (revision > 0) {
        if (revision <= __mfLastRealtimeRevision) return;
        __mfLastRealtimeRevision = revision;
      }
    } catch {}
  }

  if (__mfRealtimeRefreshTimer !== null) return;

  __mfRealtimeRefreshTimer = setTimeout(() => {
    __mfRealtimeRefreshTimer = null;
    void loadTokens();
  }, REALTIME_COALESCE_MS);
}

function __mfConnectTokenStateStream() {
  if (typeof EventSource === 'undefined') return;

  try { __mfTokenStateStream?.close?.(); } catch {}

  const source = new EventSource('/api/system/stream');
  __mfTokenStateStream = source;

  source.addEventListener('hello', __mfScheduleRealtimeRefresh);
  source.addEventListener('create', __mfScheduleRealtimeRefresh);
  source.addEventListener('token', __mfScheduleRealtimeRefresh);
  source.addEventListener('token_removed', __mfScheduleRealtimeRefresh);

  source.onopen = () => {
    __mfScheduleRealtimeRefresh();
  };
}

__mfConnectTokenStateStream();

setInterval(() => {
  if (
    !__mfTokenStateStream ||
    typeof EventSource === 'undefined' ||
    __mfTokenStateStream.readyState !== EventSource.OPEN
  ) {
    void loadTokens();
  }
}, REFRESH_MS);

document.addEventListener('visibilitychange', () => {
  if (!document.hidden) {
    __mfScheduleRealtimeRefresh();
  }
});

window.addEventListener('beforeunload', () => {
  if (__mfRealtimeRefreshTimer !== null) {
    clearTimeout(__mfRealtimeRefreshTimer);
  }
  try { __mfTokenStateStream?.close?.(); } catch {}
}, { once: true });



"""

ui = replace_between(ui, rt_start, rt_end, rt_new, "frontend realtime block")
write("system-tokens.js", ui)

# ---------------------------------------------------------------------------
# 4) Settings copy: describe the actual architecture.
# ---------------------------------------------------------------------------
settings = read("settings-page.js")
settings = replace_once(
    settings,
    "Scanner scans all · these filters control cards + trading",
    "Scanner scans all · filters classify cards and gate trading",
    "settings helper text"
)
write("settings-page.js", settings)

# ---------------------------------------------------------------------------
# 5) Cache-bust the repaired Live Token States asset.
# ---------------------------------------------------------------------------
html = read("system-tokens.html")
html = replace_once(
    html,
    "/system-tokens.js?v=realtime-all-fields-v1-20260826",
    "/system-tokens.js?v=live-visibility-v3-20260826",
    "system-tokens asset version"
)
write("system-tokens.html", html)

# ---------------------------------------------------------------------------
# 6) Regression tests: make it impossible to reintroduce silent hiding.
# ---------------------------------------------------------------------------
strict = read("tests/strict-entry-admission.mjs")
strict_start = "// Entry admission controls BOTH card visibility and trading eligibility."
strict_end = "const discovery=app.slice("

strict_new = r"""// Live Token States is an observability surface:
// Entry admission CLASSIFIES cards but remains a strict trading gate.
// PENDING must be visible as WAITING; REJECTED must be visible as BLOCKED.
const liveStatesRoute=app.slice(
  app.indexOf("if(url.pathname==='/api/system/live-token-states'"),
  app.indexOf("if(url.pathname==='/api/ai/decisions'")
);
assert.match(liveStatesRoute,/MEMEFLOW_LIVE_TOKEN_VISIBILITY_V3/);
assert.match(liveStatesRoute,/const _rawTokens=__mfLiveScannerTokens\(\)/);
assert.match(liveStatesRoute,/_admissionState==='REJECTED'/);
assert.match(liveStatesRoute,/state:_blocked\?'BLOCKED':'WAITING'/);
assert.match(liveStatesRoute,/displayOnly:!_eligible&&!_isOpen/);
assert.match(liveStatesRoute,/preAdmissionPending:_pending/);
assert.match(liveStatesRoute,/preAdmissionRejected:_rejected/);
assert.match(liveStatesRoute,/preAdmissionHidden:0/);
assert.doesNotMatch(
  liveStatesRoute,
  /if\(!_eligible&&!_isOpen\)\{\s*_hiddenBySettings\+\+;\s*continue/
);

"""

strict = replace_between(strict, strict_start, strict_end, strict_new, "strict admission regression")
write("tests/strict-entry-admission.mjs", strict)

settings_test = read("tests/settings-architecture-v2.mjs")
settings_test = replace_once(
    settings_test,
    r"assert.match(settingsPage,/Scanner scans all · these filters control cards \+ trading/);",
    r"assert.match(settingsPage,/Scanner scans all · filters classify cards and gate trading/);",
    "settings architecture regression"
)
write("tests/settings-architecture-v2.mjs", settings_test)

realtime = read("tests/realtime-update-path.mjs")
realtime = replace_once(
    realtime,
    "assert.match(route,/MEMEFLOW_REALTIME_UI_FAIRNESS_V1_ROUTE/);",
    "assert.match(route,/MEMEFLOW_REALTIME_UI_FAIRNESS_V2_ROUTE/);",
    "realtime fairness marker"
)

realtime = replace_once(
    realtime,
    """assert.match(tokenUi,/readyState !== EventSource\\.OPEN/);

console.log('realtime update path v1 ok');""",
    """assert.match(tokenUi,/readyState !== EventSource\\.OPEN/);
assert.match(tokenUi,/const REALTIME_COALESCE_MS = 250;/);
assert.match(route,/const _cacheScope=/);
assert.match(route,/preAdmissionPending:_pending/);
assert.match(route,/preAdmissionRejected:_rejected/);
assert.match(route,/preAdmissionHidden:0/);

console.log('realtime update path v1 ok');""",
    "realtime visibility assertions"
)
write("tests/realtime-update-path.mjs", realtime)

print("[patch] files updated:")
for name in [
    "app-server.mjs",
    "system-tokens.js",
    "system-tokens.html",
    "settings-page.js",
    "tests/strict-entry-admission.mjs",
    "tests/settings-architecture-v2.mjs",
    "tests/realtime-update-path.mjs",
]:
    print(" -", name)
PY

cd "$ROOT/memeflow-app"

echo "[check] syntax"
node --check app-server.mjs
node --check system-tokens.js
node --check settings-page.js

echo "[check] focused regression tests"
node tests/strict-entry-admission.mjs
node tests/settings-architecture-v2.mjs
node tests/realtime-update-path.mjs

if [[ -f tests/live-market-truth.mjs ]]; then
  node tests/live-market-truth.mjs
fi

echo "[check] full suite"
npm test

cd "$ROOT"

echo "[check] diff"
git diff --check
git diff --stat
git diff -- \
  memeflow-app/app-server.mjs \
  memeflow-app/system-tokens.js \
  memeflow-app/system-tokens.html \
  memeflow-app/settings-page.js \
  memeflow-app/tests/strict-entry-admission.mjs \
  memeflow-app/tests/settings-architecture-v2.mjs \
  memeflow-app/tests/realtime-update-path.mjs

echo "[git] commit + push"
git add \
  memeflow-app/app-server.mjs \
  memeflow-app/system-tokens.js \
  memeflow-app/system-tokens.html \
  memeflow-app/settings-page.js \
  memeflow-app/tests/strict-entry-admission.mjs \
  memeflow-app/tests/settings-architecture-v2.mjs \
  memeflow-app/tests/realtime-update-path.mjs

if git diff --cached --quiet; then
  echo "No changes to commit."
  exit 0
fi

git commit -m "fix: restore live token visibility and stabilize realtime refresh"
git push origin main

echo
echo "DONE: Live Token States now keeps PENDING visible as WAITING,"
echo "REJECTED visible as BLOCKED, trading remains strictly admission-gated,"
echo "realtime refreshes are event-driven and burst-coalesced, and diagnostics"
echo "show scanned/admitted/waiting/blocked counts."
