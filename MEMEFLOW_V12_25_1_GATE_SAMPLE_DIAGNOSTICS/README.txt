MEMEFLOW V12.25.1 — Gate Sample Diagnostics

Purpose:
- Adds diagnostics-only gate mapping to the existing V10.2 same-instance response.
- Uses the exact live anchor shown in app-server.mjs:
  diagnosticVersion:'V10.2-same-instance',
- Does NOT modify evaluator, candidate selection, trading, buy/sell, or execution logic.
- Preserves V12.24 / V12.23 / V12.22.
- Creates a timestamped backup before writing.

Install:
cd ~/workspace
unzip -o MEMEFLOW_V12_25_1_GATE_SAMPLE_DIAGNOSTICS.zip
node MEMEFLOW_V12_25_1_GATE_SAMPLE_DIAGNOSTICS/install-v12-25-1.mjs
node MEMEFLOW_V12_25_1_GATE_SAMPLE_DIAGNOSTICS/self-test-v12-25-1.mjs

Then restart:
pkill -9 -f '[a]pp-server\.mjs' || true
cd ~/workspace/memeflow-app
npm start

Rollback:
cd ~/workspace
node MEMEFLOW_V12_25_1_GATE_SAMPLE_DIAGNOSTICS/rollback-v12-25-1.mjs
