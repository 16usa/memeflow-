MEMEFLOW V12.27 — LIVE EVALUATOR WIRING

Purpose
-------
Fix the live Pump WS hot path so the existing active-user evaluator is called.

Observed problem
----------------
pump-live-trade-feed receives `evaluateAI`, but that callback resolves null for every event.
The project already has:
  const evaluateAll = makeEvaluateForActiveUsers(...)
and liveeval.mjs evaluates each active user and persists decisions with store.setDecision().

Change
------
ONLY this live-feed dependency wiring:
  evaluateAI: typeof evaluateAI==='function'?evaluateAI:null
becomes:
  evaluateAI: typeof evaluateAll==='function'?evaluateAll:null

No thresholds, trading rules, execution, evaluate.mjs, liveeval.mjs, or paper-engine logic are changed.

Install from Replit Shell
-------------------------
cd ~/workspace
unzip -o MEMEFLOW_V12_27_LIVE_EVALUATOR_WIRING.zip
node MEMEFLOW_V12_27_LIVE_EVALUATOR_WIRING/install-v12-27.mjs
node MEMEFLOW_V12_27_LIVE_EVALUATOR_WIRING/self-test-v12-27.mjs

Then restart the already-running MEMEFLOW process from Replit (do not start a second server on port 3000).

Rollback
--------
node MEMEFLOW_V12_27_LIVE_EVALUATOR_WIRING/rollback-v12-27.mjs
