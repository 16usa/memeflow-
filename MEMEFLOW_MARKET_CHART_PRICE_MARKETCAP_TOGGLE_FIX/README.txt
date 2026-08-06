MEMEFLOW MARKET CHART PRICE / MARKET CAP TOGGLE FIX

Install this package instead of the previous Market Chart patches.

It includes:

1. Real hard reset
- closes the old EventSource;
- clears token address, candles and trade markers;
- removes stale price/percentage/age;
- shows WAITING when no candidate exists.

2. Correct chart rendering
- filters invalid zero and extreme outlier candles;
- uses a robust 2%-98% visible price range;
- limits the visible history for each interval;
- shows a readable candle width on mobile;
- prevents one bad candle from flattening the whole chart;
- redraws automatically when the token or interval changes.

INSTALL:

cd ~/workspace
unzip -o MEMEFLOW_MARKET_CHART_COMPLETE_FIX.zip -d MEMEFLOW_MARKET_CHART_COMPLETE_FIX
node MEMEFLOW_MARKET_CHART_COMPLETE_FIX/install.mjs
node MEMEFLOW_MARKET_CHART_COMPLETE_FIX/self-test.mjs

Then fully stop and restart Replit and reopen Safari.

ROLLBACK:

node MEMEFLOW_MARKET_CHART_COMPLETE_FIX/rollback.mjs


3. Normal English price formatting
- removes scientific notation such as $2.87514e-8;
- displays the same price as 0.000000028751 USDT;
- uses English number formatting;
- uses decimal prices on the chart scale;
- never shows e-8 / e-9 notation to users.


4. Tap-to-switch headline metric
- default: token Price in USDT;
- tap the large number: Market Cap in USD;
- tap again: returns to Price;
- the selected mode is remembered on the device;
- label always explains what is currently displayed;
- does not mix token price with market capitalization.
