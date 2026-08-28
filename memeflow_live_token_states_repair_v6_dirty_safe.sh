#!/usr/bin/env bash
set -Eeuo pipefail

echo "[MEMEFLOW] Live Token States repair v6-dirty-safe"

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
  "memeflow-app/tests/settings-architecture-v2.mjs"
  "memeflow-app/tests/fresh-session-scanner.mjs"
)

for f in "${TARGETS[@]}"; do
  if [[ ! -f "$f" ]]; then
    echo "ERROR: required file missing: $f" >&2
    exit 1
  fi
done

# Ignore every unrelated M / D / ?? file in the Replit workspace.
# Protect only files that THIS installer edits.
if ! git diff --quiet -- "${TARGETS[@]}" || \
   ! git diff --cached --quiet -- "${TARGETS[@]}"; then
  echo "ERROR: one of this installer's target files already has local edits." >&2
  git status --short -- "${TARGETS[@]}"
  exit 1
fi

echo "[ok] unrelated workspace M / D / ?? files are ignored"

# Fetch does not rewrite the dirty worktree.
echo "[git] fetch origin/main"
git fetch origin main

LOCAL_HEAD="$(git rev-parse HEAD)"
REMOTE_HEAD="$(git rev-parse origin/main)"

if [[ "$LOCAL_HEAD" != "$REMOTE_HEAD" ]]; then
  if git merge-base --is-ancestor "$LOCAL_HEAD" "$REMOTE_HEAD"; then
    echo "[git] safe fast-forward to origin/main"
    git merge --ff-only "$REMOTE_HEAD"
  elif git merge-base --is-ancestor "$REMOTE_HEAD" "$LOCAL_HEAD"; then
    echo "ERROR: local branch has commits not on origin/main; refusing to push them." >&2
    exit 1
  else
    echo "ERROR: local branch and origin/main diverged." >&2
    exit 1
  fi
fi

