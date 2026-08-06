MEMEFLOW — EXCLUDE PUMP.FUN MAYHEM MODE

This patch decodes the official create_v2 is_mayhem_mode flag and rejects Mayhem launches before store.addToken().

Result:
- no enrichment;
- no AI evaluation;
- no decision;
- no Primary Candidate;
- no Candidates card;
- no Market Chart selection;
- standard Pump.fun launches continue normally;
- /api/discovery/status exposes mayhemCreatesIgnored.

INSTALL
cd ~/workspace
unzip -o MEMEFLOW_EXCLUDE_MAYHEM_MODE.zip -d MEMEFLOW_EXCLUDE_MAYHEM_MODE
node MEMEFLOW_EXCLUDE_MAYHEM_MODE/install.mjs
node MEMEFLOW_EXCLUDE_MAYHEM_MODE/self-test.mjs

Then Stop → Run in Replit.

Optional Secret (exclusion is already ON by default):
EXCLUDE_MAYHEM_MODE=true

ROLLBACK
node MEMEFLOW_EXCLUDE_MAYHEM_MODE/rollback.mjs
