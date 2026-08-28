#!/usr/bin/env bash
set -Eeuo pipefail

echo "[MEMEFLOW] Live Token States repair v4-safe"

ROOT="${HOME}/workspace"
if [[ ! -d "$ROOT/.git" ]]; then
  ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
fi

if [[ -z "${ROOT:-}" || ! -d "$ROOT/.git" ]]; then
  echo "ERROR: Git repository not found." >&2
  exit 1
fi

cd "$ROOT"

APP="$ROOT/memeflow-app"
TARGETS=(
  "memeflow-app/app-server.mjs"
  "memeflow-app/system-tokens.js"
  "memeflow-app/system-tokens.html"
  "memeflow-app/settings-page.js"
  "memeflow-app/tests/strict-entry-admission.mjs"
  "memeflow-app/tests/fresh-session-scanner.mjs"
  "memeflow-app/tests/settings-architecture-v2.mjs"
)

for f in "${TARGETS[@]}"; do
  if [[ ! -f "$f" ]]; then
    echo "ERROR: required file missing: $f" >&2
    exit 1
  fi
done

# IMPORTANT:
# Untracked installer/patch files (the red "??" lines in Replit) are harmless.
# Do NOT treat them as a dirty tree and do NOT delete them.
if ! git diff --quiet --ignore-submodules -- || ! git diff --cached --quiet --ignore-submodules --; then
  echo "ERROR: tracked project files have local modifications." >&2
  echo "Only tracked changes block this installer; untracked ?? patch files are ignored."
  git status --short
  exit 1
fi

UNTRACKED_COUNT="$(git ls-files --others --exclude-standard | wc -l | tr -d ' ')"
echo "[ok] ignoring ${UNTRACKED_COUNT:-0} untracked file(s)"

echo "[git] sync main"
git checkout main
git pull --ff-only

rollback() {
  code=$?
  if [[ $code -ne 0 ]]; then
    echo
    echo "[rollback] install/check failed; restoring tracked target files"
    git restore --staged --worktree -- "${TARGETS[@]}" 2>/dev/null || true
    echo "[rollback] no commit or push was made"
  fi
  exit "$code"
}
trap rollback ERR

python3 - <<'PY'
from pathlib import Path
import re

ROOT = Path.cwd()
APP = ROOT / "memeflow-app"

def load(rel):
    return (APP / rel).read_text()

def save(rel, text):
    (APP / rel).write_text(text)

def section_replace(text, start, end, replacement, marker, label, required=True):
    if marker in text:
        print(f"[skip] {label}: already installed")
        return text, False

    i = text.find(start)
    if i < 0:
        msg = f"{label}: start anchor not found"
        if required:
            raise SystemExit("[error] " + msg)
        print("[skip] " + msg)
        return text, False

    j = text.find(end, i + len(start))
    if j < 0:
        msg = f"{label}: end anchor not found"
        if required:
            raise SystemExit("[error] " + msg)
        print("[skip] " + msg)
        return text, False

    print(f"[apply] {label}")
    return text[:i] + replacement + text[j:], True

def replace_any(text, old_values, new, marker, label, required=False):
    if marker in text:
        print(f"[skip] {label}: already installed")
        return text, False

    for old in old_values:
        if old in text:
            print(f"[apply] {label}")
            return text.replace(old, new, 1), True

    msg = f"{label}: source shape not found"
    if required:
        raise SystemExit("[error] " + msg)
    print("[skip] " + msg)
    return text, False


# ===========================================================================
# BACKEND — REQUIRED CORE FIX
# ===========================================================================
app = load("app-server.mjs")

route_start = " if(url.pathname==='/api/system/live-token-states'&&req.method==='GET'){"
route_end = "if(url.pathname==='/api/ai/decisions'){"

