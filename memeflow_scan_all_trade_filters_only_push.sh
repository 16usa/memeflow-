#!/usr/bin/env bash
set -euo pipefail

echo "== MEMEFLOW: separate SCAN/DISPLAY from TRADE filters =="

if [[ -d "memeflow-app" && -f "memeflow-app/app-server.mjs" ]]; then
  cd memeflow-app
elif [[ -f "app-server.mjs" && -d "src" && -d "tests" ]]; then
  :
else
  echo "ERROR: Run from ~/workspace or memeflow-app."
  exit 1
fi

python3 - <<'PY'
from pathlib import Path

def replace_once(path, old, new, label):
    p = Path(path)
    s = p.read_text()
    if old in s:
        p.write_text(s.replace(old, new, 1))
        print(f"patched: {path} :: {label}")
        return True
    if new in s:
        print(f"already patched: {path} :: {label}")
        return False
    raise SystemExit(f"PATCH FAILED [{label}] in {path}")

# ============================================================================
# app-server.mjs
# ============================================================================
p = Path("app-server.mjs")
app = p.read_text()

# 1) Remove the duplicate age wake that was added by the previous patch.
# The project already has __mfPreAdmissionSweepTimer every 2s.
wake_start = app.find("// MEMEFLOW_AGE_THRESHOLD_WAKE_V1")
wake_end = app.find("// A TradeEvent causes immediate admission re-check.", wake_start)
if wake_start >= 0 and wake_end > wake_start:
    app = app[:wake_start] + app[wake_end:]
    print("patched: app-server.mjs :: removed duplicate age wake scheduler")
elif "MEMEFLOW_AGE_THRESHOLD_WAKE_V1" not in app:
    print("already patched: app-server.mjs :: duplicate age wake absent")
else:
    raise SystemExit("PATCH FAILED: could not isolate duplicate age scheduler")

# 2) Rewrite the canonical sweep comment: this is a TRADE gate transition,
# never a scanner/display visibility transition.
app = app.replace(
"""// A TradeEvent causes immediate admission re-check. This sweep exists only for
// gates that can change without a trade event (most importantly minimum age).
// It triggers a full evaluation only on a hidden -> admitted transition.
""",
"""// MEMEFLOW_SCAN_DISPLAY_TRADE_SPLIT_V1
// A TradeEvent causes immediate TRADE-eligibility re-check. This sweep exists
// for gates that can change without a trade event (most importantly token age).
// It triggers trading evaluation only on trade-ineligible -> trade-eligible.
// Scanner ingestion and Live Token States visibility are NEVER gated here.
""",
1
)

# 3) Raw scanner retention must never be destroyed by user trading settings.
stable_prune = """    const age=Math.max(0,now-Number(token.discoveredAt||now));
    if(age>=15_000&&__mfAllActiveUsersStableBlocked(mint,now)){
      __mfDropScannerToken(mint,'STABLE_SETTINGS_REJECTED');
      continue;
    }

"""
if stable_prune in app:
    app = app.replace(
        stable_prune,
"""    // MEMEFLOW_SCAN_DISPLAY_TRADE_SPLIT_V1
    // User settings may block a TRADE, but they never delete the raw Pump
    // scanner row. Raw retention is controlled only by session/TTL lifecycle.

""",
        1
    )
    print("patched: app-server.mjs :: settings no longer delete raw scanner rows")
elif "STABLE_SETTINGS_REJECTED" not in app:
    print("already patched: app-server.mjs :: no settings-based raw prune")
else:
    raise SystemExit("PATCH FAILED: stable settings prune shape changed")

# 4) All real Pump trades must be retained as scanner/chart evidence,
# regardless of whether any user is currently trade-eligible.
trade_gate = """  // MEMEFLOW_STRICT_ENTRY_ADMISSION_V1
  if(!__mfAnyActiveEntryAdmitted(token))return;

"""
if trade_gate in app:
    app = app.replace(
        trade_gate,
"""  // MEMEFLOW_SCAN_DISPLAY_TRADE_SPLIT_V1
  // Keep real Pump TradeEvent evidence for EVERY scanned token.
  // User settings are checked later by evaluateAll()/trading execution.

""",
        1
    )
    print("patched: app-server.mjs :: chart/trade evidence no longer settings-gated")
