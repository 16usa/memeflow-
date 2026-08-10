MEMEFLOW FINAL AI NATIVE SHEET v14

ROOT CAUSE OF THE FREEZE
------------------------
The previous v12/v13 layer repeatedly scanned a large part of the DOM while the
AI page was open, and also used a MutationObserver/interval around a backend
modal whose classes/styles were being changed by the patch itself.

On iPhone Safari this can create an expensive feedback loop:
DOM mutation -> scan -> class/style write -> mutation -> scan...

v14 removes that architecture completely.

V14 ARCHITECTURE
----------------
- ONE final AI runtime layer only.
- Old v7-v13 AI script tags are removed from index.html.
- Old v7 style block is removed.
- Open AI assistant stays inside MANUAL AI SCAN.
- More stays in the bottom menu.
- AI opens as a real .mobile-sheet, like Positions.
- The legacy OpenAI UI is captured ONCE and hidden as backend-only.
- No DOM-wide MutationObserver.
- No repeated full-DOM scans.
- While AI is open, only one lightweight 800 ms sync reads the known backend.
- Close button simply closes the native sheet; it does not fight the hidden modal.

INSTALL
-------
cd ~/workspace
unzip -o MEMEFLOW_AI_FINAL_NATIVE_SHEET_V14.zip
node MEMEFLOW_AI_FINAL_NATIVE_SHEET_V14/apply-ai-final-v14.mjs

Then:
Stop -> Run -> refresh Safari.

ROLLBACK
--------
cd ~/workspace
node MEMEFLOW_AI_FINAL_NATIVE_SHEET_V14/rollback-final-v14.mjs
