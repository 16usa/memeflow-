MEMEFLOW AI NATIVE SHEET PATCH v11

Why v10 did not open
--------------------
The stable v7 patch owns mfManualAiButton.onclick.
v10 added a second click flow without fully blocking v7's original onclick.
The two open flows could fight each other.

v11 fix
-------
- Intercepts Open AI assistant in capture phase.
- Stops the old v7 onclick from running for that tap.
- Opens the new native .mobile-sheet immediately.
- Then programmatically opens the original hidden OpenAI launcher only as logic/API backend.
- The old OpenAI modal stays mounted but is hidden offscreen.
- Native sheet mirrors/proxies Status / Analyze token / AUTO AI / Strategy / mint / prompt / Ask AI / output.
- Uses the site's existing .mobile-sheet geometry, just like Positions.
- Bottom nav remains Home / Candidates / Positions / Wallet / More.
- v10 is removed automatically.
- Stable v7 is preserved.

Install
-------
cd ~/workspace
unzip -o MEMEFLOW_AI_NATIVE_SHEET_PATCH_V11.zip
node MEMEFLOW_AI_NATIVE_SHEET_PATCH_V11/apply-ai-native-sheet-v11.mjs

Then:
Stop -> Run -> refresh Safari.

Emergency rollback to stable v7
-------------------------------
cd ~/workspace
node MEMEFLOW_AI_NATIVE_SHEET_PATCH_V11/rollback-v11.mjs