route = r""" if(url.pathname==='/api/system/live-token-states'&&req.method==='GET'){
  // MEMEFLOW_LIVE_TOKEN_VISIBILITY_V4_SAFE
  //
  // SCAN: every Pump token in the hot scanner cache.
  // DISPLAY:
  //   ADMITTED -> canonical Logic state
  //   PENDING  -> WAITING
  //   REJECTED -> BLOCKED
  //   OPEN     -> always visible via the existing open-position merge
  // TRADE: /api/ai/decisions + execution remain strictly Entry-admitted.
  //
  // Missing/unfinished Entry Filter data is a state, not a reason to erase a
  // token from the Live Token States page.
  const _requestedLimit=Math.floor(Number(url.searchParams.get('limit')||0));
  const _limit=Number.isFinite(_requestedLimit)&&_requestedLimit>0
    ? _requestedLimit
    : null;

  const _settings=store.settings(u.id);
  const _rawTokens=__mfLiveScannerTokens();
  const _openMints=__mfOpenPositionMints();

  // MEMEFLOW_REALTIME_UI_FAIRNESS_V1_ROUTE
  // Include response shape in the cache identity so a limited response can
  // never satisfy an unlimited request (or vice versa).
  const _cacheScope='limit:'+String(_limit??'all');
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

    // Keep the Pump WS hot path responsive while a large UI snapshot is built.
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
      // Entry Filters still block trading. They no longer delete observability.
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
    source:'system-live-token-states-transparent-v4',

    rawScannerTokens:_rawTokens.length,
    permanentRegistryTokens:
      Number(store.tokenRegistry?.metrics?.permanentTokensApprox||0),

    preAdmissionAdmitted:_admitted,
    preAdmissionPending:_pending,
    preAdmissionRejected:_rejected,
    preAdmissionVisible:_displayRows.length,

    // Compatibility field: nothing is silently hidden by admission here.
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

app, _ = section_replace(
    app,
    route_start,
    route_end,
    route,
    "MEMEFLOW_LIVE_TOKEN_VISIBILITY_V4_SAFE",
    "backend Live Token States visibility",
    required=True
)
save("app-server.mjs", app)


# ===========================================================================
# FRONTEND — OPTIONAL, SKIP-SAFE QUALITY/PERFORMANCE IMPROVEMENTS
# ===========================================================================
ui = load("system-tokens.js")

# Make token bursts coalesce to 250ms instead of 80ms. This keeps event-driven
# behavior but prevents full snapshot request storms.
rt_start = "function __mfScheduleRealtimeRefresh(event = null) {"
rt_end = "function __mfConnectTokenStateStream() {"
if rt_start in ui and rt_end in ui:
    i = ui.find(rt_start)
    j = ui.find(rt_end, i)
    block = ui[i:j]
    if "MEMEFLOW_REALTIME_COALESCE_V4_SAFE" in block:
        print("[skip] frontend realtime coalescing: already installed")
    else:
        new_block = block
        new_block = new_block.replace(
            "function __mfScheduleRealtimeRefresh(event = null) {",
            "/* MEMEFLOW_REALTIME_COALESCE_V4_SAFE */\nconst __MF_REALTIME_COALESCE_MS = 250;\n\nfunction __mfScheduleRealtimeRefresh(event = null) {",
            1
        )
        if "}, 80);" in new_block:
            new_block = new_block.replace("}, 80);", "}, __MF_REALTIME_COALESCE_MS);", 1)
            ui = ui[:i] + new_block + ui[j:]
            print("[apply] frontend realtime coalescing")
        elif "__MF_REALTIME_COALESCE_MS" in new_block and "}, __MF_REALTIME_COALESCE_MS);" in new_block:
            print("[skip] frontend realtime coalescing: already equivalent")
        else:
            print("[skip] frontend realtime coalescing: timer source shape changed")
else:
    print("[skip] frontend realtime coalescing: anchors not found")

# Replace legacy diagnostics with scanner/admission truth, but do not make this
# cosmetic improvement capable of aborting the core repair.
diag_start = "    const persisted = Number(payload?.persistedTokens);"
diag_end = "    $('lastUpdate').textContent = parts.join(' · ');"
if "MEMEFLOW_LIVE_DIAGNOSTICS_V4_SAFE" in ui:
    print("[skip] frontend scanner diagnostics: already installed")
elif diag_start in ui and diag_end in ui:
    i = ui.find(diag_start)
    j = ui.find(diag_end, i)
    j += len(diag_end)
    diag = r"""    // MEMEFLOW_LIVE_DIAGNOSTICS_V4_SAFE
    const scanned = Number(payload?.rawScannerTokens);
    const admitted = Number(payload?.preAdmissionAdmitted);
    const pending = Number(payload?.preAdmissionPending);
    const rejected = Number(payload?.preAdmissionRejected);
    const evalErrors = Number(payload?.evaluationErrors);
    const viewErrors = Number(payload?.viewErrors);

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
    ui = ui[:i] + diag + ui[j:]
    print("[apply] frontend scanner diagnostics")
else:
    print("[skip] frontend scanner diagnostics: source shape changed")

save("system-tokens.js", ui)


