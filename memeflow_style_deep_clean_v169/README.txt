V169 fixes the V168 marker-parser failure seen on MEMEFLOW_THEME_CANVAS_V135.

MEMEFLOW DEEP STYLE CLEAN V169

This is a deep cleanup, not another visual layer.

What V169 fixes
---------------
1. Scans every top-level HTML page in memeflow-app.
2. Covers every current production/shared-theme page:
   index, System Overview, How It Works, Smart Vault, Trading Terminal,
   Settings, Token Flow, X100, Agent Performance, Owner Intelligence,
   Discovery Source.
3. Replaces the mixed legacy V65 file with a cleaned guardrail/semantic file.
4. Replaces the mixed legacy V131 file with a cleaned structural/geometry file.
5. Removes the old global neutral text/surface contracts from those files.
6. Deletes V162-V167 generated visual CSS authorities.
7. Makes memeflow-x-canonical-v169.css the ONE final dark visual authority.
8. Adds X100 and Discovery Source to the canonical system.
9. Normalizes standalone page root tokens.
10. Validates canonical is the LAST stylesheet on every production page.

Final dark tokens
-----------------
Background / neutral surfaces  #000000
Primary text                  #E7E9EA
Strong text                   #FFFFFF
Secondary/meta                #71767B
Tertiary                      #536471
Link/focus                    #1D9BF0
Border/divider                #2F3336
Neutral button                #111111
Neutral hover                 #171717

Semantic state colors remain separate by design.

Install
-------
unzip -o Memflow-Deep-Style-Clean-V169.zip && bash memeflow_style_deep_clean_v169/install.sh

Audit again later
-----------------
bash memeflow_style_deep_clean_v169/audit.sh

Rollback
--------
bash memeflow_style_deep_clean_v169/rollback.sh

No server/system restart is performed.
