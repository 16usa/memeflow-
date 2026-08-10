MEMEFLOW AI DIRECT EVALUATOR v19

WHAT V19 FIXES
--------------
V18 successfully stopped MANUAL AI SCAN from being triggered, but a direct request could remain stuck on "Analyzing..." if the detected route never completed.

V19 keeps the independent AI-page analysis and adds:
- stricter evaluator route detection using the actual MANUAL AI SCAN section IDs and source proximity;
- hard 30 second timeout on the primary evaluator request;
- automatic AbortController cancellation when the AI sheet is closed;
- no infinite request / frozen page;
- no click, fill, scroll, navigation, or state change in MANUAL AI SCAN;
- fail-closed behavior if a trustworthy evaluator route is not found.

INSTALL
-------
cd ~/workspace
unzip -o MEMEFLOW_AI_DIRECT_EVALUATOR_V19.zip
node MEMEFLOW_AI_DIRECT_EVALUATOR_V19/apply-ai-direct-v19.mjs

A successful install should print:
Direct evaluator detected: POST /api/...
V19 safety: 30s hard timeout + request abort on Close + stricter route matching.

Then:
Stop -> Run -> hard refresh Safari.

DIAGNOSTIC
----------
cd ~/workspace
node MEMEFLOW_AI_DIRECT_EVALUATOR_V19/diagnose-direct-v19.mjs

ROLLBACK
--------
cd ~/workspace
node MEMEFLOW_AI_DIRECT_EVALUATOR_V19/rollback-ai-direct-v19.mjs
