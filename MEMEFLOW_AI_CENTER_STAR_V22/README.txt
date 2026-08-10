MEMEFLOW AI CENTER STAR V22

WHAT WAS WRONG IN V21
---------------------
The AI star was position:absolute, but an older V20 rule still assigned:
grid-column: 3

For an absolutely positioned CSS Grid child, that old grid placement can still
change its containing grid area. That is why the star appeared over Positions
instead of the physical center of the entire bottom bar.

V22 FIX
-------
- Removes the inherited grid-column:3 rule.
- Explicitly resets grid-column and grid-row to auto.
- Clears inherited inset/right/bottom values.
- Positions the AI tap target at left:50%; top:50% of the whole mobile-nav.
- Keeps transform: translate(-50%,-50%).
- Keeps the visible control as ONLY the ✦ star.
- No border, no rounded box, no background, no button shadow.
- Transparent 48x48 tap target remains.
- Wallet stays top-right.
- Evaluator config/logic is unchanged.

INSTALL
-------
cd ~/workspace
unzip -o MEMEFLOW_AI_CENTER_STAR_V22.zip
node MEMEFLOW_AI_CENTER_STAR_V22/apply-ai-star-v22.mjs

Then:
Stop -> Run -> refresh Safari.

ROLLBACK
--------
cd ~/workspace
node MEMEFLOW_AI_CENTER_STAR_V22/rollback-ai-star-v22.mjs
