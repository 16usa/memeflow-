MEMEFLOW AI COMPACT STABLE V47

Purpose
-------
Compact and clean the MEMEFLOW OpenAI mobile sheet without touching the trading engine,
Wallet, Candidates, Positions, More, bottom-menu layout, or V46 server routes.

What changes
------------
- removes duplicate "MEMEFLOW OpenAI" title inside the content card
- replaces large status blocks with 4 compact chips
- removes the duplicate Status button; API status is the clickable API chip
- compacts Analyze / Auto AI / Strategy into one row
- uses a dedicated question textarea so the token mint is not placed into the question field
- compacts Ask button and result area
- result area grows with content instead of reserving a huge empty block
- removes stale standalone fixed "AI" button left by older patches
- keeps only the center AI button in the native mobile menu
- avoids falsely saying "READY" only because a key exists:
  initial status says KEY FOUND; successful AI request changes it to READY
- if OpenAI returns no-credit/quota errors, UI shows:
  "OpenAI API credits are exhausted" instead of the long raw billing URL

IMPORTANT
---------
The screenshot's "You have no credits remaining" is a real OpenAI API billing/quota response.
V47 makes that state clean and accurate, but API analysis cannot succeed until API credits are available.

INSTALL — DOES NOT START SERVER
-------------------------------
cd ~/workspace
unzip -o MEMEFLOW_AI_COMPACT_STABLE_V47.zip
node MEMEFLOW_AI_COMPACT_STABLE_V47/apply-ai-compact-v47.mjs
node MEMEFLOW_AI_COMPACT_STABLE_V47/verify-ai-compact-v47.mjs

Expected:
V47 INSTALL OK: 9/9
V47 VERIFY OK: 13/13

The patch does NOT start the server.