elif "if(!__mfAnyActiveEntryAdmitted(token))return;" not in app:
    print("already patched: app-server.mjs :: publishTrade is scan-all")
else:
    raise SystemExit("PATCH FAILED: publishTrade admission gate shape changed")

# 5) Legacy Phase A/recovery must also collect data independently of user filters.
legacy_settings_gate = """  const settingsAdmission=settingsGateCheck(token);
  if(settingsAdmission?.allow===false&&settingsAdmission.retryable!==true){
    try{Promise.resolve(evaluateAll(token)).catch(()=>{})}catch{}
    try{publish(mint)}catch{}
    return false;
  }

"""
if legacy_settings_gate in app:
    app = app.replace(
        legacy_settings_gate,
"""  // MEMEFLOW_SCAN_DISPLAY_TRADE_SPLIT_V1
  // Data collection is unconditional. evaluateAll() remains the trade gate.

""",
        1
    )
    print("patched: app-server.mjs :: fast Phase A no longer settings-gated")
elif "Data collection is unconditional. evaluateAll() remains the trade gate." in app:
    print("already patched: app-server.mjs :: Phase A scan-all")
else:
    raise SystemExit("PATCH FAILED: legacy Phase A settings gate not found")

legacy_holder_gate = """    // MEMEFLOW_V12_9_PRE_QUEUE_ADMISSION_FAST
    const admission=holderAdmissionForActiveUsers(mint);

    if(admission?.allow!==false){
      holderQueue.enqueue(mint);

      const after=holderQueue.inspect?.(mint)||null;
      if(!before?.pending && (after?.pending||after?.active||Number(after?.attempts||0)>0)){
        fastPhaseMetrics.holderQueued++;
      }
    }
"""
if legacy_holder_gate in app:
    app = app.replace(
        legacy_holder_gate,
"""    // MEMEFLOW_SCAN_DISPLAY_TRADE_SPLIT_V1
    // Holder evidence belongs to scanning, not to trade eligibility.
    holderQueue.enqueue(mint);

    const after=holderQueue.inspect?.(mint)||null;
    if(!before?.pending && (after?.pending||after?.active||Number(after?.attempts||0)>0)){
      fastPhaseMetrics.holderQueued++;
    }
""",
        1
    )
    print("patched: app-server.mjs :: holder collection no longer settings-gated")
elif "Holder evidence belongs to scanning, not to trade eligibility." in app:
    print("already patched: app-server.mjs :: holder scan-all")
else:
    raise SystemExit("PATCH FAILED: fast holder admission block not found")

bridge_settings_gate = """  const settingsAdmission=settingsGateCheck(token);
  if(settingsAdmission?.allow===false){
    bridgeMetrics.settingsRejectedSkipped++;
    return;
  }

"""
if bridge_settings_gate in app:
    app = app.replace(
        bridge_settings_gate,
"""  // MEMEFLOW_SCAN_DISPLAY_TRADE_SPLIT_V1
  // Recovery repairs scanner data for every Pump token. No user settings here.

""",
        1
    )
    print("patched: app-server.mjs :: bridge repair no longer settings-gated")
elif "Recovery repairs scanner data for every Pump token." in app:
    print("already patched: app-server.mjs :: bridge repair scan-all")
else:
    raise SystemExit("PATCH FAILED: bridge settings gate not found")

