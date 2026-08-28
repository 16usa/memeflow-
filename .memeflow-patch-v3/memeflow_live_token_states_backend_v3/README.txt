MEMEFLOW — LIVE TOKEN STATES BACKEND FIX v3

Target:
  Current MEMEFLOW Live System View where system.js already opens:
    new EventSource('/api/system/stream')
  but app-server.mjs is missing that backend route.

What this patch changes:
  - app-server.mjs only
  - adds read-only GET /api/system/stream (SSE)
  - emits accepted Pump CREATE events as "create"
  - emits existing publish(mint) updates as "token"
  - heartbeat + cleanup for closed browser connections
  - no work on the hot path when no System View client is connected

What it deliberately does NOT change:
  - /api/ai/decisions candidate semantics
  - Trading Terminal BUY READY filtering
  - settings / risk gates / score calculation
  - paper/live execution logic
  - wallet/billing logic

Installer behavior:
  - detects MEMEFLOW app root automatically
  - verifies the current V31 frontend contract before changing anything
  - validates baseline app-server.mjs syntax
  - creates a timestamped backup
  - applies the patch once (idempotent)
  - validates node syntax and required hooks
  - runs git diff --check when inside a git worktree
  - rolls app-server.mjs back automatically on validation failure

Install from workspace root:
  rm -rf .memeflow-sse-v3 && unzip -o memeflow-live-token-states-backend-v3.zip -d .memeflow-patch-v3 && bash .memeflow-patch-v3/memeflow_live_token_states_backend_v3/install.sh
