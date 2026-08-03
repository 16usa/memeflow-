# Initial State Fix Audit

Fixed the empty startup state shown before any live Solana candidate is available.

- Pre-trade and Evidence links are disabled until relevant backend data exists.
- Anonymous PAPER mode now waits for live Solana events, not "authenticated events".
- WAITING uses the neutral waiting visual state, not BUY-ready green styling.
- Empty candidate copy references live discovery rather than a misleading authenticated feed.
- Button availability is recalculated on every decision-feed render.
