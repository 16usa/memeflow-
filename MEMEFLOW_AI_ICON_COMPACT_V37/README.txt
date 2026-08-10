MEMEFLOW AI ICON COMPACT V37

Fixes the exact V36 visual regression visible on the phone screenshot:
- sparkle cluster was too large and blurry
- it escaped vertically from the bottom navigation
- an older pseudo-element produced a separate extra star below

V37:
- removes the V36 runtime/tag
- uses a crisp 25x23 px three-sparkle vector
- main sparkle + two smaller sparkles
- very subtle 2 px glow only
- explicitly disables the old ::after star
- clips the icon inside its nav cell
- does not replace the AI button
- does not touch its click handler, OpenAI page, API, Wallet, or trading logic

INSTALL
cd ~/workspace
unzip -o MEMEFLOW_AI_ICON_COMPACT_V37.zip
node MEMEFLOW_AI_ICON_COMPACT_V37/apply-ai-icon-compact-v37.mjs
node MEMEFLOW_AI_ICON_COMPACT_V37/verify-ai-icon-compact-v37.mjs

Expected:
V37 INSTALL OK: 4/4
V37 VERIFY OK: 10/10

Then Stop -> Run -> hard refresh Safari.