# ===========================================================================
# SETTINGS LABEL — OPTIONAL/SKIP-SAFE
# ===========================================================================
settings = load("settings-page.js")
settings, _ = replace_any(
    settings,
    [
        "Scanner scans all · these filters control cards + trading",
        "Trading eligibility · scanner and cards always stay live"
    ],
    "Scanner scans all · filters classify cards and gate trading",
    "Scanner scans all · filters classify cards and gate trading",
    "settings architecture helper",
    required=False
)
save("settings-page.js", settings)


# ===========================================================================
# CACHE BUSTER — OPTIONAL/SKIP-SAFE
# ===========================================================================
html = load("system-tokens.html")
if "live-visibility-v4-safe-20260826" in html:
    print("[skip] system-tokens asset cache-buster: already installed")
else:
    pattern = re.compile(r'(/system-tokens\.js\?v=)[^"\']+')
    html2, n = pattern.subn(r'\1live-visibility-v4-safe-20260826', html, count=1)
    if n:
        html = html2
        print("[apply] system-tokens asset cache-buster")
    else:
        print("[skip] system-tokens asset cache-buster: script tag shape changed")
save("system-tokens.html", html)


# ===========================================================================
# REGRESSION TESTS — REQUIRED IF OLD ASSERTIONS EXIST; SKIP IF ALREADY UPDATED
# ===========================================================================
strict = load("tests/strict-entry-admission.mjs")
test_start = "const liveStatesRoute=app.slice("
test_end = "const discovery=app.slice("

if "MEMEFLOW_LIVE_TOKEN_VISIBILITY_V4_SAFE" in strict:
    print("[skip] strict admission regression: already installed")
elif test_start in strict and test_end in strict:
    i = strict.find(test_start)
    j = strict.find(test_end, i)
    test_block = r"""// MEMEFLOW_LIVE_TOKEN_VISIBILITY_V4_SAFE
// Entry admission strictly gates TRADING but classifies Live Token States.
// PENDING stays visible as WAITING; REJECTED stays visible as BLOCKED.
const liveStatesRoute=app.slice(
  app.indexOf("if(url.pathname==='/api/system/live-token-states'"),
  app.indexOf("if(url.pathname==='/api/ai/decisions'")
);
assert.match(liveStatesRoute,/MEMEFLOW_LIVE_TOKEN_VISIBILITY_V4_SAFE/);
assert.match(liveStatesRoute,/const _rawTokens=__mfLiveScannerTokens\(\)/);
assert.match(liveStatesRoute,/_admissionState==='REJECTED'/);
assert.match(liveStatesRoute,/state:_blocked\?'BLOCKED':'WAITING'/);
assert.match(liveStatesRoute,/displayOnly:!_eligible&&!_isOpen/);
assert.match(liveStatesRoute,/preAdmissionPending:_pending/);
assert.match(liveStatesRoute,/preAdmissionRejected:_rejected/);
assert.match(liveStatesRoute,/preAdmissionHidden:0/);
assert.doesNotMatch(
  liveStatesRoute,
  /_hiddenBySettings\+\+;\s*continue/
);

"""
    strict = strict[:i] + test_block + strict[j:]
    print("[apply] strict admission regression")
else:
    raise SystemExit("[error] strict admission regression anchors not found")

save("tests/strict-entry-admission.mjs", strict)


fresh = load("tests/fresh-session-scanner.mjs")
fresh_start = "const liveRoute=app.slice("
fresh_end = "assert.doesNotMatch(app,/MEMEFLOW_AGE_THRESHOLD_WAKE_V1/);"
if "MEMEFLOW_LIVE_TOKEN_VISIBILITY_V4_SAFE" in fresh:
    print("[skip] fresh-session visibility regression: already installed")
elif fresh_start in fresh and fresh_end in fresh:
    i = fresh.find(fresh_start)
    j = fresh.find(fresh_end, i)
    fresh_block = r"""const liveRoute=app.slice(
  app.indexOf("if(url.pathname==='/api/system/live-token-states'"),
  app.indexOf("if(url.pathname==='/api/ai/decisions'")
);
// MEMEFLOW_LIVE_TOKEN_VISIBILITY_V4_SAFE
assert.match(liveRoute,/MEMEFLOW_LIVE_TOKEN_VISIBILITY_V4_SAFE/);
assert.match(liveRoute,/const _rawTokens=__mfLiveScannerTokens\(\)/);
assert.match(liveRoute,/preAdmissionPending:_pending/);
assert.match(liveRoute,/preAdmissionRejected:_rejected/);
assert.match(liveRoute,/preAdmissionHidden:0/);
assert.match(liveRoute,/system-live-token-states-transparent-v4/);
assert.doesNotMatch(liveRoute,/_hiddenBySettings\+\+;/);
assert.doesNotMatch(liveRoute,/Math\.min\(500/);
assert.doesNotMatch(liveRoute,/_rawTokens\.slice\(0,_lim\)/);

"""
    fresh = fresh[:i] + fresh_block + fresh[j:]
    print("[apply] fresh-session visibility regression")