bridge_holder_gate = """        // MEMEFLOW_V12_9_PRE_QUEUE_ADMISSION_BRIDGE
        const admission=holderAdmissionForActiveUsers(mint);

        if(admission?.allow!==false){
          const queued=holderQueue.enqueue(mint);
          if(queued!==false){
            st.holderAt=now;
            bridgeMetrics.holderRescued++;
          }
        }else{
          // throttle bridge retries while cheap market data is still developing
          st.holderAt=now;
        }
"""
if bridge_holder_gate in app:
    app = app.replace(
        bridge_holder_gate,
"""        // MEMEFLOW_SCAN_DISPLAY_TRADE_SPLIT_V1
        // Repair holder evidence for every scanned Pump token.
        const queued=holderQueue.enqueue(mint);
        if(queued!==false){
          st.holderAt=now;
          bridgeMetrics.holderRescued++;
        }
""",
        1
    )
    print("patched: app-server.mjs :: bridge holder recovery no longer settings-gated")
elif "Repair holder evidence for every scanned Pump token." in app:
    print("already patched: app-server.mjs :: bridge holder scan-all")
else:
    raise SystemExit("PATCH FAILED: bridge holder admission block not found")

bridge_filter = """    const settingsContext=settingsGateContext(now);
    const all=Object.values(store?.state?.tokens||{})
      .filter(t=>bridgeIsPump(t)&&bridgeAgeMs(t,now)<=BRIDGE_MAX_AGE_MS&&bridgeAgeMs(t,now)>=BRIDGE_MIN_TOKEN_AGE_MS)
      .filter(t=>!settingsGateCachedRejection(t,settingsContext,now));
"""
if bridge_filter in app:
    app = app.replace(
        bridge_filter,
"""    // MEMEFLOW_SCAN_DISPLAY_TRADE_SPLIT_V1
    // Recovery inventory is the raw Pump scanner inventory, never a
    // user-settings subset.
    const all=Object.values(store?.state?.tokens||{})
      .filter(t=>bridgeIsPump(t)&&bridgeAgeMs(t,now)<=BRIDGE_MAX_AGE_MS&&bridgeAgeMs(t,now)>=BRIDGE_MIN_TOKEN_AGE_MS);
""",
        1
    )
    print("patched: app-server.mjs :: discovery bridge scans all Pump tokens")
elif "Recovery inventory is the raw Pump scanner inventory" in app:
    print("already patched: app-server.mjs :: bridge inventory scan-all")
else:
    raise SystemExit("PATCH FAILED: bridge inventory settings filter not found")

# 6) Candidate view carries an explicit trade eligibility flag.
candidate_anchor = """    state:d.state,
    score:d.score,
"""
candidate_new = """    state:d.state,
    score:d.score,
    // MEMEFLOW_SCAN_DISPLAY_TRADE_SPLIT_V1
    // Visibility != trading permission.
    tradeEligible:d.tradeEligible===true,
    displayOnly:d.displayOnly===true,
    entryAdmissionState:d.entryAdmissionState||null,
    entryAdmissionReasons:Array.isArray(d.entryAdmissionReasons)?d.entryAdmissionReasons:[],
"""
if candidate_anchor in app:
    app = app.replace(candidate_anchor, candidate_new, 1)
    print("patched: app-server.mjs :: candidate view exposes trade eligibility")
elif "tradeEligible:d.tradeEligible===true" in app:
    print("already patched: app-server.mjs :: candidate view trade flags")
else:
    raise SystemExit("PATCH FAILED: candidateView insertion anchor not found")

# 7) Replace Live Token States route.
# This route MUST render all raw scanner tokens and use settings only to
# describe/gate trading eligibility. Display evaluation has NO side effects.
route_start_marker = " if(url.pathname==='/api/system/live-token-states'&&req.method==='GET'){"
route_end_marker = "if(url.pathname==='/api/ai/decisions'){"
rs = app.find(route_start_marker)
re = app.find(route_end_marker, rs)
if rs < 0 or re < 0:
    raise SystemExit("PATCH FAILED: live-token-states route boundaries not found")