rollback() {
  code=$?
  if [[ $code -ne 0 ]]; then
    echo
    echo "[rollback] patch/check failed"
    echo "[rollback] restoring ONLY this installer's target files"
    git restore --staged --worktree -- "${TARGETS[@]}" 2>/dev/null || true
    echo "[rollback] unrelated M / D / ?? files were left untouched"
    echo "[rollback] no commit/push was made"
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

def replace_section(text, start, end, replacement, marker, label):
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

def replace_first_available(text, olds, new, installed_marker, label, required=False):
    if installed_marker in text:
        print(f"[skip] {label}: already installed")
        return text
    for old in olds:
        if old in text:
            print(f"[apply] {label}")
            return text.replace(old, new, 1)
    if required:
        raise SystemExit(f"[error] {label}: compatible source shape not found")
    print(f"[skip] {label}: source shape changed / not needed")
    return text


# ===========================================================================
# 1) BACKEND: scanner visibility and trading eligibility are separate.
# ===========================================================================
app = load("app-server.mjs")

route_start = " if(url.pathname==='/api/system/live-token-states'&&req.method==='GET'){"
route_end = "if(url.pathname==='/api/ai/decisions'){"

new_route = r""" if(url.pathname==='/api/system/live-token-states'&&req.method==='GET'){
  // MEMEFLOW_LIVE_TOKEN_VISIBILITY_V6_DIRTY_SAFE
  //
  // SCAN: every Pump token in the hot scanner cache.
  //
  // DISPLAY:
  //   ADMITTED -> normal Logic state (WAITING / WATCH / BUY READY / BLOCKED)
  //   PENDING  -> WAITING with the real Entry Filter reason
  //   REJECTED -> BLOCKED with the real Entry Filter reason
  //   OPEN     -> always remains visible
  //
  // TRADE:
  //   /api/ai/decisions + execution remain STRICTLY Entry-admitted.
  //
  // Missing/unfinished filter data is a visible state, not a reason to erase
  // the token from Live Token States.
  const _requestedLimit=Math.floor(Number(url.searchParams.get('limit')||0));
  const _limit=Number.isFinite(_requestedLimit)&&_requestedLimit>0
    ? _requestedLimit
    : null;

  const _settings=store.settings(u.id);
  const _rawTokens=__mfLiveScannerTokens();
  const _openMints=__mfOpenPositionMints();

  // MEMEFLOW_REALTIME_UI_FAIRNESS_V1_ROUTE
  // Include response shape in cache identity. A limit=200 response must never
  // be reused for an unlimited request (or another limit).
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

    // Yield so large UI snapshots cannot starve Pump WebSocket callbacks.
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
      // Entry Filters still block trading. The UI gets admission truth instead
      // of silently losing the token.
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
    source:'system-live-token-states-transparent-v6',

    rawScannerTokens:_rawTokens.length,
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

app = replace_section(
    app,
    route_start,
    route_end,
    new_route,
    "MEMEFLOW_LIVE_TOKEN_VISIBILITY_V6_DIRTY_SAFE",
    "backend Live Token States visibility"
)
save("app-server.mjs", app)


# ===========================================================================
# 2) FRONTEND: event-driven refresh, but coalesce Pump bursts.
# ===========================================================================
ui = load("system-tokens.js")

if "MEMEFLOW_REALTIME_COALESCE_V6_DIRTY_SAFE" in ui:
    print("[skip] frontend realtime coalescing: already installed")
else:
    schedule_start = "function __mfScheduleRealtimeRefresh(event = null) {"
    connect_start = "function __mfConnectTokenStateStream() {"
    i = ui.find(schedule_start)
    j = ui.find(connect_start, i if i >= 0 else 0)

    if i >= 0 and j > i:
        block = ui[i:j]
        if "}, 80);" in block:
            block = block.replace(
                schedule_start,
                "/* MEMEFLOW_REALTIME_COALESCE_V6_DIRTY_SAFE */\n"
                "const __MF_REALTIME_COALESCE_MS = 250;\n\n"
                + schedule_start,
                1
            )
            block = block.replace(
                "}, 80);",
                "}, __MF_REALTIME_COALESCE_MS);",
                1
            )
            ui = ui[:i] + block + ui[j:]
            print("[apply] frontend realtime coalescing")
        else:
            print("[skip] frontend realtime coalescing: timer already changed")
    else:
        print("[skip] frontend realtime coalescing: anchors not found")


# ===========================================================================
# 3) FRONTEND: show scanner/admission truth in telemetry.
# ===========================================================================
diag_marker = "MEMEFLOW_LIVE_DIAGNOSTICS_V6_DIRTY_SAFE"
if diag_marker in ui:
    print("[skip] frontend live diagnostics: already installed")
else:
    diag_start = "    const persisted = Number(payload?.persistedTokens);"
    diag_end = "    $('lastUpdate').textContent = parts.join(' · ');"

    i = ui.find(diag_start)
    j = ui.find(diag_end, i if i >= 0 else 0)

    if i >= 0 and j >= 0:
        j += len(diag_end)
        diag = r"""    // MEMEFLOW_LIVE_DIAGNOSTICS_V6_DIRTY_SAFE
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
        print("[apply] frontend live diagnostics")
    else:
        print("[skip] frontend live diagnostics: legacy telemetry block not present")

save("system-tokens.js", ui)


# ===========================================================================
# 4) SETTINGS wording: describe the real split.
# ===========================================================================
settings = load("settings-page.js")
settings = replace_first_available(
    settings,
    [
        "Scanner scans all · these filters control cards + trading",
        "Trading eligibility · scanner and cards always stay live"
    ],
    "Scanner scans all · filters classify cards and gate trading",
    "Scanner scans all · filters classify cards and gate trading",
    "settings helper text",
    required=False
)
save("settings-page.js", settings)


# ===========================================================================
# 5) Cache-bust repaired Live Token States JS.
# ===========================================================================
html = load("system-tokens.html")
if "live-visibility-v6-dirty-safe-20260826" in html:
    print("[skip] system-tokens cache buster: already installed")
else:
    pattern = re.compile(r'(/system-tokens\.js\?v=)[^"\']+')
    html2, count = pattern.subn(
        r'\1live-visibility-v6-dirty-safe-20260826',
        html,
        count=1
    )
    if count:
        html = html2
        print("[apply] system-tokens cache buster")
    else:
        print("[skip] system-tokens cache buster: versioned script tag not found")
save("system-tokens.html", html)


# ===========================================================================
# 6) strict-entry-admission regression.
# ===========================================================================
strict = load("tests/strict-entry-admission.mjs")

strict_start = "const liveStatesRoute=app.slice("
strict_end = "const discovery=app.slice("

if "MEMEFLOW_LIVE_TOKEN_VISIBILITY_V6_DIRTY_SAFE" in strict:
    print("[skip] strict-entry-admission regression: already installed")
else:
    i = strict.find(strict_start)
    j = strict.find(strict_end, i if i >= 0 else 0)
    if i < 0 or j < 0:
        raise SystemExit("[error] strict-entry-admission test anchors not found")

    comment_anchor = "// Entry admission controls BOTH card visibility and trading eligibility."
    ci = strict.rfind(comment_anchor, 0, i)
    if ci >= 0 and i-ci < 500:
        i = ci

    block = r"""// MEMEFLOW_LIVE_TOKEN_VISIBILITY_V6_DIRTY_SAFE
// Entry admission strictly gates TRADING but classifies Live Token States.
// PENDING remains visible as WAITING; REJECTED remains visible as BLOCKED.
const liveStatesRoute=app.slice(
  app.indexOf("if(url.pathname==='/api/system/live-token-states'"),
  app.indexOf("if(url.pathname==='/api/ai/decisions'")
);
assert.match(liveStatesRoute,/MEMEFLOW_LIVE_TOKEN_VISIBILITY_V6_DIRTY_SAFE/);
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
    strict = strict[:i] + block + strict[j:]
    print("[apply] strict-entry-admission regression")

save("tests/strict-entry-admission.mjs", strict)


# ===========================================================================
# 7) fresh-session-scanner old test required the broken hiding behavior.
# ===========================================================================
fresh = load("tests/fresh-session-scanner.mjs")

fresh_start = "// Scanner sees all. Entry Filters control cards + trading."
fresh_end = "assert.doesNotMatch(app,/MEMEFLOW_AGE_THRESHOLD_WAKE_V1/);"

if "MEMEFLOW_LIVE_TOKEN_VISIBILITY_V6_DIRTY_SAFE" in fresh:
    print("[skip] fresh-session visibility regression: already installed")
else:
    i = fresh.find(fresh_start)
    j = fresh.find(fresh_end, i if i >= 0 else 0)
    if i < 0 or j < 0:
        raise SystemExit("[error] fresh-session visibility test anchors not found")

    block = r"""// MEMEFLOW_LIVE_TOKEN_VISIBILITY_V6_DIRTY_SAFE
// Scanner sees all. Entry Filters classify Live Token States and strictly gate
// trading. They must never silently erase PENDING/REJECTED rows from this UI.
const liveRoute=app.slice(
  app.indexOf("if(url.pathname==='/api/system/live-token-states'"),
  app.indexOf("if(url.pathname==='/api/ai/decisions'")
);
assert.match(liveRoute,/MEMEFLOW_LIVE_TOKEN_VISIBILITY_V6_DIRTY_SAFE/);
assert.match(liveRoute,/const _rawTokens=__mfLiveScannerTokens\(\)/);
assert.match(liveRoute,/state:_blocked\?'BLOCKED':'WAITING'/);
assert.match(liveRoute,/preAdmissionPending:_pending/);
assert.match(liveRoute,/preAdmissionRejected:_rejected/);
assert.match(liveRoute,/preAdmissionHidden:0/);
assert.match(liveRoute,/system-live-token-states-transparent-v6/);
assert.doesNotMatch(liveRoute,/_hiddenBySettings\+\+;\s*continue/);
assert.doesNotMatch(liveRoute,/Math\.min\(500/);
assert.doesNotMatch(liveRoute,/_rawTokens\.slice\(0,_lim\)/);

"""
    fresh = fresh[:i] + block + fresh[j:]
    print("[apply] fresh-session visibility regression")

save("tests/fresh-session-scanner.mjs", fresh)


# ===========================================================================
# 8) settings-architecture regression.
# Fix BOTH stale expectations:
#   a) old Entry Filter helper wording
#   b) old hard-coded settings-page.js cache-buster
# ===========================================================================
settings_test = load("tests/settings-architecture-v2.mjs")

new_wording_assert = (
    r"assert.match(settingsPage,/Scanner scans all · filters classify cards and gate trading/);"
)
if new_wording_assert in settings_test:
    print("[skip] settings wording regression: already installed")
else:
    candidates = [
        r"assert.match(settingsPage,/Scanner scans all · these filters control cards \+ trading/);",
        r"assert.match(settingsPage,/Trading eligibility only/);"
    ]
    changed = False
    for old in candidates:
        if old in settings_test:
            settings_test = settings_test.replace(old, new_wording_assert, 1)
            changed = True
            print("[apply] settings wording regression")
            break
    if not changed:
        print("[skip] settings wording regression: old assertion not found")

# The application intentionally changes asset versions for cache invalidation.
# Test the contract (versioned module script exists), not one obsolete hash.
old_asset_assert = r"assert.match(html,/settings-page\.js\?v=ws-only-preopen-rpc-v1/);"
new_asset_assert = (
    r"assert.match(html,/MEMEFLOW_SETTINGS_CACHE_CHAIN_FIX_V1/);"
    "\n"
    r"assert.match(html,/settings-page\.js\?v=[A-Za-z0-9._-]+/);"
)
if new_asset_assert in settings_test:
    print("[skip] settings cache-buster regression: already installed")
elif old_asset_assert in settings_test:
    settings_test = settings_test.replace(old_asset_assert, new_asset_assert, 1)
    print("[apply] settings cache-buster regression")
else:
    # Compatible fallback for any hard-coded settings-page.js version assertion.
    pattern = re.compile(
        r"assert\.match\(html,/settings-page\\\.js\\\?v=[^/]+/\);"
    )
    if pattern.search(settings_test):
        settings_test = pattern.sub(new_asset_assert, settings_test, count=1)
        print("[apply] settings cache-buster regression (generic old version)")
    else:
        raise SystemExit(
            "[error] settings cache-buster assertion shape not found"
        )

save("tests/settings-architecture-v2.mjs", settings_test)


# ===========================================================================
# 9) Install-time invariants.
# ===========================================================================
app = load("app-server.mjs")
route_i = app.find("if(url.pathname==='/api/system/live-token-states'")
route_j = app.find("if(url.pathname==='/api/ai/decisions'", route_i)
if route_i < 0 or route_j < 0:
    raise SystemExit("[verify] Live Token States route boundaries missing")

live_route = app[route_i:route_j]
for needle in [
    "MEMEFLOW_LIVE_TOKEN_VISIBILITY_V6_DIRTY_SAFE",
    "const _rawTokens=__mfLiveScannerTokens()",
    "preAdmissionPending:_pending",
    "preAdmissionRejected:_rejected",
    "preAdmissionHidden:0",
    "displayOnly:!_eligible&&!_isOpen",
    "state:_blocked?'BLOCKED':'WAITING'",
    "system-live-token-states-transparent-v6",
]:
    if needle not in live_route:
        raise SystemExit(f"[verify] missing invariant: {needle}")

if re.search(r"_hiddenBySettings\+\+;\s*continue", live_route):
    raise SystemExit("[verify] old silent-hiding path still exists")

trade_window = app[route_j:route_j + 7000]
if "__mfAdmittedScannerTokensForUser(u.id)" not in trade_window:
    raise SystemExit("[verify] /api/ai/decisions admission gate disappeared")

ui = load("system-tokens.js")
if "new EventSource('/api/system/stream')" not in ui:
    raise SystemExit("[verify] EventSource realtime stream disappeared")
if "readyState !== EventSource.OPEN" not in ui:
    raise SystemExit("[verify] disconnected-only polling fallback disappeared")

settings_test = load("tests/settings-architecture-v2.mjs")
if "ws-only-preopen-rpc-v1" in settings_test:
    raise SystemExit("[verify] obsolete settings-page cache-buster assertion remains")
if "settings-page\\.js\\?v=[A-Za-z0-9._-]+" not in settings_test:
    raise SystemExit("[verify] flexible settings-page asset assertion missing")

print("[verify] visibility/trading/realtime/settings-test invariants OK")
PY

cd "$APP"

echo "[check] syntax"
node --check app-server.mjs
node --check system-tokens.js
node --check settings-page.js

echo "[check] focused regressions"
node tests/settings-architecture-v2.mjs
node tests/strict-entry-admission.mjs
node tests/fresh-session-scanner.mjs
node tests/realtime-update-path.mjs
if [[ -f tests/live-market-truth.mjs ]]; then
  node tests/live-market-truth.mjs
fi

echo "[check] FULL npm test"
npm test

cd "$ROOT"

echo "[check] patch diff"
git diff --check -- "${TARGETS[@]}"
git diff --stat -- "${TARGETS[@]}"

# Stage only our files. Existing unrelated staged/unstaged changes stay intact.
git add -- "${TARGETS[@]}"

if git diff --cached --quiet -- "${TARGETS[@]}"; then
  echo
  echo "DONE: v6 changes were already present; nothing to commit."
  trap - ERR
  exit 0
fi

echo "[git] commit ONLY this patch's files"
git commit --only -m "fix: restore complete live token states visibility" -- "${TARGETS[@]}"

echo "[git] push main"
git push origin HEAD:main

trap - ERR

echo
echo "DONE"
echo "- unrelated workspace M / D / ?? files ignored"
echo "- PENDING => WAITING"
echo "- REJECTED => BLOCKED"
echo "- BUY READY/execution still strictly Entry-admitted"
echo "- realtime remains SSE/event-driven"
echo "- stale settings cache-buster test repaired"
echo "- full npm test passed before commit/push"