else:
    raise SystemExit("[error] fresh-session visibility regression anchors not found")
save("tests/fresh-session-scanner.mjs", fresh)


settings_test = load("tests/settings-architecture-v2.mjs")
old_assertions = [
    r"assert.match(settingsPage,/Scanner scans all · these filters control cards \+ trading/);",
    r"assert.match(settingsPage,/Trading eligibility only/);"
]
new_assertion = r"assert.match(settingsPage,/Scanner scans all · filters classify cards and gate trading/);"
if new_assertion in settings_test:
    print("[skip] settings architecture regression: already installed")
else:
    done = False
    for old in old_assertions:
        if old in settings_test:
            settings_test = settings_test.replace(old, new_assertion, 1)
            done = True
            print("[apply] settings architecture regression")
            break
    if not done:
        print("[skip] settings architecture regression: old assertion not present")

save("tests/settings-architecture-v2.mjs", settings_test)


# ===========================================================================
# INSTALL-TIME STATIC INVARIANTS — REQUIRED
# ===========================================================================
app = load("app-server.mjs")
route_i = app.find("if(url.pathname==='/api/system/live-token-states'")
route_j = app.find("if(url.pathname==='/api/ai/decisions'", route_i)
if route_i < 0 or route_j < 0:
    raise SystemExit("[verify] live route boundaries missing")
live_route = app[route_i:route_j]

required = [
    "MEMEFLOW_LIVE_TOKEN_VISIBILITY_V4_SAFE",
    "preAdmissionPending:_pending",
    "preAdmissionRejected:_rejected",
    "preAdmissionHidden:0",
    "displayOnly:!_eligible&&!_isOpen",
    "state:_blocked?'BLOCKED':'WAITING'",
]
for needle in required:
    if needle not in live_route:
        raise SystemExit(f"[verify] missing invariant: {needle}")

if re.search(r"_hiddenBySettings\+\+;\s*continue", live_route):
    raise SystemExit("[verify] old silent-hiding path still exists")

# Trading feed must remain admitted-only.
trade_route = app[route_j:app.find("if(url.pathname==='/api/", route_j + 20) if app.find("if(url.pathname==='/api/", route_j + 20) > 0 else len(app)]
if "__mfAdmittedScannerTokensForUser(u.id)" not in app[route_j:route_j + 5000]:
    raise SystemExit("[verify] trading feed admission gate disappeared")

print("[verify] backend visibility/trading invariants OK")
PY

cd "$APP"

echo "[check] JavaScript syntax"
node --check app-server.mjs
node --check system-tokens.js
node --check settings-page.js

echo "[check] focused regressions"
node tests/strict-entry-admission.mjs
node tests/settings-architecture-v2.mjs
node tests/realtime-update-path.mjs
if [[ -f tests/live-market-truth.mjs ]]; then
  node tests/live-market-truth.mjs
fi

echo "[check] full test suite"
npm test

cd "$ROOT"

echo "[check] whitespace/diff"
git diff --check

echo "[diff] summary"
git diff --stat -- "${TARGETS[@]}"

# Only stage the project files this installer owns. All untracked ?? scripts stay untouched.
git add -- "${TARGETS[@]}"

if git diff --cached --quiet; then
  echo
  echo "DONE: repair is already present; nothing new to commit."
  trap - ERR
  exit 0
fi

echo "[git] commit"
git commit -m "fix: make live token states transparent and keep trading gated"

echo "[git] push main"
git push origin main

trap - ERR

echo
echo "DONE"
echo "- PENDING Entry Filter tokens => WAITING cards"
echo "- REJECTED Entry Filter tokens => BLOCKED cards"
echo "- BUY READY/trading remains strictly Entry-admitted"
echo "- Open positions remain visible"
echo "- SSE stays event-driven; UI burst refresh is coalesced"
echo "- untracked ?? patch files are ignored and never staged"
