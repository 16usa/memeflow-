# InsightX Wallet Intelligence V1

This integration is deliberately additive and read-only. MEMEFLOW's Solana RPC holder enrichment remains the canonical holder source, and `evaluate()` remains the only canonical Score/State authority. InsightX is exposed as a shadow intelligence layer and Atlas Live visualization.

## Replit Secrets

Required for REST wallet intelligence:

- `INSIGHTX_API_KEY` — InsightX API key. It stays server-side and is never returned to the browser.

Required for Atlas Live in production:

- `INSIGHTX_ATLAS_EMBED_ID` — production embed identifier supplied by InsightX.

Optional:

- `INSIGHTX_ENABLED=true`
- `INSIGHTX_EXTENDED_METRICS=true` — clusters + distribution + bundlers + insiders + snipers. Default true.
- `INSIGHTX_SHADOW_PREFETCH=false` — when true, visible Token Flow cards are warmed sequentially in the background. Default false to avoid unexpected API usage.
- `INSIGHTX_CACHE_TTL_MS=60000`
- `INSIGHTX_REQUEST_TIMEOUT_MS=5000`
- `INSIGHTX_CACHE_MAX_TOKENS=500`

## Runtime behavior

The client calls `/api/insightx/wallet-intelligence?mint=<MINT>` only when the wallet-map window is opened. Responses are cached in-memory and concurrent requests are deduplicated. Upstream failures are fail-open: they never block MEMEFLOW scanning, scoring, or trading.

The window embeds:

`https://embed.insightx.network/atlas/sol/<MINT>?embed_id=<ID>`

The API key is sent only by the server using the `X-API-Key` header to `https://api.insightx.network`.
