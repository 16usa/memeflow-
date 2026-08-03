# MEMEFLOW

Solana meme token monitoring and trading platform. Discovers new tokens via Solana `logsSubscribe`, evaluates them with a decision engine, and provides real-time charting via SSE. Paper trading is free/anonymous; live trading requires a Stripe Pro subscription ($49.99/mo) or owner entitlement.

## Run & Operate

- **MEMEFLOW app** — workflow `MEMEFLOW`: `cd memeflow-app && node app-server.mjs` (port 3000)
- `pnpm --filter @workspace/api-server run dev` — monorepo API server (port 8080, unused by MEMEFLOW)

## Stack

### MEMEFLOW (memeflow-app/)
- Pure Node.js ESM, zero npm dependencies
- Single-file server: `app-server.mjs`
- Frontend: `index.html` (self-contained dark trading UI)
- Persistence: JSON flat-file store (`data/state.json`)
- Real-time: SSE chart streams, Solana WebSocket `logsSubscribe`

### Monorepo (unused by MEMEFLOW)
- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5 · DB: PostgreSQL + Drizzle ORM

## Where things live

- `memeflow-app/app-server.mjs` — HTTP server + all API routes
- `memeflow-app/index.html` — entire frontend (1500+ lines, self-contained)
- `memeflow-app/src/store.mjs` — JSON state store
- `memeflow-app/src/solana.mjs` — RPC pool, base58, curve decode
- `memeflow-app/src/billing.mjs` — Stripe checkout/webhook/portal
- `memeflow-app/src/evaluate.mjs` / `evaluator.mjs` — token scoring
- `memeflow-app/data/` — runtime state (gitignored in spirit)

## Architecture decisions

- MEMEFLOW is intentionally standalone — do not migrate to React or the monorepo stack.
- No npm deps: uses only Node.js built-ins (`http`, `fs`, `crypto`, `path`).
- State is a single JSON file; no database needed for this app.
- The existing `artifacts/api-server` Express server is separate and unrelated to MEMEFLOW.

## Product

- Token discovery via Solana Pump program `logsSubscribe`
- Per-user decision engine with configurable scoring filters
- Real-time price chart (SSE) with bonding-curve polling
- Paper Mode (free, anonymous via cookie session)
- Pro live trading entitlement via Stripe or owner claim
- Owner access via `OWNER_ACCESS_KEY` secret → `/api/owner/claim`

## User preferences

- Run MEMEFLOW exactly as-is from the uploaded source — do not rebuild, redesign, migrate, or patch CSS.
- Preserve: HTML/CSS/JS structure, Solana discovery, decision engine, chart SSE, Paper Mode, owner LIVE entitlement, existing API routes.

## Gotchas

- PORT is set to 3000 by the workflow; do not hard-code it elsewhere.
- `APP_URL` env var is optional — the server derives origin from request headers if absent.
- Stripe billing routes return `503 BILLING_NOT_CONFIGURED` until `STRIPE_SECRET_KEY`, `STRIPE_PRICE_ID`, and `STRIPE_WEBHOOK_SECRET` secrets are added.
- Owner claim requires `OWNER_ACCESS_KEY` secret; `/api/owner/claim` returns `503` without it.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