current_route = app[rs:re]
if "MEMEFLOW_SCAN_DISPLAY_TRADE_SPLIT_V1_ROUTE" not in current_route:
    new_route = r""" if(url.pathname==='/api/system/live-token-states'&&req.method==='GET'){
  // MEMEFLOW_SCAN_DISPLAY_TRADE_SPLIT_V1_ROUTE
  // DISPLAY: every raw Pump scanner token.
  // TRADE: user Entry Filters + Logic still gate decisions/execution.
  // This endpoint never creates a trading decision merely to render a card.
  const _lim=Math.min(500,Math.max(1,Number(url.searchParams.get('limit')||500)));
  const _settings=store.settings(u.id);
  const _rawTokens=__mfLiveScannerTokens();
  const _tokens=_rawTokens.slice(0,_lim);

  let _tradeEligible=0;
  let _tradeIneligible=0;
  let _displayEvaluated=0;
  let _evalErrors=0;
  let _viewErrors=0;

  const _displayRows=[];

  for(const _token of _tokens){
    const _mint=String(_token?.mint||'').trim();
    if(!_mint)continue;

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
    if(_eligible)_tradeEligible++;
    else _tradeIneligible++;

    const _key=u.id+':'+_mint;

    // Reuse a real trading decision only when one already exists.
    // Otherwise perform a pure display evaluation; DO NOT store it and
    // DO NOT call __mfHandleDecision.
    let _decision=
      _eligible
        ? (store.state.decisions?.[_key]||null)
        : null;

    if(!_decision){
      try{
        _decision=evaluate(_token,_settings);
        _displayEvaluated++;
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

    _displayRows.push({
      ..._decision,
      mint:_mint,
      tradeEligible:_eligible,
      displayOnly:!_eligible,
      entryAdmissionState:_admission?.state||null,
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
    try{
      _unrankedViews.push(candidateView(_decision));
    }catch(_error){
      _viewErrors++;
    }
  }

  // State priority remains UI-only. It never changes scanner inclusion.
  const _rankedViews=rankCandidateViews(_unrankedViews);
  const _views=_rankedViews.slice(0,_lim);

  return json(res,200,{
    decisions:_views,
    total:_rawTokens.length,
    returned:_views.length,
    limit:_lim,
    source:'system-live-token-states-scan-all-v1',

    // Scanner/display truth.
    rawScannerTokens:_rawTokens.length,
    displayedScannerTokens:_tokens.length,

    // Trading gate truth.
    tradeEligible:_tradeEligible,
    tradeIneligible:_tradeIneligible,

    // Compatibility aliases. "Hidden" is intentionally always zero now.
    persistedTokens:_tokens.length,
    preAdmissionAdmitted:_tradeEligible,
    preAdmissionHidden:0,

    // Display evaluation is deliberately side-effect free.
    displayEvaluated:_displayEvaluated,
    recovered:0,
    reindexed:0,
    evaluationErrors:_evalErrors,
    viewErrors:_viewErrors,
    stateCounts:_stateCounts,
    counts:_counts
  });
 }
"""
    app = app[:rs] + new_route + app[re:]
    print("patched: app-server.mjs :: Live Token States now displays ALL raw scanner tokens")
else:
    print("already patched: app-server.mjs :: scan/display/trade route")

# 8) Clarify /api/ai/decisions: unlike Live Token States, this remains a
# trading-decision feed and therefore SHOULD stay settings-gated.
ai_marker = """if(url.pathname==='/api/ai/decisions'){
  const _lim="""
ai_new = """if(url.pathname==='/api/ai/decisions'){
  // MEMEFLOW_SCAN_DISPLAY_TRADE_SPLIT_V1
  // This is the TRADING decision feed, so Entry Filters intentionally apply.
  // Live Token States uses raw scanner inventory instead.
  const _lim="""
if ai_marker in app:
    app = app.replace(ai_marker, ai_new, 1)
    print("patched: app-server.mjs :: trading feed contract documented")
elif "This is the TRADING decision feed" in app:
    print("already patched: app-server.mjs :: trading feed contract")
