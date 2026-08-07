MEMEFLOW V10.1 DIAGNOSTICS HOTFIX

Why:
The V10 /api/debug/token-lifecycle endpoint was hanging for ~300000 ms
and Replit aborted the request.

Fix:
- Removes store.decisions(u.id).find(...) from the debug route.
- Uses direct O(1) in-memory decision lookup.
- Removes helper-based token age calculation from the debug path.
- Adds diagnosticVersion: "V10.1-fast".

This hotfix does NOT change:
- trading logic
- Settings
- holder thresholds
- RPC pacing
- discovery logic
- BUY/BLOCK/WATCH logic
- queues or retry timing

INSTALL

cd ~/workspace

unzip -o MEMEFLOW_V10_1_DIAGNOSTICS_HOTFIX.zip   -d MEMEFLOW_V10_1_DIAGNOSTICS_HOTFIX

node MEMEFLOW_V10_1_DIAGNOSTICS_HOTFIX/hotfix.mjs

node MEMEFLOW_V10_1_DIAGNOSTICS_HOTFIX/self-test.mjs

Required:
ALL V10.1 SELF-TESTS PASSED

Then:
Stop -> Run

Test first on the replit.dev URL:

/api/debug/token-lifecycle?mint=YOUR_MINT

Expected:
- response in seconds, not 5 minutes
- diagnosticVersion: "V10.1-fast"

Only after the dev endpoint works, republish production.

ROLLBACK:
node MEMEFLOW_V10_1_DIAGNOSTICS_HOTFIX/rollback.mjs
