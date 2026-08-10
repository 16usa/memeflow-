MEMEFLOW BOTTOM NAV FLUSH V44

What this fixes
---------------
The phone bottom menu was lifted above the physical bottom edge because V43 used:

bottom: calc(8px + env(safe-area-inset-bottom))

V44 changes the geometry so:
- the BAR itself is bottom:0
- the BAR background reaches the physical bottom edge
- iPhone safe-area is kept INSIDE the bar
- menu content stays in the upper 76px usable band
- the AI icon remains centered in that 76px band
- Wallet behavior from V43 is preserved

Install
-------
cd ~/workspace
unzip -o MEMEFLOW_BOTTOM_NAV_FLUSH_V44.zip
node MEMEFLOW_BOTTOM_NAV_FLUSH_V44/apply-bottom-nav-flush-v44.mjs
node MEMEFLOW_BOTTOM_NAV_FLUSH_V44/verify-bottom-nav-flush-v44.mjs

Expected
--------
V44 INSTALL OK: 5/5
V44 VERIFY OK: 14/14

Then:
Stop -> Run -> fully reload Safari.
