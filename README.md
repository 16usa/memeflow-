# MEMEFLOW Mobile Chart Polish

This cosmetic update:

- reduces mobile chart height from 350px to 320px;
- makes the current-price label more compact;
- tightens the LIVE badge and age label;
- gives slightly more room to the plot;
- keeps the existing image, OHLC logic and backend unchanged.

## Apply

```bash
unzip -o MEMEFLOW_CHART_MOBILE_POLISH.zip
node scripts/install-chart-mobile-polish.mjs
```

Then **Stop → Run** and refresh Safari.

## Rollback

```bash
cp memeflow-app/index.html.before-chart-mobile-polish memeflow-app/index.html
```
