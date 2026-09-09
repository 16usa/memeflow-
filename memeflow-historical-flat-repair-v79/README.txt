MEMEFLOW HISTORICAL FLAT REPAIR V79
===================================

Goal
----
Audit the old pre-V78 MANUAL PAPER CLOSE rows that were recorded with exactly
0 realized P&L and separate them into:

1) RECOVERABLE
   A trustworthy historical chart mark exists at-or-before the close time and
   no more than 120 seconds old. P&L can be reconstructed.

2) UNKNOWN
   There is not enough reliable historical evidence. The repair tool will NOT
   invent a price.

3) VERIFIED TRUE FLAT
   The historical price evidence really produces breakeven.

Safety
------
The installer runs AUDIT ONLY. It does not mutate state.json or analytics DB.

The future --apply mode:
- requires explicit confirmation;
- refuses to run while MEMEFLOW is responding on port 3000;
- creates a timestamped backup of state + analytics SQLite/WAL/SHM;
- updates state.json and platform analytics consistently;
- auto-rolls back if apply fails.

Install + audit
---------------
From repository root:

  unzip -o memeflow-historical-flat-repair-v79.zip
  bash memeflow-historical-flat-repair-v79/install.sh

Then send the printed audit summary to ChatGPT.

DO NOT RUN APPLY YET.

Apply command (only after reviewing the audit)
----------------------------------------------
With MEMEFLOW stopped:

  node memeflow-app/scripts/historical-flat-repair-v79.mjs     --apply     --confirm=REPAIR_HISTORICAL_FLATS

Rollback
--------
The apply command prints the exact rollback command and backup path.
MEMEFLOW must also be stopped during rollback.

Why UNKNOWN instead of Flat?
----------------------------
Agent Performance already distinguishes null/unknown P&L from exact zero.
If a reliable historical close price cannot be proven, null is truthful and
prevents contaminated Win/Loss/Flat learning statistics.
