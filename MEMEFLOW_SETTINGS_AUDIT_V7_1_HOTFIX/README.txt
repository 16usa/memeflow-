MEMEFLOW SETTINGS AUDIT V7.1 HOTFIX

This fixes the malformed liquidity gate line inserted into src/evaluate.mjs by V7.

Run from ~/workspace:

unzip -o MEMEFLOW_SETTINGS_AUDIT_V7_1_HOTFIX.zip -d MEMEFLOW_SETTINGS_AUDIT_V7_1_HOTFIX
node MEMEFLOW_SETTINGS_AUDIT_V7_1_HOTFIX/hotfix.mjs
node MEMEFLOW_SETTINGS_AUDIT_V7/self-test.mjs

Do not restart until:
ALL V7 SELF-TESTS PASSED
