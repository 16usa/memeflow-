MEMEFLOW AI Manual Scan Patch v7

This version fixes the missing button by modifying index.html directly instead of trying to discover the MANUAL AI SCAN module at runtime.

Result:
- Home / Candidates / Positions / Wallet / More restored in bottom navigation
- Open AI assistant button inserted directly under Analyze token
- Existing AI launcher is hidden, but its original click logic is preserved
- When AI opens, its overlay is forced to full-screen mobile-sheet style

Install:
cd ~/workspace
unzip -o MEMEFLOW_AI_MANUAL_SCAN_PATCH_V7.zip
node MEMEFLOW_AI_MANUAL_SCAN_PATCH_V7/apply-ai-nav-patch.mjs
