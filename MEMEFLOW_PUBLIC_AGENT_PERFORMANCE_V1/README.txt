MEMEFLOW PUBLIC AGENT PERFORMANCE V1

Creates a public /agent-performance.html page backed by the existing local
PlatformTradeAnalytics SQLite summary. It shows headline result, win/loss/flat,
P&L, time-in-trade, score/holders/top10/buy-pressure outcome buckets, exit
reasons, strategy sources, and 7D/30D/90D windows.

The API is aggregate-only. It does not expose owner intelligence, raw user IDs,
wallets, emails, settings, individual positions, or individual trade rows.

Install:
unzip -o MEMEFLOW_PUBLIC_AGENT_PERFORMANCE_V1.zip && node MEMEFLOW_PUBLIC_AGENT_PERFORMANCE_V1/install.mjs

Verify:
node MEMEFLOW_PUBLIC_AGENT_PERFORMANCE_V1/verify.mjs

Rollback:
node MEMEFLOW_PUBLIC_AGENT_PERFORMANCE_V1/rollback.mjs
