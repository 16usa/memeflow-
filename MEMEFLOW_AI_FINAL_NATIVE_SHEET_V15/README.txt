MEMEFLOW FINAL AI NATIVE SHEET v15

FIX
---
v14 correctly opened the native AI page, but its legacy-backend detector was too
restrictive. The original small MEMEFLOW OpenAI modal therefore remained visible
and v14 displayed "AI backend could not be detected."

v15 detects the legacy modal directly from its actual contents:
- heading/text contains MEMEFLOW OpenAI
- contains an input
- contains a textarea
- contains Ask AI

It then permanently force-hides that exact legacy container with display:none!important.
If that modal has its own small overlay wrapper, that wrapper is hidden too.

The old modal is NOT deleted. It remains mounted and its real buttons/API logic are
used as the backend for the native sheet.

PERFORMANCE
-----------
- No MutationObserver loops.
- No continuous whole-page scanning.
- Backend search happens only during first open, for less than one second.
- After capture, sync is scoped to the known backend every 900 ms.

INSTALL
-------
cd ~/workspace
unzip -o MEMEFLOW_AI_FINAL_NATIVE_SHEET_V15.zip
node MEMEFLOW_AI_FINAL_NATIVE_SHEET_V15/apply-ai-final-v15.mjs

Then:
Stop -> Run -> refresh Safari.

ROLLBACK
--------
cd ~/workspace
node MEMEFLOW_AI_FINAL_NATIVE_SHEET_V15/rollback-final-v15.mjs
