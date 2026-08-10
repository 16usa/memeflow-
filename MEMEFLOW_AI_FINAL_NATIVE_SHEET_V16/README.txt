MEMEFLOW FINAL AI NATIVE SHEET v16

CHANGE
------
The Analyze token button inside MEMEFLOW OpenAI now works through the EXACT SAME
MANUAL AI SCAN pipeline as "Analyze any Solana token" on Home.

Flow:
1. Enter mint/token link in the AI sheet.
2. Tap Analyze token.
3. v16 copies that value into the real MANUAL AI SCAN field.
4. v16 clicks the real MANUAL AI SCAN "Analyze token" button.
5. The native AI sheet closes and scrolls to MANUAL AI SCAN so the normal
   MEMEFLOW evaluator/result UI is visible.

IMPORTANT
---------
- Analyze token does NOT use the OpenAI chat-credit route anymore.
- It uses the MEMEFLOW manual evaluator + current Settings.
- Ask AI / Strategy / AUTO AI remain OpenAI-backed and can still require API credits.
- v15 is replaced, not layered underneath v16.

INSTALL
-------
cd ~/workspace
unzip -o MEMEFLOW_AI_FINAL_NATIVE_SHEET_V16.zip
node MEMEFLOW_AI_FINAL_NATIVE_SHEET_V16/apply-ai-final-v16.mjs

Then:
Stop -> Run -> refresh Safari.

ROLLBACK
--------
cd ~/workspace
node MEMEFLOW_AI_FINAL_NATIVE_SHEET_V16/rollback-final-v16.mjs
