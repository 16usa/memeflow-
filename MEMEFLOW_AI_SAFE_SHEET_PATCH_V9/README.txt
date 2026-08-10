MEMEFLOW AI SAFE MOBILE SHEET PATCH v9

Purpose:
- Keep the current stable v7 layout.
- Keep Open AI assistant inside MANUAL AI SCAN.
- Keep bottom nav: Home / Candidates / Positions / Wallet / More.
- Make the existing MEMEFLOW OpenAI window behave like a mobile sheet.
- IMPORTANT: v9 does NOT move or reparent the existing OpenAI DOM.

Install in Replit Shell:
cd ~/workspace
unzip -o MEMEFLOW_AI_SAFE_SHEET_PATCH_V9.zip
node MEMEFLOW_AI_SAFE_SHEET_PATCH_V9/apply-ai-safe-sheet-v9.mjs

Then:
Stop -> Run -> refresh Safari.

Emergency rollback:
cd ~/workspace
node MEMEFLOW_AI_SAFE_SHEET_PATCH_V9/rollback-v9.mjs
