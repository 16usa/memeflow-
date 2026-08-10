MEMEFLOW MANUAL AI SCAN PLACEHOLDER ONLY V53

This patch does ONE thing:
- Makes the placeholder text inside the existing MANUAL AI SCAN Mint input compact (11px).

It does NOT:
- put Mint + Analyze on one row
- change module layout
- change input height/width/padding
- change Analyze button
- change scan logic
- change API calls
- change result blocks
- change Candidate Feed
- change OpenAI page
- change server files

If V52 was installed, V53 removes the V52 script tag so the one-line layout disappears after refresh.

INSTALL:
cd ~/workspace
unzip -o MEMEFLOW_MANUAL_SCAN_PLACEHOLDER_ONLY_V53.zip
node MEMEFLOW_MANUAL_SCAN_PLACEHOLDER_ONLY_V53/apply-manual-scan-placeholder-v53.mjs
node MEMEFLOW_MANUAL_SCAN_PLACEHOLDER_ONLY_V53/verify-manual-scan-placeholder-v53.mjs

Expected:
V53 INSTALL OK: 7/7
V53 VERIFY OK: 15/15

No server restart is required. Refresh Safari.

ROLLBACK:
node MEMEFLOW_MANUAL_SCAN_PLACEHOLDER_ONLY_V53/rollback-manual-scan-placeholder-v53.mjs
