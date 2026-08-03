# MEMEFLOW clean Replit release

- Removed the separate `production-dark-stability` override layer.
- Kept one canonical stylesheet and folded responsive production rules into it.
- Added safe-area-aware bottom navigation clearance.
- Collapsed mobile decision/check grids to one full-width column.
- Prevented mobile horizontal overflow and hidden fixed background legend on phones.
- Added `/api/health` and `/api/market/status` endpoints.
- Preserved owner LIVE server authorization and all existing tests.
- No Replit agent `memeflow-mobile-fixes` patch exists in this package.

Required Replit secrets for live data: `SOLANA_RPC_URLS`, `SOLANA_WS_URLS`.
Optional billing secrets: `STRIPE_SECRET_KEY`, `STRIPE_PRICE_ID`, `STRIPE_WEBHOOK_SECRET`.
Owner access: `OWNER_ACCESS_KEY` and/or `OWNER_USER_IDS`.
