# Final Replit readiness

This package is one coherent application, not a collection of demos. Demo tokens and fabricated market values are absent.

Validated locally:
- Server boot and static site delivery.
- Cookie-scoped users and isolated settings.
- Settings GET/PUT/default/kill-switch routes.
- Decision feed and chart endpoints.
- LIVE fail-closed behavior.
- 500-user synthetic evaluator remains available via `npm run benchmark`.

Live Solana discovery requires real RPC and WebSocket Secrets. Stripe and real execution remain locked until their production credentials and transaction builder are connected.
