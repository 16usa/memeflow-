MEMEFLOW AI STANDALONE TOKEN SCAN V48

WHAT V48 DOES
-------------
- Adds a dedicated token input inside MEMEFLOW OpenAI:
  mint address / Pump.fun link / DexScreener link.
- "Analyze token" runs a NEW independent route:
  POST /api/ai/standalone-scan
- The route uses the SAME src/evaluate.mjs evaluator and the user's current Settings.
- It does NOT click, populate, open or read the MANUAL AI SCAN module.
- It does NOT call setDecision(), evaluateAll(), setToken() or addToken().
- It does NOT add the scanned token to Candidate Feed.
- It does NOT execute trades.
- Result stays inside MEMEFLOW OpenAI:
  state, score, market cap, liquidity, holders, Top 10, buy pressure, developer holding.
- Uses Solana RPC directly and DexScreener public API as market-data fallback/augmentation.
- Auto AI, Strategy and Ask use the independently scanned result as context.
- Token scanning works even when OpenAI API credits are exhausted.
  OpenAI credits are only required for narrative/Ask/Strategy.
- Mobile AI sheet is fixed/no page scrolling. Long detail text can scroll only inside the result area.

DEXSCREENER
-----------
V48 uses the official current DexScreener endpoints:
- /latest/dex/pairs/solana/{pairId} for a DexScreener pair link
- /token-pairs/v1/solana/{tokenAddress} for token market data

ROLLBACK
--------
Before V48 changes anything, it creates:
memeflow-app/.memeflow-v48-backup/

It preserves the exact pre-V48:
- index.html
- app-server.mjs
- native-ai-sheet-v47.js (when present)

Rollback command:
node MEMEFLOW_AI_STANDALONE_SCAN_V48/rollback-ai-standalone-v48.mjs

INSTALL — DOES NOT START SERVER
-------------------------------
cd ~/workspace
unzip -o MEMEFLOW_AI_STANDALONE_SCAN_V48.zip
node MEMEFLOW_AI_STANDALONE_SCAN_V48/apply-ai-standalone-v48.mjs
node MEMEFLOW_AI_STANDALONE_SCAN_V48/verify-ai-standalone-v48.mjs

Expected:
V48 INSTALL OK: 12/12
V48 VERIFY OK: 18/18

No server start is performed by the patch.
