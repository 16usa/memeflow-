MEMEFLOW GLOBAL PRIMARY CYAN V55

WHY V54 DID NOT STAY CYAN
-------------------------
V54 used one normal CSS class with !important.
The existing MEMEFLOW button selectors have stronger specificity/state rules.
They could win over V54, so you mainly saw a faint cyan active/pressed flash.

V55 FIX
-------
V55 writes ONLY the four visual primary-button properties as INLINE !important:
- background
- background-color
- border-color
- text color

Inline !important outranks the existing high-specificity button rules.

V55 also tries to read the actual MEMEFLOW OpenAI Analyze/Ask button color.
If that sheet is not mounted yet, it falls back to #61DFFF.

TARGETS
-------
Enabled white/light primary actions, including:
- Connect wallet
- Analyze / Analyze token
- Upgrade to Pro
- Save settings
- similar enabled light primary CTA buttons

EXCLUDED
--------
- disabled buttons such as Waiting for candidate
- dark secondary actions
- Disconnect / destructive actions
- navigation / tabs / chips / status controls

INSTALL
-------
cd ~/workspace
unzip -o MEMEFLOW_GLOBAL_PRIMARY_CYAN_V55.zip
node MEMEFLOW_GLOBAL_PRIMARY_CYAN_V55/apply-global-primary-cyan-v55.mjs
node MEMEFLOW_GLOBAL_PRIMARY_CYAN_V55/verify-global-primary-cyan-v55.mjs

Expected:
V55 INSTALL OK: 5/5
V55 VERIFY OK: 16/16

No server restart required. Refresh Safari.

ROLLBACK
--------
cd ~/workspace
node MEMEFLOW_GLOBAL_PRIMARY_CYAN_V55/rollback-global-primary-cyan-v55.mjs

Rollback restores the exact index.html that existed immediately before V55.
