MEMEFLOW QUALIFIED CANDIDATES V8

GOAL
Keep the user-facing Candidates feed clean.

NEW PIPELINE

NEW TOKEN
  -> discovery / enrichment
  -> user's server Settings
  -> AI score + confidence
  -> anti-rug confirmation
  -> BUY READY
  -> Candidates

Tokens that do not pass are NOT shown as Candidates.

IMPORTANT
Nothing is thrown away:
- WAITING = stays in backend processing.
- WATCH / BLOCKED / EXPIRED / REJECTED / IGNORED = retained for diagnostics.
- BUY READY = visible in Candidates.

API SCOPES
/api/ai/decisions?scope=candidates   -> BUY READY only (default)
/api/ai/decisions?scope=processing   -> WAITING only
/api/ai/decisions?scope=filtered     -> failed/non-qualified
/api/ai/decisions?scope=all          -> full audit set

WHY THIS IS BETTER
A token with 37 holders while Minimum holders = 100 will still be analyzed and
the rejection reason remains available, but it will not pollute the Candidates UI.

The same applies to:
- AI score below minimum
- confidence below minimum
- Top-10 above maximum
- developer share above maximum
- buy pressure below minimum
- liquidity / market-cap / age / social filters
- anti-rug WAITING/BLOCK conditions

Chart config also uses the first qualified candidate instead of accidentally
binding to an old BLOCKED token.

INSTALL
cd ~/workspace
unzip -o MEMEFLOW_QUALIFIED_CANDIDATES_V8.zip -d MEMEFLOW_QUALIFIED_CANDIDATES_V8
node MEMEFLOW_QUALIFIED_CANDIDATES_V8/install.mjs
node MEMEFLOW_QUALIFIED_CANDIDATES_V8/self-test.mjs

Do not restart unless:
ALL V8 SELF-TESTS PASSED

Then:
Stop -> Run

LIVE CHECK
Keep Minimum holders = 100.
A newly detected token with fewer than 100 holders:
- may exist in scope=filtered after evaluation,
- must NOT appear in Candidates,
- must NOT become Primary Candidate,
- must NOT drive the Market Chart.

A token can appear in Candidates only when its current server decision is BUY READY.

ROLLBACK
node MEMEFLOW_QUALIFIED_CANDIDATES_V8/rollback.mjs
