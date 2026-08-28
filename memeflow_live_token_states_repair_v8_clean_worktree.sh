#!/usr/bin/env bash
set -Eeuo pipefail

echo "[MEMEFLOW] Live Token States repair v8-clean-worktree"

ROOT="${HOME}/workspace"
if [[ ! -d "$ROOT/.git" ]]; then
  ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
fi

if [[ -z "${ROOT:-}" || ! -d "$ROOT/.git" ]]; then
  echo "ERROR: Git repository not found." >&2
  exit 1
fi

cd "$ROOT"

# Never patch the dirty Replit worktree directly.
# Build/test/commit from a clean temporary worktree based on origin/main.
echo "[git] fetch origin/main"
git fetch origin main

TMP="$(mktemp -d /tmp/memeflow-v8-XXXXXX)"
PATCH_FILES=(
  "memeflow-app/app-server.mjs"
  "memeflow-app/tests/strict-entry-admission.mjs"
  "memeflow-app/tests/fresh-session-scanner.mjs"
  "memeflow-app/tests/settings-architecture-v2.mjs"
)

cleanup() {
  code=$?
  set +e
  cd "$ROOT"
  git worktree remove --force "$TMP" >/dev/null 2>&1 || true
  rm -rf "$TMP" >/dev/null 2>&1 || true
  if [[ $code -ne 0 ]]; then
    echo
    echo "[FAILED] v8 made no commit/push."
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


# ===========================================================================
# CORE BACKEND FIX
# ===========================================================================
app = load("app-server.mjs")

route_start = " if(url.pathname==='/api/system/live-token-states'&&req.method==='GET'){"
route_end = "if(url.pathname==='/api/ai/decisions'){"

new_route = r""" if(url.pathname==='/api/system/live-token-states'&&req.method==='GET'){
  // MEMEFLOW_LIVE_TOKEN_VISIBILITY_V8_CLEAN_WORKTREE
  //
  // SCANNER INVENTORY and TRADING ELIGIBILITY are separate concerns.
  //
  // DISPLAY:
  //   ADMITTED -> normal Logic state
  //   PENDING  -> WAITING with the real Entry Filter reason
  //   REJECTED -> BLOCKED with the real Entry Filter reason
  //   OPEN     -> always remains visible
  //
  // TRADE:
  //   /api/ai/decisions and execution remain STRICTLY Entry-admitted.
  const _requestedLimit=Math.floor(Number(url.searchParams.get('limit')||0));
  const _limit=Number.isFinite(_requestedLimit)&&_requestedLimit>0
    ? _requestedLimit
    : null;

  const _settings=store.settings(u.id);
  const _rawTokens=__mfLiveScannerTokens();
  const _openMints=__mfOpenPositionMints();

  // MEMEFLOW_REALTIME_UI_FAIRNESS_V1_ROUTE
  // Keep the existing realtime fairness contract: response construction yields
  // to Pump WS callbacks, and cached snapshots are revision-aware.
  // Cache identity also includes response shape.
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
      // Entry Filters still block trading. Live Token States shows the real
      // admission state instead of silently deleting the token.
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
    source:'system-live-token-states-transparent-v8',

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
    "MEMEFLOW_LIVE_TOKEN_VISIBILITY_V8_CLEAN_WORKTREE",
    "backend Live Token States visibility"
)
save("app-server.mjs", app)


# ===========================================================================
# strict-entry-admission regression
# ===========================================================================
strict = load("tests/strict-entry-admission.mjs")
start = "const liveStatesRoute=app.slice("
end = "const discovery=app.slice("

if "MEMEFLOW_LIVE_TOKEN_VISIBILITY_V8_CLEAN_WORKTREE" not in strict:
    i = strict.find(start)
    j = strict.find(end, i if i >= 0 else 0)
    if i < 0 or j < 0:
        raise SystemExit("[error] strict-entry-admission anchors not found")

    comment_anchor = "// Entry admission controls BOTH card visibility and trading eligibility."
    ci = strict.rfind(comment_anchor, 0, i)
    if ci >= 0 and i-ci < 500:
        i = ci

    block = r"""// MEMEFLOW_LIVE_TOKEN_VISIBILITY_V8_CLEAN_WORKTREE
// Entry admission strictly gates TRADING but classifies Live Token States.
const liveStatesRoute=app.slice(
  app.indexOf("if(url.pathname==='/api/system/live-token-states'"),
  app.indexOf("if(url.pathname==='/api/ai/decisions'")
);
assert.match(liveStatesRoute,/MEMEFLOW_LIVE_TOKEN_VISIBILITY_V8_CLEAN_WORKTREE/);
assert.match(liveStatesRoute,/MEMEFLOW_REALTIME_UI_FAIRNESS_V1_ROUTE/);
assert.match(liveStatesRoute,/const _rawTokens=__mfLiveScannerTokens\(\)/);
assert.match(liveStatesRoute,/state:_blocked\?'BLOCKED':'WAITING'/);
assert.match(liveStatesRoute,/preAdmissionPending:_pending/);
assert.match(liveStatesRoute,/preAdmissionRejected:_rejected/);
assert.match(liveStatesRoute,/preAdmissionHidden:0/);
assert.doesNotMatch(liveStatesRoute,/_hiddenBySettings\+\+;\s*continue/);

"""
    strict = strict[:i] + block + strict[j:]
    print("[apply] strict-entry-admission regression")
else:
    print("[skip] strict-entry-admission regression")

save("tests/strict-entry-admission.mjs", strict)


# ===========================================================================
# fresh-session-scanner regression
# ===========================================================================
fresh = load("tests/fresh-session-scanner.mjs")
fresh_start = "// Scanner sees all. Entry Filters control cards + trading."
fresh_end = "assert.doesNotMatch(app,/MEMEFLOW_AGE_THRESHOLD_WAKE_V1/);"

if "MEMEFLOW_LIVE_TOKEN_VISIBILITY_V8_CLEAN_WORKTREE" not in fresh:
    i = fresh.find(fresh_start)
    j = fresh.find(fresh_end, i if i >= 0 else 0)
    if i < 0 or j < 0:
        raise SystemExit("[error] fresh-session-scanner anchors not found")

    block = r"""// MEMEFLOW_LIVE_TOKEN_VISIBILITY_V8_CLEAN_WORKTREE
// Scanner sees all. Entry Filters classify Live Token States and strictly gate
// trading; they do not silently erase PENDING/REJECTED rows.
const liveRoute=app.slice(
  app.indexOf("if(url.pathname==='/api/system/live-token-states'"),
  app.indexOf("if(url.pathname==='/api/ai/decisions'")
);
assert.match(liveRoute,/MEMEFLOW_LIVE_TOKEN_VISIBILITY_V8_CLEAN_WORKTREE/);
assert.match(liveRoute,/MEMEFLOW_REALTIME_UI_FAIRNESS_V1_ROUTE/);
assert.match(liveRoute,/const _rawTokens=__mfLiveScannerTokens\(\)/);
assert.match(liveRoute,/state:_blocked\?'BLOCKED':'WAITING'/);
assert.match(liveRoute,/preAdmissionPending:_pending/);
assert.match(liveRoute,/preAdmissionRejected:_rejected/);
assert.match(liveRoute,/preAdmissionHidden:0/);
assert.match(liveRoute,/system-live-token-states-transparent-v8/);
assert.doesNotMatch(liveRoute,/_hiddenBySettings\+\+;\s*continue/);
assert.doesNotMatch(liveRoute,/Math\.min\(500/);
assert.doesNotMatch(liveRoute,/_rawTokens\.slice\(0,_lim\)/);

"""
    fresh = fresh[:i] + block + fresh[j:]
    print("[apply] fresh-session-scanner regression")
else:
    print("[skip] fresh-session-scanner regression")

save("tests/fresh-session-scanner.mjs", fresh)


# ===========================================================================
# settings architecture: repair only the stale hard-coded asset-version test.
# ===========================================================================
settings_test = load("tests/settings-architecture-v2.mjs")

old_asset = r"assert.match(html,/settings-page\.js\?v=ws-only-preopen-rpc-v1/);"
new_asset = (
    r"assert.match(html,/MEMEFLOW_SETTINGS_CACHE_CHAIN_FIX_V1/);"
    "\n"
    r"assert.match(html,/settings-page\.js\?v=[A-Za-z0-9._-]+/);"
)

if old_asset in settings_test:
    settings_test = settings_test.replace(old_asset, new_asset, 1)
    print("[apply] settings cache-buster regression")
elif "settings-page\\.js\\?v=[A-Za-z0-9._-]+" in settings_test:
    print("[skip] settings cache-buster regression")
else:
    raise SystemExit("[error] settings cache-buster assertion shape not found")

save("tests/settings-architecture-v2.mjs", settings_test)


# ===========================================================================
# Static invariants before Node tests.
# ===========================================================================
app = load("app-server.mjs")
ri = app.find("if(url.pathname==='/api/system/live-token-states'")
rj = app.find("if(url.pathname==='/api/ai/decisions'", ri)
if ri < 0 or rj < 0:
    raise SystemExit("[verify] live-token-states route boundaries missing")

route = app[ri:rj]

for needle in [
    "MEMEFLOW_LIVE_TOKEN_VISIBILITY_V8_CLEAN_WORKTREE",
    "MEMEFLOW_REALTIME_UI_FAIRNESS_V1_ROUTE",
    "const _rawTokens=__mfLiveScannerTokens()",
    "await __mfYieldToEventLoop()",
    "Number(_cached.liveRevision||0)===__mfLiveTokenRevision",
    "liveRevision:__mfLiveTokenRevision",
    "preAdmissionPending:_pending",
    "preAdmissionRejected:_rejected",
    "preAdmissionHidden:0",
    "state:_blocked?'BLOCKED':'WAITING'",
    "system-live-token-states-transparent-v8",
]:
    if needle not in route:
        raise SystemExit(f"[verify] missing invariant: {needle}")

if re.search(r"_hiddenBySettings\+\+;\s*continue", route):
    raise SystemExit("[verify] old silent-hide path remains")

trade = app[rj:rj+7000]
if "__mfAdmittedScannerTokensForUser(u.id)" not in trade:
    raise SystemExit("[verify] trading admission gate missing")

print("[verify] backend + realtime invariants OK")
PY

cd "$TMP/memeflow-app"

echo "[check] syntax"
node --check app-server.mjs

echo "[check] focused regressions"
node tests/settings-architecture-v2.mjs
node tests/strict-entry-admission.mjs
node tests/fresh-session-scanner.mjs
node tests/realtime-update-path.mjs
node tests/live-market-truth.mjs

echo "[check] FULL npm test"
npm test

cd "$TMP"

echo "[check] diff"
git diff --check
git diff --stat -- "${PATCH_FILES[@]}"

git add -- "${PATCH_FILES[@]}"

if git diff --cached --quiet; then
  echo "DONE: origin/main already contains v8; no commit needed."
  NEW_SHA="$(git rev-parse HEAD)"
else
  git commit -m "fix: restore complete live token states visibility"
  NEW_SHA="$(git rev-parse HEAD)"
  echo "[git] push verified commit -> main"
  git push origin HEAD:main
fi

# ---------------------------------------------------------------------------
# Replit local sync:
# Only replace files that are either clean or recognizable residue from the
# failed v4/v5/v6 attempts. Unknown user edits are preserved.
# ---------------------------------------------------------------------------
cd "$ROOT"
BACKUP_DIR="$ROOT/.memeflow-v8-recovery-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR"

sync_if_safe() {
  local file="$1"
  local residue_pattern="$2"

  if git diff --quiet -- "$file" && git diff --cached --quiet -- "$file"; then
    git restore --source="$NEW_SHA" --worktree --staged -- "$file"
    echo "[local] synced clean: $file"
    return
  fi

  if grep -Eq "$residue_pattern" "$file" 2>/dev/null; then
    mkdir -p "$BACKUP_DIR/$(dirname "$file")"
    cp -p "$file" "$BACKUP_DIR/$file"
    git restore --source="$NEW_SHA" --worktree --staged -- "$file"
    echo "[local] replaced known failed-installer residue: $file"
    return
  fi

  echo "[local] PRESERVED unknown local edit: $file"
}

sync_if_safe \
  "memeflow-app/app-server.mjs" \
  'MEMEFLOW_LIVE_TOKEN_VISIBILITY_V[456]_'

sync_if_safe \
  "memeflow-app/tests/strict-entry-admission.mjs" \
  'MEMEFLOW_LIVE_TOKEN_VISIBILITY_V[456]_'

sync_if_safe \
  "memeflow-app/tests/fresh-session-scanner.mjs" \
  'MEMEFLOW_LIVE_TOKEN_VISIBILITY_V[456]_'

sync_if_safe \
  "memeflow-app/tests/settings-architecture-v2.mjs" \
  'settings-page\\\.js\\\?v=\[A-Za-z0-9|Scanner scans all · filters classify cards'

if find "$BACKUP_DIR" -type f -print -quit 2>/dev/null | grep -q .; then
  echo "[local] recovery backup: $BACKUP_DIR"
else
  rmdir "$BACKUP_DIR" 2>/dev/null || true
fi

echo
echo "DONE"
echo "- clean temporary worktree used for patch/test/commit"
echo "- existing Replit M / D / ?? files did not block installation"
echo "- realtime fairness marker preserved"
echo "- PENDING => WAITING"
echo "- REJECTED => BLOCKED"
echo "- trading remains strictly Entry-admitted"
echo "- full npm test passed BEFORE push"
