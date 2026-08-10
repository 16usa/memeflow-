MEMEFLOW AI REPAIR V26

WHY V25 COULD BREAK PAGE LOAD
=============================
V25 was too destructive:
1) it replaced the complete .mobile-nav HTML,
2) it physically removed the original Wallet nav node,
3) it deleted older AI patch/runtime files.

That can break native code that already captured or bound the original nav nodes.
V26 does NOT do that.

V26 REPAIR STRATEGY
===================
- First restores index.html.pre-ai-final-ui-v25.bak when that backup is clean.
- If that backup is unavailable, performs a narrow in-place repair.
- Reinstalls the last known-stable V24 AI runtime.
- Recovers the exact existing evaluator endpoint/config from V25/V24/V23... config.
- Keeps the original Wallet nav node in the DOM.
- Hides Wallet in compact nav only with CSS.
- Adds only one tiny V26 layout layer.
- Deletes NO project files.

FINAL UI
========
PHONE:
  Home | Candidates | ✦ | Positions | More
  AI is star only.

TABLET:
  Home | Candidates | ✦ AI | Positions | More
  Wallet icon remains in the header.

DESKTOP:
  Original left sidebar remains.
  ✦ AI is added after Wallet (or Positions fallback).
  Bottom phone/tablet nav is hidden.

MANUAL AI SCAN:
  Open AI assistant is visually removed from that module.

INSTALL / REPAIR
================
cd ~/workspace
unzip -o MEMEFLOW_AI_REPAIR_V26.zip
node MEMEFLOW_AI_REPAIR_V26/repair-and-install-v26.mjs
node MEMEFLOW_AI_REPAIR_V26/verify-v26.mjs

Expected:
  REPAIR OK: 11/11
  V26 VERIFY OK: 15/15

Then:
Stop -> Run -> hard refresh browser/Safari.

EMERGENCY RESTORE
=================
node MEMEFLOW_AI_REPAIR_V26/restore-pre-v25.mjs
