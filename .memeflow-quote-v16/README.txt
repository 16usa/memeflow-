MEMEFLOW Quote Price V16

Fix:
- confirmed BUY/SELL execution amount is the primary Pump price authority;
- virtual reserves are fallback only;
- quote_mint / quote_decimals are repaired from recent Pump reference data;
- a >20x mismatch against fresh Pump usd_market_cap fails closed;
- chart history uses a fresh V16 namespace;
- display can use fresh Pump USD market cap while trading remains blocked;
- no automatic restart.

Install in the existing Replit workspace:
rm -rf .memeflow-quote-v16 && mkdir -p .memeflow-quote-v16 && unzip -o MEMEFLOW-Quote-Price-V16.zip -d .memeflow-quote-v16 && bash .memeflow-quote-v16/install.sh
