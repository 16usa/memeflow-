MEMEFLOW GLOBAL PRIMARY CYAN V54

PURPOSE
-------
Use the same primary-action cyan seen on MEMEFLOW OpenAI Analyze / Ask
across the rest of the site.

Exact sampled color:
#61DFFF

WHAT CHANGES
------------
Only interactive controls that are already filled white / very-light and
represent enabled primary actions are recolored to cyan.

Examples:
- Connect wallet
- Analyze token
- Upgrade to Pro
- Save settings
- other enabled white/light primary CTA buttons

WHAT DOES NOT CHANGE
--------------------
- dark secondary buttons
- disabled buttons
- Disconnect / delete / destructive controls
- green/yellow status controls
- tabs / nav / bottom navigation
- layout, sizes, padding, radius or positions
- click handlers
- API / server / trading logic
- OpenAI / Manual Scan functionality

INSTALL — NO SERVER START
-------------------------
cd ~/workspace
unzip -o MEMEFLOW_GLOBAL_PRIMARY_CYAN_V54.zip
node MEMEFLOW_GLOBAL_PRIMARY_CYAN_V54/apply-global-primary-cyan-v54.mjs
node MEMEFLOW_GLOBAL_PRIMARY_CYAN_V54/verify-global-primary-cyan-v54.mjs

Expected:
V54 INSTALL OK: 4/4
V54 VERIFY OK: 13/13

No server restart required. Refresh Safari after install.

ROLLBACK
--------
cd ~/workspace
node MEMEFLOW_GLOBAL_PRIMARY_CYAN_V54/rollback-global-primary-cyan-v54.mjs
