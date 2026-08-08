MEMEFLOW V12.25 — GATE SAMPLE DIAGNOSTICS

Purpose
-------
This patch changes DIAGNOSTICS ONLY.

It does NOT change:
- holder calculations
- market calculations
- WebSocket trade stream
- AI/trading decision logic
- thresholds
- buy/sell execution

It enriches every V10.2 diagnostic "sample" row with:

gate.state
gate.failed
gate.waiting
gate.checks.holders
gate.checks.top10
gate.checks.developer
gate.checks.buyPressure
gate.decisionExpected
decisionReason

Examples
--------
If a row has:
holders = 46
Top10 = 19.1
developer = 0
buyPressure = 1.05

with settings:
minHolders = 30
maxTop10Pct = 25
maxDeveloperPct = 20
minBuyPressure = 1.2

you should see:
gate.state = BLOCKED
gate.failed = ["buyPressure"]
decisionReason = "blocked_by_buyPressure"

If all four visible gates pass but decision is still null:
gate.state = PASS
decisionReason = "all_visible_gates_pass_but_no_decision"

That case tells us to inspect the actual AI/evaluation logic next.

INSTALL — ONE COMMAND AT A TIME
-------------------------------
cd ~/workspace

unzip -o MEMEFLOW_V12_25_GATE_SAMPLE_DIAGNOSTICS.zip

node MEMEFLOW_V12_25_GATE_SAMPLE_DIAGNOSTICS/install-v12-25.mjs

node MEMEFLOW_V12_25_GATE_SAMPLE_DIAGNOSTICS/self-test-v12-25.mjs

pkill -9 -f '[a]pp-server\.mjs' || true

cd ~/workspace/memeflow-app

npm start

VERIFY
------
Expected top-level:
v12_25.version = V12.25
v12_25.sampleGateDiagnostics = true
v12_25.tradingLogicChanged = false

Expected inside each sample row:
gate: {...}
decisionReason: "..."

ROLLBACK
--------
cd ~/workspace
node MEMEFLOW_V12_25_GATE_SAMPLE_DIAGNOSTICS/rollback-v12-25.mjs
