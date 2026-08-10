MEMEFLOW AI CORE FIX V30

WHY V28/V29 DID NOT SOLVE IT
============================
The real unsafe behavior was still inside the V24 AI core itself:

1. V24 could hide a legacy modal PARENT overlay with display:none.
   In the actual page structure that parent can also contain/cover the native AI sheet.

2. V24 stopped searching as soon as the first legacy backend was captured.
   If a second legacy MEMEFLOW OpenAI instance appeared later, it stayed visible.

V30 fixes the source instead of stacking another guard.

WHAT V30 DOES
=============
- Removes V28 and V29 completely.
- Replaces the V24 runtime with V30.
- Keeps the SAME DOM IDs expected by V26/V27.
- Keeps the SAME ai-direct-evaluator-v24-config.js and API endpoint.
- Never display:none's a legacy overlay parent.
- Never hides an element containing #sheet-ai-direct-v24.
- Hides every exact legacy backend copy.
- Continues checking for extra duplicate legacy copies only while the AI sheet is open.
- Makes the native AI sheet the top visible layer.

NOT TOUCHED
===========
- Wallet V27 layout
- V26 phone/tablet/desktop layout
- evaluator endpoint/config
- Manual AI Scan analysis API
- Candidates / Positions / Wallet logic
- core application files

INSTALL
=======
cd ~/workspace
unzip -o MEMEFLOW_AI_CORE_FIX_V30.zip
node MEMEFLOW_AI_CORE_FIX_V30/apply-ai-core-v30.mjs
node MEMEFLOW_AI_CORE_FIX_V30/verify-ai-core-v30.mjs

Expected:
V30 INSTALL OK: 7/7
V30 VERIFY OK: 14/14

Then:
Stop -> Run -> hard refresh Safari.

ROLLBACK
========
cd ~/workspace
node MEMEFLOW_AI_CORE_FIX_V30/rollback-ai-core-v30.mjs