else:
    raise SystemExit("PATCH FAILED: /api/ai/decisions anchor not found")

p.write_text(app)

# ============================================================================
# settings-gate.mjs — semantics/comments only; keep stable API names.
# ============================================================================
replace_once(
    "src/settings-gate.mjs",
"""// 1) ENTRY_ADMISSION_KEYS
//    Decide whether a token is visible in Live Token States.
//    FAIL/WAITING => hidden lightweight PRE-ADMISSION telemetry.
//
// 2) LOGIC_DECISION_KEYS
//    Run only AFTER admission. They may produce WAITING / WATCH / BUY READY,
//    but they must never hide an otherwise admitted token from the feed.
//
// 3) PREOPEN_RPC_KEYS
//    Heavy linked/funded-wallet verification. These are FINAL-ONLY and remain
//    behind BUY READY. They never participate in discovery/admission.
""",
"""// 1) ENTRY_ADMISSION_KEYS
//    Decide TRADE eligibility only. They never control Pump discovery,
//    scanner retention, data collection, or Live Token States visibility.
//
// 2) LOGIC_DECISION_KEYS
//    Run only AFTER trade admission. They may produce WAITING / WATCH /
//    BUY READY, but they never remove a token from scanner/display inventory.
//
// 3) PREOPEN_RPC_KEYS
//    Heavy linked/funded-wallet verification. These are FINAL-ONLY and remain
//    behind BUY READY. They never participate in scanner/display admission.
""",
    "Entry filters documented as trade-only"
)

# ============================================================================
# Settings UI — make semantics explicit to the user.
# ============================================================================
replace_once(
    "settings-page.js",
    "['filters', 'Entry filters', 'Scanner admission only · WebSocket evidence and user filters', false, [",
    "['filters', 'Entry filters', 'Trading eligibility only · scanner and cards always stay live', false, [",
    "standalone settings label"
)

replace_once(
    "system.js",
    "['filters', 'Entry filters', 'Scanner admission · WebSocket evidence and user filters', false, [",
    "['filters', 'Entry filters', 'Trading eligibility · scanner and cards always stay live', false, [",
    "system settings label"
)

# ============================================================================
# Tests
# ============================================================================
tp = Path("tests/fresh-session-scanner.mjs")
test = tp.read_text()

old = """assert.match(app,/const _rawTokens=__mfLiveScannerTokens\\(\\)/);
assert.match(app,/const _admittedAll=_rawTokens\\.filter/);
assert.match(app,/const _tokens=_admittedAll\\.slice\\(0,_lim\\)/);
assert.match(app,/freshScannerTokens:__mfLiveScannerTokens\\(\\)\\.length/);
assert.match(app,/setHeader\\('cache-control','no-store'\\)/);

// MEMEFLOW_AGE_THRESHOLD_WAKE_V1 regression
// A configured minimum age is a CLOCK transition; it must not depend on a
// later BUY/SELL event to re-run Entry Admission.
assert.match(app,/MEMEFLOW_AGE_THRESHOLD_WAKE_V1/);
assert.match(app,/function __mfRunAgeAdmissionWake\\(\\)/);
assert.match(app,/tokenAgeMinutes\\(token,now\\)/);
assert.match(app,/Promise\\.resolve\\(evaluateAll\\(token\\)\\)/);
assert.match(app,/AGE_ADMISSION_WAKE_INTERVAL_MS/);
assert.match(app,/ageWakeTriggered/);
assert.match(app,/MEMEFLOW_CREATE_DECODE_COVERAGE_V1/);
assert.match(app,/createDecodeCoveragePct/);
"""
new = """assert.match(app,/const _rawTokens=__mfLiveScannerTokens\\(\\)/);
assert.match(app,/const _tokens=_rawTokens\\.slice\\(0,_lim\\)/);
assert.match(app,/freshScannerTokens:__mfLiveScannerTokens\\(\\)\\.length/);
assert.match(app,/setHeader\\('cache-control','no-store'\\)/);

// MEMEFLOW_SCAN_DISPLAY_TRADE_SPLIT_V1 regression
// Live Token States must show raw scanner inventory. User settings only decide
// trade eligibility / trading decisions.
const liveRoute=app.slice(
  app.indexOf(\"if(url.pathname==='/api/system/live-token-states'\"),
  app.indexOf(\"if(url.pathname==='/api/ai/decisions'\")
);
assert.match(liveRoute,/MEMEFLOW_SCAN_DISPLAY_TRADE_SPLIT_V1_ROUTE/);
assert.match(liveRoute,/tradeEligible:/);
assert.match(liveRoute,/displayOnly:/);
assert.match(liveRoute,/preAdmissionHidden:0/);
assert.doesNotMatch(liveRoute,/const _admittedAll=_rawTokens\\.filter/);
assert.doesNotMatch(liveRoute,/store\\.setDecision/);
assert.doesNotMatch(app,/MEMEFLOW_AGE_THRESHOLD_WAKE_V1/);
assert.match(app,/const __mfPreAdmissionSweepTimer=setInterval/);
assert.match(app,/trade-ineligible -> trade-eligible/);
assert.match(app,/MEMEFLOW_CREATE_DECODE_COVERAGE_V1/);
assert.match(app,/createDecodeCoveragePct/);
"""
if old in test:
    test = test.replace(old, new, 1)
    print("patched: tests/fresh-session-scanner.mjs :: display/trade split assertions")
