MEMEFLOW AI COMPACT ADAPTIVE V50

Changes ONLY the MEMEFLOW OpenAI frontend from V49.

- Result panel is small before analysis.
- Result panel grows automatically with returned content.
- If the result becomes very long, only the result text area scrolls.
- Removes the forced full-viewport result stretch from V49.
- All mobile input/textarea/select controls are 16px while focused/typed,
  preventing iOS Safari automatic page zoom.
- V49 standalone scanner/backend is untouched.
- Candidates / Positions / Wallet / More are untouched.
- No server start.

INSTALL:
cd ~/workspace
unzip -o MEMEFLOW_AI_COMPACT_ADAPTIVE_V50.zip
node MEMEFLOW_AI_COMPACT_ADAPTIVE_V50/apply-ai-compact-adaptive-v50.mjs
node MEMEFLOW_AI_COMPACT_ADAPTIVE_V50/verify-ai-compact-adaptive-v50.mjs

Expected:
V50 INSTALL OK: 9/9
V50 VERIFY OK: 15/15

ROLLBACK:
node MEMEFLOW_AI_COMPACT_ADAPTIVE_V50/rollback-ai-compact-adaptive-v50.mjs
