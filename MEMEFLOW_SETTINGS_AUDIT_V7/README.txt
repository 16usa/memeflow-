MEMEFLOW SETTINGS AUDIT V7

WHAT WAS VERIFIED AND FIXED

1. Every visible token filter is connected to evaluate().
   - Fixed a real bug: Minimum liquidity USD existed in Settings but evaluate() did not use it.
   - Hard failures now show BLOCKED even if some other evidence is still pending.

2. Current discovery source is represented honestly.
   - Backend currently listens to Pump.fun creation events only.
   - Pump is the canonical launch platform.
   - Launchlab / Believe / Moonshot / Bonkfun / Bags / Jup Studio controls are disabled until a real listener exists.
   - No fake multi-platform support.

3. Broken UI/server field mappings repaired.
   OLD BUGS:
   - changeLog -> AI change policy select (boolean in a select => blank)
   - shadowValidation -> Keep immutable change history (wrong meaning)
   - exitBuyPressure numeric -> checkbox (accidental true/false conversion)
   FIX:
   - shadowValidation -> Run PAPER simulation before changes
   - changeLog -> Keep immutable change history
   - decisionFreshnessSec -> Decision freshness
   - exitOnWeakBuyPressure -> Exit when buy pressure weakens

4. Server validation is actually authoritative now.
   It validates:
   - capital / daily caps / position size
   - integer entry limits
   - score / confidence
   - all min/max pairs
   - stop / trailing / TP ordering
   - TP1 + TP2 + runner = 100%
   - decision freshness
   - profile / mode / environment

5. Zero-value semantics are explicit.
   In PAPER:
   - Trading capital 0 = cap disabled
   - Daily spend 0 = cap disabled
   - Daily loss 0 = cap disabled
   - Max open positions 0 = block all entries
   - Max daily entries 0 = block all entries

6. Owner approval now works in Automate PAPER mode.
   When Require owner approval is ON, Automate creates a proposal instead of silently opening a position.

7. Decision freshness now works.
   Default = 60 sec.
   An Assist proposal older than the configured freshness window expires and requires re-evaluation.

8. Settings audit now works.
   When Keep immutable change history is ON, every saved policy change is appended server-side.
   Read-only endpoint: /api/settings/audit

9. "Run PAPER simulation before changes" now has real server behavior.
   Before saving, recent cached tokens are shadow-evaluated with the proposed settings.
   Evaluation errors reject the settings change.

10. RPC header status corrected.
    "RPC online/unavailable" now represents the HTTP Solana RPC itself.
    A temporary WebSocket/discovery disconnect no longer falsely labels a healthy HTTP RPC as unavailable.

11. User help text added.
    Confusing numeric filters and toggles now explain:
    - what they measure
    - what blank means
    - what 0 means
    - what happens when data is missing
    - whether higher/lower is stricter

12. Non-functional adaptive setting controls are no longer presented as active.
    Adaptive Profile stays disabled until a real market-regime policy engine exists.
    AI Change Policy is enforced as Propose Only; AI cannot mutate owner hard limits automatically.

INSTALL

cd ~/workspace
unzip -o MEMEFLOW_SETTINGS_AUDIT_V7.zip -d MEMEFLOW_SETTINGS_AUDIT_V7
node MEMEFLOW_SETTINGS_AUDIT_V7/install.mjs
node MEMEFLOW_SETTINGS_AUDIT_V7/self-test.mjs

Do NOT restart unless the final line is:

ALL V7 SELF-TESTS PASSED

Then:
Stop -> Run

VERIFY IN UI

- "Settings need attention" must NOT appear unless validation errors exist.
- Pump is selected; unsupported launchpads are disabled.
- AI change policy shows Propose only.
- Decision freshness shows 60.
- Run PAPER simulation before changes is ON by default.
- Keep immutable change history is ON.
- Each confusing field has a short explanation under it.
- Header RPC should reflect HTTP RPC health accurately.
- Save settings, reload, and confirm values persist.
- /api/settings/audit should show a new settings change after save.

ROLLBACK

node MEMEFLOW_SETTINGS_AUDIT_V7/rollback.mjs
