MEMEFLOW PAPER CLOSE SAFETY V78

Purpose
-------
Stops false Flat outcomes caused by manual PAPER close settling at the untouched
entry-price placeholder.

Behavior after patch
--------------------
1. Manual PAPER close requires a fresh post-entry market mark.
2. Fresh token market price is preferred.
3. A fresh PaperEngine lifecycle mark is the fallback.
4. If no fresh mark exists, close returns EXIT_PRICE_UNAVAILABLE and the
   position remains OPEN.
5. A genuine breakeven is still allowed to close as Flat.
6. Automatic lifecycle exits are unchanged.
7. Exit metadata is stored:
   - exitPriceSource
   - exitPriceAtMs / exitPriceAt
   - exitSettlementVersion

Install
-------
From repository root:
  bash install.sh

The installer:
- creates a timestamped backup under .memeflow-backups/
- patches live-bootstrap.mjs with one guarded import
- creates the V78 modules and regression test
- runs syntax checks + regression test
- commits only the four patch files when there were no pre-existing staged files
- attempts git push origin HEAD

Rollback
--------
  bash rollback.sh

Important
---------
This stops NEW false Flat results. Existing historical Flat rows are not rewritten
because reconstructing their historical exit price must be audited against the
runtime market/chart history instead of guessing.
