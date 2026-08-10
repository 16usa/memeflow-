MEMEFLOW AI NATIVE SHEET PATCH v12

Fix in v12
----------
v11 opened two windows:
1. the new correct native AI mobile sheet
2. the old small MEMEFLOW OpenAI modal

v12 keeps #1 and forces #2 to stay hidden as backend-only.

Important:
- Stable v7 bridge is preserved.
- v11 is removed automatically.
- Bottom nav stays Home / Candidates / Positions / Wallet / More.
- Old OpenAI DOM is NOT deleted.
- Its buttons/API logic still work programmatically.
- Only the native .mobile-sheet is visible.

Install:
cd ~/workspace
unzip -o MEMEFLOW_AI_NATIVE_SHEET_PATCH_V12.zip
node MEMEFLOW_AI_NATIVE_SHEET_PATCH_V12/apply-ai-native-sheet-v12.mjs

Then:
Stop -> Run -> refresh Safari.

Rollback to stable v7:
cd ~/workspace
node MEMEFLOW_AI_NATIVE_SHEET_PATCH_V12/rollback-v12.mjs
