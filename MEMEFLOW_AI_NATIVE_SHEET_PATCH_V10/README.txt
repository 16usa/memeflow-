MEMEFLOW AI NATIVE MOBILE SHEET PATCH v10

What v10 changes
----------------
- Keeps the current stable MANUAL AI SCAN button.
- Keeps bottom navigation:
  Home / Candidates / Positions / Wallet / More.
- Creates a REAL .mobile-sheet for MEMEFLOW OpenAI.
- The AI sheet opens/behaves like Candidates / Positions.
- The original OpenAI modal is NOT moved or reparented.
- Original OpenAI controls remain the live logic/API backend.
- v10 mirrors/proxies those controls into the native mobile sheet.
- Removes v9 from index.html automatically.
- Creates a backup before changing index.html.

Install in Replit Shell
-----------------------
cd ~/workspace
unzip -o MEMEFLOW_AI_NATIVE_SHEET_PATCH_V10.zip
node MEMEFLOW_AI_NATIVE_SHEET_PATCH_V10/apply-ai-native-sheet-v10.mjs

Then:
Stop -> Run -> refresh Safari.

Rollback v10
------------
cd ~/workspace
node MEMEFLOW_AI_NATIVE_SHEET_PATCH_V10/rollback-v10.mjs
