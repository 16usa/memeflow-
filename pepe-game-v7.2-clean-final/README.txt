PEPE ROCKET V7.2 CLEAN FINAL

Purpose:
- Keep the current pre-V8 V7.2 one-screen game.
- Remove only proven-dead focus-mode leftovers from the live Game files.
- Remove stale old Game installer/version artifacts from /home/runner/workspace.
- Do NOT touch trading/server/project logic.

Install clean current files:
  node ./pepe-game-v7.2-clean-final/update-pepe-game-v72-clean.mjs
  node ./pepe-game-v7.2-clean-final/verify-pepe-game-v72-clean.mjs

Review cleanup plan (deletes nothing):
  node ./pepe-game-v7.2-clean-final/cleanup-old-game-artifacts-v72.mjs

Apply cleanup after reviewing:
  node ./pepe-game-v7.2-clean-final/cleanup-old-game-artifacts-v72.mjs --apply

Verify again:
  node ./pepe-game-v7.2-clean-final/verify-pepe-game-v72-clean.mjs

Rollback clean-file changes:
  node ./pepe-game-v7.2-clean-final/rollback-pepe-game-v72-clean.mjs

IMPORTANT:
The cleanup script never traverses or deletes files inside memeflow-app.
It only deletes root-level artifacts positively identified as old Pepe Game
versions/installers/verifiers, plus a 'source' folder only when every item
inside matches a strict legacy-game allowlist.
