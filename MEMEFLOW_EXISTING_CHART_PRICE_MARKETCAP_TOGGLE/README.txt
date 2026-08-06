MEMEFLOW EXISTING CHART PRICE / MARKET CAP TOGGLE

This patch changes only the existing Market Chart toolbar.

It does NOT:
- create a second canvas;
- hide the existing canvas;
- replace the chart renderer;
- change chart height;
- change chart data loading.

Behavior:
- default shows Price in USDT;
- tap the metric to show Market Cap in USD;
- tap again to return to Price;
- selected mode is remembered on the device;
- English number formatting is used;
- scientific notation is not shown in the toggle.

INSTALL:

cd ~/workspace
unzip -o MEMEFLOW_EXISTING_CHART_PRICE_MARKETCAP_TOGGLE.zip -d MEMEFLOW_EXISTING_CHART_PRICE_MARKETCAP_TOGGLE
node MEMEFLOW_EXISTING_CHART_PRICE_MARKETCAP_TOGGLE/install.mjs
node MEMEFLOW_EXISTING_CHART_PRICE_MARKETCAP_TOGGLE/self-test.mjs

Then restart Replit and reopen Safari.

ROLLBACK:

node MEMEFLOW_EXISTING_CHART_PRICE_MARKETCAP_TOGGLE/rollback.mjs
