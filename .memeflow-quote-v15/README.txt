MEMEFLOW Quote-Aware Market Fix V15

Fixes the remaining issue visible after V14:
- stale pre-fix price/MC could still be displayed after restart
- V14 intentionally disabled non-SOL historical chart backfill, so quiet tokens stayed on "Syncing real trades"
- quote-aware historical Pump TradeEvents are now rebuilt into a fresh V15 archive
- persisted invalid quote price is never used as UI/trading truth
- paper entry and paper mark paths fail closed while quote pricing is unresolved
- no automatic restart

Install from the existing Replit workspace:
  unzip -o MEMEFLOW-Quote-Aware-V15.zip -d .memeflow-quote-v15 && bash .memeflow-quote-v15/install.sh

Then restart the app manually.
