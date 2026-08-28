MEMEFLOW LIVE TOKEN STATES BACKEND FIX v4

Purpose
- Adds the missing GET /api/system/stream Server-Sent Events transport expected by the current System View frontend.
- Emits a real `create` event only after the existing Pump CREATE filter accepts an event.
- Emits a real `token` event from the existing publish(mint) cadence.
- Does NOT modify user settings, trading filters, candidate selection, AI decisions, positions, paper execution, or live execution.

Why v4
- v3 could roll back after a successful syntax-valid patch because `git diff --check` was treated as fatal. In a Replit worktree that can fail on unrelated/pre-existing whitespace in app-server.mjs.
- v4 makes that check informational only and validates the actual SSE contract directly.
- If any real patch validation fails, v4 prints the exact failing command/line and restores the original file.

Install from ~/workspace
rm -rf .memeflow-patch-v4 && unzip -o memeflow-live-token-states-backend-v4.zip -d .memeflow-patch-v4 && bash .memeflow-patch-v4/memeflow_live_token_states_backend_v4/install.sh
