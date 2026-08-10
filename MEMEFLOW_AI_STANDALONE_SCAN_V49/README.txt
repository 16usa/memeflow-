MEMEFLOW AI STANDALONE TOKEN SCAN V49

V48 stopped on "FAIL evaluate import" because V48 required one exact import string.
V49 removes that fragile requirement.

V49 checks the real evaluator file:
memeflow-app/src/evaluate.mjs

The standalone scan dynamically imports that canonical file at scan time.
It therefore uses the same evaluate() logic even if app-server.mjs formats,
aliases, or does not import evaluate() itself.

INSTALL (NO SERVER START)
cd ~/workspace
unzip -o MEMEFLOW_AI_STANDALONE_SCAN_V49.zip
node MEMEFLOW_AI_STANDALONE_SCAN_V49/apply-ai-standalone-v49.mjs
node MEMEFLOW_AI_STANDALONE_SCAN_V49/verify-ai-standalone-v49.mjs

Expected:
V49 INSTALL OK: 13/13
V49 VERIFY OK: 21/21

ROLLBACK
node MEMEFLOW_AI_STANDALONE_SCAN_V49/rollback-ai-standalone-v49.mjs

Backup:
memeflow-app/.memeflow-v49-backup/

Patch does not start the server.
