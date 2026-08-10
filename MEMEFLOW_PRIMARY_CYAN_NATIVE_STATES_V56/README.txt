MEMEFLOW PRIMARY CYAN — NATIVE STATES V56

WHAT V56 DOES
-------------
V56 fixes the exact problem from V55:

The app's ORIGINAL state system remains in charge.
V56 does NOT invent separate cyan hover / disabled / loading rules.

Instead it:
1. Temporarily exposes the button's native MEMEFLOW state.
2. Reads the native fill for that exact moment/state.
3. Measures how much the original white fill was darkened.
4. Applies the SAME darkening amount to the MEMEFLOW OpenAI cyan.
5. Leaves native opacity, filter, transform, transition, disabled/loading logic and click behavior untouched.

Examples:
- old active white -> full cyan
- old disabled grey -> equally dimmed cyan
- old active/pressed darker white -> equally darker cyan
- if MEMEFLOW dims through opacity/filter, that original mechanism remains untouched and dims cyan itself

V54/V55 active script tags are disabled by V56.

INSTALL — NO SERVER START
-------------------------
cd ~/workspace
unzip -o MEMEFLOW_PRIMARY_CYAN_NATIVE_STATES_V56.zip
node MEMEFLOW_PRIMARY_CYAN_NATIVE_STATES_V56/apply-primary-cyan-native-states-v56.mjs
node MEMEFLOW_PRIMARY_CYAN_NATIVE_STATES_V56/verify-primary-cyan-native-states-v56.mjs

Expected:
V56 INSTALL OK: 6/6
V56 VERIFY OK: 20/20

No server restart required. Refresh Safari after installation.

ROLLBACK
--------
cd ~/workspace
node MEMEFLOW_PRIMARY_CYAN_NATIVE_STATES_V56/rollback-primary-cyan-native-states-v56.mjs

Rollback restores the exact index.html that existed immediately before V56,
including whichever V54/V55 tag was present before installation.
