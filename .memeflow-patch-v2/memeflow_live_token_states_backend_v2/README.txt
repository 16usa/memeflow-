MEMEFLOW — Live Token States backend fix v2

What it fixes:
- GET /api/ai/decisions previously defaulted to scope=candidates.
- In the current candidate visibility logic, candidates means BUY_READY only.
- Monitoring pages that need WATCH / WAITING / BLOCKED / BUY_READY can therefore receive an empty feed.
- This patch changes only the default read scope for /api/ai/decisions to "all".
- Explicit ?scope=candidates remains available.
- It does not change BUY/SELL decision logic or trading state transitions.

Install from the Replit project root:

rm -rf .memeflow-patch-v2 && unzip -o memeflow-live-token-states-backend-v2.zip -d .memeflow-patch-v2 && bash .memeflow-patch-v2/memeflow_live_token_states_backend_v2/install.sh

Expected final line:
FIX COMPLETE

After install:
Restart the Replit Run/server if it does not restart automatically, then refresh Live Token States.
