MEMEFLOW AI DIRECT EVALUATOR v18

PURPOSE
-------
Fix the v17 mistake completely.

Analyze token inside MEMEFLOW OpenAI is now independent from the Home MANUAL AI SCAN UI.
The patch does NOT:
- fill the MANUAL AI SCAN input;
- click the MANUAL AI SCAN Analyze token button;
- set that module to Scanning...;
- scroll or navigate to Home;
- clone result DOM from the Home module.

Instead, the installer scans the project's own source code for the existing manual evaluator/API route and writes a small direct-evaluator config. The OpenAI Assistant calls that route directly and renders the returned analysis inside the same AI page.

SAFETY / FAIL-CLOSED
--------------------
The installer only accepts a high-confidence route near MANUAL AI SCAN / Analyze any Solana token / Analyze token source text. It rejects OpenAI chat, execution, wallet, chart, ai-live and demo routes. If it cannot identify the evaluator safely, Analyze token shows an error and the Home MANUAL AI SCAN module remains untouched.

INSTALL
-------
cd ~/workspace
unzip -o MEMEFLOW_AI_DIRECT_EVALUATOR_V18.zip
node MEMEFLOW_AI_DIRECT_EVALUATOR_V18/apply-ai-direct-v18.mjs

Read the Shell result. A good install should include a line like:
Direct evaluator detected: POST /api/...

Then:
Stop -> Run -> refresh Safari.

DIAGNOSTIC
----------
cd ~/workspace
node MEMEFLOW_AI_DIRECT_EVALUATOR_V18/diagnose-direct-v18.mjs

ROLLBACK
--------
cd ~/workspace
node MEMEFLOW_AI_DIRECT_EVALUATOR_V18/rollback-ai-direct-v18.mjs
