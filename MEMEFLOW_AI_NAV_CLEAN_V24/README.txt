MEMEFLOW AI NAV CLEAN V24

MAIN FIX
--------
The large "Open AI assistant" button is no longer merely hidden.
It is REMOVED from MANUAL AI SCAN entirely.

V24:
- deletes #mfManualAiButton from index.html when it exists there
- removes it at runtime too if the app dynamically recreates it
- center nav AI no longer clicks or proxies that button
- center nav opens the MEMEFLOW OpenAI sheet directly
- MANUAL AI SCAN keeps only its own token input / Analyze token / explanatory text

LAYOUT
------
PHONE:
Home | Candidates | ✦ | Positions | More

TABLET/DESKTOP:
Home | Candidates | ✦ AI | Positions | More

Wallet stays in the top-right header.
Evaluator config and analysis logic are unchanged from V23.

INSTALL
-------
cd ~/workspace
unzip -o MEMEFLOW_AI_NAV_CLEAN_V24.zip
node MEMEFLOW_AI_NAV_CLEAN_V24/apply-ai-nav-v24.mjs

Then:
Stop -> Run -> refresh Safari/browser.

ROLLBACK
--------
cd ~/workspace
node MEMEFLOW_AI_NAV_CLEAN_V24/rollback-ai-nav-v24.mjs