elif "MEMEFLOW_SCAN_DISPLAY_TRADE_SPLIT_V1 regression" in test:
    print("already patched: tests/fresh-session-scanner.mjs :: split assertions")
else:
    raise SystemExit("PATCH FAILED: fresh scanner header assertions changed")

needle = """assert.doesNotMatch(pruneScannerFn,/const lifecycleReason=/);

assert.doesNotMatch(
"""
replacement = """assert.doesNotMatch(pruneScannerFn,/const lifecycleReason=/);
assert.doesNotMatch(pruneScannerFn,/STABLE_SETTINGS_REJECTED/);

// Scanner/chart evidence collection must not depend on any user's filters.
const publishTradeFn=app.slice(
  app.indexOf('function publishTrade('),
  app.indexOf('function recordTradeWindow(')
);
assert.doesNotMatch(publishTradeFn,/__mfAnyActiveEntryAdmitted/);

const bridgeFn=app.slice(
  app.indexOf('async function runDiscoveryBridge()'),
  app.indexOf('function startDiscoveryBridge()')
);
assert.doesNotMatch(bridgeFn,/settingsGateCachedRejection/);

const bridgeRepairFn=app.slice(
  app.indexOf('async function bridgeRepairToken('),
  app.indexOf('let bridgeTimer=null')
);
assert.doesNotMatch(bridgeRepairFn,/settingsGateCheck\\(token\\)/);
assert.doesNotMatch(bridgeRepairFn,/holderAdmissionForActiveUsers\\(mint\\)/);

const fastPhaseFn=app.slice(
  app.indexOf('function fastPhaseAStart('),
  app.indexOf('// MEMEFLOW_WS_ONLY_PREOPEN_RPC_V1',app.indexOf('function fastPhaseAStart('))
);
assert.doesNotMatch(fastPhaseFn,/settingsGateCheck\\(token\\)/);
assert.doesNotMatch(fastPhaseFn,/holderAdmissionForActiveUsers\\(mint\\)/);

// Trading decisions remain gated.
assert.match(app,/admissionCheck:__mfLiveEvalAdmissionCheck/);
const aiDecisionRoute=app.slice(
  app.indexOf(\"if(url.pathname==='/api/ai/decisions'\"),
  app.indexOf(\"if(url.pathname==='/api/debug/filter-pipeline'\")
);
assert.match(aiDecisionRoute,/__mfAdmittedScannerTokensForUser\\(u\\.id\\)/);

assert.doesNotMatch(
"""
if needle in test:
    test = test.replace(needle, replacement, 1)
    print("patched: tests/fresh-session-scanner.mjs :: no settings in scanner pipeline")
