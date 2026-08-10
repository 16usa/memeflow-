MEMEFLOW AI WORKING COMPACT V51

ROOT CAUSE FIXED
----------------
V49/V50 bound click handlers to elements inside #sheet-ai during install.
Then openSheet() called ensureSheet() again.
ensureSheet() replaced sheet.innerHTML, destroying those handlers.
Result: the page opened, but Analyze / Auto AI / Strategy / Ask / Close could become dead.

V51 fixes this two ways:
1) #sheet-ai is built only once (idempotent).
2) buttons use persistent delegated event handlers on document.

UI CHANGES
----------
- Huge "API KEY FOUND" is removed.
- Small MEMEFLOW-style status pill: AI READY / AI OFFLINE / NO CREDITS.
- MODE pill is compact.
- Mint placeholder is short and small.
- Ask placeholder is short and small.
- Actual input font remains 16px so iOS Safari does NOT zoom on focus.
- Result starts compact and grows only when analysis appears.
- Existing V49 standalone scanner behavior is preserved.
- Candidates / Positions / Wallet / More are untouched.

BACKEND
-------
V51 checks /api/ai/standalone-scan.
If the V49 standalone backend is already present, it leaves it alone.
If it is missing or partial, V51 repairs it and tells you to restart the server manually.

INSTALL (NO SERVER START)
-------------------------
cd ~/workspace
unzip -o MEMEFLOW_AI_WORKING_COMPACT_V51.zip
node MEMEFLOW_AI_WORKING_COMPACT_V51/apply-ai-working-compact-v51.mjs
node MEMEFLOW_AI_WORKING_COMPACT_V51/verify-ai-working-compact-v51.mjs

Expected:
V51 INSTALL OK: 17/17
V51 VERIFY OK: 26/26

If installer says:
V51 BACKEND: REPAIRED — restart server manually
then restart your Replit server yourself.

ROLLBACK
--------
node MEMEFLOW_AI_WORKING_COMPACT_V51/rollback-ai-working-compact-v51.mjs
