MEMEFLOW PATCH — Live Token States scope=all

Install from the project root in Replit Shell:

  unzip -o memeflow-live-token-states-scope-all.zip -d .memeflow-patch && bash .memeflow-patch/install.sh

The installer:
- finds the Live Token States frontend request safely;
- changes only its /api/ai/decisions?view=items request to scope=all;
- runs git diff --check;
- commits and pushes automatically when a change is made.

If it prints an ERROR before FIX COMPLETE, send the full Shell output and do not make manual edits.