elif "Scanner/chart evidence collection must not depend" in test:
    print("already patched: tests/fresh-session-scanner.mjs :: scanner pipeline assertions")
else:
    raise SystemExit("PATCH FAILED: fresh scanner prune assertion anchor changed")

tp.write_text(test)

# settings architecture UI contract
replace_once(
    "tests/settings-architecture-v2.mjs",
    "assert.match(settingsPage,/Scanner admission only/);",
    "assert.match(settingsPage,/Trading eligibility only/);",
    "settings UI semantic test"
)

# Add a strict architecture test that display is raw while trading remains gated.
sp = Path("tests/strict-entry-admission.mjs")
strict = sp.read_text()
anchor = """assert.match(app,/__mfAdmittedScannerTokensForUser\\(u\\.id\\)/);
assert.match(app,/preAdmissionHidden:/);
assert.match(app,/preAdmissionHiddenForUser:/);
"""
new_anchor = """assert.match(app,/__mfAdmittedScannerTokensForUser\\(u\\.id\\)/);
assert.match(app,/preAdmissionHidden:/);
assert.match(app,/preAdmissionHiddenForUser:/);

// Entry admission is a TRADING gate, never a scanner/display gate.
const liveStatesRoute=app.slice(
  app.indexOf(\"if(url.pathname==='/api/system/live-token-states'\"),
  app.indexOf(\"if(url.pathname==='/api/ai/decisions'\")
);
assert.match(liveStatesRoute,/const _tokens=_rawTokens\\.slice\\(0,_lim\\)/);
assert.doesNotMatch(liveStatesRoute,/_admittedAll=_rawTokens\\.filter/);
assert.match(liveStatesRoute,/tradeEligible:_tradeEligible/);
assert.match(liveStatesRoute,/preAdmissionHidden:0/);
"""
if anchor in strict:
    strict = strict.replace(anchor, new_anchor, 1)
    sp.write_text(strict)
    print("patched: tests/strict-entry-admission.mjs :: trade-only admission contract")
elif "Entry admission is a TRADING gate" in strict:
    print("already patched: tests/strict-entry-admission.mjs :: trade-only contract")
else:
    raise SystemExit("PATCH FAILED: strict-entry-admission app assertions changed")

print("Source patch completed.")
PY

echo
echo "== Focused architecture tests =="
node tests/settings-architecture-v2.mjs
node tests/strict-entry-admission.mjs
node tests/fresh-session-scanner.mjs

echo
echo "== Full project test suite =="
npm test

echo
echo "== Stage only this architecture fix =="
git add \
  app-server.mjs \
  src/settings-gate.mjs \
  settings-page.js \
  system.js \
  tests/settings-architecture-v2.mjs \
  tests/strict-entry-admission.mjs \
  tests/fresh-session-scanner.mjs

echo
echo "== Diff (no pager) =="
git --no-pager diff --cached --stat
git --no-pager diff --cached -- \
  app-server.mjs \
  src/settings-gate.mjs \
  settings-page.js \
  system.js \
  tests/settings-architecture-v2.mjs \
  tests/strict-entry-admission.mjs \
  tests/fresh-session-scanner.mjs

if git diff --cached --quiet; then
  echo "No new changes to commit."
else
  git commit -m "fix: separate scanner display from trading filters"
fi

echo
echo "== Push =="
git push origin HEAD

echo
echo "SUCCESS."
echo "Architecture after patch:"
echo "  SCAN    = every incoming Pump token"
echo "  DATA    = every scanned Pump token keeps WS trade/holder/chart evidence"
echo "  DISPLAY = every raw scanner token appears in Live Token States"
echo "  TRADE   = Entry Filters + Logic decide eligibility / BUY READY"
echo "  PREOPEN = final linked-wallet RPC checks remain BUY READY-only"
