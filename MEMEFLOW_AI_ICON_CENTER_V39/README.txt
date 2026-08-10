MEMEFLOW AI ICON CENTER V39

What V39 changes
================
V38 already fixed the duplicate/extra star problem correctly.
V39 only refines the icon placement and look:
- vertically centers the AI icon inside the mobile nav slot
- keeps it horizontally centered
- makes it slightly larger
- does NOT increase nav height
- does NOT change AI button behavior or API logic

Install
=======
cd ~/workspace
unzip -o MEMEFLOW_AI_ICON_CENTER_V39.zip
node MEMEFLOW_AI_ICON_CENTER_V39/apply-ai-icon-center-v39.mjs
node MEMEFLOW_AI_ICON_CENTER_V39/verify-ai-icon-center-v39.mjs

Expected
========
V39 INSTALL OK: 4/4
V39 VERIFY OK: 10/10

Then Stop -> Run -> hard refresh Safari.
