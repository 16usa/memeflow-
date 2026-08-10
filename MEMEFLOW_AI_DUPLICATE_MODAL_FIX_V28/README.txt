MEMEFLOW AI DUPLICATE MODAL FIX V28

BUG FIXED
=========
On phone, opening the native full-screen MEMEFLOW OpenAI page could also paint
an older small MEMEFLOW OpenAI modal on top of it.

V28:
- keeps #sheet-ai-direct-v24 as the ONLY visible AI UI
- finds ALL legacy MEMEFLOW OpenAI backend modal copies, not just the first one
- hides the legacy root and its modal/overlay wrapper
- does NOT delete the legacy backend DOM
- keeps legacy backend available to Status / Ask AI / AUTO AI / Strategy
- continuously suppresses legacy UI only while the native AI sheet is open
- does not touch Wallet layout, navigation, evaluator config, API routes, or token analysis

INSTALL
=======
cd ~/workspace
unzip -o MEMEFLOW_AI_DUPLICATE_MODAL_FIX_V28.zip
node MEMEFLOW_AI_DUPLICATE_MODAL_FIX_V28/apply-ai-duplicate-modal-v28.mjs
node MEMEFLOW_AI_DUPLICATE_MODAL_FIX_V28/verify-ai-duplicate-modal-v28.mjs

Expected:
V28 INSTALL OK: 4/4
V28 VERIFY OK: 10/10

Then:
Stop -> Run -> hard refresh Safari.

ROLLBACK
========
cd ~/workspace
node MEMEFLOW_AI_DUPLICATE_MODAL_FIX_V28/rollback-ai-duplicate-modal-v28.mjs
