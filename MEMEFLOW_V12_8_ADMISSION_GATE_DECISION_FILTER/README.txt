MEMEFLOW V12.8 — ADMISSION GATE + DECISION/CANDIDATE FIX

WHY
Live diagnostics proved:
- discovery / fast Phase-A start correctly
- holder scan itself can succeed
- holder data now survives after V12.7
- BUT concurrency=1 cannot full-scan every Pump launch quickly
- many fresh tokens sit due with attempts=0
- a token with holders=6 and buyPressure=0 clearly failed user settings
  (minHolders=30, minBuyPressure=1.2), yet expensive holder capacity had already
  been spent on it

V12.8 adds ADMISSION CONTROL before expensive holder RPC.

HOW IT WORKS
For every queued mint, before getProgramAccounts:
1. inspect all ACTIVE users (or owners)
2. apply only cheap/pre-holder gates
3. if at least one active user can currently benefit -> ALLOW holder scan
4. if dynamic market evidence is not ready / currently below threshold -> DEFER
5. only stable hard incompatibility for every active user -> DROP holder work

Important safety rule:
Dynamic values are DEFERRED, not permanently rejected. A token whose buy
pressure improves later can still become admitted.

Current cheap admission checks:
- launch platform
- max token age
- price availability
- min buy pressure
- positive min/max market-cap USD when data exists
- positive min liquidity USD when data exists

Holder RPC concurrency is NOT increased.

MULTI-USER SAFETY
A token is allowed if ANY active user can benefit. One user's strict settings
cannot starve another user's looser settings.

DECISION DIAGNOSTIC FIX
Earlier V10.1/V10.2 diagnostics used Map syntax on store._uidDec even though it
is an object whose values are Maps. That could show decision:null even when the
decision engine had stored a decision. V12.8 fixes that lookup.

CANDIDATE FEED
/api/ai/decisions now hides hard non-candidates by default:
- BLOCKED
- EXPIRED
- SKIP
- BUY_BLOCKED

For audit/debug, use:
/api/ai/decisions?includeBlocked=1

INSTALL
cd ~/workspace

unzip -o MEMEFLOW_V12_8_ADMISSION_GATE_DECISION_FILTER.zip   -d MEMEFLOW_V12_8_ADMISSION_GATE_DECISION_FILTER

node MEMEFLOW_V12_8_ADMISSION_GATE_DECISION_FILTER/install.mjs

node MEMEFLOW_V12_8_ADMISSION_GATE_DECISION_FILTER/self-test.mjs

REQUIRED:
ALL V12.8 SELF-TESTS PASSED

Then:
Stop -> Run

DO NOT REPUBLISH YET.

LIVE TEST AFTER 2–3 MINUTES

1) /api/discovery/status
Look for:
holderAdmissionAllowed
holderAdmissionDeferred
holderAdmissionDropped
lastHolderAdmissionReason

2) /api/debug/filter-pipeline-lifecycle?limit=10
Expected:
- dead/weak tokens may remain pending/deferred without consuming holder RPC
- stronger tokens should reach holder attempts earlier

3) /api/debug/token-lifecycle?mint=FRESH_MINT
Expected after holder success:
- holderFresh=true
- holderCount / top10Pct populated
- decision should now be visible if stored

4) /api/ai/decisions
Hard-blocked tokens should no longer appear in normal Candidate Feed.

Audit:
 /api/ai/decisions?includeBlocked=1

ROLLBACK
node MEMEFLOW_V12_8_ADMISSION_GATE_DECISION_FILTER/rollback.mjs
