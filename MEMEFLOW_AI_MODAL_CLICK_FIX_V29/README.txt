MEMEFLOW AI MODAL CLICK FIX V29

WHAT WENT WRONG IN V28
======================
V28 could hide a parent/overlay ancestor of the legacy backend.
In your actual page structure that ancestor can also participate in the native
AI display/click stack. Result: the center AI button appears dead / nothing opens.

V29 REMOVES THAT BEHAVIOR COMPLETELY.

V29
===
- removes the V28 script tag and runtime
- does NOT listen to/capture AI button clicks
- does NOT hide any parent overlay
- does NOT hide any element containing #sheet-ai-direct-v24
- waits until the native AI sheet is already OPEN
- then hides only the smallest exact legacy MEMEFLOW OpenAI roots
- leaves backend DOM alive for Status / Ask AI / AUTO AI / Strategy
- does not touch Wallet, navigation, evaluator config, or API calls

INSTALL
=======
cd ~/workspace
unzip -o MEMEFLOW_AI_MODAL_CLICK_FIX_V29.zip
node MEMEFLOW_AI_MODAL_CLICK_FIX_V29/apply-ai-modal-click-fix-v29.mjs
node MEMEFLOW_AI_MODAL_CLICK_FIX_V29/verify-ai-modal-click-fix-v29.mjs

Expected:
V29 INSTALL OK: 6/6
V29 VERIFY OK: 11/11

Then:
Stop -> Run -> hard refresh Safari.

ROLLBACK
========
cd ~/workspace
node MEMEFLOW_AI_MODAL_CLICK_FIX_V29/rollback-ai-modal-click-fix-v29.mjs
