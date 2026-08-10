MEMEFLOW OPENAI TOKEN INFO V58

THIS PATCH ONLY FIXES TOKEN INFORMATION LOADING IN MEMEFLOW OpenAI.
IT DOES NOT CHANGE COLORS OR BUTTON DESIGN.

What it does:
- MEMEFLOW OpenAI Analyze uses a new read-only endpoint: /api/openai/token-scan-v58
- bypasses the old Analyze timeout handler only
- Solana RPC calls run in parallel
- up to the first 3 configured SOLANA_RPC_URLS race instead of waiting serially
- supports Token Program and Token-2022
- attempts exact unique positive-balance holder count through getProgramAccounts
- uses DexScreener as market-data source/fallback for price, market cap and liquidity
- partial data still renders when an optional source fails
- does not add the scanned token to Candidate Feed
- does not execute a trade
- does not modify CSS/colors

Rendered fields when available:
Token, Price, Market cap, Liquidity, Holders, Top 10, Buy pressure,
Developer, Supply, AI score, Confidence, Decision, Primary reason.

INSTALL (installer does NOT start the server):
cd ~/workspace
unzip -o MEMEFLOW_OPENAI_TOKEN_INFO_V58.zip
node MEMEFLOW_OPENAI_TOKEN_INFO_V58/apply-openai-token-info-v58.mjs
node MEMEFLOW_OPENAI_TOKEN_INFO_V58/verify-openai-token-info-v58.mjs

Expected:
V58 INSTALL OK: 7/7
V58 VERIFY OK: 22/22

IMPORTANT:
V58 adds a backend route, so after installation restart your normal Replit process once.
Then refresh Safari.

ROLLBACK:
cd ~/workspace
node MEMEFLOW_OPENAI_TOKEN_INFO_V58/rollback-openai-token-info-v58.mjs

After rollback restart the normal Replit process once.
