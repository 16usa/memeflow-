# MEMEFLOW — Replit-ready package

## Import
1. Create a new Replit Node.js app.
2. Upload and extract the entire ZIP into the project root.
3. Add the Secrets from `.env.example`.
4. Run `npm test`, then `npm start`.

## Required Secrets
- `SOLANA_RPC_URLS`: comma-separated primary and backup Solana JSON-RPC URLs.
- `SOLANA_WS_URLS`: matching WebSocket URLs.

## What works after RPC/WS configuration
- Direct Pump program discovery through Solana `logsSubscribe`.
- Detection of `create` and `create_v2` instructions.
- Shared on-chain enrichment per mint.
- Per-user evaluation and isolated settings/decisions.
- Direct bonding-curve price polling and chart SSE.
- PAPER-only operation for free/anonymous users.
- Fail-closed LIVE route.

## Deliberately locked until credentials/integration are supplied
- Stripe checkout/webhooks.
- Production identity provider.
- Signed LIVE transaction construction and confirmation.
- Full holder count beyond RPC's largest-account response.
- Automatic PumpSwap pool discovery after migration.

The UI never reports these components as healthy when they are not configured.
